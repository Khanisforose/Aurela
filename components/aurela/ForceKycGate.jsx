'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, KYC_COUNTRIES, KYC_DOCS_BY_COUNTRY } from './store'
import { AurelaLogo } from './Logo'
import { LivenessCheck } from './ForceKycLiveness'
import { FKYC_DOCS, FKYC_DOC_ORDER, SUPPORT_EMAIL, SOURCE_OF_FUNDS, taxIdName, compressImage, uploadChunked, fetchFileUrl, fmtCountdown, challengeLabel } from './forceKycShared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  ShieldCheck, ShieldAlert, Mail, LogOut, ChevronRight, ChevronLeft, Check, Camera, Upload, FileText, Loader2, RotateCcw,
  IdCard, BookUser, Car, Stamp, ScanFace, Home, Landmark, Receipt, Clock, Lock, AlertTriangle, Sparkles, UserRound, Hourglass,
} from 'lucide-react'

const DOC_ICONS = { IdCard, BookUser, Car, Stamp, ScanFace, Home, Landmark, FileText, Receipt }
const STEPS = [['intro', 'Overview'], ['personal', 'Details'], ['docs', 'Documents'], ['liveness', 'Liveness'], ['review', 'Submit']]
const draftKey = (uid, attempt) => `aurela_fkyc_draft_${uid}_${attempt}`

function supportHref(user) {
  const subject = encodeURIComponent(`Enhanced verification help — @${user?.username || ''}`)
  const body = encodeURIComponent(`Hello Aurela Support,\n\nI need help with the enhanced identity verification on my account.\n\nUsername: @${user?.username || ''}\nEmail: ${user?.email || ''}\n\n`)
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
}

// Watches for force-KYC being switched on (admin action) while the user is in the app
export function useForceKycWatcher() {
  const { user, refreshUser, tick } = useApp()
  useEffect(() => {
    const onLock = () => refreshUser()
    window.addEventListener('aurela:force-kyc', onLock)
    return () => window.removeEventListener('aurela:force-kyc', onLock)
  }, [refreshUser])
  useEffect(() => {
    if (!user || user.role === 'admin' || user.role === 'super_admin') return
    if (tick > 0 && tick % 4 === 0) refreshUser()   // every ~20s
  }, [tick])
}

export function ForceKycGate() {
  const { user, logout } = useApp()
  useForceKycWatcher()
  const fk = user?.force_kyc
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  // Lock the page scroll beneath the gate
  const active = !!fk?.active && !isAdmin
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])
  if (!active) return null
  return (
    <div className="fixed inset-0 z-[95] bg-onyx-950 overflow-y-auto overscroll-contain" data-testid="force-kyc-gate" role="alertdialog" aria-modal="true">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.12),transparent_60%)]"/>
      <header className="sticky top-0 z-10 border-b border-gold-500/10 bg-onyx-950/85 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center gap-3">
          <AurelaLogo size={28} glow={false}/>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold">Enhanced verification</div>
            <div className="text-xs text-muted-foreground truncate">@{user?.username}</div>
          </div>
          <a href={supportHref(user)} className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 px-3 h-8 text-xs text-gold hover:bg-gold-500/10 transition-colors" data-testid="force-kyc-support"><Mail className="h-3.5 w-3.5"/><span className="hidden sm:inline">Contact support</span><span className="sm:hidden">Support</span></a>
          <button onClick={logout} className="inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5" title="Sign out" data-testid="force-kyc-logout"><LogOut className="h-4 w-4"/></button>
        </div>
      </header>
      <main className="relative mx-auto max-w-2xl px-4 py-6 pb-24">
        {fk.status === 'submitted' ? <UnderReview fk={fk} user={user}/> : <Flow fk={fk} user={user}/>}
      </main>
    </div>
  )
}

// ---------------- Under review (48h) ----------------
function UnderReview({ fk, user }) {
  const due = new Date(fk.review_due_at || Date.now()).getTime()
  const sub = new Date(fk.submitted_at || Date.now()).getTime()
  const [nowTs, setNowTs] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNowTs(Date.now()), 1000); return () => clearInterval(id) }, [])
  const left = due - nowTs
  const pct = Math.min(100, Math.max(0, ((nowTs - sub) / Math.max(1, due - sub)) * 100))
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center" data-testid="force-kyc-under-review">
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(212,175,55,0.12)" strokeWidth="6"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="url(#fkg)" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray={`${pct} 100`}/>
          <defs><linearGradient id="fkg" x1="0" x2="1"><stop offset="0" stopColor="#f6e27a"/><stop offset="1" stopColor="#b8860b"/></linearGradient></defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Hourglass className="h-6 w-6 text-gold mb-1"/>
          <div className="font-mono text-lg tabular-nums" data-testid="force-kyc-countdown">{left > 0 ? fmtCountdown(left) : '—'}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{left > 0 ? 'max. remaining' : 'finalising'}</div>
        </div>
      </div>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">Verification under review</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{left > 0 ? 'Our compliance team is reviewing your documents and liveness check. This takes up to 48 hours — we’ll notify you the moment it’s done.' : 'Your review is taking a little longer than usual. Thank you for your patience — we’ll notify you as soon as it’s done.'}</p>
      </div>
      <div className="card-luxury rounded-2xl p-5 text-left space-y-4 max-w-md mx-auto">
        {[
          ['Submitted', new Date(sub).toLocaleString(), true],
          ['Compliance review', 'Documents, liveness and identity checks', 'current'],
          ['Decision', 'Full access is restored automatically once approved', false],
        ].map(([t, s, st], i) => (
          <div key={t} className="flex gap-3">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${st === true ? 'bg-gold-500 text-onyx-950' : st === 'current' ? 'bg-gold-500/15 text-gold ring-1 ring-gold-500/40' : 'bg-secondary text-muted-foreground'}`}>
              {st === true ? <Check className="h-4 w-4"/> : st === 'current' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <span className="text-xs">{i + 1}</span>}
            </div>
            <div><div className="text-sm font-medium">{t}</div><div className="text-xs text-muted-foreground">{s}</div></div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gold-500/15 bg-secondary/30 p-4 text-xs text-muted-foreground max-w-md mx-auto flex gap-3 text-left">
        <Lock className="h-4 w-4 text-gold shrink-0 mt-0.5"/>
        <span>Your funds are safe. Incoming payments continue to arrive, but sending, withdrawing, swapping and card use stay paused until verification is approved.</span>
      </div>
      <a href={supportHref(user)} className="inline-flex items-center gap-2 text-sm text-gold hover:underline"><Mail className="h-4 w-4"/>{SUPPORT_EMAIL}</a>
    </motion.div>
  )
}

// ---------------- Main flow ----------------
function Flow({ fk, user }) {
  const { api, refreshUser } = useApp()
  const reqDocs = useMemo(() => FKYC_DOC_ORDER.filter(d => (fk.required_docs || []).includes(d)), [fk.required_docs])
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState({})     // slot → { file_id, mime, name, size }
  const [personal, setPersonal] = useState({})
  const [live, setLive] = useState(null)          // { video_file_id, frames:[{file_id, challenge, at}], challenges, ... }
  const [liveUploading, setLiveUploading] = useState(null)
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const topRef = useRef(null)
  const dk = draftKey(user.id, fk.attempt || 1)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await api.get('/force-kyc')
        if (!alive) return
        const up = res?.uploads || {}
        setUploads(up)
        let draft = {}
        try { draft = JSON.parse(localStorage.getItem(dk) || '{}') } catch (e) {}
        setPersonal({ ...(res?.prefill || {}), ...(draft.personal || {}) })
        // Restore a liveness capture already uploaded for this attempt
        const frameSlots = Object.keys(up).filter(k => /^liveness_frame_\d+$/.test(k)).sort((a, b) => Number(a.split('_')[2]) - Number(b.split('_')[2]))
        if (frameSlots.length >= 4) {
          setLive({ video_file_id: up.liveness_video?.file_id || null, frames: frameSlots.map(k => ({ file_id: up[k].file_id, challenge: (up[k].name || '').split('-')[2] || 'center' })), challenges: frameSlots.map(k => (up[k].name || '').split('-')[2] || 'center'), restored: true })
        }
        if (draft.step != null && fk.status !== 'rejected') setStep(Math.min(draft.step, 4))
      } catch (e) { toast.error(e?.message || 'Could not load verification') }
      finally { alive && setLoading(false) }
    })()
    return () => { alive = false }
  }, [fk.attempt])
  useEffect(() => { if (!loading) try { localStorage.setItem(dk, JSON.stringify({ personal, step })) } catch (e) {} }, [personal, step, loading])
  useEffect(() => { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [step])

  const P = (k) => personal[k] || ''
  const setP = (k, v) => setPersonal(p => ({ ...p, [k]: v }))
  const needTax = reqDocs.includes('tax_id')
  const needSof = reqDocs.includes('source_of_funds')
  const personalFields = ['full_name', 'dob', 'nationality', 'country', 'city', 'address', 'postal_code', 'occupation', 'id_type', 'id_number', ...(needTax ? ['tax_id_number'] : []), ...(needSof ? ['source_of_funds'] : [])]
  const personalDone = personalFields.every(k => String(P(k)).trim())
  const docsDone = reqDocs.every(d => uploads[d]?.file_id)
  const liveDone = !!live && (live.frames?.length || 0) >= 4
  const canGo = [true, personalDone, docsDone, liveDone, true]

  const onLiveness = async (r) => {
    setLiveUploading(0)
    try {
      const totalParts = r.frames.length + (r.videoBlob ? 1 : 0)
      let done = 0
      const frames = []
      for (let i = 0; i < r.frames.length; i++) {
        const f = r.frames[i]
        const fid = await uploadChunked(api, { slot: `liveness_frame_${i}`, blob: f.blob, name: `frame-${i}-${f.challenge}` })
        frames.push({ file_id: fid, challenge: f.challenge, at: f.at })
        done++; setLiveUploading(Math.round((done / totalParts) * 100))
      }
      let video_file_id = null
      if (r.videoBlob) {
        video_file_id = await uploadChunked(api, { slot: 'liveness_video', blob: r.videoBlob, name: 'liveness-session', onProgress: (p) => setLiveUploading(Math.round(((done + p / 100) / totalParts) * 100)) })
      }
      setLive({ video_file_id, frames, challenges: r.challenges, started_at: r.started_at, completed_at: r.completed_at, duration_ms: r.duration_ms, face_signals: r.face_signals })
      toast.success('Liveness check saved')
      setStep(4)
    } catch (e) { toast.error(e?.message || 'Upload failed — please retry') }
    finally { setLiveUploading(null) }
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      await api.post('/force-kyc/submit', {
        personal: Object.fromEntries(personalFields.map(k => [k, String(P(k)).trim()])),
        docs: Object.fromEntries(reqDocs.map(d => [d, uploads[d]?.file_id])),
        liveness: live, consent,
        device: { platform: navigator.userAgentData?.platform || navigator.platform || '', screen: `${window.screen?.width}x${window.screen?.height}`, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
      })
      try { localStorage.removeItem(dk) } catch (e) {}
      toast.success('Submitted for review')
      await refreshUser()
    } catch (e) {
      toast.error(e?.message || 'Submission failed')
      if (e?.data?.missing_docs) setStep(2)
      else if (e?.data?.code === 'LIVENESS_REQUIRED') { setLive(null); setStep(3) }
      else if (e?.data?.missing) setStep(1)
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-gold"/></div>

  return (
    <div className="space-y-6" ref={topRef}>
      {/* Stepper */}
      <div className="flex items-center gap-1.5" data-testid="force-kyc-stepper">
        {STEPS.map(([id, label], i) => (
          <button key={id} onClick={() => { if (i <= step || canGo.slice(0, i).every(Boolean)) setStep(i) }} className="flex-1 group" aria-label={label}>
            <div className={`h-1 rounded-full transition-all duration-500 ${i < step ? 'bg-gold-500' : i === step ? 'bg-gradient-to-r from-gold-300 to-gold-600' : 'bg-secondary'}`}/>
            <div className={`mt-1.5 text-[10px] uppercase tracking-widest text-left hidden sm:block ${i === step ? 'text-gold' : 'text-muted-foreground'}`}>{label}</div>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          {step === 0 && <Intro fk={fk} reqDocs={reqDocs} onStart={() => setStep(1)}/>}
          {step === 1 && <Personal P={P} setP={setP} needTax={needTax} needSof={needSof}/>}
          {step === 2 && <Documents reqDocs={reqDocs} uploads={uploads} setUploads={setUploads}/>}
          {step === 3 && (
            <div className="space-y-4">
              <SectionTitle icon={ScanFace} title="Liveness check" sub="A quick guided video selfie confirms you are a real person and match your documents."/>
              {liveUploading != null ? (
                <div className="card-luxury rounded-2xl p-8 text-center space-y-3">
                  <Loader2 className="h-7 w-7 animate-spin text-gold mx-auto"/>
                  <div className="text-sm">Encrypting & uploading your capture… {liveUploading}%</div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden max-w-xs mx-auto"><div className="h-full bg-gradient-to-r from-gold-300 to-gold-600 transition-all" style={{ width: `${liveUploading}%` }}/></div>
                </div>
              ) : liveDone ? (
                <div className="card-luxury rounded-2xl p-6 text-center space-y-3" data-testid="liveness-done">
                  <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center"><Check className="h-7 w-7 text-emerald-400"/></div>
                  <div className="font-medium">Liveness check complete</div>
                  <div className="text-xs text-muted-foreground">{live.frames.length} captures · {live.frames.map(f => challengeLabel(f.challenge)).join(' · ')}</div>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => setLive(null)} className="border-gold-500/40 rounded-full"><RotateCcw className="h-4 w-4 mr-2"/>Redo</Button>
                    <Button onClick={() => setStep(4)} className="gold-btn rounded-full">Continue<ChevronRight className="h-4 w-4 ml-1"/></Button>
                  </div>
                </div>
              ) : <LivenessCheck onComplete={onLiveness}/>}
            </div>
          )}
          {step === 4 && <Review reqDocs={reqDocs} personal={personal} personalDone={personalDone} docsDone={docsDone} liveDone={liveDone} consent={consent} setConsent={setConsent} goto={setStep}/>}
        </motion.div>
      </AnimatePresence>

      {/* Footer nav */}
      {step > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-10 border-t border-gold-500/10 bg-onyx-950/90 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={submitting || liveUploading != null}><ChevronLeft className="h-4 w-4 mr-1"/>Back</Button>
            <div className="flex-1 text-center text-[11px] text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
            {step < 4 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canGo[step] || liveUploading != null} className="gold-btn rounded-full px-6" data-testid="force-kyc-next">Continue<ChevronRight className="h-4 w-4 ml-1"/></Button>
            ) : (
              <Button onClick={submit} disabled={submitting || !consent || !personalDone || !docsDone || !liveDone} className="gold-btn rounded-full px-6" data-testid="force-kyc-submit">{submitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <><ShieldCheck className="h-4 w-4 mr-2"/>Submit</>}</Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ icon: Icon, title, sub }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="h-10 w-10 rounded-xl bg-gold-500/10 ring-1 ring-gold-500/25 flex items-center justify-center shrink-0"><Icon className="h-5 w-5 text-gold"/></div>
      <div><div className="font-display text-xl">{title}</div>{sub && <div className="text-sm text-muted-foreground">{sub}</div>}</div>
    </div>
  )
}

function Intro({ fk, reqDocs, onStart }) {
  return (
    <div className="space-y-6" data-testid="force-kyc-intro">
      <div className="text-center space-y-4 pt-2">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }} className="relative mx-auto h-20 w-20">
          <div className="absolute inset-0 rounded-full bg-gold-500/20 blur-xl animate-pulse"/>
          <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-gold-300/20 to-gold-700/10 ring-1 ring-gold-500/40 flex items-center justify-center"><ShieldAlert className="h-9 w-9 text-gold"/></div>
        </motion.div>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl leading-tight">{fk.status === 'rejected' ? 'Please re-submit your verification' : 'Enhanced identity verification required'}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">To keep your account and funds secure, Aurela needs to re-verify your identity. Your account is paused until this is complete.</p>
        </div>
      </div>
      {fk.status === 'rejected' && fk.rejection_reason && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex gap-3" data-testid="force-kyc-rejection">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0"/>
          <div><div className="text-sm font-medium text-red-300">Your last submission was not approved</div><div className="text-sm text-muted-foreground mt-0.5">{fk.rejection_reason}</div></div>
        </div>
      )}
      {fk.reason && fk.status !== 'rejected' && (
        <div className="rounded-2xl border border-gold-500/25 bg-gold-500/5 p-4 text-sm"><div className="text-[10px] uppercase tracking-widest text-gold mb-1">Message from Aurela Compliance</div>{fk.reason}</div>
      )}
      <div className="card-luxury rounded-2xl p-5 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">What you'll need · about 5 minutes</div>
        <Row icon={UserRound} t="Personal details" s="Confirm your legal name, address and ID number"/>
        {reqDocs.map(d => { const meta = FKYC_DOCS[d]; const I = DOC_ICONS[meta.icon] || FileText; return <Row key={d} icon={I} t={meta.label} s={meta.hint}/> })}
        <Row icon={ScanFace} t="Liveness check" s="A short guided video selfie — about 20 seconds"/>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        {[[Clock, 'Up to 48h review', 'Reviewed by our compliance team'], [Lock, 'Bank-grade privacy', 'Encrypted, used only for verification'], [Sparkles, 'Incoming money arrives', 'Your balance keeps receiving funds']].map(([I, t, s]) => (
          <div key={t} className="rounded-2xl border border-gold-500/10 bg-secondary/30 p-3"><I className="h-4 w-4 text-gold mb-1.5"/><div className="font-medium text-sm">{t}</div><div className="text-muted-foreground">{s}</div></div>
        ))}
      </div>
      <Button onClick={onStart} className="gold-btn w-full h-12 rounded-xl text-base" data-testid="force-kyc-start">Start verification<ChevronRight className="h-5 w-5 ml-1"/></Button>
    </div>
  )
}
function Row({ icon: I, t, s }) {
  return <div className="flex gap-3"><div className="h-8 w-8 rounded-lg bg-gold-500/10 flex items-center justify-center shrink-0"><I className="h-4 w-4 text-gold"/></div><div className="min-w-0"><div className="text-sm font-medium">{t}</div><div className="text-xs text-muted-foreground">{s}</div></div></div>
}

function Field({ label, children, req = true }) {
  return <div className="space-y-1.5"><Label className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}{req && <span className="text-gold"> *</span>}</Label>{children}</div>
}
const inputCls = 'bg-secondary/60 border-gold-500/20 h-11 focus-visible:ring-gold-500/40'

function Personal({ P, setP, needTax, needSof }) {
  const cc = P('country')
  const idTypes = KYC_DOCS_BY_COUNTRY[cc] || KYC_DOCS_BY_COUNTRY.DEFAULT
  return (
    <div className="space-y-5" data-testid="force-kyc-personal">
      <SectionTitle icon={UserRound} title="Personal details" sub="Must match your documents exactly."/>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Full legal name"><Input value={P('full_name')} onChange={e => setP('full_name', e.target.value)} className={inputCls} placeholder="As shown on your ID" data-testid="fk-full-name"/></Field></div>
        <Field label="Date of birth"><Input type="date" value={P('dob')} onChange={e => setP('dob', e.target.value)} className={inputCls} data-testid="fk-dob"/></Field>
        <Field label="Nationality">
          <Select value={P('nationality')} onValueChange={v => setP('nationality', v)}><SelectTrigger className={inputCls} data-testid="fk-nationality"><SelectValue placeholder="Select"/></SelectTrigger><SelectContent className="max-h-72">{KYC_COUNTRIES.map(([c, l]) => <SelectItem key={c} value={c}>{l}</SelectItem>)}</SelectContent></Select>
        </Field>
        <Field label="Country of residence">
          <Select value={P('country')} onValueChange={v => { setP('country', v); setP('id_type', '') }}><SelectTrigger className={inputCls} data-testid="fk-country"><SelectValue placeholder="Select"/></SelectTrigger><SelectContent className="max-h-72">{KYC_COUNTRIES.map(([c, l]) => <SelectItem key={c} value={c}>{l}</SelectItem>)}</SelectContent></Select>
        </Field>
        <Field label="City"><Input value={P('city')} onChange={e => setP('city', e.target.value)} className={inputCls} data-testid="fk-city"/></Field>
        <div className="sm:col-span-2"><Field label="Residential address"><Input value={P('address')} onChange={e => setP('address', e.target.value)} className={inputCls} placeholder="Street, building, apartment" data-testid="fk-address"/></Field></div>
        <Field label="Postal / ZIP code"><Input value={P('postal_code')} onChange={e => setP('postal_code', e.target.value)} className={inputCls} data-testid="fk-postal"/></Field>
        <Field label="Occupation"><Input value={P('occupation')} onChange={e => setP('occupation', e.target.value)} className={inputCls} data-testid="fk-occupation"/></Field>
        <Field label="ID document type">
          <Select value={P('id_type')} onValueChange={v => setP('id_type', v)}><SelectTrigger className={inputCls} data-testid="fk-id-type"><SelectValue placeholder={cc ? 'Select' : 'Choose country first'}/></SelectTrigger><SelectContent>{idTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        </Field>
        <Field label="ID document number"><Input value={P('id_number')} onChange={e => setP('id_number', e.target.value.toUpperCase())} className={`${inputCls} font-mono`} data-testid="fk-id-number"/></Field>
        {needTax && <Field label={taxIdName(cc)}><Input value={P('tax_id_number')} onChange={e => setP('tax_id_number', e.target.value.toUpperCase())} className={`${inputCls} font-mono`} data-testid="fk-tax-id"/></Field>}
        {needSof && (
          <Field label="Main source of funds">
            <Select value={P('source_of_funds')} onValueChange={v => setP('source_of_funds', v)}><SelectTrigger className={inputCls} data-testid="fk-sof"><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{SOURCE_OF_FUNDS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          </Field>
        )}
      </div>
    </div>
  )
}

function Documents({ reqDocs, uploads, setUploads }) {
  const done = reqDocs.filter(d => uploads[d]?.file_id).length
  return (
    <div className="space-y-5" data-testid="force-kyc-docs">
      <div className="flex items-end justify-between gap-3">
        <SectionTitle icon={FileText} title="Documents" sub="Clear, colour photos. All corners visible, no glare."/>
        <div className="text-xs text-muted-foreground shrink-0">{done}/{reqDocs.length} done</div>
      </div>
      <div className="space-y-3">{reqDocs.map(d => <DocSlot key={d} slot={d} value={uploads[d]} onUploaded={(v) => setUploads(u => ({ ...u, [d]: v }))}/>)}</div>
    </div>
  )
}

function DocSlot({ slot, value, onUploaded }) {
  const { api } = useApp()
  const meta = FKYC_DOCS[slot]
  const I = DOC_ICONS[meta.icon] || FileText
  const camRef = useRef(null)
  const fileRef = useRef(null)
  const [progress, setProgress] = useState(null)
  const [thumb, setThumb] = useState(null)
  useEffect(() => {
    let url = null, alive = true
    if (value?.file_id && value.mime?.startsWith('image/')) fetchFileUrl(api, value.file_id).then(r => { url = r.url; alive ? setThumb(r.url) : URL.revokeObjectURL(r.url) }).catch(() => {})
    else setThumb(null)
    return () => { alive = false; url && URL.revokeObjectURL(url) }
  }, [value?.file_id])
  const onPick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (!(file.type.startsWith('image/') || (meta.pdf && file.type === 'application/pdf'))) return toast.error(meta.pdf ? 'Please choose a photo or PDF' : 'Please choose a photo')
    if (file.size > 12 * 1024 * 1024) return toast.error('File must be under 12 MB')
    setProgress(0)
    try {
      const blob = await compressImage(file)
      const fid = await uploadChunked(api, { slot, blob, name: file.name || slot, onProgress: setProgress })
      onUploaded({ file_id: fid, mime: blob.type || file.type, name: file.name, size: blob.size })
      toast.success(`${meta.label} uploaded`)
    } catch (err) { toast.error(err?.message || 'Upload failed') }
    finally { setProgress(null) }
  }
  const ok = !!value?.file_id
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${ok ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-gold-500/15 bg-secondary/30'}`} data-testid={`fk-doc-${slot}`}>
      <div className="flex gap-3 items-start">
        <div className={`relative h-16 w-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center ${ok ? 'bg-onyx-950' : 'bg-gold-500/10'}`}>
          {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover"/> : ok ? <FileText className="h-6 w-6 text-emerald-400"/> : <I className="h-6 w-6 text-gold"/>}
          {ok && <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="h-3 w-3 text-white"/></div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{meta.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{meta.hint}{meta.pdf ? ' Photo or PDF.' : ''}</div>
          {progress != null && (
            <div className="mt-2"><div className="h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-gradient-to-r from-gold-300 to-gold-600 transition-all" style={{ width: `${progress}%` }}/></div><div className="text-[10px] text-muted-foreground mt-1">Uploading… {progress}%</div></div>
          )}
          {progress == null && (
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button size="sm" onClick={() => camRef.current?.click()} className={ok ? 'h-8 bg-secondary hover:bg-secondary/80 text-foreground' : 'gold-btn h-8'} data-testid={`fk-doc-camera-${slot}`}><Camera className="h-3.5 w-3.5 mr-1.5"/>{ok ? 'Retake' : 'Take photo'}</Button>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="h-8 border-gold-500/30" data-testid={`fk-doc-upload-${slot}`}><Upload className="h-3.5 w-3.5 mr-1.5"/>{ok ? 'Replace' : 'Upload'}</Button>
            </div>
          )}
        </div>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture={meta.capture} className="hidden" onChange={onPick}/>
      <input ref={fileRef} type="file" accept={meta.pdf ? 'image/*,application/pdf' : 'image/*'} className="hidden" onChange={onPick} data-testid={`fk-doc-input-${slot}`}/>
    </div>
  )
}

function Review({ reqDocs, personal, personalDone, docsDone, liveDone, consent, setConsent, goto }) {
  const items = [
    ['Personal details', personalDone, 1, personal.full_name ? `${personal.full_name} · ${personal.id_type || ''}` : 'Incomplete'],
    ['Documents', docsDone, 2, `${reqDocs.length} required`],
    ['Liveness check', liveDone, 3, liveDone ? 'Captured' : 'Not done'],
  ]
  return (
    <div className="space-y-5" data-testid="force-kyc-review">
      <SectionTitle icon={ShieldCheck} title="Review & submit" sub="Check everything before sending it to our compliance team."/>
      <div className="card-luxury rounded-2xl divide-y divide-gold-500/10">
        {items.map(([t, ok, s, sub]) => (
          <button key={t} onClick={() => goto(s)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02]">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-300'}`}>{ok ? <Check className="h-4 w-4"/> : <AlertTriangle className="h-4 w-4"/>}</div>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium">{t}</div><div className="text-xs text-muted-foreground truncate">{sub}</div></div>
            <ChevronRight className="h-4 w-4 text-muted-foreground"/>
          </button>
        ))}
      </div>
      <label className="flex gap-3 items-start rounded-2xl border border-gold-500/15 bg-secondary/30 p-4 cursor-pointer">
        <Checkbox checked={consent} onCheckedChange={v => setConsent(!!v)} className="mt-0.5" data-testid="force-kyc-consent"/>
        <span className="text-xs text-muted-foreground leading-relaxed">I confirm that the information and documents I've provided are genuine, belong to me and are up to date. I consent to Aurela processing my biometric and identity data solely for verification and regulatory compliance.</span>
      </label>
      <div className="text-xs text-muted-foreground flex gap-2"><Clock className="h-4 w-4 text-gold shrink-0"/>Review takes up to 48 hours. Your account stays paused until approval.</div>
    </div>
  )
}

export default ForceKycGate
