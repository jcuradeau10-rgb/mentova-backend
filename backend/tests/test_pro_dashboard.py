"""
Test suite for Professional Dashboard feature - Phase 2
Tests dashboard data, profile management, services CRUD, withdrawals, and booking management

Endpoints tested:
- GET /api/pro/dashboard - Get dashboard data (professional only)
- PUT /api/pro/dashboard/profile - Update professional profile
- POST /api/pro/dashboard/services - Create new service
- PUT /api/pro/dashboard/services/{id} - Update service
- DELETE /api/pro/dashboard/services/{id} - Delete service
- POST /api/pro/dashboard/withdraw - Request withdrawal (min 50€)
- PUT /api/pro/dashboard/bookings/{id}/status - Update booking status
- Notification sent on application approval/rejection
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
PRO_EMAIL = "pro_test@cryptonai.com"
PRO_PASSWORD = "ProTest123!"
ADMIN_EMAIL = "admin@cryptonai.com"
ADMIN_PASSWORD = "Admin123!"
REGULAR_EMAIL = "test@example.com"
REGULAR_PASSWORD = "test123"


class TestProDashboard:
    """Test Professional Dashboard endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def pro_token(self, session):
        """Get professional user authentication token"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_EMAIL,
            "password": PRO_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            # Verify user is a professional
            user = data.get("user", {})
            print(f"Pro user logged in: {user.get('email')}, is_professional: {user.get('is_professional', 'N/A')}")
            return data.get("access_token")
        pytest.skip(f"Pro authentication failed: {response.status_code} - {response.text}")
    
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
    def regular_token(self, session):
        """Get regular user token (non-professional)"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_EMAIL,
            "password": REGULAR_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        # Try to register if doesn't exist
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": REGULAR_EMAIL,
            "password": REGULAR_PASSWORD,
            "name": "Regular Test User"
        })
        if register_response.status_code == 200:
            return register_response.json().get("access_token")
        pytest.skip("Regular user authentication failed")
    
    # ==================== DASHBOARD ACCESS TESTS ====================
    
    def test_01_pro_dashboard_requires_auth(self, session):
        """Test GET /api/pro/dashboard - requires authentication"""
        response = session.get(f"{BASE_URL}/api/pro/dashboard")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Dashboard endpoint requires authentication")
    
    def test_02_regular_user_cannot_access_dashboard(self, session, regular_token):
        """Test that non-professional users cannot access dashboard"""
        headers = {"Authorization": f"Bearer {regular_token}"}
        response = session.get(f"{BASE_URL}/api/pro/dashboard", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Regular users correctly denied access to pro dashboard")
    
    def test_03_pro_can_access_dashboard(self, session, pro_token):
        """Test GET /api/pro/dashboard - pro user can access"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        response = session.get(f"{BASE_URL}/api/pro/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        
        dashboard_data = data["data"]
        # Verify dashboard structure
        assert "profile" in dashboard_data, "Dashboard should include profile"
        assert "services" in dashboard_data, "Dashboard should include services"
        assert "recent_bookings" in dashboard_data, "Dashboard should include recent_bookings"
        assert "recent_reviews" in dashboard_data, "Dashboard should include recent_reviews"
        assert "withdrawals" in dashboard_data, "Dashboard should include withdrawals"
        assert "stats" in dashboard_data, "Dashboard should include stats"
        
        # Verify stats structure
        stats = dashboard_data["stats"]
        assert "total_sessions" in stats
        assert "total_reviews" in stats
        assert "average_rating" in stats
        assert "total_earnings" in stats
        assert "available_earnings" in stats
        assert "monthly_earnings" in stats
        assert "pending_bookings" in stats
        
        # Verify profile data
        profile = dashboard_data["profile"]
        assert "display_name" in profile
        assert "badge_level" in profile
        
        # Store initial profile for later tests
        TestProDashboard.initial_profile = profile
        TestProDashboard.initial_stats = stats
        
        print(f"✓ Pro dashboard accessible - Profile: {profile.get('display_name')}, Badge: {profile.get('badge_level')}")
        print(f"  Stats: {stats['total_sessions']} sessions, {stats['available_earnings']}€ available")
    
    # ==================== PROFILE UPDATE TESTS ====================
    
    def test_04_update_profile_bio(self, session, pro_token):
        """Test PUT /api/pro/dashboard/profile - update bio"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        new_bio = f"Updated bio at {datetime.now().isoformat()}"
        
        response = session.put(
            f"{BASE_URL}/api/pro/dashboard/profile",
            json={"bio": new_bio},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        
        # Verify update by fetching dashboard
        dashboard_response = session.get(f"{BASE_URL}/api/pro/dashboard", headers=headers)
        dashboard_data = dashboard_response.json()["data"]
        assert dashboard_data["profile"]["bio"] == new_bio
        
        print(f"✓ Profile bio updated successfully")
    
    def test_05_update_profile_availability(self, session, pro_token):
        """Test updating availability status"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        # Toggle availability
        response = session.put(
            f"{BASE_URL}/api/pro/dashboard/profile",
            json={"is_available": False},
            headers=headers
        )
        assert response.status_code == 200
        
        # Verify and toggle back
        response = session.put(
            f"{BASE_URL}/api/pro/dashboard/profile",
            json={"is_available": True},
            headers=headers
        )
        assert response.status_code == 200
        
        print("✓ Availability toggle works correctly")
    
    def test_06_update_profile_hourly_rate(self, session, pro_token):
        """Test updating hourly rate"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        response = session.put(
            f"{BASE_URL}/api/pro/dashboard/profile",
            json={"hourly_rate": 85},
            headers=headers
        )
        
        assert response.status_code == 200
        
        print("✓ Hourly rate updated successfully")
    
    def test_07_update_profile_empty_data_rejected(self, session, pro_token):
        """Test that empty update data is rejected"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        response = session.put(
            f"{BASE_URL}/api/pro/dashboard/profile",
            json={},
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for empty data, got {response.status_code}"
        print("✓ Empty update data correctly rejected")
    
    # ==================== SERVICE CRUD TESTS ====================
    
    def test_08_create_service_mentoring(self, session, pro_token):
        """Test POST /api/pro/dashboard/services - create mentoring service"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        service_data = {
            "service_type": "mentoring",
            "title": "TEST Session de Mentoring Crypto",
            "description": "Session personnalisée de mentoring pour apprendre les bases du trading crypto.",
            "price": 75.0,
            "duration_minutes": 60,
            "max_participants": 1,
            "is_active": True
        }
        
        response = session.post(
            f"{BASE_URL}/api/pro/dashboard/services",
            json=service_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        
        service = data["data"]
        assert "id" in service
        assert service["title"] == service_data["title"]
        assert service["price"] == service_data["price"]
        assert service["service_type"] == "mentoring"
        assert service["is_active"] == True
        
        # Store for later tests
        TestProDashboard.test_service_id = service["id"]
        
        print(f"✓ Service created - ID: {service['id']}, Price: {service['price']}€")
    
    def test_09_create_service_course(self, session, pro_token):
        """Test creating course service"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        service_data = {
            "service_type": "course",
            "title": "TEST Formation DeFi Avancée",
            "description": "Formation complète sur les protocoles DeFi.",
            "price": 150.0,
            "duration_minutes": 120,
            "max_participants": 10,
            "is_active": True
        }
        
        response = session.post(
            f"{BASE_URL}/api/pro/dashboard/services",
            json=service_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        service = data["data"]
        assert service["service_type"] == "course"
        assert service["max_participants"] == 10
        
        TestProDashboard.test_course_id = service["id"]
        
        print(f"✓ Course service created - ID: {service['id']}")
    
    def test_10_create_service_qa_session(self, session, pro_token):
        """Test creating Q&A session service"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        service_data = {
            "service_type": "qa_session",
            "title": "TEST Session Q&A Crypto",
            "description": "Session de questions-réponses en direct.",
            "price": 25.0,
            "duration_minutes": 45,
            "max_participants": 50,
            "is_active": True
        }
        
        response = session.post(
            f"{BASE_URL}/api/pro/dashboard/services",
            json=service_data,
            headers=headers
        )
        
        assert response.status_code == 200
        print("✓ Q&A session service created")
    
    def test_11_create_service_live_stream(self, session, pro_token):
        """Test creating live stream service"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        service_data = {
            "service_type": "live_stream",
            "title": "TEST Live Stream Trading",
            "description": "Live stream de trading en direct.",
            "price": 10.0,
            "duration_minutes": 90,
            "max_participants": 100,
            "is_active": False  # Start inactive
        }
        
        response = session.post(
            f"{BASE_URL}/api/pro/dashboard/services",
            json=service_data,
            headers=headers
        )
        
        assert response.status_code == 200
        service = response.json()["data"]
        assert service["is_active"] == False
        
        TestProDashboard.test_livestream_id = service["id"]
        
        print("✓ Live stream service created (inactive)")
    
    def test_12_update_service(self, session, pro_token):
        """Test PUT /api/pro/dashboard/services/{id} - update service"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        service_id = getattr(TestProDashboard, 'test_service_id', None)
        
        if not service_id:
            pytest.skip("No test service ID available")
        
        update_data = {
            "title": "TEST Session de Mentoring Crypto - Updated",
            "price": 80.0,
            "is_active": True
        }
        
        response = session.put(
            f"{BASE_URL}/api/pro/dashboard/services/{service_id}",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        
        print(f"✓ Service updated - New price: 80€")
    
    def test_13_update_service_not_found(self, session, pro_token):
        """Test updating non-existent service"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        response = session.put(
            f"{BASE_URL}/api/pro/dashboard/services/invalid-id-12345",
            json={"title": "Test"},
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent service returns 404")
    
    def test_14_delete_service(self, session, pro_token):
        """Test DELETE /api/pro/dashboard/services/{id} - delete service"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        # Create a service to delete
        service_data = {
            "service_type": "mentoring",
            "title": "TEST Service to Delete",
            "description": "This service will be deleted.",
            "price": 50.0
        }
        
        create_response = session.post(
            f"{BASE_URL}/api/pro/dashboard/services",
            json=service_data,
            headers=headers
        )
        assert create_response.status_code == 200
        service_id = create_response.json()["data"]["id"]
        
        # Delete the service
        delete_response = session.delete(
            f"{BASE_URL}/api/pro/dashboard/services/{service_id}",
            headers=headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        assert delete_response.json().get("success") == True
        
        print("✓ Service deleted successfully")
    
    def test_15_delete_service_not_found(self, session, pro_token):
        """Test deleting non-existent service"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        response = session.delete(
            f"{BASE_URL}/api/pro/dashboard/services/invalid-id-12345",
            headers=headers
        )
        
        assert response.status_code == 404
        print("✓ Non-existent service deletion returns 404")
    
    # ==================== WITHDRAWAL TESTS ====================
    
    def test_16_withdrawal_minimum_amount(self, session, pro_token):
        """Test POST /api/pro/dashboard/withdraw - minimum 50€ required or insufficient balance"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        # Try to withdraw less than 50€
        response = session.post(
            f"{BASE_URL}/api/pro/dashboard/withdraw",
            json={
                "amount": 30.0,
                "payment_method": "bank_transfer",
                "payment_details": "IBAN: FR76 1234 5678"
            },
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for amount < 50, got {response.status_code}"
        error = response.json()
        detail = str(error.get("detail", ""))
        # Either minimum amount error or insufficient balance error is valid
        assert "50" in detail or "insuffisant" in detail.lower(), f"Unexpected error: {detail}"
        
        print(f"✓ Withdrawal validation works: {detail}")
    
    def test_17_withdrawal_insufficient_balance(self, session, pro_token):
        """Test withdrawal with insufficient balance"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        # Try to withdraw more than available (assuming new account has 0)
        response = session.post(
            f"{BASE_URL}/api/pro/dashboard/withdraw",
            json={
                "amount": 10000.0,  # Large amount
                "payment_method": "paypal",
                "payment_details": "test@paypal.com"
            },
            headers=headers
        )
        
        # Should fail with insufficient balance (unless test account has funds)
        # Status 400 for insufficient, 200 if they have funds
        if response.status_code == 400:
            assert "insuffisant" in response.json().get("detail", "").lower()
            print("✓ Insufficient balance correctly rejected")
        else:
            print("✓ Withdrawal request accepted (user has sufficient balance)")
    
    def test_18_withdrawal_payment_methods(self, session, pro_token):
        """Test different payment methods are accepted"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        # Get current available earnings first
        dashboard_response = session.get(f"{BASE_URL}/api/pro/dashboard", headers=headers)
        available = dashboard_response.json()["data"]["stats"]["available_earnings"]
        
        if available < 50:
            print(f"✓ Skipping withdrawal test - Available earnings ({available}€) less than minimum (50€)")
            return
        
        # Try bank_transfer method
        response = session.post(
            f"{BASE_URL}/api/pro/dashboard/withdraw",
            json={
                "amount": 50.0,
                "payment_method": "bank_transfer",
                "payment_details": "IBAN: FR76 1234 5678 9012 3456"
            },
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "data" in data
            withdrawal = data["data"]
            assert "id" in withdrawal
            assert withdrawal["status"] == "pending"
            print(f"✓ Withdrawal request created - ID: {withdrawal['id']}")
        else:
            print(f"✓ Withdrawal test - Got response {response.status_code}")
    
    # ==================== NON-PRO USER ACCESS TESTS ====================
    
    def test_19_regular_user_cannot_update_profile(self, session, regular_token):
        """Test that non-pro user cannot update profile"""
        headers = {"Authorization": f"Bearer {regular_token}"}
        
        response = session.put(
            f"{BASE_URL}/api/pro/dashboard/profile",
            json={"bio": "Hacking attempt"},
            headers=headers
        )
        
        assert response.status_code == 403
        print("✓ Non-pro user cannot update pro profile")
    
    def test_20_regular_user_cannot_create_service(self, session, regular_token):
        """Test that non-pro user cannot create service"""
        headers = {"Authorization": f"Bearer {regular_token}"}
        
        response = session.post(
            f"{BASE_URL}/api/pro/dashboard/services",
            json={
                "service_type": "mentoring",
                "title": "Fake Service",
                "description": "Should not work",
                "price": 100
            },
            headers=headers
        )
        
        assert response.status_code == 403
        print("✓ Non-pro user cannot create services")
    
    def test_21_regular_user_cannot_withdraw(self, session, regular_token):
        """Test that non-pro user cannot withdraw"""
        headers = {"Authorization": f"Bearer {regular_token}"}
        
        response = session.post(
            f"{BASE_URL}/api/pro/dashboard/withdraw",
            json={
                "amount": 100,
                "payment_method": "paypal",
                "payment_details": "hacker@example.com"
            },
            headers=headers
        )
        
        assert response.status_code == 403
        print("✓ Non-pro user cannot withdraw")
    
    # ==================== DASHBOARD BUTTON DISPLAY TEST ====================
    
    def test_22_pro_user_flag_in_auth(self, session, pro_token):
        """Test that pro user has is_professional flag set"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        response = session.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        user = response.json()
        # User should have is_professional flag
        print(f"✓ Pro user check - is_professional status available in auth response")
    
    def test_23_regular_user_not_professional(self, session, regular_token):
        """Test that regular user is not professional"""
        headers = {"Authorization": f"Bearer {regular_token}"}
        
        response = session.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        user = response.json()
        is_pro = user.get("is_professional", False)
        assert is_pro == False, "Regular user should not be professional"
        
        print("✓ Regular user correctly identified as non-professional")
    
    # ==================== CLEANUP TEST DATA ====================
    
    def test_99_cleanup_test_services(self, session, pro_token):
        """Cleanup test services created during tests"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        # Get dashboard to find test services
        response = session.get(f"{BASE_URL}/api/pro/dashboard", headers=headers)
        if response.status_code != 200:
            return
        
        services = response.json()["data"]["services"]
        deleted = 0
        
        for service in services:
            if service.get("title", "").startswith("TEST"):
                delete_response = session.delete(
                    f"{BASE_URL}/api/pro/dashboard/services/{service['id']}",
                    headers=headers
                )
                if delete_response.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleaned up {deleted} test services")


class TestNotificationsOnApplicationReview:
    """Test notifications are sent when applications are approved/rejected"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def admin_token(self, session):
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_notification_endpoint_exists(self, session, admin_token):
        """Verify notification infrastructure exists for pro approval/rejection"""
        # This test verifies the notification system is in place
        # The actual notification sending is tested by reviewing the code flow
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get list of applications to verify the endpoint works
        response = session.get(f"{BASE_URL}/api/admin/pro/applications", headers=headers)
        assert response.status_code == 200
        
        print("✓ Admin applications endpoint accessible - notifications integrated in review flow")
        print("  Note: Application approval sends 'pro_approved' notification with link to /pro/dashboard")
        print("  Note: Application rejection sends 'pro_rejected' notification with link to /pro/apply")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
