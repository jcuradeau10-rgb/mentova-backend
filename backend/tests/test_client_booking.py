"""
Client Booking Flow Tests - Phase 3
Tests for:
- GET /api/pros/{pro_id}/services - Get professional's services (public)
- POST /api/bookings - Create a booking (requires auth)
- GET /api/bookings/my - Get user's bookings
- GET /api/bookings/{id} - Get booking details  
- PUT /api/bookings/{id}/cancel - Cancel a booking
- POST /api/bookings/{id}/review - Submit review for completed booking
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
CLIENT_EMAIL = "client_test@cryptonai.com"
CLIENT_PASSWORD = "Client123!"
PRO_EMAIL = "pro_test@cryptonai.com"
PRO_PASSWORD = "ProTest123!"

# Known IDs from previous phases
EXISTING_PRO_ID = "e5e3431b-522e-4443-b32b-3080ff79aab6"
EXISTING_SERVICE_ID = "556ea949-6dae-4eda-b349-f31edff97b58"

# Commission rate (25%)
COMMISSION_RATE = 0.25

class TestGetProfessionalServices:
    """Test GET /api/pros/{pro_id}/services - Public endpoint"""
    
    def test_01_get_pro_services_success(self):
        """Can get professional's services without authentication"""
        response = requests.get(f"{BASE_URL}/api/pros/{EXISTING_PRO_ID}/services")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "professional" in data
        
        # Verify service structure
        services = data["data"]
        assert isinstance(services, list)
        
        if len(services) > 0:
            service = services[0]
            assert "id" in service
            assert "title" in service
            assert "price" in service
            assert "service_type" in service
            print(f"Found {len(services)} services for professional")
    
    def test_02_get_pro_services_includes_professional_info(self):
        """Response includes professional profile data"""
        response = requests.get(f"{BASE_URL}/api/pros/{EXISTING_PRO_ID}/services")
        assert response.status_code == 200
        
        data = response.json()
        professional = data["professional"]
        
        assert "display_name" in professional
        assert "badge_level" in professional
        assert "is_available" in professional
        print(f"Professional: {professional['display_name']}, Badge: {professional['badge_level']}")
    
    def test_03_get_pro_services_nonexistent_pro(self):
        """Returns 404 for non-existent professional"""
        response = requests.get(f"{BASE_URL}/api/pros/nonexistent-pro-id-123/services")
        assert response.status_code == 404


class TestCreateBooking:
    """Test POST /api/bookings - Requires auth"""
    
    @pytest.fixture
    def client_token(self):
        """Get client authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Client login failed")
    
    @pytest.fixture
    def pro_token(self):
        """Get professional authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_EMAIL,
            "password": PRO_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Pro login failed")
    
    def test_04_create_booking_requires_auth(self):
        """Creating booking without auth returns 401/403"""
        future_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        response = requests.post(f"{BASE_URL}/api/bookings", json={
            "service_id": EXISTING_SERVICE_ID,
            "scheduled_at": future_date
        })
        assert response.status_code in [401, 403]
    
    def test_05_create_booking_success(self, client_token):
        """Client can create a booking for a service"""
        future_date = (datetime.utcnow() + timedelta(days=10)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {client_token}"},
            json={
                "service_id": EXISTING_SERVICE_ID,
                "scheduled_at": future_date,
                "message": "TEST_booking_message"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        # Verify booking structure
        booking = data["data"]
        assert "id" in booking
        assert booking["service_id"] == EXISTING_SERVICE_ID
        assert booking["status"] == "pending"
        assert booking["payment_status"] == "unpaid"
        
        # Verify commission calculation (25%)
        total_amount = booking["total_amount"]
        commission = booking["commission_amount"]
        pro_earnings = booking["pro_earnings"]
        
        expected_commission = total_amount * COMMISSION_RATE
        assert abs(commission - expected_commission) < 0.01, f"Commission should be 25%: {commission} vs {expected_commission}"
        assert abs(pro_earnings - (total_amount - expected_commission)) < 0.01, f"Pro earnings incorrect"
        
        print(f"Created booking: {booking['id']}")
        print(f"Total: {total_amount}€, Commission: {commission}€ (25%), Pro earns: {pro_earnings}€")
        
        # Store booking ID for later tests
        pytest.booking_id_for_cancel = booking["id"]
    
    def test_06_create_booking_past_date_rejected(self, client_token):
        """Cannot create booking for past date"""
        past_date = (datetime.utcnow() - timedelta(days=1)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {client_token}"},
            json={
                "service_id": EXISTING_SERVICE_ID,
                "scheduled_at": past_date
            }
        )
        
        assert response.status_code == 400
        assert "futur" in response.json().get("detail", "").lower()
    
    def test_07_create_booking_nonexistent_service(self, client_token):
        """Cannot book non-existent service"""
        future_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {client_token}"},
            json={
                "service_id": "nonexistent-service-id",
                "scheduled_at": future_date
            }
        )
        
        assert response.status_code == 404
    
    def test_08_cannot_book_own_service(self, pro_token):
        """Professional cannot book their own service"""
        future_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {pro_token}"},
            json={
                "service_id": EXISTING_SERVICE_ID,
                "scheduled_at": future_date
            }
        )
        
        assert response.status_code == 400
        assert "propre" in response.json().get("detail", "").lower()


class TestGetMyBookings:
    """Test GET /api/bookings/my - Requires auth"""
    
    @pytest.fixture
    def client_token(self):
        """Get client authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Client login failed")
    
    def test_09_get_my_bookings_requires_auth(self):
        """Getting bookings requires authentication"""
        response = requests.get(f"{BASE_URL}/api/bookings/my")
        assert response.status_code in [401, 403]
    
    def test_10_get_my_bookings_success(self, client_token):
        """Client can get their bookings"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/my",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "total" in data
        
        bookings = data["data"]
        assert isinstance(bookings, list)
        
        if len(bookings) > 0:
            booking = bookings[0]
            assert "id" in booking
            assert "pro_name" in booking
            assert "service_title" in booking
            assert "status" in booking
            assert "total_amount" in booking
        
        print(f"Client has {data['total']} total bookings")
    
    def test_11_get_my_bookings_filter_by_status(self, client_token):
        """Can filter bookings by status"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/my",
            headers={"Authorization": f"Bearer {client_token}"},
            params={"status": "pending"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned bookings should be pending
        for booking in data["data"]:
            assert booking["status"] == "pending"


class TestGetBookingDetail:
    """Test GET /api/bookings/{id} - Requires auth"""
    
    @pytest.fixture
    def client_token(self):
        """Get client authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Client login failed")
    
    @pytest.fixture
    def existing_booking_id(self, client_token):
        """Get an existing booking ID"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/my",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        if response.status_code == 200 and response.json()["data"]:
            return response.json()["data"][0]["id"]
        pytest.skip("No existing bookings found")
    
    def test_12_get_booking_detail_requires_auth(self):
        """Getting booking detail requires authentication"""
        response = requests.get(f"{BASE_URL}/api/bookings/some-booking-id")
        assert response.status_code in [401, 403]
    
    def test_13_get_booking_detail_success(self, client_token, existing_booking_id):
        """Can get booking detail by ID"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/{existing_booking_id}",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        booking = data["data"]
        assert booking["id"] == existing_booking_id
        assert "client_name" in booking
        assert "pro_name" in booking
        assert "service_title" in booking
        assert "scheduled_at" in booking
        assert "total_amount" in booking
        assert "commission_amount" in booking
        assert "pro_earnings" in booking
    
    def test_14_get_booking_detail_not_found(self, client_token):
        """Returns 404 for non-existent booking"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/nonexistent-booking-id",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 404


class TestCancelBooking:
    """Test PUT /api/bookings/{id}/cancel - Requires auth"""
    
    @pytest.fixture
    def client_token(self):
        """Get client authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Client login failed")
    
    @pytest.fixture
    def booking_to_cancel(self, client_token):
        """Create a new booking to cancel"""
        future_date = (datetime.utcnow() + timedelta(days=14)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {client_token}"},
            json={
                "service_id": EXISTING_SERVICE_ID,
                "scheduled_at": future_date,
                "message": "TEST_booking_to_cancel"
            }
        )
        if response.status_code == 200:
            return response.json()["data"]["id"]
        pytest.skip("Could not create booking to cancel")
    
    def test_15_cancel_booking_requires_auth(self):
        """Cancelling booking requires authentication"""
        response = requests.put(f"{BASE_URL}/api/bookings/some-id/cancel")
        assert response.status_code in [401, 403]
    
    def test_16_cancel_booking_success(self, client_token, booking_to_cancel):
        """Client can cancel their pending booking"""
        response = requests.put(
            f"{BASE_URL}/api/bookings/{booking_to_cancel}/cancel",
            headers={"Authorization": f"Bearer {client_token}"},
            params={"reason": "TEST_cancel_reason"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "refund_eligible" in data
        
        # Booking scheduled >24h ahead should be refund eligible
        assert data["refund_eligible"] == True
        print(f"Cancelled booking {booking_to_cancel}, refund eligible: {data['refund_eligible']}")
    
    def test_17_cancel_booking_not_found(self, client_token):
        """Returns 404 for non-existent booking"""
        response = requests.put(
            f"{BASE_URL}/api/bookings/nonexistent-booking-id/cancel",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 404


class TestSubmitReview:
    """Test POST /api/bookings/{id}/review - Requires auth, completed booking"""
    
    @pytest.fixture
    def client_token(self):
        """Get client authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Client login failed")
    
    def test_18_submit_review_requires_auth(self):
        """Submitting review requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/bookings/some-id/review",
            params={"rating": 5}
        )
        assert response.status_code in [401, 403]
    
    def test_19_submit_review_not_found(self, client_token):
        """Returns 404 for non-existent booking"""
        response = requests.post(
            f"{BASE_URL}/api/bookings/nonexistent-booking-id/review",
            headers={"Authorization": f"Bearer {client_token}"},
            params={"rating": 5, "comment": "Great!"}
        )
        assert response.status_code == 404
    
    def test_20_submit_review_invalid_rating(self, client_token):
        """Rating must be between 1 and 5"""
        # Get an existing booking
        response = requests.get(
            f"{BASE_URL}/api/bookings/my",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        if response.status_code != 200 or not response.json()["data"]:
            pytest.skip("No bookings to test")
        
        booking_id = response.json()["data"][0]["id"]
        
        # Try invalid rating
        response = requests.post(
            f"{BASE_URL}/api/bookings/{booking_id}/review",
            headers={"Authorization": f"Bearer {client_token}"},
            params={"rating": 6}
        )
        assert response.status_code == 400
    
    def test_21_submit_review_pending_booking_rejected(self, client_token):
        """Cannot review a pending booking"""
        # Get a pending booking
        response = requests.get(
            f"{BASE_URL}/api/bookings/my",
            headers={"Authorization": f"Bearer {client_token}"},
            params={"status": "pending"}
        )
        if response.status_code != 200 or not response.json()["data"]:
            pytest.skip("No pending bookings to test")
        
        booking_id = response.json()["data"][0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/bookings/{booking_id}/review",
            headers={"Authorization": f"Bearer {client_token}"},
            params={"rating": 5, "comment": "Test review"}
        )
        
        # Should reject because booking is not completed
        assert response.status_code == 400
        assert "terminée" in response.json().get("detail", "").lower()


class TestCommissionCalculation:
    """Test commission calculation (25% platform fee)"""
    
    @pytest.fixture
    def client_token(self):
        """Get client authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Client login failed")
    
    def test_22_commission_25_percent(self, client_token):
        """Commission should be exactly 25%"""
        # Get existing bookings
        response = requests.get(
            f"{BASE_URL}/api/bookings/my",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        
        assert response.status_code == 200
        bookings = response.json()["data"]
        
        for booking in bookings[:3]:  # Check first 3 bookings
            total = booking["total_amount"]
            commission = booking["commission_amount"]
            pro_earnings = booking["pro_earnings"]
            
            expected_commission = total * 0.25
            expected_earnings = total - expected_commission
            
            assert abs(commission - expected_commission) < 0.01, \
                f"Commission mismatch: {commission} vs {expected_commission}"
            assert abs(pro_earnings - expected_earnings) < 0.01, \
                f"Earnings mismatch: {pro_earnings} vs {expected_earnings}"
            
            print(f"Booking {booking['id'][:8]}...: Total {total}€, Commission {commission}€, Pro {pro_earnings}€")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def client_token(self):
        """Get client authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Client login failed")
    
    def test_99_cleanup_test_bookings(self, client_token):
        """Cancel any TEST_ prefixed bookings"""
        response = requests.get(
            f"{BASE_URL}/api/bookings/my",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        
        if response.status_code == 200:
            bookings = response.json()["data"]
            cancelled = 0
            for booking in bookings:
                if booking.get("client_message", "").startswith("TEST_"):
                    if booking["status"] in ["pending", "confirmed"]:
                        cancel_resp = requests.put(
                            f"{BASE_URL}/api/bookings/{booking['id']}/cancel",
                            headers={"Authorization": f"Bearer {client_token}"},
                            params={"reason": "Test cleanup"}
                        )
                        if cancel_resp.status_code == 200:
                            cancelled += 1
            
            print(f"Cleaned up {cancelled} test bookings")
        
        assert True  # Always pass cleanup
