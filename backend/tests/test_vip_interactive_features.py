"""
VIP Interactive Features API Tests
Testing: Smart Money, Copy Trading, Academy APIs with data structure validation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

class TestVIPInteractiveFeatures:
    """Test VIP APIs with interactive modal data requirements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as VIP user and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token")
        self.user = data.get("user")
        assert self.token, "No access_token in response"
        assert self.user.get("is_vip") == True, "User must be VIP for these tests"
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_smart_money_returns_whale_transactions(self):
        """Test /api/vip/smart-money returns whale transaction data for modal display"""
        response = requests.get(f"{BASE_URL}/api/vip/smart-money?limit=10", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "summary" in data
        
        # Verify at least some transactions exist
        assert len(data["data"]) > 0, "Smart Money should return at least 1 transaction"
        
        # Verify transaction structure for modal display (handleWhalePress)
        tx = data["data"][0]
        required_fields = ["id", "whale_address", "whale_name", "transaction_type", 
                          "crypto_symbol", "amount", "usd_value", "timestamp"]
        for field in required_fields:
            assert field in tx, f"Transaction missing field: {field}"
        
        # Verify transaction types
        assert tx["transaction_type"] in ["buy", "sell", "transfer"], "Invalid transaction type"
        
        # Verify summary for VIP Hub display
        summary = data["summary"]
        assert "total_buy_volume" in summary
        assert "total_sell_volume" in summary
        assert "sentiment" in summary
        assert summary["sentiment"] in ["bullish", "bearish", "neutral"]
    
    def test_smart_money_whale_history_simulation(self):
        """Test that whale data can support history modal - frontend mocks this"""
        response = requests.get(f"{BASE_URL}/api/vip/smart-money?limit=20", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        transactions = data["data"]
        
        # Frontend groups by whale_address for history display
        whale_addresses = set(tx["whale_address"] for tx in transactions)
        assert len(whale_addresses) > 0, "Should have distinct whale addresses for history grouping"
        
        # Each transaction should have timestamp for history ordering
        for tx in transactions:
            assert "timestamp" in tx
            assert "usd_value" in tx
    
    def test_copy_trading_returns_trader_list(self):
        """Test /api/vip/copy-trading/traders returns traders for modal display"""
        response = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert len(data["data"]) > 0, "Should return at least 1 trader"
        
        # Verify trader structure for modal display (handleTraderPress)
        trader = data["data"][0]
        required_fields = ["id", "username", "description", "total_return", 
                          "win_rate", "followers", "trades_count", "risk_level", "is_following"]
        for field in required_fields:
            assert field in trader, f"Trader missing field: {field}"
        
        # Verify risk levels
        assert trader["risk_level"] in ["low", "medium", "high"], "Invalid risk level"
        
        # Verify numeric fields are reasonable
        assert isinstance(trader["total_return"], (int, float))
        assert 0 <= trader["win_rate"] <= 100, "Win rate should be 0-100"
        assert isinstance(trader["followers"], int)
    
    def test_copy_trading_trader_detail_fields(self):
        """Test traders have enough data for detail modal view"""
        response = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders", headers=self.headers)
        assert response.status_code == 200
        
        traders = response.json()["data"]
        
        # Each trader should have data for the detail modal
        for trader in traders:
            # Basic stats for modal display
            assert "username" in trader
            assert "total_return" in trader
            assert "win_rate" in trader
            assert "trades_count" in trader
            
            # Optional but expected for detail view
            assert "description" in trader
            assert "risk_level" in trader
            
        # Note: Recent trades are mocked in frontend (getTraderMockTrades function)
        print("INFO: Trader recent trades are mocked in frontend hub.tsx")
    
    def test_copy_trading_follow_unfollow(self):
        """Test trader follow/unfollow functionality for VIP Hub"""
        # Get traders list
        traders_response = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders", headers=self.headers)
        assert traders_response.status_code == 200
        
        traders = traders_response.json()["data"]
        assert len(traders) > 0
        
        trader_id = traders[0]["id"]
        
        # Follow the trader
        follow_response = requests.post(f"{BASE_URL}/api/vip/copy-trading/follow/{trader_id}", headers=self.headers)
        assert follow_response.status_code == 200
        follow_data = follow_response.json()
        assert follow_data["success"] == True
        
        # Verify following status
        traders_response2 = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders", headers=self.headers)
        traders2 = traders_response2.json()["data"]
        trader_after_follow = next((t for t in traders2 if t["id"] == trader_id), None)
        assert trader_after_follow["is_following"] == True, "Trader should be followed"
        
        # Unfollow the trader
        unfollow_response = requests.delete(f"{BASE_URL}/api/vip/copy-trading/follow/{trader_id}", headers=self.headers)
        assert unfollow_response.status_code == 200
        
        # Verify unfollowed
        traders_response3 = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders", headers=self.headers)
        traders3 = traders_response3.json()["data"]
        trader_after_unfollow = next((t for t in traders3 if t["id"] == trader_id), None)
        assert trader_after_unfollow["is_following"] == False, "Trader should be unfollowed"
    
    def test_academy_returns_courses(self):
        """Test /api/vip/academy returns courses for modal display"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert len(data["data"]) > 0, "Should return at least 1 course"
        
        # Verify course structure for modal display (handleCoursePress)
        course = data["data"][0]
        required_fields = ["id", "title", "description", "modules", 
                          "duration", "difficulty", "progress_percent", "completed", "started"]
        for field in required_fields:
            assert field in course, f"Course missing field: {field}"
        
        # Verify difficulty levels
        assert course["difficulty"] in ["débutant", "intermédiaire", "avancé", "expert"], f"Invalid difficulty: {course['difficulty']}"
        
        # Verify progress fields
        assert 0 <= course["progress_percent"] <= 100
        assert isinstance(course["completed"], bool)
        assert isinstance(course["started"], bool)
        assert isinstance(course["modules"], int) and course["modules"] > 0
    
    def test_academy_course_detail_fields(self):
        """Test courses have enough data for detail modal view"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 200
        
        courses = response.json()["data"]
        
        # Each course should have data for the detail modal
        for course in courses:
            # Modal needs these for display
            assert "title" in course
            assert "description" in course
            assert "modules" in course
            assert "duration" in course
            assert "difficulty" in course
            
            # Progress tracking
            assert "progress_percent" in course
            assert "started" in course
            assert "completed" in course
        
        # Note: Module list is generated in frontend based on course.modules count
        print("INFO: Course module list is generated in frontend hub.tsx based on modules count")


class TestVIPAPIAccessControl:
    """Test VIP-only access control (403 for non-VIP users)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create non-VIP user session if possible, or skip"""
        # Try to login as test non-VIP user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_non_vip@example.com",
            "password": "Test123!"
        })
        
        if response.status_code != 200:
            pytest.skip("Non-VIP test user not available - skipping access control tests")
        
        data = response.json()
        self.token = data.get("access_token")
        self.user = data.get("user")
        
        if self.user.get("is_vip") == True:
            pytest.skip("Test user is VIP - cannot test non-VIP access control")
        
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_smart_money_403_for_non_vip(self):
        """Non-VIP users should get 403 on smart-money endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/smart-money", headers=self.headers)
        assert response.status_code == 403
    
    def test_copy_trading_403_for_non_vip(self):
        """Non-VIP users should get 403 on copy-trading endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders", headers=self.headers)
        assert response.status_code == 403
    
    def test_academy_403_for_non_vip(self):
        """Non-VIP users should get 403 on academy endpoint"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 403


class TestProfileAndMessagesNavigation:
    """Test profile and messages API endpoints for navigation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_messages_conversations_endpoint(self):
        """Test /api/messages/conversations endpoint exists for Messages button"""
        response = requests.get(f"{BASE_URL}/api/messages/conversations", headers=self.headers)
        # Should return 200 with data or empty list
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
    
    def test_profile_my_profile_endpoint(self):
        """Test /api/users/me/profile endpoint for Mon profil public button"""
        response = requests.get(f"{BASE_URL}/api/users/me/profile", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        
        profile = data["data"]
        assert "id" in profile
        assert "name" in profile
    
    def test_profile_user_by_id_endpoint(self):
        """Test /api/users/{user_id}/profile endpoint for user profile view"""
        response = requests.get(f"{BASE_URL}/api/users/{self.user_id}/profile", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        profile = data["data"]
        assert profile["id"] == self.user_id


class TestCommunityAuthorNavigation:
    """Test community post author navigation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get posts"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cryptonai.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_community_posts_have_author_id(self):
        """Test that community posts include author_id for navigation"""
        response = requests.get(f"{BASE_URL}/api/community/posts", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        if len(data["data"]) > 0:
            post = data["data"][0]
            assert "author_id" in post, "Posts must include author_id for profile navigation"
            assert "author_name" in post, "Posts must include author_name for display"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
