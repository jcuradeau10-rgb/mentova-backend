# Mentova - Professional Crypto AI Learning Platform

## Architecture
- Frontend: React Native (Expo) Web -> Netlify
- Backend: FastAPI -> Render
- AI: OpenAI GPT-5.6 Terra
- Payments: Stripe Live ($21.99/month)
- Database: MongoDB Atlas

## UI — ChatGPT/Claude Hybrid

### Layout
- Sidebar (desktop): Always visible, collapsible (260px<->56px)
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
- Atlas Chat (/(tabs)/learn): Welcome suggestions (4 cards), sub-tabs, language dropdown
- Admin (/admin): Multi-tab admin panel with User Intelligence
- User Intelligence (/user/intelligence): Full user analytics with PDF export

### Design System
- Dark: bg #06060F, surface #120E26, text #F8FAFC
- Light: bg #FFFFFF, surface #F1F5F9, text #0F172A
- Primary: #7C3AED, VIP Gold: #FFD700

## VIP System ($21.99/month)
6 Features: Memory, Chart Analysis, Market Intelligence, Personalized Learning, Daily Briefing, Advanced Tools
- Smart Upgrade Prompt (invisible trigger for FREE users)
- No visible counters/quotas
- Stripe: Product auto-created, full lifecycle (checkout, portal, webhooks)

## Internationalization (i18n)
- 3 Languages: French (FR), English (EN), Spanish (ES)
- In-chat language selector dropdown in Atlas header
- Static marketing sites fully translated (EN, FR, ES)

## User Intelligence System (NEW - Sept 11, 2026)
### Backend Endpoints
- GET /api/admin/users/{user_id}/intelligence — Full user analytics aggregation
- GET /api/admin/users/{user_id}/intelligence?period=7|30|90|all — Period filtering
- GET /api/admin/users/{user_id}/intelligence/pdf — Professional PDF report download
- GET /api/admin/users/{user_id}/full-export — Complete JSON data export (legal/litigation)
- GET /api/admin/intelligence/global — Global platform analytics
- POST /api/track/session?action=start|end — Lightweight session tracking
- POST /api/track/event?event_type=...&feature=... — Feature usage tracking

### Analytics Sections
1. User Overview — Summary, engagement score, quick stats
2. Engagement — Sessions, time, active days, score breakdown
3. Atlas AI — Conversations, messages, VIP features used
4. Learning Progress — Modules, quizzes, skills radar
5. Feature Usage — Per-feature tracking with 7d/30d breakdowns
6. Revenue & Subscription — Plans, payments, billing history
7. Activity Timeline — Chronological events with filters

### PDF Export
- Professional Mentova-branded PDF with all sections
- Sanitized for latin-1 encoding (handles special chars)
- Confidential disclaimer included

### Full Data Export
- Complete JSON dump of all user data from all collections
- Includes metadata (export date, admin who exported, purpose)
- For legal/litigation/GDPR compliance

### New Collections
- user_events: Event tracking with 90-day TTL
- user_sessions: Session start/end/duration tracking

## Key Files
- /app/frontend/app/(tabs)/_layout.tsx — Sidebar + session tracking
- /app/frontend/app/(tabs)/learn.tsx — Atlas chat with language selector
- /app/frontend/app/admin.tsx — Admin panel with User Intelligence button
- /app/frontend/app/user/intelligence.tsx — User Intelligence page
- /app/backend/routes/user_intelligence.py — Intelligence API + PDF + Export
- /app/backend/routes/admin.py — Admin routes
- /app/backend/routes/analytics.py — Real-time analytics
- /app/backend/routes/atlas_v3.py — Atlas AI core
- /app/backend/services/atlas_protection.py — Smart upgrade/degradation
- /app/backend/services/stripe_service.py — Stripe lifecycle
- /app/backend/services/vip_permissions.py — VIP access control

## Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!

## Completed
- VIP Backend Architecture DONE
- Stripe Integration ($21.99/mo) DONE
- Smart Upgrade & Protection DONE
- UI/UX ChatGPT-style rebuild DONE
- VIP Features (Market Intel, Briefing, Chart Analysis) DONE
- MongoDB Atlas connection fix DONE
- Module "Continue" button DONE
- In-chat language selector DONE
- Full i18n static sites (EN, ES, FR) DONE
- User Intelligence System DONE (Sept 11, 2026)
  - Intelligence API with 7 analytics sections
  - PDF export with Mentova branding
  - Full JSON data export for legal
  - Session & event tracking
  - Engagement scoring (0-100)
  - Admin panel integration

## Backlog
### P0 - Deploy to Netlify + remind user to "Save to Github" for Render
### P1 - Personalized briefing, CoinGecko key renewal
### P2 - Community features, Referral system
### P3 - Technical indicators (RSI, Bollinger), reCAPTCHA
