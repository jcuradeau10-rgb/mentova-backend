# Mentova - Professional Crypto Mentor Marketplace

## Original Problem Statement
Build a professional mentor marketplace named "Mentova" using React Native (Expo) and FastAPI. Requirements include:
- Full multilingual support (FR, EN, ES)
- VIP membership ($9.99/mo first 500 founders, then $25.99/mo)
- "Atlas" Adaptive AI Mentor with structured learning modules and chat
- Twitter/X-style Community forum
- Apple-compliant mobile app + web app
- Backend running 24/7 independently on Render

## Architecture
- **Frontend**: React Native (Expo) with web export
- **Backend**: FastAPI (monolith server.py ~13k lines)
- **Database**: MongoDB Atlas (user's personal cluster)
- **Hosting**: Netlify (web app), Render (backend), EAS (mobile OTA)
- **AI**: LiteLLM via Emergent proxy for GPT-4o streaming
- **Payments**: Stripe Checkout (STRIPE_SK env var)

## What's Been Implemented

### Core Features (DONE)
- User authentication (JWT) with session persistence
- Stripe VIP membership integration
- Atlas AI Mentor v3 (assessment, curriculum, 1500+ word lessons, quizzes, badges)
- VIP limits (2 free chapters, 20 msgs/24h)
- Community forum (posts, comments, likes, votes, bookmarks, delete, report)
- Interactive contextual glossary for crypto terms
- User profiles and following system
- Messaging system
- Admin dashboard
- Price alerts and crypto tools

### Notification System (DONE - June 22, 2026)
- **End-to-end notification flow**: Action -> Backend storage -> Frontend display
- **Triggers implemented**:
  - Community post likes -> notify post author (type: post_like)
  - Community post comments -> notify post author (type: post_comment)
  - Direct messages -> notify recipient (type: new_message)
  - Post reports -> notify all admins (type: admin_report)
  - User follows -> notify followed user (type: follow)
  - VIP social likes/comments -> already existed
  - Story reactions -> already existed
  - Booking events -> already existed
  - Pro application approval/rejection -> already existed
  - Price alerts -> already existed
- **Backend**: `send_notification_to_user()` stores in MongoDB + sends via Expo Push + WebSocket
- **Frontend**: NotificationCenter component with bell icon badge, modal, filters (All, Unread, Messages, Alerts, Social, Likes, Badges), mark all read
- **Removed duplicate/broken endpoints**: Cleaned up conflicting `/notifications` and `/notifications/read` endpoints that used wrong field name (`read` vs `is_read`)

## Pending Tasks

### P2 - Web App Desktop Responsiveness
- Rethink responsive grids and max-widths for desktop
- Status: NOT STARTED

### Static Marketing Site Redesign (DONE - June 22, 2026)
- Complete redesign of `/app/static-site/index.html`
- Swiss high-contrast dark theme (Unbounded + Chivo fonts, yellow #FACC15 CTAs)
- Glass header, kinetic marquee, bento grid features, AI terminal mockup
- Tracing beam border on VIP pricing card
- Registration form connected to Render API
- Mobile responsive, scroll entrance animations
- All existing JS logic preserved (countdown, spots, form submission, FAQ)
- Deploy to Netlify: `cd /app/static-site && netlify deploy --prod --dir=.`

## Backlog
- (P2) Refactor server.py into separate router files
- (P2) Technical indicators (RSI, Bollinger) for VIP crypto charts
- (P3) reCAPTCHA on auth forms
- (P3) Split translations.ts by feature
- (P3) Localize notification template strings (currently French-only titles/bodies)
- (P3) Convert data-testid to testID for React Native Web compatibility

## Key API Endpoints
- POST /api/auth/login -> {access_token, user}
- GET /api/notifications/history -> {success, data: [...]}
- POST /api/notifications/mark-read -> marks all or specific as read
- POST /api/community/posts/{id}/like -> triggers post_like notification
- POST /api/community/posts/{id}/comments -> triggers post_comment notification
- POST /api/messages/{user_id} -> triggers new_message notification
- POST /api/community/posts/{id}/report -> triggers admin_report notification
- POST /api/users/{user_id}/follow -> toggle follow, triggers follow notification
