# 🩺 VicinoMed

> **La visita specialistica più vicina a te, con il medico giusto.**

VicinoMed è una piattaforma premium italiana per la prenotazione di visite specialistiche private. I pazienti trovano lo specialista più vicino con disponibilità reale, vedono esattamente quale medico incontreranno e prenotano in **3 tap**. I medici gestiscono i propri studi, la disponibilità e i pazienti dalla propria dashboard.

🌍 **Multi-piattaforma**: iOS · Android · Web (PWA-ready) · Tablet · Desktop  
🇮🇹 **Lingua**: 100% italiano · GDPR-compliant  
🎨 **Design**: blu medico (#0A3D62) + verde salute (#00C48C) · Light & Dark mode

---

## 📑 Indice

1. [Stack Tecnologico](#-stack-tecnologico)
2. [Struttura del Progetto](#-struttura-del-progetto)
3. [Prerequisiti](#-prerequisiti)
4. [Setup Locale Completo](#-setup-locale-completo)
5. [Variabili d'Ambiente](#-variabili-dambiente)
6. [Avvio del Progetto](#-avvio-del-progetto)
7. [Database & Seed Data](#-database--seed-data)
8. [API Reference](#-api-reference)
9. [Aggiungere Nuovi Medici](#-aggiungere-nuovi-medici)
10. [Aggiornamenti & Manutenzione](#-aggiornamenti--manutenzione)
11. [Troubleshooting](#-troubleshooting)
12. [Roadmap](#-roadmap)

---

## 🛠 Stack Tecnologico

| Layer | Tecnologia | Versione |
|---|---|---|
| **Frontend** | Expo (React Native) + Expo Router | SDK 54 |
| **Web** | react-native-web | 0.21 |
| **Backend** | FastAPI (Python) | 0.110 |
| **Database** | MongoDB (motor async driver) | 4+ |
| **Auth** | JWT (bcrypt) + Emergent Google OAuth | — |
| **Mappe** | Leaflet + OpenStreetMap (CARTO tiles) | 1.9 |
| **WhatsApp** | Deep linking (wa.me) | — |
| **HTTP** | axios + AsyncStorage | — |

---

## 📁 Struttura del Progetto

```
vicinomed/
├── backend/
│   ├── server.py              # FastAPI app + tutti gli endpoint
│   ├── requirements.txt       # Dipendenze Python
│   ├── tests/
│   │   └── test_vicinomed_api.py  # Test pytest (19 casi)
│   └── .env                   # MONGO_URL, DB_NAME, JWT_SECRET
│
├── frontend/
│   ├── app/                   # Expo Router (file-based routing)
│   │   ├── _layout.tsx        # Root: AuthProvider + theme
│   │   ├── index.tsx          # Splash + redirect intelligente
│   │   ├── onboarding.tsx     # 3 slide di benvenuto
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── (tabs)/            # Bottom tabs (paziente)
│   │   │   ├── _layout.tsx
│   │   │   ├── home.tsx       # "Vicino a te" + medici consigliati
│   │   │   ├── search.tsx     # Lista + Mappa Leaflet
│   │   │   ├── appointments.tsx
│   │   │   └── profile.tsx
│   │   ├── doctor/[id].tsx    # Profilo medico + prenotazione
│   │   ├── booking/[id].tsx   # Conferma + WhatsApp deep link
│   │   └── doctor-dashboard.tsx
│   │
│   ├── src/
│   │   ├── theme.ts           # Palette colori (light/dark)
│   │   ├── useTheme.ts
│   │   ├── api.ts             # axios + token storage
│   │   ├── AuthContext.tsx    # Provider auth (JWT + Google)
│   │   ├── utils.ts           # Date IT, WhatsApp link, Maps link
│   │   ├── specialties.ts     # Mappa specializzazione → icona
│   │   └── components/
│   │       ├── Logo.tsx
│   │       └── MapWebView.tsx # Wrapper iframe (web) + WebView (native)
│   │
│   ├── package.json
│   ├── app.json               # Configurazione Expo + permessi
│   ├── tsconfig.json
│   └── .env                   # EXPO_PUBLIC_BACKEND_URL
│
├── auth_testing.md            # Playbook auth (dev reference)
├── README.md                  # Questo file
└── memory/
    ├── PRD.md                 # Product Requirements
    └── test_credentials.md    # Credenziali test
```

---

## 📋 Prerequisiti

Prima di iniziare assicurati di avere installato:

| Tool | Versione minima | Verifica |
|---|---|---|
| **Node.js** | ≥ 20.x LTS | `node -v` |
| **Yarn** | ≥ 1.22 | `yarn -v` |
| **Python** | ≥ 3.11 | `python3 --version` |
| **MongoDB** | ≥ 6.0 | `mongod --version` |
| **Git** | ≥ 2.30 | `git --version` |

**Per build mobile native** (opzionale per sviluppo locale):
- iOS: macOS + Xcode 15+
- Android: Android Studio + SDK 34+
- Oppure usa **Expo Go** sul telefono (scarica da App Store / Play Store)

---

## 🚀 Setup Locale Completo

### 1. Clona il repository
```bash
git clone https://github.com/<tuo-username>/vicinomed.git
cd vicinomed
```

### 2. Avvia MongoDB
```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Docker (cross-platform)
docker run -d --name vicinomed-mongo -p 27017:27017 mongo:7
```

### 3. Setup Backend
```bash
cd backend

# Crea virtual environment
python3 -m venv venv
source venv/bin/activate          # macOS/Linux
# venv\Scripts\activate           # Windows

# Installa dipendenze
pip install -r requirements.txt

# Crea .env (copia il template sotto)
cat > .env << 'EOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="vicinomed"
JWT_SECRET="cambia-questa-stringa-in-produzione-min-32-char"
EOF
```

### 4. Setup Frontend
```bash
cd ../frontend

# Installa dipendenze
yarn install

# Crea .env
cat > .env << 'EOF'
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EOF
```

> 📱 Per testare su un **dispositivo fisico**, sostituisci `localhost` con l'IP della tua macchina (es. `http://192.168.1.20:8001`).

---

## 🔐 Variabili d'Ambiente

### `backend/.env`
| Variabile | Descrizione | Esempio |
|---|---|---|
| `MONGO_URL` | Connection string MongoDB | `mongodb://localhost:27017` |
| `DB_NAME` | Nome del database | `vicinomed` |
| `JWT_SECRET` | Chiave firma JWT (≥ 32 char in prod) | `<random-32-char-string>` |

### `frontend/.env`
| Variabile | Descrizione | Esempio |
|---|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | URL del backend FastAPI | `http://localhost:8001` |

> ⚠️ Le variabili che iniziano con `EXPO_PUBLIC_` sono **incluse nel bundle** ed esposte client-side. Non metterci segreti.

---

## ▶️ Avvio del Progetto

### Backend (terminale 1)
```bash
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
✅ Backend attivo su `http://localhost:8001`  
📄 OpenAPI docs: `http://localhost:8001/docs`

### Frontend (terminale 2)
```bash
cd frontend
yarn start              # Dev server con QR code per Expo Go
# oppure:
yarn web                # Solo web a http://localhost:8081
yarn ios                # Simulatore iOS (richiede macOS + Xcode)
yarn android            # Emulatore Android (richiede Android Studio)
```

### Test
```bash
# Backend
cd backend
pytest tests/ -v

# Lint frontend
cd frontend
yarn lint
```

---

## 💾 Database & Seed Data

Al primo avvio del backend, se la collection `doctors` è vuota, viene **auto-popolata** con 12 medici italiani realistici distribuiti su 9 città (Roma, Milano, Torino, Napoli, Firenze, Bologna, Verona, Padova, Salerno).

### Forzare un re-seed manuale
```bash
# Pulisci e ri-seedare
mongosh vicinomed --eval "db.doctors.deleteMany({}); db.reviews.deleteMany({});"
curl -X POST http://localhost:8001/api/seed
```

### Schema collections

**`users`** — utenti (pazienti + medici)
```js
{
  user_id: "user_<12hex>",
  email: "marco.bianchi@vicinomed.it",
  password_hash: "<bcrypt>",   // null se Google auth
  name: "Marco Bianchi",
  role: "patient" | "doctor",
  phone: "+39...",
  auth_provider: "email" | "google",
  picture: "<url>",
  created_at: ISODate
}
```

**`user_sessions`** — sessioni Emergent Google Auth
```js
{
  user_id: "user_<id>",
  session_token: "<token>",
  expires_at: ISODate,
  created_at: ISODate
}
```

**`doctors`** — profili medici
```js
{
  doctor_id: "doc_<10hex>",
  name: "Marco Bianchi",
  title: "Dott." | "Dott.ssa" | "Prof.",
  specialties: ["cardiologia"],
  bio: "...",
  photo: "<url>",
  rating: 4.9,
  reviews_count: 142,
  verified: true,
  price_from: 120,           // EUR
  experience_years: 18,
  languages: ["Italiano", "Inglese"],
  owner_email: "marco.bianchi@vicinomed.it",  // per dashboard
  studios: [
    {
      studio_id: "std_<10hex>",
      name: "Studio Cardiologico Trastevere",
      address: "Via della Lungaretta 45",
      city: "Roma",
      postal_code: "00153",
      lat: 41.8895,
      lng: 12.4695,
      phone: "+39 06 5812345"
    }
  ]
}
```

**`reviews`** — recensioni
```js
{ review_id, doctor_id, patient_name, rating: 1-5, comment, created_at }
```

**`bookings`** — prenotazioni
```js
{
  booking_id, patient_id, patient_name, patient_phone,
  doctor_id, doctor_name, doctor_phone,
  studio_id, studio_name, studio_address, studio_lat, studio_lng,
  specialty,
  datetime_iso: "2026-05-15T10:30:00.000Z",
  status: "confermato" | "cancellato" | "completato",
  reason, created_at
}
```

---

## 🔌 API Reference

Base URL: `${EXPO_PUBLIC_BACKEND_URL}/api`

### Auth
| Method | Endpoint | Descrizione | Auth |
|---|---|---|---|
| POST | `/auth/register` | Registra utente (`role`: patient/doctor) | — |
| POST | `/auth/login` | Login email/password → JWT | — |
| POST | `/auth/google/session` | Scambia `session_id` Emergent → token | — |
| GET | `/auth/me` | Utente corrente | Bearer |
| POST | `/auth/logout` | Logout (invalida sessione) | Bearer |

### Catalogo
| Method | Endpoint | Descrizione |
|---|---|---|
| GET | `/specialties` | 12 specializzazioni (id + nome + icona) |
| GET | `/doctors?specialty=&q=&city=` | Lista filtrata medici |
| GET | `/doctors/{id}` | Profilo + recensioni |
| GET | `/doctors/{id}/availability?studio_id=&date=YYYY-MM-DD` | Slot disponibili |

### Prenotazioni
| Method | Endpoint | Descrizione | Auth |
|---|---|---|---|
| POST | `/bookings` | Crea prenotazione | Bearer |
| GET | `/bookings/me` | Mie prenotazioni | Bearer |
| PATCH | `/bookings/{id}/cancel` | Annulla | Bearer |
| GET | `/doctor/bookings` | Prenotazioni del medico (dashboard) | Bearer (role=doctor) |

### Esempio: prenotazione completa
```bash
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mario.rossi@test.it","password":"Password123"}' | jq -r .session_token)

curl -X POST http://localhost:8001/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": "doc_xxx",
    "studio_id": "std_yyy",
    "datetime_iso": "2026-05-20T10:30:00.000Z"
  }'
```

---

## 👨‍⚕️ Aggiungere Nuovi Medici

### Opzione 1: Via MongoDB (rapido)
```bash
mongosh vicinomed
```
```js
db.doctors.insertOne({
  doctor_id: "doc_" + Math.random().toString(36).substring(2,12),
  name: "Anna Bruno",
  title: "Dott.ssa",
  specialties: ["dermatologia"],
  bio: "Dermatologa con 10 anni di esperienza...",
  photo: "https://images.unsplash.com/...",
  rating: 4.8, reviews_count: 60,
  verified: true,
  price_from: 100,
  experience_years: 10,
  languages: ["Italiano", "Inglese"],
  owner_email: "anna.bruno@vicinomed.it",
  studios: [{
    studio_id: "std_" + Math.random().toString(36).substring(2,12),
    name: "Studio Dermatologico Brera",
    address: "Via Brera 12",
    city: "Milano",
    postal_code: "20121",
    lat: 45.4720, lng: 9.1859,
    phone: "+39 02 1234567"
  }]
});
```

### Opzione 2: Estendere il seed in `server.py`
Aggiungi un dict alla lista `doctors_data` nella funzione `seed_data()`. Il seed è **idempotente**: gira solo se la collection è vuota.

### Opzione 3: Endpoint admin (TODO Phase 2)
Implementare `POST /api/admin/doctors` con autorizzazione admin. Ti aiuto io quando vuoi.

---

## 🔄 Aggiornamenti & Manutenzione

### Aggiornare Expo SDK
Expo rilascia un nuovo SDK ogni ~3 mesi. Per aggiornare:
```bash
cd frontend
npx expo install --check          # Verifica pacchetti compatibili
npx expo install --fix            # Allinea versioni
# Per upgrade SDK major:
npx expo upgrade                  # Es. SDK 54 → 55
yarn install
yarn start --clear                # Pulisce la cache Metro
```
📖 Note di rilascio: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/

### Aggiornare React Native
React Native segue Expo SDK. Non aggiornarlo manualmente: lascia che `expo install --fix` lo allinei.

### Aggiornare dipendenze npm
```bash
cd frontend
yarn upgrade-interactive --latest # Solo per pacchetti non-Expo
```
⚠️ Non aggiornare `react`, `react-native`, `expo*`, `@react-navigation/*` manualmente.

### Aggiornare Python / FastAPI
```bash
cd backend
pip list --outdated
pip install --upgrade fastapi motor pydantic
pip freeze > requirements.txt
```

### Build native iOS/Android
Per pubblicare su App Store / Play Store usa **EAS Build** (Expo cloud):
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios          # Build iOS .ipa
eas build --platform android      # Build Android .aab/.apk
eas submit --platform ios         # Submit a App Store Connect
eas submit --platform android     # Submit a Google Play
```
📖 Documentazione: https://docs.expo.dev/build/introduction/

> 💡 In alternativa, su Emergent puoi usare il pulsante **Publish** in alto a destra per build/deploy guidati senza configurare EAS.

### Backup MongoDB
```bash
# Backup
mongodump --db vicinomed --out ./backup-$(date +%Y%m%d)
# Restore
mongorestore --db vicinomed ./backup-20260509/vicinomed
```

---

## 🩹 Troubleshooting

### Backend non parte: `MONGO_URL not set`
```bash
cd backend
ls -la .env       # Verifica esistenza
source venv/bin/activate
uvicorn server:app --reload
```

### Frontend: `Network request failed`
- Verifica che backend sia raggiungibile: `curl $EXPO_PUBLIC_BACKEND_URL/api/`
- Su dispositivo fisico, usa l'IP della macchina (non `localhost`)
- Su iOS Simulator, `localhost` funziona; su Android Emulator usa `10.0.2.2`

### `Module not found: react-native-webview`
```bash
cd frontend
yarn add react-native-webview
yarn start --clear
```

### Mappa non si vede su Android
- Assicurati che il dispositivo abbia connessione (le tile Leaflet sono caricate da CDN)
- Verifica che `react-native-webview` sia installato

### Login Google non funziona in locale
Il Google Auth Emergent richiede HTTPS. Per testare in locale:
- Usa **ngrok** o **Cloudflare Tunnel** per esporre il backend in HTTPS
- Oppure testa solo email/password in locale e lascia Google Auth per produzione

### Errore `bcrypt: Invalid salt`
Versione `bcrypt` incompatibile. Pin alla versione corretta:
```bash
pip install bcrypt==4.1.3
```

### Slot disponibilità non si aggiornano dopo prenotazione
La cache Metro può tenerlo. Pull-to-refresh sulla schermata, oppure:
```bash
yarn start --clear
```

### Reset completo del database
```bash
mongosh vicinomed --eval "db.dropDatabase()"
# Riavvia il backend → auto-seed parte
```

---

## 🗺 Roadmap

### ✅ Fatto (MVP v1.0)
- Onboarding · Auth (email + Google) · Home geo · Ricerca + Mappa · Profilo medico · Calendario disponibilità · Prenotazione 3-tap · Conferma con WhatsApp · Le mie visite · Dashboard medico · Dark mode · Italiano · Responsive

### 🔜 Phase 2 (suggerita)
- [ ] WhatsApp Business API (promemoria 24h/2h automatici)
- [ ] Stripe + commissione 10-15% per prenotazione
- [ ] Onboarding self-service medici (KYC + verifica Ordine)
- [ ] Sistema recensioni post-visita per pazienti
- [ ] Push notifications (Expo Notifications)
- [ ] PWA installabile + offline cache
- [ ] Adattamento UI per Smart TV (focus navigation)
- [ ] Pannello admin (verifica medici, moderazione recensioni)
- [ ] Multi-lingua (IT primario, EN secondario per turisti)

---

## 📜 Licenza

Tutti i diritti riservati © 2026 VicinoMed.

## 💌 Contatti

- 🌐 Web: https://vicino-med.preview.emergentagent.com
- 📧 Support: support@vicinomed.it (placeholder)

---

> Costruito con ❤️ in Italia su [Emergent](https://emergent.sh)
