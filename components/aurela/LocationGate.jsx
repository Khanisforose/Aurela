'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from './store'
import { Button } from '@/components/ui/button'
import { MapPin, MapPinOff, Loader2, ShieldCheck } from 'lucide-react'

// Captures the user's location (GPS + device info) on every login/app open and sends it to the backend
// together with the connection IP (resolved server-side). If the user denies location, the whole app is
// blocked behind a full-screen prompt until they allow it. Admin operators are exempt from the block.
const SESSION_KEY = 'aurela_location_captured'

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
  const [state, setState] = useState('idle') // idle | requesting | granted | denied | unsupported
  const [error, setError] = useState('')
  const started = useRef(false)

  const sessionTag = user?.id ? `${SESSION_KEY}:${user.id}` : null
  const alreadyCaptured = () => { try { return sessionTag && sessionStorage.getItem(sessionTag) === '1' } catch (e) { return false } }
  const markCaptured = () => { try { if (sessionTag) sessionStorage.setItem(sessionTag, '1') } catch (e) {} }

  const request = () => {
    if (typeof window === 'undefined') return
    if (!('geolocation' in navigator)) { setState('unsupported'); return }
    setState('requesting'); setError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.post('/location', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, device: deviceInfo() })
        } catch (e) { /* non-fatal: never block the user because our own API hiccupped */ }
        markCaptured()
        setState('granted')
      },
      async (err) => {
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        if (err?.code === 1) {
          try { await api.post('/location', { denied: true, device: deviceInfo() }) } catch (e) {}
          setState('denied')
          setError('Location permission was denied.')
        } else {
          // Not a refusal — retry once with a coarse, cached reading; if it still fails, let the user through
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try { await api.post('/location', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, device: deviceInfo() }) } catch (e) {}
              markCaptured(); setState('granted')
            },
            () => { markCaptured(); setState('granted') },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
          )
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60 * 1000 }
    )
  }

  useEffect(() => {
    if (!user?.id || started.current) return
    started.current = true
    if (alreadyCaptured()) { setState('granted'); return }
    // If the browser can tell us permission is already granted, capture silently; otherwise show the prompt card
    const run = async () => {
      try {
        if (navigator.permissions?.query) {
          const p = await navigator.permissions.query({ name: 'geolocation' })
          if (p.state === 'granted') { request(); return }
          if (p.state === 'denied') { setState('denied'); try { await api.post('/location', { denied: true, device: deviceInfo() }) } catch (e) {} ; return }
        }
      } catch (e) {}
      setState('prompt')
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Nothing to show once captured, while deciding, or when the device cannot do geolocation at all
  if (!user?.id || state === 'idle' || state === 'granted' || state === 'unsupported') return null
  // Admin operators are never blocked (so you can't lock yourself out of the admin panel)
  if (isAdmin && state !== 'requesting') return null

  const denied = state === 'denied'
  return (
    <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-6" data-testid="location-gate">
      <div className="card-luxury rounded-3xl p-8 max-w-md w-full text-center border border-gold-500/30">
        <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center border ${denied ? 'bg-red-500/10 border-red-500/40' : 'bg-gold-500/10 border-gold-500/40'}`}>
          {state === 'requesting' ? <Loader2 className="h-7 w-7 text-gold animate-spin"/> : denied ? <MapPinOff className="h-7 w-7 text-red-400"/> : <MapPin className="h-7 w-7 text-gold"/>}
        </div>
        <div className="font-display text-2xl mt-5">{denied ? 'Location access required' : 'Verify your location'}</div>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          {denied
            ? 'Aurela requires location verification to protect your account and comply with regional regulations. Please enable location access for Aurela in your browser or phone settings, then tap Retry.'
            : 'To keep your account secure and meet regional compliance requirements, Aurela verifies your location each time you sign in. Your location is only visible to our compliance team.'}
        </p>
        {denied && (
          <div className="mt-4 text-left text-xs text-muted-foreground rounded-xl bg-secondary/60 p-4 space-y-1">
            <div className="text-gold text-[10px] uppercase tracking-widest mb-1">How to enable</div>
            <div>• <span className="text-foreground">Android app / Chrome:</span> tap the lock icon in the address bar → Permissions → Location → Allow.</div>
            <div>• <span className="text-foreground">iPhone:</span> Settings → Safari (or Aurela) → Location → Allow.</div>
            <div>• Make sure your phone's Location Services are switched on.</div>
          </div>
        )}
        <Button onClick={request} disabled={state === 'requesting'} className="gold-btn w-full rounded-full h-12 mt-6" data-testid="location-allow">
          {state === 'requesting' ? 'Checking location…' : denied ? 'Retry' : 'Allow location access'}
        </Button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-4"><ShieldCheck className="h-3.5 w-3.5 text-gold"/> Encrypted · used only for account security</div>
      </div>
    </div>
  )
}

export default LocationGate
