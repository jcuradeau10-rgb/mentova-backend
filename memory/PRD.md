# Mentova - Professional Crypto Mentor Marketplace

## Architecture
- **Frontend**: React Native (Expo) → Netlify (web) + EAS Build (iOS/Android)
- **Backend**: FastAPI → Render
- **Database**: MongoDB Atlas
- **Payments**: Stripe Checkout
- **Crypto Data**: CoinGecko Pro API (zero user-call architecture)

## Current State (Sept 10, 2026)

### Simplified 5-Tab Navigation (DONE)
- **Home** — Dashboard principal
- **Atlas AI** — Mentor IA personnalisé (killer feature)
- **Market** — Prix crypto temps réel
- **News** — Articles traduits FR/EN/ES
- **Profile** — Compte + abonnement VIP

### Hidden Features (code kept, not visible)
- Community (gate verrouillé - founding members only)
- Mentors humains / Marketplace
- "More" menu floating (removed)
- Bookings, Messages, Pro Dashboard

### Active Features
- CoinGecko zero-user-call architecture (~78k/month budget)
- Founding Member badge system (Stripe webhook configured)
- Spots counter (preregistered: 9/500)
- Community gate with i18n FR/EN/ES
- PWA install prompt (iOS/Android detection)
- Static site fixes (removed em dashes, layout shift)

### Infrastructure Issues
- Render: SERVICE SUSPENDED - check dashboard.render.com
- MongoDB Atlas: DNS not resolving - check cloud.mongodb.com
- GitHub token: EXPIRED - use "Save to Github" feature

### To Launch
1. Reactivate Render + MongoDB Atlas
2. Push latest code via "Save to Github"
3. Build Netlify: `npx expo export -p web && netlify deploy --prod --dir=dist`
4. Build iOS: `npx eas build --platform ios --profile production`
5. Submit to Apple: `npx eas submit --platform ios --profile production`

## Key Credentials
- Super Admin: jcuradeau.7@gmail.com / Crypto2026!
- Stripe webhook: https://mentova-api.onrender.com/api/webhook/stripe
- EAS config: eas.json with EXPO_PUBLIC_BACKEND_URL set to Render
