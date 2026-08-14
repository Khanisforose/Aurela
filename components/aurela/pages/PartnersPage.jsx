'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Handshake, Sparkles } from 'lucide-react'

// Curated list of global fintech / crypto / banking brands. Rendered as gold-outlined
// wordmarks (not raw logo files) to preserve Aurela's luxury identity while linking to
// each brand's official site.
const PARTNERS = [
  // Crypto Exchanges
  { name: 'Binance',              category: 'Crypto Exchange', url: 'https://www.binance.com' },
  { name: 'Coinbase',             category: 'Crypto Exchange', url: 'https://www.coinbase.com' },
  { name: 'Kraken',               category: 'Crypto Exchange', url: 'https://www.kraken.com' },
  { name: 'Bybit',                category: 'Crypto Exchange', url: 'https://www.bybit.com' },
  { name: 'OKX',                  category: 'Crypto Exchange', url: 'https://www.okx.com' },
  // Banks
  { name: 'JPMorgan Chase',       category: 'Banking',         url: 'https://www.jpmorganchase.com' },
  { name: 'Bank of America',      category: 'Banking',         url: 'https://www.bankofamerica.com' },
  { name: 'HSBC',                 category: 'Banking',         url: 'https://www.hsbc.com' },
  { name: 'Citi',                 category: 'Banking',         url: 'https://www.citi.com' },
  { name: 'Barclays',             category: 'Banking',         url: 'https://www.barclays.com' },
  { name: 'Standard Chartered',   category: 'Banking',         url: 'https://www.sc.com' },
  // FinTech Payments
  { name: 'Wise',                 category: 'Global Payments', url: 'https://wise.com' },
  { name: 'Revolut',              category: 'Neobank',         url: 'https://www.revolut.com' },
  { name: 'Stripe',               category: 'Payments',        url: 'https://stripe.com' },
  { name: 'PayPal',               category: 'Payments',        url: 'https://www.paypal.com' },
  // Card Networks
  { name: 'Mastercard',           category: 'Card Network',    url: 'https://www.mastercard.com' },
  { name: 'Visa',                 category: 'Card Network',    url: 'https://www.visa.com' },
  { name: 'Apple Pay',            category: 'Wallet',          url: 'https://www.apple.com/apple-pay/' },
  { name: 'Google Pay',           category: 'Wallet',          url: 'https://pay.google.com' },
  // Crypto Infrastructure
  { name: 'Circle',               category: 'Stablecoin',      url: 'https://www.circle.com' },
  { name: 'Tether',               category: 'Stablecoin',      url: 'https://tether.to' },
  { name: 'Ethereum Foundation',  category: 'Blockchain',      url: 'https://ethereum.foundation' },
  { name: 'Solana Foundation',    category: 'Blockchain',      url: 'https://solana.org' },
  { name: 'Chainalysis',          category: 'Compliance',      url: 'https://www.chainalysis.com' },
]

function PartnerCard({ name, category, url, index }) {
  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: (index % 12) * 0.04 }}
      whileHover={{ y: -4 }}
      className="group relative block"
    >
      <div className="card-luxury rounded-2xl h-32 md:h-36 p-5 flex flex-col items-center justify-center text-center transition-all duration-300 border border-gold-500/20 hover:border-gold-500/70 hover:shadow-[0_0_25px_rgba(212,175,55,0.35)] overflow-hidden">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(212,175,55,0.18), transparent 65%)' }}/>
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          <div className="font-display text-lg md:text-xl leading-tight" style={{
            WebkitTextStroke: '0.5px rgba(212,175,55,0.85)',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.02em',
          }}>{name}</div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 group-hover:text-gold-bright transition-colors">{category}</div>
          <ExternalLink className="h-3 w-3 text-gold-bright/40 group-hover:text-gold-bright transition-colors mt-1"/>
        </div>
      </div>
    </motion.a>
  )
}

export function PartnersPage() {
  return (
    <div className="container mx-auto py-16 md:py-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-widest text-gold">
          <Handshake className="h-3.5 w-3.5"/> Our ecosystem
        </div>
        <h1 className="font-display text-5xl md:text-6xl mt-6 leading-[1.05]">
          The world's finest, <span className="gold-text">connected.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Aurela operates at the intersection of global banking, digital assets and modern payments. We work alongside the world's leading financial institutions, exchanges and infrastructure providers to power every account in our ecosystem.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 mt-14">
        {PARTNERS.map((p, i) => <PartnerCard key={p.name} {...p} index={i}/>)}
      </div>

      <div className="mt-16 card-luxury rounded-2xl p-8 md:p-10 text-center max-w-2xl mx-auto">
        <Sparkles className="h-6 w-6 text-gold mx-auto"/>
        <div className="font-display text-2xl md:text-3xl mt-3">Become an Aurela partner</div>
        <p className="text-sm text-muted-foreground mt-3">
          Institutional treasuries, banks, custodians and payment networks — collaborate with Aurela to bring luxury digital finance to your customers. Reach out to <a href="mailto:partners@aurelawallet.com" className="text-gold hover:underline">partners@aurelawallet.com</a>.
        </p>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/60 mt-10 max-w-3xl mx-auto">
        Brand names above are trademarks of their respective owners and are listed for illustrative purposes as part of the global financial ecosystem in which Aurela operates. Listing does not necessarily imply a commercial partnership.
      </p>
    </div>
  )
}
