'use client'

import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ArrowRight, Globe2, Wallet, Bitcoin, Send, CreditCard, ArrowDownToLine, ArrowUpFromLine, ShieldCheck, Users, ScrollText, Zap, LockKeyhole, Fingerprint, BellRing, KeyRound } from 'lucide-react'

const groups = [
  {
    title: 'Banking',
    color: 'from-gold-500/20 to-gold-800/10',
    items: [
      { icon: Globe2, title: '10 Fiat Currencies', desc: 'USD, EUR, GBP, INR, AED, JPY, CAD, AUD, SGD, CHF with real-time interbank rates.' },
      { icon: Wallet, title: 'Segregated Wallets', desc: 'Every currency held in its own ledger with pending / available balances.' },
      { icon: ArrowDownToLine, title: 'Universal Deposits', desc: 'Bank transfer, UPI, Stripe, PayPal, debit and credit card rails.' },
      { icon: ArrowUpFromLine, title: 'Managed Withdrawals', desc: 'Bank / UPI / crypto external, with approval workflows and risk controls.' },
    ]
  },
  {
    title: 'Cryptocurrency',
    color: 'from-gold-500/20 to-gold-800/10',
    items: [
      { icon: Bitcoin, title: '10 Digital Assets', desc: 'BTC, ETH, USDT, USDC, BNB, SOL, XRP, ADA, DOGE, MATIC.' },
      { icon: Globe2, title: '5 Networks', desc: 'ERC20, TRC20, BEP20, Polygon and Solana. Automatic address generation.' },
      { icon: Send, title: 'On-chain + Off-chain', desc: 'Instant free internal transfers, verified on-chain withdrawals.' },
      { icon: ScrollText, title: 'Live market data', desc: 'Continuously refreshed spot rates directly on your dashboard.' },
    ]
  },
  {
    title: 'Cards & Spending',
    color: 'from-gold-500/30 to-gold-800/10',
    items: [
      { icon: CreditCard, title: '3 Tier Virtual Cards', desc: 'Basic, Premium and Elite — issued instantly, activated on-chain.' },
      { icon: LockKeyhole, title: 'Freeze / Unfreeze', desc: 'Full cardholder control from your dashboard, in real time.' },
      { icon: ShieldCheck, title: 'Configurable Limits', desc: 'Per-tier daily and monthly spend / withdraw ceilings.' },
      { icon: Zap, title: 'Global acceptance', desc: 'Card credentials designed for worldwide merchants and gateways.' },
    ]
  },
  {
    title: 'Security & Compliance',
    color: 'from-gold-500/20 to-gold-800/10',
    items: [
      { icon: KeyRound, title: 'JWT + Refresh Tokens', desc: 'Rotating sessions with revocation and device binding.' },
      { icon: Fingerprint, title: 'KYC & AML', desc: 'Regulator-ready identity capture and monitoring architecture.' },
      { icon: BellRing, title: 'Fraud Detection', desc: 'Behavioural signals and rate limiting on every sensitive endpoint.' },
      { icon: ScrollText, title: 'Immutable Audit Trail', desc: 'Every admin and money-movement action permanently logged.' },
    ]
  }
]

export function FeaturesPage({ goAuth }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-widest text-gold">Features</div>
          <h1 className="font-display text-5xl md:text-6xl mt-3">A private bank engineered as software.</h1>
          <p className="text-muted-foreground mt-5 text-lg">Aurela consolidates the primitives of modern global finance — multi-currency accounts, cryptocurrency wallets, virtual card issuance, real-time settlement and compliance — into a single, unified platform. Everything you need to move, hold and grow wealth internationally.</p>
        </div>

        {groups.map((g, gi) => (
          <div key={g.title} className="mt-16">
            <div className="flex items-baseline gap-3">
              <div className="text-xs uppercase tracking-widest text-gold">Chapter {String(gi+1).padStart(2,'0')}</div>
              <h2 className="font-display text-3xl md:text-4xl">{g.title}</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-5 mt-6">
              {g.items.map((it, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i*0.05 }}
                  className="card-luxury rounded-2xl p-6 flex gap-4">
                  <div className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${g.color} border border-gold-500/25`}>
                    <it.icon className="h-6 w-6 text-gold-bright"/>
                  </div>
                  <div>
                    <div className="font-display text-xl">{it.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">{it.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-16 card-luxury rounded-3xl p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-3xl">Experience the platform.</h3>
            <p className="text-muted-foreground mt-2">Open an Aurela account in under 90 seconds — no minimum balance.</p>
          </div>
          <Button size="lg" onClick={() => goAuth('register')} className="gold-btn rounded-full px-8 h-12">Open account <ArrowRight className="ml-2 h-4 w-4"/></Button>
        </div>
      </div>
    </section>
  )
}
