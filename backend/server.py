"""VicinoMed Backend - Premium Italian medical specialist booking platform."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt as pyjwt
import httpx
import secrets
import hashlib
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta, date as date_type

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'vicinomed-secret-key-change-in-prod')
JWT_ALGO = 'HS256'
JWT_EXPIRES_DAYS = 7

# Resend (email service) — dev mode if not configured
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', 'DEV_MODE')
RESEND_FROM = os.environ.get('RESEND_FROM', 'VicinoMed <onboarding@resend.dev>')
DEV_MODE = (RESEND_API_KEY == 'DEV_MODE' or not RESEND_API_KEY)

# Password reset
RESET_TOKEN_TTL_HOURS = 1
RESET_RATE_LIMIT_PER_HOUR = 3

app = FastAPI(title="VicinoMed API")
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ==========================
# Models
# ==========================
Role = Literal['patient', 'doctor', 'studio', 'admin']

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Role = 'patient'
    phone: Optional[str] = None
    auth_provider: Literal['email', 'google'] = 'email'
    is_active: bool = True
    verified: bool = False
    created_at: datetime

class StudioInfoIn(BaseModel):
    name: str = Field(min_length=2)
    address: str = Field(min_length=3)
    city: str = Field(min_length=2)
    postal_code: Optional[str] = None
    description: Optional[str] = None
    phone: str = Field(min_length=5)
    whatsapp: Optional[str] = None
    rooms_count: int = Field(ge=1, le=200, default=1)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: Role = 'patient'
    phone: Optional[str] = None
    studio_info: Optional[StudioInfoIn] = None  # required when role=studio

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class AuthOut(BaseModel):
    session_token: str
    user: User

class GoogleSessionIn(BaseModel):
    session_id: str

class Studio(BaseModel):
    studio_id: str
    name: str
    address: str
    city: str
    postal_code: str
    lat: float
    lng: float
    phone: str

class Doctor(BaseModel):
    doctor_id: str
    name: str
    title: str  # Dr. / Dott.ssa / Prof.
    specialties: List[str]
    bio: str
    photo: str
    rating: float
    reviews_count: int
    verified: bool = True
    price_from: int  # euros
    languages: List[str] = ['Italiano']
    experience_years: int
    studios: List[Studio]

class Review(BaseModel):
    review_id: str
    doctor_id: str
    patient_name: str
    rating: int
    comment: str
    created_at: datetime

class BookingIn(BaseModel):
    doctor_id: str
    studio_id: str
    datetime_iso: str  # ISO 8601
    reason: Optional[str] = None

class Booking(BaseModel):
    booking_id: str
    patient_id: str
    patient_name: str
    patient_phone: Optional[str] = None
    doctor_id: str
    doctor_name: str
    doctor_phone: Optional[str] = None
    studio_id: str
    studio_name: str
    studio_address: str
    studio_lat: float
    studio_lng: float
    specialty: str
    datetime_iso: str
    status: Literal['confermato', 'cancellato', 'completato'] = 'confermato'
    reason: Optional[str] = None
    created_at: datetime

# ==========================
# Helpers
# ==========================
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_jwt(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS),
        'iat': datetime.now(timezone.utc),
        'type': 'jwt'
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(
    authorization: Optional[str] = Header(None),
    request: Request = None
) -> User:
    token = None
    if authorization and authorization.lower().startswith('bearer '):
        token = authorization.split(' ', 1)[1].strip()
    elif request is not None:
        token = request.cookies.get('session_token')
    if not token:
        raise HTTPException(401, "Non autenticato")

    user_id = None
    # Try JWT first
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get('user_id')
    except Exception:
        # Try Emergent session token in DB
        session = await db.user_sessions.find_one({'session_token': token}, {'_id': 0})
        if not session:
            raise HTTPException(401, "Sessione non valida")
        expires_at = session.get('expires_at')
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at and expires_at < datetime.now(timezone.utc):
            raise HTTPException(401, "Sessione scaduta")
        user_id = session['user_id']

    if not user_id:
        raise HTTPException(401, "Token non valido")
    user_doc = await db.users.find_one({'user_id': user_id}, {'_id': 0, 'password_hash': 0})
    if not user_doc:
        raise HTTPException(401, "Utente non trovato")
    if user_doc.get('is_active') is False:
        raise HTTPException(403, "Account sospeso. Contatta il supporto.")
    # Backfill defaults for legacy users
    user_doc.setdefault('is_active', True)
    user_doc.setdefault('verified', False)
    return User(**user_doc)

# ==========================
# Auth Routes
# ==========================
@api_router.post("/auth/register", response_model=AuthOut)
async def register(data: RegisterIn):
    # Block admin role from public registration
    if data.role == 'admin':
        raise HTTPException(403, "Ruolo non consentito tramite registrazione pubblica.")
    existing = await db.users.find_one({'email': data.email.lower()})
    if existing:
        raise HTTPException(400, "Email già registrata")
    if data.role == 'studio' and not data.studio_info:
        raise HTTPException(400, "Per registrarti come Studio compila le informazioni dello studio.")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        'user_id': user_id,
        'email': data.email.lower(),
        'password_hash': hash_password(data.password),
        'name': data.name,
        'picture': None,
        'role': data.role,
        'phone': data.phone,
        'auth_provider': 'email',
        'is_active': True,
        'verified': False,
        'created_at': datetime.now(timezone.utc)
    }
    await db.users.insert_one(doc)

    # If studio role, eagerly create the clinic record using provided info
    if data.role == 'studio' and data.studio_info:
        si = data.studio_info
        # Try to geocode the address (best-effort, non-blocking on failure)
        lat, lng = 0.0, 0.0
        try:
            async with httpx.AsyncClient(timeout=8.0) as hc:
                geo_r = await hc.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={
                        'q': f"{si.address}, {si.city}, Italia",
                        'format': 'json', 'limit': 1, 'countrycodes': 'it',
                    },
                    headers={'User-Agent': 'VicinoMed/1.0', 'Accept-Language': 'it'},
                )
            if geo_r.status_code == 200 and geo_r.json():
                first = geo_r.json()[0]
                lat = float(first['lat']); lng = float(first['lon'])
        except Exception as _e:
            logger.warning(f"Geocode failed at studio register: {_e}")

        await db.clinics.insert_one({
            'clinic_id': f"cli_{uuid.uuid4().hex[:10]}",
            'owner_email': data.email.lower(),
            'name': si.name,
            'description': si.description or '',
            'address': si.address,
            'city': si.city,
            'postal_code': si.postal_code or '',
            'lat': lat, 'lng': lng,
            'phone': si.phone,
            'whatsapp': si.whatsapp or si.phone,
            'rooms_count': si.rooms_count,
            'rooms': [],
            'photo': None,
            'verified': False,
            'created_at': datetime.now(timezone.utc),
        })

    token = make_jwt(user_id)
    user = User(**{k: v for k, v in doc.items() if k != 'password_hash'})
    return AuthOut(session_token=token, user=user)

@api_router.post("/auth/login", response_model=AuthOut)
async def login(data: LoginIn):
    user_doc = await db.users.find_one({'email': data.email.lower()})
    if not user_doc or not user_doc.get('password_hash'):
        raise HTTPException(401, "Credenziali non valide")
    if not verify_password(data.password, user_doc['password_hash']):
        raise HTTPException(401, "Credenziali non valide")
    if user_doc.get('is_active') is False:
        raise HTTPException(403, "Account sospeso. Contatta il supporto.")
    token = make_jwt(user_doc['user_id'])
    user_doc.pop('_id', None)
    user_doc.pop('password_hash', None)
    # Backfill defaults for legacy users created before is_active/verified existed
    user_doc.setdefault('is_active', True)
    user_doc.setdefault('verified', False)
    return AuthOut(session_token=token, user=User(**user_doc))

@api_router.post("/auth/google/session")
async def google_session(data: GoogleSessionIn, response: Response):
    """Exchange Emergent session_id for full user data + persistent session_token."""
    async with httpx.AsyncClient() as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={'X-Session-ID': data.session_id},
            timeout=15.0
        )
    if r.status_code != 200:
        raise HTTPException(401, "session_id non valido o scaduto")
    payload = r.json()
    email = payload['email'].lower()
    name = payload.get('name', email.split('@')[0])
    picture = payload.get('picture')
    session_token = payload['session_token']

    # Upsert user
    existing = await db.users.find_one({'email': email}, {'_id': 0})
    if existing:
        user_id = existing['user_id']
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            'user_id': user_id,
            'email': email,
            'name': name,
            'picture': picture,
            'role': 'patient',
            'phone': None,
            'auth_provider': 'google',
            'created_at': datetime.now(timezone.utc)
        })

    # Store session
    await db.user_sessions.insert_one({
        'user_id': user_id,
        'session_token': session_token,
        'expires_at': datetime.now(timezone.utc) + timedelta(days=7),
        'created_at': datetime.now(timezone.utc)
    })

    # Cookie for web
    response.set_cookie(
        'session_token', session_token,
        max_age=7 * 24 * 60 * 60, httponly=True, secure=True, samesite='none', path='/'
    )

    user_doc = await db.users.find_one({'user_id': user_id}, {'_id': 0, 'password_hash': 0})
    return {'session_token': session_token, 'user': User(**user_doc).model_dump(mode='json')}

@api_router.get("/auth/me", response_model=User)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(response: Response, authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith('bearer '):
        token = authorization.split(' ', 1)[1].strip()
        await db.user_sessions.delete_many({'session_token': token})
    response.delete_cookie('session_token', path='/')
    return {'ok': True}


# ==========================
# Password Reset
# ==========================
class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _build_reset_url(request: Request, raw_token: str) -> str:
    """Build the public reset-password URL using the public origin of the incoming request."""
    base = os.environ.get('PUBLIC_APP_URL', '').rstrip('/')
    if not base:
        # Derive from request: scheme + host (Kubernetes ingress rewrites /api → port 8001
        # and / → port 3000, so the same host serves the frontend)
        host = request.headers.get('x-forwarded-host') or request.headers.get('host', 'localhost:3000')
        scheme = request.headers.get('x-forwarded-proto') or 'https'
        if 'localhost' in host or '127.0.0.1' in host:
            scheme = 'http'
        base = f"{scheme}://{host}"
    return f"{base}/auth/reset-password?token={raw_token}"


def _build_reset_email_html(name: str, reset_url: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Reimposta la password VicinoMed</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" style="background:#F8FAFC;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" style="background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(10,61,98,0.08);">
        <tr><td style="background:#0A3D62;padding:32px;text-align:center;">
          <div style="display:inline-block;width:64px;height:64px;background:#FFFFFF;border-radius:18px;line-height:64px;font-size:38px;font-weight:900;color:#0A3D62;">+</div>
          <h1 style="margin:16px 0 4px;color:#FFFFFF;font-size:24px;font-weight:800;">VicinoMed</h1>
          <p style="margin:0;color:rgba(255,255,255,0.85);font-size:13px;">La visita specialistica più vicina a te</p>
        </td></tr>
        <tr><td style="padding:36px 32px 12px;">
          <h2 style="margin:0 0 12px;color:#0F172A;font-size:22px;font-weight:700;">Reimposta la tua password</h2>
          <p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:23px;">
            Ciao {name or 'utente'},<br/>
            abbiamo ricevuto una richiesta di reimpostazione password per il tuo account VicinoMed.
            Tocca il pulsante qui sotto per impostarne una nuova.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:14px;background:#00C48C;">
              <a href="{reset_url}" target="_blank" style="display:inline-block;padding:14px 28px;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;">
                Reimposta password →
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#64748B;font-size:13px;line-height:20px;">
            Oppure copia e incolla questo link nel browser:
          </p>
          <p style="margin:0 0 24px;word-break:break-all;color:#0A3D62;font-size:12px;background:#F1F5F9;padding:10px 12px;border-radius:8px;">
            {reset_url}
          </p>
          <div style="border-top:1px solid #E2E8F0;padding-top:18px;color:#94A3B8;font-size:12px;line-height:18px;">
            🔒 Il link è valido per 1 ora ed è utilizzabile una sola volta.<br/>
            Se non hai richiesto tu il reset, puoi ignorare questa email — la tua password non verrà modificata.
          </div>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:18px;text-align:center;color:#94A3B8;font-size:12px;">
          © 2026 VicinoMed · La tua salute, vicino a te
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


async def _send_reset_email(to_email: str, name: str, reset_url: str) -> bool:
    """Send via Resend if configured, otherwise dev-mode log to console.
    Returns True if 'sent' (real or simulated)."""
    html = _build_reset_email_html(name, reset_url)
    subject = "Reimposta la tua password VicinoMed"

    if DEV_MODE:
        logger.warning("\n" + "=" * 78 + "\n" +
                       "📧  [DEV MODE] EMAIL DI RESET PASSWORD (non inviata realmente)\n" +
                       f"    A: {to_email}\n" +
                       f"    Oggetto: {subject}\n" +
                       f"    Link di reset: {reset_url}\n" +
                       "    Imposta RESEND_API_KEY in backend/.env per inviare davvero.\n" +
                       "=" * 78)
        return True

    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            r = await hc.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": RESEND_FROM,
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                },
            )
        if r.status_code >= 400:
            logger.error(f"Resend send failed {r.status_code}: {r.text}")
            return False
        logger.info(f"Reset email sent to {to_email} (resend_id={r.json().get('id')})")
        return True
    except Exception as e:
        logger.error(f"Resend exception: {e}")
        return False


@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordIn, request: Request):
    """Generate password reset token and send via email.
    Always returns 202 (anti-enumeration). In DEV_MODE the reset_url is also
    returned in the response body so it can be used without email."""
    email = data.email.lower()
    user = await db.users.find_one({'email': email}, {'_id': 0, 'password_hash': 0})

    response_payload: dict = {
        "ok": True,
        "message": "Se l'email è registrata riceverai a breve un link per reimpostare la password.",
        "dev_mode": DEV_MODE,
    }

    if not user:
        # Anti-enumeration: same response shape, do nothing
        return response_payload

    # Rate limit: max RESET_RATE_LIMIT_PER_HOUR requests per email per hour
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_count = await db.password_resets.count_documents({
        'email': email,
        'created_at': {'$gte': one_hour_ago},
    })
    if recent_count >= RESET_RATE_LIMIT_PER_HOUR:
        raise HTTPException(429, "Hai richiesto troppi reset. Riprova tra qualche minuto.")

    if user.get('auth_provider') == 'google':
        # Google users have no password — gently nudge, but don't reveal existence either
        return response_payload

    # Generate cryptographically secure token (256 bits)
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_TTL_HOURS)

    await db.password_resets.insert_one({
        'token_hash': token_hash,
        'user_id': user['user_id'],
        'email': email,
        'expires_at': expires_at,
        'used': False,
        'created_at': datetime.now(timezone.utc),
    })

    reset_url = _build_reset_url(request, raw_token)
    await _send_reset_email(to_email=email, name=user.get('name', ''), reset_url=reset_url)

    if DEV_MODE:
        response_payload["reset_link"] = reset_url

    return response_payload


@api_router.post("/auth/reset-password", response_model=AuthOut)
async def reset_password(data: ResetPasswordIn):
    """Validate the reset token, update the user's password and return a fresh JWT
    so the client can auto-login."""
    # Validate password complexity: 8+ chars, 1 upper, 1 digit
    pw = data.new_password
    if len(pw) < 8 or not any(c.isupper() for c in pw) or not any(c.isdigit() for c in pw):
        raise HTTPException(400, "La password deve essere di almeno 8 caratteri, contenere una maiuscola e un numero.")

    token_hash = _hash_token(data.token)
    record = await db.password_resets.find_one({'token_hash': token_hash}, {'_id': 0})
    if not record or record.get('used'):
        raise HTTPException(400, "Token non valido o già utilizzato.")

    expires_at = record['expires_at']
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Token scaduto. Richiedi un nuovo link.")

    user_doc = await db.users.find_one({'user_id': record['user_id']})
    if not user_doc:
        raise HTTPException(404, "Utente non trovato.")

    new_hash = hash_password(pw)
    await db.users.update_one(
        {'user_id': record['user_id']},
        {'$set': {'password_hash': new_hash}},
    )

    # One-time token: mark used + also delete other unused tokens for this user
    await db.password_resets.update_one({'token_hash': token_hash}, {'$set': {'used': True, 'used_at': datetime.now(timezone.utc)}})
    await db.password_resets.delete_many({'user_id': record['user_id'], 'used': False})

    # Invalidate all existing Google/web sessions to force re-login on other devices
    await db.user_sessions.delete_many({'user_id': record['user_id']})

    # Auto-login: issue a fresh JWT
    new_token = make_jwt(record['user_id'])
    user_doc.pop('_id', None)
    user_doc.pop('password_hash', None)
    return AuthOut(session_token=new_token, user=User(**user_doc))

# ==========================
# Catalog Routes
# ==========================
SPECIALTIES = [
    {"id": "cardiologia", "name": "Cardiologia", "icon": "heart"},
    {"id": "dermatologia", "name": "Dermatologia", "icon": "sun"},
    {"id": "ginecologia", "name": "Ginecologia", "icon": "flower"},
    {"id": "ortopedia", "name": "Ortopedia", "icon": "bone"},
    {"id": "oculistica", "name": "Oculistica", "icon": "eye"},
    {"id": "odontoiatria", "name": "Odontoiatria", "icon": "smile"},
    {"id": "pediatria", "name": "Pediatria", "icon": "baby"},
    {"id": "psicologia", "name": "Psicologia", "icon": "brain"},
    {"id": "neurologia", "name": "Neurologia", "icon": "activity"},
    {"id": "endocrinologia", "name": "Endocrinologia", "icon": "droplet"},
    {"id": "urologia", "name": "Urologia", "icon": "shield"},
    {"id": "otorinolaringoiatria", "name": "Otorinolaringoiatria", "icon": "ear"},
]

@api_router.get("/specialties")
async def get_specialties():
    return SPECIALTIES

@api_router.get("/doctors")
async def list_doctors(
    specialty: Optional[str] = None,
    city: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 50
):
    query = {}
    if specialty:
        query['specialties'] = specialty
    if q:
        query['$or'] = [
            {'name': {'$regex': q, '$options': 'i'}},
            {'specialties': {'$regex': q, '$options': 'i'}},
        ]
    docs = await db.doctors.find(query, {'_id': 0}).to_list(limit)
    if city:
        docs = [d for d in docs if any(s.get('city', '').lower() == city.lower() for s in d.get('studios', []))]
    return docs

@api_router.get("/doctors/{doctor_id}")
async def get_doctor(doctor_id: str):
    doc = await db.doctors.find_one({'doctor_id': doctor_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Medico non trovato")
    reviews = await db.reviews.find({'doctor_id': doctor_id}, {'_id': 0}).sort('created_at', -1).to_list(20)
    doc['reviews'] = reviews
    return doc

@api_router.get("/doctors/{doctor_id}/availability")
async def get_availability(doctor_id: str, studio_id: str, date: str):
    """Generate deterministic time slots for the given date based on doctor_id + studio_id + date.
    Excludes already booked slots and blocks set by the doctor."""
    try:
        target_date = datetime.fromisoformat(date).date()
    except Exception:
        raise HTTPException(400, "Data non valida (formato ISO YYYY-MM-DD)")
    if target_date < datetime.now(timezone.utc).date():
        return {'date': date, 'slots': []}

    doctor = await db.doctors.find_one({'doctor_id': doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(404, "Medico non trovato")

    base = compute_default_slots(doctor_id, studio_id, target_date)

    # Exclude booked + blocked
    blocked = await get_blocked_times(doctor_id, studio_id, target_date)
    booked_times = await get_booked_times(doctor_id, studio_id, target_date)
    available = [s for s in base if s not in booked_times and s not in blocked]
    return {'date': date, 'slots': available}


def compute_default_slots(doctor_id: str, studio_id: str, target_date: date_type) -> list[str]:
    weekday = target_date.weekday()
    if weekday == 6:
        return []
    seed = (hash(doctor_id + studio_id + str(target_date)) % 10000) % 8
    morning = ["08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"]
    afternoon = ["14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"]
    base = morning + afternoon
    keep = [s for i, s in enumerate(base) if (i + seed) % 3 != 0]
    if weekday == 5:
        keep = [s for s in keep if s in morning]
    return keep


async def get_booked_times(doctor_id: str, studio_id: str, target_date: date_type) -> set[str]:
    day_start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    booked = await db.bookings.find({
        'doctor_id': doctor_id, 'studio_id': studio_id,
        'status': 'confermato'
    }, {'_id': 0, 'datetime_iso': 1}).to_list(500)
    out: set[str] = set()
    for b in booked:
        try:
            dt = datetime.fromisoformat(b['datetime_iso'].replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if day_start <= dt < day_end:
                out.add(dt.strftime('%H:%M'))
        except Exception:
            pass
    return out


async def get_blocked_times(doctor_id: str, studio_id: str, target_date: date_type) -> set[str]:
    docs = await db.doctor_blocks.find({
        'doctor_id': doctor_id, 'studio_id': studio_id,
        'date': target_date.isoformat(),
    }, {'_id': 0, 'time': 1}).to_list(200)
    return {d['time'] for d in docs}

# ==========================
# Bookings
# ==========================
@api_router.post("/bookings", response_model=Booking)
async def create_booking(data: BookingIn, current_user: User = Depends(get_current_user)):
    doctor = await db.doctors.find_one({'doctor_id': data.doctor_id}, {'_id': 0})
    if not doctor:
        raise HTTPException(404, "Medico non trovato")
    studio = next((s for s in doctor['studios'] if s['studio_id'] == data.studio_id), None)
    if not studio:
        raise HTTPException(404, "Studio non trovato")
    try:
        dt = datetime.fromisoformat(data.datetime_iso.replace('Z', '+00:00'))
    except Exception:
        raise HTTPException(400, "Data/ora non valida")

    # Check slot conflict
    conflict = await db.bookings.find_one({
        'doctor_id': data.doctor_id,
        'studio_id': data.studio_id,
        'datetime_iso': data.datetime_iso,
        'status': 'confermato'
    })
    if conflict:
        raise HTTPException(409, "Orario non più disponibile")

    booking = Booking(
        booking_id=f"book_{uuid.uuid4().hex[:12]}",
        patient_id=current_user.user_id,
        patient_name=current_user.name,
        patient_phone=current_user.phone,
        doctor_id=data.doctor_id,
        doctor_name=f"{doctor['title']} {doctor['name']}",
        doctor_phone=studio['phone'],
        studio_id=data.studio_id,
        studio_name=studio['name'],
        studio_address=f"{studio['address']}, {studio['city']}",
        studio_lat=studio['lat'],
        studio_lng=studio['lng'],
        specialty=doctor['specialties'][0] if doctor['specialties'] else '',
        datetime_iso=data.datetime_iso,
        reason=data.reason,
        created_at=datetime.now(timezone.utc),
        status='confermato'
    )
    await db.bookings.insert_one(booking.model_dump())
    return booking

@api_router.get("/bookings/me")
async def my_bookings(current_user: User = Depends(get_current_user)):
    items = await db.bookings.find(
        {'patient_id': current_user.user_id},
        {'_id': 0}
    ).sort('datetime_iso', -1).to_list(200)
    return items

@api_router.patch("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    res = await db.bookings.update_one(
        {'booking_id': booking_id, 'patient_id': current_user.user_id},
        {'$set': {'status': 'cancellato'}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Prenotazione non trovata")
    return {'ok': True}

# Doctor dashboard - bookings for the logged-in doctor
@api_router.get("/doctor/bookings")
async def doctor_bookings(current_user: User = Depends(get_current_user)):
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    # Map user email -> doctor record
    doctor = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    if not doctor:
        return []
    items = await db.bookings.find(
        {'doctor_id': doctor['doctor_id']},
        {'_id': 0}
    ).sort('datetime_iso', 1).to_list(500)
    return items


@api_router.get("/doctor/me")
async def doctor_me(current_user: User = Depends(get_current_user)):
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    doctor = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    if doctor:
        return doctor

    # Auto-create a minimal doctor record with one placeholder studio
    new_doctor = {
        'doctor_id': f"doc_{uuid.uuid4().hex[:10]}",
        'name': current_user.name or current_user.email.split('@')[0],
        'title': 'Dott.',
        'specialties': [],
        'bio': "Profilo da completare. Aggiungi una bio nelle impostazioni.",
        'photo': current_user.picture or "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        'rating': 0.0,
        'reviews_count': 0,
        'verified': False,
        'price_from': 80,
        'experience_years': 0,
        'languages': ['Italiano'],
        'owner_email': current_user.email,
        'studios': [{
            'studio_id': f"std_{uuid.uuid4().hex[:10]}",
            'name': 'Studio principale',
            'address': 'Via da configurare 1',
            'city': 'Milano',
            'postal_code': '00000',
            'lat': 45.4642,
            'lng': 9.1900,
            'phone': current_user.phone or '+39 000 0000000',
        }],
        'created_at': datetime.now(timezone.utc),
    }
    await db.doctors.insert_one(new_doctor)
    new_doctor.pop('_id', None)
    logger.info(f"Auto-created doctor profile for {current_user.email} (id={new_doctor['doctor_id']})")
    return new_doctor


class DoctorUpdate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    specialties: Optional[List[str]] = None
    bio: Optional[str] = Field(None, max_length=500)
    photo: Optional[str] = None
    price_from: Optional[int] = Field(None, ge=10, le=10000)
    experience_years: Optional[int] = Field(None, ge=0, le=70)
    languages: Optional[List[str]] = None
    opening_hours: Optional[dict] = None  # { "mon": "09:00-13:00, 15:00-19:00", ..., "sun": "" }


@api_router.patch("/doctor/me")
async def update_doctor_me(data: DoctorUpdate, current_user: User = Depends(get_current_user)):
    """Update the doctor's editable profile fields. Returns the updated record."""
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    update = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if update:
        # Ensure profile exists (auto-create via doctor_me path otherwise)
        existing = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0, 'doctor_id': 1})
        if not existing:
            # Trigger auto-create then retry
            await doctor_me(current_user=current_user)
        await db.doctors.update_one(
            {'owner_email': current_user.email},
            {'$set': update},
        )
    doctor = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    return doctor


class BlocksIn(BaseModel):
    studio_id: str
    date: str           # YYYY-MM-DD
    times: List[str]    # ["09:00", "09:30", ...]


@api_router.get("/doctor/availability")
async def doctor_availability(
    studio_id: str, date: str,
    current_user: User = Depends(get_current_user)
):
    """Return all default slots for the day with their status (available / booked / blocked).
    Doctor-only view used by the dashboard."""
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    doctor = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    if not doctor:
        raise HTTPException(404, "Profilo medico non trovato")
    if not any(s['studio_id'] == studio_id for s in doctor.get('studios', [])):
        raise HTTPException(404, "Studio non trovato")
    try:
        target_date = datetime.fromisoformat(date).date()
    except Exception:
        raise HTTPException(400, "Data non valida")

    base = compute_default_slots(doctor['doctor_id'], studio_id, target_date)
    blocked = await get_blocked_times(doctor['doctor_id'], studio_id, target_date)
    booked = await get_booked_times(doctor['doctor_id'], studio_id, target_date)

    slots = []
    for t in base:
        status = 'available'
        if t in booked:
            status = 'booked'
        elif t in blocked:
            status = 'blocked'
        slots.append({'time': t, 'status': status})

    return {
        'date': date,
        'studio_id': studio_id,
        'slots': slots,
        'is_closed': len(base) == 0,
    }


@api_router.post("/doctor/blocks")
async def add_blocks(data: BlocksIn, current_user: User = Depends(get_current_user)):
    """Block one or more slots so patients cannot book them."""
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    doctor = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    if not doctor:
        raise HTTPException(404, "Profilo medico non trovato")
    if not any(s['studio_id'] == data.studio_id for s in doctor.get('studios', [])):
        raise HTTPException(404, "Studio non trovato")
    try:
        datetime.fromisoformat(data.date)
    except Exception:
        raise HTTPException(400, "Data non valida")

    now = datetime.now(timezone.utc)
    inserted = 0
    for t in data.times:
        # Idempotent insert
        res = await db.doctor_blocks.update_one(
            {
                'doctor_id': doctor['doctor_id'],
                'studio_id': data.studio_id,
                'date': data.date,
                'time': t,
            },
            {'$setOnInsert': {
                'doctor_id': doctor['doctor_id'],
                'studio_id': data.studio_id,
                'date': data.date,
                'time': t,
                'created_at': now,
            }},
            upsert=True
        )
        if res.upserted_id:
            inserted += 1
    return {'ok': True, 'blocked': len(data.times), 'newly_blocked': inserted}


@api_router.delete("/doctor/blocks")
async def remove_blocks(data: BlocksIn, current_user: User = Depends(get_current_user)):
    """Unblock one or more slots."""
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    doctor = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    if not doctor:
        raise HTTPException(404, "Profilo medico non trovato")
    res = await db.doctor_blocks.delete_many({
        'doctor_id': doctor['doctor_id'],
        'studio_id': data.studio_id,
        'date': data.date,
        'time': {'$in': data.times},
    })
    return {'ok': True, 'unblocked': res.deleted_count}


# ==========================
# Doctor Studios CRUD
# ==========================
class StudioIn(BaseModel):
    name: str = Field(min_length=2)
    address: str = Field(min_length=3)
    city: str = Field(min_length=2)
    postal_code: str = Field(min_length=5, max_length=5)
    phone: str = Field(min_length=5)
    lat: float
    lng: float


def _clean_studio(data: StudioIn) -> dict:
    return {
        'name': data.name.strip(),
        'address': data.address.strip(),
        'city': data.city.strip(),
        'postal_code': data.postal_code.strip(),
        'phone': data.phone.strip(),
        'lat': float(data.lat),
        'lng': float(data.lng),
    }


@api_router.post("/doctor/studios")
async def create_studio(data: StudioIn, current_user: User = Depends(get_current_user)):
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    doctor = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    if not doctor:
        raise HTTPException(404, "Profilo medico non trovato")
    studio = {'studio_id': f"std_{uuid.uuid4().hex[:10]}", **_clean_studio(data)}
    await db.doctors.update_one(
        {'doctor_id': doctor['doctor_id']},
        {'$push': {'studios': studio}}
    )
    return studio


@api_router.patch("/doctor/studios/{studio_id}")
async def update_studio(
    studio_id: str, data: StudioIn,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    doctor = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    if not doctor:
        raise HTTPException(404, "Profilo medico non trovato")
    cleaned = _clean_studio(data)
    res = await db.doctors.update_one(
        {'doctor_id': doctor['doctor_id'], 'studios.studio_id': studio_id},
        {'$set': {f'studios.$.{k}': v for k, v in cleaned.items()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Studio non trovato")
    return {'ok': True, 'studio_id': studio_id}


@api_router.delete("/doctor/studios/{studio_id}")
async def delete_studio(studio_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    doctor = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    if not doctor:
        raise HTTPException(404, "Profilo medico non trovato")
    if len(doctor.get('studios', [])) <= 1:
        raise HTTPException(400, "Devi avere almeno uno studio attivo. Modificalo invece di eliminarlo.")
    res = await db.doctors.update_one(
        {'doctor_id': doctor['doctor_id']},
        {'$pull': {'studios': {'studio_id': studio_id}}},
    )
    if res.modified_count == 0:
        raise HTTPException(404, "Studio non trovato")
    # Cleanup: remove all blocks for this studio. Past bookings remain for history.
    await db.doctor_blocks.delete_many({
        'doctor_id': doctor['doctor_id'], 'studio_id': studio_id,
    })
    return {'ok': True}


@api_router.get("/studio/me")
async def studio_me(current_user: User = Depends(get_current_user)):
    """Return the clinic record for the logged-in studio owner.
    Auto-creates a placeholder if missing."""
    if current_user.role != 'studio':
        raise HTTPException(403, "Solo per studi")
    clinic = await db.clinics.find_one({'owner_email': current_user.email}, {'_id': 0})
    if clinic:
        return clinic
    new_clinic = {
        'clinic_id': f"cli_{uuid.uuid4().hex[:10]}",
        'owner_email': current_user.email,
        'name': current_user.name or 'Il mio Studio',
        'description': 'Profilo da completare.',
        'address': '', 'city': '', 'postal_code': '',
        'lat': 0.0, 'lng': 0.0,
        'phone': current_user.phone or '',
        'whatsapp': current_user.phone or '',
        'rooms_count': 1, 'rooms': [],
        'photo': None, 'verified': False,
        'created_at': datetime.now(timezone.utc),
    }
    await db.clinics.insert_one(new_clinic)
    new_clinic.pop('_id', None)
    return new_clinic


class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = Field(None, max_length=600)
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    rooms_count: Optional[int] = Field(None, ge=1, le=200)
    photo: Optional[str] = None


@api_router.patch("/studio/me")
async def update_studio_me(data: ClinicUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != 'studio':
        raise HTTPException(403, "Solo per studi")
    update = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if not await db.clinics.find_one({'owner_email': current_user.email}, {'_id': 0, 'clinic_id': 1}):
        await studio_me(current_user=current_user)  # auto-create
    if update:
        await db.clinics.update_one({'owner_email': current_user.email}, {'$set': update})
    return await db.clinics.find_one({'owner_email': current_user.email}, {'_id': 0})


@api_router.get("/clinics")
async def list_clinics(city: Optional[str] = None, limit: int = 50):
    """Public list of clinics for doctor search."""
    query = {}
    if city:
        query['city'] = {'$regex': f'^{city}$', '$options': 'i'}
    docs = await db.clinics.find(query, {'_id': 0}).to_list(limit)
    return docs


# ==========================
# Studio Rooms (Phase 2)
# ==========================
class RoomIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    equipment: List[str] = Field(default_factory=list)
    rental_modes: List[Literal['hourly', 'daily']] = Field(default_factory=lambda: ['hourly'])
    hourly_price: Optional[float] = Field(None, ge=0)
    daily_price: Optional[float] = Field(None, ge=0)
    available: bool = True
    photo: Optional[str] = None  # base64 or URL


def _clean_room(data: RoomIn) -> dict:
    out = data.model_dump(exclude_none=False)
    out['equipment'] = [e.strip() for e in (out.get('equipment') or []) if e and e.strip()]
    if not out.get('rental_modes'):
        out['rental_modes'] = ['hourly']
    # Validate prices vs modes
    if 'hourly' in out['rental_modes'] and not out.get('hourly_price'):
        raise HTTPException(400, "Imposta il prezzo orario per le stanze affittabili a ore.")
    if 'daily' in out['rental_modes'] and not out.get('daily_price'):
        raise HTTPException(400, "Imposta il prezzo giornaliero per le stanze affittabili a giornata.")
    return out


async def _get_owner_clinic(current_user: User):
    if current_user.role != 'studio':
        raise HTTPException(403, "Solo per studi")
    clinic = await db.clinics.find_one({'owner_email': current_user.email}, {'_id': 0})
    if not clinic:
        raise HTTPException(404, "Profilo studio non trovato. Completa il profilo prima.")
    return clinic


@api_router.get("/studio/rooms")
async def list_rooms(current_user: User = Depends(get_current_user)):
    clinic = await _get_owner_clinic(current_user)
    return clinic.get('rooms', [])


@api_router.post("/studio/rooms")
async def create_room(data: RoomIn, current_user: User = Depends(get_current_user)):
    clinic = await _get_owner_clinic(current_user)
    cleaned = _clean_room(data)
    room = {
        'room_id': f"rm_{uuid.uuid4().hex[:10]}",
        'created_at': datetime.now(timezone.utc).isoformat(),
        **cleaned,
    }
    await db.clinics.update_one(
        {'clinic_id': clinic['clinic_id']},
        {'$push': {'rooms': room}}
    )
    return room


@api_router.patch("/studio/rooms/{room_id}")
async def update_room(room_id: str, data: RoomIn, current_user: User = Depends(get_current_user)):
    clinic = await _get_owner_clinic(current_user)
    if not any(r.get('room_id') == room_id for r in clinic.get('rooms', [])):
        raise HTTPException(404, "Stanza non trovata")
    cleaned = _clean_room(data)
    await db.clinics.update_one(
        {'clinic_id': clinic['clinic_id'], 'rooms.room_id': room_id},
        {'$set': {f'rooms.$.{k}': v for k, v in cleaned.items()}},
    )
    return {'ok': True, 'room_id': room_id}


@api_router.delete("/studio/rooms/{room_id}")
async def delete_room(room_id: str, current_user: User = Depends(get_current_user)):
    clinic = await _get_owner_clinic(current_user)
    res = await db.clinics.update_one(
        {'clinic_id': clinic['clinic_id']},
        {'$pull': {'rooms': {'room_id': room_id}}},
    )
    if res.modified_count == 0:
        raise HTTPException(404, "Stanza non trovata")
    return {'ok': True}


@api_router.get("/clinics/search")
async def search_clinics_with_rooms(
    city: Optional[str] = None,
    mode: Optional[Literal['hourly', 'daily']] = None,
    max_hourly: Optional[float] = None,
    max_daily: Optional[float] = None,
    equipment: Optional[str] = None,  # comma-separated
    limit: int = 50,
):
    """Public search of clinics that have at least one available room matching filters.
    Used by doctors looking for rooms to rent."""
    query: dict = {'rooms.0': {'$exists': True}}
    if city:
        query['city'] = {'$regex': f'^{city}$', '$options': 'i'}
    docs = await db.clinics.find(query, {'_id': 0}).to_list(limit)

    eq_list = [e.strip().lower() for e in (equipment.split(',') if equipment else []) if e.strip()]

    out = []
    for clinic in docs:
        matching = []
        for room in clinic.get('rooms', []):
            if not room.get('available', True):
                continue
            if mode and mode not in (room.get('rental_modes') or []):
                continue
            if max_hourly is not None and room.get('hourly_price') is not None:
                if room['hourly_price'] > max_hourly:
                    continue
            if max_daily is not None and room.get('daily_price') is not None:
                if room['daily_price'] > max_daily:
                    continue
            if eq_list:
                room_eq = [str(e).lower() for e in (room.get('equipment') or [])]
                if not all(any(want in have for have in room_eq) for want in eq_list):
                    continue
            matching.append(room)
        if matching:
            clinic_copy = {k: v for k, v in clinic.items() if k != 'rooms'}
            clinic_copy['available_rooms'] = matching
            clinic_copy['rooms_available_count'] = len(matching)
            out.append(clinic_copy)
    return out


@api_router.get("/geocode")
async def geocode(q: str):
    """Simple geocoding proxy via Nominatim (OpenStreetMap). Italian addresses only.
    Returns up to 5 suggestions with lat/lng + parsed components."""
    if not q or len(q.strip()) < 3:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as hc:
            r = await hc.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    'q': q, 'format': 'json', 'limit': 5,
                    'countrycodes': 'it', 'addressdetails': 1,
                },
                headers={
                    'User-Agent': 'VicinoMed/1.0 (support@vicinomed.it)',
                    'Accept-Language': 'it',
                },
            )
    except Exception as e:
        logger.warning(f"Geocode error: {e}")
        return []
    if r.status_code != 200:
        return []
    out = []
    for item in r.json():
        a = item.get('address', {})
        road = a.get('road') or ''
        num = a.get('house_number') or ''
        full_addr = f"{road} {num}".strip() or item.get('display_name', '').split(',')[0]
        out.append({
            'lat': float(item['lat']),
            'lng': float(item['lon']),
            'display_name': item.get('display_name', ''),
            'address': full_addr,
            'city': a.get('city') or a.get('town') or a.get('village') or a.get('municipality') or '',
            'postal_code': a.get('postcode', ''),
        })
    return out

# ==========================
# Room Rental Requests (doctor → studio)
# ==========================
RequestStatus = Literal['pending', 'accepted', 'rejected', 'cancelled']


class RoomRequestIn(BaseModel):
    rental_mode: Literal['hourly', 'daily']
    start_iso: str  # ISO 8601 datetime, e.g. "2026-05-20T09:00:00.000Z"
    hours: Optional[int] = Field(None, ge=1, le=12)   # required if hourly
    days: Optional[int] = Field(None, ge=1, le=30)    # required if daily
    message: Optional[str] = Field(None, max_length=600)


class RoomRequestRespond(BaseModel):
    response_message: Optional[str] = Field(None, max_length=600)


def _calc_estimated_price(room: dict, mode: str, hours: Optional[int], days: Optional[int]) -> float:
    if mode == 'hourly':
        rate = float(room.get('hourly_price') or 0)
        return rate * (hours or 1)
    rate = float(room.get('daily_price') or 0)
    return rate * (days or 1)


def _serialize_request(r: dict) -> dict:
    """Strip mongo _id and ensure datetimes are ISO strings."""
    out = {k: v for k, v in r.items() if k != '_id'}
    for k in ('created_at', 'responded_at', 'cancelled_at'):
        v = out.get(k)
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


@api_router.post("/clinics/{clinic_id}/rooms/{room_id}/request")
async def create_room_request(
    clinic_id: str,
    room_id: str,
    data: RoomRequestIn,
    current_user: User = Depends(get_current_user),
):
    """A doctor sends a rental request to a studio for a specific room."""
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo i medici possono inviare richieste.")

    # Validate inputs based on mode
    if data.rental_mode == 'hourly' and not data.hours:
        raise HTTPException(400, "Specifica il numero di ore per affitto orario.")
    if data.rental_mode == 'daily' and not data.days:
        raise HTTPException(400, "Specifica il numero di giorni per affitto giornaliero.")

    # Validate datetime
    try:
        start_dt = datetime.fromisoformat(data.start_iso.replace('Z', '+00:00'))
    except Exception:
        raise HTTPException(400, "Formato data/ora non valido.")
    if start_dt < datetime.now(timezone.utc) - timedelta(minutes=5):
        raise HTTPException(400, "La data richiesta non può essere nel passato.")

    # Find clinic + room
    clinic = await db.clinics.find_one({'clinic_id': clinic_id}, {'_id': 0})
    if not clinic:
        raise HTTPException(404, "Studio non trovato.")
    room = next((r for r in clinic.get('rooms', []) if r.get('room_id') == room_id), None)
    if not room:
        raise HTTPException(404, "Stanza non trovata.")
    if not room.get('available', True):
        raise HTTPException(400, "Questa stanza non è attualmente disponibile.")
    if data.rental_mode not in (room.get('rental_modes') or []):
        raise HTTPException(400, "Modalità di affitto non supportata da questa stanza.")

    # Compute end + estimated price
    if data.rental_mode == 'hourly':
        end_dt = start_dt + timedelta(hours=data.hours or 1)
    else:
        end_dt = start_dt + timedelta(days=data.days or 1)
    estimated_price = _calc_estimated_price(room, data.rental_mode, data.hours, data.days)

    # Fetch doctor profile (specialties + phone) — best effort, do not block if missing
    doctor_profile = await db.doctors.find_one({'owner_email': current_user.email}, {'_id': 0})
    doctor_specialties: List[str] = doctor_profile.get('specialties', []) if doctor_profile else []
    doctor_photo = doctor_profile.get('photo') if doctor_profile else None

    request_doc = {
        'request_id': f"req_{uuid.uuid4().hex[:10]}",
        'clinic_id': clinic['clinic_id'],
        'clinic_name': clinic.get('name', ''),
        'clinic_owner_email': clinic.get('owner_email', ''),
        'room_id': room_id,
        'room_name': room.get('name', ''),
        'doctor_user_id': current_user.user_id,
        'doctor_name': current_user.name or current_user.email.split('@')[0],
        'doctor_email': current_user.email,
        'doctor_phone': current_user.phone or '',
        'doctor_specialties': doctor_specialties,
        'doctor_photo': doctor_photo,
        'rental_mode': data.rental_mode,
        'start_iso': start_dt.astimezone(timezone.utc).isoformat(),
        'end_iso': end_dt.astimezone(timezone.utc).isoformat(),
        'hours': data.hours,
        'days': data.days,
        'estimated_price': round(estimated_price, 2),
        'message': (data.message or '').strip() or None,
        'status': 'pending',
        'response_message': None,
        'created_at': datetime.now(timezone.utc),
        'responded_at': None,
        'cancelled_at': None,
    }
    await db.room_requests.insert_one(request_doc)
    logger.info(f"[RoomRequest] {current_user.email} → {clinic['clinic_id']}/{room_id} ({data.rental_mode}) €{estimated_price:.2f}")
    return _serialize_request(request_doc)


@api_router.get("/studio/requests")
async def list_studio_requests(
    status: Optional[RequestStatus] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    """Studio owner lists incoming rental requests."""
    if current_user.role != 'studio':
        raise HTTPException(403, "Solo per studi")
    query: dict = {'clinic_owner_email': current_user.email}
    if status:
        query['status'] = status
    docs = await db.room_requests.find(query).sort('created_at', -1).to_list(limit)
    return [_serialize_request(r) for r in docs]


@api_router.get("/studio/stats")
async def studio_stats(current_user: User = Depends(get_current_user)):
    """Aggregated stats for the studio dashboard."""
    if current_user.role != 'studio':
        raise HTTPException(403, "Solo per studi")
    clinic = await db.clinics.find_one({'owner_email': current_user.email}, {'_id': 0})
    rooms = clinic.get('rooms', []) if clinic else []
    rooms_total = len(rooms)
    rooms_available_today = sum(1 for r in rooms if r.get('available', True))

    # Pending requests count
    pending_count = await db.room_requests.count_documents({
        'clinic_owner_email': current_user.email,
        'status': 'pending',
    })

    # Income estimate this month (from accepted requests where start_iso falls in current month)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        month_end = month_start.replace(year=now.year + 1, month=1)
    else:
        month_end = month_start.replace(month=now.month + 1)

    income_pipeline = [
        {'$match': {
            'clinic_owner_email': current_user.email,
            'status': 'accepted',
            'start_iso': {
                '$gte': month_start.isoformat(),
                '$lt': month_end.isoformat(),
            },
        }},
        {'$group': {'_id': None, 'total': {'$sum': '$estimated_price'}, 'count': {'$sum': 1}}},
    ]
    income_doc = await db.room_requests.aggregate(income_pipeline).to_list(1)
    estimated_income_month = float(income_doc[0]['total']) if income_doc else 0.0
    accepted_count_month = int(income_doc[0]['count']) if income_doc else 0

    # All-time accepted
    accepted_total = await db.room_requests.count_documents({
        'clinic_owner_email': current_user.email,
        'status': 'accepted',
    })

    return {
        'rooms_total': rooms_total,
        'rooms_available_today': rooms_available_today,
        'requests_pending': pending_count,
        'estimated_income_month': round(estimated_income_month, 2),
        'accepted_this_month': accepted_count_month,
        'accepted_total': accepted_total,
    }


@api_router.patch("/studio/requests/{request_id}/accept")
async def accept_request(
    request_id: str,
    data: RoomRequestRespond = RoomRequestRespond(),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != 'studio':
        raise HTTPException(403, "Solo per studi")
    req = await db.room_requests.find_one({'request_id': request_id, 'clinic_owner_email': current_user.email}, {'_id': 0})
    if not req:
        raise HTTPException(404, "Richiesta non trovata.")
    if req['status'] != 'pending':
        raise HTTPException(400, f"Impossibile accettare una richiesta in stato '{req['status']}'.")
    update = {
        'status': 'accepted',
        'responded_at': datetime.now(timezone.utc),
        'response_message': (data.response_message or '').strip() or None,
    }
    await db.room_requests.update_one({'request_id': request_id}, {'$set': update})
    req.update(update)
    logger.info(f"[RoomRequest] ACCEPTED {request_id} by {current_user.email}")
    return _serialize_request(req)


@api_router.patch("/studio/requests/{request_id}/reject")
async def reject_request(
    request_id: str,
    data: RoomRequestRespond = RoomRequestRespond(),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != 'studio':
        raise HTTPException(403, "Solo per studi")
    req = await db.room_requests.find_one({'request_id': request_id, 'clinic_owner_email': current_user.email}, {'_id': 0})
    if not req:
        raise HTTPException(404, "Richiesta non trovata.")
    if req['status'] != 'pending':
        raise HTTPException(400, f"Impossibile rifiutare una richiesta in stato '{req['status']}'.")
    update = {
        'status': 'rejected',
        'responded_at': datetime.now(timezone.utc),
        'response_message': (data.response_message or '').strip() or None,
    }
    await db.room_requests.update_one({'request_id': request_id}, {'$set': update})
    req.update(update)
    logger.info(f"[RoomRequest] REJECTED {request_id} by {current_user.email}")
    return _serialize_request(req)


@api_router.get("/doctor/room-requests")
async def list_doctor_requests(
    status: Optional[RequestStatus] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    """Doctor lists their own sent requests."""
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    query: dict = {'doctor_user_id': current_user.user_id}
    if status:
        query['status'] = status
    docs = await db.room_requests.find(query).sort('created_at', -1).to_list(limit)
    return [_serialize_request(r) for r in docs]


@api_router.patch("/doctor/room-requests/{request_id}/cancel")
async def cancel_room_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != 'doctor':
        raise HTTPException(403, "Solo per medici")
    req = await db.room_requests.find_one({'request_id': request_id, 'doctor_user_id': current_user.user_id}, {'_id': 0})
    if not req:
        raise HTTPException(404, "Richiesta non trovata.")
    if req['status'] != 'pending':
        raise HTTPException(400, "Solo le richieste in attesa possono essere cancellate.")
    update = {'status': 'cancelled', 'cancelled_at': datetime.now(timezone.utc)}
    await db.room_requests.update_one({'request_id': request_id}, {'$set': update})
    req.update(update)
    return _serialize_request(req)


# ==========================
# Admin
# ==========================
async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != 'admin':
        raise HTTPException(403, "Accesso riservato all'amministratore")
    return current_user


def _user_public(doc: dict) -> dict:
    """Strip sensitive fields and ensure consistent shape for admin user listings."""
    out = {k: v for k, v in doc.items() if k not in ('_id', 'password_hash')}
    out.setdefault('is_active', True)
    out.setdefault('verified', False)
    if isinstance(out.get('created_at'), datetime):
        out['created_at'] = out['created_at'].isoformat()
    return out


@api_router.get("/admin/stats")
async def admin_stats(_: User = Depends(require_admin)):
    """Global platform stats for admin dashboard overview."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        month_end = month_start.replace(year=now.year + 1, month=1)
    else:
        month_end = month_start.replace(month=now.month + 1)

    # User counts (parallelizable but simple)
    users_total = await db.users.count_documents({})
    users_patient = await db.users.count_documents({'role': 'patient'})
    users_doctor = await db.users.count_documents({'role': 'doctor'})
    users_studio = await db.users.count_documents({'role': 'studio'})
    users_admin = await db.users.count_documents({'role': 'admin'})
    users_suspended = await db.users.count_documents({'is_active': False})
    users_verified_doctors = await db.users.count_documents({'role': 'doctor', 'verified': True})

    # Doctors collection (independent profiles)
    doctors_collection_total = await db.doctors.count_documents({})
    clinics_total = await db.clinics.count_documents({})

    # Bookings: today and this month
    today_iso = today_start.isoformat()
    tomorrow_iso = tomorrow_start.isoformat()
    month_start_iso = month_start.isoformat()
    month_end_iso = month_end.isoformat()
    bookings_today = await db.bookings.count_documents({
        'created_at': {'$gte': today_iso, '$lt': tomorrow_iso}
    })
    bookings_month = await db.bookings.count_documents({
        'created_at': {'$gte': month_start_iso, '$lt': month_end_iso}
    })
    bookings_total = await db.bookings.count_documents({})

    # Room requests
    requests_pending = await db.room_requests.count_documents({'status': 'pending'})
    requests_total = await db.room_requests.count_documents({})

    # Estimated platform revenue (this month from accepted requests)
    pipeline_revenue = [
        {'$match': {
            'status': 'accepted',
            'start_iso': {'$gte': month_start_iso, '$lt': month_end_iso},
        }},
        {'$group': {'_id': None, 'total': {'$sum': '$estimated_price'}}},
    ]
    rev_doc = await db.room_requests.aggregate(pipeline_revenue).to_list(1)
    accepted_volume_month = float(rev_doc[0]['total']) if rev_doc else 0.0
    # Platform fee estimate (configurable - default 10% on rentals)
    platform_fee_pct = 10.0
    platform_revenue_month = round(accepted_volume_month * platform_fee_pct / 100, 2)

    # Reviews
    reviews_total = await db.reviews.count_documents({})

    return {
        'users': {
            'total': users_total,
            'patient': users_patient,
            'doctor': users_doctor,
            'studio': users_studio,
            'admin': users_admin,
            'suspended': users_suspended,
            'verified_doctors': users_verified_doctors,
        },
        'doctors_profiles': doctors_collection_total,
        'clinics': clinics_total,
        'bookings': {
            'today': bookings_today,
            'month': bookings_month,
            'total': bookings_total,
        },
        'room_requests': {
            'pending': requests_pending,
            'total': requests_total,
            'accepted_volume_month': round(accepted_volume_month, 2),
            'platform_revenue_month': platform_revenue_month,
            'platform_fee_pct': platform_fee_pct,
        },
        'reviews_total': reviews_total,
        'generated_at': now.isoformat(),
    }


@api_router.get("/admin/users")
async def admin_list_users(
    role: Optional[str] = None,
    q: Optional[str] = None,
    is_active: Optional[bool] = None,
    verified: Optional[bool] = None,
    limit: int = 200,
    skip: int = 0,
    _: User = Depends(require_admin),
):
    query: dict = {}
    if role and role in ('patient', 'doctor', 'studio', 'admin'):
        query['role'] = role
    if is_active is not None:
        query['is_active'] = is_active
    if verified is not None:
        query['verified'] = verified
    if q:
        regex = {'$regex': q.strip(), '$options': 'i'}
        query['$or'] = [{'email': regex}, {'name': regex}]

    total = await db.users.count_documents(query)
    docs = await db.users.find(query).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    items = [_user_public(d) for d in docs]
    return {'total': total, 'items': items, 'skip': skip, 'limit': limit}


@api_router.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, _: User = Depends(require_admin)):
    user = await db.users.find_one({'user_id': user_id})
    if not user:
        raise HTTPException(404, "Utente non trovato.")
    enriched = _user_public(user)
    # Enrich with profile data
    if user.get('role') == 'doctor':
        prof = await db.doctors.find_one({'owner_email': user.get('email')}, {'_id': 0})
        enriched['doctor_profile'] = prof
        enriched['bookings_count'] = await db.bookings.count_documents({'doctor_owner_email': user.get('email')})
    elif user.get('role') == 'studio':
        prof = await db.clinics.find_one({'owner_email': user.get('email')}, {'_id': 0})
        enriched['clinic_profile'] = prof
        enriched['requests_count'] = await db.room_requests.count_documents({'clinic_owner_email': user.get('email')})
    elif user.get('role') == 'patient':
        enriched['bookings_count'] = await db.bookings.count_documents({'patient_email': user.get('email')})
    return enriched


@api_router.patch("/admin/users/{user_id}/verify")
async def admin_verify_user(user_id: str, _: User = Depends(require_admin)):
    user = await db.users.find_one({'user_id': user_id})
    if not user:
        raise HTTPException(404, "Utente non trovato.")
    new_value = not bool(user.get('verified', False))
    await db.users.update_one({'user_id': user_id}, {'$set': {'verified': new_value}})
    # Mirror on doctor profile if applicable
    if user.get('role') == 'doctor':
        await db.doctors.update_one({'owner_email': user.get('email')}, {'$set': {'verified': new_value}})
    elif user.get('role') == 'studio':
        await db.clinics.update_one({'owner_email': user.get('email')}, {'$set': {'verified': new_value}})
    logger.info(f"[Admin] {'VERIFIED' if new_value else 'UNVERIFIED'} user {user_id}")
    return {'user_id': user_id, 'verified': new_value}


@api_router.patch("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, current: User = Depends(require_admin)):
    user = await db.users.find_one({'user_id': user_id})
    if not user:
        raise HTTPException(404, "Utente non trovato.")
    if user.get('role') == 'admin':
        raise HTTPException(400, "Non puoi sospendere un altro amministratore.")
    if user.get('user_id') == current.user_id:
        raise HTTPException(400, "Non puoi sospendere te stesso.")
    await db.users.update_one({'user_id': user_id}, {'$set': {'is_active': False}})
    logger.info(f"[Admin] SUSPENDED user {user_id}")
    return {'user_id': user_id, 'is_active': False}


@api_router.patch("/admin/users/{user_id}/activate")
async def admin_activate_user(user_id: str, _: User = Depends(require_admin)):
    user = await db.users.find_one({'user_id': user_id})
    if not user:
        raise HTTPException(404, "Utente non trovato.")
    await db.users.update_one({'user_id': user_id}, {'$set': {'is_active': True}})
    logger.info(f"[Admin] ACTIVATED user {user_id}")
    return {'user_id': user_id, 'is_active': True}


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, current: User = Depends(require_admin)):
    user = await db.users.find_one({'user_id': user_id})
    if not user:
        raise HTTPException(404, "Utente non trovato.")
    if user.get('role') == 'admin':
        raise HTTPException(400, "Non puoi eliminare un altro amministratore.")
    if user.get('user_id') == current.user_id:
        raise HTTPException(400, "Non puoi eliminare te stesso.")
    email = user.get('email')
    # Cascade delete owned data
    if user.get('role') == 'doctor':
        await db.doctors.delete_many({'owner_email': email})
        await db.bookings.delete_many({'doctor_owner_email': email})
    elif user.get('role') == 'studio':
        await db.clinics.delete_many({'owner_email': email})
        await db.room_requests.delete_many({'clinic_owner_email': email})
    # Also clean any sent room requests
    await db.room_requests.delete_many({'doctor_user_id': user_id})
    # Finally delete user + sessions
    await db.user_sessions.delete_many({'user_id': user_id})
    await db.users.delete_one({'user_id': user_id})
    logger.info(f"[Admin] DELETED user {user_id} ({email})")
    return {'user_id': user_id, 'deleted': True}


@api_router.get("/admin/clinics")
async def admin_list_clinics(
    q: Optional[str] = None,
    limit: int = 200,
    _: User = Depends(require_admin),
):
    query: dict = {}
    if q:
        regex = {'$regex': q.strip(), '$options': 'i'}
        query['$or'] = [{'name': regex}, {'city': regex}, {'owner_email': regex}]
    docs = await db.clinics.find(query, {'_id': 0}).sort('created_at', -1).to_list(limit)
    # Enrich with rooms_count and request stats
    for c in docs:
        c['rooms_actual'] = len(c.get('rooms', []))
        c['rooms_available'] = sum(1 for r in c.get('rooms', []) if r.get('available', True))
        c['requests_pending'] = await db.room_requests.count_documents({
            'clinic_owner_email': c.get('owner_email'), 'status': 'pending'
        })
    return docs


@api_router.get("/admin/analytics")
async def admin_analytics(_: User = Depends(require_admin)):
    """Top cities and top specialties for the platform."""
    # Top cities by clinic count
    pipeline_cities = [
        {'$match': {'city': {'$ne': ''}}},
        {'$group': {'_id': '$city', 'clinics': {'$sum': 1}, 'rooms': {'$sum': {'$size': {'$ifNull': ['$rooms', []]}}}}},
        {'$sort': {'clinics': -1}},
        {'$limit': 10},
    ]
    top_cities = [
        {'city': d['_id'], 'clinics': d['clinics'], 'rooms': d['rooms']}
        for d in await db.clinics.aggregate(pipeline_cities).to_list(10)
    ]

    # Top specialties from doctors collection
    pipeline_specs = [
        {'$unwind': '$specialties'},
        {'$group': {'_id': '$specialties', 'doctors': {'$sum': 1}}},
        {'$sort': {'doctors': -1}},
        {'$limit': 10},
    ]
    top_specialties = [
        {'specialty': d['_id'], 'doctors': d['doctors']}
        for d in await db.doctors.aggregate(pipeline_specs).to_list(10)
    ]

    # Requests by status (last 30 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    pipeline_status = [
        {'$match': {'created_at': {'$gte': cutoff}}},
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
    ]
    by_status = {
        d['_id']: d['count']
        for d in await db.room_requests.aggregate(pipeline_status).to_list(10)
    }

    return {
        'top_cities': top_cities,
        'top_specialties': top_specialties,
        'requests_by_status_30d': by_status,
    }


# ==========================
# Seed
# ==========================
@api_router.post("/seed")
async def seed_data():
    """Idempotent seed of Italian doctors / studios / reviews."""
    existing = await db.doctors.count_documents({})
    if existing > 0:
        return {'seeded': False, 'doctors': existing}

    doctors_data = [
        {
            "name": "Marco Bianchi", "title": "Dott.",
            "specialties": ["cardiologia"],
            "bio": "Cardiologo con oltre 18 anni di esperienza in ecocardiografia e prevenzione cardiovascolare. Specializzato presso l'Università di Roma La Sapienza.",
            "photo": "https://images.unsplash.com/photo-1612943705904-e2e101abcd19?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.9, "reviews_count": 142, "price_from": 120, "experience_years": 18,
            "languages": ["Italiano", "Inglese"],
            "owner_email": "marco.bianchi@vicinomed.it",
            "studios": [
                {"name": "Studio Cardiologico Trastevere", "address": "Via della Lungaretta 45", "city": "Roma", "postal_code": "00153", "lat": 41.8895, "lng": 12.4695, "phone": "+39 06 5812345"},
                {"name": "Centro Medico EUR", "address": "Viale Europa 102", "city": "Roma", "postal_code": "00144", "lat": 41.8311, "lng": 12.4699, "phone": "+39 06 5912345"},
            ]
        },
        {
            "name": "Giulia Romano", "title": "Dott.ssa",
            "specialties": ["dermatologia"],
            "bio": "Dermatologa esperta in dermatologia estetica e oncologica. Membro SIDeMaST. Pratica privata e ospedaliera presso il Niguarda.",
            "photo": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.8, "reviews_count": 98, "price_from": 100, "experience_years": 12,
            "languages": ["Italiano", "Inglese", "Francese"],
            "owner_email": "giulia.romano@vicinomed.it",
            "studios": [
                {"name": "Dermo Clinic Brera", "address": "Via Solferino 18", "city": "Milano", "postal_code": "20121", "lat": 45.4737, "lng": 9.1881, "phone": "+39 02 8765432"},
            ]
        },
        {
            "name": "Alessandro Conti", "title": "Prof.",
            "specialties": ["ortopedia"],
            "bio": "Professore associato di Ortopedia e Traumatologia. Chirurgia mininvasiva del ginocchio e della spalla.",
            "photo": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.9, "reviews_count": 215, "price_from": 150, "experience_years": 25,
            "languages": ["Italiano", "Inglese"],
            "owner_email": "alessandro.conti@vicinomed.it",
            "studios": [
                {"name": "Centro Ortopedico Torino", "address": "Corso Vittorio Emanuele II 88", "city": "Torino", "postal_code": "10121", "lat": 45.0676, "lng": 7.6755, "phone": "+39 011 5512345"},
                {"name": "Studio Privato Crocetta", "address": "Via Sacchi 42", "city": "Torino", "postal_code": "10128", "lat": 45.0599, "lng": 7.6738, "phone": "+39 011 5612345"},
            ]
        },
        {
            "name": "Francesca De Luca", "title": "Dott.ssa",
            "specialties": ["ginecologia"],
            "bio": "Ginecologa e ostetrica. Esperta in ecografia ostetrica e gravidanza fisiologica. Approccio umano e attento.",
            "photo": "https://images.unsplash.com/photo-1594824476967-48c8b964273f?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 5.0, "reviews_count": 187, "price_from": 110, "experience_years": 15,
            "languages": ["Italiano"],
            "owner_email": "francesca.deluca@vicinomed.it",
            "studios": [
                {"name": "Studio Ginecologico Vomero", "address": "Via Scarlatti 60", "city": "Napoli", "postal_code": "80129", "lat": 40.8472, "lng": 14.2244, "phone": "+39 081 5512345"},
            ]
        },
        {
            "name": "Luca Ferrari", "title": "Dott.",
            "specialties": ["oculistica"],
            "bio": "Oculista specializzato in chirurgia refrattiva laser e cataratta. Tecnologie all'avanguardia.",
            "photo": "https://images.unsplash.com/photo-1582750433449-648ed127bb54?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.7, "reviews_count": 76, "price_from": 90, "experience_years": 10,
            "languages": ["Italiano", "Inglese"],
            "owner_email": "luca.ferrari@vicinomed.it",
            "studios": [
                {"name": "Centro Oculistico Bologna", "address": "Via Indipendenza 50", "city": "Bologna", "postal_code": "40121", "lat": 44.5024, "lng": 11.3438, "phone": "+39 051 5512345"},
            ]
        },
        {
            "name": "Sofia Esposito", "title": "Dott.ssa",
            "specialties": ["pediatria"],
            "bio": "Pediatra di libera scelta con esperienza in neonatologia. Visite domiciliari e ambulatoriali.",
            "photo": "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.9, "reviews_count": 234, "price_from": 80, "experience_years": 14,
            "languages": ["Italiano", "Spagnolo"],
            "owner_email": "sofia.esposito@vicinomed.it",
            "studios": [
                {"name": "Studio Pediatrico Prati", "address": "Via Cola di Rienzo 130", "city": "Roma", "postal_code": "00192", "lat": 41.9077, "lng": 12.4633, "phone": "+39 06 5712345"},
            ]
        },
        {
            "name": "Davide Moretti", "title": "Dott.",
            "specialties": ["psicologia"],
            "bio": "Psicologo clinico e psicoterapeuta cognitivo-comportamentale. Ansia, depressione, gestione dello stress.",
            "photo": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.8, "reviews_count": 64, "price_from": 70, "experience_years": 9,
            "languages": ["Italiano", "Inglese"],
            "owner_email": "davide.moretti@vicinomed.it",
            "studios": [
                {"name": "Studio Moretti Isola", "address": "Via Borsieri 22", "city": "Milano", "postal_code": "20159", "lat": 45.4858, "lng": 9.1893, "phone": "+39 02 6612345"},
            ]
        },
        {
            "name": "Elena Greco", "title": "Dott.ssa",
            "specialties": ["odontoiatria"],
            "bio": "Odontoiatra e implantologa. Estetica dentale, faccette in ceramica, ortodonzia invisibile.",
            "photo": "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.9, "reviews_count": 156, "price_from": 95, "experience_years": 13,
            "languages": ["Italiano", "Inglese"],
            "owner_email": "elena.greco@vicinomed.it",
            "studios": [
                {"name": "Greco Dental Clinic", "address": "Via Garibaldi 12", "city": "Firenze", "postal_code": "50123", "lat": 43.7762, "lng": 11.2480, "phone": "+39 055 5512345"},
            ]
        },
        {
            "name": "Roberto Russo", "title": "Dott.",
            "specialties": ["neurologia"],
            "bio": "Neurologo con esperienza in cefalee, epilessia e malattie neurodegenerative. Pratica nelle migliori cliniche di Milano.",
            "photo": "https://images.unsplash.com/photo-1576091160550-2173dba999ef?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.7, "reviews_count": 89, "price_from": 130, "experience_years": 20,
            "languages": ["Italiano", "Inglese", "Tedesco"],
            "owner_email": "roberto.russo@vicinomed.it",
            "studios": [
                {"name": "Centro Neurologico Porta Nuova", "address": "Via Galvani 8", "city": "Milano", "postal_code": "20124", "lat": 45.4843, "lng": 9.2014, "phone": "+39 02 7712345"},
            ]
        },
        {
            "name": "Valentina Marini", "title": "Dott.ssa",
            "specialties": ["endocrinologia"],
            "bio": "Endocrinologa e diabetologa. Nutrizione clinica, tiroide, sindrome metabolica.",
            "photo": "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.8, "reviews_count": 71, "price_from": 110, "experience_years": 11,
            "languages": ["Italiano", "Inglese"],
            "owner_email": "valentina.marini@vicinomed.it",
            "studios": [
                {"name": "Studio Endocrinologico Salerno", "address": "Via Roma 88", "city": "Salerno", "postal_code": "84121", "lat": 40.6803, "lng": 14.7594, "phone": "+39 089 5512345"},
            ]
        },
        {
            "name": "Matteo Lombardi", "title": "Dott.",
            "specialties": ["urologia"],
            "bio": "Urologo specializzato in andrologia e chirurgia mini-invasiva.",
            "photo": "https://images.unsplash.com/photo-1581056771107-24ca5f033842?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.6, "reviews_count": 53, "price_from": 120, "experience_years": 16,
            "languages": ["Italiano"],
            "owner_email": "matteo.lombardi@vicinomed.it",
            "studios": [
                {"name": "Centro Urologico Verona", "address": "Via Mazzini 30", "city": "Verona", "postal_code": "37121", "lat": 45.4408, "lng": 10.9925, "phone": "+39 045 5512345"},
            ]
        },
        {
            "name": "Chiara Ricci", "title": "Dott.ssa",
            "specialties": ["otorinolaringoiatria"],
            "bio": "Otorinolaringoiatra. Disturbi del sonno, allergologia respiratoria, vertigini.",
            "photo": "https://images.unsplash.com/photo-1584516150909-c43483ee7932?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
            "rating": 4.9, "reviews_count": 102, "price_from": 100, "experience_years": 14,
            "languages": ["Italiano", "Inglese"],
            "owner_email": "chiara.ricci@vicinomed.it",
            "studios": [
                {"name": "Studio ORL Padova", "address": "Via VIII Febbraio 5", "city": "Padova", "postal_code": "35122", "lat": 45.4071, "lng": 11.8761, "phone": "+39 049 5512345"},
            ]
        },
    ]

    docs_to_insert = []
    for d in doctors_data:
        d['doctor_id'] = f"doc_{uuid.uuid4().hex[:10]}"
        d['verified'] = True
        for s in d['studios']:
            s['studio_id'] = f"std_{uuid.uuid4().hex[:10]}"
        docs_to_insert.append(d)
    await db.doctors.insert_many(docs_to_insert)

    # Reviews
    sample_reviews = [
        ("Mario R.", 5, "Professionista eccezionale, molto competente e disponibile. Studio pulito e moderno."),
        ("Laura T.", 5, "Visita accurata e spiegazioni chiarissime. Consigliatissimo!"),
        ("Giuseppe B.", 4, "Ottimo medico, puntuale e professionale. Tornerò sicuramente."),
        ("Anna F.", 5, "Esperienza positiva sotto ogni aspetto. Personale gentile."),
        ("Marco V.", 5, "Diagnosi precisa e trattamento efficace. Mi sono trovato benissimo."),
        ("Sara P.", 4, "Buon rapporto qualità prezzo. Studio facilmente raggiungibile."),
        ("Luigi C.", 5, "Empatico e attento al paziente. Lo consiglio vivamente."),
        ("Federica M.", 5, "Visita approfondita, mi ha messo subito a proprio agio."),
    ]
    reviews_to_insert = []
    for d in docs_to_insert:
        n = min(d['reviews_count'], 6)
        for i in range(n):
            name, rating, comment = sample_reviews[i % len(sample_reviews)]
            reviews_to_insert.append({
                'review_id': f"rev_{uuid.uuid4().hex[:10]}",
                'doctor_id': d['doctor_id'],
                'patient_name': name,
                'rating': rating,
                'comment': comment,
                'created_at': datetime.now(timezone.utc) - timedelta(days=i * 7 + 3)
            })
    if reviews_to_insert:
        await db.reviews.insert_many(reviews_to_insert)

    return {'seeded': True, 'doctors': len(docs_to_insert), 'reviews': len(reviews_to_insert)}

@api_router.get("/")
async def root():
    return {"app": "VicinoMed API", "status": "ok"}

# ==========================
# Mount
# ==========================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Auto-seed if empty
    count = await db.doctors.count_documents({})
    if count == 0:
        try:
            await seed_data()
            logger.info("Auto-seeded doctors data")
        except Exception as e:
            logger.error(f"Seed failed: {e}")

    # Auto-create default admin user (idempotent)
    admin_email = os.environ.get('DEFAULT_ADMIN_EMAIL', 'admin@vicinomed.it')
    admin_password = os.environ.get('DEFAULT_ADMIN_PASSWORD', 'Admin2026!')
    existing_admin = await db.users.find_one({'email': admin_email})
    if not existing_admin:
        try:
            await db.users.insert_one({
                'user_id': f"user_{uuid.uuid4().hex[:12]}",
                'email': admin_email,
                'password_hash': hash_password(admin_password),
                'name': 'VicinoMed Admin',
                'picture': None,
                'role': 'admin',
                'phone': None,
                'auth_provider': 'email',
                'is_active': True,
                'verified': True,
                'created_at': datetime.now(timezone.utc),
            })
            logger.info(f"[Admin] Default admin created: {admin_email}")
        except Exception as e:
            logger.error(f"[Admin] Auto-seed admin failed: {e}")
    else:
        # Ensure existing admin has correct role/active flag (recover from manual changes)
        if existing_admin.get('role') != 'admin' or existing_admin.get('is_active') is False:
            await db.users.update_one(
                {'email': admin_email},
                {'$set': {'role': 'admin', 'is_active': True, 'verified': True}}
            )
            logger.info(f"[Admin] Restored admin role for {admin_email}")

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.doctors.create_index("doctor_id", unique=True)
    await db.bookings.create_index("booking_id", unique=True)
    await db.doctor_blocks.create_index([("doctor_id", 1), ("studio_id", 1), ("date", 1), ("time", 1)], unique=True)
    # Password reset tokens: unique hash + TTL auto-cleanup after 2h (covers post-expiry retention)
    await db.password_resets.create_index("token_hash", unique=True)
    await db.password_resets.create_index("expires_at", expireAfterSeconds=2 * 3600)
    await db.password_resets.create_index([("email", 1), ("created_at", -1)])
    # Room rental requests
    await db.room_requests.create_index("request_id", unique=True)
    await db.room_requests.create_index([("clinic_owner_email", 1), ("status", 1), ("created_at", -1)])
    await db.room_requests.create_index([("doctor_user_id", 1), ("created_at", -1)])
    # Helpful index for admin user listings
    await db.users.create_index([("role", 1), ("created_at", -1)])
    await db.users.create_index("is_active")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
