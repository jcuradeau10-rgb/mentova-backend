# Mentova - Professional Crypto Learning Platform

## Architecture
- **Frontend**: React Native (Expo) Web Export -> Netlify (app.mentova-academy.com)
- **Static Site**: HTML/CSS -> Netlify (mentova-academy.com)
- **Backend**: FastAPI -> Render (mentova-api.onrender.com)
- **Database**: MongoDB Atlas (production) / localhost (preview)
- **AI**: OpenAI GPT-5.6 Terra (user's own API key)
- **Payments**: Stripe Checkout (DISABLED for free launch)
- **Crypto Data**: CoinGecko Pro API (zero user-call architecture)

## Current State (Sept 10, 2026)

### Simplified 5-Tab Navigation (DONE)
- **Home** - Dashboard with market stats, quick actions, news preview, learning progress
- **Atlas AI** - Persistent AI mentor with GPT-5.6 Terra
- **Market** - Real-time crypto prices
- **News** - Translated articles FR/EN/ES
- **Profile** - Account settings

### Atlas AI v3 - Backend COMPLETE
Database collections created:
- user_learning_profiles
- atlas_memories
- atlas_conversations
- learning_modules
- module_progress
- quiz_attempts

10 OpenAI function tools implemented:
- get_user_profile, update_user_profile, save_memory
- get_learning_history, get_modules, create_learning_module
- update_learning_module, record_quiz_result, update_mastery, mark_module_mastered

API Endpoints:
- POST /api/atlas/chat (main chat with function calling)
- GET /api/atlas/conversations (list)
- GET /api/atlas/conversations/:id (detail)
- DELETE /api/atlas/conversations/:id
- GET /api/atlas/modules (user's modules)
- GET /api/atlas/modules/:id (module detail + progress + quizzes)
- GET /api/atlas/profile (learning profile + stats)
- GET /api/atlas/progress (detailed progress by category)

### Landing Page (DONE)
- Editorial design, solid colors, asymmetrical layouts
- Atlas IA animated showcase (5-slide cycle)
- Stats, features, how it works, vision, story, roadmap, FAQ sections
- Mentor & Ambassador recruitment pages linked in nav
- Deployed FR/EN/ES with proper accents
- "Accès libre" messaging (not "gratuit")
- No Montreal, just Canada

### Hidden Features (code kept, not visible)
- Community (gate + founding members)
- Mentors / Marketplace
- VIP/Premium features
- Old Atlas v1/v2 (routes/atlas.py still exists but not mounted)

### Deployments
- mentova-academy.com: LIVE (Netlify)
- app.mentova-academy.com: LIVE (Netlify)
- mentova-api.onrender.com: 502 - MongoDB Atlas cluster paused

## Key Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!
- OpenAI API Key: In backend/.env (OPENAI_API_KEY)
- Netlify Token: nfp_et6ZSodb7Wj2mHSGNY4JrRnvrEYFxJVR3b9e

## Backlog
### P0
- Fix Render backend (MongoDB Atlas cluster needs to be resumed)
- **Atlas Frontend UI** (Phase 3): Chat screen, Modules screen, Progress screen, History

### P1
- Fix CoinGecko API key (401 errors)
- Desktop responsiveness

### P2
- Re-enable Stripe Payments / VIP features
- Re-enable Community Forum + Founding Member gate

### P3
- Technical indicators (RSI, Bollinger) on crypto charts
- reCAPTCHA on auth forms
- Refactor server.py monolith
