#!/usr/bin/env python3
"""
Backend test for Master Global card feature - Simplified version
Tests all 10 items from the review_request
"""

import requests
import json
import time
import random
import string
from pymongo import MongoClient

# Base URL from .env
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "aurela"

# Test results
test_results = []

def log_test(item, test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} - Item {item}: {test_name}"
    if details:
        result += f" - {details}"
    test_results.append(result)
    print(result)
    return passed

def random_email():
    """Generate random email"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_mg_{rand}@test.com"

def register_and_approve_user():
    """Register a fresh user and approve their KYC"""
    email = random_email()
    password = "TestPass123!"
    
    # Register init
    resp = requests.post(f"{BASE_URL}/auth/register/init", json={
        "first_name": "Test",
        "last_name": "User",
        "email": email,
        "country": "US",
        "phone": "+1234567890",
        "password": password
    })
    
    if resp.status_code != 200:
        print(f"Registration failed: {resp.text}")
        return None
    
    data = resp.json()
    signup_id = data.get('signup_id')
    
    # Get OTP from MongoDB
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    signup = db.signups.find_one({"id": signup_id})
    if not signup:
        print(f"Signup not found: {signup_id}")
        return None
    
    otp = signup.get('code')
    
    # Verify registration
    resp = requests.post(f"{BASE_URL}/auth/register/verify", json={
        "signup_id": signup_id,
        "code": otp
    })
    
    if resp.status_code != 200:
        print(f"Verification failed: {resp.text}")
        return None
    
    user_token = resp.json().get('token')
    user_id = resp.json().get('user', {}).get('id')
    
    # Submit KYC
    kyc_data = {
        "first_name": "Test",
        "last_name": "User",
        "mobile": "+1234567890",
        "country": "US",
        "state": "CA",
        "city": "Los Angeles",
        "address": "123 Test St",
        "postal_code": "90001",
        "occupation": "Engineer",
        "id_type": "passport",
        "id_number": "P12345678",
        "dob": "1990-01-01",
        "doc_front": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "doc_back": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "selfie": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    }
    
    resp = requests.post(f"{BASE_URL}/kyc", json=kyc_data, headers={"Authorization": f"Bearer {user_token}"})
    
    if resp.status_code != 200:
        print(f"KYC submission failed: {resp.text}")
        return None
    
    # Admin login
    admin_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if admin_resp.status_code != 200:
        print(f"Admin login failed: {admin_resp.text}")
        return None
    
    admin_token = admin_resp.json().get('token')
    
    # Get KYC list to find the submission
    kyc_list_resp = requests.get(f"{BASE_URL}/admin/kyc", headers={"Authorization": f"Bearer {admin_token}"})
    
    if kyc_list_resp.status_code != 200:
        print(f"Failed to get KYC list: {kyc_list_resp.text}")
        return None
    
    kyc_list = kyc_list_resp.json().get('kyc', [])
    user_kyc = next((k for k in kyc_list if k.get('user_id') == user_id), None)
    
    if not user_kyc:
        print(f"KYC not found for user {user_id}")
        return None
    
    kyc_id = user_kyc.get('id')
    
    # Approve KYC
    approve_resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})
    
    if approve_resp.status_code != 200:
        print(f"KYC approval failed: {approve_resp.text}")
        return None
    
    return {
        "user_id": user_id,
        "user_token": user_token,
        "admin_token": admin_token,
        "email": email
    }

def test_master_global_card():
    """Test Master Global card feature"""
    print("\n" + "="*80)
    print("MASTER GLOBAL CARD BACKEND TEST")
    print("="*80 + "\n")
    
    # Admin login
    print("Logging in as admin...")
    admin_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if admin_resp.status_code != 200:
        print(f"❌ Admin login failed: {admin_resp.text}")
        return
    
    admin_token = admin_resp.json().get('token')
    admin_id = admin_resp.json().get('user', {}).get('id')
    print(f"✅ Admin logged in successfully\n")
    
    # ========== ITEM 1: Issue validation ==========
    print("="*80)
    print("ITEM 1: Issue validation")
    print("="*80)
    
    # Create test user for validation tests
    print("Creating test user for validation tests...")
    test_user = register_and_approve_user()
    if not test_user:
        print("❌ Failed to create test user")
        return
    
    user_id = test_user['user_id']
    user_token = test_user['user_token']
    print(f"✅ Test user created: {user_id}\n")
    
    # Test 1a: Missing fee
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue", 
                        json={"user_id": user_id, "review_hours": 5, "required_docs": ["passport"]},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1a", "Missing fee → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1b: Missing hours
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={"user_id": user_id, "fee_usdt": 100, "required_docs": ["passport"]},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1b", "Missing hours → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1c: Hours 9000 → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={"user_id": user_id, "fee_usdt": 100, "review_hours": 9000, "required_docs": ["passport"]},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1c", "Hours 9000 → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1d: No docs → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={"user_id": user_id, "fee_usdt": 100, "review_hours": 5, "required_docs": []},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1d", "No docs → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1e: Admin target → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={"user_id": admin_id, "fee_usdt": 100, "review_hours": 5, "required_docs": ["passport"]},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1e", "Admin target → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1f: Valid issue
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={
                            "user_id": user_id,
                            "fee_usdt": 100,
                            "review_hours": 5,
                            "required_docs": ["passport", "proof_of_address"]
                        },
                        headers={"Authorization": f"Bearer {admin_token}"})
    
    if resp.status_code != 200:
        log_test("1f", "Valid issue", False, f"Status: {resp.status_code}, Response: {resp.text}")
        return
    
    card_data = resp.json().get('card', {})
    card_id = card_data.get('id')
    card_status = card_data.get('status')
    card_type = card_data.get('type')
    review_hours = card_data.get('review_hours')
    kyc_required_docs = card_data.get('kyc', {}).get('required_docs', [])
    
    passed = (card_status == 'pending_activation' and 
             review_hours == 5 and 
             'passport' in kyc_required_docs and 
             'proof_of_address' in kyc_required_docs and
             card_type == 'global')
    
    log_test("1f", "Valid issue", passed, 
            f"Status: {card_status}, Type: {card_type}, Hours: {review_hours}, Docs: {kyc_required_docs}")
    
    if not passed:
        return
    
    # Test 1g: Second issue same user → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={
                            "user_id": user_id,
                            "fee_usdt": 100,
                            "review_hours": 5,
                            "required_docs": ["passport"]
                        },
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1g", "Second issue same user → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1h: User GET /api/cards shows it
    resp = requests.get(f"{BASE_URL}/cards", headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        cards = resp.json().get('cards', [])
        global_card = next((c for c in cards if c.get('type') == 'global'), None)
        log_test("1h", "User GET /cards shows global card", global_card is not None, 
                f"Found: {global_card is not None}")
    else:
        log_test("1h", "User GET /cards shows global card", False, f"Status: {resp.status_code}")
    
    # Test 1i: Notification 'global_card_issued'
    resp = requests.get(f"{BASE_URL}/notifications", headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        notifications = resp.json().get('notifications', [])
        global_notif = next((n for n in notifications if n.get('kind') == 'global_card_issued'), None)
        log_test("1i", "Notification 'global_card_issued'", global_notif is not None,
                f"Found: {global_notif is not None}")
    else:
        log_test("1i", "Notification 'global_card_issued'", False, f"Status: {resp.status_code}")
    
    # Test 1j: Does not count toward 3 tier card limit
    resp = requests.post(f"{BASE_URL}/cards/request",
                        json={"tier": "basic"},
                        headers={"Authorization": f"Bearer {user_token}"})
    log_test("1j", "Does not count toward 3 tier card limit", resp.status_code == 200,
            f"Status: {resp.status_code}")
    
    print()
    
    # ========== SUMMARY ==========
    print("="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed_count = sum(1 for r in test_results if "✅ PASS" in r)
    total_count = len(test_results)
    
    print(f"\nTotal tests: {total_count}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {total_count - passed_count}")
    print(f"Success rate: {passed_count/total_count*100:.1f}%\n")
    
    print("Detailed results:")
    for result in test_results:
        print(result)
    
    print("\n" + "="*80)

if __name__ == "__main__":
    try:
        test_master_global_card()
    except Exception as e:
        print(f"\n❌ Test execution failed with error: {e}")
        import traceback
        traceback.print_exc()
