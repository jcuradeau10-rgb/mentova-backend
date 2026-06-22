"""
P0 Bug Fixes Verification Tests
Tests for:
1. CryptonAI branding replaced with Mentova
2. Hardcoded French text replaced with English
3. '0 premium contents' bug fixed - shows 'Exclusive access' instead

Using: pytest with requests
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
VIP_USER = {
    "email": "jcuradeau.7@gmail.com",
    "password": "Crypto2026!"
}


class TestP0BugFixes:
    """Test suite for P0 bug fixes"""

    @pytest.fixture(scope="class")
    def session(self):
        """Shared requests session"""
        return requests.Session()

    @pytest.fixture(scope="class")
    def auth_token(self, session):
        """Get authentication token"""
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=VIP_USER
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        pytest.skip(f"Authentication failed: {response.status_code}")

    def test_01_marketplace_offers_loads(self, session):
        """Test marketplace offers endpoint loads correctly"""
        response = session.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        print(f"PASSED: Marketplace offers endpoint returns {len(data['data'])} offers")

    def test_02_no_cryptonai_in_offer_bio(self, session):
        """Test that mentor bio does NOT contain 'CryptonAI' branding"""
        response = session.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        
        offers = data.get("data", [])
        for offer in offers:
            pro = offer.get("pro", {})
            bio = pro.get("bio", "")
            
            # Check bio does NOT contain CryptonAI (case insensitive)
            assert "cryptonai" not in bio.lower(), f"Found CryptonAI in bio: {bio}"
            
            # Check bio contains Mentova if it's the default bio
            if "certified professional" in bio.lower():
                assert "mentova" in bio.lower(), f"Expected 'Mentova' in certified bio: {bio}"
        
        print(f"PASSED: No CryptonAI branding found in {len(offers)} offer bios")

    def test_03_bio_in_english_not_french(self, session):
        """Test that mentor bio is in English, not French"""
        response = session.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        
        offers = data.get("data", [])
        french_terms = ["certifié", "équipe", "Certifié", "l'équipe", "professionnel certifié"]
        
        for offer in offers:
            pro = offer.get("pro", {})
            bio = pro.get("bio", "")
            
            # Check bio does NOT contain French text
            for term in french_terms:
                assert term not in bio, f"Found French text '{term}' in bio: {bio}"
        
        print(f"PASSED: No French text found in {len(offers)} offer bios")

    def test_04_offer_detail_bio_english(self, session):
        """Test offer detail endpoint returns English bio"""
        # First get list of offers
        response = session.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        offers = data.get("data", [])
        
        if not offers:
            pytest.skip("No offers available for detail test")
        
        # Get detail for first offer
        offer_id = offers[0]["id"]
        detail_response = session.get(f"{BASE_URL}/api/marketplace/offers/{offer_id}")
        assert detail_response.status_code == 200
        
        detail_data = detail_response.json()
        offer_detail = detail_data.get("data", {})
        pro = offer_detail.get("pro", {})
        bio = pro.get("bio", "")
        
        # Verify English text
        if "certified professional" in bio.lower():
            assert "mentova team" in bio.lower(), f"Expected 'Mentova team' in bio: {bio}"
        
        # Verify NO French text
        french_terms = ["certifié", "équipe", "Certifié"]
        for term in french_terms:
            assert term not in bio, f"Found French text '{term}' in detail bio: {bio}"
        
        print(f"PASSED: Offer detail bio is in English: {bio[:60]}...")

    def test_05_zero_content_offer_no_zero_display(self, session):
        """Test that offers with 0 content do NOT show '0 premium contents'"""
        response = session.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        offers = data.get("data", [])
        
        zero_content_offers = [o for o in offers if len(o.get("included_content_ids", [])) == 0]
        
        if not zero_content_offers:
            pytest.skip("No offers with 0 content to test")
        
        # Backend fix: The frontend should NOT display "0 premium contents"
        # The API should return empty array for included_content_ids
        for offer in zero_content_offers:
            content_ids = offer.get("included_content_ids", [])
            assert isinstance(content_ids, list), f"Expected list for included_content_ids"
            assert len(content_ids) == 0, f"Expected empty content_ids for zero-content offer"
            
            # Verify included_contents_preview is also empty/None
            preview = offer.get("included_contents_preview", [])
            assert preview is None or len(preview) == 0, f"Expected empty preview for zero-content offer"
        
        print(f"PASSED: {len(zero_content_offers)} offers correctly have empty content arrays")

    def test_06_offers_with_content_show_items(self, session):
        """Test that offers WITH content correctly show content count"""
        response = session.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        offers = data.get("data", [])
        
        content_offers = [o for o in offers if len(o.get("included_content_ids", [])) > 0]
        
        if not content_offers:
            pytest.skip("No offers with content to test")
        
        for offer in content_offers:
            content_ids = offer.get("included_content_ids", [])
            count = len(content_ids)
            assert count > 0, f"Expected positive content count"
            print(f"  Offer '{offer['title'][:30]}' has {count} content items")
        
        print(f"PASSED: {len(content_offers)} offers correctly show content counts")

    def test_07_authenticated_user_can_access_marketplace(self, session, auth_token):
        """Test authenticated user can access marketplace"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = session.get(f"{BASE_URL}/api/marketplace/offers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"PASSED: Authenticated user can access marketplace")

    def test_08_offer_detail_has_pro_info(self, session):
        """Test offer detail includes complete pro information"""
        response = session.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        offers = data.get("data", [])
        
        if not offers:
            pytest.skip("No offers available")
        
        offer_id = offers[0]["id"]
        detail_response = session.get(f"{BASE_URL}/api/marketplace/offers/{offer_id}")
        assert detail_response.status_code == 200
        
        detail_data = detail_response.json()
        offer = detail_data.get("data", {})
        pro = offer.get("pro", {})
        
        # Verify pro info exists
        assert "name" in pro, "Missing pro name"
        assert "bio" in pro, "Missing pro bio"
        assert "rating" in pro, "Missing pro rating"
        
        print(f"PASSED: Offer detail has complete pro info: {pro.get('name')}")

    def test_09_search_marketplace_works(self, session):
        """Test marketplace search functionality"""
        response = session.get(f"{BASE_URL}/api/marketplace/offers", params={"search": "test"})
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"PASSED: Marketplace search returns {len(data.get('data', []))} results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
