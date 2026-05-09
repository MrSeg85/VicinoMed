# VicinoMed - Product Requirements Document (PRD)

## Overview
VicinoMed is a premium Italian private medical specialist booking network. Patients find the nearest available specialist visit, see exactly which doctor they'll meet, and book in 3 taps. Doctors manage their studios, availability, and patients.

**Tagline**: La visita specialistica più vicina a te, con il medico giusto.

## Tech Stack
- **Frontend**: React Native (Expo SDK 54) + Expo Router (mobile + web responsive)
- **Backend**: FastAPI + MongoDB (motor)
- **Auth**: JWT (email/pwd, bcrypt) + Emergent-managed Google OAuth
- **Maps**: Leaflet + OpenStreetMap (CARTO tiles, light/dark) via WebView/iframe
- **Language**: Italian throughout
- **Color palette**: Deep blue (#0A3D62) + Fresh green (#00C48C). Light + Dark mode.

## Implemented Features (MVP)

### Patient
- ✅ Splash + 3-slide onboarding (Vicino a te / Prenota in 3 tap / Specialisti verificati)
- ✅ Auth: Email/password registration + login + Google OAuth (Emergent)
- ✅ Home: greeting, geolocation city, hero CTA, 3 quick actions, 12 specialty pills, recommended doctors carousel, trust badge
- ✅ Search & Map: search bar, list/map toggle, specialty chips, Leaflet map with custom pins, doctor preview popup
- ✅ Doctor profile: hero photo + verified badge, bio, languages, multiple studios (radio select + maps link), 14-day availability scroll, dynamic time slots (deterministic + booking-aware), reviews list, sticky "Prenota Visita" CTA
- ✅ Booking flow: tap day → tap slot → tap "Prenota Visita" (3 taps)
- ✅ Booking confirmation: success screen, full details, WhatsApp deep link to confirm with doctor (pre-filled message with date/time/address/maps), Google Maps link
- ✅ My Appointments: upcoming + past tabs, status pills, WhatsApp/Maps/Cancel actions per booking
- ✅ Profile: avatar, role pill, settings, GDPR menu, logout
- ✅ Pull-to-refresh, dark mode, responsive layout (mobile + web), Italian copy

### Doctor
- ✅ Doctor role on registration
- ✅ Dashboard accessible from profile: today/upcoming/total stats, patient list, WhatsApp buttons to contact patients

### Backend API
- `POST /api/auth/register` (JWT)
- `POST /api/auth/login` (JWT)
- `POST /api/auth/google/session` (Emergent session_id exchange)
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/specialties` (12 Italian specialties)
- `GET /api/doctors` (filter: specialty, q, city)
- `GET /api/doctors/{id}` (with reviews)
- `GET /api/doctors/{id}/availability?studio_id&date`
- `POST /api/bookings` (creates booking)
- `GET /api/bookings/me` (patient bookings)
- `PATCH /api/bookings/{id}/cancel`
- `GET /api/doctor/bookings` (doctor dashboard)
- `POST /api/seed` (idempotent)

### Seed Data
12 realistic Italian doctors across cities (Roma, Milano, Torino, Napoli, Firenze, Bologna, Verona, Padova, Salerno) with proper studios (lat/lng), prices, reviews.

## Auth Files
- `/app/auth_testing.md` (auth playbook from integration agent)
- `/app/memory/test_credentials.md` (test accounts)

## Smart Business Enhancement (Revenue)
- Premium "verified" badge increases doctor trust → higher conversion
- WhatsApp deep links reduce no-show rate → higher fulfilled bookings
- Per-booking commission model: 10-15% of `price_from` could be charged to doctor when Stripe is added in Phase 2

## Phase 2 Backlog
- WhatsApp Business API for automated reminders (24h + 2h)
- Stripe payments + commission split
- Doctor onboarding self-service + studio CRUD
- Patient ratings/reviews creation
- PWA push notifications
- TV/large-screen adaptive layout (currently responsive)
