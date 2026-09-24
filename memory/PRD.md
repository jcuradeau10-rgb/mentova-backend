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
- Phase 1-5: Backend XP/levels/badges, Frontend ProgressView (8 sections), Detail Modals (4), Caufid AI integration, Micro-interactions (XP toast, badge celebration, level-up)

### Additional Features
- Certificats partageables (score >= 5 threshold)
- Streak notifications (toggle in Settings)
- Home page: Progression summary cards (Level, Streak, Badges) replacing crypto prices
- Sidebar conversation rename/delete: Fixed for mobile (restructured touch handling, overlay stacking)

## Key Endpoints
- POST /api/atlas/chat (with progression awareness)
- GET /api/atlas/progression/hub (celebrations + levels)
- GET /api/atlas/progression/xp-history, /badges
- POST /api/cron/streak-reminders

## Recent Fixes
- Conversation rename/delete: Removed nested TouchableOpacity causing mobile touch conflicts, moved overlay outside ScrollView to fix z-index stacking, added hitSlop for mobile touch targets
- Home page: Replaced BTC/ETH/USDT crypto price cards with dynamic progression summary (Level + XP bar, Streak, Badges count + progress bar), data from /api/atlas/progression/hub

## Known Limitations
- Certificate visual only visible when skill score >= 5
- learn.tsx is ~2200 lines (refactoring deferred)
- Notification labels (except streak_reminder) show raw i18n keys — pre-existing
