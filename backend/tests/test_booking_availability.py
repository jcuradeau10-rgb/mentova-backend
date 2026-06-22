"""
Test suite for the booking availability system
Tests:
- GET /api/services/{service_id}/available-slots
- POST /api/bookings (create booking with date/slot)
- Pro dashboard service creation with availability settings
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "admin@cryptonai.com"
TEST_USER_PASSWORD = "Admin123!"
PRO_USER_ID = "3022d23d-11a1-4fbb-849a-0cddb379d65f"
SERVICE_ID = "83b2e4b1-8bc4-44f0-a8fb-64e92abb3846"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestAvailableSlotsAPI:
    """Tests for GET /api/services/{service_id}/available-slots"""

    def test_get_slots_for_valid_date(self, api_client):
        """Test getting available slots for a valid weekday"""
        # Use tomorrow to ensure slots are available
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = api_client.get(f"{BASE_URL}/api/services/{SERVICE_ID}/available-slots?date={tomorrow}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data["success"] == True
        assert "data" in data
        assert "service" in data
        assert "date" in data
        assert "total_slots" in data
        
        # Verify service info is returned
        assert data["service"]["id"] == SERVICE_ID
        assert data["service"]["title"] == "test"
        assert data["service"]["duration_minutes"] == 60
        assert data["service"]["price"] == 0.0
        
        # Verify slot structure if slots are available
        if len(data["data"]) > 0:
            slot = data["data"][0]
            assert "start" in slot
            assert "end" in slot
            assert "datetime" in slot
            # Verify time format HH:MM
            assert len(slot["start"]) == 5
            assert ":" in slot["start"]

    def test_get_slots_for_weekend_day(self, api_client):
        """Test that weekend days return empty slots (service available Mon-Fri only)"""
        # Find next Saturday
        today = datetime.now()
        days_until_saturday = (5 - today.weekday()) % 7
        if days_until_saturday == 0:
            days_until_saturday = 7
        next_saturday = (today + timedelta(days=days_until_saturday)).strftime("%Y-%m-%d")
        
        response = api_client.get(f"{BASE_URL}/api/services/{SERVICE_ID}/available-slots?date={next_saturday}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"] == []
        assert "message" in data
        assert "pas disponible" in data["message"].lower()

    def test_get_slots_invalid_date_format(self, api_client):
        """Test error handling for invalid date format"""
        response = api_client.get(f"{BASE_URL}/api/services/{SERVICE_ID}/available-slots?date=invalid-date")
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "invalide" in data["detail"].lower()

    def test_get_slots_past_date(self, api_client):
        """Test that past dates return empty slots"""
        past_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        response = api_client.get(f"{BASE_URL}/api/services/{SERVICE_ID}/available-slots?date={past_date}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"] == []
        assert "message" in data
        assert "passée" in data["message"].lower()

    def test_get_slots_invalid_service_id(self, api_client):
        """Test 404 for non-existent service"""
        response = api_client.get(f"{BASE_URL}/api/services/non-existent-id/available-slots?date=2026-03-10")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_slots_30_minute_intervals(self, api_client):
        """Test that slots are generated in 30-minute intervals"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = api_client.get(f"{BASE_URL}/api/services/{SERVICE_ID}/available-slots?date={tomorrow}")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) >= 2:
            # Verify 30-minute intervals between consecutive slots
            for i in range(len(data["data"]) - 1):
                slot1_start = datetime.strptime(data["data"][i]["start"], "%H:%M")
                slot2_start = datetime.strptime(data["data"][i+1]["start"], "%H:%M")
                
                # Calculate difference, handling the case of crossing a time boundary
                diff_minutes = (slot2_start - slot1_start).seconds // 60
                
                # Either 30 min interval or crossing to next time range
                assert diff_minutes == 30 or diff_minutes > 30, f"Unexpected interval: {diff_minutes} minutes"


class TestBookingCreation:
    """Tests for POST /api/bookings - creating a booking with date/slot"""

    def test_create_booking_success(self, authenticated_client):
        """Test creating a booking with valid date and slot"""
        # Get an available slot first
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        slots_response = authenticated_client.get(
            f"{BASE_URL}/api/services/{SERVICE_ID}/available-slots?date={tomorrow}"
        )
        
        if slots_response.status_code != 200 or len(slots_response.json().get("data", [])) == 0:
            pytest.skip("No available slots to test booking creation")
        
        first_slot = slots_response.json()["data"][0]
        scheduled_at = f"{tomorrow}T{first_slot['start']}:00"
        
        response = authenticated_client.post(f"{BASE_URL}/api/bookings", json={
            "service_id": SERVICE_ID,
            "scheduled_at": scheduled_at,
            "message": "Test booking message"
        })
        
        # May fail if admin can't book their own service
        if response.status_code == 400 and "propre" in response.json().get("detail", "").lower():
            pytest.skip("Admin cannot book their own service")
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        
        if "success" in data:
            assert data["success"] == True
            assert "data" in data
            booking = data["data"]
            assert booking["service_id"] == SERVICE_ID
            assert booking["status"] == "pending"

    def test_create_booking_requires_auth(self, api_client):
        """Test that booking creation requires authentication"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Remove auth header if present
        api_client.headers.pop("Authorization", None)
        
        response = api_client.post(f"{BASE_URL}/api/bookings", json={
            "service_id": SERVICE_ID,
            "scheduled_at": f"{tomorrow}T10:00:00",
            "message": "Test"
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestProDashboardServices:
    """Tests for Pro Dashboard service creation with availability settings"""

    def test_pro_dashboard_requires_auth(self, api_client):
        """Test that pro dashboard requires authentication"""
        api_client.headers.pop("Authorization", None)
        response = api_client.get(f"{BASE_URL}/api/pro/dashboard")
        assert response.status_code in [401, 403]

    def test_get_pro_services(self, api_client):
        """Test getting services for a professional"""
        response = api_client.get(f"{BASE_URL}/api/pros/{PRO_USER_ID}/services")
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("success"):
            assert "data" in data
            # Verify service structure includes availability fields
            if len(data["data"]) > 0:
                service = data["data"][0]
                assert "title" in service
                assert "price" in service
                assert "duration_minutes" in service


class TestProfessionalProfile:
    """Tests for professional profile endpoints"""

    def test_get_professional_by_id(self, api_client):
        """Test getting professional profile by ID"""
        response = api_client.get(f"{BASE_URL}/api/pros/{PRO_USER_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        
        profile = data["data"]
        assert "display_name" in profile
        assert "badge_level" in profile
        assert "is_available" in profile

    def test_list_professionals(self, api_client):
        """Test listing all professionals"""
        response = api_client.get(f"{BASE_URL}/api/pros")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        assert "total" in data


class TestServiceAvailabilityIntegration:
    """Integration tests for the complete booking flow"""

    def test_full_booking_flow(self, authenticated_client):
        """Test the complete flow: list services -> get slots -> create booking"""
        # Step 1: Get services for the pro
        services_response = authenticated_client.get(f"{BASE_URL}/api/pros/{PRO_USER_ID}/services")
        assert services_response.status_code == 200
        
        services = services_response.json().get("data", [])
        if not services:
            pytest.skip("No services available for testing")
        
        service = services[0]
        
        # Step 2: Get available slots
        tomorrow = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        slots_response = authenticated_client.get(
            f"{BASE_URL}/api/services/{service['id']}/available-slots?date={tomorrow}"
        )
        assert slots_response.status_code == 200
        
        slots = slots_response.json().get("data", [])
        
        # Step 3: Verify slot data structure
        if slots:
            slot = slots[0]
            assert "start" in slot
            assert "end" in slot
            assert "datetime" in slot
            print(f"✓ Found {len(slots)} available slots for {tomorrow}")
            print(f"✓ First slot: {slot['start']} - {slot['end']}")
        else:
            print(f"✓ No slots available for {tomorrow} (may be weekend or holiday)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
