'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, defs, Area, AreaChart } from 'recharts'
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { useApp } from './store'

export function PortfolioChart() {
  const { api } = useApp()
  const [points, setPoints] = useState([])
  const [range, setRange] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/portfolio/history?days=${range}`).then(res => {
      if (cancelled) return
      setPoints(res.points || [])
    }).catch(()=>{}).finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [api, range])

  const first = points[0]?.total_usd || 0
  const last  = points[points.length - 1]?.total_usd || 0
  const change = first > 0 ? ((last - first) / first) * 100 : 0
  const up = change >= 0

  return (
    <div className="card-luxury rounded-2xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold"><Sparkles className="h-3.5 w-3.5"/> Portfolio value</div>
          <div className="font-display text-3xl md:text-4xl mt-2 gold-text">${Number(last).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          {points.length > 1 && (
            <div className={`text-xs mt-1 flex items-center gap-1 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
              {up ? <TrendingUp className="h-3.5 w-3.5"/> : <TrendingDown className="h-3.5 w-3.5"/>}
              {up ? '+' : ''}{change.toFixed(2)}% over {range}d
            </div>
          )}
        </div>
        <div className="flex gap-1 bg-secondary/50 rounded-full p-1">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setRange(d)} className={`px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-widest transition ${range === d ? 'bg-gold-500/25 text-gold-bright' : 'text-muted-foreground hover:text-gold'}`}>{d}d</button>
          ))}
        </div>
      </div>

      <div className="h-40 md:h-56 mt-4 -mx-2">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
        ) : points.length < 2 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-sm text-muted-foreground">Not enough history yet</div>
            <div className="text-xs text-muted-foreground/60 mt-1">Your portfolio value is captured once per day. Come back tomorrow to see the trend build up.</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="portfolioGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#d4af37" stopOpacity={0.5}/>
                  <stop offset="100%" stopColor="#d4af37" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#7a7a72', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
              <YAxis tick={{ fill: '#7a7a72', fontSize: 10 }} axisLine={false} tickLine={false} width={48} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v}`}/>
              <Tooltip
                contentStyle={{ background: 'rgba(10,10,14,0.95)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 12, color: '#f5f5f0', fontSize: 12 }}
                labelStyle={{ color: '#a8a8a0', fontSize: 10 }}
                formatter={(v) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'Portfolio']}
              />
              <Area type="monotone" dataKey="total_usd" stroke="#d4af37" strokeWidth={2} fill="url(#portfolioGold)" dot={false} activeDot={{ r: 4, fill: '#f5e29d', stroke: '#d4af37', strokeWidth: 2 }}/>
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
