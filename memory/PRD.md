# Mentova PRD

## Project Overview
**Mentova** — Mentor Marketplace for Crypto Education (Mobile + Web)
- React Native (Expo) + FastAPI + MongoDB Atlas
- Multilingual: FR, EN, ES
- Deploy: Render (backend), Netlify (web), EAS (mobile)

## VIP Limits System ✅ NEW
- **Non-VIP**: 20 messages Atlas/24h, 2 chapitres gratuits par niveau
- **VIP** ($9.99/mo fondateur): Illimité — messages, chapitres, features
- Rate limiting côté backend avec tracking par user_id
- Frontend: badge VIP doré sur chapitres verrouillés, compteur messages

## Atlas v2 — Adaptive Mentor ✅
- Level Assessment (5 questions → beginner/intermediate/advanced)
- 3 levels × 6 chapters = 18 chapters
- AI-generated lessons + Quiz (MCQ + True/False + Open questions)
- Conversation memory, progress tracking (MongoDB + AsyncStorage)
- Dual tabs: "Mon Parcours" + "Chat Atlas"

## Other Features ✅
- Stripe Checkout for VIP ($9.99/mo), Interactive Glossary (20 terms)
- Community (Twitter/X), Admin Dashboard, Transactional Emails

## Backlog
- (P2) Desktop responsiveness, Refactor server.py, Technical indicators
- (P3) reCAPTCHA, Nested comments, Split translations
