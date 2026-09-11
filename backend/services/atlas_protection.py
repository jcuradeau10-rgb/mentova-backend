"""
Mentova Atlas Usage & Protection Service
Invisible rate limiting, cost tracking, and anti-abuse system.
NO visible quotas. NO message counters. NO "X messages remaining".
"""
import time
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta
from collections import defaultdict

logger = logging.getLogger("atlas_protection")

# ============ CONFIGURABLE THRESHOLDS ============
# All thresholds can be adjusted without changing architecture.

CONFIG = {
    # --- Rate limits (anti-spam, not usage caps) ---
    "free_max_per_minute": 6,
    "free_max_per_hour": 40,
    "free_max_concurrent": 2,
    "vip_max_per_minute": 12,
    "vip_max_per_hour": 80,
    "vip_max_concurrent": 4,

    # --- Burst detection ---
    "burst_window_seconds": 10,
    "burst_max_requests": 4,

    # --- Anomaly detection thresholds ---
    # These are for EXTREME cases only. Normal heavy users should never hit these.
    "free_soft_daily_threshold": 150,   # Log warning, don't block
    "free_hard_daily_threshold": 500,   # Temporary slowdown
    "vip_soft_daily_threshold": 500,    # Log warning
    "vip_hard_daily_threshold": 2000,   # Temporary slowdown

    # --- Cooldown when hard limit hit ---
    "cooldown_seconds": 30,

    # --- Cost estimation (GPT-5.6 Terra approximate pricing) ---
    "cost_per_1k_input_tokens": 0.002,
    "cost_per_1k_output_tokens": 0.008,

    # --- Smart Upgrade Prompt (FREE users only) ---
    # Triggers after sustained usage — not a hard limit, just a soft suggestion.
    "upgrade_prompt_min_total_requests": 15,     # Minimum lifetime requests before considering
    "upgrade_prompt_min_session_requests": 8,    # Requests in current session
    "upgrade_prompt_cooldown_hours": 24,         # Don't show again for 24h after shown

}

# ============ IN-MEMORY TRACKING ============
# Per-user sliding window tracking. Persisted cost data goes to MongoDB.

_user_windows: Dict[str, Dict] = {}
_concurrent: Dict[str, int] = defaultdict(int)


def _get_window(user_id: str) -> dict:
    now = time.time()
    if user_id not in _user_windows:
        _user_windows[user_id] = {
            "requests": [],       # [(timestamp, ...)]
            "day_start": now,
            "day_count": 0,
            "cooldown_until": 0,
        }
    w = _user_windows[user_id]
    # Reset daily counter
    if now - w["day_start"] >= 86400:
        w["day_count"] = 0
        w["day_start"] = now
    # Clean old entries (keep last hour)
    w["requests"] = [t for t in w["requests"] if now - t < 3600]
    return w


def check_request_allowed(user_id: str, is_vip: bool) -> Tuple[bool, Optional[str]]:
    """
    Check if a request should be allowed.
    Returns (allowed, reason_if_blocked).
    Reason is a generic user-facing message — never reveals internals.
    """
    now = time.time()
    w = _get_window(user_id)
    prefix = "vip" if is_vip else "free"

    # Cooldown active?
    if now < w.get("cooldown_until", 0):
        remaining = int(w["cooldown_until"] - now)
        return False, f"Atlas est temporairement indisponible. Reessayez dans {remaining} secondes."

    # Concurrent limit
    max_concurrent = CONFIG[f"{prefix}_max_concurrent"]
    if _concurrent[user_id] >= max_concurrent:
        return False, "Atlas traite deja votre demande. Veuillez patienter."

    # Burst detection (too many in very short window)
    burst_window = CONFIG["burst_window_seconds"]
    recent_burst = [t for t in w["requests"] if now - t < burst_window]
    if len(recent_burst) >= CONFIG["burst_max_requests"]:
        return False, "Veuillez patienter quelques secondes avant de renvoyer un message."

    # Per-minute rate limit
    max_per_min = CONFIG[f"{prefix}_max_per_minute"]
    last_minute = [t for t in w["requests"] if now - t < 60]
    if len(last_minute) >= max_per_min:
        return False, "Atlas est temporairement limite en raison d'un volume de demandes inhabituellement eleve. Veuillez patienter quelques instants."

    # Per-hour rate limit
    max_per_hour = CONFIG[f"{prefix}_max_per_hour"]
    if len(w["requests"]) >= max_per_hour:
        return False, "Atlas est temporairement limite en raison d'un volume de demandes inhabituellement eleve. Veuillez patienter quelques instants."

    # Hard daily threshold (extreme abuse protection)
    hard_threshold = CONFIG[f"{prefix}_hard_daily_threshold"]
    if w["day_count"] >= hard_threshold:
        w["cooldown_until"] = now + CONFIG["cooldown_seconds"]
        logger.warning(f"HARD LIMIT: user={user_id} plan={prefix} daily_count={w['day_count']}")
        return False, "Atlas est temporairement limite en raison d'un volume de demandes inhabituellement eleve. Veuillez patienter quelques instants avant de reessayer."

    # Soft daily threshold (just logging, no blocking)
    soft_threshold = CONFIG[f"{prefix}_soft_daily_threshold"]
    if w["day_count"] >= soft_threshold and w["day_count"] % 50 == 0:
        logger.info(f"HIGH_USAGE: user={user_id} plan={prefix} daily_count={w['day_count']}")

    return True, None


def record_request_start(user_id: str):
    """Call when a request starts processing."""
    now = time.time()
    w = _get_window(user_id)
    w["requests"].append(now)
    w["day_count"] += 1
    _concurrent[user_id] += 1


def record_request_end(user_id: str):
    """Call when a request finishes."""
    _concurrent[user_id] = max(0, _concurrent[user_id] - 1)


def estimate_cost(input_tokens: int, output_tokens: int) -> float:
    """Estimate the cost of a request in USD."""
    input_cost = (input_tokens / 1000) * CONFIG["cost_per_1k_input_tokens"]
    output_cost = (output_tokens / 1000) * CONFIG["cost_per_1k_output_tokens"]
    return round(input_cost + output_cost, 6)


async def log_usage(db, user_id: str, plan: str, input_tokens: int, output_tokens: int,
                    model: str, duration_ms: int, feature: str = "chat",
                    status: str = "success") -> dict:
    """
    Log a usage record to MongoDB for cost analysis.
    This is purely for analytics — never used to block users.
    """
    cost = estimate_cost(input_tokens, output_tokens)
    record = {
        "user_id": user_id,
        "plan": plan,
        "model": model,
        "feature": feature,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "estimated_cost_usd": cost,
        "duration_ms": duration_ms,
        "status": status,
        "created_at": datetime.now(timezone.utc),
    }
    if db is not None:
        try:
            await db.atlas_usage_logs.insert_one(record)
        except Exception as e:
            logger.error(f"Failed to log usage: {e}")
    return record


async def get_usage_stats(db, days: int = 30) -> dict:
    """Get aggregated usage stats for admin dashboard."""
    if db is None:
        return {}
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$plan",
            "total_requests": {"$sum": 1},
            "total_input_tokens": {"$sum": "$input_tokens"},
            "total_output_tokens": {"$sum": "$output_tokens"},
            "total_cost": {"$sum": "$estimated_cost_usd"},
            "unique_users": {"$addToSet": "$user_id"},
            "avg_duration_ms": {"$avg": "$duration_ms"},
        }},
    ]
    try:
        results = {}
        async for doc in db.atlas_usage_logs.aggregate(pipeline):
            plan = doc["_id"] or "unknown"
            results[plan] = {
                "total_requests": doc["total_requests"],
                "total_input_tokens": doc["total_input_tokens"],
                "total_output_tokens": doc["total_output_tokens"],
                "total_cost_usd": round(doc["total_cost"], 4),
                "unique_users": len(doc["unique_users"]),
                "avg_cost_per_user": round(doc["total_cost"] / max(1, len(doc["unique_users"])), 4),
                "avg_duration_ms": round(doc["avg_duration_ms"], 0),
            }
        # Daily breakdown
        daily_pipeline = [
            {"$match": {"created_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "requests": {"$sum": 1},
                "cost": {"$sum": "$estimated_cost_usd"},
            }},
            {"$sort": {"_id": -1}},
            {"$limit": 30},
        ]
        daily = []
        async for doc in db.atlas_usage_logs.aggregate(daily_pipeline):
            daily.append({"date": doc["_id"], "requests": doc["requests"], "cost_usd": round(doc["cost"], 4)})

        # Top users by cost
        top_users_pipeline = [
            {"$match": {"created_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": "$user_id",
                "plan": {"$last": "$plan"},
                "total_requests": {"$sum": 1},
                "total_cost": {"$sum": "$estimated_cost_usd"},
            }},
            {"$sort": {"total_cost": -1}},
            {"$limit": 20},
        ]
        top_users = []
        async for doc in db.atlas_usage_logs.aggregate(top_users_pipeline):
            top_users.append({
                "user_id": doc["_id"],
                "plan": doc["plan"],
                "total_requests": doc["total_requests"],
                "total_cost_usd": round(doc["total_cost"], 4),
            })

        return {
            "period_days": days,
            "by_plan": results,
            "daily": daily,
            "top_users": top_users,
        }
    except Exception as e:
        logger.error(f"Usage stats error: {e}")
        return {"error": str(e)}


def get_protection_config() -> dict:
    """Return current protection config (for admin viewing/adjustment)."""
    return dict(CONFIG)


def update_protection_config(updates: dict) -> dict:
    """Update protection config at runtime (admin only)."""
    for key, value in updates.items():
        if key in CONFIG and isinstance(value, (int, float)):
            CONFIG[key] = value
            logger.info(f"Protection config updated: {key}={value}")
    return dict(CONFIG)


# ============ SMART UPGRADE PROMPT ============
# Invisible trigger for FREE → VIP conversion. Never reveals thresholds.

_upgrade_prompt_shown: Dict[str, float] = {}  # user_id -> last shown timestamp


async def should_show_upgrade_prompt(user_id: str, db) -> bool:
    """
    Determine if a FREE user should see a VIP upgrade suggestion.
    Based on sustained usage patterns — not a fixed message count.
    Returns True if the prompt should be shown.
    """
    now = time.time()

    # Don't show if recently shown
    last_shown = _upgrade_prompt_shown.get(user_id, 0)
    cooldown_h = CONFIG.get("upgrade_prompt_cooldown_hours", 24)
    if now - last_shown < cooldown_h * 3600:
        return False

    # Check in-memory session usage
    w = _get_window(user_id)
    session_requests = w["day_count"]
    min_session = CONFIG.get("upgrade_prompt_min_session_requests", 8)
    if session_requests < min_session:
        return False

    # Check total lifetime usage from DB
    if db is not None:
        try:
            total = await db.atlas_usage_logs.count_documents({"user_id": user_id})
            min_total = CONFIG.get("upgrade_prompt_min_total_requests", 15)
            if total < min_total:
                return False
        except Exception:
            return False

    return True


def mark_upgrade_prompt_shown(user_id: str):
    """Record that the upgrade prompt was shown to this user."""
    _upgrade_prompt_shown[user_id] = time.time()

