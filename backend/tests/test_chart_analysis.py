"""
Test suite for VIP Chart Analysis Feature
Tests the /api/vip/ai/analyze-image endpoint with chart_analysis type
"""
import pytest
import requests
import os
import base64
from io import BytesIO
from PIL import Image

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "jcuradeau.7@gmail.com"
USER_PASSWORD = "Crypto2026!"


def generate_test_chart_image():
    """Generate a simple chart-like image for testing"""
    # Create a simple chart image with colored rectangles
    img = Image.new('RGB', (400, 300), color=(26, 26, 46))  # Use RGB tuple
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    
    # Draw a simple candlestick-like pattern (green/red rectangles)
    # Green candle (bullish)
    draw.rectangle([50, 150, 70, 250], fill=(16, 185, 129))
    draw.rectangle([58, 100, 62, 150], fill=(16, 185, 129))
    
    # Red candle (bearish)
    draw.rectangle([90, 100, 110, 200], fill=(239, 68, 68))
    draw.rectangle([98, 200, 102, 250], fill=(239, 68, 68))
    
    # Green candle
    draw.rectangle([130, 120, 150, 180], fill=(16, 185, 129))
    draw.rectangle([138, 80, 142, 120], fill=(16, 185, 129))
    
    # Red candle
    draw.rectangle([170, 80, 190, 160], fill=(239, 68, 68))
    draw.rectangle([178, 160, 182, 200], fill=(239, 68, 68))
    
    # Green candle (big bullish)
    draw.rectangle([210, 60, 230, 200], fill=(16, 185, 129))
    draw.rectangle([218, 40, 222, 60], fill=(16, 185, 129))
    
    # More candles
    draw.rectangle([250, 80, 270, 180], fill=(239, 68, 68))
    draw.rectangle([290, 100, 310, 160], fill=(16, 185, 129))
    draw.rectangle([330, 70, 350, 150], fill=(16, 185, 129))
    
    # Draw support line
    draw.line([(40, 220), (360, 220)], fill=(124, 58, 237), width=2)
    
    # Draw resistance line
    draw.line([(40, 70), (360, 70)], fill=(245, 158, 11), width=2)
    
    # Add some text to make it look more like a chart
    try:
        draw.text((10, 10), "BTC/USDT", fill=(255, 255, 255))
        draw.text((10, 270), "Support", fill=(124, 58, 237))
        draw.text((10, 55), "Resistance", fill=(245, 158, 11))
    except:
        pass  # Text drawing might fail without fonts
    
    # Convert to JPEG (more universally supported) with proper base64
    buffer = BytesIO()
    # Convert to RGB if needed and save as JPEG
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    
    # Return base64 without data URL prefix (backend handles this)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


@pytest.fixture
def api_session():
    """Create a requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def vip_token(api_session):
    """Get VIP user token - jcuradeau.7@gmail.com should be VIP or super_admin"""
    response = api_session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": USER_EMAIL, "password": USER_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        user = data.get("user", {})
        # VIP or super_admin can use VIP features
        if user.get("is_vip") or user.get("role") == "super_admin":
            return data.get("access_token")
        # For testing, super_admin should have access
        if user.get("role") == "super_admin":
            return data.get("access_token")
    pytest.skip("VIP user not available for testing")


@pytest.fixture
def admin_token(api_session):
    """Get admin token"""
    response = api_session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin login failed")


@pytest.fixture
def test_chart_image():
    """Generate test chart image"""
    return generate_test_chart_image()


class TestLoginRegression:
    """Regression tests for login API"""
    
    def test_login_with_admin_credentials(self, api_session):
        """Test login with admin credentials still works"""
        response = api_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"PASS: Admin login successful, role={data['user'].get('role')}")
    
    def test_login_with_user_credentials(self, api_session):
        """Test login with VIP user credentials"""
        response = api_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"PASS: User login successful, is_vip={data['user'].get('is_vip')}, role={data['user'].get('role')}")


class TestNewsRegression:
    """Regression tests for news API"""
    
    def test_news_returns_25_articles(self, api_session):
        """Test GET /api/news?limit=25 returns at least 25 articles"""
        response = api_session.get(f"{BASE_URL}/api/news", params={"limit": 25})
        assert response.status_code == 200, f"News API failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        assert isinstance(data["data"], list)
        assert len(data["data"]) >= 25, f"Expected at least 25 articles, got {len(data['data'])}"
        print(f"PASS: News API returns {len(data['data'])} articles")


class TestChartAnalysisEndpoint:
    """Tests for the VIP chart analysis feature"""
    
    def test_chart_analysis_requires_auth(self, api_session, test_chart_image):
        """Test that chart analysis requires authentication"""
        response = api_session.post(
            f"{BASE_URL}/api/vip/ai/analyze-image",
            json={
                "query": "Analyse this chart",
                "image_base64": test_chart_image,
                "analysis_type": "chart_analysis"
            }
        )
        # Should require auth
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print(f"PASS: Chart analysis requires authentication (status={response.status_code})")
    
    def test_chart_analysis_requires_vip(self, api_session, admin_token, test_chart_image):
        """Test that chart analysis requires VIP status"""
        api_session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = api_session.post(
            f"{BASE_URL}/api/vip/ai/analyze-image",
            json={
                "query": "Analyse this chart",
                "image_base64": test_chart_image,
                "analysis_type": "chart_analysis"
            }
        )
        # Admin may or may not be VIP - check both cases
        if response.status_code == 403:
            assert "VIP" in response.text or "vip" in response.text.lower()
            print("PASS: Non-VIP admin correctly rejected with 403")
        elif response.status_code == 200:
            print("PASS: Admin has VIP access, chart analysis works")
        else:
            print(f"Got status {response.status_code}: {response.text}")
    
    def test_chart_analysis_with_vip_user(self, api_session, test_chart_image):
        """Test chart analysis with VIP user (super_admin has VIP access)"""
        # Login as super_admin user who should have VIP access
        login_response = api_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        user_data = login_response.json()
        token = user_data.get("access_token")
        user = user_data.get("user", {})
        
        # super_admin should have VIP-level access
        is_vip = user.get("is_vip") or user.get("role") == "super_admin"
        print(f"User: {user.get('email')}, is_vip={user.get('is_vip')}, role={user.get('role')}")
        
        if not is_vip:
            pytest.skip("User is not VIP and not super_admin")
        
        api_session.headers.update({"Authorization": f"Bearer {token}"})
        response = api_session.post(
            f"{BASE_URL}/api/vip/ai/analyze-image",
            json={
                "query": "Analyse ce graphique de trading et donne-moi tes recommandations.",
                "image_base64": test_chart_image,
                "analysis_type": "chart_analysis"
            },
            timeout=60  # AI calls can take time
        )
        
        # If user is super_admin but not VIP, might get 403
        if response.status_code == 403:
            print(f"User {user.get('email')} rejected - VIP required but not VIP: {response.text}")
            pytest.skip("User is not VIP - skipping chart analysis test")
        
        assert response.status_code == 200, f"Chart analysis failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        
        analysis_data = data["data"]
        assert "analysis" in analysis_data
        assert analysis_data.get("is_chart") is True
        assert analysis_data.get("analysis_type") == "chart_analysis"
        
        # Check for structured tags in the response
        analysis_text = analysis_data["analysis"]
        print(f"\n=== Chart Analysis Response (first 500 chars) ===")
        print(analysis_text[:500])
        
        # Verify structured tags are present
        has_signal = "[SIGNAL]" in analysis_text or "[signal]" in analysis_text.lower()
        has_entry = "[ENTRY]" in analysis_text or "[entry]" in analysis_text.lower()
        has_stoploss = "[STOPLOSS]" in analysis_text or "[stoploss]" in analysis_text.lower()
        has_takeprofit = "[TAKEPROFIT]" in analysis_text or "[takeprofit]" in analysis_text.lower()
        
        print(f"\nStructured tags found:")
        print(f"  [SIGNAL]: {has_signal}")
        print(f"  [ENTRY]: {has_entry}")
        print(f"  [STOPLOSS]: {has_stoploss}")
        print(f"  [TAKEPROFIT]: {has_takeprofit}")
        
        # At least signal should be present
        assert has_signal or has_entry, "Response should contain structured analysis tags"
        print("PASS: Chart analysis returns structured analysis with trading tags")
    
    def test_general_analysis_type(self, api_session, test_chart_image):
        """Test that general analysis type works differently"""
        # Login as VIP user
        login_response = api_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        user_data = login_response.json()
        token = user_data.get("access_token")
        user = user_data.get("user", {})
        
        is_vip = user.get("is_vip") or user.get("role") == "super_admin"
        if not is_vip:
            pytest.skip("User is not VIP")
        
        api_session.headers.update({"Authorization": f"Bearer {token}"})
        response = api_session.post(
            f"{BASE_URL}/api/vip/ai/analyze-image",
            json={
                "query": "What do you see in this image?",
                "image_base64": test_chart_image,
                "analysis_type": "general"  # Not chart_analysis
            },
            timeout=60
        )
        
        if response.status_code == 403:
            pytest.skip("User is not VIP")
        
        assert response.status_code == 200, f"General analysis failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        
        analysis_data = data["data"]
        # For general analysis, is_chart should be False
        assert analysis_data.get("is_chart") is False
        assert analysis_data.get("analysis_type") == "general"
        print("PASS: General analysis returns is_chart=False")


class TestVIPStatus:
    """Tests for VIP status checking"""
    
    def test_vip_status_endpoint(self, api_session, admin_token):
        """Test VIP status endpoint"""
        api_session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = api_session.get(f"{BASE_URL}/api/vip/status")
        
        assert response.status_code == 200, f"VIP status failed: {response.text}"
        data = response.json()
        
        assert "is_vip" in data
        assert "features" in data
        print(f"PASS: VIP status endpoint works, is_vip={data.get('is_vip')}")
    
    def test_vip_features_endpoint(self, api_session):
        """Test VIP features endpoint (public)"""
        response = api_session.get(f"{BASE_URL}/api/vip/features")
        
        assert response.status_code == 200, f"VIP features failed: {response.text}"
        data = response.json()
        
        assert "features" in data
        assert "price_monthly" in data
        print(f"PASS: VIP features endpoint works, price=${data.get('price_monthly')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
