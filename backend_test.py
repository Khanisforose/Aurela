#!/usr/bin/env python3
"""
Aurela Backend API Test Suite
Tests all backend endpoints as per review request
"""

import requests
import json
import sys
from typing import Dict, Any

# Base URL from environment
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

# Test data
ADMIN_EMAIL = "admin@aurela.io"
ADMIN_PASSWORD = "Admin@123"

# Test users
USER1_DATA = {
    "email": "sophia.martinez@example.com",
    "username": "sophia_m",
    "password": "SecurePass123!",
    "full_name": "Sophia Martinez",
    "phone": "+1-555-0101"
}

USER2_DATA = {
    "email": "james.chen@example.com",
    "username": "james_chen",
    "password": "SecurePass456!",
    "full_name": "James Chen",
    "phone": "+1-555-0202"
}

# Global state
admin_token = None
user1_token = None
user2_token = None
user1_id = None
user2_id = None
test_card_id = None
test_kyc_id = None

def log_test(name: str):
    """Log test name"""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def log_success(msg: str):
    """Log success message"""
    print(f"✅ SUCCESS: {msg}")

def log_error(msg: str):
    """Log error message"""
    print(f"❌ FAILURE: {msg}")

def log_info(msg: str):
    """Log info message"""
    print(f"ℹ️  INFO: {msg}")

def make_request(method: str, endpoint: str, token: str = None, data: Dict = None, params: Dict = None) -> tuple:
    """Make HTTP request and return (success, response_data, status_code)"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=data, timeout=10)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=10)
        else:
            return False, {"error": "Invalid method"}, 0
        
        try:
            response_data = resp.json()
        except Exception:
            response_data = {"raw": resp.text}
        
        return resp.ok, response_data, resp.status_code
    except Exception as e:
        return False, {"error": str(e)}, 0

# ============================================================
# 1. PUBLIC ENDPOINTS
# ============================================================

def test_health():
    """Test GET /health"""
    log_test("Public: GET /health")
    success, data, status = make_request("GET", "/health")
    
    if not success or status != 200:
        log_error(f"Health check failed: {status} - {data}")
        return False
    
    if data.get("ok") != True:
        log_error(f"Health check returned unexpected data: {data}")
        return False
    
    log_success("Health endpoint working")
    return True

def test_config():
    """Test GET /config"""
    log_test("Public: GET /config")
    success, data, status = make_request("GET", "/config")
    
    if not success or status != 200:
        log_error(f"Config failed: {status} - {data}")
        return False
    
    # Verify required fields
    required = ["fiat", "crypto", "networks", "card_tiers", "activation_wallet", "activation_fees"]
    for field in required:
        if field not in data:
            log_error(f"Config missing field: {field}")
            return False
    
    # Verify counts
    if len(data["fiat"]) != 10:
        log_error(f"Expected 10 fiat currencies, got {len(data['fiat'])}")
        return False
    
    if len(data["crypto"]) != 10:
        log_error(f"Expected 10 crypto currencies, got {len(data['crypto'])}")
        return False
    
    log_success(f"Config endpoint working: {len(data['fiat'])} fiat, {len(data['crypto'])} crypto")
    return True

def test_rates():
    """Test GET /rates"""
    log_test("Public: GET /rates")
    success, data, status = make_request("GET", "/rates")
    
    if not success or status != 200:
        log_error(f"Rates failed: {status} - {data}")
        return False
    
    if "fx" not in data or "crypto_usd" not in data:
        log_error(f"Rates missing fx or crypto_usd: {data}")
        return False
    
    log_success(f"Rates endpoint working: {len(data['fx'])} fx rates, {len(data['crypto_usd'])} crypto rates")
    return True

# ============================================================
# 2. AUTH
# ============================================================

def test_register_user1():
    """Test POST /auth/register for user1"""
    global user1_token, user1_id
    log_test("Auth: Register User 1")
    
    success, data, status = make_request("POST", "/auth/register", data=USER1_DATA)
    
    if not success or status != 200:
        log_error(f"Registration failed: {status} - {data}")
        return False
    
    if "token" not in data or "user" not in data:
        log_error(f"Registration response missing token or user: {data}")
        return False
    
    user = data["user"]
    
    # Verify user fields
    if user.get("email") != USER1_DATA["email"].lower():
        log_error(f"Email mismatch: {user.get('email')} != {USER1_DATA['email'].lower()}")
        return False
    
    if user.get("role") != "user":
        log_error(f"Expected role=user, got {user.get('role')}")
        return False
    
    if user.get("kyc_status") != "unverified":
        log_error(f"Expected kyc_status=unverified, got {user.get('kyc_status')}")
        return False
    
    user1_token = data["token"]
    user1_id = user["id"]
    
    log_success(f"User1 registered: {user['username']} (ID: {user1_id})")
    return True

def test_verify_wallets_user1():
    """Verify user1 has 20 wallets with welcome bonuses"""
    log_test("Auth: Verify User1 Wallets (20 wallets, USD=1000, USDT=100)")
    
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    
    if not success or status != 200:
        log_error(f"Failed to get wallets: {status} - {data}")
        return False
    
    wallets = data.get("wallets", [])
    
    if len(wallets) != 20:
        log_error(f"Expected 20 wallets, got {len(wallets)}")
        return False
    
    # Find USD and USDT wallets
    usd_wallet = next((w for w in wallets if w["currency"] == "USD"), None)
    usdt_wallet = next((w for w in wallets if w["currency"] == "USDT"), None)
    
    if not usd_wallet:
        log_error("USD wallet not found")
        return False
    
    if not usdt_wallet:
        log_error("USDT wallet not found")
        return False
    
    if usd_wallet["balance"] != 1000:
        log_error(f"Expected USD balance=1000, got {usd_wallet['balance']}")
        return False
    
    if usdt_wallet["balance"] != 100:
        log_error(f"Expected USDT balance=100, got {usdt_wallet['balance']}")
        return False
    
    log_success(f"User1 has 20 wallets: USD={usd_wallet['balance']}, USDT={usdt_wallet['balance']}")
    return True

def test_register_user2():
    """Test POST /auth/register for user2"""
    global user2_token, user2_id
    log_test("Auth: Register User 2")
    
    success, data, status = make_request("POST", "/auth/register", data=USER2_DATA)
    
    if not success or status != 200:
        log_error(f"Registration failed: {status} - {data}")
        return False
    
    user2_token = data["token"]
    user2_id = data["user"]["id"]
    
    log_success(f"User2 registered: {data['user']['username']} (ID: {user2_id})")
    return True

def test_login():
    """Test POST /auth/login"""
    log_test("Auth: Login with email")
    
    success, data, status = make_request("POST", "/auth/login", data={
        "identifier": USER1_DATA["email"],
        "password": USER1_DATA["password"]
    })
    
    if not success or status != 200:
        log_error(f"Login failed: {status} - {data}")
        return False
    
    if "token" not in data or "user" not in data:
        log_error(f"Login response missing token or user: {data}")
        return False
    
    log_success(f"Login successful for {data['user']['username']}")
    return True

def test_auth_me():
    """Test GET /auth/me"""
    log_test("Auth: GET /auth/me")
    
    success, data, status = make_request("GET", "/auth/me", token=user1_token)
    
    if not success or status != 200:
        log_error(f"Auth me failed: {status} - {data}")
        return False
    
    if "user" not in data:
        log_error(f"Auth me response missing user: {data}")
        return False
    
    log_success(f"Auth me successful: {data['user']['username']}")
    return True

def test_login_wrong_password():
    """Test POST /auth/login with wrong password"""
    log_test("Auth: Login with wrong password (should fail)")
    
    success, data, status = make_request("POST", "/auth/login", data={
        "identifier": USER1_DATA["email"],
        "password": "WrongPassword123!"
    })
    
    if status != 401:
        log_error(f"Expected 401, got {status}")
        return False
    
    log_success("Wrong password correctly rejected with 401")
    return True

def test_register_duplicate():
    """Test POST /auth/register with duplicate email"""
    log_test("Auth: Register duplicate email (should fail)")
    
    success, data, status = make_request("POST", "/auth/register", data=USER1_DATA)
    
    if status != 400:
        log_error(f"Expected 400, got {status}")
        return False
    
    log_success("Duplicate email correctly rejected with 400")
    return True

# ============================================================
# 3. WALLETS & RATES
# ============================================================

def test_wallets_with_totals():
    """Test GET /wallets with totals"""
    log_test("Wallets: GET /wallets with totals")
    
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    
    if not success or status != 200:
        log_error(f"Failed to get wallets: {status} - {data}")
        return False
    
    if "totals" not in data:
        log_error(f"Wallets response missing totals: {data}")
        return False
    
    totals = data["totals"]
    required = ["usd", "preferred", "preferred_currency"]
    for field in required:
        if field not in totals:
            log_error(f"Totals missing field: {field}")
            return False
    
    # Verify enriched fields in wallets
    wallets = data.get("wallets", [])
    if wallets:
        wallet = wallets[0]
        if "balance_usd" not in wallet or "preferred_value" not in wallet:
            log_error(f"Wallet missing enriched fields: {wallet}")
            return False
    
    log_success(f"Wallets with totals: USD={totals['usd']:.2f}, Preferred={totals['preferred']:.2f} {totals['preferred_currency']}")
    return True

def test_preferred_currency():
    """Test PUT /profile to change preferred currency and verify wallets"""
    log_test("Wallets: Change preferred currency to EUR")
    
    # Update to EUR
    success, data, status = make_request("PUT", "/profile", token=user1_token, data={
        "preferred_currency": "EUR"
    })
    
    if not success or status != 200:
        log_error(f"Failed to update profile: {status} - {data}")
        return False
    
    # Get wallets and verify
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    
    if not success or status != 200:
        log_error(f"Failed to get wallets: {status} - {data}")
        return False
    
    totals = data.get("totals", {})
    if totals.get("preferred_currency") != "EUR":
        log_error(f"Expected preferred_currency=EUR, got {totals.get('preferred_currency')}")
        return False
    
    log_success(f"Preferred currency changed to EUR: {totals['preferred']:.2f} EUR")
    return True

# ============================================================
# 4. INTERNAL TRANSFER
# ============================================================

def test_transfer_by_username():
    """Test POST /transfer by username"""
    log_test("Transfer: Send 50 USD from User1 to User2 by username")
    
    # Get initial balances
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    user1_usd_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    success, data, status = make_request("GET", "/wallets", token=user2_token)
    user2_usd_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    # Transfer
    success, data, status = make_request("POST", "/transfer", token=user1_token, data={
        "recipient": USER2_DATA["username"],
        "currency": "USD",
        "amount": 50,
        "note": "Test transfer by username"
    })
    
    if not success or status != 200:
        log_error(f"Transfer failed: {status} - {data}")
        return False
    
    # Verify balances
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    user1_usd_after = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    success, data, status = make_request("GET", "/wallets", token=user2_token)
    user2_usd_after = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    if user1_usd_after != user1_usd_before - 50:
        log_error(f"User1 balance incorrect: {user1_usd_before} -> {user1_usd_after} (expected {user1_usd_before - 50})")
        return False
    
    if user2_usd_after != user2_usd_before + 50:
        log_error(f"User2 balance incorrect: {user2_usd_before} -> {user2_usd_after} (expected {user2_usd_before + 50})")
        return False
    
    log_success(f"Transfer by username successful: User1 {user1_usd_before} -> {user1_usd_after}, User2 {user2_usd_before} -> {user2_usd_after}")
    return True

def test_transfer_by_email():
    """Test POST /transfer by email"""
    log_test("Transfer: Send 5 USDT from User1 to User2 by email")
    
    # Get initial balances
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    user1_usdt_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USDT"), 0)
    
    success, data, status = make_request("GET", "/wallets", token=user2_token)
    user2_usdt_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USDT"), 0)
    
    # Transfer
    success, data, status = make_request("POST", "/transfer", token=user1_token, data={
        "recipient": USER2_DATA["email"],
        "currency": "USDT",
        "amount": 5,
        "note": "Test transfer by email"
    })
    
    if not success or status != 200:
        log_error(f"Transfer failed: {status} - {data}")
        return False
    
    # Verify balances
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    user1_usdt_after = next((w["balance"] for w in data["wallets"] if w["currency"] == "USDT"), 0)
    
    success, data, status = make_request("GET", "/wallets", token=user2_token)
    user2_usdt_after = next((w["balance"] for w in data["wallets"] if w["currency"] == "USDT"), 0)
    
    if user1_usdt_after != user1_usdt_before - 5:
        log_error(f"User1 USDT balance incorrect: {user1_usdt_before} -> {user1_usdt_after}")
        return False
    
    if user2_usdt_after != user2_usdt_before + 5:
        log_error(f"User2 USDT balance incorrect: {user2_usdt_before} -> {user2_usdt_after}")
        return False
    
    log_success(f"Transfer by email successful: User1 {user1_usdt_before} -> {user1_usdt_after}, User2 {user2_usdt_before} -> {user2_usdt_after}")
    return True

def test_transfer_by_id():
    """Test POST /transfer by user ID"""
    log_test("Transfer: Send 10 USD from User2 to User1 by user ID")
    
    # Get initial balances
    success, data, status = make_request("GET", "/wallets", token=user2_token)
    user2_usd_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    user1_usd_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    # Transfer
    success, data, status = make_request("POST", "/transfer", token=user2_token, data={
        "recipient": user1_id,
        "currency": "USD",
        "amount": 10,
        "note": "Test transfer by ID"
    })
    
    if not success or status != 200:
        log_error(f"Transfer failed: {status} - {data}")
        return False
    
    log_success("Transfer by user ID successful")
    return True

def test_transfer_insufficient_balance():
    """Test POST /transfer with insufficient balance"""
    log_test("Transfer: Insufficient balance (should fail)")
    
    success, data, status = make_request("POST", "/transfer", token=user1_token, data={
        "recipient": USER2_DATA["username"],
        "currency": "USD",
        "amount": 999999,
        "note": "Should fail"
    })
    
    if status != 400:
        log_error(f"Expected 400, got {status}")
        return False
    
    log_success("Insufficient balance correctly rejected with 400")
    return True

def test_transfer_self():
    """Test POST /transfer to self"""
    log_test("Transfer: Self-transfer (should fail)")
    
    success, data, status = make_request("POST", "/transfer", token=user1_token, data={
        "recipient": USER1_DATA["username"],
        "currency": "USD",
        "amount": 10,
        "note": "Should fail"
    })
    
    if status != 400:
        log_error(f"Expected 400, got {status}")
        return False
    
    log_success("Self-transfer correctly rejected with 400")
    return True

def test_transfer_unknown_recipient():
    """Test POST /transfer to unknown recipient"""
    log_test("Transfer: Unknown recipient (should fail)")
    
    success, data, status = make_request("POST", "/transfer", token=user1_token, data={
        "recipient": "nonexistent_user_xyz",
        "currency": "USD",
        "amount": 10,
        "note": "Should fail"
    })
    
    if status != 404:
        log_error(f"Expected 404, got {status}")
        return False
    
    log_success("Unknown recipient correctly rejected with 404")
    return True

def test_verify_transaction_record():
    """Test GET /transactions to verify transfer records"""
    log_test("Transfer: Verify transaction records")
    
    success, data, status = make_request("GET", "/transactions", token=user1_token)
    
    if not success or status != 200:
        log_error(f"Failed to get transactions: {status} - {data}")
        return False
    
    transactions = data.get("transactions", [])
    
    if len(transactions) == 0:
        log_error("No transactions found")
        return False
    
    # Find transfer transactions
    transfers = [tx for tx in transactions if tx.get("type") == "internal_transfer"]
    
    if len(transfers) == 0:
        log_error("No transfer transactions found")
        return False
    
    log_success(f"Transaction records verified: {len(transfers)} transfers found")
    return True

# ============================================================
# 5. DEPOSIT & WITHDRAW
# ============================================================

def test_deposit():
    """Test POST /deposit"""
    log_test("Deposit: Add 200 USD via bank")
    
    # Get initial balance
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usd_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    # Deposit
    success, data, status = make_request("POST", "/deposit", token=user1_token, data={
        "method": "bank",
        "currency": "USD",
        "amount": 200
    })
    
    if not success or status != 200:
        log_error(f"Deposit failed: {status} - {data}")
        return False
    
    # Verify balance
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usd_after = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    if usd_after != usd_before + 200:
        log_error(f"Balance incorrect: {usd_before} -> {usd_after} (expected {usd_before + 200})")
        return False
    
    log_success(f"Deposit successful: {usd_before} -> {usd_after}")
    return True

def test_withdraw():
    """Test POST /withdraw"""
    log_test("Withdraw: Remove 100 USD via bank")
    
    # Get initial balance
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usd_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    # Withdraw
    success, data, status = make_request("POST", "/withdraw", token=user1_token, data={
        "method": "bank",
        "currency": "USD",
        "amount": 100,
        "destination": "acct-x"
    })
    
    if not success or status != 200:
        log_error(f"Withdraw failed: {status} - {data}")
        return False
    
    # Verify balance
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usd_after = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    if usd_after != usd_before - 100:
        log_error(f"Balance incorrect: {usd_before} -> {usd_after} (expected {usd_before - 100})")
        return False
    
    log_success(f"Withdraw successful: {usd_before} -> {usd_after}")
    return True

def test_transactions_list():
    """Test GET /transactions includes deposits and withdrawals"""
    log_test("Transactions: Verify deposits and withdrawals in list")
    
    success, data, status = make_request("GET", "/transactions", token=user1_token)
    
    if not success or status != 200:
        log_error(f"Failed to get transactions: {status} - {data}")
        return False
    
    transactions = data.get("transactions", [])
    
    # Find deposit and withdraw
    deposits = [tx for tx in transactions if tx.get("type") == "deposit"]
    withdrawals = [tx for tx in transactions if tx.get("type") == "withdraw"]
    
    if len(deposits) == 0:
        log_error("No deposit transactions found")
        return False
    
    if len(withdrawals) == 0:
        log_error("No withdraw transactions found")
        return False
    
    log_success(f"Transactions list verified: {len(deposits)} deposits, {len(withdrawals)} withdrawals")
    return True

# ============================================================
# 6. CARDS
# ============================================================

def test_card_request_basic():
    """Test POST /cards/request for basic tier"""
    global test_card_id
    log_test("Cards: Request basic tier card")
    
    success, data, status = make_request("POST", "/cards/request", token=user1_token, data={
        "tier": "basic"
    })
    
    if not success or status != 200:
        log_error(f"Card request failed: {status} - {data}")
        return False
    
    card = data.get("card", {})
    
    if card.get("status") != "pending_activation":
        log_error(f"Expected status=pending_activation, got {card.get('status')}")
        return False
    
    if card.get("activation_fee_usdt") != 10:
        log_error(f"Expected activation_fee_usdt=10, got {card.get('activation_fee_usdt')}")
        return False
    
    if not card.get("activation_wallet"):
        log_error("Missing activation_wallet")
        return False
    
    test_card_id = card.get("id")
    
    log_success(f"Basic card requested: {card['number']}, fee={card['activation_fee_usdt']} USDT")
    return True

def test_card_activate_wallet():
    """Test POST /cards/{id}/activate with pay_from_wallet"""
    log_test("Cards: Activate card with wallet payment")
    
    # Get initial USDT balance
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usdt_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USDT"), 0)
    
    # Activate
    success, data, status = make_request("POST", f"/cards/{test_card_id}/activate", token=user1_token, data={
        "pay_from_wallet": True
    })
    
    if not success or status != 200:
        log_error(f"Card activation failed: {status} - {data}")
        return False
    
    card = data.get("card", {})
    
    if card.get("status") != "active":
        log_error(f"Expected status=active, got {card.get('status')}")
        return False
    
    # Verify USDT balance decreased
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usdt_after = next((w["balance"] for w in data["wallets"] if w["currency"] == "USDT"), 0)
    
    if usdt_after != usdt_before - 10:
        log_error(f"USDT balance incorrect: {usdt_before} -> {usdt_after} (expected {usdt_before - 10})")
        return False
    
    log_success(f"Card activated with wallet: USDT {usdt_before} -> {usdt_after}")
    return True

def test_card_request_premium():
    """Test POST /cards/request for premium tier"""
    log_test("Cards: Request premium tier card")
    
    success, data, status = make_request("POST", "/cards/request", token=user1_token, data={
        "tier": "premium"
    })
    
    if not success or status != 200:
        log_error(f"Card request failed: {status} - {data}")
        return False
    
    card = data.get("card", {})
    premium_card_id = card.get("id")
    
    # Activate with tx_hash
    success, data, status = make_request("POST", f"/cards/{premium_card_id}/activate", token=user1_token, data={
        "tx_hash": "0xdeadbeef1234567890abcdef"
    })
    
    if not success or status != 200:
        log_error(f"Card activation failed: {status} - {data}")
        return False
    
    card = data.get("card", {})
    
    if card.get("status") != "active":
        log_error(f"Expected status=active, got {card.get('status')}")
        return False
    
    log_success(f"Premium card activated with tx_hash")
    return True

def test_card_freeze():
    """Test POST /cards/{id}/freeze"""
    log_test("Cards: Freeze and unfreeze card")
    
    # Freeze
    success, data, status = make_request("POST", f"/cards/{test_card_id}/freeze", token=user1_token, data={
        "frozen": True
    })
    
    if not success or status != 200:
        log_error(f"Card freeze failed: {status} - {data}")
        return False
    
    card = data.get("card", {})
    
    if card.get("frozen") != True:
        log_error(f"Expected frozen=True, got {card.get('frozen')}")
        return False
    
    # Unfreeze
    success, data, status = make_request("POST", f"/cards/{test_card_id}/freeze", token=user1_token, data={
        "frozen": False
    })
    
    if not success or status != 200:
        log_error(f"Card unfreeze failed: {status} - {data}")
        return False
    
    card = data.get("card", {})
    
    if card.get("frozen") != False:
        log_error(f"Expected frozen=False, got {card.get('frozen')}")
        return False
    
    log_success("Card freeze/unfreeze successful")
    return True

def test_cards_list():
    """Test GET /cards"""
    log_test("Cards: GET /cards list")
    
    success, data, status = make_request("GET", "/cards", token=user1_token)
    
    if not success or status != 200:
        log_error(f"Failed to get cards: {status} - {data}")
        return False
    
    cards = data.get("cards", [])
    
    if len(cards) < 2:
        log_error(f"Expected at least 2 cards, got {len(cards)}")
        return False
    
    log_success(f"Cards list retrieved: {len(cards)} cards")
    return True

# ============================================================
# 7. KYC
# ============================================================

def test_kyc_submit():
    """Test POST /kyc"""
    global test_kyc_id
    log_test("KYC: Submit KYC application")
    
    success, data, status = make_request("POST", "/kyc", token=user1_token, data={
        "full_name": "Sophia Martinez",
        "dob": "1990-05-15",
        "country": "United States",
        "address": "123 Main St, New York, NY 10001",
        "id_type": "passport",
        "id_number": "P123456789"
    })
    
    if not success or status != 200:
        log_error(f"KYC submit failed: {status} - {data}")
        return False
    
    kyc = data.get("kyc", {})
    test_kyc_id = kyc.get("id")
    
    # Verify user kyc_status changed to pending
    success, data, status = make_request("GET", "/auth/me", token=user1_token)
    user = data.get("user", {})
    
    if user.get("kyc_status") != "pending":
        log_error(f"Expected kyc_status=pending, got {user.get('kyc_status')}")
        return False
    
    log_success(f"KYC submitted: {kyc.get('id')}, user kyc_status=pending")
    return True

# ============================================================
# 8. ADMIN
# ============================================================

def test_admin_login():
    """Test admin login"""
    global admin_token
    log_test("Admin: Login as admin@aurela.io")
    
    success, data, status = make_request("POST", "/auth/login", data={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if not success or status != 200:
        log_error(f"Admin login failed: {status} - {data}")
        return False
    
    user = data.get("user", {})
    
    if user.get("role") not in ["admin", "super_admin"]:
        log_error(f"Expected admin role, got {user.get('role')}")
        return False
    
    admin_token = data["token"]
    
    log_success(f"Admin logged in: {user['email']}, role={user['role']}")
    return True

def test_admin_overview():
    """Test GET /admin/overview"""
    log_test("Admin: GET /admin/overview")
    
    success, data, status = make_request("GET", "/admin/overview", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin overview failed: {status} - {data}")
        return False
    
    required = ["users", "transactions", "cards", "kyc_pending"]
    for field in required:
        if field not in data:
            log_error(f"Overview missing field: {field}")
            return False
    
    log_success(f"Admin overview: {data['users']} users, {data['transactions']} txs, {data['cards']} cards, {data['kyc_pending']} pending KYC")
    return True

def test_admin_users_list():
    """Test GET /admin/users"""
    log_test("Admin: GET /admin/users")
    
    success, data, status = make_request("GET", "/admin/users", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin users list failed: {status} - {data}")
        return False
    
    users = data.get("users", [])
    
    if len(users) < 2:
        log_error(f"Expected at least 2 users, got {len(users)}")
        return False
    
    log_success(f"Admin users list: {len(users)} users")
    return True

def test_admin_users_search():
    """Test GET /admin/users?q=<username>"""
    log_test("Admin: Search users by username")
    
    success, data, status = make_request("GET", "/admin/users", token=admin_token, params={
        "q": USER1_DATA["username"]
    })
    
    if not success or status != 200:
        log_error(f"Admin users search failed: {status} - {data}")
        return False
    
    users = data.get("users", [])
    
    if len(users) == 0:
        log_error("No users found in search")
        return False
    
    # Verify search result contains the username
    found = any(u.get("username") == USER1_DATA["username"] for u in users)
    if not found:
        log_error(f"Search did not return expected user: {USER1_DATA['username']}")
        return False
    
    log_success(f"Admin users search: found {len(users)} users")
    return True

def test_admin_adjust_credit():
    """Test POST /admin/users/{userId}/adjust (credit)"""
    log_test("Admin: Credit 500 USD to user")
    
    # Get initial balance
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usd_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    # Adjust
    success, data, status = make_request("POST", f"/admin/users/{user1_id}/adjust", token=admin_token, data={
        "currency": "USD",
        "amount": 500,
        "kind": "credit"
    })
    
    if not success or status != 200:
        log_error(f"Admin adjust failed: {status} - {data}")
        return False
    
    # Verify balance
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usd_after = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    if usd_after != usd_before + 500:
        log_error(f"Balance incorrect: {usd_before} -> {usd_after} (expected {usd_before + 500})")
        return False
    
    log_success(f"Admin credit successful: {usd_before} -> {usd_after}")
    return True

def test_admin_adjust_debit():
    """Test POST /admin/users/{userId}/adjust (debit)"""
    log_test("Admin: Debit 100 USD from user")
    
    # Get initial balance
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usd_before = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    # Adjust
    success, data, status = make_request("POST", f"/admin/users/{user1_id}/adjust", token=admin_token, data={
        "currency": "USD",
        "amount": 100,
        "kind": "debit"
    })
    
    if not success or status != 200:
        log_error(f"Admin adjust failed: {status} - {data}")
        return False
    
    # Verify balance
    success, data, status = make_request("GET", "/wallets", token=user1_token)
    usd_after = next((w["balance"] for w in data["wallets"] if w["currency"] == "USD"), 0)
    
    if usd_after != usd_before - 100:
        log_error(f"Balance incorrect: {usd_before} -> {usd_after} (expected {usd_before - 100})")
        return False
    
    log_success(f"Admin debit successful: {usd_before} -> {usd_after}")
    return True

def test_admin_freeze_user():
    """Test POST /admin/users/{userId}/freeze"""
    log_test("Admin: Freeze user account")
    
    success, data, status = make_request("POST", f"/admin/users/{user2_id}/freeze", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin freeze failed: {status} - {data}")
        return False
    
    log_success("User frozen successfully")
    return True

def test_admin_unfreeze_user():
    """Test POST /admin/users/{userId}/unfreeze"""
    log_test("Admin: Unfreeze user account")
    
    success, data, status = make_request("POST", f"/admin/users/{user2_id}/unfreeze", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin unfreeze failed: {status} - {data}")
        return False
    
    log_success("User unfrozen successfully")
    return True

def test_admin_block_user():
    """Test POST /admin/users/{userId}/block"""
    log_test("Admin: Block user account")
    
    success, data, status = make_request("POST", f"/admin/users/{user2_id}/block", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin block failed: {status} - {data}")
        return False
    
    # Try to login as blocked user
    success, data, status = make_request("POST", "/auth/login", data={
        "identifier": USER2_DATA["email"],
        "password": USER2_DATA["password"]
    })
    
    if status != 403:
        log_error(f"Expected 403 for blocked user login, got {status}")
        return False
    
    log_success("User blocked successfully, login rejected with 403")
    return True

def test_admin_unblock_user():
    """Test POST /admin/users/{userId}/unblock"""
    log_test("Admin: Unblock user account")
    
    success, data, status = make_request("POST", f"/admin/users/{user2_id}/unblock", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin unblock failed: {status} - {data}")
        return False
    
    log_success("User unblocked successfully")
    return True

def test_admin_kyc_list():
    """Test GET /admin/kyc"""
    log_test("Admin: GET /admin/kyc")
    
    success, data, status = make_request("GET", "/admin/kyc", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin KYC list failed: {status} - {data}")
        return False
    
    kyc_list = data.get("kyc", [])
    
    if len(kyc_list) == 0:
        log_error("No KYC records found")
        return False
    
    log_success(f"Admin KYC list: {len(kyc_list)} records")
    return True

def test_admin_kyc_approve():
    """Test POST /admin/kyc/{id}/approve"""
    log_test("Admin: Approve KYC application")
    
    success, data, status = make_request("POST", f"/admin/kyc/{test_kyc_id}/approve", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin KYC approve failed: {status} - {data}")
        return False
    
    # Verify user kyc_status changed to approved
    success, data, status = make_request("GET", "/auth/me", token=user1_token)
    user = data.get("user", {})
    
    if user.get("kyc_status") != "approved":
        log_error(f"Expected kyc_status=approved, got {user.get('kyc_status')}")
        return False
    
    log_success("KYC approved, user kyc_status=approved")
    return True

def test_admin_settings_get():
    """Test GET /admin/settings"""
    log_test("Admin: GET /admin/settings")
    
    success, data, status = make_request("GET", "/admin/settings", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin settings get failed: {status} - {data}")
        return False
    
    settings = data.get("settings", {})
    
    if not settings:
        log_error("Settings empty")
        return False
    
    log_success(f"Admin settings retrieved")
    return True

def test_admin_settings_update():
    """Test PUT /admin/settings"""
    log_test("Admin: Update settings")
    
    success, data, status = make_request("PUT", "/admin/settings", token=admin_token, data={
        "card_activation_wallet": "0xTESTWALLET123456789",
        "card_activation_fees": {
            "basic": 15,
            "premium": 60,
            "elite": 250
        }
    })
    
    if not success or status != 200:
        log_error(f"Admin settings update failed: {status} - {data}")
        return False
    
    settings = data.get("settings", {})
    
    if settings.get("card_activation_wallet") != "0xTESTWALLET123456789":
        log_error(f"Settings not updated correctly")
        return False
    
    log_success("Admin settings updated successfully")
    return True

def test_admin_transactions():
    """Test GET /admin/transactions"""
    log_test("Admin: GET /admin/transactions")
    
    success, data, status = make_request("GET", "/admin/transactions", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin transactions failed: {status} - {data}")
        return False
    
    transactions = data.get("transactions", [])
    
    if len(transactions) == 0:
        log_error("No transactions found")
        return False
    
    log_success(f"Admin transactions: {len(transactions)} records")
    return True

def test_admin_audit():
    """Test GET /admin/audit"""
    log_test("Admin: GET /admin/audit")
    
    success, data, status = make_request("GET", "/admin/audit", token=admin_token)
    
    if not success or status != 200:
        log_error(f"Admin audit failed: {status} - {data}")
        return False
    
    audit_logs = data.get("audit", [])
    
    if len(audit_logs) == 0:
        log_error("No audit logs found")
        return False
    
    # Verify audit log contains expected actions
    actions = [log.get("action") for log in audit_logs]
    expected_actions = ["user.register", "user.login", "transfer.internal"]
    
    for expected in expected_actions:
        if not any(expected in action for action in actions):
            log_error(f"Audit log missing expected action: {expected}")
            return False
    
    log_success(f"Admin audit log: {len(audit_logs)} entries with expected actions")
    return True

# ============================================================
# 9. ROLE CHECK
# ============================================================

def test_non_admin_access():
    """Test non-admin user accessing admin endpoints"""
    log_test("Role Check: Non-admin accessing /admin/* (should fail)")
    
    success, data, status = make_request("GET", "/admin/overview", token=user1_token)
    
    if status != 403:
        log_error(f"Expected 403, got {status}")
        return False
    
    log_success("Non-admin correctly rejected with 403")
    return True

# ============================================================
# MAIN TEST RUNNER
# ============================================================

def run_all_tests():
    """Run all tests in order"""
    tests = [
        # 1. Public endpoints
        ("Public: Health", test_health),
        ("Public: Config", test_config),
        ("Public: Rates", test_rates),
        
        # 2. Auth
        ("Auth: Register User1", test_register_user1),
        ("Auth: Verify User1 Wallets", test_verify_wallets_user1),
        ("Auth: Register User2", test_register_user2),
        ("Auth: Login", test_login),
        ("Auth: Me", test_auth_me),
        ("Auth: Wrong Password", test_login_wrong_password),
        ("Auth: Duplicate Email", test_register_duplicate),
        
        # 3. Wallets & Rates
        ("Wallets: Get with Totals", test_wallets_with_totals),
        ("Wallets: Preferred Currency", test_preferred_currency),
        
        # 4. Internal Transfer
        ("Transfer: By Username", test_transfer_by_username),
        ("Transfer: By Email", test_transfer_by_email),
        ("Transfer: By ID", test_transfer_by_id),
        ("Transfer: Insufficient Balance", test_transfer_insufficient_balance),
        ("Transfer: Self Transfer", test_transfer_self),
        ("Transfer: Unknown Recipient", test_transfer_unknown_recipient),
        ("Transfer: Verify Records", test_verify_transaction_record),
        
        # 5. Deposit & Withdraw
        ("Deposit: Bank", test_deposit),
        ("Withdraw: Bank", test_withdraw),
        ("Transactions: List", test_transactions_list),
        
        # 6. Cards
        ("Cards: Request Basic", test_card_request_basic),
        ("Cards: Activate with Wallet", test_card_activate_wallet),
        ("Cards: Request Premium", test_card_request_premium),
        ("Cards: Freeze/Unfreeze", test_card_freeze),
        ("Cards: List", test_cards_list),
        
        # 7. KYC
        ("KYC: Submit", test_kyc_submit),
        
        # 8. Admin
        ("Admin: Login", test_admin_login),
        ("Admin: Overview", test_admin_overview),
        ("Admin: Users List", test_admin_users_list),
        ("Admin: Users Search", test_admin_users_search),
        ("Admin: Adjust Credit", test_admin_adjust_credit),
        ("Admin: Adjust Debit", test_admin_adjust_debit),
        ("Admin: Freeze User", test_admin_freeze_user),
        ("Admin: Unfreeze User", test_admin_unfreeze_user),
        ("Admin: Block User", test_admin_block_user),
        ("Admin: Unblock User", test_admin_unblock_user),
        ("Admin: KYC List", test_admin_kyc_list),
        ("Admin: KYC Approve", test_admin_kyc_approve),
        ("Admin: Settings Get", test_admin_settings_get),
        ("Admin: Settings Update", test_admin_settings_update),
        ("Admin: Transactions", test_admin_transactions),
        ("Admin: Audit Log", test_admin_audit),
        
        # 9. Role Check
        ("Role Check: Non-admin Access", test_non_admin_access),
    ]
    
    passed = 0
    failed = 0
    failed_tests = []
    
    print("\n" + "="*80)
    print("AURELA BACKEND API TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Total Tests: {len(tests)}")
    print("="*80)
    
    for name, test_func in tests:
        try:
            result = test_func()
            if result:
                passed += 1
            else:
                failed += 1
                failed_tests.append(name)
        except Exception as e:
            log_error(f"Test '{name}' raised exception: {e}")
            failed += 1
            failed_tests.append(name)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total: {len(tests)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if failed_tests:
        print("\nFailed Tests:")
        for test_name in failed_tests:
            print(f"  - {test_name}")
    
    print("="*80)
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
