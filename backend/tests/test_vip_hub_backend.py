"""
VIP Hub Backend API Tests
Tests for: /api/vip/tools/all, /api/vip/alerts (CRUD), /api/vip/alerts/cryptos, /api/vip/academy
Focus on backend API responses and data structure validation.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    BASE_URL = "https://academy-preview-11.preview.emergentagent.com"

# Test credentials for VIP user
TEST_EMAIL = "admin@cryptonai.com"
TEST_PASSWORD = "Admin123!"

class TestVIPToolsAPI:
    """Tests for /api/vip/tools/all endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token for VIP tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_vip_tools_endpoint_requires_auth(self):
        """Test that /api/vip/tools/all requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ VIP tools endpoint requires authentication")
    
    def test_vip_tools_returns_all_tools(self):
        """Test that /api/vip/tools/all returns all expected tools"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have 'data' field"
        
        tools_data = data["data"]
        
        # Verify all 8 required tools are present
        required_tools = [
            "fear_greed", "btc_dominance", "eth_gas", "rainbow_chart",
            "altcoin_season", "halving", "whale_alerts", "liquidations"
        ]
        
        for tool in required_tools:
            assert tool in tools_data, f"Missing required tool: {tool}"
            print(f"✅ Found tool: {tool}")
        
        print(f"✅ All {len(required_tools)} required tools present in response")
    
    def test_fear_greed_structure(self):
        """Test Fear & Greed Index structure"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        fear_greed = response.json()["data"]["fear_greed"]
        
        # Check structure
        assert "current" in fear_greed, "fear_greed should have 'current'"
        assert "value" in fear_greed["current"], "current should have 'value'"
        
        # Value should be between 0-100
        value = fear_greed["current"]["value"]
        assert 0 <= value <= 100, f"Fear & Greed value should be 0-100, got {value}"
        
        print(f"✅ Fear & Greed Index: {value} ({fear_greed['current'].get('classification', 'N/A')})")
    
    def test_btc_dominance_structure(self):
        """Test BTC Dominance structure"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        btc_dom = response.json()["data"]["btc_dominance"]
        
        # Required fields
        required_fields = ["btc_dominance", "eth_dominance", "btc_price", "eth_price"]
        for field in required_fields:
            assert field in btc_dom, f"btc_dominance missing field: {field}"
        
        # Validate dominance values
        assert 0 < btc_dom["btc_dominance"] < 100, "BTC dominance should be 0-100"
        assert btc_dom["btc_price"] > 0, "BTC price should be positive"
        assert btc_dom["eth_price"] > 0, "ETH price should be positive"
        
        print(f"✅ BTC Dominance: {btc_dom['btc_dominance']}%, ETH: {btc_dom['eth_dominance']}%")
        print(f"✅ BTC Price: ${btc_dom['btc_price']}, ETH Price: ${btc_dom['eth_price']}")
    
    def test_eth_gas_structure(self):
        """Test ETH Gas Tracker structure"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        eth_gas = response.json()["data"]["eth_gas"]
        
        # Required fields
        required_fields = ["low", "average", "high"]
        for field in required_fields:
            assert field in eth_gas, f"eth_gas missing field: {field}"
        
        # Values should be non-negative
        assert eth_gas["low"] >= 0, "Gas low should be non-negative"
        assert eth_gas["average"] >= 0, "Gas average should be non-negative"
        assert eth_gas["high"] >= 0, "Gas high should be non-negative"
        
        print(f"✅ ETH Gas: Low={eth_gas['low']}, Avg={eth_gas['average']}, High={eth_gas['high']} Gwei")
    
    def test_rainbow_chart_structure(self):
        """Test Rainbow Chart structure"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        rainbow = response.json()["data"]["rainbow_chart"]
        
        # Required fields
        assert "current_price" in rainbow, "rainbow_chart missing current_price"
        assert "current_band" in rainbow, "rainbow_chart missing current_band"
        
        # Valid bands
        valid_bands = ["fire_sale", "buy", "accumulate", "still_cheap", "hold", 
                       "is_this_a_bubble", "fomo", "sell", "max_bubble"]
        assert rainbow["current_band"] in valid_bands, f"Invalid band: {rainbow['current_band']}"
        
        print(f"✅ Rainbow Chart: ${rainbow['current_price']} - Band: {rainbow['current_band']}")
    
    def test_altcoin_season_structure(self):
        """Test Altcoin Season Index structure"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        altcoin = response.json()["data"]["altcoin_season"]
        
        # Required fields
        assert "index" in altcoin, "altcoin_season missing index"
        assert "season" in altcoin, "altcoin_season missing season"
        
        # Index should be 0-100
        index = altcoin["index"]
        assert 0 <= index <= 100, f"Altcoin index should be 0-100, got {index}"
        
        print(f"✅ Altcoin Season: {index} - {altcoin.get('season_label', altcoin['season'])}")
    
    def test_halving_structure(self):
        """Test Bitcoin Halving Countdown structure"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        halving = response.json()["data"]["halving"]
        
        # Required fields
        required_fields = ["current_block", "halving_block", "days_remaining", 
                          "estimated_date", "current_reward", "next_reward"]
        for field in required_fields:
            assert field in halving, f"halving missing field: {field}"
        
        assert halving["days_remaining"] >= 0, "Days remaining should be non-negative"
        assert halving["current_block"] > 0, "Current block should be positive"
        
        print(f"✅ Halving: {halving['days_remaining']} days remaining")
        print(f"✅ Current block: {halving['current_block']}, Est. date: {halving['estimated_date']}")
    
    def test_whale_alerts_structure(self):
        """Test Whale Alerts structure (can be empty list)"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        whale_alerts = response.json()["data"]["whale_alerts"]
        
        # Should be a list
        assert isinstance(whale_alerts, list), "whale_alerts should be a list"
        
        # If not empty, check structure
        if whale_alerts:
            alert = whale_alerts[0]
            # Should have key fields
            assert "wallet_name" in alert or "id" in alert, "Whale alert should have identifier"
            print(f"✅ Whale Alerts: {len(whale_alerts)} alerts found")
        else:
            print("✅ Whale Alerts: Empty list (no large transactions in threshold)")
    
    def test_liquidations_structure(self):
        """Test Liquidations structure"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        liquidations = response.json()["data"]["liquidations"]
        
        # Required fields
        required_fields = ["total_24h", "longs_24h", "shorts_24h"]
        for field in required_fields:
            assert field in liquidations, f"liquidations missing field: {field}"
        
        assert liquidations["total_24h"] >= 0, "Total liquidations should be non-negative"
        
        print(f"✅ Liquidations 24h: ${liquidations['total_24h']:,.0f}")
        print(f"✅ Longs: ${liquidations['longs_24h']:,.0f}, Shorts: ${liquidations['shorts_24h']:,.0f}")


class TestVIPAlertsAPI:
    """Tests for /api/vip/alerts CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token for VIP tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_alerts = []
    
    def teardown_method(self, method):
        """Cleanup: Delete alerts created during tests"""
        for alert_id in self.created_alerts:
            try:
                requests.delete(f"{BASE_URL}/api/vip/alerts/{alert_id}", headers=self.headers)
            except:
                pass
    
    def test_alerts_endpoint_requires_auth(self):
        """Test that /api/vip/alerts requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/alerts")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ VIP alerts endpoint requires authentication")
    
    def test_get_alerts_list(self):
        """Test GET /api/vip/alerts returns alerts list"""
        response = requests.get(f"{BASE_URL}/api/vip/alerts", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should have 'success' field"
        assert "data" in data, "Response should have 'data' field"
        assert isinstance(data["data"], list), "data should be a list"
        
        print(f"✅ GET /api/vip/alerts: {len(data['data'])} alerts returned")
    
    def test_create_alert_price_above(self):
        """Test POST /api/vip/alerts - Create price_above alert"""
        alert_data = {
            "crypto_symbol": "BTC",
            "alert_type": "price_above",
            "target_value": 100000.0,
            "notification_method": "push"
        }
        
        response = requests.post(f"{BASE_URL}/api/vip/alerts", headers=self.headers, json=alert_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have 'data' field"
        
        created_alert = data["data"]
        assert created_alert["crypto_symbol"] == "BTC"
        assert created_alert["alert_type"] == "price_above"
        assert created_alert["target_value"] == 100000.0
        
        # Track for cleanup
        self.created_alerts.append(created_alert["id"])
        
        print(f"✅ Created price_above alert: BTC > $100,000")
    
    def test_create_alert_price_below(self):
        """Test POST /api/vip/alerts - Create price_below alert"""
        alert_data = {
            "crypto_symbol": "ETH",
            "alert_type": "price_below",
            "target_value": 2000.0,
            "notification_method": "push"
        }
        
        response = requests.post(f"{BASE_URL}/api/vip/alerts", headers=self.headers, json=alert_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        created_alert = data["data"]
        assert created_alert["crypto_symbol"] == "ETH"
        assert created_alert["alert_type"] == "price_below"
        
        self.created_alerts.append(created_alert["id"])
        
        print(f"✅ Created price_below alert: ETH < $2,000")
    
    def test_delete_alert(self):
        """Test DELETE /api/vip/alerts/{id}"""
        # First create an alert
        alert_data = {
            "crypto_symbol": "SOL",
            "alert_type": "price_above",
            "target_value": 500.0,
            "notification_method": "push"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/vip/alerts", headers=self.headers, json=alert_data)
        assert create_response.status_code == 200
        alert_id = create_response.json()["data"]["id"]
        
        # Now delete it
        delete_response = requests.delete(f"{BASE_URL}/api/vip/alerts/{alert_id}", headers=self.headers)
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        print(f"✅ Deleted alert {alert_id}")
    
    def test_delete_nonexistent_alert(self):
        """Test DELETE /api/vip/alerts/{id} with non-existent ID"""
        fake_id = "nonexistent-alert-id-12345"
        response = requests.delete(f"{BASE_URL}/api/vip/alerts/{fake_id}", headers=self.headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✅ Delete non-existent alert returns 404")


class TestVIPAvailableCryptosAPI:
    """Tests for /api/vip/alerts/cryptos endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token for VIP tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_available_cryptos_requires_auth(self):
        """Test that /api/vip/alerts/cryptos requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/alerts/cryptos")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Available cryptos endpoint requires authentication")
    
    def test_available_cryptos_returns_20(self):
        """Test /api/vip/alerts/cryptos returns 20 cryptos"""
        response = requests.get(f"{BASE_URL}/api/vip/alerts/cryptos", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have 'data' field"
        
        cryptos = data["data"]
        assert len(cryptos) == 20, f"Expected 20 cryptos, got {len(cryptos)}"
        
        print(f"✅ /api/vip/alerts/cryptos returns {len(cryptos)} cryptos")
    
    def test_available_cryptos_structure(self):
        """Test each crypto has required fields"""
        response = requests.get(f"{BASE_URL}/api/vip/alerts/cryptos", headers=self.headers)
        assert response.status_code == 200
        
        cryptos = response.json()["data"]
        
        # Check structure of first crypto
        required_fields = ["id", "symbol", "name"]
        for crypto in cryptos[:5]:  # Check first 5
            for field in required_fields:
                assert field in crypto, f"Crypto missing field: {field}"
        
        # Print crypto list
        symbols = [c["symbol"] for c in cryptos]
        print(f"✅ Available cryptos: {', '.join(symbols)}")
    
    def test_popular_cryptos_included(self):
        """Test that popular cryptos are in the list"""
        response = requests.get(f"{BASE_URL}/api/vip/alerts/cryptos", headers=self.headers)
        assert response.status_code == 200
        
        cryptos = response.json()["data"]
        symbols = [c["symbol"].upper() for c in cryptos]
        
        # These should definitely be in the list
        must_have = ["BTC", "ETH", "BNB", "SOL", "XRP"]
        for crypto in must_have:
            assert crypto in symbols, f"Missing popular crypto: {crypto}"
        
        print(f"✅ All must-have cryptos present: {', '.join(must_have)}")


class TestVIPAcademyAPI:
    """Tests for /api/vip/academy endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token for VIP tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_academy_endpoint_requires_auth(self):
        """Test that /api/vip/academy requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/academy")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ VIP academy endpoint requires authentication")
    
    def test_academy_returns_5_courses(self):
        """Test /api/vip/academy returns 5 courses"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have 'data' field"
        
        courses = data["data"]
        assert len(courses) == 5, f"Expected 5 courses, got {len(courses)}"
        
        print(f"✅ /api/vip/academy returns {len(courses)} courses")
    
    def test_course_structure(self):
        """Test each course has required fields"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 200
        
        courses = response.json()["data"]
        
        required_fields = ["id", "title", "description", "modules", "duration", "difficulty"]
        
        for course in courses:
            for field in required_fields:
                assert field in course, f"Course missing field: {field}"
            
            print(f"✅ Course: {course['title']} ({course['difficulty']})")
    
    def test_course_has_module_content(self):
        """Test each course has detailed module_content"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 200
        
        courses = response.json()["data"]
        
        for course in courses:
            assert "module_content" in course, f"Course '{course['title']}' missing module_content"
            module_content = course["module_content"]
            
            assert isinstance(module_content, list), "module_content should be a list"
            assert len(module_content) > 0, f"Course '{course['title']}' has empty module_content"
            
            # Check first module structure
            first_module = module_content[0]
            module_fields = ["id", "title", "duration", "content"]
            for field in module_fields:
                assert field in first_module, f"Module missing field: {field}"
            
            print(f"✅ Course '{course['title']}': {len(module_content)} modules with detailed content")
    
    def test_course_progress_fields(self):
        """Test courses include progress tracking fields"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 200
        
        courses = response.json()["data"]
        
        for course in courses:
            # These fields should be added by the API
            assert "progress_percent" in course, f"Course missing progress_percent"
            assert "completed" in course, f"Course missing completed"
            assert "started" in course, f"Course missing started"
            
            progress = course["progress_percent"]
            assert 0 <= progress <= 100, f"Progress should be 0-100, got {progress}"
        
        print("✅ All courses have progress tracking fields")


class TestVIPUserAuthentication:
    """Tests for VIP user authentication and authorization"""
    
    def test_login_with_valid_credentials(self):
        """Test login with valid VIP credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should have access_token"
        assert "user" in data, "Response should have user"
        
        user = data["user"]
        assert user.get("is_vip") == True or user.get("role") in ["admin", "super_admin"], \
            f"User should be VIP or admin: {user}"
        
        print(f"✅ Login successful: {user['email']} (VIP: {user.get('is_vip')}, Role: {user.get('role')})")
    
    def test_login_with_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid credentials return 401")


# Quick summary test to validate all endpoints in one test
class TestVIPEndpointsSummary:
    """Summary test to validate all VIP endpoints work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_all_vip_endpoints_accessible(self):
        """Test all 4 main VIP endpoints are accessible"""
        endpoints = [
            ("/api/vip/tools/all", "Crypto Tools"),
            ("/api/vip/alerts", "Alerts"),
            ("/api/vip/alerts/cryptos", "Available Cryptos"),
            ("/api/vip/academy", "Academy Courses")
        ]
        
        results = []
        for endpoint, name in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=self.headers)
            status = "✅" if response.status_code == 200 else "❌"
            results.append((name, response.status_code, status))
            
        print("\n" + "="*50)
        print("VIP ENDPOINTS SUMMARY")
        print("="*50)
        for name, status_code, status in results:
            print(f"{status} {name}: HTTP {status_code}")
        print("="*50)
        
        # All should be 200
        for name, status_code, _ in results:
            assert status_code == 200, f"{name} returned {status_code}"
        
        print("✅ All VIP endpoints accessible and working!")
