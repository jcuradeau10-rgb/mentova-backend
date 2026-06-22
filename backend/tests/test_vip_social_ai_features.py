"""
Test Suite for VIP Social and AI Features
Tests:
- POST /api/vip/social/posts/create - Create posts with optional images
- GET /api/vip/social/feed/enhanced - Enhanced feed with images and crypto mentions
- POST /api/vip/ai/analyze-image - Image analysis with GPT-4o Vision
- GET /api/vip/social/posts/{post_id}/comments - Get post comments
- POST /api/vip/social/posts/{post_id}/comments - Add comment to post
"""

import pytest
import requests
import os
import base64
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
VIP_USER_EMAIL = "admin@cryptonai.com"
VIP_USER_PASSWORD = "Admin123!"

# Simple test image (1x1 red pixel PNG)
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="


@pytest.fixture(scope="module")
def auth_token():
    """Get VIP auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": VIP_USER_EMAIL,
        "password": VIP_USER_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, f"No access_token in response: {data}"
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for requests"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestVIPAuthentication:
    """Test that VIP user can authenticate"""
    
    def test_login_success(self):
        """Test VIP user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("is_vip") == True, "User should be VIP"
        print(f"Login success: VIP user {data['user'].get('email')}, is_vip={data['user'].get('is_vip')}")


class TestCreateSocialPostWithImage:
    """Test POST /api/vip/social/posts/create"""
    
    def test_create_post_without_image(self, auth_headers):
        """Test creating a post without image"""
        post_data = {
            "content": f"Test post sans image - {uuid.uuid4().hex[:8]}",
            "crypto_mentions": ["BTC", "ETH"]
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/create",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert "id" in data["data"]
        print(f"Created post without image: {data['data']['id']}")
        return data["data"]["id"]
    
    def test_create_post_with_image(self, auth_headers):
        """Test creating a post with image"""
        post_data = {
            "content": f"Test post avec image - {uuid.uuid4().hex[:8]}",
            "image_base64": TEST_IMAGE_BASE64,
            "crypto_mentions": ["BTC", "SOL", "DOGE"]
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/create",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert "id" in data["data"]
        print(f"Created post with image: {data['data']['id']}")
        return data["data"]["id"]
    
    def test_create_post_empty_content(self, auth_headers):
        """Test creating a post with empty content - should work or fail gracefully"""
        post_data = {
            "content": "",
            "crypto_mentions": []
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/create",
            json=post_data,
            headers=auth_headers
        )
        # Empty content might be allowed or rejected - just verify consistent response
        print(f"Empty content response: status={response.status_code}")
    
    def test_create_post_long_content(self, auth_headers):
        """Test creating a post with content over 1000 chars - should fail"""
        long_content = "X" * 1001
        post_data = {
            "content": long_content,
            "crypto_mentions": []
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/create",
            json=post_data,
            headers=auth_headers
        )
        # Should return 400 for content too long
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Long content correctly rejected with 400")
    
    def test_create_post_without_auth(self):
        """Test creating post without authentication - should fail"""
        post_data = {
            "content": "Test sans auth",
            "crypto_mentions": []
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/create",
            json=post_data
        )
        # Should return 401/403 for no auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Unauthenticated request correctly rejected")


class TestEnhancedSocialFeed:
    """Test GET /api/vip/social/feed/enhanced"""
    
    def test_get_enhanced_feed(self, auth_headers):
        """Test getting enhanced social feed"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/feed/enhanced",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert "pagination" in data
        
        # Check pagination structure
        pagination = data["pagination"]
        assert "total" in pagination
        assert "skip" in pagination
        assert "limit" in pagination
        assert "has_more" in pagination
        
        print(f"Enhanced feed: {len(data['data'])} posts, total={pagination['total']}")
        
        # Check post structure if any posts exist
        if data["data"]:
            post = data["data"][0]
            required_fields = ["id", "author_name", "content", "likes", "comments_count", "created_at"]
            for field in required_fields:
                assert field in post, f"Missing field: {field}"
            print(f"First post has all required fields: {list(post.keys())}")
    
    def test_get_enhanced_feed_with_pagination(self, auth_headers):
        """Test enhanced feed with pagination params"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/feed/enhanced",
            params={"skip": 0, "limit": 5},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert len(data["data"]) <= 5, "Should respect limit parameter"
        print(f"Paginated feed: {len(data['data'])} posts (limit=5)")
    
    def test_enhanced_feed_contains_image_data(self, auth_headers):
        """Test that enhanced feed includes image-related fields"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/feed/enhanced",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["data"]:
            post = data["data"][0]
            # Check for image-related fields
            assert "has_image" in post, "Missing has_image field"
            assert "crypto_mentions" in post, "Missing crypto_mentions field"
            assert "is_liked" in post, "Missing is_liked field"
            print(f"Post has image fields: has_image={post.get('has_image')}, crypto_mentions={post.get('crypto_mentions')}")
    
    def test_enhanced_feed_without_auth(self):
        """Test enhanced feed without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/vip/social/feed/enhanced")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Enhanced feed correctly requires auth")


class TestAIImageAnalysis:
    """Test POST /api/vip/ai/analyze-image with GPT-4o Vision"""
    
    def test_analyze_image_basic(self, auth_headers):
        """Test basic image analysis"""
        request_data = {
            "query": "Que vois-tu dans cette image?",
            "image_base64": TEST_IMAGE_BASE64,
            "analysis_type": "general"
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/ai/analyze-image",
            json=request_data,
            headers=auth_headers,
            timeout=60  # AI calls can be slow
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert "analysis" in data["data"]
        assert len(data["data"]["analysis"]) > 0, "Analysis should not be empty"
        print(f"AI Analysis response length: {len(data['data']['analysis'])} chars")
        print(f"Analysis preview: {data['data']['analysis'][:200]}...")
    
    def test_analyze_image_chart_analysis(self, auth_headers):
        """Test chart analysis type"""
        request_data = {
            "query": "Analyse ce graphique et donne-moi tes observations",
            "image_base64": TEST_IMAGE_BASE64,
            "analysis_type": "chart"
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/ai/analyze-image",
            json=request_data,
            headers=auth_headers,
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data["data"].get("analysis_type") == "chart"
        print(f"Chart analysis type verified: {data['data'].get('analysis_type')}")
    
    def test_analyze_image_without_auth(self):
        """Test image analysis without auth - should fail"""
        request_data = {
            "query": "Test",
            "image_base64": TEST_IMAGE_BASE64
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/ai/analyze-image",
            json=request_data,
            timeout=30
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Image analysis correctly requires VIP auth")
    
    def test_analyze_image_missing_fields(self, auth_headers):
        """Test image analysis with missing fields"""
        # Missing image_base64
        request_data = {
            "query": "Test query"
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/ai/analyze-image",
            json=request_data,
            headers=auth_headers
        )
        # Should return 422 for validation error
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"
        print("Missing image_base64 correctly rejected with 422")


class TestPostComments:
    """Test comment endpoints"""
    
    @pytest.fixture
    def test_post_id(self, auth_headers):
        """Create a test post and return its ID"""
        post_data = {
            "content": f"Post for comments test - {uuid.uuid4().hex[:8]}",
            "crypto_mentions": ["BTC"]
        }
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/create",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        return response.json()["data"]["id"]
    
    def test_get_comments_empty(self, auth_headers, test_post_id):
        """Test getting comments from new post (should be empty)"""
        response = requests.get(
            f"{BASE_URL}/api/vip/social/posts/{test_post_id}/comments",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"New post has {len(data['data'])} comments (expected 0 or more)")
    
    def test_add_comment_to_post(self, auth_headers, test_post_id):
        """Test adding a comment to a post"""
        comment_text = f"Test comment - {uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/{test_post_id}/comments",
            params={"content": comment_text},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert data["data"].get("content") == comment_text
        print(f"Added comment: {data['data'].get('id')}")
        return data["data"]["id"]
    
    def test_get_comments_after_adding(self, auth_headers, test_post_id):
        """Test getting comments after adding one"""
        # Add a comment first
        comment_text = f"Verification comment - {uuid.uuid4().hex[:8]}"
        requests.post(
            f"{BASE_URL}/api/vip/social/posts/{test_post_id}/comments",
            params={"content": comment_text},
            headers=auth_headers
        )
        
        # Get comments
        response = requests.get(
            f"{BASE_URL}/api/vip/social/posts/{test_post_id}/comments",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) >= 1, "Should have at least 1 comment"
        
        # Verify comment structure
        comment = data["data"][-1]  # Get last comment
        assert "id" in comment
        assert "author_name" in comment
        assert "content" in comment
        assert "created_at" in comment
        print(f"Got {len(data['data'])} comments with proper structure")
    
    def test_comment_on_nonexistent_post(self, auth_headers):
        """Test commenting on non-existent post - should fail"""
        fake_post_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/{fake_post_id}/comments",
            params={"content": "Test comment"},
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Comment on non-existent post correctly rejected with 404")
    
    def test_comments_without_auth(self, test_post_id):
        """Test comments without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/vip/social/posts/{test_post_id}/comments")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Comments endpoint correctly requires auth")


class TestIntegrationFlow:
    """Test complete integration flow"""
    
    def test_full_social_flow(self, auth_headers):
        """Test complete flow: create post -> get feed -> add comment -> verify"""
        # 1. Create a post with image
        post_content = f"Integration test post - {uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/create",
            json={
                "content": post_content,
                "image_base64": TEST_IMAGE_BASE64,
                "crypto_mentions": ["ETH", "SOL"]
            },
            headers=auth_headers
        )
        assert create_response.status_code == 200
        post_id = create_response.json()["data"]["id"]
        print(f"1. Created post: {post_id}")
        
        # 2. Get enhanced feed and verify post exists
        feed_response = requests.get(
            f"{BASE_URL}/api/vip/social/feed/enhanced",
            headers=auth_headers
        )
        assert feed_response.status_code == 200
        feed_data = feed_response.json()
        post_ids_in_feed = [p["id"] for p in feed_data["data"]]
        assert post_id in post_ids_in_feed, "New post should appear in feed"
        
        # Verify post data
        our_post = next(p for p in feed_data["data"] if p["id"] == post_id)
        assert our_post["has_image"] == True, "Post should have image flag"
        assert "ETH" in our_post.get("crypto_mentions", []), "Crypto mentions should be preserved"
        print(f"2. Verified post in feed with has_image={our_post['has_image']}")
        
        # 3. Add comment to post
        comment_content = "Great post!"
        comment_response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/{post_id}/comments",
            params={"content": comment_content},
            headers=auth_headers
        )
        assert comment_response.status_code == 200
        comment_id = comment_response.json()["data"]["id"]
        print(f"3. Added comment: {comment_id}")
        
        # 4. Get comments and verify
        comments_response = requests.get(
            f"{BASE_URL}/api/vip/social/posts/{post_id}/comments",
            headers=auth_headers
        )
        assert comments_response.status_code == 200
        comments = comments_response.json()["data"]
        comment_ids = [c["id"] for c in comments]
        assert comment_id in comment_ids, "New comment should appear in comments list"
        print(f"4. Verified comment in comments list ({len(comments)} total)")
        
        print("Full social flow PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
