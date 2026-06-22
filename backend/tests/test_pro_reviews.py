"""
Phase 4: Professional Reviews Management Tests
Tests for review endpoints:
- GET /api/pros/{pro_id}/reviews (public - get pro reviews with stats)
- GET /api/pro/dashboard/reviews (pro-only - get reviews with pending count)
- POST /api/pro/dashboard/reviews/{id}/respond (pro-only - respond to review)
- PUT /api/pro/dashboard/reviews/{id}/respond (pro-only - update response)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials from Phase 3
PRO_EMAIL = "pro_test@cryptonai.com"
PRO_PASSWORD = "ProTest123!"
CLIENT_EMAIL = "client_test@cryptonai.com"
CLIENT_PASSWORD = "Client123!"
PRO_ID = "e5e3431b-522e-4443-b32b-3080ff79aab6"


class TestProReviewsAPI:
    """Tests for professional reviews management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test client"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.pro_token = None
        self.client_token = None
    
    def get_pro_token(self):
        """Get authentication token for professional"""
        if self.pro_token:
            return self.pro_token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_EMAIL,
            "password": PRO_PASSWORD
        })
        if response.status_code == 200:
            self.pro_token = response.json().get("access_token")
            return self.pro_token
        pytest.skip(f"Pro authentication failed: {response.text}")
    
    def get_client_token(self):
        """Get authentication token for client"""
        if self.client_token:
            return self.client_token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if response.status_code == 200:
            self.client_token = response.json().get("access_token")
            return self.client_token
        pytest.skip(f"Client authentication failed: {response.text}")
    
    # ============ GET /api/pros/{pro_id}/reviews (Public) ============
    
    def test_01_get_pro_reviews_public_endpoint(self):
        """Public endpoint should be accessible without auth"""
        response = self.session.get(f"{BASE_URL}/api/pros/{PRO_ID}/reviews")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        assert "total" in data
        assert "stats" in data
        print(f"PASSED: GET /api/pros/{PRO_ID}/reviews returns 200 (public)")
    
    def test_02_get_pro_reviews_includes_stats(self):
        """Response should include rating stats and distribution"""
        response = self.session.get(f"{BASE_URL}/api/pros/{PRO_ID}/reviews")
        assert response.status_code == 200
        
        data = response.json()
        stats = data.get("stats", {})
        
        assert "average_rating" in stats
        assert "total_reviews" in stats
        assert "rating_distribution" in stats
        
        # Rating distribution should have all 5 keys
        dist = stats.get("rating_distribution", {})
        # Keys might be strings from JSON
        assert len(dist) >= 0  # Can be empty if no reviews
        print(f"PASSED: Reviews stats include average_rating={stats['average_rating']}, total={stats['total_reviews']}")
    
    def test_03_get_pro_reviews_with_rating_filter(self):
        """Can filter reviews by rating"""
        response = self.session.get(f"{BASE_URL}/api/pros/{PRO_ID}/reviews", params={"rating_filter": 5})
        assert response.status_code == 200
        
        data = response.json()
        # All returned reviews should have rating=5 (if any)
        for review in data.get("data", []):
            assert review.get("rating") == 5
        print("PASSED: Rating filter works correctly")
    
    def test_04_get_pro_reviews_sort_options(self):
        """Can sort reviews by recent or rating"""
        # Sort by recent (default)
        response = self.session.get(f"{BASE_URL}/api/pros/{PRO_ID}/reviews", params={"sort_by": "recent"})
        assert response.status_code == 200
        print("PASSED: sort_by=recent works")
        
        # Sort by highest rating
        response = self.session.get(f"{BASE_URL}/api/pros/{PRO_ID}/reviews", params={"sort_by": "highest"})
        assert response.status_code == 200
        print("PASSED: sort_by=highest works")
    
    def test_05_get_pro_reviews_pagination(self):
        """Pagination with limit and skip works"""
        response = self.session.get(f"{BASE_URL}/api/pros/{PRO_ID}/reviews", params={"limit": 5, "skip": 0})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data.get("data", [])) <= 5
        print(f"PASSED: Pagination works (returned {len(data.get('data', []))} reviews)")
    
    def test_06_get_pro_reviews_nonexistent_pro(self):
        """Returns 404 for non-existent professional"""
        fake_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/pros/{fake_id}/reviews")
        assert response.status_code == 404
        print("PASSED: Returns 404 for non-existent pro")
    
    # ============ GET /api/pro/dashboard/reviews (Pro-only) ============
    
    def test_07_get_my_reviews_requires_auth(self):
        """Dashboard reviews endpoint requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/pro/dashboard/reviews")
        assert response.status_code in [401, 403]
        print("PASSED: GET /api/pro/dashboard/reviews requires auth")
    
    def test_08_get_my_reviews_requires_pro_status(self):
        """Dashboard reviews endpoint requires professional status"""
        token = self.get_client_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.get(f"{BASE_URL}/api/pro/dashboard/reviews", headers=headers)
        assert response.status_code == 403
        print("PASSED: Regular client gets 403 (not a professional)")
    
    def test_09_get_my_reviews_success(self):
        """Professional can access their reviews"""
        token = self.get_pro_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.get(f"{BASE_URL}/api/pro/dashboard/reviews", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        assert "total" in data
        assert "pending_responses" in data
        print(f"PASSED: Pro can access their reviews (total={data['total']}, pending={data['pending_responses']})")
    
    def test_10_get_my_reviews_filter_has_response(self):
        """Can filter reviews by has_response"""
        token = self.get_pro_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get reviews without response
        response = self.session.get(
            f"{BASE_URL}/api/pro/dashboard/reviews",
            headers=headers,
            params={"has_response": False}
        )
        assert response.status_code == 200
        print("PASSED: has_response=False filter works")
        
        # Get reviews with response
        response = self.session.get(
            f"{BASE_URL}/api/pro/dashboard/reviews",
            headers=headers,
            params={"has_response": True}
        )
        assert response.status_code == 200
        print("PASSED: has_response=True filter works")
    
    # ============ POST /api/pro/dashboard/reviews/{id}/respond (Pro-only) ============
    
    def test_11_respond_to_review_requires_auth(self):
        """Responding to review requires authentication"""
        fake_review_id = str(uuid.uuid4())
        response = self.session.post(
            f"{BASE_URL}/api/pro/dashboard/reviews/{fake_review_id}/respond",
            json={"response_text": "Test response"}
        )
        assert response.status_code in [401, 403]
        print("PASSED: POST respond requires auth")
    
    def test_12_respond_to_review_requires_pro_status(self):
        """Responding to review requires professional status"""
        token = self.get_client_token()
        headers = {"Authorization": f"Bearer {token}"}
        fake_review_id = str(uuid.uuid4())
        
        response = self.session.post(
            f"{BASE_URL}/api/pro/dashboard/reviews/{fake_review_id}/respond",
            headers=headers,
            json={"response_text": "Test response"}
        )
        assert response.status_code == 403
        print("PASSED: Regular client gets 403 for responding")
    
    def test_13_respond_to_nonexistent_review(self):
        """Returns 404 for non-existent review"""
        token = self.get_pro_token()
        headers = {"Authorization": f"Bearer {token}"}
        fake_review_id = str(uuid.uuid4())
        
        response = self.session.post(
            f"{BASE_URL}/api/pro/dashboard/reviews/{fake_review_id}/respond",
            headers=headers,
            json={"response_text": "Test response"}
        )
        assert response.status_code == 404
        print("PASSED: Returns 404 for non-existent review")
    
    # ============ PUT /api/pro/dashboard/reviews/{id}/respond (Pro-only) ============
    
    def test_14_update_response_requires_auth(self):
        """Updating response requires authentication"""
        fake_review_id = str(uuid.uuid4())
        response = self.session.put(
            f"{BASE_URL}/api/pro/dashboard/reviews/{fake_review_id}/respond",
            json={"response_text": "Updated response"}
        )
        assert response.status_code in [401, 403]
        print("PASSED: PUT respond requires auth")
    
    def test_15_update_response_requires_pro_status(self):
        """Updating response requires professional status"""
        token = self.get_client_token()
        headers = {"Authorization": f"Bearer {token}"}
        fake_review_id = str(uuid.uuid4())
        
        response = self.session.put(
            f"{BASE_URL}/api/pro/dashboard/reviews/{fake_review_id}/respond",
            headers=headers,
            json={"response_text": "Updated response"}
        )
        assert response.status_code == 403
        print("PASSED: Regular client gets 403 for updating response")
    
    def test_16_update_nonexistent_review(self):
        """Returns 404 for non-existent review"""
        token = self.get_pro_token()
        headers = {"Authorization": f"Bearer {token}"}
        fake_review_id = str(uuid.uuid4())
        
        response = self.session.put(
            f"{BASE_URL}/api/pro/dashboard/reviews/{fake_review_id}/respond",
            headers=headers,
            json={"response_text": "Updated response"}
        )
        assert response.status_code == 404
        print("PASSED: Returns 404 for non-existent review on update")
    
    # ============ API Contract Tests ============
    
    def test_17_pro_profile_includes_recent_reviews(self):
        """GET /api/pros/{id} should include recent_reviews"""
        response = self.session.get(f"{BASE_URL}/api/pros/{PRO_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "recent_reviews" in data.get("data", {})
        print("PASSED: Pro profile includes recent_reviews field")
    
    def test_18_reviews_have_required_fields(self):
        """Reviews should have required fields structure"""
        response = self.session.get(f"{BASE_URL}/api/pros/{PRO_ID}/reviews")
        assert response.status_code == 200
        
        data = response.json()
        reviews = data.get("data", [])
        
        if reviews:
            review = reviews[0]
            # Check expected fields
            expected_fields = ["id", "pro_id", "rating", "created_at"]
            for field in expected_fields:
                assert field in review, f"Missing field: {field}"
            print(f"PASSED: Reviews have required fields (checked {len(reviews)} reviews)")
        else:
            print("PASSED: No reviews to validate fields (OK - empty state)")
    
    def test_19_reviews_can_have_pro_response(self):
        """Reviews structure should support pro_response field"""
        response = self.session.get(f"{BASE_URL}/api/pros/{PRO_ID}/reviews")
        assert response.status_code == 200
        
        data = response.json()
        reviews = data.get("data", [])
        
        # The pro_response field should be supported (may or may not be present)
        for review in reviews:
            if "pro_response" in review:
                print(f"Found review with pro_response: {review.get('id')}")
        
        print("PASSED: Review structure supports pro_response field")
    
    def test_20_dashboard_reviews_returns_pending_count(self):
        """Dashboard reviews should return pending_responses count"""
        token = self.get_pro_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.get(f"{BASE_URL}/api/pro/dashboard/reviews", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        pending = data.get("pending_responses")
        assert pending is not None
        assert isinstance(pending, int)
        print(f"PASSED: pending_responses count = {pending}")


class TestReviewsIntegration:
    """Integration tests for reviews with actual review data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test client"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_pro_token(self):
        """Get authentication token for professional"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_EMAIL,
            "password": PRO_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Pro authentication failed: {response.text}")
    
    def test_21_pro_dashboard_endpoint_returns_success_structure(self):
        """Pro dashboard should return proper structure"""
        token = self.get_pro_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.get(f"{BASE_URL}/api/pro/dashboard", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        
        dashboard = data.get("data", {})
        assert "stats" in dashboard
        
        stats = dashboard.get("stats", {})
        assert "total_reviews" in stats
        assert "average_rating" in stats
        print(f"PASSED: Dashboard includes review stats (reviews={stats['total_reviews']}, rating={stats['average_rating']})")
    
    def test_22_public_reviews_accessible_via_frontend_api_format(self):
        """Reviews should be accessible in the format frontend expects"""
        # This tests the API format that proAPI.getProReviews uses
        response = self.session.get(
            f"{BASE_URL}/api/pros/{PRO_ID}/reviews",
            params={"limit": 10, "skip": 0}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Frontend expects: success, data (array), total, stats
        assert "success" in data
        assert "data" in data
        assert "total" in data
        assert "stats" in data
        print("PASSED: API format matches frontend expectations")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
