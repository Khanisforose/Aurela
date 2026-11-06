'use client'

import { useEffect, useState } from 'react'
import { useApp, KYC_COUNTRIES } from './store'
import { MasterGlobalCardVisual } from './GlobalCard'
import { ReviewDialog, SlaChip } from './ForceKycAdmin'
import { FKYC_DOCS, FKYC_DOC_ORDER, suggestedDocs, ENHANCED_PRESET, taxIdName } from './forceKycShared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Globe2, Search, Loader2, RefreshCw, Send, UserRound, ScanFace, Eye, Trash2, Clock, Coins, Edit3, Check } from 'lucide-react'

const ownerName = (u) => u?.full_name || u?.username || '—'
const countryLabel = (cc) => KYC_COUNTRIES.find(([c]) => c === cc)?.[1] || cc || '—'
const hrs = (h) => { const n = Number(h) || 0; return n === 0 ? 'Instant' : `${n} hour${n === 1 ? '' : 's'}` }
const STATUS = {
  pending_activation: ['Awaiting fee payment', 'border-muted text-muted-foreground'],
  pending_verification: ['Payment to verify', 'border-gold-500/40 text-gold'],
  rejected: ['Payment rejected', 'border-red-500/40 text-red-400'],
  kyc_required: ['Awaiting KYC', 'border-amber-500/40 text-amber-300'],
  kyc_review: ['KYC under review', 'border-gold-500 text-gold'],
  kyc_rejected: ['KYC resubmission', 'border-red-500/40 text-red-400'],
  active: ['Active', 'border-emerald-500/40 text-emerald-400'],
  deleted: ['Deleted by user', 'border-muted text-muted-foreground'],
}
const FILTERS = [['all', 'All'], ['kyc_review', 'KYC review'], ['pending_verification', 'Payment to verify'], ['pending_activation', 'Awaiting payment'], ['kyc_required', 'Awaiting KYC'], ['kyc_rejected', 'KYC resubmission'], ['active', 'Active']]

export function GlobalCardsAdmin() {
  const { api, tick } = useApp()
  const [status, setStatus] = useState('all')
  const [data, setData] = useState({ cards: [], counts: {}, defaults: {} })
  const [loading, setLoading] = useState(true)
  const [issueOpen, setIssueOpen] = useState(false)
  const [review, setReview] = useState(null)
  const [edit, setEdit] = useState(null)
  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try { const r = await api.get(`/admin/global-cards?status=${status}`); setData({ cards: r?.cards || [], counts: r?.counts || {}, defaults: r?.defaults || {} }) }
    catch (e) { toast.error(e?.message || 'Failed to load') } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [status])
  useEffect(() => { if (!review && !issueOpen && !edit) load(true) }, [tick])
  const del = async (c) => {
    if (typeof window !== 'undefined' && !window.confirm(`Permanently delete the Master Global card of ${ownerName(c.user)}?`)) return
    try { await api.del(`/admin/cards/${c.id}`); toast.success('Card deleted'); load(true) } catch (e) { toast.error(e?.message || 'Delete failed') }
  }
  const c = data.counts || {}
  const total = Object.entries(c).filter(([k]) => !['deleted', 'overdue'].includes(k)).reduce((a, [, n]) => a + n, 0)

  return (
    <div className="space-y-5" data-testid="global-cards-admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-2xl flex items-center gap-2"><Globe2 className="h-6 w-6 text-gold"/>Master Global</div>
          <div className="text-sm text-muted-foreground hidden sm:block">Admin-issued premium card. Flow: user pays the fee externally → you verify the payment in Card Approvals → user completes the enhanced KYC → you approve here and the card activates (geo hold lifted).</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-9"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}/></Button>
          <Button size="sm" onClick={() => setIssueOpen(true)} className="gold-btn h-9" data-testid="global-issue-open"><Send className="h-3.5 w-3.5 mr-1.5"/>Issue Master Global</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[['Issued', total, `${c.active || 0} active`, ''], ['KYC review', c.kyc_review || 0, `${c.overdue || 0} overdue`, c.overdue ? 'text-red-400' : ''], ['Payments to verify', c.pending_verification || 0, 'in Card Approvals', ''], ['Awaiting user', (c.pending_activation || 0) + (c.kyc_required || 0) + (c.kyc_rejected || 0), 'fee or KYC', '']].map(([l, v, s, cls]) => (
          <div key={l} className="card-luxury rounded-2xl p-3 sm:p-4 min-w-0">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground truncate">{l}</div>
            <div className="font-display text-xl sm:text-2xl gold-text mt-1">{v}</div>
            <div className={`text-[10px] sm:text-[11px] truncate ${cls || 'text-muted-foreground'}`}>{s}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${status === v ? 'border-gold-500 bg-gold-500/10 text-gold' : 'border-gold-500/15 text-muted-foreground hover:border-gold-500/40'}`}>{l}{v !== 'all' && c[v] ? <span className="ml-1.5 opacity-70">{c[v]}</span> : null}</button>
        ))}
      </div>

      {loading ? <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div> : data.cards.length === 0 ? (
        <div className="card-luxury rounded-2xl p-10 text-center space-y-3"><Globe2 className="h-8 w-8 text-gold mx-auto"/><div className="text-sm text-muted-foreground">No Master Global cards here yet.</div></div>
      ) : (
        <div className="space-y-3">
          {data.cards.map(card => (
            <div key={card.id} className={`card-luxury rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-4 ${card.status === 'kyc_review' ? 'ring-1 ring-gold-500/30' : ''}`} data-testid={`global-row-${card.id}`}>
              <div className="w-full sm:w-56 lg:w-44 shrink-0"><MasterGlobalCardVisual card={card} compact/></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs flex-1 min-w-0">
                <div className="col-span-2 min-w-0">
                  <div className="text-muted-foreground uppercase text-[10px]">Holder</div>
                  <div className="truncate font-medium">{ownerName(card.user)}</div>
                  <div className="truncate text-muted-foreground">@{card.user?.username || '—'} · {card.user?.email || ''}</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase text-[10px]">Fee · Review</div>
                  <div>{card.activation_fee_usdt} USDT · {hrs(card.review_hours)}</div>
                  <div className="text-muted-foreground">{(card.kyc?.required_docs || []).length} docs + liveness</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase text-[10px]">Status</div>
                  <Badge variant="outline" className={STATUS[card.status]?.[1] || ''}>{STATUS[card.status]?.[0] || card.status}</Badge>
                  {card.status === 'kyc_review' && <div className="mt-1"><SlaChip fk={{ status: 'submitted', review_due_at: card.kyc?.review_due_at }}/></div>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 justify-end">
                {card.status !== 'active' && <Button size="sm" variant="outline" onClick={() => setEdit(card)} className="border-gold-500/40" title="Edit fee / review hours"><Edit3 className="h-3.5 w-3.5"/></Button>}
                <Button size="sm" onClick={() => setReview(card)} className={card.status === 'kyc_review' ? 'gold-btn' : ''} variant={card.status === 'kyc_review' ? 'default' : 'outline'} data-testid={`global-review-${card.id}`}><Eye className="h-3.5 w-3.5 mr-1.5"/>{card.status === 'kyc_review' ? 'Review KYC' : 'KYC'}</Button>
                <Button size="sm" variant="outline" onClick={() => del(card)} className="border-red-500/40 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5"/></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <IssueDialog open={issueOpen} onOpenChange={setIssueOpen} defaults={data.defaults} onDone={() => { setIssueOpen(false); load(true) }}/>
      <EditDialog card={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(true) }}/>
      <ReviewDialog
        userId={review?.id} onClose={() => setReview(null)} onChanged={() => load(true)}
        loadUrl={review ? `/admin/global-cards/${review.id}/kyc` : undefined}
        actionBase={review ? `/admin/global-cards/${review.id}/kyc` : undefined}
        allowCancel={false} approveLabel="Approve & activate card"
        header={review && <div className="max-w-[260px]"><MasterGlobalCardVisual card={review} compact/></div>}
      />
    </div>
  )
}

function IssueDialog({ open, onOpenChange, defaults, onDone }) {
  const { api } = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState(null)
  const [fee, setFee] = useState('')
  const [hours, setHours] = useState('')
  const [docs, setDocs] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) { setFee(String(defaults?.fee_usdt ?? 500)); setHours(String(defaults?.review_hours ?? 24)); setDocs(defaults?.required_docs || ENHANCED_PRESET) }
    else { setQ(''); setResults([]); setPicked(null); setNote('') }
  }, [open])
  useEffect(() => {
    if (picked || q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => { setSearching(true); try { const r = await api.get(`/admin/force-kyc/lookup?q=${encodeURIComponent(q.trim())}`); setResults(r?.users || []) } catch (e) {} finally { setSearching(false) } }, 280)
    return () => clearTimeout(t)
  }, [q, picked])
  const toggle = (d) => setDocs(x => x.includes(d) ? x.filter(y => y !== d) : [...x, d])
  const feeN = Number(fee), hoursN = Number(hours)
  const valid = picked && fee !== '' && Number.isFinite(feeN) && feeN >= 0 && hours !== '' && Number.isFinite(hoursN) && hoursN >= 0 && hoursN <= 8760 && docs.length > 0
  const submit = async () => {
    setBusy(true)
    try { await api.post('/admin/global-cards/issue', { user_id: picked.id, fee_usdt: feeN, review_hours: hoursN, required_docs: docs, note: note.trim() || undefined }); toast.success(`Master Global issued to @${picked.username}`); onDone() }
    catch (e) { toast.error(e?.message || 'Issue failed') } finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="global-issue-dialog">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><Globe2 className="h-5 w-5 text-gold"/>Issue Master Global card</DialogTitle>
          <DialogDescription>Set the card fee, how many hours the KYC review takes, and the documents required.</DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-[220px_1fr] gap-5">
          <div className="space-y-2">
            <MasterGlobalCardVisual compact card={{ holder: picked ? (picked.full_name || picked.username || '').toUpperCase() : 'CARD HOLDER' }}/>
            <div className="text-[11px] text-muted-foreground text-center">Limits: $250k daily spend · $2.5M monthly</div>
          </div>
          <div className="space-y-4 min-w-0">
            {!picked ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">User</Label>
                <div className="relative"><Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground"/><Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search username, email, name or Aurela ID" className="pl-9 bg-secondary border-gold-500/20 h-10" data-testid="global-user-search"/></div>
                {searching && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/>Searching…</div>}
                {results.map(u => (
                  <button key={u.id} onClick={() => setPicked(u)} className="w-full text-left rounded-xl border border-gold-500/15 bg-secondary/40 hover:border-gold-500/50 p-3 flex items-center gap-3" data-testid={`global-user-result-${u.id}`}>
                    <UserRound className="h-4 w-4 text-gold shrink-0"/>
                    <div className="min-w-0"><div className="text-sm truncate">{ownerName(u)} <span className="text-muted-foreground">@{u.username}</span></div><div className="text-xs text-muted-foreground truncate">{u.email} · {countryLabel(u.country)} · KYC {u.kyc_status || 'none'}</div></div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-3 flex items-center gap-3">
                <UserRound className="h-5 w-5 text-gold"/>
                <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{ownerName(picked)} <span className="text-muted-foreground font-normal">@{picked.username}</span></div><div className="text-xs text-muted-foreground truncate">{picked.email} · {countryLabel(picked.country)}</div></div>
                <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>Change</Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3"/>Card fee (USDT)</Label>
                <Input type="number" min="0" step="any" value={fee} onChange={e => setFee(e.target.value)} className="bg-secondary border-gold-500/20 h-10 font-mono" data-testid="global-fee"/>
                <div className="text-[10px] text-muted-foreground">{feeN === 0 ? 'Free — goes straight to KYC' : 'Paid externally first'}</div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3"/>KYC review (hours)</Label>
                <Input type="number" min="0" max="8760" step="1" value={hours} onChange={e => setHours(e.target.value)} className="bg-secondary border-gold-500/20 h-10 font-mono" data-testid="global-hours"/>
                <div className="text-[10px] text-muted-foreground">Shown to user: “about {hrs(hoursN).toLowerCase()}”</div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 5, 12, 24, 48, 72].map(h => <button key={h} onClick={() => setHours(String(h))} className={`text-[11px] rounded-full border px-2.5 py-1 ${Number(hours) === h ? 'border-gold-500 bg-gold-500/10 text-gold' : 'border-gold-500/15 text-muted-foreground'}`}>{h}h</button>)}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Enhanced KYC documents</Label>
            <div className="flex gap-1.5">
              <button onClick={() => setDocs(ENHANCED_PRESET)} className="text-[11px] rounded-full border border-gold-500/30 px-2.5 py-1 text-gold hover:bg-gold-500/10">Intense (recommended)</button>
              {picked?.country && <button onClick={() => setDocs([...new Set([...suggestedDocs(picked.country), 'source_of_funds', 'bank_statement'])])} className="text-[11px] rounded-full border border-gold-500/30 px-2.5 py-1 text-gold hover:bg-gold-500/10">For {picked.country}</button>}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 p-3 flex gap-3 items-start"><Checkbox checked disabled className="mt-0.5"/><div><div className="text-sm font-medium flex items-center gap-1.5"><ScanFace className="h-3.5 w-3.5 text-gold"/>Liveness check</div><div className="text-[11px] text-muted-foreground">Always required</div></div></div>
            {FKYC_DOC_ORDER.map(d => (
              <label key={d} className={`rounded-xl border p-3 flex gap-3 items-start cursor-pointer transition-colors ${docs.includes(d) ? 'border-gold-500/50 bg-gold-500/5' : 'border-gold-500/10 bg-secondary/30 hover:border-gold-500/30'}`}>
                <Checkbox checked={docs.includes(d)} onCheckedChange={() => toggle(d)} className="mt-0.5"/>
                <div className="min-w-0"><div className="text-sm font-medium">{d === 'tax_id' && picked ? `${FKYC_DOCS[d].label} (${taxIdName(picked.country)})` : FKYC_DOCS[d].label}</div></div>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Internal note (optional)</Label>
          <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={300} className="bg-secondary border-gold-500/20 text-sm"/>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || busy} className="gold-btn" data-testid="global-issue-confirm">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Send className="h-4 w-4 mr-2"/>Issue card</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({ card, onClose, onDone }) {
  const { api } = useApp()
  const [fee, setFee] = useState('')
  const [hours, setHours] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (card) { setFee(String(card.activation_fee_usdt ?? '')); setHours(String(card.review_hours ?? 24)) } }, [card?.id])
  const feeEditable = card && ['pending_activation', 'rejected'].includes(card.status)
  const save = async () => {
    setBusy(true)
    try {
      const body = { review_hours: Number(hours) }
      if (feeEditable) body.fee_usdt = Number(fee)
      await api.put(`/admin/global-cards/${card.id}`, body); toast.success('Updated'); onDone()
    } catch (e) { toast.error(e?.message || 'Update failed') } finally { setBusy(false) }
  }
  return (
    <Dialog open={!!card} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-onyx-900 border-gold-500/20 max-w-sm">
        <DialogHeader><DialogTitle className="font-display">Edit Master Global</DialogTitle><DialogDescription>{ownerName(card?.user)}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">KYC review (hours)</Label><Input type="number" min="0" max="8760" value={hours} onChange={e => setHours(e.target.value)} className="bg-secondary border-gold-500/20 h-10 font-mono"/>{card?.status === 'kyc_review' && <div className="text-[10px] text-muted-foreground">The user's countdown is recalculated from their submission time.</div>}</div>
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">Card fee (USDT)</Label><Input type="number" min="0" value={fee} onChange={e => setFee(e.target.value)} disabled={!feeEditable} className="bg-secondary border-gold-500/20 h-10 font-mono"/>{!feeEditable && <div className="text-[10px] text-muted-foreground">Locked — the user has already paid.</div>}</div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy || hours === ''} className="gold-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Check className="h-4 w-4 mr-2"/>Save</>}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default GlobalCardsAdmin
