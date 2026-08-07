#!/usr/bin/env python3
"""
Focused Re-verification Test
Tests two previously-failed scenarios:
1. Welcome bonus on new signup (USD 1000, USDT 100)
2. Admin chain delete flow
"""

import requests
import json
import random
import string
import time
import subprocess

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

def get_otp_from_db(signup_id):
    """Get OTP code from MongoDB for a given signup_id"""
    try:
        cmd = f"mongosh aurela --quiet --eval \"db.pending_signups.findOne({{id:'{signup_id}'}})\" 2>/dev/null"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            # Parse the output to find the code field
            output = result.stdout
            if 'code:' in output:
                # Extract code value (format: code: '123456')
                for line in output.split('\n'):
                    if 'code:' in line:
                        code = line.split("'")[1] if "'" in line else None
                        return code
        return None
    except Exception as e:
        print(f"  Warning: Could not fetch OTP from DB: {e}")
        return None

def random_email():
    """Generate random email for testing"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"testuser{rand}@aurela.test"

def random_phone():
    """Generate random phone number"""
    return ''.join(random.choices(string.digits, k=10))

def print_test(test_name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{test_name}: {status}")
    if details:
        print(f"  Details: {details}")

def admin_login():
    """Login as admin and return token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get('token')
        else:
            print(f"❌ Admin login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Admin login error: {e}")
        return None

def test_welcome_bonus():
    """
    Test 1: Welcome bonus on new signup
    1. POST /api/auth/register/init with fresh email + required fields
    2. POST /api/auth/register/verify with signup_id + code
    3. GET /api/wallets → verify USD wallet balance === 1000, USDT wallet balance === 100
    """
    print("\n" + "="*80)
    print("TEST 1: WELCOME BONUS ON NEW SIGNUP")
    print("="*80)
    
    # Step 1: Register init
    email = random_email()
    password = "TestPass123#"
    first_name = "John"
    last_name = "Doe"
    country = "US"
    phone = random_phone()
    
    print(f"\nStep 1: POST /api/auth/register/init with email={email}")
    try:
        response = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": email,
            "password": password,
            "first_name": first_name,
            "last_name": last_name,
            "country": country,
            "phone": phone
        })
        
        if response.status_code != 200:
            print_test("Register init", False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        signup_id = data.get('signup_id')
        dev_otp = data.get('dev_otp')
        
        if not signup_id:
            print_test("Register init", False, "No signup_id in response")
            return False
        
        # If dev_otp is not in response (email was sent successfully), fetch from DB
        if not dev_otp:
            print("  Email sent successfully, fetching OTP from database...")
            dev_otp = get_otp_from_db(signup_id)
            if not dev_otp:
                print_test("Register init", False, "Could not get OTP from response or database")
                return False
        
        print_test("Register init", True, f"signup_id={signup_id}, code={dev_otp}")
        
    except Exception as e:
        print_test("Register init", False, f"Exception: {e}")
        return False
    
    # Step 2: Register verify
    print(f"\nStep 2: POST /api/auth/register/verify with signup_id={signup_id}, code={dev_otp}")
    try:
        response = requests.post(f"{BASE_URL}/auth/register/verify", json={
            "signup_id": signup_id,
            "code": dev_otp
        })
        
        if response.status_code != 200:
            print_test("Register verify", False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        token = data.get('token')
        user = data.get('user')
        
        if not token or not user:
            print_test("Register verify", False, "No token or user in response")
            return False
        
        print_test("Register verify", True, f"User created with id={user.get('id')}, user_code={user.get('user_code')}")
        
    except Exception as e:
        print_test("Register verify", False, f"Exception: {e}")
        return False
    
    # Step 3: Get wallets and verify welcome bonus
    print(f"\nStep 3: GET /api/wallets with token")
    try:
        response = requests.get(f"{BASE_URL}/wallets", headers={
            "Authorization": f"Bearer {token}"
        })
        
        if response.status_code != 200:
            print_test("Get wallets", False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        wallets = data.get('wallets', [])
        
        print(f"  Total wallets: {len(wallets)}")
        
        # Find USD and USDT wallets
        usd_wallet = next((w for w in wallets if w.get('currency') == 'USD'), None)
        usdt_wallet = next((w for w in wallets if w.get('currency') == 'USDT'), None)
        
        if not usd_wallet:
            print_test("USD wallet exists", False, "USD wallet not found")
            return False
        
        if not usdt_wallet:
            print_test("USDT wallet exists", False, "USDT wallet not found")
            return False
        
        usd_balance = usd_wallet.get('balance', 0)
        usdt_balance = usdt_wallet.get('balance', 0)
        
        print(f"  USD wallet balance: {usd_balance} (expected: 1000)")
        print(f"  USDT wallet balance: {usdt_balance} (expected: 100)")
        
        # Check USD balance
        if usd_balance != 1000:
            print_test("USD welcome bonus", False, f"Expected 1000, got {usd_balance}")
            return False
        else:
            print_test("USD welcome bonus", True, "Balance is 1000 ✅")
        
        # Check USDT balance
        if usdt_balance != 100:
            print_test("USDT welcome bonus", False, f"Expected 100, got {usdt_balance}")
            return False
        else:
            print_test("USDT welcome bonus", True, "Balance is 100 ✅")
        
        # Check other wallets are 0
        other_wallets = [w for w in wallets if w.get('currency') not in ['USD', 'USDT']]
        non_zero_wallets = [w for w in other_wallets if w.get('balance', 0) != 0]
        
        if non_zero_wallets:
            print_test("Other wallets zero", False, f"Found {len(non_zero_wallets)} non-zero wallets")
            return False
        else:
            print_test("Other wallets zero", True, f"All {len(other_wallets)} other wallets have 0 balance")
        
        # Check total wallet count
        if len(wallets) != 80:
            print_test("Total wallet count", False, f"Expected 80, got {len(wallets)}")
            return False
        else:
            print_test("Total wallet count", True, "80 wallets (50 fiat + 30 crypto) ✅")
        
        print("\n" + "="*80)
        print("TEST 1 RESULT: ✅ PASS - Welcome bonus working correctly!")
        print("  - USD wallet: 1000 ✅")
        print("  - USDT wallet: 100 ✅")
        print("  - Other wallets: 0 ✅")
        print("  - Total wallets: 80 ✅")
        print("="*80)
        return True
        
    except Exception as e:
        print_test("Get wallets", False, f"Exception: {e}")
        return False

def test_admin_chain_delete():
    """
    Test 2: Admin chain delete flow
    1. Admin login → token
    2. Seed 5 fresh blocks: POST /api/admin/chain/seed {"count":5}
    3. GET /api/chain?limit=1 → get the freshest block's hash
    4. DELETE /api/admin/chain/{hash} → 200 {"ok":true}
    5. Immediately GET /api/chain/tx/{hash} → must be 404 (block truly deleted from DB)
    6. GET /api/chain?limit=10 → the deleted hash must NOT appear in the returned blocks
    """
    print("\n" + "="*80)
    print("TEST 2: ADMIN CHAIN DELETE FLOW")
    print("="*80)
    
    # Step 1: Admin login
    print("\nStep 1: Admin login")
    admin_token = admin_login()
    if not admin_token:
        print_test("Admin login", False, "Failed to get admin token")
        return False
    print_test("Admin login", True, "Got admin token")
    
    # Step 2: Seed 5 blocks
    print("\nStep 2: POST /api/admin/chain/seed with count=5")
    try:
        response = requests.post(f"{BASE_URL}/admin/chain/seed", 
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"count": 5}
        )
        
        if response.status_code != 200:
            print_test("Seed blocks", False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        seeded = data.get('seeded', 0)
        
        if seeded != 5:
            print_test("Seed blocks", False, f"Expected seeded=5, got {seeded}")
            return False
        
        print_test("Seed blocks", True, f"Seeded {seeded} blocks")
        
    except Exception as e:
        print_test("Seed blocks", False, f"Exception: {e}")
        return False
    
    # Step 3: Get the freshest block's hash
    print("\nStep 3: GET /api/chain?limit=1 to get freshest block")
    try:
        response = requests.get(f"{BASE_URL}/chain?limit=1")
        
        if response.status_code != 200:
            print_test("Get chain", False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        blocks = data.get('blocks', [])
        
        if not blocks:
            print_test("Get chain", False, "No blocks returned")
            return False
        
        target_block = blocks[0]
        target_hash = target_block.get('hash')
        target_block_number = target_block.get('block_number')
        
        if not target_hash:
            print_test("Get chain", False, "No hash in block")
            return False
        
        print_test("Get chain", True, f"Got block #{target_block_number}, hash={target_hash[:16]}...")
        
    except Exception as e:
        print_test("Get chain", False, f"Exception: {e}")
        return False
    
    # Step 4: Delete the block
    print(f"\nStep 4: DELETE /api/admin/chain/{target_hash}")
    try:
        response = requests.delete(f"{BASE_URL}/admin/chain/{target_hash}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            print_test("Delete block", False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print_test("Delete block", False, f"Response ok=false: {data}")
            return False
        
        print_test("Delete block", True, "Block deleted successfully")
        
    except Exception as e:
        print_test("Delete block", False, f"Exception: {e}")
        return False
    
    # Step 5: Verify block is truly deleted (GET should return 404)
    print(f"\nStep 5: GET /api/chain/tx/{target_hash} (should be 404)")
    try:
        response = requests.get(f"{BASE_URL}/chain/tx/{target_hash}")
        
        if response.status_code == 404:
            print_test("Block truly deleted", True, "GET /chain/tx/{hash} returns 404 ✅")
        elif response.status_code == 200:
            print_test("Block truly deleted", False, f"Block still accessible! Status 200, response: {response.text[:200]}")
            return False
        else:
            print_test("Block truly deleted", False, f"Unexpected status {response.status_code}: {response.text}")
            return False
        
    except Exception as e:
        print_test("Block truly deleted", False, f"Exception: {e}")
        return False
    
    # Step 6: Verify deleted hash does NOT appear in chain list
    print(f"\nStep 6: GET /api/chain?limit=10 (deleted hash should NOT appear)")
    try:
        response = requests.get(f"{BASE_URL}/chain?limit=10")
        
        if response.status_code != 200:
            print_test("Chain list check", False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        blocks = data.get('blocks', [])
        
        # Check if deleted hash appears in the list
        found_deleted = any(b.get('hash') == target_hash for b in blocks)
        
        if found_deleted:
            print_test("Chain list check", False, f"Deleted hash {target_hash[:16]}... still appears in chain list!")
            return False
        else:
            print_test("Chain list check", True, f"Deleted hash does NOT appear in chain list (checked {len(blocks)} blocks) ✅")
        
    except Exception as e:
        print_test("Chain list check", False, f"Exception: {e}")
        return False
    
    print("\n" + "="*80)
    print("TEST 2 RESULT: ✅ PASS - Admin chain delete working correctly!")
    print("  - Block deleted successfully ✅")
    print("  - GET /chain/tx/{hash} returns 404 ✅")
    print("  - Deleted hash not in chain list ✅")
    print("="*80)
    return True

def main():
    """Run focused re-verification tests"""
    print("\n" + "="*80)
    print("FOCUSED RE-VERIFICATION TEST")
    print("Testing two previously-failed scenarios")
    print("Admin creds: admin@aurelawallet.com / Aurela@123#")
    print("="*80)
    
    results = {
        "test1_welcome_bonus": False,
        "test2_chain_delete": False
    }
    
    # Test 1: Welcome bonus
    try:
        results["test1_welcome_bonus"] = test_welcome_bonus()
    except Exception as e:
        print(f"\n❌ TEST 1 EXCEPTION: {e}")
        results["test1_welcome_bonus"] = False
    
    # Test 2: Admin chain delete
    try:
        results["test2_chain_delete"] = test_admin_chain_delete()
    except Exception as e:
        print(f"\n❌ TEST 2 EXCEPTION: {e}")
        results["test2_chain_delete"] = False
    
    # Final summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    
    test1_status = "✅ PASS" if results["test1_welcome_bonus"] else "❌ FAIL"
    test2_status = "✅ PASS" if results["test2_chain_delete"] else "❌ FAIL"
    
    print(f"Test 1 - Welcome bonus on new signup: {test1_status}")
    print(f"Test 2 - Admin chain delete flow: {test2_status}")
    
    total_passed = sum(results.values())
    total_tests = len(results)
    
    print(f"\nTotal: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️ {total_tests - total_passed} test(s) failed")
    
    print("="*80)

if __name__ == "__main__":
    main()
