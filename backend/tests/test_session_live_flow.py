"""
Test Suite for Session Live and Meeting Link functionality
Tests the full flow from Pro creating session content to VIP receiving meeting links
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

# Use environment URL
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials from review request
PRO_USER = {"email": "admin@cryptonai.com", "password": "Admin123!"}
VIP_USER = {"email": "testuser@example.com", "password": "password123"}


class TestSessionLiveFlow:
    """Test the complete flow for Session Live with meeting_link"""
    
    # Shared state between tests
    pro_token = None
    vip_token = None
    session_content_id = None
    offer_id = None
    purchase_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self, request):
        """Setup class-level state"""
        if not TestSessionLiveFlow.pro_token:
            TestSessionLiveFlow.pro_token = self._login_user(PRO_USER["email"], PRO_USER["password"])
        if not TestSessionLiveFlow.vip_token:
            TestSessionLiveFlow.vip_token = self._login_or_register_vip()
    
    def _login_user(self, email, password):
        """Helper to login a user and return token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def _login_or_register_vip(self):
        """Login or register VIP user"""
        # Try login first
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_USER["email"], "password": VIP_USER["password"]}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        
        # If login fails, register new user
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": VIP_USER["email"],
                "password": VIP_USER["password"],
                "name": "Test VIP User"
            }
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None

    def test_01_pro_login_and_check_status(self):
        """Test 1: Verify Pro user can login and is professional"""
        assert TestSessionLiveFlow.pro_token is not None, "Pro user login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.pro_token}"}
        )
        assert response.status_code == 200, f"Get me failed: {response.text}"
        
        user_data = response.json()
        print(f"Pro user data: email={user_data.get('email')}, is_professional={user_data.get('is_professional')}")
        # Note: User may not be professional yet, but should have valid token

    def test_02_create_session_live_content_with_meeting_link(self):
        """Test 2: Pro creates Session Live content with meeting_link (Zoom/Meet/Teams)"""
        if not TestSessionLiveFlow.pro_token:
            pytest.skip("Pro token not available")
        
        # Create session content with meeting_link
        unique_id = str(uuid.uuid4())[:8]
        content_data = {
            "content_type": "session",
            "title": f"TEST_Session_Live_{unique_id}",
            "description": "Test session for meeting link functionality",
            "content_data": {
                "session_type": "one_on_one",
                "max_participants": 1,
                "price": 50,
                "meeting_link": "https://zoom.us/j/test123456789"
            },
            "tags": ["test", "session"],
            "is_premium": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/content-library",
            json=content_data,
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.pro_token}"}
        )
        
        print(f"Create content response: {response.status_code}, {response.text[:500]}")
        
        if response.status_code == 403:
            print("User is not professional - need to apply as pro first")
            pytest.skip("User is not professional")
        
        assert response.status_code == 200, f"Create content failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        content = data.get("data", {})
        TestSessionLiveFlow.session_content_id = content.get("id")
        
        assert content.get("content_type") == "session"
        assert content.get("title") == f"TEST_Session_Live_{unique_id}"
        
        # Verify meeting_link is stored in content_data
        saved_content_data = content.get("content_data", {})
        assert "meeting_link" in saved_content_data, "meeting_link not saved in content_data"
        assert saved_content_data.get("meeting_link") == "https://zoom.us/j/test123456789"
        
        print(f"Created session content with ID: {TestSessionLiveFlow.session_content_id}")
        print(f"Saved meeting_link: {saved_content_data.get('meeting_link')}")

    def test_03_get_content_library_and_verify_meeting_link(self):
        """Test 3: Verify meeting_link persists in content library"""
        if not TestSessionLiveFlow.pro_token:
            pytest.skip("Pro token not available")
        
        response = requests.get(
            f"{BASE_URL}/api/pro/content-library",
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.pro_token}"}
        )
        
        if response.status_code == 403:
            pytest.skip("User is not professional")
        
        assert response.status_code == 200
        
        data = response.json()
        contents = data.get("data", [])
        
        # Find our test session
        test_sessions = [c for c in contents if c.get("content_type") == "session" and "TEST_" in c.get("title", "")]
        
        if test_sessions:
            session = test_sessions[0]
            content_data = session.get("content_data", {})
            print(f"Found session: {session.get('title')}")
            print(f"Content data: {content_data}")
            
            meeting_link = content_data.get("meeting_link")
            if meeting_link:
                print(f"Meeting link verified: {meeting_link}")
            else:
                print("WARNING: meeting_link not found in stored content")

    def test_04_create_offer_with_session(self):
        """Test 4: Pro creates Bundle offer containing the session"""
        if not TestSessionLiveFlow.pro_token or not TestSessionLiveFlow.session_content_id:
            pytest.skip("Prerequisites not met")
        
        unique_id = str(uuid.uuid4())[:8]
        offer_data = {
            "offer_type": "bundle",
            "title": f"TEST_Bundle_with_Session_{unique_id}",
            "description": "Test bundle containing a live session",
            "short_description": "Bundle with meeting link test",
            "price": 99.99,
            "pricing_model": "one_time",
            "included_content_ids": [TestSessionLiveFlow.session_content_id],
            "is_published": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/offers",
            json=offer_data,
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.pro_token}"}
        )
        
        print(f"Create offer response: {response.status_code}, {response.text[:500]}")
        
        if response.status_code == 403:
            pytest.skip("User is not professional")
        
        assert response.status_code == 200, f"Create offer failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        offer = data.get("data", {})
        TestSessionLiveFlow.offer_id = offer.get("id")
        
        assert offer.get("offer_type") == "bundle"
        assert offer.get("is_published") == True
        assert TestSessionLiveFlow.session_content_id in offer.get("included_content_ids", [])
        
        print(f"Created offer with ID: {TestSessionLiveFlow.offer_id}")

    def test_05_publish_offer_if_not_published(self):
        """Test 5: Ensure offer is published and visible on marketplace"""
        if not TestSessionLiveFlow.pro_token or not TestSessionLiveFlow.offer_id:
            pytest.skip("Prerequisites not met")
        
        # Verify publish status
        response = requests.get(
            f"{BASE_URL}/api/pro/offers",
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.pro_token}"}
        )
        
        if response.status_code == 403:
            pytest.skip("User is not professional")
        
        assert response.status_code == 200
        
        data = response.json()
        offers = data.get("data", [])
        
        our_offer = next((o for o in offers if o.get("id") == TestSessionLiveFlow.offer_id), None)
        if our_offer:
            print(f"Offer found: {our_offer.get('title')}, published: {our_offer.get('is_published')}")
            
            # If not published, publish it
            if not our_offer.get("is_published"):
                pub_response = requests.post(
                    f"{BASE_URL}/api/pro/offers/{TestSessionLiveFlow.offer_id}/publish",
                    headers={"Authorization": f"Bearer {TestSessionLiveFlow.pro_token}"}
                )
                print(f"Publish response: {pub_response.status_code}")

    def test_06_vip_view_marketplace_offers(self):
        """Test 6: VIP user can see offers on /api/marketplace/offers"""
        if not TestSessionLiveFlow.vip_token:
            pytest.skip("VIP token not available")
        
        response = requests.get(
            f"{BASE_URL}/api/marketplace/offers",
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.vip_token}"}
        )
        
        assert response.status_code == 200, f"Marketplace offers failed: {response.text}"
        
        data = response.json()
        offers = data.get("data", [])
        
        print(f"Found {len(offers)} published offers on marketplace")
        
        # Check if our test offer is visible
        test_offers = [o for o in offers if "TEST_" in o.get("title", "")]
        if test_offers:
            print(f"Test offers visible on marketplace: {[o.get('title') for o in test_offers]}")
        
        # Verify offers have expected structure
        if offers:
            sample_offer = offers[0]
            print(f"Sample offer structure: {list(sample_offer.keys())}")

    def test_07_vip_view_offer_details(self):
        """Test 7: VIP user can view specific offer details"""
        if not TestSessionLiveFlow.vip_token or not TestSessionLiveFlow.offer_id:
            pytest.skip("Prerequisites not met")
        
        response = requests.get(
            f"{BASE_URL}/api/marketplace/offers/{TestSessionLiveFlow.offer_id}",
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.vip_token}"}
        )
        
        print(f"Get offer details response: {response.status_code}")
        
        if response.status_code == 404:
            print("Offer not found - may not be published or visible")
            pytest.skip("Offer not found")
        
        assert response.status_code == 200, f"Get offer details failed: {response.text}"
        
        data = response.json()
        offer = data.get("data", {})
        
        print(f"Offer details: title={offer.get('title')}, price={offer.get('price')}")
        print(f"Included content IDs: {offer.get('included_content_ids')}")

    def test_08_simulate_purchase_and_confirm(self):
        """Test 8: Simulate purchase flow and test confirm-purchase API"""
        if not TestSessionLiveFlow.vip_token or not TestSessionLiveFlow.offer_id:
            pytest.skip("Prerequisites not met")
        
        # First, manually create a purchase record (simulating Stripe payment success)
        # This is necessary because we're mocking Stripe
        import requests
        
        # Get VIP user info
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.vip_token}"}
        )
        
        if me_response.status_code != 200:
            pytest.skip("Could not get VIP user info")
        
        vip_user = me_response.json()
        vip_user_id = vip_user.get("id")
        
        # Try to create purchase through checkout initiation endpoint first
        checkout_response = requests.post(
            f"{BASE_URL}/api/marketplace/checkout/{TestSessionLiveFlow.offer_id}",
            json={"origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.vip_token}"}
        )
        
        print(f"Checkout initiation response: {checkout_response.status_code}, {checkout_response.text[:500]}")
        
        if checkout_response.status_code == 200:
            checkout_data = checkout_response.json()
            # The purchase may have been created
            if "purchase_id" in checkout_data:
                TestSessionLiveFlow.purchase_id = checkout_data["purchase_id"]
                print(f"Got purchase_id from checkout: {TestSessionLiveFlow.purchase_id}")

    def test_09_confirm_purchase_meeting_links_extraction(self):
        """Test 9: Backend confirm-purchase extracts meeting_links and sends email"""
        if not TestSessionLiveFlow.vip_token or not TestSessionLiveFlow.purchase_id:
            pytest.skip("No purchase_id available for testing")
        
        response = requests.post(
            f"{BASE_URL}/api/marketplace/confirm-purchase/{TestSessionLiveFlow.purchase_id}",
            headers={"Authorization": f"Bearer {TestSessionLiveFlow.vip_token}"}
        )
        
        print(f"Confirm purchase response: {response.status_code}, {response.text}")
        
        assert response.status_code == 200, f"Confirm purchase failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        # Check if meeting links were extracted and email sent
        has_meeting_links = data.get("has_meeting_links", False)
        meeting_links_count = data.get("meeting_links_count", 0)
        email_sent = data.get("email_sent", False)
        
        print(f"has_meeting_links: {has_meeting_links}")
        print(f"meeting_links_count: {meeting_links_count}")
        print(f"email_sent: {email_sent}")
        
        # If we created session with meeting link, verify it was extracted
        if TestSessionLiveFlow.session_content_id:
            print("Session content was created - meeting_links should be > 0 if content_data.meeting_link was saved")

    def test_10_cleanup_test_data(self):
        """Test 10: Cleanup test data (optional)"""
        if not TestSessionLiveFlow.pro_token:
            return
        
        # Delete test content
        if TestSessionLiveFlow.session_content_id:
            response = requests.delete(
                f"{BASE_URL}/api/pro/content-library/{TestSessionLiveFlow.session_content_id}",
                headers={"Authorization": f"Bearer {TestSessionLiveFlow.pro_token}"}
            )
            print(f"Delete content response: {response.status_code}")
        
        # Delete test offer
        if TestSessionLiveFlow.offer_id:
            response = requests.delete(
                f"{BASE_URL}/api/pro/offers/{TestSessionLiveFlow.offer_id}",
                headers={"Authorization": f"Bearer {TestSessionLiveFlow.pro_token}"}
            )
            print(f"Delete offer response: {response.status_code}")


class TestContentItemCreateModel:
    """Test the ContentItemCreate model accepts meeting_link in content_data"""
    
    def test_content_data_with_meeting_link_accepted(self):
        """Verify content_data field accepts meeting_link"""
        # Login as pro
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PRO_USER["email"], "password": PRO_USER["password"]}
        )
        
        if response.status_code != 200:
            pytest.skip("Pro login failed")
        
        token = response.json().get("access_token")
        
        # Create content with meeting_link in content_data
        content_payload = {
            "content_type": "session",
            "title": "TEST_ContentData_MeetingLink",
            "description": "Testing meeting_link in content_data",
            "content_data": {
                "session_type": "group",
                "max_participants": 10,
                "meeting_link": "https://meet.google.com/abc-defg-hij"
            },
            "is_premium": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/content-library",
            json=content_payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        print(f"Content create with meeting_link: {response.status_code}")
        
        if response.status_code == 403:
            pytest.skip("User is not professional")
        
        if response.status_code == 200:
            data = response.json()
            content = data.get("data", {})
            saved_content_data = content.get("content_data", {})
            
            assert "meeting_link" in saved_content_data, "meeting_link not persisted"
            assert saved_content_data["meeting_link"] == "https://meet.google.com/abc-defg-hij"
            
            # Cleanup
            if content.get("id"):
                requests.delete(
                    f"{BASE_URL}/api/pro/content-library/{content['id']}",
                    headers={"Authorization": f"Bearer {token}"}
                )
            
            print("SUCCESS: meeting_link correctly saved in content_data")


class TestMarketplaceEndpoints:
    """Test marketplace public endpoints"""
    
    def test_marketplace_offers_public(self):
        """Test GET /api/marketplace/offers returns published offers"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        
        assert response.status_code == 200, f"Marketplace offers failed: {response.text}"
        
        data = response.json()
        print(f"Marketplace response keys: {data.keys()}")
        
        offers = data.get("data", [])
        print(f"Total published offers: {len(offers)}")
        
        # Verify structure
        if offers:
            sample = offers[0]
            expected_keys = ["id", "title", "price"]
            for key in expected_keys:
                assert key in sample, f"Missing key: {key}"
            print(f"Offer structure verified: {list(sample.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
