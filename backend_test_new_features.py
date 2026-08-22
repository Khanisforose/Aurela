#!/usr/bin/env python3
"""
Backend API test for Aurela - NEW FEATURES TEST
Tests:
1. Payment sent notification (bug fix) - transfer_out/transfer_in
2. Swap endpoint with KYC gating
3. Public chain endpoints (no auth)
4. Sitemap + robots + /scan page
5. Regression tests
"""

import requests
import time
import json
from typing import Dict, Any
from pymongo import MongoClient
import os

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
FRONTEND_URL = "https://aurela-preview.preview.emergentagent.com"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'aurela')

def get_admin_token():
    """Login as admin and return token"""
    try:
        resp = requests.post(
            f"{BASE_URL}/auth/login",
            json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get('token'), data.get('user', {}).get('id')
        print(f"❌ Admin login failed: {resp.status_code} - {resp.text}")
        return None, None
    except Exception as e:
        print(f"❌ Admin login exception: {e}")
        return None, None

def register_user(email, first_name, last_name, country, phone, password):
    """Register a new user via OTP flow"""
    try:
        # Step 1: Init registration
        resp = requests.post(
            f"{BASE_URL}/auth/register/init",
            json={
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "country": country,
                "phone": phone,
                "password": password
            },
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ Register init failed: {resp.status_code} - {resp.text}")
            return None, None, None
        
        data = resp.json()
        signup_id = data.get('signup_id')
        dev_otp = data.get('dev_otp')
        
        # If dev_otp is not in response, try to fetch from DB
        if not dev_otp:
            try:
                client = MongoClient(MONGO_URL)
                db = client[DB_NAME]
                signup = db.pending_signups.find_one({'id': signup_id})
                if signup:
                    dev_otp = signup.get('code')
                client.close()
            except Exception as e:
                print(f"⚠️  Could not fetch OTP from DB: {e}")
        
        if not dev_otp:
            print(f"⚠️  No dev_otp available for {email}, skipping verification")
            return None, None, None
        
        # Step 2: Verify with OTP
        resp = requests.post(
            f"{BASE_URL}/auth/register/verify",
            json={"signup_id": signup_id, "code": dev_otp},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ Register verify failed: {resp.status_code} - {resp.text}")
            return None, None, None
        
        data = resp.json()
        user = data.get('user', {})
        return data.get('token'), user.get('id'), user.get('user_code')
    except Exception as e:
        print(f"❌ Register exception: {e}")
        return None, None, None

def approve_kyc(admin_token, user_token, user_id):
    """Submit and approve KYC for a user"""
    try:
        # First submit KYC as the user
        resp = requests.post(
            f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
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
                "id_number": "P123456789"
            },
            timeout=10
        )
        if resp.status_code != 200:
            print(f"⚠️  KYC submission failed: {resp.status_code} - {resp.text}")
            return False
        
        # Get the KYC ID
        resp = requests.get(
            f"{BASE_URL}/admin/kyc",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"⚠️  Could not fetch KYC list: {resp.status_code}")
            return False
        
        kyc_list = resp.json().get('kyc', [])
        kyc_record = next((k for k in kyc_list if k.get('user_id') == user_id), None)
        if not kyc_record:
            print(f"⚠️  KYC record not found for user {user_id}")
            return False
        
        kyc_id = kyc_record.get('id')
        
        # Approve the KYC
        resp = requests.post(
            f"{BASE_URL}/admin/kyc/{kyc_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"❌ KYC approve exception: {e}")
        return False

def credit_balance(admin_token, user_id, currency, amount):
    """Credit balance to a user"""
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/users/{user_id}/adjust",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "credit", "currency": currency, "amount": amount},
            timeout=10
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"❌ Credit balance exception: {e}")
        return False

def test_feature_1_payment_notifications():
    """
    FEATURE 1 — Payment sent notification (bug fix)
    Test that both sender and recipient get notifications after transfer
    """
    print("\n" + "="*80)
    print("FEATURE 1: PAYMENT SENT NOTIFICATION (BUG FIX)")
    print("="*80)
    
    try:
        # Get admin token
        print("\n[1] Admin login...")
        admin_token, admin_id = get_admin_token()
        if not admin_token:
            print("❌ FEATURE 1 FAILED: Admin login failed")
            return False
        print("✅ Admin logged in")
        
        # Create two test users
        print("\n[2] Creating User A (sender)...")
        timestamp = int(time.time())
        user_a_email = f"sender_{timestamp}@test.com"
        user_a_token, user_a_id, user_a_code = register_user(
            user_a_email, "Alice", "Sender", "US", "+1234567890", "Password123"
        )
        if not user_a_token:
            print("❌ FEATURE 1 FAILED: User A registration failed")
            return False
        print(f"✅ User A created: {user_a_code}")
        
        print("\n[3] Creating User B (recipient)...")
        user_b_email = f"recipient_{timestamp}@test.com"
        user_b_token, user_b_id, user_b_code = register_user(
            user_b_email, "Bob", "Recipient", "US", "+1234567891", "Password123"
        )
        if not user_b_token:
            print("❌ FEATURE 1 FAILED: User B registration failed")
            return False
        print(f"✅ User B created: {user_b_code}")
        
        # Credit USDT to User A
        print("\n[4] Crediting 100 USDT to User A...")
        if not credit_balance(admin_token, user_a_id, "USDT", 100):
            print("❌ FEATURE 1 FAILED: Could not credit USDT to User A")
            return False
        print("✅ User A credited with 100 USDT")
        
        # User A transfers to User B
        print(f"\n[5] User A transferring 5 USDT to User B (code: {user_b_code})...")
        resp = requests.post(
            f"{BASE_URL}/transfer",
            headers={"Authorization": f"Bearer {user_a_token}"},
            json={"recipient": user_b_code, "currency": "USDT", "amount": 5},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ FEATURE 1 FAILED: Transfer failed - {resp.status_code}: {resp.text}")
            return False
        print("✅ Transfer successful")
        
        # Check notifications for User A (sender)
        print("\n[6] Checking notifications for User A (sender)...")
        resp = requests.get(
            f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {user_a_token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ FEATURE 1 FAILED: Could not fetch User A notifications - {resp.status_code}")
            return False
        
        notifications_a = resp.json().get('notifications', [])
        transfer_out_found = False
        for notif in notifications_a:
            if notif.get('kind') == 'transfer_out' and 'Payment sent' in notif.get('title', ''):
                transfer_out_found = True
                print(f"✅ User A has 'transfer_out' notification: {notif.get('title')}")
                break
        
        if not transfer_out_found:
            print(f"❌ FEATURE 1 FAILED: User A missing 'transfer_out' notification")
            print(f"   Notifications received: {json.dumps(notifications_a, indent=2)}")
            return False
        
        # Check notifications for User B (recipient)
        print("\n[7] Checking notifications for User B (recipient)...")
        resp = requests.get(
            f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {user_b_token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ FEATURE 1 FAILED: Could not fetch User B notifications - {resp.status_code}")
            return False
        
        notifications_b = resp.json().get('notifications', [])
        transfer_in_found = False
        for notif in notifications_b:
            if notif.get('kind') == 'transfer_in' and 'Payment received' in notif.get('title', ''):
                transfer_in_found = True
                print(f"✅ User B has 'transfer_in' notification: {notif.get('title')}")
                break
        
        if not transfer_in_found:
            print(f"❌ FEATURE 1 FAILED: User B missing 'transfer_in' notification")
            print(f"   Notifications received: {json.dumps(notifications_b, indent=2)}")
            return False
        
        print("\n✅ FEATURE 1 PASSED: Both sender and recipient notifications working correctly")
        return True
        
    except Exception as e:
        print(f"❌ FEATURE 1 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_feature_2_swap_endpoint():
    """
    FEATURE 2 — Swap endpoint
    Test swap quote and execution with KYC gating
    """
    print("\n" + "="*80)
    print("FEATURE 2: SWAP ENDPOINT")
    print("="*80)
    
    try:
        # Get admin token
        print("\n[1] Admin login...")
        admin_token, admin_id = get_admin_token()
        if not admin_token:
            print("❌ FEATURE 2 FAILED: Admin login failed")
            return False
        print("✅ Admin logged in")
        
        # Create test user
        print("\n[2] Creating test user...")
        timestamp = int(time.time())
        user_email = f"swap_user_{timestamp}@test.com"
        user_token, user_id, user_code = register_user(
            user_email, "Swap", "User", "US", "+1234567892", "Password123"
        )
        if not user_token:
            print("❌ FEATURE 2 FAILED: User registration failed")
            return False
        print(f"✅ User created: {user_code}")
        
        # Test swap without KYC (should fail)
        print("\n[3] Testing swap without KYC (should fail with 403)...")
        resp = requests.post(
            f"{BASE_URL}/swap",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"from_currency": "USD", "to_currency": "BTC", "amount": 100},
            timeout=10
        )
        if resp.status_code != 403:
            print(f"❌ FEATURE 2 FAILED: Expected 403 for non-KYC user, got {resp.status_code}")
            return False
        data = resp.json()
        if data.get('code') != 'KYC_REQUIRED':
            print(f"❌ FEATURE 2 FAILED: Expected code='KYC_REQUIRED', got {data.get('code')}")
            return False
        print("✅ Non-KYC user correctly blocked with 403 KYC_REQUIRED")
        
        # Approve KYC
        print("\n[4] Approving KYC for user...")
        if not approve_kyc(admin_token, user_token, user_id):
            print("❌ FEATURE 2 FAILED: Could not approve KYC")
            return False
        print("✅ KYC approved")
        
        # Credit USD balance
        print("\n[5] Crediting 200 USD to user...")
        if not credit_balance(admin_token, user_id, "USD", 200):
            print("❌ FEATURE 2 FAILED: Could not credit USD")
            return False
        print("✅ User credited with 200 USD")
        
        # Test swap quote
        print("\n[6] Testing swap quote (USD -> BTC, 100 USD)...")
        resp = requests.post(
            f"{BASE_URL}/swap/quote",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"from_currency": "USD", "to_currency": "BTC", "amount": 100},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ FEATURE 2 FAILED: Swap quote failed - {resp.status_code}: {resp.text}")
            return False
        
        quote = resp.json()
        required_fields = ['to_amount', 'rate', 'fee_bps', 'fee_usd', 'usd_value']
        for field in required_fields:
            if field not in quote:
                print(f"❌ FEATURE 2 FAILED: Quote missing field '{field}'")
                return False
        
        if quote.get('fee_bps') != 50:
            print(f"❌ FEATURE 2 FAILED: Expected fee_bps=50, got {quote.get('fee_bps')}")
            return False
        
        if quote.get('usd_value') != 100:
            print(f"❌ FEATURE 2 FAILED: Expected usd_value=100, got {quote.get('usd_value')}")
            return False
        
        print(f"✅ Swap quote received: to_amount={quote.get('to_amount')}, rate={quote.get('rate')}, fee_bps={quote.get('fee_bps')}, fee_usd={quote.get('fee_usd')}")
        
        # Execute swap
        print("\n[7] Executing swap (USD -> BTC, 100 USD)...")
        resp = requests.post(
            f"{BASE_URL}/swap",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"from_currency": "USD", "to_currency": "BTC", "amount": 100},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ FEATURE 2 FAILED: Swap execution failed - {resp.status_code}: {resp.text}")
            return False
        
        swap_result = resp.json()
        if not swap_result.get('ok'):
            print(f"❌ FEATURE 2 FAILED: Swap result ok=false")
            return False
        print("✅ Swap executed successfully")
        
        # Verify wallets
        print("\n[8] Verifying wallet balances...")
        resp = requests.get(
            f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ FEATURE 2 FAILED: Could not fetch wallets - {resp.status_code}")
            return False
        
        wallets = resp.json().get('wallets', [])
        usd_wallet = next((w for w in wallets if w['currency'] == 'USD'), None)
        btc_wallet = next((w for w in wallets if w['currency'] == 'BTC'), None)
        
        if not usd_wallet:
            print("❌ FEATURE 2 FAILED: USD wallet not found")
            return False
        
        if not btc_wallet:
            print("❌ FEATURE 2 FAILED: BTC wallet not found")
            return False
        
        # USD should be 200 - 100 = 100
        if usd_wallet['balance'] != 100:
            print(f"❌ FEATURE 2 FAILED: Expected USD balance=100, got {usd_wallet['balance']}")
            return False
        
        # BTC should be > 0
        if btc_wallet['balance'] <= 0:
            print(f"❌ FEATURE 2 FAILED: Expected BTC balance > 0, got {btc_wallet['balance']}")
            return False
        
        print(f"✅ Wallet balances correct: USD={usd_wallet['balance']}, BTC={btc_wallet['balance']}")
        
        # Verify transaction record
        print("\n[9] Verifying transaction record...")
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            tx = db.transactions.find_one({'user_id': user_id, 'type': 'swap'}, sort=[('created_at', -1)])
            if not tx:
                print("❌ FEATURE 2 FAILED: Swap transaction not found in DB")
                client.close()
                return False
            
            if tx.get('from_currency') != 'USD':
                print(f"❌ FEATURE 2 FAILED: Expected from_currency=USD, got {tx.get('from_currency')}")
                client.close()
                return False
            
            if tx.get('to_currency') != 'BTC':
                print(f"❌ FEATURE 2 FAILED: Expected to_currency=BTC, got {tx.get('to_currency')}")
                client.close()
                return False
            
            if tx.get('from_amount') != 100:
                print(f"❌ FEATURE 2 FAILED: Expected from_amount=100, got {tx.get('from_amount')}")
                client.close()
                return False
            
            if tx.get('to_amount') <= 0:
                print(f"❌ FEATURE 2 FAILED: Expected to_amount > 0, got {tx.get('to_amount')}")
                client.close()
                return False
            
            if tx.get('fee_bps') != 50:
                print(f"❌ FEATURE 2 FAILED: Expected fee_bps=50, got {tx.get('fee_bps')}")
                client.close()
                return False
            
            print(f"✅ Transaction record correct: from_amount={tx.get('from_amount')}, to_amount={tx.get('to_amount')}, fee_bps={tx.get('fee_bps')}")
            
            # Verify chain block
            print("\n[10] Verifying public chain block...")
            block = db.aurela_chain.find_one({'type': 'swap', 'tx_id': tx.get('id')})
            if not block:
                print("❌ FEATURE 2 FAILED: Swap block not found in chain")
                client.close()
                return False
            
            print(f"✅ Chain block created: block_number={block.get('block_number')}, type={block.get('type')}")
            client.close()
            
        except Exception as e:
            print(f"❌ FEATURE 2 FAILED: DB verification exception - {e}")
            return False
        
        # Test same-currency swap (should fail)
        print("\n[11] Testing same-currency swap (should fail with 400)...")
        resp = requests.post(
            f"{BASE_URL}/swap",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"from_currency": "USD", "to_currency": "USD", "amount": 10},
            timeout=10
        )
        if resp.status_code != 400:
            print(f"❌ FEATURE 2 FAILED: Expected 400 for same-currency swap, got {resp.status_code}")
            return False
        print("✅ Same-currency swap correctly rejected with 400")
        
        # Test insufficient balance (should fail)
        print("\n[12] Testing insufficient balance swap (should fail with 400)...")
        resp = requests.post(
            f"{BASE_URL}/swap",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"from_currency": "USD", "to_currency": "BTC", "amount": 500},
            timeout=10
        )
        if resp.status_code != 400:
            print(f"❌ FEATURE 2 FAILED: Expected 400 for insufficient balance, got {resp.status_code}")
            return False
        print("✅ Insufficient balance correctly rejected with 400")
        
        print("\n✅ FEATURE 2 PASSED: All swap endpoint tests passed")
        return True
        
    except Exception as e:
        print(f"❌ FEATURE 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_feature_3_public_chain_endpoints():
    """
    FEATURE 3 — Public chain endpoints (no auth required)
    Test /api/public/chain, /api/public/chain/stats, /api/public/chain/search
    """
    print("\n" + "="*80)
    print("FEATURE 3: PUBLIC CHAIN ENDPOINTS (NO AUTH)")
    print("="*80)
    
    try:
        # Test GET /api/public/chain
        print("\n[1] Testing GET /api/public/chain (no auth)...")
        resp = requests.get(f"{BASE_URL}/public/chain", timeout=10)
        if resp.status_code != 200:
            print(f"❌ FEATURE 3 FAILED: /public/chain returned {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        required_fields = ['total', 'page', 'limit', 'blocks']
        for field in required_fields:
            if field not in data:
                print(f"❌ FEATURE 3 FAILED: /public/chain missing field '{field}'")
                return False
        
        if not isinstance(data['blocks'], list):
            print(f"❌ FEATURE 3 FAILED: blocks should be a list")
            return False
        
        # Verify projection strips sensitive fields
        if len(data['blocks']) > 0:
            block = data['blocks'][0]
            sensitive_fields = ['from_user_id', 'to_user_id', 'tx_id']
            for field in sensitive_fields:
                if field in block:
                    print(f"❌ FEATURE 3 FAILED: Block contains sensitive field '{field}'")
                    return False
        
        print(f"✅ /public/chain working: total={data['total']}, blocks={len(data['blocks'])}")
        
        # Test pagination
        print("\n[2] Testing GET /api/public/chain?limit=5&page=2...")
        resp = requests.get(f"{BASE_URL}/public/chain?limit=5&page=2", timeout=10)
        if resp.status_code != 200:
            print(f"❌ FEATURE 3 FAILED: /public/chain pagination returned {resp.status_code}")
            return False
        
        data = resp.json()
        if len(data['blocks']) > 5:
            print(f"❌ FEATURE 3 FAILED: Expected max 5 blocks, got {len(data['blocks'])}")
            return False
        
        print(f"✅ Pagination working: page={data['page']}, limit={data['limit']}, blocks={len(data['blocks'])}")
        
        # Test GET /api/public/chain/stats
        print("\n[3] Testing GET /api/public/chain/stats...")
        resp = requests.get(f"{BASE_URL}/public/chain/stats", timeout=10)
        if resp.status_code != 200:
            print(f"❌ FEATURE 3 FAILED: /public/chain/stats returned {resp.status_code}: {resp.text}")
            return False
        
        stats = resp.json()
        required_fields = ['total_blocks', 'latest_block', 'latest_timestamp', 'blocks_24h', 
                          'avg_block_time_seconds', 'network', 'chain_id', 'registered_addresses']
        for field in required_fields:
            if field not in stats:
                print(f"❌ FEATURE 3 FAILED: /public/chain/stats missing field '{field}'")
                return False
        
        print(f"✅ /public/chain/stats working: total_blocks={stats['total_blocks']}, network={stats['network']}, chain_id={stats['chain_id']}")
        
        # Test GET /api/public/chain/search with block number
        print("\n[4] Testing GET /api/public/chain/search?q=<block_number>...")
        # Get a block number first
        resp = requests.get(f"{BASE_URL}/public/chain?limit=1", timeout=10)
        if resp.status_code == 200 and len(resp.json()['blocks']) > 0:
            block_number = resp.json()['blocks'][0]['block_number']
            resp = requests.get(f"{BASE_URL}/public/chain/search?q={block_number}", timeout=10)
            if resp.status_code != 200:
                print(f"❌ FEATURE 3 FAILED: /public/chain/search returned {resp.status_code}")
                return False
            
            search_result = resp.json()
            if search_result.get('kind') != 'block':
                print(f"❌ FEATURE 3 FAILED: Expected kind='block', got {search_result.get('kind')}")
                return False
            
            if 'block' not in search_result:
                print(f"❌ FEATURE 3 FAILED: Search result missing 'block' field")
                return False
            
            print(f"✅ Block search working: found block {block_number}")
        else:
            print("⚠️  No blocks available for search test, skipping")
        
        # Test GET /api/public/chain/search with Aurela ID
        print("\n[5] Testing GET /api/public/chain/search?q=<aurela_id>...")
        # Get admin user code
        admin_token, admin_id = get_admin_token()
        if admin_token:
            resp = requests.get(
                f"{BASE_URL}/admin/users",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=10
            )
            if resp.status_code == 200:
                users = resp.json().get('users', [])
                if len(users) > 0:
                    user_code = users[0].get('user_code')
                    if user_code:
                        resp = requests.get(f"{BASE_URL}/public/chain/search?q={user_code}", timeout=10)
                        if resp.status_code != 200:
                            print(f"❌ FEATURE 3 FAILED: /public/chain/search with user_code returned {resp.status_code}")
                            return False
                        
                        search_result = resp.json()
                        if search_result.get('kind') != 'address':
                            print(f"❌ FEATURE 3 FAILED: Expected kind='address', got {search_result.get('kind')}")
                            return False
                        
                        if 'address' not in search_result or 'blocks' not in search_result:
                            print(f"❌ FEATURE 3 FAILED: Search result missing 'address' or 'blocks' field")
                            return False
                        
                        print(f"✅ Address search working: found {user_code}")
        
        # Test GET /api/public/chain/search with nonsense query
        print("\n[6] Testing GET /api/public/chain/search?q=nonsense...")
        resp = requests.get(f"{BASE_URL}/public/chain/search?q=nonsense12345xyz", timeout=10)
        if resp.status_code != 200:
            print(f"❌ FEATURE 3 FAILED: /public/chain/search with nonsense returned {resp.status_code}")
            return False
        
        search_result = resp.json()
        if search_result.get('kind') != 'not_found':
            print(f"❌ FEATURE 3 FAILED: Expected kind='not_found', got {search_result.get('kind')}")
            return False
        
        print(f"✅ Nonsense search correctly returns kind='not_found'")
        
        # Test GET /api/public/chain/search with empty query (should fail)
        print("\n[7] Testing GET /api/public/chain/search?q= (empty, should fail with 400)...")
        resp = requests.get(f"{BASE_URL}/public/chain/search?q=", timeout=10)
        if resp.status_code != 400:
            print(f"❌ FEATURE 3 FAILED: Expected 400 for empty query, got {resp.status_code}")
            return False
        
        print(f"✅ Empty query correctly rejected with 400")
        
        print("\n✅ FEATURE 3 PASSED: All public chain endpoints working correctly")
        return True
        
    except Exception as e:
        print(f"❌ FEATURE 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_feature_4_sitemap_robots():
    """
    FEATURE 4 — Sitemap + robots
    Test /sitemap.xml, /robots.txt, /scan page
    """
    print("\n" + "="*80)
    print("FEATURE 4: SITEMAP + ROBOTS + /SCAN PAGE")
    print("="*80)
    
    try:
        # Test GET /sitemap.xml
        print("\n[1] Testing GET /sitemap.xml...")
        resp = requests.get(f"{FRONTEND_URL}/sitemap.xml", timeout=10)
        if resp.status_code != 200:
            print(f"❌ FEATURE 4 FAILED: /sitemap.xml returned {resp.status_code}: {resp.text}")
            return False
        
        content = resp.text
        if 'xml' not in resp.headers.get('content-type', '').lower():
            print(f"⚠️  Warning: /sitemap.xml content-type is {resp.headers.get('content-type')}, expected XML")
        
        # Check for required URLs
        required_urls = [
            'https://www.aurelawallet.com/',
            'https://www.aurelawallet.com/scan'
        ]
        for url in required_urls:
            if url not in content:
                print(f"❌ FEATURE 4 FAILED: /sitemap.xml missing URL: {url}")
                return False
        
        print(f"✅ /sitemap.xml working: contains required URLs")
        
        # Test GET /robots.txt
        print("\n[2] Testing GET /robots.txt...")
        resp = requests.get(f"{FRONTEND_URL}/robots.txt", timeout=10)
        if resp.status_code != 200:
            print(f"❌ FEATURE 4 FAILED: /robots.txt returned {resp.status_code}: {resp.text}")
            return False
        
        content = resp.text
        if 'Sitemap: https://www.aurelawallet.com/sitemap.xml' not in content:
            print(f"❌ FEATURE 4 FAILED: /robots.txt missing sitemap reference")
            print(f"   Content: {content}")
            return False
        
        print(f"✅ /robots.txt working: contains sitemap reference")
        
        # Test GET /scan
        print("\n[3] Testing GET /scan (server-rendered page)...")
        resp = requests.get(f"{FRONTEND_URL}/scan", timeout=10)
        if resp.status_code != 200:
            print(f"❌ FEATURE 4 FAILED: /scan returned {resp.status_code}: {resp.text}")
            return False
        
        content = resp.text
        if 'html' not in resp.headers.get('content-type', '').lower():
            print(f"⚠️  Warning: /scan content-type is {resp.headers.get('content-type')}, expected HTML")
        
        # Check for basic HTML structure
        if '<html' not in content.lower() or '</html>' not in content.lower():
            print(f"❌ FEATURE 4 FAILED: /scan does not return valid HTML")
            return False
        
        print(f"✅ /scan working: returns HTML page")
        
        print("\n✅ FEATURE 4 PASSED: All sitemap/robots/scan tests passed")
        return True
        
    except Exception as e:
        print(f"❌ FEATURE 4 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_regression():
    """
    REGRESSION — Test existing endpoints still work
    """
    print("\n" + "="*80)
    print("REGRESSION: EXISTING ENDPOINTS")
    print("="*80)
    
    try:
        # Test GET /api/rates
        print("\n[1] Testing GET /api/rates...")
        resp = requests.get(f"{BASE_URL}/rates", timeout=10)
        if resp.status_code != 200:
            print(f"❌ REGRESSION FAILED: /rates returned {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        required_fields = ['crypto_usd', 'fx', 'aur']
        for field in required_fields:
            if field not in data:
                print(f"❌ REGRESSION FAILED: /rates missing field '{field}'")
                return False
        
        print(f"✅ /rates working")
        
        # Test admin login
        print("\n[2] Testing admin login...")
        admin_token, admin_id = get_admin_token()
        if not admin_token:
            print("❌ REGRESSION FAILED: Admin login failed")
            return False
        print("✅ Admin login working")
        
        # Test GET /api/config
        print("\n[3] Testing GET /api/config...")
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        if resp.status_code != 200:
            print(f"❌ REGRESSION FAILED: /config returned {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        if 'enabled_fiat' not in data or 'enabled_crypto' not in data:
            print(f"❌ REGRESSION FAILED: /config missing currency fields")
            return False
        
        print(f"✅ /config working")
        
        print("\n✅ REGRESSION PASSED: All existing endpoints working")
        return True
        
    except Exception as e:
        print(f"❌ REGRESSION FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("AURELA NEW FEATURES TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Frontend URL: {FRONTEND_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    
    results = {}
    
    # Run all tests
    results['Feature 1: Payment Notifications'] = test_feature_1_payment_notifications()
    results['Feature 2: Swap Endpoint'] = test_feature_2_swap_endpoint()
    results['Feature 3: Public Chain Endpoints'] = test_feature_3_public_chain_endpoints()
    results['Feature 4: Sitemap + Robots'] = test_feature_4_sitemap_robots()
    results['Regression'] = test_regression()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = 0
    failed = 0
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed} passed, {failed} failed out of {passed + failed} tests")
    print("="*80)
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
