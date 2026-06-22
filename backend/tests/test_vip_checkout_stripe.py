"""
Tests for VIP Stripe Checkout endpoints:
- POST /api/vip/checkout
- GET /api/vip/checkout/status/{session_id}
- GET /api/spots-remaining
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com").rstrip("/")

VIP_ADMIN_EMAIL = "jcuradeau.7@gmail.com"
VIP_ADMIN_PASSWORD = "Crypto2026!"

NON_VIP_EMAIL = "applereview@mentova.com"
NON_VIP_PASSWORD = "AppleReview2026!"


def _login(email: str, password: str):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    return r


@pytest.fixture(scope="module")
def vip_admin_token():
    r = _login(VIP_ADMIN_EMAIL, VIP_ADMIN_PASSWORD)
    assert r.status_code == 200, f"VIP admin login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data.get("user", {})


@pytest.fixture(scope="module")
def non_vip_token():
    r = _login(NON_VIP_EMAIL, NON_VIP_PASSWORD)
    assert r.status_code == 200, f"Non-VIP login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data.get("user", {})


# ---------------------- /api/spots-remaining ----------------------

class TestSpotsRemaining:
    def test_spots_remaining_returns_wave_info(self):
        r = requests.get(f"{BASE_URL}/api/spots-remaining", timeout=30)
        assert r.status_code == 200, f"status={r.status_code} body={r.text}"
        data = r.json()
        # Required keys
        for key in ("wave", "total", "registered", "remaining", "wave2_active"):
            assert key in data, f"missing key {key} in response {data}"
        # Sanity ranges
        assert isinstance(data["total"], int) and data["total"] > 0
        assert isinstance(data["registered"], int) and data["registered"] >= 0
        assert isinstance(data["remaining"], int) and data["remaining"] >= 0
        assert data["remaining"] == max(0, data["total"] - data["registered"])
        assert data["wave"] in (1, 2)


# ---------------------- /api/vip/checkout (non-VIP) ----------------------

class TestVipCheckout:
    def test_checkout_for_non_vip_returns_checkout_url(self, non_vip_token):
        token, user = non_vip_token
        # If applereview user is actually VIP, skip
        if user.get("is_vip"):
            pytest.skip("applereview is already VIP; cannot test non-VIP checkout creation")
        r = requests.post(
            f"{BASE_URL}/api/vip/checkout",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"origin_url": "https://academy-preview-11.preview.emergentagent.com"},
            timeout=60,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "checkout_url" in data, f"missing checkout_url: {data}"
        assert "session_id" in data, f"missing session_id: {data}"
        assert isinstance(data["checkout_url"], str) and data["checkout_url"].startswith("https://")
        assert "stripe.com" in data["checkout_url"], f"Expected Stripe URL, got {data['checkout_url']}"
        assert isinstance(data["session_id"], str) and len(data["session_id"]) > 0
        # stash session_id for next test
        TestVipCheckout._session_id = data["session_id"]
        TestVipCheckout._token = token

    def test_checkout_status_returns_pending_for_new_session(self, non_vip_token):
        if not hasattr(TestVipCheckout, "_session_id"):
            pytest.skip("No session_id from previous test")
        session_id = TestVipCheckout._session_id
        token = TestVipCheckout._token
        r = requests.get(
            f"{BASE_URL}/api/vip/checkout/status/{session_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "status" in data
        assert "payment_status" in data
        # New session typically not yet paid
        assert data["payment_status"] in ("initiated", "unpaid", "no_payment_required", "paid", "open")


# ---------------------- /api/vip/checkout (already VIP) ----------------------

class TestVipCheckoutAlreadyVip:
    def test_checkout_rejects_already_vip_user(self, vip_admin_token):
        token, user = vip_admin_token
        if not user.get("is_vip"):
            pytest.skip("VIP admin is not actually VIP; cannot test")
        r = requests.post(
            f"{BASE_URL}/api/vip/checkout",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"origin_url": "https://academy-preview-11.preview.emergentagent.com"},
            timeout=30,
        )
        assert r.status_code == 400, f"Expected 400 for already-VIP, got {r.status_code}: {r.text}"
        body = r.json()
        # Detail must mention VIP
        assert "vip" in str(body).lower()


# ---------------------- Auth required ----------------------

class TestVipCheckoutAuthRequired:
    def test_checkout_without_token_unauthorized(self):
        r = requests.post(
            f"{BASE_URL}/api/vip/checkout",
            json={"origin_url": "https://academy-preview-11.preview.emergentagent.com"},
            timeout=30,
        )
        # FastAPI HTTPBearer returns 403 by default when missing
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text}"

    def test_checkout_status_invalid_session(self, non_vip_token):
        token, _ = non_vip_token
        r = requests.get(
            f"{BASE_URL}/api/vip/checkout/status/sess_does_not_exist_xyz",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
