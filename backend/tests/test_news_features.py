"""
CryptonAI News Features - Backend API Tests
Tests for /api/news, /api/news/trending, /api/news/flash endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

class TestNewsAPI:
    """Test /api/news endpoint - Main news listing with filters"""
    
    def test_get_news_success(self):
        """Test basic news retrieval"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 5})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success: true"
        assert "data" in data, "Expected 'data' field in response"
        assert isinstance(data["data"], list), "Expected 'data' to be a list"
        assert len(data["data"]) <= 5, "Expected max 5 items"
        
        # Validate news item structure
        if len(data["data"]) > 0:
            news_item = data["data"][0]
            required_fields = ["id", "title", "summary", "source", "category", "impact", "image_url", "published_at"]
            for field in required_fields:
                assert field in news_item, f"Missing field: {field}"
        
        print(f"✓ GET /api/news returned {len(data['data'])} news items")
    
    def test_get_news_with_category_macro(self):
        """Test news filtering by macro category"""
        response = requests.get(f"{BASE_URL}/api/news", params={"category": "macro", "limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        
        # Verify all returned items have the correct category
        for item in data["data"]:
            assert item.get("category") == "macro", f"Expected category 'macro', got '{item.get('category')}'"
        
        print(f"✓ GET /api/news?category=macro returned {len(data['data'])} macro news items")
    
    def test_get_news_with_category_technologie(self):
        """Test news filtering by technologie category"""
        response = requests.get(f"{BASE_URL}/api/news", params={"category": "technologie", "limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        
        for item in data["data"]:
            assert item.get("category") == "technologie", f"Expected category 'technologie', got '{item.get('category')}'"
        
        print(f"✓ GET /api/news?category=technologie returned {len(data['data'])} tech news items")
    
    def test_get_news_with_category_regulation(self):
        """Test news filtering by regulation category"""
        response = requests.get(f"{BASE_URL}/api/news", params={"category": "regulation", "limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        
        for item in data["data"]:
            assert item.get("category") == "regulation", f"Expected category 'regulation', got '{item.get('category')}'"
        
        print(f"✓ GET /api/news?category=regulation returned {len(data['data'])} regulation news items")
    
    def test_news_item_has_impact_field(self):
        """Test that news items have impact (bullish/bearish/neutral)"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 5})
        assert response.status_code == 200
        
        data = response.json()
        valid_impacts = ["bullish", "bearish", "neutral"]
        
        for item in data["data"]:
            assert "impact" in item, "News item missing 'impact' field"
            assert item["impact"] in valid_impacts, f"Invalid impact: {item['impact']}"
        
        print("✓ All news items have valid impact field (bullish/bearish/neutral)")
    
    def test_news_item_has_impact_reason(self):
        """Test that news items have impact_reason explanation"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 5})
        assert response.status_code == 200
        
        data = response.json()
        
        # At least some items should have impact_reason
        items_with_reason = [item for item in data["data"] if item.get("impact_reason")]
        assert len(items_with_reason) > 0, "Expected at least some items with impact_reason"
        
        print(f"✓ {len(items_with_reason)}/{len(data['data'])} news items have impact_reason")
    
    def test_news_pagination(self):
        """Test news pagination with skip and limit"""
        # Get first page
        response1 = requests.get(f"{BASE_URL}/api/news", params={"limit": 3, "skip": 0})
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Get second page
        response2 = requests.get(f"{BASE_URL}/api/news", params={"limit": 3, "skip": 3})
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Pages should have different content if total > 3
        if data1.get("total", 0) > 3 and len(data1["data"]) > 0 and len(data2["data"]) > 0:
            first_ids = [item["id"] for item in data1["data"]]
            second_ids = [item["id"] for item in data2["data"]]
            assert first_ids != second_ids, "Expected different items on different pages"
        
        print(f"✓ Pagination working: page 1 has {len(data1['data'])} items, page 2 has {len(data2['data'])} items")


class TestTrendingNewsAPI:
    """Test /api/news/trending endpoint - Top trending news"""
    
    def test_get_trending_news_success(self):
        """Test basic trending news retrieval"""
        response = requests.get(f"{BASE_URL}/api/news/trending")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success: true"
        assert "data" in data, "Expected 'data' field in response"
        assert isinstance(data["data"], list), "Expected 'data' to be a list"
        
        print(f"✓ GET /api/news/trending returned {len(data['data'])} trending items")
    
    def test_trending_news_structure(self):
        """Test trending news item structure"""
        response = requests.get(f"{BASE_URL}/api/news/trending")
        assert response.status_code == 200
        
        data = response.json()
        
        if len(data["data"]) > 0:
            item = data["data"][0]
            required_fields = ["id", "title", "summary", "source", "category", "impact"]
            for field in required_fields:
                assert field in item, f"Missing field: {field}"
            
            # Trending items should have views and trending_score
            assert "views" in item, "Trending item missing 'views' field"
            assert "trending_score" in item, "Trending item missing 'trending_score' field"
        
        print("✓ Trending news items have correct structure with views and trending_score")
    
    def test_trending_news_has_impact_reason(self):
        """Test that trending news items have impact_reason"""
        response = requests.get(f"{BASE_URL}/api/news/trending")
        assert response.status_code == 200
        
        data = response.json()
        
        for item in data["data"]:
            assert "impact_reason" in item, f"Trending item missing 'impact_reason'"
            assert len(item["impact_reason"]) > 0, "impact_reason should not be empty"
        
        print("✓ All trending news items have impact_reason")


class TestFlashNewsAPI:
    """Test /api/news/flash endpoint - Breaking news alerts"""
    
    def test_get_flash_news_success(self):
        """Test basic flash news retrieval"""
        response = requests.get(f"{BASE_URL}/api/news/flash")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success: true"
        assert "data" in data, "Expected 'data' field in response"
        assert isinstance(data["data"], list), "Expected 'data' to be a list"
        
        print(f"✓ GET /api/news/flash returned {len(data['data'])} flash news items")
    
    def test_flash_news_structure(self):
        """Test flash news item structure"""
        response = requests.get(f"{BASE_URL}/api/news/flash")
        assert response.status_code == 200
        
        data = response.json()
        
        if len(data["data"]) > 0:
            item = data["data"][0]
            required_fields = ["id", "type", "title", "timestamp", "impact", "icon"]
            for field in required_fields:
                assert field in item, f"Missing field: {field}"
            
            # Type should be one of the allowed values
            valid_types = ["breaking", "alert", "update", "news"]
            assert item["type"] in valid_types, f"Invalid type: {item['type']}"
        
        print("✓ Flash news items have correct structure with type and icon")
    
    def test_flash_news_has_impact(self):
        """Test that flash news items have valid impact"""
        response = requests.get(f"{BASE_URL}/api/news/flash")
        assert response.status_code == 200
        
        data = response.json()
        valid_impacts = ["bullish", "bearish", "neutral"]
        
        for item in data["data"]:
            assert "impact" in item, "Flash item missing 'impact'"
            assert item["impact"] in valid_impacts, f"Invalid impact: {item['impact']}"
        
        print("✓ All flash news items have valid impact (bullish/bearish/neutral)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
