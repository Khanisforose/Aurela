'use client'

import { useEffect, useState } from 'react'
import { useApp, FIAT_META, CRYPTO_META, fmt, CoinIcon, FlagIcon } from './store'
import { AurelaWordmark } from './Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LocationSummary } from './LocationSummary'
import { toast } from 'sonner'
import { LayoutDashboard, Users, ShieldCheck, Settings, Receipt, ScrollText, LogOut, Search, Snowflake, Ban, Trash2, Plus, Minus, Wallet, Sparkles, ChevronRight, Copy, Edit3, X, Save, Check, RefreshCw, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const ADMIN_NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'kyc', label: 'KYC Review', icon: ShieldCheck },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'wallets', label: 'Platform Wallets', icon: Wallet },
  { id: 'settings', label: 'Platform', icon: Settings },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
]

export function AdminPanel() {
  const { user, logout, api, setRoute } = useApp()
  const [tab, setTab] = useState('overview')

  return (
    <div className="min-h-screen bg-onyx-radial">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-gold-500/10 bg-onyx-900/60 backdrop-blur-xl p-6 hidden lg:flex flex-col">
        <AurelaWordmark />
        <div className="mt-2 text-[10px] uppercase tracking-widest text-gold">Admin console</div>
        <div className="mt-6 space-y-1 flex-1">
          {ADMIN_NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${tab === n.id ? 'gold-btn' : 'text-muted-foreground hover:text-gold hover:bg-gold-500/5'}`}>
              <n.icon className="h-4 w-4"/> {n.label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => setRoute('dashboard')} className="mb-2 border-gold-500/40">Switch to user view</Button>
        <Button variant="ghost" onClick={logout} className="justify-start text-muted-foreground hover:text-gold">
          <LogOut className="h-4 w-4 mr-2"/> Sign out
        </Button>
      </aside>

      <main className="lg:ml-64 min-h-screen">
        <div className="sticky top-0 z-30 border-b border-gold-500/10 bg-onyx-900/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">Admin</div>
            <div className="font-display text-2xl">{ADMIN_NAV.find(n => n.id === tab)?.label}</div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-gold-500/40 text-gold">{user?.role === 'super_admin' ? 'Super Admin' : 'Administrator'}</Badge>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center text-onyx-900 font-bold">{(user?.full_name||'A').charAt(0).toUpperCase()}</div>
          </div>
        </div>
        <div className="lg:hidden overflow-x-auto flex gap-2 px-6 py-3">
          {ADMIN_NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${tab === n.id ? 'gold-btn' : 'text-muted-foreground border border-gold-500/20'}`}>{n.label}</button>
          ))}
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              {tab === 'overview' && <OverviewAdmin/>}
              {tab === 'users' && <UsersAdmin/>}
              {tab === 'kyc' && <KycAdmin/>}
              {tab === 'transactions' && <TxAdmin/>}
              {tab === 'wallets' && <PlatformWalletsAdmin/>}
              {tab === 'settings' && <SettingsAdmin/>}
              {tab === 'audit' && <AuditAdmin/>}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

function OverviewAdmin() {
  const { api, tick } = useApp()
  const [data, setData] = useState(null)
  const load = () => api.get('/admin/overview').then(setData).catch(()=>{})
  useEffect(() => { load() }, [])
  useEffect(() => { load() }, [tick])
  const cards = [
    { k: 'Users', v: data?.users ?? '—', tab: 'admin_users', color: 'text-gold' },
    { k: 'Transactions', v: data?.transactions ?? '—', tab: 'admin_tx' },
    { k: 'Cards issued', v: data?.cards ?? '—', tab: 'admin_card_approvals' },
    { k: 'KYC pending', v: data?.kyc_pending ?? '—', tab: 'admin_kyc', highlight: (data?.kyc_pending || 0) > 0 },
    { k: 'Deposits pending', v: data?.deposits_pending ?? '—', tab: 'admin_deposits', highlight: (data?.deposits_pending || 0) > 0 },
    { k: 'Withdrawals pending', v: data?.withdrawals_pending ?? '—', tab: 'admin_withdrawals', highlight: (data?.withdrawals_pending || 0) > 0 },
  ]
  const jump = (tab) => window.dispatchEvent(new CustomEvent('aurela:go-tab', { detail: tab }))
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((c, i) => (
        <button key={i} onClick={() => jump(c.tab)} className={`text-left card-luxury rounded-2xl p-6 hover:scale-[1.02] transition group ${c.highlight ? 'ring-2 ring-red-500/40' : ''}`}>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.k}</div>
          <div className={`font-display text-4xl mt-2 ${c.highlight ? 'text-red-400' : 'gold-text'}`}>{c.v}</div>
          <div className="text-[10px] uppercase text-gold mt-3 opacity-0 group-hover:opacity-100 transition">View details →</div>
        </button>
      ))}
    </div>
  )
}

function UsersAdmin() {
  const { api } = useApp()
  const [q, setQ] = useState('')
  const [users, setUsers] = useState([])
  const [adjTarget, setAdjTarget] = useState(null)
  const [adjForm, setAdjForm] = useState({ currency: 'USD', amount: '', kind: 'credit' })
  const [detail, setDetail] = useState(null) // { user, wallets, cards, transactions, kyc, sessions }
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [feeOverrides, setFeeOverrides] = useState({ basic: '', premium: '', elite: '' })
  const [savingFees, setSavingFees] = useState(false)

  // Load fee overrides into local editor whenever a user detail is opened
  useEffect(() => {
    if (detail?.user) {
      const ov = detail.user.card_fee_overrides || {}
      setFeeOverrides({
        basic: (typeof ov.basic === 'number') ? String(ov.basic) : '',
        premium: (typeof ov.premium === 'number') ? String(ov.premium) : '',
        elite: (typeof ov.elite === 'number') ? String(ov.elite) : '',
      })
    }
  }, [detail?.user?.id])

  const saveFees = async () => {
    if (!detail?.user?.id) return
    setSavingFees(true)
    try {
      const payload = { overrides: {} }
      for (const t of ['basic','premium','elite']) {
        const raw = feeOverrides[t]
        if (raw === '' || raw === null) continue   // empty -> tier falls back to global
        const n = Number(raw)
        if (Number.isFinite(n) && n >= 0) payload.overrides[t] = n
      }
      await api.post(`/admin/users/${detail.user.id}/card_fees`, payload)
      toast.success('Card fees updated for this user')
      // Reflect in local detail
      setDetail({ ...detail, user: { ...detail.user, card_fee_overrides: payload.overrides } })
    } catch(e) { toast.error(e.message) }
    finally { setSavingFees(false) }
  }

  const load = async () => {
    try { const { users } = await api.get('/admin/users' + (q ? `?q=${encodeURIComponent(q)}` : '')); setUsers(users) } catch(e) {}
  }
  useEffect(() => { load() }, [])

  const openDetail = async (u) => {
    setLoadingDetail(true)
    try { const res = await api.get(`/admin/users/${u.id}`); setDetail(res) }
    catch(e) { toast.error(e.message) }
    finally { setLoadingDetail(false) }
  }
  const action = async (u, act) => {
    if (act === 'delete' && (typeof window !== 'undefined' && !window.confirm(`Delete ${u.username}? This is permanent.`))) return
    try { await api.post(`/admin/users/${u.id}/${act}`, {}); toast.success(`User ${act}`); load(); if (detail?.user?.id === u.id) setDetail(null) } catch(e) { toast.error(e.message) }
  }
  const adjust = async () => {
    try {
      await api.post(`/admin/users/${adjTarget.id}/adjust`, { currency: adjForm.currency, amount: Number(adjForm.amount), kind: adjForm.kind })
      toast.success(`Balance ${adjForm.kind === 'credit' ? 'credited' : 'debited'}`)
      setAdjTarget(null); setAdjForm({ currency: 'USD', amount: '', kind: 'credit' }); load()
    } catch(e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Search users…" className="pl-10 bg-secondary border-gold-500/20 h-11"/>
        </div>
        <Button onClick={load} className="gold-btn rounded-full">Search</Button>
      </div>

      <div className="card-luxury rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gold-500/5 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">KYC</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-500/10">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gold-500/5 cursor-pointer" onClick={() => openDetail(u)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {u.avatar ? <img src={u.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0"/> : <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center text-onyx-900 text-sm font-bold shrink-0">{(u.full_name || u.username || 'A').charAt(0).toUpperCase()}</div>}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.full_name || u.username}</div>
                      <div className="text-xs text-muted-foreground truncate">@{u.username} · {u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs"><Badge variant="outline" className={`${u.role==='admin'||u.role==='super_admin'?'border-gold-500 text-gold':'border-muted text-muted-foreground'}`}>{u.role}</Badge></td>
                <td className="px-4 py-3 text-xs"><Badge variant="outline" className={u.status==='active'?'border-emerald-500/40 text-emerald-400':u.status==='blocked'?'border-red-500/40 text-red-400':'border-yellow-500/40 text-yellow-400'}>{u.status}</Badge></td>
                <td className="px-4 py-3 text-xs"><div className="flex flex-wrap gap-1"><Badge variant="outline" className={u.kyc_status==='approved'?'border-emerald-500/40 text-emerald-400':'border-muted text-muted-foreground'}>{u.kyc_status}</Badge>{u.withdraw_lock?.active && <Badge variant="outline" className="border-red-500/40 text-red-400" title="External withdrawals on geolocation hold">geo hold{Number(u.withdraw_allowance_usd) > 0 ? ` · $${Number(u.withdraw_allowance_usd).toLocaleString('en-US')}` : ''}</Badge>}</div></td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-end gap-1 flex-wrap">
                    <Button size="sm" variant="outline" className="border-gold-500/40 h-8 text-xs" onClick={()=>{setAdjTarget(u); setAdjForm({ currency:'USD', amount:'', kind:'credit' })}}><Wallet className="h-3 w-3 mr-1"/> Fund</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={()=>action(u, u.status==='frozen'?'unfreeze':'freeze')}><Snowflake className="h-3 w-3 mr-1"/> {u.status==='frozen'?'Unfreeze':'Freeze'}</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={()=>action(u, u.status==='blocked'?'unblock':'block')}><Ban className="h-3 w-3 mr-1"/> {u.status==='blocked'?'Unblock':'Block'}</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs text-red-400 border-red-500/40 hover:bg-red-500/10" onClick={()=>action(u,'delete')}><Trash2 className="h-3 w-3 mr-1"/> Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-muted-foreground">No users found.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!adjTarget} onOpenChange={v => !v && setAdjTarget(null)}>
        <DialogContent className="bg-onyx-900 border-gold-500/20">
          <DialogHeader><DialogTitle className="font-display">Adjust balance · {adjTarget?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Currency</Label>
                <Select value={adjForm.currency} onValueChange={v => setAdjForm({ ...adjForm, currency: v })}>
                  <SelectTrigger className="mt-2 bg-secondary border-gold-500/20"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Fiat</div>
                    {Object.keys(FIAT_META).map(c => <SelectItem key={c} value={c}><span className="inline-flex items-center gap-2"><FlagIcon code={c} size={18}/> {c}</span></SelectItem>)}
                    <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>
                    {Object.keys(CRYPTO_META).map(c => <SelectItem key={c} value={c}><span className="inline-flex items-center gap-2"><CoinIcon code={c} size={18}/> {c}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Amount</Label>
                <Input type="number" step="any" value={adjForm.amount} onChange={e => setAdjForm({ ...adjForm, amount: e.target.value })} className="mt-2 bg-secondary border-gold-500/20"/>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setAdjForm({ ...adjForm, kind: 'credit' })} className={`flex-1 ${adjForm.kind==='credit'?'gold-btn':'bg-secondary'}`}><Plus className="h-4 w-4 mr-1"/> Credit</Button>
              <Button onClick={() => setAdjForm({ ...adjForm, kind: 'debit' })} variant="outline" className={`flex-1 ${adjForm.kind==='debit'?'ring-1 ring-red-500 text-red-400 border-red-500/50':''}`}><Minus className="h-4 w-4 mr-1"/> Debit</Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={adjust} disabled={!adjForm.amount} className="gold-btn w-full">Apply adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User detail modal */}
      <Dialog open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">User details</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/40 border border-gold-500/10">
                {detail.user.avatar ? <img src={detail.user.avatar} alt="" className="h-20 w-20 rounded-full object-cover border-2 border-gold-500/40"/> : <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center text-onyx-900 text-3xl font-bold">{(detail.user.full_name || detail.user.username || 'A').charAt(0).toUpperCase()}</div>}
                <div className="flex-1 min-w-0">
                  <div className="font-display text-2xl truncate">{detail.user.full_name || detail.user.username}</div>
                  <div className="text-sm text-muted-foreground truncate">@{detail.user.username} · {detail.user.email}</div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Badge variant="outline" className="border-gold-500/40 text-gold text-[10px]">{detail.user.role}</Badge>
                    <Badge variant="outline" className={detail.user.status==='active'?'border-emerald-500/40 text-emerald-400 text-[10px]':'border-red-500/40 text-red-400 text-[10px]'}>{detail.user.status}</Badge>
                    <Badge variant="outline" className={detail.user.kyc_status==='approved'?'border-emerald-500/40 text-emerald-400 text-[10px]':'border-muted text-muted-foreground text-[10px]'}>KYC: {detail.user.kyc_status || 'unverified'}</Badge>
                    {detail.user.two_fa_enabled && <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">2FA on</Badge>}
                  </div>
                </div>
              </div>

              {/* Profile */}
              <div>
                <div className="text-xs uppercase tracking-widest text-gold mb-2">Profile</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {[
                    ['Phone', detail.user.phone],
                    ['Country', detail.user.country || detail.kyc?.country],
                    ['City', detail.user.city || detail.kyc?.city],
                    ['Address', detail.user.address || detail.kyc?.address],
                    ['Postal code', detail.user.postal_code || detail.kyc?.postal_code],
                    ['Preferred currency', detail.user.preferred_currency],
                    ['Signed up', detail.user.created_at ? new Date(detail.user.created_at).toLocaleString() : null],
                  ].map(([k, v]) => (
                    <div key={k}><div className="text-[10px] uppercase text-muted-foreground">{k}</div><div className="text-sm break-all">{v || <span className="text-muted-foreground">—</span>}</div></div>
                  ))}
                </div>
              </div>

              {/* Wallets */}
              <div>
                <div className="text-xs uppercase tracking-widest text-gold mb-2">Wallets ({detail.wallets.length})</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                  {detail.wallets.filter(w => w.balance > 0).slice(0, 30).map(w => (
                    <div key={w.id} className="p-2 rounded-lg bg-secondary/40 border border-gold-500/10">
                      <div className="text-[10px] uppercase text-muted-foreground">{w.currency}</div>
                      <div className="font-mono text-sm text-gold">{fmt(w.balance, w.currency)}</div>
                      {w.address && <div className="font-mono text-[9px] text-muted-foreground break-all mt-1">{w.address.slice(0,14)}…</div>}
                    </div>
                  ))}
                  {detail.wallets.filter(w => w.balance > 0).length === 0 && <div className="text-xs text-muted-foreground col-span-full">All wallets have zero balance.</div>}
                </div>
              </div>

              {/* Cards */}
              <div>
                <div className="text-xs uppercase tracking-widest text-gold mb-2">Cards ({detail.cards.length})</div>
                <div className="space-y-1">
                  {detail.cards.length === 0 && <div className="text-xs text-muted-foreground">No cards issued.</div>}
                  {detail.cards.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/40 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono truncate">{c.number}</div>
                        <div className="text-[10px] text-muted-foreground">{c.tier_name} · {c.holder}</div>
                      </div>
                      <Badge variant="outline" className={c.status==='active'?'border-emerald-500/40 text-emerald-400 text-[10px]':'border-gold-500/30 text-gold text-[10px]'}>{c.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-user card activation fee overrides */}
              <div className="p-4 rounded-xl border border-gold-500/25 bg-gradient-to-br from-gold-500/5 to-transparent">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-gold">Card activation fees · per-user override</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Leave a field blank to fall back to the global admin default. Values are in USDT.</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {['basic','premium','elite'].map(t => (
                    <div key={t}>
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{t}</Label>
                      <Input
                        type="number" step="any" min="0"
                        value={feeOverrides[t]}
                        onChange={e => setFeeOverrides({ ...feeOverrides, [t]: e.target.value })}
                        placeholder="default"
                        className="mt-1 bg-secondary border-gold-500/20 h-10 font-mono"
                      />
                    </div>
                  ))}
                </div>
                <Button size="sm" onClick={saveFees} disabled={savingFees} className="gold-btn mt-3 rounded-lg">
                  {savingFees ? 'Saving…' : 'Save card fees for this user'}
                </Button>
              </div>

              {/* Withdrawal access (geolocation hold) */}
              <WithdrawAccessControls userId={detail.user.id} access={detail.user} onChanged={(wa) => setDetail({ ...detail, user: { ...detail.user, ...(wa || {}) } })} />

              {/* Location (captured on every sign-in) */}
              <div className="p-4 rounded-xl border border-gold-500/25 bg-gradient-to-br from-gold-500/5 to-transparent">
                <div className="text-xs uppercase tracking-widest text-gold mb-2">Location & device</div>
                <LocationSummary location={detail.user.last_location} history={detail.locations || []}/>
              </div>

              {/* KYC snapshot */}
              {detail.kyc && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-gold mb-2">Latest KYC submission</div>
                  <div className="p-3 rounded-lg bg-secondary/40 grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-[10px] uppercase text-muted-foreground">Document</div><div>{detail.kyc.id_type} · {detail.kyc.id_number}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Country / Mobile</div><div>{detail.kyc.country} · {detail.kyc.mobile}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Status</div><div>{detail.kyc.status}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Submitted</div><div>{detail.kyc.submitted_at ? new Date(detail.kyc.submitted_at).toLocaleString() : ''}</div></div>
                  </div>
                </div>
              )}

              {/* Recent transactions */}
              <div>
                <div className="text-xs uppercase tracking-widest text-gold mb-2">Recent activity ({detail.transactions.length})</div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {detail.transactions.length === 0 && <div className="text-xs text-muted-foreground">No transactions yet.</div>}
                  {detail.transactions.slice(0, 20).map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 text-xs">
                      <div className="capitalize shrink-0 w-20">{t.type.replace(/_/g,' ')}</div>
                      <div className="flex-1 min-w-0 truncate text-muted-foreground">{t.from_username || '—'} → {t.to_username || t.destination || '—'}</div>
                      <div className="font-mono text-gold shrink-0">{fmt(t.amount, t.currency)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap pt-2 border-t border-gold-500/10">
                <Button size="sm" variant="outline" onClick={() => { setDetail(null); setAdjTarget(detail.user); setAdjForm({ currency:'USD', amount:'', kind:'credit' }) }} className="border-gold-500/40"><Wallet className="h-3 w-3 mr-1"/> Adjust balance</Button>
                <Button size="sm" variant="outline" onClick={() => action(detail.user, detail.user.status==='frozen'?'unfreeze':'freeze')}>{detail.user.status==='frozen'?'Unfreeze':'Freeze'}</Button>
                <Button size="sm" variant="outline" onClick={() => action(detail.user, detail.user.status==='blocked'?'unblock':'block')}>{detail.user.status==='blocked'?'Unblock':'Block'}</Button>
                <Button size="sm" variant="outline" onClick={() => action(detail.user, 'delete')} className="border-red-500/40 text-red-400 hover:bg-red-500/10">Delete user</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KycAdmin() {
  const { api, tick } = useApp()
  const [list, setList] = useState([])
  const [meta, setMeta] = useState({ total: 0, pending: 0 })
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null) // { kyc, user }
  const [detailLoading, setDetailLoading] = useState(false)
  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get(`/admin/kyc?status=${encodeURIComponent(filter)}&limit=200`)
      const rows = Array.isArray(res?.kyc) ? res.kyc : []
      setList(rows)
      setMeta({ total: Number(res?.total) || rows.length, pending: Number(res?.pending) || 0 })
      setError('')
    } catch(e) {
      setError(e?.message || 'Failed to load KYC submissions')
    } finally {
      if (!silent) setLoading(false)
    }
  }
  useEffect(() => { load() }, [filter])
  // Background refresh on the global tick — silent, and skipped while a review dialog is open
  useEffect(() => { if (!open) load(true) }, [tick])
  const openDetail = async (k) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/admin/kyc/${k.id}`)
      if (!res?.kyc) throw new Error('KYC record not found')
      setOpen(res)
    } catch(e) { toast.error(e?.message || 'Could not open KYC review') }
    finally { setDetailLoading(false) }
  }
  const [rejecting, setRejecting] = useState(null) // kyc record awaiting a rejection reason
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)
  const REJECT_PRESETS = [
    'Document image is blurry or unreadable',
    'Document has expired',
    'Name on document does not match the details entered',
    'Selfie does not match the document photo',
    'Document back / second page is missing or incomplete',
    'Address details are incomplete or incorrect',
  ]
  const action = async (k, act, body = {}) => {
    setActing(true)
    try {
      await api.post(`/admin/kyc/${k.id}/${act}`, body)
      toast.success(act === 'approve' ? 'KYC approved' : 'KYC rejected — user has been notified with the reason')
      setRejecting(null); setReason(''); setOpen(null); load()
    } catch(e) { toast.error(e?.message || 'Action failed') }
    finally { setActing(false) }
  }
  const confirmReject = () => {
    const r = reason.trim()
    if (r.length < 5) return toast.error('Please enter a rejection reason (at least 5 characters)')
    action(rejecting, 'reject', { reason: r })
  }

  const FILTERS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${filter === v ? 'border-gold-500/60 bg-gold-500/10 text-gold' : 'border-gold-500/20 text-muted-foreground hover:text-gold'}`}>
              {label}{v === 'pending' && meta.pending > 0 ? ` (${meta.pending})` : ''}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{meta.total} record{meta.total === 1 ? '' : 's'}</span>
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-7 px-2"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}/></Button>
        </div>
      </div>

      {error && (
        <div className="card-luxury rounded-2xl p-5 border border-red-500/30 text-sm">
          <div className="text-red-400">Could not load KYC submissions: {error}</div>
          <Button size="sm" variant="outline" onClick={() => load()} className="mt-3 border-gold-500/40">Retry</Button>
        </div>
      )}
      {loading && !error && <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading KYC submissions…</div>}
      {!loading && !error && list.length === 0 && <div className="text-muted-foreground text-sm">No {filter === 'all' ? '' : filter + ' '}KYC submissions.</div>}
      {list.map(k => (
        <div key={k.id} className="card-luxury rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs flex-1 min-w-0">
            <div><div className="text-muted-foreground uppercase text-[10px]">Full name</div><div className="truncate">{k.full_name || `${k.first_name || ''} ${k.last_name || ''}`.trim() || '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Country</div><div>{k.country || '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Mobile</div><div className="truncate">{k.mobile || '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Document</div><div className="truncate">{k.id_type || '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Submitted</div><div className="truncate">{k.submitted_at ? new Date(k.submitted_at).toLocaleString() : '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><Badge variant="outline" className={k.status==='approved'?'border-emerald-500/40 text-emerald-400':k.status==='rejected'?'border-red-500/40 text-red-400':'border-gold-500/40 text-gold'}>{k.status || 'pending'}</Badge></div>
            {k.status === 'rejected' && k.rejection_reason && (
              <div className="col-span-2 md:col-span-6"><div className="text-muted-foreground uppercase text-[10px]">Rejection reason</div><div className="text-red-300/90 truncate">{k.rejection_reason}</div></div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={()=>openDetail(k)} disabled={detailLoading} className="border-gold-500/40">{detailLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Open review'}</Button>
          </div>
        </div>
      ))}

      <Dialog open={!!open} onOpenChange={v => !v && setOpen(null)}>
        <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Identity verification review</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  ['User (@username)', open.user?.username],
                  ['Email', open.user?.email],
                  ['First name', open.kyc?.first_name],
                  ['Last name', open.kyc?.last_name],
                  ['Date of birth', open.kyc?.dob],
                  ['Mobile', open.kyc?.mobile],
                  ['Country', open.kyc?.country],
                  ['State / Province', open.kyc?.state],
                  ['City', open.kyc?.city],
                  ['Postal code', open.kyc?.postal_code],
                  ['Address', open.kyc?.address],
                  ['Occupation', open.kyc?.occupation],
                  ['Document type', open.kyc?.id_type],
                  ['Document number', open.kyc?.id_number],
                  ['Submitted at', open.kyc?.submitted_at ? new Date(open.kyc.submitted_at).toLocaleString() : ''],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                    <div className="text-sm break-all">{val || <span className="text-muted-foreground">—</span>}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: 'doc_front', label: 'Document front' },
                  { key: 'doc_back', label: 'Document back' },
                  { key: 'selfie', label: 'Selfie' },
                ].map(f => (
                  <div key={f.key} className="rounded-lg bg-secondary p-3">
                    <div className="text-[10px] uppercase text-muted-foreground mb-2">{f.label}</div>
                    {open.kyc?.[f.key] ? (
                      <a href={open.kyc[f.key]} target="_blank" rel="noopener noreferrer">
                        <img src={open.kyc[f.key]} alt={f.label} className="rounded-lg max-h-48 w-full object-contain bg-onyx-950"/>
                        <div className="text-[10px] text-gold mt-1 text-center">Click to open full-size</div>
                      </a>
                    ) : (
                      <div className="text-xs text-muted-foreground py-8 text-center">Not provided</div>
                    )}
                  </div>
                ))}
              </div>
              {open.kyc?.status === 'rejected' && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm" data-testid="kyc-review-rejection-reason">
                  <div className="text-[10px] uppercase text-red-400">Rejection reason</div>
                  <div className="mt-1 text-foreground/90">{open.kyc?.rejection_reason || <span className="text-muted-foreground">No reason recorded (rejected before reasons were introduced)</span>}</div>
                  {open.kyc?.reviewed_at && <div className="text-[10px] text-muted-foreground mt-1">Reviewed {new Date(open.kyc.reviewed_at).toLocaleString()}</div>}
                </div>
              )}
              {open.kyc?.status === 'pending' ? (
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => { setReason(''); setRejecting(open.kyc) }} disabled={acting} className="border-red-500/40 text-red-400 hover:bg-red-500/10" data-testid="kyc-reject-btn">Reject…</Button>
                  <Button onClick={() => action(open.kyc, 'approve')} disabled={acting} className="gold-btn" data-testid="kyc-approve-btn">{acting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Approve KYC'}</Button>
                </DialogFooter>
              ) : (
                <div className="text-center text-xs text-muted-foreground">This KYC has already been {open.kyc?.status}.</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={v => { if (!v && !acting) { setRejecting(null); setReason('') } }}>
        <DialogContent className="bg-onyx-900 border-red-500/30 max-w-lg" data-testid="kyc-reject-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Reject identity verification</DialogTitle>
          </DialogHeader>
          {rejecting && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Rejecting <span className="text-foreground">{rejecting.full_name || `${rejecting.first_name || ''} ${rejecting.last_name || ''}`.trim() || 'this user'}</span>. The reason below is sent to the user so they know exactly what to fix before resubmitting.
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Quick reasons</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {REJECT_PRESETS.map(p => (
                    <button key={p} type="button" onClick={() => setReason(p)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors text-left ${reason === p ? 'border-red-500/60 bg-red-500/10 text-red-300' : 'border-gold-500/20 text-muted-foreground hover:text-foreground hover:border-gold-500/40'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Reason <span className="text-red-400">*</span></Label>
                <Textarea value={reason} onChange={e => setReason(e.target.value.slice(0, 500))} rows={4} placeholder="Explain clearly what was wrong and what the user should do to fix it…" className="mt-2 bg-secondary border-gold-500/20 resize-none" data-testid="kyc-reject-reason"/>
                <div className="text-[10px] text-muted-foreground mt-1 text-right">{reason.trim().length}/500</div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setRejecting(null); setReason('') }} disabled={acting} className="border-gold-500/40">Cancel</Button>
                <Button onClick={confirmReject} disabled={acting || reason.trim().length < 5} className="bg-red-600 hover:bg-red-700 text-white" data-testid="kyc-reject-confirm">
                  {acting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Reject & notify user'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TxAdmin() {
  const { api, tick } = useApp()
  const [txs, setTxs] = useState([])
  const load = () => api.get('/admin/transactions').then(({transactions}) => setTxs(transactions)).catch(()=>{})
  useEffect(() => { load() }, [])
  useEffect(() => { load() }, [tick])
  const del = async (t) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this transaction record? Balances are NOT reversed.')) return
    try { await api.del(`/admin/transactions/${t.id}`); toast.success('Transaction deleted'); load() } catch(e) { toast.error(e.message) }
  }
  return (
    <div className="card-luxury rounded-2xl overflow-hidden">
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="bg-gold-500/5 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">From</th>
              <th className="px-4 py-3 text-left">To</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-500/10">
            {txs.map(t => (
              <tr key={t.id} className="hover:bg-gold-500/5">
                <td className="px-4 py-3 capitalize text-xs">{t.type.replace('_',' ')}</td>
                <td className="px-4 py-3 text-xs">{t.from_username || '—'}</td>
                <td className="px-4 py-3 text-xs">{t.to_username || '—'}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(t.amount, t.currency)}</td>
                <td className="px-4 py-3 text-xs"><Badge variant="outline" className="border-gold-500/30 text-gold">{t.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => del(t)} className="text-red-400 hover:text-red-300"><X className="h-3.5 w-3.5"/></button>
                </td>
              </tr>
            ))}
            {txs.length === 0 && <tr><td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">No transactions.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SettingsAdmin() {
  const { api, config } = useApp()
  const [s, setS] = useState(null)
  const [form, setForm] = useState({
    card_activation_wallet: '', card_activation_network: 'ERC20',
    card_activation_fees: { basic: 10, premium: 50, elite: 200 },
    enabled_deposit_methods: [], enabled_withdrawal_methods: [],
    enabled_fiat: [], enabled_crypto: [],
    apk_url: '', apk_version: ''
  })

  const METHOD_LABELS = {
    bank_swift: 'International Bank (SWIFT)',
    bank_indian: 'Indian Bank Transfer',
    upi: 'UPI (India)',
    paypal: 'PayPal',
    stripe: 'Card Payment (Stripe)',
    card: 'Debit / Credit Card',
    sepa: 'SEPA (EU)',
    ach: 'ACH (US Bank)',
    wise: 'Wise Transfer',
    crypto: 'Crypto (on-chain)',
  }
  const allMethods = config?.all_deposit_methods || Object.keys(METHOD_LABELS)

  useEffect(() => {
    api.get('/admin/settings').then(({settings}) => {
      setS(settings)
      setForm({
        card_activation_wallet: settings.card_activation_wallet,
        card_activation_network: settings.card_activation_network,
        card_activation_fees: settings.card_activation_fees || { basic: 10, premium: 50, elite: 200 },
        enabled_deposit_methods: settings.enabled_deposit_methods || allMethods,
        enabled_withdrawal_methods: settings.enabled_withdrawal_methods || allMethods,
        enabled_fiat: settings.enabled_fiat || (config?.all_fiat || []),
        enabled_crypto: settings.enabled_crypto || (config?.all_crypto || []),
        apk_url: settings.apk_url || '',
        apk_version: settings.apk_version || '',
      })
    }).catch(()=>{})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    try {
      const upd = await api.put('/admin/settings', form)
      toast.success('Settings saved — changes apply to users instantly')
      setS(upd.settings)
    } catch(e) { toast.error(e.message) }
  }

  const toggle = (list, m) => list.includes(m) ? list.filter(x => x !== m) : [...list, m]

  if (!s) return <div className="text-muted-foreground">Loading…</div>

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Card activation</div>
        <div className="text-sm text-muted-foreground">Configure the treasury wallet and fees for card activation.</div>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Treasury wallet address</Label>
            <Input value={form.card_activation_wallet} onChange={e => setForm({ ...form, card_activation_wallet: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11 font-mono text-sm"/>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Network</Label>
            <Select value={form.card_activation_network} onValueChange={v => setForm({ ...form, card_activation_network: v })}>
              <SelectTrigger className="mt-2 bg-secondary border-gold-500/20 h-11"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="ERC20">ERC20</SelectItem>
                <SelectItem value="TRC20">TRC20</SelectItem>
                <SelectItem value="BEP20">BEP20</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['basic','premium','elite'].map(t => (
              <div key={t}>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground capitalize">{t} (USDT)</Label>
                <Input type="number" value={form.card_activation_fees[t]} onChange={e => setForm({ ...form, card_activation_fees: { ...form.card_activation_fees, [t]: Number(e.target.value) } })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Mobile App (APK)</div>
        <div className="text-sm text-muted-foreground">Configure the "Download App" popup. Generate an APK by uploading your live URL to <a className="text-gold hover:underline" target="_blank" rel="noopener noreferrer" href="https://www.pwabuilder.com">pwabuilder.com</a>, host the .apk on your server, then paste the URL below.</div>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">APK download URL</Label>
            <Input value={form.apk_url} onChange={e => setForm({ ...form, apk_url: e.target.value })} placeholder="https://aurelawallet.com/downloads/aurela.apk" className="mt-2 bg-secondary border-gold-500/20 h-11 font-mono text-sm"/>
            <div className="text-[10px] text-muted-foreground mt-1">Leave blank until your APK is ready — the popup will show "Coming soon" instead.</div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Version label</Label>
            <Input value={form.apk_version} onChange={e => setForm({ ...form, apk_version: e.target.value })} placeholder="1.0.0" className="mt-2 bg-secondary border-gold-500/20 h-11"/>
          </div>
        </div>
      </div>

      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Deposit methods</div>
        <div className="text-sm text-muted-foreground">Toggle which deposit methods users can select. Disabled methods are hidden from the deposit form.</div>
        <div className="mt-4 space-y-2">
          {allMethods.map(m => {
            const on = form.enabled_deposit_methods.includes(m)
            return (
              <label key={m} className="flex items-center justify-between p-3 rounded-lg bg-secondary/60 border border-gold-500/10 cursor-pointer hover:border-gold-500/30 transition">
                <div>
                  <div className="text-sm">{METHOD_LABELS[m] || m}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{m}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, enabled_deposit_methods: toggle(form.enabled_deposit_methods, m) })}
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition ${on ? 'bg-gradient-to-r from-gold-500 to-gold-700 justify-end' : 'bg-secondary border border-gold-500/20 justify-start'}`}
                >
                  <span className={`h-5 w-5 rounded-full transition ${on ? 'bg-onyx-900' : 'bg-muted-foreground'}`}/>
                </button>
              </label>
            )
          })}
        </div>
      </div>

      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Withdrawal methods</div>
        <div className="text-sm text-muted-foreground">Toggle which withdrawal methods users can select. Disabled methods are hidden from the withdraw form.</div>
        <div className="mt-4 space-y-2">
          {allMethods.map(m => {
            const on = form.enabled_withdrawal_methods.includes(m)
            return (
              <label key={m} className="flex items-center justify-between p-3 rounded-lg bg-secondary/60 border border-gold-500/10 cursor-pointer hover:border-gold-500/30 transition">
                <div>
                  <div className="text-sm">{METHOD_LABELS[m] || m}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{m}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, enabled_withdrawal_methods: toggle(form.enabled_withdrawal_methods, m) })}
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition ${on ? 'bg-gradient-to-r from-gold-500 to-gold-700 justify-end' : 'bg-secondary border border-gold-500/20 justify-start'}`}
                >
                  <span className={`h-5 w-5 rounded-full transition ${on ? 'bg-onyx-900' : 'bg-muted-foreground'}`}/>
                </button>
              </label>
            )
          })}
        </div>
      </div>

      <div className="card-luxury rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-display text-2xl">Fiat currencies</div>
            <div className="text-sm text-muted-foreground">Enable/disable individual fiat currencies for deposits and withdrawals.</div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, enabled_fiat: config?.all_fiat || [] })} className="text-[10px] uppercase tracking-widest text-gold hover:underline">Enable all</button>
            <span className="text-muted-foreground text-[10px]">·</span>
            <button type="button" onClick={() => setForm({ ...form, enabled_fiat: [] })} className="text-[10px] uppercase tracking-widest text-muted-foreground hover:underline">Disable all</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
          {(config?.all_fiat || []).map(c => {
            const on = form.enabled_fiat.includes(c)
            return (
              <button key={c} type="button" onClick={() => setForm({ ...form, enabled_fiat: toggle(form.enabled_fiat, c) })} className={`flex items-center justify-between p-3 rounded-lg border transition ${on ? 'bg-gold-500/10 border-gold-500/50' : 'bg-secondary/60 border-gold-500/10 opacity-60'}`}>
                <div className="text-sm flex items-center gap-2">
                  <FlagIcon code={c} size={20}/>
                  <span className="font-mono">{c}</span>
                </div>
                <span className={`w-8 h-4 rounded-full flex items-center px-0.5 transition ${on ? 'bg-gradient-to-r from-gold-500 to-gold-700 justify-end' : 'bg-secondary border border-gold-500/20 justify-start'}`}>
                  <span className={`h-3 w-3 rounded-full ${on ? 'bg-onyx-900' : 'bg-muted-foreground'}`}/>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card-luxury rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-display text-2xl">Cryptocurrencies</div>
            <div className="text-sm text-muted-foreground">Enable/disable individual crypto assets for deposits and withdrawals.</div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, enabled_crypto: config?.all_crypto || [] })} className="text-[10px] uppercase tracking-widest text-gold hover:underline">Enable all</button>
            <span className="text-muted-foreground text-[10px]">·</span>
            <button type="button" onClick={() => setForm({ ...form, enabled_crypto: [] })} className="text-[10px] uppercase tracking-widest text-muted-foreground hover:underline">Disable all</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
          {(config?.all_crypto || []).map(c => {
            const on = form.enabled_crypto.includes(c)
            return (
              <button key={c} type="button" onClick={() => setForm({ ...form, enabled_crypto: toggle(form.enabled_crypto, c) })} className={`flex items-center justify-between p-3 rounded-lg border transition ${on ? 'bg-gold-500/10 border-gold-500/50' : 'bg-secondary/60 border-gold-500/10 opacity-60'}`}>
                <div className="text-sm flex items-center gap-2">
                  <CoinIcon code={c} size={20}/>
                  <span className="font-mono">{c}</span>
                </div>
                <span className={`w-8 h-4 rounded-full flex items-center px-0.5 transition ${on ? 'bg-gradient-to-r from-gold-500 to-gold-700 justify-end' : 'bg-secondary border border-gold-500/20 justify-start'}`}>
                  <span className={`h-3 w-3 rounded-full ${on ? 'bg-onyx-900' : 'bg-muted-foreground'}`}/>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="lg:col-span-2">
        <Button onClick={save} className="gold-btn w-full h-12 rounded-xl">Save all settings</Button>
      </div>
    </div>
  )
}

function AuditAdmin() {
  const { api } = useApp()
  const [logs, setLogs] = useState([])
  useEffect(() => { api.get('/admin/audit').then(({audit}) => setLogs(audit)).catch(()=>{}) }, [])
  return (
    <div className="card-luxury rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gold-500/5 text-xs uppercase tracking-widest text-muted-foreground">
          <tr><th className="px-4 py-3 text-left">Time</th><th className="px-4 py-3 text-left">Actor</th><th className="px-4 py-3 text-left">Action</th><th className="px-4 py-3 text-left">Meta</th></tr>
        </thead>
        <tbody className="divide-y divide-gold-500/10">
          {logs.map(l => (
            <tr key={l.id}>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
              <td className="px-4 py-3 text-xs font-mono">{l.actor_id?.slice(0, 8)}…</td>
              <td className="px-4 py-3 text-xs text-gold">{l.action}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{JSON.stringify(l.meta)}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan="4" className="px-4 py-8 text-center text-muted-foreground">No audit events yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function PlatformWalletsAdmin() {
  const { api, user } = useApp()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [newForm, setNewForm] = useState({ asset: 'USDT', network: 'ERC20', address: '' })
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ asset: '', network: '', address: '', enabled: true })
  const isSuper = user?.role === 'super_admin'

  const ASSETS = ['BTC','ETH','USDT','USDC','BNB','SOL','XRP','ADA','DOGE','MATIC']
  const NETS = ['Bitcoin','ERC20','TRC20','BEP20','Polygon','Solana','Cardano','Dogecoin','XRP']

  const load = async () => {
    try { const { platform_wallets } = await api.get('/admin/platform-wallets'); setList(platform_wallets) } catch(e) {}
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!newForm.address) return toast.error('Address required')
    setLoading(true)
    try {
      await api.post('/admin/platform-wallets', newForm)
      toast.success('Platform wallet added')
      setNewForm({ asset: 'USDT', network: 'ERC20', address: '' })
      load()
    } catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }
  const saveEdit = async () => {
    try {
      await api.put(`/admin/platform-wallets/${editing.id}`, editForm)
      toast.success('Wallet updated')
      setEditing(null); load()
    } catch(e) { toast.error(e.message) }
  }
  const del = async (w) => {
    if (!confirm(`Delete ${w.asset} · ${w.network} wallet?`)) return
    try { await api.del(`/admin/platform-wallets/${w.id}`); toast.success('Deleted'); load() } catch(e) { toast.error(e.message) }
  }
  const toggle = async (w) => {
    try { await api.put(`/admin/platform-wallets/${w.id}`, { enabled: !w.enabled }); load() } catch(e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="card-luxury rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-2xl">Platform receive wallets</div>
            <div className="text-sm text-muted-foreground">Addresses shown to users for crypto deposits and card activation. {isSuper ? '' : 'Read-only for admins — only super admins can edit.'}</div>
          </div>
        </div>

        {isSuper && (
          <div className="mt-6 grid md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Asset</Label>
              <Select value={newForm.asset} onValueChange={v => setNewForm({ ...newForm, asset: v })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20"><SelectValue/></SelectTrigger>
                <SelectContent>{ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Network</Label>
              <Select value={newForm.network} onValueChange={v => setNewForm({ ...newForm, network: v })}>
                <SelectTrigger className="mt-2 bg-secondary border-gold-500/20"><SelectValue/></SelectTrigger>
                <SelectContent>{NETS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Address</Label>
              <div className="flex gap-2 mt-2">
                <Input value={newForm.address} onChange={e => setNewForm({ ...newForm, address: e.target.value })} className="bg-secondary border-gold-500/20 h-10 font-mono text-xs"/>
                <Button onClick={create} disabled={loading} className="gold-btn"><Plus className="h-4 w-4 mr-1"/> Add</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card-luxury rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gold-500/5 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Asset</th>
              <th className="px-4 py-3 text-left">Network</th>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-500/10">
            {list.map(w => editing?.id === w.id ? (
              <tr key={w.id} className="bg-gold-500/5">
                <td className="px-4 py-3">
                  <Select value={editForm.asset} onValueChange={v => setEditForm({ ...editForm, asset: v })}>
                    <SelectTrigger className="bg-secondary border-gold-500/20 h-9"><SelectValue/></SelectTrigger>
                    <SelectContent>{ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select value={editForm.network} onValueChange={v => setEditForm({ ...editForm, network: v })}>
                    <SelectTrigger className="bg-secondary border-gold-500/20 h-9"><SelectValue/></SelectTrigger>
                    <SelectContent>{NETS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="bg-secondary border-gold-500/20 h-9 font-mono text-xs"/>
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={editForm.enabled} onChange={e => setEditForm({ ...editForm, enabled: e.target.checked })} className="accent-gold-500"/>
                    <span className="text-gold">{editForm.enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={saveEdit} className="gold-btn h-8 text-xs"><Save className="h-3 w-3 mr-1"/> Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)} className="h-8 text-xs"><X className="h-3 w-3 mr-1"/> Cancel</Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={w.id} className="hover:bg-gold-500/5">
                <td className="px-4 py-3">
                  <Badge variant="outline" className="border-gold-500/40 text-gold">{w.asset}</Badge>
                </td>
                <td className="px-4 py-3 text-xs">{w.network}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gold text-xs break-all">{w.address}</span>
                    <button onClick={() => { navigator.clipboard.writeText(w.address); toast.success('Copied') }} className="text-muted-foreground hover:text-gold"><Copy className="h-3 w-3"/></button>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <Badge variant="outline" className={w.enabled ? 'border-emerald-500/40 text-emerald-400' : 'border-muted text-muted-foreground'}>{w.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {isSuper && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditing(w); setEditForm({ asset: w.asset, network: w.network, address: w.address, enabled: w.enabled }) }}><Edit3 className="h-3 w-3 mr-1"/> Edit</Button>}
                    {isSuper && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => toggle(w)}>{w.enabled ? 'Disable' : 'Enable'}</Button>}
                    {isSuper && <Button size="sm" variant="outline" className="h-8 text-xs text-red-400 border-red-500/40 hover:bg-red-500/10" onClick={() => del(w)}><Trash2 className="h-3 w-3"/></Button>}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-muted-foreground">No platform wallets configured.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}


export { OverviewAdmin as AdminOverview, UsersAdmin, KycAdmin, TxAdmin, SettingsAdmin, AuditAdmin, PlatformWalletsAdmin, DepositsAdmin, CardApprovalsAdmin, WithdrawalsAdmin }

// ---------------------------------------------------------------------------------
// Shared "Open request" review dialog for deposit & withdrawal requests
// ---------------------------------------------------------------------------------
const ownerDisplayName = (u, fallback) => u?.full_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || fallback || '—'
const statusBadgeClass = (s) => s === 'approved' ? 'border-emerald-500/40 text-emerald-400' : s === 'rejected' ? 'border-red-500/40 text-red-400' : 'border-gold-500/40 text-gold'

function RequestReviewDialog({ kind, data, onClose, onAction, busy }) {
  // kind: 'deposit' | 'withdraw'; data: { request, user, kyc, wallet, history, approved_totals, locations, cards, explorer_url }
  const open = !!data
  const r = data?.request
  const u = data?.user
  const copy = (v, label) => { try { navigator.clipboard.writeText(String(v)); toast.success(`${label} copied`) } catch(e) {} }
  const Row = ({ label, value, mono }) => (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-sm break-all ${mono ? 'font-mono text-xs' : ''}`}>{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  )
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-3xl max-h-[90vh] overflow-y-auto" data-testid={`${kind}-request-dialog`}>
        <DialogHeader><DialogTitle className="font-display">{kind === 'deposit' ? 'Deposit request' : 'Withdrawal request'}</DialogTitle></DialogHeader>
        {r && (
          <div className="space-y-5">
            {/* Requester */}
            <div className="rounded-xl bg-secondary/60 p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Requested by</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Row label="Full name" value={ownerDisplayName(u, r.username)}/>
                <Row label="Username" value={u?.username ? '@' + u.username : r.username ? '@' + r.username : ''}/>
                <Row label="Email" value={u?.email}/>
                <Row label="Phone" value={u?.phone}/>
                <Row label="Aurela ID" value={u?.user_code}/>
                <Row label="Country" value={u?.country || data?.kyc?.country}/>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">KYC status</div>
                  <div className={`text-sm ${u?.kyc_status === 'approved' ? 'text-emerald-400' : 'text-gold'}`}>{u?.kyc_status || 'unverified'}{data?.kyc?.id_type ? <span className="text-muted-foreground"> · {data.kyc.id_type}</span> : ''}</div>
                </div>
                <Row label="Account status" value={u?.status || 'active'}/>
                <Row label="Member since" value={u?.created_at ? new Date(u.created_at).toLocaleDateString() : ''}/>
                <Row label="Active cards" value={Array.isArray(data?.cards) ? `${data.cards.filter(c => c.status === 'active').length} active · ${data.cards.length} total` : ''}/>
                {kind === 'withdraw' && (
                  <div className="sm:col-span-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Withdrawal access</div>
                    <div className="text-sm">{u?.withdraw_lock?.active ? <span className="text-red-400">Geolocation hold active · remaining allowance ${(Number(u?.withdraw_allowance_usd) || 0).toLocaleString('en-US')}</span> : <span className="text-emerald-400">No hold</span>}</div>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-gold-500/10">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Last known location</div>
                <LocationSummary location={u?.last_location} history={data?.locations || []}/>
              </div>
            </div>

            {/* Payment */}
            <div className="rounded-xl bg-secondary/60 p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{kind === 'deposit' ? 'Deposit details' : 'Payout details'}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Amount</div>
                  <div className="font-display text-2xl gold-text">{fmt(r.amount, r.currency)}</div>
                </div>
                <Row label="Method" value={r.method}/>
                <Row label="Network" value={r.network}/>
                <Row label="Status" value={r.status}/>
                <Row label="Submitted" value={r.created_at ? new Date(r.created_at).toLocaleString() : ''}/>
                <Row label="Reviewed" value={r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : ''}/>
                {kind === 'withdraw' && <div className="sm:col-span-2"><Row label="Destination" value={r.destination} mono/></div>}
                {kind === 'deposit' && r.note && <div className="sm:col-span-2"><Row label="Note from user" value={r.note}/></div>}
                {data?.wallet && <Row label={`User's ${r.currency} wallet`} value={`${fmt(data.wallet.balance, r.currency)} available${data.wallet.locked ? ` · ${fmt(data.wallet.locked, r.currency)} locked` : ''}`}/>}
                {kind === 'withdraw' && r.allowance_reserved_usd > 0 && <Row label="Allowance consumed" value={`$${Number(r.allowance_reserved_usd).toLocaleString('en-US')}`}/>}
              </div>
              {r.details && Object.keys(r.details).length > 0 && (
                <div className="mt-4 pt-3 border-t border-gold-500/10">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{kind === 'deposit' ? 'Payment information provided' : 'Beneficiary details'}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(r.details).map(([k, v]) => <Row key={k} label={k.replace(/_/g, ' ')} value={String(v)} mono/>)}
                  </div>
                </div>
              )}
              {kind === 'deposit' && (
                <div className="mt-4">
                  <div className="text-[10px] uppercase text-muted-foreground">Transaction hash / reference</div>
                  {r.tx_hash ? (
                    <div className="mt-1 p-3 rounded-lg bg-onyx-950 flex items-start justify-between gap-3">
                      <div className="font-mono text-gold text-xs break-all">{r.tx_hash}</div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => copy(r.tx_hash, 'Reference')} className="text-muted-foreground hover:text-gold"><Copy className="h-3.5 w-3.5"/></button>
                        {data?.explorer_url && <a href={data.explorer_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gold underline whitespace-nowrap">View on explorer</a>}
                      </div>
                    </div>
                  ) : <div className="text-xs text-muted-foreground mt-1">No transaction reference provided.</div>}
                </div>
              )}
            </div>

            {/* History */}
            {(Array.isArray(data?.history) && data.history.length > 0 || (data?.approved_totals || []).length > 0) && (
              <div className="rounded-xl bg-secondary/60 p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">User's {kind === 'deposit' ? 'deposit' : 'withdrawal'} history</div>
                {(data?.approved_totals || []).length > 0 && (
                  <div className="text-xs text-muted-foreground mb-2">Approved so far: {data.approved_totals.map(t => `${fmt(t.total, t.currency)} (${t.count})`).join(' · ')}</div>
                )}
                <div className="space-y-1">
                  {(data?.history || []).map(h => (
                    <div key={h.id} className="flex items-center justify-between text-xs">
                      <span>{fmt(h.amount, h.currency)} <span className="text-muted-foreground">· {h.method}</span></span>
                      <span className="flex items-center gap-2"><Badge variant="outline" className={`${statusBadgeClass(h.status)} text-[10px]`}>{h.status}</Badge><span className="text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {r.status === 'pending' ? (
              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" onClick={() => onAction(r, 'reject')} disabled={busy} className="border-red-500/40 text-red-400 hover:bg-red-500/10">{kind === 'deposit' ? 'Reject' : 'Reject & refund'}</Button>
                <Button onClick={() => onAction(r, 'approve')} disabled={busy} className="gold-btn">{kind === 'deposit' ? 'Approve & credit' : 'Approve & release'}</Button>
              </DialogFooter>
            ) : (
              <div className="text-center text-xs text-muted-foreground">This request was {r.status}{r.reviewed_at ? ` on ${new Date(r.reviewed_at).toLocaleString()}` : ''}.</div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function useRequestList(path, key) {
  const { api, tick } = useApp()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)
  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try { const res = await api.get(path); setList(Array.isArray(res?.[key]) ? res[key] : []); setError('') }
    catch(e) { setError(e?.message || 'Failed to load') } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (!open) load(true) }, [tick])
  return { api, list, loading, error, open, setOpen, load }
}

function WithdrawalsAdmin() {
  const { api, list, loading, error, open, setOpen, load } = useRequestList('/admin/withdrawals', 'withdrawals')
  const [filter, setFilter] = useState('pending')
  const [busy, setBusy] = useState(false)
  const action = async (w, act) => {
    setBusy(true)
    try { await api.post(`/admin/withdrawals/${w.id}/${act}`, {}); toast.success(act === 'approve' ? 'Withdrawal approved & released' : 'Withdrawal rejected & refunded'); setOpen(null); load() }
    catch(e) { toast.error(e?.message || 'Action failed') } finally { setBusy(false) }
  }
  const openDetail = async (w) => { try { const res = await api.get(`/admin/withdrawals/${w.id}`); setOpen(res) } catch(e) { toast.error(e?.message || 'Could not open request') } }
  const filtered = list.filter(w => filter === 'all' ? true : w.status === filter)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {['pending','approved','rejected','all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs capitalize ${filter===f?'gold-btn':'border border-gold-500/25 text-muted-foreground'}`}>{f}</button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-7 px-2"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}/></Button>
      </div>
      {error && <div className="card-luxury rounded-2xl p-5 border border-red-500/30 text-sm text-red-400">Could not load withdrawal requests: {error}</div>}
      {loading && !error && <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>}
      {!loading && !error && filtered.length === 0 && <div className="text-muted-foreground text-sm">No withdrawal requests.</div>}
      <div className="space-y-3">
        {filtered.map(w => (
          <div key={w.id} data-testid={`withdraw-request-${w.id}`} className="card-luxury rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs flex-1 min-w-0">
              <div className="col-span-2">
                <div className="text-muted-foreground uppercase text-[10px]">Requested by</div>
                <div className="truncate font-medium">{ownerDisplayName(w.user, w.username)}</div>
                <div className="truncate text-muted-foreground">@{w.user?.username || w.username || '—'} · {w.user?.email || ''}{w.user?.last_location?.country ? ` · ${w.user.last_location.city ? w.user.last_location.city + ', ' : ''}${w.user.last_location.country}` : ''}</div>
              </div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Amount</div><div className="font-mono text-gold">{fmt(w.amount, w.currency)}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Method</div><div className="truncate">{w.method}{w.network ? ` · ${w.network}` : ''}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Submitted</div><div className="truncate">{new Date(w.created_at).toLocaleString()}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><Badge variant="outline" className={statusBadgeClass(w.status)}>{w.status}</Badge></div>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <Button size="sm" variant="outline" onClick={() => openDetail(w)} className="border-gold-500/40" data-testid={`withdraw-open-${w.id}`}>Open request</Button>
              {w.status === 'pending' && <Button size="sm" onClick={() => action(w,'approve')} disabled={busy} className="gold-btn">Approve & release</Button>}
            </div>
          </div>
        ))}
      </div>
      <RequestReviewDialog kind="withdraw" data={open} onClose={() => setOpen(null)} onAction={action} busy={busy}/>
    </div>
  )
}

function DepositsAdmin() {
  const { api, list, loading, error, open, setOpen, load } = useRequestList('/admin/deposits', 'deposits')
  const [filter, setFilter] = useState('pending')
  const [busy, setBusy] = useState(false)
  const action = async (d, act) => {
    setBusy(true)
    try { await api.post(`/admin/deposits/${d.id}/${act}`, {}); toast.success(act === 'approve' ? 'Deposit approved & credited' : 'Deposit rejected'); setOpen(null); load() }
    catch(e) { toast.error(e?.message || 'Action failed') } finally { setBusy(false) }
  }
  const openDetail = async (d) => { try { const res = await api.get(`/admin/deposits/${d.id}`); setOpen(res) } catch(e) { toast.error(e?.message || 'Could not open request') } }
  const filtered = list.filter(d => filter === 'all' ? true : d.status === filter)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {['pending','approved','rejected','all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs capitalize ${filter===f?'gold-btn':'border border-gold-500/25 text-muted-foreground'}`}>{f}</button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-7 px-2"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}/></Button>
      </div>
      {error && <div className="card-luxury rounded-2xl p-5 border border-red-500/30 text-sm text-red-400">Could not load deposit requests: {error}</div>}
      {loading && !error && <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>}
      {!loading && !error && filtered.length === 0 && <div className="text-muted-foreground text-sm">No deposit requests.</div>}
      <div className="space-y-3">
        {filtered.map(d => (
          <div key={d.id} data-testid={`deposit-request-${d.id}`} className="card-luxury rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs flex-1 min-w-0">
              <div className="col-span-2">
                <div className="text-muted-foreground uppercase text-[10px]">Requested by</div>
                <div className="truncate font-medium">{ownerDisplayName(d.user, d.to_username || d.username)}</div>
                <div className="truncate text-muted-foreground">@{d.user?.username || d.username || '—'} · {d.user?.email || ''}{d.user?.last_location?.country ? ` · ${d.user.last_location.city ? d.user.last_location.city + ', ' : ''}${d.user.last_location.country}` : ''}</div>
              </div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Amount</div><div className="font-mono text-gold">{fmt(d.amount, d.currency)}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Method</div><div className="truncate">{d.method}{d.network ? ` · ${d.network}` : ''}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Submitted</div><div className="truncate">{new Date(d.created_at).toLocaleString()}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><Badge variant="outline" className={statusBadgeClass(d.status)}>{d.status}</Badge></div>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <Button size="sm" variant="outline" onClick={() => openDetail(d)} className="border-gold-500/40" data-testid={`deposit-open-${d.id}`}>Open request</Button>
              {d.status === 'pending' && <Button size="sm" onClick={() => action(d,'approve')} disabled={busy} className="gold-btn">Approve & credit</Button>}
            </div>
          </div>
        ))}
      </div>
      <RequestReviewDialog kind="deposit" data={open} onClose={() => setOpen(null)} onAction={action} busy={busy}/>
    </div>
  )
}

function CardApprovalsAdmin() {
  const { api, tick } = useApp()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null) // { card, user, kyc, usdt_wallet, other_cards, explorer_url }
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/cards')
      setList(Array.isArray(res?.cards) ? res.cards : [])
      setError('')
    } catch(e) { setError(e?.message || 'Failed to load card requests') }
    finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (!open) load(true) }, [tick])
  const openDetail = async (c) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/admin/cards/${c.id}`)
      if (!res?.card) throw new Error('Card not found')
      setOpen(res)
    } catch(e) { toast.error(e?.message || 'Could not open card request') }
    finally { setDetailLoading(false) }
  }
  const action = async (c, act, activate_now=false) => {
    setBusy(true)
    try {
      const res = await api.post(`/admin/cards/${c.id}/${act}`, { activate_now })
      if (act === 'approve' && res?.credit) toast.success(`Card approved · ${res.credit.amount} ${res.credit.currency} credited to the user's balance`)
      else toast.success(`Card ${act}d`)
      setOpen(null); load()
    }
    catch(e) { toast.error(e?.message || 'Action failed') }
    finally { setBusy(false) }
  }
  const del = async (c) => {
    if (typeof window !== 'undefined' && !window.confirm('Permanently delete this card record?')) return
    try { await api.del(`/admin/cards/${c.id}`); toast.success('Card deleted'); setOpen(null); load() } catch(e) { toast.error(e?.message || 'Delete failed') }
  }
  const ownerName = (u) => u?.full_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || '—'
  const statusLabel = (s) => s === 'pending_verification' ? 'Awaiting verification' : s === 'pending_activation' ? 'Awaiting payment' : s === 'activating' ? 'Activating' : s
  // Zonal cards carry their own admin-defined activation window (hours); tier cards use the 24h default
  const windowLabel = (c) => c?.type === 'zonal' ? (Number(c.activation_hours) === 0 ? 'instant' : `${c.activation_hours}h`) : '24h'
  const statusClass = (s) => s === 'pending_verification' ? 'border-gold-500/40 text-gold' : s === 'activating' ? 'border-emerald-500/40 text-emerald-400' : 'border-gold-500/20 text-muted-foreground'
  const isActionable = (c) => c?.status === 'pending_verification' || c?.status === 'pending_activation'
  const copy = (v, label) => { try { navigator.clipboard.writeText(String(v)); toast.success(`${label} copied`) } catch(e) {} }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{list.length} open request{list.length === 1 ? '' : 's'}</div>
        <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-7 px-2"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}/></Button>
      </div>
      {error && (
        <div className="card-luxury rounded-2xl p-5 border border-red-500/30 text-sm">
          <div className="text-red-400">Could not load card requests: {error}</div>
          <Button size="sm" variant="outline" onClick={() => load()} className="mt-3 border-gold-500/40">Retry</Button>
        </div>
      )}
      {loading && !error && <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading card requests…</div>}
      {!loading && !error && list.length === 0 && <div className="text-muted-foreground text-sm">No pending card activations.</div>}
      {list.map(c => (
        <div key={c.id} data-testid={`card-request-${c.id}`} className="card-luxury rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs flex-1 min-w-0">
            <div className="col-span-2 md:col-span-2">
              <div className="text-muted-foreground uppercase text-[10px]">Requested by</div>
              <div className="truncate font-medium">{ownerName(c.user)}</div>
              <div className="truncate text-muted-foreground">@{c.user?.username || '—'} · {c.user?.email || c.user_id}</div>
            </div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Tier</div><div className="capitalize">{c.type === 'zonal' ? <span className="text-gold">Zonal · {c.zone}</span> : c.tier}</div>{c.type === 'zonal' && <div className="text-[10px] text-muted-foreground">{c.zone_name} · unlocks {windowLabel(c)}</div>}</div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Fee</div><div className="font-mono">{c.activation_fee_usdt} USDT</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Submitted</div><div className="truncate">{(c.activation_submitted_at || c.created_at) ? new Date(c.activation_submitted_at || c.created_at).toLocaleString() : '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><Badge variant="outline" className={statusClass(c.status)}>{statusLabel(c.status)}</Badge></div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            <Button size="sm" variant="outline" onClick={()=>openDetail(c)} disabled={detailLoading} className="border-gold-500/40" data-testid={`card-open-${c.id}`}>{detailLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Open request'}</Button>
            {isActionable(c) && <Button size="sm" onClick={()=>action(c,'approve')} disabled={busy} className="gold-btn">Approve ({windowLabel(c)})</Button>}
          </div>
        </div>
      ))}

      <Dialog open={!!open} onOpenChange={v => !v && setOpen(null)}>
        <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="card-request-dialog">
          <DialogHeader><DialogTitle className="font-display">Card activation request</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-5">
              {/* Requester */}
              <div className="rounded-xl bg-secondary/60 p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Requested by</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {[
                    ['Full name', ownerName(open.user)],
                    ['Username', open.user?.username ? '@' + open.user.username : ''],
                    ['Email', open.user?.email],
                    ['Phone', open.user?.phone],
                    ['Aurela ID', open.user?.user_code],
                    ['Country', open.user?.country || open.kyc?.country],
                    ['KYC status', open.user?.kyc_status || 'unverified'],
                    ['Account status', open.user?.status || 'active'],
                    ['Member since', open.user?.created_at ? new Date(open.user.created_at).toLocaleDateString() : ''],
                    ['USDT wallet balance', open.usdt_wallet ? `${open.usdt_wallet.balance} USDT` : ''],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                      <div className={`text-sm break-all ${label === 'KYC status' ? (val === 'approved' ? 'text-emerald-400' : 'text-gold') : ''}`}>{val || <span className="text-muted-foreground">—</span>}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gold-500/10">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Last known location</div>
                  <LocationSummary location={open.user?.last_location}/>
                </div>
              </div>

              {/* Card + payment */}
              <div className="rounded-xl bg-secondary/60 p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Card & payment</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {[
                    ['Tier', `${open.card?.tier_name || open.card?.tier || ''}`],
                    ['Card holder', open.card?.holder],
                    ['Card number', open.card?.number ? '•••• •••• •••• ' + String(open.card.number).replace(/\s/g,'').slice(-4) : ''],
                    ['Expiry', open.card?.expiry],
                    ['Activation fee', open.card?.activation_fee_usdt != null ? `${open.card.activation_fee_usdt} USDT` : ''],
                    ['Network used', open.card?.activation_network_used || open.card?.activation_network],
                    ['Pay-to wallet', open.card?.activation_wallet],
                    ['Requested at', open.card?.created_at ? new Date(open.card.created_at).toLocaleString() : ''],
                    ['Tx submitted at', open.card?.activation_submitted_at ? new Date(open.card.activation_submitted_at).toLocaleString() : ''],
                    ['Status', statusLabel(open.card?.status)],
                    ['Fee credited to balance', open.card?.fee_credited_at ? `+${open.card.fee_credited_amount ?? open.card.activation_fee_usdt} USDT · ${new Date(open.card.fee_credited_at).toLocaleString()}` : 'Will be credited to the user\'s USDT balance on approval'],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                      <div className="text-sm break-all">{val || <span className="text-muted-foreground">—</span>}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="text-[10px] uppercase text-muted-foreground">Transaction hash</div>
                  {open.card?.activation_tx_hash ? (
                    <div className="mt-1 p-3 rounded-lg bg-onyx-950 flex items-start justify-between gap-3">
                      <div className="font-mono text-gold text-xs break-all">{open.card.activation_tx_hash}</div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => copy(open.card.activation_tx_hash, 'Tx hash')} className="text-muted-foreground hover:text-gold"><Copy className="h-3.5 w-3.5"/></button>
                        {open.explorer_url && <a href={open.explorer_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gold underline whitespace-nowrap">View on explorer</a>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1">User has not submitted a payment transaction yet.</div>
                  )}
                </div>
              </div>

              {Array.isArray(open.other_cards) && open.other_cards.length > 0 && (
                <div className="text-xs text-muted-foreground">This user also holds {open.other_cards.length} other card{open.other_cards.length === 1 ? '' : 's'}: {open.other_cards.map(oc => `${oc.tier} (${oc.status})`).join(', ')}</div>
              )}

              {isActionable(open.card) ? (
                <DialogFooter className="gap-2 flex-wrap">
                  <Button variant="ghost" onClick={() => del(open.card)} disabled={busy} className="text-red-400 hover:bg-red-500/10 mr-auto">Delete</Button>
                  <Button variant="outline" onClick={() => action(open.card, 'reject')} disabled={busy} className="border-red-500/40 text-red-400 hover:bg-red-500/10">Reject</Button>
                  <Button variant="outline" onClick={() => action(open.card, 'approve', true)} disabled={busy} className="border-gold-500/40">Activate now</Button>
                  <Button onClick={() => action(open.card, 'approve')} disabled={busy} className="gold-btn">Approve ({windowLabel(open.card)})</Button>
                </DialogFooter>
              ) : (
                <div className="text-center text-xs text-muted-foreground">This card is {statusLabel(open.card?.status)}{open.card?.usable_at ? ` · usable from ${new Date(open.card.usable_at).toLocaleString()}` : ''}.</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}


// ---------------------------------------------------------------------------------
// Withdrawal access (geolocation hold) — admin decides who can withdraw and how much
// ---------------------------------------------------------------------------------
export function WithdrawAccessControls({ userId, access, onChanged, compact = false }) {
  const { api } = useApp()
  const [allowance, setAllowance] = useState(access?.withdraw_allowance_usd != null ? String(access.withdraw_allowance_usd) : '')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setAllowance(access?.withdraw_allowance_usd != null ? String(access.withdraw_allowance_usd) : '') }, [userId, access?.withdraw_allowance_usd])
  const locked = !!access?.withdraw_lock?.active
  const send = async (mode) => {
    setBusy(true)
    try {
      const payload = { mode }
      if (mode === 'allowance') {
        const n = Number(allowance)
        if (!Number.isFinite(n) || n < 0) { toast.error('Enter a valid USD amount'); setBusy(false); return }
        payload.allowance_usd = n
      }
      const res = await api.post(`/admin/users/${userId}/withdraw_access`, payload)
      toast.success(mode === 'allowance' ? `Allowance set: $${Number(allowance).toLocaleString('en-US')}` : mode === 'unlock' ? 'Withdrawals fully unlocked' : 'Withdrawal hold applied')
      onChanged && onChanged(res?.withdraw_access)
    } catch(e) { toast.error(e?.message || 'Update failed') } finally { setBusy(false) }
  }
  return (
    <div className={compact ? '' : 'p-4 rounded-xl border border-gold-500/25 bg-gradient-to-br from-gold-500/5 to-transparent'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {!compact && <div className="text-xs uppercase tracking-widest text-gold">External withdrawals · geolocation hold</div>}
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={locked ? 'border-red-500/40 text-red-400' : 'border-emerald-500/40 text-emerald-400'}>{locked ? 'On hold' : 'Unlocked'}</Badge>
            {locked && <span>Remaining allowance: <span className="text-gold font-mono">${(Number(access?.withdraw_allowance_usd) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></span>}
            {locked && access?.withdraw_lock?.since && <span>· since {new Date(access.withdraw_lock.since).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Allow up to (USD)</Label>
          <Input type="number" step="any" min="0" value={allowance} onChange={e => setAllowance(e.target.value)} placeholder="e.g. 500" className="mt-1 bg-secondary border-gold-500/20 h-10 font-mono" data-testid={`wa-allowance-${userId}`}/>
        </div>
        <Button size="sm" onClick={() => send('allowance')} disabled={busy || allowance === ''} className="gold-btn h-10 rounded-lg" data-testid={`wa-set-${userId}`}>Set allowance</Button>
        <Button size="sm" variant="outline" onClick={() => send('unlock')} disabled={busy} className="h-10 rounded-lg border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" data-testid={`wa-unlock-${userId}`}>Unlock fully</Button>
        {!locked && <Button size="sm" variant="outline" onClick={() => send('lock')} disabled={busy} className="h-10 rounded-lg border-red-500/40 text-red-400 hover:bg-red-500/10">Apply hold</Button>}
      </div>
      <div className="text-[10px] text-muted-foreground mt-2">The allowance is a USD-equivalent cap consumed as the user withdraws. "Unlock fully" verifies geolocation and removes the hold permanently for this user.</div>
    </div>
  )
}

export function WithdrawAccessAdmin() {
  const { api, tick } = useApp()
  const [data, setData] = useState({ attempts: [], on_hold: [], open: 0 })
  const [filter, setFilter] = useState('open')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get(`/admin/withdraw-attempts?status=${filter}`)
      setData({ attempts: Array.isArray(res?.attempts) ? res.attempts : [], on_hold: Array.isArray(res?.on_hold) ? res.on_hold : [], open: Number(res?.open) || 0 })
      setError('')
    } catch(e) { setError(e?.message || 'Failed to load') } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [filter])
  useEffect(() => { load(true) }, [tick])
  const name = (u, a) => u?.full_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || a?.full_name || u?.username || a?.username || a?.email || '—'
  const attemptUserIds = new Set(data.attempts.map(a => a.user_id))
  const holdOnly = data.on_hold.filter(u => !attemptUserIds.has(u.id))

  return (
    <div className="space-y-4">
      <div className="card-luxury rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-xl">Withdrawal access · geolocation hold</div>
            <div className="text-xs text-muted-foreground mt-1">Users are placed on hold automatically when a card is approved. Blocked attempts appear here — decide how much each user may withdraw, or unlock them fully.</div>
          </div>
          <div className="flex items-center gap-2">
            {[['open', 'Open alerts'], ['resolved', 'Resolved'], ['all', 'All']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${filter === v ? 'border-gold-500/60 bg-gold-500/10 text-gold' : 'border-gold-500/20 text-muted-foreground hover:text-gold'}`}>{l}{v === 'open' && data.open > 0 ? ` (${data.open})` : ''}</button>
            ))}
            <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-7 px-2"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}/></Button>
          </div>
        </div>
      </div>

      {error && <div className="card-luxury rounded-2xl p-5 border border-red-500/30 text-sm text-red-400">Could not load: {error} <Button size="sm" variant="outline" onClick={() => load()} className="ml-3 border-gold-500/40">Retry</Button></div>}
      {loading && !error && <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>}

      {!loading && !error && (
        <>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Blocked attempts ({data.attempts.length})</div>
          {data.attempts.length === 0 && <div className="text-muted-foreground text-sm">No {filter === 'all' ? '' : filter + ' '}blocked withdrawal attempts.</div>}
          {data.attempts.map(a => (
            <div key={a.id} data-testid={`wa-attempt-${a.id}`} className={`card-luxury rounded-2xl p-5 ${a.status === 'open' ? 'border border-red-500/20' : ''}`}>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
                <div className="col-span-2">
                  <div className="text-muted-foreground uppercase text-[10px]">User</div>
                  <div className="font-medium truncate">{name(a.user, a)}</div>
                  <div className="text-muted-foreground truncate">@{a.user?.username || a.username || '—'} · {a.user?.email || a.email || ''}</div>
                </div>
                <div><div className="text-muted-foreground uppercase text-[10px]">Tried to withdraw</div><div className="font-mono">{a.amount} {a.currency}</div><div className="text-muted-foreground">≈ ${Number(a.amount_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></div>
                <div><div className="text-muted-foreground uppercase text-[10px]">Method</div><div className="truncate">{a.method || '—'}</div></div>
                <div><div className="text-muted-foreground uppercase text-[10px]">Attempts</div><div>{a.count || 1}× · last {a.last_at ? new Date(a.last_at).toLocaleString() : '—'}</div></div>
                <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><Badge variant="outline" className={a.status === 'open' ? 'border-red-500/40 text-red-400' : 'border-emerald-500/40 text-emerald-400'}>{a.status === 'open' ? 'Needs decision' : `Resolved · ${a.resolution || ''}${a.allowance_granted_usd != null ? ` $${a.allowance_granted_usd}` : ''}`}</Badge></div>
              </div>
              {a.status === 'open' && a.user && (
                <div className="mt-4 pt-4 border-t border-gold-500/10 space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">User's last known location</div>
                    <LocationSummary compact location={a.user.last_location}/>
                  </div>
                  <WithdrawAccessControls compact userId={a.user_id} access={a.user} onChanged={() => load(true)} />
                </div>
              )}
            </div>
          ))}

          {holdOnly.length > 0 && (
            <>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-6">Users currently on hold without a blocked attempt ({holdOnly.length})</div>
              {holdOnly.map(u => (
                <div key={u.id} className="card-luxury rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-medium">{name(u)}</div>
                      <div className="text-muted-foreground">@{u.username} · {u.email}</div>
                    </div>
                    <div className="text-muted-foreground">On hold since {u.withdraw_lock?.since ? new Date(u.withdraw_lock.since).toLocaleString() : '—'} · allowance <span className="text-gold font-mono">${(Number(u.withdraw_allowance_usd) || 0).toLocaleString('en-US')}</span></div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gold-500/10 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">User's last known location</div>
                      <LocationSummary compact location={u.last_location}/>
                    </div>
                    <WithdrawAccessControls compact userId={u.id} access={u} onChanged={() => load(true)} />
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
