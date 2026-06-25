# Mentova - Professional Crypto Mentor Marketplace

## Original Problem Statement
Build a professional mentor marketplace named "Mentova" using React Native (Expo) and FastAPI. Requirements include:
- Full multilingual support (FR, EN, ES)
- VIP membership ($9.99/mo first 500 founders, then $25.99/mo)
- "Atlas" Adaptive AI Mentor with structured learning modules and chat
- Twitter/X-style Community forum
- Apple-compliant mobile app + web app
- Backend running 24/7 independently on Render

## Architecture
- **Frontend**: React Native (Expo) with web export
- **Backend**: FastAPI (monolith server.py ~12k lines, partially refactored into routes/)
- **Database**: MongoDB Atlas (user's personal cluster)
- **Hosting**: Netlify (web app), Render (backend), EAS (mobile OTA)
- **AI**: LiteLLM via Emergent proxy for GPT-4o streaming
- **Payments**: Stripe Checkout (STRIPE_SK env var)

## What's Been Implemented

### Core Features (DONE)
- User authentication (JWT) with session persistence
- Stripe VIP membership integration
- Atlas AI Mentor v3 (assessment, curriculum, 1500+ word lessons, quizzes, badges)
- VIP limits (2 free chapters, 20 msgs/24h)
- Community forum (posts, comments, likes, votes, bookmarks, delete, report)
- Interactive contextual glossary for crypto terms
- User profiles and following system
- Messaging system
- Admin dashboard
- Price alerts and crypto tools

### Notification System (DONE - June 22, 2026)
- E2E notification flow: Action -> Backend storage -> Frontend display
- Triggers: likes, comments, messages, reports, follows
- Backend: send_notification_to_user() stores in MongoDB + Expo Push + WebSocket
- Frontend: NotificationCenter with bell icon badge, modal, filters

### UI Modernization (DONE - June 24, 2026)
- Glassmorphism design, CSS aurora background animations
- Redesigned Home, Login, Register, Dashboard, Learn, Community, Profile

### CoinGecko Global Cache (DONE - June 24, 2026)
- apscheduler refreshes crypto prices every 40s globally
- Avoids 100k/month API rate limit

### Backend Architecture Phase 1 & 2 (DONE - June 24, 2026)
- Created deps.py for shared dependency injection
- Extracted routes/community.py and routes/admin.py from server.py

### Atlas AI Language Bug Fix (DONE - June 25, 2026)
- **Root cause**: ATLAS_SYSTEM_PROMPT used {language} placeholder but some endpoints didn't format it correctly. CORRECT_PROMPT.format() was missing the language parameter entirely (would cause KeyError). Frontend Lesson teach/chat and quiz correction didn't send lang parameter.
- **Fixes applied**:
  - Backend: All atlas endpoints (chat, chat/simple, teach, teach/chat, quiz/generate, quiz/correct) now properly inject language from lang parameter
  - Backend: QuizAnswer model now has lang field
  - Backend: Rate-limit messages localized (FR/EN/ES)
  - Backend: Debug logging added (Atlas chat: lang=X, user=Y)
  - Frontend: teach/chat and quiz/correct now send lang parameter
  - Frontend: Error messages localized in AtlasChat
  - Frontend: lang added to useCallback deps in sendMessage
  - Frontend: Language switcher pill (EN/FR/ES) added to Learn tab bar - cycles languages on tap
- **Testing**: 8/8 backend tests pass, frontend verified via testing agent

## Pending Tasks

### P2 - Web App Desktop Responsiveness
- Rethink responsive grids and max-widths for desktop
- Status: NOT STARTED (recurring issue)

### P2 - Refactor server.py
- Remaining routes to extract: Auth, Pro Dashboard, VIP, Crypto, Messages
- Status: IN PROGRESS (community.py and admin.py done)

### P2 - Technical Indicators for VIP Crypto Charts
- Add RSI, Bollinger Bands to interactive charts
- Status: NOT STARTED

## Backlog
- (P3) reCAPTCHA on auth forms
- (P3) Split translations.ts by feature
- (P3) Localize notification template strings (currently French-only titles/bodies)

## Key API Endpoints
- POST /api/auth/login -> {access_token, user}
- POST /api/atlas/chat -> streaming chat with lang support
- POST /api/atlas/chat/simple -> non-streaming chat with lang support
- POST /api/atlas/teach -> streaming lesson with lang support
- POST /api/atlas/teach/chat -> lesson Q&A with lang support
- POST /api/atlas/quiz/generate -> quiz generation with lang support
- POST /api/atlas/quiz/correct -> quiz correction with lang support
- GET /api/atlas/curriculum?lang=X -> curriculum in specified language
- GET /api/crypto/prices -> cached crypto prices
- GET /api/notifications/history -> notification list
- POST /api/community/posts/{id}/like -> triggers notification
