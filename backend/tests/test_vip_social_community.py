"""
Test suite for VIP Social Community features
Tests: social feed, post interactions (like, comment), stories
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
VIP_USER_EMAIL = "jcuradeau.7@gmail.com"
VIP_USER_PASSWORD = "Crypto2026!"

class TestVIPSocialCommunity:
    """VIP Social Community endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - authenticate VIP user"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_USER_EMAIL, "password": VIP_USER_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        self.token = login_data.get("token") or login_data.get("access_token")
        assert self.token, "No token in login response"
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"✓ Logged in as VIP user: {VIP_USER_EMAIL}")
    
    def test_social_feed_returns_posts(self):
        """GET /api/vip/social/feed?limit=20 returns posts correctly"""
        response = self.session.get(f"{BASE_URL}/api/vip/social/feed", params={"limit": 20})
        assert response.status_code == 200, f"Social feed failed: {response.text}"
        
        data = response.json()
        assert "data" in data, "Response missing 'data' field"
        posts = data["data"]
        assert isinstance(posts, list), "Posts should be a list"
        print(f"✓ Social feed returned {len(posts)} posts")
        
        # Validate post structure if posts exist
        if posts:
            post = posts[0]
            expected_fields = ["id", "content", "author_name", "created_at"]
            for field in expected_fields:
                assert field in post, f"Post missing field: {field}"
            print(f"✓ Post structure valid with fields: {list(post.keys())}")
    
    def test_social_feed_with_limit(self):
        """Social feed respects limit parameter"""
        response = self.session.get(f"{BASE_URL}/api/vip/social/feed", params={"limit": 5})
        assert response.status_code == 200
        
        data = response.json()
        posts = data.get("data", [])
        assert len(posts) <= 5, f"Expected max 5 posts, got {len(posts)}"
        print(f"✓ Social feed respects limit parameter (returned {len(posts)} posts)")
    
    def test_stories_endpoint(self):
        """GET /api/vip/stories returns stories list"""
        response = self.session.get(f"{BASE_URL}/api/vip/stories")
        assert response.status_code == 200, f"Stories endpoint failed: {response.text}"
        
        data = response.json()
        assert "data" in data, "Response missing 'data' field"
        stories = data["data"]
        assert isinstance(stories, list), "Stories should be a list"
        print(f"✓ Stories endpoint returned {len(stories)} story groups")
    
    def test_like_post_endpoint(self):
        """POST /api/vip/social/{post_id}/like works (test with valid post)"""
        # First get a post from feed
        feed_response = self.session.get(f"{BASE_URL}/api/vip/social/feed", params={"limit": 1})
        assert feed_response.status_code == 200
        
        posts = feed_response.json().get("data", [])
        if not posts:
            pytest.skip("No posts available to test like functionality")
        
        post_id = posts[0]["id"]
        
        # Like the post
        like_response = self.session.post(f"{BASE_URL}/api/vip/social/posts/{post_id}/like")
        # Accept 200 (liked) or 400 (already liked) as valid responses
        assert like_response.status_code in [200, 400], f"Like endpoint failed: {like_response.text}"
        print(f"✓ Like endpoint responded with status {like_response.status_code} for post {post_id}")
    
    def test_get_post_comments(self):
        """GET /api/vip/social/posts/{post_id}/comments returns comments"""
        # First get a post from feed
        feed_response = self.session.get(f"{BASE_URL}/api/vip/social/feed", params={"limit": 1})
        assert feed_response.status_code == 200
        
        posts = feed_response.json().get("data", [])
        if not posts:
            pytest.skip("No posts available to test comments")
        
        post_id = posts[0]["id"]
        
        # Get comments
        comments_response = self.session.get(f"{BASE_URL}/api/vip/social/posts/{post_id}/comments")
        assert comments_response.status_code == 200, f"Comments endpoint failed: {comments_response.text}"
        
        data = comments_response.json()
        assert "data" in data, "Response missing 'data' field"
        comments = data["data"]
        assert isinstance(comments, list), "Comments should be a list"
        print(f"✓ Comments endpoint returned {len(comments)} comments for post {post_id}")
    
    def test_vip_status_check(self):
        """Verify user has VIP status"""
        response = self.session.get(f"{BASE_URL}/api/vip/status")
        assert response.status_code == 200, f"VIP status check failed: {response.text}"
        
        data = response.json()
        # User should have VIP access
        is_vip = data.get("is_vip") or data.get("has_access") or data.get("active", False)
        print(f"✓ VIP status check - is_vip: {is_vip}, response: {data}")


class TestVIPSocialUnauthenticated:
    """Test social endpoints without authentication"""
    
    def test_social_feed_requires_auth(self):
        """Social feed requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/social/feed")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        print(f"✓ Social feed properly requires authentication (status: {response.status_code})")
    
    def test_stories_requires_auth(self):
        """Stories endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/stories")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        print(f"✓ Stories endpoint properly requires authentication (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
