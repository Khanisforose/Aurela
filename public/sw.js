// Aurela Service Worker — MVP install-only worker (no aggressive caching).
// Its primary purpose is to enable PWA install eligibility.
const CACHE = 'aurela-v1'
const APP_SHELL = ['/', '/manifest.json', '/aur-coin.png', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Never cache API responses — always go network-first
  if (url.pathname.startsWith('/api/')) return
  // Same-origin GETs use cache-fallback-network for the app shell only
  if (event.request.method !== 'GET') return
  if (url.origin !== location.origin) return
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        // Only cache successful basic responses of app-shell files
        if (res && res.status === 200 && APP_SHELL.includes(url.pathname)) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {})
        }
        return res
      }).catch(() => cached)
      return cached || network
    })
  )
})
