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
- **Registration Security**:
  - Password: 8+ chars + 1 special character (validated backend + frontend)
  - Email verification: 6-digit code sent via Brevo, must verify before login
  - Language selection at registration (FR/EN/ES) 
  - Verify-email screen with resend option
  - Login blocks unverified emails (returns `email_not_verified`)

- **Deep Health Check**: `/api/health/deep` monitors MongoDB, AI (Emergent LLM), Stripe, Brevo, and env vars. Fixed false-positive 401 by using `TransactionalEmailsApi.get_smtp_report()` instead of `AccountApi.get_account()`.
- **Auto-Alert System**: Background monitor runs every 5 min. Sends DOWN/RECOVERY alerts via **dual channel: Brevo email (jcuradeau.7@hotmail.com) + Telegram (@MentovaAlerts_bot)**. Anti-spam: only alerts on state transitions. History in MongoDB. Endpoints: `GET /api/health/alerts/history`, `POST /api/health/alerts/test`. Telegram acts as backup if Brevo is down.
- **Full Site Audit (Sept 2026)**: Complete audit of 60+ static pages + frontend app. Removed all Atlas references, marketplace descriptions, Apple App Store mentions, old pricing, French words in English text. Updated legal pages (Terms, Support, Privacy) in FR/EN/ES. Fixed ES homepage with proper Spanish translations. Renamed CSS class t-atlas to t-caufid. Updated all "February 2026" dates. Aligned all 3 languages to same product positioning: Mentova = personalized finance & crypto education with Caufid AI mentor.
- **Account Deletion**: Full backend cascade delete + confirmation email
- **Feedback Tab**: Modernized with 5-star rating, categories (bug/feature/general)
- **VIP Welcome Email**: Sent on checkout success + webhook fallback
- **Push Notifications**: Framework + cron for streak reminders
- **Touch Bug Fix**: z-index/propagation fix on conversation rename/delete

## Key Endpoints
- `POST /api/auth/register` — password validation + email verification + language
- `POST /api/auth/verify-email` — verify 6-digit code
- `POST /api/auth/resend-verification` — resend verification code
- `POST /api/vip/checkout` — Stripe checkout
- `POST /api/vip/cancel` — Cancel at period end
- `POST /api/vip/reactivate` — Undo cancellation
- `POST /api/webhook/stripe` — Handles all Stripe events
