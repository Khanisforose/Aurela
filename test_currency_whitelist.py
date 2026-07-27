#!/usr/bin/env python3
"""
Aurela Currency Whitelist Test Suite
Focused quick test for admin-controlled currency whitelist (fiat + crypto)
"""
import requests
import json
import sys
import subprocess
import random

# Base URL from .env
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# Test state
admin_token = None
test_user_token = None
test_user_id = None
original_enabled_fiat = []
original_enabled_crypto = []

def log(msg, status="INFO"):
    """Print test log message"""
    prefix = "✅" if status == "PASS" else "❌" if status == "FAIL" else "ℹ️"
    print(f"{prefix} [{status}] {msg}")

def test_section(name):
    """Print test section header"""
    print(f"\n{'='*80}")
    print(f"  {name}")
    print(f"{'='*80}")

def admin_login():
    """Login as admin and get token"""
    global admin_token
    log("Admin login...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        log(f"Admin login failed: {resp.status_code} {resp.text}", "FAIL")
        sys.exit(1)
    data = resp.json()
    admin_token = data.get("token")
    log(f"Admin login successful, role={data.get('user', {}).get('role')}", "PASS")
    return admin_token

def create_test_user(username_suffix=""):
    """Create a test user and return token, user_id"""
    rand_suffix = random.randint(100000, 999999)
    email = f"currencytest{username_suffix}_{rand_suffix}@aurela.test"
    username = f"currencytest{username_suffix}_{rand_suffix}"
    password = "TestPass123!"
    
    # Init registration
    resp = requests.post(f"{BASE_URL}/auth/register/init", json={
        "email": email,
        "username": username,
        "password": password,
        "full_name": f"Currency Test User {username_suffix}"
    })
    if resp.status_code != 200:
        log(f"User registration init failed: {resp.status_code} {resp.text}", "FAIL")
        return None, None
    
    data = resp.json()
    signup_id = data.get("signup_id")
    otp = data.get("dev_otp")
    
    # If no dev_otp, query MongoDB directly
    if not otp:
        try:
            result = subprocess.run([
                "mongosh", "mongodb://localhost:27017/aurela", "--quiet", "--eval",
                f"db.pending_signups.findOne({{id: '{signup_id}'}}).code"
            ], capture_output=True, text=True, timeout=5)
            otp = result.stdout.strip()
            if not otp or otp == "null":
                log(f"Failed to get OTP from MongoDB for signup_id={signup_id}", "FAIL")
                return None, None
        except Exception as e:
            log(f"MongoDB query failed: {e}", "FAIL")
            return None, None
    
    # Verify OTP
    resp = requests.post(f"{BASE_URL}/auth/register/verify", json={
        "signup_id": signup_id,
        "email": email,
        "code": str(otp)
    })
    if resp.status_code != 200:
        log(f"User registration verify failed: {resp.status_code} {resp.text}", "FAIL")
        return None, None
    
    data = resp.json()
    token = data.get("token")
    user_id = data.get("user", {}).get("id")
    log(f"User created: {username}, id={user_id}", "PASS")
    return token, user_id

def approve_kyc(user_id):
    """Admin approves KYC for user"""
    # First submit KYC
    resp = requests.post(f"{BASE_URL}/kyc", 
        headers={"Authorization": f"Bearer {test_user_token}"},
        json={
            "first_name": "Test",
            "last_name": "User",
            "mobile": "+1234567890",
            "country": "US",
            "state": "CA",
            "city": "San Francisco",
            "address": "123 Test St",
            "postal_code": "94102",
            "occupation": "Engineer",
            "id_type": "passport",
            "id_number": "P12345678",
            "doc_front": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "doc_back": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "selfie": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
    )
    if resp.status_code != 200:
        log(f"KYC submission failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    kyc_id = resp.json().get("kyc", {}).get("id")
    
    # Admin approves
    resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved"}
    )
    if resp.status_code != 200:
        log(f"KYC approval failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    log(f"KYC approved for user {user_id}", "PASS")
    return True

def activate_card_for_user():
    """Request and activate a card for test user"""
    # Request card
    resp = requests.post(f"{BASE_URL}/cards/request",
        headers={"Authorization": f"Bearer {test_user_token}"},
        json={"tier": "basic"}
    )
    if resp.status_code != 200:
        log(f"Card request failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    card_id = resp.json().get("card", {}).get("id")
    
    # Submit tx_hash
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate",
        headers={"Authorization": f"Bearer {test_user_token}"},
        json={"tx_hash": "0x" + "a" * 64, "network": "TRC20"}
    )
    if resp.status_code != 200:
        log(f"Card activation submission failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    # Admin approves with activate_now
    resp = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"activate_now": True}
    )
    if resp.status_code != 200:
        log(f"Card admin approval failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    log(f"Card activated for user", "PASS")
    return True

# ============================================================
# TEST A — Config endpoint shape
# ============================================================
def test_a_config_endpoint():
    test_section("TEST A — Config endpoint shape")
    global original_enabled_fiat, original_enabled_crypto
    
    resp = requests.get(f"{BASE_URL}/config")
    if resp.status_code != 200:
        log(f"GET /config failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    
    # Check required keys
    required_keys = ["enabled_fiat", "enabled_crypto", "all_fiat", "all_crypto"]
    for key in required_keys:
        if key not in data:
            log(f"Missing key '{key}' in /config response", "FAIL")
            return False
    
    # Store originals for cleanup
    original_enabled_fiat = data["enabled_fiat"]
    original_enabled_crypto = data["enabled_crypto"]
    
    # Validate all_fiat has 50 currencies
    if len(data["all_fiat"]) != 50:
        log(f"Expected 50 fiat currencies in all_fiat, got {len(data['all_fiat'])}", "FAIL")
        return False
    
    # Validate all_crypto has 30 assets
    if len(data["all_crypto"]) != 30:
        log(f"Expected 30 crypto assets in all_crypto, got {len(data['all_crypto'])}", "FAIL")
        return False
    
    # Check specific currencies exist
    expected_fiat = ["USD", "EUR", "GBP", "INR", "AED", "JPY", "CAD", "AUD", "SGD", "CHF"]
    for curr in expected_fiat:
        if curr not in data["all_fiat"]:
            log(f"Expected fiat currency '{curr}' not in all_fiat", "FAIL")
            return False
    
    expected_crypto = ["BTC", "ETH", "USDT", "USDC", "BNB", "SOL", "XRP", "ADA", "DOGE", "MATIC"]
    for curr in expected_crypto:
        if curr not in data["all_crypto"]:
            log(f"Expected crypto asset '{curr}' not in all_crypto", "FAIL")
            return False
    
    log(f"Config endpoint returns correct shape: enabled_fiat ({len(data['enabled_fiat'])}), enabled_crypto ({len(data['enabled_crypto'])}), all_fiat (50), all_crypto (30)", "PASS")
    return True

# ============================================================
# TEST B — Admin PUT sets enabled_fiat / enabled_crypto
# ============================================================
def test_b_admin_settings_put():
    test_section("TEST B — Admin PUT sets enabled_fiat / enabled_crypto")
    
    # Set restricted lists
    new_enabled_fiat = ["USD", "EUR"]
    new_enabled_crypto = ["BTC", "ETH", "USDT"]
    
    resp = requests.put(f"{BASE_URL}/admin/settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "enabled_fiat": new_enabled_fiat,
            "enabled_crypto": new_enabled_crypto
        }
    )
    
    if resp.status_code != 200:
        log(f"PUT /admin/settings failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    log("Admin settings updated successfully", "PASS")
    
    # Verify changes in /config
    resp = requests.get(f"{BASE_URL}/config")
    if resp.status_code != 200:
        log(f"GET /config failed after settings update: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    
    if set(data["enabled_fiat"]) != set(new_enabled_fiat):
        log(f"enabled_fiat mismatch: expected {new_enabled_fiat}, got {data['enabled_fiat']}", "FAIL")
        return False
    
    if set(data["enabled_crypto"]) != set(new_enabled_crypto):
        log(f"enabled_crypto mismatch: expected {new_enabled_crypto}, got {data['enabled_crypto']}", "FAIL")
        return False
    
    log(f"Config reflects updated settings: enabled_fiat={new_enabled_fiat}, enabled_crypto={new_enabled_crypto}", "PASS")
    return True

# ============================================================
# TEST C — Deposit rejects disabled currency
# ============================================================
def test_c_deposit_enforcement():
    test_section("TEST C — Deposit rejects disabled currency")
    global test_user_token, test_user_id
    
    # Create fresh user
    test_user_token, test_user_id = create_test_user("deposit")
    if not test_user_token:
        log("Failed to create test user", "FAIL")
        return False
    
    # Approve KYC
    if not approve_kyc(test_user_id):
        log("Failed to approve KYC", "FAIL")
        return False
    
    # Test 1: GBP deposit (disabled) should fail
    resp = requests.post(f"{BASE_URL}/deposit",
        headers={"Authorization": f"Bearer {test_user_token}"},
        json={
            "method": "bank_swift",
            "currency": "GBP",
            "amount": 100,
            "details": {
                "bank_name": "Test Bank",
                "account_holder": "Test User",
                "account_number": "12345678",
                "swift_code": "TESTGB2L"
            }
        }
    )
    
    if resp.status_code != 400:
        log(f"Expected 400 for disabled GBP deposit, got {resp.status_code}", "FAIL")
        return False
    
    error_msg = resp.json().get("error", "")
    if "GBP" not in error_msg or "disabled" not in error_msg.lower():
        log(f"Expected error about GBP being disabled, got: {error_msg}", "FAIL")
        return False
    
    log(f"GBP deposit correctly rejected with error: {error_msg}", "PASS")
    
    # Test 2: USD deposit (enabled) should succeed
    resp = requests.post(f"{BASE_URL}/deposit",
        headers={"Authorization": f"Bearer {test_user_token}"},
        json={
            "method": "bank_swift",
            "currency": "USD",
            "amount": 100,
            "details": {
                "bank_name": "Test Bank",
                "account_holder": "Test User",
                "account_number": "12345678",
                "swift_code": "TESTUS33"
            }
        }
    )
    
    if resp.status_code != 200:
        log(f"USD deposit failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    log("USD deposit (enabled) succeeded", "PASS")
    
    # Test 3: SOL deposit (disabled) should fail
    resp = requests.post(f"{BASE_URL}/deposit",
        headers={"Authorization": f"Bearer {test_user_token}"},
        json={
            "method": "crypto",
            "currency": "SOL",
            "amount": 1
        }
    )
    
    if resp.status_code != 400:
        log(f"Expected 400 for disabled SOL deposit, got {resp.status_code}", "FAIL")
        return False
    
    error_msg = resp.json().get("error", "")
    if "SOL" not in error_msg or "disabled" not in error_msg.lower():
        log(f"Expected error about SOL being disabled, got: {error_msg}", "FAIL")
        return False
    
    log(f"SOL deposit correctly rejected with error: {error_msg}", "PASS")
    
    # Test 4: BTC deposit (enabled) should succeed
    resp = requests.post(f"{BASE_URL}/deposit",
        headers={"Authorization": f"Bearer {test_user_token}"},
        json={
            "method": "crypto",
            "currency": "BTC",
            "amount": 0.001
        }
    )
    
    if resp.status_code != 200:
        log(f"BTC deposit failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    log("BTC deposit (enabled) succeeded", "PASS")
    
    return True

# ============================================================
# TEST D — Withdraw rejects disabled currency
# ============================================================
def test_d_withdraw_enforcement():
    test_section("TEST D — Withdraw rejects disabled currency")
    
    # Activate card for user (required for withdrawals)
    if not activate_card_for_user():
        log("Failed to activate card", "FAIL")
        return False
    
    # Add USD balance via admin adjust (user has welcome bonus but may not be enough after deposits)
    resp = requests.post(f"{BASE_URL}/admin/users/{test_user_id}/adjust",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "currency": "USD",
            "amount": 500,
            "type": "credit",
            "note": "Test balance for withdrawal"
        }
    )
    if resp.status_code != 200:
        log(f"Admin adjust failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    log("Added USD balance for withdrawal test", "PASS")
    
    # Test 1: GBP withdrawal (disabled) should fail
    resp = requests.post(f"{BASE_URL}/withdraw",
        headers={"Authorization": f"Bearer {test_user_token}"},
        json={
            "method": "bank_swift",
            "currency": "GBP",
            "amount": 10,
            "destination": "GB29NWBK60161331926819",
            "details": {
                "bank_name": "Test Bank",
                "account_holder": "Test User",
                "account_number": "12345678",
                "swift_code": "TESTGB2L"
            }
        }
    )
    
    if resp.status_code != 400:
        log(f"Expected 400 for disabled GBP withdrawal, got {resp.status_code}", "FAIL")
        return False
    
    error_msg = resp.json().get("error", "")
    if "GBP" not in error_msg or "disabled" not in error_msg.lower():
        log(f"Expected error about GBP being disabled, got: {error_msg}", "FAIL")
        return False
    
    log(f"GBP withdrawal correctly rejected with error: {error_msg}", "PASS")
    
    # Test 2: USD withdrawal (enabled) should succeed
    resp = requests.post(f"{BASE_URL}/withdraw",
        headers={"Authorization": f"Bearer {test_user_token}"},
        json={
            "method": "bank_swift",
            "currency": "USD",
            "amount": 10,
            "destination": "US64SVBKUS6S3300958879",
            "details": {
                "bank_name": "Test Bank",
                "account_holder": "Test User",
                "account_number": "12345678",
                "swift_code": "TESTUS33"
            }
        }
    )
    
    if resp.status_code != 200:
        log(f"USD withdrawal failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    log("USD withdrawal (enabled) succeeded", "PASS")
    
    return True

# ============================================================
# TEST E — Restore defaults (cleanup)
# ============================================================
def test_e_restore_defaults():
    test_section("TEST E — Restore defaults (cleanup)")
    
    # Get all_fiat and all_crypto from config
    resp = requests.get(f"{BASE_URL}/config")
    if resp.status_code != 200:
        log(f"GET /config failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    all_fiat = data["all_fiat"]
    all_crypto = data["all_crypto"]
    
    # Restore to full lists
    resp = requests.put(f"{BASE_URL}/admin/settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "enabled_fiat": all_fiat,
            "enabled_crypto": all_crypto
        }
    )
    
    if resp.status_code != 200:
        log(f"PUT /admin/settings failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    log("Admin settings restored to defaults", "PASS")
    
    # Verify restoration
    resp = requests.get(f"{BASE_URL}/config")
    if resp.status_code != 200:
        log(f"GET /config failed after restore: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    
    if len(data["enabled_fiat"]) != 50:
        log(f"Expected 50 enabled fiat currencies after restore, got {len(data['enabled_fiat'])}", "FAIL")
        return False
    
    if len(data["enabled_crypto"]) != 30:
        log(f"Expected 30 enabled crypto assets after restore, got {len(data['enabled_crypto'])}", "FAIL")
        return False
    
    log(f"Config restored: enabled_fiat (50), enabled_crypto (30)", "PASS")
    return True

# ============================================================
# MAIN TEST RUNNER
# ============================================================
def main():
    print("\n" + "="*80)
    print("  AURELA CURRENCY WHITELIST TEST SUITE")
    print("="*80)
    
    # Login as admin
    admin_login()
    
    # Run tests
    results = {
        "A": test_a_config_endpoint(),
        "B": test_b_admin_settings_put(),
        "C": test_c_deposit_enforcement(),
        "D": test_d_withdraw_enforcement(),
        "E": test_e_restore_defaults()
    }
    
    # Summary
    test_section("TEST SUMMARY")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_id, result in results.items():
        status = "PASS" if result else "FAIL"
        log(f"Test {test_id}: {status}", status)
    
    print(f"\n{'='*80}")
    print(f"  FINAL RESULT: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    if passed == total:
        print("✅ ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"❌ {total - passed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
