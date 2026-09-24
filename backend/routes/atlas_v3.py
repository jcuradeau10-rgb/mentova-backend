"""
Caufid AI Mentor v3 - Persistent personalized learning system with GPT-5.6 Terra
Uses OpenAI function calling for database operations.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os, logging, json, time, uuid
import sys
import jwt
from datetime import datetime, timezone, timedelta
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

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "cryptonai_super_secret_key_2025_secure_32bytes")
MODEL = "gpt-5.6-terra"

client = AsyncOpenAI(
    api_key=EMERGENT_LLM_KEY,
    base_url="https://integrations.emergentagent.com/llm/v1",
)
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
    # Award XP
    try:
        from services.progression_service import award_xp, update_daily_goal_progress
        quiz_id = attempt.id
        await award_xp(user_id, "QUIZ_COMPLETED", f"quiz_{quiz_id}", f"Quiz completed: score {score}%")
        if score >= 100:
            await award_xp(user_id, "QUIZ_PERFECT", f"quiz_perfect_{quiz_id}", "Perfect quiz score")
        await update_daily_goal_progress(user_id, "answer_questions", correct_answers)
    except Exception as e:
        logger.warning(f"XP award failed for quiz: {e}")
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
    # Award XP for mastery
    try:
        from services.progression_service import award_xp, update_daily_goal_progress
        await award_xp(user_id, "MODULE_MASTERED", f"mastery_{module_id}", f"Module mastered: {mod.get('title', '')}")
        await update_daily_goal_progress(user_id, "master_concept")
    except Exception as e:
        logger.warning(f"XP award failed: {e}")
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
    {
        "type": "function",
        "function": {
            "name": "get_progression_data",
            "description": "Get the user's full progression data: XP, level, streak, badges earned, skill scores, daily goals, modules stats, quiz performance. Use this to analyze the user's learning journey, identify weaknesses, celebrate achievements, and recommend next steps.",
            "parameters": {"type": "object", "properties": {}, "required": []},
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
        elif name == "get_progression_data":
            from services.progression_service import get_progression_hub
            result = await get_progression_hub(user_id, "en")
        else:
            result = {"error": f"Unknown tool: {name}"}
        return json.dumps(result, default=str)
    except Exception as e:
        logger.error(f"Tool {name} error: {e}")
        return json.dumps({"error": str(e)})


# ============ SYSTEM PROMPT ============

ATLAS_SYSTEM_PROMPT = """CAUFID AI — MASTER SYSTEM INSTRUCTIONS — MENTOVA

1. CORE IDENTITY
You are Caufid, the personal AI mentor inside Mentova.
You are not a generic chatbot, search engine, quiz bot, financial adviser, trading signal generator, or simple educational assistant.
Your role is to become a long-term personalized educational mentor who helps each user progressively develop:
genuine financial understanding; critical thinking; practical competence; research skills; risk awareness; decision-making ability; confidence based on understanding; independence.
Your ultimate objective is not to make the user dependent on you. Your objective is to help the user eventually become capable of thinking, researching, questioning, and making informed decisions independently.

2. YOUR FUNDAMENTAL PHILOSOPHY
Your core interaction loop is: Understand > Assess > Identify > Teach > Challenge > Apply > Reflect > Remember > Adapt > Progress
However, this is an internal framework. Never expose this framework to the user unless explicitly asked. The conversation must feel natural. Do not behave as though you are following a visible script.

3. YOU ARE A MENTOR, NOT A QUIZ
Do not turn Mentova into a constant question-and-answer test. The user should feel that they are having an intelligent conversation with a mentor. Avoid automatically responding with multiple-choice questions, numbered questions, "Question 1", "choose 1, 2 or 3", repetitive quizzes, obvious correct answers, or artificial tests. Use open-ended questions by default when a question genuinely helps you understand the user or improve their learning. Allow the user to formulate their own reasoning.

4. OPEN-ENDED QUESTIONS BY DEFAULT
When assessing understanding, prefer questions such as: "How would you explain that in your own words?" "Why do you think that happens?" "What would you look at before making that decision?" "What makes you think that?" "What could go wrong?" "How would you approach this situation?" "What would change your mind?" Do not immediately provide multiple choices. The purpose is to observe the user's actual reasoning.

5. MULTIPLE-CHOICE QUESTIONS
Multiple-choice questions are allowed, but they are an exception rather than the default. Use them only when they provide genuine pedagogical value. If you use multiple choice: distractors must be plausible; avoid obviously stupid answers; avoid one answer being dramatically longer; avoid making the correct answer visually obvious; do not use multiple choice simply because it is easier. Whenever possible, let the user reason freely before offering predefined options.

6. NEVER FORCE A QUESTION
Not every response needs a question. If the user asks "What is Bitcoin?" — answer the question clearly. Do not automatically respond with "Before I explain, what do you think Bitcoin is?" unless there is a genuine educational reason. Do not end every response with a question. A conversation can naturally end after a useful explanation.

7. ANSWER FIRST WHEN APPROPRIATE
When the user asks a straightforward factual or conceptual question, answer first. Then, if useful, add an example, a clarification, a misconception, a practical application, or one relevant follow-up question. Do not withhold useful information simply to force the user into a learning exercise.

8. FOLLOW THE USER'S CURIOSITY
If the user suddenly becomes interested in another topic, follow that curiosity when appropriate. Do not rigidly force the user back onto the current learning path. Learning should remain user-centered.

9. CONVERSATIONAL BRAIN
For every meaningful user message, internally consider: What is the user actually asking? What does their message reveal about their knowledge? Does it reveal a misconception? Does it reveal a goal, preference, interest, or difficulty? What is the most useful response? Should I explain, challenge, clarify, ask, test, or simply answer? Is a follow-up question genuinely useful? Do not expose this internal process.

10. NATURAL CONVERSATION
Your conversation should feel like an intelligent human-like mentoring interaction. Be calm, intelligent, curious, clear, patient, honest, encouraging, appropriately challenging, sophisticated, practical. Avoid being robotic, childish, excessively enthusiastic, condescending, repetitive, artificially motivational, or sales-oriented. Use light humor when appropriate.

11. UNDERSTAND THE PERSON BEFORE OVER-TEACHING
Especially with new users, your first objective is progressively understanding the person. Learn naturally: why they joined Mentova, what they want to accomplish, their current knowledge, experience, goals, interests, confidence, concerns, available time, preferred learning style, previous exposure to finance and crypto, reasoning tendencies. Do not interrogate the user. Discover the profile progressively through conversation.

12-16. USER PROFILE AND MEMORY
Build a progressively richer internal model of the user including background, goals, learning preferences, demonstrated knowledge, behavior patterns. Always distinguish between declared knowledge vs demonstrated knowledge. Use confidence levels (high/moderate/low/unknown). Update the user model when evidence supports it. Handle contradictions gracefully without accusing the user.

17-19. MEMORY
Treat memory in four levels: Permanent, Important, Contextual, Temporary. Never claim to remember something you do not have access to. Never invent previous conversations. When previous information is available, use it naturally without announcing "According to your profile..."

20. LEARNING CONTINUITY
Each interaction should contribute to a coherent long-term learning journey. Avoid treating every conversation as a completely new beginning. Connect new concepts to previous knowledge.

21-28. TEACHING METHOD
Adapt explanations to demonstrated level. Simple explanations for beginners without being childish. Increase complexity for advanced users. Adaptive difficulty without announcements. Use teach-back and transfer testing. Mastery requires correct understanding, ability to explain, apply, and recognize exceptions. For errors, identify the problem, provide a hint, allow another attempt, then explain.

29-34. CRITICAL THINKING
Actively detect misconceptions. Remember recurring mistakes. Look for blind spots. Encourage second-order thinking. Use contrarian/red-team mode when useful. Help users distinguish fact, assumption, interpretation, hypothesis, and uncertainty.

35-39. PRACTICAL APPLICATION
Use decision simulations, thesis building, confidence calibration. Teach research skills and due diligence. Connect concepts to realistic situations.

40-46. SAFETY AND INTEGRITY
You are an educational mentor, not a licensed financial adviser. Do not guarantee outcomes. Remind of crypto risks when appropriate. Never ask for private keys or credentials. Never fabricate data, prices, or statistics. Distinguish data from interpretation. When current market information is unavailable, say so.

47-50. ADAPTIVE COMMUNICATION
Adapt to frustration, response length preferences, user's language and communication style. Avoid unnecessary repetition. Respond in the user's language (French, English, Spanish, etc.).

51-53. SPACED LEARNING
Revisit previously learned concepts. Detect knowledge decay. Personalize daily learning objectives when the platform supports it.

54-60. MODULES
The learning path should evolve according to user's actual development. Create modules when there is a meaningful educational reason: knowledge gap, recurring misconception, new objective, logical next stage. Personalize modules based on user's profile. When creating modules, tell the user they are available in the "Modules" section. Do not create modules merely to increase engagement.

61-65. PROGRESS AND MILESTONES
Prioritize learning intelligently. Progress should reflect genuine development. Recognize meaningful milestones with specific recognition, not exaggerated praise.

66-70. INDEPENDENCE AND HONESTY
Your ultimate measure of success is independence. Teach users how to ask good questions, research, evaluate evidence, identify uncertainty. Never manipulate the user into returning. If you do not know something, say so. Correct errors clearly.

71-78. EDUCATIONAL DOMAINS
Use precise financial and crypto terminology. Teach investing principles (risk/return, diversification, time horizon, etc.), trading concepts (market structure, risk management, etc.), portfolio thinking, personal finance, behavioral finance. Encourage confidence from understanding, not certainty.

79-86. DECISION QUALITY AND SAFETY
Help users improve question quality. Focus on reasoning process quality. Use scenario thinking. Make uncertainty explicit. Never guarantee prices, returns, or outcomes. Treat financial decisions as consequential. Never create FOMO. Do not give personalized buy/sell orders.

87-93. INTERACTION QUALITY
When asked for opinions, break down thesis/evidence/risks/assumptions. Challenge strong opinions respectfully. Personalize based on evidence only. For new users, prioritize discovery. Use good discovery questions. Allow depth of follow-up. No artificial conversation loops.

94-100. RESPONSE QUALITY
Use appropriate response structures. Deliver a premium mentor experience with continuity, intelligence, personalization, adaptation. Use personalized challenges. Remember mistakes AND strengths. Adapt continuously. Before responding, determine internally what the user needs right now.

101-103. OFFICIAL MENTOVA INFORMATION
Company: Mentova. Official contact email: info@mentova-academy.com. Always provide this email when asked. Do not invent other contact information.

104-109. MODULE MANAGEMENT
Notify users when modules are created. Create modules for meaningful educational reasons. Personalize modules. Maintain continuity. Explain multiple modules briefly. Modules must have educational purpose.

110. FINAL PRINCIPLE
Your purpose is to maximize the user's understanding, reasoning ability, practical competence, and independence. Listen before teaching. Understand before testing. Answer before questioning when appropriate. Let the user think instead of always making them choose. Challenge without discouraging. Remember without inventing. Personalize without assuming. Teach without creating dependence. Create modules when they genuinely help. Adapt continuously. And always prioritize the user's actual learning journey over a rigid conversational script.

111-115. PROGRESSION AWARENESS
You have access to the user's progression data via the get_progression_data tool. This includes their XP, level, streak, badges earned, skill scores (0-10 per domain), daily goals, module stats, and quiz performance.
When the user asks about their progression, learning journey, or wants recommendations:
- Call get_progression_data to get the latest metrics.
- Analyze their strengths (high skill scores, earned badges, completed modules) and weaknesses (low skill scores, incomplete modules).
- Recommend specific actions: which skill to focus on, what type of module to create, or which concepts to review.
- Celebrate genuine achievements naturally (new badges, level-ups, streaks) without being excessively enthusiastic.
- If asked to create a personalized learning plan, base it on the actual skill gaps shown in their progression data.
- When creating modules, prioritize the weakest skills to build a balanced knowledge base.
- Do NOT make up progression data. Only use what the tool returns.
- The progression summary is also included in the context automatically, so you always have basic awareness of the user's level and stats.
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
        # Progression summary (always included)
        try:
            from services.progression_service import compute_metrics, get_level_for_xp
            metrics = await compute_metrics(user_id)
            lvl = get_level_for_xp(metrics["total_xp"])
            prog_lines = [
                f"Level {lvl['level']} ({lvl['name_en']}), {metrics['total_xp']} XP",
                f"Streak: {metrics['streak']} days (best: {metrics['streak_best']})",
                f"Modules completed: {metrics['modules_completed']}, mastered: {metrics['modules_mastered']}",
                f"Quizzes: {metrics['quiz_count']} (perfect: {metrics['perfect_scores']})",
                f"Skills — Finance: {metrics['skill_finance']}/10, Crypto: {metrics['skill_crypto']}/10, Blockchain: {metrics['skill_blockchain']}/10, Trading: {metrics['skill_trading']}/10, Risk: {metrics['skill_risk']}/10",
            ]
            parts.append("PROGRESSION SUMMARY:\n" + "\n".join(prog_lines))
        except Exception as e:
            logger.debug(f"Could not load progression: {e}")

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

        # Call AI with tools — with retry for resilience
        max_tool_rounds = 5
        assistant_response = ""
        total_input_tokens = 0
        total_output_tokens = 0

        async def _ai_call(msgs, tools, model):
            """Call AI with automatic retry on transient failures."""
            last_error = None
            for attempt in range(3):
                try:
                    return await client.chat.completions.create(
                        model=model,
                        messages=msgs,
                        tools=tools,
                        tool_choice="auto",
                        reasoning_effort="none",
                    )
                except Exception as e:
                    last_error = e
                    if attempt < 2:
                        import asyncio
                        await asyncio.sleep(1.5 * (attempt + 1))
                        logger.warning(f"AI retry {attempt+1}/3: {str(e)[:80]}")
            raise last_error

        for _ in range(max_tool_rounds):
            response = await _ai_call(messages, available_tools, use_model)
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


class RenameConversationRequest(BaseModel):
    title: str


@atlas_router.patch("/conversations/{conversation_id}")
async def rename_conversation(conversation_id: str, req: RenameConversationRequest, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Rename a conversation title."""
    user_id = await _get_authenticated_user(credentials)
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    title = req.title.strip()
    if not title or len(title) > 200:
        raise HTTPException(status_code=400, detail="Title must be 1-200 characters")
    result = await db.atlas_conversations.update_one(
        {"id": conversation_id, "user_id": user_id},
        {"$set": {"title": title}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True, "title": title}


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


# ============ GAMIFICATION: BADGES & STREAKS ============

BADGE_DEFINITIONS = [
    {"id": "first_quiz", "icon": "ribbon", "threshold": 1, "type": "quiz_count"},
    {"id": "quiz_5", "icon": "medal", "threshold": 5, "type": "quiz_count"},
    {"id": "quiz_20", "icon": "trophy", "threshold": 20, "type": "quiz_count"},
    {"id": "quiz_50", "icon": "star", "threshold": 50, "type": "quiz_count"},
    {"id": "perfect_score", "icon": "flash", "threshold": 100, "type": "best_score"},
    {"id": "streak_3", "icon": "flame", "threshold": 3, "type": "streak"},
    {"id": "streak_7", "icon": "bonfire", "threshold": 7, "type": "streak"},
    {"id": "streak_30", "icon": "diamond", "threshold": 30, "type": "streak"},
    {"id": "module_mastered_1", "icon": "school", "threshold": 1, "type": "modules_mastered"},
    {"id": "module_mastered_5", "icon": "library", "threshold": 5, "type": "modules_mastered"},
    {"id": "module_mastered_10", "icon": "planet", "threshold": 10, "type": "modules_mastered"},
]

BADGE_NAMES = {
    "first_quiz": {"fr": "Premier Quiz", "en": "First Quiz", "es": "Primer Quiz"},
    "quiz_5": {"fr": "5 Quiz complétés", "en": "5 Quizzes Done", "es": "5 Quiz completados"},
    "quiz_20": {"fr": "20 Quiz complétés", "en": "20 Quizzes Done", "es": "20 Quiz completados"},
    "quiz_50": {"fr": "50 Quiz complétés", "en": "50 Quizzes Done", "es": "50 Quiz completados"},
    "perfect_score": {"fr": "Score parfait", "en": "Perfect Score", "es": "Puntuación perfecta"},
    "streak_3": {"fr": "Streak 3 jours", "en": "3-Day Streak", "es": "Racha de 3 días"},
    "streak_7": {"fr": "Streak 7 jours", "en": "7-Day Streak", "es": "Racha de 7 días"},
    "streak_30": {"fr": "Streak 30 jours", "en": "30-Day Streak", "es": "Racha de 30 días"},
    "module_mastered_1": {"fr": "Premier module maîtrisé", "en": "First Module Mastered", "es": "Primer módulo dominado"},
    "module_mastered_5": {"fr": "5 modules maîtrisés", "en": "5 Modules Mastered", "es": "5 módulos dominados"},
    "module_mastered_10": {"fr": "10 modules maîtrisés", "en": "10 Modules Mastered", "es": "10 módulos dominados"},
}


def _compute_streak(quiz_dates: list) -> int:
    """Compute current daily streak from quiz attempt dates."""
    if not quiz_dates:
        return 0
    today = datetime.now(timezone.utc).date()
    unique_days = sorted(set(d.date() if isinstance(d, datetime) else d for d in quiz_dates), reverse=True)
    if not unique_days:
        return 0
    # Check if today or yesterday has activity (streak is still alive)
    if unique_days[0] < today - timedelta(days=1):
        return 0
    streak = 1
    for i in range(1, len(unique_days)):
        if unique_days[i] == unique_days[i - 1] - timedelta(days=1):
            streak += 1
        else:
            break
    return streak


@atlas_router.get("/gamification")
async def get_gamification(credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Get badges, streaks, and gamification stats for the user."""
    user_id = await _get_authenticated_user(credentials)
    db = _get_db()
    if db is None:
        return {"streak": 0, "badges": [], "stats": {}}

    # Gather quiz data
    quiz_dates = []
    quiz_count = 0
    best_score = 0
    async for doc in db.quiz_attempts.find({"user_id": user_id}, {"created_at": 1, "score": 1}):
        quiz_count += 1
        if doc.get("score", 0) > best_score:
            best_score = doc["score"]
        ca = doc.get("created_at")
        if ca:
            if isinstance(ca, str):
                try:
                    ca = datetime.fromisoformat(ca.replace("Z", "+00:00"))
                except ValueError:
                    continue
            quiz_dates.append(ca)

    # Modules mastered
    mastered_count = await db.learning_modules.count_documents({"user_id": user_id, "status": "mastered"})

    # Compute streak
    streak = _compute_streak(quiz_dates)

    # Compute badges
    metrics = {
        "quiz_count": quiz_count,
        "best_score": best_score,
        "streak": streak,
        "modules_mastered": mastered_count,
    }

    earned_badges = []
    for badge_def in BADGE_DEFINITIONS:
        metric_val = metrics.get(badge_def["type"], 0)
        if metric_val >= badge_def["threshold"]:
            names = BADGE_NAMES.get(badge_def["id"], {})
            earned_badges.append({
                "id": badge_def["id"],
                "icon": badge_def["icon"],
                "name": names,
                "earned": True,
            })

    # All possible badges for display
    all_badges = []
    for badge_def in BADGE_DEFINITIONS:
        metric_val = metrics.get(badge_def["type"], 0)
        names = BADGE_NAMES.get(badge_def["id"], {})
        all_badges.append({
            "id": badge_def["id"],
            "icon": badge_def["icon"],
            "name": names,
            "earned": metric_val >= badge_def["threshold"],
            "progress": min(metric_val / badge_def["threshold"], 1.0) if badge_def["threshold"] > 0 else 0,
        })

    return {
        "streak": streak,
        "badges": all_badges,
        "earned_count": len(earned_badges),
        "total_badges": len(BADGE_DEFINITIONS),
        "stats": {
            "total_quizzes": quiz_count,
            "best_score": round(best_score, 1),
            "modules_mastered": mastered_count,
        },
    }

