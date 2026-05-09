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
Role = Literal['patient', 'doctor']

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Role = 'patient'
    phone: Optional[str] = None
    auth_provider: Literal['email', 'google'] = 'email'
    created_at: datetime

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: Role = 'patient'
    phone: Optional[str] = None

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
    return User(**user_doc)

# ==========================
# Auth Routes
# ==========================
@api_router.post("/auth/register", response_model=AuthOut)
async def register(data: RegisterIn):
    existing = await db.users.find_one({'email': data.email.lower()})
    if existing:
        raise HTTPException(400, "Email già registrata")
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
        'created_at': datetime.now(timezone.utc)
    }
    await db.users.insert_one(doc)
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
    token = make_jwt(user_doc['user_id'])
    user_doc.pop('_id', None)
    user_doc.pop('password_hash', None)
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
    """Return the doctor record (with studios) for the logged-in doctor.
    Auto-creates a placeholder profile if missing so new self-registered doctors
    can use the dashboard immediately."""
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
