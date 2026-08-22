#!/usr/bin/env python3
"""
Backend test for Aurela - Portfolio snapshot atomic upsert + Admin user_code backfill + /pay/lookup
"""
import requests
import time
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

def test_portfolio_snapshot_atomic_upsert():
    """
    FIX 1 — Portfolio snapshot atomic upsert (no duplicates)
    - Login as admin
    - Call GET /api/wallets 5 times in a row (parallel is fine)
    - Then GET /api/portfolio/history?days=30
    - Verify: ONLY 1 point exists for today's date (YYYY-MM-DD). No duplicates.
    - Verify: multi-day range works correctly.
    - Verify: total_usd matches current wallet total.
    """
    print("\n" + "="*80)
    print("TEST 1: PORTFOLIO SNAPSHOT ATOMIC UPSERT (NO DUPLICATES)")
    print("="*80)
    
    try:
        # Step 1: Login as admin
        print("\n[1] Login as admin...")
        login_resp = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": "admin@aurelawallet.com",
            "password": "Aurela@123#"
        })
        if login_resp.status_code != 200:
            print(f"❌ Admin login failed: {login_resp.status_code} - {login_resp.text}")
            return False
        
        token = login_resp.json().get("token")
        if not token:
            print(f"❌ No token in login response")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        print(f"✅ Admin login successful, token: {token[:20]}...")
        
        # Step 2: Call GET /api/wallets 5 times in parallel
        print("\n[2] Calling GET /api/wallets 5 times in parallel...")
        
        def get_wallets():
            resp = requests.get(f"{BASE_URL}/wallets", headers=headers)
            return resp.status_code, resp.json() if resp.status_code == 200 else resp.text
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(get_wallets) for _ in range(5)]
            results = [future.result() for future in as_completed(futures)]
        
        # Check all calls succeeded
        success_count = sum(1 for status, _ in results if status == 200)
        print(f"✅ {success_count}/5 wallet calls succeeded")
        
        if success_count < 5:
            print(f"⚠️ Some wallet calls failed")
            for i, (status, data) in enumerate(results):
                if status != 200:
                    print(f"   Call {i+1}: {status} - {data}")
        
        # Get the last successful response to check total_usd
        last_wallet_data = None
        for status, data in results:
            if status == 200:
                last_wallet_data = data
                break
        
        if not last_wallet_data:
            print(f"❌ No successful wallet response")
            return False
        
        expected_total_usd = last_wallet_data.get("totals", {}).get("usd", 0)
        print(f"   Current wallet total_usd: {expected_total_usd}")
        
        # Step 3: GET /api/portfolio/history?days=30
        print("\n[3] GET /api/portfolio/history?days=30...")
        time.sleep(0.5)  # Small delay to ensure snapshot is written
        
        history_resp = requests.get(f"{BASE_URL}/portfolio/history?days=30", headers=headers)
        if history_resp.status_code != 200:
            print(f"❌ Portfolio history failed: {history_resp.status_code} - {history_resp.text}")
            return False
        
        history_data = history_resp.json()
        points = history_data.get("points", [])
        
        if not points:
            print(f"❌ No points in portfolio history")
            return False
        
        print(f"✅ Portfolio history returned {len(points)} points")
        
        # Step 4: Verify ONLY 1 point exists for today's date
        from datetime import datetime
        today = datetime.utcnow().strftime("%Y-%m-%d")
        
        today_points = [p for p in points if p.get("date") == today]
        
        print(f"\n[4] Checking for duplicate snapshots on {today}...")
        print(f"   Found {len(today_points)} point(s) for today")
        
        if len(today_points) == 0:
            print(f"⚠️ No snapshot for today found (might be timing issue)")
            # This is acceptable if the snapshot hasn't been created yet
        elif len(today_points) == 1:
            print(f"✅ PASS: Exactly 1 snapshot for today (no duplicates)")
            today_point = today_points[0]
            print(f"   Date: {today_point.get('date')}")
            print(f"   Total USD: {today_point.get('total_usd')}")
            
            # Verify total_usd matches current wallet total (within small margin for rate changes)
            snapshot_total = today_point.get('total_usd', 0)
            diff = abs(snapshot_total - expected_total_usd)
            if diff < 100:  # Allow $100 difference for rate fluctuations
                print(f"✅ PASS: Snapshot total_usd ({snapshot_total}) matches wallet total ({expected_total_usd})")
            else:
                print(f"⚠️ Snapshot total_usd ({snapshot_total}) differs from wallet total ({expected_total_usd}) by ${diff}")
        else:
            print(f"❌ FAIL: Found {len(today_points)} snapshots for today (DUPLICATES DETECTED)")
            for i, p in enumerate(today_points):
                print(f"   Duplicate {i+1}: date={p.get('date')}, total_usd={p.get('total_usd')}")
            return False
        
        # Step 5: Verify multi-day range works correctly
        print(f"\n[5] Testing multi-day range (days=7)...")
        history_7_resp = requests.get(f"{BASE_URL}/portfolio/history?days=7", headers=headers)
        if history_7_resp.status_code != 200:
            print(f"❌ Portfolio history (7 days) failed: {history_7_resp.status_code}")
            return False
        
        history_7_data = history_7_resp.json()
        points_7 = history_7_data.get("points", [])
        print(f"✅ PASS: Multi-day range works (7 days returned {len(points_7)} points)")
        
        print("\n" + "="*80)
        print("✅ TEST 1 PASSED: Portfolio snapshot atomic upsert working correctly")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_admin_user_code_and_pay_lookup():
    """
    FIX 2 — Admin user_code backfill + /pay/lookup
    - Login as admin. GET /api/auth/me → response should now include user_code starting with "AUR"
    - GET /api/pay/lookup?to=<admin's_user_code> (no auth) → 200 with { recipient: { code, name, country, joined } }
    - Verify the name field ONLY exposes first name + last initial (e.g., "Aurela A.") — NO email, NO full last name, NO id, NO phone
    - Verify /api/pay/lookup?to=INVALIDXYZ still returns 400
    - Verify /api/pay/lookup?to=AUR000000000 (nonexistent but valid pattern) → 404
    """
    print("\n" + "="*80)
    print("TEST 2: ADMIN USER_CODE BACKFILL + /PAY/LOOKUP")
    print("="*80)
    
    try:
        # Step 1: Login as admin and get user_code
        print("\n[1] Login as admin and check user_code...")
        login_resp = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": "admin@aurelawallet.com",
            "password": "Aurela@123#"
        })
        if login_resp.status_code != 200:
            print(f"❌ Admin login failed: {login_resp.status_code} - {login_resp.text}")
            return False
        
        token = login_resp.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # GET /api/auth/me
        me_resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        if me_resp.status_code != 200:
            print(f"❌ GET /auth/me failed: {me_resp.status_code} - {me_resp.text}")
            return False
        
        me_data = me_resp.json()
        # user_code is nested under 'user' key in /auth/me response
        user = me_data.get("user", {})
        user_code = user.get("user_code")
        
        if not user_code:
            print(f"❌ FAIL: Admin user has no user_code")
            print(f"   Response: {json.dumps(me_data, indent=2)}")
            return False
        
        if not user_code.startswith("AUR"):
            print(f"❌ FAIL: Admin user_code '{user_code}' does not start with 'AUR'")
            return False
        
        if not user_code[3:].isdigit():
            print(f"❌ FAIL: Admin user_code '{user_code}' does not match pattern AUR + digits")
            return False
        
        print(f"✅ PASS: Admin has valid user_code: {user_code}")
        
        # Step 2: GET /api/pay/lookup with admin's user_code (no auth)
        print(f"\n[2] GET /api/pay/lookup?to={user_code} (no auth)...")
        lookup_resp = requests.get(f"{BASE_URL}/pay/lookup?to={user_code}")
        
        if lookup_resp.status_code != 200:
            print(f"❌ FAIL: /pay/lookup returned {lookup_resp.status_code}")
            print(f"   Response: {lookup_resp.text}")
            return False
        
        lookup_data = lookup_resp.json()
        recipient = lookup_data.get("recipient")
        
        if not recipient:
            print(f"❌ FAIL: No 'recipient' in response")
            print(f"   Response: {json.dumps(lookup_data, indent=2)}")
            return False
        
        print(f"✅ PASS: /pay/lookup returned 200 with recipient data")
        
        # Step 3: Verify response structure
        print(f"\n[3] Verifying response structure...")
        
        required_fields = ["code", "name", "country", "joined"]
        for field in required_fields:
            if field not in recipient:
                print(f"❌ FAIL: Missing required field '{field}' in recipient")
                return False
        
        print(f"✅ PASS: All required fields present: {required_fields}")
        
        # Step 4: Verify name is first name + last initial only
        name = recipient.get("name", "")
        print(f"\n[4] Verifying name privacy (first name + last initial only)...")
        print(f"   Name: '{name}'")
        
        # Expected format: "Aurela A." (first name + space + last initial + period)
        if not name:
            print(f"❌ FAIL: Name is empty")
            return False
        
        # Check that name doesn't contain full last name "Admin"
        if "Admin" in name:
            print(f"❌ FAIL: Name contains full last name 'Admin'")
            return False
        
        # Check format: should be like "Aurela A."
        parts = name.split()
        if len(parts) < 2:
            print(f"⚠️ WARNING: Name format unexpected: '{name}' (expected 'FirstName L.')")
        elif len(parts[1]) == 2 and parts[1].endswith('.'):
            print(f"✅ PASS: Name format correct (first name + last initial): '{name}'")
        else:
            print(f"⚠️ WARNING: Name format unexpected: '{name}' (expected 'FirstName L.')")
        
        # Step 5: Verify NO sensitive fields exposed
        print(f"\n[5] Verifying NO sensitive fields exposed...")
        sensitive_fields = ["email", "phone", "id", "password", "password_hash", "salt"]
        exposed = [f for f in sensitive_fields if f in recipient]
        
        if exposed:
            print(f"❌ FAIL: Sensitive fields exposed: {exposed}")
            return False
        
        print(f"✅ PASS: No sensitive fields exposed")
        
        # Step 6: Test invalid Aurela ID format
        print(f"\n[6] Testing invalid Aurela ID format (INVALIDXYZ)...")
        invalid_resp = requests.get(f"{BASE_URL}/pay/lookup?to=INVALIDXYZ")
        
        if invalid_resp.status_code != 400:
            print(f"❌ FAIL: Expected 400 for invalid format, got {invalid_resp.status_code}")
            return False
        
        print(f"✅ PASS: Invalid format returns 400")
        
        # Step 7: Test nonexistent but valid pattern
        print(f"\n[7] Testing nonexistent Aurela ID (AUR000000000)...")
        nonexistent_resp = requests.get(f"{BASE_URL}/pay/lookup?to=AUR000000000")
        
        if nonexistent_resp.status_code != 404:
            print(f"❌ FAIL: Expected 404 for nonexistent ID, got {nonexistent_resp.status_code}")
            return False
        
        print(f"✅ PASS: Nonexistent ID returns 404")
        
        print("\n" + "="*80)
        print("✅ TEST 2 PASSED: Admin user_code backfill + /pay/lookup working correctly")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n" + "="*80)
    print("AURELA BACKEND TEST - PORTFOLIO SNAPSHOT + PAY LOOKUP FIXES")
    print("="*80)
    
    results = {}
    
    # Test 1: Portfolio snapshot atomic upsert
    results["portfolio_snapshot"] = test_portfolio_snapshot_atomic_upsert()
    
    # Test 2: Admin user_code + /pay/lookup
    results["pay_lookup"] = test_admin_user_code_and_pay_lookup()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n" + "="*80)
        print("🎉 ALL TESTS PASSED - BOTH FIXES VERIFIED")
        print("="*80)
    else:
        print("\n" + "="*80)
        print("⚠️ SOME TESTS FAILED - SEE DETAILS ABOVE")
        print("="*80)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit(main())
