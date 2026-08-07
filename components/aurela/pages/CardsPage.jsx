'use client'

import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ArrowRight, Check, CreditCard, ShieldCheck, Snowflake, Sparkles } from 'lucide-react'
import { CardVisual } from './HomePage'

const tiersMeta = [
  {
    id: 'basic', name: 'Aurela Basic', tagline: 'Every day. Elegantly done.',
    spend: '$1,000 / day', withdraw: '$500 / day', monthly: '$10,000 / month',
    perks: ['Virtual card', 'Multi-currency wallets', 'Instant internal transfers', 'Standard support', 'Freeze / unfreeze in one tap']
  },
  {
    id: 'premium', name: 'Aurela Premium', tagline: 'Elevated in every dimension.',
    spend: '$10,000 / day', withdraw: '$5,000 / day', monthly: '$100,000 / month',
    perks: ['Everything in Basic', 'Higher limits', 'Priority KYC', 'Priority support', 'Enhanced fraud protection'], featured: true
  },
  {
    id: 'elite', name: 'Aurela Elite', tagline: 'The pinnacle. Reserved for the few.',
    spend: '$50,000 / day', withdraw: '$25,000 / day', monthly: '$500,000 / month',
    perks: ['Everything in Premium', 'Concierge onboarding', 'Dedicated relationship manager', 'Exclusive FX rates', 'Bespoke card design*']
  },
]

export function CardsPage({ goAuth }) {
  const { config } = useApp()
  const fees = config?.activation_fees || {}
  const wallet = config?.activation_wallet
  const network = config?.activation_network || 'ERC20'

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-widest text-gold">Cards</div>
          <h1 className="font-display text-5xl md:text-6xl mt-3">Three tiers. One statement.</h1>
          <p className="text-muted-foreground mt-5 text-lg">Every Aurela virtual card is issued in seconds, activated on-chain and controlled entirely by you. Choose the tier that matches your ambition.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-14">
          {tiersMeta.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className={`card-luxury rounded-3xl p-8 relative ${t.featured ? 'ring-1 ring-gold-500 shadow-[0_20px_60px_-20px_rgba(212,175,55,0.35)]' : ''}`}>
              {t.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 gold-btn rounded-full text-xs px-3 py-1">Most popular</div>}
              <div className="relative h-40 mb-6">
                <div className="absolute inset-0"><CardVisual tier={t.id} showNumbers style={{ position: 'relative', inset: 'auto' }}/></div>
              </div>
              <div className="font-display text-2xl">{t.name}</div>
              <div className="text-sm text-muted-foreground">{t.tagline}</div>
              <div className="mt-6 gold-text font-display text-3xl">Activate on-chain</div>
              <div className="divider-gold my-6"/>
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Daily spend</span><span>{t.spend}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Daily withdraw</span><span>{t.withdraw}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly spend</span><span>{t.monthly}</span></div>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {t.perks.map(pr => <li key={pr} className="flex items-center gap-2"><Check className="h-4 w-4 text-gold"/> {pr}</li>)}
              </ul>
              <Button onClick={() => goAuth('register')} className={`mt-6 w-full ${t.featured ? 'gold-btn' : ''}`} variant={t.featured ? 'default' : 'outline'}>
                Choose {t.name.split(' ')[1]} <ArrowRight className="ml-2 h-4 w-4"/>
              </Button>
            </motion.div>
          ))}
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          <div className="card-luxury rounded-2xl p-6">
            <Sparkles className="h-6 w-6 text-gold-bright"/>
            <div className="font-display text-xl mt-3">On-chain activation</div>
            <p className="text-sm text-muted-foreground mt-2">Card activation is settled in USDT on the {network} network to Aurela’s treasury wallet, or paid directly from your Aurela USDT balance. Activation fees are configured live by Aurela administration.</p>
            {wallet && <div className="mt-3 text-xs text-muted-foreground">Treasury (public): <span className="font-mono text-gold break-all">{wallet.slice(0,8)}…{wallet.slice(-6)}</span></div>}
          </div>
          <div className="card-luxury rounded-2xl p-6">
            <Snowflake className="h-6 w-6 text-gold-bright"/>
            <div className="font-display text-xl mt-3">Instant controls</div>
            <p className="text-sm text-muted-foreground mt-2">Freeze and unfreeze any card at any moment. Reveal CVV securely. Track every transaction as it happens.</p>
          </div>
          <div className="card-luxury rounded-2xl p-6">
            <ShieldCheck className="h-6 w-6 text-gold-bright"/>
            <div className="font-display text-xl mt-3">Regulator-ready</div>
            <p className="text-sm text-muted-foreground mt-2">All cardholder activity is bound to a completed KYC profile. Elevated tiers receive priority compliance and risk review.</p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground mt-6">*Bespoke card design available for Elite members subject to onboarding review.</p>
      </div>
    </section>
  )
}
