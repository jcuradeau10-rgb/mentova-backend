"""
Atlas AI Mentor v3 - Persistent personalized learning system with GPT-5.6 Terra
Uses OpenAI function calling for database operations.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os, logging, json, time, uuid
import sys
import jwt
from datetime import datetime, timezone
from openai import AsyncOpenAI
from models.atlas_models import (
    UserLearningProfile, AtlasMemory, AtlasConversation,
    LearningModule, ModuleProgress, QuizAttempt, utcnow,
)

# Ensure services are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.vip_permissions import get_permissions
from services.atlas_protection import (
    check_request_allowed, record_request_start, record_request_end, log_usage,
    should_show_upgrade_prompt, mark_upgrade_prompt_shown, get_free_user_model
)

logger = logging.getLogger("atlas_v3")
atlas_router = APIRouter(prefix="/api/atlas")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "cryptonai_super_secret_key_2025_secure_32bytes")
MODEL = "gpt-5.6-terra"

client = AsyncOpenAI(api_key=OPENAI_API_KEY)
optional_security = HTTPBearer(auto_error=False)

# ============ RATE LIMITING ============
_rate_limits: Dict[str, Dict] = {}
RATE_LIMIT_PER_MINUTE = 10
RATE_LIMIT_PER_DAY = 200

def _check_rate(user_id: str) -> bool:
    now = time.time()
    if user_id not in _rate_limits:
        _rate_limits[user_id] = {"minute": [], "day_count": 0, "day_start": now}
    rl = _rate_limits[user_id]
    if now - rl["day_start"] >= 86400:
        rl["day_count"] = 0
        rl["day_start"] = now
    rl["minute"] = [t for t in rl["minute"] if now - t < 60]
    if len(rl["minute"]) >= RATE_LIMIT_PER_MINUTE or rl["day_count"] >= RATE_LIMIT_PER_DAY:
        return False
    rl["minute"].append(now)
    rl["day_count"] += 1
    return True


# ============ DB HELPER ============
_db_ref = None

def _get_db():
    global _db_ref
    if _db_ref is not None:
        return _db_ref
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from server import db
        _db_ref = db
        return db
    except Exception as e:
        logger.warning(f"DB unavailable: {e}")
        return None


# ============ AUTH ============
async def _get_authenticated_user(credentials: Optional[HTTPAuthorizationCredentials]) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============ TOOL IMPLEMENTATIONS ============

async def tool_get_user_profile(user_id: str) -> dict:
    db = _get_db()
    if db is None:
        return {"error": "Database unavailable"}
    doc = await db.user_learning_profiles.find_one({"user_id": user_id})
    if doc:
        doc.pop("_id", None)
        return doc
    return {"user_id": user_id, "onboarding_completed": False, "overall_level": "unknown"}


async def tool_update_user_profile(user_id: str, updates: dict) -> dict:
    db = _get_db()
    if db is None:
        return {"error": "Database unavailable"}
    updates.pop("user_id", None)
    updates["updated_at"] = utcnow()
    await db.user_learning_profiles.update_one(
        {"user_id": user_id},
        {"$set": updates, "$setOnInsert": {"user_id": user_id, "created_at": utcnow()}},
        upsert=True,
    )
    return {"success": True, "updated_fields": list(updates.keys())}


async def tool_save_memory(user_id: str, memory_type: str, content: str, importance: str = "normal", source: str = "conversation") -> dict:
    db = _get_db()
    if db is None:
        return {"error": "Database unavailable"}
    mem = AtlasMemory(user_id=user_id, memory_type=memory_type, content=content, importance=importance, source=source)
    await db.atlas_memories.insert_one(mem.to_mongo())
    return {"success": True, "memory_id": mem.id}


async def tool_get_memories(user_id: str, limit: int = 20) -> dict:
    db = _get_db()
    if db is None:
        return {"memories": []}
    cursor = db.atlas_memories.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    mems = []
    async for doc in cursor:
        doc.pop("_id", None)
        mems.append(doc)
    return {"memories": mems}


async def tool_get_learning_history(user_id: str) -> dict:
    db = _get_db()
    if db is None:
        return {"modules": [], "quiz_attempts": []}
    modules = []
    async for doc in db.learning_modules.find({"user_id": user_id}).sort("updated_at", -1):
        doc.pop("_id", None)
        modules.append(doc)
    quizzes = []
    async for doc in db.quiz_attempts.find({"user_id": user_id}).sort("created_at", -1).limit(20):
        doc.pop("_id", None)
        quizzes.append(doc)
    return {"modules": modules, "quiz_attempts": quizzes}


async def tool_get_modules(user_id: str, status: str = None) -> dict:
    db = _get_db()
    if db is None:
        return {"modules": []}
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    modules = []
    async for doc in db.learning_modules.find(query).sort("created_at", 1):
        doc.pop("_id", None)
        modules.append(doc)
    return {"modules": modules}


async def tool_create_learning_module(user_id: str, title: str, description: str, level: str, category: str, learning_objective: str, content: str = "", prerequisites: list = None) -> dict:
    db = _get_db()
    if db is None:
        return {"error": "Database unavailable"}
    mod = LearningModule(
        user_id=user_id, title=title, description=description,
        level=level, category=category, learning_objective=learning_objective,
        content=content, prerequisites=prerequisites or [],
    )
    await db.learning_modules.insert_one(mod.to_mongo())
    prog = ModuleProgress(module_id=mod.id, user_id=user_id)
    await db.module_progress.insert_one(prog.to_mongo())
    return {"success": True, "module_id": mod.id, "title": title}


async def tool_update_learning_module(user_id: str, module_id: str, updates: dict) -> dict:
    db = _get_db()
    if db is None:
        return {"error": "Database unavailable"}
    updates.pop("user_id", None)
    updates.pop("id", None)
    updates["updated_at"] = utcnow()
    result = await db.learning_modules.update_one(
        {"id": module_id, "user_id": user_id}, {"$set": updates}
    )
    if result.matched_count == 0:
        return {"error": "Module not found or not owned by user"}
    if "mastery_score" in updates or "status" in updates:
        prog_updates = {"updated_at": utcnow(), "last_activity_at": utcnow()}
        if "mastery_score" in updates:
            prog_updates["mastery_score"] = updates["mastery_score"]
        await db.module_progress.update_one(
            {"module_id": module_id, "user_id": user_id}, {"$set": prog_updates}
        )
    return {"success": True, "module_id": module_id}


async def tool_record_quiz_result(user_id: str, module_id: str, questions_count: int, correct_answers: int, score: float, answers: list = None, difficulty: str = "normal") -> dict:
    db = _get_db()
    if db is None:
        return {"error": "Database unavailable"}
    attempt = QuizAttempt(
        user_id=user_id, module_id=module_id,
        questions_count=questions_count, correct_answers=correct_answers,
        score=score, answers=answers or [], difficulty=difficulty,
    )
    await db.quiz_attempts.insert_one(attempt.to_mongo())
    await db.module_progress.update_one(
        {"module_id": module_id, "user_id": user_id},
        {"$set": {"last_quiz_score": score, "last_activity_at": utcnow(), "updated_at": utcnow()},
         "$max": {"best_quiz_score": score}},
    )
    mod = await db.learning_modules.find_one({"id": module_id, "user_id": user_id})
    if mod:
        await db.learning_modules.update_one(
            {"id": module_id, "user_id": user_id},
            {"$inc": {"attempt_count": 1}, "$set": {"updated_at": utcnow()}}
        )
    return {"success": True, "quiz_id": attempt.id, "score": score}


async def tool_update_mastery(user_id: str, module_id: str, mastery_score: float, concepts_understood: list = None, concepts_weak: list = None) -> dict:
    db = _get_db()
    if db is None:
        return {"error": "Database unavailable"}
    updates = {"mastery_score": mastery_score, "updated_at": utcnow(), "last_activity_at": utcnow()}
    if concepts_understood is not None:
        updates["concepts_understood"] = concepts_understood
    if concepts_weak is not None:
        updates["concepts_weak"] = concepts_weak
        updates["review_required"] = len(concepts_weak) > 0
    await db.module_progress.update_one(
        {"module_id": module_id, "user_id": user_id}, {"$set": updates}
    )
    await db.learning_modules.update_one(
        {"id": module_id, "user_id": user_id},
        {"$set": {"mastery_score": mastery_score, "updated_at": utcnow(),
                  "weak_areas": concepts_weak or []}}
    )
    return {"success": True, "mastery_score": mastery_score}


async def tool_mark_module_mastered(user_id: str, module_id: str) -> dict:
    db = _get_db()
    if db is None:
        return {"error": "Database unavailable"}
    mod = await db.learning_modules.find_one({"id": module_id, "user_id": user_id})
    if not mod:
        return {"error": "Module not found"}
    if mod.get("mastery_score", 0) < 70:
        attempts = await db.quiz_attempts.count_documents({"module_id": module_id, "user_id": user_id})
        if attempts < 2:
            return {"error": "Cannot mark as mastered: insufficient assessments", "current_mastery": mod.get("mastery_score", 0), "attempts": attempts}
    await db.learning_modules.update_one(
        {"id": module_id, "user_id": user_id},
        {"$set": {"status": "mastered", "mastery_score": max(mod.get("mastery_score", 0), 90), "updated_at": utcnow(), "last_reviewed_at": utcnow()}}
    )
    await db.module_progress.update_one(
        {"module_id": module_id, "user_id": user_id},
        {"$set": {"mastery_score": max(mod.get("mastery_score", 0), 90), "review_required": False, "progress_percentage": 100, "updated_at": utcnow()}}
    )
    return {"success": True, "module_id": module_id, "status": "mastered"}


# ============ OPENAI TOOLS SCHEMA ============

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_user_profile",
            "description": "Retrieve the user's learning profile including levels, goals, interests, and preferences. Use this to understand where the user is in their learning journey.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_user_profile",
            "description": "Update the user's learning profile. Use after assessing their level or when they share new preferences/goals.",
            "parameters": {
                "type": "object",
                "properties": {
                    "overall_level": {"type": "string", "enum": ["unknown", "beginner", "intermediate", "advanced", "expert"]},
                    "crypto_level": {"type": "integer", "minimum": 0, "maximum": 10},
                    "finance_level": {"type": "integer", "minimum": 0, "maximum": 10},
                    "blockchain_level": {"type": "integer", "minimum": 0, "maximum": 10},
                    "trading_level": {"type": "integer", "minimum": 0, "maximum": 10},
                    "risk_management_level": {"type": "integer", "minimum": 0, "maximum": 10},
                    "learning_goals": {"type": "array", "items": {"type": "string"}},
                    "interests": {"type": "array", "items": {"type": "string"}},
                    "preferred_learning_pace": {"type": "string", "enum": ["slow", "normal", "fast"]},
                    "preferred_explanation_style": {"type": "string", "enum": ["analogies", "technical", "examples", "visual"]},
                    "confidence_score": {"type": "number", "minimum": 0, "maximum": 1},
                    "onboarding_completed": {"type": "boolean"},
                },
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Save an important piece of information about the user for future reference. Use for facts, preferences, struggles, strengths, goals.",
            "parameters": {
                "type": "object",
                "properties": {
                    "memory_type": {"type": "string", "enum": ["fact", "preference", "struggle", "strength", "goal", "interaction"]},
                    "content": {"type": "string", "description": "The information to remember"},
                    "importance": {"type": "string", "enum": ["low", "normal", "high", "critical"]},
                },
                "required": ["memory_type", "content"],
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_learning_history",
            "description": "Get the user's full learning history: modules created, progress, and quiz attempts.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_modules",
            "description": "Get the user's learning modules, optionally filtered by status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["not_started", "in_progress", "completed", "mastered"], "description": "Optional filter"},
                },
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_learning_module",
            "description": "Create a new personalized learning module for the user. The module will appear in their Modules area.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "level": {"type": "string", "enum": ["beginner", "intermediate", "advanced"]},
                    "category": {"type": "string", "enum": ["crypto", "blockchain", "trading", "defi", "security", "nft", "regulation", "portfolio", "general"]},
                    "learning_objective": {"type": "string"},
                    "content": {"type": "string", "description": "The lesson content (detailed explanation)"},
                    "prerequisites": {"type": "array", "items": {"type": "string"}, "description": "IDs of prerequisite modules"},
                },
                "required": ["title", "description", "level", "category", "learning_objective"],
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_learning_module",
            "description": "Update an existing learning module's status, content, or mastery score.",
            "parameters": {
                "type": "object",
                "properties": {
                    "module_id": {"type": "string"},
                    "status": {"type": "string", "enum": ["not_started", "in_progress", "completed", "mastered"]},
                    "mastery_score": {"type": "number", "minimum": 0, "maximum": 100},
                    "content": {"type": "string"},
                    "weak_areas": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["module_id"],
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "record_quiz_result",
            "description": "Record the result of a quiz the user took on a module.",
            "parameters": {
                "type": "object",
                "properties": {
                    "module_id": {"type": "string"},
                    "questions_count": {"type": "integer"},
                    "correct_answers": {"type": "integer"},
                    "score": {"type": "number", "minimum": 0, "maximum": 100},
                    "difficulty": {"type": "string", "enum": ["easy", "normal", "hard"]},
                },
                "required": ["module_id", "questions_count", "correct_answers", "score"],
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_mastery",
            "description": "Update the mastery score and tracked concepts for a module.",
            "parameters": {
                "type": "object",
                "properties": {
                    "module_id": {"type": "string"},
                    "mastery_score": {"type": "number", "minimum": 0, "maximum": 100},
                    "concepts_understood": {"type": "array", "items": {"type": "string"}},
                    "concepts_weak": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["module_id", "mastery_score"],
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mark_module_mastered",
            "description": "Mark a module as fully mastered. Requires sufficient quiz attempts and mastery score.",
            "parameters": {
                "type": "object",
                "properties": {"module_id": {"type": "string"}},
                "required": ["module_id"],
            }
        }
    },
]


# ============ TOOL DISPATCHER ============

async def execute_tool(name: str, args: dict, user_id: str) -> str:
    """Execute a tool call and return the result as JSON string."""
    try:
        if name == "get_user_profile":
            result = await tool_get_user_profile(user_id)
        elif name == "update_user_profile":
            result = await tool_update_user_profile(user_id, args)
        elif name == "save_memory":
            result = await tool_save_memory(user_id, args.get("memory_type", "fact"), args.get("content", ""), args.get("importance", "normal"))
        elif name == "get_learning_history":
            result = await tool_get_learning_history(user_id)
        elif name == "get_modules":
            result = await tool_get_modules(user_id, args.get("status"))
        elif name == "create_learning_module":
            result = await tool_create_learning_module(
                user_id, args["title"], args.get("description", ""),
                args.get("level", "beginner"), args.get("category", "general"),
                args.get("learning_objective", ""), args.get("content", ""),
                args.get("prerequisites"),
            )
        elif name == "update_learning_module":
            mid = args.pop("module_id")
            result = await tool_update_learning_module(user_id, mid, args)
        elif name == "record_quiz_result":
            result = await tool_record_quiz_result(
                user_id, args["module_id"], args["questions_count"],
                args["correct_answers"], args["score"],
                difficulty=args.get("difficulty", "normal"),
            )
        elif name == "update_mastery":
            result = await tool_update_mastery(
                user_id, args["module_id"], args["mastery_score"],
                args.get("concepts_understood"), args.get("concepts_weak"),
            )
        elif name == "mark_module_mastered":
            result = await tool_mark_module_mastered(user_id, args["module_id"])
        else:
            result = {"error": f"Unknown tool: {name}"}
        return json.dumps(result, default=str)
    except Exception as e:
        logger.error(f"Tool {name} error: {e}")
        return json.dumps({"error": str(e)})


# ============ SYSTEM PROMPT ============

ATLAS_SYSTEM_PROMPT = """You are Atlas, the personal AI crypto mentor of Mentova Academy.

IDENTITY:
- You are a knowledgeable, patient, and adaptive crypto educator
- You speak naturally and conversationally, like a smart friend who happens to be a crypto expert
- You adapt your language complexity to the user's level
- You MUST respond in the user's language (detected from their message)

BEHAVIOR ON FIRST INTERACTION:
If the user's profile shows onboarding_completed=false or overall_level=unknown:
1. Introduce yourself warmly
2. Start a gradual knowledge assessment through conversation (NOT a formal quiz)
3. Ask 2-3 questions at a time, naturally
4. Assess: crypto knowledge, blockchain understanding, trading experience, risk awareness, goals, interests
5. After gathering enough info (usually 3-5 exchanges), update their profile and create their first learning modules
6. Mark onboarding_completed=true

TEACHING:
- When teaching, be detailed and use analogies appropriate to their level
- For beginners: everyday analogies, zero jargon, step-by-step
- For intermediate: technical details with practical examples
- For advanced: deep analysis, strategies, edge cases
- Skip concepts the user already knows
- If the user struggles, identify the gap, slow down, create prerequisite modules

MODULES:
- Create personalized modules based on the user's level and goals
- Each module should have a clear learning objective
- Update module status as the user progresses
- Use quizzes and questions to validate understanding, not just reading

MASTERY:
- Do NOT mark a module as mastered from a single correct answer
- Require multiple successful assessments across different concepts
- Use varied question types: multiple choice, scenarios, explanations
- Be honest about areas that need more work

MEMORY:
- Save important facts about the user (background, goals, struggles, strengths)
- Use memories to personalize future interactions
- Reference past conversations naturally

CONTINUITY:
- When a user returns, check their profile and recent modules
- Reference where they left off
- Acknowledge their progress

RULES:
- NEVER give direct financial advice or tell users what to buy/sell
- Always encourage DYOR (Do Your Own Research)
- Be honest about crypto risks
- If a backend operation fails, be transparent about it
- Do not claim to have saved/created something unless the tool call succeeded
"""


# ============ CONTEXT BUILDER ============

async def build_context(user_id: str, is_vip: bool = False) -> str:
    """Build context string from user's profile, memories, modules, and market intelligence.
    VIP gets full memory + market intelligence. FREE gets basic profile only."""
    parts = []
    profile = await tool_get_user_profile(user_id)
    if profile and not profile.get("error"):
        parts.append(f"USER PROFILE: {json.dumps(profile, default=str)}")

    db = _get_db()
    if db is not None:
        # VIP: include persistent memories
        if is_vip:
            mems = []
            async for doc in db.atlas_memories.find({"user_id": user_id}).sort("created_at", -1).limit(20):
                doc.pop("_id", None)
                mems.append(f"[{doc.get('memory_type','?')}] {doc.get('content','')}")
            if mems:
                parts.append(f"KEY MEMORIES:\n" + "\n".join(mems))

        mods = []
        limit = 10 if is_vip else 5
        async for doc in db.learning_modules.find({"user_id": user_id}).sort("updated_at", -1).limit(limit):
            doc.pop("_id", None)
            mods.append(f"- {doc.get('title','')} (id:{doc.get('id','')}, status:{doc.get('status','')}, mastery:{doc.get('mastery_score',0)}%)")
        if mods:
            parts.append(f"CURRENT MODULES:\n" + "\n".join(mods))

        # VIP Market Intelligence: inject real-time news + market data
        if is_vip:
            # Read news from the global RSS cache in server.py
            try:
                from server import _rss_news_cache
                articles = _rss_news_cache.get("articles", [])[:6]
                if articles:
                    news_lines = [f"- [{a.get('source','')}] {a.get('title','')}" for a in articles]
                    parts.append(f"RECENT CRYPTO NEWS (use for context when relevant):\n" + "\n".join(news_lines))
            except Exception as e:
                logger.debug(f"Could not load RSS cache: {e}")

            # Also check DB for daily briefing data
            from datetime import datetime as _dt, timezone as _tz
            today_key = _dt.now(_tz.utc).strftime("%Y-%m-%d")
            briefing = await db.daily_briefings.find_one({"cache_key": {"$regex": f"^{today_key}"}}, {"_id": 0, "market_data": 1, "market_summary": 1, "sentiment": 1})
            if briefing:
                market_data = briefing.get("market_data", {})
                prices = market_data.get("prices", {})
                if prices:
                    price_str = ", ".join([f"{k}: ${v.get('usd','?')}" for k, v in prices.items()])
                    parts.append(f"CURRENT MARKET PRICES: {price_str}")
                if briefing.get("market_summary"):
                    parts.append(f"TODAY'S MARKET SUMMARY: {briefing['market_summary']}")

    return "\n\n".join(parts) if parts else "No user data yet (new user)."


# ============ REQUEST MODELS ============

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    lang: str = "fr"

class ConversationListRequest(BaseModel):
    pass


# ============ ENDPOINTS ============

@atlas_router.post("/chat")
async def atlas_chat(data: ChatRequest, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Main Atlas chat endpoint with function calling, VIP permissions, and invisible protection."""
    import time as _time
    start_time = _time.time()

    user_id = await _get_authenticated_user(credentials)
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")

    # --- Get user and permissions ---
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    perms = get_permissions(user)
    is_vip = perms["is_vip"]

    # --- Invisible protection check ---
    allowed, block_msg = check_request_allowed(user_id, is_vip)
    if not allowed:
        raise HTTPException(status_code=429, detail=block_msg)

    record_request_start(user_id)

    try:
        # Load or create conversation
        conv_id = data.conversation_id
        conversation = None
        if conv_id:
            conversation = await db.atlas_conversations.find_one({"id": conv_id, "user_id": user_id})
        if not conversation:
            conv_id = str(uuid.uuid4())
            conversation = AtlasConversation(id=conv_id, user_id=user_id, title=data.message[:60]).to_mongo()
            await db.atlas_conversations.insert_one(conversation)

        # Build context based on VIP status
        context = await build_context(user_id, is_vip)
        lang_map = {"fr": "French", "en": "English", "es": "Spanish"}
        lang_instruction = f"\n\nIMPORTANT: You MUST respond entirely in {lang_map.get(data.lang, 'French')}. Every word of your response must be in {lang_map.get(data.lang, 'French')}."

        # VIP gets enhanced system prompt
        vip_addon = ""
        if is_vip:
            vip_addon = """

VIP USER: This user has Mentova VIP. Provide the most complete, personalized experience:
- Use all their memories and history to personalize responses
- Offer deeper analysis and more detailed explanations
- Remember and reference previous conversations
- Provide market context when relevant to their questions
- Use save_memory to remember important user preferences, goals, and knowledge level
- When the user asks about current markets, use the RECENT CRYPTO NEWS data provided in your context
"""
        else:
            vip_addon = """

FREE USER: Provide a helpful, generous experience. Explain concepts clearly.
Do NOT mention limits, quotas, or message counts. Never pressure the user to upgrade.
Focus on being an excellent crypto education mentor.
"""

        system_msg = ATLAS_SYSTEM_PROMPT + vip_addon + f"\n\nCURRENT USER CONTEXT:\n{context}" + lang_instruction

        # Build messages — VIP gets more history
        max_history = perms.get("atlas_max_context_messages", 10)
        history = conversation.get("messages", [])[-max_history:]
        messages = [{"role": "system", "content": system_msg}]
        messages.extend(history)
        messages.append({"role": "user", "content": data.message})

        # Determine which tools to expose based on plan
        available_tools = TOOLS
        if not is_vip:
            # FREE users: exclude memory save tool (memory is VIP-only)
            available_tools = [t for t in TOOLS if t["function"]["name"] != "save_memory"]

        # Determine model — FREE users get degraded model after threshold
        use_model = MODEL
        is_degraded = False
        if not is_vip:
            use_model, is_degraded = await get_free_user_model(user_id, db)

        # Call OpenAI with tools
        max_tool_rounds = 5
        assistant_response = ""
        total_input_tokens = 0
        total_output_tokens = 0

        for _ in range(max_tool_rounds):
            response = await client.chat.completions.create(
                model=use_model,
                messages=messages,
                tools=available_tools,
                tool_choice="auto",
                reasoning_effort="none",
            )
            msg = response.choices[0].message
            if response.usage:
                total_input_tokens += response.usage.prompt_tokens
                total_output_tokens += response.usage.completion_tokens

            if msg.tool_calls:
                messages.append(msg.model_dump())
                for tc in msg.tool_calls:
                    fn_name = tc.function.name
                    fn_args = json.loads(tc.function.arguments)
                    logger.info(f"Tool call: {fn_name}({json.dumps(fn_args)[:200]})")
                    result = await execute_tool(fn_name, fn_args, user_id)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result,
                    })
            else:
                assistant_response = msg.content or ""
                break

        if not assistant_response:
            final = await client.chat.completions.create(model=use_model, messages=messages, reasoning_effort="none")
            assistant_response = final.choices[0].message.content or ""
            if final.usage:
                total_input_tokens += final.usage.prompt_tokens
                total_output_tokens += final.usage.completion_tokens

        # Save to conversation history
        new_msgs = conversation.get("messages", [])
        new_msgs.append({"role": "user", "content": data.message})
        new_msgs.append({"role": "assistant", "content": assistant_response})
        await db.atlas_conversations.update_one(
            {"id": conv_id, "user_id": user_id},
            {"$set": {"messages": new_msgs, "updated_at": utcnow()}}
        )

        # Log usage for cost analysis (never shown to user)
        duration_ms = int((_time.time() - start_time) * 1000)
        await log_usage(
            db, user_id, perms["plan"],
            total_input_tokens, total_output_tokens,
            MODEL, duration_ms, "chat"
        )

        # Smart Upgrade Prompt: check if FREE user should see VIP suggestion
        show_upgrade = False
        if not is_vip:
            show_upgrade = await should_show_upgrade_prompt(user_id, db)
            if show_upgrade:
                mark_upgrade_prompt_shown(user_id)

        result = {"response": assistant_response, "conversation_id": conv_id}
        if show_upgrade:
            result["upgrade_prompt"] = True
        if is_degraded:
            result["model_degraded"] = True
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OpenAI error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
    finally:
        record_request_end(user_id)


@atlas_router.get("/conversations")
async def list_conversations(credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """List user's conversations."""
    user_id = await _get_authenticated_user(credentials)
    db = _get_db()
    if db is None:
        return {"conversations": []}
    convos = []
    async for doc in db.atlas_conversations.find({"user_id": user_id}).sort("updated_at", -1).limit(50):
        doc.pop("_id", None)
        msg_count = len(doc.get("messages", []))
        convos.append({
            "id": doc["id"],
            "title": doc.get("title", "Conversation"),
            "message_count": msg_count,
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        })
    return {"conversations": convos}


@atlas_router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Get a specific conversation with full message history."""
    user_id = await _get_authenticated_user(credentials)
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    doc = await db.atlas_conversations.find_one({"id": conversation_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Conversation not found")
    doc.pop("_id", None)
    return doc


@atlas_router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Delete a conversation."""
    user_id = await _get_authenticated_user(credentials)
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    result = await db.atlas_conversations.delete_one({"id": conversation_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


# ============ MODULES ENDPOINTS ============

@atlas_router.get("/modules")
async def get_user_modules(status: Optional[str] = None, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Get all modules for the authenticated user."""
    user_id = await _get_authenticated_user(credentials)
    result = await tool_get_modules(user_id, status)
    return result


@atlas_router.get("/modules/{module_id}")
async def get_module_detail(module_id: str, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Get a specific module with its progress."""
    user_id = await _get_authenticated_user(credentials)
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    mod = await db.learning_modules.find_one({"id": module_id, "user_id": user_id})
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    mod.pop("_id", None)
    prog = await db.module_progress.find_one({"module_id": module_id, "user_id": user_id})
    if prog:
        prog.pop("_id", None)
    quizzes = []
    async for doc in db.quiz_attempts.find({"module_id": module_id, "user_id": user_id}).sort("created_at", -1).limit(5):
        doc.pop("_id", None)
        quizzes.append(doc)
    return {"module": mod, "progress": prog, "recent_quizzes": quizzes}


# ============ PROFILE ENDPOINT ============

@atlas_router.get("/profile")
async def get_learning_profile(credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Get the authenticated user's learning profile."""
    user_id = await _get_authenticated_user(credentials)
    profile = await tool_get_user_profile(user_id)
    memories = await tool_get_memories(user_id, limit=5)
    modules = await tool_get_modules(user_id)
    total = len(modules.get("modules", []))
    mastered = sum(1 for m in modules.get("modules", []) if m.get("status") == "mastered")
    in_progress = sum(1 for m in modules.get("modules", []) if m.get("status") == "in_progress")
    return {
        "profile": profile,
        "stats": {
            "total_modules": total,
            "mastered_modules": mastered,
            "in_progress_modules": in_progress,
            "recent_memories": len(memories.get("memories", [])),
        }
    }


# ============ PROGRESS ENDPOINT ============

@atlas_router.get("/progress")
async def get_learning_progress(credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Get detailed learning progress for the authenticated user."""
    user_id = await _get_authenticated_user(credentials)
    profile = await tool_get_user_profile(user_id)
    history = await tool_get_learning_history(user_id)
    modules = history.get("modules", [])
    quizzes = history.get("quiz_attempts", [])
    categories = {}
    for m in modules:
        cat = m.get("category", "general")
        if cat not in categories:
            categories[cat] = {"total": 0, "mastered": 0, "avg_mastery": 0, "scores": []}
        categories[cat]["total"] += 1
        if m.get("status") == "mastered":
            categories[cat]["mastered"] += 1
        categories[cat]["scores"].append(m.get("mastery_score", 0))
    for cat in categories:
        scores = categories[cat].pop("scores")
        categories[cat]["avg_mastery"] = round(sum(scores) / len(scores), 1) if scores else 0

    return {
        "profile": profile,
        "modules_summary": {
            "total": len(modules),
            "mastered": sum(1 for m in modules if m.get("status") == "mastered"),
            "in_progress": sum(1 for m in modules if m.get("status") == "in_progress"),
            "not_started": sum(1 for m in modules if m.get("status") == "not_started"),
        },
        "categories": categories,
        "recent_quizzes": quizzes[:10],
        "total_quiz_attempts": len(quizzes),
    }
