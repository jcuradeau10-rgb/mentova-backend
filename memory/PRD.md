# Mentova - Professional Crypto Learning Platform

## Architecture
- **Frontend**: React Native (Expo) Web Export -> Netlify (app.mentova-academy.com)
- **Static Site**: HTML/CSS -> Netlify (mentova-academy.com)
- **Backend**: FastAPI -> Render (mentova-api.onrender.com)
- **Database**: MongoDB Atlas
- **Payments**: Stripe Checkout (DISABLED for free launch)
- **Crypto Data**: CoinGecko Pro API (zero user-call architecture)
- **AI**: OpenAI GPT-4o via Emergent LLM Key

## Current State (Sept 10, 2026)

### Simplified 5-Tab Navigation (DONE)
- **Home** - Dashboard with market stats, quick actions, news preview, learning progress
- **Atlas AI** - Mentor IA (killer feature)
- **Market** - Real-time crypto prices
- **News** - Translated articles FR/EN/ES
- **Profile** - Account settings

### Hidden Features (code kept, not visible)
- Community (gate + founding members)
- Mentors / Marketplace
- VIP/Premium features
- Floating action menu (FAB)

### Active Features
- CoinGecko zero-user-call caching (scheduler pre-fetches)
- PWA install prompt
- i18n FR/EN/ES
- Founding Member badge system (Stripe webhook, currently disabled in UI)

### Deployments
- mentova-academy.com: LIVE (Netlify, editorial redesign deployed Sept 10)
- app.mentova-academy.com: LIVE (Netlify, cleaned-up 5-tab app deployed Sept 10)
- mentova-api.onrender.com: 502 - Needs Render rebuild/redeploy

### What Was Done This Session (Sept 10)
1. Cleaned Home dashboard: removed Community, AI tab, VIP promo, Mentor CTA links
2. Updated menu grid to only show Atlas, Market, News, Profile (+Admin)
3. Updated Quick Actions to reference only active tabs
4. Cleaned _layout.tsx: removed dead AnimatedTabIcon + FloatingMenu code
5. Updated onboarding page feature carousel: Community -> Crypto News
6. Updated translations (FR/EN/ES) for onboarding features
7. Deployed static site to mentova-academy.com
8. Built + deployed React app to app.mentova-academy.com

### Known Issues
- Render backend 502: User needs to trigger a deploy on Render dashboard or push code via GitHub
- CoinGecko API: Returning 401 (key may need renewal)
- Desktop responsiveness: Not addressed yet (P2)

## Key Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!
- Stripe webhook: https://mentova-api.onrender.com/api/webhook/stripe
- EAS config: eas.json with EXPO_PUBLIC_BACKEND_URL
- Netlify sites: mentova-academy.com + app.mentova-academy.com

## Backlog
### P0
- Fix Render backend (user needs to redeploy)

### P1
- Fix CoinGecko API key (401 errors)
- Desktop responsiveness

### P2
- Re-enable Stripe Payments / VIP features
- Re-enable Community Forum + Founding Member gate

### P3
- Technical indicators (RSI, Bollinger) on crypto charts
- reCAPTCHA on auth forms
- Refactor server.py monolith into routes/
