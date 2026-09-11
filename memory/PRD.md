# Mentova - Professional Crypto Learning Platform

## Architecture
- **Frontend**: React Native (Expo) Web → Netlify
- **Backend**: FastAPI → Render
- **Database**: MongoDB Atlas / localhost
- **AI**: OpenAI GPT-5.6 Terra (native SDK)
- **Payments**: Stripe Live ($21.99/month)

## UI Architecture — ChatGPT/Claude Style (Sept 11, 2026)

### Layout: Sidebar + Main Canvas
- **No more bottom tabs** — replaced with collapsible left sidebar
- **Sidebar**: Mentova logo, New Chat, Atlas AI, Home, Market, News, Profile, VIP Hub, User avatar
- **Main Canvas**: Atlas chat by default (like ChatGPT)
- **Collapsed**: 56px (icons only) / **Expanded**: 240px (icons + labels)

### Pages Redesigned
- **Onboarding** (`/`): Clean, Atlas-centric intro with "Learn crypto with Atlas AI", 4 feature pills, Get Started / I have an account CTAs
- **Login** (`/login`): Glassmorphism style, "Welcome back", icon inputs, violet accent
- **Register** (`/register`): Same style, "Create account", 4 fields
- **Main App** (`/(tabs)/_layout.tsx`): Custom sidebar as tabBar

### Design System
- Background: #06060F / #0A0A1A
- Surface: #120E26
- Primary: #7C3AED (violet)
- VIP Gold: #FFD700
- Text: #F8FAFC / #94A3B8 / #64748B

## VIP System — 6 Features
1. Memory — Atlas persistent memory for VIP users
2. Chart Analysis — Image upload in Atlas chat
3. Market Intelligence — News + market data in Atlas context
4. Personalized Learning — Adaptive education
5. Daily Briefing — AI-generated market summary
6. Advanced Tools — Rainbow, Halving, alerts, portfolio

### NOT Included
- ❌ Fear & Greed (removed everywhere including AI prompts)
- ❌ Voice/vocal
- ❌ Visible message counters

### Smart Upgrade Prompt
- Invisible trigger for FREE users after sustained usage
- Non-blocking, dismissible, 24h cooldown

### Stripe: $21.99/month
- Product: Mentova VIP (auto-created)
- Price: price_1UEV6kAdwzWILqbUTTxVYjsQ

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!

## Backlog
### P0
- Configure Stripe webhook + STRIPE_WEBHOOK_SECRET in Render
- Deploy to Render

### P1
- Personalized daily briefing (based on user interests)
- CoinGecko API key renewal

### P2
- Community forum
- Referral system

### P3
- Technical indicators
- reCAPTCHA
