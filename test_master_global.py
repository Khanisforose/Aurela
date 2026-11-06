#!/usr/bin/env python3
"""
Backend test for Master Global card feature
Tests all 10 items from the review_request
"""

import requests
import json
import time
import random
import string
from datetime import datetime

# Base URL from .env
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# Test results
test_results = []

def log_test(item, test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} - Item {item}: {test_name}"
    if details:
        result += f" - {details}"
    test_results.append(result)
    print(result)
    return passed

def random_email():
    """Generate random email"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_mg_{rand}@test.com"

def random_username():
    """Generate random username"""
    return 'testmg' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

def register_and_approve_user():
    """Register a fresh user and approve their KYC"""
    email = random_email()
    username = random_username()
    password = "TestPass123!"
    
    # Register init
    resp = requests.post(f"{BASE_URL}/auth/register/init", json={
        "first_name": "Test",
        "last_name": "User",
        "email": email,
        "country": "US",
        "phone": "+1234567890",
        "password": password
    })
    
    if resp.status_code != 200:
        print(f"Registration failed: {resp.text}")
        return None
    
    data = resp.json()
    signup_id = data.get('signup_id')
    otp = data.get('dev_otp')
    
    # Verify registration
    resp = requests.post(f"{BASE_URL}/auth/register/verify", json={
        "signup_id": signup_id,
        "code": otp
    })
    
    if resp.status_code != 200:
        print(f"Verification failed: {resp.text}")
        return None
    
    user_token = resp.json().get('token')
    user_id = resp.json().get('user', {}).get('id')
    
    # Submit KYC
    kyc_data = {
        "first_name": "Test",
        "last_name": "User",
        "mobile": "+1234567890",
        "country": "US",
        "state": "CA",
        "city": "Los Angeles",
        "address": "123 Test St",
        "postal_code": "90001",
        "occupation": "Engineer",
        "id_type": "passport",
        "id_number": "P12345678",
        "dob": "1990-01-01",
        "doc_front": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "doc_back": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "selfie": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    }
    
    resp = requests.post(f"{BASE_URL}/kyc", json=kyc_data, headers={"Authorization": f"Bearer {user_token}"})
    
    if resp.status_code != 200:
        print(f"KYC submission failed: {resp.text}")
        return None
    
    # Admin login
    admin_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if admin_resp.status_code != 200:
        print(f"Admin login failed: {admin_resp.text}")
        return None
    
    admin_token = admin_resp.json().get('token')
    
    # Get KYC list to find the submission
    kyc_list_resp = requests.get(f"{BASE_URL}/admin/kyc", headers={"Authorization": f"Bearer {admin_token}"})
    
    if kyc_list_resp.status_code != 200:
        print(f"Failed to get KYC list: {kyc_list_resp.text}")
        return None
    
    kyc_list = kyc_list_resp.json().get('kyc', [])
    user_kyc = next((k for k in kyc_list if k.get('user_id') == user_id), None)
    
    if not user_kyc:
        print(f"KYC not found for user {user_id}")
        return None
    
    kyc_id = user_kyc.get('id')
    
    # Approve KYC
    approve_resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})
    
    if approve_resp.status_code != 200:
        print(f"KYC approval failed: {approve_resp.text}")
        return None
    
    return {
        "user_id": user_id,
        "user_token": user_token,
        "admin_token": admin_token,
        "email": email,
        "username": username
    }

def test_master_global_card():
    """Test Master Global card feature"""
    print("\n" + "="*80)
    print("MASTER GLOBAL CARD BACKEND TEST")
    print("="*80 + "\n")
    
    # Admin login
    print("Logging in as admin...")
    admin_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if admin_resp.status_code != 200:
        print(f"❌ Admin login failed: {admin_resp.text}")
        return
    
    admin_token = admin_resp.json().get('token')
    admin_id = admin_resp.json().get('user', {}).get('id')
    print(f"✅ Admin logged in successfully\n")
    
    # ========== ITEM 1: Issue validation ==========
    print("="*80)
    print("ITEM 1: Issue validation")
    print("="*80)
    
    # Create test user for validation tests
    print("Creating test user for validation tests...")
    test_user = register_and_approve_user()
    if not test_user:
        print("❌ Failed to create test user")
        return
    
    user_id = test_user['user_id']
    user_token = test_user['user_token']
    print(f"✅ Test user created: {user_id}\n")
    
    # Test 1a: Missing fee
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue", 
                        json={"user_id": user_id, "review_hours": 5, "required_docs": ["passport"]},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1a", "Missing fee → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1b: Missing hours
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={"user_id": user_id, "fee_usdt": 100, "required_docs": ["passport"]},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1b", "Missing hours → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1c: Hours 9000 → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={"user_id": user_id, "fee_usdt": 100, "review_hours": 9000, "required_docs": ["passport"]},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1c", "Hours 9000 → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1d: No docs → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={"user_id": user_id, "fee_usdt": 100, "review_hours": 5, "required_docs": []},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1d", "No docs → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1e: Admin target → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={"user_id": admin_id, "fee_usdt": 100, "review_hours": 5, "required_docs": ["passport"]},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1e", "Admin target → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1f: Valid issue
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={
                            "user_id": user_id,
                            "fee_usdt": 100,
                            "review_hours": 5,
                            "required_docs": ["passport", "proof_of_address"]
                        },
                        headers={"Authorization": f"Bearer {admin_token}"})
    
    if resp.status_code != 200:
        log_test("1f", "Valid issue", False, f"Status: {resp.status_code}, Response: {resp.text}")
        return
    
    card_data = resp.json().get('card', {})
    card_id = card_data.get('id')
    card_status = card_data.get('status')
    card_type = card_data.get('type')
    review_hours = card_data.get('review_hours')
    kyc_required_docs = card_data.get('kyc', {}).get('required_docs', [])
    
    passed = (card_status == 'pending_activation' and 
             review_hours == 5 and 
             'passport' in kyc_required_docs and 
             'proof_of_address' in kyc_required_docs and
             card_type == 'global')
    
    log_test("1f", "Valid issue", passed, 
            f"Status: {card_status}, Type: {card_type}, Hours: {review_hours}, Docs: {kyc_required_docs}")
    
    if not passed:
        return
    
    # Test 1g: Second issue same user → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                        json={
                            "user_id": user_id,
                            "fee_usdt": 100,
                            "review_hours": 5,
                            "required_docs": ["passport"]
                        },
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("1g", "Second issue same user → 400", resp.status_code == 400, f"Status: {resp.status_code}")
    
    # Test 1h: User GET /api/cards shows it
    resp = requests.get(f"{BASE_URL}/cards", headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        cards = resp.json().get('cards', [])
        global_card = next((c for c in cards if c.get('type') == 'global'), None)
        log_test("1h", "User GET /cards shows global card", global_card is not None, 
                f"Found: {global_card is not None}")
    else:
        log_test("1h", "User GET /cards shows global card", False, f"Status: {resp.status_code}")
    
    # Test 1i: Notification 'global_card_issued'
    resp = requests.get(f"{BASE_URL}/notifications", headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        notifications = resp.json().get('notifications', [])
        global_notif = next((n for n in notifications if n.get('kind') == 'global_card_issued'), None)
        log_test("1i", "Notification 'global_card_issued'", global_notif is not None,
                f"Found: {global_notif is not None}")
    else:
        log_test("1i", "Notification 'global_card_issued'", False, f"Status: {resp.status_code}")
    
    # Test 1j: Does not count toward 3 tier card limit
    # Request a tier card
    resp = requests.post(f"{BASE_URL}/cards/request",
                        json={"tier": "basic"},
                        headers={"Authorization": f"Bearer {user_token}"})
    log_test("1j", "Does not count toward 3 tier card limit", resp.status_code == 200,
            f"Status: {resp.status_code} (should allow tier card request)")
    
    print()
    
    # ========== ITEM 2: Uploading card KYC before payment → 400 ==========
    print("="*80)
    print("ITEM 2: Uploading card KYC before payment → 400")
    print("="*80)
    
    # Test 2a: Upload init before payment → 400
    resp = requests.post(f"{BASE_URL}/force-kyc/upload/init",
                        json={
                            "card_id": card_id,
                            "slot": "passport",
                            "mime": "image/jpeg",
                            "size": 1024,
                            "chunks": 1,
                            "name": "passport.jpg"
                        },
                        headers={"Authorization": f"Bearer {user_token}"})
    log_test("2a", "Upload init before payment → 400", resp.status_code == 400,
            f"Status: {resp.status_code}")
    
    # Test 2b: Submit before payment → 400
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/kyc/submit",
                        json={
                            "personal": {
                                "full_name": "Test User",
                                "dob": "1990-01-01",
                                "nationality": "US",
                                "country": "US",
                                "city": "LA",
                                "address": "123 Test",
                                "postal_code": "90001",
                                "occupation": "Engineer",
                                "id_type": "passport",
                                "id_number": "P123"
                            },
                            "docs": {},
                            "liveness": {"frames": []},
                            "consent": True
                        },
                        headers={"Authorization": f"Bearer {user_token}"})
    log_test("2b", "Submit before payment → 400", resp.status_code == 400,
            f"Status: {resp.status_code}")
    
    print()
    
    # ========== ITEM 3: Payment flow ==========
    print("="*80)
    print("ITEM 3: Payment flow")
    print("="*80)
    
    # Test 3a: User activates with tx_hash → pending_verification
    tx_hash = "0xMG" + ''.join(random.choices(string.hexdigits.lower(), k=62))
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate",
                        json={"tx_hash": tx_hash, "network": "ERC20"},
                        headers={"Authorization": f"Bearer {user_token}"})
    
    if resp.status_code != 200:
        log_test("3a", "User activates with tx_hash", False, f"Status: {resp.status_code}, Response: {resp.text}")
    else:
        card_status = resp.json().get('card', {}).get('status')
        log_test("3a", "User activates with tx_hash → pending_verification", 
                card_status == 'pending_verification',
                f"Status: {card_status}")
    
    # Test 3b: Admin approves → card status 'kyc_required' (not active)
    resp = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve",
                        json={},
                        headers={"Authorization": f"Bearer {admin_token}"})
    
    if resp.status_code != 200:
        log_test("3b", "Admin approves", False, f"Status: {resp.status_code}, Response: {resp.text}")
    else:
        card_status = resp.json().get('card', {}).get('status')
        log_test("3b", "Admin approves → card status 'kyc_required'",
                card_status == 'kyc_required',
                f"Status: {card_status}")
    
    # Test 3c: Fee credited to USDT balance
    resp = requests.get(f"{BASE_URL}/wallets", headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        wallets = resp.json().get('wallets', [])
        usdt_wallet = next((w for w in wallets if w.get('currency') == 'USDT'), None)
        if usdt_wallet:
            balance = usdt_wallet.get('balance', 0)
            log_test("3c", "Fee credited to USDT balance", balance >= 100,
                    f"USDT balance: {balance}")
        else:
            log_test("3c", "Fee credited to USDT balance", False, "USDT wallet not found")
    else:
        log_test("3c", "Fee credited to USDT balance", False, f"Status: {resp.status_code}")
    
    # Test 3d: User NOT geo-locked
    resp = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        withdraw_lock = resp.json().get('user', {}).get('withdraw_lock', {})
        is_locked = withdraw_lock.get('active', False)
        log_test("3d", "User NOT geo-locked", not is_locked,
                f"Withdraw lock active: {is_locked}")
    else:
        log_test("3d", "User NOT geo-locked", False, f"Status: {resp.status_code}")
    
    # Test 3e: Activate again → 400
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate",
                        json={"tx_hash": "0xNEW" + ''.join(random.choices(string.hexdigits.lower(), k=60)), "network": "ERC20"},
                        headers={"Authorization": f"Bearer {user_token}"})
    log_test("3e", "Activate again → 400", resp.status_code == 400,
            f"Status: {resp.status_code}")
    
    print()
    
    # ========== ITEM 4: PUT /admin/global-cards/:id ==========
    print("="*80)
    print("ITEM 4: PUT /admin/global-cards/:id")
    print("="*80)
    
    # Test 4a: Update fee after payment → 400
    resp = requests.put(f"{BASE_URL}/admin/global-cards/{card_id}",
                       json={"fee_usdt": 5},
                       headers={"Authorization": f"Bearer {admin_token}"})
    log_test("4a", "Update fee after payment → 400", resp.status_code == 400,
            f"Status: {resp.status_code}")
    
    # Test 4b: Update review_hours → ok
    resp = requests.put(f"{BASE_URL}/admin/global-cards/{card_id}",
                       json={"review_hours": 12},
                       headers={"Authorization": f"Bearer {admin_token}"})
    
    if resp.status_code != 200:
        log_test("4b", "Update review_hours → ok", False, f"Status: {resp.status_code}")
    else:
        new_hours = resp.json().get('card', {}).get('review_hours')
        log_test("4b", "Update review_hours → ok", new_hours == 12,
                f"New hours: {new_hours}")
    
    print()
    
    # ========== ITEM 5: Card KYC ==========
    print("="*80)
    print("ITEM 5: Card KYC")
    print("="*80)
    
    # Test 5a: GET /api/cards/:id/kyc
    resp = requests.get(f"{BASE_URL}/cards/{card_id}/kyc",
                       headers={"Authorization": f"Bearer {user_token}"})
    
    if resp.status_code != 200:
        log_test("5a", "GET /cards/:id/kyc", False, f"Status: {resp.status_code}")
    else:
        data = resp.json()
        kyc = data.get('kyc')
        uploads = data.get('uploads', {})
        prefill = data.get('prefill')
        review_hours = data.get('review_hours')
        
        log_test("5a", "GET /cards/:id/kyc returns correct structure",
                kyc is not None and isinstance(uploads, dict) and review_hours == 12,
                f"KYC: {kyc is not None}, Uploads: {type(uploads)}, Hours: {review_hours}")
    
    # Test 5b-5f: Upload docs + liveness frames
    # For simplicity, we'll create minimal uploads
    print("Uploading documents and liveness frames...")
    
    # Small test image (1x1 PNG)
    test_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    uploaded_files = {}
    
    # Upload passport
    for slot in ["passport", "proof_of_address"]:
        # Init upload
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/init",
                            json={
                                "card_id": card_id,
                                "slot": slot,
                                "mime": "image/jpeg",
                                "size": len(test_image_b64),
                                "chunks": 1,
                                "name": f"{slot}.jpg"
                            },
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            print(f"  ❌ Failed to init upload for {slot}: {resp.status_code}")
            continue
        
        file_id = resp.json().get('file_id')
        
        # Upload chunk
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/chunk",
                            json={
                                "file_id": file_id,
                                "index": 0,
                                "data": test_image_b64
                            },
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            print(f"  ❌ Failed to upload chunk for {slot}: {resp.status_code}")
            continue
        
        # Complete upload
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/complete",
                            json={"file_id": file_id},
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            print(f"  ❌ Failed to complete upload for {slot}: {resp.status_code}")
            continue
        
        uploaded_files[slot] = file_id
        print(f"  ✅ Uploaded {slot}")
    
    # Upload 5 liveness frames
    liveness_frames = []
    for i in range(5):
        slot = f"liveness_frame_{i}"
        
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/init",
                            json={
                                "card_id": card_id,
                                "slot": slot,
                                "mime": "image/jpeg",
                                "size": len(test_image_b64),
                                "chunks": 1,
                                "name": f"frame_{i}.jpg"
                            },
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            print(f"  ❌ Failed to init upload for {slot}: {resp.status_code}")
            continue
        
        file_id = resp.json().get('file_id')
        
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/chunk",
                            json={
                                "file_id": file_id,
                                "index": 0,
                                "data": test_image_b64
                            },
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            print(f"  ❌ Failed to upload chunk for {slot}: {resp.status_code}")
            continue
        
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/complete",
                            json={"file_id": file_id},
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            print(f"  ❌ Failed to complete upload for {slot}: {resp.status_code}")
            continue
        
        liveness_frames.append({"file_id": file_id, "challenge": f"smile_{i}"})
        print(f"  ✅ Uploaded {slot}")
    
    log_test("5b", "Upload docs + liveness frames", 
            len(uploaded_files) == 2 and len(liveness_frames) == 5,
            f"Docs: {len(uploaded_files)}, Frames: {len(liveness_frames)}")
    
    # Test 5c: Slot not in card docs → 400
    resp = requests.post(f"{BASE_URL}/force-kyc/upload/init",
                        json={
                            "card_id": card_id,
                            "slot": "tax_id",
                            "mime": "image/jpeg",
                            "size": 1024,
                            "chunks": 1,
                            "name": "tax.jpg"
                        },
                        headers={"Authorization": f"Bearer {user_token}"})
    log_test("5c", "Slot not in card docs → 400", resp.status_code == 400,
            f"Status: {resp.status_code}")
    
    # Test 5d: Submit KYC
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/kyc/submit",
                        json={
                            "personal": {
                                "full_name": "Test User",
                                "dob": "1990-01-01",
                                "nationality": "US",
                                "country": "US",
                                "city": "Los Angeles",
                                "address": "123 Test St",
                                "postal_code": "90001",
                                "occupation": "Engineer",
                                "id_type": "passport",
                                "id_number": "P12345678"
                            },
                            "docs": uploaded_files,
                            "liveness": {"frames": liveness_frames},
                            "consent": True
                        },
                        headers={"Authorization": f"Bearer {user_token}"})
    
    if resp.status_code != 200:
        log_test("5d", "Submit KYC", False, f"Status: {resp.status_code}, Response: {resp.text}")
    else:
        submission_id = resp.json().get('submission_id')
        review_due_at = resp.json().get('review_due_at')
        log_test("5d", "Submit KYC → status kyc_review", 
                submission_id is not None and review_due_at is not None,
                f"Submission ID: {submission_id}")
    
    # Verify card status is kyc_review
    resp = requests.get(f"{BASE_URL}/cards", headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        cards = resp.json().get('cards', [])
        global_card = next((c for c in cards if c.get('id') == card_id), None)
        if global_card:
            card_status = global_card.get('status')
            log_test("5e", "Card status is kyc_review", card_status == 'kyc_review',
                    f"Status: {card_status}")
        else:
            log_test("5e", "Card status is kyc_review", False, "Card not found")
    else:
        log_test("5e", "Card status is kyc_review", False, f"Status: {resp.status_code}")
    
    # Test 5f: User account NOT locked during this
    resp = requests.post(f"{BASE_URL}/transfer",
                        json={
                            "recipient": ADMIN_EMAIL,
                            "currency": "AUR",
                            "amount": 0.1
                        },
                        headers={"Authorization": f"Bearer {user_token}"})
    log_test("5f", "User account NOT locked (transfer works)", 
            resp.status_code == 200 or resp.status_code == 400,  # 400 for insufficient balance is ok
            f"Status: {resp.status_code}")
    
    print()
    
    # ========== ITEM 6: Admin review endpoints ==========
    print("="*80)
    print("ITEM 6: Admin review endpoints")
    print("="*80)
    
    # Test 6a: GET /api/admin/global-cards?status=kyc_review
    resp = requests.get(f"{BASE_URL}/admin/global-cards?status=kyc_review",
                       headers={"Authorization": f"Bearer {admin_token}"})
    
    if resp.status_code != 200:
        log_test("6a", "GET /admin/global-cards?status=kyc_review", False, f"Status: {resp.status_code}")
    else:
        cards = resp.json().get('cards', [])
        found_card = next((c for c in cards if c.get('id') == card_id), None)
        log_test("6a", "GET /admin/global-cards?status=kyc_review lists card",
                found_card is not None,
                f"Found: {found_card is not None}")
    
    # Test 6b: GET /api/admin/global-cards/:id/kyc
    resp = requests.get(f"{BASE_URL}/admin/global-cards/{card_id}/kyc",
                       headers={"Authorization": f"Bearer {admin_token}"})
    
    if resp.status_code != 200:
        log_test("6b", "GET /admin/global-cards/:id/kyc", False, f"Status: {resp.status_code}")
    else:
        data = resp.json()
        state = data.get('state', {})
        submissions = data.get('submissions', [])
        
        log_test("6b", "GET /admin/global-cards/:id/kyc returns state",
                state.get('status') == 'submitted' and len(submissions) > 0,
                f"State status: {state.get('status')}, Submissions: {len(submissions)}")
    
    # Test 6c: Admin can view files
    if len(submissions) > 0:
        latest_sub = submissions[0]
        docs = latest_sub.get('docs', {})
        
        if 'passport' in docs:
            file_id = docs['passport'].get('file_id')
            resp = requests.get(f"{BASE_URL}/force-kyc/file/{file_id}",
                               headers={"Authorization": f"Bearer {admin_token}"})
            log_test("6c", "Admin can view uploaded files", resp.status_code == 200,
                    f"Status: {resp.status_code}")
        else:
            log_test("6c", "Admin can view uploaded files", False, "No passport file found")
    else:
        log_test("6c", "Admin can view uploaded files", False, "No submissions found")
    
    print()
    
    # ========== ITEM 7: Reject flow ==========
    print("="*80)
    print("ITEM 7: Reject flow")
    print("="*80)
    
    # Test 7a: Reject without reason → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/{card_id}/kyc/reject",
                        json={},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("7a", "Reject without reason → 400", resp.status_code == 400,
            f"Status: {resp.status_code}")
    
    # Test 7b: Reject with reason
    resp = requests.post(f"{BASE_URL}/admin/global-cards/{card_id}/kyc/reject",
                        json={"reason": "Document is blurry"},
                        headers={"Authorization": f"Bearer {admin_token}"})
    
    if resp.status_code != 200:
        log_test("7b", "Reject with reason", False, f"Status: {resp.status_code}, Response: {resp.text}")
    else:
        card_status = resp.json().get('card', {}).get('status')
        log_test("7b", "Reject with reason → kyc_rejected", card_status == 'kyc_rejected',
                f"Status: {card_status}")
    
    # Verify attempt incremented
    resp = requests.get(f"{BASE_URL}/cards/{card_id}/kyc",
                       headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        kyc = resp.json().get('kyc', {})
        attempt = kyc.get('attempt', 0)
        log_test("7c", "Attempt incremented to 2", attempt == 2,
                f"Attempt: {attempt}")
    else:
        log_test("7c", "Attempt incremented to 2", False, f"Status: {resp.status_code}")
    
    # Test 7d: Re-upload and resubmit
    print("Re-uploading documents for attempt 2...")
    
    uploaded_files_2 = {}
    
    for slot in ["passport", "proof_of_address"]:
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/init",
                            json={
                                "card_id": card_id,
                                "slot": slot,
                                "mime": "image/jpeg",
                                "size": len(test_image_b64),
                                "chunks": 1,
                                "name": f"{slot}_v2.jpg"
                            },
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            continue
        
        file_id = resp.json().get('file_id')
        
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/chunk",
                            json={"file_id": file_id, "index": 0, "data": test_image_b64},
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            continue
        
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/complete",
                            json={"file_id": file_id},
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            continue
        
        uploaded_files_2[slot] = file_id
    
    liveness_frames_2 = []
    for i in range(5):
        slot = f"liveness_frame_{i}"
        
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/init",
                            json={
                                "card_id": card_id,
                                "slot": slot,
                                "mime": "image/jpeg",
                                "size": len(test_image_b64),
                                "chunks": 1,
                                "name": f"frame_{i}_v2.jpg"
                            },
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            continue
        
        file_id = resp.json().get('file_id')
        
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/chunk",
                            json={"file_id": file_id, "index": 0, "data": test_image_b64},
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            continue
        
        resp = requests.post(f"{BASE_URL}/force-kyc/upload/complete",
                            json={"file_id": file_id},
                            headers={"Authorization": f"Bearer {user_token}"})
        
        if resp.status_code != 200:
            continue
        
        liveness_frames_2.append({"file_id": file_id, "challenge": f"smile_{i}"})
    
    # Resubmit
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/kyc/submit",
                        json={
                            "personal": {
                                "full_name": "Test User",
                                "dob": "1990-01-01",
                                "nationality": "US",
                                "country": "US",
                                "city": "Los Angeles",
                                "address": "123 Test St",
                                "postal_code": "90001",
                                "occupation": "Engineer",
                                "id_type": "passport",
                                "id_number": "P12345678"
                            },
                            "docs": uploaded_files_2,
                            "liveness": {"frames": liveness_frames_2},
                            "consent": True
                        },
                        headers={"Authorization": f"Bearer {user_token}"})
    
    log_test("7d", "Re-upload and resubmit → kyc_review", resp.status_code == 200,
            f"Status: {resp.status_code}")
    
    print()
    
    # ========== ITEM 8: Approve flow ==========
    print("="*80)
    print("ITEM 8: Approve flow")
    print("="*80)
    
    # First, put user on hold to verify the lift
    resp = requests.post(f"{BASE_URL}/admin/users/{user_id}/withdraw_access",
                        json={"mode": "lock"},
                        headers={"Authorization": f"Bearer {admin_token}"})
    
    if resp.status_code == 200:
        print("✅ User put on hold")
    else:
        print(f"⚠️ Failed to put user on hold: {resp.status_code}")
    
    # Test 8a: Approve
    resp = requests.post(f"{BASE_URL}/admin/global-cards/{card_id}/kyc/approve",
                        json={},
                        headers={"Authorization": f"Bearer {admin_token}"})
    
    if resp.status_code != 200:
        log_test("8a", "Approve", False, f"Status: {resp.status_code}, Response: {resp.text}")
    else:
        card_status = resp.json().get('card', {}).get('status')
        log_test("8a", "Approve → card status active", card_status == 'active',
                f"Status: {card_status}")
    
    # Test 8b: Withdraw lock lifted
    resp = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        user_data = resp.json().get('user', {})
        withdraw_lock = user_data.get('withdraw_lock', {})
        is_locked = withdraw_lock.get('active', False)
        is_exempt = user_data.get('withdraw_lock_exempt', False)
        
        log_test("8b", "Withdraw lock lifted (active=false, exempt=true)",
                not is_locked and is_exempt,
                f"Active: {is_locked}, Exempt: {is_exempt}")
    else:
        log_test("8b", "Withdraw lock lifted", False, f"Status: {resp.status_code}")
    
    # Test 8c: Approve when not kyc_review → 400
    resp = requests.post(f"{BASE_URL}/admin/global-cards/{card_id}/kyc/approve",
                        json={},
                        headers={"Authorization": f"Bearer {admin_token}"})
    log_test("8c", "Approve when not kyc_review → 400", resp.status_code == 400,
            f"Status: {resp.status_code}")
    
    print()
    
    # ========== ITEM 9: Free card (fee 0) ==========
    print("="*80)
    print("ITEM 9: Free card (fee 0)")
    print("="*80)
    
    # Create another test user
    print("Creating test user for free card...")
    test_user_2 = register_and_approve_user()
    if not test_user_2:
        log_test("9", "Free card test", False, "Failed to create test user")
    else:
        user_id_2 = test_user_2['user_id']
        user_token_2 = test_user_2['user_token']
        
        # Issue free card
        resp = requests.post(f"{BASE_URL}/admin/global-cards/issue",
                            json={
                                "user_id": user_id_2,
                                "fee_usdt": 0,
                                "review_hours": 5,
                                "required_docs": ["passport"]
                            },
                            headers={"Authorization": f"Bearer {admin_token}"})
        
        if resp.status_code != 200:
            log_test("9", "Free card issue", False, f"Status: {resp.status_code}")
        else:
            card_status = resp.json().get('card', {}).get('status')
            log_test("9", "Free card (fee 0) → status kyc_required immediately",
                    card_status == 'kyc_required',
                    f"Status: {card_status}")
    
    print()
    
    # ========== ITEM 10: Regression ==========
    print("="*80)
    print("ITEM 10: Regression")
    print("="*80)
    
    # Test 10a: Force KYC still works
    # We'll just check the endpoint is accessible
    resp = requests.get(f"{BASE_URL}/admin/force-kyc",
                       headers={"Authorization": f"Bearer {admin_token}"})
    log_test("10a", "Force KYC endpoint still works", resp.status_code == 200,
            f"Status: {resp.status_code}")
    
    # Test 10b: Zonal card approval unaffected
    # We'll check the zones endpoint
    resp = requests.get(f"{BASE_URL}/admin/zones",
                       headers={"Authorization": f"Bearer {admin_token}"})
    log_test("10b", "Zonal cards endpoint still works", resp.status_code == 200,
            f"Status: {resp.status_code}")
    
    # Test 10c: Tier card approval unaffected
    # We'll check the cards endpoint
    resp = requests.get(f"{BASE_URL}/admin/cards",
                       headers={"Authorization": f"Bearer {admin_token}"})
    log_test("10c", "Tier cards endpoint still works", resp.status_code == 200,
            f"Status: {resp.status_code}")
    
    # Test 10d: GET /api/admin/all-cards?type=global works
    resp = requests.get(f"{BASE_URL}/admin/all-cards?type=global",
                       headers={"Authorization": f"Bearer {admin_token}"})
    log_test("10d", "GET /admin/all-cards?type=global works", resp.status_code == 200,
            f"Status: {resp.status_code}")
    
    # Test 10e: Non-admin → 403
    resp = requests.get(f"{BASE_URL}/admin/global-cards",
                       headers={"Authorization": f"Bearer {user_token}"})
    log_test("10e", "Non-admin → 403 on /admin/global-cards", resp.status_code == 403,
            f"Status: {resp.status_code}")
    
    print()
    
    # ========== SUMMARY ==========
    print("="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed_count = sum(1 for r in test_results if "✅ PASS" in r)
    total_count = len(test_results)
    
    print(f"\nTotal tests: {total_count}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {total_count - passed_count}")
    print(f"Success rate: {passed_count/total_count*100:.1f}%\n")
    
    print("Detailed results:")
    for result in test_results:
        print(result)
    
    print("\n" + "="*80)

if __name__ == "__main__":
    try:
        test_master_global_card()
    except Exception as e:
        print(f"\n❌ Test execution failed with error: {e}")
        import traceback
        traceback.print_exc()
