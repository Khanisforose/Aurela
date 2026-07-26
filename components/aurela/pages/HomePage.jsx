'use client'

import { useApp } from '../store'
import { AurelaLogo } from '../Logo'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck, Globe2, Zap, CreditCard, Bitcoin, Users, LockKeyhole, Sparkles, TrendingUp, ChevronRight, Check } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const features = [
  { icon: Globe2, title: 'Multi-Currency Banking', desc: 'Hold and transact in 10+ major world currencies with real-time FX.' },
  { icon: Bitcoin, title: 'Institutional Crypto', desc: 'BTC, ETH, USDT and 7 more assets across ERC20, TRC20, BEP20, Solana, Polygon.' },
  { icon: CreditCard, title: 'Virtual Cards', desc: 'Basic, Premium and Elite tiers — activate on-chain, spend globally.' },
  { icon: Zap, title: 'Instant Transfers', desc: 'Send by username, email, wallet ID or QR. Zero-fee internal.' },
  { icon: ShieldCheck, title: 'Bank-Grade Security', desc: 'AES-256, JWT sessions, 2FA, device verification and audit logging.' },
  { icon: Users, title: 'Global Compliance', desc: 'KYC & AML architecture built for regulated markets.' },
]

const stats = [
  { k: '150+', v: 'Countries served' },
  { k: '10+', v: 'Fiat currencies' },
  { k: '10+', v: 'Crypto assets' },
  { k: '99.99%', v: 'Uptime SLA' },
]

const faqs = [
  { q: 'Is Aurela a bank?', a: 'Aurela is a global digital finance platform combining multi-currency accounts, crypto wallets and virtual card issuance. Regulated banking partnerships are actively being finalized in multiple jurisdictions.' },
  { q: 'Which cryptocurrencies are supported?', a: 'BTC, ETH, USDT, USDC, BNB, SOL, XRP, ADA, DOGE and MATIC across ERC20, TRC20, BEP20, Polygon and Solana networks.' },
  { q: 'How are card activation fees paid?', a: 'Card activation is paid in USDT to Aurela’s treasury wallet on the network configured by our operations team, or directly from your Aurela USDT balance. Fee amounts are set dynamically by administration.' },
  { q: 'What about KYC and AML?', a: 'All withdrawals and card issuance require completed KYC. Our compliance stack supports document review, sanctions screening and immutable audit trails.' },
  { q: 'How fast are transfers?', a: 'Internal fiat and crypto transfers settle instantly with zero fees inside the Aurela network. External settlements follow network confirmation times.' },
]

export function HomePage({ goAuth, goPage }) {
  const { rates } = useApp()
  return (
    <>
      {/* Hero */}
      <section className="relative">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 py-16 md:py-24 items-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-widest text-gold">
              <Sparkles className="h-3.5 w-3.5"/> The luxury standard in global finance
            </div>
            <h1 className="font-display text-5xl md:text-7xl mt-6 leading-[1.05]">
              Wealth without <span className="gold-text">borders.</span><br/>
              Banking without <span className="gold-text">limits.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Aurela unifies multi-currency banking, cryptocurrency and virtual cards into one elegant platform. Move money globally, instantly, privately.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" onClick={() => goAuth('register')} className="gold-btn rounded-full px-7 h-12 text-base">Create Aurela account <ArrowRight className="ml-2 h-4 w-4"/></Button>
              <Button size="lg" variant="outline" onClick={() => goPage('features')} className="rounded-full px-7 h-12 text-base border-gold-500/40 text-foreground hover:bg-gold-500/10">Explore features</Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-gold"/> Instant transfers</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-gold"/> 10 currencies · 10 cryptos</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-gold"/> 3-tier virtual cards</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.1 }} className="relative">
            <HeroCardStack />
          </motion.div>
        </div>

        <div className="container mx-auto">
          <div className="glass rounded-2xl px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="font-display text-3xl md:text-4xl gold-text">{s.k}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {rates && (
        <section className="py-8">
          <div className="container mx-auto">
            <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-gold"/> Live markets
              <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> LIVE
              </span>
              <span className="text-[10px] text-muted-foreground">updated {new Date(rates.updated_at).toLocaleTimeString()}</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
              {Object.entries(rates.crypto_usd || {}).map(([k,v]) => (
                <div key={k} className="glass rounded-xl px-4 py-3 min-w-[150px]">
                  <div className="text-xs text-muted-foreground">{k}/USD</div>
                  <div className="font-mono text-lg text-gold-bright">${Number(v).toLocaleString(undefined,{maximumFractionDigits: v < 0.01 ? 8 : v < 1 ? 4 : 2})}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Object.entries(rates.fx || {}).slice(0, 20).filter(([k]) => k !== 'USD').map(([k,v]) => (
                <div key={k} className="glass rounded-xl px-4 py-3 min-w-[140px]">
                  <div className="text-xs text-muted-foreground">USD/{k}</div>
                  <div className="font-mono text-lg text-gold-bright">{Number(v).toLocaleString(undefined,{maximumFractionDigits: v < 1 ? 4 : 2})}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-20">
        <div className="container mx-auto">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-widest text-gold">The platform</div>
            <h2 className="font-display text-4xl md:text-5xl mt-3">Everything a modern fortune needs.</h2>
            <p className="text-muted-foreground mt-4">One account. Every currency. Every asset. Engineered for global citizens, entrepreneurs and institutions.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i*0.05 }}
                className="card-luxury rounded-2xl p-6 hover:border-gold-500/50 transition">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-gold-500/25 to-gold-800/25 border border-gold-500/30">
                  <f.icon className="h-6 w-6 text-gold-bright"/>
                </div>
                <h3 className="font-display text-2xl mt-5">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-10">
            <Button onClick={() => goPage('features')} variant="outline" className="border-gold-500/40 rounded-full">See all features <ChevronRight className="ml-1 h-4 w-4"/></Button>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">Aurela Cards</div>
            <h2 className="font-display text-4xl md:text-5xl mt-3">Three tiers. One statement.</h2>
            <p className="text-muted-foreground mt-4 max-w-xl">Beautifully engineered virtual cards issued instantly. Freeze in a tap, spend anywhere Visa is accepted, activate on-chain with USDT.</p>
            <div className="mt-8 space-y-4">
              {['Basic','Premium','Elite'].map((t, i) => (
                <div key={t} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center text-onyx-900 font-bold">{i+1}</div>
                  <div>
                    <div className="font-display text-xl">Aurela {t}</div>
                    <div className="text-sm text-muted-foreground">{i===0?'Everyday spending with elegant simplicity.':i===1?'Elevated limits and priority privileges.':'The pinnacle. Reserved for the few.'}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Button onClick={() => goPage('cards')} className="gold-btn rounded-full">Discover cards <ArrowRight className="ml-2 h-4 w-4"/></Button>
            </div>
          </div>
          <div className="relative h-[420px]">
            <CardVisual tier="elite" style={{ top: 0, left: '10%', rotate: '-6deg', zIndex: 3 }} />
            <CardVisual tier="premium" style={{ top: 100, left: '30%', rotate: '2deg', zIndex: 2 }} />
            <CardVisual tier="basic" style={{ top: 200, left: '50%', rotate: '10deg', zIndex: 1 }} />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto">
          <div className="glass-strong rounded-3xl p-10 md:p-16 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-xs uppercase tracking-widest text-gold">Security</div>
              <h2 className="font-display text-4xl md:text-5xl mt-3">Engineered like a vault.</h2>
              <p className="text-muted-foreground mt-4">AES-256 encryption at rest. JWT + refresh tokens. Device fingerprinting. Rate limiting. Every admin action permanently logged. Every transaction fraud-scored.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[['AES-256', LockKeyhole],['JWT + 2FA', ShieldCheck],['Audit trail', Users],['Rate limits', Zap]].map(([t, Ico], i) => (
                <div key={i} className="card-luxury rounded-xl p-5">
                  <Ico className="h-5 w-5 text-gold-bright"/>
                  <div className="font-display text-lg mt-3">{t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-gold">FAQ</div>
            <h2 className="font-display text-4xl md:text-5xl mt-3">Discreet answers to serious questions.</h2>
          </div>
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`i${i}`} className="border-gold-500/15">
                <AccordionTrigger className="text-left font-display text-lg hover:text-gold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto">
          <div className="card-luxury rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(600px 300px at 50% 0%, rgba(212,175,55,0.25), transparent 70%)' }}/>
            <h2 className="font-display text-4xl md:text-6xl relative">Your money, <span className="gold-text">reimagined.</span></h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto relative">Join Aurela in minutes. Fund in any currency. Spend across the world.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4 relative">
              <Button size="lg" onClick={() => goAuth('register')} className="gold-btn rounded-full px-8 h-12">Open your account <ArrowRight className="ml-2 h-4 w-4"/></Button>
              <Button size="lg" variant="outline" onClick={() => goAuth('login')} className="rounded-full px-8 h-12 border-gold-500/40">Sign in</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function HeroCardStack() {
  return (
    <div className="relative h-[520px]">
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity }} className="absolute top-0 right-0 w-[380px]">
        <CardVisual tier="elite" showNumbers />
      </motion.div>
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity, delay: 0.5 }} className="absolute top-[140px] right-[80px] w-[380px]">
        <CardVisual tier="premium" showNumbers />
      </motion.div>
      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} className="absolute top-[290px] right-[160px] w-[380px]">
        <CardVisual tier="basic" showNumbers />
      </motion.div>
    </div>
  )
}

export function CardVisual({ tier = 'basic', style = {}, showNumbers = false }) {
  const label = tier === 'elite' ? 'ELITE' : tier === 'premium' ? 'PREMIUM' : 'BASIC'
  return (
    <div className={`absolute credit-card ${tier} rounded-2xl p-6 w-full aspect-[16/10]`} style={style}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <AurelaLogo size={28} glow={false}/>
          <div className="font-display text-lg tracking-widest text-gold-bright">AURELA</div>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-gold">{label}</div>
      </div>
      <div className="mt-8 flex items-center gap-3">
        <div className="h-8 w-10 rounded-md bg-gradient-to-br from-gold-300 to-gold-800"/>
        <div className="text-xs text-muted-foreground">WORLD</div>
      </div>
      <div className="font-mono text-xl md:text-2xl mt-4 tracking-widest text-gold-bright">
        {showNumbers ? '4260 •••• •••• 8842' : '•••• •••• •••• ••••'}
      </div>
      <div className="flex items-end justify-between mt-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cardholder</div>
          <div className="font-display">A U R E L A &nbsp;M E M B E R</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Valid thru</div>
          <div className="font-mono">12/28</div>
        </div>
      </div>
    </div>
  )
}
