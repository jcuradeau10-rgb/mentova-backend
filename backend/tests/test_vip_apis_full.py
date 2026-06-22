"""
CryptonAI VIP Features - Complete API Testing
Tests all VIP-exclusive endpoints:
- /api/vip/smart-money - Smart Money tracking
- /api/vip/alerts - Price alerts CRUD
- /api/vip/wallet - Portfolio tracking
- /api/vip/achievements - Gamification achievements
- /api/vip/leaderboard - Gamification leaderboard
- /api/vip/academy - Advanced courses
- /api/vip/copy-trading/traders - Copy trading
- /api/vip/social/feed - Social features
- Paywall verification for non-VIP users
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# VIP user credentials
VIP_EMAIL = "jcuradeau.7@gmail.com"
VIP_PASSWORD = "JacksoN12."

# Non-VIP test user credentials
NON_VIP_EMAIL = "test_non_vip@example.com"
NON_VIP_PASSWORD = "TestPass123!"
NON_VIP_NAME = "Test Non-VIP User"


class TestVIPAuthentication:
    """Test VIP authentication and status"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login VIP user and store token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_EMAIL, "password": VIP_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.user = data["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_vip_login_success(self):
        """Test VIP user can login"""
        print(f"VIP user logged in: {self.user['email']}")
        print(f"Role: {self.user['role']}")
        assert self.user["email"] == VIP_EMAIL
    
    def test_vip_status_endpoint(self):
        """Test /api/vip/status returns VIP details"""
        response = requests.get(f"{BASE_URL}/api/vip/status", headers=self.headers)
        assert response.status_code == 200, f"VIP status failed: {response.text}"
        
        data = response.json()
        print(f"VIP Status: is_vip={data['is_vip']}, days_remaining={data.get('days_remaining')}")
        
        assert data["is_vip"] == True
        assert data["vip_expires_at"] is not None
        assert data["days_remaining"] is not None
        assert isinstance(data["features"], list)
        assert len(data["features"]) > 0


class TestSmartMoneyAPI:
    """Test /api/vip/smart-money endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_EMAIL, "password": VIP_PASSWORD}
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_smart_money_transactions(self):
        """Test getting smart money whale transactions"""
        response = requests.get(f"{BASE_URL}/api/vip/smart-money", headers=self.headers)
        assert response.status_code == 200, f"Smart money failed: {response.text}"
        
        data = response.json()
        print(f"Smart Money response keys: {data.keys()}")
        
        # Check response structure
        assert "data" in data
        assert "summary" in data
        
        # Check transactions
        transactions = data["data"]
        assert isinstance(transactions, list)
        print(f"Found {len(transactions)} whale transactions")
        
        if len(transactions) > 0:
            tx = transactions[0]
            assert "id" in tx
            assert "whale_address" in tx
            assert "transaction_type" in tx
            assert "crypto_symbol" in tx
            assert "amount" in tx
            assert "usd_value" in tx
            print(f"Sample transaction: {tx['transaction_type']} {tx['amount']} {tx['crypto_symbol']} (${tx['usd_value']:,.0f})")
        
        # Check summary
        summary = data["summary"]
        assert "total_buy_volume" in summary
        assert "total_sell_volume" in summary
        assert "sentiment" in summary
        print(f"Summary: buys=${summary['total_buy_volume']:,.0f}, sells=${summary['total_sell_volume']:,.0f}, sentiment={summary['sentiment']}")


class TestAlertsAPI:
    """Test /api/vip/alerts CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_EMAIL, "password": VIP_PASSWORD}
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_alert_id = None
    
    def test_get_alerts_list(self):
        """Test getting alerts list"""
        response = requests.get(f"{BASE_URL}/api/vip/alerts", headers=self.headers)
        assert response.status_code == 200, f"Get alerts failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"Current alerts count: {len(data['data'])}")
    
    def test_create_alert(self):
        """Test creating a new price alert"""
        alert_data = {
            "crypto_symbol": "BTC",
            "alert_type": "price_above",
            "target_value": 100000.00,
            "notification_method": "push"
        }
        response = requests.post(f"{BASE_URL}/api/vip/alerts", headers=self.headers, json=alert_data)
        assert response.status_code == 200, f"Create alert failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        created = data["data"]
        self.created_alert_id = created["id"]
        
        print(f"Created alert: {created['crypto_symbol']} {created['alert_type']} ${created['target_value']}")
        
        assert created["crypto_symbol"] == "BTC"
        assert created["alert_type"] == "price_above"
        assert created["target_value"] == 100000.00
        
        # Cleanup: delete the created alert
        if self.created_alert_id:
            requests.delete(f"{BASE_URL}/api/vip/alerts/{self.created_alert_id}", headers=self.headers)
    
    def test_create_and_delete_alert(self):
        """Test alert creation and deletion workflow"""
        # Create alert
        alert_data = {
            "crypto_symbol": "ETH",
            "alert_type": "price_below",
            "target_value": 1500.00
        }
        create_response = requests.post(f"{BASE_URL}/api/vip/alerts", headers=self.headers, json=alert_data)
        assert create_response.status_code == 200
        
        created = create_response.json()["data"]
        alert_id = created["id"]
        print(f"Created alert ID: {alert_id}")
        
        # Delete alert
        delete_response = requests.delete(f"{BASE_URL}/api/vip/alerts/{alert_id}", headers=self.headers)
        assert delete_response.status_code == 200, f"Delete alert failed: {delete_response.text}"
        print("Alert deleted successfully")


class TestWalletAPI:
    """Test /api/vip/wallet portfolio tracking endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_EMAIL, "password": VIP_PASSWORD}
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_wallet_portfolio(self):
        """Test getting wallet portfolio"""
        response = requests.get(f"{BASE_URL}/api/vip/wallet", headers=self.headers)
        assert response.status_code == 200, f"Get wallet failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        assert "summary" in data
        
        assets = data["data"]
        summary = data["summary"]
        
        print(f"Wallet assets count: {len(assets)}")
        print(f"Total value: ${summary.get('total_value', 0):,.2f}")
        print(f"Total P/L: ${summary.get('total_profit_loss', 0):,.2f} ({summary.get('total_profit_loss_percent', 0):.1f}%)")
    
    def test_add_wallet_asset(self):
        """Test adding an asset to wallet"""
        asset_data = {
            "symbol": "TEST",
            "name": "Test Coin",
            "amount": 10.5,
            "buy_price": 100.00
        }
        response = requests.post(f"{BASE_URL}/api/vip/wallet", headers=self.headers, json=asset_data)
        assert response.status_code == 200, f"Add asset failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        created = data["data"]
        
        print(f"Added asset: {created['symbol']} - {created['amount']} units at ${created['buy_price']}")
        
        assert created["symbol"] == "TEST"
        assert created["amount"] == 10.5
        
        # Cleanup: remove the test asset
        if created.get("id"):
            requests.delete(f"{BASE_URL}/api/vip/wallet/{created['id']}", headers=self.headers)
    
    def test_add_and_remove_asset(self):
        """Test complete add/remove workflow"""
        # Add asset
        asset_data = {
            "symbol": "SOL",
            "name": "Solana",
            "amount": 5.0,
            "buy_price": 150.00
        }
        add_response = requests.post(f"{BASE_URL}/api/vip/wallet", headers=self.headers, json=asset_data)
        assert add_response.status_code == 200
        
        asset_id = add_response.json()["data"]["id"]
        print(f"Added SOL asset with ID: {asset_id}")
        
        # Remove asset
        remove_response = requests.delete(f"{BASE_URL}/api/vip/wallet/{asset_id}", headers=self.headers)
        assert remove_response.status_code == 200
        print("Asset removed successfully")


class TestAchievementsAPI:
    """Test /api/vip/achievements and gamification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_EMAIL, "password": VIP_PASSWORD}
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_achievements(self):
        """Test getting achievements list"""
        response = requests.get(f"{BASE_URL}/api/vip/achievements", headers=self.headers)
        assert response.status_code == 200, f"Get achievements failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        
        achievements = data["data"]
        assert isinstance(achievements, list)
        print(f"Total achievements: {len(achievements)}")
        
        if len(achievements) > 0:
            ach = achievements[0]
            assert "id" in ach
            assert "title" in ach
            assert "description" in ach
            assert "points" in ach
            assert "unlocked" in ach
            print(f"Sample achievement: {ach['title']} - {ach['points']} pts (unlocked: {ach['unlocked']})")
    
    def test_get_gamification_stats(self):
        """Test getting gamification stats"""
        response = requests.get(f"{BASE_URL}/api/vip/gamification/stats", headers=self.headers)
        assert response.status_code == 200, f"Get gamification stats failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        
        stats = data["data"]
        assert "points" in stats
        assert "level" in stats
        assert "achievements_unlocked" in stats
        
        print(f"Gamification stats: {stats['points']} points, Level: {stats['level']}")
        print(f"Achievements unlocked: {stats['achievements_unlocked']}/{stats['total_achievements']}")


class TestLeaderboardAPI:
    """Test /api/vip/leaderboard endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_EMAIL, "password": VIP_PASSWORD}
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_leaderboard(self):
        """Test getting VIP leaderboard"""
        response = requests.get(f"{BASE_URL}/api/vip/leaderboard", headers=self.headers)
        assert response.status_code == 200, f"Get leaderboard failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        
        leaderboard = data["data"]
        assert isinstance(leaderboard, list)
        print(f"Leaderboard entries: {len(leaderboard)}")
        
        if len(leaderboard) > 0:
            entry = leaderboard[0]
            assert "rank" in entry
            assert "username" in entry or "name" in entry
            assert "points" in entry
            print(f"Top entry: Rank #{entry['rank']} - {entry.get('username') or entry.get('name')} ({entry['points']} pts)")


class TestAcademyAPI:
    """Test /api/vip/academy advanced courses endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_EMAIL, "password": VIP_PASSWORD}
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_advanced_courses(self):
        """Test getting advanced VIP courses"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 200, f"Get academy failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        
        courses = data["data"]
        assert isinstance(courses, list)
        print(f"Advanced courses available: {len(courses)}")
        
        if len(courses) > 0:
            course = courses[0]
            assert "id" in course
            assert "title" in course
            assert "description" in course
            assert "modules" in course
            assert "duration" in course
            print(f"Sample course: {course['title']} ({course['modules']} modules, {course['duration']})")


class TestCopyTradingAPI:
    """Test /api/vip/copy-trading endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_EMAIL, "password": VIP_PASSWORD}
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_copy_traders(self):
        """Test getting list of traders to follow"""
        response = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders", headers=self.headers)
        assert response.status_code == 200, f"Get traders failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        
        traders = data["data"]
        assert isinstance(traders, list)
        print(f"Copy traders available: {len(traders)}")
        
        if len(traders) > 0:
            trader = traders[0]
            assert "id" in trader
            assert "username" in trader
            assert "total_return" in trader
            assert "win_rate" in trader
            assert "risk_level" in trader
            print(f"Sample trader: {trader['username']} - Return: {trader['total_return']}%, Win rate: {trader['win_rate']}%")
    
    def test_follow_and_unfollow_trader(self):
        """Test following and unfollowing a trader"""
        # First get a trader
        response = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders", headers=self.headers)
        traders = response.json()["data"]
        
        if len(traders) == 0:
            pytest.skip("No traders available to test follow/unfollow")
        
        trader_id = traders[0]["id"]
        
        # Follow trader
        follow_response = requests.post(f"{BASE_URL}/api/vip/copy-trading/follow/{trader_id}", headers=self.headers)
        assert follow_response.status_code == 200, f"Follow trader failed: {follow_response.text}"
        print(f"Followed trader {trader_id}")
        
        # Unfollow trader
        unfollow_response = requests.delete(f"{BASE_URL}/api/vip/copy-trading/follow/{trader_id}", headers=self.headers)
        assert unfollow_response.status_code == 200, f"Unfollow trader failed: {unfollow_response.text}"
        print(f"Unfollowed trader {trader_id}")


class TestSocialAPI:
    """Test /api/vip/social endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VIP_EMAIL, "password": VIP_PASSWORD}
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_social_feed(self):
        """Test getting social feed"""
        response = requests.get(f"{BASE_URL}/api/vip/social/feed", headers=self.headers)
        assert response.status_code == 200, f"Get social feed failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        
        posts = data["data"]
        assert isinstance(posts, list)
        print(f"Social feed posts: {len(posts)}")
        
        if len(posts) > 0:
            post = posts[0]
            assert "id" in post
            assert "content" in post
            assert "author_name" in post
            assert "likes" in post
            print(f"Sample post by {post['author_name']}: {post['content'][:50]}...")
    
    def test_create_and_like_post(self):
        """Test creating a post and liking it"""
        # Create post
        create_response = requests.post(
            f"{BASE_URL}/api/vip/social/posts",
            headers=self.headers,
            params={"content": "Test post from API test $BTC $ETH", "crypto_mentions": ["BTC", "ETH"]}
        )
        assert create_response.status_code == 200, f"Create post failed: {create_response.text}"
        
        post_id = create_response.json()["data"]["id"]
        print(f"Created post ID: {post_id}")
        
        # Like the post
        like_response = requests.post(f"{BASE_URL}/api/vip/social/posts/{post_id}/like", headers=self.headers)
        assert like_response.status_code == 200, f"Like post failed: {like_response.text}"
        print("Post liked successfully")


class TestPaywallNonVIP:
    """Test that non-VIP users receive 403 errors for VIP endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create or login non-VIP user"""
        # First try to register a new non-VIP user
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": NON_VIP_EMAIL, "password": NON_VIP_PASSWORD, "name": NON_VIP_NAME}
        )
        
        if register_response.status_code == 200:
            self.token = register_response.json()["access_token"]
        else:
            # User might already exist, try login
            login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": NON_VIP_EMAIL, "password": NON_VIP_PASSWORD}
            )
            if login_response.status_code == 200:
                self.token = login_response.json()["access_token"]
            else:
                pytest.skip("Could not create or login non-VIP test user")
        
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_smart_money_returns_403_for_non_vip(self):
        """Test that smart-money endpoint returns 403 for non-VIP"""
        response = requests.get(f"{BASE_URL}/api/vip/smart-money", headers=self.headers)
        assert response.status_code == 403, f"Expected 403 but got {response.status_code}: {response.text}"
        print("Smart Money correctly returns 403 for non-VIP")
    
    def test_alerts_returns_403_for_non_vip(self):
        """Test that alerts endpoint returns 403 for non-VIP"""
        response = requests.get(f"{BASE_URL}/api/vip/alerts", headers=self.headers)
        assert response.status_code == 403, f"Expected 403 but got {response.status_code}"
        print("Alerts correctly returns 403 for non-VIP")
    
    def test_wallet_returns_403_for_non_vip(self):
        """Test that wallet endpoint returns 403 for non-VIP"""
        response = requests.get(f"{BASE_URL}/api/vip/wallet", headers=self.headers)
        assert response.status_code == 403, f"Expected 403 but got {response.status_code}"
        print("Wallet correctly returns 403 for non-VIP")
    
    def test_achievements_returns_403_for_non_vip(self):
        """Test that achievements endpoint returns 403 for non-VIP"""
        response = requests.get(f"{BASE_URL}/api/vip/achievements", headers=self.headers)
        assert response.status_code == 403, f"Expected 403 but got {response.status_code}"
        print("Achievements correctly returns 403 for non-VIP")
    
    def test_academy_returns_403_for_non_vip(self):
        """Test that academy endpoint returns 403 for non-VIP"""
        response = requests.get(f"{BASE_URL}/api/vip/academy", headers=self.headers)
        assert response.status_code == 403, f"Expected 403 but got {response.status_code}"
        print("Academy correctly returns 403 for non-VIP")
    
    def test_copy_trading_returns_403_for_non_vip(self):
        """Test that copy-trading endpoint returns 403 for non-VIP"""
        response = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders", headers=self.headers)
        assert response.status_code == 403, f"Expected 403 but got {response.status_code}"
        print("Copy Trading correctly returns 403 for non-VIP")
    
    def test_social_returns_403_for_non_vip(self):
        """Test that social feed endpoint returns 403 for non-VIP"""
        response = requests.get(f"{BASE_URL}/api/vip/social/feed", headers=self.headers)
        assert response.status_code == 403, f"Expected 403 but got {response.status_code}"
        print("Social Feed correctly returns 403 for non-VIP")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
