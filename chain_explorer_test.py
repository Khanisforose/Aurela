#!/usr/bin/env python3
"""
Aurela Chain Explorer & Admin User Detail Test Suite
Tests new chain explorer endpoints + admin user detail + regression
"""
import requests
import json
import sys

# Base URL from .env
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# Test state
admin_token = None
admin_user_id = None
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
    global admin_token, admin_user_id
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
    admin_user_id = data.get("user", {}).get("id")
    log(f"Admin login successful, role={data.get('user', {}).get('role')}, id={admin_user_id}", "PASS")
    return admin_token

def create_test_user(username_suffix=""):
    """Create a test user and return token, user_id"""
    import random
    import subprocess
    rand_suffix = random.randint(100000, 999999)
    email = f"chaintest{username_suffix}_{rand_suffix}@aurela.test"
    username = f"chaintest{username_suffix}_{rand_suffix}"
    password = "TestPass123!"
    
    # Init registration
    resp = requests.post(f"{BASE_URL}/auth/register/init", json={
        "email": email,
        "username": username,
        "password": password,
        "full_name": f"Chain Test User {username_suffix}"
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

def approve_kyc(token, user_id):
    """Submit and approve KYC for a user"""
    # Submit KYC
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/kyc", headers=headers, json={
        "first_name": "Chain",
        "last_name": "Explorer",
        "dob": "1990-01-01",
        "country": "US",
        "id_type": "passport",
        "id_number": "CE123456789"
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

# ============================================================
# TEST A: Chain Explorer Search
# ============================================================
def test_chain_search():
    test_section("TEST A: Chain Explorer Search")
    
    # Test 1: Search with q=admin (should find admin user)
    log("Test 1: GET /api/chain/search?q=admin → 200 with {blocks, users, wallets}")
    resp = requests.get(f"{BASE_URL}/chain/search?q=admin")
    if resp.status_code != 200:
        log(f"✗ Chain search failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    if "blocks" in data and "users" in data and "wallets" in data:
        log(f"✓ Response shape correct: blocks={len(data['blocks'])}, users={len(data['users'])}, wallets={len(data['wallets'])}", "PASS")
    else:
        log(f"✗ Missing required keys. Got: {list(data.keys())}", "FAIL")
        return False
    
    # Test 2: Search with q=admin@aurelawallet.com (should find admin user)
    log("Test 2: GET /api/chain/search?q=admin@aurelawallet.com → should find admin user")
    resp = requests.get(f"{BASE_URL}/chain/search?q=admin@aurelawallet.com")
    if resp.status_code != 200:
        log(f"✗ Chain search failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    users = data.get("users", [])
    admin_found = any(u.get("email") == "admin@aurelawallet.com" for u in users)
    if admin_found:
        log(f"✓ Admin user found in search results", "PASS")
    else:
        log(f"✗ Admin user not found. Users returned: {len(users)}", "FAIL")
    
    # Test 3: Search with empty q (should return empty arrays)
    log("Test 3: GET /api/chain/search?q= → 200 with empty arrays")
    resp = requests.get(f"{BASE_URL}/chain/search?q=")
    if resp.status_code != 200:
        log(f"✗ Chain search failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    if data.get("blocks") == [] and data.get("users") == [] and data.get("wallets") == []:
        log(f"✓ Empty query returns empty arrays", "PASS")
    else:
        log(f"✗ Expected empty arrays, got blocks={len(data.get('blocks', []))}, users={len(data.get('users', []))}, wallets={len(data.get('wallets', []))}", "FAIL")
    
    return True

# ============================================================
# TEST B: Block Detail
# ============================================================
def test_block_detail():
    test_section("TEST B: Block Detail")
    
    # Step 1: Get one recent block's hash
    log("Step 1: GET /api/chain?limit=1 → get recent block hash")
    resp = requests.get(f"{BASE_URL}/chain?limit=1")
    if resp.status_code != 200:
        log(f"✗ Chain list failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    blocks = data.get("blocks", [])
    if not blocks:
        log("⚠ No blocks in chain yet, skipping block detail test", "INFO")
        return True
    
    block_hash = blocks[0].get("hash")
    log(f"✓ Got block hash: {block_hash[:16]}...", "PASS")
    
    # Step 2: GET /api/chain/tx/{hash}
    log("Step 2: GET /api/chain/tx/{hash} → 200 with {block, prev, next, transaction}")
    resp = requests.get(f"{BASE_URL}/chain/tx/{block_hash}")
    if resp.status_code != 200:
        log(f"✗ Block detail failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    if "block" in data and "prev" in data and "next" in data and "transaction" in data:
        log(f"✓ Block detail shape correct: block_number={data['block'].get('block_number')}, prev={data['prev'] is not None}, next={data['next'] is not None}", "PASS")
    else:
        log(f"✗ Missing required keys. Got: {list(data.keys())}", "FAIL")
        return False
    
    # Step 3: GET /api/chain/tx/nonexistent-hash → 404
    log("Step 3: GET /api/chain/tx/nonexistent-hash → 404")
    resp = requests.get(f"{BASE_URL}/chain/tx/nonexistent-hash-12345")
    if resp.status_code == 404:
        log(f"✓ Nonexistent block returns 404", "PASS")
    else:
        log(f"✗ Expected 404, got {resp.status_code}: {resp.text}", "FAIL")
    
    return True

# ============================================================
# TEST C: Address/Wallet Detail
# ============================================================
def test_address_detail():
    test_section("TEST C: Address/Wallet Detail")
    
    # Step 1: Login as admin and get wallets
    log("Step 1: GET /api/wallets (admin) → get wallet id")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.get(f"{BASE_URL}/wallets", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Wallets list failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    wallets = resp.json().get("wallets", [])
    if not wallets:
        log("✗ No wallets found for admin", "FAIL")
        return False
    
    wallet_id = wallets[0].get("id")
    wallet_currency = wallets[0].get("currency")
    log(f"✓ Got wallet id: {wallet_id}, currency: {wallet_currency}", "PASS")
    
    # Step 2: GET /api/chain/address/{wallet_id}
    log("Step 2: GET /api/chain/address/{wallet_id} → 200 with {wallet, owner, blocks, stats}")
    resp = requests.get(f"{BASE_URL}/chain/address/{wallet_id}")
    if resp.status_code != 200:
        log(f"✗ Address detail failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    if "wallet" in data and "owner" in data and "blocks" in data and "stats" in data:
        stats = data.get("stats", {})
        if "incoming" in stats and "outgoing" in stats and "count" in stats:
            log(f"✓ Address detail shape correct: wallet={data['wallet'].get('currency')}, owner={data['owner'].get('username')}, blocks={len(data['blocks'])}, stats={stats}", "PASS")
        else:
            log(f"✗ Stats missing required keys: {stats}", "FAIL")
            return False
    else:
        log(f"✗ Missing required keys. Got: {list(data.keys())}", "FAIL")
        return False
    
    # Step 3: GET /api/chain/address/does-not-exist-12345 → 404
    log("Step 3: GET /api/chain/address/does-not-exist-12345 → 404")
    resp = requests.get(f"{BASE_URL}/chain/address/does-not-exist-12345")
    if resp.status_code == 404:
        log(f"✓ Nonexistent address returns 404", "PASS")
    else:
        log(f"✗ Expected 404, got {resp.status_code}: {resp.text}", "FAIL")
    
    return True

# ============================================================
# TEST D: Admin User Detail
# ============================================================
def test_admin_user_detail():
    test_section("TEST D: Admin User Detail (auth required, admin only)")
    
    # Step 1: Admin GET /api/admin/users
    log("Step 1: Admin GET /api/admin/users → returns list of users")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.get(f"{BASE_URL}/admin/users", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Admin users list failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    users = resp.json().get("users", [])
    if users:
        log(f"✓ Admin users list returned {len(users)} users", "PASS")
    else:
        log("✗ No users found", "FAIL")
        return False
    
    # Step 2: GET /api/admin/users/{admin_id} (admin's own detail)
    log(f"Step 2: Admin GET /api/admin/users/{admin_user_id} → 200 with full user detail")
    resp = requests.get(f"{BASE_URL}/admin/users/{admin_user_id}", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Admin user detail failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    required_keys = ["user", "wallets", "cards", "transactions", "kyc", "sessions"]
    missing_keys = [k for k in required_keys if k not in data]
    if missing_keys:
        log(f"✗ Missing required keys: {missing_keys}. Got: {list(data.keys())}", "FAIL")
        return False
    
    # Verify wallets array is present
    wallets = data.get("wallets", [])
    if isinstance(wallets, list):
        log(f"✓ Wallets array present with {len(wallets)} wallets", "PASS")
    else:
        log(f"✗ Wallets is not an array: {type(wallets)}", "FAIL")
        return False
    
    # Verify sessions array does NOT include token field
    sessions = data.get("sessions", [])
    if isinstance(sessions, list) and sessions:
        first_session = sessions[0]
        if "token" in first_session:
            log(f"✗ Sessions include 'token' field (should be excluded): {list(first_session.keys())}", "FAIL")
            return False
        else:
            expected_session_keys = ["id", "ip", "user_agent", "created_at"]
            session_keys = list(first_session.keys())
            log(f"✓ Sessions do NOT include 'token' field. Keys: {session_keys}", "PASS")
    else:
        log(f"⚠ No sessions found for admin user", "INFO")
    
    # Step 3: Create a regular user and try to access admin user detail (should be 403)
    log("Step 3: Non-admin user tries GET /api/admin/users/{id} → 403")
    test_user_token, test_user_id = create_test_user("nonadmin")
    if not test_user_token:
        log("✗ Failed to create test user", "FAIL")
        return False
    
    user_headers = {"Authorization": f"Bearer {test_user_token}"}
    resp = requests.get(f"{BASE_URL}/admin/users/{admin_user_id}", headers=user_headers)
    if resp.status_code == 403:
        log(f"✓ Non-admin access correctly returns 403", "PASS")
    else:
        log(f"✗ Expected 403, got {resp.status_code}: {resp.text}", "FAIL")
    
    return True

# ============================================================
# TEST E: /chain/mine now requires auth
# ============================================================
def test_chain_mine_auth():
    test_section("TEST E: /chain/mine now requires auth")
    
    # Test 1: GET /api/chain/mine (no auth) → 401
    log("Test 1: GET /api/chain/mine (no auth) → 401")
    resp = requests.get(f"{BASE_URL}/chain/mine")
    if resp.status_code == 401:
        log(f"✓ No auth returns 401", "PASS")
    else:
        log(f"✗ Expected 401, got {resp.status_code}: {resp.text}", "FAIL")
        return False
    
    # Test 2: GET /api/chain/mine (with valid user token) → 200
    log("Test 2: GET /api/chain/mine (with valid user token) → 200 with {blocks}")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.get(f"{BASE_URL}/chain/mine", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Chain mine failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    if "blocks" in data:
        log(f"✓ Chain mine returns blocks array with {len(data['blocks'])} blocks", "PASS")
    else:
        log(f"✗ Missing 'blocks' key. Got: {list(data.keys())}", "FAIL")
        return False
    
    return True

# ============================================================
# TEST F: Regression (smoke tests)
# ============================================================
def test_regression():
    test_section("TEST F: Regression (smoke tests)")
    
    # Test 1: GET /api/health
    log("Test 1: GET /api/health → 200")
    resp = requests.get(f"{BASE_URL}/health")
    if resp.status_code == 200 and resp.json().get("ok"):
        log("✓ Health endpoint working", "PASS")
    else:
        log(f"✗ Health endpoint failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 2: GET /api/config
    log("Test 2: GET /api/config → returns enabled_fiat, enabled_crypto, all_fiat, all_crypto, enabled_deposit_methods")
    resp = requests.get(f"{BASE_URL}/config")
    if resp.status_code != 200:
        log(f"✗ Config endpoint failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    data = resp.json()
    required_keys = ["enabled_fiat", "enabled_crypto", "all_fiat", "all_crypto", "enabled_deposit_methods"]
    missing_keys = [k for k in required_keys if k not in data]
    if missing_keys:
        log(f"✗ Config missing keys: {missing_keys}", "FAIL")
    else:
        log(f"✓ Config has all required keys: enabled_fiat={len(data['enabled_fiat'])}, enabled_crypto={len(data['enabled_crypto'])}, all_fiat={len(data['all_fiat'])}, all_crypto={len(data['all_crypto'])}", "PASS")
    
    # Test 3: POST /api/auth/login (admin)
    log("Test 3: POST /api/auth/login (admin) → 200")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200 and resp.json().get("token"):
        log("✓ Admin login working", "PASS")
    else:
        log(f"✗ Admin login failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 4: POST /api/deposit (KYC-approved user, enabled currency, enabled method)
    log("Test 4: POST /api/deposit (KYC-approved user) → 200 pending")
    # Create and approve KYC for test user
    token, user_id = create_test_user("deposit")
    if not token:
        log("✗ Failed to create test user", "FAIL")
        return False
    
    if not approve_kyc(token, user_id):
        log("✗ Failed to approve KYC", "FAIL")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/deposit", headers=headers, json={
        "method": "bank_swift",
        "amount": 100,
        "currency": "USD"
    })
    if resp.status_code == 200 and resp.json().get("request", {}).get("status") == "pending":
        log("✓ Deposit creates pending request", "PASS")
    else:
        log(f"✗ Deposit failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 5: POST /api/withdraw (with active card + KYC + enabled)
    log("Test 5: POST /api/withdraw (with active card + KYC) → 200 pending")
    # Give user balance
    admin_adjust_balance(user_id, "USD", 500)
    
    # Request and activate card
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "basic"})
    if resp.status_code != 200:
        log(f"✗ Card request failed: {resp.status_code} {resp.text}", "FAIL")
        return False
    
    card_id = resp.json().get("card", {}).get("id")
    
    # Activate with tx_hash
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate", headers=headers, json={
        "tx_hash": "0x" + "e" * 64
    })
    
    # Admin approves with activate_now
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve", headers=admin_headers, json={
        "activate_now": True
    })
    
    # Now try withdraw
    resp = requests.post(f"{BASE_URL}/withdraw", headers=headers, json={
        "method": "bank_swift",
        "currency": "USD",
        "amount": 50,
        "destination": "DE89370400440532013000"
    })
    if resp.status_code == 200 and resp.json().get("request", {}).get("status") == "pending":
        log("✓ Withdraw creates pending request", "PASS")
    else:
        log(f"✗ Withdraw failed: {resp.status_code} {resp.text}", "FAIL")
    
    return True

# ============================================================
# MAIN
# ============================================================
def main():
    print("\n" + "="*80)
    print("  AURELA CHAIN EXPLORER & ADMIN USER DETAIL TEST SUITE")
    print("="*80)
    
    # Login as admin first
    admin_login()
    
    # Run all test sections
    results = {
        "A": test_chain_search(),
        "B": test_block_detail(),
        "C": test_address_detail(),
        "D": test_admin_user_detail(),
        "E": test_chain_mine_auth(),
        "F": test_regression()
    }
    
    # Summary
    print("\n" + "="*80)
    print("  TEST SUMMARY")
    print("="*80)
    for section, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  Section {section}: {status}")
    
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
