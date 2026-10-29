'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from './store'
import { Button } from '@/components/ui/button'
import { MapPin, MapPinOff, Loader2, ShieldCheck } from 'lucide-react'

// Location verification
//  • FIRST TIME: shows a one-time prompt card asking for location permission. If the user denies, the
//    whole app is blocked until they allow (admin operators are exempt from the block).
//  • AFTERWARDS: completely silent. Every time the app is opened, comes back to the foreground, and
//    every 15 minutes while in use, the current position + device info is sent to POST /api/location
//    in the background (no UI at all). The browser remembers the granted permission so nothing is shown.
const GRANTED_FLAG = 'aurela_location_granted_v1'
const REFRESH_MS = 15 * 60 * 1000       // periodic silent refresh while the app is open
const MIN_GAP_MS = 2 * 60 * 1000        // never send more often than this

function deviceInfo() {
  if (typeof window === 'undefined') return {}
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true
  return {
    user_agent: navigator.userAgent,
    platform: navigator.userAgentData?.platform || navigator.platform || null,
    language: navigator.language || null,
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    standalone,
  }
}

export function LocationGate() {
  const { api, user } = useApp()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  // ui: 'hidden' (silent mode) | 'prompt' | 'requesting' | 'denied'
  const [ui, setUi] = useState('hidden')
  const lastSent = useRef(0)
  const timer = useRef(null)
  const started = useRef(false)

  const hasGrantedFlag = () => { try { return localStorage.getItem(GRANTED_FLAG) === '1' } catch (e) { return false } }
  const setGrantedFlag = () => { try { localStorage.setItem(GRANTED_FLAG, '1') } catch (e) {} }

  const send = async (pos) => {
    lastSent.current = Date.now()
    try {
      await api.post('/location', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, device: deviceInfo() })
    } catch (e) { /* non-fatal */ }
  }

  // Silent background capture — never shows UI. If permission was revoked later, fall back to the blocking prompt.
  const captureSilently = (force = false) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return
    if (!force && Date.now() - lastSent.current < MIN_GAP_MS) return
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGrantedFlag(); send(pos) },
      (err) => {
        if (err?.code === 1) {            // permission revoked → user must re-allow
          try { localStorage.removeItem(GRANTED_FLAG) } catch (e) {}
          api.post('/location', { denied: true, device: deviceInfo() }).catch(() => {})
          setUi('denied')
        }
        // other errors (timeout / unavailable) are ignored silently; next refresh will retry
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    )
  }

  // Interactive request — used only for the very first permission or after a denial
  const requestInteractive = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) { setUi('hidden'); return }
    setUi('requesting')
    navigator.geolocation.getCurrentPosition(
      async (pos) => { setGrantedFlag(); await send(pos); setUi('hidden') },
      async (err) => {
        if (err?.code === 1) {
          try { await api.post('/location', { denied: true, device: deviceInfo() }) } catch (e) {}
          setUi('denied')
        } else {
          // Could not get a fix (not a refusal) — don't punish the user; browser permission is already granted
          setGrantedFlag(); setUi('hidden')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60 * 1000 }
    )
  }

  useEffect(() => {
    if (!user?.id || started.current) return
    started.current = true
    const init = async () => {
      let state = null
      try { if (navigator.permissions?.query) state = (await navigator.permissions.query({ name: 'geolocation' })).state } catch (e) {}
      if (state === 'granted' || (state !== 'denied' && hasGrantedFlag())) {
        // Already allowed before → silent update, no UI
        captureSilently(true)
      } else if (state === 'denied') {
        api.post('/location', { denied: true, device: deviceInfo() }).catch(() => {})
        setUi('denied')
      } else {
        // First time → one-time prompt
        setUi('prompt')
      }
    }
    init()

    // Keep location fresh silently while the app is in use
    timer.current = setInterval(() => { if (hasGrantedFlag() && document.visibilityState === 'visible') captureSilently() }, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible' && hasGrantedFlag()) captureSilently() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer.current); document.removeEventListener('visibilitychange', onVisible) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (!user?.id || ui === 'hidden') return null
  if (isAdmin && ui !== 'requesting') return null   // operators are never blocked

  const denied = ui === 'denied'
  return (
    <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-6" data-testid="location-gate">
      <div className="card-luxury rounded-3xl p-8 max-w-md w-full text-center border border-gold-500/30">
        <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center border ${denied ? 'bg-red-500/10 border-red-500/40' : 'bg-gold-500/10 border-gold-500/40'}`}>
          {ui === 'requesting' ? <Loader2 className="h-7 w-7 text-gold animate-spin"/> : denied ? <MapPinOff className="h-7 w-7 text-red-400"/> : <MapPin className="h-7 w-7 text-gold"/>}
        </div>
        <div className="font-display text-2xl mt-5">{denied ? 'Location access required' : 'Verify your location'}</div>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          {denied
            ? 'Aurela requires location verification to protect your account and comply with regional regulations. Please enable location access for Aurela in your browser or phone settings, then tap Retry.'
            : 'To keep your account secure and meet regional compliance requirements, Aurela needs one-time permission to verify your location. You will not be asked again.'}
        </p>
        {denied && (
          <div className="mt-4 text-left text-xs text-muted-foreground rounded-xl bg-secondary/60 p-4 space-y-1">
            <div className="text-gold text-[10px] uppercase tracking-widest mb-1">How to enable</div>
            <div>• <span className="text-foreground">Android app / Chrome:</span> tap the lock icon in the address bar → Permissions → Location → Allow.</div>
            <div>• <span className="text-foreground">iPhone:</span> Settings → Safari (or Aurela) → Location → Allow.</div>
            <div>• Make sure your phone's Location Services are switched on.</div>
          </div>
        )}
        <Button onClick={requestInteractive} disabled={ui === 'requesting'} className="gold-btn w-full rounded-full h-12 mt-6" data-testid="location-allow">
          {ui === 'requesting' ? 'Checking location…' : denied ? 'Retry' : 'Allow location access'}
        </Button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-4"><ShieldCheck className="h-3.5 w-3.5 text-gold"/> Encrypted · used only for account security</div>
      </div>
    </div>
  )
}

export default LocationGate
