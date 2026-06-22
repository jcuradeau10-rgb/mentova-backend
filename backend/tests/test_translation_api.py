# Test for Translation API and Language Features
# Tests the /api/translate endpoint added for dynamic content translation

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

class TestTranslationAPI:
    """Tests for the /api/translate endpoint"""
    
    def test_translate_fr_to_en(self):
        """Test translating French text to English"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "texts": {"title": "Formation Trading"},
            "target_lang": "en",
            "source_lang": "fr"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "title" in data["data"]
        # The translated title should be in English
        translated = data["data"]["title"]
        print(f"Translated 'Formation Trading' to: '{translated}'")
        assert translated != "Formation Trading"  # Should be different from original
        
    def test_translate_same_language(self):
        """Test that same source and target language returns original text"""
        original_text = "Hello World"
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "texts": {"greeting": original_text},
            "target_lang": "fr",
            "source_lang": "fr"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["greeting"] == original_text
        
    def test_translate_multiple_texts(self):
        """Test translating multiple texts at once"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "texts": {
                "title": "Formation Trading",
                "description": "Apprenez à trader les cryptomonnaies",
                "bio": "Expert en blockchain"
            },
            "target_lang": "en",
            "source_lang": "fr"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "title" in data["data"]
        assert "description" in data["data"]
        assert "bio" in data["data"]
        print(f"Translated texts: {data['data']}")
        
    def test_translate_empty_text(self):
        """Test handling of empty text values"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "texts": {"empty": "", "valid": "Bonjour"},
            "target_lang": "en",
            "source_lang": "fr"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        # Empty string should remain empty
        assert data["data"]["empty"] == ""
        
    def test_translate_unsupported_language(self):
        """Test handling of unsupported target language"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "texts": {"title": "Hello"},
            "target_lang": "zh",  # Chinese not supported
            "source_lang": "en"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "error" in data


class TestPagesLoadWithoutErrors:
    """Test that main pages load without Server Errors"""
    
    def test_homepage_loads(self):
        """Test homepage loads"""
        response = requests.get(f"{BASE_URL}")
        assert response.status_code == 200
        assert "Server Error" not in response.text
        
    def test_marketplace_api(self):
        """Test marketplace API works"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        
    def test_professionals_api(self):
        """Test professionals/mentors API works"""
        response = requests.get(f"{BASE_URL}/api/pros")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert data["success"] == True


class TestAuthentication:
    """Test authentication flows"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for VIP user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "jcuradeau.7@gmail.com",
            "password": "Crypto2026!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("VIP user authentication failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin user authentication failed")
        
    def test_vip_user_login(self):
        """Test VIP user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "jcuradeau.7@gmail.com",
            "password": "Crypto2026!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"VIP user logged in: {data['user']['email']}")
        
    def test_admin_user_login(self):
        """Test admin user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Admin user logged in: {data['user']['email']}")
        
    def test_vip_status_check(self, auth_token):
        """Test VIP status endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "is_vip" in data
        print(f"VIP status: {data['is_vip']}")
