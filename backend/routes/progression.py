"""
Mentova Progression Hub API Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
import os
import logging

from services.progression_service import (
    init_progression, get_progression_hub, award_xp,
    get_xp_history, update_daily_goal_progress, migrate_existing_user,
    compute_metrics, compute_badges,
)

logger = logging.getLogger("progression_routes")
router = APIRouter()
security = HTTPBearer(auto_error=False)

_db = None

def set_progression_deps(db):
    global _db
    _db = db
    init_progression(db)


async def _get_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, os.environ.get("JWT_SECRET", ""), algorithms=["HS256"])
        return payload["user_id"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/progression/hub")
async def progression_hub(lang: str = "fr", user_id: str = Depends(_get_user_id)):
    """Get the complete Progression Hub data."""
    # Auto-migrate if needed
    await migrate_existing_user(user_id)
    data = await get_progression_hub(user_id, lang)
    return {"success": True, **data}


@router.get("/progression/xp-history")
async def xp_history(limit: int = 20, user_id: str = Depends(_get_user_id)):
    """Get XP transaction history."""
    history = await get_xp_history(user_id, limit)
    # Convert datetimes to strings
    for h in history:
        if "created_at" in h and hasattr(h["created_at"], "isoformat"):
            h["created_at"] = h["created_at"].isoformat()
    return {"success": True, "history": history}


@router.get("/progression/badges")
async def all_badges(user_id: str = Depends(_get_user_id)):
    """Get all badges with detailed progress."""
    metrics = await compute_metrics(user_id)
    badges = await compute_badges(user_id, metrics)
    # Group by category
    categories = {}
    for b in badges:
        cat = b["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(b)
    return {"success": True, "badges": badges, "by_category": categories, "earned": sum(1 for b in badges if b["earned"]), "total": len(badges)}


@router.post("/progression/migrate")
async def migrate_user(user_id: str = Depends(_get_user_id)):
    """Manually trigger migration for existing user."""
    result = await migrate_existing_user(user_id)
    return {"success": True, **result}
