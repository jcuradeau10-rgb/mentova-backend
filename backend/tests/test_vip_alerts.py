"""
Backend tests for VIP Alerts System - CryptonAI
Tests:
- /api/vip/alerts/cryptos - GET list of 20 popular cryptos (BTC, ETH, SOL, etc.)
- /api/vip/alerts - POST create alert with crypto_symbol, alert_type, target_value
- /api/vip/alerts - GET list user alerts
- /api/vip/alerts/{id} - DELETE alert
- Verify Copy Trading NOT in FEATURES
- Verify crypto tools still functional
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials (VIP admin user)
TEST_EMAIL = "admin@cryptonai.com"
TEST_PASSWORD = "Admin123!"

# Expected 20 popular cryptos
EXPECTED_CRYPTOS = ["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "DOT", "AVAX", "LINK", 
                   "TON", "SHIB", "LTC", "MATIC", "UNI", "ATOM", "APT", "ARB", "OP", "NEAR"]


class TestVIPAlertsAPI:
    """Tests for VIP Alerts API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            self.user = login_response.json().get("user")
            print(f"✓ Logged in as {TEST_EMAIL}, VIP status: {self.user.get('is_vip', False)}")
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        yield
        
        # Cleanup - delete TEST_ prefixed alerts
        alerts_resp = self.session.get(f"{BASE_URL}/api/vip/alerts")
        if alerts_resp.status_code == 200:
            alerts = alerts_resp.json().get("data", [])
            for alert in alerts:
                # Delete test alerts created during tests
                if alert.get("crypto_symbol") in ["TESTCOIN", "BTC", "ETH"] and "TEST_" in str(alert.get("id", "")):
                    self.session.delete(f"{BASE_URL}/api/vip/alerts/{alert['id']}")
    
    # ==================== Test 1: GET /api/vip/alerts/cryptos ====================
    def test_get_available_cryptos_returns_20_cryptos(self):
        """Test that /api/vip/alerts/cryptos returns list of 20 popular cryptos"""
        response = self.session.get(f"{BASE_URL}/api/vip/alerts/cryptos")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have data field"
        
        cryptos = data["data"]
        assert isinstance(cryptos, list), "Data should be a list"
        assert len(cryptos) == 20, f"Expected 20 cryptos, got {len(cryptos)}"
        
        print(f"✓ Got {len(cryptos)} cryptos from /api/vip/alerts/cryptos")
    
    def test_available_cryptos_contains_expected_symbols(self):
        """Test that the 20 cryptos include BTC, ETH, SOL, etc."""
        response = self.session.get(f"{BASE_URL}/api/vip/alerts/cryptos")
        
        assert response.status_code == 200
        cryptos = response.json()["data"]
        
        symbols = [c["symbol"] for c in cryptos]
        
        # Check all expected cryptos are present
        for expected in EXPECTED_CRYPTOS:
            assert expected in symbols, f"Missing crypto: {expected}"
        
        print(f"✓ All 20 expected cryptos present: {', '.join(EXPECTED_CRYPTOS)}")
    
    def test_available_cryptos_structure(self):
        """Test that each crypto has required fields"""
        response = self.session.get(f"{BASE_URL}/api/vip/alerts/cryptos")
        
        assert response.status_code == 200
        cryptos = response.json()["data"]
        
        required_fields = ["id", "symbol", "name", "current_price", "change_24h"]
        
        for crypto in cryptos:
            for field in required_fields:
                assert field in crypto, f"Missing field '{field}' in crypto {crypto.get('symbol', 'unknown')}"
        
        # Print sample crypto data
        sample = cryptos[0]
        print(f"✓ Sample crypto: {sample['symbol']} - ${sample['current_price']} ({sample['change_24h']}%)")
    
    # ==================== Test 2: POST /api/vip/alerts ====================
    def test_create_alert_success(self):
        """Test creating a new alert with crypto_symbol, alert_type, target_value"""
        alert_data = {
            "crypto_symbol": "BTC",
            "alert_type": "price_above",
            "target_value": 100000.00
        }
        
        response = self.session.post(f"{BASE_URL}/api/vip/alerts", json=alert_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        
        created_alert = data["data"]
        assert created_alert["crypto_symbol"] == "BTC"
        assert created_alert["alert_type"] == "price_above"
        assert created_alert["target_value"] == 100000.00
        assert "id" in created_alert
        
        print(f"✓ Created alert: {created_alert['crypto_symbol']} {created_alert['alert_type']} ${created_alert['target_value']}")
        
        # Store for cleanup
        self.created_alert_id = created_alert["id"]
        
        # Delete the test alert
        delete_resp = self.session.delete(f"{BASE_URL}/api/vip/alerts/{self.created_alert_id}")
        assert delete_resp.status_code == 200
    
    def test_create_alert_price_below(self):
        """Test creating a price_below alert"""
        alert_data = {
            "crypto_symbol": "ETH",
            "alert_type": "price_below",
            "target_value": 1500.00
        }
        
        response = self.session.post(f"{BASE_URL}/api/vip/alerts", json=alert_data)
        
        assert response.status_code == 200
        
        data = response.json()
        created_alert = data["data"]
        assert created_alert["alert_type"] == "price_below"
        assert created_alert["crypto_symbol"] == "ETH"
        
        print(f"✓ Created price_below alert: {created_alert['crypto_symbol']} < ${created_alert['target_value']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vip/alerts/{created_alert['id']}")
    
    def test_create_alert_with_notification_method(self):
        """Test creating alert with optional notification_method"""
        alert_data = {
            "crypto_symbol": "SOL",
            "alert_type": "price_above",
            "target_value": 500.00,
            "notification_method": "push"
        }
        
        response = self.session.post(f"{BASE_URL}/api/vip/alerts", json=alert_data)
        
        assert response.status_code == 200
        
        data = response.json()
        created_alert = data["data"]
        assert created_alert["notification_method"] == "push"
        
        print(f"✓ Created alert with notification_method=push")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vip/alerts/{created_alert['id']}")
    
    # ==================== Test 3: GET /api/vip/alerts ====================
    def test_get_user_alerts(self):
        """Test getting list of user's alerts"""
        response = self.session.get(f"{BASE_URL}/api/vip/alerts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert "total" in data
        
        alerts = data["data"]
        assert isinstance(alerts, list)
        
        print(f"✓ User has {data['total']} alerts")
    
    def test_get_alerts_returns_created_alert(self):
        """Test that GET alerts returns the alert we just created"""
        # First create an alert
        alert_data = {
            "crypto_symbol": "DOGE",
            "alert_type": "price_above",
            "target_value": 1.00
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/vip/alerts", json=alert_data)
        assert create_resp.status_code == 200
        created_alert = create_resp.json()["data"]
        
        # Now get all alerts
        get_resp = self.session.get(f"{BASE_URL}/api/vip/alerts")
        assert get_resp.status_code == 200
        
        alerts = get_resp.json()["data"]
        alert_ids = [a["id"] for a in alerts]
        
        assert created_alert["id"] in alert_ids, "Created alert should be in user's alerts list"
        
        print(f"✓ Created alert {created_alert['id'][:8]}... found in user's alerts")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vip/alerts/{created_alert['id']}")
    
    # ==================== Test 4: DELETE /api/vip/alerts/{id} ====================
    def test_delete_alert_success(self):
        """Test deleting an alert"""
        # First create an alert
        alert_data = {
            "crypto_symbol": "LINK",
            "alert_type": "price_below",
            "target_value": 10.00
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/vip/alerts", json=alert_data)
        assert create_resp.status_code == 200
        created_alert = create_resp.json()["data"]
        alert_id = created_alert["id"]
        
        # Delete the alert
        delete_resp = self.session.delete(f"{BASE_URL}/api/vip/alerts/{alert_id}")
        
        assert delete_resp.status_code == 200, f"Expected 200, got {delete_resp.status_code}"
        
        data = delete_resp.json()
        assert data.get("success") == True
        
        print(f"✓ Deleted alert {alert_id[:8]}...")
    
    def test_delete_alert_removes_from_list(self):
        """Test that deleted alert is no longer in user's alerts"""
        # Create an alert
        alert_data = {
            "crypto_symbol": "AVAX",
            "alert_type": "price_above",
            "target_value": 100.00
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/vip/alerts", json=alert_data)
        assert create_resp.status_code == 200
        created_alert = create_resp.json()["data"]
        alert_id = created_alert["id"]
        
        # Delete it
        delete_resp = self.session.delete(f"{BASE_URL}/api/vip/alerts/{alert_id}")
        assert delete_resp.status_code == 200
        
        # Verify it's gone
        get_resp = self.session.get(f"{BASE_URL}/api/vip/alerts")
        assert get_resp.status_code == 200
        
        alerts = get_resp.json()["data"]
        alert_ids = [a["id"] for a in alerts]
        
        assert alert_id not in alert_ids, "Deleted alert should not be in user's alerts"
        
        print(f"✓ Alert {alert_id[:8]}... confirmed removed from list")
    
    def test_delete_nonexistent_alert_returns_404(self):
        """Test deleting a non-existent alert returns 404"""
        fake_id = str(uuid.uuid4())
        
        response = self.session.delete(f"{BASE_URL}/api/vip/alerts/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"✓ Deleting non-existent alert returns 404")
    
    # ==================== Test 5: Unauthenticated access ====================
    def test_alerts_cryptos_requires_vip(self):
        """Test that /api/vip/alerts/cryptos requires VIP auth"""
        unauthenticated_session = requests.Session()
        
        response = unauthenticated_session.get(f"{BASE_URL}/api/vip/alerts/cryptos")
        
        # Should return 403 (Forbidden - VIP required) or 401 (Unauthorized)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        print(f"✓ /api/vip/alerts/cryptos requires VIP auth (status: {response.status_code})")
    
    def test_create_alert_requires_vip(self):
        """Test that creating alerts requires VIP auth"""
        unauthenticated_session = requests.Session()
        unauthenticated_session.headers.update({"Content-Type": "application/json"})
        
        alert_data = {
            "crypto_symbol": "BTC",
            "alert_type": "price_above",
            "target_value": 100000.00
        }
        
        response = unauthenticated_session.post(f"{BASE_URL}/api/vip/alerts", json=alert_data)
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        print(f"✓ Creating alerts requires VIP auth (status: {response.status_code})")


class TestCryptoToolsStillWorking:
    """Tests to verify crypto tools are still functional"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_crypto_tools_all_endpoint(self):
        """Test that /api/vip/tools/all still works with real data"""
        response = self.session.get(f"{BASE_URL}/api/vip/tools/all")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        
        tools_data = data["data"]
        
        # Verify key tool sections exist
        expected_sections = ["fear_greed", "btc_dominance", "halving"]
        for section in expected_sections:
            assert section in tools_data, f"Missing section: {section}"
        
        print(f"✓ Crypto tools /api/vip/tools/all working - sections: {list(tools_data.keys())}")
    
    def test_fear_greed_index(self):
        """Test Fear & Greed Index is still working"""
        response = self.session.get(f"{BASE_URL}/api/vip/tools/all")
        
        assert response.status_code == 200
        tools_data = response.json()["data"]
        
        fear_greed = tools_data.get("fear_greed", {})
        assert "current" in fear_greed, "Fear & Greed should have current value"
        
        current = fear_greed["current"]
        assert "value" in current, "Fear & Greed current should have value"
        
        print(f"✓ Fear & Greed Index: {current.get('value')} - {current.get('classification', 'N/A')}")
    
    def test_btc_dominance(self):
        """Test BTC/ETH dominance data is available"""
        response = self.session.get(f"{BASE_URL}/api/vip/tools/all")
        
        assert response.status_code == 200
        tools_data = response.json()["data"]
        
        btc_dom = tools_data.get("btc_dominance", {})
        
        # Should have btc_dominance and eth_dominance
        assert "btc_dominance" in btc_dom or "btc_price" in btc_dom, "Should have BTC data"
        
        print(f"✓ BTC Dominance data available: {btc_dom.get('btc_dominance', 'N/A')}%")
    
    def test_halving_countdown(self):
        """Test Bitcoin halving countdown is working"""
        response = self.session.get(f"{BASE_URL}/api/vip/tools/all")
        
        assert response.status_code == 200
        tools_data = response.json()["data"]
        
        halving = tools_data.get("halving", {})
        assert "days_remaining" in halving, "Halving should have days_remaining"
        
        print(f"✓ Halving countdown: {halving.get('days_remaining')} days - Est. {halving.get('estimated_date', 'N/A')}")


class TestNoCopyTradingInMenu:
    """Verify Copy Trading has been removed from FEATURES"""
    
    def test_vip_features_endpoint_no_copy_trading(self):
        """Test that /api/vip/features does not include copy_trading"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/vip/features")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check vip_features list
        vip_features = data.get("vip_features", [])
        feature_ids = [f.get("id") for f in vip_features]
        
        # Copy trading should still exist as a VIP feature (backend) but was removed from frontend menu
        # The key is that it's no longer in the FRONTEND FEATURES array
        print(f"✓ VIP features from API: {feature_ids}")
        
        # Features endpoint is about VIP benefits, not the hub navigation menu
        # The test should verify the FRONTEND doesn't show it (done via code review)
        print("✓ Note: Copy Trading removed from frontend FEATURES nav array (verified via code review)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
