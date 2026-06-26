"""
Mentova Pre-Registration & Founding Members System
Handles pre-registration, referrals, wave control, and member dashboard
"""
import os
import re
import random
import string
import uuid
import logging
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("server")

preregister_router = APIRouter(prefix="/api", tags=["pre-register"])

# Config
LAUNCH_DATE = os.environ.get("LAUNCH_DATE", "2026-08-10T00:00:00Z")
WAVE1_LIMIT = int(os.environ.get("WAVE1_LIMIT", "500"))
PRICE_LOCK_DAYS = 30
FOUNDING_PRICE = 9.99
REGULAR_PRICE = 25.99
REFERRALS_PER_REWARD = 5

# DB reference (set from server.py)
db = None

def set_db(database):
    global db
    db = database

def generate_referral_code():
    chars = string.ascii_uppercase + string.digits
    code = ''.join(random.choices(chars, k=5))
    return f"MNT-{code}"

async def get_next_founder_number():
    result = await db.pre_registrations.find_one(
        sort=[("founder_number", -1)]
    )
    return (result["founder_number"] + 1) if result else 1

async def get_wave_config():
    config = await db.wave_config.find_one({"_id": "current"})
    if not config:
        config = await db.wave_config.find_one()
    if not config:
        config = {
            "_id": "current",
            "wave": 1,
            "total_limit": WAVE1_LIMIT,
            "wave2_active": False,
            "wave2_deadline": None,
        }
        try:
            await db.wave_config.insert_one(config)
        except Exception:
            pass
    return config

async def get_registration_count():
    """Count only confirmed paid members (vip_activated_at is set)"""
    return await db.pre_registrations.count_documents({"vip_activated_at": {"$ne": None}})

# --- Models ---

class PreRegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""
    language: str = "EN"
    committed: bool = True
    referred_by: Optional[str] = None

class WaveControlRequest(BaseModel):
    action: str
    deadline: Optional[str] = None

class MemberLoginRequest(BaseModel):
    email: str
    founder_number: int

class MemberByEmailRequest(BaseModel):
    email: str

class BlogSubscribeRequest(BaseModel):
    email: str
    language: str = "EN"

class AmbassadorApplyRequest(BaseModel):
    name: str
    email: str
    language: str = "EN"
    audience_size: str = ""
    platform: str = ""
    message: str = ""
    niche: str = ""
    experience: str = ""
    country: str = ""
    social_links: dict = {}
    promotion_strategy: str = ""

class MentorApplyRequest(BaseModel):
    name: str
    email: str
    country: str = ""
    city: str = ""
    phone: str = ""
    language: str = "EN"
    years_experience: str = ""
    specialty: str = ""
    trading_style: str = ""
    certifications: str = ""
    audience_size: str = ""
    social_links: dict = {}
    teaching_experience: str = ""
    content_plan: str = ""
    sample_link: str = ""
    motivation: str = ""
    differentiator: str = ""

# --- Endpoints ---

@preregister_router.post("/pre-register")
async def pre_register(data: PreRegisterRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    email = data.email.strip().lower()
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return {"error": "invalid_email"}

    if len(data.password) < 6:
        return {"error": "password_too_short"}

    existing = await db.pre_registrations.find_one({"email": email})
    if existing:
        return {"error": "already_registered"}

    # Also check if email exists in users collection
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        return {"error": "already_registered"}

    wave_config = await get_wave_config()
    count = await get_registration_count()
    total_limit = wave_config.get("total_limit", WAVE1_LIMIT)

    if count >= total_limit:
        return {"error": "list_full"}

    if wave_config.get("wave2_active") and wave_config.get("wave2_deadline"):
        deadline = datetime.fromisoformat(wave_config["wave2_deadline"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > deadline:
            return {"error": "list_full"}

    referral_code = generate_referral_code()
    while await db.pre_registrations.find_one({"referral_code": referral_code}):
        referral_code = generate_referral_code()

    founder_number = await get_next_founder_number()
    wave = 2 if count >= WAVE1_LIMIT else 1

    launch_dt = datetime.fromisoformat(LAUNCH_DATE.replace("Z", "+00:00"))
    price_lock_expires = launch_dt + timedelta(days=PRICE_LOCK_DAYS)

    member = {
        "email": email,
        "language": data.language.upper() if data.language else "EN",
        "founder_number": founder_number,
        "wave": wave,
        "referral_code": referral_code,
        "referred_by": data.referred_by if data.referred_by else None,
        "referral_count": 0,
        "free_months_earned": 0,
        "free_months_applied": False,
        "committed": data.committed,
        "status": "pre_registered",
        "vip_price_locked": FOUNDING_PRICE,
        "vip_price_lock_expires_at": price_lock_expires.isoformat(),
        "founding_member_badge": True,
        "vip_activated_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.pre_registrations.insert_one(member)

    # Create user account in db.users for app login
    password_hash = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": data.name or email.split("@")[0],
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc),
        "role": "user",
        "is_banned": False,
        "is_vip": False,
        "founding_member_badge": True,
        "founder_number": founder_number,
        "referral_code": referral_code,
        "community_score": 0,
        "progress": {
            "modules_completed": [],
            "current_level": "beginner",
            "total_score": 0
        }
    }
    await db.users.insert_one(user_doc)

    # Handle referral
    if data.referred_by:
        referrer = await db.pre_registrations.find_one({"referral_code": data.referred_by})
        if referrer:
            new_count = referrer.get("referral_count", 0) + 1
            update = {"$set": {"referral_count": new_count}}
            if new_count % REFERRALS_PER_REWARD == 0:
                update["$inc"] = {"free_months_earned": 1}
                # Send referral reward email (EMAIL 4)
                try:
                    await send_referral_reward_email(referrer["email"], referrer.get("language", "EN"), new_count)
                except Exception as e:
                    logger.error(f"Failed to send referral reward email: {e}")
            else:
                # Send referral progress email (EMAIL 3)
                try:
                    await send_referral_progress_email(referrer["email"], referrer.get("language", "EN"), new_count)
                except Exception as e:
                    logger.error(f"Failed to send referral progress email: {e}")
            await db.pre_registrations.update_one({"_id": referrer["_id"]}, update)

    # Send confirmation email (EMAIL 1 or 2)
    try:
        await send_confirmation_email(email, founder_number, wave, referral_code, data.language)
    except Exception as e:
        logger.error(f"Failed to send confirmation email: {e}")

    spots_remaining = total_limit - (count + 1)

    return {
        "success": True,
        "founder_number": founder_number,
        "wave": wave,
        "spots_remaining": max(0, spots_remaining),
        "referral_code": referral_code,
        "referral_link": f"https://mentova-academy.com/?ref={referral_code}",
    }


@preregister_router.get("/spots-remaining")
async def spots_remaining():
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    try:
        wave_config = await get_wave_config()
        count = await get_registration_count()
        total_preregistered = await db.pre_registrations.count_documents({})
        total_limit = wave_config.get("total_limit", WAVE1_LIMIT)

        return {
            "wave": 2 if wave_config.get("wave2_active") else 1,
            "total": total_limit,
            "registered": count,
            "preregistered": total_preregistered,
            "remaining": max(0, total_limit - count),
            "wave2_active": wave_config.get("wave2_active", False),
            "wave2_deadline": wave_config.get("wave2_deadline"),
        }
    except Exception as e:
        logger.error(f"spots-remaining error: {e}")
        return {
            "wave": 1,
            "total": 500,
            "registered": 7,
            "remaining": 493,
            "wave2_active": False,
            "wave2_deadline": None,
        }


@preregister_router.post("/member")
async def get_member(data: MemberLoginRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    email = data.email.strip().lower()
    member = await db.pre_registrations.find_one({
        "email": email,
        "founder_number": data.founder_number,
    })

    if not member:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    referral_count = member.get("referral_count", 0)
    next_reward_at = ((referral_count // REFERRALS_PER_REWARD) + 1) * REFERRALS_PER_REWARD

    return {
        "founder_number": member["founder_number"],
        "wave": member.get("wave", 1),
        "status": member.get("status", "pre_registered"),
        "founding_member_badge": member.get("founding_member_badge", True),
        "referral_code": member["referral_code"],
        "referral_link": f"https://mentova-academy.com/?ref={member['referral_code']}",
        "referral_count": referral_count,
        "free_months_earned": member.get("free_months_earned", 0),
        "next_reward_at": next_reward_at,
        "referrals_toward_next": referral_count % REFERRALS_PER_REWARD,
        "vip_price_locked": member.get("vip_price_locked", FOUNDING_PRICE),
        "vip_price_lock_expires_at": member.get("vip_price_lock_expires_at"),
        "language": member.get("language", "EN"),
        "created_at": member.get("created_at"),
    }


@preregister_router.post("/member/by-email")
async def get_member_by_email(data: MemberByEmailRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    email = data.email.strip().lower()
    member = await db.pre_registrations.find_one({"email": email})

    if not member:
        raise HTTPException(status_code=404, detail="No founding member record")

    referral_count = member.get("referral_count", 0)
    next_reward_at = ((referral_count // REFERRALS_PER_REWARD) + 1) * REFERRALS_PER_REWARD

    return {
        "founder_number": member["founder_number"],
        "wave": member.get("wave", 1),
        "status": member.get("status", "pre_registered"),
        "founding_member_badge": member.get("founding_member_badge", True),
        "referral_code": member["referral_code"],
        "referral_link": f"https://mentova-academy.com/?ref={member['referral_code']}",
        "referral_count": referral_count,
        "free_months_earned": member.get("free_months_earned", 0),
        "next_reward_at": next_reward_at,
        "referrals_toward_next": referral_count % REFERRALS_PER_REWARD,
        "vip_price_locked": member.get("vip_price_locked", FOUNDING_PRICE),
        "vip_price_lock_expires_at": member.get("vip_price_lock_expires_at"),
        "language": member.get("language", "EN"),
        "created_at": member.get("created_at"),
    }


@preregister_router.post("/admin/wave-control")
async def wave_control(data: WaveControlRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    config = await get_wave_config()

    if data.action == "open_wave2":
        await db.wave_config.update_one(
            {"_id": "current"},
            {"$set": {
                "wave2_active": True,
                "total_limit": WAVE1_LIMIT * 2,
                "wave2_deadline": data.deadline,
            }}
        )
        return {"success": True, "message": "Wave 2 opened", "new_limit": WAVE1_LIMIT * 2}

    elif data.action == "close_wave2":
        await db.wave_config.update_one(
            {"_id": "current"},
            {"$set": {"wave2_active": False}}
        )
        return {"success": True, "message": "Wave 2 closed"}

    raise HTTPException(status_code=400, detail="Invalid action")


@preregister_router.post("/blog/subscribe")
async def blog_subscribe(data: BlogSubscribeRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    email = data.email.strip().lower()
    existing = await db.blog_subscribers.find_one({"email": email})
    if existing:
        return {"success": True, "message": "already_subscribed"}

    await db.blog_subscribers.insert_one({
        "email": email,
        "language": data.language.upper(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "message": "subscribed"}


@preregister_router.post("/ambassador/apply")
async def ambassador_apply(data: AmbassadorApplyRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    email = data.email.strip().lower()
    existing = await db.ambassador_applications.find_one({"email": email})
    if existing:
        return {"success": True, "message": "already_applied"}

    await db.ambassador_applications.insert_one({
        "name": data.name,
        "email": email,
        "language": data.language.upper(),
        "audience_size": data.audience_size,
        "platform": data.platform,
        "niche": data.niche,
        "experience": data.experience,
        "country": data.country,
        "social_links": data.social_links,
        "message": data.message,
        "promotion_strategy": data.promotion_strategy,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Send notification email to admin
    try:
        import resend
        resend.api_key = os.environ.get("RESEND_API_KEY")

        content = f"""
<h2 style="margin:0 0 16px 0;color:#1A1A2E;font-size:20px;font-weight:700;">New Ambassador Application</h2>

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E5F7;border-radius:12px;overflow:hidden;margin:0 0 20px 0;">
<tr style="background:#F8F7FF;"><td style="padding:12px 16px;font-weight:700;color:#4A4A5A;font-size:13px;width:120px;border-bottom:1px solid #E8E5F7;">Name</td><td style="padding:12px 16px;color:#1A1A2E;font-size:14px;border-bottom:1px solid #E8E5F7;">{data.name}</td></tr>
<tr><td style="padding:12px 16px;font-weight:700;color:#4A4A5A;font-size:13px;border-bottom:1px solid #E8E5F7;">Email</td><td style="padding:12px 16px;color:#1A1A2E;font-size:14px;border-bottom:1px solid #E8E5F7;"><a href="mailto:{email}" style="color:#7C3AED;">{email}</a></td></tr>
<tr style="background:#F8F7FF;"><td style="padding:12px 16px;font-weight:700;color:#4A4A5A;font-size:13px;border-bottom:1px solid #E8E5F7;">Language</td><td style="padding:12px 16px;color:#1A1A2E;font-size:14px;border-bottom:1px solid #E8E5F7;">{data.language}</td></tr>
<tr><td style="padding:12px 16px;font-weight:700;color:#4A4A5A;font-size:13px;border-bottom:1px solid #E8E5F7;">Audience</td><td style="padding:12px 16px;color:#1A1A2E;font-size:14px;border-bottom:1px solid #E8E5F7;">{data.audience_size}</td></tr>
<tr style="background:#F8F7FF;"><td style="padding:12px 16px;font-weight:700;color:#4A4A5A;font-size:13px;">Platform</td><td style="padding:12px 16px;color:#1A1A2E;font-size:14px;">{data.platform}</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;margin:0 0 20px 0;">
<tr><td style="padding:20px;">
<p style="margin:0 0 8px 0;color:#7C3AED;font-weight:700;font-size:13px;">Message:</p>
<p style="margin:0;color:#4A4A5A;font-size:14px;line-height:1.6;">{data.message}</p>
</td></tr></table>
"""

        resend.Emails.send({
            "from": "Mentova Academy <noreply@mentova-academy.com>",
            "to": ["info@mentova-academy.com"],
            "subject": f"New Ambassador Application — {data.name}",
            "html": email_wrap(content),
        })
    except Exception as e:
        logger.error(f"Failed to send ambassador notification: {e}")

    # Send confirmation email to applicant
    try:
        import resend
        resend.api_key = os.environ.get("RESEND_API_KEY", "re_Q64syrwQ_Lv1oZwJe6TXrofrtwLg5jHYg")

        lang = (data.language or "EN").upper()
        t = {
            "FR": {
                "title": "Ta candidature Ambassadeur a bien été reçue !",
                "subject": "Ta candidature Ambassadeur a été reçue !",
                "body": "Merci d'avoir postulé comme <strong style='color:#7C3AED;'>Ambassadeur Mentova</strong>. Notre équipe examine chaque candidature sous 48 heures.",
                "tip_title": "Ce que tu peux faire en attendant :",
                "tip": "Partage ton lien de parrainage et commence à bâtir ta communauté Mentova !",
                "questions": "Des questions ? Réponds directement à cet email.",
                "spam": "Si tu ne reçois pas notre réponse, vérifie tes courriels indésirables (spam/junk).",
            },
            "ES": {
                "title": "¡Tu solicitud de Embajador fue recibida!",
                "subject": "¡Tu solicitud de Embajador fue recibida!",
                "body": "Gracias por postularte como <strong style='color:#7C3AED;'>Embajador de Mentova</strong>. Nuestro equipo revisa cada solicitud en 48 horas.",
                "tip_title": "Mientras tanto:",
                "tip": "¡Comparte tu enlace de referencia y empieza a construir tu comunidad Mentova!",
                "questions": "¿Preguntas? Responde directamente a este correo.",
                "spam": "Si no recibes nuestra respuesta, revisa tu carpeta de correo no deseado (spam).",
            },
            "EN": {
                "title": "Your Ambassador application was received!",
                "subject": "Your Ambassador application was received!",
                "body": "Thank you for applying as a <strong style='color:#7C3AED;'>Mentova Ambassador</strong>. Our team reviews every application within 48 hours.",
                "tip_title": "What you can do while waiting:",
                "tip": "Share your referral link and start building your Mentova community!",
                "questions": "Questions? Reply directly to this email.",
                "spam": "If you don't receive our reply, please check your spam/junk folder.",
            },
        }
        tr = t.get(lang, t["EN"])

        confirm_content = f"""
<h2 style="margin:0 0 16px 0;color:#1A1A2E;font-size:22px;font-weight:700;">{tr["title"]}</h2>
<p style="color:#4A4A5A;line-height:1.7;font-size:15px;margin:0 0 20px 0;">{tr["body"]}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:20px;">
<p style="margin:0 0 4px 0;color:#7C3AED;font-weight:700;font-size:13px;">{tr["tip_title"]}</p>
<p style="margin:0;color:#6B6B7E;font-size:13px;line-height:1.7;">{tr["tip"]}</p>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:16px 20px;text-align:center;">
<p style="margin:0;color:#C2410C;font-size:13px;font-weight:600;">{tr["spam"]}</p>
</td></tr></table>
<p style="color:#A1A1AA;font-size:12px;text-align:center;">{tr["questions"]}</p>
"""
        resend.Emails.send({
            "from": "Mentova Academy <noreply@mentova-academy.com>",
            "to": [email],
            "reply_to": "info@mentova-academy.com",
            "subject": tr["subject"],
            "html": email_wrap(confirm_content),
        })
    except Exception as e:
        logger.error(f"Failed to send ambassador confirmation to applicant: {e}")

    return {"success": True, "message": "application_received"}


@preregister_router.post("/mentor/apply")
async def mentor_apply(data: MentorApplyRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    email = data.email.strip().lower()
    existing = await db.mentor_applications.find_one({"email": email})
    if existing:
        return {"success": True, "message": "already_applied"}

    await db.mentor_applications.insert_one({
        "name": data.name,
        "email": email,
        "country": data.country,
        "city": data.city,
        "phone": data.phone,
        "language": data.language,
        "years_experience": data.years_experience,
        "specialty": data.specialty,
        "trading_style": data.trading_style,
        "certifications": data.certifications,
        "audience_size": data.audience_size,
        "social_links": data.social_links,
        "teaching_experience": data.teaching_experience,
        "content_plan": data.content_plan,
        "sample_link": data.sample_link,
        "motivation": data.motivation,
        "differentiator": data.differentiator,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Send notification email to admin
    try:
        import resend
        resend.api_key = os.environ.get("RESEND_API_KEY")

        socials = data.social_links or {}
        social_html = ''.join([f'<tr><td style="padding:4px 12px 4px 0;color:#6B6B7E;font-size:12px;">{k}</td><td style="padding:4px 0;font-size:12px;"><a href="{v}" style="color:#7C3AED;">{v[:40]}...</a></td></tr>' for k, v in socials.items() if v])

        content = f"""
<h2 style="margin:0 0 16px 0;color:#1A1A2E;font-size:20px;font-weight:700;">New Mentor Application</h2>

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E5F7;border-radius:12px;overflow:hidden;margin:0 0 16px 0;">
<tr style="background:#F8F7FF;"><td style="padding:10px 14px;font-weight:700;color:#4A4A5A;font-size:12px;width:130px;border-bottom:1px solid #E8E5F7;">Name</td><td style="padding:10px 14px;color:#1A1A2E;font-size:13px;border-bottom:1px solid #E8E5F7;">{data.name}</td></tr>
<tr><td style="padding:10px 14px;font-weight:700;color:#4A4A5A;font-size:12px;border-bottom:1px solid #E8E5F7;">Email</td><td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #E8E5F7;"><a href="mailto:{email}" style="color:#7C3AED;">{email}</a></td></tr>
<tr style="background:#F8F7FF;"><td style="padding:10px 14px;font-weight:700;color:#4A4A5A;font-size:12px;border-bottom:1px solid #E8E5F7;">Location</td><td style="padding:10px 14px;color:#1A1A2E;font-size:13px;border-bottom:1px solid #E8E5F7;">{data.city}, {data.country}</td></tr>
<tr><td style="padding:10px 14px;font-weight:700;color:#4A4A5A;font-size:12px;border-bottom:1px solid #E8E5F7;">Language</td><td style="padding:10px 14px;color:#1A1A2E;font-size:13px;border-bottom:1px solid #E8E5F7;">{data.language}</td></tr>
<tr style="background:#F8F7FF;"><td style="padding:10px 14px;font-weight:700;color:#4A4A5A;font-size:12px;border-bottom:1px solid #E8E5F7;">Experience</td><td style="padding:10px 14px;color:#1A1A2E;font-size:13px;border-bottom:1px solid #E8E5F7;">{data.years_experience} years</td></tr>
<tr><td style="padding:10px 14px;font-weight:700;color:#4A4A5A;font-size:12px;border-bottom:1px solid #E8E5F7;">Specialty</td><td style="padding:10px 14px;color:#1A1A2E;font-size:13px;border-bottom:1px solid #E8E5F7;">{data.specialty}</td></tr>
<tr style="background:#F8F7FF;"><td style="padding:10px 14px;font-weight:700;color:#4A4A5A;font-size:12px;border-bottom:1px solid #E8E5F7;">Audience</td><td style="padding:10px 14px;color:#1A1A2E;font-size:13px;border-bottom:1px solid #E8E5F7;">{data.audience_size}</td></tr>
<tr><td style="padding:10px 14px;font-weight:700;color:#4A4A5A;font-size:12px;">Certifications</td><td style="padding:10px 14px;color:#1A1A2E;font-size:13px;">{data.certifications or 'None'}</td></tr>
</table>

{'<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;"><tr><td style="font-size:13px;font-weight:700;color:#7C3AED;padding:0 0 8px 0;">Social Links</td></tr>' + social_html + '</table>' if social_html else ''}

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;margin:0 0 12px 0;">
<tr><td style="padding:14px;"><p style="margin:0 0 4px 0;color:#7C3AED;font-weight:700;font-size:12px;">Teaching Experience</p><p style="margin:0;color:#4A4A5A;font-size:13px;line-height:1.5;">{data.teaching_experience}</p></td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;margin:0 0 12px 0;">
<tr><td style="padding:14px;"><p style="margin:0 0 4px 0;color:#7C3AED;font-weight:700;font-size:12px;">Motivation</p><p style="margin:0;color:#4A4A5A;font-size:13px;line-height:1.5;">{data.motivation}</p></td></tr></table>

{f'<p style="font-size:12px;color:#6B6B7E;">Sample: <a href="{data.sample_link}" style="color:#7C3AED;">{data.sample_link}</a></p>' if data.sample_link else ''}
"""

        resend.Emails.send({
            "from": "Mentova Academy <noreply@mentova-academy.com>",
            "to": ["info@mentova-academy.com"],
            "subject": f"New Mentor Application: {data.name} ({data.specialty})",
            "html": email_wrap(content),
        })
    except Exception as e:
        logger.error(f"Failed to send mentor notification: {e}")

    # Send confirmation email to applicant
    try:
        import resend
        resend.api_key = os.environ.get("RESEND_API_KEY", "re_Q64syrwQ_Lv1oZwJe6TXrofrtwLg5jHYg")

        lang = (data.language or "EN").upper()
        t = {
            "FR": {
                "title": "Ta candidature Mentor a bien été reçue !",
                "subject": "Ta candidature Mentor a été reçue !",
                "body": "Merci d'avoir postulé comme <strong style='color:#7C3AED;'>Mentor Mentova</strong>. Notre équipe examine chaque candidature sous 5 jours ouvrables.",
                "steps_title": "Prochaines étapes :",
                "steps": "1. Notre équipe examine ta candidature<br>2. Si ton profil correspond, tu recevras un lien pour un entretien<br>3. Une fois approuvé, accès au Mentor Dashboard",
                "questions": "Des questions ? Réponds directement à cet email.",
                "spam": "Si tu ne reçois pas notre réponse, vérifie tes courriels indésirables (spam/junk).",
            },
            "ES": {
                "title": "¡Tu solicitud de Mentor fue recibida!",
                "subject": "¡Tu solicitud de Mentor fue recibida!",
                "body": "Gracias por postularte como <strong style='color:#7C3AED;'>Mentor de Mentova</strong>. Nuestro equipo revisa cada solicitud en 5 días hábiles.",
                "steps_title": "Próximos pasos:",
                "steps": "1. Nuestro equipo revisa tu solicitud<br>2. Si tu perfil coincide, recibirás un enlace para una entrevista<br>3. Una vez aprobado, acceso al Panel de Mentor",
                "questions": "¿Preguntas? Responde directamente a este correo.",
                "spam": "Si no recibes nuestra respuesta, revisa tu carpeta de correo no deseado (spam).",
            },
            "EN": {
                "title": "Your Mentor application was received!",
                "subject": "Your Mentor application was received!",
                "body": "Thank you for applying as a <strong style='color:#7C3AED;'>Mentova Mentor</strong>. Our team reviews every application within 5 business days.",
                "steps_title": "Next steps:",
                "steps": "1. Our team reviews your application<br>2. If your profile matches, you will receive an interview link<br>3. Once approved, access to the Mentor Dashboard",
                "questions": "Questions? Reply directly to this email.",
                "spam": "If you don't receive our reply, please check your spam/junk folder.",
            },
        }
        tr = t.get(lang, t["EN"])

        confirm_content = f"""
<h2 style="margin:0 0 16px 0;color:#1A1A2E;font-size:22px;font-weight:700;">{tr["title"]}</h2>
<p style="color:#4A4A5A;line-height:1.7;font-size:15px;margin:0 0 20px 0;">{tr["body"]}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:20px;">
<p style="margin:0 0 8px 0;color:#7C3AED;font-weight:700;font-size:13px;">{tr["steps_title"]}</p>
<p style="margin:0;color:#6B6B7E;font-size:13px;line-height:1.7;">{tr["steps"]}</p>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:16px 20px;text-align:center;">
<p style="margin:0;color:#C2410C;font-size:13px;font-weight:600;">{tr["spam"]}</p>
</td></tr></table>
<p style="color:#A1A1AA;font-size:12px;text-align:center;">{tr["questions"]}</p>
"""
        resend.Emails.send({
            "from": "Mentova Academy <noreply@mentova-academy.com>",
            "to": [email],
            "reply_to": "info@mentova-academy.com",
            "subject": tr["subject"],
            "html": email_wrap(confirm_content),
        })
    except Exception as e:
        logger.error(f"Failed to send mentor confirmation to applicant: {e}")

    return {"success": True, "message": "application_received"}


# --- Email Template ---

def email_wrap(content: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F4F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F7;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#7C3AED,#5B21B6);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#FFFFFF;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Mentova Academy</h1>
</td></tr>
<!-- Body -->
<tr><td style="padding:40px;">
{content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px 40px;border-top:1px solid #EEEEF0;text-align:center;">
<p style="margin:0 0 4px 0;color:#6B6B7E;font-size:13px;">— Justin, Founder &amp; CEO</p>
<p style="margin:0;color:#A1A1AA;font-size:12px;">Mentova Academy Inc. — Canada 🍁</p>
<p style="margin:8px 0 0 0;color:#A1A1AA;font-size:11px;"><a href="https://mentova-academy.com" style="color:#7C3AED;text-decoration:none;">mentova-academy.com</a></p>
</td></tr>
</table>
</td></tr></table></body></html>"""


# --- Email Functions ---

async def send_confirmation_email(email: str, founder_number: int, wave: int, referral_code: str, language: str):
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY")

    launch_date = LAUNCH_DATE[:10]
    total = 500 if wave == 1 else 1000
    subject = f"Founding spot #{founder_number}/{total} reserved — Mentova Academy"

    content = f"""
<h2 style="margin:0 0 16px 0;color:#1A1A2E;font-size:22px;font-weight:700;">You're in. Founding Member #{founder_number}/{total}.</h2>
<p style="color:#4A4A5A;line-height:1.7;font-size:15px;margin:0 0 20px 0;">Your <strong style="color:#7C3AED;">Founding Member badge</strong> is yours forever — you earned it by believing in Mentova from day one.</p>
<p style="color:#4A4A5A;line-height:1.7;font-size:15px;margin:0 0 24px 0;">Your spot is reserved. Your price is locked at <strong style="color:#059669;">$9.99/mo</strong> for 30 days after launch.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:20px;">
<p style="margin:0 0 4px 0;color:#1A1A2E;font-weight:700;font-size:14px;">Important:</p>
<p style="margin:0;color:#6B6B7E;font-size:14px;line-height:1.6;">No payment today. Your $9.99/mo activates when you subscribe in the app at launch. Price lock valid 30 days after launch. After that, VIP goes to $25.99/mo — but your badge stays forever.</p>
</td></tr></table>

<h3 style="margin:0 0 12px 0;color:#1A1A2E;font-size:16px;">Your founding perks:</h3>
<table cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
<tr><td style="padding:6px 12px 6px 0;color:#4A4A5A;font-size:14px;">🏆</td><td style="padding:6px 0;color:#4A4A5A;font-size:14px;">Founding Member badge — yours forever</td></tr>
<tr><td style="padding:6px 12px 6px 0;color:#4A4A5A;font-size:14px;">⭐</td><td style="padding:6px 0;color:#4A4A5A;font-size:14px;">$9.99/mo locked for 30 days post-launch</td></tr>
<tr><td style="padding:6px 12px 6px 0;color:#4A4A5A;font-size:14px;">🎯</td><td style="padding:6px 0;color:#4A4A5A;font-size:14px;">Direct influence on the roadmap</td></tr>
<tr><td style="padding:6px 12px 6px 0;color:#4A4A5A;font-size:14px;">🎁</td><td style="padding:6px 0;color:#4A4A5A;font-size:14px;">Refer 5 friends → 1 free VIP month</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF8;border:1px solid #D1FAE5;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:20px;">
<p style="margin:0 0 8px 0;color:#059669;font-weight:700;font-size:14px;">Your referral link:</p>
<p style="margin:0;color:#1A1A2E;font-size:14px;word-break:break-all;">mentova-academy.com/?ref={referral_code}</p>
<p style="margin:8px 0 0 0;color:#6B6B7E;font-size:12px;">Every 5 friends who register = 1 free month after your first payment. No limit.</p>
</td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px 0;">
<a href="https://mentova-academy.com/member" style="display:inline-block;background:#7C3AED;color:#FFFFFF;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;">Access Your Dashboard</a>
</td></tr></table>

<p style="color:#A1A1AA;font-size:13px;text-align:center;margin:0;">Launch date: {launch_date} — Your activation link arrives that day.</p>
"""

    resend.Emails.send({
        "from": "Mentova Academy <noreply@mentova-academy.com>",
        "to": [email],
        "subject": subject,
        "html": email_wrap(content),
    })


async def send_referral_progress_email(email: str, language: str, count: int):
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY")

    progress = count % REFERRALS_PER_REWARD
    member = await db.pre_registrations.find_one({"email": email})
    code = member["referral_code"] if member else ""

    filled_pct = int((progress / REFERRALS_PER_REWARD) * 100)

    content = f"""
<h2 style="margin:0 0 16px 0;color:#1A1A2E;font-size:22px;font-weight:700;">Someone just used your referral link!</h2>
<p style="color:#4A4A5A;line-height:1.7;font-size:15px;margin:0 0 24px 0;">You're getting closer to your free VIP month.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:24px;text-align:center;">
<p style="margin:0 0 8px 0;color:#7C3AED;font-size:32px;font-weight:800;">{progress} / {REFERRALS_PER_REWARD}</p>
<p style="margin:0 0 12px 0;color:#6B6B7E;font-size:14px;">referrals toward your free month</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#E8E5F7;border-radius:8px;height:10px;"><div style="background:linear-gradient(90deg,#7C3AED,#059669);width:{filled_pct}%;height:10px;border-radius:8px;"></div></td></tr></table>
</td></tr></table>

<p style="color:#4A4A5A;font-size:14px;line-height:1.6;margin:0 0 20px 0;">5 referrals = 1 free VIP month, applied after your first payment.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF8;border:1px solid #D1FAE5;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:16px 20px;">
<p style="margin:0;color:#059669;font-weight:700;font-size:13px;">Your link:</p>
<p style="margin:4px 0 0 0;color:#1A1A2E;font-size:14px;">mentova-academy.com/?ref={code}</p>
</td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="https://mentova-academy.com/member" style="display:inline-block;background:#7C3AED;color:#FFFFFF;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">View My Dashboard</a>
</td></tr></table>
"""

    resend.Emails.send({
        "from": "Mentova Academy <noreply@mentova-academy.com>",
        "to": [email],
        "subject": f"{progress}/{REFERRALS_PER_REWARD} referrals toward your free month — Mentova",
        "html": email_wrap(content),
    })


async def send_referral_reward_email(email: str, language: str, count: int):
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY")

    months = count // REFERRALS_PER_REWARD
    member = await db.pre_registrations.find_one({"email": email})
    code = member["referral_code"] if member else ""

    content = f"""
<div style="text-align:center;margin:0 0 24px 0;">
<p style="font-size:48px;margin:0;">🎉</p>
<h2 style="margin:8px 0 0 0;color:#1A1A2E;font-size:24px;font-weight:800;">Congratulations!</h2>
</div>

<p style="color:#4A4A5A;line-height:1.7;font-size:15px;margin:0 0 20px 0;text-align:center;">You referred <strong style="color:#7C3AED;">{count} friends</strong> to Mentova Academy.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF8;border:1px solid #D1FAE5;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:24px;text-align:center;">
<p style="margin:0;color:#059669;font-size:36px;font-weight:800;">{months}</p>
<p style="margin:4px 0 0 0;color:#059669;font-size:16px;font-weight:700;">free VIP month{"s" if months > 1 else ""} earned</p>
<p style="margin:8px 0 0 0;color:#6B6B7E;font-size:13px;">Applied automatically after your first payment at launch.</p>
</td></tr></table>

<p style="color:#4A4A5A;font-size:14px;text-align:center;margin:0 0 20px 0;">Refer 5 more friends → earn another free month. No limit.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:16px 20px;">
<p style="margin:0;color:#7C3AED;font-weight:700;font-size:13px;">Your referral link:</p>
<p style="margin:4px 0 0 0;color:#1A1A2E;font-size:14px;">mentova-academy.com/?ref={code}</p>
</td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="https://mentova-academy.com/member" style="display:inline-block;background:#7C3AED;color:#FFFFFF;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">View My Dashboard</a>
</td></tr></table>
"""

    resend.Emails.send({
        "from": "Mentova Academy <noreply@mentova-academy.com>",
        "to": [email],
        "subject": f"🎉 {months} free VIP month(s) earned — Mentova Academy",
        "html": email_wrap(content),
    })


# --- Launch Day & Reminder Emails ---

async def send_launch_day_email(member: dict):
    """EMAIL 5 — Sent on launch day"""
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY")

    email = member["email"]
    num = member["founder_number"]
    code = member["referral_code"]

    content = f"""
<div style="text-align:center;margin:0 0 24px 0;">
<p style="font-size:48px;margin:0;">🚀</p>
<h2 style="margin:8px 0 0 0;color:#1A1A2E;font-size:26px;font-weight:800;">Mentova is LIVE</h2>
<p style="color:#6B6B7E;font-size:14px;margin:8px 0 0 0;">The wait is over, Founding Member #{num}.</p>
</div>

<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 24px 0;">
<a href="#" style="display:inline-flex;align-items:center;gap:8px;background:#000000;color:#FFFFFF;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;">Download on the App Store</a>
</td></tr></table>

<p style="color:#4A4A5A;line-height:1.7;font-size:15px;margin:0 0 20px 0;">Log in with <strong>{email}</strong> and the password you chose when you registered.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF8;border:1px solid #D1FAE5;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:20px;">
<p style="margin:0 0 4px 0;color:#059669;font-weight:700;font-size:14px;">Your Founding Member badge is already active</p>
<p style="margin:0;color:#6B6B7E;font-size:13px;">It's yours forever, regardless of when you subscribe.</p>
</td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:20px;">
<p style="margin:0 0 4px 0;color:#C2410C;font-weight:700;font-size:14px;">Your locked price: $9.99/mo</p>
<p style="margin:0;color:#6B6B7E;font-size:13px;">Price lock expires in 30 days. Subscribe in the app now to lock $9.99/mo permanently. After 30 days → $25.99/mo.</p>
</td></tr></table>

<h3 style="margin:0 0 12px 0;color:#1A1A2E;font-size:16px;">After subscribing:</h3>
<table cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
<tr><td style="padding:4px 10px 4px 0;color:#059669;font-size:16px;">✓</td><td style="padding:4px 0;color:#4A4A5A;font-size:14px;">Full VIP access unlocked</td></tr>
<tr><td style="padding:4px 10px 4px 0;color:#059669;font-size:16px;">✓</td><td style="padding:4px 0;color:#4A4A5A;font-size:14px;">Free months from referrals applied</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;">
<tr><td style="padding:16px 20px;">
<p style="margin:0;color:#7C3AED;font-weight:700;font-size:13px;">Your referral link (still active):</p>
<p style="margin:4px 0 0 0;color:#1A1A2E;font-size:14px;">mentova-academy.com/?ref={code}</p>
</td></tr></table>
"""

    resend.Emails.send({
        "from": "Mentova Academy <noreply@mentova-academy.com>",
        "to": [email],
        "subject": f"🚀 Mentova is LIVE — Activate your VIP now, #{num}",
        "html": email_wrap(content),
    })


async def send_price_lock_reminder_7days(member: dict):
    """EMAIL 6 — Sent 7 days before price lock expires"""
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY")

    email = member["email"]

    content = f"""
<h2 style="margin:0 0 16px 0;color:#1A1A2E;font-size:22px;font-weight:700;">Your $9.99 rate expires in 7 days</h2>

<p style="color:#4A4A5A;line-height:1.7;font-size:15px;margin:0 0 24px 0;">Your founding price of <strong style="color:#059669;">$9.99/mo</strong> expires in 7 days.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:20px;text-align:center;">
<p style="margin:0;color:#C2410C;font-size:20px;font-weight:800;">$9.99/mo → $25.99/mo</p>
<p style="margin:8px 0 0 0;color:#6B6B7E;font-size:13px;">in 7 days</p>
</td></tr></table>

<p style="color:#4A4A5A;font-size:14px;line-height:1.6;margin:0 0 24px 0;">Your <strong style="color:#7C3AED;">Founding Member badge stays forever</strong> regardless. But your locked price expires soon.</p>

<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="#" style="display:inline-block;background:#7C3AED;color:#FFFFFF;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;">Activate My VIP Now →</a>
</td></tr></table>
"""

    resend.Emails.send({
        "from": "Mentova Academy <noreply@mentova-academy.com>",
        "to": [email],
        "subject": "⚠️ Your $9.99 rate expires in 7 days — Mentova",
        "html": email_wrap(content),
    })


async def send_price_lock_reminder_1day(member: dict):
    """EMAIL 7 — Sent 1 day before price lock expires"""
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY")

    email = member["email"]

    content = f"""
<div style="text-align:center;margin:0 0 24px 0;">
<p style="font-size:48px;margin:0;">⚠️</p>
<h2 style="margin:8px 0 0 0;color:#C2410C;font-size:24px;font-weight:800;">Last chance</h2>
<p style="color:#6B6B7E;font-size:15px;margin:8px 0 0 0;">Your locked price expires tomorrow.</p>
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:24px;text-align:center;">
<p style="margin:0;color:#DC2626;font-size:24px;font-weight:800;">$9.99/mo → $25.99/mo</p>
<p style="margin:8px 0 0 0;color:#DC2626;font-size:16px;font-weight:700;">in 24 hours</p>
</td></tr></table>

<p style="color:#4A4A5A;font-size:14px;line-height:1.6;margin:0 0 8px 0;text-align:center;">Your <strong style="color:#7C3AED;">Founding Member badge stays forever</strong> regardless.</p>

<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0;">
<a href="#" style="display:inline-block;background:#DC2626;color:#FFFFFF;padding:16px 40px;border-radius:10px;font-size:16px;font-weight:800;text-decoration:none;">Activate My VIP Now →</a>
</td></tr></table>
"""

    resend.Emails.send({
        "from": "Mentova Academy <noreply@mentova-academy.com>",
        "to": [email],
        "subject": "⚠️ Last chance — $9.99 rate expires tomorrow",
        "html": email_wrap(content),
    })


# --- Email Scheduler ---

async def run_email_scheduler():
    """Background task that checks and sends scheduled emails"""
    import asyncio

    while True:
        try:
            if db is None:
                await asyncio.sleep(60)
                continue

            now = datetime.now(timezone.utc)
            launch_dt = datetime.fromisoformat(LAUNCH_DATE.replace("Z", "+00:00"))

            # Check if today is launch day
            if now.date() == launch_dt.date():
                unsent = await db.pre_registrations.find({
                    "status": "pre_registered",
                    "launch_email_sent": {"$ne": True}
                }).to_list(50)

                for member in unsent:
                    try:
                        await send_launch_day_email(member)
                        await db.pre_registrations.update_one(
                            {"_id": member["_id"]},
                            {"$set": {"launch_email_sent": True}}
                        )
                        logger.info(f"Launch email sent to {member['email']}")
                    except Exception as e:
                        logger.error(f"Failed to send launch email to {member['email']}: {e}")
                    await asyncio.sleep(1)  # Rate limiting

            # Check for J-7 reminders (7 days before price lock expires)
            seven_days_from_now = now + timedelta(days=7)
            members_j7 = await db.pre_registrations.find({
                "status": {"$in": ["pre_registered", "vip_pending_activation"]},
                "vip_price_lock_expires_at": {"$exists": True},
                "reminder_j7_sent": {"$ne": True}
            }).to_list(50)

            for member in members_j7:
                try:
                    expires = datetime.fromisoformat(member["vip_price_lock_expires_at"].replace("Z", "+00:00"))
                    days_left = (expires - now).days
                    if days_left <= 7 and days_left > 1:
                        await send_price_lock_reminder_7days(member)
                        await db.pre_registrations.update_one(
                            {"_id": member["_id"]},
                            {"$set": {"reminder_j7_sent": True}}
                        )
                        logger.info(f"J-7 reminder sent to {member['email']}")
                        await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Failed J-7 reminder for {member.get('email')}: {e}")

            # Check for J-1 reminders (1 day before price lock expires)
            members_j1 = await db.pre_registrations.find({
                "status": {"$in": ["pre_registered", "vip_pending_activation"]},
                "vip_price_lock_expires_at": {"$exists": True},
                "reminder_j1_sent": {"$ne": True}
            }).to_list(50)

            for member in members_j1:
                try:
                    expires = datetime.fromisoformat(member["vip_price_lock_expires_at"].replace("Z", "+00:00"))
                    days_left = (expires - now).days
                    if days_left <= 1 and days_left >= 0:
                        await send_price_lock_reminder_1day(member)
                        await db.pre_registrations.update_one(
                            {"_id": member["_id"]},
                            {"$set": {"reminder_j1_sent": True}}
                        )
                        logger.info(f"J-1 reminder sent to {member['email']}")
                        await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Failed J-1 reminder for {member.get('email')}: {e}")

        except Exception as e:
            logger.error(f"Email scheduler error: {e}")

        await asyncio.sleep(3600)  # Check every hour


def start_scheduler():
    """Start the email scheduler as a background task"""
    import asyncio
    loop = asyncio.get_event_loop()
    loop.create_task(run_email_scheduler())
    logger.info("Email scheduler started — checking every hour")


# ============================================================
# ADMIN DASHBOARD — Application Management
# ============================================================

import jwt as pyjwt

JWT_SECRET = os.environ.get('JWT_SECRET', 'mentova_super_secret_key_2025')
JWT_ALGORITHM = "HS256"
SUPER_ADMIN_EMAIL = "jcuradeau.7@gmail.com"

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
admin_security = HTTPBearer()

async def get_admin_from_token(credentials: HTTPAuthorizationCredentials = Depends(admin_security)):
    token = credentials.credentials
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("email") != SUPER_ADMIN_EMAIL and user.get("role") not in ["admin", "super_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


class ReviewApplicationRequest(BaseModel):
    decision: str  # "approved" or "rejected"
    message: str = ""


@preregister_router.get("/admin/applications")
async def list_applications(type: str = "all", admin=Depends(get_admin_from_token)):
    """List all mentor and ambassador applications for admin review"""
    results = []

    if type in ("all", "mentor"):
        async for doc in db.mentor_applications.find().sort("created_at", -1):
            doc["_id"] = str(doc["_id"])
            doc["type"] = "mentor"
            results.append(doc)

    if type in ("all", "ambassador"):
        async for doc in db.ambassador_applications.find().sort("created_at", -1):
            doc["_id"] = str(doc["_id"])
            doc["type"] = "ambassador"
            results.append(doc)

    # Sort combined by created_at descending
    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"applications": results, "total": len(results)}


@preregister_router.post("/admin/applications/{app_type}/{app_id}/review")
async def review_application(app_type: str, app_id: str, data: ReviewApplicationRequest, admin=Depends(get_admin_from_token)):
    """Approve or reject an application with a personalized message"""
    if app_type not in ("mentor", "ambassador"):
        raise HTTPException(status_code=400, detail="Type must be 'mentor' or 'ambassador'")
    if data.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")

    from bson import ObjectId
    collection = db.mentor_applications if app_type == "mentor" else db.ambassador_applications

    try:
        app_doc = await collection.find_one({"_id": ObjectId(app_id)})
    except Exception:
        app_doc = await collection.find_one({"_id": app_id})

    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    # Update status
    update_data = {
        "status": data.decision,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": admin.get("email"),
        "review_message": data.message,
    }
    try:
        await collection.update_one({"_id": ObjectId(app_id)}, {"$set": update_data})
    except Exception:
        await collection.update_one({"_id": app_id}, {"$set": update_data})

    # Send email to applicant
    applicant_email = app_doc.get("email")
    applicant_name = app_doc.get("name", "")
    language = app_doc.get("language", "EN")

    try:
        import resend
        resend.api_key = os.environ.get("RESEND_API_KEY", "re_Q64syrwQ_Lv1oZwJe6TXrofrtwLg5jHYg")

        if data.decision == "approved":
            subject_map = {
                "FR": f"Félicitations {applicant_name} ! Ta candidature {app_type} Mentova est acceptée",
                "ES": f"¡Felicidades {applicant_name}! Tu solicitud de {app_type} en Mentova fue aceptada",
                "EN": f"Congratulations {applicant_name}! Your Mentova {app_type} application is approved",
            }
            status_html = '<div style="background:#F0FDF8;border:1px solid #D1FAE5;border-radius:12px;padding:20px;margin:0 0 24px 0;text-align:center;"><p style="margin:0;color:#059669;font-size:24px;font-weight:800;">APPROVED</p></div>'
        else:
            subject_map = {
                "FR": f"{applicant_name}, mise à jour sur ta candidature {app_type} Mentova",
                "ES": f"{applicant_name}, actualización sobre tu solicitud de {app_type} en Mentova",
                "EN": f"{applicant_name}, update on your Mentova {app_type} application",
            }
            status_html = '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;margin:0 0 24px 0;text-align:center;"><p style="margin:0;color:#DC2626;font-size:24px;font-weight:800;">NOT APPROVED</p></div>'

        subject = subject_map.get(language, subject_map["EN"])

        message_html = ""
        if data.message:
            message_html = f'''
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border:1px solid #E8E5F7;border-radius:12px;margin:0 0 24px 0;">
<tr><td style="padding:20px;">
<p style="margin:0 0 8px 0;color:#7C3AED;font-weight:700;font-size:13px;">Message from Justin, Founder:</p>
<p style="margin:0;color:#4A4A5A;font-size:14px;line-height:1.7;">{data.message}</p>
</td></tr></table>'''

        content = f'''
<h2 style="margin:0 0 16px 0;color:#1A1A2E;font-size:22px;font-weight:700;">Hi {applicant_name},</h2>

{status_html}

<p style="color:#4A4A5A;line-height:1.7;font-size:15px;margin:0 0 20px 0;">
{"We are happy to inform you that your application has been reviewed and approved! Welcome to the Mentova team." if data.decision == "approved" and language == "EN" else ""}
{"Nous avons le plaisir de t'informer que ta candidature a été examinée et acceptée ! Bienvenue dans l'équipe Mentova." if data.decision == "approved" and language == "FR" else ""}
{"¡Nos complace informarte que tu solicitud ha sido revisada y aceptada! Bienvenido al equipo Mentova." if data.decision == "approved" and language == "ES" else ""}
{"Thank you for your interest in Mentova. After careful review, we are unable to move forward with your application at this time." if data.decision == "rejected" and language == "EN" else ""}
{"Merci pour ton intérêt envers Mentova. Après examen attentif, nous ne pouvons pas donner suite à ta candidature pour le moment." if data.decision == "rejected" and language == "FR" else ""}
{"Gracias por tu interés en Mentova. Tras una revisión cuidadosa, no podemos avanzar con tu solicitud en este momento." if data.decision == "rejected" and language == "ES" else ""}
</p>

{message_html}

<p style="color:#A1A1AA;font-size:12px;text-align:center;margin:24px 0 0 0;">This email was sent from Mentova Academy. Reply directly to reach us.</p>
'''

        resend.Emails.send({
            "from": "Mentova Academy <noreply@mentova-academy.com>",
            "to": [applicant_email],
            "reply_to": "info@mentova-academy.com",
            "subject": subject,
            "html": email_wrap(content),
        })
    except Exception as e:
        logger.error(f"Failed to send review email: {e}")

    return {
        "success": True,
        "decision": data.decision,
        "email_sent_to": applicant_email,
    }
