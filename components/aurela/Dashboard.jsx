'use client'

import { useEffect, useState, useMemo } from 'react'
import { useApp, FIAT_META, CRYPTO_META, fmt } from './store'
import { AurelaLogo, AurelaWordmark } from './Logo'
import { CardVisual } from './Landing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Wallet, Bitcoin, Send, CreditCard, ArrowDownToLine, ArrowUpFromLine,
  Receipt, ShieldCheck, User, LogOut, Copy, Eye, EyeOff, Snowflake, Flame, Sparkles,
  ChevronRight, TrendingUp, ArrowUpRight, ArrowDownRight, Plus, Search, Link2, Blocks
} from 'lucide-react'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'fiat', label: 'Fiat Wallets', icon: Wallet },
  { id: 'crypto', label: 'Crypto Wallets', icon: Bitcoin },
  { id: 'transfer', label: 'Send', icon: Send },
  { id: 'cards', label: 'Cards', icon: CreditCard },
  { id: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
  { id: 'withdraw', label: 'Withdraw', icon: ArrowUpFromLine },
  { id: 'transactions', label: 'Activity', icon: Receipt },
  { id: 'chain', label: 'Aurela Chain', icon: Blocks },
  { id: 'kyc', label: 'Verification', icon: ShieldCheck },
  { id: 'profile', label: 'Profile', icon: User },
]

export function Dashboard() {
  const { user, logout, api, refreshUser } = useApp()
  const [tab, setTab] = useState('overview')
  const [wallets, setWallets] = useState([])
  const [totals, setTotals] = useState({ usd: 0, preferred: 0, preferred_currency: 'USD' })
  const [txs, setTxs] = useState([])
  const [cards, setCards] = useState([])

  const loadWallets = async () => {
    try { const { wallets, totals } = await api.get('/wallets'); setWallets(wallets); setTotals(totals) } catch(e) {}
  }
  const loadTxs = async () => {
    try { const { transactions } = await api.get('/transactions'); setTxs(transactions) } catch(e) {}
  }
  const loadCards = async () => {
    try { const { cards } = await api.get('/cards'); setCards(cards) } catch(e) {}
  }
  const loadAll = async () => { await Promise.all([loadWallets(), loadTxs(), loadCards()]) }

  useEffect(() => { loadAll() }, [])

  const fiatWallets = wallets.filter(w => w.type === 'fiat')
  const cryptoWallets = wallets.filter(w => w.type === 'crypto')

  return (
    <div className="min-h-screen bg-onyx-radial">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-gold-500/10 bg-onyx-900/60 backdrop-blur-xl p-6 hidden lg:flex flex-col">
        <AurelaWordmark />
        <div className="mt-8 space-y-1 flex-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${tab === n.id ? 'gold-btn' : 'text-muted-foreground hover:text-gold hover:bg-gold-500/5'}`}>
              <n.icon className="h-4 w-4"/> {n.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={logout} className="justify-start text-muted-foreground hover:text-gold">
          <LogOut className="h-4 w-4 mr-2"/> Sign out
        </Button>
      </aside>

      <main className="lg:ml-64 min-h-screen">
        {/* Topbar */}
        <div className="sticky top-0 z-30 border-b border-gold-500/10 bg-onyx-900/70 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{tab === 'overview' ? 'Welcome back' : NAV.find(n => n.id === tab)?.label}</div>
              <div className="font-display text-2xl">{user?.full_name || user?.username}</div>
            </div>
            <div className="flex items-center gap-3">
              <CurrencySwitcher onSaved={async () => { await refreshUser(); await loadWallets() }} />
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center text-onyx-900 font-bold">
                {(user?.full_name || user?.username || 'A').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
          {/* Mobile nav */}
          <div className="lg:hidden overflow-x-auto flex gap-2 px-6 pb-3">
            {NAV.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)} className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${tab === n.id ? 'gold-btn' : 'text-muted-foreground border border-gold-500/20'}`}>
                {n.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              {tab === 'overview' && <OverviewTab user={user} totals={totals} wallets={wallets} txs={txs} cards={cards} onTab={setTab}/>}
              {tab === 'fiat' && <WalletsTab wallets={fiatWallets} kind="fiat"/>}
              {tab === 'crypto' && <WalletsTab wallets={cryptoWallets} kind="crypto"/>}
              {tab === 'transfer' && <TransferTab wallets={wallets} onDone={loadAll}/>}
              {tab === 'cards' && <CardsTab cards={cards} onChange={loadCards} onWalletChange={loadWallets}/>}
              {tab === 'deposit' && <DepositTab wallets={wallets} onDone={loadAll}/>}
              {tab === 'withdraw' && <WithdrawTab wallets={wallets} onDone={loadAll}/>}
              {tab === 'transactions' && <TransactionsTab txs={txs}/>}
              {tab === 'chain' && <ChainTab/>}
              {tab === 'kyc' && <KycTab user={user} onDone={refreshUser}/>}
              {tab === 'profile' && <ProfileTab user={user} onDone={refreshUser}/>}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

function CurrencySwitcher({ onSaved }) {
  const { user, api } = useApp()
  const change = async (v) => {
    try { await api.put('/profile', { preferred_currency: v }); toast.success(`Displaying in ${v}`); onSaved && onSaved() } catch(e) { toast.error(e.message) }
  }
  return (
    <Select value={user?.preferred_currency || 'USD'} onValueChange={change}>
      <SelectTrigger className="w-32 bg-secondary border-gold-500/20">
        <SelectValue/>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(FIAT_META).map(([c, m]) => (
          <SelectItem key={c} value={c}>{m.flag} {c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function OverviewTab({ user, totals, wallets, txs, cards, onTab }) {
  const topCrypto = wallets.filter(w => w.type === 'crypto').sort((a,b) => b.balance_usd - a.balance_usd).slice(0, 4)
  const topFiat = wallets.filter(w => w.type === 'fiat').filter(w => w.balance > 0).slice(0, 4)

  return (
    <div className="space-y-6">
      {/* Balance hero */}
      <div className="card-luxury rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(400px 200px at 90% 0%, rgba(212,175,55,0.25), transparent 70%)' }}/>
        <div className="relative">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total portfolio</div>
          <div className="font-display text-5xl md:text-6xl mt-2 gold-text">
            {fmt(totals.preferred, totals.preferred_currency)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">≈ {fmt(totals.usd, 'USD')} across {wallets.length} wallets</div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => onTab('transfer')} className="gold-btn rounded-full"><Send className="h-4 w-4 mr-2"/> Send</Button>
            <Button onClick={() => onTab('deposit')} variant="outline" className="rounded-full border-gold-500/40"><ArrowDownToLine className="h-4 w-4 mr-2"/> Deposit</Button>
            <Button onClick={() => onTab('withdraw')} variant="outline" className="rounded-full border-gold-500/40"><ArrowUpFromLine className="h-4 w-4 mr-2"/> Withdraw</Button>
            <Button onClick={() => onTab('cards')} variant="outline" className="rounded-full border-gold-500/40"><CreditCard className="h-4 w-4 mr-2"/> Cards</Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Fiat holdings */}
        <div className="card-luxury rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="font-display text-xl">Fiat</div>
            <button onClick={() => onTab('fiat')} className="text-xs text-gold flex items-center gap-1 hover:gap-2 transition-all">View all <ChevronRight className="h-3 w-3"/></button>
          </div>
          <div className="mt-4 space-y-3">
            {topFiat.length === 0 && <div className="text-sm text-muted-foreground">Fund your USD wallet to begin.</div>}
            {topFiat.map(w => <WalletRow key={w.id} w={w}/>)}
          </div>
        </div>

        {/* Crypto holdings */}
        <div className="card-luxury rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="font-display text-xl">Crypto</div>
            <button onClick={() => onTab('crypto')} className="text-xs text-gold flex items-center gap-1 hover:gap-2 transition-all">View all <ChevronRight className="h-3 w-3"/></button>
          </div>
          <div className="mt-4 space-y-3">
            {topCrypto.map(w => <WalletRow key={w.id} w={w}/>)}
          </div>
        </div>

        {/* Card preview */}
        <div className="card-luxury rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="font-display text-xl">Your Card</div>
            <button onClick={() => onTab('cards')} className="text-xs text-gold flex items-center gap-1 hover:gap-2 transition-all">Manage <ChevronRight className="h-3 w-3"/></button>
          </div>
          <div className="mt-4 relative h-[190px]">
            {cards.length > 0 ? (
              <MiniCard card={cards[0]}/>
            ) : (
              <div className="absolute inset-0 rounded-2xl border border-dashed border-gold-500/30 flex flex-col items-center justify-center gap-2">
                <CreditCard className="h-8 w-8 text-gold"/>
                <div className="text-sm text-muted-foreground">No card yet</div>
                <Button size="sm" onClick={() => onTab('cards')} className="gold-btn rounded-full">Request card</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card-luxury rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="font-display text-xl">Recent activity</div>
          <button onClick={() => onTab('transactions')} className="text-xs text-gold flex items-center gap-1 hover:gap-2 transition-all">See all <ChevronRight className="h-3 w-3"/></button>
        </div>
        <div className="mt-4">
          <TxTable txs={txs.slice(0, 6)} me={user}/>
        </div>
      </div>
    </div>
  )
}

function WalletRow({ w }) {
  const meta = w.type === 'fiat' ? FIAT_META[w.currency] : CRYPTO_META[w.currency]
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gold-500/25 to-gold-800/25 border border-gold-500/25 flex items-center justify-center text-sm">
          {w.type === 'fiat' ? meta?.flag : <span className="text-gold-bright text-[10px] font-bold">{w.currency}</span>}
        </div>
        <div>
          <div className="text-sm">{w.currency}</div>
          <div className="text-xs text-muted-foreground">{w.type === 'fiat' ? meta?.name : meta?.name}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono">{fmt(w.balance, w.currency)}</div>
        <div className="text-xs text-muted-foreground">≈ {fmt(w.balance_usd, 'USD')}</div>
      </div>
    </div>
  )
}

function MiniCard({ card }) {
  return (
    <div className={`credit-card ${card.tier} rounded-2xl p-4 h-full`}>
      <div className="flex items-center justify-between">
        <AurelaLogo size={24} glow={false}/>
        <div className="text-[10px] uppercase tracking-widest text-gold">{card.tier_name}</div>
      </div>
      <div className="font-mono text-lg mt-6 text-gold-bright tracking-widest">{card.number.replace(/(\w{4} \w{4}) (\w{4})/, '$1 •••• $2').slice(0, 19)} ••••</div>
      <div className="flex justify-between text-xs mt-4">
        <span className="text-muted-foreground">{card.holder}</span>
        <span className="font-mono">{card.expiry}</span>
      </div>
      <div className="mt-2"><Badge variant="outline" className={`border-gold-500/40 ${card.status==='active'?'text-gold':'text-muted-foreground'}`}>{card.status}</Badge></div>
    </div>
  )
}

function WalletsTab({ wallets, kind }) {
  const { config } = useApp()
  const platformWallets = config?.platform_wallets || []
  const findPlatform = (asset, network) => platformWallets.find(p => p.asset === asset && (!network || p.network === network))

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {wallets.map(w => {
        const meta = kind === 'fiat' ? FIAT_META[w.currency] : CRYPTO_META[w.currency]
        const platformOptions = kind === 'crypto' ? platformWallets.filter(p => p.asset === w.currency) : []
        return (
          <div key={w.id} className="card-luxury rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gold-500/25 to-gold-800/25 border border-gold-500/25 flex items-center justify-center">
                  {kind === 'fiat' ? <span className="text-lg">{meta?.flag}</span> : <span className="text-[10px] font-bold text-gold-bright">{w.currency}</span>}
                </div>
                <div>
                  <div className="font-display text-lg">{w.currency}</div>
                  <div className="text-xs text-muted-foreground">{meta?.name}</div>
                </div>
              </div>
              {kind === 'crypto' && <Badge variant="outline" className="border-gold-500/30 text-gold text-[10px]">{platformOptions[0]?.network || (w.networks||[])[0]}</Badge>}
            </div>
            <div className="mt-4">
              <div className="font-display text-3xl gold-text">{fmt(w.balance, w.currency)}</div>
              <div className="text-xs text-muted-foreground mt-1">≈ {fmt(w.balance_usd, 'USD')}</div>
            </div>
            {kind === 'crypto' && platformOptions.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Deposit address{platformOptions.length > 1 ? 'es' : ''}</div>
                {platformOptions.map(p => (
                  <div key={p.id} className="p-3 rounded-lg bg-secondary">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                      <span>{p.network}</span>
                      <button onClick={() => { navigator.clipboard.writeText(p.address); toast.success(`${p.asset} ${p.network} copied`) }} className="hover:text-gold"><Copy className="h-3 w-3"/></button>
                    </div>
                    <div className="font-mono text-gold text-xs break-all mt-1">{p.address}</div>
                  </div>
                ))}
              </div>
            )}
            {kind === 'crypto' && platformOptions.length === 0 && (
              <div className="mt-4 text-xs text-muted-foreground">Deposit address not yet configured by administration.</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TransferTab({ wallets, onDone }) {
  const { api, user } = useApp()
  const [form, setForm] = useState({ recipient: '', currency: 'USD', amount: '', note: '' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      await api.post('/transfer', { recipient: form.recipient, currency: form.currency, amount: Number(form.amount), note: form.note })
      toast.success('Transfer sent ✨')
      setForm({ recipient: '', currency: form.currency, amount: '', note: '' })
      onDone && onDone()
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const wallet = wallets.find(w => w.currency === form.currency)

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Instant transfer</div>
        <div className="text-sm text-muted-foreground">Send fiat or crypto by username, email or wallet ID — zero fees inside Aurela.</div>

        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Recipient</Label>
            <Input value={form.recipient} onChange={e => setForm({...form, recipient: e.target.value })} placeholder="username, email or wallet ID" className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Fiat</div>
                  {Object.keys(FIAT_META).map(c => <SelectItem key={c} value={c}>{FIAT_META[c].flag} {c}</SelectItem>)}
                  <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>
                  {Object.keys(CRYPTO_META).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Amount</Label>
              <Input value={form.amount} type="number" step="any" onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
              {wallet && <div className="text-xs text-muted-foreground mt-1">Available: {fmt(wallet.balance, wallet.currency)}</div>}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Note (optional)</Label>
            <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <Button onClick={submit} disabled={loading || !form.recipient || !form.amount} className="gold-btn w-full h-12 rounded-xl">
            {loading ? 'Sending…' : 'Send transfer'}
          </Button>
        </div>
      </div>

      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-xl">Your Aurela ID</div>
        <div className="mt-3 p-4 rounded-lg bg-secondary">
          <div className="text-xs text-muted-foreground">Username</div>
          <div className="font-mono text-gold text-lg mt-1">@{user?.username}</div>
          <div className="text-xs text-muted-foreground mt-3">Email</div>
          <div className="font-mono text-gold-bright text-sm mt-1">{user?.email}</div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">Share your username or email with anyone on Aurela to receive instant zero-fee transfers.</div>
      </div>
    </div>
  )
}

function CardsTab({ cards, onChange, onWalletChange }) {
  const { api, config } = useApp()
  const [openReq, setOpenReq] = useState(false)
  const [openAct, setOpenAct] = useState(null)
  const [tier, setTier] = useState('basic')
  const [actNetwork, setActNetwork] = useState('ERC20')
  const [showCvv, setShowCvv] = useState({})
  const [loading, setLoading] = useState(false)

  const usdtWallets = (config?.platform_wallets || []).filter(p => p.asset === 'USDT')
  const activeActWallet = usdtWallets.find(p => p.network === actNetwork) || usdtWallets[0]

  const request = async () => {
    setLoading(true)
    try {
      await api.post('/cards/request', { tier })
      toast.success('Card issued — activate to use')
      setOpenReq(false); onChange && onChange()
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }
  const activate = async (card, method) => {
    setLoading(true)
    try {
      const body = method === 'wallet' ? { pay_from_wallet: true } : { tx_hash: 'DEMO' + Date.now(), network: actNetwork }
      await api.post(`/cards/${card.id}/activate`, body)
      toast.success('Card activated ⚡')
      setOpenAct(null); onChange && onChange(); onWalletChange && onWalletChange()
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }
  const freeze = async (card, frozen) => {
    try {
      await api.post(`/cards/${card.id}/freeze`, { frozen })
      toast.success(frozen ? 'Card frozen' : 'Card unfrozen'); onChange && onChange()
    } catch(e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-2xl">Aurela Cards</div>
          <div className="text-sm text-muted-foreground">Basic · Premium · Elite. Activate on-chain with USDT (ERC20).</div>
        </div>
        <Button onClick={() => setOpenReq(true)} className="gold-btn rounded-full"><Plus className="h-4 w-4 mr-2"/> Request new card</Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards.length === 0 && (
          <div className="col-span-full card-luxury rounded-2xl p-10 text-center">
            <CreditCard className="h-10 w-10 text-gold mx-auto"/>
            <div className="font-display text-xl mt-4">No cards yet</div>
            <div className="text-sm text-muted-foreground mt-1">Request your first Aurela card.</div>
            <Button onClick={() => setOpenReq(true)} className="gold-btn mt-4 rounded-full">Request a card</Button>
          </div>
        )}
        {cards.map(c => (
          <div key={c.id} className="card-luxury rounded-2xl p-6">
            <div className={`credit-card ${c.tier} rounded-2xl p-5 aspect-[16/10] relative overflow-hidden`}>
              <div className="flex items-center justify-between">
                <AurelaLogo size={24} glow={false}/>
                <div className="text-[10px] uppercase tracking-widest text-gold">{c.tier_name}</div>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-6 w-8 rounded-md bg-gradient-to-br from-gold-300 to-gold-800"/>
                <div className="text-[10px] uppercase text-muted-foreground">WORLD</div>
              </div>
              <div className="font-mono text-lg mt-3 tracking-widest text-gold-bright">{c.number}</div>
              <div className="flex justify-between items-end mt-4 text-xs">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Holder</div>
                  <div>{c.holder}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground">Exp</div>
                  <div className="font-mono">{c.expiry}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground">CVV</div>
                  <div className="font-mono flex items-center gap-1">
                    {showCvv[c.id] ? c.cvv : '•••'}
                    <button onClick={() => setShowCvv({ ...showCvv, [c.id]: !showCvv[c.id] })}>{showCvv[c.id] ? <EyeOff className="h-3 w-3"/> : <Eye className="h-3 w-3"/>}</button>
                  </div>
                </div>
              </div>
              {c.frozen && <div className="absolute inset-0 bg-onyx-900/60 backdrop-blur-sm flex items-center justify-center"><Snowflake className="h-10 w-10 text-gold"/></div>}
            </div>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`${c.status==='active'?'border-gold-500 text-gold':'border-muted text-muted-foreground'}`}>{c.status.replace('_',' ')}</Badge>
              <Badge variant="outline" className="border-gold-500/30 text-muted-foreground text-[10px]">Daily spend {c.daily_spend_limit.toLocaleString()}</Badge>
            </div>
            <div className="mt-4 flex gap-2">
              {c.status === 'pending_activation' && (
                <Button onClick={() => setOpenAct(c)} className="gold-btn flex-1 rounded-full"><Sparkles className="h-4 w-4 mr-2"/> Activate</Button>
              )}
              {c.status === 'active' && (
                <Button onClick={() => freeze(c, !c.frozen)} variant="outline" className="flex-1 rounded-full border-gold-500/40">
                  {c.frozen ? <><Flame className="h-4 w-4 mr-2"/> Unfreeze</> : <><Snowflake className="h-4 w-4 mr-2"/> Freeze</>}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Request dialog */}
      <Dialog open={openReq} onOpenChange={setOpenReq}>
        <DialogContent className="bg-onyx-900 border-gold-500/20">
          <DialogHeader><DialogTitle className="font-display">Choose your Aurela card</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {['basic','premium','elite'].map(t => {
              const fee = config?.activation_fees?.[t]
              return (
                <button key={t} onClick={() => setTier(t)} className={`w-full text-left card-luxury rounded-xl p-4 ${tier===t?'ring-1 ring-gold-500':''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display text-lg capitalize">Aurela {t}</div>
                      <div className="text-xs text-muted-foreground">Activation fee: {fee} USDT</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gold"/>
                  </div>
                </button>
              )
            })}
          </div>
          <DialogFooter>
            <Button onClick={request} disabled={loading} className="gold-btn w-full">Issue card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate dialog */}
      <Dialog open={!!openAct} onOpenChange={v => !v && setOpenAct(null)}>
        <DialogContent className="bg-onyx-900 border-gold-500/20">
          <DialogHeader><DialogTitle className="font-display">Activate your card</DialogTitle></DialogHeader>
          {openAct && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Pay <span className="text-gold">{openAct.activation_fee_usdt} USDT</span> to activate. Choose your preferred network.</div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">USDT network</Label>
                <Select value={actNetwork} onValueChange={setActNetwork}>
                  <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {usdtWallets.map(p => <SelectItem key={p.id} value={p.network}>{p.network}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {activeActWallet && (
                <div className="p-3 rounded-lg bg-secondary">
                  <div className="text-[10px] uppercase text-muted-foreground">Aurela Treasury · {activeActWallet.network}</div>
                  <div className="font-mono text-gold text-sm break-all mt-1">{activeActWallet.address}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => activate(openAct, 'wallet')} disabled={loading} className="gold-btn">Pay from USDT balance</Button>
                <Button onClick={() => activate(openAct, 'tx')} disabled={loading} variant="outline" className="border-gold-500/40">I sent USDT (verify)</Button>
              </div>
              <div className="text-xs text-muted-foreground">The verify button simulates on-chain confirmation for the demo. Real deposits are credited by administration after network confirmation.</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DepositTab({ wallets, onDone }) {
  const { api, config } = useApp()
  const [form, setForm] = useState({ method: 'bank', currency: 'USD', amount: '', network: '' })
  const [loading, setLoading] = useState(false)
  const isCrypto = wallets.find(w => w.currency === form.currency)?.type === 'crypto'
  const cryptoWallet = wallets.find(w => w.type === 'crypto' && w.currency === form.currency)
  const platformWallets = (config?.platform_wallets || []).filter(p => p.asset === form.currency)
  const activePlatformWallet = form.network ? platformWallets.find(p => p.network === form.network) : platformWallets[0]

  const submit = async () => {
    setLoading(true)
    try {
      await api.post('/deposit', { method: isCrypto ? 'crypto' : form.method, currency: form.currency, amount: Number(form.amount) })
      toast.success('Deposit received')
      onDone && onDone()
      setForm({ ...form, amount: '' })
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Deposit funds</div>
        <div className="text-sm text-muted-foreground">Bank, UPI, card or crypto. Fiat is instant for the demo. Crypto deposits use Aurela treasury addresses.</div>
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v, network: '' })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Fiat</div>
                  {Object.keys(FIAT_META).map(c => <SelectItem key={c} value={c}>{FIAT_META[c].flag} {c}</SelectItem>)}
                  <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>
                  {Object.keys(CRYPTO_META).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Method</Label>
              <Select value={form.method} onValueChange={v => setForm({ ...form, method: v })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {isCrypto ? (
                    <SelectItem value="crypto">On-chain</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="stripe">Stripe (card)</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="debit">Debit card</SelectItem>
                      <SelectItem value="credit">Credit card</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Amount</Label>
            <Input type="number" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <Button onClick={submit} disabled={loading || !form.amount} className="gold-btn w-full h-12 rounded-xl">{loading?'Processing…':'Confirm deposit'}</Button>
          {isCrypto && <div className="text-xs text-muted-foreground">For crypto, send from your external wallet to the address on the right. This form records the deposit against your account after admin credits it.</div>}
        </div>
      </div>

      {isCrypto && (
        <div className="card-luxury rounded-2xl p-6">
          <div className="font-display text-xl">Aurela receive address</div>
          <div className="text-sm text-muted-foreground">Send {form.currency} to the address below on the selected network. Only send on the exact network shown to avoid loss of funds.</div>
          {platformWallets.length > 1 && (
            <div className="mt-4">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Network</Label>
              <Select value={form.network || platformWallets[0].network} onValueChange={v => setForm({ ...form, network: v })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {platformWallets.map(p => <SelectItem key={p.id} value={p.network}>{p.network}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {activePlatformWallet ? (
            <div className="mt-4 p-4 rounded-lg bg-secondary">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase text-muted-foreground">{form.currency} · {activePlatformWallet.network}</div>
                <Badge variant="outline" className="border-gold-500/40 text-gold">{activePlatformWallet.network}</Badge>
              </div>
              <div className="font-mono text-gold text-sm break-all mt-2">{activePlatformWallet.address}</div>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(activePlatformWallet.address); toast.success('Address copied') }} className="mt-4 w-full border-gold-500/40"><Copy className="h-4 w-4 mr-2"/> Copy address</Button>
            </div>
          ) : (
            <div className="mt-4 p-4 rounded-lg bg-secondary text-sm text-muted-foreground">No {form.currency} deposit address configured. Please contact support.</div>
          )}
        </div>
      )}
    </div>
  )
}

function WithdrawTab({ wallets, onDone }) {
  const { api } = useApp()
  const [form, setForm] = useState({ method: 'bank', currency: 'USD', amount: '', destination: '' })
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState([])
  const wallet = wallets.find(w => w.currency === form.currency)
  const isCrypto = wallet?.type === 'crypto'
  const hasActiveCard = cards.some(c => c.status === 'active' && !c.frozen)

  useEffect(() => { api.get('/cards').then(({cards}) => setCards(cards)).catch(()=>{}) }, [])

  const submit = async () => {
    setLoading(true)
    try {
      await api.post('/withdraw', { method: isCrypto?'crypto':form.method, currency: form.currency, amount: Number(form.amount), destination: form.destination })
      toast.success('Withdrawal submitted')
      onDone && onDone()
      setForm({ ...form, amount: '', destination: '' })
    } catch(e) {
      if (e.message && e.message.toLowerCase().includes('card activation required')) {
        toast.error('Activate an Aurela card to withdraw externally')
      } else {
        toast.error(e.message)
      }
    } finally { setLoading(false) }
  }

  if (!hasActiveCard) {
    return (
      <div className="card-luxury rounded-2xl p-8 max-w-2xl">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-gold-500/25 to-gold-800/10 border border-gold-500/40">
            <CreditCard className="h-6 w-6 text-gold-bright"/>
          </div>
          <div className="flex-1">
            <div className="font-display text-2xl">Activate a card to withdraw externally</div>
            <p className="text-sm text-muted-foreground mt-2">External withdrawals — to bank accounts, UPI or crypto wallets outside Aurela — require an active Aurela card. This protects our network and ensures every outbound payment is bound to a verified spending profile.</p>
            <p className="text-sm text-muted-foreground mt-3">You can still send fiat and crypto to any Aurela member instantly and for free from the <span className="text-gold">Send</span> tab, using their email or username.</p>
            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              <Button className="gold-btn rounded-full" onClick={() => window.dispatchEvent(new CustomEvent('aurela:goto-cards'))}>Activate a card</Button>
              <Button variant="outline" className="rounded-full border-gold-500/40" onClick={() => window.dispatchEvent(new CustomEvent('aurela:goto-transfer'))}>Send internally instead</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card-luxury rounded-2xl p-6 max-w-2xl">
      <div className="font-display text-2xl">Withdraw funds</div>
      <div className="text-sm text-muted-foreground">Send fiat to bank/UPI or crypto to an external wallet.</div>
      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Currency</Label>
            <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
              <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
              <SelectContent className="max-h-64">
                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Fiat</div>
                {Object.keys(FIAT_META).map(c => <SelectItem key={c} value={c}>{FIAT_META[c].flag} {c}</SelectItem>)}
                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>
                {Object.keys(CRYPTO_META).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {wallet && <div className="text-xs text-muted-foreground mt-1">Available: {fmt(wallet.balance, wallet.currency)}</div>}
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Amount</Label>
            <Input type="number" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
        </div>
        {isCrypto ? (
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">External wallet address</Label>
            <Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="0x... / bc1... / T..." className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
        ) : (
          <>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Method</Label>
              <Select value={form.method} onValueChange={v => setForm({ ...form, method: v })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Account</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Destination (account / UPI id)</Label>
              <Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
            </div>
          </>
        )}
        <Button onClick={submit} disabled={loading || !form.amount} className="gold-btn w-full h-12 rounded-xl">{loading?'Processing…':'Withdraw'}</Button>
      </div>
    </div>
  )
}

export function TxTable({ txs, me }) {
  if (!txs || !txs.length) return <div className="text-sm text-muted-foreground text-center py-6">No activity yet.</div>
  return (
    <div className="divide-y divide-gold-500/10">
      {txs.map(t => {
        const outgoing = t.from_user_id === me?.id || t.type === 'withdraw' || (t.type === 'admin_adjustment' && t.amount < 0)
        const other = outgoing ? (t.to_username || t.method || 'external') : (t.from_username || t.method || 'external')
        return (
          <div key={t.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center ${outgoing ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {outgoing ? <ArrowUpRight className="h-4 w-4"/> : <ArrowDownRight className="h-4 w-4"/>}
              </div>
              <div>
                <div className="text-sm capitalize">{t.type.replace('_',' ')} · {other}</div>
                <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div className={`font-mono text-sm ${outgoing ? 'text-red-400' : 'text-emerald-400'}`}>{outgoing?'-':'+'}{fmt(Math.abs(t.amount), t.currency)}</div>
          </div>
        )
      })}
    </div>
  )
}

function TransactionsTab({ txs }) {
  const { user } = useApp()
  return (
    <div className="card-luxury rounded-2xl p-6">
      <div className="font-display text-2xl mb-4">All activity</div>
      <TxTable txs={txs} me={user}/>
    </div>
  )
}

function KycTab({ user, onDone }) {
  const { api } = useApp()
  const [form, setForm] = useState({ full_name: user?.full_name || '', dob: '', country: '', address: '', id_type: 'passport', id_number: '' })
  const [loading, setLoading] = useState(false)
  const status = user?.kyc_status || 'unverified'

  const submit = async () => {
    setLoading(true)
    try { await api.post('/kyc', form); toast.success('KYC submitted for review'); onDone && onDone() } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const statusBadge = {
    unverified: <Badge variant="outline" className="border-muted text-muted-foreground">Unverified</Badge>,
    pending: <Badge variant="outline" className="border-gold-500/50 text-gold">Pending review</Badge>,
    approved: <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">Approved</Badge>,
    rejected: <Badge variant="outline" className="border-red-500/50 text-red-400">Rejected</Badge>,
  }[status]

  return (
    <div className="card-luxury rounded-2xl p-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-2xl">Identity verification</div>
          <div className="text-sm text-muted-foreground">Required for withdrawals and higher card tiers.</div>
        </div>
        {statusBadge}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Full legal name</Label>
          <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Date of birth</Label>
          <Input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Country</Label>
          <Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Address</Label>
          <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">ID type</Label>
          <Select value={form.id_type} onValueChange={v => setForm({ ...form, id_type: v })}>
            <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="passport">Passport</SelectItem>
              <SelectItem value="national_id">National ID</SelectItem>
              <SelectItem value="drivers_license">Driver&apos;s license</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">ID number</Label>
          <Input value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
      </div>

      <Button onClick={submit} disabled={loading || status === 'approved'} className="gold-btn mt-6 h-12 rounded-xl px-8">
        {status === 'approved' ? 'Verified' : (loading ? 'Submitting…' : 'Submit for review')}
      </Button>
    </div>
  )
}

function ProfileTab({ user, onDone }) {
  const { api } = useApp()
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '' })
  const [loading, setLoading] = useState(false)
  const [twofa, setTwofa] = useState(null) // { secret, uri, qr_svg }
  const [twofaCode, setTwofaCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [qr, setQr] = useState(null)

  useEffect(() => {
    api.get('/profile/qr').then(setQr).catch(()=>{})
  }, [])

  const save = async () => {
    setLoading(true)
    try { await api.put('/profile', form); toast.success('Profile updated'); onDone && onDone() } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }
  const setup2fa = async () => {
    try { const res = await api.post('/profile/2fa/setup', {}); setTwofa(res) } catch(e) { toast.error(e.message) }
  }
  const enable2fa = async () => {
    try {
      await api.post('/profile/2fa/enable', { code: twofaCode })
      toast.success('2FA enabled')
      setTwofa(null); setTwofaCode(''); onDone && onDone()
    } catch(e) { toast.error(e.message) }
  }
  const disable2fa = async () => {
    try {
      await api.post('/profile/2fa/disable', { code: disableCode })
      toast.success('2FA disabled')
      setDisableCode(''); onDone && onDone()
    } catch(e) { toast.error(e.message) }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 max-w-6xl">
      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Your profile</div>
        <div className="text-sm text-muted-foreground">Public identity across the Aurela network.</div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Username</Label>
            <Input value={user?.username || ''} disabled className="mt-2 bg-secondary border-gold-500/20 h-11 opacity-60"/>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
            <Input value={user?.email || ''} disabled className="mt-2 bg-secondary border-gold-500/20 h-11 opacity-60"/>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Full name</Label>
            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
        </div>
        <Button onClick={save} disabled={loading} className="gold-btn mt-6 rounded-xl px-8 h-12">Save changes</Button>
      </div>

      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Receive by QR</div>
        <div className="text-sm text-muted-foreground">Others can scan this QR to send you fiat or crypto instantly.</div>
        <div className="mt-4 flex items-start gap-6">
          <div className="p-4 rounded-xl bg-onyx-950 border border-gold-500/20 shrink-0">
            {qr ? <div dangerouslySetInnerHTML={{ __html: qr.qr_svg }} /> : <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-muted-foreground">Loading QR…</div>}
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Username</div>
            <div className="font-mono text-gold text-lg">@{user?.username}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-4">Email</div>
            <div className="font-mono text-gold-bright text-sm break-all">{user?.email}</div>
            {qr && (
              <>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-4">Aurela link</div>
                <div className="font-mono text-[11px] text-muted-foreground break-all">{qr.payload}</div>
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(qr.payload); toast.success('Link copied') }} className="mt-3 border-gold-500/40 rounded-full"><Copy className="h-3.5 w-3.5 mr-1.5"/> Copy link</Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card-luxury rounded-2xl p-6 lg:col-span-2">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="font-display text-2xl">Two-factor authentication</div>
            <div className="text-sm text-muted-foreground">Extra security using an authenticator app (Google Authenticator, Authy, 1Password, etc.)</div>
          </div>
          <Badge variant="outline" className={user?.two_fa_enabled ? 'border-emerald-500/50 text-emerald-400' : 'border-muted text-muted-foreground'}>
            {user?.two_fa_enabled ? '2FA enabled' : '2FA disabled'}
          </Badge>
        </div>

        {!user?.two_fa_enabled && !twofa && (
          <Button onClick={setup2fa} className="gold-btn mt-4 rounded-full"><ShieldCheck className="h-4 w-4 mr-2"/> Set up 2FA</Button>
        )}
        {twofa && (
          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-3">1. Scan this QR with your authenticator app.</div>
              <div className="p-4 rounded-xl bg-onyx-950 border border-gold-500/20 inline-block">
                <div dangerouslySetInnerHTML={{ __html: twofa.qr_svg }} />
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-3">Or enter manually</div>
              <div className="font-mono text-gold text-sm break-all">{twofa.secret}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-3">2. Enter the 6-digit code shown in your app.</div>
              <Input value={twofaCode} onChange={e => setTwofaCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••" className="bg-secondary border-gold-500/20 h-14 text-center text-2xl font-mono tracking-[0.6em] text-gold-bright"/>
              <Button onClick={enable2fa} disabled={twofaCode.length !== 6} className="gold-btn mt-4 w-full h-12 rounded-xl">Enable 2FA</Button>
              <Button variant="ghost" onClick={() => setTwofa(null)} className="mt-2 w-full text-muted-foreground">Cancel</Button>
            </div>
          </div>
        )}
        {user?.two_fa_enabled && (
          <div className="mt-4 flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Code from app (to disable)</Label>
              <Input value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••" className="mt-2 bg-secondary border-gold-500/20 h-11 font-mono tracking-widest"/>
            </div>
            <Button onClick={disable2fa} disabled={disableCode.length !== 6} variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10">Disable 2FA</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ChainTab() {
  const { api } = useApp()
  const [scope, setScope] = useState('mine') // mine | all
  const [blocks, setBlocks] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      if (scope === 'mine') {
        const { blocks } = await api.get('/chain/mine')
        setBlocks(blocks); setTotal(blocks.length)
      } else {
        const { blocks, total } = await api.get('/chain?limit=100')
        setBlocks(blocks); setTotal(total)
      }
    } catch(e) {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [scope])

  return (
    <div className="space-y-6">
      <div className="card-luxury rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(400px 200px at 100% 0%, rgba(212,175,55,0.25), transparent 70%)' }}/>
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">Aurela Chain</div>
            <div className="font-display text-3xl mt-1">Our own hash-linked ledger.</div>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Every internal money movement inside Aurela is written to an append-only ledger. Each block is cryptographically linked to the previous one via SHA-256 — making every transaction verifiable, tamper-evident and permanently recorded.</p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Blocks</div>
              <div className="font-display text-3xl gold-text">{total.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="relative flex gap-2 mt-6">
          <Button onClick={() => setScope('mine')} className={scope==='mine' ? 'gold-btn rounded-full' : 'rounded-full'} variant={scope==='mine'?'default':'outline'}>My blocks</Button>
          <Button onClick={() => setScope('all')} className={scope==='all' ? 'gold-btn rounded-full' : 'rounded-full border-gold-500/40'} variant={scope==='all'?'default':'outline'}>Network explorer</Button>
        </div>
      </div>

      <div className="card-luxury rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gold-500/5 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Block</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">From → To</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Network</th>
              <th className="px-4 py-3 text-left">Hash</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-500/10">
            {loading && <tr><td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">Loading blocks…</td></tr>}
            {!loading && blocks.length === 0 && (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">No blocks yet. Send an internal transfer or activate a card to create your first block.</td></tr>
            )}
            {blocks.map(b => (
              <tr key={b.id} className="hover:bg-gold-500/5">
                <td className="px-4 py-3 font-mono text-gold-bright">#{b.block_number}</td>
                <td className="px-4 py-3 text-xs capitalize">{(b.type || '').replace('_',' ')}</td>
                <td className="px-4 py-3 text-xs">
                  <div>{b.from_username || '—'}</div>
                  <div className="text-muted-foreground">→ {b.to_username || b.destination || '—'}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono">{fmt(b.amount, b.currency)}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={b.network === 'AURELA' ? 'border-gold-500 text-gold' : 'border-muted text-muted-foreground'}>{b.network}</Badge>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { navigator.clipboard.writeText(b.hash); toast.success('Hash copied') }} className="font-mono text-[11px] text-gold hover:underline">
                    {b.hash.slice(0, 10)}…{b.hash.slice(-6)}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(b.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

