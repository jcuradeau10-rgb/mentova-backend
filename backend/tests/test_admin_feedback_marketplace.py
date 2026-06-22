"""
Test Admin Feedback API and Marketplace pro_name fix
Features:
1. GET /api/admin/feedback - returns feedback list with total and new_count (admin only)
2. PATCH /api/admin/feedback/{id} - toggles feedback status (new->read->archived)
3. Admin feedback API returns 403 for non-admin users
4. Marketplace offers show pro_name (actual mentor name)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "jcuradeau.7@gmail.com"
USER_PASSWORD = "Crypto2026!"


@pytest.fixture
def admin_token():
    """Get admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Admin login failed: {response.text}")


@pytest.fixture
def user_token():
    """Get regular user token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"User login failed: {response.text}")


class TestAdminFeedbackAPI:
    """Test Admin Feedback API endpoints"""
    
    def test_get_feedback_requires_admin(self, user_token):
        """GET /api/admin/feedback should return 403 for non-admin users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/feedback",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # Regular user should get 403 Forbidden
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("PASS: Non-admin user correctly denied access to feedback API")

    def test_get_feedback_as_admin(self, admin_token):
        """GET /api/admin/feedback should return feedback list for admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/feedback",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have 'data' field"
        assert "total" in data, "Response should have 'total' field"
        assert "new_count" in data, "Response should have 'new_count' field"
        assert isinstance(data["data"], list), "'data' should be a list"
        
        print(f"PASS: Admin got feedback list with {len(data['data'])} items, total={data['total']}, new_count={data['new_count']}")

    def test_feedback_list_structure(self, admin_token):
        """Verify feedback items have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/admin/feedback",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        feedbacks = data.get("data", [])
        
        if len(feedbacks) > 0:
            feedback = feedbacks[0]
            expected_fields = ["id", "type", "message", "status", "created_at"]
            for field in expected_fields:
                assert field in feedback, f"Feedback should have '{field}' field"
            
            # Verify status is valid
            valid_statuses = ["new", "read", "archived"]
            assert feedback["status"] in valid_statuses, f"Invalid status: {feedback['status']}"
            
            # Verify type is valid
            valid_types = ["testimonial", "improvement", "bug", "feature"]
            assert feedback["type"] in valid_types, f"Invalid type: {feedback['type']}"
            
            print(f"PASS: Feedback structure verified - type={feedback['type']}, status={feedback['status']}")
        else:
            print("INFO: No feedback items found to verify structure")

    def test_patch_feedback_status_toggle(self, admin_token):
        """PATCH /api/admin/feedback/{id} should toggle status new->read->archived"""
        # First get list to find a feedback item
        response = requests.get(
            f"{BASE_URL}/api/admin/feedback",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        feedbacks = response.json().get("data", [])
        if len(feedbacks) == 0:
            pytest.skip("No feedback items available to test status toggle")
        
        # Find a 'new' feedback item to test
        new_feedbacks = [f for f in feedbacks if f.get("status") == "new"]
        if len(new_feedbacks) > 0:
            feedback_id = new_feedbacks[0]["id"]
            
            # Toggle from new -> read
            patch_response = requests.patch(
                f"{BASE_URL}/api/admin/feedback/{feedback_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert patch_response.status_code == 200, f"Expected 200, got {patch_response.status_code}"
            
            patch_data = patch_response.json()
            assert patch_data.get("success") == True
            assert patch_data.get("new_status") == "read", f"Expected new_status='read', got {patch_data.get('new_status')}"
            
            print("PASS: Feedback status toggled from new -> read")
            
            # Toggle again from read -> archived
            patch_response2 = requests.patch(
                f"{BASE_URL}/api/admin/feedback/{feedback_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert patch_response2.status_code == 200
            patch_data2 = patch_response2.json()
            assert patch_data2.get("new_status") == "archived", f"Expected 'archived', got {patch_data2.get('new_status')}"
            
            print("PASS: Feedback status toggled from read -> archived")
        else:
            # Test with a 'read' feedback
            read_feedbacks = [f for f in feedbacks if f.get("status") == "read"]
            if len(read_feedbacks) > 0:
                feedback_id = read_feedbacks[0]["id"]
                patch_response = requests.patch(
                    f"{BASE_URL}/api/admin/feedback/{feedback_id}",
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                assert patch_response.status_code == 200
                print("PASS: Feedback status toggled (read -> archived)")
            else:
                print("INFO: No 'new' or 'read' feedback items available for toggle test")

    def test_patch_feedback_not_found(self, admin_token):
        """PATCH /api/admin/feedback/{id} should return 404 for non-existent feedback"""
        fake_id = str(uuid.uuid4())
        response = requests.patch(
            f"{BASE_URL}/api/admin/feedback/{fake_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent feedback returns 404")

    def test_patch_feedback_requires_admin(self, user_token):
        """PATCH /api/admin/feedback/{id} should return 403 for non-admin"""
        response = requests.patch(
            f"{BASE_URL}/api/admin/feedback/some-id",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Non-admin correctly denied access to patch feedback")

    def test_filter_feedback_by_type(self, admin_token):
        """GET /api/admin/feedback?feedback_type=testimonial filters correctly"""
        response = requests.get(
            f"{BASE_URL}/api/admin/feedback?feedback_type=testimonial",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        feedbacks = data.get("data", [])
        
        # All returned feedbacks should be of type 'testimonial'
        for fb in feedbacks:
            assert fb.get("type") == "testimonial", f"Expected type 'testimonial', got {fb.get('type')}"
        
        print(f"PASS: Filter by type works - {len(feedbacks)} testimonials returned")

    def test_filter_feedback_by_status(self, admin_token):
        """GET /api/admin/feedback?status=new filters correctly"""
        response = requests.get(
            f"{BASE_URL}/api/admin/feedback?status=new",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        feedbacks = data.get("data", [])
        
        # All returned feedbacks should have status 'new'
        for fb in feedbacks:
            assert fb.get("status") == "new", f"Expected status 'new', got {fb.get('status')}"
        
        print(f"PASS: Filter by status works - {len(feedbacks)} new feedbacks returned")


class TestMarketplaceProName:
    """Test marketplace offers show actual mentor name (pro_name)"""

    def test_marketplace_offers_have_pro_name(self):
        """GET /api/marketplace/offers should include pro_name in each offer"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        
        offers = data.get("data", [])
        if len(offers) == 0:
            print("INFO: No marketplace offers available to verify pro_name")
            return
        
        for offer in offers:
            # Check that pro_name exists and is not generic 'Mentor'
            pro_name = offer.get("pro_name")
            assert pro_name is not None, f"Offer {offer.get('id')} missing pro_name"
            assert pro_name != "Mentor", f"Offer {offer.get('id')} has generic 'Mentor' instead of actual name"
            assert len(pro_name) > 0, f"Offer {offer.get('id')} has empty pro_name"
            print(f"  - Offer '{offer.get('title', 'N/A')[:30]}...' -> pro_name: {pro_name}")
        
        print(f"PASS: All {len(offers)} offers have proper pro_name values")

    def test_marketplace_offer_detail_has_pro_name(self):
        """GET /api/marketplace/offers/{id} should include pro_name in detail"""
        # First get list of offers
        list_response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        assert list_response.status_code == 200
        
        offers = list_response.json().get("data", [])
        if len(offers) == 0:
            pytest.skip("No marketplace offers available")
        
        # Get detail for first offer
        offer_id = offers[0]["id"]
        detail_response = requests.get(f"{BASE_URL}/api/marketplace/offers/{offer_id}")
        assert detail_response.status_code == 200, f"Expected 200, got {detail_response.status_code}"
        
        detail_data = detail_response.json()
        assert detail_data.get("success") == True
        
        offer_detail = detail_data.get("data", {})
        
        # Verify pro_name in detail view
        pro_name = offer_detail.get("pro_name")
        assert pro_name is not None, "Offer detail missing pro_name"
        assert pro_name != "Mentor", f"Detail view has generic 'Mentor' instead of actual name"
        
        # Also verify the pro object has the name
        pro = offer_detail.get("pro", {})
        assert pro.get("name") is not None, "Offer detail missing pro.name"
        assert pro.get("name") == pro_name, f"pro.name ({pro.get('name')}) should match pro_name ({pro_name})"
        
        print(f"PASS: Offer detail has pro_name: {pro_name}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
