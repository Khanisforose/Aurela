'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/components/aurela/store'
import { Toaster } from 'sonner'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { UpdateBanner } from '@/components/aurela/UpdateBanner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

// Register the service worker as early as possible on page load. PWABuilder + Chrome install
// prompt both need to detect an active registration when they scan the page, so we do NOT
// gate this behind a component effect that only fires when the user opens a modal.
function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (window.location.hostname === 'localhost') return   // don't cache-poison dev
    // Delay slightly so it doesn't compete with the first paint
    const t = setTimeout(() => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }, 1500)
    return () => clearTimeout(t)
  }, [])
  return null
}

export function Providers({ children }) {
  const body = (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <ServiceWorkerRegistrar />
        {children}
        <UpdateBanner />
        <Toaster theme="dark" position="top-right" richColors closeButton toastOptions={{ style: { background: '#0b0b0f', border: '1px solid rgba(212,175,55,0.3)', color: '#f5f5f0' } }} />
      </AppProvider>
    </QueryClientProvider>
  )
  if (!GOOGLE_CLIENT_ID) return body
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {body}
    </GoogleOAuthProvider>
  )
}
