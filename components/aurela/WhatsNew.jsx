'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Check } from 'lucide-react'

// One-time "Aurela Updated" popup.
// Shows once per app version per device for every signed-in user. The version and the
// bullet list come from GET /api/version (WHATS_NEW in route.js), so the next deploy
// only needs a package.json version bump + updated bullets to re-trigger it for everyone.
const LS_SEEN = 'aurela_whatsnew_seen_version'

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' }).then(r => r.json())
        if (cancelled || !res?.version) return
        const seen = localStorage.getItem(LS_SEEN) || ''
        if (seen !== res.version) {
          setInfo(res)
          // Small delay so it appears after the dashboard paints (and after any passcode lock)
          setTimeout(() => { if (!cancelled) setOpen(true) }, 900)
        }
      } catch (e) {}
    }
    run()
    return () => { cancelled = true }
  }, [])

  const dismiss = () => {
    try { if (info?.version) localStorage.setItem(LS_SEEN, info.version) } catch (e) {}
    setOpen(false)
  }

  const items = Array.isArray(info?.whats_new) ? info.whats_new : []

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) dismiss() }}>
      <DialogContent className="bg-onyx-900 border-gold-500/30 max-w-md p-0 overflow-hidden" data-testid="whats-new-dialog">
        <div className="relative px-6 pt-8 pb-6 text-center bg-gradient-to-b from-gold-500/15 to-transparent">
          <div className="mx-auto h-14 w-14 rounded-full bg-gold-500/15 border border-gold-500/40 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-gold"/>
          </div>
          <DialogTitle className="font-display text-2xl gold-text mt-4 font-normal">{info?.whats_new_title || 'Aurela Updated'}</DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Version {info?.version}</DialogDescription>
        </div>
        <div className="px-6 pb-6">
          {items.length > 0 && (
            <ul className="space-y-2.5">
              {items.map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-gold-500/15 border border-gold-500/40 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-gold"/>
                  </span>
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>
          )}
          <Button onClick={dismiss} className="gold-btn w-full rounded-full h-11 mt-6" data-testid="whats-new-dismiss">Got it</Button>
          <div className="text-[10px] text-center text-muted-foreground mt-3">You will only see this once per update.</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default WhatsNewDialog
