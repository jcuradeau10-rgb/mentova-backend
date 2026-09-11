# Mentova - Professional Crypto Learning Platform

## Architecture
- **Frontend**: React Native (Expo) Web Export -> Netlify (app.mentova-academy.com)
- **Static Site**: HTML/CSS -> Netlify (mentova-academy.com)
- **Backend**: FastAPI -> Render (mentova-api.onrender.com)
- **Database**: MongoDB Atlas (production) / localhost (preview)
- **AI**: OpenAI GPT-5.6 Terra (user's own API key)
- **Payments**: Stripe Live ($21.99/month VIP subscription)
- **Crypto Data**: CoinGecko Pro API (zero user-call architecture)

## Current State (Sept 11, 2026)

### VIP System — COMPLETE (Phase 1)

#### Backend Services
- `/services/vip_permissions.py` — Centralized FREE/VIP permission system
  - PLANS dict with feature flags (atlas_premium, atlas_memory, chart_analysis, etc.)
  - `get_user_plan()`, `get_permissions()`, `has_permission()` functions
  - Extensible: add new plans by adding to PLANS dict
  
- `/services/atlas_protection.py` — Invisible protection + cost tracking
  - NO visible quotas, NO message counters, NO "X remaining"
  - Rate limiting: per-minute, per-hour, burst detection, concurrent limits
  - Soft/hard daily thresholds for anomaly detection
  - Cost estimation per request (input/output tokens)
  - `atlas_usage_logs` collection for analytics
  - All thresholds configurable via CONFIG dict + admin API

- `/services/stripe_service.py` — Stripe subscription lifecycle
  - Product "Mentova VIP" + Price $21.99/month (auto-created)
  - Checkout session creation with customer management
  - Customer Portal for subscription management
  - Webhook handling: checkout.completed, subscription.created/updated/deleted, invoice.paid/failed
  - Idempotent event processing via stripe_events collection

#### API Endpoints (New)
- `GET /api/vip/permissions` — Centralized permissions for current user
- `POST /api/vip/checkout` — Create Stripe checkout session
- `POST /api/vip/portal` — Create Stripe customer portal session
- `GET /api/vip/subscription` — Detailed subscription info
- `GET /api/admin/vip-stats` — VIP subscriber statistics
- `GET /api/admin/atlas-usage` — Atlas cost/usage analytics (by_plan, daily, top_users)
- `GET /api/admin/protection-config` — View protection thresholds
- `PUT /api/admin/protection-config` — Update protection thresholds (super_admin only)

#### Atlas v3 Integration
- Chat endpoint now checks VIP permissions
- VIP: full memory context, 40 message history, save_memory tool, enhanced system prompt
- FREE: basic profile only, 10 message history, no memory persistence, clean system prompt
- Every request logged to atlas_usage_logs (tokens, cost, duration, plan)
- Invisible burst/rate protection (no counters shown)

#### Frontend
- `/app/vip/index.tsx` — New VIP page with:
  - Hero with Mentova VIP branding
  - "Why VIP?" explanation card
  - $21.99/month pricing with gold CTA
  - 8 feature cards (Atlas AI, Memory, Chart Analysis, Briefing, Crypto Data, News, Tools, Learning)
  - Stripe checkout integration
  - VIP active badge + subscription management portal link
  - Full FR/EN/ES translations

### Atlas-Centric 5-Tab Navigation (DONE)
- **Atlas AI** (1st tab) - Persistent AI mentor
- **Home** - Dashboard
- **Market** - Real-time prices
- **News** - Articles FR/EN/ES
- **Profile** - Settings (no VIP/Pro remnants)

### Stripe Configuration
- Account: 51UEKux... (NEW - live mode)
- Product: Mentova VIP (auto-created)
- Price: $21.99/month (price_1UEV6kAdwzWILqbUTTxVYjsQ)
- Webhook: POST /api/webhook/stripe (needs whsec_ configured on Stripe dashboard)

### Protection System Config (DEFAULT)
```
free_max_per_minute: 6, free_max_per_hour: 40, free_max_concurrent: 2
vip_max_per_minute: 12, vip_max_per_hour: 80, vip_max_concurrent: 4
burst_window: 10s, burst_max: 4
free_soft_daily: 150, free_hard_daily: 500
vip_soft_daily: 500, vip_hard_daily: 2000
cooldown: 30s
```

## Key Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!
- Stripe SK: In backend/.env (sk_live_51UEKux...)
- OpenAI API Key: In backend/.env
- Netlify Token: nfp_et6ZSodb7Wj2mHSGNY4JrRnvrEYFxJVR3b9e

## Backlog

### P0
- Configure Stripe webhook URL in Stripe Dashboard (https://mentova-api.onrender.com/api/webhook/stripe)
- Configure STRIPE_WEBHOOK_SECRET in Render env vars

### P1
- Chart analysis: image upload to Atlas for VIP users
- Daily briefing endpoint enhancement (personalized content)
- Profile page: show VIP badge and subscription info
- Home page: VIP status indicator

### P2
- Re-enable professional tools UI gated behind VIP
- Premium learning modules with VIP-only content
- Community forum with VIP badge

### P3
- Technical indicators (RSI, Bollinger) on charts
- reCAPTCHA on auth forms
- Refactor server.py into modular routers
