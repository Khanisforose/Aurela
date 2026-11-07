#!/usr/bin/env python3
"""
Backend test for Verification reminders + auto-delete unverified accounts (cron)
"""
import requests
import json
import time
import uuid
from datetime import datetime, timedelta
from pymongo import MongoClient
import os

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://aurela-preview.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'aurela')
WEBHOOK_CRON_SECRET = os.getenv('WEBHOOK_CRON_SECRET', '277b6d9021e91b2ede4e0d965d5c9b6ec26fe836b21396839742d3f4a79ef03a')

# Admin credentials
ADMIN_EMAIL = 'admin@aurelawallet.com'
ADMIN_PASSWORD = 'Aurela@123#'

# Test user prefix
TEST_PREFIX = 'vrtest_'

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def admin_login():
    """Login as admin and return token"""
    try:
        resp = requests.post(f"{API_URL}/auth/login", json={
            'identifier': ADMIN_EMAIL,
            'password': ADMIN_PASSWORD
        }, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get('token')
            log(f"✅ Admin login successful")
            return token
        else:
            log(f"❌ Admin login failed: {resp.status_code} {resp.text}")
            return None
    except Exception as e:
        log(f"❌ Admin login error: {e}")
        return None

def create_test_users_in_db():
    """Create test users directly in MongoDB"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Clean up any existing test users
        db.users.delete_many({'username': {'$regex': f'^{TEST_PREFIX}'}})
        db.wallets.delete_many({'user_id': {'$regex': f'^{TEST_PREFIX}'}})
        db.sessions.delete_many({'user_id': {'$regex': f'^{TEST_PREFIX}'}})
        db.user_notifications.delete_many({'user_id': {'$regex': f'^{TEST_PREFIX}'}})
        
        users = []
        now_iso = datetime.utcnow().isoformat() + 'Z'
        
        # User A: no funds, kyc none
        user_a_id = f"{TEST_PREFIX}a"
        user_a = {
            'id': user_a_id,
            'username': f'{TEST_PREFIX}a',
            'email': f'{TEST_PREFIX}a@example.com',
            'full_name': 'VR Test A',
            'role': 'user',
            'kyc_status': 'none',
            'status': 'active',
            'created_at': now_iso,
            'email_verified': True,
            'password_hash': 'dummy',
            'salt': 'dummy'
        }
        db.users.insert_one(user_a)
        # Create wallets for A (no balance)
        db.wallets.insert_one({
            'id': str(uuid.uuid4()),
            'user_id': user_a_id,
            'type': 'fiat',
            'currency': 'USD',
            'balance': 0,
            'pending': 0,
            'created_at': now_iso
        })
        users.append(user_a)
        
        # User B: USD wallet balance 50
        user_b_id = f"{TEST_PREFIX}b"
        user_b = {
            'id': user_b_id,
            'username': f'{TEST_PREFIX}b',
            'email': f'{TEST_PREFIX}b@example.com',
            'full_name': 'VR Test B',
            'role': 'user',
            'kyc_status': 'none',
            'status': 'active',
            'created_at': now_iso,
            'email_verified': True,
            'password_hash': 'dummy',
            'salt': 'dummy'
        }
        db.users.insert_one(user_b)
        # Create USD wallet with balance 50
        db.wallets.insert_one({
            'id': str(uuid.uuid4()),
            'user_id': user_b_id,
            'type': 'fiat',
            'currency': 'USD',
            'balance': 50,
            'pending': 0,
            'created_at': now_iso
        })
        users.append(user_b)
        
        # User C: kyc_status pending
        user_c_id = f"{TEST_PREFIX}c"
        user_c = {
            'id': user_c_id,
            'username': f'{TEST_PREFIX}c',
            'email': f'{TEST_PREFIX}c@example.com',
            'full_name': 'VR Test C',
            'role': 'user',
            'kyc_status': 'pending',
            'status': 'active',
            'created_at': now_iso,
            'email_verified': True,
            'password_hash': 'dummy',
            'salt': 'dummy'
        }
        db.users.insert_one(user_c)
        # Create wallet for C (no balance)
        db.wallets.insert_one({
            'id': str(uuid.uuid4()),
            'user_id': user_c_id,
            'type': 'fiat',
            'currency': 'USD',
            'balance': 0,
            'pending': 0,
            'created_at': now_iso
        })
        users.append(user_c)
        
        # User D: kyc_status approved
        user_d_id = f"{TEST_PREFIX}d"
        user_d = {
            'id': user_d_id,
            'username': f'{TEST_PREFIX}d',
            'email': f'{TEST_PREFIX}d@example.com',
            'full_name': 'VR Test D',
            'role': 'user',
            'kyc_status': 'approved',
            'status': 'active',
            'created_at': now_iso,
            'email_verified': True,
            'password_hash': 'dummy',
            'salt': 'dummy'
        }
        db.users.insert_one(user_d)
        # Create wallet for D (no balance)
        db.wallets.insert_one({
            'id': str(uuid.uuid4()),
            'user_id': user_d_id,
            'type': 'fiat',
            'currency': 'USD',
            'balance': 0,
            'pending': 0,
            'created_at': now_iso
        })
        users.append(user_d)
        
        # Create session for user A
        expires_at = (datetime.utcnow() + timedelta(days=1)).isoformat() + 'Z'
        session_a = {
            'token': f'tok_{TEST_PREFIX}a',
            'user_id': user_a_id,
            'created_at': now_iso,
            'expires_at': expires_at
        }
        db.sessions.insert_one(session_a)
        
        log(f"✅ Created 4 test users in MongoDB: A (no funds, kyc none), B (USD 50), C (kyc pending), D (kyc approved)")
        log(f"✅ Created session for user A with token: tok_{TEST_PREFIX}a")
        
        return users, f'tok_{TEST_PREFIX}a'
        
    except Exception as e:
        log(f"❌ Error creating test users: {e}")
        return None, None

def cleanup_test_users():
    """Clean up test users from MongoDB"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Delete test users and related data
        db.users.delete_many({'username': {'$regex': f'^{TEST_PREFIX}'}})
        db.wallets.delete_many({'user_id': {'$regex': f'^{TEST_PREFIX}'}})
        db.sessions.delete_many({'user_id': {'$regex': f'^{TEST_PREFIX}'}})
        db.user_notifications.delete_many({'user_id': {'$regex': f'^{TEST_PREFIX}'}})
        db.deleted_accounts.delete_many({'user_id': {'$regex': f'^{TEST_PREFIX}'}})
        
        log(f"✅ Cleaned up test users")
        
    except Exception as e:
        log(f"❌ Error cleaning up test users: {e}")

def get_user_from_db(user_id):
    """Get user from MongoDB"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        user = db.users.find_one({'id': user_id}, {'_id': 0})
        return user
    except Exception as e:
        log(f"❌ Error getting user from DB: {e}")
        return None

def update_user_in_db(user_id, update_data):
    """Update user in MongoDB"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        db.users.update_one({'id': user_id}, {'$set': update_data})
        log(f"✅ Updated user {user_id} in DB")
    except Exception as e:
        log(f"❌ Error updating user in DB: {e}")

def check_user_exists_in_db(user_id):
    """Check if user exists in MongoDB"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        user = db.users.find_one({'id': user_id})
        return user is not None
    except Exception as e:
        log(f"❌ Error checking user existence: {e}")
        return False

def check_deleted_account(user_id):
    """Check if user is in deleted_accounts collection"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        deleted = db.deleted_accounts.find_one({'user_id': user_id}, {'_id': 0})
        return deleted
    except Exception as e:
        log(f"❌ Error checking deleted account: {e}")
        return None

def get_user_notifications(user_id):
    """Get user notifications from MongoDB"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        notifications = list(db.user_notifications.find({'user_id': user_id}, {'_id': 0}).sort('created_at', -1))
        return notifications
    except Exception as e:
        log(f"❌ Error getting notifications: {e}")
        return []

def run_tests():
    """Run all tests"""
    log("=" * 80)
    log("VERIFICATION REMINDERS + AUTO-DELETE UNVERIFIED ACCOUNTS TEST")
    log("=" * 80)
    
    # Create test users
    users, user_a_token = create_test_users_in_db()
    if not users:
        log("❌ Failed to create test users")
        return
    
    user_a_id = f"{TEST_PREFIX}a"
    user_b_id = f"{TEST_PREFIX}b"
    user_c_id = f"{TEST_PREFIX}c"
    user_d_id = f"{TEST_PREFIX}d"
    
    # Login as admin
    admin_token = admin_login()
    if not admin_token:
        log("❌ Failed to login as admin")
        cleanup_test_users()
        return
    
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    user_a_headers = {'Authorization': f'Bearer {user_a_token}'}
    
    passed = 0
    failed = 0
    
    # TEST 1: Non-admin access control
    log("\n" + "=" * 80)
    log("TEST 1: Non-admin (Bearer tok_A) GET /api/admin/verify-reminders → 403")
    log("=" * 80)
    try:
        resp = requests.get(f"{API_URL}/admin/verify-reminders", headers=user_a_headers, timeout=30)
        if resp.status_code == 403:
            log(f"✅ TEST 1 PASSED: Non-admin correctly blocked with 403")
            passed += 1
        else:
            log(f"❌ TEST 1 FAILED: Expected 403, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 1 FAILED: {e}")
        failed += 1
    
    # TEST 2: Admin GET /api/admin/verify-reminders?filter=unverified
    log("\n" + "=" * 80)
    log("TEST 2: Admin GET /api/admin/verify-reminders?filter=unverified")
    log("=" * 80)
    try:
        resp = requests.get(f"{API_URL}/admin/verify-reminders?filter=unverified", headers=admin_headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            users_list = data.get('users', [])
            counts = data.get('counts', {})
            
            # Check if A, B, C are included (not D which is approved)
            user_ids = [u['id'] for u in users_list]
            has_a = user_a_id in user_ids
            has_b = user_b_id in user_ids
            has_c = user_c_id in user_ids
            has_d = user_d_id in user_ids
            
            # Check if B has funds info
            user_b_data = next((u for u in users_list if u['id'] == user_b_id), None)
            b_has_funds = False
            b_balance_usd = 0
            if user_b_data and 'funds' in user_b_data:
                b_has_funds = user_b_data['funds'].get('has_money', False)
                b_balance_usd = user_b_data['funds'].get('balance_usd', 0)
            
            log(f"Response: users count={len(users_list)}, counts={counts}")
            log(f"User A in list: {has_a}, User B in list: {has_b}, User C in list: {has_c}, User D in list: {has_d}")
            log(f"User B has_money: {b_has_funds}, balance_usd: {b_balance_usd}")
            
            if has_a and has_b and has_c and not has_d and b_has_funds and b_balance_usd >= 50:
                log(f"✅ TEST 2 PASSED: Filter=unverified includes A,B,C not D; B.funds.has_money=true, balance_usd≈50")
                passed += 1
            else:
                log(f"❌ TEST 2 FAILED: Expected A,B,C (not D) with B having funds")
                failed += 1
        else:
            log(f"❌ TEST 2 FAILED: Expected 200, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 2 FAILED: {e}")
        failed += 1
    
    # TEST 3: POST /send validation
    log("\n" + "=" * 80)
    log("TEST 3: POST /send validation")
    log("=" * 80)
    
    # 3a: No ids → 400
    try:
        resp = requests.post(f"{API_URL}/admin/verify-reminders/send", headers=admin_headers, json={
            'hours': 24,
            'final_warning_hours': 3
        }, timeout=30)
        if resp.status_code == 400:
            log(f"✅ TEST 3a PASSED: No ids → 400")
            passed += 1
        else:
            log(f"❌ TEST 3a FAILED: Expected 400, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 3a FAILED: {e}")
        failed += 1
    
    # 3b: hours 0 → 400
    try:
        resp = requests.post(f"{API_URL}/admin/verify-reminders/send", headers=admin_headers, json={
            'user_ids': [user_a_id],
            'hours': 0,
            'final_warning_hours': 3
        }, timeout=30)
        if resp.status_code == 400:
            log(f"✅ TEST 3b PASSED: hours 0 → 400")
            passed += 1
        else:
            log(f"❌ TEST 3b FAILED: Expected 400, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 3b FAILED: {e}")
        failed += 1
    
    # 3c: final_warning_hours >= hours → 400
    try:
        resp = requests.post(f"{API_URL}/admin/verify-reminders/send", headers=admin_headers, json={
            'user_ids': [user_a_id],
            'hours': 24,
            'final_warning_hours': 24
        }, timeout=30)
        if resp.status_code == 400:
            log(f"✅ TEST 3c PASSED: final_warning_hours >= hours → 400")
            passed += 1
        else:
            log(f"❌ TEST 3c FAILED: Expected 400, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 3c FAILED: {e}")
        failed += 1
    
    # 3d: Valid send
    try:
        resp = requests.post(f"{API_URL}/admin/verify-reminders/send", headers=admin_headers, json={
            'user_ids': [user_a_id, user_b_id, user_c_id, user_d_id],
            'hours': 24,
            'final_warning_hours': 3,
            'message': 'hi'
        }, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            sent = data.get('sent', 0)
            skipped = data.get('skipped', [])
            
            # Check if D was skipped (already verified)
            d_skipped = any(s.get('id') == user_d_id and 'verified' in s.get('reason', '') for s in skipped)
            
            log(f"Response: sent={sent}, skipped={skipped}")
            
            if sent == 3 and d_skipped:
                log(f"✅ TEST 3d PASSED: Valid send → sent 3, D skipped 'already verified'")
                passed += 1
                
                # Check if A has notification
                time.sleep(1)  # Wait for notification to be created
                notifications = get_user_notifications(user_a_id)
                has_verify_reminder = any(n.get('kind') == 'verify_reminder' for n in notifications)
                
                if has_verify_reminder:
                    log(f"✅ TEST 3d EXTRA: User A has verify_reminder notification")
                else:
                    log(f"⚠️ TEST 3d WARNING: User A missing verify_reminder notification")
                
                # Check if A has verify_reminder in DB
                user_a = get_user_from_db(user_a_id)
                if user_a and 'verify_reminder' in user_a:
                    vr = user_a['verify_reminder']
                    if vr.get('active') and 'deadline_at' in vr:
                        log(f"✅ TEST 3d EXTRA: User A has verify_reminder.active=true with deadline_at")
                    else:
                        log(f"⚠️ TEST 3d WARNING: User A verify_reminder not properly set")
                else:
                    log(f"⚠️ TEST 3d WARNING: User A missing verify_reminder in DB")
            else:
                log(f"❌ TEST 3d FAILED: Expected sent=3 with D skipped")
                failed += 1
        else:
            log(f"❌ TEST 3d FAILED: Expected 200, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 3d FAILED: {e}")
        failed += 1
    
    # TEST 4: Final warning
    log("\n" + "=" * 80)
    log("TEST 4: Final warning")
    log("=" * 80)
    
    # Set A's deadline to now+2h
    try:
        deadline_2h = (datetime.utcnow() + timedelta(hours=2)).isoformat() + 'Z'
        update_user_in_db(user_a_id, {'verify_reminder.deadline_at': deadline_2h})
        
        # Run the cron job
        resp = requests.post(f"{API_URL}/admin/verify-reminders/run", headers=admin_headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            stats = data.get('stats', {})
            final_warnings = stats.get('final_warnings', 0)
            
            log(f"Response: stats={stats}")
            
            if final_warnings >= 1:
                log(f"✅ TEST 4a PASSED: Final warning sent (final_warnings={final_warnings})")
                passed += 1
                
                # Check if A has final warning notification
                time.sleep(1)
                notifications = get_user_notifications(user_a_id)
                has_final_warning = any(n.get('kind') == 'verify_final_warning' for n in notifications)
                
                if has_final_warning:
                    log(f"✅ TEST 4b PASSED: User A has verify_final_warning notification")
                    passed += 1
                else:
                    log(f"❌ TEST 4b FAILED: User A missing verify_final_warning notification")
                    failed += 1
                
                # Check if final_warning_sent_at is set
                user_a = get_user_from_db(user_a_id)
                if user_a and user_a.get('verify_reminder', {}).get('final_warning_sent_at'):
                    log(f"✅ TEST 4c PASSED: User A has final_warning_sent_at set")
                    passed += 1
                else:
                    log(f"❌ TEST 4c FAILED: User A missing final_warning_sent_at")
                    failed += 1
                
                # Run again to check no duplicate
                resp2 = requests.post(f"{API_URL}/admin/verify-reminders/run", headers=admin_headers, timeout=30)
                if resp2.status_code == 200:
                    stats2 = resp2.json().get('stats', {})
                    final_warnings2 = stats2.get('final_warnings', 0)
                    if final_warnings2 == 0:
                        log(f"✅ TEST 4d PASSED: No duplicate warning (final_warnings=0 on second run)")
                        passed += 1
                    else:
                        log(f"❌ TEST 4d FAILED: Duplicate warning sent")
                        failed += 1
                else:
                    log(f"❌ TEST 4d FAILED: Second run failed with {resp2.status_code}")
                    failed += 1
            else:
                log(f"❌ TEST 4 FAILED: No final warnings sent")
                failed += 1
        else:
            log(f"❌ TEST 4 FAILED: Expected 200, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 4 FAILED: {e}")
        failed += 1
    
    # TEST 5: Deadline passed
    log("\n" + "=" * 80)
    log("TEST 5: Deadline passed")
    log("=" * 80)
    
    # Set deadline to past for A, B, C
    try:
        deadline_past = (datetime.utcnow() - timedelta(minutes=1)).isoformat() + 'Z'
        update_user_in_db(user_a_id, {'verify_reminder.deadline_at': deadline_past})
        update_user_in_db(user_b_id, {'verify_reminder.deadline_at': deadline_past})
        update_user_in_db(user_c_id, {'verify_reminder.deadline_at': deadline_past})
        
        # Run the cron job
        resp = requests.post(f"{API_URL}/admin/verify-reminders/run", headers=admin_headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            stats = data.get('stats', {})
            deleted = stats.get('deleted', 0)
            flagged = stats.get('flagged', 0)
            
            log(f"Response: stats={stats}")
            
            # Check if A is deleted
            time.sleep(1)
            a_exists = check_user_exists_in_db(user_a_id)
            a_deleted = check_deleted_account(user_a_id)
            
            # Check if B is flagged (has funds)
            b_user = get_user_from_db(user_b_id)
            b_flagged = b_user and b_user.get('verify_reminder', {}).get('flag_reason') == 'has_funds'
            
            # Check if C is flagged (kyc pending)
            c_user = get_user_from_db(user_c_id)
            c_flagged = c_user and c_user.get('verify_reminder', {}).get('flag_reason') == 'kyc_pending'
            
            log(f"User A exists: {a_exists}, deleted record: {a_deleted is not None}")
            log(f"User B flagged: {b_flagged}, flag_reason: {b_user.get('verify_reminder', {}).get('flag_reason') if b_user else None}")
            log(f"User C flagged: {c_flagged}, flag_reason: {c_user.get('verify_reminder', {}).get('flag_reason') if c_user else None}")
            
            if not a_exists and a_deleted and a_deleted.get('reason') == 'unverified_deadline':
                log(f"✅ TEST 5a PASSED: User A deleted (reason='unverified_deadline')")
                passed += 1
            else:
                log(f"❌ TEST 5a FAILED: User A not properly deleted")
                failed += 1
            
            if b_flagged:
                log(f"✅ TEST 5b PASSED: User B flagged (flag_reason='has_funds')")
                passed += 1
            else:
                log(f"❌ TEST 5b FAILED: User B not flagged")
                failed += 1
            
            if c_flagged:
                log(f"✅ TEST 5c PASSED: User C flagged (flag_reason='kyc_pending')")
                passed += 1
            else:
                log(f"❌ TEST 5c FAILED: User C not flagged")
                failed += 1
            
            # Check filter=flagged
            resp_flagged = requests.get(f"{API_URL}/admin/verify-reminders?filter=flagged", headers=admin_headers, timeout=30)
            if resp_flagged.status_code == 200:
                flagged_users = resp_flagged.json().get('users', [])
                flagged_ids = [u['id'] for u in flagged_users]
                if user_b_id in flagged_ids and user_c_id in flagged_ids:
                    log(f"✅ TEST 5d PASSED: filter=flagged shows B,C")
                    passed += 1
                else:
                    log(f"❌ TEST 5d FAILED: filter=flagged doesn't show B,C")
                    failed += 1
            else:
                log(f"❌ TEST 5d FAILED: filter=flagged request failed")
                failed += 1
            
            # Check filter=deleted
            resp_deleted = requests.get(f"{API_URL}/admin/verify-reminders?filter=deleted", headers=admin_headers, timeout=30)
            if resp_deleted.status_code == 200:
                deleted_list = resp_deleted.json().get('deleted', [])
                deleted_ids = [d['user_id'] for d in deleted_list]
                if user_a_id in deleted_ids:
                    log(f"✅ TEST 5e PASSED: filter=deleted shows A")
                    passed += 1
                else:
                    log(f"❌ TEST 5e FAILED: filter=deleted doesn't show A")
                    failed += 1
            else:
                log(f"❌ TEST 5e FAILED: filter=deleted request failed")
                failed += 1
        else:
            log(f"❌ TEST 5 FAILED: Expected 200, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 5 FAILED: {e}")
        failed += 1
    
    # TEST 6: Cancel
    log("\n" + "=" * 80)
    log("TEST 6: Cancel reminder")
    log("=" * 80)
    try:
        resp = requests.post(f"{API_URL}/admin/verify-reminders/cancel", headers=admin_headers, json={
            'user_ids': [user_b_id]
        }, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            cancelled = data.get('cancelled', 0)
            
            # Check if B's reminder is cancelled
            time.sleep(1)
            b_user = get_user_from_db(user_b_id)
            b_active = b_user and b_user.get('verify_reminder', {}).get('active', True)
            
            log(f"Response: cancelled={cancelled}")
            log(f"User B verify_reminder.active: {b_active}")
            
            if cancelled >= 1 and not b_active:
                log(f"✅ TEST 6 PASSED: Cancel → verify_reminder.active=false")
                passed += 1
            else:
                log(f"❌ TEST 6 FAILED: Cancel didn't work properly")
                failed += 1
        else:
            log(f"❌ TEST 6 FAILED: Expected 200, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 6 FAILED: {e}")
        failed += 1
    
    # TEST 7: Manual delete
    log("\n" + "=" * 80)
    log("TEST 7: Manual delete")
    log("=" * 80)
    
    # 7a: Try to delete B (has funds) → blocked
    try:
        resp = requests.post(f"{API_URL}/admin/verify-reminders/delete", headers=admin_headers, json={
            'user_ids': [user_b_id]
        }, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            deleted = data.get('deleted', 0)
            blocked = data.get('blocked', [])
            
            b_blocked = any(b.get('id') == user_b_id and 'funds' in b.get('reason', '') for b in blocked)
            
            log(f"Response: deleted={deleted}, blocked={blocked}")
            
            if deleted == 0 and b_blocked:
                log(f"✅ TEST 7a PASSED: B blocked (holds funds)")
                passed += 1
            else:
                log(f"❌ TEST 7a FAILED: B should be blocked")
                failed += 1
        else:
            log(f"❌ TEST 7a FAILED: Expected 200, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 7a FAILED: {e}")
        failed += 1
    
    # 7b: Try to delete C (no funds, kyc pending) → should delete
    try:
        resp = requests.post(f"{API_URL}/admin/verify-reminders/delete", headers=admin_headers, json={
            'user_ids': [user_c_id]
        }, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            deleted = data.get('deleted', 0)
            
            # Check if C is deleted
            time.sleep(1)
            c_exists = check_user_exists_in_db(user_c_id)
            
            log(f"Response: deleted={deleted}")
            log(f"User C exists: {c_exists}")
            
            if deleted >= 1 and not c_exists:
                log(f"✅ TEST 7b PASSED: C deleted (no funds)")
                passed += 1
            else:
                log(f"❌ TEST 7b FAILED: C should be deleted")
                failed += 1
        else:
            log(f"❌ TEST 7b FAILED: Expected 200, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 7b FAILED: {e}")
        failed += 1
    
    # 7c: Try to delete D (verified) → blocked
    try:
        resp = requests.post(f"{API_URL}/admin/verify-reminders/delete", headers=admin_headers, json={
            'user_ids': [user_d_id]
        }, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            deleted = data.get('deleted', 0)
            blocked = data.get('blocked', [])
            
            d_blocked = any(b.get('id') == user_d_id and 'verified' in b.get('reason', '') for b in blocked)
            
            log(f"Response: deleted={deleted}, blocked={blocked}")
            
            if deleted == 0 and d_blocked:
                log(f"✅ TEST 7c PASSED: D blocked (verified)")
                passed += 1
            else:
                log(f"❌ TEST 7c FAILED: D should be blocked")
                failed += 1
        else:
            log(f"❌ TEST 7c FAILED: Expected 200, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 7c FAILED: {e}")
        failed += 1
    
    # TEST 8: Approved during reminder
    log("\n" + "=" * 80)
    log("TEST 8: Approved during reminder")
    log("=" * 80)
    
    # Create user E and send reminder
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        user_e_id = f"{TEST_PREFIX}e"
        now_iso = datetime.utcnow().isoformat() + 'Z'
        user_e = {
            'id': user_e_id,
            'username': f'{TEST_PREFIX}e',
            'email': f'{TEST_PREFIX}e@example.com',
            'full_name': 'VR Test E',
            'role': 'user',
            'kyc_status': 'none',
            'status': 'active',
            'created_at': now_iso,
            'email_verified': True,
            'password_hash': 'dummy',
            'salt': 'dummy'
        }
        db.users.insert_one(user_e)
        db.wallets.insert_one({
            'id': str(uuid.uuid4()),
            'user_id': user_e_id,
            'type': 'fiat',
            'currency': 'USD',
            'balance': 0,
            'pending': 0,
            'created_at': now_iso
        })
        
        # Send reminder to E
        resp = requests.post(f"{API_URL}/admin/verify-reminders/send", headers=admin_headers, json={
            'user_ids': [user_e_id],
            'hours': 24,
            'final_warning_hours': 3
        }, timeout=30)
        
        if resp.status_code == 200:
            # Set E's kyc_status to approved
            update_user_in_db(user_e_id, {'kyc_status': 'approved'})
            
            # Run cron
            resp2 = requests.post(f"{API_URL}/admin/verify-reminders/run", headers=admin_headers, timeout=30)
            if resp2.status_code == 200:
                stats = resp2.json().get('stats', {})
                cleared = stats.get('cleared', 0)
                
                # Check if E's reminder is cleared
                time.sleep(1)
                e_user = get_user_from_db(user_e_id)
                e_active = e_user and e_user.get('verify_reminder', {}).get('active', True)
                e_resolved = e_user and e_user.get('verify_reminder', {}).get('resolved')
                
                log(f"Response: stats={stats}")
                log(f"User E verify_reminder.active: {e_active}, resolved: {e_resolved}")
                
                if cleared >= 1 and not e_active and e_resolved == 'verified':
                    log(f"✅ TEST 8 PASSED: Reminder cleared (active=false, resolved='verified')")
                    passed += 1
                else:
                    log(f"❌ TEST 8 FAILED: Reminder not properly cleared")
                    failed += 1
            else:
                log(f"❌ TEST 8 FAILED: Run failed with {resp2.status_code}")
                failed += 1
        else:
            log(f"❌ TEST 8 FAILED: Send reminder failed with {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 8 FAILED: {e}")
        failed += 1
    
    # TEST 9: Cron endpoint
    log("\n" + "=" * 80)
    log("TEST 9: Cron endpoint")
    log("=" * 80)
    
    # 9a: No auth → 401
    try:
        resp = requests.post(f"{API_URL}/cron/verify-reminders", timeout=30)
        if resp.status_code == 401:
            log(f"✅ TEST 9a PASSED: No auth → 401")
            passed += 1
        else:
            log(f"❌ TEST 9a FAILED: Expected 401, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 9a FAILED: {e}")
        failed += 1
    
    # 9b: Wrong token → 401
    try:
        resp = requests.post(f"{API_URL}/cron/verify-reminders", headers={
            'Authorization': 'Bearer wrong_token'
        }, timeout=30)
        if resp.status_code == 401:
            log(f"✅ TEST 9b PASSED: Wrong token → 401")
            passed += 1
        else:
            log(f"❌ TEST 9b FAILED: Expected 401, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 9b FAILED: {e}")
        failed += 1
    
    # 9c: Correct token → 202
    try:
        run_id = str(uuid.uuid4())
        resp = requests.post(f"{API_URL}/cron/verify-reminders", headers={
            'Authorization': f'Bearer {WEBHOOK_CRON_SECRET}',
            'X-Webhook-Id': f'test-run-{run_id}'
        }, timeout=30)
        if resp.status_code == 202:
            data = resp.json()
            if data.get('ok') and data.get('accepted'):
                log(f"✅ TEST 9c PASSED: Correct token → 202 accepted")
                passed += 1
            else:
                log(f"❌ TEST 9c FAILED: Response not as expected: {data}")
                failed += 1
        else:
            log(f"❌ TEST 9c FAILED: Expected 202, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 9c FAILED: {e}")
        failed += 1
    
    # 9d: Same id again → 202 duplicate
    try:
        resp = requests.post(f"{API_URL}/cron/verify-reminders", headers={
            'Authorization': f'Bearer {WEBHOOK_CRON_SECRET}',
            'X-Webhook-Id': f'test-run-{run_id}'
        }, timeout=30)
        if resp.status_code == 202:
            data = resp.json()
            if data.get('ok') and data.get('duplicate'):
                log(f"✅ TEST 9d PASSED: Same id again → 202 duplicate")
                passed += 1
            else:
                log(f"❌ TEST 9d FAILED: Response not as expected: {data}")
                failed += 1
        else:
            log(f"❌ TEST 9d FAILED: Expected 202, got {resp.status_code}")
            failed += 1
    except Exception as e:
        log(f"❌ TEST 9d FAILED: {e}")
        failed += 1
    
    # Clean up
    log("\n" + "=" * 80)
    log("CLEANUP")
    log("=" * 80)
    cleanup_test_users()
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    total = passed + failed
    log(f"Total tests: {total}")
    log(f"Passed: {passed}")
    log(f"Failed: {failed}")
    log(f"Success rate: {(passed/total*100):.1f}%")
    
    if failed == 0:
        log("\n✅ ALL TESTS PASSED!")
    else:
        log(f"\n❌ {failed} TEST(S) FAILED")

if __name__ == '__main__':
    run_tests()
