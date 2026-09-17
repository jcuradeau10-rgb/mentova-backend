# Mentova Academy - PRD

## Architecture
- Static site: /app/static-site/ -> Netlify
- App: React Native Expo -> Netlify  
- Backend: FastAPI -> Render
- DB: MongoDB Atlas

## CRITICAL: Branding
- The AI mentor is named **Caufid** (not Atlas)
- Internal API routes use `/api/atlas/` for backward compatibility

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!
- GA4 ID: G-2GLPG3JB9N

## Completed
- VIP System + Stripe ($21.99/mo)
- User Intelligence + PDF Export
- Session tracking
- Caufid UI/UX Redesign (premium, themed, streaming)
- Global rebranding Atlas -> Caufid (654+ occurrences)
- VIP modal with direct Stripe checkout
- Quiz Gamification: 11 badges + daily streaks + progress tracking
- Badge Celebration: animated popup when new badge unlocked after Caufid response
- GA4 tracking on all 44 static pages
- SEO: 44 pages (FR/EN/ES), sitemap, hreflang
- SEO Comparative Pages: Full trilingual set (FR/EN/ES) for:
  - Mentova vs Binance Academy
  - Mentova vs Tutor AI
  - Mentova vs Learning Crypto Solo
  - Why Mentova
  - Hub/Comparisons page
- Footer localization: EN footer -> EN pages, ES footer -> ES pages, FR footer -> FR pages
- hreflang cross-references on all comparative pages (FR<->EN<->ES)
- Sitemap updated with all 44 pages

## Pending
- Deploy: User must use "Save to Github" + Netlify deploy for static site + Render redeploy for Stripe fix
- (P2) Monitor User Intelligence performance limits with large data sets

## Static Site Structure
- Root `/app/static-site/` = EN pages (index.html) + FR cluster pages + EN/ES cluster pages
- `/app/static-site/fr/` = FR landing pages
- `/app/static-site/es/` = ES landing pages
- Comparative pages use language suffix: `-en.html`, `-es.html` (no suffix = FR)
