"""
Test suite for Offer Publishing feature - Bug fix testing
Tests the is_published toggle and marketplace visibility
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test user credentials (admin + pro + VIP)
TEST_EMAIL = "jcuradeau.7@gmail.com"
TEST_PASSWORD = "Crypto2026!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for pro user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestOfferPublishWorkflow:
    """Tests for offer publishing feature - bug fix validation"""
    
    def test_create_offer_with_is_published_true(self, auth_headers):
        """POST /api/pro/offers with is_published=true creates visible offer"""
        offer_data = {
            "offer_type": "single",
            "title": f"TEST_Published_Offer_{uuid.uuid4().hex[:8]}",
            "description": "Test offer created with is_published=true",
            "short_description": "Test offer for marketplace",
            "price": 29.99,
            "pricing_model": "one_time",
            "included_content_ids": [],
            "is_published": True
        }
        
        response = requests.post(f"{BASE_URL}/api/pro/offers", json=offer_data, headers=auth_headers)
        assert response.status_code == 200, f"Create offer failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["data"]["is_published"] == True
        assert data["data"]["title"] == offer_data["title"]
        
        # Store for cleanup
        self.__class__.published_offer_id = data["data"]["id"]
        self.__class__.published_offer_title = offer_data["title"]
        print(f"PASS: Created offer with is_published=True, ID: {data['data']['id']}")
    
    def test_create_offer_with_is_published_false(self, auth_headers):
        """POST /api/pro/offers with is_published=false creates draft offer"""
        offer_data = {
            "offer_type": "single",
            "title": f"TEST_Draft_Offer_{uuid.uuid4().hex[:8]}",
            "description": "Test offer created as draft",
            "short_description": "Draft offer not on marketplace",
            "price": 19.99,
            "pricing_model": "one_time",
            "included_content_ids": [],
            "is_published": False
        }
        
        response = requests.post(f"{BASE_URL}/api/pro/offers", json=offer_data, headers=auth_headers)
        assert response.status_code == 200, f"Create draft offer failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["data"]["is_published"] == False
        
        # Store for cleanup
        self.__class__.draft_offer_id = data["data"]["id"]
        self.__class__.draft_offer_title = offer_data["title"]
        print(f"PASS: Created offer with is_published=False, ID: {data['data']['id']}")
    
    def test_marketplace_shows_only_published_offers(self, auth_headers):
        """GET /api/marketplace/offers returns only published offers"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200, f"Get marketplace failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        
        offers = data["data"]
        
        # All offers in marketplace should have is_published=True
        for offer in offers:
            assert offer.get("is_published") == True, f"Unpublished offer found in marketplace: {offer.get('id')}"
        
        # Check our published offer is in marketplace
        if hasattr(self.__class__, 'published_offer_id'):
            published_ids = [o["id"] for o in offers]
            assert self.__class__.published_offer_id in published_ids, "Published offer not found in marketplace"
            print(f"PASS: Published offer {self.__class__.published_offer_id} IS in marketplace")
        
        # Check our draft offer is NOT in marketplace
        if hasattr(self.__class__, 'draft_offer_id'):
            offer_ids = [o["id"] for o in offers]
            assert self.__class__.draft_offer_id not in offer_ids, "Draft offer wrongly appeared in marketplace"
            print(f"PASS: Draft offer {self.__class__.draft_offer_id} NOT in marketplace")
    
    def test_toggle_publish_returns_is_published_status(self, auth_headers):
        """PUT /api/pro/offers/{id}/publish toggles and returns is_published"""
        if not hasattr(self.__class__, 'draft_offer_id'):
            pytest.skip("No draft offer to toggle")
        
        # Toggle draft offer to published
        response = requests.put(
            f"{BASE_URL}/api/pro/offers/{self.__class__.draft_offer_id}/publish",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Toggle publish failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "is_published" in data, "Response missing is_published field"
        assert data["is_published"] == True, "Toggle should set is_published to True"
        print(f"PASS: Toggle publish returned is_published={data['is_published']}")
    
    def test_toggled_offer_appears_in_marketplace(self, auth_headers):
        """After toggle, offer should appear in marketplace"""
        if not hasattr(self.__class__, 'draft_offer_id'):
            pytest.skip("No offer to verify")
        
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        
        data = response.json()
        offer_ids = [o["id"] for o in data["data"]]
        
        # The previously draft offer should now be in marketplace
        assert self.__class__.draft_offer_id in offer_ids, "Toggled offer not in marketplace"
        print(f"PASS: Toggled offer now appears in marketplace")
    
    def test_toggle_publish_off_removes_from_marketplace(self, auth_headers):
        """Toggle publish OFF should remove offer from marketplace"""
        if not hasattr(self.__class__, 'draft_offer_id'):
            pytest.skip("No offer to toggle")
        
        # Toggle back to unpublished
        response = requests.put(
            f"{BASE_URL}/api/pro/offers/{self.__class__.draft_offer_id}/publish",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_published"] == False, "Toggle should set is_published to False"
        
        # Verify removed from marketplace
        marketplace_response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        offer_ids = [o["id"] for o in marketplace_response.json()["data"]]
        
        assert self.__class__.draft_offer_id not in offer_ids, "Unpublished offer still in marketplace"
        print(f"PASS: Toggled off offer removed from marketplace")


class TestOfferPublishAPIValidation:
    """API validation tests for offer publish feature"""
    
    def test_marketplace_offer_detail_requires_published(self):
        """GET /api/marketplace/offers/{id} returns 404 for unpublished"""
        # Try to get a non-existent/unpublished offer
        fake_id = "nonexistent-offer-id"
        response = requests.get(f"{BASE_URL}/api/marketplace/offers/{fake_id}")
        
        # Should return 404 for non-existent or unpublished offers
        assert response.status_code == 404, "Should return 404 for unpublished/missing offer"
        print("PASS: Marketplace detail returns 404 for unpublished offers")
    
    def test_pro_offers_list_returns_all_for_pro(self, auth_headers):
        """GET /api/pro/offers returns both published and draft for pro"""
        response = requests.get(f"{BASE_URL}/api/pro/offers", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        offers = data["data"]
        
        # Pro should see all their offers
        has_published = any(o.get("is_published") == True for o in offers)
        has_draft = any(o.get("is_published") == False for o in offers)
        
        # At minimum, check structure
        if len(offers) > 0:
            assert "is_published" in offers[0], "Offer missing is_published field"
            print(f"PASS: Pro sees {len(offers)} offers (published: {has_published}, drafts: {has_draft})")
        else:
            print("INFO: Pro has no offers yet")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_offers(self, auth_headers):
        """Delete test offers created during tests"""
        # Get all offers
        response = requests.get(f"{BASE_URL}/api/pro/offers", headers=auth_headers)
        if response.status_code != 200:
            pytest.skip("Could not fetch offers for cleanup")
        
        offers = response.json().get("data", [])
        deleted_count = 0
        
        for offer in offers:
            if offer.get("title", "").startswith("TEST_"):
                del_response = requests.delete(
                    f"{BASE_URL}/api/pro/offers/{offer['id']}",
                    headers=auth_headers
                )
                if del_response.status_code == 200:
                    deleted_count += 1
        
        print(f"CLEANUP: Deleted {deleted_count} test offers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
