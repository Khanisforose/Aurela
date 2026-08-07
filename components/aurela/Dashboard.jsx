'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useApp, FIAT_META, CRYPTO_META, fmt, KYC_DOCS_BY_COUNTRY, KYC_COUNTRIES, FIAT_METHODS } from './store'
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
  ChevronRight, TrendingUp, ArrowUpRight, ArrowDownRight, Plus, Search, Link2, Blocks,
  Users, Settings, ScrollText, ChevronDown, Bell, Edit3, Trash2, Timer, Snowflake as SnowIcon, Menu, X, ExternalLink
} from 'lucide-react'
import { AdminOverview, UsersAdmin, KycAdmin, TxAdmin, SettingsAdmin, AuditAdmin, PlatformWalletsAdmin, DepositsAdmin, CardApprovalsAdmin, WithdrawalsAdmin } from './AdminPanel'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const USER_NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'fiat', label: 'Fiat Wallets', icon: Wallet },
  { id: 'crypto', label: 'Crypto Wallets', icon: Bitcoin },
  { id: 'transfer', label: 'Send', icon: Send },
  { id: 'cards', label: 'Cards', icon: CreditCard },
  { id: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
  { id: 'withdraw', label: 'Withdraw', icon: ArrowUpFromLine },
  { id: 'transactions', label: 'Activity', icon: Receipt },
  { id: 'chain', label: 'Aurela Chain', icon: Blocks },
]
const ADMIN_NAV = [
  { id: 'admin_overview', label: 'Admin Overview', icon: LayoutDashboard },
  { id: 'admin_users', label: 'Users', icon: Users },
  { id: 'admin_kyc', label: 'KYC Review', icon: ShieldCheck },
  { id: 'admin_deposits', label: 'Deposit Requests', icon: ArrowDownToLine },
  { id: 'admin_withdrawals', label: 'Withdraw Requests', icon: ArrowUpFromLine },
  { id: 'admin_card_approvals', label: 'Card Approvals', icon: CreditCard },
  { id: 'admin_tx', label: 'All Transactions', icon: Receipt },
  { id: 'admin_wallets', label: 'Platform Wallets', icon: Wallet },
  { id: 'admin_settings', label: 'Platform Settings', icon: Settings },
  { id: 'admin_audit', label: 'Audit Log', icon: ScrollText },
]

export function Dashboard() {
  const { user, logout, api, refreshUser, tick } = useApp()
  const [tab, setTab] = useState('overview')
  const [wallets, setWallets] = useState([])
  const [totals, setTotals] = useState({ usd: 0, preferred: 0, preferred_currency: 'USD' })
  const [txs, setTxs] = useState([])
  const [cards, setCards] = useState([])
  const [notif, setNotif] = useState({ total: 0, counts: {}, items: [] })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const NAV = isAdmin ? [...USER_NAV, ...ADMIN_NAV] : USER_NAV

  // Close mobile nav after selecting a tab
  const goTab = useCallback((id) => { setTab(id); setMobileNavOpen(false) }, [])

  const loadWallets = async () => {
    try { const { wallets, totals } = await api.get('/wallets'); setWallets(wallets); setTotals(totals) } catch(e) {}
  }
  const loadTxs = async () => {
    try { const { transactions } = await api.get('/transactions'); setTxs(transactions) } catch(e) {}
  }
  const loadCards = async () => {
    try { const { cards } = await api.get('/cards'); setCards(cards) } catch(e) {}
  }
  const loadNotif = async () => {
    if (!isAdmin) return
    try { const n = await api.get('/admin/notifications'); setNotif(n) } catch(e) {}
  }
  const loadAll = async () => { await Promise.all([loadWallets(), loadTxs(), loadCards(), loadNotif()]) }

  useEffect(() => { loadAll() }, [])
  // Auto-refresh every 5s (driven by store `tick`)
  useEffect(() => {
    if (!user) return
    loadWallets(); loadTxs(); loadCards(); loadNotif()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  // Global navigation via custom events (used from KycGate, WithdrawTab card gate, etc.)
  useEffect(() => {
    const go = (id) => () => setTab(id)
    const kyc = go('kyc'), cards = go('cards'), transfer = go('transfer')
    const goTab = (e) => { if (e.detail) setTab(e.detail) }
    window.addEventListener('aurela:goto-kyc', kyc)
    window.addEventListener('aurela:goto-cards', cards)
    window.addEventListener('aurela:goto-transfer', transfer)
    window.addEventListener('aurela:go-tab', goTab)
    return () => {
      window.removeEventListener('aurela:goto-kyc', kyc)
      window.removeEventListener('aurela:goto-cards', cards)
      window.removeEventListener('aurela:goto-transfer', transfer)
      window.removeEventListener('aurela:go-tab', goTab)
    }
  }, [])

  const fiatWallets = wallets.filter(w => w.type === 'fiat')
  const cryptoWallets = wallets.filter(w => w.type === 'crypto')

  return (
    <div className="min-h-screen bg-onyx-radial">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-gold-500/10 bg-onyx-900/60 backdrop-blur-xl p-6 hidden lg:flex flex-col">
        <AurelaWordmark />
        <div className="mt-8 space-y-1 flex-1 overflow-y-auto">
          {USER_NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${tab === n.id ? 'gold-btn' : 'text-muted-foreground hover:text-gold hover:bg-gold-500/5'}`}>
              <n.icon className="h-4 w-4"/> {n.label}
            </button>
          ))}
          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-widest text-gold">Administration</div>
              {ADMIN_NAV.map(n => (
                <button key={n.id} onClick={() => setTab(n.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${tab === n.id ? 'gold-btn' : 'text-muted-foreground hover:text-gold hover:bg-gold-500/5'}`}>
                  <n.icon className="h-4 w-4"/> {n.label}
                </button>
              ))}
            </>
          )}
        </div>
        <Button variant="ghost" onClick={logout} className="justify-start text-muted-foreground hover:text-gold">
          <LogOut className="h-4 w-4 mr-2"/> Sign out
        </Button>
      </aside>

      <main className="lg:ml-64 min-h-screen">
        {/* Mobile slide-in nav drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileNavOpen(false)}>
            <div className="absolute inset-0 bg-onyx-950/85 backdrop-blur-sm"/>
            <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-onyx-900 border-r border-gold-500/20 p-5 flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <AurelaWordmark />
                <button onClick={() => setMobileNavOpen(false)} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-gold"><X className="h-4 w-4"/></button>
              </div>
              <div className="mt-6 space-y-1 flex-1">
                {USER_NAV.map(n => (
                  <button key={n.id} onClick={() => goTab(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${tab === n.id ? 'gold-btn' : 'text-muted-foreground hover:text-gold hover:bg-gold-500/5'}`}>
                    <n.icon className="h-4 w-4"/> {n.label}
                  </button>
                ))}
                {isAdmin && (
                  <>
                    <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-widest text-gold">Administration</div>
                    {ADMIN_NAV.map(n => (
                      <button key={n.id} onClick={() => goTab(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${tab === n.id ? 'gold-btn' : 'text-muted-foreground hover:text-gold hover:bg-gold-500/5'}`}>
                        <n.icon className="h-4 w-4"/> {n.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <Button variant="outline" onClick={logout} className="mt-4 border-red-500/40 text-red-400 hover:bg-red-500/10 justify-start">
                <LogOut className="h-4 w-4 mr-2"/> Sign out
              </Button>
            </aside>
          </div>
        )}
        {/* Topbar */}
        <div className="sticky top-0 z-30 border-b border-gold-500/10 bg-onyx-900/70 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setMobileNavOpen(true)} className="lg:hidden h-10 w-10 rounded-full bg-secondary hover:bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0" aria-label="Open menu">
                <Menu className="h-4 w-4 text-gold"/>
              </button>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground truncate">{tab === 'overview' ? 'Welcome back' : NAV.find(n => n.id === tab)?.label}</div>
                <div className="font-display text-base sm:text-2xl truncate">{user?.full_name || user?.username}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <CurrencySwitcher onSaved={async () => { await refreshUser(); await loadWallets() }} />
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative h-10 w-10 rounded-full bg-secondary hover:bg-gold-500/10 border border-gold-500/20 flex items-center justify-center transition">
                      <Bell className="h-4 w-4 text-gold"/>
                      {notif.total > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {notif.total > 99 ? '99+' : notif.total}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 bg-onyx-900 border-gold-500/25">
                    <DropdownMenuLabel className="text-muted-foreground flex items-center justify-between">
                      <span className="text-foreground text-sm">Pending actions</span>
                      <span className="text-[10px] text-gold uppercase tracking-widest">{notif.total} open</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gold-500/15"/>
                    <div className="grid grid-cols-4 gap-1 p-2">
                      {[
                        { k: 'deposits', tab: 'admin_deposits', label: 'Deposits' },
                        { k: 'withdrawals', tab: 'admin_withdrawals', label: 'Withdraw' },
                        { k: 'cards', tab: 'admin_card_approvals', label: 'Cards' },
                        { k: 'kyc', tab: 'admin_kyc', label: 'KYC' },
                      ].map(x => (
                        <button key={x.k} onClick={() => setTab(x.tab)} className="rounded-lg bg-secondary/60 hover:bg-gold-500/10 p-2 text-center border border-gold-500/10">
                          <div className="text-lg font-display text-gold">{notif.counts?.[x.k] ?? 0}</div>
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{x.label}</div>
                        </button>
                      ))}
                    </div>
                    <DropdownMenuSeparator className="bg-gold-500/15"/>
                    <div className="max-h-64 overflow-y-auto">
                      {notif.items?.length === 0 && <div className="p-4 text-xs text-muted-foreground text-center">No pending requests 🎉</div>}
                      {notif.items?.map(it => {
                        const targetTab = it.kind === 'deposit' ? 'admin_deposits' : it.kind === 'withdraw' ? 'admin_withdrawals' : it.kind === 'card' ? 'admin_card_approvals' : 'admin_kyc'
                        return (
                          <DropdownMenuItem key={it.kind + it.id} onClick={() => setTab(targetTab)} className="cursor-pointer focus:bg-gold-500/10 focus:text-gold">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs truncate">{it.title}</div>
                              <div className="text-[10px] text-muted-foreground">{new Date(it.at).toLocaleString()}</div>
                            </div>
                          </DropdownMenuItem>
                        )
                      })}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 pr-2 pl-1 py-1 rounded-full bg-secondary hover:bg-gold-500/10 border border-gold-500/20 transition">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center text-onyx-900 font-bold">
                      {(user?.full_name || user?.username || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:block text-left pr-2">
                      <div className="text-xs text-muted-foreground leading-tight">@{user?.username}</div>
                      <div className="text-[10px] text-gold uppercase tracking-widest leading-tight">{isAdmin ? user?.role?.replace('_',' ') : 'Member'}</div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground"/>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-onyx-900 border-gold-500/25">
                  <DropdownMenuLabel className="text-muted-foreground">
                    <div className="text-sm text-foreground truncate">{user?.full_name || user?.username}</div>
                    <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gold-500/15"/>
                  <DropdownMenuItem onClick={() => setTab('profile')} className="cursor-pointer focus:bg-gold-500/10 focus:text-gold">
                    <User className="h-4 w-4 mr-2"/> Profile &amp; 2FA
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTab('kyc')} className="cursor-pointer focus:bg-gold-500/10 focus:text-gold">
                    <ShieldCheck className="h-4 w-4 mr-2"/> Identity verification
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTab('transactions')} className="cursor-pointer focus:bg-gold-500/10 focus:text-gold">
                    <Receipt className="h-4 w-4 mr-2"/> Activity
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator className="bg-gold-500/15"/>
                      <DropdownMenuItem onClick={() => setTab('admin_overview')} className="cursor-pointer focus:bg-gold-500/10 focus:text-gold">
                        <Sparkles className="h-4 w-4 mr-2"/> Admin console
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator className="bg-gold-500/15"/>
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300">
                    <LogOut className="h-4 w-4 mr-2"/> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Mobile quick-tabs (user nav only, admin uses drawer) */}
          {!isAdmin && (
            <div className="lg:hidden overflow-x-auto flex gap-2 px-4 sm:px-6 pb-3">
              {NAV.map(n => (
                <button key={n.id} onClick={() => setTab(n.id)} className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${tab === n.id ? 'gold-btn' : 'text-muted-foreground border border-gold-500/20'}`}>
                  {n.label}
                </button>
              ))}
            </div>
          )}
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
              {tab === 'admin_overview' && isAdmin && <AdminOverview/>}
              {tab === 'admin_users' && isAdmin && <UsersAdmin/>}
              {tab === 'admin_kyc' && isAdmin && <KycAdmin/>}
              {tab === 'admin_deposits' && isAdmin && <DepositsAdmin/>}
              {tab === 'admin_withdrawals' && isAdmin && <WithdrawalsAdmin/>}
              {tab === 'admin_card_approvals' && isAdmin && <CardApprovalsAdmin/>}
              {tab === 'admin_tx' && isAdmin && <TxAdmin/>}
              {tab === 'admin_wallets' && isAdmin && <PlatformWalletsAdmin/>}
              {tab === 'admin_settings' && isAdmin && <SettingsAdmin/>}
              {tab === 'admin_audit' && isAdmin && <AuditAdmin/>}
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

function timeUntil(ts) {
  if (!ts) return ''
  const diff = new Date(ts).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  const s = Math.floor((diff % 60_000) / 1000)
  return `${m}m ${s}s`
}
function ActivationCountdown({ usable_at }) {
  const [, setT] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setT(x => x + 1), 1000)
    return () => clearInterval(iv)
  }, [])
  return <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[10px]"><Timer className="h-3 w-3 mr-1"/>Unlocks in {timeUntil(usable_at)}</Badge>
}

function TransferTab({ wallets, onDone }) {
  const { api, user, config } = useApp()
  const enabledFiat = config?.enabled_fiat || Object.keys(FIAT_META)
  const enabledCrypto = config?.enabled_crypto || Object.keys(CRYPTO_META)
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
        <div className="text-sm text-muted-foreground">Send fiat or crypto by email, Aurela ID or wallet address — zero fees inside Aurela.</div>

        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Recipient</Label>
            <Input value={form.recipient} onChange={e => setForm({...form, recipient: e.target.value })} placeholder="email, Aurela ID (AUR…) or wallet ID" className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {enabledFiat.length > 0 && <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Fiat</div>}
                  {Object.keys(FIAT_META).filter(c => enabledFiat.includes(c)).map(c => <SelectItem key={c} value={c}>{FIAT_META[c].flag} {c}</SelectItem>)}
                  {enabledCrypto.length > 0 && <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>}
                  {Object.keys(CRYPTO_META).filter(c => enabledCrypto.includes(c)).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
          <div className="text-xs text-muted-foreground">Aurela ID</div>
          <div className="font-mono text-gold text-lg mt-1">{user?.user_code || '—'}</div>
          <div className="text-xs text-muted-foreground mt-3">Email</div>
          <div className="font-mono text-gold-bright text-sm mt-1">{user?.email}</div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">Share your username or email with anyone on Aurela to receive instant zero-fee transfers.</div>
      </div>
    </div>
  )
}

function CardsTab({ cards, onChange, onWalletChange }) {
  const { api, user, config } = useApp()
  const [openReq, setOpenReq] = useState(false)
  const [openAct, setOpenAct] = useState(null)
  const [tier, setTier] = useState('basic')
  const [actNetwork, setActNetwork] = useState('TRC20')
  const [actTxHash, setActTxHash] = useState('')
  const [showCvv, setShowCvv] = useState({})
  const [loading, setLoading] = useState(false)
  const kycOK = user?.kyc_status === 'approved'

  const usdtWallets = (config?.platform_wallets || []).filter(p => p.asset === 'USDT')
  const activeActWallet = usdtWallets.find(p => p.network === actNetwork) || usdtWallets[0]

  const request = async () => {
    if (!kycOK) return toast.error('Complete identity verification (KYC) first')
    setLoading(true)
    try {
      await api.post('/cards/request', { tier })
      toast.success('Card issued — activate to use')
      setOpenReq(false); onChange && onChange()
    } catch(e) {
      if (e.message.includes('verification')) toast.error(e.message)
      else toast.error(e.message)
    } finally { setLoading(false) }
  }
  const activate = async (card) => {
    if (!actTxHash || actTxHash.length < 8) return toast.error('Paste a valid on-chain USDT transaction hash')
    setLoading(true)
    try {
      await api.post(`/cards/${card.id}/activate`, { tx_hash: actTxHash.trim(), network: actNetwork })
      toast.success('Activation submitted — waiting for admin verification')
      setOpenAct(null); setActTxHash(''); onChange && onChange()
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }
  const freeze = async (card, frozen) => {
    try {
      await api.post(`/cards/${card.id}/freeze`, { frozen })
      toast.success(frozen ? 'Card frozen' : 'Card unfrozen'); onChange && onChange()
    } catch(e) { toast.error(e.message) }
  }
  const deleteCard = async (card) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete this ${card.tier_name}? You will have to re-apply and repay the activation fee to get a new card.`)) return
    setLoading(true)
    try {
      await api.del(`/cards/${card.id}`)
      toast.success('Card deleted')
      onChange && onChange()
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
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
              <Badge variant="outline" className={`${c.status==='active'?'border-gold-500 text-gold':c.status==='activating'?'border-blue-500/50 text-blue-400':c.status==='pending_verification'?'border-gold-500/40 text-gold':c.status==='rejected'?'border-red-500/40 text-red-400':'border-muted text-muted-foreground'}`}>{c.status.replace('_',' ')}</Badge>
              <Badge variant="outline" className="border-gold-500/30 text-muted-foreground text-[10px]">Monthly spend ${c.monthly_spend_limit.toLocaleString()}</Badge>
              {c.status === 'activating' && c.usable_at && <ActivationCountdown usable_at={c.usable_at}/>}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              {c.status === 'pending_activation' && (
                <Button onClick={() => setOpenAct(c)} className="gold-btn flex-1 rounded-full"><Sparkles className="h-4 w-4 mr-2"/> Activate</Button>
              )}
              {c.status === 'pending_verification' && (
                <div className="flex-1 text-xs text-muted-foreground">⏳ Waiting for admin to verify your USDT transfer…</div>
              )}
              {c.status === 'activating' && (
                <div className="flex-1 text-xs text-muted-foreground">🎉 Approved! Your card unlocks in {timeUntil(c.usable_at)}.</div>
              )}
              {c.status === 'active' && (
                <Button onClick={() => freeze(c, !c.frozen)} variant="outline" className="rounded-full border-gold-500/40">
                  {c.frozen ? <><Flame className="h-4 w-4 mr-2"/> Unfreeze</> : <><Snowflake className="h-4 w-4 mr-2"/> Freeze</>}
                </Button>
              )}
              {c.status !== 'pending_verification' && (
                <Button onClick={() => deleteCard(c)} variant="outline" className="rounded-full border-red-500/40 text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4 mr-2"/> Delete
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

      <Dialog open={!!openAct} onOpenChange={v => !v && setOpenAct(null)}>
        <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Activate your card</DialogTitle></DialogHeader>
          {openAct && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Send exactly <span className="text-gold font-semibold">{openAct.activation_fee_usdt} USDT</span> from your external wallet to the Aurela treasury address below, then paste the transaction hash for verification.</div>
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
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase text-muted-foreground">Aurela Treasury · {activeActWallet.network}</div>
                    <button onClick={() => { navigator.clipboard.writeText(activeActWallet.address); toast.success('Copied') }} className="text-muted-foreground hover:text-gold"><Copy className="h-3.5 w-3.5"/></button>
                  </div>
                  <div className="font-mono text-gold text-sm break-all mt-1">{activeActWallet.address}</div>
                </div>
              )}
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Transaction hash</Label>
                <Input value={actTxHash} onChange={e => setActTxHash(e.target.value)} placeholder="0x… or the on-chain tx hash" className="mt-2 bg-secondary border-gold-500/20 h-11 font-mono text-xs"/>
              </div>
              <Button onClick={() => activate(openAct)} disabled={loading || !actTxHash} className="gold-btn w-full h-12 rounded-xl">
                {loading ? 'Submitting…' : 'Submit for verification'}
              </Button>
              <div className="text-xs text-muted-foreground">Your card will activate after Aurela admins verify the on-chain transaction. Payments from your internal balance are not accepted — funds must arrive from an external wallet.</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KycGate({ children, action }) {
  const { user } = useApp()
  if (user?.kyc_status === 'approved') return children
  const status = user?.kyc_status || 'unverified'
  const msg = status === 'pending'
    ? 'Your identity verification is under review. This usually takes a few hours. You will be notified once it is approved.'
    : status === 'rejected'
      ? 'Your identity verification was rejected. Please review your submission and try again.'
      : 'To ' + action + ', please complete identity verification (KYC) first. This is required by our banking partners and takes only a few minutes.'
  return (
    <div className="card-luxury rounded-2xl p-6 sm:p-8 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-gold-500/25 to-gold-800/10 border border-gold-500/40 shrink-0">
          <ShieldCheck className="h-6 w-6 text-gold-bright"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-xl sm:text-2xl">Identity verification required</div>
          <p className="text-sm text-muted-foreground mt-2">{msg}</p>
          <div className="mt-6">
            <Button className="gold-btn rounded-full" onClick={() => window.dispatchEvent(new CustomEvent('aurela:goto-kyc'))}>
              {status === 'pending' ? 'View KYC status' : 'Start verification'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Small helper: render a method-specific set of Input fields
function MethodFields({ method, details, setDetails }) {
  const spec = FIAT_METHODS[method]
  if (!spec) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {spec.fields.map(f => (
        <div key={f.key} className={f.key === 'bank_address' ? 'sm:col-span-2' : ''}>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">{f.label}{f.required ? ' *' : ''}</Label>
          <Input value={details[f.key] || ''} onChange={e => setDetails({ ...details, [f.key]: e.target.value })} type={f.type === 'number' ? 'number' : 'text'} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
      ))}
    </div>
  )
}

function DepositTab({ wallets, onDone }) {
  const { api, user, config } = useApp()
  const enabledMethods = config?.enabled_deposit_methods || Object.keys(FIAT_METHODS)
  const enabledFiat = config?.enabled_fiat || Object.keys(FIAT_META)
  const enabledCrypto = config?.enabled_crypto || Object.keys(CRYPTO_META)
  const enabledFiatMethods = Object.entries(FIAT_METHODS).filter(([k]) => enabledMethods.includes(k))
  const cryptoEnabled = enabledMethods.includes('crypto')
  const firstFiat = enabledFiatMethods[0]?.[0] || 'bank_swift'
  const defaultCurrency = enabledFiat[0] || enabledCrypto[0] || 'USD'
  const [form, setForm] = useState({ method: firstFiat, currency: defaultCurrency, amount: '', network: '', note: '', tx_hash: '' })
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(false)
  const isCrypto = wallets.find(w => w.currency === form.currency)?.type === 'crypto'
  const platformWallets = (config?.platform_wallets || []).filter(p => p.asset === form.currency)
  const activePlatformWallet = form.network ? platformWallets.find(p => p.network === form.network) : platformWallets[0]

  // Auto-swap currency if the current selection got disabled
  useEffect(() => {
    if (FIAT_META[form.currency] && !enabledFiat.includes(form.currency)) {
      setForm(f => ({ ...f, currency: enabledFiat[0] || enabledCrypto[0] || 'USD' }))
    }
    if (CRYPTO_META[form.currency] && !enabledCrypto.includes(form.currency)) {
      setForm(f => ({ ...f, currency: enabledFiat[0] || enabledCrypto[0] || 'USD' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledFiat.join(','), enabledCrypto.join(',')])

  // Reset method when switching between fiat and crypto or when method list changes
  useEffect(() => {
    if (isCrypto) setForm(f => ({ ...f, method: 'crypto', network: '' }))
    else if (form.method === 'crypto' || !enabledMethods.includes(form.method)) {
      setForm(f => ({ ...f, method: enabledFiatMethods[0]?.[0] || 'bank_swift' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.currency, enabledMethods.join(',')])

  const submit = async () => {
    // If admin disabled this method entirely, hard block
    if (isCrypto && !cryptoEnabled) return toast.error('Crypto deposits are currently disabled by the platform.')
    // Validate required fields for the chosen method
    if (!isCrypto) {
      const spec = FIAT_METHODS[form.method]
      if (spec) {
        for (const f of spec.fields) {
          if (f.required && !details[f.key]) return toast.error(`Please fill "${f.label}"`)
        }
      }
    } else {
      if (!activePlatformWallet) return toast.error('No Aurela deposit address configured for this asset — please contact support.')
    }
    setLoading(true)
    try {
      await api.post('/deposit', {
        method: form.method,
        currency: form.currency, amount: Number(form.amount),
        note: form.note, tx_hash: form.tx_hash,
        network: activePlatformWallet?.network || form.network || '',
        details,
      })
      toast.success('Deposit request submitted — awaiting admin verification')
      onDone && onDone()
      setForm({ ...form, amount: '', note: '', tx_hash: '' })
      setDetails({})
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }

  if (user?.kyc_status !== 'approved') return <KycGate action="deposit funds"/>

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Deposit funds</div>
        <div className="text-sm text-muted-foreground">Bank, UPI, card or crypto. All deposits go through a short admin verification before being credited — this protects our network from fraud.</div>
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v, network: '' })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                <SelectContent className="max-h-72">
                  {enabledFiat.length > 0 && <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Fiat</div>}
                  {Object.keys(FIAT_META).filter(c => enabledFiat.includes(c)).map(c => <SelectItem key={c} value={c}>{FIAT_META[c].flag} {c}</SelectItem>)}
                  {cryptoEnabled && enabledCrypto.length > 0 && <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>}
                  {cryptoEnabled && Object.keys(CRYPTO_META).filter(c => enabledCrypto.includes(c)).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!isCrypto && (
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Payment method</Label>
                <Select value={form.method} onValueChange={v => { setForm({ ...form, method: v }); setDetails({}) }}>
                  <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {enabledFiatMethods.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">No fiat deposit methods enabled. Contact support.</div>}
                    {enabledFiatMethods.map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Amount</Label>
            <Input type="number" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          {!isCrypto && <MethodFields method={form.method} details={details} setDetails={setDetails}/>}
          {isCrypto && (
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Transaction hash (recommended)</Label>
              <Input value={form.tx_hash} onChange={e => setForm({ ...form, tx_hash: e.target.value })} placeholder="0x… on-chain tx hash" className="mt-2 bg-secondary border-gold-500/20 h-11 font-mono text-xs"/>
            </div>
          )}
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Note for admin (optional)</Label>
            <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder={isCrypto ? 'e.g. sent from Binance' : 'e.g. sender UTR / reference'} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <Button onClick={submit} disabled={loading || !form.amount} className="gold-btn w-full h-12 rounded-xl">{loading?'Processing…':'Submit deposit request'}</Button>
          <div className="text-xs text-muted-foreground">All deposits require manual admin verification. Once verified, funds will appear in your balance automatically.</div>
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
  const { api, user, config } = useApp()
  const enabledMethods = config?.enabled_withdrawal_methods || Object.keys(FIAT_METHODS)
  const enabledFiat = config?.enabled_fiat || Object.keys(FIAT_META)
  const enabledCrypto = config?.enabled_crypto || Object.keys(CRYPTO_META)
  const enabledFiatMethods = Object.entries(FIAT_METHODS).filter(([k]) => enabledMethods.includes(k))
  const cryptoEnabled = enabledMethods.includes('crypto')
  const firstFiat = enabledFiatMethods[0]?.[0] || 'bank_swift'
  const defaultCurrency = enabledFiat[0] || enabledCrypto[0] || 'USD'
  const [form, setForm] = useState({ method: firstFiat, currency: defaultCurrency, amount: '', destination: '', network: '' })
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState([])
  const wallet = wallets.find(w => w.currency === form.currency)
  const isCrypto = wallet?.type === 'crypto'
  const hasActiveCard = cards.some(c => c.status === 'active' && !c.frozen)
  const cryptoNetworks = (isCrypto && ({
    BTC:['Bitcoin'], ETH:['ERC20'], USDT:['ERC20','TRC20','BEP20'], USDC:['ERC20','BEP20','Polygon'],
    BNB:['BEP20'], SOL:['Solana'], XRP:['XRP'], ADA:['Cardano'], DOGE:['Dogecoin'], MATIC:['Polygon','ERC20'],
    AVAX:['Avalanche'], DOT:['Polkadot'], TRX:['TRC20'], LINK:['ERC20','BEP20'], LTC:['Litecoin'],
  }[form.currency] || ['External'])) || []

  useEffect(() => { api.get('/cards').then(({cards}) => setCards(cards)).catch(()=>{}) }, [])
  useEffect(() => {
    if (isCrypto) setForm(f => ({ ...f, method: 'crypto', network: cryptoNetworks[0] || '' }))
    else if (form.method === 'crypto' || !enabledMethods.includes(form.method)) {
      setForm(f => ({ ...f, method: enabledFiatMethods[0]?.[0] || 'bank_swift', network: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.currency, enabledMethods.join(',')])

  const submit = async () => {
    if (isCrypto && !cryptoEnabled) return toast.error('Crypto withdrawals are currently disabled by the platform.')
    if (!wallet || Number(form.amount) > wallet.balance) return toast.error('Insufficient balance')
    if (isCrypto) {
      if (!form.destination) return toast.error('Please enter the destination wallet address')
      if (!form.network) return toast.error('Please choose the network')
    } else {
      const spec = FIAT_METHODS[form.method]
      if (spec) {
        for (const f of spec.fields) {
          if (f.required && !details[f.key]) return toast.error(`Please fill "${f.label}"`)
        }
      }
    }
    setLoading(true)
    try {
      await api.post('/withdraw', {
        method: form.method, currency: form.currency, amount: Number(form.amount),
        destination: isCrypto ? form.destination : (details.account_number || details.upi_id || details.paypal_email || details.iban || details.card_last4 || ''),
        network: form.network, details,
      })
      toast.success('Withdrawal request submitted — funds locked until admin approval')
      onDone && onDone()
      setForm({ ...form, amount: '', destination: '' })
      setDetails({})
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }

  if (user?.kyc_status !== 'approved') return <KycGate action="withdraw funds"/>

  if (!hasActiveCard) {
    return (
      <div className="card-luxury rounded-2xl p-8 max-w-2xl">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-gold-500/25 to-gold-800/10 border border-gold-500/40 shrink-0">
            <CreditCard className="h-6 w-6 text-gold-bright"/>
          </div>
          <div className="flex-1 min-w-0">
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
    <div className="card-luxury rounded-2xl p-6 max-w-3xl">
      <div className="font-display text-2xl">Withdraw funds</div>
      <div className="text-sm text-muted-foreground">Send fiat to bank/UPI or crypto to an external wallet. Every withdrawal is reviewed by admin before it is released.</div>
      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Currency</Label>
            <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
              <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
              <SelectContent className="max-h-72">
                {enabledFiat.length > 0 && <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Fiat</div>}
                {Object.keys(FIAT_META).filter(c => enabledFiat.includes(c)).map(c => <SelectItem key={c} value={c}>{FIAT_META[c].flag} {c}</SelectItem>)}
                {cryptoEnabled && enabledCrypto.length > 0 && <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>}
                {cryptoEnabled && Object.keys(CRYPTO_META).filter(c => enabledCrypto.includes(c)).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Network *</Label>
              <Select value={form.network} onValueChange={v => setForm({ ...form, network: v })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue placeholder="Choose network"/></SelectTrigger>
                <SelectContent>
                  {cryptoNetworks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Destination wallet address *</Label>
              <Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="0x... / bc1... / T..." className="mt-2 bg-secondary border-gold-500/20 h-11 font-mono text-xs"/>
              <div className="text-[10px] text-muted-foreground mt-1">⚠️ Sending to the wrong network will result in permanent loss of funds.</div>
            </div>
          </div>
        ) : (
          <>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Withdrawal method</Label>
              <Select value={form.method} onValueChange={v => { setForm({ ...form, method: v }); setDetails({}) }}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {enabledFiatMethods.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">No fiat withdrawal methods enabled. Contact support.</div>}
                  {enabledFiatMethods.map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <MethodFields method={form.method} details={details} setDetails={setDetails}/>
          </>
        )}
        <Button onClick={submit} disabled={loading || !form.amount} className="gold-btn w-full h-12 rounded-xl">{loading?'Processing…':'Submit withdrawal request'}</Button>
        <div className="text-xs text-muted-foreground">All withdrawal requests are reviewed by an Aurela administrator. Funds are held in escrow and released only after approval.</div>
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
  const [form, setForm] = useState({
    first_name: '', last_name: '', dob: '', country: '', state: '', city: '',
    address: '', postal_code: '', mobile: user?.phone || '', occupation: '',
    id_type: '', id_number: '', doc_front: '', doc_back: '', selfie: ''
  })
  const [loading, setLoading] = useState(false)
  const status = user?.kyc_status || 'unverified'
  const availableDocs = form.country ? (KYC_DOCS_BY_COUNTRY[form.country] || KYC_DOCS_BY_COUNTRY.DEFAULT) : []

  useEffect(() => {
    if (form.country && form.id_type && !availableDocs.includes(form.id_type)) {
      setForm(f => ({ ...f, id_type: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country])

  const readFile = (file, cb) => {
    if (!file) return
    if (file.size > 2_500_000) return toast.error('File too large — max 2.5MB')
    const r = new FileReader()
    r.onload = () => cb(r.result)
    r.readAsDataURL(file)
  }

  const submit = async () => {
    if (!form.first_name || !form.last_name) return toast.error('First and last name are required')
    if (!form.country) return toast.error('Please select your country')
    if (!form.mobile) return toast.error('Mobile number is required')
    if (!form.id_type) return toast.error('Please select an identity document')
    if (!form.id_number) return toast.error('Document number is required')
    if (!form.doc_front) return toast.error('Please upload the front of your document')
    setLoading(true)
    try {
      await api.post('/kyc', form)
      toast.success('KYC submitted for review')
      onDone && onDone()
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const statusBadge = {
    unverified: <Badge variant="outline" className="border-muted text-muted-foreground">Unverified</Badge>,
    pending: <Badge variant="outline" className="border-gold-500/50 text-gold">Pending review</Badge>,
    approved: <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">Approved</Badge>,
    rejected: <Badge variant="outline" className="border-red-500/50 text-red-400">Rejected</Badge>,
  }[status]

  if (status === 'pending' || status === 'approved') {
    return (
      <div className="card-luxury rounded-2xl p-8 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-2xl">Identity verification</div>
            <div className="text-sm text-muted-foreground mt-1">
              {status === 'pending' ? 'Our compliance team is reviewing your submission. This usually takes a few hours.' : 'You are fully verified. All features are unlocked.'}
            </div>
          </div>
          {statusBadge}
        </div>
      </div>
    )
  }

  return (
    <div className="card-luxury rounded-2xl p-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-2xl">Identity verification</div>
          <div className="text-sm text-muted-foreground">Required by our banking partners. All data is encrypted and used only for compliance.</div>
        </div>
        {statusBadge}
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">First name *</Label>
          <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Last name *</Label>
          <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Date of birth</Label>
          <Input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Mobile number *</Label>
          <Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="+1 555 000 0000" className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Country *</Label>
          <Select value={form.country} onValueChange={v => setForm({ ...form, country: v })}>
            <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue placeholder="Choose your country"/></SelectTrigger>
            <SelectContent className="max-h-64">
              {KYC_COUNTRIES.map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">State / Province</Label>
          <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">City</Label>
          <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Postal / ZIP code</Label>
          <Input value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Full address</Label>
          <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Occupation</Label>
          <Input value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Document type *</Label>
          <Select value={form.id_type} onValueChange={v => setForm({ ...form, id_type: v })} disabled={!form.country}>
            <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue placeholder={form.country ? 'Choose a document' : 'Select country first'}/></SelectTrigger>
            <SelectContent>
              {availableDocs.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Document number *</Label>
          <Input value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11 font-mono"/>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-3">
        {[
          { key: 'doc_front', label: 'Document front *' },
          { key: 'doc_back', label: 'Document back (if applicable)' },
          { key: 'selfie', label: 'Selfie holding document (optional)' },
        ].map(f => (
          <label key={f.key} className="relative block border border-dashed border-gold-500/30 rounded-xl p-4 bg-secondary/40 cursor-pointer hover:border-gold-500/60 transition min-h-[140px]">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{f.label}</div>
            {form[f.key] ? (
              <>
                <img src={form[f.key]} alt="" className="mt-2 rounded-lg max-h-24 w-auto object-cover"/>
                <div className="text-xs text-gold mt-2">Click to replace</div>
              </>
            ) : (
              <div className="mt-4 text-sm text-muted-foreground">📎 Click to upload (JPG/PNG, ≤ 2.5MB)</div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={e => readFile(e.target.files?.[0], data => setForm(fx => ({ ...fx, [f.key]: data })))}/>
          </label>
        ))}
      </div>

      <Button onClick={submit} disabled={loading} className="gold-btn mt-6 h-12 rounded-xl px-8">
        {loading ? 'Submitting…' : 'Submit for review'}
      </Button>
    </div>
  )
}

function ChangePasswordForm() {
  const { api } = useApp()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (form.next !== form.confirm) return toast.error('New passwords do not match')
    if (form.next.length < 8) return toast.error('New password must be at least 8 characters')
    setLoading(true)
    try { await api.post('/profile/password', { current_password: form.current, new_password: form.next }); toast.success('Password updated'); setForm({ current: '', next: '', confirm: '' }) }
    catch(err) { toast.error(err.message) } finally { setLoading(false) }
  }
  return (
    <form onSubmit={submit} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Current password</Label>
        <Input required type="password" value={form.current} onChange={e => setForm({ ...form, current: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">New password</Label>
        <Input required type="password" minLength={8} value={form.next} onChange={e => setForm({ ...form, next: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Confirm new password</Label>
        <Input required type="password" minLength={8} value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={loading} className="gold-btn rounded-xl h-11 px-8">{loading ? 'Updating…' : 'Update password'}</Button>
      </div>
    </form>
  )
}

function ProfileTab({ user, onDone }) {
  const { api } = useApp()
  const [form, setForm] = useState({
    full_name: user?.full_name || '', phone: user?.phone || '',
    address: user?.address || '', city: user?.city || '', country: user?.country || '', postal_code: user?.postal_code || '',
    date_of_birth: user?.date_of_birth || '', avatar: user?.avatar || ''
  })
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [twofa, setTwofa] = useState(null)
  const [twofaCode, setTwofaCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [qr, setQr] = useState(null)

  useEffect(() => { api.get('/profile/qr').then(setQr).catch(()=>{}) }, [])
  useEffect(() => {
    setForm(f => ({ ...f, full_name: user?.full_name || f.full_name, phone: user?.phone || f.phone, avatar: user?.avatar || f.avatar }))
  }, [user])

  const save = async () => {
    setLoading(true)
    try { await api.put('/profile', form); toast.success('Profile updated'); setEditing(false); onDone && onDone() } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }
  const cancel = () => {
    setForm({
      full_name: user?.full_name || '', phone: user?.phone || '',
      address: user?.address || '', city: user?.city || '', country: user?.country || '', postal_code: user?.postal_code || '',
      date_of_birth: user?.date_of_birth || '', avatar: user?.avatar || ''
    })
    setEditing(false)
  }
  const onAvatarPick = (file) => {
    if (!file) return
    if (file.size > 2_000_000) return toast.error('Image too large — max 2MB')
    const r = new FileReader()
    r.onload = () => setForm(f => ({ ...f, avatar: r.result }))
    r.readAsDataURL(file)
  }

  const setup2fa = async () => {
    try { const res = await api.post('/profile/2fa/setup', {}); setTwofa(res) }
    catch(e) { toast.error(e.message || 'Could not start 2FA setup. Please try again.') }
  }
  const enable2fa = async () => {
    try { await api.post('/profile/2fa/enable', { code: twofaCode }); toast.success('2FA enabled'); setTwofa(null); setTwofaCode(''); onDone && onDone() } catch(e) { toast.error(e.message) }
  }
  const disable2fa = async () => {
    try { await api.post('/profile/2fa/disable', { code: disableCode }); toast.success('2FA disabled'); setDisableCode(''); onDone && onDone() } catch(e) { toast.error(e.message) }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 max-w-6xl">
      <div className="card-luxury rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-2xl">Your profile</div>
            <div className="text-sm text-muted-foreground">Public identity across the Aurela network.</div>
          </div>
          {!editing ? (
            <Button variant="outline" onClick={() => setEditing(true)} className="border-gold-500/40 rounded-full"><Edit3 className="h-3.5 w-3.5 mr-1.5"/> Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={cancel} className="text-muted-foreground rounded-full">Cancel</Button>
              <Button onClick={save} disabled={loading} className="gold-btn rounded-full">{loading ? 'Saving…' : 'Save'}</Button>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div className="relative">
            {form.avatar ? (
              <img src={form.avatar} alt="avatar" className="h-20 w-20 rounded-full object-cover border-2 border-gold-500/40"/>
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center text-onyx-900 font-bold text-2xl">
                {(user?.full_name || user?.username || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            {editing && (
              <label className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-onyx-900 border border-gold-500/40 flex items-center justify-center cursor-pointer hover:bg-gold-500/10">
                <Copy className="h-3.5 w-3.5 text-gold rotate-45" />
                <input type="file" accept="image/*" className="hidden" onChange={e => onAvatarPick(e.target.files?.[0])}/>
              </label>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-xl truncate">{user?.full_name || user?.username}</div>
            <div className="text-xs text-muted-foreground truncate">@{user?.username} · {user?.email}</div>
            {user?.user_code && (
              <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gold-500/10 border border-gold-500/30">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Aurela ID</div>
                <div className="font-mono text-xs text-gold">{user.user_code}</div>
                <button type="button" onClick={() => { navigator.clipboard.writeText(user.user_code); toast.success('Aurela ID copied') }} className="text-gold hover:text-gold-bright"><Copy className="h-3 w-3"/></button>
              </div>
            )}
            {editing && <div className="text-[10px] text-gold mt-1">Click the badge to change avatar</div>}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <Input value={form.full_name} disabled={!editing} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Phone</Label>
            <Input value={form.phone} disabled={!editing} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Country</Label>
            <Input value={form.country} disabled={!editing} onChange={e => setForm({ ...form, country: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">City</Label>
            <Input value={form.city} disabled={!editing} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Address</Label>
            <Input value={form.address} disabled={!editing} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
        </div>
      </div>

      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Receive by QR</div>
        <div className="text-sm text-muted-foreground">Others can scan this QR to send you fiat or crypto instantly.</div>
        <div className="mt-4 flex items-start gap-6 flex-wrap">
          <div className="p-4 rounded-xl bg-onyx-950 border border-gold-500/20 shrink-0">
            {qr ? <div dangerouslySetInnerHTML={{ __html: qr.qr_svg }} /> : <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-muted-foreground">Loading QR…</div>}
          </div>
          <div className="flex-1 min-w-[180px]">
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
            <div className="font-display text-2xl">Change password</div>
            <div className="text-sm text-muted-foreground">Update the password you use to sign in.</div>
          </div>
        </div>
        <ChangePasswordForm/>
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
  const { api, user } = useApp()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const [scope, setScope] = useState('mine') // mine | all
  const [blocks, setBlocks] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null) // { blocks, users, wallets } | null
  const [detail, setDetail] = useState(null) // { block, prev, next, transaction }
  const [addrDetail, setAddrDetail] = useState(null) // { wallet, owner, blocks, stats }

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

  const doSearch = async () => {
    const q = query.trim()
    if (!q) { setResults(null); return }
    try {
      const res = await api.get(`/chain/search?q=${encodeURIComponent(q)}`)
      setResults(res)
    } catch(e) { toast.error(e.message) }
  }
  const openBlock = async (hash) => {
    try { const res = await api.get(`/chain/tx/${hash}`); setDetail(res); setAddrDetail(null) } catch(e) { toast.error(e.message) }
  }
  const openAddress = async (addr) => {
    try { const res = await api.get(`/chain/address/${encodeURIComponent(addr)}`); setAddrDetail(res); setDetail(null) } catch(e) { toast.error(e.message) }
  }
  const seedBlocks = async () => {
    const n = typeof window !== 'undefined' ? parseInt(window.prompt('How many dummy blocks to generate? (max 5000)', '1000')) : 1000
    if (!n || n < 1) return
    try { const res = await api.post('/admin/chain/seed', { count: Math.min(n, 5000) }); toast.success(`Seeded ${res.seeded} blocks`); load() }
    catch(e) { toast.error(e.message) }
  }
  const deleteBlock = async (hash) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this block permanently?')) return
    try { await api.del(`/admin/chain/${hash}`); toast.success('Block deleted'); setDetail(null); load() } catch(e) { toast.error(e.message) }
  }
  const displayBlocks = results?.blocks && results.blocks.length ? results.blocks : blocks

  return (
    <div className="space-y-6">
      <div className="card-luxury rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(400px 200px at 100% 0%, rgba(212,175,55,0.25), transparent 70%)' }}/>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-gold">Aurela Chain</div>
            <div className="font-display text-2xl sm:text-3xl mt-1">Explorer</div>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Hash-linked, tamper-evident ledger. Search any transaction hash, block number, username, email, or wallet address.</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total blocks</div>
            <div className="font-display text-3xl gold-text">{total.toLocaleString()}</div>
          </div>
        </div>
        <div className="relative mt-6 flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"/>
            <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==='Enter' && doSearch()} placeholder="Search hash, block #, @username, email, wallet address..." className="pl-9 bg-secondary border-gold-500/20 h-11"/>
            {results && (
              <button onClick={() => { setQuery(''); setResults(null) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold"><X className="h-4 w-4"/></button>
            )}
          </div>
          <Button onClick={doSearch} className="gold-btn rounded-full h-11 px-6"><Search className="h-4 w-4 mr-2"/> Search</Button>
        </div>
        {!results && (
          <div className="relative flex gap-2 mt-4 flex-wrap">
            <Button onClick={() => setScope('mine')} className={scope==='mine' ? 'gold-btn rounded-full' : 'rounded-full'} variant={scope==='mine'?'default':'outline'} size="sm">My blocks</Button>
            <Button onClick={() => setScope('all')} className={scope==='all' ? 'gold-btn rounded-full' : 'rounded-full border-gold-500/40'} variant={scope==='all'?'default':'outline'} size="sm">Network explorer</Button>
            {isAdmin && (
              <Button onClick={seedBlocks} className="rounded-full border-gold-500/40" variant="outline" size="sm">
                <Plus className="h-3.5 w-3.5 mr-1"/> Seed dummy blocks
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Search results: users + wallets */}
      {results && ((results.users?.length || 0) + (results.wallets?.length || 0)) > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {results.users?.length > 0 && (
            <div className="card-luxury rounded-2xl p-5">
              <div className="text-xs uppercase tracking-widest text-gold mb-3">Matching accounts</div>
              <div className="space-y-2">
                {results.users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/40">
                    {u.avatar ? <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover"/> : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center text-onyx-900 text-sm font-bold">{(u.full_name||u.username||'A').charAt(0).toUpperCase()}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{u.full_name || '—'}</div>
                      <div className="text-[10px] text-muted-foreground truncate">@{u.username} · {u.email}</div>
                    </div>
                    <Badge variant="outline" className="border-gold-500/30 text-[10px]">{u.kyc_status || 'unverified'}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {results.wallets?.length > 0 && (
            <div className="card-luxury rounded-2xl p-5">
              <div className="text-xs uppercase tracking-widest text-gold mb-3">Matching wallets</div>
              <div className="space-y-2">
                {results.wallets.map(w => (
                  <button key={w.id} onClick={() => openAddress(w.address || w.id)} className="w-full text-left flex items-center gap-3 p-2 rounded-lg bg-secondary/40 hover:bg-gold-500/10">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-gold truncate">{w.currency} · {w.owner?.username ? '@'+w.owner.username : '(external)'}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{w.address || w.id}</div>
                    </div>
                    <div className="text-xs font-mono text-right shrink-0">{fmt(w.balance, w.currency)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card-luxury rounded-2xl overflow-hidden">
        <div className="table-scroll">
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
              {!loading && displayBlocks.length === 0 && (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">{results ? 'No blocks matched your search.' : 'No blocks yet.'}</td></tr>
              )}
              {displayBlocks.map(b => (
                <tr key={b.id} className="hover:bg-gold-500/5 cursor-pointer" onClick={() => openBlock(b.hash)}>
                  <td className="px-4 py-3 font-mono text-gold-bright">#{b.block_number}</td>
                  <td className="px-4 py-3 text-xs capitalize whitespace-nowrap">{(b.type || '').replace(/_/g,' ')}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="truncate max-w-[140px]">{b.from_username || '—'}</div>
                    <div className="text-muted-foreground truncate max-w-[140px]">→ {b.to_username || b.destination || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(b.amount, b.currency)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={b.network === 'AURELA' ? 'border-gold-500 text-gold' : 'border-muted text-muted-foreground'}>{b.network}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-gold hover:underline">{b.hash.slice(0, 10)}…{b.hash.slice(-6)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(b.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Block detail modal */}
      <Dialog open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Blocks className="h-5 w-5 text-gold"/>Block #{detail?.block?.block_number}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/50 border border-gold-500/10">
                <div className="text-[10px] uppercase text-muted-foreground">Block hash</div>
                <div className="font-mono text-gold text-xs break-all mt-1">{detail.block.hash}</div>
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(detail.block.hash); toast.success('Hash copied') }} className="mt-2 border-gold-500/40"><Copy className="h-3 w-3 mr-2"/>Copy hash</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  ['Type', (detail.block.type || '').replace(/_/g,' ')],
                  ['Network', detail.block.network],
                  ['Currency', detail.block.currency],
                  ['Amount', fmt(detail.block.amount, detail.block.currency)],
                  ['From', detail.block.from_username || '—'],
                  ['To', detail.block.to_username || detail.block.destination || '—'],
                  ['Method', detail.block.method || '—'],
                  ['Block #', detail.block.block_number],
                  ['Timestamp', new Date(detail.block.timestamp).toLocaleString()],
                  ['Previous hash', detail.block.prev_hash?.slice(0, 24) + '…'],
                  ...(detail.block.destination ? [['External destination', detail.block.destination]] : []),
                  ...(detail.block.card_id ? [['Card ID', detail.block.card_id]] : []),
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                    <div className="text-sm break-all font-mono">{v}</div>
                  </div>
                ))}
              </div>
              {detail.transaction && (
                <div className="p-4 rounded-xl bg-secondary/40 border border-gold-500/10">
                  <div className="text-xs uppercase tracking-widest text-gold mb-2">Linked transaction</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><div className="text-muted-foreground text-[10px] uppercase">ID</div><div className="font-mono break-all">{detail.transaction.id}</div></div>
                    <div><div className="text-muted-foreground text-[10px] uppercase">Status</div><div>{detail.transaction.status}</div></div>
                  </div>
                </div>
              )}
              <div className="flex justify-between pt-2 gap-2 flex-wrap">
                <Button variant="outline" onClick={() => detail.prev && openBlock(detail.prev.hash)} disabled={!detail.prev} className="border-gold-500/40">← Prev</Button>
                <div className="flex gap-2">
                  {isAdmin && (
                    <Button variant="outline" onClick={() => deleteBlock(detail.block.hash)} className="border-red-500/40 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5 mr-1"/> Delete block</Button>
                  )}
                  <Button variant="outline" onClick={() => detail.next && openBlock(detail.next.hash)} disabled={!detail.next} className="border-gold-500/40">Next →</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Address detail modal */}
      <Dialog open={!!addrDetail} onOpenChange={v => !v && setAddrDetail(null)}>
        <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Wallet className="h-5 w-5 text-gold"/>Wallet · {addrDetail?.wallet?.currency}</DialogTitle></DialogHeader>
          {addrDetail && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/50 border border-gold-500/10">
                <div className="text-[10px] uppercase text-muted-foreground">Address</div>
                <div className="font-mono text-gold text-xs break-all mt-1">{addrDetail.wallet.address || addrDetail.wallet.id}</div>
                {addrDetail.owner && (
                  <div className="mt-3 flex items-center gap-2">
                    {addrDetail.owner.avatar ? <img src={addrDetail.owner.avatar} alt="" className="h-8 w-8 rounded-full object-cover"/> : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center text-onyx-900 text-sm font-bold">{(addrDetail.owner.full_name || addrDetail.owner.username || 'A').charAt(0).toUpperCase()}</div>}
                    <div className="flex-1">
                      <div className="text-sm">{addrDetail.owner.full_name || addrDetail.owner.username}</div>
                      <div className="text-[10px] text-muted-foreground">@{addrDetail.owner.username}</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-secondary/40 text-center"><div className="text-[10px] uppercase text-muted-foreground">Balance</div><div className="font-mono text-gold">{fmt(addrDetail.wallet.balance, addrDetail.wallet.currency)}</div></div>
                <div className="p-3 rounded-lg bg-secondary/40 text-center"><div className="text-[10px] uppercase text-muted-foreground">Total received</div><div className="font-mono text-emerald-400">{fmt(addrDetail.stats.incoming, addrDetail.wallet.currency)}</div></div>
                <div className="p-3 rounded-lg bg-secondary/40 text-center"><div className="text-[10px] uppercase text-muted-foreground">Total sent</div><div className="font-mono text-red-400">{fmt(addrDetail.stats.outgoing, addrDetail.wallet.currency)}</div></div>
              </div>
              <div className="text-xs uppercase tracking-widest text-gold">Recent transactions ({addrDetail.blocks.length})</div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {addrDetail.blocks.map(b => (
                  <button key={b.id} onClick={() => openBlock(b.hash)} className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-gold-500/10">
                    <div className="text-[10px] font-mono text-gold-bright shrink-0">#{b.block_number}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs capitalize truncate">{(b.type||'').replace(/_/g,' ')} · {b.from_username} → {b.to_username || b.destination}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{b.hash.slice(0,20)}…</div>
                    </div>
                    <div className={`text-xs font-mono shrink-0 ${b.to_user_id === addrDetail.wallet.user_id ? 'text-emerald-400' : 'text-red-400'}`}>{b.to_user_id === addrDetail.wallet.user_id ? '+' : '-'}{fmt(b.amount, b.currency)}</div>
                  </button>
                ))}
                {addrDetail.blocks.length === 0 && <div className="text-center text-muted-foreground text-xs py-4">No transactions yet.</div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

