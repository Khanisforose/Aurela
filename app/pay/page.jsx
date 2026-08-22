'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, Sparkles, Loader2, User, Send, ExternalLink } from 'lucide-react'

// Public /pay page — receives ?to=AUR123&amount=10&currency=USDT
// Shows a payment card preview then deep-links into the app.
// NOTE: useSearchParams() must be inside a <Suspense> boundary for Next.js 15 production builds.
export default function PayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gold"/></div>}>
      <PayInner/>
    </Suspense>
  )
}

function PayInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const to = (sp.get('to') || '').toUpperCase()
  const amount = sp.get('amount') || ''
  const currency = (sp.get('currency') || 'USDT').toUpperCase()
  const memo = sp.get('memo') || ''

  const [recipient, setRecipient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!to) { setError('Missing recipient'); setLoading(false); return }
    fetch(`/api/pay/lookup?to=${encodeURIComponent(to)}`).then(r => r.json())
      .then(res => { if (res.recipient) setRecipient(res.recipient); else setError(res.error || 'Recipient not found') })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false))
  }, [to])

  const continueInApp = () => {
    const q = new URLSearchParams()
    q.set('tab', 'transfer')
    if (to) q.set('send_to', to)
    if (amount) q.set('send_amount', amount)
    if (currency) q.set('send_currency', currency)
    if (memo) q.set('send_memo', memo)
    router.push(`/?${q.toString()}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center text-black font-display font-bold">A</div>
          <div className="font-display text-2xl tracking-widest">AURELA</div>
        </Link>

        <div className="card-luxury rounded-3xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(400px 200px at 50% 0%, rgba(212,175,55,0.2), transparent 70%)' }}/>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[10px] uppercase tracking-widest text-gold"><Sparkles className="h-3 w-3"/> Aurela payment link</div>
            <div className="font-display text-3xl md:text-4xl mt-4">Send to <span className="gold-text">{to}</span></div>
            <div className="text-sm text-muted-foreground mt-1">Verify the recipient before confirming your payment.</div>

            {loading ? (
              <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Looking up recipient…</div>
            ) : error ? (
              <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-sm text-red-300">{error}</div>
            ) : (
              <div className="mt-6 p-4 rounded-2xl bg-secondary/60 border border-gold-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center text-black font-display font-bold text-lg">{recipient.name?.charAt(0) || 'A'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{recipient.name || 'Aurela member'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{recipient.code}</div>
                    {recipient.country && <div className="text-[10px] text-muted-foreground/70">{recipient.country}</div>}
                  </div>
                  <div className="h-6 w-6 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center"><Shield className="h-3 w-3 text-emerald-400"/></div>
                </div>
              </div>
            )}

            {(amount || currency) && (
              <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-gold-500/15">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount</div>
                <div className="font-display text-3xl gold-text mt-1">{amount ? Number(amount).toLocaleString() : '—'} <span className="text-lg text-foreground/70">{currency}</span></div>
                {memo && <div className="text-xs text-muted-foreground mt-2">Note: {memo}</div>}
              </div>
            )}

            <button onClick={continueInApp} disabled={!recipient} className="gold-btn w-full mt-6 h-13 rounded-2xl text-base py-3 flex items-center justify-center gap-2 disabled:opacity-40">
              <Send className="h-4 w-4"/> Continue in Aurela <ArrowRight className="h-4 w-4"/>
            </button>
            <p className="text-[10px] text-muted-foreground/60 text-center mt-3">You will be signed in and taken straight to the transfer screen with these details pre-filled.</p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-xs text-muted-foreground hover:text-gold inline-flex items-center gap-1">Or open aurelawallet.com <ExternalLink className="h-3 w-3"/></Link>
        </div>
      </motion.div>
    </div>
  )
}
