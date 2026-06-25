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
- **Hosting**: Netlify (web app + static site), Render (backend), EAS (mobile OTA)
- **AI**: LiteLLM via Emergent proxy for GPT-4o streaming
- **Payments**: Stripe Checkout (STRIPE_SK env var)
- **Crypto Data**: CoinGecko Pro API (ZERO user-call architecture)

## What's Been Implemented

### Core Features (DONE)
- User authentication (JWT) with session persistence
- Stripe VIP membership integration with Founding Member badge
- Atlas AI Mentor v3
- Community forum, messaging, profiles
- Admin dashboard

### CoinGecko Zero-User-Call Architecture (DONE - June 25, 2026)
- ALL CoinGecko API calls happen exclusively in background scheduler
- User endpoints are 100% read-from-cache
- Estimated budget: ~78k calls/month (under 100k Pro limit)

### Founding Member System (DONE - June 25, 2026)
- Spots counter only counts Stripe-confirmed paid members (not pre-registrations)
- VIP activation sets `founding_member: true` in both `users` and `pre_registrations` collections
- Badge visible on profile page (gold star + "Founding Member" text)
- Webhook + checkout status both handle founding member badge attribution
- Wave 2 pricing auto-activates when 500 paid founders reached

### Static Site Fixes (DONE - June 25, 2026)
- Removed all "—" (em dashes) from EN/FR/ES versions, replaced with "|" or ":"
- Fixed duplicate `id="heroSpots"` causing invalid HTML
- Added `contain: layout style` on hero-desc to prevent text reflow from countdown updates
- Fixed countdown number elements with `min-width: 2ch`

## Pending Tasks

### P2 - Web App Desktop Responsiveness
- Status: NOT STARTED (recurring issue)

### P2 - Refactor server.py
- Status: IN PROGRESS

### P2 - Technical Indicators for VIP Crypto Charts
- Status: NOT STARTED

## Backlog
- (P3) reCAPTCHA on auth forms
- (P3) Split translations.ts by feature
- (P3) Localize notification template strings

## Key API Endpoints
- POST /api/auth/login -> {access_token, user} (includes founding_member field)
- GET /api/auth/me -> UserResponse (includes founding_member field)
- POST /api/vip/checkout -> creates Stripe session, sets founding_member on payment
- POST /api/webhook/stripe -> handles payment confirmation, sets founding_member badge
- GET /api/spots-remaining -> counts only Stripe-confirmed paid members
- GET /api/crypto/prices -> cached prices (zero user calls)
- GET /api/crypto/chart/{coin_id}?days={1,7,30,90,365} -> read-only from cache
- GET /api/crypto/rainbow -> read-only from cache
