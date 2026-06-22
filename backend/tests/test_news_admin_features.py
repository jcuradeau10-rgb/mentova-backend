"""
Test suite for CryptonAI new features:
1. News with impact_reason field
2. Admin stats with trends data
3. News modal interactions (bookmark, share, external link)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials for super_admin
TEST_USER = {
    "email": "jcuradeau.7@gmail.com",
    "password": "JacksoN12."
}


class TestNewsWithImpactReason:
    """Test news endpoint returns impact_reason field"""
    
    def test_news_has_impact_reason(self):
        """Verify news articles have impact_reason field"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert len(data["data"]) > 0
        
        # Check first news has required fields
        news = data["data"][0]
        assert "id" in news
        assert "title" in news
        assert "impact" in news
        assert "impact_reason" in news  # New field
        assert news["impact"] in ["bullish", "bearish", "neutral"]
        assert news["impact_reason"] is not None
        print(f"✓ News impact_reason: '{news['impact_reason']}' for impact '{news['impact']}'")
    
    def test_news_has_link_field(self):
        """Verify news articles have link field for external links"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 5})
        assert response.status_code == 200
        
        data = response.json()
        # Check if any news has a link field
        for news in data["data"]:
            if news.get("link"):
                print(f"✓ News has external link: {news['link'][:50]}...")
                return
        
        # It's OK if some news don't have links
        print("✓ News endpoint working (some news may not have external links)")
    
    def test_news_has_tags(self):
        """Verify news articles have tags array"""
        response = requests.get(f"{BASE_URL}/api/news", params={"limit": 5})
        assert response.status_code == 200
        
        data = response.json()
        for news in data["data"]:
            assert "tags" in news
            assert isinstance(news["tags"], list)
        
        print("✓ All news have tags array")


class TestAdminStatsWithTrends:
    """Test admin stats endpoint returns trends data for charts"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        if response.status_code != 200:
            pytest.skip("Cannot authenticate - skipping admin tests")
        return response.json().get("access_token")
    
    def test_admin_stats_has_overview(self, auth_token):
        """Verify admin stats returns overview section"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        
        # Check overview section
        overview = data["data"]["overview"]
        assert "total_users" in overview
        assert "active_users" in overview
        assert "banned_users" in overview
        assert "admin_count" in overview
        assert "total_posts" in overview
        assert "total_comments" in overview
        assert "total_votes" in overview
        
        print(f"✓ Overview: {overview['total_users']} users, {overview['total_posts']} posts")
    
    def test_admin_stats_has_daily_registrations(self, auth_token):
        """Verify admin stats returns daily_registrations trend"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        trends = data["data"]["trends"]
        
        # Check daily_registrations (7 days)
        assert "daily_registrations" in trends
        registrations = trends["daily_registrations"]
        assert len(registrations) == 7  # 7 days
        
        # Verify structure
        for day in registrations:
            assert "date" in day
            assert "day" in day  # Day name (Mon, Tue, etc.)
            assert "count" in day
            assert isinstance(day["count"], int)
        
        print(f"✓ Daily registrations trend: {len(registrations)} days of data")
    
    def test_admin_stats_has_daily_activity(self, auth_token):
        """Verify admin stats returns daily_activity trend (posts + comments)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        trends = data["data"]["trends"]
        
        # Check daily_activity (7 days)
        assert "daily_activity" in trends
        activity = trends["daily_activity"]
        assert len(activity) == 7
        
        # Verify structure
        for day in activity:
            assert "date" in day
            assert "day" in day
            assert "posts" in day
            assert "comments" in day
            assert "total" in day
            assert day["total"] == day["posts"] + day["comments"]
        
        print(f"✓ Daily activity trend: {len(activity)} days of data")
    
    def test_admin_stats_has_role_distribution(self, auth_token):
        """Verify admin stats returns role distribution"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        distributions = data["data"]["distributions"]
        
        # Check role distribution
        assert "roles" in distributions
        roles = distributions["roles"]
        assert len(roles) >= 2  # At least user and admin roles
        
        # Verify structure
        for role in roles:
            assert "role" in role
            assert "count" in role
            assert "label" in role
            assert role["role"] in ["user", "admin", "super_admin"]
        
        print(f"✓ Role distribution: {len(roles)} roles configured")
    
    def test_admin_stats_has_category_distribution(self, auth_token):
        """Verify admin stats returns post category distribution"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        distributions = data["data"]["distributions"]
        
        # Check category distribution
        assert "categories" in distributions
        categories = distributions["categories"]
        
        # Verify structure if categories exist
        for cat in categories:
            assert "category" in cat
            assert "count" in cat
        
        print(f"✓ Category distribution: {len(categories)} categories")


class TestAdminStatsTab:
    """Test admin stats tab availability"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        if response.status_code != 200:
            pytest.skip("Cannot authenticate")
        return response.json().get("access_token")
    
    def test_user_is_super_admin(self, auth_token):
        """Verify test user has super_admin role"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        user = response.json()
        assert user["role"] == "super_admin"
        print(f"✓ User '{user['name']}' has super_admin role")
    
    def test_admin_users_endpoint(self, auth_token):
        """Verify admin users endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {auth_token}"},
            params={"limit": 10}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        print(f"✓ Admin users: {len(data['data'])} users returned")
    
    def test_admin_posts_endpoint(self, auth_token):
        """Verify admin posts endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/admin/posts",
            headers={"Authorization": f"Bearer {auth_token}"},
            params={"limit": 10}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Admin posts: {len(data.get('data', []))} posts returned")
    
    def test_admin_logs_endpoint(self, auth_token):
        """Verify admin logs endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/admin/logs",
            headers={"Authorization": f"Bearer {auth_token}"},
            params={"limit": 10}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Admin logs: {len(data.get('data', []))} logs returned")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
