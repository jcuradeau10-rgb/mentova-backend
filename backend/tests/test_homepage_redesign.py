"""
Backend API tests for CryptonAI Homepage Redesign
Tests: Login, News API, Crypto Prices, Global Stats
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "jcuradeau.7@gmail.com"
TEST_PASSWORD = "JacksoN12."


class TestAuthLogin:
    """Authentication and login tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["role"] == "super_admin"
        assert "progress" in data["user"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@email.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
    
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL}  # Missing password
        )
        assert response.status_code == 422  # Validation error


class TestNewsAPI:
    """News API endpoint tests"""
    
    def test_get_news_default(self):
        """Test getting news with default parameters"""
        response = requests.get(f"{BASE_URL}/api/news")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)
        assert len(data["data"]) > 0
        
        # Verify news item structure
        news_item = data["data"][0]
        assert "id" in news_item
        assert "title" in news_item
        assert "summary" in news_item
        assert "source" in news_item
        assert "category" in news_item
        assert "impact" in news_item
        assert "image_url" in news_item
        assert "published_at" in news_item
        assert "tags" in news_item
    
    def test_get_news_with_limit(self):
        """Test getting news with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 3})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["data"]) == 3
    
    def test_get_news_by_category(self):
        """Test filtering news by category"""
        response = requests.get(f"{BASE_URL}/api/news", params={"category": "macro"})
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        # All returned news should have 'macro' category
        for news_item in data["data"]:
            assert news_item["category"] == "macro"
    
    def test_get_news_categories_available(self):
        """Verify categories list is returned"""
        response = requests.get(f"{BASE_URL}/api/news")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        expected_categories = ["macro", "institutionnel", "technologie", "regulation", "securite", "analyse", "adoption"]
        for cat in expected_categories:
            assert cat in data["categories"]


class TestCryptoPricesAPI:
    """Crypto prices API tests"""
    
    def test_get_crypto_prices(self):
        """Test getting crypto prices"""
        response = requests.get(f"{BASE_URL}/api/crypto/prices")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)
        assert len(data["data"]) > 0
        
        # Verify crypto price structure
        crypto = data["data"][0]
        assert "id" in crypto
        assert "symbol" in crypto
        assert "name" in crypto
        assert "current_price" in crypto
        assert "image" in crypto
    
    def test_crypto_prices_contains_bitcoin(self):
        """Verify Bitcoin is in the prices"""
        response = requests.get(f"{BASE_URL}/api/crypto/prices")
        data = response.json()
        
        btc = next((c for c in data["data"] if c["symbol"] == "btc"), None)
        assert btc is not None
        assert btc["name"] == "Bitcoin"
        assert btc["current_price"] > 0
    
    def test_crypto_prices_contains_ethereum(self):
        """Verify Ethereum is in the prices"""
        response = requests.get(f"{BASE_URL}/api/crypto/prices")
        data = response.json()
        
        eth = next((c for c in data["data"] if c["symbol"] == "eth"), None)
        assert eth is not None
        assert eth["name"] == "Ethereum"
        assert eth["current_price"] > 0


class TestCryptoGlobalStats:
    """Global crypto stats API tests"""
    
    def test_get_global_stats(self):
        """Test getting global market stats"""
        response = requests.get(f"{BASE_URL}/api/crypto/global")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "data" in data


class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data


class TestMenuNavigation:
    """Tests for menu navigation destinations"""
    
    def test_market_route_api_exists(self):
        """Verify market-related API exists"""
        response = requests.get(f"{BASE_URL}/api/crypto/prices")
        assert response.status_code == 200
    
    def test_learn_route_api_exists(self):
        """Verify education API exists"""
        response = requests.get(f"{BASE_URL}/api/education/modules")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "data" in data
    
    def test_community_route_api_exists(self):
        """Verify community API exists"""
        response = requests.get(f"{BASE_URL}/api/community/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
    
    def test_admin_route_api_exists(self):
        """Verify admin API exists (requires auth)"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = login_response.json()["access_token"]
        
        # Test admin stats endpoint
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "data" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
