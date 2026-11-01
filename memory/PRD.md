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
- Admin "Users Map" tab: Leaflet (CDN, no key) + Esri dark basemap; gold markers = verified GPS, red = denied (IP position), amber ring = on hold; country hotspot circles + sidebar ranking (click → zoom); popups with user/KYC/hold/KYC-country-mismatch; filters; GET /admin/locations/map.
- Deposit & Withdraw Requests: "Open request" review dialog (requester profile, KYC, wallet, last location + history, payment proof / tx hash + explorer link, beneficiary details, user history). New GET /admin/deposits/:id, /admin/withdrawals/:id.
- Nightly local backups: deploy/backup.sh + deploy/install-backup-cron.sh (02:30, 30-day rotation, optional rclone remote hook), documented in deploy/README.md.
- Admins skip card requirement + geo hold on withdraw. Allowance/unlock decisions are silent to users. Geo error: "Geolocation Unverified (The card used to withdraw is not supported in this geolocation). Please contact support at support@aurelawallet.com".
- Location verification: LocationGate asks permission ONCE (first login; deny → full-screen block until allowed, admins exempt). Afterwards fully silent: GPS + IP + device sent on every app open, on return to foreground, and every 15 min while in use (dedup <200m/1h; geocoder reused if moved <1km). Captures (POST /location → user_locations + users.last_location, reverse-geocoded via Nominatim, IP via ipwho.is). Users who deny are blocked full-screen until they allow; admins exempt from block. Admin sees location in user detail, request dialogs, card dialog, Withdrawal Access.
- DECLINED (not possible / not permitted): contacts, SMS, call-log access.
- Version 1.4.2.
- Geolocation withdrawal hold: every card approval puts the user's external withdrawals on hold. Withdraw attempts show a "Geolocation Unverified — contact support@aurelawallet.com" popup (server-enforced 403 GEO_UNVERIFIED). Blocked attempts alert all admins (bell/push/email) and appear in new admin tab "Withdrawal Access", where admin sets a USD allowance per user, unlocks fully (exempt from future auto-locks) or re-locks. Allowance is consumed per withdrawal and restored if admin rejects the request. Also fixed pre-existing available-balance double-count bug in /withdraw.
- WHATS_NEW bullets + version 1.4.1 (re-bump when deploying this).
- Card approval now credits the paid activation fee to the user's USDT wallet (once per card, atomic guard), writes a `card_activation_credit` transaction (with balance_after) + chain block, and sends a professional notification (in-app + push + branded email receipt). Applies to approvals from now on only (no back-fill).
- "Aurela Updated" one-time popup per app version (WhatsNew.jsx; content from GET /api/version → WHATS_NEW in route.js; version bumped to 1.4.0). To re-trigger on a future deploy: bump package.json version + edit WHATS_NEW bullets.
- Admin Card Approvals: list shows requester (name / @username / email), "Open request" dialog with requester profile, KYC status, USDT balance, card + payment details, tx hash with explorer link, approve/activate/reject/delete inside. New GET /admin/cards/:id.
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

## v1.5.0 — "Aurela Updated" popup (generic notes)
- package.json bumped 1.4.2 → 1.5.0; WHATS_NEW in route.js now lists only generic user-facing notes (stability, optimization, security).
- Rule: never mention admin-side features in WHATS_NEW; keep bullets short and generic unless the user asks otherwise.

## KYC hardening + rejection reasons (ships in v1.5.0)
- Registration: all fields mandatory; whitespace-only values rejected; email format + phone (>=6 digits) validated server-side (register/init) and client-side (Auth.jsx).
- KYC form (KycTab in Dashboard.jsx): ALL 15 fields mandatory incl. dob, state, city, postal, address, occupation, doc_back and selfie. Missing fields highlighted red + summary. Server (POST /kyc) enforces the same list; blocks resubmit while pending/approved.
- Admin reject (KycAdmin in AdminPanel.jsx): "Reject…" opens a dialog with 6 quick-pick reasons + free-text (5–500 chars, required). POST /admin/kyc/:id/reject {reason}. Reason stored on kyc.rejection_reason + users.kyc_rejection_reason, included in the user's notification, shown in admin list/detail and in the user's KYC tab banner. Cleared on resubmit/approve.

## Zonal (geolocation) cards — admin-only product
- 11 zones (NA,SA,EU,UK,ME,AF,CIS,SAS,SEA,EA,OCE) seeded into `card_zones`, each with landmark photo (Unsplash), metallic theme, ISO country list, fee (USDT), activation time (plain number = HOURS), enabled flag. Admin edits everything in the "Zonal Cards" tab (ZonalCardsAdmin.jsx) with live card preview.
- Admin issues directly: user search → location/zone auto-detected from last GPS/IP fix → override zone/fee/hours per card → issue. Paid cards follow the existing tx-hash → Card Approvals flow; fee credited to USDT; usable_at = approval + hours. Fee 0 → straight to activating/active.
- Zonal cards SKIP the geolocation withdraw hold and don't count toward the 3-tier-card cap.
- Users see their metallic landmark card (ZonalCard.jsx) on the Cards tab; zone config/fees stay admin-only.

## v1.6.1 — Mobile fixes
- Global Dialog (components/ui/dialog.jsx): capped at 100dvh with internal scroll, 10px side margins, smaller padding on phones — pop-ups no longer run off-screen.
- Android/PWA back key (Dashboard.jsx): tab changes push history entries (?tab=…), each open dialog pushes one; popstate closes dialog → previous tab → … → exit only from the first screen. Mobile nav drawer: back just closes it.

## v1.7.0 — External withdrawal fee engine
- Fee deducted from the withdrawn amount (wallet debited gross, user receives net). Tiers by USD value: <$100k 10%, $100k–$1M 0.5%, ≥$1M 0.15% (market-benchmarked), + flat rail cost per crypto network / fiat method (ERC20 $5, TRC20 $1, SWIFT $25 …), clamped by min ($1) / max (none). Per-currency overrides (enable/min/max/rail/tiers).
- Live quote on the Withdraw form (You withdraw → Fee → You receive). Quote frozen on the request; collected into `treasury_ledger` (type withdraw_fee) only on admin approval; rejection refunds gross.
- Admin "Fees & Treasury" tab (FeesAdmin.jsx): revenue report (range stats, daily chart, by currency, recent) + schedule editor (tiers, min/max, rails, overrides) with live calculator. Routes: /withdraw/quote, /admin/fees/schedule (GET/PUT), /admin/fees/preview, /admin/fees/report.


## Card activation reject → Try again
- Admin rejects a pending card activation (tier or zonal) with an optional reason (default: hash could not be verified). Card stores rejection_reason, rejection_count, activation_attempts[], rejected_tx_hashes.
- User sees "Activation rejected" + reason on the card, with "Try again" (re-opens activation dialog) and "Delete". Resubmission blocked for previously rejected hashes or hashes used by any other card. Admin sees prior rejected attempts in the request detail.
