import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import webpush from 'web-push'
import pkg from '../../../package.json'

// -------- App version (bumped on every meaningful release) --------
// Server tells clients this version; clients cache it and show "Update available" when it changes.
const APP_VERSION = pkg.version
const BUILD_TIME  = new Date().toISOString()   // set at cold-start; a fresh deploy gets a new build_time

// ============================================================
// AURELA — Global Digital Banking & Crypto Platform (MVP API)
// ============================================================

let client, db, _connectPromise
async function connectToMongo() {
  if (db) return db
  // Share a single in-flight connection promise so concurrent cold-start requests
  // never observe a half-initialised `db` (previously caused "Cannot read properties of undefined (reading 'collection')").
  if (!_connectPromise) {
    _connectPromise = (async () => {
      const c = new MongoClient(process.env.MONGO_URL)
      await c.connect()
      const d = c.db(process.env.DB_NAME)
      await ensureSeed(d)
      await ensureVapid(d)
      client = c
      db = d
      return d
    })().catch(err => { _connectPromise = null; throw err })
  }
  return _connectPromise
}

// -------- VAPID / Web Push --------
// Keys are generated once on first boot and stored in `system` collection.
// Public key is served via /api/push/config; private key is used server-side only.
let _vapidReady = false
async function ensureVapid(db) {
  const existing = await db.collection('system').findOne({ id: 'vapid' })
  let publicKey, privateKey
  if (existing?.public && existing?.private) {
    publicKey = existing.public
    privateKey = existing.private
  } else {
    const keys = webpush.generateVAPIDKeys()
    publicKey = keys.publicKey
    privateKey = keys.privateKey
    await db.collection('system').updateOne(
      { id: 'vapid' },
      { $set: { id: 'vapid', public: publicKey, private: privateKey, created_at: new Date().toISOString() } },
      { upsert: true }
    )
  }
  const contact = process.env.PUSH_CONTACT_EMAIL || 'mailto:support@aurelawallet.com'
  webpush.setVapidDetails(contact, publicKey, privateKey)
  _vapidReady = true
}

async function sendPushToUser(db, userId, payload) {
  if (!_vapidReady) return
  const subs = await db.collection('push_subscriptions').find({ user_id: userId }).toArray()
  await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(payload))
    } catch (e) {
      // 404/410 means subscription is dead — remove it silently
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await db.collection('push_subscriptions').deleteOne({ _id: s._id })
      }
    }
  }))
}

// -------- Portfolio snapshots (daily rollup for the 30-day chart) --------
async function snapshotPortfolio(db, userId) {
  try {
    const day = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD
    const wallets = await db.collection('wallets').find({ user_id: userId }).toArray()
    const rates = await getRates(db)
    const usdOf = (cur, val) => {
      if (!val) return 0
      if (cur === 'USD') return val
      if (rates?.fx?.[cur]) return val / rates.fx[cur]
      if (rates?.crypto_usd?.[cur]) return val * rates.crypto_usd[cur]
      return 0
    }
    const total = wallets.reduce((sum, w) => sum + usdOf(w.currency, Number(w.balance || 0)), 0)
    const rounded = Math.round(total * 100) / 100
    // Atomic upsert — race-safe (no duplicate documents for same user+day)
    await db.collection('portfolio_snapshots').updateOne(
      { user_id: userId, day },
      {
        $set: { total_usd: rounded, updated_at: new Date().toISOString() },
        $setOnInsert: { id: uuidv4(), user_id: userId, day, created_at: new Date().toISOString() }
      },
      { upsert: true }
    )
  } catch(e) {}
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
const CRYPTO = ['AUR','BTC','ETH','USDT','USDC','BNB','SOL','XRP','ADA','DOGE','MATIC','AVAX','DOT','TRX','LINK','ATOM','LTC','BCH','XLM','NEAR','APT','ARB','OP','SUI','TON','SHIB','PEPE','INJ','FIL','ICP','HBAR']
const CRYPTO_NETWORKS = {
  AUR: ['Aurela'],
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
// All supported deposit/withdrawal methods. Admin toggles which are exposed to users.
const ALL_FIAT_METHODS = ['bank_swift','bank_indian','upi','paypal','stripe','card','sepa','ach','wise']
const ALL_CRYPTO_METHOD = 'crypto'

const CARD_TIERS = {
  basic:   { name: 'Aurela Basic',   activation_fee_usdt: 10,  daily_spend: 20000,  daily_withdraw: 10000,  monthly_spend: 500000,   color: 'basic' },
  premium: { name: 'Aurela Premium', activation_fee_usdt: 50,  daily_spend: 50000,  daily_withdraw: 25000,  monthly_spend: 1000000,  color: 'premium' },
  elite:   { name: 'Aurela Elite',   activation_fee_usdt: 200, daily_spend: 200000, daily_withdraw: 100000, monthly_spend: 5000000,  color: 'elite' },
}

// ---------- Zonal (geolocation) cards ----------
// Admin-only product: a card issued per geographic zone (like game-server regions). Each zone has its own
// fee (USDT), activation time (plain number = HOURS) and enable flag, all editable by admins. Visual theme
// (landmark + metallic colour) is copied onto the card so the user's Cards tab can render it without
// exposing the zone configuration. Country → zone mapping uses ISO alpha-2 codes from the user's last GPS/IP fix.
const CARD_ZONE_DEFAULTS = [
  { code: 'NA',  name: 'North America',   landmark: 'Statue of Liberty',     city: 'New York',  theme: 'steel',    image_url: 'https://images.unsplash.com/photo-1780295469930-199e3f0a2cd9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['US','CA','MX','GL','BM','PM','GT','BZ','HN','SV','NI','CR','PA','CU','DO','HT','JM','BS','BB','TT','PR','AG','DM','GD','KN','LC','VC','KY','TC','VG','VI','AW','CW','SX','BQ','MQ','GP','MS','AI','MF','BL'] },
  { code: 'SA',  name: 'South America',   landmark: 'Christ the Redeemer',   city: 'Rio de Janeiro', theme: 'emerald', image_url: 'https://images.unsplash.com/photo-1564659907532-6b5f98c8e70f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['BR','AR','CL','CO','PE','VE','EC','BO','PY','UY','GY','SR','GF','FK'] },
  { code: 'EU',  name: 'Europe',          landmark: 'Eiffel Tower',          city: 'Paris',     theme: 'sapphire', image_url: 'https://images.unsplash.com/photo-1439393161192-32360eb753f1?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['FR','DE','IT','ES','PT','NL','BE','LU','AT','CH','LI','DK','SE','NO','FI','IS','PL','CZ','SK','HU','RO','BG','GR','HR','SI','RS','BA','ME','MK','AL','XK','EE','LV','LT','MT','CY','MC','SM','VA','AD','FO','GI','AX','SJ'] },
  { code: 'UK',  name: 'United Kingdom',  landmark: 'Big Ben',               city: 'London',    theme: 'crimson',  image_url: 'https://images.unsplash.com/photo-1520986606214-8b456906c813?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['GB','IE','IM','JE','GG'] },
  { code: 'ME',  name: 'Middle East',     landmark: 'Burj Khalifa',          city: 'Dubai',     theme: 'desert',   image_url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['AE','SA','QA','KW','BH','OM','YE','JO','LB','SY','IQ','IR','IL','PS','TR'] },
  { code: 'AF',  name: 'Africa',          landmark: 'Pyramids of Giza',      city: 'Cairo',     theme: 'bronze',   image_url: 'https://images.unsplash.com/photo-1613757874090-456665221c00?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['EG','DZ','MA','TN','LY','SD','SS','MR','ML','NE','TD','NG','GH','CI','SN','GM','GN','GW','SL','LR','BF','TG','BJ','CM','CF','GA','CG','CD','GQ','ST','AO','ZM','ZW','MW','MZ','NA','BW','ZA','LS','SZ','MG','MU','SC','KM','RE','YT','KE','UG','TZ','RW','BI','ET','ER','DJ','SO','EH','CV'] },
  { code: 'CIS', name: 'CIS & Eurasia',   landmark: "Saint Basil's Cathedral", city: 'Moscow',  theme: 'ruby',     image_url: 'https://images.unsplash.com/photo-1563166796-befbbd534d1b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['RU','KZ','UZ','TM','KG','TJ','BY','AM','AZ','GE','MD','UA'] },
  { code: 'SAS', name: 'South Asia',      landmark: 'Taj Mahal',             city: 'Agra',      theme: 'ivory',    image_url: 'https://images.unsplash.com/photo-1587135941948-670b381f08ce?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['IN','PK','BD','LK','NP','BT','MV','AF'] },
  { code: 'SEA', name: 'Southeast Asia',  landmark: 'Marina Bay Sands',      city: 'Singapore', theme: 'teal',     image_url: 'https://images.unsplash.com/photo-1599594026550-97d9565ceda3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['SG','MY','TH','ID','PH','VN','KH','LA','MM','BN','TL'] },
  { code: 'EA',  name: 'East Asia',       landmark: 'Tokyo Tower',           city: 'Tokyo',     theme: 'obsidian', image_url: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['CN','JP','KR','KP','TW','HK','MO','MN'] },
  { code: 'OCE', name: 'Oceania',         landmark: 'Sydney Opera House',    city: 'Sydney',    theme: 'ocean',    image_url: 'https://images.unsplash.com/photo-1523059623039-a9ed027e7fad?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    countries: ['AU','NZ','FJ','PG','SB','VU','NC','PF','WS','TO','TV','KI','NR','FM','MH','PW','GU','MP','AS','CK','NU','TK','WF'] },
]
const CARD_ZONE_DEFAULT_FEE_USDT = 25
const CARD_ZONE_DEFAULT_HOURS = 24
const CARD_ZONE_LIMITS = { daily_spend: 50000, daily_withdraw: 25000, monthly_spend: 1000000 }
const CARD_ZONE_ORDER = CARD_ZONE_DEFAULTS.map(z => z.code)
let cardZonesSeeded = false
// Idempotent: inserts any missing zone with defaults, never overwrites admin edits.
async function ensureCardZones(db) {
  if (cardZonesSeeded) return
  const existing = await db.collection('card_zones').find({}, { projection: { code: 1 } }).toArray()
  const have = new Set(existing.map(z => z.code))
  const missing = CARD_ZONE_DEFAULTS.filter(z => !have.has(z.code))
  if (missing.length) {
    await db.collection('card_zones').insertMany(missing.map(z => ({
      id: uuidv4(), ...z, fee_usdt: CARD_ZONE_DEFAULT_FEE_USDT, activation_hours: CARD_ZONE_DEFAULT_HOURS, enabled: true,
      ...CARD_ZONE_LIMITS, created_at: now(), updated_at: now(),
    })))
  }
  cardZonesSeeded = true
}
async function getCardZones(db) {
  await ensureCardZones(db)
  const zones = await db.collection('card_zones').find({}).toArray()
  zones.sort((a, b) => CARD_ZONE_ORDER.indexOf(a.code) - CARD_ZONE_ORDER.indexOf(b.code))
  return zones
}
function zoneForCountry(zones, cc) {
  const code = String(cc || '').toUpperCase()
  if (!code) return null
  return zones.find(z => Array.isArray(z.countries) && z.countries.includes(code)) || null
}
// Where do we think the user is? GPS reverse-geocode first, then IP geolocation, then KYC/profile country.
function userCountryCode(u) {
  const L = u?.last_location || {}
  const cc = L.country_code || L.ip_geo?.country_code || u?.country || null
  const source = L.country_code ? 'gps' : L.ip_geo?.country_code ? 'ip' : u?.country ? 'profile' : null
  return { cc: cc ? String(cc).toUpperCase() : null, source, city: L.city || L.ip_geo?.city || null, country: L.country || L.ip_geo?.country || null, at: L.at || null, status: L.status || null }
}
function hoursLabel(h) {
  const n = Number(h) || 0
  if (n <= 0) return 'immediately'
  if (n === 1) return '1 hour'
  if (n < 48 || n % 24 !== 0) return `${n} hours`
  return `${n / 24} days (${n} hours)`
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
// Mongo projection that excludes the heavy base64 KYC document images from list responses.
// Each image can be several MB, so lists must only carry metadata (images are loaded per-record).
const KYC_LIST_PROJECTION = { doc_front: 0, doc_back: 0, selfie: 0 }
// Compact, safe owner summary attached to admin list rows (never includes secrets)
const ADMIN_USER_SUMMARY_PROJECTION = { _id: 0, id: 1, username: 1, email: 1, full_name: 1, first_name: 1, last_name: 1, user_code: 1, kyc_status: 1, country: 1, phone: 1, status: 1, created_at: 1 }

// "What's new" shown once per version to every signed-in user (Aurela Updated popup)
// Keep these generic and user-facing only — never mention admin-side features here.
const WHATS_NEW = [
  'Performance optimizations — faster, smoother experience across the app',
  'Security patches and hardening to keep your account and funds protected',
  'Stability improvements and general bug fixes',
]

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
  // Anonymize: always replace usernames with Aurela IDs (user_code) when we have a user_id
  const anonymised = { ...blockData }
  if (blockData.from_user_id) {
    const u = await db.collection('users').findOne({ id: blockData.from_user_id }, { projection: { user_code: 1 } })
    if (u?.user_code) anonymised.from_username = u.user_code
  }
  if (blockData.to_user_id) {
    const u = await db.collection('users').findOne({ id: blockData.to_user_id }, { projection: { user_code: 1 } })
    if (u?.user_code) anonymised.to_username = u.user_code
  }
  const last = await db.collection('aurela_chain').find({}).sort({ block_number: -1 }).limit(1).toArray()
  const prev = last[0]
  const block_number = prev ? prev.block_number + 1 : 1
  const prev_hash = prev ? prev.hash : '0'.repeat(64)
  const timestamp = now()
  const payload = { block_number, prev_hash, timestamp: timestamp.toISOString(), ...anonymised }
  const hash = sha256(JSON.stringify(payload))
  const block = { id: uuidv4(), ...payload, hash }
  await db.collection('aurela_chain').insertOne(block)
  return block
}

async function hasActiveCard(db, userId) {
  const c = await db.collection('cards').findOne({ user_id: userId, status: 'active', frozen: { $ne: true } })
  return !!c
}

// ---------- Per-user card fee resolver ----------
// Returns the activation fee for a user + tier. Checks user override first, then admin global default.
async function resolveCardFee(db, userDoc, tier) {
  const override = userDoc?.card_fee_overrides?.[tier]
  if (typeof override === 'number' && override >= 0) return override
  const settings = await db.collection('settings').findOne({ id: 'platform' })
  const globalFee = settings?.card_activation_fees?.[tier]
  if (typeof globalFee === 'number' && globalFee >= 0) return globalFee
  return CARD_TIERS[tier]?.activation_fee_usdt ?? 0
}

// ---------- Aurela Chain — Auto-simulation daemon ----------
// The chain writes a fresh block every 4-8 seconds automatically (like a real block explorer).
// Piggybacks on the /rates polling: each poll triggers this tick which decides if enough time has
// elapsed to mint a new block. Uses admin-configured card fees for card_activation blocks.
let _lastChainTickAt = 0
let _chainTickInFlight = false
async function simulateChainTick(db) {
  if (_chainTickInFlight) return
  const nowMs = Date.now()
  // Between 4s and 8s per block, randomized so it feels organic
  const nextInterval = 4000 + Math.floor(Math.random() * 4000)
  if (nowMs - _lastChainTickAt < nextInterval) return
  _chainTickInFlight = true
  try {
    _lastChainTickAt = nowMs
    const settings = await db.collection('settings').findOne({ id: 'platform' })
    const fees = settings?.card_activation_fees || { basic: 10, premium: 50, elite: 200 }
    const currencies = ['AUR','USDT','BTC','ETH','USDC','BNB','SOL','XRP','TRX','MATIC','AVAX','USD','EUR','GBP','INR','AED','JPY']
    const networks = {
      AUR:['Aurela'], USDT:['ERC20','TRC20','BEP20'], BTC:['Bitcoin'], ETH:['ERC20'], USDC:['ERC20','Polygon'],
      BNB:['BEP20'], SOL:['Solana'], XRP:['XRP'], TRX:['TRC20'], MATIC:['Polygon'], AVAX:['Avalanche'],
      USD:['fiat_rail'], EUR:['fiat_rail'], GBP:['fiat_rail'], INR:['fiat_rail'], AED:['fiat_rail'], JPY:['fiat_rail']
    }
    // Weighted block-type distribution — more transfers/deposits, fewer card activations (realistic)
    const typeRoll = Math.random()
    const type = typeRoll < 0.4 ? 'transfer' : typeRoll < 0.65 ? 'deposit' : typeRoll < 0.85 ? 'withdraw' : typeRoll < 0.93 ? 'card_activation' : 'reward'
    const genCode = () => 'AUR' + randDigits(9)
    let cur, amount, network
    if (type === 'card_activation') {
      // Card activation blocks: always USDT, amount = admin-configured tier fee
      cur = 'USDT'
      const tierPick = Math.random() < 0.6 ? 'basic' : Math.random() < 0.8 ? 'premium' : 'elite'
      amount = fees[tierPick] ?? 10
      network = 'TRC20'
    } else if (type === 'reward') {
      cur = 'AUR'
      amount = Math.round((Math.random() * 5 + 1) * 100) / 100   // 1-6 AUR
      network = 'Aurela'
    } else {
      cur = currencies[Math.floor(Math.random() * currencies.length)]
      network = networks[cur][Math.floor(Math.random() * networks[cur].length)]
      if (['BTC','ETH'].includes(cur)) amount = Math.round(Math.random() * 3 * 1e6) / 1e6
      else if (['USDT','USDC'].includes(cur)) amount = Math.round(Math.random() * 20000 * 100) / 100
      else if (cur === 'AUR') amount = Math.round(Math.random() * 500 * 100) / 100
      else amount = Math.round(Math.random() * 50000 * 100) / 100
    }
    await writeBlock(db, {
      type, currency: cur, amount, network,
      from_username: type === 'deposit' ? 'external' : type === 'reward' ? 'aurela_treasury' : genCode(),
      to_username: type === 'withdraw' ? 'external' : type === 'card_activation' ? 'aurela_treasury' : genCode(),
      method: type === 'card_activation' ? 'usdt' : type === 'reward' ? 'welcome_bonus' : (['deposit','withdraw'].includes(type) && ['USD','EUR','GBP','INR','AED','JPY'].includes(cur)) ? 'bank' : 'chain'
    })
  } catch (e) {
    console.error('[chain-sim] tick error', e)
  } finally {
    _chainTickInFlight = false
  }
}

// ---------- Email OTP via Resend ----------
async function sendEmail(email, subject, bodyHtml) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'Aurela <onboarding@resend.dev>'
  if (!apiKey) { console.log(`[AURELA email:no-service] to=${email} subject=${subject}`); return { delivered: false } }
  const html = `<div style="background:#050507;color:#f5f5f0;font-family:'Helvetica Neue',Arial,sans-serif;padding:40px 20px"><div style="max-width:520px;margin:0 auto;background:linear-gradient(160deg,#141419 0%,#0b0b0f 100%);border:1px solid rgba(212,175,55,0.25);border-radius:16px;padding:36px"><div style="text-align:center;margin-bottom:24px"><div style="display:inline-block;font-family:'Playfair Display',Georgia,serif;font-size:26px;letter-spacing:8px;background:linear-gradient(120deg,#8f6b18,#d4af37,#f5e29d,#d4af37,#8f6b18);-webkit-background-clip:text;background-clip:text;color:transparent">AURELA</div></div>${bodyHtml}<hr style="border:none;border-top:1px solid rgba(212,175,55,0.12);margin:28px 0"/><p style="color:#7a7a72;font-size:11px;text-align:center;margin:0">\u00a9 ${new Date().getFullYear()} Aurela Wallet</p></div></div>`
  try {
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [email], subject, html }) })
    if (!res.ok) { const err = await res.text(); console.error('[Resend] failure', res.status, err); return { delivered: false, error: err } }
    return { delivered: true }
  } catch (e) { console.error('[Resend] error', e); return { delivered: false, error: String(e) } }
}

// Push a notification row into user_notifications AND fire an email (best effort, fire-and-forget)
async function notifyUser(db, userId, { kind, title, body, meta = {}, emailHtml = null, url = '/' }) {
  await db.collection('user_notifications').insertOne({
    id: uuidv4(), user_id: userId, kind, title, body,
    meta, read: false, created_at: now()
  })
  try {
    const u = await db.collection('users').findOne({ id: userId }, { projection: { email: 1, full_name: 1 } })
    if (u?.email) {
      const emailBody = emailHtml || `<h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#f5e29d;margin:0 0 12px">${title}</h1><p style="color:#a8a8a0;font-size:14px;line-height:1.6;margin:0 0 20px">${body}</p><p style="color:#7a7a72;font-size:12px;line-height:1.5;margin:0">Sign in at <a href="https://www.aurelawallet.com" style="color:#d4af37">aurelawallet.com</a> to see the details.</p>`
      sendEmail(u.email, `[Aurela] ${title}`, emailBody).catch(()=>{})
    }
    // Fire-and-forget web push
    sendPushToUser(db, userId, { title, body, kind, tag: kind, url }).catch(()=>{})
  } catch (e) { /* non-fatal */ }
}

const SUPPORT_EMAIL = 'support@aurelawallet.com'
const GEO_UNVERIFIED_MESSAGE = `Geolocation Unverified (The card used to withdraw is not supported in this geolocation). Please contact support at ${SUPPORT_EMAIL}`

// ---- Location capture helpers (GPS + IP + device, recorded on every login) ----
function clientIpFromRequest(request) {
  const h = request.headers
  const xff = h.get('x-forwarded-for') || ''
  const ip = (xff.split(',')[0] || h.get('x-real-ip') || h.get('cf-connecting-ip') || '').trim()
  return ip || null
}
// Great-circle distance in km between two lat/lng points
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
// Reverse-geocode coordinates → city/state/country using OpenStreetMap Nominatim (keyless; needs a UA header). Best-effort.
async function reverseGeocode(lat, lng) {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000)
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=10&addressdetails=1`, {
      headers: { 'User-Agent': 'AurelaWallet/1.0 (support@aurelawallet.com)', 'Accept-Language': 'en' }, signal: ctrl.signal, cache: 'no-store',
    })
    clearTimeout(t)
    if (!r.ok) return null
    const j = await r.json()
    const a = j?.address || {}
    return {
      city: a.city || a.town || a.village || a.municipality || a.county || null,
      state: a.state || a.region || null,
      country: a.country || null,
      country_code: a.country_code ? String(a.country_code).toUpperCase() : null,
      display: j?.display_name || null,
    }
  } catch (e) { return null }
}
// IP → approximate location via ipwho.is (keyless). Best-effort; private/loopback IPs return null.
async function ipGeolocate(ip) {
  try {
    if (!ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd)/i.test(ip)) return null
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000)
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!r.ok) return null
    const j = await r.json()
    if (j?.success === false) return null
    return { city: j.city || null, region: j.region || null, country: j.country || null, country_code: j.country_code || null, lat: j.latitude ?? null, lng: j.longitude ?? null, isp: j?.connection?.isp || j?.connection?.org || null, timezone: j?.timezone?.id || null }
  } catch (e) { return null }
}

// Records a withdrawal attempt blocked by the geolocation hold and alerts every administrator.
// Attempts from the same user within a 30-minute window are merged into one alert (count++) to avoid spam.
async function recordBlockedWithdrawAttempt(db, u, { amount, currency, amount_usd, method, allowance_usd }) {
  try {
    const windowStart = new Date(Date.now() - 30 * 60 * 1000)   // Date (not string) — matches how now() stores last_at
    const existing = await db.collection('withdraw_attempts').findOne({ user_id: u.id, status: 'open', last_at: { $gte: windowStart } })
    if (existing) {
      await db.collection('withdraw_attempts').updateOne({ id: existing.id }, {
        $inc: { count: 1 },
        $set: { last_at: now(), amount, currency, amount_usd, method, allowance_usd },
      })
      return existing
    }
    const attempt = {
      id: uuidv4(), user_id: u.id, username: u.username || null, email: u.email || null, full_name: u.full_name || null,
      amount, currency, amount_usd, method, allowance_usd,
      reason: 'geolocation_unverified', status: 'open', count: 1,
      created_at: now(), last_at: now(),
    }
    await db.collection('withdraw_attempts').insertOne(attempt)
    await audit(db, u.id, 'withdraw.blocked_geolocation', { amount, currency, amount_usd, allowance_usd })
    // Alert administrators (in-app bell + push + email) — fire-and-forget
    const admins = await db.collection('users').find({ role: { $in: ['admin', 'super_admin'] } }, { projection: { id: 1 } }).toArray()
    const who = u.full_name || u.username || u.email || 'A user'
    const title = 'Withdrawal blocked — geolocation unverified'
    const body = `${who} (@${u.username || '—'}) tried to withdraw ${amount} ${currency} (≈ $${(Math.round(amount_usd * 100) / 100).toLocaleString('en-US')}). Current approved allowance: $${(Number(allowance_usd) || 0).toLocaleString('en-US')}. Review and set how much this user may withdraw.`
    for (const a of admins) {
      notifyUser(db, a.id, { kind: 'admin_withdraw_blocked', title, body, url: '/?tab=admin_withdraw_access', meta: { attempt_id: attempt.id, user_id: u.id, username: u.username, amount, currency, amount_usd, allowance_usd } }).catch(() => {})
    }
    return attempt
  } catch (e) { console.error('[withdraw_attempts] failed to record', e?.message); return null }
}

// Attaches a compact `user` summary (incl. last_location) to a list of request documents keyed by user_id
async function attachOwners(db, list) {
  const ids = [...new Set((list || []).map(x => x.user_id).filter(Boolean))]
  if (!ids.length) return list.map(x => ({ ...x, user: null }))
  const owners = await db.collection('users').find({ id: { $in: ids } }, { projection: { ...ADMIN_USER_SUMMARY_PROJECTION, last_location: 1, withdraw_lock: 1, withdraw_allowance_usd: 1 } }).toArray()
  const byId = Object.fromEntries(owners.map(u => [u.id, u]))
  return list.map(x => ({ ...x, user: byId[x.user_id] || null }))
}

// ---------- Hidden (background-issued) zonal cards ----------
// An admin can issue a zonal card silently. It stays `status: 'hidden'` (invisible to the user) until the reveal
// rule is satisfied, counting ONLY admin-approved withdrawals requested after the card was issued:
//   reveal.geo        → the user's geolocation-hold allowance has been fully withdrawn (or the hold fully unlocked by admin)
//   reveal.amount_usd → the user's approved withdrawals since issuance reach this USD total
//   reveal.match      → 'any' (first condition met) | 'all' (every enabled condition) when both are enabled
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
function zonalRevealMet(card) {
  const r = card?.reveal || {}
  const checks = []
  if (r.geo) checks.push(!!r.geo_met_at)
  if (Number(r.amount_usd) > 0) checks.push((Number(r.progress_usd) || 0) + 1e-6 >= Number(r.amount_usd))
  if (!checks.length) return true
  return r.match === 'all' ? checks.every(Boolean) : checks.some(Boolean)
}
async function revealZonalCard(db, card, { by = 'auto', actor = null } = {}) {
  const fee = Number(card.activation_fee_usdt) || 0
  const hours = Math.max(0, Number(card.activation_hours) || 0)
  const free = fee === 0
  const immediate = free && hours === 0
  const set = {
    status: free ? (immediate ? 'active' : 'activating') : 'pending_activation',
    revealed_at: now(), revealed_by: by === 'admin' ? actor : 'auto', 'reveal.revealed_via': by,
  }
  if (free) {
    set.admin_approved_at = now(); set.approved_by = card.issued_by || actor
    set.usable_at = immediate ? now() : new Date(Date.now() + hours * 60 * 60 * 1000)
    set.activated_at = immediate ? now() : null
  }
  // Atomic: only the first caller flips hidden → visible (no duplicate notifications)
  const res = await db.collection('cards').updateOne({ id: card.id, status: 'hidden' }, { $set: set })
  if (res.modifiedCount !== 1) return false
  const name = card.tier_name || `Aurela ${card.zone_name || 'Zonal'}`
  const title = `🎉 Your ${name} card is ready`
  const body = free
    ? (immediate ? `Congratulations — you've unlocked the exclusive ${name} metal card. It is active and ready to use in your Cards tab.` : `Congratulations — you've unlocked the exclusive ${name} metal card. It will be ready for use in ${hoursLabel(hours)}.`)
    : `Congratulations — you've unlocked the exclusive ${name} metal card. Open your Cards tab and tap Activate to pay the ${fee} USDT activation fee — it unlocks ${hours === 0 ? 'immediately' : `within ${hoursLabel(hours)}`} after verification.`
  await notifyUser(db, card.user_id, { kind: 'zonal_card_unlocked', title, body, url: '/?tab=cards', meta: { card_id: card.id, zone: card.zone, zone_name: card.zone_name, fee_usdt: fee, activation_hours: hours } })
  await audit(db, actor || card.user_id, 'zonal_card.reveal', { card_id: card.id, user_id: card.user_id, via: by })
  if (set.status === 'active') await liftGeoHoldForZonal(db, card.user_id, card)
  return true
}
// ---- Zonal card active ⇒ geolocation hold fully lifted ----
// Once a zonal card is ACTIVE the user's geo hold is removed entirely and the user is exempted from automatic
// re-locks (tier-card approvals). From then on, only an administrator can re-apply the hold (Withdrawal Access → Lock).
async function liftGeoHoldForZonal(db, userId, card, { actor = 'zonal_card' } = {}) {
  try {
    const u = await db.collection('users').findOne({ id: userId }, { projection: { withdraw_lock: 1, withdraw_lock_exempt: 1 } })
    if (!u) return false
    if (u.withdraw_lock_exempt && !u.withdraw_lock?.active) return false // already fully unlocked
    await db.collection('users').updateOne({ id: userId }, {
      $set: { 'withdraw_lock.active': false, 'withdraw_lock.cleared_at': now(), 'withdraw_lock.cleared_by': actor, 'withdraw_lock.cleared_reason': 'zonal_card_active', 'withdraw_lock.cleared_card_id': card?.id || null, withdraw_lock_exempt: true },
      $unset: { withdraw_allowance_usd: '' },
    })
    await db.collection('withdraw_attempts').updateMany({ user_id: userId, status: 'open' }, { $set: { status: 'resolved', resolved_at: now(), resolved_by: actor, resolution: 'zonal_card_active' } })
    await audit(db, userId, 'geo_hold.lifted_by_zonal_card', { card_id: card?.id, zone: card?.zone, was_on_hold: !!u.withdraw_lock?.active })
    // A lifted hold also satisfies the geo rule of any other hidden zonal card
    await processHiddenZonalCards(db, userId, { geoEvent: true })
    return true
  } catch (e) { console.error('[geo_hold] zonal lift failed', e?.message); return false }
}
// Flip `activating` cards whose window elapsed to `active`; zonal ones lift the geo hold
async function settleDueCards(db, userId) {
  const nowMs = Date.now()
  // Compare in JS so both Date and ISO-string `usable_at` values are handled
  const due = (await db.collection('cards').find({ user_id: userId, status: 'activating' }).toArray())
    .filter(c => c.usable_at && new Date(c.usable_at).getTime() <= nowMs)
  for (const c of due) {
    const r = await db.collection('cards').updateOne({ id: c.id, status: 'activating' }, { $set: { status: 'active', activated_at: now() } })
    if (r.modifiedCount === 1 && c.type === 'zonal') await liftGeoHoldForZonal(db, userId, c)
  }
}
// Called on withdrawal approval and on geo-hold unlock. Never throws (must not break the calling flow).
async function processHiddenZonalCards(db, userId, { withdrawUsd = 0, requestedAt = null, geoEvent = false } = {}) {
  try {
    const hidden = await db.collection('cards').find({ user_id: userId, type: 'zonal', status: 'hidden' }).toArray()
    for (const c of hidden) {
      const issuedAt = new Date(c.issued_at || c.created_at).getTime()
      const after = !requestedAt || new Date(requestedAt).getTime() >= issuedAt
      const inc = {}; const set = {}
      if (after && withdrawUsd > 0) { inc['reveal.progress_usd'] = round2(withdrawUsd); inc['reveal.withdrawals_counted'] = 1; set['reveal.last_progress_at'] = now() }
      if (after && geoEvent && c.reveal?.geo && !c.reveal?.geo_met_at) set['reveal.geo_met_at'] = now()
      if (!Object.keys(inc).length && !Object.keys(set).length) continue
      const upd = await db.collection('cards').findOneAndUpdate({ id: c.id, status: 'hidden' }, { ...(Object.keys(inc).length ? { $inc: inc } : {}), ...(Object.keys(set).length ? { $set: set } : {}) }, { returnDocument: 'after' })
      const fresh = upd?.value ?? upd
      if (fresh && fresh.status === 'hidden' && zonalRevealMet(fresh)) await revealZonalCard(db, fresh)
    }
  } catch (e) { console.error('[zonal_reveal] failed', e?.message) }
}

// Context for the admin "Open request" dialogs (deposits & withdrawals): owner, KYC (no images), wallet, history, location, explorer link
const TX_EXPLORERS = { ERC20: 'https://etherscan.io/tx/', TRC20: 'https://tronscan.org/#/transaction/', BEP20: 'https://bscscan.com/tx/', POLYGON: 'https://polygonscan.com/tx/', SOLANA: 'https://solscan.io/tx/', BITCOIN: 'https://mempool.space/tx/', XRP: 'https://xrpscan.com/tx/', LITECOIN: 'https://blockchair.com/litecoin/transaction/', DOGECOIN: 'https://blockchair.com/dogecoin/transaction/', AVALANCHE: 'https://snowtrace.io/tx/' }
async function requestReviewContext(db, req) {
  const isDeposit = req.type === 'deposit_request'
  const coll = isDeposit ? 'deposit_requests' : 'withdraw_requests'
  const [owner, kycRec, wallet, history, locations, cards] = await Promise.all([
    db.collection('users').findOne({ id: req.user_id }),
    db.collection('kyc').find({ user_id: req.user_id }, { projection: KYC_LIST_PROJECTION }).sort({ submitted_at: -1 }).limit(1).toArray(),
    db.collection('wallets').findOne({ user_id: req.user_id, currency: req.currency }),
    db.collection(coll).find({ user_id: req.user_id, id: { $ne: req.id } }, { projection: { id: 1, amount: 1, currency: 1, status: 1, created_at: 1, method: 1 } }).sort({ created_at: -1 }).limit(10).toArray(),
    db.collection('user_locations').find({ user_id: req.user_id }).sort({ created_at: -1 }).limit(5).toArray(),
    db.collection('cards').find({ user_id: req.user_id, status: { $ne: 'deleted' } }, { projection: { id: 1, tier: 1, status: 1, created_at: 1 } }).toArray(),
  ])
  const net = String(req.network || '').toUpperCase()
  const explorer_url = req.tx_hash && TX_EXPLORERS[net] ? TX_EXPLORERS[net] + req.tx_hash : null
  const stats = await db.collection(coll).aggregate([
    { $match: { user_id: req.user_id, status: 'approved' } },
    { $group: { _id: '$currency', total: { $sum: '$amount' }, n: { $sum: 1 } } },
  ]).toArray()
  return {
    user: clean(owner),
    kyc: kycRec[0] ? clean(kycRec[0]) : null,
    wallet: wallet ? { balance: wallet.balance, locked: wallet.locked || 0, currency: wallet.currency } : null,
    history: clean(history),
    approved_totals: stats.map(s => ({ currency: s._id, total: s.total, count: s.n })),
    locations: clean(locations),
    cards: clean(cards),
    explorer_url,
  }
}

// Builds a branded HTML receipt (rows = [[label, value], ...]) for transactional emails
function receiptEmailHtml({ title, intro, rows, footnote }) {
  const tr = rows.filter(r => r && r[1] !== undefined && r[1] !== null && r[1] !== '').map(([k, v]) =>
    `<tr><td style="padding:9px 0;color:#7a7a72;font-size:12px;border-bottom:1px solid rgba(212,175,55,0.1)">${k}</td><td style="padding:9px 0;color:#f5f5f0;font-size:13px;text-align:right;border-bottom:1px solid rgba(212,175,55,0.1);font-family:ui-monospace,Menlo,monospace;word-break:break-all">${v}</td></tr>`).join('')
  return `<h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#f5e29d;margin:0 0 12px">${title}</h1>
<p style="color:#a8a8a0;font-size:14px;line-height:1.6;margin:0 0 20px">${intro}</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">${tr}</table>
${footnote ? `<p style="color:#7a7a72;font-size:12px;line-height:1.5;margin:0 0 16px">${footnote}</p>` : ''}
<p style="color:#7a7a72;font-size:12px;line-height:1.5;margin:0">Sign in at <a href="https://www.aurelawallet.com" style="color:#d4af37">aurelawallet.com</a> to view your balance and activity.</p>`
}

async function sendEmailOTP(email, code, purpose = 'signup') {  const apiKey = process.env.RESEND_API_KEY
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
  // ⚠️ SAFETY: All migrations below MUST be idempotent and MUST NOT delete user data.
  // Each migration checks for its own version marker and skips if already applied.
  // The old destructive "wipe users on unknown version" logic caused data loss on
  // every restart when the migration marker advanced beyond v4 — that has been REMOVED.
  const migration = await db.collection('system').findOne({ id: 'migration' })
  const appliedVersions = new Set()
  if (migration?.versions) migration.versions.forEach(v => appliedVersions.add(v))
  if (migration?.version) appliedVersions.add(migration.version)   // backwards-compat with old single-version marker
  const markApplied = async (v) => {
    appliedVersions.add(v)
    await db.collection('system').updateOne(
      { id: 'migration' },
      { $addToSet: { versions: v }, $set: { last_version: v, last_ran_at: now() } },
      { upsert: true }
    )
  }

  // v4: force treasury wallet to USDT TRC20 (idempotent — just sets fields)
  if (!appliedVersions.has('v4_treasury_trc20')) {
    await db.collection('settings').updateOne(
      { id: 'platform' },
      { $set: {
        card_activation_wallet: 'TLgjfeg8Mqw5ueo1CGC8eTb4EHysPMMA6S',
        card_activation_network: 'TRC20',
        updated_at: now(),
      } },
      { upsert: false }
    )
    await markApplied('v4_treasury_trc20')
  }

  // v5: extend enabled_fiat / enabled_crypto to full supported lists (since we grew from 10 to 50/30)
  if (!appliedVersions.has('v5_currency_toggle')) {
    const s = await db.collection('settings').findOne({ id: 'platform' })
    if (s) {
      const upd = {}
      if (!Array.isArray(s.enabled_fiat) || s.enabled_fiat.length < FIAT.length) upd.enabled_fiat = FIAT
      if (!Array.isArray(s.enabled_crypto) || s.enabled_crypto.length < CRYPTO.length) upd.enabled_crypto = CRYPTO
      if (Object.keys(upd).length > 0) {
        upd.updated_at = now()
        await db.collection('settings').updateOne({ id: 'platform' }, { $set: upd })
      }
    }
    await markApplied('v5_currency_toggle')
  }

  // v7: auto-seed anonymized dummy blocks (replaces older seeded blocks with human names)
  if (!appliedVersions.has('v7_anon_blocks')) {
    // Wipe any legacy dummy blocks with human names (from earlier v5 seeder) so the chain looks anonymized
    await db.collection('aurela_chain').deleteMany({ from_username: { $in: ['satoshi','vitalik','ceo','trader01','tradepro','alicia','marco','yumi','zara','omar','luna','kai','ivy','ren','nora'] } })
    await db.collection('aurela_chain').deleteMany({ to_username: { $in: ['satoshi','vitalik','ceo','trader01','tradepro','alicia','marco','yumi','zara','omar','luna','kai','ivy','ren','nora'] } })
    const blockCount = await db.collection('aurela_chain').countDocuments({})
    if (blockCount < 500) {
      const currencies = ['AUR','USDT','BTC','ETH','USDC','BNB','SOL','USD','EUR','GBP','INR']
      const networks = { AUR:['Aurela'], USDT:['ERC20','TRC20','BEP20'], BTC:['Bitcoin'], ETH:['ERC20'], USDC:['ERC20','Polygon'], BNB:['BEP20'], SOL:['Solana'], USD:['fiat_rail'], EUR:['fiat_rail'], GBP:['fiat_rail'], INR:['fiat_rail'] }
      const types = ['transfer','deposit','withdraw','card_activation']
      const genCode = () => 'AUR' + randDigits(9)
      for (let i = 0; i < 500; i++) {
        const cur = currencies[Math.floor(Math.random()*currencies.length)]
        const net = networks[cur][Math.floor(Math.random()*networks[cur].length)]
        const type = types[Math.floor(Math.random()*types.length)]
        const amount = cur === 'AUR' ? Math.random()*500 : ['BTC','ETH'].includes(cur) ? Math.random()*3 : ['USDT','USDC'].includes(cur) ? Math.random()*20000 : Math.random()*50000
        await writeBlock(db, {
          type, currency: cur, amount: Math.round(amount*1e6)/1e6, network: net,
          from_username: type === 'deposit' ? 'external' : genCode(),
          to_username: type === 'withdraw' ? 'external' : genCode(),
          method: type === 'card_activation' ? 'aur' : (['deposit','withdraw'].includes(type) && ['USD','EUR','GBP','INR'].includes(cur)) ? 'bank' : 'chain'
        })
      }
    }
    await markApplied('v7_anon_blocks')
  }

  const existing = await db.collection('users').findOne({ role: 'super_admin' })
  // Backfill user_code + name fields for any existing admin missing them (needed for the /pay lookup deep-link)
  if (existing) {
    const patch = {}
    if (!existing.user_code) {
      let user_code = 'AUR' + randDigits(9)
      for (let i = 0; i < 6 && await db.collection('users').findOne({ user_code }); i++) user_code = 'AUR' + randDigits(9)
      patch.user_code = user_code
    }
    if (!existing.first_name) patch.first_name = 'Aurela'
    if (!existing.last_name)  patch.last_name  = 'Admin'
    if (Object.keys(patch).length > 0) await db.collection('users').updateOne({ id: existing.id }, { $set: patch })
  }
  if (!existing) {
    const salt = newSalt()
    let user_code = 'AUR' + randDigits(9)
    for (let i = 0; i < 6 && await db.collection('users').findOne({ user_code }); i++) user_code = 'AUR' + randDigits(9)
    const admin = {
      id: uuidv4(),
      username: 'aurela_admin',
      user_code,
      email: 'admin@aurelawallet.com',
      full_name: 'Aurela Administrator',
      first_name: 'Aurela',
      last_name: 'Admin',
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
    balance: 0, pending: 0, created_at: now()
  }))
  const cryptoWallets = CRYPTO.map(code => ({
    id: uuidv4(), user_id: userId, type: 'crypto', currency: code,
    balance: 0,   // No auto-credit — AUR welcome is claim-only after KYC (see /api/claim/welcome)
    pending: 0,
    address: generateMockAddress(code),
    networks: CRYPTO_NETWORKS[code] || ['ERC20'],
    created_at: now()
  }))
  await db.collection('wallets').insertMany([...fiatWallets, ...cryptoWallets])
  // Create a pending reward that user can claim after KYC approval
  await db.collection('user_rewards').insertOne({
    id: uuidv4(), user_id: userId, type: 'aur_welcome', amount: 5, currency: 'AUR',
    status: 'pending', requires: 'kyc_approved', created_at: now()
  })
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
// Aurela Coin price simulator: random-walk in INR between 200 and 350, mean-revert to 220.
// Converted to USD using the live USD/INR rate.
async function computeAurPrice(db, currentFx) {
  const inrPerUsd = (currentFx && currentFx.INR) || 83.2
  const doc = await db.collection('rates').findOne({ id: 'aur_ticker' })
  const nowMs = Date.now()
  const lastTs = doc?.updated_at ? new Date(doc.updated_at).getTime() : (nowMs - 1000)
  const stepsElapsed = Math.min(Math.max(Math.floor((nowMs - lastTs) / 1000), 1), 60)  // clamp: at least 1, at most 60 ticks
  let priceInr = doc?.price_inr ?? 220
  const mean = 220, minPrice = 200, maxPrice = 350
  const history = doc?.history || []
  for (let i = 0; i < stepsElapsed; i++) {
    const noise = (Math.random() - 0.5) * 1.6                   // ±0.8 INR per tick
    const meanRevert = (mean - priceInr) * 0.02                  // 2% pull toward 220
    priceInr = Math.max(minPrice, Math.min(maxPrice, priceInr + noise + meanRevert))
  }
  priceInr = Math.round(priceInr * 100) / 100
  const priceUsd = Math.round((priceInr / inrPerUsd) * 10000) / 10000
  // Store history — keep last 120 points (2 minutes worth at 1s ticks)
  const newHistory = [...history, { t: nowMs, inr: priceInr, usd: priceUsd }].slice(-120)
  await db.collection('rates').updateOne(
    { id: 'aur_ticker' },
    { $set: { id: 'aur_ticker', price_inr: priceInr, price_usd: priceUsd, updated_at: new Date(nowMs), history: newHistory } },
    { upsert: true }
  )
  return { price_inr: priceInr, price_usd: priceUsd, history: newHistory }
}

async function getRates(db) {
  const cached = await db.collection('rates').findOne({ id: 'live' })
  const stale = !cached || (Date.now() - new Date(cached.updated_at).getTime() > 15 * 1000)   // Refresh from Coinbase every 15s
  let baseDoc = cached
  if (stale) {
    let fx = { ...(cached?.fx || FALLBACK_FX) }
    let base_crypto_usd = { ...(cached?.base_crypto_usd || cached?.crypto_usd || FALLBACK_CRYPTO_USD) }
    try {
      const cbRes = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', { cache: 'no-store' })
      if (cbRes.ok) {
        const j = await cbRes.json()
        const r = j?.data?.rates || {}
        for (const c of FIAT) {
          if (r[c]) { const v = Number(r[c]); if (v && isFinite(v)) fx[c] = v }
        }
        for (const c of CRYPTO) {
          if (c === 'AUR') continue
          if (r[c]) { const v = Number(r[c]); if (v && isFinite(v) && v > 0) base_crypto_usd[c] = 1 / v }
        }
        base_crypto_usd.USDT = 1; base_crypto_usd.USDC = 1
      }
    } catch (e) { /* keep prior */ }
    try {
      const fxRes = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
      if (fxRes.ok) {
        const j = await fxRes.json()
        if (j && j.rates) for (const c of FIAT) if (j.rates[c] && !fx[c]) fx[c] = j.rates[c]
      }
    } catch (e) { /* keep prior */ }
    baseDoc = { id: 'live', fx, base_crypto_usd, crypto_history: cached?.crypto_history || {}, updated_at: now() }
    await db.collection('rates').updateOne({ id: 'live' }, { $set: baseDoc }, { upsert: true })
  }
  // Apply per-call jitter: keeps prices anchored to real Coinbase base but adds micro-movement so tickers feel live.
  // Stablecoins (USDT/USDC) don't jitter. Volatile coins get ±0.15%, mid ±0.08%, majors ±0.05%.
  const jitterPct = { BTC: 0.05, ETH: 0.05, USDT: 0, USDC: 0, BNB: 0.08, SOL: 0.15, XRP: 0.15, ADA: 0.15, DOGE: 0.25, MATIC: 0.15, AVAX: 0.15, DOT: 0.15, TRX: 0.10, LINK: 0.10, ATOM: 0.15, LTC: 0.10, BCH: 0.10, XLM: 0.15, NEAR: 0.15, APT: 0.20, ARB: 0.15, OP: 0.15, SUI: 0.20, TON: 0.10, SHIB: 0.30, PEPE: 0.40, INJ: 0.20, FIL: 0.15, ICP: 0.15, HBAR: 0.15 }
  const crypto_usd = {}
  for (const [c, base] of Object.entries(baseDoc.base_crypto_usd || {})) {
    const j = (jitterPct[c] ?? 0.10) / 100
    const noise = (Math.random() - 0.5) * 2 * j
    crypto_usd[c] = Math.max(0, base * (1 + noise))
  }
  // Append to rolling history (per-asset, last 120 points), skipping AUR (has its own)
  const prevHist = baseDoc.crypto_history || {}
  const tNow = Date.now()
  const crypto_history = { ...prevHist }
  for (const c of Object.keys(crypto_usd)) {
    if (c === 'AUR') continue
    const arr = Array.isArray(prevHist[c]) ? [...prevHist[c]] : []
    arr.push({ t: tNow, p: crypto_usd[c] })
    crypto_history[c] = arr.slice(-120)
  }
  await db.collection('rates').updateOne({ id: 'live' }, { $set: { crypto_history } })
  // AUR from its own simulator
  const aur = await computeAurPrice(db, baseDoc.fx)
  crypto_usd.AUR = aur.price_usd
  return { fx: baseDoc.fx, crypto_usd, crypto_history, aur, updated_at: baseDoc.updated_at }
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

// ---------- External withdrawal fee engine ----------
// Fee = tiered percentage of the gross amount (by USD value) + a flat "rail" cost for the network / payout method,
// then clamped to [min_fee_usd, max_fee_usd]. The fee is DEDUCTED from the amount: the wallet is debited the gross
// amount the user typed and the beneficiary receives gross − fee. Admins can edit everything (tiers, rails, min/max)
// and override any of it per currency. Applies to fiat AND crypto alike. Defaults follow the operator's rule
// (10% below $10k) and, above that, market practice: remittance / exchange-style 1% → OTC & private-banking
// 0.5% → 0.15%, plus typical exchange network costs & bank wire fees.
const WITHDRAW_FEE_DEFAULTS = {
  enabled: true,
  tiers: [
    { min_usd: 0,         max_usd: 10000,   percent: 10,   label: 'Standard' },
    { min_usd: 10000,     max_usd: 100000,  percent: 1,    label: 'Premium' },
    { min_usd: 100000,    max_usd: 1000000, percent: 0.5,  label: 'High value' },
    { min_usd: 1000000,   max_usd: null,    percent: 0.15, label: 'Institutional' },
  ],
  min_fee_usd: 1,
  max_fee_usd: null,
  // Flat cost per crypto network / fiat payout method, in USD (converted to the asset at quote time).
  // Benchmarked against major exchanges' withdrawal fees and bank outgoing-wire fees.
  rails: {
    ERC20: 5, TRC20: 1, BEP20: 0.3, Polygon: 0.1, Solana: 0.05, Bitcoin: 3, XRP: 0.02, Cardano: 0.2, Dogecoin: 0.5,
    Avalanche: 0.1, Polkadot: 0.15, Cosmos: 0.05, Litecoin: 0.1, BitcoinCash: 0.05, Stellar: 0.01, NEAR: 0.05, Aptos: 0.05,
    Arbitrum: 0.3, Optimism: 0.3, Sui: 0.05, TON: 0.1, Aurela: 0, External: 1,
    bank_swift: 25, bank_indian: 2, upi: 0, paypal: 1, stripe: 2, card: 2, sepa: 1, ach: 3, wise: 2,
  },
  // Per-currency overrides: { [code]: { enabled?, tiers?, min_fee_usd?, max_fee_usd?, rail_fee_usd? } }
  currencies: {},
}
function normalizeTiers(tiers) {
  const list = (Array.isArray(tiers) ? tiers : []).map(t => ({
    min_usd: Math.max(0, Number(t.min_usd) || 0),
    max_usd: (t.max_usd === null || t.max_usd === undefined || t.max_usd === '') ? null : Math.max(0, Number(t.max_usd) || 0),
    percent: Math.min(100, Math.max(0, Number(t.percent) || 0)),
    label: String(t.label || '').slice(0, 40),
  })).sort((a, b) => a.min_usd - b.min_usd)
  return list
}
function validateTiers(tiers) {
  if (!tiers.length) return 'At least one fee tier is required'
  if (tiers[0].min_usd !== 0) return 'The first tier must start at $0'
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i], nx = tiers[i + 1]
    if (t.max_usd !== null && t.max_usd <= t.min_usd) return `Tier ${i + 1}: upper bound must be greater than its lower bound`
    if (nx) {
      if (t.max_usd === null) return `Tier ${i + 1}: only the last tier may be open-ended`
      if (Math.abs(nx.min_usd - t.max_usd) > 1e-6) return `Tier ${i + 2} must start where tier ${i + 1} ends ($${t.max_usd.toLocaleString('en-US')})`
    }
  }
  return null
}
async function getWithdrawFeeSchedule(db) {
  const s = await db.collection('settings').findOne({ id: 'platform' }, { projection: { withdraw_fees: 1 } })
  const saved = s?.withdraw_fees || {}
  return {
    enabled: saved.enabled !== undefined ? !!saved.enabled : WITHDRAW_FEE_DEFAULTS.enabled,
    tiers: normalizeTiers(saved.tiers?.length ? saved.tiers : WITHDRAW_FEE_DEFAULTS.tiers),
    min_fee_usd: saved.min_fee_usd !== undefined ? Number(saved.min_fee_usd) || 0 : WITHDRAW_FEE_DEFAULTS.min_fee_usd,
    max_fee_usd: (saved.max_fee_usd === null || saved.max_fee_usd === undefined) ? (saved.min_fee_usd !== undefined ? null : WITHDRAW_FEE_DEFAULTS.max_fee_usd) : Number(saved.max_fee_usd),
    rails: { ...WITHDRAW_FEE_DEFAULTS.rails, ...(saved.rails || {}) },
    currencies: saved.currencies || {},
    updated_at: saved.updated_at || null,
  }
}
function pickTier(tiers, usd) {
  return tiers.find(t => usd >= t.min_usd && (t.max_usd === null || usd < t.max_usd)) || tiers[tiers.length - 1]
}
const roundAsset = (v, currency) => {
  const dp = CRYPTO.includes(currency) ? 8 : 2
  return Number(Number(v).toFixed(dp))
}
// Returns { gross, fee, net, fee_usd, gross_usd, net_usd, currency, breakdown }
function quoteWithdrawFee(schedule, { amount, currency, network, method }, rates) {
  const gross = Number(amount) || 0
  const rate_usd = convertToUSD(1, currency, rates) || 0
  const gross_usd = gross * rate_usd
  const override = schedule.currencies?.[currency] || {}
  const zero = (reason) => ({ gross, fee: 0, net: gross, fee_usd: 0, gross_usd, net_usd: gross_usd, currency, breakdown: { waived: true, reason, percent: 0, percent_fee: 0, rail_fee: 0, rail_fee_usd: 0, tier_label: null, min_applied: false, max_applied: false, rate_usd } })
  if (!schedule.enabled) return zero('Fees disabled')
  if (override.enabled === false) return zero(`No fee for ${currency}`)
  const tiers = normalizeTiers(override.tiers?.length ? override.tiers : schedule.tiers)
  const tier = pickTier(tiers, gross_usd)
  const percent = tier?.percent || 0
  const percent_fee_usd = gross_usd * percent / 100
  const railKey = CRYPTO.includes(currency) ? (network || 'External') : (method || 'bank_swift')
  const rail_fee_usd = override.rail_fee_usd !== undefined && override.rail_fee_usd !== null ? Number(override.rail_fee_usd) || 0 : (Number(schedule.rails?.[railKey]) || 0)
  let fee_usd = percent_fee_usd + rail_fee_usd
  const min_fee_usd = override.min_fee_usd !== undefined && override.min_fee_usd !== null ? Number(override.min_fee_usd) || 0 : (Number(schedule.min_fee_usd) || 0)
  const max_fee_usd = override.max_fee_usd !== undefined && override.max_fee_usd !== null ? Number(override.max_fee_usd) : schedule.max_fee_usd
  let min_applied = false, max_applied = false
  if (fee_usd < min_fee_usd) { fee_usd = min_fee_usd; min_applied = true }
  if (max_fee_usd !== null && max_fee_usd !== undefined && Number.isFinite(Number(max_fee_usd)) && fee_usd > Number(max_fee_usd)) { fee_usd = Number(max_fee_usd); max_applied = true }
  const toAsset = (usd) => rate_usd > 0 ? usd / rate_usd : 0
  let fee = roundAsset(toAsset(fee_usd), currency)
  if (fee > gross) fee = gross
  const net = roundAsset(gross - fee, currency)
  return {
    gross, fee, net, currency,
    fee_usd: Number(fee_usd.toFixed(2)), gross_usd: Number(gross_usd.toFixed(2)), net_usd: Number((gross_usd - fee_usd).toFixed(2)),
    breakdown: {
      waived: false, percent, percent_fee: roundAsset(toAsset(percent_fee_usd), currency), percent_fee_usd: Number(percent_fee_usd.toFixed(2)),
      rail: railKey, rail_fee: roundAsset(toAsset(rail_fee_usd), currency), rail_fee_usd,
      tier_label: tier?.label || null, tier_min_usd: tier?.min_usd ?? 0, tier_max_usd: tier?.max_usd ?? null,
      min_fee_usd, max_fee_usd: max_fee_usd ?? null, min_applied, max_applied, rate_usd,
      currency_override: !!schedule.currencies?.[currency],
    },
  }
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

    // -------- App version — used by the client update-banner poll --------
    // Returns the currently deployed version + a build timestamp. Clients cache the version
    // in localStorage and show an "Update available" banner when the server ships a newer one.
    if (route === '/version' && method === 'GET') {
      return handleCORS(NextResponse.json({
        version: APP_VERSION,
        build_time: BUILD_TIME,
        min_supported_client: APP_VERSION,   // hard-cut version; clients older than this get force-refreshed
        changelog: 'Swap, Portfolio Chart, Push Notifications, Deep Links, Chain Scan, Partners.',
        whats_new_title: 'Aurela Updated',
        whats_new: WHATS_NEW,
      }))
    }

    // -------- Public Chain (no auth — enables SEO-indexable block explorer at /scan) --------
    if (route === '/public/chain' && method === 'GET') {
      simulateChainTick(db).catch(() => {})   // keep the chain alive from the public feed too
      const url = new URL(request.url)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
      const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1)
      const skip = (page - 1) * limit
      const total = await db.collection('aurela_chain').estimatedDocumentCount()
      const blocks = await db.collection('aurela_chain').find({}, { projection: { _id: 0, from_user_id: 0, to_user_id: 0, tx_id: 0 } }).sort({ block_number: -1 }).skip(skip).limit(limit).toArray()
      return handleCORS(NextResponse.json({ total, page, limit, blocks: clean(blocks) }))
    }
    if (route === '/public/chain/stats' && method === 'GET') {
      simulateChainTick(db).catch(() => {})
      const total = await db.collection('aurela_chain').estimatedDocumentCount()
      const latest = await db.collection('aurela_chain').find({}, { projection: { _id: 0, block_number: 1, timestamp: 1, type: 1, currency: 1 } }).sort({ block_number: -1 }).limit(1).toArray()
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const dailyBlocks = await db.collection('aurela_chain').countDocuments({ timestamp: { $gte: dayAgo } })
      const users = await db.collection('users').estimatedDocumentCount()
      return handleCORS(NextResponse.json({
        total_blocks: total,
        latest_block: latest?.[0]?.block_number || 0,
        latest_timestamp: latest?.[0]?.timestamp || null,
        blocks_24h: dailyBlocks,
        avg_block_time_seconds: dailyBlocks > 0 ? Math.round((24 * 60 * 60) / dailyBlocks) : null,
        network: 'Aurela Mainnet',
        chain_id: 'AURELA-1',
        registered_addresses: users,
      }))
    }
    if (route === '/public/chain/search' && method === 'GET') {
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()
      if (!q) return handleCORS(NextResponse.json({ error: 'empty query' }, { status: 400 }))
      // Try block number, block hash, or Aurela ID
      if (/^\d+$/.test(q)) {
        const b = await db.collection('aurela_chain').findOne({ block_number: parseInt(q) }, { projection: { _id: 0, from_user_id: 0, to_user_id: 0, tx_id: 0 } })
        if (b) return handleCORS(NextResponse.json({ kind: 'block', block: clean(b) }))
      }
      if (q.startsWith('0x') || q.length >= 32) {
        const b = await db.collection('aurela_chain').findOne({ hash: q }, { projection: { _id: 0, from_user_id: 0, to_user_id: 0, tx_id: 0 } })
        if (b) return handleCORS(NextResponse.json({ kind: 'block', block: clean(b) }))
      }
      if (/^AUR\d+$/i.test(q)) {
        const code = q.toUpperCase()
        const u = await db.collection('users').findOne({ user_code: code }, { projection: { _id: 0, id: 1, user_code: 1, created_at: 1 } })
        if (u) {
          const blocks = await db.collection('aurela_chain').find({ $or: [{ from_username: code }, { to_username: code }] }, { projection: { _id: 0, from_user_id: 0, to_user_id: 0, tx_id: 0 } }).sort({ block_number: -1 }).limit(50).toArray()
          return handleCORS(NextResponse.json({ kind: 'address', address: { code, joined: u.created_at }, blocks: clean(blocks) }))
        }
      }
      return handleCORS(NextResponse.json({ kind: 'not_found' }))
    }
    if (route === '/rates' && method === 'GET') {
      // Fire-and-forget chain simulation tick (writes 1 block if enough time has elapsed)
      simulateChainTick(db).catch(() => {})
      const r = await getRates(db)
      // Compute % change vs first history point (used for live tickers with mini-arrows)
      const change = {}
      const hist = r.crypto_history || {}
      for (const c of Object.keys(r.crypto_usd || {})) {
        const arr = hist[c] || []
        if (arr.length >= 2) {
          const first = arr[0].p, last = arr[arr.length-1].p
          if (first > 0) change[c] = ((last - first) / first) * 100
        }
      }
      // Include AUR change from its own history
      if (r.aur?.history?.length >= 2) {
        const f = r.aur.history[0].usd, l = r.aur.history[r.aur.history.length-1].usd
        if (f > 0) change.AUR = ((l - f) / f) * 100
      }
      return handleCORS(NextResponse.json({
        fx: r.fx,
        crypto_usd: r.crypto_usd,
        crypto_history: r.crypto_history,
        crypto_change: change,
        aur: r.aur,
        updated_at: r.updated_at
      }))
    }

    // -------- Web Push: public VAPID key --------
    if (route === '/push/config' && method === 'GET') {
      const v = await db.collection('system').findOne({ id: 'vapid' })
      return handleCORS(NextResponse.json({ public_key: v?.public || null }))
    }

    // -------- Public /pay preview — looks up a recipient by Aurela ID (no auth) --------
    if (route === '/pay/lookup' && method === 'GET') {
      const url = new URL(request.url)
      const code = (url.searchParams.get('to') || '').trim().toUpperCase()
      if (!/^AUR\d+$/.test(code)) return handleCORS(NextResponse.json({ error: 'Invalid Aurela ID' }, { status: 400 }))
      const u = await db.collection('users').findOne({ user_code: code }, { projection: { _id: 0, user_code: 1, first_name: 1, last_name: 1, country: 1, created_at: 1 } })
      if (!u) return handleCORS(NextResponse.json({ error: 'Recipient not found' }, { status: 404 }))
      return handleCORS(NextResponse.json({
        recipient: {
          code: u.user_code,
          name: (u.first_name || '') + (u.last_name ? ' ' + u.last_name[0] + '.' : ''),
          country: u.country || null,
          joined: u.created_at,
        }
      }))
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
        enabled_fiat: s?.enabled_fiat || FIAT,
        enabled_crypto: s?.enabled_crypto || CRYPTO,
        all_fiat: FIAT,
        all_crypto: CRYPTO,
        enabled_deposit_methods: s?.enabled_deposit_methods || [...ALL_FIAT_METHODS, ALL_CRYPTO_METHOD],
        enabled_withdrawal_methods: s?.enabled_withdrawal_methods || [...ALL_FIAT_METHODS, ALL_CRYPTO_METHOD],
        all_deposit_methods: [...ALL_FIAT_METHODS, ALL_CRYPTO_METHOD],
        all_withdrawal_methods: [...ALL_FIAT_METHODS, ALL_CRYPTO_METHOD],
        apk_url: s?.apk_url || '',
        apk_version: s?.apk_version || '',
        withdraw_fees: await (async () => { const f = await getWithdrawFeeSchedule(db); return { enabled: f.enabled, tiers: f.tiers, min_fee_usd: f.min_fee_usd, max_fee_usd: f.max_fee_usd } })(),
      }))
    }

    // ---------- Auth ----------
    if (route === '/auth/register/init' && method === 'POST') {
      const body = await request.json()
      // All fields are mandatory — trim so whitespace-only values are rejected too
      const email = String(body?.email || '').trim()
      const password = String(body?.password || '')
      const first_name = String(body?.first_name || '').trim()
      const last_name = String(body?.last_name || '').trim()
      const phone = String(body?.phone || '').trim()
      const country = String(body?.country || '').trim()
      const full_name = String(body?.full_name || '').trim()
      if (!email || !password.trim() || !first_name || !last_name || !phone || !country) return handleCORS(NextResponse.json({ error: 'All fields are required — first name, last name, email, country, mobile, and password.' }, { status: 400 }))
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return handleCORS(NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 }))
      if (phone.replace(/\D/g, '').length < 6) return handleCORS(NextResponse.json({ error: 'Please enter a valid mobile number' }, { status: 400 }))
      if (password.length < 8) return handleCORS(NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 }))
      const exists = await db.collection('users').findOne({ email: email.toLowerCase() })
      if (exists) return handleCORS(NextResponse.json({ error: 'Email already registered' }, { status: 400 }))
      // Auto-generate username from first name + short random suffix (guaranteed unique)
      const base = String(first_name).toLowerCase().replace(/[^a-z0-9]/g,'').slice(0, 10) || 'user'
      let username = base + randDigits(4)
      for (let i = 0; i < 6 && await db.collection('users').findOne({ username }); i++) username = base + randDigits(5)
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const otpDoc = {
        id: uuidv4(),
        email: email.toLowerCase(),
        username,
        full_name: full_name || `${first_name} ${last_name}`.trim(),
        first_name, last_name, country, phone: phone || '',
        password_hash_pending: null, salt_pending: null,
        code, expires_at: new Date(Date.now() + 10 * 60 * 1000),
        purpose: 'signup', created_at: now(),
      }
      const salt = newSalt()
      otpDoc.salt_pending = salt
      otpDoc.password_hash_pending = hashPassword(password, salt)
      await db.collection('pending_signups').deleteMany({ email: email.toLowerCase() })
      await db.collection('pending_signups').insertOne(otpDoc)
      const emailRes = await sendEmailOTP(email, code, 'signup')
      const response = { ok: true, message: 'Verification code sent to your email.', signup_id: otpDoc.id }
      if (!emailRes.delivered) {
        response.dev_otp = code
        response.email_error = emailRes.error || null
      }
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
      // Aurela ID — like Binance ID / user code. Format: AUR-XXXXXXXX (8-digit unique)
      let user_code = 'AUR' + randDigits(9)
      for (let i = 0; i < 6 && await db.collection('users').findOne({ user_code }); i++) user_code = 'AUR' + randDigits(9)
      const user = {
        id: uuidv4(),
        user_code,
        email: pending.email,
        username: pending.username,
        first_name: pending.first_name || '',
        last_name: pending.last_name || '',
        full_name: pending.full_name,
        phone: pending.phone,
        country: pending.country || '',
        role: 'user', status: 'active', preferred_currency: 'USD',
        kyc_status: 'unverified', two_fa_enabled: false,
        email_verified: true, phone_verified: false,
        auth_providers: ['password'],
        salt: pending.salt_pending, password_hash: pending.password_hash_pending,
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
      if (!emailRes.delivered) { response.dev_otp = code; response.email_error = emailRes.error || null }
      return handleCORS(NextResponse.json(response))
    }

    // Forgot password — 2 step OTP reset
    if (route === '/auth/forgot/init' && method === 'POST') {
      const body = await request.json()
      const email = String(body?.email || '').toLowerCase()
      if (!email) return handleCORS(NextResponse.json({ error: 'Email required' }, { status: 400 }))
      const target = await db.collection('users').findOne({ email })
      // Always respond 200 to avoid email enumeration
      if (target) {
        const code = String(Math.floor(100000 + Math.random() * 900000))
        await db.collection('password_resets').deleteMany({ email })
        await db.collection('password_resets').insertOne({ id: uuidv4(), email, code, user_id: target.id, expires_at: new Date(Date.now() + 15 * 60 * 1000), created_at: now() })
        const emailRes = await sendEmailOTP(email, code, 'password_reset')
        const response = { ok: true, message: 'If an account exists, a reset code has been sent.' }
        if (!emailRes.delivered) { response.dev_otp = code; response.email_error = emailRes.error || null }
        return handleCORS(NextResponse.json(response))
      }
      return handleCORS(NextResponse.json({ ok: true, message: 'If an account exists, a reset code has been sent.' }))
    }
    if (route === '/auth/forgot/verify' && method === 'POST') {
      const body = await request.json()
      const email = String(body?.email || '').toLowerCase()
      const { code, new_password } = body || {}
      if (!email || !code || !new_password) return handleCORS(NextResponse.json({ error: 'Missing fields' }, { status: 400 }))
      if (String(new_password).length < 8) return handleCORS(NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 }))
      const rec = await db.collection('password_resets').findOne({ email })
      if (!rec) return handleCORS(NextResponse.json({ error: 'Invalid or expired reset request' }, { status: 400 }))
      if (new Date(rec.expires_at) < new Date()) { await db.collection('password_resets').deleteOne({ id: rec.id }); return handleCORS(NextResponse.json({ error: 'Reset code expired' }, { status: 400 })) }
      if (String(code) !== String(rec.code)) return handleCORS(NextResponse.json({ error: 'Invalid reset code' }, { status: 400 }))
      const salt = newSalt()
      const password_hash = hashPassword(new_password, salt)
      await db.collection('users').updateOne({ id: rec.user_id }, { $set: { salt, password_hash } })
      await db.collection('password_resets').deleteOne({ id: rec.id })
      await db.collection('sessions').deleteMany({ user_id: rec.user_id }) // force re-login everywhere
      await audit(db, rec.user_id, 'auth.password_reset', {})
      return handleCORS(NextResponse.json({ ok: true }))
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
      // Resolve per-user card fees so frontend sees the effective price (override or global)
      const settings = await db.collection('settings').findOne({ id: 'platform' })
      const globalFees = settings?.card_activation_fees || { basic: 10, premium: 50, elite: 200 }
      const cardFees = {}
      for (const tier of ['basic','premium','elite']) {
        const override = user?.card_fee_overrides?.[tier]
        cardFees[tier] = (typeof override === 'number' && override >= 0) ? override : (globalFees[tier] ?? CARD_TIERS[tier]?.activation_fee_usdt ?? 0)
      }
      return handleCORS(NextResponse.json({ user: clean(user), card_fees: cardFees }))
    }

    // Location capture — called by the app on every login/open. Body: { lat, lng, accuracy, device } or { denied: true, device }
    if (route === '/location' && method === 'POST') {
      const user = await getUserByToken(db, request)
      if (!user) return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const body = await request.json().catch(() => ({}))
      const ip = clientIpFromRequest(request)
      const device = {
        user_agent: String(body?.device?.user_agent || request.headers.get('user-agent') || '').slice(0, 400),
        platform: body?.device?.platform ? String(body.device.platform).slice(0, 80) : null,
        language: body?.device?.language ? String(body.device.language).slice(0, 20) : null,
        screen: body?.device?.screen ? String(body.device.screen).slice(0, 30) : null,
        timezone: body?.device?.timezone ? String(body.device.timezone).slice(0, 60) : null,
        standalone: !!body?.device?.standalone,
      }
      const ipGeo = await ipGeolocate(ip)
      if (body?.denied) {
        const rec = { id: uuidv4(), user_id: user.id, status: 'denied', ip, ip_geo: ipGeo, device, created_at: now() }
        await db.collection('user_locations').insertOne(rec)
        await db.collection('users').updateOne({ id: user.id }, { $set: { location_denied_at: now(), last_location: { status: 'denied', ip, ip_geo: ipGeo, device, at: now() } } })
        return handleCORS(NextResponse.json({ ok: true, status: 'denied' }))
      }
      const lat = Number(body?.lat), lng = Number(body?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return handleCORS(NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 }))
      // Silent background updates arrive often: reuse the previous address if the user hasn't moved (~<1 km)
      // instead of calling the geocoder every time, and avoid piling up identical history rows.
      const prev = user.last_location?.status === 'granted' ? user.last_location : null
      const movedKm = prev && Number.isFinite(Number(prev.lat)) ? haversineKm(prev.lat, prev.lng, lat, lng) : Infinity
      const sameIp = prev && prev.ip === ip
      let address = null
      if (prev && movedKm < 1 && prev.country) {
        address = { city: prev.city, state: prev.state, country: prev.country, country_code: prev.country_code, display: null }
      } else {
        address = await reverseGeocode(lat, lng)
      }
      const rec = {
        id: uuidv4(), user_id: user.id, status: 'granted',
        lat, lng, accuracy_m: Number.isFinite(Number(body?.accuracy)) ? Math.round(Number(body.accuracy)) : null,
        address, ip, ip_geo: ipGeo, device, created_at: now(),
      }
      const prevAt = prev?.at ? new Date(prev.at).getTime() : 0
      const isDuplicate = prev && movedKm < 0.2 && sameIp && (Date.now() - prevAt) < 60 * 60 * 1000
      if (!isDuplicate) await db.collection('user_locations').insertOne(rec)
      const summary = { status: 'granted', lat, lng, accuracy_m: rec.accuracy_m, city: address?.city || ipGeo?.city || null, state: address?.state || ipGeo?.region || null, country: address?.country || ipGeo?.country || null, country_code: address?.country_code || ipGeo?.country_code || null, ip, isp: ipGeo?.isp || prev?.isp || null, device, at: now(), updates: (Number(prev?.updates) || 0) + 1 }
      await db.collection('users').updateOne({ id: user.id }, { $set: { last_location: summary }, $unset: { location_denied_at: '' } })
      return handleCORS(NextResponse.json({ ok: true, status: 'granted', location: { city: summary.city, country: summary.country } }))
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
      const u = await getUserByToken(db, request)
      if (!u) return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const blocks = await db.collection('aurela_chain').find({
        $or: [{ from_user_id: u.id }, { to_user_id: u.id }]
      }).sort({ block_number: -1 }).limit(100).toArray()
      return handleCORS(NextResponse.json({ blocks: clean(blocks) }))
    }
    // Explorer search — matches hash, block number, username, email, wallet address
    if (route === '/chain/search' && method === 'GET') {
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()
      if (!q) return handleCORS(NextResponse.json({ blocks: [], users: [], wallets: [] }))
      const blockNum = parseInt(q, 10)
      const blockOr = [
        { hash: { $regex: q, $options: 'i' } },
        { prev_hash: { $regex: q, $options: 'i' } },
        { from_username: { $regex: q, $options: 'i' } },
        { to_username: { $regex: q, $options: 'i' } },
        { destination: { $regex: q, $options: 'i' } },
        { currency: q.toUpperCase() },
      ]
      if (!Number.isNaN(blockNum)) blockOr.push({ block_number: blockNum })
      const blocks = await db.collection('aurela_chain').find({ $or: blockOr }).sort({ block_number: -1 }).limit(50).toArray()
      const users = await db.collection('users').find({
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { full_name: { $regex: q, $options: 'i' } },
        ]
      }).project({ id: 1, username: 1, email: 1, full_name: 1, kyc_status: 1, avatar: 1, role: 1 }).limit(20).toArray()
      const wallets = await db.collection('wallets').find({
        $or: [
          { address: { $regex: q, $options: 'i' } },
          { id: { $regex: q, $options: 'i' } },
        ]
      }).limit(20).toArray()
      const walletUserIds = [...new Set(wallets.map(w => w.user_id))]
      const walletUsers = walletUserIds.length ? await db.collection('users').find({ id: { $in: walletUserIds } }).project({ id: 1, username: 1, avatar: 1 }).toArray() : []
      const userById = Object.fromEntries(walletUsers.map(u => [u.id, u]))
      const walletsOut = wallets.map(w => ({ ...clean(w), owner: userById[w.user_id] ? clean(userById[w.user_id]) : null }))
      return handleCORS(NextResponse.json({ blocks: clean(blocks), users: clean(users), wallets: walletsOut }))
    }
    // Full block detail
    if (route.startsWith('/chain/tx/') && method === 'GET') {
      const hash = route.split('/')[3]
      const block = await db.collection('aurela_chain').findOne({ hash })
      if (!block) return handleCORS(NextResponse.json({ error: 'Block not found' }, { status: 404 }))
      const [prev, next] = await Promise.all([
        block.block_number > 0 ? db.collection('aurela_chain').findOne({ block_number: block.block_number - 1 }) : null,
        db.collection('aurela_chain').findOne({ block_number: block.block_number + 1 }),
      ])
      let tx = null
      if (block.tx_id) tx = await db.collection('transactions').findOne({ id: block.tx_id })
      return handleCORS(NextResponse.json({
        block: clean(block),
        prev: prev ? { block_number: prev.block_number, hash: prev.hash } : null,
        next: next ? { block_number: next.block_number, hash: next.hash } : null,
        transaction: tx ? clean(tx) : null,
      }))
    }
    // Full detail of one address / wallet
    if (route.startsWith('/chain/address/') && method === 'GET') {
      const addr = decodeURIComponent(route.split('/')[3])
      const wallet = await db.collection('wallets').findOne({ $or: [{ address: addr }, { id: addr }] })
      if (!wallet) return handleCORS(NextResponse.json({ error: 'Address not found' }, { status: 404 }))
      const owner = await db.collection('users').findOne({ id: wallet.user_id })
      const blocks = await db.collection('aurela_chain').find({
        $or: [{ from_user_id: wallet.user_id, currency: wallet.currency }, { to_user_id: wallet.user_id, currency: wallet.currency }]
      }).sort({ block_number: -1 }).limit(200).toArray()
      const stats = { incoming: 0, outgoing: 0, count: blocks.length }
      for (const b of blocks) {
        if (b.to_user_id === wallet.user_id) stats.incoming += b.amount || 0
        if (b.from_user_id === wallet.user_id) stats.outgoing += b.amount || 0
      }
      return handleCORS(NextResponse.json({
        wallet: clean(wallet),
        owner: owner ? { id: owner.id, username: owner.username, avatar: owner.avatar || null, kyc_status: owner.kyc_status, full_name: owner.full_name } : null,
        blocks: clean(blocks),
        stats,
      }))
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

    // Change password (authenticated)
    if (route === '/profile/password' && method === 'POST') {
      const body = await request.json()
      const { current_password, new_password } = body || {}
      if (!current_password || !new_password) return handleCORS(NextResponse.json({ error: 'Missing fields' }, { status: 400 }))
      if (String(new_password).length < 8) return handleCORS(NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 }))
      const u2 = await db.collection('users').findOne({ id: user.id })
      const ok = u2?.password_hash && u2.password_hash === hashPassword(current_password, u2.salt)
      if (!ok) return handleCORS(NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 }))
      const salt = newSalt()
      const password_hash = hashPassword(new_password, salt)
      await db.collection('users').updateOne({ id: user.id }, { $set: { salt, password_hash } })
      await audit(db, user.id, 'profile.password_change', {})
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // User notifications (per-user notification bell)
    if (route === '/notifications' && method === 'GET') {
      const list = await db.collection('user_notifications').find({ user_id: user.id }).sort({ created_at: -1 }).limit(50).toArray()
      const unread = await db.collection('user_notifications').countDocuments({ user_id: user.id, read: false })
      return handleCORS(NextResponse.json({ notifications: clean(list), unread }))
    }
    if (route === '/notifications/read' && method === 'POST') {
      await db.collection('user_notifications').updateMany({ user_id: user.id, read: false }, { $set: { read: true, read_at: now() } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // Claim AUR welcome reward — only after KYC approved
    if (route === '/claim/welcome' && method === 'POST') {
      const reward = await db.collection('user_rewards').findOne({ user_id: user.id, type: 'aur_welcome', status: 'pending' })
      if (!reward) return handleCORS(NextResponse.json({ error: 'No pending welcome reward — either already claimed or not eligible.' }, { status: 400 }))
      if (user.kyc_status !== 'approved') return handleCORS(NextResponse.json({ error: 'Complete identity verification (KYC) to claim your reward.', code: 'KYC_REQUIRED' }, { status: 403 }))
      const w = await db.collection('wallets').findOne({ user_id: user.id, currency: 'AUR' })
      if (!w) return handleCORS(NextResponse.json({ error: 'AUR wallet not found' }, { status: 404 }))
      await db.collection('wallets').updateOne({ id: w.id }, { $inc: { balance: reward.amount } })
      await db.collection('user_rewards').updateOne({ id: reward.id }, { $set: { status: 'claimed', claimed_at: now() } })
      await writeBlock(db, { type: 'reward', currency: 'AUR', amount: reward.amount, network: 'Aurela', to_user_id: user.id, from_username: 'aurela_treasury', method: 'welcome_bonus' })
      await notifyUser(db, user.id, { kind: 'reward', title: 'Welcome reward claimed', body: `You just claimed ${reward.amount} AUR — welcome to Aurela.` })
      await audit(db, user.id, 'reward.claim', { type: 'aur_welcome', amount: reward.amount })
      return handleCORS(NextResponse.json({ ok: true, credited: reward.amount, currency: 'AUR' }))
    }
    // Reward status check (frontend uses this to show the pop-up)
    if (route === '/claim/status' && method === 'GET') {
      const reward = await db.collection('user_rewards').findOne({ user_id: user.id, type: 'aur_welcome' })
      return handleCORS(NextResponse.json({
        has_reward: !!reward,
        status: reward?.status || null,
        amount: reward?.amount || 5,
        currency: 'AUR',
        kyc_status: user.kyc_status || 'unverified',
        eligible: reward?.status === 'pending' && user.kyc_status === 'approved',
      }))
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
      if (user.kyc_status === 'pending') return handleCORS(NextResponse.json({ error: 'Your previous submission is still under review' }, { status: 400 }))
      if (user.kyc_status === 'approved') return handleCORS(NextResponse.json({ error: 'Your identity is already verified' }, { status: 400 }))
      const s = (k) => String(body?.[k] ?? '').trim()
      // Every KYC field is mandatory (text fields + all three document images)
      const REQUIRED_KYC_FIELDS = [
        ['first_name', 'First name'], ['last_name', 'Last name'], ['dob', 'Date of birth'], ['country', 'Country'],
        ['state', 'State / Province'], ['city', 'City'], ['address', 'Full address'], ['postal_code', 'Postal / ZIP code'],
        ['mobile', 'Mobile number'], ['occupation', 'Occupation'], ['id_type', 'Document type'], ['id_number', 'Document number'],
        ['doc_front', 'Document front image'], ['doc_back', 'Document back image'], ['selfie', 'Selfie holding document'],
      ]
      const missing = REQUIRED_KYC_FIELDS.filter(([k]) => !(k === 'mobile' ? (s('mobile') || s('phone')) : s(k))).map(([, label]) => label)
      if (missing.length) return handleCORS(NextResponse.json({ error: `All fields are required. Missing: ${missing.join(', ')}`, missing }, { status: 400 }))
      const dobDate = new Date(s('dob'))
      if (Number.isNaN(dobDate.getTime()) || dobDate > new Date()) return handleCORS(NextResponse.json({ error: 'Please enter a valid date of birth' }, { status: 400 }))
      for (const k of ['doc_front', 'doc_back', 'selfie']) {
        if (!/^data:image\//.test(s(k))) return handleCORS(NextResponse.json({ error: `${k === 'selfie' ? 'Selfie' : k === 'doc_front' ? 'Document front' : 'Document back'} must be an image upload` }, { status: 400 }))
      }
      const fullName = [s('first_name'), s('last_name')].join(' ').trim()
      const doc = {
        id: uuidv4(), user_id: user.id,
        first_name: s('first_name'),
        last_name: s('last_name'),
        full_name: fullName,
        dob: s('dob'),
        country: s('country'),
        state: s('state'),
        city: s('city'),
        address: s('address'),
        postal_code: s('postal_code'),
        mobile: s('mobile') || s('phone'),
        occupation: s('occupation'),
        id_type: s('id_type'),
        id_number: s('id_number'),
        doc_front: s('doc_front'),   // base64 data URI
        doc_back: s('doc_back'),     // base64 data URI
        selfie: s('selfie'),         // base64 data URI
        status: 'pending',
        submitted_at: now()
      }
      await db.collection('kyc').insertOne(doc)
      const userUpd = { kyc_status: 'pending', phone: doc.mobile }
      if (fullName && fullName !== user.full_name) userUpd.full_name = fullName
      // A fresh submission clears any previous rejection reason
      await db.collection('users').updateOne({ id: user.id }, { $set: userUpd, $unset: { kyc_rejection_reason: '', kyc_rejected_at: '' } })
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
      // Fire-and-forget daily portfolio snapshot (for the 30-day chart)
      snapshotPortfolio(db, user.id).catch(()=>{})
      return handleCORS(NextResponse.json({
        wallets: enriched,
        totals: { usd: totalUSD, preferred: totalPreferred, preferred_currency: user.preferred_currency }
      }))
    }

    // -------- Portfolio history (30-day chart) --------
    if (route === '/portfolio/history' && method === 'GET') {
      const url = new URL(request.url)
      const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30'), 1), 365)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      // Make sure today is captured
      await snapshotPortfolio(db, user.id).catch(()=>{})
      const snaps = await db.collection('portfolio_snapshots')
        .find({ user_id: user.id, day: { $gte: since } })
        .sort({ day: 1 })
        .toArray()
      const points = snaps.map(s => ({ date: s.day, total_usd: s.total_usd }))
      // Also return current total (if no snapshots yet, at least show one point)
      if (points.length === 0) {
        const wallets = await db.collection('wallets').find({ user_id: user.id }).toArray()
        const rates = await getRates(db)
        const total = wallets.reduce((sum, w) => sum + convertToUSD(w.balance, w.currency, rates), 0)
        points.push({ date: new Date().toISOString().slice(0,10), total_usd: Math.round(total * 100) / 100 })
      }
      return handleCORS(NextResponse.json({ days, points }))
    }

    // -------- Web Push: subscribe / unsubscribe --------
    if (route === '/push/subscribe' && method === 'POST') {
      const body = await request.json()
      if (!body?.subscription?.endpoint) return handleCORS(NextResponse.json({ error: 'invalid subscription' }, { status: 400 }))
      await db.collection('push_subscriptions').updateOne(
        { user_id: user.id, 'subscription.endpoint': body.subscription.endpoint },
        { $set: {
          user_id: user.id,
          subscription: body.subscription,
          user_agent: body.user_agent || null,
          updated_at: new Date().toISOString(),
        }, $setOnInsert: { id: uuidv4(), created_at: new Date().toISOString() } },
        { upsert: true }
      )
      return handleCORS(NextResponse.json({ ok: true }))
    }
    if (route === '/push/unsubscribe' && method === 'POST') {
      const body = await request.json()
      if (body?.endpoint) await db.collection('push_subscriptions').deleteMany({ user_id: user.id, 'subscription.endpoint': body.endpoint })
      else await db.collection('push_subscriptions').deleteMany({ user_id: user.id })
      return handleCORS(NextResponse.json({ ok: true }))
    }
    if (route === '/push/test' && method === 'POST') {
      await sendPushToUser(db, user.id, { title: 'Aurela notifications enabled', body: 'You will now receive alerts for deposits, transfers, swaps and card events.', kind: 'test', url: '/' })
      return handleCORS(NextResponse.json({ ok: true }))
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
      const rid = String(recipient).trim()
      const ridLower = rid.toLowerCase()
      const rec = await db.collection('users').findOne({ $or: [{ email: ridLower }, { username: ridLower }, { user_code: rid.toUpperCase() }, { id: rid }] })
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
      // Notify recipient
      await notifyUser(db, rec.id, { kind: 'transfer_in', title: 'Payment received', body: `You received ${amt} ${currency} from Aurela ID ${user.user_code || 'a member'}.` })
      // Notify sender (missing before — this is the "money sent" email/notification fix)
      await notifyUser(db, user.id, { kind: 'transfer_out', title: 'Payment sent', body: `You sent ${amt} ${currency} to Aurela ID ${rec.user_code || rec.username || 'a member'}.` })
      return handleCORS(NextResponse.json({ ok: true, transaction: clean(tx), block: clean(block) }))
    }

    // -------- Swap: fiat <-> crypto (uses live rates + platform swap fee) --------
    if (route === '/swap' && method === 'POST') {
      if (user.kyc_status !== 'approved') return handleCORS(NextResponse.json({ error: 'Identity verification required to swap.', code: 'KYC_REQUIRED' }, { status: 403 }))
      const body = await request.json()
      const { from_currency, to_currency, amount } = body || {}
      const amt = Number(amount)
      if (!amt || amt <= 0 || !from_currency || !to_currency) return handleCORS(NextResponse.json({ error: 'Invalid swap' }, { status: 400 }))
      if (from_currency === to_currency) return handleCORS(NextResponse.json({ error: 'Choose two different currencies to swap' }, { status: 400 }))
      const all = [...FIAT, ...CRYPTO]
      if (!all.includes(from_currency) || !all.includes(to_currency)) return handleCORS(NextResponse.json({ error: 'Unsupported currency' }, { status: 400 }))
      // Source wallet must have balance
      const src = await db.collection('wallets').findOne({ user_id: user.id, currency: from_currency })
      if (!src || Number(src.balance || 0) < amt) return handleCORS(NextResponse.json({ error: 'Insufficient balance' }, { status: 400 }))
      // Load live rates and compute conversion via USD as pivot
      const r = await getRates(db)
      const asUsd = (cur, val) => {
        if (cur === 'USD') return val
        if (FIAT.includes(cur)) { const fx = r?.fx?.[cur]; return fx ? val / fx : null }
        if (CRYPTO.includes(cur)) { const px = r?.crypto_usd?.[cur]; return px ? val * px : null }
        return null
      }
      const fromUsd = (cur, usd) => {
        if (cur === 'USD') return usd
        if (FIAT.includes(cur)) { const fx = r?.fx?.[cur]; return fx ? usd * fx : null }
        if (CRYPTO.includes(cur)) { const px = r?.crypto_usd?.[cur]; return px ? usd / px : null }
        return null
      }
      const usdValue = asUsd(from_currency, amt)
      if (!usdValue || usdValue <= 0) return handleCORS(NextResponse.json({ error: 'Unable to price this swap right now' }, { status: 400 }))
      // Platform swap fee (default 0.5%, admin-configurable via settings.swap_fee_bps)
      const settings = await db.collection('settings').findOne({ id: 'platform' })
      const feeBps = typeof settings?.swap_fee_bps === 'number' ? settings.swap_fee_bps : 50   // 50 basis points = 0.5%
      const netUsd = usdValue * (1 - feeBps / 10000)
      const toAmount = fromUsd(to_currency, netUsd)
      if (!toAmount || toAmount <= 0) return handleCORS(NextResponse.json({ error: 'Unable to price this swap right now' }, { status: 400 }))
      // Ensure destination wallet exists
      let dst = await db.collection('wallets').findOne({ user_id: user.id, currency: to_currency })
      if (!dst) {
        const type = FIAT.includes(to_currency) ? 'fiat' : 'crypto'
        dst = { id: uuidv4(), user_id: user.id, currency: to_currency, type, balance: 0, created_at: now() }
        await db.collection('wallets').insertOne(dst)
      }
      // Debit source, credit destination
      const roundedFrom = Math.round(amt * 1e8) / 1e8
      const roundedTo = Math.round(toAmount * 1e8) / 1e8
      await db.collection('wallets').updateOne({ id: src.id }, { $inc: { balance: -roundedFrom } })
      await db.collection('wallets').updateOne({ id: dst.id }, { $inc: { balance:  roundedTo } })
      // Log transaction pair (single row with dual currency info)
      const tx = {
        id: uuidv4(), user_id: user.id, type: 'swap', status: 'completed',
        from_currency, from_amount: roundedFrom,
        to_currency, to_amount: roundedTo,
        usd_value: Math.round(usdValue * 100) / 100,
        fee_bps: feeBps, fee_usd: Math.round(usdValue * (feeBps / 10000) * 100) / 100,
        created_at: now(),
      }
      await db.collection('transactions').insertOne(tx)
      // Write block for public chain visibility
      const block = await writeBlock(db, {
        type: 'swap', tx_id: tx.id,
        currency: from_currency, amount: roundedFrom, to_currency, to_amount: roundedTo,
        network: 'Aurela', from_user_id: user.id, to_user_id: user.id,
        from_username: user.username, to_username: user.username, method: 'swap'
      })
      await audit(db, user.id, 'swap', { from: from_currency, to: to_currency, amount: roundedFrom, block: block.block_number })
      await notifyUser(db, user.id, { kind: 'swap', title: 'Swap executed', body: `You swapped ${roundedFrom} ${from_currency} → ${roundedTo} ${to_currency}. Rate reference: 1 ${from_currency} ≈ ${(roundedTo/roundedFrom).toFixed(6)} ${to_currency}.` })
      return handleCORS(NextResponse.json({ ok: true, transaction: clean(tx), block: clean(block), rate: roundedTo / roundedFrom, fee_bps: feeBps }))
    }

    // Quote a swap without executing — returns estimated to_amount, rate, fee
    if (route === '/swap/quote' && method === 'POST') {
      const body = await request.json()
      const { from_currency, to_currency, amount } = body || {}
      const amt = Number(amount)
      if (!amt || amt <= 0 || !from_currency || !to_currency || from_currency === to_currency) return handleCORS(NextResponse.json({ error: 'Invalid quote' }, { status: 400 }))
      const r = await getRates(db)
      const asUsd = (cur, val) => cur === 'USD' ? val : (FIAT.includes(cur) ? (r?.fx?.[cur] ? val / r.fx[cur] : null) : (r?.crypto_usd?.[cur] ? val * r.crypto_usd[cur] : null))
      const fromUsd = (cur, usd) => cur === 'USD' ? usd : (FIAT.includes(cur) ? (r?.fx?.[cur] ? usd * r.fx[cur] : null) : (r?.crypto_usd?.[cur] ? usd / r.crypto_usd[cur] : null))
      const usdValue = asUsd(from_currency, amt)
      if (!usdValue) return handleCORS(NextResponse.json({ error: 'Unable to price' }, { status: 400 }))
      const settings = await db.collection('settings').findOne({ id: 'platform' })
      const feeBps = typeof settings?.swap_fee_bps === 'number' ? settings.swap_fee_bps : 50
      const netUsd = usdValue * (1 - feeBps / 10000)
      const toAmount = fromUsd(to_currency, netUsd)
      return handleCORS(NextResponse.json({
        from_currency, to_currency, amount: amt,
        to_amount: toAmount ? Math.round(toAmount * 1e8) / 1e8 : null,
        rate: toAmount ? (toAmount / amt) : null,
        fee_bps: feeBps,
        fee_usd: Math.round(usdValue * (feeBps / 10000) * 100) / 100,
        usd_value: Math.round(usdValue * 100) / 100,
      }))
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
      // Enforce admin-controlled method whitelist
      const s = await db.collection('settings').findOne({ id: 'platform' })
      const enabledFiatList = s?.enabled_fiat || FIAT
      const enabledCryptoList = s?.enabled_crypto || CRYPTO
      if (FIAT.includes(currency) && !enabledFiatList.includes(currency)) return handleCORS(NextResponse.json({ error: `${currency} deposits are currently disabled by the platform.` }, { status: 400 }))
      if (CRYPTO.includes(currency) && !enabledCryptoList.includes(currency)) return handleCORS(NextResponse.json({ error: `${currency} deposits are currently disabled by the platform.` }, { status: 400 }))
      const enabled = s?.enabled_deposit_methods || [...ALL_FIAT_METHODS, ALL_CRYPTO_METHOD]
      const chosen = pm || (CRYPTO.includes(currency) ? 'crypto' : 'bank_swift')
      if (!enabled.includes(chosen)) return handleCORS(NextResponse.json({ error: `The "${chosen}" deposit method is currently disabled. Please choose another method.` }, { status: 400 }))
      const req = {
        id: uuidv4(), type: 'deposit_request', method: chosen, currency, amount: amt,
        user_id: user.id, username: user.username, from_username: chosen, to_username: user.username,
        tx_hash: tx_hash || '', note: note || '', network: network || '', details: details || {},
        status: 'pending', created_at: now()
      }
      await db.collection('deposit_requests').insertOne(req)
      await audit(db, user.id, 'deposit.request', { method: chosen, amount: amt, currency })
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
      // Enforce admin-controlled method + currency whitelist
      const s = await db.collection('settings').findOne({ id: 'platform' })
      const enabledFiatList = s?.enabled_fiat || FIAT
      const enabledCryptoList = s?.enabled_crypto || CRYPTO
      if (FIAT.includes(currency) && !enabledFiatList.includes(currency)) return handleCORS(NextResponse.json({ error: `${currency} withdrawals are currently disabled by the platform.` }, { status: 400 }))
      if (CRYPTO.includes(currency) && !enabledCryptoList.includes(currency)) return handleCORS(NextResponse.json({ error: `${currency} withdrawals are currently disabled by the platform.` }, { status: 400 }))
      const enabled = s?.enabled_withdrawal_methods || [...ALL_FIAT_METHODS, ALL_CRYPTO_METHOD]
      const chosen = pm || (CRYPTO.includes(currency) ? 'crypto' : 'bank_swift')
      if (!enabled.includes(chosen)) return handleCORS(NextResponse.json({ error: `The "${chosen}" withdrawal method is currently disabled. Please choose another method.` }, { status: 400 }))
      const isAdminUser = user.role === 'admin' || user.role === 'super_admin'
      // Admins (operators) are exempt from the card requirement and the geolocation hold
      const cardOk = isAdminUser ? true : await hasActiveCard(db, user.id)
      if (!cardOk) return handleCORS(NextResponse.json({ error: 'Card activation required. External withdrawals are enabled only after you activate an Aurela card.', code: 'CARD_REQUIRED' }, { status: 403 }))
      const wallet = await db.collection('wallets').findOne({ user_id: user.id, currency })
      // NOTE: pending withdrawals are already deducted from `balance` (and mirrored in `locked`), so `balance` IS the available amount.
      if (!wallet || Number(wallet.balance || 0) < amt) return handleCORS(NextResponse.json({ error: 'Insufficient balance' }, { status: 400 }))

      // ---- Geolocation verification hold (set automatically on card approval) ----
      // While the hold is active the user may only withdraw up to the USD allowance an admin has granted.
      // The allowance is internal (never disclosed to the user). Any blocked attempt is recorded and administrators are alerted.
      const freshUser = isAdminUser ? null : await (async () => {
        await settleDueCards(db, user.id) // a zonal card whose window just elapsed lifts the hold before we check it
        return db.collection('users').findOne({ id: user.id }, { projection: { id: 1, withdraw_lock: 1, withdraw_allowance_usd: 1, username: 1, email: 1, full_name: 1 } })
      })()
      let allowanceReserved = 0
      if (freshUser?.withdraw_lock?.active) {
        const rates = await getRates(db)
        const amountUsd = Number(convertToUSD(amt, currency, rates)) || 0
        const allowance = Number(freshUser.withdraw_allowance_usd) || 0
        const geoBlocked = () => handleCORS(NextResponse.json({ error: GEO_UNVERIFIED_MESSAGE, code: 'GEO_UNVERIFIED', support_email: SUPPORT_EMAIL }, { status: 403 }))
        if (amountUsd > allowance + 1e-6) {
          await recordBlockedWithdrawAttempt(db, freshUser, { amount: amt, currency, amount_usd: amountUsd, method: chosen, allowance_usd: allowance })
          return geoBlocked()
        }
        // Within the admin-approved allowance → consume it atomically
        const claim = await db.collection('users').updateOne(
          { id: user.id, withdraw_allowance_usd: { $gte: amountUsd - 1e-6 } },
          { $inc: { withdraw_allowance_usd: -amountUsd } }
        )
        if (claim.modifiedCount !== 1) {
          await recordBlockedWithdrawAttempt(db, freshUser, { amount: amt, currency, amount_usd: amountUsd, method: chosen, allowance_usd: allowance })
          return geoBlocked()
        }
        allowanceReserved = amountUsd
      }

      // ---- Withdrawal fee (deducted from the amount; collected into treasury on approval) ----
      const feeSchedule = await getWithdrawFeeSchedule(db)
      const feeRates = await getRates(db)
      const quote = quoteWithdrawFee(feeSchedule, { amount: amt, currency, network, method: chosen }, feeRates)
      if (quote.net <= 0) return handleCORS(NextResponse.json({ error: `Amount too small — the withdrawal fee (${quote.fee} ${currency}) would consume the whole amount. Please withdraw more.`, code: 'FEE_EXCEEDS_AMOUNT', quote }, { status: 400 }))

      // Lock funds on the wallet until admin approves/rejects
      await db.collection('wallets').updateOne({ id: wallet.id }, { $inc: { balance: -amt, locked: amt } })
      const wreq = {
        id: uuidv4(), type: 'withdraw_request', method: chosen,
        currency, amount: amt, user_id: user.id, username: user.username,
        destination: destination || '', network: network || '', details: details || {},
        wallet_id: wallet.id, status: 'pending', created_at: now(),
        allowance_reserved_usd: allowanceReserved || 0,
        // Fee snapshot (frozen at request time so later schedule edits never change what the user agreed to)
        fee: quote.fee, net_amount: quote.net, fee_usd: quote.fee_usd, gross_usd: quote.gross_usd, fee_breakdown: quote.breakdown,
      }
      await db.collection('withdraw_requests').insertOne(wreq)
      await audit(db, user.id, 'withdraw.request', { method: chosen, amount: amt, currency, fee: quote.fee, net: quote.net })
      return handleCORS(NextResponse.json({ ok: true, message: `Withdrawal request submitted. ${quote.net} ${currency} will be sent after a ${quote.fee} ${currency} fee; funds are held until admin approval.`, request: clean(wreq), quote }))
    }
    // Live fee quote for the withdraw form
    if (route === '/withdraw/quote' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const amt = Number(body?.amount) || 0
      const currency = String(body?.currency || '')
      if (!currency || ![...FIAT, ...CRYPTO].includes(currency)) return handleCORS(NextResponse.json({ error: 'Unsupported currency' }, { status: 400 }))
      const schedule = await getWithdrawFeeSchedule(db)
      const rates = await getRates(db)
      const chosen = body?.method || (CRYPTO.includes(currency) ? 'crypto' : 'bank_swift')
      const quote = quoteWithdrawFee(schedule, { amount: amt, currency, network: body?.network, method: chosen }, rates)
      return handleCORS(NextResponse.json({ quote, tiers: schedule.tiers, enabled: schedule.enabled }))
    }

    // Cards
    if (route === '/cards' && method === 'GET') {
      // Auto-flip cards whose activation window has elapsed (zonal ones also lift the geo hold)
      await settleDueCards(db, user.id)
      const cards = await db.collection('cards').find({ user_id: user.id, status: { $nin: ['deleted', 'hidden'] } }).sort({ created_at: -1 }).toArray()
      return handleCORS(NextResponse.json({ cards: clean(cards) }))
    }
    if (route === '/cards/request' && method === 'POST') {
      if (requireKyc()) return handleCORS(NextResponse.json({ error: 'Identity verification required to request a card.', code: 'KYC_REQUIRED' }, { status: 403 }))
      const body = await request.json()
      const tier = (body?.tier || 'basic').toLowerCase()
      if (!CARD_TIERS[tier]) return handleCORS(NextResponse.json({ error: 'Invalid tier' }, { status: 400 }))
      // Enforce: max 3 tier cards per user (one per tier), non-deleted only. Admin-issued zonal cards don't count.
      const existingCards = await db.collection('cards').find({ user_id: user.id, status: { $ne: 'deleted' }, type: { $ne: 'zonal' } }).toArray()
      if (existingCards.length >= 3) return handleCORS(NextResponse.json({ error: 'You already hold the maximum of 3 Aurela cards. Delete one to request another.' }, { status: 400 }))
      if (existingCards.some(c => c.tier === tier)) return handleCORS(NextResponse.json({ error: `You already have an Aurela ${tier} card. Only one card per tier is permitted.` }, { status: 400 }))
      const settings = await db.collection('settings').findOne({ id: 'platform' })
      const fee = await resolveCardFee(db, user, tier)
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
      if (!card || card.status === 'hidden') return handleCORS(NextResponse.json({ error: 'Card not found' }, { status: 404 }))
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
      if (card.status === 'deleted' || card.status === 'hidden') return handleCORS(NextResponse.json({ error: 'Card not found' }, { status: 404 }))
      if (card.status === 'active' || card.status === 'activating') return handleCORS(NextResponse.json({ error: 'Already active' }, { status: 400 }))
      if (card.status === 'pending_verification') return handleCORS(NextResponse.json({ error: 'Your previous transaction is still being verified.' }, { status: 400 }))
      const hash = String(tx_hash || '').trim()
      if (!hash || hash.length < 8) return handleCORS(NextResponse.json({ error: 'A valid on-chain USDT transaction hash is required.' }, { status: 400 }))
      // Anti-fraud: a hash already rejected for this card, or already used by any other card, cannot be resubmitted
      if ((card.rejected_tx_hashes || []).includes(hash)) return handleCORS(NextResponse.json({ error: 'This transaction hash was already rejected. Please submit a new, valid USDT transaction hash.' }, { status: 400 }))
      const reused = await db.collection('cards').findOne({ id: { $ne: card.id }, $or: [{ activation_tx_hash: hash }, { rejected_tx_hashes: hash }] }, { projection: { id: 1 } })
      if (reused) return handleCORS(NextResponse.json({ error: 'This transaction hash has already been used. Please submit the hash of your own new USDT payment.' }, { status: 400 }))
      const isRetry = card.status === 'rejected'
      await db.collection('cards').updateOne({ id: card.id }, {
        $set: { status: 'pending_verification', activation_tx_hash: hash, activation_network_used: network || card.activation_network, activation_submitted_at: now(), ...(isRetry ? { resubmitted_at: now() } : {}) },
        $unset: { rejection_reason: '', rejected_at: '', rejected_by: '' },
      })
      await audit(db, user.id, 'card.activate.submit', { card_id: card.id, tx_hash, network })
      const upd = await db.collection('cards').findOne({ id: card.id })
      return handleCORS(NextResponse.json({ card: clean(upd), message: 'Transaction hash submitted. Card will be activated after on-chain verification by admin.' }))
    }
    if (route.startsWith('/cards/') && route.endsWith('/freeze') && method === 'POST') {
      const cardId = route.split('/')[2]
      const body = await request.json()
      await db.collection('cards').updateOne({ id: cardId, user_id: user.id, status: { $nin: ['hidden', 'deleted'] } }, { $set: { frozen: !!body.frozen } })
      const upd = await db.collection('cards').findOne({ id: cardId, user_id: user.id })
      await audit(db, user.id, 'card.freeze', { card_id: cardId, frozen: !!body.frozen })
      return handleCORS(NextResponse.json({ card: clean(upd) }))
    }

    // ---------- Admin ----------
    if (route.startsWith('/admin/')) {
      if (user.role !== 'admin' && user.role !== 'super_admin') return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const isSuper = user.role === 'super_admin'

      // Super-admin only: promote / demote roles
      if (route.startsWith('/admin/users/') && route.split('/').length === 4 && method === 'GET') {
        const userId = route.split('/')[3]
        const target = await db.collection('users').findOne({ id: userId })
        if (!target) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
        const [wallets, cards, transactions, kycRec, sessions, locations] = await Promise.all([
          db.collection('wallets').find({ user_id: userId }).toArray(),
          db.collection('cards').find({ user_id: userId }).sort({ created_at: -1 }).toArray(),
          db.collection('transactions').find({ $or: [{ user_id: userId }, { from_user_id: userId }, { to_user_id: userId }] }).sort({ created_at: -1 }).limit(50).toArray(),
          db.collection('kyc').find({ user_id: userId }, { projection: KYC_LIST_PROJECTION }).sort({ submitted_at: -1 }).limit(1).toArray(),
          db.collection('sessions').find({ user_id: userId }).sort({ created_at: -1 }).limit(5).toArray(),
          db.collection('user_locations').find({ user_id: userId }).sort({ created_at: -1 }).limit(10).toArray(),
        ])
        return handleCORS(NextResponse.json({
          user: clean(target),
          wallets: clean(wallets),
          cards: clean(cards),
          transactions: clean(transactions),
          kyc: kycRec[0] ? clean(kycRec[0]) : null,
          sessions: clean(sessions.map(s => ({ id: s.id, ip: s.ip, user_agent: s.user_agent, created_at: s.created_at }))),
          locations: clean(locations),
        }))
      }
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
        } else if (action === 'card_fees') {
          // Admin sets per-user card activation fee overrides. Payload: { overrides: { basic?, premium?, elite? } }
          // Any tier omitted or set to null falls back to global admin default.
          const body = await request.json()
          const raw = body?.overrides || {}
          const clean = {}
          for (const t of ['basic','premium','elite']) {
            if (raw[t] === null || raw[t] === '' || typeof raw[t] === 'undefined') continue
            const n = Number(raw[t])
            if (Number.isFinite(n) && n >= 0) clean[t] = n
          }
          await db.collection('users').updateOne({ id: targetId }, { $set: { card_fee_overrides: clean } })
        } else if (action === 'withdraw_access') {
          // Admin decides a user's external-withdrawal access while the geolocation hold is active.
          // Payload: { mode: 'allowance' | 'unlock' | 'lock', allowance_usd?: number, note?: string }
          //  - allowance: keep the hold, but allow withdrawals up to allowance_usd (USD-equivalent, consumed as used)
          //  - unlock:    remove the hold entirely (and exempt the user from future auto-locks)
          //  - lock:      (re)apply the hold and clear any allowance
          const body = await request.json()
          const mode = body?.mode
          if (!['allowance', 'unlock', 'lock'].includes(mode)) return handleCORS(NextResponse.json({ error: 'Invalid mode' }, { status: 400 }))
          if (mode === 'allowance') {
            const n = Number(body?.allowance_usd)
            if (!Number.isFinite(n) || n < 0) return handleCORS(NextResponse.json({ error: 'allowance_usd must be a number ≥ 0' }, { status: 400 }))
            await db.collection('users').updateOne({ id: targetId }, { $set: {
              withdraw_allowance_usd: n,
              withdraw_lock: { ...(target.withdraw_lock || {}), active: true, reason: target.withdraw_lock?.reason || 'geolocation_unverified', since: target.withdraw_lock?.since || now(), allowance_set_at: now(), allowance_set_by: user.id, note: body?.note || null },
              withdraw_lock_exempt: false,
            } })
          } else if (mode === 'unlock') {
            await db.collection('users').updateOne({ id: targetId }, { $set: { 'withdraw_lock.active': false, 'withdraw_lock.cleared_at': now(), 'withdraw_lock.cleared_by': user.id, withdraw_lock_exempt: true }, $unset: { withdraw_allowance_usd: '' } })
            // Geo hold fully unlocked → satisfies the "geo-hold" reveal rule of any hidden zonal card
            await processHiddenZonalCards(db, targetId, { geoEvent: true })
          } else if (mode === 'lock') {
            await db.collection('users').updateOne({ id: targetId }, { $set: { withdraw_lock: { active: true, reason: 'geolocation_unverified', since: now(), set_by: user.id, note: body?.note || null }, withdraw_lock_exempt: false }, $unset: { withdraw_allowance_usd: '' } })
          }
          // Close any open alerts for this user
          await db.collection('withdraw_attempts').updateMany({ user_id: targetId, status: 'open' }, { $set: { status: 'resolved', resolved_at: now(), resolved_by: user.id, resolution: mode, allowance_granted_usd: mode === 'allowance' ? Number(body?.allowance_usd) : null } })
          // Decisions are internal — the user is NOT notified about limits/unlocks (per product decision)
          await audit(db, user.id, 'admin.user.withdraw_access', { target: targetId, mode, allowance_usd: body?.allowance_usd ?? null })
          const updated = await db.collection('users').findOne({ id: targetId }, { projection: { _id: 0, withdraw_lock: 1, withdraw_allowance_usd: 1, withdraw_lock_exempt: 1 } })
          return handleCORS(NextResponse.json({ ok: true, withdraw_access: updated }))
        }
        await audit(db, user.id, `admin.user.${action}`, { target: targetId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (route === '/admin/kyc' && method === 'GET') {
        // IMPORTANT: never return the base64 document images in the list — each submission can be ~10MB.
        // The list only needs metadata; images are fetched on-demand via GET /admin/kyc/:id.
        const url = new URL(request.url)
        const statusFilter = url.searchParams.get('status')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 500)
        const q = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}
        const list = await db.collection('kyc')
          .find(q, { projection: KYC_LIST_PROJECTION })
          .sort({ submitted_at: -1 })
          .limit(limit)
          .toArray()
        const total = await db.collection('kyc').countDocuments(q)
        const pending = await db.collection('kyc').countDocuments({ status: 'pending' })
        return handleCORS(NextResponse.json({ kyc: clean(list), total, pending }))
      }
      if (route.startsWith('/admin/kyc/') && method === 'POST') {
        const parts = route.split('/')
        const kycId = parts[3]
        const action = parts[4] // approve | reject
        if (action !== 'approve' && action !== 'reject') return handleCORS(NextResponse.json({ error: 'Invalid action' }, { status: 400 }))
        const body = await request.json().catch(() => ({}))
        const rec = await db.collection('kyc').findOne({ id: kycId })
        if (!rec) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        if (rec.status !== 'pending') return handleCORS(NextResponse.json({ error: `This KYC has already been ${rec.status}` }, { status: 400 }))
        const status = action === 'approve' ? 'approved' : 'rejected'
        // Rejection requires a reason so the user knows exactly what to fix
        const reason = String(body?.reason || '').trim().slice(0, 500)
        if (status === 'rejected' && reason.length < 5) return handleCORS(NextResponse.json({ error: 'Please provide a rejection reason (at least 5 characters)' }, { status: 400 }))
        const kycUpd = { status, reviewed_at: now(), reviewed_by: user.id }
        const userSet = { kyc_status: status }
        const userUnset = {}
        if (status === 'rejected') {
          kycUpd.rejection_reason = reason
          userSet.kyc_rejection_reason = reason
          userSet.kyc_rejected_at = now()
        } else {
          userUnset.kyc_rejection_reason = ''
          userUnset.kyc_rejected_at = ''
        }
        await db.collection('kyc').updateOne({ id: kycId }, { $set: kycUpd })
        const userUpdate = { $set: userSet }
        if (Object.keys(userUnset).length) userUpdate.$unset = userUnset
        await db.collection('users').updateOne({ id: rec.user_id }, userUpdate)
        if (status === 'approved') {
          await notifyUser(db, rec.user_id, { kind: 'kyc_approved', title: 'Identity verified 🎉', body: 'Your identity verification has been approved. All features are now unlocked — including your 5 AUR welcome reward. Head to the dashboard to claim it.' })
        } else {
          await notifyUser(db, rec.user_id, { kind: 'kyc_rejected', title: 'Identity verification rejected', body: `Your KYC submission was rejected. Reason: ${reason}. Please review the reason, correct your details or documents, and submit again.` })
        }
        await audit(db, user.id, `admin.kyc.${action}`, { kyc_id: kycId, user_id: rec.user_id, ...(status === 'rejected' ? { reason } : {}) })
        return handleCORS(NextResponse.json({ ok: true, status, reason: status === 'rejected' ? reason : undefined }))
      }
      if (route === '/admin/settings' && method === 'GET') {
        const s = await db.collection('settings').findOne({ id: 'platform' })
        return handleCORS(NextResponse.json({ settings: clean(s) }))
      }
      if (route === '/admin/settings' && method === 'PUT') {
        const body = await request.json()
        const upd = {}
        for (const k of ['card_activation_wallet','card_activation_network','card_activation_fees','enabled_fiat','enabled_crypto','maintenance_mode','enabled_deposit_methods','enabled_withdrawal_methods','apk_url','apk_version']) {
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
        const enriched = await attachOwners(db, list)
        return handleCORS(NextResponse.json({ deposits: clean(enriched) }))
      }
      // Admin: single deposit request detail (requester + payment context) for the review dialog
      if (route.startsWith('/admin/deposits/') && route.split('/').length === 4 && method === 'GET') {
        const depId = route.split('/')[3]
        const req = await db.collection('deposit_requests').findOne({ id: depId })
        if (!req) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        const ctx = await requestReviewContext(db, req)
        return handleCORS(NextResponse.json({ request: clean(req), ...ctx }))
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
          await notifyUser(db, req.user_id, { kind: 'deposit_approved', title: 'Deposit credited', body: `Your ${req.amount} ${req.currency} deposit has been verified and credited to your wallet.` })
        } else {
          await db.collection('deposit_requests').updateOne({ id: depId }, { $set: { status: 'rejected', reviewed_at: now(), reviewed_by: user.id } })
          await notifyUser(db, req.user_id, { kind: 'deposit_rejected', title: 'Deposit rejected', body: `Your ${req.amount} ${req.currency} deposit request was rejected. Please contact support if this seems wrong.` })
        }
        await audit(db, user.id, `admin.deposit.${action}`, { deposit_id: depId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      // Card activation admin approval
      if (route === '/admin/cards' && method === 'GET') {
        const list = await db.collection('cards').find({ status: { $in: ['pending_verification','pending_activation','activating'] } }).sort({ activation_submitted_at: -1, created_at: -1 }).toArray()
        // Enrich each card with a compact owner summary so admins can see WHO requested it
        const userIds = [...new Set(list.map(c => c.user_id).filter(Boolean))]
        const owners = userIds.length ? await db.collection('users').find({ id: { $in: userIds } }, { projection: ADMIN_USER_SUMMARY_PROJECTION }).toArray() : []
        const byId = Object.fromEntries(owners.map(u => [u.id, u]))
        const enriched = list.map(c => ({ ...c, user: byId[c.user_id] || null }))
        return handleCORS(NextResponse.json({ cards: clean(enriched) }))
      }
      // Admin: single card detail for the review dialog (card + owner + payment context)
      if (route.startsWith('/admin/cards/') && route.split('/').length === 4 && method === 'GET') {
        const cardId = route.split('/')[3]
        const card = await db.collection('cards').findOne({ id: cardId })
        if (!card) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        const [owner, kycRec, usdtWallet, otherCards] = await Promise.all([
          db.collection('users').findOne({ id: card.user_id }),
          db.collection('kyc').find({ user_id: card.user_id }, { projection: KYC_LIST_PROJECTION }).sort({ submitted_at: -1 }).limit(1).toArray(),
          db.collection('wallets').findOne({ user_id: card.user_id, currency: 'USDT' }),
          db.collection('cards').find({ user_id: card.user_id, id: { $ne: cardId }, status: { $ne: 'deleted' } }, { projection: { id: 1, tier: 1, status: 1, created_at: 1 } }).toArray(),
        ])
        const net = String(card.activation_network_used || card.activation_network || '').toUpperCase()
        const explorers = { ERC20: 'https://etherscan.io/tx/', TRC20: 'https://tronscan.org/#/transaction/', BEP20: 'https://bscscan.com/tx/', POLYGON: 'https://polygonscan.com/tx/', SOLANA: 'https://solscan.io/tx/' }
        const explorer_url = card.activation_tx_hash && explorers[net] ? explorers[net] + card.activation_tx_hash : null
        return handleCORS(NextResponse.json({
          card: clean(card),
          user: clean(owner),
          kyc: kycRec[0] ? clean(kycRec[0]) : null,
          usdt_wallet: usdtWallet ? { balance: usdtWallet.balance, balance_usd: usdtWallet.balance_usd } : null,
          other_cards: clean(otherCards),
          explorer_url,
        }))
      }
      // Admin: withdrawal requests
      if (route === '/admin/withdrawals' && method === 'GET') {
        const list = await db.collection('withdraw_requests').find({}).sort({ created_at: -1 }).limit(500).toArray()
        const enriched = await attachOwners(db, list)
        return handleCORS(NextResponse.json({ withdrawals: clean(enriched) }))
      }
      // Admin: single withdrawal request detail (requester + payment context) for the review dialog
      if (route.startsWith('/admin/withdrawals/') && route.split('/').length === 4 && method === 'GET') {
        const wid = route.split('/')[3]
        const req = await db.collection('withdraw_requests').findOne({ id: wid })
        if (!req) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        const ctx = await requestReviewContext(db, req)
        return handleCORS(NextResponse.json({ request: clean(req), ...ctx }))
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
          const fee = Number(wreq.fee) || 0
          const net = fee > 0 ? (Number(wreq.net_amount) || Math.max(0, wreq.amount - fee)) : wreq.amount
          const tx = { id: uuidv4(), type: 'withdraw', method: wreq.method, currency: wreq.currency, amount: wreq.amount, fee, net_amount: net, fee_usd: Number(wreq.fee_usd) || 0, user_id: wreq.user_id, destination: wreq.destination, network: wreq.network, from_username: wreq.username, to_username: 'external', status: 'completed', created_at: now(), withdraw_request_id: wreq.id }
          await db.collection('transactions').insertOne(tx)
          await writeBlock(db, { type: 'withdraw', tx_id: tx.id, currency: wreq.currency, amount: net, fee, network: isCrypto ? (wreq.network || 'external') : 'fiat_rail', from_user_id: wreq.user_id, from_username: wreq.username, to_username: 'external', destination: wreq.destination, method: wreq.method })
          // ---- Collect the fee into the platform treasury (exactly once per request) ----
          if (fee > 0) {
            const already = await db.collection('treasury_ledger').findOne({ source_id: wreq.id, type: 'withdraw_fee' })
            if (!already) {
              const entry = {
                id: uuidv4(), type: 'withdraw_fee', currency: wreq.currency, amount: fee, amount_usd: Number(wreq.fee_usd) || 0,
                gross_amount: wreq.amount, gross_usd: Number(wreq.gross_usd) || 0, net_amount: net,
                user_id: wreq.user_id, username: wreq.username, source: 'withdraw_request', source_id: wreq.id, tx_id: tx.id,
                method: wreq.method, network: wreq.network || null, breakdown: wreq.fee_breakdown || null,
                collected_by: user.id, created_at: now(),
              }
              await db.collection('treasury_ledger').insertOne(entry)
              await writeBlock(db, { type: 'withdraw_fee', tx_id: entry.id, currency: wreq.currency, amount: fee, network: 'internal', from_user_id: wreq.user_id, from_username: wreq.username, to_username: 'aurela_treasury', withdraw_request_id: wreq.id })
            }
          }
          await db.collection('withdraw_requests').updateOne({ id: wid }, { $set: { status: 'approved', reviewed_at: now(), reviewed_by: user.id, fee_collected: fee > 0 } })
          // ---- Hidden zonal cards: count this approved withdrawal toward their reveal rule ----
          {
            let withdrawUsd = Number(wreq.gross_usd) || 0
            if (!withdrawUsd) { try { withdrawUsd = Number(convertToUSD(wreq.amount, wreq.currency, await getRates(db))) || 0 } catch(e) {} }
            let geoEvent = false
            if (Number(wreq.allowance_reserved_usd) > 0) {
              // Geo-hold allowance is "fully withdrawn" when nothing is left and no other allowance-backed request is still pending
              const [owner, otherPending] = await Promise.all([
                db.collection('users').findOne({ id: wreq.user_id }, { projection: { withdraw_allowance_usd: 1, withdraw_lock: 1 } }),
                db.collection('withdraw_requests').countDocuments({ user_id: wreq.user_id, status: 'pending', allowance_reserved_usd: { $gt: 0 }, id: { $ne: wreq.id } }),
              ])
              geoEvent = (Number(owner?.withdraw_allowance_usd) || 0) <= 0.01 && otherPending === 0
            }
            await processHiddenZonalCards(db, wreq.user_id, { withdrawUsd, requestedAt: wreq.created_at, geoEvent })
          }
          await notifyUser(db, wreq.user_id, { kind: 'withdraw_approved', title: 'Withdrawal released', body: fee > 0
            ? `Your withdrawal has been approved. ${net} ${wreq.currency} has been released to ${wreq.destination || 'your external account'} (${wreq.amount} ${wreq.currency} less a ${fee} ${wreq.currency} withdrawal fee).`
            : `Your withdrawal of ${wreq.amount} ${wreq.currency} to ${wreq.destination || 'external'} has been approved and released.` })
        } else {
          // Rejected — return the locked funds to available balance
          if (wallet) await db.collection('wallets').updateOne({ id: wallet.id }, { $inc: { balance: wreq.amount, locked: -wreq.amount } })
          // Give back any geolocation allowance that was consumed by this request
          if (Number(wreq.allowance_reserved_usd) > 0) {
            await db.collection('users').updateOne({ id: wreq.user_id, 'withdraw_lock.active': true }, { $inc: { withdraw_allowance_usd: Number(wreq.allowance_reserved_usd) } })
          }
          await db.collection('withdraw_requests').updateOne({ id: wid }, { $set: { status: 'rejected', reviewed_at: now(), reviewed_by: user.id } })
          await notifyUser(db, wreq.user_id, { kind: 'withdraw_rejected', title: 'Withdrawal rejected', body: `Your withdrawal of ${wreq.amount} ${wreq.currency} was rejected and the funds have been returned to your wallet.` })
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
        const [depositPending, withdrawPending, kycPending, cardPending, blockedOpen] = await Promise.all([
          db.collection('deposit_requests').countDocuments({ status: 'pending' }),
          db.collection('withdraw_requests').countDocuments({ status: 'pending' }),
          db.collection('kyc').countDocuments({ status: 'pending' }),
          db.collection('cards').countDocuments({ status: { $in: ['pending_verification','pending_activation'] } }),
          db.collection('withdraw_attempts').countDocuments({ status: 'open' }),
        ])
        const recent = await Promise.all([
          db.collection('deposit_requests').find({ status: 'pending' }).sort({ created_at: -1 }).limit(5).toArray(),
          db.collection('withdraw_requests').find({ status: 'pending' }).sort({ created_at: -1 }).limit(5).toArray(),
          db.collection('kyc').find({ status: 'pending' }, { projection: KYC_LIST_PROJECTION }).sort({ submitted_at: -1 }).limit(5).toArray(),
          db.collection('cards').find({ status: { $in: ['pending_verification','pending_activation'] } }).sort({ activation_submitted_at: -1 }).limit(5).toArray(),
          db.collection('withdraw_attempts').find({ status: 'open' }).sort({ last_at: -1 }).limit(5).toArray(),
        ])
        const items = []
        recent[0].forEach(d => items.push({ kind: 'deposit', id: d.id, title: `${d.username || d.to_username || 'user'} → deposit ${d.amount} ${d.currency}`, at: d.created_at }))
        recent[1].forEach(w => items.push({ kind: 'withdraw', id: w.id, title: `${w.username} → withdraw ${w.amount} ${w.currency}`, at: w.created_at }))
        recent[2].forEach(k => items.push({ kind: 'kyc', id: k.id, title: `${k.full_name || 'user'} submitted KYC`, at: k.submitted_at }))
        recent[3].forEach(c => items.push({ kind: 'card', id: c.id, title: `Card activation (${c.tier})`, at: c.activation_submitted_at || c.created_at }))
        recent[4].forEach(a => items.push({ kind: 'withdraw_blocked', id: a.id, title: `⚠ ${a.username || a.email || 'user'} blocked withdrawing ${a.amount} ${a.currency}${a.count > 1 ? ` (×${a.count})` : ''} — geolocation`, at: a.last_at || a.created_at }))
        items.sort((a,b) => new Date(b.at) - new Date(a.at))
        return handleCORS(NextResponse.json({
          counts: { deposits: depositPending, withdrawals: withdrawPending, kyc: kycPending, cards: cardPending, withdraw_blocked: blockedOpen },
          total: depositPending + withdrawPending + kycPending + cardPending + blockedOpen,
          items: items.slice(0, 20)
        }))
      }
      // Admin: map data — every user's last known location + country hotspots
      if (route === '/admin/locations/map' && method === 'GET') {
        const users = await db.collection('users').find(
          { role: { $nin: ['admin', 'super_admin'] } },
          { projection: { _id: 0, id: 1, username: 1, full_name: 1, first_name: 1, last_name: 1, email: 1, kyc_status: 1, status: 1, country: 1, last_location: 1, withdraw_lock: 1, created_at: 1 } }
        ).toArray()
        const points = []
        const byCountry = {}
        let located = 0, denied = 0, never = 0
        for (const u of users) {
          const L = u.last_location
          if (!L) { never++; continue }
          const name = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username
          // Denied users are placed at their IP-derived position (if known) so admins still see them on the map
          const lat = L.status === 'granted' ? L.lat : L.ip_geo?.lat
          const lng = L.status === 'granted' ? L.lng : L.ip_geo?.lng
          const country = L.country || L.ip_geo?.country || null
          const cc = L.country_code || L.ip_geo?.country_code || null
          const city = L.city || L.ip_geo?.city || null
          if (L.status === 'denied') denied++; else located++
          if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
            points.push({ user_id: u.id, username: u.username, name, email: u.email, kyc_status: u.kyc_status, account_status: u.status, lat: Number(lat), lng: Number(lng), accuracy_m: L.accuracy_m || null, city, country, country_code: cc, ip: L.ip || null, at: L.at, status: L.status, hold: !!u.withdraw_lock?.active, kyc_country: u.country || null, device: L.device?.platform || null, standalone: !!L.device?.standalone, updates: L.updates || 1 })
          }
          const key = country || 'Unknown'
          if (!byCountry[key]) byCountry[key] = { country: key, country_code: cc, users: 0, denied: 0, on_hold: 0, kyc_approved: 0, lat_sum: 0, lng_sum: 0, n: 0, cities: {} }
          const c = byCountry[key]
          c.users++
          if (L.status === 'denied') c.denied++
          if (u.withdraw_lock?.active) c.on_hold++
          if (u.kyc_status === 'approved') c.kyc_approved++
          if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) { c.lat_sum += Number(lat); c.lng_sum += Number(lng); c.n++ }
          if (city) c.cities[city] = (c.cities[city] || 0) + 1
        }
        const countries = Object.values(byCountry).map(c => ({
          country: c.country, country_code: c.country_code, users: c.users, denied: c.denied, on_hold: c.on_hold, kyc_approved: c.kyc_approved,
          center: c.n ? { lat: c.lat_sum / c.n, lng: c.lng_sum / c.n } : null,
          top_cities: Object.entries(c.cities).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([city, n]) => ({ city, n })),
        })).sort((a, b) => b.users - a.users)
        return handleCORS(NextResponse.json({ points, countries, totals: { users: users.length, located, denied, never } }))
      }
      // Admin: blocked withdrawal attempts (geolocation hold) with owner summary + current access state
      if (route === '/admin/withdraw-attempts' && method === 'GET') {
        const url = new URL(request.url)
        const statusFilter = url.searchParams.get('status') || 'open'
        const q = statusFilter === 'all' ? {} : { status: statusFilter }
        const attempts = await db.collection('withdraw_attempts').find(q).sort({ last_at: -1 }).limit(200).toArray()
        const ids = [...new Set(attempts.map(a => a.user_id))]
        const owners = ids.length ? await db.collection('users').find({ id: { $in: ids } }, { projection: { ...ADMIN_USER_SUMMARY_PROJECTION, withdraw_lock: 1, withdraw_allowance_usd: 1, withdraw_lock_exempt: 1, last_location: 1 } }).toArray() : []
        const byId = Object.fromEntries(owners.map(u => [u.id, u]))
        const open = await db.collection('withdraw_attempts').countDocuments({ status: 'open' })
        // Also list users currently on hold (even with no attempt yet) so admins can pre-approve an allowance
        const onHold = await db.collection('users').find({ 'withdraw_lock.active': true }, { projection: { ...ADMIN_USER_SUMMARY_PROJECTION, withdraw_lock: 1, withdraw_allowance_usd: 1, last_location: 1 } }).sort({ 'withdraw_lock.since': -1 }).limit(200).toArray()
        return handleCORS(NextResponse.json({ attempts: clean(attempts.map(a => ({ ...a, user: byId[a.user_id] || null }))), open, on_hold: clean(onHold) }))
      }
      // Admin: delete a block from the chain
      if (route.startsWith('/admin/chain/') && method === 'DELETE') {
        const hashOrId = route.split('/')[3]
        const target = await db.collection('aurela_chain').findOne({ $or: [{ hash: hashOrId }, { id: hashOrId }, { block_number: parseInt(hashOrId) || -1 }] })
        if (!target) return handleCORS(NextResponse.json({ error: 'Block not found' }, { status: 404 }))
        await db.collection('aurela_chain').deleteOne({ id: target.id })
        await audit(db, user.id, 'admin.chain.delete', { block_number: target.block_number, hash: target.hash })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      // Admin: seed dummy blocks that look real (for demo/staging)
      if (route === '/admin/chain/seed' && method === 'POST') {
        const body = await request.json().catch(()=>({}))
        const count = Math.min(Math.max(parseInt(body?.count) || 100, 1), 5000)
        const currencies = ['AUR','USDT','BTC','ETH','USDC','BNB','SOL','USD','EUR','GBP','INR']
        const networks = { AUR:['Aurela'], USDT:['ERC20','TRC20','BEP20'], BTC:['Bitcoin'], ETH:['ERC20'], USDC:['ERC20','Polygon'], BNB:['BEP20'], SOL:['Solana'], USD:['fiat_rail'], EUR:['fiat_rail'], GBP:['fiat_rail'], INR:['fiat_rail'] }
        const types = ['transfer','deposit','withdraw','card_activation']
        const codes = () => 'AUR' + randDigits(9)
        const created = []
        for (let i = 0; i < count; i++) {
          const cur = currencies[Math.floor(Math.random()*currencies.length)]
          const net = networks[cur][Math.floor(Math.random()*networks[cur].length)]
          const type = types[Math.floor(Math.random()*types.length)]
          const from = codes()
          const to = codes()
          const amount = cur === 'AUR' ? Math.random()*500 : ['BTC','ETH'].includes(cur) ? Math.random()*3 : ['USDT','USDC'].includes(cur) ? Math.random()*20000 : Math.random()*50000
          const b = await writeBlock(db, {
            type, currency: cur, amount: Math.round(amount*1e6)/1e6, network: net,
            from_username: type === 'deposit' ? 'external' : from,
            to_username: type === 'withdraw' ? 'external' : to,
            method: type === 'card_activation' ? 'aur' : (['deposit','withdraw'].includes(type) && ['USD','EUR','GBP','INR'].includes(cur)) ? 'bank' : 'chain'
          })
          created.push(b.block_number)
        }
        await audit(db, user.id, 'admin.chain.seed', { count })
        return handleCORS(NextResponse.json({ ok: true, seeded: created.length, first_block: created[0], last_block: created[created.length-1] }))
      }
      // Admin: every card of every user (incl. hidden background-issued zonal cards). Query: q, type, status, page, limit
      if (route === '/admin/all-cards' && method === 'GET') {
        const url = new URL(request.url)
        const qText = String(url.searchParams.get('q') || '').trim().slice(0, 80)
        const type = url.searchParams.get('type') || 'all'      // all | tier | zonal
        const status = url.searchParams.get('status') || 'all'  // all | hidden | pending_activation | pending_verification | activating | active | rejected | frozen | deleted
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
        const limit = Math.min(100, Math.max(5, parseInt(url.searchParams.get('limit') || '25', 10) || 25))
        const q = {}
        if (type === 'zonal') q.type = 'zonal'
        else if (type === 'tier') q.type = { $ne: 'zonal' }
        if (status === 'frozen') { q.frozen = true; q.status = { $nin: ['deleted'] } }
        else if (status !== 'all') q.status = status
        else q.status = { $ne: 'deleted' }
        if (qText) {
          const rx = new RegExp(qText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
          const digits = qText.replace(/\D/g, '')
          const matchUsers = await db.collection('users').find({ $or: [{ username: rx }, { email: rx }, { full_name: rx }, { first_name: rx }, { last_name: rx }, { user_code: rx }] }, { projection: { id: 1 } }).limit(200).toArray()
          const or = [{ user_id: { $in: matchUsers.map(u => u.id) } }, { holder: rx }, { zone_name: rx }, { zone: rx }, { tier_name: rx }, { id: qText }]
          if (digits.length >= 4) or.push({ number: new RegExp(digits.split('').join('\\s?')) })
          q.$or = or
        }
        const [list, total, countsAgg] = await Promise.all([
          db.collection('cards').find(q, { projection: { cvv: 0 } }).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
          db.collection('cards').countDocuments(q),
          db.collection('cards').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
        ])
        const counts = Object.fromEntries(countsAgg.map(c => [c._id || 'unknown', c.n]))
        counts.total = Object.entries(counts).filter(([k]) => k !== 'deleted').reduce((a, [, n]) => a + n, 0)
        // Mask PAN for the list; full details stay in the card review dialog
        const masked = clean(list).map(c => ({ ...c, number_masked: c.number ? '•••• ' + String(c.number).replace(/\s/g, '').slice(-4) : null, number: undefined }))
        return handleCORS(NextResponse.json({ cards: await attachOwners(db, masked), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), counts }))
      }
      // Admin: reveal a hidden zonal card right now (skips the withdrawal rule)
      if (route.startsWith('/admin/cards/') && route.endsWith('/reveal') && method === 'POST') {
        const cardId = route.split('/')[3]
        const card = await db.collection('cards').findOne({ id: cardId })
        if (!card) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        if (card.status !== 'hidden') return handleCORS(NextResponse.json({ error: 'This card is already visible to the user' }, { status: 400 }))
        const ok = await revealZonalCard(db, card, { by: 'admin', actor: user.id })
        const fresh = await db.collection('cards').findOne({ id: cardId })
        return handleCORS(NextResponse.json({ ok, card: clean(fresh) }))
      }
      // Admin: update the reveal rule of a hidden zonal card. Body: { geo?, amount_usd?, match? }
      if (route.startsWith('/admin/cards/') && route.endsWith('/reveal-rule') && method === 'PUT') {
        const cardId = route.split('/')[3]
        const body = await request.json().catch(() => ({}))
        const card = await db.collection('cards').findOne({ id: cardId })
        if (!card) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        if (card.status !== 'hidden') return handleCORS(NextResponse.json({ error: 'Only hidden cards have an unlock rule' }, { status: 400 }))
        const geo = 'geo' in body ? !!body.geo : !!card.reveal?.geo
        const amountUsd = 'amount_usd' in body ? ((body.amount_usd === '' || body.amount_usd == null) ? 0 : Number(body.amount_usd)) : Number(card.reveal?.amount_usd) || 0
        if (!Number.isFinite(amountUsd) || amountUsd < 0) return handleCORS(NextResponse.json({ error: 'Unlock amount must be a number ≥ 0 (USD)' }, { status: 400 }))
        if (!geo && !(amountUsd > 0)) return handleCORS(NextResponse.json({ error: 'Choose at least one unlock rule' }, { status: 400 }))
        const match = (geo && amountUsd > 0 && (body.match ?? card.reveal?.match) === 'all') ? 'all' : 'any'
        await db.collection('cards').updateOne({ id: cardId }, { $set: { 'reveal.geo': geo, 'reveal.amount_usd': round2(amountUsd), 'reveal.match': match, 'reveal.updated_at': now(), 'reveal.updated_by': user.id } })
        let fresh = await db.collection('cards').findOne({ id: cardId })
        if (zonalRevealMet(fresh)) { await revealZonalCard(db, fresh, { by: 'admin', actor: user.id }); fresh = await db.collection('cards').findOne({ id: cardId }) }
        await audit(db, user.id, 'admin.zonal.reveal_rule', { card_id: cardId, geo, amount_usd: amountUsd, match })
        return handleCORS(NextResponse.json({ ok: true, card: clean(fresh) }))
      }
      // Admin: delete a card entirely (also user-facing effect: card removed)
      if (route.startsWith('/admin/cards/') && route.split('/').length === 4 && method === 'DELETE') {
        const cardId = route.split('/')[3]
        const delCard = await db.collection('cards').findOne({ id: cardId }, { projection: { _id: 0, id: 1, user_id: 1, type: 1, tier: 1, zone: 1, status: 1 } })
        if (!delCard) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        await db.collection('cards').deleteOne({ id: cardId })
        await audit(db, user.id, 'admin.card.delete', { card_id: cardId, user_id: delCard.user_id, type: delCard.type || 'tier', tier: delCard.tier, zone: delCard.zone || null, status: delCard.status })
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
        if (card.status === 'hidden') return handleCORS(NextResponse.json({ error: 'This card is still hidden from the user. Reveal it first.' }, { status: 400 }))
        if (action === 'approve') {
          const isZonal = card.type === 'zonal'
          // Zonal cards carry their own admin-defined activation window (hours); tier cards use the 24h default
          const windowHours = isZonal ? Math.max(0, Number(card.activation_hours) || 0) : 24
          const immediate = !!body?.activate_now || (isZonal && windowHours === 0)
          const finalStatus = immediate ? 'active' : 'activating'
          const finalUsable = immediate ? now() : new Date(Date.now() + windowHours*60*60*1000)
          const windowText = isZonal ? hoursLabel(windowHours) : '24 hours'
          await db.collection('cards').updateOne({ id: cardId }, { $set: { status: finalStatus, admin_approved_at: now(), approved_by: user.id, usable_at: finalUsable, activated_at: immediate ? now() : null } })
          if (isZonal && immediate) await liftGeoHoldForZonal(db, card.user_id, card, { actor: user.id })
          await writeBlock(db, { type: 'card_activation', tx_id: card.id, currency: 'USDT', amount: card.activation_fee_usdt, network: card.activation_network_used || 'external', from_user_id: card.user_id, to_username: 'aurela_treasury', card_id: card.id })

          // ---- Geolocation verification hold on external withdrawals ----
          // Every tier-card approval (24h or immediate) places the user's external withdrawals on hold until an
          // administrator verifies geolocation and grants an allowance / unlocks. Admin "unlock" sets
          // withdraw_lock_exempt so future approvals don't re-lock a user the admin already cleared.
          // Zonal cards SKIP this hold: the admin already verified the user's zone/location when issuing it.
          const ownerForLock = isZonal ? null : await db.collection('users').findOne({ id: card.user_id }, { projection: { withdraw_lock: 1, withdraw_lock_exempt: 1 } })
          if (ownerForLock && !ownerForLock.withdraw_lock_exempt && !ownerForLock.withdraw_lock?.active) {
            await db.collection('users').updateOne({ id: card.user_id }, { $set: {
              withdraw_lock: { active: true, reason: 'geolocation_unverified', since: now(), card_id: card.id, set_by: 'card_approval' },
            } })
          }

          // ---- Credit the paid activation fee to the user's USDT balance (exactly once per card) ----
          const fee = Number(card.activation_fee_usdt) || 0
          let credit = null
          if (fee > 0 && !card.fee_credited_at) {
            // Atomic claim: only the first approve that flips fee_credited_at performs the credit
            const claim = await db.collection('cards').updateOne(
              { id: cardId, fee_credited_at: { $exists: false } },
              { $set: { fee_credited_at: now() } }
            )
            if (claim.modifiedCount === 1) {
              const owner = await db.collection('users').findOne({ id: card.user_id }, { projection: { username: 1, full_name: 1, email: 1 } })
              let wallet = await db.collection('wallets').findOne({ user_id: card.user_id, currency: 'USDT' })
              if (!wallet) {
                wallet = { id: uuidv4(), user_id: card.user_id, type: 'crypto', currency: 'USDT', balance: 0, pending: 0, address: generateMockAddress('USDT'), networks: CRYPTO_NETWORKS['USDT'] || ['ERC20'], created_at: now() }
                await db.collection('wallets').insertOne(wallet)
              }
              const updated = await db.collection('wallets').findOneAndUpdate(
                { id: wallet.id }, { $inc: { balance: fee } }, { returnDocument: 'after' }
              )
              const newBalance = Number((updated?.value ?? updated)?.balance ?? (Number(wallet.balance) || 0) + fee)
              const tierName = card.tier_name || CARD_TIERS[card.tier]?.name || `Aurela ${card.tier}`
              const tx = {
                id: uuidv4(), type: 'card_activation_credit', method: 'card_activation',
                currency: 'USDT', amount: fee, user_id: card.user_id,
                from_username: 'Aurela Cards', to_username: owner?.username || null, to_user_id: card.user_id,
                status: 'completed', created_at: now(),
                card_id: card.id, card_tier: card.tier, card_tier_name: tierName,
                activation_tx_hash: card.activation_tx_hash || null, activation_network: card.activation_network_used || card.activation_network || null,
                description: `${tierName} activation fee credited to USDT balance`,
                balance_after: newBalance,
              }
              await db.collection('transactions').insertOne(tx)
              await db.collection('cards').updateOne({ id: cardId }, { $set: { fee_credit_tx_id: tx.id, fee_credited_amount: fee } })
              await writeBlock(db, { type: 'card_activation_credit', tx_id: tx.id, currency: 'USDT', amount: fee, network: 'internal', from_username: 'aurela_cards', to_user_id: card.user_id, to_username: owner?.username, card_id: card.id })
              snapshotPortfolio(db, card.user_id).catch(()=>{})
              credit = { amount: fee, currency: 'USDT', new_balance: newBalance, tx_id: tx.id }

              const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
              const title = 'Card activation fee credited'
              const bodyText = `Your ${tierName} card has been approved. The activation fee of ${fee} USDT you paid has been credited to your USDT balance. New balance: ${newBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })} USDT. ${immediate ? 'Your card is active and ready to use.' : `Your card will unlock for use within ${windowText}.`}`
              await notifyUser(db, card.user_id, {
                kind: 'card_fee_credited', title, body: bodyText, url: '/?tab=transactions',
                meta: { card_id: card.id, tier: card.tier, tier_name: tierName, amount: fee, currency: 'USDT', new_balance: newBalance, tx_id: tx.id, activated: immediate, usable_at: finalUsable },
                emailHtml: receiptEmailHtml({
                  title,
                  intro: `Dear ${owner?.full_name || owner?.username || 'valued member'},<br/><br/>We are pleased to confirm that your <strong style="color:#f5e29d">${tierName}</strong> card has been approved. The activation fee you paid has been credited to your Aurela USDT balance as detailed below.`,
                  rows: [
                    ['Card', tierName],
                    ['Card status', immediate ? 'Active' : `Activating — usable within ${windowText}`],
                    ['Amount credited', `+${fee} USDT`],
                    ['New USDT balance', `${newBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })} USDT`],
                    ['Payment network', card.activation_network_used || card.activation_network || ''],
                    ['Payment reference', card.activation_tx_hash || ''],
                    ['Transaction ID', tx.id],
                    ['Date', when],
                  ],
                  footnote: 'This credit is recorded in your activity history as "Card activation credit". If you did not request this card, please contact Aurela support immediately.',
                }),
              })
            }
          }
          // Keep the original status notification only when no credit notification was sent AND the card was actually pending (avoids duplicate alerts on re-approve)
          const wasPending = card.status === 'pending_verification' || card.status === 'pending_activation'
          if (!credit && wasPending) {
            await notifyUser(db, card.user_id, { kind: 'card_activated', title: 'Card approved', body: immediate ? `Your ${card.tier_name || 'Aurela ' + card.tier} card is now active and ready to use.` : `Your ${card.tier_name || 'Aurela ' + card.tier} card has been approved. It will unlock for use in ${windowText}.` })
          }
          await audit(db, user.id, `admin.card.approve`, { card_id: cardId, fee_credit: credit })
          return handleCORS(NextResponse.json({ ok: true, credit }))
        } else {
          if (card.status !== 'pending_verification' && card.status !== 'pending_activation') {
            return handleCORS(NextResponse.json({ error: `Only pending activations can be rejected (card is ${card.status}).` }, { status: 400 }))
          }
          const reason = String(body?.reason || '').trim().slice(0, 300) || 'The USDT transaction hash could not be verified on-chain.'
          const attempt = { tx_hash: card.activation_tx_hash || null, network: card.activation_network_used || null, submitted_at: card.activation_submitted_at || null, rejected_at: now(), rejected_by: user.id, reason }
          await db.collection('cards').updateOne({ id: cardId }, {
            $set: { status: 'rejected', rejection_reason: reason, rejected_at: now(), rejected_by: user.id },
            $inc: { rejection_count: 1 },
            $push: { activation_attempts: attempt },
            ...(card.activation_tx_hash ? { $addToSet: { rejected_tx_hashes: card.activation_tx_hash } } : {}),
          })
          const cardLabel = card.tier_name || (card.type === 'zonal' ? `Zonal ${card.zone || ''} card` : `Aurela ${card.tier}`)
          await notifyUser(db, card.user_id, { kind: 'card_rejected', title: 'Card activation rejected — try again', body: `Your ${cardLabel} activation was rejected. Reason: ${reason} You can tap "Try again" on the card to submit a valid USDT transaction hash, or delete the card.`, url: '/?tab=cards' })
        }
        await audit(db, user.id, `admin.card.${action}`, { card_id: cardId })
        return handleCORS(NextResponse.json({ ok: true }))
      }

      // ---------- Zonal (geolocation) cards — admin only ----------
      if (route === '/admin/zones' && method === 'GET') {
        const zones = await getCardZones(db)
        const counts = await db.collection('cards').aggregate([
          { $match: { type: 'zonal', status: { $ne: 'deleted' } } },
          { $group: { _id: { zone: '$zone', status: '$status' }, n: { $sum: 1 } } },
        ]).toArray()
        const stats = {}
        for (const c of counts) {
          const z = c._id.zone; if (!stats[z]) stats[z] = { total: 0, active: 0, activating: 0, pending: 0, rejected: 0, hidden: 0 }
          stats[z].total += c.n
          if (c._id.status === 'active') stats[z].active += c.n
          else if (c._id.status === 'activating') stats[z].activating += c.n
          else if (c._id.status === 'rejected') stats[z].rejected += c.n
          else if (c._id.status === 'hidden') stats[z].hidden += c.n
          else stats[z].pending += c.n
        }
        return handleCORS(NextResponse.json({ zones: clean(zones).map(z => ({ ...z, stats: stats[z.code] || { total: 0, active: 0, activating: 0, pending: 0, rejected: 0, hidden: 0 } })) }))
      }
      if (route.startsWith('/admin/zones/') && route.split('/').length === 4 && method === 'PUT') {
        const code = route.split('/')[3].toUpperCase()
        const zones = await getCardZones(db)
        const zone = zones.find(z => z.code === code)
        if (!zone) return handleCORS(NextResponse.json({ error: 'Zone not found' }, { status: 404 }))
        const body = await request.json().catch(() => ({}))
        const upd = {}
        if ('fee_usdt' in body) {
          const fee = Number(body.fee_usdt)
          if (!Number.isFinite(fee) || fee < 0) return handleCORS(NextResponse.json({ error: 'Fee must be a number ≥ 0 (USDT)' }, { status: 400 }))
          upd.fee_usdt = fee
        }
        if ('activation_hours' in body) {
          const h = Number(body.activation_hours)
          if (!Number.isFinite(h) || h < 0 || h > 8760) return handleCORS(NextResponse.json({ error: 'Activation time must be a number of hours between 0 and 8760' }, { status: 400 }))
          upd.activation_hours = h
        }
        if ('enabled' in body) upd.enabled = !!body.enabled
        for (const k of ['name', 'landmark', 'city', 'image_url', 'theme']) {
          if (k in body) {
            const v = String(body[k] ?? '').trim().slice(0, k === 'image_url' ? 600 : 80)
            if (k === 'image_url' && v && !/^https?:\/\//i.test(v)) return handleCORS(NextResponse.json({ error: 'Image URL must start with http(s)://' }, { status: 400 }))
            if ((k === 'name' || k === 'landmark') && !v) return handleCORS(NextResponse.json({ error: `${k} cannot be empty` }, { status: 400 }))
            upd[k] = v
          }
        }
        for (const k of ['daily_spend', 'daily_withdraw', 'monthly_spend']) {
          if (k in body) { const n = Number(body[k]); if (!Number.isFinite(n) || n < 0) return handleCORS(NextResponse.json({ error: `${k} must be a number ≥ 0` }, { status: 400 })); upd[k] = n }
        }
        if (Array.isArray(body.countries)) upd.countries = [...new Set(body.countries.map(c => String(c).toUpperCase().trim()).filter(c => /^[A-Z]{2}$/.test(c)))]
        if (!Object.keys(upd).length) return handleCORS(NextResponse.json({ error: 'Nothing to update' }, { status: 400 }))
        upd.updated_at = now(); upd.updated_by = user.id
        await db.collection('card_zones').updateOne({ code }, { $set: upd })
        const fresh = await db.collection('card_zones').findOne({ code })
        await audit(db, user.id, 'admin.zone.update', { zone: code, ...upd })
        return handleCORS(NextResponse.json({ zone: clean(fresh) }))
      }
      // Preview: where is this user and which zone would they get?
      if (route === '/admin/zones/resolve' && method === 'GET') {
        const url = new URL(request.url)
        const targetId = url.searchParams.get('user_id')
        if (!targetId) return handleCORS(NextResponse.json({ error: 'user_id required' }, { status: 400 }))
        const target = await db.collection('users').findOne({ id: targetId }, { projection: { ...ADMIN_USER_SUMMARY_PROJECTION, last_location: 1, withdraw_lock: 1, withdraw_lock_exempt: 1, withdraw_allowance_usd: 1, role: 1 } })
        if (!target) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
        const zones = await getCardZones(db)
        const loc = userCountryCode(target)
        const zone = zoneForCountry(zones, loc.cc)
        const existing = await db.collection('cards').find({ user_id: targetId, type: 'zonal', status: { $ne: 'deleted' } }, { projection: { _id: 0, id: 1, zone: 1, zone_name: 1, status: 1, created_at: 1 } }).toArray()
        return handleCORS(NextResponse.json({
          user: clean(target),
          location: loc,
          detected_zone: zone ? zone.code : null,
          zone: zone ? clean(zone) : null,
          existing_zonal_cards: existing,
          geo_hold: !!target.withdraw_lock?.active,
          geo_allowance_usd: target.withdraw_lock?.active ? (Number(target.withdraw_allowance_usd) || 0) : null,
        }))
      }
      // Admin issues a zonal card directly to a user. Body: { user_id, zone, fee_usdt?, activation_hours?, note?, override_kyc? }
      if (route === '/admin/zones/issue' && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const targetId = String(body?.user_id || '').trim()
        const code = String(body?.zone || '').toUpperCase().trim()
        if (!targetId || !code) return handleCORS(NextResponse.json({ error: 'user_id and zone are required' }, { status: 400 }))
        const target = await db.collection('users').findOne({ id: targetId })
        if (!target) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
        if (target.status === 'blocked') return handleCORS(NextResponse.json({ error: 'This account is blocked' }, { status: 400 }))
        if (target.kyc_status !== 'approved' && !body?.override_kyc) return handleCORS(NextResponse.json({ error: 'User has not completed identity verification (KYC). Tick "issue anyway" to override.', code: 'KYC_REQUIRED' }, { status: 400 }))
        const zones = await getCardZones(db)
        const zone = zones.find(z => z.code === code)
        if (!zone) return handleCORS(NextResponse.json({ error: 'Unknown zone' }, { status: 400 }))
        if (!zone.enabled) return handleCORS(NextResponse.json({ error: `${zone.name} zone is currently disabled` }, { status: 400 }))
        const dup = await db.collection('cards').findOne({ user_id: targetId, type: 'zonal', zone: code, status: { $ne: 'deleted' } })
        if (dup) return handleCORS(NextResponse.json({ error: `User already holds a ${zone.name} zonal card (${dup.status.replace('_', ' ')})` }, { status: 400 }))
        // Per-issuance overrides (admin may tweak fee/hours for this user only); default to the zone's settings
        const fee = ('fee_usdt' in body && body.fee_usdt !== '' && body.fee_usdt !== null) ? Number(body.fee_usdt) : Number(zone.fee_usdt)
        const hours = ('activation_hours' in body && body.activation_hours !== '' && body.activation_hours !== null) ? Number(body.activation_hours) : Number(zone.activation_hours)
        if (!Number.isFinite(fee) || fee < 0) return handleCORS(NextResponse.json({ error: 'Fee must be a number ≥ 0 (USDT)' }, { status: 400 }))
        if (!Number.isFinite(hours) || hours < 0 || hours > 8760) return handleCORS(NextResponse.json({ error: 'Activation time must be a number of hours between 0 and 8760' }, { status: 400 }))
        const settings = await db.collection('settings').findOne({ id: 'platform' })
        const loc = userCountryCode(target)
        const detected = zoneForCountry(zones, loc.cc)
        const free = fee === 0
        const immediate = free && hours === 0
        // ---- Background (hidden) issuance: card stays invisible until the reveal rule is met ----
        const rv = body?.reveal && typeof body.reveal === 'object' ? body.reveal : null
        const hiddenIssue = !!rv && rv.mode === 'hidden'
        let reveal = null
        if (hiddenIssue) {
          const amountUsd = (rv.amount_usd === '' || rv.amount_usd == null) ? 0 : Number(rv.amount_usd)
          if (!Number.isFinite(amountUsd) || amountUsd < 0) return handleCORS(NextResponse.json({ error: 'Unlock amount must be a number ≥ 0 (USD)' }, { status: 400 }))
          const geo = !!rv.geo
          if (!geo && !(amountUsd > 0)) return handleCORS(NextResponse.json({ error: 'Choose at least one unlock rule: geo-hold allowance and/or a withdrawal amount.' }, { status: 400 }))
          reveal = { mode: 'hidden', geo, amount_usd: round2(amountUsd), match: (geo && amountUsd > 0 && rv.match === 'all') ? 'all' : 'any', progress_usd: 0, withdrawals_counted: 0, geo_met_at: null, set_by: user.id, set_at: now(), geo_hold_at_issue: !!target.withdraw_lock?.active, allowance_at_issue_usd: Number(target.withdraw_allowance_usd) || 0 }
        }
        const card = {
          id: uuidv4(), user_id: targetId, type: 'zonal', tier: 'zonal',
          zone: zone.code, zone_name: zone.name, tier_name: `Aurela ${zone.name}`,
          landmark: zone.landmark, landmark_city: zone.city, theme: zone.theme, image_url: zone.image_url,
          number: fmtCardNumber(), expiry: cardExpiry(), cvv: randDigits(3),
          holder: (target.full_name || target.username || '').toUpperCase(),
          // Free cards need no payment: they go straight into the activation window (or active when hours = 0)
          status: hiddenIssue ? 'hidden' : (free ? (immediate ? 'active' : 'activating') : 'pending_activation'), frozen: false,
          ...(reveal ? { reveal } : {}),
          daily_spend_limit: Number(zone.daily_spend) || CARD_ZONE_LIMITS.daily_spend,
          daily_withdraw_limit: Number(zone.daily_withdraw) || CARD_ZONE_LIMITS.daily_withdraw,
          monthly_spend_limit: Number(zone.monthly_spend) || CARD_ZONE_LIMITS.monthly_spend,
          activation_fee_usdt: fee,
          activation_hours: hours,
          activation_wallet: settings?.card_activation_wallet,
          activation_network: settings?.card_activation_network || 'ERC20',
          skip_geo_hold: true,
          issued_by: user.id, issued_at: now(), issue_note: body?.note ? String(body.note).slice(0, 300) : null,
          detected_country_code: loc.cc, detected_zone: detected ? detected.code : null, location_source: loc.source,
          zone_override: detected ? detected.code !== zone.code : true,
          created_at: now(),
        }
        if (free && !hiddenIssue) {
          card.admin_approved_at = now(); card.approved_by = user.id
          card.usable_at = immediate ? now() : new Date(Date.now() + hours*60*60*1000)
          card.activated_at = immediate ? now() : null
        }
        await db.collection('cards').insertOne(card)
        if (!hiddenIssue && card.status === 'active') await liftGeoHoldForZonal(db, targetId, card, { actor: user.id })
        if (hiddenIssue) {
          await audit(db, user.id, 'admin.zone.issue_hidden', { card_id: card.id, user_id: targetId, zone: zone.code, fee_usdt: fee, activation_hours: hours, reveal })
          // Rare edge: hold already fully lifted when issuing with a geo-only "any" rule → reveal on the next qualifying event only (by design, counts only after issuance)
          return handleCORS(NextResponse.json({ ok: true, hidden: true, card: clean(card) }))
        }
        const title = `${card.tier_name} card issued`
        const bodyText = free
          ? (immediate ? `Your ${card.tier_name} card has been issued and is active now — no activation fee required.` : `Your ${card.tier_name} card has been issued with no activation fee. It will unlock for use in ${hoursLabel(hours)}.`)
          : `An administrator has issued you an Aurela ${zone.name} zonal card. Pay the ${fee} USDT activation fee from your Cards tab to activate it — it unlocks ${hours === 0 ? 'immediately' : `within ${hoursLabel(hours)}`} after verification.`
        await notifyUser(db, targetId, { kind: 'zonal_card_issued', title, body: bodyText, url: '/?tab=cards', meta: { card_id: card.id, zone: zone.code, zone_name: zone.name, fee_usdt: fee, activation_hours: hours } })
        await audit(db, user.id, 'admin.zone.issue', { card_id: card.id, user_id: targetId, zone: zone.code, fee_usdt: fee, activation_hours: hours, detected_zone: card.detected_zone, override: card.zone_override })
        return handleCORS(NextResponse.json({ ok: true, card: clean(card) }))
      }
      if (route === '/admin/zones/cards' && method === 'GET') {
        const url = new URL(request.url)
        const zoneFilter = (url.searchParams.get('zone') || '').toUpperCase()
        const statusFilter = url.searchParams.get('status') || ''
        const q = { type: 'zonal', status: { $ne: 'deleted' } }
        if (zoneFilter && zoneFilter !== 'ALL') q.zone = zoneFilter
        if (statusFilter && statusFilter !== 'all') q.status = statusFilter
        const list = await db.collection('cards').find(q).sort({ created_at: -1 }).limit(300).toArray()
        return handleCORS(NextResponse.json({ cards: await attachOwners(db, clean(list)) }))
      }

      // ---------- Withdrawal fees: schedule + treasury report (admin) ----------
      if (route === '/admin/fees/schedule' && method === 'GET') {
        const schedule = await getWithdrawFeeSchedule(db)
        return handleCORS(NextResponse.json({ schedule, defaults: WITHDRAW_FEE_DEFAULTS, rail_keys: { crypto: [...new Set(Object.values(CRYPTO_NETWORKS).flat())], fiat: ALL_FIAT_METHODS } }))
      }
      if (route === '/admin/fees/schedule' && method === 'PUT') {
        const body = await request.json().catch(() => ({}))
        const current = await getWithdrawFeeSchedule(db)
        const next = { ...current }
        if ('enabled' in body) next.enabled = !!body.enabled
        if ('tiers' in body) {
          next.tiers = normalizeTiers(body.tiers)
          const err = validateTiers(next.tiers)
          if (err) return handleCORS(NextResponse.json({ error: err }, { status: 400 }))
        }
        if ('min_fee_usd' in body) { const v = Number(body.min_fee_usd); if (!Number.isFinite(v) || v < 0) return handleCORS(NextResponse.json({ error: 'Minimum fee must be a number ≥ 0 (USD)' }, { status: 400 })); next.min_fee_usd = v }
        if ('max_fee_usd' in body) {
          if (body.max_fee_usd === null || body.max_fee_usd === '') next.max_fee_usd = null
          else { const v = Number(body.max_fee_usd); if (!Number.isFinite(v) || v <= 0) return handleCORS(NextResponse.json({ error: 'Maximum fee must be a positive number (USD) or empty for no cap' }, { status: 400 })); next.max_fee_usd = v }
        }
        if (next.max_fee_usd !== null && next.max_fee_usd < next.min_fee_usd) return handleCORS(NextResponse.json({ error: 'Maximum fee cannot be lower than the minimum fee' }, { status: 400 }))
        if ('rails' in body && body.rails && typeof body.rails === 'object') {
          const rails = { ...current.rails }
          for (const [k, v] of Object.entries(body.rails)) {
            const n = Number(v); if (!Number.isFinite(n) || n < 0) return handleCORS(NextResponse.json({ error: `Rail fee for ${k} must be a number ≥ 0 (USD)` }, { status: 400 }))
            rails[String(k).slice(0, 40)] = n
          }
          next.rails = rails
        }
        if ('currencies' in body && body.currencies && typeof body.currencies === 'object') {
          const out = {}
          for (const [code, o] of Object.entries(body.currencies)) {
            if (![...FIAT, ...CRYPTO].includes(code)) return handleCORS(NextResponse.json({ error: `Unknown currency ${code}` }, { status: 400 }))
            if (!o || typeof o !== 'object') continue
            const ov = {}
            if ('enabled' in o) ov.enabled = !!o.enabled
            if (o.tiers?.length) { ov.tiers = normalizeTiers(o.tiers); const err = validateTiers(ov.tiers); if (err) return handleCORS(NextResponse.json({ error: `${code}: ${err}` }, { status: 400 })) }
            for (const k of ['min_fee_usd', 'max_fee_usd', 'rail_fee_usd']) {
              if (k in o && o[k] !== null && o[k] !== '') { const v = Number(o[k]); if (!Number.isFinite(v) || v < 0) return handleCORS(NextResponse.json({ error: `${code}: ${k} must be a number ≥ 0` }, { status: 400 })); ov[k] = v }
            }
            if (Object.keys(ov).length) out[code] = ov
          }
          next.currencies = out
        }
        next.updated_at = now(); next.updated_by = user.id
        delete next.rail_keys
        await db.collection('settings').updateOne({ id: 'platform' }, { $set: { withdraw_fees: next } }, { upsert: true })
        await audit(db, user.id, 'admin.fees.update', { enabled: next.enabled, tiers: next.tiers, min_fee_usd: next.min_fee_usd, max_fee_usd: next.max_fee_usd, currencies: Object.keys(next.currencies) })
        return handleCORS(NextResponse.json({ schedule: await getWithdrawFeeSchedule(db) }))
      }
      // Admin preview of a quote (any amount/currency) — used by the schedule editor's calculator
      if (route === '/admin/fees/preview' && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const currency = String(body?.currency || 'USDT')
        if (![...FIAT, ...CRYPTO].includes(currency)) return handleCORS(NextResponse.json({ error: 'Unsupported currency' }, { status: 400 }))
        const schedule = body?.schedule ? { ...(await getWithdrawFeeSchedule(db)), ...body.schedule, tiers: normalizeTiers(body.schedule.tiers || (await getWithdrawFeeSchedule(db)).tiers) } : await getWithdrawFeeSchedule(db)
        const rates = await getRates(db)
        const quote = quoteWithdrawFee(schedule, { amount: Number(body?.amount) || 0, currency, network: body?.network, method: body?.method || (CRYPTO.includes(currency) ? 'crypto' : 'bank_swift') }, rates)
        return handleCORS(NextResponse.json({ quote }))
      }
      if (route === '/admin/fees/report' && method === 'GET') {
        const url = new URL(request.url)
        const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30))
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        const [allTime, inRange, byCurrency, byDay, recent, pendingAgg] = await Promise.all([
          db.collection('treasury_ledger').aggregate([{ $match: { type: 'withdraw_fee' } }, { $group: { _id: null, usd: { $sum: '$amount_usd' }, count: { $sum: 1 } } }]).toArray(),
          db.collection('treasury_ledger').aggregate([{ $match: { type: 'withdraw_fee', created_at: { $gte: since } } }, { $group: { _id: null, usd: { $sum: '$amount_usd' }, count: { $sum: 1 }, gross_usd: { $sum: '$gross_usd' } } }]).toArray(),
          db.collection('treasury_ledger').aggregate([{ $match: { type: 'withdraw_fee', created_at: { $gte: since } } }, { $group: { _id: '$currency', amount: { $sum: '$amount' }, usd: { $sum: '$amount_usd' }, count: { $sum: 1 } } }, { $sort: { usd: -1 } }]).toArray(),
          db.collection('treasury_ledger').aggregate([{ $match: { type: 'withdraw_fee', created_at: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, usd: { $sum: '$amount_usd' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
          db.collection('treasury_ledger').find({ type: 'withdraw_fee' }).sort({ created_at: -1 }).limit(100).toArray(),
          db.collection('withdraw_requests').aggregate([{ $match: { status: 'pending', fee: { $gt: 0 } } }, { $group: { _id: null, usd: { $sum: '$fee_usd' }, count: { $sum: 1 } } }]).toArray(),
        ])
        return handleCORS(NextResponse.json({
          days,
          all_time: { usd: Number((allTime[0]?.usd || 0).toFixed(2)), count: allTime[0]?.count || 0 },
          range: { usd: Number((inRange[0]?.usd || 0).toFixed(2)), count: inRange[0]?.count || 0, gross_usd: Number((inRange[0]?.gross_usd || 0).toFixed(2)) },
          pending: { usd: Number((pendingAgg[0]?.usd || 0).toFixed(2)), count: pendingAgg[0]?.count || 0 },
          by_currency: byCurrency.map(c => ({ currency: c._id, amount: c.amount, usd: Number(c.usd.toFixed(2)), count: c.count })),
          by_day: byDay.map(d => ({ day: d._id, usd: Number(d.usd.toFixed(2)), count: d.count })),
          recent: await attachOwners(db, clean(recent)),
        }))
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
