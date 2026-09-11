"""
Mentova VIP Permissions Service
Centralized permission system for FREE/VIP plans.
The 6 VIP features: Memory, Chart Analysis, Market Intelligence,
Personalized Learning, Daily Briefing, Advanced Tools.
"""
from typing import Dict, Any
from datetime import datetime, timezone
import logging

logger = logging.getLogger("vip_permissions")

PLANS = {
    "free": {
        "name": "Free",
        "atlas_memory": False,
        "chart_analysis": False,
        "market_intelligence": False,
        "personalized_learning": False,
        "daily_briefing": False,
        "advanced_tools": False,
        "early_access": False,
        "atlas_model": "gpt-5.6-terra",
        "atlas_max_context_messages": 10,
    },
    "vip": {
        "name": "VIP",
        "atlas_memory": True,
        "chart_analysis": True,
        "market_intelligence": True,
        "personalized_learning": True,
        "daily_briefing": True,
        "advanced_tools": True,
        "early_access": True,
        "atlas_model": "gpt-5.6-terra",
        "atlas_max_context_messages": 40,
    },
}

VIP_PRICE_USD = 21.99


def get_user_plan(user: dict) -> str:
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
    plan = get_user_plan(user)
    perms = dict(PLANS.get(plan, PLANS["free"]))
    perms["plan"] = plan
    perms["is_vip"] = plan == "vip"
    return perms


def has_permission(user: dict, permission: str) -> bool:
    return bool(get_permissions(user).get(permission, False))


async def get_user_permissions_response(user: dict, db=None) -> Dict[str, Any]:
    plan = get_user_plan(user)
    perms = get_permissions(user)
    result = {
        "plan": plan,
        "is_vip": perms["is_vip"],
        "atlas_memory": perms["atlas_memory"],
        "chart_analysis": perms["chart_analysis"],
        "market_intelligence": perms["market_intelligence"],
        "personalized_learning": perms["personalized_learning"],
        "daily_briefing": perms["daily_briefing"],
        "advanced_tools": perms["advanced_tools"],
        "early_access": perms["early_access"],
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
