#!/usr/bin/env python3
"""
Aurela Backend Regression Test Suite
Tests all new features from major feature drop + regression checks
"""
import requests
import json
import time
import sys

# Base URL from .env
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# Test state
admin_token = None
test_user_token = None
test_user_id = None
test_user2_token = None
test_user2_id = None

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
    import random
    import subprocess
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

def approve_kyc(user_id):
    """Admin approves KYC for a user"""
    # First submit KYC
    headers = {"Authorization": f"Bearer {test_user_token}"}
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

def get_wallet_balance(token, currency):
    """Get wallet balance for a currency"""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/wallets", headers=headers)
    if resp.status_code != 200:
        return None
    wallets = resp.json().get("wallets", [])
    for w in wallets:
        if w.get("currency") == currency:
            return w.get("balance", 0), w.get("locked", 0)
    return None, None

# ============================================================
# SECTION A: Google Sign-In
# ============================================================
def test_google_signin():
    test_section("A) Google Sign-In (both flows)")
    
    # Test 1: Missing credential
    log("Test 1: POST /api/auth/google with empty body → 400")
    resp = requests.post(f"{BASE_URL}/auth/google", json={})
    if resp.status_code == 400 and "Missing Google credential" in resp.text:
        log("✓ Empty body returns 400 with 'Missing Google credential'", "PASS")
    else:
        log(f"✗ Expected 400, got {resp.status_code}: {resp.text}", "FAIL")
    
    # Test 2: Invalid access_token
    log("Test 2: POST /api/auth/google with fake access_token → 401")
    resp = requests.post(f"{BASE_URL}/auth/google", json={"access_token": "fake-invalid-token"})
    if resp.status_code == 401:
        log("✓ Fake access_token returns 401", "PASS")
    else:
        log(f"✗ Expected 401, got {resp.status_code}: {resp.text}", "FAIL")
    
    # Test 3: Invalid credential (not a JWT)
    log("Test 3: POST /api/auth/google with invalid credential → 401")
    resp = requests.post(f"{BASE_URL}/auth/google", json={"credential": "not-a-jwt"})
    if resp.status_code == 401:
        log("✓ Invalid credential returns 401", "PASS")
    else:
        log(f"✗ Expected 401, got {resp.status_code}: {resp.text}", "FAIL")

# ============================================================
# SECTION B: Withdrawal Admin Approval Pipeline
# ============================================================
def test_withdrawal_pipeline():
    test_section("B) Withdrawal Admin Approval Pipeline")
    
    global test_user_token, test_user_id
    
    # Create fresh user
    test_user_token, test_user_id = create_test_user("withdraw")
    if not test_user_token:
        log("Failed to create test user", "FAIL")
        return
    
    # Approve KYC
    if not approve_kyc(test_user_id):
        log("Failed to approve KYC", "FAIL")
        return
    
    # Admin credits 500 USD
    if not admin_adjust_balance(test_user_id, "USD", 500):
        log("Failed to credit balance", "FAIL")
        return
    
    # Give user an ACTIVE card (request → activate → admin approve with activate_now)
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Request card
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "basic"})
    if resp.status_code != 200:
        log(f"Card request failed: {resp.status_code} {resp.text}", "FAIL")
        return
    card_id = resp.json().get("card", {}).get("id")
    log(f"Card requested: {card_id}", "PASS")
    
    # Activate with tx_hash
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate", headers=headers, json={
        "tx_hash": "0x" + "a" * 64
    })
    if resp.status_code != 200:
        log(f"Card activation failed: {resp.status_code} {resp.text}", "FAIL")
        return
    log("Card activation submitted", "PASS")
    
    # Admin approves with activate_now=true
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve", headers=admin_headers, json={
        "activate_now": True
    })
    if resp.status_code != 200:
        log(f"Admin card approval failed: {resp.status_code} {resp.text}", "FAIL")
        return
    log("Admin approved card with activate_now=true", "PASS")
    
    # Verify card is active
    resp = requests.get(f"{BASE_URL}/cards", headers=headers)
    cards = resp.json().get("cards", [])
    active_card = next((c for c in cards if c.get("id") == card_id), None)
    if active_card and active_card.get("status") == "active":
        log("✓ Card is now active", "PASS")
    else:
        log(f"✗ Card status is {active_card.get('status') if active_card else 'not found'}", "FAIL")
    
    # Test 4: Submit withdrawal request
    log("Test 4: POST /api/withdraw → creates pending request")
    resp = requests.post(f"{BASE_URL}/withdraw", headers=headers, json={
        "method": "bank_swift",
        "currency": "USD",
        "amount": 100,
        "destination": "DE89370400440532013000",
        "details": {
            "bank_name": "Test Bank",
            "account_holder": "Test User",
            "account_number": "123456789",
            "swift_code": "DEUTDEFF"
        }
    })
    if resp.status_code != 200:
        log(f"✗ Withdraw request failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    data = resp.json()
    if data.get("ok") and data.get("request", {}).get("status") == "pending":
        log("✓ Withdraw request created with status='pending'", "PASS")
        withdraw_id = data.get("request", {}).get("id")
    else:
        log(f"✗ Unexpected response: {data}", "FAIL")
        return
    
    # Test 5: Check wallet balance (should be 400, locked should be 100)
    log("Test 5: GET /api/wallets → USD balance=400, locked=100")
    balance, locked = get_wallet_balance(test_user_token, "USD")
    if balance == 400 and locked == 100:
        log(f"✓ USD balance={balance}, locked={locked}", "PASS")
    else:
        log(f"✗ Expected balance=400, locked=100, got balance={balance}, locked={locked}", "FAIL")
    
    # Test 6: Admin GET /api/admin/withdrawals
    log("Test 6: Admin GET /api/admin/withdrawals → contains pending request")
    resp = requests.get(f"{BASE_URL}/admin/withdrawals", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Admin withdrawals list failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    withdrawals = resp.json().get("withdrawals", [])
    pending_withdraw = next((w for w in withdrawals if w.get("id") == withdraw_id), None)
    if pending_withdraw and pending_withdraw.get("status") == "pending":
        log("✓ Admin can see pending withdrawal", "PASS")
    else:
        log("✗ Pending withdrawal not found in admin list", "FAIL")
    
    # Test 7: Admin approves withdrawal
    log("Test 7: Admin POST /api/admin/withdrawals/:id/approve → 200")
    resp = requests.post(f"{BASE_URL}/admin/withdrawals/{withdraw_id}/approve", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Admin approval failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    if resp.json().get("ok"):
        log("✓ Admin approved withdrawal", "PASS")
    else:
        log(f"✗ Unexpected response: {resp.json()}", "FAIL")
    
    # Test 8: Check wallet balance (should be 400, locked should be 0)
    log("Test 8: GET /api/wallets → USD balance=400, locked=0")
    balance, locked = get_wallet_balance(test_user_token, "USD")
    if balance == 400 and locked == 0:
        log(f"✓ USD balance={balance}, locked={locked}", "PASS")
    else:
        log(f"✗ Expected balance=400, locked=0, got balance={balance}, locked={locked}", "FAIL")
    
    # Test 9: Check transaction created
    log("Test 9: GET /api/transactions → contains withdraw transaction")
    resp = requests.get(f"{BASE_URL}/transactions", headers=headers)
    txs = resp.json().get("transactions", [])
    withdraw_tx = next((t for t in txs if t.get("type") == "withdraw" and t.get("status") == "completed"), None)
    if withdraw_tx:
        log("✓ Withdraw transaction created with status='completed'", "PASS")
    else:
        log("✗ Withdraw transaction not found", "FAIL")
    
    # Test 10: REJECT path - submit another withdrawal and reject
    log("Test 10: Submit another withdrawal and admin rejects")
    resp = requests.post(f"{BASE_URL}/withdraw", headers=headers, json={
        "method": "bank_swift",
        "currency": "USD",
        "amount": 50,
        "destination": "DE89370400440532013000"
    })
    if resp.status_code != 200:
        log(f"✗ Second withdraw request failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    withdraw_id2 = resp.json().get("request", {}).get("id")
    
    # Check balance (should be 350, locked 50)
    balance, locked = get_wallet_balance(test_user_token, "USD")
    if balance == 350 and locked == 50:
        log(f"✓ After 2nd withdraw: balance={balance}, locked={locked}", "PASS")
    else:
        log(f"✗ Expected balance=350, locked=50, got balance={balance}, locked={locked}", "FAIL")
    
    # Admin rejects
    resp = requests.post(f"{BASE_URL}/admin/withdrawals/{withdraw_id2}/reject", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Admin rejection failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    log("✓ Admin rejected withdrawal", "PASS")
    
    # Check balance (should be back to 400, locked 0)
    balance, locked = get_wallet_balance(test_user_token, "USD")
    if balance == 400 and locked == 0:
        log(f"✓ After rejection: balance={balance}, locked={locked}", "PASS")
    else:
        log(f"✗ Expected balance=400, locked=0, got balance={balance}, locked={locked}", "FAIL")

# ============================================================
# SECTION C: Card Limits + Delete
# ============================================================
def test_card_limits():
    test_section("C) Card Limits (max 3, 1 per tier) + Delete")
    
    # Create fresh KYC-approved user
    token, user_id = create_test_user("cards")
    if not token:
        log("Failed to create test user", "FAIL")
        return
    
    # Quick KYC approval via admin
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/kyc", headers=headers, json={
        "first_name": "Card", "last_name": "Test", "country": "US", "id_type": "passport", "id_number": "C123"
    })
    kyc_id = resp.json().get("kyc", {}).get("id")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve", headers=admin_headers)
    
    # Test 1: Request basic card
    log("Test 1: POST /cards/request {tier:'basic'} → 200")
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "basic"})
    if resp.status_code == 200:
        basic_card_id = resp.json().get("card", {}).get("id")
        log(f"✓ Basic card created: {basic_card_id}", "PASS")
    else:
        log(f"✗ Basic card request failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    # Test 2: Request another basic card (should fail)
    log("Test 2: POST /cards/request {tier:'basic'} again → 400 'Only one card per tier'")
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "basic"})
    if resp.status_code == 400 and "Only one card per tier" in resp.text:
        log("✓ Duplicate tier rejected", "PASS")
    else:
        log(f"✗ Expected 400 with 'Only one card per tier', got {resp.status_code}: {resp.text}", "FAIL")
    
    # Test 3: Request premium card
    log("Test 3: POST /cards/request {tier:'premium'} → 200")
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "premium"})
    if resp.status_code == 200:
        premium_card_id = resp.json().get("card", {}).get("id")
        log(f"✓ Premium card created: {premium_card_id}", "PASS")
    else:
        log(f"✗ Premium card request failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    # Test 4: Request elite card
    log("Test 4: POST /cards/request {tier:'elite'} → 200")
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "elite"})
    if resp.status_code == 200:
        elite_card_id = resp.json().get("card", {}).get("id")
        log(f"✓ Elite card created: {elite_card_id}", "PASS")
    else:
        log(f"✗ Elite card request failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    # Test 5: Try to request a 4th card (should fail - max 3)
    log("Test 5: POST /cards/request {tier:'basic'} → 400 (already have 3 cards)")
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "basic"})
    if resp.status_code == 400 and "maximum of 3" in resp.text:
        log("✓ Max 3 cards enforced", "PASS")
    else:
        log(f"✗ Expected 400 with 'maximum of 3', got {resp.status_code}: {resp.text}", "FAIL")
    
    # Test 6: Delete basic card
    log("Test 6: DELETE /cards/:basic_card_id → 200")
    resp = requests.delete(f"{BASE_URL}/cards/{basic_card_id}", headers=headers)
    if resp.status_code == 200:
        log("✓ Basic card deleted", "PASS")
    else:
        log(f"✗ Card deletion failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 7: Request basic card again (should succeed after delete)
    log("Test 7: POST /cards/request {tier:'basic'} → 200 (allowed after delete)")
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "basic"})
    if resp.status_code == 200:
        log("✓ Basic card re-requested successfully", "PASS")
    else:
        log(f"✗ Basic card re-request failed: {resp.status_code} {resp.text}", "FAIL")

# ============================================================
# SECTION D: 24h Card Activation Delay
# ============================================================
def test_card_24h_delay():
    test_section("D) 24h Card Activation Delay")
    
    # Create fresh KYC-approved user
    token, user_id = create_test_user("delay")
    if not token:
        log("Failed to create test user", "FAIL")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/kyc", headers=headers, json={
        "first_name": "Delay", "last_name": "Test", "country": "US", "id_type": "passport", "id_number": "D123"
    })
    kyc_id = resp.json().get("kyc", {}).get("id")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve", headers=admin_headers)
    
    # Request card
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "basic"})
    card_id = resp.json().get("card", {}).get("id")
    
    # Activate with tx_hash
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate", headers=headers, json={
        "tx_hash": "0x" + "b" * 64
    })
    
    # Admin approves WITHOUT activate_now
    log("Test 1: Admin approves card WITHOUT activate_now → status='activating'")
    resp = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve", headers=admin_headers, json={})
    if resp.status_code == 200:
        log("✓ Admin approved without activate_now", "PASS")
    else:
        log(f"✗ Admin approval failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    # Check card status
    resp = requests.get(f"{BASE_URL}/cards", headers=headers)
    cards = resp.json().get("cards", [])
    card = next((c for c in cards if c.get("id") == card_id), None)
    if card and card.get("status") == "activating":
        log(f"✓ Card status is 'activating', usable_at={card.get('usable_at')}", "PASS")
    else:
        log(f"✗ Expected status='activating', got {card.get('status') if card else 'not found'}", "FAIL")
    
    # Test 2: Admin approve with activate_now=true
    # Request another card
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "premium"})
    card_id2 = resp.json().get("card", {}).get("id")
    resp = requests.post(f"{BASE_URL}/cards/{card_id2}/activate", headers=headers, json={
        "tx_hash": "0x" + "c" * 64
    })
    
    log("Test 2: Admin approves card WITH activate_now=true → status='active' immediately")
    resp = requests.post(f"{BASE_URL}/admin/cards/{card_id2}/approve", headers=admin_headers, json={
        "activate_now": True
    })
    if resp.status_code == 200:
        log("✓ Admin approved with activate_now=true", "PASS")
    else:
        log(f"✗ Admin approval failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    # Check card status
    resp = requests.get(f"{BASE_URL}/cards", headers=headers)
    cards = resp.json().get("cards", [])
    card2 = next((c for c in cards if c.get("id") == card_id2), None)
    if card2 and card2.get("status") == "active":
        log(f"✓ Card status is 'active' immediately", "PASS")
    else:
        log(f"✗ Expected status='active', got {card2.get('status') if card2 else 'not found'}", "FAIL")

# ============================================================
# SECTION E: Extended KYC + Admin Detail
# ============================================================
def test_extended_kyc():
    test_section("E) Extended KYC + Admin Detail")
    
    # Create fresh user
    token, user_id = create_test_user("kyc")
    if not token:
        log("Failed to create test user", "FAIL")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Submit KYC with extended fields including base64 image
    log("Test 1: POST /api/kyc with extended fields + base64 image → 200")
    small_base64_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    resp = requests.post(f"{BASE_URL}/kyc", headers=headers, json={
        "first_name": "Extended",
        "last_name": "KYC",
        "mobile": "+1234567890",
        "country": "US",
        "state": "CA",
        "city": "San Francisco",
        "address": "123 Main St",
        "postal_code": "94102",
        "occupation": "Engineer",
        "id_type": "passport",
        "id_number": "E123456789",
        "doc_front": small_base64_image,
        "doc_back": small_base64_image,
        "selfie": small_base64_image
    })
    if resp.status_code != 200:
        log(f"✗ KYC submission failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    kyc_id = resp.json().get("kyc", {}).get("id")
    log(f"✓ KYC submitted with extended fields: {kyc_id}", "PASS")
    
    # Test 2: Admin GET /api/admin/kyc → contains the record
    log("Test 2: Admin GET /api/admin/kyc → contains record")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.get(f"{BASE_URL}/admin/kyc", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Admin KYC list failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    kyc_list = resp.json().get("kyc", [])
    kyc_record = next((k for k in kyc_list if k.get("id") == kyc_id), None)
    if kyc_record:
        log("✓ KYC record found in admin list", "PASS")
    else:
        log("✗ KYC record not found", "FAIL")
    
    # Test 3: Admin GET /api/admin/kyc/:id → returns {kyc, user}
    log("Test 3: Admin GET /api/admin/kyc/:id → returns {kyc, user}")
    resp = requests.get(f"{BASE_URL}/admin/kyc/{kyc_id}", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Admin KYC detail failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    data = resp.json()
    if "kyc" in data and "user" in data:
        kyc_detail = data.get("kyc", {})
        if kyc_detail.get("doc_front") and kyc_detail.get("first_name") == "Extended":
            log("✓ KYC detail contains all fields including doc_front", "PASS")
        else:
            log("✗ KYC detail missing expected fields", "FAIL")
    else:
        log(f"✗ Expected {{kyc, user}}, got {list(data.keys())}", "FAIL")

# ============================================================
# SECTION F: Profile Avatar + Edit
# ============================================================
def test_profile_avatar():
    test_section("F) Profile Avatar + Edit")
    
    # Create fresh user
    token, user_id = create_test_user("avatar")
    if not token:
        log("Failed to create test user", "FAIL")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: PUT /api/profile with avatar + address
    log("Test 1: PUT /api/profile with avatar + address → 200")
    small_base64_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    resp = requests.put(f"{BASE_URL}/profile", headers=headers, json={
        "avatar": small_base64_image,
        "address": "123 Main St",
        "city": "Berlin"
    })
    if resp.status_code != 200:
        log(f"✗ Profile update failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    log("✓ Profile updated with avatar", "PASS")
    
    # Test 2: GET /api/auth/me → user.avatar present
    log("Test 2: GET /api/auth/me → user.avatar present, address='123 Main St'")
    resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    if resp.status_code != 200:
        log(f"✗ Auth/me failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    user = resp.json().get("user", {})
    if user.get("avatar") and user.get("address") == "123 Main St":
        log("✓ Avatar and address present in user profile", "PASS")
    else:
        log(f"✗ Avatar or address missing: avatar={bool(user.get('avatar'))}, address={user.get('address')}", "FAIL")
    
    # Test 3: PUT /api/profile with too large avatar → 400
    log("Test 3: PUT /api/profile with avatar > 3MB → 400 'too large'")
    large_avatar = "x" * 4_000_000
    resp = requests.put(f"{BASE_URL}/profile", headers=headers, json={
        "avatar": large_avatar
    })
    if resp.status_code == 400 and "too large" in resp.text.lower():
        log("✓ Large avatar rejected", "PASS")
    else:
        log(f"✗ Expected 400 with 'too large', got {resp.status_code}: {resp.text}", "FAIL")

# ============================================================
# SECTION G: Admin Notifications
# ============================================================
def test_admin_notifications():
    test_section("G) Admin Notifications")
    
    log("Test: GET /api/admin/notifications → {counts, total, items}")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.get(f"{BASE_URL}/admin/notifications", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Admin notifications failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    data = resp.json()
    if "counts" in data and "total" in data and "items" in data:
        counts = data.get("counts", {})
        if "deposits" in counts and "withdrawals" in counts and "kyc" in counts and "cards" in counts:
            log(f"✓ Notifications shape correct: counts={counts}, total={data.get('total')}, items={len(data.get('items', []))}", "PASS")
        else:
            log(f"✗ Counts missing expected keys: {counts}", "FAIL")
    else:
        log(f"✗ Expected {{counts, total, items}}, got {list(data.keys())}", "FAIL")

# ============================================================
# SECTION H: Admin Delete Card / Transaction
# ============================================================
def test_admin_delete():
    test_section("H) Admin Delete Card / Transaction")
    
    # Create a test card and transaction
    token, user_id = create_test_user("delete")
    if not token:
        log("Failed to create test user", "FAIL")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/kyc", headers=headers, json={
        "first_name": "Delete", "last_name": "Test", "country": "US", "id_type": "passport", "id_number": "DEL123"
    })
    kyc_id = resp.json().get("kyc", {}).get("id")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve", headers=admin_headers)
    
    # Create card
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers, json={"tier": "basic"})
    card_id = resp.json().get("card", {}).get("id")
    
    # Test 1: Admin DELETE /api/admin/cards/:id → 200
    log("Test 1: Admin DELETE /api/admin/cards/:id → 200")
    resp = requests.delete(f"{BASE_URL}/admin/cards/{card_id}", headers=admin_headers)
    if resp.status_code == 200:
        log("✓ Admin deleted card", "PASS")
    else:
        log(f"✗ Admin card deletion failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Create a transaction (transfer to admin)
    admin_adjust_balance(user_id, "USD", 100)
    resp = requests.post(f"{BASE_URL}/transfer", headers=headers, json={
        "recipient": ADMIN_EMAIL,
        "amount": 10,
        "currency": "USD"
    })
    
    # Get transaction ID
    resp = requests.get(f"{BASE_URL}/transactions", headers=headers)
    txs = resp.json().get("transactions", [])
    if txs:
        tx_id = txs[0].get("id")
        
        # Test 2: Admin DELETE /api/admin/transactions/:id → 200
        log("Test 2: Admin DELETE /api/admin/transactions/:id → 200")
        resp = requests.delete(f"{BASE_URL}/admin/transactions/{tx_id}", headers=admin_headers)
        if resp.status_code == 200:
            log("✓ Admin deleted transaction", "PASS")
        else:
            log(f"✗ Admin transaction deletion failed: {resp.status_code} {resp.text}", "FAIL")
    else:
        log("⚠ No transactions to delete", "INFO")

# ============================================================
# SECTION I: Admin Overview Enhancements
# ============================================================
def test_admin_overview():
    test_section("I) Admin Overview Enhancements")
    
    log("Test: GET /api/admin/overview → includes deposits_pending & withdrawals_pending")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.get(f"{BASE_URL}/admin/overview", headers=admin_headers)
    if resp.status_code != 200:
        log(f"✗ Admin overview failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    data = resp.json()
    if "deposits_pending" in data and "withdrawals_pending" in data:
        log(f"✓ Overview includes deposits_pending={data.get('deposits_pending')}, withdrawals_pending={data.get('withdrawals_pending')}", "PASS")
    else:
        log(f"✗ Missing deposits_pending or withdrawals_pending: {list(data.keys())}", "FAIL")

# ============================================================
# SECTION J: 2FA Endpoint Smoke Test
# ============================================================
def test_2fa_setup():
    test_section("J) 2FA Endpoint Smoke Test")
    
    # Create fresh user
    token, user_id = create_test_user("2fa")
    if not token:
        log("Failed to create test user", "FAIL")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    log("Test: POST /api/profile/2fa/setup → {secret, uri, qr_svg}")
    resp = requests.post(f"{BASE_URL}/profile/2fa/setup", headers=headers)
    if resp.status_code != 200:
        log(f"✗ 2FA setup failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    data = resp.json()
    if "secret" in data and "uri" in data and "qr_svg" in data:
        if data.get("secret") and data.get("uri") and data.get("qr_svg"):
            log("✓ 2FA setup returns non-empty secret, uri, qr_svg", "PASS")
        else:
            log("✗ 2FA setup returns empty values", "FAIL")
    else:
        log(f"✗ Expected {{secret, uri, qr_svg}}, got {list(data.keys())}", "FAIL")

# ============================================================
# REGRESSION TESTS
# ============================================================
def test_regression():
    test_section("REGRESSION: Core Endpoints")
    
    # Test 1: GET /api/health
    log("Test 1: GET /api/health → 200 {ok:true}")
    resp = requests.get(f"{BASE_URL}/health")
    if resp.status_code == 200 and resp.json().get("ok"):
        log("✓ Health endpoint working", "PASS")
    else:
        log(f"✗ Health endpoint failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 2: GET /api/config
    log("Test 2: GET /api/config → 200 with fiat, crypto, activation_wallet")
    resp = requests.get(f"{BASE_URL}/config")
    if resp.status_code == 200:
        data = resp.json()
        if "fiat" in data and "crypto" in data and "activation_wallet" in data:
            log("✓ Config endpoint working", "PASS")
        else:
            log(f"✗ Config missing keys: {list(data.keys())}", "FAIL")
    else:
        log(f"✗ Config endpoint failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 3: GET /api/rates
    log("Test 3: GET /api/rates → 200 with fx and crypto_usd")
    resp = requests.get(f"{BASE_URL}/rates")
    if resp.status_code == 200:
        data = resp.json()
        if "fx" in data and "crypto_usd" in data:
            log(f"✓ Rates endpoint working (fx keys={len(data.get('fx', {}))}, crypto keys={len(data.get('crypto_usd', {}))})", "PASS")
        else:
            log(f"✗ Rates missing keys: {list(data.keys())}", "FAIL")
    else:
        log(f"✗ Rates endpoint failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 4: POST /api/auth/login (admin)
    log("Test 4: POST /api/auth/login (admin) → 200 with token")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200 and resp.json().get("token"):
        log("✓ Admin login working", "PASS")
    else:
        log(f"✗ Admin login failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 5: POST /api/transfer between two users
    log("Test 5: POST /api/transfer between two users → balances update")
    user1_token, user1_id = create_test_user("reg1")
    user2_token, user2_id = create_test_user("reg2")
    
    if not user1_token or not user2_token:
        log("✗ Failed to create test users for transfer", "FAIL")
        return
    
    # Admin credits user1 with 100 USD
    admin_adjust_balance(user1_id, "USD", 100)
    
    # User1 transfers 50 USD to user2
    headers1 = {"Authorization": f"Bearer {user1_token}"}
    resp = requests.post(f"{BASE_URL}/transfer", headers=headers1, json={
        "recipient": user2_id,
        "amount": 50,
        "currency": "USD"
    })
    if resp.status_code == 200:
        # Check balances
        balance1, _ = get_wallet_balance(user1_token, "USD")
        balance2, _ = get_wallet_balance(user2_token, "USD")
        if balance1 == 50 and balance2 == 50:
            log(f"✓ Transfer working (user1={balance1}, user2={balance2})", "PASS")
        else:
            log(f"✗ Transfer balances incorrect (user1={balance1}, user2={balance2})", "FAIL")
    else:
        log(f"✗ Transfer failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 6: POST /api/deposit (creates pending; admin approves)
    log("Test 6: POST /api/deposit → creates pending, admin approves → wallet credited")
    user3_token, user3_id = create_test_user("reg3")
    if not user3_token:
        log("✗ Failed to create test user for deposit", "FAIL")
        return
    
    # Approve KYC
    headers3 = {"Authorization": f"Bearer {user3_token}"}
    resp = requests.post(f"{BASE_URL}/kyc", headers=headers3, json={
        "first_name": "Reg", "last_name": "Test", "country": "US", "id_type": "passport", "id_number": "R123"
    })
    kyc_id = resp.json().get("kyc", {}).get("id")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve", headers=admin_headers)
    
    # Submit deposit
    resp = requests.post(f"{BASE_URL}/deposit", headers=headers3, json={
        "method": "bank",
        "amount": 200,
        "currency": "USD"
    })
    if resp.status_code != 200:
        log(f"✗ Deposit request failed: {resp.status_code} {resp.text}", "FAIL")
        return
    
    deposit_id = resp.json().get("request", {}).get("id")
    
    # Admin approves
    resp = requests.post(f"{BASE_URL}/admin/deposits/{deposit_id}/approve", headers=admin_headers)
    if resp.status_code == 200:
        # Check balance
        balance, _ = get_wallet_balance(user3_token, "USD")
        if balance == 200:
            log(f"✓ Deposit flow working (balance={balance})", "PASS")
        else:
            log(f"✗ Deposit balance incorrect (balance={balance})", "FAIL")
    else:
        log(f"✗ Deposit approval failed: {resp.status_code} {resp.text}", "FAIL")
    
    # Test 7: POST /api/cards/:id/activate (still requires tx_hash)
    log("Test 7: POST /api/cards/:id/activate → requires tx_hash")
    resp = requests.post(f"{BASE_URL}/cards/request", headers=headers3, json={"tier": "basic"})
    card_id = resp.json().get("card", {}).get("id")
    
    # Try activate without tx_hash
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate", headers=headers3, json={})
    if resp.status_code == 400 and "transaction hash" in resp.text.lower():
        log("✓ Card activation requires tx_hash", "PASS")
    else:
        log(f"✗ Expected 400 with tx_hash error, got {resp.status_code}: {resp.text}", "FAIL")
    
    # Activate with tx_hash
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate", headers=headers3, json={
        "tx_hash": "0x" + "d" * 64
    })
    if resp.status_code == 200:
        log("✓ Card activation with tx_hash working", "PASS")
    else:
        log(f"✗ Card activation failed: {resp.status_code} {resp.text}", "FAIL")

# ============================================================
# MAIN
# ============================================================
def main():
    print("\n" + "="*80)
    print("  AURELA BACKEND REGRESSION TEST SUITE")
    print("  Testing major feature drop + regression")
    print("="*80)
    
    # Login as admin first
    admin_login()
    
    # Run all test sections
    test_google_signin()
    test_withdrawal_pipeline()
    test_card_limits()
    test_card_24h_delay()
    test_extended_kyc()
    test_profile_avatar()
    test_admin_notifications()
    test_admin_delete()
    test_admin_overview()
    test_2fa_setup()
    test_regression()
    
    print("\n" + "="*80)
    print("  TEST SUITE COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
