"""
End-to-End Notification System Tests
Verifies notifications are created in MongoDB when:
- A user likes a community post
- A user comments on a community post
- A user sends a direct message
- A user reports a post (admin notification)
- A user follows another user
And that GET /api/notifications/history + POST /api/notifications/mark-read work.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = "https://academy-preview-11.preview.emergentagent.com"

ADMIN_EMAIL = "jcuradeau.7@gmail.com"
ADMIN_PASSWORD = "Crypto2026!"
APPLE_EMAIL = "applereview@mentova.com"
APPLE_PASSWORD = "AppleReview2026!"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No access_token in login response: {data}"
    user_id = (data.get("user") or {}).get("id") or data.get("user_id")
    return token, user_id, data


@pytest.fixture(scope="module")
def admin_session():
    token, uid, raw = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    # fetch self if user_id missing
    if not uid:
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=10)
        if me.status_code == 200:
            uid = me.json().get("id")
    return {"session": s, "user_id": uid, "token": token, "raw": raw}


@pytest.fixture(scope="module")
def apple_session():
    token, uid, raw = _login(APPLE_EMAIL, APPLE_PASSWORD)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    if not uid:
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=10)
        if me.status_code == 200:
            uid = me.json().get("id")
    return {"session": s, "user_id": uid, "token": token, "raw": raw}


def _get_history(session):
    r = session.get(f"{BASE_URL}/api/notifications/history", timeout=15)
    assert r.status_code == 200, f"history failed: {r.status_code} {r.text}"
    data = r.json()
    if isinstance(data, dict):
        return data.get("data") or data.get("notifications") or data.get("items") or []
    return data


def _get_posts(session):
    r = session.get(f"{BASE_URL}/api/community/posts", timeout=15)
    assert r.status_code == 200
    data = r.json()
    if isinstance(data, dict):
        return data.get("data") or data.get("posts") or data.get("items") or []
    return data


def _create_admin_post(admin_session):
    """Create a community post by admin so apple's interactions notify admin."""
    s = admin_session["session"]
    # Endpoint uses Form data, not JSON
    headers = {k: v for k, v in s.headers.items() if k.lower() != "content-type"}
    r = requests.post(f"{BASE_URL}/api/community/posts",
                      data={"content": f"TEST_post_{uuid.uuid4().hex[:6]}", "category": "general"},
                      headers=headers, timeout=15)
    if r.status_code not in (200, 201):
        return None
    data = r.json()
    if isinstance(data, dict):
        p = data.get("data") or data.get("post") or data
        return p.get("id") or p.get("_id") or p.get("post_id")
    return None


def _has_type_after(notifications, ntype, after_ts):
    for n in notifications:
        if n.get("type") == ntype:
            created = n.get("created_at") or n.get("createdAt") or ""
            # accept any if no parseable timestamp
            return True
    return False


def test_notifications_history_endpoint(admin_session):
    """GET /api/notifications/history returns list with expected shape."""
    s = admin_session["session"]
    notifs = _get_history(s)
    assert isinstance(notifs, list)
    if notifs:
        n = notifs[0]
        # required shape
        for f in ("id", "title", "type", "is_read", "created_at"):
            assert f in n, f"missing field {f} in notification: {n}"


def test_mark_all_read_endpoint(admin_session):
    """POST /api/notifications/mark-read marks all as read."""
    s = admin_session["session"]
    r = s.post(f"{BASE_URL}/api/notifications/mark-read", json={}, timeout=15)
    assert r.status_code in (200, 204), f"mark-read failed: {r.status_code} {r.text}"
    notifs = _get_history(s)
    unread = [n for n in notifs if not n.get("is_read", False)]
    assert len(unread) == 0, f"After mark-read, {len(unread)} notifications still unread"


def _get_or_create_admin_post(admin_session, apple_session):
    """Find or create a community post authored by admin."""
    posts = _get_posts(apple_session["session"])
    admin_uid = admin_session["user_id"]
    for p in posts:
        author_id = p.get("user_id") or p.get("author_id") or (p.get("author") or {}).get("id")
        if author_id == admin_uid:
            pid = p.get("id") or p.get("_id") or p.get("post_id")
            if pid:
                return pid
    pid = _create_admin_post(admin_session)
    if not pid:
        pytest.skip("Could not get or create admin post")
    return pid


def test_like_creates_notification(admin_session, apple_session):
    """Apple likes admin's post -> admin should get post_like notification."""
    post_id = _get_or_create_admin_post(admin_session, apple_session)
    target_session = admin_session["session"]

    before = _get_history(target_session)
    before_ids = {n.get("id") for n in before}

    apple = apple_session["session"]
    r = apple.post(f"{BASE_URL}/api/community/posts/{post_id}/like", json={}, timeout=15)
    assert r.status_code in (200, 201), f"like failed: {r.status_code} {r.text}"

    time.sleep(2)
    after = _get_history(target_session)
    new = [n for n in after if n.get("id") not in before_ids]
    assert any(n.get("type") == "post_like" for n in new), \
        f"No new post_like notification for admin. New items: {new}"


def test_comment_creates_notification(admin_session, apple_session):
    """Apple comments on admin's post -> admin should get post_comment notification."""
    post_id = _get_or_create_admin_post(admin_session, apple_session)
    target_session = admin_session["session"]

    before = _get_history(target_session)
    before_ids = {n.get("id") for n in before}

    apple = apple_session["session"]
    r = apple.post(f"{BASE_URL}/api/community/posts/{post_id}/comments",
                   json={"content": f"TEST_comment_{uuid.uuid4().hex[:6]}"}, timeout=15)
    assert r.status_code in (200, 201), f"comment failed: {r.status_code} {r.text}"

    time.sleep(2)
    after = _get_history(target_session)
    new = [n for n in after if n.get("id") not in before_ids]
    assert any(n.get("type") == "post_comment" for n in new), \
        f"No new post_comment notification. New items types: {[n.get('type') for n in new]}"


def test_message_creates_notification(admin_session, apple_session):
    """Apple sends message to admin -> admin should get new_message notification."""
    target_uid = admin_session["user_id"]
    assert target_uid, "No admin user_id available"

    target_session = admin_session["session"]
    before = _get_history(target_session)
    before_ids = {n.get("id") for n in before}

    apple = apple_session["session"]
    r = apple.post(f"{BASE_URL}/api/messages/{target_uid}",
                   json={"content": f"TEST_msg_{uuid.uuid4().hex[:6]}"}, timeout=15)
    assert r.status_code in (200, 201), f"send message failed: {r.status_code} {r.text}"

    time.sleep(2)
    after = _get_history(target_session)
    new = [n for n in after if n.get("id") not in before_ids]
    assert any(n.get("type") == "new_message" for n in new), \
        f"No new_message notification. New types: {[n.get('type') for n in new]}"


def test_report_creates_admin_notification(admin_session, apple_session):
    """Apple reports a post -> admin (super-admin) should get admin_report notification."""
    # find any community post
    s = apple_session["session"]
    posts = _get_posts(s)
    if not posts:
        # create one as admin
        pid = _create_admin_post(admin_session)
        if not pid:
            pytest.skip("No community posts available and could not create one")
        post_id = pid
    else:
        post_id = posts[0].get("id") or posts[0].get("_id")

    target_session = admin_session["session"]
    before = _get_history(target_session)
    before_ids = {n.get("id") for n in before}

    apple = apple_session["session"]
    r = apple.post(f"{BASE_URL}/api/community/posts/{post_id}/report",
                   json={"reason": "spam"}, timeout=15)
    assert r.status_code in (200, 201), f"report failed: {r.status_code} {r.text}"

    time.sleep(2)
    after = _get_history(target_session)
    new = [n for n in after if n.get("id") not in before_ids]
    assert any(n.get("type") == "admin_report" for n in new), \
        f"No admin_report notification for admin. New types: {[n.get('type') for n in new]}"


def test_follow_creates_notification(admin_session, apple_session):
    """Apple follows admin -> admin should get follow notification."""
    target_uid = admin_session["user_id"]
    assert target_uid

    target_session = admin_session["session"]
    before = _get_history(target_session)
    before_ids = {n.get("id") for n in before}

    apple = apple_session["session"]
    # The follow endpoint is a toggle; call once to ensure we land in "unfollowed" state, then call again to follow
    apple.post(f"{BASE_URL}/api/users/{target_uid}/follow", json={}, timeout=10)
    time.sleep(0.5)
    # Now call again - this should follow (and trigger notification)
    r = apple.post(f"{BASE_URL}/api/users/{target_uid}/follow", json={}, timeout=15)
    assert r.status_code in (200, 201), f"follow failed: {r.status_code} {r.text}"
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if body.get("action") != "followed":
        # ensure we ended in followed state
        time.sleep(0.5)
        r = apple.post(f"{BASE_URL}/api/users/{target_uid}/follow", json={}, timeout=15)

    time.sleep(2)
    after = _get_history(target_session)
    new = [n for n in after if n.get("id") not in before_ids]
    assert any(n.get("type") == "follow" for n in new), \
        f"No follow notification. New types: {[n.get('type') for n in new]}"
