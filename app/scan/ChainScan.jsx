'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, Blocks, Users, Activity, Zap, ArrowRight, Copy, Loader2, ExternalLink } from 'lucide-react'

// Public Aurela Chain Scan — no auth required. SEO-indexable.
// This is a standalone client component fetched via /api/public/chain/*

const fmtTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return d.toLocaleDateString()
}

const shortHash = (h) => !h ? '—' : `${h.slice(0, 8)}…${h.slice(-6)}`

const typeColor = {
  transfer: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  deposit: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  withdraw: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  card_activation: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  reward: 'text-gold bg-gold-500/10 border-gold-500/20',
  swap: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
}

export default function ChainScan() {
  const [stats, setStats] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [q, setQ] = useState('')
  const [search, setSearch] = useState(null)
  const [searching, setSearching] = useState(false)
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        fetch('/api/public/chain/stats').then(r => r.json()),
        fetch('/api/public/chain?limit=30').then(r => r.json()),
      ])
      setStats(s); setBlocks(b.blocks || [])
    } catch(e) {}
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)   // live tick every 5s
    return () => clearInterval(t)
  }, [load])

  const doSearch = async () => {
    if (!q.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/public/chain/search?q=${encodeURIComponent(q.trim())}`).then(r => r.json())
      setSearch(res)
    } catch(e) { setSearch({ kind: 'error' }) }
    finally { setSearching(false) }
  }

  const copy = (v) => { navigator.clipboard.writeText(v); setCopied(v); setTimeout(() => setCopied(''), 1500) }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* SEO H1 hidden decoratively but readable to bots */}
      <div className="sr-only">
        <h1>Aurela Chain Scan — Aurela Blockchain Explorer</h1>
        <p>Search Aurela chain blocks, wallet addresses, and transactions. Live block feed. Explore the Aurela network in real time.</p>
      </div>

      {/* Header */}
      <header className="border-b border-gold-500/15 bg-black/60 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center text-black font-display font-bold text-sm">A</div>
            <div>
              <div className="font-display text-lg leading-none">Aurela<span className="text-gold">Scan</span></div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Public block explorer</div>
            </div>
          </Link>
          <Link href="/" className="text-xs text-muted-foreground hover:text-gold flex items-center gap-1">Open Aurela <ArrowRight className="h-3 w-3"/></Link>
        </div>
      </header>

      {/* Hero + Search */}
      <section className="container mx-auto px-4 py-10 md:py-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-widest text-gold mb-4">
            <Activity className="h-3.5 w-3.5 animate-pulse"/> Live network
          </div>
          <h2 className="font-display text-4xl md:text-6xl leading-[1.05]">The <span className="gold-text">Aurela</span> chain,<br/>in real time.</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl">Every deposit, withdrawal, transfer, swap and card activation on Aurela writes an anonymized block to the public chain. Search by block number, block hash, or Aurela ID (AUR…).</p>
        </motion.div>

        <div className="mt-6 flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Block # / hash / AUR123456789"
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-secondary/70 border border-gold-500/25 focus:border-gold-500/60 outline-none text-sm font-mono"/>
          </div>
          <button onClick={doSearch} disabled={searching} className="h-12 px-6 rounded-xl gold-btn font-medium flex items-center gap-2 disabled:opacity-60">
            {searching ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>} Search
          </button>
        </div>

        {/* Search result */}
        {search && (
          <div className="mt-6 card-luxury rounded-2xl p-6">
            {search.kind === 'block' && (
              <div>
                <div className="text-xs uppercase tracking-widest text-gold mb-3">Block #{search.block.block_number}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <Row label="Hash" value={search.block.hash} mono copy={copy} copied={copied}/>
                  <Row label="Prev hash" value={search.block.prev_hash} mono copy={copy} copied={copied}/>
                  <Row label="Type" value={search.block.type}/>
                  <Row label="Currency" value={search.block.currency}/>
                  <Row label="Amount" value={search.block.amount}/>
                  <Row label="Network" value={search.block.network}/>
                  <Row label="From" value={search.block.from_username} mono/>
                  <Row label="To" value={search.block.to_username} mono/>
                  <Row label="Timestamp" value={new Date(search.block.timestamp).toLocaleString()}/>
                </div>
              </div>
            )}
            {search.kind === 'address' && (
              <div>
                <div className="text-xs uppercase tracking-widest text-gold mb-3">Address {search.address.code}</div>
                <div className="text-xs text-muted-foreground mb-4">Joined the Aurela network on {new Date(search.address.joined).toLocaleDateString()}. Latest 50 blocks referencing this address.</div>
                <BlockList blocks={search.blocks}/>
              </div>
            )}
            {search.kind === 'not_found' && (
              <div className="text-center py-4">
                <div className="text-muted-foreground">No results found for <span className="font-mono text-gold">{q}</span></div>
                <div className="text-xs text-muted-foreground/60 mt-2">Try a block number, full block hash, or a valid Aurela ID (AUR…)</div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard icon={Blocks} label="Total blocks" value={stats?.total_blocks?.toLocaleString() || '—'}/>
          <StatCard icon={Zap} label="Latest block" value={stats?.latest_block ? `#${stats.latest_block.toLocaleString()}` : '—'}/>
          <StatCard icon={Activity} label="Blocks (24h)" value={stats?.blocks_24h?.toLocaleString() || '—'}/>
          <StatCard icon={Users} label="Registered addresses" value={stats?.registered_addresses?.toLocaleString() || '—'}/>
        </div>
      </section>

      {/* Latest blocks feed */}
      <section className="container mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl md:text-3xl">Latest blocks</h2>
          <div className="text-xs text-muted-foreground flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"/> Auto-refresh every 5s</div>
        </div>
        <BlockList blocks={blocks}/>
      </section>

      {/* Footer */}
      <footer className="border-t border-gold-500/15 mt-10">
        <div className="container mx-auto px-4 py-6 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
          <div>&copy; {new Date().getFullYear()} Aurela. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-gold">aurelawallet.com</Link>
            <a href="https://www.aurelawallet.com" className="hover:text-gold flex items-center gap-1">Open account <ExternalLink className="h-3 w-3"/></a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card-luxury rounded-xl p-4 md:p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground"><Icon className="h-3.5 w-3.5 text-gold"/> {label}</div>
      <div className="font-display text-2xl md:text-3xl mt-2 gold-text">{value}</div>
    </div>
  )
}

function Row({ label, value, mono = false, copy, copied }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/40 flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className={`mt-0.5 text-sm ${mono ? 'font-mono text-gold-bright break-all' : ''}`}>{value ?? '—'}</div>
      </div>
      {copy && value && mono && (
        <button onClick={() => copy(value)} className="text-muted-foreground hover:text-gold flex-shrink-0">
          <Copy className={`h-3.5 w-3.5 ${copied === value ? 'text-emerald-400' : ''}`}/>
        </button>
      )}
    </div>
  )
}

function BlockList({ blocks }) {
  if (!blocks || blocks.length === 0) return <div className="text-sm text-muted-foreground py-4">No blocks yet.</div>
  return (
    <div className="card-luxury rounded-2xl overflow-hidden divide-y divide-gold-500/10">
      <div className="hidden md:grid grid-cols-[100px_1fr_1fr_120px_100px_100px] gap-3 px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground bg-black/40">
        <div>Block #</div><div>From</div><div>To</div><div>Amount</div><div>Type</div><div>Time</div>
      </div>
      {blocks.map(b => (
        <div key={b.hash || b.block_number} className="grid grid-cols-1 md:grid-cols-[100px_1fr_1fr_120px_100px_100px] gap-2 md:gap-3 px-5 py-4 hover:bg-gold-500/5 transition">
          <div className="font-mono text-gold-bright text-sm">#{b.block_number}</div>
          <div className="font-mono text-xs text-muted-foreground truncate">{b.from_username || '—'}</div>
          <div className="font-mono text-xs text-muted-foreground truncate">{b.to_username || '—'}</div>
          <div className="font-mono text-sm">{typeof b.amount === 'number' ? b.amount.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'} <span className="text-[10px] text-muted-foreground">{b.currency}</span></div>
          <div><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest border ${typeColor[b.type] || 'text-muted-foreground bg-secondary/50 border-gold-500/10'}`}>{b.type}</span></div>
          <div className="text-xs text-muted-foreground">{fmtTime(b.timestamp)}</div>
        </div>
      ))}
    </div>
  )
}
