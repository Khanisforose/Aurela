# Aurela — Product Requirements & Progress

Premium global digital banking + crypto platform (Next.js App Router + MongoDB). Luxury black/gold UI, glassmorphism.
Live: https://www.aurelawallet.com (Dockerized on Hostinger VPS, data in named Docker volume `mongo_data`).

## Core features (DONE)
- Auth: email OTP (Resend) + Google Sign-in, password reset, sessions
- Multi-currency fiat + crypto wallets, live Coinbase rates, swap engine
- Internal transfers, user-to-user pay via Aurela ID (`/pay?to=`), QR deep links
- Deposit / withdrawal requests with admin approval, virtual cards (tiers, per-user fee overrides), KYC
- Admin panel: overview, users, KYC review, deposits, withdrawals, card approvals, transactions, platform wallets, settings, audit log
- Public chain explorer `/scan`, SEO sitemap/robots
- PWA + TWA (signed `Aurela.apk`), web push (VAPID), passcode/biometric lock, update banner, mobile bottom nav
- 30-day portfolio chart (atomic snapshots)

## This session (DONE)
- Mobile "Wallets" tab now shows fiat + crypto combined, All/Fiat/Crypto filter, sorted by balance (funded first, empty last).
- Fixed production crash on admin KYC Review: list endpoints no longer return base64 doc images (projection); list supports `?status=&limit=`, returns `{kyc,total,pending}`. Detail endpoint still returns images on demand.
- KycAdmin UI: loading / visible error + retry / status filter chips / pending count; silent background refresh paused while review dialog is open.
- Added React `ErrorBoundary` around dashboard tab content + `app/error.js` + `app/global-error.js` → no more generic "Application error" full-page crash.
- Fixed cold-start race in `connectToMongo()` (shared connection promise) that 500'd the first concurrent requests after each restart.

## Backlog
- P1 Sign in with Apple (needs Apple Service ID / Team ID / Key ID / .p8)
- P2 QR payment (show Aurela ID QR in-app)
- P3 Nightly Mongo backup to remote storage
- P4 "What's new" changelog sheet after update
- P5 Play Store launch walkthrough (.aab)
- P6 Real Stripe deposits (needs keys)
- P7 On-chain deposit auto-credit (Moralis/Alchemy)
- P8 Refactor monolithic `route.js` and `Dashboard.jsx`
- Consider moving KYC images out of Mongo documents (GridFS / object storage) for long-term scalability

## Credentials
- Super admin: admin@aurelawallet.com / Aurela@123# (see /app/memory/test_credentials.md)
