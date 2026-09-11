# Mentova - Professional Crypto AI Learning Platform

## Architecture
- Frontend: React Native (Expo) Web → Netlify
- Backend: FastAPI → Render
- AI: OpenAI GPT-5.6 Terra
- Payments: Stripe Live ($21.99/month)
- Database: MongoDB Atlas

## UI — ChatGPT/Claude Hybrid (Sept 11, 2026)

### Layout
- Sidebar (desktop): Always visible, collapsible (260px↔56px)
- Sidebar (mobile <768px): Hamburger overlay with dark backdrop
- Main Canvas: Atlas chat default view
- Theme: Dark/Light toggle, persisted AsyncStorage

### Sidebar Features
- Mentova logo + collapse toggle
- New Chat button
- Conversation history (grouped: Today/Yesterday/Last 7 days/Older)
- Navigation: Home, Market, News, Profile
- VIP Hub link
- Theme toggle (sun/moon)
- User avatar + plan badge

### Pages
- Onboarding (/): Atlas-centric, 4 feature pills, Get Started
- Login (/login): Glassmorphism, "Welcome back"
- Register (/register): "Create account", 4 fields
- Atlas Chat (/(tabs)/learn): Welcome suggestions (4 cards), sub-tabs

### Design System
- Dark: bg #06060F, surface #120E26, text #F8FAFC
- Light: bg #FFFFFF, surface #F1F5F9, text #0F172A
- Primary: #7C3AED, VIP Gold: #FFD700

## VIP System ($21.99/month)
6 Features: Memory, Chart Analysis, Market Intelligence, Personalized Learning, Daily Briefing, Advanced Tools
- Smart Upgrade Prompt (invisible trigger for FREE users)
- No visible counters/quotas, No Fear & Greed, No Voice
- Stripe: Product auto-created, full lifecycle (checkout, portal, webhooks)

## Key Files Modified This Session
- /app/frontend/app/(tabs)/_layout.tsx — Sidebar with conversation history
- /app/frontend/app/(tabs)/learn.tsx — Atlas chat with suggestions + VIP
- /app/frontend/app/index.tsx — Onboarding redesign
- /app/frontend/app/login.tsx — Login redesign
- /app/frontend/app/register.tsx — Register redesign
- /app/frontend/app/vip/index.tsx — VIP page (6 features)
- /app/frontend/app/vip/hub.tsx — VIP Hub
- /app/frontend/store/themeStore.ts — Theme dark/light
- /app/frontend/store/atlasNavStore.ts — Sidebar-chat communication
- /app/backend/services/vip_permissions.py — Centralized permissions
- /app/backend/services/atlas_protection.py — Invisible protection
- /app/backend/services/stripe_service.py — Stripe lifecycle
- /app/backend/routes/atlas_v3.py — VIP integration + Smart Upgrade

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!

## Backlog
### P0 - Stripe webhook config + Render deploy
### P1 - Personalized briefing, CoinGecko renewal
### P2 - Community, Referral
### P3 - Technical indicators, reCAPTCHA
