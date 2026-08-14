'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const api = {
  base: '/api',
  token: null,
  setToken(t) { this.token = t; if (typeof window !== 'undefined') { if (t) localStorage.setItem('aurela_token', t); else localStorage.removeItem('aurela_token') } },
  loadToken() { if (typeof window !== 'undefined') this.token = localStorage.getItem('aurela_token') || null },
  async request(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token
    const res = await fetch(this.base + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
    let json = null
    try { json = await res.json() } catch(e) {}
    if (!res.ok) throw new Error(json?.error || 'Request failed')
    return json
  },
  get(p) { return this.request(p) },
  post(p, body) { return this.request(p, { method: 'POST', body }) },
  put(p, body) { return this.request(p, { method: 'PUT', body }) },
  del(p) { return this.request(p, { method: 'DELETE' }) },
}

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState('landing') // landing | auth | dashboard | admin
  const [publicPage, setPublicPage] = useState('home') // home | features | cards | services | about | contact | terms | privacy | compliance
  const [authMode, setAuthMode] = useState('login')
  const [rates, setRates] = useState(null)
  const [config, setConfig] = useState(null)
  const [tick, setTick] = useState(0)   // increments every 5s while a user is signed-in — components subscribe to auto-refresh

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api.get('/auth/me')
      setUser(user)
      return user
    } catch(e) { setUser(null); api.setToken(null); return null }
  }, [])

  useEffect(() => {
    api.loadToken()
    ;(async () => {
      try {
        const [r, c] = await Promise.all([api.get('/rates'), api.get('/config')])
        setRates(r); setConfig(c)
      } catch(e) {}
      if (api.token) {
        const u = await refreshUser()
        if (u) setRoute(u.role === 'admin' || u.role === 'super_admin' ? 'admin' : 'dashboard')
      }
      setLoading(false)
    })()
    // Live market data polling every 3s (drives Aurela Coin ticker)
    const rv = setInterval(async () => {
      try { const r = await api.get('/rates'); setRates(r) } catch(e) {}
    }, 3000)
    // Dashboard live tick — refresh every 5s when a user is signed in
    const tv = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return   // pause when tab hidden
      if (!api.token) return
      setTick(t => t + 1)
    }, 5000)
    return () => { clearInterval(rv); clearInterval(tv) }
  }, [refreshUser])

  const login = async (identifier, password, totp) => {
    const body = { identifier, password }
    if (totp) body.totp = totp
    const res = await api.post('/auth/login', body)
    api.setToken(res.token); setUser(res.user)
    setRoute(res.user.role === 'admin' || res.user.role === 'super_admin' ? 'admin' : 'dashboard')
    return res.user
  }
  const register = async (payload) => {
    const res = await api.post('/auth/register', payload)
    api.setToken(res.token); setUser(res.user)
    setRoute('dashboard')
    return res.user
  }
  const logout = async () => {
    try { await api.post('/auth/logout', {}) } catch(e) {}
    api.setToken(null); setUser(null); setRoute('landing')
  }

  return (
    <AppCtx.Provider value={{ api, user, setUser, loading, route, setRoute, publicPage, setPublicPage, authMode, setAuthMode, rates, setRates, config, tick, login, register, logout, refreshUser }}>
      {children}
    </AppCtx.Provider>
  )
}

export function useApp() { return useContext(AppCtx) }

// Utilities
// Every fiat has a `cc` (ISO-2 country code) used to fetch a flag PNG from flagcdn.com
export const FIAT_META = {
  USD: { symbol: '$', flag: '🇺🇸', cc: 'us', name: 'US Dollar' },
  EUR: { symbol: '€', flag: '🇪🇺', cc: 'eu', name: 'Euro' },
  GBP: { symbol: '£', flag: '🇬🇧', cc: 'gb', name: 'British Pound' },
  INR: { symbol: '₹', flag: '🇮🇳', cc: 'in', name: 'Indian Rupee' },
  AED: { symbol: 'AED', flag: '🇦🇪', cc: 'ae', name: 'UAE Dirham' },
  JPY: { symbol: '¥', flag: '🇯🇵', cc: 'jp', name: 'Japanese Yen' },
  CAD: { symbol: 'C$', flag: '🇨🇦', cc: 'ca', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', flag: '🇦🇺', cc: 'au', name: 'Australian Dollar' },
  SGD: { symbol: 'S$', flag: '🇸🇬', cc: 'sg', name: 'Singapore Dollar' },
  CHF: { symbol: 'Fr', flag: '🇨🇭', cc: 'ch', name: 'Swiss Franc' },
  NZD: { symbol: 'NZ$', flag: '🇳🇿', cc: 'nz', name: 'New Zealand Dollar' },
  HKD: { symbol: 'HK$', flag: '🇭🇰', cc: 'hk', name: 'Hong Kong Dollar' },
  KRW: { symbol: '₩', flag: '🇰🇷', cc: 'kr', name: 'South Korean Won' },
  CNY: { symbol: '¥', flag: '🇨🇳', cc: 'cn', name: 'Chinese Yuan' },
  MXN: { symbol: 'Mex$', flag: '🇲🇽', cc: 'mx', name: 'Mexican Peso' },
  BRL: { symbol: 'R$', flag: '🇧🇷', cc: 'br', name: 'Brazilian Real' },
  ZAR: { symbol: 'R', flag: '🇿🇦', cc: 'za', name: 'South African Rand' },
  TRY: { symbol: '₺', flag: '🇹🇷', cc: 'tr', name: 'Turkish Lira' },
  RUB: { symbol: '₽', flag: '🇷🇺', cc: 'ru', name: 'Russian Ruble' },
  SEK: { symbol: 'kr', flag: '🇸🇪', cc: 'se', name: 'Swedish Krona' },
  NOK: { symbol: 'kr', flag: '🇳🇴', cc: 'no', name: 'Norwegian Krone' },
  DKK: { symbol: 'kr', flag: '🇩🇰', cc: 'dk', name: 'Danish Krone' },
  PLN: { symbol: 'zł', flag: '🇵🇱', cc: 'pl', name: 'Polish Złoty' },
  THB: { symbol: '฿', flag: '🇹🇭', cc: 'th', name: 'Thai Baht' },
  MYR: { symbol: 'RM', flag: '🇲🇾', cc: 'my', name: 'Malaysian Ringgit' },
  IDR: { symbol: 'Rp', flag: '🇮🇩', cc: 'id', name: 'Indonesian Rupiah' },
  PHP: { symbol: '₱', flag: '🇵🇭', cc: 'ph', name: 'Philippine Peso' },
  VND: { symbol: '₫', flag: '🇻🇳', cc: 'vn', name: 'Vietnamese Dong' },
  EGP: { symbol: 'E£', flag: '🇪🇬', cc: 'eg', name: 'Egyptian Pound' },
  SAR: { symbol: 'SR', flag: '🇸🇦', cc: 'sa', name: 'Saudi Riyal' },
  NGN: { symbol: '₦', flag: '🇳🇬', cc: 'ng', name: 'Nigerian Naira' },
  ARS: { symbol: '$', flag: '🇦🇷', cc: 'ar', name: 'Argentine Peso' },
  CLP: { symbol: '$', flag: '🇨🇱', cc: 'cl', name: 'Chilean Peso' },
  COP: { symbol: '$', flag: '🇨🇴', cc: 'co', name: 'Colombian Peso' },
  ILS: { symbol: '₪', flag: '🇮🇱', cc: 'il', name: 'Israeli Shekel' },
  CZK: { symbol: 'Kč', flag: '🇨🇿', cc: 'cz', name: 'Czech Koruna' },
  HUF: { symbol: 'Ft', flag: '🇭🇺', cc: 'hu', name: 'Hungarian Forint' },
  QAR: { symbol: 'QR', flag: '🇶🇦', cc: 'qa', name: 'Qatari Riyal' },
  KWD: { symbol: 'KD', flag: '🇰🇼', cc: 'kw', name: 'Kuwaiti Dinar' },
  BHD: { symbol: 'BD', flag: '🇧🇭', cc: 'bh', name: 'Bahraini Dinar' },
  OMR: { symbol: 'OR', flag: '🇴🇲', cc: 'om', name: 'Omani Rial' },
  JOD: { symbol: 'JD', flag: '🇯🇴', cc: 'jo', name: 'Jordanian Dinar' },
  LKR: { symbol: '₨', flag: '🇱🇰', cc: 'lk', name: 'Sri Lankan Rupee' },
  PKR: { symbol: '₨', flag: '🇵🇰', cc: 'pk', name: 'Pakistani Rupee' },
  BDT: { symbol: '৳', flag: '🇧🇩', cc: 'bd', name: 'Bangladeshi Taka' },
  KES: { symbol: 'KSh', flag: '🇰🇪', cc: 'ke', name: 'Kenyan Shilling' },
  GHS: { symbol: 'GH₵', flag: '🇬🇭', cc: 'gh', name: 'Ghanaian Cedi' },
  TWD: { symbol: 'NT$', flag: '🇹🇼', cc: 'tw', name: 'Taiwan Dollar' },
  UAH: { symbol: '₴', flag: '🇺🇦', cc: 'ua', name: 'Ukrainian Hryvnia' },
  RON: { symbol: 'lei', flag: '🇷🇴', cc: 'ro', name: 'Romanian Leu' },
}
// Crypto icons served from CoinCap's public asset CDN. AUR uses our custom uploaded logo.
const cc = (sym) => `https://assets.coincap.io/assets/icons/${sym.toLowerCase()}@2x.png`
export const CRYPTO_META = {
  AUR: { name: 'Aurela Coin', color: '#d4af37', logoUrl: '/aur-coin.png' },
  BTC: { name: 'Bitcoin', color: '#f7931a', logoUrl: cc('BTC') },
  ETH: { name: 'Ethereum', color: '#627eea', logoUrl: cc('ETH') },
  USDT: { name: 'Tether', color: '#26a17b', logoUrl: cc('USDT') },
  USDC: { name: 'USD Coin', color: '#2775ca', logoUrl: cc('USDC') },
  BNB: { name: 'BNB', color: '#f3ba2f', logoUrl: cc('BNB') },
  SOL: { name: 'Solana', color: '#9945ff', logoUrl: cc('SOL') },
  XRP: { name: 'XRP', color: '#00aae4', logoUrl: cc('XRP') },
  ADA: { name: 'Cardano', color: '#0033ad', logoUrl: cc('ADA') },
  DOGE: { name: 'Dogecoin', color: '#c2a633', logoUrl: cc('DOGE') },
  MATIC: { name: 'Polygon', color: '#8247e5', logoUrl: cc('MATIC') },
  AVAX: { name: 'Avalanche', color: '#e84142', logoUrl: cc('AVAX') },
  DOT: { name: 'Polkadot', color: '#e6007a', logoUrl: cc('DOT') },
  TRX: { name: 'TRON', color: '#ff060a', logoUrl: cc('TRX') },
  LINK: { name: 'Chainlink', color: '#2a5ada', logoUrl: cc('LINK') },
  ATOM: { name: 'Cosmos', color: '#2e3148', logoUrl: cc('ATOM') },
  LTC: { name: 'Litecoin', color: '#a6a9aa', logoUrl: cc('LTC') },
  BCH: { name: 'Bitcoin Cash', color: '#0ac18e', logoUrl: cc('BCH') },
  XLM: { name: 'Stellar', color: '#7d00ff', logoUrl: cc('XLM') },
  NEAR: { name: 'NEAR Protocol', color: '#00c1de', logoUrl: cc('NEAR') },
  APT: { name: 'Aptos', color: '#5b9dd9', logoUrl: cc('APT') },
  ARB: { name: 'Arbitrum', color: '#28a0f0', logoUrl: cc('ARB') },
  OP: { name: 'Optimism', color: '#ff0420', logoUrl: cc('OP') },
  SUI: { name: 'Sui', color: '#6fbcf0', logoUrl: cc('SUI') },
  TON: { name: 'Toncoin', color: '#0088cc', logoUrl: cc('TON') },
  SHIB: { name: 'Shiba Inu', color: '#ffa409', logoUrl: cc('SHIB') },
  PEPE: { name: 'Pepe', color: '#3fac31', logoUrl: cc('PEPE') },
  INJ: { name: 'Injective', color: '#00f2fe', logoUrl: cc('INJ') },
  FIL: { name: 'Filecoin', color: '#0090ff', logoUrl: cc('FIL') },
  ICP: { name: 'Internet Computer', color: '#3b00b9', logoUrl: cc('ICP') },
  HBAR: { name: 'Hedera', color: '#8259ef', logoUrl: cc('HBAR') },
}

// -----------------------------------------------------------------------------
// Circular gold-bordered icon components for premium currency display.
// CoinIcon renders a crypto logo; FlagIcon renders a country flag for fiat.
// Both gracefully fall back to a text/emoji rendering if the image fails.
// -----------------------------------------------------------------------------
export function CoinIcon({ code, size = 24, className = '' }) {
  const meta = CRYPTO_META[code]
  const [err, setErr] = useState(false)
  const style = { width: size, height: size, minWidth: size, minHeight: size }
  return (
    <span
      style={style}
      className={`inline-flex items-center justify-center rounded-full border border-gold-bright/60 bg-black/40 overflow-hidden shrink-0 shadow-[0_0_6px_rgba(212,175,55,0.25)] ${className}`}
    >
      {meta?.logoUrl && !err ? (
        <img src={meta.logoUrl} alt={code} width={size} height={size} className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <span className="text-[9px] font-bold text-gold-bright leading-none">{code}</span>
      )}
    </span>
  )
}

export function FlagIcon({ code, size = 24, className = '' }) {
  const meta = FIAT_META[code]
  const [err, setErr] = useState(false)
  const url = meta?.cc ? `https://flagcdn.com/w80/${meta.cc}.png` : null
  const style = { width: size, height: size, minWidth: size, minHeight: size }
  return (
    <span
      style={style}
      className={`inline-flex items-center justify-center rounded-full border border-gold-bright/60 bg-black/40 overflow-hidden shrink-0 shadow-[0_0_6px_rgba(212,175,55,0.25)] ${className}`}
    >
      {url && !err ? (
        <img src={url} alt={code} width={size} height={size} className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <span className="text-sm leading-none">{meta?.flag || code}</span>
      )}
    </span>
  )
}

export function fmt(amount, currency, opts = {}) {
  const n = Number(amount || 0)
  const sym = FIAT_META[currency]?.symbol
  const digits = ['BTC','ETH'].includes(currency) ? 6 : ['JPY','INR'].includes(currency) ? 2 : 2
  const s = n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  if (sym) return (sym.length > 1 ? sym + ' ' : sym) + s
  return s + ' ' + currency
}

// -----------------------------------------------------------------------------
// KYC — country-specific supported identity documents. Falls back to `DEFAULT`.
// This drives the KYC form doc-type dropdown.
// -----------------------------------------------------------------------------
export const KYC_DOCS_BY_COUNTRY = {
  US: ['US Passport','Driver License','State ID','Green Card','Social Security Card','Military ID'],
  IN: ['Indian Passport','Aadhaar Card','PAN Card','Voter ID','Driving License'],
  GB: ['UK Passport','Driving Licence','Biometric Residence Permit','National ID'],
  CA: ['Canadian Passport','Driver Licence','Provincial ID','PR Card'],
  AU: ['Australian Passport','Driver Licence','Medicare Card','Proof of Age Card'],
  DE: ['German Passport','Personalausweis (ID Card)','Driving Licence','Aufenthaltstitel'],
  FR: ['French Passport','Carte Nationale d\u2019Identit\u00e9','Permis de Conduire','Titre de S\u00e9jour'],
  IT: ["Italian Passport",'Carta d\u2019Identit\u00e0','Patente di Guida','Permesso di Soggiorno'],
  ES: ['Spanish Passport','DNI','NIE Card','Driving Licence'],
  NL: ['Dutch Passport','Identity Card (ID-kaart)','Driving Licence','Residence Permit'],
  BE: ['Belgian Passport','eID Card','Driving Licence','Residence Permit'],
  CH: ['Swiss Passport','Swiss Identity Card','Driving Licence','Permit B/C'],
  AT: ['Austrian Passport','Personalausweis','F\u00fchrerschein','Aufenthaltstitel'],
  SE: ['Swedish Passport','National ID Card','Driving Licence','BankID (screenshot)'],
  NO: ['Norwegian Passport','National ID Card','Driver\u2019s Licence'],
  DK: ['Danish Passport','CPR Card','Driver\u2019s Licence','Yellow Health Insurance Card'],
  FI: ['Finnish Passport','Identity Card','Driver\u2019s Licence','Kela Card'],
  PL: ['Polish Passport','Dow\u00f3d Osobisty','Prawo Jazdy','Karta Pobytu'],
  RU: ['Russian Passport','Internal Passport','Driving Licence'],
  UA: ['Ukrainian Passport','ID Card','Driving Licence'],
  TR: ['Turkish Passport','T.C. Kimlik Kart\u0131','Driving Licence','Residence Permit'],
  IL: ['Israeli Passport','Teudat Zehut (ID)','Driving Licence'],
  AE: ['UAE Passport','Emirates ID','Driving Licence','Residence Visa'],
  SA: ['Saudi Passport','Saudi National ID','Iqama (Residence)','Driving Licence'],
  QA: ['Qatari Passport','Qatar ID','Residence Permit'],
  KW: ['Kuwaiti Passport','Civil ID Card','Driving Licence'],
  BH: ['Bahraini Passport','CPR Card','Driving Licence'],
  OM: ['Omani Passport','Resident Card','Driving Licence'],
  JO: ['Jordanian Passport','National ID Card','Driving Licence'],
  EG: ['Egyptian Passport','National ID','Driving Licence'],
  NG: ['Nigerian Passport','NIN Slip','Voter\u2019s Card','Driver\u2019s Licence','BVN Letter'],
  KE: ['Kenyan Passport','National ID','Driving Licence','Alien ID'],
  GH: ['Ghanaian Passport','Ghana Card','Voter\u2019s ID','Driver\u2019s Licence'],
  ZA: ['South African Passport','Smart ID Card','Green Barcoded ID','Driver\u2019s Licence'],
  BR: ['Brazilian Passport','RG (Identity Card)','CPF Card','CNH (Driver Licence)'],
  MX: ['Mexican Passport','INE / IFE','C\u00e9dula Profesional','Driver Licence'],
  AR: ['Argentine Passport','DNI','Driver Licence','C\u00e9dula de Identidad'],
  CL: ['Chilean Passport','C\u00e9dula de Identidad','Driver Licence'],
  CO: ['Colombian Passport','C\u00e9dula de Ciudadan\u00eda','Driver Licence'],
  JP: ['Japanese Passport','My Number Card','Driver\u2019s Licence','Zairyu Card'],
  KR: ['Korean Passport','Resident Registration Card','Driver\u2019s Licence','Alien Registration Card'],
  CN: ['Chinese Passport','Resident Identity Card','Hukou Booklet','Driver\u2019s Licence'],
  HK: ['HKSAR Passport','Hong Kong ID Card','Driver\u2019s Licence'],
  TW: ['Taiwan Passport','National ID Card','Driver\u2019s Licence','ARC (Alien Resident)'],
  SG: ['Singapore Passport','NRIC','FIN Card (Employment/Long-term Pass)','Driving Licence'],
  MY: ['Malaysian Passport','MyKad','Driving Licence','MyPR / MyKAS'],
  ID: ['Indonesian Passport','KTP','SIM (Driving Licence)','KITAS'],
  TH: ['Thai Passport','National ID Card','Driving Licence','Pink ID (Non-Thai)'],
  VN: ['Vietnamese Passport','Citizen Identification Card','CMND','Driving Licence'],
  PH: ['Philippine Passport','UMID','PhilID','Driver\u2019s Licence','PRC ID'],
  PK: ['Pakistani Passport','CNIC','NICOP','Driving Licence'],
  BD: ['Bangladeshi Passport','NID','Driving Licence','Birth Registration'],
  LK: ['Sri Lankan Passport','NIC','Driving Licence'],
  NP: ['Nepali Passport','Citizenship Certificate','Driving Licence','National ID'],
  NZ: ['New Zealand Passport','Driver Licence','Firearms Licence','18+ Card'],
  DEFAULT: ['Passport','National ID Card','Driver\u2019s Licence','Residence Permit','Voter ID']
}

// Countries for the KYC form (ISO-2 code → label + emoji)
export const KYC_COUNTRIES = [
  ['US','\ud83c\uddfa\ud83c\uddf8 United States'],['IN','\ud83c\uddee\ud83c\uddf3 India'],['GB','\ud83c\uddec\ud83c\udde7 United Kingdom'],
  ['CA','\ud83c\udde8\ud83c\udde6 Canada'],['AU','\ud83c\udde6\ud83c\uddfa Australia'],['NZ','\ud83c\uddf3\ud83c\uddff New Zealand'],
  ['DE','\ud83c\udde9\ud83c\uddea Germany'],['FR','\ud83c\uddeb\ud83c\uddf7 France'],['IT','\ud83c\uddee\ud83c\uddf9 Italy'],
  ['ES','\ud83c\uddea\ud83c\uddf8 Spain'],['NL','\ud83c\uddf3\ud83c\uddf1 Netherlands'],['BE','\ud83c\udde7\ud83c\uddea Belgium'],
  ['CH','\ud83c\udde8\ud83c\udded Switzerland'],['AT','\ud83c\udde6\ud83c\uddf9 Austria'],['SE','\ud83c\uddf8\ud83c\uddea Sweden'],
  ['NO','\ud83c\uddf3\ud83c\uddf4 Norway'],['DK','\ud83c\udde9\ud83c\uddf0 Denmark'],['FI','\ud83c\uddeb\ud83c\uddee Finland'],
  ['PL','\ud83c\uddf5\ud83c\uddf1 Poland'],['RU','\ud83c\uddf7\ud83c\uddfa Russia'],['UA','\ud83c\uddfa\ud83c\udde6 Ukraine'],
  ['TR','\ud83c\uddf9\ud83c\uddf7 Turkey'],['IL','\ud83c\uddee\ud83c\uddf1 Israel'],['AE','\ud83c\udde6\ud83c\uddea United Arab Emirates'],
  ['SA','\ud83c\uddf8\ud83c\udde6 Saudi Arabia'],['QA','\ud83c\uddf6\ud83c\udde6 Qatar'],['KW','\ud83c\uddf0\ud83c\uddfc Kuwait'],
  ['BH','\ud83c\udde7\ud83c\udded Bahrain'],['OM','\ud83c\uddf4\ud83c\uddf2 Oman'],['JO','\ud83c\uddef\ud83c\uddf4 Jordan'],
  ['EG','\ud83c\uddea\ud83c\uddec Egypt'],['NG','\ud83c\uddf3\ud83c\uddec Nigeria'],['KE','\ud83c\uddf0\ud83c\uddea Kenya'],
  ['GH','\ud83c\uddec\ud83c\udded Ghana'],['ZA','\ud83c\uddff\ud83c\udde6 South Africa'],['BR','\ud83c\udde7\ud83c\uddf7 Brazil'],
  ['MX','\ud83c\uddf2\ud83c\uddfd Mexico'],['AR','\ud83c\udde6\ud83c\uddf7 Argentina'],['CL','\ud83c\udde8\ud83c\uddf1 Chile'],
  ['CO','\ud83c\udde8\ud83c\uddf4 Colombia'],['JP','\ud83c\uddef\ud83c\uddf5 Japan'],['KR','\ud83c\uddf0\ud83c\uddf7 South Korea'],
  ['CN','\ud83c\udde8\ud83c\uddf3 China'],['HK','\ud83c\udded\ud83c\uddf0 Hong Kong'],['TW','\ud83c\uddf9\ud83c\uddfc Taiwan'],
  ['SG','\ud83c\uddf8\ud83c\uddec Singapore'],['MY','\ud83c\uddf2\ud83c\uddfe Malaysia'],['ID','\ud83c\uddee\ud83c\udde9 Indonesia'],
  ['TH','\ud83c\uddf9\ud83c\udded Thailand'],['VN','\ud83c\uddfb\ud83c\uddf3 Vietnam'],['PH','\ud83c\uddf5\ud83c\udded Philippines'],
  ['PK','\ud83c\uddf5\ud83c\uddf0 Pakistan'],['BD','\ud83c\udde7\ud83c\udde9 Bangladesh'],['LK','\ud83c\uddf1\ud83c\uddf0 Sri Lanka'],['NP','\ud83c\uddf3\ud83c\uddf5 Nepal'],
]

// Deposit / withdrawal methods with per-method required fields.
// Field types: text | number | select
export const FIAT_METHODS = {
  bank_swift: {
    label: 'International Bank (SWIFT)',
    fields: [
      { key: 'bank_name', label: 'Bank name', type: 'text', required: true },
      { key: 'account_holder', label: 'Account holder name', type: 'text', required: true },
      { key: 'account_number', label: 'Account / IBAN', type: 'text', required: true },
      { key: 'swift_code', label: 'SWIFT / BIC', type: 'text', required: true },
      { key: 'bank_address', label: 'Bank address', type: 'text' },
    ]
  },
  bank_indian: {
    label: 'Indian Bank Transfer',
    fields: [
      { key: 'bank_name', label: 'Bank name', type: 'text', required: true },
      { key: 'account_holder', label: 'Account holder name', type: 'text', required: true },
      { key: 'account_number', label: 'Account number', type: 'text', required: true },
      { key: 'ifsc', label: 'IFSC code', type: 'text', required: true },
      { key: 'branch', label: 'Branch (optional)', type: 'text' },
    ]
  },
  upi: {
    label: 'UPI (India)',
    fields: [
      { key: 'upi_id', label: 'UPI ID (name@bank)', type: 'text', required: true },
      { key: 'account_holder', label: 'Account holder name', type: 'text', required: true },
    ]
  },
  paypal: {
    label: 'PayPal',
    fields: [
      { key: 'paypal_email', label: 'PayPal email', type: 'text', required: true },
      { key: 'account_holder', label: 'Account holder name', type: 'text', required: true },
    ]
  },
  stripe: {
    label: 'Card Payment (Stripe)',
    fields: [
      { key: 'card_holder', label: 'Cardholder name', type: 'text', required: true },
      { key: 'card_last4', label: 'Card last 4 digits', type: 'text', required: true },
      { key: 'card_brand', label: 'Card brand (VISA / MC / AMEX)', type: 'text' },
      { key: 'reference', label: 'Payment reference / receipt', type: 'text' },
    ]
  },
  card: {
    label: 'Debit / Credit Card',
    fields: [
      { key: 'card_holder', label: 'Cardholder name', type: 'text', required: true },
      { key: 'card_last4', label: 'Card last 4 digits', type: 'text', required: true },
      { key: 'card_brand', label: 'Card brand', type: 'text' },
    ]
  },
  sepa: {
    label: 'SEPA (EU)',
    fields: [
      { key: 'account_holder', label: 'Account holder name', type: 'text', required: true },
      { key: 'iban', label: 'IBAN', type: 'text', required: true },
      { key: 'bic', label: 'BIC (optional)', type: 'text' },
    ]
  },
  ach: {
    label: 'ACH (US Bank)',
    fields: [
      { key: 'account_holder', label: 'Account holder name', type: 'text', required: true },
      { key: 'routing_number', label: 'Routing number', type: 'text', required: true },
      { key: 'account_number', label: 'Account number', type: 'text', required: true },
      { key: 'account_type', label: 'Account type (checking/savings)', type: 'text' },
    ]
  },
  wise: {
    label: 'Wise Transfer',
    fields: [
      { key: 'account_holder', label: 'Account holder name', type: 'text', required: true },
      { key: 'wise_reference', label: 'Wise reference', type: 'text', required: true },
    ]
  },
}
