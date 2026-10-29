#!/usr/bin/env python3
"""
Comprehensive test for geolocation features in Aurela v1.4.2
Tests location capture, admin deposit/withdrawal detail endpoints, admin bypass, geo message, and silent allowance
"""

import requests
import json
import time
import sys

# Base URL from environment
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"
GEO_TESTER_EMAIL = "geo.tester@aurelatest.io"
GEO_TESTER_PASSWORD = "Aurela@123#"

def login(email, password):
    """Login and return token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": email,
            "password": password
        }, timeout=30)
        
        if response.status_code == 502:
            print(f"⚠️  502 error on login, waiting 20s for server restart...")
            time.sleep(20)
            response = requests.post(f"{BASE_URL}/auth/login", json={
                "identifier": email,
                "password": password
            }, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            return data.get('token')
        else:
            print(f"❌ Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {e}")
        return None

def test_location_capture_granted():
    """TEST 1: POST /api/location with valid coordinates and device info"""
    print("\n" + "="*80)
    print("TEST 1: Location capture (granted)")
    print("="*80)
    
    try:
        # Login as geo tester
        token = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
        if not token:
            print("❌ TEST 1 FAILED: Could not login")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # POST location with Paris coordinates
        location_data = {
            "lat": 48.8566,
            "lng": 2.3522,
            "accuracy": 30,
            "device": {
                "user_agent": "TestUA",
                "platform": "Android",
                "language": "en",
                "screen": "1080x2400",
                "timezone": "Europe/Paris",
                "standalone": True
            }
        }
        
        response = requests.post(f"{BASE_URL}/location", json=location_data, headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ POST /location failed: {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        print(f"✅ POST /location response: {json.dumps(data, indent=2)}")
        
        # Verify response structure
        if not data.get('ok'):
            print(f"❌ Response ok is not true")
            return False
        
        if data.get('status') != 'granted':
            print(f"❌ Status is not 'granted': {data.get('status')}")
            return False
        
        location = data.get('location', {})
        print(f"📍 Location: city={location.get('city')}, country={location.get('country')}")
        
        # Note: city/country may be null if geocoder is unreachable
        if location.get('city') is None or location.get('country') is None:
            print(f"⚠️  WARNING: city or country is null (external geocoder may be unreachable)")
        
        # Now GET /auth/me to verify last_location
        time.sleep(1)
        me_response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
        
        if me_response.status_code != 200:
            print(f"❌ GET /auth/me failed: {me_response.status_code}")
            return False
        
        me_data = me_response.json()
        user = me_data.get('user', {})
        last_location = user.get('last_location', {})
        
        print(f"✅ GET /auth/me last_location: {json.dumps(last_location, indent=2)}")
        
        # Verify last_location fields
        checks = [
            (last_location.get('status') == 'granted', f"last_location.status is 'granted'"),
            (last_location.get('lat') == 48.8566, f"last_location.lat is 48.8566"),
            (last_location.get('lng') == 2.3522, f"last_location.lng is 2.3522"),
            (last_location.get('accuracy_m') == 30, f"last_location.accuracy_m is 30"),
            (last_location.get('device', {}).get('platform') == 'Android', f"device.platform is 'Android'"),
            (last_location.get('device', {}).get('standalone') == True, f"device.standalone is true"),
            (last_location.get('device', {}).get('timezone') == 'Europe/Paris', f"device.timezone is 'Europe/Paris'"),
            (last_location.get('at') is not None, f"last_location.at is present"),
            (last_location.get('ip') is not None, f"last_location.ip is present"),
        ]
        
        all_passed = True
        for check, desc in checks:
            if check:
                print(f"  ✅ {desc}")
            else:
                print(f"  ❌ {desc}")
                all_passed = False
        
        if all_passed:
            print("✅ TEST 1 PASSED")
            return True
        else:
            print("❌ TEST 1 FAILED: Some checks failed")
            return False
            
    except Exception as e:
        print(f"❌ TEST 1 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_location_unauthenticated():
    """TEST 1b: Unauthenticated POST /location should return 401"""
    print("\n" + "="*80)
    print("TEST 1b: Unauthenticated location capture")
    print("="*80)
    
    try:
        response = requests.post(f"{BASE_URL}/location", json={"lat": 48.8566, "lng": 2.3522}, timeout=30)
        
        if response.status_code == 401:
            print("✅ TEST 1b PASSED: Unauthenticated request returns 401")
            return True
        else:
            print(f"❌ TEST 1b FAILED: Expected 401, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 1b EXCEPTION: {e}")
        return False

def test_location_invalid_coords():
    """TEST 1c: POST /location with invalid coordinates should return 400"""
    print("\n" + "="*80)
    print("TEST 1c: Invalid coordinates")
    print("="*80)
    
    try:
        token = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
        if not token:
            print("❌ TEST 1c FAILED: Could not login")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.post(f"{BASE_URL}/location", json={"lat": 999, "lng": 2.3522}, headers=headers, timeout=30)
        
        if response.status_code == 400:
            print("✅ TEST 1c PASSED: Invalid coordinates return 400")
            return True
        else:
            print(f"❌ TEST 1c FAILED: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 1c EXCEPTION: {e}")
        return False

def test_location_denied():
    """TEST 2: POST /location with denied:true"""
    print("\n" + "="*80)
    print("TEST 2: Location capture (denied)")
    print("="*80)
    
    try:
        token = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
        if not token:
            print("❌ TEST 2 FAILED: Could not login")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # POST location with denied:true
        response = requests.post(f"{BASE_URL}/location", json={
            "denied": True,
            "device": {"platform": "iOS"}
        }, headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ POST /location (denied) failed: {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        print(f"✅ POST /location (denied) response: {json.dumps(data, indent=2)}")
        
        if not data.get('ok') or data.get('status') != 'denied':
            print(f"❌ Response not ok or status not 'denied'")
            return False
        
        # GET /auth/me to verify
        time.sleep(1)
        me_response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
        
        if me_response.status_code != 200:
            print(f"❌ GET /auth/me failed: {me_response.status_code}")
            return False
        
        user = me_response.json().get('user', {})
        last_location = user.get('last_location', {})
        
        if last_location.get('status') != 'denied':
            print(f"❌ last_location.status is not 'denied': {last_location.get('status')}")
            return False
        
        if user.get('location_denied_at') is None:
            print(f"❌ location_denied_at is not present")
            return False
        
        print(f"✅ last_location.status is 'denied' and location_denied_at is present")
        
        # Now POST a valid location again to verify it goes back to granted
        response2 = requests.post(f"{BASE_URL}/location", json={
            "lat": 48.8566,
            "lng": 2.3522,
            "accuracy": 30,
            "device": {"platform": "Android"}
        }, headers=headers, timeout=30)
        
        if response2.status_code != 200:
            print(f"❌ POST /location (granted again) failed: {response2.status_code}")
            return False
        
        time.sleep(1)
        me_response2 = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
        user2 = me_response2.json().get('user', {})
        
        if user2.get('last_location', {}).get('status') != 'granted':
            print(f"❌ last_location.status did not go back to 'granted'")
            return False
        
        if 'location_denied_at' in user2:
            print(f"❌ location_denied_at was not removed")
            return False
        
        print(f"✅ last_location.status back to 'granted' and location_denied_at removed")
        print("✅ TEST 2 PASSED")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_admin_user_locations():
    """TEST 3: Admin GET /api/admin/users/<id> shows locations array"""
    print("\n" + "="*80)
    print("TEST 3: Admin user detail with locations")
    print("="*80)
    
    try:
        # Login as admin
        admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_token:
            print("❌ TEST 3 FAILED: Could not login as admin")
            return False
        
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Login as geo tester to get user ID
        geo_token = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
        if not geo_token:
            print("❌ TEST 3 FAILED: Could not login as geo tester")
            return False
        
        geo_headers = {"Authorization": f"Bearer {geo_token}"}
        
        # Get geo tester user ID
        me_response = requests.get(f"{BASE_URL}/auth/me", headers=geo_headers, timeout=30)
        if me_response.status_code != 200:
            print(f"❌ GET /auth/me failed: {me_response.status_code}")
            return False
        
        geo_user_id = me_response.json().get('user', {}).get('id')
        print(f"📝 Geo tester user ID: {geo_user_id}")
        
        # Admin GET user detail
        response = requests.get(f"{BASE_URL}/admin/users/{geo_user_id}", headers=admin_headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ GET /admin/users/{geo_user_id} failed: {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        
        # Check for locations array
        locations = data.get('locations', [])
        print(f"✅ Admin user detail returned {len(locations)} location entries")
        
        if len(locations) < 3:
            print(f"⚠️  WARNING: Expected >= 3 location entries, got {len(locations)}")
        
        # Verify structure of location entries
        if len(locations) > 0:
            first_loc = locations[0]
            print(f"📍 First location entry: {json.dumps(first_loc, indent=2)}")
            
            checks = [
                ('status' in first_loc, "has 'status' field"),
                ('created_at' in first_loc, "has 'created_at' field"),
                ('device' in first_loc, "has 'device' field"),
            ]
            
            if first_loc.get('status') == 'granted':
                checks.extend([
                    ('lat' in first_loc, "granted entry has 'lat'"),
                    ('lng' in first_loc, "granted entry has 'lng'"),
                ])
            
            all_passed = True
            for check, desc in checks:
                if check:
                    print(f"  ✅ {desc}")
                else:
                    print(f"  ❌ {desc}")
                    all_passed = False
            
            if not all_passed:
                print("❌ TEST 3 FAILED: Location entry structure incomplete")
                return False
        
        # Verify user has last_location
        user = data.get('user', {})
        if 'last_location' not in user:
            print(f"❌ user.last_location is not present")
            return False
        
        print(f"✅ user.last_location is present")
        print("✅ TEST 3 PASSED")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_deposit_with_admin_detail():
    """TEST 4: Deposit request with admin detail endpoint showing user with last_location"""
    print("\n" + "="*80)
    print("TEST 4: Deposit request with admin detail")
    print("="*80)
    
    try:
        # Login as geo tester
        geo_token = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
        if not geo_token:
            print("❌ TEST 4 FAILED: Could not login as geo tester")
            return False
        
        geo_headers = {"Authorization": f"Bearer {geo_token}"}
        
        # POST deposit request
        deposit_data = {
            "method": "crypto",
            "currency": "USDT",
            "amount": 120,
            "tx_hash": "abc123hash",
            "network": "TRC20",
            "details": {"sender_wallet": "TX1"},
            "note": "test"
        }
        
        response = requests.post(f"{BASE_URL}/deposit", json=deposit_data, headers=geo_headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ POST /deposit failed: {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        request_id = data.get('request', {}).get('id')
        print(f"✅ Deposit request created: {request_id}")
        
        # Login as admin
        admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_token:
            print("❌ TEST 4 FAILED: Could not login as admin")
            return False
        
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Admin GET deposits list
        time.sleep(1)
        list_response = requests.get(f"{BASE_URL}/admin/deposits", headers=admin_headers, timeout=30)
        
        if list_response.status_code != 200:
            print(f"❌ GET /admin/deposits failed: {list_response.status_code}")
            return False
        
        deposits = list_response.json().get('deposits', [])
        print(f"✅ Admin deposits list has {len(deposits)} items")
        
        # Check if list items have user object with last_location
        if len(deposits) > 0:
            first_deposit = deposits[0]
            user = first_deposit.get('user', {})
            
            checks = [
                ('user' in first_deposit, "deposit has 'user' object"),
                ('username' in user, "user has 'username'"),
                ('email' in user, "user has 'email'"),
                ('kyc_status' in user, "user has 'kyc_status'"),
            ]
            
            if 'last_location' in user:
                checks.append((True, "user has 'last_location'"))
                print(f"  📍 User last_location: {user.get('last_location', {}).get('status')}")
            else:
                print(f"  ⚠️  User does not have last_location (may not have submitted location yet)")
            
            for check, desc in checks:
                if check:
                    print(f"  ✅ {desc}")
                else:
                    print(f"  ❌ {desc}")
        
        # Admin GET deposit detail
        detail_response = requests.get(f"{BASE_URL}/admin/deposits/{request_id}", headers=admin_headers, timeout=30)
        
        if detail_response.status_code != 200:
            print(f"❌ GET /admin/deposits/{request_id} failed: {detail_response.status_code}")
            return False
        
        detail = detail_response.json()
        print(f"✅ Admin deposit detail retrieved")
        
        # Verify response structure
        required_keys = ['request', 'user', 'kyc', 'wallet', 'history', 'approved_totals', 'locations', 'cards', 'explorer_url']
        all_present = True
        for key in required_keys:
            if key in detail:
                print(f"  ✅ Has '{key}' key")
            else:
                print(f"  ❌ Missing '{key}' key")
                all_present = False
        
        if not all_present:
            print("❌ TEST 4 FAILED: Missing required keys in detail response")
            return False
        
        # Verify request details
        request = detail.get('request', {})
        if request.get('tx_hash') != 'abc123hash':
            print(f"❌ tx_hash mismatch: {request.get('tx_hash')}")
            return False
        
        print(f"  ✅ request.tx_hash is 'abc123hash'")
        
        # Verify explorer_url
        explorer_url = detail.get('explorer_url')
        expected_url = 'https://tronscan.org/#/transaction/abc123hash'
        if explorer_url != expected_url:
            print(f"❌ explorer_url mismatch: {explorer_url} != {expected_url}")
            return False
        
        print(f"  ✅ explorer_url is '{expected_url}'")
        
        # Verify user object
        user = detail.get('user', {})
        if user.get('username') != 'geotester':
            print(f"❌ username mismatch: {user.get('username')}")
            return False
        
        print(f"  ✅ user.username is 'geotester'")
        
        # Verify NO password_hash/salt
        if 'password_hash' in user or 'salt' in user:
            print(f"❌ SECURITY ISSUE: user object contains password_hash or salt")
            return False
        
        print(f"  ✅ user object does NOT contain password_hash/salt")
        
        # Verify wallet
        wallet = detail.get('wallet', {})
        if wallet.get('currency') != 'USDT':
            print(f"❌ wallet currency mismatch: {wallet.get('currency')}")
            return False
        
        print(f"  ✅ wallet.currency is 'USDT' with balance {wallet.get('balance')}")
        
        # Verify locations array
        locations = detail.get('locations', [])
        print(f"  ✅ locations array has {len(locations)} entries")
        
        # Test GET non-existent deposit
        not_found_response = requests.get(f"{BASE_URL}/admin/deposits/does-not-exist", headers=admin_headers, timeout=30)
        if not_found_response.status_code != 404:
            print(f"❌ GET non-existent deposit should return 404, got {not_found_response.status_code}")
            return False
        
        print(f"  ✅ GET non-existent deposit returns 404")
        
        # Approve the deposit (regression test)
        approve_response = requests.post(f"{BASE_URL}/admin/deposits/{request_id}/approve", headers=admin_headers, timeout=30)
        
        if approve_response.status_code != 200:
            print(f"❌ POST /admin/deposits/{request_id}/approve failed: {approve_response.status_code}")
            return False
        
        print(f"  ✅ Deposit approved successfully")
        
        # Verify USDT balance increased
        time.sleep(1)
        wallets_response = requests.get(f"{BASE_URL}/wallets", headers=geo_headers, timeout=30)
        if wallets_response.status_code == 200:
            wallets = wallets_response.json().get('wallets', [])
            usdt_wallet = next((w for w in wallets if w.get('currency') == 'USDT'), None)
            if usdt_wallet:
                print(f"  ✅ USDT balance after approval: {usdt_wallet.get('balance')}")
        
        print("✅ TEST 4 PASSED")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_withdraw_without_card():
    """TEST 5: Withdraw as regular user without card should return 403 CARD_REQUIRED"""
    print("\n" + "="*80)
    print("TEST 5: Withdraw without card (regular user)")
    print("="*80)
    
    try:
        # Login as geo tester
        geo_token = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
        if not geo_token:
            print("❌ TEST 5 FAILED: Could not login as geo tester")
            return False
        
        geo_headers = {"Authorization": f"Bearer {geo_token}"}
        
        # Check if user has any active cards
        cards_response = requests.get(f"{BASE_URL}/cards", headers=geo_headers, timeout=30)
        if cards_response.status_code == 200:
            cards = cards_response.json().get('cards', [])
            active_cards = [c for c in cards if c.get('status') == 'active']
            if len(active_cards) > 0:
                print(f"⚠️  User has {len(active_cards)} active cards, need to delete them first")
                # Delete all active cards
                for card in active_cards:
                    delete_response = requests.delete(f"{BASE_URL}/cards/{card['id']}", headers=geo_headers, timeout=30)
                    if delete_response.status_code == 200:
                        print(f"  ✅ Deleted card {card['id']}")
                time.sleep(1)
        
        # Attempt withdrawal
        withdraw_data = {
            "method": "bank_swift",
            "currency": "USD",
            "amount": 50,
            "destination": "GB29",
            "details": {
                "bank_name": "X",
                "account_holder": "A",
                "account_number": "GB29",
                "swift": "HBUK"
            }
        }
        
        response = requests.post(f"{BASE_URL}/withdraw", json=withdraw_data, headers=geo_headers, timeout=30)
        
        if response.status_code != 403:
            print(f"❌ Expected 403, got {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        print(f"✅ Withdraw blocked with 403: {json.dumps(data, indent=2)}")
        
        if data.get('code') != 'CARD_REQUIRED':
            print(f"❌ Expected code 'CARD_REQUIRED', got '{data.get('code')}'")
            return False
        
        print(f"  ✅ Response code is 'CARD_REQUIRED'")
        print("✅ TEST 5 PASSED")
        return True
        
    except Exception as e:
        print(f"❌ TEST 5 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_admin_withdraw_bypass():
    """TEST 6: Admin can withdraw without card and with geolocation hold"""
    print("\n" + "="*80)
    print("TEST 6: Admin withdraw bypass")
    print("="*80)
    
    try:
        # Login as admin
        admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_token:
            print("❌ TEST 6 FAILED: Could not login as admin")
            return False
        
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get admin user ID
        me_response = requests.get(f"{BASE_URL}/auth/me", headers=admin_headers, timeout=30)
        if me_response.status_code != 200:
            print(f"❌ GET /auth/me failed: {me_response.status_code}")
            return False
        
        admin_user = me_response.json().get('user', {})
        admin_id = admin_user.get('id')
        print(f"📝 Admin user ID: {admin_id}")
        
        # Ensure admin has USD balance
        wallets_response = requests.get(f"{BASE_URL}/wallets", headers=admin_headers, timeout=30)
        if wallets_response.status_code == 200:
            wallets = wallets_response.json().get('wallets', [])
            usd_wallet = next((w for w in wallets if w.get('currency') == 'USD'), None)
            if usd_wallet and usd_wallet.get('balance', 0) < 100:
                print(f"⚠️  Admin USD balance is low, crediting 100 USD")
                adjust_response = requests.post(f"{BASE_URL}/admin/users/{admin_id}/adjust", json={
                    "currency": "USD",
                    "amount": 100,
                    "kind": "credit"
                }, headers=admin_headers, timeout=30)
                if adjust_response.status_code == 200:
                    print(f"  ✅ Credited 100 USD to admin")
                time.sleep(1)
        
        # Set geolocation hold on admin via withdraw_access endpoint
        print(f"📝 Setting geolocation hold on admin...")
        lock_response = requests.post(f"{BASE_URL}/admin/users/{admin_id}/withdraw_access", json={
            "mode": "lock"
        }, headers=admin_headers, timeout=30)
        
        if lock_response.status_code != 200:
            print(f"❌ POST /admin/users/{admin_id}/withdraw_access failed: {lock_response.status_code}")
            return False
        
        print(f"  ✅ Geolocation hold set on admin")
        
        # Verify admin has withdraw_lock
        me_response2 = requests.get(f"{BASE_URL}/auth/me", headers=admin_headers, timeout=30)
        admin_user2 = me_response2.json().get('user', {})
        if not admin_user2.get('withdraw_lock', {}).get('active'):
            print(f"❌ Admin withdraw_lock is not active")
            return False
        
        print(f"  ✅ Admin withdraw_lock.active is true")
        
        # Admin attempts withdrawal (should succeed despite no card and hold)
        withdraw_data = {
            "method": "bank_swift",
            "currency": "USD",
            "amount": 30,
            "destination": "GB29",
            "details": {
                "bank_name": "X",
                "account_holder": "A",
                "account_number": "GB29",
                "swift": "HBUK"
            }
        }
        
        response = requests.post(f"{BASE_URL}/withdraw", json=withdraw_data, headers=admin_headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Admin withdraw failed: {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        print(f"✅ Admin withdraw succeeded: {json.dumps(data, indent=2)}")
        
        withdrawal_id = data.get('request', {}).get('id')
        print(f"📝 Withdrawal request ID: {withdrawal_id}")
        
        # Admin GET withdrawals list
        time.sleep(1)
        list_response = requests.get(f"{BASE_URL}/admin/withdrawals", headers=admin_headers, timeout=30)
        
        if list_response.status_code != 200:
            print(f"❌ GET /admin/withdrawals failed: {list_response.status_code}")
            return False
        
        withdrawals = list_response.json().get('withdrawals', [])
        print(f"✅ Admin withdrawals list has {len(withdrawals)} items")
        
        # Check if list items have user object
        if len(withdrawals) > 0:
            first_withdrawal = withdrawals[0]
            if 'user' not in first_withdrawal:
                print(f"❌ Withdrawal does not have 'user' object")
                return False
            print(f"  ✅ Withdrawal has 'user' object")
        
        # Admin GET withdrawal detail
        detail_response = requests.get(f"{BASE_URL}/admin/withdrawals/{withdrawal_id}", headers=admin_headers, timeout=30)
        
        if detail_response.status_code != 200:
            print(f"❌ GET /admin/withdrawals/{withdrawal_id} failed: {detail_response.status_code}")
            return False
        
        detail = detail_response.json()
        print(f"✅ Admin withdrawal detail retrieved")
        
        # Verify response structure
        required_keys = ['request', 'user', 'wallet', 'locations']
        for key in required_keys:
            if key in detail:
                print(f"  ✅ Has '{key}' key")
            else:
                print(f"  ❌ Missing '{key}' key")
        
        # Verify request.destination
        request = detail.get('request', {})
        if request.get('destination') != 'GB29':
            print(f"❌ destination mismatch: {request.get('destination')}")
            return False
        
        print(f"  ✅ request.destination is 'GB29'")
        
        # Admin reject the withdrawal (to refund)
        reject_response = requests.post(f"{BASE_URL}/admin/withdrawals/{withdrawal_id}/reject", headers=admin_headers, timeout=30)
        
        if reject_response.status_code != 200:
            print(f"❌ POST /admin/withdrawals/{withdrawal_id}/reject failed: {reject_response.status_code}")
            return False
        
        print(f"  ✅ Withdrawal rejected (refunded)")
        
        # Clean up: unlock admin
        unlock_response = requests.post(f"{BASE_URL}/admin/users/{admin_id}/withdraw_access", json={
            "mode": "unlock"
        }, headers=admin_headers, timeout=30)
        
        if unlock_response.status_code == 200:
            print(f"  ✅ Admin unlocked")
        
        print("✅ TEST 6 PASSED")
        return True
        
    except Exception as e:
        print(f"❌ TEST 6 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_geo_message():
    """TEST 7: GEO message for regular user with card"""
    print("\n" + "="*80)
    print("TEST 7: GEO message (regular user with card)")
    print("="*80)
    
    try:
        # Login as geo tester
        geo_token = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
        if not geo_token:
            print("❌ TEST 7 FAILED: Could not login as geo tester")
            return False
        
        geo_headers = {"Authorization": f"Bearer {geo_token}"}
        
        # Remove exemption if present (from previous tests)
        admin_token_temp = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if admin_token_temp:
            admin_headers_temp = {"Authorization": f"Bearer {admin_token_temp}"}
            me_response_temp = requests.get(f"{BASE_URL}/auth/me", headers=geo_headers, timeout=30)
            geo_user_id_temp = me_response_temp.json().get('user', {}).get('id')
            if geo_user_id_temp:
                # Lock the user to remove exemption
                lock_response = requests.post(f"{BASE_URL}/admin/users/{geo_user_id_temp}/withdraw_access", json={
                    "mode": "lock"
                }, headers=admin_headers_temp, timeout=30)
                if lock_response.status_code == 200:
                    print(f"  ✅ Removed exemption from user")
                time.sleep(1)
        
        # Check for existing cards and delete basic if it exists
        cards_response = requests.get(f"{BASE_URL}/cards", headers=geo_headers, timeout=30)
        if cards_response.status_code == 200:
            cards = cards_response.json().get('cards', [])
            basic_cards = [c for c in cards if c.get('tier') == 'basic' and c.get('status') != 'deleted']
            if len(basic_cards) > 0:
                print(f"⚠️  User has {len(basic_cards)} basic card(s), deleting them first")
                for card in basic_cards:
                    delete_response = requests.delete(f"{BASE_URL}/cards/{card['id']}", headers=geo_headers, timeout=30)
                    if delete_response.status_code == 200:
                        print(f"  ✅ Deleted card {card['id']}")
                time.sleep(1)
        
        # Request a card
        card_response = requests.post(f"{BASE_URL}/cards/request", json={"tier": "basic"}, headers=geo_headers, timeout=30)
        
        if card_response.status_code != 200:
            print(f"❌ POST /cards/request failed: {card_response.status_code} - {card_response.text}")
            return False
        
        card = card_response.json().get('card', {})
        card_id = card.get('id')
        print(f"✅ Card requested: {card_id}")
        
        # Activate card with tx_hash
        activate_response = requests.post(f"{BASE_URL}/cards/{card_id}/activate", json={
            "tx_hash": "0xgabcdef123456789",
            "network": "ERC20"
        }, headers=geo_headers, timeout=30)
        
        if activate_response.status_code != 200:
            print(f"❌ POST /cards/{card_id}/activate failed: {activate_response.status_code}")
            return False
        
        print(f"  ✅ Card activation submitted")
        
        # Admin approve card
        admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_token:
            print("❌ TEST 7 FAILED: Could not login as admin")
            return False
        
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        time.sleep(1)
        approve_response = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve", json={
            "activate_now": True
        }, headers=admin_headers, timeout=30)
        
        if approve_response.status_code != 200:
            print(f"❌ POST /admin/cards/{card_id}/approve failed: {approve_response.status_code}")
            return False
        
        print(f"  ✅ Card approved (user now has withdraw_lock)")
        
        # Verify user has withdraw_lock
        time.sleep(1)
        me_response = requests.get(f"{BASE_URL}/auth/me", headers=geo_headers, timeout=30)
        user = me_response.json().get('user', {})
        
        if not user.get('withdraw_lock', {}).get('active'):
            print(f"❌ User withdraw_lock is not active after card approval")
            return False
        
        print(f"  ✅ User withdraw_lock.active is true")
        
        # Attempt withdrawal (should be blocked with GEO_UNVERIFIED)
        withdraw_data = {
            "method": "bank_swift",
            "currency": "USD",
            "amount": 50,
            "destination": "GB29",
            "details": {
                "bank_name": "X",
                "account_holder": "A",
                "account_number": "GB29",
                "swift": "HBUK"
            }
        }
        
        response = requests.post(f"{BASE_URL}/withdraw", json=withdraw_data, headers=geo_headers, timeout=30)
        
        if response.status_code != 403:
            print(f"❌ Expected 403, got {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        print(f"✅ Withdraw blocked with 403: {json.dumps(data, indent=2)}")
        
        # Verify exact error message
        expected_error = "Geolocation Unverified (The card used to withdraw is not supported in this geolocation). Please contact support at support@aurelawallet.com"
        
        checks = [
            (data.get('code') == 'GEO_UNVERIFIED', "code is 'GEO_UNVERIFIED'"),
            (data.get('support_email') == 'support@aurelawallet.com', "support_email is 'support@aurelawallet.com'"),
            (data.get('error') == expected_error, f"error message matches exactly"),
            ('allowance_usd' not in data, "body does NOT contain 'allowance_usd'"),
            ('attempted_usd' not in data, "body does NOT contain 'attempted_usd'"),
        ]
        
        all_passed = True
        for check, desc in checks:
            if check:
                print(f"  ✅ {desc}")
            else:
                print(f"  ❌ {desc}")
                all_passed = False
        
        if not all_passed:
            print("❌ TEST 7 FAILED: Error message structure incorrect")
            return False
        
        print("✅ TEST 7 PASSED")
        return True
        
    except Exception as e:
        print(f"❌ TEST 7 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_silent_allowance():
    """TEST 8: Silent allowance (no notification)"""
    print("\n" + "="*80)
    print("TEST 8: Silent allowance (no notification)")
    print("="*80)
    
    try:
        # Login as geo tester
        geo_token = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
        if not geo_token:
            print("❌ TEST 8 FAILED: Could not login as geo tester")
            return False
        
        geo_headers = {"Authorization": f"Bearer {geo_token}"}
        
        # Get geo tester user ID
        me_response = requests.get(f"{BASE_URL}/auth/me", headers=geo_headers, timeout=30)
        geo_user_id = me_response.json().get('user', {}).get('id')
        
        # Get current notification count
        notif_response = requests.get(f"{BASE_URL}/notifications", headers=geo_headers, timeout=30)
        if notif_response.status_code == 200:
            initial_notifs = notif_response.json().get('notifications', [])
            initial_count = len(initial_notifs)
            print(f"📝 Initial notification count: {initial_count}")
        else:
            initial_count = 0
        
        # Admin set allowance
        admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_token:
            print("❌ TEST 8 FAILED: Could not login as admin")
            return False
        
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        allowance_response = requests.post(f"{BASE_URL}/admin/users/{geo_user_id}/withdraw_access", json={
            "mode": "allowance",
            "allowance_usd": 80
        }, headers=admin_headers, timeout=30)
        
        if allowance_response.status_code != 200:
            print(f"❌ POST /admin/users/{geo_user_id}/withdraw_access failed: {allowance_response.status_code}")
            return False
        
        print(f"✅ Admin set allowance to 80 USD")
        
        # Check notifications (should NOT have new withdraw_access_updated notification)
        time.sleep(2)
        notif_response2 = requests.get(f"{BASE_URL}/notifications", headers=geo_headers, timeout=30)
        
        if notif_response2.status_code != 200:
            print(f"❌ GET /notifications failed: {notif_response2.status_code}")
            return False
        
        new_notifs = notif_response2.json().get('notifications', [])
        new_count = len(new_notifs)
        
        # Check for withdraw_access_updated notification
        access_notifs = [n for n in new_notifs if n.get('kind') == 'withdraw_access_updated']
        
        if len(access_notifs) > 0:
            print(f"❌ Found {len(access_notifs)} 'withdraw_access_updated' notifications (should be 0)")
            return False
        
        print(f"  ✅ No 'withdraw_access_updated' notification created by allowance action")
        
        # Admin unlock user
        unlock_response = requests.post(f"{BASE_URL}/admin/users/{geo_user_id}/withdraw_access", json={
            "mode": "unlock"
        }, headers=admin_headers, timeout=30)
        
        if unlock_response.status_code != 200:
            print(f"❌ POST /admin/users/{geo_user_id}/withdraw_access (unlock) failed: {unlock_response.status_code}")
            return False
        
        print(f"✅ Admin unlocked user")
        
        # Check notifications again (should still NOT have withdraw_access_updated)
        time.sleep(2)
        notif_response3 = requests.get(f"{BASE_URL}/notifications", headers=geo_headers, timeout=30)
        
        if notif_response3.status_code == 200:
            final_notifs = notif_response3.json().get('notifications', [])
            access_notifs2 = [n for n in final_notifs if n.get('kind') == 'withdraw_access_updated']
            
            if len(access_notifs2) > 0:
                print(f"❌ Found {len(access_notifs2)} 'withdraw_access_updated' notifications after unlock (should be 0)")
                return False
            
            print(f"  ✅ No 'withdraw_access_updated' notification created by unlock action")
        
        print("✅ TEST 8 PASSED")
        return True
        
    except Exception as e:
        print(f"❌ TEST 8 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_version():
    """TEST 9: GET /api/version should show 1.4.2"""
    print("\n" + "="*80)
    print("TEST 9: Version endpoint")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/version", timeout=30)
        
        if response.status_code != 200:
            print(f"❌ GET /version failed: {response.status_code}")
            return False
        
        data = response.json()
        print(f"✅ GET /version response: {json.dumps(data, indent=2)}")
        
        version = data.get('version')
        if version != '1.4.2':
            print(f"❌ Version is '{version}', expected '1.4.2'")
            return False
        
        print(f"  ✅ version is '1.4.2'")
        
        # Check whats_new contains location verification mention
        whats_new = data.get('whats_new', [])
        location_mention = any('location' in item.lower() or 'verification' in item.lower() for item in whats_new)
        
        if not location_mention:
            print(f"❌ whats_new does not mention location verification")
            return False
        
        print(f"  ✅ whats_new contains location verification mention")
        print("✅ TEST 9 PASSED")
        return True
        
    except Exception as e:
        print(f"❌ TEST 9 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_regressions():
    """TEST 10: Regressions"""
    print("\n" + "="*80)
    print("TEST 10: Regressions")
    print("="*80)
    
    try:
        # Login as admin
        admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_token:
            print("❌ TEST 10 FAILED: Could not login as admin")
            return False
        
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test GET /admin/kyc
        kyc_response = requests.get(f"{BASE_URL}/admin/kyc", headers=admin_headers, timeout=30)
        if kyc_response.status_code != 200:
            print(f"❌ GET /admin/kyc failed: {kyc_response.status_code}")
            return False
        print(f"  ✅ GET /admin/kyc returns 200")
        
        # Test GET /admin/cards
        cards_response = requests.get(f"{BASE_URL}/admin/cards", headers=admin_headers, timeout=30)
        if cards_response.status_code != 200:
            print(f"❌ GET /admin/cards failed: {cards_response.status_code}")
            return False
        print(f"  ✅ GET /admin/cards returns 200")
        
        # Test GET /admin/withdraw-attempts
        attempts_response = requests.get(f"{BASE_URL}/admin/withdraw-attempts", headers=admin_headers, timeout=30)
        if attempts_response.status_code != 200:
            print(f"❌ GET /admin/withdraw-attempts failed: {attempts_response.status_code}")
            return False
        
        data = attempts_response.json()
        attempts = data.get('attempts', [])
        print(f"  ✅ GET /admin/withdraw-attempts returns 200 with {len(attempts)} attempts")
        
        # Check if items have user.last_location when present
        if len(attempts) > 0:
            for attempt in attempts:
                user = attempt.get('user', {})
                if 'last_location' in user:
                    print(f"    📍 Attempt has user.last_location with status '{user['last_location'].get('status')}'")
                    break
        
        # Test GET /rates
        rates_response = requests.get(f"{BASE_URL}/rates", timeout=30)
        if rates_response.status_code != 200:
            print(f"❌ GET /rates failed: {rates_response.status_code}")
            return False
        print(f"  ✅ GET /rates returns 200")
        
        print("✅ TEST 10 PASSED")
        return True
        
    except Exception as e:
        print(f"❌ TEST 10 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("AURELA GEOLOCATION FEATURES TEST SUITE")
    print("Testing version 1.4.2")
    print("="*80)
    
    tests = [
        ("Location capture (granted)", test_location_capture_granted),
        ("Unauthenticated location", test_location_unauthenticated),
        ("Invalid coordinates", test_location_invalid_coords),
        ("Location capture (denied)", test_location_denied),
        ("Admin user locations", test_admin_user_locations),
        ("Deposit with admin detail", test_deposit_with_admin_detail),
        ("Withdraw without card", test_withdraw_without_card),
        ("Admin withdraw bypass", test_admin_withdraw_bypass),
        ("GEO message", test_geo_message),
        ("Silent allowance", test_silent_allowance),
        ("Version endpoint", test_version),
        ("Regressions", test_regressions),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
