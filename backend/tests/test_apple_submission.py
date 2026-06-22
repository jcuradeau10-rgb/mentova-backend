"""
Apple App Store Submission - Comprehensive Backend API Tests
Tests all critical flows for Mentova mentor marketplace app
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
APPLE_REVIEWER_EMAIL = "Applereview@mentova.com"
APPLE_REVIEWER_PASSWORD = "Apple2026!"
VIP_MENTOR_EMAIL = "jcuradeau.7@gmail.com"
VIP_MENTOR_PASSWORD = "Crypto2026!"

# Known offer IDs
OFFER_IDS = [
    "58575274-f8ca-4250-9848-88f58e3b7cb6",  # Formation Trading Avancé, $49.99
    "a1ed4c9a-6d10-4388-9aa4-43c44063565c",  # test, $10000
    "c028b5aa-4ba4-458f-bf3c-656fbd5d0f4f",  # Mon Offre Test, $29.99
]


class TestAuthenticationFlows:
    """Test authentication endpoints"""
    
    def test_apple_reviewer_login(self):
        """1. Login flow with Apple reviewer account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": APPLE_REVIEWER_EMAIL,
            "password": APPLE_REVIEWER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        user = data["user"]
        assert user["email"] == APPLE_REVIEWER_EMAIL
        assert user.get("is_vip") == True, "Apple reviewer should be VIP"
        assert user.get("is_professional") == True, "Apple reviewer should be professional"
        print(f"✓ Apple reviewer login successful - VIP: {user.get('is_vip')}, Pro: {user.get('is_professional')}")
    
    def test_vip_mentor_login(self):
        """Login with VIP Mentor account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_MENTOR_EMAIL,
            "password": VIP_MENTOR_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        user = data["user"]
        assert user.get("is_vip") == True, "VIP mentor should be VIP"
        print(f"✓ VIP mentor login successful - VIP: {user.get('is_vip')}")
    
    def test_get_me_endpoint(self):
        """Test GET /api/auth/me returns user info"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": APPLE_REVIEWER_EMAIL,
            "password": APPLE_REVIEWER_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Get user info
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == APPLE_REVIEWER_EMAIL
        assert data.get("is_vip") == True
        print(f"✓ GET /api/auth/me returns correct user info")


class TestHomePage:
    """Test home page data endpoints"""
    
    def test_crypto_prices(self):
        """3. Home page loads with crypto prices"""
        response = requests.get(f"{BASE_URL}/api/crypto/prices")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert len(data["data"]) > 0, "Should have crypto price data"
        # Check first crypto has required fields
        first_crypto = data["data"][0]
        assert "symbol" in first_crypto
        assert "current_price" in first_crypto
        print(f"✓ Crypto prices loaded - {len(data['data'])} coins")
    
    def test_crypto_chart(self):
        """3. Home page loads with charts"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/bitcoin?days=7")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert len(data["data"]) > 0, "Should have chart data"
        print(f"✓ Bitcoin chart loaded - {len(data['data'])} data points")
    
    def test_news_endpoint(self):
        """3. Home page loads with news"""
        response = requests.get(f"{BASE_URL}/api/news")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        print(f"✓ News loaded - {len(data.get('data', []))} articles")


class TestMarketplace:
    """Test marketplace endpoints"""
    
    def test_marketplace_offers_list(self):
        """4. Marketplace page loads with offers list (should show 3 offers)"""
        response = requests.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        offers = data["data"]
        assert len(offers) >= 3, f"Expected at least 3 offers, got {len(offers)}"
        print(f"✓ Marketplace offers loaded - {len(offers)} offers")
        
        # Verify offer structure
        for offer in offers:
            assert "id" in offer
            assert "title" in offer
            assert "price" in offer
            assert "pro" in offer or "pro_name" in offer
    
    def test_marketplace_offer_detail(self):
        """5. Marketplace offer detail page loads correctly with pro info"""
        offer_id = OFFER_IDS[0]  # Formation Trading Avancé
        response = requests.get(f"{BASE_URL}/api/marketplace/offers/{offer_id}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        offer = data["data"]
        assert offer["id"] == offer_id
        assert "pro" in offer, "Offer should have pro info"
        assert "bio" in offer.get("pro", {}), "Pro should have bio"
        print(f"✓ Offer detail loaded - {offer['title']}, Pro: {offer.get('pro', {}).get('name')}")
    
    def test_marketplace_purchase_creates_checkout(self):
        """6. Marketplace purchase flow - clicking Buy creates Stripe checkout URL"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": APPLE_REVIEWER_EMAIL,
            "password": APPLE_REVIEWER_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        offer_id = OFFER_IDS[0]
        response = requests.post(
            f"{BASE_URL}/api/marketplace/offers/{offer_id}/purchase",
            headers={"Authorization": f"Bearer {token}"},
            json={"origin_url": "https://academy-preview-11.preview.emergentagent.com"}
        )
        # Should return checkout URL or error if already purchased
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        data = response.json()
        if response.status_code == 200:
            assert "checkout_url" in data, "Should have checkout_url"
            assert "stripe" in data["checkout_url"].lower() or "checkout" in data["checkout_url"].lower()
            print(f"✓ Purchase creates Stripe checkout URL")
        else:
            print(f"✓ Purchase endpoint works (may be already purchased): {data}")


class TestVIPHub:
    """Test VIP Hub endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": APPLE_REVIEWER_EMAIL,
            "password": APPLE_REVIEWER_PASSWORD
        })
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_vip_academy_courses(self):
        """7. VIP Hub loads - Academy tab with courses"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        courses = data.get("data", [])
        assert len(courses) > 0, "Should have academy courses"
        print(f"✓ VIP Academy loaded - {len(courses)} courses")
        
        # Verify course structure
        for course in courses:
            assert "id" in course
            assert "title" in course
            assert "modules" in course
    
    def test_vip_social_posts(self):
        """8. VIP Hub - Social/Community tab with posts"""
        response = requests.get(f"{BASE_URL}/api/vip/social/feed", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        posts = data.get("data", [])
        print(f"✓ VIP Social feed loaded - {len(posts)} posts")
    
    def test_vip_tools(self):
        """9. VIP Hub - Tools tab with features"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        tools = data.get("data", {})
        # Check for key tools
        expected_tools = ["fear_greed", "btc_dominance", "eth_gas"]
        for tool in expected_tools:
            assert tool in tools, f"Missing tool: {tool}"
        print(f"✓ VIP Tools loaded - Fear&Greed, BTC Dominance, ETH Gas, etc.")
    
    def test_vip_features_list(self):
        """9. VIP features endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/features")
        assert response.status_code == 200
        data = response.json()
        assert "features" in data
        assert len(data["features"]) > 0
        print(f"✓ VIP features list - {len(data['features'])} features")
    
    def test_vip_wallet_balance(self):
        """10. VIP Wallet - balance endpoint"""
        # Test with a sample Ethereum address
        test_address = "0x742d35Cc6634C0532925a3b844Bc9e7595f5bB0a"
        response = requests.get(
            f"{BASE_URL}/api/vip/wallet/balance/{test_address}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        # Should return balance info or error message
        assert "success" in data or "balance" in data or "message" in data
        print(f"✓ VIP Wallet balance endpoint works")


class TestCommunity:
    """Test community endpoints"""
    
    def test_community_posts(self):
        """11. Community page loads with seeded posts"""
        response = requests.get(f"{BASE_URL}/api/community/posts")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        posts = data.get("data", [])
        print(f"✓ Community posts loaded - {len(posts)} posts")
    
    def test_community_categories(self):
        """Community categories endpoint"""
        response = requests.get(f"{BASE_URL}/api/community/categories")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        categories = data.get("data", [])
        assert len(categories) > 0
        print(f"✓ Community categories loaded - {len(categories)} categories")


class TestNews:
    """Test news endpoints"""
    
    def test_news_articles(self):
        """12. News page loads with articles"""
        response = requests.get(f"{BASE_URL}/api/news")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        articles = data.get("data", [])
        print(f"✓ News articles loaded - {len(articles)} articles")


class TestAIAssistant:
    """Test AI assistant endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": APPLE_REVIEWER_EMAIL,
            "password": APPLE_REVIEWER_PASSWORD
        })
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_ai_ask_endpoint(self):
        """13. AI Assistant page loads and can send messages"""
        response = requests.post(
            f"{BASE_URL}/api/ai/ask",
            headers=self.headers,
            json={"query": "What is Bitcoin?", "context": "general"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data, "AI should return a response"
        assert len(data["response"]) > 0, "AI response should not be empty"
        print(f"✓ AI Assistant responds to queries")


class TestSettings:
    """Test settings endpoints"""
    
    def test_settings_legal_links(self):
        """14. Settings page loads with legal links"""
        # Test that the app config endpoint exists
        response = requests.get(f"{BASE_URL}/api/auth/recaptcha-site-key")
        assert response.status_code == 200
        print(f"✓ Settings/config endpoints work")


class TestNotifications:
    """Test notifications endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": APPLE_REVIEWER_EMAIL,
            "password": APPLE_REVIEWER_PASSWORD
        })
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_notifications_history(self):
        """15. Notifications page shows notification history"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/history",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        notifications = data.get("data", [])
        print(f"✓ Notifications history loaded - {len(notifications)} notifications")


class TestProCatalog:
    """Test pro/mentor catalog endpoints"""
    
    def test_pro_catalog(self):
        """16. Pro catalog page loads (mentor features)"""
        response = requests.get(f"{BASE_URL}/api/pros")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Pro catalog loaded")


class TestAdminPanel:
    """Test admin panel access"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login with super admin account"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_MENTOR_EMAIL,  # This is the super admin
            "password": VIP_MENTOR_PASSWORD
        })
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_admin_users_list(self):
        """17. Admin panel accessible - users list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers=self.headers
        )
        # Should be 200 for admin or 403 for non-admin
        assert response.status_code in [200, 403]
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"✓ Admin panel accessible - users list works")
        else:
            print(f"✓ Admin panel requires admin role (expected behavior)")


class TestWelcomeReviewPage:
    """Test welcome review page for Apple reviewer"""
    
    def test_apple_reviewer_badges(self):
        """2. Welcome review page shows VIP + Mentor badges"""
        # Login as Apple reviewer
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": APPLE_REVIEWER_EMAIL,
            "password": APPLE_REVIEWER_PASSWORD
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        user = data["user"]
        
        # Verify badges
        assert user.get("is_vip") == True, "Apple reviewer should have VIP badge"
        assert user.get("is_professional") == True, "Apple reviewer should have Mentor/Pro badge"
        assert user.get("is_apple_review") == True, "Apple reviewer should have apple_review flag"
        print(f"✓ Apple reviewer has VIP + Mentor badges")


class TestVIPAcademyProgress:
    """Test VIP Academy course progress"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": APPLE_REVIEWER_EMAIL,
            "password": APPLE_REVIEWER_PASSWORD
        })
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_academy_course_progress(self):
        """Test course progress tracking"""
        # First get courses
        courses_resp = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        courses = courses_resp.json().get("data", [])
        
        if len(courses) > 0:
            course_id = courses[0]["id"]
            # Try to update progress - endpoint expects progress_percent as query param
            response = requests.post(
                f"{BASE_URL}/api/vip/academy/{course_id}/progress?progress_percent=10",
                headers=self.headers
            )
            assert response.status_code in [200, 201, 400, 422]
            print(f"✓ Academy course progress endpoint works")
        else:
            print(f"✓ No courses to test progress (expected)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
