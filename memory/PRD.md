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
- **Backend**: FastAPI (monolith server.py, partially refactored into routes/)
- **Database**: MongoDB Atlas (user's personal cluster)
- **Hosting**: Netlify (web app), Render (backend), EAS (mobile OTA)
- **AI**: LiteLLM via Emergent proxy for GPT-4o streaming
- **Payments**: Stripe Checkout (STRIPE_SK env var)
- **Crypto Data**: CoinGecko Pro API (ZERO user-call architecture)

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

### UI Modernization (DONE - June 24, 2026)
- Glassmorphism design, CSS aurora background animations

### CoinGecko Zero-User-Call Architecture (DONE - June 25, 2026)
- **ALL CoinGecko API calls happen exclusively in background scheduler**
- **User endpoints are 100% read-from-cache — ZERO API calls triggered by users**
- Architecture:
  - 1 global call every 120s: `coins/markets?sparkline=true` → prices + 24H/7D charts for ALL 20 coins
  - Global stats refresh every 300s (1 call)
  - Trending refresh every 600s (1 call)
  - Hourly pre-fetch: 30D/90D/365D charts for all 20 coins (~60 calls/hour)
  - Hourly Rainbow BTC chart pre-fetch (1 call)
- Estimated budget: ~78k calls/month (well under 100k Pro limit)
- Cold-start handling: endpoints return `success=False` + loading message until cache is warm (~90s)
- Testing: 28/28 backend tests passed, frontend verified

### Backend Architecture Phase 1 & 2 (DONE - June 24, 2026)
- Created deps.py for shared dependency injection
- Extracted routes/community.py and routes/admin.py from server.py

### Atlas AI Language Bug Fix (DONE - June 25, 2026)
- All atlas endpoints properly inject language parameter

### Interactive Charts Upgrade (DONE - June 25, 2026)
- Smooth drag interaction with crosshair, glow effect, floating price/date labels
- Period selector (24H, 7J, 30J, 90J, 1A)

### Rainbow BTC Chart (DONE - June 25, 2026)
- 10-band classic log-regression chart with VIP-only interactivity
- Collapsible UI, calibrated regression ($60K BTC = "Basically a Fire Sale" band)

### Super Admin Analytics (DONE - June 25, 2026)
- Live dashboard tracking active users, CoinGecko API budget, endpoints
- MongoDB persistence to survive Render reboots

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
- (P3) Localize notification template strings

## Key API Endpoints
- POST /api/auth/login -> {access_token, user}
- GET /api/crypto/prices -> cached prices (20 coins, refreshed every 120s)
- GET /api/crypto/chart/{coin_id}?days={1,7,30,90,365} -> read-only from cache
- GET /api/crypto/rainbow -> read-only from cache (pre-fetched hourly)
- GET /api/crypto/global -> cached global stats
- GET /api/crypto/trending -> cached trending coins
- GET /api/admin/analytics/realtime -> live dashboard data
- GET /api/news -> translated live RSS
