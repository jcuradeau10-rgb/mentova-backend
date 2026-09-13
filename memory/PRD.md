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
- New marketing homepage EN/FR/ES
- SEO: robots.txt, sitemap.xml, structured data
- Session & event tracking

## Pending
- User needs to "Save to Github" + Render Manual Deploy for intelligence to work on production
- Website design improvement (less template-like, more human)
- 5 strategic SEO pages
- Better app screenshots for marketing site
- Legacy content cleanup
