'use client'

import { useEffect } from 'react'

// Route-level error UI (replaces Next.js' generic "Application error" page).
export default function Error({ error, reset }) {
  useEffect(() => {
    try { console.error('[Aurela] route error:', error) } catch (e) {}
  }, [error])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-yellow-500/20 bg-neutral-950 p-8 text-center">
        <div className="text-3xl font-semibold tracking-wide bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent">Aurela</div>
        <div className="mt-4 text-lg">Something went wrong</div>
        <div className="mt-2 text-xs text-neutral-400 break-all">{error?.message || 'An unexpected error occurred.'}</div>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={() => reset()} className="px-5 py-2 rounded-full bg-gradient-to-r from-yellow-300 to-yellow-600 text-black text-sm font-medium">Try again</button>
          <button onClick={() => { if (typeof window !== 'undefined') window.location.href = '/' }} className="px-5 py-2 rounded-full border border-yellow-500/40 text-sm">Go home</button>
        </div>
      </div>
    </div>
  )
}
