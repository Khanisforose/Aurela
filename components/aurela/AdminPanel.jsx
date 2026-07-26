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
  const { api } = useApp()
  const [data, setData] = useState(null)
  useEffect(() => { api.get('/admin/overview').then(setData).catch(()=>{}) }, [])
  const cards = [
    { k: 'Users', v: data?.users ?? '—' },
    { k: 'Transactions', v: data?.transactions ?? '—' },
    { k: 'Cards issued', v: data?.cards ?? '—' },
    { k: 'KYC pending', v: data?.kyc_pending ?? '—' },
  ]
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((c, i) => (
        <div key={i} className="card-luxury rounded-2xl p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.k}</div>
          <div className="font-display text-4xl mt-2 gold-text">{c.v}</div>
        </div>
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
  const { api } = useApp()
  const [list, setList] = useState([])
  const load = async () => { try { const { kyc } = await api.get('/admin/kyc'); setList(kyc) } catch(e) {} }
  useEffect(() => { load() }, [])
  const action = async (k, act) => { try { await api.post(`/admin/kyc/${k.id}/${act}`, {}); toast.success(`KYC ${act}d`); load() } catch(e) { toast.error(e.message) } }

  return (
    <div className="space-y-3">
      {list.length === 0 && <div className="text-muted-foreground text-sm">No submissions.</div>}
      {list.map(k => (
        <div key={k.id} className="card-luxury rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs flex-1">
            <div><div className="text-muted-foreground uppercase text-[10px]">Name</div><div>{k.full_name}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Country</div><div>{k.country}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">DOB</div><div>{k.dob}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">ID</div><div>{k.id_type} · {k.id_number}</div></div>
            <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><div><Badge variant="outline" className={k.status==='approved'?'border-emerald-500/40 text-emerald-400':k.status==='rejected'?'border-red-500/40 text-red-400':'border-gold-500/40 text-gold'}>{k.status}</Badge></div></div>
          </div>
          {k.status === 'pending' && (
            <div className="flex gap-2">
              <Button size="sm" onClick={()=>action(k,'approve')} className="gold-btn">Approve</Button>
              <Button size="sm" variant="outline" onClick={()=>action(k,'reject')} className="border-red-500/40 text-red-400">Reject</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TxAdmin() {
  const { api } = useApp()
  const [txs, setTxs] = useState([])
  useEffect(() => { api.get('/admin/transactions').then(({transactions}) => setTxs(transactions)).catch(()=>{}) }, [])
  return (
    <div className="card-luxury rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gold-500/5 text-xs uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">From</th>
            <th className="px-4 py-3 text-left">To</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Time</th>
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
              <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {txs.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">No transactions.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function SettingsAdmin() {
  const { api } = useApp()
  const [s, setS] = useState(null)
  const [form, setForm] = useState({ card_activation_wallet: '', card_activation_network: 'ERC20', card_activation_fees: { basic: 10, premium: 50, elite: 200 } })

  useEffect(() => { api.get('/admin/settings').then(({settings}) => { setS(settings); setForm({ card_activation_wallet: settings.card_activation_wallet, card_activation_network: settings.card_activation_network, card_activation_fees: settings.card_activation_fees }) }).catch(()=>{}) }, [])

  const save = async () => {
    try {
      const upd = await api.put('/admin/settings', form)
      toast.success('Settings saved')
      setS(upd.settings)
    } catch(e) { toast.error(e.message) }
  }

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
          <Button onClick={save} className="gold-btn w-full h-11 rounded-xl">Save settings</Button>
        </div>
      </div>

      <div className="card-luxury rounded-2xl p-6">
        <div className="font-display text-2xl">Currencies</div>
        <div className="text-sm text-muted-foreground">Enabled currencies for the platform.</div>
        <div className="mt-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Fiat</div>
          <div className="flex flex-wrap gap-2 mt-2">{s.enabled_fiat.map(c => <Badge key={c} variant="outline" className="border-gold-500/40 text-gold">{FIAT_META[c]?.flag} {c}</Badge>)}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-4">Crypto</div>
          <div className="flex flex-wrap gap-2 mt-2">{s.enabled_crypto.map(c => <Badge key={c} variant="outline" className="border-gold-500/40 text-gold">{c}</Badge>)}</div>
        </div>
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

