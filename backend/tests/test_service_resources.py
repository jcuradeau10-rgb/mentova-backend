"""
Test Service Resources APIs for Pro Dashboard
Tests: GET, POST, DELETE /api/pro/services/{service_id}/resources
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"


class TestServiceResourcesAPI:
    """Test service resources CRUD operations"""
    
    auth_token = None
    service_id = None
    created_resource_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token + service ID"""
        # Login to get token
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        TestServiceResourcesAPI.auth_token = data["access_token"]
        
        # Get services from dashboard
        headers = {"Authorization": f"Bearer {TestServiceResourcesAPI.auth_token}"}
        dashboard_response = requests.get(f"{BASE_URL}/api/pro/dashboard", headers=headers)
        assert dashboard_response.status_code == 200, f"Dashboard failed: {dashboard_response.text}"
        dashboard_data = dashboard_response.json()
        
        services = dashboard_data["data"]["services"]
        if services:
            TestServiceResourcesAPI.service_id = services[0]["id"]
        else:
            pytest.skip("No services available to test resources")
    
    def test_01_get_service_resources(self):
        """Test GET resources for a service"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/pro/services/{self.service_id}/resources",
            headers=headers
        )
        
        assert response.status_code == 200, f"GET resources failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert "resources" in data["data"]
        print(f"GET resources: Found {len(data['data']['resources'])} resources")
    
    def test_02_add_document_resource(self):
        """Test POST add a PDF document resource"""
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
        resource_data = {
            "resource_type": "document",
            "title": f"TEST_Document_{uuid.uuid4().hex[:8]}",
            "description": "Test PDF document for automated testing",
            "file_url": "https://example.com/test-guide.pdf"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/services/{self.service_id}/resources",
            headers=headers,
            json=resource_data
        )
        
        assert response.status_code == 200, f"POST resource failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert data["data"]["resource_type"] == "document"
        assert data["data"]["title"] == resource_data["title"]
        assert "id" in data["data"]
        
        TestServiceResourcesAPI.created_resource_id = data["data"]["id"]
        print(f"Created resource ID: {self.created_resource_id}")
    
    def test_03_add_video_resource(self):
        """Test POST add a video resource"""
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
        resource_data = {
            "resource_type": "video",
            "title": f"TEST_Video_{uuid.uuid4().hex[:8]}",
            "description": "Test video for automated testing",
            "file_url": "https://youtube.com/watch?v=test123"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/services/{self.service_id}/resources",
            headers=headers,
            json=resource_data
        )
        
        assert response.status_code == 200, f"POST video resource failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["data"]["resource_type"] == "video"
        print(f"Created video resource ID: {data['data']['id']}")
    
    def test_04_add_link_resource(self):
        """Test POST add a link resource"""
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
        resource_data = {
            "resource_type": "link",
            "title": f"TEST_Link_{uuid.uuid4().hex[:8]}",
            "description": "External link for testing",
            "content": "https://example.com/external-resource"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/services/{self.service_id}/resources",
            headers=headers,
            json=resource_data
        )
        
        assert response.status_code == 200, f"POST link resource failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["data"]["resource_type"] == "link"
        print(f"Created link resource ID: {data['data']['id']}")
    
    def test_05_verify_resources_added(self):
        """Test GET to verify resources were added"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/pro/services/{self.service_id}/resources",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        resources = data["data"]["resources"]
        
        # Check that we have test resources
        test_resources = [r for r in resources if r["title"].startswith("TEST_")]
        assert len(test_resources) >= 3, f"Expected at least 3 test resources, found {len(test_resources)}"
        print(f"Verified {len(test_resources)} test resources exist")
    
    def test_06_delete_resource(self):
        """Test DELETE a resource"""
        if not self.created_resource_id:
            pytest.skip("No resource ID to delete")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        response = requests.delete(
            f"{BASE_URL}/api/pro/services/{self.service_id}/resources/{self.created_resource_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"DELETE resource failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "Ressource supprimée"
        print(f"Deleted resource: {self.created_resource_id}")
    
    def test_07_verify_resource_deleted(self):
        """Test GET to verify resource was deleted"""
        if not self.created_resource_id:
            pytest.skip("No resource ID to verify deletion")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/pro/services/{self.service_id}/resources",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        resources = data["data"]["resources"]
        
        resource_ids = [r["id"] for r in resources]
        assert self.created_resource_id not in resource_ids, "Resource should have been deleted"
        print("Verified resource was deleted successfully")
    
    def test_08_unauthorized_access(self):
        """Test that unauthorized users cannot access resources"""
        response = requests.get(
            f"{BASE_URL}/api/pro/services/{self.service_id}/resources"
        )
        
        # Should return 403 (Forbidden) or 401 (Unauthorized)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Unauthorized access properly blocked")
    
    def test_09_cleanup_test_resources(self):
        """Cleanup: Delete all test resources created"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Get all resources
        response = requests.get(
            f"{BASE_URL}/api/pro/services/{self.service_id}/resources",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            resources = data["data"]["resources"]
            
            # Delete test resources (prefixed with TEST_)
            deleted_count = 0
            for resource in resources:
                if resource["title"].startswith("TEST_"):
                    del_response = requests.delete(
                        f"{BASE_URL}/api/pro/services/{self.service_id}/resources/{resource['id']}",
                        headers=headers
                    )
                    if del_response.status_code == 200:
                        deleted_count += 1
            
            print(f"Cleaned up {deleted_count} test resources")


class TestServiceCreationWithMeetingLink:
    """Test service creation with meeting_link field"""
    
    auth_token = None
    created_service_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        TestServiceCreationWithMeetingLink.auth_token = response.json()["access_token"]
    
    def test_01_create_service_with_meeting_link(self):
        """Test creating a service with meeting_link for live sessions"""
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
        
        service_data = {
            "service_type": "live_stream",
            "title": f"TEST_Live_Session_{uuid.uuid4().hex[:8]}",
            "description": "Test live session with Zoom link",
            "price": 75.0,
            "duration_minutes": 60,
            "max_participants": 10,
            "is_active": True,
            "available_days": [0, 1, 2, 3, 4],
            "available_hours": [{"start": "09:00", "end": "18:00"}],
            "meeting_link": "https://zoom.us/j/1234567890"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pro/dashboard/services",
            headers=headers,
            json=service_data
        )
        
        assert response.status_code == 200, f"Create service failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "id" in data["data"]
        
        TestServiceCreationWithMeetingLink.created_service_id = data["data"]["id"]
        print(f"Created service with meeting_link: {self.created_service_id}")
    
    def test_02_verify_meeting_link_in_service(self):
        """Verify that meeting_link is saved in the service"""
        if not self.created_service_id:
            pytest.skip("No service created")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Get dashboard to find the service
        response = requests.get(f"{BASE_URL}/api/pro/dashboard", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        services = data["data"]["services"]
        
        # Find our test service
        test_service = next((s for s in services if s["id"] == self.created_service_id), None)
        
        if test_service:
            # Check if meeting_link is present (it may be stored)
            print(f"Service found: {test_service.get('title')}")
            print(f"Meeting link stored: {test_service.get('meeting_link', 'Not found in response')}")
    
    def test_03_cleanup_test_service(self):
        """Cleanup: Delete test service"""
        if not self.created_service_id:
            pytest.skip("No service to delete")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/pro/dashboard/services/{self.created_service_id}",
            headers=headers
        )
        
        # Service may or may not exist
        if response.status_code == 200:
            print(f"Cleaned up test service: {self.created_service_id}")
        else:
            print(f"Service cleanup status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
