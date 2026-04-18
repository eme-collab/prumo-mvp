const APP_SHELL_CACHE = 'prumo-app-shell-v2'
const STATIC_CACHE = 'prumo-static-v2'
const OFFLINE_FALLBACK_URL = '/offline'
const PRECACHE_URLS = [
  '/login',
  OFFLINE_FALLBACK_URL,
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

function isSameOrigin(url) {
  return url.origin === self.location.origin
}

function isStaticAssetRequest(request, url) {
  if (!isSameOrigin(url)) {
    return false
  }

  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image'
  )
}

function isSensitivePath(url) {
  if (!isSameOrigin(url)) {
    return false
  }

  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/painel') ||
    url.pathname.startsWith('/revisar') ||
    url.pathname.startsWith('/resumo') ||
    url.pathname.startsWith('/liquidar') ||
    url.pathname.startsWith('/auth/')
  )
}

async function precacheAppShell() {
  const cache = await caches.open(APP_SHELL_CACHE)
  await cache.addAll(PRECACHE_URLS)
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys()
  const activeCaches = new Set([APP_SHELL_CACHE, STATIC_CACHE])

  await Promise.all(
    cacheNames.map((cacheName) => {
      if (activeCaches.has(cacheName)) {
        return Promise.resolve()
      }

      return caches.delete(cacheName)
    })
  )
}

async function handleNavigationRequest(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(APP_SHELL_CACHE)

    return (
      (await cache.match(OFFLINE_FALLBACK_URL)) ||
      new Response('Sem conexão no momento.', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    )
  }
}

async function handleStaticAssetRequest(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cachedResponse = await cache.match(request)

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone())
      }

      return response
    })
    .catch(() => null)

  if (cachedResponse) {
    void networkFetch
    return cachedResponse
  }

  const networkResponse = await networkFetch

  if (networkResponse) {
    return networkResponse
  }

  return Response.error()
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await cleanupOldCaches()
      await self.clients.claim()
    })()
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const url = new URL(event.request.url)

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request))
    return
  }

  if (isSensitivePath(url)) {
    return
  }

  if (isStaticAssetRequest(event.request, url)) {
    event.respondWith(handleStaticAssetRequest(event.request))
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  const payload = event.data.json()

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Prumo', {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || 'prumo-notification',
      data: {
        url: payload.url || '/painel',
        notificationType: payload.notificationType || null,
        itemType: payload.itemType || null,
        itemStatus: payload.itemStatus || null,
        itemId: payload.itemId || null,
        deliveryId: payload.deliveryId || null,
      },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = new URL(
    event.notification.data?.url || '/painel',
    self.location.origin
  ).toString()

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }

        return Promise.resolve()
      })
  )
})
