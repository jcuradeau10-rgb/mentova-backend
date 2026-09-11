# Mentova - Professional Crypto Learning Platform

## Architecture
- **Frontend**: React Native (Expo) Web Export -> Netlify
- **Backend**: FastAPI -> Render  
- **Database**: MongoDB Atlas / localhost
- **AI**: OpenAI GPT-5.6 Terra (native SDK)
- **Payments**: Stripe Live ($21.99/month VIP)
- **Crypto Data**: CoinGecko Pro API

## VIP System — COMPLETE (Sept 11, 2026)

### Backend Services
- `services/vip_permissions.py` — Centralized FREE/VIP permissions (extensible PLANS dict)
- `services/atlas_protection.py` — Invisible rate limiting, anti-abuse, cost tracking (NO visible quotas)
- `services/stripe_service.py` — Full subscription lifecycle (checkout, portal, webhook)

### VIP Features (ALL Working)
1. **Atlas AI Premium** — VIP gets memory, personalization, 40-msg history, enhanced prompts
2. **Atlas Memory** — Persistent memories saved/loaded between conversations (VIP only)
3. **Chart Analysis** — Image upload in Atlas chat (VIP), analyzed via OpenAI Vision
4. **Daily Briefing** — AI-generated market summary (GPT-5.6 Terra, cached 4h, FR/EN/ES)
5. **Fear & Greed Index** — Real-time market sentiment
6. **Bitcoin Halving** — Countdown tracker
7. **Rainbow Chart** — BTC price zone visualization
8. **Price Alerts** — Custom crypto alerts
9. **Virtual Portfolio** — Investment simulation
10. **Professional Tools** — ETH Gas, Liquidations, BTC Dominance, etc.
11. **Premium Learning** — Advanced modules, adaptive quizzes

### Stripe Configuration
- Account: 51UEKux... (LIVE)
- Product: Mentova VIP (auto-created via API)
- Price: $21.99/month (price_1UEV6kAdwzWILqbUTTxVYjsQ)
- Webhook: POST /api/webhook/stripe

### Protection System (Invisible)
- No visible quotas, counters, or "X remaining" messages
- Rate limits: per-minute (6 FREE/12 VIP), per-hour (40/80), burst (4/10s)
- Anomaly detection: soft (150/500 daily) + hard (500/2000) thresholds
- Cost tracking: every request logged (tokens, cost, duration, plan)
- All configurable via admin API

### API Endpoints
- `GET /api/vip/permissions` — User permissions
- `POST /api/vip/checkout` — Stripe checkout
- `POST /api/vip/portal` — Subscription management
- `GET /api/vip/subscription` — Subscription details
- `GET /api/vip/daily-briefing?lang=fr` — AI daily briefing
- `POST /api/vip/ai/analyze` — Text analysis
- `POST /api/vip/ai/analyze-image` — Chart/image analysis (Vision)
- `GET /api/vip/tools/fear-greed` — Fear & Greed Index
- `GET /api/vip/tools/halving` — Halving countdown
- `GET /api/admin/vip-stats` — Subscriber analytics
- `GET /api/admin/atlas-usage` — Cost analytics
- `GET/PUT /api/admin/protection-config` — Protection thresholds

### Frontend Pages
- `/vip` — VIP sales page ($21.99, 8 features, Stripe checkout)
- `/vip/hub` — VIP Hub (briefing, F&G, halving, tools grid)
- `/vip/success` — Post-payment confirmation
- Profile: VIP badge + VIP Hub/Upgrade menu
- Home: VIP badge in header
- Atlas chat: Image upload button (VIP only)

### Navigation (5 tabs)
1. Atlas AI (first tab) → Chat, Modules, Progress
2. Home → Dashboard
3. Market → Crypto prices
4. News → Articles
5. Profile → Settings, VIP, Support

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!
- Stripe SK: backend/.env
- OpenAI: backend/.env

## Backlog
### P0
- Configure Stripe webhook in dashboard + STRIPE_WEBHOOK_SECRET in Render

### P1
- Deploy updated backend to Render (openai SDK changes)
- CoinGecko API key renewal (401 errors)

### P2
- Community forum with VIP badges
- Referral/affiliate system
- Push notifications

### P3
- Technical indicators (RSI, Bollinger)
- reCAPTCHA on auth forms
- Refactor server.py (12k lines → modular routers)
