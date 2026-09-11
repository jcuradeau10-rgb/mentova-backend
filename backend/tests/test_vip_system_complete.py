"""VIP system + Atlas protection + admin analytics tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "jcuradeau.7@gmail.com"
ADMIN_PASSWORD = "Crypto2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def free_user_token():
    # Register a fresh free user
    email = f"TEST_free_{int(time.time())}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email,
        "password": "TestPass123!",
        "name": "Free Test User"
    })
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    return r.json()["access_token"], email


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ============ VIP Permissions ============
class TestVipPermissions:
    def test_vip_permissions_for_vip_user(self, admin_token):
        r = requests.get(f"{API}/vip/permissions", headers=auth(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["is_vip"] is True
        assert data["plan"] == "vip"
        assert data["atlas_premium"] is True
        assert data["atlas_memory"] is True
        assert data["daily_briefing"] is True
        assert data["chart_analysis"] is True
        assert data["real_time_crypto_in_atlas"] is True
        assert data["real_time_news_in_atlas"] is True
        assert data["professional_tools"] is True
        assert data["premium_learning"] is True

    def test_vip_permissions_for_free_user(self, free_user_token):
        token, _ = free_user_token
        r = requests.get(f"{API}/vip/permissions", headers=auth(token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["is_vip"] is False
        assert data["plan"] == "free"
        assert data["atlas_premium"] is False
        assert data["atlas_memory"] is False
        assert data["daily_briefing"] is False
        assert data["chart_analysis"] is False
        assert data["real_time_crypto_in_atlas"] is False
        assert data["real_time_news_in_atlas"] is False
        assert data["professional_tools"] is False
        assert data["premium_learning"] is False


# ============ VIP Checkout ============
class TestVipCheckout:
    def test_checkout_creates_session_for_free_user(self, free_user_token):
        token, _ = free_user_token
        r = requests.post(f"{API}/vip/checkout",
                          headers=auth(token),
                          json={"origin_url": BASE_URL})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "checkout_url" in data
        assert "session_id" in data
        assert data["checkout_url"].startswith("http")
        assert len(data["session_id"]) > 0

    def test_checkout_rejects_existing_vip(self, admin_token):
        r = requests.post(f"{API}/vip/checkout",
                          headers=auth(admin_token),
                          json={"origin_url": BASE_URL})
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


# ============ Admin analytics ============
class TestAdminEndpoints:
    def test_admin_vip_stats(self, admin_token):
        r = requests.get(f"{API}/admin/vip-stats", headers=auth(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["total_users", "vip_users", "free_users",
                  "active_subscriptions", "canceled_subscriptions", "vip_percentage"]:
            assert k in data, f"Missing key {k}"
        assert data["total_users"] >= data["vip_users"]
        assert data["free_users"] == data["total_users"] - data["vip_users"]

    def test_admin_vip_stats_requires_admin(self, free_user_token):
        token, _ = free_user_token
        r = requests.get(f"{API}/admin/vip-stats", headers=auth(token))
        assert r.status_code in (401, 403)

    def test_admin_atlas_usage(self, admin_token):
        r = requests.get(f"{API}/admin/atlas-usage", headers=auth(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "by_plan" in data
        assert "daily" in data
        assert "top_users" in data

    def test_admin_protection_config(self, admin_token):
        r = requests.get(f"{API}/admin/protection-config", headers=auth(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "burst_max_requests" in data
        assert "burst_window_seconds" in data


# ============ Atlas Chat + rate limit ============
class TestAtlasChat:
    def test_atlas_chat_logs_usage(self, free_user_token):
        token, _ = free_user_token
        r = requests.post(f"{API}/atlas/chat",
                          headers=auth(token),
                          json={"message": "Hi, briefly say hello.", "lang": "en"},
                          timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "response" in data
        assert "conversation_id" in data
        assert len(data["response"]) > 0

    def test_atlas_chat_rate_limit(self, free_user_token):
        token, _ = free_user_token
        # Send 6 rapid requests; burst limit is 4/10s
        results = []
        for i in range(7):
            try:
                r = requests.post(f"{API}/atlas/chat",
                                  headers=auth(token),
                                  json={"message": f"test {i}", "lang": "en"},
                                  timeout=60)
                results.append(r.status_code)
            except requests.RequestException as e:
                results.append(str(e))
            # No sleep — rapid burst
        # Should see at least one 429
        assert 429 in results, f"No rate limit triggered. Statuses: {results}"
