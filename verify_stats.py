#!/usr/bin/env python3
"""Quick verification of studio stats monthly income calculation"""
import requests
from datetime import datetime, timezone

BASE_URL = "https://vicino-main-deploy.preview.emergentagent.com/api"
STUDIO_EMAIL = "studio.demo3@vicinomed.it"
STUDIO_PASSWORD = "Demo2026!"

# Login
response = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": STUDIO_EMAIL, "password": STUDIO_PASSWORD}
)
token = response.json()["session_token"]

# Get stats
response = requests.get(
    f"{BASE_URL}/studio/stats",
    headers={"Authorization": f"Bearer {token}"}
)
stats = response.json()

print("\n📊 Studio Stats:")
print(f"   Rooms total: {stats['rooms_total']}")
print(f"   Rooms available today: {stats['rooms_available_today']}")
print(f"   Pending requests: {stats['requests_pending']}")
print(f"   Estimated income this month: €{stats['estimated_income_month']}")
print(f"   Accepted this month: {stats['accepted_this_month']}")
print(f"   Accepted total: {stats['accepted_total']}")

# Get all accepted requests to verify
response = requests.get(
    f"{BASE_URL}/studio/requests?status=accepted",
    headers={"Authorization": f"Bearer {token}"}
)
accepted = response.json()

print(f"\n✅ Total accepted requests: {len(accepted)}")
if accepted:
    print("\nAccepted requests details:")
    current_month = datetime.now(timezone.utc).month
    current_year = datetime.now(timezone.utc).year
    
    for req in accepted:
        start_iso = req['start_iso']
        price = req['estimated_price']
        # Parse the start_iso to check if it's in current month
        start_dt = datetime.fromisoformat(start_iso.replace('Z', '+00:00'))
        in_current_month = start_dt.month == current_month and start_dt.year == current_year
        
        print(f"   - {req['request_id']}: €{price}, start: {start_iso[:10]}, in_current_month: {in_current_month}")
    
    # Calculate expected income
    expected_income = sum(
        req['estimated_price'] 
        for req in accepted 
        if datetime.fromisoformat(req['start_iso'].replace('Z', '+00:00')).month == current_month
        and datetime.fromisoformat(req['start_iso'].replace('Z', '+00:00')).year == current_year
    )
    
    print(f"\n💰 Expected income this month: €{expected_income}")
    print(f"💰 Actual income from API: €{stats['estimated_income_month']}")
    
    if abs(expected_income - stats['estimated_income_month']) < 0.01:
        print("✅ Monthly income calculation is CORRECT!")
    else:
        print("❌ Monthly income calculation MISMATCH!")
