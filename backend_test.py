#!/usr/bin/env python3
"""
Backend API Test Suite for Aurela - Card Approvals & Version Endpoint
Tests the new admin card endpoints and version endpoint with whats_new feature
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# Test state
admin_token = None
test_user_token = None
test_user_email = None
test_card_id = None

def log(msg: str, level: str = "INFO"):
    """Log test messages"""
    print(f"[{level}] {msg}")

def test_request(method: str, endpoint: str, token: Optional[str] = None, 
                 data: Optional[Dict] = None, expected_status: int = 200) -> Dict[str, Any]:
    """Make a test request and validate response"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        log(f"{method} {endpoint} -> {response.status_code}")
        
        if response.status_code != expected_status:
            log(f"Expected {expected_status}, got {response.status_code}: {response.text}", "ERROR")
            return {"error": f"Status mismatch: expected {expected_status}, got {response.status_code}", "status": response.status_code, "body": response.text}
        
        return {"status": response.status_code, "data": response.json() if response.text else {}}
    except Exception as e:
        log(f"Request failed: {str(e)}", "ERROR")
        return {"error": str(e), "status": 0}

def setup_test_user():
    """Register and setup a test user with KYC approved"""
    global test_user_token, test_user_email
    
    log("=== Setting up test user ===")
    
    # Generate unique email
    import random
    test_user_email = f"testuser_{random.randint(100000, 999999)}@test.com"
    
    # Register init
    log(f"Registering user: {test_user_email}")
    result = test_request("POST", "/auth/register/init", data={
        "first_name": "Test",
        "last_name": "User",
        "email": test_user_email,
        "country": "United States",
        "phone": "+1234567890",
        "password": "TestPass123"
    })
    
    if "error" in result:
        log(f"Failed to register user: {result}", "ERROR")
        return False
    
    signup_id = result["data"].get("signup_id")
    dev_otp = result["data"].get("dev_otp")
    
    if not signup_id:
        log("No signup_id returned", "ERROR")
        return False
    
    # If no dev_otp, fetch from DB (email sent successfully)
    if not dev_otp:
        log("No dev_otp in response, fetching from DB...", "INFO")
        # Fetch OTP from MongoDB
        import subprocess
        cmd = f'mongosh mongodb://localhost:27017/aurela --quiet --eval "db.pending_signups.findOne({{id: \\"{signup_id}\\"}})"'
        try:
            output = subprocess.check_output(cmd, shell=True, text=True)
            import re
            match = re.search(r"code:\s*'(\d+)'", output)
            if match:
                dev_otp = match.group(1)
                log(f"Found OTP from DB: {dev_otp}", "INFO")
            else:
                log(f"Could not parse OTP from DB output: {output}", "ERROR")
                return False
        except Exception as e:
            log(f"Failed to fetch OTP from DB: {e}", "ERROR")
            return False
    
    log(f"Verifying with OTP: {dev_otp}")
    result = test_request("POST", "/auth/register/verify", data={
        "signup_id": signup_id,
        "code": dev_otp
    })
    
    if "error" in result:
        log(f"Failed to verify user: {result}", "ERROR")
        return False
    
    test_user_token = result["data"].get("token")
    user_id = result["data"].get("user", {}).get("id")
    
    if not test_user_token:
        log("No token returned from verification", "ERROR")
        return False
    
    log(f"✅ User registered and verified. User ID: {user_id}")
    
    # Submit KYC
    log("Submitting KYC...")
    result = test_request("POST", "/kyc", token=test_user_token, data={
        "first_name": "Test",
        "last_name": "User",
        "mobile": "+1234567890",
        "country": "United States",
        "state": "California",
        "city": "San Francisco",
        "address": "123 Test St",
        "postal_code": "94102",
        "occupation": "Software Engineer",
        "id_type": "passport",
        "id_number": "TEST123456",
        "doc_front": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "doc_back": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "selfie": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    })
    
    if "error" in result:
        log(f"Failed to submit KYC: {result}", "ERROR")
        return False
    
    kyc_id = result["data"].get("kyc", {}).get("id")
    log(f"✅ KYC submitted. KYC ID: {kyc_id}")
    
    # Admin approve KYC
    log("Admin approving KYC...")
    result = test_request("POST", f"/admin/kyc/{kyc_id}/approve", token=admin_token)
    
    if "error" in result:
        log(f"Failed to approve KYC: {result}", "ERROR")
        return False
    
    log("✅ KYC approved")
    return True

def test_version_endpoint():
    """Test 1: GET /api/version (no auth)"""
    log("\n=== TEST 1: GET /api/version ===")
    
    result = test_request("GET", "/version")
    
    if "error" in result:
        log("❌ FAIL: Version endpoint failed", "ERROR")
        return False
    
    data = result["data"]
    
    # Check version
    if data.get("version") != "1.4.0":
        log(f"❌ FAIL: Expected version 1.4.0, got {data.get('version')}", "ERROR")
        return False
    
    # Check whats_new_title
    if data.get("whats_new_title") != "Aurela Updated":
        log(f"❌ FAIL: Expected whats_new_title 'Aurela Updated', got {data.get('whats_new_title')}", "ERROR")
        return False
    
    # Check whats_new is array
    whats_new = data.get("whats_new")
    if not isinstance(whats_new, list) or len(whats_new) == 0:
        log(f"❌ FAIL: whats_new should be non-empty array, got {whats_new}", "ERROR")
        return False
    
    # Check build_time present
    if not data.get("build_time"):
        log("❌ FAIL: build_time not present", "ERROR")
        return False
    
    log(f"✅ PASS: Version endpoint working correctly")
    log(f"  - version: {data.get('version')}")
    log(f"  - whats_new_title: {data.get('whats_new_title')}")
    log(f"  - whats_new items: {len(whats_new)}")
    log(f"  - build_time: {data.get('build_time')}")
    return True

def test_admin_cards_list():
    """Test 2: GET /api/admin/cards with user population"""
    log("\n=== TEST 2: GET /api/admin/cards ===")
    
    result = test_request("GET", "/admin/cards", token=admin_token)
    
    if "error" in result:
        log("❌ FAIL: Admin cards list failed", "ERROR")
        return False
    
    data = result["data"]
    cards = data.get("cards", [])
    
    log(f"Found {len(cards)} cards")
    
    # Find our test card
    test_card = None
    for card in cards:
        if card.get("user", {}).get("email") == test_user_email:
            test_card = card
            break
    
    if not test_card:
        log(f"❌ FAIL: Test card not found in list", "ERROR")
        return False
    
    # Verify user object structure
    user = test_card.get("user")
    if not user:
        log("❌ FAIL: Card missing user object", "ERROR")
        return False
    
    # Check required fields
    required_fields = ["id", "username", "email", "kyc_status"]
    for field in required_fields:
        if field not in user:
            log(f"❌ FAIL: User object missing required field: {field}", "ERROR")
            return False
    
    # Check forbidden fields
    forbidden_fields = ["password_hash", "salt", "_id"]
    for field in forbidden_fields:
        if field in user:
            log(f"❌ FAIL: User object contains forbidden field: {field}", "ERROR")
            return False
    
    log(f"✅ PASS: Admin cards list working correctly")
    log(f"  - Test card found with user: {user.get('email')}")
    log(f"  - User has required fields: {', '.join(required_fields)}")
    log(f"  - User does not have forbidden fields")
    return True

def test_admin_card_detail():
    """Test 3: GET /api/admin/cards/<card_id> with full details"""
    log("\n=== TEST 3: GET /api/admin/cards/<card_id> ===")
    
    result = test_request("GET", f"/admin/cards/{test_card_id}", token=admin_token)
    
    if "error" in result:
        log("❌ FAIL: Admin card detail failed", "ERROR")
        return False
    
    data = result["data"]
    
    # Check required keys
    required_keys = ["card", "user", "kyc", "usdt_wallet", "other_cards", "explorer_url"]
    for key in required_keys:
        if key not in data:
            log(f"❌ FAIL: Response missing required key: {key}", "ERROR")
            return False
    
    # Verify card
    card = data.get("card")
    if card.get("id") != test_card_id:
        log(f"❌ FAIL: Card ID mismatch", "ERROR")
        return False
    
    if card.get("activation_tx_hash") != "0xabc123def456789":
        log(f"❌ FAIL: activation_tx_hash mismatch: {card.get('activation_tx_hash')}", "ERROR")
        return False
    
    # Verify user
    user = data.get("user")
    if user.get("email") != test_user_email:
        log(f"❌ FAIL: User email mismatch", "ERROR")
        return False
    
    if "password_hash" in user or "salt" in user:
        log(f"❌ FAIL: User contains password_hash or salt", "ERROR")
        return False
    
    # Verify KYC (should not have doc images)
    kyc = data.get("kyc")
    if kyc:
        forbidden_kyc_fields = ["doc_front", "doc_back", "selfie"]
        for field in forbidden_kyc_fields:
            if field in kyc:
                log(f"❌ FAIL: KYC contains forbidden field: {field}", "ERROR")
                return False
    
    # Verify USDT wallet
    usdt_wallet = data.get("usdt_wallet")
    if not isinstance(usdt_wallet.get("balance"), (int, float)):
        log(f"❌ FAIL: USDT wallet balance is not a number", "ERROR")
        return False
    
    # Verify other_cards is array
    other_cards = data.get("other_cards")
    if not isinstance(other_cards, list):
        log(f"❌ FAIL: other_cards is not an array", "ERROR")
        return False
    
    # Verify explorer_url
    explorer_url = data.get("explorer_url")
    if not explorer_url or not explorer_url.startswith("https://etherscan.io/tx/0xabc123def456789"):
        log(f"❌ FAIL: explorer_url incorrect: {explorer_url}", "ERROR")
        return False
    
    log(f"✅ PASS: Admin card detail working correctly")
    log(f"  - Card ID: {card.get('id')}")
    log(f"  - Activation TX: {card.get('activation_tx_hash')}")
    log(f"  - User email: {user.get('email')}")
    log(f"  - USDT balance: {usdt_wallet.get('balance')}")
    log(f"  - Other cards: {len(other_cards)}")
    log(f"  - Explorer URL: {explorer_url}")
    return True

def test_card_not_found():
    """Test 4: GET /api/admin/cards/does-not-exist -> 404"""
    log("\n=== TEST 4: GET /api/admin/cards/does-not-exist ===")
    
    result = test_request("GET", "/admin/cards/does-not-exist", token=admin_token, expected_status=404)
    
    if result.get("status") != 404:
        log(f"❌ FAIL: Expected 404, got {result.get('status')}", "ERROR")
        return False
    
    log(f"✅ PASS: Non-existent card returns 404")
    return True

def test_card_approve_regression():
    """Test 5: Regression - POST /api/admin/cards/<card_id>/approve with activate_now"""
    log("\n=== TEST 5: Regression - Card Approve ===")
    
    # Approve with activate_now
    result = test_request("POST", f"/admin/cards/{test_card_id}/approve", 
                         token=admin_token, 
                         data={"activate_now": True})
    
    if "error" in result:
        log("❌ FAIL: Card approve failed", "ERROR")
        return False
    
    # Verify card is active
    time.sleep(1)  # Give it a moment
    result = test_request("GET", "/cards", token=test_user_token)
    
    if "error" in result:
        log("❌ FAIL: Failed to get user cards", "ERROR")
        return False
    
    cards = result["data"].get("cards", [])
    approved_card = None
    for card in cards:
        if card.get("id") == test_card_id:
            approved_card = card
            break
    
    if not approved_card:
        log("❌ FAIL: Approved card not found", "ERROR")
        return False
    
    if approved_card.get("status") != "active":
        log(f"❌ FAIL: Card status is {approved_card.get('status')}, expected 'active'", "ERROR")
        return False
    
    log(f"✅ PASS: Card approve with activate_now working correctly")
    log(f"  - Card status: {approved_card.get('status')}")
    return True

def test_card_delete_regression():
    """Test 5b: Regression - DELETE /api/admin/cards/<card_id>"""
    log("\n=== TEST 5b: Regression - Card Delete ===")
    
    # Create another card to delete
    log("Creating another card for delete test...")
    result = test_request("POST", "/cards/request", 
                         token=test_user_token, 
                         data={"tier": "premium"})
    
    if "error" in result:
        log(f"Failed to create premium card: {result}", "ERROR")
        return False
    
    premium_card_id = result["data"].get("card", {}).get("id")
    
    # Activate it
    result = test_request("POST", f"/cards/{premium_card_id}/activate", 
                         token=test_user_token, 
                         data={
                             "tx_hash": "0xdef456789abc123",
                             "network": "ERC20"
                         })
    
    if "error" in result:
        log(f"Failed to activate premium card: {result}", "ERROR")
        return False
    
    # Delete it as admin
    result = test_request("DELETE", f"/admin/cards/{premium_card_id}", token=admin_token)
    
    if "error" in result:
        log("❌ FAIL: Card delete failed", "ERROR")
        return False
    
    # Verify it's deleted
    result = test_request("GET", f"/admin/cards/{premium_card_id}", token=admin_token, expected_status=404)
    
    if result.get("status") != 404:
        log(f"❌ FAIL: Deleted card still exists", "ERROR")
        return False
    
    log(f"✅ PASS: Card delete working correctly")
    return True

def test_authorization():
    """Test 6: Authorization tests (403/401)"""
    log("\n=== TEST 6: Authorization Tests ===")
    
    # Non-admin user trying to access admin cards list
    result = test_request("GET", "/admin/cards", token=test_user_token, expected_status=403)
    
    if result.get("status") != 403:
        log(f"❌ FAIL: Non-admin should get 403, got {result.get('status')}", "ERROR")
        return False
    
    log("✅ Non-admin user blocked from GET /admin/cards (403)")
    
    # Non-admin user trying to access admin card detail
    result = test_request("GET", f"/admin/cards/{test_card_id}", token=test_user_token, expected_status=403)
    
    if result.get("status") != 403:
        log(f"❌ FAIL: Non-admin should get 403, got {result.get('status')}", "ERROR")
        return False
    
    log("✅ Non-admin user blocked from GET /admin/cards/<id> (403)")
    
    # Unauthenticated request
    result = test_request("GET", "/admin/cards", expected_status=401)
    
    if result.get("status") != 401:
        log(f"❌ FAIL: Unauthenticated should get 401, got {result.get('status')}", "ERROR")
        return False
    
    log("✅ Unauthenticated request blocked (401)")
    
    log(f"✅ PASS: All authorization tests passed")
    return True

def test_quick_regression():
    """Test 7: Quick regression on other endpoints"""
    log("\n=== TEST 7: Quick Regression ===")
    
    # GET /api/admin/kyc
    result = test_request("GET", "/admin/kyc", token=admin_token)
    if "error" in result:
        log("❌ FAIL: GET /admin/kyc failed", "ERROR")
        return False
    
    # Verify images are stripped
    kyc_list = result["data"].get("kyc", [])
    for kyc in kyc_list:
        if "doc_front" in kyc or "doc_back" in kyc or "selfie" in kyc:
            log("❌ FAIL: KYC list contains image fields", "ERROR")
            return False
    
    log("✅ GET /admin/kyc working (images stripped)")
    
    # GET /api/rates
    result = test_request("GET", "/rates")
    if "error" in result:
        log("❌ FAIL: GET /rates failed", "ERROR")
        return False
    
    log("✅ GET /rates working")
    
    # GET /api/wallets
    result = test_request("GET", "/wallets", token=test_user_token)
    if "error" in result:
        log("❌ FAIL: GET /wallets failed", "ERROR")
        return False
    
    log("✅ GET /wallets working")
    
    log(f"✅ PASS: All regression tests passed")
    return True

def main():
    """Run all tests"""
    global admin_token, test_card_id
    
    log("=" * 60)
    log("AURELA BACKEND TEST SUITE - Card Approvals & Version")
    log("=" * 60)
    
    # Login as admin
    log("\n=== Admin Login ===")
    result = test_request("POST", "/auth/login", data={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if "error" in result:
        log("❌ CRITICAL: Admin login failed", "ERROR")
        sys.exit(1)
    
    admin_token = result["data"].get("token")
    log(f"✅ Admin logged in successfully")
    
    # Setup test user
    if not setup_test_user():
        log("❌ CRITICAL: Failed to setup test user", "ERROR")
        sys.exit(1)
    
    # Create test card
    log("\n=== Creating test card ===")
    result = test_request("POST", "/cards/request", 
                         token=test_user_token, 
                         data={"tier": "basic"})
    
    if "error" in result:
        log(f"❌ CRITICAL: Failed to create card: {result}", "ERROR")
        sys.exit(1)
    
    test_card_id = result["data"].get("card", {}).get("id")
    log(f"✅ Card created: {test_card_id}")
    
    # Activate card
    log("Activating card with tx_hash...")
    result = test_request("POST", f"/cards/{test_card_id}/activate", 
                         token=test_user_token, 
                         data={
                             "tx_hash": "0xabc123def456789",
                             "network": "ERC20"
                         })
    
    if "error" in result:
        log(f"❌ CRITICAL: Failed to activate card: {result}", "ERROR")
        sys.exit(1)
    
    log(f"✅ Card activated (status: pending_verification)")
    
    # Run tests
    tests = [
        ("Version Endpoint", test_version_endpoint),
        ("Admin Cards List", test_admin_cards_list),
        ("Admin Card Detail", test_admin_card_detail),
        ("Card Not Found", test_card_not_found),
        ("Card Approve Regression", test_card_approve_regression),
        ("Card Delete Regression", test_card_delete_regression),
        ("Authorization Tests", test_authorization),
        ("Quick Regression", test_quick_regression),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            log(f"❌ FAIL: {test_name} - Exception: {str(e)}", "ERROR")
            failed += 1
    
    # Summary
    log("\n" + "=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    log(f"Total Tests: {passed + failed}")
    log(f"Passed: {passed}")
    log(f"Failed: {failed}")
    
    if failed == 0:
        log("\n✅ ALL TESTS PASSED!")
        sys.exit(0)
    else:
        log(f"\n❌ {failed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
