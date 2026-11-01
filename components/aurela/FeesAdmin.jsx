'use client'

import { useEffect, useMemo, useState } from 'react'
import { useApp, fmt, FIAT_META, CRYPTO_META } from './store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { RefreshCw, Loader2, Plus, Trash2, Percent, Landmark, Coins, Calculator, TrendingUp, Clock, Save, RotateCcw, Info } from 'lucide-react'

const usd = (v, dp = 2) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
const usdShort = (v) => { const n = Number(v || 0); return n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : usd(n) }
const tierRange = (t, i) => t.max_usd === null || t.max_usd === undefined || t.max_usd === '' ? `≥ ${usdShort(t.min_usd)}` : i === 0 ? `< ${usdShort(t.max_usd)}` : `${usdShort(t.min_usd)} – ${usdShort(t.max_usd)}`
const ownerName = (u, fallback) => u?.full_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || fallback || '—'

export function FeesAdmin() {
  const { api } = useApp()
  const [tabView, setTabView] = useState('report') // report | schedule
  return (
    <div className="space-y-5" data-testid="fees-admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-2xl">Fees & treasury</div>
          <div className="text-sm text-muted-foreground max-w-2xl hidden sm:block">External withdrawal fees are deducted from the amount the user withdraws and collected into the Aurela treasury when an administrator releases the payout. Configure the tiered percentage, network / bank costs and per-currency overrides here.</div>
          <div className="text-xs text-muted-foreground sm:hidden">Fees are deducted from withdrawals and collected on approval.</div>
        </div>
        <div className="flex gap-1 rounded-full border border-gold-500/25 p-1 bg-secondary/40">
          {[['report', 'Revenue', TrendingUp], ['schedule', 'Fee schedule', Percent]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTabView(id)} className={`px-3.5 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition ${tabView === id ? 'gold-btn' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`fees-view-${id}`}><Icon className="h-3.5 w-3.5"/>{label}</button>
          ))}
        </div>
      </div>
      {tabView === 'report' ? <FeeReport api={api}/> : <FeeScheduleEditor api={api}/>}
    </div>
  )
}

/* ------------------------------- Revenue report ------------------------------- */
function FeeReport({ api }) {
  const { tick } = useApp()
  const [days, setDays] = useState('30')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try { setData(await api.get(`/admin/fees/report?days=${days}`)); setError('') }
    catch (e) { setError(e?.message || 'Failed to load fee report') }
    finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [days])
  useEffect(() => { load(true) }, [tick])
  const maxDay = useMemo(() => Math.max(1, ...(data?.by_day || []).map(d => d.usd)), [data])
  // Fill the day series so quiet days render as empty bars
  const series = useMemo(() => {
    const n = Number(days); const map = Object.fromEntries((data?.by_day || []).map(d => [d.day, d]))
    const out = []
    for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); out.push(map[d] || { day: d, usd: 0, count: 0 }) }
    return out
  }, [data, days])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-9 w-36 bg-secondary border-gold-500/20 text-xs" data-testid="fees-range"><SelectValue/></SelectTrigger>
          <SelectContent>{[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last 12 months']].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-9"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}/></Button>
      </div>
      {error && <div className="card-luxury rounded-2xl p-5 border border-red-500/30 text-sm text-red-400">{error}</div>}
      {loading && !data && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Collected', usd(data.range.usd), `${data.range.count} withdrawals · last ${data.days}d`, 'gold-text'],
              ['All-time', usd(data.all_time.usd), `${data.all_time.count} fee events`, ''],
              ['Pending', usd(data.pending.usd), `${data.pending.count} awaiting approval`, 'text-blue-300'],
              ['Effective rate', data.range.gross_usd > 0 ? `${((data.range.usd / data.range.gross_usd) * 100).toFixed(2)}%` : '—', `on ${usdShort(data.range.gross_usd)} gross`, ''],
            ].map(([l, v, s, cls]) => (
              <div key={l} className="card-luxury rounded-2xl p-4 min-w-0" data-testid={`fees-stat-${l.toLowerCase().replace(/[^a-z]/g, '')}`}>
                <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground truncate">{l}</div>
                <div className={`font-display text-xl sm:text-2xl mt-1 truncate ${cls}`}>{v}</div>
                <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{s}</div>
              </div>
            ))}
          </div>

          <div className="card-luxury rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Daily fee revenue (USD)</div>
              <div className="text-[10px] text-muted-foreground">peak {usd(maxDay === 1 && !series.some(s => s.usd > 0) ? 0 : maxDay)}</div>
            </div>
            <div className="flex items-end gap-[2px] h-28" data-testid="fees-chart">
              {series.map(d => (
                <div key={d.day} className="flex-1 group relative flex items-end h-full">
                  <div className="w-full rounded-t-sm bg-gradient-to-t from-gold-700/60 to-gold-400 transition-all" style={{ height: `${d.usd > 0 ? Math.max(4, (d.usd / maxDay) * 100) : 2}%`, opacity: d.usd > 0 ? 1 : 0.25 }}/>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-onyx-950 border border-gold-500/30 px-2 py-1 text-[10px] z-10">{d.day} · {usd(d.usd)} · {d.count}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>{series[0]?.day}</span><span>{series[series.length - 1]?.day}</span></div>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <div className="card-luxury rounded-2xl p-4 sm:p-5 lg:col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">By currency · last {data.days}d</div>
              {data.by_currency.length === 0 && <div className="text-sm text-muted-foreground">No fees collected in this period.</div>}
              <div className="space-y-2">
                {data.by_currency.map(c => (
                  <div key={c.currency} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0"><div className="font-medium">{c.currency}</div><div className="text-[11px] text-muted-foreground">{c.count} withdrawal{c.count === 1 ? '' : 's'}</div></div>
                    <div className="text-right"><div className="font-mono text-gold">{fmt(c.amount, c.currency)}</div><div className="text-[11px] text-muted-foreground">{usd(c.usd)}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card-luxury rounded-2xl p-4 sm:p-5 lg:col-span-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Recent fee collections</div>
              {data.recent.length === 0 && <div className="text-sm text-muted-foreground">Fees appear here once withdrawals are approved.</div>}
              <div className="divide-y divide-gold-500/10">
                {data.recent.slice(0, 25).map(e => (
                  <div key={e.id} className="py-2.5 flex items-center justify-between gap-3 text-xs" data-testid={`fee-entry-${e.id}`}>
                    <div className="min-w-0">
                      <div className="truncate">{ownerName(e.user, e.username)} <span className="text-muted-foreground">@{e.user?.username || e.username}</span></div>
                      <div className="text-muted-foreground truncate">{new Date(e.created_at).toLocaleString()} · {e.method}{e.network ? ` · ${e.network}` : ''} · gross {fmt(e.gross_amount, e.currency)}</div>
                    </div>
                    <div className="text-right shrink-0"><div className="font-mono text-gold">{fmt(e.amount, e.currency)}</div><div className="text-muted-foreground">{usd(e.amount_usd)}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------ Schedule editor ------------------------------ */
function FeeScheduleEditor({ api }) {
  const [schedule, setSchedule] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [railKeys, setRailKeys] = useState({ crypto: [], fiat: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [addCurrency, setAddCurrency] = useState('')
  const load = async () => {
    setLoading(true)
    try { const res = await api.get('/admin/fees/schedule'); setSchedule(res.schedule); setDefaults(res.defaults); setRailKeys(res.rail_keys || { crypto: [], fiat: [] }); setDirty(false) }
    catch (e) { toast.error(e?.message || 'Failed to load fee schedule') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const patch = (p) => { setSchedule(s => ({ ...s, ...p })); setDirty(true) }
  const setTier = (i, k, v) => { const tiers = schedule.tiers.map((t, j) => j === i ? { ...t, [k]: v } : t); patch({ tiers }) }
  const addTier = () => {
    const last = schedule.tiers[schedule.tiers.length - 1]
    const start = last?.max_usd ?? ((Number(last?.min_usd) || 0) * 10 || 100000)
    const tiers = schedule.tiers.map((t, i) => i === schedule.tiers.length - 1 && (t.max_usd === null || t.max_usd === undefined || t.max_usd === '') ? { ...t, max_usd: start } : t)
    patch({ tiers: [...tiers, { min_usd: start, max_usd: null, percent: Math.max(0, (Number(last?.percent) || 1) / 2), label: '' }] })
  }
  const removeTier = (i) => {
    if (schedule.tiers.length <= 1) return toast.error('Keep at least one tier')
    const tiers = schedule.tiers.filter((_, j) => j !== i)
    // Keep bounds contiguous: each tier starts where the previous ends; the last one is open-ended
    for (let j = 0; j < tiers.length; j++) { tiers[j] = { ...tiers[j], min_usd: j === 0 ? 0 : tiers[j - 1].max_usd }; if (j === tiers.length - 1) tiers[j].max_usd = null }
    patch({ tiers })
  }
  const setTierMax = (i, v) => {
    const max = v === '' ? null : Number(v)
    const tiers = schedule.tiers.map((t, j) => j === i ? { ...t, max_usd: max } : (j === i + 1 ? { ...t, min_usd: max ?? t.min_usd } : t))
    patch({ tiers })
  }
  const save = async () => {
    setSaving(true)
    try {
      const res = await api.put('/admin/fees/schedule', { enabled: schedule.enabled, tiers: schedule.tiers, min_fee_usd: schedule.min_fee_usd, max_fee_usd: schedule.max_fee_usd, rails: schedule.rails, currencies: schedule.currencies })
      setSchedule(res.schedule); setDirty(false); toast.success('Fee schedule saved — applies to new withdrawal requests immediately')
    } catch (e) { toast.error(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }
  const resetDefaults = () => { if (!defaults) return; patch({ enabled: defaults.enabled, tiers: defaults.tiers, min_fee_usd: defaults.min_fee_usd, max_fee_usd: defaults.max_fee_usd, rails: { ...defaults.rails }, currencies: {} }); toast.message('Defaults restored — press Save to apply') }
  const allCurrencies = [...Object.keys(FIAT_META), ...Object.keys(CRYPTO_META)]
  const overrideCodes = Object.keys(schedule?.currencies || {})

  if (loading || !schedule) return <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading schedule…</div>

  return (
    <div className="space-y-5" data-testid="fee-schedule-editor">
      {/* Sticky save bar */}
      <div className="card-luxury rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Switch checked={!!schedule.enabled} onCheckedChange={v => patch({ enabled: v })} data-testid="fees-enabled"/>
          <div><div className="text-sm">{schedule.enabled ? 'Withdrawal fees are ON' : 'Withdrawal fees are OFF'}</div><div className="text-[11px] text-muted-foreground">{schedule.updated_at ? `Last updated ${new Date(schedule.updated_at).toLocaleString()}` : 'Using built-in defaults'}</div></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={resetDefaults} className="border-gold-500/40 h-9"><RotateCcw className="h-3.5 w-3.5 mr-1.5"/> Defaults</Button>
          <Button size="sm" onClick={save} disabled={saving || !dirty} className="gold-btn h-9" data-testid="fees-save"><Save className="h-3.5 w-3.5 mr-1.5"/>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</Button>
        </div>
      </div>

      <div className="grid xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 space-y-5">
          {/* Tiers */}
          <div className="card-luxury rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="font-display text-lg flex items-center gap-2"><Percent className="h-4 w-4 text-gold"/> Percentage tiers</div>
              <Button size="sm" variant="outline" onClick={addTier} className="border-gold-500/40 h-8" data-testid="fees-add-tier"><Plus className="h-3.5 w-3.5 mr-1"/> Tier</Button>
            </div>
            <div className="text-[11px] text-muted-foreground mb-3">Based on the USD value of the withdrawal. Each tier starts where the previous one ends; the last is open-ended.</div>
            <div className="space-y-2">
              {schedule.tiers.map((t, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end rounded-xl bg-secondary/50 p-3" data-testid={`fee-tier-${i}`}>
                  <div className="col-span-6 sm:col-span-3">
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground">From (USD)</Label>
                    <Input value={t.min_usd} disabled className="mt-1 h-9 bg-onyx-950/60 border-gold-500/10 font-mono text-xs"/>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Up to (USD)</Label>
                    <Input type="number" min="0" value={t.max_usd ?? ''} placeholder="∞" onChange={e => setTierMax(i, e.target.value)} disabled={i === schedule.tiers.length - 1} className="mt-1 h-9 bg-secondary border-gold-500/20 font-mono text-xs"/>
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Fee %</Label>
                    <Input type="number" min="0" max="100" step="any" value={t.percent} onChange={e => setTier(i, 'percent', e.target.value)} className="mt-1 h-9 bg-secondary border-gold-500/20 font-mono text-xs text-gold" data-testid={`fee-tier-percent-${i}`}/>
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Label</Label>
                    <Input value={t.label || ''} onChange={e => setTier(i, 'label', e.target.value)} placeholder="e.g. Standard" className="mt-1 h-9 bg-secondary border-gold-500/20 text-xs"/>
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <Button size="icon" variant="ghost" onClick={() => removeTier(i)} className="h-9 w-9 text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4"/></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Minimum fee (USD)</Label>
                <Input type="number" min="0" step="any" value={schedule.min_fee_usd} onChange={e => patch({ min_fee_usd: e.target.value })} className="mt-1 h-9 bg-secondary border-gold-500/20 font-mono text-xs" data-testid="fees-min"/>
              </div>
              <div>
                <Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Maximum fee (USD, blank = none)</Label>
                <Input type="number" min="0" step="any" value={schedule.max_fee_usd ?? ''} placeholder="No cap" onChange={e => patch({ max_fee_usd: e.target.value === '' ? null : e.target.value })} className="mt-1 h-9 bg-secondary border-gold-500/20 font-mono text-xs" data-testid="fees-max"/>
              </div>
            </div>
          </div>

          {/* Rails */}
          <div className="card-luxury rounded-2xl p-4 sm:p-5">
            <div className="font-display text-lg flex items-center gap-2"><Landmark className="h-4 w-4 text-gold"/> Network & payout costs</div>
            <div className="text-[11px] text-muted-foreground mb-3">Flat cost added on top of the percentage, in USD, converted to the asset at quote time. Benchmarked on exchange network fees and bank wire charges.</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Crypto networks</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {railKeys.crypto.map(k => (
                <div key={k} className="rounded-lg bg-secondary/50 p-2">
                  <div className="text-[10px] text-muted-foreground truncate">{k}</div>
                  <div className="flex items-center gap-1 mt-0.5"><span className="text-xs text-muted-foreground">$</span><Input type="number" min="0" step="any" value={schedule.rails?.[k] ?? 0} onChange={e => patch({ rails: { ...schedule.rails, [k]: e.target.value } })} className="h-8 bg-onyx-950/50 border-gold-500/15 font-mono text-xs px-2" data-testid={`fee-rail-${k}`}/></div>
                </div>
              ))}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 mt-4">Fiat payout methods</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {railKeys.fiat.map(k => (
                <div key={k} className="rounded-lg bg-secondary/50 p-2">
                  <div className="text-[10px] text-muted-foreground truncate">{k.replace('_', ' ')}</div>
                  <div className="flex items-center gap-1 mt-0.5"><span className="text-xs text-muted-foreground">$</span><Input type="number" min="0" step="any" value={schedule.rails?.[k] ?? 0} onChange={e => patch({ rails: { ...schedule.rails, [k]: e.target.value } })} className="h-8 bg-onyx-950/50 border-gold-500/15 font-mono text-xs px-2" data-testid={`fee-rail-${k}`}/></div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-currency overrides */}
          <div className="card-luxury rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div className="font-display text-lg flex items-center gap-2"><Coins className="h-4 w-4 text-gold"/> Per-currency overrides</div>
              <div className="flex gap-2">
                <Select value={addCurrency} onValueChange={setAddCurrency}>
                  <SelectTrigger className="h-8 w-32 bg-secondary border-gold-500/20 text-xs" data-testid="fees-add-currency"><SelectValue placeholder="Currency"/></SelectTrigger>
                  <SelectContent className="max-h-64">{allCurrencies.filter(c => !overrideCodes.includes(c)).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" disabled={!addCurrency} onClick={() => { patch({ currencies: { ...schedule.currencies, [addCurrency]: { enabled: true } } }); setAddCurrency('') }} className="border-gold-500/40 h-8"><Plus className="h-3.5 w-3.5"/></Button>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mb-3">Override the minimum / maximum / rail cost for a specific currency, or switch fees off for it entirely. Leave a field blank to inherit the default.</div>
            {overrideCodes.length === 0 && <div className="text-sm text-muted-foreground">No overrides — every currency uses the default schedule.</div>}
            <div className="space-y-2">
              {overrideCodes.map(code => {
                const o = schedule.currencies[code] || {}
                const setO = (p) => patch({ currencies: { ...schedule.currencies, [code]: { ...o, ...p } } })
                return (
                  <div key={code} className="rounded-xl bg-secondary/50 p-3 grid grid-cols-12 gap-2 items-end" data-testid={`fee-override-${code}`}>
                    <div className="col-span-4 sm:col-span-2"><div className="font-medium">{code}</div><div className="flex items-center gap-1.5 mt-1"><Switch checked={o.enabled !== false} onCheckedChange={v => setO({ enabled: v })}/><span className="text-[10px] text-muted-foreground">{o.enabled === false ? 'No fee' : 'Fee on'}</span></div></div>
                    <div className="col-span-8 sm:col-span-3"><Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Min fee $</Label><Input type="number" min="0" step="any" value={o.min_fee_usd ?? ''} placeholder={String(schedule.min_fee_usd)} onChange={e => setO({ min_fee_usd: e.target.value === '' ? null : e.target.value })} disabled={o.enabled === false} className="mt-1 h-8 bg-onyx-950/50 border-gold-500/15 font-mono text-xs"/></div>
                    <div className="col-span-6 sm:col-span-3"><Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Max fee $</Label><Input type="number" min="0" step="any" value={o.max_fee_usd ?? ''} placeholder={schedule.max_fee_usd ?? 'none'} onChange={e => setO({ max_fee_usd: e.target.value === '' ? null : e.target.value })} disabled={o.enabled === false} className="mt-1 h-8 bg-onyx-950/50 border-gold-500/15 font-mono text-xs"/></div>
                    <div className="col-span-5 sm:col-span-3"><Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Rail cost $</Label><Input type="number" min="0" step="any" value={o.rail_fee_usd ?? ''} placeholder="per network" onChange={e => setO({ rail_fee_usd: e.target.value === '' ? null : e.target.value })} disabled={o.enabled === false} className="mt-1 h-8 bg-onyx-950/50 border-gold-500/15 font-mono text-xs"/></div>
                    <div className="col-span-1 flex justify-end"><Button size="icon" variant="ghost" onClick={() => { const c = { ...schedule.currencies }; delete c[code]; patch({ currencies: c }) }} className="h-8 w-8 text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4"/></Button></div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Calculator + summary */}
        <div className="xl:col-span-2 space-y-5">
          <FeeCalculator api={api} schedule={schedule} railKeys={railKeys}/>
          <div className="card-luxury rounded-2xl p-4 sm:p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5"><Info className="h-3.5 w-3.5"/> What users see</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Before confirming a withdrawal, the user sees exactly: <span className="text-foreground/90">You withdraw → Fee → You receive</span>, with the tier and network cost explained. The quote is frozen on the request, so later edits here never change a pending request. Admins see the fee and net payout in Withdraw Requests.
            </div>
            <div className="mt-3 rounded-lg bg-secondary/50 p-3 text-xs space-y-1">
              {schedule.tiers.map((t, i) => <div key={i} className="flex justify-between"><span className="text-muted-foreground">{t.label || `Tier ${i + 1}`} · {tierRange(t, i)}</span><span className="font-mono text-gold">{t.percent}%</span></div>)}
              <div className="flex justify-between pt-1 border-t border-gold-500/10"><span className="text-muted-foreground">Minimum fee</span><span className="font-mono">{usd(schedule.min_fee_usd)}</span></div>
              {schedule.max_fee_usd !== null && schedule.max_fee_usd !== undefined && schedule.max_fee_usd !== '' && <div className="flex justify-between"><span className="text-muted-foreground">Maximum fee</span><span className="font-mono">{usd(schedule.max_fee_usd)}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeeCalculator({ api, schedule, railKeys }) {
  const [amount, setAmount] = useState('1000')
  const [currency, setCurrency] = useState('USDT')
  const [rail, setRail] = useState('ERC20')
  const [quote, setQuote] = useState(null)
  const [busy, setBusy] = useState(false)
  const isCrypto = !!CRYPTO_META[currency]
  const rails = isCrypto ? railKeys.crypto : railKeys.fiat
  useEffect(() => { if (!rails.includes(rail)) setRail(isCrypto ? 'ERC20' : 'bank_swift') }, [currency])
  useEffect(() => {
    const amt = Number(amount); if (!amt || amt <= 0) { setQuote(null); return }
    let cancelled = false; setBusy(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.post('/admin/fees/preview', { amount: amt, currency, network: isCrypto ? rail : undefined, method: isCrypto ? 'crypto' : rail, schedule: { enabled: schedule.enabled, tiers: schedule.tiers, min_fee_usd: Number(schedule.min_fee_usd) || 0, max_fee_usd: schedule.max_fee_usd === '' || schedule.max_fee_usd === null ? null : Number(schedule.max_fee_usd), rails: Object.fromEntries(Object.entries(schedule.rails || {}).map(([k, v]) => [k, Number(v) || 0])), currencies: schedule.currencies } })
        if (!cancelled) setQuote(res.quote)
      } catch { if (!cancelled) setQuote(null) }
      finally { if (!cancelled) setBusy(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [amount, currency, rail, schedule])
  const b = quote?.breakdown || {}
  return (
    <div className="card-luxury rounded-2xl p-4 sm:p-5" data-testid="fee-calculator">
      <div className="font-display text-lg flex items-center gap-2"><Calculator className="h-4 w-4 text-gold"/> Fee calculator</div>
      <div className="text-[11px] text-muted-foreground mb-3">Live preview using the schedule as currently edited (unsaved changes included).</div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 sm:col-span-1"><Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Amount</Label><Input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 h-9 bg-secondary border-gold-500/20 font-mono text-xs" data-testid="calc-amount"/></div>
        <div><Label className="text-[9px] uppercase tracking-widest text-muted-foreground">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}><SelectTrigger className="mt-1 h-9 bg-secondary border-gold-500/20 text-xs"><SelectValue/></SelectTrigger><SelectContent className="max-h-64">{[...Object.keys(CRYPTO_META), ...Object.keys(FIAT_META)].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-[9px] uppercase tracking-widest text-muted-foreground">{isCrypto ? 'Network' : 'Method'}</Label>
          <Select value={rail} onValueChange={setRail}><SelectTrigger className="mt-1 h-9 bg-secondary border-gold-500/20 text-xs"><SelectValue/></SelectTrigger><SelectContent className="max-h-64">{rails.map(r => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {quote ? (
        <div className="mt-4 rounded-xl border border-gold-500/25 bg-gradient-to-br from-gold-500/10 to-transparent p-4" data-testid="calc-result">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-[9px] uppercase tracking-widest text-muted-foreground">Withdraw</div><div className="font-mono text-sm mt-0.5">{fmt(quote.gross, quote.currency)}</div><div className="text-[10px] text-muted-foreground">{usd(quote.gross_usd)}</div></div>
            <div><div className="text-[9px] uppercase tracking-widest text-muted-foreground">Fee</div><div className="font-mono text-sm mt-0.5 text-red-300">− {fmt(quote.fee, quote.currency)}</div><div className="text-[10px] text-muted-foreground">{usd(quote.fee_usd)}{busy && ' …'}</div></div>
            <div><div className="text-[9px] uppercase tracking-widest text-gold">Receives</div><div className="font-mono text-sm mt-0.5 gold-text font-semibold">{fmt(Math.max(0, quote.net), quote.currency)}</div><div className="text-[10px] text-muted-foreground">{usd(Math.max(0, quote.net_usd))}</div></div>
          </div>
          <div className="mt-3 pt-3 border-t border-gold-500/10 text-[11px] text-muted-foreground space-y-1">
            {b.waived ? <div>Fee waived — {b.reason}</div> : (
              <>
                <div className="flex justify-between"><span>{b.tier_label || 'Tier'} · {b.percent}% of {usd(quote.gross_usd)}</span><span className="font-mono">{usd(b.percent_fee_usd)}</span></div>
                <div className="flex justify-between"><span>{b.rail} {isCrypto ? 'network' : 'payout'} cost</span><span className="font-mono">{usd(b.rail_fee_usd)}</span></div>
                {b.min_applied && <div className="text-gold">Raised to the minimum fee of {usd(b.min_fee_usd)}</div>}
                {b.max_applied && <div className="text-gold">Capped at the maximum fee of {usd(b.max_fee_usd)}</div>}
                <div className="flex justify-between pt-1 border-t border-gold-500/10 text-foreground/80"><span>Effective rate</span><span className="font-mono">{quote.gross_usd > 0 ? ((quote.fee_usd / quote.gross_usd) * 100).toFixed(2) : '0.00'}%</span></div>
              </>
            )}
          </div>
        </div>
      ) : <div className="mt-4 text-xs text-muted-foreground">Enter an amount to preview the fee.</div>}
    </div>
  )
}

export default FeesAdmin
