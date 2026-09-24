"""Phase 4 - Caufid progression awareness tests.

Tests:
1. Regression: /api/atlas/progression/hub still returns levels array (Phase 3).
2. Chat endpoint accepts a progression-analysis message and returns a response
   that references real progression data (level/XP/badges/skills keywords).
3. Verifies that get_progression_data tool is declared in TOOLS schema
   (via source inspection of atlas_v3.py).
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com"
).rstrip("/")
ADMIN_EMAIL = "jcuradeau.7@gmail.com"
ADMIN_PASSWORD = "Crypto2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    tok = d.get("access_token") or d.get("token")
    assert tok
    return tok


# ---- Regression: Phase 3 ----
def test_hub_levels_regression(token):
    r = requests.get(
        f"{BASE_URL}/api/atlas/progression/hub?lang=en",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert r.status_code == 200
    hub = r.json()
    lvls = hub.get("levels")
    assert isinstance(lvls, list) and len(lvls) == 9
    assert lvls[0]["xp_threshold"] == 0
    assert lvls[-1]["name_en"] == "Master"


# ---- Phase 4: TOOLS schema exposes get_progression_data ----
def test_get_progression_data_tool_declared():
    path = "/app/backend/routes/atlas_v3.py"
    with open(path) as f:
        src = f.read()
    assert '"name": "get_progression_data"' in src, "Tool name missing from TOOLS schema"
    # Dispatcher wires it up
    assert 'name == "get_progression_data"' in src, "Tool not dispatched in execute_tool"
    assert "from services.progression_service import get_progression_hub" in src, (
        "Tool does not call get_progression_hub"
    )
    # System prompt contains section 111-115 progression awareness
    assert "111-115" in src and "PROGRESSION AWARENESS" in src


def test_build_context_injects_progression_summary():
    path = "/app/backend/routes/atlas_v3.py"
    with open(path) as f:
        src = f.read()
    assert "PROGRESSION SUMMARY:" in src


# ---- Phase 4: Chat references progression data ----
def _post_chat(token, message, lang="en", timeout=60):
    r = requests.post(
        f"{BASE_URL}/api/atlas/chat",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"message": message, "lang": lang},
        timeout=timeout,
    )
    return r


def test_chat_analyse_progression_en(token):
    r = _post_chat(
        token,
        "Analyze my progress in detail. Identify my strengths, weaknesses, and recommend a personalized learning plan.",
        lang="en",
    )
    assert r.status_code == 200, r.text
    d = r.json()
    # response body may vary: try common keys
    reply = (
        d.get("response")
        or d.get("message")
        or d.get("reply")
        or d.get("answer")
        or ""
    )
    if isinstance(reply, dict):
        reply = reply.get("content", "") or reply.get("text", "")
    assert isinstance(reply, str) and len(reply) > 30, f"Reply too short: {d}"
    low = reply.lower()
    # Must reference progression concepts (level / xp / badge / skill / finance/crypto)
    keywords = ["level", "xp", "badge", "skill", "curious", "finance", "crypto", "progress"]
    hits = [k for k in keywords if k in low]
    assert len(hits) >= 2, f"Reply does not reference progression data. Hits={hits}. Reply={reply[:400]}"


def test_chat_analyse_progression_fr(token):
    r = _post_chat(
        token,
        "Analyse ma progression en detail. Identifie mes forces, mes faiblesses, et recommande-moi un plan d'apprentissage personnalise.",
        lang="fr",
    )
    assert r.status_code == 200, r.text
    d = r.json()
    reply = (
        d.get("response")
        or d.get("message")
        or d.get("reply")
        or d.get("answer")
        or ""
    )
    if isinstance(reply, dict):
        reply = reply.get("content", "") or reply.get("text", "")
    assert isinstance(reply, str) and len(reply) > 30, f"Reply too short: {d}"
    low = reply.lower()
    keywords = ["niveau", "xp", "badge", "compet", "finance", "crypto", "progress", "curieux"]
    hits = [k for k in keywords if k in low]
    assert len(hits) >= 2, f"FR reply not referencing progression. Hits={hits}. Reply={reply[:400]}"
