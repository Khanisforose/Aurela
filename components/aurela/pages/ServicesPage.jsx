'use client'

import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ArrowRight, Send, ArrowDownToLine, ArrowUpFromLine, CreditCard, Bitcoin, Globe2, ShieldCheck, Wallet, Users, ScrollText, Sparkles } from 'lucide-react'

const services = [
  { icon: Wallet, title: 'Multi-Currency Accounts', desc: 'Individual and joint accounts across 10 fiat currencies with segregated ledgers, statements and conversion tools.' },
  { icon: Bitcoin, title: 'Crypto Wallet Custody', desc: 'Non-custodial-style user experience with institutional-grade key management across 5 blockchain networks.' },
  { icon: Send, title: 'Instant Global Transfers', desc: 'Zero-fee internal transfers by username, email, wallet ID or QR code. External settlement across banking and blockchain rails.' },
  { icon: CreditCard, title: 'Virtual Card Issuance', desc: 'On-demand virtual cards across Basic, Premium and Elite tiers, with dynamic limits and on-chain activation.' },
  { icon: ArrowDownToLine, title: 'Deposit Rails', desc: 'Accept funds via Bank Transfer, UPI, Stripe, PayPal, debit and credit cards, and every supported cryptocurrency.' },
  { icon: ArrowUpFromLine, title: 'Withdrawal Rails', desc: 'Move funds out to your bank, UPI or external crypto wallets with approval and risk controls.' },
  { icon: Globe2, title: 'Real-time FX', desc: 'Continuously refreshed interbank exchange rates power your dashboard, conversions and card spending.' },
  { icon: ShieldCheck, title: 'KYC & AML', desc: 'Document capture, sanctions screening, transaction monitoring and case management workflows for administrators.' },
  { icon: Users, title: 'Enterprise Admin', desc: 'A privileged super-admin console for funding, freezing, blocking and reviewing users, with permanent audit history.' },
  { icon: ScrollText, title: 'Audit & Reporting', desc: 'Immutable audit logs for every sensitive action, exportable transaction history and statement generation.' },
]

export function ServicesPage({ goAuth }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-widest text-gold">Services</div>
          <h1 className="font-display text-5xl md:text-6xl mt-3">A complete financial operating system.</h1>
          <p className="text-muted-foreground mt-5 text-lg">Aurela is more than a wallet. It is a full-stack digital finance operating system designed for individuals, entrepreneurs, family offices and institutions who demand elegance, control and global reach.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
          {services.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i*0.04 }}
              className="card-luxury rounded-2xl p-6">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-gold-500/25 to-gold-800/10 border border-gold-500/25">
                <s.icon className="h-6 w-6 text-gold-bright"/>
              </div>
              <div className="font-display text-xl mt-5">{s.title}</div>
              <div className="text-sm text-muted-foreground mt-2">{s.desc}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 grid md:grid-cols-2 gap-8">
          <div className="card-luxury rounded-3xl p-10">
            <Sparkles className="h-6 w-6 text-gold-bright"/>
            <div className="font-display text-3xl mt-4">For individuals</div>
            <p className="text-muted-foreground mt-3">Hold ten currencies and ten cryptocurrencies in one elegant account. Send anywhere. Spend everywhere. Freeze, unfreeze, control.</p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>• Zero-fee internal transfers on the Aurela network</li>
              <li>• Instant virtual cards with on-chain activation</li>
              <li>• Live FX and crypto market data</li>
              <li>• Two-factor authentication and device controls</li>
            </ul>
          </div>
          <div className="card-luxury rounded-3xl p-10">
            <ShieldCheck className="h-6 w-6 text-gold-bright"/>
            <div className="font-display text-3xl mt-4">For institutions</div>
            <p className="text-muted-foreground mt-3">Administrative-grade tooling, permanent audit trails, and modular compliance built for regulated jurisdictions and enterprise deployment.</p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>• Super-admin and admin roles with granular controls</li>
              <li>• KYC review, balance adjustments and account state management</li>
              <li>• Configurable currencies, cards, fees and treasury wallets</li>
              <li>• Immutable audit log of every privileged action</li>
            </ul>
          </div>
        </div>

        <div className="mt-14 card-luxury rounded-3xl p-10 md:p-14 text-center">
          <h3 className="font-display text-3xl md:text-4xl">Ready to redefine how you hold money?</h3>
          <p className="text-muted-foreground mt-2">Create an Aurela account in under 90 seconds.</p>
          <Button size="lg" onClick={() => goAuth('register')} className="gold-btn rounded-full px-8 h-12 mt-6">Open account <ArrowRight className="ml-2 h-4 w-4"/></Button>
        </div>
      </div>
    </section>
  )
}
