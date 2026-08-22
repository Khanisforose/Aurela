// Aurela Service Worker — MVP install-only worker (no aggressive caching).
// Its primary purpose is to enable PWA install eligibility.
const CACHE = 'aurela-v2'   // bump when app-shell changes to invalidate cached shell
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

// Listen for SKIP_WAITING message from the client (used by the update banner)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') self.skipWaiting()
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

// -------- Web Push --------
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch(e) { data = { title: 'Aurela', body: event.data ? event.data.text() : '' } }
  const title = data.title || 'Aurela'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'aurela',
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80],
    renotify: true,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab if there is one
      for (const c of clientList) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
