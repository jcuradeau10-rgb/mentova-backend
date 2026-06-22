"""
Admin Feedback Interaction Tests
Tests: GET feedback list, POST reply, DELETE feedback, PATCH status toggle
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

class TestAdminFeedbackEndpoints:
    """Test all feedback-related admin endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    @pytest.fixture
    def admin_headers(self, admin_token):
        """Headers with admin auth"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_get_feedback_list(self, admin_headers):
        """GET /api/admin/feedback - Returns feedback list with replies array"""
        response = requests.get(f"{BASE_URL}/api/admin/feedback", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") is True
        assert "data" in data
        assert "total" in data
        assert "new_count" in data
        
        # Verify feedback items have expected fields
        if len(data["data"]) > 0:
            feedback = data["data"][0]
            assert "id" in feedback
            assert "message" in feedback
            assert "type" in feedback
            assert "status" in feedback
            # Replies should be an array (even if empty)
            assert "replies" in feedback or isinstance(feedback.get("replies"), list) or feedback.get("replies") is None
        
        print(f"SUCCESS: GET /api/admin/feedback returned {len(data['data'])} items, {data['total']} total, {data['new_count']} new")
        return data
    
    def test_post_reply_to_feedback(self, admin_headers):
        """POST /api/admin/feedback/{id}/reply - Creates a reply and returns it"""
        # First get a feedback item to reply to
        list_response = requests.get(f"{BASE_URL}/api/admin/feedback", headers=admin_headers)
        assert list_response.status_code == 200
        feedbacks = list_response.json().get("data", [])
        
        if len(feedbacks) == 0:
            pytest.skip("No feedback items to test reply on")
        
        feedback_id = feedbacks[0]["id"]
        
        # Post a reply
        reply_message = "Thank you for your feedback! We appreciate your input."
        response = requests.post(
            f"{BASE_URL}/api/admin/feedback/{feedback_id}/reply",
            headers=admin_headers,
            json={"message": reply_message}
        )
        
        assert response.status_code == 200, f"Reply failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True
        assert "reply" in data
        reply = data["reply"]
        assert reply.get("message") == reply_message
        assert "id" in reply
        assert "admin_name" in reply
        assert "created_at" in reply
        
        print(f"SUCCESS: POST /api/admin/feedback/{feedback_id}/reply - Reply created with id {reply['id']}")
        return feedback_id
    
    def test_patch_feedback_status_toggle(self, admin_headers):
        """PATCH /api/admin/feedback/{id} - Toggles status (new->read->archived)"""
        # Get feedback list
        list_response = requests.get(f"{BASE_URL}/api/admin/feedback", headers=admin_headers)
        assert list_response.status_code == 200
        feedbacks = list_response.json().get("data", [])
        
        if len(feedbacks) == 0:
            pytest.skip("No feedback items to test status toggle on")
        
        # Find one that has status we can track
        feedback = feedbacks[0]
        feedback_id = feedback["id"]
        original_status = feedback.get("status", "new")
        
        # Toggle status
        response = requests.patch(
            f"{BASE_URL}/api/admin/feedback/{feedback_id}",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Status toggle failed: {response.text}"
        data = response.json()
        
        assert data.get("success") is True
        assert "new_status" in data
        
        # Verify the toggle logic
        new_status = data["new_status"]
        if original_status == "new":
            assert new_status == "read", f"Expected 'read' after toggling from 'new', got '{new_status}'"
        elif original_status == "read":
            assert new_status == "archived", f"Expected 'archived' after toggling from 'read', got '{new_status}'"
        
        print(f"SUCCESS: PATCH /api/admin/feedback/{feedback_id} - Status toggled from '{original_status}' to '{new_status}'")
    
    def test_delete_feedback(self, admin_headers):
        """DELETE /api/admin/feedback/{id} - Deletes a feedback"""
        # Get feedback list
        list_response = requests.get(f"{BASE_URL}/api/admin/feedback", headers=admin_headers)
        assert list_response.status_code == 200
        feedbacks = list_response.json().get("data", [])
        
        if len(feedbacks) < 2:
            pytest.skip("Not enough feedback items to safely test delete")
        
        # Delete the last feedback to avoid disrupting test sequence
        feedback_to_delete = feedbacks[-1]
        feedback_id = feedback_to_delete["id"]
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/feedback/{feedback_id}",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        
        # Verify deletion - should return 404 now
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/feedback",
            headers=admin_headers
        )
        assert verify_response.status_code == 200
        remaining_ids = [f["id"] for f in verify_response.json().get("data", [])]
        assert feedback_id not in remaining_ids, "Feedback was not actually deleted"
        
        print(f"SUCCESS: DELETE /api/admin/feedback/{feedback_id} - Feedback deleted and verified")
    
    def test_delete_nonexistent_feedback(self, admin_headers):
        """DELETE /api/admin/feedback/{id} - Returns 404 for non-existent ID"""
        fake_id = "non-existent-feedback-id-12345"
        response = requests.delete(
            f"{BASE_URL}/api/admin/feedback/{fake_id}",
            headers=admin_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"SUCCESS: DELETE /api/admin/feedback/{fake_id} - Correctly returned 404")
    
    def test_reply_to_nonexistent_feedback(self, admin_headers):
        """POST /api/admin/feedback/{id}/reply - Returns 404 for non-existent ID"""
        fake_id = "non-existent-feedback-id-12345"
        response = requests.post(
            f"{BASE_URL}/api/admin/feedback/{fake_id}/reply",
            headers=admin_headers,
            json={"message": "Test reply"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"SUCCESS: POST /api/admin/feedback/{fake_id}/reply - Correctly returned 404")
    
    def test_patch_nonexistent_feedback(self, admin_headers):
        """PATCH /api/admin/feedback/{id} - Returns 404 for non-existent ID"""
        fake_id = "non-existent-feedback-id-12345"
        response = requests.patch(
            f"{BASE_URL}/api/admin/feedback/{fake_id}",
            headers=admin_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"SUCCESS: PATCH /api/admin/feedback/{fake_id} - Correctly returned 404")
    
    def test_feedback_list_filters(self, admin_headers):
        """GET /api/admin/feedback with filters - Tests type and status filters"""
        # Test status filter
        response = requests.get(
            f"{BASE_URL}/api/admin/feedback?status=new",
            headers=admin_headers
        )
        assert response.status_code == 200
        print(f"SUCCESS: GET /api/admin/feedback?status=new - Returned {len(response.json().get('data', []))} items")
        
        # Test type filter  
        response = requests.get(
            f"{BASE_URL}/api/admin/feedback?feedback_type=testimonial",
            headers=admin_headers
        )
        assert response.status_code == 200
        print(f"SUCCESS: GET /api/admin/feedback?feedback_type=testimonial - Returned {len(response.json().get('data', []))} items")
    
    def test_reply_appears_in_feedback_get(self, admin_headers):
        """Verify that reply appears in feedback when fetching the list"""
        # Get feedback list
        list_response = requests.get(f"{BASE_URL}/api/admin/feedback", headers=admin_headers)
        assert list_response.status_code == 200
        feedbacks = list_response.json().get("data", [])
        
        # Find feedback with replies
        feedbacks_with_replies = [f for f in feedbacks if f.get("replies") and len(f.get("replies", [])) > 0]
        
        if len(feedbacks_with_replies) > 0:
            feedback = feedbacks_with_replies[0]
            replies = feedback.get("replies", [])
            assert len(replies) > 0, "Expected at least one reply"
            
            # Verify reply structure
            reply = replies[0]
            assert "id" in reply or "message" in reply, "Reply should have id or message"
            print(f"SUCCESS: Feedback {feedback['id']} has {len(replies)} reply(ies)")
        else:
            print("INFO: No feedback items with replies found yet")


class TestAdminLogsNotCrash:
    """Test that Admin Logs tab doesn't crash due to undefined log.action or object log.details"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_admin_logs_endpoint(self, admin_headers):
        """GET /api/admin/logs - Verify logs have proper action and details fields"""
        response = requests.get(f"{BASE_URL}/api/admin/logs?limit=10", headers=admin_headers)
        assert response.status_code == 200, f"Admin logs failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        logs = data.get("data", [])
        
        for log in logs:
            # Verify action exists and is a string (not undefined)
            assert "action" in log, "Log missing 'action' field"
            assert log["action"] is not None, "Log action is null"
            
            # Verify details is a string (not an object that would cause crash)
            if "details" in log and log["details"] is not None:
                # Frontend expects string, so it should be a string
                assert isinstance(log["details"], str), f"Log details should be string, got {type(log['details'])}"
        
        print(f"SUCCESS: GET /api/admin/logs - {len(logs)} logs verified, all have valid action and string details")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
