'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, RefreshCw, X } from 'lucide-react'

// Update banner — polls /api/version every 60s and also listens for service worker updates.
// Whenever the server reports a newer version than we booted with, or a new SW is waiting to
// take control, a gold banner slides down from the top with a "Refresh to update" action.
// Storage keys:
//   aurela_current_version — the version we last successfully loaded (persisted so we can
//                            detect the diff even after a reload)
//   aurela_update_dismissed_at — timestamp of the last dismissal; we won't re-nag for 10 min

const LS_CURRENT = 'aurela_current_version'
const LS_DISMISSED = 'aurela_update_dismissed_at'
const NAG_COOLDOWN_MS = 10 * 60 * 1000     // 10 min
const POLL_INTERVAL_MS = 60 * 1000         // 60s

export function UpdateBanner() {
  const [available, setAvailable] = useState(false)
  const [serverVersion, setServerVersion] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const dismissRecently = useCallback(() => {
    const at = Number(localStorage.getItem(LS_DISMISSED) || 0)
    return Date.now() - at < NAG_COOLDOWN_MS
  }, [])

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' }).then(r => r.json())
      const server = res.version || ''
      setServerVersion(server)
      const current = localStorage.getItem(LS_CURRENT) || ''
      if (!current) {
        // First load — just cache the version
        localStorage.setItem(LS_CURRENT, server)
        return
      }
      if (server && server !== current && !dismissRecently()) setAvailable(true)
    } catch (e) { /* offline is fine */ }
  }, [dismissRecently])

  useEffect(() => {
    if (typeof window === 'undefined') return
    check()
    const t = setInterval(check, POLL_INTERVAL_MS)
    // Re-check when the tab regains focus (users often background then return)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [check])

  // Service worker update path — fires when a new SW has finished installing and is waiting
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    let waiting = null
    const handleWaiting = (reg) => {
      if (reg.waiting) { waiting = reg.waiting; if (!dismissRecently()) setAvailable(true) }
    }
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return
      handleWaiting(reg)
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) handleWaiting(reg)
        })
      })
      // Manually poll for SW updates every 5 minutes
      const t = setInterval(() => reg.update().catch(()=>{}), 5 * 60 * 1000)
      return () => clearInterval(t)
    })
    // When the controlling SW changes (i.e., skipWaiting took effect), auto-reload
    let refreshed = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshed) return
      refreshed = true
      window.location.reload()
    })
    return () => { waiting = null }
  }, [dismissRecently])

  const refresh = async () => {
    setRefreshing(true)
    try {
      // 1) Tell any waiting SW to skip waiting (triggers controllerchange → reload)
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.waiting) { reg.waiting.postMessage('SKIP_WAITING'); return }
      }
      // 2) Otherwise, cache-bust any HTTP caches and hard reload
      if ('caches' in window) { const names = await caches.keys(); await Promise.all(names.map(n => caches.delete(n))) }
      if (serverVersion) localStorage.setItem(LS_CURRENT, serverVersion)
      window.location.reload()
    } finally { setTimeout(() => setRefreshing(false), 4000) }
  }

  const dismiss = () => {
    localStorage.setItem(LS_DISMISSED, String(Date.now()))
    setAvailable(false)
  }

  return (
    <AnimatePresence>
      {available && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="fixed top-0 left-0 right-0 z-[110] px-3 pt-3 pointer-events-none"
        >
          <div className="max-w-md mx-auto pointer-events-auto">
            <div className="relative rounded-2xl bg-gradient-to-r from-gold-500/30 via-gold-500/20 to-gold-500/30 border border-gold-500/50 backdrop-blur-xl shadow-[0_10px_40px_rgba(212,175,55,0.35)] overflow-hidden">
              <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(400px 100px at 50% 0%, rgba(212,175,55,0.35), transparent 70%)' }}/>
              <div className="relative z-10 flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-gold-500/25 border border-gold-500/50 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-gold-bright"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm text-gold-bright leading-tight">New version available</div>
                  <div className="text-[11px] text-foreground/70 leading-tight mt-0.5 truncate">Refresh to get the latest Aurela.</div>
                </div>
                <button onClick={refresh} disabled={refreshing} className="h-8 px-3 rounded-full bg-gold-500 text-black text-xs font-medium inline-flex items-center gap-1.5 hover:bg-gold-400 active:scale-95 transition disabled:opacity-60">
                  {refreshing ? <RefreshCw className="h-3.5 w-3.5 animate-spin"/> : <RefreshCw className="h-3.5 w-3.5"/>} Update
                </button>
                <button onClick={dismiss} className="h-8 w-8 rounded-full hover:bg-black/20 flex items-center justify-center text-foreground/60">
                  <X className="h-4 w-4"/>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
