/**
 * Trade Tracker Pro — Service Worker
 * Version: 1.0.0
 * Developer: Nitai Studio
 * © 2026 Nitai Studio. All Rights Reserved.
 */

const CACHE_NAME = 'trade-tracker-pro-v1.0.0';
const STATIC_CACHE = 'ttp-static-v1';
const DYNAMIC_CACHE = 'ttp-dynamic-v1';

// ── Assets to cache on install ────────────────────────────────
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

// ── Install: pre-cache core assets ───────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing Trade Tracker Pro Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Pre-caching assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      console.log('[SW] Pre-cache complete');
      return self.skipWaiting();
    }).catch(err => {
      console.warn('[SW] Pre-cache failed (some assets may not exist yet):', err);
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated & controlling all clients');
      return self.clients.claim();
    })
  );
});

// ── Fetch: Cache-First for static, Network-First for dynamic ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET & cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // For HTML pages → Network first, fallback to cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // For icons, screenshots, manifest → Cache first
  if (
    url.pathname.includes('/icons/') ||
    url.pathname.includes('/screenshots/') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── Strategy: Cache First ─────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// ── Strategy: Network First ───────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return offline fallback
    return caches.match('./index.html') ||
      new Response('<h1>Trade Tracker Pro — Offline</h1><p>Please check your connection.</p>', {
        headers: { 'Content-Type': 'text/html' }
      });
  }
}

// ── Strategy: Stale While Revalidate ─────────────────────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ── Background Sync (ready for future use) ────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-trades') {
    console.log('[SW] Background sync: trades');
    // Future: sync trades to cloud backup
  }
});

// ── Push Notifications (ready for future use) ─────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Trade Tracker Pro', {
      body: data.body || 'New notification',
      icon: './icons/icon-192.png',
      badge: './icons/icon-96.png',
      vibrate: [200, 100, 200],
      data: data.url || '/',
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// ── Notification Click ────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes('index.html') && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(event.notification.data || './index.html');
    })
  );
});

// ── Message Handler ───────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_NAME });
  }
});

console.log('[SW] Trade Tracker Pro Service Worker loaded — Nitai Studio');
