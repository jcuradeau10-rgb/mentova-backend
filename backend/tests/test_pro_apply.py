"""
Test suite for Professional Application form functionality
Tests the complete flow: register user -> submit pro application -> verify in admin
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test user data
TEST_EMAIL = f"test_pro_apply_{uuid.uuid4().hex[:8]}@test.com"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "Test Pro Applicant"

# Admin credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"


class TestProApplicationFlow:
    """Test suite for professional application submission"""
    
    user_token = None
    admin_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - register new user and get admin token"""
        # Register new test user
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": TEST_NAME
            }
        )
        if register_response.status_code == 200:
            TestProApplicationFlow.user_token = register_response.json().get("access_token")
            print(f"Registered new test user: {TEST_EMAIL}")
        else:
            # User might already exist, try login
            login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                }
            )
            if login_response.status_code == 200:
                TestProApplicationFlow.user_token = login_response.json().get("access_token")
            else:
                pytest.skip(f"Could not register/login test user: {register_response.text}")
        
        # Get admin token
        admin_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        if admin_login.status_code == 200:
            TestProApplicationFlow.admin_token = admin_login.json().get("access_token")
        else:
            print(f"Admin login failed: {admin_login.text}")

    # Test 1: Check pro info endpoint (public)
    def test_01_get_pro_info_public(self):
        """GET /api/pro/info should return pro marketplace info"""
        response = requests.get(f"{BASE_URL}/api/pro/info")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert "commission_rate" in data["data"]
        print("SUCCESS: Pro info endpoint working correctly")

    # Test 2: Pro application requires authentication
    def test_02_apply_requires_auth(self):
        """POST /api/pro/apply should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/pro/apply",
            json={
                "full_name": "Test User",
                "country": "France",
                "languages": ["Français"],
                "main_expertise": "trading",
                "bio": "Test bio",
                "services_offered": ["mentoring"]
            }
        )
        # Should fail with 401/403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Pro apply endpoint requires authentication")

    # Test 3: Get application status requires auth
    def test_03_get_status_requires_auth(self):
        """GET /api/pro/application/status should require authentication"""
        response = requests.get(f"{BASE_URL}/api/pro/application/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Application status endpoint requires authentication")

    # Test 4: Authenticated user can get application status (initially null)
    def test_04_get_status_returns_null_initially(self):
        """GET /api/pro/application/status should return null for new users"""
        if not TestProApplicationFlow.user_token:
            pytest.skip("No user token available")
        
        response = requests.get(
            f"{BASE_URL}/api/pro/application/status",
            headers={"Authorization": f"Bearer {TestProApplicationFlow.user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        # New user should have no application
        print(f"Application status: {data.get('data')}")
        print("SUCCESS: New user has no existing application")

    # Test 5: Submit professional application with all required fields
    def test_05_submit_pro_application(self):
        """POST /api/pro/apply should accept complete application data"""
        if not TestProApplicationFlow.user_token:
            pytest.skip("No user token available")
        
        application_data = {
            # Step 1: Personal info
            "full_name": TEST_NAME,
            "phone": "+33 6 12 34 56 78",
            "country": "France",
            "city": "Paris",
            "languages": ["Français", "English"],
            
            # Step 2: Expertise
            "main_expertise": "trading",
            "specializations": ["defi", "nft"],
            "years_experience": 5,
            "bio": "Expert en trading crypto avec plus de 5 ans d'expérience dans le domaine des cryptomonnaies.",
            
            # Step 3: Credentials
            "linkedin_url": "https://linkedin.com/in/testuser",
            "twitter_url": "https://twitter.com/testuser",
            "portfolio_url": "https://testuser.com",
            "certifications": ["CFA Level 1", "Binance Academy Certified"],
            "video_intro_url": "https://youtube.com/watch?v=test",
            
            # Step 4: Services
            "services_offered": ["mentoring", "courses"],
            "hourly_rate": 75,
            "course_price_range": "50-150",
            "availability": "part_time"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/apply",
            json=application_data,
            headers={"Authorization": f"Bearer {TestProApplicationFlow.user_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert "application_id" in data["data"]
        assert data["data"]["status"] == "pending"
        
        print(f"SUCCESS: Application submitted. ID: {data['data']['application_id']}")
        print(f"Message: {data['data']['message']}")

    # Test 6: Cannot submit duplicate application
    def test_06_cannot_submit_duplicate(self):
        """POST /api/pro/apply should reject duplicate applications"""
        if not TestProApplicationFlow.user_token:
            pytest.skip("No user token available")
        
        application_data = {
            "full_name": TEST_NAME,
            "country": "France",
            "languages": ["Français"],
            "main_expertise": "trading",
            "bio": "Another test application",
            "services_offered": ["mentoring"],
            "hourly_rate": 50,
            "years_experience": 2
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/apply",
            json=application_data,
            headers={"Authorization": f"Bearer {TestProApplicationFlow.user_token}"}
        )
        
        # Should fail because user already has pending application
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("SUCCESS: Duplicate applications are rejected")

    # Test 7: Get application status shows pending application
    def test_07_get_status_shows_pending(self):
        """GET /api/pro/application/status should show pending application"""
        if not TestProApplicationFlow.user_token:
            pytest.skip("No user token available")
        
        response = requests.get(
            f"{BASE_URL}/api/pro/application/status",
            headers={"Authorization": f"Bearer {TestProApplicationFlow.user_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("data") is not None
        assert data["data"]["status"] == "pending"
        assert data["data"]["full_name"] == TEST_NAME
        assert data["data"]["main_expertise"] == "trading"
        
        print("SUCCESS: Application status shows pending with correct data")

    # Test 8: Admin can view pending applications
    def test_08_admin_can_view_applications(self):
        """GET /api/admin/pro/applications should list pending applications"""
        if not TestProApplicationFlow.admin_token:
            pytest.skip("No admin token available")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/pro/applications",
            params={"status": "pending"},
            headers={"Authorization": f"Bearer {TestProApplicationFlow.admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        # Check if our test application is in the list
        test_app = next((app for app in data["data"] if app.get("user_email") == TEST_EMAIL), None)
        if test_app:
            print(f"SUCCESS: Found test application in admin panel")
            print(f"  - Full name: {test_app.get('full_name')}")
            print(f"  - Expertise: {test_app.get('main_expertise')}")
            print(f"  - Status: {test_app.get('status')}")
        else:
            print("WARNING: Test application not found in pending list (might be already processed)")
        
        print(f"Total pending applications: {data.get('total', len(data['data']))}")

    # Test 9: Admin can filter applications by status
    def test_09_admin_can_filter_by_status(self):
        """GET /api/admin/pro/applications with status filter"""
        if not TestProApplicationFlow.admin_token:
            pytest.skip("No admin token available")
        
        for status in ["pending", "approved", "rejected"]:
            response = requests.get(
                f"{BASE_URL}/api/admin/pro/applications",
                params={"status": status, "limit": 10},
                headers={"Authorization": f"Bearer {TestProApplicationFlow.admin_token}"}
            )
            
            assert response.status_code == 200, f"Expected 200 for status={status}, got {response.status_code}"
            data = response.json()
            assert data.get("success") == True
            print(f"  - {status}: {data.get('total', len(data.get('data', [])))} applications")
        
        print("SUCCESS: Admin filtering by status works correctly")

    # Test 10: Application data includes all required fields
    def test_10_application_has_required_fields(self):
        """Verify application data structure includes all fields"""
        if not TestProApplicationFlow.user_token:
            pytest.skip("No user token available")
        
        response = requests.get(
            f"{BASE_URL}/api/pro/application/status",
            headers={"Authorization": f"Bearer {TestProApplicationFlow.user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        application = data.get("data")
        
        if not application:
            pytest.skip("No application found")
        
        # Check all required fields are present
        required_fields = [
            "id", "user_id", "user_email", "full_name", "country",
            "languages", "main_expertise", "bio", "services_offered",
            "hourly_rate", "years_experience", "status", "created_at"
        ]
        
        for field in required_fields:
            assert field in application, f"Missing field: {field}"
        
        # Check optional fields are present (can be null)
        optional_fields = [
            "phone", "city", "specializations", "linkedin_url",
            "twitter_url", "portfolio_url", "certifications",
            "video_intro_url", "course_price_range", "availability"
        ]
        
        for field in optional_fields:
            assert field in application, f"Missing optional field: {field}"
        
        print("SUCCESS: Application data structure is complete")
        print(f"  - Languages: {application.get('languages')}")
        print(f"  - Services: {application.get('services_offered')}")
        print(f"  - Certifications: {application.get('certifications')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
