#!/usr/bin/env python3
"""
Backend API test for Aurela - 4 New Features Test
Tests:
1. Idempotent seed migrations (critical data-loss fix)
2. Auto Chain Simulation
3. Per-user card activation fee overrides
4. PWA manifest + APK URL config
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


def test_feature_1_idempotent_seed():
    """
    FEATURE 1 — Idempotent seed migrations (critical data-loss fix)
    Test that ensureSeed() doesn't wipe user data on repeated calls
    """
    print("\n" + "="*80)
    print("FEATURE 1: IDEMPOTENT SEED MIGRATIONS (CRITICAL DATA-LOSS FIX)")
    print("="*80)
    
    try:
        # Step 1: Create a fresh test user
        print("\n[1] Creating fresh test user...")
        test_email = f"test_seed_{int(time.time())}@example.com"
        token, user_id = register_user(
            test_email, "Test", "Seed", "US", "+1234567890", "TestPass123"
        )
        
        if not token or not user_id:
            print("⚠️  Could not create test user (OTP flow may be disabled), skipping this test")
            return None
        
        print(f"✓ User created: {test_email}")
        
        # Step 2: Query MongoDB to confirm user exists
        print("\n[2] Querying MongoDB to confirm user exists...")
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            user = db.users.find_one({'email': test_email})
            assert user is not None, "User should exist in database"
            print(f"✓ User found in MongoDB: {user.get('email')}")
            client.close()
        except Exception as e:
            print(f"❌ MongoDB query failed: {e}")
            return False
        
        # Step 3: Confirm GET /api/config still returns 200
        print("\n[3] Confirming GET /api/config returns 200...")
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        print("✓ Config endpoint working")
        
        # Step 4: Count users BEFORE hitting /api/rates multiple times
        print("\n[4] Counting users BEFORE /api/rates calls...")
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            user_count_before = db.users.count_documents({})
            print(f"✓ User count BEFORE: {user_count_before}")
            client.close()
        except Exception as e:
            print(f"❌ MongoDB count failed: {e}")
            return False
        
        # Step 5: Hit /api/rates 20 times (triggers ensureSeed indirectly)
        print("\n[5] Hitting /api/rates 20 times (triggers ensureSeed)...")
        for i in range(20):
            resp = requests.get(f"{BASE_URL}/rates", timeout=10)
            assert resp.status_code == 200, f"Call {i+1} failed with {resp.status_code}"
            if (i + 1) % 5 == 0:
                print(f"  ✓ Completed {i+1}/20 calls")
        print("✓ All 20 calls completed")
        
        # Step 6: Count users AFTER
        print("\n[6] Counting users AFTER /api/rates calls...")
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            user_count_after = db.users.count_documents({})
            print(f"✓ User count AFTER: {user_count_after}")
            client.close()
        except Exception as e:
            print(f"❌ MongoDB count failed: {e}")
            return False
        
        # Step 7: Verify user count is equal (no data loss)
        print("\n[7] Verifying user count is equal...")
        print(f"  Before: {user_count_before}")
        print(f"  After:  {user_count_after}")
        assert user_count_before == user_count_after, f"User count changed! Data loss detected: {user_count_before} → {user_count_after}"
        print("✓ User count unchanged (no data loss)")
        
        # Step 8: Verify the test user still exists
        print("\n[8] Verifying test user still exists...")
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            user = db.users.find_one({'email': test_email})
            assert user is not None, "Test user was deleted!"
            print(f"✓ Test user still exists: {user.get('email')}")
            client.close()
        except Exception as e:
            print(f"❌ MongoDB query failed: {e}")
            return False
        
        print("\n✅ FEATURE 1 PASSED: Idempotent seed migrations working (no data loss)")
        return True
        
    except AssertionError as e:
        print(f"\n❌ FEATURE 1 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ FEATURE 1 ERROR: {e}")
        return False


def test_feature_2_auto_chain_simulation():
    """
    FEATURE 2 — Auto Chain Simulation
    Test that chain grows automatically with varied block types
    """
    print("\n" + "="*80)
    print("FEATURE 2: AUTO CHAIN SIMULATION")
    print("="*80)
    
    try:
        # Step 1: Get baseline chain total
        print("\n[1] Getting baseline chain total...")
        resp = requests.get(f"{BASE_URL}/chain?limit=1", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        baseline_total = data.get('total', 0)
        print(f"✓ Baseline chain total: {baseline_total} blocks")
        
        # Step 2: Hit /api/rates repeatedly with 6-second sleeps (10 calls, ~1 minute)
        print("\n[2] Hitting /api/rates 10 times with 6-second sleeps (~1 minute)...")
        for i in range(10):
            resp = requests.get(f"{BASE_URL}/rates", timeout=10)
            assert resp.status_code == 200, f"Call {i+1} failed with {resp.status_code}"
            print(f"  ✓ Call {i+1}/10 completed")
            if i < 9:  # Don't sleep after last call
                time.sleep(6)
        print("✓ All 10 calls completed")
        
        # Step 3: Get new chain total
        print("\n[3] Getting new chain total...")
        resp = requests.get(f"{BASE_URL}/chain?limit=1", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        new_total = data.get('total', 0)
        print(f"✓ New chain total: {new_total} blocks")
        
        # Step 4: Verify chain grew
        blocks_added = new_total - baseline_total
        print(f"\n[4] Verifying chain grew...")
        print(f"  Baseline: {baseline_total}")
        print(f"  New:      {new_total}")
        print(f"  Added:    {blocks_added}")
        assert blocks_added > 0, f"Chain should have grown, but added {blocks_added} blocks"
        print(f"✓ Chain grew by {blocks_added} blocks (expected ~8-15)")
        
        # Step 5: Fetch latest 20 blocks
        print("\n[5] Fetching latest 20 blocks...")
        resp = requests.get(f"{BASE_URL}/chain?limit=20", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        blocks = data.get('blocks', [])
        assert len(blocks) > 0, "Should have at least 1 block"
        print(f"✓ Fetched {len(blocks)} blocks")
        
        # Step 6: Verify blocks are properly hash-linked
        print("\n[6] Verifying blocks are properly hash-linked...")
        for i in range(len(blocks) - 1):
            current = blocks[i]
            next_block = blocks[i + 1]
            assert current.get('prev_hash') == next_block.get('hash'), \
                f"Block {i} prev_hash doesn't match block {i+1} hash"
        print(f"✓ All {len(blocks)} blocks are properly hash-linked")
        
        # Step 7: Verify block_number increments by 1
        print("\n[7] Verifying block_number increments by 1...")
        for i in range(len(blocks) - 1):
            current = blocks[i]
            next_block = blocks[i + 1]
            assert current.get('block_number') == next_block.get('block_number') + 1, \
                f"Block numbers not sequential: {current.get('block_number')} vs {next_block.get('block_number')}"
        print(f"✓ Block numbers increment correctly")
        
        # Step 8: Verify mix of block types
        print("\n[8] Verifying mix of block types...")
        types = set()
        for block in blocks:
            block_type = block.get('type')
            if block_type:
                types.add(block_type)
        print(f"✓ Block types found: {types}")
        assert len(types) > 1, f"Should have multiple block types, found only: {types}"
        print(f"✓ Mix of block types confirmed ({len(types)} different types)")
        
        # Step 9: Verify card_activation blocks have correct currency and amount
        print("\n[9] Verifying card_activation blocks...")
        admin_token = get_admin_token()
        resp = requests.get(
            f"{BASE_URL}/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        settings = resp.json().get('settings', {})
        card_fees = settings.get('card_activation_fees', {'basic': 10, 'premium': 50, 'elite': 200})
        valid_fees = set(card_fees.values())
        print(f"  Valid card activation fees: {valid_fees}")
        
        card_activation_blocks = [b for b in blocks if b.get('type') == 'card_activation']
        if card_activation_blocks:
            for block in card_activation_blocks:
                assert block.get('currency') == 'USDT', \
                    f"Card activation should use USDT, got {block.get('currency')}"
                assert block.get('amount') in valid_fees, \
                    f"Card activation amount {block.get('amount')} not in valid fees {valid_fees}"
            print(f"✓ {len(card_activation_blocks)} card_activation blocks verified (USDT, valid fees)")
        else:
            print("  ℹ️  No card_activation blocks in sample (acceptable)")
        
        # Step 10: Verify currencies are varied
        print("\n[10] Verifying currencies are varied...")
        currencies = set()
        for block in blocks:
            currency = block.get('currency')
            if currency:
                currencies.add(currency)
        print(f"✓ Currencies found: {currencies}")
        assert len(currencies) > 1, f"Should have multiple currencies, found only: {currencies}"
        print(f"✓ Currency variety confirmed ({len(currencies)} different currencies)")
        
        print("\n✅ FEATURE 2 PASSED: Auto chain simulation working correctly")
        return True
        
    except AssertionError as e:
        print(f"\n❌ FEATURE 2 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ FEATURE 2 ERROR: {e}")
        return False


def test_feature_3_per_user_card_fees():
    """
    FEATURE 3 — Per-user card activation fee overrides
    Test admin can set per-user card fee overrides
    """
    print("\n" + "="*80)
    print("FEATURE 3: PER-USER CARD ACTIVATION FEE OVERRIDES")
    print("="*80)
    
    try:
        # Step 1: Login as admin
        print("\n[1] Logging in as admin...")
        admin_token = get_admin_token()
        assert admin_token, "Failed to get admin token"
        print("✓ Admin logged in")
        
        # Step 2: List users and pick a non-admin user (or create one)
        print("\n[2] Finding or creating a test user...")
        resp = requests.get(
            f"{BASE_URL}/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        users = resp.json().get('users', [])
        
        # Find a non-admin user
        test_user = None
        for user in users:
            if user.get('role') != 'super_admin' and user.get('role') != 'admin':
                test_user = user
                break
        
        # If no non-admin user found, create one
        if not test_user:
            print("  No non-admin user found, creating one...")
            test_email = f"test_cardfee_{int(time.time())}@example.com"
            token, user_id = register_user(
                test_email, "Test", "CardFee", "US", "+1234567890", "TestPass123"
            )
            if not token or not user_id:
                print("⚠️  Could not create test user (OTP flow may be disabled), skipping this test")
                return None
            test_user = {'id': user_id, 'email': test_email}
            test_user_token = token
            print(f"  ✓ Created test user: {test_email}")
        else:
            test_user_token = None
            print(f"  ✓ Using existing user: {test_user.get('email')}")
        
        user_id = test_user.get('id')
        
        # Step 3: Set per-user card fee overrides
        print("\n[3] Setting per-user card fee overrides...")
        resp = requests.post(
            f"{BASE_URL}/admin/users/{user_id}/card_fees",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"overrides": {"basic": 5, "premium": 25, "elite": 100}},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('ok') == True, "Should return ok:true"
        print("✓ Card fee overrides set: basic=5, premium=25, elite=100")
        
        # Step 4: Verify via admin user detail endpoint
        print("\n[4] Verifying via admin user detail endpoint...")
        resp = requests.get(
            f"{BASE_URL}/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        user_detail = data.get('user', {})
        card_fee_overrides = user_detail.get('card_fee_overrides', {})
        print(f"  card_fee_overrides: {card_fee_overrides}")
        assert card_fee_overrides.get('basic') == 5, "basic override should be 5"
        assert card_fee_overrides.get('premium') == 25, "premium override should be 25"
        assert card_fee_overrides.get('elite') == 100, "elite override should be 100"
        print("✓ Overrides verified in user detail")
        
        # Step 5: If we have user token, verify via /auth/me
        if test_user_token:
            print("\n[5] Verifying via /auth/me endpoint...")
            resp = requests.get(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {test_user_token}"},
                timeout=10
            )
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            data = resp.json()
            card_fees = data.get('card_fees', {})
            print(f"  card_fees: {card_fees}")
            assert card_fees.get('basic') == 5, "basic fee should be 5"
            assert card_fees.get('premium') == 25, "premium fee should be 25"
            assert card_fees.get('elite') == 100, "elite fee should be 100"
            print("✓ Overrides verified in /auth/me")
        else:
            print("\n[5] Skipping /auth/me verification (no user token)")
        
        # Step 6: Clear override
        print("\n[6] Clearing card fee overrides...")
        resp = requests.post(
            f"{BASE_URL}/admin/users/{user_id}/card_fees",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"overrides": {}},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        print("✓ Overrides cleared")
        
        # Step 7: Verify overrides are cleared
        if test_user_token:
            print("\n[7] Verifying overrides are cleared...")
            resp = requests.get(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {test_user_token}"},
                timeout=10
            )
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            data = resp.json()
            card_fees = data.get('card_fees', {})
            
            # Get global defaults
            resp = requests.get(f"{BASE_URL}/config", timeout=10)
            config = resp.json()
            global_fees = config.get('activation_fees', {'basic': 10, 'premium': 50, 'elite': 200})
            
            print(f"  card_fees: {card_fees}")
            print(f"  global_fees: {global_fees}")
            assert card_fees.get('basic') == global_fees.get('basic'), "basic should match global"
            assert card_fees.get('premium') == global_fees.get('premium'), "premium should match global"
            assert card_fees.get('elite') == global_fees.get('elite'), "elite should match global"
            print("✓ Card fees now match global defaults")
        else:
            print("\n[7] Skipping clear verification (no user token)")
        
        # Step 8: Authorization check (non-admin cannot set fees)
        print("\n[8] Testing authorization (non-admin should be rejected)...")
        if test_user_token:
            resp = requests.post(
                f"{BASE_URL}/admin/users/{user_id}/card_fees",
                headers={"Authorization": f"Bearer {test_user_token}"},
                json={"overrides": {"basic": 1}},
                timeout=10
            )
            assert resp.status_code in [401, 403], f"Non-admin should get 401/403, got {resp.status_code}"
            print(f"✓ Non-admin correctly rejected with {resp.status_code}")
        else:
            print("  Skipping authorization check (no user token)")
        
        print("\n✅ FEATURE 3 PASSED: Per-user card fee overrides working correctly")
        return True
        
    except AssertionError as e:
        print(f"\n❌ FEATURE 3 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ FEATURE 3 ERROR: {e}")
        return False


def test_feature_4_pwa_manifest_apk():
    """
    FEATURE 4 — PWA manifest + APK URL config
    Test PWA manifest, service worker, icons, and APK URL config
    """
    print("\n" + "="*80)
    print("FEATURE 4: PWA MANIFEST + APK URL CONFIG")
    print("="*80)
    
    try:
        # Step 1: Check /api/config has apk_url and apk_version
        print("\n[1] Checking /api/config for apk_url and apk_version...")
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'apk_url' in data, "Config should have apk_url"
        assert 'apk_version' in data, "Config should have apk_version"
        print(f"✓ apk_url: {data.get('apk_url')}")
        print(f"✓ apk_version: {data.get('apk_version')}")
        
        # Step 2: Login as admin and set APK URL
        print("\n[2] Setting APK URL via admin settings...")
        admin_token = get_admin_token()
        assert admin_token, "Failed to get admin token"
        
        resp = requests.put(
            f"{BASE_URL}/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "apk_url": "https://aurelawallet.com/downloads/aurela.apk",
                "apk_version": "1.0.0"
            },
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        print("✓ APK URL and version set")
        
        # Step 3: Verify via /api/config
        print("\n[3] Verifying APK URL via /api/config...")
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('apk_url') == "https://aurelawallet.com/downloads/aurela.apk", \
            f"apk_url mismatch: {data.get('apk_url')}"
        assert data.get('apk_version') == "1.0.0", \
            f"apk_version mismatch: {data.get('apk_version')}"
        print("✓ APK URL and version verified")
        
        # Step 4: Check /manifest.json
        print("\n[4] Checking /manifest.json...")
        base_url = BASE_URL.replace('/api', '')
        resp = requests.get(f"{base_url}/manifest.json", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        manifest = resp.json()
        
        # Verify required fields
        assert 'name' in manifest, "Manifest should have name"
        assert 'short_name' in manifest, "Manifest should have short_name"
        assert 'start_url' in manifest, "Manifest should have start_url"
        assert manifest.get('display') == 'standalone', "Display should be standalone"
        assert 'icons' in manifest, "Manifest should have icons"
        
        icons = manifest.get('icons', [])
        assert len(icons) >= 2, "Should have at least 2 icons"
        
        # Check for 192 and 512 icons
        has_192 = any(icon.get('sizes') == '192x192' for icon in icons)
        has_512 = any(icon.get('sizes') == '512x512' for icon in icons)
        assert has_192, "Should have 192x192 icon"
        assert has_512, "Should have 512x512 icon"
        
        print(f"✓ Manifest valid with {len(icons)} icons")
        print(f"  name: {manifest.get('name')}")
        print(f"  short_name: {manifest.get('short_name')}")
        print(f"  display: {manifest.get('display')}")
        
        # Step 5: Check /sw.js
        print("\n[5] Checking /sw.js...")
        resp = requests.get(f"{base_url}/sw.js", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        content_type = resp.headers.get('content-type', '')
        # Accept various JS content types
        assert any(t in content_type.lower() for t in ['javascript', 'text/plain']), \
            f"Content-Type should be JavaScript, got {content_type}"
        body = resp.text
        assert 'aurela-v1' in body, "Service worker should contain 'aurela-v1'"
        print("✓ Service worker valid")
        
        # Step 6: Check /icons/icon-192.png
        print("\n[6] Checking /icons/icon-192.png...")
        resp = requests.get(f"{base_url}/icons/icon-192.png", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        content_type = resp.headers.get('content-type', '')
        assert 'image/png' in content_type.lower(), \
            f"Content-Type should be image/png, got {content_type}"
        print("✓ icon-192.png exists")
        
        # Step 7: Check /icons/icon-512.png
        print("\n[7] Checking /icons/icon-512.png...")
        resp = requests.get(f"{base_url}/icons/icon-512.png", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        content_type = resp.headers.get('content-type', '')
        assert 'image/png' in content_type.lower(), \
            f"Content-Type should be image/png, got {content_type}"
        print("✓ icon-512.png exists")
        
        print("\n✅ FEATURE 4 PASSED: PWA manifest + APK URL config working correctly")
        return True
        
    except AssertionError as e:
        print(f"\n❌ FEATURE 4 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ FEATURE 4 ERROR: {e}")
        return False


def test_regression_sanity():
    """
    REGRESSION SANITY
    Quick checks that basic endpoints still work
    """
    print("\n" + "="*80)
    print("REGRESSION SANITY")
    print("="*80)
    
    all_passed = True
    
    # Test 1: Health
    try:
        print("\n[1] GET /api/health...")
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('ok') == True, "Should return ok:true"
        print("✅ Health endpoint working")
    except Exception as e:
        print(f"❌ Health endpoint failed: {e}")
        all_passed = False
    
    # Test 2: Admin login
    try:
        print("\n[2] Admin login...")
        admin_token = get_admin_token()
        assert admin_token, "Failed to get admin token"
        print("✅ Admin login working")
    except Exception as e:
        print(f"❌ Admin login failed: {e}")
        all_passed = False
    
    # Test 3: Rates
    try:
        print("\n[3] GET /api/rates...")
        resp = requests.get(f"{BASE_URL}/rates", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'crypto_usd' in data, "Should have crypto_usd"
        assert 'fx' in data, "Should have fx"
        assert 'aur' in data, "Should have aur"
        print("✅ Rates endpoint working")
    except Exception as e:
        print(f"❌ Rates endpoint failed: {e}")
        all_passed = False
    
    # Test 4: Wallets (authed)
    try:
        print("\n[4] GET /api/wallets (authed)...")
        admin_token = get_admin_token()
        resp = requests.get(
            f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'wallets' in data, "Should have wallets array"
        print("✅ Wallets endpoint working")
    except Exception as e:
        print(f"❌ Wallets endpoint failed: {e}")
        all_passed = False
    
    if all_passed:
        print("\n✅ ALL REGRESSION TESTS PASSED")
    else:
        print("\n❌ SOME REGRESSION TESTS FAILED")
    
    return all_passed


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("AURELA BACKEND TEST - 4 NEW FEATURES")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print("="*80)
    
    results = {}
    
    # Feature 1: Idempotent seed migrations
    result = test_feature_1_idempotent_seed()
    if result is not None:
        results["Feature 1 - Idempotent seed migrations"] = result
    else:
        print("\n⚠️  Feature 1 skipped (OTP flow disabled)")
    
    # Feature 2: Auto chain simulation
    results["Feature 2 - Auto chain simulation"] = test_feature_2_auto_chain_simulation()
    
    # Feature 3: Per-user card fee overrides
    result = test_feature_3_per_user_card_fees()
    if result is not None:
        results["Feature 3 - Per-user card fee overrides"] = result
    else:
        print("\n⚠️  Feature 3 skipped (OTP flow disabled)")
    
    # Feature 4: PWA manifest + APK URL
    results["Feature 4 - PWA manifest + APK URL"] = test_feature_4_pwa_manifest_apk()
    
    # Regression sanity
    results["Regression sanity"] = test_regression_sanity()
    
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
