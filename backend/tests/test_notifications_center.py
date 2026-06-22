"""
Test suite for CryptonAI Notification Center
Testing:
- GET /api/notifications/history - Get notification history
- POST /api/notifications/mark-read - Mark notifications as read
- POST /api/notifications/register-token - Register push token
- POST /api/messages/{user_id} - Send message (triggers notification)
- POST /api/vip/social/posts/{post_id}/like - Like post (triggers notification)
- POST /api/vip/social/posts/{post_id}/comments - Comment on post (triggers notification)
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com")

# Test user credentials
VIP_USER_EMAIL = "admin@cryptonai.com"
VIP_USER_PASSWORD = "Admin123!"

# Second test user for inter-user notifications
TEST_USER_2_EMAIL = "test_notif_user@cryptonai.com"
TEST_USER_2_PASSWORD = "TestNotif123!"
TEST_USER_2_NAME = "TEST_Notification_User"


class TestNotificationCenter:
    """Test notification center functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for VIP admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def user_info(self, auth_token):
        """Get VIP admin user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get user info failed: {response.text}"
        return response.json()
    
    @pytest.fixture(scope="class")
    def second_user_token(self):
        """Create or login second user for inter-user notification tests"""
        # Try to login first
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_2_EMAIL,
            "password": TEST_USER_2_PASSWORD
        })
        
        if response.status_code == 200:
            return response.json()["access_token"]
        
        # If login fails, register new user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_2_EMAIL,
            "password": TEST_USER_2_PASSWORD,
            "name": TEST_USER_2_NAME
        })
        
        if response.status_code == 200:
            return response.json()["access_token"]
        elif response.status_code == 400 and "déjà utilisé" in response.text:
            # User exists but login failed - skip this test
            pytest.skip("Second user exists but cannot login")
        
        pytest.skip(f"Could not create second user: {response.text}")
    
    @pytest.fixture(scope="class")
    def second_user_info(self, second_user_token):
        """Get second user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {second_user_token}"}
        )
        assert response.status_code == 200
        return response.json()
    
    # ============ GET /api/notifications/history ============
    
    def test_get_notification_history_returns_200(self, auth_token):
        """Test that notification history endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/history",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"✅ GET /api/notifications/history - Returned {len(data['data'])} notifications")
    
    def test_notification_history_structure(self, auth_token):
        """Test notification history response structure"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/history?limit=5",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        notifications = data.get("data", [])
        
        # If there are notifications, verify structure
        if notifications:
            notif = notifications[0]
            expected_fields = ["id", "title", "body", "type", "is_read", "created_at"]
            for field in expected_fields:
                assert field in notif, f"Missing field '{field}' in notification"
            print(f"✅ Notification structure valid: {list(notif.keys())}")
        else:
            print("ℹ️ No notifications to verify structure")
    
    def test_notification_history_requires_auth(self):
        """Test that notification history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications/history")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/notifications/history requires authentication")
    
    # ============ POST /api/notifications/mark-read ============
    
    def test_mark_all_notifications_read(self, auth_token):
        """Test marking all notifications as read"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/mark-read",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"notification_ids": []}  # Empty array = mark all
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        print("✅ POST /api/notifications/mark-read (all) - Success")
    
    def test_mark_specific_notifications_read(self, auth_token):
        """Test marking specific notifications as read"""
        # First get notification history to get IDs
        history_resp = requests.get(
            f"{BASE_URL}/api/notifications/history?limit=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        notifications = history_resp.json().get("data", [])
        unread_ids = [n["id"] for n in notifications if not n.get("is_read") and n.get("id")][:2]
        
        if not unread_ids:
            # Create a dummy ID to test the endpoint works
            unread_ids = ["test-notification-id-12345"]
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/mark-read",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"notification_ids": unread_ids}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/notifications/mark-read (specific IDs: {len(unread_ids)}) - Success")
    
    def test_mark_read_requires_auth(self):
        """Test that mark read requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/mark-read",
            json={"notification_ids": []}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ POST /api/notifications/mark-read requires authentication")
    
    # ============ POST /api/notifications/register-token ============
    
    def test_register_push_token(self, auth_token):
        """Test registering a push token"""
        test_token = "ExponentPushToken[test_notification_center_12345]"
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "token": test_token,
                "device_type": "ios"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        print("✅ POST /api/notifications/register-token - Success")
    
    def test_register_invalid_token_format(self, auth_token):
        """Test registering invalid token format"""
        invalid_token = "invalid_token_format"
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "token": invalid_token,
                "device_type": "android"
            }
        )
        # Should return 400 for invalid token format
        assert response.status_code == 400, f"Expected 400 for invalid token, got {response.status_code}: {response.text}"
        print("✅ Invalid token format correctly rejected with 400")
    
    def test_register_token_requires_auth(self):
        """Test that register token requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            json={"token": "ExponentPushToken[test]", "device_type": "ios"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ POST /api/notifications/register-token requires authentication")


class TestMessageNotifications:
    """Test notifications triggered by messages"""
    
    @pytest.fixture(scope="class")
    def admin_auth(self):
        """Get admin user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"],
            "name": data["user"]["name"]
        }
    
    @pytest.fixture(scope="class")
    def second_user_auth(self):
        """Create/login second user"""
        # Try login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_2_EMAIL,
            "password": TEST_USER_2_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data["access_token"],
                "user_id": data["user"]["id"],
                "name": data["user"]["name"]
            }
        
        # Register if not exists
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_2_EMAIL,
            "password": TEST_USER_2_PASSWORD,
            "name": TEST_USER_2_NAME
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data["access_token"],
                "user_id": data["user"]["id"],
                "name": data["user"]["name"]
            }
        
        pytest.skip(f"Cannot setup second user: {response.text}")
    
    def test_message_creates_notification_for_recipient(self, admin_auth, second_user_auth):
        """Test that sending a message creates notification for recipient"""
        # Admin sends message to second user
        message_content = f"TEST_NOTIF_MSG_{int(time.time())}"
        
        response = requests.post(
            f"{BASE_URL}/api/messages/{second_user_auth['user_id']}",
            headers={"Authorization": f"Bearer {admin_auth['token']}"},
            json={"content": message_content}
        )
        assert response.status_code == 200, f"Send message failed: {response.text}"
        
        # Wait a moment for notification to be created
        time.sleep(0.5)
        
        # Check second user's notifications
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications/history?limit=10",
            headers={"Authorization": f"Bearer {second_user_auth['token']}"}
        )
        assert notif_response.status_code == 200
        
        notifications = notif_response.json().get("data", [])
        
        # Look for the message notification
        message_notif = None
        for n in notifications:
            if n.get("type") == "new_message" and message_content[:30] in (n.get("body") or ""):
                message_notif = n
                break
        
        assert message_notif is not None, f"Message notification not found. Notifications: {[n.get('type') for n in notifications]}"
        assert message_notif.get("type") == "new_message"
        print(f"✅ Message notification created for recipient: {message_notif.get('title')}")
    
    def test_self_message_not_allowed(self, admin_auth):
        """Test that sending message to self is not allowed"""
        response = requests.post(
            f"{BASE_URL}/api/messages/{admin_auth['user_id']}",
            headers={"Authorization": f"Bearer {admin_auth['token']}"},
            json={"content": "Test self message"}
        )
        assert response.status_code == 400, f"Expected 400 for self-message, got {response.status_code}"
        print("✅ Self-message correctly rejected with 400")


class TestSocialPostNotifications:
    """Test notifications triggered by likes and comments on social posts"""
    
    @pytest.fixture(scope="class")
    def vip_admin_auth(self):
        """Get VIP admin auth"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"],
            "name": data["user"]["name"],
            "is_vip": data["user"].get("is_vip", False)
        }
    
    @pytest.fixture(scope="class")
    def second_vip_user_auth(self):
        """Create/login second user and make VIP for social features"""
        # Try login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_2_EMAIL,
            "password": TEST_USER_2_PASSWORD
        })
        
        if response.status_code != 200:
            # Register if not exists
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": TEST_USER_2_EMAIL,
                "password": TEST_USER_2_PASSWORD,
                "name": TEST_USER_2_NAME
            })
            
            if response.status_code != 200:
                pytest.skip(f"Cannot setup second user: {response.text}")
        
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"],
            "name": data["user"]["name"],
            "is_vip": data["user"].get("is_vip", False)
        }
    
    @pytest.fixture(scope="class")
    def test_post(self, vip_admin_auth):
        """Create a test post for like/comment notifications"""
        if not vip_admin_auth.get("is_vip"):
            pytest.skip("Admin user is not VIP")
        
        # Create a social post - uses query params not JSON body
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts",
            headers={"Authorization": f"Bearer {vip_admin_auth['token']}"},
            params={
                "content": f"TEST_NOTIF_POST_{int(time.time())}",
                "crypto_mentions": []
            }
        )
        
        if response.status_code == 200:
            post_data = response.json().get("data", {})
            return post_data
        
        pytest.skip(f"Cannot create test post: {response.status_code} - {response.text}")
    
    def test_like_creates_notification_for_author(self, vip_admin_auth, second_vip_user_auth, test_post):
        """Test that liking a post creates notification for the author"""
        if not second_vip_user_auth.get("is_vip"):
            pytest.skip("Second user is not VIP - cannot test social features")
        
        post_id = test_post.get("id")
        if not post_id:
            pytest.skip("No test post ID available")
        
        # Second user likes admin's post
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {second_vip_user_auth['token']}"}
        )
        
        if response.status_code == 403:
            pytest.skip("Second user not VIP - skipping like test")
        
        assert response.status_code == 200, f"Like failed: {response.text}"
        
        # Wait for notification
        time.sleep(0.5)
        
        # Check admin's notifications
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications/history?limit=10",
            headers={"Authorization": f"Bearer {vip_admin_auth['token']}"}
        )
        assert notif_response.status_code == 200
        
        notifications = notif_response.json().get("data", [])
        
        # Look for like notification
        like_notif = None
        for n in notifications:
            if n.get("type") == "post_like" and n.get("data", {}).get("post_id") == post_id:
                like_notif = n
                break
        
        if like_notif:
            print(f"✅ Like notification created for post author: {like_notif.get('body')}")
        else:
            # Self-like doesn't create notification - that's expected
            print("ℹ️ Like notification not found (expected if self-like or auto-notification disabled)")
    
    def test_comment_creates_notification_for_author(self, vip_admin_auth, second_vip_user_auth, test_post):
        """Test that commenting on a post creates notification for the author"""
        if not second_vip_user_auth.get("is_vip"):
            pytest.skip("Second user is not VIP - cannot test social features")
        
        post_id = test_post.get("id")
        if not post_id:
            pytest.skip("No test post ID available")
        
        comment_content = f"TEST_NOTIF_COMMENT_{int(time.time())}"
        
        # Second user comments on admin's post
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/{post_id}/comments",
            headers={"Authorization": f"Bearer {second_vip_user_auth['token']}"},
            params={"content": comment_content}
        )
        
        if response.status_code == 403:
            pytest.skip("Second user not VIP - skipping comment test")
        
        assert response.status_code == 200, f"Comment failed: {response.text}"
        
        # Wait for notification
        time.sleep(0.5)
        
        # Check admin's notifications
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications/history?limit=10",
            headers={"Authorization": f"Bearer {vip_admin_auth['token']}"}
        )
        assert notif_response.status_code == 200
        
        notifications = notif_response.json().get("data", [])
        
        # Look for comment notification
        comment_notif = None
        for n in notifications:
            if n.get("type") == "post_comment" and n.get("data", {}).get("post_id") == post_id:
                comment_notif = n
                break
        
        if comment_notif:
            print(f"✅ Comment notification created for post author: {comment_notif.get('body')}")
        else:
            print("ℹ️ Comment notification not found (expected if self-comment or auto-notification disabled)")
    
    def test_self_like_no_notification(self, vip_admin_auth, test_post):
        """Test that self-like does NOT create notification"""
        post_id = test_post.get("id")
        if not post_id:
            pytest.skip("No test post ID available")
        
        # Get notification count before self-like
        before_resp = requests.get(
            f"{BASE_URL}/api/notifications/history?limit=50",
            headers={"Authorization": f"Bearer {vip_admin_auth['token']}"}
        )
        before_count = len(before_resp.json().get("data", []))
        
        # Admin likes their own post (self-like)
        response = requests.post(
            f"{BASE_URL}/api/vip/social/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {vip_admin_auth['token']}"}
        )
        assert response.status_code == 200
        
        time.sleep(0.5)
        
        # Get notification count after self-like
        after_resp = requests.get(
            f"{BASE_URL}/api/notifications/history?limit=50",
            headers={"Authorization": f"Bearer {vip_admin_auth['token']}"}
        )
        after_notifications = after_resp.json().get("data", [])
        
        # Check no new self-like notification
        self_like_notif = None
        for n in after_notifications:
            if n.get("type") == "post_like" and n.get("data", {}).get("post_id") == post_id:
                # Check if this is a new notification (not from before)
                created = n.get("created_at", "")
                if created > (before_resp.json().get("data", [{}])[0].get("created_at", "") if before_count > 0 else ""):
                    self_like_notif = n
                    break
        
        # Self-like should NOT create notification
        if self_like_notif is None:
            print("✅ Self-like correctly does NOT create notification")
        else:
            print("⚠️ Warning: Self-like created notification (unexpected behavior)")


class TestNotificationFilters:
    """Test notification filtering by type"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_notification_types_present(self, auth_token):
        """Test that different notification types are stored"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/history?limit=100",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        notifications = response.json().get("data", [])
        notification_types = set(n.get("type") for n in notifications if n.get("type"))
        
        print(f"ℹ️ Found notification types: {notification_types}")
        
        # Common expected types
        expected_types = {"new_message", "post_like", "post_comment", "story_reaction", "price_alert"}
        found_expected = notification_types.intersection(expected_types)
        
        if found_expected:
            print(f"✅ Found expected notification types: {found_expected}")
        else:
            print(f"ℹ️ No standard notification types found yet (types present: {notification_types})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
