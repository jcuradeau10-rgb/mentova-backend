# Mentova - Professional Crypto AI Learning Platform

## Architecture
- **Frontend**: React Native (Expo) Web → Netlify
- **Backend**: FastAPI → Render
- **AI**: OpenAI GPT-5.6 Terra
- **Payments**: Stripe Live ($21.99/month)
- **Database**: MongoDB Atlas

## UI — ChatGPT/Claude Hybrid (Sept 11, 2026)

### Layout
- **Sidebar** (desktop): Always visible, collapsible (240px ↔ 56px)
- **Sidebar** (mobile <768px): Hamburger icon → overlay drawer with dark backdrop
- **Main Canvas**: Atlas chat as default view
- **Theme**: Dark (default) / Light toggle, persisted in AsyncStorage

### Pages
- **Onboarding** (`/`): Atlas-centric, "Learn crypto with Atlas AI", 4 feature pills
- **Login** (`/login`): "Welcome back", glassmorphism, violet accent
- **Register** (`/register`): "Create account", 4 fields, same style
- **Atlas Chat** (`/(tabs)/learn`): Welcome suggestions (4 cards), conversation history, sub-tabs (Chat/Modules/Progress)

### Sidebar Navigation
Mentova logo, New Chat, Atlas AI, Home, Market, News, Profile, VIP Hub, Theme Toggle, User Avatar

### Design System
- Dark: bg #06060F, surface #120E26, text #F8FAFC
- Light: bg #FFFFFF, surface #F1F5F9, text #0F172A
- Primary: #7C3AED (both modes), VIP Gold: #FFD700

### Welcome Suggestions (Atlas Chat)
4 clickable cards when chat is empty:
1. "What is Bitcoin and how does it work?"
2. "Explain DeFi in simple terms"
3. "What is the difference between a token and a coin?"
4. "How to read a trading chart?"

## VIP System — 6 Features ($21.99/month)
1. Memory, 2. Chart Analysis, 3. Market Intelligence, 4. Personalized Learning, 5. Daily Briefing, 6. Advanced Tools
- Smart Upgrade Prompt for FREE users (invisible trigger)
- No visible counters/quotas
- No Fear & Greed, No Voice

## Stripe
- Product: Mentova VIP (auto-created)
- Price: price_1UEV6kAdwzWILqbUTTxVYjsQ

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!

## Backlog
### P0 - Configure Stripe webhook + deploy to Render
### P1 - Personalized daily briefing, CoinGecko key renewal
### P2 - Community forum, Referral system
### P3 - Technical indicators, reCAPTCHA
