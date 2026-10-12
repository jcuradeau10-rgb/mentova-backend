# Mentova Academy - PRD

## Architecture
- Static site: /app/static-site/ -> Netlify
- App: React Native Expo -> Netlify  
- Backend: FastAPI -> Render
- DB: MongoDB Atlas

## CRITICAL: Branding
- AI mentor = **Caufid** (not Atlas). Routes use `/api/atlas/` for backward compat.

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!

### Progression Hub (All Phases Complete)
- Phase 1-5: Backend XP/levels/badges, Frontend ProgressView (8 sections), Detail Modals (4), Caufid AI integration, Micro-interactions

### Additional Features (Complete)
- Certificats partageables, Streak notifications toggle
- Home page: Progression summary cards replacing crypto prices
- Sidebar conversation rename/delete: Fixed for mobile
- Progression System Page: Premium static page (FR/EN/ES) with SEO
- Auto-refresh Home progression: AppState listener
- Google Ads: Base tag + email-verification conversion event

### Admin Email System (Complete - Oct 2026)
- 3 reusable templates: Réengagement Caufid, Guide de bienvenue, Mise à jour progression
- Template + language (FR/EN/ES) selection modal in admin panel
- Backend: POST /api/admin/users/{user_id}/send-caufid-email
- Email service: /app/backend/services/email_service.py (Brevo API)

### Email Analytics, Bulk Send & Preview (NEW - Oct 2026)
- **Email Analytics**: MongoDB `email_logs` collection, GET /api/admin/email-logs endpoint
  - Dedicated "Emails" tab in admin panel with stats (total, today, failures) + full history log
  - Every email sent via admin is automatically logged with user, template, lang, status, timestamp
- **Bulk Email Send**: POST /api/admin/bulk-email/count and /api/admin/bulk-email/send
  - 4 filters: Inactive 7+ days, Inactive 30+ days, New users (48h), All users
  - Modal shows matching user count before send, with confirmation
  - 0.3s rate limit between sends to avoid Brevo throttling
- **Email Preview**: GET /api/admin/email-preview?template=X&lang=Y
  - Returns HTML preview of any template in any language
  - Preview button in both single-user and bulk email modals
  - Web-only HTML rendering with dangerouslySetInnerHTML

## Key Endpoints
- POST /api/atlas/chat, GET /api/atlas/progression/hub, /xp-history, /badges
- POST /api/cron/streak-reminders
- POST /api/admin/users/{user_id}/send-caufid-email
- GET /api/admin/email-logs
- GET /api/admin/email-preview
- POST /api/admin/bulk-email/count
- POST /api/admin/bulk-email/send

## Key Files
- /app/backend/services/email_service.py - Email templates and delivery
- /app/backend/routes/admin.py - Admin endpoints (email send, logs, preview, bulk)
- /app/frontend/app/admin.tsx - Admin panel with email tab, modals
- /app/frontend/utils/api.ts - API client

## Known Limitations
- Certificate visual only visible when skill score >= 5
- learn.tsx is ~2200 lines (refactoring deferred)
- Static site pages deployed via Netlify (not previewable in Expo dev server)
- Brevo email sending requires whitelisted IP (works on Render production, not preview)
- Email preview uses dangerouslySetInnerHTML (web only)
- Earlier emails (before analytics feature) are not in the log
