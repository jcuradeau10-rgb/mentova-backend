"""
Test Settings Page Features & Pro Dashboard Revenue Aggregation
Tests for:
1. GET /api/users/me/settings - Returns default notification and privacy settings
2. PUT /api/users/me/settings - Updates notifications and privacy settings
3. GET /api/users/me/export - Returns user data export with all sections
4. GET /api/pro/dashboard - Returns total_offer_sales and total_offer_revenue fields
5. GET /api/pro/earnings - Returns total_earned_bookings and total_earned_offers fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
VIP_USER_EMAIL = "jcuradeau.7@gmail.com"
VIP_USER_PASSWORD = "Crypto2026!"
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"


class TestSettingsAPI:
    """Test user settings endpoints"""
    
    @pytest.fixture
    def vip_token(self):
        """Get VIP user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture
    def admin_token(self):
        """Get Admin/Mentor auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_get_settings_returns_defaults(self, vip_token):
        """GET /api/users/me/settings should return notification and privacy settings"""
        response = requests.get(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {vip_token}"}
        )
        
        assert response.status_code == 200, f"GET settings failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        settings = data["data"]
        
        # Verify notifications structure
        assert "notifications" in settings
        notifs = settings["notifications"]
        expected_notif_keys = ["new_message", "new_booking", "booking_confirmed", "new_review", "community_reply", "price_alerts", "promotions"]
        for key in expected_notif_keys:
            assert key in notifs, f"Missing notification key: {key}"
            assert isinstance(notifs[key], bool), f"Notification {key} should be boolean"
        
        # Verify privacy structure
        assert "privacy" in settings
        privacy = settings["privacy"]
        expected_privacy_keys = ["profile_public", "show_activity", "show_portfolio"]
        for key in expected_privacy_keys:
            assert key in privacy, f"Missing privacy key: {key}"
            assert isinstance(privacy[key], bool), f"Privacy {key} should be boolean"
        
        print(f"✓ GET /api/users/me/settings returned correct structure")
        print(f"  Notifications: {notifs}")
        print(f"  Privacy: {privacy}")
    
    def test_update_notifications_settings(self, vip_token):
        """PUT /api/users/me/settings should update notification settings"""
        # First get current settings
        get_response = requests.get(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {vip_token}"}
        )
        assert get_response.status_code == 200
        current_settings = get_response.json()["data"]
        
        # Update notifications to toggle promotions
        new_notifs = current_settings.get("notifications", {}).copy()
        original_promotions = new_notifs.get("promotions", False)
        new_notifs["promotions"] = not original_promotions
        
        update_response = requests.put(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {vip_token}"},
            json={"notifications": new_notifs}
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify the update persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {vip_token}"}
        )
        assert verify_response.status_code == 200
        updated_notifs = verify_response.json()["data"]["notifications"]
        assert updated_notifs["promotions"] == (not original_promotions), "Notification update did not persist"
        
        # Revert the change
        new_notifs["promotions"] = original_promotions
        requests.put(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {vip_token}"},
            json={"notifications": new_notifs}
        )
        
        print(f"✓ PUT /api/users/me/settings successfully updated notifications")
    
    def test_update_privacy_settings(self, vip_token):
        """PUT /api/users/me/settings should update privacy settings"""
        # Get current settings
        get_response = requests.get(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {vip_token}"}
        )
        assert get_response.status_code == 200
        current_privacy = get_response.json()["data"].get("privacy", {})
        
        # Update privacy - toggle show_portfolio
        new_privacy = current_privacy.copy()
        original_show_portfolio = new_privacy.get("show_portfolio", False)
        new_privacy["show_portfolio"] = not original_show_portfolio
        
        update_response = requests.put(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {vip_token}"},
            json={"privacy": new_privacy}
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify the update persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {vip_token}"}
        )
        assert verify_response.status_code == 200
        updated_privacy = verify_response.json()["data"]["privacy"]
        assert updated_privacy["show_portfolio"] == (not original_show_portfolio), "Privacy update did not persist"
        
        # Revert the change
        new_privacy["show_portfolio"] = original_show_portfolio
        requests.put(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {vip_token}"},
            json={"privacy": new_privacy}
        )
        
        print(f"✓ PUT /api/users/me/settings successfully updated privacy")


class TestUserDataExport:
    """Test user data export endpoint"""
    
    @pytest.fixture
    def vip_token(self):
        """Get VIP user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_export_user_data_structure(self, vip_token):
        """GET /api/users/me/export should return all user data sections"""
        response = requests.get(
            f"{BASE_URL}/api/users/me/export",
            headers={"Authorization": f"Bearer {vip_token}"}
        )
        
        assert response.status_code == 200, f"Export failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        export = data["data"]
        
        # Verify all required sections exist
        required_sections = ["export_date", "account", "profile", "settings", "posts", "bookings", "purchases"]
        for section in required_sections:
            assert section in export, f"Missing export section: {section}"
        
        # Verify account has no password_hash (security)
        assert "password_hash" not in export["account"], "password_hash should not be in export"
        
        # Verify export_date is valid ISO format
        assert export["export_date"], "export_date should not be empty"
        
        # Verify posts/bookings/purchases are lists
        assert isinstance(export["posts"], list), "posts should be a list"
        assert isinstance(export["bookings"], list), "bookings should be a list"
        assert isinstance(export["purchases"], list), "purchases should be a list"
        
        print(f"✓ GET /api/users/me/export returned correct structure")
        print(f"  Sections: {list(export.keys())}")
        print(f"  Posts count: {len(export['posts'])}")
        print(f"  Bookings count: {len(export['bookings'])}")
        print(f"  Purchases count: {len(export['purchases'])}")


class TestProDashboardRevenue:
    """Test Pro Dashboard revenue aggregation (includes offer purchases)"""
    
    @pytest.fixture
    def mentor_token(self):
        """Get Mentor/Admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_pro_dashboard_has_offer_stats(self, mentor_token):
        """GET /api/pro/dashboard should return total_offer_sales and total_offer_revenue"""
        response = requests.get(
            f"{BASE_URL}/api/pro/dashboard",
            headers={"Authorization": f"Bearer {mentor_token}"}
        )
        
        assert response.status_code == 200, f"Dashboard request failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        dashboard = data["data"]
        
        # Verify stats section exists
        assert "stats" in dashboard, "Dashboard should have stats section"
        stats = dashboard["stats"]
        
        # Verify offer-related fields exist
        assert "total_offer_sales" in stats, "Missing total_offer_sales in stats"
        assert "total_offer_revenue" in stats, "Missing total_offer_revenue in stats"
        
        # Verify they are numbers
        assert isinstance(stats["total_offer_sales"], (int, float)), "total_offer_sales should be a number"
        assert isinstance(stats["total_offer_revenue"], (int, float)), "total_offer_revenue should be a number"
        
        # Verify total_earnings includes both booking and offer revenue
        assert "total_earnings" in stats, "Missing total_earnings in stats"
        assert "monthly_earnings" in stats, "Missing monthly_earnings in stats"
        
        print(f"✓ GET /api/pro/dashboard returned offer stats")
        print(f"  total_offer_sales: {stats['total_offer_sales']}")
        print(f"  total_offer_revenue: ${stats['total_offer_revenue']}")
        print(f"  total_earnings: ${stats['total_earnings']}")
        print(f"  monthly_earnings: ${stats['monthly_earnings']}")
    
    def test_pro_dashboard_profile_and_services(self, mentor_token):
        """GET /api/pro/dashboard should return profile and services"""
        response = requests.get(
            f"{BASE_URL}/api/pro/dashboard",
            headers={"Authorization": f"Bearer {mentor_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        
        # Verify profile exists
        assert "profile" in data, "Dashboard should have profile"
        
        # Verify services list exists
        assert "services" in data, "Dashboard should have services"
        assert isinstance(data["services"], list)
        
        # Verify recent bookings and reviews exist
        assert "recent_bookings" in data
        assert "recent_reviews" in data
        
        print(f"✓ GET /api/pro/dashboard has profile and services")


class TestProEarnings:
    """Test Pro Earnings endpoint (includes offer earnings breakdown)"""
    
    @pytest.fixture
    def mentor_token(self):
        """Get Mentor/Admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_pro_earnings_has_breakdown(self, mentor_token):
        """GET /api/pro/earnings should return total_earned_bookings and total_earned_offers"""
        response = requests.get(
            f"{BASE_URL}/api/pro/earnings",
            headers={"Authorization": f"Bearer {mentor_token}"}
        )
        
        assert response.status_code == 200, f"Earnings request failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        earnings = data["data"]
        
        # Verify booking/offer breakdown fields exist
        assert "total_earned_bookings" in earnings, "Missing total_earned_bookings"
        assert "total_earned_offers" in earnings, "Missing total_earned_offers"
        assert "total_earned" in earnings, "Missing total_earned"
        
        # Verify they are numbers
        assert isinstance(earnings["total_earned_bookings"], (int, float))
        assert isinstance(earnings["total_earned_offers"], (int, float))
        assert isinstance(earnings["total_earned"], (int, float))
        
        # Verify total_earned = bookings + offers
        expected_total = earnings["total_earned_bookings"] + earnings["total_earned_offers"]
        assert earnings["total_earned"] == expected_total, f"total_earned ({earnings['total_earned']}) should equal bookings ({earnings['total_earned_bookings']}) + offers ({earnings['total_earned_offers']})"
        
        # Verify other expected fields
        assert "pending_earnings" in earnings
        assert "available_for_payout" in earnings
        assert "completed_bookings" in earnings
        assert "completed_offers" in earnings
        
        print(f"✓ GET /api/pro/earnings returned earnings breakdown")
        print(f"  total_earned_bookings: ${earnings['total_earned_bookings']}")
        print(f"  total_earned_offers: ${earnings['total_earned_offers']}")
        print(f"  total_earned: ${earnings['total_earned']}")
        print(f"  completed_bookings: {earnings['completed_bookings']}")
        print(f"  completed_offers: {earnings['completed_offers']}")


class TestAuthEndpoints:
    """Basic auth verification for test setup"""
    
    def test_vip_user_login(self):
        """Verify VIP user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        
        assert response.status_code == 200, f"VIP login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ VIP user login successful: {data['user']['email']}")
    
    def test_admin_user_login(self):
        """Verify Admin/Mentor user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        
        # Verify is_professional for mentor dashboard access
        user = data["user"]
        assert user.get("is_professional") == True, "Admin user should be a professional (mentor)"
        print(f"✓ Admin/Mentor login successful: {user['email']} (is_professional={user.get('is_professional')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
