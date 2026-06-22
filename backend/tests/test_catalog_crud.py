"""
Test suite for Pro Catalog CRUD operations - verifying bug fixes:
1. Delete content - DELETE /api/pro/content-library/{id}
2. Delete offer - DELETE /api/pro/offers/{id}
3. Toggle publish/unpublish - PUT /api/pro/offers/{id}/publish
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"

# Storage for test IDs
test_data = {
    "token": None,
    "content_id": None,
    "offer_id": None
}


class TestCatalogCRUDBugFixes:
    """Test all three reported bugs are fixed"""
    
    def test_01_health_check(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✓ Health check passed")
    
    def test_02_login_admin(self):
        """Login with admin account to get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Auth returns 'access_token' not 'token'
        assert "access_token" in data, f"No access_token in response: {data}"
        test_data["token"] = data["access_token"]
        
        # Verify user is professional
        assert data.get("user", {}).get("is_professional") == True, "User must be professional"
        print(f"✓ Logged in as admin, is_professional=True")
    
    def test_03_create_content_item(self):
        """Create a test content item for deletion test"""
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        payload = {
            "content_type": "pdf",
            "title": "TEST_Delete_Content_Item",
            "description": "Test content for deletion testing",
            "tags": ["test", "delete"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/content-library",
            json=payload,
            headers=headers
        )
        assert response.status_code == 200, f"Create content failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Create not successful: {data}"
        assert "data" in data and "id" in data["data"], f"No id in response: {data}"
        
        test_data["content_id"] = data["data"]["id"]
        print(f"✓ Created content item: {test_data['content_id']}")
    
    def test_04_delete_content_item(self):
        """BUG FIX #1: Delete content - DELETE /api/pro/content-library/{id}"""
        assert test_data["content_id"], "No content_id to delete"
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/pro/content-library/{test_data['content_id']}",
            headers=headers
        )
        
        # Must return 200 with success:true
        assert response.status_code == 200, f"Delete content failed with status {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Delete not successful: {data}"
        print(f"✓ BUG FIX #1: Delete content returned 200 with success=True")
        
        # Verify content no longer exists
        get_response = requests.get(
            f"{BASE_URL}/api/pro/content-library/{test_data['content_id']}",
            headers=headers
        )
        assert get_response.status_code == 404, f"Content should be deleted but still exists"
        print(f"✓ Verified content {test_data['content_id']} no longer exists")
    
    def test_05_create_offer(self):
        """Create a test offer for deletion and publish tests"""
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        payload = {
            "title": "TEST_Delete_Offer",
            "description": "Test offer for deletion testing",
            "offer_type": "single",
            "price": 10,
            "included_content_ids": [],
            "is_published": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/offers",
            json=payload,
            headers=headers
        )
        assert response.status_code == 200, f"Create offer failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Create offer not successful: {data}"
        assert "data" in data and "id" in data["data"], f"No id in offer response: {data}"
        
        test_data["offer_id"] = data["data"]["id"]
        print(f"✓ Created offer: {test_data['offer_id']}")
    
    def test_06_toggle_publish_on(self):
        """BUG FIX #3: Toggle publish status - PUT /api/pro/offers/{id}/publish"""
        assert test_data["offer_id"], "No offer_id to publish"
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        
        response = requests.put(
            f"{BASE_URL}/api/pro/offers/{test_data['offer_id']}/publish",
            headers=headers
        )
        
        # Must return 200 with success:true and is_published field
        assert response.status_code == 200, f"Toggle publish failed with status {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Toggle publish not successful: {data}"
        assert "is_published" in data, f"No is_published field in response: {data}"
        assert data["is_published"] == True, f"Expected is_published=True, got {data}"
        print(f"✓ BUG FIX #3: Toggle publish ON returned 200, is_published=True")
    
    def test_07_toggle_publish_off(self):
        """BUG FIX #3: Toggle unpublish - same endpoint should toggle back"""
        assert test_data["offer_id"], "No offer_id to unpublish"
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        
        response = requests.put(
            f"{BASE_URL}/api/pro/offers/{test_data['offer_id']}/publish",
            headers=headers
        )
        
        # Same endpoint should toggle back to False
        assert response.status_code == 200, f"Toggle unpublish failed with status {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Toggle unpublish not successful: {data}"
        assert "is_published" in data, f"No is_published field in response: {data}"
        assert data["is_published"] == False, f"Expected is_published=False after toggle, got {data}"
        print(f"✓ BUG FIX #3: Toggle publish OFF returned 200, is_published=False")
    
    def test_08_delete_offer(self):
        """BUG FIX #2: Delete offer - DELETE /api/pro/offers/{id}"""
        assert test_data["offer_id"], "No offer_id to delete"
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/pro/offers/{test_data['offer_id']}",
            headers=headers
        )
        
        # Must return 200 with success:true
        assert response.status_code == 200, f"Delete offer failed with status {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Delete offer not successful: {data}"
        print(f"✓ BUG FIX #2: Delete offer returned 200 with success=True")
        
        # Verify offer no longer exists
        get_response = requests.get(
            f"{BASE_URL}/api/pro/offers/{test_data['offer_id']}",
            headers=headers
        )
        assert get_response.status_code == 404, f"Offer should be deleted but still exists"
        print(f"✓ Verified offer {test_data['offer_id']} no longer exists")
    
    def test_09_create_second_offer_for_toggle_verification(self):
        """Create another offer to verify publish toggle works correctly"""
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        payload = {
            "title": "TEST_Toggle_Offer_2",
            "description": "Second test offer for toggle verification",
            "offer_type": "single",
            "price": 25,
            "included_content_ids": [],
            "is_published": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/offers",
            json=payload,
            headers=headers
        )
        assert response.status_code == 200, f"Create offer failed: {response.text}"
        data = response.json()
        test_data["offer_id"] = data["data"]["id"]
        print(f"✓ Created second offer: {test_data['offer_id']}")
    
    def test_10_verify_full_toggle_cycle(self):
        """Verify full publish/unpublish cycle works multiple times"""
        assert test_data["offer_id"], "No offer_id for cycle test"
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        
        # Toggle 1: False -> True
        r1 = requests.put(f"{BASE_URL}/api/pro/offers/{test_data['offer_id']}/publish", headers=headers)
        assert r1.status_code == 200 and r1.json().get("is_published") == True
        print("  Cycle 1: OFF -> ON ✓")
        
        # Toggle 2: True -> False
        r2 = requests.put(f"{BASE_URL}/api/pro/offers/{test_data['offer_id']}/publish", headers=headers)
        assert r2.status_code == 200 and r2.json().get("is_published") == False
        print("  Cycle 2: ON -> OFF ✓")
        
        # Toggle 3: False -> True
        r3 = requests.put(f"{BASE_URL}/api/pro/offers/{test_data['offer_id']}/publish", headers=headers)
        assert r3.status_code == 200 and r3.json().get("is_published") == True
        print("  Cycle 3: OFF -> ON ✓")
        
        print(f"✓ Full toggle cycle verified - publish toggle works correctly")
    
    def test_11_cleanup_second_offer(self):
        """Cleanup: Delete the second test offer"""
        if test_data.get("offer_id"):
            headers = {"Authorization": f"Bearer {test_data['token']}"}
            response = requests.delete(
                f"{BASE_URL}/api/pro/offers/{test_data['offer_id']}",
                headers=headers
            )
            assert response.status_code == 200, f"Cleanup failed: {response.text}"
            print(f"✓ Cleaned up test offer {test_data['offer_id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
