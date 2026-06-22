"""
Test suite for CryptonAI Admin Panel - Refactored Version
Tests: Dashboard stats, Users management, Posts management, Logs, Filters
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "jcuradeau.7@gmail.com"
ADMIN_PASSWORD = "JacksoN12."

class TestAuthAndAccess:
    """Authentication and admin access tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session for admin"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def admin_token(self, session):
        """Get admin authentication token"""
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("access_token"), "No access token in response"
        return data["access_token"]
    
    def test_login_with_admin_credentials(self, session):
        """Test login with admin credentials"""
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify user data
        assert data.get("user"), "No user data in response"
        assert data["user"]["role"] == "super_admin", f"Expected super_admin role, got {data['user']['role']}"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Login successful - User: {data['user']['name']}, Role: {data['user']['role']}")
    
    def test_invalid_login_rejected(self, session):
        """Test that invalid credentials are rejected"""
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@email.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")


class TestAdminStats:
    """Dashboard statistics tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_get_admin_stats(self, auth_session):
        """Test dashboard statistics endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        
        stats = data.get("data", {})
        # Verify all expected stat fields exist
        expected_fields = ["total_users", "banned_users", "admins_count", "total_posts", "total_comments"]
        for field in expected_fields:
            assert field in stats, f"Missing field: {field}"
        
        print(f"✓ Admin stats retrieved - Users: {stats['total_users']}, Posts: {stats['total_posts']}, Banned: {stats['banned_users']}")


class TestAdminUsers:
    """User management tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_get_all_users(self, auth_session):
        """Test getting all users list"""
        response = auth_session.get(f"{BASE_URL}/api/admin/users", params={"limit": 100})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        users = data["data"]
        if len(users) > 0:
            # Verify user object structure
            user = users[0]
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
            assert "is_banned" in user
        
        print(f"✓ Retrieved {len(users)} users")
    
    def test_filter_users_by_role(self, auth_session):
        """Test filtering users by role"""
        # Test filter by super_admin role
        response = auth_session.get(
            f"{BASE_URL}/api/admin/users",
            params={"role_filter": "super_admin", "limit": 100}
        )
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("data", [])
        
        # All returned users should be super_admin
        for user in users:
            assert user["role"] == "super_admin", f"Expected super_admin, got {user['role']}"
        
        print(f"✓ Role filter works - Found {len(users)} super_admin users")
    
    def test_filter_users_banned_only(self, auth_session):
        """Test filtering banned users"""
        response = auth_session.get(
            f"{BASE_URL}/api/admin/users",
            params={"banned_only": True, "limit": 100}
        )
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("data", [])
        
        # All returned users should be banned
        for user in users:
            assert user["is_banned"] is True, f"User {user['email']} should be banned"
        
        print(f"✓ Banned filter works - Found {len(users)} banned users")
    
    def test_search_users(self, auth_session):
        """Test searching users by name/email"""
        response = auth_session.get(
            f"{BASE_URL}/api/admin/users",
            params={"search": "jcuradeau", "limit": 100}
        )
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("data", [])
        
        # At least one user should match the search
        assert len(users) >= 1, "Search should find at least the admin user"
        
        print(f"✓ Search works - Found {len(users)} users matching 'jcuradeau'")


class TestAdminPosts:
    """Posts management tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_get_all_posts(self, auth_session):
        """Test getting all posts"""
        response = auth_session.get(f"{BASE_URL}/api/admin/posts", params={"limit": 100})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        posts = data["data"]
        print(f"✓ Retrieved {len(posts)} posts")
        
        if len(posts) > 0:
            post = posts[0]
            # Verify post structure
            assert "id" in post
            assert "title" in post
            assert "author_name" in post
            print(f"  First post: '{post['title']}' by {post['author_name']}")
    
    def test_filter_posts_by_category(self, auth_session):
        """Test filtering posts by category"""
        response = auth_session.get(
            f"{BASE_URL}/api/admin/posts",
            params={"category": "debutants", "limit": 100}
        )
        assert response.status_code == 200
        
        data = response.json()
        posts = data.get("data", [])
        
        # All returned posts should have the specified category
        for post in posts:
            assert post.get("category") == "debutants", f"Expected debutants category, got {post.get('category')}"
        
        print(f"✓ Category filter works - Found {len(posts)} posts in 'debutants' category")
    
    def test_search_posts(self, auth_session):
        """Test searching posts"""
        response = auth_session.get(
            f"{BASE_URL}/api/admin/posts",
            params={"search": "crypto", "limit": 100}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        
        print(f"✓ Post search works - Found {len(data['data'])} posts matching 'crypto'")


class TestAdminLogs:
    """Admin logs tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_get_admin_logs(self, auth_session):
        """Test getting admin activity logs"""
        response = auth_session.get(f"{BASE_URL}/api/admin/logs", params={"limit": 50})
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        logs = data["data"]
        print(f"✓ Retrieved {len(logs)} admin logs")
        
        if len(logs) > 0:
            log = logs[0]
            # Verify log structure
            expected_fields = ["action", "admin_name", "timestamp"]
            for field in expected_fields:
                assert field in log, f"Missing field in log: {field}"
            print(f"  Last action: {log['action']} by {log['admin_name']}")


class TestAdminActions:
    """Test admin actions (ban/unban/promote)"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_cannot_ban_self(self, auth_session):
        """Test that admin cannot ban themselves"""
        # First get admin's own user ID
        me_response = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        my_id = me_response.json()["id"]
        
        # Try to ban self
        ban_response = auth_session.put(
            f"{BASE_URL}/api/admin/users/{my_id}/ban",
            json={"reason": "Test ban"}
        )
        assert ban_response.status_code == 400, f"Should not be able to ban self, got {ban_response.status_code}"
        print("✓ Self-ban correctly prevented")
    
    def test_get_user_detail(self, auth_session):
        """Test getting detailed user info"""
        # First get a user ID
        users_response = auth_session.get(f"{BASE_URL}/api/admin/users", params={"limit": 1})
        assert users_response.status_code == 200
        users = users_response.json().get("data", [])
        
        if len(users) > 0:
            user_id = users[0]["id"]
            detail_response = auth_session.get(f"{BASE_URL}/api/admin/users/{user_id}")
            assert detail_response.status_code == 200
            
            data = detail_response.json()
            assert data.get("success") is True
            user_detail = data.get("data", {})
            
            # Verify detailed user info
            assert "id" in user_detail
            assert "email" in user_detail
            assert "posts_count" in user_detail
            assert "comments_count" in user_detail
            
            print(f"✓ User detail retrieved - {user_detail['email']}: {user_detail['posts_count']} posts, {user_detail['comments_count']} comments")


class TestNonAdminAccess:
    """Test that non-admin users cannot access admin endpoints"""
    
    def test_regular_user_denied_admin_access(self):
        """Test that regular users cannot access admin endpoints"""
        # Create a test session without auth
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try to access admin stats without auth
        response = session.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 403 or response.status_code == 401, \
            f"Unauthenticated access should be denied, got {response.status_code}"
        
        print("✓ Unauthenticated admin access correctly denied")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
