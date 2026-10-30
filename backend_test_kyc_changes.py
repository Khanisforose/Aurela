#!/usr/bin/env python3
"""
Backend test for Aurela KYC validation, admin rejection with reason, and register/init hardening
Tests changes as per review request
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
            resp = requests.get(f"{BASE_URL}/version", timeout=10)
            if resp.status_code == 200:
                return True
            if resp.status_code == 502:
                log(f"⏳ Server restarting (502), waiting 3s... (attempt {i+1}/{max_retries})")
                time.sleep(3)
            else:
                return True
        except Exception as e:
            log(f"⏳ Connection error: {e}, waiting 3s... (attempt {i+1}/{max_retries})")
            time.sleep(3)
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

def create_fresh_user(suffix=""):
    """Create a fresh user and return (user_id, user_token, email)"""
    timestamp = int(time.time() * 1000)
    email = f"kyctest_{timestamp}{suffix}@test.com"
    password = "TestPass123!"
    
    log(f"📝 Creating user: {email}")
    
    # Step 1: Register init
    resp = requests.post(f"{BASE_URL}/auth/register/init", json={
        "first_name": "KYC",
        "last_name": "Tester",
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
            except Exception as e:
                log(f"❌ Error parsing OTP: {e}")
                return None, None, None
    
    # Step 2: Verify OTP
    time.sleep(0.5)
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
    return user_id, user_token, email

def test_1_kyc_validation():
    """
    TEST 1: KYC validation (as fresh user U1)
    """
    log("\n" + "="*80)
    log("TEST 1: KYC Validation")
    log("="*80)
    
    try:
        # Create fresh user U1
        user_id, user_token, email = create_fresh_user("_u1")
        if not user_id:
            log("❌ TEST 1 FAILED: Could not create user")
            return False
        
        # Test 1a: Empty body → 400 with missing array
        log("\n1a. Testing empty KYC submission...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={}
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        missing = data.get('missing', [])
        
        if not error.startswith('All fields are required'):
            log(f"❌ Expected error starting with 'All fields are required', got: {error}")
            return False
        
        if len(missing) != 15:
            log(f"❌ Expected 15 missing fields, got {len(missing)}: {missing}")
            return False
        
        log(f"✅ 1a PASS: Empty body → 400 with error '{error[:50]}...' and missing array with {len(missing)} items")
        
        # Test 1b: Missing selfie → 400
        log("\n1b. Testing KYC with all fields except selfie...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "first_name": "KYC",
                "last_name": "Tester",
                "dob": "1990-01-01",
                "country": "United States",
                "state": "California",
                "city": "Los Angeles",
                "address": "123 Test St",
                "postal_code": "90001",
                "mobile": "+15551234567",
                "occupation": "Engineer",
                "id_type": "passport",
                "id_number": "P12345678",
                "doc_front": "data:image/png;base64," + "A" * 2000,
                "doc_back": "data:image/png;base64," + "A" * 2000
                # selfie missing
            }
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        missing = data.get('missing', [])
        
        if 'Selfie holding document' not in missing:
            log(f"❌ Expected 'Selfie holding document' in missing, got: {missing}")
            return False
        
        log(f"✅ 1b PASS: Missing selfie → 400 with missing=['Selfie holding document']")
        
        # Test 1c: Whitespace state → 400
        log("\n1c. Testing KYC with whitespace-only state...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "first_name": "KYC",
                "last_name": "Tester",
                "dob": "1990-01-01",
                "country": "United States",
                "state": "   ",  # whitespace only
                "city": "Los Angeles",
                "address": "123 Test St",
                "postal_code": "90001",
                "mobile": "+15551234567",
                "occupation": "Engineer",
                "id_type": "passport",
                "id_number": "P12345678",
                "doc_front": "data:image/png;base64," + "A" * 2000,
                "doc_back": "data:image/png;base64," + "A" * 2000,
                "selfie": "data:image/png;base64," + "A" * 2000
            }
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        missing = data.get('missing', [])
        
        if 'State / Province' not in missing:
            log(f"❌ Expected 'State / Province' in missing, got: {missing}")
            return False
        
        log(f"✅ 1c PASS: Whitespace state → 400 with 'State / Province' in missing")
        
        # Test 1d: Future/invalid dob → 400
        log("\n1d. Testing KYC with future dob...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "first_name": "KYC",
                "last_name": "Tester",
                "dob": "2099-01-01",  # future date
                "country": "United States",
                "state": "California",
                "city": "Los Angeles",
                "address": "123 Test St",
                "postal_code": "90001",
                "mobile": "+15551234567",
                "occupation": "Engineer",
                "id_type": "passport",
                "id_number": "P12345678",
                "doc_front": "data:image/png;base64," + "A" * 2000,
                "doc_back": "data:image/png;base64," + "A" * 2000,
                "selfie": "data:image/png;base64," + "A" * 2000
            }
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        
        if 'valid date of birth' not in error:
            log(f"❌ Expected error about 'valid date of birth', got: {error}")
            return False
        
        log(f"✅ 1d PASS: Future dob → 400 'Please enter a valid date of birth'")
        
        # Test 1d2: Invalid dob format
        log("\n1d2. Testing KYC with invalid dob format...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "first_name": "KYC",
                "last_name": "Tester",
                "dob": "not-a-date",
                "country": "United States",
                "state": "California",
                "city": "Los Angeles",
                "address": "123 Test St",
                "postal_code": "90001",
                "mobile": "+15551234567",
                "occupation": "Engineer",
                "id_type": "passport",
                "id_number": "P12345678",
                "doc_front": "data:image/png;base64," + "A" * 2000,
                "doc_back": "data:image/png;base64," + "A" * 2000,
                "selfie": "data:image/png;base64," + "A" * 2000
            }
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        log(f"✅ 1d2 PASS: Invalid dob format → 400")
        
        # Test 1e: Invalid image URI → 400
        log("\n1e. Testing KYC with invalid doc_back (not data:image URI)...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "first_name": "KYC",
                "last_name": "Tester",
                "dob": "1990-01-01",
                "country": "United States",
                "state": "California",
                "city": "Los Angeles",
                "address": "123 Test St",
                "postal_code": "90001",
                "mobile": "+15551234567",
                "occupation": "Engineer",
                "id_type": "passport",
                "id_number": "P12345678",
                "doc_front": "data:image/png;base64," + "A" * 2000,
                "doc_back": "hello",  # invalid
                "selfie": "data:image/png;base64," + "A" * 2000
            }
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        
        if 'Document back' not in error:
            log(f"❌ Expected error mentioning 'Document back', got: {error}")
            return False
        
        log(f"✅ 1e PASS: Invalid doc_back → 400 mentioning 'Document back'")
        
        # Test 1f: Full valid payload → 200
        log("\n1f. Testing KYC with full valid payload...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "first_name": "KYC",
                "last_name": "Tester",
                "dob": "1990-01-01",
                "country": "United States",
                "state": "California",
                "city": "Los Angeles",
                "address": "123 Test St",
                "postal_code": "90001",
                "mobile": "+15551234567",
                "occupation": "Engineer",
                "id_type": "passport",
                "id_number": "P12345678",
                "doc_front": "data:image/png;base64," + "A" * 2000,
                "doc_back": "data:image/png;base64," + "A" * 2000,
                "selfie": "data:image/png;base64," + "A" * 2000
            }
        )
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        kyc = data.get('kyc', {})
        kyc_id = kyc.get('id')
        status = kyc.get('status')
        
        if status != 'pending':
            log(f"❌ Expected status='pending', got: {status}")
            return False
        
        log(f"✅ 1f PASS: Full valid payload → 200 with kyc.id={kyc_id}, status='pending'")
        
        # Verify user kyc_status and phone
        resp = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        user = resp.json().get('user', {})
        kyc_status = user.get('kyc_status')
        phone = user.get('phone')
        
        if kyc_status != 'pending':
            log(f"❌ Expected user.kyc_status='pending', got: {kyc_status}")
            return False
        
        if phone != '+15551234567':
            log(f"❌ Expected user.phone='+15551234567', got: {phone}")
            return False
        
        log(f"✅ 1f verified: user.kyc_status='pending', phone='{phone}'")
        
        # Test 1g: Resubmit while pending → 400
        log("\n1g. Testing resubmit while pending...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "first_name": "KYC",
                "last_name": "Tester",
                "dob": "1990-01-01",
                "country": "United States",
                "state": "California",
                "city": "Los Angeles",
                "address": "123 Test St",
                "postal_code": "90001",
                "mobile": "+15551234567",
                "occupation": "Engineer",
                "id_type": "passport",
                "id_number": "P12345678",
                "doc_front": "data:image/png;base64," + "A" * 2000,
                "doc_back": "data:image/png;base64," + "A" * 2000,
                "selfie": "data:image/png;base64," + "A" * 2000
            }
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        
        if 'previous submission is still under review' not in error:
            log(f"❌ Expected error about 'previous submission', got: {error}")
            return False
        
        log(f"✅ 1g PASS: Resubmit while pending → 400 'Your previous submission is still under review'")
        
        log("\n✅ TEST 1 PASSED: All KYC validation tests passed (7/7)")
        return True, kyc_id, user_id, user_token
        
    except Exception as e:
        log(f"❌ TEST 1 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False, None, None, None

def test_2_admin_reject_requires_reason(admin_token, kyc_id, user_id, user_token):
    """
    TEST 2: Admin reject requires reason
    """
    log("\n" + "="*80)
    log("TEST 2: Admin Reject Requires Reason")
    log("="*80)
    
    try:
        # Test 2a: Empty body → 400
        log("\n2a. Testing admin reject with empty body...")
        resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/reject",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={}
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        
        if 'rejection reason' not in error.lower():
            log(f"❌ Expected error mentioning 'rejection reason', got: {error}")
            return False
        
        log(f"✅ 2a PASS: Empty body → 400 with error mentioning rejection reason")
        
        # Verify KYC still pending
        resp = requests.get(f"{BASE_URL}/admin/kyc?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = resp.json()
        kyc_list = data.get('kyc', [])
        kyc_item = next((k for k in kyc_list if k.get('id') == kyc_id), None)
        
        if not kyc_item or kyc_item.get('status') != 'pending':
            log(f"❌ KYC should still be pending after failed reject")
            return False
        
        log(f"✅ 2a verified: KYC still pending")
        
        # Verify user kyc_status still pending
        resp = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        user = resp.json().get('user', {})
        if user.get('kyc_status') != 'pending':
            log(f"❌ User kyc_status should still be 'pending'")
            return False
        
        log(f"✅ 2a verified: User kyc_status still 'pending'")
        
        # Test 2b: Short reason → 400
        log("\n2b. Testing admin reject with short reason (3 chars)...")
        resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/reject",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"reason": "abc"}
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        log(f"✅ 2b PASS: Short reason (3 chars) → 400")
        
        # Test 2c: Valid reason with spaces → 200, trimmed
        log("\n2c. Testing admin reject with valid reason (with surrounding spaces)...")
        reason_with_spaces = "  Document image is blurry or unreadable  "
        expected_trimmed = "Document image is blurry or unreadable"
        
        resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/reject",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"reason": reason_with_spaces}
        )
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        ok = data.get('ok')
        status = data.get('status')
        reason = data.get('reason')
        
        if not ok or status != 'rejected':
            log(f"❌ Expected ok=true, status='rejected', got: {data}")
            return False
        
        if reason != expected_trimmed:
            log(f"❌ Expected trimmed reason '{expected_trimmed}', got: '{reason}'")
            return False
        
        log(f"✅ 2c PASS: Valid reason → 200 with ok=true, status='rejected', reason='{reason}' (trimmed)")
        
        # Test 2d: Verify rejection in DB (GET /admin/kyc/:id)
        log("\n2d. Testing GET /admin/kyc/:id for rejection details...")
        resp = requests.get(f"{BASE_URL}/admin/kyc/{kyc_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        kyc = data.get('kyc', {})
        
        if kyc.get('status') != 'rejected':
            log(f"❌ Expected kyc.status='rejected', got: {kyc.get('status')}")
            return False
        
        if kyc.get('rejection_reason') != expected_trimmed:
            log(f"❌ Expected kyc.rejection_reason='{expected_trimmed}', got: '{kyc.get('rejection_reason')}'")
            return False
        
        if not kyc.get('reviewed_by'):
            log(f"❌ Expected kyc.reviewed_by to be set")
            return False
        
        if not kyc.get('reviewed_at'):
            log(f"❌ Expected kyc.reviewed_at to be set")
            return False
        
        log(f"✅ 2d PASS: KYC detail shows status='rejected', rejection_reason='{expected_trimmed}', reviewed_by and reviewed_at set")
        
        # Test 2e: List projection includes rejection_reason (GET /admin/kyc?status=rejected)
        log("\n2e. Testing GET /admin/kyc?status=rejected includes rejection_reason...")
        resp = requests.get(f"{BASE_URL}/admin/kyc?status=rejected",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        kyc_list = data.get('kyc', [])
        kyc_item = next((k for k in kyc_list if k.get('id') == kyc_id), None)
        
        if not kyc_item:
            log(f"❌ KYC not found in rejected list")
            return False
        
        if kyc_item.get('rejection_reason') != expected_trimmed:
            log(f"❌ Expected rejection_reason in list, got: {kyc_item.get('rejection_reason')}")
            return False
        
        # Verify NO doc_front/doc_back/selfie keys in list
        if 'doc_front' in kyc_item or 'doc_back' in kyc_item or 'selfie' in kyc_item:
            log(f"❌ List should NOT include doc_front/doc_back/selfie keys")
            return False
        
        log(f"✅ 2e PASS: Rejected list includes rejection_reason and NO image keys")
        
        # Test 2f: User sees reason (GET /auth/me and GET /notifications)
        log("\n2f. Testing user sees rejection reason...")
        resp = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        user = resp.json().get('user', {})
        
        if user.get('kyc_status') != 'rejected':
            log(f"❌ Expected user.kyc_status='rejected', got: {user.get('kyc_status')}")
            return False
        
        if user.get('kyc_rejection_reason') != expected_trimmed:
            log(f"❌ Expected user.kyc_rejection_reason='{expected_trimmed}', got: '{user.get('kyc_rejection_reason')}'")
            return False
        
        if not user.get('kyc_rejected_at'):
            log(f"❌ Expected user.kyc_rejected_at to be set")
            return False
        
        log(f"✅ 2f PASS: User sees kyc_status='rejected', kyc_rejection_reason='{expected_trimmed}', kyc_rejected_at set")
        
        # Check notifications
        resp = requests.get(f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        notifications = resp.json().get('notifications', [])
        kyc_rejected_notif = next((n for n in notifications if n.get('kind') == 'kyc_rejected'), None)
        
        if not kyc_rejected_notif:
            log(f"❌ Expected kyc_rejected notification")
            return False
        
        body = kyc_rejected_notif.get('body', '')
        if expected_trimmed not in body:
            log(f"❌ Expected notification body to contain reason, got: {body}")
            return False
        
        log(f"✅ 2f verified: Notification body contains reason: '{body}'")
        
        # Test 2g: Already rejected → 400
        log("\n2g. Testing reject again (already rejected)...")
        resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/reject",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"reason": "Another reason"}
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        
        if 'already been rejected' not in error:
            log(f"❌ Expected error about 'already been rejected', got: {error}")
            return False
        
        log(f"✅ 2g PASS: Reject again → 400 'already been rejected'")
        
        # Test 2g2: Invalid action → 400
        log("\n2g2. Testing invalid action (bogus)...")
        resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/bogus",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        
        if 'Invalid action' not in error:
            log(f"❌ Expected error 'Invalid action', got: {error}")
            return False
        
        log(f"✅ 2g2 PASS: Invalid action → 400 'Invalid action'")
        
        log("\n✅ TEST 2 PASSED: All admin reject tests passed (9/9)")
        return True
        
    except Exception as e:
        log(f"❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_3_resubmit_clears_reason(user_token):
    """
    TEST 3: Resubmit after rejection clears reason
    """
    log("\n" + "="*80)
    log("TEST 3: Resubmit After Rejection Clears Reason")
    log("="*80)
    
    try:
        # User resubmits KYC (status is rejected, so allowed)
        log("\n3. Testing resubmit after rejection...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "first_name": "KYC",
                "last_name": "Tester",
                "dob": "1990-01-01",
                "country": "United States",
                "state": "California",
                "city": "Los Angeles",
                "address": "123 Test St Apt 2",  # slightly different
                "postal_code": "90001",
                "mobile": "+15551234567",
                "occupation": "Engineer",
                "id_type": "passport",
                "id_number": "P12345678",
                "doc_front": "data:image/png;base64," + "B" * 2000,
                "doc_back": "data:image/png;base64," + "B" * 2000,
                "selfie": "data:image/png;base64," + "B" * 2000
            }
        )
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        new_kyc_id = data.get('kyc', {}).get('id')
        
        log(f"✅ 3 PASS: Resubmit allowed, new kyc.id={new_kyc_id}")
        
        # Verify user kyc_status is 'pending' and rejection fields are ABSENT
        resp = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        user = resp.json().get('user', {})
        
        if user.get('kyc_status') != 'pending':
            log(f"❌ Expected user.kyc_status='pending', got: {user.get('kyc_status')}")
            return False
        
        if 'kyc_rejection_reason' in user:
            log(f"❌ Expected kyc_rejection_reason to be ABSENT, but found: {user.get('kyc_rejection_reason')}")
            return False
        
        if 'kyc_rejected_at' in user:
            log(f"❌ Expected kyc_rejected_at to be ABSENT, but found: {user.get('kyc_rejected_at')}")
            return False
        
        log(f"✅ 3 verified: User kyc_status='pending', kyc_rejection_reason and kyc_rejected_at ABSENT (unset)")
        
        log("\n✅ TEST 3 PASSED: Resubmit clears rejection reason")
        return True, new_kyc_id
        
    except Exception as e:
        log(f"❌ TEST 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False, None

def test_4_approve_clears_reason(admin_token):
    """
    TEST 4: Approve path clears reason fields
    """
    log("\n" + "="*80)
    log("TEST 4: Approve Path Clears Reason Fields")
    log("="*80)
    
    try:
        # Create user U2
        user2_id, user2_token, user2_email = create_fresh_user("_u2")
        if not user2_id:
            log("❌ TEST 4 FAILED: Could not create user U2")
            return False
        
        # Submit KYC
        log("\n4a. User U2 submitting KYC...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user2_token}"},
            json={
                "first_name": "User",
                "last_name": "Two",
                "dob": "1992-05-15",
                "country": "United Kingdom",
                "state": "England",
                "city": "London",
                "address": "456 Test Ave",
                "postal_code": "SW1A 1AA",
                "mobile": "+447700900123",
                "occupation": "Developer",
                "id_type": "passport",
                "id_number": "P87654321",
                "doc_front": "data:image/png;base64," + "C" * 2000,
                "doc_back": "data:image/png;base64," + "C" * 2000,
                "selfie": "data:image/png;base64," + "C" * 2000
            }
        )
        
        if resp.status_code != 200:
            log(f"❌ KYC submit failed: {resp.status_code} {resp.text}")
            return False
        
        kyc3_id = resp.json().get('kyc', {}).get('id')
        log(f"✅ 4a: KYC submitted (K3={kyc3_id})")
        
        # Admin rejects with reason
        log("\n4b. Admin rejecting K3 with reason...")
        resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc3_id}/reject",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"reason": "Document has expired"}
        )
        
        if resp.status_code != 200:
            log(f"❌ Reject failed: {resp.status_code} {resp.text}")
            return False
        
        log(f"✅ 4b: K3 rejected with reason 'Document has expired'")
        
        # User resubmits
        log("\n4c. User U2 resubmitting KYC...")
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user2_token}"},
            json={
                "first_name": "User",
                "last_name": "Two",
                "dob": "1992-05-15",
                "country": "United Kingdom",
                "state": "England",
                "city": "London",
                "address": "456 Test Ave",
                "postal_code": "SW1A 1AA",
                "mobile": "+447700900123",
                "occupation": "Developer",
                "id_type": "passport",
                "id_number": "P99999999",  # new number
                "doc_front": "data:image/png;base64," + "D" * 2000,
                "doc_back": "data:image/png;base64," + "D" * 2000,
                "selfie": "data:image/png;base64," + "D" * 2000
            }
        )
        
        if resp.status_code != 200:
            log(f"❌ Resubmit failed: {resp.status_code} {resp.text}")
            return False
        
        kyc4_id = resp.json().get('kyc', {}).get('id')
        log(f"✅ 4c: KYC resubmitted (K4={kyc4_id})")
        
        # Admin approves
        log("\n4d. Admin approving K4...")
        resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc4_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={}
        )
        
        if resp.status_code != 200:
            log(f"❌ Approve failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        if not data.get('ok') or data.get('status') != 'approved':
            log(f"❌ Expected ok=true, status='approved', got: {data}")
            return False
        
        log(f"✅ 4d: K4 approved")
        
        # Verify user kyc_status='approved' and NO kyc_rejection_reason
        log("\n4e. Verifying user U2 status...")
        resp = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        user = resp.json().get('user', {})
        
        if user.get('kyc_status') != 'approved':
            log(f"❌ Expected user.kyc_status='approved', got: {user.get('kyc_status')}")
            return False
        
        if 'kyc_rejection_reason' in user:
            log(f"❌ Expected kyc_rejection_reason to be ABSENT, but found: {user.get('kyc_rejection_reason')}")
            return False
        
        log(f"✅ 4e: User U2 kyc_status='approved', no kyc_rejection_reason key")
        
        # Check for kyc_approved notification
        resp = requests.get(f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        notifications = resp.json().get('notifications', [])
        kyc_approved_notif = next((n for n in notifications if n.get('kind') == 'kyc_approved'), None)
        
        if not kyc_approved_notif:
            log(f"❌ Expected kyc_approved notification")
            return False
        
        log(f"✅ 4e verified: kyc_approved notification present")
        
        log("\n✅ TEST 4 PASSED: Approve path clears reason fields")
        return True
        
    except Exception as e:
        log(f"❌ TEST 4 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_5_register_init_hardening():
    """
    TEST 5: Register/init hardening
    """
    log("\n" + "="*80)
    log("TEST 5: Register/Init Hardening")
    log("="*80)
    
    try:
        timestamp = int(time.time() * 1000)
        
        # Test 5a: Whitespace-only first_name → 400
        log("\n5a. Testing register with whitespace-only first_name...")
        resp = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": f"test_{timestamp}@test.com",
            "password": "Passw0rd!",
            "first_name": "   ",  # whitespace only
            "last_name": "Doe",
            "phone": "+15550001111",
            "country": "US"
        })
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        
        if 'All fields are required' not in error:
            log(f"❌ Expected error 'All fields are required', got: {error}")
            return False
        
        log(f"✅ 5a PASS: Whitespace-only first_name → 400 'All fields are required'")
        
        # Test 5b: Invalid email → 400
        log("\n5b. Testing register with invalid email...")
        resp = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": "not-an-email",
            "password": "Passw0rd!",
            "first_name": "John",
            "last_name": "Doe",
            "phone": "+15550001111",
            "country": "US"
        })
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        
        if 'valid email address' not in error:
            log(f"❌ Expected error about 'valid email address', got: {error}")
            return False
        
        log(f"✅ 5b PASS: Invalid email → 400 'Please enter a valid email address'")
        
        # Test 5c: Short phone → 400
        log("\n5c. Testing register with short phone (2 digits)...")
        resp = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": f"test_{timestamp}@test.com",
            "password": "Passw0rd!",
            "first_name": "John",
            "last_name": "Doe",
            "phone": "12",
            "country": "US"
        })
        
        if resp.status_code != 400:
            log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get('error', '')
        
        if 'valid mobile number' not in error:
            log(f"❌ Expected error about 'valid mobile number', got: {error}")
            return False
        
        log(f"✅ 5c PASS: Short phone → 400 'Please enter a valid mobile number'")
        
        # Test 5d: Valid with surrounding spaces → 200
        log("\n5d. Testing register with valid fields (with surrounding spaces)...")
        email_with_spaces = f"  test_{timestamp}@test.com  "
        first_name_with_spaces = "  John  "
        
        resp = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": email_with_spaces,
            "password": "Passw0rd!",
            "first_name": first_name_with_spaces,
            "last_name": "Doe",
            "phone": "+15550001111",
            "country": "US"
        })
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        signup_id = data.get('signup_id')
        
        if not signup_id:
            log(f"❌ Expected signup_id in response")
            return False
        
        log(f"✅ 5d PASS: Valid with spaces → 200 with signup_id={signup_id}")
        
        log("\n✅ TEST 5 PASSED: All register/init hardening tests passed (4/4)")
        return True
        
    except Exception as e:
        log(f"❌ TEST 5 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_6_auth():
    """
    TEST 6: Auth tests
    """
    log("\n" + "="*80)
    log("TEST 6: Auth Tests")
    log("="*80)
    
    try:
        # Create a fresh user for auth tests
        user_id, user_token, email = create_fresh_user("_auth")
        if not user_id:
            log("❌ TEST 6 FAILED: Could not create user")
            return False
        
        # Submit KYC
        resp = requests.post(f"{BASE_URL}/kyc",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "first_name": "Auth",
                "last_name": "Test",
                "dob": "1990-01-01",
                "country": "United States",
                "state": "California",
                "city": "Los Angeles",
                "address": "123 Test St",
                "postal_code": "90001",
                "mobile": "+15551234567",
                "occupation": "Engineer",
                "id_type": "passport",
                "id_number": "P12345678",
                "doc_front": "data:image/png;base64," + "A" * 2000,
                "doc_back": "data:image/png;base64," + "A" * 2000,
                "selfie": "data:image/png;base64," + "A" * 2000
            }
        )
        kyc_id = resp.json().get('kyc', {}).get('id')
        
        # Test 6a: Non-admin trying to reject → 403
        log("\n6a. Testing non-admin POST /admin/kyc/:id/reject...")
        resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/reject",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"reason": "Test reason"}
        )
        
        if resp.status_code != 403:
            log(f"❌ Expected 403, got {resp.status_code}: {resp.text}")
            return False
        
        log(f"✅ 6a PASS: Non-admin → 403")
        
        # Test 6b: Unauthenticated → 401
        log("\n6b. Testing unauthenticated POST /admin/kyc/:id/reject...")
        resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/reject",
            json={"reason": "Test reason"}
        )
        
        if resp.status_code != 401:
            log(f"❌ Expected 401, got {resp.status_code}: {resp.text}")
            return False
        
        log(f"✅ 6b PASS: Unauthenticated → 401")
        
        log("\n✅ TEST 6 PASSED: Auth tests passed (2/2)")
        return True
        
    except Exception as e:
        log(f"❌ TEST 6 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_7_regression(admin_token):
    """
    TEST 7: Regression tests
    """
    log("\n" + "="*80)
    log("TEST 7: Regression Tests")
    log("="*80)
    
    try:
        # Test 7a: GET /version → 200 version '1.5.0'
        log("\n7a. Testing GET /version...")
        resp = requests.get(f"{BASE_URL}/version")
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        version = data.get('version')
        
        log(f"✅ 7a PASS: GET /version → 200 with version='{version}'")
        
        if version != '1.5.0':
            log(f"⚠️ Expected version '1.5.0', got '{version}' (not a failure)")
        
        # Test 7b: GET /admin/kyc → 200 with no image keys
        log("\n7b. Testing GET /admin/kyc (no image keys)...")
        resp = requests.get(f"{BASE_URL}/admin/kyc",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        kyc_list = data.get('kyc', [])
        
        # Check that no items have image keys
        for item in kyc_list:
            if 'doc_front' in item or 'doc_back' in item or 'selfie' in item:
                log(f"❌ List item should NOT have image keys, found in item: {item.get('id')}")
                return False
        
        log(f"✅ 7b PASS: GET /admin/kyc → 200 with {len(kyc_list)} items, no image keys")
        
        # Test 7c: GET /rates → 200
        log("\n7c. Testing GET /rates...")
        resp = requests.get(f"{BASE_URL}/rates")
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        log(f"✅ 7c PASS: GET /rates → 200")
        
        # Test 7d: GET /wallets (authed) → 200
        log("\n7d. Testing GET /wallets (authed)...")
        # Create a fresh user
        user_id, user_token, email = create_fresh_user("_regression")
        if not user_id:
            log("❌ Could not create user for regression test")
            return False
        
        resp = requests.get(f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        log(f"✅ 7d PASS: GET /wallets → 200")
        
        log("\n✅ TEST 7 PASSED: All regression tests passed (4/4)")
        return True
        
    except Exception as e:
        log(f"❌ TEST 7 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    log("🚀 Starting Aurela KYC Changes Backend Tests")
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
    
    # Test 1: KYC validation
    test1_result = test_1_kyc_validation()
    if isinstance(test1_result, tuple):
        results['TEST_1'] = test1_result[0]
        kyc_id = test1_result[1]
        user_id = test1_result[2]
        user_token = test1_result[3]
    else:
        results['TEST_1'] = test1_result
        kyc_id = None
        user_id = None
        user_token = None
    
    # Test 2: Admin reject requires reason (only if test 1 passed)
    if results['TEST_1'] and kyc_id and user_id and user_token:
        results['TEST_2'] = test_2_admin_reject_requires_reason(admin_token, kyc_id, user_id, user_token)
        
        # Test 3: Resubmit clears reason (only if test 2 passed)
        if results['TEST_2']:
            test3_result = test_3_resubmit_clears_reason(user_token)
            if isinstance(test3_result, tuple):
                results['TEST_3'] = test3_result[0]
            else:
                results['TEST_3'] = test3_result
        else:
            results['TEST_3'] = False
    else:
        results['TEST_2'] = False
        results['TEST_3'] = False
    
    # Test 4: Approve path clears reason
    results['TEST_4'] = test_4_approve_clears_reason(admin_token)
    
    # Test 5: Register/init hardening
    results['TEST_5'] = test_5_register_init_hardening()
    
    # Test 6: Auth
    results['TEST_6'] = test_6_auth()
    
    # Test 7: Regression
    results['TEST_7'] = test_7_regression(admin_token)
    
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
