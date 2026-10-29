/**
 * RTR Wholesale Management — Production Service Worker
 * 
 * Strict Security Rules:
 * 1. ONLY caches static application shell assets (HTML, JS, CSS, icons, fonts).
 * 2. NEVER caches authenticated API requests (/api/*) or Supabase data (*.supabase.co/*).
 * 3. Never caches private customer records, session tokens, or payment details.
 * 4. Immediate activation on update with safe cache-invalidation.
 */

const CACHE_NAME = 'rtr-wholesale-v2';

const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/rtr-logo.png',
  '/favicon.png',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/icon-maskable.png'
];

// Install: Pre-cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up stale legacy caches and claim active clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Secure routing pipeline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. SECURITY RULE: Strictly bypass cache for API routes, Supabase endpoints, and non-GET requests
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/auth/')
  ) {
    // Network-only: Never store or serve business data, auth tokens, or mutations from cache
    return;
  }

  // 2. Navigation requests: Network-first with cached shell fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html').then((response) => {
          return response || fetch(event.request);
        });
      })
    );
    return;
  }

  // 3. Static assets (JS, CSS, images, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache valid successful responses for static assets only
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          (url.origin === self.location.origin || url.hostname.includes('fonts.gstatic.com'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Return cached version if network is offline
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for message events (e.g. cache clearing on logout)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'clear-cache') {
    caches.delete(CACHE_NAME).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    });
  }
});
