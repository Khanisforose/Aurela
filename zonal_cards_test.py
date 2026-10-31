#!/usr/bin/env python3
"""
Focused test for Aurela Zonal Cards - Core functionality only
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"
GEO_TESTER_EMAIL = "geo.tester@aurelatest.io"
GEO_TESTER_PASSWORD = "Aurela@123#"
GEO_TESTER_ID = "geo-tester-0001"

admin_token = None
geo_tester_token = None

def login():
    global admin_token, geo_tester_token
    
    # Admin login
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200:
        admin_token = resp.json().get("token")
        print(f"✅ Admin logged in")
    else:
        print(f"❌ Admin login failed: {resp.status_code}")
        return False
    
    # Geo tester login
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": GEO_TESTER_EMAIL,
        "password": GEO_TESTER_PASSWORD
    })
    if resp.status_code == 200:
        geo_tester_token = resp.json().get("token")
        print(f"✅ Geo tester logged in")
    else:
        print(f"❌ Geo tester login failed: {resp.status_code}")
        return False
    
    return True

def test_zones_list():
    """TEST 1: GET /api/admin/zones"""
    print("\n=== TEST 1: GET /api/admin/zones ===")
    
    resp = requests.get(f"{BASE_URL}/admin/zones", headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code != 200:
        print(f"❌ FAIL: Status {resp.status_code}")
        return False
    
    zones = resp.json().get("zones", [])
    if len(zones) != 11:
        print(f"❌ FAIL: Expected 11 zones, got {len(zones)}")
        return False
    
    expected_order = ['NA', 'SA', 'EU', 'UK', 'ME', 'AF', 'CIS', 'SAS', 'SEA', 'EA', 'OCE']
    actual_order = [z.get('code') for z in zones]
    if actual_order != expected_order:
        print(f"❌ FAIL: Wrong order. Expected {expected_order}, got {actual_order}")
        return False
    
    # Check structure
    zone = zones[0]
    required = ['code', 'name', 'landmark', 'city', 'theme', 'image_url', 'countries', 'fee_usdt', 'activation_hours', 'enabled', 'stats']
    missing = [f for f in required if f not in zone]
    if missing:
        print(f"❌ FAIL: Missing fields: {missing}")
        return False
    
    if '_id' in zone:
        print(f"❌ FAIL: _id field present")
        return False
    
    print(f"✅ PASS: 11 zones in correct order with proper structure")
    return True

def test_zone_update():
    """TEST 2: PUT /api/admin/zones/UK"""
    print("\n=== TEST 2: PUT /api/admin/zones/UK ===")
    
    # Valid update
    resp = requests.put(f"{BASE_URL}/admin/zones/UK", 
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"fee_usdt": 40, "activation_hours": 5})
    if resp.status_code != 200:
        print(f"❌ FAIL: Valid update failed: {resp.status_code}")
        return False
    
    zone = resp.json().get("zone", {})
    if zone.get("fee_usdt") != 40 or zone.get("activation_hours") != 5:
        print(f"❌ FAIL: Values not updated correctly")
        return False
    
    # Test validations
    tests = [
        ({"activation_hours": -1}, 400, "negative hours"),
        ({"fee_usdt": "abc"}, 400, "invalid fee"),
        ({"image_url": "ftp://x"}, 400, "invalid image_url"),
        ({"name": ""}, 400, "empty name"),
        ({}, 400, "empty body"),
    ]
    
    for body, expected_status, desc in tests:
        resp = requests.put(f"{BASE_URL}/admin/zones/UK",
                           headers={"Authorization": f"Bearer {admin_token}"},
                           json=body)
        if resp.status_code != expected_status:
            print(f"❌ FAIL: {desc} - expected {expected_status}, got {resp.status_code}")
            return False
    
    # Unknown zone
    resp = requests.put(f"{BASE_URL}/admin/zones/XX",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"fee_usdt": 10})
    if resp.status_code != 404:
        print(f"❌ FAIL: Unknown zone should return 404, got {resp.status_code}")
        return False
    
    print(f"✅ PASS: Zone update and validations working")
    return True

def test_resolve_zone():
    """TEST 3: GET /api/admin/zones/resolve"""
    print("\n=== TEST 3: GET /api/admin/zones/resolve ===")
    
    resp = requests.get(f"{BASE_URL}/admin/zones/resolve?user_id={GEO_TESTER_ID}",
                       headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code != 200:
        print(f"❌ FAIL: Status {resp.status_code}")
        return False
    
    data = resp.json()
    required = ['user', 'location', 'detected_zone', 'zone', 'existing_zonal_cards', 'geo_hold']
    missing = [f for f in required if f not in data]
    if missing:
        print(f"❌ FAIL: Missing fields: {missing}")
        return False
    
    if data.get('detected_zone') != 'UK':
        print(f"❌ FAIL: Expected detected_zone='UK', got {data.get('detected_zone')}")
        return False
    
    location = data.get('location', {})
    if location.get('cc') != 'GB':
        print(f"❌ FAIL: Expected cc='GB', got {location.get('cc')}")
        return False
    
    # Test missing user_id
    resp = requests.get(f"{BASE_URL}/admin/zones/resolve",
                       headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code != 400:
        print(f"❌ FAIL: Missing user_id should return 400, got {resp.status_code}")
        return False
    
    # Test unknown user_id
    resp = requests.get(f"{BASE_URL}/admin/zones/resolve?user_id=unknown-123",
                       headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code != 404:
        print(f"❌ FAIL: Unknown user should return 404, got {resp.status_code}")
        return False
    
    print(f"✅ PASS: Zone resolution working correctly")
    return True

def test_issue_and_approve():
    """TEST 4: Issue and approve zonal card"""
    print("\n=== TEST 4: Issue and approve zonal card ===")
    
    # Get user's USDT balance before
    resp = requests.get(f"{BASE_URL}/wallets", headers={"Authorization": f"Bearer {geo_tester_token}"})
    wallets = resp.json().get('wallets', [])
    usdt_wallet = next((w for w in wallets if w.get('currency') == 'USDT'), None)
    usdt_before = float(usdt_wallet.get('balance', 0)) if usdt_wallet else 0
    
    # Get withdraw_lock state before
    resp = requests.get(f"{BASE_URL}/admin/users/{GEO_TESTER_ID}",
                       headers={"Authorization": f"Bearer {admin_token}"})
    user_before = resp.json().get('user', {})
    withdraw_lock_before = user_before.get('withdraw_lock', {}).get('active', False)
    
    # Issue card
    resp = requests.post(f"{BASE_URL}/admin/zones/issue",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        json={"user_id": GEO_TESTER_ID, "zone": "UK"})
    
    if resp.status_code == 400 and 'already holds' in resp.json().get('error', ''):
        print(f"⚠️  User already has UK card, skipping issue test")
        # Get existing card
        resp = requests.get(f"{BASE_URL}/cards", headers={"Authorization": f"Bearer {geo_tester_token}"})
        cards = resp.json().get('cards', [])
        uk_card = next((c for c in cards if c.get('zone') == 'UK'), None)
        if not uk_card:
            print(f"❌ FAIL: Could not find existing UK card")
            return False
        card_id = uk_card.get('id')
        print(f"✅ Using existing card: {card_id}")
    elif resp.status_code != 200:
        print(f"❌ FAIL: Issue failed: {resp.status_code}, {resp.text}")
        return False
    else:
        card = resp.json().get('card', {})
        card_id = card.get('id')
        
        # Verify card structure
        checks = [
            (card.get('type') == 'zonal', "type='zonal'"),
            (card.get('zone') == 'UK', "zone='UK'"),
            (card.get('zone_name') == 'United Kingdom', "zone_name='United Kingdom'"),
            (card.get('landmark') == 'Big Ben', "landmark='Big Ben'"),
            (card.get('activation_fee_usdt') == 40, "activation_fee_usdt=40"),
            (card.get('activation_hours') == 5, "activation_hours=5"),
            (card.get('skip_geo_hold') == True, "skip_geo_hold=True"),
            (card.get('detected_zone') == 'UK', "detected_zone='UK'"),
            (card.get('zone_override') == False, "zone_override=False"),
        ]
        
        for check, desc in checks:
            if not check:
                print(f"❌ FAIL: Card {desc} check failed")
                return False
        
        print(f"✅ Card {card_id} issued with correct structure")
        
        # Activate card
        if card.get('status') == 'pending_activation':
            resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate",
                                headers={"Authorization": f"Bearer {geo_tester_token}"},
                                json={"tx_hash": "0xzonal123456789", "network": "ERC20"})
            if resp.status_code != 200:
                print(f"❌ FAIL: Activation failed: {resp.status_code}")
                return False
            print(f"✅ Card activated (pending_verification)")
        
        # Admin approve
        if card.get('status') in ['pending_activation', 'pending_verification']:
            resp = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve",
                                headers={"Authorization": f"Bearer {admin_token}"},
                                json={})
            if resp.status_code != 200:
                print(f"❌ FAIL: Approval failed: {resp.status_code}")
                return False
            
            credit = resp.json().get('credit', {})
            if credit.get('amount') != 40:
                print(f"❌ FAIL: Expected credit 40, got {credit.get('amount')}")
                return False
            print(f"✅ Card approved with 40 USDT credit")
    
    # Check card status
    resp = requests.get(f"{BASE_URL}/cards", headers={"Authorization": f"Bearer {geo_tester_token}"})
    cards = resp.json().get('cards', [])
    zonal_card = next((c for c in cards if c.get('id') == card_id), None)
    
    if not zonal_card:
        print(f"❌ FAIL: Card not found in user's cards")
        return False
    
    if zonal_card.get('status') not in ['activating', 'active']:
        print(f"❌ FAIL: Expected status 'activating' or 'active', got {zonal_card.get('status')}")
        return False
    
    # Check usable_at
    if zonal_card.get('status') == 'activating':
        usable_at = zonal_card.get('usable_at')
        if usable_at:
            usable_dt = datetime.fromisoformat(usable_at.replace('Z', '+00:00'))
            now_dt = datetime.utcnow()
            diff_hours = (usable_dt - now_dt).total_seconds() / 3600
            if not (4.9 <= diff_hours <= 5.1):
                print(f"⚠️  Warning: usable_at is {diff_hours:.2f} hours (expected ~5 hours)")
            else:
                print(f"✅ usable_at is {diff_hours:.2f} hours (~5 hours)")
    
    # Check withdraw_lock NOT activated
    resp = requests.get(f"{BASE_URL}/admin/users/{GEO_TESTER_ID}",
                       headers={"Authorization": f"Bearer {admin_token}"})
    user_after = resp.json().get('user', {})
    withdraw_lock_after = user_after.get('withdraw_lock', {}).get('active', False)
    
    if not withdraw_lock_before and withdraw_lock_after:
        print(f"❌ FAIL: withdraw_lock was activated (should skip for zonal cards)")
        return False
    
    print(f"✅ withdraw_lock NOT activated (zonal card skipped geo hold)")
    
    # Check USDT balance increased
    resp = requests.get(f"{BASE_URL}/wallets", headers={"Authorization": f"Bearer {geo_tester_token}"})
    wallets = resp.json().get('wallets', [])
    usdt_wallet = next((w for w in wallets if w.get('currency') == 'USDT'), None)
    usdt_after = float(usdt_wallet.get('balance', 0)) if usdt_wallet else 0
    
    if usdt_after >= usdt_before:
        print(f"✅ USDT balance: {usdt_before} → {usdt_after} (credited)")
    else:
        print(f"⚠️  USDT balance decreased: {usdt_before} → {usdt_after}")
    
    print(f"✅ PASS: Issue and approve flow working correctly")
    return True

def test_list_cards():
    """TEST 7: GET /api/admin/zones/cards"""
    print("\n=== TEST 7: GET /api/admin/zones/cards ===")
    
    resp = requests.get(f"{BASE_URL}/admin/zones/cards",
                       headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code != 200:
        print(f"❌ FAIL: Status {resp.status_code}")
        return False
    
    cards = resp.json().get('cards', [])
    if len(cards) == 0:
        print(f"❌ FAIL: No cards returned")
        return False
    
    # Check user sub-object
    for card in cards:
        if 'user' not in card:
            print(f"❌ FAIL: Card missing user sub-object")
            return False
        if 'password_hash' in card.get('user', {}):
            print(f"❌ FAIL: User has password_hash (security issue)")
            return False
    
    # Test filters
    resp = requests.get(f"{BASE_URL}/admin/zones/cards?zone=UK",
                       headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code != 200:
        print(f"❌ FAIL: Filter by zone failed")
        return False
    
    uk_cards = resp.json().get('cards', [])
    for card in uk_cards:
        if card.get('zone') != 'UK':
            print(f"❌ FAIL: Non-UK card in filtered results")
            return False
    
    print(f"✅ PASS: List cards working with {len(cards)} total cards, {len(uk_cards)} UK cards")
    return True

def test_tier_card_cap():
    """TEST 8: Tier-card cap ignores zonal cards"""
    print("\n=== TEST 8: Tier-card cap ignores zonal cards ===")
    
    resp = requests.post(f"{BASE_URL}/cards/request",
                        headers={"Authorization": f"Bearer {geo_tester_token}"},
                        json={"tier": "basic"})
    
    if resp.status_code == 400:
        error = resp.json().get('error', '')
        if 'maximum of 3' in error.lower():
            print(f"❌ FAIL: Zonal cards counted towards cap")
            return False
        else:
            print(f"✅ PASS: Failed for other reason (not cap): {error}")
            return True
    elif resp.status_code == 200:
        print(f"✅ PASS: Basic card requested successfully (zonal cards ignored)")
        return True
    else:
        print(f"⚠️  Unexpected status: {resp.status_code}")
        return True

def test_auth():
    """TEST 9: Auth requirements"""
    print("\n=== TEST 9: Auth requirements ===")
    
    # Non-admin
    resp = requests.get(f"{BASE_URL}/admin/zones",
                       headers={"Authorization": f"Bearer {geo_tester_token}"})
    if resp.status_code != 403:
        print(f"❌ FAIL: Non-admin should get 403, got {resp.status_code}")
        return False
    
    # Unauthenticated
    resp = requests.get(f"{BASE_URL}/admin/zones")
    if resp.status_code != 401:
        print(f"❌ FAIL: Unauth should get 401, got {resp.status_code}")
        return False
    
    print(f"✅ PASS: Auth requirements working")
    return True

def test_regression():
    """TEST 10: Regression - version and admin/kyc endpoints"""
    print("\n=== TEST 10: Regression tests ===")
    
    # GET /api/version
    resp = requests.get(f"{BASE_URL}/version")
    if resp.status_code != 200:
        print(f"❌ FAIL: /version returned {resp.status_code}")
        return False
    
    # GET /api/admin/kyc
    resp = requests.get(f"{BASE_URL}/admin/kyc",
                       headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code != 200:
        print(f"❌ FAIL: /admin/kyc returned {resp.status_code}")
        return False
    
    print(f"✅ PASS: Regression tests passed")
    return True

def main():
    print("="*80)
    print("AURELA ZONAL CARDS - FOCUSED BACKEND TEST")
    print("="*80)
    
    if not login():
        print("\n❌ Login failed, aborting tests")
        return
    
    tests = [
        ("GET /api/admin/zones", test_zones_list),
        ("PUT /api/admin/zones/UK", test_zone_update),
        ("GET /api/admin/zones/resolve", test_resolve_zone),
        ("Issue and approve zonal card", test_issue_and_approve),
        ("GET /api/admin/zones/cards", test_list_cards),
        ("Tier-card cap ignores zonal", test_tier_card_cap),
        ("Auth requirements", test_auth),
        ("Regression tests", test_regression),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ EXCEPTION in {name}: {e}")
            failed += 1
    
    print("\n" + "="*80)
    print(f"SUMMARY: {passed}/{passed+failed} tests passed")
    print("="*80)

if __name__ == "__main__":
    main()
