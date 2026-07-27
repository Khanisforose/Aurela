#!/usr/bin/env python3
"""
Aurela Backend Regression + New Feature Test
Focused on: KYC gating, deposit request flow, card activation via external USDT, regression sanity
"""
import requests
import json
import os
import sys
from datetime import datetime
from pymongo import MongoClient

# Base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://aurela-preview.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'aurela')

# Test credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

def get_otp_from_db(email):
    """Fetch OTP code from MongoDB for testing purposes"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        pending = db.pending_signups.find_one({'email': email.lower()})
        if pending:
            return pending.get('code')
        return None
    except Exception as e:
        log_fail(f"Failed to fetch OTP from DB: {e}")
        return None

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log(msg, color=RESET):
    print(f"{color}{msg}{RESET}")

def log_pass(msg):
    log(f"✅ PASS: {msg}", GREEN)

def log_fail(msg):
    log(f"❌ FAIL: {msg}", RED)

def log_info(msg):
    log(f"ℹ️  INFO: {msg}", BLUE)

def log_section(msg):
    log(f"\n{'='*80}\n{msg}\n{'='*80}", YELLOW)

# Test state
test_results = {
    'section_1_kyc_gating': {'passed': 0, 'failed': 0, 'tests': []},
    'section_2_deposit_flow': {'passed': 0, 'failed': 0, 'tests': []},
    'section_3_card_activation': {'passed': 0, 'failed': 0, 'tests': []},
    'section_4_regression': {'passed': 0, 'failed': 0, 'tests': []},
}

def record_test(section, test_name, passed, details=''):
    result = 'PASS' if passed else 'FAIL'
    test_results[section]['tests'].append({
        'name': test_name,
        'result': result,
        'details': details
    })
    if passed:
        test_results[section]['passed'] += 1
        log_pass(f"{test_name}: {details}")
    else:
        test_results[section]['failed'] += 1
        log_fail(f"{test_name}: {details}")

def print_summary():
    log_section("TEST SUMMARY")
    total_passed = 0
    total_failed = 0
    
    for section, data in test_results.items():
        section_name = section.replace('_', ' ').title()
        passed = data['passed']
        failed = data['failed']
        total = passed + failed
        total_passed += passed
        total_failed += failed
        
        status = GREEN if failed == 0 else RED
        log(f"{status}{section_name}: {passed}/{total} passed{RESET}")
        
        for test in data['tests']:
            color = GREEN if test['result'] == 'PASS' else RED
            log(f"  {color}{test['result']}: {test['name']}{RESET}")
            if test['details']:
                log(f"       {test['details']}", BLUE)
    
    log(f"\n{'='*80}")
    overall_status = GREEN if total_failed == 0 else RED
    log(f"{overall_status}OVERALL: {total_passed}/{total_passed + total_failed} tests passed{RESET}")
    log(f"{'='*80}\n")
    
    return total_failed == 0

# ============================================================
# SECTION 1: KYC GATING (P0)
# ============================================================
def test_section_1_kyc_gating():
    log_section("SECTION 1: KYC GATING (P0)")
    
    # Register a fresh user
    log_info("Registering fresh user with kyc_status='unverified'...")
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    test_email = f"kyctest_{timestamp}@test.com"
    test_username = f"kyctest_{timestamp}"
    test_password = "TestPass123!"
    
    try:
        # Step 1: Init registration
        init_res = requests.post(f"{API_URL}/auth/register/init", json={
            'email': test_email,
            'username': test_username,
            'password': test_password,
            'full_name': 'KYC Test User'
        }, timeout=10)
        
        if init_res.status_code != 200:
            record_test('section_1_kyc_gating', 'User Registration Init', False, f"Init failed: {init_res.status_code} {init_res.text}")
            return None
        
        init_data = init_res.json()
        otp_code = init_data.get('dev_otp')
        if not otp_code:
            # If dev_otp not in response, fetch from MongoDB
            otp_code = get_otp_from_db(test_email)
            if not otp_code:
                record_test('section_1_kyc_gating', 'User Registration Init', False, f"Could not get OTP code")
                return None
        signup_id = init_data.get('signup_id')
        
        # Step 2: Verify OTP
        verify_res = requests.post(f"{API_URL}/auth/register/verify", json={
            'signup_id': signup_id,
            'email': test_email,
            'code': otp_code
        }, timeout=10)
        
        if verify_res.status_code != 200:
            record_test('section_1_kyc_gating', 'User Registration Verify', False, f"Verify failed: {verify_res.status_code} {verify_res.text}")
            return None
        
        verify_data = verify_res.json()
        user_token = verify_data.get('token')
        user_data = verify_data.get('user', {})
        
        # Verify kyc_status is 'unverified'
        if user_data.get('kyc_status') != 'unverified':
            record_test('section_1_kyc_gating', 'User Registration', False, f"Expected kyc_status='unverified', got '{user_data.get('kyc_status')}'")
            return None
        
        record_test('section_1_kyc_gating', 'User Registration', True, f"User created with kyc_status='unverified'")
        
        # Test 1.1: POST /api/deposit should return 403 with KYC_REQUIRED
        log_info("Testing POST /api/deposit with unverified user...")
        deposit_res = requests.post(f"{API_URL}/deposit", 
            headers={'Authorization': f'Bearer {user_token}'},
            json={'method': 'bank', 'currency': 'USD', 'amount': 100},
            timeout=10
        )
        
        if deposit_res.status_code == 403:
            deposit_data = deposit_res.json()
            if deposit_data.get('code') == 'KYC_REQUIRED':
                record_test('section_1_kyc_gating', 'Deposit KYC Gate', True, 'Returns 403 with code=KYC_REQUIRED')
            else:
                record_test('section_1_kyc_gating', 'Deposit KYC Gate', False, f"Expected code=KYC_REQUIRED, got {deposit_data.get('code')}")
        else:
            record_test('section_1_kyc_gating', 'Deposit KYC Gate', False, f"Expected 403, got {deposit_res.status_code}")
        
        # Test 1.2: POST /api/withdraw should return 403 with KYC_REQUIRED
        log_info("Testing POST /api/withdraw with unverified user...")
        withdraw_res = requests.post(f"{API_URL}/withdraw",
            headers={'Authorization': f'Bearer {user_token}'},
            json={'method': 'bank', 'currency': 'USD', 'amount': 10, 'destination': 'test_account'},
            timeout=10
        )
        
        if withdraw_res.status_code == 403:
            withdraw_data = withdraw_res.json()
            if withdraw_data.get('code') == 'KYC_REQUIRED':
                record_test('section_1_kyc_gating', 'Withdraw KYC Gate', True, 'Returns 403 with code=KYC_REQUIRED')
            else:
                record_test('section_1_kyc_gating', 'Withdraw KYC Gate', False, f"Expected code=KYC_REQUIRED, got {withdraw_data.get('code')}")
        else:
            record_test('section_1_kyc_gating', 'Withdraw KYC Gate', False, f"Expected 403, got {withdraw_res.status_code}")
        
        # Test 1.3: POST /api/cards/request should return 403 with KYC_REQUIRED
        log_info("Testing POST /api/cards/request with unverified user...")
        card_req_res = requests.post(f"{API_URL}/cards/request",
            headers={'Authorization': f'Bearer {user_token}'},
            json={'tier': 'basic'},
            timeout=10
        )
        
        if card_req_res.status_code == 403:
            card_req_data = card_req_res.json()
            if card_req_data.get('code') == 'KYC_REQUIRED':
                record_test('section_1_kyc_gating', 'Card Request KYC Gate', True, 'Returns 403 with code=KYC_REQUIRED')
            else:
                record_test('section_1_kyc_gating', 'Card Request KYC Gate', False, f"Expected code=KYC_REQUIRED, got {card_req_data.get('code')}")
        else:
            record_test('section_1_kyc_gating', 'Card Request KYC Gate', False, f"Expected 403, got {card_req_res.status_code}")
        
        return {
            'token': user_token,
            'user_id': user_data.get('id'),
            'email': test_email,
            'username': test_username
        }
        
    except Exception as e:
        record_test('section_1_kyc_gating', 'KYC Gating Tests', False, f"Exception: {str(e)}")
        return None

# ============================================================
# SECTION 2: DEPOSIT REQUEST FLOW (P0)
# ============================================================
def test_section_2_deposit_flow(user_info):
    log_section("SECTION 2: DEPOSIT REQUEST FLOW (P0)")
    
    if not user_info:
        log_fail("Skipping Section 2: No user info from Section 1")
        return
    
    try:
        # Step 1: Admin login
        log_info("Admin login...")
        admin_login_res = requests.post(f"{API_URL}/auth/login", json={
            'identifier': ADMIN_EMAIL,
            'password': ADMIN_PASSWORD
        }, timeout=10)
        
        if admin_login_res.status_code != 200:
            record_test('section_2_deposit_flow', 'Admin Login', False, f"Failed: {admin_login_res.status_code}")
            return
        
        admin_data = admin_login_res.json()
        admin_token = admin_data.get('token')
        record_test('section_2_deposit_flow', 'Admin Login', True, 'Admin logged in successfully')
        
        # Step 2: User submits KYC
        log_info("User submitting KYC...")
        kyc_submit_res = requests.post(f"{API_URL}/kyc",
            headers={'Authorization': f'Bearer {user_info["token"]}'},
            json={
                'full_name': 'KYC Test User',
                'dob': '1990-01-01',
                'country': 'US',
                'address': '123 Test St',
                'id_type': 'passport',
                'id_number': 'P123456789'
            },
            timeout=10
        )
        
        if kyc_submit_res.status_code != 200:
            record_test('section_2_deposit_flow', 'KYC Submission', False, f"Failed: {kyc_submit_res.status_code}")
            return
        
        kyc_data = kyc_submit_res.json()
        kyc_id = kyc_data.get('kyc', {}).get('id')
        record_test('section_2_deposit_flow', 'KYC Submission', True, f'KYC submitted with id={kyc_id}')
        
        # Step 3: Admin approves KYC
        log_info("Admin approving KYC...")
        kyc_approve_res = requests.post(f"{API_URL}/admin/kyc/{kyc_id}/approve",
            headers={'Authorization': f'Bearer {admin_token}'},
            timeout=10
        )
        
        if kyc_approve_res.status_code != 200:
            record_test('section_2_deposit_flow', 'KYC Approval', False, f"Failed: {kyc_approve_res.status_code}")
            return
        
        record_test('section_2_deposit_flow', 'KYC Approval', True, 'KYC approved by admin')
        
        # Step 4: Get initial wallet balance
        log_info("Getting initial wallet balance...")
        wallets_res = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user_info["token"]}'},
            timeout=10
        )
        
        if wallets_res.status_code != 200:
            record_test('section_2_deposit_flow', 'Get Wallets', False, f"Failed: {wallets_res.status_code}")
            return
        
        wallets_data = wallets_res.json()
        usd_wallet = next((w for w in wallets_data.get('wallets', []) if w['currency'] == 'USD'), None)
        
        if not usd_wallet:
            record_test('section_2_deposit_flow', 'Get USD Wallet', False, 'USD wallet not found')
            return
        
        initial_balance = usd_wallet.get('balance', 0)
        log_info(f"Initial USD balance: {initial_balance}")
        
        # Step 5: User creates deposit request
        log_info("User creating deposit request...")
        deposit_res = requests.post(f"{API_URL}/deposit",
            headers={'Authorization': f'Bearer {user_info["token"]}'},
            json={'method': 'bank', 'currency': 'USD', 'amount': 250},
            timeout=10
        )
        
        if deposit_res.status_code != 200:
            record_test('section_2_deposit_flow', 'Create Deposit Request', False, f"Failed: {deposit_res.status_code} {deposit_res.text}")
            return
        
        deposit_data = deposit_res.json()
        if not deposit_data.get('ok'):
            record_test('section_2_deposit_flow', 'Create Deposit Request', False, f"Response ok=false: {deposit_data}")
            return
        
        deposit_request = deposit_data.get('request', {})
        if deposit_request.get('status') != 'pending':
            record_test('section_2_deposit_flow', 'Create Deposit Request', False, f"Expected status='pending', got '{deposit_request.get('status')}'")
            return
        
        deposit_id = deposit_request.get('id')
        record_test('section_2_deposit_flow', 'Create Deposit Request', True, f'Deposit request created with status=pending, id={deposit_id}')
        
        # Step 6: Verify wallet balance has NOT changed
        log_info("Verifying wallet balance unchanged...")
        wallets_res2 = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user_info["token"]}'},
            timeout=10
        )
        
        if wallets_res2.status_code != 200:
            record_test('section_2_deposit_flow', 'Verify Balance Unchanged', False, f"Failed to get wallets: {wallets_res2.status_code}")
            return
        
        wallets_data2 = wallets_res2.json()
        usd_wallet2 = next((w for w in wallets_data2.get('wallets', []) if w['currency'] == 'USD'), None)
        current_balance = usd_wallet2.get('balance', 0)
        
        if current_balance == initial_balance:
            record_test('section_2_deposit_flow', 'Verify Balance Unchanged', True, f'Balance remains {initial_balance} (not auto-credited)')
        else:
            record_test('section_2_deposit_flow', 'Verify Balance Unchanged', False, f'Balance changed from {initial_balance} to {current_balance}')
        
        # Step 7: Admin gets deposit list
        log_info("Admin getting deposit list...")
        admin_deposits_res = requests.get(f"{API_URL}/admin/deposits",
            headers={'Authorization': f'Bearer {admin_token}'},
            timeout=10
        )
        
        if admin_deposits_res.status_code != 200:
            record_test('section_2_deposit_flow', 'Admin Get Deposits', False, f"Failed: {admin_deposits_res.status_code}")
            return
        
        admin_deposits_data = admin_deposits_res.json()
        deposits_list = admin_deposits_data.get('deposits', [])
        found_deposit = next((d for d in deposits_list if d.get('id') == deposit_id), None)
        
        if found_deposit and found_deposit.get('status') == 'pending':
            record_test('section_2_deposit_flow', 'Admin Get Deposits', True, f'Deposit request found in admin list with status=pending')
        else:
            record_test('section_2_deposit_flow', 'Admin Get Deposits', False, f'Deposit request not found or wrong status')
        
        # Step 8: Admin approves deposit
        log_info("Admin approving deposit...")
        approve_deposit_res = requests.post(f"{API_URL}/admin/deposits/{deposit_id}/approve",
            headers={'Authorization': f'Bearer {admin_token}'},
            timeout=10
        )
        
        if approve_deposit_res.status_code != 200:
            record_test('section_2_deposit_flow', 'Admin Approve Deposit', False, f"Failed: {approve_deposit_res.status_code} {approve_deposit_res.text}")
            return
        
        approve_data = approve_deposit_res.json()
        if approve_data.get('ok'):
            record_test('section_2_deposit_flow', 'Admin Approve Deposit', True, 'Deposit approved successfully')
        else:
            record_test('section_2_deposit_flow', 'Admin Approve Deposit', False, f'Response ok=false: {approve_data}')
            return
        
        # Step 9: Verify wallet balance is now credited
        log_info("Verifying wallet balance credited...")
        wallets_res3 = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user_info["token"]}'},
            timeout=10
        )
        
        if wallets_res3.status_code != 200:
            record_test('section_2_deposit_flow', 'Verify Balance Credited', False, f"Failed to get wallets: {wallets_res3.status_code}")
            return
        
        wallets_data3 = wallets_res3.json()
        usd_wallet3 = next((w for w in wallets_data3.get('wallets', []) if w['currency'] == 'USD'), None)
        final_balance = usd_wallet3.get('balance', 0)
        expected_balance = initial_balance + 250
        
        if final_balance == expected_balance:
            record_test('section_2_deposit_flow', 'Verify Balance Credited', True, f'Balance updated to {final_balance} (initial {initial_balance} + 250)')
        else:
            record_test('section_2_deposit_flow', 'Verify Balance Credited', False, f'Expected {expected_balance}, got {final_balance}')
        
        # Step 10: Verify transaction record created
        log_info("Verifying transaction record...")
        txs_res = requests.get(f"{API_URL}/transactions",
            headers={'Authorization': f'Bearer {user_info["token"]}'},
            timeout=10
        )
        
        if txs_res.status_code != 200:
            record_test('section_2_deposit_flow', 'Verify Transaction Record', False, f"Failed to get transactions: {txs_res.status_code}")
            return
        
        txs_data = txs_res.json()
        transactions = txs_data.get('transactions', [])
        deposit_tx = next((t for t in transactions if t.get('type') == 'deposit' and t.get('amount') == 250 and t.get('currency') == 'USD'), None)
        
        if deposit_tx and deposit_tx.get('status') == 'completed':
            record_test('section_2_deposit_flow', 'Verify Transaction Record', True, f'Transaction record created with type=deposit, status=completed')
        else:
            record_test('section_2_deposit_flow', 'Verify Transaction Record', False, 'Transaction record not found or wrong status')
        
        # Step 11: Test reject path with a second deposit request
        log_info("Testing reject path with second deposit request...")
        deposit_res2 = requests.post(f"{API_URL}/deposit",
            headers={'Authorization': f'Bearer {user_info["token"]}'},
            json={'method': 'bank', 'currency': 'USD', 'amount': 100},
            timeout=10
        )
        
        if deposit_res2.status_code != 200:
            record_test('section_2_deposit_flow', 'Create Second Deposit Request', False, f"Failed: {deposit_res2.status_code}")
            return
        
        deposit_data2 = deposit_res2.json()
        deposit_id2 = deposit_data2.get('request', {}).get('id')
        
        # Get balance before rejection
        wallets_res4 = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user_info["token"]}'},
            timeout=10
        )
        wallets_data4 = wallets_res4.json()
        usd_wallet4 = next((w for w in wallets_data4.get('wallets', []) if w['currency'] == 'USD'), None)
        balance_before_reject = usd_wallet4.get('balance', 0)
        
        # Admin rejects deposit
        reject_deposit_res = requests.post(f"{API_URL}/admin/deposits/{deposit_id2}/reject",
            headers={'Authorization': f'Bearer {admin_token}'},
            timeout=10
        )
        
        if reject_deposit_res.status_code != 200:
            record_test('section_2_deposit_flow', 'Admin Reject Deposit', False, f"Failed: {reject_deposit_res.status_code}")
            return
        
        # Verify balance unchanged after rejection
        wallets_res5 = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user_info["token"]}'},
            timeout=10
        )
        wallets_data5 = wallets_res5.json()
        usd_wallet5 = next((w for w in wallets_data5.get('wallets', []) if w['currency'] == 'USD'), None)
        balance_after_reject = usd_wallet5.get('balance', 0)
        
        if balance_after_reject == balance_before_reject:
            record_test('section_2_deposit_flow', 'Verify Reject Path', True, f'Balance unchanged after rejection ({balance_after_reject})')
        else:
            record_test('section_2_deposit_flow', 'Verify Reject Path', False, f'Balance changed after rejection: {balance_before_reject} -> {balance_after_reject}')
        
        # Return admin token and user info for next section
        return {
            'admin_token': admin_token,
            'user_token': user_info['token'],
            'user_id': user_info['user_id']
        }
        
    except Exception as e:
        record_test('section_2_deposit_flow', 'Deposit Flow Tests', False, f"Exception: {str(e)}")
        import traceback
        log_fail(traceback.format_exc())
        return None

# ============================================================
# SECTION 3: CARD ACTIVATION VIA EXTERNAL USDT (P0)
# ============================================================
def test_section_3_card_activation(tokens):
    log_section("SECTION 3: CARD ACTIVATION VIA EXTERNAL USDT (P0)")
    
    if not tokens:
        log_fail("Skipping Section 3: No tokens from Section 2")
        return
    
    try:
        admin_token = tokens['admin_token']
        user_token = tokens['user_token']
        
        # Step 1: Get initial USDT balance
        log_info("Getting initial USDT balance...")
        wallets_res = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user_token}'},
            timeout=10
        )
        
        if wallets_res.status_code != 200:
            record_test('section_3_card_activation', 'Get USDT Balance', False, f"Failed: {wallets_res.status_code}")
            return
        
        wallets_data = wallets_res.json()
        usdt_wallet = next((w for w in wallets_data.get('wallets', []) if w['currency'] == 'USDT'), None)
        initial_usdt_balance = usdt_wallet.get('balance', 0)
        log_info(f"Initial USDT balance: {initial_usdt_balance}")
        
        # Step 2: Request a card
        log_info("Requesting basic card...")
        card_req_res = requests.post(f"{API_URL}/cards/request",
            headers={'Authorization': f'Bearer {user_token}'},
            json={'tier': 'basic'},
            timeout=10
        )
        
        if card_req_res.status_code != 200:
            record_test('section_3_card_activation', 'Request Card', False, f"Failed: {card_req_res.status_code} {card_req_res.text}")
            return
        
        card_data = card_req_res.json()
        card = card_data.get('card', {})
        card_id = card.get('id')
        
        if card.get('status') != 'pending_activation':
            record_test('section_3_card_activation', 'Request Card', False, f"Expected status='pending_activation', got '{card.get('status')}'")
            return
        
        record_test('section_3_card_activation', 'Request Card', True, f'Card created with status=pending_activation, id={card_id}')
        
        # Step 3: Try to activate without tx_hash (should fail with 400)
        log_info("Testing activation without tx_hash (should fail)...")
        activate_no_hash_res = requests.post(f"{API_URL}/cards/{card_id}/activate",
            headers={'Authorization': f'Bearer {user_token}'},
            json={'pay_from_wallet': True},
            timeout=10
        )
        
        if activate_no_hash_res.status_code == 400:
            error_msg = activate_no_hash_res.json().get('error', '')
            if 'transaction hash' in error_msg.lower() or 'tx_hash' in error_msg.lower():
                record_test('section_3_card_activation', 'Activate Without tx_hash', True, f'Returns 400 with error about tx_hash requirement')
            else:
                record_test('section_3_card_activation', 'Activate Without tx_hash', False, f'Returns 400 but wrong error message: {error_msg}')
        else:
            record_test('section_3_card_activation', 'Activate Without tx_hash', False, f'Expected 400, got {activate_no_hash_res.status_code}')
        
        # Step 4: Activate with tx_hash
        log_info("Activating card with tx_hash...")
        tx_hash = '0x' + 'a' * 64  # Mock transaction hash
        activate_res = requests.post(f"{API_URL}/cards/{card_id}/activate",
            headers={'Authorization': f'Bearer {user_token}'},
            json={'tx_hash': tx_hash, 'network': 'TRC20'},
            timeout=10
        )
        
        if activate_res.status_code != 200:
            record_test('section_3_card_activation', 'Activate With tx_hash', False, f"Failed: {activate_res.status_code} {activate_res.text}")
            return
        
        activate_data = activate_res.json()
        activated_card = activate_data.get('card', {})
        
        if activated_card.get('status') != 'pending_verification':
            record_test('section_3_card_activation', 'Activate With tx_hash', False, f"Expected status='pending_verification', got '{activated_card.get('status')}'")
            return
        
        record_test('section_3_card_activation', 'Activate With tx_hash', True, f'Card status updated to pending_verification')
        
        # Step 5: Verify USDT balance unchanged
        log_info("Verifying USDT balance unchanged...")
        wallets_res2 = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user_token}'},
            timeout=10
        )
        
        if wallets_res2.status_code != 200:
            record_test('section_3_card_activation', 'Verify USDT Balance Unchanged', False, f"Failed: {wallets_res2.status_code}")
            return
        
        wallets_data2 = wallets_res2.json()
        usdt_wallet2 = next((w for w in wallets_data2.get('wallets', []) if w['currency'] == 'USDT'), None)
        current_usdt_balance = usdt_wallet2.get('balance', 0)
        
        if current_usdt_balance == initial_usdt_balance:
            record_test('section_3_card_activation', 'Verify USDT Balance Unchanged', True, f'USDT balance remains {initial_usdt_balance} (not auto-debited)')
        else:
            record_test('section_3_card_activation', 'Verify USDT Balance Unchanged', False, f'USDT balance changed from {initial_usdt_balance} to {current_usdt_balance}')
        
        # Step 6: Admin gets pending cards
        log_info("Admin getting pending cards...")
        admin_cards_res = requests.get(f"{API_URL}/admin/cards",
            headers={'Authorization': f'Bearer {admin_token}'},
            timeout=10
        )
        
        if admin_cards_res.status_code != 200:
            record_test('section_3_card_activation', 'Admin Get Pending Cards', False, f"Failed: {admin_cards_res.status_code}")
            return
        
        admin_cards_data = admin_cards_res.json()
        cards_list = admin_cards_data.get('cards', [])
        found_card = next((c for c in cards_list if c.get('id') == card_id), None)
        
        if found_card:
            record_test('section_3_card_activation', 'Admin Get Pending Cards', True, f'Card found in admin pending list')
        else:
            record_test('section_3_card_activation', 'Admin Get Pending Cards', False, f'Card not found in admin list')
        
        # Step 7: Admin approves card
        log_info("Admin approving card...")
        approve_card_res = requests.post(f"{API_URL}/admin/cards/{card_id}/approve",
            headers={'Authorization': f'Bearer {admin_token}'},
            timeout=10
        )
        
        if approve_card_res.status_code != 200:
            record_test('section_3_card_activation', 'Admin Approve Card', False, f"Failed: {approve_card_res.status_code} {approve_card_res.text}")
            return
        
        approve_data = approve_card_res.json()
        if approve_data.get('ok'):
            record_test('section_3_card_activation', 'Admin Approve Card', True, 'Card approved successfully')
        else:
            record_test('section_3_card_activation', 'Admin Approve Card', False, f'Response ok=false: {approve_data}')
            return
        
        # Step 8: Verify card status is now 'active'
        log_info("Verifying card status is active...")
        cards_res = requests.get(f"{API_URL}/cards",
            headers={'Authorization': f'Bearer {user_token}'},
            timeout=10
        )
        
        if cards_res.status_code != 200:
            record_test('section_3_card_activation', 'Verify Card Active', False, f"Failed to get cards: {cards_res.status_code}")
            return
        
        cards_data = cards_res.json()
        user_cards = cards_data.get('cards', [])
        active_card = next((c for c in user_cards if c.get('id') == card_id), None)
        
        if active_card and active_card.get('status') == 'active':
            record_test('section_3_card_activation', 'Verify Card Active', True, f'Card status is now active')
        else:
            record_test('section_3_card_activation', 'Verify Card Active', False, f'Card status is {active_card.get("status") if active_card else "not found"}')
        
    except Exception as e:
        record_test('section_3_card_activation', 'Card Activation Tests', False, f"Exception: {str(e)}")
        import traceback
        log_fail(traceback.format_exc())

# ============================================================
# SECTION 4: REGRESSION SANITY
# ============================================================
def test_section_4_regression():
    log_section("SECTION 4: REGRESSION SANITY")
    
    try:
        # Test 4.1: GET /api/health
        log_info("Testing GET /api/health...")
        health_res = requests.get(f"{API_URL}/health", timeout=10)
        
        if health_res.status_code == 200:
            health_data = health_res.json()
            if health_data.get('ok'):
                record_test('section_4_regression', 'Health Endpoint', True, 'Returns 200 with ok=true')
            else:
                record_test('section_4_regression', 'Health Endpoint', False, f'Returns 200 but ok={health_data.get("ok")}')
        else:
            record_test('section_4_regression', 'Health Endpoint', False, f'Expected 200, got {health_res.status_code}')
        
        # Test 4.2: GET /api/config
        log_info("Testing GET /api/config...")
        config_res = requests.get(f"{API_URL}/config", timeout=10)
        
        if config_res.status_code == 200:
            config_data = config_res.json()
            has_fiat = 'fiat' in config_data and len(config_data['fiat']) > 0
            has_crypto = 'crypto' in config_data and len(config_data['crypto']) > 0
            has_activation_wallet = 'activation_wallet' in config_data
            has_platform_wallets = 'platform_wallets' in config_data
            
            if has_fiat and has_crypto and has_activation_wallet and has_platform_wallets:
                record_test('section_4_regression', 'Config Endpoint', True, 'Returns 200 with fiat, crypto, activation_wallet, platform_wallets')
            else:
                record_test('section_4_regression', 'Config Endpoint', False, f'Missing keys: fiat={has_fiat}, crypto={has_crypto}, activation_wallet={has_activation_wallet}, platform_wallets={has_platform_wallets}')
        else:
            record_test('section_4_regression', 'Config Endpoint', False, f'Expected 200, got {config_res.status_code}')
        
        # Test 4.3: GET /api/rates
        log_info("Testing GET /api/rates...")
        rates_res = requests.get(f"{API_URL}/rates", timeout=10)
        
        if rates_res.status_code == 200:
            rates_data = rates_res.json()
            has_fx = 'fx' in rates_data and len(rates_data['fx']) > 0
            has_crypto_usd = 'crypto_usd' in rates_data and len(rates_data['crypto_usd']) > 0
            
            if has_fx and has_crypto_usd:
                record_test('section_4_regression', 'Rates Endpoint', True, f'Returns 200 with fx ({len(rates_data["fx"])} currencies) and crypto_usd ({len(rates_data["crypto_usd"])} assets)')
            else:
                record_test('section_4_regression', 'Rates Endpoint', False, f'Missing keys: fx={has_fx}, crypto_usd={has_crypto_usd}')
        else:
            record_test('section_4_regression', 'Rates Endpoint', False, f'Expected 200, got {rates_res.status_code}')
        
        # Test 4.4: Transfer between two users
        log_info("Testing transfer between two users...")
        
        # Create two test users
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        user1_email = f"transfer1_{timestamp}@test.com"
        user1_username = f"transfer1_{timestamp}"
        user2_email = f"transfer2_{timestamp}@test.com"
        user2_username = f"transfer2_{timestamp}"
        
        # Register user 1
        init1_res = requests.post(f"{API_URL}/auth/register/init", json={
            'email': user1_email,
            'username': user1_username,
            'password': 'TestPass123!',
            'full_name': 'Transfer User 1'
        }, timeout=10)
        
        if init1_res.status_code != 200:
            record_test('section_4_regression', 'Transfer Test', False, f"User 1 registration failed: {init1_res.status_code}")
            return
        
        init1_data = init1_res.json()
        otp1 = init1_data.get('dev_otp')
        if not otp1:
            otp1 = get_otp_from_db(user1_email)
            if not otp1:
                record_test('section_4_regression', 'Transfer Test', False, f"Could not get OTP for user 1")
                return
        
        verify1_res = requests.post(f"{API_URL}/auth/register/verify", json={
            'signup_id': init1_data.get('signup_id'),
            'email': user1_email,
            'code': otp1
        }, timeout=10)
        
        if verify1_res.status_code != 200:
            record_test('section_4_regression', 'Transfer Test', False, f"User 1 verification failed: {verify1_res.status_code}")
            return
        
        user1_token = verify1_res.json().get('token')
        
        # Register user 2
        init2_res = requests.post(f"{API_URL}/auth/register/init", json={
            'email': user2_email,
            'username': user2_username,
            'password': 'TestPass123!',
            'full_name': 'Transfer User 2'
        }, timeout=10)
        
        if init2_res.status_code != 200:
            record_test('section_4_regression', 'Transfer Test', False, f"User 2 registration failed: {init2_res.status_code}")
            return
        
        init2_data = init2_res.json()
        otp2 = init2_data.get('dev_otp')
        if not otp2:
            otp2 = get_otp_from_db(user2_email)
            if not otp2:
                record_test('section_4_regression', 'Transfer Test', False, f"Could not get OTP for user 2")
                return
        
        verify2_res = requests.post(f"{API_URL}/auth/register/verify", json={
            'signup_id': init2_data.get('signup_id'),
            'email': user2_email,
            'code': otp2
        }, timeout=10)
        
        if verify2_res.status_code != 200:
            record_test('section_4_regression', 'Transfer Test', False, f"User 2 verification failed: {verify2_res.status_code}")
            return
        
        user2_token = verify2_res.json().get('token')
        
        # Get user 1 USD balance
        wallets1_res = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user1_token}'},
            timeout=10
        )
        
        if wallets1_res.status_code != 200:
            record_test('section_4_regression', 'Transfer Test', False, f"Failed to get user 1 wallets: {wallets1_res.status_code}")
            return
        
        wallets1_data = wallets1_res.json()
        usd_wallet1 = next((w for w in wallets1_data.get('wallets', []) if w['currency'] == 'USD'), None)
        initial_balance1 = usd_wallet1.get('balance', 0)
        
        # Get user 2 USD balance
        wallets2_res = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user2_token}'},
            timeout=10
        )
        
        if wallets2_res.status_code != 200:
            record_test('section_4_regression', 'Transfer Test', False, f"Failed to get user 2 wallets: {wallets2_res.status_code}")
            return
        
        wallets2_data = wallets2_res.json()
        usd_wallet2 = next((w for w in wallets2_data.get('wallets', []) if w['currency'] == 'USD'), None)
        initial_balance2 = usd_wallet2.get('balance', 0)
        
        # If user 1 has 0 balance, use admin to credit funds
        if initial_balance1 == 0:
            log_info("User 1 has 0 balance, using admin to credit funds...")
            admin_login_res = requests.post(f"{API_URL}/auth/login", json={
                'identifier': ADMIN_EMAIL,
                'password': ADMIN_PASSWORD
            }, timeout=10)
            
            if admin_login_res.status_code == 200:
                admin_token = admin_login_res.json().get('token')
                user1_id = verify1_res.json().get('user', {}).get('id')
                
                adjust_res = requests.post(f"{API_URL}/admin/users/{user1_id}/adjust",
                    headers={'Authorization': f'Bearer {admin_token}'},
                    json={'currency': 'USD', 'amount': 1000, 'kind': 'credit'},
                    timeout=10
                )
                
                if adjust_res.status_code == 200:
                    # Refresh user 1 balance
                    wallets1_res = requests.get(f"{API_URL}/wallets",
                        headers={'Authorization': f'Bearer {user1_token}'},
                        timeout=10
                    )
                    wallets1_data = wallets1_res.json()
                    usd_wallet1 = next((w for w in wallets1_data.get('wallets', []) if w['currency'] == 'USD'), None)
                    initial_balance1 = usd_wallet1.get('balance', 0)
        
        # Transfer 50 USD from user 1 to user 2
        transfer_amount = 50
        transfer_res = requests.post(f"{API_URL}/transfer",
            headers={'Authorization': f'Bearer {user1_token}'},
            json={
                'recipient': user2_username,
                'amount': transfer_amount,
                'currency': 'USD',
                'note': 'Test transfer'
            },
            timeout=10
        )
        
        if transfer_res.status_code != 200:
            record_test('section_4_regression', 'Transfer Test', False, f"Transfer failed: {transfer_res.status_code} {transfer_res.text}")
            return
        
        transfer_data = transfer_res.json()
        if not transfer_data.get('ok'):
            record_test('section_4_regression', 'Transfer Test', False, f"Transfer response ok=false: {transfer_data}")
            return
        
        # Verify balances
        wallets1_res = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user1_token}'},
            timeout=10
        )
        wallets1_data = wallets1_res.json()
        usd_wallet1 = next((w for w in wallets1_data.get('wallets', []) if w['currency'] == 'USD'), None)
        final_balance1 = usd_wallet1.get('balance', 0)
        
        wallets2_res = requests.get(f"{API_URL}/wallets",
            headers={'Authorization': f'Bearer {user2_token}'},
            timeout=10
        )
        wallets2_data = wallets2_res.json()
        usd_wallet2 = next((w for w in wallets2_data.get('wallets', []) if w['currency'] == 'USD'), None)
        final_balance2 = usd_wallet2.get('balance', 0)
        
        expected_balance1 = initial_balance1 - transfer_amount
        expected_balance2 = initial_balance2 + transfer_amount
        
        if final_balance1 == expected_balance1 and final_balance2 == expected_balance2:
            record_test('section_4_regression', 'Transfer Test', True, f'Transfer successful: User1 {initial_balance1}->{final_balance1}, User2 {initial_balance2}->{final_balance2}')
        else:
            record_test('section_4_regression', 'Transfer Test', False, f'Balance mismatch: User1 expected {expected_balance1} got {final_balance1}, User2 expected {expected_balance2} got {final_balance2}')
        
    except Exception as e:
        record_test('section_4_regression', 'Regression Tests', False, f"Exception: {str(e)}")
        import traceback
        log_fail(traceback.format_exc())

# ============================================================
# MAIN
# ============================================================
def main():
    log_section("AURELA BACKEND REGRESSION + NEW FEATURE TEST")
    log_info(f"Base URL: {BASE_URL}")
    log_info(f"API URL: {API_URL}")
    log_info(f"Admin: {ADMIN_EMAIL}")
    
    # Section 1: KYC Gating
    user_info = test_section_1_kyc_gating()
    
    # Section 2: Deposit Request Flow
    tokens = test_section_2_deposit_flow(user_info)
    
    # Section 3: Card Activation via External USDT
    test_section_3_card_activation(tokens)
    
    # Section 4: Regression Sanity
    test_section_4_regression()
    
    # Print summary
    all_passed = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)

if __name__ == '__main__':
    main()
