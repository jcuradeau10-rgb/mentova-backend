# Mentova - Professional Crypto Mentor Marketplace

## Original Problem Statement
Build a professional mentor marketplace named "Mentova" using React Native (Expo) and FastAPI.

## Architecture
- **Frontend**: React Native (Expo) with web export → Netlify
- **Backend**: FastAPI → Render
- **Database**: MongoDB Atlas
- **Payments**: Stripe Checkout
- **Crypto Data**: CoinGecko Pro API (zero user-call architecture)

## What's Been Implemented

### Core Features (DONE)
- Auth (JWT), Stripe VIP, Atlas AI, Community, Messaging, Profiles, Admin

### CoinGecko Zero-User-Call Architecture (DONE - June 25, 2026)
- ALL calls in background scheduler, zero user-triggered calls
- ~78k/month budget (under 100k Pro limit)

### Founding Member System (DONE - June 25, 2026)
- Spots counter counts only Stripe-confirmed payments
- Badge on profile (gold star), set via checkout + webhook

### PWA Install Prompt (DONE - June 25, 2026)
- Bottom sheet popup appears 2.5s after login in the app
- Detects iOS vs Android vs Desktop and shows platform-specific instructions
- iOS: Partager → Sur l'écran d'accueil → Ajouter
- Android: Menu → Ajouter à l'écran d'accueil → Installer
- "Ne plus afficher" checkbox → permanently dismisses via AsyncStorage
- Doesn't show if already installed as PWA (standalone mode)
- Benefits listed: accès rapide, notifications, plein écran
- App Store & Google Play "bientôt disponible" note

### Static Site Fixes (DONE - June 25, 2026)
- Removed "—" from EN/FR/ES, fixed duplicate heroSpots IDs
- Layout shift fix with `contain: layout style`

## Pending Tasks
- (P2) Desktop responsiveness
- (P2) Technical indicators (RSI, Bollinger) for VIP charts
- (P2) Refactor server.py

## Backlog
- (P3) reCAPTCHA, split translations, localize notifications
