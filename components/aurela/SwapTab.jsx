'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownUp, Loader2, TrendingUp, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp, FIAT_META, CRYPTO_META, CoinIcon, FlagIcon } from './store'
import { toast } from 'sonner'

export function SwapTab({ onDone }) {
  const { api, config, refreshUser } = useApp()
  const enabledFiat = config?.enabled_fiat || Object.keys(FIAT_META)
  const enabledCrypto = config?.enabled_crypto || Object.keys(CRYPTO_META)

  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('BTC')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [swapping, setSwapping] = useState(false)

  const isFiat = (c) => enabledFiat.includes(c)
  const iconOf = (c) => isFiat(c) ? <FlagIcon code={c} size={22}/> : <CoinIcon code={c} size={22}/>

  const fetchQuote = useCallback(async () => {
    if (!amount || Number(amount) <= 0) { setQuote(null); return }
    setQuoteLoading(true)
    try {
      const q = await api.post('/swap/quote', { from_currency: from, to_currency: to, amount: Number(amount) })
      setQuote(q)
    } catch(e) { setQuote(null) }
    finally { setQuoteLoading(false) }
  }, [api, from, to, amount])

  useEffect(() => {
    const t = setTimeout(fetchQuote, 350)
    return () => clearTimeout(t)
  }, [fetchQuote])

  const doSwap = async () => {
    if (!quote?.to_amount) return
    setSwapping(true)
    try {
      const res = await api.post('/swap', { from_currency: from, to_currency: to, amount: Number(amount) })
      toast.success(`Swapped ${res.transaction.from_amount} ${from} → ${res.transaction.to_amount} ${to}`)
      setAmount(''); setQuote(null)
      refreshUser()
      onDone && onDone()
    } catch(e) { toast.error(e.message || 'Swap failed') }
    finally { setSwapping(false) }
  }

  const flip = () => { setFrom(to); setTo(from); setAmount('') }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold"><ArrowDownUp className="h-3.5 w-3.5"/> Instant swap</div>
        <h2 className="font-display text-3xl md:text-4xl mt-2">Swap <span className="gold-text">anything</span> to anything.</h2>
        <p className="text-sm text-muted-foreground mt-2">Convert between any fiat and any crypto at live market rates. Settles instantly to your wallets.</p>
      </div>

      <div className="card-luxury rounded-3xl p-5 md:p-6 relative">
        {/* You pay */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-gold-500/15">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">You pay</div>
            {quote?.usd_value && <div className="text-[10px] text-muted-foreground">≈ ${quote.usd_value.toLocaleString()}</div>}
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number" inputMode="decimal" step="any" min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 border-0 bg-transparent text-2xl md:text-3xl font-display h-14 focus-visible:ring-0 px-0"
            />
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-[130px] h-12 bg-black/50 border-gold-500/30 rounded-xl">
                <span className="inline-flex items-center gap-2">{iconOf(from)} {from}</span>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Fiat</div>
                {enabledFiat.map(c => <SelectItem key={c} value={c}><span className="inline-flex items-center gap-2"><FlagIcon code={c} size={18}/> {c}</span></SelectItem>)}
                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>
                {enabledCrypto.map(c => <SelectItem key={c} value={c}><span className="inline-flex items-center gap-2"><CoinIcon code={c} size={18}/> {c}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center my-2">
          <button onClick={flip} type="button" className="h-10 w-10 rounded-full bg-gold-500/15 border border-gold-500/40 hover:bg-gold-500/25 hover:rotate-180 transition-all duration-500 flex items-center justify-center">
            <ArrowDownUp className="h-4 w-4 text-gold-bright"/>
          </button>
        </div>

        {/* You receive */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-gold-500/15">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">You receive</div>
            {quoteLoading && <Loader2 className="h-3 w-3 animate-spin text-gold"/>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-2xl md:text-3xl font-display h-14 flex items-center gold-text truncate">
              {quote?.to_amount ? Number(quote.to_amount).toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0.00'}
            </div>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="w-[130px] h-12 bg-black/50 border-gold-500/30 rounded-xl">
                <span className="inline-flex items-center gap-2">{iconOf(to)} {to}</span>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Fiat</div>
                {enabledFiat.map(c => <SelectItem key={c} value={c}><span className="inline-flex items-center gap-2"><FlagIcon code={c} size={18}/> {c}</span></SelectItem>)}
                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Crypto</div>
                {enabledCrypto.map(c => <SelectItem key={c} value={c}><span className="inline-flex items-center gap-2"><CoinIcon code={c} size={18}/> {c}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Rate info */}
        {quote?.rate && (
          <div className="mt-4 p-3 rounded-xl bg-black/30 border border-gold-500/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-gold"/>
              <span>Rate: 1 {from} ≈ <span className="font-mono text-gold-bright">{Number(quote.rate).toLocaleString(undefined, { maximumFractionDigits: 8 })}</span> {to}</span>
            </div>
            <div className="text-muted-foreground">Fee: <span className="text-gold-bright">{(quote.fee_bps/100).toFixed(2)}%</span></div>
          </div>
        )}

        <Button onClick={doSwap} disabled={!quote?.to_amount || swapping} className="gold-btn w-full mt-5 h-13 py-3 rounded-2xl text-base font-medium">
          {swapping ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Swapping…</> : <><Sparkles className="h-4 w-4 mr-2"/>Swap {from} → {to}</>}
        </Button>
      </div>
    </motion.div>
  )
}
