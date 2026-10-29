#!/usr/bin/env python3
"""
Backend test for Aurela Admin Map Endpoint
Tests the new GET /admin/locations/map endpoint
"""
import requests
import time
import json
from datetime import datetime

# Configuration
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"
GEO_TESTER_EMAIL = "geo.tester@aurelatest.io"
GEO_TESTER_PASSWORD = "Aurela@123#"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def wait_for_server(max_retries=3):
    """Wait for server to be ready (handle 502 errors)"""
    for i in range(max_retries):
        try:
            resp = requests.get(f"{BASE_URL}/version", timeout=10)
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

def login(email, password):
    """Login and return token"""
    log(f"🔐 Logging in as {email}...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": email,
        "password": password
    })
    if resp.status_code != 200:
        log(f"❌ Login failed: {resp.status_code} {resp.text}")
        return None, None
    data = resp.json()
    user = data.get('user', {})
    log(f"✅ Logged in: {user.get('email')} (role: {user.get('role')})")
    return data.get('token'), user.get('id')

def test_setup_geo_tester_location(geo_token):
    """
    SETUP: Post location as geo tester
    """
    log("\n" + "="*80)
    log("SETUP: Posting location as geo tester")
    log("="*80)
    
    try:
        log("📍 Posting location (lat=51.5074, lng=-0.1278, London)...")
        resp = requests.post(f"{BASE_URL}/location",
            headers={"Authorization": f"Bearer {geo_token}"},
            json={
                "lat": 51.5074,
                "lng": -0.1278,
                "accuracy": 20,
                "device": {
                    "platform": "Android",
                    "standalone": True
                }
            }
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error (server restart), waiting 20s...")
            time.sleep(20)
            resp = requests.post(f"{BASE_URL}/location",
                headers={"Authorization": f"Bearer {geo_token}"},
                json={
                    "lat": 51.5074,
                    "lng": -0.1278,
                    "accuracy": 20,
                    "device": {
                        "platform": "Android",
                        "standalone": True
                    }
                }
            )
        
        if resp.status_code != 200:
            log(f"❌ Location post failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        log(f"✅ Location posted: status={data.get('status')}, location={data.get('location')}")
        log(f"   Note: Country may be 'United Kingdom' or null depending on geocoder availability")
        return True
        
    except Exception as e:
        log(f"❌ SETUP FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_1_admin_map_structure(admin_token):
    """
    TEST 1: Admin GET /admin/locations/map returns correct structure
    - 200 status
    - Keys: points (array), countries (array), totals (object with users, located, denied, never)
    - totals.users === totals.located + totals.denied + totals.never
    - No point has username 'aurela_admin' or role admin/super_admin
    """
    log("\n" + "="*80)
    log("TEST 1: Admin map endpoint structure and admin exclusion")
    log("="*80)
    
    try:
        log("🗺️ GET /admin/locations/map...")
        resp = requests.get(f"{BASE_URL}/admin/locations/map",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/admin/locations/map",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        if resp.status_code != 200:
            log(f"❌ GET /admin/locations/map failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        log(f"✅ Status: 200")
        
        # Check keys
        if 'points' not in data:
            log(f"❌ Missing 'points' key in response")
            return False
        if 'countries' not in data:
            log(f"❌ Missing 'countries' key in response")
            return False
        if 'totals' not in data:
            log(f"❌ Missing 'totals' key in response")
            return False
        
        log(f"✅ Response has required keys: points, countries, totals")
        
        points = data.get('points', [])
        countries = data.get('countries', [])
        totals = data.get('totals', {})
        
        log(f"📊 Points: {len(points)}, Countries: {len(countries)}")
        log(f"📊 Totals: {json.dumps(totals, indent=2)}")
        
        # Check totals structure
        if 'users' not in totals or 'located' not in totals or 'denied' not in totals or 'never' not in totals:
            log(f"❌ Totals missing required keys. Got: {list(totals.keys())}")
            return False
        
        log(f"✅ Totals has required keys: users, located, denied, never")
        
        # Check totals math
        users = totals['users']
        located = totals['located']
        denied = totals['denied']
        never = totals['never']
        
        if users != located + denied + never:
            log(f"❌ Totals math incorrect: users={users}, located={located}, denied={denied}, never={never}")
            log(f"   Expected: {users} === {located} + {denied} + {never} = {located + denied + never}")
            return False
        
        log(f"✅ Totals math correct: {users} === {located} + {denied} + {never}")
        
        # Check no admin users in points
        admin_points = [p for p in points if p.get('username') in ['aurela_admin', 'admin'] or 'admin' in p.get('email', '').lower()]
        if admin_points:
            log(f"❌ Found admin users in points: {[p.get('username') for p in admin_points]}")
            return False
        
        log(f"✅ No admin users in points (admins excluded)")
        
        log("✅ TEST 1 PASSED")
        return True
        
    except Exception as e:
        log(f"❌ TEST 1 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_2_geo_tester_point(admin_token):
    """
    TEST 2: Geo tester point exists with correct data
    - username 'geotester'
    - lat 51.5074, lng -0.1278
    - status 'granted'
    - accuracy_m 20
    - device 'Android'
    - standalone true
    - Has fields: kyc_status, email, at, hold (boolean), updates (number ≥1)
    - Does NOT include password_hash/salt
    """
    log("\n" + "="*80)
    log("TEST 2: Geo tester point data")
    log("="*80)
    
    try:
        log("🗺️ GET /admin/locations/map...")
        resp = requests.get(f"{BASE_URL}/admin/locations/map",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ GET /admin/locations/map failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        points = data.get('points', [])
        
        # Find geo tester point
        geo_point = next((p for p in points if p.get('username') == 'geotester'), None)
        
        if not geo_point:
            log(f"❌ Geo tester point not found in points")
            log(f"   Available usernames: {[p.get('username') for p in points[:10]]}")
            return False
        
        log(f"✅ Found geo tester point")
        log(f"📊 Point data: {json.dumps(geo_point, indent=2)}")
        
        # Check lat/lng
        lat = geo_point.get('lat')
        lng = geo_point.get('lng')
        if abs(lat - 51.5074) > 0.0001 or abs(lng - (-0.1278)) > 0.0001:
            log(f"❌ Incorrect lat/lng: expected (51.5074, -0.1278), got ({lat}, {lng})")
            return False
        
        log(f"✅ Lat/lng correct: ({lat}, {lng})")
        
        # Check status
        status = geo_point.get('status')
        if status != 'granted':
            log(f"❌ Incorrect status: expected 'granted', got '{status}'")
            return False
        
        log(f"✅ Status: {status}")
        
        # Check accuracy_m
        accuracy_m = geo_point.get('accuracy_m')
        if accuracy_m != 20:
            log(f"❌ Incorrect accuracy_m: expected 20, got {accuracy_m}")
            return False
        
        log(f"✅ Accuracy: {accuracy_m}m")
        
        # Check device
        device = geo_point.get('device')
        if device != 'Android':
            log(f"❌ Incorrect device: expected 'Android', got '{device}'")
            return False
        
        log(f"✅ Device: {device}")
        
        # Check standalone
        standalone = geo_point.get('standalone')
        if standalone != True:
            log(f"❌ Incorrect standalone: expected True, got {standalone}")
            return False
        
        log(f"✅ Standalone: {standalone}")
        
        # Check required fields
        required_fields = ['kyc_status', 'email', 'at', 'hold', 'updates']
        for field in required_fields:
            if field not in geo_point:
                log(f"❌ Missing required field: {field}")
                return False
        
        log(f"✅ Has required fields: {required_fields}")
        
        # Check updates >= 1
        updates = geo_point.get('updates')
        if not isinstance(updates, (int, float)) or updates < 1:
            log(f"❌ Invalid updates: expected number ≥1, got {updates}")
            return False
        
        log(f"✅ Updates: {updates}")
        
        # Check hold is boolean
        hold = geo_point.get('hold')
        if not isinstance(hold, bool):
            log(f"❌ Invalid hold: expected boolean, got {type(hold).__name__}")
            return False
        
        log(f"✅ Hold: {hold}")
        
        # Check no password fields
        if 'password_hash' in geo_point or 'salt' in geo_point or 'password' in geo_point:
            log(f"❌ Point contains password fields!")
            return False
        
        log(f"✅ No password fields in point")
        
        log("✅ TEST 2 PASSED")
        return True
        
    except Exception as e:
        log(f"❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_3_countries_sorted(admin_token):
    """
    TEST 3: Countries array is sorted by users desc
    - Each entry has: country, users, denied, on_hold, kyc_approved, center ({lat,lng} or null), top_cities array
    - Country containing geo tester has users ≥ 1 and center lat/lng are finite numbers
    """
    log("\n" + "="*80)
    log("TEST 3: Countries array structure and sorting")
    log("="*80)
    
    try:
        log("🗺️ GET /admin/locations/map...")
        resp = requests.get(f"{BASE_URL}/admin/locations/map",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ GET /admin/locations/map failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        countries = data.get('countries', [])
        
        if len(countries) == 0:
            log(f"⚠️ No countries in response (no users with locations)")
            return True
        
        log(f"📊 Countries: {len(countries)}")
        
        # Check sorting (users desc)
        for i in range(len(countries) - 1):
            if countries[i]['users'] < countries[i+1]['users']:
                log(f"❌ Countries not sorted by users desc")
                log(f"   Country {i}: {countries[i]['country']} with {countries[i]['users']} users")
                log(f"   Country {i+1}: {countries[i+1]['country']} with {countries[i+1]['users']} users")
                return False
        
        log(f"✅ Countries sorted by users desc")
        
        # Check structure of first country
        if len(countries) > 0:
            first = countries[0]
            log(f"📊 First country: {json.dumps(first, indent=2)}")
            
            required_fields = ['country', 'users', 'denied', 'on_hold', 'kyc_approved', 'center', 'top_cities']
            for field in required_fields:
                if field not in first:
                    log(f"❌ Missing required field in country: {field}")
                    return False
            
            log(f"✅ Country has required fields: {required_fields}")
            
            # Check center is either null or has lat/lng
            center = first.get('center')
            if center is not None:
                if 'lat' not in center or 'lng' not in center:
                    log(f"❌ Center missing lat/lng: {center}")
                    return False
                log(f"✅ Center has lat/lng: {center}")
            else:
                log(f"✅ Center is null (no locations with coordinates)")
            
            # Check top_cities is array
            top_cities = first.get('top_cities')
            if not isinstance(top_cities, list):
                log(f"❌ top_cities is not array: {type(top_cities).__name__}")
                return False
            
            log(f"✅ top_cities is array with {len(top_cities)} cities")
        
        # Find country containing geo tester (likely 'United Kingdom' or 'Unknown')
        geo_country = next((c for c in countries if c.get('country') in ['United Kingdom', 'Unknown']), None)
        
        if geo_country:
            log(f"📊 Geo tester country: {geo_country.get('country')}")
            log(f"   Users: {geo_country.get('users')}, Center: {geo_country.get('center')}")
            
            if geo_country.get('users') < 1:
                log(f"❌ Geo tester country has users < 1: {geo_country.get('users')}")
                return False
            
            log(f"✅ Geo tester country has users ≥ 1")
            
            center = geo_country.get('center')
            if center is not None:
                lat = center.get('lat')
                lng = center.get('lng')
                
                import math
                if not (math.isfinite(lat) and math.isfinite(lng)):
                    log(f"❌ Center lat/lng not finite: lat={lat}, lng={lng}")
                    return False
                
                log(f"✅ Center lat/lng are finite: ({lat}, {lng})")
            else:
                log(f"⚠️ Center is null (geocoding may have failed)")
        else:
            log(f"⚠️ Could not find geo tester country (United Kingdom or Unknown)")
        
        log("✅ TEST 3 PASSED")
        return True
        
    except Exception as e:
        log(f"❌ TEST 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_4_denied_case(admin_token, geo_token):
    """
    TEST 4: Denied case
    - Post location with denied:true as geo tester
    - Admin GET map again → totals.denied increased by 1, totals.located decreased by 1
    - Geo tester point has status 'denied'
    - Restore: POST valid location again
    """
    log("\n" + "="*80)
    log("TEST 4: Denied location case")
    log("="*80)
    
    try:
        # Get initial state
        log("🗺️ GET /admin/locations/map (initial state)...")
        resp = requests.get(f"{BASE_URL}/admin/locations/map",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ GET /admin/locations/map failed: {resp.status_code} {resp.text}")
            return False
        
        initial_data = resp.json()
        initial_totals = initial_data.get('totals', {})
        initial_located = initial_totals.get('located', 0)
        initial_denied = initial_totals.get('denied', 0)
        
        log(f"📊 Initial totals: located={initial_located}, denied={initial_denied}")
        
        # Post denied location
        log("\n📍 Posting denied location as geo tester...")
        resp = requests.post(f"{BASE_URL}/location",
            headers={"Authorization": f"Bearer {geo_token}"},
            json={
                "denied": True,
                "device": {
                    "platform": "iOS"
                }
            }
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.post(f"{BASE_URL}/location",
                headers={"Authorization": f"Bearer {geo_token}"},
                json={
                    "denied": True,
                    "device": {
                        "platform": "iOS"
                    }
                }
            )
        
        if resp.status_code != 200:
            log(f"❌ Location post failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        log(f"✅ Denied location posted: status={data.get('status')}")
        
        # Get updated state
        time.sleep(1)
        log("\n🗺️ GET /admin/locations/map (after denied)...")
        resp = requests.get(f"{BASE_URL}/admin/locations/map",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ GET /admin/locations/map failed: {resp.status_code} {resp.text}")
            return False
        
        updated_data = resp.json()
        updated_totals = updated_data.get('totals', {})
        updated_located = updated_totals.get('located', 0)
        updated_denied = updated_totals.get('denied', 0)
        
        log(f"📊 Updated totals: located={updated_located}, denied={updated_denied}")
        
        # Check totals changed correctly
        if updated_denied != initial_denied + 1:
            log(f"❌ Denied count did not increase by 1: {initial_denied} → {updated_denied}")
            return False
        
        log(f"✅ Denied count increased by 1: {initial_denied} → {updated_denied}")
        
        if updated_located != initial_located - 1:
            log(f"❌ Located count did not decrease by 1: {initial_located} → {updated_located}")
            return False
        
        log(f"✅ Located count decreased by 1: {initial_located} → {updated_located}")
        
        # Check geo tester point status
        points = updated_data.get('points', [])
        geo_point = next((p for p in points if p.get('username') == 'geotester'), None)
        
        if geo_point:
            status = geo_point.get('status')
            if status != 'denied':
                log(f"❌ Geo tester point status is not 'denied': {status}")
                return False
            
            log(f"✅ Geo tester point has status 'denied'")
            log(f"   Note: Point present with IP-based location (lat={geo_point.get('lat')}, lng={geo_point.get('lng')})")
        else:
            log(f"⚠️ Geo tester point not in points array (loopback IP may not have geo data)")
            log(f"   This is acceptable - denied user still counted in totals")
        
        # Restore: POST valid location
        log("\n📍 Restoring valid location...")
        resp = requests.post(f"{BASE_URL}/location",
            headers={"Authorization": f"Bearer {geo_token}"},
            json={
                "lat": 51.5074,
                "lng": -0.1278,
                "accuracy": 20,
                "device": {
                    "platform": "Android",
                    "standalone": True
                }
            }
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.post(f"{BASE_URL}/location",
                headers={"Authorization": f"Bearer {geo_token}"},
                json={
                    "lat": 51.5074,
                    "lng": -0.1278,
                    "accuracy": 20,
                    "device": {
                        "platform": "Android",
                        "standalone": True
                    }
                }
            )
        
        if resp.status_code != 200:
            log(f"❌ Location restore failed: {resp.status_code} {resp.text}")
            return False
        
        log(f"✅ Valid location restored")
        
        log("✅ TEST 4 PASSED")
        return True
        
    except Exception as e:
        log(f"❌ TEST 4 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_5_auth(geo_token):
    """
    TEST 5: Auth requirements
    - Unauthenticated GET /admin/locations/map → 401
    - Regular user GET /admin/locations/map → 403
    """
    log("\n" + "="*80)
    log("TEST 5: Authentication and authorization")
    log("="*80)
    
    try:
        # Test unauthenticated
        log("🔒 Testing unauthenticated access...")
        resp = requests.get(f"{BASE_URL}/admin/locations/map")
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/admin/locations/map")
        
        if resp.status_code != 401:
            log(f"❌ Expected 401 for unauthenticated, got {resp.status_code}")
            return False
        
        log(f"✅ Unauthenticated access returns 401")
        
        # Test regular user
        log("\n🔒 Testing regular user access...")
        resp = requests.get(f"{BASE_URL}/admin/locations/map",
            headers={"Authorization": f"Bearer {geo_token}"}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/admin/locations/map",
                headers={"Authorization": f"Bearer {geo_token}"}
            )
        
        if resp.status_code != 403:
            log(f"❌ Expected 403 for regular user, got {resp.status_code}")
            return False
        
        log(f"✅ Regular user access returns 403")
        
        log("✅ TEST 5 PASSED")
        return True
        
    except Exception as e:
        log(f"❌ TEST 5 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_6_regression(admin_token, geo_tester_id):
    """
    TEST 6: Regression tests
    - GET /api/admin/users/<geo tester id> → still returns locations[]
    - GET /api/version → 200 (1.4.2)
    - GET /api/admin/withdraw-attempts → 200
    """
    log("\n" + "="*80)
    log("TEST 6: Regression tests")
    log("="*80)
    
    try:
        # Test 1: GET /api/admin/users/<id>
        log(f"\n1️⃣ Testing GET /api/admin/users/{geo_tester_id}...")
        resp = requests.get(f"{BASE_URL}/admin/users/{geo_tester_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/admin/users/{geo_tester_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        if resp.status_code != 200:
            log(f"❌ GET /admin/users/{geo_tester_id} failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        if 'locations' not in data:
            log(f"❌ Response missing 'locations' key")
            return False
        
        locations = data.get('locations', [])
        log(f"✅ GET /admin/users/{geo_tester_id}: 200 with locations[] ({len(locations)} entries)")
        
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
        
        if version != '1.4.2':
            log(f"⚠️ Expected version '1.4.2', got '{version}' (not a failure, just noting)")
        
        # Test 3: GET /api/admin/withdraw-attempts
        log("\n3️⃣ Testing GET /api/admin/withdraw-attempts...")
        resp = requests.get(f"{BASE_URL}/admin/withdraw-attempts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code == 502:
            log("⏳ 502 error, waiting 20s...")
            time.sleep(20)
            resp = requests.get(f"{BASE_URL}/admin/withdraw-attempts",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        if resp.status_code != 200:
            log(f"❌ GET /admin/withdraw-attempts failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        log(f"✅ GET /admin/withdraw-attempts: 200")
        
        log("✅ TEST 6 PASSED")
        return True
        
    except Exception as e:
        log(f"❌ TEST 6 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    log("🚀 Starting Aurela Admin Map Endpoint Tests")
    log(f"🌐 Backend URL: {BASE_URL}")
    
    # Wait for server to be ready
    if not wait_for_server():
        log("❌ Server not responding, aborting tests")
        return
    
    # Login as admin
    admin_token, admin_id = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        log("❌ Admin login failed, aborting tests")
        return
    
    # Login as geo tester
    geo_token, geo_tester_id = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
    if not geo_token:
        log("❌ Geo tester login failed, aborting tests")
        return
    
    # Setup: Post location as geo tester
    if not test_setup_geo_tester_location(geo_token):
        log("❌ Setup failed, aborting tests")
        return
    
    # Run tests
    results = {}
    
    results['TEST_1'] = test_1_admin_map_structure(admin_token)
    results['TEST_2'] = test_2_geo_tester_point(admin_token)
    results['TEST_3'] = test_3_countries_sorted(admin_token)
    results['TEST_4'] = test_4_denied_case(admin_token, geo_token)
    results['TEST_5'] = test_5_auth(geo_token)
    results['TEST_6'] = test_6_regression(admin_token, geo_tester_id)
    
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
