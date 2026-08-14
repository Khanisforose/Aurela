'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Smartphone, Apple, X, QrCode, Share, Plus, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from './store'
import { toast } from 'sonner'

// Global event-bus (module-level) so DownloadAppButton and DownloadAppModal can talk
// without ceremony. Any component can dispatch/listen 'aurela:open-app-modal'.
const OPEN_EVENT = 'aurela:open-app-modal'
const openModal = () => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OPEN_EVENT)) }

export function DownloadAppButton({ fullWidth = false }) {
  return (
    <Button
      onClick={openModal}
      variant="outline"
      className={`border-gold-500/50 text-gold hover:bg-gold-500/10 rounded-full ${fullWidth ? 'w-full mt-2' : ''}`}
    >
      <Download className="h-4 w-4 mr-2"/> Download App
    </Button>
  )
}

export function DownloadAppModal() {
  const { config } = useApp()
  const [open, setOpen] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [platform, setPlatform] = useState('unknown')  // ios | android | desktop | unknown

  // Detect platform + capture beforeinstallprompt for PWA install
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = navigator.userAgent || ''
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform('ios')
    else if (/Android/i.test(ua)) setPlatform('android')
    else setPlatform('desktop')

    // PWA install prompt
    const onPrompt = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // Modal open trigger
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpen)

    // Detect if already installed (standalone display mode)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) setInstalled(true)
    if (window.navigator.standalone) setInstalled(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  // Register service worker (required for PWA install eligibility)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Only register in production or when explicitly enabled — hot-reload can break sw in dev
    if (window.location.hostname !== 'localhost') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  const doPwaInstall = async () => {
    if (!deferredPrompt) {
      toast.error('Install prompt not available yet. Try refreshing or use "Add to Home Screen" from your browser menu.')
      return
    }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') { setInstalled(true); toast.success('Aurela installed successfully') }
    setDeferredPrompt(null)
  }

  const apkUrl = config?.apk_url || ''
  const apkVersion = config?.apk_version || 'latest'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="card-luxury rounded-3xl p-6 md:p-8 max-w-lg w-full relative overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient gold glow */}
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(500px 250px at 50% 0%, rgba(212,175,55,0.22), transparent 70%)' }}/>

            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-gold z-10">
              <X className="h-5 w-5"/>
            </button>

            <div className="relative z-10">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-widest text-gold">
                  <Sparkles className="h-3.5 w-3.5"/> Get the Aurela app
                </div>
                <h2 className="font-display text-3xl md:text-4xl mt-4">Aurela on your <span className="gold-text">pocket.</span></h2>
                <p className="text-sm text-muted-foreground mt-3">
                  Install Aurela as a native-feeling app — full screen, home-screen icon, instant load. Works offline for cached data.
                </p>
              </div>

              {installed ? (
                <div className="mt-6 flex flex-col items-center gap-3 p-6 rounded-2xl bg-gold-500/10 border border-gold-500/30">
                  <CheckCircle2 className="h-10 w-10 text-gold"/>
                  <div className="font-display text-xl text-gold-bright">Already installed</div>
                  <p className="text-sm text-muted-foreground text-center">You're all set — Aurela is on your device.</p>
                </div>
              ) : (
                <>
                  {/* PWA install (Chrome/Edge/Android/Desktop) */}
                  {deferredPrompt && (
                    <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-gold-500/15 to-transparent border border-gold-500/40">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-gold-500/20 flex items-center justify-center border border-gold-500/40">
                          <Smartphone className="h-6 w-6 text-gold-bright"/>
                        </div>
                        <div className="flex-1">
                          <div className="font-display text-lg">One-tap install</div>
                          <div className="text-xs text-muted-foreground">Native app experience — no store required</div>
                        </div>
                      </div>
                      <Button onClick={doPwaInstall} className="gold-btn w-full mt-4 rounded-xl h-12">
                        <Download className="h-4 w-4 mr-2"/> Install Aurela Now
                      </Button>
                    </div>
                  )}

                  {/* Android APK direct download (from admin-configured URL) */}
                  {(platform === 'android' || platform === 'desktop') && apkUrl && (
                    <a href={apkUrl} target="_blank" rel="noopener noreferrer" className="block mt-4 p-5 rounded-2xl bg-secondary/70 border border-gold-500/30 hover:border-gold-500/70 hover:bg-secondary transition group">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30">
                          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M17.523 15.34a1.055 1.055 0 100-2.11 1.055 1.055 0 000 2.11zm-11.046 0a1.055 1.055 0 100-2.11 1.055 1.055 0 000 2.11zm11.421-6.184l1.877-3.25a.39.39 0 10-.676-.39l-1.9 3.29a11.769 11.769 0 00-9.398 0l-1.9-3.29a.39.39 0 10-.676.39l1.877 3.25C3.9 10.828 1.7 13.907 1.5 17.5h21c-.2-3.593-2.4-6.672-5.602-8.344z" fill="#3ddc84"/></svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-display text-lg group-hover:text-gold transition">Download for Android</div>
                          <div className="text-xs text-muted-foreground">APK · Signed · Version {apkVersion}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gold-bright/60 group-hover:text-gold-bright group-hover:translate-x-1 transition"/>
                      </div>
                    </a>
                  )}

                  {/* Android APK placeholder when admin hasn't uploaded yet */}
                  {(platform === 'android' || platform === 'desktop') && !apkUrl && (
                    <div className="mt-4 p-5 rounded-2xl bg-secondary/50 border border-dashed border-gold-500/30">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="h-6 w-6 opacity-60" fill="none"><path d="M17.523 15.34a1.055 1.055 0 100-2.11 1.055 1.055 0 000 2.11zm-11.046 0a1.055 1.055 0 100-2.11 1.055 1.055 0 000 2.11zm11.421-6.184l1.877-3.25a.39.39 0 10-.676-.39l-1.9 3.29a11.769 11.769 0 00-9.398 0l-1.9-3.29a.39.39 0 10-.676.39l1.877 3.25C3.9 10.828 1.7 13.907 1.5 17.5h21c-.2-3.593-2.4-6.672-5.602-8.344z" fill="#3ddc84"/></svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-display text-lg text-muted-foreground">Native Android APK</div>
                          <div className="text-xs text-muted-foreground/70">Coming soon — install as PWA above for now</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* iOS Add-to-Home-Screen instructions */}
                  {platform === 'ios' && (
                    <div className="mt-4 p-5 rounded-2xl bg-secondary/70 border border-gold-500/30">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-12 w-12 rounded-xl bg-gold-500/15 flex items-center justify-center border border-gold-500/30">
                          <Apple className="h-6 w-6 text-gold-bright"/>
                        </div>
                        <div className="flex-1">
                          <div className="font-display text-lg">Install on iOS</div>
                          <div className="text-xs text-muted-foreground">Add to Home Screen from Safari</div>
                        </div>
                      </div>
                      <ol className="text-sm space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2"><Share className="h-4 w-4 text-gold"/> Tap the Share button in Safari</li>
                        <li className="flex items-center gap-2"><Plus className="h-4 w-4 text-gold"/> Scroll down and tap "Add to Home Screen"</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold"/> Confirm — Aurela is now on your home screen</li>
                      </ol>
                    </div>
                  )}

                  {/* Manual PWA install fallback */}
                  {!deferredPrompt && platform !== 'ios' && (
                    <div className="mt-4 p-5 rounded-2xl bg-secondary/50 border border-gold-500/20">
                      <div className="flex items-center gap-3 mb-2">
                        <QrCode className="h-5 w-5 text-gold-bright"/>
                        <div className="font-display text-base">Manual install</div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        On Chrome/Edge: open the browser menu (three dots) → tap <span className="text-gold">"Install app"</span> or <span className="text-gold">"Add to Home Screen"</span>. On Firefox: menu → <span className="text-gold">"Install"</span>.
                      </p>
                    </div>
                  )}
                </>
              )}

              <p className="text-[10px] text-muted-foreground/60 text-center mt-6">
                Installing Aurela creates a shortcut on your device with app-like behaviour. Your data continues to sync through your existing account.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
