# Mentova - Professional Crypto Learning Platform

## Architecture
- **Frontend**: React Native (Expo) Web → Netlify
- **Backend**: FastAPI → Render
- **Database**: MongoDB Atlas / localhost
- **AI**: OpenAI GPT-5.6 Terra (native SDK)
- **Payments**: Stripe Live ($21.99/month)

## VIP System — FINAL (Sept 11, 2026)

### The 6 VIP Features
1. **Memory** — Atlas retains user preferences, level, goals between sessions
2. **Chart Analysis** — Image upload in Atlas chat for technical analysis
3. **Market Intelligence** — Atlas injects real-time news + prices into context
4. **Personalized Learning** — Adaptive education based on user profile
5. **Daily Briefing** — AI-generated market summary (GPT-5.6 Terra, cached 4h, FR/EN/ES)
6. **Advanced Tools** — Rainbow Chart, Halving countdown, alerts, virtual portfolio

### NOT Included (by specification)
- ❌ Fear & Greed (removed from all UI, API, and AI prompts)
- ❌ Voice/vocal features
- ❌ Visible message counters/quotas

### Smart Upgrade Prompt
- Backend tracks FREE user usage invisibly
- After 15+ lifetime + 8+ session requests, `upgrade_prompt: true` in chat response
- Frontend shows elegant VIP suggestion (dismissible, non-blocking)
- 24h cooldown between prompts
- VIP users never see it

### Protection System
- Invisible rate limiting (no counters, no quotas shown)
- Anti-abuse: burst detection, concurrent limits, anomaly thresholds
- Cost tracking: every request logged (tokens, cost, duration)
- All configurable via admin API

### Stripe
- Product: Mentova VIP (auto-created)
- Price: $21.99/month (price_1UEV6kAdwzWILqbUTTxVYjsQ)
- Full lifecycle: checkout, portal, webhooks (created/updated/deleted/paid/failed)
- Webhook URL: POST /api/webhook/stripe

### Frontend Pages
- `/vip` — Sales page (6 features, $21.99, Stripe checkout)
- `/vip/hub` — VIP Hub (briefing, 6 feature cards, Open Atlas CTA)
- `/vip/success` — Post-payment
- Profile: VIP badge + VIP Hub menu
- Home: VIP badge in header
- Atlas: Image upload (VIP), Smart Upgrade Prompt (FREE)

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!

## Backlog
### P0
- Configure Stripe webhook URL + STRIPE_WEBHOOK_SECRET in Render
- Deploy updated backend to Render

### P1
- CoinGecko API key renewal (401)
- PWA install prompt overlapping chat input

### P2
- Community forum
- Referral system

### P3
- Technical indicators (RSI, Bollinger)
- reCAPTCHA on auth forms
