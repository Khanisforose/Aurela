#!/usr/bin/env python3
"""
Force KYC Mode Backend Test - Items 5-9 + Admin Doc Viewing
Focus: Submit validation, admin review, reject/approve/cancel flows, and ADMIN DOC VIEWING
"""

import requests
import json
import time
import base64
import os
from datetime import datetime
from pymongo import MongoClient

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://aurela-preview.preview.emergentagent.com') + '/api'
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'aurela')
ADMIN_EMAIL = 'admin@aurelawallet.com'
ADMIN_PASSWORD = 'Aurela@123#'

# Test state
admin_token = None
test_user_ids = []

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def wait_for_server():
    """Wait for server to be ready, handle OOM restarts"""
    log("Waiting for server...")
    for i in range(15):
        try:
            resp = requests.get(f"{BASE_URL.replace('/api', '')}/api/health", timeout=5)
            if resp.status_code == 200:
                log("✅ Server ready")
                return True
        except requests.exceptions.ConnectionError:
            if i > 0:
                log(f"Connection refused, waiting 30s for potential OOM restart... (attempt {i+1}/15)")
                time.sleep(30)
            else:
                time.sleep(3)
        except Exception as e:
            log(f"Server check error: {e}")
            time.sleep(3)
    return False

def register_and_setup_user(suffix):
    """Register user, approve KYC, fund wallet"""
    ts = int(time.time() * 1000)
    email = f"TEST_fkyc_{suffix}_{ts}@test.io"
    
    # Register
    resp = requests.post(f"{BASE_URL}/auth/register/init", json={
        'first_name': 'TestForce', 'last_name': f'User{suffix}',
        'email': email, 'country': 'United States',
        'phone': '+1234567890', 'password': 'TestPass123#'
    }, timeout=10)
    
    if resp.status_code != 200:
        log(f"❌ Register failed: {resp.status_code}")
        return None
    
    data = resp.json()
    otp = data.get('dev_otp')
    
    # If no dev_otp in response, fetch from DB
    if not otp:
        signup_id = data.get('signup_id')
        if signup_id:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            signup = db.pending_signups.find_one({'id': signup_id})
            if signup:
                otp = signup.get('code')
    
    if not otp:
        log("❌ No OTP received")
        return None
    
    # Verify
    resp = requests.post(f"{BASE_URL}/auth/register/verify", json={
        'signup_id': data['signup_id'], 'code': otp
    }, timeout=10)
    
    if resp.status_code != 200:
        log(f"❌ Verify failed: {resp.status_code}")
        return None
    
    user_data = resp.json()
    user_id = user_data['user']['id']
    token = user_data['token']
    
    test_user_ids.append(user_id)
    
    # Approve KYC and fund via DB
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    db.users.update_one({'id': user_id}, {'$set': {'kyc_status': 'approved'}})
    db.wallets.update_one({'user_id': user_id, 'currency': 'USD'}, {'$set': {'balance': 1000}})
    db.wallets.update_one({'user_id': user_id, 'currency': 'USDT'}, {'$set': {'balance': 500}})
    
    log(f"✅ User {suffix} ready: {user_id[:8]}")
    return {'id': user_id, 'token': token, 'email': email}

def upload_file(token, slot, mime='image/jpeg', content=None):
    """Upload a file and return file_id"""
    # Default: 1x1 JPEG
    if content is None:
        img_b64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k='
        img_bytes = base64.b64decode(img_b64)
    else:
        img_b64 = base64.b64encode(content).decode()
        img_bytes = content
    
    # Init
    resp = requests.post(f"{BASE_URL}/force-kyc/upload/init", json={
        'slot': slot, 'mime': mime, 'size': len(img_bytes), 'chunks': 1, 'name': f'{slot}.jpg'
    }, headers={'Authorization': f'Bearer {token}'}, timeout=10)
    
    if resp.status_code != 200:
        log(f"❌ Upload init failed for {slot}: {resp.status_code}")
        return None
    
    file_id = resp.json()['file_id']
    
    # Chunk
    resp = requests.post(f"{BASE_URL}/force-kyc/upload/chunk", json={
        'file_id': file_id, 'index': 0, 'data': img_b64
    }, headers={'Authorization': f'Bearer {token}'}, timeout=10)
    
    if resp.status_code != 200:
        log(f"❌ Upload chunk failed for {slot}: {resp.status_code}")
        return None
    
    # Complete
    resp = requests.post(f"{BASE_URL}/force-kyc/upload/complete", json={
        'file_id': file_id
    }, headers={'Authorization': f'Bearer {token}'}, timeout=10)
    
    if resp.status_code != 200:
        log(f"❌ Upload complete failed for {slot}: {resp.status_code}")
        return None
    
    return file_id

def cleanup():
    """Delete test users"""
    if not test_user_ids:
        return
    
    log(f"Cleaning up {len(test_user_ids)} test users...")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    db.users.delete_many({'id': {'$in': test_user_ids}})
    db.wallets.delete_many({'user_id': {'$in': test_user_ids}})
    db.sessions.delete_many({'user_id': {'$in': test_user_ids}})
    db.fkyc_files.delete_many({'user_id': {'$in': test_user_ids}})
    db.fkyc_chunks.delete_many({'file_id': {'$regex': '^'}})  # Clean all chunks for simplicity
    db.fkyc_submissions.delete_many({'user_id': {'$in': test_user_ids}})
    db.notifications.delete_many({'user_id': {'$in': test_user_ids}})
    db.transactions.delete_many({'$or': [{'from_user_id': {'$in': test_user_ids}}, {'to_user_id': {'$in': test_user_ids}}]})
    
    log("✅ Cleanup complete")

def main():
    global admin_token
    
    log("=" * 70)
    log("FORCE KYC MODE BACKEND TEST - ITEMS 5-9 + ADMIN DOC VIEWING")
    log("=" * 70)
    
    # Wait for server
    if not wait_for_server():
        log("❌ Server not ready after 15 attempts")
        return
    
    # Admin login
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            'identifier': ADMIN_EMAIL, 'password': ADMIN_PASSWORD
        }, timeout=10)
        
        if resp.status_code != 200:
            log(f"❌ Admin login failed: {resp.status_code}")
            return
        
        admin_token = resp.json()['token']
        log("✅ Admin logged in")
    except Exception as e:
        log(f"❌ Admin login exception: {e}")
        return
    
    results = {}
    
    try:
        # ===== ITEM 5: Submit validation =====
        log("\n" + "=" * 70)
        log("ITEM 5: Submit Validation")
        log("=" * 70)
        
        user1 = register_and_setup_user("submit_val")
        if not user1:
            results['5_submit_validation'] = False
            log("❌ ITEM 5: FAIL - Could not create user")
        else:
            # Enable force KYC
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/enable", json={
                'user_id': user1['id'],
                'required_docs': ['id_front', 'proof_of_address', 'tax_id'],
                'reason': 'Test validation'
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code != 200:
                log(f"❌ Enable failed: {resp.status_code}")
                results['5_submit_validation'] = False
            else:
                # Upload required docs
                id_front = upload_file(user1['token'], 'id_front')
                proof_addr = upload_file(user1['token'], 'proof_of_address')
                tax_id = upload_file(user1['token'], 'tax_id')
                
                # Upload 5 liveness frames
                frames = []
                for i in range(5):
                    fid = upload_file(user1['token'], f'liveness_frame_{i}')
                    if fid:
                        frames.append({'file_id': fid, 'challenge': 'center', 'at': datetime.now().isoformat()})
                
                # Test 5a: Missing personal fields → 400
                resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                    'personal': {}, 'docs': {}, 'liveness': {'frames': frames}, 'consent': True
                }, headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
                test_5a = resp.status_code == 400 and 'missing' in resp.json()
                log(f"{'✅' if test_5a else '❌'} 5a: Missing personal fields → 400")
                
                # Test 5b: Missing tax_id_number when tax_id doc required → 400
                resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                    'personal': {
                        'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                        'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                        'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                        'id_number': 'P123456789'
                        # Missing tax_id_number
                    },
                    'docs': {'id_front': id_front, 'proof_of_address': proof_addr, 'tax_id': tax_id},
                    'liveness': {'frames': frames}, 'consent': True
                }, headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
                test_5b = resp.status_code == 400 and 'tax id number' in resp.text.lower()
                log(f"{'✅' if test_5b else '❌'} 5b: Missing tax_id_number → 400")
                
                # Test 5c: consent false → 400
                resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                    'personal': {
                        'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                        'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                        'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                        'id_number': 'P123456789', 'tax_id_number': '123-45-6789'
                    },
                    'docs': {'id_front': id_front, 'proof_of_address': proof_addr, 'tax_id': tax_id},
                    'liveness': {'frames': frames}, 'consent': False
                }, headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
                test_5c = resp.status_code == 400
                log(f"{'✅' if test_5c else '❌'} 5c: consent false → 400")
                
                # Test 5d: Missing doc → 400 (missing_docs)
                resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                    'personal': {
                        'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                        'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                        'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                        'id_number': 'P123456789', 'tax_id_number': '123-45-6789'
                    },
                    'docs': {'id_front': id_front, 'proof_of_address': proof_addr},  # Missing tax_id
                    'liveness': {'frames': frames}, 'consent': True
                }, headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
                test_5d = resp.status_code == 400 and 'missing_docs' in resp.json()
                log(f"{'✅' if test_5d else '❌'} 5d: Missing doc → 400 (missing_docs)")
                
                # Test 5e: <4 frames → 400 code LIVENESS_REQUIRED
                resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                    'personal': {
                        'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                        'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                        'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                        'id_number': 'P123456789', 'tax_id_number': '123-45-6789'
                    },
                    'docs': {'id_front': id_front, 'proof_of_address': proof_addr, 'tax_id': tax_id},
                    'liveness': {'frames': frames[:3]}, 'consent': True
                }, headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
                test_5e = resp.status_code == 400 and resp.json().get('code') == 'LIVENESS_REQUIRED'
                log(f"{'✅' if test_5e else '❌'} 5e: <4 frames → 400 code LIVENESS_REQUIRED")
                
                # Test 5f: Valid submit → status 'submitted', review_due_at ≈ +48h
                # Upload liveness video
                video_bytes = b'WEBM_FAKE_VIDEO_DATA_FOR_TESTING'
                video_id = upload_file(user1['token'], 'liveness_video', mime='video/webm', content=video_bytes)
                
                resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                    'personal': {
                        'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                        'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                        'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                        'id_number': 'P123456789', 'tax_id_number': '123-45-6789'
                    },
                    'docs': {'id_front': id_front, 'proof_of_address': proof_addr, 'tax_id': tax_id},
                    'liveness': {
                        'video_file_id': video_id,
                        'frames': frames,
                        'challenges': ['center', 'left', 'right', 'smile', 'blink']
                    },
                    'consent': True
                }, headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
                
                if resp.status_code == 200:
                    review_due = resp.json().get('review_due_at')
                    # Check if review_due_at is approximately +48h (within 49h)
                    if review_due:
                        due_time = datetime.fromisoformat(review_due.replace('Z', '+00:00'))
                        now_time = datetime.now(due_time.tzinfo)
                        hours_diff = (due_time - now_time).total_seconds() / 3600
                        test_5f = 47 <= hours_diff <= 49
                    else:
                        test_5f = False
                else:
                    test_5f = False
                log(f"{'✅' if test_5f else '❌'} 5f: Valid submit → status 'submitted', review_due_at ≈ +48h")
                
                # Test 5g: Second submit → 400
                resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                    'personal': {
                        'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                        'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                        'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                        'id_number': 'P123456789', 'tax_id_number': '123-45-6789'
                    },
                    'docs': {'id_front': id_front, 'proof_of_address': proof_addr, 'tax_id': tax_id},
                    'liveness': {'video_file_id': video_id, 'frames': frames}, 'consent': True
                }, headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
                test_5g = resp.status_code == 400
                log(f"{'✅' if test_5g else '❌'} 5g: Second submit → 400")
                
                results['5_submit_validation'] = test_5a and test_5b and test_5c and test_5d and test_5e and test_5f and test_5g
                log(f"\n{'✅ PASS' if results['5_submit_validation'] else '❌ FAIL'} - ITEM 5: Submit Validation")
        
        # ===== ITEM 6: GET /api/admin/force-kyc?status=submitted lists user with counts =====
        log("\n" + "=" * 70)
        log("ITEM 6: Admin List Submitted")
        log("=" * 70)
        
        resp = requests.get(f"{BASE_URL}/admin/force-kyc", params={'status': 'submitted'},
                          headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            test_6a = 'users' in data and 'counts' in data
            test_6b = len(data.get('users', [])) > 0  # Should have at least user1
            results['6_admin_list'] = test_6a and test_6b
            log(f"{'✅' if test_6a else '❌'} 6a: Response has users and counts")
            log(f"{'✅' if test_6b else '❌'} 6b: Users list contains submitted user")
            log(f"\n{'✅ PASS' if results['6_admin_list'] else '❌ FAIL'} - ITEM 6: Admin List Submitted")
        else:
            results['6_admin_list'] = False
            log(f"❌ FAIL - ITEM 6: Status {resp.status_code}")
        
        # ===== MOST IMPORTANT: Admin can view submitted docs and liveness video =====
        log("\n" + "=" * 70)
        log("MOST IMPORTANT: ADMIN CAN VIEW SUBMITTED DOCS AND LIVENESS VIDEO")
        log("=" * 70)
        
        if user1:
            # Get submission details
            resp = requests.get(f"{BASE_URL}/admin/force-kyc/{user1['id']}",
                              headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                submissions = data.get('submissions', [])
                
                if len(submissions) > 0:
                    latest_sub = submissions[0]
                    docs = latest_sub.get('docs', {})
                    liveness = latest_sub.get('liveness', {})
                    
                    log(f"Latest submission has {len(docs)} docs and {len(liveness.get('frames', []))} frames")
                    
                    # Test: Admin can download all doc files
                    doc_tests = []
                    for slot, doc_info in docs.items():
                        file_id = doc_info.get('file_id')
                        expected_mime = doc_info.get('mime')
                        
                        resp = requests.get(f"{BASE_URL}/force-kyc/file/{file_id}",
                                          headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
                        
                        test_pass = resp.status_code == 200 and resp.headers.get('Content-Type') == expected_mime
                        doc_tests.append(test_pass)
                        log(f"{'✅' if test_pass else '❌'} Admin download {slot}: {resp.status_code}, Content-Type: {resp.headers.get('Content-Type')}")
                    
                    # Test: Admin can download all liveness frames
                    frame_tests = []
                    for frame in liveness.get('frames', []):
                        file_id = frame.get('file_id')
                        
                        resp = requests.get(f"{BASE_URL}/force-kyc/file/{file_id}",
                                          headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
                        
                        test_pass = resp.status_code == 200 and resp.headers.get('Content-Type', '').startswith('image/')
                        frame_tests.append(test_pass)
                        log(f"{'✅' if test_pass else '❌'} Admin download frame {file_id[:8]}: {resp.status_code}")
                    
                    # Test: Admin can download liveness video
                    video_file_id = liveness.get('video_file_id')
                    if video_file_id:
                        resp = requests.get(f"{BASE_URL}/force-kyc/file/{video_file_id}",
                                          headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
                        
                        video_test = resp.status_code == 200 and resp.headers.get('Content-Type') == 'video/webm'
                        video_bytes_match = resp.content == b'WEBM_FAKE_VIDEO_DATA_FOR_TESTING'
                        log(f"{'✅' if video_test else '❌'} Admin download video: {resp.status_code}, Content-Type: {resp.headers.get('Content-Type')}")
                        log(f"{'✅' if video_bytes_match else '❌'} Video bytes match uploaded content")
                    else:
                        video_test = False
                        video_bytes_match = False
                        log("❌ No video_file_id in submission")
                    
                    # Test: Non-admin user cannot access another user's files
                    user2 = register_and_setup_user("non_admin")
                    if user2 and video_file_id:
                        resp = requests.get(f"{BASE_URL}/force-kyc/file/{video_file_id}",
                                          headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
                        non_admin_test = resp.status_code == 404
                        log(f"{'✅' if non_admin_test else '❌'} Non-admin access to other user's file → 404")
                    else:
                        non_admin_test = True  # Skip if can't create user
                    
                    results['admin_view_docs'] = all(doc_tests) and all(frame_tests) and video_test and video_bytes_match and non_admin_test
                    log(f"\n{'✅ PASS' if results['admin_view_docs'] else '❌ FAIL'} - ADMIN DOC VIEWING")
                else:
                    results['admin_view_docs'] = False
                    log("❌ No submissions found")
            else:
                results['admin_view_docs'] = False
                log(f"❌ Failed to get submission details: {resp.status_code}")
        else:
            results['admin_view_docs'] = False
        
        # ===== ITEM 7: Reject flow =====
        log("\n" + "=" * 70)
        log("ITEM 7: Reject Flow")
        log("=" * 70)
        
        user3 = register_and_setup_user("reject")
        if not user3:
            results['7_reject'] = False
            log("❌ ITEM 7: FAIL - Could not create user")
        else:
            # Enable, upload, submit
            requests.post(f"{BASE_URL}/admin/force-kyc/enable", json={
                'user_id': user3['id'], 'required_docs': ['id_front'], 'reason': 'Test reject'
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            id_front = upload_file(user3['token'], 'id_front')
            frames = []
            for i in range(5):
                fid = upload_file(user3['token'], f'liveness_frame_{i}')
                if fid:
                    frames.append({'file_id': fid, 'challenge': 'center', 'at': datetime.now().isoformat()})
            
            requests.post(f"{BASE_URL}/force-kyc/submit", json={
                'personal': {
                    'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                    'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                    'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                    'id_number': 'P123456789'
                },
                'docs': {'id_front': id_front}, 'liveness': {'frames': frames}, 'consent': True
            }, headers={'Authorization': f'Bearer {user3["token"]}'}, timeout=10)
            
            # Test 7a: Reject without reason → 400
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/{user3['id']}/reject", json={},
                               headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            test_7a = resp.status_code == 400
            log(f"{'✅' if test_7a else '❌'} 7a: Reject without reason → 400")
            
            # Test 7b: Reject with reason → status rejected, attempt 2
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/{user3['id']}/reject", json={
                'reason': 'Document is blurry', 'required_docs': ['id_front']
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code == 200:
                fk = resp.json().get('force_kyc', {})
                test_7b = fk.get('status') == 'rejected' and fk.get('attempt') == 2
                log(f"{'✅' if test_7b else '❌'} 7b: Reject → status rejected, attempt 2")
            else:
                test_7b = False
                log(f"❌ 7b: Reject failed: {resp.status_code}")
            
            # Test 7c: Still locked (POST /api/transfer → 423)
            resp = requests.post(f"{BASE_URL}/transfer", json={
                'recipient': ADMIN_EMAIL, 'currency': 'USD', 'amount': 10
            }, headers={'Authorization': f'Bearer {user3["token"]}'}, timeout=10)
            test_7c = resp.status_code == 423
            log(f"{'✅' if test_7c else '❌'} 7c: Still locked after rejection (transfer → 423)")
            
            # Test 7d: Submitting with attempt-1 file ids → 400
            resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                'personal': {
                    'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                    'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                    'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                    'id_number': 'P123456789'
                },
                'docs': {'id_front': id_front},  # Old attempt-1 file
                'liveness': {'frames': frames}, 'consent': True
            }, headers={'Authorization': f'Bearer {user3["token"]}'}, timeout=10)
            test_7d = resp.status_code == 400
            log(f"{'✅' if test_7d else '❌'} 7d: Submitting with attempt-1 file ids → 400")
            
            # Test 7e: Re-upload attempt-2 files + new frames → submit OK
            id_front_2 = upload_file(user3['token'], 'id_front')
            frames_2 = []
            for i in range(5):
                fid = upload_file(user3['token'], f'liveness_frame_{i}')
                if fid:
                    frames_2.append({'file_id': fid, 'challenge': 'center', 'at': datetime.now().isoformat()})
            
            resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                'personal': {
                    'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                    'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                    'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                    'id_number': 'P123456789'
                },
                'docs': {'id_front': id_front_2}, 'liveness': {'frames': frames_2}, 'consent': True
            }, headers={'Authorization': f'Bearer {user3["token"]}'}, timeout=10)
            test_7e = resp.status_code == 200
            log(f"{'✅' if test_7e else '❌'} 7e: Re-upload attempt-2 files → submit OK")
            
            results['7_reject'] = test_7a and test_7b and test_7c and test_7d and test_7e
            log(f"\n{'✅ PASS' if results['7_reject'] else '❌ FAIL'} - ITEM 7: Reject Flow")
        
        # ===== ITEM 8: Approve flow =====
        log("\n" + "=" * 70)
        log("ITEM 8: Approve Flow")
        log("=" * 70)
        
        if user1:
            # Approve user1
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/{user1['id']}/approve", json={},
                               headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code == 200:
                fk = resp.json().get('force_kyc', {})
                test_8a = not fk.get('active') and fk.get('status') == 'approved'
                log(f"{'✅' if test_8a else '❌'} 8a: Approve → force_kyc.active false, status approved")
            else:
                test_8a = False
                log(f"❌ 8a: Approve failed: {resp.status_code}")
            
            # Test 8b: kyc_status approved
            resp = requests.get(f"{BASE_URL}/auth/me",
                              headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
            test_8b = resp.json().get('user', {}).get('kyc_status') == 'approved'
            log(f"{'✅' if test_8b else '❌'} 8b: kyc_status approved")
            
            # Test 8c: User POST no longer 423
            resp = requests.post(f"{BASE_URL}/transfer", json={
                'recipient': ADMIN_EMAIL, 'currency': 'USD', 'amount': 10
            }, headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
            test_8c = resp.status_code != 423
            log(f"{'✅' if test_8c else '❌'} 8c: User POST no longer 423 (transfer status: {resp.status_code})")
            
            results['8_approve'] = test_8a and test_8b and test_8c
            log(f"\n{'✅ PASS' if results['8_approve'] else '❌ FAIL'} - ITEM 8: Approve Flow")
        else:
            results['8_approve'] = False
        
        # ===== ITEM 9: Cancel flow =====
        log("\n" + "=" * 70)
        log("ITEM 9: Cancel Flow")
        log("=" * 70)
        
        user4 = register_and_setup_user("cancel")
        if not user4:
            results['9_cancel'] = False
            log("❌ ITEM 9: FAIL - Could not create user")
        else:
            # Enable
            requests.post(f"{BASE_URL}/admin/force-kyc/enable", json={
                'user_id': user4['id'], 'required_docs': ['id_front'], 'reason': 'Test cancel'
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            # Cancel
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/{user4['id']}/cancel", json={},
                               headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code == 200:
                fk = resp.json().get('force_kyc', {})
                test_9a = not fk.get('active') and fk.get('status') == 'cancelled'
                log(f"{'✅' if test_9a else '❌'} 9a: Cancel → active false, status cancelled")
            else:
                test_9a = False
                log(f"❌ 9a: Cancel failed: {resp.status_code}")
            
            # Test 9b: Unlocked
            resp = requests.post(f"{BASE_URL}/transfer", json={
                'recipient': ADMIN_EMAIL, 'currency': 'USD', 'amount': 10
            }, headers={'Authorization': f'Bearer {user4["token"]}'}, timeout=10)
            test_9b = resp.status_code != 423
            log(f"{'✅' if test_9b else '❌'} 9b: Unlocked after cancel (transfer status: {resp.status_code})")
            
            results['9_cancel'] = test_9a and test_9b
            log(f"\n{'✅ PASS' if results['9_cancel'] else '❌ FAIL'} - ITEM 9: Cancel Flow")
        
    except Exception as e:
        log(f"❌ Exception: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        cleanup()
    
    # Summary
    log("\n" + "=" * 70)
    log("TEST SUMMARY")
    log("=" * 70)
    
    for test, passed in results.items():
        log(f"{'✅ PASS' if passed else '❌ FAIL'} - {test}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    log(f"\nTotal: {passed}/{total} tests passed ({passed*100//total if total > 0 else 0}%)")
    
    if results.get('admin_view_docs'):
        log("\n🎉 MOST IMPORTANT TEST PASSED: Admin can view submitted docs and liveness video!")
    else:
        log("\n❌ CRITICAL: Admin doc viewing test FAILED")

if __name__ == '__main__':
    main()
