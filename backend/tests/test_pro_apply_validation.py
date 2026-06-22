"""
Tests for Pro Application API validation
Tests the backend validation for professional application submissions
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')


class TestProApplicationAPI:
    """Test professional application API endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for a test user"""
        # Register a new user for testing
        import uuid
        test_email = f"test_pro_api_{uuid.uuid4().hex[:8]}@test.com"
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "Test1234",
                "name": "Pro API Test User"
            }
        )
        if register_response.status_code == 200:
            return register_response.json()["access_token"]
        elif register_response.status_code == 400:
            # User exists, try login
            login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": test_email, "password": "Test1234"}
            )
            return login_response.json()["access_token"]
        pytest.skip("Could not authenticate")
    
    def test_pro_info_endpoint(self):
        """Test GET /api/pro/info returns correct data"""
        response = requests.get(f"{BASE_URL}/api/pro/info")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "title" in data["data"]
        assert "commission_rate" in data["data"]
        print(f"PASS: Pro info endpoint returns correct structure")
    
    def test_pro_apply_missing_required_fields(self, auth_token):
        """Test POST /api/pro/apply fails with missing required fields"""
        response = requests.post(
            f"{BASE_URL}/api/pro/apply",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "full_name": "",
                "country": "",
                "languages": [],
                "main_expertise": "",
                "bio": "",
                "services_offered": [],
                "availability": ""
            }
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422
        print(f"PASS: Missing required fields returns 422 validation error")
    
    def test_pro_apply_valid_submission(self, auth_token):
        """Test POST /api/pro/apply with valid data succeeds"""
        response = requests.post(
            f"{BASE_URL}/api/pro/apply",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "full_name": "Test Professional User",
                "country": "France",
                "languages": ["Français", "English"],
                "main_expertise": "trading",
                "specializations": ["defi"],
                "years_experience": 3,
                "bio": "This is a test bio with more than twenty characters for validation purposes.",
                "services_offered": ["mentoring", "courses"],
                "availability": "part_time"
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "application_id" in data["data"]
        assert data["data"]["status"] == "pending"
        print(f"PASS: Valid pro application submission succeeds")
    
    def test_pro_apply_duplicate_application(self, auth_token):
        """Test POST /api/pro/apply fails for duplicate application"""
        # First submission
        first_response = requests.post(
            f"{BASE_URL}/api/pro/apply",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "full_name": "Test Professional User",
                "country": "France",
                "languages": ["Français"],
                "main_expertise": "trading",
                "specializations": [],
                "years_experience": 2,
                "bio": "Test bio with enough characters here.",
                "services_offered": ["mentoring"],
                "availability": "part_time"
            }
        )
        
        # Second submission should fail
        second_response = requests.post(
            f"{BASE_URL}/api/pro/apply",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "full_name": "Test Professional User",
                "country": "France",
                "languages": ["Français"],
                "main_expertise": "defi",
                "specializations": [],
                "years_experience": 3,
                "bio": "Another test bio with enough characters.",
                "services_offered": ["courses"],
                "availability": "full_time"
            }
        )
        
        # Either first succeeds and second fails with 400, or first fails with 400 (already applied)
        if first_response.status_code == 200:
            assert second_response.status_code == 400
            print(f"PASS: Duplicate application prevented")
        else:
            assert first_response.status_code == 400  # Already has an application
            print(f"PASS: User already has existing application")
    
    def test_pro_application_status(self, auth_token):
        """Test GET /api/pro/application/status returns correct data"""
        response = requests.get(
            f"{BASE_URL}/api/pro/application/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        # data["data"] can be null if no application exists
        print(f"PASS: Application status endpoint works correctly")
    
    def test_pro_apply_unauthenticated(self):
        """Test POST /api/pro/apply fails without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/pro/apply",
            json={
                "full_name": "Test User",
                "country": "France",
                "languages": ["Français"],
                "main_expertise": "trading",
                "specializations": [],
                "years_experience": 2,
                "bio": "Test bio with enough characters.",
                "services_offered": ["mentoring"],
                "availability": "part_time"
            }
        )
        
        # Should return 401 or 403
        assert response.status_code in [401, 403]
        print(f"PASS: Unauthenticated request rejected")
