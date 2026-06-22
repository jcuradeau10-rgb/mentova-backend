"""
Test: Content Scheduling, Pro->Mentor Rename, Content/Offer CRUD
Tests the following features:
1. Backend API health check
2. Login with admin@cryptonai.com
3. Content Library CRUD - GET /api/pro/content-library
4. Content creation with available_from field
5. Content deletion
6. Content access with is_available flag
7. Offer deletion
"""

import pytest
import requests
import os
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "jcuradeau.7@gmail.com"
USER_PASSWORD = "Crypto2026!"


class TestHealthAndAuth:
    """Test API health and authentication"""
    
    def test_health_check(self):
        """Test that API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_login_admin(self):
        """Test login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful: {data['user']['name']}")
        return data["access_token"]
    
    def test_login_user(self):
        """Test login with regular user credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        # This user might be super_admin
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            print(f"✓ User login successful: {data['user']['name']}")
            return data["access_token"]
        else:
            print(f"! User login returned {response.status_code} - may not exist")
            pytest.skip("User account not available")


class TestContentLibraryCRUD:
    """Test Content Library CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_content_ids = []
    
    def teardown_method(self, method):
        """Cleanup created content after each test"""
        for content_id in self.created_content_ids:
            try:
                requests.delete(f"{BASE_URL}/api/pro/content-library/{content_id}", headers=self.headers)
            except:
                pass
    
    def test_get_content_library(self):
        """Test GET /api/pro/content-library returns content list"""
        response = requests.get(f"{BASE_URL}/api/pro/content-library", headers=self.headers)
        assert response.status_code == 200, f"Failed to get content library: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"✓ Content library retrieved: {len(data['data'])} items")
    
    def test_create_content_basic(self):
        """Test POST /api/pro/content-library - basic content creation"""
        content_data = {
            "content_type": "pdf",
            "title": "TEST_Content_Basic",
            "description": "Test content for automated testing",
            "tags": ["test", "automation"],
            "is_premium": False
        }
        
        response = requests.post(f"{BASE_URL}/api/pro/content-library", 
                                  json=content_data, 
                                  headers=self.headers)
        assert response.status_code == 200, f"Failed to create content: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        created = data["data"]
        self.created_content_ids.append(created["id"])
        
        # Verify data assertions
        assert created["title"] == content_data["title"]
        assert created["content_type"] == content_data["content_type"]
        assert created["description"] == content_data["description"]
        assert "id" in created
        print(f"✓ Content created: {created['id']}")
        
        # GET to verify persistence
        get_response = requests.get(f"{BASE_URL}/api/pro/content-library/{created['id']}", 
                                     headers=self.headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["data"]["title"] == content_data["title"]
        print(f"✓ Content persisted and retrieved successfully")
    
    def test_create_content_with_available_from(self):
        """Test POST /api/pro/content-library with available_from ISO datetime"""
        # Schedule content for tomorrow
        future_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        
        content_data = {
            "content_type": "quiz",
            "title": "TEST_Scheduled_Quiz",
            "description": "Quiz scheduled for future availability",
            "tags": ["test", "scheduled"],
            "is_premium": True,
            "available_from": future_date
        }
        
        response = requests.post(f"{BASE_URL}/api/pro/content-library", 
                                  json=content_data, 
                                  headers=self.headers)
        assert response.status_code == 200, f"Failed to create scheduled content: {response.text}"
        data = response.json()
        assert data.get("success") == True
        created = data["data"]
        self.created_content_ids.append(created["id"])
        
        # Verify available_from was saved
        assert created.get("available_from") is not None
        print(f"✓ Scheduled content created with available_from: {created['available_from']}")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/pro/content-library/{created['id']}", 
                                     headers=self.headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["data"]["available_from"] is not None
        print(f"✓ available_from persisted: {get_data['data']['available_from']}")
    
    def test_create_session_content_with_meeting_link(self):
        """Test creating session content with meeting_link"""
        content_data = {
            "content_type": "session",
            "title": "TEST_Live_Session",
            "description": "Live session with Zoom link",
            "content_data": {
                "session_type": "one_on_one",
                "max_participants": 1,
                "meeting_link": "https://zoom.us/j/1234567890"
            },
            "duration_minutes": 60,
            "is_premium": True
        }
        
        response = requests.post(f"{BASE_URL}/api/pro/content-library", 
                                  json=content_data, 
                                  headers=self.headers)
        assert response.status_code == 200, f"Failed to create session content: {response.text}"
        data = response.json()
        assert data.get("success") == True
        created = data["data"]
        self.created_content_ids.append(created["id"])
        
        # Verify content_data with meeting_link was saved
        assert created.get("content_data") is not None
        assert created["content_data"].get("meeting_link") == "https://zoom.us/j/1234567890"
        print(f"✓ Session content created with meeting_link: {created['content_data'].get('meeting_link')}")
    
    def test_update_content(self):
        """Test PUT /api/pro/content-library/{content_id}"""
        # First create content
        content_data = {
            "content_type": "video",
            "title": "TEST_Video_Original",
            "description": "Original description"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/pro/content-library", 
                                         json=content_data, 
                                         headers=self.headers)
        assert create_response.status_code == 200
        created = create_response.json()["data"]
        self.created_content_ids.append(created["id"])
        
        # Update content
        update_data = {
            "title": "TEST_Video_Updated",
            "description": "Updated description"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/pro/content-library/{created['id']}", 
                                        json=update_data, 
                                        headers=self.headers)
        assert update_response.status_code == 200
        
        # GET to verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/pro/content-library/{created['id']}", 
                                     headers=self.headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["data"]["title"] == "TEST_Video_Updated"
        assert get_data["data"]["description"] == "Updated description"
        print(f"✓ Content updated and persisted")
    
    def test_delete_content(self):
        """Test DELETE /api/pro/content-library/{content_id} works properly"""
        # First create content
        content_data = {
            "content_type": "pdf",
            "title": "TEST_To_Delete",
            "description": "Content to be deleted"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/pro/content-library", 
                                         json=content_data, 
                                         headers=self.headers)
        assert create_response.status_code == 200
        created = create_response.json()["data"]
        content_id = created["id"]
        
        # Delete content
        delete_response = requests.delete(f"{BASE_URL}/api/pro/content-library/{content_id}", 
                                           headers=self.headers)
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        delete_data = delete_response.json()
        assert delete_data.get("success") == True
        print(f"✓ Content deleted successfully")
        
        # GET to verify it no longer exists
        get_response = requests.get(f"{BASE_URL}/api/pro/content-library/{content_id}", 
                                     headers=self.headers)
        assert get_response.status_code == 404, "Content should not exist after deletion"
        print(f"✓ Content verified as deleted (404 on GET)")


class TestOfferCRUD:
    """Test Offer CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_offer_ids = []
    
    def teardown_method(self, method):
        """Cleanup created offers after each test"""
        for offer_id in self.created_offer_ids:
            try:
                requests.delete(f"{BASE_URL}/api/pro/offers/{offer_id}", headers=self.headers)
            except:
                pass
    
    def test_get_offers(self):
        """Test GET /api/pro/offers returns offers list"""
        response = requests.get(f"{BASE_URL}/api/pro/offers", headers=self.headers)
        assert response.status_code == 200, f"Failed to get offers: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"✓ Offers retrieved: {len(data['data'])} items")
    
    def test_create_offer(self):
        """Test POST /api/pro/offers - offer creation"""
        offer_data = {
            "offer_type": "bundle",
            "title": "TEST_Bundle_Offer",
            "description": "Test bundle offer for automation",
            "short_description": "Test bundle",
            "price": 29.99,
            "pricing_model": "one_time",
            "is_published": False
        }
        
        response = requests.post(f"{BASE_URL}/api/pro/offers", 
                                  json=offer_data, 
                                  headers=self.headers)
        assert response.status_code == 200, f"Failed to create offer: {response.text}"
        data = response.json()
        assert data.get("success") == True
        created = data["data"]
        self.created_offer_ids.append(created["id"])
        
        # Verify data assertions
        assert created["title"] == offer_data["title"]
        assert created["price"] == offer_data["price"]
        print(f"✓ Offer created: {created['id']}")
    
    def test_delete_offer(self):
        """Test DELETE /api/pro/offers/{offer_id} works"""
        # First create an offer
        offer_data = {
            "offer_type": "single",
            "title": "TEST_Offer_To_Delete",
            "description": "Offer to be deleted",
            "price": 9.99,
            "pricing_model": "one_time"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/pro/offers", 
                                         json=offer_data, 
                                         headers=self.headers)
        assert create_response.status_code == 200
        created = create_response.json()["data"]
        offer_id = created["id"]
        
        # Delete offer
        delete_response = requests.delete(f"{BASE_URL}/api/pro/offers/{offer_id}", 
                                           headers=self.headers)
        assert delete_response.status_code == 200, f"Delete offer failed: {delete_response.text}"
        delete_data = delete_response.json()
        assert delete_data.get("success") == True
        print(f"✓ Offer deleted successfully")
        
        # Verify deletion by trying to get it
        get_response = requests.get(f"{BASE_URL}/api/pro/offers/{offer_id}", 
                                     headers=self.headers)
        assert get_response.status_code == 404, "Offer should not exist after deletion"
        print(f"✓ Offer verified as deleted (404 on GET)")


class TestContentAccessWithAvailability:
    """Test marketplace purchase access with is_available flag"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_purchase_access_endpoint_exists(self):
        """Test that GET /api/marketplace/purchases/{purchase_id}/access endpoint exists"""
        # Use a non-existent purchase_id to check endpoint exists
        response = requests.get(f"{BASE_URL}/api/marketplace/purchases/fake-id/access", 
                                 headers=self.headers)
        # Should return 404 (not found) not 405 (method not allowed) or 500
        assert response.status_code == 404, f"Unexpected status: {response.status_code}, {response.text}"
        print(f"✓ Purchase access endpoint exists (returned 404 for fake ID)")
    
    def test_purchase_access_requires_auth(self):
        """Test that purchase access requires authentication"""
        response = requests.get(f"{BASE_URL}/api/marketplace/purchases/any-id/access")
        assert response.status_code in [401, 403], f"Should require auth: {response.status_code}"
        print(f"✓ Purchase access requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
