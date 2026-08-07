#!/usr/bin/env python3
"""
Aurela Backend API Test Suite - NEW FEATURES
Tests NEW/CHANGED backend features from this session:
- Test A: Welcome bonus is now 5 AUR (not USD/USDT)
- Test B: Aurela Coin (AUR) live price ticker
- Test C: Card tier limits updated
- Test D: Blocks are anonymized (Aurela IDs, not usernames)
- Test E: Transfer by Aurela ID
- Test F: Regression
"""

import requests
import json
import random
import string
import time
import re
import os
from pymongo import MongoClient

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# MongoDB connection
def get_db():
    """Get MongoDB database connection"""
    client = MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    return client[os.environ.get('DB_NAME', 'aurela')]

def random_email():
    """Generate random email for testing"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"testuser{rand}@aurela.test"

def random_phone():
    """Generate random phone number"""
    return '+1' + ''.join(random.choices(string.digits, k=10))

def print_test(section, test_name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{section} - {test_name}: {status}")
    if details:
        print(f"  Details: {details}")

def admin_login():
    """Login as admin and return token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get('token')
        else:
            print(f"❌ Admin login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Admin login error: {e}")
        return None

def get_otp_from_db(signup_id):
    """Try to get OTP from response or return None"""
    # In real scenario, we'd query MongoDB directly
    # For now, we rely on dev_otp in response
    return None

def test_section_a():
    """Test A — Welcome bonus is now 5 AUR (not USD/USDT)"""
    print("\n" + "="*80)
    print("TEST SECTION A: Welcome Bonus is 5 AUR (not USD/USDT)")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Step 1: Register init with fresh email + all mandatory fields
    try:
        email = random_email()
        phone = random_phone()
        first_name = "Sophia"
        last_name = "Martinez"
        country = "US"
        password = "SecurePass123!"
        
        print(f"\n[A1] Registering new user: {email}")
        response = requests.post(f"{BASE_URL}/auth/register/init", json={
            "email": email,
            "password": password,
            "first_name": first_name,
            "last_name": last_name,
            "country": country,
            "phone": phone
        })
        
        if response.status_code == 200:
            data = response.json()
            signup_id = data.get('signup_id')
            dev_otp = data.get('dev_otp')
            
            # If dev_otp not in response, fetch from MongoDB
            if signup_id and not dev_otp:
                try:
                    db = get_db()
                    pending = db.pending_signups.find_one({'id': signup_id})
                    if pending:
                        dev_otp = pending.get('code')
                        print(f"  Fetched OTP from DB: {dev_otp}")
                except Exception as e:
                    print(f"  Warning: Could not fetch OTP from DB: {e}")
            
            if signup_id and dev_otp:
                print_test("A1", "Register init with all mandatory fields", True, f"signup_id: {signup_id[:20]}..., OTP: {dev_otp}")
                results["passed"] += 1
                
                # Step 2: Verify with OTP
                print(f"\n[A2] Verifying signup with OTP: {dev_otp}")
                verify_response = requests.post(f"{BASE_URL}/auth/register/verify", json={
                    "signup_id": signup_id,
                    "code": dev_otp
                })
                
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    token = verify_data.get('token')
                    user = verify_data.get('user')
                    
                    if token and user:
                        print_test("A2", "Register verify returns token and user", True, f"user_id: {user.get('id')[:20]}...")
                        results["passed"] += 1
                        
                        # Step 3: Get wallets and verify welcome bonus
                        print(f"\n[A3] Fetching wallets to verify welcome bonus")
                        wallets_response = requests.get(f"{BASE_URL}/wallets", headers={
                            "Authorization": f"Bearer {token}"
                        })
                        
                        if wallets_response.status_code == 200:
                            wallets_data = wallets_response.json()
                            wallets = wallets_data.get('wallets', [])
                            
                            # Find AUR, USD, USDT wallets
                            aur_wallet = next((w for w in wallets if w.get('currency') == 'AUR'), None)
                            usd_wallet = next((w for w in wallets if w.get('currency') == 'USD'), None)
                            usdt_wallet = next((w for w in wallets if w.get('currency') == 'USDT'), None)
                            
                            # Count total wallets (should be 81: 50 fiat + 31 crypto including AUR)
                            total_wallets = len(wallets)
                            
                            print(f"  Total wallets: {total_wallets}")
                            print(f"  AUR balance: {aur_wallet.get('balance') if aur_wallet else 'N/A'}")
                            print(f"  USD balance: {usd_wallet.get('balance') if usd_wallet else 'N/A'}")
                            print(f"  USDT balance: {usdt_wallet.get('balance') if usdt_wallet else 'N/A'}")
                            
                            # Verify AUR wallet has 5 balance
                            if aur_wallet and aur_wallet.get('balance') == 5:
                                print_test("A3", "AUR wallet has 5 welcome bonus", True, "✅ NEW welcome bonus")
                                results["passed"] += 1
                            else:
                                print_test("A3", "AUR wallet has 5 welcome bonus", False, f"Expected 5, got {aur_wallet.get('balance') if aur_wallet else 'N/A'}")
                                results["failed"] += 1
                            
                            # Verify USD wallet has 0 balance (no more welcome bonus)
                            if usd_wallet and usd_wallet.get('balance') == 0:
                                print_test("A4", "USD wallet has 0 balance (no welcome bonus)", True, "✅ OLD bonus removed")
                                results["passed"] += 1
                            else:
                                print_test("A4", "USD wallet has 0 balance", False, f"Expected 0, got {usd_wallet.get('balance') if usd_wallet else 'N/A'}")
                                results["failed"] += 1
                            
                            # Verify USDT wallet has 0 balance (no more welcome bonus)
                            if usdt_wallet and usdt_wallet.get('balance') == 0:
                                print_test("A5", "USDT wallet has 0 balance (no welcome bonus)", True, "✅ OLD bonus removed")
                                results["passed"] += 1
                            else:
                                print_test("A5", "USDT wallet has 0 balance", False, f"Expected 0, got {usdt_wallet.get('balance') if usdt_wallet else 'N/A'}")
                                results["failed"] += 1
                            
                            # Verify total wallets = 81 (50 fiat + 31 crypto including AUR)
                            if total_wallets == 81:
                                print_test("A6", "Total wallets = 81 (50 fiat + 31 crypto)", True, f"✅ AUR added to crypto list")
                                results["passed"] += 1
                            else:
                                print_test("A6", "Total wallets = 81", False, f"Expected 81, got {total_wallets}")
                                results["failed"] += 1
                        else:
                            print_test("A3-A6", "Get wallets", False, f"Status {wallets_response.status_code}")
                            results["failed"] += 4
                    else:
                        print_test("A2", "Register verify returns token and user", False, "Missing token or user")
                        results["failed"] += 1
                        results["failed"] += 4  # Skip A3-A6
                else:
                    print_test("A2", "Register verify", False, f"Status {verify_response.status_code}: {verify_response.text}")
                    results["failed"] += 1
                    results["failed"] += 4  # Skip A3-A6
            else:
                print_test("A1", "Register init", False, f"Missing signup_id or dev_otp: {data}")
                results["failed"] += 1
                results["failed"] += 5  # Skip A2-A6
        else:
            print_test("A1", "Register init", False, f"Status {response.status_code}: {response.text}")
            results["failed"] += 1
            results["failed"] += 5  # Skip A2-A6
    except Exception as e:
        print_test("A1-A6", "Welcome bonus test", False, str(e))
        results["failed"] += 6
    
    print(f"\n{'='*80}")
    print(f"SECTION A RESULTS: {results['passed']}/6 tests passed")
    print(f"{'='*80}")
    return results

def test_section_b():
    """Test B — Aurela Coin (AUR) live price ticker"""
    print("\n" + "="*80)
    print("TEST SECTION B: Aurela Coin (AUR) Live Price Ticker")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Test B1: GET /api/rates includes AUR data
    try:
        print(f"\n[B1] Fetching rates to verify AUR ticker")
        response = requests.get(f"{BASE_URL}/rates")
        
        if response.status_code == 200:
            data = response.json()
            crypto_usd = data.get('crypto_usd', {})
            aur_data = data.get('aur', {})
            
            print(f"  crypto_usd.AUR: {crypto_usd.get('AUR')}")
            print(f"  aur.price_inr: {aur_data.get('price_inr')}")
            print(f"  aur.price_usd: {aur_data.get('price_usd')}")
            print(f"  aur.history length: {len(aur_data.get('history', []))}")
            
            # Verify crypto_usd.AUR exists and is in range 0.5-2 USD
            aur_usd = crypto_usd.get('AUR')
            if aur_usd and isinstance(aur_usd, (int, float)) and 0.5 <= aur_usd <= 2.5:
                print_test("B1", "crypto_usd.AUR exists and in range 0.5-2.5 USD", True, f"Price: ${aur_usd}")
                results["passed"] += 1
            else:
                print_test("B1", "crypto_usd.AUR in range", False, f"Expected 0.5-2.5, got {aur_usd}")
                results["failed"] += 1
            
            # Verify aur.price_inr exists and is in range 200-350
            price_inr = aur_data.get('price_inr')
            if price_inr and isinstance(price_inr, (int, float)) and 200 <= price_inr <= 350:
                print_test("B2", "aur.price_inr in range 200-350 INR", True, f"Price: ₹{price_inr}")
                results["passed"] += 1
            else:
                print_test("B2", "aur.price_inr in range", False, f"Expected 200-350, got {price_inr}")
                results["failed"] += 1
            
            # Verify aur.price_usd matches crypto_usd.AUR
            price_usd = aur_data.get('price_usd')
            if price_usd and aur_usd and abs(price_usd - aur_usd) < 0.0001:
                print_test("B3", "aur.price_usd matches crypto_usd.AUR", True, f"Both: ${price_usd}")
                results["passed"] += 1
            else:
                print_test("B3", "aur.price_usd matches crypto_usd.AUR", False, f"price_usd={price_usd}, crypto_usd.AUR={aur_usd}")
                results["failed"] += 1
            
            # Verify aur.history exists and is an array
            history = aur_data.get('history', [])
            if isinstance(history, list) and len(history) > 0:
                print_test("B4", "aur.history exists and has data", True, f"History points: {len(history)}")
                results["passed"] += 1
            else:
                print_test("B4", "aur.history exists", False, f"Expected array with data, got {type(history)}")
                results["failed"] += 1
            
            # Store first price for comparison
            first_price_inr = price_inr
            
            # Test B5: Wait 3 seconds and verify price changes (random walk)
            print(f"\n[B5] Waiting 3 seconds for price to change...")
            time.sleep(3)
            
            response2 = requests.get(f"{BASE_URL}/rates")
            if response2.status_code == 200:
                data2 = response2.json()
                aur_data2 = data2.get('aur', {})
                second_price_inr = aur_data2.get('price_inr')
                
                print(f"  First price: ₹{first_price_inr}")
                print(f"  Second price: ₹{second_price_inr}")
                
                # Price should be different (random walk)
                if second_price_inr and first_price_inr and second_price_inr != first_price_inr:
                    print_test("B5", "Price changes after 3 seconds (random walk)", True, f"Δ = ₹{abs(second_price_inr - first_price_inr):.2f}")
                    results["passed"] += 1
                else:
                    print_test("B5", "Price changes", False, f"Both prices: ₹{first_price_inr}")
                    results["failed"] += 1
                
                # Test B6: Wait 3 more seconds and verify still in range
                print(f"\n[B6] Waiting 3 more seconds...")
                time.sleep(3)
                
                response3 = requests.get(f"{BASE_URL}/rates")
                if response3.status_code == 200:
                    data3 = response3.json()
                    aur_data3 = data3.get('aur', {})
                    third_price_inr = aur_data3.get('price_inr')
                    
                    print(f"  Third price: ₹{third_price_inr}")
                    
                    if third_price_inr and 200 <= third_price_inr <= 350:
                        print_test("B6", "Price still in range 200-350 after 6 seconds", True, f"Price: ₹{third_price_inr}")
                        results["passed"] += 1
                    else:
                        print_test("B6", "Price in range", False, f"Expected 200-350, got {third_price_inr}")
                        results["failed"] += 1
                    
                    # Test B7: Verify history grows
                    history3 = aur_data3.get('history', [])
                    if len(history3) > len(history):
                        print_test("B7", "History grows over time", True, f"From {len(history)} to {len(history3)} points")
                        results["passed"] += 1
                    else:
                        print_test("B7", "History grows", False, f"Expected > {len(history)}, got {len(history3)}")
                        results["failed"] += 1
                else:
                    print_test("B6-B7", "Third rates call", False, f"Status {response3.status_code}")
                    results["failed"] += 2
            else:
                print_test("B5-B7", "Second rates call", False, f"Status {response2.status_code}")
                results["failed"] += 3
        else:
            print_test("B1-B7", "GET /api/rates", False, f"Status {response.status_code}")
            results["failed"] += 7
    except Exception as e:
        print_test("B1-B7", "AUR ticker test", False, str(e))
        results["failed"] += 7
    
    print(f"\n{'='*80}")
    print(f"SECTION B RESULTS: {results['passed']}/7 tests passed")
    print(f"{'='*80}")
    return results

def test_section_c():
    """Test C — Card tier limits updated"""
    print("\n" + "="*80)
    print("TEST SECTION C: Card Tier Limits Updated")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Test C1: GET /api/config and verify card_tiers
    try:
        print(f"\n[C1] Fetching config to verify card tier limits")
        response = requests.get(f"{BASE_URL}/config")
        
        if response.status_code == 200:
            data = response.json()
            card_tiers = data.get('card_tiers', {})
            
            print(f"  Card tiers: {json.dumps(card_tiers, indent=2)}")
            
            # Verify basic tier
            basic = card_tiers.get('basic', {})
            if basic.get('monthly_spend') == 500000:
                print_test("C1", "Basic tier monthly_spend = 500000", True, "✅ Updated")
                results["passed"] += 1
            else:
                print_test("C1", "Basic tier monthly_spend", False, f"Expected 500000, got {basic.get('monthly_spend')}")
                results["failed"] += 1
            
            # Verify premium tier
            premium = card_tiers.get('premium', {})
            if premium.get('monthly_spend') == 1000000:
                print_test("C2", "Premium tier monthly_spend = 1000000", True, "✅ Updated")
                results["passed"] += 1
            else:
                print_test("C2", "Premium tier monthly_spend", False, f"Expected 1000000, got {premium.get('monthly_spend')}")
                results["failed"] += 1
            
            # Verify elite tier
            elite = card_tiers.get('elite', {})
            if elite.get('monthly_spend') == 5000000:
                print_test("C3", "Elite tier monthly_spend = 5000000", True, "✅ Updated")
                results["passed"] += 1
            else:
                print_test("C3", "Elite tier monthly_spend", False, f"Expected 5000000, got {elite.get('monthly_spend')}")
                results["failed"] += 1
        else:
            print_test("C1-C3", "GET /api/config", False, f"Status {response.status_code}")
            results["failed"] += 3
    except Exception as e:
        print_test("C1-C3", "Card tier limits test", False, str(e))
        results["failed"] += 3
    
    print(f"\n{'='*80}")
    print(f"SECTION C RESULTS: {results['passed']}/3 tests passed")
    print(f"{'='*80}")
    return results

def test_section_d():
    """Test D — Blocks are anonymized (Aurela IDs, not usernames)"""
    print("\n" + "="*80)
    print("TEST SECTION D: Blocks Anonymized (Aurela IDs, not usernames)")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Test D1: GET /api/chain?limit=20 and verify anonymization
    try:
        print(f"\n[D1] Fetching chain blocks to verify anonymization")
        response = requests.get(f"{BASE_URL}/chain?limit=20")
        
        if response.status_code == 200:
            data = response.json()
            blocks = data.get('blocks', [])
            total = data.get('total', 0)
            
            print(f"  Total blocks in chain: {total}")
            print(f"  Fetched blocks: {len(blocks)}")
            
            # Verify total blocks >= 500 (auto-seed migration)
            if total >= 500:
                print_test("D1", "Total blocks >= 500 (auto-seeded)", True, f"Total: {total}")
                results["passed"] += 1
            else:
                print_test("D1", "Total blocks >= 500", False, f"Expected >= 500, got {total}")
                results["failed"] += 1
            
            # Verify all blocks use Aurela IDs (AUR\d{9}) or 'external', not human names
            human_names = ['satoshi', 'vitalik', 'ceo', 'trader', 'alicia', 'marco', 'yumi', 'zara', 'omar', 'luna', 'kai', 'ivy', 'ren', 'nora']
            aurela_id_pattern = re.compile(r'^AUR\d{9}$')
            
            violations = []
            for block in blocks:
                from_username = block.get('from_username', '')
                to_username = block.get('to_username', '')
                
                # Check from_username
                if from_username and from_username != 'external':
                    if not aurela_id_pattern.match(from_username):
                        violations.append(f"Block {block.get('block_number')}: from_username='{from_username}'")
                    # Check for human names
                    for name in human_names:
                        if name.lower() in from_username.lower():
                            violations.append(f"Block {block.get('block_number')}: from_username contains human name '{name}'")
                
                # Check to_username
                if to_username and to_username != 'external':
                    if not aurela_id_pattern.match(to_username):
                        violations.append(f"Block {block.get('block_number')}: to_username='{to_username}'")
                    # Check for human names
                    for name in human_names:
                        if name.lower() in to_username.lower():
                            violations.append(f"Block {block.get('block_number')}: to_username contains human name '{name}'")
            
            if len(violations) == 0:
                print_test("D2", "All blocks use Aurela IDs or 'external' (no human names)", True, f"✅ All {len(blocks)} blocks anonymized")
                results["passed"] += 1
            else:
                print_test("D2", "Blocks anonymized", False, f"Found {len(violations)} violations: {violations[:3]}")
                results["failed"] += 1
            
            # Test D3: Search for 'satoshi' should return 0 blocks
            print(f"\n[D3] Searching for 'satoshi' (should return 0 blocks)")
            search_response = requests.get(f"{BASE_URL}/chain/search?q=satoshi")
            
            if search_response.status_code == 200:
                search_data = search_response.json()
                search_blocks = search_data.get('blocks', [])
                
                if len(search_blocks) == 0:
                    print_test("D3", "Search 'satoshi' returns 0 blocks", True, "✅ No human names in chain")
                    results["passed"] += 1
                else:
                    print_test("D3", "Search 'satoshi' returns 0 blocks", False, f"Found {len(search_blocks)} blocks")
                    results["failed"] += 1
            else:
                print_test("D3", "Search 'satoshi'", False, f"Status {search_response.status_code}")
                results["failed"] += 1
            
            # Test D4: Search for 'AUR' should return several blocks
            print(f"\n[D4] Searching for 'AUR' (should return blocks with Aurela IDs)")
            search_response2 = requests.get(f"{BASE_URL}/chain/search?q=AUR")
            
            if search_response2.status_code == 200:
                search_data2 = search_response2.json()
                search_blocks2 = search_data2.get('blocks', [])
                
                if len(search_blocks2) > 0:
                    print_test("D4", "Search 'AUR' returns blocks", True, f"Found {len(search_blocks2)} blocks with Aurela IDs")
                    results["passed"] += 1
                else:
                    print_test("D4", "Search 'AUR' returns blocks", False, "Expected > 0 blocks")
                    results["failed"] += 1
            else:
                print_test("D4", "Search 'AUR'", False, f"Status {search_response2.status_code}")
                results["failed"] += 1
        else:
            print_test("D1-D4", "GET /api/chain", False, f"Status {response.status_code}")
            results["failed"] += 4
    except Exception as e:
        print_test("D1-D4", "Block anonymization test", False, str(e))
        results["failed"] += 4
    
    print(f"\n{'='*80}")
    print(f"SECTION D RESULTS: {results['passed']}/4 tests passed")
    print(f"{'='*80}")
    return results

def test_section_e():
    """Test E — Transfer by Aurela ID"""
    print("\n" + "="*80)
    print("TEST SECTION E: Transfer by Aurela ID")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Step 1: Login as admin and get admin's user_code
    try:
        print(f"\n[E1] Logging in as admin")
        admin_token = admin_login()
        
        if admin_token:
            print_test("E1", "Admin login", True, f"Token: {admin_token[:20]}...")
            results["passed"] += 1
            
            # Get admin's user info
            me_response = requests.get(f"{BASE_URL}/auth/me", headers={
                "Authorization": f"Bearer {admin_token}"
            })
            
            if me_response.status_code == 200:
                admin_user = me_response.json().get('user', {})
                admin_user_code = admin_user.get('user_code')
                admin_email = admin_user.get('email')
                
                print(f"  Admin user_code: {admin_user_code}")
                print(f"  Admin email: {admin_email}")
                
                # Step 2: Create a fresh test user
                print(f"\n[E2] Creating fresh test user")
                test_email = random_email()
                test_phone = random_phone()
                
                register_response = requests.post(f"{BASE_URL}/auth/register/init", json={
                    "email": test_email,
                    "password": "TestPass123!",
                    "first_name": "Transfer",
                    "last_name": "Tester",
                    "country": "US",
                    "phone": test_phone
                })
                
                if register_response.status_code == 200:
                    register_data = register_response.json()
                    signup_id = register_data.get('signup_id')
                    dev_otp = register_data.get('dev_otp')
                    
                    # If dev_otp not in response, fetch from MongoDB
                    if signup_id and not dev_otp:
                        try:
                            db = get_db()
                            pending = db.pending_signups.find_one({'id': signup_id})
                            if pending:
                                dev_otp = pending.get('code')
                                print(f"  Fetched OTP from DB: {dev_otp}")
                        except Exception as e:
                            print(f"  Warning: Could not fetch OTP from DB: {e}")
                    
                    # Verify signup
                    verify_response = requests.post(f"{BASE_URL}/auth/register/verify", json={
                        "signup_id": signup_id,
                        "code": dev_otp
                    })
                    
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        test_token = verify_data.get('token')
                        test_user = verify_data.get('user')
                        test_user_code = test_user.get('user_code')
                        
                        print_test("E2", "Fresh test user created", True, f"user_code: {test_user_code}")
                        results["passed"] += 1
                        
                        # Step 3: Transfer AUR from test user to admin using Aurela ID
                        print(f"\n[E3] Transferring 1 AUR from test user to admin using Aurela ID")
                        print(f"  From: {test_user_code} (test user)")
                        print(f"  To: {admin_user_code} (admin)")
                        
                        transfer_response = requests.post(f"{BASE_URL}/transfer", 
                            headers={"Authorization": f"Bearer {test_token}"},
                            json={
                                "recipient": admin_user_code,  # Using Aurela ID
                                "currency": "AUR",
                                "amount": 1,
                                "note": "Test transfer by Aurela ID"
                            }
                        )
                        
                        if transfer_response.status_code == 200:
                            transfer_data = transfer_response.json()
                            if transfer_data.get('ok'):
                                print_test("E3", "Transfer by Aurela ID (AUR)", True, f"✅ Transfer successful")
                                results["passed"] += 1
                            else:
                                print_test("E3", "Transfer by Aurela ID", False, f"Response: {transfer_data}")
                                results["failed"] += 1
                        else:
                            print_test("E3", "Transfer by Aurela ID", False, f"Status {transfer_response.status_code}: {transfer_response.text}")
                            results["failed"] += 1
                        
                        # Step 4: Transfer by email (regression test)
                        print(f"\n[E4] Transferring 1 AUR from test user to admin using email")
                        transfer_response2 = requests.post(f"{BASE_URL}/transfer", 
                            headers={"Authorization": f"Bearer {test_token}"},
                            json={
                                "recipient": admin_email,  # Using email
                                "currency": "AUR",
                                "amount": 1,
                                "note": "Test transfer by email"
                            }
                        )
                        
                        if transfer_response2.status_code == 200:
                            transfer_data2 = transfer_response2.json()
                            if transfer_data2.get('ok'):
                                print_test("E4", "Transfer by email (regression)", True, f"✅ Transfer successful")
                                results["passed"] += 1
                            else:
                                print_test("E4", "Transfer by email", False, f"Response: {transfer_data2}")
                                results["failed"] += 1
                        else:
                            print_test("E4", "Transfer by email", False, f"Status {transfer_response2.status_code}: {transfer_response2.text}")
                            results["failed"] += 1
                    else:
                        print_test("E2", "Verify test user", False, f"Status {verify_response.status_code}")
                        results["failed"] += 1
                        results["failed"] += 2  # Skip E3-E4
                else:
                    print_test("E2", "Register test user", False, f"Status {register_response.status_code}")
                    results["failed"] += 1
                    results["failed"] += 2  # Skip E3-E4
            else:
                print_test("E1", "Get admin info", False, f"Status {me_response.status_code}")
                results["failed"] += 1
                results["failed"] += 3  # Skip E2-E4
        else:
            print_test("E1", "Admin login", False, "Failed to get token")
            results["failed"] += 1
            results["failed"] += 3  # Skip E2-E4
    except Exception as e:
        print_test("E1-E4", "Transfer by Aurela ID test", False, str(e))
        results["failed"] += 4
    
    print(f"\n{'='*80}")
    print(f"SECTION E RESULTS: {results['passed']}/4 tests passed")
    print(f"{'='*80}")
    return results

def test_section_f():
    """Test F — Regression"""
    print("\n" + "="*80)
    print("TEST SECTION F: Regression Tests")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # Test F1: GET /api/health
    try:
        print(f"\n[F1] Testing /api/health")
        response = requests.get(f"{BASE_URL}/health")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print_test("F1", "GET /api/health", True, "✅")
                results["passed"] += 1
            else:
                print_test("F1", "GET /api/health", False, f"Response: {data}")
                results["failed"] += 1
        else:
            print_test("F1", "GET /api/health", False, f"Status {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_test("F1", "GET /api/health", False, str(e))
        results["failed"] += 1
    
    # Test F2: GET /api/config
    try:
        print(f"\n[F2] Testing /api/config")
        response = requests.get(f"{BASE_URL}/config")
        
        if response.status_code == 200:
            data = response.json()
            enabled_fiat = data.get('enabled_fiat', [])
            enabled_crypto = data.get('enabled_crypto', [])
            
            # Verify 50 fiat + 31 crypto (including AUR)
            if len(enabled_fiat) == 50 and len(enabled_crypto) == 31:
                print_test("F2", "GET /api/config (50 fiat + 31 crypto)", True, f"✅ Fiat: {len(enabled_fiat)}, Crypto: {len(enabled_crypto)}")
                results["passed"] += 1
            else:
                print_test("F2", "GET /api/config", False, f"Expected 50 fiat + 31 crypto, got {len(enabled_fiat)} + {len(enabled_crypto)}")
                results["failed"] += 1
        else:
            print_test("F2", "GET /api/config", False, f"Status {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_test("F2", "GET /api/config", False, str(e))
        results["failed"] += 1
    
    # Test F3: Admin login
    try:
        print(f"\n[F3] Testing admin login")
        admin_token = admin_login()
        
        if admin_token:
            print_test("F3", "Admin login", True, "✅")
            results["passed"] += 1
        else:
            print_test("F3", "Admin login", False, "Failed to get token")
            results["failed"] += 1
    except Exception as e:
        print_test("F3", "Admin login", False, str(e))
        results["failed"] += 1
    
    # Test F4: Forgot password init
    try:
        print(f"\n[F4] Testing forgot password init")
        response = requests.post(f"{BASE_URL}/auth/forgot/init", json={
            "email": "nonexistent@test.com"
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print_test("F4", "Forgot password init", True, "✅")
                results["passed"] += 1
            else:
                print_test("F4", "Forgot password init", False, f"Response: {data}")
                results["failed"] += 1
        else:
            print_test("F4", "Forgot password init", False, f"Status {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_test("F4", "Forgot password init", False, str(e))
        results["failed"] += 1
    
    # Test F5: Change password endpoint (requires auth, so we'll just verify it exists)
    try:
        print(f"\n[F5] Testing change password endpoint (401 expected without auth)")
        response = requests.post(f"{BASE_URL}/profile/password", json={
            "current_password": "test",
            "new_password": "test123"
        })
        
        # Should return 401 without auth
        if response.status_code == 401:
            print_test("F5", "Change password endpoint exists", True, "✅ Returns 401 without auth")
            results["passed"] += 1
        else:
            print_test("F5", "Change password endpoint", False, f"Expected 401, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_test("F5", "Change password endpoint", False, str(e))
        results["failed"] += 1
    
    print(f"\n{'='*80}")
    print(f"SECTION F RESULTS: {results['passed']}/5 tests passed")
    print(f"{'='*80}")
    return results

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("AURELA BACKEND API TEST SUITE - NEW FEATURES")
    print("Testing NEW/CHANGED backend features from this session")
    print("="*80)
    
    all_results = {
        "A": test_section_a(),
        "B": test_section_b(),
        "C": test_section_c(),
        "D": test_section_d(),
        "E": test_section_e(),
        "F": test_section_f(),
    }
    
    # Calculate totals
    total_passed = sum(r["passed"] for r in all_results.values())
    total_failed = sum(r["failed"] for r in all_results.values())
    total_tests = total_passed + total_failed
    
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    for section, results in all_results.items():
        total = results["passed"] + results["failed"]
        print(f"Section {section}: {results['passed']}/{total} tests passed")
    
    print(f"\n{'='*80}")
    print(f"OVERALL: {total_passed}/{total_tests} tests passed ({total_passed*100//total_tests if total_tests > 0 else 0}%)")
    print(f"{'='*80}")
    
    return total_passed, total_failed

if __name__ == "__main__":
    passed, failed = main()
    exit(0 if failed == 0 else 1)
