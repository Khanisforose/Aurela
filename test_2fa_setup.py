#!/usr/bin/env python3
"""
Focused test for 2FA setup endpoint
Tests POST /api/profile/2fa/setup after admin login
"""
import requests
import json
import sys

BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

def log(msg, status="INFO"):
    """Print test log message"""
    prefix = "✅" if status == "PASS" else "❌" if status == "FAIL" else "ℹ️"
    print(f"{prefix} [{status}] {msg}")

def test_2fa_setup():
    """Test 2FA setup endpoint"""
    print("\n" + "="*80)
    print("  2FA SETUP ENDPOINT TEST")
    print("="*80 + "\n")
    
    # Step 1: Admin login
    log("Step 1: Admin login...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=10)
        
        if resp.status_code != 200:
            log(f"Admin login failed: {resp.status_code} {resp.text}", "FAIL")
            return False
        
        data = resp.json()
        admin_token = data.get("token")
        log(f"Admin login successful, role={data.get('user', {}).get('role')}", "PASS")
    except Exception as e:
        log(f"Admin login exception: {str(e)}", "FAIL")
        return False
    
    # Step 2: Call 2FA setup endpoint
    log("\nStep 2: Call POST /api/profile/2fa/setup...")
    try:
        resp = requests.post(
            f"{BASE_URL}/profile/2fa/setup",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={},
            timeout=10
        )
        
        log(f"Response status: {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL: 2FA setup returned 500 Internal Server Error", "FAIL")
            log(f"Response body: {resp.text}", "FAIL")
            return False
        
        if resp.status_code != 200:
            log(f"2FA setup failed with status {resp.status_code}: {resp.text}", "FAIL")
            return False
        
        # Step 3: Validate response structure
        log("\nStep 3: Validate response structure...")
        data = resp.json()
        
        # Check for required keys
        required_keys = ['secret', 'uri', 'qr_svg']
        missing_keys = [key for key in required_keys if key not in data]
        
        if missing_keys:
            log(f"Missing required keys: {missing_keys}", "FAIL")
            log(f"Response data: {json.dumps(data, indent=2)}", "FAIL")
            return False
        
        # Validate secret (should be a non-empty string)
        secret = data.get('secret')
        if not secret or not isinstance(secret, str) or len(secret) == 0:
            log(f"Invalid secret: {secret}", "FAIL")
            return False
        log(f"✓ secret is valid string (length: {len(secret)})", "PASS")
        
        # Validate uri (should start with otpauth://totp/)
        uri = data.get('uri')
        if not uri or not isinstance(uri, str) or not uri.startswith('otpauth://totp/'):
            log(f"Invalid uri: {uri}", "FAIL")
            return False
        log(f"✓ uri starts with 'otpauth://totp/'", "PASS")
        
        # Validate qr_svg (should start with '<svg')
        qr_svg = data.get('qr_svg')
        if not qr_svg or not isinstance(qr_svg, str) or not qr_svg.strip().startswith('<svg'):
            log(f"Invalid qr_svg (first 100 chars): {qr_svg[:100] if qr_svg else 'None'}", "FAIL")
            return False
        log(f"✓ qr_svg starts with '<svg'", "PASS")
        
        log("\n✅ 2FA SETUP ENDPOINT TEST PASSED!", "PASS")
        log(f"Response structure is correct:", "PASS")
        log(f"  - secret: {secret[:10]}... (length: {len(secret)})", "INFO")
        log(f"  - uri: {uri[:50]}...", "INFO")
        log(f"  - qr_svg: <svg...> (length: {len(qr_svg)})", "INFO")
        
        return True
        
    except Exception as e:
        log(f"2FA setup exception: {str(e)}", "FAIL")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_2fa_setup()
    sys.exit(0 if success else 1)
