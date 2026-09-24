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

### Progression Hub (Phases 1-5 Complete)
- **Phase 1 (Backend)**: XP awards, 9 levels, 32 badges (7 categories), daily goals, skill tracking
- **Phase 2 (Frontend)**: ProgressView with 8 sections (Hero, Stats, Priority, Goals, Skills, Badges, Modules, Quiz)
- **Phase 3 (Detail Modals)**: Badge Detail, XP History, Skill Detail, Levels Roadmap modals
- **Phase 4 (Caufid Integration)**: AI progression awareness, get_progression_data tool, CTA button
- **Phase 5 (Micro-interactions)**: 
  - XP Toast: Animated "+X XP" floating popup when XP is gained
  - Badge Celebration: Full modal with icon, name, confetti when badge unlocked (uses existing BadgeCelebration component)
  - Level-Up Celebration: Full-screen animation with pulsing rings, level number, and name
  - Backend: `_get_celebrations()` compares `_prog_seen` state with current metrics to detect XP gains, new badges, and level-ups
  - Celebration chaining: XP toast → Level up → Badge unlock (sequential display)
  - All celebrations fire when user visits Progress tab and state has changed (DONE)

## Key Endpoints
- POST /api/atlas/chat (with progression awareness)
- GET /api/atlas/progression/hub (includes celebrations array)
- GET /api/atlas/progression/xp-history, /badges
- POST /api/atlas/progression/migrate

## Upcoming Tasks
- **Refactoring (P2)**: Extract ProgressView + modals into /components/progression/ folder (learn.tsx ~2090 lines)
- **Certificats partageables (P2)**: Shareable achievement cards for mastered skills
- **Streak notifications (P2)**: Daily push reminders to maintain streak
