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
- Render API: rnd_tt0MtvbUwt2bTkegTx3avjcPr5ig
- Render Service: srv-d8q2q09kh4rs73c2iclg
- Netlify Token: nfp_fJr6EaQJJh7Y5XZbgTbhD429HaHDyTES7965

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
- SEO Comparative Pages: Full trilingual set (FR/EN/ES)
- Footer localization: EN -> EN pages, ES -> ES pages, FR -> FR pages
- hreflang cross-references on all comparative pages (FR<->EN<->ES)
- **Stripe VIP Checkout Fix**: 
  - Fixed expired API key on Render
  - Fixed `stripe_service.py` Product.search fallback to Product.list
  - Fixed checkout to save `payment_transactions` record
  - Fixed status endpoint to fallback to direct Stripe session lookup (no more "Transaction not found")
  - Added admin endpoint `/api/admin/activate-vip/{user_id}` for manual VIP activation
  - Cancelled duplicate subscription, activated user VIP on production

## Pending
- (P2) Monitor User Intelligence performance limits with large data sets

## Key Endpoints
- `POST /api/vip/checkout` — Creates Stripe session + saves payment_transactions
- `GET /api/vip/checkout/status/{session_id}` — Verifies payment via direct Stripe API
- `POST /api/admin/activate-vip/{user_id}` — Super admin manual VIP activation
- `GET /api/atlas/gamification` — Badges and streaks
- `POST /api/atlas/chat` — Caufid conversation
