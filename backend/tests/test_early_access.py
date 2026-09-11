"""Tests for Early Access VIP feature flag on /api/vip/permissions."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com").rstrip("/")

VIP_EMAIL = "jcuradeau.7@gmail.com"
VIP_PASSWORD = "Crypto2026!"


@pytest.fixture(scope="module")
def vip_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": VIP_EMAIL, "password": VIP_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def test_vip_permissions_early_access_true(vip_token):
    r = requests.get(f"{BASE_URL}/api/vip/permissions",
                     headers={"Authorization": f"Bearer {vip_token}"}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["is_vip"] is True
    assert data["plan"] == "vip"
    assert "early_access" in data, f"early_access missing from response: {data}"
    assert data["early_access"] is True
    # existing 6 features should all be true for VIP
    for k in ["atlas_memory", "chart_analysis", "market_intelligence",
              "personalized_learning", "daily_briefing", "advanced_tools"]:
        assert data[k] is True, f"{k} should be True for VIP"


def test_vip_permissions_requires_auth():
    r = requests.get(f"{BASE_URL}/api/vip/permissions", timeout=10)
    assert r.status_code in (401, 403)


def test_free_user_early_access_false():
    """Register a new free user, verify early_access:false."""
    import uuid
    email = f"test_ea_{uuid.uuid4().hex[:8]}@example.com"
    reg = requests.post(f"{BASE_URL}/api/auth/register",
                        json={"email": email, "password": "Test1234!", "name": "EA Test"},
                        timeout=15)
    if reg.status_code not in (200, 201):
        pytest.skip(f"register endpoint unavailable: {reg.status_code} {reg.text[:200]}")
    body = reg.json()
    token = body.get("access_token") or body.get("token")
    if not token:
        # try login
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": email, "password": "Test1234!"}, timeout=15)
        assert login.status_code == 200
        token = login.json()["access_token"]

    r = requests.get(f"{BASE_URL}/api/vip/permissions",
                     headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["plan"] == "free"
    assert data["is_vip"] is False
    assert data["early_access"] is False
