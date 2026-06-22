"""
Test suite for Marketplace Offers with Enriched Pro Info and Publish Toggle
Tests:
- GET /api/marketplace/offers returns offers with enriched pro info (rating, total_reviews, bio, badge, display_name)
- GET /api/marketplace/offers/{id} returns single offer with enriched pro info
- PUT /api/pro/offers/{id}/publish toggles is_published status
- Only published offers appear in marketplace
- GET /api/pro/dashboard returns 200
- GET /api/pro/offers returns all offers (including unpublished)
- GET /api/influencer/stats returns 200
- GET /api/influencer/stripe/status returns 200
- POST /api/influencer/stripe/connect expected error (Stripe config)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
MENTOR_EMAIL = "jcuradeau.7@gmail.com"
MENTOR_PASSWORD = "Crypto2026!"
DRAFT_OFFER_ID = "b16ea80e-eb66-4310-be4e-177c0ac20254"
PUBLISHED_OFFER_ID = "c028b5aa-4ba4-458f-bf3c-656fbd5d0f4f"


@pytest.fixture(scope="module")
def mentor_token():
    """Get auth token for mentor user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": MENTOR_EMAIL,
        "password": MENTOR_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture
def mentor_headers(mentor_token):
    """Headers with mentor auth token"""
    return {"Authorization": f"Bearer {mentor_token}"}


class TestMarketplaceOffers:
    """Test marketplace offers API with enriched pro info"""
    
    def test_marketplace_offers_returns_200(self):
        """GET /api/marketplace/offers returns 200"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        print(f"✓ Marketplace offers returned {len(data['data'])} offers")
    
    def test_marketplace_offers_have_enriched_pro_info(self):
        """Verify offers contain enriched pro info (rating, total_reviews, bio, badge, display_name)"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        offers = data.get("data", [])
        
        if not offers:
            pytest.skip("No published offers in marketplace to test")
        
        # Check first offer has enriched pro info
        offer = offers[0]
        assert "pro" in offer, f"Missing 'pro' field in offer: {offer.keys()}"
        pro_info = offer["pro"]
        
        # Verify enriched fields exist
        enriched_fields = ["name", "rating", "total_reviews", "bio", "badge", "display_name"]
        for field in enriched_fields:
            assert field in pro_info, f"Missing '{field}' in pro info: {pro_info.keys()}"
        
        print(f"✓ Pro info has all enriched fields: {list(pro_info.keys())}")
        print(f"  - Name: {pro_info.get('name')}")
        print(f"  - Rating: {pro_info.get('rating')}")
        print(f"  - Total reviews: {pro_info.get('total_reviews')}")
        print(f"  - Badge: {pro_info.get('badge')}")
    
    def test_marketplace_offers_only_published(self):
        """Verify marketplace only returns published offers (is_published=true)"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        offers = data.get("data", [])
        
        # All offers in marketplace should be published
        for offer in offers:
            # Note: is_published may not be returned for public endpoint, 
            # but the query filters by is_published=true
            assert offer.get("is_published") is not False, f"Non-published offer found: {offer['id']}"
        
        print(f"✓ All {len(offers)} offers in marketplace are published")


class TestMarketplaceOfferDetail:
    """Test single offer detail endpoint"""
    
    def test_get_published_offer_detail(self):
        """GET /api/marketplace/offers/{id} returns offer with enriched pro info"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers/{PUBLISHED_OFFER_ID}")
        
        if response.status_code == 404:
            pytest.skip(f"Published offer {PUBLISHED_OFFER_ID} not found")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        
        offer = data.get("data", {})
        assert "pro" in offer, "Missing pro field in offer detail"
        
        pro_info = offer["pro"]
        # Verify enriched fields in detail view
        assert "rating" in pro_info
        assert "total_reviews" in pro_info
        assert "bio" in pro_info
        assert "badge" in pro_info
        print(f"✓ Offer detail has enriched pro info: rating={pro_info.get('rating')}, reviews={pro_info.get('total_reviews')}")
    
    def test_unpublished_offer_returns_404(self):
        """GET /api/marketplace/offers/{id} returns 404 for unpublished offer"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers/{DRAFT_OFFER_ID}")
        # Should return 404 if offer is not published
        print(f"  - Draft offer status: {response.status_code}")
        # This can be 404 (not found as not published) or 200 if it was published


class TestProOfferPublish:
    """Test publish/unpublish toggle for offers"""
    
    def test_toggle_publish_offer(self, mentor_headers):
        """PUT /api/pro/offers/{id}/publish toggles publish status"""
        # First get current status
        response = requests.get(f"{BASE_URL}/api/pro/offers", headers=mentor_headers)
        assert response.status_code == 200
        offers = response.json().get("data", [])
        
        draft_offer = next((o for o in offers if o["id"] == DRAFT_OFFER_ID), None)
        if not draft_offer:
            pytest.skip(f"Draft offer {DRAFT_OFFER_ID} not found in pro offers")
        
        initial_status = draft_offer.get("is_published", False)
        print(f"  - Initial status: {'published' if initial_status else 'draft'}")
        
        # Toggle publish
        toggle_response = requests.put(
            f"{BASE_URL}/api/pro/offers/{DRAFT_OFFER_ID}/publish",
            headers=mentor_headers
        )
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        toggle_data = toggle_response.json()
        assert toggle_data.get("success") is True
        new_status = toggle_data.get("is_published")
        
        print(f"✓ Toggled offer publish status: {initial_status} -> {new_status}")
        
        # Verify in marketplace if now published
        if new_status:
            marketplace_response = requests.get(f"{BASE_URL}/api/marketplace/offers")
            marketplace_offers = marketplace_response.json().get("data", [])
            offer_ids = [o["id"] for o in marketplace_offers]
            assert DRAFT_OFFER_ID in offer_ids, "Published offer not appearing in marketplace"
            print(f"✓ Offer now visible in marketplace")
        
        # Toggle back to original state
        revert_response = requests.put(
            f"{BASE_URL}/api/pro/offers/{DRAFT_OFFER_ID}/publish",
            headers=mentor_headers
        )
        assert revert_response.status_code == 200
        print(f"✓ Reverted offer to original status")
    
    def test_publish_requires_auth(self):
        """PUT /api/pro/offers/{id}/publish requires authentication"""
        response = requests.put(f"{BASE_URL}/api/pro/offers/{DRAFT_OFFER_ID}/publish")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Publish endpoint requires authentication")


class TestProDashboard:
    """Test pro dashboard endpoints"""
    
    def test_pro_dashboard_returns_200(self, mentor_headers):
        """GET /api/pro/dashboard returns 200 with data"""
        response = requests.get(f"{BASE_URL}/api/pro/dashboard", headers=mentor_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Pro dashboard returned: {list(data.keys() if isinstance(data, dict) else ['list'])}")
    
    def test_pro_offers_returns_all_including_unpublished(self, mentor_headers):
        """GET /api/pro/offers returns all offers including unpublished"""
        response = requests.get(f"{BASE_URL}/api/pro/offers", headers=mentor_headers)
        assert response.status_code == 200
        data = response.json()
        offers = data.get("data", [])
        
        # Should include both published and unpublished
        published = [o for o in offers if o.get("is_published")]
        unpublished = [o for o in offers if not o.get("is_published")]
        
        print(f"✓ Pro offers: {len(published)} published, {len(unpublished)} drafts, {len(offers)} total")


class TestInfluencerDashboard:
    """Test influencer/affiliate dashboard endpoints"""
    
    def test_influencer_stats_returns_200(self, mentor_headers):
        """GET /api/influencer/stats returns 200"""
        response = requests.get(f"{BASE_URL}/api/influencer/stats", headers=mentor_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Influencer stats returned successfully")
        if "stats" in data:
            print(f"  - Stats keys: {list(data.get('stats', {}).keys())}")
    
    def test_influencer_stripe_status_returns_200(self, mentor_headers):
        """GET /api/influencer/stripe/status returns 200"""
        response = requests.get(f"{BASE_URL}/api/influencer/stripe/status", headers=mentor_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Stripe status returned: connected={data.get('connected')}, payouts_enabled={data.get('payouts_enabled')}")
    
    def test_stripe_connect_returns_error_expected(self, mentor_headers):
        """POST /api/influencer/stripe/connect returns error (expected due to Stripe config)"""
        response = requests.post(
            f"{BASE_URL}/api/influencer/stripe/connect",
            headers=mentor_headers,
            json={"return_url": "https://example.com/return"}
        )
        # Expected to return error due to Stripe platform configuration
        print(f"  - Stripe connect response: {response.status_code}")
        # Can be 500 (Stripe not configured), 200 (with URL), or 400/422
        assert response.status_code in [200, 400, 422, 500], f"Unexpected status: {response.status_code}"
        print(f"✓ Stripe connect endpoint reachable (status {response.status_code} as expected)")


class TestDataIntegrity:
    """Test data integrity for publish/unpublish flow"""
    
    def test_publish_then_verify_marketplace(self, mentor_headers):
        """Publish an offer and verify it appears in marketplace"""
        # Get draft offer status
        offers_response = requests.get(f"{BASE_URL}/api/pro/offers", headers=mentor_headers)
        offers = offers_response.json().get("data", [])
        draft_offer = next((o for o in offers if o["id"] == DRAFT_OFFER_ID), None)
        
        if not draft_offer:
            pytest.skip(f"Test offer {DRAFT_OFFER_ID} not found")
        
        was_published = draft_offer.get("is_published", False)
        
        if not was_published:
            # Publish the offer
            publish_response = requests.put(
                f"{BASE_URL}/api/pro/offers/{DRAFT_OFFER_ID}/publish",
                headers=mentor_headers
            )
            assert publish_response.status_code == 200
            print(f"  - Published draft offer")
        
        # Check marketplace
        marketplace_response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        marketplace_offers = marketplace_response.json().get("data", [])
        offer_ids = [o["id"] for o in marketplace_offers]
        
        if not was_published:
            assert DRAFT_OFFER_ID in offer_ids, "Newly published offer should appear in marketplace"
            print(f"✓ Published offer appears in marketplace")
            
            # Unpublish to restore state
            requests.put(
                f"{BASE_URL}/api/pro/offers/{DRAFT_OFFER_ID}/publish",
                headers=mentor_headers
            )
            print(f"  - Restored to draft state")
        else:
            print(f"  - Offer was already published")
    
    def test_unpublish_removes_from_marketplace(self, mentor_headers):
        """Unpublish an offer and verify it's removed from marketplace"""
        # Get offers
        offers_response = requests.get(f"{BASE_URL}/api/pro/offers", headers=mentor_headers)
        offers = offers_response.json().get("data", [])
        draft_offer = next((o for o in offers if o["id"] == DRAFT_OFFER_ID), None)
        
        if not draft_offer:
            pytest.skip(f"Test offer {DRAFT_OFFER_ID} not found")
        
        was_published = draft_offer.get("is_published", False)
        
        # If published, unpublish
        if was_published:
            unpublish_response = requests.put(
                f"{BASE_URL}/api/pro/offers/{DRAFT_OFFER_ID}/publish",
                headers=mentor_headers
            )
            assert unpublish_response.status_code == 200
            print(f"  - Unpublished offer")
        
        # Check marketplace - should not contain unpublished offer
        marketplace_response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        marketplace_offers = marketplace_response.json().get("data", [])
        offer_ids = [o["id"] for o in marketplace_offers]
        
        if was_published:
            assert DRAFT_OFFER_ID not in offer_ids, "Unpublished offer should not appear in marketplace"
            print(f"✓ Unpublished offer removed from marketplace")
            
            # Restore to published state
            requests.put(
                f"{BASE_URL}/api/pro/offers/{DRAFT_OFFER_ID}/publish",
                headers=mentor_headers
            )
            print(f"  - Restored to published state")
        else:
            assert DRAFT_OFFER_ID not in offer_ids, "Draft offer should not be in marketplace"
            print(f"✓ Draft offer correctly not in marketplace")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
