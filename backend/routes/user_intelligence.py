"""
User Intelligence System - Detailed user analytics, engagement scoring, and PDF export.
Aggregates data from existing Mentova collections without duplicating or breaking anything.
"""
import os
import uuid
import math
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from io import BytesIO
import logging
import jwt

logger = logging.getLogger("user_intelligence")
router = APIRouter()

JWT_SECRET = os.environ.get('JWT_SECRET', 'mentova-secret-key-2026')
_deps: Dict[str, Any] = {}


def set_intelligence_deps(database):
    _deps['db'] = database


def _db():
    return _deps.get('db')


async def _admin_auth(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await _db().users.find_one({"id": payload["user_id"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("role") not in ["admin", "super_admin"]:
            raise HTTPException(status_code=403, detail="Admin access only")
        return user
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ==================== HELPERS ====================

def _safe_iso(val) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, str):
        return val
    return str(val)


def _parse_dt(val) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    if isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


def _days_ago(n: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=n)


# ==================== ENGAGEMENT SCORE ====================

def calculate_engagement_score(data: dict) -> dict:
    """Calculate engagement score 0-100 based on real activity data."""
    score = 0
    factors = {}

    # Sessions & Activity (max 25 pts)
    sessions = data.get("total_sessions", 0)
    if sessions > 0:
        session_pts = min(25, sessions * 2)
        score += session_pts
        factors["sessions"] = session_pts

    # Atlas usage (max 25 pts)
    atlas_convos = data.get("atlas_conversations", 0)
    atlas_msgs = data.get("atlas_messages", 0)
    atlas_pts = min(25, atlas_convos * 3 + atlas_msgs * 0.5)
    score += atlas_pts
    factors["atlas_usage"] = round(atlas_pts, 1)

    # Learning (max 20 pts)
    modules_completed = data.get("modules_completed", 0)
    quizzes = data.get("quizzes_completed", 0)
    learn_pts = min(20, modules_completed * 5 + quizzes * 2)
    score += learn_pts
    factors["learning"] = round(learn_pts, 1)

    # Recency (max 15 pts)
    days_since = data.get("days_since_last_activity", 999)
    if days_since <= 1:
        recency_pts = 15
    elif days_since <= 7:
        recency_pts = 12
    elif days_since <= 30:
        recency_pts = 8
    elif days_since <= 90:
        recency_pts = 4
    else:
        recency_pts = 0
    score += recency_pts
    factors["recency"] = recency_pts

    # Feature diversity (max 15 pts)
    features_used = data.get("features_used_count", 0)
    feat_pts = min(15, features_used * 3)
    score += feat_pts
    factors["feature_diversity"] = feat_pts

    score = min(100, round(score))
    if score >= 80:
        level = "Very High"
    elif score >= 60:
        level = "High"
    elif score >= 40:
        level = "Moderate"
    elif score >= 20:
        level = "Low"
    else:
        level = "Very Low"

    return {"score": score, "level": level, "factors": factors}


def generate_user_summary(info: dict, engagement: dict, atlas: dict, learning: dict) -> str:
    """Generate automatic behavioral summary from actual data."""
    parts = []

    # Engagement level
    level = engagement.get("engagement_level", "Unknown")
    is_vip = info.get("is_vip", False)
    plan = "VIP" if is_vip else "Free"
    parts.append(f"{'Highly engaged' if level in ['Very High', 'High'] else 'Moderately engaged' if level == 'Moderate' else 'Low engagement'} {plan} user.")

    # Atlas usage
    atlas_convos = atlas.get("total_conversations", 0)
    if atlas_convos > 10:
        parts.append(f"Frequent Atlas AI user ({atlas_convos} conversations).")
    elif atlas_convos > 0:
        parts.append(f"Has used Atlas AI ({atlas_convos} conversation{'s' if atlas_convos > 1 else ''}).")

    # VIP features
    vip_features = atlas.get("vip_features_used", [])
    if vip_features:
        parts.append(f"Uses VIP features: {', '.join(vip_features)}.")

    # Learning
    modules_total = learning.get("modules_started", 0)
    modules_done = learning.get("modules_completed", 0)
    if modules_total > 0:
        pct = round((modules_done / modules_total) * 100) if modules_total > 0 else 0
        parts.append(f"Has completed {pct}% of started modules ({modules_done}/{modules_total}).")
    else:
        parts.append("Has not started any learning modules yet.")

    # Activity pattern
    days_since = engagement.get("days_since_last_activity", 999)
    if days_since <= 1:
        parts.append("Active within the last 24 hours.")
    elif days_since <= 7:
        parts.append(f"Last active {days_since} days ago.")
    elif days_since <= 30:
        parts.append(f"Inactive for {days_since} days.")
    else:
        parts.append(f"Inactive for over {days_since} days.")

    if not parts:
        return "Insufficient data to generate summary."
    return " ".join(parts)


# ==================== EVENT TRACKING ====================

@router.post("/track/event")
async def track_user_event(
    event_type: str,
    feature: str = "general",
    metadata: Optional[Dict] = None,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
):
    """Lightweight event tracking endpoint for frontend."""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if _db() is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    event = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "event_type": event_type,
        "feature": feature,
        "metadata": metadata or {},
        "timestamp": datetime.now(timezone.utc)
    }
    await _db().user_events.insert_one(event)
    return {"success": True}


@router.post("/track/session")
async def track_session(
    action: str,  # "start" or "end"
    session_id: Optional[str] = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    """Track session start/end."""
    user_id = None
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
            user_id = payload.get("user_id")
        except Exception:
            pass
    
    if not user_id:
        return {"success": False, "detail": "No auth"}

    if _db() is None:
        return {"success": False}

    now = datetime.now(timezone.utc)

    if action == "start":
        sid = str(uuid.uuid4())
        await _db().user_sessions.insert_one({
            "id": sid,
            "user_id": user_id,
            "started_at": now,
            "ended_at": None,
            "duration_seconds": 0
        })
        # Update user last_active
        await _db().users.update_one({"id": user_id}, {"$set": {"last_active": now.isoformat()}})
        return {"success": True, "session_id": sid}
    elif action == "end" and session_id:
        session = await _db().user_sessions.find_one({"id": session_id, "user_id": user_id})
        if session and session.get("started_at"):
            started = _parse_dt(session["started_at"])
            if started:
                dur = (now - started).total_seconds()
                # Cap at 4 hours to prevent unrealistic sessions
                dur = min(dur, 14400)
                await _db().user_sessions.update_one(
                    {"id": session_id},
                    {"$set": {"ended_at": now, "duration_seconds": dur}}
                )
        return {"success": True}

    return {"success": False, "detail": "Invalid action"}


# ==================== INTELLIGENCE ENDPOINT ====================

@router.get("/admin/users/{user_id}/intelligence")
async def get_user_intelligence(
    user_id: str,
    period: str = "all",  # 7, 30, 90, all
    admin_user: dict = Depends(_admin_auth)
):
    """Get comprehensive user intelligence profile."""
    database = _db()
    if database is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # ===== USER INFO =====
    user = await database.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    period_filter = None
    if period == "7":
        period_filter = _days_ago(7)
    elif period == "30":
        period_filter = _days_ago(30)
    elif period == "90":
        period_filter = _days_ago(90)

    # General info
    created_at = _parse_dt(user.get("created_at"))
    last_active = _parse_dt(user.get("last_active"))
    user_info = {
        "user_id": user.get("id"),
        "name": user.get("name", "N/A"),
        "email": user.get("email", "N/A"),
        "created_at": _safe_iso(user.get("created_at")),
        "country": user.get("country", "N/A"),
        "language": user.get("language", user.get("preferred_language", "N/A")),
        "is_vip": user.get("is_vip", False),
        "vip_permanent": user.get("vip_permanent", False),
        "vip_expires_at": _safe_iso(user.get("vip_expires_at")),
        "role": user.get("role", "user"),
        "is_banned": user.get("is_banned", False),
        "last_active": _safe_iso(last_active),
        "account_age_days": (now - created_at).days if created_at else 0,
    }

    # ===== SESSIONS & ENGAGEMENT =====
    session_query = {"user_id": user_id}
    if period_filter:
        session_query["started_at"] = {"$gte": period_filter}

    sessions = await database.user_sessions.find(session_query).to_list(10000)
    total_sessions = len(sessions)
    total_time = sum(s.get("duration_seconds", 0) for s in sessions)
    avg_session = total_time / max(1, total_sessions)

    # Active days
    active_days_set = set()
    for s in sessions:
        st = _parse_dt(s.get("started_at"))
        if st:
            active_days_set.add(st.date())

    days_since_last = (now - last_active).days if last_active else 999
    first_session = min((s.get("started_at") for s in sessions if s.get("started_at")), default=None) if sessions else None

    engagement_data = {
        "total_sessions": total_sessions,
        "total_time_seconds": round(total_time),
        "total_time_formatted": f"{int(total_time // 3600)}h {int((total_time % 3600) // 60)}m",
        "average_session_seconds": round(avg_session),
        "average_session_formatted": f"{int(avg_session // 60)}m {int(avg_session % 60)}s",
        "active_days": len(active_days_set),
        "days_since_last_activity": days_since_last,
        "first_activity": _safe_iso(first_session),
    }

    # ===== ATLAS AI ANALYTICS =====
    conv_query = {"user_id": user_id}
    if period_filter:
        conv_query["created_at"] = {"$gte": period_filter.isoformat()}

    conversations = await database.atlas_conversations.find(conv_query, {"_id": 0}).to_list(10000)
    total_convos = len(conversations)
    total_messages = sum(len(c.get("messages", [])) for c in conversations)
    avg_msgs = total_messages / max(1, total_convos)

    # First/last Atlas interaction
    conv_dates = []
    for c in conversations:
        dt = _parse_dt(c.get("created_at"))
        if dt:
            conv_dates.append(dt)
    conv_dates.sort()

    # Check VIP feature usage from events
    vip_features_used = set()
    feature_events = await database.user_events.find({"user_id": user_id, "event_type": "feature_use"}).to_list(10000)
    for e in feature_events:
        vip_features_used.add(e.get("feature", "unknown"))

    atlas_data = {
        "total_conversations": total_convos,
        "total_messages": total_messages,
        "average_messages_per_conversation": round(avg_msgs, 1),
        "first_interaction": _safe_iso(conv_dates[0]) if conv_dates else None,
        "last_interaction": _safe_iso(conv_dates[-1]) if conv_dates else None,
        "vip_features_used": list(vip_features_used),
    }

    # ===== LEARNING ANALYTICS =====
    learning_profile = await database.user_learning_profiles.find_one({"user_id": user_id}, {"_id": 0})
    modules = await database.learning_modules.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    progress_docs = await database.module_progress.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    quizzes = await database.quiz_attempts.find({"user_id": user_id}, {"_id": 0}).to_list(1000)

    modules_started = len(modules)
    modules_completed = sum(1 for m in modules if m.get("status") == "completed" or m.get("status") == "mastered")
    quizzes_completed = len(quizzes)
    avg_quiz = sum(q.get("score", 0) for q in quizzes) / max(1, quizzes_completed)
    best_quiz = max((q.get("score", 0) for q in quizzes), default=0)

    learning_data = {
        "overall_level": learning_profile.get("overall_level", "unknown") if learning_profile else "unknown",
        "modules_started": modules_started,
        "modules_completed": modules_completed,
        "completion_percentage": round((modules_completed / max(1, modules_started)) * 100, 1),
        "quizzes_completed": quizzes_completed,
        "average_quiz_score": round(avg_quiz, 1),
        "best_quiz_score": round(best_quiz, 1),
        "skills": {
            "crypto": learning_profile.get("crypto_level", 0) if learning_profile else 0,
            "blockchain": learning_profile.get("blockchain_level", 0) if learning_profile else 0,
            "trading": learning_profile.get("trading_level", 0) if learning_profile else 0,
            "finance": learning_profile.get("finance_level", 0) if learning_profile else 0,
            "risk_management": learning_profile.get("risk_management_level", 0) if learning_profile else 0,
        },
    }

    # ===== FEATURE USAGE =====
    event_query = {"user_id": user_id}
    if period_filter:
        event_query["timestamp"] = {"$gte": period_filter}

    all_events = await database.user_events.find(event_query).to_list(50000)

    feature_counts: Dict[str, Dict] = {}
    now_ts = now
    for ev in all_events:
        feat = ev.get("feature", "general")
        if feat not in feature_counts:
            feature_counts[feat] = {"total": 0, "last_7d": 0, "last_30d": 0, "last_used": None}
        feature_counts[feat]["total"] += 1
        ts = _parse_dt(ev.get("timestamp"))
        if ts:
            if not feature_counts[feat]["last_used"] or ts > _parse_dt(feature_counts[feat]["last_used"]):
                feature_counts[feat]["last_used"] = _safe_iso(ts)
            if (now_ts - ts).days <= 7:
                feature_counts[feat]["last_7d"] += 1
            if (now_ts - ts).days <= 30:
                feature_counts[feat]["last_30d"] += 1

    feature_usage = [
        {"feature": k, **v} for k, v in sorted(feature_counts.items(), key=lambda x: -x[1]["total"])
    ]

    # ===== REVENUE / BILLING =====
    subscriptions = await database.subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    payments = await database.payment_transactions.find({"user_id": user_id}, {"_id": 0}).to_list(1000)

    total_spent = sum(p.get("amount", 0) for p in payments if p.get("status") == "completed")
    last_payment = payments[-1] if payments else None

    revenue_data = {
        "current_plan": "VIP" if user.get("is_vip") else "Free",
        "subscription_status": "active" if user.get("is_vip") else "inactive",
        "subscription_start": _safe_iso(subscriptions[0].get("created_at")) if subscriptions else None,
        "renewal_date": _safe_iso(user.get("vip_expires_at")),
        "total_payments": len(payments),
        "total_spent": round(total_spent, 2),
        "currency": "USD",
        "last_payment_amount": last_payment.get("amount", 0) if last_payment else 0,
        "last_payment_date": _safe_iso(last_payment.get("created_at")) if last_payment else None,
        "subscription_history": [
            {
                "plan": s.get("plan", "VIP"),
                "status": s.get("status", "unknown"),
                "created_at": _safe_iso(s.get("created_at")),
            }
            for s in subscriptions[:10]
        ],
    }

    # ===== ACTIVITY TIMELINE =====
    timeline_events = []

    # Add session events
    recent_sessions = await database.user_sessions.find(
        {"user_id": user_id}
    ).sort("started_at", -1).limit(50).to_list(50)
    for s in recent_sessions:
        timeline_events.append({
            "timestamp": _safe_iso(s.get("started_at")),
            "type": "session",
            "action": "Session started",
            "detail": f"Duration: {int(s.get('duration_seconds', 0) // 60)}m" if s.get("duration_seconds") else "",
        })

    # Add conversation events
    recent_convos = await database.atlas_conversations.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(30).to_list(30)
    for c in recent_convos:
        timeline_events.append({
            "timestamp": _safe_iso(c.get("created_at")),
            "type": "atlas",
            "action": "Atlas conversation",
            "detail": c.get("title", "Conversation"),
        })

    # Add quiz events
    recent_quizzes = await database.quiz_attempts.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(20).to_list(20)
    for q in recent_quizzes:
        timeline_events.append({
            "timestamp": _safe_iso(q.get("created_at")),
            "type": "learning",
            "action": "Quiz completed",
            "detail": f"Score: {q.get('score', 0)}%",
        })

    # Add feature events
    recent_feature_events = await database.user_events.find(
        {"user_id": user_id}
    ).sort("timestamp", -1).limit(50).to_list(50)
    for e in recent_feature_events:
        timeline_events.append({
            "timestamp": _safe_iso(e.get("timestamp")),
            "type": e.get("event_type", "feature"),
            "action": e.get("event_type", "Event"),
            "detail": e.get("feature", ""),
        })

    # Sort timeline by timestamp descending
    timeline_events.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    timeline_events = timeline_events[:100]

    # ===== ENGAGEMENT SCORE =====
    score_input = {
        "total_sessions": total_sessions,
        "atlas_conversations": total_convos,
        "atlas_messages": total_messages,
        "modules_completed": modules_completed,
        "quizzes_completed": quizzes_completed,
        "days_since_last_activity": days_since_last,
        "features_used_count": len(feature_counts),
    }
    score_result = calculate_engagement_score(score_input)

    engagement_data["engagement_score"] = score_result["score"]
    engagement_data["engagement_level"] = score_result["level"]
    engagement_data["score_factors"] = score_result["factors"]

    # ===== SUMMARY =====
    summary = generate_user_summary(user_info, engagement_data, atlas_data, learning_data)

    return {
        "success": True,
        "data": {
            "summary": summary,
            "user_info": user_info,
            "engagement": engagement_data,
            "atlas": atlas_data,
            "learning": learning_data,
            "feature_usage": feature_usage,
            "revenue": revenue_data,
            "timeline": timeline_events,
        }
    }


# ==================== PDF EXPORT ====================

@router.get("/admin/users/{user_id}/intelligence/pdf")
async def export_user_intelligence_pdf(
    user_id: str,
    admin_user: dict = Depends(_admin_auth)
):
    """Generate a professional PDF report for the user."""
    from fpdf import FPDF

    # Get intelligence data
    intel_resp = await get_user_intelligence(user_id, "all", admin_user)
    data = intel_resp["data"]
    info = data["user_info"]
    engagement = data["engagement"]
    atlas = data["atlas"]
    learning = data["learning"]
    revenue = data["revenue"]
    timeline = data["timeline"][:30]

    class MentovaPDF(FPDF):
        def _safe(self, text):
            """Sanitize text for latin-1 compatible PDF font."""
            s = str(text) if text is not None else "N/A"
            replacements = {
                '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"',
                '\u2014': '-', '\u2013': '-', '\u2026': '...', '\u00a0': ' ',
                '\u2022': '-', '\u00e9': 'e', '\u00e8': 'e', '\u00ea': 'e',
                '\u00e0': 'a', '\u00e2': 'a', '\u00f4': 'o', '\u00fb': 'u',
                '\u00e7': 'c', '\u00ee': 'i', '\u00ef': 'i', '\u00f9': 'u',
            }
            for k, v in replacements.items():
                s = s.replace(k, v)
            # Final fallback: strip any remaining non-latin1 chars
            return s.encode('latin-1', errors='replace').decode('latin-1')

        def header(self):
            self.set_font('Helvetica', 'B', 20)
            self.set_text_color(124, 58, 237)
            self.cell(0, 10, 'MENTOVA ACADEMY', new_x="LMARGIN", new_y="NEXT", align='L')
            self.set_font('Helvetica', '', 10)
            self.set_text_color(100, 100, 100)
            self.cell(0, 6, 'User Intelligence Report', new_x="LMARGIN", new_y="NEXT", align='L')
            self.line(10, self.get_y() + 2, 200, self.get_y() + 2)
            self.ln(6)

        def footer(self):
            self.set_y(-15)
            self.set_font('Helvetica', 'I', 8)
            self.set_text_color(150, 150, 150)
            self.cell(0, 10, f'Page {self.page_no()} | Generated {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")} | Confidential', align='C')

        def section_title(self, title):
            self.set_font('Helvetica', 'B', 13)
            self.set_text_color(15, 23, 42)
            self.set_fill_color(243, 244, 246)
            self.cell(0, 9, f'  {title}', new_x="LMARGIN", new_y="NEXT", fill=True)
            self.ln(3)

        def info_row(self, label, value):
            self.set_font('Helvetica', '', 9)
            self.set_text_color(100, 100, 100)
            self.cell(60, 6, self._safe(label), new_x="RIGHT")
            self.set_text_color(15, 23, 42)
            self.set_font('Helvetica', 'B', 9)
            self.cell(0, 6, self._safe(value), new_x="LMARGIN", new_y="NEXT")

    pdf = MentovaPDF()
    pdf.add_page()

    # Summary
    pdf.set_font('Helvetica', 'I', 10)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(0, 5, pdf._safe(data["summary"]))
    pdf.ln(4)

    # Engagement Score Badge
    score = engagement.get("engagement_score", 0)
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(124, 58, 237)
    pdf.cell(0, 8, f'Engagement Score: {score}/100 ({engagement.get("engagement_level", "N/A")})', new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # USER INFORMATION
    pdf.section_title('USER INFORMATION')
    pdf.info_row('User ID', info.get("user_id"))
    pdf.info_row('Name', info.get("name"))
    pdf.info_row('Email', info.get("email"))
    pdf.info_row('Country', info.get("country"))
    pdf.info_row('Language', info.get("language"))
    pdf.info_row('Account Created', info.get("created_at", "N/A")[:10] if info.get("created_at") else "N/A")
    pdf.info_row('Account Age', f'{info.get("account_age_days", 0)} days')
    pdf.info_row('Role', info.get("role"))
    pdf.info_row('Plan', "VIP" if info.get("is_vip") else "Free")
    pdf.info_row('VIP Expires', info.get("vip_expires_at", "N/A")[:10] if info.get("vip_expires_at") else "N/A")
    pdf.info_row('Banned', "Yes" if info.get("is_banned") else "No")
    pdf.ln(3)

    # ENGAGEMENT
    pdf.section_title('ENGAGEMENT')
    pdf.info_row('Total Sessions', engagement.get("total_sessions", 0))
    pdf.info_row('Total Time in App', engagement.get("total_time_formatted", "0h 0m"))
    pdf.info_row('Avg Session Duration', engagement.get("average_session_formatted", "0m 0s"))
    pdf.info_row('Active Days', engagement.get("active_days", 0))
    pdf.info_row('Days Since Last Activity', engagement.get("days_since_last_activity", "N/A"))
    pdf.info_row('Engagement Score', f'{score}/100')
    pdf.info_row('Engagement Level', engagement.get("engagement_level", "N/A"))
    pdf.ln(3)

    # ATLAS AI
    pdf.section_title('ATLAS AI')
    pdf.info_row('Conversations', atlas.get("total_conversations", 0))
    pdf.info_row('Total Messages', atlas.get("total_messages", 0))
    pdf.info_row('Avg Messages/Conversation', atlas.get("average_messages_per_conversation", 0))
    pdf.info_row('First Interaction', atlas.get("first_interaction", "N/A")[:10] if atlas.get("first_interaction") else "Never")
    pdf.info_row('Last Interaction', atlas.get("last_interaction", "N/A")[:10] if atlas.get("last_interaction") else "Never")
    pdf.info_row('VIP Features Used', ", ".join(atlas.get("vip_features_used", [])) or "None")
    pdf.ln(3)

    # LEARNING
    pdf.section_title('LEARNING PROGRESS')
    pdf.info_row('Level', learning.get("overall_level", "Unknown"))
    pdf.info_row('Modules Started', learning.get("modules_started", 0))
    pdf.info_row('Modules Completed', learning.get("modules_completed", 0))
    pdf.info_row('Completion %', f'{learning.get("completion_percentage", 0)}%')
    pdf.info_row('Quizzes Completed', learning.get("quizzes_completed", 0))
    pdf.info_row('Average Quiz Score', f'{learning.get("average_quiz_score", 0)}%')
    pdf.info_row('Best Quiz Score', f'{learning.get("best_quiz_score", 0)}%')
    skills = learning.get("skills", {})
    for skill, val in skills.items():
        pdf.info_row(f'  {skill.replace("_", " ").title()}', f'{val}/10')
    pdf.ln(3)

    # REVENUE
    pdf.add_page()
    pdf.section_title('REVENUE & SUBSCRIPTION')
    pdf.info_row('Current Plan', revenue.get("current_plan", "Free"))
    pdf.info_row('Status', revenue.get("subscription_status", "inactive"))
    pdf.info_row('Subscription Start', revenue.get("subscription_start", "N/A")[:10] if revenue.get("subscription_start") else "N/A")
    pdf.info_row('Renewal Date', revenue.get("renewal_date", "N/A")[:10] if revenue.get("renewal_date") else "N/A")
    pdf.info_row('Total Payments', revenue.get("total_payments", 0))
    pdf.info_row('Total Spent', f'${revenue.get("total_spent", 0):.2f} {revenue.get("currency", "USD")}')
    pdf.info_row('Last Payment', f'${revenue.get("last_payment_amount", 0):.2f}' if revenue.get("last_payment_amount") else "N/A")
    pdf.info_row('Last Payment Date', revenue.get("last_payment_date", "N/A")[:10] if revenue.get("last_payment_date") else "N/A")
    pdf.ln(3)

    # ACTIVITY TIMELINE
    pdf.section_title('ACTIVITY TIMELINE (Recent)')
    if timeline:
        for ev in timeline[:20]:
            ts = ev.get("timestamp", "")[:16] if ev.get("timestamp") else ""
            pdf.set_font('Helvetica', '', 8)
            pdf.set_text_color(100, 100, 100)
            pdf.cell(35, 5, pdf._safe(ts))
            pdf.set_text_color(15, 23, 42)
            pdf.set_font('Helvetica', 'B', 8)
            pdf.cell(35, 5, pdf._safe(ev.get("action", "")))
            pdf.set_font('Helvetica', '', 8)
            detail = str(ev.get("detail", ""))[:60]
            pdf.cell(0, 5, pdf._safe(detail), new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.set_font('Helvetica', 'I', 9)
        pdf.cell(0, 6, 'No activity recorded', new_x="LMARGIN", new_y="NEXT")

    # Disclaimer
    pdf.ln(8)
    pdf.set_font('Helvetica', 'I', 7)
    pdf.set_text_color(150, 150, 150)
    pdf.multi_cell(0, 4, 'This report contains analytics generated from Mentova Academy internal systems. Data is accurate as of the report generation date. This document is confidential and intended for authorized administrators only. No passwords, authentication tokens, or complete payment card information are included.')

    # Output
    pdf_bytes = pdf.output()
    name = info.get("name", "user").replace(" ", "_")
    filename = f"mentova_intelligence_{name}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"

    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ==================== FULL DATA EXPORT (LITIGATION / LEGAL) ====================

@router.get("/admin/users/{user_id}/full-export")
async def export_user_full_data(
    user_id: str,
    admin_user: dict = Depends(_admin_auth)
):
    """Export ALL user data as JSON for legal/litigation purposes.
    This is a complete data dump of everything Mentova has collected about this user.
    """
    database = _db()
    if database is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user = await database.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)

    # Helper to serialize MongoDB docs
    def serialize_docs(docs):
        result = []
        for d in docs:
            row = {}
            for k, v in d.items():
                if k == "_id":
                    continue
                if isinstance(v, datetime):
                    row[k] = v.isoformat()
                else:
                    row[k] = v
            result.append(row)
        return result

    # Collect ALL data from ALL collections
    export = {
        "_metadata": {
            "export_type": "full_user_data_export",
            "purpose": "Legal / Litigation / Data Request",
            "user_id": user_id,
            "exported_at": now.isoformat(),
            "exported_by": admin_user.get("email", "admin"),
            "disclaimer": "This export contains all data collected by Mentova Academy about this user at the time of export. No passwords or authentication tokens are included."
        },
        "user_account": user,
        "learning_profile": await database.user_learning_profiles.find_one({"user_id": user_id}, {"_id": 0}),
        "atlas_conversations": serialize_docs(await database.atlas_conversations.find({"user_id": user_id}, {"_id": 0}).to_list(10000)),
        "atlas_memories": serialize_docs(await database.atlas_memories.find({"user_id": user_id}, {"_id": 0}).to_list(10000)),
        "learning_modules": serialize_docs(await database.learning_modules.find({"user_id": user_id}, {"_id": 0}).to_list(1000)),
        "module_progress": serialize_docs(await database.module_progress.find({"user_id": user_id}, {"_id": 0}).to_list(1000)),
        "quiz_attempts": serialize_docs(await database.quiz_attempts.find({"user_id": user_id}, {"_id": 0}).to_list(1000)),
        "daily_briefings": serialize_docs(await database.daily_briefings.find({"user_id": user_id}, {"_id": 0}).to_list(1000)),
        "subscriptions": serialize_docs(await database.subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(100)),
        "payment_transactions": serialize_docs(await database.payment_transactions.find({"user_id": user_id}, {"_id": 0}).to_list(1000)),
        "user_sessions": serialize_docs(await database.user_sessions.find({"user_id": user_id}, {"_id": 0}).to_list(10000)),
        "user_events": serialize_docs(await database.user_events.find({"user_id": user_id}, {"_id": 0}).to_list(50000)),
        "community_posts": serialize_docs(await database.community_posts.find({"author_id": user_id}, {"_id": 0}).to_list(1000)),
        "community_comments": serialize_docs(await database.community_comments.find({"author_id": user_id}, {"_id": 0}).to_list(5000)),
        "notifications": serialize_docs(await database.notifications.find({"user_id": user_id}, {"_id": 0}).to_list(5000)),
        "feedback": serialize_docs(await database.feedback.find({"user_id": user_id}, {"_id": 0}).to_list(100)),
        "admin_logs_about_user": serialize_docs(await database.admin_logs.find({"target_id": user_id}, {"_id": 0}).to_list(1000)),
    }

    # Convert all datetime fields in user_account
    for k, v in export["user_account"].items():
        if isinstance(v, datetime):
            export["user_account"][k] = v.isoformat()

    if export["learning_profile"]:
        for k, v in export["learning_profile"].items():
            if isinstance(v, datetime):
                export["learning_profile"][k] = v.isoformat()

    json_bytes = json.dumps(export, indent=2, default=str, ensure_ascii=False).encode("utf-8")
    name = user.get("name", "user").replace(" ", "_")
    filename = f"mentova_full_export_{name}_{now.strftime('%Y%m%d_%H%M%S')}.json"

    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ==================== GLOBAL ANALYTICS (Admin Dashboard) ====================

@router.get("/admin/intelligence/global")
async def get_global_intelligence(admin_user: dict = Depends(_admin_auth)):
    """Global user intelligence metrics for the admin dashboard."""
    database = _db()
    if database is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    total_users = await database.users.count_documents({})
    vip_users = await database.users.count_documents({"is_vip": True})
    total_sessions = await database.user_sessions.count_documents({})

    # Average session duration
    pipeline = [
        {"$match": {"duration_seconds": {"$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$duration_seconds"}, "total": {"$sum": "$duration_seconds"}}}
    ]
    session_agg = await database.user_sessions.aggregate(pipeline).to_list(1)
    avg_session = session_agg[0]["avg"] if session_agg else 0
    total_time = session_agg[0]["total"] if session_agg else 0

    # Atlas stats
    total_conversations = await database.atlas_conversations.count_documents({})

    # Learning stats
    total_modules = await database.learning_modules.count_documents({})
    completed_modules = await database.learning_modules.count_documents({"status": {"$in": ["completed", "mastered"]}})

    return {
        "success": True,
        "data": {
            "total_users": total_users,
            "vip_users": vip_users,
            "free_users": total_users - vip_users,
            "vip_conversion_rate": round((vip_users / max(1, total_users)) * 100, 1),
            "total_sessions": total_sessions,
            "avg_session_duration": round(avg_session),
            "avg_session_formatted": f"{int(avg_session // 60)}m {int(avg_session % 60)}s",
            "total_app_time_hours": round(total_time / 3600, 1),
            "total_conversations": total_conversations,
            "total_modules": total_modules,
            "completed_modules": completed_modules,
            "module_completion_rate": round((completed_modules / max(1, total_modules)) * 100, 1),
        }
    }


# ==================== DB INDEXES ====================

async def ensure_intelligence_indexes():
    """Create indexes for the user intelligence system."""
    database = _db()
    if database is None:
        return
    try:
        await database.user_events.create_index("user_id")
        await database.user_events.create_index([("user_id", 1), ("event_type", 1)])
        await database.user_events.create_index("timestamp", expireAfterSeconds=7776000)  # 90 day TTL
        await database.user_sessions.create_index("user_id")
        await database.user_sessions.create_index("started_at")
        logger.info("User intelligence indexes created")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
