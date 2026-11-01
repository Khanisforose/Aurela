#!/usr/bin/env python3
"""
Backend API Test Suite for Zonal Card Geo Hold Features
Tests two main features:
A) Zonal card ACTIVE → geo hold fully lifted (6 test cases)
B) Hidden zonal cards reveal logic (5 test cases)
"""

import requests
import json
import time
import os
from pymongo import MongoClient

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://aurela-preview.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'aurela')

# Admin credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# Test results tracking
test_results = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"  Details: {details}")
    test_results.append({"test": test_name, "passed": passed, "details": details})

def admin_login():
    """Login as admin and return token"""
    try:
        response = requests.post(f"{API_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=30)
        if response.status_code == 200:
            data = response.json()
            return data.get('token')
        else:
            print(f"Admin login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Admin login error: {e}")
        return None

def create_test_user(admin_token, email_suffix):
    """Create and KYC-approve a test user"""
    try:
        # Register user
        email = f"zonaltest_{email_suffix}@test.aurela.io"
        signup_response = requests.post(f"{API_URL}/auth/register/init", json={
            "first_name": "Zonal",
            "last_name": f"Test{email_suffix}",
            "email": email,
            "country": "US",
            "phone": f"+1555000{email_suffix[:4]}",
            "password": "TestPass123#"
        }, timeout=30)
        
        if signup_response.status_code != 200:
            print(f"Signup failed: {signup_response.text}")
            return None, None
        
        signup_data = signup_response.json()
        signup_id = signup_data.get('signup_id')
        
        # Fetch OTP from database
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        signup_doc = db.pending_signups.find_one({"id": signup_id})
        otp = signup_doc.get('code') if signup_doc else None
        mongo_client.close()
        
        if not otp:
            print(f"Could not fetch OTP for signup_id: {signup_id}")
            return None, None
        
        # Verify with OTP
        verify_response = requests.post(f"{API_URL}/auth/register/verify", json={
            "signup_id": signup_id,
            "code": otp
        }, timeout=30)
        
        if verify_response.status_code != 200:
            print(f"Verify failed: {verify_response.text}")
            return None, None
        
        verify_data = verify_response.json()
        user_token = verify_data.get('token')
        user_id = verify_data.get('user', {}).get('id')
        
        # Approve KYC via admin
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        db.users.update_one({"id": user_id}, {"$set": {"kyc_status": "approved"}})
        mongo_client.close()
        
        return user_id, user_token
    except Exception as e:
        print(f"Create test user error: {e}")
        return None, None

def fund_user_wallet(user_id, currency, amount):
    """Fund user wallet via MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        db.wallets.update_one(
            {"user_id": user_id, "currency": currency},
            {"$inc": {"balance": amount}}
        )
        mongo_client.close()
        return True
    except Exception as e:
        print(f"Fund wallet error: {e}")
        return False

def put_user_on_hold(user_id):
    """Put user on geo hold via MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        db.users.update_one(
            {"id": user_id},
            {"$set": {
                "withdraw_lock": {
                    "active": True,
                    "reason": "geolocation_unverified",
                    "since": {"$date": int(time.time() * 1000)}
                },
                "withdraw_lock_exempt": False
            }}
        )
        mongo_client.close()
        return True
    except Exception as e:
        print(f"Put user on hold error: {e}")
        return False

def get_user_hold_status(user_id):
    """Get user's withdraw_lock status from MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        user = db.users.find_one({"id": user_id}, {"withdraw_lock": 1, "withdraw_lock_exempt": 1, "withdraw_allowance_usd": 1})
        mongo_client.close()
        return user
    except Exception as e:
        print(f"Get user hold status error: {e}")
        return None

def set_card_usable_at_past(card_id):
    """Set card's usable_at to past via MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        past_time = {"$date": int((time.time() - 3600) * 1000)}  # 1 hour ago
        db.cards.update_one(
            {"id": card_id},
            {"$set": {"usable_at": past_time}}
        )
        mongo_client.close()
        return True
    except Exception as e:
        print(f"Set card usable_at error: {e}")
        return False

def run_tests():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("BACKEND API TESTS: Zonal Card Geo Hold Features")
    print("="*80 + "\n")
    
    # Login as admin
    print("Logging in as admin...")
    admin_token = admin_login()
    if not admin_token:
        print("❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        return
    
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    
    print("\n" + "="*80)
    print("PART A: Zonal Card ACTIVE → Geo Hold Fully Lifted (6 tests)")
    print("="*80 + "\n")
    
    # TEST A1: User on hold; admin issues visible zonal card → user activates → admin approves with activate_now:true → hold lifted
    print("\n--- TEST A1: Visible zonal card with fee → activate → approve with activate_now → hold lifted ---")
    try:
        user_id_a1, user_token_a1 = create_test_user(admin_token, "a1_" + str(int(time.time())))
        if not user_id_a1:
            log_test("A1: Create user", False, "Failed to create test user")
        else:
            # Put user on hold
            put_user_on_hold(user_id_a1)
            hold_before = get_user_hold_status(user_id_a1)
            log_test("A1: User on hold", hold_before.get('withdraw_lock', {}).get('active') == True, f"Hold active: {hold_before.get('withdraw_lock', {}).get('active')}")
            
            # Admin issues visible zonal card with fee
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_a1,
                "zone": "NA",
                "fee_usdt": 10,
                "activation_hours": 5
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_data = issue_response.json().get('card', {})
                card_id = card_data.get('id')
                log_test("A1: Issue visible zonal card", card_data.get('status') == 'pending_activation', f"Card status: {card_data.get('status')}")
                
                # User activates card with tx_hash
                headers_user = {"Authorization": f"Bearer {user_token_a1}"}
                activate_response = requests.post(f"{API_URL}/cards/{card_id}/activate", headers=headers_user, json={
                    "tx_hash": f"0xTESTA1{int(time.time())}",
                    "network": "TRC20"
                }, timeout=30)
                
                if activate_response.status_code == 200:
                    log_test("A1: User activates card", True, "Card activation submitted")
                    
                    # Admin approves with activate_now=true
                    approve_response = requests.post(f"{API_URL}/admin/cards/{card_id}/approve", headers=headers_admin, json={
                        "activate_now": True
                    }, timeout=30)
                    
                    if approve_response.status_code == 200:
                        log_test("A1: Admin approves with activate_now", True, "Card approved")
                        
                        # Check card status
                        cards_response = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                        if cards_response.status_code == 200:
                            cards = cards_response.json().get('cards', [])
                            zonal_card = next((c for c in cards if c.get('id') == card_id), None)
                            log_test("A1: Card status is active", zonal_card.get('status') == 'active', f"Card status: {zonal_card.get('status')}")
                        
                        # Check hold is lifted
                        hold_after = get_user_hold_status(user_id_a1)
                        is_lifted = hold_after.get('withdraw_lock', {}).get('active') == False
                        is_exempt = hold_after.get('withdraw_lock_exempt') == True
                        has_no_allowance = 'withdraw_allowance_usd' not in hold_after or hold_after.get('withdraw_allowance_usd') is None
                        cleared_reason = hold_after.get('withdraw_lock', {}).get('cleared_reason')
                        
                        log_test("A1: Hold lifted (active=false)", is_lifted, f"Hold active: {hold_after.get('withdraw_lock', {}).get('active')}")
                        log_test("A1: User exempt (exempt=true)", is_exempt, f"Exempt: {hold_after.get('withdraw_lock_exempt')}")
                        log_test("A1: Allowance removed", has_no_allowance, f"Allowance: {hold_after.get('withdraw_allowance_usd')}")
                        log_test("A1: Cleared reason is zonal_card_active", cleared_reason == 'zonal_card_active', f"Reason: {cleared_reason}")
                    else:
                        log_test("A1: Admin approves with activate_now", False, f"Status: {approve_response.status_code}")
                else:
                    log_test("A1: User activates card", False, f"Status: {activate_response.status_code}")
            else:
                log_test("A1: Issue visible zonal card", False, f"Status: {issue_response.status_code} - {issue_response.text}")
    except Exception as e:
        log_test("A1: Exception", False, str(e))
    
    # TEST A2: Approve WITHOUT activate_now → hold still active. Then set usable_at in past → hold lifted
    print("\n--- TEST A2: Approve without activate_now → hold still active → usable_at in past → hold lifted ---")
    try:
        user_id_a2, user_token_a2 = create_test_user(admin_token, "a2_" + str(int(time.time())))
        if user_id_a2:
            put_user_on_hold(user_id_a2)
            
            # Issue visible zonal card
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_a2,
                "zone": "EU",
                "fee_usdt": 15,
                "activation_hours": 24
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                
                # User activates
                headers_user = {"Authorization": f"Bearer {user_token_a2}"}
                requests.post(f"{API_URL}/cards/{card_id}/activate", headers=headers_user, json={
                    "tx_hash": f"0xTESTA2{int(time.time())}",
                    "network": "TRC20"
                }, timeout=30)
                
                # Admin approves WITHOUT activate_now
                approve_response = requests.post(f"{API_URL}/admin/cards/{card_id}/approve", headers=headers_admin, json={}, timeout=30)
                
                if approve_response.status_code == 200:
                    log_test("A2: Admin approves without activate_now", True, "Card approved")
                    
                    # Check card status is activating
                    cards_response = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                    if cards_response.status_code == 200:
                        cards = cards_response.json().get('cards', [])
                        zonal_card = next((c for c in cards if c.get('id') == card_id), None)
                        log_test("A2: Card status is activating", zonal_card.get('status') == 'activating', f"Card status: {zonal_card.get('status')}")
                    
                    # Check hold still active
                    hold_mid = get_user_hold_status(user_id_a2)
                    log_test("A2: Hold still active (activating card)", hold_mid.get('withdraw_lock', {}).get('active') == True, f"Hold active: {hold_mid.get('withdraw_lock', {}).get('active')}")
                    
                    # Set usable_at to past
                    set_card_usable_at_past(card_id)
                    
                    # Call GET /cards to trigger settleDueCards
                    time.sleep(1)
                    cards_response2 = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                    if cards_response2.status_code == 200:
                        cards2 = cards_response2.json().get('cards', [])
                        zonal_card2 = next((c for c in cards2 if c.get('id') == card_id), None)
                        log_test("A2: Card becomes active after usable_at", zonal_card2.get('status') == 'active', f"Card status: {zonal_card2.get('status')}")
                    
                    # Check hold is now lifted
                    hold_after = get_user_hold_status(user_id_a2)
                    is_lifted = hold_after.get('withdraw_lock', {}).get('active') == False
                    log_test("A2: Hold lifted after card active", is_lifted, f"Hold active: {hold_after.get('withdraw_lock', {}).get('active')}")
    except Exception as e:
        log_test("A2: Exception", False, str(e))
    
    # TEST A3: Free instant zonal (fee 0, hours 0) → card active immediately and hold lifted
    print("\n--- TEST A3: Free instant zonal (fee=0, hours=0) → active immediately and hold lifted ---")
    try:
        user_id_a3, user_token_a3 = create_test_user(admin_token, "a3_" + str(int(time.time())))
        if user_id_a3:
            put_user_on_hold(user_id_a3)
            
            # Issue free instant zonal card
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_a3,
                "zone": "UK",
                "fee_usdt": 0,
                "activation_hours": 0
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_data = issue_response.json().get('card', {})
                log_test("A3: Free instant card issued with status active", card_data.get('status') == 'active', f"Card status: {card_data.get('status')}")
                
                # Check hold is lifted
                hold_after = get_user_hold_status(user_id_a3)
                is_lifted = hold_after.get('withdraw_lock', {}).get('active') == False
                is_exempt = hold_after.get('withdraw_lock_exempt') == True
                log_test("A3: Hold lifted immediately", is_lifted, f"Hold active: {hold_after.get('withdraw_lock', {}).get('active')}")
                log_test("A3: User exempt", is_exempt, f"Exempt: {hold_after.get('withdraw_lock_exempt')}")
            else:
                log_test("A3: Issue free instant zonal", False, f"Status: {issue_response.status_code}")
    except Exception as e:
        log_test("A3: Exception", False, str(e))
    
    # TEST A4: Hidden card with fee=0 hours=0 → reveal → active and hold lifted. With fee>0 → pending_activation, hold NOT lifted
    print("\n--- TEST A4: Hidden card reveal logic with fee variations ---")
    try:
        # A4a: Hidden card with fee=0, hours=0, amount_usd rule
        user_id_a4a, user_token_a4a = create_test_user(admin_token, "a4a_" + str(int(time.time())))
        if user_id_a4a:
            put_user_on_hold(user_id_a4a)
            fund_user_wallet(user_id_a4a, "USD", 200)
            
            # Issue hidden card with amount_usd rule, fee=0, hours=0
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_a4a,
                "zone": "ME",
                "fee_usdt": 0,
                "activation_hours": 0,
                "reveal": {
                    "mode": "hidden",
                    "geo": False,
                    "amount_usd": 50,
                    "match": "any"
                }
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_data = issue_response.json().get('card', {})
                card_id = card_data.get('id')
                log_test("A4a: Hidden card issued", card_data.get('status') == 'hidden', f"Card status: {card_data.get('status')}")
                
                # Admin manually reveals the card
                reveal_response = requests.post(f"{API_URL}/admin/cards/{card_id}/reveal", headers=headers_admin, json={}, timeout=30)
                
                if reveal_response.status_code == 200:
                    revealed_card = reveal_response.json().get('card', {})
                    log_test("A4a: Hidden card revealed to active (fee=0, hours=0)", revealed_card.get('status') == 'active', f"Card status: {revealed_card.get('status')}")
                    
                    # Check hold is lifted
                    hold_after = get_user_hold_status(user_id_a4a)
                    is_lifted = hold_after.get('withdraw_lock', {}).get('active') == False
                    log_test("A4a: Hold lifted after reveal to active", is_lifted, f"Hold active: {hold_after.get('withdraw_lock', {}).get('active')}")
        
        # A4b: Hidden card with fee>0
        user_id_a4b, user_token_a4b = create_test_user(admin_token, "a4b_" + str(int(time.time())))
        if user_id_a4b:
            put_user_on_hold(user_id_a4b)
            
            # Issue hidden card with fee>0
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_a4b,
                "zone": "AF",
                "fee_usdt": 20,
                "activation_hours": 0,
                "reveal": {
                    "mode": "hidden",
                    "geo": False,
                    "amount_usd": 30,
                    "match": "any"
                }
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                
                # Admin reveals
                reveal_response = requests.post(f"{API_URL}/admin/cards/{card_id}/reveal", headers=headers_admin, json={}, timeout=30)
                
                if reveal_response.status_code == 200:
                    revealed_card = reveal_response.json().get('card', {})
                    log_test("A4b: Hidden card revealed to pending_activation (fee>0)", revealed_card.get('status') == 'pending_activation', f"Card status: {revealed_card.get('status')}")
                    
                    # Check hold NOT lifted
                    hold_after = get_user_hold_status(user_id_a4b)
                    is_still_active = hold_after.get('withdraw_lock', {}).get('active') == True
                    log_test("A4b: Hold NOT lifted (card pending_activation)", is_still_active, f"Hold active: {hold_after.get('withdraw_lock', {}).get('active')}")
    except Exception as e:
        log_test("A4: Exception", False, str(e))
    
    # TEST A5: After lift, tier card approval must NOT re-lock (exempt). Admin mode 'lock' re-applies hold
    print("\n--- TEST A5: Exempt user + tier card approval + admin re-lock ---")
    try:
        user_id_a5, user_token_a5 = create_test_user(admin_token, "a5_" + str(int(time.time())))
        if user_id_a5:
            put_user_on_hold(user_id_a5)
            
            # Issue free instant zonal to lift hold and set exempt
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_a5,
                "zone": "SAS",
                "fee_usdt": 0,
                "activation_hours": 0
            }, timeout=30)
            
            if issue_response.status_code == 200:
                # Verify exempt
                hold_after_zonal = get_user_hold_status(user_id_a5)
                is_exempt = hold_after_zonal.get('withdraw_lock_exempt') == True
                log_test("A5: User exempt after zonal card", is_exempt, f"Exempt: {hold_after_zonal.get('withdraw_lock_exempt')}")
                
                # Request and approve a tier card
                headers_user = {"Authorization": f"Bearer {user_token_a5}"}
                tier_request = requests.post(f"{API_URL}/cards/request", headers=headers_user, json={"tier": "basic"}, timeout=30)
                
                if tier_request.status_code == 200:
                    tier_card_id = tier_request.json().get('card', {}).get('id')
                    
                    # Activate tier card
                    requests.post(f"{API_URL}/cards/{tier_card_id}/activate", headers=headers_user, json={
                        "tx_hash": f"0xTESTA5TIER{int(time.time())}",
                        "network": "TRC20"
                    }, timeout=30)
                    
                    # Admin approves tier card
                    requests.post(f"{API_URL}/admin/cards/{tier_card_id}/approve", headers=headers_admin, json={"activate_now": True}, timeout=30)
                    
                    # Check hold NOT re-applied (exempt)
                    hold_after_tier = get_user_hold_status(user_id_a5)
                    is_not_locked = hold_after_tier.get('withdraw_lock', {}).get('active') != True
                    log_test("A5: Hold NOT re-applied after tier card (exempt)", is_not_locked, f"Hold active: {hold_after_tier.get('withdraw_lock', {}).get('active')}")
                    
                    # Admin re-applies hold via mode 'lock'
                    lock_response = requests.post(f"{API_URL}/admin/users/{user_id_a5}/withdraw_access", headers=headers_admin, json={
                        "mode": "lock"
                    }, timeout=30)
                    
                    if lock_response.status_code == 200:
                        log_test("A5: Admin mode 'lock' succeeds", True, "Lock applied")
                        
                        # Check hold re-applied
                        hold_after_lock = get_user_hold_status(user_id_a5)
                        is_locked = hold_after_lock.get('withdraw_lock', {}).get('active') == True
                        is_not_exempt = hold_after_lock.get('withdraw_lock_exempt') == False
                        log_test("A5: Hold re-applied (active=true)", is_locked, f"Hold active: {hold_after_lock.get('withdraw_lock', {}).get('active')}")
                        log_test("A5: Exempt cleared (exempt=false)", is_not_exempt, f"Exempt: {hold_after_lock.get('withdraw_lock_exempt')}")
    except Exception as e:
        log_test("A5: Exception", False, str(e))
    
    # TEST A6: Tier card activation alone (no zonal) must NOT lift hold
    print("\n--- TEST A6: Tier card activation alone must NOT lift hold ---")
    try:
        user_id_a6, user_token_a6 = create_test_user(admin_token, "a6_" + str(int(time.time())))
        if user_id_a6:
            put_user_on_hold(user_id_a6)
            
            # Request and approve tier card
            headers_user = {"Authorization": f"Bearer {user_token_a6}"}
            tier_request = requests.post(f"{API_URL}/cards/request", headers=headers_user, json={"tier": "premium"}, timeout=30)
            
            if tier_request.status_code == 200:
                tier_card_id = tier_request.json().get('card', {}).get('id')
                
                # Activate
                requests.post(f"{API_URL}/cards/{tier_card_id}/activate", headers=headers_user, json={
                    "tx_hash": f"0xTESTA6{int(time.time())}",
                    "network": "TRC20"
                }, timeout=30)
                
                # Admin approves
                requests.post(f"{API_URL}/admin/cards/{tier_card_id}/approve", headers=headers_admin, json={"activate_now": True}, timeout=30)
                
                # Check hold NOT lifted
                hold_after = get_user_hold_status(user_id_a6)
                is_still_active = hold_after.get('withdraw_lock', {}).get('active') == True
                log_test("A6: Hold NOT lifted by tier card alone", is_still_active, f"Hold active: {hold_after.get('withdraw_lock', {}).get('active')}")
    except Exception as e:
        log_test("A6: Exception", False, str(e))
    
    print("\n" + "="*80)
    print("PART B: Hidden Zonal Cards Reveal Logic (5 tests)")
    print("="*80 + "\n")
    
    # TEST B7: Geo rule - user on hold with allowance → withdraw consuming allowance → card revealed
    print("\n--- TEST B7: Geo rule - allowance consumed → card revealed ---")
    try:
        user_id_b7, user_token_b7 = create_test_user(admin_token, "b7_" + str(int(time.time())))
        if user_id_b7:
            put_user_on_hold(user_id_b7)
            fund_user_wallet(user_id_b7, "USD", 200)
            
            # Set allowance
            requests.post(f"{API_URL}/admin/users/{user_id_b7}/withdraw_access", headers=headers_admin, json={
                "mode": "allowance",
                "allowance_usd": 50
            }, timeout=30)
            
            # Issue hidden card with geo rule
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_b7,
                "zone": "SEA",
                "fee_usdt": 10,
                "activation_hours": 5,
                "reveal": {
                    "mode": "hidden",
                    "geo": True,
                    "amount_usd": 0,
                    "match": "any"
                }
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                log_test("B7: Hidden card with geo rule issued", True, "Card issued")
                
                # User withdraws ~$50 to consume allowance
                headers_user = {"Authorization": f"Bearer {user_token_b7}"}
                withdraw_response = requests.post(f"{API_URL}/withdraw", headers=headers_user, json={
                    "amount": 50,
                    "currency": "USD",
                    "method": "bank_swift",
                    "destination": "test_account"
                }, timeout=30)
                
                if withdraw_response.status_code == 200:
                    withdraw_id = withdraw_response.json().get('request', {}).get('id')
                    log_test("B7: Withdrawal submitted", True, f"Withdraw ID: {withdraw_id}")
                    
                    # Admin approves withdrawal
                    approve_response = requests.post(f"{API_URL}/admin/withdrawals/{withdraw_id}/approve", headers=headers_admin, json={}, timeout=30)
                    
                    if approve_response.status_code == 200:
                        log_test("B7: Withdrawal approved", True, "Approved")
                        
                        # Check card revealed
                        time.sleep(1)
                        cards_response = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                        if cards_response.status_code == 200:
                            cards = cards_response.json().get('cards', [])
                            revealed_card = next((c for c in cards if c.get('id') == card_id), None)
                            if revealed_card:
                                log_test("B7: Card revealed (visible to user)", True, f"Card status: {revealed_card.get('status')}")
                                log_test("B7: Card status is pending_activation", revealed_card.get('status') == 'pending_activation', f"Status: {revealed_card.get('status')}")
                            else:
                                log_test("B7: Card revealed (visible to user)", False, "Card not found in user's cards")
                        
                        # Check notification
                        notif_response = requests.get(f"{API_URL}/notifications", headers=headers_user, timeout=30)
                        if notif_response.status_code == 200:
                            notifs = notif_response.json().get('notifications', [])
                            zonal_notif = next((n for n in notifs if n.get('kind') == 'zonal_card_unlocked'), None)
                            log_test("B7: Notification created (zonal_card_unlocked)", zonal_notif is not None, f"Found: {zonal_notif is not None}")
    except Exception as e:
        log_test("B7: Exception", False, str(e))
    
    # TEST B8: Geo rule via admin mode 'unlock' → hidden geo card revealed
    print("\n--- TEST B8: Admin mode 'unlock' → hidden geo card revealed ---")
    try:
        user_id_b8, user_token_b8 = create_test_user(admin_token, "b8_" + str(int(time.time())))
        if user_id_b8:
            put_user_on_hold(user_id_b8)
            
            # Issue hidden card with geo rule
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_b8,
                "zone": "EA",
                "fee_usdt": 15,
                "activation_hours": 10,
                "reveal": {
                    "mode": "hidden",
                    "geo": True,
                    "amount_usd": 0,
                    "match": "any"
                }
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                log_test("B8: Hidden card with geo rule issued", True, "Card issued")
                
                # Admin unlocks hold
                unlock_response = requests.post(f"{API_URL}/admin/users/{user_id_b8}/withdraw_access", headers=headers_admin, json={
                    "mode": "unlock"
                }, timeout=30)
                
                if unlock_response.status_code == 200:
                    log_test("B8: Admin mode 'unlock' succeeds", True, "Unlocked")
                    
                    # Check card revealed
                    time.sleep(1)
                    headers_user = {"Authorization": f"Bearer {user_token_b8}"}
                    cards_response = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                    if cards_response.status_code == 200:
                        cards = cards_response.json().get('cards', [])
                        revealed_card = next((c for c in cards if c.get('id') == card_id), None)
                        log_test("B8: Card revealed after unlock", revealed_card is not None, f"Card found: {revealed_card is not None}")
    except Exception as e:
        log_test("B8: Exception", False, str(e))
    
    # TEST B9: match 'all' with geo + amount_usd → needs both
    print("\n--- TEST B9: match='all' requires both geo and amount_usd ---")
    try:
        user_id_b9, user_token_b9 = create_test_user(admin_token, "b9_" + str(int(time.time())))
        if user_id_b9:
            put_user_on_hold(user_id_b9)
            fund_user_wallet(user_id_b9, "USD", 300)
            
            # Set allowance
            requests.post(f"{API_URL}/admin/users/{user_id_b9}/withdraw_access", headers=headers_admin, json={
                "mode": "allowance",
                "allowance_usd": 100
            }, timeout=30)
            
            # Issue hidden card with match='all'
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_b9,
                "zone": "OCE",
                "fee_usdt": 20,
                "activation_hours": 12,
                "reveal": {
                    "mode": "hidden",
                    "geo": True,
                    "amount_usd": 80,
                    "match": "all"
                }
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                log_test("B9: Hidden card with match='all' issued", True, "Card issued")
                
                # User withdraws $80 (meets amount rule but not geo rule yet)
                headers_user = {"Authorization": f"Bearer {user_token_b9}"}
                withdraw_response = requests.post(f"{API_URL}/withdraw", headers=headers_user, json={
                    "amount": 80,
                    "currency": "USD",
                    "method": "bank_swift",
                    "destination": "test_account"
                }, timeout=30)
                
                if withdraw_response.status_code == 200:
                    withdraw_id = withdraw_response.json().get('request', {}).get('id')
                    
                    # Admin approves
                    requests.post(f"{API_URL}/admin/withdrawals/{withdraw_id}/approve", headers=headers_admin, json={}, timeout=30)
                    
                    # Check card NOT revealed yet (geo rule not met)
                    time.sleep(1)
                    cards_response = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                    if cards_response.status_code == 200:
                        cards = cards_response.json().get('cards', [])
                        revealed_card = next((c for c in cards if c.get('id') == card_id), None)
                        log_test("B9: Card NOT revealed (amount met, geo not met)", revealed_card is None, f"Card visible: {revealed_card is not None}")
                    
                    # Now consume remaining allowance to meet geo rule
                    withdraw_response2 = requests.post(f"{API_URL}/withdraw", headers=headers_user, json={
                        "amount": 20,
                        "currency": "USD",
                        "method": "bank_swift",
                        "destination": "test_account"
                    }, timeout=30)
                    
                    if withdraw_response2.status_code == 200:
                        withdraw_id2 = withdraw_response2.json().get('request', {}).get('id')
                        requests.post(f"{API_URL}/admin/withdrawals/{withdraw_id2}/approve", headers=headers_admin, json={}, timeout=30)
                        
                        # Now card should be revealed (both rules met)
                        time.sleep(1)
                        cards_response2 = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                        if cards_response2.status_code == 200:
                            cards2 = cards_response2.json().get('cards', [])
                            revealed_card2 = next((c for c in cards2 if c.get('id') == card_id), None)
                            log_test("B9: Card revealed after both rules met", revealed_card2 is not None, f"Card visible: {revealed_card2 is not None}")
    except Exception as e:
        log_test("B9: Exception", False, str(e))
    
    # TEST B10: PUT /api/admin/cards/:id/reveal-rule validations
    print("\n--- TEST B10: PUT reveal-rule validations ---")
    try:
        user_id_b10, user_token_b10 = create_test_user(admin_token, "b10_" + str(int(time.time())))
        if user_id_b10:
            # Issue hidden card
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_b10,
                "zone": "CIS",
                "fee_usdt": 25,
                "activation_hours": 15,
                "reveal": {
                    "mode": "hidden",
                    "geo": False,
                    "amount_usd": 100,
                    "match": "any"
                }
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                
                # B10a: Invalid rule (geo=false, amount=0)
                invalid_response = requests.put(f"{API_URL}/admin/cards/{card_id}/reveal-rule", headers=headers_admin, json={
                    "geo": False,
                    "amount_usd": 0
                }, timeout=30)
                log_test("B10a: Invalid rule (geo=false, amount=0) → 400", invalid_response.status_code == 400, f"Status: {invalid_response.status_code}")
                
                # B10b: Lower amount below progress → auto-reveal
                # First, add some progress via MongoDB
                mongo_client = MongoClient(MONGO_URL)
                db = mongo_client[DB_NAME]
                db.cards.update_one({"id": card_id}, {"$set": {"reveal.progress_usd": 60}})
                mongo_client.close()
                
                # Now lower amount to 50 (below progress of 60)
                lower_response = requests.put(f"{API_URL}/admin/cards/{card_id}/reveal-rule", headers=headers_admin, json={
                    "geo": False,
                    "amount_usd": 50
                }, timeout=30)
                
                if lower_response.status_code == 200:
                    updated_card = lower_response.json().get('card', {})
                    log_test("B10b: Lowering amount below progress auto-reveals", updated_card.get('status') != 'hidden', f"Card status: {updated_card.get('status')}")
            
            # B10c: Non-hidden card → 400
            # Issue a visible card
            issue_visible = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_b10,
                "zone": "SA",
                "fee_usdt": 0,
                "activation_hours": 0
            }, timeout=30)
            
            if issue_visible.status_code == 200:
                visible_card_id = issue_visible.json().get('card', {}).get('id')
                
                # Try to update reveal-rule on non-hidden card
                non_hidden_response = requests.put(f"{API_URL}/admin/cards/{visible_card_id}/reveal-rule", headers=headers_admin, json={
                    "geo": True,
                    "amount_usd": 100
                }, timeout=30)
                log_test("B10c: Non-hidden card reveal-rule → 400", non_hidden_response.status_code == 400, f"Status: {non_hidden_response.status_code}")
    except Exception as e:
        log_test("B10: Exception", False, str(e))
    
    # TEST B11: POST /api/admin/cards/:id/reveal on non-hidden → 400
    print("\n--- TEST B11: POST reveal on non-hidden card → 400 ---")
    try:
        user_id_b11, user_token_b11 = create_test_user(admin_token, "b11_" + str(int(time.time())))
        if user_id_b11:
            # Issue visible card
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_b11,
                "zone": "NA",
                "fee_usdt": 10,
                "activation_hours": 5
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                
                # Try to reveal non-hidden card
                reveal_response = requests.post(f"{API_URL}/admin/cards/{card_id}/reveal", headers=headers_admin, json={}, timeout=30)
                log_test("B11: POST reveal on non-hidden card → 400", reveal_response.status_code == 400, f"Status: {reveal_response.status_code}")
    except Exception as e:
        log_test("B11: Exception", False, str(e))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80 + "\n")
    
    total_tests = len(test_results)
    passed_tests = sum(1 for t in test_results if t['passed'])
    failed_tests = total_tests - passed_tests
    
    print(f"Total tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests}")
    print(f"Success rate: {(passed_tests/total_tests*100):.1f}%\n")
    
    if failed_tests > 0:
        print("Failed tests:")
        for t in test_results:
            if not t['passed']:
                print(f"  ❌ {t['test']}")
                if t['details']:
                    print(f"     {t['details']}")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    run_tests()
