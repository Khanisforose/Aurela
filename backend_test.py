#!/usr/bin/env python3
"""
Aurela Backend API Test Suite
Tests new/changed endpoints from current session
"""

import requests
import json
import random
import string
import time

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

def random_email():
    """Generate random email for testing"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"testuser{rand}@aurela.test"

def random_phone():
    """Generate random phone number"""
    return ''.join(random.choices(string.digits, k=10))

def print_test(section, test_name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{section} - {test_name}: {status}")
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

def test_section_a():
    """Test A — New signup flow (first_name + last_name + country + mobile mandatory)"""
    print("\n" + "="*80)
    print("TEST SECTION A: New Signup Flow")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Test A1: Valid signup with all required fields
    try:
        email = random_email()
        phone = random_phone()
        response = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": email,
            "password": "secret123",
            "first_name": "Alex",
            "last_name": "Doe",
            "country": "US",
            "phone": phone
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('signup_id'):
                print_test("A1", "Valid signup with all fields", True, f"signup_id: {data.get('signup_id')[:20]}...")
                results["passed"] += 1
                # Store for later tests
                global test_signup_id, test_signup_code, test_email
                test_signup_id = data.get('signup_id')
                test_signup_code = data.get('dev_otp', data.get('code'))
                test_email = email
            else:
                print_test("A1", "Valid signup with all fields", False, f"Missing ok or signup_id: {data}")
                results["failed"] += 1
        else:
            print_test("A1", "Valid signup with all fields", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("A1", "Valid signup with all fields", False, str(e))
        results["failed"] += 1
    
    # Test A2: Missing first_name
    try:
        response = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": random_email(),
            "password": "secret123",
            "last_name": "Doe",
            "country": "US",
            "phone": random_phone()
        })
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data and 'required' in data['error'].lower():
                print_test("A2", "Missing first_name returns 400", True, data.get('error'))
                results["passed"] += 1
            else:
                print_test("A2", "Missing first_name returns 400", False, f"Wrong error message: {data}")
                results["failed"] += 1
        else:
            print_test("A2", "Missing first_name returns 400", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("A2", "Missing first_name returns 400", False, str(e))
        results["failed"] += 1
    
    # Test A3: Missing phone
    try:
        response = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": random_email(),
            "password": "secret123",
            "first_name": "Alex",
            "last_name": "Doe",
            "country": "US"
        })
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data and 'required' in data['error'].lower():
                print_test("A3", "Missing phone returns 400", True, data.get('error'))
                results["passed"] += 1
            else:
                print_test("A3", "Missing phone returns 400", False, f"Wrong error message: {data}")
                results["failed"] += 1
        else:
            print_test("A3", "Missing phone returns 400", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("A3", "Missing phone returns 400", False, str(e))
        results["failed"] += 1
    
    # Test A4: Missing country
    try:
        response = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": random_email(),
            "password": "secret123",
            "first_name": "Alex",
            "last_name": "Doe",
            "phone": random_phone()
        })
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data and 'required' in data['error'].lower():
                print_test("A4", "Missing country returns 400", True, data.get('error'))
                results["passed"] += 1
            else:
                print_test("A4", "Missing country returns 400", False, f"Wrong error message: {data}")
                results["failed"] += 1
        else:
            print_test("A4", "Missing country returns 400", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("A4", "Missing country returns 400", False, str(e))
        results["failed"] += 1
    
    # Test A5: Password < 8 chars
    try:
        response = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": random_email(),
            "password": "short",
            "first_name": "Alex",
            "last_name": "Doe",
            "country": "US",
            "phone": random_phone()
        })
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data and '8' in data['error']:
                print_test("A5", "Password < 8 chars returns 400", True, data.get('error'))
                results["passed"] += 1
            else:
                print_test("A5", "Password < 8 chars returns 400", False, f"Wrong error message: {data}")
                results["failed"] += 1
        else:
            print_test("A5", "Password < 8 chars returns 400", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("A5", "Password < 8 chars returns 400", False, str(e))
        results["failed"] += 1
    
    # Test A6: Duplicate email
    try:
        # Use admin email which already exists
        response = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": ADMIN_EMAIL,
            "password": "secret123",
            "first_name": "Alex",
            "last_name": "Doe",
            "country": "US",
            "phone": random_phone()
        })
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data and 'already' in data['error'].lower():
                print_test("A6", "Duplicate email returns 400", True, data.get('error'))
                results["passed"] += 1
            else:
                print_test("A6", "Duplicate email returns 400", False, f"Wrong error message: {data}")
                results["failed"] += 1
        else:
            print_test("A6", "Duplicate email returns 400", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("A6", "Duplicate email returns 400", False, str(e))
        results["failed"] += 1
    
    print(f"\nSection A Results: {results['passed']}/6 passed, {results['failed']}/6 failed")
    return results

def test_section_b():
    """Test B — Register verify creates user with Aurela ID (user_code)"""
    print("\n" + "="*80)
    print("TEST SECTION B: Register Verify with Aurela ID")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Test B1: Verify signup and check user_code
    try:
        if not test_signup_id or not test_signup_code:
            print_test("B1", "Verify signup with user_code", False, "No signup_id from Test A")
            results["failed"] += 1
            return results
        
        response = requests.post(f"{BASE_URL}/auth/register/verify", json={
            "signup_id": test_signup_id,
            "code": test_signup_code
        })
        
        if response.status_code == 200:
            data = response.json()
            user = data.get('user', {})
            token = data.get('token')
            
            # Check user_code pattern AUR\d{9}
            user_code = user.get('user_code')
            import re
            if user_code and re.match(r'^AUR\d{9}$', user_code):
                print_test("B1", "User has valid user_code (AUR + 9 digits)", True, f"user_code: {user_code}")
                results["passed"] += 1
            else:
                print_test("B1", "User has valid user_code (AUR + 9 digits)", False, f"Invalid user_code: {user_code}")
                results["failed"] += 1
            
            # Check other fields
            if user.get('first_name') == 'Alex' and user.get('last_name') == 'Doe':
                print_test("B2", "User has first_name and last_name", True)
                results["passed"] += 1
            else:
                print_test("B2", "User has first_name and last_name", False, f"first_name: {user.get('first_name')}, last_name: {user.get('last_name')}")
                results["failed"] += 1
            
            if user.get('country') == 'US' and user.get('phone'):
                print_test("B3", "User has country and phone", True)
                results["passed"] += 1
            else:
                print_test("B3", "User has country and phone", False, f"country: {user.get('country')}, phone: {user.get('phone')}")
                results["failed"] += 1
            
            if user.get('email_verified') == True:
                print_test("B4", "User email_verified is true", True)
                results["passed"] += 1
            else:
                print_test("B4", "User email_verified is true", False, f"email_verified: {user.get('email_verified')}")
                results["failed"] += 1
            
            if user.get('role') == 'user' and user.get('status') == 'active':
                print_test("B5", "User has role=user and status=active", True)
                results["passed"] += 1
            else:
                print_test("B5", "User has role=user and status=active", False, f"role: {user.get('role')}, status: {user.get('status')}")
                results["failed"] += 1
            
            # Test B6: Check wallets
            if token:
                headers = {"Authorization": f"Bearer {token}"}
                wallets_response = requests.get(f"{BASE_URL}/wallets", headers=headers)
                if wallets_response.status_code == 200:
                    wallets_data = wallets_response.json()
                    wallets = wallets_data.get('wallets', [])
                    
                    # Should have 80 wallets (50 fiat + 30 crypto)
                    if len(wallets) == 80:
                        print_test("B6", "User has 80 wallets (50 fiat + 30 crypto)", True, f"Total wallets: {len(wallets)}")
                        results["passed"] += 1
                        
                        # Check USD wallet has 1000 welcome bonus
                        usd_wallet = next((w for w in wallets if w.get('currency') == 'USD'), None)
                        if usd_wallet and usd_wallet.get('balance') == 1000:
                            print_test("B7", "USD wallet has 1000 welcome bonus", True)
                            results["passed"] += 1
                        else:
                            print_test("B7", "USD wallet has 1000 welcome bonus", False, f"USD balance: {usd_wallet.get('balance') if usd_wallet else 'No USD wallet'}")
                            results["failed"] += 1
                    else:
                        print_test("B6", "User has 80 wallets (50 fiat + 30 crypto)", False, f"Total wallets: {len(wallets)}")
                        results["failed"] += 1
                        print_test("B7", "USD wallet has 1000 welcome bonus", False, "Skipped due to wallet count mismatch")
                        results["failed"] += 1
                else:
                    print_test("B6", "User has 80 wallets (50 fiat + 30 crypto)", False, f"Wallets API failed: {wallets_response.status_code}")
                    results["failed"] += 1
                    print_test("B7", "USD wallet has 1000 welcome bonus", False, "Skipped due to wallets API failure")
                    results["failed"] += 1
            else:
                print_test("B6", "User has 80 wallets (50 fiat + 30 crypto)", False, "No token returned")
                results["failed"] += 1
                print_test("B7", "USD wallet has 1000 welcome bonus", False, "No token returned")
                results["failed"] += 1
        else:
            print_test("B1-B7", "Register verify", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 7
    except Exception as e:
        print_test("B1-B7", "Register verify", False, str(e))
        results["failed"] += 7
    
    print(f"\nSection B Results: {results['passed']}/7 passed, {results['failed']}/7 failed")
    return results

def test_section_c():
    """Test C — Forgot password flow"""
    print("\n" + "="*80)
    print("TEST SECTION C: Forgot Password Flow")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Test C1: Valid forgot password init
    try:
        response = requests.post(f"{BASE_URL}/auth/forgot/init", json={
            "email": ADMIN_EMAIL
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                dev_otp = data.get('dev_otp')
                print_test("C1", "Forgot password init for existing user", True, f"dev_otp: {dev_otp if dev_otp else 'Email sent'}")
                results["passed"] += 1
                global forgot_code
                forgot_code = dev_otp
            else:
                print_test("C1", "Forgot password init for existing user", False, f"Missing ok: {data}")
                results["failed"] += 1
        else:
            print_test("C1", "Forgot password init for existing user", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("C1", "Forgot password init for existing user", False, str(e))
        results["failed"] += 1
    
    # Test C2: Forgot password for nonexistent email (should still return 200)
    try:
        response = requests.post(f"{BASE_URL}/auth/forgot/init", json={
            "email": "nonexistent@nowhere.com"
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and not data.get('dev_otp'):
                print_test("C2", "Forgot password for nonexistent email returns 200 (no dev_otp)", True, "Email enumeration prevention working")
                results["passed"] += 1
            else:
                print_test("C2", "Forgot password for nonexistent email returns 200 (no dev_otp)", False, f"Unexpected response: {data}")
                results["failed"] += 1
        else:
            print_test("C2", "Forgot password for nonexistent email returns 200 (no dev_otp)", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("C2", "Forgot password for nonexistent email returns 200 (no dev_otp)", False, str(e))
        results["failed"] += 1
    
    # Test C3: Wrong reset code
    try:
        if not forgot_code:
            print_test("C3", "Wrong reset code returns 400", False, "No forgot_code from C1")
            results["failed"] += 1
        else:
            response = requests.post(f"{BASE_URL}/auth/forgot/verify", json={
                "email": ADMIN_EMAIL,
                "code": "WRONG",
                "new_password": "aurela999"
            })
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'invalid' in data['error'].lower():
                    print_test("C3", "Wrong reset code returns 400", True, data.get('error'))
                    results["passed"] += 1
                else:
                    print_test("C3", "Wrong reset code returns 400", False, f"Wrong error message: {data}")
                    results["failed"] += 1
            else:
                print_test("C3", "Wrong reset code returns 400", False, f"Status {response.status_code}: {response.text}")
                results["failed"] += 1
    except Exception as e:
        print_test("C3", "Wrong reset code returns 400", False, str(e))
        results["failed"] += 1
    
    # Test C4: Short password
    try:
        if not forgot_code:
            print_test("C4", "Short password returns 400", False, "No forgot_code from C1")
            results["failed"] += 1
        else:
            response = requests.post(f"{BASE_URL}/auth/forgot/verify", json={
                "email": ADMIN_EMAIL,
                "code": forgot_code,
                "new_password": "short"
            })
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and '8' in data['error']:
                    print_test("C4", "Short password returns 400", True, data.get('error'))
                    results["passed"] += 1
                else:
                    print_test("C4", "Short password returns 400", False, f"Wrong error message: {data}")
                    results["failed"] += 1
            else:
                print_test("C4", "Short password returns 400", False, f"Status {response.status_code}: {response.text}")
                results["failed"] += 1
    except Exception as e:
        print_test("C4", "Short password returns 400", False, str(e))
        results["failed"] += 1
    
    # Test C5: Valid password reset
    try:
        if not forgot_code:
            print_test("C5", "Valid password reset", False, "No forgot_code from C1")
            results["failed"] += 1
        else:
            response = requests.post(f"{BASE_URL}/auth/forgot/verify", json={
                "email": ADMIN_EMAIL,
                "code": forgot_code,
                "new_password": "aurela999"
            })
            
            if response.status_code == 200:
                data = response.json()
                if data.get('ok'):
                    print_test("C5", "Valid password reset", True)
                    results["passed"] += 1
                else:
                    print_test("C5", "Valid password reset", False, f"Missing ok: {data}")
                    results["failed"] += 1
            else:
                print_test("C5", "Valid password reset", False, f"Status {response.status_code}: {response.text}")
                results["failed"] += 1
    except Exception as e:
        print_test("C5", "Valid password reset", False, str(e))
        results["failed"] += 1
    
    # Test C6: Login with old password should fail
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 401:
            print_test("C6", "Login with old password fails (401)", True)
            results["passed"] += 1
        else:
            print_test("C6", "Login with old password fails (401)", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("C6", "Login with old password fails (401)", False, str(e))
        results["failed"] += 1
    
    # Test C7: Login with new password should work
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": "aurela999"
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get('token'):
                print_test("C7", "Login with new password succeeds", True)
                results["passed"] += 1
            else:
                print_test("C7", "Login with new password succeeds", False, f"No token: {data}")
                results["failed"] += 1
        else:
            print_test("C7", "Login with new password succeeds", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("C7", "Login with new password succeeds", False, str(e))
        results["failed"] += 1
    
    # Test C8: RESTORE - Reset password back to original
    try:
        # Get new forgot code
        response = requests.post(f"{BASE_URL}/auth/forgot/init", json={
            "email": ADMIN_EMAIL
        })
        
        if response.status_code == 200:
            data = response.json()
            restore_code = data.get('dev_otp')
            
            if restore_code:
                # Reset to original password
                response = requests.post(f"{BASE_URL}/auth/forgot/verify", json={
                    "email": ADMIN_EMAIL,
                    "code": restore_code,
                    "new_password": ADMIN_PASSWORD
                })
                
                if response.status_code == 200:
                    print_test("C8", "RESTORE admin password to original", True)
                    results["passed"] += 1
                else:
                    print_test("C8", "RESTORE admin password to original", False, f"Status {response.status_code}: {response.text}")
                    results["failed"] += 1
            else:
                print_test("C8", "RESTORE admin password to original", False, "No dev_otp for restore")
                results["failed"] += 1
        else:
            print_test("C8", "RESTORE admin password to original", False, f"Forgot init failed: {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_test("C8", "RESTORE admin password to original", False, str(e))
        results["failed"] += 1
    
    print(f"\nSection C Results: {results['passed']}/8 passed, {results['failed']}/8 failed")
    return results

def test_section_d():
    """Test D — Change password (authenticated)"""
    print("\n" + "="*80)
    print("TEST SECTION D: Change Password (Authenticated)")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Get admin token
    token = admin_login()
    if not token:
        print_test("D1-D7", "Change password tests", False, "Admin login failed")
        results["failed"] += 7
        return results
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test D1: Wrong current password
    try:
        response = requests.post(f"{BASE_URL}/profile/password", 
            headers=headers,
            json={
                "current_password": "wrong",
                "new_password": "newpass123"
            })
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data and 'incorrect' in data['error'].lower():
                print_test("D1", "Wrong current password returns 400", True, data.get('error'))
                results["passed"] += 1
            else:
                print_test("D1", "Wrong current password returns 400", False, f"Wrong error message: {data}")
                results["failed"] += 1
        else:
            print_test("D1", "Wrong current password returns 400", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("D1", "Wrong current password returns 400", False, str(e))
        results["failed"] += 1
    
    # Test D2: Short new password
    try:
        response = requests.post(f"{BASE_URL}/profile/password", 
            headers=headers,
            json={
                "current_password": ADMIN_PASSWORD,
                "new_password": "short"
            })
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data and '8' in data['error']:
                print_test("D2", "Short new password returns 400", True, data.get('error'))
                results["passed"] += 1
            else:
                print_test("D2", "Short new password returns 400", False, f"Wrong error message: {data}")
                results["failed"] += 1
        else:
            print_test("D2", "Short new password returns 400", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("D2", "Short new password returns 400", False, str(e))
        results["failed"] += 1
    
    # Test D3: Valid password change
    try:
        response = requests.post(f"{BASE_URL}/profile/password", 
            headers=headers,
            json={
                "current_password": ADMIN_PASSWORD,
                "new_password": "tempAurela1"
            })
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print_test("D3", "Valid password change", True)
                results["passed"] += 1
            else:
                print_test("D3", "Valid password change", False, f"Missing ok: {data}")
                results["failed"] += 1
        else:
            print_test("D3", "Valid password change", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("D3", "Valid password change", False, str(e))
        results["failed"] += 1
    
    # Test D4: Login with old password should fail
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 401:
            print_test("D4", "Login with old password fails (401)", True)
            results["passed"] += 1
        else:
            print_test("D4", "Login with old password fails (401)", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("D4", "Login with old password fails (401)", False, str(e))
        results["failed"] += 1
    
    # Test D5: Login with new password should work
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": "tempAurela1"
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get('token'):
                print_test("D5", "Login with new password succeeds", True)
                results["passed"] += 1
                new_token = data.get('token')
            else:
                print_test("D5", "Login with new password succeeds", False, f"No token: {data}")
                results["failed"] += 1
                new_token = None
        else:
            print_test("D5", "Login with new password succeeds", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
            new_token = None
    except Exception as e:
        print_test("D5", "Login with new password succeeds", False, str(e))
        results["failed"] += 1
        new_token = None
    
    # Test D6: RESTORE - Change password back to original
    try:
        if new_token:
            headers = {"Authorization": f"Bearer {new_token}"}
            response = requests.post(f"{BASE_URL}/profile/password", 
                headers=headers,
                json={
                    "current_password": "tempAurela1",
                    "new_password": ADMIN_PASSWORD
                })
            
            if response.status_code == 200:
                print_test("D6", "RESTORE admin password to original", True)
                results["passed"] += 1
            else:
                print_test("D6", "RESTORE admin password to original", False, f"Status {response.status_code}: {response.text}")
                results["failed"] += 1
        else:
            print_test("D6", "RESTORE admin password to original", False, "No new token from D5")
            results["failed"] += 1
    except Exception as e:
        print_test("D6", "RESTORE admin password to original", False, str(e))
        results["failed"] += 1
    
    # Test D7: Verify restore worked
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            print_test("D7", "Verify restored password works", True)
            results["passed"] += 1
        else:
            print_test("D7", "Verify restored password works", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("D7", "Verify restored password works", False, str(e))
        results["failed"] += 1
    
    print(f"\nSection D Results: {results['passed']}/7 passed, {results['failed']}/7 failed")
    return results

def test_section_e():
    """Test E — Admin chain delete + seed"""
    print("\n" + "="*80)
    print("TEST SECTION E: Admin Chain Delete + Seed")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Get admin token
    token = admin_login()
    if not token:
        print_test("E1-E7", "Chain tests", False, "Admin login failed")
        results["failed"] += 7
        return results
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test E1: Seed 50 blocks
    try:
        response = requests.post(f"{BASE_URL}/admin/chain/seed", 
            headers=headers,
            json={"count": 50})
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('seeded') == 50:
                print_test("E1", "Seed 50 blocks", True, f"first_block: {data.get('first_block')}, last_block: {data.get('last_block')}")
                results["passed"] += 1
                global seeded_block_hash
                # Get one of the seeded blocks
                chain_response = requests.get(f"{BASE_URL}/chain?limit=1")
                if chain_response.status_code == 200:
                    chain_data = chain_response.json()
                    blocks = chain_data.get('blocks', [])
                    if blocks:
                        seeded_block_hash = blocks[0].get('hash')
                    else:
                        seeded_block_hash = None
                else:
                    seeded_block_hash = None
            else:
                print_test("E1", "Seed 50 blocks", False, f"Wrong response: {data}")
                results["failed"] += 1
        else:
            print_test("E1", "Seed 50 blocks", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("E1", "Seed 50 blocks", False, str(e))
        results["failed"] += 1
    
    # Test E2: Get recent block hash
    try:
        response = requests.get(f"{BASE_URL}/chain?limit=1")
        
        if response.status_code == 200:
            data = response.json()
            blocks = data.get('blocks', [])
            if blocks:
                block_hash = blocks[0].get('hash')
                print_test("E2", "Get recent block hash", True, f"hash: {block_hash[:20]}...")
                results["passed"] += 1
                global test_block_hash
                test_block_hash = block_hash
            else:
                print_test("E2", "Get recent block hash", False, "No blocks returned")
                results["failed"] += 1
        else:
            print_test("E2", "Get recent block hash", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("E2", "Get recent block hash", False, str(e))
        results["failed"] += 1
    
    # Test E3: Delete block
    try:
        if not test_block_hash:
            print_test("E3", "Delete block", False, "No block hash from E2")
            results["failed"] += 1
        else:
            response = requests.delete(f"{BASE_URL}/admin/chain/{test_block_hash}", 
                headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('ok'):
                    print_test("E3", "Delete block", True)
                    results["passed"] += 1
                else:
                    print_test("E3", "Delete block", False, f"Missing ok: {data}")
                    results["failed"] += 1
            else:
                print_test("E3", "Delete block", False, f"Status {response.status_code}: {response.text}")
                results["failed"] += 1
    except Exception as e:
        print_test("E3", "Delete block", False, str(e))
        results["failed"] += 1
    
    # Test E4: Verify block is deleted (404)
    try:
        if not test_block_hash:
            print_test("E4", "Verify block deleted (404)", False, "No block hash from E2")
            results["failed"] += 1
        else:
            response = requests.get(f"{BASE_URL}/chain/tx/{test_block_hash}")
            
            if response.status_code == 404:
                print_test("E4", "Verify block deleted (404)", True)
                results["passed"] += 1
            else:
                print_test("E4", "Verify block deleted (404)", False, f"Status {response.status_code}: {response.text}")
                results["failed"] += 1
    except Exception as e:
        print_test("E4", "Verify block deleted (404)", False, str(e))
        results["failed"] += 1
    
    # Test E5: Non-admin cannot delete
    try:
        # Create a regular user token (use the one from test B if available)
        if 'test_email' in globals() and test_email:
            # Login as the test user
            login_response = requests.post(f"{BASE_URL}/auth/login", json={
                "identifier": test_email,
                "password": "secret123"
            })
            
            if login_response.status_code == 200:
                user_token = login_response.json().get('token')
                user_headers = {"Authorization": f"Bearer {user_token}"}
                
                # Get a block to try to delete
                chain_response = requests.get(f"{BASE_URL}/chain?limit=1")
                if chain_response.status_code == 200:
                    blocks = chain_response.json().get('blocks', [])
                    if blocks:
                        block_hash = blocks[0].get('hash')
                        
                        # Try to delete as non-admin
                        response = requests.delete(f"{BASE_URL}/admin/chain/{block_hash}", 
                            headers=user_headers)
                        
                        if response.status_code == 403:
                            print_test("E5", "Non-admin cannot delete (403)", True)
                            results["passed"] += 1
                        else:
                            print_test("E5", "Non-admin cannot delete (403)", False, f"Status {response.status_code}: {response.text}")
                            results["failed"] += 1
                    else:
                        print_test("E5", "Non-admin cannot delete (403)", False, "No blocks to test with")
                        results["failed"] += 1
                else:
                    print_test("E5", "Non-admin cannot delete (403)", False, "Chain API failed")
                    results["failed"] += 1
            else:
                print_test("E5", "Non-admin cannot delete (403)", False, "User login failed")
                results["failed"] += 1
        else:
            print_test("E5", "Non-admin cannot delete (403)", False, "No test user from section B")
            results["failed"] += 1
    except Exception as e:
        print_test("E5", "Non-admin cannot delete (403)", False, str(e))
        results["failed"] += 1
    
    # Test E6: Seed with large count (should clamp to 5000)
    try:
        response = requests.post(f"{BASE_URL}/admin/chain/seed", 
            headers=headers,
            json={"count": 10000})
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('seeded') == 5000:
                print_test("E6", "Seed 10000 clamps to 5000", True, f"seeded: {data.get('seeded')}")
                results["passed"] += 1
            else:
                print_test("E6", "Seed 10000 clamps to 5000", False, f"seeded: {data.get('seeded')}")
                results["failed"] += 1
        else:
            print_test("E6", "Seed 10000 clamps to 5000", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("E6", "Seed 10000 clamps to 5000", False, str(e))
        results["failed"] += 1
    
    print(f"\nSection E Results: {results['passed']}/6 passed, {results['failed']}/6 failed")
    return results

def test_section_f():
    """Test F — Regression"""
    print("\n" + "="*80)
    print("TEST SECTION F: Regression Tests")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Test F1: Health endpoint
    try:
        response = requests.get(f"{BASE_URL}/health")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print_test("F1", "GET /health", True)
                results["passed"] += 1
            else:
                print_test("F1", "GET /health", False, f"Missing ok: {data}")
                results["failed"] += 1
        else:
            print_test("F1", "GET /health", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("F1", "GET /health", False, str(e))
        results["failed"] += 1
    
    # Test F2: Config endpoint
    try:
        response = requests.get(f"{BASE_URL}/config")
        
        if response.status_code == 200:
            data = response.json()
            if 'enabled_fiat' in data and 'enabled_crypto' in data:
                fiat_count = len(data.get('enabled_fiat', []))
                crypto_count = len(data.get('enabled_crypto', []))
                print_test("F2", "GET /config", True, f"enabled_fiat: {fiat_count}, enabled_crypto: {crypto_count}")
                results["passed"] += 1
            else:
                print_test("F2", "GET /config", False, f"Missing keys: {data.keys()}")
                results["failed"] += 1
        else:
            print_test("F2", "GET /config", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("F2", "GET /config", False, str(e))
        results["failed"] += 1
    
    # Test F3: Admin login
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get('token'):
                print_test("F3", "Admin login", True)
                results["passed"] += 1
                admin_token = data.get('token')
            else:
                print_test("F3", "Admin login", False, f"No token: {data}")
                results["failed"] += 1
                admin_token = None
        else:
            print_test("F3", "Admin login", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
            admin_token = None
    except Exception as e:
        print_test("F3", "Admin login", False, str(e))
        results["failed"] += 1
        admin_token = None
    
    # Test F4: Admin users list
    try:
        if admin_token:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = requests.get(f"{BASE_URL}/admin/users", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'users' in data:
                    print_test("F4", "GET /admin/users", True, f"users count: {len(data.get('users', []))}")
                    results["passed"] += 1
                else:
                    print_test("F4", "GET /admin/users", False, f"Missing users: {data.keys()}")
                    results["failed"] += 1
            else:
                print_test("F4", "GET /admin/users", False, f"Status {response.status_code}: {response.text}")
                results["failed"] += 1
        else:
            print_test("F4", "GET /admin/users", False, "No admin token from F3")
            results["failed"] += 1
    except Exception as e:
        print_test("F4", "GET /admin/users", False, str(e))
        results["failed"] += 1
    
    # Test F5: Chain search
    try:
        response = requests.get(f"{BASE_URL}/chain/search?q=admin")
        
        if response.status_code == 200:
            data = response.json()
            if 'blocks' in data and 'users' in data and 'wallets' in data:
                print_test("F5", "GET /chain/search", True)
                results["passed"] += 1
            else:
                print_test("F5", "GET /chain/search", False, f"Missing keys: {data.keys()}")
                results["failed"] += 1
        else:
            print_test("F5", "GET /chain/search", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_test("F5", "GET /chain/search", False, str(e))
        results["failed"] += 1
    
    # Test F6: Wallets endpoint
    try:
        if admin_token:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = requests.get(f"{BASE_URL}/wallets", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'wallets' in data:
                    print_test("F6", "GET /wallets", True, f"wallets count: {len(data.get('wallets', []))}")
                    results["passed"] += 1
                else:
                    print_test("F6", "GET /wallets", False, f"Missing wallets: {data.keys()}")
                    results["failed"] += 1
            else:
                print_test("F6", "GET /wallets", False, f"Status {response.status_code}: {response.text}")
                results["failed"] += 1
        else:
            print_test("F6", "GET /wallets", False, "No admin token from F3")
            results["failed"] += 1
    except Exception as e:
        print_test("F6", "GET /wallets", False, str(e))
        results["failed"] += 1
    
    print(f"\nSection F Results: {results['passed']}/6 passed, {results['failed']}/6 failed")
    return results

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("AURELA BACKEND API TEST SUITE")
    print("Testing new/changed endpoints from current session")
    print("="*80)
    
    # Initialize global variables
    global test_signup_id, test_signup_code, test_email, forgot_code, test_block_hash
    test_signup_id = None
    test_signup_code = None
    test_email = None
    forgot_code = None
    test_block_hash = None
    
    # Run all test sections
    results_a = test_section_a()
    results_b = test_section_b()
    results_c = test_section_c()
    results_d = test_section_d()
    results_e = test_section_e()
    results_f = test_section_f()
    
    # Calculate totals
    total_passed = (results_a["passed"] + results_b["passed"] + results_c["passed"] + 
                   results_d["passed"] + results_e["passed"] + results_f["passed"])
    total_failed = (results_a["failed"] + results_b["failed"] + results_c["failed"] + 
                   results_d["failed"] + results_e["failed"] + results_f["failed"])
    total_tests = total_passed + total_failed
    
    # Print summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print(f"Section A (New Signup Flow): {results_a['passed']}/6 passed")
    print(f"Section B (Register Verify with Aurela ID): {results_b['passed']}/7 passed")
    print(f"Section C (Forgot Password Flow): {results_c['passed']}/8 passed")
    print(f"Section D (Change Password): {results_d['passed']}/7 passed")
    print(f"Section E (Admin Chain Delete + Seed): {results_e['passed']}/6 passed")
    print(f"Section F (Regression): {results_f['passed']}/6 passed")
    print("="*80)
    print(f"TOTAL: {total_passed}/{total_tests} tests passed ({total_failed} failed)")
    print("="*80)
    
    if total_failed == 0:
        print("\n🎉 ALL TESTS PASSED! 🎉")
        return 0
    else:
        print(f"\n⚠️  {total_failed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    exit(main())
