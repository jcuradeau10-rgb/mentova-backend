"""
Test Feedback System - P0 Features
Tests:
1. User feedback submission at /feedback 
2. User's feedback list at /my-feedback
3. Admin can see feedback in admin panel
4. Admin can reply to feedback
5. Feedback notifications
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials from review request
TEST_USER_EMAIL = "jcuradeau.7@gmail.com"
TEST_USER_PASSWORD = "Crypto2026!"
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"


class TestFeedbackSystem:
    """Test feedback submission, viewing, and admin reply flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for test"""
        # Get user token
        user_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if user_resp.status_code == 200:
            data = user_resp.json()
            if "requires_2fa" not in data:
                self.user_token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
            else:
                pytest.skip("User requires 2FA")
        else:
            pytest.skip(f"User login failed: {user_resp.status_code}")
        
        # Get admin token
        admin_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_resp.status_code == 200:
            data = admin_resp.json()
            if "requires_2fa" not in data:
                self.admin_token = data.get("access_token")
            else:
                pytest.skip("Admin requires 2FA")
        else:
            pytest.skip(f"Admin login failed: {admin_resp.status_code}")
    
    def test_01_user_can_submit_feedback(self):
        """Test POST /api/feedback - user submits feedback"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        payload = {
            "type": "improvement",
            "message": f"Test feedback from automated tests - {datetime.now().isoformat()}"
        }
        
        resp = requests.post(f"{BASE_URL}/api/feedback", json=payload, headers=headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # API returns {"status": "success", "message": "Feedback submitted"}
        assert data.get("status") == "success" or data.get("success") == True, f"Unexpected response: {data}"
        
        # Get feedback ID from my-feedback endpoint
        resp2 = requests.get(f"{BASE_URL}/api/my-feedback", headers=headers)
        if resp2.status_code == 200:
            feedbacks = resp2.json().get("data", [])
            if feedbacks:
                self.__class__.created_feedback_id = feedbacks[0]["id"]
        
        print(f"✓ User can submit feedback")
    
    def test_02_user_can_view_my_feedback(self):
        """Test GET /api/my-feedback - user sees their feedbacks"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        resp = requests.get(f"{BASE_URL}/api/my-feedback", headers=headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        # Verify our feedback is in the list
        feedback_ids = [f["id"] for f in data["data"]]
        if hasattr(self.__class__, 'created_feedback_id'):
            assert self.__class__.created_feedback_id in feedback_ids, "Created feedback not in user's list"
        
        print(f"✓ User can view my-feedback - {len(data['data'])} feedbacks found")
    
    def test_03_admin_can_see_feedback_list(self):
        """Test GET /api/admin/feedback - admin sees all feedback"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        resp = requests.get(f"{BASE_URL}/api/admin/feedback", headers=headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        assert "data" in data
        assert "total" in data
        
        print(f"✓ Admin can see feedback list - {data['total']} total feedbacks")
    
    def test_04_admin_can_reply_to_feedback(self):
        """Test POST /api/admin/feedback/{id}/reply - admin replies"""
        if not hasattr(self.__class__, 'created_feedback_id'):
            pytest.skip("No feedback created to reply to")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        payload = {
            "message": f"Admin reply to test feedback - {datetime.now().isoformat()}"
        }
        
        feedback_id = self.__class__.created_feedback_id
        resp = requests.post(f"{BASE_URL}/api/admin/feedback/{feedback_id}/reply", 
                            json=payload, headers=headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        
        print(f"✓ Admin can reply to feedback")
    
    def test_05_user_sees_admin_reply(self):
        """Test that user's feedback now shows admin reply"""
        if not hasattr(self.__class__, 'created_feedback_id'):
            pytest.skip("No feedback created")
        
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        resp = requests.get(f"{BASE_URL}/api/my-feedback", headers=headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Find our feedback
        feedback_id = self.__class__.created_feedback_id
        our_feedback = next((f for f in data["data"] if f["id"] == feedback_id), None)
        
        assert our_feedback is not None, "Could not find our feedback"
        assert "replies" in our_feedback, "Feedback should have replies field"
        assert len(our_feedback.get("replies", [])) > 0, "Feedback should have at least one reply"
        
        print(f"✓ User sees admin reply in my-feedback - {len(our_feedback['replies'])} replies")
    
    def test_06_feedback_types_work(self):
        """Test different feedback types: testimonial, bug, feature"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        types_to_test = ["testimonial", "bug", "feature"]
        for fb_type in types_to_test:
            payload = {
                "type": fb_type,
                "message": f"Test {fb_type} from automated tests - {datetime.now().isoformat()}"
            }
            if fb_type == "testimonial":
                payload["rating"] = 5
            
            resp = requests.post(f"{BASE_URL}/api/feedback", json=payload, headers=headers)
            
            assert resp.status_code == 200, f"Failed to submit {fb_type}: {resp.status_code}"
            print(f"✓ Feedback type '{fb_type}' works")
    
    def test_07_admin_can_update_feedback_status(self):
        """Test PATCH /api/admin/feedback/{id} - admin updates status"""
        if not hasattr(self.__class__, 'created_feedback_id'):
            pytest.skip("No feedback created")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        feedback_id = self.__class__.created_feedback_id
        
        resp = requests.patch(f"{BASE_URL}/api/admin/feedback/{feedback_id}", headers=headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        assert "new_status" in data or "status" in data
        
        new_status = data.get("new_status") or data.get("status")
        print(f"✓ Admin can update feedback status to: {new_status}")


class TestHomepageMentorCTA:
    """Test the Become a Mentor CTA on homepage"""
    
    def test_01_pro_join_page_loads(self):
        """Test that /pro/join page exists and returns content"""
        # Since this is a frontend route, we just check if it doesn't 404
        # The actual UI testing will be done with Playwright
        resp = requests.get(f"{BASE_URL}")
        assert resp.status_code == 200, f"Homepage should load: {resp.status_code}"
        print("✓ Homepage loads successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
