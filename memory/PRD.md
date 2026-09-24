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
- User Intelligence + PDF Export, Session tracking
- Caufid UI/UX Redesign (premium, themed, streaming)
- Global rebranding Atlas -> Caufid
- Quiz Gamification: 11 badges + daily streaks
- GA4 tracking + SEO: 44 pages (FR/EN/ES), sitemap, hreflang
- Email migration: Resend -> Brevo
- Stripe Webhook (refund/dispute -> VIP revocation)
- Registration Security, Account Deletion, Feedback Tab, VIP Welcome Email, Push Notifications
- Deep Health Check + Auto-Alert System (Brevo + Telegram)
- Full Site Audit: 60+ pages cleaned

### Progression Hub (Phases 1-4 Complete)
- **Phase 1 (Backend)**: progression_service.py — XP awards, 9 levels, 32 badges (7 categories), daily goals, skill tracking. Endpoints: /hub, /xp-history, /badges, /migrate. (DONE)
- **Phase 2 (Frontend)**: Complete ProgressView with 8 sections: Hero, Quick Stats, Priority Card, Daily Goals, Skills, Badge Gallery, Modules Overview, Quiz Stats. Trilingual. (DONE)
- **Phase 3 (Detail Modals)**: 4 interactive modals: Badge Detail, XP History, Skill Detail, Levels Roadmap. All clickable elements. (DONE)
- **Phase 4 (Caufid Integration)**: 
  - New AI tool `get_progression_data` giving Caufid full access to progression metrics
  - Automatic progression summary injection in chat context (Level, XP, streak, skills, modules, quizzes)
  - System prompt updated with sections 111-115 for progression awareness (analyze strengths/weaknesses, recommend modules, celebrate achievements)
  - Frontend CTA "Analyze my progress" button in Progression Hub → auto-sends analysis request to Caufid
  - Caufid now provides detailed personalized analysis with strengths, weaknesses, module priorities, and learning plans based on real data (DONE - 100% tested)

## Key Endpoints
- POST /api/auth/register, /verify-email, /resend-verification
- POST /api/vip/checkout, /cancel, /reactivate
- POST /api/webhook/stripe
- POST /api/atlas/chat (with progression awareness)
- GET /api/atlas/progression/hub, /xp-history, /badges
- POST /api/atlas/progression/migrate

## Upcoming Tasks
- **Phase 5 (P2)**: Micro-interactions — XP gain popup, Badge unlock animations, level-up celebration
- **Refactoring (P2)**: Extract ProgressView + modals into /components/progression/ folder (learn.tsx ~1950 lines)
