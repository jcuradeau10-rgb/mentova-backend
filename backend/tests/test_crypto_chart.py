"""
Tests for Crypto Chart API endpoints
- GET /api/crypto/chart/{coin_id}?days= - returns price + volume data points
- Tests various periods: 1, 7, 30, 90, 365 days
- Tests different coins: bitcoin, ethereum, invalid-coin (mock fallback)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')


class TestCryptoChartAPI:
    """Test crypto chart endpoint for various coins and periods"""
    
    # ========== BITCOIN CHART TESTS ==========
    
    def test_bitcoin_chart_7_days(self):
        """GET /api/crypto/chart/bitcoin?days=7 returns price + volume data points"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/bitcoin", params={"days": "7"})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True, "Response should have success=True"
        assert "data" in data, "Response should have data field"
        assert data.get("coin_id") == "bitcoin", "coin_id should be bitcoin"
        assert data.get("days") == 7, "days should be 7"
        
        # Verify data points structure
        chart_data = data.get("data", [])
        assert len(chart_data) > 0, "Should have chart data points"
        
        # Check first data point structure
        first_point = chart_data[0]
        assert "timestamp" in first_point, "Data point should have timestamp"
        assert "price" in first_point, "Data point should have price"
        assert "volume" in first_point, "Data point should have volume"
        
        # Verify data types
        assert isinstance(first_point["timestamp"], (int, float)), "Timestamp should be numeric"
        assert isinstance(first_point["price"], (int, float)), "Price should be numeric"
        assert isinstance(first_point["volume"], (int, float)), "Volume should be numeric"
        
        print(f"✓ Bitcoin 7d chart: {len(chart_data)} data points")
    
    def test_bitcoin_chart_24h(self):
        """GET /api/crypto/chart/bitcoin?days=1 returns 24h data"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/bitcoin", params={"days": "1"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("coin_id") == "bitcoin"
        assert data.get("days") == 1
        
        chart_data = data.get("data", [])
        assert len(chart_data) > 0, "Should have 24h chart data"
        
        # Verify prices are reasonable for Bitcoin (> $10,000)
        prices = [p["price"] for p in chart_data]
        avg_price = sum(prices) / len(prices)
        assert avg_price > 10000, f"Bitcoin price should be > $10k, got ${avg_price:.2f}"
        
        print(f"✓ Bitcoin 24h chart: {len(chart_data)} points, avg price: ${avg_price:,.2f}")
    
    def test_bitcoin_chart_30_days(self):
        """GET /api/crypto/chart/bitcoin?days=30 returns 30d data"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/bitcoin", params={"days": "30"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("coin_id") == "bitcoin"
        assert data.get("days") == 30
        
        chart_data = data.get("data", [])
        assert len(chart_data) > 0
        
        # 30 days should have more data points than 7 days
        print(f"✓ Bitcoin 30d chart: {len(chart_data)} data points")
    
    def test_bitcoin_chart_90_days(self):
        """GET /api/crypto/chart/bitcoin?days=90 returns 90d data"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/bitcoin", params={"days": "90"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("days") == 90
        
        chart_data = data.get("data", [])
        assert len(chart_data) > 0
        
        print(f"✓ Bitcoin 90d chart: {len(chart_data)} data points")
    
    def test_bitcoin_chart_1_year(self):
        """GET /api/crypto/chart/bitcoin?days=365 returns 1-year data"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/bitcoin", params={"days": "365"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("days") == 365
        
        chart_data = data.get("data", [])
        assert len(chart_data) > 0
        
        print(f"✓ Bitcoin 1-year chart: {len(chart_data)} data points")
    
    # ========== ETHEREUM CHART TESTS ==========
    
    def test_ethereum_chart_7_days(self):
        """GET /api/crypto/chart/ethereum?days=7 returns ETH data"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/ethereum", params={"days": "7"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("coin_id") == "ethereum"
        assert data.get("days") == 7
        
        chart_data = data.get("data", [])
        assert len(chart_data) > 0
        
        # Verify ETH prices (should be > $500)
        prices = [p["price"] for p in chart_data]
        avg_price = sum(prices) / len(prices)
        assert avg_price > 500, f"ETH price should be > $500, got ${avg_price:.2f}"
        
        print(f"✓ Ethereum 7d chart: {len(chart_data)} points, avg price: ${avg_price:,.2f}")
    
    # ========== INVALID COIN / MOCK FALLBACK TEST ==========
    
    def test_invalid_coin_returns_mock_data(self):
        """GET /api/crypto/chart/invalid-coin?days=7 returns mock data fallback"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/invalid-coin-xyz", params={"days": "7"})
        
        assert response.status_code == 200, "Should return 200 even for invalid coins (mock fallback)"
        data = response.json()
        
        assert data.get("success") == True, "Should succeed with mock data"
        assert data.get("coin_id") == "invalid-coin-xyz"
        
        chart_data = data.get("data", [])
        assert len(chart_data) > 0, "Mock data should still have data points"
        
        # Verify mock flag may be present
        if "mock" in data:
            assert data["mock"] == True, "Should indicate mock data"
            print(f"✓ Invalid coin returns mock data: {len(chart_data)} points (mock=True)")
        else:
            print(f"✓ Invalid coin returns data: {len(chart_data)} points")
    
    # ========== DATA INTEGRITY TESTS ==========
    
    def test_chart_data_is_sorted_chronologically(self):
        """Chart data should be sorted by timestamp (oldest first)"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/bitcoin", params={"days": "7"})
        
        assert response.status_code == 200
        data = response.json()
        chart_data = data.get("data", [])
        
        if len(chart_data) > 1:
            timestamps = [p["timestamp"] for p in chart_data]
            # Verify ascending order
            assert timestamps == sorted(timestamps), "Timestamps should be in ascending order"
        
        print("✓ Chart data is chronologically sorted")
    
    def test_chart_data_has_reasonable_volumes(self):
        """Volume data should be positive numbers"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/bitcoin", params={"days": "7"})
        
        assert response.status_code == 200
        data = response.json()
        chart_data = data.get("data", [])
        
        for point in chart_data:
            assert point.get("volume", 0) >= 0, "Volume should be non-negative"
        
        print("✓ All volume data is non-negative")
    
    # ========== DEFAULT PERIOD TEST ==========
    
    def test_default_period_is_7_days(self):
        """GET /api/crypto/chart/bitcoin without days param defaults to 7"""
        response = requests.get(f"{BASE_URL}/api/crypto/chart/bitcoin")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("days") == 7, "Default period should be 7 days"
        
        print("✓ Default period is 7 days")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
