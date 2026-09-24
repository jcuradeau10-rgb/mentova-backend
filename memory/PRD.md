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
- **Progression System Page** (NEW): Premium static page explaining Mentova's progression system
  - 3 languages: FR `/fr/systeme-de-progression.html`, EN `/progression-system.html`, ES `/es/sistema-de-progreso.html`
  - 14 sections: Hero, personalized path, Caufid learning, evolution, modules, visibility, pace, Caufid hub, concrete example, domains, evolution, FAQ (7 items), CTA
  - Footer links added to all 3 homepage footers (FR/EN/ES)
  - SEO: title, meta description, canonical, hreflang, JSON-LD, sitemap updated
  - Design: matches existing Mentova design system (dark theme, Space Grotesk, CSS variables)
  - No "Atlas" text, no financial advice claims, no fake stats
- **Auto-refresh Home progression** (NEW): Progression cards auto-refresh when app returns from background via AppState listener

## Key Endpoints
- POST /api/atlas/chat, GET /api/atlas/progression/hub, /xp-history, /badges
- POST /api/cron/streak-reminders

## Known Limitations
- Certificate visual only visible when skill score >= 5
- learn.tsx is ~2200 lines (refactoring deferred)
- Static site pages deployed via Netlify (not previewable in Expo dev server)
