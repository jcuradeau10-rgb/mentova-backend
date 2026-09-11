"""
Final VIP system tests (iteration 87).
Validates:
- GET /api/vip/permissions returns EXACTLY 6 VIP features (no fear_greed, no voice)
- GET /api/vip/daily-briefing?lang=fr for VIP
- POST /api/vip/ai/analyze-image works for VIP (native openai SDK)
- POST /api/atlas/chat: VIP user response does NOT include upgrade_prompt
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com").rstrip("/")
EMAIL = "jcuradeau.7@gmail.com"
PASSWORD = "Crypto2026!"

EXPECTED_VIP_FEATURES = {
    "atlas_memory",
    "chart_analysis",
    "market_intelligence",
    "personalized_learning",
    "daily_briefing",
    "advanced_tools",
}
FORBIDDEN_FIELDS = {"fear_greed", "voice", "voice_mode", "voice_assistant"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# --- 1) VIP Permissions ---
def test_vip_permissions_exact_6_features(auth_headers):
    r = requests.get(f"{BASE_URL}/api/vip/permissions", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    print("Permissions payload:", data)
    assert data.get("plan") == "vip"
    assert data.get("is_vip") is True
    # Every expected feature must be present and True
    for feat in EXPECTED_VIP_FEATURES:
        assert feat in data, f"Missing VIP feature: {feat}"
        assert data[feat] is True, f"Feature {feat} not enabled for VIP user"
    # No forbidden fields (fear_greed, voice)
    for bad in FORBIDDEN_FIELDS:
        assert bad not in data, f"Forbidden field present in permissions: {bad}"


# --- 2) Daily Briefing (VIP) ---
def test_vip_daily_briefing_fr(auth_headers):
    r = requests.get(f"{BASE_URL}/api/vip/daily-briefing", params={"lang": "fr"}, headers=auth_headers, timeout=60)
    assert r.status_code == 200, f"Status {r.status_code}: {r.text[:400]}"
    body = r.json()
    print("Briefing keys:", list(body.keys()))
    # Endpoint returns either flat or {'success': True, 'data': {...}}
    data = body.get("data", body)
    for key in ("market_summary", "btc_analysis", "sentiment", "key_events"):
        assert key in data, f"Missing key in daily briefing: {key} - got {list(data.keys())}"
    assert isinstance(data["key_events"], list)
    assert len(str(data["market_summary"])) > 20


def test_daily_briefing_requires_auth():
    r = requests.get(f"{BASE_URL}/api/vip/daily-briefing", timeout=15)
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# --- 3) VIP Image Analyze (native openai) ---
def test_vip_ai_analyze_image(auth_headers):
    # Endpoint expects JSON body with image_base64 (ImageAnalysisRequest)
    import base64
    tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    payload = {
        "image_base64": tiny_png_b64,
        "query": "Analyse rapide",
        "analysis_type": "general",
    }
    r = requests.post(
        f"{BASE_URL}/api/vip/ai/analyze-image",
        headers={**auth_headers, "Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )
    print("analyze-image status:", r.status_code, r.text[:300])
    assert r.status_code == 200, r.text[:400]
    body = r.json()
    data = body.get("data", body)
    assert "analysis" in data or "response" in data, f"Unexpected shape: {body}"


# --- 4) Atlas chat: VIP user should NOT get upgrade_prompt ---
def test_atlas_chat_no_upgrade_prompt_for_vip(auth_headers):
    payload = {"message": "Bonjour Atlas, un mot rapide sur BTC ?"}
    r = requests.post(f"{BASE_URL}/api/atlas/chat", headers=auth_headers, json=payload, timeout=90)
    assert r.status_code == 200, r.text[:400]
    data = r.json()
    print("Atlas response keys:", list(data.keys()))
    assert "response" in data
    # Key assertion: upgrade_prompt must NOT be present for VIP
    assert "upgrade_prompt" not in data, f"VIP user received upgrade_prompt field: {data}"
