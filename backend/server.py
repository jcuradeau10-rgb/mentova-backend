from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
import asyncio
import time
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
import httpx
import resend
import base64
import shutil
import socketio
import json
from io import BytesIO
import pyotp
import qrcode

# PDF generation
from fpdf import FPDF

# Stripe integration (conditional — emergentintegrations not available on Render)
try:
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
    HAS_EMERGENT_STRIPE = True
except ImportError:
    HAS_EMERGENT_STRIPE = False
    import stripe as stripe_sdk
    # Fallback models
    class CheckoutSessionRequest:
        def __init__(self, amount, currency, success_url, cancel_url, metadata=None):
            self.amount = amount
            self.currency = currency
            self.success_url = success_url
            self.cancel_url = cancel_url
            self.metadata = metadata or {}
    class CheckoutSessionResponse:
        def __init__(self, session_id, url):
            self.session_id = session_id
            self.url = url
    class CheckoutStatusResponse:
        def __init__(self, status, payment_status):
            self.status = status
            self.payment_status = payment_status
    class StripeCheckout:
        def __init__(self, api_key, webhook_url=None):
            stripe_sdk.api_key = api_key
            self.webhook_url = webhook_url
        async def create_checkout_session(self, req):
            session = stripe_sdk.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{"price_data": {"currency": req.currency, "product_data": {"name": "Mentova VIP"}, "unit_amount": int(req.amount * 100), "recurring": {"interval": "month"}}, "quantity": 1}],
                mode="subscription",
                success_url=req.success_url,
                cancel_url=req.cancel_url,
                metadata=req.metadata,
            )
            return CheckoutSessionResponse(session_id=session.id, url=session.url)
        async def get_checkout_status(self, session_id):
            session = stripe_sdk.checkout.Session.retrieve(session_id)
            return CheckoutStatusResponse(status=session.status, payment_status=session.payment_status)
        async def handle_webhook(self, body, signature):
            return type('obj', (object,), {'payment_status': 'unknown', 'session_id': '', 'metadata': {}})()

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT_DIR / '.env', override=True)

# Socket.IO server for real-time notifications
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*', logger=False)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', '')
if mongo_url:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000, socketTimeoutMS=5000)
    db = client[os.environ.get('DB_NAME', 'cryptonai_db')]
else:
    client = None
    db = None

# Resend Configuration
resend.api_key = os.environ.get('RESEND_API_KEY', 're_Q64syrwQ_Lv1oZwJe6TXrofrtwLg5jHYg')

# Stripe Configuration
SUPER_ADMIN_EMAIL = os.environ.get('SUPER_ADMIN_EMAIL', 'jcuradeau.7@gmail.com')
STRIPE_API_KEY = os.environ.get('STRIPE_SK', '')
if not STRIPE_API_KEY:
    STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
if not STRIPE_API_KEY or STRIPE_API_KEY == 'sk_test_emergent':
    stripe_key_file = ROOT_DIR / '.stripe_key'
    if stripe_key_file.exists():
        STRIPE_API_KEY = stripe_key_file.read_text().strip()
if not STRIPE_API_KEY:
    logger.warning("No Stripe API key configured - payment features disabled")
else:
    logger.info(f"Stripe key loaded: {STRIPE_API_KEY[:12]}...")

STRIPE_FOUNDER_PRICE = os.environ.get('STRIPE_FOUNDER_PRICE', 'price_1Tku99F2kTGE9sQBLwcPh58N')
STRIPE_REGULAR_PRICE = os.environ.get('STRIPE_REGULAR_PRICE', 'price_1Tku99F2kTGE9sQBkjF8TPQQ')

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'mentova_super_secret_key_2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# VIP Configuration
VIP_PRICE_USD = 9.99  # Monthly subscription price (Founder: $9.99, Regular: $25.99)
VIP_DURATION_DAYS = 30  # 30 days per subscription
FREE_AI_QUESTIONS_PER_DAY = 5  # Non-VIP limit

# reCAPTCHA Configuration (test keys - replace with real keys in production)
RECAPTCHA_SECRET_KEY = os.environ.get('RECAPTCHA_SECRET_KEY', '6LejZ4csAAAAAKcjjyurS23lOeICBqIqAp4jZ9mQ')
RECAPTCHA_SITE_KEY = os.environ.get('RECAPTCHA_SITE_KEY', '6LejZ4csAAAAAOhuqKb2Xesso7dU0__VyTFC5bhC')

# ==================== COINGECKO GLOBAL CACHE ====================
COINGECKO_API_KEY = os.environ.get('COINGECKO_API_KEY', '')
COINGECKO_BASE_URL = "https://pro-api.coingecko.com/api/v3" if COINGECKO_API_KEY else "https://api.coingecko.com/api/v3"
COINGECKO_CACHE_TTL = 40  # seconds between API calls

_cg_cache = {
    "prices": {"data": None, "last_fetch": 0},
    "global": {"data": None, "last_fetch": 0},
    "trending": {"data": None, "last_fetch": 0},
}
_cg_lock = asyncio.Lock()

async def _fetch_coingecko(endpoint: str, params: dict = None) -> dict | None:
    headers = {}
    if COINGECKO_API_KEY:
        headers["x-cg-pro-api-key"] = COINGECKO_API_KEY
    try:
        async with httpx.AsyncClient() as client_http:
            resp = await client_http.get(
                f"{COINGECKO_BASE_URL}/{endpoint}",
                params=params or {},
                headers=headers,
                timeout=12.0,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"CoinGecko {endpoint} returned {resp.status_code}")
    except Exception as e:
        logger.error(f"CoinGecko fetch error ({endpoint}): {e}")
    return None

async def _refresh_cache():
    now = time.time()
    async with _cg_lock:
        # Prices
        if now - _cg_cache["prices"]["last_fetch"] >= COINGECKO_CACHE_TTL:
            data = await _fetch_coingecko("coins/markets", {
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": 20,
                "page": 1,
                "sparkline": "false",
                "price_change_percentage": "24h,7d",
            })
            if data:
                _cg_cache["prices"]["data"] = data
                _cg_cache["prices"]["last_fetch"] = now

        # Global
        if now - _cg_cache["global"]["last_fetch"] >= COINGECKO_CACHE_TTL:
            data = await _fetch_coingecko("global")
            if data:
                _cg_cache["global"]["data"] = data.get("data", data)
                _cg_cache["global"]["last_fetch"] = now

        # Trending
        if now - _cg_cache["trending"]["last_fetch"] >= COINGECKO_CACHE_TTL:
            data = await _fetch_coingecko("search/trending")
            if data:
                _cg_cache["trending"]["data"] = data.get("coins", [])
                _cg_cache["trending"]["last_fetch"] = now

async def _coingecko_scheduler():
    """Background task: refresh cache every 40 seconds"""
    while True:
        try:
            await _refresh_cache()
        except Exception as e:
            logger.error(f"CoinGecko scheduler error: {e}")
        await asyncio.sleep(COINGECKO_CACHE_TTL)

if COINGECKO_API_KEY:
    logger.info(f"CoinGecko API key loaded: {COINGECKO_API_KEY[:8]}...")
else:
    logger.warning("No CoinGecko API key — using mock data")

async def verify_recaptcha(token: str) -> bool:
    if not token:
        return False
    async with httpx.AsyncClient() as client_http:
        resp = await client_http.post(
            'https://www.google.com/recaptcha/api/siteverify',
            data={'secret': RECAPTCHA_SECRET_KEY, 'response': token}
        )
        result = resp.json()
        logger.info(f"reCAPTCHA verification result: success={result.get('success')}, score={result.get('score')}, action={result.get('action')}")
        if not result.get('success', False):
            return False
        # reCAPTCHA v3: check score (0.0 = bot, 1.0 = human)
        score = result.get('score', 0)
        return score >= 0.3  # Threshold: 0.3 is lenient enough for real users

# Create the main app
app = FastAPI(title="Mentova API", version="1.0.0")

# Health check endpoint for deployment platforms
@app.get("/")
async def health_check():
    return {"status": "ok", "app": "Mentova API", "version": "1.0.0"}

@app.get("/api/health")
async def api_health():
    return {"status": "ok", "app": "Mentova API", "version": "1.0.0"}

# Mount static files for uploads
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Mount static site for preview (served via /site/ path)
from fastapi.responses import FileResponse
import pathlib
STATIC_SITE_DIR = pathlib.Path("/app/static-site")

@app.get("/api/site/{path:path}")
async def serve_static_site(path: str = "index.html"):
    if not path or path == "/":
        path = "index.html"
    file_path = STATIC_SITE_DIR / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    html_path = STATIC_SITE_DIR / f"{path}.html"
    if html_path.exists():
        return FileResponse(html_path)
    return FileResponse(STATIC_SITE_DIR / "index.html")

@app.get("/api/site")
async def serve_static_root():
    return FileResponse(STATIC_SITE_DIR / "index.html")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    captcha_token: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    captcha_token: Optional[str] = None
    totp_code: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime
    progress: dict = Field(default_factory=dict)
    role: str = "user"  # "user", "admin", "super_admin"
    is_banned: bool = False
    is_vip: bool = False
    vip_expires_at: Optional[datetime] = None
    is_professional: bool = False
    is_influencer: bool = False
    is_apple_review: bool = False
    pro_badge: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProgressUpdate(BaseModel):
    module_id: str
    completed: bool
    score: Optional[int] = None

# VIP Models
class VIPCheckoutRequest(BaseModel):
    origin_url: str
    ref_code: Optional[str] = None

class VIPCheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str

class VIPStatusResponse(BaseModel):
    is_vip: bool
    vip_expires_at: Optional[str] = None
    days_remaining: Optional[int] = None
    features: List[str] = []

class AIQueryRequest(BaseModel):
    query: str
    context: Optional[str] = "general"

class AIQueryResponse(BaseModel):
    response: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Community models moved to routes/community.py


# Admin models moved to routes/admin.py

# ==================== HELPER FUNCTIONS ====================

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
        # Check if user is banned
        if user.get("is_banned", False):
            raise HTTPException(status_code=403, detail="Your account has been suspended")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

# Optional user - returns None if not authenticated (for public routes with optional auth)
optional_security = HTTPBearer(auto_error=False)

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Get current user if authenticated, otherwise return None"""
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

# Admin permission check functions
async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Require admin or super_admin role"""
    role = current_user.get("role", "user")
    if role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access only")
    return current_user

async def get_super_admin_user(current_user: dict = Depends(get_current_user)):
    """Require super_admin role only"""
    role = current_user.get("role", "user")
    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access only")
    return current_user

def get_user_role(user: dict) -> str:
    """Get user role, auto-promote to super_admin if email matches"""
    if user.get("email") == SUPER_ADMIN_EMAIL:
        return "super_admin"
    return user.get("role", "user")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Verify CAPTCHA (non-blocking: log warning if missing but allow register)
    if user_data.captcha_token:
        captcha_valid = await verify_recaptcha(user_data.captcha_token)
        if not captcha_valid:
            logger.warning(f"CAPTCHA verification failed for registration: {user_data.email}")
    else:
        logger.warning(f"No CAPTCHA token provided for registration: {user_data.email}")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="This email is already in use")
    
    # Determine role - super_admin for the designated email
    role = "super_admin" if user_data.email == SUPER_ADMIN_EMAIL else "user"
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.utcnow(),
        "role": role,
        "is_banned": False,
        "community_score": 0,
        "progress": {
            "modules_completed": [],
            "current_level": "beginner",
            "total_score": 0
        }
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            created_at=user_doc["created_at"],
            progress=user_doc["progress"],
            role=role,
            is_banned=False
        )
    )

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    # Verify CAPTCHA (non-blocking: log warning if missing but allow login)
    if credentials.captcha_token:
        captcha_valid = await verify_recaptcha(credentials.captcha_token)
        if not captcha_valid:
            logger.warning(f"CAPTCHA verification failed for {credentials.email}")
    else:
        logger.warning(f"No CAPTCHA token provided for login: {credentials.email}")
    
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    stored_hash = user.get("password_hash") or user.get("password", "")
    if not stored_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if user is banned
    if user.get("is_banned", False):
        raise HTTPException(status_code=403, detail="Your account has been suspended")
    
    # Check 2FA if enabled
    if user.get("totp_enabled", False):
        if not credentials.totp_code:
            return {"requires_2fa": True, "message": "2FA code required"}
        totp = pyotp.TOTP(user["totp_secret"])
        if not totp.verify(credentials.totp_code, valid_window=1):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    # Auto-promote to super_admin if email matches
    role = "super_admin" if user.get("email") == SUPER_ADMIN_EMAIL else user.get("role", "user")
    
    # Update role in database if it changed
    if role != user.get("role"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"role": role}})
    
    # Check VIP status
    is_vip = await check_user_vip_status(user["id"])
    vip_expires_at = user.get("vip_expires_at") if is_vip else None
    
    token = create_token(user["id"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            created_at=user["created_at"],
            progress=user.get("progress", {}),
            role=role,
            is_banned=user.get("is_banned", False),
            is_vip=is_vip,
            vip_expires_at=vip_expires_at,
            is_professional=user.get("is_professional", False),
            is_influencer=user.get("is_influencer", False),
            is_apple_review=user.get("is_apple_review", False),
            pro_badge=user.get("pro_badge")
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    # Auto-check for super admin status
    role = "super_admin" if current_user.get("email") == SUPER_ADMIN_EMAIL else current_user.get("role", "user")
    
    # Check VIP status
    is_vip = await check_user_vip_status(current_user["id"])
    vip_expires_at = current_user.get("vip_expires_at") if is_vip else None
    
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        created_at=current_user["created_at"],
        progress=current_user.get("progress", {}),
        role=role,
        is_banned=current_user.get("is_banned", False),
        is_vip=is_vip,
        vip_expires_at=vip_expires_at,
        is_professional=current_user.get("is_professional", False),
        is_influencer=current_user.get("is_influencer", False),
        is_apple_review=current_user.get("is_apple_review", False),
        pro_badge=current_user.get("pro_badge")
    )

# ==================== PASSWORD RESET ROUTES ====================

import random
import string

def generate_reset_code():
    """Generate a 6-digit reset code"""
    return ''.join(random.choices(string.digits, k=6))

def send_reset_email(to_email: str, reset_code: str) -> bool:
    """Send password reset email via Resend"""
    try:
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#0A0A1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A1A;padding:40px 20px;">
                <tr>
                    <td align="center">
                        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#1A1A2E;border-radius:16px;overflow:hidden;">
                            <tr>
                                <td style="background:linear-gradient(135deg,#7C3AED,#5B21B6);padding:32px;text-align:center;">
                                    <h1 style="margin:0;color:#FFFFFF;font-size:28px;font-weight:700;">Mentova</h1>
                                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Votre plateforme crypto</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:32px;">
                                    <h2 style="margin:0 0 16px;color:#FFFFFF;font-size:20px;font-weight:600;">Reinitialisation de mot de passe</h2>
                                    <p style="margin:0 0 24px;color:#8B8B9E;font-size:15px;line-height:1.6;">
                                        Vous avez demande la reinitialisation de votre mot de passe. Voici votre code de verification :
                                    </p>
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" style="padding:24px 0;">
                                                <div style="display:inline-block;background-color:#0A0A1A;border:2px solid #7C3AED;border-radius:12px;padding:16px 40px;">
                                                    <span style="color:#FFFFFF;font-size:36px;font-weight:700;letter-spacing:12px;">{reset_code}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                    <p style="margin:24px 0 0;color:#8B8B9E;font-size:13px;line-height:1.5;">
                                        Ce code expire dans <strong style="color:#FFFFFF;">15 minutes</strong>.
                                    </p>
                                    <p style="margin:8px 0 0;color:#8B8B9E;font-size:13px;line-height:1.5;">
                                        Si vous n'avez pas fait cette demande, ignorez cet email. Votre compte reste securise.
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:0 32px 24px;">
                                    <hr style="border:none;border-top:1px solid #2A2A4E;margin:0 0 16px;">
                                    <p style="margin:0;color:#5A5A6E;font-size:12px;text-align:center;">
                                        Mentova Academy &mdash; Ne partagez jamais ce code avec personne.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        response = resend.Emails.send({
            "from": "Mentova Academy <noreply@mentova-academy.com>",
            "to": [to_email],
            "subject": "Votre code de reinitialisation - Mentova",
            "html": html_content
        })

        logger.info(f"Password reset email sent to {to_email}, response: {response}")
        return True
    except Exception as e:
        logger.error(f"Failed to send reset email to {to_email}: {e}")
        return False

@api_router.post("/auth/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(request: ForgotPasswordRequest):
    """Request a password reset code"""
    user = await db.users.find_one({"email": request.email})
    
    # Always return success to prevent email enumeration
    if not user:
        return ForgotPasswordResponse(
            success=True,
            message="Si cet email existe, un code de réinitialisation a été envoyé"
        )
    
    # Generate reset code
    reset_code = generate_reset_code()
    expiration = datetime.utcnow() + timedelta(minutes=15)
    
    # Store reset code in database
    await db.password_resets.delete_many({"email": request.email})  # Remove old codes
    await db.password_resets.insert_one({
        "email": request.email,
        "code": reset_code,
        "expires_at": expiration,
        "created_at": datetime.utcnow()
    })
    
    # Send email via Resend
    email_sent = send_reset_email(request.email, reset_code)
    
    if email_sent:
        logger.info(f"Password reset email sent to {request.email}")
        return ForgotPasswordResponse(
            success=True,
            message="Un code de réinitialisation a été envoyé à votre adresse email"
        )
    else:
        logger.error(f"Failed to send password reset email to {request.email}")
        return ForgotPasswordResponse(
            success=True,
            message="Si cet email existe, un code de réinitialisation a été envoyé"
        )

@api_router.post("/auth/verify-reset-code")
async def verify_reset_code(email: str, code: str):
    """Verify if the reset code is valid"""
    reset_request = await db.password_resets.find_one({
        "email": email,
        "code": code,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not reset_request:
        return {"success": False, "message": "Code invalide ou expiré"}
    
    return {"success": True, "message": "Code valide"}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password with the code"""
    # Verify the code
    reset_request = await db.password_resets.find_one({
        "email": request.email,
        "code": request.code,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not reset_request:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update password
    new_hash = hash_password(request.new_password)
    result = await db.users.update_one(
        {"email": request.email},
        {"$set": {"password_hash": new_hash}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="User not found")
    
    # Delete used reset code
    await db.password_resets.delete_many({"email": request.email})
    
    return {
        "success": True,
        "message": "Mot de passe réinitialisé avec succès"
    }

@api_router.post("/auth/change-password")
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Change password for authenticated user"""
    # Get user from database
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(request.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Check that new password is different from current
    if request.current_password == request.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the old one")
    
    # Update password
    new_hash = hash_password(request.new_password)
    result = await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": new_hash, "password_changed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Error updating password")
    
    logger.info(f"Password changed for user {current_user['email']}")
    
    return {
        "success": True,
        "message": "Mot de passe modifié avec succès"
    }


# ==================== 2FA & SECURITY ROUTES ====================

@api_router.get("/auth/recaptcha-site-key")
async def get_recaptcha_site_key():
    return {"site_key": RECAPTCHA_SITE_KEY}

@api_router.post("/auth/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_user)):
    """Generate a new TOTP secret and return QR code for setup"""
    if current_user.get("totp_enabled", False):
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=current_user["email"],
        issuer_name="Mentova"
    )
    
    # Generate QR code as base64
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Generate backup codes
    backup_codes = [str(uuid.uuid4())[:8].upper() for _ in range(8)]
    
    # Store secret temporarily (not enabled yet until verified)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "totp_secret_pending": secret,
            "totp_backup_codes_pending": backup_codes
        }}
    )
    
    return {
        "secret": secret,
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "backup_codes": backup_codes,
        "provisioning_uri": provisioning_uri
    }

@api_router.post("/auth/2fa/verify-setup")
async def verify_2fa_setup(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Verify the TOTP code to confirm 2FA setup"""
    code = body.get("code", "")
    secret = current_user.get("totp_secret_pending")
    
    if not secret:
        raise HTTPException(status_code=400, detail="No pending 2FA setup found")
    
    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Enable 2FA
    backup_codes = current_user.get("totp_backup_codes_pending", [])
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "totp_enabled": True,
                "totp_secret": secret,
                "totp_backup_codes": backup_codes
            },
            "$unset": {
                "totp_secret_pending": "",
                "totp_backup_codes_pending": ""
            }
        }
    )
    
    return {"success": True, "message": "2FA enabled successfully", "backup_codes": backup_codes}

@api_router.post("/auth/2fa/disable")
async def disable_2fa(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Disable 2FA with password confirmation"""
    password = body.get("password", "")
    
    if not verify_password(password, current_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {"totp_enabled": False},
            "$unset": {
                "totp_secret": "",
                "totp_backup_codes": "",
                "totp_secret_pending": "",
                "totp_backup_codes_pending": ""
            }
        }
    )
    
    return {"success": True, "message": "2FA disabled successfully"}

@api_router.get("/auth/2fa/status")
async def get_2fa_status(current_user: dict = Depends(get_current_user)):
    """Get current 2FA status"""
    return {
        "enabled": current_user.get("totp_enabled", False),
        "biometric_enabled": current_user.get("biometric_enabled", False)
    }

@api_router.post("/auth/biometric/toggle")
async def toggle_biometric(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Toggle biometric authentication preference"""
    enabled = body.get("enabled", False)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"biometric_enabled": enabled}}
    )
    return {"success": True, "biometric_enabled": enabled}


# ==================== CRYPTO MARKET ROUTES ====================

@api_router.get("/crypto/prices")
async def get_crypto_prices():
    """Get real-time crypto prices from global cache (refreshed every 40s)"""
    MOCK_PRICES = [
        {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "image": "https://assets.coingecko.com/coins/images/1/large/bitcoin.png", "current_price": 67500, "market_cap": 1320000000000, "market_cap_rank": 1, "price_change_percentage_24h": 0.75, "price_change_percentage_7d_in_currency": 2.5},
        {"id": "ethereum", "symbol": "eth", "name": "Ethereum", "image": "https://assets.coingecko.com/coins/images/279/large/ethereum.png", "current_price": 1950, "market_cap": 234000000000, "market_cap_rank": 2, "price_change_percentage_24h": 0.52, "price_change_percentage_7d_in_currency": 1.8},
        {"id": "tether", "symbol": "usdt", "name": "Tether", "image": "https://assets.coingecko.com/coins/images/325/large/Tether.png", "current_price": 0.9997, "market_cap": 95000000000, "market_cap_rank": 3, "price_change_percentage_24h": 0.01, "price_change_percentage_7d_in_currency": 0.02},
        {"id": "solana", "symbol": "sol", "name": "Solana", "image": "https://assets.coingecko.com/coins/images/4128/large/solana.png", "current_price": 185, "market_cap": 85000000000, "market_cap_rank": 7, "price_change_percentage_24h": 2.15, "price_change_percentage_7d_in_currency": 8.5},
        {"id": "binancecoin", "symbol": "bnb", "name": "BNB", "image": "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png", "current_price": 625, "market_cap": 93000000000, "market_cap_rank": 5, "price_change_percentage_24h": 3.25, "price_change_percentage_7d_in_currency": 5.1},
    ]
    cached = _cg_cache["prices"]["data"]
    if cached:
        return {"success": True, "data": cached, "timestamp": datetime.now(timezone.utc).isoformat(), "cached": True}
    return {"success": True, "data": MOCK_PRICES, "timestamp": datetime.now(timezone.utc).isoformat(), "mock": True}

@api_router.get("/crypto/chart/{coin_id}")
async def get_crypto_chart(coin_id: str, days: str = "7"):
    """Get historical chart data for a crypto (prices + volumes) using Pro API"""
    import random as rnd
    import math as mth
    
    valid_days = {"1": 1, "7": 7, "30": 30, "90": 90, "365": 365}
    num_days = valid_days.get(days, 7)
    
    coingecko_key = os.environ.get("COINGECKO_API_KEY")
    
    try:
        async with httpx.AsyncClient() as client:
            # Use Pro API if key available, otherwise free API
            if coingecko_key:
                url = f"https://pro-api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
                headers = {"x-cg-pro-api-key": coingecko_key}
            else:
                url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
                headers = {}
            
            response = await client.get(
                url,
                params={"vs_currency": "usd", "days": num_days},
                headers=headers,
                timeout=15.0
            )
            if response.status_code == 200:
                data = response.json()
                prices = [{"timestamp": p[0], "price": p[1]} for p in data.get("prices", [])]
                volumes = [{"timestamp": v[0], "volume": v[1]} for v in data.get("total_volumes", [])]
                
                chart_data = []
                for i, p in enumerate(prices):
                    vol = volumes[i]["volume"] if i < len(volumes) else 0
                    chart_data.append({
                        "timestamp": p["timestamp"],
                        "price": round(p["price"], 2) if p["price"] >= 1 else round(p["price"], 6),
                        "volume": round(vol, 0),
                    })
                
                return {"success": True, "data": chart_data, "coin_id": coin_id, "days": num_days}
            else:
                logger.warning(f"CoinGecko chart returned {response.status_code} for {coin_id}")
                return {"success": True, "data": _generate_mock_chart(coin_id, num_days), "coin_id": coin_id, "days": num_days, "mock": True}
    except Exception as e:
        logger.error(f"Error fetching chart for {coin_id}: {e}")
        return {"success": True, "data": _generate_mock_chart(coin_id, num_days), "coin_id": coin_id, "days": num_days, "mock": True}

def _generate_mock_chart(coin_id: str, days: int):
    """Generate realistic mock chart data"""
    import random as rnd
    import math as mth
    
    base_prices = {"bitcoin": 67500, "ethereum": 1950, "solana": 185, "binancecoin": 625, "ripple": 1.43, "cardano": 0.65, "dogecoin": 0.32, "avalanche-2": 38}
    base = base_prices.get(coin_id, 100)
    
    points = min(days * 24, 365)
    interval_ms = (days * 86400000) // points
    now = int(datetime.utcnow().timestamp() * 1000)
    
    data = []
    price = base * 0.95
    for i in range(points):
        ts = now - (points - i) * interval_ms
        trend = (i / points) * 0.05 * base
        noise = rnd.gauss(0, base * 0.008)
        wave = mth.sin(i * 0.1) * base * 0.01
        price = max(price + trend / points + noise + wave, base * 0.7)
        vol = rnd.uniform(0.5, 1.5) * base * 1000000
        data.append({"timestamp": ts, "price": round(price, 2 if price >= 1 else 6), "volume": round(vol, 0)})
    return data

# ==================== RAINBOW BTC CHART ====================
import math

# Rainbow band definitions (bottom to top)
RAINBOW_BANDS = [
    {"label": "Fire Sale", "color": "#4A0080"},
    {"label": "BUY!", "color": "#6236FF"},
    {"label": "Accumulate", "color": "#3D85C6"},
    {"label": "Still Cheap", "color": "#00BCD4"},
    {"label": "HODL!", "color": "#4CAF50"},
    {"label": "Is this a bubble?", "color": "#8BC34A"},
    {"label": "FOMO Intensifies", "color": "#FFD600"},
    {"label": "Sell. Seriously, SELL!", "color": "#FF9800"},
    {"label": "Maximum Bubble", "color": "#F44336"},
]

# Bitcoin genesis block: Jan 3, 2009
BTC_GENESIS_TS = 1230940800  # epoch seconds

def _rainbow_band_prices(timestamp_ms: int) -> list:
    """Calculate the rainbow band price boundaries at a given timestamp using log regression."""
    days_since_genesis = max(1, (timestamp_ms / 1000 - BTC_GENESIS_TS) / 86400)
    log_days = math.log10(days_since_genesis)
    
    # Power-law regression: log10(price) = a * log10(days) + b
    a = 5.84
    b = -17.01
    base_log_price = a * log_days + b
    
    # Each band spans 0.35 in log10 space (factor of ~2.24x between bands)
    # Center the 9 bands around the regression line
    band_width = 0.35
    center_offset = 4.5 * band_width  # shift so regression is center of band 4-5
    
    bands = []
    for i in range(len(RAINBOW_BANDS)):
        low = 10 ** (base_log_price - center_offset + i * band_width)
        high = 10 ** (base_log_price - center_offset + (i + 1) * band_width)
        bands.append({"low": round(low, 2), "high": round(high, 2)})
    return bands

def _get_current_band(price: float, bands: list) -> int:
    """Return the index of the band the price falls into (-1 if below all)."""
    for i, band in enumerate(bands):
        if price < band["high"]:
            return i
    return len(bands) - 1

_rainbow_cache: Dict[str, Any] = {"data": None, "fetched_at": 0}

@api_router.get("/crypto/rainbow")
async def get_rainbow_chart():
    """Get Bitcoin Rainbow Chart data: historical prices + band boundaries."""
    # Cache for 1 hour
    if _rainbow_cache["data"] and time.time() - _rainbow_cache["fetched_at"] < 3600:
        return _rainbow_cache["data"]
    
    coingecko_key = os.environ.get("COINGECKO_API_KEY")
    
    # Pre-computed BTC monthly prices (2010-2024) for full rainbow history
    # These are approximate monthly close prices
    btc_historical = [
        (1280620800000, 0.06), (1283299200000, 0.07), (1285891200000, 0.06),  # 2010
        (1296518400000, 0.30), (1304208000000, 3.00), (1309478400000, 17.50),  # 2011
        (1314835200000, 8.00), (1325376000000, 5.00), (1335830400000, 5.30),   # 2011-2012
        (1341100800000, 6.70), (1346457600000, 10.50), (1351728000000, 11.00), # 2012
        (1356998400000, 13.50), (1362268800000, 33.00), (1367366400000, 135.00),# 2013
        (1372636800000, 97.00), (1380585600000, 135.00), (1385856000000, 1100.00),# 2013
        (1388534400000, 770.00), (1393632000000, 560.00), (1401580800000, 630.00),# 2014
        (1409529600000, 480.00), (1417392000000, 375.00), (1420070400000, 315.00),# 2014-2015
        (1427846400000, 245.00), (1435708800000, 260.00), (1443657600000, 237.00),# 2015
        (1451606400000, 430.00), (1459468800000, 416.00), (1467331200000, 670.00),# 2015-2016
        (1475280000000, 610.00), (1480550400000, 740.00), (1483228800000, 960.00),# 2016
        (1488326400000, 1190.00), (1496275200000, 2500.00), (1504224000000, 4700.00),# 2017
        (1509494400000, 6400.00), (1512086400000, 10800.00), (1514764800000, 13900.00),# 2017
        (1519862400000, 10200.00), (1527811200000, 7500.00), (1535760000000, 7000.00),# 2018
        (1543622400000, 4000.00), (1548979200000, 3400.00), (1556668800000, 5300.00),# 2018-2019
        (1564617600000, 10100.00), (1572566400000, 9200.00), (1577836800000, 7200.00),# 2019
        (1580515200000, 9400.00), (1588377600000, 8700.00), (1596326400000, 11400.00),# 2020
        (1604188800000, 13800.00), (1609459200000, 29000.00), (1612137600000, 45000.00),# 2020-2021
        (1619827200000, 57000.00), (1625097600000, 35000.00), (1632960000000, 43800.00),# 2021
        (1635638400000, 61300.00), (1640995200000, 46200.00), (1648771200000, 45500.00),# 2021-2022
        (1656633600000, 19800.00), (1664582400000, 19400.00), (1672444800000, 16500.00),# 2022
        (1677628800000, 23100.00), (1685577600000, 27200.00), (1693440000000, 26100.00),# 2023
        (1698710400000, 34500.00), (1704067200000, 42500.00), (1709251200000, 62000.00),# 2023-2024
        (1714521600000, 60600.00), (1717200000000, 67500.00),  # 2024 Q2
    ]
    
    try:
        async with httpx.AsyncClient() as client:
            if coingecko_key:
                url = "https://pro-api.coingecko.com/api/v3/coins/bitcoin/market_chart"
                headers = {"x-cg-pro-api-key": coingecko_key}
            else:
                url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart"
                headers = {}
            
            # Get 2 years of real data (max for Basic plan)
            response = await client.get(url, params={"vs_currency": "usd", "days": 730}, headers=headers, timeout=30.0)
            
            if response.status_code == 200:
                data = response.json()
                raw_prices = data.get("prices", [])
                
                # Merge historical + real data
                real_start_ts = raw_prices[0][0] if raw_prices else float('inf')
                merged = [(ts, p) for ts, p in btc_historical if ts < real_start_ts]
                
                # Sample real data to ~300 points
                step = max(1, len(raw_prices) // 300)
                for i in range(0, len(raw_prices), step):
                    merged.append((raw_prices[i][0], raw_prices[i][1]))
                if raw_prices and raw_prices[-1] not in [(t, p) for t, p in merged]:
                    merged.append((raw_prices[-1][0], raw_prices[-1][1]))
                
                merged.sort(key=lambda x: x[0])
                
                chart_points = []
                for ts_ms, price in merged:
                    bands = _rainbow_band_prices(ts_ms)
                    band_idx = _get_current_band(price, bands)
                    chart_points.append({
                        "timestamp": ts_ms,
                        "price": round(price, 2),
                        "band_index": band_idx,
                        "band_low": bands[0]["low"],
                        "band_high": bands[-1]["high"],
                    })
                
                # Current price band info
                last_ts, last_price = merged[-1]
                current_bands = _rainbow_band_prices(last_ts)
                current_band_idx = _get_current_band(last_price, current_bands)
                
                result = {
                    "success": True,
                    "prices": chart_points,
                    "bands": [{"label": b["label"], "color": b["color"]} for b in RAINBOW_BANDS],
                    "current_price": round(last_price, 2),
                    "current_band": current_band_idx,
                    "current_band_label": RAINBOW_BANDS[current_band_idx]["label"],
                    "current_band_color": RAINBOW_BANDS[current_band_idx]["color"],
                    "current_bands_prices": current_bands,
                    "total_points": len(chart_points),
                }
                
                _rainbow_cache["data"] = result
                _rainbow_cache["fetched_at"] = time.time()
                logger.info(f"Rainbow chart cached: {len(chart_points)} points, current band: {RAINBOW_BANDS[current_band_idx]['label']}")
                return result
            else:
                logger.warning(f"Rainbow chart API returned {response.status_code}")
                raise HTTPException(status_code=502, detail="Failed to fetch BTC data")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rainbow chart error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@api_router.get("/crypto/trending")
async def get_trending_cryptos():
    """Get trending cryptocurrencies from global cache"""
    cached = _cg_cache["trending"]["data"]
    if cached:
        return {"success": True, "data": cached, "timestamp": datetime.now(timezone.utc).isoformat()}
    return {"success": False, "error": "Cache not ready", "data": []}

@api_router.get("/crypto/global")
async def get_global_stats():
    """Get global crypto market stats from global cache"""
    cached = _cg_cache["global"]["data"]
    if cached:
        return {"success": True, "data": cached, "timestamp": datetime.now(timezone.utc).isoformat()}
    return {"success": False, "error": "Cache not ready", "data": {}}

# ==================== EDUCATIONAL CONTENT ROUTES ====================

EDUCATIONAL_MODULES = [
    {
        "id": "intro-crypto",
        "title": "Introduction à la Cryptomonnaie",
        "description": "Comprendre les bases de la blockchain et des cryptomonnaies",
        "level": "beginner",
        "duration": "15 min",
        "icon": "book",
        "lessons": [
            {"id": "what-is-crypto", "title": "Qu'est-ce qu'une cryptomonnaie ?", "completed": False},
            {"id": "blockchain-basics", "title": "La blockchain expliquée simplement", "completed": False},
            {"id": "bitcoin-intro", "title": "Bitcoin : La première crypto", "completed": False}
        ]
    },
    {
        "id": "security-basics",
        "title": "Sécurité et Protection",
        "description": "Protéger vos investissements et éviter les arnaques",
        "level": "beginner",
        "duration": "20 min",
        "icon": "shield",
        "lessons": [
            {"id": "scam-detection", "title": "Reconnaître les arnaques", "completed": False},
            {"id": "wallet-security", "title": "Sécuriser son portefeuille", "completed": False},
            {"id": "common-mistakes", "title": "Erreurs à éviter", "completed": False}
        ]
    },
    {
        "id": "market-analysis",
        "title": "Analyse du Marché",
        "description": "Apprendre à lire et comprendre le marché crypto",
        "level": "intermediate",
        "duration": "25 min",
        "icon": "chart",
        "lessons": [
            {"id": "reading-charts", "title": "Lire les graphiques", "completed": False},
            {"id": "market-trends", "title": "Identifier les tendances", "completed": False},
            {"id": "project-analysis", "title": "Analyser un projet", "completed": False}
        ]
    },
    {
        "id": "investment-strategies",
        "title": "Stratégies d'Investissement",
        "description": "Méthodes pour investir intelligemment",
        "level": "intermediate",
        "duration": "30 min",
        "icon": "target",
        "lessons": [
            {"id": "dca-strategy", "title": "La stratégie DCA", "completed": False},
            {"id": "portfolio-diversification", "title": "Diversification du portefeuille", "completed": False},
            {"id": "risk-management", "title": "Gestion des risques", "completed": False}
        ]
    }
]

@api_router.get("/education/modules")
async def get_education_modules():
    """Get all educational modules"""
    return {"success": True, "data": EDUCATIONAL_MODULES}

@api_router.get("/education/modules/{module_id}")
async def get_module_detail(module_id: str):
    """Get detailed module content"""
    module = next((m for m in EDUCATIONAL_MODULES if m["id"] == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return {"success": True, "data": module}

# ==================== PROGRESS ROUTES ====================

@api_router.post("/progress/update")
async def update_progress(
    progress: ProgressUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user progress on a module"""
    user_progress = current_user.get("progress", {})
    modules_completed = user_progress.get("modules_completed", [])
    
    if progress.completed and progress.module_id not in modules_completed:
        modules_completed.append(progress.module_id)
    
    # Calculate level based on completed modules
    total_completed = len(modules_completed)
    if total_completed >= 8:
        level = "advanced"
    elif total_completed >= 4:
        level = "intermediate"
    else:
        level = "beginner"
    
    new_progress = {
        "modules_completed": modules_completed,
        "current_level": level,
        "total_score": user_progress.get("total_score", 0) + (progress.score or 10)
    }
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"progress": new_progress}}
    )
    
    return {"success": True, "progress": new_progress}

@api_router.get("/progress")
async def get_progress(current_user: dict = Depends(get_current_user)):
    """Get user progress"""
    return {
        "success": True,
        "progress": current_user.get("progress", {
            "modules_completed": [],
            "current_level": "beginner",
            "total_score": 0
        })
    }

# ==================== VIP SYSTEM ROUTES ====================

VIP_FEATURES = {
    "fr": [
        {"id": "daily_briefing", "title": "Briefing Quotidien", "description": "Recevez chaque jour un résumé IA des événements crypto majeurs et des mouvements de marché", "icon": "today"},
        {"id": "fear_greed", "title": "Fear & Greed Index", "description": "Suivez le sentiment du marché en temps réel avec l'indice de peur et d'avidité", "icon": "speedometer"},
        {"id": "rainbow_chart", "title": "Rainbow Chart BTC", "description": "Visualisez la zone de prix actuelle du Bitcoin (achat, accumulation, hold, FOMO, vente)", "icon": "color-palette"},
        {"id": "whale_alerts", "title": "Whale Alerts", "description": "Soyez alerté des grosses transactions de baleines crypto en temps réel", "icon": "alert-circle"},
        {"id": "altcoin_season", "title": "Altcoin Season Index", "description": "Déterminez si c'est la saison des altcoins ou du Bitcoin avec des données sur 90 jours", "icon": "pie-chart"},
        {"id": "halving", "title": "Bitcoin Halving", "description": "Suivez le compte à rebours du prochain halving Bitcoin et son impact potentiel", "icon": "timer"},
        {"id": "eth_gas", "title": "ETH Gas Tracker", "description": "Consultez les frais de gas Ethereum en temps réel (lent, moyen, rapide)", "icon": "flash"},
        {"id": "liquidations", "title": "Liquidations 24h", "description": "Suivez les liquidations de positions long et short sur les marchés à terme", "icon": "flame"},
        {"id": "btc_dominance", "title": "Dominance BTC", "description": "Surveillez la part de marché de Bitcoin et Ethereum par rapport au marché total", "icon": "analytics"},
        {"id": "virtual_portfolio", "title": "Portefeuille Virtuel", "description": "Simulez vos investissements et suivez vos performances sans risquer d'argent réel", "icon": "wallet"},
        {"id": "custom_alerts", "title": "Alertes Personnalisées", "description": "Créez des alertes de prix sur vos cryptos favorites et ne manquez aucune opportunité", "icon": "notifications"},
        {"id": "pro_marketplace", "title": "Marketplace Pro", "description": "Accédez aux offres et formations de mentors certifiés en trading crypto", "icon": "storefront"},
        {"id": "vip_community", "title": "Communauté VIP", "description": "Rejoignez un cercle exclusif de passionnés crypto et partagez vos stratégies", "icon": "chatbubbles"},
        {"id": "vip_badge", "title": "Badge VIP", "description": "Affichez votre statut VIP dans la communauté et gagnez en crédibilité", "icon": "diamond"},
    ],
    "en": [
        {"id": "daily_briefing", "title": "Daily Briefing", "description": "Get a daily AI-generated summary of major crypto events and market movements", "icon": "today"},
        {"id": "fear_greed", "title": "Fear & Greed Index", "description": "Track real-time market sentiment with the fear and greed index", "icon": "speedometer"},
        {"id": "rainbow_chart", "title": "Rainbow Chart BTC", "description": "Visualize Bitcoin's current price zone (buy, accumulate, hold, FOMO, sell)", "icon": "color-palette"},
        {"id": "whale_alerts", "title": "Whale Alerts", "description": "Get notified of large crypto whale transactions in real time", "icon": "alert-circle"},
        {"id": "altcoin_season", "title": "Altcoin Season Index", "description": "Determine whether it's altcoin season or Bitcoin season with 90-day data", "icon": "pie-chart"},
        {"id": "halving", "title": "Bitcoin Halving", "description": "Track the countdown to the next Bitcoin halving and its potential impact", "icon": "timer"},
        {"id": "eth_gas", "title": "ETH Gas Tracker", "description": "Check Ethereum gas fees in real time (slow, average, fast)", "icon": "flash"},
        {"id": "liquidations", "title": "Liquidations 24h", "description": "Monitor long and short position liquidations on futures markets", "icon": "flame"},
        {"id": "btc_dominance", "title": "BTC Dominance", "description": "Monitor Bitcoin and Ethereum market share relative to the total market", "icon": "analytics"},
        {"id": "virtual_portfolio", "title": "Virtual Portfolio", "description": "Simulate your investments and track your performance without risking real money", "icon": "wallet"},
        {"id": "custom_alerts", "title": "Custom Alerts", "description": "Set price alerts on your favorite cryptos and never miss an opportunity", "icon": "notifications"},
        {"id": "pro_marketplace", "title": "Pro Marketplace", "description": "Access offers and training from certified crypto trading mentors", "icon": "storefront"},
        {"id": "vip_community", "title": "VIP Community", "description": "Join an exclusive circle of crypto enthusiasts and share your strategies", "icon": "chatbubbles"},
        {"id": "vip_badge", "title": "VIP Badge", "description": "Display your VIP status in the community and gain credibility", "icon": "diamond"},
    ],
    "es": [
        {"id": "daily_briefing", "title": "Briefing Diario", "description": "Recibe un resumen diario generado por IA de los eventos crypto importantes y movimientos del mercado", "icon": "today"},
        {"id": "fear_greed", "title": "Fear & Greed Index", "description": "Sigue el sentimiento del mercado en tiempo real con el índice de miedo y codicia", "icon": "speedometer"},
        {"id": "rainbow_chart", "title": "Rainbow Chart BTC", "description": "Visualiza la zona de precio actual de Bitcoin (compra, acumulación, hold, FOMO, venta)", "icon": "color-palette"},
        {"id": "whale_alerts", "title": "Whale Alerts", "description": "Recibe alertas de grandes transacciones de ballenas crypto en tiempo real", "icon": "alert-circle"},
        {"id": "altcoin_season", "title": "Altcoin Season Index", "description": "Determina si es temporada de altcoins o de Bitcoin con datos de 90 días", "icon": "pie-chart"},
        {"id": "halving", "title": "Bitcoin Halving", "description": "Sigue la cuenta regresiva del próximo halving de Bitcoin y su impacto potencial", "icon": "timer"},
        {"id": "eth_gas", "title": "ETH Gas Tracker", "description": "Consulta las tarifas de gas de Ethereum en tiempo real (lento, medio, rápido)", "icon": "flash"},
        {"id": "liquidations", "title": "Liquidaciones 24h", "description": "Monitorea las liquidaciones de posiciones long y short en los mercados de futuros", "icon": "flame"},
        {"id": "btc_dominance", "title": "Dominancia BTC", "description": "Monitorea la cuota de mercado de Bitcoin y Ethereum respecto al mercado total", "icon": "analytics"},
        {"id": "virtual_portfolio", "title": "Portafolio Virtual", "description": "Simula tus inversiones y sigue tu rendimiento sin arriesgar dinero real", "icon": "wallet"},
        {"id": "custom_alerts", "title": "Alertas Personalizadas", "description": "Crea alertas de precio en tus cryptos favoritas y no pierdas ninguna oportunidad", "icon": "notifications"},
        {"id": "pro_marketplace", "title": "Marketplace Pro", "description": "Accede a ofertas y formaciones de mentores certificados en trading crypto", "icon": "storefront"},
        {"id": "vip_community", "title": "Comunidad VIP", "description": "Únete a un círculo exclusivo de entusiastas crypto y comparte tus estrategias", "icon": "chatbubbles"},
        {"id": "vip_badge", "title": "Insignia VIP", "description": "Muestra tu estatus VIP en la comunidad y gana credibilidad", "icon": "diamond"},
    ],
}

def get_vip_features_for_lang(lang: str = "fr"):
    return VIP_FEATURES.get(lang, VIP_FEATURES["fr"])

async def check_user_vip_status(user_id: str) -> bool:
    """Check if user has active VIP subscription"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return False
    
    if not user.get("is_vip"):
        return False
    
    # Permanent VIP never expires
    if user.get("vip_permanent"):
        return True
    
    vip_expires = user.get("vip_expires_at")
    if vip_expires:
        if isinstance(vip_expires, str):
            vip_expires = datetime.fromisoformat(vip_expires.replace('Z', '+00:00'))
        if vip_expires < datetime.now(timezone.utc):
            # VIP expired, update status
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"is_vip": False}}
            )
            return False
    return True

async def get_user_ai_usage_today(user_id: str) -> int:
    """Get number of AI questions asked today"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = await db.ai_usage.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": today_start}
    })
    return count

@api_router.get("/vip/status")
async def get_vip_status(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user's VIP status"""
    current_user = await get_current_user(credentials)
    
    is_vip = await check_user_vip_status(current_user["id"])
    user = await db.users.find_one({"id": current_user["id"]})
    
    days_remaining = None
    vip_expires_str = None
    is_permanent = user.get("vip_permanent", False)
    
    if is_vip and not is_permanent and user.get("vip_expires_at"):
        vip_expires = user["vip_expires_at"]
        if isinstance(vip_expires, str):
            vip_expires = datetime.fromisoformat(vip_expires.replace('Z', '+00:00'))
        days_remaining = (vip_expires - datetime.now(timezone.utc)).days
        vip_expires_str = vip_expires.isoformat()
    
    # Get AI usage for non-VIP
    ai_usage_today = await get_user_ai_usage_today(current_user["id"])
    ai_remaining = FREE_AI_QUESTIONS_PER_DAY - ai_usage_today if not is_vip else -1
    
    return {
        "is_vip": is_vip,
        "vip_permanent": is_permanent,
        "vip_expires_at": vip_expires_str,
        "days_remaining": "unlimited" if is_permanent else days_remaining,
        "features": get_vip_features_for_lang("fr") if is_vip else [],
        "ai_questions_remaining": max(0, ai_remaining) if ai_remaining >= 0 else "unlimited",
        "price_monthly": VIP_PRICE_USD
    }

@api_router.get("/vip/features")
async def get_vip_features(lang: Optional[str] = None):
    """Get list of VIP features and pricing"""
    return {
        "price_monthly": VIP_PRICE_USD,
        "currency": "USD",
        "features": get_vip_features_for_lang(lang or "fr")
    }

@api_router.post("/vip/checkout")
async def create_vip_checkout(
    request: VIPCheckoutRequest,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create Stripe checkout session for VIP subscription"""
    current_user = await get_current_user(credentials)
    
    # Check if already VIP
    if await check_user_vip_status(current_user["id"]):
        raise HTTPException(status_code=400, detail="You are already a VIP member")
    
    try:
        import stripe as stripe_sdk
        if not STRIPE_API_KEY:
            raise Exception("STRIPE_API_KEY is empty")
        stripe_sdk.api_key = STRIPE_API_KEY
        logger.info(f"Stripe checkout using key: {STRIPE_API_KEY[:15]}...")
        
        host_url = request.origin_url.rstrip('/')
        success_url = f"{host_url}/vip/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{host_url}/vip"
        
        # Determine price based on spots remaining
        config = await db.wave_config.find_one({"_id": "current"})
        wave2_active = (config or {}).get("wave2_active", False)
        price_id = STRIPE_REGULAR_PRICE if wave2_active else STRIPE_FOUNDER_PRICE
        is_founder = not wave2_active
        
        # Create Stripe Checkout Session with pre-created price
        session = stripe_sdk.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=current_user["email"],
            metadata={
                "user_id": current_user["id"],
                "user_email": current_user["email"],
                "subscription_type": "vip_founder" if is_founder else "vip_regular",
                "price_type": "founder" if is_founder else "regular",
                "ref_code": request.ref_code or ""
            }
        )
        
        # Create payment transaction record
        await db.payment_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "user_id": current_user["id"],
            "user_email": current_user["email"],
            "amount": VIP_PRICE_USD if is_founder else 25.99,
            "currency": "usd",
            "status": "pending",
            "payment_status": "initiated",
            "subscription_type": "vip_founder" if is_founder else "vip_regular",
            "is_founder": is_founder,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Created VIP checkout session for user {current_user['id']} ({'founder' if is_founder else 'regular'} price)")
        
        return VIPCheckoutResponse(
            checkout_url=session.url,
            session_id=session.id
        )
        
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création du paiement: {str(e)}")

@api_router.get("/vip/checkout/status/{session_id}")
async def get_checkout_status(
    session_id: str,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Check payment status and activate VIP if successful"""
    current_user = await get_current_user(credentials)
    
    try:
        # Find transaction
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Verify user owns this transaction
        if transaction["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Unauthorized access")
        
        # If already processed, return current status
        if transaction.get("payment_status") == "paid":
            return {
                "status": "complete",
                "payment_status": "paid",
                "message": "Paiement déjà traité - Votre abonnement VIP est actif!"
            }
        
        # Check with Stripe
        host_url = str(http_request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": status.status,
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If paid, activate VIP
        if status.payment_status == "paid":
            vip_expires = datetime.now(timezone.utc) + timedelta(days=VIP_DURATION_DAYS)
            
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {
                    "is_vip": True,
                    "vip_expires_at": vip_expires.isoformat(),
                    "vip_activated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Log the activation
            await db.admin_logs.insert_one({
                "id": str(uuid.uuid4()),
                "action": "vip_activated",
                "admin_id": "system",
                "admin_email": "system",
                "target_type": "user",
                "target_id": current_user["id"],
                "details": f"VIP activé pour {current_user['email']} jusqu'au {vip_expires.strftime('%Y-%m-%d')}",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"VIP activated for user {current_user['id']} until {vip_expires}")
            
            return {
                "status": "complete",
                "payment_status": "paid",
                "message": "Paiement réussi! Votre abonnement VIP est maintenant actif.",
                "vip_expires_at": vip_expires.isoformat()
            }
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "message": "Paiement en cours de traitement..."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Checkout status error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature", "")
        
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            # Find and update transaction
            transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id})
            
            if transaction and transaction.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {
                        "status": "complete",
                        "payment_status": "paid",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Activate VIP
                user_id = webhook_response.metadata.get("user_id")
                if user_id:
                    vip_expires = datetime.now(timezone.utc) + timedelta(days=VIP_DURATION_DAYS)
                    await db.users.update_one(
                        {"id": user_id},
                        {"$set": {
                            "is_vip": True,
                            "vip_expires_at": vip_expires.isoformat(),
                            "vip_activated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    logger.info(f"VIP activated via webhook for user {user_id}")
                    
                    # Increment VIP subscriber count in wave_config
                    await db.wave_config.update_one(
                        {"_id": "current"},
                        {"$inc": {"vip_subscribers": 1}}
                    )
                    
                    # Check if 500 founders reached — activate wave 2 pricing
                    config = await db.wave_config.find_one({"_id": "current"})
                    total_subs = (config or {}).get("vip_subscribers", 0)
                    total_preregs = await db.pre_registrations.count_documents({})
                    if total_subs + total_preregs >= 500:
                        await db.wave_config.update_one(
                            {"_id": "current"},
                            {"$set": {"wave2_active": True}}
                        )
                        logger.info("Wave 2 activated! 500 founders reached.")
                    
                    logger.info(f"VIP subscriber count: {total_subs + 1}")
                    
                    # --- Affiliate conversion tracking ---
                    ref_code = webhook_response.metadata.get("ref_code", "")
                    if ref_code:
                        influencer = await db.influencers.find_one({"code": ref_code, "status": "active"})
                        if influencer:
                            # Check if this user was already converted by this influencer (prevent duplicates)
                            existing = await db.conversions.find_one({"influencer_id": influencer["id"], "user_id": user_id})
                            if not existing:
                                commission = round(VIP_PRICE_USD * influencer.get("commission_rate", DEFAULT_COMMISSION_RATE), 2)
                                conversion = {
                                    "id": str(uuid.uuid4()),
                                    "influencer_id": influencer["id"],
                                    "influencer_name": influencer["name"],
                                    "user_id": user_id,
                                    "user_email": webhook_response.metadata.get("user_email", ""),
                                    "subscription_amount": VIP_PRICE_USD,
                                    "commission": commission,
                                    "commission_rate": influencer.get("commission_rate", DEFAULT_COMMISSION_RATE),
                                    "status": "pending",
                                    "stripe_session_id": webhook_response.session_id,
                                    "created_at": datetime.now(timezone.utc).isoformat()
                                }
                                await db.conversions.insert_one(conversion)
                                logger.info(f"Affiliate conversion recorded: {influencer['name']} -> user {user_id}, commission ${commission}")
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ==================== AI ASSISTANT ROUTES ====================

@api_router.post("/ai/ask", response_model=AIQueryResponse)
async def ask_ai(
    request: AIQueryRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)
):
    """AI assistant for crypto education with usage limits for non-VIP"""
    
    # Check user authentication and VIP status
    user_id = None
    is_vip = False
    
    if credentials:
        try:
            current_user = await get_current_user(credentials)
            user_id = current_user["id"]
            is_vip = await check_user_vip_status(user_id)
        except:
            pass
    
    # Check usage limit for non-VIP users
    if user_id and not is_vip:
        usage_today = await get_user_ai_usage_today(user_id)
        if usage_today >= FREE_AI_QUESTIONS_PER_DAY:
            # Calculate time until reset (midnight UTC)
            now = datetime.now(timezone.utc)
            tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            seconds_until_reset = int((tomorrow - now).total_seconds())
            
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "limit_exceeded",
                    "message": f"Vous avez atteint votre limite de {FREE_AI_QUESTIONS_PER_DAY} questions gratuites aujourd'hui",
                    "questions_used": usage_today,
                    "limit": FREE_AI_QUESTIONS_PER_DAY,
                    "seconds_until_reset": seconds_until_reset,
                    "reset_time": tomorrow.isoformat()
                }
            )
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        system_message = """Tu es Mentova, un assistant IA spécialisé dans l'éducation crypto.
        
Ton rôle est d'aider les débutants à comprendre le monde des cryptomonnaies de manière simple et claire.

Règles importantes:
1. Explique tout de manière simple, comme si tu parlais à quelqu'un qui ne connaît rien en crypto
2. Utilise des analogies et des exemples concrets
3. Mets toujours en garde contre les risques et les arnaques
4. Ne donne JAMAIS de conseils financiers directs
5. Encourage toujours la prudence et la recherche personnelle
6. Réponds en français
7. Sois concis mais complet

Contexte: {context}"""

        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=system_message.format(context=request.context)
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=request.query)
        response = await chat.send_message(user_message)
        
        # Record AI usage for authenticated non-VIP users
        if user_id and not is_vip:
            await db.ai_usage.insert_one({
                "user_id": user_id,
                "query": request.query[:200],  # Store first 200 chars
                "created_at": datetime.now(timezone.utc)
            })
        
        return AIQueryResponse(response=response)
        
    except ImportError:
        raise HTTPException(status_code=500, detail="AI library not installed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

# ==================== TOOLS/CHECKLISTS ROUTES ====================

INVESTMENT_CHECKLIST = [
    {"id": 1, "category": "Fondamentaux", "item": "Le projet résout-il un vrai problème ?", "importance": "high"},
    {"id": 2, "category": "Fondamentaux", "item": "L'équipe est-elle identifiable et crédible ?", "importance": "high"},
    {"id": 3, "category": "Fondamentaux", "item": "Le whitepaper est-il clair et détaillé ?", "importance": "medium"},
    {"id": 4, "category": "Tokenomics", "item": "La distribution des tokens est-elle équitable ?", "importance": "high"},
    {"id": 5, "category": "Tokenomics", "item": "Y a-t-il un mécanisme de burn ou de staking ?", "importance": "medium"},
    {"id": 6, "category": "Communauté", "item": "La communauté est-elle active et engagée ?", "importance": "medium"},
    {"id": 7, "category": "Communauté", "item": "Les réseaux sociaux semblent-ils authentiques ?", "importance": "medium"},
    {"id": 8, "category": "Sécurité", "item": "Le smart contract a-t-il été audité ?", "importance": "high"},
    {"id": 9, "category": "Sécurité", "item": "Le code source est-il open source ?", "importance": "medium"},
    {"id": 10, "category": "Marché", "item": "Le token est-il listé sur des exchanges réputés ?", "importance": "medium"}
]

@api_router.get("/tools/checklist")
async def get_investment_checklist():
    """Get investment checklist"""
    return {"success": True, "data": INVESTMENT_CHECKLIST}


# Community routes moved to routes/community.py


# Admin routes moved to routes/admin.py

# ==================== NEWS ROUTES ====================

from newsdataapi import NewsDataApiClient

# NewsData.io API configuration
NEWSDATA_API_KEY = os.environ.get('NEWSDATA_API_KEY')

# ============ RSS NEWS CACHE ============
RSS_FEEDS = [
    {"url": "https://www.coindesk.com/arc/outboundfeeds/rss/", "source": "CoinDesk"},
    {"url": "https://cointelegraph.com/rss", "source": "CoinTelegraph"},
    {"url": "https://decrypt.co/feed", "source": "Decrypt"},
]
RSS2JSON_BASE = "https://api.rss2json.com/v1/api.json"
_rss_news_cache: Dict[str, Any] = {"articles": [], "fetched_at": 0}
RSS_CACHE_TTL = 600  # 10 minutes

async def _fetch_rss_news():
    """Fetch real-time crypto news from RSS feeds via rss2json."""
    all_articles = []
    async with httpx.AsyncClient(timeout=10) as client:
        for feed in RSS_FEEDS:
            try:
                resp = await client.get(RSS2JSON_BASE, params={"rss_url": feed["url"]})
                if resp.status_code == 200:
                    data = resp.json()
                    for i, item in enumerate(data.get("items", [])):
                        title = item.get("title", "")
                        description = item.get("description", "")
                        # Clean HTML from description
                        import re
                        clean_desc = re.sub(r'<[^>]+>', '', description)[:300]
                        
                        impact, impact_reason = determine_impact_with_reason(title, clean_desc)
                        category = categorize_news(title, clean_desc)
                        
                        # Extract image from enclosure or thumbnail
                        image_url = item.get("thumbnail", "") or item.get("enclosure", {}).get("link", "")
                        if not image_url:
                            image_url = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400"
                        
                        all_articles.append({
                            "id": f"rss-{feed['source'].lower().replace(' ','')}-{i}-{int(time.time())}",
                            "title": title,
                            "summary": clean_desc[:200] if clean_desc else title,
                            "source": feed["source"],
                            "category": category,
                            "impact": impact,
                            "impact_reason": impact_reason,
                            "image_url": image_url,
                            "published_at": item.get("pubDate", datetime.now(timezone.utc).isoformat()),
                            "tags": _extract_tags(title),
                            "language": "en",
                            "link": item.get("link", ""),
                        })
                    logger.info(f"RSS: {feed['source']} → {len(data.get('items', []))} articles")
            except Exception as e:
                logger.warning(f"RSS fetch error ({feed['source']}): {e}")
    
    # Sort by date (newest first)
    all_articles.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    return all_articles

def _extract_tags(title: str) -> list:
    """Extract relevant crypto tags from title."""
    tags = []
    title_lower = title.lower()
    tag_map = {
        "bitcoin": "Bitcoin", "btc": "Bitcoin", "ethereum": "Ethereum", "eth": "Ethereum",
        "solana": "Solana", "sol": "Solana", "defi": "DeFi", "nft": "NFT",
        "layer 2": "Layer 2", "l2": "Layer 2", "regulation": "Regulation",
        "etf": "ETF", "sec": "SEC", "binance": "Binance", "coinbase": "Coinbase",
        "stablecoin": "Stablecoin", "usdt": "USDT", "usdc": "USDC",
        "cardano": "Cardano", "xrp": "XRP", "polygon": "Polygon",
    }
    for keyword, tag in tag_map.items():
        if keyword in title_lower and tag not in tags:
            tags.append(tag)
    return tags[:5] if tags else ["Crypto"]

async def _refresh_rss_cache():
    """Background task to refresh RSS news cache."""
    while True:
        try:
            articles = await _fetch_rss_news()
            if articles:
                _rss_news_cache["articles"] = articles
                _rss_news_cache["fetched_at"] = time.time()
                logger.info(f"RSS cache refreshed: {len(articles)} articles")
        except Exception as e:
            logger.error(f"RSS cache refresh error: {e}")
        await asyncio.sleep(RSS_CACHE_TTL)

def _get_cached_rss_news() -> list:
    """Get cached RSS news, or empty list if cache is stale."""
    if time.time() - _rss_news_cache["fetched_at"] < RSS_CACHE_TTL * 2:
        return _rss_news_cache["articles"]
    return []


# Fallback mock data in case API fails
MOCK_FINANCIAL_NEWS = {
    "fr": [
        {"id": "news-fr-1", "title": "La Fed maintient ses taux : Impact sur Bitcoin", "summary": "La Fed a maintenu ses taux, provoquant une hausse de 3% sur le Bitcoin.", "source": "CryptoNews", "category": "macro", "impact": "bullish", "impact_reason": "Regulation favorable", "image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400", "published_at": "2025-02-21T10:30:00Z", "tags": ["Fed", "Bitcoin"], "language": "fr"},
        {"id": "news-fr-2", "title": "BlackRock augmente ses positions en ETF Bitcoin", "summary": "BlackRock a acheté 5000 BTC supplémentaires pour son ETF.", "source": "Bloomberg Crypto", "category": "institutionnel", "impact": "bullish", "impact_reason": "Interet institutionnel", "image_url": "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400", "published_at": "2025-02-21T09:15:00Z", "tags": ["BlackRock", "ETF"], "language": "fr"},
        {"id": "news-fr-3", "title": "Ethereum : La mise a jour Dencun reduit les frais de 90%", "summary": "Les frais chutent de 90% suite a la mise a jour Dencun.", "source": "Ethereum Foundation", "category": "technologie", "impact": "bullish", "impact_reason": "Amelioration technique", "image_url": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400", "published_at": "2025-02-21T08:00:00Z", "tags": ["Ethereum", "Layer 2"], "language": "fr"},
        {"id": "news-fr-4", "title": "Solana depasse les 200$ apres un rally impressionnant", "summary": "Solana connait une hausse de 15% en 24h.", "source": "CoinDesk", "category": "analyse", "impact": "bullish", "impact_reason": "Hausse des prix", "image_url": "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=400", "published_at": "2025-02-21T07:30:00Z", "tags": ["Solana", "DeFi"], "language": "fr"},
        {"id": "news-fr-5", "title": "L UE finalise le cadre MiCA pour les cryptomonnaies", "summary": "Le cadre MiCA entre en vigueur pour les entreprises crypto.", "source": "Reuters", "category": "regulation", "impact": "bullish", "impact_reason": "Cadre juridique", "image_url": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400", "published_at": "2025-02-21T06:00:00Z", "tags": ["MiCA", "Regulation"], "language": "fr"},
    ],
    "en": [
        {"id": "news-en-1", "title": "Fed Holds Rates Steady: Bitcoin Rallies 3%", "summary": "The Federal Reserve kept rates unchanged, sparking a 3% Bitcoin rally.", "source": "CryptoNews", "category": "macro", "impact": "bullish", "impact_reason": "Favorable regulation", "image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400", "published_at": "2025-02-21T10:30:00Z", "tags": ["Fed", "Bitcoin", "Rates"], "language": "en"},
        {"id": "news-en-2", "title": "BlackRock Increases Bitcoin ETF Holdings", "summary": "BlackRock purchased 5,000 additional BTC for its spot ETF.", "source": "Bloomberg Crypto", "category": "institutional", "impact": "bullish", "impact_reason": "Institutional interest", "image_url": "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400", "published_at": "2025-02-21T09:15:00Z", "tags": ["BlackRock", "ETF"], "language": "en"},
        {"id": "news-en-3", "title": "Ethereum Dencun Upgrade Slashes Gas Fees by 90%", "summary": "Transaction costs drop dramatically with the Dencun upgrade.", "source": "Ethereum Foundation", "category": "technology", "impact": "bullish", "impact_reason": "Technical improvement", "image_url": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400", "published_at": "2025-02-21T08:00:00Z", "tags": ["Ethereum", "Layer 2"], "language": "en"},
        {"id": "news-en-4", "title": "Solana Breaks $200 After Strong Rally", "summary": "Solana surges 15% in 24 hours fueled by DeFi growth.", "source": "CoinDesk", "category": "analysis", "impact": "bullish", "impact_reason": "Price surge", "image_url": "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=400", "published_at": "2025-02-21T07:30:00Z", "tags": ["Solana", "DeFi"], "language": "en"},
        {"id": "news-en-5", "title": "EU Finalizes MiCA Regulatory Framework", "summary": "The MiCA framework provides legal clarity for European crypto businesses.", "source": "Reuters", "category": "regulation", "impact": "bullish", "impact_reason": "Legal framework", "image_url": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400", "published_at": "2025-02-21T06:00:00Z", "tags": ["MiCA", "Regulation"], "language": "en"},
    ],
    "es": [
        {"id": "news-es-1", "title": "La Fed mantiene las tasas: Bitcoin sube un 3%", "summary": "La Reserva Federal mantuvo las tasas, provocando un rally del 3% en Bitcoin.", "source": "CryptoNews", "category": "macro", "impact": "bullish", "impact_reason": "Regulacion favorable", "image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400", "published_at": "2025-02-21T10:30:00Z", "tags": ["Fed", "Bitcoin"], "language": "es"},
        {"id": "news-es-2", "title": "BlackRock aumenta sus posiciones en ETF Bitcoin", "summary": "BlackRock compro 5,000 BTC adicionales para su ETF.", "source": "Bloomberg Crypto", "category": "institucional", "impact": "bullish", "impact_reason": "Interes institucional", "image_url": "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400", "published_at": "2025-02-21T09:15:00Z", "tags": ["BlackRock", "ETF"], "language": "es"},
        {"id": "news-es-3", "title": "Ethereum: Dencun reduce las tarifas un 90%", "summary": "Los costos de transaccion caen con la actualizacion Dencun.", "source": "Ethereum Foundation", "category": "tecnologia", "impact": "bullish", "impact_reason": "Mejora tecnica", "image_url": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400", "published_at": "2025-02-21T08:00:00Z", "tags": ["Ethereum", "Layer 2"], "language": "es"},
        {"id": "news-es-4", "title": "Solana supera los $200 tras un rally impresionante", "summary": "Solana sube un 15% en 24 horas.", "source": "CoinDesk", "category": "analisis", "impact": "bullish", "impact_reason": "Subida de precios", "image_url": "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=400", "published_at": "2025-02-21T07:30:00Z", "tags": ["Solana", "DeFi"], "language": "es"},
        {"id": "news-es-5", "title": "La UE finaliza el marco MiCA para criptomonedas", "summary": "El marco MiCA brinda claridad legal a las empresas cripto.", "source": "Reuters", "category": "regulacion", "impact": "bullish", "impact_reason": "Marco legal", "image_url": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400", "published_at": "2025-02-21T06:00:00Z", "tags": ["MiCA", "Regulacion"], "language": "es"},
    ],
}


def determine_impact_with_reason(title: str, description: str = "") -> tuple:
    """Analyze title and description to determine impact and reason"""
    text = f"{title} {description}".lower()
    
    # Bullish indicators with reasons
    bullish_patterns = {
        "adoption": ["accept", "adopt", "partner", "launch", "integrate", "mainstream"],
        "investment": ["buy", "invest", "accumulate", "hold", "bullish", "long"],
        "price_up": ["surge", "soar", "rally", "gain", "rise", "jump", "spike", "ath", "record", "high", "moon"],
        "institutional": ["blackrock", "fidelity", "grayscale", "jpmorgan", "etf", "institutional", "whale", "billion"],
        "regulation_positive": ["approve", "legal", "clarity", "framework", "support"],
        "tech_upgrade": ["upgrade", "update", "improve", "scale", "faster", "efficient", "2.0"],
        "milestone": ["milestone", "achievement", "breakthrough", "first", "historic"],
    }
    
    # Bearish indicators with reasons
    bearish_patterns = {
        "price_down": ["crash", "plunge", "fall", "drop", "dump", "tank", "low", "bear", "correction"],
        "security": ["hack", "exploit", "vulnerability", "breach", "stolen", "scam", "fraud", "rug"],
        "regulation_negative": ["ban", "restrict", "crackdown", "lawsuit", "sec", "fine", "illegal"],
        "market_fear": ["fear", "panic", "sell", "liquidat", "warning", "risk", "concern"],
        "shutdown": ["shut", "close", "bankrupt", "insolvent", "collapse", "fail"],
        "fud": ["fud", "doubt", "uncertain", "trouble", "problem", "issue"],
    }
    
    # Reason translations (French)
    reason_translations = {
        "adoption": "Adoption massive",
        "investment": "Signal d'achat",
        "price_up": "Hausse des prix",
        "institutional": "Interet institutionnel",
        "regulation_positive": "Regulation favorable",
        "tech_upgrade": "Amelioration technique",
        "milestone": "Etape historique",
        "price_down": "Chute des prix",
        "security": "Probleme securite",
        "regulation_negative": "Regulation negative",
        "market_fear": "Peur du marche",
        "shutdown": "Fermeture/Faillite",
        "fud": "Incertitude",
    }
    
    # Check for bullish patterns
    for reason_key, keywords in bullish_patterns.items():
        if any(kw in text for kw in keywords):
            return "bullish", reason_translations[reason_key]
    
    # Check for bearish patterns
    for reason_key, keywords in bearish_patterns.items():
        if any(kw in text for kw in keywords):
            return "bearish", reason_translations[reason_key]
    
    return "neutral", "Info generale"

def categorize_news(title: str, description: str = "", source_categories: list = None) -> str:
    """Categorize news based on content analysis"""
    text = f"{title} {description}".lower()
    
    category_patterns = {
        "regulation": ["regulation", "regulator", "sec", "cftc", "law", "legal", "ban", "approve", "license", "compliance", "mica", "government"],
        "institutionnel": ["blackrock", "fidelity", "grayscale", "jpmorgan", "goldman", "bank", "institutional", "etf", "fund", "wall street"],
        "technologie": ["upgrade", "update", "protocol", "network", "blockchain", "layer", "smart contract", "dapp", "defi", "nft", "web3", "fork"],
        "securite": ["hack", "exploit", "security", "vulnerability", "breach", "scam", "fraud", "phishing", "attack", "stolen"],
        "macro": ["fed", "federal reserve", "interest rate", "inflation", "economy", "gdp", "market", "stock", "gold", "dollar"],
        "adoption": ["adopt", "accept", "partner", "launch", "integrate", "payment", "merchant", "tesla", "visa", "mastercard"],
        "analyse": ["analysis", "prediction", "forecast", "outlook", "trend", "indicator", "chart", "technical", "on-chain"],
    }
    
    for category, keywords in category_patterns.items():
        if any(kw in text for kw in keywords):
            return category
    
    if source_categories:
        category_map = {"business": "institutionnel", "technology": "technologie", "politics": "regulation", "crime": "securite"}
        for cat in source_categories:
            if cat.lower() in category_map:
                return category_map[cat.lower()]
    
    return "general"

def transform_newsdata_article(article: dict, index: int) -> dict:
    """Transform NewsData.io article to our format with impact reasons"""
    title = article.get("title", "Sans titre")
    description = article.get("description") or article.get("content", "")[:300] or ""
    
    # Determine impact and reason
    impact, impact_reason = determine_impact_with_reason(title, description)
    
    # Categorize the news
    category = categorize_news(title, description, article.get("category", []))
    
    # Extract meaningful tags
    tags = []
    if article.get("ai_tag") and isinstance(article.get("ai_tag"), list):
        tags = [t for t in article["ai_tag"] if isinstance(t, str) and len(t) > 1][:3]
    if not tags and article.get("category"):
        tags = [c.capitalize() for c in article["category"][:2]]
    if not tags:
        tags = ["Crypto"]
    
    summary = description[:200] + "..." if len(description) > 200 else description
    if not summary:
        summary = "Aucune description disponible."
    
    return {
        "id": article.get("article_id", f"news-{index}"),
        "title": title,
        "summary": summary,
        "source": article.get("source_name", article.get("source_id", "Unknown")),
        "category": category,
        "impact": impact,
        "impact_reason": impact_reason,
        "image_url": article.get("image_url") or "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400",
        "published_at": article.get("pubDate", datetime.utcnow().isoformat()),
        "tags": tags,
        "link": article.get("link", ""),
        "language": article.get("language", "en"),
    }

async def translate_news_articles(articles: list, target_lang: str) -> list:
    """Translate news article titles and summaries to target language using AI with cache"""
    if not target_lang or target_lang == "en":
        return articles
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return articles
    
    # Build batch of texts to translate (check cache first)
    texts_to_translate = {}
    cached_results = {}
    
    for i, article in enumerate(articles):
        for field in ["title", "summary"]:
            text = article.get(field, "")
            if not text or not text.strip():
                continue
            cache_key = f"news_{hash(text)}_{target_lang}"
            cached = await db.translation_cache.find_one({"cache_key": cache_key}, {"_id": 0})
            if cached:
                cached_results[f"{i}_{field}"] = cached["translated_text"]
            else:
                texts_to_translate[f"{i}_{field}"] = text
    
    # Apply cached translations
    for key, translated in cached_results.items():
        idx, field = key.split("_", 1)
        articles[int(idx)][field] = translated
    
    if not texts_to_translate:
        return articles
    
    # Batch translate remaining texts
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        lang_names = {"fr": "French", "es": "Spanish", "en": "English"}
        target_name = lang_names.get(target_lang, target_lang)
        
        # Limit batch size to avoid token limits
        batch = dict(list(texts_to_translate.items())[:30])
        
        text_entries = []
        for k, v in batch.items():
            escaped = v.replace('"', '\\"').replace('\n', ' ')
            text_entries.append(f'"{k}": "{escaped}"')
        texts_json = "{\n" + ",\n".join(text_entries) + "\n}"
        
        prompt = f"""Translate these news article texts to {target_name}. Keep JSON keys identical. Return ONLY valid JSON.

{texts_json}"""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message="You are a professional translator. Translate content accurately while maintaining the original tone. Return only valid JSON."
        ).with_model("openai", "gpt-4o-mini")
        
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response if isinstance(response, str) else response.text
        clean = response_text.strip()
        import json as json_module
        clean = clean.replace("```json", "").replace("```", "").strip()
        
        translated = json_module.loads(clean)
        
        for key, text in translated.items():
            if "_" in key:
                idx, field = key.split("_", 1)
                try:
                    articles[int(idx)][field] = text
                except (IndexError, ValueError):
                    pass
                # Cache the translation
                original_text = batch.get(key, "")
                if original_text:
                    cache_key = f"news_{hash(original_text)}_{target_lang}"
                    await db.translation_cache.update_one(
                        {"cache_key": cache_key},
                        {"$set": {"cache_key": cache_key, "translated_text": text, "target_lang": target_lang}},
                        upsert=True
                    )
    except Exception as e:
        logger.warning(f"News translation error: {e}")
    
    return articles

@api_router.get("/news")
async def get_financial_news(
    category: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 25,
    skip: int = 0,
    since: Optional[str] = None,
    lang: Optional[str] = None
):
    """Get real-time financial news from RSS feeds (or NewsData.io fallback)"""
    
    # Try RSS cache first (real-time news)
    rss_articles = _get_cached_rss_news()
    if rss_articles:
        news = rss_articles.copy()
        if category:
            news = [n for n in news if n["category"] == category]
        if query:
            q_lower = query.lower()
            news = [n for n in news if q_lower in n.get("title", "").lower() or q_lower in n.get("summary", "").lower()]
        paginated = news[skip:skip + limit]
        # Translate if needed
        if lang and lang != "en":
            paginated = await translate_news_articles(paginated, lang)
        return {
            "success": True,
            "data": paginated,
            "total": len(news),
            "categories": list(set(n["category"] for n in rss_articles)),
            "source": "rss_live"
        }
    
    # Fallback: check if NewsData API key is configured
    if not NEWSDATA_API_KEY:
        logger.warning("NewsData.io API key not configured, using mock data")
        news = MOCK_FINANCIAL_NEWS.get(lang if lang in MOCK_FINANCIAL_NEWS else "en", MOCK_FINANCIAL_NEWS["en"]).copy()
        if category:
            news = [n for n in news if n["category"] == category]
        paginated = news[skip:skip + limit]
        if lang and lang != "en":
            paginated = await translate_news_articles(paginated, lang)
        return {
            "success": True,
            "data": paginated,
            "total": len(news),
            "categories": ["macro", "institutionnel", "technologie", "regulation", "securite", "analyse", "adoption"],
            "source": "mock"
        }
    
    try:
        # Initialize NewsData.io client with short timeout
        news_client = NewsDataApiClient(apikey=NEWSDATA_API_KEY)
        
        # Build query for crypto/financial news
        search_query = query if query else "bitcoin OR ethereum OR crypto OR cryptocurrency"
        
        # Use asyncio timeout to prevent blocking
        import asyncio
        try:
            # Fetch crypto news from NewsData.io with 5 second timeout
            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: news_client.crypto_api(q=search_query, language=lang if lang in ("en", "fr", "es") else "en")
                ),
                timeout=5.0
            )
        except asyncio.TimeoutError:
            logger.warning("NewsData.io timeout, using mock data")
            news = MOCK_FINANCIAL_NEWS.get(lang if lang in MOCK_FINANCIAL_NEWS else "en", MOCK_FINANCIAL_NEWS["en"]).copy()
            if category:
                news = [n for n in news if n["category"] == category]
            paginated = news[skip:skip + limit]
            if lang and lang != "en":
                paginated = await translate_news_articles(paginated, lang)
            return {
                "success": True,
                "data": paginated,
                "total": len(news),
                "categories": ["macro", "institutionnel", "technologie", "regulation", "securite", "analyse", "adoption"],
                "source": "mock"
            }
        
        if response.get("status") != "success" or not response.get("results"):
            logger.warning("NewsData.io returned no results, using mock data")
            news = MOCK_FINANCIAL_NEWS.get(lang if lang in MOCK_FINANCIAL_NEWS else "en", MOCK_FINANCIAL_NEWS["en"]).copy()
            if category:
                news = [n for n in news if n["category"] == category]
            paginated = news[skip:skip + limit]
            if lang and lang != "en":
                paginated = await translate_news_articles(paginated, lang)
            return {
                "success": True,
                "data": paginated,
                "total": len(news),
                "categories": ["macro", "institutionnel", "technologie", "regulation", "securite", "analyse", "adoption"],
                "source": "mock"
            }
        
        # Transform articles to our format
        articles = response.get("results", [])
        transformed_news = [transform_newsdata_article(article, i) for i, article in enumerate(articles)]
        
        # Supplement with mock data if we have fewer than requested
        live_ids = {n["id"] for n in transformed_news}
        mock_supplement = [n for n in MOCK_FINANCIAL_NEWS.get(lang if lang in MOCK_FINANCIAL_NEWS else "en", MOCK_FINANCIAL_NEWS["en"]) if n["id"] not in live_ids]
        combined_news = transformed_news + mock_supplement
        
        # Filter by category if provided
        if category:
            combined_news = [n for n in combined_news if n["category"] == category]
        
        # Apply pagination
        paginated_news = combined_news[skip:skip + limit]
        
        logger.info(f"Successfully fetched {len(transformed_news)} live + {len(paginated_news) - len([n for n in paginated_news if n in transformed_news])} mock articles")
        
        # Translate if requested
        if lang and lang != "en":
            paginated_news = await translate_news_articles(paginated_news, lang)
        
        return {
            "success": True,
            "data": paginated_news,
            "total": len(combined_news),
            "categories": ["macro", "institutionnel", "technologie", "regulation", "securite", "analyse", "adoption", "general"],
            "source": "newsdata.io",
            "next_page": response.get("nextPage")
        }
        
    except Exception as e:
        logger.error(f"Error fetching news from NewsData.io: {str(e)}")
        # Fallback to mock data
        news = MOCK_FINANCIAL_NEWS.get(lang if lang in MOCK_FINANCIAL_NEWS else "en", MOCK_FINANCIAL_NEWS["en"]).copy()
        if category:
            news = [n for n in news if n["category"] == category]
        paginated = news[skip:skip + limit]
        if lang and lang != "en":
            paginated = await translate_news_articles(paginated, lang)
        return {
            "success": True,
            "data": paginated,
            "total": len(news),
            "categories": ["macro", "institutionnel", "technologie", "regulation", "securite", "analyse", "adoption"],
            "source": "mock",
            "error": str(e)
        }

@api_router.get("/news/trending")
async def get_trending_news(lang: Optional[str] = None):
    """Get trending crypto news - articles with high impact"""
    _trending = {
        "fr": [
            {"title": "Bitcoin dépasse les $100,000 pour la première fois", "summary": "Un moment historique pour le marché crypto alors que BTC franchit un nouveau cap psychologique majeur.", "impact_reason": "Record historique"},
            {"title": "L'Europe adopte la réglementation MiCA", "summary": "Le cadre réglementaire européen pour les cryptomonnaies entre en vigueur, offrant clarté et sécurité aux investisseurs.", "impact_reason": "Régulation favorable"},
            {"title": "Solana dépasse Ethereum en volume de transactions", "summary": "Pour la première fois, le réseau Solana traite plus de transactions quotidiennes qu'Ethereum.", "impact_reason": "Compétition blockchain"},
        ],
        "en": [
            {"title": "Bitcoin surpasses $100,000 for the first time", "summary": "A historic moment for the crypto market as BTC breaks through a major psychological milestone.", "impact_reason": "Historic record"},
            {"title": "Europe adopts MiCA regulation", "summary": "The European regulatory framework for cryptocurrencies comes into effect, offering clarity and security to investors.", "impact_reason": "Favorable regulation"},
            {"title": "Solana surpasses Ethereum in transaction volume", "summary": "For the first time, the Solana network processes more daily transactions than Ethereum.", "impact_reason": "Blockchain competition"},
        ],
        "es": [
            {"title": "Bitcoin supera los $100,000 por primera vez", "summary": "Un momento histórico para el mercado cripto ya que BTC supera una barrera psicológica importante.", "impact_reason": "Récord histórico"},
            {"title": "Europa adopta la regulación MiCA", "summary": "El marco regulatorio europeo para las criptomonedas entra en vigor, ofreciendo claridad y seguridad a los inversores.", "impact_reason": "Regulación favorable"},
            {"title": "Solana supera a Ethereum en volumen de transacciones", "summary": "Por primera vez, la red Solana procesa más transacciones diarias que Ethereum.", "impact_reason": "Competencia blockchain"},
        ],
    }
    l = lang if lang in _trending else "fr"
    base = [
        {"id": "trend-1", "source": "CryptoNews", "category": "macro", "impact": "bullish", "image_url": "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400", "published_at": datetime.utcnow().isoformat(), "tags": ["Bitcoin", "ATH", "Record"], "views": 15420, "trending_score": 98},
        {"id": "trend-2", "source": "EU Crypto", "category": "regulation", "impact": "bullish", "image_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400", "published_at": datetime.utcnow().isoformat(), "tags": ["MiCA", "Europe", "Regulation"], "views": 8750, "trending_score": 85},
        {"id": "trend-3", "source": "DeFi Report", "category": "technologie", "impact": "neutral", "image_url": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400", "published_at": datetime.utcnow().isoformat(), "tags": ["Solana", "Ethereum", "DeFi"], "views": 6230, "trending_score": 72},
    ]
    trending = [{**b, **t} for b, t in zip(base, _trending[l])]
    return {"success": True, "data": trending, "total": len(trending)}

@api_router.get("/news/flash")
async def get_flash_news(lang: Optional[str] = None):
    """Get flash/breaking news alerts"""
    _flash = {
        "fr": [
            "ETF Bitcoin: Afflux record de $1.2B en une journée",
            "Whale Alert: 10,000 BTC transférés vers Coinbase",
            "Ethereum: Gas fees au plus bas depuis 2 ans",
            "PayPal lance les paiements en stablecoin PYUSD",
        ],
        "en": [
            "Bitcoin ETF: Record $1.2B inflow in a single day",
            "Whale Alert: 10,000 BTC transferred to Coinbase",
            "Ethereum: Gas fees at 2-year low",
            "PayPal launches stablecoin PYUSD payments",
        ],
        "es": [
            "ETF Bitcoin: Flujo récord de $1.2B en un día",
            "Alerta Ballena: 10,000 BTC transferidos a Coinbase",
            "Ethereum: Gas fees en mínimos de 2 años",
            "PayPal lanza pagos con stablecoin PYUSD",
        ],
    }
    l = lang if lang in _flash else "fr"
    flash_news = [
        {"id": "flash-1", "type": "breaking", "title": _flash[l][0], "timestamp": datetime.utcnow().isoformat(), "impact": "bullish", "icon": "trending-up"},
        {"id": "flash-2", "type": "alert", "title": _flash[l][1], "timestamp": datetime.utcnow().isoformat(), "impact": "bearish", "icon": "warning"},
        {"id": "flash-3", "type": "update", "title": _flash[l][2], "timestamp": datetime.utcnow().isoformat(), "impact": "bullish", "icon": "flash"},
        {"id": "flash-4", "type": "news", "title": _flash[l][3], "timestamp": datetime.utcnow().isoformat(), "impact": "bullish", "icon": "card"},
    ]
    return {"success": True, "data": flash_news, "total": len(flash_news)}

@api_router.get("/news/{news_id}")
async def get_news_detail(news_id: str):
    """Get detailed news article"""
    for news in MOCK_FINANCIAL_NEWS.get("en", []):
        if news["id"] == news_id:
            return {"success": True, "data": news}
    raise HTTPException(status_code=404, detail="Article not found")

# ==================== VIP FEATURES ROUTES ====================

# VIP Pydantic Models
class AlertCreate(BaseModel):
    crypto_symbol: str
    alert_type: str
    target_value: float
    notification_method: str = "push"

class WalletAddAsset(BaseModel):
    symbol: str
    name: str
    amount: float
    buy_price: float

# VIP Helper functions
def get_user_level(points: int) -> tuple:
    """Get user level based on points"""
    level_thresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000]
    level_names = ["Débutant", "Novice", "Apprenti", "Intermédiaire", "Avancé", 
                  "Expert", "Maître", "Grand Maître", "Légende", "Champion"]
    
    current_level_idx = 0
    for i, threshold in enumerate(level_thresholds):
        if points >= threshold:
            current_level_idx = i
    
    return level_names[current_level_idx], current_level_idx + 1

def get_level_color(level_number: int) -> str:
    """Get color for level"""
    colors = ["#8B8B9E", "#00D9A5", "#3B82F6", "#8B5CF6", "#EC4899", 
             "#FFD700", "#FF6B6B", "#00CED1", "#FF4500", "#FFD700"]
    return colors[min(level_number - 1, len(colors) - 1)]

# Require VIP middleware
async def require_vip(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Middleware to require VIP status"""
    user = await get_current_user(credentials)
    is_vip = await check_user_vip_status(user["id"])
    if not is_vip:
        raise HTTPException(status_code=403, detail="This feature requires a VIP subscription")
    return user

# ==================== ALERTS ====================

@api_router.get("/vip/alerts")
async def get_alerts(user: dict = Depends(require_vip)):
    """Get user's price alerts (VIP only)"""
    alerts = await db.alerts.find({"user_id": user["id"]}).to_list(100)
    return {
        "success": True,
        "data": [{**alert, "_id": None} for alert in alerts],
        "total": len(alerts)
    }

@api_router.post("/vip/alerts")
async def create_alert(alert: AlertCreate, user: dict = Depends(require_vip)):
    """Create a new price alert (VIP only)"""
    alert_data = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "crypto_symbol": alert.crypto_symbol.upper(),
        "alert_type": alert.alert_type,
        "target_value": alert.target_value,
        "notification_method": alert.notification_method,
        "is_triggered": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.alerts.insert_one(alert_data)
    
    # Award achievement
    alerts_count = await db.alerts.count_documents({"user_id": user["id"]})
    if alerts_count == 1:
        await award_achievement(user["id"], "ach-5")
    
    return {"success": True, "data": {**alert_data, "_id": None}}

@api_router.delete("/vip/alerts/{alert_id}")
async def delete_alert(alert_id: str, user: dict = Depends(require_vip)):
    """Delete a price alert"""
    result = await db.alerts.delete_one({"id": alert_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "message": "Alerte supprimée"}

# Popular cryptos list for alerts - cached
POPULAR_CRYPTOS = [
    {"id": "bitcoin", "symbol": "BTC", "name": "Bitcoin"},
    {"id": "ethereum", "symbol": "ETH", "name": "Ethereum"},
    {"id": "binancecoin", "symbol": "BNB", "name": "BNB"},
    {"id": "solana", "symbol": "SOL", "name": "Solana"},
    {"id": "ripple", "symbol": "XRP", "name": "XRP"},
    {"id": "cardano", "symbol": "ADA", "name": "Cardano"},
    {"id": "dogecoin", "symbol": "DOGE", "name": "Dogecoin"},
    {"id": "polkadot", "symbol": "DOT", "name": "Polkadot"},
    {"id": "avalanche-2", "symbol": "AVAX", "name": "Avalanche"},
    {"id": "chainlink", "symbol": "LINK", "name": "Chainlink"},
    {"id": "toncoin", "symbol": "TON", "name": "Toncoin"},
    {"id": "shiba-inu", "symbol": "SHIB", "name": "Shiba Inu"},
    {"id": "litecoin", "symbol": "LTC", "name": "Litecoin"},
    {"id": "polygon", "symbol": "MATIC", "name": "Polygon"},
    {"id": "uniswap", "symbol": "UNI", "name": "Uniswap"},
    {"id": "cosmos", "symbol": "ATOM", "name": "Cosmos"},
    {"id": "aptos", "symbol": "APT", "name": "Aptos"},
    {"id": "arbitrum", "symbol": "ARB", "name": "Arbitrum"},
    {"id": "optimism", "symbol": "OP", "name": "Optimism"},
    {"id": "near", "symbol": "NEAR", "name": "NEAR Protocol"},
]

@api_router.get("/vip/alerts/cryptos")
async def get_available_cryptos(user: dict = Depends(require_vip)):
    """Get list of available cryptos for alerts with real-time prices"""
    try:
        async with httpx.AsyncClient() as client:
            # Get prices for popular cryptos
            ids = ",".join([c["id"] for c in POPULAR_CRYPTOS])
            prices_resp = await client.get(
                f"https://api.coingecko.com/api/v3/simple/price",
                params={"ids": ids, "vs_currencies": "usd", "include_24hr_change": "true"},
                timeout=10.0
            )
            
            prices = prices_resp.json() if prices_resp.status_code == 200 else {}
            
            result = []
            for crypto in POPULAR_CRYPTOS:
                price_data = prices.get(crypto["id"], {})
                result.append({
                    "id": crypto["id"],
                    "symbol": crypto["symbol"],
                    "name": crypto["name"],
                    "current_price": price_data.get("usd", 0),
                    "change_24h": round(price_data.get("usd_24h_change", 0) or 0, 2)
                })
            
            return {"success": True, "data": result}
    except Exception as e:
        logger.warning(f"Error fetching cryptos: {e}")
        # Return list without prices
        return {
            "success": True,
            "data": [{"id": c["id"], "symbol": c["symbol"], "name": c["name"], "current_price": 0, "change_24h": 0} for c in POPULAR_CRYPTOS]
        }

@api_router.get("/vip/alerts/check/{crypto_symbol}")
async def check_crypto_price(crypto_symbol: str, user: dict = Depends(require_vip)):
    """Get real-time price for a specific crypto"""
    try:
        # Find crypto id from symbol
        crypto = next((c for c in POPULAR_CRYPTOS if c["symbol"].upper() == crypto_symbol.upper()), None)
        if not crypto:
            raise HTTPException(status_code=404, detail="Crypto not found")
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.coingecko.com/api/v3/simple/price",
                params={"ids": crypto["id"], "vs_currencies": "usd", "include_24hr_change": "true", "include_24hr_vol": "true"},
                timeout=10.0
            )
            
            if resp.status_code == 200:
                data = resp.json().get(crypto["id"], {})
                return {
                    "success": True,
                    "data": {
                        "symbol": crypto["symbol"],
                        "name": crypto["name"],
                        "current_price": data.get("usd", 0),
                        "change_24h": round(data.get("usd_24h_change", 0) or 0, 2),
                        "volume_24h": data.get("usd_24h_vol", 0)
                    }
                }
            else:
                raise HTTPException(status_code=503, detail="Service temporairement indisponible")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking price: {e}")
        raise HTTPException(status_code=500, detail="Error verifying price")

# ==================== SMART MONEY ====================

@api_router.get("/vip/smart-money")
async def get_smart_money(
    limit: int = 20,
    crypto: str = None,
    user: dict = Depends(require_vip)
):
    """Get Smart Money (whale) transactions - REAL transactions from Etherscan"""
    import random
    
    # REAL known whale addresses with their identities
    REAL_WHALES = [
        {
            "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
            "name": "Vitalik Buterin",
            "type": "ethereum_founder"
        },
        {
            "address": "0x28C6c06298d514Db089934071355E5743bf21d60",
            "name": "Binance Hot Wallet",
            "type": "exchange"
        },
        {
            "address": "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549",
            "name": "Binance Cold Wallet",
            "type": "exchange"
        },
        {
            "address": "0xA090e606E30bD747d4E6245a1517EbE430F0057e",
            "name": "Coinbase Prime",
            "type": "exchange"
        },
        {
            "address": "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503",
            "name": "Binance Treasury",
            "type": "exchange"
        },
        {
            "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2Bd3B",
            "name": "Kraken Hot Wallet",
            "type": "exchange"
        },
        {
            "address": "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
            "name": "Binance Mega Wallet",
            "type": "exchange"
        },
        {
            "address": "0xF977814e90dA44bFA03b6295A0616a897441aceC",
            "name": "Binance 8",
            "type": "exchange"
        }
    ]
    
    transactions = []
    
    try:
        async with httpx.AsyncClient() as http_client:
            # Get current ETH price from CoinGecko
            eth_price = 3200  # Default
            try:
                price_resp = await http_client.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": "ethereum", "vs_currencies": "usd"},
                    timeout=5.0
                )
                if price_resp.status_code == 200:
                    eth_price = price_resp.json().get("ethereum", {}).get("usd", 3200)
            except:
                pass
            
            # Get Etherscan API key from environment
            etherscan_api_key = os.environ.get('ETHERSCAN_API_KEY', '')
            
            # Fetch REAL transactions from Etherscan V2 API with API key
            for whale in REAL_WHALES[:8]:  # Get more whales with API key
                try:
                    params = {
                        "chainid": 1,  # Ethereum mainnet
                        "module": "account",
                        "action": "txlist",
                        "address": whale["address"],
                        "startblock": 0,
                        "endblock": 99999999,
                        "page": 1,
                        "offset": 5,  # Get last 5 transactions per whale
                        "sort": "desc"
                    }
                    
                    # Add API key if available
                    if etherscan_api_key:
                        params["apikey"] = etherscan_api_key
                    
                    tx_resp = await http_client.get(
                        "https://api.etherscan.io/v2/api",  # V2 endpoint
                        params=params,
                        timeout=10.0
                    )
                    
                    if tx_resp.status_code == 200:
                        tx_data = tx_resp.json()
                        if tx_data.get("status") == "1" and tx_data.get("result") and isinstance(tx_data["result"], list):
                            for tx in tx_data["result"]:
                                value_eth = int(tx.get("value", 0)) / 1e18
                                # Include all transactions with any value (even 0 for contract interactions)
                                is_incoming = tx.get("to", "").lower() == whale["address"].lower()
                                
                                tx_timestamp = int(tx.get("timeStamp", 0))
                                tx_datetime = datetime.fromtimestamp(tx_timestamp, tz=timezone.utc)
                                
                                # Only show transactions from the last 30 days
                                if (datetime.now(timezone.utc) - tx_datetime).days <= 30:
                                    transactions.append({
                                        "id": tx.get("hash", "")[:16],
                                        "whale_address": whale["address"],
                                        "whale_name": whale["name"],
                                        "whale_type": whale["type"],
                                        "transaction_type": "buy" if is_incoming else "sell",
                                        "crypto_symbol": "ETH",
                                        "crypto_name": "Ethereum",
                                        "amount": round(value_eth, 6) if value_eth > 0 else 0,
                                        "usd_value": round(value_eth * eth_price, 2) if value_eth > 0 else 0,
                                        "timestamp": tx_datetime.isoformat(),
                                        "tx_hash": tx.get("hash", ""),
                                        "block_number": tx.get("blockNumber", ""),
                                        "gas_used": tx.get("gasUsed", ""),
                                        "from_address": tx.get("from", ""),
                                        "to_address": tx.get("to", ""),
                                        "etherscan_tx_url": f"https://etherscan.io/tx/{tx.get('hash', '')}",
                                        "address_url": f"https://etherscan.io/address/{whale['address']}",
                                        "is_real_transaction": True
                                    })
                    
                    # Small delay to avoid rate limiting
                    await asyncio.sleep(0.35)
                    
                except Exception as e:
                    logger.warning(f"Error fetching tx for {whale['name']}: {e}")
                    continue
                    
    except Exception as e:
        logger.error(f"Etherscan API error: {e}")
    
    # Sort by timestamp (most recent first)
    transactions.sort(key=lambda x: x["timestamp"], reverse=True)
    
    # Track for achievements
    await db.users.update_one({"id": user["id"]}, {"$inc": {"smart_money_views": 1}})
    
    buy_vol = sum(t["usd_value"] for t in transactions if t["transaction_type"] == "buy")
    sell_vol = sum(t["usd_value"] for t in transactions if t["transaction_type"] == "sell")
    
    return {
        "success": True,
        "data": transactions[:limit],
        "summary": {
            "total_buy_volume": buy_vol,
            "total_sell_volume": sell_vol,
            "net_flow": buy_vol - sell_vol,
            "sentiment": "bullish" if buy_vol > sell_vol else "bearish",
            "whale_count": len(transactions),
            "last_updated": datetime.now(timezone.utc).isoformat()
        },
        "whales": REAL_WHALES,
        "note": "Transactions réelles depuis Etherscan. Cliquez sur le hash pour vérifier.",
        "coming_soon": "Plus de whales et traders célèbres bientôt disponibles!"
    }


# ==================== WALLET / PORTFOLIO ====================

# Price cache for rate limit management
_price_cache = {"data": {}, "last_update": None}

async def get_crypto_prices_cached():
    """Get crypto prices with caching to avoid rate limits"""
    global _price_cache
    now = datetime.now(timezone.utc)
    
    # Cache for 2 minutes
    if _price_cache["last_update"] and (now - _price_cache["last_update"]).seconds < 120:
        return _price_cache["data"]
    
    # Real prices with fallback
    real_prices = {
        "BTC": 95000, "ETH": 3200, "SOL": 180, "BNB": 620, "XRP": 2.5,
        "DOGE": 0.35, "ADA": 0.95, "AVAX": 38, "LINK": 22, "DOT": 7.5,
        "MATIC": 0.85, "UNI": 12, "ATOM": 9, "LTC": 105, "SHIB": 0.000025,
        "USDT": 1, "USDC": 1
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,cardano,avalanche-2,chainlink,polkadot", "vs_currencies": "usd"},
                timeout=5.0
            )
            if resp.status_code == 200:
                data = resp.json()
                symbol_map = {
                    "bitcoin": "BTC", "ethereum": "ETH", "solana": "SOL",
                    "binancecoin": "BNB", "ripple": "XRP", "dogecoin": "DOGE",
                    "cardano": "ADA", "avalanche-2": "AVAX", "chainlink": "LINK", "polkadot": "DOT"
                }
                for coin_id, prices in data.items():
                    if coin_id in symbol_map and "usd" in prices:
                        real_prices[symbol_map[coin_id]] = prices["usd"]
    except Exception as e:
        logger.warning(f"Price fetch error: {e}")
    
    _price_cache = {"data": real_prices, "last_update": now}
    return real_prices

@api_router.get("/vip/wallet")
async def get_wallet(user: dict = Depends(require_vip)):
    """Get user's portfolio wallet with REAL prices"""
    assets = await db.wallet_assets.find({"user_id": user["id"]}).to_list(100)
    
    prices = await get_crypto_prices_cached()
    total_value = 0
    total_invested = 0
    
    for asset in assets:
        current_price = prices.get(asset["symbol"].upper(), asset.get("buy_price", 0) * 1.05)
        asset["current_price"] = current_price
        asset["current_value"] = round(current_price * asset["amount"], 2)
        asset["invested_value"] = round(asset["buy_price"] * asset["amount"], 2)
        asset["profit_loss"] = round(asset["current_value"] - asset["invested_value"], 2)
        asset["profit_loss_percent"] = round(((asset["current_value"] - asset["invested_value"]) / asset["invested_value"] * 100), 2) if asset["invested_value"] > 0 else 0
        total_value += asset["current_value"]
        total_invested += asset["invested_value"]
    
    return {
        "success": True,
        "data": [{**a, "_id": None} for a in assets],
        "summary": {
            "total_value": round(total_value, 2),
            "total_invested": round(total_invested, 2),
            "total_profit_loss": round(total_value - total_invested, 2),
            "total_profit_loss_percent": round(((total_value - total_invested) / total_invested * 100), 2) if total_invested > 0 else 0,
            "asset_count": len(assets)
        }
    }

@api_router.post("/vip/wallet")
async def add_wallet_asset(asset: WalletAddAsset, user: dict = Depends(require_vip)):
    """Add asset to portfolio (VIP only)"""
    asset_data = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "symbol": asset.symbol.upper(),
        "name": asset.name,
        "amount": asset.amount,
        "buy_price": asset.buy_price,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wallet_assets.insert_one(asset_data)
    
    # Check achievement
    assets_count = await db.wallet_assets.count_documents({"user_id": user["id"]})
    if assets_count >= 5:
        await award_achievement(user["id"], "ach-4")
    
    return {"success": True, "data": {**asset_data, "_id": None}}

@api_router.delete("/vip/wallet/{asset_id}")
async def remove_wallet_asset(asset_id: str, user: dict = Depends(require_vip)):
    """Remove asset from portfolio"""
    result = await db.wallet_assets.delete_one({"id": asset_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"success": True, "message": "Actif supprimé"}

@api_router.get("/vip/wallet/balance/{address}")
async def get_wallet_balance(address: str, user: dict = Depends(require_vip)):
    """Fetch wallet balance for any blockchain address via backend (avoids CORS)"""
    address = address.strip()
    
    # Detect blockchain type
    addr_lower = address.lower()
    if address.startswith('bc1') or (address.startswith('1') and len(address) >= 26 and len(address) <= 35) or (address.startswith('3') and len(address) >= 26 and len(address) <= 35):
        chain = 'bitcoin'
    elif address.startswith('0x') and len(address) == 42:
        chain = 'evm'
    elif addr_lower.startswith('bnb1'):
        chain = 'bnb'
    elif address.startswith('T') and len(address) == 34:
        chain = 'tron'
    elif address.startswith('r') and len(address) >= 25 and len(address) <= 35:
        chain = 'xrp'
    elif addr_lower.startswith('addr1'):
        chain = 'cardano'
    elif address.startswith('L') or address.startswith('M') or addr_lower.startswith('ltc1'):
        chain = 'litecoin'
    elif address.startswith('D') and len(address) >= 34:
        chain = 'dogecoin'
    elif addr_lower.startswith('cosmos') or addr_lower.startswith('osmo') or addr_lower.startswith('juno') or addr_lower.startswith('terra'):
        chain = 'cosmos'
    elif len(address) >= 32 and len(address) <= 44 and not address.startswith('0x'):
        chain = 'solana'
    else:
        chain = 'other'
    
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            if chain == 'bitcoin':
                # Try mempool.space first, then blockstream
                for api_url in [
                    f"https://mempool.space/api/address/{address}",
                    f"https://blockstream.info/api/address/{address}"
                ]:
                    try:
                        resp = await client.get(api_url)
                        if resp.status_code == 200:
                            data = resp.json()
                            funded = data.get('chain_stats', {}).get('funded_txo_sum', 0)
                            spent = data.get('chain_stats', {}).get('spent_txo_sum', 0)
                            mem_funded = data.get('mempool_stats', {}).get('funded_txo_sum', 0)
                            mem_spent = data.get('mempool_stats', {}).get('spent_txo_sum', 0)
                            total_sats = (funded - spent) + (mem_funded - mem_spent)
                            btc = total_sats / 100000000
                            return {"success": True, "balance": f"{btc:.8f}", "symbol": "BTC", "chain": "bitcoin"}
                    except Exception as e:
                        logger.warning(f"Bitcoin API {api_url} failed: {e}")
                        continue
                return {"success": False, "error": "invalid_address", "message": "Adresse Bitcoin invalide ou introuvable"}
            
            elif chain == 'evm':
                # Use public ETH RPC
                resp = await client.post("https://eth.llamarpc.com", json={
                    "jsonrpc": "2.0", "id": 1, "method": "eth_getBalance", "params": [address, "latest"]
                })
                if resp.status_code == 200:
                    data = resp.json()
                    hex_balance = data.get("result", "0x0")
                    wei = int(hex_balance, 16)
                    eth = wei / 1e18
                    return {"success": True, "balance": f"{eth:.6f}", "symbol": "ETH", "chain": "evm"}
                return {"success": False, "error": "rpc_error", "message": "Erreur RPC Ethereum"}
            
            elif chain == 'solana':
                resp = await client.post("https://api.mainnet-beta.solana.com", json={
                    "jsonrpc": "2.0", "id": 1, "method": "getBalance", "params": [address]
                })
                if resp.status_code == 200:
                    data = resp.json()
                    if "error" in data:
                        return {"success": False, "error": "invalid_address", "message": "Adresse Solana invalide"}
                    lamports = data.get("result", {}).get("value", 0)
                    sol = lamports / 1e9
                    return {"success": True, "balance": f"{sol:.4f}", "symbol": "SOL", "chain": "solana"}
                return {"success": False, "error": "rpc_error", "message": "Erreur RPC Solana"}
            
            elif chain == 'tron':
                resp = await client.post("https://api.trongrid.io/wallet/getaccount", json={
                    "address": address, "visible": True
                })
                if resp.status_code == 200:
                    data = resp.json()
                    balance_sun = data.get("balance", 0)
                    trx = balance_sun / 1e6
                    return {"success": True, "balance": f"{trx:.2f}", "symbol": "TRX", "chain": "tron"}
                return {"success": True, "balance": "0.00", "symbol": "TRX", "chain": "tron"}
            
            elif chain == 'xrp':
                resp = await client.get(f"https://api.xrpscan.com/api/v1/account/{address}")
                if resp.status_code == 200:
                    data = resp.json()
                    xrp_balance = data.get("xrpBalance", "0")
                    return {"success": True, "balance": f"{float(xrp_balance):.2f}", "symbol": "XRP", "chain": "xrp"}
                return {"success": True, "balance": "0.00", "symbol": "XRP", "chain": "xrp"}
            
            elif chain == 'litecoin':
                resp = await client.get(f"https://litecoinspace.org/api/address/{address}")
                if resp.status_code == 200:
                    data = resp.json()
                    funded = data.get('chain_stats', {}).get('funded_txo_sum', 0)
                    spent = data.get('chain_stats', {}).get('spent_txo_sum', 0)
                    total = (funded - spent) / 1e8
                    return {"success": True, "balance": f"{total:.8f}", "symbol": "LTC", "chain": "litecoin"}
                return {"success": True, "balance": "0.00", "symbol": "LTC", "chain": "litecoin"}
            
            elif chain == 'dogecoin':
                resp = await client.get(f"https://dogechain.info/api/v1/address/balance/{address}")
                if resp.status_code == 200:
                    data = resp.json()
                    balance = data.get("balance", "0")
                    return {"success": True, "balance": f"{float(balance):.2f}", "symbol": "DOGE", "chain": "dogecoin"}
                return {"success": True, "balance": "0.00", "symbol": "DOGE", "chain": "dogecoin"}
            
            elif chain == 'cardano':
                return {"success": True, "balance": "Connected", "symbol": "ADA", "chain": "cardano"}
            
            elif chain == 'bnb':
                return {"success": True, "balance": "Connected", "symbol": "BNB", "chain": "bnb"}
            
            elif chain == 'cosmos':
                return {"success": True, "balance": "Connected", "symbol": "ATOM", "chain": "cosmos"}
            
            else:
                # Accept any address as a generic connected wallet
                return {"success": True, "balance": "Connected", "symbol": "CRYPTO", "chain": "other"}
    except Exception as e:
        logger.error(f"Wallet balance error for {address}: {str(e)}")
        return {"success": False, "error": "fetch_error", "message": str(e)}

# ==================== GAMIFICATION ====================

# Achievements definitions - stored in memory, tracked in DB
VIP_ACHIEVEMENTS = [
    {"id": "ach-1", "title": "Premier Pas", "description": "Créer votre premier compte", "icon": "person-add", "points": 10},
    {"id": "ach-2", "title": "Explorateur", "description": "Consulter 10 articles de news", "icon": "newspaper", "points": 20},
    {"id": "ach-3", "title": "Première Alerte", "description": "Créer votre première alerte de prix", "icon": "notifications", "points": 25},
    {"id": "ach-4", "title": "Investisseur", "description": "Ajouter 5 actifs à votre portfolio", "icon": "wallet", "points": 50},
    {"id": "ach-5", "title": "Observateur", "description": "Consulter Smart Money 10 fois", "icon": "eye", "points": 30},
    {"id": "ach-6", "title": "Étudiant", "description": "Commencer un cours", "icon": "school", "points": 15},
    {"id": "ach-7", "title": "Diplômé", "description": "Terminer un cours", "icon": "ribbon", "points": 75},
    {"id": "ach-8", "title": "Réseau", "description": "Suivre 3 traders", "icon": "people", "points": 35},
    {"id": "ach-9", "title": "Whale Watcher", "description": "Consulter Smart Money 50 fois", "icon": "fish", "points": 100},
    {"id": "ach-10", "title": "IA Explorer", "description": "Poser 10 questions à l'IA", "icon": "sparkles", "points": 40},
    {"id": "ach-11", "title": "Social", "description": "Publier un post VIP", "icon": "chatbubbles", "points": 20},
    {"id": "ach-12", "title": "Influenceur", "description": "Recevoir 50 likes", "icon": "heart", "points": 100},
]

async def award_achievement(user_id: str, achievement_id: str):
    """Award an achievement to a user"""
    existing = await db.user_achievements.find_one({
        "user_id": user_id,
        "achievement_id": achievement_id
    })
    if existing:
        return  # Already has achievement
    
    achievement = next((a for a in VIP_ACHIEVEMENTS if a["id"] == achievement_id), None)
    if not achievement:
        return
    
    await db.user_achievements.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "achievement_id": achievement_id,
        "unlocked_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Add points
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"gamification_points": achievement["points"]}}
    )

@api_router.get("/vip/achievements")
async def get_achievements(user: dict = Depends(require_vip)):
    """Get user's achievements (VIP only)"""
    user_achievements = await db.user_achievements.find({"user_id": user["id"]}).to_list(100)
    unlocked_ids = {ua["achievement_id"] for ua in user_achievements}
    
    achievements = []
    for ach in VIP_ACHIEVEMENTS:
        unlocked = ach["id"] in unlocked_ids
        unlocked_at = None
        if unlocked:
            ua = next((a for a in user_achievements if a["achievement_id"] == ach["id"]), None)
            unlocked_at = ua["unlocked_at"] if ua else None
        
        achievements.append({
            **ach,
            "unlocked": unlocked,
            "unlocked_at": unlocked_at
        })
    
    return {
        "success": True,
        "data": achievements,
        "total_unlocked": len(unlocked_ids),
        "total_achievements": len(VIP_ACHIEVEMENTS)
    }

@api_router.get("/vip/leaderboard")
async def get_leaderboard(limit: int = 20, user: dict = Depends(require_vip)):
    """Get gamification leaderboard (VIP only)"""
    users = await db.users.find(
        {"gamification_points": {"$gt": 0}},
        {"id": 1, "name": 1, "gamification_points": 1, "is_vip": 1, "_id": 0}
    ).sort("gamification_points", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for i, u in enumerate(users):
        points = u.get("gamification_points", 0)
        leaderboard.append({
            "rank": i + 1,
            "user_id": u["id"],
            "username": u.get("name", "Utilisateur"),
            "points": points,
            "level": get_user_level(points),
            "level_color": get_level_color(get_user_level(points)),
            "is_vip": u.get("is_vip", False),
            "is_current_user": u["id"] == user["id"]
        })
    
    # Get current user's rank if not in top
    current_user_in_list = any(e["user_id"] == user["id"] for e in leaderboard)
    current_user_rank = None
    if not current_user_in_list:
        user_data = await db.users.find_one({"id": user["id"]})
        points = user_data.get("gamification_points", 0)
        higher_count = await db.users.count_documents({"gamification_points": {"$gt": points}})
        current_user_rank = {
            "rank": higher_count + 1,
            "user_id": user["id"],
            "username": user.get("name", "Vous"),
            "points": points,
            "level": get_user_level(points),
            "is_current_user": True
        }
    
    return {
        "success": True,
        "data": leaderboard,
        "current_user_rank": current_user_rank
    }

@api_router.get("/vip/gamification/stats")
async def get_gamification_stats(user: dict = Depends(require_vip)):
    """Get user's gamification stats (VIP only)"""
    user_data = await db.users.find_one({"id": user["id"]})
    points = user_data.get("gamification_points", 0)
    level_name, level_number = get_user_level(points)
    
    # Get achievements count
    achievements_count = await db.user_achievements.count_documents({"user_id": user["id"]})
    
    # Calculate points to next level
    level_thresholds = {"Débutant": 50, "Novice": 100, "Apprenti": 200, "Intermédiaire": 400, "Avancé": 700, 
                       "Expert": 1000, "Maître": 1500, "Grand Maître": 2500, "Légende": 4000, "Champion": float('inf')}
    next_level_points = level_thresholds.get(level_name, 50)
    
    return {
        "success": True,
        "data": {
            "points": points,
            "level": level_name,
            "level_number": level_number,
            "level_color": get_level_color(level_number),
            "achievements_unlocked": achievements_count,
            "total_achievements": len(VIP_ACHIEVEMENTS),
            "points_to_next_level": max(0, next_level_points - points),
            "progress_percent": min(100, (points / next_level_points * 100)) if next_level_points != float('inf') else 100
        }
    }

# ==================== ADVANCED ACADEMY ====================

# VIP Courses definitions
VIP_COURSES_DATA = {
    "fr": [
        {
            "id": "tool-fear-greed", "title": "Fear & Greed Index", "description": "Apprenez à lire et utiliser l'indice de peur et d'avidité pour prendre de meilleures décisions d'investissement.",
            "modules": 3, "duration": "15 min", "difficulty": "debutant", "icon": "speedometer", "color": "#FFD700",
            "module_content": [
                {"id": 1, "title": "Qu'est-ce que le Fear & Greed ?", "duration": "5 min", "content": "L'indice Fear & Greed mesure le sentiment du marché crypto sur une échelle de 0 à 100.\n\n0-24 = Peur extrême : Les investisseurs paniquent et vendent. C'est historiquement un bon moment pour acheter.\n\n25-49 = Peur : Le marché est nerveux mais pas en panique.\n\n50-74 = Avidité : L'optimisme domine. Les prix montent.\n\n75-100 = Avidité extrême : L'euphorie règne. Attention au retournement.\n\nL'indice utilise la volatilité, le volume, les réseaux sociaux, la dominance BTC et les tendances Google."},
                {"id": 2, "title": "Comment l'utiliser en trading", "duration": "5 min", "content": "Stratégie contrarian :\n\n- Quand l'indice est sous 20 (peur extrême), c'est souvent le moment d'accumuler. 'Be greedy when others are fearful.'\n\n- Quand l'indice dépasse 80 (avidité extrême), envisagez de prendre des profits.\n\nAttention : L'indice seul ne suffit pas. Combinez-le avec d'autres outils comme le Rainbow Chart et les Whale Alerts pour confirmer vos décisions.\n\nSur Mentova, consultez l'indice quotidiennement dans l'onglet Outils VIP."},
                {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [
                    {"q": "Que signifie un Fear & Greed à 15 ?", "options": ["Avidité extrême", "Peur extrême", "Marché neutre", "Peur modérée"], "answer": 1},
                    {"q": "Quelle stratégie est recommandée en peur extrême ?", "options": ["Vendre tout", "Ne rien faire", "Accumuler progressivement", "Shorter le marché"], "answer": 2},
                    {"q": "Quels facteurs composent l'indice ?", "options": ["Uniquement le prix", "Volatilité, volume, réseaux sociaux, dominance BTC", "Les tweets d'Elon Musk", "Le hash rate Bitcoin"], "answer": 1}
                ]}
            ]
        },
        {
            "id": "tool-rainbow", "title": "Rainbow Chart BTC", "description": "Maîtrisez le Rainbow Chart pour identifier les zones d'achat et de vente idéales du Bitcoin.",
            "modules": 3, "duration": "15 min", "difficulty": "debutant", "icon": "color-palette", "color": "#F97316",
            "module_content": [
                {"id": 1, "title": "Comprendre le Rainbow Chart", "duration": "5 min", "content": "Le Rainbow Chart est un outil d'analyse long terme qui utilise une courbe logarithmique pour diviser le prix du Bitcoin en zones colorées :\n\n🔵 Bleu foncé (Fire Sale) : Prix très bas, opportunité rare\n🟢 Vert (Accumulate) : Zone d'accumulation idéale\n🟡 Jaune (Hold) : Prix juste, gardez vos positions\n🟠 Orange (FOMO) : Le marché chauffe, prudence\n🔴 Rouge (Sell/Bubble) : Zone de bulle, prenez des profits\n\nCet outil fonctionne mieux sur des horizons de plusieurs mois à années."},
                {"id": 2, "title": "Stratégies avec le Rainbow Chart", "duration": "5 min", "content": "DCA intelligent :\n\nUtilisez le Rainbow Chart pour ajuster votre DCA (Dollar Cost Averaging) :\n\n- Zone bleue/verte : Augmentez vos achats réguliers\n- Zone jaune : Maintenez votre DCA normal\n- Zone orange : Réduisez vos achats\n- Zone rouge : Arrêtez d'acheter, prenez des profits\n\nHistoriquement, acheter en zone bleue/verte et vendre en zone orange/rouge a toujours été profitable sur le long terme.\n\nSur Mentova, la zone actuelle est affichée directement dans vos Outils VIP."},
                {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [
                    {"q": "Que signifie la zone bleue du Rainbow Chart ?", "options": ["Zone de bulle", "Fire Sale - prix très bas", "Zone de hold", "Zone FOMO"], "answer": 1},
                    {"q": "Comment ajuster son DCA en zone orange ?", "options": ["Acheter plus", "Réduire ses achats", "Tout vendre", "Emprunter pour acheter"], "answer": 1},
                    {"q": "Sur quel horizon fonctionne le Rainbow Chart ?", "options": ["Minutes", "Heures", "Jours", "Mois à années"], "answer": 3}
                ]}
            ]
        },
        {
            "id": "tool-whale", "title": "Whale Alerts", "description": "Interprétez les mouvements des baleines crypto pour anticiper les tendances du marché.",
            "modules": 3, "duration": "15 min", "difficulty": "intermediaire", "icon": "alert-circle", "color": "#EC4899",
            "module_content": [
                {"id": 1, "title": "Qui sont les baleines ?", "duration": "5 min", "content": "Les baleines (whales) sont des entités détenant d'énormes quantités de crypto :\n\n- Bitcoin : >1 000 BTC (~$100M+)\n- Ethereum : >10 000 ETH\n\nLeurs mouvements impactent significativement les marchés. Types de baleines :\n\n1. Institutionnels (fonds, ETFs)\n2. Mineurs historiques\n3. Exchanges\n4. Gouvernements (BTC saisis)\n\nSuivre leurs transactions vous donne un avantage informationnel."},
                {"id": 2, "title": "Interpréter les alertes", "duration": "5 min", "content": "Signaux clés :\n\n📤 BTC envoyé vers un exchange → Signal de vente potentiel. La baleine prépare une liquidation.\n\n📥 BTC retiré d'un exchange → Signal haussier. La baleine accumule en cold storage.\n\n🔄 Transfert entre wallets → Réorganisation. Généralement neutre.\n\n💰 Gros achat OTC → Très haussier. Achat institutionnel discret.\n\nSur Mentova, vous recevez ces alertes en temps réel dans l'onglet Outils VIP avec le type de mouvement et son impact potentiel."},
                {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [
                    {"q": "Un transfert massif de BTC vers Coinbase signale quoi ?", "options": ["Un achat", "Une vente potentielle", "Rien de spécial", "Un hack"], "answer": 1},
                    {"q": "À partir de combien de BTC est-on considéré 'baleine' ?", "options": ["10 BTC", "100 BTC", "1 000 BTC", "10 000 BTC"], "answer": 2},
                    {"q": "Un retrait massif d'exchange est généralement :", "options": ["Baissier", "Haussier", "Neutre", "Dangereux"], "answer": 1}
                ]}
            ]
        },
        {
            "id": "tool-altcoin", "title": "Altcoin Season Index", "description": "Déterminez le meilleur moment pour investir dans les altcoins ou rester sur Bitcoin.",
            "modules": 3, "duration": "15 min", "difficulty": "intermediaire", "icon": "pie-chart", "color": "#7C3AED",
            "module_content": [
                {"id": 1, "title": "Bitcoin Season vs Altcoin Season", "duration": "5 min", "content": "Le marché crypto alterne entre deux phases :\n\nBitcoin Season (indice < 25) :\n- BTC surperforme la majorité des altcoins\n- Les capitaux se concentrent sur Bitcoin\n- Phase de 'flight to quality'\n\nAltcoin Season (indice > 75) :\n- 75%+ des altcoins surperforment BTC sur 90 jours\n- Les profits BTC se redistribuent vers les altcoins\n- Phase d'appétit pour le risque\n\nL'indice se calcule en comparant la performance de chaque altcoin vs BTC sur 90 jours."},
                {"id": 2, "title": "Adapter sa stratégie", "duration": "5 min", "content": "Rotation de capital :\n\nBitcoin Season → Gardez 70-80% en BTC, 20-30% en altcoins majeurs (ETH, SOL)\n\nAltcoin Season → Réduisez BTC à 40-50%, augmentez les altcoins prometteurs\n\nSignaux de transition :\n- La dominance BTC baisse sous 50% → Début d'altcoin season\n- ETH/BTC remonte → Les altcoins vont suivre\n\nSur Mentova, l'indice est mis à jour quotidiennement dans vos Outils VIP."},
                {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [
                    {"q": "Que signifie un Altcoin Season Index à 85 ?", "options": ["Bitcoin domine", "Les altcoins surperforment BTC", "Le marché est neutre", "Un crash arrive"], "answer": 1},
                    {"q": "En Bitcoin Season, quelle allocation est recommandée ?", "options": ["100% altcoins", "70-80% BTC", "50-50", "100% stablecoins"], "answer": 1},
                    {"q": "Sur combien de jours est calculé l'indice ?", "options": ["7 jours", "30 jours", "90 jours", "365 jours"], "answer": 2}
                ]}
            ]
        },
        {
            "id": "tool-halving", "title": "Bitcoin Halving", "description": "Comprenez l'événement le plus important du cycle Bitcoin et son impact sur les prix.",
            "modules": 3, "duration": "15 min", "difficulty": "debutant", "icon": "timer", "color": "#F7931A",
            "module_content": [
                {"id": 1, "title": "Qu'est-ce que le Halving ?", "duration": "5 min", "content": "Le halving Bitcoin se produit tous les 210 000 blocs (~4 ans). Il divise par 2 la récompense des mineurs :\n\n2009 : 50 BTC/bloc\n2012 : 25 BTC/bloc\n2016 : 12.5 BTC/bloc\n2020 : 6.25 BTC/bloc\n2024 : 3.125 BTC/bloc\n\nPourquoi c'est important : Le halving réduit l'offre de nouveaux BTC créés. Avec une demande stable ou croissante, la rareté pousse les prix à la hausse.\n\nC'est l'événement le plus prévisible et le plus important du cycle Bitcoin."},
                {"id": 2, "title": "Impact historique sur les prix", "duration": "5 min", "content": "Après chaque halving, le prix a atteint un nouveau sommet historique :\n\n2012 → Prix x100 en 12 mois (de $12 à $1 200)\n2016 → Prix x30 en 18 mois (de $650 à $20 000)\n2020 → Prix x8 en 18 mois (de $8 600 à $69 000)\n2024 → Cycle en cours...\n\nLe pattern : Le pic survient généralement 12-18 mois après le halving, suivi d'une correction de 70-80%.\n\nSur Mentova, suivez le compte à rebours du prochain halving et le nombre de blocs restants dans l'onglet Outils VIP."},
                {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [
                    {"q": "Tous les combien de blocs se produit un halving ?", "options": ["100 000", "210 000", "500 000", "1 000 000"], "answer": 1},
                    {"q": "Quelle est la récompense actuelle par bloc ?", "options": ["6.25 BTC", "3.125 BTC", "1.5625 BTC", "12.5 BTC"], "answer": 1},
                    {"q": "Quand le pic de prix survient-il historiquement ?", "options": ["Immédiatement", "1 mois après", "12-18 mois après", "5 ans après"], "answer": 2}
                ]}
            ]
        },
        {
            "id": "tool-gas", "title": "ETH Gas Tracker", "description": "Optimisez vos frais Ethereum en comprenant le mécanisme de gas.",
            "modules": 3, "duration": "15 min", "difficulty": "intermediaire", "icon": "flash", "color": "#627EEA",
            "module_content": [
                {"id": 1, "title": "Comment fonctionne le Gas", "duration": "5 min", "content": "Le gas est l'unité de mesure du travail nécessaire pour exécuter une transaction Ethereum.\n\nLe coût = Gas utilisé × Prix du gas (en Gwei)\n\n1 Gwei = 0.000000001 ETH\n\nTypes de transactions et gas typique :\n- Transfert ETH simple : ~21 000 gas\n- Swap sur Uniswap : ~150 000 gas\n- Mint d'un NFT : ~100 000-300 000 gas\n- Interaction smart contract complexe : 500 000+ gas\n\nDepuis EIP-1559, le gas comprend un base fee (brûlé) et un priority fee (tip pour les mineurs)."},
                {"id": 2, "title": "Économiser sur les frais", "duration": "5 min", "content": "Stratégies pour payer moins :\n\n1. Timing : Les frais sont plus bas le week-end et la nuit (UTC)\n2. Sur Mentova, vérifiez le Gas Tracker dans les Outils VIP avant de transacter\n3. Utilisez les niveaux :\n   - Slow (30+ min) : Le moins cher\n   - Average (5-15 min) : Bon compromis\n   - Fast (< 2 min) : Pour les urgences\n\n4. Layer 2 : Utilisez Arbitrum, Optimism ou Base pour des frais 10-50x moins chers\n5. Batch transactions quand possible"},
                {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [
                    {"q": "Combien de gas coûte un transfert ETH simple ?", "options": ["100 gas", "21 000 gas", "150 000 gas", "1 000 000 gas"], "answer": 1},
                    {"q": "Quand les frais sont-ils généralement les plus bas ?", "options": ["Lundi matin", "Le week-end", "Vendredi soir", "Mercredi midi"], "answer": 1},
                    {"q": "Qu'est-ce qu'un Gwei ?", "options": ["0.001 ETH", "0.000001 ETH", "0.000000001 ETH", "1 ETH"], "answer": 2}
                ]}
            ]
        },
        {
            "id": "tool-liquidations", "title": "Liquidations 24h", "description": "Comprenez les liquidations pour anticiper la volatilité et les retournements de marché.",
            "modules": 3, "duration": "15 min", "difficulty": "intermediaire", "icon": "flame", "color": "#EF4444",
            "module_content": [
                {"id": 1, "title": "Qu'est-ce qu'une liquidation ?", "duration": "5 min", "content": "Une liquidation se produit quand un trader en levier (futures) perd sa marge et sa position est fermée de force.\n\nPosition Long liquidée = Le prix a trop baissé\nPosition Short liquidée = Le prix a trop monté\n\nExemple : Vous ouvrez un long BTC x10 à $60 000. Si le prix baisse de 10% ($54 000), vous êtes liquidé et perdez toute votre marge.\n\nLes liquidations créent un effet cascade : une grosse liquidation provoque un mouvement de prix qui liquide d'autres positions, amplifiant la volatilité."},
                {"id": 2, "title": "Lire les données de liquidation", "duration": "5 min", "content": "Sur Mentova, l'outil Liquidations 24h affiche :\n\n- Total liquidé (en $) : Le volume global des liquidations\n- Ratio Long/Short : Qui se fait liquider le plus\n- Évolution : Tendance sur 24h\n\nSignaux à surveiller :\n\n📊 Grosses liquidations de longs → Le marché pourrait rebondir (short squeeze)\n📊 Grosses liquidations de shorts → Le marché pourrait corriger\n📊 Liquidations très élevées → Volatilité extrême, restez prudent\n\nCombinez avec le Fear & Greed pour confirmer le sentiment."},
                {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [
                    {"q": "Une liquidation de position long signifie que :", "options": ["Le prix a monté", "Le prix a baissé", "Le trader a vendu", "Le marché est fermé"], "answer": 1},
                    {"q": "Des liquidations massives de shorts peuvent signaler :", "options": ["Un crash à venir", "Un rebond potentiel", "Rien de spécial", "Une correction possible"], "answer": 3},
                    {"q": "Avec un levier x10, quel mouvement vous liquide ?", "options": ["1%", "5%", "10%", "50%"], "answer": 2}
                ]}
            ]
        },
        {
            "id": "tool-dominance", "title": "Dominance BTC & ETH", "description": "Utilisez la dominance pour comprendre les rotations de capital dans le marché crypto.",
            "modules": 3, "duration": "15 min", "difficulty": "debutant", "icon": "analytics", "color": "#F7931A",
            "module_content": [
                {"id": 1, "title": "Qu'est-ce que la dominance ?", "duration": "5 min", "content": "La dominance mesure la part de capitalisation d'une crypto par rapport au marché total.\n\nDominance BTC = Market Cap BTC / Market Cap Total × 100\n\nExemple : Si BTC vaut $1.2T et le marché total $2.4T, la dominance BTC = 50%\n\nNiveaux historiques :\n- 2017 (avant altcoin season) : BTC 60% → 35%\n- 2021 (alt season) : BTC 70% → 40%\n- Actuellement : Variable\n\nLa dominance ETH fonctionne de la même façon et est un indicateur avancé pour les altcoins."},
                {"id": 2, "title": "Trader avec la dominance", "duration": "5 min", "content": "Stratégies :\n\nDominance BTC en hausse → Le marché a peur, BTC est le refuge\n→ Action : Augmentez votre allocation BTC\n\nDominance BTC en baisse → L'appétit pour le risque augmente\n→ Action : Augmentez les altcoins\n\nDominance ETH en hausse → L'écosystème DeFi/NFT attire des capitaux\n→ Action : Regardez les tokens L2 (ARB, OP) et DeFi\n\nCombinez avec l'Altcoin Season Index sur Mentova pour confirmer la tendance et optimiser votre allocation."},
                {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [
                    {"q": "Que signifie une dominance BTC de 60% ?", "options": ["BTC vaut $60k", "BTC représente 60% du marché total", "60% des gens détiennent du BTC", "BTC a monté de 60%"], "answer": 1},
                    {"q": "Une dominance BTC en baisse signale :", "options": ["Un crash imminent", "Bitcoin est mort", "Les capitaux vont vers les altcoins", "Le marché est fermé"], "answer": 2},
                    {"q": "Quel outil Mentova combine avec la dominance ?", "options": ["Gas Tracker", "Altcoin Season Index", "Whale Alerts", "Rainbow Chart"], "answer": 1}
                ]}
            ]
        },
        {
            "id": "tool-briefing", "title": "Briefing Quotidien IA", "description": "Tirez le maximum du briefing IA quotidien pour rester informé sans effort.",
            "modules": 3, "duration": "10 min", "difficulty": "debutant", "icon": "today", "color": "#3B82F6",
            "module_content": [
                {"id": 1, "title": "Votre assistant marché", "duration": "3 min", "content": "Le Briefing Quotidien IA de Mentova analyse chaque jour :\n\n- Les mouvements de prix majeurs (BTC, ETH, top altcoins)\n- Les actualités crypto importantes\n- Le sentiment du marché\n- Les événements à venir\n\nL'IA résume des heures de recherche en un briefing concis de 2-3 minutes de lecture. Consultez-le chaque matin pour commencer votre journée informé."},
                {"id": 2, "title": "Combiner avec vos outils", "duration": "4 min", "content": "Le Briefing est encore plus puissant combiné avec vos autres outils VIP :\n\n1. Lisez le Briefing → Comprenez le contexte\n2. Vérifiez le Fear & Greed → Confirmez le sentiment\n3. Consultez les Whale Alerts → Validez les mouvements\n4. Regardez le Rainbow Chart → Positionnez-vous\n\nCette routine quotidienne de 5 minutes vous donne un avantage significatif sur la majorité des investisseurs."},
                {"id": 3, "title": "Quiz", "duration": "3 min", "content": "quiz", "is_quiz": True, "quiz": [
                    {"q": "Que fait le Briefing Quotidien IA ?", "options": ["Il trade à votre place", "Il résume les événements crypto du jour", "Il prédit les prix", "Il achète des cryptos"], "answer": 1},
                    {"q": "Avec quel outil combiner le briefing en premier ?", "options": ["Gas Tracker", "Fear & Greed Index", "Liquidations", "Halving"], "answer": 1}
                ]}
            ]
        }
    ]
}

# Module content translations
_MC_EN = {
    "tool-fear-greed": [
        {"id": 1, "title": "What is Fear & Greed?", "duration": "5 min", "content": "The Fear & Greed Index measures crypto market sentiment on a scale of 0 to 100.\n\n0-24 = Extreme Fear: Investors panic and sell. Historically a good time to buy.\n\n25-49 = Fear: Market is nervous but not panicking.\n\n50-74 = Greed: Optimism dominates. Prices rise.\n\n75-100 = Extreme Greed: Euphoria reigns. Watch for reversals.\n\nThe index uses volatility, volume, social media, BTC dominance, and Google trends."},
        {"id": 2, "title": "How to use it in trading", "duration": "5 min", "content": "Contrarian strategy:\n\n- When the index is below 20 (extreme fear), it's often a good time to accumulate. 'Be greedy when others are fearful.'\n\n- When the index exceeds 80 (extreme greed), consider taking profits.\n\nWarning: The index alone is not enough. Combine it with other tools like the Rainbow Chart and Whale Alerts to confirm your decisions.\n\nOn Mentova, check the index daily in the VIP Tools tab."},
        {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "What does a Fear & Greed score of 15 mean?", "options": ["Extreme greed", "Extreme fear", "Neutral market", "Moderate fear"], "answer": 1}, {"q": "What strategy is recommended during extreme fear?", "options": ["Sell everything", "Do nothing", "Accumulate gradually", "Short the market"], "answer": 2}, {"q": "What factors make up the index?", "options": ["Price only", "Volatility, volume, social media, BTC dominance", "Elon Musk's tweets", "Bitcoin hash rate"], "answer": 1}]}
    ],
    "tool-rainbow": [
        {"id": 1, "title": "Understanding the Rainbow Chart", "duration": "5 min", "content": "The Rainbow Chart is a long-term analysis tool that uses a logarithmic curve to divide Bitcoin's price into colored zones:\n\nDark Blue (Fire Sale): Very low price, rare opportunity\nGreen (Accumulate): Ideal accumulation zone\nYellow (Hold): Fair price, hold positions\nOrange (FOMO): Market heating up, caution\nRed (Sell/Bubble): Bubble zone, take profits\n\nThis tool works best over horizons of several months to years."},
        {"id": 2, "title": "Strategies with the Rainbow Chart", "duration": "5 min", "content": "Smart DCA:\n\nUse the Rainbow Chart to adjust your DCA (Dollar Cost Averaging):\n\n- Blue/green zone: Increase your regular purchases\n- Yellow zone: Maintain normal DCA\n- Orange zone: Reduce purchases\n- Red zone: Stop buying, take profits\n\nHistorically, buying in blue/green zones and selling in orange/red has always been profitable long-term.\n\nOn Mentova, the current zone is displayed directly in your VIP Tools."},
        {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "What does the blue zone mean on the Rainbow Chart?", "options": ["Bubble zone", "Fire Sale - very low price", "Hold zone", "FOMO zone"], "answer": 1}, {"q": "How to adjust DCA in the orange zone?", "options": ["Buy more", "Reduce purchases", "Sell everything", "Borrow to buy"], "answer": 1}, {"q": "What time horizon does the Rainbow Chart work on?", "options": ["Minutes", "Hours", "Days", "Months to years"], "answer": 3}]}
    ],
    "tool-whale": [
        {"id": 1, "title": "Who are the whales?", "duration": "5 min", "content": "Whales are entities holding huge amounts of crypto:\n\n- Bitcoin: >1,000 BTC (~$100M+)\n- Ethereum: >10,000 ETH\n\nTheir movements significantly impact markets. Types of whales:\n\n1. Institutional (funds, ETFs)\n2. Historical miners\n3. Exchanges\n4. Governments (seized BTC)\n\nTracking their transactions gives you an informational edge."},
        {"id": 2, "title": "Interpreting alerts", "duration": "5 min", "content": "Key signals:\n\nBTC sent to an exchange: Potential sell signal. The whale is preparing to liquidate.\n\nBTC withdrawn from exchange: Bullish signal. The whale is accumulating in cold storage.\n\nTransfer between wallets: Reorganization. Generally neutral.\n\nLarge OTC purchase: Very bullish. Discreet institutional buying.\n\nOn Mentova, you receive these alerts in real-time in the VIP Tools tab with the type of movement and its potential impact."},
        {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "A massive BTC transfer to Coinbase signals what?", "options": ["A purchase", "A potential sale", "Nothing special", "A hack"], "answer": 1}, {"q": "From how many BTC is one considered a 'whale'?", "options": ["10 BTC", "100 BTC", "1,000 BTC", "10,000 BTC"], "answer": 2}, {"q": "A massive exchange withdrawal is generally:", "options": ["Bearish", "Bullish", "Neutral", "Dangerous"], "answer": 1}]}
    ],
    "tool-altcoin": [
        {"id": 1, "title": "Bitcoin Season vs Altcoin Season", "duration": "5 min", "content": "The crypto market alternates between two phases:\n\nBitcoin Season (index < 25):\n- BTC outperforms most altcoins\n- Capital concentrates on Bitcoin\n- 'Flight to quality' phase\n\nAltcoin Season (index > 75):\n- 75%+ of altcoins outperform BTC over 90 days\n- BTC profits redistribute to altcoins\n- Risk appetite phase\n\nThe index is calculated by comparing each altcoin's performance vs BTC over 90 days."},
        {"id": 2, "title": "Adapting your strategy", "duration": "5 min", "content": "Capital rotation:\n\nBitcoin Season: Keep 70-80% in BTC, 20-30% in major altcoins (ETH, SOL)\n\nAltcoin Season: Reduce BTC to 40-50%, increase promising altcoins\n\nTransition signals:\n- BTC dominance drops below 50%: Start of altcoin season\n- ETH/BTC rising: Altcoins will follow\n\nOn Mentova, the index is updated daily in your VIP Tools."},
        {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "What does an Altcoin Season Index of 85 mean?", "options": ["Bitcoin dominates", "Altcoins outperform BTC", "Market is neutral", "A crash is coming"], "answer": 1}, {"q": "During Bitcoin Season, what allocation is recommended?", "options": ["100% altcoins", "70-80% BTC", "50-50", "100% stablecoins"], "answer": 1}, {"q": "Over how many days is the index calculated?", "options": ["7 days", "30 days", "90 days", "365 days"], "answer": 2}]}
    ],
    "tool-halving": [
        {"id": 1, "title": "What is the Halving?", "duration": "5 min", "content": "The Bitcoin halving occurs every 210,000 blocks (~4 years). It cuts miner rewards in half:\n\n2009: 50 BTC/block\n2012: 25 BTC/block\n2016: 12.5 BTC/block\n2020: 6.25 BTC/block\n2024: 3.125 BTC/block\n\nWhy it matters: The halving reduces the supply of new BTC. With stable or growing demand, scarcity pushes prices up.\n\nIt's the most predictable and important event in Bitcoin's cycle."},
        {"id": 2, "title": "Historical price impact", "duration": "5 min", "content": "After each halving, price reached a new all-time high:\n\n2012: Price x100 in 12 months ($12 to $1,200)\n2016: Price x30 in 18 months ($650 to $20,000)\n2020: Price x8 in 18 months ($8,600 to $69,000)\n2024: Current cycle...\n\nThe pattern: Peak typically occurs 12-18 months after halving, followed by a 70-80% correction.\n\nOn Mentova, track the countdown and remaining blocks in the VIP Tools tab."},
        {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "How many blocks between each halving?", "options": ["100,000", "210,000", "500,000", "1,000,000"], "answer": 1}, {"q": "What is the current reward per block?", "options": ["6.25 BTC", "3.125 BTC", "1.5625 BTC", "12.5 BTC"], "answer": 1}, {"q": "When does price peak historically?", "options": ["Immediately", "1 month after", "12-18 months after", "5 years after"], "answer": 2}]}
    ],
    "tool-gas": [
        {"id": 1, "title": "How Gas works", "duration": "5 min", "content": "Gas is the unit measuring work needed to execute an Ethereum transaction.\n\nCost = Gas used x Gas price (in Gwei)\n\n1 Gwei = 0.000000001 ETH\n\nTransaction types and typical gas:\n- Simple ETH transfer: ~21,000 gas\n- Uniswap swap: ~150,000 gas\n- NFT mint: ~100,000-300,000 gas\n- Complex smart contract: 500,000+ gas\n\nSince EIP-1559, gas includes a base fee (burned) and a priority fee (tip for validators)."},
        {"id": 2, "title": "Saving on fees", "duration": "5 min", "content": "Strategies to pay less:\n\n1. Timing: Fees are lower on weekends and at night (UTC)\n2. On Mentova, check the Gas Tracker in VIP Tools before transacting\n3. Use the levels:\n   - Slow (30+ min): Cheapest\n   - Average (5-15 min): Good balance\n   - Fast (< 2 min): For urgent needs\n\n4. Layer 2: Use Arbitrum, Optimism or Base for 10-50x cheaper fees\n5. Batch transactions when possible"},
        {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "How much gas for a simple ETH transfer?", "options": ["100 gas", "21,000 gas", "150,000 gas", "1,000,000 gas"], "answer": 1}, {"q": "When are fees generally lowest?", "options": ["Monday morning", "Weekends", "Friday evening", "Wednesday noon"], "answer": 1}, {"q": "What is a Gwei?", "options": ["0.001 ETH", "0.000001 ETH", "0.000000001 ETH", "1 ETH"], "answer": 2}]}
    ],
    "tool-liquidations": [
        {"id": 1, "title": "What is a liquidation?", "duration": "5 min", "content": "A liquidation occurs when a leveraged trader (futures) loses their margin and their position is force-closed.\n\nLong position liquidated = Price dropped too much\nShort position liquidated = Price rose too much\n\nExample: You open a 10x long BTC at $60,000. If price drops 10% ($54,000), you're liquidated and lose all your margin.\n\nLiquidations create a cascade effect: a large liquidation causes a price movement that liquidates more positions, amplifying volatility."},
        {"id": 2, "title": "Reading liquidation data", "duration": "5 min", "content": "On Mentova, the Liquidations 24h tool shows:\n\n- Total liquidated ($): Overall liquidation volume\n- Long/Short ratio: Who's getting liquidated more\n- Trend: 24h evolution\n\nSignals to watch:\n\nMassive long liquidations: Market could bounce (short squeeze)\nMassive short liquidations: Market could correct\nVery high liquidations: Extreme volatility, stay cautious\n\nCombine with Fear & Greed to confirm sentiment."},
        {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "A long position liquidation means:", "options": ["Price went up", "Price went down", "Trader sold", "Market is closed"], "answer": 1}, {"q": "Massive short liquidations can signal:", "options": ["A crash coming", "A potential bounce", "Nothing special", "A possible correction"], "answer": 3}, {"q": "With 10x leverage, what movement liquidates you?", "options": ["1%", "5%", "10%", "50%"], "answer": 2}]}
    ],
    "tool-dominance": [
        {"id": 1, "title": "What is dominance?", "duration": "5 min", "content": "Dominance measures a crypto's market cap share relative to the total market.\n\nBTC Dominance = BTC Market Cap / Total Market Cap x 100\n\nExample: If BTC is $1.2T and total market is $2.4T, BTC dominance = 50%\n\nHistorical levels:\n- 2017 (before altcoin season): BTC 60% to 35%\n- 2021 (alt season): BTC 70% to 40%\n- Currently: Variable\n\nETH dominance works the same way and is a leading indicator for altcoins."},
        {"id": 2, "title": "Trading with dominance", "duration": "5 min", "content": "Strategies:\n\nBTC dominance rising: Market is fearful, BTC is the safe haven\nAction: Increase your BTC allocation\n\nBTC dominance falling: Risk appetite increasing\nAction: Increase altcoins\n\nETH dominance rising: DeFi/NFT ecosystem attracting capital\nAction: Look at L2 tokens (ARB, OP) and DeFi\n\nCombine with Altcoin Season Index on Mentova to confirm the trend and optimize your allocation."},
        {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "What does 60% BTC dominance mean?", "options": ["BTC is worth $60k", "BTC represents 60% of total market", "60% of people hold BTC", "BTC rose 60%"], "answer": 1}, {"q": "Falling BTC dominance signals:", "options": ["An imminent crash", "Bitcoin is dead", "Capital flowing to altcoins", "Market is closed"], "answer": 2}, {"q": "Which Mentova tool pairs with dominance?", "options": ["Gas Tracker", "Altcoin Season Index", "Whale Alerts", "Rainbow Chart"], "answer": 1}]}
    ],
    "tool-briefing": [
        {"id": 1, "title": "Your market assistant", "duration": "3 min", "content": "Mentova's Daily AI Briefing analyzes every day:\n\n- Major price movements (BTC, ETH, top altcoins)\n- Important crypto news\n- Market sentiment\n- Upcoming events\n\nThe AI summarizes hours of research into a concise 2-3 minute read. Check it every morning to start your day informed."},
        {"id": 2, "title": "Combining with your tools", "duration": "4 min", "content": "The Briefing is even more powerful combined with your other VIP tools:\n\n1. Read the Briefing: Understand the context\n2. Check Fear & Greed: Confirm sentiment\n3. Review Whale Alerts: Validate movements\n4. Look at Rainbow Chart: Position yourself\n\nThis 5-minute daily routine gives you a significant edge over most investors."},
        {"id": 3, "title": "Quiz", "duration": "3 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "What does the Daily AI Briefing do?", "options": ["Trades for you", "Summarizes daily crypto events", "Predicts prices", "Buys cryptos"], "answer": 1}, {"q": "Which tool to combine with the briefing first?", "options": ["Gas Tracker", "Fear & Greed Index", "Liquidations", "Halving"], "answer": 1}]}
    ],
}

_MC_ES = {
    "tool-fear-greed": [
        {"id": 1, "title": "Que es el Fear & Greed?", "duration": "5 min", "content": "El indice Fear & Greed mide el sentimiento del mercado crypto en una escala de 0 a 100.\n\n0-24 = Miedo extremo: Los inversores entran en panico y venden. Historicamente buen momento para comprar.\n\n25-49 = Miedo: El mercado esta nervioso pero sin panico.\n\n50-74 = Codicia: El optimismo domina. Los precios suben.\n\n75-100 = Codicia extrema: Euforia. Atencion a los cambios de tendencia."},
        {"id": 2, "title": "Como usarlo en trading", "duration": "5 min", "content": "Estrategia contrarian:\n\n- Cuando el indice esta bajo 20 (miedo extremo), suele ser buen momento para acumular.\n\n- Cuando supera 80 (codicia extrema), considere tomar ganancias.\n\nAtencion: El indice solo no basta. Combinalo con el Rainbow Chart y Whale Alerts para confirmar tus decisiones."},
        {"id": 3, "title": "Quiz", "duration": "5 min", "content": "quiz", "is_quiz": True, "quiz": [{"q": "Que significa un Fear & Greed de 15?", "options": ["Codicia extrema", "Miedo extremo", "Mercado neutral", "Miedo moderado"], "answer": 1}, {"q": "Que estrategia se recomienda en miedo extremo?", "options": ["Vender todo", "No hacer nada", "Acumular gradualmente", "Shortear el mercado"], "answer": 2}, {"q": "Que factores componen el indice?", "options": ["Solo el precio", "Volatilidad, volumen, redes sociales, dominancia BTC", "Los tweets de Elon Musk", "El hash rate de Bitcoin"], "answer": 1}]}
    ],
}

# Build EN courses with translated module_content
VIP_COURSES_DATA["en"] = []
for c in VIP_COURSES_DATA["fr"]:
    en_mc = _MC_EN.get(c["id"], c["module_content"])
    VIP_COURSES_DATA["en"].append({
        **c,
        "description": {"tool-fear-greed":"Learn to read and use the Fear & Greed Index to make better investment decisions.","tool-rainbow":"Master the Rainbow Chart to identify ideal Bitcoin buy and sell zones.","tool-whale":"Interpret whale movements to anticipate market trends.","tool-altcoin":"Determine the best time to invest in altcoins or stay on Bitcoin.","tool-halving":"Understand the most important event of the Bitcoin cycle and its price impact.","tool-gas":"Optimize your Ethereum fees by understanding the gas mechanism.","tool-liquidations":"Understand liquidations to anticipate volatility and market reversals.","tool-dominance":"Use dominance to understand capital rotations in the crypto market.","tool-briefing":"Get the most out of the daily AI briefing to stay informed effortlessly."}.get(c["id"], c["description"]),
        "difficulty": {"debutant":"beginner","intermediaire":"intermediate","expert":"expert"}.get(c["difficulty"], c["difficulty"]),
        "module_content": en_mc,
    })

# Build ES courses - use Spanish titles where available, fall back to French
VIP_COURSES_DATA["es"] = []
for c in VIP_COURSES_DATA["fr"]:
    es_mc = _MC_ES.get(c["id"], c["module_content"])
    VIP_COURSES_DATA["es"].append({
        **c,
        "description": {"tool-fear-greed":"Aprende a leer y usar el Fear & Greed Index para tomar mejores decisiones.","tool-rainbow":"Domina el Rainbow Chart para identificar zonas ideales de compra y venta.","tool-whale":"Interpreta los movimientos de ballenas para anticipar tendencias.","tool-altcoin":"Determina el mejor momento para invertir en altcoins o quedarte en Bitcoin.","tool-halving":"Comprende el evento mas importante del ciclo Bitcoin y su impacto.","tool-gas":"Optimiza tus tarifas Ethereum comprendiendo el mecanismo de gas.","tool-liquidations":"Comprende las liquidaciones para anticipar la volatilidad.","tool-dominance":"Usa la dominancia para entender las rotaciones de capital.","tool-briefing":"Aprovecha al maximo el briefing diario de IA."}.get(c["id"], c["description"]),
        "difficulty": {"debutant":"principiante","intermediaire":"intermedio","expert":"experto"}.get(c["difficulty"], c["difficulty"]),
        "module_content": es_mc,
    })

def get_vip_courses(lang: str = "fr"):
    return VIP_COURSES_DATA.get(lang, VIP_COURSES_DATA["fr"])

@api_router.get("/vip/academy")
async def get_advanced_courses(lang: Optional[str] = None, user: dict = Depends(require_vip)):
    """Get advanced courses (VIP only)"""
    progress = await db.course_progress.find({"user_id": user["id"]}).to_list(100)
    progress_map = {p["course_id"]: p for p in progress}
    
    courses = []
    for course in get_vip_courses(lang or "fr"):
        user_progress = progress_map.get(course["id"], {})
        courses.append({
            **course,
            "progress_percent": user_progress.get("progress_percent", 0),
            "completed": user_progress.get("completed", False),
            "started": course["id"] in progress_map
        })
    
    return {
        "success": True,
        "data": courses,
        "total": len(courses)
    }

@api_router.post("/vip/academy/{course_id}/progress")
async def update_course_progress(
    course_id: str,
    progress_percent: int,
    user: dict = Depends(require_vip)
):
    """Update course progress (VIP only)"""
    existing = await db.course_progress.find_one({
        "user_id": user["id"],
        "course_id": course_id
    })
    
    completed = progress_percent >= 100
    
    if existing:
        await db.course_progress.update_one(
            {"id": existing["id"]},
            {"$set": {
                "progress_percent": progress_percent,
                "completed": completed,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        await db.course_progress.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "course_id": course_id,
            "progress_percent": progress_percent,
            "completed": completed,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
        
        # First course achievement
        courses_started = await db.course_progress.count_documents({"user_id": user["id"]})
        if courses_started == 1:
            await award_achievement(user["id"], "ach-1")
    
    # 5 courses achievement
    if completed:
        courses_completed = await db.course_progress.count_documents({
            "user_id": user["id"],
            "completed": True
        })
        if courses_completed >= 5:
            await award_achievement(user["id"], "ach-2")
    
    return {"success": True, "message": "Progression mise à jour"}

# ==================== COPY TRADING ====================

# VIP Traders definitions
VIP_TRADERS = [
    {
        "id": "trader-1",
        "username": "Tetranode",
        "wallet_address": "0x9c5083dd4838E120Dbeac44C052179692Aa5dAC5",
        "etherscan_url": "https://etherscan.io/address/0x9c5083dd4838E120Dbeac44C052179692Aa5dAC5",
        "description": "Trader DeFi légendaire, connu pour ses calls sur AAVE et autres protocoles. Un des premiers à investir massivement dans DeFi.",
        "total_return": 1245.8,
        "win_rate": 78.5,
        "followers": 125000,
        "trades_count": 2892,
        "risk_level": "high",
        "avg_trade_duration": "1-4 semaines",
        "favorite_pairs": ["ETH", "AAVE", "UNI", "CRV"],
        "joined_date": "2019-06-15",
        "verified": True,
        "recent_trades": [
            {"type": "buy", "symbol": "ETH", "amount": 500, "price": 3150, "date": "2026-02-20", "profit_percent": 3.2},
            {"type": "sell", "symbol": "AAVE", "amount": 1200, "price": 285, "date": "2026-02-18", "profit_percent": 12.5},
            {"type": "buy", "symbol": "CRV", "amount": 50000, "price": 0.85, "date": "2026-02-15", "profit_percent": None}
        ]
    },
    {
        "id": "trader-2",
        "username": "Cobie",
        "wallet_address": "0xd6a984153aCB6c9E2d788f08C2465a1358BB89A7",
        "etherscan_url": "https://etherscan.io/address/0xd6a984153aCB6c9E2d788f08C2465a1358BB89A7",
        "description": "Co-fondateur de Lido, podcaster crypto influent. Connu pour ses analyses de marché précises et son style de trading long terme.",
        "total_return": 856.2,
        "win_rate": 82.3,
        "followers": 890000,
        "trades_count": 534,
        "risk_level": "medium",
        "avg_trade_duration": "1-6 mois",
        "favorite_pairs": ["ETH", "BTC", "stETH"],
        "joined_date": "2017-03-20",
        "verified": True,
        "recent_trades": [
            {"type": "buy", "symbol": "ETH", "amount": 200, "price": 3100, "date": "2026-02-19", "profit_percent": 4.5},
            {"type": "hold", "symbol": "stETH", "amount": 5000, "price": 3180, "date": "2026-02-10", "profit_percent": 2.1}
        ]
    },
    {
        "id": "trader-3",
        "username": "Arthur Hayes",
        "wallet_address": "0x94845333028B1204Fbe14E1278Fd4Adde46B22ce",
        "etherscan_url": "https://etherscan.io/address/0x94845333028B1204Fbe14E1278Fd4Adde46B22ce",
        "description": "Co-fondateur de BitMEX, ancien trader de Citibank. Trading macro et dérivés crypto. Blog Crypto Hayes très suivi.",
        "total_return": 2412.5,
        "win_rate": 68.8,
        "followers": 450000,
        "trades_count": 1856,
        "risk_level": "high",
        "avg_trade_duration": "1-3 jours",
        "favorite_pairs": ["BTC", "ETH", "Perpetuals"],
        "joined_date": "2014-09-01",
        "verified": True,
        "recent_trades": [
            {"type": "buy", "symbol": "BTC", "amount": 50, "price": 65000, "date": "2026-02-21", "profit_percent": 2.8},
            {"type": "sell", "symbol": "ETH", "amount": 800, "price": 3250, "date": "2026-02-17", "profit_percent": 8.5},
            {"type": "buy", "symbol": "BTC", "amount": 25, "price": 62000, "date": "2026-02-12", "profit_percent": 7.2}
        ]
    },
    {
        "id": "trader-4",
        "username": "GCR (Gigantic Rebirth)",
        "wallet_address": "0x8652767CC5c9f8E7d0F5E34bB6aE1d587F05a6dF",
        "etherscan_url": "https://etherscan.io/address/0x8652767CC5c9f8E7d0F5E34bB6aE1d587F05a6dF",
        "description": "Trader légendaire qui a shorté LUNA avant le crash. Connu pour ses paris contrarians et analyses macro.",
        "total_return": 5198.7,
        "win_rate": 74.2,
        "followers": 280000,
        "trades_count": 967,
        "risk_level": "very_high",
        "avg_trade_duration": "1-2 semaines",
        "favorite_pairs": ["BTC", "ETH", "Altcoins"],
        "joined_date": "2019-11-10",
        "verified": True,
        "recent_trades": [
            {"type": "short", "symbol": "DOGE", "amount": 500000, "price": 0.35, "date": "2026-02-20", "profit_percent": 5.2},
            {"type": "buy", "symbol": "ETH", "amount": 1000, "price": 3000, "date": "2026-02-16", "profit_percent": 6.8},
            {"type": "sell", "symbol": "SOL", "amount": 2000, "price": 175, "date": "2026-02-14", "profit_percent": 15.3}
        ]
    },
    {
        "id": "trader-5",
        "username": "Light (NFT Trader)",
        "wallet_address": "0xc6e2459991BfE27cca6d86722F35da23A1E4Cb97",
        "etherscan_url": "https://etherscan.io/address/0xc6e2459991BfE27cca6d86722F35da23A1E4Cb97",
        "description": "Trader NFT et DeFi, connu pour avoir tradé les collections blue chip. Désormais focus sur les tokens DeFi.",
        "total_return": 3420.0,
        "win_rate": 69.5,
        "followers": 185000,
        "trades_count": 2345,
        "risk_level": "high",
        "avg_trade_duration": "1-7 jours",
        "favorite_pairs": ["ETH", "BLUR", "NFTs"],
        "joined_date": "2020-08-05",
        "verified": True,
        "recent_trades": [
            {"type": "buy", "symbol": "BLUR", "amount": 100000, "price": 0.45, "date": "2026-02-21", "profit_percent": None},
            {"type": "sell", "symbol": "ETH", "amount": 300, "price": 3200, "date": "2026-02-19", "profit_percent": 4.2}
        ]
    }
]

@api_router.get("/vip/copy-trading/traders")
async def get_copy_traders(user: dict = Depends(require_vip)):
    """Get available traders to copy (VIP only)"""
    following = await db.copy_trading_follows.find({"user_id": user["id"]}).to_list(100)
    following_ids = {f["trader_id"] for f in following}
    
    traders = []
    for trader in VIP_TRADERS:
        traders.append({
            **trader,
            "is_following": trader["id"] in following_ids
        })
    
    return {
        "success": True,
        "data": traders,
        "total": len(traders),
        "coming_soon": "Plus de traders célèbres bientôt disponibles!"
    }

@api_router.post("/vip/copy-trading/follow/{trader_id}")
async def follow_trader(trader_id: str, user: dict = Depends(require_vip)):
    """Follow a trader for copy trading (VIP only)"""
    trader = next((t for t in VIP_TRADERS if t["id"] == trader_id), None)
    if not trader:
        raise HTTPException(status_code=404, detail="Trader not found")
    
    existing = await db.copy_trading_follows.find_one({
        "user_id": user["id"],
        "trader_id": trader_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="You are already following this trader")
    
    await db.copy_trading_follows.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "trader_id": trader_id,
        "followed_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Achievement for first follow
    follows_count = await db.copy_trading_follows.count_documents({"user_id": user["id"]})
    if follows_count == 1:
        await award_achievement(user["id"], "ach-8")
    
    return {"success": True, "message": f"Vous suivez maintenant {trader['username']}"}

@api_router.delete("/vip/copy-trading/follow/{trader_id}")
async def unfollow_trader(trader_id: str, user: dict = Depends(require_vip)):
    """Unfollow a trader (VIP only)"""
    result = await db.copy_trading_follows.delete_one({
        "user_id": user["id"],
        "trader_id": trader_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vous ne suivez pas ce trader")
    return {"success": True, "message": "Trader retiré de vos suivis"}

@api_router.get("/vip/copy-trading/portfolio")
async def get_copy_trading_portfolio(user: dict = Depends(require_vip)):
    """Get aggregated portfolio from followed traders (VIP only)"""
    follows = await db.copy_trading_follows.find({"user_id": user["id"]}).to_list(100)
    
    if not follows:
        return {
            "success": True,
            "data": [],
            "message": "Suivez des traders pour voir leur portfolio agrégé"
        }
    
    # Mock aggregated portfolio based on followed traders
    portfolio = [
        {"symbol": "BTC", "allocation": 45, "avg_entry": 62000, "current": 68000, "change": 9.7},
        {"symbol": "ETH", "allocation": 30, "avg_entry": 1800, "current": 1950, "change": 8.3},
        {"symbol": "SOL", "allocation": 15, "avg_entry": 120, "current": 150, "change": 25.0},
        {"symbol": "LINK", "allocation": 10, "avg_entry": 12, "current": 14, "change": 16.7},
    ]
    
    return {
        "success": True,
        "data": portfolio,
        "traders_followed": len(follows)
    }

# ==================== SOCIAL FEATURES ====================

@api_router.get("/vip/social/feed")
async def get_social_feed(
    limit: int = 20,
    skip: int = 0,
    topic: str = None,
    user: dict = Depends(require_vip)
):
    """Get VIP social feed (VIP only), optionally filtered by crypto topic"""
    query = {}
    if topic:
        topic_upper = topic.upper()
        query = {"$or": [
            {"crypto_mentions": topic_upper},
            {"content": {"$regex": f"\\${topic_upper}", "$options": "i"}}
        ]}
    
    posts = await db.social_posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get user's likes
    user_likes = await db.social_likes.find({"user_id": user["id"]}).to_list(1000)
    liked_post_ids = {l["post_id"] for l in user_likes}
    
    result = []
    for post in posts:
        author = await db.users.find_one({"id": post["author_id"]})
        result.append({
            "id": post["id"],
            "author_id": post["author_id"],
            "author_name": author.get("name", "Utilisateur") if author else "Utilisateur",
            "author_avatar": None,
            "is_vip": author.get("is_vip", False) if author else False,
            "content": post["content"],
            "crypto_mentions": post.get("crypto_mentions", []),
            "likes": post.get("likes", 0),
            "comments": post.get("comments_count", 0),
            "comments_count": post.get("comments_count", 0),
            "created_at": post["created_at"],
            "is_liked": post["id"] in liked_post_ids,
            "has_image": post.get("has_image", False),
            "author_avatar_color": author.get("avatar_color") if author else None,
        })
    
    total = await db.social_posts.count_documents(query)
    
    return {
        "success": True,
        "data": result,
        "total": total
    }

@api_router.get("/vip/social/trending")
async def get_trending_topics(user: dict = Depends(require_vip)):
    """Get trending crypto topics from recent social posts"""
    import re as re_mod
    from collections import Counter
    
    # Get recent posts (last 100)
    posts = await db.social_posts.find().sort("created_at", -1).limit(100).to_list(100)
    
    mention_counts = Counter()
    for post in posts:
        # From crypto_mentions field
        for m in post.get("crypto_mentions", []):
            mention_counts[m.upper()] += 1
        # From content ($SYMBOL pattern)
        content = post.get("content", "")
        found = re_mod.findall(r'\$([A-Z]{2,6})', content.upper())
        for f in found:
            mention_counts[f] += 1
    
    # Build trending list sorted by count
    trending = []
    for symbol, count in mention_counts.most_common(10):
        trending.append({
            "symbol": symbol,
            "count": count,
            "display": f"${symbol}",
        })
    
    # Add popular defaults if not enough organic topics
    defaults = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX"]
    for d in defaults:
        if len(trending) >= 8:
            break
        if not any(t["symbol"] == d for t in trending):
            trending.append({"symbol": d, "count": 0, "display": f"${d}"})
    
    return {"success": True, "data": trending}

@api_router.post("/vip/social/posts")
async def create_social_post(
    content: str,
    crypto_mentions: List[str] = [],
    user: dict = Depends(require_vip)
):
    """Create a social post (VIP only)"""
    post_data = {
        "id": str(uuid.uuid4()),
        "author_id": user["id"],
        "content": content,
        "crypto_mentions": [c.upper() for c in crypto_mentions],
        "likes": 0,
        "comments_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.social_posts.insert_one(post_data)
    
    # Check posts achievement
    posts_count = await db.social_posts.count_documents({"author_id": user["id"]})
    if posts_count >= 10:
        await award_achievement(user["id"], "ach-6")
    
    return {"success": True, "data": {**post_data, "_id": None}}

@api_router.post("/vip/social/posts/{post_id}/like")
async def like_post(post_id: str, user: dict = Depends(require_vip)):
    """Like a social post (VIP only)"""
    post = await db.social_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing_like = await db.social_likes.find_one({
        "user_id": user["id"],
        "post_id": post_id
    })
    
    if existing_like:
        # Unlike
        await db.social_likes.delete_one({"id": existing_like["id"]})
        await db.social_posts.update_one({"id": post_id}, {"$inc": {"likes": -1}})
        return {"success": True, "message": "Like retiré", "liked": False}
    else:
        # Like
        await db.social_likes.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.social_posts.update_one({"id": post_id}, {"$inc": {"likes": 1}})
        
        # Send notification to post author (if not self-like)
        if post["author_id"] != user["id"]:
            user_name = user.get("name", "Quelqu'un")
            await send_notification_to_user(
                post["author_id"],
                f"{user_name} a aimé votre post",
                "post_like",
                {"post_id": post_id},
                "❤️ Nouveau like"
            )
        
        # Check if post author gets achievement
        post_author = post["author_id"]
        total_likes = await db.social_posts.aggregate([
            {"$match": {"author_id": post_author}},
            {"$group": {"_id": None, "total": {"$sum": "$likes"}}}
        ]).to_list(1)
        
        if total_likes and total_likes[0].get("total", 0) >= 100:
            await award_achievement(post_author, "ach-7")
        
        return {"success": True, "message": "Post liké", "liked": True}

@api_router.get("/vip/social/posts/{post_id}/comments")
async def get_post_comments(post_id: str, user: dict = Depends(require_vip)):
    """Get comments on a post (VIP only)"""
    comments = await db.social_comments.find({"post_id": post_id}).sort("created_at", 1).to_list(100)
    
    result = []
    for comment in comments:
        author = await db.users.find_one({"id": comment["author_id"]})
        result.append({
            "id": comment["id"],
            "author_id": comment["author_id"],
            "author_name": author.get("name", "Utilisateur") if author else "Utilisateur",
            "is_vip": author.get("is_vip", False) if author else False,
            "content": comment["content"],
            "created_at": comment["created_at"]
        })
    
    return {"success": True, "data": result}

@api_router.post("/vip/social/posts/{post_id}/comments")
async def add_comment(post_id: str, content: str, user: dict = Depends(require_vip)):
    """Add comment to a post (VIP only)"""
    post = await db.social_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment_data = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "author_id": user["id"],
        "author_name": user.get("name", "VIP User"),
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.social_comments.insert_one(comment_data)
    await db.social_posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    
    # Send notification to post author (if not self-comment)
    if post["author_id"] != user["id"]:
        user_name = user.get("name", "Quelqu'un")
        comment_preview = content[:40] + ("..." if len(content) > 40 else "")
        await send_notification_to_user(
            post["author_id"],
            f"{user_name} a commenté: {comment_preview}",
            "post_comment",
            {"post_id": post_id, "comment_id": comment_data["id"]},
            "💬 Nouveau commentaire"
        )
    
    return {"success": True, "data": {**comment_data, "_id": None}}

# ==================== VIP CRYPTO TOOLS ====================

# Cache for crypto tools data
crypto_tools_cache = {
    "fear_greed": {"data": None, "timestamp": None},
    "btc_rainbow": {"data": None, "timestamp": None},
    "altcoin_season": {"data": None, "timestamp": None},
    "btc_dominance": {"data": None, "timestamp": None},
    "eth_gas": {"data": None, "timestamp": None},
    "liquidations": {"data": None, "timestamp": None},
    "whale_alerts": {"data": None, "timestamp": None},
}

CACHE_DURATION_MINUTES = 5

def is_cache_valid(cache_key: str) -> bool:
    """Check if cache is still valid"""
    cache = crypto_tools_cache.get(cache_key)
    if not cache or not cache["timestamp"]:
        return False
    elapsed = (datetime.now(timezone.utc) - cache["timestamp"]).total_seconds()
    return elapsed < CACHE_DURATION_MINUTES * 60

@api_router.get("/vip/tools/all")
async def get_all_crypto_tools(user: dict = Depends(require_vip)):
    """Get all crypto tools data - Using CoinCap, Binance, and other free APIs (NO rate limits)"""
    async with httpx.AsyncClient() as client:
        results = {}
        
        # ============ 1. Fear & Greed Index (alternative.me - FREE, no limits) ============
        try:
            fg_resp = await client.get("https://api.alternative.me/fng/?limit=30", timeout=10.0)
            if fg_resp.status_code == 200:
                fg_data = fg_resp.json()
                history_data = fg_data.get("data", [])
                results["fear_greed"] = {
                    "current": {
                        "value": int(history_data[0]["value"]) if history_data else 50,
                        "classification": history_data[0].get("value_classification", "Neutral") if history_data else "Neutral",
                        "timestamp": history_data[0].get("timestamp", "") if history_data else ""
                    },
                    "history": [{"value": int(d["value"]), "date": d["timestamp"]} for d in history_data[:14]],
                    "yesterday": int(history_data[1]["value"]) if len(history_data) > 1 else 50,
                    "last_week": int(history_data[7]["value"]) if len(history_data) > 7 else 50
                }
        except Exception as e:
            logger.warning(f"Fear & Greed API error: {e}")
            results["fear_greed"] = {"current": {"value": 50, "classification": "Neutral"}, "history": []}
        
        # ============ 2. BTC/ETH Prices + Market Data (CoinGecko with fallback) ============
        try:
            # Try CoinGecko first
            prices_resp = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "bitcoin,ethereum", "vs_currencies": "usd", "include_24hr_change": "true", "include_24hr_vol": "true"},
                timeout=10.0
            )
            
            if prices_resp.status_code == 200:
                prices_data = prices_resp.json()
                btc_price = prices_data.get("bitcoin", {}).get("usd", 67000)
                eth_price = prices_data.get("ethereum", {}).get("usd", 3200)
                btc_change_24h = prices_data.get("bitcoin", {}).get("usd_24h_change", 0)
                eth_change_24h = prices_data.get("ethereum", {}).get("usd_24h_change", 0)
                btc_volume = prices_data.get("bitcoin", {}).get("usd_24h_vol", 0)
                eth_volume = prices_data.get("ethereum", {}).get("usd_24h_vol", 0)
            else:
                # Fallback to hardcoded recent values
                btc_price, eth_price = 67000, 3200
                btc_change_24h, eth_change_24h = -2.5, -3.1
                btc_volume, eth_volume = 25000000000, 12000000000
            
            # Estimate market dominance
            btc_dominance = 54.5 + (btc_change_24h - eth_change_24h) * 0.3
            eth_dominance = 16.5 - (btc_change_24h - eth_change_24h) * 0.15
            
            results["btc_dominance"] = {
                "btc_dominance": round(max(45, min(65, btc_dominance)), 2),
                "eth_dominance": round(max(12, min(22, eth_dominance)), 2),
                "btc_price": round(btc_price, 2),
                "eth_price": round(eth_price, 2),
                "btc_change_24h": round(btc_change_24h, 2),
                "eth_change_24h": round(eth_change_24h, 2),
                "btc_volume_24h": round(btc_volume, 0),
                "eth_volume_24h": round(eth_volume, 0)
            }
            
            results["_btc_price"] = btc_price
            results["_eth_price"] = eth_price
            results["_btc_change"] = btc_change_24h
            
        except Exception as e:
            logger.warning(f"Price API error: {e}")
            results["btc_dominance"] = {"btc_dominance": 54.5, "eth_dominance": 16.5, "btc_price": 67000, "eth_price": 3200, "btc_change_24h": -2.5, "eth_change_24h": -3.1}
            results["_btc_price"] = 67000
            results["_eth_price"] = 3200
            results["_btc_change"] = -2.5
        
        # ============ 3. ETH Gas Tracker (Etherscan V2 - FREE with API key) ============
        etherscan_api_key = os.environ.get("ETHERSCAN_API_KEY", "")
        try:
            gas_resp = await client.get(
                "https://api.etherscan.io/v2/api",
                params={"chainid": 1, "module": "gastracker", "action": "gasoracle", "apikey": etherscan_api_key},
                timeout=10.0
            )
            if gas_resp.status_code == 200:
                gas_data = gas_resp.json()
                if gas_data.get("status") == "1":
                    result = gas_data["result"]
                    def parse_gas(v):
                        try: return int(float(v)) if v else 0
                        except: return 0
                    
                    results["eth_gas"] = {
                        "low": parse_gas(result.get("SafeGasPrice", 0)),
                        "average": parse_gas(result.get("ProposeGasPrice", 0)),
                        "high": parse_gas(result.get("FastGasPrice", 0)),
                        "base_fee": round(float(result.get("suggestBaseFee", 0) or 0), 2),
                        "last_block": result.get("LastBlock", ""),
                        "gas_used_ratio": result.get("gasUsedRatio", "")
                    }
        except Exception as e:
            logger.warning(f"ETH Gas API error: {e}")
            results["eth_gas"] = {"low": 10, "average": 15, "high": 25, "base_fee": 0.5}
        
        # ============ 4. Rainbow Chart BTC (Using stored BTC price) ============
        try:
            current_price = results.get("_btc_price", 67000)
            
            # Rainbow band calculation based on logarithmic regression
            import math
            days_since_genesis = (datetime.now(timezone.utc) - datetime(2009, 1, 3, tzinfo=timezone.utc)).days
            
            # More accurate rainbow bands based on actual model
            base = 10 ** (1.5 + (days_since_genesis / 1500))
            bands = {
                "fire_sale": round(base * 0.08, 0),
                "buy": round(base * 0.15, 0),
                "accumulate": round(base * 0.25, 0),
                "still_cheap": round(base * 0.40, 0),
                "hold": round(base * 0.60, 0),
                "is_this_a_bubble": round(base * 0.90, 0),
                "fomo": round(base * 1.30, 0),
                "sell": round(base * 1.80, 0),
                "max_bubble": round(base * 2.50, 0)
            }
            
            # Determine current band
            current_band = "hold"
            band_order = ["fire_sale", "buy", "accumulate", "still_cheap", "hold", "is_this_a_bubble", "fomo", "sell", "max_bubble"]
            for band in band_order:
                if current_price < bands[band]:
                    current_band = band
                    break
            else:
                current_band = "max_bubble"
            
            results["rainbow_chart"] = {
                "current_price": round(current_price, 2),
                "current_band": current_band,
                "bands": bands,
                "days_since_genesis": days_since_genesis,
                "band_colors": {
                    "fire_sale": "#3B0A7A",
                    "buy": "#0000FF", 
                    "accumulate": "#00BFFF",
                    "still_cheap": "#00FF7F",
                    "hold": "#7CFC00",
                    "is_this_a_bubble": "#FFFF00",
                    "fomo": "#FFA500",
                    "sell": "#FF4500",
                    "max_bubble": "#8B0000"
                }
            }
        except Exception as e:
            logger.warning(f"Rainbow Chart error: {e}")
            results["rainbow_chart"] = {"current_price": results.get("_btc_price", 67000), "current_band": "hold", "bands": {}}
        
        # ============ 5. Altcoin Season Index (CoinGecko API) ============
        try:
            # Get top coins from CoinGecko
            coins_resp = await client.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": 50, "page": 1, "sparkline": "false", "price_change_percentage": "24h"},
                timeout=15.0
            )
            
            if coins_resp.status_code == 200:
                coins = coins_resp.json()
                
                btc_change = 0
                altcoins_data = []
                
                for coin in coins:
                    symbol = coin.get("symbol", "").upper()
                    change = coin.get("price_change_percentage_24h", 0) or 0
                    price = coin.get("current_price", 0)
                    
                    if symbol == "BTC":
                        btc_change = change
                    elif symbol not in ["USDT", "USDC", "BUSD", "DAI", "TUSD"]:
                        altcoins_data.append({
                            "symbol": symbol,
                            "name": coin.get("name", ""),
                            "change_24h": round(change, 2),
                            "price": price,
                            "image": coin.get("image", "")
                        })
                
                altcoins_data.sort(key=lambda x: x["change_24h"], reverse=True)
                altcoins_outperforming = sum(1 for a in altcoins_data if a["change_24h"] > btc_change)
                total_altcoins = len(altcoins_data)
                
                altcoin_index = round((altcoins_outperforming / total_altcoins * 100)) if total_altcoins > 0 else 50
                
                season = "neutral"
                season_label = "Neutre"
                if altcoin_index >= 75:
                    season, season_label = "altcoin_season", "🚀 Altcoin Season"
                elif altcoin_index >= 60:
                    season, season_label = "alt_favored", "📈 Altcoins Favorisés"
                elif altcoin_index <= 25:
                    season, season_label = "btc_season", "₿ Bitcoin Season"
                elif altcoin_index <= 40:
                    season, season_label = "btc_favored", "📊 BTC Favorisé"
                
                results["altcoin_season"] = {
                    "index": altcoin_index,
                    "season": season,
                    "season_label": season_label,
                    "btc_performance_24h": round(btc_change, 2),
                    "altcoins_outperforming": altcoins_outperforming,
                    "total_altcoins": total_altcoins,
                    "top_gainers": altcoins_data[:5],
                    "top_losers": altcoins_data[-5:][::-1] if len(altcoins_data) >= 5 else []
                }
            else:
                # Use fallback based on BTC dominance
                btc_change = results.get("_btc_change", 0)
                altcoin_index = 50 + int(btc_change * -2)  # Inverse correlation
                altcoin_index = max(20, min(80, altcoin_index))
                
                season = "neutral"
                season_label = "Neutre"
                if altcoin_index >= 65:
                    season, season_label = "alt_favored", "📈 Altcoins Favorisés"
                elif altcoin_index <= 35:
                    season, season_label = "btc_favored", "📊 BTC Favorisé"
                
                results["altcoin_season"] = {
                    "index": altcoin_index,
                    "season": season,
                    "season_label": season_label,
                    "btc_performance_24h": round(btc_change, 2),
                    "top_gainers": [],
                    "top_losers": []
                }
        except Exception as e:
            logger.warning(f"Altcoin Season error: {e}")
            results["altcoin_season"] = {"index": 50, "season": "neutral", "season_label": "Neutre"}
        
        # ============ 6. Bitcoin Halving Countdown (blockchain.info - FREE) ============
        HALVING_BLOCK = 1050000
        BLOCKS_PER_DAY = 144
        try:
            block_resp = await client.get("https://blockchain.info/latestblock", timeout=5.0)
            current_block = block_resp.json().get("height", 940000) if block_resp.status_code == 200 else 940000
        except:
            current_block = 940000
        
        blocks_remaining = max(0, HALVING_BLOCK - current_block)
        days_remaining = blocks_remaining / BLOCKS_PER_DAY
        estimated_date = datetime.now(timezone.utc) + timedelta(days=days_remaining)
        progress = ((current_block - 840000) / (HALVING_BLOCK - 840000) * 100) if current_block > 840000 else 0
        
        results["halving"] = {
            "current_block": current_block,
            "halving_block": HALVING_BLOCK,
            "blocks_remaining": blocks_remaining,
            "days_remaining": int(days_remaining),
            "hours_remaining": int((days_remaining % 1) * 24),
            "estimated_date": estimated_date.strftime("%d %B %Y"),
            "current_reward": 3.125,
            "next_reward": 1.5625,
            "progress_percent": round(progress, 2),
            "halvings_completed": 4,
            "supply_mined_percent": round((current_block * 3.125 / 21000000) * 100, 2) if current_block < HALVING_BLOCK else 0
        }
        
        # ============ 7. Whale Alerts (Etherscan - REAL transactions) ============
        whale_alerts = []
        eth_price = results.get("_eth_price", 3200)
        
        WHALE_WALLETS = [
            {"address": "0x28C6c06298d514Db089934071355E5743bf21d60", "name": "Binance Hot", "icon": "🟡"},
            {"address": "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549", "name": "Binance Cold", "icon": "🔒"},
            {"address": "0xdfd5293d8e347dfe59e90efd55b2956a1343963d", "name": "Bitfinex", "icon": "🟢"},
        ]
        
        try:
            for wallet in WHALE_WALLETS[:3]:
                tx_resp = await client.get(
                    "https://api.etherscan.io/v2/api",
                    params={
                        "chainid": 1, "module": "account", "action": "txlist",
                        "address": wallet["address"], "startblock": 0, "endblock": 99999999,
                        "page": 1, "offset": 5, "sort": "desc", "apikey": etherscan_api_key
                    },
                    timeout=10.0
                )
                
                if tx_resp.status_code == 200:
                    tx_data = tx_resp.json()
                    if tx_data.get("status") == "1" and tx_data.get("result"):
                        for tx in tx_data["result"][:3]:
                            value_eth = int(tx.get("value", 0)) / 1e18
                            if value_eth >= 5:
                                is_incoming = tx.get("to", "").lower() == wallet["address"].lower()
                                tx_time = datetime.fromtimestamp(int(tx.get("timeStamp", 0)), tz=timezone.utc)
                                time_ago = datetime.now(timezone.utc) - tx_time
                                
                                whale_alerts.append({
                                    "id": tx.get("hash", "")[:16],
                                    "wallet_name": wallet["name"],
                                    "wallet_icon": wallet["icon"],
                                    "type": "in" if is_incoming else "out",
                                    "amount_eth": round(value_eth, 2),
                                    "amount_usd": round(value_eth * eth_price, 0),
                                    "time_ago": f"{int(time_ago.total_seconds() / 3600)}h" if time_ago.total_seconds() < 86400 else f"{int(time_ago.days)}j",
                                    "tx_hash": tx.get("hash", ""),
                                    "etherscan_url": f"https://etherscan.io/tx/{tx.get('hash', '')}"
                                })
                
                await asyncio.sleep(0.2)
        except Exception as e:
            logger.warning(f"Whale alerts error: {e}")
        
        whale_alerts.sort(key=lambda x: x.get("time_ago", "99j"))
        results["whale_alerts"] = whale_alerts[:8]
        
        # ============ 8. Liquidations (Estimated from volatility) ============
        btc_change = results.get("_btc_change", 0)
        base_liq = 150000000
        volatility = abs(btc_change) / 2 + 1
        
        if btc_change > 0:
            shorts_liq = base_liq * volatility * 1.5
            longs_liq = base_liq * volatility * 0.5
        else:
            longs_liq = base_liq * volatility * 1.5
            shorts_liq = base_liq * volatility * 0.5
        
        results["liquidations"] = {
            "total_24h": round(longs_liq + shorts_liq),
            "longs_24h": round(longs_liq),
            "shorts_24h": round(shorts_liq),
            "largest": round(max(longs_liq, shorts_liq) * 0.03),
            "btc_change_24h": round(btc_change, 2),
            "dominant": "shorts" if btc_change > 0 else "longs"
        }
        
        # ============ 9. Top Movers (from altcoin_season data) ============
        if "altcoin_season" in results and results["altcoin_season"].get("top_gainers"):
            results["top_movers"] = {
                "gainers": results["altcoin_season"].get("top_gainers", [])[:5],
                "losers": results["altcoin_season"].get("top_losers", [])[:5]
            }
        else:
            results["top_movers"] = {"gainers": [], "losers": []}
        
        # ============ 10. Open Interest / Market Sentiment (from liquidations) ============
        btc_change = results.get("_btc_change", 0)
        results["market_sentiment"] = {
            "overall": "bullish" if btc_change > 1 else "bearish" if btc_change < -1 else "neutral",
            "btc_trend": "up" if btc_change > 0 else "down",
            "fear_greed_zone": results.get("fear_greed", {}).get("current", {}).get("classification", "Neutral"),
            "recommendation": "HODL" if 40 <= results.get("fear_greed", {}).get("current", {}).get("value", 50) <= 60 else "Prudence" if results.get("fear_greed", {}).get("current", {}).get("value", 50) < 25 else "Achat progressif" if results.get("fear_greed", {}).get("current", {}).get("value", 50) < 40 else "Attention"
        }
        
        # Clean up internal variables
        results.pop("_btc_price", None)
        results.pop("_eth_price", None)
        results.pop("_btc_change", None)
        
        return {
            "success": True,
            "data": results,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "data_sources": ["CoinCap", "Etherscan", "Binance", "Blockchain.info", "Alternative.me"]
        }

@api_router.get("/vip/tools/fear-greed")
async def get_fear_greed_index(user: dict = Depends(require_vip)):
    """Get Fear & Greed Index"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://api.alternative.me/fng/?limit=30", timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "success": True,
                    "data": {
                        "current": {
                            "value": int(data["data"][0]["value"]),
                            "classification": data["data"][0]["value_classification"],
                            "timestamp": data["data"][0]["timestamp"]
                        },
                        "history": [{"value": int(d["value"]), "date": d["timestamp"]} for d in data["data"]]
                    }
                }
    except Exception as e:
        logger.error(f"Fear & Greed error: {e}")
    
    raise HTTPException(status_code=500, detail="Error fetching data")

@api_router.get("/vip/tools/halving")
async def get_halving_countdown(user: dict = Depends(require_vip)):
    """Get Bitcoin Halving Countdown"""
    HALVING_BLOCK = 1050000
    BLOCKS_PER_DAY = 144
    LAST_HALVING_DATE = datetime(2024, 4, 20, tzinfo=timezone.utc)
    
    try:
        async with httpx.AsyncClient() as client:
            block_resp = await client.get("https://blockchain.info/latestblock", timeout=5.0)
            if block_resp.status_code == 200:
                current_block = block_resp.json().get("height", 880000)
            else:
                days_since_halving = (datetime.now(timezone.utc) - LAST_HALVING_DATE).days
                current_block = 840000 + (days_since_halving * BLOCKS_PER_DAY)
    except:
        days_since_halving = (datetime.now(timezone.utc) - LAST_HALVING_DATE).days
        current_block = 840000 + (days_since_halving * BLOCKS_PER_DAY)
    
    blocks_remaining = HALVING_BLOCK - current_block
    days_remaining = blocks_remaining / BLOCKS_PER_DAY
    estimated_date = datetime.now(timezone.utc) + timedelta(days=days_remaining)
    
    return {
        "success": True,
        "data": {
            "current_block": int(current_block),
            "halving_block": HALVING_BLOCK,
            "blocks_remaining": int(blocks_remaining),
            "days_remaining": int(days_remaining),
            "estimated_date": estimated_date.strftime("%Y-%m-%d"),
            "current_reward": 3.125,
            "next_reward": 1.5625,
            "progress_percent": round((current_block - 840000) / (HALVING_BLOCK - 840000) * 100, 2)
        }
    }

# ==================== AI ANALYSIS (Enhanced for VIP) ====================

@api_router.post("/vip/ai/analyze")
async def vip_ai_analyze(
    query: str,
    crypto_symbol: str = None,
    analysis_type: str = "general",
    user: dict = Depends(require_vip)
):
    """Advanced AI analysis for VIP users (unlimited, no daily limit)"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        llm_key = os.environ.get("EMERGENT_LLM_KEY")
        if not llm_key:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        
        # Create unique session for this analysis
        session_id = f"vip-text-{user['id']}-{uuid.uuid4().hex[:8]}"
        
        system_prompt = f"""Tu es un analyste crypto expert VIP. Tu fournis des analyses détaillées et professionnelles.
Type d'analyse demandée: {analysis_type}
{"Crypto analysée: " + crypto_symbol if crypto_symbol else ""}

Réponds de manière structurée avec:
1. 📊 Résumé exécutif
2. 📈 Analyse technique (si applicable)
3. 💡 Analyse fondamentale (si applicable)
4. ⚠️ Risques identifiés
5. 🎯 Recommandation finale

Utilise des données récentes et sois précis dans ton analyse."""
        
        # Initialize chat with GPT-4o
        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        # Send message
        user_message = UserMessage(text=query)
        response = await chat.send_message(user_message)
        
        return {
            "success": True,
            "data": {
                "analysis": response,
                "analysis_type": analysis_type,
                "crypto_symbol": crypto_symbol,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"VIP AI Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur d'analyse: {str(e)}")


class ImageAnalysisRequest(BaseModel):
    query: str
    image_base64: str
    analysis_type: str = "general"


@api_router.get("/vip/daily-briefing")
async def get_daily_briefing(lang: str = "en", user: dict = Depends(require_vip)):
    """Generate AI daily market briefing for VIP users"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        lang_map = {"fr": "French", "es": "Spanish", "en": "English"}
        target_lang = lang_map.get(lang, "English")
        
        # Check cache first (briefing valid for 4 hours, per language)
        cache_key = f"{datetime.now(timezone.utc).strftime('%Y-%m-%d')}_{lang}"
        cached = await db.daily_briefings.find_one(
            {"cache_key": cache_key},
            {"_id": 0}
        )
        if cached and cached.get("generated_at"):
            cache_age = (datetime.now(timezone.utc) - datetime.fromisoformat(cached["generated_at"])).total_seconds()
            if cache_age < 14400:  # 4 hours
                return {"success": True, "data": cached}
        
        # Fetch real market data
        market_data = {}
        async with httpx.AsyncClient(timeout=10) as http_client:
            try:
                prices_resp = await http_client.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": "bitcoin,ethereum,solana,ripple", "vs_currencies": "usd", "include_24hr_change": "true", "include_market_cap": "true"}
                )
                if prices_resp.status_code == 200:
                    market_data["prices"] = prices_resp.json()
            except:
                market_data["prices"] = {"bitcoin": {"usd": 67000, "usd_24h_change": 1.5}, "ethereum": {"usd": 3200, "usd_24h_change": 0.8}}
            
            try:
                fng_resp = await http_client.get("https://api.alternative.me/fng/?limit=1")
                if fng_resp.status_code == 200:
                    fng_data = fng_resp.json().get("data", [{}])[0]
                    market_data["fear_greed"] = {"value": fng_data.get("value"), "label": fng_data.get("value_classification")}
            except:
                market_data["fear_greed"] = {}
        
        llm_key = os.environ.get("EMERGENT_LLM_KEY")
        if not llm_key:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        
        session_id = f"daily-briefing-{datetime.now(timezone.utc).strftime('%Y%m%d')}"
        
        system_prompt = f"""You are a professional crypto market analyst providing a daily briefing. 
You MUST respond entirely in {target_lang}.
You must respond in valid JSON format with this exact structure:
{{
  "market_summary": "2-3 sentence overview of today's market in {target_lang}",
  "btc_analysis": "1-2 sentences about Bitcoin's current state in {target_lang}",
  "eth_analysis": "1-2 sentences about Ethereum's current state in {target_lang}",
  "sentiment": "bullish" or "bearish" or "neutral",
  "sentiment_reason": "1 sentence explaining why in {target_lang}",
  "key_events": ["event 1 in {target_lang}", "event 2", "event 3"],
  "opportunity": "1-2 sentences about a potential opportunity today in {target_lang}",
  "risk_alert": "1 sentence about the main risk to watch in {target_lang}"
}}
Keep it concise, professional, and actionable. No disclaimers in the JSON. The sentiment field must stay as english keywords (bullish/bearish/neutral), but all text content must be in {target_lang}."""
        
        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        user_msg = UserMessage(
            text=f"""Generate today's daily crypto briefing based on this real market data:
{json.dumps(market_data, indent=2)}
Date: {datetime.now(timezone.utc).strftime('%B %d, %Y')}"""
        )
        
        response = await chat.send_message(user_msg)
        response_text = response.text if hasattr(response, 'text') else str(response)
        
        # Parse JSON from response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            briefing_data = json.loads(json_match.group())
        else:
            briefing_data = {"market_summary": response.text, "sentiment": "neutral", "key_events": [], "btc_analysis": "", "eth_analysis": "", "sentiment_reason": "", "opportunity": "", "risk_alert": ""}
        
        # Add metadata
        briefing_data["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        briefing_data["generated_at"] = datetime.now(timezone.utc).isoformat()
        briefing_data["market_data"] = market_data
        briefing_data["cache_key"] = cache_key
        
        # Cache in DB
        await db.daily_briefings.update_one(
            {"cache_key": cache_key},
            {"$set": briefing_data},
            upsert=True
        )
        
        return {"success": True, "data": briefing_data}
        
    except json.JSONDecodeError:
        return {"success": True, "data": {"market_summary": response.text if 'response' in dir() else "Unable to generate briefing", "sentiment": "neutral", "key_events": [], "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "generated_at": datetime.now(timezone.utc).isoformat()}}
    except Exception as e:
        logger.error(f"Daily briefing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/vip/ai/analyze-image")
async def vip_ai_analyze_image(
    request: ImageAnalysisRequest,
    user: dict = Depends(require_vip)
):
    """Advanced AI image analysis for VIP users - analyze crypto charts, portfolios, etc."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        llm_key = os.environ.get("EMERGENT_LLM_KEY")
        if not llm_key:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        
        session_id = f"vip-image-{user['id']}-{uuid.uuid4().hex[:8]}"
        
        is_chart = request.analysis_type == "chart_analysis"
        
        if is_chart:
            system_prompt = """Tu es un analyste technique crypto expert de niveau institutionnel. Tu analyses les graphiques de trading (TradingView, Binance, etc.) envoyés par les utilisateurs.

Pour chaque graphique, tu DOIS fournir une analyse structurée au format suivant (utilise EXACTEMENT ces balises) :

[SIGNAL]
Achat / Vente / Attendre
[/SIGNAL]

[ENTRY]
Prix d'entrée recommandé (en USD)
[/ENTRY]

[STOPLOSS]
Prix du Stop Loss recommandé (en USD)
[/STOPLOSS]

[TAKEPROFIT]
TP1: prix
TP2: prix  
TP3: prix (optionnel)
[/TAKEPROFIT]

[RATIO]
Ratio Risque/Récompense (ex: 1:2.5)
[/RATIO]

[ANALYSE]
Explication détaillée de l'analyse technique : patterns identifiés, supports/résistances, indicateurs (RSI, MACD, volumes, moyennes mobiles), tendance générale.
[/ANALYSE]

[NEWS]
Contexte des actualités récentes qui expliquent pourquoi le marché est bullish ou bearish. Mentionne les événements macro-économiques, régulations, mouvements institutionnels ou techniques pertinents.
[/NEWS]

[SENTIMENT]
bullish / bearish / neutral
[/SENTIMENT]

Sois précis sur les prix. Si tu ne peux pas identifier la crypto ou le timeframe exactement, demande des précisions mais fournis quand même une analyse basée sur ce que tu vois.
"""
        else:
            system_prompt = """Tu es un analyste crypto expert VIP spécialisé dans l'analyse visuelle.
Tu analyses les graphiques, captures d'écran de portfolios, et images liées aux cryptomonnaies.

Pour chaque image, fournis:
1. Description détaillée de ce que tu vois
2. Analyse technique (tendances, patterns, supports/résistances si c'est un graphique)
3. Insights et observations importantes
4. Points d'attention ou risques identifiés
5. Recommandations pratiques

Sois précis, professionnel et utile dans ton analyse."""
        
        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=request.image_base64)
        
        user_message = UserMessage(
            text=request.query or ("Analyse ce graphique de trading et donne-moi tes recommandations avec points d'entrée, stop loss et take profit." if is_chart else "Analyse cette image en détail et donne-moi tes insights."),
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Store analysis in history
        await db.ai_analyses.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "query": request.query,
            "analysis_type": request.analysis_type,
            "has_image": True,
            "is_chart": is_chart,
            "response": response,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "data": {
                "analysis": response,
                "analysis_type": request.analysis_type,
                "has_image": True,
                "is_chart": is_chart,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"VIP AI Image Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur d'analyse d'image: {str(e)}")


# ==================== SOCIAL POSTS ENHANCED ====================

class CreateSocialPostRequest(BaseModel):
    content: str
    image_base64: Optional[str] = None
    crypto_mentions: List[str] = []


@api_router.post("/vip/social/posts/create")
async def create_social_post_enhanced(
    request: CreateSocialPostRequest,
    user: dict = Depends(require_vip)
):
    """Create a social post with optional image (VIP only)"""
    if len(request.content) > 1000:
        raise HTTPException(status_code=400, detail="Content cannot exceed 1000 characters")
    
    post_id = str(uuid.uuid4())
    
    # Handle image upload if provided
    image_url = None
    if request.image_base64:
        # Store image data (in production, upload to cloud storage)
        # For now, we'll store a reference
        image_id = str(uuid.uuid4())
        await db.post_images.insert_one({
            "id": image_id,
            "post_id": post_id,
            "image_base64": request.image_base64,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        image_url = f"/api/vip/social/posts/{post_id}/image"
    
    post_data = {
        "id": post_id,
        "author_id": user["id"],
        "author_name": user.get("name", "VIP User"),
        "author_avatar_color": user.get("avatar_color", "#7C3AED"),
        "content": request.content,
        "crypto_mentions": request.crypto_mentions,
        "has_image": image_url is not None,
        "image_url": image_url,
        "likes": 0,
        "comments_count": 0,
        "is_vip": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.social_posts.insert_one(post_data)
    
    # Award points for posting
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"gamification_points": 15}}
    )
    
    return {"success": True, "data": {"id": post_id, "message": "Post créé avec succès"}}


@api_router.get("/vip/social/posts/{post_id}/image")
async def get_post_image(post_id: str):
    """Get image for a social post"""
    image_doc = await db.post_images.find_one({"post_id": post_id})
    if not image_doc:
        raise HTTPException(status_code=404, detail="Image not found")
    
    return {"success": True, "data": {"image_base64": image_doc["image_base64"]}}


@api_router.get("/vip/social/feed/enhanced")
async def get_enhanced_social_feed(
    skip: int = 0,
    limit: int = 20,
    user: dict = Depends(require_vip)
):
    """Get enhanced VIP social feed with images and more data"""
    posts = await db.social_posts.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    user_likes = await db.social_likes.find({"user_id": user["id"]}).to_list(1000)
    liked_post_ids = {like["post_id"] for like in user_likes}
    
    enhanced_posts = []
    for post in posts:
        post_data = {
            "id": post["id"],
            "author_id": post.get("author_id"),
            "author_name": post.get("author_name", "Anonyme"),
            "author_avatar_color": post.get("author_avatar_color", "#7C3AED"),
            "content": post.get("content", ""),
            "crypto_mentions": post.get("crypto_mentions", []),
            "has_image": post.get("has_image", False),
            "image_url": post.get("image_url"),
            "likes": post.get("likes", 0),
            "comments_count": post.get("comments_count", 0),
            "is_liked": post["id"] in liked_post_ids,
            "is_vip": post.get("is_vip", True),
            "created_at": post.get("created_at")
        }
        enhanced_posts.append(post_data)
    
    total = await db.social_posts.count_documents({})
    
    return {
        "success": True,
        "data": enhanced_posts,
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
            "has_more": skip + limit < total
        }
    }


# ==================== VIP STORIES (24H EPHEMERAL) ====================

class CreateStoryRequest(BaseModel):
    image_base64: str
    text_overlay: Optional[str] = None
    background_color: Optional[str] = "#7C3AED"


@api_router.post("/vip/stories/create")
async def create_story(
    request: CreateStoryRequest,
    user: dict = Depends(require_vip)
):
    """Create a new ephemeral story (expires in 24h) - VIP only"""
    story_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    story_data = {
        "id": story_id,
        "author_id": user["id"],
        "author_name": user.get("name", "VIP User"),
        "author_avatar_color": user.get("avatar_color", "#7C3AED"),
        "image_base64": request.image_base64,
        "text_overlay": request.text_overlay,
        "background_color": request.background_color,
        "views_count": 0,
        "viewers": [],
        "reactions": {"❤️": 0, "🔥": 0, "👏": 0, "🚀": 0, "💎": 0},
        "reaction_users": {},
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat()
    }
    
    await db.vip_stories.insert_one(story_data)
    
    # Award points
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"gamification_points": 10}}
    )
    
    return {"success": True, "data": {"id": story_id, "expires_at": expires_at.isoformat()}}


@api_router.get("/vip/stories")
async def get_active_stories(user: dict = Depends(require_vip)):
    """Get all active stories (not expired)"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Find active stories
    stories = await db.vip_stories.find({
        "is_active": True,
        "expires_at": {"$gt": now}
    }).sort("created_at", -1).to_list(100)
    
    # Group by author
    stories_by_author = {}
    for story in stories:
        author_id = story["author_id"]
        if author_id not in stories_by_author:
            stories_by_author[author_id] = {
                "author_id": author_id,
                "author_name": story.get("author_name", "VIP"),
                "author_avatar_color": story.get("author_avatar_color", "#7C3AED"),
                "has_unseen": author_id not in [v for s in stories for v in s.get("viewers", [])],
                "stories": []
            }
        
        # Check if current user has viewed
        has_viewed = user["id"] in story.get("viewers", [])
        user_reaction = story.get("reaction_users", {}).get(user["id"])
        
        stories_by_author[author_id]["stories"].append({
            "id": story["id"],
            "image_base64": story["image_base64"],
            "text_overlay": story.get("text_overlay"),
            "background_color": story.get("background_color", "#7C3AED"),
            "views_count": story.get("views_count", 0),
            "reactions": story.get("reactions", {}),
            "has_viewed": has_viewed,
            "user_reaction": user_reaction,
            "created_at": story["created_at"],
            "expires_at": story["expires_at"]
        })
        
        # Update has_unseen
        if not has_viewed:
            stories_by_author[author_id]["has_unseen"] = True
    
    return {
        "success": True,
        "data": list(stories_by_author.values())
    }


@api_router.post("/vip/stories/{story_id}/view")
async def view_story(story_id: str, user: dict = Depends(require_vip)):
    """Mark a story as viewed by current user"""
    story = await db.vip_stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Add viewer if not already viewed
    if user["id"] not in story.get("viewers", []):
        await db.vip_stories.update_one(
            {"id": story_id},
            {
                "$addToSet": {"viewers": user["id"]},
                "$inc": {"views_count": 1}
            }
        )
    
    return {"success": True}


@api_router.post("/vip/stories/{story_id}/react")
async def react_to_story(
    story_id: str,
    reaction: str,
    user: dict = Depends(require_vip)
):
    """React to a story with emoji"""
    valid_reactions = ["❤️", "🔥", "👏", "🚀", "💎"]
    if reaction not in valid_reactions:
        raise HTTPException(status_code=400, detail=f"Réaction invalide. Utilisez: {', '.join(valid_reactions)}")
    
    story = await db.vip_stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Get user's previous reaction
    reaction_users = story.get("reaction_users", {})
    previous_reaction = reaction_users.get(user["id"])
    
    # Update reactions
    update_ops = {}
    
    if previous_reaction:
        # Remove previous reaction
        update_ops[f"reactions.{previous_reaction}"] = -1
    
    if previous_reaction != reaction:
        # Add new reaction
        update_ops[f"reactions.{reaction}"] = 1
        update_ops_set = {f"reaction_users.{user['id']}": reaction}
    else:
        # Remove reaction (toggle off)
        update_ops_set = {f"reaction_users.{user['id']}": None}
    
    if update_ops:
        await db.vip_stories.update_one(
            {"id": story_id},
            {"$inc": update_ops, "$set": update_ops_set}
        )
    
    # Send notification to story owner
    if story["author_id"] != user["id"] and previous_reaction != reaction:
        await send_notification_to_user(
            story["author_id"],
            f"{user.get('name', 'Un VIP')} a réagi {reaction} à votre story",
            "story_reaction",
            {"story_id": story_id}
        )
    
    return {"success": True}


@api_router.delete("/vip/stories/{story_id}")
async def delete_story(story_id: str, user: dict = Depends(require_vip)):
    """Delete own story"""
    story = await db.vip_stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["author_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos propres stories")
    
    await db.vip_stories.delete_one({"id": story_id})
    return {"success": True}


# ==================== PUSH NOTIFICATIONS ====================

class RegisterPushTokenRequest(BaseModel):
    token: str
    device_type: str = "unknown"


@api_router.post("/notifications/register-token")
async def register_push_token(
    request: RegisterPushTokenRequest,
    user: dict = Depends(get_current_user)
):
    """Register an Expo push token for the current user"""
    if not request.token.startswith("ExponentPushToken["):
        raise HTTPException(status_code=400, detail="Token Expo invalide")
    
    # Check if token already exists
    existing = await db.push_tokens.find_one({"token": request.token})
    
    if existing:
        # Update if belongs to another user or reactivate
        await db.push_tokens.update_one(
            {"token": request.token},
            {
                "$set": {
                    "user_id": user["id"],
                    "device_type": request.device_type,
                    "is_active": True,
                    "last_seen_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    else:
        await db.push_tokens.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "token": request.token,
            "device_type": request.device_type,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_seen_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"success": True, "message": "Token enregistré"}


@api_router.delete("/notifications/unregister-token")
async def unregister_push_token(token: str, user: dict = Depends(get_current_user)):
    """Unregister a push token"""
    await db.push_tokens.update_one(
        {"token": token, "user_id": user["id"]},
        {"$set": {"is_active": False}}
    )
    return {"success": True}


@api_router.get("/notifications/history")
async def get_notification_history(
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get user's notification history"""
    notifications = await db.notifications.find(
        {"user_id": user["id"]}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "data": [{
            "id": n.get("id"),
            "title": n.get("title"),
            "body": n.get("body"),
            "type": n.get("type"),
            "data": n.get("data"),
            "is_read": n.get("is_read", False),
            "created_at": n.get("created_at")
        } for n in notifications]
    }


class MarkNotificationsRequest(BaseModel):
    notification_ids: List[str] = []


@api_router.post("/notifications/mark-read")
async def mark_notifications_as_read(
    request: MarkNotificationsRequest,
    user: dict = Depends(get_current_user)
):
    """Mark notifications as read"""
    if request.notification_ids:
        await db.notifications.update_many(
            {"id": {"$in": request.notification_ids}, "user_id": user["id"]},
            {"$set": {"is_read": True}}
        )
    else:
        # Mark all as read
        await db.notifications.update_many(
            {"user_id": user["id"]},
            {"$set": {"is_read": True}}
        )
    
    return {"success": True}


async def send_notification_to_user(
    user_id: str,
    body: str,
    notification_type: str,
    data: dict = None,
    title: str = "Mentova VIP"
):
    """Send push notification to a specific user"""
    try:
        # Store notification in history FIRST (regardless of push token)
        notification_id = str(uuid.uuid4())
        await db.notifications.insert_one({
            "id": notification_id,
            "user_id": user_id,
            "title": title,
            "body": body,
            "type": notification_type,
            "data": data or {},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Get user's active tokens
        tokens = await db.push_tokens.find({
            "user_id": user_id,
            "is_active": True
        }).to_list(10)
        
        if not tokens:
            # Notification stored but no push tokens to send to
            logger.info(f"Notification stored for user {user_id}, no push tokens registered")
            return True
        
        # Send to Expo Push Service
        import httpx
        
        messages = []
        for token_doc in tokens:
            messages.append({
                "to": token_doc["token"],
                "title": title,
                "body": body,
                "data": data or {},
                "sound": "default",
                "priority": "high"
            })
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                logger.info(f"Push notification sent to user {user_id}")
            else:
                logger.error(f"Push notification failed: {response.text}")
        
        # Also send via WebSocket for real-time updates
        if user_id in connected_users:
            await sio.emit('notification', {
                'id': notification_id,
                'type': notification_type,
                'title': title,
                'body': body,
                'data': data or {},
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, room=connected_users[user_id])
            logger.info(f"WebSocket notification sent to user {user_id}")
        
        return True
                
    except Exception as e:
        logger.error(f"Push notification error: {e}")
        return False


# Helper function to send email with session meeting link after purchase
async def send_session_access_email(
    user_email: str,
    user_name: str,
    offer_title: str,
    meeting_links: list,  # List of {title, meeting_link, session_type}
    purchase_id: str
):
    """Send email with meeting link(s) after successful purchase"""
    try:
        if not meeting_links:
            logger.info(f"No meeting links to send for purchase {purchase_id}")
            return True
        
        # Build meeting links HTML
        links_html = ""
        for link_info in meeting_links:
            session_title = link_info.get("title", "Session Live")
            meeting_link = link_info.get("meeting_link", "")
            session_type = link_info.get("session_type", "session")
            
            if meeting_link:
                links_html += f"""
                <tr>
                  <td style="padding: 16px; background-color: #1A1A2E; border-radius: 12px; margin-bottom: 12px;">
                    <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #FFFFFF;">{session_title}</p>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #8B8B9E;">Type: {session_type.replace('_', ' ').title()}</p>
                    <a href="{meeting_link}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #7C3AED, #5B21B6); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">
                      Rejoindre la session
                    </a>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                """
        
        if not links_html:
            return True
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0F0F0F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px;">
                  <!-- Header -->
                  <tr>
                    <td style="text-align: center; padding-bottom: 32px;">
                      <h1 style="margin: 0; font-size: 28px; color: #7C3AED;">Mentova VIP</h1>
                    </td>
                  </tr>
                  
                  <!-- Main Content -->
                  <tr>
                    <td style="background-color: #1A1A2E; border-radius: 16px; padding: 32px;">
                      <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #FFFFFF;">
                        🎉 Achat confirmé !
                      </h2>
                      <p style="margin: 0 0 24px 0; font-size: 16px; color: #C4C4C4; line-height: 1.6;">
                        Bonjour {user_name},<br><br>
                        Merci pour votre achat de <strong style="color: #7C3AED;">{offer_title}</strong> !
                        Voici vos liens d'accès aux sessions live :
                      </p>
                      
                      <!-- Meeting Links -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        {links_html}
                      </table>
                      
                      <p style="margin: 24px 0 0 0; font-size: 14px; color: #8B8B9E; line-height: 1.6;">
                        <strong>Important :</strong> Conservez cet email, il contient vos liens d'accès uniques.
                        Ne partagez pas ces liens avec d'autres personnes.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="text-align: center; padding-top: 32px;">
                      <p style="margin: 0; font-size: 12px; color: #6B7280;">
                        ID de l'achat : {purchase_id}<br>
                        Mentova - Votre plateforme crypto premium
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """
        
        # Send email via Resend (using onboarding@resend.dev for free tier)
        response = resend.Emails.send({
            "from": "Mentova Academy <noreply@mentova-academy.com>",
            "to": [user_email],
            "subject": f"Vos accès à {offer_title} - Mentova",
            "html": html_content
        })
        
        logger.info(f"Session access email sent to {user_email} for purchase {purchase_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error sending session access email: {e}")
        return False


async def check_price_alerts():
    """Background task to check price alerts and send notifications"""
    try:
        # Get all active alerts
        alerts = await db.vip_alerts.find({"is_active": True}).to_list(1000)
        
        if not alerts:
            return
        
        # Get current prices
        symbols = list(set(alert["symbol"].lower() for alert in alerts))
        
        async with httpx.AsyncClient() as client:
            # Use CoinGecko to get prices
            ids_map = {
                "btc": "bitcoin", "eth": "ethereum", "bnb": "binancecoin",
                "sol": "solana", "xrp": "ripple", "ada": "cardano",
                "doge": "dogecoin", "dot": "polkadot", "avax": "avalanche-2",
                "link": "chainlink", "ton": "toncoin", "shib": "shiba-inu",
                "ltc": "litecoin", "matic": "polygon", "uni": "uniswap",
                "atom": "cosmos", "apt": "aptos", "arb": "arbitrum",
                "op": "optimism", "near": "near"
            }
            
            coin_ids = [ids_map.get(s, s) for s in symbols if s in ids_map]
            
            if not coin_ids:
                return
            
            response = await client.get(
                f"https://api.coingecko.com/api/v3/simple/price",
                params={"ids": ",".join(coin_ids), "vs_currencies": "usd"}
            )
            
            if response.status_code != 200:
                return
            
            prices = response.json()
            
            # Check each alert
            for alert in alerts:
                symbol_lower = alert["symbol"].lower()
                coin_id = ids_map.get(symbol_lower, symbol_lower)
                
                if coin_id not in prices:
                    continue
                
                current_price = prices[coin_id]["usd"]
                target_price = alert["target_price"]
                alert_type = alert["alert_type"]
                
                should_trigger = False
                if alert_type == "price_above" and current_price >= target_price:
                    should_trigger = True
                elif alert_type == "price_below" and current_price <= target_price:
                    should_trigger = True
                
                if should_trigger:
                    # Send notification
                    direction = "au-dessus de" if alert_type == "price_above" else "en-dessous de"
                    await send_notification_to_user(
                        alert["user_id"],
                        f"{alert['symbol'].upper()} est maintenant {direction} ${target_price:.2f} (Actuel: ${current_price:.2f})",
                        "price_alert",
                        {
                            "alert_id": alert["id"],
                            "symbol": alert["symbol"],
                            "current_price": current_price,
                            "target_price": target_price
                        },
                        f"🚨 Alerte {alert['symbol'].upper()}"
                    )
                    
                    # Deactivate alert after triggering
                    await db.vip_alerts.update_one(
                        {"id": alert["id"]},
                        {
                            "$set": {
                                "is_active": False,
                                "triggered_at": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    )
                    
                    logger.info(f"Price alert triggered for {alert['symbol']} - User: {alert['user_id']}")
                    
    except Exception as e:
        logger.error(f"Price alert check error: {e}")


# ==================== USER PROFILES ====================

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_color: Optional[str] = None
    favorite_crypto: Optional[str] = None
    trading_experience: Optional[str] = None
    is_public: Optional[bool] = None

@api_router.get("/users/me/profile")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's full profile"""
    profile = await db.user_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    if not profile:
        profile = {
            "user_id": current_user["id"],
            "bio": "",
            "avatar_color": "#7C3AED",
            "favorite_crypto": "",
            "trading_experience": "débutant",
            "is_public": True,
            "followers_count": 0,
            "following_count": 0,
            "posts_count": 0,
            "joined_at": current_user.get("created_at", datetime.now(timezone.utc).isoformat())
        }
        await db.user_profiles.insert_one(profile.copy())  # Insert a copy to avoid _id modification
    
    # Get counts
    posts_count = await db.posts.count_documents({"author_id": current_user["id"]})
    followers_count = await db.user_follows.count_documents({"following_id": current_user["id"]})
    following_count = await db.user_follows.count_documents({"follower_id": current_user["id"]})
    
    # Remove any potential _id
    profile_data = {k: v for k, v in profile.items() if k != "_id"}
    
    return {
        "success": True,
        "data": {
            **profile_data,
            "id": current_user["id"],
            "name": current_user["name"],
            "email": current_user["email"],
            "role": current_user.get("role", "user"),
            "is_vip": await check_user_vip_status(current_user["id"]),
            "posts_count": posts_count,
            "followers_count": followers_count,
            "following_count": following_count
        }
    }

@api_router.put("/users/me/profile")
async def update_my_profile(update: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user's profile"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if update_data:
        await db.user_profiles.update_one(
            {"user_id": current_user["id"]},
            {"$set": update_data},
            upsert=True
        )
    
    # Also update name in users collection if provided
    if update.name:
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"name": update.name}})
    
    return {"success": True, "message": "Profil mis à jour"}

@api_router.get("/users/me/settings")
async def get_my_settings(current_user: dict = Depends(get_current_user)):
    """Get user notification and privacy settings"""
    settings = await db.user_settings.find_one(
        {"user_id": current_user["id"]}, {"_id": 0}
    )
    if not settings:
        settings = {
            "user_id": current_user["id"],
            "notifications": {
                "new_message": True,
                "new_booking": True,
                "booking_confirmed": True,
                "new_review": True,
                "community_reply": True,
                "price_alerts": True,
                "promotions": False
            },
            "privacy": {
                "profile_public": True,
                "show_activity": True,
                "show_portfolio": False
            }
        }
    return {"success": True, "data": settings}

@api_router.put("/users/me/settings")
async def update_my_settings(
    settings: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Update user notification and privacy settings"""
    allowed_keys = {"notifications", "privacy"}
    update_data = {k: v for k, v in settings.items() if k in allowed_keys}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid settings to update")
    
    update_data["user_id"] = current_user["id"]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": update_data},
        upsert=True
    )
    
    # Also update is_public in user_profiles if privacy changed
    if "privacy" in update_data:
        await db.user_profiles.update_one(
            {"user_id": current_user["id"]},
            {"$set": {"is_public": update_data["privacy"].get("profile_public", True)}},
            upsert=True
        )
    
    return {"success": True, "message": "Settings updated"}

@api_router.get("/users/me/export")
async def export_my_data(current_user: dict = Depends(get_current_user)):
    """Export all user data as JSON"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    profile = await db.user_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    settings = await db.user_settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    posts = await db.posts.find({"author_id": current_user["id"]}, {"_id": 0}).to_list(500)
    bookings = await db.pro_bookings.find({
        "$or": [{"user_id": current_user["id"]}, {"pro_id": current_user["id"]}]
    }, {"_id": 0}).to_list(500)
    purchases = await db.offer_purchases.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(500)
    
    export_data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "account": user,
        "profile": profile or {},
        "settings": settings or {},
        "posts": posts,
        "bookings": bookings,
        "purchases": purchases,
    }
    
    return {"success": True, "data": export_data}



@api_router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, request: Request):
    """Get a user's public profile - no auth required"""
    # Try to get current user from token (optional)
    current_user_id = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            current_user_id = payload.get("user_id")
        except:
            pass

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        profile = {"bio": "", "avatar_color": "#7C3AED", "is_public": True}
    
    is_own = current_user_id == user_id
    is_public = user.get("is_profile_public", profile.get("is_public", True))
    
    if not is_public and not is_own:
        return {
            "success": True,
            "data": {
                "id": user_id,
                "name": user.get("name", ""),
                "username": user.get("username", user.get("name", "")),
                "avatar_url": user.get("avatar_url"),
                "avatar_color": profile.get("avatar_color", "#7C3AED"),
                "is_profile_public": False,
                "is_private": True,
            }
        }
    
    posts_count = await db.community_posts.count_documents({"author_id": user_id})
    followers_count = await db.user_follows.count_documents({"following_id": user_id})
    following_count = await db.user_follows.count_documents({"follower_id": user_id})
    
    is_following = False
    if current_user_id:
        existing = await db.user_follows.find_one({
            "follower_id": current_user_id,
            "following_id": user_id
        })
        is_following = existing is not None
    
    return {
        "success": True,
        "data": {
            "id": user_id,
            "name": user.get("name", ""),
            "username": user.get("username", user.get("name", "")),
            "email": user.get("email", "") if is_own else None,
            "bio": user.get("bio", profile.get("bio", "")),
            "avatar_url": user.get("avatar_url"),
            "avatar_color": profile.get("avatar_color", "#7C3AED"),
            "cover_url": user.get("cover_url"),
            "is_vip": user.get("is_vip", False),
            "is_professional": user.get("is_professional", False),
            "pro_badge": user.get("pro_badge"),
            "is_profile_public": is_public,
            "role": user.get("role", "user"),
            "created_at": user.get("created_at"),
            "followers_count": followers_count,
            "following_count": following_count,
            "posts_count": posts_count,
            "is_following": is_following,
            "is_own": is_own or False,
        }
    }

@api_router.get("/users/search")
async def search_users(q: str, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Search for users by name"""
    if len(q) < 2:
        return {"success": True, "data": []}
    
    users = await db.users.find(
        {"name": {"$regex": q, "$options": "i"}},
        {"_id": 0, "password_hash": 0}
    ).limit(limit).to_list(limit)
    
    results = []
    for user in users:
        profile = await db.user_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
        results.append({
            "id": user["id"],
            "name": user["name"],
            "avatar_color": profile.get("avatar_color", "#7C3AED") if profile else "#7C3AED",
            "is_vip": await check_user_vip_status(user["id"])
        })
    
    return {"success": True, "data": results}

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Follow a user"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")
    
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.user_follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    
    if existing:
        # Unfollow
        await db.user_follows.delete_one({"_id": existing["_id"]})
        return {"success": True, "action": "unfollowed"}
    else:
        # Follow
        await db.user_follows.insert_one({
            "id": str(uuid.uuid4()),
            "follower_id": current_user["id"],
            "following_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        # Notify the followed user
        follower_name = current_user.get("name", "Quelqu'un")
        await send_notification_to_user(
            user_id,
            f"{follower_name} vous suit maintenant",
            "follow",
            {"follower_id": current_user["id"]},
            "Nouveau follower"
        )
        return {"success": True, "action": "followed"}

@api_router.get("/users/{user_id}/followers")
async def get_user_followers(user_id: str, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get a user's followers"""
    follows = await db.user_follows.find({"following_id": user_id}).limit(limit).to_list(limit)
    
    followers = []
    for follow in follows:
        user = await db.users.find_one({"id": follow["follower_id"]}, {"_id": 0, "password_hash": 0})
        if user:
            profile = await db.user_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
            followers.append({
                "id": user["id"],
                "name": user["name"],
                "avatar_color": profile.get("avatar_color", "#7C3AED") if profile else "#7C3AED",
                "is_vip": await check_user_vip_status(user["id"])
            })
    
    return {"success": True, "data": followers}

@api_router.get("/users/{user_id}/following")
async def get_user_following(user_id: str, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get users that a user is following"""
    follows = await db.user_follows.find({"follower_id": user_id}).limit(limit).to_list(limit)
    
    following = []
    for follow in follows:
        user = await db.users.find_one({"id": follow["following_id"]}, {"_id": 0, "password_hash": 0})
        if user:
            profile = await db.user_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
            following.append({
                "id": user["id"],
                "name": user["name"],
                "avatar_color": profile.get("avatar_color", "#7C3AED") if profile else "#7C3AED",
                "is_vip": await check_user_vip_status(user["id"])
            })
    
    return {"success": True, "data": following}

# ==================== MESSAGING ====================

class MessageCreate(BaseModel):
    content: str

@api_router.get("/messages/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Get all conversations for the current user"""
    # Get unique conversation partners
    sent = await db.messages.find({"sender_id": current_user["id"]}).to_list(1000)
    received = await db.messages.find({"receiver_id": current_user["id"]}).to_list(1000)
    
    partner_ids = set()
    for msg in sent:
        partner_ids.add(msg["receiver_id"])
    for msg in received:
        partner_ids.add(msg["sender_id"])
    
    conversations = []
    for partner_id in partner_ids:
        partner = await db.users.find_one({"id": partner_id}, {"_id": 0, "password_hash": 0})
        if not partner:
            continue
        
        profile = await db.user_profiles.find_one({"user_id": partner_id}, {"_id": 0})
        
        # Get last message
        last_msg = await db.messages.find_one(
            {"$or": [
                {"sender_id": current_user["id"], "receiver_id": partner_id},
                {"sender_id": partner_id, "receiver_id": current_user["id"]}
            ]},
            sort=[("created_at", -1)]
        )
        
        # Count unread
        unread = await db.messages.count_documents({
            "sender_id": partner_id,
            "receiver_id": current_user["id"],
            "read": False
        })
        
        conversations.append({
            "partner_id": partner_id,
            "partner_name": partner["name"],
            "partner_avatar_color": profile.get("avatar_color", "#7C3AED") if profile else "#7C3AED",
            "partner_is_vip": await check_user_vip_status(partner_id),
            "last_message": last_msg["content"][:50] if last_msg else "",
            "last_message_time": last_msg["created_at"] if last_msg else None,
            "unread_count": unread
        })
    
    # Sort by last message time
    conversations.sort(key=lambda x: x["last_message_time"] or "", reverse=True)
    
    return {"success": True, "data": conversations}

@api_router.get("/messages/{user_id}")
async def get_messages(user_id: str, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get messages with a specific user"""
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user["id"], "receiver_id": user_id},
            {"sender_id": user_id, "receiver_id": current_user["id"]}
        ]
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark as read
    await db.messages.update_many(
        {"sender_id": user_id, "receiver_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    
    return {
        "success": True,
        "data": [{**m, "_id": None} for m in reversed(messages)]
    }

@api_router.post("/messages/{user_id}")
async def send_message(user_id: str, message: MessageCreate, current_user: dict = Depends(get_current_user)):
    """Send a message to a user"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous envoyer un message")
    
    recipient = await db.users.find_one({"id": user_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    
    msg = {
        "id": str(uuid.uuid4()),
        "sender_id": current_user["id"],
        "sender_name": current_user["name"],
        "receiver_id": user_id,
        "content": message.content,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(msg)
    
    # Send push notification to recipient
    await send_notification_to_user(
        user_id,
        f"{current_user['name']}: {message.content[:50]}{'...' if len(message.content) > 50 else ''}",
        "new_message",
        {"sender_id": current_user["id"], "message_id": msg["id"]},
        "💬 Nouveau message"
    )
    
    return {"success": True, "data": {**msg, "_id": None}}

# ==================== NOTIFICATIONS (uses /notifications/history and /notifications/mark-read) ====================
# Primary notification endpoints are defined above (lines ~5963-6009) using is_read field

# ==================== PRICE ALERT CHECKER ====================

@api_router.post("/alerts/check")
async def check_price_alerts():
    """Check all active alerts and trigger notifications (called by cron)"""
    prices = await get_crypto_prices_cached()
    
    alerts = await db.vip_alerts.find({"is_active": True, "is_triggered": False}).to_list(1000)
    triggered = []
    
    for alert in alerts:
        symbol = alert["crypto_symbol"].upper()
        current_price = prices.get(symbol, 0)
        
        if current_price == 0:
            continue
        
        should_trigger = False
        if alert["alert_type"] == "price_above" and current_price >= alert["target_value"]:
            should_trigger = True
        elif alert["alert_type"] == "price_below" and current_price <= alert["target_value"]:
            should_trigger = True
        
        if should_trigger:
            # Mark as triggered
            await db.vip_alerts.update_one(
                {"id": alert["id"]},
                {"$set": {"is_triggered": True, "triggered_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Create notification
            alert_type_text = "au-dessus de" if alert["alert_type"] == "price_above" else "en-dessous de"
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": alert["user_id"],
                "type": "alert",
                "title": f"Alerte {symbol}",
                "body": f"{symbol} est maintenant {alert_type_text} ${alert['target_value']} (Prix actuel: ${current_price})",
                "data": {"alert_id": alert["id"], "symbol": symbol, "price": current_price},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            triggered.append(alert["id"])
    
    return {"success": True, "triggered_count": len(triggered)}

# ==================== ROOT ROUTES ====================

@api_router.get("/")
async def root():
    return {
        "message": "Bienvenue sur l'API Mentova",
        "version": "1.0.0",
        "status": "active"
    }

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# ==================== PROFESSIONAL MENTORS MARKETPLACE ====================

# Professional application statuses
PRO_STATUS_PENDING = "pending"
PRO_STATUS_APPROVED = "approved"
PRO_STATUS_REJECTED = "rejected"
PRO_STATUS_SUSPENDED = "suspended"

# Professional badge levels
PRO_BADGE_BASIC = "basic"
PRO_BADGE_VERIFIED = "verified"
PRO_BADGE_PREMIUM = "premium"

# Commission rate (25%)
PRO_COMMISSION_RATE = 0.25


class ProfessionalApplicationRequest(BaseModel):
    full_name: str
    phone: Optional[str] = None
    country: str
    city: Optional[str] = None
    languages: List[str]
    main_expertise: str
    specializations: List[str]
    years_experience: int
    bio: str
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    certifications: List[str] = []
    video_intro_url: Optional[str] = None
    services_offered: List[str]
    hourly_rate: Optional[float] = None
    course_price_range: Optional[str] = None
    availability: str


@api_router.get("/pro/info")
async def get_pro_info():
    """Get information about becoming a professional"""
    return {
        "success": True,
        "data": {
            "title": "Devenez Professionnel Mentova",
            "subtitle": "Partagez votre expertise et générez des revenus",
            "benefits": [
                {"icon": "cash", "title": "Revenus passifs", "description": "Gagnez de l'argent en partageant vos connaissances crypto"},
                {"icon": "people", "title": "Communauté engagée", "description": "Accédez à une audience passionnée de crypto"},
                {"icon": "shield-checkmark", "title": "Badge vérifié", "description": "Obtenez un badge de confiance Mentova"},
                {"icon": "calendar", "title": "Flexibilité totale", "description": "Définissez vos horaires et vos tarifs"},
                {"icon": "trending-up", "title": "Croissance", "description": "Développez votre personal branding"},
                {"icon": "analytics", "title": "Dashboard complet", "description": "Suivez vos revenus et performances"}
            ],
            "requirements": [
                "Minimum 2 ans d'expérience en crypto",
                "Preuves de compétences (portfolio, certifications)",
                "Bonne réputation en ligne",
                "Capacité à communiquer clairement",
                "Engagement de qualité envers les apprenants"
            ],
            "commission_rate": PRO_COMMISSION_RATE
        }
    }


@api_router.post("/pro/apply")
async def apply_as_professional(
    application: ProfessionalApplicationRequest,
    user: dict = Depends(get_current_user)
):
    """Submit application to become a professional"""
    existing = await db.pro_applications.find_one({"user_id": user["id"]})
    if existing:
        if existing["status"] == PRO_STATUS_APPROVED:
            raise HTTPException(status_code=400, detail="You are already an approved professional")
        elif existing["status"] == PRO_STATUS_PENDING:
            raise HTTPException(status_code=400, detail="You already have a pending application")
    
    application_id = str(uuid.uuid4())
    application_data = {
        "id": application_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
        "full_name": application.full_name,
        "phone": application.phone,
        "country": application.country,
        "city": application.city,
        "languages": application.languages,
        "main_expertise": application.main_expertise,
        "specializations": application.specializations,
        "years_experience": application.years_experience,
        "bio": application.bio,
        "linkedin_url": application.linkedin_url,
        "twitter_url": application.twitter_url,
        "portfolio_url": application.portfolio_url,
        "certifications": application.certifications,
        "video_intro_url": application.video_intro_url,
        "services_offered": application.services_offered,
        "hourly_rate": application.hourly_rate,
        "course_price_range": application.course_price_range,
        "availability": application.availability,
        "status": PRO_STATUS_PENDING,
        "badge_level": None,
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_applications.insert_one(application_data)
    
    # Send confirmation email to applicant
    # EMAIL DISABLED - Will be enabled when domain is configured on Resend
    logger.info(f"[EMAIL DISABLED] Pro application confirmation for {user['email']}")
    
    return {
        "success": True,
        "data": {
            "application_id": application_id,
            "status": PRO_STATUS_PENDING,
            "message": "Votre candidature a été soumise avec succès. Un email de confirmation vous a été envoyé. Nous l'examinerons dans les 48-72h."
        }
    }


@api_router.get("/pro/application/status")
async def get_application_status(user: dict = Depends(get_current_user)):
    """Get current user's professional application status"""
    application = await db.pro_applications.find_one({"user_id": user["id"]}, {"_id": 0})
    if not application:
        return {"success": True, "data": None}
    return {"success": True, "data": application}


@api_router.get("/admin/pro/applications")
async def get_pro_applications(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get all professional applications (super admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    applications = await db.pro_applications.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.pro_applications.count_documents(query)
    pending = await db.pro_applications.count_documents({"status": PRO_STATUS_PENDING})
    
    return {"success": True, "data": applications, "total": total, "stats": {"pending": pending}}


@api_router.put("/admin/pro/applications/{application_id}/review")
async def review_pro_application(
    application_id: str,
    decision: str,
    badge_level: Optional[str] = None,
    admin_notes: Optional[str] = None,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Review and approve/reject a professional application (super admin only)"""
    if decision not in [PRO_STATUS_APPROVED, PRO_STATUS_REJECTED]:
        raise HTTPException(status_code=400, detail="Invalid decision")
    
    application = await db.pro_applications.find_one({"id": application_id})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    await db.pro_applications.update_one(
        {"id": application_id},
        {"$set": {"status": decision, "badge_level": badge_level or PRO_BADGE_BASIC if decision == PRO_STATUS_APPROVED else None, "admin_notes": admin_notes}}
    )
    
    if decision == PRO_STATUS_APPROVED:
        await db.users.update_one({"id": application["user_id"]}, {"$set": {"is_professional": True, "pro_badge": badge_level or PRO_BADGE_BASIC}})
        await db.pro_profiles.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": application["user_id"],
            "display_name": application["full_name"],
            "bio": application["bio"],
            "main_expertise": application["main_expertise"],
            "specializations": application["specializations"],
            "languages": application["languages"],
            "country": application["country"],
            "badge_level": badge_level or PRO_BADGE_BASIC,
            "hourly_rate": application["hourly_rate"],
            "services_offered": application.get("services_offered", []),
            "total_sessions": 0,
            "total_reviews": 0,
            "total_earnings": 0,
            "available_earnings": 0,
            "average_rating": 0,
            "is_available": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Send approval notification
        badge_labels = {"basic": "Basique", "verified": "Vérifié", "premium": "Premium"}
        badge_name = badge_labels.get(badge_level or PRO_BADGE_BASIC, "Basique")
        await send_notification_to_user(
            application["user_id"],
            f"Félicitations ! Votre candidature pro a été approuvée avec le badge {badge_name}. Accédez à votre dashboard pour commencer.",
            "pro_approved",
            {"link": "/pro/dashboard", "badge_level": badge_level}
        )
        
        # Send approval email
        # EMAIL DISABLED - Will be enabled when domain is configured on Resend
        logger.info(f"[EMAIL DISABLED] Approval notification for {application['user_id']}")
    else:
        # Send rejection notification
        rejection_message = "Votre candidature pro n'a pas été retenue."
        if admin_notes:
            rejection_message += f" Raison : {admin_notes}"
        await send_notification_to_user(
            application["user_id"],
            rejection_message,
            "pro_rejected",
            {"link": "/pro/apply"}
        )
        
        # Send rejection email
        # EMAIL DISABLED - Will be enabled when domain is configured on Resend
        logger.info(f"[EMAIL DISABLED] Rejection notification for {application['user_id']}")
    
    return {"success": True, "message": f"Candidature {decision}"}


@api_router.get("/pros")
async def get_professionals(
    expertise: Optional[str] = None,
    search: Optional[str] = None,
    badge_level: Optional[str] = None,
    sort_by: str = "rating",
    limit: int = 20,
    skip: int = 0
):
    """Get list of approved professionals (public)"""
    query = {"is_available": True}
    
    if expertise:
        query["main_expertise"] = expertise
    if badge_level:
        query["badge_level"] = badge_level
    if search:
        query["$or"] = [
            {"display_name": {"$regex": search, "$options": "i"}},
            {"bio": {"$regex": search, "$options": "i"}}
        ]
    
    sort_field = "average_rating" if sort_by == "rating" else "hourly_rate" if sort_by == "price" else "total_sessions"
    
    professionals = await db.pro_profiles.find(query, {"_id": 0}).sort(sort_field, -1).skip(skip).limit(limit).to_list(limit)
    total = await db.pro_profiles.count_documents(query)
    all_expertise = await db.pro_profiles.distinct("main_expertise")
    
    return {"success": True, "data": professionals, "total": total, "filters": {"expertise_options": all_expertise}}


@api_router.get("/pros/{pro_id}")
async def get_professional_profile(pro_id: str):
    """Get public professional profile"""
    profile = await db.pro_profiles.find_one({"user_id": pro_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Professional not found")
    
    reviews = await db.pro_reviews.find({"pro_id": pro_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    return {"success": True, "data": {**profile, "recent_reviews": reviews}}


# ============ PROFESSIONAL DASHBOARD ENDPOINTS ============

class ProServiceCreate(BaseModel):
    service_type: str  # course, mentoring, qa_session, live_stream
    title: str
    description: str
    price: float
    duration_minutes: Optional[int] = 60
    max_participants: Optional[int] = 1
    is_active: bool = True
    # Availability settings
    available_days: Optional[List[int]] = None  # 0=Monday, 6=Sunday
    available_hours: Optional[List[dict]] = None  # [{"start": "09:00", "end": "12:00"}, {"start": "14:00", "end": "18:00"}]
    # Linked resources
    linked_course_id: Optional[str] = None  # Link to a course
    include_materials: bool = False  # Include course materials with service
    # Live session settings
    meeting_link: Optional[str] = None  # Zoom/Meet/Teams link for live sessions

class ProServiceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    max_participants: Optional[int] = None
    is_active: Optional[bool] = None
    available_days: Optional[List[int]] = None
    available_hours: Optional[List[dict]] = None
    linked_course_id: Optional[str] = None
    include_materials: Optional[bool] = None
    meeting_link: Optional[str] = None  # Zoom/Meet/Teams link for live sessions

# ============================================
# FLEXIBLE PRO SYSTEM - MODELS
# ============================================

# Content Library Item - Reusable content blocks
class ContentItemCreate(BaseModel):
    content_type: str  # document, video, quiz, lesson, link, template
    title: str
    description: Optional[str] = None
    content_data: Optional[dict] = None  # Flexible data based on type
    file_url: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    tags: Optional[List[str]] = []
    is_premium: bool = False  # Premium content for VIP only
    available_from: Optional[str] = None  # ISO datetime - content locked until this date

class ContentItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content_data: Optional[dict] = None
    file_url: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    tags: Optional[List[str]] = None
    is_premium: Optional[bool] = None
    available_from: Optional[str] = None  # ISO datetime - content locked until this date

# Flexible Offer - Can be course, service, bundle, subscription
class OfferCreate(BaseModel):
    offer_type: str  # course, service, bundle, subscription, workshop, resource_pack
    title: str
    description: str
    short_description: Optional[str] = None
    price: float
    currency: str = "USD"
    # Pricing options
    pricing_model: str = "one_time"  # one_time, subscription, pay_what_you_want, installments
    subscription_interval: Optional[str] = None  # monthly, yearly
    min_price: Optional[float] = None  # For pay_what_you_want
    installments_count: Optional[int] = None
    discount_price: Optional[float] = None  # Sale price
    discount_ends_at: Optional[str] = None
    # Content
    included_content_ids: Optional[List[str]] = []  # Content library items
    included_service_ids: Optional[List[str]] = []  # Existing services
    included_course_ids: Optional[List[str]] = []  # Existing courses
    # Access settings
    access_duration_days: Optional[int] = None  # None = lifetime
    max_participants: Optional[int] = None  # For group sessions
    # Scheduling
    available_days: Optional[List[int]] = None
    available_hours: Optional[List[dict]] = None
    scheduled_date: Optional[str] = None  # For workshops
    # Extras
    thumbnail_url: Optional[str] = None
    preview_video_url: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    tags: Optional[List[str]] = []
    is_published: bool = False
    is_featured: bool = False
    # Conditional access
    unlock_rules: Optional[List[dict]] = []  # [{type: "after_purchase", target_id: "xxx"}, ...]

class OfferUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    price: Optional[float] = None
    pricing_model: Optional[str] = None
    subscription_interval: Optional[str] = None
    min_price: Optional[float] = None
    installments_count: Optional[int] = None
    discount_price: Optional[float] = None
    discount_ends_at: Optional[str] = None
    included_content_ids: Optional[List[str]] = None
    included_service_ids: Optional[List[str]] = None
    included_course_ids: Optional[List[str]] = None
    access_duration_days: Optional[int] = None
    max_participants: Optional[int] = None
    available_days: Optional[List[int]] = None
    available_hours: Optional[List[dict]] = None
    scheduled_date: Optional[str] = None
    thumbnail_url: Optional[str] = None
    preview_video_url: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    unlock_rules: Optional[List[dict]] = None

# Bundle - Special offer combining multiple items
class BundleCreate(BaseModel):
    title: str
    description: str
    items: List[dict]  # [{type: "offer", id: "xxx", quantity: 1}, {type: "content", id: "xxx"}]
    bundle_price: float
    original_price: Optional[float] = None  # For showing savings
    discount_percentage: Optional[float] = None
    thumbnail_url: Optional[str] = None
    is_limited: bool = False
    limited_quantity: Optional[int] = None
    available_until: Optional[str] = None
    is_published: bool = False

# Service Resource Models
class ServiceResourceCreate(BaseModel):
    resource_type: str  # document, quiz, video, link
    title: str
    description: Optional[str] = None
    content: Optional[str] = None  # For text/link content
    file_url: Optional[str] = None  # For uploaded files

class ServiceQuizCreate(BaseModel):
    title: str
    passing_score: int = 60
    questions: List[dict]

class ServiceQuizAnswerSubmit(BaseModel):
    answers: List[dict]  # [{question_index: 0, answer: "value"}, ...]

class ProProfileUpdate(BaseModel):
    bio: Optional[str] = None
    hourly_rate: Optional[float] = None
    is_available: Optional[bool] = None
    specializations: Optional[List[str]] = None
    languages: Optional[List[str]] = None

class WithdrawalRequest(BaseModel):
    amount: float
    payment_method: str  # bank_transfer, paypal, crypto
    payment_details: str

@api_router.get("/pro/dashboard")
async def get_pro_dashboard(current_user: dict = Depends(get_current_user)):
    """Get professional dashboard data"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    profile = await db.pro_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Professional profile not found")
    
    # Get services
    services = await db.pro_services.find({"pro_id": current_user["id"]}, {"_id": 0}).to_list(50)
    
    # Get recent bookings
    bookings = await db.pro_bookings.find(
        {"pro_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get recent reviews
    reviews = await db.pro_reviews.find(
        {"pro_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Get withdrawal history
    withdrawals = await db.pro_withdrawals.find(
        {"pro_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Calculate monthly earnings from BOTH bookings and offer purchases
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_bookings = await db.pro_bookings.find({
        "pro_id": current_user["id"],
        "status": "completed",
        "created_at": {"$gte": first_of_month.isoformat()}
    }).to_list(100)
    monthly_earnings_bookings = sum(b.get("pro_earnings", 0) for b in monthly_bookings)
    
    # Get pro's offer IDs first, then query purchases
    pro_offers_list = await db.pro_offers.find({"pro_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(100)
    pro_offer_ids = [o["id"] for o in pro_offers_list]
    
    # Include offer purchases in monthly earnings (linked via offer_id)
    monthly_offer_purchases = []
    if pro_offer_ids:
        monthly_offer_purchases = await db.offer_purchases.find({
            "offer_id": {"$in": pro_offer_ids},
            "status": "completed",
            "completed_at": {"$gte": first_of_month.isoformat()}
        }).to_list(100)
    monthly_earnings_offers = sum(p.get("amount", 0) * 0.9 for p in monthly_offer_purchases)
    monthly_earnings = monthly_earnings_bookings + monthly_earnings_offers
    
    # Get total offer purchases for all-time stats
    all_offer_purchases = []
    if pro_offer_ids:
        all_offer_purchases = await db.offer_purchases.find({
            "offer_id": {"$in": pro_offer_ids},
            "status": "completed"
        }).to_list(1000)
    total_offer_revenue = sum(p.get("amount", 0) * 0.9 for p in all_offer_purchases)
    total_offer_sales = len(all_offer_purchases)
    
    # Recalculate real total_earnings from all sources
    all_bookings = await db.pro_bookings.find({
        "pro_id": current_user["id"],
        "status": "completed",
        "payment_status": "paid"
    }).to_list(1000)
    total_booking_earnings = sum(b.get("pro_earnings", 0) for b in all_bookings)
    real_total_earnings = total_booking_earnings + total_offer_revenue
    
    return {
        "success": True,
        "data": {
            "profile": profile,
            "services": services,
            "recent_bookings": bookings,
            "recent_reviews": reviews,
            "withdrawals": withdrawals,
            "stats": {
                "total_sessions": profile.get("total_sessions", 0) + total_offer_sales,
                "total_reviews": profile.get("total_reviews", 0),
                "average_rating": profile.get("average_rating", 0),
                "total_earnings": real_total_earnings,
                "available_earnings": real_total_earnings,
                "monthly_earnings": monthly_earnings,
                "pending_bookings": len([b for b in bookings if b.get("status") == "pending"]),
                "total_offer_sales": total_offer_sales,
                "total_offer_revenue": total_offer_revenue
            }
        }
    }

@api_router.put("/pro/dashboard/profile")
async def update_pro_profile(
    update_data: ProProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update professional profile"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.pro_profiles.update_one(
        {"user_id": current_user["id"]},
        {"$set": update_dict}
    )
    
    return {"success": True, "message": "Profil mis à jour"}

@api_router.post("/pro/dashboard/services")
async def create_pro_service(
    service_data: ProServiceCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new service offering"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    service = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "service_type": service_data.service_type,
        "title": service_data.title,
        "description": service_data.description,
        "price": service_data.price,
        "duration_minutes": service_data.duration_minutes,
        "max_participants": service_data.max_participants,
        "is_active": service_data.is_active,
        "available_days": service_data.available_days or [0, 1, 2, 3, 4],  # Default: Mon-Fri
        "available_hours": service_data.available_hours or [{"start": "09:00", "end": "18:00"}],  # Default: 9h-18h
        "meeting_link": service_data.meeting_link,  # Zoom/Meet/Teams link
        "linked_course_id": service_data.linked_course_id,
        "include_materials": service_data.include_materials,
        "total_bookings": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_services.insert_one(service)
    service.pop("_id", None)
    
    return {"success": True, "data": service}

@api_router.put("/pro/dashboard/services/{service_id}")
async def update_pro_service(
    service_id: str,
    update_data: ProServiceUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing service"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    service = await db.pro_services.find_one({"id": service_id, "pro_id": current_user["id"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.pro_services.update_one({"id": service_id}, {"$set": update_dict})
    
    return {"success": True, "message": "Service mis à jour"}

@api_router.delete("/pro/dashboard/services/{service_id}")
async def delete_pro_service(
    service_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a service"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    result = await db.pro_services.delete_one({"id": service_id, "pro_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    return {"success": True, "message": "Service supprimé"}

# ==================== SERVICE RESOURCES ====================
# APIs for managing resources attached to services (quizzes, documents, videos)

@api_router.get("/pro/services/{service_id}/resources")
async def get_service_resources(
    service_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all resources attached to a service"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    service = await db.pro_services.find_one({"id": service_id, "pro_id": current_user["id"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    resources = await db.service_resources.find(
        {"service_id": service_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get linked course if any
    linked_course = None
    if service.get("linked_course_id"):
        linked_course = await db.pro_courses.find_one(
            {"id": service["linked_course_id"]},
            {"_id": 0, "title": 1, "description": 1, "id": 1}
        )
    
    return {
        "success": True,
        "data": {
            "resources": resources,
            "linked_course": linked_course
        }
    }

@api_router.post("/pro/services/{service_id}/resources")
async def add_service_resource(
    service_id: str,
    resource: ServiceResourceCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a resource to a service (document, quiz, video, link)"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    service = await db.pro_services.find_one({"id": service_id, "pro_id": current_user["id"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    resource_data = {
        "id": str(uuid.uuid4()),
        "service_id": service_id,
        "pro_id": current_user["id"],
        "resource_type": resource.resource_type,
        "title": resource.title,
        "description": resource.description,
        "content": resource.content,
        "file_url": resource.file_url,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.service_resources.insert_one(resource_data)
    if "_id" in resource_data:
        del resource_data["_id"]
    
    return {"success": True, "data": resource_data}

@api_router.post("/pro/services/{service_id}/quiz")
async def add_service_quiz(
    service_id: str,
    quiz: ServiceQuizCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a quiz to a service"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    service = await db.pro_services.find_one({"id": service_id, "pro_id": current_user["id"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    quiz_data = {
        "id": str(uuid.uuid4()),
        "service_id": service_id,
        "pro_id": current_user["id"],
        "title": quiz.title,
        "passing_score": quiz.passing_score,
        "questions": quiz.questions,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.service_quizzes.insert_one(quiz_data)
    if "_id" in quiz_data:
        del quiz_data["_id"]
    
    return {"success": True, "data": quiz_data}

@api_router.delete("/pro/services/{service_id}/resources/{resource_id}")
async def delete_service_resource(
    service_id: str,
    resource_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a resource from a service"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    result = await db.service_resources.delete_one({
        "id": resource_id,
        "service_id": service_id,
        "pro_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    return {"success": True, "message": "Ressource supprimée"}

@api_router.put("/pro/services/{service_id}/link-course/{course_id}")
async def link_course_to_service(
    service_id: str,
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Link a course to a service (mentoring includes course access)"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    service = await db.pro_services.find_one({"id": service_id, "pro_id": current_user["id"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    course = await db.pro_courses.find_one({"id": course_id, "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    await db.pro_services.update_one(
        {"id": service_id},
        {"$set": {
            "linked_course_id": course_id,
            "include_materials": True
        }}
    )
    
    return {
        "success": True,
        "message": f"Cours '{course['title']}' lié au service"
    }

# Client access to service resources
@api_router.get("/bookings/{booking_id}/resources")
async def get_booking_resources(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get resources for a booked service - VIP ONLY"""
    if not current_user.get("is_vip"):
        raise HTTPException(status_code=403, detail="Reserved for VIP members")
    
    booking = await db.bookings.find_one({
        "id": booking_id,
        "client_id": current_user["id"],
        "status": {"$in": ["confirmed", "completed"]}
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or not confirmed")
    
    service_id = booking.get("service_id")
    
    # Get service resources
    resources = await db.service_resources.find(
        {"service_id": service_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get service quiz
    quizzes = await db.service_quizzes.find(
        {"service_id": service_id},
        {"_id": 0}
    ).to_list(10)
    
    # Remove correct answers from quiz for client view
    for quiz in quizzes:
        for q in quiz.get("questions", []):
            q.pop("correct_answer", None)
            q.pop("correct_keywords", None)
    
    # Get linked course if any
    service = await db.pro_services.find_one({"id": service_id})
    linked_course = None
    if service and service.get("linked_course_id"):
        course = await db.pro_courses.find_one(
            {"id": service["linked_course_id"]},
            {"_id": 0}
        )
        if course:
            # Auto-enroll in linked course
            existing = await db.course_enrollments.find_one({
                "course_id": course["id"],
                "user_id": current_user["id"]
            })
            if not existing:
                enrollment = {
                    "id": str(uuid.uuid4()),
                    "course_id": course["id"],
                    "user_id": current_user["id"],
                    "user_name": current_user.get("name", ""),
                    "pro_id": course["pro_id"],
                    "price": 0,  # Included with service
                    "payment_type": "included",
                    "status": "active",
                    "progress": {"completed_lessons": [], "completed_modules": [], "quiz_results": {}, "percent_complete": 0},
                    "enrolled_at": datetime.now(timezone.utc).isoformat(),
                    "via_service_booking": booking_id
                }
                await db.course_enrollments.insert_one(enrollment)
            linked_course = {
                "id": course["id"],
                "title": course["title"],
                "description": course["description"]
            }
    
    return {
        "success": True,
        "data": {
            "booking_id": booking_id,
            "resources": resources,
            "quizzes": quizzes,
            "linked_course": linked_course
        }
    }

@api_router.post("/bookings/{booking_id}/quiz/{quiz_id}/submit")
async def submit_service_quiz(
    booking_id: str,
    quiz_id: str,
    submission: ServiceQuizAnswerSubmit,
    current_user: dict = Depends(get_current_user)
):
    """Submit quiz answers for a service - VIP ONLY"""
    if not current_user.get("is_vip"):
        raise HTTPException(status_code=403, detail="Reserved for VIP members")
    
    booking = await db.bookings.find_one({
        "id": booking_id,
        "client_id": current_user["id"]
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    quiz = await db.service_quizzes.find_one({"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Grade the quiz
    questions = quiz.get("questions", [])
    correct_count = 0
    results = []
    
    for i, question in enumerate(questions):
        user_answer = None
        for ans in submission.answers:
            if ans.get("question_index") == i:
                user_answer = ans.get("answer")
                break
        
        question_type = question.get("type", "multiple_choice")
        is_correct = False
        
        if question_type == "multiple_choice":
            is_correct = user_answer == question.get("correct_answer")
        elif question_type == "true_false":
            is_correct = str(user_answer).lower() == str(question.get("correct_answer")).lower()
        elif question_type == "short_answer":
            correct_keywords = question.get("correct_keywords", [])
            if user_answer and correct_keywords:
                user_lower = user_answer.lower()
                is_correct = any(kw.lower() in user_lower for kw in correct_keywords)
            else:
                is_correct = user_answer and user_answer.lower().strip() == str(question.get("correct_answer", "")).lower().strip()
        
        if is_correct:
            correct_count += 1
        
        results.append({
            "question_index": i,
            "is_correct": is_correct,
            "correct_answer": question.get("correct_answer"),
            "explanation": question.get("explanation", "")
        })
    
    score = int((correct_count / max(len(questions), 1)) * 100)
    passed = score >= quiz.get("passing_score", 60)
    
    # Save result
    result_data = {
        "id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "quiz_id": quiz_id,
        "user_id": current_user["id"],
        "score": score,
        "passed": passed,
        "answers": submission.answers,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    await db.service_quiz_results.insert_one(result_data)
    
    return {
        "success": True,
        "score": score,
        "passed": passed,
        "results": results
    }

@api_router.post("/pro/dashboard/withdraw")
async def request_withdrawal(
    request_data: WithdrawalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Request a withdrawal of earnings"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    profile = await db.pro_profiles.find_one({"user_id": current_user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    available = profile.get("available_earnings", 0)
    if request_data.amount > available:
        raise HTTPException(status_code=400, detail=f"Solde insuffisant. Disponible: {available}€")
    
    if request_data.amount < 50:
        raise HTTPException(status_code=400, detail="Montant minimum de retrait: 50€")
    
    withdrawal = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "amount": request_data.amount,
        "payment_method": request_data.payment_method,
        "payment_details": request_data.payment_details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_withdrawals.insert_one(withdrawal)
    
    # Deduct from available earnings
    await db.pro_profiles.update_one(
        {"user_id": current_user["id"]},
        {"$inc": {"available_earnings": -request_data.amount}}
    )
    
    withdrawal.pop("_id", None)
    
    return {"success": True, "data": withdrawal, "message": "Demande de retrait enregistrée"}

@api_router.get("/pro/dashboard/bookings")
async def get_pro_bookings(
    status: Optional[str] = None,
    limit: int = 20,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get bookings for professional"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    query = {"pro_id": current_user["id"]}
    if status:
        query["status"] = status
    
    bookings = await db.pro_bookings.find(query, {"_id": 0}).sort("scheduled_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.pro_bookings.count_documents(query)
    
    return {"success": True, "data": bookings, "total": total}

@api_router.put("/pro/dashboard/bookings/{booking_id}/status")
async def update_booking_status(
    booking_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    """Update booking status (confirm, complete, cancel)"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    if status not in ["confirmed", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Statut invalide")
    
    booking = await db.pro_bookings.find_one({"id": booking_id, "pro_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_data = {"status": status}
    if status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        # Add earnings to professional
        pro_earnings = booking.get("pro_earnings", 0)
        await db.pro_profiles.update_one(
            {"user_id": current_user["id"]},
            {
                "$inc": {
                    "total_earnings": pro_earnings,
                    "available_earnings": pro_earnings,
                    "total_sessions": 1
                }
            }
        )
    
    await db.pro_bookings.update_one({"id": booking_id}, {"$set": update_data})
    
    # Notify client with better French messages
    status_messages = {
        "confirmed": "Votre réservation a été confirmée ! Le professionnel vous attend.",
        "completed": "Session terminée ! N'oubliez pas de laisser un avis.",
        "cancelled": "Votre réservation a été annulée par le professionnel."
    }
    
    await send_notification_to_user(
        booking["client_id"],
        status_messages.get(status, f"Votre réservation a été {status}."),
        "booking_confirmed" if status == "confirmed" else "booking_cancelled" if status == "cancelled" else "booking_status",
        {"link": "/bookings", "status": status, "booking_id": booking_id}
    )
    
    return {"success": True, "message": f"Réservation {status}"}


# ============ CLIENT BOOKING ENDPOINTS ============

COMMISSION_RATE = 0.25  # 25% platform commission

class BookingCreate(BaseModel):
    service_id: str
    scheduled_at: str  # ISO datetime
    message: Optional[str] = None

@api_router.get("/services/{service_id}/available-slots")
async def get_available_slots(
    service_id: str,
    date: str,  # Format: YYYY-MM-DD
):
    """Get available time slots for a service on a specific date"""
    service = await db.pro_services.find_one({"id": service_id, "is_active": True}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Parse the requested date
    try:
        requested_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide. Utilisez YYYY-MM-DD")
    
    # Check if date is in the past
    today = datetime.now(timezone.utc).date()
    if requested_date.date() < today:
        return {"success": True, "data": [], "message": "Date passée"}
    
    # Check if the day is available (0=Monday, 6=Sunday)
    day_of_week = requested_date.weekday()
    available_days = service.get("available_days", [0, 1, 2, 3, 4])
    
    if day_of_week not in available_days:
        return {"success": True, "data": [], "message": "Le professionnel n'est pas disponible ce jour"}
    
    # Get the service duration
    duration = service.get("duration_minutes", 60)
    available_hours = service.get("available_hours", [{"start": "09:00", "end": "18:00"}])
    
    # Generate all possible slots
    all_slots = []
    for time_range in available_hours:
        start_time = datetime.strptime(time_range["start"], "%H:%M")
        end_time = datetime.strptime(time_range["end"], "%H:%M")
        
        current_slot = start_time
        while current_slot + timedelta(minutes=duration) <= end_time:
            slot_start = requested_date.replace(
                hour=current_slot.hour, 
                minute=current_slot.minute,
                second=0,
                microsecond=0
            )
            slot_end = slot_start + timedelta(minutes=duration)
            
            # Don't show past slots for today
            if requested_date.date() == today:
                now = datetime.now(timezone.utc)
                slot_start_utc = slot_start.replace(tzinfo=timezone.utc)
                if slot_start_utc <= now:
                    current_slot = current_slot + timedelta(minutes=30)
                    continue
            
            all_slots.append({
                "start": slot_start.strftime("%H:%M"),
                "end": slot_end.strftime("%H:%M"),
                "datetime": slot_start.isoformat()
            })
            
            # Move to next slot (30 min intervals)
            current_slot = current_slot + timedelta(minutes=30)
    
    # Get existing bookings for this service on this date
    start_of_day = requested_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = requested_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    existing_bookings = await db.pro_bookings.find({
        "service_id": service_id,
        "status": {"$in": ["pending", "confirmed"]},
        "scheduled_at": {
            "$gte": start_of_day.isoformat(),
            "$lte": end_of_day.isoformat()
        }
    }, {"_id": 0, "scheduled_at": 1}).to_list(100)
    
    # Extract booked times
    booked_times = set()
    for booking in existing_bookings:
        try:
            booked_dt = datetime.fromisoformat(booking["scheduled_at"].replace('Z', '+00:00'))
            booked_times.add(booked_dt.strftime("%H:%M"))
        except:
            pass
    
    # Filter out booked slots
    available_slots = [
        slot for slot in all_slots 
        if slot["start"] not in booked_times
    ]
    
    return {
        "success": True, 
        "data": available_slots,
        "service": {
            "id": service["id"],
            "title": service["title"],
            "duration_minutes": duration,
            "price": service["price"]
        },
        "date": date,
        "total_slots": len(available_slots)
    }

@api_router.get("/pros/{pro_id}/services")
async def get_professional_services(pro_id: str):
    """Get all active services for a professional (public)"""
    profile = await db.pro_profiles.find_one({"user_id": pro_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Professional not found")
    
    services = await db.pro_services.find(
        {"pro_id": pro_id, "is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    return {"success": True, "data": services, "professional": profile}

@api_router.post("/bookings")
async def create_booking(
    booking_data: BookingCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new booking for a service"""
    # Get service
    service = await db.pro_services.find_one({"id": booking_data.service_id, "is_active": True}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found or inactive")
    
    # Get professional profile
    pro_profile = await db.pro_profiles.find_one({"user_id": service["pro_id"]}, {"_id": 0})
    if not pro_profile:
        raise HTTPException(status_code=404, detail="Professional not found")
    
    # Prevent self-booking
    if current_user["id"] == service["pro_id"]:
        raise HTTPException(status_code=400, detail="You cannot book your own service")
    
    # Check professional availability
    if not pro_profile.get("is_available", True):
        raise HTTPException(status_code=400, detail="Ce professionnel n'est pas disponible actuellement")
    
    # Parse and validate scheduled time
    try:
        scheduled_at = datetime.fromisoformat(booking_data.scheduled_at.replace('Z', '+00:00'))
        # Make it timezone aware if it's naive
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
        if scheduled_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Booking date must be in the future")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    # Calculate amounts
    total_amount = service["price"]
    commission_amount = total_amount * COMMISSION_RATE
    pro_earnings = total_amount - commission_amount
    
    # Create booking
    booking = {
        "id": str(uuid.uuid4()),
        "client_id": current_user["id"],
        "client_name": current_user.get("name", "Client"),
        "client_email": current_user.get("email"),
        "pro_id": service["pro_id"],
        "pro_name": pro_profile["display_name"],
        "service_id": service["id"],
        "service_title": service["title"],
        "service_type": service["service_type"],
        "duration_minutes": service.get("duration_minutes", 60),
        "scheduled_at": scheduled_at.isoformat(),
        "total_amount": total_amount,
        "commission_amount": commission_amount,
        "pro_earnings": pro_earnings,
        "client_message": booking_data.message,
        "status": "pending",  # pending, confirmed, completed, cancelled, refunded
        "payment_status": "unpaid",  # unpaid, paid, refunded
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_bookings.insert_one(booking)
    booking.pop("_id", None)
    
    # Increment service bookings count
    await db.pro_services.update_one(
        {"id": service["id"]},
        {"$inc": {"total_bookings": 1}}
    )
    
    # Notify professional
    await send_notification_to_user(
        service["pro_id"],
        f"Nouvelle réservation de {current_user.get('name', 'un client')} pour {service['title']}",
        "new_booking",
        {"link": "/pro/dashboard", "booking_id": booking["id"]}
    )
    
    return {"success": True, "data": booking, "message": "Réservation créée avec succès"}

# ==========================================
# SERVICE PAYMENT ENDPOINTS
# ==========================================

class ServicePaymentRequest(BaseModel):
    booking_id: str
    origin_url: str

@api_router.post("/bookings/checkout")
async def create_service_checkout(
    request: ServicePaymentRequest,
    http_request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create Stripe checkout session for service booking payment"""
    # Get booking
    booking = await db.pro_bookings.find_one({
        "id": request.booking_id,
        "client_id": current_user["id"],
        "payment_status": "unpaid"
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or already paid")
    
    if booking["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="This booking has been cancelled")
    
    try:
        # Initialize Stripe
        host_url = request.origin_url.rstrip('/')
        webhook_url = f"{str(http_request.base_url).rstrip('/')}/api/webhook/stripe"
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Build URLs
        success_url = f"{host_url}/bookings/success?session_id={{CHECKOUT_SESSION_ID}}&booking_id={booking['id']}"
        cancel_url = f"{host_url}/bookings/{booking['id']}"
        
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=booking["total_amount"],
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "booking_id": booking["id"],
                "client_id": current_user["id"],
                "pro_id": booking["pro_id"],
                "service_id": booking["service_id"],
                "payment_type": "service_booking"
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Update booking with session info
        await db.pro_bookings.update_one(
            {"id": booking["id"]},
            {"$set": {
                "stripe_session_id": session.session_id,
                "payment_initiated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Create payment transaction record
        await db.service_payments.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "booking_id": booking["id"],
            "client_id": current_user["id"],
            "pro_id": booking["pro_id"],
            "service_id": booking["service_id"],
            "amount": booking["total_amount"],
            "commission": booking["commission_amount"],
            "pro_earnings": booking["pro_earnings"],
            "currency": "usd",
            "status": "pending",
            "payment_status": "initiated",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.session_id
        }
        
    except Exception as e:
        logger.error(f"Error creating service checkout: {e}")
        raise HTTPException(status_code=500, detail="Error creating payment")

@api_router.get("/bookings/payment-status/{session_id}")
async def check_service_payment_status(
    session_id: str,
    http_request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Check service payment status and update booking if paid"""
    # Find the payment transaction
    transaction = await db.service_payments.find_one({"session_id": session_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Verify ownership
    if transaction["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    # If already paid, return status
    if transaction.get("payment_status") == "paid":
        return {
            "success": True,
            "payment_status": "paid",
            "booking_id": transaction["booking_id"]
        }
    
    try:
        # Check with Stripe
        host_url = str(http_request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction
        await db.service_payments.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If paid, update booking and notify pro
        if status.payment_status == "paid":
            await db.pro_bookings.update_one(
                {"id": transaction["booking_id"]},
                {"$set": {
                    "payment_status": "paid",
                    "status": "confirmed",
                    "paid_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Notify professional
            booking = await db.pro_bookings.find_one({"id": transaction["booking_id"]})
            if booking:
                await send_notification_to_user(
                    booking["pro_id"],
                    f"Paiement reçu pour votre service '{booking['service_title']}' - {booking['total_amount']}$",
                    "payment_received",
                    {"link": "/pro/dashboard", "booking_id": booking["id"], "amount": booking["total_amount"]}
                )
        
        return {
            "success": True,
            "payment_status": status.payment_status,
            "booking_id": transaction["booking_id"]
        }
        
    except Exception as e:
        logger.error(f"Error checking service payment: {e}")
        raise HTTPException(status_code=500, detail="Error verifying payment")

# ==========================================
# PRO EARNINGS & PAYOUTS
# ==========================================

@api_router.get("/pro/earnings")
async def get_pro_earnings(
    current_user: dict = Depends(get_current_user)
):
    """Get professional's earnings summary"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    # Get all completed and paid bookings
    completed_bookings = await db.pro_bookings.find({
        "pro_id": current_user["id"],
        "status": "completed",
        "payment_status": "paid"
    }, {"_id": 0}).to_list(1000)
    
    # Get pending paid bookings (confirmed but not yet completed)
    pending_bookings = await db.pro_bookings.find({
        "pro_id": current_user["id"],
        "status": "confirmed",
        "payment_status": "paid"
    }, {"_id": 0}).to_list(1000)
    
    # Get completed offer purchases
    completed_offers = await db.offer_purchases.find({
        "pro_id": current_user["id"],
        "status": "completed"
    }, {"_id": 0}).to_list(1000)
    
    # Calculate totals from ALL sources
    total_earned_bookings = sum(b.get("pro_earnings", 0) for b in completed_bookings)
    total_earned_offers = sum(p.get("pro_earnings", 0) for p in completed_offers)
    total_earned = total_earned_bookings + total_earned_offers
    pending_earnings = sum(b.get("pro_earnings", 0) for b in pending_bookings)
    
    # Get payouts
    payouts = await db.pro_payouts.find({
        "pro_id": current_user["id"]
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    total_paid_out = sum(p.get("amount", 0) for p in payouts if p.get("status") == "completed")
    available_for_payout = total_earned - total_paid_out
    
    return {
        "success": True,
        "data": {
            "total_earned": total_earned,
            "total_earned_bookings": total_earned_bookings,
            "total_earned_offers": total_earned_offers,
            "pending_earnings": pending_earnings,
            "total_paid_out": total_paid_out,
            "available_for_payout": available_for_payout,
            "completed_bookings": len(completed_bookings),
            "completed_offers": len(completed_offers),
            "pending_bookings": len(pending_bookings),
            "recent_payouts": payouts[:5]
        }
    }

@api_router.get("/pro/advanced-stats")
async def get_pro_advanced_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get advanced statistics for professionals - courses, students, revenue analytics"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    pro_id = current_user["id"]
    
    # Get all courses
    courses = await db.pro_courses.find({"pro_id": pro_id}, {"_id": 0}).to_list(100)
    
    # Get course enrollments
    enrollments = await db.pro_course_enrollments.find({"pro_id": pro_id}, {"_id": 0}).to_list(1000)
    
    # Get all reviews for this pro
    reviews = await db.pro_reviews.find({"pro_id": pro_id}, {"_id": 0}).to_list(500)
    
    # Calculate course-specific stats
    course_stats = []
    for course in courses:
        course_enrollments = [e for e in enrollments if e.get("course_id") == course["id"]]
        course_reviews = [r for r in reviews if r.get("course_id") == course["id"]]
        
        # Calculate completion rate
        completed_count = len([e for e in course_enrollments if e.get("completed", False)])
        total_enrolled = len(course_enrollments)
        completion_rate = (completed_count / total_enrolled * 100) if total_enrolled > 0 else 0
        
        # Calculate average rating
        avg_rating = sum(r.get("rating", 0) for r in course_reviews) / len(course_reviews) if course_reviews else 0
        
        # Calculate revenue for this course
        course_revenue = sum(e.get("amount_paid", 0) for e in course_enrollments)
        
        course_stats.append({
            "course_id": course["id"],
            "title": course.get("title", ""),
            "total_students": total_enrolled,
            "completed_students": completed_count,
            "completion_rate": round(completion_rate, 1),
            "average_rating": round(avg_rating, 1),
            "total_reviews": len(course_reviews),
            "revenue": course_revenue,
            "is_published": course.get("is_published", False)
        })
    
    # Get bookings stats
    bookings = await db.pro_bookings.find({"pro_id": pro_id}, {"_id": 0}).to_list(1000)
    
    # Monthly revenue breakdown (last 6 months)
    from collections import defaultdict
    monthly_revenue = defaultdict(float)
    monthly_bookings_count = defaultdict(int)
    
    for booking in bookings:
        if booking.get("payment_status") == "paid":
            created_at = booking.get("created_at", "")
            if created_at:
                try:
                    if isinstance(created_at, str):
                        month_key = created_at[:7]  # YYYY-MM
                    else:
                        month_key = created_at.strftime("%Y-%m")
                    monthly_revenue[month_key] += booking.get("pro_earnings", 0)
                    monthly_bookings_count[month_key] += 1
                except:
                    pass
    
    # Get offer purchases for this pro
    offer_purchases = await db.offer_purchases.find({
        "pro_id": pro_id, "status": "completed"
    }, {"_id": 0}).to_list(1000)
    total_offer_revenue = sum(p.get("pro_earnings", 0) for p in offer_purchases)
    
    # Include offer purchases in monthly revenue
    for purchase in offer_purchases:
        completed_at = purchase.get("completed_at", "")
        if completed_at:
            try:
                if isinstance(completed_at, str):
                    month_key = completed_at[:7]
                else:
                    month_key = completed_at.strftime("%Y-%m")
                monthly_revenue[month_key] += purchase.get("pro_earnings", 0)
                monthly_bookings_count[month_key] += 1
            except:
                pass
    
    # Sort and get last 6 months
    sorted_months = sorted(monthly_revenue.keys(), reverse=True)[:6]
    revenue_trend = [
        {
            "month": month,
            "revenue": monthly_revenue[month],
            "bookings": monthly_bookings_count[month]
        }
        for month in reversed(sorted_months)
    ]
    
    # Overall stats
    total_courses = len(courses)
    published_courses = len([c for c in courses if c.get("is_published", False)])
    total_students = len(set(e.get("user_id") for e in enrollments if e.get("user_id")))
    total_course_revenue = sum(e.get("amount_paid", 0) for e in enrollments)
    total_booking_revenue = sum(b.get("pro_earnings", 0) for b in bookings if b.get("payment_status") == "paid")
    
    # Rating distribution
    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for review in reviews:
        rating = review.get("rating", 0)
        if 1 <= rating <= 5:
            rating_distribution[rating] += 1
    
    overall_avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews) if reviews else 0
    
    return {
        "success": True,
        "data": {
            "overview": {
                "total_courses": total_courses,
                "published_courses": published_courses,
                "total_students": total_students,
                "total_course_revenue": total_course_revenue,
                "total_booking_revenue": total_booking_revenue,
                "total_offer_revenue": total_offer_revenue,
                "total_revenue": total_course_revenue + total_booking_revenue + total_offer_revenue,
                "total_reviews": len(reviews),
                "average_rating": round(overall_avg_rating, 1)
            },
            "courses": course_stats,
            "revenue_trend": revenue_trend,
            "rating_distribution": rating_distribution
        }
    }

@api_router.post("/pro/request-payout")
async def request_payout(
    current_user: dict = Depends(get_current_user)
):
    """Request a payout of available earnings"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    # Calculate available balance from ALL sources
    completed_bookings = await db.pro_bookings.find({
        "pro_id": current_user["id"],
        "status": "completed",
        "payment_status": "paid"
    }).to_list(1000)
    
    completed_offers = await db.offer_purchases.find({
        "pro_id": current_user["id"],
        "status": "completed"
    }).to_list(1000)
    
    total_earned = sum(b.get("pro_earnings", 0) for b in completed_bookings) + sum(p.get("pro_earnings", 0) for p in completed_offers)
    
    payouts = await db.pro_payouts.find({
        "pro_id": current_user["id"],
        "status": {"$in": ["pending", "completed"]}
    }).to_list(1000)
    
    total_paid_out = sum(p.get("amount", 0) for p in payouts)
    available = total_earned - total_paid_out
    
    if available < 10:  # Minimum payout amount
        raise HTTPException(status_code=400, detail="Montant minimum de retrait: 10$")
    
    # Check for pending payout request
    pending_payout = await db.pro_payouts.find_one({
        "pro_id": current_user["id"],
        "status": "pending"
    })
    
    if pending_payout:
        raise HTTPException(status_code=400, detail="You already have a pending withdrawal request")
    
    # Create payout request
    payout = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "pro_name": current_user.get("name", ""),
        "pro_email": current_user.get("email", ""),
        "amount": available,
        "status": "pending",  # pending, processing, completed, rejected
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_payouts.insert_one(payout)
    
    # Notify admin
    admins = await db.users.find({"role": {"$in": ["admin", "super_admin"]}}).to_list(100)
    for admin in admins:
        await send_notification_to_user(
            admin["id"],
            f"Nouvelle demande de retrait de {current_user.get('name', 'un pro')}: {available}$",
            "payout_request",
            {"link": "/admin", "payout_id": payout["id"]}
        )
    
    return {
        "success": True,
        "message": f"Demande de retrait de {available}$ envoyée",
        "payout_id": payout["id"]
    }

# Admin payout management
@api_router.get("/admin/payouts")
async def get_all_payouts(
    status: Optional[str] = None,
    current_user: dict = Depends(get_admin_user)
):
    """Get all payout requests (admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    payouts = await db.pro_payouts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"success": True, "data": payouts}

@api_router.put("/admin/payouts/{payout_id}/process")
async def process_payout(
    payout_id: str,
    action: str,  # "complete" or "reject"
    current_user: dict = Depends(get_admin_user)
):
    """Process a payout request (admin only)"""
    payout = await db.pro_payouts.find_one({"id": payout_id})
    
    if not payout:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    
    if payout["status"] != "pending":
        raise HTTPException(status_code=400, detail="This request has already been processed")
    
    new_status = "completed" if action == "complete" else "rejected"
    
    await db.pro_payouts.update_one(
        {"id": payout_id},
        {"$set": {
            "status": new_status,
            "processed_by": current_user["id"],
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify pro
    status_text = "approuvée et payée" if action == "complete" else "refusée"
    await send_notification_to_user(
        payout["pro_id"],
        f"Votre demande de retrait de {payout['amount']}$ a été {status_text}",
        "payout_processed",
        {"link": "/pro/dashboard", "status": new_status}
    )
    
    return {"success": True, "message": f"Demande {status_text}"}

# ==========================================
# PRO COURSE MANAGEMENT SYSTEM
# ==========================================

class CourseCreate(BaseModel):
    title: str
    description: str
    price: float
    category: str
    difficulty: str = "beginner"  # beginner, intermediate, advanced
    thumbnail_url: Optional[str] = None
    is_published: bool = False

class ModuleCreate(BaseModel):
    title: str
    description: str
    order: int

class LessonCreate(BaseModel):
    title: str
    content: str
    video_url: Optional[str] = None
    duration_minutes: int = 0
    order: int
    resources: Optional[List[dict]] = []

class QuizQuestionCreate(BaseModel):
    question: str
    type: str = "multiple_choice"  # multiple_choice, true_false, short_answer
    options: Optional[List[str]] = []  # For multiple choice
    correct_answer: Optional[Any] = None  # index for MC, bool for T/F, string for short answer
    correct_keywords: Optional[List[str]] = []  # For short_answer type
    explanation: Optional[str] = None
    points: int = 1

class QuizCreate(BaseModel):
    title: str
    passing_score: int = 60
    questions: List[QuizQuestionCreate]

class VideoSessionCreate(BaseModel):
    title: str
    description: str
    session_type: str  # "one_on_one" or "group"
    price: float
    duration_minutes: int
    max_participants: int = 1
    scheduled_at: Optional[str] = None
    recurring: bool = False
    recurring_days: Optional[List[int]] = []
    time_slots: Optional[List[str]] = []

# Course endpoints
@api_router.post("/pro/courses")
async def create_course(
    course_data: CourseCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new course"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    course = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "pro_name": current_user.get("name", ""),
        **course_data.dict(),
        "modules": [],
        "total_students": 0,
        "total_revenue": 0,
        "average_rating": 0,
        "reviews_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_courses.insert_one(course)
    del course["_id"]
    
    return {"success": True, "data": course}

@api_router.get("/pro/courses")
async def get_pro_courses(
    current_user: dict = Depends(get_current_user)
):
    """Get all courses created by the pro"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    courses = await db.pro_courses.find(
        {"pro_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"success": True, "data": courses}

@api_router.get("/pro/courses/statistics")
async def get_pro_course_statistics(
    current_user: dict = Depends(get_current_user)
):
    """Get detailed statistics for pro's courses"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    # Get all courses
    courses = await db.pro_courses.find(
        {"pro_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    total_students = sum(c.get("total_students", 0) for c in courses)
    total_revenue = sum(c.get("total_revenue", 0) for c in courses)
    
    # Get enrollment trends (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    course_ids = [c["id"] for c in courses]
    
    recent_enrollments = await db.course_enrollments.count_documents({
        "course_id": {"$in": course_ids},
        "enrolled_at": {"$gte": thirty_days_ago}
    })
    
    # Get completion rate
    completed = await db.course_enrollments.count_documents({
        "course_id": {"$in": course_ids},
        "status": "completed"
    })
    total_enrolled = await db.course_enrollments.count_documents({
        "course_id": {"$in": course_ids}
    })
    completion_rate = int((completed / max(total_enrolled, 1)) * 100)
    
    # Average rating
    avg_rating = sum(c.get("average_rating", 0) for c in courses if c.get("average_rating")) / max(len([c for c in courses if c.get("average_rating")]), 1)
    
    return {
        "success": True,
        "data": {
            "total_courses": len(courses),
            "published_courses": len([c for c in courses if c.get("is_published")]),
            "total_students": total_students,
            "total_revenue": total_revenue,
            "recent_enrollments_30d": recent_enrollments,
            "completion_rate": completion_rate,
            "average_rating": round(avg_rating, 1)
        }
    }

@api_router.get("/pro/courses/{course_id}")
async def get_course_detail(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get course detail with modules and lessons"""
    course = await db.pro_courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Get modules
    modules = await db.pro_course_modules.find(
        {"course_id": course_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Get lessons for each module
    for module in modules:
        lessons = await db.pro_course_lessons.find(
            {"module_id": module["id"]},
            {"_id": 0}
        ).sort("order", 1).to_list(100)
        module["lessons"] = lessons
        
        # Get quiz if exists
        quiz = await db.pro_course_quizzes.find_one(
            {"module_id": module["id"]},
            {"_id": 0}
        )
        module["quiz"] = quiz
    
    course["modules"] = modules
    
    return {"success": True, "data": course}

@api_router.put("/pro/courses/{course_id}")
async def update_course(
    course_id: str,
    course_data: CourseCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a course"""
    course = await db.pro_courses.find_one({"id": course_id, "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    await db.pro_courses.update_one(
        {"id": course_id},
        {"$set": {
            **course_data.dict(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Cours mis à jour"}

@api_router.delete("/pro/courses/{course_id}")
async def delete_course(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a course and all its content"""
    course = await db.pro_courses.find_one({"id": course_id, "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Delete all related content
    modules = await db.pro_course_modules.find({"course_id": course_id}).to_list(100)
    for module in modules:
        await db.pro_course_lessons.delete_many({"module_id": module["id"]})
        await db.pro_course_quizzes.delete_many({"module_id": module["id"]})
    
    await db.pro_course_modules.delete_many({"course_id": course_id})
    await db.pro_courses.delete_one({"id": course_id})
    
    return {"success": True, "message": "Cours supprimé"}

@api_router.put("/pro/courses/{course_id}/publish")
async def publish_course(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Publish or unpublish a course"""
    course = await db.pro_courses.find_one({"id": course_id, "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    new_status = not course.get("is_published", False)
    
    await db.pro_courses.update_one(
        {"id": course_id},
        {"$set": {
            "is_published": new_status,
            "published_at": datetime.now(timezone.utc).isoformat() if new_status else None
        }}
    )
    
    return {
        "success": True, 
        "is_published": new_status,
        "message": "Cours publié" if new_status else "Cours dépublié"
    }

# Module endpoints
@api_router.post("/pro/courses/{course_id}/modules")
async def create_module(
    course_id: str,
    module_data: ModuleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a module in a course"""
    course = await db.pro_courses.find_one({"id": course_id, "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    module = {
        "id": str(uuid.uuid4()),
        "course_id": course_id,
        **module_data.dict(),
        "lessons_count": 0,
        "has_quiz": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_course_modules.insert_one(module)
    del module["_id"]
    
    return {"success": True, "data": module}

@api_router.put("/pro/modules/{module_id}")
async def update_module(
    module_id: str,
    module_data: ModuleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a module"""
    module = await db.pro_course_modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Verify ownership
    course = await db.pro_courses.find_one({"id": module["course_id"], "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    await db.pro_course_modules.update_one(
        {"id": module_id},
        {"$set": module_data.dict()}
    )
    
    return {"success": True, "message": "Module mis à jour"}

@api_router.delete("/pro/modules/{module_id}")
async def delete_module(
    module_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a module and its content"""
    module = await db.pro_course_modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    course = await db.pro_courses.find_one({"id": module["course_id"], "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    await db.pro_course_lessons.delete_many({"module_id": module_id})
    await db.pro_course_quizzes.delete_many({"module_id": module_id})
    await db.pro_course_modules.delete_one({"id": module_id})
    
    return {"success": True, "message": "Module supprimé"}

# Lesson endpoints
@api_router.post("/pro/modules/{module_id}/lessons")
async def create_lesson(
    module_id: str,
    lesson_data: LessonCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a lesson in a module"""
    module = await db.pro_course_modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    course = await db.pro_courses.find_one({"id": module["course_id"], "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    lesson = {
        "id": str(uuid.uuid4()),
        "module_id": module_id,
        "course_id": module["course_id"],
        **lesson_data.dict(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_course_lessons.insert_one(lesson)
    
    # Update module lesson count
    await db.pro_course_modules.update_one(
        {"id": module_id},
        {"$inc": {"lessons_count": 1}}
    )
    
    del lesson["_id"]
    return {"success": True, "data": lesson}

@api_router.put("/pro/lessons/{lesson_id}")
async def update_lesson(
    lesson_id: str,
    lesson_data: LessonCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a lesson"""
    lesson = await db.pro_course_lessons.find_one({"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    course = await db.pro_courses.find_one({"id": lesson["course_id"], "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    await db.pro_course_lessons.update_one(
        {"id": lesson_id},
        {"$set": lesson_data.dict()}
    )
    
    return {"success": True, "message": "Leçon mise à jour"}

@api_router.delete("/pro/lessons/{lesson_id}")
async def delete_lesson(
    lesson_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a lesson"""
    lesson = await db.pro_course_lessons.find_one({"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    course = await db.pro_courses.find_one({"id": lesson["course_id"], "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    await db.pro_course_lessons.delete_one({"id": lesson_id})
    
    # Update module lesson count
    await db.pro_course_modules.update_one(
        {"id": lesson["module_id"]},
        {"$inc": {"lessons_count": -1}}
    )
    
    return {"success": True, "message": "Leçon supprimée"}

# Quiz endpoints
@api_router.post("/pro/modules/{module_id}/quiz")
async def create_quiz(
    module_id: str,
    quiz_data: QuizCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create or update quiz for a module"""
    module = await db.pro_course_modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    course = await db.pro_courses.find_one({"id": module["course_id"], "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    # Delete existing quiz
    await db.pro_course_quizzes.delete_many({"module_id": module_id})
    
    quiz = {
        "id": str(uuid.uuid4()),
        "module_id": module_id,
        "course_id": module["course_id"],
        **quiz_data.dict(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_course_quizzes.insert_one(quiz)
    
    # Update module
    await db.pro_course_modules.update_one(
        {"id": module_id},
        {"$set": {"has_quiz": True}}
    )
    
    del quiz["_id"]
    return {"success": True, "data": quiz}

@api_router.delete("/pro/modules/{module_id}/quiz")
async def delete_quiz(
    module_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete quiz from a module"""
    module = await db.pro_course_modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    course = await db.pro_courses.find_one({"id": module["course_id"], "pro_id": current_user["id"]})
    if not course:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    await db.pro_course_quizzes.delete_many({"module_id": module_id})
    
    await db.pro_course_modules.update_one(
        {"id": module_id},
        {"$set": {"has_quiz": False}}
    )
    
    return {"success": True, "message": "Quiz supprimé"}

# Video Session endpoints
@api_router.post("/pro/video-sessions")
async def create_video_session(
    session_data: VideoSessionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a video session offering"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    session = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "pro_name": current_user.get("name", ""),
        **session_data.dict(),
        "is_active": True,
        "total_bookings": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_video_sessions.insert_one(session)
    del session["_id"]
    
    return {"success": True, "data": session}

@api_router.get("/pro/video-sessions")
async def get_pro_video_sessions(
    current_user: dict = Depends(get_current_user)
):
    """Get all video sessions created by the pro"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    sessions = await db.pro_video_sessions.find(
        {"pro_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"success": True, "data": sessions}

@api_router.put("/pro/video-sessions/{session_id}")
async def update_video_session(
    session_id: str,
    session_data: VideoSessionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a video session"""
    session = await db.pro_video_sessions.find_one({"id": session_id, "pro_id": current_user["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.pro_video_sessions.update_one(
        {"id": session_id},
        {"$set": session_data.dict()}
    )
    
    return {"success": True, "message": "Session mise à jour"}

@api_router.delete("/pro/video-sessions/{session_id}")
async def delete_video_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a video session"""
    session = await db.pro_video_sessions.find_one({"id": session_id, "pro_id": current_user["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.pro_video_sessions.delete_one({"id": session_id})
    
    return {"success": True, "message": "Session supprimée"}

# Document/Resource endpoints
@api_router.post("/pro/documents")
async def upload_document(
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form("general"),
    course_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a document/resource"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    # Read file content
    content = await file.read()
    
    # Store document info (in real app, upload to S3/cloud storage)
    import base64
    document = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "title": title,
        "description": description,
        "category": category,
        "course_id": course_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(content),
        "file_data": base64.b64encode(content).decode('utf-8'),  # In production, use cloud storage
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_documents.insert_one(document)
    
    # Remove file_data from response
    del document["file_data"]
    del document["_id"]
    
    return {"success": True, "data": document}

@api_router.get("/pro/documents")
async def get_pro_documents(
    course_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all documents uploaded by the pro"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    query = {"pro_id": current_user["id"]}
    if course_id:
        query["course_id"] = course_id
    
    documents = await db.pro_documents.find(
        query,
        {"_id": 0, "file_data": 0}  # Exclude binary data
    ).sort("created_at", -1).to_list(100)
    
    return {"success": True, "data": documents}

@api_router.delete("/pro/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a document"""
    document = await db.pro_documents.find_one({"id": document_id, "pro_id": current_user["id"]})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await db.pro_documents.delete_one({"id": document_id})
    
    return {"success": True, "message": "Document supprimé"}

@api_router.get("/pro/documents/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download a document"""
    document = await db.pro_documents.find_one({"id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    import base64
    from fastapi.responses import Response
    
    content = base64.b64decode(document["file_data"])
    
    return Response(
        content=content,
        media_type=document["content_type"],
        headers={
            "Content-Disposition": f'attachment; filename="{document["filename"]}"'
        }
    )

# ==================== STUDENT COURSE SYSTEM ====================

# Models for Student Course Access
class CourseEnrollmentCreate(BaseModel):
    course_id: str
    payment_type: str = "single"  # "single" or "subscription"

class QuizAnswerSubmit(BaseModel):
    answers: List[dict]  # [{question_index: 0, answer: "value"}, ...]

class CourseReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

class CourseDiscussionCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None

class LiveSessionCreate(BaseModel):
    title: str
    description: str
    scheduled_at: str
    duration_minutes: int = 60
    max_participants: int = 100
    course_id: Optional[str] = None
    meeting_url: Optional[str] = None

# Enroll in a course (purchase)
@api_router.post("/courses/{course_id}/enroll")
async def enroll_in_course(
    course_id: str,
    enrollment: CourseEnrollmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Enroll in a course (initiate purchase) - VIP ONLY"""
    # Check VIP status
    if not current_user.get("is_vip"):
        raise HTTPException(status_code=403, detail="Courses are reserved for VIP members. Become VIP to access this feature.")
    
    course = await db.pro_courses.find_one({"id": course_id, "is_published": True})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if already enrolled
    existing = await db.course_enrollments.find_one({
        "course_id": course_id, 
        "user_id": current_user["id"],
        "status": {"$in": ["active", "pending"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="You are already enrolled in this course")
    
    # Create enrollment record
    enrollment_data = {
        "id": str(uuid.uuid4()),
        "course_id": course_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", ""),
        "pro_id": course["pro_id"],
        "price": course["price"],
        "payment_type": enrollment.payment_type,
        "status": "pending",  # pending, active, completed, refunded
        "progress": {
            "completed_lessons": [],
            "completed_modules": [],
            "quiz_results": {},
            "current_module": None,
            "current_lesson": None,
            "percent_complete": 0
        },
        "enrolled_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": None  # For subscriptions
    }
    
    await db.course_enrollments.insert_one(enrollment_data)
    
    # Update course student count
    await db.pro_courses.update_one(
        {"id": course_id},
        {"$inc": {"total_students": 1}}
    )
    
    # Create Stripe checkout session if price > 0
    if course["price"] > 0:
        try:
            stripe_key = os.environ.get("STRIPE_SECRET_KEY")
            if stripe_key:
                import stripe
                stripe.api_key = stripe_key
                
                checkout_session = stripe.checkout.Session.create(
                    payment_method_types=["card"],
                    line_items=[{
                        "price_data": {
                            "currency": "usd",
                            "unit_amount": int(course["price"] * 100),
                            "product_data": {
                                "name": course["title"],
                                "description": f"Cours par {course.get('pro_name', 'Pro')}"
                            }
                        },
                        "quantity": 1
                    }],
                    mode="payment",
                    success_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/courses/{course_id}/success?enrollment_id={enrollment_data['id']}",
                    cancel_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/courses/{course_id}",
                    metadata={
                        "enrollment_id": enrollment_data["id"],
                        "course_id": course_id,
                        "user_id": current_user["id"]
                    }
                )
                
                return {
                    "success": True,
                    "checkout_url": checkout_session.url,
                    "enrollment_id": enrollment_data["id"]
                }
        except Exception as e:
            logging.error(f"Stripe error: {e}")
    
    # Free course - auto-activate
    await db.course_enrollments.update_one(
        {"id": enrollment_data["id"]},
        {"$set": {"status": "active"}}
    )
    
    if "_id" in enrollment_data:
        del enrollment_data["_id"]
    return {"success": True, "data": enrollment_data, "status": "active"}

# Confirm enrollment after payment
@api_router.post("/courses/enrollment/{enrollment_id}/confirm")
async def confirm_enrollment(
    enrollment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Confirm enrollment after successful payment"""
    enrollment = await db.course_enrollments.find_one({
        "id": enrollment_id,
        "user_id": current_user["id"]
    })
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    await db.course_enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {"status": "active", "activated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update course revenue
    await db.pro_courses.update_one(
        {"id": enrollment["course_id"]},
        {"$inc": {"total_revenue": enrollment["price"]}}
    )
    
    # Notify pro
    await send_notification_to_user(
        enrollment["pro_id"],
        f"Nouvel étudiant inscrit à votre cours!",
        "course_enrollment",
        {"link": f"/pro/courses/{enrollment['course_id']}"}
    )
    
    return {"success": True, "message": "Inscription confirmée"}

# Get my enrolled courses
@api_router.get("/courses/my-enrollments")
async def get_my_enrollments(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all courses the user is enrolled in"""
    query = {"user_id": current_user["id"]}
    if status:
        query["status"] = status
    
    enrollments = await db.course_enrollments.find(query, {"_id": 0}).to_list(100)
    
    # Get course details for each enrollment
    for enrollment in enrollments:
        course = await db.pro_courses.find_one(
            {"id": enrollment["course_id"]},
            {"_id": 0, "title": 1, "description": 1, "thumbnail_url": 1, "pro_name": 1, "category": 1}
        )
        enrollment["course"] = course
    
    return {"success": True, "data": enrollments}

# Get course content for enrolled student
@api_router.get("/courses/{course_id}/learn")
async def get_course_content_for_student(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get full course content for enrolled student - VIP ONLY"""
    # Check VIP status
    if not current_user.get("is_vip"):
        raise HTTPException(status_code=403, detail="Course access is reserved for VIP members")
    
    enrollment = await db.course_enrollments.find_one({
        "course_id": course_id,
        "user_id": current_user["id"],
        "status": "active"
    })
    
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in this course")
    
    course = await db.pro_courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Get all modules with lessons
    modules = await db.pro_course_modules.find(
        {"course_id": course_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    for module in modules:
        lessons = await db.pro_course_lessons.find(
            {"module_id": module["id"]},
            {"_id": 0}
        ).sort("order", 1).to_list(100)
        module["lessons"] = lessons
        
        # Get quiz
        quiz = await db.pro_course_quizzes.find_one(
            {"module_id": module["id"]},
            {"_id": 0}
        )
        if quiz:
            # Remove correct answers for student view
            for q in quiz.get("questions", []):
                q.pop("correct_answer", None)
            module["quiz"] = quiz
    
    course["modules"] = modules
    course["enrollment"] = {
        "id": enrollment["id"],
        "progress": enrollment.get("progress", {}),
        "enrolled_at": enrollment["enrolled_at"]
    }
    
    # Get resources for this course
    resources = await db.pro_documents.find(
        {"course_id": course_id},
        {"_id": 0, "file_data": 0}
    ).to_list(50)
    course["resources"] = resources
    
    return {"success": True, "data": course}

# Mark lesson as complete
@api_router.post("/courses/{course_id}/lessons/{lesson_id}/complete")
async def mark_lesson_complete(
    course_id: str,
    lesson_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a lesson as complete"""
    enrollment = await db.course_enrollments.find_one({
        "course_id": course_id,
        "user_id": current_user["id"],
        "status": "active"
    })
    
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in this course")
    
    lesson = await db.pro_course_lessons.find_one({"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Add lesson to completed list
    completed_lessons = enrollment.get("progress", {}).get("completed_lessons", [])
    if lesson_id not in completed_lessons:
        completed_lessons.append(lesson_id)
    
    # Calculate progress
    total_lessons = await db.pro_course_lessons.count_documents({"course_id": course_id})
    percent_complete = int((len(completed_lessons) / max(total_lessons, 1)) * 100)
    
    await db.course_enrollments.update_one(
        {"id": enrollment["id"]},
        {"$set": {
            "progress.completed_lessons": completed_lessons,
            "progress.percent_complete": percent_complete,
            "progress.current_lesson": lesson_id,
            "progress.current_module": lesson["module_id"]
        }}
    )
    
    return {"success": True, "progress": percent_complete}

# Submit quiz answers
@api_router.post("/courses/{course_id}/modules/{module_id}/quiz/submit")
async def submit_quiz_answers(
    course_id: str,
    module_id: str,
    submission: QuizAnswerSubmit,
    current_user: dict = Depends(get_current_user)
):
    """Submit quiz answers and get results"""
    enrollment = await db.course_enrollments.find_one({
        "course_id": course_id,
        "user_id": current_user["id"],
        "status": "active"
    })
    
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in this course")
    
    quiz = await db.pro_course_quizzes.find_one({"module_id": module_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Grade the quiz
    questions = quiz.get("questions", [])
    correct_count = 0
    results = []
    
    for i, question in enumerate(questions):
        user_answer = None
        for ans in submission.answers:
            if ans.get("question_index") == i:
                user_answer = ans.get("answer")
                break
        
        question_type = question.get("type", "multiple_choice")
        is_correct = False
        
        if question_type == "multiple_choice":
            is_correct = user_answer == question.get("correct_answer")
        elif question_type == "true_false":
            is_correct = str(user_answer).lower() == str(question.get("correct_answer")).lower()
        elif question_type == "short_answer":
            # Check if answer contains key words (case insensitive)
            correct_keywords = question.get("correct_keywords", [])
            if user_answer and correct_keywords:
                user_lower = user_answer.lower()
                is_correct = any(kw.lower() in user_lower for kw in correct_keywords)
            else:
                is_correct = user_answer and user_answer.lower().strip() == str(question.get("correct_answer", "")).lower().strip()
        
        if is_correct:
            correct_count += 1
        
        results.append({
            "question_index": i,
            "is_correct": is_correct,
            "correct_answer": question.get("correct_answer"),
            "explanation": question.get("explanation", "")
        })
    
    score = int((correct_count / max(len(questions), 1)) * 100)
    passed = score >= quiz.get("passing_score", 60)
    
    # Save quiz result
    quiz_result = {
        "score": score,
        "passed": passed,
        "correct_count": correct_count,
        "total_questions": len(questions),
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    quiz_results = enrollment.get("progress", {}).get("quiz_results", {})
    quiz_results[module_id] = quiz_result
    
    # Mark module as complete if passed
    completed_modules = enrollment.get("progress", {}).get("completed_modules", [])
    if passed and module_id not in completed_modules:
        completed_modules.append(module_id)
    
    await db.course_enrollments.update_one(
        {"id": enrollment["id"]},
        {"$set": {
            "progress.quiz_results": quiz_results,
            "progress.completed_modules": completed_modules
        }}
    )
    
    # Check if course is complete
    total_modules = await db.pro_course_modules.count_documents({"course_id": course_id})
    course_complete = len(completed_modules) >= total_modules
    
    if course_complete:
        await db.course_enrollments.update_one(
            {"id": enrollment["id"]},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {
        "success": True,
        "score": score,
        "passed": passed,
        "results": results,
        "course_complete": course_complete
    }

# Generate certificate
@api_router.get("/courses/{course_id}/certificate")
async def get_course_certificate(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get certificate for completed course - VIP ONLY"""
    # Check VIP status
    if not current_user.get("is_vip"):
        raise HTTPException(status_code=403, detail="Certificates are reserved for VIP members")
    
    enrollment = await db.course_enrollments.find_one({
        "course_id": course_id,
        "user_id": current_user["id"],
        "status": "completed"
    })
    
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must complete the course to get the certificate")
    
    course = await db.pro_courses.find_one({"id": course_id}, {"_id": 0})
    
    # Check if certificate already exists
    existing_cert = await db.certificates.find_one({
        "enrollment_id": enrollment["id"]
    })
    
    if existing_cert:
        del existing_cert["_id"]
        return {"success": True, "data": existing_cert}
    
    # Create new certificate
    certificate = {
        "id": str(uuid.uuid4()),
        "enrollment_id": enrollment["id"],
        "course_id": course_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", ""),
        "course_title": course["title"],
        "pro_name": course.get("pro_name", ""),
        "completion_date": enrollment.get("completed_at", datetime.now(timezone.utc).isoformat()),
        "certificate_number": f"CERT-{uuid.uuid4().hex[:8].upper()}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.certificates.insert_one(certificate)
    del certificate["_id"]
    
    return {"success": True, "data": certificate}

# Generate certificate PDF
@api_router.get("/courses/{course_id}/certificate/pdf")
async def get_course_certificate_pdf(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate and download certificate as PDF - VIP ONLY"""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import HexColor
    import io
    
    # Check VIP status
    if not current_user.get("is_vip"):
        raise HTTPException(status_code=403, detail="PDF certificates are reserved for VIP members")
    
    enrollment = await db.course_enrollments.find_one({
        "course_id": course_id,
        "user_id": current_user["id"],
        "status": "completed"
    })
    
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must complete the course to get the certificate")
    
    course = await db.pro_courses.find_one({"id": course_id}, {"_id": 0})
    
    # Get or create certificate
    certificate = await db.certificates.find_one({"enrollment_id": enrollment["id"]})
    if not certificate:
        certificate = {
            "id": str(uuid.uuid4()),
            "enrollment_id": enrollment["id"],
            "course_id": course_id,
            "user_id": current_user["id"],
            "user_name": current_user.get("name", ""),
            "course_title": course["title"],
            "pro_name": course.get("pro_name", ""),
            "completion_date": enrollment.get("completed_at", datetime.now(timezone.utc).isoformat()),
            "certificate_number": f"CERT-{uuid.uuid4().hex[:8].upper()}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.certificates.insert_one(certificate)
    
    # Generate PDF
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=landscape(A4))
    width, height = landscape(A4)
    
    # Background gradient effect (dark theme)
    c.setFillColor(HexColor('#0A0A1A'))
    c.rect(0, 0, width, height, fill=1)
    
    # Border
    c.setStrokeColor(HexColor('#7C3AED'))
    c.setLineWidth(3)
    c.rect(30, 30, width - 60, height - 60, fill=0)
    
    # Inner border
    c.setStrokeColor(HexColor('#8B5CF6'))
    c.setLineWidth(1)
    c.rect(40, 40, width - 80, height - 80, fill=0)
    
    # Title
    c.setFillColor(HexColor('#7C3AED'))
    c.setFont("Helvetica-Bold", 48)
    c.drawCentredString(width / 2, height - 120, "CERTIFICATE")
    
    c.setFillColor(HexColor('#A78BFA'))
    c.setFont("Helvetica", 18)
    c.drawCentredString(width / 2, height - 150, "OF COMPLETION")
    
    # Mentova logo text
    c.setFillColor(HexColor('#10B981'))
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, height - 180, "MENTOVA ACADEMY")
    
    # This is to certify
    c.setFillColor(HexColor('#D1D5DB'))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 220, "This certificate is awarded to")
    
    # Student name
    c.setFillColor(HexColor('#FFFFFF'))
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(width / 2, height - 270, certificate.get("user_name", "Student"))
    
    # Line under name
    c.setStrokeColor(HexColor('#7C3AED'))
    c.setLineWidth(2)
    c.line(width / 2 - 150, height - 285, width / 2 + 150, height - 285)
    
    # For completing
    c.setFillColor(HexColor('#D1D5DB'))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 320, "For successfully completing the course")
    
    # Course title
    c.setFillColor(HexColor('#F59E0B'))
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width / 2, height - 360, certificate.get("course_title", "Course"))
    
    # Instructor
    c.setFillColor(HexColor('#9CA3AF'))
    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, height - 390, f"Taught by {certificate.get('pro_name', 'Instructor')}")
    
    # Date and Certificate number
    completion_date = certificate.get("completion_date", "")[:10]
    c.setFillColor(HexColor('#6B7280'))
    c.setFont("Helvetica", 10)
    c.drawString(60, 80, f"Completion date: {completion_date}")
    c.drawRightString(width - 60, 80, f"Certificate No: {certificate.get('certificate_number', '')}")
    
    # Signature line
    c.setStrokeColor(HexColor('#4B5563'))
    c.setLineWidth(1)
    c.line(width / 2 - 100, 120, width / 2 + 100, 120)
    c.setFillColor(HexColor('#9CA3AF'))
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, 105, "Mentova Academy")
    
    c.save()
    buffer.seek(0)
    
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=certificat_{certificate.get('certificate_number', 'cert')}.pdf"
        }
    )

# Course Discussion Forum
@api_router.get("/courses/{course_id}/discussions")
async def get_course_discussions(
    course_id: str,
    module_id: Optional[str] = None,
    lesson_id: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get discussions for a course"""
    # Verify enrollment or ownership
    enrollment = await db.course_enrollments.find_one({
        "course_id": course_id,
        "user_id": current_user["id"],
        "status": "active"
    })
    course = await db.pro_courses.find_one({"id": course_id, "pro_id": current_user["id"]})
    
    if not enrollment and not course:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    query = {"course_id": course_id, "parent_id": None}
    if module_id:
        query["module_id"] = module_id
    if lesson_id:
        query["lesson_id"] = lesson_id
    
    discussions = await db.course_discussions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get replies for each discussion
    for disc in discussions:
        replies = await db.course_discussions.find(
            {"parent_id": disc["id"]},
            {"_id": 0}
        ).sort("created_at", 1).to_list(50)
        disc["replies"] = replies
        disc["reply_count"] = len(replies)
    
    return {"success": True, "data": discussions}

@api_router.post("/courses/{course_id}/discussions")
async def create_course_discussion(
    course_id: str,
    discussion: CourseDiscussionCreate,
    module_id: Optional[str] = None,
    lesson_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a discussion post"""
    # Verify enrollment or ownership
    enrollment = await db.course_enrollments.find_one({
        "course_id": course_id,
        "user_id": current_user["id"],
        "status": "active"
    })
    course = await db.pro_courses.find_one({"id": course_id, "pro_id": current_user["id"]})
    
    if not enrollment and not course:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    is_instructor = course is not None
    
    disc_data = {
        "id": str(uuid.uuid4()),
        "course_id": course_id,
        "module_id": module_id,
        "lesson_id": lesson_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", ""),
        "content": discussion.content,
        "parent_id": discussion.parent_id,
        "is_instructor": is_instructor,
        "likes": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.course_discussions.insert_one(disc_data)
    del disc_data["_id"]
    
    # Notify instructor if it's a student question
    if not is_instructor and not discussion.parent_id:
        await send_notification_to_user(
            course["pro_id"] if course else enrollment.get("pro_id"),
            f"Nouvelle question dans votre cours: {discussion.content[:50]}...",
            "course_discussion",
            {"link": f"/pro/courses/{course_id}"}
        )
    
    return {"success": True, "data": disc_data}

# Live Sessions
@api_router.post("/pro/live-sessions")
async def create_live_session(
    session: LiveSessionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a live session/webinar"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    live_session = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "pro_name": current_user.get("name", ""),
        **session.dict(),
        "status": "scheduled",  # scheduled, live, ended, cancelled
        "participants": [],
        "participant_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.live_sessions.insert_one(live_session)
    del live_session["_id"]
    
    # Notify enrolled students if course-specific
    if session.course_id:
        enrollments = await db.course_enrollments.find({
            "course_id": session.course_id,
            "status": "active"
        }).to_list(1000)
        
        for enroll in enrollments:
            await send_notification_to_user(
                enroll["user_id"],
                f"Nouvelle session live programmée: {session.title}",
                "live_session",
                {"link": f"/courses/{session.course_id}/live/{live_session['id']}"}
            )
    
    return {"success": True, "data": live_session}

@api_router.get("/pro/live-sessions")
async def get_pro_live_sessions(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all live sessions created by the pro"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    query = {"pro_id": current_user["id"]}
    if status:
        query["status"] = status
    
    sessions = await db.live_sessions.find(query, {"_id": 0}).sort("scheduled_at", -1).to_list(100)
    
    return {"success": True, "data": sessions}

@api_router.put("/pro/live-sessions/{session_id}/start")
async def start_live_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Start a live session"""
    session = await db.live_sessions.find_one({"id": session_id, "pro_id": current_user["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.live_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": "live",
            "started_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Session démarrée"}

@api_router.put("/pro/live-sessions/{session_id}/end")
async def end_live_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End a live session"""
    session = await db.live_sessions.find_one({"id": session_id, "pro_id": current_user["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.live_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": "ended",
            "ended_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Session terminée"}

@api_router.post("/live-sessions/{session_id}/join")
async def join_live_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Join a live session as a participant - VIP ONLY"""
    # Check VIP status
    if not current_user.get("is_vip"):
        raise HTTPException(status_code=403, detail="Live sessions are reserved for VIP members")
    
    session = await db.live_sessions.find_one({"id": session_id, "status": "live"})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or not yet started")
    
    # Check enrollment if course-specific
    if session.get("course_id"):
        enrollment = await db.course_enrollments.find_one({
            "course_id": session["course_id"],
            "user_id": current_user["id"],
            "status": "active"
        })
        if not enrollment:
            raise HTTPException(status_code=403, detail="You must be enrolled in the course")
    
    # Check max participants
    if session["participant_count"] >= session.get("max_participants", 100):
        raise HTTPException(status_code=400, detail="Session full")
    
    # Add participant
    await db.live_sessions.update_one(
        {"id": session_id},
        {
            "$addToSet": {"participants": current_user["id"]},
            "$inc": {"participant_count": 1}
        }
    )
    
    return {
        "success": True,
        "meeting_url": session.get("meeting_url", ""),
        "message": "Vous avez rejoint la session"
    }

# Course reviews
@api_router.post("/courses/{course_id}/reviews")
async def submit_course_review(
    course_id: str,
    review: CourseReviewCreate,
    current_user: dict = Depends(get_current_user)
):
    """Submit a review for a course"""
    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Note entre 1 et 5")
    
    enrollment = await db.course_enrollments.find_one({
        "course_id": course_id,
        "user_id": current_user["id"],
        "status": {"$in": ["active", "completed"]}
    })
    
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in the course")
    
    # Check existing review
    existing = await db.course_reviews.find_one({
        "course_id": course_id,
        "user_id": current_user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already left a review")
    
    review_data = {
        "id": str(uuid.uuid4()),
        "course_id": course_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", ""),
        "rating": review.rating,
        "comment": review.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.course_reviews.insert_one(review_data)
    
    # Update course average rating
    all_reviews = await db.course_reviews.find({"course_id": course_id}).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    
    await db.pro_courses.update_one(
        {"id": course_id},
        {"$set": {
            "average_rating": round(avg_rating, 1),
            "reviews_count": len(all_reviews)
        }}
    )
    
    del review_data["_id"]
    return {"success": True, "data": review_data}

@api_router.get("/courses/{course_id}/reviews")
async def get_course_reviews(
    course_id: str,
    limit: int = 20,
    skip: int = 0
):
    """Get reviews for a course"""
    reviews = await db.course_reviews.find(
        {"course_id": course_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"success": True, "data": reviews}

# Public endpoints for browsing courses
@api_router.get("/courses")
async def browse_courses(
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    skip: int = 0
):
    """Browse published courses"""
    query = {"is_published": True}
    
    if category:
        query["category"] = category
    if difficulty:
        query["difficulty"] = difficulty
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    courses = await db.pro_courses.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.pro_courses.count_documents(query)
    
    return {"success": True, "data": courses, "total": total}

@api_router.get("/courses/{course_id}")
async def get_public_course_detail(course_id: str):
    """Get public course detail"""
    course = await db.pro_courses.find_one(
        {"id": course_id, "is_published": True},
        {"_id": 0}
    )
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Get modules and lesson counts (without full content)
    modules = await db.pro_course_modules.find(
        {"course_id": course_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    course["modules"] = modules
    
    return {"success": True, "data": course}

@api_router.get("/bookings/my")
async def get_my_bookings(
    status: Optional[str] = None,
    limit: int = 20,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's bookings (as client)"""
    query = {"client_id": current_user["id"]}
    if status:
        query["status"] = status
    
    bookings = await db.pro_bookings.find(query, {"_id": 0}).sort("scheduled_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.pro_bookings.count_documents(query)
    
    return {"success": True, "data": bookings, "total": total}

@api_router.get("/bookings/{booking_id}")
async def get_booking_detail(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get booking details (client or professional)"""
    booking = await db.pro_bookings.find_one(
        {"id": booking_id, "$or": [{"client_id": current_user["id"]}, {"pro_id": current_user["id"]}]},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {"success": True, "data": booking}

@api_router.put("/bookings/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a booking (client only, before it's confirmed)"""
    booking = await db.pro_bookings.find_one({"id": booking_id, "client_id": current_user["id"]})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] not in ["pending", "confirmed"]:
        raise HTTPException(status_code=400, detail="This booking can no longer be cancelled")
    
    # Calculate if refund is applicable (24h before)
    scheduled_at = datetime.fromisoformat(booking["scheduled_at"].replace('Z', '+00:00'))
    hours_until = (scheduled_at - datetime.now(timezone.utc)).total_seconds() / 3600
    
    refund_eligible = hours_until > 24
    
    await db.pro_bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancellation_reason": reason,
            "refund_eligible": refund_eligible
        }}
    )
    
    # Notify professional
    await send_notification_to_user(
        booking["pro_id"],
        f"Réservation annulée par {current_user.get('name', 'le client')}",
        "booking_cancelled",
        {"link": "/pro/dashboard", "booking_id": booking_id}
    )
    
    return {
        "success": True, 
        "message": "Réservation annulée",
        "refund_eligible": refund_eligible
    }

@api_router.post("/bookings/{booking_id}/review")
async def submit_booking_review(
    booking_id: str,
    rating: int,
    comment: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Submit a review for a completed booking"""
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    booking = await db.pro_bookings.find_one({"id": booking_id, "client_id": current_user["id"]})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] != "completed":
        raise HTTPException(status_code=400, detail="You can only rate a completed session")
    
    # Check if already reviewed
    existing_review = await db.pro_reviews.find_one({"booking_id": booking_id})
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already left a review for this session")
    
    # Create review
    review = {
        "id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "pro_id": booking["pro_id"],
        "client_id": current_user["id"],
        "client_name": current_user.get("name", "Client"),
        "service_title": booking["service_title"],
        "rating": rating,
        "comment": comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_reviews.insert_one(review)
    
    # Update professional's average rating
    all_reviews = await db.pro_reviews.find({"pro_id": booking["pro_id"]}).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews) if all_reviews else 0
    
    await db.pro_profiles.update_one(
        {"user_id": booking["pro_id"]},
        {"$set": {"average_rating": avg_rating, "total_reviews": len(all_reviews)}}
    )
    
    # Mark booking as reviewed
    await db.pro_bookings.update_one(
        {"id": booking_id},
        {"$set": {"has_review": True}}
    )
    
    # Notify professional
    await send_notification_to_user(
        booking["pro_id"],
        f"Nouvel avis {rating}⭐ de {current_user.get('name', 'un client')}",
        "new_review",
        {"link": "/pro/dashboard", "booking_id": booking_id, "rating": rating}
    )
    
    return {"success": True, "message": "Avis soumis avec succès"}


# ============ REVIEWS MANAGEMENT ENDPOINTS ============

class ProReviewResponse(BaseModel):
    response_text: str

@api_router.get("/pros/{pro_id}/reviews")
async def get_professional_reviews(
    pro_id: str,
    rating_filter: Optional[int] = None,
    sort_by: str = "recent",
    limit: int = 20,
    skip: int = 0
):
    """Get all reviews for a professional with filtering and pagination"""
    profile = await db.pro_profiles.find_one({"user_id": pro_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Professional not found")
    
    # Build query
    query = {"pro_id": pro_id}
    if rating_filter and 1 <= rating_filter <= 5:
        query["rating"] = rating_filter
    
    # Sort options
    sort_field = "created_at" if sort_by == "recent" else "rating"
    sort_order = -1 if sort_by in ["recent", "highest"] else 1
    
    reviews = await db.pro_reviews.find(query, {"_id": 0}).sort(sort_field, sort_order).skip(skip).limit(limit).to_list(limit)
    total = await db.pro_reviews.count_documents(query)
    
    # Calculate rating distribution
    all_reviews = await db.pro_reviews.find({"pro_id": pro_id}, {"rating": 1}).to_list(1000)
    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in all_reviews:
        rating_distribution[r["rating"]] = rating_distribution.get(r["rating"], 0) + 1
    
    return {
        "success": True,
        "data": reviews,
        "total": total,
        "stats": {
            "average_rating": profile.get("average_rating", 0),
            "total_reviews": profile.get("total_reviews", 0),
            "rating_distribution": rating_distribution
        }
    }

@api_router.post("/pro/dashboard/reviews/{review_id}/respond")
async def respond_to_review(
    review_id: str,
    response_data: ProReviewResponse,
    current_user: dict = Depends(get_current_user)
):
    """Professional responds to a client review"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    review = await db.pro_reviews.find_one({"id": review_id, "pro_id": current_user["id"]})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review.get("pro_response"):
        raise HTTPException(status_code=400, detail="You have already responded to this review")
    
    await db.pro_reviews.update_one(
        {"id": review_id},
        {"$set": {
            "pro_response": response_data.response_text,
            "pro_response_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify client
    await send_notification_to_user(
        review["client_id"],
        f"Le professionnel a répondu à votre avis",
        "review_response",
        {"link": f"/pro/{current_user['id']}", "review_id": review_id}
    )
    
    return {"success": True, "message": "Réponse publiée avec succès"}

@api_router.get("/pro/dashboard/reviews")
async def get_my_reviews(
    has_response: Optional[bool] = None,
    rating_filter: Optional[int] = None,
    limit: int = 20,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get reviews for the current professional"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    query = {"pro_id": current_user["id"]}
    if has_response is not None:
        if has_response:
            query["pro_response"] = {"$exists": True, "$ne": None}
        else:
            query["$or"] = [{"pro_response": {"$exists": False}}, {"pro_response": None}]
    if rating_filter and 1 <= rating_filter <= 5:
        query["rating"] = rating_filter
    
    reviews = await db.pro_reviews.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.pro_reviews.count_documents(query)
    
    # Count pending responses
    pending_response = await db.pro_reviews.count_documents({
        "pro_id": current_user["id"],
        "$or": [{"pro_response": {"$exists": False}}, {"pro_response": None}]
    })
    
    return {
        "success": True,
        "data": reviews,
        "total": total,
        "pending_responses": pending_response
    }

@api_router.put("/pro/dashboard/reviews/{review_id}/respond")
async def update_review_response(
    review_id: str,
    response_data: ProReviewResponse,
    current_user: dict = Depends(get_current_user)
):
    """Update professional's response to a review"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="You are not a verified professional")
    
    review = await db.pro_reviews.find_one({"id": review_id, "pro_id": current_user["id"]})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    await db.pro_reviews.update_one(
        {"id": review_id},
        {"$set": {
            "pro_response": response_data.response_text,
            "pro_response_at": datetime.now(timezone.utc).isoformat(),
            "pro_response_edited": True
        }}
    )
    
    return {"success": True, "message": "Réponse mise à jour"}


# ============ STRIPE PAYMENT ENDPOINTS ============

# Re-use top-level StripeCheckout (already imported conditionally)
# STRIPE_API_KEY already set at line 98, do NOT reassign

class BookingPaymentRequest(BaseModel):
    booking_id: str
    origin_url: str

@api_router.post("/payments/booking/checkout")
async def create_booking_payment(
    request: Request,
    payment_data: BookingPaymentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe checkout session for a booking"""
    booking = await db.pro_bookings.find_one({
        "id": payment_data.booking_id,
        "client_id": current_user["id"],
        "status": {"$in": ["pending", "confirmed"]},
        "payment_status": "unpaid"
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or already paid")
    
    # Initialize Stripe
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create URLs
    success_url = f"{payment_data.origin_url}/bookings?session_id={{CHECKOUT_SESSION_ID}}&payment=success"
    cancel_url = f"{payment_data.origin_url}/bookings?payment=cancelled"
    
    # Amount from booking (server-side, not from frontend)
    amount = float(booking["total_amount"])
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "booking_id": booking["id"],
            "client_id": current_user["id"],
            "pro_id": booking["pro_id"],
            "service_title": booking["service_title"],
            "type": "booking_payment"
        }
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    payment_transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "booking_id": booking["id"],
        "client_id": current_user["id"],
        "pro_id": booking["pro_id"],
        "amount": amount,
        "currency": "usd",
        "commission_amount": booking["commission_amount"],
        "pro_earnings": booking["pro_earnings"],
        "payment_status": "pending",
        "metadata": {
            "service_title": booking["service_title"],
            "scheduled_at": booking["scheduled_at"]
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(payment_transaction)
    
    return {
        "success": True,
        "checkout_url": session.url,
        "session_id": session.session_id
    }

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(
    request: Request,
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check the status of a payment"""
    # Get transaction from DB
    transaction = await db.payment_transactions.find_one({"session_id": session_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Only allow owner to check
    if transaction["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    # If already processed, return from DB
    if transaction["payment_status"] in ["paid", "failed"]:
        return {
            "success": True,
            "payment_status": transaction["payment_status"],
            "booking_id": transaction["booking_id"]
        }
    
    # Otherwise check with Stripe
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction based on Stripe status
    new_status = "pending"
    if checkout_status.payment_status == "paid":
        new_status = "paid"
        
        # Update booking as paid
        await db.pro_bookings.update_one(
            {"id": transaction["booking_id"]},
            {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Notify professional
        await send_notification_to_user(
            transaction["pro_id"],
            f"Paiement reçu de {transaction['amount']}€ pour une réservation",
            "payment_received",
            {"link": "/pro/dashboard", "booking_id": transaction["booking_id"]}
        )
        
    elif checkout_status.status == "expired":
        new_status = "expired"
    
    # Update transaction
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "success": True,
        "payment_status": new_status,
        "booking_id": transaction["booking_id"],
        "stripe_status": checkout_status.status
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            # Find and update transaction
            transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id})
            if transaction and transaction["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Update booking
                await db.pro_bookings.update_one(
                    {"id": transaction["booking_id"]},
                    {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Notify professional
                await send_notification_to_user(
                    transaction["pro_id"],
                    f"Paiement reçu de {transaction['amount']}€",
                    "payment_received",
                    {"link": "/pro/dashboard", "booking_id": transaction["booking_id"]}
                )
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"success": False, "error": str(e)}


# ============ USER REPORTING SYSTEM (P2) ============

REPORT_REASONS = [
    "spam",
    "harassment", 
    "inappropriate_content",
    "fraud",
    "impersonation",
    "other"
]

REPORT_STATUS_PENDING = "pending"
REPORT_STATUS_REVIEWED = "reviewed"
REPORT_STATUS_RESOLVED = "resolved"
REPORT_STATUS_DISMISSED = "dismissed"

class ReportCreate(BaseModel):
    reported_user_id: str
    reason: str
    details: Optional[str] = None
    context_type: Optional[str] = None  # "booking", "profile", "post", "review"
    context_id: Optional[str] = None  # ID of the related item

@api_router.post("/reports")
async def create_report(
    report_data: ReportCreate,
    current_user: dict = Depends(get_current_user)
):
    """Report a user for inappropriate behavior"""
    # Validate reason
    if report_data.reason not in REPORT_REASONS:
        raise HTTPException(status_code=400, detail=f"Raison invalide. Raisons valides: {', '.join(REPORT_REASONS)}")
    
    # Can't report yourself
    if report_data.reported_user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot report yourself")
    
    # Check if reported user exists
    reported_user = await db.users.find_one({"id": report_data.reported_user_id})
    if not reported_user:
        raise HTTPException(status_code=404, detail="Reported user not found")
    
    # Check for duplicate recent report from same user
    existing_report = await db.user_reports.find_one({
        "reporter_id": current_user["id"],
        "reported_user_id": report_data.reported_user_id,
        "status": REPORT_STATUS_PENDING
    })
    if existing_report:
        raise HTTPException(status_code=400, detail="You already have an active report for this user")
    
    # Create report
    report = {
        "id": str(uuid.uuid4()),
        "reporter_id": current_user["id"],
        "reporter_name": current_user.get("name", "Utilisateur"),
        "reporter_email": current_user.get("email"),
        "reported_user_id": report_data.reported_user_id,
        "reported_user_name": reported_user.get("name", "Utilisateur"),
        "reported_user_email": reported_user.get("email"),
        "reason": report_data.reason,
        "details": report_data.details,
        "context_type": report_data.context_type,
        "context_id": report_data.context_id,
        "status": REPORT_STATUS_PENDING,
        "admin_notes": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_reports.insert_one(report)
    
    # Notify ALL super_admins about the report
    admin_users = await db.users.find({"role": {"$in": ["super_admin", "admin"]}}, {"id": 1}).to_list(50)
    for admin in admin_users:
        await send_notification_to_user(
            admin["id"],
            f"Signalement de {reported_user.get('name', 'Utilisateur')} par {current_user.get('name')} : {report_data.reason}",
            "admin_report",
            {"report_id": report["id"], "reported_user_id": report_data.reported_user_id},
            "Nouveau signalement"
        )
    
    # Create index for faster queries
    await db.user_reports.create_index([("reported_user_id", 1)])
    await db.user_reports.create_index([("status", 1)])
    
    # Log admin action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "user_reported",
        "target_type": "user",
        "target_id": report_data.reported_user_id,
        "details": f"Signalé par {current_user.get('name')} pour: {report_data.reason}",
        "admin_id": None,  # Not admin action
        "reporter_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": "Signalement envoyé. Notre équipe l'examinera dans les plus brefs délais.",
        "report_id": report["id"]
    }

@api_router.get("/reports/reasons")
async def get_report_reasons():
    """Get available report reasons"""
    reasons_labels = {
        "spam": "Spam ou contenu non sollicité",
        "harassment": "Harcèlement ou intimidation",
        "inappropriate_content": "Contenu inapproprié",
        "fraud": "Fraude ou arnaque suspectée",
        "impersonation": "Usurpation d'identité",
        "other": "Autre raison"
    }
    return {
        "success": True,
        "reasons": [{"id": r, "label": reasons_labels[r]} for r in REPORT_REASONS]
    }


# ============ PLATFORM REVENUE ENDPOINTS (SUPER ADMIN ONLY) ============

@api_router.get("/admin/revenue")
async def get_platform_revenue(
    period: str = "all",  # all, month, week
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get platform revenue statistics (super admin only)"""
    
    # Date filters
    now = datetime.now(timezone.utc)
    date_filter = {}
    if period == "month":
        start_date = (now - timedelta(days=30)).isoformat()
        date_filter = {"created_at": {"$gte": start_date}}
    elif period == "week":
        start_date = (now - timedelta(days=7)).isoformat()
        date_filter = {"created_at": {"$gte": start_date}}
    
    # Get all completed bookings with payment
    booking_filter = {"payment_status": "paid", **date_filter}
    bookings = await db.pro_bookings.find(booking_filter, {"_id": 0}).to_list(1000)
    
    # Calculate totals
    total_transactions = len(bookings)
    total_revenue = sum(b.get("total_amount", 0) for b in bookings)
    total_commission = sum(b.get("platform_commission", 0) for b in bookings)
    total_pro_earnings = sum(b.get("pro_earnings", 0) for b in bookings)
    
    # Get pending withdrawals
    pending_withdrawals = await db.pro_withdrawals.find(
        {"status": "pending"}, {"_id": 0}
    ).to_list(100)
    pending_withdrawal_amount = sum(w.get("amount", 0) for w in pending_withdrawals)
    
    # Get monthly breakdown (last 6 months)
    monthly_data = []
    for i in range(6):
        month_start = (now - timedelta(days=30 * (i + 1))).replace(day=1)
        month_end = (now - timedelta(days=30 * i)).replace(day=1)
        
        month_bookings = [
            b for b in bookings 
            if b.get("created_at", "") >= month_start.isoformat() 
            and b.get("created_at", "") < month_end.isoformat()
        ]
        
        monthly_data.append({
            "month": month_start.strftime("%B %Y"),
            "transactions": len(month_bookings),
            "revenue": sum(b.get("total_amount", 0) for b in month_bookings),
            "commission": sum(b.get("platform_commission", 0) for b in month_bookings)
        })
    
    # Top earning professionals
    pipeline = [
        {"$match": {"is_available": True}},
        {"$sort": {"total_earnings": -1}},
        {"$limit": 10},
        {"$project": {"_id": 0, "user_id": 1, "display_name": 1, "total_earnings": 1, "total_sessions": 1}}
    ]
    top_pros = await db.pro_profiles.aggregate(pipeline).to_list(10)
    
    # Recent transactions
    recent_bookings = await db.pro_bookings.find(
        {"payment_status": "paid"},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Enrich with service and user info
    for booking in recent_bookings:
        service = await db.pro_services.find_one({"id": booking.get("service_id")}, {"_id": 0, "title": 1})
        if service:
            booking["service_title"] = service.get("title", "Service")
        pro_profile = await db.pro_profiles.find_one({"user_id": booking.get("pro_id")}, {"_id": 0, "display_name": 1})
        if pro_profile:
            booking["pro_name"] = pro_profile.get("display_name", "Pro")
    
    return {
        "success": True,
        "data": {
            "summary": {
                "total_transactions": total_transactions,
                "total_revenue": total_revenue,
                "total_commission": total_commission,
                "total_pro_earnings": total_pro_earnings,
                "commission_rate": COMMISSION_RATE * 100,
                "pending_withdrawals": pending_withdrawal_amount
            },
            "monthly": monthly_data[::-1],  # Reverse to show oldest first
            "top_professionals": top_pros,
            "recent_transactions": recent_bookings
        }
    }

@api_router.get("/admin/withdrawals")
async def get_withdrawal_requests(
    status: Optional[str] = None,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get all withdrawal requests (super admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.pro_withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with pro info
    for w in withdrawals:
        pro = await db.pro_profiles.find_one({"user_id": w.get("user_id")}, {"_id": 0, "display_name": 1})
        if pro:
            w["pro_name"] = pro.get("display_name", "Pro")
    
    pending_count = await db.pro_withdrawals.count_documents({"status": "pending"})
    
    return {
        "success": True,
        "data": withdrawals,
        "stats": {"pending": pending_count}
    }

@api_router.put("/admin/withdrawals/{withdrawal_id}/process")
async def process_withdrawal(
    withdrawal_id: str,
    action: str,  # approve, reject
    admin_notes: Optional[str] = None,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Process a withdrawal request (super admin only)"""
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Action invalide")
    
    withdrawal = await db.pro_withdrawals.find_one({"id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    
    if withdrawal.get("status") != "pending":
        raise HTTPException(status_code=400, detail="This request has already been processed")
    
    new_status = "completed" if action == "approve" else "rejected"
    
    await db.pro_withdrawals.update_one(
        {"id": withdrawal_id},
        {"$set": {
            "status": new_status,
            "processed_by": admin_user["id"],
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "admin_notes": admin_notes
        }}
    )
    
    # If rejected, refund the amount to available_earnings
    if action == "reject":
        await db.pro_profiles.update_one(
            {"user_id": withdrawal.get("user_id")},
            {"$inc": {"available_earnings": withdrawal.get("amount", 0)}}
        )
    
    # Notify the professional
    message = f"Votre demande de retrait de {withdrawal.get('amount', 0)}€ a été {'approuvée' if action == 'approve' else 'rejetée'}."
    if admin_notes:
        message += f" Note: {admin_notes}"
    
    await send_notification_to_user(
        withdrawal.get("user_id"),
        message,
        "withdrawal_processed",
        {"status": new_status}
    )
    
    return {
        "success": True,
        "message": f"Demande de retrait {new_status}"
    }



@api_router.get("/admin/reports")
async def get_reports(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    admin_user: dict = Depends(get_admin_user)
):
    """Get all user reports (admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    reports = await db.user_reports.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.user_reports.count_documents(query)
    pending = await db.user_reports.count_documents({"status": REPORT_STATUS_PENDING})
    
    return {
        "success": True,
        "data": reports,
        "total": total,
        "stats": {"pending": pending}
    }

@api_router.put("/admin/reports/{report_id}/review")
async def review_report(
    report_id: str,
    new_status: str,
    admin_notes: Optional[str] = None,
    ban_user: bool = False,
    admin_user: dict = Depends(get_admin_user)
):
    """Review and update a report status (admin only)"""
    valid_statuses = [REPORT_STATUS_REVIEWED, REPORT_STATUS_RESOLVED, REPORT_STATUS_DISMISSED]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Statuts valides: {', '.join(valid_statuses)}")
    
    report = await db.user_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    update_data = {
        "status": new_status,
        "admin_notes": admin_notes,
        "reviewed_by": admin_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_reports.update_one({"id": report_id}, {"$set": update_data})
    
    # Optionally ban the reported user
    if ban_user and new_status == REPORT_STATUS_RESOLVED:
        await db.users.update_one(
            {"id": report["reported_user_id"]},
            {"$set": {"is_banned": True, "banned_reason": f"Suite au signalement: {report['reason']}"}}
        )
        
        # Log admin action
        await db.admin_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "user_banned_from_report",
            "target_type": "user",
            "target_id": report["reported_user_id"],
            "details": f"Banni suite au signalement {report_id}. Raison: {report['reason']}",
            "admin_id": admin_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "success": True,
        "message": f"Signalement mis à jour: {new_status}" + (" - Utilisateur banni" if ban_user else "")
    }

@api_router.get("/admin/reports/stats")
async def get_reports_stats(admin_user: dict = Depends(get_admin_user)):
    """Get report statistics (admin only)"""
    total = await db.user_reports.count_documents({})
    pending = await db.user_reports.count_documents({"status": REPORT_STATUS_PENDING})
    reviewed = await db.user_reports.count_documents({"status": REPORT_STATUS_REVIEWED})
    resolved = await db.user_reports.count_documents({"status": REPORT_STATUS_RESOLVED})
    dismissed = await db.user_reports.count_documents({"status": REPORT_STATUS_DISMISSED})
    
    # Reports by reason
    pipeline = [
        {"$group": {"_id": "$reason", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_reason = await db.user_reports.aggregate(pipeline).to_list(10)
    
    return {
        "success": True,
        "stats": {
            "total": total,
            "pending": pending,
            "reviewed": reviewed,
            "resolved": resolved,
            "dismissed": dismissed,
            "by_reason": {item["_id"]: item["count"] for item in by_reason}
        }
    }

# ============================================
# ADVANCED STATISTICS APIS
# ============================================

@api_router.get("/pro/analytics/revenue")
async def get_pro_revenue_analytics(
    period: str = "30d",
    current_user: dict = Depends(get_current_user)
):
    """Get detailed revenue analytics with chart data"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    start_iso = start_date.isoformat()
    
    pro_id = current_user["id"]
    is_admin = current_user.get("role") in ("admin", "super_admin")
    
    # Admin sees all platform revenue; regular pros see only their own
    booking_filter = {"created_at": {"$gte": start_iso}}
    if not is_admin:
        booking_filter["pro_id"] = pro_id
    
    bookings = await db.pro_bookings.find(booking_filter, {"_id": 0}).to_list(1000)
    
    # Offer purchases
    if is_admin:
        offer_purchases = await db.offer_purchases.find(
            {"created_at": {"$gte": start_iso}}, {"_id": 0}
        ).to_list(1000)
        logger.info(f"Admin: {len(offer_purchases)} offer purchases, {len([p for p in offer_purchases if p.get('status')=='completed'])} completed")
    else:
        pro_offers_list = await db.pro_offers.find({"pro_id": pro_id}, {"_id": 0, "id": 1}).to_list(100)
        pro_offer_ids = {o["id"] for o in pro_offers_list}
        offer_purchases = await db.offer_purchases.find(
            {"created_at": {"$gte": start_iso}}, {"_id": 0}
        ).to_list(1000)
        offer_purchases = [p for p in offer_purchases if p.get("offer_id") in pro_offer_ids]
    
    # Build daily chart data
    daily_data = {}
    for i in range(days):
        date = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_data[date] = {"bookings": 0, "offers": 0, "total": 0, "pending": 0}
    
    # All bookings — separate paid vs pending
    paid_revenue = 0
    pending_revenue = 0
    for booking in bookings:
        created = booking.get("created_at", "")
        date = created[:10] if isinstance(created, str) else ""
        amount = booking.get("pro_earnings", booking.get("total_amount", 0))
        if date in daily_data:
            if booking.get("payment_status") == "paid":
                daily_data[date]["bookings"] += amount
                daily_data[date]["total"] += amount
                paid_revenue += amount
            else:
                daily_data[date]["pending"] += amount
                pending_revenue += amount
    
    # Offer purchases
    offers_completed_revenue = 0
    offers_pending_revenue = 0
    for purchase in offer_purchases:
        completed = purchase.get("completed_at", purchase.get("created_at", ""))
        date = completed[:10] if isinstance(completed, str) else ""
        amount = purchase.get("amount", 0) * 0.9
        if date in daily_data:
            if purchase.get("status") == "completed":
                daily_data[date]["offers"] += amount
                daily_data[date]["total"] += amount
                offers_completed_revenue += amount
            else:
                daily_data[date]["pending"] += amount
                offers_pending_revenue += amount
    
    chart_data = [{"date": date, **data} for date, data in sorted(daily_data.items())]
    total_paid = paid_revenue + offers_completed_revenue
    total_pending = pending_revenue + offers_pending_revenue
    
    return {
        "success": True,
        "data": {
            "period": period,
            "chart_data": chart_data,
            "summary": {
                "total_revenue": total_paid,
                "pending_revenue": total_pending,
                "bookings_revenue": paid_revenue,
                "courses_revenue": offers_completed_revenue,
                "total_bookings": len(bookings),
                "total_enrollments": len([p for p in offer_purchases if p.get("status") == "completed"]),
                "pending_bookings": len([b for b in bookings if b.get("payment_status") != "paid"]),
                "pending_offers": len([p for p in offer_purchases if p.get("status") != "completed"])
            }
        }
    }

@api_router.get("/pro/analytics/performance")
async def get_pro_performance_analytics(current_user: dict = Depends(get_current_user)):
    """Get performance metrics"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    pro_id = current_user["id"]
    is_admin = current_user.get("role") in ("admin", "super_admin")
    
    # Admin sees platform-wide stats
    service_filter = {} if is_admin else {"pro_id": pro_id}
    services = await db.pro_services.find(service_filter, {"_id": 0}).to_list(100)
    
    booking_filter = {} if is_admin else {"pro_id": pro_id}
    bookings_by_status = await db.pro_bookings.aggregate([
        {"$match": booking_filter},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(10)
    status_counts = {item["_id"]: item["count"] for item in bookings_by_status}
    total_bookings = sum(status_counts.values())
    
    # Offer purchases
    all_offer_purchases = await db.offer_purchases.find({}, {"_id": 0}).to_list(1000)
    if not is_admin:
        pro_offers = await db.pro_offers.find({"pro_id": pro_id}, {"_id": 0, "id": 1}).to_list(100)
        pro_offer_ids = {o["id"] for o in pro_offers}
        all_offer_purchases = [p for p in all_offer_purchases if p.get("offer_id") in pro_offer_ids]
    
    offer_completed = len([p for p in all_offer_purchases if p.get("status") == "completed"])
    offer_pending = len([p for p in all_offer_purchases if p.get("status") == "pending"])
    
    review_filter = {} if is_admin else {"pro_id": pro_id}
    reviews = await db.pro_reviews.find(review_filter, {"_id": 0, "rating": 1}).to_list(500)
    avg_rating = sum(r.get("rating", 0) for r in reviews) / max(len(reviews), 1)
    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for review in reviews:
        rating = review.get("rating", 0)
        if rating in rating_distribution:
            rating_distribution[rating] += 1
    
    total_views = sum(s.get("views", 0) for s in services)
    all_transactions = total_bookings + len(all_offer_purchases)
    completed_transactions = status_counts.get("completed", 0) + offer_completed
    conversion_rate = min((all_transactions / max(total_views, 1)) * 100, 100)
    completion_rate = (completed_transactions / max(all_transactions, 1)) * 100
    
    return {
        "success": True,
        "data": {
            "services": {"total": len(services), "active": len([s for s in services if s.get("is_active")])},
            "bookings": {
                "total": total_bookings,
                "by_status": status_counts,
                "completion_rate": round(completion_rate, 1),
                "offer_purchases": len(all_offer_purchases),
                "offer_completed": offer_completed,
                "offer_pending": offer_pending
            },
            "reviews": {"total": len(reviews), "average_rating": round(avg_rating, 1), "distribution": rating_distribution},
            "conversion": {"total_views": total_views, "rate": round(conversion_rate, 2), "total_transactions": all_transactions}
        }
    }

@api_router.get("/pro/export/bookings")
async def export_pro_bookings(format: str = "csv", start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Export bookings data for accounting"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    query = {"pro_id": current_user["id"]}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(5000)
    
    service_ids = list(set(b.get("service_id") for b in bookings if b.get("service_id")))
    services = await db.pro_services.find({"id": {"$in": service_ids}}, {"_id": 0, "id": 1, "title": 1}).to_list(100)
    service_map = {s["id"]: s["title"] for s in services}
    
    client_ids = list(set(b.get("client_id") for b in bookings if b.get("client_id")))
    clients = await db.users.find({"id": {"$in": client_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(1000)
    client_map = {c["id"]: {"name": c.get("name", ""), "email": c.get("email", "")} for c in clients}
    
    export_data = []
    for booking in bookings:
        client = client_map.get(booking.get("client_id"), {})
        export_data.append({
            "id": booking.get("id", ""),
            "date": booking.get("created_at", "")[:10],
            "service": service_map.get(booking.get("service_id"), ""),
            "client_name": client.get("name", ""),
            "client_email": client.get("email", ""),
            "status": booking.get("status", ""),
            "amount": booking.get("amount", 0),
            "currency": "USD",
            "booking_date": booking.get("booking_date", ""),
            "booking_time": booking.get("booking_time", "")
        })
    
    if format == "csv":
        if not export_data:
            csv_content = "id,date,service,client_name,client_email,status,amount,currency,booking_date,booking_time\n"
        else:
            headers = list(export_data[0].keys())
            csv_lines = [",".join(headers)]
            for row in export_data:
                csv_lines.append(",".join(str(row.get(h, "")).replace(",", ";") for h in headers))
            csv_content = "\n".join(csv_lines)
        return {"success": True, "format": "csv", "filename": f"bookings_export_{datetime.now().strftime('%Y%m%d')}.csv", "content": csv_content, "count": len(export_data)}
    else:
        return {"success": True, "format": "json", "data": export_data, "count": len(export_data)}

@api_router.get("/pro/export/revenue")
async def export_pro_revenue(year: int = None, current_user: dict = Depends(get_current_user)):
    """Export revenue summary for tax/accounting"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    if not year:
        year = datetime.now().year
    
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    bookings = await db.bookings.find({
        "pro_id": current_user["id"], "status": "completed",
        "created_at": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(5000)
    
    pro_courses = await db.pro_courses.find({"pro_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(100)
    course_ids = [c["id"] for c in pro_courses]
    
    enrollments = await db.course_enrollments.find({
        "course_id": {"$in": course_ids},
        "enrolled_at": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(5000)
    
    monthly_data = {i: {"bookings": 0, "courses": 0, "total": 0} for i in range(1, 13)}
    
    for booking in bookings:
        try:
            month = int(booking.get("created_at", "")[5:7])
            amount = booking.get("amount", 0)
            monthly_data[month]["bookings"] += amount
            monthly_data[month]["total"] += amount
        except: pass
    
    for enrollment in enrollments:
        try:
            month = int(enrollment.get("enrolled_at", "")[5:7])
            amount = enrollment.get("price_paid", 0)
            monthly_data[month]["courses"] += amount
            monthly_data[month]["total"] += amount
        except: pass
    
    total_bookings = sum(d["bookings"] for d in monthly_data.values())
    total_courses = sum(d["courses"] for d in monthly_data.values())
    
    return {
        "success": True, "year": year,
        "summary": {"total_revenue": total_bookings + total_courses, "bookings_revenue": total_bookings, "courses_revenue": total_courses, "total_transactions": len(bookings) + len(enrollments)},
        "monthly_breakdown": [{"month": i, "month_name": ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"][i], **data} for i, data in monthly_data.items()]
    }

@api_router.get("/pro/export/revenue/pdf")
async def export_pro_revenue_pdf(year: int = None, current_user: dict = Depends(get_current_user)):
    """Generate PDF fiscal report for accounting"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    if not year:
        year = datetime.now().year
    
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    # Get user profile
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    pro_profile = await db.pro_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    # Get completed bookings
    bookings = await db.bookings.find({
        "pro_id": current_user["id"], "status": "completed",
        "created_at": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(5000)
    
    # Get course enrollments
    pro_courses = await db.pro_courses.find({"pro_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(100)
    course_ids = [c["id"] for c in pro_courses]
    
    enrollments = await db.course_enrollments.find({
        "course_id": {"$in": course_ids},
        "enrolled_at": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(5000)
    
    # Calculate monthly data
    monthly_data = {i: {"bookings": 0, "courses": 0, "total": 0} for i in range(1, 13)}
    month_names = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
    
    for booking in bookings:
        try:
            month = int(booking.get("created_at", "")[5:7])
            monthly_data[month]["bookings"] += booking.get("amount", 0)
            monthly_data[month]["total"] += booking.get("amount", 0)
        except: pass
    
    for enrollment in enrollments:
        try:
            month = int(enrollment.get("enrolled_at", "")[5:7])
            monthly_data[month]["courses"] += enrollment.get("price_paid", 0)
            monthly_data[month]["total"] += enrollment.get("price_paid", 0)
        except: pass
    
    total_bookings_rev = sum(d["bookings"] for d in monthly_data.values())
    total_courses_rev = sum(d["courses"] for d in monthly_data.values())
    total_revenue = total_bookings_rev + total_courses_rev
    
    # Generate PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Header
    pdf.set_fill_color(124, 58, 237)  # Purple
    pdf.rect(0, 0, 210, 40, 'F')
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 24)
    pdf.set_y(12)
    pdf.cell(0, 10, 'RAPPORT FISCAL', 0, 1, 'C')
    pdf.set_font('Helvetica', '', 12)
    pdf.cell(0, 8, f'Annee {year}', 0, 1, 'C')
    
    # Professional Info
    pdf.set_y(50)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 10, 'INFORMATIONS DU PROFESSIONNEL', 0, 1, 'L')
    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 7, f'Nom: {user.get("name", "N/A")}', 0, 1)
    pdf.cell(0, 7, f'Email: {user.get("email", "N/A")}', 0, 1)
    pdf.cell(0, 7, f'Specialite: {pro_profile.get("expertise_area", "N/A") if pro_profile else "N/A"}', 0, 1)
    pdf.cell(0, 7, f'Date de generation: {datetime.now().strftime("%d/%m/%Y %H:%M")}', 0, 1)
    
    # Summary Box
    pdf.ln(10)
    pdf.set_fill_color(240, 240, 250)
    pdf.rect(10, pdf.get_y(), 190, 35, 'F')
    pdf.set_y(pdf.get_y() + 5)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 8, 'RESUME ANNUEL', 0, 1, 'C')
    pdf.set_font('Helvetica', 'B', 20)
    pdf.set_text_color(124, 58, 237)
    pdf.cell(0, 12, f'${total_revenue:.2f} USD', 0, 1, 'C')
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f'Services: ${total_bookings_rev:.2f} | Cours: ${total_courses_rev:.2f} | Transactions: {len(bookings) + len(enrollments)}', 0, 1, 'C')
    
    # Monthly Breakdown Table
    pdf.ln(15)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 10, 'DETAIL MENSUEL', 0, 1, 'L')
    
    # Table Header
    pdf.set_fill_color(124, 58, 237)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(50, 8, 'Mois', 1, 0, 'C', True)
    pdf.cell(45, 8, 'Services ($)', 1, 0, 'C', True)
    pdf.cell(45, 8, 'Cours ($)', 1, 0, 'C', True)
    pdf.cell(50, 8, 'Total ($)', 1, 1, 'C', True)
    
    # Table Rows
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Helvetica', '', 10)
    for month_num in range(1, 13):
        data = monthly_data[month_num]
        pdf.set_fill_color(250, 250, 255) if month_num % 2 == 0 else pdf.set_fill_color(255, 255, 255)
        pdf.cell(50, 7, month_names[month_num], 1, 0, 'L', True)
        pdf.cell(45, 7, f'{data["bookings"]:.2f}', 1, 0, 'R', True)
        pdf.cell(45, 7, f'{data["courses"]:.2f}', 1, 0, 'R', True)
        pdf.cell(50, 7, f'{data["total"]:.2f}', 1, 1, 'R', True)
    
    # Total Row
    pdf.set_fill_color(230, 230, 245)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(50, 8, 'TOTAL ANNUEL', 1, 0, 'L', True)
    pdf.cell(45, 8, f'{total_bookings_rev:.2f}', 1, 0, 'R', True)
    pdf.cell(45, 8, f'{total_courses_rev:.2f}', 1, 0, 'R', True)
    pdf.cell(50, 8, f'{total_revenue:.2f}', 1, 1, 'R', True)
    
    # Footer
    pdf.ln(15)
    pdf.set_font('Helvetica', 'I', 9)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 6, 'Ce document est genere automatiquement par Mentova.', 0, 1, 'C')
    pdf.cell(0, 6, 'Il est destine a des fins comptables et fiscales.', 0, 1, 'C')
    
    # Generate PDF bytes
    pdf_output = pdf.output()
    pdf_base64 = base64.b64encode(pdf_output).decode('utf-8')
    
    return {
        "success": True,
        "filename": f"rapport_fiscal_{year}.pdf",
        "pdf_base64": pdf_base64,
        "year": year,
        "total_revenue": total_revenue
    }


# ============================================
# FLEXIBLE PRO SYSTEM - APIs
# ============================================

# --- CONTENT LIBRARY ---

@api_router.get("/pro/content-library")
async def get_content_library(current_user: dict = Depends(get_current_user)):
    """Get all content items created by the pro"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    contents = await db.content_library.find(
        {"pro_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return {"success": True, "data": contents}

@api_router.post("/pro/content-library")
async def create_content_item(
    content_data: ContentItemCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new content item in the library"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    content = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "content_type": content_data.content_type,
        "title": content_data.title,
        "description": content_data.description,
        "content_data": content_data.content_data or {},
        "file_url": content_data.file_url,
        "video_url": content_data.video_url,
        "thumbnail_url": content_data.thumbnail_url,
        "duration_minutes": content_data.duration_minutes,
        "tags": content_data.tags or [],
        "is_premium": content_data.is_premium,
        "available_from": content_data.available_from,
        "usage_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content_library.insert_one(content)
    content.pop("_id", None)
    
    return {"success": True, "data": content}

@api_router.get("/pro/content-library/{content_id}")
async def get_content_item(content_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific content item"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    content = await db.content_library.find_one(
        {"id": content_id, "pro_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    return {"success": True, "data": content}

@api_router.put("/pro/content-library/{content_id}")
async def update_content_item(
    content_id: str,
    update_data: ContentItemUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a content item"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.content_library.update_one(
        {"id": content_id, "pro_id": current_user["id"]},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    
    return {"success": True, "message": "Contenu mis à jour"}

@api_router.delete("/pro/content-library/{content_id}")
async def delete_content_item(content_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a content item"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    result = await db.content_library.delete_one(
        {"id": content_id, "pro_id": current_user["id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    
    return {"success": True, "message": "Contenu supprimé"}

# --- FLEXIBLE OFFERS ---

@api_router.get("/pro/offers")
async def get_pro_offers(current_user: dict = Depends(get_current_user)):
    """Get all offers created by the pro"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    offers = await db.pro_offers.find(
        {"pro_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with stats
    for offer in offers:
        sales = await db.offer_purchases.count_documents({"offer_id": offer["id"]})
        revenue = await db.offer_purchases.aggregate([
            {"$match": {"offer_id": offer["id"], "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_paid"}}}
        ]).to_list(1)
        offer["stats"] = {
            "total_sales": sales,
            "total_revenue": revenue[0]["total"] if revenue else 0
        }
    
    return {"success": True, "data": offers}

@api_router.post("/pro/offers")
async def create_offer(
    offer_data: OfferCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new flexible offer"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    offer = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "offer_type": offer_data.offer_type,
        "title": offer_data.title,
        "description": offer_data.description,
        "short_description": offer_data.short_description,
        "price": offer_data.price,
        "currency": offer_data.currency,
        "pricing_model": offer_data.pricing_model,
        "subscription_interval": offer_data.subscription_interval,
        "min_price": offer_data.min_price,
        "installments_count": offer_data.installments_count,
        "discount_price": offer_data.discount_price,
        "discount_ends_at": offer_data.discount_ends_at,
        "included_content_ids": offer_data.included_content_ids or [],
        "included_service_ids": offer_data.included_service_ids or [],
        "included_course_ids": offer_data.included_course_ids or [],
        "access_duration_days": offer_data.access_duration_days,
        "max_participants": offer_data.max_participants,
        "available_days": offer_data.available_days,
        "available_hours": offer_data.available_hours,
        "scheduled_date": offer_data.scheduled_date,
        "thumbnail_url": offer_data.thumbnail_url,
        "preview_video_url": offer_data.preview_video_url,
        "category": offer_data.category,
        "difficulty": offer_data.difficulty,
        "tags": offer_data.tags or [],
        "is_published": offer_data.is_published,
        "is_featured": offer_data.is_featured,
        "unlock_rules": offer_data.unlock_rules or [],
        "total_sales": 0,
        "total_revenue": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_offers.insert_one(offer)
    offer.pop("_id", None)
    
    return {"success": True, "data": offer}

@api_router.get("/pro/offers/{offer_id}")
async def get_pro_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific offer with full details"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    offer = await db.pro_offers.find_one(
        {"id": offer_id, "pro_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Get included content details
    if offer.get("included_content_ids"):
        contents = await db.content_library.find(
            {"id": {"$in": offer["included_content_ids"]}},
            {"_id": 0}
        ).to_list(100)
        offer["included_contents"] = contents
    
    return {"success": True, "data": offer}

@api_router.put("/pro/offers/{offer_id}")
async def update_offer(
    offer_id: str,
    update_data: OfferUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an offer"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.pro_offers.update_one(
        {"id": offer_id, "pro_id": current_user["id"]},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    return {"success": True, "message": "Offre mise à jour"}

@api_router.delete("/pro/offers/{offer_id}")
async def delete_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an offer"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    result = await db.pro_offers.delete_one(
        {"id": offer_id, "pro_id": current_user["id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    return {"success": True, "message": "Offre supprimée"}

@api_router.put("/pro/offers/{offer_id}/publish")
async def toggle_offer_publish(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle publish status of an offer"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    offer = await db.pro_offers.find_one({"id": offer_id, "pro_id": current_user["id"]})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    new_status = not offer.get("is_published", False)
    await db.pro_offers.update_one(
        {"id": offer_id},
        {"$set": {"is_published": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify all VIP users when an offer is published
    if new_status:
        import asyncio as _asyncio
        async def _notify_vips():
            try:
                mentor_name = current_user.get("name", "A mentor")
                offer_title = offer.get("title", "New offer")
                vip_users = await db.users.find(
                    {"is_vip": True, "id": {"$ne": current_user["id"]}},
                    {"_id": 0, "id": 1}
                ).to_list(5000)
                for vip in vip_users:
                    await send_notification_to_user(
                        user_id=vip["id"],
                        body=f"{mentor_name} just published: {offer_title}",
                        notification_type="new_offer",
                        data={"offer_id": offer_id, "route": "/marketplace"},
                        title="New Marketplace Offer"
                    )
                logger.info(f"Sent new_offer notifications to {len(vip_users)} VIP users for offer {offer_id}")
            except Exception as e:
                logger.error(f"Error sending new_offer notifications: {e}")
        _asyncio.ensure_future(_notify_vips())
    
    return {"success": True, "is_published": new_status}

# --- BUNDLES ---

@api_router.get("/pro/bundles")
async def get_pro_bundles(current_user: dict = Depends(get_current_user)):
    """Get all bundles created by the pro"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    bundles = await db.pro_bundles.find(
        {"pro_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"success": True, "data": bundles}

@api_router.post("/pro/bundles")
async def create_bundle(
    bundle_data: BundleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new bundle"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    bundle = {
        "id": str(uuid.uuid4()),
        "pro_id": current_user["id"],
        "title": bundle_data.title,
        "description": bundle_data.description,
        "items": bundle_data.items,
        "bundle_price": bundle_data.bundle_price,
        "original_price": bundle_data.original_price,
        "discount_percentage": bundle_data.discount_percentage,
        "thumbnail_url": bundle_data.thumbnail_url,
        "is_limited": bundle_data.is_limited,
        "limited_quantity": bundle_data.limited_quantity,
        "available_until": bundle_data.available_until,
        "is_published": bundle_data.is_published,
        "sold_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pro_bundles.insert_one(bundle)
    bundle.pop("_id", None)
    
    return {"success": True, "data": bundle}

@api_router.delete("/pro/bundles/{bundle_id}")
async def delete_bundle(bundle_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a bundle"""
    if not current_user.get("is_professional"):
        raise HTTPException(status_code=403, detail="Reserved for professionals")
    
    result = await db.pro_bundles.delete_one(
        {"id": bundle_id, "pro_id": current_user["id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bundle not found")
    
    return {"success": True, "message": "Bundle supprimé"}


# --- PUBLIC MENTORS DIRECTORY ---

@api_router.get("/mentors")
async def get_mentors(
    specialty: Optional[str] = None,
    sort_by: str = "rating",
    limit: int = 50
):
    """Get all verified mentors with their profiles and offers"""
    # Find all professional users (exclude apple review accounts)
    query = {"is_professional": True, "is_apple_review": {"$ne": True}}
    pros = await db.users.find(query, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1, "pro_badge": 1, "created_at": 1}).to_list(limit)
    
    mentors = []
    for pro in pros:
        profile = await db.pro_profiles.find_one({"user_id": pro["id"]}, {"_id": 0})
        if not profile:
            continue
        
        if specialty and profile.get("expertise_area", "").lower() != specialty.lower():
            continue
        
        # Get published offers count and list
        offers = await db.pro_offers.find(
            {"pro_id": pro["id"], "is_published": True},
            {"_id": 0, "id": 1, "title": 1, "price": 1, "offer_type": 1, "category": 1, "cover_image": 1}
        ).to_list(10)
        
        # Get reviews
        reviews = await db.pro_reviews.find(
            {"pro_id": pro["id"]},
            {"_id": 0, "rating": 1}
        ).to_list(100)
        avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews) if reviews else profile.get("rating", 4.5)
        
        mentors.append({
            "id": pro["id"],
            "name": pro.get("name", "Mentor"),
            "avatar_url": pro.get("avatar_url"),
            "badge": pro.get("pro_badge", "verified"),
            "display_name": profile.get("display_name", pro.get("name", "")),
            "bio": profile.get("bio", ""),
            "expertise_area": profile.get("expertise_area", "Trading"),
            "specialties": profile.get("specialties", []),
            "rating": round(avg_rating, 1),
            "total_reviews": len(reviews),
            "total_offers": len(offers),
            "offers": offers,
            "years_experience": profile.get("years_experience", 0),
            "students_count": profile.get("students_count", 0),
            "is_featured": profile.get("is_featured", False),
        })
    
    # Get followers count for each mentor
    for m in mentors:
        m["followers_count"] = await db.mentor_follows.count_documents({"mentor_id": m["id"]})
    
    # Sort mentors
    if sort_by == "rating":
        mentors.sort(key=lambda x: x["rating"], reverse=True)
    elif sort_by == "offers":
        mentors.sort(key=lambda x: x["total_offers"], reverse=True)
    elif sort_by == "reviews":
        mentors.sort(key=lambda x: x["total_reviews"], reverse=True)
    
    # Get unique specialties for filters
    specialties = list(set(m["expertise_area"] for m in mentors if m.get("expertise_area")))
    
    return {
        "success": True,
        "data": mentors,
        "filters": {"specialties": specialties},
        "total": len(mentors)
    }

@api_router.get("/mentors/{mentor_id}")
async def get_mentor_profile(mentor_id: str):
    """Get a single mentor's full public profile"""
    user = await db.users.find_one({"id": mentor_id, "is_professional": True}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    profile = await db.pro_profiles.find_one({"user_id": mentor_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    offers = await db.pro_offers.find(
        {"pro_id": mentor_id, "is_published": True}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    reviews = await db.pro_reviews.find(
        {"pro_id": mentor_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews) if reviews else profile.get("rating", 4.5)
    
    return {
        "success": True,
        "data": {
            "id": user["id"],
            "name": user.get("name", "Mentor"),
            "avatar_url": user.get("avatar_url"),
            "badge": user.get("pro_badge", "verified"),
            "display_name": profile.get("display_name", user.get("name", "")),
            "bio": profile.get("bio", ""),
            "expertise_area": profile.get("expertise_area", ""),
            "specialties": profile.get("specialties", []),
            "rating": round(avg_rating, 1),
            "total_reviews": len(reviews),
            "offers": offers,
            "reviews": reviews[:5],
            "years_experience": profile.get("years_experience", 0),
            "students_count": profile.get("students_count", 0),
            "social_links": profile.get("social_links", {}),
        }
    }



# --- MENTOR FOLLOW SYSTEM ---

@api_router.post("/mentors/{mentor_id}/follow")
async def follow_mentor(mentor_id: str, current_user: dict = Depends(get_current_user)):
    """Follow a mentor"""
    if mentor_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")
    
    mentor = await db.users.find_one({"id": mentor_id, "is_professional": True})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    existing = await db.mentor_follows.find_one({
        "follower_id": current_user["id"],
        "mentor_id": mentor_id
    })
    if existing:
        return {"success": True, "message": "Already following", "is_following": True}
    
    await db.mentor_follows.insert_one({
        "follower_id": current_user["id"],
        "mentor_id": mentor_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    followers_count = await db.mentor_follows.count_documents({"mentor_id": mentor_id})
    
    return {"success": True, "message": "Now following", "is_following": True, "followers_count": followers_count}

@api_router.delete("/mentors/{mentor_id}/follow")
async def unfollow_mentor(mentor_id: str, current_user: dict = Depends(get_current_user)):
    """Unfollow a mentor"""
    result = await db.mentor_follows.delete_one({
        "follower_id": current_user["id"],
        "mentor_id": mentor_id
    })
    
    followers_count = await db.mentor_follows.count_documents({"mentor_id": mentor_id})
    
    return {"success": True, "message": "Unfollowed", "is_following": False, "followers_count": followers_count}

@api_router.get("/mentors/{mentor_id}/follow-status")
async def get_follow_status(mentor_id: str, current_user: dict = Depends(get_current_user)):
    """Check if current user follows a mentor"""
    existing = await db.mentor_follows.find_one({
        "follower_id": current_user["id"],
        "mentor_id": mentor_id
    })
    followers_count = await db.mentor_follows.count_documents({"mentor_id": mentor_id})
    return {"is_following": existing is not None, "followers_count": followers_count}

@api_router.get("/mentors/following/list")
async def get_following_mentors(current_user: dict = Depends(get_current_user)):
    """Get list of mentors the current user follows"""
    follows = await db.mentor_follows.find(
        {"follower_id": current_user["id"]}, {"_id": 0, "mentor_id": 1}
    ).to_list(100)
    
    mentor_ids = [f["mentor_id"] for f in follows]
    mentors = []
    for mid in mentor_ids:
        user = await db.users.find_one({"id": mid}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1, "pro_badge": 1})
        if user:
            profile = await db.pro_profiles.find_one({"user_id": mid}, {"_id": 0})
            followers_count = await db.mentor_follows.count_documents({"mentor_id": mid})
            mentors.append({
                "id": user["id"],
                "name": user.get("name", ""),
                "avatar_url": user.get("avatar_url"),
                "badge": user.get("pro_badge", "verified"),
                "display_name": profile.get("display_name", user.get("name", "")) if profile else user.get("name", ""),
                "expertise_area": profile.get("expertise_area", "") if profile else "",
                "followers_count": followers_count,
            })
    
    return {"success": True, "data": mentors, "total": len(mentors)}



# --- SOCIAL PROFILE SYSTEM ---

@api_router.get("/users/{user_id}/profile")
async def get_user_public_profile(user_id: str, request: Request):
    """Get a user's public profile"""
    # Try to get current user from token (optional)
    current_user_id = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            current_user_id = payload.get("user_id")
        except:
            pass
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_public = user.get("is_profile_public", True)
    is_own = current_user_id == user_id
    
    if not is_public and not is_own:
        return {
            "success": True,
            "data": {
                "id": user["id"],
                "name": user.get("name", ""),
                "username": user.get("username", ""),
                "avatar_url": user.get("avatar_url"),
                "is_profile_public": False,
                "is_private": True,
            }
        }
    
    followers_count = await db.user_follows.count_documents({"following_id": user_id})
    following_count = await db.user_follows.count_documents({"follower_id": user_id})
    posts_count = await db.community_posts.count_documents({"author_id": user_id})
    
    is_following = False
    if current_user_id:
        existing = await db.user_follows.find_one({
            "follower_id": current_user_id,
            "following_id": user_id
        })
        is_following = existing is not None
    
    return {
        "success": True,
        "data": {
            "id": user["id"],
            "name": user.get("name", ""),
            "username": user.get("username", user.get("name", "")),
            "email": user.get("email", "") if is_own else None,
            "bio": user.get("bio", ""),
            "avatar_url": user.get("avatar_url"),
            "cover_url": user.get("cover_url"),
            "is_vip": user.get("is_vip", False),
            "is_professional": user.get("is_professional", False),
            "pro_badge": user.get("pro_badge"),
            "is_profile_public": user.get("is_profile_public", True),
            "role": user.get("role", "user"),
            "created_at": user.get("created_at"),
            "followers_count": followers_count,
            "following_count": following_count,
            "posts_count": posts_count,
            "is_following": is_following,
            "is_own": is_own or False,
        }
    }

@api_router.put("/users/me/profile")
async def update_my_profile(request: Request, current_user: dict = Depends(get_current_user)):
    """Update own profile"""
    data = await request.json()
    allowed_fields = ["bio", "username", "avatar_url", "cover_url", "is_profile_public"]
    update = {}
    for field in allowed_fields:
        if field in data:
            val = data[field]
            if field == "username" and val:
                existing = await db.users.find_one({"username": val, "id": {"$ne": current_user["id"]}})
                if existing:
                    raise HTTPException(status_code=400, detail="Username already taken")
                if len(val) < 3 or len(val) > 30:
                    raise HTTPException(status_code=400, detail="Username must be 3-30 characters")
            if field == "bio" and val and len(val) > 300:
                raise HTTPException(status_code=400, detail="Bio must be under 300 characters")
            update[field] = val
    
    if update:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update})
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "hashed_password": 0})
    return {"success": True, "data": {k: v for k, v in user.items() if k != "_id"}}

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Follow any user"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.user_follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    if existing:
        return {"success": True, "is_following": True}
    
    await db.user_follows.insert_one({
        "follower_id": current_user["id"],
        "following_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    followers_count = await db.user_follows.count_documents({"following_id": user_id})
    return {"success": True, "is_following": True, "followers_count": followers_count}

@api_router.delete("/users/{user_id}/follow")
async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unfollow a user"""
    await db.user_follows.delete_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    followers_count = await db.user_follows.count_documents({"following_id": user_id})
    return {"success": True, "is_following": False, "followers_count": followers_count}

@api_router.get("/users/{user_id}/followers")
async def get_user_followers(user_id: str, limit: int = 50):
    """Get a user's followers list"""
    follows = await db.user_follows.find(
        {"following_id": user_id}, {"_id": 0, "follower_id": 1}
    ).to_list(limit)
    
    users = []
    for f in follows:
        u = await db.users.find_one({"id": f["follower_id"]}, {"_id": 0, "id": 1, "name": 1, "username": 1, "avatar_url": 1, "bio": 1, "is_vip": 1, "is_professional": 1, "pro_badge": 1})
        if u:
            users.append(u)
    return {"success": True, "data": users, "total": len(users)}

@api_router.get("/users/{user_id}/following")
async def get_user_following(user_id: str, limit: int = 50):
    """Get list of users this user follows"""
    follows = await db.user_follows.find(
        {"follower_id": user_id}, {"_id": 0, "following_id": 1}
    ).to_list(limit)
    
    users = []
    for f in follows:
        u = await db.users.find_one({"id": f["following_id"]}, {"_id": 0, "id": 1, "name": 1, "username": 1, "avatar_url": 1, "bio": 1, "is_vip": 1, "is_professional": 1, "pro_badge": 1})
        if u:
            users.append(u)
    return {"success": True, "data": users, "total": len(users)}


# --- PUBLIC MARKETPLACE ---

@api_router.get("/marketplace/offers")
async def get_marketplace_offers(
    category: Optional[str] = None,
    offer_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: str = "created_at",
    limit: int = 20
):
    """Browse published offers in the marketplace"""
    query = {"is_published": True}
    
    if category:
        query["category"] = category
    if offer_type:
        query["offer_type"] = offer_type
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        if "price" in query:
            query["price"]["$lte"] = max_price
        else:
            query["price"] = {"$lte": max_price}
    
    offers = await db.pro_offers.find(query, {"_id": 0}).sort(sort_by, -1).to_list(limit)
    
    # Add pro info
    for offer in offers:
        pro = await db.pro_profiles.find_one({"user_id": offer["pro_id"]}, {"_id": 0})
        user = await db.users.find_one({"id": offer["pro_id"]}, {"_id": 0, "name": 1, "avatar_url": 1})
        offer["pro"] = {
            "name": user.get("name") if user else "Pro",
            "avatar_url": user.get("avatar_url") if user else None,
            "expertise_area": pro.get("expertise_area") if pro else None,
            "rating": pro.get("average_rating", pro.get("rating", 0)) if pro else 0,
            "total_reviews": pro.get("total_reviews", 0) if pro else 0,
            "bio": pro.get("bio", "") if pro else "",
            "badge": pro.get("badge_level", "") if pro else "",
            "display_name": pro.get("display_name", "") if pro else "",
        }
        offer["pro_name"] = user.get("name") if user else offer.get("pro_name", "Pro")
        offer["pro_avatar"] = user.get("avatar_url") if user else None
    
    return {"success": True, "data": offers}

@api_router.get("/marketplace/offers/{offer_id}")
async def get_marketplace_offer(offer_id: str, current_user: dict = Depends(get_optional_user)):
    """Get public offer details"""
    offer = await db.pro_offers.find_one(
        {"id": offer_id, "is_published": True},
        {"_id": 0}
    )
    
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Get pro info
    pro = await db.pro_profiles.find_one({"user_id": offer["pro_id"]}, {"_id": 0})
    user = await db.users.find_one({"id": offer["pro_id"]}, {"_id": 0, "name": 1, "avatar_url": 1})
    offer["pro"] = {
        "id": offer["pro_id"],
        "name": user.get("name") if user else "Pro",
        "avatar_url": user.get("avatar_url") if user else None,
        "bio": pro.get("bio") if pro else None,
        "expertise_area": pro.get("expertise_area") if pro else None,
        "rating": pro.get("average_rating", pro.get("rating", 0)) if pro else 0,
        "total_reviews": pro.get("total_reviews", 0) if pro else 0,
        "badge": pro.get("badge_level", "") if pro else "",
        "display_name": pro.get("display_name", "") if pro else "",
    }
    offer["pro_name"] = user.get("name") if user else offer.get("pro_name", "Pro")
    offer["pro_avatar"] = user.get("avatar_url") if user else None
    
    # Get included content info (without full content)
    if offer.get("included_content_ids"):
        contents = await db.content_library.find(
            {"id": {"$in": offer["included_content_ids"]}},
            {"_id": 0, "id": 1, "title": 1, "content_type": 1, "duration_minutes": 1, "is_premium": 1}
        ).to_list(100)
        offer["included_contents_preview"] = contents
    
    # Check if user already purchased
    if current_user:
        purchase = await db.offer_purchases.find_one({
            "offer_id": offer_id,
            "user_id": current_user["id"],
            "status": "completed"
        })
        offer["is_purchased"] = purchase is not None
    
    return {"success": True, "data": offer}

@api_router.post("/marketplace/offers/{offer_id}/purchase")
async def purchase_offer(
    offer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Purchase an offer (creates Stripe checkout)"""
    if not current_user.get("is_vip"):
        raise HTTPException(status_code=403, detail="Reserved for VIP members")
    
    offer = await db.pro_offers.find_one({"id": offer_id, "is_published": True}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Check if already purchased
    existing = await db.offer_purchases.find_one({
        "offer_id": offer_id,
        "user_id": current_user["id"],
        "status": "completed"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already purchased this offer")
    
    # Calculate price
    price = offer.get("discount_price") or offer["price"]
    
    # Create purchase record
    purchase = {
        "id": str(uuid.uuid4()),
        "offer_id": offer_id,
        "user_id": current_user["id"],
        "pro_id": offer["pro_id"],
        "amount": price,
        "amount_paid": 0,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.offer_purchases.insert_one(purchase)
    
    # Create Stripe checkout
    try:
        stripe_key = os.environ.get('STRIPE_API_KEY') or os.environ.get('STRIPE_SECRET_KEY')
        if not stripe_key:
            raise HTTPException(status_code=500, detail="Configuration Stripe manquante")
        
        frontend_url = os.environ.get('FRONTEND_URL', 'https://academy-preview-11.preview.emergentagent.com')
        
        checkout = StripeCheckout(api_key=stripe_key)
        session = await checkout.create_checkout_session(
            CheckoutSessionRequest(
                amount=float(price),
                currency="usd",
                success_url=f"{frontend_url}/marketplace/success?session_id={{CHECKOUT_SESSION_ID}}&purchase_id={purchase['id']}",
                cancel_url=f"{frontend_url}/marketplace",
                metadata={
                    "purchase_id": purchase["id"],
                    "offer_id": offer_id,
                    "offer_title": offer["title"],
                    "user_id": current_user["id"]
                }
            )
        )
        
        await db.offer_purchases.update_one(
            {"id": purchase["id"]},
            {"$set": {"stripe_session_id": session.session_id}}
        )
        
        return {"success": True, "checkout_url": session.url, "purchase_id": purchase["id"]}
    
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Erreur de paiement")

@api_router.get("/marketplace/purchases")
async def get_user_purchases(current_user: dict = Depends(get_current_user)):
    """Get all purchases made by the user"""
    purchases = await db.offer_purchases.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with offer info
    for purchase in purchases:
        offer = await db.pro_offers.find_one({"id": purchase["offer_id"]}, {"_id": 0, "title": 1, "thumbnail_url": 1, "offer_type": 1})
        purchase["offer"] = offer
    
    return {"success": True, "data": purchases}

@api_router.get("/marketplace/purchases/{purchase_id}/access")
async def get_purchase_access(purchase_id: str, current_user: dict = Depends(get_current_user)):
    """Get access to purchased content"""
    purchase = await db.offer_purchases.find_one({
        "id": purchase_id,
        "user_id": current_user["id"],
        "status": "completed"
    }, {"_id": 0})
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found or not completed")
    
    offer = await db.pro_offers.find_one({"id": purchase["offer_id"]}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Check access duration
    if offer.get("access_duration_days"):
        purchase_date = datetime.fromisoformat(purchase["created_at"].replace("Z", "+00:00"))
        expiry_date = purchase_date + timedelta(days=offer["access_duration_days"])
        if datetime.now(timezone.utc) > expiry_date:
            raise HTTPException(status_code=403, detail="Access expired")
    
    # Get full content
    access_data = {
        "offer": offer,
        "contents": [],
        "services": [],
        "courses": []
    }
    
    # Get included contents with availability check
    if offer.get("included_content_ids"):
        contents = await db.content_library.find(
            {"id": {"$in": offer["included_content_ids"]}},
            {"_id": 0}
        ).to_list(100)
        
        # Add availability status to each content
        now = datetime.now(timezone.utc)
        for content in contents:
            available_from = content.get("available_from")
            if available_from:
                try:
                    # Parse the ISO datetime string
                    if isinstance(available_from, str):
                        available_datetime = datetime.fromisoformat(available_from.replace('Z', '+00:00'))
                    else:
                        available_datetime = available_from
                    content["is_available"] = now >= available_datetime
                except:
                    content["is_available"] = True
            else:
                content["is_available"] = True
        
        access_data["contents"] = contents
    
    # Get included services
    if offer.get("included_service_ids"):
        services = await db.pro_services.find(
            {"id": {"$in": offer["included_service_ids"]}},
            {"_id": 0}
        ).to_list(50)
        access_data["services"] = services
    
    # Get included courses
    if offer.get("included_course_ids"):
        courses = await db.pro_courses.find(
            {"id": {"$in": offer["included_course_ids"]}},
            {"_id": 0}
        ).to_list(50)
        access_data["courses"] = courses
    
    return {"success": True, "data": access_data}


@api_router.post("/marketplace/confirm-purchase/{purchase_id}")
async def confirm_marketplace_purchase(purchase_id: str, current_user: dict = Depends(get_current_user)):
    """Confirm purchase after Stripe payment success and send email with meeting links"""
    
    purchase = await db.offer_purchases.find_one({
        "id": purchase_id,
        "user_id": current_user["id"]
    }, {"_id": 0})
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    if purchase.get("status") == "completed":
        return {"success": True, "message": "Achat déjà confirmé", "already_confirmed": True}
    
    # Update purchase status
    await db.offer_purchases.update_one(
        {"id": purchase_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get offer details
    offer = await db.pro_offers.find_one({"id": purchase["offer_id"]}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Collect meeting links from included contents (session type)
    meeting_links = []
    
    if offer.get("included_content_ids"):
        session_contents = await db.content_library.find({
            "id": {"$in": offer["included_content_ids"]},
            "content_type": {"$in": ["session", "live"]}
        }, {"_id": 0}).to_list(50)
        
        for content in session_contents:
            content_data = content.get("content_data", {})
            meeting_link = content_data.get("meeting_link") or content_data.get("zoom_link") or content_data.get("meet_link")
            if meeting_link:
                meeting_links.append({
                    "title": content.get("title", "Session Live"),
                    "meeting_link": meeting_link,
                    "session_type": content_data.get("session_type", "live")
                })
    
    # Also check if included services have meeting links
    if offer.get("included_service_ids"):
        services = await db.pro_services.find({
            "id": {"$in": offer["included_service_ids"]},
            "meeting_link": {"$exists": True, "$ne": ""}
        }, {"_id": 0}).to_list(50)
        
        for service in services:
            if service.get("meeting_link"):
                meeting_links.append({
                    "title": service.get("name", "Service"),
                    "meeting_link": service["meeting_link"],
                    "session_type": service.get("category", "session")
                })
    
    # Send email with meeting links if any
    email_sent = False
    if meeting_links:
        email_sent = await send_session_access_email(
            user_email=current_user["email"],
            user_name=current_user.get("name", "Membre VIP"),
            offer_title=offer.get("title", "Votre achat"),
            meeting_links=meeting_links,
            purchase_id=purchase_id
        )
    
    # Update pro stats - include both total_revenue AND total_earnings/available_earnings
    purchase_amount = purchase.get("amount", 0)
    platform_fee = round(purchase_amount * 0.1, 2)  # 10% platform fee
    pro_earnings = round(purchase_amount - platform_fee, 2)
    
    await db.pro_profiles.update_one(
        {"user_id": offer["pro_id"]},
        {"$inc": {
            "total_sales": 1, 
            "total_revenue": purchase_amount,
            "total_earnings": pro_earnings,
            "available_earnings": pro_earnings,
            "total_sessions": 1
        }}
    )
    
    # Update the purchase record with earnings info
    await db.offer_purchases.update_one(
        {"id": purchase_id},
        {"$set": {
            "amount_paid": purchase_amount,
            "platform_fee": platform_fee,
            "pro_earnings": pro_earnings
        }}
    )
    
    # Update offer stats
    await db.pro_offers.update_one(
        {"id": offer["id"]},
        {"$inc": {"total_sales": 1, "total_revenue": purchase_amount}}
    )
    
    # Send real-time notification to the mentor
    buyer_name = current_user.get("name", "Un membre VIP")
    offer_title = offer.get("title", "une offre")
    
    # Store notification in DB + push
    notification_body = f"{buyer_name} a acheté '{offer_title}' pour ${purchase_amount}"
    notification_id = str(uuid.uuid4())
    await db.notifications.insert_one({
        "id": notification_id,
        "user_id": offer["pro_id"],
        "title": "Nouvelle vente !",
        "body": notification_body,
        "type": "new_sale",
        "data": {
            "purchase_id": purchase_id,
            "offer_id": offer["id"],
            "amount": purchase_amount,
            "pro_earnings": pro_earnings,
            "buyer_name": buyer_name
        },
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send WebSocket notification if mentor is connected
    if offer["pro_id"] in connected_users:
        socket_id = connected_users[offer["pro_id"]]
        await sio.emit('notification', {
            'type': 'new_sale',
            'data': {
                'title': 'Nouvelle vente !',
                'body': notification_body,
                'purchase_id': purchase_id,
                'offer_id': offer["id"],
                'amount': purchase_amount,
                'pro_earnings': pro_earnings,
                'buyer_name': buyer_name,
                'offer_title': offer_title
            },
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=socket_id)
        logger.info(f"Sale notification sent to mentor {offer['pro_id']}")
    
    return {
        "success": True,
        "message": "Achat confirmé avec succès",
        "email_sent": email_sent,
        "has_meeting_links": len(meeting_links) > 0,
        "meeting_links_count": len(meeting_links)
    }



# ============= CONTENT TRANSLATION =============

class TranslateRequest(BaseModel):
    texts: dict
    target_lang: str
    source_lang: str = "fr"

@api_router.post("/translate")
async def translate_content(request: TranslateRequest):
    """Translate mentor content to target language using AI with MongoDB cache"""
    if request.target_lang == request.source_lang:
        return {"success": True, "data": request.texts}
    
    if request.target_lang not in ["en", "es", "fr"]:
        return {"success": False, "error": "Unsupported language"}
    
    results = {}
    texts_to_translate = {}
    
    for key, text in request.texts.items():
        if not text or not text.strip():
            results[key] = text
            continue
        
        cache_key = f"{hash(text)}_{request.target_lang}"
        cached = await db.translation_cache.find_one(
            {"cache_key": cache_key},
            {"_id": 0}
        )
        if cached:
            results[key] = cached["translated_text"]
        else:
            texts_to_translate[key] = text
    
    if not texts_to_translate:
        return {"success": True, "data": results}
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return {"success": True, "data": {**results, **texts_to_translate}}
        
        lang_names = {"en": "English", "es": "Spanish", "fr": "French"}
        target_name = lang_names.get(request.target_lang, request.target_lang)
        
        text_entries = []
        for k, v in texts_to_translate.items():
            escaped = v.replace('"', '\\"').replace('\n', '\\n')
            text_entries.append(f'"{k}": "{escaped}"')
        texts_json = "{\n" + ",\n".join(text_entries) + "\n}"
        
        prompt = f"""Translate the following JSON values from French to {target_name}. 
Keep the keys exactly the same. Return ONLY valid JSON with translated values. Do not add any explanation.

{texts_json}"""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message="You are a professional translator. Translate content accurately while maintaining the original tone and meaning. Return only valid JSON."
        ).with_model("openai", "gpt-4o")
        
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response if isinstance(response, str) else response.text
        response_text = response_text.strip()
        logger.info(f"Translation LLM response: {response_text[:200]}")
        
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
        
        import json
        translated = json.loads(response_text)
        logger.info(f"Parsed translation: {translated}")
        
        for key, original_text in texts_to_translate.items():
            translated_text = translated.get(key, original_text)
            results[key] = translated_text
            
            cache_key = f"{hash(original_text)}_{request.target_lang}"
            await db.translation_cache.update_one(
                {"cache_key": cache_key},
                {"$set": {
                    "cache_key": cache_key,
                    "original_text": original_text,
                    "translated_text": translated_text,
                    "target_lang": request.target_lang,
                    "created_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
        
        return {"success": True, "data": results}
    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        for key, text in texts_to_translate.items():
            results[key] = text
        return {"success": True, "data": results}


# ============================================
# FEEDBACK / TESTIMONIALS
# ============================================

class FeedbackRequest(BaseModel):
    type: str  # 'improvement', 'bug', 'testimonial', 'feature'
    message: str
    rating: Optional[int] = None

@api_router.post("/feedback")
async def submit_feedback(req: FeedbackRequest, user: dict = Depends(get_current_user)):
    """Submit feedback, bug report, or testimonial"""
    feedback_doc = {
        "id": str(uuid.uuid4()),
        "type": req.type,
        "message": req.message,
        "rating": req.rating,
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "status": "new",
        "replies": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feedback.insert_one(feedback_doc)
    
    # Notify all admins and super_admins
    type_labels = {"testimonial": "Testimonial", "improvement": "Improvement", "bug": "Bug Report", "feature": "Feature Request"}
    type_label = type_labels.get(req.type, req.type)
    notification_body = f"New feedback ({type_label}) from {user.get('name', 'User')}: {req.message[:80]}{'...' if len(req.message) > 80 else ''}"
    
    admins = await db.users.find(
        {"role": {"$in": ["admin", "super_admin"]}},
        {"_id": 0, "id": 1}
    ).to_list(50)
    
    # Also notify super admin by email
    super_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"_id": 0, "id": 1})
    admin_ids = set(a["id"] for a in admins)
    if super_admin:
        admin_ids.add(super_admin["id"])
    
    for admin_id in admin_ids:
        if admin_id != user.get("id"):
            await send_notification_to_user(
                admin_id,
                notification_body,
                "feedback",
                {"feedback_id": feedback_doc["id"], "type": req.type},
                "New Feedback"
            )
    
    return {"status": "success", "message": "Feedback submitted"}

@api_router.get("/my-feedback")
async def get_my_feedback(user: dict = Depends(get_current_user)):
    """Get current user's feedback with admin replies"""
    feedbacks = await db.feedback.find(
        {"user_id": user.get("id")},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"success": True, "data": feedbacks}

@api_router.get("/admin/feedback")
async def get_admin_feedback(
    status: Optional[str] = None,
    feedback_type: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get all feedback (admin only)"""
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    if feedback_type:
        query["type"] = feedback_type
    
    feedbacks = await db.feedback.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Count by status
    total = await db.feedback.count_documents({})
    new_count = await db.feedback.count_documents({"status": "new"})
    
    return {
        "success": True,
        "data": feedbacks,
        "total": total,
        "new_count": new_count,
    }

@api_router.patch("/admin/feedback/{feedback_id}")
async def update_feedback_status(
    feedback_id: str,
    user: dict = Depends(get_current_user)
):
    """Mark feedback as read/archived (admin only)"""
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    feedback = await db.feedback.find_one({"id": feedback_id})
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    new_status = "read" if feedback.get("status") == "new" else "archived"
    await db.feedback.update_one(
        {"id": feedback_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat(), "reviewed_by": user.get("name")}}
    )
    return {"success": True, "new_status": new_status}

class AdminReplyRequest(BaseModel):
    message: str

@api_router.post("/admin/feedback/{feedback_id}/reply")
async def reply_to_feedback(
    feedback_id: str,
    req: AdminReplyRequest,
    user: dict = Depends(get_current_user)
):
    """Admin reply to a feedback"""
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    feedback = await db.feedback.find_one({"id": feedback_id})
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    reply = {
        "id": str(uuid.uuid4()),
        "message": req.message,
        "admin_id": user.get("id"),
        "admin_name": user.get("name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.feedback.update_one(
        {"id": feedback_id},
        {
            "$push": {"replies": reply},
            "$set": {"status": "read", "updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Notify the feedback author
    if feedback.get("user_id"):
        await send_notification_to_user(
            feedback["user_id"],
            f"Admin replied to your feedback: {req.message[:80]}{'...' if len(req.message) > 80 else ''}",
            "feedback_reply",
            {"feedback_id": feedback_id},
            "Feedback Reply"
        )
    
    return {"success": True, "reply": reply}

@api_router.delete("/admin/feedback/{feedback_id}")
async def delete_feedback(
    feedback_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete a feedback (admin only)"""
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.feedback.delete_one({"id": feedback_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    return {"success": True}


# ============================================
# INFLUENCER / AFFILIATE SYSTEM
# ============================================

import stripe as stripe_lib
stripe_lib.api_key = STRIPE_API_KEY

DEFAULT_COMMISSION_RATE = 0.20  # 20%

class CreateInfluencerRequest(BaseModel):
    name: str
    email: str
    commission_rate: Optional[float] = None

class UpdateInfluencerRequest(BaseModel):
    name: Optional[str] = None
    commission_rate: Optional[float] = None
    status: Optional[str] = None

class PayoutRequest(BaseModel):
    amount: Optional[float] = None  # If None, payout all pending

# --- Helper: generate unique affiliate code ---
def generate_affiliate_code(name: str) -> str:
    import random, string
    slug = name.lower().replace(" ", "").replace("-", "")[:8]
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{slug}{suffix}"

# --- Admin: Create influencer ---
@api_router.post("/influencers")
async def create_influencer(req: CreateInfluencerRequest, admin: dict = Depends(get_admin_user)):
    # Check if already exists
    existing = await db.influencers.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="An influencer with this email already exists")
    
    # Check if user account exists and is a mentor
    user = await db.users.find_one({"email": req.email})
    if not user:
        raise HTTPException(status_code=400, detail="No user account found with this email")
    if not user.get("is_professional"):
        raise HTTPException(status_code=400, detail="User must be an approved mentor to become an influencer")
    
    code = generate_affiliate_code(req.name)
    # Ensure unique code
    while await db.influencers.find_one({"code": code}):
        code = generate_affiliate_code(req.name)
    
    influencer = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": req.name,
        "email": req.email,
        "code": code,
        "commission_rate": req.commission_rate or DEFAULT_COMMISSION_RATE,
        "stripe_account_id": None,
        "status": "active",
        "clicks": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.influencers.insert_one(influencer)
    
    # Add influencer flag on user (keeps pro role)
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_influencer": True}})
    
    influencer.pop("_id", None)
    return {"success": True, "influencer": influencer}

# --- Admin: List all influencers with stats ---
@api_router.get("/admin/influencers")
async def list_influencers(admin: dict = Depends(get_admin_user)):
    influencers = await db.influencers.find({}, {"_id": 0}).to_list(200)
    
    for inf in influencers:
        conversions = await db.conversions.find({"influencer_id": inf["id"]}, {"_id": 0}).to_list(1000)
        total_conversions = len(conversions)
        total_revenue = sum(c.get("subscription_amount", 0) for c in conversions)
        total_commission = sum(c.get("commission", 0) for c in conversions)
        paid_commission = sum(c.get("commission", 0) for c in conversions if c.get("status") == "paid")
        pending_commission = total_commission - paid_commission
        
        inf["stats"] = {
            "clicks": inf.get("clicks", 0),
            "conversions": total_conversions,
            "conversion_rate": round((total_conversions / inf["clicks"] * 100), 1) if inf.get("clicks", 0) > 0 else 0,
            "total_revenue": round(total_revenue, 2),
            "total_commission": round(total_commission, 2),
            "paid_commission": round(paid_commission, 2),
            "pending_commission": round(pending_commission, 2)
        }
    
    return {"success": True, "influencers": influencers}

# --- Admin: Update influencer ---
@api_router.put("/influencers/{influencer_id}")
async def update_influencer(influencer_id: str, req: UpdateInfluencerRequest, admin: dict = Depends(get_admin_user)):
    update_data = {}
    if req.name is not None:
        update_data["name"] = req.name
    if req.commission_rate is not None:
        update_data["commission_rate"] = req.commission_rate
    if req.status is not None:
        update_data["status"] = req.status
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    
    result = await db.influencers.update_one({"id": influencer_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    updated = await db.influencers.find_one({"id": influencer_id}, {"_id": 0})
    return {"success": True, "influencer": updated}

# --- Track affiliate click ---
@api_router.post("/affiliate/click")
async def track_affiliate_click(request: Request):
    body = await request.json()
    code = body.get("code", "").strip()
    if not code:
        return {"success": False}
    
    result = await db.influencers.update_one({"code": code, "status": "active"}, {"$inc": {"clicks": 1}})
    return {"success": result.matched_count > 0}

# --- Influencer: Get own stats ---
@api_router.get("/influencer/stats")
async def get_influencer_stats(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_influencer"):
        raise HTTPException(status_code=403, detail="You are not an affiliate influencer/mentor")
    
    influencer = await db.influencers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not influencer:
        raise HTTPException(status_code=404, detail="Profil influenceur introuvable")
    
    conversions = await db.conversions.find(
        {"influencer_id": influencer["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    payouts = await db.payouts.find(
        {"influencer_id": influencer["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_commission = sum(c.get("commission", 0) for c in conversions)
    paid_commission = sum(c.get("commission", 0) for c in conversions if c.get("status") == "paid")
    pending_commission = total_commission - paid_commission
    
    return {
        "success": True,
        "influencer": influencer,
        "stats": {
            "clicks": influencer.get("clicks", 0),
            "conversions": len(conversions),
            "conversion_rate": round((len(conversions) / influencer["clicks"] * 100), 1) if influencer.get("clicks", 0) > 0 else 0,
            "total_commission": round(total_commission, 2),
            "paid_commission": round(paid_commission, 2),
            "pending_commission": round(pending_commission, 2)
        },
        "conversions": conversions,
        "payouts": payouts
    }

# --- Influencer: Connect Stripe account ---
@api_router.post("/influencer/stripe/connect")
async def create_stripe_connect(request: Request, current_user: dict = Depends(get_current_user)):
    body = await request.json()
    return_url = body.get("return_url", "")
    
    influencer = await db.influencers.find_one({"user_id": current_user["id"]})
    if not influencer:
        raise HTTPException(status_code=404, detail="You are not an influencer")
    
    try:
        if influencer.get("stripe_account_id"):
            # Already has an account, create login link
            link = stripe_lib.AccountLink.create(
                account=influencer["stripe_account_id"],
                refresh_url=return_url,
                return_url=return_url,
                type="account_onboarding"
            )
            return {"success": True, "url": link.url}
        
        # Create new Stripe Connect Express account
        account = stripe_lib.Account.create(
            type="express",
            email=influencer["email"],
            metadata={"influencer_id": influencer["id"]}
        )
        
        await db.influencers.update_one(
            {"id": influencer["id"]},
            {"$set": {"stripe_account_id": account.id}}
        )
        
        link = stripe_lib.AccountLink.create(
            account=account.id,
            refresh_url=return_url,
            return_url=return_url,
            type="account_onboarding"
        )
        
        return {"success": True, "url": link.url, "account_id": account.id}
    except Exception as e:
        logger.error(f"Stripe Connect error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Influencer: Check Stripe account status ---
@api_router.get("/influencer/stripe/status")
async def get_stripe_connect_status(current_user: dict = Depends(get_current_user)):
    influencer = await db.influencers.find_one({"user_id": current_user["id"]})
    if not influencer:
        raise HTTPException(status_code=404, detail="You are not an influencer")
    
    if not influencer.get("stripe_account_id"):
        return {"success": True, "connected": False}
    
    try:
        account = stripe_lib.Account.retrieve(influencer["stripe_account_id"])
        return {
            "success": True,
            "connected": True,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
            "details_submitted": account.details_submitted
        }
    except Exception as e:
        return {"success": True, "connected": False, "error": str(e)}

# --- Admin: Trigger payout to influencer ---
@api_router.post("/influencers/{influencer_id}/payout")
async def trigger_payout(influencer_id: str, req: PayoutRequest, admin: dict = Depends(get_admin_user)):
    influencer = await db.influencers.find_one({"id": influencer_id}, {"_id": 0})
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    if not influencer.get("stripe_account_id"):
        raise HTTPException(status_code=400, detail="Influencer has not connected their Stripe account")
    
    # Calculate pending amount
    pending_conversions = await db.conversions.find(
        {"influencer_id": influencer_id, "status": "pending"}
    ).to_list(1000)
    
    pending_total = sum(c.get("commission", 0) for c in pending_conversions)
    
    payout_amount = req.amount if req.amount and req.amount <= pending_total else pending_total
    
    if payout_amount <= 0:
        raise HTTPException(status_code=400, detail="Aucun montant en attente de versement")
    
    try:
        # Create transfer to connected account
        transfer = stripe_lib.Transfer.create(
            amount=int(payout_amount * 100),  # cents
            currency="usd",
            destination=influencer["stripe_account_id"],
            metadata={"influencer_id": influencer_id}
        )
        
        # Record payout
        payout = {
            "id": str(uuid.uuid4()),
            "influencer_id": influencer_id,
            "amount": round(payout_amount, 2),
            "stripe_transfer_id": transfer.id,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payouts.insert_one(payout)
        
        # Mark conversions as paid
        conversion_ids = [c["_id"] for c in pending_conversions]
        if conversion_ids:
            await db.conversions.update_many(
                {"_id": {"$in": conversion_ids}},
                {"$set": {"status": "paid", "payout_id": payout["id"]}}
            )
        
        payout.pop("_id", None)
        return {"success": True, "payout": payout}
    except Exception as e:
        logger.error(f"Payout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Admin: Get all conversions ---
@api_router.get("/admin/conversions")
async def list_conversions(admin: dict = Depends(get_admin_user)):
    conversions = await db.conversions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"success": True, "conversions": conversions}

# Include the router in the main app
app.include_router(api_router)

# Include pre-registration router
from routes.preregister import preregister_router, set_db as set_preregister_db, start_scheduler as start_email_scheduler
set_preregister_db(db)
app.include_router(preregister_router)

# Include Atlas AI router
from routes.atlas import atlas_router
app.include_router(atlas_router)

# Include Glossary router
from routes.glossary import router as glossary_router
app.include_router(glossary_router, prefix="/api")

# Include Community router
from routes.community import router as community_router, set_community_deps
set_community_deps(db, get_current_user, send_notification_to_user, UPLOADS_DIR)
app.include_router(community_router, prefix="/api")

# Include Admin router
from routes.admin import router as admin_router, set_admin_deps
set_admin_deps(db)
app.include_router(admin_router, prefix="/api")



app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wrap FastAPI with Socket.IO ASGI app (MUST be after all middleware)
socket_app = socketio.ASGIApp(sio, app, socketio_path='/api/socket.io')

# ============================================
# SOCKET.IO EVENTS FOR REAL-TIME NOTIFICATIONS
# ============================================

# Store connected users
connected_users: Dict[str, str] = {}  # user_id -> socket_id

@sio.event
async def connect(sid, environ):
    logger.info(f"Socket connected: {sid}")

@sio.event
async def disconnect(sid):
    # Remove from connected users
    for user_id, socket_id in list(connected_users.items()):
        if socket_id == sid:
            del connected_users[user_id]
            logger.info(f"User {user_id} disconnected")
            break
    logger.info(f"Socket disconnected: {sid}")

@sio.event
async def authenticate(sid, data):
    """Authenticate socket connection with JWT token"""
    try:
        token = data.get('token', '')
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if user_id:
            connected_users[user_id] = sid
            await sio.emit('authenticated', {'success': True, 'user_id': user_id}, room=sid)
            logger.info(f"User {user_id} authenticated on socket {sid}")
        else:
            await sio.emit('authenticated', {'success': False, 'error': 'Invalid token'}, room=sid)
    except jwt.ExpiredSignatureError:
        await sio.emit('authenticated', {'success': False, 'error': 'Token expired'}, room=sid)
    except Exception as e:
        await sio.emit('authenticated', {'success': False, 'error': str(e)}, room=sid)


@app.on_event("startup")
async def seed_community_data():
    """Seed community with sample conversations if empty"""
    try:
        count = await db.social_posts.count_documents({})
        if count > 5:
            return  # Already has data
        
        import uuid as _uuid
        from datetime import timedelta as _td
        
        # Get existing users
        users = await db.users.find({"is_vip": True}, {"_id": 0, "id": 1, "name": 1}).to_list(10)
        if len(users) < 2:
            return
        
        user_ids = [u["id"] for u in users]
        user_names = {u["id"]: u["name"] for u in users}
        now = datetime.now(timezone.utc)
        
        posts = [
            {
                "id": str(_uuid.uuid4()), "author_id": user_ids[0],
                "content": "Just closed my $BTC long from $94,200. Target hit at $97,800 — that's a clean +3.8% move. The weekly close above the 21 EMA was the signal. If we hold above $96K this week, I'm looking at $102K next. What's your take?",
                "crypto_mentions": ["BTC"], "likes": 23, "comments_count": 3,
                "created_at": (now - _td(hours=2)).isoformat(), "has_image": False,
            },
            {
                "id": str(_uuid.uuid4()), "author_id": user_ids[1 % len(user_ids)],
                "content": "The $ETH staking yield just dropped to 3.1% APR. With the new EIP proposals, validators might see changes soon. I'm moving some capital to liquid staking with Lido. Thoughts on $ETH staking vs DeFi yield farming in this market?",
                "crypto_mentions": ["ETH"], "likes": 15, "comments_count": 2,
                "created_at": (now - _td(hours=5)).isoformat(), "has_image": False,
            },
            {
                "id": str(_uuid.uuid4()), "author_id": user_ids[2 % len(user_ids)],
                "content": "The $SOL ecosystem is on fire right now. TVL crossed $8B, Raydium volumes are surpassing Uniswap some days, and Jupiter just launched their new limit order feature. I've been accumulating since $120 and honestly not selling before $250. Who else is bullish on Solana?",
                "crypto_mentions": ["SOL"], "likes": 31, "comments_count": 4,
                "created_at": (now - _td(hours=8)).isoformat(), "has_image": False,
            },
            {
                "id": str(_uuid.uuid4()), "author_id": user_ids[0],
                "content": "A reminder for all: position sizing is everything. I see too many people going all-in on leveraged trades. My rule: never risk more than 2% of your portfolio on a single trade. Even with $BTC looking bullish, a 10% correction can wipe you out on 10x leverage. Stay disciplined.",
                "crypto_mentions": ["BTC"], "likes": 47, "comments_count": 3,
                "created_at": (now - _td(hours=12)).isoformat(), "has_image": False,
            },
            {
                "id": str(_uuid.uuid4()), "author_id": user_ids[3 % len(user_ids)],
                "content": "Is anyone watching $LINK and $AVAX? Both broke key resistance levels this week. $LINK at $18.50 feels like it wants to retest $22, and $AVAX reclaimed the 200-day MA. The altcoin season index is at 68 — we're getting close. What are your top altcoin picks right now?",
                "crypto_mentions": ["LINK", "AVAX", "ETH"], "likes": 19, "comments_count": 2,
                "created_at": (now - _td(hours=18)).isoformat(), "has_image": False,
            },
            {
                "id": str(_uuid.uuid4()), "author_id": user_ids[4 % len(user_ids)],
                "content": "Fed minutes just dropped — no rate cut until at least June. Markets initially dipped but $BTC recovered fast above $96K. This resilience is bullish. Traditional markets are starting to correlate less with crypto, which is a sign of maturation. Keep your eyes on the $BTC dominance chart.",
                "crypto_mentions": ["BTC"], "likes": 36, "comments_count": 3,
                "created_at": (now - _td(hours=24)).isoformat(), "has_image": False,
            },
        ]
        
        for post in posts:
            await db.social_posts.insert_one(post)
        
        # Add comments
        comments_templates = [
            (0, 1, "Nice trade! I missed the entry at $94K but caught the bounce at $95,500. The volume profile looks solid."),
            (0, 2, "What timeframe are you using for the 21 EMA? I'm seeing a divergence on the 4H RSI."),
            (0, 3, "$102K seems ambitious but the momentum is definitely there. On-chain data shows strong accumulation by whales."),
            (1, 0, "I've been using a mix of Lido + EigenLayer restaking. The combined yield is around 5.2%. Worth looking into."),
            (1, 2, "DeFi yields are tempting but the smart contract risk is real. I prefer the safety of native staking."),
            (2, 0, "Firedancer is going to be a game-changer for Solana's throughput. $SOL could legitimately compete with ETH."),
            (2, 1, "The Jupiter airdrop created incredible volume. Their DEX aggregation is best-in-class right now."),
            (2, 3, "I've been testing Raydium concentrated liquidity pools — the fees are insane compared to Uniswap V3."),
            (2, 4, "$250 by Q3 if the market stays bullish. The SOL/BTC pair is showing strength too."),
            (3, 1, "This is the best advice in this community. I learned the hard way during the 2022 crash."),
            (3, 4, "Completely agree. The 2% rule is golden. Would you recommend a stop-loss or mental stop for spot positions?"),
            (3, 2, "I use Kelly Criterion for sizing my trades — more aggressive but mathematically optimal if you have a real edge."),
            (4, 0, "LINK is my biggest altcoin position. The CCIP adoption is growing fast and tokenomics are improving with staking."),
            (4, 1, "AVAX subnets are quietly building some impressive infrastructure. The institutional interest is real."),
            (5, 0, "The BTC dominance chart is key. If it stays above 54%, altseason might be delayed. Any drop below 50% and alts will fly."),
            (5, 3, "The macro correlation thesis is evolving. Bitcoin ETF flows are creating a new price dynamic more independent from stocks."),
            (5, 2, "June rate cut would be massive for risk assets. I'm keeping dry powder ready for that catalyst."),
        ]
        
        for post_idx, author_idx, content in comments_templates:
            aid = user_ids[author_idx % len(user_ids)]
            await db.social_comments.insert_one({
                "id": str(_uuid.uuid4()),
                "post_id": posts[post_idx]["id"],
                "author_id": aid,
                "author_name": user_names.get(aid, "VIP User"),
                "content": content,
                "created_at": (now - _td(hours=post_idx + 1)).isoformat()
            })
        
        # Add likes
        for i, post in enumerate(posts):
            for j in range(min(len(user_ids), 4)):
                if user_ids[j] != post["author_id"]:
                    await db.social_likes.insert_one({
                        "id": str(_uuid.uuid4()),
                        "post_id": post["id"],
                        "user_id": user_ids[j],
                        "created_at": now.isoformat()
                    })
        
        logger.info(f"Seeded community with {len(posts)} posts and {len(comments_templates)} comments")
    except Exception as e:
        logger.error(f"Error seeding community: {e}")


@app.on_event("startup")
async def seed_public_community_data():
    """Seed public community with sample discussions if empty"""
    try:
        count = await db.community_posts.count_documents({})
        if count > 3:
            return
        
        import uuid as _uuid
        from datetime import timedelta as _td
        
        users = await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "is_vip": 1}).to_list(50)
        if len(users) < 6:
            return
        
        # Pick 6 users for community posts
        uids = [u["id"] for u in users[:6]]
        umap = {u["id"]: u["name"] for u in users}
        now = datetime.now(timezone.utc)
        
        posts = [
            {"id": str(_uuid.uuid4()), "title": "Beginner here - is it too late to invest in Bitcoin?", "content": "Hi everyone! I've been following crypto for a few months and I keep hearing that Bitcoin is expensive. With BTC above $95K, is it too late to start? I have a small budget (~$500). Should I go all-in on Bitcoin or diversify? Any advice for a complete beginner?", "category": "debutants", "image_url": None, "author_id": uids[5], "votes": 34, "likes": uids[:3], "created_at": (now - _td(hours=3)).isoformat(), "updated_at": (now - _td(hours=3)).isoformat(), "is_pinned": False},
            {"id": str(_uuid.uuid4()), "title": "My DCA strategy: 3 months in, here are my results", "content": "I started Dollar Cost Averaging $200/week split between BTC (60%) and ETH (40%) since December. My average BTC entry is $89,400 and ETH at $3,150. Currently up 12.8% overall. The key is consistency — I buy every Monday at 9am regardless of the price. No emotions, just the plan. Anyone else doing DCA?", "category": "trading", "image_url": None, "author_id": uids[0], "votes": 52, "likes": uids[1:5], "created_at": (now - _td(hours=8)).isoformat(), "updated_at": (now - _td(hours=8)).isoformat(), "is_pinned": False},
            {"id": str(_uuid.uuid4()), "title": "Warning: New phishing scam targeting MetaMask users", "content": "Heads up everyone! There's a new phishing campaign going around. You receive an email that looks exactly like MetaMask asking you to 'verify your wallet'. The link takes you to a fake site that steals your seed phrase. NEVER enter your seed phrase on any website. MetaMask will NEVER ask for it via email. Stay safe!", "category": "securite", "image_url": None, "author_id": uids[1], "votes": 78, "likes": [uids[0], uids[2], uids[3], uids[4], uids[5]], "created_at": (now - _td(hours=14)).isoformat(), "updated_at": (now - _td(hours=14)).isoformat(), "is_pinned": True},
            {"id": str(_uuid.uuid4()), "title": "ETH vs SOL for DeFi in 2026 - honest comparison", "content": "Ethereum: More mature, bigger TVL ($85B), higher fees ($2-5/tx), better security, EigenLayer restaking.\n\nSolana: Near-zero fees ($0.001), faster (400ms), growing fast (TVL $8B), Firedancer coming.\n\nMy take: ETH for large positions, SOL for active trading. Both belong in a balanced portfolio.", "category": "analyse", "image_url": None, "author_id": uids[2], "votes": 45, "likes": uids[:3], "created_at": (now - _td(hours=20)).isoformat(), "updated_at": (now - _td(hours=20)).isoformat(), "is_pinned": False},
            {"id": str(_uuid.uuid4()), "title": "Best hardware wallet in 2026? Ledger vs Trezor vs Keystone", "content": "I want to move my crypto to cold storage. Looking at:\n1. Ledger Nano X - popular but had data breach\n2. Trezor Model T - open source\n3. Keystone Pro - air-gapped, QR only\n\nI hold BTC, ETH, SOL and altcoins. Which supports the most chains? Budget: $150-200.", "category": "outils", "image_url": None, "author_id": uids[3], "votes": 29, "likes": uids[:3], "created_at": (now - _td(hours=28)).isoformat(), "updated_at": (now - _td(hours=28)).isoformat(), "is_pinned": False},
            {"id": str(_uuid.uuid4()), "title": "The Bitcoin halving effect - what history tells us", "content": "Post-2024 halving analysis:\n- 2012: $12 to $1,100 (+9000%)\n- 2016: $650 to $19,800 (+2900%)\n- 2020: $8,700 to $69,000 (+690%)\n- 2024: $64,000 to $97,000 (+51%) so far\n\nDiminishing returns but still significant. $150K-200K before end of 2026?", "category": "bitcoin-ethereum", "image_url": None, "author_id": uids[4], "votes": 61, "likes": [uids[0], uids[1], uids[2], uids[5]], "created_at": (now - _td(hours=36)).isoformat(), "updated_at": (now - _td(hours=36)).isoformat(), "is_pinned": False},
        ]
        
        for p in posts:
            await db.community_posts.insert_one(p)
        
        comments = [
            (0, 0, "It's never too late! Start with 70% BTC, 20% ETH, 10% cash for dips. Only invest what you can afford to lose."),
            (0, 1, "Welcome! The best time to invest was yesterday, the second best is today. Start small and learn."),
            (0, 2, "Set up a DCA instead of buying all at once. Many exchanges let you automate weekly buys."),
            (1, 1, "I'm doing 50% BTC / 30% ETH / 20% SOL. The SOL allocation has been outperforming. Overall +15%."),
            (1, 4, "DCA for 2 years here. Average cost way below market. Hardest part is staying consistent during bear markets."),
            (1, 3, "Monday morning buyer too! The Mentova portfolio tracker is really useful for tracking DCA performance."),
            (2, 0, "Almost clicked on a similar link last week. Rule #1: bookmark official sites and always access directly."),
            (2, 5, "NEVER share your seed phrase with anyone. Write it on paper, store safely. No photos, no cloud."),
            (2, 3, "Report phishing emails to phishing@metamask.io. The more reports, the faster they take down fake sites."),
            (3, 0, "ETH L2s (Arbitrum, Base) have sub-$0.10 fees now. That narrows the gap with Solana significantly."),
            (3, 1, "Firedancer is going to be huge. If it delivers 1M TPS, it'll attract institutional DeFi. I'm 60/40 ETH/SOL."),
            (3, 4, "Don't sleep on AVAX subnets either. For gaming and institutional DeFi, the subnet architecture is elegant."),
            (4, 0, "Ledger Nano X works great for BTC/ETH/SOL. The data breach was for emails, not crypto — device was never compromised."),
            (4, 2, "Trezor Model T all the way. Fully open source and auditable. Best value at $150."),
            (5, 1, "$150K by end of 2026 is my base case. ETF inflows are adding massive buy pressure. BlackRock holds $50B+ in BTC."),
            (5, 2, "Diminishing returns theory makes sense but the market keeps growing. Sovereign wealth funds are allocating now."),
            (5, 5, "Target $180K but taking 25% profit at $130K and 25% at $160K. Have a plan to take profits — don't be greedy."),
        ]
        
        for pi, ai, content in comments:
            aid = uids[ai]
            await db.community_comments.insert_one({
                "id": str(_uuid.uuid4()), "post_id": posts[pi]["id"],
                "author_id": aid, "author_name": umap.get(aid, "User"),
                "content": content, "created_at": (now - _td(hours=pi+1)).isoformat(), "likes": [], "votes": 0
            })
        
        logger.info(f"Seeded public community with {len(posts)} posts and {len(comments)} comments")
    except Exception as e:
        logger.error(f"Error seeding public community: {e}")


@app.on_event("startup")
async def migrate_seed_data():
    """Seed essential data if database is empty (e.g. fresh Atlas deployment)"""
    try:
        prereg_count = await db.pre_registrations.count_documents({})
        user_count = await db.users.count_documents({})
        if prereg_count > 0 and user_count > 0:
            logger.info(f"DB already has data ({prereg_count} pre-regs, {user_count} users). Skipping seed.")
            return

        logger.info("Empty database detected. Seeding essential data...")

        # Seed wave_config
        if await db.wave_config.count_documents({}) == 0:
            await db.wave_config.insert_one({"_id": "current", "wave": 1, "total_limit": 500, "wave2_active": False, "wave2_deadline": None})
            logger.info("Seeded wave_config")

        # Seed pre-registrations
        if prereg_count == 0:
            preregs = [
                {"email": "test-founder@example.com", "language": "FR", "founder_number": 1, "wave": 1, "referral_code": "MNT-4D7A7", "referred_by": None, "referral_count": 0, "free_months_earned": 0, "free_months_applied": False, "committed": True, "status": "pre_registered", "vip_price_locked": 9.99, "vip_price_lock_expires_at": "2026-09-09T00:00:00+00:00", "founding_member_badge": True, "vip_activated_at": None, "created_at": "2026-06-18T00:58:09.882763+00:00"},
                {"email": "newfounder@test.com", "language": "EN", "founder_number": 2, "wave": 1, "referral_code": "MNT-WUU23", "referred_by": None, "referral_count": 0, "free_months_earned": 0, "free_months_applied": False, "committed": True, "status": "pre_registered", "vip_price_locked": 9.99, "vip_price_lock_expires_at": "2026-09-09T00:00:00+00:00", "founding_member_badge": True, "vip_activated_at": None, "created_at": "2026-06-18T01:03:58.458409+00:00"},
                {"email": "founder-test@example.com", "language": "FR", "founder_number": 3, "wave": 1, "referral_code": "MNT-L33VC", "referred_by": None, "referral_count": 0, "free_months_earned": 0, "free_months_applied": False, "committed": True, "status": "pre_registered", "vip_price_locked": 9.99, "vip_price_lock_expires_at": "2026-09-09T00:00:00+00:00", "founding_member_badge": True, "vip_activated_at": None, "created_at": "2026-06-18T01:23:57.289867+00:00"},
                {"email": "test-email-verify@mentova-academy.com", "language": "EN", "founder_number": 4, "wave": 1, "referral_code": "MNT-QBRKQ", "referred_by": None, "referral_count": 0, "free_months_earned": 0, "free_months_applied": False, "committed": True, "status": "pre_registered", "vip_price_locked": 9.99, "vip_price_lock_expires_at": "2026-09-09T00:00:00+00:00", "founding_member_badge": True, "vip_activated_at": None, "created_at": "2026-06-18T01:43:09.858690+00:00"},
                {"email": "design-preview@mentova-academy.com", "language": "EN", "founder_number": 5, "wave": 1, "referral_code": "MNT-4EYNX", "referred_by": None, "referral_count": 0, "free_months_earned": 0, "free_months_applied": False, "committed": True, "status": "pre_registered", "vip_price_locked": 9.99, "vip_price_lock_expires_at": "2026-09-09T00:00:00+00:00", "founding_member_badge": True, "vip_activated_at": None, "created_at": "2026-06-18T02:00:43.037263+00:00"},
                {"email": "justin.curadeau.qc@hotmail.com", "language": "FR", "founder_number": 6, "wave": 1, "referral_code": "MNT-M8SQF", "referred_by": None, "referral_count": 1, "free_months_earned": 0, "free_months_applied": False, "committed": True, "status": "pre_registered", "vip_price_locked": 9.99, "vip_price_lock_expires_at": "2026-09-09T00:00:00+00:00", "founding_member_badge": True, "vip_activated_at": None, "created_at": "2026-06-18T03:41:31.121192+00:00"},
                {"email": "jcuradeau.7@hotmail.com", "language": "FR", "founder_number": 7, "wave": 1, "referral_code": "MNT-2B5OW", "referred_by": "MNT-M8SQF", "referral_count": 0, "free_months_earned": 0, "free_months_applied": False, "committed": True, "status": "pre_registered", "vip_price_locked": 9.99, "vip_price_lock_expires_at": "2026-09-09T00:00:00+00:00", "founding_member_badge": True, "vip_activated_at": None, "created_at": "2026-06-18T05:40:39.195814+00:00"},
            ]
            for doc in preregs:
                await db.pre_registrations.insert_one(doc)
            logger.info(f"Seeded {len(preregs)} pre_registrations")

        # Seed critical users (admin + apple review)
        if user_count == 0:
            critical_users = [
                {"id": "3022d23d-11a1-4fbb-849a-0cddb379d65f", "email": "jcuradeau.7@gmail.com", "name": "Mike price", "password_hash": "$2b$12$tu7z51MOvqBtRy6QyrGvNeKgplTAbru5SNGemL3xyLdAG1G8Brxou", "created_at": "2026-02-10T14:43:34.821000", "progress": {"modules_completed": [], "current_level": "advanced", "total_score": 280}, "community_score": 64, "role": "super_admin", "is_banned": False, "gamification_points": 385, "is_vip": True, "vip_expires_at": None, "is_professional": True, "pro_badge": "verified", "password": "$2b$12$PQNC4fCZeYznWj8WsuM4J.LvhWzLgFvepmtiivWeKU.ca26V639gu", "is_influencer": True, "vip_permanent": True},
                {"id": "ee1ba863-ece8-412a-8ac2-3e9b1d532747", "email": "applereview@mentova.com", "name": "Apple Reviewer", "password_hash": "$2b$12$LIK8zzg5KGtUY/4nCoQ5yet7MVNot3rnJS79dPy9RPzHXAdUbMSEa", "created_at": "2026-06-12T11:01:27.425000", "role": "user", "is_banned": False, "community_score": 0, "progress": {"modules_completed": [], "current_level": "beginner", "total_score": 0}, "is_apple_review": True},
            ]
            for doc in critical_users:
                existing = await db.users.find_one({"email": doc["email"]})
                if not existing:
                    await db.users.insert_one(doc)
                    logger.info(f"Seeded critical user: {doc['email']}")

        logger.info("Database seed complete!")
    except Exception as e:
        logger.error(f"Error during seed migration: {e}")


@app.on_event("startup")
async def start_email_scheduler_task():
    """Start the background email scheduler for launch day + reminder emails"""
    start_email_scheduler()

@app.on_event("startup")
async def start_coingecko_cache():
    """Start the CoinGecko global cache scheduler (1 call every 40s for all users)"""
    asyncio.create_task(_coingecko_scheduler())
    logger.info("CoinGecko cache scheduler started — refreshing every 40s")

@app.on_event("startup")
async def start_rss_news_cache():
    """Start the RSS news cache scheduler (refresh every 10 min)"""
    asyncio.create_task(_refresh_rss_cache())
    logger.info("RSS news cache scheduler started — refreshing every 10 min")




@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
