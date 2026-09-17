# Mentova Academy - PRD

## Architecture
- Static site: /app/static-site/ -> Netlify (mentova-academy.com) Site ID: fad387b8-7645-4df4-b88c-8d272aa439ca
- App: React Native Expo -> Netlify (app.mentova-academy.com) Site ID: a1331882-5ffb-439e-b1aa-a6cab3893378
- Backend: FastAPI -> Render (mentova-api.onrender.com)
- DB: MongoDB Atlas

## CRITICAL: User Intelligence Routes
Routes are now INLINE in server.py (not in a separate file) to ensure Render deployment works.
The intel_router is defined and included with prefix="/api" at the end of server.py.
Previous issue: separate file user_intelligence.py was not loading on Render.

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
- Legacy cleanup (removed App Store mentions, old pricing, obsolete pages)
- SEO Hub page: comparatif-plateformes-apprentissage-crypto.html
- SEO Comparison: mentova-vs-binance-academy.html
- SEO Brand: why-mentova.html
- SEO Topical Authority - 7 cluster pages (Feb 2026):
  - guide-debutant-cryptomonnaie.html (Guide debutant)
  - apprendre-bitcoin-blockchain.html (Bitcoin & Blockchain)
  - apprendre-defi-finance-decentralisee.html (DeFi)
  - securite-crypto-guide.html (Securite crypto)
  - apprendre-trading-crypto.html (Trading)
  - investissement-crypto-debutant.html (Investissement)
  - intelligence-artificielle-crypto-education.html (IA & Crypto)
- Updated sitemap.xml (18 URLs total)
- Internal linking network across all SEO pages
- Updated footers on EN/FR/ES homepages with full SEO link structure

## Pending
- User needs to "Save to Github" + Render Manual Deploy for User Intelligence time estimation fix
- User needs to deploy static-site to Netlify for new SEO pages to go live

## Backlog
- P2: Create /mentova-vs-tutor-ai and /mentova-vs-learning-crypto comparative pages
- P2: Monitor User Intelligence performance with large data sets
- P2: Better app screenshots for marketing site

## SEO Page Structure
```
Hub: comparatif-plateformes-apprentissage-crypto.html
  |-- mentova-vs-binance-academy.html
  |-- guide-debutant-cryptomonnaie.html
  |    |-- apprendre-bitcoin-blockchain.html
  |    |-- securite-crypto-guide.html
  |    |-- apprendre-defi-finance-decentralisee.html
  |    |-- apprendre-trading-crypto.html
  |    |-- investissement-crypto-debutant.html
  |-- intelligence-artificielle-crypto-education.html
  |-- why-mentova.html
```
