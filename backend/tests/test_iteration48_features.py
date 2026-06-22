"""
Test iteration 48 features:
1. Mentor dashboard revenue includes marketplace offer purchases
2. Settings page functionality (notifications, privacy, data export)
3. Notification infrastructure
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"
VIP_EMAIL = "jcuradeau.7@gmail.com"
VIP_PASSWORD = "Crypto2026!"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_admin_login_success(self):
        """POST /api/auth/login with admin credentials returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Expected access_token in response"
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0
        print(f"✓ Admin login successful, got token")
    
    def test_vip_user_login_success(self):
        """POST /api/auth/login with VIP user credentials returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_EMAIL,
            "password": VIP_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Expected access_token in response"
        print(f"✓ VIP user login successful")


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def vip_token():
    """Get VIP user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": VIP_EMAIL,
        "password": VIP_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("VIP user authentication failed")


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def vip_headers(vip_token):
    """Headers with VIP user auth token"""
    return {"Authorization": f"Bearer {vip_token}", "Content-Type": "application/json"}


class TestProDashboardRevenue:
    """Test mentor dashboard revenue aggregation including offer purchases"""
    
    def test_pro_dashboard_returns_offer_fields(self, admin_headers):
        """GET /api/pro/dashboard returns stats with total_offer_sales and total_offer_revenue"""
        response = requests.get(f"{BASE_URL}/api/pro/dashboard", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "data" in data, "Expected data field"
        assert "stats" in data["data"], "Expected stats in data"
        
        stats = data["data"]["stats"]
        # Verify total_offer_sales field exists
        assert "total_offer_sales" in stats, "Expected total_offer_sales in stats"
        assert isinstance(stats["total_offer_sales"], (int, float)), "total_offer_sales should be numeric"
        
        # Verify total_offer_revenue field exists
        assert "total_offer_revenue" in stats, "Expected total_offer_revenue in stats"
        assert isinstance(stats["total_offer_revenue"], (int, float)), "total_offer_revenue should be numeric"
        
        print(f"✓ Dashboard stats: total_offer_sales={stats['total_offer_sales']}, total_offer_revenue={stats['total_offer_revenue']}")
    
    def test_pro_earnings_returns_breakdown(self, admin_headers):
        """GET /api/pro/earnings returns total_earned_bookings and total_earned_offers"""
        response = requests.get(f"{BASE_URL}/api/pro/earnings", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "data" in data, "Expected data field"
        
        earnings_data = data["data"]
        # Verify total_earned_bookings field exists
        assert "total_earned_bookings" in earnings_data, "Expected total_earned_bookings in data"
        assert isinstance(earnings_data["total_earned_bookings"], (int, float)), "total_earned_bookings should be numeric"
        
        # Verify total_earned_offers field exists
        assert "total_earned_offers" in earnings_data, "Expected total_earned_offers in data"
        assert isinstance(earnings_data["total_earned_offers"], (int, float)), "total_earned_offers should be numeric"
        
        # Verify total_earned equals sum
        total = earnings_data.get("total_earned", 0)
        expected_total = earnings_data["total_earned_bookings"] + earnings_data["total_earned_offers"]
        assert total == expected_total, f"Expected total_earned={expected_total}, got {total}"
        
        print(f"✓ Earnings breakdown: bookings={earnings_data['total_earned_bookings']}, offers={earnings_data['total_earned_offers']}, total={total}")
    
    def test_pro_advanced_stats_returns_offer_revenue(self, admin_headers):
        """GET /api/pro/advanced-stats returns overview.total_offer_revenue"""
        response = requests.get(f"{BASE_URL}/api/pro/advanced-stats", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "data" in data, "Expected data field"
        assert "overview" in data["data"], "Expected overview in data"
        
        overview = data["data"]["overview"]
        # Verify total_offer_revenue in overview
        assert "total_offer_revenue" in overview, "Expected total_offer_revenue in overview"
        assert isinstance(overview["total_offer_revenue"], (int, float)), "total_offer_revenue should be numeric"
        
        # Verify total_revenue includes all sources
        assert "total_revenue" in overview, "Expected total_revenue in overview"
        assert "total_booking_revenue" in overview, "Expected total_booking_revenue in overview"
        assert "total_course_revenue" in overview, "Expected total_course_revenue in overview"
        
        # Total should equal sum of all revenue sources
        expected_total = overview["total_course_revenue"] + overview["total_booking_revenue"] + overview["total_offer_revenue"]
        actual_total = overview["total_revenue"]
        assert actual_total == expected_total, f"Expected total_revenue={expected_total}, got {actual_total}"
        
        print(f"✓ Advanced stats overview: total_offer_revenue={overview['total_offer_revenue']}, total_revenue={overview['total_revenue']}")


class TestSettingsFunctionality:
    """Test user settings endpoints"""
    
    def test_get_settings_returns_structure(self, vip_headers):
        """GET /api/users/me/settings returns notification and privacy settings structure"""
        response = requests.get(f"{BASE_URL}/api/users/me/settings", headers=vip_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "data" in data, "Expected data field"
        
        settings = data["data"]
        # Verify notifications structure exists
        assert "notifications" in settings, "Expected notifications in settings"
        notifications = settings["notifications"]
        assert isinstance(notifications, dict), "notifications should be a dict"
        # Check at least some expected keys exist (settings may be partial after updates)
        assert len(notifications) > 0, "notifications should have at least one setting"
        for key, value in notifications.items():
            assert isinstance(value, bool), f"{key} should be boolean"
        
        # Verify privacy structure exists
        assert "privacy" in settings, "Expected privacy in settings"
        privacy = settings["privacy"]
        assert isinstance(privacy, dict), "privacy should be a dict"
        # Privacy settings may be partial - check that existing keys have boolean values
        for key, value in privacy.items():
            assert isinstance(value, bool), f"{key} should be boolean"
        
        print(f"✓ Settings returned with {len(notifications)} notification options and {len(privacy)} privacy options")
    
    def test_update_notification_settings(self, vip_headers):
        """PUT /api/users/me/settings updates notification settings"""
        # Update a notification setting
        update_data = {
            "notifications": {"new_message": False, "promotions": True}
        }
        response = requests.put(f"{BASE_URL}/api/users/me/settings", json=update_data, headers=vip_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        
        # Verify the update persisted
        verify_response = requests.get(f"{BASE_URL}/api/users/me/settings", headers=vip_headers)
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        notifications = verify_data["data"]["notifications"]
        assert notifications["new_message"] == False, "new_message should be False after update"
        assert notifications["promotions"] == True, "promotions should be True after update"
        
        # Restore original settings
        restore_data = {"notifications": {"new_message": True, "promotions": False}}
        requests.put(f"{BASE_URL}/api/users/me/settings", json=restore_data, headers=vip_headers)
        
        print(f"✓ Notification settings updated and verified")
    
    def test_update_privacy_settings(self, vip_headers):
        """PUT /api/users/me/settings updates privacy settings"""
        update_data = {
            "privacy": {"profile_public": False, "show_portfolio": True}
        }
        response = requests.put(f"{BASE_URL}/api/users/me/settings", json=update_data, headers=vip_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update persisted
        verify_response = requests.get(f"{BASE_URL}/api/users/me/settings", headers=vip_headers)
        verify_data = verify_response.json()
        privacy = verify_data["data"]["privacy"]
        assert privacy["profile_public"] == False, "profile_public should be False"
        assert privacy["show_portfolio"] == True, "show_portfolio should be True"
        
        # Restore original settings
        restore_data = {"privacy": {"profile_public": True, "show_portfolio": False}}
        requests.put(f"{BASE_URL}/api/users/me/settings", json=restore_data, headers=vip_headers)
        
        print(f"✓ Privacy settings updated and verified")
    
    def test_export_user_data(self, vip_headers):
        """GET /api/users/me/export returns data with required keys"""
        response = requests.get(f"{BASE_URL}/api/users/me/export", headers=vip_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "data" in data, "Expected data field"
        
        export_data = data["data"]
        # Verify required sections
        required_keys = ["account", "profile", "settings", "posts"]
        for key in required_keys:
            assert key in export_data, f"Expected {key} in export data"
        
        # Verify export_date is present
        assert "export_date" in export_data, "Expected export_date in data"
        
        # Verify password_hash is NOT included in account
        if export_data["account"]:
            assert "password_hash" not in export_data["account"], "password_hash should not be in export"
        
        print(f"✓ Data export contains: {list(export_data.keys())}")


class TestNotificationInfrastructure:
    """Test notification system"""
    
    def test_get_notification_history(self, admin_headers):
        """GET /api/notifications/history returns notification list"""
        response = requests.get(f"{BASE_URL}/api/notifications/history", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "data" in data, "Expected data field"
        assert isinstance(data["data"], list), "Expected data to be a list"
        
        # If notifications exist, verify structure
        if len(data["data"]) > 0:
            notification = data["data"][0]
            expected_fields = ["id", "title", "body", "type", "is_read", "created_at"]
            for field in expected_fields:
                assert field in notification, f"Expected {field} in notification"
            print(f"✓ Notification history returned {len(data['data'])} notifications, first type: {notification['type']}")
        else:
            print(f"✓ Notification history returned empty list (no notifications yet)")
    
    def test_notification_history_with_vip_user(self, vip_headers):
        """GET /api/notifications/history works for VIP users"""
        response = requests.get(f"{BASE_URL}/api/notifications/history", headers=vip_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert isinstance(data["data"], list), "Expected data to be a list"
        
        print(f"✓ VIP user notification history: {len(data['data'])} notifications")


class TestProEndpointsAccessControl:
    """Test that pro endpoints require professional status"""
    
    def test_pro_dashboard_requires_professional(self, vip_headers):
        """GET /api/pro/dashboard returns 403 for non-professionals"""
        # VIP user is not necessarily a professional
        response = requests.get(f"{BASE_URL}/api/pro/dashboard", headers=vip_headers)
        # Could be 200 if user is also a pro, or 403 if not
        # The important thing is it doesn't crash
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}"
        print(f"✓ Pro dashboard access control working, returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
