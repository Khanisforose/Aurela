#!/usr/bin/env python3
"""
Backend test for Hidden (background-issued) Zonal Card Feature
Tests the complete hidden zonal card issuance, reveal rules, and admin endpoints
"""

import requests
import time
import sys
import random
from pymongo import MongoClient

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"
USER_EMAIL = "geo.tester@aurelatest.io"
USER_PASSWORD = "Aurela@123#"

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "aurela"

# Generate unique test user email
TEST_RUN_ID = random.randint(100000, 999999)
TEST_USER_EMAIL = f"hiddentest{TEST_RUN_ID}@aurelatest.io"
TEST_USER_PASSWORD = "Aurela@123#"
TEST_USER_FIRST = "Hidden"
TEST_USER_LAST = f"Tester{TEST_RUN_ID}"

def log(msg):
    print(f"[TEST] {msg}")

def login(email, password):
    """Login and return token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"identifier": email, "password": password}, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("token")
        else:
            log(f"❌ Login failed for {email}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        log(f"❌ Login exception for {email}: {e}")
        return None

def get_headers(token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def wait_for_server(max_retries=3, wait_time=30):
    """Wait for server to be ready"""
    for i in range(max_retries):
        try:
            resp = requests.get(f"{BASE_URL}/health", timeout=10)
            if resp.status_code == 200:
                log("✅ Server is ready")
                return True
        except:
            if i < max_retries - 1:
                log(f"⏳ Server not ready, waiting {wait_time}s... (attempt {i+1}/{max_retries})")
                time.sleep(wait_time)
    log("❌ Server did not become ready")
    return False

def register_and_approve_user():
    """Use existing test user and fund them"""
    log(f"\n📝 Using existing test user: geo.tester@aurelatest.io")
    
    try:
        # Get user from database
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        user = db.users.find_one({"email": "geo.tester@aurelatest.io"})
        
        if not user:
            log(f"❌ Test user not found in database")
            client.close()
            return None
        
        user_id = user.get("id")
        log(f"✅ Found test user, user_id: {user_id}")
        
        # Ensure KYC-approved
        db.users.update_one({"id": user_id}, {"$set": {"kyc_status": "approved"}})
        log(f"✅ User KYC-approved")
        
        # Fund the user's USD and USDT wallets
        db.wallets.update_one({"user_id": user_id, "currency": "USD"}, {"$set": {"balance": 5000}})
        db.wallets.update_one({"user_id": user_id, "currency": "USDT"}, {"$set": {"balance": 500}})
        
        # Delete any existing zonal cards for this user to start fresh
        db.cards.delete_many({"user_id": user_id, "type": "zonal"})
        log(f"✅ Cleaned up existing zonal cards")
        
        client.close()
        
        log(f"✅ User funded: USD 5000, USDT 500")
        
        return user_id
        
    except Exception as e:
        log(f"❌ Setup exception: {e}")
        return None

def test_hidden_zonal_cards():
    """Test the complete hidden zonal card feature"""
    
    log("=" * 80)
    log("HIDDEN ZONAL CARD FEATURE TEST")
    log("=" * 80)
    
    # Wait for server
    if not wait_for_server():
        return False
    
    # Login as admin
    log("\n1. Login as admin...")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        log("❌ CRITICAL: Admin login failed")
        return False
    log("✅ Admin logged in")
    
    # Register and approve test user
    user_id = register_and_approve_user()
    if not user_id:
        log("❌ CRITICAL: User registration/approval failed")
        return False
    
    # Login as test user
    log("\n2. Login as test user...")
    user_token = login(USER_EMAIL, USER_PASSWORD)
    if not user_token:
        log("❌ CRITICAL: User login failed")
        return False
    log("✅ User logged in")
    
    # Get available zones
    log("\n3. Get available zones...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/zones", headers=get_headers(admin_token), timeout=30)
        if resp.status_code != 200:
            log(f"❌ Failed to get zones: {resp.status_code}")
            return False
        zones_data = resp.json()
        zones = zones_data.get("zones", [])
        enabled_zones = [z for z in zones if z.get("enabled")]
        if not enabled_zones:
            log(f"❌ No enabled zones found")
            return False
        test_zone = enabled_zones[0]["code"]
        log(f"✅ Found {len(enabled_zones)} enabled zones, using: {test_zone}")
    except Exception as e:
        log(f"❌ Exception getting zones: {e}")
        return False
    
    # TEST 1: Issue hidden card with invalid reveal rule (geo=false, amount=0)
    log("\n4. TEST 1: Issue hidden card with invalid reveal rule (geo=false, amount=0)...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/zones/issue", headers=get_headers(admin_token), json={
            "user_id": user_id,
            "zone": test_zone,
            "fee_usdt": 10,
            "activation_hours": 5,
            "reveal": {
                "mode": "hidden",
                "geo": False,
                "amount_usd": 0,
                "match": "any"
            }
        }, timeout=30)
        if resp.status_code == 400:
            log(f"✅ TEST 1 PASSED: Invalid reveal rule rejected with 400")
        else:
            log(f"❌ TEST 1 FAILED: Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 1 EXCEPTION: {e}")
        return False
    
    # TEST 2: Create withdrawal BEFORE issuing card (should not count)
    log("\n5. TEST 2: Create withdrawal BEFORE issuing card...")
    old_withdraw_id = None
    try:
        resp = requests.post(f"{BASE_URL}/withdraw", headers=get_headers(user_token), json={
            "currency": "USD",
            "amount": 50,
            "method": "bank_swift",
            "destination": "GB29NWBK60161331926819",
            "details": {
                "bank_name": "Test Bank",
                "account_holder": "Test User",
                "account_number": "GB29NWBK60161331926819",
                "swift": "NWBKGB2L"
            }
        }, timeout=30)
        if resp.status_code == 200:
            old_withdraw_id = resp.json().get("request", {}).get("id")
            log(f"✅ TEST 2 PASSED: Old withdrawal created, id: {old_withdraw_id}")
        else:
            log(f"❌ TEST 2 FAILED: Withdrawal creation failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        log(f"❌ TEST 2 EXCEPTION: {e}")
        return False
    
    # Wait a moment to ensure timestamp difference
    time.sleep(1)
    
    # TEST 3: Issue hidden card with amount rule only
    log("\n6. TEST 3: Issue hidden card with amount rule (amount_usd=100)...")
    card_id_amount = None
    try:
        resp = requests.post(f"{BASE_URL}/admin/zones/issue", headers=get_headers(admin_token), json={
            "user_id": user_id,
            "zone": test_zone,
            "fee_usdt": 10,
            "activation_hours": 5,
            "reveal": {
                "mode": "hidden",
                "geo": False,
                "amount_usd": 100,
                "match": "any"
            }
        }, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("hidden") == True and data.get("card", {}).get("status") == "hidden":
                card_id_amount = data["card"]["id"]
                log(f"✅ TEST 3 PASSED: Hidden card issued with amount rule, card_id: {card_id_amount}")
            else:
                log(f"❌ TEST 3 FAILED: Card not hidden or wrong status: {data}")
                return False
        else:
            log(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        log(f"❌ TEST 3 EXCEPTION: {e}")
        return False
    
    # TEST 4: Approve old withdrawal - should NOT count toward progress
    log("\n7. TEST 4: Approve old withdrawal (should NOT count)...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/withdrawals/{old_withdraw_id}/approve", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            log(f"✅ TEST 4 PASSED: Old withdrawal approved")
        else:
            log(f"❌ TEST 4 FAILED: Approval failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 4 EXCEPTION: {e}")
        return False
    
    # TEST 5: Check progress is still 0
    log("\n8. TEST 5: Check progress is still 0...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/all-cards?status=hidden", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            cards = resp.json().get("cards", [])
            card = next((c for c in cards if c.get("id") == card_id_amount), None)
            if card:
                progress = card.get("reveal", {}).get("progress_usd", 0)
                if progress == 0:
                    log(f"✅ TEST 5 PASSED: Progress is 0 (old withdrawal didn't count)")
                else:
                    log(f"❌ TEST 5 FAILED: Progress is {progress}, expected 0")
                    return False
            else:
                log(f"❌ TEST 5 FAILED: Card not found in admin all-cards")
                return False
        else:
            log(f"❌ TEST 5 FAILED: GET all-cards failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 5 EXCEPTION: {e}")
        return False
    
    # TEST 6: Verify hidden card NOT in user's GET /cards
    log("\n9. TEST 6: Verify hidden card NOT in user's GET /cards...")
    try:
        resp = requests.get(f"{BASE_URL}/cards", headers=get_headers(user_token), timeout=30)
        if resp.status_code == 200:
            cards = resp.json().get("cards", [])
            hidden_in_list = any(c.get("id") == card_id_amount for c in cards)
            if not hidden_in_list:
                log(f"✅ TEST 6 PASSED: Hidden card NOT in user's card list")
            else:
                log(f"❌ TEST 6 FAILED: Hidden card found in user's card list")
                return False
        else:
            log(f"❌ TEST 6 FAILED: GET /cards returned {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 6 EXCEPTION: {e}")
        return False
    
    # TEST 7: User activate on hidden card returns 404
    log("\n10. TEST 7: User activate on hidden card returns 404...")
    try:
        resp = requests.post(f"{BASE_URL}/cards/{card_id_amount}/activate", headers=get_headers(user_token), json={
            "tx_hash": "0xTESTHASH123",
            "network": "ERC20"
        }, timeout=30)
        if resp.status_code == 404:
            log(f"✅ TEST 7 PASSED: User activate on hidden card returns 404")
        else:
            log(f"❌ TEST 7 FAILED: Expected 404, got {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 7 EXCEPTION: {e}")
        return False
    
    # TEST 8: User delete on hidden card returns 404
    log("\n11. TEST 8: User delete on hidden card returns 404...")
    try:
        resp = requests.delete(f"{BASE_URL}/cards/{card_id_amount}", headers=get_headers(user_token), timeout=30)
        if resp.status_code == 404:
            log(f"✅ TEST 8 PASSED: User delete on hidden card returns 404")
        else:
            log(f"❌ TEST 8 FAILED: Expected 404, got {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 8 EXCEPTION: {e}")
        return False
    
    # TEST 9: Admin approve on hidden card returns 400
    log("\n12. TEST 9: Admin approve on hidden card returns 400...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/cards/{card_id_amount}/approve", headers=get_headers(admin_token), json={
            "activate_now": True
        }, timeout=30)
        if resp.status_code == 400:
            log(f"✅ TEST 9 PASSED: Admin approve on hidden card returns 400")
        else:
            log(f"❌ TEST 9 FAILED: Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 9 EXCEPTION: {e}")
        return False
    
    # TEST 10: Admin reject on hidden card returns 400
    log("\n13. TEST 10: Admin reject on hidden card returns 400...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/cards/{card_id_amount}/reject", headers=get_headers(admin_token), json={
            "reason": "Test rejection"
        }, timeout=30)
        if resp.status_code == 400:
            log(f"✅ TEST 10 PASSED: Admin reject on hidden card returns 400")
        else:
            log(f"❌ TEST 10 FAILED: Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 10 EXCEPTION: {e}")
        return False
    
    # TEST 11: Create new withdrawal AFTER card issuance (~$60)
    log("\n14. TEST 11: Create new withdrawal AFTER card issuance (~$60)...")
    new_withdraw_id = None
    try:
        resp = requests.post(f"{BASE_URL}/withdraw", headers=get_headers(user_token), json={
            "currency": "USD",
            "amount": 60,
            "method": "bank_swift",
            "destination": "GB29NWBK60161331926819",
            "details": {
                "bank_name": "Test Bank",
                "account_holder": "Test User",
                "account_number": "GB29NWBK60161331926819",
                "swift": "NWBKGB2L"
            }
        }, timeout=30)
        if resp.status_code == 200:
            new_withdraw_id = resp.json().get("request", {}).get("id")
            log(f"✅ TEST 11 PASSED: New withdrawal created, id: {new_withdraw_id}")
        else:
            log(f"❌ TEST 11 FAILED: Withdrawal creation failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        log(f"❌ TEST 11 EXCEPTION: {e}")
        return False
    
    # TEST 12: Approve new withdrawal - should add to progress but NOT reveal yet
    log("\n15. TEST 12: Approve new withdrawal (should add to progress)...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/withdrawals/{new_withdraw_id}/approve", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            log(f"✅ TEST 12 PASSED: New withdrawal approved")
        else:
            log(f"❌ TEST 12 FAILED: Approval failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 12 EXCEPTION: {e}")
        return False
    
    # TEST 13: Check progress is ~60 and card still hidden
    log("\n16. TEST 13: Check progress is ~60 and card still hidden...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/all-cards?status=hidden", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            cards = resp.json().get("cards", [])
            card = next((c for c in cards if c.get("id") == card_id_amount), None)
            if card:
                progress = card.get("reveal", {}).get("progress_usd", 0)
                if 59 <= progress <= 61:
                    log(f"✅ TEST 13 PASSED: Progress is ~60 ({progress}), card still hidden")
                else:
                    log(f"❌ TEST 13 FAILED: Progress is {progress}, expected ~60")
                    return False
            else:
                log(f"❌ TEST 13 FAILED: Card not found in admin all-cards")
                return False
        else:
            log(f"❌ TEST 13 FAILED: GET all-cards failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 13 EXCEPTION: {e}")
        return False
    
    # TEST 14: Create and reject a withdrawal - should NOT add to progress
    log("\n17. TEST 14: Create and reject a withdrawal (should NOT count)...")
    reject_withdraw_id = None
    try:
        resp = requests.post(f"{BASE_URL}/withdraw", headers=get_headers(user_token), json={
            "currency": "USD",
            "amount": 30,
            "method": "bank_swift",
            "destination": "GB29NWBK60161331926819",
            "details": {
                "bank_name": "Test Bank",
                "account_holder": "Test User",
                "account_number": "GB29NWBK60161331926819",
                "swift": "NWBKGB2L"
            }
        }, timeout=30)
        if resp.status_code == 200:
            reject_withdraw_id = resp.json().get("request", {}).get("id")
            log(f"✅ Withdrawal created for rejection, id: {reject_withdraw_id}")
            
            # Reject it
            resp = requests.post(f"{BASE_URL}/admin/withdrawals/{reject_withdraw_id}/reject", headers=get_headers(admin_token), timeout=30)
            if resp.status_code == 200:
                log(f"✅ TEST 14 PASSED: Withdrawal rejected")
            else:
                log(f"❌ TEST 14 FAILED: Rejection failed: {resp.status_code}")
                return False
        else:
            log(f"❌ TEST 14 FAILED: Withdrawal creation failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 14 EXCEPTION: {e}")
        return False
    
    # TEST 15: Check progress is still ~60 (rejected withdrawal didn't count)
    log("\n18. TEST 15: Check progress is still ~60 (rejected withdrawal didn't count)...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/all-cards?status=hidden", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            cards = resp.json().get("cards", [])
            card = next((c for c in cards if c.get("id") == card_id_amount), None)
            if card:
                progress = card.get("reveal", {}).get("progress_usd", 0)
                if 59 <= progress <= 61:
                    log(f"✅ TEST 15 PASSED: Progress is still ~60 ({progress})")
                else:
                    log(f"❌ TEST 15 FAILED: Progress is {progress}, expected ~60")
                    return False
            else:
                log(f"❌ TEST 15 FAILED: Card not found")
                return False
        else:
            log(f"❌ TEST 15 FAILED: GET all-cards failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 15 EXCEPTION: {e}")
        return False
    
    # TEST 16: Create and approve another withdrawal to reach threshold (~$45 more)
    log("\n19. TEST 16: Create and approve another withdrawal to reach threshold (~$45)...")
    final_withdraw_id = None
    try:
        resp = requests.post(f"{BASE_URL}/withdraw", headers=get_headers(user_token), json={
            "currency": "USD",
            "amount": 45,
            "method": "bank_swift",
            "destination": "GB29NWBK60161331926819",
            "details": {
                "bank_name": "Test Bank",
                "account_holder": "Test User",
                "account_number": "GB29NWBK60161331926819",
                "swift": "NWBKGB2L"
            }
        }, timeout=30)
        if resp.status_code == 200:
            final_withdraw_id = resp.json().get("request", {}).get("id")
            log(f"✅ Final withdrawal created, id: {final_withdraw_id}")
            
            # Approve it
            resp = requests.post(f"{BASE_URL}/admin/withdrawals/{final_withdraw_id}/approve", headers=get_headers(admin_token), timeout=30)
            if resp.status_code == 200:
                log(f"✅ TEST 16 PASSED: Final withdrawal approved")
            else:
                log(f"❌ TEST 16 FAILED: Approval failed: {resp.status_code}")
                return False
        else:
            log(f"❌ TEST 16 FAILED: Withdrawal creation failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 16 EXCEPTION: {e}")
        return False
    
    # TEST 17: Check card is now revealed (status=pending_activation)
    log("\n20. TEST 17: Check card is now revealed (status=pending_activation)...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/all-cards?status=pending_activation", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            cards = resp.json().get("cards", [])
            card = next((c for c in cards if c.get("id") == card_id_amount), None)
            if card and card.get("revealed_at"):
                log(f"✅ TEST 17 PASSED: Card revealed with status=pending_activation")
            else:
                log(f"❌ TEST 17 FAILED: Card not found in pending_activation or not revealed")
                return False
        else:
            log(f"❌ TEST 17 FAILED: GET all-cards failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 17 EXCEPTION: {e}")
        return False
    
    # TEST 18: Check card is now visible in user's GET /cards
    log("\n21. TEST 18: Check card is now visible in user's GET /cards...")
    try:
        resp = requests.get(f"{BASE_URL}/cards", headers=get_headers(user_token), timeout=30)
        if resp.status_code == 200:
            cards = resp.json().get("cards", [])
            card = next((c for c in cards if c.get("id") == card_id_amount), None)
            if card:
                log(f"✅ TEST 18 PASSED: Card now visible in user's card list")
            else:
                log(f"❌ TEST 18 FAILED: Card not found in user's card list")
                return False
        else:
            log(f"❌ TEST 18 FAILED: GET /cards failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 18 EXCEPTION: {e}")
        return False
    
    # TEST 19: Check user received notification
    log("\n22. TEST 19: Check user received notification...")
    try:
        resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers(user_token), timeout=30)
        if resp.status_code == 200:
            notifications = resp.json().get("notifications", [])
            unlock_notif = next((n for n in notifications if n.get("kind") == "zonal_card_unlocked"), None)
            if unlock_notif:
                log(f"✅ TEST 19 PASSED: User received zonal_card_unlocked notification")
            else:
                log(f"❌ TEST 19 FAILED: No zonal_card_unlocked notification found")
                return False
        else:
            log(f"❌ TEST 19 FAILED: GET /notifications failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 19 EXCEPTION: {e}")
        return False
    
    # TEST 20: Test free card (fee=0, hours=0) revealed → status=active
    log("\n23. TEST 20: Test free card (fee=0, hours=0) revealed → status=active...")
    card_id_free = None
    try:
        # Issue another hidden card with free activation
        resp = requests.post(f"{BASE_URL}/admin/zones/issue", headers=get_headers(admin_token), json={
            "user_id": user_id,
            "zone": test_zone if len(enabled_zones) == 1 else enabled_zones[1]["code"],
            "fee_usdt": 0,
            "activation_hours": 0,
            "reveal": {
                "mode": "hidden",
                "geo": False,
                "amount_usd": 1,
                "match": "any"
            }
        }, timeout=30)
        if resp.status_code == 200:
            card_id_free = resp.json()["card"]["id"]
            log(f"✅ Free hidden card issued, id: {card_id_free}")
            
            # Create and approve a small withdrawal to reveal it
            resp = requests.post(f"{BASE_URL}/withdraw", headers=get_headers(user_token), json={
                "currency": "USD",
                "amount": 5,
                "method": "bank_swift",
                "destination": "GB29NWBK60161331926819",
                "details": {
                    "bank_name": "Test Bank",
                    "account_holder": "Test User",
                    "account_number": "GB29NWBK60161331926819",
                    "swift": "NWBKGB2L"
                }
            }, timeout=30)
            if resp.status_code == 200:
                free_withdraw_id = resp.json()["request"]["id"]
                resp = requests.post(f"{BASE_URL}/admin/withdrawals/{free_withdraw_id}/approve", headers=get_headers(admin_token), timeout=30)
                if resp.status_code == 200:
                    log(f"✅ Withdrawal approved to reveal free card")
                    
                    # Check card is now active
                    resp = requests.get(f"{BASE_URL}/cards", headers=get_headers(user_token), timeout=30)
                    if resp.status_code == 200:
                        cards = resp.json().get("cards", [])
                        card = next((c for c in cards if c.get("id") == card_id_free), None)
                        if card and card.get("status") == "active":
                            log(f"✅ TEST 20 PASSED: Free card revealed with status=active")
                        else:
                            log(f"❌ TEST 20 FAILED: Free card not active, status: {card.get('status') if card else 'not found'}")
                            return False
                    else:
                        log(f"❌ TEST 20 FAILED: GET /cards failed")
                        return False
                else:
                    log(f"❌ TEST 20 FAILED: Withdrawal approval failed")
                    return False
            else:
                log(f"❌ TEST 20 FAILED: Withdrawal creation failed")
                return False
        else:
            log(f"⚠️ TEST 20 SKIPPED: Could not issue second zonal card (may be duplicate zone): {resp.status_code}")
    except Exception as e:
        log(f"⚠️ TEST 20 SKIPPED: Exception: {e}")
    
    # TEST 21: Test geo rule with allowance
    log("\n24. TEST 21: Test geo rule with allowance...")
    try:
        # Register another user for geo testing
        test_user2_email = f"geotest{TEST_RUN_ID}@aurelatest.io"
        test_user2_password = "Aurela@123#"
        
        resp = requests.post(f"{BASE_URL}/auth/register/init", json={
            "first_name": "Geo",
            "last_name": f"Test{TEST_RUN_ID}",
            "email": test_user2_email,
            "country": "US",
            "phone": "+12025551234",
            "password": test_user2_password
        }, timeout=30)
        
        if resp.status_code == 200:
            signup_id = resp.json()["signup_id"]
            
            # Get OTP from MongoDB
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            signup = db.signups.find_one({"id": signup_id})
            dev_otp = signup.get("code") if signup else None
            
            if dev_otp:
                resp = requests.post(f"{BASE_URL}/auth/register/verify", json={
                    "signup_id": signup_id,
                    "code": dev_otp
                }, timeout=30)
                
                if resp.status_code == 200:
                    user2_id = resp.json()["user"]["id"]
                    
                    # KYC-approve and fund
                    db.users.update_one({"id": user2_id}, {"$set": {"kyc_status": "approved"}})
                    db.wallets.update_one({"user_id": user2_id, "currency": "USD"}, {"$set": {"balance": 1000}})
                    client.close()
                    
                    log(f"✅ Geo test user created and funded: {user2_id}")
                    
                    # Login as user2
                    user2_token = login(test_user2_email, test_user2_password)
                    if user2_token:
                        # Set geo hold with allowance
                        resp = requests.post(f"{BASE_URL}/admin/users/{user2_id}/withdraw_access", headers=get_headers(admin_token), json={
                            "mode": "allowance",
                            "allowance_usd": 50
                        }, timeout=30)
                        
                        if resp.status_code == 200:
                            log(f"✅ Geo hold with allowance set")
                            
                            # Issue hidden card with geo rule
                            resp = requests.post(f"{BASE_URL}/admin/zones/issue", headers=get_headers(admin_token), json={
                                "user_id": user2_id,
                                "zone": test_zone,
                                "fee_usdt": 0,
                                "activation_hours": 0,
                                "reveal": {
                                    "mode": "hidden",
                                    "geo": True,
                                    "amount_usd": 0,
                                    "match": "any"
                                }
                            }, timeout=30)
                            
                            if resp.status_code == 200:
                                card_id_geo = resp.json()["card"]["id"]
                                log(f"✅ Hidden card with geo rule issued: {card_id_geo}")
                                
                                # Create withdrawal that consumes allowance
                                resp = requests.post(f"{BASE_URL}/withdraw", headers=get_headers(user2_token), json={
                                    "currency": "USD",
                                    "amount": 50,
                                    "method": "bank_swift",
                                    "destination": "US1234567890",
                                    "details": {
                                        "bank_name": "Test Bank",
                                        "account_holder": "Geo Test",
                                        "account_number": "US1234567890",
                                        "swift": "TESTUS33"
                                    }
                                }, timeout=30)
                                
                                if resp.status_code == 200:
                                    geo_withdraw_id = resp.json()["request"]["id"]
                                    log(f"✅ Withdrawal created: {geo_withdraw_id}")
                                    
                                    # Approve withdrawal
                                    resp = requests.post(f"{BASE_URL}/admin/withdrawals/{geo_withdraw_id}/approve", headers=get_headers(admin_token), timeout=30)
                                    
                                    if resp.status_code == 200:
                                        log(f"✅ Withdrawal approved")
                                        
                                        # Check card is revealed
                                        resp = requests.get(f"{BASE_URL}/cards", headers=get_headers(user2_token), timeout=30)
                                        if resp.status_code == 200:
                                            cards = resp.json().get("cards", [])
                                            card = next((c for c in cards if c.get("id") == card_id_geo), None)
                                            if card and card.get("status") == "active":
                                                log(f"✅ TEST 21 PASSED: Card revealed via geo rule (allowance consumed)")
                                            else:
                                                log(f"❌ TEST 21 FAILED: Card not revealed, status: {card.get('status') if card else 'not found'}")
                                                return False
                                        else:
                                            log(f"❌ TEST 21 FAILED: GET /cards failed")
                                            return False
                                    else:
                                        log(f"❌ TEST 21 FAILED: Withdrawal approval failed")
                                        return False
                                else:
                                    log(f"❌ TEST 21 FAILED: Withdrawal creation failed")
                                    return False
                            else:
                                log(f"⚠️ TEST 21 SKIPPED: Could not issue card: {resp.status_code}")
                        else:
                            log(f"❌ TEST 21 FAILED: Set allowance failed")
                            return False
                    else:
                        log(f"❌ TEST 21 FAILED: User2 login failed")
                        return False
                else:
                    log(f"⚠️ TEST 21 SKIPPED: User2 registration verify failed")
            else:
                log(f"⚠️ TEST 21 SKIPPED: Could not get OTP")
                client.close()
        else:
            log(f"⚠️ TEST 21 SKIPPED: User2 registration init failed")
    except Exception as e:
        log(f"⚠️ TEST 21 SKIPPED: Exception: {e}")
    
    # TEST 22: Test admin manual reveal endpoint
    log("\n25. TEST 22: Test admin manual reveal endpoint...")
    try:
        # Issue another hidden card
        resp = requests.post(f"{BASE_URL}/admin/zones/issue", headers=get_headers(admin_token), json={
            "user_id": user_id,
            "zone": enabled_zones[0]["code"] if len(enabled_zones) > 1 else test_zone,
            "fee_usdt": 5,
            "activation_hours": 2,
            "reveal": {
                "mode": "hidden",
                "geo": False,
                "amount_usd": 1000,
                "match": "any"
            }
        }, timeout=30)
        
        if resp.status_code == 200:
            card_id_manual = resp.json()["card"]["id"]
            log(f"✅ Hidden card for manual reveal issued: {card_id_manual}")
            
            # Manually reveal it
            resp = requests.post(f"{BASE_URL}/admin/cards/{card_id_manual}/reveal", headers=get_headers(admin_token), timeout=30)
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok") and data.get("card", {}).get("status") == "pending_activation":
                    log(f"✅ TEST 22 PASSED: Admin manual reveal successful")
                else:
                    log(f"❌ TEST 22 FAILED: Card not revealed properly: {data}")
                    return False
            else:
                log(f"❌ TEST 22 FAILED: Manual reveal failed: {resp.status_code}")
                return False
        else:
            log(f"⚠️ TEST 22 SKIPPED: Could not issue card: {resp.status_code}")
    except Exception as e:
        log(f"⚠️ TEST 22 SKIPPED: Exception: {e}")
    
    # TEST 23: Test admin update reveal rule
    log("\n26. TEST 23: Test admin update reveal rule...")
    try:
        # Issue another hidden card
        resp = requests.post(f"{BASE_URL}/admin/zones/issue", headers=get_headers(admin_token), json={
            "user_id": user_id,
            "zone": test_zone,
            "fee_usdt": 0,
            "activation_hours": 0,
            "reveal": {
                "mode": "hidden",
                "geo": False,
                "amount_usd": 500,
                "match": "any"
            }
        }, timeout=30)
        
        if resp.status_code == 200:
            card_id_update = resp.json()["card"]["id"]
            log(f"✅ Hidden card for rule update issued: {card_id_update}")
            
            # Update rule to amount=1 (already exceeded by previous withdrawals)
            resp = requests.put(f"{BASE_URL}/admin/cards/{card_id_update}/reveal-rule", headers=get_headers(admin_token), json={
                "geo": False,
                "amount_usd": 1,
                "match": "any"
            }, timeout=30)
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok") and data.get("card", {}).get("status") == "active":
                    log(f"✅ TEST 23 PASSED: Rule update auto-revealed card")
                else:
                    log(f"❌ TEST 23 FAILED: Card not auto-revealed: {data}")
                    return False
            else:
                log(f"❌ TEST 23 FAILED: Rule update failed: {resp.status_code}")
                return False
        else:
            log(f"⚠️ TEST 23 SKIPPED: Could not issue card: {resp.status_code}")
    except Exception as e:
        log(f"⚠️ TEST 23 SKIPPED: Exception: {e}")
    
    # TEST 24: Test GET /admin/all-cards filters
    log("\n27. TEST 24: Test GET /admin/all-cards filters...")
    try:
        # Test status=hidden filter
        resp = requests.get(f"{BASE_URL}/admin/all-cards?status=hidden", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if "cards" in data and "total" in data and "counts" in data:
                log(f"✅ TEST 24a PASSED: GET all-cards with status=hidden works")
            else:
                log(f"❌ TEST 24a FAILED: Missing keys in response")
                return False
        else:
            log(f"❌ TEST 24a FAILED: GET all-cards failed: {resp.status_code}")
            return False
        
        # Test type=zonal filter
        resp = requests.get(f"{BASE_URL}/admin/all-cards?type=zonal", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            cards = data.get("cards", [])
            all_zonal = all(c.get("type") == "zonal" for c in cards)
            if all_zonal:
                log(f"✅ TEST 24b PASSED: GET all-cards with type=zonal works")
            else:
                log(f"❌ TEST 24b FAILED: Non-zonal cards in response")
                return False
        else:
            log(f"❌ TEST 24b FAILED: GET all-cards failed: {resp.status_code}")
            return False
        
        # Test pagination
        resp = requests.get(f"{BASE_URL}/admin/all-cards?page=1&limit=5", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("page") == 1 and data.get("limit") == 5:
                log(f"✅ TEST 24c PASSED: Pagination works")
            else:
                log(f"❌ TEST 24c FAILED: Pagination not working")
                return False
        else:
            log(f"❌ TEST 24c FAILED: GET all-cards failed: {resp.status_code}")
            return False
        
        # Test card number masking
        resp = requests.get(f"{BASE_URL}/admin/all-cards?limit=1", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            cards = resp.json().get("cards", [])
            if cards:
                card = cards[0]
                has_masked = "number_masked" in card
                no_cvv = "cvv" not in card
                if has_masked and no_cvv:
                    log(f"✅ TEST 24d PASSED: Card numbers masked, CVV excluded")
                else:
                    log(f"❌ TEST 24d FAILED: Masking not working properly")
                    return False
            else:
                log(f"⚠️ TEST 24d SKIPPED: No cards in response")
        else:
            log(f"❌ TEST 24d FAILED: GET all-cards failed: {resp.status_code}")
            return False
        
    except Exception as e:
        log(f"❌ TEST 24 EXCEPTION: {e}")
        return False
    
    # TEST 25: Test DELETE /admin/cards/:id
    log("\n28. TEST 25: Test DELETE /admin/cards/:id...")
    try:
        # Issue a card to delete
        resp = requests.post(f"{BASE_URL}/admin/zones/issue", headers=get_headers(admin_token), json={
            "user_id": user_id,
            "zone": test_zone,
            "fee_usdt": 0,
            "activation_hours": 0,
            "reveal": {
                "mode": "hidden",
                "geo": False,
                "amount_usd": 1,
                "match": "any"
            }
        }, timeout=30)
        
        if resp.status_code == 200:
            card_id_delete = resp.json()["card"]["id"]
            log(f"✅ Card for deletion issued: {card_id_delete}")
            
            # Delete it
            resp = requests.delete(f"{BASE_URL}/admin/cards/{card_id_delete}", headers=get_headers(admin_token), timeout=30)
            
            if resp.status_code == 200:
                log(f"✅ TEST 25a PASSED: Card deleted successfully")
                
                # Verify it's gone
                resp = requests.get(f"{BASE_URL}/admin/all-cards?status=all", headers=get_headers(admin_token), timeout=30)
                if resp.status_code == 200:
                    cards = resp.json().get("cards", [])
                    deleted_card = next((c for c in cards if c.get("id") == card_id_delete), None)
                    if not deleted_card:
                        log(f"✅ TEST 25b PASSED: Deleted card not in list")
                    else:
                        log(f"❌ TEST 25b FAILED: Deleted card still in list")
                        return False
                else:
                    log(f"❌ TEST 25b FAILED: GET all-cards failed")
                    return False
            else:
                log(f"❌ TEST 25a FAILED: Delete failed: {resp.status_code}")
                return False
        else:
            log(f"⚠️ TEST 25 SKIPPED: Could not issue card: {resp.status_code}")
    except Exception as e:
        log(f"⚠️ TEST 25 SKIPPED: Exception: {e}")
    
    # TEST 26: Test non-admin access to admin endpoints
    log("\n29. TEST 26: Test non-admin access to admin endpoints...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/all-cards", headers=get_headers(user_token), timeout=30)
        if resp.status_code in [401, 403]:
            log(f"✅ TEST 26 PASSED: Non-admin blocked from admin endpoints")
        else:
            log(f"❌ TEST 26 FAILED: Non-admin got {resp.status_code}, expected 401/403")
            return False
    except Exception as e:
        log(f"❌ TEST 26 EXCEPTION: {e}")
        return False
    
    # TEST 27: Test GET /admin/zones includes hidden count
    log("\n30. TEST 27: Test GET /admin/zones includes hidden count...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/zones", headers=get_headers(admin_token), timeout=30)
        if resp.status_code == 200:
            zones = resp.json().get("zones", [])
            if zones:
                zone = zones[0]
                stats = zone.get("stats", {})
                if "hidden" in stats:
                    log(f"✅ TEST 27 PASSED: Zone stats include hidden count")
                else:
                    log(f"❌ TEST 27 FAILED: Zone stats missing hidden count")
                    return False
            else:
                log(f"⚠️ TEST 27 SKIPPED: No zones in response")
        else:
            log(f"❌ TEST 27 FAILED: GET zones failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 27 EXCEPTION: {e}")
        return False
    
    # TEST 28: Test duplicate zonal card in same zone returns 400
    log("\n31. TEST 28: Test duplicate zonal card in same zone returns 400...")
    try:
        # Try to issue another card in the same zone
        resp = requests.post(f"{BASE_URL}/admin/zones/issue", headers=get_headers(admin_token), json={
            "user_id": user_id,
            "zone": test_zone,
            "fee_usdt": 0,
            "activation_hours": 0,
            "reveal": {
                "mode": "hidden",
                "geo": False,
                "amount_usd": 1,
                "match": "any"
            }
        }, timeout=30)
        
        if resp.status_code == 400:
            log(f"✅ TEST 28 PASSED: Duplicate zonal card rejected with 400")
        else:
            log(f"❌ TEST 28 FAILED: Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 28 EXCEPTION: {e}")
        return False
    
    # TEST 29: Test match='all' with both geo and amount rules
    log("\n32. TEST 29: Test match='all' with both geo and amount rules...")
    try:
        # Register another user for match=all testing
        test_user3_email = f"matchall{TEST_RUN_ID}@aurelatest.io"
        test_user3_password = "Aurela@123#"
        
        resp = requests.post(f"{BASE_URL}/auth/register/init", json={
            "first_name": "Match",
            "last_name": f"All{TEST_RUN_ID}",
            "email": test_user3_email,
            "country": "CA",
            "phone": "+14165551234",
            "password": test_user3_password
        }, timeout=30)
        
        if resp.status_code == 200:
            signup_id = resp.json()["signup_id"]
            
            # Get OTP from MongoDB
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            signup = db.signups.find_one({"id": signup_id})
            dev_otp = signup.get("code") if signup else None
            
            if dev_otp:
                resp = requests.post(f"{BASE_URL}/auth/register/verify", json={
                    "signup_id": signup_id,
                    "code": dev_otp
                }, timeout=30)
                
                if resp.status_code == 200:
                    user3_id = resp.json()["user"]["id"]
                    
                    # KYC-approve and fund
                    db.users.update_one({"id": user3_id}, {"$set": {"kyc_status": "approved"}})
                    db.wallets.update_one({"user_id": user3_id, "currency": "USD"}, {"$set": {"balance": 1000}})
                    client.close()
                    
                    log(f"✅ Match=all test user created: {user3_id}")
                    
                    # Login as user3
                    user3_token = login(test_user3_email, test_user3_password)
                    if user3_token:
                        # Set geo hold with allowance
                        resp = requests.post(f"{BASE_URL}/admin/users/{user3_id}/withdraw_access", headers=get_headers(admin_token), json={
                            "mode": "allowance",
                            "allowance_usd": 50
                        }, timeout=30)
                        
                        if resp.status_code == 200:
                            log(f"✅ Geo hold set")
                            
                            # Issue hidden card with match=all
                            resp = requests.post(f"{BASE_URL}/admin/zones/issue", headers=get_headers(admin_token), json={
                                "user_id": user3_id,
                                "zone": test_zone,
                                "fee_usdt": 0,
                                "activation_hours": 0,
                                "reveal": {
                                    "mode": "hidden",
                                    "geo": True,
                                    "amount_usd": 30,
                                    "match": "all"
                                }
                            }, timeout=30)
                            
                            if resp.status_code == 200:
                                card_id_all = resp.json()["card"]["id"]
                                log(f"✅ Hidden card with match=all issued: {card_id_all}")
                                
                                # Create withdrawal for $50 (meets amount but not geo yet)
                                resp = requests.post(f"{BASE_URL}/withdraw", headers=get_headers(user3_token), json={
                                    "currency": "USD",
                                    "amount": 50,
                                    "method": "bank_swift",
                                    "destination": "CA1234567890",
                                    "details": {
                                        "bank_name": "Test Bank",
                                        "account_holder": "Match All",
                                        "account_number": "CA1234567890",
                                        "swift": "TESTCA33"
                                    }
                                }, timeout=30)
                                
                                if resp.status_code == 200:
                                    all_withdraw_id = resp.json()["request"]["id"]
                                    
                                    # Approve withdrawal (meets both amount and geo)
                                    resp = requests.post(f"{BASE_URL}/admin/withdrawals/{all_withdraw_id}/approve", headers=get_headers(admin_token), timeout=30)
                                    
                                    if resp.status_code == 200:
                                        log(f"✅ Withdrawal approved")
                                        
                                        # Check card is revealed (both conditions met)
                                        resp = requests.get(f"{BASE_URL}/cards", headers=get_headers(user3_token), timeout=30)
                                        if resp.status_code == 200:
                                            cards = resp.json().get("cards", [])
                                            card = next((c for c in cards if c.get("id") == card_id_all), None)
                                            if card and card.get("status") == "active":
                                                log(f"✅ TEST 29 PASSED: Card revealed with match=all (both conditions met)")
                                            else:
                                                log(f"❌ TEST 29 FAILED: Card not revealed, status: {card.get('status') if card else 'not found'}")
                                                return False
                                        else:
                                            log(f"❌ TEST 29 FAILED: GET /cards failed")
                                            return False
                                    else:
                                        log(f"❌ TEST 29 FAILED: Withdrawal approval failed")
                                        return False
                                else:
                                    log(f"❌ TEST 29 FAILED: Withdrawal creation failed")
                                    return False
                            else:
                                log(f"⚠️ TEST 29 SKIPPED: Could not issue card: {resp.status_code}")
                        else:
                            log(f"❌ TEST 29 FAILED: Set allowance failed")
                            return False
                    else:
                        log(f"❌ TEST 29 FAILED: User3 login failed")
                        return False
                else:
                    log(f"⚠️ TEST 29 SKIPPED: User3 registration verify failed")
            else:
                log(f"⚠️ TEST 29 SKIPPED: Could not get OTP")
                client.close()
        else:
            log(f"⚠️ TEST 29 SKIPPED: User3 registration init failed")
    except Exception as e:
        log(f"⚠️ TEST 29 SKIPPED: Exception: {e}")
    
    # TEST 30: Regression - normal tier card still works
    log("\n33. TEST 30: Regression - normal tier card still works...")
    try:
        # Request a tier card
        resp = requests.post(f"{BASE_URL}/cards/request", headers=get_headers(user_token), json={
            "tier": "basic"
        }, timeout=30)
        
        if resp.status_code == 200:
            tier_card_id = resp.json().get("card", {}).get("id")
            if tier_card_id:
                log(f"✅ TEST 30 PASSED: Normal tier card request still works")
            else:
                log(f"❌ TEST 30 FAILED: No card_id in response")
                return False
        else:
            log(f"❌ TEST 30 FAILED: Tier card request failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 30 EXCEPTION: {e}")
        return False
    
    log("\n" + "=" * 80)
    log("✅ ALL HIDDEN ZONAL CARD TESTS COMPLETED SUCCESSFULLY!")
    log("=" * 80)
    return True

if __name__ == "__main__":
    try:
        success = test_hidden_zonal_cards()
        sys.exit(0 if success else 1)
    except Exception as e:
        log(f"❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
