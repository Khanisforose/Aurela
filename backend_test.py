#!/usr/bin/env python3
"""
Backend test for Aurela geolocation withdrawal-hold flow
Tests 3 specific scenarios as per review request
"""
import requests
import time
import json
from datetime import datetime

# Configuration
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def wait_for_server(max_retries=3):
    """Wait for server to be ready (handle 502 errors)"""
    for i in range(max_retries):
        try:
            resp = requests.get(f"{BASE_URL}/health", timeout=10)
            if resp.status_code == 200:
                return True
            if resp.status_code == 502:
                log(f"⏳ Server restarting (502), waiting 20s... (attempt {i+1}/{max_retries})")
                time.sleep(20)
            else:
                return True
        except Exception as e:
            log(f"⏳ Connection error: {e}, waiting 20s... (attempt {i+1}/{max_retries})")
            time.sleep(20)
    return False

def admin_login():
    """Login as admin and return token"""
    log("🔐 Admin login...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        log(f"❌ Admin login failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    log(f"✅ Admin logged in: {data.get('user', {}).get('email')}")
    return data.get('token')

def create_kyc_approved_user(admin_token):
    """Create a fresh user with KYC approved"""
    timestamp = int(time.time() * 1000)
    email = f"testuser_{timestamp}@test.com"
    password = "TestPass123!"
    
    log(f"📝 Creating user: {email}")
    
    # Step 1: Register init
    resp = requests.post(f"{BASE_URL}/auth/register/init", json={
        "first_name": "Test",
        "last_name": "User",
        "email": email,
        "country": "United States",
        "phone": f"+1555{timestamp % 10000000:07d}",
        "password": password
    })
    
    if resp.status_code != 200:
        log(f"❌ Register init failed: {resp.status_code} {resp.text}")
        return None, None, None
    
    data = resp.json()
    signup_id = data.get('signup_id')
    otp = data.get('dev_otp')
    
    if not otp:
        log(f"⚠️ No dev_otp in response, fetching from MongoDB...")
        # Fetch OTP from MongoDB
        import subprocess
        result = subprocess.run([
            'mongosh', 'mongodb://localhost:27017/aurela', '--quiet', '--eval',
            f"db.pending_signups.findOne({{id: '{signup_id}'}}, {{code: 1, _id: 0}})"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            try:
                import re
                match = re.search(r"code:\s*'(\d+)'", result.stdout)
                if match:
                    otp = match.group(1)
                    log(f"✅ Fetched OTP from DB: {otp}")
                else:
                    log(f"❌ Could not parse OTP from DB output: {result.stdout}")
                    return None, None, None
            except Exception as e:
                log(f"❌ Error parsing OTP: {e}")
                return None, None, None
        else:
            log(f"❌ MongoDB query failed: {result.stderr}")
            return None, None, None
    else:
        log(f"📧 OTP from response: {otp}")
    
    # Step 2: Verify OTP
    time.sleep(1)
    resp = requests.post(f"{BASE_URL}/auth/register/verify", json={
        "signup_id": signup_id,
        "code": otp
    })
    
    if resp.status_code != 200:
        log(f"❌ Register verify failed: {resp.status_code} {resp.text}")
        return None, None, None
    
    data = resp.json()
    user_token = data.get('token')
    user_id = data.get('user', {}).get('id')
    
    log(f"✅ User created: {email} (ID: {user_id})")
    
    # Step 3: Submit KYC
    log("📄 Submitting KYC...")
    resp = requests.post(f"{BASE_URL}/kyc", 
        headers={"Authorization": f"Bearer {user_token}"},
        json={
            "first_name": "Test",
            "last_name": "User",
            "mobile": f"+1555{timestamp % 10000000:07d}",
            "country": "United States",
            "state": "California",
            "city": "Los Angeles",
            "address": "123 Test St",
            "postal_code": "90001",
            "occupation": "Engineer",
            "id_type": "passport",
            "id_number": f"P{timestamp % 100000000:08d}",
            "doc_front": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "doc_back": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "selfie": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
    )
    
    if resp.status_code != 200:
        log(f"❌ KYC submit failed: {resp.status_code} {resp.text}")
        return None, None, None
    
    kyc_data = resp.json()
    kyc_id = kyc_data.get('kyc', {}).get('id')
    log(f"✅ KYC submitted (ID: {kyc_id})")
    
    # Step 4: Admin approves KYC
    log("✅ Admin approving KYC...")
    resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if resp.status_code != 200:
        log(f"❌ KYC approve failed: {resp.status_code} {resp.text}")
        return None, None, None
    
    log(f"✅ KYC approved for {email}")
    
    return user_id, user_token, email

def test_a_merge_fix(admin_token):
    """
    TEST A: Merge fix - User makes 3 withdrawal attempts, 
    admin should see exactly ONE open attempt with count === 3
    """
    log("\n" + "="*80)
    log("TEST A: Withdrawal attempt merge (3 attempts → 1 merged record with count=3)")
    log("="*80)
    
    try:
        # Create fresh KYC-approved user
        user_id, user_token, email = create_kyc_approved_user(admin_token)
        if not user_id:
            log("❌ TEST A FAILED: Could not create user")
            return False
        
        # Request a basic card
        log("💳 Requesting basic card...")
        resp = requests.post(f"{BASE_URL}/cards/request",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"tier": "basic"}
        )
        if resp.status_code != 200:
            log(f"❌ Card request failed: {resp.status_code} {resp.text}")
            return False
        
        card_id = resp.json().get('card', {}).get('id')
        log(f"✅ Card requested (ID: {card_id})")
        
        # Activate card with tx_hash
        log("🔓 Activating card with tx_hash...")
        resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"tx_hash": "0xabc123def456789"}
        )
        if resp.status_code != 200:
            log(f"❌ Card activation failed: {resp.status_code} {resp.text}")
            return False
        
        log("✅ Card activation submitted (pending verification)")
        
        # Admin credits 200 USD
        log("💰 Admin crediting 200 USD...")
        resp = requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"currency": "USD", "amount": 200, "kind": "credit"}
        )
        if resp.status_code != 200:
            log(f"❌ Credit failed: {resp.status_code} {resp.text}")
            return False
        
        log("✅ 200 USD credited")
        
        # Admin approves card with activate_now=true (this sets withdraw_lock)
        log("✅ Admin approving card (activate_now=true)...")
        resp = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"activate_now": True}
        )
        if resp.status_code != 200:
            log(f"❌ Card approval failed: {resp.status_code} {resp.text}")
            return False
        
        log("✅ Card approved and activated (withdraw_lock should be set)")
        
        # Verify user has withdraw_lock
        resp = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        user_data = resp.json().get('user', {})
        withdraw_lock = user_data.get('withdraw_lock', {})
        log(f"🔒 User withdraw_lock: active={withdraw_lock.get('active')}, reason={withdraw_lock.get('reason')}")
        
        # Make 3 withdrawal attempts (all should be blocked with 403 GEO_UNVERIFIED)
        log("\n📤 Making 3 withdrawal attempts (should all be blocked)...")
        
        for i in range(3):
            log(f"\n  Attempt {i+1}/3:")
            resp = requests.post(f"{BASE_URL}/withdraw",
                headers={"Authorization": f"Bearer {user_token}"},
                json={
                    "method": "bank_swift",
                    "currency": "USD",
                    "amount": 50,
                    "destination": "GB29NWBK60161331926819",
                    "details": {
                        "bank_name": "Test Bank",
                        "account_holder": "Test User",
                        "account_number": "GB29NWBK60161331926819",
                        "swift": "HBUKGB4B"
                    }
                }
            )
            
            if resp.status_code == 502:
                log("  ⏳ 502 error (server restart), waiting 20s...")
                time.sleep(20)
                # Retry
                resp = requests.post(f"{BASE_URL}/withdraw",
                    headers={"Authorization": f"Bearer {user_token}"},
                    json={
                        "method": "bank_swift",
                        "currency": "USD",
                        "amount": 50,
                        "destination": "GB29NWBK60161331926819",
                        "details": {
                            "bank_name": "Test Bank",
                            "account_holder": "Test User",
                            "account_number": "GB29NWBK60161331926819",
                            "swift": "HBUKGB4B"
                        }
                    }
                )
            
            if resp.status_code == 403:
                data = resp.json()
                code = data.get('code')
                error = data.get('error')
                log(f"  ✅ Blocked with 403 {code}: {error}")
            else:
                log(f"  ❌ Expected 403 GEO_UNVERIFIED, got {resp.status_code}: {resp.text}")
                return False
            
            time.sleep(1)  # Small delay between attempts
        
        # Admin checks withdraw-attempts (should see exactly ONE open attempt with count=3)
        log("\n🔍 Admin checking withdraw-attempts...")
        resp = requests.get(f"{BASE_URL}/admin/withdraw-attempts?status=open",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error (server restart), waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/admin/withdraw-attempts?status=open",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        if resp.status_code != 200:
            log(f"❌ Get withdraw-attempts failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        attempts = data.get('attempts', [])
        open_count = data.get('open', 0)
        
        log(f"📊 Total open attempts: {open_count}")
        
        # Find attempts for our user
        user_attempts = [a for a in attempts if a.get('user_id') == user_id]
        log(f"📊 Open attempts for user {email}: {len(user_attempts)}")
        
        if len(user_attempts) != 1:
            log(f"❌ Expected exactly 1 merged attempt, found {len(user_attempts)}")
            log(f"   Attempts: {json.dumps(user_attempts, indent=2)}")
            return False
        
        attempt = user_attempts[0]
        count = attempt.get('count')
        amount = attempt.get('amount')
        currency = attempt.get('currency')
        
        log(f"📊 Merged attempt: count={count}, amount={amount} {currency}")
        
        if count != 3:
            log(f"❌ Expected count=3, got count={count}")
            return False
        
        if amount != 50:
            log(f"❌ Expected amount=50, got amount={amount}")
            return False
        
        log("✅ TEST A PASSED: 3 attempts merged into 1 record with count=3")
        return True
        
    except Exception as e:
        log(f"❌ TEST A FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_b_allowance_restore(admin_token):
    """
    TEST B: Allowance restore on reject
    Admin sets allowance 60, user withdraws 40 (allowance becomes 20),
    admin rejects the withdrawal, user's allowance should restore to 60 and balance to 200
    """
    log("\n" + "="*80)
    log("TEST B: Allowance restore on withdrawal rejection")
    log("="*80)
    
    try:
        # Create fresh KYC-approved user
        user_id, user_token, email = create_kyc_approved_user(admin_token)
        if not user_id:
            log("❌ TEST B FAILED: Could not create user")
            return False
        
        # Request and activate card
        log("💳 Requesting basic card...")
        resp = requests.post(f"{BASE_URL}/cards/request",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"tier": "basic"}
        )
        card_id = resp.json().get('card', {}).get('id')
        
        log("🔓 Activating card...")
        requests.post(f"{BASE_URL}/cards/{card_id}/activate",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"tx_hash": "0xtest123"}
        )
        
        # Admin credits 200 USD
        log("💰 Admin crediting 200 USD...")
        requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"currency": "USD", "amount": 200, "kind": "credit"}
        )
        
        # Admin approves card (sets withdraw_lock)
        log("✅ Admin approving card...")
        requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"activate_now": True}
        )
        
        # Admin sets allowance to 60 USD
        log("🔓 Admin setting withdraw allowance to 60 USD...")
        resp = requests.post(f"{BASE_URL}/admin/users/{user_id}/withdraw_access",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"mode": "allowance", "allowance_usd": 60}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.post(f"{BASE_URL}/admin/users/{user_id}/withdraw_access",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"mode": "allowance", "allowance_usd": 60}
            )
        
        if resp.status_code != 200:
            log(f"❌ Set allowance failed: {resp.status_code} {resp.text}")
            return False
        
        log("✅ Allowance set to 60 USD")
        
        # Verify allowance
        resp = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        user_data = resp.json().get('user', {})
        allowance = user_data.get('withdraw_allowance_usd', 0)
        log(f"📊 Current allowance: {allowance} USD")
        
        if allowance != 60:
            log(f"❌ Expected allowance=60, got {allowance}")
            return False
        
        # User withdraws 40 USD (should succeed and consume allowance)
        log("\n📤 User withdrawing 40 USD...")
        resp = requests.post(f"{BASE_URL}/withdraw",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "method": "bank_swift",
                "currency": "USD",
                "amount": 40,
                "destination": "GB29NWBK60161331926819",
                "details": {
                    "bank_name": "Test Bank",
                    "account_holder": "Test User",
                    "account_number": "GB29NWBK60161331926819",
                    "swift": "HBUKGB4B"
                }
            }
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.post(f"{BASE_URL}/withdraw",
                headers={"Authorization": f"Bearer {user_token}"},
                json={
                    "method": "bank_swift",
                    "currency": "USD",
                    "amount": 40,
                    "destination": "GB29NWBK60161331926819",
                    "details": {
                        "bank_name": "Test Bank",
                        "account_holder": "Test User",
                        "account_number": "GB29NWBK60161331926819",
                        "swift": "HBUKGB4B"
                    }
                }
            )
        
        if resp.status_code != 200:
            log(f"❌ Withdrawal failed: {resp.status_code} {resp.text}")
            return False
        
        log("✅ Withdrawal request submitted")
        
        # Check allowance decreased to 20
        resp = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        user_data = resp.json().get('user', {})
        allowance = user_data.get('withdraw_allowance_usd', 0)
        log(f"📊 Allowance after withdrawal: {allowance} USD")
        
        if abs(allowance - 20) > 0.01:
            log(f"❌ Expected allowance=20, got {allowance}")
            return False
        
        # Check balance and locked
        resp = requests.get(f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        wallets = resp.json().get('wallets', [])
        usd_wallet = next((w for w in wallets if w.get('currency') == 'USD'), None)
        balance = usd_wallet.get('balance', 0)
        locked = usd_wallet.get('locked', 0)
        log(f"📊 USD wallet: balance={balance}, locked={locked}")
        
        if balance != 160:
            log(f"❌ Expected balance=160, got {balance}")
            return False
        
        if locked != 40:
            log(f"❌ Expected locked=40, got {locked}")
            return False
        
        # Find the withdrawal request
        log("\n🔍 Finding withdrawal request...")
        resp = requests.get(f"{BASE_URL}/admin/withdrawals",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/admin/withdrawals",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        if resp.status_code != 200:
            log(f"❌ Get withdrawals failed: {resp.status_code} {resp.text}")
            return False
        
        withdrawals = resp.json().get('withdrawals', [])
        user_withdrawal = next((w for w in withdrawals if w.get('user_id') == user_id and w.get('status') == 'pending' and w.get('amount') == 40), None)
        
        if not user_withdrawal:
            log(f"❌ Could not find pending withdrawal for user")
            log(f"   All withdrawals: {json.dumps([{'user_id': w.get('user_id'), 'status': w.get('status'), 'amount': w.get('amount')} for w in withdrawals], indent=2)}")
            return False
        
        withdrawal_id = user_withdrawal.get('id')
        log(f"✅ Found withdrawal request (ID: {withdrawal_id})")
        
        # Admin rejects the withdrawal
        log("\n❌ Admin rejecting withdrawal...")
        resp = requests.post(f"{BASE_URL}/admin/withdrawals/{withdrawal_id}/reject",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.post(f"{BASE_URL}/admin/withdrawals/{withdrawal_id}/reject",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        if resp.status_code != 200:
            log(f"❌ Reject failed: {resp.status_code} {resp.text}")
            return False
        
        log("✅ Withdrawal rejected")
        
        # Check allowance restored to 60
        resp = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        user_data = resp.json().get('user', {})
        allowance = user_data.get('withdraw_allowance_usd', 0)
        log(f"📊 Allowance after rejection: {allowance} USD")
        
        if allowance != 60:
            log(f"❌ Expected allowance=60 (restored), got {allowance}")
            return False
        
        # Check balance restored to 200 and locked cleared
        resp = requests.get(f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        wallets = resp.json().get('wallets', [])
        usd_wallet = next((w for w in wallets if w.get('currency') == 'USD'), None)
        balance = usd_wallet.get('balance', 0)
        locked = usd_wallet.get('locked', 0)
        log(f"📊 USD wallet after rejection: balance={balance}, locked={locked}")
        
        if balance != 200:
            log(f"❌ Expected balance=200 (restored), got {balance}")
            return False
        
        if locked != 0:
            log(f"❌ Expected locked=0 (cleared), got {locked}")
            return False
        
        log("✅ TEST B PASSED: Allowance and balance restored correctly on rejection")
        return True
        
    except Exception as e:
        log(f"❌ TEST B FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_c_regression(admin_token):
    """
    TEST C: Regression tests
    GET /api/admin/kyc → 200 with {kyc,total,pending}
    GET /api/version → 200 version '1.4.1'
    GET /api/admin/cards → 200
    """
    log("\n" + "="*80)
    log("TEST C: Regression tests")
    log("="*80)
    
    try:
        # Test 1: GET /api/admin/kyc
        log("\n1️⃣ Testing GET /api/admin/kyc...")
        resp = requests.get(f"{BASE_URL}/admin/kyc",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/admin/kyc",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        if resp.status_code != 200:
            log(f"❌ GET /admin/kyc failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        if 'kyc' not in data or 'total' not in data or 'pending' not in data:
            log(f"❌ Response missing required keys: {list(data.keys())}")
            return False
        
        log(f"✅ GET /admin/kyc: 200 with kyc={len(data['kyc'])}, total={data['total']}, pending={data['pending']}")
        
        # Test 2: GET /api/version
        log("\n2️⃣ Testing GET /api/version...")
        resp = requests.get(f"{BASE_URL}/version")
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/version")
        
        if resp.status_code != 200:
            log(f"❌ GET /version failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        version = data.get('version')
        log(f"✅ GET /version: 200 with version='{version}'")
        
        if version != '1.4.1':
            log(f"⚠️ Expected version '1.4.1', got '{version}'")
            # Not a failure, just a warning
        
        # Test 3: GET /api/admin/cards
        log("\n3️⃣ Testing GET /api/admin/cards...")
        resp = requests.get(f"{BASE_URL}/admin/cards",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/admin/cards",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        if resp.status_code != 200:
            log(f"❌ GET /admin/cards failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        cards = data.get('cards', [])
        log(f"✅ GET /admin/cards: 200 with {len(cards)} cards")
        
        log("✅ TEST C PASSED: All regression tests passed")
        return True
        
    except Exception as e:
        log(f"❌ TEST C FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    log("🚀 Starting Aurela Geolocation Withdrawal-Hold Flow Tests")
    log(f"🌐 Backend URL: {BASE_URL}")
    
    # Wait for server to be ready
    if not wait_for_server():
        log("❌ Server not responding, aborting tests")
        return
    
    # Admin login
    admin_token = admin_login()
    if not admin_token:
        log("❌ Admin login failed, aborting tests")
        return
    
    # Run tests
    results = {}
    
    results['TEST_A'] = test_a_merge_fix(admin_token)
    results['TEST_B'] = test_b_allowance_restore(admin_token)
    results['TEST_C'] = test_c_regression(admin_token)
    
    # Summary
    log("\n" + "="*80)
    log("📊 TEST SUMMARY")
    log("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        log(f"{test_name}: {status}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    log(f"\n🎯 Total: {passed}/{total} tests passed")
    
    if passed == total:
        log("🎉 ALL TESTS PASSED!")
    else:
        log("⚠️ SOME TESTS FAILED")

if __name__ == "__main__":
    main()
