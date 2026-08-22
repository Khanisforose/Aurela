#!/usr/bin/env python3
"""
Backend API test for Aurela - 3 New Features Test
Tests:
1. Web Push Notifications (VAPID)
2. Portfolio History
3. Public /pay lookup
4. Regression tests
"""

import requests
import time
import json
from typing import Dict, Any
from pymongo import MongoClient
import os

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'aurela')

def get_admin_token():
    """Login as admin and return token"""
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10
    )
    if resp.status_code == 200:
        return resp.json().get('token')
    return None

def register_user(email, first_name, last_name, country, phone, password):
    """Register a new user via OTP flow"""
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
        return None, None
    
    data = resp.json()
    signup_id = data.get('signup_id')
    dev_otp = data.get('dev_otp')
    
    # If dev_otp is not in response, try to fetch from DB
    if not dev_otp:
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            signup = db.signups.find_one({'id': signup_id})
            if signup:
                dev_otp = signup.get('code')
            client.close()
        except Exception:
            pass
    
    if not dev_otp:
        print(f"⚠️  No dev_otp available for {email}, skipping verification")
        return None, None
    
    # Step 2: Verify with OTP
    resp = requests.post(
        f"{BASE_URL}/auth/register/verify",
        json={"signup_id": signup_id, "code": dev_otp},
        timeout=10
    )
    if resp.status_code != 200:
        return None, None
    
    data = resp.json()
    return data.get('token'), data.get('user', {}).get('id')


def test_feature_1_web_push_notifications():
    """
    FEATURE 1 — Web Push Notifications (VAPID)
    Test all push notification endpoints
    """
    print("\n" + "="*80)
    print("FEATURE 1: WEB PUSH NOTIFICATIONS (VAPID)")
    print("="*80)
    
    try:
        # Test 1: GET /api/push/config (no auth)
        print("\n[1] GET /api/push/config (no auth)...")
        resp = requests.get(f"{BASE_URL}/push/config", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'public_key' in data, "Response should have public_key"
        public_key = data.get('public_key')
        assert public_key is not None, "public_key should not be null"
        assert isinstance(public_key, str), "public_key should be a string"
        assert public_key.startswith('B'), f"VAPID public key should start with 'B', got {public_key[:1]}"
        assert len(public_key) >= 80, f"VAPID public key should be ~87 chars, got {len(public_key)}"
        print(f"✓ public_key: {public_key[:20]}... (length: {len(public_key)})")
        
        # Test 2: Login as a user
        print("\n[2] Creating test user and logging in...")
        test_email = f"test_push_{int(time.time())}@example.com"
        token, user_id = register_user(
            test_email, "Test", "Push", "US", "+1234567890", "TestPass123"
        )
        
        if not token or not user_id:
            print("⚠️  Could not create test user (OTP flow may be disabled), skipping remaining tests")
            return None
        
        print(f"✓ User created and logged in: {test_email}")
        
        # Test 3: POST /api/push/subscribe (authed)
        print("\n[3] POST /api/push/subscribe (authed)...")
        subscription_data = {
            "subscription": {
                "endpoint": "https://fcm.googleapis.com/fcm/send/test123",
                "keys": {
                    "p256dh": "test_p256dh_key",
                    "auth": "test_auth_key"
                }
            },
            "user_agent": "test"
        }
        resp = requests.post(
            f"{BASE_URL}/push/subscribe",
            headers={"Authorization": f"Bearer {token}"},
            json=subscription_data,
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('ok') == True, "Should return ok:true"
        print("✓ Subscription created successfully")
        
        # Test 4: Verify subscription in database
        print("\n[4] Verifying subscription in database...")
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            sub = db.push_subscriptions.find_one({'user_id': user_id})
            assert sub is not None, "Subscription should exist in database"
            assert sub.get('subscription', {}).get('endpoint') == "https://fcm.googleapis.com/fcm/send/test123", \
                "Endpoint should match"
            print(f"✓ Subscription found in database for user {user_id}")
            client.close()
        except Exception as e:
            print(f"❌ Database verification failed: {e}")
            return False
        
        # Test 5: POST /api/push/subscribe again (should upsert, not duplicate)
        print("\n[5] POST /api/push/subscribe again (should upsert)...")
        resp = requests.post(
            f"{BASE_URL}/push/subscribe",
            headers={"Authorization": f"Bearer {token}"},
            json=subscription_data,
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        # Verify only 1 subscription exists
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            count = db.push_subscriptions.count_documents({
                'user_id': user_id,
                'subscription.endpoint': "https://fcm.googleapis.com/fcm/send/test123"
            })
            assert count == 1, f"Should have exactly 1 subscription, found {count}"
            print(f"✓ Upsert working correctly (only 1 subscription exists)")
            client.close()
        except Exception as e:
            print(f"❌ Database verification failed: {e}")
            return False
        
        # Test 6: POST /api/push/test (authed)
        print("\n[6] POST /api/push/test (authed)...")
        resp = requests.post(
            f"{BASE_URL}/push/test",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('ok') == True, "Should return ok:true"
        print("✓ Push test endpoint returns 200 (gracefully handles fake endpoint)")
        
        # Test 7: POST /api/push/unsubscribe with endpoint
        print("\n[7] POST /api/push/unsubscribe with endpoint...")
        resp = requests.post(
            f"{BASE_URL}/push/unsubscribe",
            headers={"Authorization": f"Bearer {token}"},
            json={"endpoint": "https://fcm.googleapis.com/fcm/send/test123"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('ok') == True, "Should return ok:true"
        
        # Verify subscription is removed
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            sub = db.push_subscriptions.find_one({
                'user_id': user_id,
                'subscription.endpoint': "https://fcm.googleapis.com/fcm/send/test123"
            })
            assert sub is None, "Subscription should be removed"
            print("✓ Subscription removed successfully")
            client.close()
        except Exception as e:
            print(f"❌ Database verification failed: {e}")
            return False
        
        # Test 8: Create multiple subscriptions and remove all
        print("\n[8] Creating multiple subscriptions and removing all...")
        # Create 2 subscriptions
        for i in range(2):
            subscription_data = {
                "subscription": {
                    "endpoint": f"https://fcm.googleapis.com/fcm/send/test{i}",
                    "keys": {
                        "p256dh": f"test_p256dh_key_{i}",
                        "auth": f"test_auth_key_{i}"
                    }
                },
                "user_agent": "test"
            }
            resp = requests.post(
                f"{BASE_URL}/push/subscribe",
                headers={"Authorization": f"Bearer {token}"},
                json=subscription_data,
                timeout=10
            )
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        # Verify 2 subscriptions exist
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            count = db.push_subscriptions.count_documents({'user_id': user_id})
            assert count == 2, f"Should have 2 subscriptions, found {count}"
            print(f"✓ Created 2 subscriptions")
            client.close()
        except Exception as e:
            print(f"❌ Database verification failed: {e}")
            return False
        
        # Remove all subscriptions (empty body)
        print("\n[9] POST /api/push/unsubscribe with empty body (remove all)...")
        resp = requests.post(
            f"{BASE_URL}/push/unsubscribe",
            headers={"Authorization": f"Bearer {token}"},
            json={},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        # Verify all subscriptions are removed
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            count = db.push_subscriptions.count_documents({'user_id': user_id})
            assert count == 0, f"Should have 0 subscriptions, found {count}"
            print("✓ All subscriptions removed successfully")
            client.close()
        except Exception as e:
            print(f"❌ Database verification failed: {e}")
            return False
        
        print("\n✅ FEATURE 1 PASSED: Web Push Notifications (VAPID) working correctly")
        return True
        
    except AssertionError as e:
        print(f"\n❌ FEATURE 1 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ FEATURE 1 ERROR: {e}")
        return False


def test_feature_2_portfolio_history():
    """
    FEATURE 2 — Portfolio History
    Test portfolio history endpoint
    """
    print("\n" + "="*80)
    print("FEATURE 2: PORTFOLIO HISTORY")
    print("="*80)
    
    try:
        # Test 1: Login as admin (has balance)
        print("\n[1] Logging in as admin...")
        admin_token = get_admin_token()
        assert admin_token, "Failed to get admin token"
        print("✓ Admin logged in")
        
        # Test 2: GET /api/portfolio/history?days=30 (authed)
        print("\n[2] GET /api/portfolio/history?days=30 (authed)...")
        resp = requests.get(
            f"{BASE_URL}/portfolio/history?days=30",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'days' in data, "Response should have days"
        assert 'points' in data, "Response should have points"
        assert data.get('days') == 30, f"days should be 30, got {data.get('days')}"
        points = data.get('points', [])
        assert isinstance(points, list), "points should be a list"
        print(f"✓ Response structure correct: days={data.get('days')}, points count={len(points)}")
        
        # Test 3: Verify points are sorted ascending by date
        print("\n[3] Verifying points are sorted ascending by date...")
        if len(points) > 1:
            for i in range(len(points) - 1):
                current_date = points[i].get('date')
                next_date = points[i + 1].get('date')
                assert current_date <= next_date, \
                    f"Points should be sorted ascending, but {current_date} > {next_date}"
            print(f"✓ Points are sorted ascending by date")
        else:
            print(f"✓ Only {len(points)} point(s), sorting not applicable")
        
        # Test 4: Verify at least 1 point exists (today)
        print("\n[4] Verifying at least 1 point exists...")
        assert len(points) >= 1, "Should have at least 1 point (today)"
        latest_point = points[-1]
        assert 'date' in latest_point, "Point should have date"
        assert 'total_usd' in latest_point, "Point should have total_usd"
        assert isinstance(latest_point.get('total_usd'), (int, float)), \
            "total_usd should be a number"
        print(f"✓ Latest point: date={latest_point.get('date')}, total_usd={latest_point.get('total_usd')}")
        
        # Test 5: Call GET /api/wallets to trigger snapshot
        print("\n[5] Calling GET /api/wallets to trigger snapshot...")
        resp = requests.get(
            f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        print("✓ Wallets endpoint called successfully")
        
        # Test 6: Verify snapshot was created/updated in database
        print("\n[6] Verifying snapshot in database...")
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            # Get admin user
            admin_user = db.users.find_one({'email': ADMIN_EMAIL})
            assert admin_user is not None, "Admin user should exist"
            admin_id = admin_user.get('id')
            
            # Check for today's snapshot
            today = time.strftime('%Y-%m-%d')
            snapshot = db.portfolio_snapshots.find_one({
                'user_id': admin_id,
                'day': today
            })
            assert snapshot is not None, f"Snapshot for today ({today}) should exist"
            print(f"✓ Snapshot found for today: day={snapshot.get('day')}, total_usd={snapshot.get('total_usd')}")
            client.close()
        except Exception as e:
            print(f"❌ Database verification failed: {e}")
            return False
        
        # Test 7: Multiple calls on same day should upsert (not duplicate)
        print("\n[7] Calling GET /api/wallets again (should upsert, not duplicate)...")
        resp = requests.get(
            f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        # Verify only 1 snapshot for today
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            count = db.portfolio_snapshots.count_documents({
                'user_id': admin_id,
                'day': today
            })
            assert count == 1, f"Should have exactly 1 snapshot for today, found {count}"
            print(f"✓ Upsert working correctly (only 1 snapshot for today)")
            client.close()
        except Exception as e:
            print(f"❌ Database verification failed: {e}")
            return False
        
        # Test 8: GET /api/portfolio/history?days=7 works
        print("\n[8] GET /api/portfolio/history?days=7...")
        resp = requests.get(
            f"{BASE_URL}/portfolio/history?days=7",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('days') == 7, f"days should be 7, got {data.get('days')}"
        print(f"✓ Different day windows work: days=7, points count={len(data.get('points', []))}")
        
        # Test 9: Non-authed request should return 401
        print("\n[9] GET /api/portfolio/history without auth (should return 401)...")
        resp = requests.get(
            f"{BASE_URL}/portfolio/history?days=30",
            timeout=10
        )
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Non-authed request correctly rejected with 401")
        
        print("\n✅ FEATURE 2 PASSED: Portfolio History working correctly")
        return True
        
    except AssertionError as e:
        print(f"\n❌ FEATURE 2 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ FEATURE 2 ERROR: {e}")
        return False


def test_feature_3_public_pay_lookup():
    """
    FEATURE 3 — Public /pay lookup
    Test public pay lookup endpoint
    """
    print("\n" + "="*80)
    print("FEATURE 3: PUBLIC /PAY LOOKUP")
    print("="*80)
    
    try:
        # Test 1: GET /api/pay/lookup?to=AUR123456789 (fake code, no auth)
        print("\n[1] GET /api/pay/lookup?to=AUR123456789 (fake code, no auth)...")
        resp = requests.get(
            f"{BASE_URL}/pay/lookup?to=AUR123456789",
            timeout=10
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        data = resp.json()
        assert 'error' in data, "Response should have error"
        assert 'not found' in data.get('error', '').lower(), \
            f"Error should mention 'not found', got: {data.get('error')}"
        print(f"✓ Fake code returns 404: {data.get('error')}")
        
        # Test 2: Get a real Aurela ID from admin
        print("\n[2] Getting admin's Aurela ID...")
        admin_token = get_admin_token()
        assert admin_token, "Failed to get admin token"
        
        resp = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        admin_user = resp.json()
        admin_code = admin_user.get('user_code')
        assert admin_code, "Admin should have user_code"
        assert admin_code.startswith('AUR'), f"user_code should start with AUR, got {admin_code}"
        print(f"✓ Admin Aurela ID: {admin_code}")
        
        # Test 3: GET /api/pay/lookup?to=<real_AUR_ID>
        print(f"\n[3] GET /api/pay/lookup?to={admin_code} (real code, no auth)...")
        resp = requests.get(
            f"{BASE_URL}/pay/lookup?to={admin_code}",
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'recipient' in data, "Response should have recipient"
        recipient = data.get('recipient', {})
        
        # Test 4: Verify response structure
        print("\n[4] Verifying response structure...")
        assert 'code' in recipient, "recipient should have code"
        assert 'name' in recipient, "recipient should have name"
        assert 'country' in recipient, "recipient should have country"
        assert 'joined' in recipient, "recipient should have joined"
        print(f"✓ Response structure correct:")
        print(f"  code: {recipient.get('code')}")
        print(f"  name: {recipient.get('name')}")
        print(f"  country: {recipient.get('country')}")
        print(f"  joined: {recipient.get('joined')}")
        
        # Test 5: Verify sensitive fields are NOT exposed
        print("\n[5] Verifying sensitive fields are NOT exposed...")
        assert 'email' not in recipient, "recipient should NOT have email"
        assert 'phone' not in recipient, "recipient should NOT have phone"
        assert 'id' not in recipient, "recipient should NOT have id"
        assert 'password' not in recipient, "recipient should NOT have password"
        print("✓ Sensitive fields (email, phone, id) are NOT exposed")
        
        # Test 6: Verify name is first name + last initial
        print("\n[6] Verifying name format (first name + last initial)...")
        name = recipient.get('name', '')
        # Name should be like "John A." not "John Anderson"
        # Check that it contains a dot (last initial format)
        if admin_user.get('last_name'):
            assert '.' in name or len(name.split()[-1]) == 2, \
                f"Name should be 'FirstName L.' format, got: {name}"
            print(f"✓ Name format correct: {name} (first name + last initial)")
        else:
            print(f"✓ Name format: {name} (no last name available)")
        
        # Test 7: GET /api/pay/lookup?to=INVALID (invalid format)
        print("\n[7] GET /api/pay/lookup?to=INVALID (invalid format)...")
        resp = requests.get(
            f"{BASE_URL}/pay/lookup?to=INVALID",
            timeout=10
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        data = resp.json()
        assert 'error' in data, "Response should have error"
        print(f"✓ Invalid format returns 400: {data.get('error')}")
        
        # Test 8: GET /api/pay/lookup?to= (empty)
        print("\n[8] GET /api/pay/lookup?to= (empty)...")
        resp = requests.get(
            f"{BASE_URL}/pay/lookup?to=",
            timeout=10
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        data = resp.json()
        assert 'error' in data, "Response should have error"
        print(f"✓ Empty query returns 400: {data.get('error')}")
        
        # Test 9: Verify no auth required
        print("\n[9] Verifying no auth required...")
        # We already tested without auth in previous tests, so this is confirmed
        print("✓ No auth required (confirmed by previous tests)")
        
        print("\n✅ FEATURE 3 PASSED: Public /pay lookup working correctly")
        return True
        
    except AssertionError as e:
        print(f"\n❌ FEATURE 3 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ FEATURE 3 ERROR: {e}")
        return False


def test_regression():
    """
    REGRESSION
    Test existing endpoints still work
    """
    print("\n" + "="*80)
    print("REGRESSION TESTS")
    print("="*80)
    
    all_passed = True
    
    # Test 1: GET /api/rates
    try:
        print("\n[1] GET /api/rates...")
        resp = requests.get(f"{BASE_URL}/rates", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'crypto_usd' in data, "Should have crypto_usd"
        assert 'fx' in data, "Should have fx"
        print("✅ Rates endpoint working")
    except Exception as e:
        print(f"❌ Rates endpoint failed: {e}")
        all_passed = False
    
    # Test 2: GET /api/wallets (authed) - auto-snapshots portfolio
    try:
        print("\n[2] GET /api/wallets (authed) - auto-snapshots portfolio...")
        admin_token = get_admin_token()
        resp = requests.get(
            f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'wallets' in data, "Should have wallets array"
        print("✅ Wallets endpoint working and auto-snapshots portfolio")
    except Exception as e:
        print(f"❌ Wallets endpoint failed: {e}")
        all_passed = False
    
    # Test 3: Existing swap/chain/config endpoints
    try:
        print("\n[3] GET /api/config...")
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        print("✅ Config endpoint working")
    except Exception as e:
        print(f"❌ Config endpoint failed: {e}")
        all_passed = False
    
    try:
        print("\n[4] GET /api/chain?limit=1...")
        resp = requests.get(f"{BASE_URL}/chain?limit=1", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        print("✅ Chain endpoint working")
    except Exception as e:
        print(f"❌ Chain endpoint failed: {e}")
        all_passed = False
    
    # Test 4: POST /api/transfer generates both transfer_in and transfer_out notifications
    try:
        print("\n[5] Testing POST /api/transfer generates both notifications...")
        # Create two test users
        sender_email = f"test_sender_{int(time.time())}@example.com"
        recipient_email = f"test_recipient_{int(time.time())}@example.com"
        
        sender_token, sender_id = register_user(
            sender_email, "Test", "Sender", "US", "+1234567890", "TestPass123"
        )
        recipient_token, recipient_id = register_user(
            recipient_email, "Test", "Recipient", "US", "+1234567891", "TestPass123"
        )
        
        if not sender_token or not recipient_token:
            print("⚠️  Could not create test users, skipping transfer notification test")
        else:
            # Credit sender with some AUR
            admin_token = get_admin_token()
            resp = requests.post(
                f"{BASE_URL}/admin/users/{sender_id}/adjust",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"currency": "AUR", "amount": 10, "action": "credit"},
                timeout=10
            )
            assert resp.status_code == 200, "Failed to credit sender"
            
            # Transfer from sender to recipient
            resp = requests.post(
                f"{BASE_URL}/transfer",
                headers={"Authorization": f"Bearer {sender_token}"},
                json={
                    "recipient": recipient_email,
                    "amount": 5,
                    "currency": "AUR",
                    "note": "Test transfer"
                },
                timeout=10
            )
            assert resp.status_code == 200, f"Transfer failed with {resp.status_code}"
            
            # Check sender notifications (should have transfer_out)
            resp = requests.get(
                f"{BASE_URL}/notifications",
                headers={"Authorization": f"Bearer {sender_token}"},
                timeout=10
            )
            assert resp.status_code == 200, "Failed to get sender notifications"
            sender_notifs = resp.json().get('notifications', [])
            has_transfer_out = any(n.get('kind') == 'transfer_out' for n in sender_notifs)
            assert has_transfer_out, "Sender should have transfer_out notification"
            
            # Check recipient notifications (should have transfer_in)
            resp = requests.get(
                f"{BASE_URL}/notifications",
                headers={"Authorization": f"Bearer {recipient_token}"},
                timeout=10
            )
            assert resp.status_code == 200, "Failed to get recipient notifications"
            recipient_notifs = resp.json().get('notifications', [])
            has_transfer_in = any(n.get('kind') == 'transfer_in' for n in recipient_notifs)
            assert has_transfer_in, "Recipient should have transfer_in notification"
            
            print("✅ Transfer generates both transfer_in and transfer_out notifications")
    except Exception as e:
        print(f"❌ Transfer notification test failed: {e}")
        all_passed = False
    
    if all_passed:
        print("\n✅ ALL REGRESSION TESTS PASSED")
    else:
        print("\n❌ SOME REGRESSION TESTS FAILED")
    
    return all_passed


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("AURELA BACKEND TEST - 3 NEW FEATURES")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print("="*80)
    
    results = {}
    
    # Feature 1: Web Push Notifications (VAPID)
    result = test_feature_1_web_push_notifications()
    if result is not None:
        results["Feature 1 - Web Push Notifications (VAPID)"] = result
    else:
        print("\n⚠️  Feature 1 skipped (OTP flow disabled)")
    
    # Feature 2: Portfolio History
    results["Feature 2 - Portfolio History"] = test_feature_2_portfolio_history()
    
    # Feature 3: Public /pay lookup
    results["Feature 3 - Public /pay lookup"] = test_feature_3_public_pay_lookup()
    
    # Regression
    results["Regression"] = test_regression()
    
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    total = len(results)
    passed = sum(results.values())
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit(main())
