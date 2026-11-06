'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from './store'
import { Flow } from './ForceKycGate'
import { fmtCountdown, SUPPORT_EMAIL } from './forceKycShared'
import { Button } from '@/components/ui/button'
import { X, Globe2, ShieldCheck, Hourglass, AlertTriangle, Sparkles, Mail, Check, Lock, Wallet } from 'lucide-react'

const hrsLabel = (h) => { const n = Number(h) || 0; return n === 0 ? 'instant' : `${n} hour${n === 1 ? '' : 's'}` }

// ---------- Card visual: black titanium + gold world grid ----------
export function MasterGlobalCardVisual({ card, compact = false, showCvvToggle = false }) {
  const [showCvv, setShowCvv] = useState(false)
  const num = card?.number || card?.number_masked || '5412 •••• •••• ••••'
  return (
    <div className={`relative aspect-[1.586] w-full overflow-hidden rounded-2xl ${compact ? 'p-3' : 'p-5 sm:p-6'} text-white select-none`} data-testid="global-card-visual"
      style={{ background: 'radial-gradient(120% 140% at 0% 0%, #2a2a2e 0%, #0d0d10 45%, #050506 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 25px 60px -20px rgba(212,175,55,0.35)' }}>
      {/* brushed metal */}
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 3px)' }}/>
      {/* globe grid */}
      <svg viewBox="0 0 200 200" className="absolute -right-10 -bottom-14 h-[115%] opacity-50" aria-hidden>
        <defs><linearGradient id="mg-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e27a"/><stop offset="1" stopColor="#8a6a12"/></linearGradient></defs>
        <circle cx="100" cy="100" r="92" fill="none" stroke="url(#mg-g)" strokeWidth="1"/>
        {[20, 40, 60, 80].map(r => <ellipse key={r} cx="100" cy="100" rx={r} ry="92" fill="none" stroke="url(#mg-g)" strokeWidth="0.6"/>)}
        {[-60, -30, 0, 30, 60].map(y => <ellipse key={y} cx="100" cy={100 + y} rx={Math.sqrt(Math.max(0, 92 * 92 - y * y))} ry={Math.max(2, 10 - Math.abs(y) / 8)} fill="none" stroke="url(#mg-g)" strokeWidth="0.6"/>)}
      </svg>
      {/* sheen */}
      <div className="absolute -inset-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent animate-[shimmer_6s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }}/>
      <div className="relative h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <div className={`uppercase tracking-[0.35em] text-gold-300 ${compact ? 'text-[7px]' : 'text-[9px]'}`}>Aurela</div>
            <div className={`font-display leading-none bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent ${compact ? 'text-sm mt-0.5' : 'text-xl sm:text-2xl mt-1'}`}>Master Global</div>
          </div>
          <Globe2 className={`${compact ? 'h-4 w-4' : 'h-6 w-6'} text-gold-300/90`}/>
        </div>
        <div className={`rounded-md bg-gradient-to-br from-gold-200 via-gold-400 to-gold-700 ${compact ? 'h-5 w-7' : 'h-8 w-11'} shadow-inner ring-1 ring-black/30`}/>
        <div>
          <div className={`font-mono tracking-[0.18em] ${compact ? 'text-[10px]' : 'text-base sm:text-lg'}`}>{num}</div>
          <div className={`flex items-end justify-between mt-1 ${compact ? 'text-[8px]' : 'text-[10px] sm:text-xs'}`}>
            <div className="min-w-0"><div className="uppercase text-white/50 text-[8px] tracking-widest">Card holder</div><div className="truncate uppercase tracking-wider">{card?.holder || 'MEMBER'}</div></div>
            <div className="flex gap-3 shrink-0">
              <div><div className="uppercase text-white/50 text-[8px] tracking-widest">Valid</div><div>{card?.expiry || '••/••'}</div></div>
              {!compact && <button type="button" onClick={() => showCvvToggle && setShowCvv(v => !v)} className="text-left"><div className="uppercase text-white/50 text-[8px] tracking-widest">CVV</div><div>{showCvv && card?.cvv ? card.cvv : '•••'}</div></button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Status panel under the card in the user's Cards tab ----------
export function GlobalCardStatus({ card, onVerify }) {
  const st = card.status
  const k = card.kyc || {}
  const [nowTs, setNowTs] = useState(Date.now())
  useEffect(() => { if (st !== 'kyc_review') return; const id = setInterval(() => setNowTs(Date.now()), 1000); return () => clearInterval(id) }, [st])
  if (st === 'kyc_required' || st === 'kyc_rejected') {
    return (
      <div className="w-full space-y-3" data-testid={`global-kyc-required-${card.id}`}>
        {st === 'kyc_rejected' ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs"><div className="text-red-400 font-medium flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5"/>Verification not approved</div><div className="text-muted-foreground mt-1">{k.rejection_reason}</div></div>
        ) : (
          <div className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-3 text-xs"><div className="text-gold font-medium flex items-center gap-1.5"><Check className="h-3.5 w-3.5"/>Payment confirmed</div><div className="text-muted-foreground mt-1">One last step: complete the enhanced verification (liveness + {(k.required_docs || []).length} documents). Review takes about {hrsLabel(card.review_hours ?? 24)}.</div></div>
        )}
        <Button onClick={onVerify} className="gold-btn w-full rounded-full" data-testid={`global-kyc-start-${card.id}`}><ShieldCheck className="h-4 w-4 mr-2"/>{st === 'kyc_rejected' ? 'Submit again' : 'Start enhanced verification'}</Button>
      </div>
    )
  }
  if (st === 'kyc_review') {
    const due = new Date(k.review_due_at || Date.now()).getTime()
    const sub = new Date(k.submitted_at || Date.now()).getTime()
    const left = due - nowTs
    const pct = Math.min(100, Math.max(0, ((nowTs - sub) / Math.max(1, due - sub)) * 100))
    return (
      <div className="w-full rounded-xl border border-gold-500/25 bg-gold-500/5 p-3" data-testid={`global-kyc-review-${card.id}`}>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-gold font-medium flex items-center gap-1.5"><Hourglass className="h-3.5 w-3.5"/>Verification under review</span>
          <span className="font-mono tabular-nums">{left > 0 ? fmtCountdown(left) : 'finalising…'}</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-2"><div className="h-full rounded-full bg-gradient-to-r from-gold-300 to-gold-600 transition-all duration-1000" style={{ width: `${pct}%` }}/></div>
        <div className="text-[11px] text-muted-foreground mt-2">Our compliance team approves your card within about {hrsLabel(card.review_hours ?? 24)}. You'll get a notification the moment it's unlocked.</div>
      </div>
    )
  }
  if (st === 'pending_activation') {
    return <div className="w-full text-[11px] text-muted-foreground flex gap-1.5"><Wallet className="h-3.5 w-3.5 text-gold shrink-0"/>Step 1 of 2: pay the {card.activation_fee_usdt} USDT card fee from an external wallet. Step 2: enhanced verification.</div>
  }
  return null
}

// ---------- Full-screen KYC overlay (closable — the app stays usable) ----------
export function GlobalCardKycOverlay({ card, onClose, onSubmitted }) {
  const { user } = useApp()
  useEffect(() => {
    if (!card) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [card?.id])
  if (!card) return null
  const k = card.kyc || {}
  const fk = { required_docs: k.required_docs || [], attempt: k.attempt || 1, status: card.status === 'kyc_rejected' ? 'rejected' : 'required', rejection_reason: k.rejection_reason, reason: '' }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[80] bg-onyx-950 overflow-y-auto overscroll-contain" data-testid="global-kyc-overlay">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.12),transparent_60%)]"/>
      <header className="sticky top-0 z-10 border-b border-gold-500/10 bg-onyx-950/85 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center gap-3">
          <div className="w-20 shrink-0"><MasterGlobalCardVisual card={card} compact/></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold">Master Global</div>
            <div className="text-xs text-muted-foreground truncate">Enhanced card verification</div>
          </div>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Master Global verification — @' + (user?.username || ''))}`} className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 px-3 h-8 text-xs text-gold hover:bg-gold-500/10"><Mail className="h-3.5 w-3.5"/>Support</a>
          <button onClick={onClose} className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5" aria-label="Close" data-testid="global-kyc-close"><X className="h-5 w-5"/></button>
        </div>
      </header>
      <main className="relative mx-auto max-w-2xl px-4 py-6 pb-24">
        <Flow fk={fk} user={user} cfg={{ loadUrl: `/cards/${card.id}/kyc`, submitUrl: `/cards/${card.id}/kyc/submit`, uploadExtra: { card_id: card.id }, variant: 'global', reviewHours: card.review_hours ?? 24, onSubmitted: async () => { await onSubmitted?.(); onClose() } }}/>
      </main>
    </motion.div>
  )
}
