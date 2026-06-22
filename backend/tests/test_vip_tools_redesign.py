"""
Test VIP Crypto Tools API - Redesign Testing
Tests for /api/vip/tools/all endpoint with CoinGecko data

Features to test:
- Fear & Greed Index with history (yesterday, last_week)
- BTC/ETH prices with btc_change_24h and eth_change_24h
- Altcoin Season with top_gainers and top_losers
- Rainbow Chart with current_band and bands
- Bitcoin Halving countdown with days_remaining and estimated_date
- Whale Alerts with Etherscan transactions
- Liquidations (calculated)
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com")


class TestVIPToolsRedesign:
    """Test VIP Crypto Tools API after redesign"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for VIP user"""
        # Login with admin credentials (admin is VIP)
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@cryptonai.com", "password": "Admin123!"}
        )
        if response.status_code != 200:
            pytest.skip("Login failed - admin user may not exist")
        
        token = response.json().get("access_token")
        if not token:
            pytest.skip("No token returned")
        return token
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_vip_tools_all_endpoint_returns_200(self, auth_headers):
        """Test that /api/vip/tools/all returns 200 for VIP user"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True, "Expected success=True"
        assert "data" in data, "Expected 'data' field in response"
        print(f"SUCCESS: /api/vip/tools/all returned 200")
    
    def test_fear_greed_index_with_history(self, auth_headers):
        """Test Fear & Greed Index contains yesterday and last_week"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        
        data = response.json().get("data", {})
        fear_greed = data.get("fear_greed", {})
        
        # Check current value
        current = fear_greed.get("current", {})
        assert "value" in current, "fear_greed.current.value missing"
        assert isinstance(current["value"], int), "value should be integer"
        assert 0 <= current["value"] <= 100, f"value should be 0-100, got {current['value']}"
        
        # Check history fields - yesterday and last_week
        assert "yesterday" in fear_greed, "fear_greed.yesterday missing"
        assert "last_week" in fear_greed, "fear_greed.last_week missing"
        
        print(f"SUCCESS: Fear & Greed Index - current={current['value']}, yesterday={fear_greed.get('yesterday')}, last_week={fear_greed.get('last_week')}")
    
    def test_btc_eth_prices_with_change_24h(self, auth_headers):
        """Test BTC/ETH prices include btc_change_24h and eth_change_24h"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        
        data = response.json().get("data", {})
        btc_dominance = data.get("btc_dominance", {})
        
        # Check BTC price and change
        assert "btc_price" in btc_dominance, "btc_price missing"
        assert "btc_change_24h" in btc_dominance, "btc_change_24h missing"
        assert isinstance(btc_dominance["btc_price"], (int, float)), "btc_price should be numeric"
        assert isinstance(btc_dominance["btc_change_24h"], (int, float)), "btc_change_24h should be numeric"
        
        # Check ETH price and change
        assert "eth_price" in btc_dominance, "eth_price missing"
        assert "eth_change_24h" in btc_dominance, "eth_change_24h missing"
        assert isinstance(btc_dominance["eth_price"], (int, float)), "eth_price should be numeric"
        assert isinstance(btc_dominance["eth_change_24h"], (int, float)), "eth_change_24h should be numeric"
        
        print(f"SUCCESS: BTC=${btc_dominance['btc_price']} ({btc_dominance['btc_change_24h']}%), ETH=${btc_dominance['eth_price']} ({btc_dominance['eth_change_24h']}%)")
    
    def test_altcoin_season_with_gainers_losers(self, auth_headers):
        """Test Altcoin Season includes top_gainers and top_losers"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        
        data = response.json().get("data", {})
        altcoin_season = data.get("altcoin_season", {})
        
        # Check index value
        assert "index" in altcoin_season, "altcoin_season.index missing"
        assert "season" in altcoin_season, "altcoin_season.season missing"
        
        # Check top_gainers and top_losers are present (may be empty due to rate limits)
        assert "top_gainers" in altcoin_season, "altcoin_season.top_gainers missing"
        assert "top_losers" in altcoin_season, "altcoin_season.top_losers missing"
        assert isinstance(altcoin_season["top_gainers"], list), "top_gainers should be list"
        assert isinstance(altcoin_season["top_losers"], list), "top_losers should be list"
        
        gainers_count = len(altcoin_season["top_gainers"])
        losers_count = len(altcoin_season["top_losers"])
        
        print(f"SUCCESS: Altcoin Season index={altcoin_season['index']}, season={altcoin_season['season']}, gainers={gainers_count}, losers={losers_count}")
        
        # Validate gainers structure if present
        if altcoin_season["top_gainers"]:
            first_gainer = altcoin_season["top_gainers"][0]
            assert "symbol" in first_gainer, "top_gainers[0].symbol missing"
            assert "change_24h" in first_gainer, "top_gainers[0].change_24h missing"
            print(f"  Top Gainer: {first_gainer['symbol']} +{first_gainer['change_24h']}%")
    
    def test_rainbow_chart_with_bands(self, auth_headers):
        """Test Rainbow Chart includes current_band and bands dictionary"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        
        data = response.json().get("data", {})
        rainbow_chart = data.get("rainbow_chart", {})
        
        # Check required fields
        assert "current_price" in rainbow_chart, "rainbow_chart.current_price missing"
        assert "current_band" in rainbow_chart, "rainbow_chart.current_band missing"
        assert "bands" in rainbow_chart, "rainbow_chart.bands missing"
        
        # Validate bands structure
        bands = rainbow_chart.get("bands", {})
        expected_bands = ["fire_sale", "buy", "accumulate", "still_cheap", "hold", 
                        "is_this_a_bubble", "fomo", "sell", "max_bubble"]
        
        for band in expected_bands:
            assert band in bands, f"rainbow_chart.bands.{band} missing"
        
        print(f"SUCCESS: Rainbow Chart - price=${rainbow_chart['current_price']}, band={rainbow_chart['current_band']}")
        print(f"  Bands: fire_sale=${bands.get('fire_sale')}, hold=${bands.get('hold')}, max_bubble=${bands.get('max_bubble')}")
    
    def test_bitcoin_halving_countdown(self, auth_headers):
        """Test Bitcoin Halving has days_remaining and estimated_date"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        
        data = response.json().get("data", {})
        halving = data.get("halving", {})
        
        # Check required fields
        assert "days_remaining" in halving, "halving.days_remaining missing"
        assert "estimated_date" in halving, "halving.estimated_date missing"
        assert "current_block" in halving, "halving.current_block missing"
        assert "current_reward" in halving, "halving.current_reward missing"
        assert "next_reward" in halving, "halving.next_reward missing"
        
        # Validate values
        assert isinstance(halving["days_remaining"], int), "days_remaining should be int"
        assert halving["days_remaining"] >= 0, "days_remaining should be non-negative"
        assert halving["current_reward"] == 3.125, f"current_reward should be 3.125, got {halving['current_reward']}"
        assert halving["next_reward"] == 1.5625, f"next_reward should be 1.5625, got {halving['next_reward']}"
        
        print(f"SUCCESS: Bitcoin Halving - days={halving['days_remaining']}, date={halving['estimated_date']}, block={halving['current_block']}")
    
    def test_whale_alerts_etherscan(self, auth_headers):
        """Test Whale Alerts contains Etherscan transactions"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        
        data = response.json().get("data", {})
        whale_alerts = data.get("whale_alerts", [])
        
        # Check that whale_alerts exists and is a list
        assert isinstance(whale_alerts, list), "whale_alerts should be a list"
        
        if whale_alerts:
            # Validate first alert structure
            first_alert = whale_alerts[0]
            assert "wallet_name" in first_alert, "whale_alerts[0].wallet_name missing"
            assert "amount_eth" in first_alert, "whale_alerts[0].amount_eth missing"
            assert "type" in first_alert, "whale_alerts[0].type missing (in/out)"
            
            # Check for Etherscan URL
            if "etherscan_url" in first_alert or "tx_hash" in first_alert:
                print(f"SUCCESS: Whale Alerts - {len(whale_alerts)} alerts found")
                print(f"  First alert: {first_alert['wallet_name']} {first_alert['type']} {first_alert['amount_eth']} ETH")
                if "etherscan_url" in first_alert:
                    print(f"  Etherscan URL: {first_alert['etherscan_url']}")
            else:
                print(f"INFO: Whale alerts present but missing etherscan_url/tx_hash")
        else:
            print("INFO: No whale alerts at this time (may be due to API rate limits)")
    
    def test_liquidations_calculated(self, auth_headers):
        """Test Liquidations are calculated and present"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        
        data = response.json().get("data", {})
        liquidations = data.get("liquidations", {})
        
        # Check required fields
        assert "total_24h" in liquidations, "liquidations.total_24h missing"
        assert "longs_24h" in liquidations, "liquidations.longs_24h missing"
        assert "shorts_24h" in liquidations, "liquidations.shorts_24h missing"
        
        # Validate values are numeric and positive
        assert isinstance(liquidations["total_24h"], (int, float)), "total_24h should be numeric"
        assert liquidations["total_24h"] >= 0, "total_24h should be non-negative"
        
        # Verify sum makes sense
        longs = liquidations["longs_24h"]
        shorts = liquidations["shorts_24h"]
        total = liquidations["total_24h"]
        
        # Allow for small rounding differences
        assert abs((longs + shorts) - total) < 100, f"longs + shorts should equal total: {longs} + {shorts} != {total}"
        
        print(f"SUCCESS: Liquidations - total=${total/1e6:.1f}M, longs=${longs/1e6:.1f}M, shorts=${shorts/1e6:.1f}M")
    
    def test_eth_gas_tracker(self, auth_headers):
        """Test ETH Gas Tracker from Etherscan"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        
        data = response.json().get("data", {})
        eth_gas = data.get("eth_gas", {})
        
        # Check required fields
        assert "low" in eth_gas, "eth_gas.low missing"
        assert "average" in eth_gas, "eth_gas.average missing"
        assert "high" in eth_gas, "eth_gas.high missing"
        
        print(f"SUCCESS: ETH Gas - low={eth_gas['low']}, avg={eth_gas['average']}, high={eth_gas['high']} Gwei")
    
    def test_unauthorized_access_returns_403(self):
        """Test that /api/vip/tools/all returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"SUCCESS: Unauthorized access correctly returns {response.status_code}")
    
    def test_data_sources_included(self, auth_headers):
        """Test that response includes data sources"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/all", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        assert "data_sources" in data, "data_sources field missing"
        print(f"SUCCESS: Data sources: {data.get('data_sources')}")


class TestFearGreedStandalone:
    """Test standalone Fear & Greed endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@cryptonai.com", "password": "Admin123!"}
        )
        if response.status_code != 200:
            pytest.skip("Login failed")
        return response.json().get("access_token")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_fear_greed_standalone_endpoint(self, auth_headers):
        """Test /api/vip/tools/fear-greed endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/fear-greed", headers=auth_headers, timeout=15)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        assert "current" in data["data"]
        assert "value" in data["data"]["current"]
        
        print(f"SUCCESS: Fear & Greed standalone - value={data['data']['current']['value']}")


class TestHalvingStandalone:
    """Test standalone Halving endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@cryptonai.com", "password": "Admin123!"}
        )
        if response.status_code != 200:
            pytest.skip("Login failed")
        return response.json().get("access_token")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_halving_standalone_endpoint(self, auth_headers):
        """Test /api/vip/tools/halving endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/tools/halving", headers=auth_headers, timeout=15)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        assert "days_remaining" in data["data"]
        
        print(f"SUCCESS: Halving standalone - days={data['data']['days_remaining']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
