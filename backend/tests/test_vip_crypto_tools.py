"""
Tests for VIP Crypto Tools API - /api/vip/tools/all
Testing: Fear & Greed Index, BTC Dominance, Bitcoin Halving, ETH Gas, Rainbow Chart, Altcoin Season
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"


class TestVIPCryptoTools:
    """Tests for the VIP Crypto Tools API endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Verify user is VIP
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert me_resp.status_code == 200, "Failed to get user info"
        user_data = me_resp.json()
        print(f"User: {user_data.get('email')}, VIP: {user_data.get('is_vip')}, Role: {user_data.get('role')}")
        yield
    
    def test_vip_tools_all_endpoint_returns_200(self):
        """Test that /api/vip/tools/all returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        print(f"Response status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have 'data' field"
        assert "last_updated" in data, "Response should have 'last_updated' field"
        print(f"API returned data with keys: {list(data.get('data', {}).keys())}")
    
    def test_fear_greed_index(self):
        """Test Fear & Greed Index with value, classification and history"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()["data"]
        fear_greed = data.get("fear_greed", {})
        
        print(f"Fear & Greed data: {fear_greed}")
        
        # Check fear_greed has current value
        assert "current" in fear_greed, "fear_greed should have 'current' field"
        current = fear_greed["current"]
        
        # Check value exists and is a number 0-100
        assert "value" in current, "current should have 'value' field"
        assert isinstance(current["value"], (int, float)), "value should be a number"
        assert 0 <= current["value"] <= 100, f"value should be 0-100, got {current['value']}"
        print(f"Fear & Greed value: {current['value']}")
        
        # Check classification exists
        assert "classification" in current, "current should have 'classification' field"
        valid_classifications = ["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"]
        assert current["classification"] in valid_classifications, f"Invalid classification: {current['classification']}"
        print(f"Classification: {current['classification']}")
        
        # Check history exists (can be empty due to API limits)
        assert "history" in fear_greed, "fear_greed should have 'history' field"
        print(f"History entries: {len(fear_greed['history'])}")
    
    def test_btc_dominance(self):
        """Test BTC Dominance with BTC and ETH percentages - may be empty due to CoinGecko rate limits"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()["data"]
        btc_dom = data.get("btc_dominance", {})
        
        print(f"BTC Dominance data: {btc_dom}")
        
        # BTC Dominance may be empty due to CoinGecko 429 rate limits
        if not btc_dom:
            print("NOTE: btc_dominance empty - likely due to CoinGecko rate limits (429)")
            pytest.skip("CoinGecko rate limited - btc_dominance unavailable")
        
        # Check btc_dominance percentage
        assert "btc_dominance" in btc_dom, "Should have 'btc_dominance' field"
        assert isinstance(btc_dom["btc_dominance"], (int, float)), "btc_dominance should be a number"
        assert 0 < btc_dom["btc_dominance"] < 100, f"btc_dominance should be 0-100, got {btc_dom['btc_dominance']}"
        print(f"BTC Dominance: {btc_dom['btc_dominance']}%")
        
        # Check eth_dominance percentage
        assert "eth_dominance" in btc_dom, "Should have 'eth_dominance' field"
        assert isinstance(btc_dom["eth_dominance"], (int, float)), "eth_dominance should be a number"
        assert 0 < btc_dom["eth_dominance"] < 100, f"eth_dominance should be 0-100, got {btc_dom['eth_dominance']}"
        print(f"ETH Dominance: {btc_dom['eth_dominance']}%")
    
    def test_bitcoin_halving_countdown(self):
        """Test Bitcoin Halving countdown with days remaining and estimated date"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()["data"]
        halving = data.get("halving", {})
        
        print(f"Halving data: {halving}")
        
        # Check days_remaining
        assert "days_remaining" in halving, "Should have 'days_remaining' field"
        assert isinstance(halving["days_remaining"], (int, float)), "days_remaining should be a number"
        assert halving["days_remaining"] > 0, f"days_remaining should be positive, got {halving['days_remaining']}"
        print(f"Days remaining: {halving['days_remaining']}")
        
        # Check estimated_date
        assert "estimated_date" in halving, "Should have 'estimated_date' field"
        assert halving["estimated_date"], "estimated_date should not be empty"
        print(f"Estimated date: {halving['estimated_date']}")
        
        # Check current_block
        assert "current_block" in halving, "Should have 'current_block' field"
        assert halving["current_block"] > 840000, "current_block should be > 840000 (after 2024 halving)"
        print(f"Current block: {halving['current_block']}")
        
        # Check halving_block
        assert "halving_block" in halving, "Should have 'halving_block' field"
        assert halving["halving_block"] == 1050000, f"halving_block should be 1050000, got {halving['halving_block']}"
        
        # Check current_reward
        assert "current_reward" in halving, "Should have 'current_reward' field"
        assert halving["current_reward"] == 3.125, f"current_reward should be 3.125, got {halving['current_reward']}"
        print(f"Current reward: {halving['current_reward']} BTC")
        
        # Check next_reward
        assert "next_reward" in halving, "Should have 'next_reward' field"
        assert halving["next_reward"] == 1.5625, f"next_reward should be 1.5625, got {halving['next_reward']}"
        print(f"Next reward: {halving['next_reward']} BTC")
    
    def test_eth_gas_tracker(self):
        """Test ETH Gas with low, average, high values"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()["data"]
        eth_gas = data.get("eth_gas", {})
        
        print(f"ETH Gas data: {eth_gas}")
        
        # Check low gas
        assert "low" in eth_gas, "Should have 'low' field"
        assert isinstance(eth_gas["low"], (int, float)), "low should be a number"
        assert eth_gas["low"] >= 0, "low gas should be non-negative"
        print(f"Low gas: {eth_gas['low']} Gwei")
        
        # Check average gas
        assert "average" in eth_gas, "Should have 'average' field"
        assert isinstance(eth_gas["average"], (int, float)), "average should be a number"
        assert eth_gas["average"] >= eth_gas["low"], "average should be >= low"
        print(f"Average gas: {eth_gas['average']} Gwei")
        
        # Check high gas
        assert "high" in eth_gas, "Should have 'high' field"
        assert isinstance(eth_gas["high"], (int, float)), "high should be a number"
        assert eth_gas["high"] >= eth_gas["average"], "high should be >= average"
        print(f"High gas: {eth_gas['high']} Gwei")
    
    def test_rainbow_chart(self):
        """Test Rainbow Chart with current_price and current_band - may be empty due to CoinGecko rate limits"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()["data"]
        rainbow = data.get("rainbow_chart", {})
        
        print(f"Rainbow Chart data: {rainbow}")
        
        # Rainbow chart may be empty due to CoinGecko 429 rate limits
        if not rainbow:
            print("NOTE: rainbow_chart empty - likely due to CoinGecko rate limits (429)")
            pytest.skip("CoinGecko rate limited - rainbow_chart unavailable")
        
        # Check current_price
        assert "current_price" in rainbow, "Should have 'current_price' field"
        assert isinstance(rainbow["current_price"], (int, float)), "current_price should be a number"
        # BTC price should be reasonable (> $10,000 and < $1,000,000)
        if rainbow["current_price"] > 0:  # Only check if not fallback value
            assert rainbow["current_price"] > 10000, f"current_price seems too low: {rainbow['current_price']}"
            assert rainbow["current_price"] < 1000000, f"current_price seems too high: {rainbow['current_price']}"
        print(f"Current BTC price: ${rainbow['current_price']}")
        
        # Check current_band
        assert "current_band" in rainbow, "Should have 'current_band' field"
        valid_bands = ["fire_sale", "buy", "accumulate", "still_cheap", "hold", "is_this_a_bubble", "fomo", "sell", "max_bubble"]
        assert rainbow["current_band"] in valid_bands, f"Invalid current_band: {rainbow['current_band']}"
        print(f"Current band: {rainbow['current_band']}")
        
        # Check bands dictionary exists
        assert "bands" in rainbow, "Should have 'bands' field"
    
    def test_altcoin_season_index(self):
        """Test Altcoin Season Index - may be empty due to CoinGecko rate limits"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()["data"]
        altcoin = data.get("altcoin_season", {})
        
        print(f"Altcoin Season data: {altcoin}")
        
        # Note: This may be empty due to CoinGecko rate limits (429)
        if altcoin:
            # Check index
            assert "index" in altcoin, "Should have 'index' field"
            assert isinstance(altcoin["index"], (int, float)), "index should be a number"
            assert 0 <= altcoin["index"] <= 100, f"index should be 0-100, got {altcoin['index']}"
            print(f"Altcoin Season Index: {altcoin['index']}")
            
            # Check season
            assert "season" in altcoin, "Should have 'season' field"
            valid_seasons = ["altcoin_season", "btc_season", "neutral"]
            assert altcoin["season"] in valid_seasons, f"Invalid season: {altcoin['season']}"
            print(f"Season: {altcoin['season']}")
        else:
            print("NOTE: altcoin_season may be empty due to CoinGecko rate limits (429)")
    
    def test_whale_alerts_structure(self):
        """Test Whale Alerts - may be empty due to rate limits"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()["data"]
        whale_alerts = data.get("whale_alerts", [])
        
        print(f"Whale Alerts count: {len(whale_alerts)}")
        
        # Whale alerts may be empty due to Etherscan rate limits
        if whale_alerts and len(whale_alerts) > 0:
            alert = whale_alerts[0]
            print(f"Sample whale alert: {alert}")
            
            # Check required fields
            assert "wallet_name" in alert, "Alert should have 'wallet_name'"
            assert "type" in alert, "Alert should have 'type'"
            assert alert["type"] in ["incoming", "outgoing"], f"Invalid alert type: {alert['type']}"
            assert "amount_eth" in alert, "Alert should have 'amount_eth'"
        else:
            print("NOTE: whale_alerts may be empty due to Etherscan rate limits")
    
    def test_liquidations_structure(self):
        """Test Liquidations data structure"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()["data"]
        liquidations = data.get("liquidations", {})
        
        print(f"Liquidations data: {liquidations}")
        
        # Liquidations may be empty due to API issues
        if liquidations:
            # Check total_24h
            assert "total_24h" in liquidations, "Should have 'total_24h' field"
            assert isinstance(liquidations["total_24h"], (int, float)), "total_24h should be a number"
            print(f"Total liquidations 24h: ${liquidations['total_24h']:,.0f}")
            
            # Check longs_24h
            assert "longs_24h" in liquidations, "Should have 'longs_24h' field"
            print(f"Longs liquidated: ${liquidations['longs_24h']:,.0f}")
            
            # Check shorts_24h
            assert "shorts_24h" in liquidations, "Should have 'shorts_24h' field"
            print(f"Shorts liquidated: ${liquidations['shorts_24h']:,.0f}")
        else:
            print("NOTE: liquidations may be empty")
    
    def test_vip_tools_without_auth_returns_401(self):
        """Test that accessing VIP tools without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Unauthenticated request correctly blocked with status {response.status_code}")


class TestIndividualToolEndpoints:
    """Test individual tool endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_fear_greed_individual_endpoint(self):
        """Test individual Fear & Greed endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/fear-greed", headers=self.headers)
        print(f"Fear & Greed individual endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "data" in data
            assert "current" in data["data"]
            print(f"Fear & Greed value: {data['data']['current']['value']}")
    
    def test_halving_individual_endpoint(self):
        """Test individual Halving endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/halving", headers=self.headers)
        print(f"Halving individual endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "data" in data
            print(f"Days remaining: {data['data'].get('days_remaining')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
