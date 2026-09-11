# Mentova - Professional Crypto Learning Platform

## Architecture
- **Frontend**: React Native (Expo) Web Export -> Netlify (app.mentova-academy.com)
- **Static Site**: HTML/CSS -> Netlify (mentova-academy.com)
- **Backend**: FastAPI -> Render (mentova-api.onrender.com)
- **Database**: MongoDB Atlas (production) / localhost (preview)
- **AI**: OpenAI GPT-5.6 Terra (user's own API key)
- **Payments**: Stripe Checkout (DISABLED for free launch)
- **Crypto Data**: CoinGecko Pro API (zero user-call architecture)

## Current State (Sept 11, 2026)

### Atlas-Centric 5-Tab Navigation (DONE)
- **Atlas AI** (1st tab) - Persistent AI mentor with GPT-5.6 Terra
- **Home** - Dashboard with market stats, quick actions, news preview, learning progress
- **Market** - Real-time crypto prices
- **News** - Translated articles FR/EN/ES
- **Profile** - Account settings (no VIP/Pro sections)

### Atlas AI v3 - COMPLETE (Backend + Frontend)
Backend:
- GPT-5.6 Terra with user's OpenAI API key
- 7 MongoDB collections (user_learning_profiles, atlas_memories, atlas_conversations, learning_modules, module_progress, quiz_attempts)
- 10 OpenAI function tools for persistent learning
- Language support: FR/EN/ES (forced via system prompt)
- Rate limiting: 10/min, 200/day
- Auth: JWT user isolation

Frontend (learn.tsx):
- 3 sub-tabs: Chat, Modules, Progression
- Full i18n with tAtlas() helper (FR/EN/ES)
- Chat: conversation history sidebar, new/delete conversations, real-time responses
- Modules: filter bar (all/in_progress/not_started/mastered), detail view with mastery bars, quiz history
- Progress: level badge, 5 skill bars, modules summary, category breakdown, recent quizzes

API Endpoints:
- POST /api/atlas/chat
- GET /api/atlas/conversations, GET/DELETE /api/atlas/conversations/:id
- GET /api/atlas/modules, GET /api/atlas/modules/:id
- GET /api/atlas/profile
- GET /api/atlas/progress

### App Restructuring Around Atlas (DONE - Sept 11)
- Tab order: Atlas -> Home -> Market -> News -> Profile
- Profile: VIP/Pro banners and sections removed
- Settings: Biometric toggle removed
- Support: Fully translated FR/EN/ES with expandable FAQ
- Home: Missing i18n keys (continueLearning, lessonsCompleted, resumeCourse) added
- Landing page: "PRO TOOLS" renamed to "Outils/Tools/Herramientas"
- Open Graph meta tags added to +html.tsx for social sharing

### Landing Page (DONE)
- Editorial design, solid colors, asymmetrical layouts
- Atlas IA animated showcase (5-slide cycle)
- Stats, features, how it works, vision, story, roadmap, FAQ sections
- Mentor & Ambassador recruitment pages linked in nav
- Deployed FR/EN/ES with proper accents
- "Acces libre" messaging (not "gratuit")

### Hidden Features (code kept, not visible)
- Community (gate + founding members)
- Mentors / Marketplace
- VIP/Premium features
- Old Atlas v1/v2 (routes/atlas.py still exists but not mounted)

### Deployments
- mentova-academy.com: LIVE (Netlify)
- app.mentova-academy.com: LIVE (Netlify)
- mentova-api.onrender.com: Needs OPENAI_API_KEY in Render env vars

## Key Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!
- OpenAI API Key: In backend/.env (OPENAI_API_KEY)
- Netlify Token: nfp_et6ZSodb7Wj2mHSGNY4JrRnvrEYFxJVR3b9e

## Backlog
### P0
- (none - all P0 items resolved)

### P1
- Confirm OpenAI API key is set in Render environment variables
- Fix CoinGecko API key (401 errors)

### P2
- Re-enable Stripe Payments / VIP features when ready to monetize
- Re-enable Community Forum + Founding Member gate

### P3
- Technical indicators (RSI, Bollinger) on crypto charts
- reCAPTCHA on auth forms
- Refactor server.py monolith
