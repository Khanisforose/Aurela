'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, KYC_COUNTRIES } from './store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { BellRing, Search, Loader2, RefreshCw, Send, Trash2, XCircle, AlertTriangle, Clock, ShieldCheck, Wallet, Mail, Smartphone, Bell, Play, ChevronLeft, ChevronRight, UserX } from 'lucide-react'

const fmtLeft = (ms) => {
  if (ms <= 0) return 'deadline passed'
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h ${String(m).padStart(2, '0')}m left`
}
const countryLabel = (cc) => KYC_COUNTRIES.find(([c]) => c === cc)?.[1] || cc || '—'
const hrs = (h) => { const n = Number(h) || 0; return n % 24 === 0 && n >= 48 ? `${n / 24} days` : `${n} hour${n === 1 ? '' : 's'}` }

// ---------------- User-facing deadline banner ----------------
export function VerifyDeadlineBanner({ user, onVerify, hidden }) {
  const vr = user?.verify_reminder
  const [nowTs, setNowTs] = useState(Date.now())
  const active = !!vr?.active && user?.kyc_status !== 'approved' && user?.role !== 'admin' && user?.role !== 'super_admin'
  useEffect(() => { if (!active) return; const id = setInterval(() => setNowTs(Date.now()), 30000); return () => clearInterval(id) }, [active])
  if (!active || hidden) return null
  const left = new Date(vr.deadline_at).getTime() - nowTs
  const pending = user.kyc_status === 'pending'
  const urgent = left < 6 * 3600000
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`mb-5 rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${pending ? 'border-gold-500/30 bg-gold-500/5' : urgent ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/5'}`} data-testid="verify-deadline-banner">
      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${pending ? 'bg-gold-500/15 text-gold' : urgent ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>{pending ? <ShieldCheck className="h-5 w-5"/> : <AlertTriangle className="h-5 w-5"/>}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{pending ? 'Verification submitted — under review' : 'Verify your account to keep it'}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{pending ? 'Thanks! Your account won’t be deleted while our team reviews your documents.' : <>Unverified accounts are permanently deleted. Complete verification before <b className="text-foreground">{new Date(vr.deadline_at).toLocaleString()}</b>.</>}</div>
      </div>
      {!pending && (
        <div className="flex items-center gap-3 shrink-0">
          <span className={`font-mono text-xs tabular-nums ${urgent ? 'text-red-300' : 'text-amber-200'}`} data-testid="verify-deadline-left">{fmtLeft(left)}</span>
          <Button size="sm" onClick={onVerify} className="gold-btn rounded-full" data-testid="verify-deadline-cta">Verify now</Button>
        </div>
      )}
    </motion.div>
  )
}

// ---------------- Admin tab ----------------
const FILTERS = [['unverified', 'All unverified'], ['not_reminded', 'Not reminded'], ['scheduled', 'Deletion scheduled'], ['flagged', 'Needs review'], ['deleted', 'Deleted']]

export function VerifyRemindersAdmin() {
  const { api, tick } = useApp()
  const [filter, setFilter] = useState('unverified')
  const [q, setQ] = useState('')
  const [debQ, setDebQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ users: [], counts: {}, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState({})   // id → user
  const [sendOpen, setSendOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [nowTs, setNowTs] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNowTs(Date.now()), 30000); return () => clearInterval(id) }, [])
  useEffect(() => { const t = setTimeout(() => { setDebQ(q.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [q])
  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try { const r = await api.get(`/admin/verify-reminders?filter=${filter}&q=${encodeURIComponent(debQ)}&page=${page}`); setData({ users: r?.users || [], deleted: r?.deleted || [], counts: r?.counts || data.counts, pages: r?.pages || 1, total: r?.total || 0, last_run: r?.last_run }) }
    catch (e) { toast.error(e?.message || 'Failed to load') } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [filter, debQ, page])
  useEffect(() => { if (!sendOpen && !busy) load(true) }, [tick])
  useEffect(() => { setSel({}) }, [filter])

  const selIds = Object.keys(sel)
  const allOnPage = data.users.length > 0 && data.users.every(u => sel[u.id])
  const toggleAll = () => setSel(s => { const n = { ...s }; if (allOnPage) data.users.forEach(u => delete n[u.id]); else data.users.forEach(u => { n[u.id] = u }); return n })
  const toggle = (u) => setSel(s => { const n = { ...s }; n[u.id] ? delete n[u.id] : (n[u.id] = u); return n })
  const bulk = async (path, confirmText, okMsg) => {
    if (confirmText && typeof window !== 'undefined' && !window.confirm(confirmText)) return
    setBusy(true)
    try {
      const r = await api.post(`/admin/verify-reminders/${path}`, { user_ids: selIds })
      if (path === 'delete') { toast.success(`${r.deleted} account${r.deleted === 1 ? '' : 's'} deleted`); if (r.blocked?.length) toast.warning(`${r.blocked.length} skipped: ${r.blocked.slice(0, 3).map(b => `@${b.username} (${b.reason})`).join(', ')}${r.blocked.length > 3 ? '…' : ''}`) }
      else toast.success(okMsg(r))
      setSel({}); load(true)
    } catch (e) { toast.error(e?.message || 'Failed') } finally { setBusy(false) }
  }
  const runNow = async () => {
    setBusy(true)
    try { const r = await api.post('/admin/verify-reminders/run', {}); const s = r.stats || {}; toast.success(`Checked ${s.checked} · ${s.final_warnings} final warnings · ${s.deleted} deleted · ${s.flagged} flagged`); load(true) }
    catch (e) { toast.error(e?.message || 'Run failed') } finally { setBusy(false) }
  }
  const c = data.counts || {}

  return (
    <div className="space-y-5 pb-24" data-testid="verify-reminders-admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-2xl flex items-center gap-2"><BellRing className="h-6 w-6 text-gold"/>Verification reminders</div>
          <div className="text-sm text-muted-foreground hidden sm:block">Remind unverified users by in-app, push and email. If they don’t get KYC-approved before your deadline, the account is deleted automatically — unless it holds money or KYC is under review, then it’s flagged for you.</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runNow} disabled={busy} className="border-gold-500/40 h-9" title="Process deadlines now"><Play className="h-3.5 w-3.5 mr-1.5"/>Run now</Button>
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-9"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}/></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[['Unverified', c.unverified || 0, `${c.not_reminded || 0} not reminded`], ['Deletion scheduled', c.scheduled || 0, 'reminder sent'], ['Needs review', c.flagged || 0, 'funds or KYC pending'], ['Deleted', c.deleted || 0, data.last_run?.last_run_at ? `last check ${new Date(data.last_run.last_run_at).toLocaleTimeString()}` : 'auto-check every 15 min']].map(([l, v, s]) => (
          <div key={l} className="card-luxury rounded-2xl p-3 sm:p-4 min-w-0">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground truncate">{l}</div>
            <div className="font-display text-xl sm:text-2xl gold-text mt-1">{v}</div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{s}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground"/><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search username, email or name" className="pl-9 bg-secondary border-gold-500/20 h-10" data-testid="vr-search"/></div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => { setFilter(v); setPage(1) }} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${filter === v ? 'border-gold-500 bg-gold-500/10 text-gold' : 'border-gold-500/15 text-muted-foreground hover:border-gold-500/40'}`} data-testid={`vr-filter-${v}`}>{l}<span className="ml-1.5 opacity-70">{c[v] ?? ''}</span></button>
        ))}
      </div>

      {loading ? <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div> : filter === 'deleted' ? (
        <div className="space-y-2">
          {(data.deleted || []).length === 0 && <div className="card-luxury rounded-2xl p-8 text-center text-sm text-muted-foreground">No deleted accounts yet.</div>}
          {(data.deleted || []).map(d => (
            <div key={d.id} className="card-luxury rounded-2xl p-4 flex flex-wrap items-center gap-3 text-xs">
              <UserX className="h-5 w-5 text-muted-foreground"/>
              <div className="min-w-0 flex-1"><div className="text-sm truncate">{d.full_name || d.username} <span className="text-muted-foreground">@{d.username}</span></div><div className="text-muted-foreground truncate">{d.email}</div></div>
              <Badge variant="outline" className="border-muted text-muted-foreground">{d.reason === 'admin_unverified' ? 'Deleted by admin' : 'Auto-deleted (deadline)'}</Badge>
              <span className="text-muted-foreground">{new Date(d.deleted_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : data.users.length === 0 ? (
        <div className="card-luxury rounded-2xl p-10 text-center space-y-2"><ShieldCheck className="h-8 w-8 text-gold mx-auto"/><div className="text-sm text-muted-foreground">No users in this list.</div></div>
      ) : (
        <div className="card-luxury rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gold-500/10 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Checkbox checked={allOnPage} onCheckedChange={toggleAll} data-testid="vr-select-all"/>
            <span className="flex-1">User</span><span className="hidden md:block w-28">KYC</span><span className="hidden md:block w-24">Balance</span><span className="w-40 text-right">Reminder</span>
          </div>
          {data.users.map(u => {
            const vr = u.verify_reminder
            const left = vr?.active ? new Date(vr.deadline_at).getTime() - nowTs : null
            return (
              <label key={u.id} className={`flex items-center gap-3 px-4 py-3 border-b border-gold-500/5 last:border-0 cursor-pointer hover:bg-white/[0.02] ${sel[u.id] ? 'bg-gold-500/[0.04]' : ''}`} data-testid={`vr-row-${u.id}`}>
                <Checkbox checked={!!sel[u.id]} onCheckedChange={() => toggle(u)}/>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{u.full_name || u.username} <span className="text-muted-foreground">@{u.username}</span></div>
                  <div className="text-xs text-muted-foreground truncate">{u.email} · {countryLabel(u.country)} · joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</div>
                </div>
                <div className="hidden md:block w-28"><Badge variant="outline" className={u.kyc_status === 'pending' ? 'border-gold-500/40 text-gold' : u.kyc_status === 'rejected' ? 'border-red-500/40 text-red-400' : 'border-muted text-muted-foreground'}>{u.kyc_status || 'not started'}</Badge></div>
                <div className="hidden md:block w-24 text-xs">{u.funds?.has_money ? <span className="text-gold inline-flex items-center gap-1"><Wallet className="h-3 w-3"/>${u.funds.balance_usd}</span> : <span className="text-muted-foreground">$0</span>}</div>
                <div className="w-40 text-right text-xs">
                  {!vr?.active ? <span className="text-muted-foreground">{vr?.resolved === 'cancelled' ? 'Cancelled' : 'Not reminded'}</span>
                    : vr.flagged_at ? <span className="text-amber-300 inline-flex items-center gap-1 justify-end"><AlertTriangle className="h-3 w-3"/>{vr.flag_reason === 'has_funds' ? 'Holds funds' : 'KYC pending'}</span>
                    : <span className={`inline-flex items-center gap-1 justify-end ${left < 6 * 3600000 ? 'text-red-300' : 'text-gold'}`}><Clock className="h-3 w-3"/>{fmtLeft(left)}</span>}
                  {vr?.active && <div className="text-[10px] text-muted-foreground">sent ×{vr.count || 1}{vr.final_warning_sent_at ? ' · final sent' : ''}</div>}
                </div>
              </label>
            )
          })}
        </div>
      )}

      {filter !== 'deleted' && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-gold-500/40"><ChevronLeft className="h-4 w-4"/></Button>
          <span className="text-muted-foreground">Page {page} of {data.pages} · {data.total} users</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="border-gold-500/40"><ChevronRight className="h-4 w-4"/></Button>
        </div>
      )}

      {/* Sticky bulk action bar */}
      {selIds.length > 0 && (
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-4 inset-x-4 lg:left-[300px] z-40" data-testid="vr-action-bar">
          <div className="mx-auto max-w-3xl rounded-2xl border border-gold-500/30 bg-onyx-900/95 backdrop-blur-xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-2">
            <div className="text-sm flex-1 min-w-[120px]"><span className="text-gold font-medium">{selIds.length}</span> selected <button onClick={() => setSel({})} className="text-xs text-muted-foreground hover:text-foreground ml-2">Clear</button></div>
            <Button size="sm" variant="ghost" onClick={() => bulk('cancel', null, r => `${r.cancelled} reminder${r.cancelled === 1 ? '' : 's'} cancelled`)} disabled={busy} data-testid="vr-cancel"><XCircle className="h-4 w-4 mr-1.5"/>Cancel deletion</Button>
            <Button size="sm" variant="outline" onClick={() => bulk('delete', `Permanently delete ${selIds.length} unverified account(s) now? Accounts holding funds are skipped.`)} disabled={busy} className="border-red-500/40 text-red-400 hover:bg-red-500/10" data-testid="vr-delete"><Trash2 className="h-4 w-4 mr-1.5"/>Delete now</Button>
            <Button size="sm" onClick={() => setSendOpen(true)} disabled={busy} className="gold-btn" data-testid="vr-send-open"><Send className="h-4 w-4 mr-1.5"/>Send reminder</Button>
          </div>
        </motion.div>
      )}

      <SendDialog open={sendOpen} onOpenChange={setSendOpen} users={Object.values(sel)} onDone={() => { setSendOpen(false); setSel({}); load(true) }}/>
    </div>
  )
}

function SendDialog({ open, onOpenChange, users, onDone }) {
  const { api } = useApp()
  const [hours, setHours] = useState('24')
  const [fwh, setFwh] = useState('3')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!open) { setMessage('') } }, [open])
  const h = Number(hours), f = Number(fwh)
  const valid = Number.isFinite(h) && h >= 1 && h <= 8760 && Number.isFinite(f) && f >= 0 && f < h
  const deadline = useMemo(() => valid ? new Date(Date.now() + h * 3600000) : null, [hours, valid, open])
  const withFunds = users.filter(u => u.funds?.has_money).length
  const send = async () => {
    setBusy(true)
    try {
      const r = await api.post('/admin/verify-reminders/send', { user_ids: users.map(u => u.id), hours: h, final_warning_hours: f, message: message.trim() || undefined })
      toast.success(`Reminder sent to ${r.sent} user${r.sent === 1 ? '' : 's'} · deletion ${new Date(r.deadline_at).toLocaleString()}`)
      if (r.skipped?.length) toast.message(`${r.skipped.length} skipped (${r.skipped[0].reason})`)
      onDone()
    } catch (e) { toast.error(e?.message || 'Send failed') } finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-lg max-h-[92vh] overflow-y-auto" data-testid="vr-send-dialog">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><BellRing className="h-5 w-5 text-gold"/>Send verification reminder</DialogTitle>
          <DialogDescription>To {users.length} user{users.length === 1 ? '' : 's'} via in-app, push and email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Delete account if not verified within</Label>
            <div className="flex gap-2 items-center">
              <Input type="number" min="1" max="8760" value={hours} onChange={e => setHours(e.target.value)} className="bg-secondary border-gold-500/20 h-10 font-mono w-28" data-testid="vr-hours"/>
              <span className="text-sm text-muted-foreground">hours</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">{[12, 24, 48, 72, 168].map(x => <button key={x} onClick={() => setHours(String(x))} className={`text-[11px] rounded-full border px-2.5 py-1 ${h === x ? 'border-gold-500 bg-gold-500/10 text-gold' : 'border-gold-500/15 text-muted-foreground'}`}>{hrs(x)}</button>)}</div>
            {deadline && <div className="text-xs text-muted-foreground">Deadline: <span className="text-foreground">{deadline.toLocaleString()}</span></div>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Automatic final warning</Label>
            <div className="flex gap-2 items-center"><Input type="number" min="0" value={fwh} onChange={e => setFwh(e.target.value)} className="bg-secondary border-gold-500/20 h-10 font-mono w-28" data-testid="vr-final-hours"/><span className="text-sm text-muted-foreground">hours before deletion (0 = off)</span></div>
            {!valid && <div className="text-xs text-red-400">Final warning must be less than the deletion time.</div>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Extra message (optional)</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Verification takes 3 minutes — tap Verify in the app." className="bg-secondary border-gold-500/20 text-sm"/>
          </div>
          <div className="rounded-2xl border border-gold-500/15 bg-secondary/40 p-4 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Preview</div>
            <div className="text-sm font-medium">Please verify your account within {valid ? `${h} hour${h === 1 ? '' : 's'}` : '…'}</div>
            <div className="text-xs text-muted-foreground">Your Aurela account is not verified yet. Complete identity verification before {deadline ? deadline.toUTCString().replace(' GMT', ' UTC') : '…'} or your account will be permanently deleted.{message ? ' ' + message : ''}</div>
            <div className="flex gap-3 text-[11px] text-muted-foreground pt-1"><span className="inline-flex items-center gap-1"><Bell className="h-3 w-3 text-gold"/>In-app</span><span className="inline-flex items-center gap-1"><Smartphone className="h-3 w-3 text-gold"/>Push</span><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3 text-gold"/>Email</span></div>
          </div>
          {withFunds > 0 && <div className="text-xs text-amber-300 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0"/>{withFunds} selected user{withFunds === 1 ? ' holds' : 's hold'} money — they’ll be reminded but never auto-deleted (flagged for you instead).</div>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={!valid || busy || !users.length} className="gold-btn" data-testid="vr-send-confirm">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Send className="h-4 w-4 mr-2"/>Send to {users.length}</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default VerifyRemindersAdmin
