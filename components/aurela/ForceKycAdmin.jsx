'use client'

import { useEffect, useMemo, useState } from 'react'
import { useApp, KYC_COUNTRIES } from './store'
import { FKYC_DOCS, FKYC_DOC_ORDER, FKYC_REVIEW_HOURS, suggestedDocs, ENHANCED_PRESET, fetchFileUrl, fmtCountdown, challengeLabel, taxIdName } from './forceKycShared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ShieldAlert, ShieldCheck, Search, Loader2, RefreshCw, Lock, ScanFace, FileText, Check, X, Clock, AlertTriangle, Eye, Ban, ExternalLink, UserRound, Smartphone } from 'lucide-react'

const ownerName = (u) => u?.full_name || u?.username || '—'
const countryLabel = (cc) => KYC_COUNTRIES.find(([c]) => c === cc)?.[1] || cc || '—'
const STATUS = {
  required: ['Awaiting user', 'border-amber-500/40 text-amber-300'],
  rejected: ['Resubmission needed', 'border-red-500/40 text-red-400'],
  submitted: ['Under review', 'border-gold-500 text-gold'],
  approved: ['Approved', 'border-emerald-500/40 text-emerald-400'],
  cancelled: ['Cancelled', 'border-muted text-muted-foreground'],
}
const StatusBadge = ({ s }) => <Badge variant="outline" className={STATUS[s]?.[1] || ''}>{STATUS[s]?.[0] || s}</Badge>

export function SlaChip({ fk }) {
  const [nowTs, setNowTs] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNowTs(Date.now()), 30000); return () => clearInterval(id) }, [])
  if (fk?.status !== 'submitted' || !fk.review_due_at) return null
  const left = new Date(fk.review_due_at).getTime() - nowTs
  const overdue = left <= 0
  const urgent = left < 6 * 3600 * 1000
  return <span className={`inline-flex items-center gap-1 text-[11px] ${overdue ? 'text-red-400' : urgent ? 'text-amber-300' : 'text-muted-foreground'}`}><Clock className="h-3 w-3"/>{overdue ? `Overdue by ${fmtCountdown(-left).slice(0, 5)}h` : `${fmtCountdown(left).slice(0, 5)}h left`}</span>
}

export function ForceKycAdmin() {
  const { api, tick } = useApp()
  const [status, setStatus] = useState('open')
  const [data, setData] = useState({ users: [], counts: {} })
  const [loading, setLoading] = useState(true)
  const [enableOpen, setEnableOpen] = useState(false)
  const [reviewId, setReviewId] = useState(null)
  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try { const r = await api.get(`/admin/force-kyc?status=${status}`); setData({ users: r?.users || [], counts: r?.counts || {} }) }
    catch (e) { toast.error(e?.message || 'Failed to load') } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [status])
  useEffect(() => { if (!reviewId && !enableOpen) load(true) }, [tick])
  const c = data.counts || {}
  const chips = [['open', 'Open', (c.required || 0) + (c.rejected || 0) + (c.submitted || 0)], ['submitted', 'Under review', c.submitted || 0], ['required', 'Awaiting user', c.required || 0], ['rejected', 'Resubmission', c.rejected || 0], ['approved', 'Approved', c.approved || 0], ['cancelled', 'Cancelled', c.cancelled || 0], ['all', 'All', null]]

  return (
    <div className="space-y-5" data-testid="force-kyc-admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-2xl flex items-center gap-2"><ShieldAlert className="h-6 w-6 text-gold"/>Force KYC</div>
          <div className="text-sm text-muted-foreground hidden sm:block">Lock an account behind an enhanced re-verification: liveness check plus the documents you choose. The user can't use anything else until you approve. Review target: {FKYC_REVIEW_HOURS} hours.</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-9"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}/></Button>
          <Button size="sm" onClick={() => setEnableOpen(true)} className="gold-btn h-9" data-testid="force-kyc-enable-open"><Lock className="h-3.5 w-3.5 mr-1.5"/>Enable force KYC</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[['Under review', c.submitted || 0, `${c.overdue || 0} overdue`, c.overdue ? 'text-red-400' : ''], ['Awaiting user', (c.required || 0) + (c.rejected || 0), `${c.rejected || 0} resubmissions`, ''], ['Approved', c.approved || 0, 'access restored', ''], ['Cancelled', c.cancelled || 0, 'lifted by admin', '']].map(([l, v, s, cls]) => (
          <div key={l} className="card-luxury rounded-2xl p-3 sm:p-4 min-w-0">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground truncate">{l}</div>
            <div className="font-display text-xl sm:text-2xl gold-text mt-1">{v}</div>
            <div className={`text-[10px] sm:text-[11px] truncate ${cls || 'text-muted-foreground'}`}>{s}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {chips.map(([v, l, n]) => (
          <button key={v} onClick={() => setStatus(v)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${status === v ? 'border-gold-500 bg-gold-500/10 text-gold' : 'border-gold-500/15 text-muted-foreground hover:border-gold-500/40'}`} data-testid={`fk-filter-${v}`}>{l}{n != null && <span className="ml-1.5 opacity-70">{n}</span>}</button>
        ))}
      </div>

      {loading ? <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div> : data.users.length === 0 ? (
        <div className="card-luxury rounded-2xl p-10 text-center space-y-2"><ShieldCheck className="h-8 w-8 text-gold mx-auto"/><div className="text-sm text-muted-foreground">No users in this list.</div></div>
      ) : (
        <div className="space-y-2.5">
          {data.users.map(u => (
            <div key={u.id} className={`card-luxury rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 ${u.force_kyc?.status === 'submitted' ? 'ring-1 ring-gold-500/30' : ''}`} data-testid={`fk-row-${u.id}`}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-full bg-gold-500/10 flex items-center justify-center shrink-0 text-gold font-medium">{(ownerName(u)[0] || '?').toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{ownerName(u)} <span className="text-muted-foreground font-normal">@{u.username}</span></div>
                  <div className="text-xs text-muted-foreground truncate">{u.email} · {countryLabel(u.country)}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <StatusBadge s={u.force_kyc?.status}/>
                <span className="text-muted-foreground">Attempt {u.force_kyc?.attempt || 1}</span>
                <span className="text-muted-foreground">{(u.force_kyc?.required_docs || []).length} docs + liveness</span>
                <span className="text-muted-foreground">{u.force_kyc?.submitted_at && u.force_kyc?.status === 'submitted' ? `Submitted ${new Date(u.force_kyc.submitted_at).toLocaleString()}` : `Requested ${new Date(u.force_kyc?.requested_at).toLocaleDateString()}`}</span>
                <SlaChip fk={u.force_kyc}/>
              </div>
              <Button size="sm" onClick={() => setReviewId(u.id)} className={u.force_kyc?.status === 'submitted' ? 'gold-btn' : ''} variant={u.force_kyc?.status === 'submitted' ? 'default' : 'outline'} data-testid={`fk-review-${u.id}`}><Eye className="h-3.5 w-3.5 mr-1.5"/>{u.force_kyc?.status === 'submitted' ? 'Review' : 'Open'}</Button>
            </div>
          ))}
        </div>
      )}

      <EnableDialog open={enableOpen} onOpenChange={setEnableOpen} onDone={() => { setEnableOpen(false); load(true) }}/>
      <ReviewDialog userId={reviewId} onClose={() => setReviewId(null)} onChanged={() => load(true)}/>
    </div>
  )
}

// ---------------- Enable ----------------
function EnableDialog({ open, onOpenChange, onDone }) {
  const { api } = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState(null)
  const [docs, setDocs] = useState([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!open) { setQ(''); setResults([]); setPicked(null); setDocs([]); setReason('') } }, [open])
  useEffect(() => {
    if (picked || q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => { setSearching(true); try { const r = await api.get(`/admin/force-kyc/lookup?q=${encodeURIComponent(q.trim())}`); setResults(r?.users || []) } catch (e) {} finally { setSearching(false) } }, 280)
    return () => clearTimeout(t)
  }, [q, picked])
  const pick = (u) => { setPicked(u); setDocs(suggestedDocs(u.country)) }
  const toggle = (d) => setDocs(x => x.includes(d) ? x.filter(y => y !== d) : [...x, d])
  const submit = async () => {
    if (!picked || !docs.length) return
    setBusy(true)
    try { await api.post('/admin/force-kyc/enable', { user_id: picked.id, required_docs: docs, reason: reason.trim() }); toast.success(`@${picked.username} is now locked until enhanced KYC is approved`); onDone() }
    catch (e) { toast.error(e?.message || 'Failed') } finally { setBusy(false) }
  }
  const reapply = picked?.force_kyc?.active
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="fk-enable-dialog">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><Lock className="h-5 w-5 text-gold"/>Enable force KYC</DialogTitle>
          <DialogDescription>The user's app is locked to a full-screen verification flow until you approve it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {!picked ? (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">User</Label>
              <div className="relative"><Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground"/><Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search username, email, name or Aurela ID" className="pl-9 bg-secondary border-gold-500/20 h-10" data-testid="fk-user-search"/></div>
              {searching && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/>Searching…</div>}
              <div className="space-y-1.5">
                {results.map(u => (
                  <button key={u.id} onClick={() => pick(u)} className="w-full text-left rounded-xl border border-gold-500/15 bg-secondary/40 hover:border-gold-500/50 p-3 flex items-center gap-3 transition-colors" data-testid={`fk-user-result-${u.id}`}>
                    <UserRound className="h-4 w-4 text-gold shrink-0"/>
                    <div className="min-w-0 flex-1"><div className="text-sm truncate">{ownerName(u)} <span className="text-muted-foreground">@{u.username}</span></div><div className="text-xs text-muted-foreground truncate">{u.email} · {countryLabel(u.country)} · KYC {u.kyc_status || 'none'}</div></div>
                    {u.force_kyc?.active && <StatusBadge s={u.force_kyc.status}/>}
                  </button>
                ))}
                {!searching && q.trim().length >= 2 && results.length === 0 && <div className="text-xs text-muted-foreground">No users found.</div>}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-3 flex items-center gap-3">
              <UserRound className="h-5 w-5 text-gold"/>
              <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{ownerName(picked)} <span className="text-muted-foreground font-normal">@{picked.username}</span></div><div className="text-xs text-muted-foreground truncate">{picked.email} · {countryLabel(picked.country)}</div></div>
              <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>Change</Button>
            </div>
          )}

          {picked && (
            <>
              {reapply && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0"/>This user is already in force KYC ({STATUS[picked.force_kyc.status]?.[0]}). Re-applying starts a new attempt with the documents below.</div>}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Required documents</Label>
                  <div className="flex gap-1.5">
                    <button onClick={() => setDocs(suggestedDocs(picked.country))} className="text-[11px] rounded-full border border-gold-500/30 px-2.5 py-1 text-gold hover:bg-gold-500/10">Suggested for {picked.country || 'country'}</button>
                    <button onClick={() => setDocs(ENHANCED_PRESET)} className="text-[11px] rounded-full border border-gold-500/30 px-2.5 py-1 text-gold hover:bg-gold-500/10">Enhanced due diligence</button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 p-3 flex gap-3 items-start opacity-90">
                    <Checkbox checked disabled className="mt-0.5"/>
                    <div><div className="text-sm font-medium flex items-center gap-1.5"><ScanFace className="h-3.5 w-3.5 text-gold"/>Liveness check</div><div className="text-[11px] text-muted-foreground">Always required</div></div>
                  </div>
                  {FKYC_DOC_ORDER.map(d => (
                    <label key={d} className={`rounded-xl border p-3 flex gap-3 items-start cursor-pointer transition-colors ${docs.includes(d) ? 'border-gold-500/50 bg-gold-500/5' : 'border-gold-500/10 bg-secondary/30 hover:border-gold-500/30'}`} data-testid={`fk-doc-opt-${d}`}>
                      <Checkbox checked={docs.includes(d)} onCheckedChange={() => toggle(d)} className="mt-0.5"/>
                      <div className="min-w-0"><div className="text-sm font-medium">{d === 'tax_id' ? `${FKYC_DOCS[d].label} (${taxIdName(picked.country)})` : FKYC_DOCS[d].label}</div><div className="text-[11px] text-muted-foreground line-clamp-2">{FKYC_DOCS[d].hint}</div></div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Message to user (optional)</Label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={3} placeholder="e.g. We detected unusual activity and need to re-confirm your identity." className="bg-secondary border-gold-500/20 text-sm" data-testid="fk-reason"/>
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!picked || !docs.length || busy} className="gold-btn" data-testid="fk-enable-confirm">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Lock className="h-4 w-4 mr-2"/>Lock account & require KYC</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Secure media ----------------
function SecureMedia({ fileId, mime, className = '', mirror = false, onOpen }) {
  const { api } = useApp()
  const [src, setSrc] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let url = null, alive = true
    setSrc(null); setErr(false)
    if (fileId) fetchFileUrl(api, fileId).then(r => { url = r.url; alive ? setSrc(r) : URL.revokeObjectURL(r.url) }).catch(() => alive && setErr(true))
    return () => { alive = false; url && URL.revokeObjectURL(url) }
  }, [fileId])
  if (err) return <div className={`flex items-center justify-center bg-secondary text-xs text-red-400 ${className}`}>Failed to load</div>
  if (!src) return <div className={`flex items-center justify-center bg-secondary ${className}`}><Loader2 className="h-4 w-4 animate-spin text-gold"/></div>
  const m = src.mime || mime || ''
  if (m.startsWith('video/')) return <video src={src.url} controls playsInline className={`${className} ${mirror ? '-scale-x-100' : ''}`}/>
  if (m === 'application/pdf') return <a href={src.url} target="_blank" rel="noreferrer" className={`flex flex-col items-center justify-center gap-1 bg-secondary text-xs text-gold ${className}`}><FileText className="h-6 w-6"/>Open PDF<ExternalLink className="h-3 w-3"/></a>
  return <img src={src.url} alt="" onClick={() => onOpen && onOpen(src.url)} className={`object-cover cursor-zoom-in ${mirror ? '-scale-x-100' : ''} ${className}`}/>
}

// ---------------- Review ----------------
export function ReviewDialog({ userId, onClose, onChanged, loadUrl, actionBase, allowCancel = true, approveLabel = 'Approve & restore access', header }) {
  const { api } = useApp()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejReason, setRejReason] = useState('')
  const [redoDocs, setRedoDocs] = useState([])
  const [zoom, setZoom] = useState(null)
  const load = async () => { try { setData(await api.get(loadUrl || `/admin/force-kyc/${userId}`)) } catch (e) { toast.error(e?.message || 'Failed to load') } }
  useEffect(() => { setData(null); setRejecting(false); setRejReason(''); if (userId) load() }, [userId])
  const u = data?.user
  const fk = data?.state || u?.force_kyc
  const sub = data?.submissions?.[0]
  const isCurrent = sub && fk?.submission_id === sub.id
  useEffect(() => { if (fk) setRedoDocs(fk.required_docs || []) }, [fk?.submission_id])
  const prev = data?.previous_kyc
  const act = async (action) => {
    if (action === 'cancel' && typeof window !== 'undefined' && !window.confirm('Lift force KYC and restore full access without verification?')) return
    if (action === 'reject' && !rejReason.trim()) return toast.error('Add a reason so the user knows what to fix')
    setBusy(true)
    try {
      await api.post(`${actionBase || `/admin/force-kyc/${userId}`}/${action}`, action === 'reject' ? { reason: rejReason.trim(), required_docs: redoDocs } : {})
      toast.success(action === 'approve' ? (allowCancel ? 'Approved — access restored' : 'Approved — card activated') : action === 'reject' ? 'Rejected — user asked to resubmit' : 'Force KYC lifted')
      onChanged(); onClose()
    } catch (e) { toast.error(e?.message || 'Failed') } finally { setBusy(false) }
  }
  const cmp = (label, a, b) => {
    const mismatch = a && b && String(a).trim().toLowerCase() !== String(b).trim().toLowerCase()
    return (
      <div key={label} className="grid grid-cols-[110px_1fr_1fr] gap-2 py-1.5 text-xs border-b border-gold-500/5 last:border-0">
        <div className="text-muted-foreground">{label}</div>
        <div className={mismatch ? 'text-amber-300' : ''}>{a || '—'}</div>
        <div className="text-muted-foreground">{b || '—'}{mismatch && <AlertTriangle className="inline h-3 w-3 ml-1 text-amber-400"/>}</div>
      </div>
    )
  }
  return (
    <Dialog open={!!userId} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-4xl max-h-[94vh] overflow-y-auto" data-testid="fk-review-dialog">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 flex-wrap">{u ? <>{ownerName(u)} <span className="text-sm text-muted-foreground font-sans">@{u.username}</span> {fk && <StatusBadge s={fk.status}/>}</> : 'Loading…'}</DialogTitle>
          <DialogDescription>{u ? `${u.email} · ${countryLabel(u.country)} · attempt ${fk?.attempt || 1}` : ''}</DialogDescription>
        </DialogHeader>
        {!data ? <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gold"/></div> : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Requested {fk?.requested_at ? new Date(fk.requested_at).toLocaleString() : '—'} by @{fk?.requested_by_name || 'admin'}</span>
              {fk?.status === 'submitted' && <SlaChip fk={fk}/>}
            </div>
            {fk?.reason && <div className="text-xs rounded-xl bg-secondary/40 p-3"><span className="text-muted-foreground">{header ? 'Issue note:' : 'Message to user:'}</span> {fk.reason}</div>}
            {header}
            {!sub ? (
              <div className="card-luxury rounded-2xl p-8 text-center text-sm text-muted-foreground"><Clock className="h-6 w-6 text-gold mx-auto mb-2"/>The user hasn't submitted yet. Required: liveness + {(fk?.required_docs || []).map(d => FKYC_DOCS[d]?.label).join(', ')}.</div>
            ) : (
              <>
                {!isCurrent && <div className="text-xs rounded-xl border border-gold-500/20 p-3 text-muted-foreground">Showing the latest submission ({sub.status}). The user has a new attempt pending.</div>}
                <Tabs defaultValue="liveness">
                  <TabsList className="bg-secondary/60">
                    <TabsTrigger value="liveness"><ScanFace className="h-3.5 w-3.5 mr-1.5"/>Liveness</TabsTrigger>
                    <TabsTrigger value="docs"><FileText className="h-3.5 w-3.5 mr-1.5"/>Documents</TabsTrigger>
                    <TabsTrigger value="details"><UserRound className="h-3.5 w-3.5 mr-1.5"/>Details</TabsTrigger>
                    <TabsTrigger value="device"><Smartphone className="h-3.5 w-3.5 mr-1.5"/>Device</TabsTrigger>
                  </TabsList>
                  <TabsContent value="liveness" className="space-y-3 pt-2">
                    <div className="grid md:grid-cols-[260px_1fr] gap-4">
                      {sub.liveness?.video_file_id ? <SecureMedia fileId={sub.liveness.video_file_id} mime="video/webm" mirror className="w-full aspect-[3/4] rounded-2xl bg-black ring-1 ring-gold-500/20"/> : <div className="aspect-[3/4] rounded-2xl bg-secondary flex items-center justify-center text-xs text-muted-foreground p-4 text-center">No video (device didn't support recording) — review the frames.</div>}
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {(sub.liveness?.frames || []).map((f, i) => (
                            <div key={i} className="space-y-1"><SecureMedia fileId={f.file_id} mime="image/jpeg" mirror onOpen={setZoom} className="w-full aspect-[3/4] rounded-lg ring-1 ring-gold-500/15"/><div className="text-[10px] text-center text-muted-foreground">{challengeLabel(f.challenge)}</div></div>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Challenges: {(sub.liveness?.challenges || []).map(challengeLabel).join(' → ')}</div>
                          {sub.liveness?.duration_ms && <div>Duration: {(sub.liveness.duration_ms / 1000).toFixed(1)}s</div>}
                          {sub.liveness?.face_signals?.api === 'FaceDetector' && <div>On-device face check: {sub.liveness.face_signals.frames_with_face}/{sub.liveness.face_signals.frames} frames with a face{sub.liveness.face_signals.frames_multi_face ? <span className="text-amber-300"> · {sub.liveness.face_signals.frames_multi_face} with multiple faces</span> : ''}</div>}
                        </div>
                        <div className="text-[11px] rounded-xl bg-secondary/40 p-3 text-muted-foreground">Check: same person in every frame and in the ID photo, head moves match each challenge, natural skin and lighting (no screen, mask or printed photo).</div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="docs" className="pt-2">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(sub.required_docs || []).map(d => (
                        <div key={d} className="space-y-1.5">
                          <div className="text-xs font-medium">{FKYC_DOCS[d]?.label || d}</div>
                          <SecureMedia fileId={sub.docs?.[d]?.file_id} mime={sub.docs?.[d]?.mime} onOpen={setZoom} className="w-full aspect-[4/3] rounded-xl ring-1 ring-gold-500/15"/>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                  <TabsContent value="details" className="pt-2">
                    <div className="card-luxury rounded-2xl p-4">
                      <div className="grid grid-cols-[110px_1fr_1fr] gap-2 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground"><div/><div>This submission</div><div>Previous KYC</div></div>
                      {cmp('Full name', sub.personal?.full_name, prev?.full_name)}
                      {cmp('Date of birth', sub.personal?.dob, prev?.dob)}
                      {cmp('Nationality', countryLabel(sub.personal?.nationality), prev?.country ? countryLabel(prev.country) : '')}
                      {cmp('Residence', countryLabel(sub.personal?.country), prev?.country ? countryLabel(prev.country) : '')}
                      {cmp('City', sub.personal?.city, prev?.city)}
                      {cmp('Address', sub.personal?.address, prev?.address)}
                      {cmp('Postal code', sub.personal?.postal_code, prev?.postal_code)}
                      {cmp('Occupation', sub.personal?.occupation, prev?.occupation)}
                      {cmp('ID type', sub.personal?.id_type, prev?.id_type)}
                      {cmp('ID number', sub.personal?.id_number, prev?.id_number)}
                      {sub.personal?.tax_id_number && cmp(taxIdName(sub.personal?.country), sub.personal.tax_id_number, '')}
                      {sub.personal?.source_of_funds && cmp('Source of funds', sub.personal.source_of_funds, '')}
                    </div>
                  </TabsContent>
                  <TabsContent value="device" className="pt-2">
                    <div className="card-luxury rounded-2xl p-4 text-xs space-y-1.5 break-all">
                      <div><span className="text-muted-foreground">Submitted:</span> {new Date(sub.submitted_at).toLocaleString()}</div>
                      <div><span className="text-muted-foreground">IP:</span> {sub.device?.ip || '—'}</div>
                      <div><span className="text-muted-foreground">Platform:</span> {sub.device?.platform || '—'} · {sub.device?.screen || ''} · {sub.device?.tz || ''}</div>
                      <div><span className="text-muted-foreground">User agent:</span> {sub.device?.ua || '—'}</div>
                    </div>
                  </TabsContent>
                </Tabs>
                {data.submissions.length > 1 && (
                  <div className="text-xs text-muted-foreground"><div className="uppercase tracking-widest text-[10px] mb-1">History</div>{data.submissions.slice(1).map(s => <div key={s.id}>Attempt {s.attempt} · {new Date(s.submitted_at).toLocaleString()} · {s.status}{s.rejection_reason ? ` — ${s.rejection_reason}` : ''}</div>)}</div>
                )}
              </>
            )}
            {rejecting && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                <Label className="text-xs uppercase tracking-widest text-red-300">Rejection reason (shown to user)</Label>
                <Textarea value={rejReason} onChange={e => setRejReason(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Proof of address is older than 3 months. Liveness video too dark." className="bg-secondary border-red-500/20 text-sm" data-testid="fk-reject-reason"/>
                <div className="text-[11px] text-muted-foreground">Documents for the next attempt:</div>
                <div className="flex flex-wrap gap-1.5">
                  {FKYC_DOC_ORDER.map(d => <button key={d} onClick={() => setRedoDocs(x => x.includes(d) ? x.filter(y => y !== d) : [...x, d])} className={`text-[11px] rounded-full border px-2.5 py-1 ${redoDocs.includes(d) ? 'border-gold-500 bg-gold-500/10 text-gold' : 'border-gold-500/15 text-muted-foreground'}`}>{FKYC_DOCS[d].label}</button>)}
                </div>
              </div>
            )}
          </div>
        )}
        {fk?.active && (
          <DialogFooter className="gap-2 flex-wrap">
            {allowCancel && <Button variant="ghost" onClick={() => act('cancel')} disabled={busy} className="sm:mr-auto text-muted-foreground" data-testid="fk-cancel"><Ban className="h-4 w-4 mr-2"/>Lift without verification</Button>}
            {fk.status === 'submitted' && !rejecting && <Button variant="outline" onClick={() => setRejecting(true)} disabled={busy} className="border-red-500/40 text-red-400 hover:bg-red-500/10" data-testid="fk-reject-open"><X className="h-4 w-4 mr-2"/>Reject</Button>}
            {fk.status === 'submitted' && rejecting && <Button variant="outline" onClick={() => act('reject')} disabled={busy || !rejReason.trim()} className="border-red-500/40 text-red-400 hover:bg-red-500/10" data-testid="fk-reject-confirm">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Confirm rejection'}</Button>}
            {fk.status === 'submitted' && <Button onClick={() => act('approve')} disabled={busy} className="gold-btn" data-testid="fk-approve">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Check className="h-4 w-4 mr-2"/>{approveLabel}</>}</Button>}
          </DialogFooter>
        )}
        {zoom && <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoom(null)}><img src={zoom} alt="" className="max-h-full max-w-full rounded-xl"/></div>}
      </DialogContent>
    </Dialog>
  )
}

export default ForceKycAdmin
