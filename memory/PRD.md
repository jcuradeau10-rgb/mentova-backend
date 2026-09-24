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
- **Registration Security**: Password 8+ chars + 1 special, email verification (6-digit code), language selection
- **Deep Health Check**: `/api/health/deep` monitors MongoDB, AI, Stripe, Brevo, env vars
- **Auto-Alert System**: 5-min background monitor, Brevo + Telegram dual-channel alerts
- **Full Site Audit**: 60+ static pages, removed legacy text, updated legal pages
- **Account Deletion**: Full cascade delete + confirmation email
- **Feedback Tab**: 5-star rating + categories
- **VIP Welcome Email**: Sent on checkout + webhook fallback
- **Push Notifications**: Framework + cron for streak reminders
- **Touch Bug Fix**: z-index/propagation fix on conversation rename/delete

### Progression Hub
- **Phase 1 (Backend)**: Created `progression_service.py` with XP awards, 9 levels, 32 badges (7 categories), daily goals, weekly challenges, skill tracking. Created `routes/progression.py` with `/api/atlas/progression/hub` endpoint. Idempotent XP awards, auto-migration for existing users. (DONE)
- **Phase 2 (Frontend)**: Complete rewrite of `ProgressView` component in `learn.tsx`. Premium dark-themed Progression Hub displaying:
  - Hero section: Level number + name + XP bar (animated) + streak pill
  - Quick Stats: 3 cards (Streak, Badges earned/total, Modules completed/total)
  - Priority Card: Context-aware "next step" recommendation (resume module / start learning / strengthen skill) with interactive navigation to Chat tab
  - Daily Goals: 3 daily objectives with progress bars and XP rewards
  - Skills: 5 skill bars (Finance, Crypto, Blockchain, Trading, Risk Management) with color-coded progress
  - Badge Gallery: 32 badges grouped by 7 categories with earned/locked visual states and progress bars
  - Modules Overview: 4 stat counters + recent modules list with status dots
  - Quiz Stats: Quiz count, avg score, perfect scores, days active
  - All data from real API (no mocked data). Trilingual (FR/EN/ES). (DONE - Tested 100%)

## Key Endpoints
- `POST /api/auth/register` — password validation + email verification + language
- `POST /api/auth/verify-email` — verify 6-digit code
- `POST /api/auth/resend-verification` — resend verification code
- `POST /api/vip/checkout` — Stripe checkout
- `POST /api/vip/cancel` — Cancel at period end
- `POST /api/vip/reactivate` — Undo cancellation
- `POST /api/webhook/stripe` — Handles all Stripe events
- `GET /api/atlas/progression/hub` — Progression Hub (Level, XP, Badges, Skills, Goals, Priority)
- `GET /api/atlas/progression/xp-history` — XP transaction history
- `GET /api/atlas/progression/badges` — All badges with progress
- `POST /api/atlas/progression/migrate` — Manual user migration

## Upcoming Tasks
- **Phase 3 (P1)**: Detailed views — Modals/Pages for Badges, Skills Tree, Full Learning Path, History, Certificates
- **Phase 4 (P1)**: Deep Caufid Integration — AI explains progression score, recommends/creates modules based on weaknesses
- **Phase 5 (P2)**: Micro-interactions — XP gain popup, Badge unlock animations, level-up celebration
