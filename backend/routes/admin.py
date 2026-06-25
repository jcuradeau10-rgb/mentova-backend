"""Admin routes - User management, moderation, stats."""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.security import HTTPBearer

import logging
logger = logging.getLogger("server")

_deps = {}

import jwt

JWT_SECRET = os.environ.get('JWT_SECRET', 'mentova-secret-key-2026')

def set_admin_deps(database):
    _deps['db'] = database

def _db():
    return _deps.get('db')

async def _admin_auth(credentials = Depends(HTTPBearer())):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await _db().users.find_one({"id": payload["user_id"]})
        if not user: raise HTTPException(status_code=401, detail="User not found")
        if user.get("role") not in ["admin", "super_admin"]:
            raise HTTPException(status_code=403, detail="Admin access only")
        return user
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def _super_admin_auth(credentials = Depends(HTTPBearer())):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await _db().users.find_one({"id": payload["user_id"]})
        if not user: raise HTTPException(status_code=401, detail="User not found")
        if user.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Super admin only")
        return user
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


from pydantic import BaseModel

class PromoteUserRequest(BaseModel):
    role: str

class BanUserRequest(BaseModel):
    reason: Optional[str] = None

router = APIRouter()

# ==================== ADMIN ROUTES ====================

@router.get("/admin/users")
async def get_all_users(
    admin_user: dict = Depends(_admin_auth),
    search: Optional[str] = None,
    role_filter: Optional[str] = None,
    banned_only: bool = False,
    limit: int = 50,
    skip: int = 0
):
    """Get all users (admin only)"""
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    if role_filter:
        query["role"] = role_filter
    if banned_only:
        query["is_banned"] = True
    
    users = await _db().users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await _db().users.count_documents(query)
    
    return {
        "success": True,
        "data": users,
        "total": total,
        "has_more": skip + limit < total
    }

@router.get("/admin/users/{user_id}")
async def get_user_detail(user_id: str, admin_user: dict = Depends(_admin_auth)):
    """Get detailed user information"""
    user = await _db().users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's posts count
    posts_count = await _db().community_posts.count_documents({"author_id": user_id})
    comments_count = await _db().community_comments.count_documents({"author_id": user_id})
    
    return {
        "success": True,
        "data": {
            **user,
            "posts_count": posts_count,
            "comments_count": comments_count
        }
    }

@router.put("/admin/users/{user_id}/promote")
async def promote_user(
    user_id: str, 
    request: PromoteUserRequest,
    super_admin: dict = Depends(_super_admin_auth)
):
    """Promote user to admin or super_admin (super_admin only)"""
    if request.role not in ["admin", "super_admin", "user"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    user = await _db().users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot demote yourself
    if user["id"] == super_admin["id"] and request.role != "super_admin":
        raise HTTPException(status_code=400, detail="You cannot demote yourself")
    
    await _db().users.update_one({"id": user_id}, {"$set": {"role": request.role}})
    
    return {
        "success": True,
        "message": f"Utilisateur promu au rôle '{request.role}'"
    }

@router.put("/admin/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    request: BanUserRequest,
    admin_user: dict = Depends(_admin_auth)
):
    """Ban a user (admin or super_admin)"""
    user = await _db().users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot ban admins unless you're super_admin
    if user.get("role") in ["admin", "super_admin"]:
        if admin_user.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Seul un super admin peut bannir un admin")
    
    # Cannot ban yourself
    if user["id"] == admin_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot ban yourself")
    
    await _db().users.update_one(
        {"id": user_id}, 
        {
            "$set": {
                "is_banned": True,
                "banned_at": datetime.utcnow(),
                "banned_by": admin_user["id"],
                "ban_reason": request.reason
            }
        }
    )
    
    return {
        "success": True,
        "message": "Utilisateur banni avec succès"
    }

@router.put("/admin/users/{user_id}/unban")
async def unban_user(user_id: str, admin_user: dict = Depends(_admin_auth)):
    """Unban a user"""
    user = await _db().users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await _db().users.update_one(
        {"id": user_id},
        {
            "$set": {"is_banned": False},
            "$unset": {"banned_at": "", "banned_by": "", "ban_reason": ""}
        }
    )
    
    return {
        "success": True,
        "message": "Utilisateur débanni avec succès"
    }

@router.put("/admin/users/{user_id}/set-vip")
async def admin_set_vip(
    user_id: str, 
    is_vip: bool,
    months: int = 1,
    super_admin: dict = Depends(_super_admin_auth)
):
    """Set VIP status for a user (super_admin only)"""
    user = await _db().users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if is_vip:
        # Set VIP with expiration
        vip_expires = datetime.now(timezone.utc) + timedelta(days=30 * months)
        await _db().users.update_one(
            {"id": user_id},
            {"$set": {"is_vip": True, "vip_expires_at": vip_expires.isoformat()}}
        )
        message = f"Statut VIP activé pour {months} mois"
    else:
        # Remove VIP
        await _db().users.update_one(
            {"id": user_id},
            {"$set": {"is_vip": False}, "$unset": {"vip_expires_at": ""}}
        )
        message = "Statut VIP retiré"
    
    # Log the action
    await _db().admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": f"set_vip_{is_vip}",
        "target_id": user_id,
        "target_type": "user",
        "admin_id": super_admin["id"],
        "admin_name": super_admin["name"],
        "details": {"is_vip": is_vip, "months": months if is_vip else 0},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": message}

@router.put("/admin/users/{user_id}/set-pro")
async def admin_set_pro(
    user_id: str,
    is_pro: bool,
    badge_level: str = "basic",
    super_admin: dict = Depends(_super_admin_auth)
):
    """Set Professional status for a user (super_admin only)"""
    user = await _db().users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if badge_level not in [PRO_BADGE_BASIC, PRO_BADGE_VERIFIED, PRO_BADGE_PREMIUM]:
        raise HTTPException(status_code=400, detail="Niveau de badge invalide")
    
    if is_pro:
        # Set as professional
        await _db().users.update_one(
            {"id": user_id},
            {"$set": {"is_professional": True, "pro_badge": badge_level}}
        )
        
        # Create pro profile if doesn't exist
        existing_profile = await _db().pro_profiles.find_one({"user_id": user_id})
        if not existing_profile:
            await _db().pro_profiles.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "display_name": user.get("name", "Professional"),
                "bio": "Certified professional by the Mentova team",
                "main_expertise": "trading",
                "specializations": [],
                "languages": ["Français"],
                "country": "France",
                "badge_level": badge_level,
                "hourly_rate": 50,
                "services_offered": [],
                "total_sessions": 0,
                "total_reviews": 0,
                "total_earnings": 0,
                "available_earnings": 0,
                "average_rating": 0,
                "is_available": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        else:
            await _db().pro_profiles.update_one(
                {"user_id": user_id},
                {"$set": {"badge_level": badge_level}}
            )
        
        message = f"Statut Pro activé avec badge {badge_level}"
    else:
        # Remove professional status
        await _db().users.update_one(
            {"id": user_id},
            {"$set": {"is_professional": False}, "$unset": {"pro_badge": ""}}
        )
        message = "Statut Pro retiré"
    
    # Log the action
    await _db().admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": f"set_pro_{is_pro}",
        "target_id": user_id,
        "target_type": "user",
        "admin_id": super_admin["id"],
        "admin_name": super_admin["name"],
        "details": {"is_pro": is_pro, "badge_level": badge_level if is_pro else None},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": message}

@router.delete("/admin/posts/{post_id}")
async def admin_delete_post(post_id: str, admin_user: dict = Depends(_admin_auth)):
    """Delete a post (admin only)"""
    post = await _db().community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Delete the post
    await _db().community_posts.delete_one({"id": post_id})
    
    # Delete all related comments
    await _db().community_comments.delete_many({"post_id": post_id})
    
    # Delete all related votes
    await _db().community_votes.delete_many({"post_id": post_id})
    
    # Log the action
    await _db().admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "delete_post",
        "target_id": post_id,
        "target_type": "post",
        "admin_id": admin_user["id"],
        "admin_name": admin_user["name"],
        "timestamp": datetime.utcnow()
    })
    
    return {
        "success": True,
        "message": "Publication supprimée avec succès"
    }

@router.delete("/admin/comments/{comment_id}")
async def admin_delete_comment(comment_id: str, admin_user: dict = Depends(_admin_auth)):
    """Delete a comment (admin only)"""
    comment = await _db().community_comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Delete the comment
    await _db().community_comments.delete_one({"id": comment_id})
    
    # Delete related votes
    await _db().community_votes.delete_many({"comment_id": comment_id})
    
    # Log the action
    await _db().admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "delete_comment",
        "target_id": comment_id,
        "target_type": "comment",
        "admin_id": admin_user["id"],
        "admin_name": admin_user["name"],
        "timestamp": datetime.utcnow()
    })
    
    return {
        "success": True,
        "message": "Commentaire supprimé avec succès"
    }

@router.get("/admin/posts")
async def get_admin_posts(
    admin_user: dict = Depends(_admin_auth),
    search: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all posts with admin info"""
    query = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
    
    posts = await _db().community_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await _db().community_posts.count_documents(query)
    
    # Enrich posts with author info
    enriched_posts = []
    for post in posts:
        author = await _db().users.find_one({"id": post["author_id"]}, {"_id": 0, "password_hash": 0})
        comments_count = await _db().community_comments.count_documents({"post_id": post["id"]})
        post_data = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in post.items()}
        enriched_posts.append({
            **post_data,
            "author_name": author["name"] if author else "Supprimé",
            "author_email": author["email"] if author else "N/A",
            "comments_count": comments_count
        })
    
    return {
        "success": True,
        "data": enriched_posts,
        "total": total,
        "has_more": skip + limit < total
    }

@router.get("/admin/logs")
async def get_admin_logs(
    admin_user: dict = Depends(_admin_auth),
    limit: int = 50,
    skip: int = 0
):
    """Get admin action logs"""
    logs = await _db().admin_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await _db().admin_logs.count_documents({})
    
    # Convert datetime to string
    formatted_logs = []
    for log in logs:
        log_data = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in log.items()}
        formatted_logs.append(log_data)
    
    return {
        "success": True,
        "data": formatted_logs,
        "total": total
    }

@router.get("/admin/stats")
async def get_admin_stats(admin_user: dict = Depends(_admin_auth)):
    """Get admin statistics with trends for charts"""
    from datetime import timedelta
    
    now = datetime.utcnow()
    
    # Get total counts
    total_users = await _db().users.count_documents({})
    active_users = await _db().users.count_documents({"is_banned": {"$ne": True}})
    banned_users = await _db().users.count_documents({"is_banned": True})
    admin_count = await _db().users.count_documents({"role": {"$in": ["admin", "super_admin"]}})
    total_posts = await _db().community_posts.count_documents({})
    total_comments = await _db().community_comments.count_documents({})
    
    # Calculate votes
    posts_cursor = _db().community_posts.find({}, {"votes": 1})
    total_votes = 0
    async for post in posts_cursor:
        total_votes += post.get("votes", 0)
    
    # Generate trend data for last 7 days
    daily_registrations = []
    daily_posts = []
    daily_activity = []
    
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        # Count registrations for this day
        reg_count = await _db().users.count_documents({
            "created_at": {"$gte": day_start, "$lt": day_end}
        })
        daily_registrations.append({
            "date": day_start.strftime("%d/%m"),
            "day": day_start.strftime("%a"),
            "count": reg_count
        })
        
        # Count posts for this day
        post_count = await _db().community_posts.count_documents({
            "created_at": {"$gte": day_start, "$lt": day_end}
        })
        daily_posts.append({
            "date": day_start.strftime("%d/%m"),
            "day": day_start.strftime("%a"),
            "count": post_count
        })
        
        # Count comments for this day
        comment_count = await _db().community_comments.count_documents({
            "created_at": {"$gte": day_start, "$lt": day_end}
        })
        daily_activity.append({
            "date": day_start.strftime("%d/%m"),
            "day": day_start.strftime("%a"),
            "posts": post_count,
            "comments": comment_count,
            "total": post_count + comment_count
        })
    
    # Role distribution
    user_count = await _db().users.count_documents({"role": "user"})
    admin_only = await _db().users.count_documents({"role": "admin"})
    super_admin_count = await _db().users.count_documents({"role": "super_admin"})
    
    role_distribution = [
        {"role": "user", "count": user_count, "label": "Utilisateurs"},
        {"role": "admin", "count": admin_only, "label": "Admins"},
        {"role": "super_admin", "count": super_admin_count, "label": "Super Admins"},
    ]
    
    # Post categories distribution
    categories = await _db().community_posts.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    category_distribution = [
        {"category": cat["_id"] or "autre", "count": cat["count"]}
        for cat in categories
    ]
    
    return {
        "success": True,
        "data": {
            "overview": {
                "total_users": total_users,
                "active_users": active_users,
                "banned_users": banned_users,
                "admin_count": admin_count,
                "total_posts": total_posts,
                "total_comments": total_comments,
                "total_votes": total_votes
            },
            "trends": {
                "daily_registrations": daily_registrations,
                "daily_posts": daily_posts,
                "daily_activity": daily_activity
            },
            "distributions": {
                "roles": role_distribution,
                "categories": category_distribution
            }
        }
    }

