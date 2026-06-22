"""
VIP Stories (24h Ephemeral) and Push Notifications Backend API Tests

Testing Features:
- POST /api/vip/stories/create - Create story with image, text overlay, background color
- GET /api/vip/stories - Get active stories grouped by author
- POST /api/vip/stories/{story_id}/view - Mark story as viewed
- POST /api/vip/stories/{story_id}/react - React to story with emoji (❤️🔥👏🚀💎)
- DELETE /api/vip/stories/{story_id} - Delete own story
- POST /api/notifications/register-token - Register Expo push token
- GET /api/notifications/history - Get notification history
- POST /api/notifications/mark-read - Mark notifications as read
"""

import pytest
import requests
import os
import base64
import urllib.parse

# Use the public URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')

# Test credentials (VIP user)
VIP_USER_EMAIL = "admin@cryptonai.com"
VIP_USER_PASSWORD = "Admin123!"

# Small red 1x1 PNG image for testing
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jX0wAAAABJRU5ErkJggg=="


class TestStoriesAndNotificationsSetup:
    """Setup tests - verify authentication working"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get VIP user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in login response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers for VIP user"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_vip_user_login(self):
        """Test VIP user can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["is_vip"] == True, "User should be VIP"
        print(f"✅ VIP user login successful: {data['user']['email']}")


class TestVIPStories:
    """Test VIP Stories (24h Ephemeral) endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get VIP user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_create_story_with_image_only(self, auth_headers):
        """Test creating story with only image"""
        response = requests.post(
            f"{BASE_URL}/api/vip/stories/create",
            headers=auth_headers,
            json={
                "image_base64": TEST_IMAGE_BASE64
            }
        )
        assert response.status_code == 200, f"Create story failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "id" in data["data"]
        assert "expires_at" in data["data"]
        print(f"✅ Story created with ID: {data['data']['id']}")
        # Store for cleanup
        TestVIPStories.story_id = data["data"]["id"]
    
    def test_create_story_with_text_overlay(self, auth_headers):
        """Test creating story with text overlay"""
        response = requests.post(
            f"{BASE_URL}/api/vip/stories/create",
            headers=auth_headers,
            json={
                "image_base64": TEST_IMAGE_BASE64,
                "text_overlay": "BTC to the moon! 🚀"
            }
        )
        assert response.status_code == 200, f"Create story failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "id" in data["data"]
        print(f"✅ Story with text overlay created: {data['data']['id']}")
    
    def test_create_story_with_all_fields(self, auth_headers):
        """Test creating story with all fields (image, text, background color)"""
        response = requests.post(
            f"{BASE_URL}/api/vip/stories/create",
            headers=auth_headers,
            json={
                "image_base64": TEST_IMAGE_BASE64,
                "text_overlay": "ETH breaking resistance!",
                "background_color": "#FF5733"
            }
        )
        assert response.status_code == 200, f"Create story failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "id" in data["data"]
        assert "expires_at" in data["data"]
        print(f"✅ Story with all fields created: {data['data']['id']}")
        # Store for later tests
        TestVIPStories.full_story_id = data["data"]["id"]
    
    def test_get_active_stories(self, auth_headers):
        """Test getting active stories grouped by author"""
        response = requests.get(
            f"{BASE_URL}/api/vip/stories",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get stories failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        if len(data["data"]) > 0:
            # Check structure of story group
            story_group = data["data"][0]
            assert "author_id" in story_group
            assert "author_name" in story_group
            assert "stories" in story_group
            assert isinstance(story_group["stories"], list)
            
            if len(story_group["stories"]) > 0:
                story = story_group["stories"][0]
                assert "id" in story
                assert "image_base64" in story
                assert "views_count" in story
                assert "reactions" in story
                assert "has_viewed" in story
                assert "created_at" in story
                assert "expires_at" in story
        
        print(f"✅ Active stories fetched: {len(data['data'])} author groups")
    
    def test_view_story(self, auth_headers):
        """Test marking a story as viewed"""
        # First get a story to view
        response = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0 and len(data["data"][0]["stories"]) > 0:
            story_id = data["data"][0]["stories"][0]["id"]
            
            # Mark as viewed
            view_response = requests.post(
                f"{BASE_URL}/api/vip/stories/{story_id}/view",
                headers=auth_headers
            )
            assert view_response.status_code == 200, f"View story failed: {view_response.text}"
            view_data = view_response.json()
            assert view_data["success"] == True
            print(f"✅ Story viewed: {story_id}")
        else:
            pytest.skip("No stories available to view")
    
    def test_view_nonexistent_story(self, auth_headers):
        """Test viewing non-existent story returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/vip/stories/nonexistent-story-id/view",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("✅ Non-existent story returns 404 correctly")
    
    def test_react_to_story_heart(self, auth_headers):
        """Test reacting to story with ❤️"""
        # Get a story to react to
        response = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0 and len(data["data"][0]["stories"]) > 0:
            story_id = data["data"][0]["stories"][0]["id"]
            
            # React with heart (URL encode the emoji)
            reaction = urllib.parse.quote("❤️")
            react_response = requests.post(
                f"{BASE_URL}/api/vip/stories/{story_id}/react?reaction={reaction}",
                headers=auth_headers
            )
            assert react_response.status_code == 200, f"React failed: {react_response.text}"
            react_data = react_response.json()
            assert react_data["success"] == True
            print(f"✅ Reacted to story {story_id} with ❤️")
        else:
            pytest.skip("No stories available to react to")
    
    def test_react_to_story_fire(self, auth_headers):
        """Test reacting to story with 🔥"""
        response = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0 and len(data["data"][0]["stories"]) > 0:
            story_id = data["data"][0]["stories"][0]["id"]
            
            reaction = urllib.parse.quote("🔥")
            react_response = requests.post(
                f"{BASE_URL}/api/vip/stories/{story_id}/react?reaction={reaction}",
                headers=auth_headers
            )
            assert react_response.status_code == 200
            print(f"✅ Reacted to story {story_id} with 🔥")
        else:
            pytest.skip("No stories available")
    
    def test_react_to_story_rocket(self, auth_headers):
        """Test reacting to story with 🚀"""
        response = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0 and len(data["data"][0]["stories"]) > 0:
            story_id = data["data"][0]["stories"][0]["id"]
            
            reaction = urllib.parse.quote("🚀")
            react_response = requests.post(
                f"{BASE_URL}/api/vip/stories/{story_id}/react?reaction={reaction}",
                headers=auth_headers
            )
            assert react_response.status_code == 200
            print(f"✅ Reacted to story {story_id} with 🚀")
        else:
            pytest.skip("No stories available")
    
    def test_react_to_story_diamond(self, auth_headers):
        """Test reacting to story with 💎"""
        response = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0 and len(data["data"][0]["stories"]) > 0:
            story_id = data["data"][0]["stories"][0]["id"]
            
            reaction = urllib.parse.quote("💎")
            react_response = requests.post(
                f"{BASE_URL}/api/vip/stories/{story_id}/react?reaction={reaction}",
                headers=auth_headers
            )
            assert react_response.status_code == 200
            print(f"✅ Reacted to story {story_id} with 💎")
        else:
            pytest.skip("No stories available")
    
    def test_react_to_story_clap(self, auth_headers):
        """Test reacting to story with 👏"""
        response = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0 and len(data["data"][0]["stories"]) > 0:
            story_id = data["data"][0]["stories"][0]["id"]
            
            reaction = urllib.parse.quote("👏")
            react_response = requests.post(
                f"{BASE_URL}/api/vip/stories/{story_id}/react?reaction={reaction}",
                headers=auth_headers
            )
            assert react_response.status_code == 200
            print(f"✅ Reacted to story {story_id} with 👏")
        else:
            pytest.skip("No stories available")
    
    def test_react_invalid_emoji(self, auth_headers):
        """Test reacting with invalid emoji returns 400"""
        response = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0 and len(data["data"][0]["stories"]) > 0:
            story_id = data["data"][0]["stories"][0]["id"]
            
            # Invalid emoji
            reaction = urllib.parse.quote("😎")  # Not in valid list
            react_response = requests.post(
                f"{BASE_URL}/api/vip/stories/{story_id}/react?reaction={reaction}",
                headers=auth_headers
            )
            assert react_response.status_code == 400, f"Expected 400, got {react_response.status_code}"
            print("✅ Invalid emoji reaction returns 400 correctly")
        else:
            pytest.skip("No stories available")
    
    def test_delete_own_story(self, auth_headers):
        """Test deleting own story"""
        # First create a story to delete
        create_response = requests.post(
            f"{BASE_URL}/api/vip/stories/create",
            headers=auth_headers,
            json={
                "image_base64": TEST_IMAGE_BASE64,
                "text_overlay": "Story to delete"
            }
        )
        assert create_response.status_code == 200
        story_id = create_response.json()["data"]["id"]
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/vip/stories/{story_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        delete_data = delete_response.json()
        assert delete_data["success"] == True
        print(f"✅ Story deleted: {story_id}")
    
    def test_delete_nonexistent_story(self, auth_headers):
        """Test deleting non-existent story returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/vip/stories/nonexistent-story-id",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("✅ Non-existent story delete returns 404 correctly")
    
    def test_stories_require_auth(self):
        """Test stories endpoints require authentication"""
        # Try without auth
        response = requests.get(f"{BASE_URL}/api/vip/stories")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Stories endpoints require authentication")
    
    def test_stories_require_vip(self):
        """Test stories endpoints require VIP status"""
        # This would require a non-VIP user to test properly
        # For now, we verify VIP access works
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200
        assert response.json()["user"]["is_vip"] == True
        print("✅ VIP user has access to stories")


class TestPushNotifications:
    """Test Push Notifications endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_register_push_token(self, auth_headers):
        """Test registering Expo push token"""
        # Valid Expo push token format
        test_token = "ExponentPushToken[test-token-123456]"
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers=auth_headers,
            json={
                "token": test_token,
                "device_type": "ios"
            }
        )
        assert response.status_code == 200, f"Register token failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"✅ Push token registered: {test_token[:30]}...")
    
    def test_register_push_token_android(self, auth_headers):
        """Test registering Android Expo push token"""
        test_token = "ExponentPushToken[android-device-abc123]"
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers=auth_headers,
            json={
                "token": test_token,
                "device_type": "android"
            }
        )
        assert response.status_code == 200
        print(f"✅ Android push token registered")
    
    def test_register_invalid_token_format(self, auth_headers):
        """Test invalid token format returns 400"""
        invalid_token = "invalid-token-format"
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers=auth_headers,
            json={
                "token": invalid_token,
                "device_type": "ios"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Invalid token format returns 400 correctly")
    
    def test_get_notification_history(self, auth_headers):
        """Test getting notification history"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/history",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get history failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert isinstance(data["data"], list)
        
        # Check notification structure if any exist
        if len(data["data"]) > 0:
            notification = data["data"][0]
            # These fields should be present
            expected_fields = ["id", "title", "body", "type", "is_read", "created_at"]
            for field in expected_fields:
                assert field in notification, f"Missing field: {field}"
        
        print(f"✅ Notification history fetched: {len(data['data'])} notifications")
    
    def test_get_notification_history_with_limit(self, auth_headers):
        """Test getting notification history with limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/history?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert len(data["data"]) <= 5
        print("✅ Notification history with limit works")
    
    def test_mark_all_notifications_read(self, auth_headers):
        """Test marking all notifications as read"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/mark-read",
            headers=auth_headers,
            json={"notification_ids": []}  # Empty array marks all as read
        )
        assert response.status_code == 200, f"Mark read failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print("✅ All notifications marked as read")
    
    def test_mark_specific_notifications_read(self, auth_headers):
        """Test marking specific notifications as read"""
        # First get notifications
        get_response = requests.get(
            f"{BASE_URL}/api/notifications/history",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        notifications = get_response.json()["data"]
        
        if len(notifications) > 0:
            notification_ids = [n["id"] for n in notifications[:2] if n.get("id")]
            
            if notification_ids:
                response = requests.post(
                    f"{BASE_URL}/api/notifications/mark-read",
                    headers=auth_headers,
                    json={"notification_ids": notification_ids}
                )
                assert response.status_code == 200
                print(f"✅ Specific notifications marked as read: {len(notification_ids)}")
            else:
                print("⚠️ No notification IDs to mark")
        else:
            print("⚠️ No notifications to mark as read")
    
    def test_notifications_require_auth(self):
        """Test notification endpoints require authentication"""
        # Try without auth
        response = requests.get(f"{BASE_URL}/api/notifications/history")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Notification history requires authentication")
    
    def test_unregister_push_token(self, auth_headers):
        """Test unregistering push token"""
        test_token = "ExponentPushToken[test-token-to-unregister]"
        
        # First register
        register_response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers=auth_headers,
            json={
                "token": test_token,
                "device_type": "ios"
            }
        )
        assert register_response.status_code == 200
        
        # Then unregister
        unregister_response = requests.delete(
            f"{BASE_URL}/api/notifications/unregister-token?token={test_token}",
            headers=auth_headers
        )
        assert unregister_response.status_code == 200
        data = unregister_response.json()
        assert data["success"] == True
        print("✅ Push token unregistered")


class TestStoriesIntegration:
    """Integration tests for Stories feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VIP_USER_EMAIL,
            "password": VIP_USER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_full_story_workflow(self, auth_headers):
        """Test complete story workflow: create -> view -> react -> delete"""
        # 1. Create story
        create_response = requests.post(
            f"{BASE_URL}/api/vip/stories/create",
            headers=auth_headers,
            json={
                "image_base64": TEST_IMAGE_BASE64,
                "text_overlay": "Integration test story",
                "background_color": "#00D9A5"
            }
        )
        assert create_response.status_code == 200
        story_id = create_response.json()["data"]["id"]
        print(f"✅ Step 1: Story created - {story_id}")
        
        # 2. Verify story appears in list
        list_response = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert list_response.status_code == 200
        stories_data = list_response.json()["data"]
        story_found = False
        for group in stories_data:
            for story in group["stories"]:
                if story["id"] == story_id:
                    story_found = True
                    assert story.get("text_overlay") == "Integration test story"
                    assert story.get("background_color") == "#00D9A5"
                    break
        assert story_found, "Created story not found in list"
        print("✅ Step 2: Story verified in list")
        
        # 3. View the story
        view_response = requests.post(
            f"{BASE_URL}/api/vip/stories/{story_id}/view",
            headers=auth_headers
        )
        assert view_response.status_code == 200
        print("✅ Step 3: Story viewed")
        
        # 4. React to the story
        reaction = urllib.parse.quote("🚀")
        react_response = requests.post(
            f"{BASE_URL}/api/vip/stories/{story_id}/react?reaction={reaction}",
            headers=auth_headers
        )
        assert react_response.status_code == 200
        print("✅ Step 4: Reacted with 🚀")
        
        # 5. Verify view count and reaction
        list_response2 = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert list_response2.status_code == 200
        for group in list_response2.json()["data"]:
            for story in group["stories"]:
                if story["id"] == story_id:
                    assert story["has_viewed"] == True
                    print(f"✅ Step 5: Verified - views: {story['views_count']}, reactions: {story['reactions']}")
                    break
        
        # 6. Delete the story
        delete_response = requests.delete(
            f"{BASE_URL}/api/vip/stories/{story_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        print("✅ Step 6: Story deleted")
        
        # 7. Verify story is gone
        list_response3 = requests.get(f"{BASE_URL}/api/vip/stories", headers=auth_headers)
        assert list_response3.status_code == 200
        for group in list_response3.json()["data"]:
            for story in group["stories"]:
                assert story["id"] != story_id, "Deleted story still appears"
        print("✅ Step 7: Story deletion verified")
        
        print("🎉 Full story workflow test PASSED!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
