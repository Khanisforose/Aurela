#!/usr/bin/env python3
"""
Backend test for KYC admin endpoints - Production bug fix verification
Tests that GET /api/admin/kyc strips base64 images from list responses
but GET /api/admin/kyc/:id still returns full images.
"""

import requests
import json
import sys
import base64
from typing import Dict, Any

# Configuration
BASE_URL = "https://aurela-preview.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aurelawallet.com"
ADMIN_PASSWORD = "Aurela@123#"

# Test results tracking
tests_passed = 0
tests_failed = 0
test_results = []

def log_test(test_name: str, passed: bool, message: str = ""):
    """Log test result"""
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        status = "✅ PASS"
    else:
        tests_failed += 1
        status = "❌ FAIL"
    
    result = f"{status} - {test_name}"
    if message:
        result += f": {message}"
    print(result)
    test_results.append({"test": test_name, "passed": passed, "message": message})

def admin_login() -> str:
    """Login as admin and return token"""
    print("\n=== Admin Login ===")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    
    if response.status_code != 200:
        print(f"❌ Admin login failed: {response.status_code} - {response.text}")
        sys.exit(1)
    
    data = response.json()
    token = data.get("token")
    print(f"✅ Admin logged in successfully. Role: {data.get('user', {}).get('role')}")
    return token

def register_test_user(token: str) -> Dict[str, Any]:
    """Register a fresh test user and return user data"""
    print("\n=== Registering Test User ===")
    
    # First, init registration
    import random
    random_num = random.randint(100000, 999999)
    test_email = f"kyctest{random_num}@test.com"
    test_password = "TestPass123!"
    
    init_response = requests.post(
        f"{BASE_URL}/auth/register/init",
        json={
            "first_name": "KYC",
            "last_name": "Tester",
            "email": test_email,
            "country": "United States",
            "phone": f"+1555{random_num}",
            "password": test_password
        }
    )
    
    if init_response.status_code != 200:
        print(f"❌ Registration init failed: {init_response.status_code} - {init_response.text}")
        sys.exit(1)
    
    init_data = init_response.json()
    signup_id = init_data.get("signup_id")
    dev_otp = init_data.get("dev_otp")
    
    # If dev_otp is not provided, fetch from database
    if not dev_otp:
        from pymongo import MongoClient
        client = MongoClient("mongodb://localhost:27017")
        db = client["aurela"]
        pending = db["pending_signups"].find_one({"id": signup_id})
        if pending:
            dev_otp = pending.get("code")
        client.close()
    
    print(f"✅ Registration initiated. Signup ID: {signup_id}, OTP: {dev_otp}")
    
    # Verify registration
    verify_response = requests.post(
        f"{BASE_URL}/auth/register/verify",
        json={"signup_id": signup_id, "code": dev_otp}
    )
    
    if verify_response.status_code != 200:
        print(f"❌ Registration verify failed: {verify_response.status_code} - {verify_response.text}")
        sys.exit(1)
    
    verify_data = verify_response.json()
    user_token = verify_data.get("token")
    user_data = verify_data.get("user")
    
    print(f"✅ User registered successfully. User ID: {user_data.get('id')}, Email: {test_email}")
    
    return {
        "email": test_email,
        "password": test_password,
        "token": user_token,
        "user_id": user_data.get("id"),
        "user": user_data
    }

def submit_kyc_with_large_images(user_token: str, user_id: str) -> str:
    """Submit KYC with large base64 images and return KYC ID"""
    print("\n=== Submitting KYC with Large Images ===")
    
    # Create large base64 data URIs (~300KB each)
    large_image_data = "A" * 300000
    doc_front = f"data:image/jpeg;base64,{large_image_data}"
    doc_back = f"data:image/jpeg;base64,{large_image_data}"
    selfie = f"data:image/jpeg;base64,{large_image_data}"
    
    kyc_payload = {
        "first_name": "KYC",
        "last_name": "Tester",
        "dob": "1990-01-01",
        "country": "United States",
        "mobile": "+15551234567",
        "id_type": "passport",
        "id_number": "P123456789",
        "doc_front": doc_front,
        "doc_back": doc_back,
        "selfie": selfie
    }
    
    response = requests.post(
        f"{BASE_URL}/kyc",
        headers={"Authorization": f"Bearer {user_token}"},
        json=kyc_payload
    )
    
    if response.status_code != 200:
        print(f"❌ KYC submission failed: {response.status_code} - {response.text}")
        sys.exit(1)
    
    data = response.json()
    kyc_id = data.get("kyc", {}).get("id")
    print(f"✅ KYC submitted successfully. KYC ID: {kyc_id}")
    print(f"   Payload size: ~{len(json.dumps(kyc_payload)) / 1024:.0f} KB")
    
    return kyc_id

def test_admin_kyc_list(admin_token: str, kyc_id: str):
    """Test 1: GET /api/admin/kyc - list should NOT include base64 images"""
    print("\n=== TEST 1: Admin KYC List (No Images) ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/kyc",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    # Check status code
    if response.status_code != 200:
        log_test("Test 1: Status code", False, f"Expected 200, got {response.status_code}")
        return
    
    log_test("Test 1: Status code", True, "200 OK")
    
    data = response.json()
    
    # Check response shape
    has_kyc = "kyc" in data
    has_total = "total" in data
    has_pending = "pending" in data
    
    log_test("Test 1: Response shape", 
             has_kyc and has_total and has_pending,
             f"Has kyc: {has_kyc}, total: {has_total}, pending: {has_pending}")
    
    # Check that response body is small
    response_size = len(response.text)
    size_kb = response_size / 1024
    
    log_test("Test 1: Response size", 
             size_kb < 200,
             f"Response size: {size_kb:.1f} KB (should be < 200 KB)")
    
    # Check that NO items contain doc_front, doc_back, or selfie
    kyc_list = data.get("kyc", [])
    items_with_images = []
    
    for item in kyc_list:
        if "doc_front" in item or "doc_back" in item or "selfie" in item:
            items_with_images.append(item.get("id"))
    
    log_test("Test 1: No base64 images in list", 
             len(items_with_images) == 0,
             f"Items with images: {len(items_with_images)}")
    
    # Check that items still have required fields
    if kyc_list:
        first_item = kyc_list[0]
        required_fields = ["id", "user_id", "country", "mobile", "id_type", "status", "submitted_at"]
        missing_fields = [f for f in required_fields if f not in first_item]
        
        log_test("Test 1: Required fields present", 
                 len(missing_fields) == 0,
                 f"Missing fields: {missing_fields}" if missing_fields else "All required fields present")
    
    # Check sorting (should be by submitted_at desc)
    if len(kyc_list) > 1:
        is_sorted = all(kyc_list[i]["submitted_at"] >= kyc_list[i+1]["submitted_at"] 
                       for i in range(len(kyc_list)-1))
        log_test("Test 1: Sorted by submitted_at desc", is_sorted)

def test_admin_kyc_filters(admin_token: str):
    """Test 2: GET /api/admin/kyc with status filters and limit"""
    print("\n=== TEST 2: Admin KYC Filters ===")
    
    # Test status=pending
    response = requests.get(
        f"{BASE_URL}/admin/kyc?status=pending",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        kyc_list = data.get("kyc", [])
        pending_count = data.get("pending", 0)
        
        # All items should have status=pending
        all_pending = all(item.get("status") == "pending" for item in kyc_list)
        log_test("Test 2: status=pending filter", all_pending, 
                f"Found {len(kyc_list)} pending items, pending count: {pending_count}")
    else:
        log_test("Test 2: status=pending filter", False, f"Status: {response.status_code}")
    
    # Test status=approved
    response = requests.get(
        f"{BASE_URL}/admin/kyc?status=approved",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        kyc_list = data.get("kyc", [])
        all_approved = all(item.get("status") == "approved" for item in kyc_list)
        log_test("Test 2: status=approved filter", all_approved,
                f"Found {len(kyc_list)} approved items")
    else:
        log_test("Test 2: status=approved filter", False, f"Status: {response.status_code}")
    
    # Test status=rejected
    response = requests.get(
        f"{BASE_URL}/admin/kyc?status=rejected",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        kyc_list = data.get("kyc", [])
        all_rejected = all(item.get("status") == "rejected" for item in kyc_list)
        log_test("Test 2: status=rejected filter", all_rejected,
                f"Found {len(kyc_list)} rejected items")
    else:
        log_test("Test 2: status=rejected filter", False, f"Status: {response.status_code}")
    
    # Test status=all
    response = requests.get(
        f"{BASE_URL}/admin/kyc?status=all",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        total = data.get("total", 0)
        log_test("Test 2: status=all returns all", True, f"Total: {total}")
    else:
        log_test("Test 2: status=all returns all", False, f"Status: {response.status_code}")
    
    # Test limit=1
    response = requests.get(
        f"{BASE_URL}/admin/kyc?limit=1",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        kyc_list = data.get("kyc", [])
        total = data.get("total", 0)
        
        log_test("Test 2: limit=1", len(kyc_list) <= 1,
                f"Returned {len(kyc_list)} items, total: {total}")
    else:
        log_test("Test 2: limit=1", False, f"Status: {response.status_code}")

def test_admin_kyc_detail(admin_token: str, kyc_id: str):
    """Test 3: GET /api/admin/kyc/:id - detail SHOULD include full images"""
    print("\n=== TEST 3: Admin KYC Detail (With Images) ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/kyc/{kyc_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    # Check status code
    if response.status_code != 200:
        log_test("Test 3: Status code", False, f"Expected 200, got {response.status_code}")
        return
    
    log_test("Test 3: Status code", True, "200 OK")
    
    data = response.json()
    
    # Check response shape
    has_kyc = "kyc" in data
    has_user = "user" in data
    
    log_test("Test 3: Response shape", has_kyc and has_user,
            f"Has kyc: {has_kyc}, user: {has_user}")
    
    kyc = data.get("kyc", {})
    
    # Check that images ARE present
    has_doc_front = "doc_front" in kyc
    has_doc_back = "doc_back" in kyc
    has_selfie = "selfie" in kyc
    
    log_test("Test 3: Images present", 
             has_doc_front and has_doc_back and has_selfie,
             f"doc_front: {has_doc_front}, doc_back: {has_doc_back}, selfie: {has_selfie}")
    
    # Check that images are the full base64 strings (should start with data:image)
    if has_doc_front:
        is_valid = kyc["doc_front"].startswith("data:image")
        log_test("Test 3: doc_front is full image", is_valid,
                f"Starts with 'data:image': {is_valid}")
    
    # Check that user object doesn't include password_hash/salt
    user = data.get("user", {})
    has_password = "password_hash" in user or "salt" in user
    
    log_test("Test 3: User no password", not has_password,
            "User object should not include password_hash or salt")

def test_admin_kyc_nonexistent(admin_token: str):
    """Test 4: GET /api/admin/kyc/:id with nonexistent ID should return 404"""
    print("\n=== TEST 4: Admin KYC Nonexistent ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/kyc/nonexistent-kyc-id-12345",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    log_test("Test 4: Nonexistent KYC returns 404", 
             response.status_code == 404,
             f"Status: {response.status_code}")

def test_admin_kyc_approve_reject(admin_token: str, test_user1: Dict, test_user2: Dict):
    """Test 5: POST /api/admin/kyc/:id/approve and reject"""
    print("\n=== TEST 5: Admin KYC Approve/Reject ===")
    
    kyc_id1 = test_user1["kyc_id"]
    kyc_id2 = test_user2["kyc_id"]
    
    # Approve first KYC
    response = requests.post(
        f"{BASE_URL}/admin/kyc/{kyc_id1}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    log_test("Test 5: Approve KYC", 
             response.status_code == 200 and response.json().get("ok") == True,
             f"Status: {response.status_code}")
    
    # Check that it appears in approved list
    response = requests.get(
        f"{BASE_URL}/admin/kyc?status=approved",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        kyc_list = response.json().get("kyc", [])
        kyc_ids = [k.get("id") for k in kyc_list]
        log_test("Test 5: Approved KYC in approved list", kyc_id1 in kyc_ids)
    
    # Check that it doesn't appear in pending list
    response = requests.get(
        f"{BASE_URL}/admin/kyc?status=pending",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        kyc_list = response.json().get("kyc", [])
        kyc_ids = [k.get("id") for k in kyc_list]
        log_test("Test 5: Approved KYC not in pending list", kyc_id1 not in kyc_ids)
    
    # Check user's kyc_status
    response = requests.get(
        f"{BASE_URL}/auth/me",
        headers={"Authorization": f"Bearer {test_user1['token']}"}
    )
    
    if response.status_code == 200:
        user = response.json().get("user", {})
        log_test("Test 5: User kyc_status approved", 
                user.get("kyc_status") == "approved",
                f"kyc_status: {user.get('kyc_status')}")
    
    # Reject second KYC
    response = requests.post(
        f"{BASE_URL}/admin/kyc/{kyc_id2}/reject",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    log_test("Test 5: Reject KYC", 
             response.status_code == 200 and response.json().get("ok") == True,
             f"Status: {response.status_code}")
    
    # Check that it appears in rejected list
    response = requests.get(
        f"{BASE_URL}/admin/kyc?status=rejected",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        kyc_list = response.json().get("kyc", [])
        kyc_ids = [k.get("id") for k in kyc_list]
        log_test("Test 5: Rejected KYC in rejected list", kyc_id2 in kyc_ids)

def test_admin_notifications(admin_token: str):
    """Test 6: GET /api/admin/notifications should not contain base64 images"""
    print("\n=== TEST 6: Admin Notifications (No Images) ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/notifications",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code != 200:
        log_test("Test 6: Status code", False, f"Expected 200, got {response.status_code}")
        return
    
    log_test("Test 6: Status code", True, "200 OK")
    
    response_text = response.text
    
    # Check that response does NOT contain "data:image" substring
    has_images = "data:image" in response_text
    
    log_test("Test 6: No base64 images", not has_images,
            "Response should not contain 'data:image' substring")
    
    data = response.json()
    items = data.get("items", [])
    
    # Check that kyc items still appear
    kyc_items = [item for item in items if item.get("kind") == "kyc"]
    
    log_test("Test 6: KYC items present", len(kyc_items) > 0,
            f"Found {len(kyc_items)} KYC items in notifications")

def test_admin_user_detail(admin_token: str, user_id: str):
    """Test 7: GET /api/admin/users/:id should not include images in kyc object"""
    print("\n=== TEST 7: Admin User Detail (No Images in KYC) ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/users/{user_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code != 200:
        log_test("Test 7: Status code", False, f"Expected 200, got {response.status_code}")
        return
    
    log_test("Test 7: Status code", True, "200 OK")
    
    data = response.json()
    kyc = data.get("kyc")
    
    if kyc:
        # Check that images are NOT present
        has_doc_front = "doc_front" in kyc
        has_doc_back = "doc_back" in kyc
        has_selfie = "selfie" in kyc
        
        log_test("Test 7: No images in KYC", 
                not (has_doc_front or has_doc_back or has_selfie),
                f"doc_front: {has_doc_front}, doc_back: {has_doc_back}, selfie: {has_selfie}")
        
        # Check that other fields are present
        has_status = "status" in kyc
        has_id_type = "id_type" in kyc
        
        log_test("Test 7: KYC metadata present", has_status and has_id_type,
                f"status: {has_status}, id_type: {has_id_type}")
    else:
        log_test("Test 7: KYC object", False, "No KYC object found")

def test_concurrency_regression(admin_token: str):
    """Test 8: Concurrency regression - parallel requests should not fail"""
    print("\n=== TEST 8: Concurrency Regression ===")
    
    import concurrent.futures
    
    def make_request(url: str) -> int:
        """Make a request and return status code"""
        try:
            response = requests.get(url, timeout=10)
            return response.status_code
        except Exception as e:
            print(f"Request failed: {e}")
            return 0
    
    # Fire 8 parallel GET /api/rates requests
    rates_urls = [f"{BASE_URL}/rates" for _ in range(8)]
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        rates_results = list(executor.map(make_request, rates_urls))
    
    all_200 = all(status == 200 for status in rates_results)
    none_500 = all(status != 500 for status in rates_results)
    
    log_test("Test 8: Parallel /rates requests", all_200 and none_500,
            f"Results: {rates_results}")
    
    # Fire 4 parallel GET /api/config requests
    config_urls = [f"{BASE_URL}/config" for _ in range(4)]
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        config_results = list(executor.map(make_request, config_urls))
    
    all_200 = all(status == 200 for status in config_results)
    none_500 = all(status != 500 for status in config_results)
    
    log_test("Test 8: Parallel /config requests", all_200 and none_500,
            f"Results: {config_results}")

def test_quick_regression(admin_token: str, user_token: str):
    """Test 9: Quick regression - basic endpoints still work"""
    print("\n=== TEST 9: Quick Regression ===")
    
    # GET /api/wallets (authenticated)
    response = requests.get(
        f"{BASE_URL}/wallets",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    
    log_test("Test 9: GET /wallets", response.status_code == 200,
            f"Status: {response.status_code}")
    
    # GET /api/rates
    response = requests.get(f"{BASE_URL}/rates")
    
    log_test("Test 9: GET /rates", response.status_code == 200,
            f"Status: {response.status_code}")
    
    # Non-admin user calling GET /api/admin/kyc should return 403 or 401
    response = requests.get(
        f"{BASE_URL}/admin/kyc",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    
    log_test("Test 9: Non-admin /admin/kyc blocked", 
            response.status_code in [401, 403],
            f"Status: {response.status_code}")

def main():
    """Main test execution"""
    print("=" * 80)
    print("BACKEND TEST: KYC Admin Endpoints - Production Bug Fix")
    print("=" * 80)
    
    # Login as admin
    admin_token = admin_login()
    
    # Register two test users and submit KYC with large images
    test_user1 = register_test_user(admin_token)
    kyc_id1 = submit_kyc_with_large_images(test_user1["token"], test_user1["user_id"])
    test_user1["kyc_id"] = kyc_id1
    
    test_user2 = register_test_user(admin_token)
    kyc_id2 = submit_kyc_with_large_images(test_user2["token"], test_user2["user_id"])
    test_user2["kyc_id"] = kyc_id2
    
    # Run all tests
    test_admin_kyc_list(admin_token, kyc_id1)
    test_admin_kyc_filters(admin_token)
    test_admin_kyc_detail(admin_token, kyc_id1)
    test_admin_kyc_nonexistent(admin_token)
    test_admin_kyc_approve_reject(admin_token, test_user1, test_user2)
    test_admin_notifications(admin_token)
    test_admin_user_detail(admin_token, test_user1["user_id"])
    test_concurrency_regression(admin_token)
    test_quick_regression(admin_token, test_user1["token"])
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total tests: {tests_passed + tests_failed}")
    print(f"✅ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    print(f"Success rate: {tests_passed / (tests_passed + tests_failed) * 100:.1f}%")
    print("=" * 80)
    
    # Exit with appropriate code
    sys.exit(0 if tests_failed == 0 else 1)

if __name__ == "__main__":
    main()
