"""
Real-time Analytics for Super Admin Dashboard
Persists counters in MongoDB — survives server restarts
In-memory buffers for real-time data (active users, rate charts)
"""
import time
import asyncio
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

# ==================== IN-MEMORY BUFFERS (real-time, last 1h) ====================
_api_calls_log: List[Dict] = []  # recent API calls for rate/active tracking
_coingecko_buffer: List[float] = []  # recent CG timestamps for rate tracking
_atlas_buffer: List[Dict] = []  # recent Atlas calls
MAX_LOG_SIZE = 50000

# ==================== MONGODB PERSISTENCE ====================
_db = None
_flush_lock = asyncio.Lock() if asyncio.get_event_loop().is_running() else None
_pending_cg_count = 0
_pending_atlas_count = 0
_pending_atlas_langs: Dict[str, int] = defaultdict(int)
_pending_api_count = 0
_pending_errors = 0

def set_analytics_db(database):
    global _db
    _db = database

async def _ensure_indexes():
    """Create TTL and query indexes for analytics collections."""
    if _db is None:
        return
    try:
        await _db.analytics_counters.create_index("date", unique=True)
        await _db.analytics_api_log.create_index("ts", expireAfterSeconds=604800)  # 7 day TTL
    except Exception:
        pass

async def _flush_to_mongo():
    """Flush accumulated counters to MongoDB (called periodically)."""
    global _pending_cg_count, _pending_atlas_count, _pending_api_count, _pending_errors, _pending_atlas_langs
    if _db is None:
        return
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    try:
        # Atomic increment of daily counters
        inc_fields = {}
        if _pending_cg_count > 0:
            inc_fields["coingecko_calls"] = _pending_cg_count
        if _pending_atlas_count > 0:
            inc_fields["atlas_calls"] = _pending_atlas_count
        if _pending_api_count > 0:
            inc_fields["api_calls"] = _pending_api_count
        if _pending_errors > 0:
            inc_fields["errors"] = _pending_errors
        for lang, cnt in _pending_atlas_langs.items():
            inc_fields[f"atlas_lang_{lang}"] = cnt
        
        if inc_fields:
            await _db.analytics_counters.update_one(
                {"date": today},
                {"$inc": inc_fields, "$setOnInsert": {"date": today}},
                upsert=True
            )
        
        # Reset pending counts
        _pending_cg_count = 0
        _pending_atlas_count = 0
        _pending_api_count = 0
        _pending_errors = 0
        _pending_atlas_langs.clear()
        
    except Exception as e:
        logger.error(f"Analytics flush error: {e}")

async def _flush_loop():
    """Background task to flush counters every 30 seconds."""
    await asyncio.sleep(5)  # Wait for DB to be ready
    await _ensure_indexes()
    while True:
        try:
            await _flush_to_mongo()
        except Exception as e:
            logger.error(f"Flush loop error: {e}")
        await asyncio.sleep(30)

# ==================== TRACKING FUNCTIONS ====================

def track_api_call(endpoint: str, method: str, user_id: str = "anonymous", status: int = 200):
    """Track an API call."""
    global _pending_api_count, _pending_errors
    now = time.time()
    _api_calls_log.append({"ts": now, "endpoint": endpoint, "method": method, "user_id": user_id, "status": status})
    if len(_api_calls_log) > MAX_LOG_SIZE:
        _api_calls_log[:] = _api_calls_log[-MAX_LOG_SIZE:]
    _pending_api_count += 1
    if status >= 400:
        _pending_errors += 1

def track_coingecko_call():
    """Track a CoinGecko API call."""
    global _pending_cg_count
    _coingecko_buffer.append(time.time())
    if len(_coingecko_buffer) > 100000:
        _coingecko_buffer[:] = _coingecko_buffer[-100000:]
    _pending_cg_count += 1

def track_atlas_call(user_id: str = "anonymous", lang: str = "en"):
    """Track an Atlas AI call."""
    global _pending_atlas_count
    _atlas_buffer.append({"ts": time.time(), "user_id": user_id, "lang": lang})
    if len(_atlas_buffer) > MAX_LOG_SIZE:
        _atlas_buffer[:] = _atlas_buffer[-MAX_LOG_SIZE:]
    _pending_atlas_count += 1
    _pending_atlas_langs[lang] += 1

# ==================== AUTH ====================
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
    """Get comprehensive real-time analytics data — combines in-memory + MongoDB persisted."""
    now = time.time()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).timestamp()
    
    # === ACTIVE USERS (from in-memory log) ===
    active_1min = set()
    active_5min = set()
    active_15min = set()
    active_1h = set()
    for c in _api_calls_log:
        uid = c["user_id"]
        if uid == "anonymous":
            continue
        age = now - c["ts"]
        if age < 60:
            active_1min.add(uid)
        if age < 300:
            active_5min.add(uid)
        if age < 900:
            active_15min.add(uid)
        if age < 3600:
            active_1h.add(uid)
    
    # === API CALLS (in-memory for real-time rates) ===
    calls_1min = sum(1 for c in _api_calls_log if now - c["ts"] < 60)
    calls_5min = sum(1 for c in _api_calls_log if now - c["ts"] < 300)
    calls_1h = sum(1 for c in _api_calls_log if now - c["ts"] < 3600)
    errors_1h = sum(1 for c in _api_calls_log if now - c["ts"] < 3600 and c["status"] >= 400)
    error_rate = (errors_1h / max(1, calls_1h)) * 100
    
    # === PERSISTED DAILY COUNTERS (from MongoDB) ===
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_start_str = (datetime.now(timezone.utc).replace(day=1)).strftime("%Y-%m-%d")
    
    today_counters = {}
    month_cg_total = 0
    month_atlas_total = 0
    month_api_total = 0
    
    if _db is not None:
        try:
            today_counters = await _db.analytics_counters.find_one({"date": today_str}) or {}
            
            # Sum all days this month for monthly totals
            month_docs = await _db.analytics_counters.find(
                {"date": {"$gte": month_start_str}}
            ).to_list(31)
            for doc in month_docs:
                month_cg_total += doc.get("coingecko_calls", 0)
                month_atlas_total += doc.get("atlas_calls", 0)
                month_api_total += doc.get("api_calls", 0)
        except Exception as e:
            logger.error(f"Counter read error: {e}")
    
    # Add pending (not yet flushed) counts
    cg_today = today_counters.get("coingecko_calls", 0) + _pending_cg_count
    atlas_today = today_counters.get("atlas_calls", 0) + _pending_atlas_count
    api_today = today_counters.get("api_calls", 0) + _pending_api_count
    month_cg_total += _pending_cg_count
    month_atlas_total += _pending_atlas_count
    
    # Atlas language distribution (today from DB + pending)
    atlas_lang_dist = dict(_pending_atlas_langs)
    for k, v in today_counters.items():
        if k.startswith("atlas_lang_"):
            lang = k.replace("atlas_lang_", "")
            atlas_lang_dist[lang] = atlas_lang_dist.get(lang, 0) + v
    
    # === TOP ENDPOINTS (last hour, in-memory) ===
    endpoint_counts = defaultdict(int)
    for c in _api_calls_log:
        if now - c["ts"] < 3600:
            endpoint_counts[c["endpoint"]] += 1
    top_endpoints = sorted(endpoint_counts.items(), key=lambda x: -x[1])[:15]
    
    # === CG rate (in-memory buffer) ===
    cg_per_hour = sum(1 for ts in _coingecko_buffer if now - ts < 3600)
    
    # === UNIQUE USERS TODAY (in-memory) ===
    unique_users_today = len(set(c["user_id"] for c in _api_calls_log if c["ts"] > today_start and c["user_id"] != "anonymous"))
    
    # === HOURLY ACTIVITY (in-memory, last 24h) ===
    hourly_calls = defaultdict(int)
    hourly_users = defaultdict(set)
    for c in _api_calls_log:
        if now - c["ts"] < 86400:
            h = datetime.fromtimestamp(c["ts"]).strftime("%H:00")
            hourly_calls[h] += 1
            if c["user_id"] != "anonymous":
                hourly_users[h].add(c["user_id"])
    hourly_chart = [{"hour": f"{h:02d}:00", "calls": hourly_calls.get(f"{h:02d}:00", 0), "users": len(hourly_users.get(f"{h:02d}:00", set()))} for h in range(24)]
    
    # === STATUS CODE DISTRIBUTION (in-memory, 1h) ===
    status_dist = defaultdict(int)
    for c in _api_calls_log:
        if now - c["ts"] < 3600:
            status_dist[f"{c['status'] // 100}xx"] += 1
    
    # === REQUEST RATE CHART (in-memory, last 10 min) ===
    rate_chart = []
    for i in range(10, 0, -1):
        start = now - i * 60
        end = now - (i - 1) * 60
        rate_chart.append({"minute": f"-{i}m", "requests": sum(1 for c in _api_calls_log if start <= c["ts"] < end)})
    
    # === DATABASE STATS (from MongoDB) ===
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
            
            today_dt = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            week_dt = datetime.now(timezone.utc) - timedelta(days=7)
            month_dt = datetime.now(timezone.utc) - timedelta(days=30)
            today_s = today_dt.strftime("%Y-%m-%d")
            week_s = week_dt.strftime("%Y-%m-%d")
            month_s = month_dt.strftime("%Y-%m-%d")
            
            db_stats["new_users_today"] = await _db.users.count_documents({"$or": [{"created_at": {"$gte": today_dt}}, {"created_at": {"$gte": today_s}}]})
            db_stats["new_users_week"] = await _db.users.count_documents({"$or": [{"created_at": {"$gte": week_dt}}, {"created_at": {"$gte": week_s}}]})
            db_stats["new_users_month"] = await _db.users.count_documents({"$or": [{"created_at": {"$gte": month_dt}}, {"created_at": {"$gte": month_s}}]})
            db_stats["posts_today"] = await _db.community_posts.count_documents({"$or": [{"created_at": {"$gte": today_dt}}, {"created_at": {"$gte": today_s}}]})
            db_stats["posts_week"] = await _db.community_posts.count_documents({"$or": [{"created_at": {"$gte": week_dt}}, {"created_at": {"$gte": week_s}}]})
            
            reg_trend = []
            for i in range(30, 0, -1):
                ds = datetime.now(timezone.utc) - timedelta(days=i)
                de = datetime.now(timezone.utc) - timedelta(days=i-1)
                ds_s, de_s = ds.strftime("%Y-%m-%d"), de.strftime("%Y-%m-%d")
                count = await _db.users.count_documents({"$or": [{"created_at": {"$gte": ds, "$lt": de}}, {"created_at": {"$gte": ds_s, "$lt": de_s}}]})
                reg_trend.append({"date": ds_s[5:], "count": count})
            db_stats["registration_trend"] = reg_trend
            
            total = db_stats["total_users"]
            db_stats["vip_conversion_rate"] = round((db_stats["vip_users"] / max(1, total)) * 100, 2)
            
            pipeline = [{"$match": {"author_name": {"$ne": None}}}, {"$group": {"_id": "$author_name", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 5}]
            top_posters = await _db.community_posts.aggregate(pipeline).to_list(5)
            db_stats["top_contributors"] = [{"name": p["_id"] or "Anonyme", "posts": p["count"]} for p in top_posters]
            
            # Monthly API call history (last 30 days from persisted counters)
            month_history = []
            for doc in (await _db.analytics_counters.find({"date": {"$gte": month_s}}).sort("date", 1).to_list(31)):
                month_history.append({
                    "date": doc["date"][5:],
                    "api": doc.get("api_calls", 0),
                    "cg": doc.get("coingecko_calls", 0),
                    "atlas": doc.get("atlas_calls", 0),
                })
            db_stats["daily_api_history"] = month_history
            
        except Exception as e:
            logger.error(f"DB stats error: {e}")
    
    import platform
    uptime_seconds = now - _server_start_time
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "live": {
            "active_now": len(active_1min),
            "active_5min": len(active_5min),
            "active_15min": len(active_15min),
            "active_1h": len(active_1h),
            "total_sessions": len(set(c["user_id"] for c in _api_calls_log if c["user_id"] != "anonymous")),
        },
        "api": {
            "calls_per_minute": calls_1min,
            "calls_5min": calls_5min,
            "calls_1h": calls_1h,
            "calls_today": api_today,
            "calls_this_month": month_api_total,
            "error_rate_1h": round(error_rate, 2),
            "status_distribution": dict(status_dist),
            "top_endpoints": [{"endpoint": e, "count": c} for e, c in top_endpoints],
            "rate_chart": rate_chart,
        },
        "engagement": {
            "unique_users_today": unique_users_today,
            "hourly_chart": hourly_chart,
        },
        "atlas": {
            "calls_today": atlas_today,
            "calls_this_month": month_atlas_total,
            "language_distribution": atlas_lang_dist,
        },
        "coingecko": {
            "calls_today": cg_today,
            "calls_this_month": month_cg_total,
            "calls_per_hour": cg_per_hour,
            "monthly_limit": 100000,
            "usage_percent": round((month_cg_total / 100000) * 100, 2),
        },
        "database": db_stats,
        "system": {
            "uptime_hours": round(uptime_seconds / 3600, 2),
            "python_version": platform.python_version(),
            "total_tracked_events": len(_api_calls_log),
            "persisted": True,
            "debug_user_ids": list(set(c["user_id"] for c in _api_calls_log[-50:]))[:10],
        },
    }

@router.post("/admin/analytics/track")
async def track_event(event: dict):
    """Track a frontend page view or event."""
    return {"ok": True}

_server_start_time = time.time()
# Thu Jun 25 03:28:48 UTC 2026
