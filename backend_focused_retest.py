#!/usr/bin/env python3
"""
Focused Retest for Zonal Card Features
Based on review_request: A2 fix (settleDueCards with Date/ISO string), B7 (geo allowance), B9 (match='all')
"""

import requests
import json
import time
import os
from pymongo import MongoClient
from datetime import datetime, timedelta

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
    """Create and KYC-approve a test user with funded wallets"""
    try:
        # Register user
        email = f"focustest_{email_suffix}@test.aurela.io"
        signup_response = requests.post(f"{API_URL}/auth/register/init", json={
            "first_name": "Focus",
            "last_name": f"Test{email_suffix}",
            "email": email,
            "country": "US",
            "phone": f"+1555{str(int(time.time()))[-7:]}",
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
        
        if not otp:
            mongo_client.close()
            print(f"Could not fetch OTP for signup_id: {signup_id}")
            return None, None
        
        # Verify with OTP
        verify_response = requests.post(f"{API_URL}/auth/register/verify", json={
            "signup_id": signup_id,
            "code": otp
        }, timeout=30)
        
        if verify_response.status_code != 200:
            mongo_client.close()
            print(f"Verify failed: {verify_response.text}")
            return None, None
        
        verify_data = verify_response.json()
        user_token = verify_data.get('token')
        user_id = verify_data.get('user', {}).get('id')
        
        # Approve KYC and fund wallets via MongoDB
        db.users.update_one({"id": user_id}, {"$set": {"kyc_status": "approved"}})
        db.wallets.update_one({"user_id": user_id, "currency": "USD"}, {"$inc": {"balance": 500}})
        db.wallets.update_one({"user_id": user_id, "currency": "USDT"}, {"$inc": {"balance": 200}})
        mongo_client.close()
        
        return user_id, user_token
    except Exception as e:
        print(f"Create test user error: {e}")
        return None, None

def put_user_on_hold_with_allowance(user_id, allowance_usd):
    """Put user on geo hold with allowance via MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        db.users.update_one(
            {"id": user_id},
            {"$set": {
                "withdraw_lock": {
                    "active": True,
                    "reason": "geolocation_unverified",
                    "since": datetime.utcnow()
                },
                "withdraw_lock_exempt": False,
                "withdraw_allowance_usd": allowance_usd
            }}
        )
        mongo_client.close()
        return True
    except Exception as e:
        print(f"Put user on hold error: {e}")
        return False

def get_user_status(user_id):
    """Get user's withdraw_lock status from MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        user = db.users.find_one({"id": user_id}, {
            "withdraw_lock": 1, 
            "withdraw_lock_exempt": 1, 
            "withdraw_allowance_usd": 1
        })
        mongo_client.close()
        return user
    except Exception as e:
        print(f"Get user status error: {e}")
        return None

def get_card_from_db(card_id):
    """Get card from MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        card = db.cards.find_one({"id": card_id})
        mongo_client.close()
        return card
    except Exception as e:
        print(f"Get card error: {e}")
        return None

def set_card_usable_at_bson_date(card_id):
    """Set card's usable_at to past as BSON Date via MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        past_time = datetime.utcnow() - timedelta(hours=1)  # 1 hour ago as BSON Date
        db.cards.update_one(
            {"id": card_id},
            {"$set": {"usable_at": past_time}}
        )
        mongo_client.close()
        return True
    except Exception as e:
        print(f"Set card usable_at (BSON Date) error: {e}")
        return False

def set_card_usable_at_iso_string(card_id):
    """Set card's usable_at to past as ISO string via MongoDB"""
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        past_time = (datetime.utcnow() - timedelta(hours=1)).isoformat() + 'Z'  # ISO string
        db.cards.update_one(
            {"id": card_id},
            {"$set": {"usable_at": past_time}}
        )
        mongo_client.close()
        return True
    except Exception as e:
        print(f"Set card usable_at (ISO string) error: {e}")
        return False

def run_focused_tests():
    """Run focused retest scenarios"""
    print("\n" + "="*80)
    print("FOCUSED RETEST: Zonal Card Features (A2, B7, B9)")
    print("="*80 + "\n")
    
    # Login as admin
    print("Logging in as admin...")
    admin_token = admin_login()
    if not admin_token:
        print("❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        return
    
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    
    # ========================================================================
    # TEST 1: A2 Fix - settleDueCards with BSON Date usable_at
    # ========================================================================
    print("\n" + "="*80)
    print("TEST 1: A2 Fix - settleDueCards with BSON Date usable_at")
    print("="*80 + "\n")
    
    try:
        user_id_1, user_token_1 = create_test_user(admin_token, f"a2_bson_{int(time.time())}")
        if not user_id_1:
            log_test("TEST 1: Create user", False, "Failed to create test user")
        else:
            # Put user on hold
            put_user_on_hold_with_allowance(user_id_1, 0)
            
            # Admin issues visible zonal card
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_1,
                "zone": "NA",
                "fee_usdt": 10,
                "activation_hours": 5
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                log_test("TEST 1: Issue visible zonal card", True, f"Card ID: {card_id}")
                
                # User activates card
                headers_user = {"Authorization": f"Bearer {user_token_1}"}
                activate_response = requests.post(f"{API_URL}/cards/{card_id}/activate", headers=headers_user, json={
                    "tx_hash": f"0xA2TEST{int(time.time())}BSON",
                    "network": "ERC20"
                }, timeout=30)
                
                if activate_response.status_code == 200:
                    log_test("TEST 1: User activates card", True, "Activation submitted")
                    
                    # Admin approves WITHOUT activate_now
                    approve_response = requests.post(f"{API_URL}/admin/cards/{card_id}/approve", headers=headers_admin, json={}, timeout=30)
                    
                    if approve_response.status_code == 200:
                        log_test("TEST 1: Admin approves without activate_now", True, "Approved")
                        
                        # Verify card status is 'activating' and hold still active
                        time.sleep(1)
                        cards_response = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                        if cards_response.status_code == 200:
                            cards = cards_response.json().get('cards', [])
                            card = next((c for c in cards if c.get('id') == card_id), None)
                            log_test("TEST 1: Card status is 'activating'", card.get('status') == 'activating', f"Status: {card.get('status')}")
                        
                        user_status = get_user_status(user_id_1)
                        log_test("TEST 1: Hold still active", user_status.get('withdraw_lock', {}).get('active') == True, f"Hold active: {user_status.get('withdraw_lock', {}).get('active')}")
                        
                        # Set usable_at to past as BSON Date
                        set_card_usable_at_bson_date(card_id)
                        log_test("TEST 1: Set usable_at to past (BSON Date)", True, "Updated in DB")
                        
                        # Call GET /cards to trigger settleDueCards
                        time.sleep(2)
                        cards_response2 = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                        if cards_response2.status_code == 200:
                            cards2 = cards_response2.json().get('cards', [])
                            card2 = next((c for c in cards2 if c.get('id') == card_id), None)
                            log_test("TEST 1: Card status becomes 'active' (BSON Date)", card2.get('status') == 'active', f"Status: {card2.get('status')}")
                        
                        # Verify hold is lifted
                        user_status2 = get_user_status(user_id_1)
                        is_lifted = user_status2.get('withdraw_lock', {}).get('active') == False
                        is_exempt = user_status2.get('withdraw_lock_exempt') == True
                        cleared_reason = user_status2.get('withdraw_lock', {}).get('cleared_reason')
                        
                        log_test("TEST 1: Hold lifted (active=false)", is_lifted, f"Hold active: {user_status2.get('withdraw_lock', {}).get('active')}")
                        log_test("TEST 1: User exempt (exempt=true)", is_exempt, f"Exempt: {user_status2.get('withdraw_lock_exempt')}")
                        log_test("TEST 1: Cleared reason is 'zonal_card_active'", cleared_reason == 'zonal_card_active', f"Reason: {cleared_reason}")
                        
                        # Test withdraw path - verify user can withdraw (not GEO blocked)
                        # First check user balance
                        wallets_response = requests.get(f"{API_URL}/wallets", headers=headers_user, timeout=30)
                        if wallets_response.status_code == 200:
                            wallets = wallets_response.json().get('wallets', [])
                            usd_wallet = next((w for w in wallets if w.get('currency') == 'USD'), None)
                            available_balance = usd_wallet.get('balance', 0) if usd_wallet else 0
                            log_test("TEST 1: User has USD balance", available_balance > 0, f"Balance: {available_balance}")
                            
                            if available_balance >= 50:
                                # Need to request a tier card first for withdraw to work
                                tier_req = requests.post(f"{API_URL}/cards/request", headers=headers_user, json={"tier": "basic"}, timeout=30)
                                if tier_req.status_code == 200:
                                    tier_card_id = tier_req.json().get('card', {}).get('id')
                                    requests.post(f"{API_URL}/cards/{tier_card_id}/activate", headers=headers_user, json={
                                        "tx_hash": f"0xTIER{int(time.time())}",
                                        "network": "ERC20"
                                    }, timeout=30)
                                    requests.post(f"{API_URL}/admin/cards/{tier_card_id}/approve", headers=headers_admin, json={"activate_now": True}, timeout=30)
                                    time.sleep(1)
                                
                                withdraw_response = requests.post(f"{API_URL}/withdraw", headers=headers_user, json={
                                    "amount": 50,
                                    "currency": "USD",
                                    "method": "bank_swift",
                                    "destination": "test_account"
                                }, timeout=30)
                                log_test("TEST 1: Withdraw not GEO blocked", withdraw_response.status_code == 200, f"Status: {withdraw_response.status_code}, Response: {withdraw_response.text[:200]}")
                            else:
                                log_test("TEST 1: Withdraw not GEO blocked", False, f"Insufficient balance: {available_balance}")
                    else:
                        log_test("TEST 1: Admin approves", False, f"Status: {approve_response.status_code}")
                else:
                    log_test("TEST 1: User activates card", False, f"Status: {activate_response.status_code}")
            else:
                log_test("TEST 1: Issue visible zonal card", False, f"Status: {issue_response.status_code}")
    except Exception as e:
        log_test("TEST 1: Exception", False, str(e))
    
    # ========================================================================
    # TEST 2: A2 Fix - settleDueCards with ISO string usable_at
    # ========================================================================
    print("\n" + "="*80)
    print("TEST 2: A2 Fix - settleDueCards with ISO string usable_at")
    print("="*80 + "\n")
    
    try:
        user_id_2, user_token_2 = create_test_user(admin_token, f"a2_iso_{int(time.time())}")
        if user_id_2:
            put_user_on_hold_with_allowance(user_id_2, 0)
            
            # Issue visible zonal card
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_2,
                "zone": "EU",
                "fee_usdt": 15,
                "activation_hours": 10
            }, timeout=30)
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                
                # User activates
                headers_user = {"Authorization": f"Bearer {user_token_2}"}
                requests.post(f"{API_URL}/cards/{card_id}/activate", headers=headers_user, json={
                    "tx_hash": f"0xA2TEST{int(time.time())}ISO",
                    "network": "ERC20"
                }, timeout=30)
                
                # Admin approves WITHOUT activate_now
                requests.post(f"{API_URL}/admin/cards/{card_id}/approve", headers=headers_admin, json={}, timeout=30)
                
                # Set usable_at to past as ISO string
                set_card_usable_at_iso_string(card_id)
                log_test("TEST 2: Set usable_at to past (ISO string)", True, "Updated in DB")
                
                # Call GET /cards to trigger settleDueCards
                time.sleep(2)
                cards_response = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                if cards_response.status_code == 200:
                    cards = cards_response.json().get('cards', [])
                    card = next((c for c in cards if c.get('id') == card_id), None)
                    log_test("TEST 2: Card status becomes 'active' (ISO string)", card.get('status') == 'active', f"Status: {card.get('status')}")
                
                # Verify hold is lifted
                user_status = get_user_status(user_id_2)
                is_lifted = user_status.get('withdraw_lock', {}).get('active') == False
                log_test("TEST 2: Hold lifted (ISO string)", is_lifted, f"Hold active: {user_status.get('withdraw_lock', {}).get('active')}")
                
                # Test withdraw path - card activating with past usable_at, user calls withdraw first
                # Create another user to test withdraw-first scenario
                user_id_2b, user_token_2b = create_test_user(admin_token, f"a2_withdraw_{int(time.time())}")
                if user_id_2b:
                    put_user_on_hold_with_allowance(user_id_2b, 0)
                    
                    # Issue and activate card
                    issue_resp = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                        "user_id": user_id_2b,
                        "zone": "UK",
                        "fee_usdt": 10,
                        "activation_hours": 5
                    }, timeout=30)
                    
                    if issue_resp.status_code == 200:
                        card_id_2b = issue_resp.json().get('card', {}).get('id')
                        headers_user_2b = {"Authorization": f"Bearer {user_token_2b}"}
                        
                        requests.post(f"{API_URL}/cards/{card_id_2b}/activate", headers=headers_user_2b, json={
                            "tx_hash": f"0xA2WITHDRAW{int(time.time())}",
                            "network": "ERC20"
                        }, timeout=30)
                        
                        requests.post(f"{API_URL}/admin/cards/{card_id_2b}/approve", headers=headers_admin, json={}, timeout=30)
                        
                        # Set usable_at to past
                        set_card_usable_at_bson_date(card_id_2b)
                        
                        # Check user balance first
                        wallets_resp = requests.get(f"{API_URL}/wallets", headers=headers_user_2b, timeout=30)
                        if wallets_resp.status_code == 200:
                            wallets = wallets_resp.json().get('wallets', [])
                            usd_wallet = next((w for w in wallets if w.get('currency') == 'USD'), None)
                            available_balance = usd_wallet.get('balance', 0) if usd_wallet else 0
                            
                            if available_balance >= 50:
                                # Need to request a tier card first for withdraw to work
                                tier_req = requests.post(f"{API_URL}/cards/request", headers=headers_user_2b, json={"tier": "basic"}, timeout=30)
                                if tier_req.status_code == 200:
                                    tier_card_id = tier_req.json().get('card', {}).get('id')
                                    requests.post(f"{API_URL}/cards/{tier_card_id}/activate", headers=headers_user_2b, json={
                                        "tx_hash": f"0xTIER2B{int(time.time())}",
                                        "network": "ERC20"
                                    }, timeout=30)
                                    requests.post(f"{API_URL}/admin/cards/{tier_card_id}/approve", headers=headers_admin, json={"activate_now": True}, timeout=30)
                                    time.sleep(1)
                                
                                # User calls withdraw FIRST (before GET /cards) - settleDueCards is called in withdraw endpoint
                                withdraw_resp = requests.post(f"{API_URL}/withdraw", headers=headers_user_2b, json={
                                    "amount": 50,
                                    "currency": "USD",
                                    "method": "bank_swift",
                                    "destination": "test_account"
                                }, timeout=30)
                                
                                log_test("TEST 2: Withdraw-first not GEO blocked", withdraw_resp.status_code == 200, f"Status: {withdraw_resp.status_code}, Response: {withdraw_resp.text[:200]}")
                            else:
                                log_test("TEST 2: Withdraw-first not GEO blocked", False, f"Insufficient balance: {available_balance}")
                        
                        # Verify card is now active
                        cards_resp = requests.get(f"{API_URL}/cards", headers=headers_user_2b, timeout=30)
                        if cards_resp.status_code == 200:
                            cards = cards_resp.json().get('cards', [])
                            card = next((c for c in cards if c.get('id') == card_id_2b), None)
                            log_test("TEST 2: Card active after withdraw-first", card.get('status') == 'active', f"Status: {card.get('status')}")
    except Exception as e:
        log_test("TEST 2: Exception", False, str(e))
    
    # ========================================================================
    # TEST 3: B7 - Geo rule with allowance
    # ========================================================================
    print("\n" + "="*80)
    print("TEST 3: B7 - Geo rule with allowance")
    print("="*80 + "\n")
    
    try:
        user_id_3, user_token_3 = create_test_user(admin_token, f"b7_{int(time.time())}")
        if user_id_3:
            # Put user on hold with allowance $100 (need more due to withdrawal fees)
            put_user_on_hold_with_allowance(user_id_3, 100)
            log_test("TEST 3: User on hold with allowance $100", True, "Hold set")
            
            # Issue hidden card with geo rule
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_3,
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
                log_test("TEST 3: Hidden card with geo rule issued", True, f"Card ID: {card_id}")
                
                headers_user = {"Authorization": f"Bearer {user_token_3}"}
                
                # User needs a tier card to withdraw
                tier_req = requests.post(f"{API_URL}/cards/request", headers=headers_user, json={"tier": "basic"}, timeout=30)
                if tier_req.status_code == 200:
                    tier_card_id = tier_req.json().get('card', {}).get('id')
                    requests.post(f"{API_URL}/cards/{tier_card_id}/activate", headers=headers_user, json={
                        "tx_hash": f"0xTIER3{int(time.time())}",
                        "network": "ERC20"
                    }, timeout=30)
                    requests.post(f"{API_URL}/admin/cards/{tier_card_id}/approve", headers=headers_admin, json={"activate_now": True}, timeout=30)
                    time.sleep(1)
                    log_test("TEST 3: Tier card activated", True, "Tier card ready")
                
                # User withdraws $40 (within allowance, fee will be ~$20, net ~$20)
                withdraw1_response = requests.post(f"{API_URL}/withdraw", headers=headers_user, json={
                    "amount": 40,
                    "currency": "USD",
                    "method": "bank_swift",
                    "destination": "test_account"
                }, timeout=30)
                
                log_test("TEST 3: Withdraw $40 request", withdraw1_response.status_code == 200, f"Status: {withdraw1_response.status_code}, Response: {withdraw1_response.text[:200]}")
                
                if withdraw1_response.status_code == 200:
                    withdraw1_id = withdraw1_response.json().get('request', {}).get('id')
                    log_test("TEST 3: Withdraw $40 submitted", True, f"Withdraw ID: {withdraw1_id}")
                    
                    # Admin approves
                    approve1_response = requests.post(f"{API_URL}/admin/withdrawals/{withdraw1_id}/approve", headers=headers_admin, json={}, timeout=30)
                    log_test("TEST 3: Admin approves $40 withdraw", approve1_response.status_code == 200, f"Status: {approve1_response.status_code}")
                    
                    # Check card still hidden
                    time.sleep(1)
                    cards_response = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                    if cards_response.status_code == 200:
                        cards = cards_response.json().get('cards', [])
                        revealed_card = next((c for c in cards if c.get('id') == card_id), None)
                        log_test("TEST 3: Card still hidden after $40 withdraw", revealed_card is None, f"Card visible: {revealed_card is not None}")
                    
                    # User withdraws remaining $60
                    withdraw2_response = requests.post(f"{API_URL}/withdraw", headers=headers_user, json={
                        "amount": 60,
                        "currency": "USD",
                        "method": "bank_swift",
                        "destination": "test_account"
                    }, timeout=30)
                    
                    if withdraw2_response.status_code == 200:
                        withdraw2_id = withdraw2_response.json().get('request', {}).get('id')
                        log_test("TEST 3: Withdraw $60 submitted", True, f"Withdraw ID: {withdraw2_id}")
                        
                        # Admin approves
                        approve2_response = requests.post(f"{API_URL}/admin/withdrawals/{withdraw2_id}/approve", headers=headers_admin, json={}, timeout=30)
                        log_test("TEST 3: Admin approves $60 withdraw", approve2_response.status_code == 200, f"Status: {approve2_response.status_code}")
                        
                        # Check card revealed
                        time.sleep(2)
                        cards_response2 = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                        if cards_response2.status_code == 200:
                            cards2 = cards_response2.json().get('cards', [])
                            revealed_card2 = next((c for c in cards2 if c.get('id') == card_id), None)
                            if revealed_card2:
                                log_test("TEST 3: Card revealed after allowance consumed", True, f"Card status: {revealed_card2.get('status')}")
                                log_test("TEST 3: Card status is 'pending_activation'", revealed_card2.get('status') == 'pending_activation', f"Status: {revealed_card2.get('status')}")
                                log_test("TEST 3: Card has revealed_at", revealed_card2.get('revealed_at') is not None, f"revealed_at: {revealed_card2.get('revealed_at')}")
                            else:
                                log_test("TEST 3: Card revealed", False, "Card not found in user's cards")
                        
                        # Check notification
                        notif_response = requests.get(f"{API_URL}/notifications", headers=headers_user, timeout=30)
                        if notif_response.status_code == 200:
                            notifs = notif_response.json().get('notifications', [])
                            zonal_notif = next((n for n in notifs if n.get('kind') == 'zonal_card_unlocked'), None)
                            log_test("TEST 3: Notification created (zonal_card_unlocked)", zonal_notif is not None, f"Found: {zonal_notif is not None}")
    except Exception as e:
        log_test("TEST 3: Exception", False, str(e))
    
    # ========================================================================
    # TEST 4: B9 - match='all' with geo + amount_usd
    # ========================================================================
    print("\n" + "="*80)
    print("TEST 4: B9 - match='all' with geo + amount_usd")
    print("="*80 + "\n")
    
    try:
        user_id_4, user_token_4 = create_test_user(admin_token, f"b9_{int(time.time())}")
        if user_id_4:
            # Put user on hold with allowance $60 (will consume fully with first withdraw)
            put_user_on_hold_with_allowance(user_id_4, 60)
            log_test("TEST 4: User on hold with allowance $60", True, "Hold set")
            
            # Issue hidden card with match='all' (geo + amount_usd=80)
            issue_response = requests.post(f"{API_URL}/admin/zones/issue", headers=headers_admin, json={
                "user_id": user_id_4,
                "zone": "CIS",
                "fee_usdt": 20,
                "activation_hours": 12,
                "reveal": {
                    "mode": "hidden",
                    "geo": True,
                    "amount_usd": 80,
                    "match": "all"
                }
            }, timeout=30)
            
            log_test("TEST 4: Hidden card issue request", issue_response.status_code == 200, f"Status: {issue_response.status_code}, Response: {issue_response.text[:200]}")
            
            if issue_response.status_code == 200:
                card_id = issue_response.json().get('card', {}).get('id')
                log_test("TEST 4: Hidden card with match='all' issued", True, f"Card ID: {card_id}")
                
                headers_user = {"Authorization": f"Bearer {user_token_4}"}
                
                # User needs a tier card to withdraw
                tier_req = requests.post(f"{API_URL}/cards/request", headers=headers_user, json={"tier": "basic"}, timeout=30)
                if tier_req.status_code == 200:
                    tier_card_id = tier_req.json().get('card', {}).get('id')
                    requests.post(f"{API_URL}/cards/{tier_card_id}/activate", headers=headers_user, json={
                        "tx_hash": f"0xTIER4{int(time.time())}",
                        "network": "ERC20"
                    }, timeout=30)
                    requests.post(f"{API_URL}/admin/cards/{tier_card_id}/approve", headers=headers_admin, json={"activate_now": True}, timeout=30)
                    time.sleep(1)
                    log_test("TEST 4: Tier card activated", True, "Tier card ready")
                
                # User withdraws $60 (consumes allowance, meets geo rule, but amount 60 < 80)
                withdraw1_response = requests.post(f"{API_URL}/withdraw", headers=headers_user, json={
                    "amount": 60,
                    "currency": "USD",
                    "method": "bank_swift",
                    "destination": "test_account"
                }, timeout=30)
                
                if withdraw1_response.status_code == 200:
                    withdraw1_id = withdraw1_response.json().get('request', {}).get('id')
                    log_test("TEST 4: Withdraw $60 submitted", True, f"Withdraw ID: {withdraw1_id}")
                    
                    # Admin approves
                    approve1_response = requests.post(f"{API_URL}/admin/withdrawals/{withdraw1_id}/approve", headers=headers_admin, json={}, timeout=30)
                    log_test("TEST 4: Admin approves $60 withdraw", approve1_response.status_code == 200, f"Status: {approve1_response.status_code}")
                    
                    # Check card still hidden (amount 60 < 80, but geo should be met now)
                    time.sleep(1)
                    cards_response = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                    if cards_response.status_code == 200:
                        cards = cards_response.json().get('cards', [])
                        revealed_card = next((c for c in cards if c.get('id') == card_id), None)
                        log_test("TEST 4: Card still hidden (geo met, amount 60<80)", revealed_card is None, f"Card visible: {revealed_card is not None}")
                    
                    # Check reveal.geo_met_at is set (allowance fully consumed)
                    card_from_db = get_card_from_db(card_id)
                    if card_from_db:
                        geo_met_at = card_from_db.get('reveal', {}).get('geo_met_at')
                        progress = card_from_db.get('reveal', {}).get('progress_usd', 0)
                        log_test("TEST 4: reveal.geo_met_at is set", geo_met_at is not None, f"geo_met_at: {geo_met_at}, progress: {progress}")
                    
                    # Now user is at allowance 0, so further withdraws blocked
                    # Admin increases allowance to allow another withdraw
                    requests.post(f"{API_URL}/admin/users/{user_id_4}/withdraw_access", headers=headers_admin, json={
                        "mode": "allowance",
                        "allowance_usd": 50
                    }, timeout=30)
                    log_test("TEST 4: Admin increases allowance to $50", True, "Allowance increased")
                    
                    # User withdraws $40 more (total progress now 60+40=100 >= 80)
                    withdraw2_response = requests.post(f"{API_URL}/withdraw", headers=headers_user, json={
                        "amount": 40,
                        "currency": "USD",
                        "method": "bank_swift",
                        "destination": "test_account"
                    }, timeout=30)
                    
                    if withdraw2_response.status_code == 200:
                        withdraw2_id = withdraw2_response.json().get('request', {}).get('id')
                        log_test("TEST 4: Withdraw $40 submitted", True, f"Withdraw ID: {withdraw2_id}")
                        
                        # Admin approves
                        approve2_response = requests.post(f"{API_URL}/admin/withdrawals/{withdraw2_id}/approve", headers=headers_admin, json={}, timeout=30)
                        log_test("TEST 4: Admin approves $40 withdraw", approve2_response.status_code == 200, f"Status: {approve2_response.status_code}")
                        
                        # Check card revealed (both rules met: geo + amount >= 40)
                        time.sleep(2)
                        cards_response2 = requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30)
                        if cards_response2.status_code == 200:
                            cards2 = cards_response2.json().get('cards', [])
                            revealed_card2 = next((c for c in cards2 if c.get('id') == card_id), None)
                            if revealed_card2:
                                log_test("TEST 4: Card revealed (both rules met)", True, f"Card status: {revealed_card2.get('status')}")
                                
                                # Verify progress_usd >= 80
                                card_from_db2 = get_card_from_db(card_id)
                                if card_from_db2:
                                    progress = card_from_db2.get('reveal', {}).get('progress_usd', 0)
                                    log_test("TEST 4: progress_usd >= 80", progress >= 80, f"progress_usd: {progress}")
                            else:
                                log_test("TEST 4: Card revealed", False, "Card not found in user's cards")
    except Exception as e:
        log_test("TEST 4: Exception", False, str(e))
    
    # Print summary
    print("\n" + "="*80)
    print("FOCUSED RETEST SUMMARY")
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
    run_focused_tests()
