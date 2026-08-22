'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2, Check } from 'lucide-react'
import { useApp } from './store'
import { toast } from 'sonner'

const urlBase64ToUint8Array = (b64) => {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const s = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(s)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function PushSettings() {
  const { api } = useApp()
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sw = 'serviceWorker' in navigator
    const push = 'PushManager' in window
    setSupported(sw && push)
    if (sw && push) {
      setPermission(Notification.permission)
      navigator.serviceWorker.getRegistration().then(reg => reg?.pushManager.getSubscription()).then(sub => setSubscribed(!!sub)).catch(()=>{})
    }
  }, [])

  const enable = async () => {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { toast.error('Permission denied. Enable it from your browser settings.'); return }
      const { public_key } = await api.get('/push/config')
      if (!public_key) { toast.error('Notifications are not configured yet, please try again in a moment.'); return }
      let reg = await navigator.serviceWorker.getRegistration()
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key)
      })
      await api.post('/push/subscribe', { subscription: sub.toJSON(), user_agent: navigator.userAgent })
      setSubscribed(true)
      await api.post('/push/test', {}).catch(()=>{})
      toast.success('Notifications enabled. A test alert has been sent.')
    } catch(e) {
      console.error(e); toast.error(e.message || 'Failed to enable notifications')
    } finally { setBusy(false) }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      toast.success('Notifications disabled')
    } catch(e) { toast.error(e.message || 'Failed to disable') }
    finally { setBusy(false) }
  }

  return (
    <div className="card-luxury rounded-2xl p-5 md:p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold mb-2"><Bell className="h-3.5 w-3.5"/> Push notifications</div>
      <div className="font-display text-xl">Realtime alerts</div>
      <div className="text-xs text-muted-foreground mt-1">Get an instant push notification the moment a deposit lands, a payment arrives, a swap completes, or your card is issued.</div>

      {!supported ? (
        <div className="mt-4 p-3 rounded-lg bg-secondary/50 border border-gold-500/10 text-xs text-muted-foreground">Your browser does not support web push notifications.</div>
      ) : subscribed ? (
        <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
          <div className="flex items-center gap-2 text-sm text-emerald-300"><Check className="h-4 w-4"/> Notifications are on</div>
          <button onClick={disable} disabled={busy} className="text-xs text-red-400 hover:underline">{busy ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Turn off'}</button>
        </div>
      ) : (
        <button onClick={enable} disabled={busy || permission === 'denied'} className="mt-4 gold-btn h-11 px-5 rounded-xl text-sm inline-flex items-center gap-2">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin"/> Enabling…</> : <><Bell className="h-4 w-4"/> Enable notifications</>}
        </button>
      )}
      {permission === 'denied' && (
        <div className="mt-3 text-[11px] text-red-400">Notifications were denied. Enable them from your browser site settings, then reload.</div>
      )}
    </div>
  )
}
