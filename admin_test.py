#!/usr/bin/env python3
"""
VicinoMed Backend API Tests - Admin Panel Endpoints
Tests all admin endpoints for user management, stats, and analytics
"""
import requests
import json
from typing import Optional, Dict, Any

# API Configuration
BASE_URL = "https://vicino-main-deploy.preview.emergentagent.com/api"

# Test Credentials (from test_credentials.md)
ADMIN_EMAIL = "admin@vicinomed.it"
ADMIN_PASSWORD = "Admin2026!"

# For testing role enforcement, we'll use doctor credentials
DOCTOR_EMAIL = "medico.demo@vicinomed.it"
DOCTOR_PASSWORD = "MedicoDemo2026!"

# Global tokens
admin_token: Optional[str] = None
doctor_token: Optional[str] = None
test_user_id: Optional[str] = None

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
        body = response.json()
        print(f"   Body: {json.dumps(body, indent=2)[:800]}")
    except:
        print(f"   Body: {response.text[:500]}")

# ============================================
# Test 1: Admin Login
# ============================================
def test_admin_login():
    """Login as admin user"""
    global admin_token
    log_test("Admin Login - POST /api/auth/login")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    
    if response.status_code == 200:
        data = response.json()
        admin_token = data.get("session_token")
        user = data.get("user", {})
        log_success(f"Admin logged in successfully")
        log_info(f"User: {user.get('name')} ({user.get('email')})")
        log_info(f"Role: {user.get('role')}")
        log_info(f"Token: {admin_token[:20]}...")
        
        # Validate role
        assert user.get("role") == "admin", f"Expected role 'admin', got '{user.get('role')}'"
        log_success("Role validation passed")
        return True
    else:
        log_error(f"Admin login failed: {response.status_code}")
        log_response(response)
        return False

def test_doctor_login():
    """Login as doctor user (for role enforcement tests)"""
    global doctor_token
    log_test("Doctor Login - For role enforcement tests")
    
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
# Test 2: Admin Stats - GET /api/admin/stats
# ============================================
def test_admin_stats_success():
    """Admin gets platform stats"""
    log_test("GET /api/admin/stats - Success (200)")
    
    response = requests.get(
        f"{BASE_URL}/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success("Got admin stats successfully")
        
        # Validate structure - users
        assert 'users' in data, "Missing 'users' field"
        users = data['users']
        log_info(f"Users - Total: {users.get('total')}, Patient: {users.get('patient')}, Doctor: {users.get('doctor')}, Studio: {users.get('studio')}, Admin: {users.get('admin')}")
        
        assert 'total' in users, "Missing users.total"
        assert 'patient' in users, "Missing users.patient"
        assert 'doctor' in users, "Missing users.doctor"
        assert 'studio' in users, "Missing users.studio"
        assert 'admin' in users, "Missing users.admin"
        assert 'suspended' in users, "Missing users.suspended"
        assert 'verified_doctors' in users, "Missing users.verified_doctors"
        
        # Validate structure - bookings
        assert 'bookings' in data, "Missing 'bookings' field"
        bookings = data['bookings']
        log_info(f"Bookings - Today: {bookings.get('today')}, Month: {bookings.get('month')}, Total: {bookings.get('total')}")
        
        assert 'today' in bookings, "Missing bookings.today"
        assert 'month' in bookings, "Missing bookings.month"
        assert 'total' in bookings, "Missing bookings.total"
        
        # Validate structure - room_requests
        assert 'room_requests' in data, "Missing 'room_requests' field"
        room_requests = data['room_requests']
        log_info(f"Room Requests - Pending: {room_requests.get('pending')}, Total: {room_requests.get('total')}")
        log_info(f"Revenue - Accepted Volume (month): €{room_requests.get('accepted_volume_month')}, Platform Revenue: €{room_requests.get('platform_revenue_month')}")
        
        assert 'pending' in room_requests, "Missing room_requests.pending"
        assert 'total' in room_requests, "Missing room_requests.total"
        assert 'accepted_volume_month' in room_requests, "Missing room_requests.accepted_volume_month"
        assert 'platform_revenue_month' in room_requests, "Missing room_requests.platform_revenue_month"
        
        # Other fields
        assert 'doctors_profiles' in data, "Missing doctors_profiles"
        assert 'clinics' in data, "Missing clinics"
        assert 'reviews_total' in data, "Missing reviews_total"
        assert 'generated_at' in data, "Missing generated_at"
        
        log_info(f"Doctors Profiles: {data.get('doctors_profiles')}, Clinics: {data.get('clinics')}, Reviews: {data.get('reviews_total')}")
        
        log_success("All required fields present and valid")
        return True
    else:
        log_error(f"Failed to get admin stats: {response.status_code}")
        log_response(response)
        return False

def test_admin_stats_non_admin():
    """Non-admin user tries to access stats (should fail with 403)"""
    log_test("GET /api/admin/stats - Non-admin user (403)")
    
    response = requests.get(
        f"{BASE_URL}/admin/stats",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected non-admin with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 3: Admin Users List - GET /api/admin/users
# ============================================
def test_admin_users_list_all():
    """Admin lists all users (no filters)"""
    global test_user_id
    log_test("GET /api/admin/users - List all users")
    
    response = requests.get(
        f"{BASE_URL}/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Got users list successfully")
        log_info(f"Total: {data.get('total')}, Items: {len(data.get('items', []))}")
        
        # Validate structure
        assert 'total' in data, "Missing 'total' field"
        assert 'items' in data, "Missing 'items' field"
        assert 'skip' in data, "Missing 'skip' field"
        assert 'limit' in data, "Missing 'limit' field"
        
        items = data.get('items', [])
        if items:
            first_user = items[0]
            test_user_id = first_user.get('user_id')
            log_info(f"First user: {first_user.get('name')} ({first_user.get('email')}) - Role: {first_user.get('role')}")
            
            # Validate user structure
            assert 'user_id' in first_user, "Missing user_id"
            assert 'email' in first_user, "Missing email"
            assert 'name' in first_user, "Missing name"
            assert 'role' in first_user, "Missing role"
            assert 'is_active' in first_user, "Missing is_active"
            assert 'verified' in first_user, "Missing verified"
            
            # Ensure sensitive fields are not exposed
            assert 'password_hash' not in first_user, "password_hash should not be exposed"
            assert '_id' not in first_user, "_id should not be exposed"
            
            log_success("User structure validation passed")
        
        return True
    else:
        log_error(f"Failed to list users: {response.status_code}")
        log_response(response)
        return False

def test_admin_users_list_filter_role():
    """Admin lists users filtered by role"""
    log_test("GET /api/admin/users?role=patient - Filter by role")
    
    response = requests.get(
        f"{BASE_URL}/admin/users?role=patient",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Got filtered users list")
        log_info(f"Total patients: {data.get('total')}")
        
        # Validate all users have role=patient
        items = data.get('items', [])
        for user in items:
            assert user.get('role') == 'patient', f"Expected role 'patient', got '{user.get('role')}'"
        
        log_success("All users have role=patient")
        return True
    else:
        log_error(f"Failed to list filtered users: {response.status_code}")
        log_response(response)
        return False

def test_admin_users_list_search():
    """Admin searches users by query"""
    log_test("GET /api/admin/users?q=admin - Search by query")
    
    response = requests.get(
        f"{BASE_URL}/admin/users?q=admin",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Got search results")
        log_info(f"Total matches: {data.get('total')}")
        
        items = data.get('items', [])
        if items:
            log_info(f"First match: {items[0].get('name')} ({items[0].get('email')})")
        
        return True
    else:
        log_error(f"Failed to search users: {response.status_code}")
        log_response(response)
        return False

def test_admin_users_list_filter_active():
    """Admin lists users filtered by is_active"""
    log_test("GET /api/admin/users?is_active=true - Filter by is_active")
    
    response = requests.get(
        f"{BASE_URL}/admin/users?is_active=true",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Got filtered users list")
        log_info(f"Total active users: {data.get('total')}")
        
        # Validate all users have is_active=true
        items = data.get('items', [])
        for user in items:
            assert user.get('is_active') == True, f"Expected is_active=True, got {user.get('is_active')}"
        
        log_success("All users have is_active=True")
        return True
    else:
        log_error(f"Failed to list filtered users: {response.status_code}")
        log_response(response)
        return False

def test_admin_users_list_non_admin():
    """Non-admin user tries to list users (should fail with 403)"""
    log_test("GET /api/admin/users - Non-admin user (403)")
    
    response = requests.get(
        f"{BASE_URL}/admin/users",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected non-admin with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 4: Admin Verify User - PATCH /api/admin/users/{user_id}/verify
# ============================================
def test_admin_verify_user():
    """Admin toggles user verification status"""
    log_test("PATCH /api/admin/users/{user_id}/verify - Toggle verification")
    
    # First, find a non-admin user to verify
    response = requests.get(
        f"{BASE_URL}/admin/users?role=doctor",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code != 200 or not response.json().get('items'):
        log_error("No doctor users found to test verification")
        return False
    
    user_id = response.json()['items'][0]['user_id']
    original_verified = response.json()['items'][0].get('verified', False)
    
    log_info(f"Testing with user_id: {user_id}, current verified: {original_verified}")
    
    # Toggle verification
    response = requests.patch(
        f"{BASE_URL}/admin/users/{user_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        new_verified = data.get('verified')
        log_success(f"Verification toggled: {original_verified} → {new_verified}")
        
        # Validate toggle
        assert new_verified != original_verified, "Verification status should have toggled"
        assert data.get('user_id') == user_id, "user_id mismatch"
        
        # Toggle back to original state
        response2 = requests.patch(
            f"{BASE_URL}/admin/users/{user_id}/verify",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response2.status_code == 200:
            restored_verified = response2.json().get('verified')
            log_info(f"Restored to original state: {restored_verified}")
            assert restored_verified == original_verified, "Should restore to original state"
            log_success("Toggle and restore successful")
        
        return True
    else:
        log_error(f"Failed to verify user: {response.status_code}")
        log_response(response)
        return False

def test_admin_verify_user_non_admin():
    """Non-admin user tries to verify a user (should fail with 403)"""
    log_test("PATCH /api/admin/users/{user_id}/verify - Non-admin user (403)")
    
    # Get any user_id
    response = requests.get(
        f"{BASE_URL}/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code != 200 or not response.json().get('items'):
        log_error("No users found")
        return False
    
    user_id = response.json()['items'][0]['user_id']
    
    # Try to verify as doctor
    response = requests.patch(
        f"{BASE_URL}/admin/users/{user_id}/verify",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected non-admin with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 5: Admin Clinics - GET /api/admin/clinics
# ============================================
def test_admin_clinics_list():
    """Admin lists all clinics"""
    log_test("GET /api/admin/clinics - List all clinics")
    
    response = requests.get(
        f"{BASE_URL}/admin/clinics",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success(f"Got clinics list successfully")
        log_info(f"Total clinics: {len(data)}")
        
        if data:
            first_clinic = data[0]
            log_info(f"First clinic: {first_clinic.get('name')} - {first_clinic.get('city')}")
            
            # Validate clinic structure
            assert 'clinic_id' in first_clinic, "Missing clinic_id"
            assert 'name' in first_clinic, "Missing name"
            assert 'city' in first_clinic, "Missing city"
            assert 'owner_email' in first_clinic, "Missing owner_email"
            
            # Check enriched fields
            assert 'rooms_actual' in first_clinic, "Missing rooms_actual"
            assert 'rooms_available' in first_clinic, "Missing rooms_available"
            assert 'requests_pending' in first_clinic, "Missing requests_pending"
            
            log_info(f"Rooms: {first_clinic.get('rooms_actual')} total, {first_clinic.get('rooms_available')} available")
            log_info(f"Pending requests: {first_clinic.get('requests_pending')}")
            
            log_success("Clinic structure validation passed")
        
        return True
    else:
        log_error(f"Failed to list clinics: {response.status_code}")
        log_response(response)
        return False

def test_admin_clinics_list_non_admin():
    """Non-admin user tries to list clinics (should fail with 403)"""
    log_test("GET /api/admin/clinics - Non-admin user (403)")
    
    response = requests.get(
        f"{BASE_URL}/admin/clinics",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected non-admin with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Test 6: Admin Analytics - GET /api/admin/analytics
# ============================================
def test_admin_analytics():
    """Admin gets platform analytics"""
    log_test("GET /api/admin/analytics - Platform analytics")
    
    response = requests.get(
        f"{BASE_URL}/admin/analytics",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        log_success("Got analytics successfully")
        
        # Validate structure
        assert 'top_cities' in data, "Missing 'top_cities' field"
        assert 'top_specialties' in data, "Missing 'top_specialties' field"
        assert 'requests_by_status_30d' in data, "Missing 'requests_by_status_30d' field"
        
        top_cities = data.get('top_cities', [])
        log_info(f"Top cities: {len(top_cities)} entries")
        if top_cities:
            log_info(f"  #1: {top_cities[0].get('city')} - {top_cities[0].get('clinics')} clinics, {top_cities[0].get('rooms')} rooms")
        
        top_specialties = data.get('top_specialties', [])
        log_info(f"Top specialties: {len(top_specialties)} entries")
        if top_specialties:
            log_info(f"  #1: {top_specialties[0].get('specialty')} - {top_specialties[0].get('doctors')} doctors")
        
        requests_by_status = data.get('requests_by_status_30d', {})
        log_info(f"Requests by status (30d): {requests_by_status}")
        
        log_success("All analytics fields present and valid")
        return True
    else:
        log_error(f"Failed to get analytics: {response.status_code}")
        log_response(response)
        return False

def test_admin_analytics_non_admin():
    """Non-admin user tries to access analytics (should fail with 403)"""
    log_test("GET /api/admin/analytics - Non-admin user (403)")
    
    response = requests.get(
        f"{BASE_URL}/admin/analytics",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    
    if response.status_code == 403:
        log_success("Correctly rejected non-admin with 403")
        return True
    else:
        log_error(f"Expected 403, got {response.status_code}")
        log_response(response)
        return False

# ============================================
# Main Test Runner
# ============================================
def main():
    print(f"\n{Colors.BOLD}{'='*70}")
    print(f"VicinoMed Backend API Tests - Admin Panel Endpoints")
    print(f"{'='*70}{Colors.RESET}\n")
    
    results = []
    
    # Authentication
    results.append(("Admin Login", test_admin_login()))
    results.append(("Doctor Login (for role tests)", test_doctor_login()))
    
    if not admin_token or not doctor_token:
        log_error("Authentication failed. Cannot proceed with tests.")
        return
    
    # Test 2: Admin Stats
    results.append(("Admin Stats - Success", test_admin_stats_success()))
    results.append(("Admin Stats - Non-admin (403)", test_admin_stats_non_admin()))
    
    # Test 3: Admin Users List
    results.append(("Admin Users List - All", test_admin_users_list_all()))
    results.append(("Admin Users List - Filter by role", test_admin_users_list_filter_role()))
    results.append(("Admin Users List - Search query", test_admin_users_list_search()))
    results.append(("Admin Users List - Filter by is_active", test_admin_users_list_filter_active()))
    results.append(("Admin Users List - Non-admin (403)", test_admin_users_list_non_admin()))
    
    # Test 4: Admin Verify User
    results.append(("Admin Verify User - Toggle", test_admin_verify_user()))
    results.append(("Admin Verify User - Non-admin (403)", test_admin_verify_user_non_admin()))
    
    # Test 5: Admin Clinics
    results.append(("Admin Clinics List", test_admin_clinics_list()))
    results.append(("Admin Clinics List - Non-admin (403)", test_admin_clinics_list_non_admin()))
    
    # Test 6: Admin Analytics
    results.append(("Admin Analytics", test_admin_analytics()))
    results.append(("Admin Analytics - Non-admin (403)", test_admin_analytics_non_admin()))
    
    # Summary
    print(f"\n{Colors.BOLD}{'='*70}")
    print(f"TEST SUMMARY")
    print(f"{'='*70}{Colors.RESET}\n")
    
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
