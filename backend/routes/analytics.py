"""
Real-time Analytics for Super Admin Dashboard
Tracks: active users, page views, API calls, engagement metrics, system health
"""
import time
import logging
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os

logger = logging.getLogger("analytics")
router = APIRouter()

# ==================== IN-MEMORY TRACKERS ====================
# These reset on server restart but give real-time data

_active_sessions: Dict[str, float] = {}  # user_id -> last_seen_timestamp
_api_calls_log: List[Dict] = []  # [{timestamp, endpoint, user_id, method, status}]
_page_views: List[Dict] = []  # [{timestamp, page, user_id}]
_coingecko_calls: List[float] = []  # [timestamps]
_atlas_calls: List[Dict] = []  # [{timestamp, user_id, lang}]
_hourly_active: Dict[int, set] = defaultdict(set)  # hour -> set of user_ids

MAX_LOG_SIZE = 50000  # Keep last 50K entries in memory

def track_api_call(endpoint: str, method: str, user_id: str = "anonymous", status: int = 200):
    """Track an API call for analytics."""
    now = time.time()
    _api_calls_log.append({"ts": now, "endpoint": endpoint, "method": method, "user_id": user_id, "status": status})
    if len(_api_calls_log) > MAX_LOG_SIZE:
        _api_calls_log[:] = _api_calls_log[-MAX_LOG_SIZE:]
    
    # Update active sessions
    if user_id != "anonymous":
        _active_sessions[user_id] = now
        hour = datetime.fromtimestamp(now).hour
        _hourly_active[hour].add(user_id)

def track_page_view(page: str, user_id: str = "anonymous"):
    """Track a page view."""
    _page_views.append({"ts": time.time(), "page": page, "user_id": user_id})
    if len(_page_views) > MAX_LOG_SIZE:
        _page_views[:] = _page_views[-MAX_LOG_SIZE:]

def track_coingecko_call():
    """Track a CoinGecko API call."""
    _coingecko_calls.append(time.time())
    if len(_coingecko_calls) > 200000:
        _coingecko_calls[:] = _coingecko_calls[-200000:]

def track_atlas_call(user_id: str = "anonymous", lang: str = "en"):
    """Track an Atlas AI call."""
    _atlas_calls.append({"ts": time.time(), "user_id": user_id, "lang": lang})
    if len(_atlas_calls) > MAX_LOG_SIZE:
        _atlas_calls[:] = _atlas_calls[-MAX_LOG_SIZE:]

# ==================== AUTH ====================
_db = None
def set_analytics_db(database):
    global _db
    _db = database

SUPER_ADMIN_EMAIL = os.environ.get('SUPER_ADMIN_EMAIL', 'jcuradeau.7@gmail.com')

async def _super_admin_auth(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    try:
        payload = jwt.decode(credentials.credentials, os.environ.get("JWT_SECRET", "mentova-secret-key-2024"), algorithms=["HS256"])
        user_id = payload.get("user_id", "")
        email = payload.get("email", "")
        user = await _db.users.find_one({"$or": [{"id": user_id}, {"email": email}]}) if (user_id or email) else None
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        role = user.get("role", "user")
        if user.get("email") == SUPER_ADMIN_EMAIL:
            role = "super_admin"
        if role != "super_admin":
            raise HTTPException(status_code=403, detail="Super admin only")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/admin/analytics/realtime")
async def get_realtime_analytics(admin: dict = Depends(_super_admin_auth)):
    """Get comprehensive real-time analytics data."""
    now = time.time()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).timestamp()
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).timestamp()
    month_start = (datetime.now(timezone.utc) - timedelta(days=30)).timestamp()
    
    # === ACTIVE USERS ===
    active_1min = sum(1 for ts in _active_sessions.values() if now - ts < 60)
    active_5min = sum(1 for ts in _active_sessions.values() if now - ts < 300)
    active_15min = sum(1 for ts in _active_sessions.values() if now - ts < 900)
    active_1h = sum(1 for ts in _active_sessions.values() if now - ts < 3600)
    
    # === API CALLS ===
    calls_1min = sum(1 for c in _api_calls_log if now - c["ts"] < 60)
    calls_5min = sum(1 for c in _api_calls_log if now - c["ts"] < 300)
    calls_1h = sum(1 for c in _api_calls_log if now - c["ts"] < 3600)
    calls_today = sum(1 for c in _api_calls_log if c["ts"] > today_start)
    
    # Error rate
    errors_1h = sum(1 for c in _api_calls_log if now - c["ts"] < 3600 and c["status"] >= 400)
    error_rate = (errors_1h / max(1, calls_1h)) * 100
    
    # === TOP ENDPOINTS (last hour) ===
    endpoint_counts = defaultdict(int)
    for c in _api_calls_log:
        if now - c["ts"] < 3600:
            endpoint_counts[c["endpoint"]] += 1
    top_endpoints = sorted(endpoint_counts.items(), key=lambda x: -x[1])[:15]
    
    # === PAGE VIEWS ===
    page_counts_today = defaultdict(int)
    for pv in _page_views:
        if pv["ts"] > today_start:
            page_counts_today[pv["page"]] += 1
    top_pages = sorted(page_counts_today.items(), key=lambda x: -x[1])[:10]
    
    # === COINGECKO USAGE ===
    cg_today = sum(1 for ts in _coingecko_calls if ts > today_start)
    cg_this_month = sum(1 for ts in _coingecko_calls if ts > month_start)
    cg_per_hour = sum(1 for ts in _coingecko_calls if now - ts < 3600)
    
    # === ATLAS AI USAGE ===
    atlas_today = sum(1 for c in _atlas_calls if c["ts"] > today_start)
    atlas_week = sum(1 for c in _atlas_calls if c["ts"] > week_start)
    atlas_lang_dist = defaultdict(int)
    for c in _atlas_calls:
        if c["ts"] > today_start:
            atlas_lang_dist[c["lang"]] += 1
    
    # === UNIQUE USERS TODAY ===
    unique_users_today = len(set(c["user_id"] for c in _api_calls_log if c["ts"] > today_start and c["user_id"] != "anonymous"))
    
    # === HOURLY ACTIVITY (last 24h) ===
    hourly_calls = defaultdict(int)
    hourly_users = defaultdict(set)
    for c in _api_calls_log:
        if now - c["ts"] < 86400:
            h = datetime.fromtimestamp(c["ts"]).strftime("%H:00")
            hourly_calls[h] += 1
            if c["user_id"] != "anonymous":
                hourly_users[h].add(c["user_id"])
    
    hourly_chart = []
    for h in range(24):
        label = f"{h:02d}:00"
        hourly_chart.append({
            "hour": label,
            "calls": hourly_calls.get(label, 0),
            "users": len(hourly_users.get(label, set())),
        })
    
    # === STATUS CODE DISTRIBUTION ===
    status_dist = defaultdict(int)
    for c in _api_calls_log:
        if now - c["ts"] < 3600:
            bucket = f"{c['status'] // 100}xx"
            status_dist[bucket] += 1
    
    # === REQUEST RATE (per minute, last 10 min) ===
    rate_chart = []
    for i in range(10, 0, -1):
        start = now - i * 60
        end = now - (i - 1) * 60
        count = sum(1 for c in _api_calls_log if start <= c["ts"] < end)
        rate_chart.append({"minute": f"-{i}m", "requests": count})
    
    # === DATABASE STATS ===
    db_stats = {}
    if _db is not None:
        try:
            db_stats["total_users"] = await _db.users.count_documents({})
            db_stats["vip_users"] = await _db.users.count_documents({"is_vip": True})
            db_stats["banned_users"] = await _db.users.count_documents({"is_banned": True})
            db_stats["total_posts"] = await _db.community_posts.count_documents({})
            db_stats["total_comments"] = await _db.community_comments.count_documents({})
            db_stats["total_notifications"] = await _db.notifications.count_documents({})
            db_stats["total_messages"] = await _db.messages.count_documents({}) if "messages" in await _db.list_collection_names() else 0
            db_stats["pre_registrations"] = await _db.pre_registrations.count_documents({})
            
            # New users today/week/month — handle both string and datetime created_at
            today_dt = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            week_dt = datetime.now(timezone.utc) - timedelta(days=7)
            month_dt = datetime.now(timezone.utc) - timedelta(days=30)
            today_str = today_dt.strftime("%Y-%m-%d")
            week_str = week_dt.strftime("%Y-%m-%d")
            month_str = month_dt.strftime("%Y-%m-%d")
            
            # Try datetime comparison first, fallback to string
            db_stats["new_users_today"] = await _db.users.count_documents({"$or": [
                {"created_at": {"$gte": today_dt}},
                {"created_at": {"$gte": today_str}},
            ]})
            db_stats["new_users_week"] = await _db.users.count_documents({"$or": [
                {"created_at": {"$gte": week_dt}},
                {"created_at": {"$gte": week_str}},
            ]})
            db_stats["new_users_month"] = await _db.users.count_documents({"$or": [
                {"created_at": {"$gte": month_dt}},
                {"created_at": {"$gte": month_str}},
            ]})
            
            # Posts today/week
            db_stats["posts_today"] = await _db.community_posts.count_documents({"$or": [
                {"created_at": {"$gte": today_dt}},
                {"created_at": {"$gte": today_str}},
            ]})
            db_stats["posts_week"] = await _db.community_posts.count_documents({"$or": [
                {"created_at": {"$gte": week_dt}},
                {"created_at": {"$gte": week_str}},
            ]})
            
            # Registration trend (last 30 days)
            reg_trend = []
            for i in range(30, 0, -1):
                ds = datetime.now(timezone.utc) - timedelta(days=i)
                de = datetime.now(timezone.utc) - timedelta(days=i-1)
                ds_str = ds.strftime("%Y-%m-%d")
                de_str = de.strftime("%Y-%m-%d")
                count = await _db.users.count_documents({"$or": [
                    {"created_at": {"$gte": ds, "$lt": de}},
                    {"created_at": {"$gte": ds_str, "$lt": de_str}},
                ]})
                reg_trend.append({"date": ds_str[5:], "count": count})
            db_stats["registration_trend"] = reg_trend
            
            # VIP conversion rate
            total = db_stats["total_users"]
            db_stats["vip_conversion_rate"] = round((db_stats["vip_users"] / max(1, total)) * 100, 2)
            
            # Top community contributors
            pipeline = [
                {"$match": {"author_name": {"$ne": None}}},
                {"$group": {"_id": "$author_name", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 5}
            ]
            top_posters = await _db.community_posts.aggregate(pipeline).to_list(5)
            db_stats["top_contributors"] = [{"name": p["_id"] or "Anonyme", "posts": p["count"]} for p in top_posters]
            
        except Exception as e:
            logger.error(f"DB stats error: {e}")
    
    # === SERVER UPTIME ===
    import platform
    uptime_seconds = now - _server_start_time if _server_start_time else 0
    uptime_hours = uptime_seconds / 3600
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "live": {
            "active_now": active_1min,
            "active_5min": active_5min,
            "active_15min": active_15min,
            "active_1h": active_1h,
            "total_sessions": len(_active_sessions),
        },
        "api": {
            "calls_per_minute": calls_1min,
            "calls_5min": calls_5min,
            "calls_1h": calls_1h,
            "calls_today": calls_today,
            "error_rate_1h": round(error_rate, 2),
            "status_distribution": dict(status_dist),
            "top_endpoints": [{"endpoint": e, "count": c} for e, c in top_endpoints],
            "rate_chart": rate_chart,
        },
        "engagement": {
            "unique_users_today": unique_users_today,
            "top_pages": [{"page": p, "views": v} for p, v in top_pages],
            "hourly_chart": hourly_chart,
        },
        "atlas": {
            "calls_today": atlas_today,
            "calls_week": atlas_week,
            "language_distribution": dict(atlas_lang_dist),
        },
        "coingecko": {
            "calls_today": cg_today,
            "calls_this_month": cg_this_month,
            "calls_per_hour": cg_per_hour,
            "monthly_limit": 100000,
            "usage_percent": round((cg_this_month / 100000) * 100, 2),
        },
        "database": db_stats,
        "system": {
            "uptime_hours": round(uptime_hours, 2),
            "python_version": platform.python_version(),
            "total_tracked_events": len(_api_calls_log),
        },
    }

@router.post("/admin/analytics/track")
async def track_event(event: dict):
    """Track a frontend page view or event."""
    page = event.get("page", "unknown")
    user_id = event.get("user_id", "anonymous")
    track_page_view(page, user_id)
    if user_id != "anonymous":
        _active_sessions[user_id] = time.time()
    return {"ok": True}

# Server start time tracking
_server_start_time = time.time()
