#!/usr/bin/env python3
"""
VicinoMed Backend API Tests - Room Rental Request System
Tests all endpoints for Phase 3: Room Rental Requests
"""
import requests
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

# API Configuration
BASE_URL = "https://vicino-main-deploy.preview.emergentagent.com/api"

# Test Credentials (from test_result.md)
STUDIO_EMAIL = "studio.demo3@vicinomed.it"
STUDIO_PASSWORD = "Demo2026!"
DOCTOR_EMAIL = "medico.demo@vicinomed.it"
DOCTOR_PASSWORD = "MedicoDemo2026!"

# Global tokens
studio_token: Optional[str] = None
doctor_token: Optional[str] = None
clinic_id: Optional[str] = None
room_id: Optional[str] = None
request_id: Optional[str] = None

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log_test(name: str):
    print(f"\n{Colors.BLUE}{Colors.BOLD}🧪 TEST: {name}{Colors.RESET}")

def log_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def log_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def log_info(msg: str):
    print(f"{Colors.YELLOW}ℹ️  {msg}{Colors.RESET}")

def log_response(response: requests.Response):
    print(f"   Status: {response.status_code}")
    try:
        print(f"   Body: {json.dumps(response.json(), indent=2)[:500]}")
    except:
        print(f"   Body: {response.text[:500]}")

# ============================================
# Authentication
# ============================================
def test_studio_login():
    """Login as studio user"""
    global studio_token, clinic_id
    log_test("Studio Login")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": STUDIO_EMAIL, "password": STUDIO_PASSWORD}
    )
    
    if response.status_code == 200:
        data = response.json()
        studio_token = data.get("session_token")
        log_success(f"Studio logged in successfully")
        log_info(f"Token: {studio_token[:20]}...")
        return True
    else:
        log_error(f"Studio login failed: {response.status_code}")
        log_response(response)
        return False

def test_doctor_login():
    """Login as doctor user"""
    global doctor_token
    log_test("Doctor Login")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": DOCTOR_EMAIL, "password": DOCTOR_PASSWORD}
    )
    
    if response.status_code == 200:
        data = response.json()
        doctor_token = data.get("session_token")
        log_success(f"Doctor logged in successfully")
        log_info(f"Token: {doctor_token[:20]}...")
        return True
    else:
        log_error(f"Doctor login failed: {response.status_code}")
        log_response(response)
        return False

# ============================================
# Setup: Get clinic and room IDs
# ============================================
def test_get_studio_profile():
    """Get studio profile to extract clinic_id"""
    global clinic_id, room_id
    log_test("Get Studio Profile (to extract clinic_id)")
    
    response = requests.get(
        f"{BASE_URL}/studio/me",
        headers={"Authorization": f"Bearer {studio_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        clinic_id = data.get("clinic_id")
        rooms = data.get("rooms", [])
        if rooms:
            room_id = rooms[0].get("room_id")
            log_success(f"Got clinic_id: {clinic_id}, room_id: {room_id}")
            log_info(f"Clinic: {data.get('name')}, Rooms: {len(rooms)}")
            return True
        else:
            log_error("No rooms found in clinic")
            return False
    else:
        log_error(f"Failed to get studio profile: {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 1: POST /api/clinics/{clinic_id}/rooms/{room_id}/request
# ============================================
def test_create_room_request_success():
    """Doctor creates a valid room request"""
    global request_id
    log_test("POST /api/clinics/{clinic_id}/rooms/{room_id}/request - Success")
    
    # Create a request for tomorrow at 9 AM
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
    start_iso = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0).isoformat()
    
    response = requests.post(
        f"{BASE_URL}/clinics/{clinic_id}/rooms/{room_id}/request",
        headers={"Authorization": f"Bearer {doctor_token}"},
        json={
            "rental_mode": "hourly",
            "start_iso": start_iso,
            "hours": 3,
            "message": "Buongiorno, vorrei affittare questa stanza per una visita specialistica."
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        request_id = data.get("request_id")
        log_success(f"Room request created: {request_id}")
        log_info(f"Status: {data.get('status')}, Price: €{data.get('estimated_price')}")
        
        # Validate response
        assert data.get("status") == "pending", "Status should be 'pending'"
        assert data.get("estimated_price") > 0, "Estimated price should be > 0"
        assert data.get("rental_mode") == "hourly", "Rental mode should be 'hourly'"
        assert data.get("hours") == 3, "Hours should be 3"
        log_success("All validations passed")
        return True
    else:
        log_error(f"Failed to create room request: {response.status_code}")
        log_response(response)
        return False

def test_create_room_request_non_doctor():
    """Studio user tries to create a request (should fail with 403)"""
    log_test("POST /api/clinics/{clinic_id}/rooms/{room_id}/request - Non-doctor (403)")
    
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
    start_iso = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0).isoformat()
    
    response = requests.post(
        f"{BASE_URL}/clinics/{clinic_id}/rooms/{room_id}/request",
        headers={"Authorization": f"Bearer {studio_token}"},
        json={
            "rental_mode": "hourly",
            "start_iso": start_iso,
            "hours": 2
        }
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected studio user with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

def test_create_room_request_past_date():
    """Doctor tries to create request with past date (should fail with 400)"""
    log_test("POST /api/clinics/{clinic_id}/rooms/{room_id}/request - Past date (400)")
    
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    start_iso = yesterday.isoformat()
    
    response = requests.post(
        f"{BASE_URL}/clinics/{clinic_id}/rooms/{room_id}/request",
        headers={"Authorization": f"Bearer {doctor_token}"},
        json={
            "rental_mode": "hourly",
            "start_iso": start_iso,
            "hours": 2
        }
    )
    
    if response.status_code == 400:
        log_success("Correctly rejected past date with 400")
        return True
    else:
        log_error(f"Expected 400, got {response.status_code}")
        log_response(response)
        return False

def test_create_room_request_missing_hours():
    """Doctor tries hourly request without hours (should fail with 400)"""
    log_test("POST /api/clinics/{clinic_id}/rooms/{room_id}/request - Missing hours (400)")
    
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
    start_iso = tomorrow.isoformat()
    
    response = requests.post(
        f"{BASE_URL}/clinics/{clinic_id}/rooms/{room_id}/request",
        headers={"Authorization": f"Bearer {doctor_token}"},
        json={
            "rental_mode": "hourly",
            "start_iso": start_iso
            # Missing 'hours' field
        }
    )
    
    if response.status_code == 400:
        log_success("Correctly rejected missing hours with 400")
        return True
    else:
        log_error(f"Expected 400, got {response.status_code}")
        log_response(response)
        return False

def test_create_room_request_invalid_clinic():
    """Doctor tries to request non-existent clinic (should fail with 404)"""
    log_test("POST /api/clinics/{clinic_id}/rooms/{room_id}/request - Invalid clinic (404)")
    
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
    start_iso = tomorrow.isoformat()
    
    response = requests.post(
        f"{BASE_URL}/clinics/cli_invalid123/rooms/{room_id}/request",
        headers={"Authorization": f"Bearer {doctor_token}"},
        json={
            "rental_mode": "hourly",
            "start_iso": start_iso,
            "hours": 2
        }
    )
    
    if response.status_code == 404:
        log_success("Correctly rejected invalid clinic with 404")
        return True
    else:
        log_error(f"Expected 404, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 2: GET /api/studio/requests
# ============================================
def test_studio_list_requests():
    """Studio lists all requests"""
    log_test("GET /api/studio/requests - List all")
    
    response = requests.get(
        f"{BASE_URL}/studio/requests",
        headers={"Authorization": f"Bearer {studio_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Got {len(data)} requests")
        if data:
            log_info(f"First request: {data[0].get('request_id')} - Status: {data[0].get('status')}")
        return True
    else:
        log_error(f"Failed to list requests: {response.status_code}")
        log_response(response)
        return False

def test_studio_list_requests_filtered():
    """Studio lists pending requests only"""
    log_test("GET /api/studio/requests?status=pending - Filter by status")
    
    response = requests.get(
        f"{BASE_URL}/studio/requests?status=pending",
        headers={"Authorization": f"Bearer {studio_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Got {len(data)} pending requests")
        
        # Validate all are pending
        for req in data:
            assert req.get("status") == "pending", f"Expected pending, got {req.get('status')}"
        log_success("All requests have status=pending")
        return True
    else:
        log_error(f"Failed to list pending requests: {response.status_code}")
        log_response(response)
        return False

def test_studio_list_requests_non_studio():
    """Doctor tries to list studio requests (should fail with 403)"""
    log_test("GET /api/studio/requests - Non-studio user (403)")
    
    response = requests.get(
        f"{BASE_URL}/studio/requests",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected doctor with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 3: GET /api/studio/stats
# ============================================
def test_studio_stats():
    """Studio gets dashboard stats"""
    log_test("GET /api/studio/stats - Dashboard stats")
    
    response = requests.get(
        f"{BASE_URL}/studio/stats",
        headers={"Authorization": f"Bearer {studio_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success("Got studio stats")
        log_info(f"Rooms total: {data.get('rooms_total')}")
        log_info(f"Rooms available today: {data.get('rooms_available_today')}")
        log_info(f"Pending requests: {data.get('requests_pending')}")
        log_info(f"Estimated income this month: €{data.get('estimated_income_month')}")
        log_info(f"Accepted this month: {data.get('accepted_this_month')}")
        log_info(f"Accepted total: {data.get('accepted_total')}")
        
        # Validate structure
        assert 'rooms_total' in data, "Missing rooms_total"
        assert 'rooms_available_today' in data, "Missing rooms_available_today"
        assert 'requests_pending' in data, "Missing requests_pending"
        assert 'estimated_income_month' in data, "Missing estimated_income_month"
        assert 'accepted_this_month' in data, "Missing accepted_this_month"
        assert 'accepted_total' in data, "Missing accepted_total"
        log_success("All required fields present")
        return True
    else:
        log_error(f"Failed to get stats: {response.status_code}")
        log_response(response)
        return False

def test_studio_stats_non_studio():
    """Doctor tries to get studio stats (should fail with 403)"""
    log_test("GET /api/studio/stats - Non-studio user (403)")
    
    response = requests.get(
        f"{BASE_URL}/studio/stats",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected doctor with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 4: PATCH /api/studio/requests/{id}/accept
# ============================================
def test_studio_accept_request():
    """Studio accepts a pending request"""
    log_test("PATCH /api/studio/requests/{id}/accept - Accept request")
    
    # First, get a pending request
    response = requests.get(
        f"{BASE_URL}/studio/requests?status=pending",
        headers={"Authorization": f"Bearer {studio_token}"}
    )
    
    if response.status_code != 200 or not response.json():
        log_error("No pending requests to accept")
        return False
    
    pending_request_id = response.json()[0].get("request_id")
    
    # Accept it
    response = requests.patch(
        f"{BASE_URL}/studio/requests/{pending_request_id}/accept",
        headers={"Authorization": f"Bearer {studio_token}"},
        json={"response_message": "Richiesta accettata! Ci vediamo presto."}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Request accepted: {pending_request_id}")
        log_info(f"Status: {data.get('status')}")
        
        # Validate
        assert data.get("status") == "accepted", "Status should be 'accepted'"
        assert data.get("responded_at") is not None, "responded_at should be set"
        log_success("All validations passed")
        return True
    else:
        log_error(f"Failed to accept request: {response.status_code}")
        log_response(response)
        return False

def test_studio_accept_request_non_studio():
    """Doctor tries to accept a request (should fail with 403)"""
    log_test("PATCH /api/studio/requests/{id}/accept - Non-studio user (403)")
    
    # Get any request ID
    response = requests.get(
        f"{BASE_URL}/studio/requests",
        headers={"Authorization": f"Bearer {studio_token}"}
    )
    
    if response.status_code != 200 or not response.json():
        log_error("No requests available")
        return False
    
    any_request_id = response.json()[0].get("request_id")
    
    # Try to accept as doctor
    response = requests.patch(
        f"{BASE_URL}/studio/requests/{any_request_id}/accept",
        headers={"Authorization": f"Bearer {doctor_token}"},
        json={}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected doctor with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

def test_studio_accept_already_accepted():
    """Studio tries to accept an already accepted request (should fail with 400)"""
    log_test("PATCH /api/studio/requests/{id}/accept - Already accepted (400)")
    
    # Get an accepted request
    response = requests.get(
        f"{BASE_URL}/studio/requests?status=accepted",
        headers={"Authorization": f"Bearer {studio_token}"}
    )
    
    if response.status_code != 200 or not response.json():
        log_info("No accepted requests to test with - SKIPPING")
        return True  # Skip this test
    
    accepted_request_id = response.json()[0].get("request_id")
    
    # Try to accept again
    response = requests.patch(
        f"{BASE_URL}/studio/requests/{accepted_request_id}/accept",
        headers={"Authorization": f"Bearer {studio_token}"},
        json={}
    )
    
    if response.status_code == 400:
        log_success("Correctly rejected re-accept with 400")
        return True
    else:
        log_error(f"Expected 400, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 5: PATCH /api/studio/requests/{id}/reject
# ============================================
def test_studio_reject_request():
    """Studio rejects a pending request"""
    log_test("PATCH /api/studio/requests/{id}/reject - Reject request")
    
    # First, create a new request to reject
    tomorrow = datetime.now(timezone.utc) + timedelta(days=2)
    start_iso = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0).isoformat()
    
    create_response = requests.post(
        f"{BASE_URL}/clinics/{clinic_id}/rooms/{room_id}/request",
        headers={"Authorization": f"Bearer {doctor_token}"},
        json={
            "rental_mode": "hourly",
            "start_iso": start_iso,
            "hours": 2,
            "message": "Test request for rejection"
        }
    )
    
    if create_response.status_code != 200:
        log_error("Failed to create test request for rejection")
        return False
    
    new_request_id = create_response.json().get("request_id")
    
    # Reject it
    response = requests.patch(
        f"{BASE_URL}/studio/requests/{new_request_id}/reject",
        headers={"Authorization": f"Bearer {studio_token}"},
        json={"response_message": "Spiacenti, la stanza non è disponibile in quella data."}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Request rejected: {new_request_id}")
        log_info(f"Status: {data.get('status')}")
        
        # Validate
        assert data.get("status") == "rejected", "Status should be 'rejected'"
        assert data.get("responded_at") is not None, "responded_at should be set"
        log_success("All validations passed")
        return True
    else:
        log_error(f"Failed to reject request: {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 6: GET /api/doctor/room-requests
# ============================================
def test_doctor_list_requests():
    """Doctor lists their own requests"""
    log_test("GET /api/doctor/room-requests - List own requests")
    
    response = requests.get(
        f"{BASE_URL}/doctor/room-requests",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Got {len(data)} requests")
        if data:
            log_info(f"First request: {data[0].get('request_id')} - Status: {data[0].get('status')}")
        return True
    else:
        log_error(f"Failed to list doctor requests: {response.status_code}")
        log_response(response)
        return False

def test_doctor_list_requests_filtered():
    """Doctor lists pending requests only"""
    log_test("GET /api/doctor/room-requests?status=pending - Filter by status")
    
    response = requests.get(
        f"{BASE_URL}/doctor/room-requests?status=pending",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Got {len(data)} pending requests")
        
        # Validate all are pending
        for req in data:
            assert req.get("status") == "pending", f"Expected pending, got {req.get('status')}"
        log_success("All requests have status=pending")
        return True
    else:
        log_error(f"Failed to list pending requests: {response.status_code}")
        log_response(response)
        return False

def test_doctor_list_requests_non_doctor():
    """Studio tries to list doctor requests (should fail with 403)"""
    log_test("GET /api/doctor/room-requests - Non-doctor user (403)")
    
    response = requests.get(
        f"{BASE_URL}/doctor/room-requests",
        headers={"Authorization": f"Bearer {studio_token}"}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected studio with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 7: PATCH /api/doctor/room-requests/{id}/cancel
# ============================================
def test_doctor_cancel_request():
    """Doctor cancels their own pending request"""
    log_test("PATCH /api/doctor/room-requests/{id}/cancel - Cancel request")
    
    # First, create a new request to cancel
    tomorrow = datetime.now(timezone.utc) + timedelta(days=3)
    start_iso = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0).isoformat()
    
    create_response = requests.post(
        f"{BASE_URL}/clinics/{clinic_id}/rooms/{room_id}/request",
        headers={"Authorization": f"Bearer {doctor_token}"},
        json={
            "rental_mode": "hourly",
            "start_iso": start_iso,
            "hours": 1,
            "message": "Test request for cancellation"
        }
    )
    
    if create_response.status_code != 200:
        log_error("Failed to create test request for cancellation")
        return False
    
    new_request_id = create_response.json().get("request_id")
    
    # Cancel it
    response = requests.patch(
        f"{BASE_URL}/doctor/room-requests/{new_request_id}/cancel",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Request cancelled: {new_request_id}")
        log_info(f"Status: {data.get('status')}")
        
        # Validate
        assert data.get("status") == "cancelled", "Status should be 'cancelled'"
        assert data.get("cancelled_at") is not None, "cancelled_at should be set"
        log_success("All validations passed")
        return True
    else:
        log_error(f"Failed to cancel request: {response.status_code}")
        log_response(response)
        return False

def test_doctor_cancel_request_non_doctor():
    """Studio tries to cancel a request (should fail with 403)"""
    log_test("PATCH /api/doctor/room-requests/{id}/cancel - Non-doctor user (403)")
    
    # Get any doctor request
    response = requests.get(
        f"{BASE_URL}/doctor/room-requests",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code != 200 or not response.json():
        log_error("No requests available")
        return False
    
    any_request_id = response.json()[0].get("request_id")
    
    # Try to cancel as studio
    response = requests.patch(
        f"{BASE_URL}/doctor/room-requests/{any_request_id}/cancel",
        headers={"Authorization": f"Bearer {studio_token}"}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected studio with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

def test_doctor_cancel_non_pending():
    """Doctor tries to cancel a non-pending request (should fail with 400)"""
    log_test("PATCH /api/doctor/room-requests/{id}/cancel - Non-pending (400)")
    
    # Get an accepted or rejected request
    response = requests.get(
        f"{BASE_URL}/doctor/room-requests?status=accepted",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code != 200 or not response.json():
        log_info("No accepted requests to test with - SKIPPING")
        return True  # Skip this test
    
    accepted_request_id = response.json()[0].get("request_id")
    
    # Try to cancel
    response = requests.patch(
        f"{BASE_URL}/doctor/room-requests/{accepted_request_id}/cancel",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 400:
        log_success("Correctly rejected cancel of non-pending with 400")
        return True
    else:
        log_error(f"Expected 400, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Main Test Runner
# ============================================
def main():
    print(f"\n{Colors.BOLD}{'='*60}")
    print(f"VicinoMed Backend API Tests - Room Rental Request System")
    print(f"{'='*60}{Colors.RESET}\n")
    
    results = []
    
    # Authentication
    results.append(("Studio Login", test_studio_login()))
    results.append(("Doctor Login", test_doctor_login()))
    
    if not studio_token or not doctor_token:
        log_error("Authentication failed. Cannot proceed with tests.")
        return
    
    # Setup
    results.append(("Get Studio Profile", test_get_studio_profile()))
    
    if not clinic_id or not room_id:
        log_error("Failed to get clinic/room IDs. Cannot proceed with tests.")
        return
    
    # Test 1: Create room request
    results.append(("Create Room Request - Success", test_create_room_request_success()))
    results.append(("Create Room Request - Non-doctor (403)", test_create_room_request_non_doctor()))
    results.append(("Create Room Request - Past date (400)", test_create_room_request_past_date()))
    results.append(("Create Room Request - Missing hours (400)", test_create_room_request_missing_hours()))
    results.append(("Create Room Request - Invalid clinic (404)", test_create_room_request_invalid_clinic()))
    
    # Test 2: Studio list requests
    results.append(("Studio List Requests - All", test_studio_list_requests()))
    results.append(("Studio List Requests - Filtered", test_studio_list_requests_filtered()))
    results.append(("Studio List Requests - Non-studio (403)", test_studio_list_requests_non_studio()))
    
    # Test 3: Studio stats
    results.append(("Studio Stats", test_studio_stats()))
    results.append(("Studio Stats - Non-studio (403)", test_studio_stats_non_studio()))
    
    # Test 4: Studio accept request
    results.append(("Studio Accept Request", test_studio_accept_request()))
    results.append(("Studio Accept Request - Non-studio (403)", test_studio_accept_request_non_studio()))
    results.append(("Studio Accept Request - Already accepted (400)", test_studio_accept_already_accepted()))
    
    # Test 5: Studio reject request
    results.append(("Studio Reject Request", test_studio_reject_request()))
    
    # Test 6: Doctor list requests
    results.append(("Doctor List Requests - All", test_doctor_list_requests()))
    results.append(("Doctor List Requests - Filtered", test_doctor_list_requests_filtered()))
    results.append(("Doctor List Requests - Non-doctor (403)", test_doctor_list_requests_non_doctor()))
    
    # Test 7: Doctor cancel request
    results.append(("Doctor Cancel Request", test_doctor_cancel_request()))
    results.append(("Doctor Cancel Request - Non-doctor (403)", test_doctor_cancel_request_non_doctor()))
    results.append(("Doctor Cancel Request - Non-pending (400)", test_doctor_cancel_non_pending()))
    
    # Summary
    print(f"\n{Colors.BOLD}{'='*60}")
    print(f"TEST SUMMARY")
    print(f"{'='*60}{Colors.RESET}\n")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = f"{Colors.GREEN}✅ PASS{Colors.RESET}" if result else f"{Colors.RED}❌ FAIL{Colors.RESET}"
        print(f"{status} - {name}")
    
    print(f"\n{Colors.BOLD}Total: {passed}/{total} tests passed{Colors.RESET}")
    
    if passed == total:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED!{Colors.RESET}\n")
    else:
        print(f"{Colors.RED}{Colors.BOLD}⚠️  SOME TESTS FAILED{Colors.RESET}\n")

if __name__ == "__main__":
    main()
