"""Test AI chat (Caufid) with Emergent LLM key + VIP checkout + Health/Login."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("REACT_APP_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com")
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "jcuradeau.7@gmail.com"
ADMIN_PASSWORD = "Crypto2026!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No access_token in response: {data}"
    return token


# ============ Health ============
def test_health(session):
    r = session.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200, f"Health failed: {r.status_code}"
    data = r.json()
    assert data.get("status") in ("ok", "healthy", "OK"), f"Unexpected: {data}"


# ============ Login ============
def test_login_returns_access_token(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 10


# ============ AI Chat (Caufid) ============
def test_atlas_chat_with_auth(session, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {"message": "Hello, what is Bitcoin in one sentence?"}
    r = session.post(f"{BASE_URL}/api/atlas/chat", json=payload, headers=headers, timeout=90)
    assert r.status_code == 200, f"Atlas chat failed: {r.status_code} {r.text[:500]}"
    data = r.json()
    # response can be under 'response', 'message', 'reply', or 'content'
    reply = data.get("response") or data.get("message") or data.get("reply") or data.get("content")
    assert reply, f"No AI reply in response: {data}"
    assert isinstance(reply, str) and len(reply) > 5


@pytest.fixture(scope="module")
def user_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": "betnet.ca@hotmail.com", "password": "Curadeau12355."}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Test user login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data.get("access_token") or data.get("token")


# ============ VIP Checkout ============
def test_vip_checkout_creates_stripe_session(session, user_token):
    headers = {"Authorization": f"Bearer {user_token}"}
    # Try common payloads
    payloads = [
        {"origin_url": "https://academy-preview-11.preview.emergentagent.com"},
        {"origin_url": "https://academy-preview-11.preview.emergentagent.com", "success_url": "https://academy-preview-11.preview.emergentagent.com/vip/success", "cancel_url": "https://academy-preview-11.preview.emergentagent.com/vip/cancel"},
    ]
    last = None
    for p in payloads:
        r = session.post(f"{BASE_URL}/api/vip/checkout", json=p, headers=headers, timeout=45)
        last = r
        if r.status_code == 200:
            break
    assert last.status_code == 200, f"VIP checkout failed: {last.status_code} {last.text[:500]}"
    data = last.json()
    url = data.get("checkout_url") or data.get("url")
    session_id = data.get("session_id") or data.get("id")
    assert url and "stripe" in url.lower(), f"No stripe checkout_url: {data}"
    # attach for next test
    pytest.stripe_session_id = session_id


# ============ VIP Checkout status ============
def test_vip_checkout_status(session, user_token):
    session_id = getattr(pytest, "stripe_session_id", None)
    if not session_id:
        pytest.skip("No session id from prior test")
    headers = {"Authorization": f"Bearer {user_token}"}
    r = session.get(f"{BASE_URL}/api/vip/checkout/status/{session_id}", headers=headers, timeout=30)
    assert r.status_code == 200, f"Status failed: {r.status_code} {r.text[:500]}"
    data = r.json()
    # should have a status field
    assert "status" in data or "payment_status" in data, f"No status in resp: {data}"
