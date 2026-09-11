"""Tests for Atlas conversation rename (PATCH) and delete (DELETE) endpoints."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://academy-preview-11.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "jcuradeau.7@gmail.com"
ADMIN_PASSWORD = "Crypto2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def conversation_id(headers):
    """Create a conversation by sending a chat message."""
    # Look for existing conversations first
    r = requests.get(f"{BASE_URL}/api/atlas/conversations", headers=headers, timeout=30)
    if r.status_code == 200:
        convs = r.json().get("conversations", [])
        if convs:
            return convs[0]["id"]
    # else create via chat
    r = requests.post(f"{BASE_URL}/api/atlas/chat",
                      headers=headers,
                      json={"message": f"TEST hello {uuid.uuid4().hex[:6]}", "lang": "en"},
                      timeout=120)
    assert r.status_code == 200, f"chat failed: {r.status_code} {r.text[:300]}"
    return r.json()["conversation_id"]


def test_list_conversations(headers):
    r = requests.get(f"{BASE_URL}/api/atlas/conversations", headers=headers, timeout=30)
    assert r.status_code == 200
    assert "conversations" in r.json()


def test_rename_conversation_success(headers, conversation_id):
    new_title = f"TEST Renamed {uuid.uuid4().hex[:6]}"
    r = requests.patch(f"{BASE_URL}/api/atlas/conversations/{conversation_id}",
                       headers=headers, json={"title": new_title}, timeout=30)
    assert r.status_code == 200, f"rename failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    assert data.get("title") == new_title
    # Verify persistence
    r2 = requests.get(f"{BASE_URL}/api/atlas/conversations", headers=headers, timeout=30)
    convs = r2.json()["conversations"]
    found = next((c for c in convs if c["id"] == conversation_id), None)
    assert found is not None
    assert found["title"] == new_title


def test_rename_empty_title_returns_400(headers, conversation_id):
    r = requests.patch(f"{BASE_URL}/api/atlas/conversations/{conversation_id}",
                       headers=headers, json={"title": "   "}, timeout=30)
    assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"


def test_rename_missing_title_field(headers, conversation_id):
    r = requests.patch(f"{BASE_URL}/api/atlas/conversations/{conversation_id}",
                       headers=headers, json={}, timeout=30)
    # Pydantic validation error => 422
    assert r.status_code in (400, 422)


def test_rename_nonexistent_conversation_returns_404(headers):
    fake_id = str(uuid.uuid4())
    r = requests.patch(f"{BASE_URL}/api/atlas/conversations/{fake_id}",
                       headers=headers, json={"title": "TEST nope"}, timeout=30)
    assert r.status_code == 404


def test_rename_too_long_title_returns_400(headers, conversation_id):
    r = requests.patch(f"{BASE_URL}/api/atlas/conversations/{conversation_id}",
                       headers=headers, json={"title": "x" * 201}, timeout=30)
    assert r.status_code == 400


def test_rename_unauthenticated_returns_401(conversation_id):
    r = requests.patch(f"{BASE_URL}/api/atlas/conversations/{conversation_id}",
                       json={"title": "TEST no auth"}, timeout=30)
    assert r.status_code == 401


def test_delete_conversation_success_and_persistence(headers):
    # Create a new conversation to delete (to not disturb others)
    chat = requests.post(f"{BASE_URL}/api/atlas/chat",
                         headers=headers,
                         json={"message": f"TEST to_delete {uuid.uuid4().hex[:6]}", "lang": "en"},
                         timeout=120)
    assert chat.status_code == 200, f"chat failed: {chat.status_code} {chat.text[:300]}"
    cid = chat.json()["conversation_id"]

    r = requests.delete(f"{BASE_URL}/api/atlas/conversations/{cid}", headers=headers, timeout=30)
    assert r.status_code == 200
    assert r.json().get("success") is True

    # Verify GET returns 404
    r2 = requests.get(f"{BASE_URL}/api/atlas/conversations/{cid}", headers=headers, timeout=30)
    assert r2.status_code == 404


def test_delete_nonexistent_returns_404(headers):
    fake_id = str(uuid.uuid4())
    r = requests.delete(f"{BASE_URL}/api/atlas/conversations/{fake_id}", headers=headers, timeout=30)
    assert r.status_code == 404


def test_delete_unauthenticated_returns_401():
    r = requests.delete(f"{BASE_URL}/api/atlas/conversations/anything", timeout=30)
    assert r.status_code == 401
