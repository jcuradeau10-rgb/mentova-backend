# Mentova Academy - PRD

## Architecture
- Static site: /app/static-site/ -> Netlify
- App: React Native Expo -> Netlify  
- Backend: FastAPI -> Render (mentova-api.onrender.com)
- DB: MongoDB Atlas
- Email: Brevo (Sendinblue)

## CRITICAL: Branding
- The AI mentor is named **Caufid** (not Atlas)
- Internal API routes use `/api/atlas/` for backward compatibility

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!
- GA4 ID: G-2GLPG3JB9N
- Render API: rnd_tt0MtvbUwt2bTkegTx3avjcPr5ig
- Render Service: srv-d8q2q09kh4rs73c2iclg
- Netlify Token: nfp_fJr6EaQJJh7Y5XZbgTbhD429HaHDyTES7965

## Completed
- VIP System + Stripe ($21.99/mo) with full checkout/cancel/refund/webhook flow
- User Intelligence + PDF Export
- Session tracking
- Caufid UI/UX Redesign (premium, themed, streaming)
- Global rebranding Atlas -> Caufid
- Quiz Gamification: 11 badges + daily streaks
- GA4 tracking on all 44 static pages
- SEO: 44 pages (FR/EN/ES), sitemap, hreflang
- Email migration: Resend -> Brevo
- Stripe Webhook configured (refund/dispute -> immediate VIP revocation)
- Registration Security: Password 8+ chars + 1 special, email verification (6-digit code), language selection
- Deep Health Check: /api/health/deep monitors MongoDB, AI, Stripe, Brevo, env vars
- Auto-Alert System: 5-min background monitor, Brevo + Telegram dual-channel alerts
- Full Site Audit: 60+ static pages, removed legacy text, updated legal pages
- Account Deletion, Feedback Tab, VIP Welcome Email, Push Notifications, Touch Bug Fix

### Progression Hub (Complete)
- **Phase 1 (Backend)**: progression_service.py with XP awards, 9 levels, 32 badges (7 categories), daily goals, weekly challenges, skill tracking. Routes at /api/atlas/progression/hub, /xp-history, /badges, /migrate. (DONE)
- **Phase 2 (Frontend)**: Complete ProgressView rewrite with 8 sections: Hero (Level/XP bar animated), Quick Stats (Streak/Badges/Modules), Priority Card (interactive), Daily Goals, Skills (5 bars), Badge Gallery (32 badges, 7 categories), Modules Overview, Quiz Stats. All real API data, trilingual. (DONE - 100% tested)
- **Phase 3 (Detail Modals)**: 4 interactive modals added:
  - **Badge Detail Modal**: Tap any badge → shows icon, name, category, earned/locked status, progress bar with current/threshold, metric description
  - **XP History Modal**: Tap XP bar → scrollable list of XP transactions from API with icons, descriptions, dates, amounts
  - **Skill Detail Modal**: Tap a skill → score, level label (Expert/Intermediate/Beginner/Not evaluated), related modules, Caufid tip
  - **Levels Roadmap Modal**: Tap level circle → all 9 levels timeline (Curieux→Maitre) with XP thresholds, current level highlighted
  - Backend: Added `levels` array to hub response. (DONE - 100% tested, 13/13 backend + all frontend flows)

## Key Endpoints
- POST /api/auth/register, /verify-email, /resend-verification
- POST /api/vip/checkout, /cancel, /reactivate
- POST /api/webhook/stripe
- GET /api/atlas/progression/hub (Level, XP, Badges, Skills, Goals, Priority, Levels)
- GET /api/atlas/progression/xp-history
- GET /api/atlas/progression/badges
- POST /api/atlas/progression/migrate

## Upcoming Tasks
- **Phase 4 (P1)**: Deep Caufid Integration — AI explains progression score, recommends/creates modules based on weaknesses
- **Phase 5 (P2)**: Micro-interactions — XP gain popup, Badge unlock animations, level-up celebration
- **Refactoring (P2)**: Extract ProgressView + modals into /components/progression/ folder (learn.tsx is 1915 lines)
