"""
Mentova VIP Permissions Service
Centralized permission system for FREE/VIP plans.
All permission checks go through this module — never check plan status directly.
"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger("vip_permissions")

# ============ PLAN DEFINITIONS ============
# Easily extensible: add new plans here

PLANS = {
    "free": {
        "name": "Free",
        "atlas_premium": False,
        "atlas_memory": False,
        "atlas_personalization": False,
        "daily_briefing": False,
        "chart_analysis": False,
        "real_time_crypto_in_atlas": False,
        "real_time_news_in_atlas": False,
        "professional_tools": False,
        "premium_learning": False,
        "atlas_model": "gpt-5.6-terra",
        "atlas_max_context_messages": 10,
        "atlas_system_tier": "free",
    },
    "vip": {
        "name": "VIP",
        "atlas_premium": True,
        "atlas_memory": True,
        "atlas_personalization": True,
        "daily_briefing": True,
        "chart_analysis": True,
        "real_time_crypto_in_atlas": True,
        "real_time_news_in_atlas": True,
        "professional_tools": True,
        "premium_learning": True,
        "atlas_model": "gpt-5.6-terra",
        "atlas_max_context_messages": 40,
        "atlas_system_tier": "vip",
    },
}

VIP_PRICE_USD = 21.99


def get_user_plan(user: dict) -> str:
    """Determine the user's current plan from their DB record. Backend is source of truth."""
    if not user:
        return "free"
    if user.get("vip_permanent"):
        return "vip"
    if not user.get("is_vip"):
        return "free"
    vip_expires = user.get("vip_expires_at")
    if vip_expires:
        if isinstance(vip_expires, str):
            try:
                vip_expires = datetime.fromisoformat(vip_expires.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                return "free"
        if isinstance(vip_expires, datetime):
            now = datetime.now(timezone.utc)
            if vip_expires.tzinfo is None:
                vip_expires = vip_expires.replace(tzinfo=timezone.utc)
            if vip_expires < now:
                return "free"
    return "vip"


def get_permissions(user: dict) -> Dict[str, Any]:
    """Return the full permission set for a user."""
    plan = get_user_plan(user)
    perms = dict(PLANS.get(plan, PLANS["free"]))
    perms["plan"] = plan
    perms["is_vip"] = plan == "vip"
    return perms


def has_permission(user: dict, permission: str) -> bool:
    """Check a single permission for a user."""
    perms = get_permissions(user)
    return bool(perms.get(permission, False))


def get_plan_config(plan: str) -> dict:
    """Get raw plan configuration."""
    return dict(PLANS.get(plan, PLANS["free"]))


async def get_user_permissions_response(user: dict, db=None) -> Dict[str, Any]:
    """Build the API response for /vip/permissions endpoint."""
    plan = get_user_plan(user)
    perms = get_permissions(user)

    result = {
        "plan": plan,
        "is_vip": perms["is_vip"],
        "atlas_premium": perms["atlas_premium"],
        "atlas_memory": perms["atlas_memory"],
        "atlas_personalization": perms["atlas_personalization"],
        "daily_briefing": perms["daily_briefing"],
        "chart_analysis": perms["chart_analysis"],
        "real_time_crypto_in_atlas": perms["real_time_crypto_in_atlas"],
        "real_time_news_in_atlas": perms["real_time_news_in_atlas"],
        "professional_tools": perms["professional_tools"],
        "premium_learning": perms["premium_learning"],
    }

    if plan == "vip":
        vip_expires = user.get("vip_expires_at")
        if vip_expires and not user.get("vip_permanent"):
            if isinstance(vip_expires, str):
                try:
                    vip_expires = datetime.fromisoformat(vip_expires.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    vip_expires = None
            if isinstance(vip_expires, datetime):
                now = datetime.now(timezone.utc)
                if vip_expires.tzinfo is None:
                    vip_expires = vip_expires.replace(tzinfo=timezone.utc)
                result["vip_expires_at"] = vip_expires.isoformat()
                result["days_remaining"] = max(0, (vip_expires - now).days)
            else:
                result["vip_expires_at"] = None
                result["days_remaining"] = None
        else:
            result["vip_expires_at"] = None
            result["days_remaining"] = "unlimited" if user.get("vip_permanent") else None

    return result
