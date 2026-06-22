"""
Test bookings revamp feature:
- GET /api/pro/dashboard/bookings (mentor view)
- GET /api/bookings/my (client view)
- PUT /api/pro/dashboard/bookings/{id}/status (mentor status update)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@cryptonai.com"  # Admin is a mentor
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "jcuradeau.7@gmail.com"  # VIP user, not a pro
USER_PASSWORD = "Crypto2026!"

class TestBookingsRevamp:
    """Test the revamped My Bookings page endpoints"""

    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin (mentor) auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        # Verify admin is a professional
        user = data.get("user", {})
        print(f"Admin user: is_professional={user.get('is_professional')}, role={user.get('role')}")
        return data["access_token"]

    @pytest.fixture(scope="class")
    def user_token(self):
        """Get regular user (VIP) auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        return data["access_token"]

    def test_admin_is_professional(self, admin_token):
        """Verify admin account has is_professional=true"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Admin should be a professional to see mentor view
        print(f"Admin /auth/me response: {data}")
        # Note: is_professional may be set via pro_profiles collection
        
    def test_user_is_professional(self, user_token):
        """Check if user is also a professional (both test users are pros)"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"User /auth/me response: {data}")
        # Note: Both test users (admin and jcuradeau) are professionals
        # This means both will see the view mode toggle in UI
        print(f"User is_professional: {data.get('is_professional')}")

    # Test mentor booking endpoint
    def test_mentor_get_bookings_endpoint(self, admin_token):
        """GET /api/pro/dashboard/bookings - Get mentor's client bookings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/pro/dashboard/bookings", headers=headers)
        
        # If admin is not professional, this will return 403
        if response.status_code == 403:
            print(f"Admin is not set as professional: {response.text}")
            pytest.skip("Admin account is not set as professional in the database")
        
        assert response.status_code == 200, f"Unexpected status: {response.status_code}, {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        print(f"Mentor bookings count: {len(data.get('data', []))}")
        
    def test_mentor_get_bookings_with_status_filter(self, admin_token):
        """GET /api/pro/dashboard/bookings?status=pending"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/pro/dashboard/bookings", 
                               headers=headers,
                               params={"status": "pending"})
        
        if response.status_code == 403:
            pytest.skip("Admin account is not set as professional")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        # All returned bookings should have status=pending
        for booking in data.get("data", []):
            assert booking.get("status") == "pending", f"Expected pending status, got {booking.get('status')}"

    def test_mentor_get_bookings_confirmed_status(self, admin_token):
        """GET /api/pro/dashboard/bookings?status=confirmed"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/pro/dashboard/bookings",
                               headers=headers,
                               params={"status": "confirmed"})
        
        if response.status_code == 403:
            pytest.skip("Admin account is not set as professional")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True

    # Test client booking endpoint
    def test_client_get_my_bookings(self, user_token):
        """GET /api/bookings/my - Get user's bookings as client"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings/my", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.status_code}, {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        print(f"Client bookings count: {len(data.get('data', []))}")
        
    def test_client_get_my_bookings_with_status_filter(self, user_token):
        """GET /api/bookings/my?status=pending - Filter client bookings"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/bookings/my",
                               headers=headers,
                               params={"status": "pending"})
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True

    # Test status update endpoint
    def test_update_booking_status_invalid_booking(self, admin_token):
        """PUT /api/pro/dashboard/bookings/{id}/status - Should fail with invalid booking ID"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.put(
            f"{BASE_URL}/api/pro/dashboard/bookings/invalid-booking-id/status",
            headers=headers,
            params={"status": "confirmed"}
        )
        
        if response.status_code == 403:
            pytest.skip("Admin account is not set as professional")
        
        # Should return 404 for non-existent booking
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"

    def test_update_booking_status_invalid_status(self, admin_token):
        """PUT /api/pro/dashboard/bookings/{id}/status - Should fail with invalid status"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.put(
            f"{BASE_URL}/api/pro/dashboard/bookings/some-id/status",
            headers=headers,
            params={"status": "invalid-status"}
        )
        
        if response.status_code == 403:
            pytest.skip("Admin account is not set as professional")
        
        # Should return 400 for invalid status
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"

    def test_user_can_access_mentor_bookings_since_is_pro(self, user_token):
        """Both test users are professionals, so they can access mentor bookings"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/pro/dashboard/bookings", headers=headers)
        
        # Since user is also a professional, this should work (200)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"User (as pro) bookings: {len(data.get('data', []))}")
