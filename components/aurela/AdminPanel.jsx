'use client'

import { useEffect, useState } from 'react'
import { useApp, FIAT_META, CRYPTO_META, fmt } from './store'
import { AurelaWordmark } from './Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { LayoutDashboard, Users, ShieldCheck, Settings, Receipt, ScrollText, LogOut, Search, Snowflake, Ban, Trash2, Plus, Minus, Wallet, Sparkles, ChevronRight, Copy, Edit3, X, Save, Check } from 'lucide-react'
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

  const load = async () => {
    try { const { users } = await api.get('/admin/users' + (q ? `?q=${encodeURIComponent(q)}` : '')); setUsers(users) } catch(e) {}
  }
  useEffect(() => { load() }, [])

  const action = async (u, act) => {
    if (act === 'delete' && !confirm(`Delete ${u.username}? This is permanent.`)) return
    try { await api.post(`/admin/users/${u.id}/${act}`, {}); toast.success(`User ${act}`); load() } catch(e) { toast.error(e.message) }
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
              <tr key={u.id} className="hover:bg-gold-500/5">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.full_name || u.username}</div>
                  <div className="text-xs text-muted-foreground">@{u.username} · {u.email}</div>
                </td>
                <td className="px-4 py-3 text-xs"><Badge variant="outline" className={`${u.role==='admin'||u.role==='super_admin'?'border-gold-500 text-gold':'border-muted text-muted-foreground'}`}>{u.role}</Badge></td>
                <td className="px-4 py-3 text-xs"><Badge variant="outline" className={u.status==='active'?'border-emerald-500/40 text-emerald-400':u.status==='blocked'?'border-red-500/40 text-red-400':'border-yellow-500/40 text-yellow-400'}>{u.status}</Badge></td>
                <td className="px-4 py-3 text-xs"><Badge variant="outline" className={u.kyc_status==='approved'?'border-emerald-500/40 text-emerald-400':'border-muted text-muted-foreground'}>{u.kyc_status}</Badge></td>
                <td className="px-4 py-3">
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
                    {Object.keys(FIAT_META).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>
                    {Object.keys(CRYPTO_META).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
    </div>
  )
}

function KycAdmin() {
  const { api, tick } = useApp()
  const [list, setList] = useState([])
  const [open, setOpen] = useState(null) // { kyc, user }
  const load = async () => { try { const { kyc } = await api.get('/admin/kyc'); setList(kyc) } catch(e) {} }
  useEffect(() => { load() }, [])
  useEffect(() => { load() }, [tick])
  const openDetail = async (k) => {
    try {
      const res = await api.get(`/admin/kyc/${k.id}`)
      setOpen(res)
    } catch(e) { toast.error(e.message) }
  }
  const action = async (k, act) => { try { await api.post(`/admin/kyc/${k.id}/${act}`, {}); toast.success(`KYC ${act}d`); setOpen(null); load() } catch(e) { toast.error(e.message) } }

  return (
    <div className="space-y-3">
      {list.length === 0 && <div className="text-muted-foreground text-sm">No KYC submissions.</div>}
      {list.map(k => (
        <div key={k.id} className="card-luxury rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs flex-1 min-w-0">
            <div><div className="text-muted-foreground uppercase text-[10px]">Full name</div><div className="truncate">{k.full_name || `${k.first_name || ''} ${k.last_name || ''}`.trim() || '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Country</div><div>{k.country || '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Mobile</div><div>{k.mobile || '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Document</div><div className="truncate">{k.id_type}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><Badge variant="outline" className={k.status==='approved'?'border-emerald-500/40 text-emerald-400':k.status==='rejected'?'border-red-500/40 text-red-400':'border-gold-500/40 text-gold'}>{k.status}</Badge></div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={()=>openDetail(k)} className="border-gold-500/40">Open review</Button>
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
              {open.kyc?.status === 'pending' ? (
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => action(open.kyc, 'reject')} className="border-red-500/40 text-red-400 hover:bg-red-500/10">Reject</Button>
                  <Button onClick={() => action(open.kyc, 'approve')} className="gold-btn">Approve KYC</Button>
                </DialogFooter>
              ) : (
                <div className="text-center text-xs text-muted-foreground">This KYC has already been {open.kyc?.status}.</div>
              )}
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
    enabled_fiat: [], enabled_crypto: []
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
                  <span>{FIAT_META[c]?.flag}</span>
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
                <div className="text-sm font-mono">{c}</div>
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

function WithdrawalsAdmin() {
  const { api, tick } = useApp()
  const [list, setList] = useState([])
  const [filter, setFilter] = useState('pending')
  const load = async () => { try { const { withdrawals } = await api.get('/admin/withdrawals'); setList(withdrawals) } catch(e) {} }
  useEffect(() => { load() }, [])
  useEffect(() => { load() }, [tick])
  const action = async (w, act) => {
    try { await api.post(`/admin/withdrawals/${w.id}/${act}`, {}); toast.success(`Withdrawal ${act}d`); load() }
    catch(e) { toast.error(e.message) }
  }
  const filtered = list.filter(w => filter === 'all' ? true : w.status === filter)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['pending','approved','rejected','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs capitalize ${filter===f?'gold-btn':'border border-gold-500/25 text-muted-foreground'}`}>{f}</button>
        ))}
      </div>
      {filtered.length === 0 && <div className="text-muted-foreground text-sm">No withdrawal requests.</div>}
      <div className="space-y-3">
        {filtered.map(w => (
          <div key={w.id} className="card-luxury rounded-2xl p-5 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
              <div><div className="text-muted-foreground uppercase text-[10px]">User</div><div className="truncate">{w.username || w.user_id}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Method</div><div>{w.method}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Amount</div><div className="font-mono text-gold">{fmt(w.amount, w.currency)}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Network</div><div>{w.network || '—'}</div></div>
              <div className="md:col-span-2"><div className="text-muted-foreground uppercase text-[10px]">Destination</div><div className="font-mono text-[10px] break-all">{w.destination || '—'}</div></div>
            </div>
            {w.details && Object.keys(w.details).length > 0 && (
              <div className="pt-2 border-t border-gold-500/10">
                <div className="text-[10px] uppercase text-muted-foreground mb-2">Payment details</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {Object.entries(w.details).map(([k, v]) => (
                    <div key={k}><div className="text-muted-foreground text-[10px] uppercase">{k.replace(/_/g,' ')}</div><div className="font-mono text-[11px] break-all">{String(v)}</div></div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={w.status==='approved'?'border-emerald-500/40 text-emerald-400':w.status==='rejected'?'border-red-500/40 text-red-400':'border-gold-500/40 text-gold'}>{w.status}</Badge>
                {w.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={()=>action(w,'approve')} className="gold-btn">Approve & release</Button>
                    <Button size="sm" variant="outline" onClick={()=>action(w,'reject')} className="border-red-500/40 text-red-400">Reject & refund</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DepositsAdmin() {
  const { api, tick } = useApp()
  const [list, setList] = useState([])
  const [filter, setFilter] = useState('pending')
  const load = async () => { try { const { deposits } = await api.get('/admin/deposits'); setList(deposits) } catch(e) {} }
  useEffect(() => { load() }, [])
  useEffect(() => { load() }, [tick])
  const action = async (d, act) => {
    try { await api.post(`/admin/deposits/${d.id}/${act}`, {}); toast.success(`Deposit ${act}d`); load() }
    catch(e) { toast.error(e.message) }
  }
  const filtered = list.filter(d => filter === 'all' ? true : d.status === filter)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['pending','approved','rejected','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs capitalize ${filter===f?'gold-btn':'border border-gold-500/25 text-muted-foreground'}`}>{f}</button>
        ))}
      </div>
      {filtered.length === 0 && <div className="text-muted-foreground text-sm">No deposit requests.</div>}
      <div className="space-y-3">
        {filtered.map(d => (
          <div key={d.id} className="card-luxury rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs flex-1 min-w-0">
              <div><div className="text-muted-foreground uppercase text-[10px]">User</div><div className="truncate">{d.to_username || d.user_id}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Method</div><div>{d.method}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Amount</div><div className="font-mono">{fmt(d.amount, d.currency)}</div></div>
              <div className="col-span-2"><div className="text-muted-foreground uppercase text-[10px]">Tx / Note</div><div className="font-mono text-[10px] break-all">{d.tx_hash || d.note || '—'}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><Badge variant="outline" className={d.status==='approved'?'border-emerald-500/40 text-emerald-400':d.status==='rejected'?'border-red-500/40 text-red-400':'border-gold-500/40 text-gold'}>{d.status}</Badge></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Submitted</div><div>{new Date(d.created_at).toLocaleString()}</div></div>
            </div>
            {d.status === 'pending' && (
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={()=>action(d,'approve')} className="gold-btn">Approve & credit</Button>
                <Button size="sm" variant="outline" onClick={()=>action(d,'reject')} className="border-red-500/40 text-red-400">Reject</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CardApprovalsAdmin() {
  const { api, tick } = useApp()
  const [list, setList] = useState([])
  const load = async () => { try { const { cards } = await api.get('/admin/cards'); setList(cards) } catch(e) {} }
  useEffect(() => { load() }, [])
  useEffect(() => { load() }, [tick])
  const action = async (c, act, activate_now=false) => {
    try { await api.post(`/admin/cards/${c.id}/${act}`, { activate_now }); toast.success(`Card ${act}d`); load() }
    catch(e) { toast.error(e.message) }
  }
  const del = async (c) => {
    if (typeof window !== 'undefined' && !window.confirm('Permanently delete this card record?')) return
    try { await api.del(`/admin/cards/${c.id}`); toast.success('Card deleted'); load() } catch(e) { toast.error(e.message) }
  }
  return (
    <div className="space-y-3">
      {list.length === 0 && <div className="text-muted-foreground text-sm">No pending card activations.</div>}
      {list.map(c => (
        <div key={c.id} className="card-luxury rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs flex-1 min-w-0">
            <div><div className="text-muted-foreground uppercase text-[10px]">User</div><div className="truncate">{c.user_id}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Tier</div><div className="capitalize">{c.tier}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Fee</div><div className="font-mono">{c.activation_fee_usdt} USDT</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Network</div><div>{c.activation_network_used || c.activation_network}</div></div>
            <div className="col-span-2 md:col-span-1"><div className="text-muted-foreground uppercase text-[10px]">Tx hash</div><div className="font-mono text-[10px] break-all">{c.activation_tx_hash || '—'}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><Badge variant="outline" className="border-gold-500/40 text-gold">{c.status}</Badge></div>
          </div>
          {(c.status === 'pending_verification' || c.status === 'pending_activation') && (
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <Button size="sm" onClick={()=>action(c,'approve')} className="gold-btn">Approve (24h)</Button>
              <Button size="sm" onClick={()=>action(c,'approve', true)} variant="outline" className="border-gold-500/40">Activate now</Button>
              <Button size="sm" variant="outline" onClick={()=>action(c,'reject')} className="border-red-500/40 text-red-400">Reject</Button>
              <Button size="sm" variant="ghost" onClick={()=>del(c)} className="text-red-400 hover:bg-red-500/10">Delete</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

