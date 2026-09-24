"""
Mentova Progression Service — XP, Levels, Badges, Daily Goals, Weekly Challenges
Core engine for the Progression Hub. All progression logic is centralized here.
"""
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger("progression")

# ─── XP REWARDS (configurable) ───────────────────────────
XP_REWARDS = {
    "MODULE_STARTED": 10,
    "MODULE_COMPLETED": 25,
    "MODULE_MASTERED": 100,
    "QUIZ_COMPLETED": 30,
    "QUIZ_PERFECT": 50,
    "DAILY_GOAL_COMPLETED": 50,
    "WEEKLY_CHALLENGE_COMPLETED": 200,
    "PATH_COMPLETED": 500,
    "STREAK_3": 30,
    "STREAK_7": 75,
    "STREAK_14": 150,
    "STREAK_30": 300,
    "FIRST_MODULE": 50,
    "FIRST_QUIZ": 25,
}

# ─── LEVELS ──────────────────────────────────────────────
LEVELS = [
    {"level": 1, "name_fr": "Curieux",        "name_en": "Curious",       "name_es": "Curioso",        "xp_threshold": 0,     "color": "#64748B"},
    {"level": 2, "name_fr": "Explorateur",     "name_en": "Explorer",      "name_es": "Explorador",     "xp_threshold": 100,   "color": "#10B981"},
    {"level": 3, "name_fr": "D\u00e9butant",   "name_en": "Beginner",      "name_es": "Principiante",   "xp_threshold": 300,   "color": "#3B82F6"},
    {"level": 4, "name_fr": "Apprenti",        "name_en": "Apprentice",    "name_es": "Aprendiz",       "xp_threshold": 600,   "color": "#8B5CF6"},
    {"level": 5, "name_fr": "Initi\u00e9",     "name_en": "Initiate",      "name_es": "Iniciado",       "xp_threshold": 1000,  "color": "#F59E0B"},
    {"level": 6, "name_fr": "Interm\u00e9diaire", "name_en": "Intermediate", "name_es": "Intermedio",   "xp_threshold": 1800,  "color": "#EF4444"},
    {"level": 7, "name_fr": "Analyste",        "name_en": "Analyst",       "name_es": "Analista",       "xp_threshold": 3000,  "color": "#EC4899"},
    {"level": 8, "name_fr": "Avanc\u00e9",     "name_en": "Advanced",      "name_es": "Avanzado",       "xp_threshold": 5000,  "color": "#F97316"},
    {"level": 9, "name_fr": "Ma\u00eetre",     "name_en": "Master",        "name_es": "Maestro",        "xp_threshold": 8000,  "color": "#FFD700"},
]

# ─── BADGE DEFINITIONS (30+ badges) ─────────────────────
BADGE_DEFS = [
    # FIRST STEPS
    {"id": "first_day",       "cat": "first_steps", "icon": "sunny",          "threshold": 1, "metric": "days_active",       "name_fr": "Premier jour",              "name_en": "First Day",                "name_es": "Primer d\u00eda"},
    {"id": "first_module",    "cat": "first_steps", "icon": "book",           "threshold": 1, "metric": "modules_completed", "name_fr": "Premier module",            "name_en": "First Module",             "name_es": "Primer m\u00f3dulo"},
    {"id": "first_quiz",      "cat": "first_steps", "icon": "ribbon",         "threshold": 1, "metric": "quiz_count",        "name_fr": "Premier quiz",              "name_en": "First Quiz",               "name_es": "Primer quiz"},
    {"id": "first_perfect",   "cat": "first_steps", "icon": "flash",          "threshold": 1, "metric": "perfect_scores",    "name_fr": "Premi\u00e8re note parfaite", "name_en": "First Perfect Score",    "name_es": "Primera nota perfecta"},
    {"id": "first_mastery",   "cat": "first_steps", "icon": "school",         "threshold": 1, "metric": "modules_mastered",  "name_fr": "Premi\u00e8re ma\u00eetrise", "name_en": "First Mastery",          "name_es": "Primera maestr\u00eda"},
    # QUIZ
    {"id": "quiz_5",          "cat": "quiz",        "icon": "medal",          "threshold": 5,   "metric": "quiz_count",      "name_fr": "5 quiz",                    "name_en": "5 Quizzes",                "name_es": "5 quiz"},
    {"id": "quiz_10",         "cat": "quiz",        "icon": "medal",          "threshold": 10,  "metric": "quiz_count",      "name_fr": "10 quiz",                   "name_en": "10 Quizzes",               "name_es": "10 quiz"},
    {"id": "quiz_25",         "cat": "quiz",        "icon": "trophy",         "threshold": 25,  "metric": "quiz_count",      "name_fr": "25 quiz",                   "name_en": "25 Quizzes",               "name_es": "25 quiz"},
    {"id": "quiz_50",         "cat": "quiz",        "icon": "trophy",         "threshold": 50,  "metric": "quiz_count",      "name_fr": "50 quiz",                   "name_en": "50 Quizzes",               "name_es": "50 quiz"},
    {"id": "quiz_100",        "cat": "quiz",        "icon": "star",           "threshold": 100, "metric": "quiz_count",      "name_fr": "100 quiz",                  "name_en": "100 Quizzes",              "name_es": "100 quiz"},
    # MODULES
    {"id": "modules_5",       "cat": "modules",     "icon": "library",        "threshold": 5,   "metric": "modules_completed", "name_fr": "5 modules",              "name_en": "5 Modules",                "name_es": "5 m\u00f3dulos"},
    {"id": "modules_10",      "cat": "modules",     "icon": "library",        "threshold": 10,  "metric": "modules_completed", "name_fr": "10 modules",             "name_en": "10 Modules",               "name_es": "10 m\u00f3dulos"},
    {"id": "modules_25",      "cat": "modules",     "icon": "library",        "threshold": 25,  "metric": "modules_completed", "name_fr": "25 modules",             "name_en": "25 Modules",               "name_es": "25 m\u00f3dulos"},
    {"id": "mastered_5",      "cat": "modules",     "icon": "checkmark-done", "threshold": 5,   "metric": "modules_mastered",  "name_fr": "5 ma\u00eetris\u00e9s",  "name_en": "5 Mastered",               "name_es": "5 dominados"},
    {"id": "mastered_10",     "cat": "modules",     "icon": "checkmark-done", "threshold": 10,  "metric": "modules_mastered",  "name_fr": "10 ma\u00eetris\u00e9s", "name_en": "10 Mastered",              "name_es": "10 dominados"},
    # STREAK
    {"id": "streak_3",        "cat": "streak",      "icon": "flame",          "threshold": 3,   "metric": "streak",          "name_fr": "3 jours",                   "name_en": "3 Days",                   "name_es": "3 d\u00edas"},
    {"id": "streak_7",        "cat": "streak",      "icon": "flame",          "threshold": 7,   "metric": "streak",          "name_fr": "7 jours",                   "name_en": "7 Days",                   "name_es": "7 d\u00edas"},
    {"id": "streak_14",       "cat": "streak",      "icon": "bonfire",        "threshold": 14,  "metric": "streak",          "name_fr": "14 jours",                  "name_en": "14 Days",                  "name_es": "14 d\u00edas"},
    {"id": "streak_30",       "cat": "streak",      "icon": "bonfire",        "threshold": 30,  "metric": "streak",          "name_fr": "30 jours",                  "name_en": "30 Days",                  "name_es": "30 d\u00edas"},
    {"id": "streak_60",       "cat": "streak",      "icon": "diamond",        "threshold": 60,  "metric": "streak",          "name_fr": "60 jours",                  "name_en": "60 Days",                  "name_es": "60 d\u00edas"},
    {"id": "streak_90",       "cat": "streak",      "icon": "diamond",        "threshold": 90,  "metric": "streak",          "name_fr": "90 jours",                  "name_en": "90 Days",                  "name_es": "90 d\u00edas"},
    # EXCELLENCE
    {"id": "perfect_5",       "cat": "excellence",  "icon": "flash",          "threshold": 5,   "metric": "perfect_scores",  "name_fr": "5 scores parfaits",         "name_en": "5 Perfect Scores",         "name_es": "5 notas perfectas"},
    {"id": "perfect_10",      "cat": "excellence",  "icon": "flash",          "threshold": 10,  "metric": "perfect_scores",  "name_fr": "10 scores parfaits",        "name_en": "10 Perfect Scores",        "name_es": "10 notas perfectas"},
    # MASTERY (skill-based)
    {"id": "finance_found",   "cat": "mastery",     "icon": "cash",           "threshold": 3,   "metric": "skill_finance",   "name_fr": "Finance : Fondations",      "name_en": "Finance Foundations",       "name_es": "Finanzas: Fundamentos"},
    {"id": "crypto_found",    "cat": "mastery",     "icon": "logo-bitcoin",   "threshold": 3,   "metric": "skill_crypto",    "name_fr": "Crypto : Fondations",       "name_en": "Crypto Foundations",        "name_es": "Crypto: Fundamentos"},
    {"id": "blockchain_found","cat": "mastery",     "icon": "cube",           "threshold": 3,   "metric": "skill_blockchain","name_fr": "Blockchain : Fondations",   "name_en": "Blockchain Foundations",    "name_es": "Blockchain: Fundamentos"},
    {"id": "risk_found",      "cat": "mastery",     "icon": "shield-checkmark","threshold": 3,  "metric": "skill_risk",      "name_fr": "Risques : Fondations",      "name_en": "Risk Foundations",          "name_es": "Riesgos: Fundamentos"},
    {"id": "trading_found",   "cat": "mastery",     "icon": "trending-up",    "threshold": 3,   "metric": "skill_trading",   "name_fr": "Trading : Fondations",      "name_en": "Trading Foundations",       "name_es": "Trading: Fundamentos"},
    # XP MILESTONES
    {"id": "xp_500",          "cat": "milestones",  "icon": "rocket",         "threshold": 500,  "metric": "total_xp",       "name_fr": "500 XP",                    "name_en": "500 XP",                   "name_es": "500 XP"},
    {"id": "xp_1000",         "cat": "milestones",  "icon": "rocket",         "threshold": 1000, "metric": "total_xp",       "name_fr": "1 000 XP",                  "name_en": "1,000 XP",                 "name_es": "1.000 XP"},
    {"id": "xp_2500",         "cat": "milestones",  "icon": "planet",         "threshold": 2500, "metric": "total_xp",       "name_fr": "2 500 XP",                  "name_en": "2,500 XP",                 "name_es": "2.500 XP"},
    {"id": "xp_5000",         "cat": "milestones",  "icon": "planet",         "threshold": 5000, "metric": "total_xp",       "name_fr": "5 000 XP",                  "name_en": "5,000 XP",                 "name_es": "5.000 XP"},
]

# ─── DAILY GOAL TEMPLATES ────────────────────────────────
DAILY_GOAL_TEMPLATES = [
    {"type": "complete_lesson",  "target": 1, "xp": 20, "name_fr": "Terminer une le\u00e7on",      "name_en": "Complete a lesson",     "name_es": "Completar una lecci\u00f3n"},
    {"type": "answer_questions", "target": 5, "xp": 15, "name_fr": "R\u00e9pondre \u00e0 5 questions", "name_en": "Answer 5 questions", "name_es": "Responder 5 preguntas"},
    {"type": "master_concept",   "target": 1, "xp": 25, "name_fr": "Ma\u00eetriser une notion",    "name_en": "Master a concept",      "name_es": "Dominar un concepto"},
]

_db = None

def init_progression(db):
    global _db
    _db = db
    logger.info("Progression service initialized")


def _utcnow():
    return datetime.now(timezone.utc)


def _today_str():
    return _utcnow().strftime("%Y-%m-%d")


def get_level_for_xp(xp: int) -> dict:
    """Get the level info for a given XP amount."""
    current = LEVELS[0]
    for lvl in LEVELS:
        if xp >= lvl["xp_threshold"]:
            current = lvl
        else:
            break
    # Next level
    idx = LEVELS.index(current)
    next_lvl = LEVELS[idx + 1] if idx + 1 < len(LEVELS) else None
    return {
        "level": current["level"],
        "name_fr": current["name_fr"],
        "name_en": current["name_en"],
        "name_es": current["name_es"],
        "color": current["color"],
        "xp_threshold": current["xp_threshold"],
        "next_level": next_lvl,
    }


async def award_xp(user_id: str, action_type: str, action_id: str, description: str = "", extra_xp: int = 0) -> dict:
    """Award XP for an action. Idempotent — same action_id won't award twice."""
    xp_amount = XP_REWARDS.get(action_type, 0) + extra_xp
    if xp_amount <= 0:
        return {"awarded": False, "reason": "no_xp_for_action"}

    # Idempotency check
    existing = await _db.xp_transactions.find_one({"user_id": user_id, "action_id": action_id})
    if existing:
        return {"awarded": False, "reason": "already_awarded", "xp": 0}

    # Record transaction
    txn = {
        "user_id": user_id,
        "action_id": action_id,
        "action_type": action_type,
        "xp_amount": xp_amount,
        "description": description,
        "created_at": _utcnow(),
    }
    await _db.xp_transactions.insert_one(txn)

    # Update user total XP
    result = await _db.users.find_one_and_update(
        {"id": user_id},
        {"$inc": {"total_xp": xp_amount}},
        return_document=True,
    )
    new_total = result.get("total_xp", xp_amount) if result else xp_amount

    # Check level up
    old_level = get_level_for_xp(new_total - xp_amount)
    new_level = get_level_for_xp(new_total)
    leveled_up = new_level["level"] > old_level["level"]

    if leveled_up:
        await _db.users.update_one({"id": user_id}, {"$set": {"progression_level": new_level["level"]}})

    return {
        "awarded": True,
        "xp": xp_amount,
        "total_xp": new_total,
        "leveled_up": leveled_up,
        "new_level": new_level if leveled_up else None,
    }


async def get_xp_history(user_id: str, limit: int = 20) -> list:
    """Get recent XP transactions."""
    cursor = _db.xp_transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


async def compute_metrics(user_id: str) -> dict:
    """Compute all metrics for badge evaluation."""
    # Modules
    modules_completed = await _db.learning_modules.count_documents({"user_id": user_id, "status": {"$in": ["completed", "mastered"]}})
    modules_mastered = await _db.learning_modules.count_documents({"user_id": user_id, "status": "mastered"})

    # Quizzes
    quiz_count = await _db.quiz_attempts.count_documents({"user_id": user_id})
    perfect_scores = await _db.quiz_attempts.count_documents({"user_id": user_id, "score": {"$gte": 100}})

    # Streak
    quiz_dates = []
    async for doc in _db.quiz_attempts.find({"user_id": user_id}, {"created_at": 1}):
        ca = doc.get("created_at")
        if ca:
            if isinstance(ca, str):
                try:
                    ca = datetime.fromisoformat(ca.replace("Z", "+00:00"))
                except ValueError:
                    continue
            quiz_dates.append(ca)

    from routes.atlas_v3 import _compute_streak
    streak = _compute_streak(quiz_dates)

    # Best streak (stored)
    user = await _db.users.find_one({"id": user_id}, {"streak_best": 1, "total_xp": 1, "progress": 1})
    streak_best = max(user.get("streak_best", 0), streak) if user else streak
    if user and streak > user.get("streak_best", 0):
        await _db.users.update_one({"id": user_id}, {"$set": {"streak_best": streak}})

    total_xp = user.get("total_xp", 0) if user else 0

    # Skills from user profile
    profile = user.get("progress", {}) if user else {}
    # Also check atlas profile
    atlas_profile = await _db.atlas_profiles.find_one({"user_id": user_id}) or {}

    # Days active - count unique dates from quiz_attempts and module updates
    days_active = 1  # At least 1 if registered
    try:
        quiz_dates_set = set()
        async for doc in _db.quiz_attempts.find({"user_id": user_id}, {"created_at": 1}):
            ca = doc.get("created_at")
            if ca:
                if isinstance(ca, str):
                    quiz_dates_set.add(ca[:10])
                elif hasattr(ca, "strftime"):
                    quiz_dates_set.add(ca.strftime("%Y-%m-%d"))
        async for doc in _db.module_progress.find({"user_id": user_id, "updated_at": {"$exists": True}}, {"updated_at": 1}):
            ua = doc.get("updated_at")
            if ua:
                if isinstance(ua, str):
                    quiz_dates_set.add(ua[:10])
                elif hasattr(ua, "strftime"):
                    quiz_dates_set.add(ua.strftime("%Y-%m-%d"))
        if quiz_dates_set:
            days_active = len(quiz_dates_set)
    except Exception:
        pass

    return {
        "modules_completed": modules_completed,
        "modules_mastered": modules_mastered,
        "quiz_count": quiz_count,
        "perfect_scores": perfect_scores,
        "streak": streak,
        "streak_best": streak_best,
        "total_xp": total_xp,
        "days_active": days_active,
        "skill_finance": atlas_profile.get("finance_level", 0),
        "skill_crypto": atlas_profile.get("crypto_level", 0),
        "skill_blockchain": atlas_profile.get("blockchain_level", 0),
        "skill_trading": atlas_profile.get("trading_level", 0),
        "skill_risk": atlas_profile.get("risk_management_level", 0),
    }


async def compute_badges(user_id: str, metrics: dict) -> list:
    """Compute all badges with progress."""
    badges = []
    for bdef in BADGE_DEFS:
        metric_val = metrics.get(bdef["metric"], 0)
        earned = metric_val >= bdef["threshold"]
        progress = min(metric_val / bdef["threshold"], 1.0) if bdef["threshold"] > 0 else 0
        badges.append({
            "id": bdef["id"],
            "category": bdef["cat"],
            "icon": bdef["icon"],
            "name_fr": bdef["name_fr"],
            "name_en": bdef["name_en"],
            "name_es": bdef["name_es"],
            "threshold": bdef["threshold"],
            "metric": bdef["metric"],
            "current_value": metric_val,
            "earned": earned,
            "progress": round(progress, 2),
        })
    return badges


async def get_daily_goals(user_id: str) -> dict:
    """Get or create today's daily goals."""
    today = _today_str()
    existing = await _db.daily_goals.find_one({"user_id": user_id, "date": today}, {"_id": 0})
    if existing:
        return existing

    # Create today's goals
    goals = []
    for tmpl in DAILY_GOAL_TEMPLATES:
        goals.append({
            "id": f"{tmpl['type']}_{today}",
            "type": tmpl["type"],
            "target": tmpl["target"],
            "current": 0,
            "completed": False,
            "xp_reward": tmpl["xp"],
            "name_fr": tmpl["name_fr"],
            "name_en": tmpl["name_en"],
            "name_es": tmpl["name_es"],
        })

    doc = {
        "user_id": user_id,
        "date": today,
        "goals": goals,
        "all_completed": False,
        "bonus_xp": XP_REWARDS["DAILY_GOAL_COMPLETED"],
    }
    await _db.daily_goals.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_daily_goal_progress(user_id: str, goal_type: str, increment: int = 1):
    """Update progress on a daily goal."""
    today = _today_str()
    daily = await _db.daily_goals.find_one({"user_id": user_id, "date": today})
    if not daily:
        return

    goals = daily.get("goals", [])
    updated = False
    for g in goals:
        if g["type"] == goal_type and not g["completed"]:
            g["current"] = min(g["current"] + increment, g["target"])
            if g["current"] >= g["target"]:
                g["completed"] = True
                # Award XP for individual goal
                await award_xp(user_id, "DAILY_GOAL_ITEM", f"daily_goal_{g['id']}", f"Daily goal: {goal_type}", g["xp_reward"])
            updated = True

    if updated:
        all_done = all(g["completed"] for g in goals)
        await _db.daily_goals.update_one(
            {"user_id": user_id, "date": today},
            {"$set": {"goals": goals, "all_completed": all_done}}
        )
        # Bonus for completing ALL daily goals
        if all_done:
            await award_xp(user_id, "DAILY_GOAL_COMPLETED", f"daily_all_{today}", "All daily goals completed")


async def get_weekly_challenge(user_id: str) -> Optional[dict]:
    """Get current week's challenge."""
    today = _utcnow().date()
    week_start = (today - timedelta(days=today.weekday())).isoformat()
    existing = await _db.weekly_challenges.find_one({"user_id": user_id, "week_start": week_start}, {"_id": 0})
    return existing


async def get_progression_hub(user_id: str, lang: str = "fr") -> dict:
    """Get the complete Progression Hub data for a user."""
    metrics = await compute_metrics(user_id)
    badges = await compute_badges(user_id, metrics)
    daily = await get_daily_goals(user_id)
    weekly = await get_weekly_challenge(user_id)
    xp_history = await get_xp_history(user_id, limit=10)

    total_xp = metrics["total_xp"]
    level_info = get_level_for_xp(total_xp)

    # XP to next level
    next_lvl = level_info["next_level"]
    xp_for_next = next_lvl["xp_threshold"] - total_xp if next_lvl else 0
    xp_progress = 0
    if next_lvl:
        range_xp = next_lvl["xp_threshold"] - level_info["xp_threshold"]
        current_in_range = total_xp - level_info["xp_threshold"]
        xp_progress = round(current_in_range / range_xp, 2) if range_xp > 0 else 1.0

    # Modules summary
    total_modules = await _db.learning_modules.count_documents({"user_id": user_id})
    in_progress = await _db.learning_modules.count_documents({"user_id": user_id, "status": "in_progress"})

    # Recent modules
    recent_modules = []
    async for doc in _db.learning_modules.find({"user_id": user_id}).sort("updated_at", -1).limit(5):
        recent_modules.append({
            "id": doc.get("id", ""),
            "title": doc.get("title", ""),
            "status": doc.get("status", "not_started"),
            "category": doc.get("category", ""),
            "mastery_score": doc.get("mastery_score", 0),
        })

    # Recently learned concepts
    recent_concepts = []
    async for doc in _db.learning_modules.find(
        {"user_id": user_id, "status": {"$in": ["completed", "mastered"]}},
        {"title": 1, "category": 1}
    ).sort("updated_at", -1).limit(8):
        recent_concepts.append(doc.get("title", ""))

    # Skills
    name_key = f"name_{lang}"
    skills = [
        {"key": "finance",    "score": metrics["skill_finance"],    "icon": "cash",            "name_fr": "Finance",           "name_en": "Finance",          "name_es": "Finanzas"},
        {"key": "crypto",     "score": metrics["skill_crypto"],     "icon": "logo-bitcoin",    "name_fr": "Crypto",            "name_en": "Crypto",           "name_es": "Crypto"},
        {"key": "blockchain", "score": metrics["skill_blockchain"], "icon": "cube",            "name_fr": "Blockchain",        "name_en": "Blockchain",       "name_es": "Blockchain"},
        {"key": "trading",    "score": metrics["skill_trading"],    "icon": "trending-up",     "name_fr": "Trading",           "name_en": "Trading",          "name_es": "Trading"},
        {"key": "risk",       "score": metrics["skill_risk"],       "icon": "shield-checkmark","name_fr": "Gestion des risques","name_en": "Risk Management", "name_es": "Gesti\u00f3n de riesgos"},
    ]

    # Priority recommendation
    priority = None
    if in_progress > 0:
        # Resume current module
        current_mod = await _db.learning_modules.find_one({"user_id": user_id, "status": "in_progress"}, sort=[("updated_at", -1)])
        if current_mod:
            priority = {"type": "resume_module", "title": current_mod.get("title", ""), "module_id": current_mod.get("id", "")}
    elif metrics["modules_completed"] == 0:
        priority = {"type": "start_learning", "title": ""}
    else:
        # Check for weak skills
        weakest = min(skills, key=lambda s: s["score"])
        if weakest["score"] < 5:
            priority = {"type": "strengthen_skill", "skill": weakest["key"], "title": weakest.get(name_key, weakest["name_en"])}

    # "Almost unlocked" hints
    almost_unlocked = []
    for b in badges:
        if not b["earned"] and b["progress"] >= 0.6:
            remaining = b["threshold"] - b["current_value"]
            almost_unlocked.append({
                "badge_id": b["id"],
                "name": b.get(name_key, b["name_en"]),
                "remaining": remaining,
                "metric": b["metric"],
            })

    # Badge counts by category
    earned_count = sum(1 for b in badges if b["earned"])

    # Quiz stats
    avg_score = 0
    quiz_count = metrics["quiz_count"]
    if quiz_count > 0:
        total_score = 0
        count = 0
        async for doc in _db.quiz_attempts.find({"user_id": user_id}, {"score": 1}):
            s = doc.get("score", 0)
            if isinstance(s, (int, float)):
                total_score += s
                count += 1
        avg_score = round(total_score / count, 1) if count > 0 else 0

    return {
        # Level & XP
        "level": level_info["level"],
        "level_name_fr": level_info["name_fr"],
        "level_name_en": level_info["name_en"],
        "level_name_es": level_info["name_es"],
        "level_color": level_info["color"],
        "total_xp": total_xp,
        "xp_for_next_level": xp_for_next,
        "xp_progress": xp_progress,
        "next_level": {"level": next_lvl["level"], "name_fr": next_lvl["name_fr"], "name_en": next_lvl["name_en"], "name_es": next_lvl["name_es"], "xp_threshold": next_lvl["xp_threshold"]} if next_lvl else None,

        # Streak
        "streak": metrics["streak"],
        "streak_best": metrics["streak_best"],

        # 3 dimensions
        "progression_pct": round((metrics["modules_completed"] / max(total_modules, 1)) * 100) if total_modules > 0 else 0,
        "mastery_pct": round((metrics["modules_mastered"] / max(metrics["modules_completed"], 1)) * 100) if metrics["modules_completed"] > 0 else 0,
        "regularity_days": metrics["streak"],

        # Priority & Next step
        "priority": priority,
        "almost_unlocked": almost_unlocked[:3],

        # Skills
        "skills": skills,

        # Badges
        "badges": badges,
        "badges_earned": earned_count,
        "badges_total": len(BADGE_DEFS),

        # Modules
        "modules_total": total_modules,
        "modules_in_progress": in_progress,
        "modules_completed": metrics["modules_completed"],
        "modules_mastered": metrics["modules_mastered"],
        "recent_modules": recent_modules,

        # Daily & Weekly
        "daily_goals": daily,
        "weekly_challenge": weekly,

        # Stats
        "stats": {
            "days_active": metrics["days_active"],
            "quiz_count": quiz_count,
            "avg_quiz_score": avg_score,
            "perfect_scores": metrics["perfect_scores"],
        },

        # Recent
        "recent_concepts": recent_concepts,
        "xp_history": xp_history,
    }


async def migrate_existing_user(user_id: str):
    """Migrate an existing user's data to the new XP system. Idempotent."""
    # Check if already migrated
    existing_xp = await _db.xp_transactions.count_documents({"user_id": user_id, "action_type": "MIGRATION"})
    if existing_xp > 0:
        return {"migrated": False, "reason": "already_migrated"}

    total_xp = 0

    # Award XP for completed modules
    async for mod in _db.learning_modules.find({"user_id": user_id, "status": {"$in": ["completed", "mastered"]}}):
        mod_id = mod.get("id", "")
        result = await award_xp(user_id, "MODULE_COMPLETED", f"migration_mod_{mod_id}", f"Module: {mod.get('title', '')}")
        if result["awarded"]:
            total_xp += result["xp"]
        if mod.get("status") == "mastered":
            result2 = await award_xp(user_id, "MODULE_MASTERED", f"migration_mastery_{mod_id}", f"Mastered: {mod.get('title', '')}")
            if result2["awarded"]:
                total_xp += result2["xp"]

    # Award XP for quizzes
    async for quiz in _db.quiz_attempts.find({"user_id": user_id}):
        quiz_id = str(quiz.get("_id", ""))
        score = quiz.get("score", 0)
        result = await award_xp(user_id, "QUIZ_COMPLETED", f"migration_quiz_{quiz_id}", "Quiz completed")
        if result["awarded"]:
            total_xp += result["xp"]
        if score >= 100:
            result2 = await award_xp(user_id, "QUIZ_PERFECT", f"migration_perfect_{quiz_id}", "Perfect quiz score")
            if result2["awarded"]:
                total_xp += result2["xp"]

    # Mark migration
    await _db.xp_transactions.insert_one({
        "user_id": user_id, "action_id": f"migration_{user_id}",
        "action_type": "MIGRATION", "xp_amount": 0,
        "description": f"Migration completed. Total XP awarded: {total_xp}",
        "created_at": _utcnow(),
    })

    return {"migrated": True, "total_xp_awarded": total_xp}
