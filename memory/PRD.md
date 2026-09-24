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

### Progression Hub (All Phases Complete)
- **Phase 1 (Backend)**: XP awards, 9 levels, 32 badges (7 categories), daily goals, skill tracking
- **Phase 2 (Frontend)**: ProgressView with 8 sections (Hero, Stats, Priority, Goals, Skills, Badges, Modules, Quiz)
- **Phase 3 (Detail Modals)**: Badge Detail, XP History, Skill Detail, Levels Roadmap modals
- **Phase 4 (Caufid Integration)**: AI progression awareness, get_progression_data tool, CTA button
- **Phase 5 (Micro-interactions)**: XP Toast, Badge Celebration, Level-Up animation, celebration chaining

### Additional Features (Complete)
- **Certificats partageables**: CertificateModal with premium card design (MENTOVA ACADEMY branding, skill icon, score bar, user name, level, date). Share button with web clipboard fallback. Appears in SkillDetailModal when score >= 5. (DONE)
- **Streak notifications**: "Daily streak reminder" toggle added to Settings > Notifications modal (flame icon, top position). Backend cron /api/cron/streak-reminders respects streak_reminder preference. Trilingual (FR/EN/ES). (DONE)

## Key Endpoints
- POST /api/atlas/chat (with progression awareness)
- GET /api/atlas/progression/hub (includes celebrations + levels)
- GET /api/atlas/progression/xp-history, /badges
- POST /api/atlas/progression/migrate
- POST /api/cron/streak-reminders (requires CRON_SECRET)

## Known Limitations
- Certificate visual only visible when skill score >= 5 (no test account has this yet)
- Celebrations only show once per device (no ack system — Phase 5+ improvement)
- learn.tsx is ~2190 lines (refactoring deferred per user request)
- Notification labels (except streak_reminder) show raw i18n keys — pre-existing issue
