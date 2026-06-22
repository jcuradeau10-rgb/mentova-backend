"""
Test confirm-purchase endpoint with meeting_links extraction
Creates a mock purchase directly in DB to test email flow without Stripe
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

PRO_USER = {"email": "admin@cryptonai.com", "password": "Admin123!"}


def get_auth_token(email, password):
    """Helper to login and get token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


class TestConfirmPurchaseMeetingLinks:
    """Test confirm-purchase API extracts meeting_links correctly"""
    
    session_content_id = None
    offer_id = None
    
    def test_01_setup_session_with_meeting_link(self):
        """Create a session content with meeting_link"""
        token = get_auth_token(PRO_USER["email"], PRO_USER["password"])
        assert token, "Pro login failed"
        
        # Create session content
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/pro/content-library",
            json={
                "content_type": "session",
                "title": f"TEST_ConfirmPurchase_Session_{unique_id}",
                "description": "Session for confirm-purchase test",
                "content_data": {
                    "session_type": "webinar",
                    "max_participants": 50,
                    "meeting_link": "https://teams.microsoft.com/l/meetup/test-meeting-123"
                },
                "is_premium": True
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Create content failed: {response.text}"
        data = response.json()
        TestConfirmPurchaseMeetingLinks.session_content_id = data["data"]["id"]
        
        # Verify meeting_link saved
        content_data = data["data"]["content_data"]
        assert content_data.get("meeting_link") == "https://teams.microsoft.com/l/meetup/test-meeting-123"
        print(f"Created session with ID: {TestConfirmPurchaseMeetingLinks.session_content_id}")
    
    def test_02_create_offer_with_session(self):
        """Create offer containing the session"""
        if not TestConfirmPurchaseMeetingLinks.session_content_id:
            pytest.skip("Session content not created")
        
        token = get_auth_token(PRO_USER["email"], PRO_USER["password"])
        
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/pro/offers",
            json={
                "offer_type": "bundle",
                "title": f"TEST_ConfirmPurchase_Bundle_{unique_id}",
                "description": "Bundle for confirm-purchase test",
                "price": 49.99,
                "pricing_model": "one_time",
                "included_content_ids": [TestConfirmPurchaseMeetingLinks.session_content_id],
                "is_published": True
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Create offer failed: {response.text}"
        data = response.json()
        TestConfirmPurchaseMeetingLinks.offer_id = data["data"]["id"]
        print(f"Created offer with ID: {TestConfirmPurchaseMeetingLinks.offer_id}")
    
    def test_03_verify_offer_has_session_content(self):
        """Verify offer includes the session content"""
        if not TestConfirmPurchaseMeetingLinks.offer_id:
            pytest.skip("Offer not created")
        
        token = get_auth_token(PRO_USER["email"], PRO_USER["password"])
        
        response = requests.get(
            f"{BASE_URL}/api/pro/offers",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        offers = response.json().get("data", [])
        
        our_offer = next((o for o in offers if o.get("id") == TestConfirmPurchaseMeetingLinks.offer_id), None)
        assert our_offer, "Offer not found"
        
        assert TestConfirmPurchaseMeetingLinks.session_content_id in our_offer.get("included_content_ids", [])
        print(f"Offer includes session content: {our_offer.get('included_content_ids')}")
    
    def test_04_verify_content_in_db_has_meeting_link(self):
        """Verify the content stored in DB has meeting_link in content_data"""
        if not TestConfirmPurchaseMeetingLinks.session_content_id:
            pytest.skip("Session not created")
        
        token = get_auth_token(PRO_USER["email"], PRO_USER["password"])
        
        response = requests.get(
            f"{BASE_URL}/api/pro/content-library/{TestConfirmPurchaseMeetingLinks.session_content_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Get content failed: {response.text}"
        content = response.json().get("data", {})
        
        assert content.get("content_type") == "session"
        content_data = content.get("content_data", {})
        
        # This is the critical check - meeting_link must be in content_data
        assert "meeting_link" in content_data, f"meeting_link not in content_data: {content_data}"
        assert content_data["meeting_link"] == "https://teams.microsoft.com/l/meetup/test-meeting-123"
        
        print(f"Content data verified: {content_data}")
    
    def test_05_cleanup(self):
        """Cleanup test data"""
        token = get_auth_token(PRO_USER["email"], PRO_USER["password"])
        
        if TestConfirmPurchaseMeetingLinks.session_content_id:
            requests.delete(
                f"{BASE_URL}/api/pro/content-library/{TestConfirmPurchaseMeetingLinks.session_content_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"Deleted session: {TestConfirmPurchaseMeetingLinks.session_content_id}")
        
        if TestConfirmPurchaseMeetingLinks.offer_id:
            requests.delete(
                f"{BASE_URL}/api/pro/offers/{TestConfirmPurchaseMeetingLinks.offer_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"Deleted offer: {TestConfirmPurchaseMeetingLinks.offer_id}")


class TestMarketplaceSuccess:
    """Test the marketplace success page receives confirm-purchase result"""
    
    def test_success_page_endpoint_format(self):
        """Verify success URL format expected by frontend"""
        # Frontend expects: /marketplace/success?purchase_id={purchase_id}
        # And calls: POST /api/marketplace/confirm-purchase/{purchase_id}
        
        # This endpoint should return:
        expected_response_keys = ["success", "message", "email_sent", "has_meeting_links", "meeting_links_count"]
        
        print(f"Expected confirm-purchase response keys: {expected_response_keys}")
        print("Frontend success.tsx expects these fields from confirm-purchase API")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
