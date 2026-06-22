"""
CryptonAI News Real-Time Features - Backend API Tests
Tests for news with 25 article limit and real-time indicators
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')


class TestNewsEndpoint25Articles:
    """Test /api/news endpoint returns exactly 25 articles (live + mock supplement)"""
    
    def test_news_returns_25_articles(self):
        """Test GET /api/news?limit=25 returns exactly 25 articles"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 25})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success: true"
        assert "data" in data, "Expected 'data' field in response"
        
        articles = data["data"]
        assert len(articles) == 25, f"Expected exactly 25 articles, got {len(articles)}"
        
        print(f"✓ GET /api/news?limit=25 returns exactly 25 articles")
    
    def test_news_returns_success_true(self):
        """Test GET /api/news returns success: true"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True, "Expected success: true"
        
        print("✓ GET /api/news returns success: true")
    
    def test_news_returns_data_array(self):
        """Test GET /api/news returns data as array"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data.get("data"), list), "Expected 'data' to be a list"
        
        print("✓ GET /api/news returns data as array")
    
    def test_news_includes_source_info(self):
        """Test news response includes source info (newsdata.io or mock)"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        assert "source" in data, "Expected 'source' field in response"
        assert data["source"] in ["newsdata.io", "mock"], f"Unexpected source: {data['source']}"
        
        print(f"✓ News source: {data['source']}")
    
    def test_news_total_count(self):
        """Test news response includes total count >= 25"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        assert "total" in data, "Expected 'total' field in response"
        assert data["total"] >= 25, f"Expected total >= 25, got {data['total']}"
        
        print(f"✓ Total articles available: {data['total']}")


class TestNewsArticleStructure:
    """Test individual news article structure"""
    
    def test_article_has_required_fields(self):
        """Test each article has required fields for display"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 5})
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["id", "title", "summary", "source", "category", "impact", "image_url", "published_at"]
        
        for article in data["data"]:
            for field in required_fields:
                assert field in article, f"Missing required field: {field}"
        
        print("✓ All articles have required fields")
    
    def test_article_category_is_valid(self):
        """Test article categories are from valid list"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        valid_categories = ["macro", "institutionnel", "technologie", "regulation", "securite", "analyse", "adoption", "general"]
        
        for article in data["data"]:
            category = article.get("category")
            assert category in valid_categories, f"Invalid category: {category}"
        
        print("✓ All article categories are valid")
    
    def test_article_impact_is_valid(self):
        """Test article impact values are bullish/bearish/neutral"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        valid_impacts = ["bullish", "bearish", "neutral"]
        
        for article in data["data"]:
            impact = article.get("impact")
            assert impact in valid_impacts, f"Invalid impact: {impact}"
        
        print("✓ All article impacts are valid (bullish/bearish/neutral)")


class TestNewsCategoryFilters:
    """Test news category filtering"""
    
    def test_filter_by_macro(self):
        """Test filtering by macro category"""
        response = requests.get(f"{BASE_URL}/api/news", params={"category": "macro", "limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        
        # All returned articles should be in macro category
        for article in data["data"]:
            assert article.get("category") == "macro", f"Expected macro, got {article.get('category')}"
        
        print(f"✓ Macro filter returns {len(data['data'])} articles")
    
    def test_filter_by_technologie(self):
        """Test filtering by technologie (Tech) category"""
        response = requests.get(f"{BASE_URL}/api/news", params={"category": "technologie", "limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        
        for article in data["data"]:
            assert article.get("category") == "technologie"
        
        print(f"✓ Technologie filter returns {len(data['data'])} articles")
    
    def test_filter_by_institutionnel(self):
        """Test filtering by institutionnel category"""
        response = requests.get(f"{BASE_URL}/api/news", params={"category": "institutionnel", "limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        
        print(f"✓ Institutionnel filter returns {len(data['data'])} articles")
    
    def test_filter_by_securite(self):
        """Test filtering by securite (Security) category"""
        response = requests.get(f"{BASE_URL}/api/news", params={"category": "securite", "limit": 25})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        
        print(f"✓ Securite filter returns {len(data['data'])} articles")


class TestLoginAfterFix:
    """Test login still works after P0 fix"""
    
    def test_login_with_admin_credentials(self):
        """Test POST /api/auth/login with valid admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "access_token" in data, "Expected access_token in response"
        assert "user" in data, "Expected user in response"
        assert data["user"]["email"] == "admin@cryptonai.com"
        
        print("✓ Login with admin credentials works")
    
    def test_login_without_captcha(self):
        """Test login works without captcha token (non-blocking)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!",
            "captcha_token": None
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "access_token" in data
        
        print("✓ Login without captcha works (non-blocking captcha)")
    
    def test_login_with_invalid_password(self):
        """Test login fails with invalid password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "WrongPassword!"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✓ Login with wrong password returns 401")


class TestTrendingAndFlashNews:
    """Test supporting news endpoints"""
    
    def test_trending_news_endpoint(self):
        """Test /api/news/trending returns trending articles"""
        response = requests.get(f"{BASE_URL}/api/news/trending")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert isinstance(data.get("data"), list)
        
        print(f"✓ Trending news returns {len(data['data'])} articles")
    
    def test_flash_news_endpoint(self):
        """Test /api/news/flash returns flash/breaking news"""
        response = requests.get(f"{BASE_URL}/api/news/flash")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert isinstance(data.get("data"), list)
        
        print(f"✓ Flash news returns {len(data['data'])} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
