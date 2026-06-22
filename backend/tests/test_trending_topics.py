"""
Test Suite for VIP Social Trending Topics Feature
Tests the new trending topics endpoint and social feed topic filter
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials for VIP user
TEST_EMAIL = "jcuradeau.7@gmail.com"
TEST_PASSWORD = "Crypto2026!"

class TestTrendingTopics:
    """Test trending topics endpoint and feed filtering"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for VIP user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "access_token not in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_trending_topics_endpoint(self, headers):
        """Test GET /api/vip/social/trending returns trending topics"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/trending",
            headers=headers
        )
        assert response.status_code == 200, f"Trending topics failed: {response.text}"
        
        data = response.json()
        assert data["success"] is True, "Response success should be True"
        assert "data" in data, "Response should have data field"
        
        topics = data["data"]
        assert isinstance(topics, list), "Topics should be a list"
        assert len(topics) > 0, "Should have at least some trending topics"
        
        # Check structure of each topic
        for topic in topics:
            assert "symbol" in topic, f"Topic should have symbol: {topic}"
            assert "count" in topic, f"Topic should have count: {topic}"
            assert "display" in topic, f"Topic should have display: {topic}"
            assert topic["display"].startswith("$"), f"Display should start with $: {topic['display']}"
    
    def test_trending_topics_has_expected_symbols(self, headers):
        """Test that trending topics include expected default symbols"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/trending",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        symbols = [t["symbol"] for t in data["data"]]
        
        # Should have at least some of the default symbols
        default_symbols = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA"]
        found_defaults = [s for s in default_symbols if s in symbols]
        assert len(found_defaults) >= 4, f"Should have at least 4 default symbols, got: {found_defaults}"
    
    def test_social_feed_without_topic(self, headers):
        """Test GET /api/vip/social/feed without topic filter returns all posts"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/feed",
            headers=headers,
            params={"limit": 20}
        )
        assert response.status_code == 200, f"Social feed failed: {response.text}"
        
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert "total" in data
    
    def test_social_feed_with_topic_btc(self, headers):
        """Test GET /api/vip/social/feed?topic=BTC returns only BTC posts"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/feed",
            headers=headers,
            params={"limit": 20, "topic": "BTC"}
        )
        assert response.status_code == 200, f"Social feed with BTC filter failed: {response.text}"
        
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        
        posts = data["data"]
        # All returned posts should have BTC in crypto_mentions or content
        for post in posts:
            has_btc_mention = "BTC" in post.get("crypto_mentions", [])
            has_btc_content = "$BTC" in post.get("content", "").upper() or "BTC" in post.get("content", "").upper()
            assert has_btc_mention or has_btc_content, f"Post should mention BTC: {post}"
    
    def test_social_feed_with_topic_eth(self, headers):
        """Test GET /api/vip/social/feed?topic=ETH returns only ETH posts"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/feed",
            headers=headers,
            params={"limit": 20, "topic": "ETH"}
        )
        assert response.status_code == 200, f"Social feed with ETH filter failed: {response.text}"
        
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        
        posts = data["data"]
        # All returned posts should have ETH in crypto_mentions or content
        for post in posts:
            has_eth_mention = "ETH" in post.get("crypto_mentions", [])
            has_eth_content = "$ETH" in post.get("content", "").upper() or "ETH" in post.get("content", "").upper()
            assert has_eth_mention or has_eth_content, f"Post should mention ETH: {post}"
    
    def test_social_feed_case_insensitive_topic(self, headers):
        """Test that topic filter works with lowercase input"""
        response_lower = requests.get(
            f"{BASE_URL}/api/vip/social/feed",
            headers=headers,
            params={"limit": 20, "topic": "btc"}
        )
        response_upper = requests.get(
            f"{BASE_URL}/api/vip/social/feed",
            headers=headers,
            params={"limit": 20, "topic": "BTC"}
        )
        
        assert response_lower.status_code == 200
        assert response_upper.status_code == 200
        
        # Both should return similar results
        data_lower = response_lower.json()
        data_upper = response_upper.json()
        
        # Total counts should match
        assert data_lower["total"] == data_upper["total"], "Case-insensitive filter should return same total"
    
    def test_trending_unauthenticated_rejected(self):
        """Test that unauthenticated requests are rejected for trending endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/social/trending")
        assert response.status_code in [401, 403], f"Unauthenticated should be rejected: {response.status_code}"
    
    def test_feed_unauthenticated_rejected(self):
        """Test that unauthenticated requests are rejected for feed endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/social/feed")
        assert response.status_code in [401, 403], f"Unauthenticated should be rejected: {response.status_code}"


class TestFeedResponseStructure:
    """Test social feed response structure"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for VIP user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_post_structure(self, headers):
        """Test that posts have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/feed",
            headers=headers,
            params={"limit": 5}
        )
        assert response.status_code == 200
        
        posts = response.json()["data"]
        if len(posts) > 0:
            post = posts[0]
            required_fields = ["id", "author_id", "author_name", "content", "likes", "created_at", "is_liked"]
            for field in required_fields:
                assert field in post, f"Post should have {field} field"
            
            # Check crypto_mentions is an array
            assert isinstance(post.get("crypto_mentions", []), list), "crypto_mentions should be a list"
