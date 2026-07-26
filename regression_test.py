#!/usr/bin/env python3
"""
Quick regression test for 6 specific endpoints after docker-compose.yml change
"""
import requests
import json
import sys

BASE_URL = "https://aurela-preview.preview.emergentagent.com"

def test_health():
    """Test 1: GET /api/health → 200 {ok:true}"""
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        print(f"✓ Test 1 - GET /api/health: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Response: {data}")
            if data.get('ok') == True:
                print("  ✅ PASS: Returns {ok:true}")
                return True
            else:
                print("  ❌ FAIL: Does not return {ok:true}")
                return False
        else:
            print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception - {e}")
        return False

def test_config():
    """Test 2: GET /api/config → 200 with keys fiat, crypto, activation_wallet"""
    try:
        response = requests.get(f"{BASE_URL}/api/config", timeout=10)
        print(f"\n✓ Test 2 - GET /api/config: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Keys present: {list(data.keys())}")
            has_fiat = 'fiat' in data
            has_crypto = 'crypto' in data
            has_activation_wallet = 'activation_wallet' in data
            if has_fiat and has_crypto and has_activation_wallet:
                print(f"  ✅ PASS: Has fiat, crypto, activation_wallet keys")
                return True
            else:
                print(f"  ❌ FAIL: Missing keys - fiat:{has_fiat}, crypto:{has_crypto}, activation_wallet:{has_activation_wallet}")
                return False
        else:
            print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception - {e}")
        return False

def test_rates():
    """Test 3: GET /api/rates → 200 with fx and crypto_usd maps populated"""
    try:
        response = requests.get(f"{BASE_URL}/api/rates", timeout=10)
        print(f"\n✓ Test 3 - GET /api/rates: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            has_fx = 'fx' in data and isinstance(data['fx'], dict) and len(data['fx']) > 0
            has_crypto = 'crypto_usd' in data and isinstance(data['crypto_usd'], dict) and len(data['crypto_usd']) > 0
            print(f"  fx keys count: {len(data.get('fx', {}))}")
            print(f"  crypto_usd keys count: {len(data.get('crypto_usd', {}))}")
            if has_fx and has_crypto:
                print(f"  ✅ PASS: Has populated fx and crypto_usd maps")
                return True
            else:
                print(f"  ❌ FAIL: fx populated:{has_fx}, crypto_usd populated:{has_crypto}")
                return False
        else:
            print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception - {e}")
        return False

def test_login():
    """Test 4: POST /api/auth/login → 200 with token and user (user.role=super_admin)"""
    try:
        payload = {
            "identifier": "admin@aurelawallet.com",
            "password": "Aurela@123#"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=10)
        print(f"\n✓ Test 4 - POST /api/auth/login: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            has_token = 'token' in data
            has_user = 'user' in data
            role = data.get('user', {}).get('role')
            print(f"  Has token: {has_token}")
            print(f"  Has user: {has_user}")
            print(f"  User role: {role}")
            if has_token and has_user and role == 'super_admin':
                print(f"  ✅ PASS: Returns token and user with role=super_admin")
                return True, data['token']
            else:
                print(f"  ❌ FAIL: token:{has_token}, user:{has_user}, role:{role}")
                return False, None
        else:
            print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"  Response: {response.text}")
            return False, None
    except Exception as e:
        print(f"  ❌ FAIL: Exception - {e}")
        return False, None

def test_auth_me(token):
    """Test 5: GET /api/auth/me → 200"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=10)
        print(f"\n✓ Test 5 - GET /api/auth/me: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  User: {data.get('email', 'N/A')}")
            print(f"  ✅ PASS: Returns 200")
            return True
        else:
            print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception - {e}")
        return False

def test_platform_wallets(token):
    """Test 6: GET /api/admin/platform-wallets → 200 with TRC20 USDT address"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/platform-wallets", headers=headers, timeout=10)
        print(f"\n✓ Test 6 - GET /api/admin/platform-wallets: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            wallets = data.get('platform_wallets', [])
            print(f"  Platform wallets count: {len(wallets)}")
            
            # Look for TRC20 USDT address
            target_address = "TLgjfeg8Mqw5ueo1CGC8eTb4EHysPMMA6S"
            found = False
            for wallet in wallets:
                if wallet.get('address') == target_address:
                    found = True
                    print(f"  Found TRC20 USDT wallet: {wallet.get('asset')} {wallet.get('network')} - {wallet.get('address')}")
                    break
            
            if found:
                print(f"  ✅ PASS: Returns 200 with TRC20 USDT address {target_address}")
                return True
            else:
                print(f"  ❌ FAIL: TRC20 USDT address {target_address} not found in platform_wallets")
                print(f"  Available platform_wallets: {json.dumps(wallets, indent=2)}")
                return False
        else:
            print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception - {e}")
        return False

def main():
    print("=" * 80)
    print("REGRESSION TEST - 6 Endpoints Check")
    print("=" * 80)
    
    results = []
    
    # Test 1-3: Public endpoints
    results.append(("GET /api/health", test_health()))
    results.append(("GET /api/config", test_config()))
    results.append(("GET /api/rates", test_rates()))
    
    # Test 4: Login
    login_result, token = test_login()
    results.append(("POST /api/auth/login", login_result))
    
    if token:
        # Test 5-6: Authenticated endpoints
        results.append(("GET /api/auth/me", test_auth_me(token)))
        results.append(("GET /api/admin/platform-wallets", test_platform_wallets(token)))
    else:
        print("\n⚠️  Skipping tests 5-6 due to login failure")
        results.append(("GET /api/auth/me", False))
        results.append(("GET /api/admin/platform-wallets", False))
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    print(f"\nTotal: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("\n🎉 All regression tests passed!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total_count - passed_count} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
