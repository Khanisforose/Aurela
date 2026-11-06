#!/usr/bin/env python3
"""
Master Global Card END-TO-END Test Suite
Tests the complete Master Global card flow including:
- Admin issue validation
- User payment and activation
- Enhanced KYC submission
- Admin KYC review and approval
- Geo hold lifting
"""

import requests
import json
import time
import os
import base64
import random
from pymongo import MongoClient

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://aurela-preview.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'aurela')

# Credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"
USER_EMAIL = "geo.tester@aurelatest.io"
USER_PASSWORD = "Aurela@123#"

# Test results tracking
test_results = []
step_number = 0

def log_step(step_name, passed, details=""):
    """Log test step result"""
    global step_number
    step_number += 1
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n[Step {step_number}] {status}: {step_name}")
    if details:
        print(f"  Details: {details}")
    test_results.append({"step": step_number, "name": step_name, "passed": passed, "details": details})
    return passed

def retry_request(func, max_retries=3, sleep_time=30):
    """Retry a request if it fails with 502/connection error"""
    for attempt in range(max_retries):
        try:
            response = func()
            if response.status_code in [502, 503]:
                print(f"  ⚠️  Server returned {response.status_code}, retrying in {sleep_time}s... (attempt {attempt+1}/{max_retries})")
                time.sleep(sleep_time)
                continue
            return response
        except requests.exceptions.ConnectionError as e:
            print(f"  ⚠️  Connection error, retrying in {sleep_time}s... (attempt {attempt+1}/{max_retries})")
            time.sleep(sleep_time)
            if attempt == max_retries - 1:
                raise
    return response

def login(email, password):
    """Login and return token"""
    try:
        response = retry_request(lambda: requests.post(f"{API_URL}/auth/login", json={
            "identifier": email,
            "password": password
        }, timeout=30))
        
        if response.status_code == 200:
            data = response.json()
            return data.get('token')
        else:
            print(f"Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def delete_existing_global_card(admin_token, user_id):
    """Delete any existing Master Global card for the user"""
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all global cards
        response = retry_request(lambda: requests.get(f"{API_URL}/admin/global-cards", headers=headers, timeout=30))
        
        if response.status_code == 200:
            cards = response.json().get('cards', [])
            user_cards = [c for c in cards if c.get('user', {}).get('id') == user_id]
            
            for card in user_cards:
                card_id = card.get('id')
                print(f"  Deleting existing Master Global card: {card_id}")
                delete_response = retry_request(lambda: requests.delete(f"{API_URL}/admin/cards/{card_id}", headers=headers, timeout=30))
                if delete_response.status_code == 200:
                    print(f"  ✓ Deleted card {card_id}")
                else:
                    print(f"  ⚠️  Failed to delete card {card_id}: {delete_response.status_code}")
            
            return True
        else:
            print(f"Failed to get global cards: {response.status_code}")
            return False
    except Exception as e:
        print(f"Delete existing card error: {e}")
        return False

def generate_tiny_jpeg():
    """Generate a tiny valid JPEG image (base64)"""
    # Minimal valid JPEG (1x1 pixel, red)
    jpeg_bytes = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x03, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
        0x37, 0xFF, 0xD9
    ])
    return base64.b64encode(jpeg_bytes).decode('utf-8')

def upload_file_chunked(user_token, card_id, slot, mime='image/jpeg'):
    """Upload a file using the chunked upload API"""
    try:
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # Generate tiny JPEG
        data_b64 = generate_tiny_jpeg()
        data_bytes = base64.b64decode(data_b64)
        
        # Init upload
        init_response = retry_request(lambda: requests.post(f"{API_URL}/force-kyc/upload/init", headers=headers, json={
            "card_id": card_id,
            "slot": slot,
            "mime": mime,
            "size": len(data_bytes),
            "chunks": 1,
            "name": f"{slot}.jpg"
        }, timeout=30))
        
        if init_response.status_code != 200:
            print(f"  Upload init failed for {slot}: {init_response.status_code} - {init_response.text}")
            return None
        
        file_id = init_response.json().get('file_id')
        
        # Upload chunk
        chunk_response = retry_request(lambda: requests.post(f"{API_URL}/force-kyc/upload/chunk", headers=headers, json={
            "file_id": file_id,
            "index": 0,
            "data": data_b64
        }, timeout=30))
        
        if chunk_response.status_code != 200:
            print(f"  Upload chunk failed for {slot}: {chunk_response.status_code}")
            return None
        
        # Complete upload
        complete_response = retry_request(lambda: requests.post(f"{API_URL}/force-kyc/upload/complete", headers=headers, json={
            "file_id": file_id
        }, timeout=30))
        
        if complete_response.status_code != 200:
            print(f"  Upload complete failed for {slot}: {complete_response.status_code}")
            return None
        
        return file_id
    except Exception as e:
        print(f"Upload file error for {slot}: {e}")
        return None

def run_master_global_tests():
    """Run all Master Global card tests"""
    print("\n" + "="*80)
    print("MASTER GLOBAL CARD END-TO-END TEST SUITE")
    print("="*80 + "\n")
    
    # Login as admin
    print("Logging in as admin...")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print("❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        return
    
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    
    # Login as user
    print("Logging in as test user...")
    user_token = login(USER_EMAIL, USER_PASSWORD)
    if not user_token:
        print("❌ CRITICAL: User login failed. Cannot proceed with tests.")
        return
    
    headers_user = {"Authorization": f"Bearer {user_token}"}
    
    # Get user ID
    me_response = retry_request(lambda: requests.get(f"{API_URL}/auth/me", headers=headers_user, timeout=30))
    if me_response.status_code != 200:
        print(f"❌ CRITICAL: Failed to get user info. Status: {me_response.status_code}, Response: {me_response.text}")
        return
    
    user_data = me_response.json()
    user_id = user_data.get('user', {}).get('id') or user_data.get('id')
    if not user_id:
        print(f"❌ CRITICAL: User ID not found in response: {user_data}")
        return
    
    print(f"Test user ID: {user_id}")
    
    # Delete any existing Master Global card
    print("\nCleaning up existing Master Global cards...")
    delete_existing_global_card(admin_token, user_id)
    
    print("\n" + "="*80)
    print("STEP 1: Admin Issue Validation")
    print("="*80)
    
    # 1a: Missing fee → 400
    print("\n--- Test 1a: Missing fee → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/issue", headers=headers_admin, json={
        "user_id": user_id,
        "review_hours": 5,
        "required_docs": ["passport", "proof_of_address"]
    }, timeout=30))
    log_step("1a: Missing fee → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    # 1b: review_hours 9000 → 400
    print("\n--- Test 1b: review_hours 9000 → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/issue", headers=headers_admin, json={
        "user_id": user_id,
        "fee_usdt": 100,
        "review_hours": 9000,
        "required_docs": ["passport", "proof_of_address"]
    }, timeout=30))
    log_step("1b: review_hours 9000 → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    # 1c: No docs → 400
    print("\n--- Test 1c: No docs → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/issue", headers=headers_admin, json={
        "user_id": user_id,
        "fee_usdt": 100,
        "review_hours": 5,
        "required_docs": []
    }, timeout=30))
    log_step("1c: No docs → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    # 1d: Valid issue → pending_activation, type global
    print("\n--- Test 1d: Valid issue → pending_activation, type global ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/issue", headers=headers_admin, json={
        "user_id": user_id,
        "fee_usdt": 100,
        "review_hours": 5,
        "required_docs": ["passport", "proof_of_address"]
    }, timeout=30))
    
    if response.status_code == 200:
        card_data = response.json().get('card', {})
        card_id = card_data.get('id')
        is_pending = card_data.get('status') == 'pending_activation'
        is_global = card_data.get('type') == 'global'
        log_step("1d: Valid issue → pending_activation", is_pending, f"Status: {card_data.get('status')}")
        log_step("1d: Card type is global", is_global, f"Type: {card_data.get('type')}")
        print(f"  Card ID: {card_id}")
    else:
        log_step("1d: Valid issue", False, f"Status: {response.status_code}, Error: {response.text}")
        return
    
    # 1e: Duplicate → 400
    print("\n--- Test 1e: Duplicate issue → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/issue", headers=headers_admin, json={
        "user_id": user_id,
        "fee_usdt": 100,
        "review_hours": 5,
        "required_docs": ["passport", "proof_of_address"]
    }, timeout=30))
    log_step("1e: Duplicate issue → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    print("\n" + "="*80)
    print("STEP 2: User Upload/Submit Before Payment → 400")
    print("="*80)
    
    # 2a: Upload before payment → 400
    print("\n--- Test 2a: Upload before payment → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/force-kyc/upload/init", headers=headers_user, json={
        "card_id": card_id,
        "slot": "passport",
        "mime": "image/jpeg",
        "size": 1000,
        "chunks": 1
    }, timeout=30))
    log_step("2a: Upload before payment → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    # 2b: Submit before payment → 400
    print("\n--- Test 2b: Submit before payment → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/cards/{card_id}/kyc/submit", headers=headers_user, json={
        "personal": {"full_name": "Test"},
        "docs": {},
        "liveness": {"frames": []},
        "consent": True
    }, timeout=30))
    log_step("2b: Submit before payment → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    print("\n" + "="*80)
    print("STEP 3: User Activate → Admin Approve → kyc_required")
    print("="*80)
    
    # 3a: User activates with tx_hash
    print("\n--- Test 3a: User activates with tx_hash ---")
    tx_hash = f"0xMG{random.randint(100000, 999999):06x}{random.randint(100000, 999999):06x}"
    response = retry_request(lambda: requests.post(f"{API_URL}/cards/{card_id}/activate", headers=headers_user, json={
        "tx_hash": tx_hash,
        "network": "ERC20"
    }, timeout=30))
    
    if response.status_code == 200:
        card_status = response.json().get('card', {}).get('status')
        log_step("3a: User activates → pending_verification", card_status == 'pending_verification', f"Status: {card_status}")
    else:
        log_step("3a: User activates", False, f"Status: {response.status_code}, Error: {response.text}")
        return
    
    # 3b: Admin approves → kyc_required
    print("\n--- Test 3b: Admin approves → kyc_required ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/cards/{card_id}/approve", headers=headers_admin, json={}, timeout=30))
    
    if response.status_code == 200:
        log_step("3b: Admin approves", True, "Approved")
        
        # Check card status is kyc_required
        time.sleep(1)
        cards_response = retry_request(lambda: requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30))
        if cards_response.status_code == 200:
            cards = cards_response.json().get('cards', [])
            global_card = next((c for c in cards if c.get('id') == card_id), None)
            if global_card:
                card_status = global_card.get('status')
                log_step("3b: Card status → kyc_required", card_status == 'kyc_required', f"Status: {card_status}")
            else:
                log_step("3b: Card found", False, "Card not found in user's cards")
    else:
        log_step("3b: Admin approves", False, f"Status: {response.status_code}, Error: {response.text}")
        return
    
    # 3c: Activate again → 400
    print("\n--- Test 3c: Activate again → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/cards/{card_id}/activate", headers=headers_user, json={
        "tx_hash": f"0xMG{random.randint(100000, 999999):06x}",
        "network": "ERC20"
    }, timeout=30))
    log_step("3c: Activate again → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    print("\n" + "="*80)
    print("STEP 4: Admin Update Card Settings")
    print("="*80)
    
    # 4a: Update fee_usdt → 400 (after payment)
    print("\n--- Test 4a: Update fee_usdt after payment → 400 ---")
    response = retry_request(lambda: requests.put(f"{API_URL}/admin/global-cards/{card_id}", headers=headers_admin, json={
        "fee_usdt": 5
    }, timeout=30))
    log_step("4a: Update fee_usdt after payment → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    # 4b: Update review_hours → 200
    print("\n--- Test 4b: Update review_hours → 200 ---")
    response = retry_request(lambda: requests.put(f"{API_URL}/admin/global-cards/{card_id}", headers=headers_admin, json={
        "review_hours": 12
    }, timeout=30))
    log_step("4b: Update review_hours → 200", response.status_code == 200, f"Status: {response.status_code}")
    
    print("\n" + "="*80)
    print("STEP 5: User GET KYC, Upload Docs, Submit → kyc_review")
    print("="*80)
    
    # 5a: GET /cards/:id/kyc → review_hours 12
    print("\n--- Test 5a: GET /cards/:id/kyc → review_hours 12 ---")
    response = retry_request(lambda: requests.get(f"{API_URL}/cards/{card_id}/kyc", headers=headers_user, timeout=30))
    
    if response.status_code == 200:
        kyc_data = response.json()
        review_hours = kyc_data.get('review_hours')
        log_step("5a: GET kyc → review_hours 12", review_hours == 12, f"review_hours: {review_hours}")
    else:
        log_step("5a: GET kyc", False, f"Status: {response.status_code}")
    
    # 5b: Upload passport
    print("\n--- Test 5b: Upload passport ---")
    passport_fid = upload_file_chunked(user_token, card_id, "passport")
    log_step("5b: Upload passport", passport_fid is not None, f"File ID: {passport_fid}")
    
    # 5c: Upload proof_of_address
    print("\n--- Test 5c: Upload proof_of_address ---")
    poa_fid = upload_file_chunked(user_token, card_id, "proof_of_address")
    log_step("5c: Upload proof_of_address", poa_fid is not None, f"File ID: {poa_fid}")
    
    # 5d: Upload liveness frames (5 frames)
    print("\n--- Test 5d: Upload liveness frames ---")
    liveness_fids = []
    for i in range(5):
        fid = upload_file_chunked(user_token, card_id, f"liveness_frame_{i}")
        if fid:
            liveness_fids.append(fid)
    log_step("5d: Upload 5 liveness frames", len(liveness_fids) == 5, f"Uploaded: {len(liveness_fids)}/5")
    
    # 5e: Try to upload tax_id (not in required_docs) → 400
    print("\n--- Test 5e: Upload tax_id (not required) → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/force-kyc/upload/init", headers=headers_user, json={
        "card_id": card_id,
        "slot": "tax_id",
        "mime": "image/jpeg",
        "size": 1000,
        "chunks": 1
    }, timeout=30))
    log_step("5e: Upload tax_id (not required) → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    # 5f: Submit KYC
    print("\n--- Test 5f: Submit KYC → kyc_review ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/cards/{card_id}/kyc/submit", headers=headers_user, json={
        "personal": {
            "full_name": "Geo Tester",
            "dob": "1990-01-01",
            "nationality": "US",
            "country": "US",
            "city": "NYC",
            "address": "1 Main St",
            "postal_code": "10001",
            "occupation": "Engineer",
            "id_type": "Passport",
            "id_number": "X123"
        },
        "docs": {
            "passport": passport_fid,
            "proof_of_address": poa_fid
        },
        "liveness": {
            "frames": [
                {"file_id": liveness_fids[0], "challenge": "center"},
                {"file_id": liveness_fids[1], "challenge": "left"},
                {"file_id": liveness_fids[2], "challenge": "right"},
                {"file_id": liveness_fids[3], "challenge": "up"},
                {"file_id": liveness_fids[4], "challenge": "down"}
            ]
        },
        "consent": True
    }, timeout=30))
    
    if response.status_code == 200:
        submission_data = response.json()
        log_step("5f: Submit KYC → 200", True, f"Submission ID: {submission_data.get('submission_id')}")
        
        # Check card status is kyc_review
        time.sleep(1)
        cards_response = retry_request(lambda: requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30))
        if cards_response.status_code == 200:
            cards = cards_response.json().get('cards', [])
            global_card = next((c for c in cards if c.get('id') == card_id), None)
            if global_card:
                card_status = global_card.get('status')
                log_step("5f: Card status → kyc_review", card_status == 'kyc_review', f"Status: {card_status}")
                
                # Check review_due_at is approximately now + 12h
                review_due_at = global_card.get('kyc', {}).get('review_due_at')
                if review_due_at:
                    log_step("5f: review_due_at set", True, f"review_due_at: {review_due_at}")
    else:
        log_step("5f: Submit KYC", False, f"Status: {response.status_code}, Error: {response.text}")
        return
    
    # 5g: User POST /api/notifications/read should NOT return 423
    print("\n--- Test 5g: User POST /notifications/read → NOT 423 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/notifications/read", headers=headers_user, json={}, timeout=30))
    log_step("5g: POST /notifications/read → NOT 423", response.status_code != 423, f"Status: {response.status_code}")
    
    # 5h: User POST /transfer with invalid data should NOT return 423
    print("\n--- Test 5h: User POST /transfer (invalid) → NOT 423 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/transfer", headers=headers_user, json={
        "recipient": "nonexistent",
        "amount": 999999,
        "currency": "USD"
    }, timeout=30))
    log_step("5h: POST /transfer (invalid) → NOT 423", response.status_code != 423, f"Status: {response.status_code}")
    
    print("\n" + "="*80)
    print("STEP 6: Admin GET KYC, Admin GET File")
    print("="*80)
    
    # 6a: Admin GET /admin/global-cards/:id/kyc
    print("\n--- Test 6a: Admin GET /admin/global-cards/:id/kyc ---")
    response = retry_request(lambda: requests.get(f"{API_URL}/admin/global-cards/{card_id}/kyc", headers=headers_admin, timeout=30))
    
    if response.status_code == 200:
        admin_kyc_data = response.json()
        state = admin_kyc_data.get('state', {})
        submissions = admin_kyc_data.get('submissions', [])
        
        log_step("6a: Admin GET kyc → 200", True, f"State status: {state.get('status')}")
        log_step("6a: State status is 'submitted'", state.get('status') == 'submitted', f"Status: {state.get('status')}")
        log_step("6a: Submissions array has data", len(submissions) > 0, f"Submissions: {len(submissions)}")
        
        if submissions:
            submission = submissions[0]
            docs = submission.get('docs', {})
            log_step("6a: Submission has docs", len(docs) > 0, f"Docs: {list(docs.keys())}")
    else:
        log_step("6a: Admin GET kyc", False, f"Status: {response.status_code}")
    
    # 6b: Admin GET /force-kyc/file/:id for passport
    print("\n--- Test 6b: Admin GET file (passport) ---")
    response = retry_request(lambda: requests.get(f"{API_URL}/force-kyc/file/{passport_fid}", headers=headers_admin, timeout=30))
    log_step("6b: Admin GET file (passport) → 200", response.status_code == 200, f"Status: {response.status_code}, Size: {len(response.content)} bytes")
    
    print("\n" + "="*80)
    print("STEP 7: Reject, Resubmit with Old Files → 400, New Files → kyc_review")
    print("="*80)
    
    # 7a: Reject without reason → 400
    print("\n--- Test 7a: Reject without reason → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/{card_id}/kyc/reject", headers=headers_admin, json={}, timeout=30))
    log_step("7a: Reject without reason → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    # 7b: Reject with reason → kyc_rejected, attempt 2
    print("\n--- Test 7b: Reject with reason → kyc_rejected ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/{card_id}/kyc/reject", headers=headers_admin, json={
        "reason": "blurry"
    }, timeout=30))
    
    if response.status_code == 200:
        log_step("7b: Reject with reason → 200", True, "Rejected")
        
        # Check card status is kyc_rejected
        time.sleep(1)
        cards_response = retry_request(lambda: requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30))
        if cards_response.status_code == 200:
            cards = cards_response.json().get('cards', [])
            global_card = next((c for c in cards if c.get('id') == card_id), None)
            if global_card:
                card_status = global_card.get('status')
                attempt = global_card.get('kyc', {}).get('attempt')
                log_step("7b: Card status → kyc_rejected", card_status == 'kyc_rejected', f"Status: {card_status}")
                log_step("7b: Attempt incremented to 2", attempt == 2, f"Attempt: {attempt}")
    else:
        log_step("7b: Reject with reason", False, f"Status: {response.status_code}, Error: {response.text}")
    
    # 7c: Resubmit with old file IDs → 400
    print("\n--- Test 7c: Resubmit with old file IDs → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/cards/{card_id}/kyc/submit", headers=headers_user, json={
        "personal": {
            "full_name": "Geo Tester",
            "dob": "1990-01-01",
            "nationality": "US",
            "country": "US",
            "city": "NYC",
            "address": "1 Main St",
            "postal_code": "10001",
            "occupation": "Engineer",
            "id_type": "Passport",
            "id_number": "X123"
        },
        "docs": {
            "passport": passport_fid,  # Old file ID (attempt 1)
            "proof_of_address": poa_fid
        },
        "liveness": {
            "frames": [
                {"file_id": liveness_fids[0], "challenge": "center"},
                {"file_id": liveness_fids[1], "challenge": "left"},
                {"file_id": liveness_fids[2], "challenge": "right"},
                {"file_id": liveness_fids[3], "challenge": "up"},
                {"file_id": liveness_fids[4], "challenge": "down"}
            ]
        },
        "consent": True
    }, timeout=30))
    log_step("7c: Resubmit with old file IDs → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    # 7d: Upload new files (attempt 2) and resubmit → kyc_review
    print("\n--- Test 7d: Upload new files (attempt 2) and resubmit ---")
    passport_fid2 = upload_file_chunked(user_token, card_id, "passport")
    poa_fid2 = upload_file_chunked(user_token, card_id, "proof_of_address")
    liveness_fids2 = []
    for i in range(5):
        fid = upload_file_chunked(user_token, card_id, f"liveness_frame_{i}")
        if fid:
            liveness_fids2.append(fid)
    
    log_step("7d: Upload new files (attempt 2)", len(liveness_fids2) == 5, f"Uploaded: {len(liveness_fids2)}/5")
    
    response = retry_request(lambda: requests.post(f"{API_URL}/cards/{card_id}/kyc/submit", headers=headers_user, json={
        "personal": {
            "full_name": "Geo Tester",
            "dob": "1990-01-01",
            "nationality": "US",
            "country": "US",
            "city": "NYC",
            "address": "1 Main St",
            "postal_code": "10001",
            "occupation": "Engineer",
            "id_type": "Passport",
            "id_number": "X123"
        },
        "docs": {
            "passport": passport_fid2,
            "proof_of_address": poa_fid2
        },
        "liveness": {
            "frames": [
                {"file_id": liveness_fids2[0], "challenge": "center"},
                {"file_id": liveness_fids2[1], "challenge": "left"},
                {"file_id": liveness_fids2[2], "challenge": "right"},
                {"file_id": liveness_fids2[3], "challenge": "up"},
                {"file_id": liveness_fids2[4], "challenge": "down"}
            ]
        },
        "consent": True
    }, timeout=30))
    
    if response.status_code == 200:
        log_step("7d: Resubmit with new files → 200", True, "Resubmitted")
        
        # Check card status is kyc_review
        time.sleep(1)
        cards_response = retry_request(lambda: requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30))
        if cards_response.status_code == 200:
            cards = cards_response.json().get('cards', [])
            global_card = next((c for c in cards if c.get('id') == card_id), None)
            if global_card:
                card_status = global_card.get('status')
                log_step("7d: Card status → kyc_review", card_status == 'kyc_review', f"Status: {card_status}")
    else:
        log_step("7d: Resubmit with new files", False, f"Status: {response.status_code}, Error: {response.text}")
    
    print("\n" + "="*80)
    print("STEP 8: Put User on Geo Hold, Approve → active + Hold Lifted")
    print("="*80)
    
    # 8a: Put user on geo hold
    print("\n--- Test 8a: Put user on geo hold ---")
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        db.users.update_one(
            {"id": user_id},
            {"$set": {
                "withdraw_lock": {
                    "active": True,
                    "reason": "geolocation_unverified",
                    "since": {"$date": int(time.time() * 1000)}
                },
                "withdraw_lock_exempt": False
            }}
        )
        mongo_client.close()
        log_step("8a: Put user on geo hold", True, "Hold applied via MongoDB")
    except Exception as e:
        log_step("8a: Put user on geo hold", False, f"Error: {e}")
    
    # 8b: Admin approves KYC → card active, hold lifted
    print("\n--- Test 8b: Admin approves KYC → active + hold lifted ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/{card_id}/kyc/approve", headers=headers_admin, json={}, timeout=30))
    
    if response.status_code == 200:
        log_step("8b: Admin approves KYC → 200", True, "Approved")
        
        # Check card status is active
        time.sleep(1)
        cards_response = retry_request(lambda: requests.get(f"{API_URL}/cards", headers=headers_user, timeout=30))
        if cards_response.status_code == 200:
            cards = cards_response.json().get('cards', [])
            global_card = next((c for c in cards if c.get('id') == card_id), None)
            if global_card:
                card_status = global_card.get('status')
                log_step("8b: Card status → active", card_status == 'active', f"Status: {card_status}")
        
        # Check hold is lifted
        try:
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            user_doc = db.users.find_one({"id": user_id}, {"withdraw_lock": 1, "withdraw_lock_exempt": 1})
            mongo_client.close()
            
            is_lifted = user_doc.get('withdraw_lock', {}).get('active') == False
            is_exempt = user_doc.get('withdraw_lock_exempt') == True
            
            log_step("8b: Hold lifted (active=false)", is_lifted, f"Hold active: {user_doc.get('withdraw_lock', {}).get('active')}")
            log_step("8b: User exempt (exempt=true)", is_exempt, f"Exempt: {user_doc.get('withdraw_lock_exempt')}")
        except Exception as e:
            log_step("8b: Check hold status", False, f"Error: {e}")
    else:
        log_step("8b: Admin approves KYC", False, f"Status: {response.status_code}, Error: {response.text}")
    
    # 8c: Approve again → 400
    print("\n--- Test 8c: Approve again → 400 ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/{card_id}/kyc/approve", headers=headers_admin, json={}, timeout=30))
    log_step("8c: Approve again → 400", response.status_code == 400, f"Status: {response.status_code}, Error: {response.json().get('error', '')}")
    
    print("\n" + "="*80)
    print("STEP 9: Delete Card, Issue with fee_usdt:0 → kyc_required Immediately")
    print("="*80)
    
    # 9a: Delete the card
    print("\n--- Test 9a: Delete the card ---")
    response = retry_request(lambda: requests.delete(f"{API_URL}/admin/cards/{card_id}", headers=headers_admin, timeout=30))
    log_step("9a: Delete card → 200", response.status_code == 200, f"Status: {response.status_code}")
    
    # 9b: Issue with fee_usdt:0 → kyc_required immediately
    print("\n--- Test 9b: Issue with fee_usdt:0 → kyc_required immediately ---")
    response = retry_request(lambda: requests.post(f"{API_URL}/admin/global-cards/issue", headers=headers_admin, json={
        "user_id": user_id,
        "fee_usdt": 0,
        "review_hours": 5,
        "required_docs": ["passport", "proof_of_address"]
    }, timeout=30))
    
    if response.status_code == 200:
        card_data = response.json().get('card', {})
        card_id_free = card_data.get('id')
        card_status = card_data.get('status')
        log_step("9b: Issue with fee_usdt:0 → kyc_required", card_status == 'kyc_required', f"Status: {card_status}")
        
        # 9c: Delete it
        print("\n--- Test 9c: Delete the free card ---")
        response = retry_request(lambda: requests.delete(f"{API_URL}/admin/cards/{card_id_free}", headers=headers_admin, timeout=30))
        log_step("9c: Delete free card → 200", response.status_code == 200, f"Status: {response.status_code}")
    else:
        log_step("9b: Issue with fee_usdt:0", False, f"Status: {response.status_code}, Error: {response.text}")
    
    print("\n" + "="*80)
    print("STEP 10: Non-Admin Access Control")
    print("="*80)
    
    # 10a: Non-admin GET /admin/global-cards → 403
    print("\n--- Test 10a: Non-admin GET /admin/global-cards → 403 ---")
    response = retry_request(lambda: requests.get(f"{API_URL}/admin/global-cards", headers=headers_user, timeout=30))
    log_step("10a: Non-admin GET /admin/global-cards → 403", response.status_code == 403, f"Status: {response.status_code}")
    
    # 10b: GET /admin/all-cards?type=global → 200
    print("\n--- Test 10b: Admin GET /admin/all-cards?type=global → 200 ---")
    response = retry_request(lambda: requests.get(f"{API_URL}/admin/all-cards?type=global", headers=headers_admin, timeout=30))
    log_step("10b: Admin GET /admin/all-cards?type=global → 200", response.status_code == 200, f"Status: {response.status_code}")
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80 + "\n")
    
    total_steps = len(test_results)
    passed_steps = sum(1 for t in test_results if t['passed'])
    failed_steps = total_steps - passed_steps
    
    print(f"Total steps: {total_steps}")
    print(f"Passed: {passed_steps}")
    print(f"Failed: {failed_steps}")
    print(f"Success rate: {(passed_steps/total_steps*100):.1f}%\n")
    
    if failed_steps > 0:
        print("Failed steps:")
        for t in test_results:
            if not t['passed']:
                print(f"  ❌ [Step {t['step']}] {t['name']}")
                if t['details']:
                    print(f"     {t['details']}")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    run_master_global_tests()
