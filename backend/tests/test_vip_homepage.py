"""
Test VIP Features API and Homepage VIP Section
Tests for the VIP section on the homepage and /api/vip/features endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')


class TestVIPFeaturesAPI:
    """Tests for /api/vip/features endpoint"""
    
    def test_vip_features_endpoint_returns_200(self):
        """Test that /api/vip/features returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/vip/features", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ /api/vip/features returns 200 OK")
    
    def test_vip_features_contains_price(self):
        """Test that response contains price_monthly = 6.99 USD"""
        response = requests.get(f"{BASE_URL}/api/vip/features", timeout=10)
        data = response.json()
        
        assert "price_monthly" in data, "Missing price_monthly field"
        assert data["price_monthly"] == 6.99, f"Expected 6.99, got {data['price_monthly']}"
        assert data.get("currency") == "USD", f"Expected USD, got {data.get('currency')}"
        print("✓ Price is $6.99 USD")
    
    def test_vip_features_contains_free_features(self):
        """Test that response contains free_features array with 2 features"""
        response = requests.get(f"{BASE_URL}/api/vip/features", timeout=10)
        data = response.json()
        
        assert "free_features" in data, "Missing free_features field"
        assert isinstance(data["free_features"], list), "free_features should be a list"
        assert len(data["free_features"]) == 2, f"Expected 2 free features, got {len(data['free_features'])}"
        
        # Verify free features content
        free_feature_ids = [f["id"] for f in data["free_features"]]
        assert "scanner_basic" in free_feature_ids, "Missing scanner_basic in free features"
        assert "academy_beginner" in free_feature_ids, "Missing academy_beginner in free features"
        print(f"✓ Free features: {free_feature_ids}")
    
    def test_vip_features_contains_vip_features(self):
        """Test that response contains vip_features array with 9 features"""
        response = requests.get(f"{BASE_URL}/api/vip/features", timeout=10)
        data = response.json()
        
        assert "vip_features" in data, "Missing vip_features field"
        assert isinstance(data["vip_features"], list), "vip_features should be a list"
        assert len(data["vip_features"]) == 9, f"Expected 9 VIP features, got {len(data['vip_features'])}"
        
        # Verify VIP features content
        vip_feature_ids = [f["id"] for f in data["vip_features"]]
        expected_vip_ids = ["alerts", "charts_advanced", "smart_money", "academy_advanced", 
                           "gamification", "wallet", "ai_analysis", "social", "copy_trading"]
        
        for expected_id in expected_vip_ids:
            assert expected_id in vip_feature_ids, f"Missing {expected_id} in VIP features"
        
        print(f"✓ VIP features: {vip_feature_ids}")
    
    def test_vip_features_structure(self):
        """Test that each feature has required fields: id, title, description, icon"""
        response = requests.get(f"{BASE_URL}/api/vip/features", timeout=10)
        data = response.json()
        
        required_fields = ["id", "title", "description", "icon"]
        
        # Check free features
        for feature in data["free_features"]:
            for field in required_fields:
                assert field in feature, f"Missing {field} in free feature {feature.get('id', 'unknown')}"
        
        # Check VIP features
        for feature in data["vip_features"]:
            for field in required_fields:
                assert field in feature, f"Missing {field} in VIP feature {feature.get('id', 'unknown')}"
        
        print("✓ All features have required fields (id, title, description, icon)")


class TestVIPStatus:
    """Tests for /api/vip/status endpoint (requires auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "jcuradeau.7@gmail.com",
            "password": "JacksoN12."
        }, timeout=10)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_vip_status_requires_auth(self):
        """Test that /api/vip/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/status", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ /api/vip/status requires authentication")
    
    def test_vip_status_with_auth(self, auth_token):
        """Test that /api/vip/status returns proper structure when authenticated"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vip/status", headers=headers, timeout=10)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Check required fields
        assert "is_vip" in data, "Missing is_vip field"
        assert "price_monthly" in data, "Missing price_monthly field"
        assert data["price_monthly"] == 6.99, f"Expected 6.99, got {data['price_monthly']}"
        
        print(f"✓ VIP status: is_vip={data['is_vip']}, ai_remaining={data.get('ai_questions_remaining')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
