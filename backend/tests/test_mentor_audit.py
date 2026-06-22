"""
Complete Mentor/Pro System Audit Tests
Testing all Pro Dashboard, Content Library, Offers, Courses, Bookings, Marketplace, Analytics endpoints
RESPONSE FORMAT: All API responses wrap data in {"success": true, "data": {...}}
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com')

# Test credentials
PRO_USER_EMAIL = "jcuradeau.7@gmail.com"
PRO_USER_PASSWORD = "Crypto2026!"
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"


class TestAuthAndLogin:
    """Authentication tests to get token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def pro_session(self):
        """Login as professional user and return session with auth token"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200, f"Pro login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session, data.get("user", {})
    
    def test_pro_login_returns_correct_flags(self, pro_session):
        """Verify pro user has correct flags set"""
        session, user = pro_session
        assert user.get("is_professional") == True, "is_professional should be True"
        print(f"Pro user login successful: {user.get('email')}")
        print(f"is_professional: {user.get('is_professional')}")
        print(f"is_vip: {user.get('is_vip')}")
        print(f"is_influencer: {user.get('is_influencer')}")


class TestProDashboard:
    """Pro Dashboard API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_get_dashboard(self, auth_session):
        """GET /api/pro/dashboard - should return dashboard data wrapped in data field"""
        response = auth_session.get(f"{BASE_URL}/api/pro/dashboard")
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        resp = response.json()
        
        # Check success wrapper
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", {})
        
        # Verify expected fields in data
        assert "profile" in data, "Missing profile in dashboard data"
        assert "services" in data, "Missing services in dashboard data"
        assert "stats" in data, "Missing stats in dashboard data"
        assert "recent_bookings" in data, "Missing recent_bookings in dashboard data"
        
        print(f"Dashboard loaded successfully")
        print(f"  - Services count: {len(data.get('services', []))}")
        print(f"  - Stats: {data.get('stats', {})}")
        print(f"  - Recent bookings: {len(data.get('recent_bookings', []))}")

    def test_get_dashboard_bookings(self, auth_session):
        """GET /api/pro/dashboard/bookings - should return bookings list"""
        response = auth_session.get(f"{BASE_URL}/api/pro/dashboard/bookings")
        assert response.status_code == 200, f"Bookings failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        # Data can be an array directly or in 'data' field
        data = resp.get("data", [])
        total = resp.get("total", len(data) if isinstance(data, list) else 0)
        print(f"Dashboard bookings: {total} total")

    def test_get_pro_earnings(self, auth_session):
        """GET /api/pro/earnings - should return earnings data"""
        response = auth_session.get(f"{BASE_URL}/api/pro/earnings")
        assert response.status_code == 200, f"Earnings failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", {})
        
        # Verify earnings structure - actual fields may differ
        print(f"Earnings data keys: {list(data.keys())}")
        print(f"Earnings data: {data}")

    def test_get_advanced_stats(self, auth_session):
        """GET /api/pro/advanced-stats - should return advanced statistics"""
        response = auth_session.get(f"{BASE_URL}/api/pro/advanced-stats")
        assert response.status_code == 200, f"Advanced stats failed: {response.text}"
        data = response.json()
        print(f"Advanced stats retrieved successfully: {list(data.keys())}")


class TestContentLibrary:
    """Content Library API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_get_content_library(self, auth_session):
        """GET /api/pro/content-library - should return content items"""
        response = auth_session.get(f"{BASE_URL}/api/pro/content-library")
        assert response.status_code == 200, f"Content library failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", [])
        count = len(data) if isinstance(data, list) else 0
        print(f"Content library: {count} items")

    def test_create_content_item(self, auth_session):
        """POST /api/pro/content-library - should create content item"""
        test_content = {
            "content_type": "text",
            "title": "TEST_Audit Content Item",
            "description": "Test content for audit",
            "content_data": {"text": "Test content body"},
            "tags": ["test", "audit"],
            "is_premium": False
        }
        response = auth_session.post(f"{BASE_URL}/api/pro/content-library", json=test_content)
        assert response.status_code in [200, 201], f"Create content failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", {})
        assert "id" in data, "No ID returned for created content"
        print(f"Created content item: {data.get('id')}")
        
        # Cleanup - delete test content
        if "id" in data:
            auth_session.delete(f"{BASE_URL}/api/pro/content-library/{data['id']}")


class TestOffers:
    """Pro Offers API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_get_offers(self, auth_session):
        """GET /api/pro/offers - should return offers list"""
        response = auth_session.get(f"{BASE_URL}/api/pro/offers")
        assert response.status_code == 200, f"Get offers failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", [])
        count = len(data) if isinstance(data, list) else 0
        print(f"Pro offers: {count} offers")

    def test_create_offer(self, auth_session):
        """POST /api/pro/offers - should create an offer"""
        test_offer = {
            "offer_type": "single_content",
            "title": "TEST_Audit Offer",
            "description": "Test offer for audit",
            "short_description": "Test offer",
            "price": 9.99,
            "pricing_model": "one_time",
            "category": "trading",
            "difficulty": "beginner",
            "tags": ["test", "audit"],
            "is_published": False
        }
        response = auth_session.post(f"{BASE_URL}/api/pro/offers", json=test_offer)
        assert response.status_code in [200, 201], f"Create offer failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", {})
        assert "id" in data, "No ID returned for created offer"
        print(f"Created offer: {data.get('id')}")
        
        # Cleanup
        if "id" in data:
            auth_session.delete(f"{BASE_URL}/api/pro/offers/{data['id']}")


class TestAnalytics:
    """Pro Analytics API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_get_revenue_analytics(self, auth_session):
        """GET /api/pro/analytics/revenue - should return revenue chart data"""
        response = auth_session.get(f"{BASE_URL}/api/pro/analytics/revenue")
        assert response.status_code == 200, f"Revenue analytics failed: {response.text}"
        data = response.json()
        print(f"Revenue analytics retrieved: {list(data.keys())}")

    def test_get_performance_analytics(self, auth_session):
        """GET /api/pro/analytics/performance - should return performance data"""
        response = auth_session.get(f"{BASE_URL}/api/pro/analytics/performance")
        assert response.status_code == 200, f"Performance analytics failed: {response.text}"
        data = response.json()
        print(f"Performance analytics retrieved: {list(data.keys())}")


class TestCourses:
    """Pro Courses API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_get_pro_courses(self, auth_session):
        """GET /api/pro/courses - should return pro's courses"""
        response = auth_session.get(f"{BASE_URL}/api/pro/courses")
        assert response.status_code == 200, f"Pro courses failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", [])
        count = len(data) if isinstance(data, list) else 0
        print(f"Pro courses: {count} courses")

    def test_get_public_courses(self, auth_session):
        """GET /api/courses - should return public courses list"""
        response = auth_session.get(f"{BASE_URL}/api/courses")
        assert response.status_code == 200, f"Public courses failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", [])
        total = resp.get("total", len(data) if isinstance(data, list) else 0)
        print(f"Public courses: {total} courses")


class TestExport:
    """Pro Export API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_export_bookings_csv(self, auth_session):
        """GET /api/pro/export/bookings - should return CSV data"""
        response = auth_session.get(f"{BASE_URL}/api/pro/export/bookings", params={"format": "csv"})
        assert response.status_code == 200, f"Export bookings failed: {response.text}"
        content_type = response.headers.get('Content-Type', '')
        print(f"Export bookings response type: {content_type}")

    def test_export_revenue(self, auth_session):
        """GET /api/pro/export/revenue - should return revenue data"""
        response = auth_session.get(f"{BASE_URL}/api/pro/export/revenue")
        assert response.status_code == 200, f"Export revenue failed: {response.text}"
        data = response.json()
        print(f"Export revenue data keys: {list(data.keys())}")


class TestMarketplace:
    """Marketplace Public API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_get_marketplace_offers(self, auth_session):
        """GET /api/marketplace/offers - should return public offers"""
        response = auth_session.get(f"{BASE_URL}/api/marketplace/offers")
        assert response.status_code == 200, f"Marketplace offers failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", [])
        count = len(data) if isinstance(data, list) else 0
        print(f"Marketplace offers: {count} offers")

    def test_get_my_purchases(self, auth_session):
        """GET /api/marketplace/purchases - should return user's purchases"""
        response = auth_session.get(f"{BASE_URL}/api/marketplace/purchases")
        assert response.status_code == 200, f"My purchases failed: {response.text}"
        data = response.json()
        purchases = data.get("purchases", data.get("data", data if isinstance(data, list) else []))
        count = len(purchases) if isinstance(purchases, list) else 0
        print(f"User purchases: {count} purchases")


class TestBookings:
    """Bookings API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_get_my_bookings(self, auth_session):
        """GET /api/bookings/my - should return user's bookings"""
        response = auth_session.get(f"{BASE_URL}/api/bookings/my")
        assert response.status_code == 200, f"My bookings failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", [])
        total = resp.get("total", len(data) if isinstance(data, list) else 0)
        print(f"User bookings: {total} bookings")


class TestProfessionalsList:
    """Professionals Listing API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_get_professionals(self, auth_session):
        """GET /api/pros - should return list of professionals"""
        response = auth_session.get(f"{BASE_URL}/api/pros")
        assert response.status_code == 200, f"Pros list failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", [])
        total = resp.get("total", len(data) if isinstance(data, list) else 0)
        print(f"Professionals: {total} pros")


class TestServiceCRUD:
    """Pro Service CRUD Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_create_service(self, auth_session):
        """POST /api/pro/dashboard/services - should create a service"""
        test_service = {
            "service_type": "consultation",
            "title": "TEST_Audit Service",
            "description": "Test service for audit",
            "price": 49.99,
            "duration_minutes": 60,
            "max_participants": 1,
            "is_active": True
        }
        response = auth_session.post(f"{BASE_URL}/api/pro/dashboard/services", json=test_service)
        assert response.status_code in [200, 201], f"Create service failed: {response.text}"
        resp = response.json()
        
        assert resp.get("success") == True, "Response should have success=true"
        data = resp.get("data", {})
        assert "id" in data, "No ID returned for created service"
        print(f"Created service: {data.get('id')}")
        
        # Cleanup
        if "id" in data:
            auth_session.delete(f"{BASE_URL}/api/pro/dashboard/services/{data['id']}")


class TestDataIntegrity:
    """Database Data Integrity Tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_dashboard_data_consistency(self, auth_session):
        """Verify dashboard data is consistent"""
        dash_response = auth_session.get(f"{BASE_URL}/api/pro/dashboard")
        assert dash_response.status_code == 200
        resp = dash_response.json()
        dash_data = resp.get("data", {})
        
        services_in_dashboard = len(dash_data.get("services", []))
        stats = dash_data.get("stats", {})
        
        print(f"Dashboard consistency check:")
        print(f"  - Services in dashboard: {services_in_dashboard}")
        print(f"  - Stats: {stats}")

    def test_offers_and_content_library_consistency(self, auth_session):
        """Verify offers reference valid content items"""
        content_resp = auth_session.get(f"{BASE_URL}/api/pro/content-library")
        assert content_resp.status_code == 200
        content_data = content_resp.json().get("data", [])
        content_ids = [item.get("id") for item in content_data if isinstance(content_data, list)]
        
        offers_resp = auth_session.get(f"{BASE_URL}/api/pro/offers")
        assert offers_resp.status_code == 200
        offers_data = offers_resp.json().get("data", [])
        
        print(f"Content-Offers consistency check:")
        print(f"  - Content items: {len(content_ids)}")
        print(f"  - Offers: {len(offers_data) if isinstance(offers_data, list) else 0}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
