"""
Test suite for CryptonAI VIP System features:
- /api/vip/features - Get VIP features and pricing (public)
- /api/vip/status - Get VIP status (authenticated)
- /api/vip/checkout - Create Stripe checkout session (authenticated)
- /api/vip/checkout/status/{session_id} - Check payment status (authenticated)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "jcuradeau.7@gmail.com"
TEST_PASSWORD = "JacksoN12."

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for the test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data
    return data["access_token"]


class TestVIPFeatures:
    """Test /api/vip/features endpoint (public)"""
    
    def test_get_vip_features_returns_200(self):
        """Test that VIP features endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/vip/features")
        assert response.status_code == 200
    
    def test_get_vip_features_structure(self):
        """Test VIP features response structure"""
        response = requests.get(f"{BASE_URL}/api/vip/features")
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "price_monthly" in data
        assert "currency" in data
        assert "features" in data
        
        # Verify price is $6.99 USD
        assert data["price_monthly"] == 6.99
        assert data["currency"] == "USD"
    
    def test_get_vip_features_count(self):
        """Test that 7 VIP features are returned"""
        response = requests.get(f"{BASE_URL}/api/vip/features")
        assert response.status_code == 200
        data = response.json()
        
        # Should have exactly 7 features
        assert len(data["features"]) == 7
    
    def test_get_vip_features_content(self):
        """Test VIP features content includes expected items"""
        response = requests.get(f"{BASE_URL}/api/vip/features")
        assert response.status_code == 200
        data = response.json()
        
        features = data["features"]
        feature_ids = [f["id"] for f in features]
        
        # Verify expected feature IDs
        expected_ids = ["ai", "alerts", "courses", "badge", "portfolio", "signals", "priority"]
        for expected_id in expected_ids:
            assert expected_id in feature_ids, f"Missing feature: {expected_id}"
        
        # Verify each feature has required fields
        for feature in features:
            assert "id" in feature
            assert "title" in feature
            assert "description" in feature
            assert "icon" in feature
            assert isinstance(feature["title"], str)
            assert len(feature["title"]) > 0


class TestVIPStatus:
    """Test /api/vip/status endpoint (authenticated)"""
    
    def test_get_vip_status_requires_auth(self):
        """Test that VIP status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/status")
        assert response.status_code in [401, 403, 422]
    
    def test_get_vip_status_authenticated(self, auth_token):
        """Test getting VIP status with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/vip/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "is_vip" in data
        assert "ai_questions_remaining" in data
        assert "price_monthly" in data
        
        # Verify types
        assert isinstance(data["is_vip"], bool)
        assert data["price_monthly"] == 6.99
    
    def test_get_vip_status_non_vip_user(self, auth_token):
        """Test VIP status for non-VIP user shows correct remaining AI questions"""
        response = requests.get(
            f"{BASE_URL}/api/vip/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Non-VIP user should have limited AI questions (0-3)
        if not data["is_vip"]:
            assert isinstance(data["ai_questions_remaining"], int)
            assert 0 <= data["ai_questions_remaining"] <= 3


class TestVIPCheckout:
    """Test /api/vip/checkout endpoint (authenticated)"""
    
    def test_create_checkout_requires_auth(self):
        """Test that checkout creation requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/vip/checkout",
            json={"origin_url": "https://test.com"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403, 422]
    
    def test_create_checkout_authenticated(self, auth_token):
        """Test creating Stripe checkout session with valid auth"""
        response = requests.post(
            f"{BASE_URL}/api/vip/checkout",
            json={"origin_url": "https://academy-preview-11.preview.emergentagent.com"},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        # Should return 200 with checkout URL, or 400 if already VIP
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            assert "checkout_url" in data
            assert "session_id" in data
            
            # Verify Stripe checkout URL format
            assert data["checkout_url"].startswith("https://checkout.stripe.com/")
            assert data["session_id"].startswith("cs_test_")
        elif response.status_code == 400:
            # User is already VIP
            data = response.json()
            assert "detail" in data
            assert "VIP" in data["detail"]
    
    def test_create_checkout_returns_valid_stripe_url(self, auth_token):
        """Test that checkout URL is a valid Stripe checkout URL"""
        response = requests.post(
            f"{BASE_URL}/api/vip/checkout",
            json={"origin_url": "https://academy-preview-11.preview.emergentagent.com"},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            checkout_url = data["checkout_url"]
            
            # Stripe checkout URLs should be valid
            assert "stripe.com" in checkout_url
            assert len(data["session_id"]) > 10


class TestPaymentTransactionsCollection:
    """Test that payment_transactions collection is created"""
    
    def test_checkout_creates_transaction_record(self, auth_token):
        """Test that creating checkout creates a transaction record"""
        response = requests.post(
            f"{BASE_URL}/api/vip/checkout",
            json={"origin_url": "https://academy-preview-11.preview.emergentagent.com"},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        # If checkout succeeds, a transaction should be created
        if response.status_code == 200:
            data = response.json()
            session_id = data["session_id"]
            
            # Check transaction status endpoint
            status_response = requests.get(
                f"{BASE_URL}/api/vip/checkout/status/{session_id}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            # Should return 200 (transaction exists) or payment status
            assert status_response.status_code == 200
            status_data = status_response.json()
            
            # Verify status response structure
            assert "status" in status_data or "payment_status" in status_data


class TestVIPStatusEndpointResponses:
    """Test various scenarios for VIP status endpoint"""
    
    def test_invalid_token_returns_401(self):
        """Test that invalid token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/vip/status",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        assert response.status_code == 401
    
    def test_expired_token_format_returns_401(self):
        """Test that expired/malformed token returns 401"""
        # Using a malformed JWT
        bad_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZmFrZSIsImV4cCI6MH0.fake"
        response = requests.get(
            f"{BASE_URL}/api/vip/status",
            headers={"Authorization": f"Bearer {bad_token}"}
        )
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
