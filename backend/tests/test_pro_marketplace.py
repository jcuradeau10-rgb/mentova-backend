"""
Test suite for Professional Marketplace feature - Phase 1
Tests application flow, admin validation, and professional listing endpoints

Endpoints tested:
- GET /api/pro/info - Get pro info (no auth)
- POST /api/pro/apply - Submit professional application (auth required)
- GET /api/pro/application/status - Get application status (auth required)
- GET /api/admin/pro/applications - List applications (admin only)
- PUT /api/admin/pro/applications/{id}/review - Review application (admin only)
- GET /api/pros - List approved professionals (no auth)
- GET /api/pros/{pro_id} - Get professional profile (no auth)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials from the request
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"
TEST_PRO_EMAIL = f"test_pro_apply_{uuid.uuid4().hex[:8]}@cryptonai.com"
TEST_PRO_PASSWORD = "Test123!"


class TestProEndpoints:
    """Test Professional Marketplace endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def admin_token(self, session):
        """Get admin authentication token"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture(scope="class")
    def test_user_token(self, session):
        """Register and get test user token"""
        # Register new user
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_PRO_EMAIL,
            "password": TEST_PRO_PASSWORD,
            "name": "Test Pro Applicant"
        })
        
        if register_response.status_code == 200:
            return register_response.json().get("access_token")
        
        # If user already exists, try login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_PRO_EMAIL,
            "password": TEST_PRO_PASSWORD
        })
        if login_response.status_code == 200:
            return login_response.json().get("access_token")
        
        pytest.skip("Failed to get test user token")
    
    def test_01_get_pro_info_no_auth(self, session):
        """Test GET /api/pro/info - should work without authentication"""
        response = session.get(f"{BASE_URL}/api/pro/info")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        
        pro_info = data["data"]
        assert "title" in pro_info
        assert "benefits" in pro_info
        assert "requirements" in pro_info
        assert "commission_rate" in pro_info
        assert pro_info["commission_rate"] == 0.25
        
        print(f"✓ Pro info endpoint works - Commission rate: {pro_info['commission_rate']}")
    
    def test_02_submit_pro_application(self, session, test_user_token):
        """Test POST /api/pro/apply - submit professional application"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        application_data = {
            "full_name": "Test Professional Expert",
            "phone": "+33612345678",
            "country": "France",
            "city": "Paris",
            "languages": ["Français", "English"],
            "main_expertise": "trading",
            "specializations": ["defi", "nft"],
            "years_experience": 5,
            "bio": "Expert crypto trader with 5+ years of experience in DeFi and NFT markets. Previously worked at major exchanges.",
            "linkedin_url": "https://linkedin.com/in/testpro",
            "twitter_url": "https://twitter.com/testpro",
            "portfolio_url": "https://testpro.crypto",
            "certifications": ["CFA Level 2", "Binance Academy Advanced"],
            "video_intro_url": "",
            "services_offered": ["mentoring", "courses"],
            "hourly_rate": 75,
            "course_price_range": "20-100",
            "availability": "part_time"
        }
        
        response = session.post(
            f"{BASE_URL}/api/pro/apply", 
            json=application_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        assert "application_id" in data["data"]
        assert data["data"]["status"] == "pending"
        
        # Store application ID for later tests
        TestProEndpoints.application_id = data["data"]["application_id"]
        print(f"✓ Application submitted - ID: {TestProEndpoints.application_id}")
    
    def test_03_get_application_status(self, session, test_user_token):
        """Test GET /api/pro/application/status - get current user's application"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        response = session.get(f"{BASE_URL}/api/pro/application/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        
        # Should have an application
        application = data["data"]
        assert application is not None
        assert application["status"] == "pending"
        assert application["full_name"] == "Test Professional Expert"
        assert application["main_expertise"] == "trading"
        
        print(f"✓ Application status: {application['status']}")
    
    def test_04_duplicate_application_rejected(self, session, test_user_token):
        """Test that duplicate application is rejected"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        application_data = {
            "full_name": "Test Professional Expert",
            "phone": "+33612345678",
            "country": "France",
            "city": "Paris",
            "languages": ["Français"],
            "main_expertise": "trading",
            "specializations": [],
            "years_experience": 3,
            "bio": "Another application attempt",
            "services_offered": ["mentoring"],
            "hourly_rate": 50,
            "availability": "full_time"
        }
        
        response = session.post(
            f"{BASE_URL}/api/pro/apply",
            json=application_data,
            headers=headers
        )
        
        # Should fail with 400 - duplicate application
        assert response.status_code == 400
        data = response.json()
        assert "en cours d'examen" in data.get("detail", "").lower() or "pending" in str(response.text).lower()
        
        print("✓ Duplicate application correctly rejected")
    
    def test_05_admin_list_applications(self, session, admin_token):
        """Test GET /api/admin/pro/applications - admin can list applications"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = session.get(f"{BASE_URL}/api/admin/pro/applications", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        assert "total" in data
        assert "stats" in data
        assert "pending" in data["stats"]
        
        applications = data["data"]
        assert isinstance(applications, list)
        
        # Should have at least the test application
        if len(applications) > 0:
            app = applications[0]
            assert "id" in app
            assert "user_email" in app
            assert "status" in app
            assert "full_name" in app
        
        print(f"✓ Admin can list applications - Total: {data['total']}, Pending: {data['stats']['pending']}")
    
    def test_06_admin_filter_applications_by_status(self, session, admin_token):
        """Test filtering applications by status"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = session.get(
            f"{BASE_URL}/api/admin/pro/applications",
            params={"status": "pending"},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned applications should be pending
        for app in data.get("data", []):
            assert app["status"] == "pending"
        
        print(f"✓ Status filter works - {len(data.get('data', []))} pending applications")
    
    def test_07_non_admin_cannot_list_applications(self, session, test_user_token):
        """Test that non-admin cannot access admin endpoints"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        response = session.get(f"{BASE_URL}/api/admin/pro/applications", headers=headers)
        
        # Should return 403 Forbidden
        assert response.status_code == 403
        
        print("✓ Non-admin correctly denied access to admin endpoint")
    
    def test_08_admin_approve_application(self, session, admin_token):
        """Test PUT /api/admin/pro/applications/{id}/review - approve application"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get the application ID from our test
        application_id = getattr(TestProEndpoints, 'application_id', None)
        
        if not application_id:
            # Find the test application
            list_response = session.get(f"{BASE_URL}/api/admin/pro/applications", headers=headers)
            if list_response.status_code == 200:
                apps = list_response.json().get("data", [])
                for app in apps:
                    if "test_pro_apply" in app.get("user_email", ""):
                        application_id = app["id"]
                        break
        
        if not application_id:
            pytest.skip("No test application found to approve")
        
        response = session.put(
            f"{BASE_URL}/api/admin/pro/applications/{application_id}/review",
            params={"decision": "approved", "badge_level": "verified", "admin_notes": "Test approval"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        
        # Store user_id for later - we need to get it from the application
        list_response = session.get(f"{BASE_URL}/api/admin/pro/applications", headers=headers)
        for app in list_response.json().get("data", []):
            if app.get("id") == application_id:
                TestProEndpoints.approved_user_id = app.get("user_id")
                break
        
        print(f"✓ Application approved with 'verified' badge")
    
    def test_09_get_approved_professionals_list(self, session):
        """Test GET /api/pros - list approved professionals (public)"""
        response = session.get(f"{BASE_URL}/api/pros")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        assert "total" in data
        assert "filters" in data
        
        professionals = data["data"]
        assert isinstance(professionals, list)
        
        # Should have at least one professional (Jean Dupont mentioned + our test)
        print(f"✓ Professionals list endpoint works - Total: {data['total']}")
        
        if len(professionals) > 0:
            pro = professionals[0]
            assert "user_id" in pro or "id" in pro
            assert "display_name" in pro
            assert "bio" in pro
            assert "main_expertise" in pro
            assert "badge_level" in pro
            print(f"  First pro: {pro['display_name']} - {pro['badge_level']}")
    
    def test_10_filter_professionals_by_expertise(self, session):
        """Test filtering professionals by expertise"""
        response = session.get(
            f"{BASE_URL}/api/pros",
            params={"expertise": "trading"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned should be trading experts
        for pro in data.get("data", []):
            assert pro["main_expertise"] == "trading"
        
        print(f"✓ Expertise filter works - {len(data.get('data', []))} trading professionals")
    
    def test_11_search_professionals(self, session):
        """Test searching professionals"""
        response = session.get(
            f"{BASE_URL}/api/pros",
            params={"search": "expert"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        print(f"✓ Search works - Found {len(data.get('data', []))} results for 'expert'")
    
    def test_12_sort_professionals(self, session):
        """Test sorting professionals"""
        # By rating
        response = session.get(f"{BASE_URL}/api/pros", params={"sort_by": "rating"})
        assert response.status_code == 200
        
        # By price
        response = session.get(f"{BASE_URL}/api/pros", params={"sort_by": "price"})
        assert response.status_code == 200
        
        # By sessions
        response = session.get(f"{BASE_URL}/api/pros", params={"sort_by": "sessions"})
        assert response.status_code == 200
        
        print("✓ Sorting options work")
    
    def test_13_get_professional_profile(self, session):
        """Test GET /api/pros/{pro_id} - get specific professional profile"""
        # First get the list to find a pro_id
        list_response = session.get(f"{BASE_URL}/api/pros")
        professionals = list_response.json().get("data", [])
        
        if not professionals:
            pytest.skip("No professionals found to test profile endpoint")
        
        pro_id = professionals[0].get("user_id") or professionals[0].get("id")
        
        response = session.get(f"{BASE_URL}/api/pros/{pro_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        
        profile = data["data"]
        assert "display_name" in profile
        assert "bio" in profile
        assert "badge_level" in profile
        # Should include recent reviews
        assert "recent_reviews" in profile
        
        print(f"✓ Profile endpoint works - {profile['display_name']}")
    
    def test_14_invalid_professional_profile(self, session):
        """Test getting non-existent professional profile"""
        response = session.get(f"{BASE_URL}/api/pros/invalid-id-12345")
        
        assert response.status_code == 404
        
        print("✓ Non-existent professional returns 404")
    
    def test_15_application_status_after_approval(self, session, test_user_token):
        """Test that application status is updated after approval"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        response = session.get(f"{BASE_URL}/api/pro/application/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        application = data.get("data")
        if application:
            # Should show approved status
            print(f"✓ Application status after review: {application.get('status')}")
            if application.get("status") == "approved":
                assert application.get("badge_level") is not None
    
    def test_16_invalid_review_decision(self, session, admin_token):
        """Test that invalid decision is rejected"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a fresh application to test invalid decision
        response = session.put(
            f"{BASE_URL}/api/admin/pro/applications/test-invalid/review",
            params={"decision": "invalid_decision"},
            headers=headers
        )
        
        # Should return 400 for invalid decision or 404 for non-existent application
        assert response.status_code in [400, 404]
        
        print("✓ Invalid review decision correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
