"""Admin routes - User management, moderation, stats."""
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Request
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
    
    if badge_level not in ["basic", "verified", "premium"]:
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

async def _send_template_email(user: dict, template: str, lang: str):
    """Internal: send a single template email and log it."""
    from services.email_service import send_caufid_reengagement_email, send_welcome_guide_email, send_progression_update_email
    name = user.get("name", "").split("@")[0] if "@" in user.get("name", "") else user.get("name", "User")
    if template == "caufid_reengagement":
        result = send_caufid_reengagement_email(to_email=user["email"], user_name=name, lang=lang)
    elif template == "welcome_guide":
        result = send_welcome_guide_email(to_email=user["email"], user_name=name, lang=lang)
    elif template == "progression_update":
        result = await send_progression_update_email(to_email=user["email"], user_name=name, user_id=user["id"], lang=lang, db=_db())
    else:
        raise ValueError(f"Unknown template: {template}")
    # Log the email
    await _db().email_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": name,
        "template": template,
        "lang": lang,
        "status": "sent" if result.get("success") else "failed",
        "message_id": result.get("message_id"),
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })
    return result

@router.post("/admin/users/{user_id}/send-caufid-email")
async def admin_send_caufid_email(user_id: str, request: Request, admin_user: dict = Depends(_admin_auth)):
    """Send an email template to a specific user."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    user = await _db().users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    template = body.get("template", "caufid_reengagement")
    lang = body.get("lang", user.get("language", "en") or "en")
    try:
        result = await _send_template_email(user, template, lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email error: {str(e)}")
    if result.get("success"):
        return {"success": True, "message": f"Email [{template}] sent to {user['email']} [{lang}]"}
    raise HTTPException(status_code=500, detail="Failed to send email")

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



# ── Email Analytics ──────────────────────────────────────────────
@router.get("/admin/email-logs")
async def get_email_logs(limit: int = 50, skip: int = 0, template: Optional[str] = None, admin_user: dict = Depends(_admin_auth)):
    """Get email send history."""
    query = {}
    if template:
        query["template"] = template
    cursor = _db().email_logs.find(query, {"_id": 0}).sort("sent_at", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    total = await _db().email_logs.count_documents(query)
    return {"success": True, "data": logs, "total": total}


# ── Email Preview ────────────────────────────────────────────────
@router.get("/admin/email-preview")
async def get_email_preview(template: str = "caufid_reengagement", lang: str = "fr", admin_user: dict = Depends(_admin_auth)):
    """Return HTML preview of an email template."""
    from services.email_service import (
        send_caufid_reengagement_email, send_welcome_guide_email,
        send_progression_update_email, _email_shell
    )
    # Build HTML without sending
    preview_name = "Jean"
    if template == "caufid_reengagement":
        tr = _get_reengagement_translations(preview_name, lang)
        html = _build_reengagement_html(tr)
    elif template == "welcome_guide":
        tr = _get_welcome_translations(preview_name, lang)
        html = _build_welcome_html(tr)
    elif template == "progression_update":
        tr = _get_progression_translations(preview_name, lang, level=3, total_xp=450, modules_completed=5)
        html = _build_progression_html(tr)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown template: {template}")
    return {"success": True, "html": html, "subject": tr.get("subject", "")}


def _get_reengagement_translations(name: str, lang: str) -> dict:
    tr = {
        "fr": {"subject": "Votre parcours Mentova n\u2019attend que vous", "greeting": f"Bonjour {name},",
               "intro": "Je suis Caufid, votre mentor sur Mentova. J\u2019ai remarqu\u00e9 que vous avez cr\u00e9\u00e9 votre compte r\u00e9cemment, mais que nous n\u2019avons pas encore eu l\u2019occasion d\u2019\u00e9changer vraiment.",
               "intro2": "Je voulais prendre un moment pour vous expliquer comment je fonctionne, parce que Mentova n\u2019est pas un simple chatbot.",
               "how_title": "Comment \u00e7a fonctionne\u00a0?",
               "steps": [("On discute ensemble", "Plus on \u00e9change, mieux je comprends votre niveau."),
                         ("Je cr\u00e9e votre profil", "Je note vos connaissances et lacunes."),
                         ("Modules sur mesure", "Des le\u00e7ons adapt\u00e9es \u00e0 votre niveau."),
                         ("Progression suivie", "XP, niveaux, badges, comp\u00e9tences.")],
               "closing": "Tout commence par une simple conversation.",
               "cta": "Discuter avec Caufid", "signoff": "\u00c0 bient\u00f4t,", "sender_name": "Caufid",
               "sender_role": "Votre mentor IA \u2014 Mentova Academy", "footer": "Mentova Academy"},
        "en": {"subject": "Your Mentova journey is waiting for you", "greeting": f"Hello {name},",
               "intro": "I\u2019m Caufid, your mentor on Mentova. I noticed you recently created your account, but we haven\u2019t really talked yet.",
               "intro2": "I wanted to explain how I work, because Mentova isn\u2019t just a simple chatbot.",
               "how_title": "How does it work?",
               "steps": [("We chat together", "The more we exchange, the better I understand your level."),
                         ("I build your profile", "I note your knowledge and gaps."),
                         ("Tailored modules", "Lessons adapted to your level."),
                         ("Progress tracked", "XP, levels, badges, skills.")],
               "closing": "It all starts with a simple conversation.",
               "cta": "Chat with Caufid", "signoff": "See you soon,", "sender_name": "Caufid",
               "sender_role": "Your AI mentor \u2014 Mentova Academy", "footer": "Mentova Academy"},
        "es": {"subject": "Tu camino en Mentova te est\u00e1 esperando", "greeting": f"Hola {name},",
               "intro": "Soy Caufid, tu mentor en Mentova. Not\u00e9 que creaste tu cuenta recientemente.",
               "intro2": "Quer\u00eda explicarte c\u00f3mo funciono, porque Mentova no es un simple chatbot.",
               "how_title": "\u00bfC\u00f3mo funciona?",
               "steps": [("Conversamos juntos", "Cuanto m\u00e1s hablemos, mejor entender\u00e9 tu nivel."),
                         ("Creo tu perfil", "Anoto tus conocimientos y lagunas."),
                         ("M\u00f3dulos a medida", "Lecciones adaptadas a tu nivel."),
                         ("Progreso medido", "XP, niveles, insignias, competencias.")],
               "closing": "Todo empieza con una simple conversaci\u00f3n.",
               "cta": "Hablar con Caufid", "signoff": "Hasta pronto,", "sender_name": "Caufid",
               "sender_role": "Tu mentor IA \u2014 Mentova Academy", "footer": "Mentova Academy"},
    }
    return tr.get(lang, tr["en"])


def _build_reengagement_html(t: dict) -> str:
    step_colors = [("#a78bfa", "rgba(167,139,250,0.15)"), ("#3B82F6", "rgba(59,130,246,0.15)"), ("#10B981", "rgba(16,185,129,0.15)"), ("#F59E0B", "rgba(245,158,11,0.15)")]
    steps_html = ""
    for i, (title, desc) in enumerate(t["steps"]):
        color, bg = step_colors[i]
        steps_html += f'<div style="margin-bottom:12px;"><div style="display:inline-block;width:22px;height:22px;border-radius:6px;background:{bg};text-align:center;line-height:22px;margin-right:8px;vertical-align:top;"><span style="color:{color};font-size:11px;font-weight:700;">{i+1}</span></div><span style="color:#e4e4e7;font-size:13px;font-weight:500;">{title}</span><div style="color:#71717a;font-size:12px;margin-left:30px;">{desc}</div></div>'
    return f'''<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#09090b;color:#e4e4e7;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <div style="padding:24px;border-bottom:1px solid #27272a;"><div style="font-size:16px;font-weight:700;color:#fafafa;">Mentova<span style="color:#a78bfa;">.</span></div></div>
    <div style="padding:24px;">
        <p style="font-size:14px;color:#e4e4e7;margin:0 0 12px;">{t["greeting"]}</p>
        <p style="font-size:13px;color:#a1a1aa;margin:0 0 12px;">{t["intro"]}</p>
        <p style="font-size:13px;color:#a1a1aa;margin:0 0 16px;">{t["intro2"]}</p>
        <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px;margin-bottom:16px;">
            <div style="font-size:13px;font-weight:600;color:#fafafa;margin-bottom:12px;">{t["how_title"]}</div>
            {steps_html}
        </div>
        <p style="font-size:13px;color:#a1a1aa;margin:0 0 16px;">{t["closing"]}</p>
        <div style="text-align:center;margin:20px 0;"><a href="#" style="background:#7C3AED;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block;">{t["cta"]}</a></div>
        <p style="font-size:13px;color:#a1a1aa;margin:16px 0 2px;">{t["signoff"]}</p>
        <p style="font-size:13px;font-weight:600;color:#a78bfa;margin:0;">{t["sender_name"]}</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #27272a;text-align:center;"><p style="font-size:10px;color:#52525b;margin:0;">{t["footer"]}</p></div>
</div>'''


def _get_welcome_translations(name: str, lang: str) -> dict:
    tr = {
        "fr": {"subject": "Bienvenue sur Mentova", "greeting": f"Bienvenue {name},", "sender_role": "Votre mentor IA", "footer": "Mentova Academy",
               "intro": "Je suis Caufid, votre mentor. Je suis l\u00e0 pour vous aider \u00e0 comprendre la finance et la crypto.",
               "title_start": "Par o\u00f9 commencer\u00a0?",
               "features": [("\u2728 Discutez avec moi", "Posez-moi n\u2019importe quelle question."), ("\U0001f4da Modules", "Le\u00e7ons personnalis\u00e9es + quiz."), ("\U0001f4ca Progression", "XP, niveaux, badges.")],
               "cta": "Commencer", "signoff": "\u00c0 bient\u00f4t,"},
        "en": {"subject": "Welcome to Mentova", "greeting": f"Welcome {name},", "sender_role": "Your AI mentor", "footer": "Mentova Academy",
               "intro": "I\u2019m Caufid, your mentor. I\u2019m here to help you understand finance and crypto.",
               "title_start": "Where to start?",
               "features": [("\u2728 Chat with me", "Ask me anything."), ("\U0001f4da Modules", "Personalized lessons + quizzes."), ("\U0001f4ca Progress", "XP, levels, badges.")],
               "cta": "Get started", "signoff": "See you soon,"},
        "es": {"subject": "Bienvenido a Mentova", "greeting": f"Bienvenido {name},", "sender_role": "Tu mentor IA", "footer": "Mentova Academy",
               "intro": "Soy Caufid, tu mentor. Estoy aqu\u00ed para ayudarte a entender finanzas y crypto.",
               "title_start": "\u00bfPor d\u00f3nde empezar?",
               "features": [("\u2728 Conversa conmigo", "Preg\u00fantame lo que quieras."), ("\U0001f4da M\u00f3dulos", "Lecciones personalizadas + quiz."), ("\U0001f4ca Progreso", "XP, niveles, insignias.")],
               "cta": "Empezar", "signoff": "Hasta pronto,"},
    }
    return tr.get(lang, tr["en"])


def _build_welcome_html(t: dict) -> str:
    features_html = ""
    for title, desc in t["features"]:
        features_html += f'<div style="margin-bottom:10px;padding:12px;background:#18181b;border:1px solid #27272a;border-radius:8px;"><span style="font-size:13px;font-weight:600;color:#e4e4e7;">{title}</span><div style="font-size:12px;color:#71717a;margin-top:2px;">{desc}</div></div>'
    return f'''<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#09090b;color:#e4e4e7;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <div style="padding:24px;border-bottom:1px solid #27272a;"><div style="font-size:16px;font-weight:700;color:#fafafa;">Mentova<span style="color:#a78bfa;">.</span></div></div>
    <div style="padding:24px;">
        <p style="font-size:14px;color:#e4e4e7;margin:0 0 12px;">{t["greeting"]}</p>
        <p style="font-size:13px;color:#a1a1aa;margin:0 0 16px;">{t["intro"]}</p>
        <div style="font-size:13px;font-weight:600;color:#fafafa;margin-bottom:10px;">{t["title_start"]}</div>
        {features_html}
        <div style="text-align:center;margin:20px 0;"><a href="#" style="background:#7C3AED;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block;">{t["cta"]}</a></div>
        <p style="font-size:13px;color:#a1a1aa;margin:16px 0 2px;">{t["signoff"]}</p>
        <p style="font-size:13px;font-weight:600;color:#a78bfa;margin:0;">Caufid</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #27272a;text-align:center;"><p style="font-size:10px;color:#52525b;margin:0;">{t["footer"]}</p></div>
</div>'''


def _get_progression_translations(name: str, lang: str, level: int = 1, total_xp: int = 0, modules_completed: int = 0) -> dict:
    tr = {
        "fr": {"subject": f"Votre progression \u2014 Niveau {level}", "greeting": f"Bonjour {name},", "sender_role": "Votre mentor IA", "footer": "Mentova Academy",
               "intro": "Voici un r\u00e9sum\u00e9 de votre progression.",
               "stats": [("Niveau", str(level)), ("XP", str(total_xp)), ("Modules", str(modules_completed))],
               "next": "Continuez en discutant avec moi.", "cta": "Continuer", "signoff": "\u00c0 bient\u00f4t,"},
        "en": {"subject": f"Your progress \u2014 Level {level}", "greeting": f"Hello {name},", "sender_role": "Your AI mentor", "footer": "Mentova Academy",
               "intro": "Here\u2019s a summary of your progress.",
               "stats": [("Level", str(level)), ("XP", str(total_xp)), ("Modules", str(modules_completed))],
               "next": "Continue by chatting with me.", "cta": "Continue", "signoff": "See you soon,"},
        "es": {"subject": f"Tu progreso \u2014 Nivel {level}", "greeting": f"Hola {name},", "sender_role": "Tu mentor IA", "footer": "Mentova Academy",
               "intro": "Aqu\u00ed tienes un resumen de tu progreso.",
               "stats": [("Nivel", str(level)), ("XP", str(total_xp)), ("M\u00f3dulos", str(modules_completed))],
               "next": "Contin\u00faa conversando conmigo.", "cta": "Continuar", "signoff": "Hasta pronto,"},
    }
    return tr.get(lang, tr["en"])


def _build_progression_html(t: dict) -> str:
    stats_html = '<div style="display:flex;gap:8px;margin-bottom:16px;">'
    for label, val in t["stats"]:
        stats_html += f'<div style="flex:1;background:#18181b;border:1px solid #27272a;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#a78bfa;">{val}</div><div style="font-size:10px;color:#71717a;margin-top:2px;">{label}</div></div>'
    stats_html += '</div>'
    return f'''<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#09090b;color:#e4e4e7;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <div style="padding:24px;border-bottom:1px solid #27272a;"><div style="font-size:16px;font-weight:700;color:#fafafa;">Mentova<span style="color:#a78bfa;">.</span></div></div>
    <div style="padding:24px;">
        <p style="font-size:14px;color:#e4e4e7;margin:0 0 12px;">{t["greeting"]}</p>
        <p style="font-size:13px;color:#a1a1aa;margin:0 0 16px;">{t["intro"]}</p>
        {stats_html}
        <p style="font-size:13px;color:#a1a1aa;margin:0 0 16px;">{t["next"]}</p>
        <div style="text-align:center;margin:20px 0;"><a href="#" style="background:#7C3AED;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block;">{t["cta"]}</a></div>
        <p style="font-size:13px;color:#a1a1aa;margin:16px 0 2px;">{t["signoff"]}</p>
        <p style="font-size:13px;font-weight:600;color:#a78bfa;margin:0;">Caufid</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #27272a;text-align:center;"><p style="font-size:10px;color:#52525b;margin:0;">{t["footer"]}</p></div>
</div>'''


# ── Bulk Email Send ──────────────────────────────────────────────
@router.post("/admin/bulk-email/count")
async def bulk_email_count(request: Request, admin_user: dict = Depends(_admin_auth)):
    """Get count of users matching a filter."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    filter_type = body.get("filter", "all")
    query = _build_user_filter(filter_type)
    count = await _db().users.count_documents(query)
    return {"success": True, "count": count, "filter": filter_type}


@router.post("/admin/bulk-email/send")
async def bulk_email_send(request: Request, admin_user: dict = Depends(_admin_auth)):
    """Send an email template to all users matching a filter."""
    import asyncio
    try:
        body = await request.json()
    except Exception:
        body = {}
    filter_type = body.get("filter", "all")
    template = body.get("template", "caufid_reengagement")
    lang = body.get("lang", "fr")
    query = _build_user_filter(filter_type)
    users_cursor = _db().users.find(query, {"_id": 0, "id": 1, "email": 1, "name": 1, "language": 1})
    users_list = await users_cursor.to_list(length=5000)
    sent = 0
    failed = 0
    for u in users_list:
        try:
            await _send_template_email(u, template, lang)
            sent += 1
        except Exception as e:
            logger.error(f"Bulk email failed for {u.get('email')}: {e}")
            failed += 1
            await _db().email_logs.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": u.get("id"),
                "user_email": u.get("email"),
                "user_name": u.get("name", ""),
                "template": template,
                "lang": lang,
                "status": "failed",
                "error": str(e)[:200],
                "sent_at": datetime.now(timezone.utc).isoformat(),
            })
        await asyncio.sleep(0.3)  # rate limit
    return {"success": True, "sent": sent, "failed": failed, "total": len(users_list)}


def _build_user_filter(filter_type: str) -> dict:
    """Build MongoDB query for user filters."""
    now = datetime.now(timezone.utc)
    if filter_type == "inactive_7d":
        cutoff = (now - timedelta(days=7)).isoformat()
        return {"$or": [{"last_active": {"$lt": cutoff}}, {"last_active": {"$exists": False}}], "is_banned": {"$ne": True}}
    elif filter_type == "inactive_30d":
        cutoff = (now - timedelta(days=30)).isoformat()
        return {"$or": [{"last_active": {"$lt": cutoff}}, {"last_active": {"$exists": False}}], "is_banned": {"$ne": True}}
    elif filter_type == "new_48h":
        cutoff = (now - timedelta(hours=48)).isoformat()
        return {"created_at": {"$gte": cutoff}, "is_banned": {"$ne": True}}
    else:  # all
        return {"is_banned": {"$ne": True}}
