'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/components/aurela/store'
import { Toaster } from 'sonner'
import { GoogleOAuthProvider } from '@react-oauth/google'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

export function Providers({ children }) {
  const body = (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {children}
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
