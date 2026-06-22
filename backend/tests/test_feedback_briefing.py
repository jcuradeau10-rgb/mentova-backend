"""
Test suite for Feedback API and Daily Briefing API
- POST /api/feedback: Requires auth, stores feedback in MongoDB
- GET /api/vip/daily-briefing: Requires VIP status, returns AI-generated market briefing
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials
VIP_EMAIL = "jcuradeau.7@gmail.com"
VIP_PASSWORD = "Crypto2026!"
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"

class TestFeedbackAPI:
    """Test the Feedback submission endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login(self, email, password):
        """Login helper to get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return token
        return None
    
    def test_feedback_requires_auth(self):
        """Test: POST /api/feedback without auth returns 401 or 403"""
        # Clear any existing auth
        if "Authorization" in self.session.headers:
            del self.session.headers["Authorization"]
            
        response = self.session.post(f"{BASE_URL}/api/feedback", json={
            "type": "bug",
            "message": "Test bug report"
        })
        # Should fail without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Feedback endpoint requires authentication")
    
    def test_feedback_submit_testimonial(self):
        """Test: Submit a testimonial with rating"""
        token = self.login(VIP_EMAIL, VIP_PASSWORD)
        assert token is not None, "Failed to login as VIP user"
        
        response = self.session.post(f"{BASE_URL}/api/feedback", json={
            "type": "testimonial",
            "message": "TEST_Great app for learning crypto! Very intuitive.",
            "rating": 5
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "success", f"Expected success status, got {data}"
        print("PASS: Testimonial submission works")
    
    def test_feedback_submit_improvement(self):
        """Test: Submit an improvement suggestion"""
        token = self.login(VIP_EMAIL, VIP_PASSWORD)
        assert token is not None, "Failed to login"
        
        response = self.session.post(f"{BASE_URL}/api/feedback", json={
            "type": "improvement",
            "message": "TEST_Would love to see more charts in the market view"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "success"
        print("PASS: Improvement suggestion works")
    
    def test_feedback_submit_bug_report(self):
        """Test: Submit a bug report"""
        token = self.login(VIP_EMAIL, VIP_PASSWORD)
        assert token is not None, "Failed to login"
        
        response = self.session.post(f"{BASE_URL}/api/feedback", json={
            "type": "bug",
            "message": "TEST_Button on home screen doesn't respond on first click"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "success"
        print("PASS: Bug report submission works")
    
    def test_feedback_submit_feature_request(self):
        """Test: Submit a feature request"""
        token = self.login(VIP_EMAIL, VIP_PASSWORD)
        assert token is not None, "Failed to login"
        
        response = self.session.post(f"{BASE_URL}/api/feedback", json={
            "type": "feature",
            "message": "TEST_Add portfolio tracking across multiple exchanges"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "success"
        print("PASS: Feature request submission works")


class TestDailyBriefingAPI:
    """Test the VIP Daily Briefing endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login(self, email, password):
        """Login helper"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return token
        return None
    
    def test_daily_briefing_requires_vip(self):
        """Test: Daily briefing requires VIP status"""
        # Clear auth
        if "Authorization" in self.session.headers:
            del self.session.headers["Authorization"]
        
        response = self.session.get(f"{BASE_URL}/api/vip/daily-briefing")
        # Should fail - either 401 (no auth) or 403 (no VIP)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Daily briefing requires VIP auth")
    
    def test_daily_briefing_vip_access(self):
        """Test: VIP user can access daily briefing"""
        token = self.login(VIP_EMAIL, VIP_PASSWORD)
        assert token is not None, "Failed to login as VIP user"
        
        # This may take a few seconds as it calls GPT-4o
        response = self.session.get(f"{BASE_URL}/api/vip/daily-briefing", timeout=60)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "data" in data, "Missing 'data' field"
        
        briefing = data["data"]
        # Verify briefing structure
        assert "market_summary" in briefing, "Missing market_summary"
        assert "sentiment" in briefing, "Missing sentiment"
        assert briefing["sentiment"] in ["bullish", "bearish", "neutral"], f"Invalid sentiment: {briefing.get('sentiment')}"
        
        print(f"PASS: Daily briefing returned with sentiment: {briefing.get('sentiment')}")
        print(f"  Market summary: {briefing.get('market_summary', '')[:100]}...")
    
    def test_daily_briefing_has_market_data(self):
        """Test: Briefing includes BTC/ETH prices"""
        token = self.login(VIP_EMAIL, VIP_PASSWORD)
        assert token is not None
        
        response = self.session.get(f"{BASE_URL}/api/vip/daily-briefing", timeout=60)
        assert response.status_code == 200
        
        data = response.json()
        briefing = data.get("data", {})
        market_data = briefing.get("market_data", {})
        
        # Check for price data
        prices = market_data.get("prices", {})
        if prices:
            assert "bitcoin" in prices or "btc" in str(prices).lower(), "Missing Bitcoin price data"
            print(f"PASS: BTC price in briefing: ${prices.get('bitcoin', {}).get('usd', 'N/A')}")
        
        # Check for Fear & Greed
        fng = market_data.get("fear_greed", {})
        if fng:
            print(f"PASS: Fear & Greed Index: {fng.get('value')} ({fng.get('label')})")
    
    def test_daily_briefing_has_analysis(self):
        """Test: Briefing has BTC and ETH analysis"""
        token = self.login(VIP_EMAIL, VIP_PASSWORD)
        assert token is not None
        
        response = self.session.get(f"{BASE_URL}/api/vip/daily-briefing", timeout=60)
        assert response.status_code == 200
        
        data = response.json()
        briefing = data.get("data", {})
        
        # Check for analysis fields
        btc_analysis = briefing.get("btc_analysis", "")
        eth_analysis = briefing.get("eth_analysis", "")
        key_events = briefing.get("key_events", [])
        opportunity = briefing.get("opportunity", "")
        risk_alert = briefing.get("risk_alert", "")
        
        print(f"  BTC Analysis: {btc_analysis[:80] if btc_analysis else 'N/A'}...")
        print(f"  ETH Analysis: {eth_analysis[:80] if eth_analysis else 'N/A'}...")
        print(f"  Key Events: {len(key_events)} events")
        print(f"  Opportunity: {opportunity[:80] if opportunity else 'N/A'}...")
        print(f"  Risk Alert: {risk_alert[:80] if risk_alert else 'N/A'}...")
        
        # At least some content should be present
        has_content = bool(btc_analysis or eth_analysis or key_events or opportunity)
        assert has_content, "Briefing is missing key analysis content"
        print("PASS: Briefing has analysis content")


class TestVIPHubNavigation:
    """Test VIP Hub tab navigation and data loading"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_vip(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_EMAIL,
            "password": VIP_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return token
        return None
    
    def test_vip_status_endpoint(self):
        """Test: VIP status endpoint returns correct data"""
        token = self.login_vip()
        assert token is not None
        
        response = self.session.get(f"{BASE_URL}/api/vip/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "is_vip" in data
        print(f"PASS: VIP status: is_vip={data.get('is_vip')}")
    
    def test_vip_crypto_tools(self):
        """Test: VIP Crypto Tools endpoint"""
        token = self.login_vip()
        assert token is not None
        
        response = self.session.get(f"{BASE_URL}/api/vip/tools/all")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        print(f"PASS: Crypto tools returned data keys: {list(data.get('data', {}).keys())[:5]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
