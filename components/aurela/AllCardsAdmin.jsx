'use client'

import { useEffect, useMemo, useState } from 'react'
import { useApp } from './store'
import { ZonalCardVisual } from './ZonalCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { RefreshCw, Loader2, Search, Trash2, EyeOff, Eye, Sparkles, ChevronLeft, ChevronRight, Lock, MapPinned, CreditCard, ShieldCheck, Snowflake } from 'lucide-react'

// ---------- shared helpers ----------
export const cardStatusLabel = (s) => ({
  hidden: 'Hidden · locked', pending_activation: 'Awaiting payment', pending_verification: 'Awaiting verification',
  activating: 'Activating', active: 'Active', rejected: 'Rejected', deleted: 'Deleted by user',
}[s] || s)
export const cardStatusClass = (s) => ({
  hidden: 'border-violet-500/40 text-violet-300', active: 'border-gold-500 text-gold', activating: 'border-blue-500/50 text-blue-400',
  pending_verification: 'border-gold-500/40 text-gold', rejected: 'border-red-500/40 text-red-400', deleted: 'border-muted text-muted-foreground line-through',
}[s] || 'border-muted text-muted-foreground')
const ownerName = (u) => u?.full_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || '—'
const usd = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })

export function revealRuleText(r) {
  if (!r) return 'Shown immediately'
  const parts = []
  if (r.geo) parts.push('geo-hold allowance fully withdrawn')
  if (Number(r.amount_usd) > 0) parts.push(`${usd(r.amount_usd)} withdrawn`)
  return 'Unlocks when ' + parts.join(r.match === 'all' ? ' AND ' : ' OR ')
}

// Compact progress block for a hidden zonal card (used in Zonal Cards + All Cards tabs)
export function RevealProgress({ card, compact = false }) {
  const r = card?.reveal
  if (!r) return null
  const amt = Number(r.amount_usd) || 0
  const prog = Number(r.progress_usd) || 0
  const pct = amt > 0 ? Math.min(100, (prog / amt) * 100) : 0
  return (
    <div className={`space-y-1.5 ${compact ? '' : 'rounded-xl border border-violet-500/20 bg-violet-500/5 p-3'}`} data-testid={`reveal-progress-${card.id}`}>
      {!compact && <div className="text-[10px] uppercase tracking-widest text-violet-300 flex items-center gap-1"><Lock className="h-3 w-3"/>Unlock rule</div>}
      {amt > 0 && (
        <div>
          <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Approved withdrawals</span><span className="font-mono">{usd(prog)} / {usd(amt)}</span></div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-1"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-gold-500 transition-all duration-700" style={{ width: `${pct}%` }}/></div>
        </div>
      )}
      {r.geo && (
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Geo-hold allowance</span>
          {r.geo_met_at ? <span className="text-emerald-400">Fully withdrawn ✓</span> : <span className="text-amber-300">{card.user?.withdraw_lock?.active ? `Pending · ${usd(card.user?.withdraw_allowance_usd)} left` : 'Waiting'}</span>}
        </div>
      )}
      {r.geo && amt > 0 && <div className="text-[10px] text-muted-foreground">{r.match === 'all' ? 'Both conditions required' : 'Whichever comes first'}</div>}
    </div>
  )
}

// Reveal rule editor (issue dialog + edit dialog)
export function RevealRuleEditor({ value, onChange, geoHold, allowanceUsd }) {
  const v = value || { geo: true, amount_usd: '', match: 'any' }
  const set = (patch) => onChange({ ...v, ...patch })
  const both = v.geo && Number(v.amount_usd) > 0
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 rounded-xl border border-gold-500/15 bg-secondary/40 p-3 cursor-pointer">
        <Checkbox checked={!!v.geo} onCheckedChange={c => set({ geo: !!c })} className="mt-0.5" data-testid="reveal-geo-checkbox"/>
        <div className="text-xs">
          <div className="font-medium text-sm">Geo-hold allowance fully withdrawn</div>
          <div className="text-muted-foreground mt-0.5">Reveals once the user has withdrawn the full allowance you set in Withdrawal Access (approved withdrawals only), or when you fully unlock their hold.</div>
          {geoHold === true && <div className="text-amber-300 mt-1">User is on geo hold · {usd(allowanceUsd)} allowance remaining</div>}
          {geoHold === false && <div className="text-amber-400 mt-1">This user is not on a geo hold right now. The card unlocks when you put them on hold with an allowance and they withdraw it all, or when you unlock their hold.</div>}
        </div>
      </label>
      <div className="rounded-xl border border-gold-500/15 bg-secondary/40 p-3">
        <div className="flex items-start gap-3">
          <Checkbox checked={!!(Number(v.amount_usd) > 0 || v._amountOn)} onCheckedChange={c => set(c ? { _amountOn: true } : { _amountOn: false, amount_usd: '' })} className="mt-0.5" data-testid="reveal-amount-checkbox"/>
          <div className="text-xs flex-1">
            <div className="font-medium text-sm">Withdrawal amount reached</div>
            <div className="text-muted-foreground mt-0.5">Reveals when the user's admin-approved withdrawals since issuance reach this USD amount.</div>
            {(v._amountOn || Number(v.amount_usd) > 0) && (
              <div className="relative mt-2 max-w-[220px]">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                <Input type="number" min="0" step="any" value={v.amount_usd} onChange={e => set({ amount_usd: e.target.value })} placeholder="e.g. 5000" className="pl-7 bg-onyx-950/60 border-gold-500/20 h-10 font-mono" data-testid="reveal-amount-input"/>
              </div>
            )}
          </div>
        </div>
      </div>
      {both && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">When both are set:</span>
          <Select value={v.match || 'any'} onValueChange={m => set({ match: m })}>
            <SelectTrigger className="h-9 w-56 bg-secondary border-gold-500/20 text-xs" data-testid="reveal-match-select"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Whichever comes first</SelectItem>
              <SelectItem value="all">Both must be met</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

// Tiny visual for tier cards in lists
function TierMini({ card }) {
  const grad = card.tier === 'elite' ? 'from-zinc-900 via-zinc-800 to-black' : card.tier === 'premium' ? 'from-amber-700 via-yellow-600 to-amber-900' : 'from-slate-700 via-slate-600 to-slate-900'
  return (
    <div className={`relative aspect-[1.586] w-full rounded-xl bg-gradient-to-br ${grad} p-3 text-white overflow-hidden ring-1 ring-gold-500/20`}>
      <div className="text-[9px] uppercase tracking-[0.25em] opacity-80">Aurela</div>
      <div className="font-display capitalize text-sm">{card.tier}</div>
      <div className="absolute bottom-2 left-3 font-mono text-[11px] tracking-widest">{card.number_masked || '•••• ••••'}</div>
      <CreditCard className="absolute top-3 right-3 h-4 w-4 opacity-70"/>
    </div>
  )
}

// ---------- All cards (admin) ----------
const STATUS_FILTERS = [['all', 'All'], ['hidden', 'Hidden'], ['pending_activation', 'Awaiting payment'], ['pending_verification', 'Awaiting verification'], ['activating', 'Activating'], ['active', 'Active'], ['rejected', 'Rejected'], ['frozen', 'Frozen'], ['deleted', 'Deleted by user']]

export function AllCardsAdmin() {
  const { api, tick } = useApp()
  const [q, setQ] = useState('')
  const [debQ, setDebQ] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ cards: [], total: 0, pages: 1, counts: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => { const t = setTimeout(() => { setDebQ(q.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [q])
  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get(`/admin/all-cards?q=${encodeURIComponent(debQ)}&type=${type}&status=${status}&page=${page}&limit=20`)
      setData({ cards: res?.cards || [], total: res?.total || 0, pages: res?.pages || 1, counts: res?.counts || {} })
      setError('')
    } catch (e) { setError(e?.message || 'Failed to load cards') }
    finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [debQ, type, status, page])
  useEffect(() => { if (!detail) load(true) }, [tick])

  const reveal = async (c) => {
    if (typeof window !== 'undefined' && !window.confirm(`Reveal this ${c.tier_name || 'card'} to ${ownerName(c.user)} now? They will be notified immediately.`)) return
    setBusyId(c.id)
    try { await api.post(`/admin/cards/${c.id}/reveal`, {}); toast.success('Card revealed — user notified'); setDetail(null); load(true) }
    catch (e) { toast.error(e?.message || 'Reveal failed') } finally { setBusyId(null) }
  }
  const del = async (c) => {
    if (typeof window !== 'undefined' && !window.confirm(`Permanently delete ${c.tier_name || c.tier} card (${c.number_masked || ''}) of ${ownerName(c.user)}? This cannot be undone.`)) return
    setBusyId(c.id)
    try { await api.del(`/admin/cards/${c.id}`); toast.success('Card deleted'); setDetail(null); load(true) }
    catch (e) { toast.error(e?.message || 'Delete failed') } finally { setBusyId(null) }
  }
  const counts = data.counts || {}
  const stat = useMemo(() => [
    ['Total cards', counts.total || 0, 'excluding user-deleted'],
    ['Active', (counts.active || 0) + (counts.activating || 0), `${counts.activating || 0} activating`],
    ['Hidden', counts.hidden || 0, 'waiting to unlock'],
    ['Pending', (counts.pending_activation || 0) + (counts.pending_verification || 0), `${counts.pending_verification || 0} to verify`],
  ], [counts])

  return (
    <div className="space-y-5" data-testid="all-cards-admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-2xl">All cards</div>
          <div className="text-sm text-muted-foreground hidden sm:block">Every Aurela and zonal card across all users, including hidden cards still waiting to unlock. Search by holder, email, Aurela ID, zone or the last 4 digits.</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-9"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}/></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {stat.map(([l, v, s]) => (
          <div key={l} className="card-luxury rounded-2xl p-3 sm:p-4 min-w-0">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground truncate">{l}</div>
            <div className="font-display text-xl sm:text-2xl gold-text mt-1">{v}</div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{s}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground"/>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search holder, email, Aurela ID, zone, last 4…" className="pl-9 bg-secondary border-gold-500/20 h-10" data-testid="all-cards-search"/>
        </div>
        <Select value={type} onValueChange={v => { setType(v); setPage(1) }}>
          <SelectTrigger className="h-10 sm:w-40 bg-secondary border-gold-500/20 text-xs" data-testid="all-cards-type"><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="tier">Aurela cards</SelectItem><SelectItem value="zonal">Zonal cards</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" data-testid="all-cards-status-chips">
        {STATUS_FILTERS.map(([v, l]) => {
          const n = v === 'all' ? counts.total : v === 'frozen' ? null : counts[v]
          return (
            <button key={v} onClick={() => { setStatus(v); setPage(1) }} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${status === v ? 'border-gold-500 bg-gold-500/10 text-gold' : 'border-gold-500/15 text-muted-foreground hover:border-gold-500/40'}`}>
              {l}{n != null ? <span className="ml-1.5 opacity-70">{n}</span> : null}
            </button>
          )
        })}
      </div>

      {error && <div className="card-luxury rounded-2xl p-4 border border-red-500/30 text-sm text-red-400">{error} <Button size="sm" variant="outline" onClick={() => load()} className="ml-2 border-gold-500/40">Retry</Button></div>}
      {loading && !error && <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading cards…</div>}
      {!loading && !error && data.cards.length === 0 && <div className="card-luxury rounded-2xl p-8 text-center text-sm text-muted-foreground">No cards match these filters.</div>}

      <div className="space-y-3">
        {!loading && data.cards.map(c => (
          <div key={c.id} className={`card-luxury rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-4 ${c.status === 'hidden' ? 'ring-1 ring-violet-500/25' : ''}`} data-testid={`all-card-row-${c.id}`}>
            <div className="w-full sm:w-56 lg:w-44 shrink-0 relative">
              {c.type === 'zonal' ? <ZonalCardVisual card={{ ...c, number: c.number_masked, cvv: '•••' }} compact/> : <TierMini card={c}/>}
              {c.status === 'hidden' && <div className="absolute inset-0 rounded-xl bg-onyx-950/55 backdrop-blur-[2px] flex items-center justify-center"><EyeOff className="h-6 w-6 text-violet-300"/></div>}
              {c.frozen && c.status !== 'hidden' && <div className="absolute inset-0 rounded-xl bg-onyx-950/50 flex items-center justify-center"><Snowflake className="h-6 w-6 text-gold"/></div>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs flex-1 min-w-0">
              <div className="col-span-2">
                <div className="text-muted-foreground uppercase text-[10px]">Holder</div>
                <div className="truncate font-medium">{ownerName(c.user)}</div>
                <div className="truncate text-muted-foreground">@{c.user?.username || '—'} · {c.user?.email || c.user_id}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase text-[10px]">Card</div>
                <div className="truncate">{c.type === 'zonal' ? <span className="text-gold inline-flex items-center gap-1"><MapPinned className="h-3 w-3"/>{c.zone} · {c.zone_name}</span> : <span className="capitalize">Aurela {c.tier}</span>}</div>
                <div className="text-muted-foreground font-mono">{c.number_masked || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase text-[10px]">Status</div>
                <Badge variant="outline" className={cardStatusClass(c.status)}>{cardStatusLabel(c.status)}</Badge>
                {c.frozen && c.status !== 'deleted' && <div className="text-[10px] text-gold mt-1">Frozen</div>}
              </div>
              <div>
                <div className="text-muted-foreground uppercase text-[10px]">{c.status === 'hidden' ? 'Unlock' : 'Created'}</div>
                {c.status === 'hidden' ? <RevealProgress card={c} compact/> : <div className="truncate">{new Date(c.created_at).toLocaleDateString()}</div>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0 justify-end">
              <Button size="sm" variant="outline" onClick={() => setDetail(c)} className="border-gold-500/40" data-testid={`all-card-view-${c.id}`}><Eye className="h-3.5 w-3.5 mr-1.5"/>View</Button>
              {c.status === 'hidden' && <Button size="sm" onClick={() => reveal(c)} disabled={busyId === c.id} className="gold-btn" data-testid={`all-card-reveal-${c.id}`}><Sparkles className="h-3.5 w-3.5 mr-1.5"/>Reveal</Button>}
              <Button size="sm" variant="outline" onClick={() => del(c)} disabled={busyId === c.id} className="border-red-500/40 text-red-400 hover:bg-red-500/10" data-testid={`all-card-delete-${c.id}`}><Trash2 className="h-3.5 w-3.5"/></Button>
            </div>
          </div>
        ))}
      </div>

      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="border-gold-500/40"><ChevronLeft className="h-4 w-4"/></Button>
          <span className="text-muted-foreground">Page {page} of {data.pages} · {data.total} cards</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages || loading} onClick={() => setPage(p => p + 1)} className="border-gold-500/40"><ChevronRight className="h-4 w-4"/></Button>
        </div>
      )}

      <CardDetailDialog card={detail} onClose={() => setDetail(null)} onReveal={reveal} onDelete={del} onUpdated={() => { load(true) }}/>
    </div>
  )
}

function CardDetailDialog({ card, onClose, onReveal, onDelete, onUpdated }) {
  const { api } = useApp()
  const [full, setFull] = useState(null)
  const [rule, setRule] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!card) { setFull(null); setRule(null); return }
    setFull(null)
    setRule(card.reveal ? { geo: !!card.reveal.geo, amount_usd: card.reveal.amount_usd ? String(card.reveal.amount_usd) : '', match: card.reveal.match || 'any', _amountOn: Number(card.reveal.amount_usd) > 0 } : null)
    api.get(`/admin/cards/${card.id}`).then(setFull).catch(() => setFull({ card }))
  }, [card?.id])
  const saveRule = async () => {
    setSaving(true)
    try {
      const res = await api.put(`/admin/cards/${card.id}/reveal-rule`, { geo: !!rule.geo, amount_usd: rule._amountOn ? Number(rule.amount_usd) || 0 : 0, match: rule.match })
      toast.success(res?.card?.status !== 'hidden' ? 'Rule met — card revealed to the user' : 'Unlock rule updated')
      onUpdated(); onClose()
    } catch (e) { toast.error(e?.message || 'Update failed') } finally { setSaving(false) }
  }
  const c = full?.card || card
  const u = full?.user || card?.user
  return (
    <Dialog open={!!card} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="all-card-detail">
        <DialogHeader>
          <DialogTitle className="font-display">{c?.tier_name || `Aurela ${c?.tier || ''}`}</DialogTitle>
          <DialogDescription>{ownerName(u)} · @{u?.username || '—'} · {u?.email || ''}</DialogDescription>
        </DialogHeader>
        {c && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cardStatusClass(c.status)}>{cardStatusLabel(c.status)}</Badge>
              {c.type === 'zonal' && <Badge variant="outline" className="border-gold-500/40 text-gold"><MapPinned className="h-3 w-3 mr-1"/>{c.zone} · {c.zone_name}</Badge>}
              {c.frozen && <Badge variant="outline" className="border-gold-500/40 text-gold"><Snowflake className="h-3 w-3 mr-1"/>Frozen</Badge>}
              {c.skip_geo_hold && <Badge variant="outline" className="border-emerald-500/40 text-emerald-400"><ShieldCheck className="h-3 w-3 mr-1"/>No geo hold</Badge>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm rounded-xl bg-secondary/60 p-4">
              {[
                ['Card number', c.number ? '•••• •••• •••• ' + String(c.number).replace(/\s/g, '').slice(-4) : c.number_masked],
                ['Holder', c.holder], ['Expiry', c.expiry],
                ['Activation fee', c.activation_fee_usdt != null ? `${c.activation_fee_usdt} USDT` : ''],
                ['Activation time', c.type === 'zonal' ? `${c.activation_hours ?? 0}h` : '24h'],
                ['Monthly limit', c.monthly_spend_limit ? usd(c.monthly_spend_limit) : ''],
                ['Created', c.created_at ? new Date(c.created_at).toLocaleString() : ''],
                ['Revealed', c.revealed_at ? new Date(c.revealed_at).toLocaleString() : (c.status === 'hidden' ? 'Not yet' : '')],
                ['Usable from', c.usable_at ? new Date(c.usable_at).toLocaleString() : ''],
              ].map(([l, v]) => (
                <div key={l} className="min-w-0"><div className="text-[10px] uppercase text-muted-foreground">{l}</div><div className="text-sm break-all">{v || <span className="text-muted-foreground">—</span>}</div></div>
              ))}
            </div>
            {c.issue_note && <div className="text-xs text-muted-foreground">Issue note: {c.issue_note}</div>}
            {c.activation_tx_hash && <div className="text-xs"><span className="text-muted-foreground">Last tx hash:</span> <span className="font-mono text-gold break-all">{c.activation_tx_hash}</span></div>}

            {c.status === 'hidden' && rule && (
              <div className="space-y-3">
                <RevealProgress card={{ ...c, user: { ...(card.user || {}), ...(u || {}) } }}/>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Edit unlock rule</div>
                <RevealRuleEditor value={rule} onChange={setRule} geoHold={u?.withdraw_lock ? !!u.withdraw_lock.active : card.user?.withdraw_lock ? !!card.user.withdraw_lock.active : undefined} allowanceUsd={card.user?.withdraw_allowance_usd}/>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => onDelete(card)} className="text-red-400 hover:bg-red-500/10 sm:mr-auto"><Trash2 className="h-4 w-4 mr-2"/>Delete card</Button>
          {c?.status === 'hidden' && <Button variant="outline" onClick={saveRule} disabled={saving || !rule || (!rule.geo && !(Number(rule.amount_usd) > 0))} className="border-gold-500/40">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Save rule'}</Button>}
          {c?.status === 'hidden' && <Button onClick={() => onReveal(card)} className="gold-btn"><Sparkles className="h-4 w-4 mr-2"/>Reveal now</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AllCardsAdmin
