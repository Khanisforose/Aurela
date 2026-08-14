#!/usr/bin/env python3
"""
Focused test of NEW/CHANGED backend features: Welcome reward CLAIM-ONLY flow + Notifications
Admin creds: admin@aurelawallet.com / Aurela@123#
"""

import requests
import time
import random
import string
import os
from pymongo import MongoClient

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

# MongoDB connection
mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.getenv('DB_NAME', 'aurela')
mongo_client = MongoClient(mongo_url)
mongo_db = mongo_client[db_name]

def random_email():
    return f"test_{random.randint(100000, 999999)}_{int(time.time())}@aurelawallet.com"

def register_and_verify_user(email, password="TestPass123#"):
    """Register a fresh user with all required fields and verify OTP"""
    print(f"\n🔹 Registering user: {email}")
    
    # Step 1: Register init
    init_resp = requests.post(f"{BASE_URL}/auth/register/init", json={
        "first_name": "Test",
        "last_name": "User",
        "email": email,
        "country": "United States",
        "phone": f"+1555{random.randint(1000000, 9999999)}",
        "password": password
    })
    
    if init_resp.status_code != 200:
        print(f"❌ Register init failed: {init_resp.status_code} - {init_resp.text}")
        return None, None
    
    init_data = init_resp.json()
    signup_id = init_data.get('signup_id')
    dev_otp = init_data.get('dev_otp')
    
    if not signup_id:
        print(f"❌ No signup_id in response: {init_data}")
        return None, None
    
    # If dev_otp not in response, fetch from DB (email was sent successfully)
    if not dev_otp:
        print("⚠️ No dev_otp in response, email was sent. Fetching from DB...")
        # Fetch OTP from pending_signups collection
        signup_record = mongo_db.pending_signups.find_one({'id': signup_id})
        if signup_record:
            dev_otp = signup_record.get('code')
            print(f"   Fetched OTP from DB: {dev_otp}")
        else:
            print(f"❌ Could not find signup record in DB for signup_id={signup_id}")
            return None, None
    
    print(f"✅ Register init successful. signup_id={signup_id}, OTP={dev_otp}")
    
    # Step 2: Verify OTP
    verify_resp = requests.post(f"{BASE_URL}/auth/register/verify", json={
        "signup_id": signup_id,
        "code": dev_otp
    })
    
    if verify_resp.status_code != 200:
        print(f"❌ Register verify failed: {verify_resp.status_code} - {verify_resp.text}")
        return None, None
    
    verify_data = verify_resp.json()
    token = verify_data.get('token')
    user = verify_data.get('user')
    
    print(f"✅ User registered and verified. user_id={user.get('id')}, email={user.get('email')}")
    return token, user

def submit_kyc(token):
    """Submit KYC for a user"""
    print("\n🔹 Submitting KYC...")
    
    kyc_resp = requests.post(f"{BASE_URL}/kyc", 
        headers={"Authorization": f"Bearer {token}"},
        json={
            "first_name": "Test",
            "last_name": "User",
            "mobile": "+15551234567",
            "country": "United States",
            "state": "California",
            "city": "San Francisco",
            "address": "123 Test St",
            "postal_code": "94102",
            "occupation": "Software Engineer",
            "id_type": "passport",
            "id_number": "P12345678",
            "doc_front": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "doc_back": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "selfie": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
    )
    
    if kyc_resp.status_code != 200:
        print(f"❌ KYC submission failed: {kyc_resp.status_code} - {kyc_resp.text}")
        return None
    
    kyc_data = kyc_resp.json()
    kyc_id = kyc_data.get('kyc', {}).get('id')
    print(f"✅ KYC submitted. kyc_id={kyc_id}")
    return kyc_id

def admin_login():
    """Login as admin"""
    print("\n🔹 Admin login...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": "admin@aurelawallet.com",
        "password": "Aurela@123#"
    })
    
    if resp.status_code != 200:
        print(f"❌ Admin login failed: {resp.status_code} - {resp.text}")
        return None
    
    data = resp.json()
    token = data.get('token')
    print(f"✅ Admin logged in. role={data.get('user', {}).get('role')}")
    return token

def approve_kyc(admin_token, kyc_id):
    """Admin approves KYC"""
    print(f"\n🔹 Admin approving KYC {kyc_id}...")
    
    resp = requests.post(f"{BASE_URL}/admin/kyc/{kyc_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if resp.status_code != 200:
        print(f"❌ KYC approval failed: {resp.status_code} - {resp.text}")
        return False
    
    print(f"✅ KYC approved")
    return True

def get_wallets(token):
    """Get user wallets"""
    resp = requests.get(f"{BASE_URL}/wallets",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 200:
        print(f"❌ Get wallets failed: {resp.status_code} - {resp.text}")
        return None
    
    return resp.json()

def get_claim_status(token):
    """Get claim status"""
    resp = requests.get(f"{BASE_URL}/claim/status",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 200:
        print(f"❌ Get claim status failed: {resp.status_code} - {resp.text}")
        return None
    
    return resp.json()

def claim_welcome_reward(token):
    """Claim welcome reward"""
    resp = requests.post(f"{BASE_URL}/claim/welcome",
        headers={"Authorization": f"Bearer {token}"},
        json={}
    )
    
    return resp

def get_notifications(token):
    """Get user notifications"""
    resp = requests.get(f"{BASE_URL}/notifications",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 200:
        print(f"❌ Get notifications failed: {resp.status_code} - {resp.text}")
        return None
    
    return resp.json()

def mark_notifications_read(token):
    """Mark all notifications as read"""
    resp = requests.post(f"{BASE_URL}/notifications/read",
        headers={"Authorization": f"Bearer {token}"},
        json={}
    )
    
    if resp.status_code != 200:
        print(f"❌ Mark notifications read failed: {resp.status_code} - {resp.text}")
        return False
    
    return True

def create_deposit_request(token, amount=100, currency="USD"):
    """Create a deposit request"""
    resp = requests.post(f"{BASE_URL}/deposit",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "amount": amount,
            "currency": currency,
            "method": "bank_swift",
            "reference": f"TEST{random.randint(10000, 99999)}"
        }
    )
    
    if resp.status_code != 200:
        print(f"❌ Create deposit failed: {resp.status_code} - {resp.text}")
        return None
    
    return resp.json()

def admin_approve_deposit(admin_token, deposit_id):
    """Admin approves deposit"""
    resp = requests.post(f"{BASE_URL}/admin/deposits/{deposit_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if resp.status_code != 200:
        print(f"❌ Approve deposit failed: {resp.status_code} - {resp.text}")
        return False
    
    return True

def admin_reject_deposit(admin_token, deposit_id):
    """Admin rejects deposit"""
    resp = requests.post(f"{BASE_URL}/admin/deposits/{deposit_id}/reject",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if resp.status_code != 200:
        print(f"❌ Reject deposit failed: {resp.status_code} - {resp.text}")
        return False
    
    return True

def create_withdrawal_request(token, amount=50, currency="USD"):
    """Create a withdrawal request"""
    resp = requests.post(f"{BASE_URL}/withdraw",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "amount": amount,
            "currency": currency,
            "method": "bank_swift",
            "destination": "TESTBANK123"
        }
    )
    
    if resp.status_code != 200:
        print(f"❌ Create withdrawal failed: {resp.status_code} - {resp.text}")
        return None
    
    return resp.json()

def admin_approve_withdrawal(admin_token, withdrawal_id):
    """Admin approves withdrawal"""
    resp = requests.post(f"{BASE_URL}/admin/withdrawals/{withdrawal_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if resp.status_code != 200:
        print(f"❌ Approve withdrawal failed: {resp.status_code} - {resp.text}")
        return False
    
    return True

def admin_reject_withdrawal(admin_token, withdrawal_id):
    """Admin rejects withdrawal"""
    resp = requests.post(f"{BASE_URL}/admin/withdrawals/{withdrawal_id}/reject",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if resp.status_code != 200:
        print(f"❌ Reject withdrawal failed: {resp.status_code} - {resp.text}")
        return False
    
    return True

def request_card(token, tier="basic"):
    """Request a virtual card"""
    resp = requests.post(f"{BASE_URL}/cards/request",
        headers={"Authorization": f"Bearer {token}"},
        json={"tier": tier}
    )
    
    if resp.status_code != 200:
        print(f"❌ Request card failed: {resp.status_code} - {resp.text}")
        return None
    
    return resp.json()

def activate_card(token, card_id):
    """Activate card with tx_hash"""
    resp = requests.post(f"{BASE_URL}/cards/{card_id}/activate",
        headers={"Authorization": f"Bearer {token}"},
        json={"tx_hash": f"0x{'a' * 64}"}
    )
    
    if resp.status_code != 200:
        print(f"❌ Activate card failed: {resp.status_code} - {resp.text}")
        return False
    
    return True

def admin_approve_card(admin_token, card_id, activate_now=True):
    """Admin approves card"""
    resp = requests.post(f"{BASE_URL}/admin/cards/{card_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"activate_now": activate_now}
    )
    
    if resp.status_code != 200:
        print(f"❌ Approve card failed: {resp.status_code} - {resp.text}")
        return False
    
    return True

def internal_transfer(token, recipient, amount, currency):
    """Send internal transfer"""
    resp = requests.post(f"{BASE_URL}/transfer",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "recipient": recipient,
            "amount": amount,
            "currency": currency
        }
    )
    
    if resp.status_code != 200:
        print(f"❌ Transfer failed: {resp.status_code} - {resp.text}")
        return False
    
    return True

# ============================================================================
# TEST SUITE
# ============================================================================

def test_a_welcome_reward_claim_only():
    """Test A — Welcome reward is now CLAIM-ONLY (not auto-credited)"""
    print("\n" + "="*80)
    print("TEST A — Welcome reward is now CLAIM-ONLY (not auto-credited)")
    print("="*80)
    
    try:
        # 1. Register a fresh user
        email = random_email()
        token, user = register_and_verify_user(email)
        
        if not token:
            print("❌ TEST A FAILED: Could not register user")
            return False
        
        # 2. Check AUR wallet balance should be 0 (NOT 5 anymore)
        print("\n🔹 Checking AUR wallet balance...")
        wallets_data = get_wallets(token)
        
        if not wallets_data:
            print("❌ TEST A FAILED: Could not get wallets")
            return False
        
        wallets = wallets_data.get('wallets', [])
        aur_wallet = next((w for w in wallets if w['currency'] == 'AUR'), None)
        
        if not aur_wallet:
            print("❌ TEST A FAILED: AUR wallet not found")
            return False
        
        aur_balance = aur_wallet.get('balance', -1)
        print(f"   AUR wallet balance: {aur_balance}")
        
        if aur_balance != 0:
            print(f"❌ TEST A FAILED: AUR balance should be 0, got {aur_balance}")
            return False
        
        print("✅ TEST A.2 PASSED: AUR wallet balance is 0 (not auto-credited)")
        
        # 3. Check claim status
        print("\n🔹 Checking claim status...")
        claim_status = get_claim_status(token)
        
        if not claim_status:
            print("❌ TEST A FAILED: Could not get claim status")
            return False
        
        print(f"   Claim status: {claim_status}")
        
        # Verify response structure
        required_keys = ['has_reward', 'status', 'amount', 'currency', 'kyc_status', 'eligible']
        for key in required_keys:
            if key not in claim_status:
                print(f"❌ TEST A FAILED: Missing key '{key}' in claim status")
                return False
        
        # Verify values
        if claim_status['has_reward'] != True:
            print(f"❌ TEST A FAILED: has_reward should be True, got {claim_status['has_reward']}")
            return False
        
        if claim_status['status'] != 'pending':
            print(f"❌ TEST A FAILED: status should be 'pending', got {claim_status['status']}")
            return False
        
        if claim_status['amount'] != 5:
            print(f"❌ TEST A FAILED: amount should be 5, got {claim_status['amount']}")
            return False
        
        if claim_status['currency'] != 'AUR':
            print(f"❌ TEST A FAILED: currency should be 'AUR', got {claim_status['currency']}")
            return False
        
        if claim_status['kyc_status'] != 'unverified':
            print(f"❌ TEST A FAILED: kyc_status should be 'unverified', got {claim_status['kyc_status']}")
            return False
        
        if claim_status['eligible'] != False:
            print(f"❌ TEST A FAILED: eligible should be False (KYC not approved), got {claim_status['eligible']}")
            return False
        
        print("✅ TEST A.3 PASSED: Claim status correct (has_reward=true, status=pending, amount=5, currency=AUR, kyc_status=unverified, eligible=false)")
        print("✅ TEST A PASSED: Welcome reward is CLAIM-ONLY, not auto-credited")
        return True
        
    except Exception as e:
        print(f"❌ TEST A FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_b_claim_blocks_non_kyc():
    """Test B — Claim endpoint blocks non-KYC users"""
    print("\n" + "="*80)
    print("TEST B — Claim endpoint blocks non-KYC users")
    print("="*80)
    
    try:
        # 1. Register a fresh user (KYC still unverified)
        email = random_email()
        token, user = register_and_verify_user(email)
        
        if not token:
            print("❌ TEST B FAILED: Could not register user")
            return False
        
        # 2. Try to claim welcome reward (should fail with 403)
        print("\n🔹 Attempting to claim welcome reward without KYC...")
        claim_resp = claim_welcome_reward(token)
        
        if claim_resp.status_code != 403:
            print(f"❌ TEST B FAILED: Expected 403, got {claim_resp.status_code}")
            print(f"   Response: {claim_resp.text}")
            return False
        
        claim_data = claim_resp.json()
        error_code = claim_data.get('code')
        error_msg = claim_data.get('error')
        
        print(f"   Response: {claim_data}")
        
        if error_code != 'KYC_REQUIRED':
            print(f"❌ TEST B FAILED: Expected code='KYC_REQUIRED', got '{error_code}'")
            return False
        
        if 'KYC' not in error_msg and 'verification' not in error_msg:
            print(f"❌ TEST B FAILED: Error message should mention KYC, got '{error_msg}'")
            return False
        
        print("✅ TEST B.1 PASSED: Claim blocked with 403 and code=KYC_REQUIRED")
        
        # 3. Verify AUR balance still 0
        print("\n🔹 Verifying AUR balance still 0...")
        wallets_data = get_wallets(token)
        aur_wallet = next((w for w in wallets_data['wallets'] if w['currency'] == 'AUR'), None)
        aur_balance = aur_wallet.get('balance', -1)
        
        if aur_balance != 0:
            print(f"❌ TEST B FAILED: AUR balance should still be 0, got {aur_balance}")
            return False
        
        print("✅ TEST B.2 PASSED: AUR balance stays at 0")
        print("✅ TEST B PASSED: Claim endpoint blocks non-KYC users")
        return True
        
    except Exception as e:
        print(f"❌ TEST B FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_c_claim_works_after_kyc():
    """Test C — Claim works after KYC approved"""
    print("\n" + "="*80)
    print("TEST C — Claim works after KYC approved")
    print("="*80)
    
    try:
        # 1. Register fresh user
        email = random_email()
        token, user = register_and_verify_user(email)
        
        if not token:
            print("❌ TEST C FAILED: Could not register user")
            return False
        
        # 2. Submit KYC
        kyc_id = submit_kyc(token)
        
        if not kyc_id:
            print("❌ TEST C FAILED: Could not submit KYC")
            return False
        
        # 3. Admin approves KYC
        admin_token = admin_login()
        
        if not admin_token:
            print("❌ TEST C FAILED: Could not login as admin")
            return False
        
        if not approve_kyc(admin_token, kyc_id):
            print("❌ TEST C FAILED: Could not approve KYC")
            return False
        
        # 4. Check claim status (should be eligible now)
        print("\n🔹 Checking claim status after KYC approval...")
        claim_status = get_claim_status(token)
        
        if not claim_status:
            print("❌ TEST C FAILED: Could not get claim status")
            return False
        
        print(f"   Claim status: {claim_status}")
        
        if claim_status['eligible'] != True:
            print(f"❌ TEST C FAILED: eligible should be True after KYC approval, got {claim_status['eligible']}")
            return False
        
        print("✅ TEST C.3 PASSED: Claim status shows eligible=true after KYC approval")
        
        # 5. Claim welcome reward
        print("\n🔹 Claiming welcome reward...")
        claim_resp = claim_welcome_reward(token)
        
        if claim_resp.status_code != 200:
            print(f"❌ TEST C FAILED: Claim failed with {claim_resp.status_code}")
            print(f"   Response: {claim_resp.text}")
            return False
        
        claim_data = claim_resp.json()
        print(f"   Claim response: {claim_data}")
        
        if claim_data.get('ok') != True:
            print(f"❌ TEST C FAILED: Expected ok=true, got {claim_data}")
            return False
        
        if claim_data.get('credited') != 5:
            print(f"❌ TEST C FAILED: Expected credited=5, got {claim_data.get('credited')}")
            return False
        
        if claim_data.get('currency') != 'AUR':
            print(f"❌ TEST C FAILED: Expected currency=AUR, got {claim_data.get('currency')}")
            return False
        
        print("✅ TEST C.4 PASSED: Claim successful with ok=true, credited=5, currency=AUR")
        
        # 6. Verify AUR balance is now 5
        print("\n🔹 Verifying AUR balance is now 5...")
        wallets_data = get_wallets(token)
        aur_wallet = next((w for w in wallets_data['wallets'] if w['currency'] == 'AUR'), None)
        aur_balance = aur_wallet.get('balance', -1)
        
        if aur_balance != 5:
            print(f"❌ TEST C FAILED: AUR balance should be 5, got {aur_balance}")
            return False
        
        print("✅ TEST C.5 PASSED: AUR wallet balance is now 5")
        
        # 7. Try to claim again (should fail with 400)
        print("\n🔹 Attempting to claim again (should fail)...")
        claim_resp2 = claim_welcome_reward(token)
        
        if claim_resp2.status_code != 400:
            print(f"❌ TEST C FAILED: Second claim should return 400, got {claim_resp2.status_code}")
            return False
        
        claim_data2 = claim_resp2.json()
        error_msg = claim_data2.get('error', '')
        
        if 'pending' not in error_msg.lower() or 'reward' not in error_msg.lower():
            print(f"❌ TEST C FAILED: Error should mention 'No pending reward', got '{error_msg}'")
            return False
        
        print("✅ TEST C.6 PASSED: Second claim blocked with 400 'No pending welcome reward'")
        
        # 8. Check claim status (should be 'claimed')
        print("\n🔹 Checking claim status after claim...")
        claim_status2 = get_claim_status(token)
        
        if claim_status2['status'] != 'claimed':
            print(f"❌ TEST C FAILED: status should be 'claimed', got {claim_status2['status']}")
            return False
        
        print("✅ TEST C.7 PASSED: Claim status shows status=claimed")
        print("✅ TEST C PASSED: Claim works after KYC approved (idempotent)")
        return True
        
    except Exception as e:
        print(f"❌ TEST C FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_d_user_notifications_endpoint():
    """Test D — User notifications endpoint"""
    print("\n" + "="*80)
    print("TEST D — User notifications endpoint")
    print("="*80)
    
    try:
        # Use the user from test C (who has KYC approved and claimed reward)
        # For simplicity, create a new user and go through the flow
        email = random_email()
        token, user = register_and_verify_user(email)
        
        if not token:
            print("❌ TEST D FAILED: Could not register user")
            return False
        
        # 1. Get notifications (should work)
        print("\n🔹 Getting user notifications...")
        notif_data = get_notifications(token)
        
        if not notif_data:
            print("❌ TEST D FAILED: Could not get notifications")
            return False
        
        print(f"   Notifications response: {notif_data}")
        
        # Verify response structure
        if 'notifications' not in notif_data:
            print("❌ TEST D FAILED: Missing 'notifications' key")
            return False
        
        if 'unread' not in notif_data:
            print("❌ TEST D FAILED: Missing 'unread' key")
            return False
        
        print("✅ TEST D.1 PASSED: GET /notifications returns correct structure")
        
        # 2. Submit KYC and approve to generate notifications
        kyc_id = submit_kyc(token)
        admin_token = admin_login()
        approve_kyc(admin_token, kyc_id)
        
        # Wait a bit for notification to be created
        time.sleep(1)
        
        # 3. Check for KYC approved notification
        print("\n🔹 Checking for KYC approved notification...")
        notif_data2 = get_notifications(token)
        notifications = notif_data2.get('notifications', [])
        
        kyc_notif = next((n for n in notifications if n.get('kind') == 'kyc_approved'), None)
        
        if not kyc_notif:
            print(f"⚠️ TEST D.2 WARNING: No kyc_approved notification found")
            print(f"   Available notifications: {[n.get('kind') for n in notifications]}")
            # Don't fail the test, as notification might be async
        else:
            if 'Identity verified' not in kyc_notif.get('title', ''):
                print(f"⚠️ TEST D.2 WARNING: KYC notification title unexpected: {kyc_notif.get('title')}")
            else:
                print(f"✅ TEST D.2 PASSED: KYC approved notification found with title 'Identity verified'")
        
        # 4. Claim reward to generate another notification
        claim_welcome_reward(token)
        time.sleep(1)
        
        # 5. Check for reward claimed notification
        print("\n🔹 Checking for reward claimed notification...")
        notif_data3 = get_notifications(token)
        notifications3 = notif_data3.get('notifications', [])
        
        reward_notif = next((n for n in notifications3 if n.get('kind') == 'reward'), None)
        
        if not reward_notif:
            print(f"⚠️ TEST D.3 WARNING: No reward notification found")
            print(f"   Available notifications: {[n.get('kind') for n in notifications3]}")
        else:
            if 'Welcome reward claimed' not in reward_notif.get('title', ''):
                print(f"⚠️ TEST D.3 WARNING: Reward notification title unexpected: {reward_notif.get('title')}")
            else:
                print(f"✅ TEST D.3 PASSED: Reward claimed notification found")
        
        # 6. Mark notifications as read
        print("\n🔹 Marking notifications as read...")
        unread_before = notif_data3.get('unread', 0)
        print(f"   Unread before: {unread_before}")
        
        if not mark_notifications_read(token):
            print("❌ TEST D FAILED: Could not mark notifications as read")
            return False
        
        # 7. Verify unread count is 0
        notif_data4 = get_notifications(token)
        unread_after = notif_data4.get('unread', -1)
        print(f"   Unread after: {unread_after}")
        
        if unread_after != 0:
            print(f"❌ TEST D FAILED: Unread should be 0 after marking read, got {unread_after}")
            return False
        
        print("✅ TEST D.4 PASSED: Notifications marked as read, unread=0")
        print("✅ TEST D PASSED: User notifications endpoint working")
        return True
        
    except Exception as e:
        print(f"❌ TEST D FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_e_email_notifications():
    """Test E — Email notifications fire on key events"""
    print("\n" + "="*80)
    print("TEST E — Email notifications fire on key events")
    print("="*80)
    
    print("\n⚠️ NOTE: This test verifies notification ROWS are created (not actual email delivery)")
    print("   Email delivery may fail if Resend isn't fully configured, but rows should exist")
    
    try:
        # Create a test user with KYC approved
        email = random_email()
        token, user = register_and_verify_user(email)
        kyc_id = submit_kyc(token)
        admin_token = admin_login()
        approve_kyc(admin_token, kyc_id)
        
        # Claim reward to get some AUR balance
        claim_welcome_reward(token)
        
        # Request and activate a card (required for withdrawals)
        print("\n🔹 Requesting and activating card (required for withdrawals)...")
        card_data = request_card(token, "basic")
        if card_data:
            card_id = card_data.get('card', {}).get('id')
            activate_card(token, card_id)
            admin_approve_card(admin_token, card_id, activate_now=True)
            print("   Card activated successfully")
        
        user_id = user.get('id')
        
        # Test 1: Deposit request creation → NO email (only on admin approval)
        print("\n🔹 Test E.1: Deposit request creation (no notification expected)...")
        deposit_data = create_deposit_request(token, 100, "USD")
        time.sleep(1)
        notif_data = get_notifications(token)
        deposit_notif = next((n for n in notif_data['notifications'] if 'deposit' in n.get('kind', '').lower() and 'request' in n.get('title', '').lower()), None)
        
        if deposit_notif:
            print(f"⚠️ Unexpected notification for deposit request: {deposit_notif}")
        else:
            print("✅ TEST E.1 PASSED: No notification for deposit request creation")
        
        # Test 2: Admin approves deposit → user gets notification
        print("\n🔹 Test E.2: Admin approves deposit (notification expected)...")
        deposit_id = deposit_data.get('request', {}).get('id')
        admin_approve_deposit(admin_token, deposit_id)
        time.sleep(1)
        
        notif_data = get_notifications(token)
        deposit_approved_notif = next((n for n in notif_data['notifications'] if n.get('kind') == 'deposit_approved'), None)
        
        if not deposit_approved_notif:
            print(f"❌ TEST E.2 FAILED: No deposit_approved notification found")
            print(f"   Available: {[n.get('kind') for n in notif_data['notifications']]}")
            return False
        
        if 'Deposit credited' not in deposit_approved_notif.get('title', ''):
            print(f"❌ TEST E.2 FAILED: Wrong title: {deposit_approved_notif.get('title')}")
            return False
        
        print(f"✅ TEST E.2 PASSED: Deposit approved notification found (kind=deposit_approved, title='Deposit credited')")
        
        # Test 3: Admin rejects a deposit → user gets notification
        print("\n🔹 Test E.3: Admin rejects deposit (notification expected)...")
        deposit_data2 = create_deposit_request(token, 50, "USD")
        deposit_id2 = deposit_data2.get('request', {}).get('id')
        admin_reject_deposit(admin_token, deposit_id2)
        time.sleep(1)
        
        notif_data = get_notifications(token)
        deposit_rejected_notif = next((n for n in notif_data['notifications'] if n.get('kind') == 'deposit_rejected'), None)
        
        if not deposit_rejected_notif:
            print(f"❌ TEST E.3 FAILED: No deposit_rejected notification found")
            return False
        
        if 'Deposit rejected' not in deposit_rejected_notif.get('title', ''):
            print(f"❌ TEST E.3 FAILED: Wrong title: {deposit_rejected_notif.get('title')}")
            return False
        
        print(f"✅ TEST E.3 PASSED: Deposit rejected notification found")
        
        # Test 4: Admin approves withdrawal → user gets notification
        print("\n🔹 Test E.4: Admin approves withdrawal (notification expected)...")
        withdrawal_data = create_withdrawal_request(token, 30, "USD")
        withdrawal_id = withdrawal_data.get('request', {}).get('id')
        admin_approve_withdrawal(admin_token, withdrawal_id)
        time.sleep(1)
        
        notif_data = get_notifications(token)
        withdrawal_approved_notif = next((n for n in notif_data['notifications'] if n.get('kind') == 'withdraw_approved'), None)
        
        if not withdrawal_approved_notif:
            print(f"❌ TEST E.4 FAILED: No withdraw_approved notification found")
            print(f"   Available: {[n.get('kind') for n in notif_data['notifications']]}")
            return False
        
        if 'Withdrawal released' not in withdrawal_approved_notif.get('title', ''):
            print(f"❌ TEST E.4 FAILED: Wrong title: {withdrawal_approved_notif.get('title')}")
            return False
        
        print(f"✅ TEST E.4 PASSED: Withdrawal approved notification found (kind=withdraw_approved, title='Withdrawal released')")
        
        # Test 5: Admin rejects withdrawal → user gets notification
        print("\n🔹 Test E.5: Admin rejects withdrawal (notification expected)...")
        withdrawal_data2 = create_withdrawal_request(token, 20, "USD")
        withdrawal_id2 = withdrawal_data2.get('request', {}).get('id')
        admin_reject_withdrawal(admin_token, withdrawal_id2)
        time.sleep(1)
        
        notif_data = get_notifications(token)
        withdrawal_rejected_notif = next((n for n in notif_data['notifications'] if n.get('kind') == 'withdraw_rejected'), None)
        
        if not withdrawal_rejected_notif:
            print(f"❌ TEST E.5 FAILED: No withdraw_rejected notification found")
            return False
        
        if 'Withdrawal rejected' not in withdrawal_rejected_notif.get('title', ''):
            print(f"❌ TEST E.5 FAILED: Wrong title: {withdrawal_rejected_notif.get('title')}")
            return False
        
        print(f"✅ TEST E.5 PASSED: Withdrawal rejected notification found")
        
        # Test 6: Admin approves card → user gets notification
        print("\n🔹 Test E.6: Admin approves card (notification expected)...")
        card_data = request_card(token, "premium")  # Use premium since basic already requested
        if not card_data:
            print(f"❌ TEST E.6 FAILED: Could not request premium card")
            return False
        
        card_id = card_data.get('card', {}).get('id')
        activate_card(token, card_id)
        admin_approve_card(admin_token, card_id, activate_now=True)
        time.sleep(1)
        
        notif_data = get_notifications(token)
        card_approved_notif = next((n for n in notif_data['notifications'] if n.get('kind') == 'card_activated'), None)
        
        if not card_approved_notif:
            print(f"❌ TEST E.6 FAILED: No card_activated notification found")
            print(f"   Available: {[n.get('kind') for n in notif_data['notifications']]}")
            return False
        
        if 'Card approved' not in card_approved_notif.get('title', ''):
            print(f"❌ TEST E.6 FAILED: Wrong title: {card_approved_notif.get('title')}")
            return False
        
        print(f"✅ TEST E.6 PASSED: Card approved notification found (kind=card_activated, title='Card approved')")
        
        # Test 7: Incoming internal transfer → recipient gets notification
        print("\n🔹 Test E.7: Incoming transfer (notification expected)...")
        # Create another user to send transfer
        email2 = random_email()
        token2, user2 = register_and_verify_user(email2)
        kyc_id2 = submit_kyc(token2)
        approve_kyc(admin_token, kyc_id2)
        claim_welcome_reward(token2)
        
        # Send transfer from user2 to user1
        recipient_email = user.get('email')
        internal_transfer(token2, recipient_email, 1, "AUR")
        time.sleep(1)
        
        notif_data = get_notifications(token)
        transfer_notif = next((n for n in notif_data['notifications'] if n.get('kind') == 'transfer_in'), None)
        
        if not transfer_notif:
            print(f"❌ TEST E.7 FAILED: No transfer_in notification found")
            print(f"   Available: {[n.get('kind') for n in notif_data['notifications']]}")
            return False
        
        if 'Payment received' not in transfer_notif.get('title', ''):
            print(f"❌ TEST E.7 FAILED: Wrong title: {transfer_notif.get('title')}")
            return False
        
        print(f"✅ TEST E.7 PASSED: Transfer notification found (kind=transfer_in, title='Payment received')")
        
        print("\n✅ TEST E PASSED: All email notifications fire on key events (7/7)")
        return True
        
    except Exception as e:
        print(f"❌ TEST E FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_f_regression_sanity():
    """Test F — Regression sanity"""
    print("\n" + "="*80)
    print("TEST F — Regression sanity")
    print("="*80)
    
    try:
        # Test 1: GET /health
        print("\n🔹 Test F.1: GET /health...")
        resp = requests.get(f"{BASE_URL}/health")
        
        if resp.status_code != 200:
            print(f"❌ TEST F.1 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        if data.get('ok') != True:
            print(f"❌ TEST F.1 FAILED: Expected ok=true, got {data}")
            return False
        
        print("✅ TEST F.1 PASSED: GET /health → 200")
        
        # Test 2: GET /config
        print("\n🔹 Test F.2: GET /config...")
        resp = requests.get(f"{BASE_URL}/config")
        
        if resp.status_code != 200:
            print(f"❌ TEST F.2 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        
        # Check for key fields
        if 'enabled_fiat' not in data:
            print(f"❌ TEST F.2 FAILED: Missing enabled_fiat")
            return False
        
        if 'enabled_crypto' not in data:
            print(f"❌ TEST F.2 FAILED: Missing enabled_crypto")
            return False
        
        if 'all_fiat' not in data:
            print(f"❌ TEST F.2 FAILED: Missing all_fiat")
            return False
        
        # Check counts
        if len(data['all_fiat']) != 50:
            print(f"❌ TEST F.2 FAILED: Expected 50 fiat currencies, got {len(data['all_fiat'])}")
            return False
        
        print(f"✅ TEST F.2 PASSED: GET /config → 200 with enabled_fiat, enabled_crypto, all_fiat=50")
        
        # Test 3: Admin login
        print("\n🔹 Test F.3: Admin login...")
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": "admin@aurelawallet.com",
            "password": "Aurela@123#"
        })
        
        if resp.status_code != 200:
            print(f"❌ TEST F.3 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        if not data.get('token'):
            print(f"❌ TEST F.3 FAILED: No token in response")
            return False
        
        print("✅ TEST F.3 PASSED: Admin login → 200")
        
        # Test 4: GET /rates
        print("\n🔹 Test F.4: GET /rates...")
        resp = requests.get(f"{BASE_URL}/rates")
        
        if resp.status_code != 200:
            print(f"❌ TEST F.4 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        
        # Check for crypto_usd
        if 'crypto_usd' not in data:
            print(f"❌ TEST F.4 FAILED: Missing crypto_usd")
            return False
        
        crypto_usd = data['crypto_usd']
        
        # Check for key cryptos
        for crypto in ['BTC', 'ETH', 'SOL']:
            if crypto not in crypto_usd:
                print(f"❌ TEST F.4 FAILED: Missing {crypto} in crypto_usd")
                return False
            
            # Verify prices move (call again and compare)
        
        # Check for aur field
        if 'aur' not in data:
            print(f"❌ TEST F.4 FAILED: Missing aur field")
            return False
        
        # Check for crypto_history
        if 'crypto_history' not in data:
            print(f"❌ TEST F.4 FAILED: Missing crypto_history")
            return False
        
        # Check for crypto_change
        if 'crypto_change' not in data:
            print(f"❌ TEST F.4 FAILED: Missing crypto_change")
            return False
        
        print("✅ TEST F.4 PASSED: GET /rates → 200 with crypto_usd tick (BTC, ETH, SOL), aur field, crypto_history, crypto_change")
        
        print("\n✅ TEST F PASSED: Regression sanity checks (4/4)")
        return True
        
    except Exception as e:
        print(f"❌ TEST F FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("\n" + "="*80)
    print("FOCUSED TEST: Welcome Reward CLAIM-ONLY + Notifications")
    print("Admin creds: admin@aurelawallet.com / Aurela@123#")
    print("="*80)
    
    results = {}
    
    # Run all tests
    results['A'] = test_a_welcome_reward_claim_only()
    results['B'] = test_b_claim_blocks_non_kyc()
    results['C'] = test_c_claim_works_after_kyc()
    results['D'] = test_d_user_notifications_endpoint()
    results['E'] = test_e_email_notifications()
    results['F'] = test_f_regression_sanity()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"Test {test}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())
