'use client'

import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { AurelaLogo } from '../Logo'
import { ArrowRight, Globe2, ShieldCheck, Sparkles, HeartHandshake, Compass, Award } from 'lucide-react'

const values = [
  { icon: Sparkles, title: 'Craftsmanship', desc: 'Every pixel and every endpoint is treated with the care of a jeweller. Precision is our aesthetic.' },
  { icon: ShieldCheck, title: 'Trust', desc: 'Custody of wealth is a sacred responsibility. We engineer as if lives depend on it, because they do.' },
  { icon: Globe2, title: 'Borderless', desc: 'A single global standard for financial access. Currencies, networks and jurisdictions unified.' },
  { icon: HeartHandshake, title: 'Discretion', desc: 'The most premium experiences are the quietest. Privacy is a first-class product feature.' },
  { icon: Compass, title: 'Independence', desc: 'Aurela is a platform, not a broker. We serve our members’ interests, and their interests only.' },
  { icon: Award, title: 'Excellence', desc: 'From onboarding to withdrawal, we set the highest bar in the industry and then exceed it.' },
]

const milestones = [
  { year: '2024', title: 'Foundation', desc: 'Aurela is founded around a single conviction: modern wealth deserves modern infrastructure.' },
  { year: '2025', title: 'Platform launch', desc: 'Multi-currency accounts, digital asset custody and virtual card issuance released.' },
  { year: '2026', title: 'Global expansion', desc: 'Regulated banking partnerships and remittance corridors across Europe, Middle East and Asia.' },
  { year: '2027+', title: 'Ecosystem', desc: 'Aurela Business, Aurela Wealth and Aurela Institutional — built on the same trusted core.' },
]

export function AboutPage({ goAuth }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-widest text-gold">About Aurela</div>
          <h1 className="font-display text-5xl md:text-6xl mt-3">Rebuilding the private bank <span className="gold-text">for the digital age.</span></h1>
          <p className="text-muted-foreground mt-5 text-lg">Aurela was created for a new generation of globally mobile individuals and enterprises who refuse to accept the compromises of legacy banking. We combine the discretion of private wealth management with the borderless composability of digital assets — into one elegant, unified account.</p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          <div className="card-luxury rounded-2xl p-8 md:col-span-2">
            <div className="text-xs uppercase tracking-widest text-gold">Mission</div>
            <h2 className="font-display text-3xl mt-3">Make wealth borderless, elegant and secure.</h2>
            <p className="text-muted-foreground mt-4">Traditional banking is fragmented across currencies, networks and jurisdictions. Cryptocurrency is powerful but often intimidating. Aurela was engineered to remove the friction between the two — giving every member access to a full-stack financial operating system that respects their time, protects their capital and honors their privacy.</p>
            <p className="text-muted-foreground mt-3">We operate under a founding conviction: the future of finance is not fintech, and it is not crypto. It is the beautiful synthesis of both.</p>
          </div>
          <div className="card-luxury rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <AurelaLogo size={80}/>
            <div className="font-display text-xl mt-4">Aurela’s promise</div>
            <p className="text-sm text-muted-foreground mt-2">One account. Every currency. Every asset. Zero compromise.</p>
          </div>
        </div>

        <div className="mt-16">
          <div className="text-xs uppercase tracking-widest text-gold">Our values</div>
          <h2 className="font-display text-3xl md:text-4xl mt-3">Six principles. Zero exceptions.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {values.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i*0.04 }}
                className="card-luxury rounded-2xl p-6">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-gold-500/25 to-gold-800/10 border border-gold-500/25">
                  <v.icon className="h-6 w-6 text-gold-bright"/>
                </div>
                <div className="font-display text-xl mt-5">{v.title}</div>
                <div className="text-sm text-muted-foreground mt-2">{v.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <div className="text-xs uppercase tracking-widest text-gold">Our journey</div>
          <h2 className="font-display text-3xl md:text-4xl mt-3">A long horizon, executed one quarter at a time.</h2>
          <div className="mt-8 grid md:grid-cols-4 gap-4">
            {milestones.map((m, i) => (
              <div key={i} className="card-luxury rounded-2xl p-6">
                <div className="gold-text font-display text-3xl">{m.year}</div>
                <div className="font-display text-lg mt-2">{m.title}</div>
                <div className="text-sm text-muted-foreground mt-2">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 glass-strong rounded-3xl p-10 md:p-14 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">Leadership</div>
            <h2 className="font-display text-3xl md:text-4xl mt-3">Built by operators who have shipped at scale.</h2>
            <p className="text-muted-foreground mt-4">Aurela is engineered by veterans of global banking, high-throughput payments infrastructure and cryptocurrency exchanges. We take security seriously and elegance seriously — without ever choosing between them.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {['Global banking', 'Payments infra', 'Crypto exchanges', 'Regulatory affairs'].map(t => (
              <div key={t} className="card-luxury rounded-xl p-5">
                <div className="text-xs uppercase tracking-widest text-gold">Discipline</div>
                <div className="font-display text-lg mt-2">{t}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 card-luxury rounded-3xl p-10 md:p-14 text-center">
          <h3 className="font-display text-3xl md:text-4xl">Join Aurela.</h3>
          <p className="text-muted-foreground mt-2">Take your place in the next generation of global finance.</p>
          <Button size="lg" onClick={() => goAuth('register')} className="gold-btn rounded-full px-8 h-12 mt-6">Open account <ArrowRight className="ml-2 h-4 w-4"/></Button>
        </div>
      </div>
    </section>
  )
}
