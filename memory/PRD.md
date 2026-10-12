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
- **Progression System Page**: Premium static page explaining Mentova's progression system
  - 3 languages: FR `/fr/systeme-de-progression.html`, EN `/progression-system.html`, ES `/es/sistema-de-progreso.html`
  - 14 sections, SEO, footer links
- **Auto-refresh Home progression**: AppState listener
- **Google Ads**: Base tag + email-verification conversion event
- **Admin Email System** (NEW - Oct 2026): 
  - 3 reusable email templates sent from admin panel via User Intelligence:
    1. **Réengagement Caufid** (`caufid_reengagement`) - Invite inactive users to discover Caufid
    2. **Guide de bienvenue** (`welcome_guide`) - Mentova intro and first steps
    3. **Mise à jour progression** (`progression_update`) - Personalized progression summary with real XP/level data
  - Language selection: FR / EN / ES per email
  - Template + language modal in admin panel
  - Backend endpoint: POST /api/admin/users/{user_id}/send-caufid-email with {template, lang}
  - Email service: /app/backend/services/email_service.py (Brevo API)
  - Extensible: new templates can be added by creating function + adding to template list
  - All emails signed by Caufid, no financial advice claims

## Key Endpoints
- POST /api/atlas/chat, GET /api/atlas/progression/hub, /xp-history, /badges
- POST /api/cron/streak-reminders
- POST /api/admin/users/{user_id}/send-caufid-email

## Key Files
- /app/backend/services/email_service.py - Email templates and delivery
- /app/backend/routes/admin.py - Admin endpoints including email send
- /app/frontend/app/admin.tsx - Admin panel with email modal
- /app/frontend/utils/api.ts - API client including sendCaufidEmail

## Known Limitations
- Certificate visual only visible when skill score >= 5
- learn.tsx is ~2200 lines (refactoring deferred)
- Static site pages deployed via Netlify (not previewable in Expo dev server)
- Brevo email sending requires whitelisted IP (works on Render production, not preview)
