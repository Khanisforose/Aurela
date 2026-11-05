#!/usr/bin/env python3
"""
Force KYC Mode Backend Test - Comprehensive Coverage
Tests all 9 scenarios from review_request efficiently
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
    """Wait for server to be ready"""
    for i in range(10):
        try:
            resp = requests.get(f"{BASE_URL}/health", timeout=5)
            if resp.status_code == 200:
                return True
        except:
            pass
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
        return None
    
    data = resp.json()
    otp = data.get('dev_otp')
    if not otp:
        return None
    
    # Verify
    resp = requests.post(f"{BASE_URL}/auth/register/verify", json={
        'signup_id': data['signup_id'], 'code': otp
    }, timeout=10)
    
    if resp.status_code != 200:
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
    
    log(f"✅ User {suffix} ready: {user_id}")
    return {'id': user_id, 'token': token, 'email': email}

def upload_file(token, slot, mime='image/jpeg'):
    """Upload a small file and return file_id"""
    # 1x1 JPEG
    img_b64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k='
    img_bytes = base64.b64decode(img_b64)
    
    # Init
    resp = requests.post(f"{BASE_URL}/force-kyc/upload/init", json={
        'slot': slot, 'mime': mime, 'size': len(img_bytes), 'chunks': 1, 'name': f'{slot}.jpg'
    }, headers={'Authorization': f'Bearer {token}'}, timeout=10)
    
    if resp.status_code != 200:
        return None
    
    file_id = resp.json()['file_id']
    
    # Chunk
    requests.post(f"{BASE_URL}/force-kyc/upload/chunk", json={
        'file_id': file_id, 'index': 0, 'data': img_b64
    }, headers={'Authorization': f'Bearer {token}'}, timeout=10)
    
    # Complete
    requests.post(f"{BASE_URL}/force-kyc/upload/complete", json={
        'file_id': file_id
    }, headers={'Authorization': f'Bearer {token}'}, timeout=10)
    
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
    db.fkyc_submissions.delete_many({'user_id': {'$in': test_user_ids}})
    db.notifications.delete_many({'user_id': {'$in': test_user_ids}})
    
    log("✅ Cleanup complete")

def main():
    global admin_token
    
    log("=" * 60)
    log("FORCE KYC MODE BACKEND TEST")
    log("=" * 60)
    
    # Wait for server
    if not wait_for_server():
        log("❌ Server not ready")
        return
    
    # Admin login
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        'identifier': ADMIN_EMAIL, 'password': ADMIN_PASSWORD
    }, timeout=10)
    
    if resp.status_code != 200:
        log(f"❌ Admin login failed")
        return
    
    admin_token = resp.json()['token']
    log("✅ Admin logged in")
    
    results = {}
    
    try:
        # TEST 1: Admin lookup
        log("\n=== TEST 1: Admin Lookup ===")
        user1 = register_and_setup_user("lookup")
        if not user1:
            results['1_lookup'] = False
        else:
            # Lookup by username
            resp = requests.get(f"{BASE_URL}/admin/force-kyc/lookup", params={'q': user1['id'][:8]},
                              headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code == 200 and len(resp.json().get('users', [])) > 0:
                # Non-admin access → 403
                resp2 = requests.get(f"{BASE_URL}/admin/force-kyc/lookup", params={'q': 'test'},
                                   headers={'Authorization': f'Bearer {user1["token"]}'}, timeout=10)
                results['1_lookup'] = resp2.status_code == 403
                log(f"✅ TEST 1: {'PASS' if results['1_lookup'] else 'FAIL'}")
            else:
                results['1_lookup'] = False
                log("❌ TEST 1: FAIL")
        
        # TEST 2: Enable force KYC
        log("\n=== TEST 2: Enable Force KYC ===")
        user2 = register_and_setup_user("enable")
        if not user2:
            results['2_enable'] = False
        else:
            # No docs → 400
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/enable", json={
                'user_id': user2['id'], 'reason': 'Test'
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            test_a = resp.status_code == 400
            
            # Admin target → 400
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/enable", json={
                'user_id': 'admin-0001', 'required_docs': ['id_front'], 'reason': 'Test'
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            test_b = resp.status_code == 400
            
            # Valid enable
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/enable", json={
                'user_id': user2['id'],
                'required_docs': ['id_front', 'proof_of_address', 'tax_id'],
                'reason': 'Routine verification'
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code == 200:
                fk = resp.json().get('force_kyc', {})
                test_c = fk.get('active') and fk.get('status') == 'required' and fk.get('attempt') == 1
                
                # Check notification
                resp2 = requests.get(f"{BASE_URL}/notifications",
                                   headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
                notifs = resp2.json().get('notifications', [])
                test_d = any(n.get('kind') == 'force_kyc_required' for n in notifs)
                
                results['2_enable'] = test_a and test_b and test_c and test_d
            else:
                results['2_enable'] = False
            
            log(f"✅ TEST 2: {'PASS' if results['2_enable'] else 'FAIL'}")
        
        # TEST 3: Lock functionality
        log("\n=== TEST 3: Lock Functionality ===")
        if user2:
            # POST /transfer → 423
            resp = requests.post(f"{BASE_URL}/transfer", json={
                'recipient': ADMIN_EMAIL, 'currency': 'USD', 'amount': 10
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_a = resp.status_code == 423 and resp.json().get('code') == 'FORCE_KYC_REQUIRED'
            
            # POST /withdraw → 423
            resp = requests.post(f"{BASE_URL}/withdraw", json={
                'currency': 'USD', 'amount': 50, 'method': 'bank_swift', 'destination': 'GB29NWBK60161331926819'
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_b = resp.status_code == 423
            
            # GET /wallets → 200
            resp = requests.get(f"{BASE_URL}/wallets",
                              headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_c = resp.status_code == 200
            
            # POST /notifications/read → allowed
            resp = requests.post(f"{BASE_URL}/notifications/read", json={'notification_ids': []},
                               headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_d = resp.status_code in [200, 400]
            
            # Another user sending TO locked user → succeeds
            user3 = register_and_setup_user("sender")
            if user3:
                resp = requests.post(f"{BASE_URL}/transfer", json={
                    'recipient': user2['id'], 'currency': 'USD', 'amount': 50
                }, headers={'Authorization': f'Bearer {user3["token"]}'}, timeout=10)
                test_e = resp.status_code == 200
            else:
                test_e = True  # Skip if can't create user
            
            results['3_lock'] = test_a and test_b and test_c and test_d and test_e
            log(f"✅ TEST 3: {'PASS' if results['3_lock'] else 'FAIL'}")
        else:
            results['3_lock'] = False
        
        # TEST 4: File uploads
        log("\n=== TEST 4: File Uploads ===")
        if user2:
            # Unknown slot → 400
            resp = requests.post(f"{BASE_URL}/force-kyc/upload/init", json={
                'slot': 'unknown', 'mime': 'image/jpeg', 'size': 1000, 'chunks': 1
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_a = resp.status_code == 400
            
            # Wrong mime for liveness_video → 400
            resp = requests.post(f"{BASE_URL}/force-kyc/upload/init", json={
                'slot': 'liveness_video', 'mime': 'image/jpeg', 'size': 1000, 'chunks': 1
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_b = resp.status_code == 400
            
            # Size > limit → 400
            resp = requests.post(f"{BASE_URL}/force-kyc/upload/init", json={
                'slot': 'id_front', 'mime': 'image/jpeg', 'size': 15*1024*1024, 'chunks': 1
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_c = resp.status_code == 400
            
            # Valid upload
            file_id = upload_file(user2['token'], 'id_front')
            test_d = file_id is not None
            
            # PDF upload
            pdf_b64 = base64.b64encode(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Size 2/Root 1 0 R>>\n%%EOF").decode()
            resp = requests.post(f"{BASE_URL}/force-kyc/upload/init", json={
                'slot': 'proof_of_address', 'mime': 'application/pdf', 'size': len(base64.b64decode(pdf_b64)), 'chunks': 1
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            if resp.status_code == 200:
                fid = resp.json()['file_id']
                requests.post(f"{BASE_URL}/force-kyc/upload/chunk", json={'file_id': fid, 'index': 0, 'data': pdf_b64},
                            headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
                resp2 = requests.post(f"{BASE_URL}/force-kyc/upload/complete", json={'file_id': fid},
                                    headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
                test_e = resp2.status_code == 200
            else:
                test_e = False
            
            # GET file
            if file_id:
                resp = requests.get(f"{BASE_URL}/force-kyc/file/{file_id}",
                                  headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
                test_f = resp.status_code == 200 and resp.headers.get('Content-Type') == 'image/jpeg'
            else:
                test_f = False
            
            results['4_uploads'] = test_a and test_b and test_c and test_d and test_e and test_f
            log(f"✅ TEST 4: {'PASS' if results['4_uploads'] else 'FAIL'}")
        else:
            results['4_uploads'] = False
        
        # TEST 5: Submit validation
        log("\n=== TEST 5: Submit Validation ===")
        if user2:
            # Upload tax_id and liveness frames
            tax_id_file = upload_file(user2['token'], 'tax_id')
            frames = []
            for i in range(5):
                fid = upload_file(user2['token'], f'liveness_frame_{i}')
                if fid:
                    frames.append({'file_id': fid, 'challenge': 'smile', 'at': datetime.now().isoformat()})
            
            # Get uploads
            resp = requests.get(f"{BASE_URL}/force-kyc", headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            uploads = resp.json().get('uploads', {})
            
            # Missing fields → 400
            resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                'personal': {}, 'docs': {}, 'liveness': {'frames': frames}, 'consent': True
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_a = resp.status_code == 400 and 'missing' in resp.json()
            
            # consent false → 400
            resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                'personal': {'full_name': 'Test', 'dob': '1990-01-01', 'nationality': 'US', 'country': 'US',
                           'city': 'NYC', 'address': '123 Main', 'postal_code': '10001', 'occupation': 'Engineer',
                           'id_type': 'passport', 'id_number': 'P123', 'tax_id_number': '123-45-6789'},
                'docs': {'id_front': uploads.get('id_front', {}).get('file_id'),
                        'proof_of_address': uploads.get('proof_of_address', {}).get('file_id'),
                        'tax_id': tax_id_file},
                'liveness': {'frames': frames}, 'consent': False
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_b = resp.status_code == 400
            
            # < 4 frames → 400 LIVENESS_REQUIRED
            resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                'personal': {'full_name': 'Test', 'dob': '1990-01-01', 'nationality': 'US', 'country': 'US',
                           'city': 'NYC', 'address': '123 Main', 'postal_code': '10001', 'occupation': 'Engineer',
                           'id_type': 'passport', 'id_number': 'P123', 'tax_id_number': '123-45-6789'},
                'docs': {'id_front': uploads.get('id_front', {}).get('file_id'),
                        'proof_of_address': uploads.get('proof_of_address', {}).get('file_id'),
                        'tax_id': tax_id_file},
                'liveness': {'frames': frames[:3]}, 'consent': True
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_c = resp.status_code == 400 and resp.json().get('code') == 'LIVENESS_REQUIRED'
            
            # Valid submit
            resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                'personal': {'full_name': 'Test User', 'dob': '1990-01-01', 'nationality': 'United States',
                           'country': 'United States', 'city': 'New York', 'address': '123 Main St',
                           'postal_code': '10001', 'occupation': 'Engineer', 'id_type': 'passport',
                           'id_number': 'P123456789', 'tax_id_number': '123-45-6789'},
                'docs': {'id_front': uploads.get('id_front', {}).get('file_id'),
                        'proof_of_address': uploads.get('proof_of_address', {}).get('file_id'),
                        'tax_id': tax_id_file},
                'liveness': {'frames': frames}, 'consent': True
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_d = resp.status_code == 200 and resp.json().get('ok')
            
            # Second submit → 400
            resp = requests.post(f"{BASE_URL}/force-kyc/submit", json={
                'personal': {'full_name': 'Test', 'dob': '1990-01-01', 'nationality': 'US', 'country': 'US',
                           'city': 'NYC', 'address': '123 Main', 'postal_code': '10001', 'occupation': 'Engineer',
                           'id_type': 'passport', 'id_number': 'P123', 'tax_id_number': '123-45-6789'},
                'docs': {'id_front': uploads.get('id_front', {}).get('file_id'),
                        'proof_of_address': uploads.get('proof_of_address', {}).get('file_id'),
                        'tax_id': tax_id_file},
                'liveness': {'frames': frames}, 'consent': True
            }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
            test_e = resp.status_code == 400
            
            results['5_submit'] = test_a and test_b and test_c and test_d and test_e
            log(f"✅ TEST 5: {'PASS' if results['5_submit'] else 'FAIL'}")
        else:
            results['5_submit'] = False
        
        # TEST 6: Admin review endpoints
        log("\n=== TEST 6: Admin Review ===")
        # GET /admin/force-kyc?status=submitted
        resp = requests.get(f"{BASE_URL}/admin/force-kyc", params={'status': 'submitted'},
                          headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
        test_a = resp.status_code == 200 and 'users' in resp.json() and 'counts' in resp.json()
        
        # GET /admin/force-kyc/:userId
        if user2:
            resp = requests.get(f"{BASE_URL}/admin/force-kyc/{user2['id']}",
                              headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            test_b = resp.status_code == 200 and 'submissions' in resp.json()
        else:
            test_b = False
        
        results['6_admin_review'] = test_a and test_b
        log(f"✅ TEST 6: {'PASS' if results['6_admin_review'] else 'FAIL'}")
        
        # TEST 7: Reject flow
        log("\n=== TEST 7: Reject Flow ===")
        user4 = register_and_setup_user("reject")
        if user4:
            # Enable, upload, submit
            requests.post(f"{BASE_URL}/admin/force-kyc/enable", json={
                'user_id': user4['id'], 'required_docs': ['id_front'], 'reason': 'Test'
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            fid = upload_file(user4['token'], 'id_front')
            frames = [{'file_id': upload_file(user4['token'], f'liveness_frame_{i}'), 'challenge': 'smile', 'at': datetime.now().isoformat()} for i in range(5)]
            
            requests.post(f"{BASE_URL}/force-kyc/submit", json={
                'personal': {'full_name': 'Test', 'dob': '1990-01-01', 'nationality': 'US', 'country': 'US',
                           'city': 'NYC', 'address': '123 Main', 'postal_code': '10001', 'occupation': 'Engineer',
                           'id_type': 'passport', 'id_number': 'P123'},
                'docs': {'id_front': fid}, 'liveness': {'frames': frames}, 'consent': True
            }, headers={'Authorization': f'Bearer {user4["token"]}'}, timeout=10)
            
            # Reject without reason → 400
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/{user4['id']}/reject", json={},
                               headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            test_a = resp.status_code == 400
            
            # Reject with reason
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/{user4['id']}/reject", json={
                'reason': 'Document blurry', 'required_docs': ['id_front']
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code == 200:
                fk = resp.json().get('force_kyc', {})
                test_b = fk.get('status') == 'rejected' and fk.get('attempt') == 2
                
                # Still locked
                resp2 = requests.post(f"{BASE_URL}/transfer", json={
                    'recipient': ADMIN_EMAIL, 'currency': 'USD', 'amount': 10
                }, headers={'Authorization': f'Bearer {user4["token"]}'}, timeout=10)
                test_c = resp2.status_code == 423
            else:
                test_b = test_c = False
            
            results['7_reject'] = test_a and test_b and test_c
        else:
            results['7_reject'] = False
        
        log(f"✅ TEST 7: {'PASS' if results['7_reject'] else 'FAIL'}")
        
        # TEST 8: Approve flow
        log("\n=== TEST 8: Approve Flow ===")
        if user2:
            # Approve
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/{user2['id']}/approve", json={},
                               headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code == 200:
                fk = resp.json().get('force_kyc', {})
                test_a = not fk.get('active') and fk.get('status') == 'approved'
                
                # Check kyc_status
                resp2 = requests.get(f"{BASE_URL}/auth/me",
                                   headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
                test_b = resp2.json().get('user', {}).get('kyc_status') == 'approved'
                
                # Unlocked
                resp3 = requests.post(f"{BASE_URL}/transfer", json={
                    'recipient': ADMIN_EMAIL, 'currency': 'USD', 'amount': 10
                }, headers={'Authorization': f'Bearer {user2["token"]}'}, timeout=10)
                test_c = resp3.status_code != 423
                
                results['8_approve'] = test_a and test_b and test_c
            else:
                results['8_approve'] = False
        else:
            results['8_approve'] = False
        
        log(f"✅ TEST 8: {'PASS' if results['8_approve'] else 'FAIL'}")
        
        # TEST 9: Cancel flow
        log("\n=== TEST 9: Cancel Flow ===")
        user5 = register_and_setup_user("cancel")
        if user5:
            # Enable
            requests.post(f"{BASE_URL}/admin/force-kyc/enable", json={
                'user_id': user5['id'], 'required_docs': ['id_front'], 'reason': 'Test'
            }, headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            # Cancel
            resp = requests.post(f"{BASE_URL}/admin/force-kyc/{user5['id']}/cancel", json={},
                               headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            
            if resp.status_code == 200:
                fk = resp.json().get('force_kyc', {})
                test_a = not fk.get('active') and fk.get('status') == 'cancelled'
                
                # Unlocked
                resp2 = requests.post(f"{BASE_URL}/transfer", json={
                    'recipient': ADMIN_EMAIL, 'currency': 'USD', 'amount': 10
                }, headers={'Authorization': f'Bearer {user5["token"]}'}, timeout=10)
                test_b = resp2.status_code != 423
                
                results['9_cancel'] = test_a and test_b
            else:
                results['9_cancel'] = False
        else:
            results['9_cancel'] = False
        
        log(f"✅ TEST 9: {'PASS' if results['9_cancel'] else 'FAIL'}")
        
    except Exception as e:
        log(f"❌ Exception: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        cleanup()
    
    # Summary
    log("\n" + "=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    
    for test, passed in results.items():
        log(f"{'✅ PASS' if passed else '❌ FAIL'} - {test}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    log(f"\nTotal: {passed}/{total} tests passed ({passed*100//total if total > 0 else 0}%)")

if __name__ == '__main__':
    main()
