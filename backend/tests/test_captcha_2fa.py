"""
Test Suite for CAPTCHA, 2FA, and Biometric Authentication Features
Tests: reCAPTCHA verification, 2FA TOTP setup/verify/disable, biometric toggle
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test reCAPTCHA key (Google's test key - always passes)
TEST_CAPTCHA_TOKEN = "test_captcha_token"  # Test keys accept any token


class TestCaptcha:
    """Tests for reCAPTCHA on login and register"""
    
    def test_get_recaptcha_site_key(self):
        """Test recaptcha site key endpoint returns the test key"""
        response = requests.get(f"{BASE_URL}/api/auth/recaptcha-site-key")
        assert response.status_code == 200
        data = response.json()
        assert "site_key" in data
        # Test key should be the Google test key
        assert data["site_key"] == "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
        print(f"PASS: reCAPTCHA site key endpoint returns test key: {data['site_key']}")

    def test_login_without_captcha_fails(self):
        """Test that login without CAPTCHA token returns 400 error"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!"
        })
        assert response.status_code == 400
        data = response.json()
        assert "CAPTCHA is required" in data.get("detail", "")
        print(f"PASS: Login without CAPTCHA correctly returns 400: {data['detail']}")

    def test_register_without_captcha_fails(self):
        """Test that registration without CAPTCHA token returns 400 error"""
        import uuid
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPass123!",
            "name": "Test User"
        })
        assert response.status_code == 400
        data = response.json()
        assert "CAPTCHA is required" in data.get("detail", "")
        print(f"PASS: Register without CAPTCHA correctly returns 400: {data['detail']}")

    def test_login_with_captcha_succeeds(self):
        """Test that login WITH CAPTCHA token succeeds (test keys always pass)"""
        # Using Google's test secret key, any token passes verification
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!",
            "captcha_token": TEST_CAPTCHA_TOKEN
        })
        # Should succeed with test keys
        assert response.status_code == 200, f"Login failed: {response.json()}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "admin@cryptonai.com"
        print(f"PASS: Login with CAPTCHA token succeeds, user: {data['user']['email']}")
        return data["access_token"]


class Test2FA:
    """Tests for 2FA (TOTP) setup, verify, and disable"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!",
            "captcha_token": TEST_CAPTCHA_TOKEN
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_2fa_status_endpoint(self, auth_token):
        """Test 2FA status endpoint returns current status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/2fa/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "biometric_enabled" in data
        print(f"PASS: 2FA status endpoint works, enabled={data['enabled']}, biometric={data['biometric_enabled']}")
        return data["enabled"]

    def test_2fa_setup_returns_qr_code(self, auth_token):
        """Test 2FA setup endpoint returns QR code and secret"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First check if 2FA is already enabled
        status_response = requests.get(f"{BASE_URL}/api/auth/2fa/status", headers=headers)
        if status_response.json().get("enabled"):
            print("SKIP: 2FA already enabled for this user, skipping setup test")
            pytest.skip("2FA already enabled")
            return
        
        response = requests.post(f"{BASE_URL}/api/auth/2fa/setup", headers=headers)
        
        if response.status_code == 400 and "already enabled" in response.json().get("detail", "").lower():
            print("SKIP: 2FA already enabled, cannot test setup")
            pytest.skip("2FA already enabled")
            return
            
        assert response.status_code == 200, f"2FA setup failed: {response.json()}"
        data = response.json()
        
        assert "secret" in data
        assert "qr_code" in data
        assert "backup_codes" in data
        assert len(data["backup_codes"]) == 8
        assert data["qr_code"].startswith("data:image/png;base64,")
        
        print(f"PASS: 2FA setup returns QR code and secret, {len(data['backup_codes'])} backup codes")
        return data["secret"]

    def test_2fa_verify_setup_requires_valid_code(self, auth_token):
        """Test 2FA verify-setup requires valid TOTP code"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Try to verify with invalid code
        response = requests.post(f"{BASE_URL}/api/auth/2fa/verify-setup", 
            headers=headers, 
            json={"code": "000000"}
        )
        # Should fail - either no pending setup or invalid code
        # Status code could be 400 for invalid code or no pending setup
        assert response.status_code in [400, 401]
        print(f"PASS: 2FA verify-setup correctly rejects invalid code: {response.json()}")

    def test_2fa_disable_requires_password(self, auth_token):
        """Test 2FA disable endpoint requires correct password"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Try to disable with wrong password
        response = requests.post(f"{BASE_URL}/api/auth/2fa/disable", 
            headers=headers,
            json={"password": "WrongPassword123!"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "invalid password" in data.get("detail", "").lower()
        print(f"PASS: 2FA disable correctly rejects wrong password: {data['detail']}")


class TestBiometric:
    """Tests for biometric authentication toggle"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!",
            "captcha_token": TEST_CAPTCHA_TOKEN
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_biometric_toggle_on(self, auth_token):
        """Test biometric toggle endpoint can enable biometric"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/auth/biometric/toggle", 
            headers=headers,
            json={"enabled": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("biometric_enabled") == True
        print(f"PASS: Biometric toggle ON works: {data}")

    def test_biometric_toggle_off(self, auth_token):
        """Test biometric toggle endpoint can disable biometric"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/auth/biometric/toggle", 
            headers=headers,
            json={"enabled": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("biometric_enabled") == False
        print(f"PASS: Biometric toggle OFF works: {data}")

    def test_biometric_status_reflected_in_2fa_status(self, auth_token):
        """Test biometric status is reflected in 2FA status endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Toggle biometric on
        requests.post(f"{BASE_URL}/api/auth/biometric/toggle", 
            headers=headers, json={"enabled": True})
        
        # Check status
        response = requests.get(f"{BASE_URL}/api/auth/2fa/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "biometric_enabled" in data
        print(f"PASS: 2FA status includes biometric_enabled: {data['biometric_enabled']}")


class TestAdvancedAnalytics:
    """Test Analytics page doesn't crash"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!",
            "captcha_token": TEST_CAPTCHA_TOKEN
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_analytics_performance_endpoint(self, auth_token):
        """Test analytics performance endpoint works"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/pro/analytics/performance", headers=headers)
        assert response.status_code == 200
        print(f"PASS: Analytics performance endpoint works")
    
    def test_analytics_revenue_endpoint(self, auth_token):
        """Test analytics revenue endpoint works"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/pro/analytics/revenue?period=30d", headers=headers)
        assert response.status_code == 200
        print(f"PASS: Analytics revenue endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
