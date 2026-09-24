"""Backend tests for celebrations + streak-reminder cron (iter 102)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if "BACKEND_URL=" in line:
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

EMAIL = "jcuradeau.7@gmail.com"
PASSWORD = "Crypto2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


# --- Celebrations in progression hub ---
def test_hub_returns_celebrations_field(headers):
    r = requests.get(f"{BASE_URL}/api/atlas/progression/hub", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "celebrations" in data, "Hub response must include 'celebrations' array"
    assert isinstance(data["celebrations"], list)


def test_hub_celebrations_shape(headers):
    r = requests.get(f"{BASE_URL}/api/atlas/progression/hub", headers=headers, timeout=20)
    data = r.json()
    for c in data["celebrations"]:
        assert "type" in c
        assert c["type"] in ("xp_gained", "level_up", "badge_earned")


def test_hub_has_required_fields(headers):
    r = requests.get(f"{BASE_URL}/api/atlas/progression/hub", headers=headers, timeout=20)
    data = r.json()
    for k in ("level", "total_xp", "skills", "badges", "levels", "celebrations"):
        assert k in data, f"missing {k}"


# --- Streak reminder cron ---
def test_cron_streak_reminders_requires_secret():
    r = requests.post(f"{BASE_URL}/api/cron/streak-reminders", timeout=15)
    assert r.status_code == 403


def test_cron_streak_reminders_wrong_secret():
    r = requests.post(f"{BASE_URL}/api/cron/streak-reminders", params={"secret": "wrong"}, timeout=15)
    assert r.status_code == 403


def test_cron_streak_reminders_with_secret():
    secret = os.environ.get("CRON_SECRET", "mentova-cron-2026")
    r = requests.post(f"{BASE_URL}/api/cron/streak-reminders", params={"secret": secret}, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True
    assert "sent" in data
    assert "total_users" in data
