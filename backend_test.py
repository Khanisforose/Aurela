#!/usr/bin/env python3
"""
Backend API test for Aurela - Live Crypto Ticker Test
Tests that all crypto prices tick live (not just AUR)
"""

import requests
import time
import json
from typing import Dict, Any

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"

def test_live_crypto_ticker():
    """
    Test 1 — All cryptos have live movement
    Verify BTC, ETH, SOL, DOGE prices change between calls
    USDT and USDC stay at exactly 1
    AUR is still moving (independent simulator)
    """
    print("\n" + "="*80)
    print("TEST 1: ALL CRYPTOS HAVE LIVE MOVEMENT")
    print("="*80)
    
    try:
        # First call
        print("\n[1] First GET /api/rates call...")
        resp1 = requests.get(f"{BASE_URL}/rates", timeout=10)
        print(f"Status: {resp1.status_code}")
        assert resp1.status_code == 200, f"Expected 200, got {resp1.status_code}"
        data1 = resp1.json()
        
        # Extract prices
        crypto1 = data1.get('crypto_usd', {})
        btc1 = crypto1.get('BTC')
        eth1 = crypto1.get('ETH')
        sol1 = crypto1.get('SOL')
        doge1 = crypto1.get('DOGE')
        usdt1 = crypto1.get('USDT')
        usdc1 = crypto1.get('USDC')
        aur1 = crypto1.get('AUR')
        
        print(f"BTC: ${btc1:,.2f}")
        print(f"ETH: ${eth1:,.2f}")
        print(f"SOL: ${sol1:,.2f}")
        print(f"DOGE: ${doge1:.6f}")
        print(f"USDT: ${usdt1:.6f}")
        print(f"USDC: ${usdc1:.6f}")
        print(f"AUR: ${aur1:.6f}")
        
        # Wait 3 seconds
        print("\n[2] Waiting 3 seconds...")
        time.sleep(3)
        
        # Second call
        print("\n[3] Second GET /api/rates call...")
        resp2 = requests.get(f"{BASE_URL}/rates", timeout=10)
        print(f"Status: {resp2.status_code}")
        assert resp2.status_code == 200, f"Expected 200, got {resp2.status_code}"
        data2 = resp2.json()
        
        crypto2 = data2.get('crypto_usd', {})
        btc2 = crypto2.get('BTC')
        eth2 = crypto2.get('ETH')
        sol2 = crypto2.get('SOL')
        doge2 = crypto2.get('DOGE')
        usdt2 = crypto2.get('USDT')
        usdc2 = crypto2.get('USDC')
        aur2 = crypto2.get('AUR')
        
        print(f"BTC: ${btc2:,.2f} (change: {((btc2-btc1)/btc1*100):+.4f}%)")
        print(f"ETH: ${eth2:,.2f} (change: {((eth2-eth1)/eth1*100):+.4f}%)")
        print(f"SOL: ${sol2:,.2f} (change: {((sol2-sol1)/sol1*100):+.4f}%)")
        print(f"DOGE: ${doge2:.6f} (change: {((doge2-doge1)/doge1*100):+.4f}%)")
        print(f"USDT: ${usdt2:.6f}")
        print(f"USDC: ${usdc2:.6f}")
        print(f"AUR: ${aur2:.6f} (change: {((aur2-aur1)/aur1*100):+.4f}%)")
        
        # Wait 3 seconds
        print("\n[4] Waiting 3 seconds...")
        time.sleep(3)
        
        # Third call
        print("\n[5] Third GET /api/rates call...")
        resp3 = requests.get(f"{BASE_URL}/rates", timeout=10)
        print(f"Status: {resp3.status_code}")
        assert resp3.status_code == 200, f"Expected 200, got {resp3.status_code}"
        data3 = resp3.json()
        
        crypto3 = data3.get('crypto_usd', {})
        btc3 = crypto3.get('BTC')
        eth3 = crypto3.get('ETH')
        sol3 = crypto3.get('SOL')
        doge3 = crypto3.get('DOGE')
        usdt3 = crypto3.get('USDT')
        usdc3 = crypto3.get('USDC')
        aur3 = crypto3.get('AUR')
        
        print(f"BTC: ${btc3:,.2f} (change: {((btc3-btc1)/btc1*100):+.4f}%)")
        print(f"ETH: ${eth3:,.2f} (change: {((eth3-eth1)/eth1*100):+.4f}%)")
        print(f"SOL: ${sol3:,.2f} (change: {((sol3-sol1)/sol1*100):+.4f}%)")
        print(f"DOGE: ${doge3:.6f} (change: {((doge3-doge1)/doge1*100):+.4f}%)")
        print(f"USDT: ${usdt3:.6f}")
        print(f"USDC: ${usdc3:.6f}")
        print(f"AUR: ${aur3:.6f} (change: {((aur3-aur1)/aur1*100):+.4f}%)")
        
        # Verify changes
        print("\n[6] Verifying price movements...")
        
        # BTC, ETH, SOL, DOGE should have changed
        btc_changed = (btc1 != btc2) or (btc2 != btc3)
        eth_changed = (eth1 != eth2) or (eth2 != eth3)
        sol_changed = (sol1 != sol2) or (sol2 != sol3)
        doge_changed = (doge1 != doge2) or (doge2 != doge3)
        aur_changed = (aur1 != aur2) or (aur2 != aur3)
        
        print(f"✓ BTC changed: {btc_changed} (expected: True)")
        print(f"✓ ETH changed: {eth_changed} (expected: True)")
        print(f"✓ SOL changed: {sol_changed} (expected: True)")
        print(f"✓ DOGE changed: {doge_changed} (expected: True)")
        print(f"✓ AUR changed: {aur_changed} (expected: True)")
        
        assert btc_changed, "BTC price should change between calls"
        assert eth_changed, "ETH price should change between calls"
        assert sol_changed, "SOL price should change between calls"
        assert doge_changed, "DOGE price should change between calls"
        assert aur_changed, "AUR price should change between calls"
        
        # USDT and USDC should stay at exactly 1
        print(f"✓ USDT stable at 1: {usdt1 == 1 and usdt2 == 1 and usdt3 == 1}")
        print(f"✓ USDC stable at 1: {usdc1 == 1 and usdc2 == 1 and usdc3 == 1}")
        
        assert usdt1 == 1 and usdt2 == 1 and usdt3 == 1, "USDT should stay at exactly 1"
        assert usdc1 == 1 and usdc2 == 1 and usdc3 == 1, "USDC should stay at exactly 1"
        
        # Verify changes are within reasonable range (±0.5%)
        btc_change_pct = abs((btc3 - btc1) / btc1 * 100)
        eth_change_pct = abs((eth3 - eth1) / eth1 * 100)
        sol_change_pct = abs((sol3 - sol1) / sol1 * 100)
        doge_change_pct = abs((doge3 - doge1) / doge1 * 100)
        
        print(f"\n✓ BTC change: {btc_change_pct:.4f}% (should be small, roughly ±0.5%)")
        print(f"✓ ETH change: {eth_change_pct:.4f}% (should be small, roughly ±0.5%)")
        print(f"✓ SOL change: {sol_change_pct:.4f}% (should be small, roughly ±0.5%)")
        print(f"✓ DOGE change: {doge_change_pct:.4f}% (should be small, roughly ±0.5%)")
        
        # Changes should be small (within ±1% for this short time period)
        assert btc_change_pct < 1.0, f"BTC change {btc_change_pct:.4f}% too large"
        assert eth_change_pct < 1.0, f"ETH change {eth_change_pct:.4f}% too large"
        assert sol_change_pct < 1.5, f"SOL change {sol_change_pct:.4f}% too large"
        assert doge_change_pct < 2.0, f"DOGE change {doge_change_pct:.4f}% too large"
        
        print("\n✅ TEST 1 PASSED: All cryptos have live movement")
        return True
        
    except AssertionError as e:
        print(f"\n❌ TEST 1 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ TEST 1 ERROR: {e}")
        return False


def test_history_arrays_grow():
    """
    Test 2 — History arrays grow
    Verify crypto_history arrays grow and cap at 120
    """
    print("\n" + "="*80)
    print("TEST 2: HISTORY ARRAYS GROW")
    print("="*80)
    
    try:
        # First call
        print("\n[1] First GET /api/rates call...")
        resp1 = requests.get(f"{BASE_URL}/rates", timeout=10)
        print(f"Status: {resp1.status_code}")
        assert resp1.status_code == 200, f"Expected 200, got {resp1.status_code}"
        data1 = resp1.json()
        
        history1 = data1.get('crypto_history', {})
        btc_len1 = len(history1.get('BTC', []))
        sol_len1 = len(history1.get('SOL', []))
        
        print(f"BTC history length: {btc_len1}")
        print(f"SOL history length: {sol_len1}")
        
        # Wait 6 seconds and make 2 more calls
        print("\n[2] Waiting 2 seconds...")
        time.sleep(2)
        
        print("\n[3] Second GET /api/rates call...")
        resp2 = requests.get(f"{BASE_URL}/rates", timeout=10)
        assert resp2.status_code == 200
        
        print("\n[4] Waiting 2 seconds...")
        time.sleep(2)
        
        print("\n[5] Third GET /api/rates call...")
        resp3 = requests.get(f"{BASE_URL}/rates", timeout=10)
        assert resp3.status_code == 200
        
        print("\n[6] Waiting 2 seconds...")
        time.sleep(2)
        
        print("\n[7] Fourth GET /api/rates call...")
        resp4 = requests.get(f"{BASE_URL}/rates", timeout=10)
        print(f"Status: {resp4.status_code}")
        assert resp4.status_code == 200
        data4 = resp4.json()
        
        history4 = data4.get('crypto_history', {})
        btc_len4 = len(history4.get('BTC', []))
        sol_len4 = len(history4.get('SOL', []))
        
        print(f"BTC history length: {btc_len4}")
        print(f"SOL history length: {sol_len4}")
        
        # Verify lengths increased
        print(f"\n✓ BTC history grew: {btc_len1} → {btc_len4} (increased by {btc_len4 - btc_len1})")
        print(f"✓ SOL history grew: {sol_len1} → {sol_len4} (increased by {sol_len4 - sol_len1})")
        
        assert btc_len4 > btc_len1, "BTC history should grow"
        assert sol_len4 > sol_len1, "SOL history should grow"
        
        # Verify cap at 120
        print(f"\n✓ BTC history capped at 120: {btc_len4 <= 120}")
        print(f"✓ SOL history capped at 120: {sol_len4 <= 120}")
        
        assert btc_len4 <= 120, "BTC history should cap at 120"
        assert sol_len4 <= 120, "SOL history should cap at 120"
        
        print("\n✅ TEST 2 PASSED: History arrays grow and cap at 120")
        return True
        
    except AssertionError as e:
        print(f"\n❌ TEST 2 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ TEST 2 ERROR: {e}")
        return False


def test_crypto_change_field():
    """
    Test 3 — crypto_change field
    Verify response includes crypto_change object with % values
    """
    print("\n" + "="*80)
    print("TEST 3: CRYPTO_CHANGE FIELD")
    print("="*80)
    
    try:
        print("\n[1] GET /api/rates...")
        resp = requests.get(f"{BASE_URL}/rates", timeout=10)
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        # Verify crypto_change exists
        assert 'crypto_change' in data, "Response should include crypto_change field"
        
        crypto_change = data.get('crypto_change', {})
        print(f"\n✓ crypto_change field present: True")
        print(f"✓ crypto_change keys: {list(crypto_change.keys())}")
        
        # Verify it has values for major cryptos
        for crypto in ['BTC', 'ETH', 'SOL', 'AUR']:
            if crypto in crypto_change:
                value = crypto_change[crypto]
                print(f"✓ {crypto} change: {value:+.4f}%")
                assert isinstance(value, (int, float)), f"{crypto} change should be a number"
                # Values should be small (typical -1% to +1%)
                assert -5 < value < 5, f"{crypto} change {value}% seems too large"
        
        print("\n✅ TEST 3 PASSED: crypto_change field present with valid % values")
        return True
        
    except AssertionError as e:
        print(f"\n❌ TEST 3 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ TEST 3 ERROR: {e}")
        return False


def test_prices_anchored_to_reality():
    """
    Test 4 — Prices anchored to reality
    Verify BTC is roughly $50k-$120k, ETH $1k-$5k, USDT/USDC $1
    """
    print("\n" + "="*80)
    print("TEST 4: PRICES ANCHORED TO REALITY")
    print("="*80)
    
    try:
        print("\n[1] GET /api/rates...")
        resp = requests.get(f"{BASE_URL}/rates", timeout=10)
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        crypto = data.get('crypto_usd', {})
        btc = crypto.get('BTC')
        eth = crypto.get('ETH')
        usdt = crypto.get('USDT')
        usdc = crypto.get('USDC')
        
        print(f"\nBTC: ${btc:,.2f}")
        print(f"ETH: ${eth:,.2f}")
        print(f"USDT: ${usdt:.6f}")
        print(f"USDC: ${usdc:.6f}")
        
        # Verify BTC is in realistic range
        print(f"\n✓ BTC in range $50k-$120k: {50000 <= btc <= 120000}")
        assert 50000 <= btc <= 120000, f"BTC price ${btc:,.2f} outside realistic range"
        
        # Verify ETH is in realistic range
        print(f"✓ ETH in range $1k-$5k: {1000 <= eth <= 5000}")
        assert 1000 <= eth <= 5000, f"ETH price ${eth:,.2f} outside realistic range"
        
        # Verify USDT/USDC are exactly $1
        print(f"✓ USDT is $1: {usdt == 1}")
        print(f"✓ USDC is $1: {usdc == 1}")
        assert usdt == 1, f"USDT should be $1, got ${usdt}"
        assert usdc == 1, f"USDC should be $1, got ${usdc}"
        
        print("\n✅ TEST 4 PASSED: Prices anchored to reality")
        return True
        
    except AssertionError as e:
        print(f"\n❌ TEST 4 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ TEST 4 ERROR: {e}")
        return False


def test_regression():
    """
    Regression tests
    Verify health, config, admin login still work
    """
    print("\n" + "="*80)
    print("REGRESSION TESTS")
    print("="*80)
    
    all_passed = True
    
    # Test health endpoint
    try:
        print("\n[1] GET /api/health...")
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('ok') == True, "Health check should return ok:true"
        print("✅ Health endpoint working")
    except Exception as e:
        print(f"❌ Health endpoint failed: {e}")
        all_passed = False
    
    # Test config endpoint
    try:
        print("\n[2] GET /api/config...")
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'enabled_fiat' in data, "Config should include enabled_fiat"
        assert 'enabled_crypto' in data, "Config should include enabled_crypto"
        print(f"✓ enabled_fiat count: {len(data.get('enabled_fiat', []))}")
        print(f"✓ enabled_crypto count: {len(data.get('enabled_crypto', []))}")
        # Verify AUR is in the crypto list
        assert 'AUR' in data.get('enabled_crypto', []), "AUR should be in enabled_crypto"
        print("✅ Config endpoint working (includes AUR)")
    except Exception as e:
        print(f"❌ Config endpoint failed: {e}")
        all_passed = False
    
    # Test admin login (try both possible admin accounts)
    try:
        print("\n[3] POST /api/auth/login (admin)...")
        # Try first admin account
        resp = requests.post(
            f"{BASE_URL}/auth/login",
            json={"identifier": "admin@aurelawallet.com", "password": "Aurela@123#"},
            timeout=10
        )
        # If first fails, try second admin account
        if resp.status_code != 200:
            resp = requests.post(
                f"{BASE_URL}/auth/login",
                json={"identifier": "admin@aurela.io", "password": "Admin@123"},
                timeout=10
            )
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'token' in data, "Login should return token"
        assert data.get('user', {}).get('role') == 'super_admin', "Admin should have super_admin role"
        print("✅ Admin login working")
    except Exception as e:
        print(f"❌ Admin login failed: {e}")
        all_passed = False
    
    if all_passed:
        print("\n✅ ALL REGRESSION TESTS PASSED")
    else:
        print("\n❌ SOME REGRESSION TESTS FAILED")
    
    return all_passed


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("AURELA BACKEND TEST - LIVE CRYPTO TICKER")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    results = {
        "Test 1 - All cryptos have live movement": test_live_crypto_ticker(),
        "Test 2 - History arrays grow": test_history_arrays_grow(),
        "Test 3 - crypto_change field": test_crypto_change_field(),
        "Test 4 - Prices anchored to reality": test_prices_anchored_to_reality(),
        "Regression tests": test_regression(),
    }
    
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    total = len(results)
    passed = sum(results.values())
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit(main())
