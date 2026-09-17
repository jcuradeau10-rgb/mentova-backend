# Mentova Academy - PRD

## Architecture
- Static site: /app/static-site/ -> Netlify (mentova-academy.com) Site ID: fad387b8-7645-4df4-b88c-8d272aa439ca
- App: React Native Expo -> Netlify (app.mentova-academy.com) Site ID: a1331882-5ffb-439e-b1aa-a6cab3893378
- Backend: FastAPI -> Render (mentova-api.onrender.com)
- DB: MongoDB Atlas

## CRITICAL: User Intelligence Routes
Routes are now INLINE in server.py (not in a separate file) to ensure Render deployment works.

## CRITICAL: GitHub Push
DO NOT use CLI `git push`. Repository has branch protection rules.
Always instruct user to use "Save to Github" button in Emergent platform chat.

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!
- Netlify Token: nfp_et6ZSodb7Wj2mHSGNY4JrRnvrEYFxJVR3b9e

## Completed
- VIP System (7 features including Early Access)
- Stripe Integration ($21.99/mo)
- Smart Upgrade & Protection
- UI/UX ChatGPT-style rebuild
- User Intelligence System (inline in server.py)
- Conversation rename/delete
- New marketing homepage EN/FR/ES (editorial design)
- SEO: robots.txt, sitemap.xml, structured data
- Session & event tracking
- PDF Export for User Intelligence
- Legacy cleanup
- SEO Hub page + 10 total SEO pages with internal linking
- SEO Topical Authority - 7 cluster pages (Feb 2026)
- Updated sitemap.xml (18 URLs total)
- Updated footers on EN/FR/ES homepages with full SEO link structure
- **ATLAS UI/UX REDESIGN (Feb 2026)**:
  - Premium minimal header with "Atlas" + subtitle
  - VIP upgrade button for FREE users (hidden for VIP)
  - VIP upgrade modal with 5 features (Memory, Chart Analysis, Market Intelligence, Personalized Learning, Daily Briefing) + $21.99/mo pricing + Stripe integration
  - "Atlas réfléchit..." thinking animation (3 dots + pulsation, FR/EN/ES)
  - FadeIn animation for all messages
  - Redesigned welcome state with greeting + elegant suggestion cards
  - Premium floating input bar (rounded, with image upload for VIP)
  - Modern AI-style messages (more space, subtler colors)
  - All text translated FR/EN/ES
  - Degradation banner + upgrade prompt
  - Language picker preserved

## Pending
- User needs to "Save to Github" + Render Manual Deploy for User Intelligence time estimation fix
- User needs to deploy static-site to Netlify for new SEO pages
- User needs to deploy app to Netlify for Atlas redesign to go live

## Backlog
- P2: Create /mentova-vs-tutor-ai and /mentova-vs-learning-crypto comparative pages
- P2: Translate all 7 SEO cluster pages to EN and ES
- P2: Monitor User Intelligence performance with large data sets
