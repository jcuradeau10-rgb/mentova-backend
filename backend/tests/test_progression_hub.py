"""Tests for Progression Hub API (Phase 2) - matches actual response schema."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "jcuradeau.7@gmail.com"
ADMIN_PASSWORD = "Crypto2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def hub(token):
    r = requests.get(f"{BASE_URL}/api/atlas/progression/hub?lang=en",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_hub_success_flag(hub):
    assert hub.get("success") is True


def test_hub_level_fields(hub):
    assert isinstance(hub.get("level"), int)
    assert "level_name_en" in hub and "level_name_fr" in hub
    assert isinstance(hub.get("total_xp"), int)
    assert isinstance(hub.get("xp_for_next_level"), int)
    assert isinstance(hub.get("xp_progress"), (int, float))


def test_hub_streak(hub):
    assert "streak" in hub
    assert isinstance(hub["streak"], int)


def test_hub_skills_five(hub):
    skills = hub.get("skills")
    assert isinstance(skills, list) and len(skills) == 5, f"Got: {skills}"


def test_hub_badges_shape(hub):
    badges = hub.get("badges")
    assert isinstance(badges, list) and len(badges) == 32, f"Expected 32 badges, got {len(badges) if badges else 0}"
    assert hub.get("badges_total") == 32
    assert isinstance(hub.get("badges_earned"), int)
    # Categories present
    cats = {b["category"] for b in badges}
    for c in ["first_steps", "quiz", "modules", "streak", "excellence", "mastery", "milestones"]:
        assert c in cats, f"Missing category: {c}. Got: {cats}"


def test_hub_modules_fields(hub):
    for k in ["modules_total", "modules_in_progress", "modules_completed", "modules_mastered"]:
        assert k in hub, f"Missing: {k}"
    assert "recent_modules" in hub


def test_hub_daily_goals(hub):
    dg = hub.get("daily_goals")
    assert isinstance(dg, dict)
    goals = dg.get("goals")
    assert isinstance(goals, list) and len(goals) >= 3
    # Verify XP rewards and structure
    for g in goals:
        assert "xp_reward" in g
        assert "current" in g
        assert "target" in g


def test_hub_priority(hub):
    p = hub.get("priority")
    assert p is not None


def test_hub_stats_quiz(hub):
    stats = hub.get("stats", {})
    # Quiz stats may be nested here
    assert isinstance(stats, dict)


def test_hub_unauth():
    r = requests.get(f"{BASE_URL}/api/atlas/progression/hub", timeout=30)
    assert r.status_code == 401


def test_all_badges_endpoint(token):
    r = requests.get(f"{BASE_URL}/api/atlas/progression/badges",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["success"] is True
    assert d["total"] == 32


def test_xp_history(token):
    r = requests.get(f"{BASE_URL}/api/atlas/progression/xp-history?limit=5",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "history" in d
    assert isinstance(d["history"], list)
    if d["history"]:
        h0 = d["history"][0]
        for k in ["action_type", "xp_amount", "description", "created_at"]:
            assert k in h0, f"Missing key {k} in xp-history item"


# ============ Phase 3: Levels roadmap in hub response ============
def test_hub_levels_array(hub):
    lvls = hub.get("levels")
    assert isinstance(lvls, list), "hub.levels must be a list"
    assert len(lvls) == 9, f"Expected 9 levels, got {len(lvls) if lvls else 0}"
    # Structure of each level
    for idx, lvl in enumerate(lvls):
        for k in ["level", "name_fr", "name_en", "name_es", "xp_threshold", "color"]:
            assert k in lvl, f"Level {idx} missing key {k}"
    # Sequential 1..9
    assert [l["level"] for l in lvls] == list(range(1, 10))
    # Thresholds ascending, starts at 0
    thresholds = [l["xp_threshold"] for l in lvls]
    assert thresholds[0] == 0
    assert thresholds == sorted(thresholds)
    # Names correctness
    assert lvls[0]["name_en"] == "Curious"
    assert lvls[-1]["name_en"] == "Master"
