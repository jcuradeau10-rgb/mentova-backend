"""Shared dependencies for all route modules."""
import os
import jwt
import bcrypt
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger("server")

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"

# These will be set by server.py at startup
db = None
sio = None

JWT_SECRET = os.environ.get('JWT_SECRET', 'mentova-secret-key-2026')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168
SUPER_ADMIN_EMAIL = os.environ.get('SUPER_ADMIN_EMAIL', 'jcuradeau.7@gmail.com')

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token invalide")
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("is_banned", False):
            raise HTTPException(status_code=403, detail="Your account has been suspended")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    if not credentials:
        return None
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            return None
        user = await db.users.find_one({"id": user_id})
        return user
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role", "user")
    if role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access only")
    return current_user

async def get_super_admin_user(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role", "user")
    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access only")
    return current_user

def get_user_role(user: dict) -> str:
    if user.get("email") == SUPER_ADMIN_EMAIL:
        return "super_admin"
    return user.get("role", "user")

# Connected WebSocket users
connected_users = {}

async def send_notification_to_user(user_id: str, body: str, notif_type: str, data: dict = None, title: str = None):
    """Store notification in DB and send via WebSocket/Push"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title or "Mentova",
        "body": body,
        "type": notif_type,
        "data": data or {},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notification)
    
    # WebSocket real-time
    if user_id in connected_users:
        try:
            await sio.emit('notification', {
                "id": notification["id"],
                "title": notification["title"],
                "body": body,
                "type": notif_type,
                "data": data or {},
                "is_read": False,
                "created_at": notification["created_at"],
            }, room=connected_users[user_id])
        except Exception as e:
            logger.error(f"WebSocket notification error: {e}")
    
    # Expo Push
    try:
        push_tokens = await db.push_tokens.find({"user_id": user_id}).to_list(10)
        if push_tokens:
            import httpx
            for pt in push_tokens:
                try:
                    async with httpx.AsyncClient() as http_client:
                        await http_client.post("https://exp.host/--/api/v2/push/send", json={
                            "to": pt["token"], "title": title or "Mentova", "body": body, "data": data or {},
                        }, timeout=5.0)
                except Exception:
                    pass
            logger.info(f"Push notification sent to user {user_id}")
        else:
            logger.info(f"Notification stored for user {user_id}, no push tokens registered")
    except Exception as e:
        logger.error(f"Push notification error: {e}")
