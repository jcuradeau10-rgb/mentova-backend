"""VIP system iteration 86 tests: daily-briefing (openai), ai/analyze, tools endpoints."""
import os, pytest, requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://academy-preview-11.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "jcuradeau.7@gmail.com"
ADMIN_PW = "Crypto2026!"


@pytest.fixture(scope="module")
def vip_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, r.text
    return tok


@pytest.fixture(scope="module")
def vip_headers(vip_token):
    return {"Authorization": f"Bearer {vip_token}"}


def test_me_is_vip(vip_headers):
    r = requests.get(f"{API}/auth/me", headers=vip_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    is_vip = data.get("is_vip") or (data.get("user") or {}).get("is_vip")
    assert is_vip, f"Admin should be VIP: {data}"


def test_vip_daily_briefing_fr(vip_headers):
    # implemented as GET in server.py
    r = requests.get(f"{API}/vip/daily-briefing", params={"lang": "fr"}, headers=vip_headers, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    data = body["data"]
    for k in ("market_summary", "btc_analysis", "sentiment", "key_events"):
        assert k in data, f"missing key {k}: {list(data.keys())}"
    assert isinstance(data["key_events"], list)


def test_vip_ai_analyze(vip_headers):
    r = requests.post(
        f"{API}/vip/ai/analyze",
        params={"query": "Give a brief BTC market snapshot in 2 sentences.", "analysis_type": "general"},
        headers=vip_headers,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    assert isinstance(body["data"].get("analysis"), str)
    assert len(body["data"]["analysis"]) > 20


def test_vip_fear_greed(vip_headers):
    r = requests.get(f"{API}/vip/tools/fear-greed", headers=vip_headers, timeout=20)
    assert r.status_code == 200, r.text


def test_vip_halving(vip_headers):
    r = requests.get(f"{API}/vip/tools/halving", headers=vip_headers, timeout=20)
    assert r.status_code == 200, r.text


def test_vip_daily_briefing_requires_auth():
    r = requests.get(f"{API}/vip/daily-briefing", params={"lang": "fr"}, timeout=15)
    assert r.status_code in (401, 403), r.status_code
