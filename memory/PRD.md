# Mentova Academy - PRD

## Architecture
- Static site: /app/static-site/ -> Netlify
- App: React Native Expo -> Netlify  
- Backend: FastAPI -> Render (mentova-api.onrender.com)
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
- Global rebranding Atlas -> Caufid
- VIP modal with direct Stripe checkout
- Quiz Gamification: 11 badges + daily streaks + progress tracking
- Badge Celebration: animated popup
- GA4 tracking on all 44 static pages
- SEO: 44 pages (FR/EN/ES), sitemap, hreflang
- SEO Comparative Pages: Full trilingual set
- Footer localization: EN/ES/FR footers point to correct language pages
- **Stripe VIP Flow (Complete)**:
  - Checkout creates session + saves payment_transactions
  - Status endpoint fallback to direct Stripe API (no "Transaction not found")
  - Success page: shows all 6 VIP features with checkmarks (FR/EN/ES), auto-redirects to app
  - Cancel subscription: keeps VIP until end of billing period (`POST /api/vip/cancel`)
  - Reactivate subscription: undo cancellation (`POST /api/vip/reactivate`)
  - Refund webhook: immediately revokes VIP on `charge.refunded`
  - Dispute/chargeback webhook: immediately revokes VIP + cancels subscription on `charge.dispute.created`
  - Admin endpoints: activate/deactivate VIP manually
  - VIP page shows canceling state with option to reactivate

## Pending
- (P2) Monitor User Intelligence performance limits with large data sets
- Configure Stripe Webhook URL in Stripe Dashboard for production events

## Key Endpoints
- `POST /api/vip/checkout` — Creates Stripe session + saves payment_transactions
- `GET /api/vip/checkout/status/{session_id}` — Verifies payment via direct Stripe API
- `POST /api/vip/cancel` — Cancel at period end
- `POST /api/vip/reactivate` — Undo cancellation
- `POST /api/vip/portal` — Stripe Customer Portal
- `POST /api/admin/activate-vip/{user_id}` — Manual VIP activation
- `POST /api/admin/deactivate-vip/{user_id}` — Manual VIP deactivation
- `POST /api/webhook/stripe` — Handles checkout, subscription, refund, dispute events
