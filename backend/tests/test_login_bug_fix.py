"""
Test suite for Login Bug Fix - Issue: French-speaking user cannot log in
Tests cover:
1. POST /api/auth/login with valid credentials returns 200 and access_token
2. POST /api/auth/login with invalid password returns 401
3. POST /api/auth/login with captcha_token=null works (non-blocking CAPTCHA)
4. POST /api/auth/login with totp_code=null works for non-2FA user
5. POST /api/auth/register creates a new user and returns token
6. GET /api/auth/me with valid token returns user data
7. POST /api/auth/login with both captcha_token and totp_code as null works
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "jcuradeau.7@gmail.com"
USER_PASSWORD = "Crypto2026!"


class TestLoginEndpoint:
    """Login endpoint tests - Testing the bug fix for login issues"""
    
    def test_login_success_with_valid_credentials(self):
        """Test that login works with valid credentials (admin user)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "captcha_token": None,
                "totp_code": None
            }
        )
        print(f"Login response status: {response.status_code}")
        print(f"Login response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0
        
    def test_login_success_with_user_credentials(self):
        """Test that login works with another user's credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": USER_EMAIL,
                "password": USER_PASSWORD,
                "captcha_token": None,
                "totp_code": None
            }
        )
        print(f"User login response status: {response.status_code}")
        print(f"User login response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == USER_EMAIL

    def test_login_with_invalid_password(self):
        """Test that login returns 401 for invalid password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": "WrongPassword123!",
                "captcha_token": None,
                "totp_code": None
            }
        )
        print(f"Invalid password response status: {response.status_code}")
        print(f"Invalid password response: {response.json()}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain error detail"

    def test_login_with_invalid_email(self):
        """Test that login returns 401 for non-existent email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SomePassword123!",
                "captcha_token": None,
                "totp_code": None
            }
        )
        print(f"Invalid email response status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_login_with_captcha_null(self):
        """Test that login works when captcha_token is explicitly null (non-blocking CAPTCHA)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "captcha_token": None
            }
        )
        print(f"Captcha null response status: {response.status_code}")
        
        # Should succeed even without captcha (non-blocking mode)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data

    def test_login_with_totp_null_for_non_2fa_user(self):
        """Test that login works when totp_code is null for user without 2FA enabled"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "totp_code": None
            }
        )
        print(f"TOTP null response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data

    def test_login_without_optional_fields(self):
        """Test that login works with minimal payload (only email and password)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        print(f"Minimal payload response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data

    def test_login_with_both_captcha_and_totp_null(self):
        """Test that login works when both captcha_token and totp_code are null"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "captcha_token": None,
                "totp_code": None
            }
        )
        print(f"Both null response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data


class TestRegisterEndpoint:
    """Register endpoint tests"""
    
    def test_register_new_user(self):
        """Test that registration creates a new user and returns token"""
        unique_email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "TestPassword123!",
                "name": "Test User",
                "captcha_token": None
            }
        )
        print(f"Register response status: {response.status_code}")
        print(f"Register response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == unique_email
        assert data["user"]["name"] == "Test User"

    def test_register_duplicate_email(self):
        """Test that registration fails for duplicate email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": ADMIN_EMAIL,
                "password": "TestPassword123!",
                "name": "Test User",
                "captcha_token": None
            }
        )
        print(f"Duplicate email response status: {response.status_code}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestAuthMeEndpoint:
    """GET /api/auth/me endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")

    def test_get_me_with_valid_token(self, auth_token):
        """Test that /auth/me returns user data with valid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Get me response status: {response.status_code}")
        print(f"Get me response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert "email" in data, "Response should contain email"
        assert data["email"] == ADMIN_EMAIL

    def test_get_me_without_token(self):
        """Test that /auth/me returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        print(f"No token response status: {response.status_code}")
        
        # Should be 401 or 403 without authentication
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"

    def test_get_me_with_invalid_token(self):
        """Test that /auth/me returns 401 with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        print(f"Invalid token response status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
