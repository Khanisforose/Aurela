'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from './store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Loader2, MapPin, MapPinOff, Users, Globe2, ShieldAlert } from 'lucide-react'

// Admin: world map of where users last signed in from + country hotspots.
// Uses Leaflet (no API key) with Esri's dark gray basemap to match the black/gold theme.
// Esri World Dark Gray Canvas — free, no API key, natively dark (max zoom 16)
const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
const ATTR = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors'

// Load Leaflet 1.9.4 from the official CDN (no bundling → immune to dev-server chunk churn, lighter prod bundle)
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
let leafletPromise = null
function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = LEAFLET_CSS
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; link.crossOrigin = ''
      document.head.appendChild(link)
    }
    const script = document.createElement('script')
    script.src = LEAFLET_JS; script.async = true
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; script.crossOrigin = ''
    script.onload = () => window.L ? resolve(window.L) : reject(new Error('Leaflet failed to initialise'))
    script.onerror = () => { leafletPromise = null; script.remove(); reject(new Error('Leaflet script failed to load')) }
    document.head.appendChild(script)
  })
  return leafletPromise
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function UsersMapAdmin() {
  const { api } = useApp()
  const [data, setData] = useState({ points: [], countries: [], totals: { users: 0, located: 0, denied: 0, never: 0 } })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDenied, setShowDenied] = useState(true)
  const [onlyHold, setOnlyHold] = useState(false)
  const [selected, setSelected] = useState(null) // country name
  const [mapReady, setMapReady] = useState(false)
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const LRef = useRef(null)
  const layerRef = useRef(null)
  const hotspotRef = useRef(null)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try { const res = await api.get('/admin/locations/map'); setData({ points: res?.points || [], countries: res?.countries || [], totals: res?.totals || {} }); setError('') }
    catch (e) { if (!silent) setError(e?.message || 'Failed to load map data') } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load(); const t = setInterval(() => load(true), 60000); return () => clearInterval(t) }, [])

  // Init Leaflet once (client only); `initKey` lets the user retry if the script chunk failed to load
  const [initKey, setInitKey] = useState(0)
  const [mapError, setMapError] = useState('')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!mapEl.current || mapRef.current) return
      let L
      try { L = await loadLeaflet() } catch (e) { if (!cancelled) setMapError('The map library could not be loaded.'); return }
      if (cancelled || !mapEl.current) return
      setMapError('')
      LRef.current = L
      const map = L.map(mapEl.current, { center: [20, 10], zoom: 2, minZoom: 2, maxZoom: 16, worldCopyJump: true, zoomControl: true, attributionControl: true })
      L.tileLayer(TILES, { attribution: ATTR, maxZoom: 16 }).addTo(map)
      L.tileLayer(LABELS, { maxZoom: 16, opacity: 0.85 }).addTo(map)
      layerRef.current = L.layerGroup().addTo(map)
      hotspotRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      setMapReady(true)
      setTimeout(() => map.invalidateSize(), 200)
    })()
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapReady(false) } }
  }, [initKey])

  const visiblePoints = useMemo(() => data.points.filter(p => (showDenied || p.status !== 'denied') && (!onlyHold || p.hold) && (!selected || p.country === selected)), [data, showDenied, onlyHold, selected])

  // Draw markers + hotspots whenever data/filters change
  useEffect(() => {
    const L = LRef.current, map = mapRef.current
    if (!L || !map || !layerRef.current) return
    layerRef.current.clearLayers(); hotspotRef.current.clearLayers()
    // Country hotspots (bigger circle = more users)
    data.countries.filter(c => c.center && (!selected || c.country === selected)).forEach(c => {
      const r = 60000 + Math.sqrt(c.users) * 90000
      const circle = L.circle([c.center.lat, c.center.lng], { radius: r, color: '#d4af37', weight: 1, fillColor: '#d4af37', fillOpacity: 0.12, interactive: true })
      circle.bindTooltip(`<div style="font-family:Inter,system-ui;font-size:12px"><strong style="color:#f5e29d">${esc(c.country)}</strong> · ${c.users} user${c.users === 1 ? '' : 's'}${c.on_hold ? ` · ${c.on_hold} on hold` : ''}</div>`, { sticky: true, className: 'aurela-tip' })
      circle.on('click', () => { setSelected(c.country) })
      circle.addTo(hotspotRef.current)
    })
    // User markers
    visiblePoints.forEach(p => {
      const denied = p.status === 'denied'
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 6, color: p.hold ? '#f59e0b' : denied ? '#ef4444' : '#f5e29d', weight: p.hold ? 3 : 1.5,
        fillColor: denied ? '#ef4444' : '#d4af37', fillOpacity: 0.9,
      })
      const when = p.at ? new Date(p.at).toLocaleString() : ''
      m.bindPopup(`
        <div style="font-family:Inter,system-ui;font-size:12px;min-width:200px;color:#f5f5f0">
          <div style="font-size:14px;color:#f5e29d;font-weight:600">${esc(p.name || p.username)}</div>
          <div style="color:#a8a8a0">@${esc(p.username)} · ${esc(p.email || '')}</div>
          <div style="margin-top:6px">${denied ? '<span style="color:#ef4444">Location denied · IP-based position</span>' : `${esc([p.city, p.country].filter(Boolean).join(', ') || 'Coordinates only')}${p.accuracy_m ? ` <span style="color:#a8a8a0">±${p.accuracy_m} m</span>` : ''}`}</div>
          <div style="color:#a8a8a0;margin-top:2px">IP ${esc(p.ip || '—')}${p.device ? ` · ${esc(p.device)}` : ''}${p.standalone ? ' · app' : ''}</div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
            <span style="border:1px solid ${p.kyc_status === 'approved' ? 'rgba(16,185,129,.5)' : 'rgba(212,175,55,.5)'};color:${p.kyc_status === 'approved' ? '#34d399' : '#d4af37'};border-radius:999px;padding:1px 8px">KYC ${esc(p.kyc_status || 'unverified')}</span>
            ${p.hold ? '<span style="border:1px solid rgba(245,158,11,.5);color:#f59e0b;border-radius:999px;padding:1px 8px">Geo hold</span>' : ''}
            ${p.kyc_country && p.country_code && p.kyc_country.toUpperCase() !== p.country_code ? `<span style="border:1px solid rgba(239,68,68,.5);color:#ef4444;border-radius:999px;padding:1px 8px">KYC country ${esc(p.kyc_country)}</span>` : ''}
          </div>
          <div style="color:#7a7a72;margin-top:6px">Last seen ${esc(when)}${p.updates > 1 ? ` · ${p.updates} updates` : ''}</div>
          <a href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" rel="noopener" style="color:#d4af37;display:inline-block;margin-top:6px">Open in Google Maps ↗</a>
        </div>`, { className: 'aurela-popup' })
      m.addTo(layerRef.current)
    })
    // Fit to selection
    if (selected) {
      const c = data.countries.find(x => x.country === selected)
      const pts = visiblePoints
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])).pad(0.3), { maxZoom: 8 })
      else if (pts.length === 1) map.flyTo([pts[0].lat, pts[0].lng], 8)
      else if (c?.center) map.flyTo([c.center.lat, c.center.lng], 5)
    }
  }, [visiblePoints, data.countries, selected, mapReady])

  const t = data.totals || {}
  return (
    <div className="space-y-4">
      {/* Leaflet dark-theme overrides (scoped class names) */}
      <style>{`
        .aurela-map .leaflet-container{background:#07070a;font-family:inherit}
        .aurela-map .leaflet-control-zoom a{background:#101014;color:#d4af37;border-color:rgba(212,175,55,.3)}
        .aurela-map .leaflet-control-attribution{background:rgba(0,0,0,.6);color:#7a7a72;font-size:9px}
        .aurela-map .leaflet-control-attribution a{color:#a8a8a0}
        .aurela-popup .leaflet-popup-content-wrapper,.aurela-popup .leaflet-popup-tip{background:#101014;color:#f5f5f0;border:1px solid rgba(212,175,55,.35);box-shadow:0 10px 40px rgba(0,0,0,.6)}
        .aurela-popup .leaflet-popup-close-button{color:#a8a8a0}
        .aurela-tip{background:#101014;color:#f5f5f0;border:1px solid rgba(212,175,55,.35);box-shadow:none}
        .aurela-tip::before{display:none}
      `}</style>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Users', value: t.users ?? 0, icon: Users, cls: 'text-gold' },
          { label: 'Location verified', value: t.located ?? 0, icon: MapPin, cls: 'text-emerald-400' },
          { label: 'Location denied', value: t.denied ?? 0, icon: MapPinOff, cls: 'text-red-400' },
          { label: 'Never captured', value: t.never ?? 0, icon: Globe2, cls: 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="card-luxury rounded-2xl p-4">
            <div className="flex items-center justify-between"><div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div><s.icon className={`h-4 w-4 ${s.cls}`}/></div>
            <div className={`font-display text-2xl mt-1 ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="card-luxury rounded-2xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gold-500 inline-block"/> Verified</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block"/> Denied (IP)</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-amber-500 inline-block"/> On hold</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowDenied(v => !v)} className={`px-3 py-1 rounded-full text-xs border ${showDenied ? 'border-gold-500/60 bg-gold-500/10 text-gold' : 'border-gold-500/20 text-muted-foreground'}`}>Show denied</button>
              <button onClick={() => setOnlyHold(v => !v)} className={`px-3 py-1 rounded-full text-xs border ${onlyHold ? 'border-amber-500/60 bg-amber-500/10 text-amber-400' : 'border-gold-500/20 text-muted-foreground'}`}><ShieldAlert className="h-3 w-3 inline mr-1"/>Only on hold</button>
              {selected && <button onClick={() => { setSelected(null); mapRef.current?.setView([20, 10], 2) }} className="px-3 py-1 rounded-full text-xs border border-gold-500/40 text-gold">Clear · {selected}</button>}
              <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="border-gold-500/40 h-7 px-2"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}/></Button>
            </div>
          </div>
          {error && <div className="text-sm text-red-400 px-2 pb-2">Could not load map data: {error}</div>}
          <div className="aurela-map relative rounded-xl overflow-hidden border border-gold-500/15" style={{ height: 520 }}>
            <div ref={mapEl} data-testid="users-map" style={{ height: '100%', width: '100%' }}/>
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Loading locations…</div>}
            {mapError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-sm text-muted-foreground gap-3">
                <div>{mapError}</div>
                <Button size="sm" onClick={() => setInitKey(k => k + 1)} className="gold-btn rounded-full">Retry</Button>
              </div>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground px-2 pt-2">{visiblePoints.length} user{visiblePoints.length === 1 ? '' : 's'} shown · positions come from the user's device (GPS) or, when denied, from their connection IP.</div>
        </div>

        <div className="card-luxury rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-lg">Hotspots by country</div>
            <Badge variant="outline" className="border-gold-500/40 text-gold">{data.countries.length}</Badge>
          </div>
          {data.countries.length === 0 && !loading && <div className="text-xs text-muted-foreground">No locations captured yet. Users are placed on the map after their first sign-in with location enabled.</div>}
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {data.countries.map(c => {
              const max = data.countries[0]?.users || 1
              const pct = Math.max(6, Math.round((c.users / max) * 100))
              const active = selected === c.country
              return (
                <button key={c.country} onClick={() => setSelected(active ? null : c.country)} data-testid={`hotspot-${c.country_code || c.country}`}
                  className={`w-full text-left rounded-xl p-3 border transition-colors ${active ? 'border-gold-500/60 bg-gold-500/10' : 'border-gold-500/10 hover:border-gold-500/30'}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{c.country}</span>
                    <span className="text-gold font-mono">{c.users}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-gold-500/60 to-gold-500" style={{ width: pct + '%' }}/></div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1.5">
                    {c.top_cities?.length > 0 && <span>{c.top_cities.map(x => `${x.city} (${x.n})`).join(' · ')}</span>}
                    {c.on_hold > 0 && <span className="text-amber-400">{c.on_hold} on hold</span>}
                    {c.denied > 0 && <span className="text-red-400">{c.denied} denied</span>}
                    <span>{c.kyc_approved} KYC ✓</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UsersMapAdmin
