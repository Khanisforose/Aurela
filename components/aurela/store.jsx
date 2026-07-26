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
    // Live market data polling every 30s
    const iv = setInterval(async () => {
      try { const r = await api.get('/rates'); setRates(r) } catch(e) {}
    }, 30000)
    return () => clearInterval(iv)
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
    <AppCtx.Provider value={{ api, user, setUser, loading, route, setRoute, publicPage, setPublicPage, authMode, setAuthMode, rates, setRates, config, login, register, logout, refreshUser }}>
      {children}
    </AppCtx.Provider>
  )
}

export function useApp() { return useContext(AppCtx) }

// Utilities
export const FIAT_META = {
  USD: { symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
  EUR: { symbol: '€', flag: '🇪🇺', name: 'Euro' },
  GBP: { symbol: '£', flag: '🇬🇧', name: 'British Pound' },
  INR: { symbol: '₹', flag: '🇮🇳', name: 'Indian Rupee' },
  AED: { symbol: 'AED', flag: '🇦🇪', name: 'UAE Dirham' },
  JPY: { symbol: '¥', flag: '🇯🇵', name: 'Japanese Yen' },
  CAD: { symbol: 'C$', flag: '🇨🇦', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', flag: '🇦🇺', name: 'Australian Dollar' },
  SGD: { symbol: 'S$', flag: '🇸🇬', name: 'Singapore Dollar' },
  CHF: { symbol: 'Fr', flag: '🇨🇭', name: 'Swiss Franc' },
  NZD: { symbol: 'NZ$', flag: '🇳🇿', name: 'New Zealand Dollar' },
  HKD: { symbol: 'HK$', flag: '🇭🇰', name: 'Hong Kong Dollar' },
  KRW: { symbol: '₩', flag: '🇰🇷', name: 'South Korean Won' },
  CNY: { symbol: '¥', flag: '🇨🇳', name: 'Chinese Yuan' },
  MXN: { symbol: 'Mex$', flag: '🇲🇽', name: 'Mexican Peso' },
  BRL: { symbol: 'R$', flag: '🇧🇷', name: 'Brazilian Real' },
  ZAR: { symbol: 'R', flag: '🇿🇦', name: 'South African Rand' },
  TRY: { symbol: '₺', flag: '🇹🇷', name: 'Turkish Lira' },
  RUB: { symbol: '₽', flag: '🇷🇺', name: 'Russian Ruble' },
  SEK: { symbol: 'kr', flag: '🇸🇪', name: 'Swedish Krona' },
  NOK: { symbol: 'kr', flag: '🇳🇴', name: 'Norwegian Krone' },
  DKK: { symbol: 'kr', flag: '🇩🇰', name: 'Danish Krone' },
  PLN: { symbol: 'zł', flag: '🇵🇱', name: 'Polish Złoty' },
  THB: { symbol: '฿', flag: '🇹🇭', name: 'Thai Baht' },
  MYR: { symbol: 'RM', flag: '🇲🇾', name: 'Malaysian Ringgit' },
  IDR: { symbol: 'Rp', flag: '🇮🇩', name: 'Indonesian Rupiah' },
  PHP: { symbol: '₱', flag: '🇵🇭', name: 'Philippine Peso' },
  VND: { symbol: '₫', flag: '🇻🇳', name: 'Vietnamese Dong' },
  EGP: { symbol: 'E£', flag: '🇪🇬', name: 'Egyptian Pound' },
  SAR: { symbol: 'SR', flag: '🇸🇦', name: 'Saudi Riyal' },
  NGN: { symbol: '₦', flag: '🇳🇬', name: 'Nigerian Naira' },
  ARS: { symbol: '$', flag: '🇦🇷', name: 'Argentine Peso' },
  CLP: { symbol: '$', flag: '🇨🇱', name: 'Chilean Peso' },
  COP: { symbol: '$', flag: '🇨🇴', name: 'Colombian Peso' },
  ILS: { symbol: '₪', flag: '🇮🇱', name: 'Israeli Shekel' },
  CZK: { symbol: 'Kč', flag: '🇨🇿', name: 'Czech Koruna' },
  HUF: { symbol: 'Ft', flag: '🇭🇺', name: 'Hungarian Forint' },
  QAR: { symbol: 'QR', flag: '🇶🇦', name: 'Qatari Riyal' },
  KWD: { symbol: 'KD', flag: '🇰🇼', name: 'Kuwaiti Dinar' },
  BHD: { symbol: 'BD', flag: '🇧🇭', name: 'Bahraini Dinar' },
  OMR: { symbol: 'OR', flag: '🇴🇲', name: 'Omani Rial' },
  JOD: { symbol: 'JD', flag: '🇯🇴', name: 'Jordanian Dinar' },
  LKR: { symbol: '₨', flag: '🇱🇰', name: 'Sri Lankan Rupee' },
  PKR: { symbol: '₨', flag: '🇵🇰', name: 'Pakistani Rupee' },
  BDT: { symbol: '৳', flag: '🇧🇩', name: 'Bangladeshi Taka' },
  KES: { symbol: 'KSh', flag: '🇰🇪', name: 'Kenyan Shilling' },
  GHS: { symbol: 'GH₵', flag: '🇬🇭', name: 'Ghanaian Cedi' },
  TWD: { symbol: 'NT$', flag: '🇹🇼', name: 'Taiwan Dollar' },
  UAH: { symbol: '₴', flag: '🇺🇦', name: 'Ukrainian Hryvnia' },
  RON: { symbol: 'lei', flag: '🇷🇴', name: 'Romanian Leu' },
}
export const CRYPTO_META = {
  BTC: { name: 'Bitcoin', color: '#f7931a' },
  ETH: { name: 'Ethereum', color: '#627eea' },
  USDT: { name: 'Tether', color: '#26a17b' },
  USDC: { name: 'USD Coin', color: '#2775ca' },
  BNB: { name: 'BNB', color: '#f3ba2f' },
  SOL: { name: 'Solana', color: '#9945ff' },
  XRP: { name: 'XRP', color: '#00aae4' },
  ADA: { name: 'Cardano', color: '#0033ad' },
  DOGE: { name: 'Dogecoin', color: '#c2a633' },
  MATIC: { name: 'Polygon', color: '#8247e5' },
  AVAX: { name: 'Avalanche', color: '#e84142' },
  DOT: { name: 'Polkadot', color: '#e6007a' },
  TRX: { name: 'TRON', color: '#ff060a' },
  LINK: { name: 'Chainlink', color: '#2a5ada' },
  ATOM: { name: 'Cosmos', color: '#2e3148' },
  LTC: { name: 'Litecoin', color: '#a6a9aa' },
  BCH: { name: 'Bitcoin Cash', color: '#0ac18e' },
  XLM: { name: 'Stellar', color: '#7d00ff' },
  NEAR: { name: 'NEAR Protocol', color: '#00c1de' },
  APT: { name: 'Aptos', color: '#5b9dd9' },
  ARB: { name: 'Arbitrum', color: '#28a0f0' },
  OP: { name: 'Optimism', color: '#ff0420' },
  SUI: { name: 'Sui', color: '#6fbcf0' },
  TON: { name: 'Toncoin', color: '#0088cc' },
  SHIB: { name: 'Shiba Inu', color: '#ffa409' },
  PEPE: { name: 'Pepe', color: '#3fac31' },
  INJ: { name: 'Injective', color: '#00f2fe' },
  FIL: { name: 'Filecoin', color: '#0090ff' },
  ICP: { name: 'Internet Computer', color: '#3b00b9' },
  HBAR: { name: 'Hedera', color: '#8259ef' },
}

export function fmt(amount, currency, opts = {}) {
  const n = Number(amount || 0)
  const sym = FIAT_META[currency]?.symbol
  const digits = ['BTC','ETH'].includes(currency) ? 6 : ['JPY','INR'].includes(currency) ? 2 : 2
  const s = n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  if (sym) return (sym.length > 1 ? sym + ' ' : sym) + s
  return s + ' ' + currency
}
