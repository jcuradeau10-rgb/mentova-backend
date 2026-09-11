"""Backend tests for User Intelligence system."""
import os
import pytest
import requests

BASE_URL = "https://academy-preview-11.preview.emergentagent.com"
ADMIN_EMAIL = "jcuradeau.7@gmail.com"
ADMIN_PASSWORD = "Crypto2026!"
ADMIN_USER_ID = "3022d23d-11a1-4fbb-849a-0cddb379d65f"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in response: {list(data.keys())}"
    return tok


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ============ Intelligence endpoint ============
class TestUserIntelligence:
    def test_get_intelligence_all(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/intelligence",
                         headers=headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d.get("success") is True
        data = d["data"]
        for key in ["summary", "user_info", "engagement", "atlas", "learning",
                    "feature_usage", "revenue", "timeline"]:
            assert key in data, f"missing {key}"
        assert "engagement_score" in data["engagement"]
        assert "engagement_level" in data["engagement"]

    @pytest.mark.parametrize("period", ["7", "30", "90", "all"])
    def test_intelligence_period(self, headers, period):
        r = requests.get(f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/intelligence",
                         params={"period": period}, headers=headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_intelligence_user_not_found(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/users/nonexistent-uid/intelligence",
                         headers=headers, timeout=30)
        assert r.status_code == 404

    def test_intelligence_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/intelligence",
                         timeout=30)
        assert r.status_code in (401, 403)


# ============ PDF export ============
class TestPDFExport:
    def test_pdf_download(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/intelligence/pdf",
                         headers=headers, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert "application/pdf" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        assert r.content[:4] == b"%PDF", "Not a valid PDF"
        assert len(r.content) > 1000

    def test_pdf_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/intelligence/pdf",
                         timeout=30)
        assert r.status_code in (401, 403)


# ============ Full export ============
class TestFullExport:
    def test_full_export(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/full-export",
                         headers=headers, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert "application/json" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        d = r.json()
        for key in ["_metadata", "user_account", "atlas_conversations",
                    "learning_modules", "user_sessions", "user_events"]:
            assert key in d, f"missing {key}"
        assert d["_metadata"]["user_id"] == ADMIN_USER_ID

    def test_full_export_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/full-export",
                         timeout=30)
        assert r.status_code in (401, 403)


# ============ Session tracking ============
class TestSessionTracking:
    def test_session_start_and_end(self, headers):
        # start
        r = requests.post(f"{BASE_URL}/api/track/session",
                          params={"action": "start"}, headers=headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("success") is True
        sid = data.get("session_id")
        assert sid
        # end
        r2 = requests.post(f"{BASE_URL}/api/track/session",
                           params={"action": "end", "session_id": sid},
                           headers=headers, timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("success") is True


# ============ Event tracking ============
class TestEventTracking:
    def test_track_event(self, headers):
        r = requests.post(f"{BASE_URL}/api/track/event",
                          params={"event_type": "feature_use", "feature": "atlas_ai"},
                          headers=headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("success") is True

    def test_track_event_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/track/event",
                          params={"event_type": "feature_use", "feature": "atlas_ai"},
                          timeout=30)
        assert r.status_code in (401, 403)


# ============ Global intelligence ============
class TestGlobalIntelligence:
    def test_global(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/intelligence/global",
                         headers=headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d.get("success") is True
        data = d["data"]
        for key in ["total_users", "vip_users", "free_users", "total_sessions",
                    "total_conversations", "total_modules"]:
            assert key in data, f"missing {key}"

    def test_global_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/intelligence/global", timeout=30)
        assert r.status_code in (401, 403)
