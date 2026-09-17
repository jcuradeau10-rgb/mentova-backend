# Mentova Academy - PRD

## Architecture
- Static site: /app/static-site/ -> Netlify (mentova-academy.com)
- App: React Native Expo -> Netlify (app.mentova-academy.com)
- Backend: FastAPI -> Render (mentova-api.onrender.com)
- DB: MongoDB Atlas

## CRITICAL: Branding
- The AI mentor is named **Caufid** (not Atlas). All user-facing text says "Caufid".
- Internal API routes still use `/api/atlas/` for backward compatibility with existing data.
- MongoDB collections still named `atlas_conversations`, `atlas_memories` etc. for data compatibility.

## CRITICAL: GitHub Push
DO NOT use CLI `git push`. Always use "Save to Github" button in Emergent platform.

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!

## Completed
### Core Features
- VIP System (7 features including Early Access)
- Stripe Integration ($21.99/mo)
- Smart Upgrade & Protection
- User Intelligence System (inline in server.py)
- Conversation rename/delete
- Session & event tracking
- PDF Export for User Intelligence

### Caufid UI/UX (Feb 2026)
- Premium minimal header with "Caufid" + subtitle
- VIP upgrade button for FREE users (hidden for VIP)
- VIP upgrade modal with 5 features + $21.99/mo + Stripe
- "Caufid réfléchit..." thinking animation (FR/EN/ES)
- FadeIn + Typewriter streaming effect
- Dark/Light theme support
- All text translated FR/EN/ES

### Global Rebranding: Atlas → Caufid (Feb 2026)
- 654+ occurrences found across the project
- All replaced in: 15 frontend files, 6 backend files, 29 static HTML pages
- System prompt updated: "You are Caufid"
- Avatar changed: "A" → "C"
- SEO meta tags, structured data, FAQ schema all updated
- 3 languages (FR/EN/ES) fully updated
- Internal API routes preserved for data compatibility

### SEO & Marketing (Feb 2026)
- 34 total HTML pages, 34 sitemap URLs
- 3 Comparison pages (vs Binance Academy, vs Tutor AI, vs Learning Crypto)
- 7 FR + 7 EN + 7 ES cluster pages
- Full internal linking + hreflang tags

## Pending
- User needs to "Save to Github" + deploy Netlify & Render
- Quiz Gamification (badges & streaks)

## Backlog
- P2: Quiz Gamification with badges and streaks
- P3: Backend SSE streaming for true real-time responses
