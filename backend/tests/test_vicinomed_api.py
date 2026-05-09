"""VicinoMed - end-to-end backend regression."""
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest


# ---------- Catalog ----------
class TestCatalog:
    def test_specialties_returns_12(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/specialties")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 12
        ids = {s['id'] for s in data}
        assert {'cardiologia', 'dermatologia', 'ortopedia'}.issubset(ids)

    def test_doctors_seeded(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/doctors")
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        assert len(docs) >= 12
        d = docs[0]
        for k in ['doctor_id', 'name', 'studios', 'photo', 'rating', 'reviews_count']:
            assert k in d
        assert isinstance(d['studios'], list) and len(d['studios']) >= 1

    def test_doctors_filter_by_specialty(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/doctors", params={'specialty': 'cardiologia'})
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 1
        assert all('cardiologia' in d['specialties'] for d in docs)

    def test_doctors_search_by_name(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/doctors", params={'q': 'Bianchi'})
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 1
        assert any('Bianchi' in d['name'] for d in docs)

    def test_doctor_detail_has_reviews(self, api_client, base_url):
        docs = api_client.get(f"{base_url}/api/doctors").json()
        did = docs[0]['doctor_id']
        r = api_client.get(f"{base_url}/api/doctors/{did}")
        assert r.status_code == 200
        d = r.json()
        assert d['doctor_id'] == did
        assert 'reviews' in d and isinstance(d['reviews'], list)

    def test_doctor_detail_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/doctors/doc_nonexistent_xxx")
        assert r.status_code == 404


class TestAvailability:
    def _next_weekday(self, target_weekday: int) -> str:
        d = datetime.now(timezone.utc).date() + timedelta(days=1)
        while d.weekday() != target_weekday:
            d += timedelta(days=1)
        return d.isoformat()

    def test_weekday_returns_slots(self, api_client, base_url):
        docs = api_client.get(f"{base_url}/api/doctors").json()
        doc = docs[0]
        studio_id = doc['studios'][0]['studio_id']
        date = self._next_weekday(2)  # Wednesday
        r = api_client.get(
            f"{base_url}/api/doctors/{doc['doctor_id']}/availability",
            params={'studio_id': studio_id, 'date': date}
        )
        assert r.status_code == 200
        data = r.json()
        assert data['date'] == date
        assert isinstance(data['slots'], list)
        assert len(data['slots']) > 0

    def test_sunday_empty(self, api_client, base_url):
        docs = api_client.get(f"{base_url}/api/doctors").json()
        doc = docs[0]
        studio_id = doc['studios'][0]['studio_id']
        date = self._next_weekday(6)  # Sunday
        r = api_client.get(
            f"{base_url}/api/doctors/{doc['doctor_id']}/availability",
            params={'studio_id': studio_id, 'date': date}
        )
        assert r.status_code == 200
        assert r.json()['slots'] == []


# ---------- Auth ----------
@pytest.fixture(scope='module')
def patient_creds():
    return {
        'email': f"TEST_patient_{uuid.uuid4().hex[:8]}@test.it",
        'password': 'Password123',
        'name': 'Test Patient',
        'role': 'patient'
    }


@pytest.fixture(scope='module')
def patient_token(api_client, base_url, patient_creds):
    r = api_client.post(f"{base_url}/api/auth/register", json=patient_creds)
    assert r.status_code == 200, f"Register failed: {r.text}"
    data = r.json()
    assert 'session_token' in data and 'user' in data
    assert data['user']['email'] == patient_creds['email'].lower()
    return data['session_token']


class TestAuth:
    def test_register_doctor(self, api_client, base_url):
        creds = {
            'email': f"TEST_doc_{uuid.uuid4().hex[:8]}@test.it",
            'password': 'Password123',
            'name': 'Test Doc',
            'role': 'doctor'
        }
        r = api_client.post(f"{base_url}/api/auth/register", json=creds)
        assert r.status_code == 200
        assert r.json()['user']['role'] == 'doctor'

    def test_register_duplicate_email(self, api_client, base_url, patient_creds, patient_token):
        r = api_client.post(f"{base_url}/api/auth/register", json=patient_creds)
        assert r.status_code == 400

    def test_login_success(self, api_client, base_url, patient_creds, patient_token):
        r = api_client.post(f"{base_url}/api/auth/login", json={
            'email': patient_creds['email'], 'password': patient_creds['password']
        })
        assert r.status_code == 200
        assert 'session_token' in r.json()

    def test_login_wrong_password(self, api_client, base_url, patient_creds, patient_token):
        r = api_client.post(f"{base_url}/api/auth/login", json={
            'email': patient_creds['email'], 'password': 'wrongpass'
        })
        assert r.status_code == 401

    def test_me_with_token(self, api_client, base_url, patient_token, patient_creds):
        r = api_client.get(f"{base_url}/api/auth/me",
                           headers={'Authorization': f'Bearer {patient_token}'})
        assert r.status_code == 200
        assert r.json()['email'] == patient_creds['email'].lower()

    def test_me_without_token(self, api_client, base_url):
        r = requests.Session().get(f"{base_url}/api/auth/me")
        assert r.status_code == 401


# ---------- Bookings ----------
@pytest.fixture(scope='module')
def doctor_login(api_client, base_url):
    """Ensure doctor account exists & return token."""
    creds = {'email': 'marco.bianchi@vicinomed.it', 'password': 'Password123'}
    r = api_client.post(f"{base_url}/api/auth/login", json=creds)
    if r.status_code != 200:
        # register
        api_client.post(f"{base_url}/api/auth/register", json={
            **creds, 'name': 'Marco Bianchi', 'role': 'doctor'
        })
        r = api_client.post(f"{base_url}/api/auth/login", json=creds)
    assert r.status_code == 200, f"Doctor login failed: {r.text}"
    return r.json()['session_token']


class TestBookings:
    def _next_weekday(self, target_weekday: int):
        d = datetime.now(timezone.utc).date() + timedelta(days=2)
        while d.weekday() != target_weekday:
            d += timedelta(days=1)
        return d

    def test_create_booking(self, api_client, base_url, patient_token):
        docs = api_client.get(f"{base_url}/api/doctors").json()
        doc = docs[0]
        studio_id = doc['studios'][0]['studio_id']
        target = self._next_weekday(2)
        r = api_client.get(
            f"{base_url}/api/doctors/{doc['doctor_id']}/availability",
            params={'studio_id': studio_id, 'date': target.isoformat()}
        )
        slots = r.json()['slots']
        assert slots, "No slots available"
        slot = slots[0]
        hh, mm = slot.split(':')
        dt_iso = datetime(target.year, target.month, target.day, int(hh), int(mm),
                          tzinfo=timezone.utc).isoformat()
        payload = {'doctor_id': doc['doctor_id'], 'studio_id': studio_id,
                   'datetime_iso': dt_iso, 'reason': 'TEST visita'}
        r = api_client.post(f"{base_url}/api/bookings", json=payload,
                            headers={'Authorization': f'Bearer {patient_token}'})
        assert r.status_code == 200, f"Booking failed: {r.text}"
        b = r.json()
        assert b['status'] == 'confermato'
        assert b['doctor_id'] == doc['doctor_id']
        # Save for later tests
        pytest._test_booking = b
        pytest._test_dt = dt_iso
        pytest._test_doc = doc['doctor_id']
        pytest._test_studio = studio_id

    def test_double_booking_conflict(self, api_client, base_url, patient_token):
        b = getattr(pytest, '_test_booking', None)
        assert b, "previous booking missing"
        payload = {'doctor_id': pytest._test_doc, 'studio_id': pytest._test_studio,
                   'datetime_iso': pytest._test_dt, 'reason': 'dup'}
        r = api_client.post(f"{base_url}/api/bookings", json=payload,
                            headers={'Authorization': f'Bearer {patient_token}'})
        assert r.status_code == 409

    def test_my_bookings(self, api_client, base_url, patient_token):
        r = api_client.get(f"{base_url}/api/bookings/me",
                           headers={'Authorization': f'Bearer {patient_token}'})
        assert r.status_code == 200
        items = r.json()
        assert any(it['booking_id'] == pytest._test_booking['booking_id'] for it in items)

    def test_cancel_booking(self, api_client, base_url, patient_token):
        bid = pytest._test_booking['booking_id']
        r = api_client.patch(f"{base_url}/api/bookings/{bid}/cancel",
                             headers={'Authorization': f'Bearer {patient_token}'})
        assert r.status_code == 200
        # verify
        items = api_client.get(f"{base_url}/api/bookings/me",
                               headers={'Authorization': f'Bearer {patient_token}'}).json()
        target = next(i for i in items if i['booking_id'] == bid)
        assert target['status'] == 'cancellato'

    def test_doctor_bookings_endpoint(self, api_client, base_url, doctor_login):
        r = api_client.get(f"{base_url}/api/doctor/bookings",
                           headers={'Authorization': f'Bearer {doctor_login}'})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


import requests  # noqa: E402
