'use client'

import { useEffect, useMemo, useState } from 'react'
import { useApp } from './store'
import { ZonalCardVisual, ZONE_THEMES, ZONE_THEME_KEYS } from './ZonalCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { RefreshCw, Loader2, Search, MapPin, Clock, Coins, Edit3, Send, ShieldCheck, ShieldAlert, Globe2, CreditCard, Trash2, AlertTriangle } from 'lucide-react'

const fmtHours = (h) => {
  const n = Number(h) || 0
  if (n <= 0) return 'Instant'
  if (n === 1) return '1 hour'
  if (n < 48 || n % 24 !== 0) return `${n} hours`
  return `${n / 24} days`
}
const statusLabel = (s) => s === 'pending_verification' ? 'Awaiting verification' : s === 'pending_activation' ? 'Awaiting payment' : s === 'activating' ? 'Activating' : s === 'active' ? 'Active' : s === 'rejected' ? 'Rejected' : s
const statusClass = (s) => s === 'active' ? 'border-gold-500 text-gold' : s === 'activating' ? 'border-blue-500/50 text-blue-400' : s === 'pending_verification' ? 'border-gold-500/40 text-gold' : s === 'rejected' ? 'border-red-500/40 text-red-400' : 'border-muted text-muted-foreground'
const ownerName = (u) => u?.full_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || '—'

export function ZonalCardsAdmin() {
  const { api, tick } = useApp()
  const [zones, setZones] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)   // zone being edited
  const [issueOpen, setIssueOpen] = useState(false)
  const [zoneFilter, setZoneFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [z, c] = await Promise.all([
        api.get('/admin/zones'),
        api.get(`/admin/zones/cards?zone=${encodeURIComponent(zoneFilter)}&status=${encodeURIComponent(statusFilter)}`),
      ])
      setZones(Array.isArray(z?.zones) ? z.zones : [])
      setCards(Array.isArray(c?.cards) ? c.cards : [])
      setError('')
    } catch (e) { setError(e?.message || 'Failed to load zonal cards') }
    finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [zoneFilter, statusFilter])
  useEffect(() => { if (!editing && !issueOpen) load(true) }, [tick])

  const toggleZone = async (z, enabled) => {
    try {
      const res = await api.put(`/admin/zones/${z.code}`, { enabled })
      setZones(zs => zs.map(x => x.code === z.code ? { ...x, ...res.zone } : x))
      toast.success(`${z.name} ${enabled ? 'enabled' : 'disabled'}`)
    } catch (e) { toast.error(e?.message || 'Update failed') }
  }
  const delCard = async (c) => {
    if (typeof window !== 'undefined' && !window.confirm(`Permanently delete this ${c.zone_name} card for ${ownerName(c.user)}?`)) return
    try { await api.del(`/admin/cards/${c.id}`); toast.success('Card deleted'); load(true) } catch (e) { toast.error(e?.message || 'Delete failed') }
  }

  const totals = useMemo(() => zones.reduce((a, z) => ({ total: a.total + (z.stats?.total || 0), active: a.active + (z.stats?.active || 0), pending: a.pending + (z.stats?.pending || 0) }), { total: 0, active: 0, pending: 0 }), [zones])

  return (
    <div className="space-y-6" data-testid="zonal-cards-admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-2xl">Zonal cards</div>
          <div className="text-sm text-muted-foreground max-w-2xl hidden sm:block">
            Geolocation-based cards, one design per region. Set each zone's activation fee (USDT) and activation time — the number you enter is in <span className="text-gold">hours</span> (5 = 5 hours, 40 = 40 hours). Only admins can see and issue these; zonal cards do not trigger the geolocation withdrawal hold.
          </div>
          <div className="text-xs text-muted-foreground sm:hidden">One card design per region. Fee in USDT, activation time in <span className="text-gold">hours</span>. Admin-only; no geo withdrawal hold.</div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-10 sm:h-9 shrink-0"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}/></Button>
          <Button onClick={() => setIssueOpen(true)} className="gold-btn rounded-full h-10 sm:h-9 flex-1 sm:flex-none" data-testid="zonal-issue-btn"><Send className="h-4 w-4 mr-2"/> Issue zonal card</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[['Zones', zones.filter(z => z.enabled).length + ' / ' + zones.length, 'enabled'], ['Issued', totals.total, 'all zones'], ['Active', totals.active, `${totals.pending} pending`]].map(([l, v, s]) => (
          <div key={l} className="card-luxury rounded-2xl p-3 sm:p-4 min-w-0">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground truncate">{l}</div>
            <div className="font-display text-xl sm:text-2xl gold-text mt-1 truncate">{v}</div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{s}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="card-luxury rounded-2xl p-5 border border-red-500/30 text-sm">
          <div className="text-red-400">Could not load zonal cards: {error}</div>
          <Button size="sm" variant="outline" onClick={() => load()} className="mt-3 border-gold-500/40">Retry</Button>
        </div>
      )}
      {loading && !error && <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading zones…</div>}

      {/* Zones grid */}
      {!loading && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {zones.map(z => (
            <div key={z.code} className={`card-luxury rounded-2xl p-4 ${z.enabled ? '' : 'opacity-60'}`} data-testid={`zone-tile-${z.code}`}>
              <ZonalCardVisual zone={z} compact/>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display text-lg leading-tight truncate">{z.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><MapPin className="h-3 w-3"/>{z.landmark}{z.city ? ` · ${z.city}` : ''} · {z.countries?.length || 0} countries</div>
                </div>
                <Switch checked={!!z.enabled} onCheckedChange={v => toggleZone(z, v)} data-testid={`zone-toggle-${z.code}`}/>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-secondary/60 p-2"><div className="text-[9px] uppercase text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3"/>Fee</div><div className="font-mono text-gold mt-0.5">{z.fee_usdt} USDT</div></div>
                <div className="rounded-lg bg-secondary/60 p-2"><div className="text-[9px] uppercase text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3"/>Activation</div><div className="mt-0.5">{fmtHours(z.activation_hours)}</div></div>
                <div className="rounded-lg bg-secondary/60 p-2"><div className="text-[9px] uppercase text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3"/>Issued</div><div className="mt-0.5">{z.stats?.total || 0} <span className="text-muted-foreground">· {z.stats?.active || 0} active</span></div></div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(z)} className="mt-3 w-full border-gold-500/40" data-testid={`zone-edit-${z.code}`}><Edit3 className="h-3.5 w-3.5 mr-2"/> Edit zone</Button>
            </div>
          ))}
        </div>
      )}

      {/* Issued cards */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-display text-xl">Issued zonal cards</div>
          <div className="flex gap-2">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="h-9 w-40 bg-secondary border-gold-500/20 text-xs"><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All zones</SelectItem>{zones.map(z => <SelectItem key={z.code} value={z.code}>{z.code} · {z.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-44 bg-secondary border-gold-500/20 text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                {[['all', 'All statuses'], ['pending_activation', 'Awaiting payment'], ['pending_verification', 'Awaiting verification'], ['activating', 'Activating'], ['active', 'Active'], ['rejected', 'Rejected']].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!loading && cards.length === 0 && <div className="text-sm text-muted-foreground">No zonal cards issued yet.</div>}
        {cards.map(c => (
          <div key={c.id} className="card-luxury rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-4" data-testid={`zonal-card-row-${c.id}`}>
            <div className="w-full lg:w-56 shrink-0"><ZonalCardVisual card={{ ...c, cvv: '•••' }} compact/></div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs flex-1 min-w-0">
              <div className="col-span-2">
                <div className="text-muted-foreground uppercase text-[10px]">Holder</div>
                <div className="truncate font-medium">{ownerName(c.user)}</div>
                <div className="truncate text-muted-foreground">@{c.user?.username || '—'} · {c.user?.email || c.user_id}</div>
              </div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Zone</div><div>{c.zone} · {c.zone_name}</div>{c.zone_override && <div className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Detected {c.detected_zone || '—'}</div>}</div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Fee · Activation</div><div className="font-mono">{c.activation_fee_usdt} USDT</div><div className="text-muted-foreground">{fmtHours(c.activation_hours)}</div></div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Issued</div><div className="truncate">{c.issued_at ? new Date(c.issued_at).toLocaleString() : '—'}</div>{c.usable_at && c.status === 'activating' && <div className="text-blue-400">Unlocks {new Date(c.usable_at).toLocaleString()}</div>}</div>
              <div><div className="text-muted-foreground uppercase text-[10px]">Status</div><Badge variant="outline" className={statusClass(c.status)}>{statusLabel(c.status)}</Badge></div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => delCard(c)} className="border-red-500/40 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5"/></Button>
            </div>
          </div>
        ))}
        {cards.some(c => c.status === 'pending_verification') && (
          <div className="text-[11px] text-muted-foreground">Cards awaiting verification are approved from <span className="text-gold">Card Approvals</span> — the activation timer uses the hours set here.</div>
        )}
      </div>

      <ZoneEditDialog zone={editing} onClose={() => setEditing(null)} onSaved={(z) => { setZones(zs => zs.map(x => x.code === z.code ? { ...x, ...z } : x)); setEditing(null) }}/>
      <IssueZonalCardDialog open={issueOpen} zones={zones} onClose={() => setIssueOpen(false)} onIssued={() => { setIssueOpen(false); load(true) }}/>
    </div>
  )
}

function ZoneEditDialog({ zone, onClose, onSaved }) {
  const { api } = useApp()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (zone) setForm({ name: zone.name || '', landmark: zone.landmark || '', city: zone.city || '', image_url: zone.image_url || '', theme: zone.theme || 'steel', fee_usdt: String(zone.fee_usdt ?? ''), activation_hours: String(zone.activation_hours ?? ''), enabled: !!zone.enabled, countries: (zone.countries || []).join(', ') })
  }, [zone])
  const save = async () => {
    if (!form) return
    const fee = Number(form.fee_usdt), hours = Number(form.activation_hours)
    if (!Number.isFinite(fee) || fee < 0) return toast.error('Fee must be a number ≥ 0')
    if (!Number.isFinite(hours) || hours < 0) return toast.error('Activation time must be a number of hours ≥ 0')
    setSaving(true)
    try {
      const res = await api.put(`/admin/zones/${zone.code}`, {
        name: form.name, landmark: form.landmark, city: form.city, image_url: form.image_url, theme: form.theme,
        fee_usdt: fee, activation_hours: hours, enabled: form.enabled,
        countries: form.countries.split(/[\s,]+/).filter(Boolean),
      })
      toast.success(`${res.zone?.name || zone.name} updated`)
      onSaved(res.zone)
    } catch (e) { toast.error(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }
  const preview = form ? { code: zone?.code, name: form.name, landmark: form.landmark, city: form.city, theme: form.theme, image_url: form.image_url } : null
  return (
    <Dialog open={!!zone} onOpenChange={v => !v && !saving && onClose()}>
      <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="zone-edit-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Edit zone · {zone?.code}</DialogTitle>
          <DialogDescription>Fee is charged in USDT. Activation time is a plain number of hours — e.g. 5 = 5 hours, 40 = 40 hours, 0 = instant.</DialogDescription>
        </DialogHeader>
        {form && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Activation fee (USDT)</Label>
                <Input type="number" min="0" step="any" value={form.fee_usdt} onChange={e => setForm({ ...form, fee_usdt: e.target.value })} className="mt-1.5 bg-secondary border-gold-500/20 h-10 font-mono" data-testid="zone-fee-input"/>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Activation time (hours)</Label>
                <Input type="number" min="0" step="1" value={form.activation_hours} onChange={e => setForm({ ...form, activation_hours: e.target.value })} className="mt-1.5 bg-secondary border-gold-500/20 h-10 font-mono" data-testid="zone-hours-input"/>
                <div className="text-[11px] text-muted-foreground mt-1">= {fmtHours(form.activation_hours)} after admin verifies the payment</div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                <div><div className="text-sm">Zone enabled</div><div className="text-[11px] text-muted-foreground">Disabled zones cannot be issued</div></div>
                <Switch checked={form.enabled} onCheckedChange={v => setForm({ ...form, enabled: v })}/>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Zone name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5 bg-secondary border-gold-500/20 h-10"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Landmark</Label>
                  <Input value={form.landmark} onChange={e => setForm({ ...form, landmark: e.target.value })} className="mt-1.5 bg-secondary border-gold-500/20 h-10"/>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">City</Label>
                  <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-1.5 bg-secondary border-gold-500/20 h-10"/>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Metal finish</Label>
                <Select value={form.theme} onValueChange={v => setForm({ ...form, theme: v })}>
                  <SelectTrigger className="mt-1.5 bg-secondary border-gold-500/20 h-10"><SelectValue/></SelectTrigger>
                  <SelectContent>{ZONE_THEME_KEYS.map(k => <SelectItem key={k} value={k}><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-white/30" style={{ background: `linear-gradient(135deg, ${ZONE_THEMES[k].a}, ${ZONE_THEMES[k].b})` }}/>{ZONE_THEMES[k].label}</span></SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Landmark image URL</Label>
                <Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" className="mt-1.5 bg-secondary border-gold-500/20 h-10 text-xs"/>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Countries (ISO codes)</Label>
                <Input value={form.countries} onChange={e => setForm({ ...form, countries: e.target.value })} className="mt-1.5 bg-secondary border-gold-500/20 h-10 text-xs font-mono"/>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Live preview</div>
              <ZonalCardVisual zone={preview}/>
              <div className="text-[11px] text-muted-foreground mt-3">This is exactly how the card appears on the user's Cards tab, with their name and card number.</div>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-gold-500/40">Cancel</Button>
          <Button onClick={save} disabled={saving} className="gold-btn" data-testid="zone-save-btn">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Save zone'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function IssueZonalCardDialog({ open, zones, onClose, onIssued }) {
  const { api } = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState(null)   // resolve payload
  const [resolving, setResolving] = useState(false)
  const [zone, setZone] = useState('')
  const [fee, setFee] = useState('')
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [overrideKyc, setOverrideKyc] = useState(false)
  const [issuing, setIssuing] = useState(false)

  useEffect(() => {
    if (!open) { setQ(''); setResults([]); setPicked(null); setZone(''); setFee(''); setHours(''); setNote(''); setOverrideKyc(false) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return }
      setSearching(true)
      try { const res = await api.get(`/admin/users?q=${encodeURIComponent(q.trim())}`); setResults((res?.users || []).filter(u => u.role !== 'admin' && u.role !== 'super_admin').slice(0, 8)) }
      catch (e) { /* ignore */ }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, open])

  const pick = async (u) => {
    setResolving(true)
    try {
      const res = await api.get(`/admin/zones/resolve?user_id=${encodeURIComponent(u.id)}`)
      setPicked(res)
      const z = res?.zone || zones.find(x => x.enabled) || zones[0]
      setZone(z?.code || '')
      setFee(z ? String(z.fee_usdt) : '')
      setHours(z ? String(z.activation_hours) : '')
      setResults([])
    } catch (e) { toast.error(e?.message || 'Could not resolve user location') }
    finally { setResolving(false) }
  }
  const onZoneChange = (code) => {
    setZone(code)
    const z = zones.find(x => x.code === code)
    if (z) { setFee(String(z.fee_usdt)); setHours(String(z.activation_hours)) }
  }
  const selectedZone = zones.find(x => x.code === zone)
  const issue = async () => {
    if (!picked?.user?.id || !zone) return toast.error('Pick a user and a zone')
    setIssuing(true)
    try {
      const res = await api.post('/admin/zones/issue', { user_id: picked.user.id, zone, fee_usdt: fee === '' ? undefined : Number(fee), activation_hours: hours === '' ? undefined : Number(hours), note: note || undefined, override_kyc: overrideKyc })
      toast.success(`${res.card?.tier_name || 'Zonal card'} issued to ${picked.user.username}`)
      onIssued(res.card)
    } catch (e) { toast.error(e?.message || 'Issue failed') }
    finally { setIssuing(false) }
  }
  const loc = picked?.location
  const alreadyHas = picked?.existing_zonal_cards?.some(c => c.zone === zone)

  return (
    <Dialog open={open} onOpenChange={v => !v && !issuing && onClose()}>
      <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-3xl max-h-[92vh] overflow-y-auto" data-testid="zonal-issue-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Issue a zonal card</DialogTitle>
          <DialogDescription>Pick a user — their zone is detected from their last known location. You can override the zone, fee and activation hours for this card only.</DialogDescription>
        </DialogHeader>

        {!picked && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground"/>
              <Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, username or email…" className="pl-9 bg-secondary border-gold-500/20 h-10" data-testid="zonal-user-search"/>
              {searching && <Loader2 className="h-4 w-4 absolute right-3 top-3 animate-spin text-muted-foreground"/>}
            </div>
            {resolving && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Resolving location…</div>}
            <div className="space-y-1.5">
              {results.map(u => (
                <button key={u.id} onClick={() => pick(u)} className="w-full text-left rounded-xl border border-gold-500/15 hover:border-gold-500/50 bg-secondary/40 px-3 py-2.5 flex items-center justify-between gap-3" data-testid={`zonal-user-result-${u.id}`}>
                  <div className="min-w-0">
                    <div className="text-sm truncate">{ownerName(u)} <span className="text-muted-foreground">@{u.username}</span></div>
                    <div className="text-[11px] text-muted-foreground truncate">{u.email} · {u.last_location?.country || u.country || 'location unknown'}</div>
                  </div>
                  <Badge variant="outline" className={u.kyc_status === 'approved' ? 'border-emerald-500/40 text-emerald-400' : 'border-muted text-muted-foreground'}>{u.kyc_status || 'unverified'}</Badge>
                </button>
              ))}
              {q.trim() && !searching && results.length === 0 && <div className="text-xs text-muted-foreground">No users match "{q}".</div>}
            </div>
          </div>
        )}

        {picked && (
          <div className="grid md:grid-cols-5 gap-5">
            <div className="md:col-span-3 space-y-4">
              <div className="rounded-xl border border-gold-500/20 bg-secondary/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{ownerName(picked.user)} <span className="text-muted-foreground">@{picked.user?.username}</span></div>
                    <div className="text-[11px] text-muted-foreground truncate">{picked.user?.email} · {picked.user?.user_code || ''}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setPicked(null)} className="text-xs h-7">Change</Button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-onyx-950/60 p-2">
                    <div className="text-[9px] uppercase text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3"/>Last location</div>
                    <div className="mt-0.5">{loc?.city ? `${loc.city}, ` : ''}{loc?.country || loc?.cc || 'Unknown'}</div>
                    <div className="text-[10px] text-muted-foreground">{loc?.source === 'gps' ? 'GPS' : loc?.source === 'ip' ? 'IP address' : loc?.source === 'profile' ? 'Profile country' : 'No fix yet'}{loc?.at ? ` · ${new Date(loc.at).toLocaleString()}` : ''}</div>
                  </div>
                  <div className="rounded-lg bg-onyx-950/60 p-2">
                    <div className="text-[9px] uppercase text-muted-foreground flex items-center gap-1"><Globe2 className="h-3 w-3"/>Detected zone</div>
                    <div className="mt-0.5">{picked.detected_zone ? `${picked.detected_zone} · ${picked.zone?.name}` : 'Not detected'}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {picked.user?.kyc_status === 'approved' ? <><ShieldCheck className="h-3 w-3 text-emerald-400"/>KYC approved</> : <><ShieldAlert className="h-3 w-3 text-amber-400"/>KYC {picked.user?.kyc_status || 'unverified'}</>}
                      {picked.geo_hold && <span className="text-amber-400">· on geo hold</span>}
                    </div>
                  </div>
                </div>
                {picked.existing_zonal_cards?.length > 0 && (
                  <div className="mt-2 text-[11px] text-muted-foreground">Already holds: {picked.existing_zonal_cards.map(c => `${c.zone} (${statusLabel(c.status)})`).join(', ')}</div>
                )}
              </div>

              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Zone</Label>
                <Select value={zone} onValueChange={onZoneChange}>
                  <SelectTrigger className="mt-1.5 bg-secondary border-gold-500/20 h-10" data-testid="zonal-zone-select"><SelectValue placeholder="Choose a zone"/></SelectTrigger>
                  <SelectContent>{zones.map(z => <SelectItem key={z.code} value={z.code} disabled={!z.enabled}>{z.code} · {z.name}{!z.enabled ? ' (disabled)' : ''}{picked.detected_zone === z.code ? ' — detected' : ''}</SelectItem>)}</SelectContent>
                </Select>
                {picked.detected_zone && zone && picked.detected_zone !== zone && <div className="text-[11px] text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Overriding detected zone {picked.detected_zone}</div>}
                {alreadyHas && <div className="text-[11px] text-red-400 mt-1">User already holds a card for this zone.</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Fee (USDT)</Label>
                  <Input type="number" min="0" step="any" value={fee} onChange={e => setFee(e.target.value)} className="mt-1.5 bg-secondary border-gold-500/20 h-10 font-mono" data-testid="zonal-fee-input"/>
                  {selectedZone && Number(fee) !== Number(selectedZone.fee_usdt) && <div className="text-[10px] text-muted-foreground mt-1">Zone default {selectedZone.fee_usdt} USDT</div>}
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Activation (hours)</Label>
                  <Input type="number" min="0" step="1" value={hours} onChange={e => setHours(e.target.value)} className="mt-1.5 bg-secondary border-gold-500/20 h-10 font-mono" data-testid="zonal-hours-input"/>
                  <div className="text-[10px] text-muted-foreground mt-1">= {fmtHours(hours)}{selectedZone && Number(hours) !== Number(selectedZone.activation_hours) ? ` · zone default ${fmtHours(selectedZone.activation_hours)}` : ''}</div>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Internal note (optional)</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Why this card is being issued…" className="mt-1.5 bg-secondary border-gold-500/20 h-10"/>
              </div>
              {picked.user?.kyc_status !== 'approved' && (
                <label className="flex items-start gap-2 text-xs text-amber-300/90 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 cursor-pointer">
                  <Checkbox checked={overrideKyc} onCheckedChange={v => setOverrideKyc(!!v)} className="mt-0.5"/>
                  <span>This user has not completed KYC. Issue the card anyway (they will still need KYC to pay the activation fee).</span>
                </label>
              )}
              <div className="text-[11px] text-muted-foreground">
                {Number(fee) === 0 ? <>No fee — the card goes straight into its {fmtHours(hours).toLowerCase()} activation window.</> : <>The user pays {fee || '…'} USDT on-chain; once you verify it in Card Approvals the card unlocks after {fmtHours(hours).toLowerCase()}. No geolocation withdrawal hold is applied.</>}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Card preview</div>
              {selectedZone ? <ZonalCardVisual zone={selectedZone} card={{ zone: selectedZone.code, zone_name: selectedZone.name, landmark: selectedZone.landmark, landmark_city: selectedZone.city, theme: selectedZone.theme, image_url: selectedZone.image_url, holder: ownerName(picked.user).toUpperCase(), number: '4260 •••• •••• ••••' }} compact/> : <div className="text-xs text-muted-foreground">Choose a zone to preview.</div>}
            </div>
          </div>
        )}

        {picked && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} disabled={issuing} className="border-gold-500/40">Cancel</Button>
            <Button onClick={issue} disabled={issuing || !zone || alreadyHas || !selectedZone?.enabled} className="gold-btn" data-testid="zonal-issue-confirm">{issuing ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Send className="h-4 w-4 mr-2"/>Issue card</>}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ZonalCardsAdmin
