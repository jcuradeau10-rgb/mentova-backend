"""
Atlas AI Mentor v2 - Structured adaptive learning with curriculum and conversation memory
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
import logging
import uuid
import time
import jwt
from datetime import datetime, timezone

logger = logging.getLogger("atlas")

atlas_router = APIRouter(prefix="/api/atlas")

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'cryptonai_super_secret_key_2025_secure_32bytes')

# ============ RATE LIMITING ============
DAILY_MSG_LIMIT = 20  # Non-VIP: 20 messages then 24h cooldown
FREE_CHAPTERS = 2     # Non-VIP: first 2 chapters per level
_rate_limits: Dict[str, Dict] = {}  # {user_id: {count: int, first_msg_at: float}}

def _check_rate_limit(user_id: str) -> dict:
    """Check if user has remaining messages. Returns {allowed: bool, remaining: int, reset_at: float}"""
    now = time.time()
    if user_id not in _rate_limits:
        _rate_limits[user_id] = {"count": 0, "first_msg_at": now}

    entry = _rate_limits[user_id]
    # Reset after 24h
    if now - entry["first_msg_at"] >= 86400:
        _rate_limits[user_id] = {"count": 0, "first_msg_at": now}
        entry = _rate_limits[user_id]

    remaining = DAILY_MSG_LIMIT - entry["count"]
    reset_at = entry["first_msg_at"] + 86400

    return {
        "allowed": remaining > 0,
        "remaining": max(0, remaining),
        "reset_at": reset_at,
        "limit": DAILY_MSG_LIMIT,
    }

def _increment_usage(user_id: str):
    """Increment message count for user."""
    now = time.time()
    if user_id not in _rate_limits:
        _rate_limits[user_id] = {"count": 0, "first_msg_at": now}
    _rate_limits[user_id]["count"] += 1


# ============ AUTH HELPER ============
optional_security = HTTPBearer(auto_error=False)

async def _get_user_and_vip(credentials: Optional[HTTPAuthorizationCredentials] = None):
    """Get user info and VIP status from token. Returns (user_id, is_vip) or (None, False)."""
    if not credentials:
        return None, False
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            return None, False
        db = _get_db()
        if db is not None:
            user = await db.users.find_one({"id": user_id})
            if user:
                is_vip = user.get("is_vip", False)
                logger.info(f"User {user_id}: is_vip={is_vip}")
                return user_id, is_vip
            else:
                logger.warning(f"User {user_id} not found in DB")
        else:
            logger.warning("DB not available for VIP check")
        return user_id, False
    except Exception as e:
        logger.error(f"Auth check error: {e}")
        return None, False


# ============ SESSION MEMORY ============
_sessions: Dict[str, Dict] = {}
MAX_SESSION_AGE = 3600
MAX_HISTORY = 20


def _get_session(session_id: str) -> List[dict]:
    now = time.time()
    expired = [k for k, v in _sessions.items() if now - v["last_used"] > MAX_SESSION_AGE]
    for k in expired:
        del _sessions[k]
    if session_id not in _sessions:
        _sessions[session_id] = {"messages": [], "last_used": now}
    _sessions[session_id]["last_used"] = now
    return _sessions[session_id]["messages"]


def _add_to_session(session_id: str, role: str, content: str):
    history = _get_session(session_id)
    history.append({"role": role, "content": content})
    if len(history) > MAX_HISTORY:
        _sessions[session_id]["messages"] = history[-MAX_HISTORY:]


# ============ CURRICULUM ============
CURRICULUM = {
    "beginner": {
        "id": "beginner",
        "title": {"fr": "Les Bases Crypto", "en": "Crypto Basics", "es": "Bases Cripto"},
        "description": {"fr": "Découvre le monde des cryptomonnaies depuis zéro", "en": "Discover the world of cryptocurrencies from scratch", "es": "Descubre el mundo de las criptomonedas desde cero"},
        "icon": "leaf",
        "color": "#10B981",
        "chapters": [
            {"id": "what-is-crypto", "title": {"fr": "C'est quoi la crypto ?", "en": "What is crypto?", "es": "Que es cripto?"},
             "objective": {"fr": "Comprendre ce qu'est une cryptomonnaie et pourquoi ça existe", "en": "Understand what a cryptocurrency is and why it exists", "es": "Entender que es una criptomoneda y por que existe"},
             "topics": "cryptocurrency definition, digital money, decentralization, peer-to-peer, why crypto was created"},
            {"id": "bitcoin-basics", "title": {"fr": "Bitcoin : L'or numérique", "en": "Bitcoin: Digital Gold", "es": "Bitcoin: Oro Digital"},
             "objective": {"fr": "Comprendre Bitcoin, son histoire et pourquoi on l'appelle l'or numerique", "en": "Understand Bitcoin, its history and why it's called digital gold", "es": "Entender Bitcoin, su historia y por que se le llama oro digital"},
             "topics": "Bitcoin history, Satoshi Nakamoto, limited supply 21 million, store of value, halving"},
            {"id": "blockchain-simple", "title": {"fr": "La Blockchain expliquée simplement", "en": "Blockchain explained simply", "es": "Blockchain explicado simplemente"},
             "objective": {"fr": "Comprendre comment fonctionne une blockchain avec des analogies simples", "en": "Understand how a blockchain works with simple analogies", "es": "Entender como funciona una blockchain con analogias simples"},
             "topics": "blockchain as a ledger, blocks, miners/validators, consensus, immutability, transparency"},
            {"id": "wallets", "title": {"fr": "Les Wallets : Ton coffre-fort", "en": "Wallets: Your digital safe", "es": "Wallets: Tu caja fuerte"},
             "objective": {"fr": "Savoir ce qu'est un wallet, les types et comment proteger ses cryptos", "en": "Know what a wallet is, types and how to protect your crypto", "es": "Saber que es un wallet, tipos y como proteger tus criptos"},
             "topics": "hot wallet vs cold wallet, private keys, seed phrase, MetaMask, Ledger, security basics"},
            {"id": "buy-first-crypto", "title": {"fr": "Acheter ta première crypto", "en": "Buy your first crypto", "es": "Compra tu primera cripto"},
             "objective": {"fr": "Guide pratique pour acheter du Bitcoin ou de l'Ethereum", "en": "Practical guide to buying Bitcoin or Ethereum", "es": "Guia practica para comprar Bitcoin o Ethereum"},
             "topics": "exchanges (Binance, Coinbase), KYC, fiat to crypto, market order vs limit order, fees"},
            {"id": "security-basics", "title": {"fr": "Sécurité : Protège tes cryptos", "en": "Security: Protect your crypto", "es": "Seguridad: Protege tus criptos"},
             "objective": {"fr": "Les erreurs a eviter et les bonnes pratiques de securite", "en": "Mistakes to avoid and security best practices", "es": "Errores a evitar y mejores practicas de seguridad"},
             "topics": "scams, phishing, 2FA, never share seed phrase, verify addresses, common mistakes"},
        ]
    },
    "intermediate": {
        "id": "intermediate",
        "title": {"fr": "Aller Plus Loin", "en": "Going Further", "es": "Ir Mas Lejos"},
        "description": {"fr": "Explore l'écosystème crypto au-delà de Bitcoin", "en": "Explore the crypto ecosystem beyond Bitcoin", "es": "Explora el ecosistema cripto mas alla de Bitcoin"},
        "icon": "trending-up",
        "color": "#F59E0B",
        "chapters": [
            {"id": "ethereum-smart-contracts", "title": {"fr": "Ethereum et les Smart Contracts", "en": "Ethereum and Smart Contracts", "es": "Ethereum y Smart Contracts"},
             "objective": {"fr": "Comprendre Ethereum et le concept de contrats intelligents", "en": "Understand Ethereum and the concept of smart contracts", "es": "Entender Ethereum y el concepto de contratos inteligentes"},
             "topics": "Ethereum vs Bitcoin, smart contracts, dApps, EVM, gas fees, ETH 2.0"},
            {"id": "defi", "title": {"fr": "La DeFi : La finance sans banque", "en": "DeFi: Finance without banks", "es": "DeFi: Finanzas sin bancos"},
             "objective": {"fr": "Découvrir la finance décentralisée et ses opportunités", "en": "Discover decentralized finance and its opportunities", "es": "Descubrir las finanzas descentralizadas y sus oportunidades"},
             "topics": "lending/borrowing (Aave), DEX (Uniswap), liquidity pools, yield, TVL, risks"},
            {"id": "nfts", "title": {"fr": "Les NFTs : Au-delà des images", "en": "NFTs: Beyond images", "es": "NFTs: Mas alla de las imagenes"},
             "objective": {"fr": "Comprendre les NFTs et leurs vrais cas d'utilisation", "en": "Understand NFTs and their real use cases", "es": "Entender los NFTs y sus casos de uso reales"},
             "topics": "NFT basics, ERC-721, use cases (art, gaming, identity), marketplaces, valuation"},
            {"id": "staking", "title": {"fr": "Le Staking : Revenus passifs", "en": "Staking: Passive income", "es": "Staking: Ingresos pasivos"},
             "objective": {"fr": "Apprendre a gagner des revenus passifs avec le staking", "en": "Learn to earn passive income with staking", "es": "Aprender a ganar ingresos pasivos con staking"},
             "topics": "Proof of Stake, validators, staking rewards, liquid staking, risks, best platforms"},
            {"id": "market-analysis", "title": {"fr": "Analyser le marche", "en": "Market analysis basics", "es": "Analisis de mercado basico"},
             "objective": {"fr": "Les bases de l'analyse de marche crypto", "en": "Basics of crypto market analysis", "es": "Bases del analisis de mercado cripto"},
             "topics": "market cap, volume, support/resistance, trends, sentiment, fear & greed index"},
            {"id": "altcoins", "title": {"fr": "Les Altcoins : Au-delà de BTC", "en": "Altcoins: Beyond BTC", "es": "Altcoins: Mas alla de BTC"},
             "objective": {"fr": "Explorer les altcoins majeurs et comment les evaluer", "en": "Explore major altcoins and how to evaluate them", "es": "Explorar los principales altcoins y como evaluarlos"},
             "topics": "Solana, Cardano, Polkadot, Layer 2s, meme coins, how to research a project"},
        ]
    },
    "advanced": {
        "id": "advanced",
        "title": {"fr": "Expert Crypto", "en": "Crypto Expert", "es": "Experto Cripto"},
        "description": {"fr": "Maîtrise les stratégies avancées de trading et DeFi", "en": "Master advanced trading and DeFi strategies", "es": "Domina estrategias avanzadas de trading y DeFi"},
        "icon": "diamond",
        "color": "#EF4444",
        "chapters": [
            {"id": "advanced-trading", "title": {"fr": "Trading avancé : Futures & Levier", "en": "Advanced trading: Futures & Leverage", "es": "Trading avanzado: Futuros y Apalancamiento"},
             "objective": {"fr": "Comprendre les futures, le levier et les risques associes", "en": "Understand futures, leverage and associated risks", "es": "Entender futuros, apalancamiento y riesgos asociados"},
             "topics": "futures contracts, leverage, liquidation, funding rates, long/short, risk management"},
            {"id": "technical-analysis", "title": {"fr": "Analyse technique approfondie", "en": "Deep technical analysis", "es": "Analisis tecnico avanzado"},
             "objective": {"fr": "Maitriser les indicateurs techniques et patterns de prix", "en": "Master technical indicators and price patterns", "es": "Dominar indicadores tecnicos y patrones de precios"},
             "topics": "RSI, MACD, Bollinger Bands, Fibonacci, candlestick patterns, volume analysis"},
            {"id": "advanced-defi", "title": {"fr": "Stratégies DeFi avancées", "en": "Advanced DeFi strategies", "es": "Estrategias DeFi avanzadas"},
             "objective": {"fr": "Yield farming, liquidity mining et strategies avancees", "en": "Yield farming, liquidity mining and advanced strategies", "es": "Yield farming, liquidity mining y estrategias avanzadas"},
             "topics": "impermanent loss, yield optimization, flash loans, MEV, cross-chain DeFi"},
            {"id": "tokenomics", "title": {"fr": "Tokenomics : Évaluer un projet", "en": "Tokenomics: Evaluate a project", "es": "Tokenomics: Evaluar un proyecto"},
             "objective": {"fr": "Analyser les tokenomics pour identifier les bons projets", "en": "Analyze tokenomics to identify good projects", "es": "Analizar tokenomics para identificar buenos proyectos"},
             "topics": "supply dynamics, vesting schedules, inflation, token utility, red flags"},
            {"id": "regulation", "title": {"fr": "Régulation et fiscalité", "en": "Regulation and taxes", "es": "Regulacion e impuestos"},
             "objective": {"fr": "Comprendre le cadre legal et fiscal des cryptos", "en": "Understand the legal and tax framework of crypto", "es": "Entender el marco legal y fiscal de las criptos"},
             "topics": "regulation by country, tax obligations, reporting, compliance, future outlook"},
            {"id": "portfolio", "title": {"fr": "Construire un portefeuille", "en": "Build a portfolio", "es": "Construir un portafolio"},
             "objective": {"fr": "Strategies d'allocation et gestion de portefeuille crypto", "en": "Allocation strategies and crypto portfolio management", "es": "Estrategias de asignacion y gestion de portafolio cripto"},
             "topics": "diversification, rebalancing, DCA, risk/reward, position sizing, exit strategies"},
        ]
    }
}

ASSESSMENT_QUESTIONS = [
    {"id": "q1", "question": {"fr": "Sais-tu ce qu'est une blockchain ?", "en": "Do you know what a blockchain is?", "es": "Sabes que es una blockchain?"},
     "type": "yesno", "weight": {"yes": 1, "no": 0}},
    {"id": "q2", "question": {"fr": "As-tu déjà acheté de la crypto ?", "en": "Have you ever bought crypto?", "es": "Has comprado cripto alguna vez?"},
     "type": "yesno", "weight": {"yes": 1, "no": 0}},
    {"id": "q3", "question": {"fr": "Connais-tu la difference entre Bitcoin et Ethereum ?", "en": "Do you know the difference between Bitcoin and Ethereum?", "es": "Conoces la diferencia entre Bitcoin y Ethereum?"},
     "type": "yesno", "weight": {"yes": 1, "no": 0}},
    {"id": "q4", "question": {"fr": "Sais-tu ce qu'est le staking ou la DeFi ?", "en": "Do you know what staking or DeFi is?", "es": "Sabes que es staking o DeFi?"},
     "type": "yesno", "weight": {"yes": 2, "no": 0}},
    {"id": "q5", "question": {"fr": "As-tu déjà utilisé un DEX ou fait du yield farming ?", "en": "Have you ever used a DEX or done yield farming?", "es": "Has utilizado un DEX o hecho yield farming?"},
     "type": "yesno", "weight": {"yes": 2, "no": 0}},
]


# ============ BADGES ============
CHAPTER_BADGES = {
    # Beginner badges
    "what-is-crypto": {"icon": "bulb", "name": {"fr": "Crypto Initie", "en": "Crypto Initiate", "es": "Cripto Iniciado"}, "color": "#10B981"},
    "bitcoin-basics": {"icon": "logo-bitcoin", "name": {"fr": "Bitcoiner", "en": "Bitcoiner", "es": "Bitcoiner"}, "color": "#F7931A"},
    "blockchain-simple": {"icon": "cube", "name": {"fr": "Chain Master", "en": "Chain Master", "es": "Chain Master"}, "color": "#627EEA"},
    "wallets": {"icon": "wallet", "name": {"fr": "Gardien de Cles", "en": "Key Guardian", "es": "Guardian de Claves"}, "color": "#8B5CF6"},
    "buy-first-crypto": {"icon": "cart", "name": {"fr": "Premier Achat", "en": "First Buy", "es": "Primera Compra"}, "color": "#06B6D4"},
    "security-basics": {"icon": "shield-checkmark", "name": {"fr": "Crypto Safe", "en": "Crypto Safe", "es": "Cripto Seguro"}, "color": "#EF4444"},
    # Intermediate badges
    "ethereum-smart-contracts": {"icon": "code-slash", "name": {"fr": "Smart Dev", "en": "Smart Dev", "es": "Smart Dev"}, "color": "#627EEA"},
    "defi": {"icon": "swap-horizontal", "name": {"fr": "DeFi Explorer", "en": "DeFi Explorer", "es": "DeFi Explorer"}, "color": "#8B5CF6"},
    "nfts": {"icon": "image", "name": {"fr": "NFT Collector", "en": "NFT Collector", "es": "NFT Collector"}, "color": "#EC4899"},
    "staking": {"icon": "lock-closed", "name": {"fr": "Staker Pro", "en": "Staker Pro", "es": "Staker Pro"}, "color": "#10B981"},
    "market-analysis": {"icon": "analytics", "name": {"fr": "Analyste", "en": "Analyst", "es": "Analista"}, "color": "#F59E0B"},
    "altcoins": {"icon": "planet", "name": {"fr": "Alt Hunter", "en": "Alt Hunter", "es": "Alt Hunter"}, "color": "#3B82F6"},
    # Advanced badges
    "advanced-trading": {"icon": "trending-up", "name": {"fr": "Trader Elite", "en": "Elite Trader", "es": "Trader Elite"}, "color": "#EF4444"},
    "technical-analysis": {"icon": "bar-chart", "name": {"fr": "Chartiste", "en": "Chartist", "es": "Chartista"}, "color": "#F59E0B"},
    "advanced-defi": {"icon": "flash", "name": {"fr": "DeFi Master", "en": "DeFi Master", "es": "DeFi Master"}, "color": "#8B5CF6"},
    "tokenomics": {"icon": "search", "name": {"fr": "Token Analyst", "en": "Token Analyst", "es": "Token Analyst"}, "color": "#06B6D4"},
    "regulation": {"icon": "document-text", "name": {"fr": "Crypto Legal", "en": "Crypto Legal", "es": "Cripto Legal"}, "color": "#6B7280"},
    "portfolio": {"icon": "pie-chart", "name": {"fr": "Portfolio Pro", "en": "Portfolio Pro", "es": "Portfolio Pro"}, "color": "#10B981"},
}

# Level completion badges (awarded when all 6 chapters of a level are done)
LEVEL_BADGES = {
    "beginner": {"icon": "ribbon", "name": {"fr": "Diplome Debutant", "en": "Beginner Diploma", "es": "Diploma Principiante"}, "color": "#10B981"},
    "intermediate": {"icon": "medal", "name": {"fr": "Diplome Intermediaire", "en": "Intermediate Diploma", "es": "Diploma Intermedio"}, "color": "#F59E0B"},
    "advanced": {"icon": "trophy", "name": {"fr": "Diplome Expert", "en": "Expert Diploma", "es": "Diploma Experto"}, "color": "#EF4444"},
}


# ============ SPECIALIZED MODULES (unlock after completing all chapters of a level) ============
SPECIALIZED_MODULES = {
    "beginner": {
        "id": "spec-beginner",
        "title": {"fr": "Specialisations Debutant", "en": "Beginner Specializations", "es": "Especializaciones Principiante"},
        "requires_all": True,  # requires all beginner chapters completed
        "chapters": [
            {"id": "spec-crypto-history", "title": {"fr": "L'histoire complete de la crypto", "en": "The complete history of crypto", "es": "La historia completa de cripto"},
             "objective": {"fr": "De Satoshi aux ETFs Bitcoin : toute l'histoire", "en": "From Satoshi to Bitcoin ETFs: the full story", "es": "De Satoshi a los ETFs de Bitcoin: toda la historia"},
             "topics": "cypherpunks, Satoshi whitepaper, Mt. Gox, ICO boom 2017, DeFi summer 2020, NFT craze 2021, FTX collapse, Bitcoin ETF approval 2024"},
            {"id": "spec-crypto-culture", "title": {"fr": "La culture crypto", "en": "Crypto culture", "es": "Cultura cripto"},
             "objective": {"fr": "Memes, communautes et jargon crypto", "en": "Memes, communities and crypto slang", "es": "Memes, comunidades y jerga cripto"},
             "topics": "WAGMI, NGMI, diamond hands, paper hands, rug pull, moon, FOMO, FUD, CT (Crypto Twitter), Reddit, Discord communities"},
        ]
    },
    "intermediate": {
        "id": "spec-intermediate",
        "title": {"fr": "Specialisations Intermediaire", "en": "Intermediate Specializations", "es": "Especializaciones Intermedio"},
        "requires_all": True,
        "chapters": [
            {"id": "spec-layer2", "title": {"fr": "Les Layer 2 en detail", "en": "Layer 2s in detail", "es": "Layer 2 en detalle"},
             "objective": {"fr": "Arbitrum, Optimism, Base, zkSync : comprendre les L2", "en": "Arbitrum, Optimism, Base, zkSync: understanding L2s", "es": "Arbitrum, Optimism, Base, zkSync: entendiendo L2s"},
             "topics": "rollups, optimistic vs zk-rollups, bridging, gas savings, major L2 ecosystems, TVL comparison"},
            {"id": "spec-real-world-defi", "title": {"fr": "DeFi en pratique", "en": "DeFi in practice", "es": "DeFi en practica"},
             "objective": {"fr": "Guide pas-a-pas pour utiliser Uniswap, Aave, Lido", "en": "Step-by-step guide to using Uniswap, Aave, Lido", "es": "Guia paso a paso para usar Uniswap, Aave, Lido"},
             "topics": "practical Uniswap swap, providing liquidity, lending on Aave, staking ETH on Lido, risks and fees"},
        ]
    },
    "advanced": {
        "id": "spec-advanced",
        "title": {"fr": "Specialisations Expert", "en": "Expert Specializations", "es": "Especializaciones Experto"},
        "requires_all": True,
        "chapters": [
            {"id": "spec-onchain-analysis", "title": {"fr": "Analyse on-chain", "en": "On-chain analysis", "es": "Analisis on-chain"},
             "objective": {"fr": "Lire la blockchain comme un pro (Glassnode, Nansen)", "en": "Read the blockchain like a pro (Glassnode, Nansen)", "es": "Leer la blockchain como un pro (Glassnode, Nansen)"},
             "topics": "on-chain metrics, whale tracking, exchange flows, NUPL, SOPR, realized price, Glassnode, Nansen, Dune Analytics"},
            {"id": "spec-crypto-macro", "title": {"fr": "Crypto et macroeconomie", "en": "Crypto and macroeconomics", "es": "Cripto y macroeconomia"},
             "objective": {"fr": "L'impact des taux, inflation et geopolitique sur le marche crypto", "en": "Impact of rates, inflation and geopolitics on crypto market", "es": "Impacto de tasas, inflacion y geopolitica en el mercado cripto"},
             "topics": "Fed rates, inflation CPI, dollar index DXY, Bitcoin correlation, institutional adoption, BlackRock, sovereign wealth funds"},
        ]
    }
}


# ============ SYSTEM PROMPTS ============
ATLAS_SYSTEM_PROMPT = """You are Atlas, the AI mentor of Mentova Academy. You are an expert in cryptocurrencies, blockchain and trading.

LANGUAGE: You MUST respond in {language} at all times.

STYLE:
- Friendly, encouraging, never condescending
- Use concrete examples and everyday analogies
- Always respond in {language}
- Be concise but complete

RULES:
- NEVER give direct financial advice
- Encourage DYOR (Do Your Own Research)
- Be honest about risks
- IMPORTANT: Do not re-ask the user's level if already given
"""

TEACH_PROMPT = """You are Atlas, AI mentor of Mentova Academy. You are giving a COMPLETE and DETAILED lesson on the following topic.

IMPORTANT: You MUST write ENTIRELY in {language}. Every word must be in {language}.

CHAPTER: {chapter_title}
OBJECTIVE: {chapter_objective}
TOPICS TO COVER: {chapter_topics}
USER LEVEL: {user_level}

IMPORTANT INSTRUCTIONS:
- The lesson must be VERY DETAILED and take about 5-7 minutes to read
- Adapt your language to the {user_level} level
- For beginner: simple everyday analogies, no unexplained jargon, concrete examples
- For intermediate: technical explanations with practical examples and real figures
- For advanced: in-depth discussions, strategies, nuances, case studies

MANDATORY LESSON STRUCTURE (respect ALL these sections):

1. ENGAGING INTRODUCTION (2-3 paragraphs)
   - Hook that captures attention (surprising fact, question, scenario)
   - Why this topic matters
   - What you will learn in this lesson

2. MAIN CONCEPT (3-4 paragraphs)
   - Detailed explanation of the central concept
   - Concrete everyday analogy
   - How it works in practice, step by step

3. DEEP DIVE (3-4 paragraphs)
   - Important technical details explained simply
   - Different types/categories of the concept
   - Advantages and risks/limitations

4. CONCRETE EXAMPLES AND REAL CASES (2-3 paragraphs)
   - Real example with figures/dates
   - Real-life use case
   - What professionals do

5. PRACTICAL TIPS (2-3 paragraphs)
   - What you can concretely do now
   - Mistakes to absolutely avoid
   - Recommended tools/platforms

6. SUMMARY - 5 KEY POINTS TO REMEMBER
   - Point 1
   - Point 2
   - Point 3
   - Point 4
   - Point 5

LANGUAGE: Write ENTIRELY in {language}. This is critical.
Be engaging and conversational, like an expert friend explaining over coffee.
Use emojis moderately to structure (no more than 1-2 per section).
DO NOT ask questions at the end - the lesson must be complete in itself.
The lesson must be at MINIMUM 1500 words. Be very detailed and give many concrete examples.
"""

QUIZ_PROMPT = """You are Atlas, AI mentor of Mentova Academy. Generate a COMPLETE QUIZ to test chapter comprehension.

IMPORTANT: Write ALL content in {language}.

CHAPTER: {chapter_title}
TOPICS COVERED: {chapter_topics}
LEVEL: {user_level}

Generate exactly 5 varied questions in this strict JSON format:
[
  {{
    "type": "mcq",
    "question": "Detailed multiple choice question in {language}?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Detailed explanation of the correct answer in {language}"
  }},
  {{
    "type": "truefalse",
    "question": "True or false statement in {language}?",
    "correct": true,
    "explanation": "Clear explanation in {language}"
  }},
  {{
    "type": "open",
    "question": "Open question requiring personal reflection in {language}.",
    "key_points": ["Key point 1", "Key point 2", "Key point 3"],
    "explanation": "Complete expected answer in {language}"
  }},
  {{
    "type": "mcq",
    "question": "Second MCQ on a different aspect in {language}?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 2,
    "explanation": "Explanation in {language}"
  }},
  {{
    "type": "truefalse",
    "question": "Second true/false statement in {language}?",
    "correct": false,
    "explanation": "Explanation with correction in {language}"
  }}
]

IMPORTANT: 
- Respond ONLY with JSON, nothing else. No markdown, no text before/after.
- Adapt difficulty to {user_level} level.
- Questions must cover different aspects of the chapter.
- Explanations must be educational and detailed.
- ALL text MUST be in {language}.
"""

CORRECT_PROMPT = """You are Atlas, AI mentor of Mentova Academy. The user answered an open question.

IMPORTANT: Respond in {language}.

QUESTION: {question}
USER ANSWER: {user_answer}
EXPECTED KEY POINTS: {key_points}

Evaluate the answer:
1. Say if it's correct, partially correct, or incorrect
2. Explain what's good in their answer
3. Complete or correct if needed
4. Encourage the user

Be kind but precise. Respond in 3-5 sentences maximum. Write in {language}.
"""

# ============ MODELS ============
class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    lang: str = "en"

class AssessmentAnswer(BaseModel):
    answers: Dict[str, str]  # {"q1": "yes", "q2": "no", ...}

class QuizAnswer(BaseModel):
    chapter_id: str
    question_index: int
    question_type: str  # "mcq", "truefalse", "open"
    answer: str  # index for mcq, "true"/"false" for truefalse, text for open
    question_text: Optional[str] = None
    key_points: Optional[List[str]] = None
    lang: str = "en"

class TeachRequest(BaseModel):
    chapter_id: str
    level_id: str
    lang: str = "en"


# ============ DB HELPERS ============
_db_ref = None

def _get_db():
    """Get MongoDB database reference."""
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
        logger.warning(f"Could not get db: {e}")
        return None


# ============ LLM HELPERS ============
async def _llm_complete(messages: list) -> str:
    """Call LLM and return text response."""
    import litellm
    response = await litellm.acompletion(
        model="gpt-4o",
        messages=messages,
        api_key=EMERGENT_LLM_KEY,
        api_base="https://integrations.emergentagent.com/llm",
        custom_llm_provider="openai",
    )
    return response.choices[0].message.content


async def _llm_stream(messages: list):
    """Stream LLM response."""
    import litellm
    response = await litellm.acompletion(
        model="gpt-4o",
        messages=messages,
        api_key=EMERGENT_LLM_KEY,
        api_base="https://integrations.emergentagent.com/llm",
        custom_llm_provider="openai",
        stream=True,
    )
    async for chunk in response:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


# ============ ENDPOINTS ============

@atlas_router.get("/curriculum")
async def get_curriculum(lang: str = "fr"):
    """Get the full curriculum structure with badges and specialized modules."""
    result = {}
    for level_id, level in CURRICULUM.items():
        chapters = []
        for ch in level["chapters"]:
            badge = CHAPTER_BADGES.get(ch["id"])
            chapters.append({
                "id": ch["id"],
                "title": ch["title"].get(lang, ch["title"]["en"]),
                "objective": ch["objective"].get(lang, ch["objective"]["en"]),
                "badge": {
                    "icon": badge["icon"],
                    "name": badge["name"].get(lang, badge["name"]["en"]),
                    "color": badge["color"],
                } if badge else None,
            })

        # Add specialized modules
        spec = SPECIALIZED_MODULES.get(level_id)
        spec_chapters = []
        if spec:
            for ch in spec["chapters"]:
                badge = CHAPTER_BADGES.get(ch["id"])
                spec_chapters.append({
                    "id": ch["id"],
                    "title": ch["title"].get(lang, ch["title"]["en"]),
                    "objective": ch["objective"].get(lang, ch["objective"]["en"]),
                    "badge": {"icon": badge["icon"], "name": badge["name"].get(lang, badge["name"]["en"]), "color": badge["color"]} if badge else None,
                })

        level_badge = LEVEL_BADGES.get(level_id)
        result[level_id] = {
            "id": level["id"],
            "title": level["title"].get(lang, level["title"]["en"]),
            "description": level["description"].get(lang, level["description"]["en"]),
            "icon": level["icon"],
            "color": level["color"],
            "chapters": chapters,
            "level_badge": {
                "icon": level_badge["icon"],
                "name": level_badge["name"].get(lang, level_badge["name"]["en"]),
                "color": level_badge["color"],
            } if level_badge else None,
            "specialized_modules": spec_chapters,
        }
    return result


@atlas_router.get("/badges/{user_id}")
async def get_user_badges(user_id: str, lang: str = "fr"):
    """Get all badges earned by a user."""
    db = _get_db()
    if db is None:
        return {"badges": [], "level_badges": []}

    progress = await db.learning_progress.find_one({"user_id": user_id})
    if not progress:
        return {"badges": [], "level_badges": []}

    completed = progress.get("completed_chapters", [])
    badges = []
    for ch_id in completed:
        badge = CHAPTER_BADGES.get(ch_id)
        if badge:
            score = progress.get("quiz_scores", {}).get(ch_id, 0)
            badges.append({
                "chapter_id": ch_id,
                "icon": badge["icon"],
                "name": badge["name"].get(lang, badge["name"]["en"]),
                "color": badge["color"],
                "score": score,
            })

    # Check level completion badges
    level_badges = []
    for level_id, level in CURRICULUM.items():
        all_chapter_ids = [ch["id"] for ch in level["chapters"]]
        if all(ch_id in completed for ch_id in all_chapter_ids):
            lb = LEVEL_BADGES.get(level_id)
            if lb:
                level_badges.append({
                    "level_id": level_id,
                    "icon": lb["icon"],
                    "name": lb["name"].get(lang, lb["name"]["en"]),
                    "color": lb["color"],
                })

    return {"badges": badges, "level_badges": level_badges}


@atlas_router.get("/assessment/questions")
async def get_assessment_questions(lang: str = "fr"):
    """Get assessment questions to determine user level."""
    return {"questions": [{
        "id": q["id"],
        "question": q["question"].get(lang, q["question"]["en"]),
        "type": q["type"],
    } for q in ASSESSMENT_QUESTIONS]}


@atlas_router.post("/assessment/submit")
async def submit_assessment(data: AssessmentAnswer):
    """Submit assessment answers and get recommended level."""
    score = 0
    for q in ASSESSMENT_QUESTIONS:
        answer = data.answers.get(q["id"], "no")
        score += q["weight"].get(answer, 0)

    if score >= 5:
        level = "advanced"
    elif score >= 2:
        level = "intermediate"
    else:
        level = "beginner"

    return {"level": level, "score": score, "max_score": 7}


@atlas_router.get("/progress/{user_id}")
async def get_progress(user_id: str):
    """Get user's learning progress."""
    db = _get_db()
    if db is None:
        return {"level": None, "completed_chapters": [], "quiz_scores": {}}

    progress = await db.learning_progress.find_one({"user_id": user_id})
    if not progress:
        return {"level": None, "completed_chapters": [], "quiz_scores": {}, "current_chapter": None}

    return {
        "level": progress.get("level"),
        "completed_chapters": progress.get("completed_chapters", []),
        "quiz_scores": progress.get("quiz_scores", {}),
        "current_chapter": progress.get("current_chapter"),
        "assessment_done": progress.get("assessment_done", False),
    }


@atlas_router.post("/progress/{user_id}/level")
async def set_user_level(user_id: str, data: dict):
    """Set user's learning level after assessment."""
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    level = data.get("level", "beginner")
    await db.learning_progress.update_one(
        {"user_id": user_id},
        {"$set": {
            "level": level,
            "assessment_done": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, "$setOnInsert": {
            "user_id": user_id,
            "completed_chapters": [],
            "quiz_scores": {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"status": "ok", "level": level}


@atlas_router.post("/progress/{user_id}/complete")
async def complete_chapter(user_id: str, data: dict):
    """Mark a chapter as completed with quiz score."""
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    chapter_id = data.get("chapter_id")
    score = data.get("score", 0)

    await db.learning_progress.update_one(
        {"user_id": user_id},
        {
            "$addToSet": {"completed_chapters": chapter_id},
            "$set": {
                f"quiz_scores.{chapter_id}": score,
                "current_chapter": data.get("next_chapter"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return {"status": "ok"}


@atlas_router.post("/teach")
async def teach_chapter(data: TeachRequest):
    """Atlas teaches a specific chapter - returns streaming lesson."""
    level = CURRICULUM.get(data.level_id)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    chapter = None
    for ch in level["chapters"]:
        if ch["id"] == data.chapter_id:
            chapter = ch
            break
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    lang = data.lang or "en"
    lang_map = {"fr": "French", "en": "English", "es": "Spanish"}
    language = lang_map.get(lang, "English")
    
    prompt = TEACH_PROMPT.format(
        chapter_title=chapter["title"].get(lang, chapter["title"]["en"]),
        chapter_objective=chapter["objective"].get(lang, chapter["objective"]["en"]),
        chapter_topics=chapter["topics"],
        user_level=data.level_id,
        language=language,
    )

    user_msg_map = {"fr": f"Enseigne-moi ce chapitre : {chapter['title'].get('fr', chapter['title']['en'])}", "en": f"Teach me this chapter: {chapter['title'].get('en', '')}", "es": f"Enséñame este capítulo: {chapter['title'].get('es', chapter['title']['en'])}"}
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": user_msg_map.get(lang, user_msg_map["en"])},
    ]

    async def stream():
        try:
            import litellm
            response = await litellm.acompletion(
                model="gpt-4o",
                messages=messages,
                api_key=EMERGENT_LLM_KEY,
                api_base="https://integrations.emergentagent.com/llm",
                custom_llm_provider="openai",
                stream=True,
            )
            async for chunk in response:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield f"data: {delta.content}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Atlas teach error: {e}")
            yield "data: Desole, une erreur s'est produite.\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})



class TeachChatRequest(BaseModel):
    chapter_id: str
    level_id: str
    message: str
    session_id: Optional[str] = None
    lang: str = "en"


TEACH_CHAT_PROMPT = """You are Atlas, AI mentor of Mentova Academy. You are currently teaching a specific chapter.

IMPORTANT: You MUST respond in {language}.

CURRENT CHAPTER: {chapter_title}
OBJECTIVE: {chapter_objective}
TOPICS: {chapter_topics}
LEVEL: {user_level}

The user asks a question or makes a comment during the lesson. Respond in a way that is:
- Related to the current chapter (steer the discussion back to the topic if needed)
- Adapted to their level ({user_level})
- Educational and encouraging
- Concise but complete (3-5 sentences)
- If the user says they don't understand, re-explain differently with a new analogy
- If the user asks an off-topic question, answer briefly then return to the chapter
- ALWAYS write in {language}
"""


@atlas_router.post("/teach/chat")
async def teach_chat(data: TeachChatRequest, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Interactive chat DURING a lesson - Atlas answers questions about the chapter."""
    uid, is_vip = await _get_user_and_vip(credentials)
    effective_id = uid or "anonymous"

    # Rate limit for non-VIP
    if not is_vip:
        rate = _check_rate_limit(effective_id)
        if not rate["allowed"]:
            limit_msgs = {"fr": "Tu as atteint ta limite de messages. Abonne-toi VIP pour un acces illimite !", "en": "You've reached your message limit. Subscribe VIP for unlimited access!", "es": "Has alcanzado tu limite de mensajes. Suscribete VIP para acceso ilimitado!"}
            return {"response": limit_msgs.get(lang, limit_msgs["en"]), "limit_reached": True}
        _increment_usage(effective_id)

    level = CURRICULUM.get(data.level_id)
    chapter = None
    if level:
        for ch in level["chapters"]:
            if ch["id"] == data.chapter_id:
                chapter = ch
                break

    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    session_id = data.session_id or f"teach-{data.chapter_id}"
    lang = getattr(data, 'lang', 'en') or 'en'
    lang_map = {"fr": "French", "en": "English", "es": "Spanish"}
    language = lang_map.get(lang, "English")
    prompt = TEACH_CHAT_PROMPT.format(
        chapter_title=chapter["title"].get(lang, chapter["title"]["en"]),
        chapter_objective=chapter["objective"].get(lang, chapter["objective"]["en"]),
        chapter_topics=chapter["topics"],
        user_level=data.level_id,
        language=language,
    )

    _add_to_session(session_id, "user", data.message)
    messages = [{"role": "system", "content": prompt}]
    messages.extend(_get_session(session_id))

    try:
        text = await _llm_complete(messages)
        _add_to_session(session_id, "assistant", text)
        return {"response": text, "session_id": session_id}
    except Exception as e:
        logger.error(f"Teach chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@atlas_router.post("/quiz/generate")
async def generate_quiz(data: TeachRequest):
    """Generate a quiz for a specific chapter."""
    level = CURRICULUM.get(data.level_id)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    chapter = None
    for ch in level["chapters"]:
        if ch["id"] == data.chapter_id:
            chapter = ch
            break
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    lang = data.lang or "en"
    lang_map = {"fr": "French", "en": "English", "es": "Spanish"}
    language = lang_map.get(lang, "English")
    
    prompt = QUIZ_PROMPT.format(
        chapter_title=chapter["title"].get(lang, chapter["title"]["en"]),
        chapter_topics=chapter["topics"],
        user_level=data.level_id,
        language=language,
    )

    quiz_msg = {"fr": "Genere le quiz maintenant.", "en": "Generate the quiz now.", "es": "Genera el quiz ahora."}
    try:
        result = await _llm_complete([
            {"role": "system", "content": prompt},
            {"role": "user", "content": quiz_msg.get(lang, quiz_msg["en"])},
        ])
        # Parse JSON from response
        import json
        # Clean potential markdown wrapping
        cleaned = result.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()

        questions = json.loads(cleaned)
        return {"questions": questions, "chapter_id": data.chapter_id}
    except Exception as e:
        logger.error(f"Quiz generation error: {e}")
        # Fallback static quiz
        return {"questions": [
            {"type": "mcq", "question": f"Question sur {chapter['title']['fr']}",
             "options": ["Option A", "Option B", "Option C", "Option D"],
             "correct": 0, "explanation": "Explication a venir"},
        ], "chapter_id": data.chapter_id}


@atlas_router.post("/quiz/correct")
async def correct_open_answer(data: QuizAnswer):
    """Correct an open-ended quiz answer using AI."""
    if data.question_type != "open":
        return {"error": "Only open questions need AI correction"}

    lang_map = {"fr": "French", "en": "English", "es": "Spanish"}
    language = lang_map.get(data.lang or "en", "English")
    prompt = CORRECT_PROMPT.format(
        question=data.question_text or "",
        user_answer=data.answer,
        key_points=", ".join(data.key_points or []),
        language=language,
    )

    try:
        result = await _llm_complete([
            {"role": "system", "content": prompt},
            {"role": "user", "content": data.answer},
        ])
        return {"correction": result, "chapter_id": data.chapter_id}
    except Exception as e:
        logger.error(f"Quiz correction error: {e}")
        return {"correction": "Bonne tentative ! Continue comme ca.", "chapter_id": data.chapter_id}


# ============ USAGE & LIMITS ============

@atlas_router.get("/usage")
async def get_usage(user_id: Optional[str] = None, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Get usage info for rate limiting. VIP users get unlimited."""
    uid, is_vip = await _get_user_and_vip(credentials)
    effective_id = uid or user_id or "anonymous"

    if is_vip:
        return {"is_vip": True, "remaining": 999, "limit": 999, "reset_at": 0, "allowed": True, "free_chapters": 999}

    rate = _check_rate_limit(effective_id)
    return {
        "is_vip": False,
        "remaining": rate["remaining"],
        "limit": rate["limit"],
        "reset_at": rate["reset_at"],
        "allowed": rate["allowed"],
        "free_chapters": FREE_CHAPTERS,
    }


# ============ CHAT (with memory + rate limiting) ============

@atlas_router.post("/chat")
async def atlas_chat(data: ChatMessage, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Streaming chat with conversation memory and rate limiting."""
    uid, is_vip = await _get_user_and_vip(credentials)
    effective_id = uid or data.user_id or "anonymous"
    session_id = data.session_id or str(uuid.uuid4())
    logger.info(f"Atlas chat: lang={data.lang}, user={effective_id}, session={session_id[:16]}")

    # Rate limit check for non-VIP
    if not is_vip:
        rate = _check_rate_limit(effective_id)
        if not rate["allowed"]:
            reset_at = rate["reset_at"]
            async def limit_stream():
                yield f"data: [LIMIT_REACHED]{reset_at}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(limit_stream(), media_type="text/event-stream",
                                     headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
        _increment_usage(effective_id)

    _add_to_session(session_id, "user", data.message)
    lang_map = {"fr": "French", "en": "English", "es": "Spanish"}
    language = lang_map.get(data.lang or "en", "English")
    system_prompt = ATLAS_SYSTEM_PROMPT.format(language=language)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(_get_session(session_id))

    async def stream():
        try:
            import litellm
            response = await litellm.acompletion(
                model="gpt-4o", messages=messages,
                api_key=EMERGENT_LLM_KEY,
                api_base="https://integrations.emergentagent.com/llm",
                custom_llm_provider="openai", stream=True,
            )
            full = ""
            async for chunk in response:
                delta = chunk.choices[0].delta
                if delta.content:
                    full += delta.content
                    yield f"data: {delta.content}\n\n"
            _add_to_session(session_id, "assistant", full)
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Atlas chat error: {e}")
            yield "data: Sorry, an error occurred.\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@atlas_router.post("/chat/simple")
async def atlas_chat_simple(data: ChatMessage, credentials: HTTPAuthorizationCredentials = Depends(optional_security)):
    """Non-streaming chat fallback with memory and rate limiting."""
    uid, is_vip = await _get_user_and_vip(credentials)
    effective_id = uid or data.user_id or "anonymous"
    session_id = data.session_id or str(uuid.uuid4())
    logger.info(f"Atlas chat/simple: lang={data.lang}, user={effective_id}, session={session_id[:16]}")

    # Rate limit check for non-VIP
    if not is_vip:
        rate = _check_rate_limit(effective_id)
        if not rate["allowed"]:
            return {"error": "limit_reached", "reset_at": rate["reset_at"], "remaining": 0}
        _increment_usage(effective_id)

    _add_to_session(session_id, "user", data.message)
    lang_map = {"fr": "French", "en": "English", "es": "Spanish"}
    language = lang_map.get(data.lang or "en", "English")
    system_prompt = ATLAS_SYSTEM_PROMPT.format(language=language)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(_get_session(session_id))

    try:
        text = await _llm_complete(messages)
        _add_to_session(session_id, "assistant", text)
        return {"response": text, "session_id": session_id}
    except Exception as e:
        logger.error(f"Atlas simple error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
