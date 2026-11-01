#!/usr/bin/env python3
"""
Comprehensive backend test for Aurela withdrawal fee engine
Tests all fee-related endpoints and flows
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"
GEO_TESTER_EMAIL = "geo.tester@aurelatest.io"
GEO_TESTER_PASSWORD = "Aurela@123#"
GEO_TESTER_ID = "geo-tester-0001"

# Test results tracking
tests_passed = 0
tests_failed = 0
test_results = []

def log_test(test_name, passed, message=""):
    global tests_passed, tests_failed
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} - {test_name}"
    if message:
        result += f": {message}"
    print(result)
    test_results.append({"test": test_name, "passed": passed, "message": message})
    if passed:
        tests_passed += 1
    else:
        tests_failed += 1

def login(email, password):
    """Login and return token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": email,
            "password": password
        }, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        else:
            print(f"Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error for {email}: {e}")
        return None

def get_user_info(token):
    """Get user info"""
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers={
            "Authorization": f"Bearer {token}"
        }, timeout=10)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Get user info error: {e}")
        return None

def ensure_geo_tester_ready(admin_token, geo_token):
    """Ensure geo tester has sufficient balance and is not geo-held"""
    print("\n=== Ensuring geo tester is ready ===")
    
    # Check geo tester status
    user_info = get_user_info(geo_token)
    if not user_info:
        print("Failed to get geo tester info")
        return False
    
    user_id = user_info.get("user", {}).get("id")
    print(f"Geo tester ID: {user_id}")
    
    # Check if geo-held
    withdraw_lock = user_info.get("user", {}).get("withdraw_lock", {})
    if withdraw_lock.get("active"):
        print("Geo tester is geo-held, unlocking...")
        response = requests.post(f"{BASE_URL}/admin/users/{user_id}/withdraw_access", 
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"mode": "unlock"},
            timeout=10)
        if response.status_code == 200:
            print("✅ Unlocked geo tester")
        else:
            print(f"Failed to unlock: {response.status_code} - {response.text}")
    
    # Check USDT balance
    response = requests.get(f"{BASE_URL}/wallets", headers={
        "Authorization": f"Bearer {geo_token}"
    }, timeout=10)
    
    if response.status_code == 200:
        wallets = response.json().get("wallets", [])
        usdt_wallet = next((w for w in wallets if w["currency"] == "USDT"), None)
        usd_wallet = next((w for w in wallets if w["currency"] == "USD"), None)
        
        if usdt_wallet:
            print(f"USDT balance: {usdt_wallet.get('balance', 0)}")
            if usdt_wallet.get("balance", 0) < 1000:
                print("Topping up USDT wallet...")
                response = requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"currency": "USDT", "amount": 5000, "action": "credit", "note": "Test top-up"},
                    timeout=10)
                if response.status_code == 200:
                    print("✅ Topped up USDT wallet")
                else:
                    print(f"Failed to top up USDT: {response.status_code}")
        
        if usd_wallet:
            print(f"USD balance: {usd_wallet.get('balance', 0)}")
            if usd_wallet.get("balance", 0) < 3000000:
                print("Topping up USD wallet...")
                response = requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"currency": "USD", "amount": 5000000, "action": "credit", "note": "Test top-up"},
                    timeout=10)
                if response.status_code == 200:
                    print("✅ Topped up USD wallet")
                else:
                    print(f"Failed to top up USD: {response.status_code}")
    
    return True

def test_1_quote_scenarios(geo_token):
    """Test 1: Quote endpoint with various scenarios"""
    print("\n=== TEST 1: Quote Scenarios ===")
    
    # 1a: Standard tier (0-100k) - 1000 USDT ERC20
    response = requests.post(f"{BASE_URL}/withdraw/quote",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={"amount": 1000, "currency": "USDT", "network": "ERC20"},
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        quote = data.get("quote", {})
        breakdown = quote.get("breakdown", {})
        
        # Expected: 10% of 1000 = 100 + $5 rail = 105 fee, net 895
        expected_fee = 105
        expected_net = 895
        expected_tier = "Standard"
        expected_percent = 10
        
        passed = (
            abs(quote.get("fee", 0) - expected_fee) < 0.01 and
            abs(quote.get("net", 0) - expected_net) < 0.01 and
            abs(quote.get("fee_usd", 0) - expected_fee) < 0.01 and
            breakdown.get("tier_label") == expected_tier and
            breakdown.get("percent") == expected_percent and
            breakdown.get("rail") == "ERC20" and
            breakdown.get("rail_fee_usd") == 5 and
            abs(quote.get("gross_usd", 0) - 1000) < 0.01
        )
        log_test("1a: Quote 1000 USDT ERC20 (Standard tier)", passed,
                f"fee={quote.get('fee')}, net={quote.get('net')}, tier={breakdown.get('tier_label')}")
    else:
        log_test("1a: Quote 1000 USDT ERC20", False, f"Status {response.status_code}")
    
    # 1b: High value tier (100k-1M) - 250000 USDT TRC20
    response = requests.post(f"{BASE_URL}/withdraw/quote",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={"amount": 250000, "currency": "USDT", "network": "TRC20"},
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        quote = data.get("quote", {})
        breakdown = quote.get("breakdown", {})
        
        # Expected: 0.5% of 250000 = 1250 + $1 rail = 1251 fee, net 248749
        expected_fee = 1251
        expected_net = 248749
        expected_tier = "High value"
        expected_percent = 0.5
        
        passed = (
            abs(quote.get("fee", 0) - expected_fee) < 0.01 and
            abs(quote.get("net", 0) - expected_net) < 0.01 and
            breakdown.get("tier_label") == expected_tier and
            abs(breakdown.get("percent") - expected_percent) < 0.01
        )
        log_test("1b: Quote 250000 USDT TRC20 (High value tier)", passed,
                f"fee={quote.get('fee')}, net={quote.get('net')}, tier={breakdown.get('tier_label')}")
    else:
        log_test("1b: Quote 250000 USDT TRC20", False, f"Status {response.status_code}")
    
    # 1c: Institutional tier (≥1M) - 2000000 USD bank_swift
    response = requests.post(f"{BASE_URL}/withdraw/quote",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={"amount": 2000000, "currency": "USD", "method": "bank_swift"},
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        quote = data.get("quote", {})
        breakdown = quote.get("breakdown", {})
        
        # Expected: 0.15% of 2000000 = 3000 + $25 rail = 3025 fee, net 1996975
        expected_fee = 3025
        expected_net = 1996975
        expected_tier = "Institutional"
        expected_percent = 0.15
        
        passed = (
            abs(quote.get("fee", 0) - expected_fee) < 0.01 and
            abs(quote.get("net", 0) - expected_net) < 0.01 and
            breakdown.get("tier_label") == expected_tier and
            abs(breakdown.get("percent") - expected_percent) < 0.01 and
            breakdown.get("rail") == "bank_swift" and
            breakdown.get("rail_fee_usd") == 25
        )
        log_test("1c: Quote 2M USD bank_swift (Institutional tier)", passed,
                f"fee={quote.get('fee')}, net={quote.get('net')}, tier={breakdown.get('tier_label')}")
    else:
        log_test("1c: Quote 2M USD bank_swift", False, f"Status {response.status_code}")
    
    # 1d: Small amounts - min fee handling
    # 5 USDT TRC20: 10% of 5 = 0.5 + 1 = 1.5 fee, net 3.5
    response = requests.post(f"{BASE_URL}/withdraw/quote",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={"amount": 5, "currency": "USDT", "network": "TRC20"},
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        quote = data.get("quote", {})
        
        passed = (
            abs(quote.get("fee", 0) - 1.5) < 0.01 and
            abs(quote.get("net", 0) - 3.5) < 0.01
        )
        log_test("1d: Quote 5 USDT TRC20 (min fee not applied)", passed,
                f"fee={quote.get('fee')}, net={quote.get('net')}")
    else:
        log_test("1d: Quote 5 USDT TRC20", False, f"Status {response.status_code}")
    
    # 0.5 USDT BEP20: 10% of 0.5 = 0.05 + 0.3 = 0.35 < min 1 → fee capped to gross 0.5
    response = requests.post(f"{BASE_URL}/withdraw/quote",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={"amount": 0.5, "currency": "USDT", "network": "BEP20"},
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        quote = data.get("quote", {})
        breakdown = quote.get("breakdown", {})
        
        # Fee should be capped to gross amount (0.5)
        passed = (
            abs(quote.get("fee", 0) - 0.5) < 0.01 and
            abs(quote.get("net", 0) - 0) < 0.01 and
            breakdown.get("min_applied") == True
        )
        log_test("1d: Quote 0.5 USDT BEP20 (fee capped to gross)", passed,
                f"fee={quote.get('fee')}, net={quote.get('net')}, min_applied={breakdown.get('min_applied')}")
    else:
        log_test("1d: Quote 0.5 USDT BEP20", False, f"Status {response.status_code}")
    
    # 1e: Fiat methods
    # 100 USD UPI: 10% + $0 rail = 10 fee, net 90
    response = requests.post(f"{BASE_URL}/withdraw/quote",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={"amount": 100, "currency": "USD", "method": "upi"},
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        quote = data.get("quote", {})
        
        passed = (
            abs(quote.get("fee", 0) - 10) < 0.01 and
            abs(quote.get("net", 0) - 90) < 0.01
        )
        log_test("1e: Quote 100 USD UPI", passed,
                f"fee={quote.get('fee')}, net={quote.get('net')}")
    else:
        log_test("1e: Quote 100 USD UPI", False, f"Status {response.status_code}")
    
    # 1f: Unsupported currency
    response = requests.post(f"{BASE_URL}/withdraw/quote",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={"amount": 100, "currency": "XYZ", "network": "ERC20"},
        timeout=10)
    
    passed = response.status_code == 400
    log_test("1f: Quote unsupported currency XYZ", passed, f"Status {response.status_code}")
    
    # 1g: Unauthenticated
    response = requests.post(f"{BASE_URL}/withdraw/quote",
        json={"amount": 100, "currency": "USDT", "network": "ERC20"},
        timeout=10)
    
    passed = response.status_code == 401
    log_test("1g: Quote unauthenticated", passed, f"Status {response.status_code}")

def test_2_config_endpoint(geo_token):
    """Test 2: GET /api/config includes withdraw_fees"""
    print("\n=== TEST 2: Config Endpoint ===")
    
    response = requests.get(f"{BASE_URL}/config", timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        withdraw_fees = data.get("withdraw_fees", {})
        
        passed = (
            "enabled" in withdraw_fees and
            "tiers" in withdraw_fees and
            len(withdraw_fees.get("tiers", [])) == 3 and
            "min_fee_usd" in withdraw_fees and
            withdraw_fees.get("min_fee_usd") == 1 and
            "max_fee_usd" in withdraw_fees and
            withdraw_fees.get("max_fee_usd") is None
        )
        log_test("2: Config endpoint includes withdraw_fees", passed,
                f"enabled={withdraw_fees.get('enabled')}, tiers={len(withdraw_fees.get('tiers', []))}")
    else:
        log_test("2: Config endpoint", False, f"Status {response.status_code}")

def test_3_withdraw_with_fee(admin_token, geo_token):
    """Test 3: Withdraw request with fee deduction"""
    print("\n=== TEST 3: Withdraw Request with Fee ===")
    
    # Get initial wallet balance
    response = requests.get(f"{BASE_URL}/wallets", headers={
        "Authorization": f"Bearer {geo_token}"
    }, timeout=10)
    
    if response.status_code != 200:
        log_test("3: Get initial wallet balance", False, f"Status {response.status_code}")
        return None
    
    wallets = response.json().get("wallets", [])
    usdt_wallet = next((w for w in wallets if w["currency"] == "USDT"), None)
    
    if not usdt_wallet:
        log_test("3: Find USDT wallet", False, "USDT wallet not found")
        return None
    
    initial_balance = usdt_wallet.get("balance", 0)
    initial_locked = usdt_wallet.get("locked", 0)
    print(f"Initial USDT balance: {initial_balance}, locked: {initial_locked}")
    
    # Submit withdrawal request
    response = requests.post(f"{BASE_URL}/withdraw",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={
            "method": "crypto",
            "currency": "USDT",
            "amount": 1000,
            "destination": "0xabc123def456789",
            "network": "ERC20"
        },
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        request_data = data.get("request", {})
        quote = data.get("quote", {})
        message = data.get("message", "")
        
        # Expected: amount 1000, fee 105, net 895
        passed = (
            request_data.get("amount") == 1000 and
            abs(request_data.get("fee", 0) - 105) < 0.01 and
            abs(request_data.get("net_amount", 0) - 895) < 0.01 and
            abs(request_data.get("fee_usd", 0) - 105) < 0.01 and
            "fee_breakdown" in request_data and
            "895 USDT" in message
        )
        
        if passed:
            request_id = request_data.get("id")
            log_test("3: Withdraw request created", True,
                    f"id={request_id}, fee={request_data.get('fee')}, net={request_data.get('net_amount')}")
            
            # Check wallet balance updated
            response = requests.get(f"{BASE_URL}/wallets", headers={
                "Authorization": f"Bearer {geo_token}"
            }, timeout=10)
            
            if response.status_code == 200:
                wallets = response.json().get("wallets", [])
                usdt_wallet = next((w for w in wallets if w["currency"] == "USDT"), None)
                
                new_balance = usdt_wallet.get("balance", 0)
                new_locked = usdt_wallet.get("locked", 0)
                
                # Balance should decrease by 1000, locked should increase by 1000
                balance_decreased = abs((initial_balance - new_balance) - 1000) < 0.01
                locked_increased = abs((new_locked - initial_locked) - 1000) < 0.01
                
                log_test("3: Wallet balance decreased by gross amount", balance_decreased,
                        f"balance: {initial_balance} → {new_balance}")
                log_test("3: Wallet locked increased by gross amount", locked_increased,
                        f"locked: {initial_locked} → {new_locked}")
            
            return request_id
        else:
            log_test("3: Withdraw request validation", False,
                    f"amount={request_data.get('amount')}, fee={request_data.get('fee')}")
            return None
    else:
        log_test("3: Withdraw request", False, f"Status {response.status_code} - {response.text}")
        return None
    
    # Test tiny amount that would be consumed by fee
    response = requests.post(f"{BASE_URL}/withdraw",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={
            "method": "crypto",
            "currency": "USDT",
            "amount": 0.5,
            "destination": "0x1",
            "network": "BEP20"
        },
        timeout=10)
    
    if response.status_code == 400:
        data = response.json()
        passed = data.get("code") == "FEE_EXCEEDS_AMOUNT"
        log_test("3: Tiny amount rejected (fee exceeds amount)", passed,
                f"code={data.get('code')}")
    else:
        log_test("3: Tiny amount rejection", False, f"Status {response.status_code}")

def test_4_admin_approve_with_treasury(admin_token, geo_token, request_id):
    """Test 4: Admin approve withdrawal with treasury ledger"""
    print("\n=== TEST 4: Admin Approve with Treasury ===")
    
    if not request_id:
        print("Skipping test 4 - no request_id from test 3")
        return
    
    # Approve the withdrawal
    response = requests.post(f"{BASE_URL}/admin/withdrawals/{request_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
        timeout=10)
    
    if response.status_code == 200:
        log_test("4: Admin approve withdrawal", True, f"request_id={request_id}")
        
        # Check withdrawal status
        response = requests.get(f"{BASE_URL}/admin/withdrawals/{request_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            request_data = data.get("request", {})
            
            passed = (
                request_data.get("status") == "approved" and
                request_data.get("fee_collected") == True
            )
            log_test("4: Withdrawal status approved with fee_collected", passed,
                    f"status={request_data.get('status')}, fee_collected={request_data.get('fee_collected')}")
        
        # Check transaction created
        response = requests.get(f"{BASE_URL}/transactions",
            headers={"Authorization": f"Bearer {geo_token}"},
            timeout=10)
        
        if response.status_code == 200:
            transactions = response.json().get("transactions", [])
            withdraw_tx = next((t for t in transactions if t.get("withdraw_request_id") == request_id), None)
            
            if withdraw_tx:
                passed = (
                    withdraw_tx.get("type") == "withdraw" and
                    withdraw_tx.get("amount") == 1000 and
                    abs(withdraw_tx.get("fee", 0) - 105) < 0.01 and
                    abs(withdraw_tx.get("net_amount", 0) - 895) < 0.01
                )
                log_test("4: Transaction record created", passed,
                        f"amount={withdraw_tx.get('amount')}, fee={withdraw_tx.get('fee')}, net={withdraw_tx.get('net_amount')}")
            else:
                log_test("4: Transaction record", False, "Transaction not found")
        
        # Check treasury ledger (via MongoDB or admin endpoint)
        # We'll check via the fee report endpoint
        time.sleep(1)  # Give it a moment to process
        
        response = requests.get(f"{BASE_URL}/admin/fees/report?days=1",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            recent = data.get("recent", [])
            
            # Find the treasury entry for this request
            treasury_entry = next((e for e in recent if e.get("source_id") == request_id), None)
            
            if treasury_entry:
                passed = (
                    treasury_entry.get("type") == "withdraw_fee" and
                    abs(treasury_entry.get("amount", 0) - 105) < 0.01 and
                    abs(treasury_entry.get("amount_usd", 0) - 105) < 0.01 and
                    treasury_entry.get("currency") == "USDT" and
                    treasury_entry.get("gross_amount") == 1000 and
                    abs(treasury_entry.get("net_amount", 0) - 895) < 0.01 and
                    treasury_entry.get("user_id") == GEO_TESTER_ID
                )
                log_test("4: Treasury ledger entry created", passed,
                        f"amount={treasury_entry.get('amount')}, amount_usd={treasury_entry.get('amount_usd')}")
            else:
                log_test("4: Treasury ledger entry", False, "Entry not found in recent")
        
        # Check wallet locked decreased
        response = requests.get(f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {geo_token}"},
            timeout=10)
        
        if response.status_code == 200:
            wallets = response.json().get("wallets", [])
            usdt_wallet = next((w for w in wallets if w["currency"] == "USDT"), None)
            
            # Locked should have decreased by 1000
            print(f"After approval - locked: {usdt_wallet.get('locked', 0)}")
        
        # Check user notification
        response = requests.get(f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {geo_token}"},
            timeout=10)
        
        if response.status_code == 200:
            notifications = response.json().get("notifications", [])
            withdraw_notif = next((n for n in notifications if n.get("kind") == "withdraw_approved"), None)
            
            if withdraw_notif:
                body = withdraw_notif.get("body", "")
                passed = "895 USDT" in body and "105 USDT" in body
                log_test("4: User notification mentions net and fee", passed,
                        f"body contains '895 USDT' and '105 USDT'")
            else:
                log_test("4: User notification", False, "Notification not found")
        
        # Try to approve again (should fail)
        response = requests.post(f"{BASE_URL}/admin/withdrawals/{request_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={},
            timeout=10)
        
        passed = response.status_code == 400 and "already" in response.text.lower()
        log_test("4: Approve again rejected", passed, f"Status {response.status_code}")
        
    else:
        log_test("4: Admin approve", False, f"Status {response.status_code} - {response.text}")

def test_5_reject_refunds_gross(admin_token, geo_token):
    """Test 5: Reject path refunds gross amount"""
    print("\n=== TEST 5: Reject Path Refunds Gross ===")
    
    # Get initial balance
    response = requests.get(f"{BASE_URL}/wallets",
        headers={"Authorization": f"Bearer {geo_token}"},
        timeout=10)
    
    if response.status_code != 200:
        log_test("5: Get initial balance", False, f"Status {response.status_code}")
        return
    
    wallets = response.json().get("wallets", [])
    usdt_wallet = next((w for w in wallets if w["currency"] == "USDT"), None)
    initial_balance = usdt_wallet.get("balance", 0)
    initial_locked = usdt_wallet.get("locked", 0)
    
    # Create withdrawal request
    response = requests.post(f"{BASE_URL}/withdraw",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={
            "method": "crypto",
            "currency": "USDT",
            "amount": 200,
            "destination": "0xtest",
            "network": "TRC20"
        },
        timeout=10)
    
    if response.status_code != 200:
        log_test("5: Create withdrawal W2", False, f"Status {response.status_code}")
        return
    
    request_id = response.json().get("request", {}).get("id")
    log_test("5: Create withdrawal W2", True, f"request_id={request_id}")
    
    # Reject the withdrawal
    response = requests.post(f"{BASE_URL}/admin/withdrawals/{request_id}/reject",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
        timeout=10)
    
    if response.status_code == 200:
        log_test("5: Admin reject withdrawal", True, f"request_id={request_id}")
        
        # Check wallet balance restored
        response = requests.get(f"{BASE_URL}/wallets",
            headers={"Authorization": f"Bearer {geo_token}"},
            timeout=10)
        
        if response.status_code == 200:
            wallets = response.json().get("wallets", [])
            usdt_wallet = next((w for w in wallets if w["currency"] == "USDT"), None)
            
            new_balance = usdt_wallet.get("balance", 0)
            new_locked = usdt_wallet.get("locked", 0)
            
            # Balance should be back to initial (200 refunded)
            balance_restored = abs(new_balance - initial_balance) < 0.01
            locked_decreased = abs((initial_locked - new_locked) - 200) < 0.01
            
            log_test("5: Balance restored after rejection", balance_restored,
                    f"balance: {initial_balance} → {new_balance}")
            log_test("5: Locked decreased after rejection", locked_decreased,
                    f"locked: {initial_locked} → {new_locked}")
        
        # Check NO treasury ledger entry for rejected withdrawal
        response = requests.get(f"{BASE_URL}/admin/fees/report?days=1",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            recent = data.get("recent", [])
            
            # Should NOT find treasury entry for this request
            treasury_entry = next((e for e in recent if e.get("source_id") == request_id), None)
            
            passed = treasury_entry is None
            log_test("5: NO treasury ledger entry for rejected withdrawal", passed,
                    f"Entry {'not found' if passed else 'found'}")
    else:
        log_test("5: Admin reject", False, f"Status {response.status_code}")

def test_6_admin_schedule_get(admin_token):
    """Test 6: GET /api/admin/fees/schedule"""
    print("\n=== TEST 6: Admin Fee Schedule GET ===")
    
    response = requests.get(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        schedule = data.get("schedule", {})
        defaults = data.get("defaults", {})
        rail_keys = data.get("rail_keys", {})
        
        passed = (
            "enabled" in schedule and
            "tiers" in schedule and
            len(schedule.get("tiers", [])) == 3 and
            "min_fee_usd" in schedule and
            "max_fee_usd" in schedule and
            "rails" in schedule and
            "ERC20" in schedule.get("rails", {}) and
            schedule.get("rails", {}).get("ERC20") == 5 and
            "bank_swift" in schedule.get("rails", {}) and
            schedule.get("rails", {}).get("bank_swift") == 25 and
            "currencies" in schedule and
            "defaults" in data and
            "rail_keys" in data and
            "crypto" in rail_keys and
            "fiat" in rail_keys
        )
        log_test("6: Admin schedule GET returns correct structure", passed,
                f"tiers={len(schedule.get('tiers', []))}, rails={len(schedule.get('rails', {}))}")
        
        # Store defaults for later restoration
        return data
    else:
        log_test("6: Admin schedule GET", False, f"Status {response.status_code}")
        return None

def test_7_admin_schedule_put_validations(admin_token):
    """Test 7: PUT /api/admin/fees/schedule validations"""
    print("\n=== TEST 7: Admin Fee Schedule PUT Validations ===")
    
    # Test: tiers first min_usd ≠ 0
    response = requests.put(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "tiers": [
                {"min_usd": 100, "max_usd": 100000, "percent": 10, "label": "A"}
            ]
        },
        timeout=10)
    
    passed = response.status_code == 400 and "first tier" in response.text.lower()
    log_test("7a: Validation - first tier must start at $0", passed, f"Status {response.status_code}")
    
    # Test: tiers with gap
    response = requests.put(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "tiers": [
                {"min_usd": 0, "max_usd": 100000, "percent": 10, "label": "A"},
                {"min_usd": 200000, "max_usd": None, "percent": 1, "label": "B"}
            ]
        },
        timeout=10)
    
    passed = response.status_code == 400 and ("gap" in response.text.lower() or "must start where" in response.text.lower())
    log_test("7b: Validation - tiers cannot have gaps", passed, f"Status {response.status_code}")
    
    # Test: non-last tier with max_usd null
    response = requests.put(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "tiers": [
                {"min_usd": 0, "max_usd": None, "percent": 10, "label": "A"},
                {"min_usd": 100000, "max_usd": None, "percent": 1, "label": "B"}
            ]
        },
        timeout=10)
    
    passed = response.status_code == 400 and ("last tier" in response.text.lower() or "open-ended" in response.text.lower())
    log_test("7c: Validation - only last tier can be open-ended", passed, f"Status {response.status_code}")
    
    # Test: max_fee_usd < min_fee_usd
    response = requests.put(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "min_fee_usd": 1,
            "max_fee_usd": 0.5
        },
        timeout=10)
    
    passed = response.status_code == 400 and ("maximum" in response.text.lower() and "minimum" in response.text.lower())
    log_test("7d: Validation - max_fee_usd cannot be less than min_fee_usd", passed, f"Status {response.status_code}")
    
    # Test: negative rail fee
    response = requests.put(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "rails": {"ERC20": -1}
        },
        timeout=10)
    
    passed = response.status_code == 400
    log_test("7e: Validation - rail fee cannot be negative", passed, f"Status {response.status_code}")
    
    # Test: invalid currency override
    response = requests.put(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "currencies": {"XYZ": {"enabled": False}}
        },
        timeout=10)
    
    passed = response.status_code == 400 and "unknown currency" in response.text.lower()
    log_test("7f: Validation - unknown currency rejected", passed, f"Status {response.status_code}")

def test_8_admin_schedule_put_valid(admin_token, geo_token):
    """Test 8: PUT /api/admin/fees/schedule with valid data"""
    print("\n=== TEST 8: Admin Fee Schedule PUT Valid ===")
    
    # Update schedule with custom tiers
    response = requests.put(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "tiers": [
                {"min_usd": 0, "max_usd": 50000, "percent": 8, "label": "A"},
                {"min_usd": 50000, "max_usd": None, "percent": 1, "label": "B"}
            ],
            "min_fee_usd": 2,
            "rails": {"ERC20": 7},
            "currencies": {
                "USDC": {"enabled": False},
                "BTC": {"min_fee_usd": 20}
            }
        },
        timeout=10)
    
    if response.status_code == 200:
        log_test("8a: Update schedule with custom tiers", True)
        
        # Verify schedule updated
        response = requests.get(f"{BASE_URL}/admin/fees/schedule",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10)
        
        if response.status_code == 200:
            schedule = response.json().get("schedule", {})
            
            passed = (
                len(schedule.get("tiers", [])) == 2 and
                schedule.get("min_fee_usd") == 2 and
                schedule.get("rails", {}).get("ERC20") == 7 and
                "USDC" in schedule.get("currencies", {}) and
                schedule.get("currencies", {}).get("USDC", {}).get("enabled") == False and
                "BTC" in schedule.get("currencies", {}) and
                schedule.get("currencies", {}).get("BTC", {}).get("min_fee_usd") == 20
            )
            log_test("8b: Schedule reflects updates", passed)
        
        # Test quote with new schedule
        # 1000 USDT ERC20: 8% + 7 = 87 fee, net 913
        response = requests.post(f"{BASE_URL}/withdraw/quote",
            headers={"Authorization": f"Bearer {geo_token}"},
            json={"amount": 1000, "currency": "USDT", "network": "ERC20"},
            timeout=10)
        
        if response.status_code == 200:
            quote = response.json().get("quote", {})
            
            passed = (
                abs(quote.get("fee", 0) - 87) < 0.01 and
                abs(quote.get("net", 0) - 913) < 0.01
            )
            log_test("8c: Quote uses new schedule (1000 USDT ERC20)", passed,
                    f"fee={quote.get('fee')}, net={quote.get('net')}")
        
        # Test USDC waived
        response = requests.post(f"{BASE_URL}/withdraw/quote",
            headers={"Authorization": f"Bearer {geo_token}"},
            json={"amount": 1000, "currency": "USDC", "network": "ERC20"},
            timeout=10)
        
        if response.status_code == 200:
            quote = response.json().get("quote", {})
            breakdown = quote.get("breakdown", {})
            
            passed = (
                quote.get("fee", 0) == 0 and
                quote.get("net", 0) == 1000 and
                breakdown.get("waived") == True
            )
            log_test("8d: Quote USDC waived (currency disabled)", passed,
                    f"fee={quote.get('fee')}, waived={breakdown.get('waived')}")
        
        # Test BTC min override
        response = requests.post(f"{BASE_URL}/withdraw/quote",
            headers={"Authorization": f"Bearer {geo_token}"},
            json={"amount": 0.001, "currency": "BTC", "network": "Bitcoin"},
            timeout=10)
        
        if response.status_code == 200:
            quote = response.json().get("quote", {})
            
            # Min fee should be $20 in BTC
            passed = quote.get("fee_usd", 0) >= 19.5  # Allow some rounding
            log_test("8e: Quote BTC uses min_fee_usd override", passed,
                    f"fee_usd={quote.get('fee_usd')}")
    else:
        log_test("8a: Update schedule", False, f"Status {response.status_code}")

def test_9_restore_defaults(admin_token, geo_token, original_schedule):
    """Test 9: Restore default fee schedule"""
    print("\n=== TEST 9: Restore Default Schedule ===")
    
    if not original_schedule:
        print("Skipping test 9 - no original schedule")
        return
    
    defaults = original_schedule.get("defaults", {})
    
    # Restore defaults
    response = requests.put(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "tiers": defaults.get("tiers", []),
            "min_fee_usd": defaults.get("min_fee_usd", 1),
            "max_fee_usd": None,
            "rails": defaults.get("rails", {}),
            "currencies": {}
        },
        timeout=10)
    
    if response.status_code == 200:
        log_test("9a: Restore default schedule", True)
        
        # Verify quote back to original
        response = requests.post(f"{BASE_URL}/withdraw/quote",
            headers={"Authorization": f"Bearer {geo_token}"},
            json={"amount": 1000, "currency": "USDT", "network": "ERC20"},
            timeout=10)
        
        if response.status_code == 200:
            quote = response.json().get("quote", {})
            
            passed = (
                abs(quote.get("fee", 0) - 105) < 0.01 and
                abs(quote.get("net", 0) - 895) < 0.01
            )
            log_test("9b: Quote back to original (1000 USDT ERC20)", passed,
                    f"fee={quote.get('fee')}, net={quote.get('net')}")
    else:
        log_test("9a: Restore defaults", False, f"Status {response.status_code}")

def test_10_admin_preview(admin_token):
    """Test 10: POST /api/admin/fees/preview"""
    print("\n=== TEST 10: Admin Fee Preview ===")
    
    response = requests.post(f"{BASE_URL}/admin/fees/preview",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "amount": 1000,
            "currency": "USDT",
            "network": "ERC20",
            "schedule": {
                "tiers": [
                    {"min_usd": 0, "max_usd": None, "percent": 2, "label": "Test"}
                ],
                "min_fee_usd": 0,
                "rails": {"ERC20": 0}
            }
        },
        timeout=10)
    
    if response.status_code == 200:
        quote = response.json().get("quote", {})
        
        # Expected: 2% of 1000 = 20 fee, net 980
        passed = (
            abs(quote.get("fee", 0) - 20) < 0.01 and
            abs(quote.get("net", 0) - 980) < 0.01
        )
        log_test("10a: Preview with custom schedule", passed,
                f"fee={quote.get('fee')}, net={quote.get('net')}")
        
        # Verify schedule not persisted
        response = requests.get(f"{BASE_URL}/admin/fees/schedule",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10)
        
        if response.status_code == 200:
            schedule = response.json().get("schedule", {})
            
            # Should still have 3 tiers (not 1)
            passed = len(schedule.get("tiers", [])) == 3
            log_test("10b: Preview does not persist schedule", passed,
                    f"tiers={len(schedule.get('tiers', []))}")
    else:
        log_test("10a: Preview endpoint", False, f"Status {response.status_code}")

def test_11_admin_report(admin_token):
    """Test 11: GET /api/admin/fees/report"""
    print("\n=== TEST 11: Admin Fee Report ===")
    
    response = requests.get(f"{BASE_URL}/admin/fees/report?days=30",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        
        passed = (
            "days" in data and
            data.get("days") == 30 and
            "all_time" in data and
            "usd" in data.get("all_time", {}) and
            "count" in data.get("all_time", {}) and
            data.get("all_time", {}).get("usd", 0) >= 105 and  # At least one fee collected
            data.get("all_time", {}).get("count", 0) >= 1 and
            "range" in data and
            "pending" in data and
            "by_currency" in data and
            "by_day" in data and
            "recent" in data
        )
        log_test("11a: Report returns correct structure", passed,
                f"all_time_usd={data.get('all_time', {}).get('usd')}, count={data.get('all_time', {}).get('count')}")
        
        # Check by_currency includes USDT
        by_currency = data.get("by_currency", [])
        usdt_entry = next((c for c in by_currency if c.get("currency") == "USDT"), None)
        
        if usdt_entry:
            passed = (
                usdt_entry.get("amount", 0) >= 105 and
                usdt_entry.get("usd", 0) >= 105 and
                usdt_entry.get("count", 0) >= 1
            )
            log_test("11b: Report includes USDT fees", passed,
                    f"amount={usdt_entry.get('amount')}, usd={usdt_entry.get('usd')}")
        
        # Check recent entries have user object
        recent = data.get("recent", [])
        if recent:
            first_entry = recent[0]
            passed = "user" in first_entry and "password_hash" not in first_entry.get("user", {})
            log_test("11c: Recent entries include user (no password)", passed)
    else:
        log_test("11a: Report endpoint", False, f"Status {response.status_code}")
    
    # Test days clamping
    response = requests.get(f"{BASE_URL}/admin/fees/report?days=9999",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        passed = data.get("days") == 365
        log_test("11d: Report days clamped to 365", passed, f"days={data.get('days')}")
    else:
        log_test("11d: Report days clamping", False, f"Status {response.status_code}")

def test_12_auth_checks(admin_token, geo_token):
    """Test 12: Auth checks for fee endpoints"""
    print("\n=== TEST 12: Auth Checks ===")
    
    # Non-admin access to /admin/fees/schedule
    response = requests.get(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {geo_token}"},
        timeout=10)
    
    passed = response.status_code == 403
    log_test("12a: Non-admin GET /admin/fees/schedule → 403", passed, f"Status {response.status_code}")
    
    # Unauthenticated access
    response = requests.get(f"{BASE_URL}/admin/fees/schedule", timeout=10)
    
    passed = response.status_code == 401
    log_test("12b: Unauth GET /admin/fees/schedule → 401", passed, f"Status {response.status_code}")
    
    # Non-admin PUT
    response = requests.put(f"{BASE_URL}/admin/fees/schedule",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={"min_fee_usd": 5},
        timeout=10)
    
    passed = response.status_code == 403
    log_test("12c: Non-admin PUT /admin/fees/schedule → 403", passed, f"Status {response.status_code}")
    
    # Non-admin preview
    response = requests.post(f"{BASE_URL}/admin/fees/preview",
        headers={"Authorization": f"Bearer {geo_token}"},
        json={"amount": 100, "currency": "USDT"},
        timeout=10)
    
    passed = response.status_code == 403
    log_test("12d: Non-admin POST /admin/fees/preview → 403", passed, f"Status {response.status_code}")
    
    # Non-admin report
    response = requests.get(f"{BASE_URL}/admin/fees/report",
        headers={"Authorization": f"Bearer {geo_token}"},
        timeout=10)
    
    passed = response.status_code == 403
    log_test("12e: Non-admin GET /admin/fees/report → 403", passed, f"Status {response.status_code}")

def test_13_regression(admin_token, geo_token):
    """Test 13: Regression tests"""
    print("\n=== TEST 13: Regression Tests ===")
    
    # GET /api/admin/withdrawals
    response = requests.get(f"{BASE_URL}/admin/withdrawals",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10)
    
    passed = response.status_code == 200
    if passed:
        data = response.json()
        withdrawals = data.get("withdrawals", [])
        if withdrawals:
            # Check if fee/net_amount fields are present
            first = withdrawals[0]
            has_fee_fields = "fee" in first and "net_amount" in first
            log_test("13a: GET /admin/withdrawals includes fee fields", has_fee_fields)
    log_test("13a: GET /admin/withdrawals → 200", passed, f"Status {response.status_code}")
    
    # GET /api/version
    response = requests.get(f"{BASE_URL}/version", timeout=10)
    
    passed = response.status_code == 200
    log_test("13b: GET /api/version → 200", passed, f"Status {response.status_code}")
    
    # GET /api/admin/zones
    response = requests.get(f"{BASE_URL}/admin/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10)
    
    passed = response.status_code == 200
    log_test("13c: GET /api/admin/zones → 200", passed, f"Status {response.status_code}")
    
    # Deposits flow untouched
    response = requests.get(f"{BASE_URL}/admin/deposits",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10)
    
    passed = response.status_code == 200
    log_test("13d: GET /api/admin/deposits → 200", passed, f"Status {response.status_code}")

def main():
    print("=" * 80)
    print("AURELA WITHDRAWAL FEE ENGINE - COMPREHENSIVE BACKEND TEST")
    print("=" * 80)
    
    # Login
    print("\n=== Logging in ===")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print("❌ Failed to login as admin")
        sys.exit(1)
    print(f"✅ Admin logged in")
    
    geo_token = login(GEO_TESTER_EMAIL, GEO_TESTER_PASSWORD)
    if not geo_token:
        print("❌ Failed to login as geo tester")
        sys.exit(1)
    print(f"✅ Geo tester logged in")
    
    # Ensure geo tester is ready
    if not ensure_geo_tester_ready(admin_token, geo_token):
        print("❌ Failed to prepare geo tester")
        sys.exit(1)
    
    # Run tests
    test_1_quote_scenarios(geo_token)
    test_2_config_endpoint(geo_token)
    request_id = test_3_withdraw_with_fee(admin_token, geo_token)
    test_4_admin_approve_with_treasury(admin_token, geo_token, request_id)
    test_5_reject_refunds_gross(admin_token, geo_token)
    original_schedule = test_6_admin_schedule_get(admin_token)
    test_7_admin_schedule_put_validations(admin_token)
    test_8_admin_schedule_put_valid(admin_token, geo_token)
    test_9_restore_defaults(admin_token, geo_token, original_schedule)
    test_10_admin_preview(admin_token)
    test_11_admin_report(admin_token)
    test_12_auth_checks(admin_token, geo_token)
    test_13_regression(admin_token, geo_token)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total tests: {tests_passed + tests_failed}")
    print(f"✅ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    print(f"Success rate: {tests_passed / (tests_passed + tests_failed) * 100:.1f}%")
    
    if tests_failed > 0:
        print("\n❌ FAILED TESTS:")
        for result in test_results:
            if not result["passed"]:
                print(f"  - {result['test']}: {result['message']}")
    
    print("=" * 80)
    
    return 0 if tests_failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
