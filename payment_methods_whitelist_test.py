#!/usr/bin/env python3
"""
Aurela Payment Methods Whitelist Test
Focused test for admin-controlled payment method whitelist feature
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
    email = f"testuser{username_suffix}_{rand_suffix}@aurela.test"
    username = f"testuser{username_suffix}_{rand_suffix}"
    password = "TestPass123!"
    
    # Init registration
    resp = requests.post(f"{BASE_URL}/auth/register/init", json={
        "email": email,
        "username": username,
        "password": password,
        "full_name": f"Test User {username_suffix}"
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
    log(f"Test user created: {username} (id={user_id})", "PASS")
    return token, user_id

def approve_kyc(user_token, user_id):
    """Submit and approve KYC for a user"""
    # First submit KYC
    headers = {"Authorization": f"Bearer {user_token}"}
    resp = requests.post(f"{BASE_URL}/kyc", headers=headers, json={
        "first_name": "Test",
        "last_name": "User",
        "dob": "1990-01-01",
        "country": "US",
        "id_type": "passport",
        "id_number": "P123456789"
    })
    if resp.status_code != 200:
        log(f"KYC submission failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    kyc_id = resp.json().get("kyc", {}).get("id")
    
    # Admin approves
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve", headers=admin_headers)
    if resp.status_code != 200:
        log(f"KYC approval failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    log("KYC approved", "PASS")
    return True

def admin_adjust_balance(user_id, currency, amount):
    """Admin adjusts user balance"""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust", headers=admin_headers, json={
        "currency": currency,
        "amount": amount,
        "kind": "credit"
    })
    if resp.status_code != 200:
        log(f"Admin adjust balance failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    log(f"Admin credited {amount} {currency} to user", "PASS")
    return True

def create_active_card(user_token):
    """Create and activate a card for the user"""
    headers = {"Authorization": f"Bearer {user_token}"}
    
    # Request card
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "basic"})
    if resp.status_code != 200:
        log(f"Card request failed: {resp.status_code} {resp.text}", "FAIL")
        return None
    card_id = resp.json().get("card", {}).get("id")
    
    # Activate with tx_hash
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate", headers=headers, json={
        "tx_hash": "0x" + "a" * 64
    })
    if resp.status_code != 200:
        log(f"Card activation failed: {resp.status_code} {resp.text}", "FAIL")
        return None
    
    # Admin approves with activate_now=true
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve", headers=admin_headers, json={
        "activate_now": True
    })
    if resp.status_code != 200:
        log(f"Admin card approval failed: {resp.status_code} {resp.text}", "FAIL")
        return None
    
    log(f"Active card created: {card_id}", "PASS")
    return card_id

# ============================================================
# TEST A: Config endpoint shape
# ============================================================
def test_a_config_endpoint():
    test_section("TEST A: Config endpoint shape")
    
    log("GET /api/config should include enabled_deposit_methods, enabled_withdrawal_methods, all_deposit_methods, all_withdrawal_methods")
    resp = requests.get(f"{BASE_URL}/config")
    
    if resp.status_code != 200:
        log(f"Config endpoint failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    required_keys = [
        "enabled_deposit_methods",
        "enabled_withdrawal_methods",
        "all_deposit_methods",
        "all_withdrawal_methods"
    ]
    
    missing_keys = [k for k in required_keys if k not in data]
    if missing_keys:
        log(f"Missing keys in config: {missing_keys}", "FAIL")
        return False
    
    # Verify they are arrays
    for key in required_keys:
        if not isinstance(data[key], list):
            log(f"{key} is not an array: {type(data[key])}", "FAIL")
            return False
    
    # Verify all_deposit_methods and all_withdrawal_methods contain expected methods
    expected_methods = ['bank_swift','bank_indian','upi','paypal','stripe','card','sepa','ach','wise','crypto']
    
    if set(data["all_deposit_methods"]) != set(expected_methods):
        log(f"all_deposit_methods mismatch. Expected {expected_methods}, got {data['all_deposit_methods']}", "FAIL")
        return False
    
    if set(data["all_withdrawal_methods"]) != set(expected_methods):
        log(f"all_withdrawal_methods mismatch. Expected {expected_methods}, got {data['all_withdrawal_methods']}", "FAIL")
        return False
    
    log(f"✓ Config endpoint has all required keys", "PASS")
    log(f"  enabled_deposit_methods: {data['enabled_deposit_methods']}", "INFO")
    log(f"  enabled_withdrawal_methods: {data['enabled_withdrawal_methods']}", "INFO")
    log(f"  all_deposit_methods: {data['all_deposit_methods']}", "INFO")
    log(f"  all_withdrawal_methods: {data['all_withdrawal_methods']}", "INFO")
    return True

# ============================================================
# TEST B: Admin settings PUT accepts new keys
# ============================================================
def test_b_admin_settings_put():
    test_section("TEST B: Admin settings PUT accepts new keys")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Set restricted whitelist
    restricted_deposit = ["bank_swift", "upi", "crypto"]
    restricted_withdrawal = ["bank_swift", "crypto"]
    
    log(f"PUT /api/admin/settings with enabled_deposit_methods={restricted_deposit}, enabled_withdrawal_methods={restricted_withdrawal}")
    resp = requests.put(f"{BASE_URL}/admin/settings", headers=admin_headers, json={
        "enabled_deposit_methods": restricted_deposit,
        "enabled_withdrawal_methods": restricted_withdrawal
    })
    
    if resp.status_code != 200:
        log(f"Admin settings PUT failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    settings = data.get("settings", {})
    
    if settings.get("enabled_deposit_methods") != restricted_deposit:
        log(f"enabled_deposit_methods not persisted correctly. Expected {restricted_deposit}, got {settings.get('enabled_deposit_methods')}", "FAIL")
        return False
    
    if settings.get("enabled_withdrawal_methods") != restricted_withdrawal:
        log(f"enabled_withdrawal_methods not persisted correctly. Expected {restricted_withdrawal}, got {settings.get('enabled_withdrawal_methods')}", "FAIL")
        return False
    
    log("✓ Admin settings PUT accepted and persisted new keys", "PASS")
    
    # Verify by calling GET /api/config
    log("Verifying via GET /api/config...")
    resp = requests.get(f"{BASE_URL}/config")
    if resp.status_code != 200:
        log(f"Config endpoint failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    config = resp.json()
    if config.get("enabled_deposit_methods") != restricted_deposit:
        log(f"Config enabled_deposit_methods mismatch. Expected {restricted_deposit}, got {config.get('enabled_deposit_methods')}", "FAIL")
        return False
    
    if config.get("enabled_withdrawal_methods") != restricted_withdrawal:
        log(f"Config enabled_withdrawal_methods mismatch. Expected {restricted_withdrawal}, got {config.get('enabled_withdrawal_methods')}", "FAIL")
        return False
    
    log("✓ GET /api/config reflects admin settings changes", "PASS")
    return True

# ============================================================
# TEST C: Enforcement in /api/deposit
# ============================================================
def test_c_deposit_enforcement():
    test_section("TEST C: Enforcement in /api/deposit")
    
    global test_user_token, test_user_id
    
    # Create fresh user
    test_user_token, test_user_id = create_test_user("deposit_test")
    if not test_user_token:
        log("Failed to create test user", "FAIL")
        return False
    
    # Approve KYC
    if not approve_kyc(test_user_token, test_user_id):
        log("Failed to approve KYC", "FAIL")
        return False
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test 1: Try to deposit with disabled method (paypal - not in whitelist)
    log("Test 1: POST /api/deposit with method='paypal' (disabled) → should return 400")
    resp = requests.post(f"{BASE_URL}/deposit", headers=headers, json={
        "method": "paypal",
        "currency": "USD",
        "amount": 100
    })
    
    if resp.status_code != 400:
        log(f"Expected 400, got {resp.status_code}: {resp.text}", "FAIL")
        return False
    
    if "paypal" not in resp.text.lower() or "disabled" not in resp.text.lower():
        log(f"Error message doesn't mention paypal or disabled: {resp.text}", "FAIL")
        return False
    
    log(f"✓ Disabled method 'paypal' rejected with error: {resp.json().get('error')}", "PASS")
    
    # Test 2: Try to deposit with enabled method (bank_swift - in whitelist)
    log("Test 2: POST /api/deposit with method='bank_swift' (enabled) → should return 200")
    resp = requests.post(f"{BASE_URL}/deposit", headers=headers, json={
        "method": "bank_swift",
        "currency": "USD",
        "amount": 100,
        "details": {
            "bank_name": "Test Bank",
            "account_number": "123456789"
        }
    })
    
    if resp.status_code != 200:
        log(f"Expected 200, got {resp.status_code}: {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    if not data.get("ok"):
        log(f"Expected ok:true, got {data}", "FAIL")
        return False
    
    log(f"✓ Enabled method 'bank_swift' accepted", "PASS")
    
    # Test 3: Try crypto deposit (crypto is in whitelist)
    log("Test 3: POST /api/deposit with method='crypto' (enabled) → should return 200")
    resp = requests.post(f"{BASE_URL}/deposit", headers=headers, json={
        "method": "crypto",
        "currency": "BTC",
        "amount": 0.01,
        "tx_hash": "0x" + "b" * 64
    })
    
    if resp.status_code != 200:
        log(f"Expected 200, got {resp.status_code}: {resp.text}", "FAIL")
        return False
    
    log(f"✓ Enabled method 'crypto' accepted", "PASS")
    return True

# ============================================================
# TEST D: Enforcement in /api/withdraw
# ============================================================
def test_d_withdraw_enforcement():
    test_section("TEST D: Enforcement in /api/withdraw")
    
    # Use the same test user from Test C
    if not test_user_token or not test_user_id:
        log("Test user not available from Test C", "FAIL")
        return False
    
    # Give user balance
    if not admin_adjust_balance(test_user_id, "USD", 500):
        log("Failed to credit balance", "FAIL")
        return False
    
    # Create active card (required for withdrawal)
    card_id = create_active_card(test_user_token)
    if not card_id:
        log("Failed to create active card", "FAIL")
        return False
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test 1: Try to withdraw with disabled method (upi - NOT in withdrawal whitelist)
    log("Test 1: POST /api/withdraw with method='upi' (disabled) → should return 400")
    resp = requests.post(f"{BASE_URL}/withdraw", headers=headers, json={
        "method": "upi",
        "currency": "USD",
        "amount": 10,
        "details": {
            "upi_id": "test@upi"
        }
    })
    
    if resp.status_code != 400:
        log(f"Expected 400, got {resp.status_code}: {resp.text}", "FAIL")
        return False
    
    if "upi" not in resp.text.lower() or "disabled" not in resp.text.lower():
        log(f"Error message doesn't mention upi or disabled: {resp.text}", "FAIL")
        return False
    
    log(f"✓ Disabled method 'upi' rejected with error: {resp.json().get('error')}", "PASS")
    
    # Test 2: Try to withdraw with enabled method (bank_swift - in whitelist)
    log("Test 2: POST /api/withdraw with method='bank_swift' (enabled) → should return 200")
    resp = requests.post(f"{BASE_URL}/withdraw", headers=headers, json={
        "method": "bank_swift",
        "currency": "USD",
        "amount": 10,
        "destination": "DE89370400440532013000",
        "details": {
            "bank_name": "Test Bank",
            "account_holder": "Test User"
        }
    })
    
    if resp.status_code != 200:
        log(f"Expected 200, got {resp.status_code}: {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    if not data.get("ok"):
        log(f"Expected ok:true, got {data}", "FAIL")
        return False
    
    log(f"✓ Enabled method 'bank_swift' accepted", "PASS")
    
    # Test 3: Try crypto withdrawal (crypto is in whitelist) - using USDT which user has
    log("Test 3: POST /api/withdraw with method='crypto' (enabled) → should return 200")
    # Credit user with USDT first
    if not admin_adjust_balance(test_user_id, "USDT", 100):
        log("Failed to credit USDT balance", "FAIL")
        return False
    
    resp = requests.post(f"{BASE_URL}/withdraw", headers=headers, json={
        "method": "crypto",
        "currency": "USDT",
        "amount": 10,
        "destination": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "network": "ERC20"
    })
    
    if resp.status_code != 200:
        log(f"Expected 200, got {resp.status_code}: {resp.text}", "FAIL")
        return False
    
    log(f"✓ Enabled method 'crypto' accepted", "PASS")
    return True

# ============================================================
# TEST E: Restore defaults (cleanup)
# ============================================================
def test_e_restore_defaults():
    test_section("TEST E: Restore defaults (cleanup)")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Restore all methods
    all_methods = ['bank_swift','bank_indian','upi','paypal','stripe','card','sepa','ach','wise','crypto']
    
    log(f"PUT /api/admin/settings to restore all methods")
    resp = requests.put(f"{BASE_URL}/admin/settings", headers=admin_headers, json={
        "enabled_deposit_methods": all_methods,
        "enabled_withdrawal_methods": all_methods
    })
    
    if resp.status_code != 200:
        log(f"Admin settings PUT failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    settings = data.get("settings", {})
    
    if set(settings.get("enabled_deposit_methods", [])) != set(all_methods):
        log(f"enabled_deposit_methods not restored correctly", "FAIL")
        return False
    
    if set(settings.get("enabled_withdrawal_methods", [])) != set(all_methods):
        log(f"enabled_withdrawal_methods not restored correctly", "FAIL")
        return False
    
    log("✓ All payment methods restored to defaults", "PASS")
    
    # Verify via GET /api/config
    resp = requests.get(f"{BASE_URL}/config")
    if resp.status_code != 200:
        log(f"Config endpoint failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    config = resp.json()
    if set(config.get("enabled_deposit_methods", [])) != set(all_methods):
        log(f"Config enabled_deposit_methods not restored", "FAIL")
        return False
    
    if set(config.get("enabled_withdrawal_methods", [])) != set(all_methods):
        log(f"Config enabled_withdrawal_methods not restored", "FAIL")
        return False
    
    log("✓ GET /api/config confirms all methods enabled", "PASS")
    return True

# ============================================================
# MAIN
# ============================================================
def main():
    print("\n" + "="*80)
    print("  AURELA PAYMENT METHODS WHITELIST TEST")
    print("  Focused test for admin-controlled payment method whitelist")
    print("="*80)
    
    # Login as admin first
    admin_login()
    
    # Run all tests
    results = {
        "A": test_a_config_endpoint(),
        "B": test_b_admin_settings_put(),
        "C": test_c_deposit_enforcement(),
        "D": test_d_withdraw_enforcement(),
        "E": test_e_restore_defaults()
    }
    
    # Summary
    print("\n" + "="*80)
    print("  TEST SUMMARY")
    print("="*80)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  Test {test_name}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*80)
    if all_passed:
        print("  ✅ ALL TESTS PASSED")
    else:
        print("  ❌ SOME TESTS FAILED")
    print("="*80)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
