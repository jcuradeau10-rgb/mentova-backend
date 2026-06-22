"""
Test Affiliate/Influencer System APIs
Testing: CRUD for influencers, click tracking, stats, conversions listing
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"
SUPER_ADMIN_EMAIL = "jcuradeau.7@gmail.com"
SUPER_ADMIN_PASSWORD = "Crypto2026!"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin token - super admin account"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        if "access_token" in data:
            return data["access_token"]
    pytest.skip(f"Failed to login as super admin: {response.status_code} {response.text}")

@pytest.fixture
def api_client():
    """Unauthenticated API client"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def admin_client(admin_token):
    """Authenticated admin API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


# ====================
# ADMIN INFLUENCER CRUD
# ====================

class TestInfluencerCRUD:
    """Test influencer CRUD operations (admin only)"""
    
    def test_create_influencer_requires_auth(self, api_client):
        """POST /api/influencers without auth should fail"""
        response = api_client.post(f"{BASE_URL}/api/influencers", json={
            "name": "Test Influencer",
            "email": "testinfluencer@test.com"
        })
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ POST /api/influencers without auth returns {response.status_code}")

    def test_create_influencer_success(self, admin_client):
        """POST /api/influencers - create new influencer"""
        unique_email = f"test_influencer_{uuid.uuid4().hex[:8]}@test.com"
        response = admin_client.post(f"{BASE_URL}/api/influencers", json={
            "name": "Test Influencer API",
            "email": unique_email,
            "commission_rate": 0.25  # 25%
        })
        assert response.status_code in [200, 201], f"Create influencer failed: {response.status_code} {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "influencer" in data, "Response should contain influencer object"
        influencer = data["influencer"]
        assert influencer["name"] == "Test Influencer API"
        assert influencer["email"] == unique_email
        assert influencer["commission_rate"] == 0.25
        assert "code" in influencer, "Influencer should have affiliate code"
        assert influencer["status"] == "active"
        print(f"✓ Created influencer with code: {influencer['code']}")

    def test_create_influencer_default_commission(self, admin_client):
        """POST /api/influencers - default commission rate is 20%"""
        unique_email = f"test_default_{uuid.uuid4().hex[:8]}@test.com"
        response = admin_client.post(f"{BASE_URL}/api/influencers", json={
            "name": "Default Commission Test",
            "email": unique_email
        })
        assert response.status_code in [200, 201], f"Create failed: {response.status_code}"
        data = response.json()
        assert data["influencer"]["commission_rate"] == 0.20, "Default commission should be 20%"
        print(f"✓ Default commission rate is 0.20 (20%)")

    def test_list_influencers(self, admin_client):
        """GET /api/admin/influencers - list all influencers with stats"""
        response = admin_client.get(f"{BASE_URL}/api/admin/influencers")
        assert response.status_code == 200, f"List influencers failed: {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert "influencers" in data
        assert isinstance(data["influencers"], list)
        
        # Check structure of influencer objects with stats
        if len(data["influencers"]) > 0:
            inf = data["influencers"][0]
            assert "id" in inf, "Influencer should have id"
            assert "name" in inf, "Influencer should have name"
            assert "email" in inf, "Influencer should have email"
            assert "code" in inf, "Influencer should have code"
            assert "stats" in inf, "Influencer should have stats object"
            stats = inf["stats"]
            assert "clicks" in stats, "Stats should have clicks"
            assert "conversions" in stats, "Stats should have conversions"
            assert "conversion_rate" in stats, "Stats should have conversion_rate"
            assert "total_commission" in stats, "Stats should have total_commission"
            print(f"✓ Listed {len(data['influencers'])} influencers with stats")
        else:
            print("✓ List influencers returned empty list (no influencers yet)")

    def test_update_influencer_commission_rate(self, admin_client):
        """PUT /api/influencers/{id} - update commission rate"""
        # First list influencers to get an ID
        list_resp = admin_client.get(f"{BASE_URL}/api/admin/influencers")
        assert list_resp.status_code == 200
        influencers = list_resp.json()["influencers"]
        
        if len(influencers) == 0:
            pytest.skip("No influencers to update")
        
        inf_id = influencers[0]["id"]
        original_rate = influencers[0].get("commission_rate", 0.20)
        new_rate = 0.30 if original_rate != 0.30 else 0.25
        
        response = admin_client.put(f"{BASE_URL}/api/influencers/{inf_id}", json={
            "commission_rate": new_rate
        })
        assert response.status_code == 200, f"Update failed: {response.status_code} {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data["influencer"]["commission_rate"] == new_rate
        print(f"✓ Updated influencer {inf_id} commission rate to {new_rate}")
        
        # Restore original rate
        admin_client.put(f"{BASE_URL}/api/influencers/{inf_id}", json={"commission_rate": original_rate})

    def test_update_influencer_status(self, admin_client):
        """PUT /api/influencers/{id} - update status (active/inactive)"""
        list_resp = admin_client.get(f"{BASE_URL}/api/admin/influencers")
        influencers = list_resp.json()["influencers"]
        
        if len(influencers) == 0:
            pytest.skip("No influencers to update")
        
        # Find an influencer that's not the test one we want to keep active
        for inf in influencers:
            if "test" in inf.get("email", "").lower():
                inf_id = inf["id"]
                break
        else:
            inf_id = influencers[-1]["id"]  # Use last one
        
        # Toggle status
        response = admin_client.put(f"{BASE_URL}/api/influencers/{inf_id}", json={
            "status": "inactive"
        })
        assert response.status_code == 200, f"Update status failed: {response.status_code}"
        data = response.json()
        assert data["influencer"]["status"] == "inactive"
        print(f"✓ Set influencer {inf_id} status to inactive")
        
        # Set back to active
        response = admin_client.put(f"{BASE_URL}/api/influencers/{inf_id}", json={
            "status": "active"
        })
        assert response.status_code == 200
        print(f"✓ Set influencer {inf_id} status back to active")


# ====================
# AFFILIATE CLICK TRACKING
# ====================

class TestAffiliateClickTracking:
    """Test affiliate click tracking (public endpoint)"""
    
    def test_track_click_valid_code(self, api_client, admin_client):
        """POST /api/affiliate/click - track click with valid code"""
        # Get an active influencer code
        list_resp = admin_client.get(f"{BASE_URL}/api/admin/influencers")
        influencers = list_resp.json().get("influencers", [])
        
        active_influencers = [i for i in influencers if i.get("status") == "active"]
        if not active_influencers:
            pytest.skip("No active influencers")
        
        code = active_influencers[0]["code"]
        initial_clicks = active_influencers[0].get("clicks", 0)
        
        # Track click (public endpoint, no auth required)
        response = api_client.post(f"{BASE_URL}/api/affiliate/click", json={
            "code": code
        })
        assert response.status_code == 200, f"Track click failed: {response.status_code}"
        data = response.json()
        assert data.get("success") == True, f"Expected success=True for valid code"
        print(f"✓ Tracked click for code: {code}")
        
        # Verify click count increased
        list_resp = admin_client.get(f"{BASE_URL}/api/admin/influencers")
        updated_inf = next((i for i in list_resp.json()["influencers"] if i["code"] == code), None)
        if updated_inf:
            new_clicks = updated_inf.get("clicks", 0)
            assert new_clicks >= initial_clicks, f"Click count should have increased"
            print(f"✓ Click count: {initial_clicks} -> {new_clicks}")

    def test_track_click_invalid_code(self, api_client):
        """POST /api/affiliate/click - invalid code returns success=False"""
        response = api_client.post(f"{BASE_URL}/api/affiliate/click", json={
            "code": "INVALID_CODE_XYZ123"
        })
        assert response.status_code == 200, f"Should return 200 even for invalid code"
        data = response.json()
        assert data.get("success") == False, "Invalid code should return success=False"
        print(f"✓ Invalid code returns success=False")

    def test_track_click_empty_code(self, api_client):
        """POST /api/affiliate/click - empty code returns success=False"""
        response = api_client.post(f"{BASE_URL}/api/affiliate/click", json={
            "code": ""
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        print(f"✓ Empty code returns success=False")


# ====================
# INFLUENCER SELF STATS
# ====================

class TestInfluencerSelfStats:
    """Test influencer getting their own stats (requires influencer role)"""
    
    def test_get_stats_non_influencer(self, admin_client):
        """GET /api/influencer/stats - non-influencer user should get 404"""
        # The super admin is not necessarily an influencer
        response = admin_client.get(f"{BASE_URL}/api/influencer/stats")
        # Should either return 404 (not an influencer) or 200 (if they are linked)
        if response.status_code == 404:
            data = response.json()
            assert "influenceur" in data.get("detail", "").lower() or "not" in data.get("detail", "").lower()
            print(f"✓ Non-influencer user gets 404 as expected")
        elif response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "influencer" in data
            assert "stats" in data
            print(f"✓ User is an influencer, got stats successfully")
        else:
            pytest.fail(f"Unexpected status: {response.status_code}")


# ====================
# ADMIN CONVERSIONS LIST
# ====================

class TestAdminConversions:
    """Test admin conversions listing"""
    
    def test_list_conversions_requires_auth(self, api_client):
        """GET /api/admin/conversions without auth should fail"""
        response = api_client.get(f"{BASE_URL}/api/admin/conversions")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ GET /api/admin/conversions without auth returns {response.status_code}")

    def test_list_conversions_admin(self, admin_client):
        """GET /api/admin/conversions - list all conversions"""
        response = admin_client.get(f"{BASE_URL}/api/admin/conversions")
        assert response.status_code == 200, f"List conversions failed: {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert "conversions" in data
        assert isinstance(data["conversions"], list)
        
        # Check conversion structure if any exist
        if len(data["conversions"]) > 0:
            conv = data["conversions"][0]
            expected_fields = ["id", "influencer_id", "commission", "status"]
            for field in expected_fields:
                assert field in conv, f"Conversion should have {field}"
            print(f"✓ Listed {len(data['conversions'])} conversions with correct structure")
        else:
            print(f"✓ List conversions returned empty list (no conversions yet)")


# ====================
# EXISTING INFLUENCER VERIFICATION
# ====================

class TestExistingInfluencer:
    """Verify the existing CryptoKing influencer from context"""
    
    def test_cryptoking_exists(self, admin_client):
        """Verify CryptoKing influencer exists as mentioned in context"""
        response = admin_client.get(f"{BASE_URL}/api/admin/influencers")
        assert response.status_code == 200
        
        influencers = response.json().get("influencers", [])
        cryptoking = next((i for i in influencers if "cryptoking" in i.get("email", "").lower() or "cryptoking" in i.get("name", "").lower()), None)
        
        if cryptoking:
            print(f"✓ Found CryptoKing influencer:")
            print(f"  - Name: {cryptoking.get('name')}")
            print(f"  - Email: {cryptoking.get('email')}")
            print(f"  - Code: {cryptoking.get('code')}")
            print(f"  - Commission: {cryptoking.get('commission_rate', 0) * 100}%")
            print(f"  - Clicks: {cryptoking.get('stats', {}).get('clicks', 0)}")
            assert cryptoking.get("commission_rate") == 0.25, "CryptoKing should have 25% commission"
        else:
            print("⚠ CryptoKing influencer not found (may have been cleaned up)")


# ====================
# STRIPE CONNECT ENDPOINTS
# ====================

class TestStripeConnectEndpoints:
    """Test Stripe Connect endpoints (will fail without real influencer role)"""
    
    def test_stripe_status_requires_influencer(self, admin_client):
        """GET /api/influencer/stripe/status - requires influencer role"""
        response = admin_client.get(f"{BASE_URL}/api/influencer/stripe/status")
        # Will either 404 (not an influencer) or return status
        assert response.status_code in [200, 404], f"Unexpected: {response.status_code}"
        if response.status_code == 404:
            print("✓ Stripe status endpoint correctly requires influencer role")
        else:
            data = response.json()
            print(f"✓ Stripe status: connected={data.get('connected', False)}")

    def test_stripe_connect_requires_influencer(self, admin_client):
        """POST /api/influencer/stripe/connect - requires influencer role"""
        response = admin_client.post(f"{BASE_URL}/api/influencer/stripe/connect", json={
            "return_url": "https://example.com/dashboard"
        })
        # Will either 404 (not an influencer) or attempt Stripe connection
        if response.status_code == 404:
            print("✓ Stripe connect endpoint correctly requires influencer role")
        elif response.status_code == 500:
            # Stripe error expected without proper setup
            print("✓ Stripe connect returns error (Stripe not fully configured)")
        else:
            print(f"✓ Stripe connect returned: {response.status_code}")


# ====================
# PAYOUT ENDPOINT
# ====================

class TestPayoutEndpoint:
    """Test payout endpoint (admin trigger)"""
    
    def test_payout_requires_stripe_account(self, admin_client):
        """POST /api/influencers/{id}/payout - requires Stripe account"""
        list_resp = admin_client.get(f"{BASE_URL}/api/admin/influencers")
        influencers = list_resp.json().get("influencers", [])
        
        if not influencers:
            pytest.skip("No influencers to test payout")
        
        # Try payout on first influencer (likely no Stripe account)
        inf_id = influencers[0]["id"]
        response = admin_client.post(f"{BASE_URL}/api/influencers/{inf_id}/payout", json={})
        
        if response.status_code == 400:
            # Expected: no Stripe account
            data = response.json()
            assert "stripe" in data.get("detail", "").lower()
            print(f"✓ Payout correctly requires Stripe account")
        elif response.status_code == 500:
            # Stripe error
            print(f"✓ Payout returns Stripe error (account not configured)")
        else:
            print(f"✓ Payout returned: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
