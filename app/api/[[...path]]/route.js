import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// ============================================================
// AURELA — Global Digital Banking & Crypto Platform (MVP API)
// ============================================================

let client, db
async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
    await ensureSeed(db)
  }
  return db
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}
export async function OPTIONS() { return handleCORS(new NextResponse(null, { status: 200 })) }

// ---------- Constants ----------
const SECRET = process.env.AURELA_JWT_SECRET || 'aurela_default_secret'
const FIAT = ['USD','EUR','GBP','INR','AED','JPY','CAD','AUD','SGD','CHF','NZD','HKD','KRW','CNY','MXN','BRL','ZAR','TRY','RUB','SEK','NOK','DKK','PLN','THB','MYR','IDR','PHP','VND','EGP','SAR','NGN','ARS','CLP','COP','ILS','CZK','HUF','QAR','KWD','BHD','OMR','JOD','LKR','PKR','BDT','KES','GHS','TWD','UAH','RON']
const CRYPTO = ['BTC','ETH','USDT','USDC','BNB','SOL','XRP','ADA','DOGE','MATIC','AVAX','DOT','TRX','LINK','ATOM','LTC','BCH','XLM','NEAR','APT','ARB','OP','SUI','TON','SHIB','PEPE','INJ','FIL','ICP','HBAR']
const CRYPTO_NETWORKS = {
  BTC: ['Bitcoin'], ETH: ['ERC20'], USDT: ['ERC20','TRC20','BEP20'], USDC: ['ERC20','BEP20','Polygon'],
  BNB: ['BEP20'], SOL: ['Solana'], XRP: ['XRP'], ADA: ['Cardano'], DOGE: ['Dogecoin'], MATIC: ['Polygon','ERC20'],
  AVAX: ['Avalanche'], DOT: ['Polkadot'], TRX: ['TRC20'], LINK: ['ERC20','BEP20'], ATOM: ['Cosmos'],
  LTC: ['Litecoin'], BCH: ['BitcoinCash'], XLM: ['Stellar'], NEAR: ['NEAR'], APT: ['Aptos'],
  ARB: ['Arbitrum'], OP: ['Optimism'], SUI: ['Sui'], TON: ['TON'], SHIB: ['ERC20'],
  PEPE: ['ERC20'], INJ: ['Injective'], FIL: ['Filecoin'], ICP: ['ICP'], HBAR: ['Hedera']
}
// Binance symbols for live crypto prices (USDT-quoted, ~USD)
const BINANCE_SYMBOLS = {
  BTC:'BTCUSDT', ETH:'ETHUSDT', BNB:'BNBUSDT', SOL:'SOLUSDT', XRP:'XRPUSDT',
  ADA:'ADAUSDT', DOGE:'DOGEUSDT', MATIC:'MATICUSDT', AVAX:'AVAXUSDT', DOT:'DOTUSDT',
  TRX:'TRXUSDT', LINK:'LINKUSDT', ATOM:'ATOMUSDT', LTC:'LTCUSDT', BCH:'BCHUSDT',
  XLM:'XLMUSDT', NEAR:'NEARUSDT', APT:'APTUSDT', ARB:'ARBUSDT', OP:'OPUSDT',
  SUI:'SUIUSDT', TON:'TONUSDT', SHIB:'SHIBUSDT', PEPE:'PEPEUSDT', INJ:'INJUSDT',
  FIL:'FILUSDT', ICP:'ICPUSDT', HBAR:'HBARUSDT', USDC:'USDCUSDT'
  // USDT itself = 1.0
}
const CARD_TIERS = {
  basic:   { name: 'Aurela Basic',   activation_fee_usdt: 10,  daily_spend: 1000,  daily_withdraw: 500,   monthly_spend: 10000,  color: 'basic' },
  premium: { name: 'Aurela Premium', activation_fee_usdt: 50,  daily_spend: 10000, daily_withdraw: 5000,  monthly_spend: 100000, color: 'premium' },
  elite:   { name: 'Aurela Elite',   activation_fee_usdt: 200, daily_spend: 50000, daily_withdraw: 25000, monthly_spend: 500000, color: 'elite' },
}
// Fallback rates if API unreachable (USD-based)
const FALLBACK_FX = { USD:1, EUR:0.92, GBP:0.79, INR:83.2, AED:3.67, JPY:157.1, CAD:1.36, AUD:1.51, SGD:1.35, CHF:0.90, NZD:1.64, HKD:7.82, KRW:1360, CNY:7.24, MXN:17.1, BRL:5.10, ZAR:18.5, TRY:32.4, RUB:88.5, SEK:10.4, NOK:10.6, DKK:6.87, PLN:3.98, THB:35.8, MYR:4.68, IDR:15900, PHP:56.8, VND:24800, EGP:47.5, SAR:3.75, NGN:1550, ARS:900, CLP:920, COP:3900, ILS:3.72, CZK:23.2, HUF:355, QAR:3.64, KWD:0.31, BHD:0.38, OMR:0.39, JOD:0.71, LKR:302, PKR:278, BDT:117, KES:129, GHS:14.5, TWD:32.3, UAH:39.5, RON:4.58 }
const FALLBACK_CRYPTO_USD = { BTC:67000, ETH:3500, USDT:1, USDC:1, BNB:600, SOL:150, XRP:0.52, ADA:0.45, DOGE:0.15, MATIC:0.72, AVAX:35, DOT:7.2, TRX:0.12, LINK:14, ATOM:8, LTC:80, BCH:400, XLM:0.11, NEAR:5.5, APT:9, ARB:1.1, OP:2.4, SUI:1.3, TON:5.5, SHIB:0.00002, PEPE:0.000008, INJ:24, FIL:5, ICP:11, HBAR:0.09 }

// ---------- Helpers ----------
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex') }
function hashPassword(pwd, salt) { return sha256(salt + ':' + pwd + ':' + SECRET) }
function newSalt() { return crypto.randomBytes(16).toString('hex') }
function newToken() { return crypto.randomBytes(24).toString('hex') }
function randDigits(n) { let s=''; for (let i=0;i<n;i++) s+=Math.floor(Math.random()*10); return s }
function fmtCardNumber() {
  // Aurela BIN: 4 + 5 random -> 6 digit BIN 4-2-6-0-2-1; then 10 more digits
  return '4260' + randDigits(4) + ' ' + randDigits(4) + ' ' + randDigits(4)
}
function cardExpiry() {
  const d = new Date(); d.setFullYear(d.getFullYear()+3)
  return String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getFullYear()).slice(-2)
}
function now() { return new Date() }
function clean(doc) {
  if (!doc) return doc
  if (Array.isArray(doc)) return doc.map(clean)
  const { _id, password_hash, salt, ...rest } = doc
  return rest
}

async function getUserByToken(db, request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const session = await db.collection('sessions').findOne({ token })
  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null
  const user = await db.collection('users').findOne({ id: session.user_id })
  return user
}

async function audit(db, actorId, action, meta = {}) {
  await db.collection('audit_logs').insertOne({
    id: uuidv4(), actor_id: actorId, action, meta, timestamp: now()
  })
}

// ---------- Aurela Chain (internal hash-linked ledger) ----------
async function writeBlock(db, blockData) {
  const last = await db.collection('aurela_chain').find({}).sort({ block_number: -1 }).limit(1).toArray()
  const prev = last[0]
  const block_number = prev ? prev.block_number + 1 : 1
  const prev_hash = prev ? prev.hash : '0'.repeat(64)
  const timestamp = now()
  const payload = { block_number, prev_hash, timestamp: timestamp.toISOString(), ...blockData }
  const hash = sha256(JSON.stringify(payload))
  const block = { id: uuidv4(), ...payload, hash }
  await db.collection('aurela_chain').insertOne(block)
  return block
}

async function hasActiveCard(db, userId) {
  const c = await db.collection('cards').findOne({ user_id: userId, status: 'active', frozen: { $ne: true } })
  return !!c
}

// ---------- Email OTP via Resend ----------
async function sendEmailOTP(email, code, purpose = 'signup') {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'Aurela <onboarding@resend.dev>'
  if (!apiKey) {
    console.log(`[AURELA OTP:no-service] to=${email} code=${code} purpose=${purpose}`)
    return { delivered: false, code }
  }
  const subject = purpose === 'signup' ? 'Your Aurela verification code' : 'Your Aurela security code'
  const html = `
  <div style="background:#050507;color:#f5f5f0;font-family:'Helvetica Neue',Arial,sans-serif;padding:40px 20px">
    <div style="max-width:520px;margin:0 auto;background:linear-gradient(160deg,#141419 0%,#0b0b0f 100%);border:1px solid rgba(212,175,55,0.25);border-radius:16px;padding:36px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;font-family:'Playfair Display',Georgia,serif;font-size:26px;letter-spacing:8px;background:linear-gradient(120deg,#8f6b18,#d4af37,#f5e29d,#d4af37,#8f6b18);-webkit-background-clip:text;background-clip:text;color:transparent">AURELA</div>
      </div>
      <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:28px;color:#f5e29d;margin:0 0 8px">Verify your email</h1>
      <p style="color:#a8a8a0;font-size:14px;line-height:1.6;margin:0 0 24px">Use the code below to complete your Aurela account setup. This code expires in 10 minutes.</p>
      <div style="background:#050507;border:1px solid rgba(212,175,55,0.4);border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
        <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:34px;letter-spacing:12px;color:#f5e29d">${code}</div>
      </div>
      <p style="color:#7a7a72;font-size:12px;line-height:1.5;margin:0">If you did not request this, ignore this email. Never share this code with anyone \u2014 Aurela will never ask for it.</p>
      <hr style="border:none;border-top:1px solid rgba(212,175,55,0.12);margin:28px 0" />
      <p style="color:#7a7a72;font-size:11px;text-align:center;margin:0">\u00a9 ${new Date().getFullYear()} Aurela Wallet \u00b7 Wealth \u00b7 Security \u00b7 Trust</p>
    </div>
  </div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject, html })
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[Resend] failure', res.status, err)
      return { delivered: false, code, error: err }
    }
    return { delivered: true, code }
  } catch (e) {
    console.error('[Resend] error', e)
    return { delivered: false, code, error: String(e) }
  }
}

// ---------- Seeding ----------
async function ensureSeed(db) {
  // Production reset: on first boot with new admin config, wipe all test data
  const migration = await db.collection('system').findOne({ id: 'migration' })
  if (!migration || migration.version !== 'v4_treasury_trc20') {
    if (!migration || migration.version !== 'v3_production') {
      const collectionsToWipe = ['users','wallets','transactions','sessions','cards','kyc','audit_logs','rates','status_checks']
      for (const c of collectionsToWipe) {
        try { await db.collection(c).deleteMany({}) } catch(e) {}
      }
    }
    // v4: force treasury wallet to USDT TRC20
    await db.collection('settings').updateOne(
      { id: 'platform' },
      { $set: {
        card_activation_wallet: 'TLgjfeg8Mqw5ueo1CGC8eTb4EHysPMMA6S',
        card_activation_network: 'TRC20',
        updated_at: now(),
      } },
      { upsert: false }
    )
    await db.collection('system').updateOne(
      { id: 'migration' },
      { $set: { id: 'migration', version: 'v4_treasury_trc20', ran_at: now() } },
      { upsert: true }
    )
  }

  const existing = await db.collection('users').findOne({ role: 'super_admin' })
  if (!existing) {
    const salt = newSalt()
    const admin = {
      id: uuidv4(),
      username: 'aurela_admin',
      email: 'admin@aurelawallet.com',
      full_name: 'Aurela Administrator',
      phone: '',
      role: 'super_admin',
      status: 'active',
      preferred_currency: 'USD',
      kyc_status: 'approved',
      two_fa_enabled: false,
      email_verified: true,
      phone_verified: true,
      auth_providers: ['password'],
      salt, password_hash: hashPassword('Aurela@123#', salt),
      created_at: now(),
    }
    await db.collection('users').insertOne(admin)
    await createWalletsForUser(db, admin.id)
  }
  // seed platform settings if empty
  const setting = await db.collection('settings').findOne({ id: 'platform' })
  if (!setting) {
    await db.collection('settings').insertOne({
      id: 'platform',
      card_activation_wallet: 'TLgjfeg8Mqw5ueo1CGC8eTb4EHysPMMA6S',
      card_activation_network: 'TRC20',
      card_activation_fees: { basic: 10, premium: 50, elite: 200 },
      enabled_fiat: FIAT,
      enabled_crypto: CRYPTO,
      maintenance_mode: false,
      updated_at: now(),
    })
  }
  // seed platform wallets (real receive addresses)
  const walletCount = await db.collection('platform_wallets').countDocuments({})
  if (walletCount === 0) {
    const seedWallets = [
      { asset: 'BTC',   network: 'Bitcoin', address: '14J6KfQzXyLV8gLUKMWch2S3hjJvkMy5Rc' },
      { asset: 'ETH',   network: 'ERC20',   address: '0x09B0E6D01fb1DeDf172933cC1673aAf460353AAD' },
      { asset: 'USDT',  network: 'ERC20',   address: '0xa7b97439665f545adb3bbc431ceb5053d4b46f49' },
      { asset: 'USDT',  network: 'BEP20',   address: '0xa7b97439665f545adb3bbc431ceb5053d4b46f49' },
      { asset: 'USDT',  network: 'TRC20',   address: 'TLgjfeg8Mqw5ueo1CGC8eTb4EHysPMMA6S' },
      { asset: 'USDC',  network: 'ERC20',   address: '0x09B0E6D01fb1DeDf172933cC1673aAf460353AAD' },
      { asset: 'BNB',   network: 'BEP20',   address: '0xa7b97439665f545adb3bbc431ceb5053d4b46f49' },
      { asset: 'SOL',   network: 'Solana',  address: 'FQy4HArVdBbZ87AHrbfdhSXRgyE5NUbrh6GaL8enMUeh' },
    ]
    await db.collection('platform_wallets').insertMany(seedWallets.map(w => ({ id: uuidv4(), ...w, enabled: true, created_at: now() })))
  }
}

async function createWalletsForUser(db, userId) {
  const fiatWallets = FIAT.map(code => ({
    id: uuidv4(), user_id: userId, type: 'fiat', currency: code,
    balance: 0,
    pending: 0, created_at: now()
  }))
  const cryptoWallets = CRYPTO.map(code => ({
    id: uuidv4(), user_id: userId, type: 'crypto', currency: code,
    balance: 0,
    pending: 0,
    address: generateMockAddress(code),
    networks: CRYPTO_NETWORKS[code] || ['ERC20'],
    created_at: now()
  }))
  await db.collection('wallets').insertMany([...fiatWallets, ...cryptoWallets])
}

function generateMockAddress(code) {
  const rand = crypto.randomBytes(20).toString('hex')
  if (code === 'BTC') return 'bc1q' + rand.slice(0,38)
  if (code === 'SOL') return rand.slice(0,44)
  if (code === 'XRP') return 'r' + rand.slice(0,32)
  if (code === 'ADA') return 'addr1' + rand.slice(0,50)
  return '0x' + rand.slice(0,40)
}

// ---------- Rates (cached) ----------
async function getRates(db) {
  const cached = await db.collection('rates').findOne({ id: 'live' })
  const stale = !cached || (Date.now() - new Date(cached.updated_at).getTime() > 30 * 1000)
  if (!stale) return cached

  let fx = { ...FALLBACK_FX }
  let crypto_usd = { ...FALLBACK_CRYPTO_USD }
  try {
    // Coinbase exchange rates — single call for both fiat and crypto (public, no key)
    const cbRes = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', { cache: 'no-store' })
    if (cbRes.ok) {
      const j = await cbRes.json()
      const r = j?.data?.rates || {}
      // Fiat: rate value = USD -> that currency directly
      for (const c of FIAT) {
        if (r[c]) {
          const v = Number(r[c])
          if (v && isFinite(v)) fx[c] = v
        }
      }
      // Crypto: rate value = 1 USD = X crypto, so price_usd = 1 / rate
      for (const c of CRYPTO) {
        if (r[c]) {
          const v = Number(r[c])
          if (v && isFinite(v) && v > 0) crypto_usd[c] = 1 / v
        }
      }
      crypto_usd.USDT = 1; crypto_usd.USDC = 1
    }
  } catch (e) { /* keep fallback */ }
  // Secondary source for FIAT only (in case Coinbase misses exotic currencies)
  try {
    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
    if (fxRes.ok) {
      const j = await fxRes.json()
      if (j && j.rates) {
        for (const c of FIAT) if (j.rates[c] && !fx[c]) fx[c] = j.rates[c]
      }
    }
  } catch (e) { /* keep fallback */ }

  const doc = { id: 'live', fx, crypto_usd, updated_at: now() }
  await db.collection('rates').updateOne({ id: 'live' }, { $set: doc }, { upsert: true })
  return doc
}

function convertToUSD(amount, currency, rates) {
  if (FIAT.includes(currency)) return amount / (rates.fx[currency] || 1)
  if (CRYPTO.includes(currency)) return amount * (rates.crypto_usd[currency] || 0)
  return 0
}
function convertUSDTo(usd, currency, rates) {
  if (currency === 'USD') return usd
  if (FIAT.includes(currency)) return usd * (rates.fx[currency] || 1)
  if (CRYPTO.includes(currency)) return usd / (rates.crypto_usd[currency] || 1)
  return 0
}

// ---------- Route Handler ----------
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method
  try {
    const db = await connectToMongo()

    // ---------- Public ----------
    if (route === '/' && method === 'GET') return handleCORS(NextResponse.json({ ok: true, app: 'Aurela' }))
    if (route === '/health' && method === 'GET') return handleCORS(NextResponse.json({ ok: true }))

    if (route === '/rates' && method === 'GET') {
      const r = await getRates(db)
      return handleCORS(NextResponse.json({ fx: r.fx, crypto_usd: r.crypto_usd, updated_at: r.updated_at }))
    }

    if (route === '/config' && method === 'GET') {
      const s = await db.collection('settings').findOne({ id: 'platform' })
      const platformWallets = await db.collection('platform_wallets').find({ enabled: true }).toArray()
      return handleCORS(NextResponse.json({
        fiat: FIAT, crypto: CRYPTO, networks: CRYPTO_NETWORKS,
        card_tiers: CARD_TIERS,
        activation_wallet: s?.card_activation_wallet,
        activation_network: s?.card_activation_network,
        activation_fees: s?.card_activation_fees,
        platform_wallets: clean(platformWallets),
      }))
    }

    // ---------- Auth ----------
    if (route === '/auth/register/init' && method === 'POST') {
      const body = await request.json()
      const { email, username, password, full_name, phone } = body || {}
      if (!email || !username || !password) return handleCORS(NextResponse.json({ error: 'Missing fields' }, { status: 400 }))
      if (password.length < 8) return handleCORS(NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 }))
      const exists = await db.collection('users').findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] })
      if (exists) return handleCORS(NextResponse.json({ error: 'Email or username already registered' }, { status: 400 }))
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const otpDoc = {
        id: uuidv4(),
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        full_name: full_name || username,
        phone: phone || '',
        password_hash_pending: null,
        salt_pending: null,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        purpose: 'signup',
        created_at: now(),
      }
      const salt = newSalt()
      otpDoc.salt_pending = salt
      otpDoc.password_hash_pending = hashPassword(password, salt)
      await db.collection('pending_signups').deleteMany({ email: email.toLowerCase() })
      await db.collection('pending_signups').insertOne(otpDoc)
      const emailRes = await sendEmailOTP(email, code, 'signup')
      const response = { ok: true, message: 'Verification code sent to your email.', signup_id: otpDoc.id }
      if (!emailRes.delivered) response.dev_otp = code // TODO remove after wiring email service
      return handleCORS(NextResponse.json(response))
    }

    if (route === '/auth/register/verify' && method === 'POST') {
      const body = await request.json()
      const { signup_id, email, code } = body || {}
      const query = signup_id ? { id: signup_id } : { email: (email || '').toLowerCase() }
      const pending = await db.collection('pending_signups').findOne(query)
      if (!pending) return handleCORS(NextResponse.json({ error: 'No pending signup found. Request a new code.' }, { status: 404 }))
      if (new Date(pending.expires_at) < new Date()) {
        await db.collection('pending_signups').deleteOne({ id: pending.id })
        return handleCORS(NextResponse.json({ error: 'Verification code expired. Request a new one.' }, { status: 400 }))
      }
      if (String(code) !== String(pending.code)) return handleCORS(NextResponse.json({ error: 'Invalid verification code' }, { status: 400 }))
      const user = {
        id: uuidv4(),
        email: pending.email,
        username: pending.username,
        full_name: pending.full_name,
        phone: pending.phone,
        role: 'user',
        status: 'active',
        preferred_currency: 'USD',
        kyc_status: 'unverified',
        two_fa_enabled: false,
        email_verified: true,
        phone_verified: false,
        auth_providers: ['password'],
        salt: pending.salt_pending,
        password_hash: pending.password_hash_pending,
        created_at: now(),
      }
      await db.collection('users').insertOne(user)
      await createWalletsForUser(db, user.id)
      await db.collection('pending_signups').deleteOne({ id: pending.id })
      const token = newToken()
      await db.collection('sessions').insertOne({ token, user_id: user.id, created_at: now(), expires_at: new Date(Date.now() + 1000*60*60*24*30) })
      await audit(db, user.id, 'user.register', { email: user.email, provider: 'password' })
      return handleCORS(NextResponse.json({ token, user: clean(user) }))
    }

    if (route === '/auth/register/resend' && method === 'POST') {
      const body = await request.json()
      const { email } = body || {}
      const pending = await db.collection('pending_signups').findOne({ email: (email || '').toLowerCase() })
      if (!pending) return handleCORS(NextResponse.json({ error: 'No pending signup' }, { status: 404 }))
      const code = String(Math.floor(100000 + Math.random() * 900000))
      await db.collection('pending_signups').updateOne({ id: pending.id }, { $set: { code, expires_at: new Date(Date.now() + 10 * 60 * 1000) } })
      const emailRes = await sendEmailOTP(pending.email, code, 'signup')
      const response = { ok: true }
      if (!emailRes.delivered) response.dev_otp = code
      return handleCORS(NextResponse.json(response))
    }

    // Google Sign-In (accepts either an id_token 'credential' OR an OAuth2 'access_token')
    if (route === '/auth/google' && method === 'POST') {
      const body = await request.json()
      const { credential, access_token } = body || {}
      if (!credential && !access_token) return handleCORS(NextResponse.json({ error: 'Missing Google credential' }, { status: 400 }))
      if (!process.env.GOOGLE_CLIENT_ID) {
        console.error('[Google] GOOGLE_CLIENT_ID env variable not set')
        return handleCORS(NextResponse.json({ error: 'Google sign-in is not configured on this server (missing GOOGLE_CLIENT_ID).' }, { status: 500 }))
      }
      let payload
      try {
        if (credential) {
          // GSI id_token flow — verify JWT signature via google-auth-library
          const { OAuth2Client } = await import('google-auth-library')
          const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
          const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID })
          payload = ticket.getPayload()
        } else {
          // Implicit OAuth2 access_token flow — fetch userinfo from Google
          const uiRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
          })
          if (!uiRes.ok) {
            const t = await uiRes.text()
            console.error('[Google] userinfo failed', uiRes.status, t)
            return handleCORS(NextResponse.json({ error: 'Google sign-in rejected the access token.' }, { status: 401 }))
          }
          payload = await uiRes.json()
          // Normalise: google id in `sub`, email verified in `email_verified`
        }
      } catch (e) {
        console.error('[Google] verify failed', e?.message, e?.stack)
        return handleCORS(NextResponse.json({ error: 'Invalid Google credential — ' + (e?.message || 'unknown error') }, { status: 401 }))
      }
      if (!payload || !payload.email) return handleCORS(NextResponse.json({ error: 'Google did not return an email for this account.' }, { status: 401 }))
      if (payload.email_verified === false) return handleCORS(NextResponse.json({ error: 'Google email not verified' }, { status: 403 }))
      const email = payload.email.toLowerCase()
      let existing = await db.collection('users').findOne({ email })
      let user
      if (!existing) {
        const baseUsername = (email.split('@')[0] || 'aurela_user').replace(/[^a-z0-9_]/g,'').slice(0, 20) || 'aurela_user'
        let username = baseUsername
        let suffix = 1
        while (await db.collection('users').findOne({ username })) { username = baseUsername + suffix; suffix++ }
        user = {
          id: uuidv4(), email, username,
          full_name: payload.name || username, phone: '',
          role: 'user', status: 'active', preferred_currency: 'USD',
          kyc_status: 'unverified', two_fa_enabled: false,
          email_verified: true, phone_verified: false,
          auth_providers: ['google'], google_id: payload.sub, avatar: payload.picture || '',
          salt: null, password_hash: null, created_at: now(),
        }
        await db.collection('users').insertOne(user)
        await createWalletsForUser(db, user.id)
        await audit(db, user.id, 'user.register', { email, provider: 'google' })
      } else {
        if (existing.status === 'blocked') return handleCORS(NextResponse.json({ error: 'Account blocked' }, { status: 403 }))
        const providers = Array.isArray(existing.auth_providers) ? existing.auth_providers : []
        const upd = {}
        if (!providers.includes('google')) upd.auth_providers = [...providers, 'google']
        if (!existing.google_id) upd.google_id = payload.sub
        if (!existing.avatar && payload.picture) upd.avatar = payload.picture
        if (Object.keys(upd).length) await db.collection('users').updateOne({ id: existing.id }, { $set: upd })
        user = { ...existing, ...upd }
      }
      const token = newToken()
      await db.collection('sessions').insertOne({ token, user_id: user.id, created_at: now(), expires_at: new Date(Date.now() + 1000*60*60*24*30) })
      await audit(db, user.id, 'user.login', { provider: 'google' })
      return handleCORS(NextResponse.json({ token, user: clean(user) }))
    }


    // Legacy single-step register (kept for admin bootstrap only — always requires OTP in production)
    if (route === '/auth/register' && method === 'POST') {
      return handleCORS(NextResponse.json({ error: 'Direct registration disabled. Use /auth/register/init then /auth/register/verify.' }, { status: 400 }))
    }

    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const { identifier, password, totp } = body || {}
      if (!identifier || !password) return handleCORS(NextResponse.json({ error: 'Missing fields' }, { status: 400 }))
      const id = String(identifier).toLowerCase()
      const user = await db.collection('users').findOne({ $or: [{ email: id }, { username: id }] })
      if (!user) return handleCORS(NextResponse.json({ error: 'Invalid credentials' }, { status: 401 }))
      if (user.status === 'blocked') return handleCORS(NextResponse.json({ error: 'Account blocked' }, { status: 403 }))
      if (!user.password_hash) return handleCORS(NextResponse.json({ error: 'This account uses Google Sign-In. Please use "Continue with Google".' }, { status: 400 }))
      if (hashPassword(password, user.salt) !== user.password_hash) return handleCORS(NextResponse.json({ error: 'Invalid credentials' }, { status: 401 }))
      if (user.two_fa_enabled && user.two_fa_secret) {
        if (!totp) return handleCORS(NextResponse.json({ error: '2FA code required', requires_2fa: true }, { status: 401 }))
        const otp = await import('otplib')
        const res = otp.verifySync({ secret: user.two_fa_secret, token: String(totp).replace(/\s/g,''), window: 1 })
        if (!res?.valid) return handleCORS(NextResponse.json({ error: 'Invalid 2FA code', requires_2fa: true }, { status: 401 }))
      }
      const token = newToken()
      await db.collection('sessions').insertOne({ token, user_id: user.id, created_at: now(), expires_at: new Date(Date.now() + 1000*60*60*24*30) })
      await audit(db, user.id, 'user.login', {})
      return handleCORS(NextResponse.json({ token, user: clean(user) }))
    }

    if (route === '/auth/me' && method === 'GET') {
      const user = await getUserByToken(db, request)
      if (!user) return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      return handleCORS(NextResponse.json({ user: clean(user) }))
    }

    if (route === '/auth/logout' && method === 'POST') {
      const auth = request.headers.get('authorization') || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
      if (token) await db.collection('sessions').deleteOne({ token })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // ---------- Aurela Chain ----------
    if (route === '/chain' && method === 'GET') {
      const url = new URL(request.url)
      const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)
      const blocks = await db.collection('aurela_chain').find({}).sort({ block_number: -1 }).limit(limit).toArray()
      const total = await db.collection('aurela_chain').countDocuments({})
      return handleCORS(NextResponse.json({ blocks: clean(blocks), total }))
    }
    if (route === '/chain/mine' && method === 'GET') {
      const blocks = await db.collection('aurela_chain').find({
        $or: [{ from_user_id: user.id }, { to_user_id: user.id }]
      }).sort({ block_number: -1 }).limit(100).toArray()
      return handleCORS(NextResponse.json({ blocks: clean(blocks) }))
    }

    // ---------- Authenticated ----------
    const user = await getUserByToken(db, request)
    if (!user) return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    // 2FA setup: returns a fresh secret + otpauth uri + qr svg
    if (route === '/profile/2fa/setup' && method === 'POST') {
      const otp = await import('otplib')
      const QRCode = (await import('qrcode')).default
      const secret = otp.generateSecret()
      const label = encodeURIComponent(`Aurela:${user.email}`)
      const issuer = encodeURIComponent('Aurela Wallet')
      const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&period=30&digits=6&algorithm=SHA1`
      const qr_svg = await QRCode.toString(uri, { type: 'svg', margin: 1, color: { dark: '#d4af37', light: '#00000000' }, width: 220 })
      // store secret as pending until confirmed
      await db.collection('users').updateOne({ id: user.id }, { $set: { two_fa_pending_secret: secret } })
      return handleCORS(NextResponse.json({ secret, uri, qr_svg }))
    }
    if (route === '/profile/2fa/enable' && method === 'POST') {
      const body = await request.json()
      const code = String(body?.code || '').replace(/\s/g,'')
      const u2 = await db.collection('users').findOne({ id: user.id })
      const secret = u2?.two_fa_pending_secret
      if (!secret) return handleCORS(NextResponse.json({ error: 'Start setup first' }, { status: 400 }))
      const otp = await import('otplib')
      const res = otp.verifySync({ secret, token: code, window: 1 })
      if (!res?.valid) return handleCORS(NextResponse.json({ error: 'Invalid code' }, { status: 400 }))
      await db.collection('users').updateOne({ id: user.id }, { $set: { two_fa_enabled: true, two_fa_secret: secret }, $unset: { two_fa_pending_secret: '' } })
      await audit(db, user.id, 'profile.2fa.enable', {})
      return handleCORS(NextResponse.json({ ok: true }))
    }
    if (route === '/profile/2fa/disable' && method === 'POST') {
      const body = await request.json()
      const code = String(body?.code || '').replace(/\s/g,'')
      const u2 = await db.collection('users').findOne({ id: user.id })
      if (!u2?.two_fa_enabled) return handleCORS(NextResponse.json({ error: 'Not enabled' }, { status: 400 }))
      const otp = await import('otplib')
      const res = otp.verifySync({ secret: u2.two_fa_secret, token: code, window: 1 })
      if (!res?.valid) return handleCORS(NextResponse.json({ error: 'Invalid code' }, { status: 400 }))
      await db.collection('users').updateOne({ id: user.id }, { $set: { two_fa_enabled: false }, $unset: { two_fa_secret: '', two_fa_pending_secret: '' } })
      await audit(db, user.id, 'profile.2fa.disable', {})
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // QR code for user's Aurela payment ID
    if (route === '/profile/qr' && method === 'GET') {
      const QRCode = (await import('qrcode')).default
      const url = new URL(request.url)
      const currency = url.searchParams.get('currency') || ''
      const amount = url.searchParams.get('amount') || ''
      const params = new URLSearchParams({ to: user.username })
      if (currency) params.set('currency', currency)
      if (amount) params.set('amount', amount)
      const payload = `aurela://transfer?${params.toString()}`
      const qr_svg = await QRCode.toString(payload, { type: 'svg', margin: 1, color: { dark: '#d4af37', light: '#00000000' }, width: 260 })
      return handleCORS(NextResponse.json({ payload, qr_svg, username: user.username }))
    }

    // Profile
    if (route === '/profile' && method === 'PUT') {
      const body = await request.json()
      const upd = {}
      for (const k of ['full_name','phone','preferred_currency','two_fa_enabled','avatar','address','country','city','postal_code','date_of_birth']) if (k in body) upd[k] = body[k]
      if (upd.preferred_currency && !FIAT.includes(upd.preferred_currency)) return handleCORS(NextResponse.json({ error: 'Invalid currency' }, { status: 400 }))
      // Avatar size guard (base64 length ~4/3 * bytes)
      if (upd.avatar && typeof upd.avatar === 'string' && upd.avatar.length > 3_000_000) return handleCORS(NextResponse.json({ error: 'Profile picture is too large (max ~2MB).' }, { status: 400 }))
      await db.collection('users').updateOne({ id: user.id }, { $set: upd })
      const u2 = await db.collection('users').findOne({ id: user.id })
      await audit(db, user.id, 'profile.update', { keys: Object.keys(upd) })
      return handleCORS(NextResponse.json({ user: clean(u2) }))
    }

    // KYC — accepts extended fields (first_name, last_name, mobile, country, doc_type, doc_data base64)
    if (route === '/kyc' && method === 'POST') {
      const body = await request.json()
      const fullName = body.full_name || [body.first_name, body.last_name].filter(Boolean).join(' ').trim() || user.full_name
      const doc = {
        id: uuidv4(), user_id: user.id,
        first_name: body.first_name || '',
        last_name: body.last_name || '',
        full_name: fullName,
        dob: body.dob || '',
        country: body.country || '',
        state: body.state || '',
        city: body.city || '',
        address: body.address || '',
        postal_code: body.postal_code || '',
        mobile: body.mobile || body.phone || '',
        occupation: body.occupation || '',
        id_type: body.id_type || 'passport',
        id_number: body.id_number || '',
        doc_front: body.doc_front || '',   // base64 data URI
        doc_back: body.doc_back || '',     // base64 data URI
        selfie: body.selfie || '',         // base64 data URI (optional)
        status: 'pending',
        submitted_at: now()
      }
      await db.collection('kyc').insertOne(doc)
      const userUpd = { kyc_status: 'pending' }
      if (body.mobile || body.phone) userUpd.phone = body.mobile || body.phone
      if (fullName && fullName !== user.full_name) userUpd.full_name = fullName
      await db.collection('users').updateOne({ id: user.id }, { $set: userUpd })
      await audit(db, user.id, 'kyc.submit', { id_type: doc.id_type, country: doc.country })
      return handleCORS(NextResponse.json({ ok: true, kyc: clean(doc) }))
    }

    // Wallets
    if (route === '/wallets' && method === 'GET') {
      const wallets = await db.collection('wallets').find({ user_id: user.id }).toArray()
      const rates = await getRates(db)
      const enriched = wallets.map(w => ({
        ...clean(w),
        locked: w.locked || 0,
        available_balance: (w.balance || 0),  // balance is already post-lock; locked is informational
        balance_usd: convertToUSD(w.balance, w.currency, rates),
        preferred_value: convertUSDTo(convertToUSD(w.balance, w.currency, rates), user.preferred_currency, rates),
      }))
      const totalUSD = enriched.reduce((s,w)=> s + (w.balance_usd || 0), 0)
      const totalPreferred = convertUSDTo(totalUSD, user.preferred_currency, rates)
      return handleCORS(NextResponse.json({
        wallets: enriched,
        totals: { usd: totalUSD, preferred: totalPreferred, preferred_currency: user.preferred_currency }
      }))
    }

    // Transactions
    if (route === '/transactions' && method === 'GET') {
      const txs = await db.collection('transactions').find({
        $or: [{ from_user_id: user.id }, { to_user_id: user.id }, { user_id: user.id }]
      }).sort({ created_at: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ transactions: clean(txs) }))
    }

    // Internal Transfer
    if (route === '/transfer' && method === 'POST') {
      const body = await request.json()
      const { recipient, amount, currency, note } = body || {}
      const amt = Number(amount)
      if (!recipient || !amt || amt <= 0 || !currency) return handleCORS(NextResponse.json({ error: 'Invalid transfer' }, { status: 400 }))
      if (![...FIAT, ...CRYPTO].includes(currency)) return handleCORS(NextResponse.json({ error: 'Unsupported currency' }, { status: 400 }))
      const rid = String(recipient).toLowerCase()
      const rec = await db.collection('users').findOne({ $or: [{ email: rid }, { username: rid }, { id: recipient }] })
      if (!rec) return handleCORS(NextResponse.json({ error: 'Recipient not found' }, { status: 404 }))
      if (rec.id === user.id) return handleCORS(NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 }))
      if (rec.status === 'blocked' || rec.status === 'frozen') return handleCORS(NextResponse.json({ error: 'Recipient account not available' }, { status: 400 }))
      const senderWallet = await db.collection('wallets').findOne({ user_id: user.id, currency })
      const recipWallet = await db.collection('wallets').findOne({ user_id: rec.id, currency })
      if (!senderWallet || senderWallet.balance < amt) return handleCORS(NextResponse.json({ error: 'Insufficient balance' }, { status: 400 }))
      if (!recipWallet) return handleCORS(NextResponse.json({ error: 'Recipient wallet missing' }, { status: 400 }))
      await db.collection('wallets').updateOne({ id: senderWallet.id }, { $inc: { balance: -amt } })
      await db.collection('wallets').updateOne({ id: recipWallet.id }, { $inc: { balance: amt } })
      const tx = {
        id: uuidv4(), type: 'internal_transfer', currency, amount: amt,
        from_user_id: user.id, to_user_id: rec.id,
        from_username: user.username, to_username: rec.username,
        note: note || '', status: 'completed', created_at: now()
      }
      await db.collection('transactions').insertOne(tx)
      const block = await writeBlock(db, {
        type: 'transfer', tx_id: tx.id, currency, amount: amt, network: 'AURELA',
        from_user_id: user.id, to_user_id: rec.id, from_username: user.username, to_username: rec.username,
      })
      await audit(db, user.id, 'transfer.internal', { to: rec.username, amount: amt, currency, block: block.block_number })
      return handleCORS(NextResponse.json({ ok: true, transaction: clean(tx), block: clean(block) }))
    }

    // Helper: KYC gate
    const requireKyc = () => user.kyc_status !== 'approved'

    // Deposit (creates pending request — admin must approve)
    if (route === '/deposit' && method === 'POST') {
      if (requireKyc()) return handleCORS(NextResponse.json({ error: 'Identity verification required before you can deposit.', code: 'KYC_REQUIRED' }, { status: 403 }))
      const body = await request.json()
      const { method: pm, amount, currency, note, tx_hash, network, details } = body || {}
      const amt = Number(amount)
      if (!amt || amt <= 0 || !currency) return handleCORS(NextResponse.json({ error: 'Invalid deposit' }, { status: 400 }))
      if (![...FIAT, ...CRYPTO].includes(currency)) return handleCORS(NextResponse.json({ error: 'Unsupported currency' }, { status: 400 }))
      const req = {
        id: uuidv4(), type: 'deposit_request', method: pm || 'bank', currency, amount: amt,
        user_id: user.id, username: user.username, from_username: pm || 'external', to_username: user.username,
        tx_hash: tx_hash || '', note: note || '', network: network || '', details: details || {},
        status: 'pending', created_at: now()
      }
      await db.collection('deposit_requests').insertOne(req)
      await audit(db, user.id, 'deposit.request', { method: pm, amount: amt, currency })
      return handleCORS(NextResponse.json({ ok: true, message: 'Deposit request submitted. It will be credited after admin verification.', request: clean(req) }))
    }

    // Withdraw (creates pending request — admin must approve; still requires KYC + active card)
    if (route === '/withdraw' && method === 'POST') {
      if (requireKyc()) return handleCORS(NextResponse.json({ error: 'Identity verification required before you can withdraw.', code: 'KYC_REQUIRED' }, { status: 403 }))
      const body = await request.json()
      const { method: pm, amount, currency, destination, network, details } = body || {}
      const amt = Number(amount)
      if (!amt || amt <= 0 || !currency) return handleCORS(NextResponse.json({ error: 'Invalid withdraw' }, { status: 400 }))
      if (![...FIAT, ...CRYPTO].includes(currency)) return handleCORS(NextResponse.json({ error: 'Unsupported currency' }, { status: 400 }))
      const cardOk = await hasActiveCard(db, user.id)
      if (!cardOk) return handleCORS(NextResponse.json({ error: 'Card activation required. External withdrawals are enabled only after you activate an Aurela card.', code: 'CARD_REQUIRED' }, { status: 403 }))
      const wallet = await db.collection('wallets').findOne({ user_id: user.id, currency })
      if (!wallet || (wallet.balance - (wallet.locked || 0)) < amt) return handleCORS(NextResponse.json({ error: 'Insufficient balance' }, { status: 400 }))
      // Lock funds on the wallet until admin approves/rejects
      await db.collection('wallets').updateOne({ id: wallet.id }, { $inc: { balance: -amt, locked: amt } })
      const wreq = {
        id: uuidv4(), type: 'withdraw_request', method: pm || (CRYPTO.includes(currency) ? 'crypto' : 'bank'),
        currency, amount: amt, user_id: user.id, username: user.username,
        destination: destination || '', network: network || '', details: details || {},
        wallet_id: wallet.id, status: 'pending', created_at: now()
      }
      await db.collection('withdraw_requests').insertOne(wreq)
      await audit(db, user.id, 'withdraw.request', { method: pm, amount: amt, currency })
      return handleCORS(NextResponse.json({ ok: true, message: 'Withdrawal request submitted. Funds are held on your account until admin approval.', request: clean(wreq) }))
    }

    // Cards
    if (route === '/cards' && method === 'GET') {
      // Auto-flip cards whose 24h activation window has elapsed
      const nowTs = Date.now()
      const dueCards = await db.collection('cards').find({ user_id: user.id, status: 'activating', usable_at: { $lte: new Date(nowTs) } }).toArray()
      if (dueCards.length) {
        await db.collection('cards').updateMany({ id: { $in: dueCards.map(c=>c.id) } }, { $set: { status: 'active', activated_at: now() } })
      }
      const cards = await db.collection('cards').find({ user_id: user.id, status: { $ne: 'deleted' } }).sort({ created_at: -1 }).toArray()
      return handleCORS(NextResponse.json({ cards: clean(cards) }))
    }
    if (route === '/cards/request' && method === 'POST') {
      if (requireKyc()) return handleCORS(NextResponse.json({ error: 'Identity verification required to request a card.', code: 'KYC_REQUIRED' }, { status: 403 }))
      const body = await request.json()
      const tier = (body?.tier || 'basic').toLowerCase()
      if (!CARD_TIERS[tier]) return handleCORS(NextResponse.json({ error: 'Invalid tier' }, { status: 400 }))
      // Enforce: max 3 cards per user (one per tier), non-deleted only
      const existingCards = await db.collection('cards').find({ user_id: user.id, status: { $ne: 'deleted' } }).toArray()
      if (existingCards.length >= 3) return handleCORS(NextResponse.json({ error: 'You already hold the maximum of 3 Aurela cards. Delete one to request another.' }, { status: 400 }))
      if (existingCards.some(c => c.tier === tier)) return handleCORS(NextResponse.json({ error: `You already have an Aurela ${tier} card. Only one card per tier is permitted.` }, { status: 400 }))
      const settings = await db.collection('settings').findOne({ id: 'platform' })
      const fee = settings?.card_activation_fees?.[tier] ?? CARD_TIERS[tier].activation_fee_usdt
      const card = {
        id: uuidv4(), user_id: user.id, tier, tier_name: CARD_TIERS[tier].name,
        number: fmtCardNumber(), expiry: cardExpiry(), cvv: randDigits(3),
        holder: (user.full_name || user.username).toUpperCase(),
        status: 'pending_activation', frozen: false,
        daily_spend_limit: CARD_TIERS[tier].daily_spend,
        daily_withdraw_limit: CARD_TIERS[tier].daily_withdraw,
        monthly_spend_limit: CARD_TIERS[tier].monthly_spend,
        activation_fee_usdt: fee,
        activation_wallet: settings?.card_activation_wallet,
        activation_network: settings?.card_activation_network || 'ERC20',
        created_at: now()
      }
      await db.collection('cards').insertOne(card)
      await audit(db, user.id, 'card.request', { tier })
      return handleCORS(NextResponse.json({ card: clean(card) }))
    }
    // User deletes their own card (must reapply + repay fee to get another of the same tier)
    if (route.startsWith('/cards/') && method === 'DELETE') {
      const cardId = route.split('/')[2]
      const card = await db.collection('cards').findOne({ id: cardId, user_id: user.id })
      if (!card) return handleCORS(NextResponse.json({ error: 'Card not found' }, { status: 404 }))
      await db.collection('cards').updateOne({ id: cardId }, { $set: { status: 'deleted', deleted_at: now(), frozen: true } })
      await audit(db, user.id, 'card.delete', { card_id: cardId, tier: card.tier })
      return handleCORS(NextResponse.json({ ok: true, message: 'Card deleted. You may request a new one — the activation fee will need to be paid again.' }))
    }
    if (route.startsWith('/cards/') && route.endsWith('/activate') && method === 'POST') {
      if (requireKyc()) return handleCORS(NextResponse.json({ error: 'Identity verification required to activate a card.', code: 'KYC_REQUIRED' }, { status: 403 }))
      const cardId = route.split('/')[2]
      const body = await request.json()
      const { tx_hash, network } = body || {}
      const card = await db.collection('cards').findOne({ id: cardId, user_id: user.id })
      if (!card) return handleCORS(NextResponse.json({ error: 'Card not found' }, { status: 404 }))
      if (card.status === 'active') return handleCORS(NextResponse.json({ error: 'Already active' }, { status: 400 }))
      if (!tx_hash || tx_hash.length < 8) return handleCORS(NextResponse.json({ error: 'A valid on-chain USDT transaction hash is required.' }, { status: 400 }))
      await db.collection('cards').updateOne({ id: card.id }, { $set: { status: 'pending_verification', activation_tx_hash: tx_hash, activation_network_used: network || card.activation_network, activation_submitted_at: now() } })
      await audit(db, user.id, 'card.activate.submit', { card_id: card.id, tx_hash, network })
      const upd = await db.collection('cards').findOne({ id: card.id })
      return handleCORS(NextResponse.json({ card: clean(upd), message: 'Transaction hash submitted. Card will be activated after on-chain verification by admin.' }))
    }
    if (route.startsWith('/cards/') && route.endsWith('/freeze') && method === 'POST') {
      const cardId = route.split('/')[2]
      const body = await request.json()
      await db.collection('cards').updateOne({ id: cardId, user_id: user.id }, { $set: { frozen: !!body.frozen } })
      const upd = await db.collection('cards').findOne({ id: cardId, user_id: user.id })
      await audit(db, user.id, 'card.freeze', { card_id: cardId, frozen: !!body.frozen })
      return handleCORS(NextResponse.json({ card: clean(upd) }))
    }

    // ---------- Admin ----------
    if (route.startsWith('/admin/')) {
      if (user.role !== 'admin' && user.role !== 'super_admin') return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const isSuper = user.role === 'super_admin'

      // Super-admin only: promote / demote roles
      if (route.startsWith('/admin/users/') && route.endsWith('/role') && method === 'POST') {
        if (!isSuper) return handleCORS(NextResponse.json({ error: 'Super admin only' }, { status: 403 }))
        const targetId = route.split('/')[3]
        const body = await request.json()
        const newRole = body.role
        if (!['user','admin','super_admin'].includes(newRole)) return handleCORS(NextResponse.json({ error: 'Invalid role' }, { status: 400 }))
        await db.collection('users').updateOne({ id: targetId }, { $set: { role: newRole } })
        await audit(db, user.id, 'admin.user.role', { target: targetId, role: newRole })
        return handleCORS(NextResponse.json({ ok: true }))
      }

      if (route === '/admin/overview' && method === 'GET') {
        const [users, txs, cards, kyc, dw, ww] = await Promise.all([
          db.collection('users').countDocuments({}),
          db.collection('transactions').countDocuments({}),
          db.collection('cards').countDocuments({ status: { $ne: 'deleted' } }),
          db.collection('kyc').countDocuments({ status: 'pending' }),
          db.collection('deposit_requests').countDocuments({ status: 'pending' }),
          db.collection('withdraw_requests').countDocuments({ status: 'pending' }),
        ])
        return handleCORS(NextResponse.json({
          users, transactions: txs, cards, kyc_pending: kyc,
          deposits_pending: dw, withdrawals_pending: ww
        }))
      }
      if (route === '/admin/users' && method === 'GET') {
        const url = new URL(request.url)
        const q = url.searchParams.get('q') || ''
        const filter = q ? { $or: [
          { email: { $regex: q, $options: 'i' } },
          { username: { $regex: q, $options: 'i' } },
          { full_name: { $regex: q, $options: 'i' } }
        ]} : {}
        const users = await db.collection('users').find(filter).sort({ created_at: -1 }).limit(200).toArray()
        return handleCORS(NextResponse.json({ users: clean(users) }))
      }
      if (route.startsWith('/admin/users/') && method === 'POST') {
        const parts = route.split('/')
        const targetId = parts[3]
        const action = parts[4]
        const target = await db.collection('users').findOne({ id: targetId })
        if (!target) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
        if (action === 'freeze') await db.collection('users').updateOne({ id: targetId }, { $set: { status: 'frozen' } })
        else if (action === 'unfreeze') await db.collection('users').updateOne({ id: targetId }, { $set: { status: 'active' } })
        else if (action === 'block') await db.collection('users').updateOne({ id: targetId }, { $set: { status: 'blocked' } })
        else if (action === 'unblock') await db.collection('users').updateOne({ id: targetId }, { $set: { status: 'active' } })
        else if (action === 'delete') {
          await db.collection('users').deleteOne({ id: targetId })
          await db.collection('wallets').deleteMany({ user_id: targetId })
          await db.collection('cards').deleteMany({ user_id: targetId })
          await db.collection('sessions').deleteMany({ user_id: targetId })
        } else if (action === 'adjust') {
          const body = await request.json()
          const { currency, amount, kind } = body || {} // kind: credit | debit
          const amt = Number(amount)
          const w = await db.collection('wallets').findOne({ user_id: targetId, currency })
          if (!w) return handleCORS(NextResponse.json({ error: 'Wallet not found' }, { status: 400 }))
          const delta = kind === 'debit' ? -Math.abs(amt) : Math.abs(amt)
          await db.collection('wallets').updateOne({ id: w.id }, { $inc: { balance: delta } })
          await db.collection('transactions').insertOne({
            id: uuidv4(), type: 'admin_adjustment', currency, amount: delta,
            user_id: targetId, from_username: 'aurela_admin', to_username: target.username,
            status: 'completed', created_at: now()
          })
        }
        await audit(db, user.id, `admin.user.${action}`, { target: targetId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (route === '/admin/kyc' && method === 'GET') {
        const list = await db.collection('kyc').find({}).sort({ submitted_at: -1 }).toArray()
        return handleCORS(NextResponse.json({ kyc: clean(list) }))
      }
      if (route.startsWith('/admin/kyc/') && method === 'POST') {
        const parts = route.split('/')
        const kycId = parts[3]
        const action = parts[4] // approve | reject
        const rec = await db.collection('kyc').findOne({ id: kycId })
        if (!rec) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        const status = action === 'approve' ? 'approved' : 'rejected'
        await db.collection('kyc').updateOne({ id: kycId }, { $set: { status, reviewed_at: now() } })
        await db.collection('users').updateOne({ id: rec.user_id }, { $set: { kyc_status: status } })
        await audit(db, user.id, `admin.kyc.${action}`, { kyc_id: kycId, user_id: rec.user_id })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (route === '/admin/settings' && method === 'GET') {
        const s = await db.collection('settings').findOne({ id: 'platform' })
        return handleCORS(NextResponse.json({ settings: clean(s) }))
      }
      if (route === '/admin/settings' && method === 'PUT') {
        const body = await request.json()
        const upd = {}
        for (const k of ['card_activation_wallet','card_activation_network','card_activation_fees','enabled_fiat','enabled_crypto','maintenance_mode']) {
          if (k in body) upd[k] = body[k]
        }
        upd.updated_at = now()
        await db.collection('settings').updateOne({ id: 'platform' }, { $set: upd })
        await audit(db, user.id, 'admin.settings.update', upd)
        const s = await db.collection('settings').findOne({ id: 'platform' })
        return handleCORS(NextResponse.json({ settings: clean(s) }))
      }
      if (route === '/admin/transactions' && method === 'GET') {
        const txs = await db.collection('transactions').find({}).sort({ created_at: -1 }).limit(500).toArray()
        return handleCORS(NextResponse.json({ transactions: clean(txs) }))
      }
      // Deposit request admin endpoints
      if (route === '/admin/deposits' && method === 'GET') {
        const list = await db.collection('deposit_requests').find({}).sort({ created_at: -1 }).limit(500).toArray()
        return handleCORS(NextResponse.json({ deposits: clean(list) }))
      }
      if (route.startsWith('/admin/deposits/') && method === 'POST') {
        const parts = route.split('/')
        const depId = parts[3]
        const action = parts[4] // approve | reject
        const req = await db.collection('deposit_requests').findOne({ id: depId })
        if (!req) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        if (req.status !== 'pending') return handleCORS(NextResponse.json({ error: 'Already processed' }, { status: 400 }))
        if (action === 'approve') {
          const wallet = await db.collection('wallets').findOne({ user_id: req.user_id, currency: req.currency })
          if (!wallet) return handleCORS(NextResponse.json({ error: 'Wallet missing' }, { status: 400 }))
          await db.collection('wallets').updateOne({ id: wallet.id }, { $inc: { balance: req.amount } })
          const tx = { id: uuidv4(), type: 'deposit', method: req.method, currency: req.currency, amount: req.amount, user_id: req.user_id, from_username: req.method, to_username: req.to_username, status: 'completed', created_at: now(), deposit_request_id: req.id }
          await db.collection('transactions').insertOne(tx)
          await writeBlock(db, { type: 'deposit', tx_id: tx.id, currency: req.currency, amount: req.amount, network: CRYPTO.includes(req.currency) ? 'external' : 'fiat_rail', to_user_id: req.user_id, to_username: req.to_username, from_username: req.method })
          await db.collection('deposit_requests').updateOne({ id: depId }, { $set: { status: 'approved', reviewed_at: now(), reviewed_by: user.id } })
        } else {
          await db.collection('deposit_requests').updateOne({ id: depId }, { $set: { status: 'rejected', reviewed_at: now(), reviewed_by: user.id } })
        }
        await audit(db, user.id, `admin.deposit.${action}`, { deposit_id: depId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      // Card activation admin approval
      if (route === '/admin/cards' && method === 'GET') {
        const list = await db.collection('cards').find({ status: { $in: ['pending_verification','pending_activation','activating'] } }).sort({ activation_submitted_at: -1 }).toArray()
        return handleCORS(NextResponse.json({ cards: clean(list) }))
      }
      // Admin: withdrawal requests
      if (route === '/admin/withdrawals' && method === 'GET') {
        const list = await db.collection('withdraw_requests').find({}).sort({ created_at: -1 }).limit(500).toArray()
        return handleCORS(NextResponse.json({ withdrawals: clean(list) }))
      }
      if (route.startsWith('/admin/withdrawals/') && method === 'POST') {
        const parts = route.split('/')
        const wid = parts[3]
        const action = parts[4] // approve | reject
        const wreq = await db.collection('withdraw_requests').findOne({ id: wid })
        if (!wreq) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        if (wreq.status !== 'pending') return handleCORS(NextResponse.json({ error: 'Already processed' }, { status: 400 }))
        const wallet = await db.collection('wallets').findOne({ id: wreq.wallet_id })
        if (action === 'approve') {
          // Funds already deducted at request time; just release the lock and mint transaction
          if (wallet) await db.collection('wallets').updateOne({ id: wallet.id }, { $inc: { locked: -wreq.amount } })
          const isCrypto = CRYPTO.includes(wreq.currency)
          const tx = { id: uuidv4(), type: 'withdraw', method: wreq.method, currency: wreq.currency, amount: wreq.amount, user_id: wreq.user_id, destination: wreq.destination, network: wreq.network, from_username: wreq.username, to_username: 'external', status: 'completed', created_at: now(), withdraw_request_id: wreq.id }
          await db.collection('transactions').insertOne(tx)
          await writeBlock(db, { type: 'withdraw', tx_id: tx.id, currency: wreq.currency, amount: wreq.amount, network: isCrypto ? (wreq.network || 'external') : 'fiat_rail', from_user_id: wreq.user_id, from_username: wreq.username, to_username: 'external', destination: wreq.destination, method: wreq.method })
          await db.collection('withdraw_requests').updateOne({ id: wid }, { $set: { status: 'approved', reviewed_at: now(), reviewed_by: user.id } })
        } else {
          // Rejected — return the locked funds to available balance
          if (wallet) await db.collection('wallets').updateOne({ id: wallet.id }, { $inc: { balance: wreq.amount, locked: -wreq.amount } })
          await db.collection('withdraw_requests').updateOne({ id: wid }, { $set: { status: 'rejected', reviewed_at: now(), reviewed_by: user.id } })
        }
        await audit(db, user.id, `admin.withdraw.${action}`, { withdraw_id: wid })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      // Admin: single KYC detail (used for review modal)
      if (route.startsWith('/admin/kyc/') && route.split('/').length === 4 && method === 'GET') {
        const kycId = route.split('/')[3]
        const rec = await db.collection('kyc').findOne({ id: kycId })
        if (!rec) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        const owner = await db.collection('users').findOne({ id: rec.user_id })
        return handleCORS(NextResponse.json({ kyc: clean(rec), user: clean(owner) }))
      }
      // Admin: notifications = aggregate of pending actionable items
      if (route === '/admin/notifications' && method === 'GET') {
        const [depositPending, withdrawPending, kycPending, cardPending] = await Promise.all([
          db.collection('deposit_requests').countDocuments({ status: 'pending' }),
          db.collection('withdraw_requests').countDocuments({ status: 'pending' }),
          db.collection('kyc').countDocuments({ status: 'pending' }),
          db.collection('cards').countDocuments({ status: { $in: ['pending_verification','pending_activation'] } })
        ])
        const recent = await Promise.all([
          db.collection('deposit_requests').find({ status: 'pending' }).sort({ created_at: -1 }).limit(5).toArray(),
          db.collection('withdraw_requests').find({ status: 'pending' }).sort({ created_at: -1 }).limit(5).toArray(),
          db.collection('kyc').find({ status: 'pending' }).sort({ submitted_at: -1 }).limit(5).toArray(),
          db.collection('cards').find({ status: { $in: ['pending_verification','pending_activation'] } }).sort({ activation_submitted_at: -1 }).limit(5).toArray()
        ])
        const items = []
        recent[0].forEach(d => items.push({ kind: 'deposit', id: d.id, title: `${d.username || d.to_username || 'user'} → deposit ${d.amount} ${d.currency}`, at: d.created_at }))
        recent[1].forEach(w => items.push({ kind: 'withdraw', id: w.id, title: `${w.username} → withdraw ${w.amount} ${w.currency}`, at: w.created_at }))
        recent[2].forEach(k => items.push({ kind: 'kyc', id: k.id, title: `${k.full_name || 'user'} submitted KYC`, at: k.submitted_at }))
        recent[3].forEach(c => items.push({ kind: 'card', id: c.id, title: `Card activation (${c.tier})`, at: c.activation_submitted_at || c.created_at }))
        items.sort((a,b) => new Date(b.at) - new Date(a.at))
        return handleCORS(NextResponse.json({
          counts: { deposits: depositPending, withdrawals: withdrawPending, kyc: kycPending, cards: cardPending },
          total: depositPending + withdrawPending + kycPending + cardPending,
          items: items.slice(0, 20)
        }))
      }
      // Admin: delete a card entirely (also user-facing effect: card removed)
      if (route.startsWith('/admin/cards/') && route.split('/').length === 4 && method === 'DELETE') {
        const cardId = route.split('/')[3]
        await db.collection('cards').deleteOne({ id: cardId })
        await audit(db, user.id, 'admin.card.delete', { card_id: cardId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      // Admin: delete a transaction (audit-logged; does NOT reverse balances)
      if (route.startsWith('/admin/transactions/') && method === 'DELETE') {
        const txId = route.split('/')[3]
        await db.collection('transactions').deleteOne({ id: txId })
        await audit(db, user.id, 'admin.tx.delete', { tx_id: txId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (route.startsWith('/admin/cards/') && method === 'POST') {
        const parts = route.split('/')
        const cardId = parts[3]
        const action = parts[4] // approve | reject
        const body = await request.json().catch(()=>({}))
        const card = await db.collection('cards').findOne({ id: cardId })
        if (!card) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        if (action === 'approve') {
          const immediate = !!body?.activate_now
          const finalStatus = immediate ? 'active' : 'activating'
          const finalUsable = immediate ? now() : new Date(Date.now() + 24*60*60*1000)
          await db.collection('cards').updateOne({ id: cardId }, { $set: { status: finalStatus, admin_approved_at: now(), usable_at: finalUsable, activated_at: immediate ? now() : null } })
          await writeBlock(db, { type: 'card_activation', tx_id: card.id, currency: 'USDT', amount: card.activation_fee_usdt, network: card.activation_network_used || 'external', from_user_id: card.user_id, to_username: 'aurela_treasury', card_id: card.id })
        } else {
          await db.collection('cards').updateOne({ id: cardId }, { $set: { status: 'rejected' } })
        }
        await audit(db, user.id, `admin.card.${action}`, { card_id: cardId })
        return handleCORS(NextResponse.json({ ok: true }))
      }

      if (route === '/admin/audit' && method === 'GET') {
        const logs = await db.collection('audit_logs').find({}).sort({ timestamp: -1 }).limit(500).toArray()
        return handleCORS(NextResponse.json({ audit: clean(logs) }))
      }

      // Platform wallets CRUD (super_admin only for writes; both roles can view)
      if (route === '/admin/platform-wallets' && method === 'GET') {
        const list = await db.collection('platform_wallets').find({}).sort({ asset: 1, network: 1 }).toArray()
        return handleCORS(NextResponse.json({ platform_wallets: clean(list) }))
      }
      if (route === '/admin/platform-wallets' && method === 'POST') {
        if (!isSuper) return handleCORS(NextResponse.json({ error: 'Super admin only' }, { status: 403 }))
        const body = await request.json()
        const { asset, network, address, enabled } = body || {}
        if (!asset || !network || !address) return handleCORS(NextResponse.json({ error: 'Missing fields' }, { status: 400 }))
        const doc = { id: uuidv4(), asset, network, address, enabled: enabled !== false, created_at: now() }
        await db.collection('platform_wallets').insertOne(doc)
        await audit(db, user.id, 'admin.platform_wallet.create', { asset, network })
        return handleCORS(NextResponse.json({ wallet: clean(doc) }))
      }
      if (route.startsWith('/admin/platform-wallets/') && (method === 'PUT' || method === 'DELETE')) {
        if (!isSuper) return handleCORS(NextResponse.json({ error: 'Super admin only' }, { status: 403 }))
        const wid = route.split('/')[3]
        if (method === 'DELETE') {
          await db.collection('platform_wallets').deleteOne({ id: wid })
          await audit(db, user.id, 'admin.platform_wallet.delete', { id: wid })
          return handleCORS(NextResponse.json({ ok: true }))
        }
        const body = await request.json()
        const upd = {}
        for (const k of ['asset','network','address','enabled']) if (k in body) upd[k] = body[k]
        upd.updated_at = now()
        await db.collection('platform_wallets').updateOne({ id: wid }, { $set: upd })
        const w = await db.collection('platform_wallets').findOne({ id: wid })
        await audit(db, user.id, 'admin.platform_wallet.update', { id: wid, ...upd })
        return handleCORS(NextResponse.json({ wallet: clean(w) }))
      }
    }

    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error, error?.stack)
    return handleCORS(NextResponse.json({ error: 'Internal server error', detail: String(error?.message || error) }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
