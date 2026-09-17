# Mentova Academy - PRD

## Architecture
- Static site: /app/static-site/ -> Netlify (mentova-academy.com)
- App: React Native Expo -> Netlify (app.mentova-academy.com)
- Backend: FastAPI -> Render (mentova-api.onrender.com)
- DB: MongoDB Atlas

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

### Atlas UI/UX Redesign (Feb 2026)
- Premium minimal header with "Atlas" + subtitle
- VIP upgrade button for FREE users (hidden for VIP)
- VIP upgrade modal with 5 features + $21.99/mo pricing + Stripe
- "Atlas réfléchit..." thinking animation (3 dots + pulsation, FR/EN/ES)
- FadeIn animation for all messages
- Redesigned welcome state with greeting + suggestion cards
- Premium floating input bar (rounded, with image upload for VIP)
- Modern AI-style messages
- **Typewriter streaming effect** — word-by-word display of latest Atlas response
- **Dark/Light theme support** — Atlas respects the existing theme toggle
- All text translated FR/EN/ES

### SEO & Marketing (Feb 2026)
- Editorial marketing homepage EN/FR/ES
- Legacy cleanup
- 34 total HTML pages, 34 sitemap URLs
- SEO Hub: comparatif-plateformes-apprentissage-crypto.html
- 3 Comparison pages: vs Binance Academy, vs Tutor AI, vs Learning Crypto
- Brand page: why-mentova.html
- 7 FR cluster pages (Guide débutant, Bitcoin, DeFi, Sécurité, Trading, Investissement, IA)
- 7 EN cluster pages (translations with English slugs)
- 7 ES cluster pages (translations with Spanish slugs)
- Full internal linking network
- hreflang tags on all translated pages
- Updated sitemap.xml with all URLs

## Pending
- User needs to "Save to Github" + deploy Netlify & Render

## Backlog
- P3: Monitor User Intelligence performance with large data sets
