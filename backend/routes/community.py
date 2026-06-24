"""Community routes - Forum posts, comments, likes, bookmarks, reports, leaderboard."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from fastapi.security import HTTPBearer
from pydantic import BaseModel

import os
import logging
from pathlib import Path

logger = logging.getLogger("server")

# Shared state - injected by server.py via set_community_deps()
_deps = {}

def set_community_deps(database, get_current_user_fn, send_notification_fn, uploads_dir):
    _deps['db'] = database
    _deps['get_current_user'] = get_current_user_fn
    _deps['send_notification'] = send_notification_fn
    _deps['uploads_dir'] = uploads_dir

# Accessors
def _db():
    return _deps.get('db')

async def _auth(credentials = Depends(HTTPBearer())):
    fn = _deps.get('get_current_user')
    if fn is None:
        raise HTTPException(status_code=500, detail="Auth not configured")
    return await fn(credentials)

async def _notify(user_id, body, notif_type, data=None, title=None):
    fn = _deps.get('send_notification')
    if fn:
        await fn(user_id, body, notif_type, data, title)

router = APIRouter()


# ==================== COMMUNITY DATA ====================

COMMUNITY_CATEGORIES = [
    {"id": "debutants", "name": "Débutants", "icon": "school-outline", "color": "#00D9A5", "description": "Questions de base pour commencer"},
    {"id": "trading", "name": "Trading", "icon": "trending-up", "color": "#7C3AED", "description": "Stratégies et techniques de trading"},
    {"id": "bitcoin-ethereum", "name": "Bitcoin & Ethereum", "icon": "logo-bitcoin", "color": "#F7931A", "description": "Discussions sur BTC et ETH"},
    {"id": "altcoins", "name": "Altcoins & Memecoins", "icon": "rocket-outline", "color": "#FF6B35", "description": "Autres cryptomonnaies"},
    {"id": "securite", "name": "Sécurité & Scams", "icon": "shield-checkmark-outline", "color": "#FF4757", "description": "Protection et arnaques à éviter"},
    {"id": "analyse", "name": "Analyse de Projets", "icon": "analytics-outline", "color": "#3498DB", "description": "Évaluation de projets crypto"},
    {"id": "outils", "name": "Outils & Plateformes", "icon": "construct-outline", "color": "#9B59B6", "description": "Exchanges, wallets, apps"},
    {"id": "general", "name": "Discussions Générales", "icon": "chatbubbles-outline", "color": "#8B8B9E", "description": "Tout le reste"}
]

WIKI_ARTICLES = [
    {"id": "what-is-bitcoin", "title": "Qu\'est-ce que Bitcoin ?", "category": "debutants", "content": "Bitcoin est la première cryptomonnaie décentralisée, créée en 2009 par Satoshi Nakamoto.", "tags": ["bitcoin", "base", "blockchain"]},
    {"id": "what-is-blockchain", "title": "C\'est quoi la Blockchain ?", "category": "debutants", "content": "La blockchain est un registre numérique distribué.", "tags": ["blockchain", "base", "technologie"]},
    {"id": "how-to-buy-crypto", "title": "Comment acheter sa première crypto ?", "category": "debutants", "content": "Choisissez une plateforme, créez un compte, déposez des fonds, achetez.", "tags": ["achat", "exchange", "débutant"]},
    {"id": "common-scams", "title": "Comment éviter les arnaques ?", "category": "securite", "content": "DYOR, ne partagez jamais vos clés privées, méfiez-vous des promesses de gains garantis.", "tags": ["scam", "sécurité", "protection"]},
    {"id": "what-is-wallet", "title": "Qu\'est-ce qu\'un Wallet crypto ?", "category": "debutants", "content": "Un wallet crypto stocke, envoie et reçoit des cryptomonnaies. Hot wallet ou Cold wallet.", "tags": ["wallet", "sécurité", "stockage"]},
    {"id": "dca-strategy", "title": "La stratégie DCA expliquée", "category": "trading", "content": "DCA = Investir un montant fixe à intervalles réguliers.", "tags": ["DCA", "stratégie", "investissement"]},
]


# ==================== COMMUNITY MODELS ====================

class PostCreate(BaseModel):
    title: Optional[str] = None
    content: str
    category: str = "general"
    image_url: Optional[str] = None

class CommentCreate(BaseModel):
    content: str

class VoteCreate(BaseModel):
    vote_type: str

class ReportCreate(BaseModel):
    reason: str


# ==================== COMMUNITY ROUTES ====================

@router.get("/community/categories")
async def get_community_categories():
    """Get all community categories"""
    return {"success": True, "data": COMMUNITY_CATEGORIES}

@router.get("/community/wiki")
async def get_wiki_articles():
    """Get all wiki articles"""
    return {"success": True, "data": WIKI_ARTICLES}

@router.get("/community/wiki/{article_id}")
async def get_wiki_article(article_id: str):
    """Get a specific wiki article"""
    article = next((a for a in WIKI_ARTICLES if a["id"] == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return {"success": True, "data": article}

@router.get("/community/posts")
async def get_community_posts(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "recent",
    language: Optional[str] = None,
    limit: int = 20,
    skip: int = 0
):
    """Get community posts with optional filters"""
    query = {}
    if category and category != "all":
        query["category"] = category
    if language and language != "all":
        query["language"] = language
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]
    
    # Sorting
    if sort_by == "popular":
        sort_field = [("votes", -1), ("created_at", -1)]
    elif sort_by == "trending":
        # Trending = recent posts with high engagement
        one_week_ago = datetime.utcnow() - timedelta(days=7)
        query["created_at"] = {"$gte": one_week_ago}
        sort_field = [("votes", -1), ("created_at", -1)]
    else:  # recent
        sort_field = [("created_at", -1)]
    
    posts = await _db().community_posts.find(query, {"_id": 0}).sort(sort_field).skip(skip).limit(limit).to_list(limit)
    total = await _db().community_posts.count_documents(query)
    
    # Enrich with author names, avatar, VIP status and comments count
    enriched_posts = []
    for post in posts:
        author = await _db().users.find_one({"id": post["author_id"]}, {"_id": 0})
        comments_count = await _db().community_comments.count_documents({"post_id": post["id"]})
        
        # Serialize datetime
        post_data = {}
        for k, v in post.items():
            if isinstance(v, datetime):
                post_data[k] = v.isoformat()
            else:
                post_data[k] = v
        
        enriched_posts.append({
            **post_data,
            "author_name": author["name"] if author else "Utilisateur supprimé",
            "author_avatar": author.get("avatar_url") if author else None,
            "author_is_vip": author.get("is_vip", False) if author else False,
            "comments_count": comments_count,
            "likes": post.get("likes", [])
        })
    
    return {
        "success": True,
        "data": enriched_posts,
        "total": total,
        "has_more": skip + limit < total
    }

@router.post("/community/posts/{post_id}/like")
async def like_community_post(
    post_id: str,
    current_user: dict = Depends(_auth)
):
    """Like or unlike a post"""
    post = await _db().community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = post.get("likes", [])
    user_id = current_user["id"]
    
    if user_id in likes:
        # Unlike
        likes.remove(user_id)
        action = "unliked"
    else:
        # Like
        likes.append(user_id)
        action = "liked"
    
    await _db().community_posts.update_one(
        {"id": post_id},
        {"$set": {"likes": likes}}
    )
    
    # Send notification to post author on like (not self-like)
    if action == "liked" and post.get("author_id") != user_id:
        liker_name = current_user.get("name", "Quelqu'un")
        await _notify(
            post["author_id"],
            f"{liker_name} a aimé votre publication",
            "post_like",
            {"post_id": post_id},
            "❤️ Nouveau like"
        )
    
    return {
        "success": True,
        "action": action,
        "likes_count": len(likes),
        "liked_by_user": user_id in likes
    }

@router.delete("/community/posts/{post_id}")
async def delete_community_post(
    post_id: str,
    current_user: dict = Depends(_auth)
):
    """Delete a post - only by creator, admin or super_admin"""
    post = await _db().community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check permissions
    user_role = current_user.get("role", "user")
    is_creator = post["author_id"] == current_user["id"]
    is_admin = user_role in ["admin", "super_admin"]
    
    if not is_creator and not is_admin:
        raise HTTPException(status_code=403, detail="Vous n'avez pas la permission de supprimer cette publication")
    
    # Delete post and its comments
    await _db().community_posts.delete_one({"id": post_id})
    await _db().community_comments.delete_many({"post_id": post_id})
    
    return {
        "success": True,
        "message": "Publication supprimée avec succès"
    }

@router.post("/community/posts/{post_id}/bookmark")
async def bookmark_community_post(
    post_id: str,
    current_user: dict = Depends(_auth)
):
    """Bookmark or unbookmark a post"""
    post = await _db().community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    user_id = current_user["id"]
    
    # Check if already bookmarked
    existing_bookmark = await _db().bookmarks.find_one({
        "user_id": user_id,
        "post_id": post_id
    })
    
    if existing_bookmark:
        # Remove bookmark
        await _db().bookmarks.delete_one({"user_id": user_id, "post_id": post_id})
        action = "unbookmarked"
    else:
        # Add bookmark
        await _db().bookmarks.insert_one({
            "user_id": user_id,
            "post_id": post_id,
            "created_at": datetime.utcnow()
        })
        action = "bookmarked"
    
    return {
        "success": True,
        "action": action
    }

@router.get("/community/bookmarks")
async def get_user_bookmarks(
    current_user: dict = Depends(_auth)
):
    """Get user's bookmarked posts"""
    bookmarks = await _db().bookmarks.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    post_ids = [b["post_id"] for b in bookmarks]
    posts = []
    
    for post_id in post_ids:
        post = await _db().community_posts.find_one({"id": post_id}, {"_id": 0})
        if post:
            author = await _db().users.find_one({"id": post["author_id"]}, {"_id": 0})
            post_data = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in post.items()}
            posts.append({
                **post_data,
                "author_name": author["name"] if author else "Utilisateur supprimé",
                "author_avatar": author.get("avatar_url") if author else None,
                "author_is_vip": author.get("is_vip", False) if author else False,
            })
    
    return {
        "success": True,
        "data": posts
    }

class ImageUploadRequest(BaseModel):
    image_base64: str
    filename: Optional[str] = None

@router.post("/upload/image")
async def upload_image(
    request: ImageUploadRequest,
    current_user: dict = Depends(_auth)
):
    """Upload an image and return its URL"""
    try:
        # Decode base64 image
        image_data = request.image_base64
        
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode
        image_bytes = base64.b64decode(image_data)
        
        # Generate unique filename
        file_ext = 'jpg'
        if request.filename:
            ext = request.filename.split('.')[-1].lower()
            if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                file_ext = ext
        
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = _deps.get('uploads_dir', Path('uploads')) / unique_filename
        
        # Save file
        with open(file_path, 'wb') as f:
            f.write(image_bytes)
        
        # Return URL (using the API base URL)
        image_url = f"/api/uploads/{unique_filename}"
        
        return {
            "success": True,
            "url": image_url,
            "filename": unique_filename
        }
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'upload: {str(e)}")

@router.post("/pro/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(_auth)
):
    """Upload a file (PDF, etc.) and return its URL"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Mentors only")
    
    allowed_extensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv', 'mp3', 'mp4', 'wav', 'jpg', 'jpeg', 'png', 'gif', 'webp']
    file_ext = file.filename.split('.')[-1].lower() if file.filename else ''
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Type de fichier non supporté: .{file_ext}")
    
    # Limit file size to 50MB
    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must not exceed 50 MB")
    
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = _deps.get('uploads_dir', Path('uploads')) / unique_filename
    
    with open(file_path, 'wb') as f:
        f.write(contents)
    
    file_url = f"/api/uploads/{unique_filename}"
    
    return {
        "success": True,
        "url": file_url,
        "filename": file.filename,
        "size": len(contents)
    }



@router.post("/community/posts")
async def create_community_post(
    content: str = Form(...),
    category: str = Form("general"),
    title: str = Form(None),
    image: UploadFile = File(None),
    current_user: dict = Depends(_auth)
):
    """Create a new community post (FormData)"""
    post_content = content
    post_category = category or "general"
    post_title = title
    post_image_url = None
    
    if not post_content or not post_content.strip():
        raise HTTPException(status_code=400, detail="Content is required")

    # Auto-generate title from content if not provided
    if not post_title:
        post_title = post_content[:80].split('\n')[0]
    
    # Handle image upload
    if image and image.filename:
        try:
            img_id = str(uuid.uuid4())
            ext = image.filename.split('.')[-1] if '.' in image.filename else 'jpg'
            img_path = f"uploads/{img_id}.{ext}"
            with open(img_path, "wb") as f:
                f.write(await image.read())
            post_image_url = f"/api/uploads/{img_id}.{ext}"
        except Exception as e:
            logger.error(f"Image upload error: {e}")
    # Auto-detect language from content
    def detect_language(text: str) -> str:
        t = text.lower()
        fr_words = ['je', 'tu', 'il', 'elle', 'nous', 'vous', 'les', 'des', 'une', 'que', 'qui', 'est', 'dans', 'pour', 'pas', 'sur', 'avec', 'mais', 'sont', 'cette', 'mon', 'ton', 'son', 'bonjour', 'salut', 'merci', 'comment', 'pourquoi', 'quoi', "c'est", "j'ai", "n'est"]
        es_words = ['el', 'ella', 'nosotros', 'ustedes', 'los', 'las', 'una', 'que', 'quien', 'esta', 'pero', 'como', 'porque', 'hola', 'gracias', 'tengo', 'puede', 'este', 'esta', 'estos', 'tambien', 'muy', 'por']
        en_words = ['the', 'is', 'are', 'was', 'were', 'have', 'has', 'been', 'this', 'that', 'with', 'from', 'they', 'would', 'could', 'should', 'about', 'just', 'your', 'what', 'when', 'how', 'which', "i'm", "don't", "can't"]
        words = t.split()
        fr_count = sum(1 for w in words if w in fr_words)
        es_count = sum(1 for w in words if w in es_words)
        en_count = sum(1 for w in words if w in en_words)
        if fr_count > en_count and fr_count > es_count: return 'fr'
        if es_count > en_count and es_count > fr_count: return 'es'
        return 'en'

    detected_lang = detect_language(post_content)
    post_id = str(uuid.uuid4())
    created_at = datetime.utcnow()
    post_doc = {
        "id": post_id,
        "title": post_title,
        "content": post_content,
        "category": post_category,
        "image_url": post_image_url,
        "author_id": current_user["id"],
        "language": detected_lang,
        "votes": 0,
        "likes": [],
        "created_at": created_at,
        "updated_at": created_at,
        "is_pinned": False
    }
    await _db().community_posts.insert_one(post_doc)
    
    # Update user's community score
    await _db().users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"community_score": 5}}
    )
    
    return {
        "success": True,
        "data": {
            "id": post_id,
            "title": post_title,
            "content": post_content,
            "category": post_category,
            "image_url": post_image_url,
            "author_id": current_user["id"],
            "author_name": current_user["name"],
            "author_avatar": current_user.get("avatar_url"),
            "author_is_vip": current_user.get("is_vip", False),
            "votes": 0,
            "likes": [],
            "comments_count": 0,
            "created_at": created_at.isoformat(),
            "is_pinned": False
        }
    }

@router.get("/community/posts/{post_id}")
async def get_community_post(post_id: str):
    """Get a specific post with its comments"""
    post = await _db().community_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get author
    author = await _db().users.find_one({"id": post["author_id"]}, {"_id": 0})
    
    # Get comments
    comments = await _db().community_comments.find({"post_id": post_id}, {"_id": 0}).sort("votes", -1).to_list(100)
    enriched_comments = []
    for comment in comments:
        comment_author = await _db().users.find_one({"id": comment["author_id"]}, {"_id": 0})
        enriched_comments.append({
            **comment,
            "author_name": comment_author["name"] if comment_author else "Utilisateur supprimé"
        })
    
    # Convert datetime to string for JSON serialization
    post_data = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in post.items()}
    
    return {
        "success": True,
        "data": {
            **post_data,
            "author_name": author["name"] if author else "Utilisateur supprimé",
            "comments": enriched_comments
        }
    }

@router.post("/community/posts/{post_id}/comments")
async def add_comment(
    post_id: str,
    comment_data: CommentCreate,
    current_user: dict = Depends(_auth)
):
    """Add a comment to a post"""
    # Verify post exists
    post = await _db().community_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment_id = str(uuid.uuid4())
    created_at = datetime.utcnow()
    comment_doc = {
        "id": comment_id,
        "post_id": post_id,
        "content": comment_data.content,
        "author_id": current_user["id"],
        "votes": 0,
        "created_at": created_at
    }
    await _db().community_comments.insert_one(comment_doc)
    
    # Update user's community score
    await _db().users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"community_score": 2}}
    )
    
    # Send notification to post author on comment (not self-comment)
    if post.get("author_id") != current_user["id"]:
        commenter_name = current_user.get("name", "Quelqu'un")
        comment_preview = comment_data.content[:50] + ("..." if len(comment_data.content) > 50 else "")
        await _notify(
            post["author_id"],
            f"{commenter_name} a commenté: {comment_preview}",
            "post_comment",
            {"post_id": post_id, "comment_id": comment_id},
            "💬 Nouveau commentaire"
        )
    
    return {
        "success": True,
        "data": {
            "id": comment_id,
            "post_id": post_id,
            "content": comment_data.content,
            "author_id": current_user["id"],
            "author_name": current_user["name"],
            "votes": 0,
            "created_at": created_at.isoformat()
        }
    }

@router.post("/community/posts/{post_id}/vote")
async def vote_post(
    post_id: str,
    vote_data: VoteCreate,
    current_user: dict = Depends(_auth)
):
    """Vote on a post"""
    post = await _db().community_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user already voted
    existing_vote = await _db().community_votes.find_one({
        "user_id": current_user["id"],
        "post_id": post_id
    })
    
    vote_change = 1 if vote_data.vote_type == "up" else -1
    
    if existing_vote:
        old_vote = 1 if existing_vote["vote_type"] == "up" else -1
        if old_vote == vote_change:
            # Remove vote
            await _db().community_votes.delete_one({"_id": existing_vote["_id"]})
            vote_change = -vote_change
        else:
            # Change vote
            await _db().community_votes.update_one(
                {"_id": existing_vote["_id"]},
                {"$set": {"vote_type": vote_data.vote_type}}
            )
            vote_change = vote_change * 2
    else:
        # New vote
        await _db().community_votes.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "post_id": post_id,
            "vote_type": vote_data.vote_type,
            "created_at": datetime.utcnow()
        })
    
    # Update post votes
    await _db().community_posts.update_one(
        {"id": post_id},
        {"$inc": {"votes": vote_change}}
    )
    
    # Give score to post author
    if vote_data.vote_type == "up":
        await _db().users.update_one(
            {"id": post["author_id"]},
            {"$inc": {"community_score": 1}}
        )
    
    updated_post = await _db().community_posts.find_one({"id": post_id}, {"_id": 0})
    return {"success": True, "votes": updated_post["votes"]}

@router.post("/community/posts/{post_id}/report")
async def report_community_post(post_id: str, report_data: dict = Body(...), current_user: dict = Depends(_auth)):
    """Report a community post and notify admins."""
    post = await _db().community_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    report = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "reporter_id": current_user["id"],
        "reporter_name": current_user.get("name", ""),
        "author_id": post.get("author_id"),
        "author_name": post.get("author_name"),
        "reason": report_data.get("reason", "inappropriate"),
        "content_preview": post.get("content", "")[:100],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await _db().community_reports.insert_one(report)
    
    # Notify ALL admins
    admin_users = await _db().users.find({"role": {"$in": ["super_admin", "admin"]}}, {"id": 1}).to_list(50)
    for admin in admin_users:
        await _notify(
            admin["id"],
            f"Post signale par {current_user.get('name', 'Utilisateur')} : \"{post.get('content', '')[:60]}...\"",
            "admin_report",
            {"report_id": report["id"], "post_id": post_id},
            "Signalement de post"
        )
    
    return {"success": True, "message": "Post reported"}



@router.post("/community/comments/{comment_id}/vote")
async def vote_comment(
    comment_id: str,
    vote_data: VoteCreate,
    current_user: dict = Depends(_auth)
):
    """Vote on a comment"""
    comment = await _db().community_comments.find_one({"id": comment_id}, {"_id": 0})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check existing vote
    existing_vote = await _db().community_votes.find_one({
        "user_id": current_user["id"],
        "comment_id": comment_id
    })
    
    vote_change = 1 if vote_data.vote_type == "up" else -1
    
    if existing_vote:
        old_vote = 1 if existing_vote["vote_type"] == "up" else -1
        if old_vote == vote_change:
            await _db().community_votes.delete_one({"_id": existing_vote["_id"]})
            vote_change = -vote_change
        else:
            await _db().community_votes.update_one(
                {"_id": existing_vote["_id"]},
                {"$set": {"vote_type": vote_data.vote_type}}
            )
            vote_change = vote_change * 2
    else:
        await _db().community_votes.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "comment_id": comment_id,
            "vote_type": vote_data.vote_type,
            "created_at": datetime.utcnow()
        })
    
    await _db().community_comments.update_one(
        {"id": comment_id},
        {"$inc": {"votes": vote_change}}
    )
    
    updated_comment = await _db().community_comments.find_one({"id": comment_id}, {"_id": 0})
    return {"success": True, "votes": updated_comment["votes"]}

@router.get("/community/user/{user_id}/posts")
async def get_user_posts(user_id: str):
    """Get posts by a specific user"""
    posts = await _db().community_posts.find({"author_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    user = await _db().users.find_one({"id": user_id}, {"_id": 0})
    
    enriched_posts = []
    for post in posts:
        comments_count = await _db().community_comments.count_documents({"post_id": post["id"]})
        post_data = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in post.items()}
        enriched_posts.append({
            **post_data,
            "author_name": user["name"] if user else "Utilisateur",
            "comments_count": comments_count
        })
    
    return {"success": True, "data": enriched_posts}

@router.get("/community/leaderboard")
async def get_community_leaderboard():
    """Get top contributors"""
    users = await _db().users.find({"community_score": {"$gt": 0}}, {"_id": 0}).sort("community_score", -1).limit(10).to_list(10)
    
    leaderboard = []
    for i, user in enumerate(users):
        leaderboard.append({
            "rank": i + 1,
            "id": user["id"],
            "name": user["name"],
            "score": user.get("community_score", 0),
            "level": user.get("progress", {}).get("current_level", "beginner")
        })
    
    return {"success": True, "data": leaderboard}

