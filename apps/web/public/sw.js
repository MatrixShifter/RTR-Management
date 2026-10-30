/**
 * RTR Wholesale Management — Production Service Worker
 * 
 * Strict Security Rules:
 * 1. ONLY caches static application shell assets (HTML, JS, CSS, icons, fonts).
 * 2. NEVER caches authenticated API requests (/api/*) or Supabase data (*.supabase.co/*).
 * 3. Never caches private customer records, session tokens, or payment details.
 * 4. Password recovery requests and authentication pages are strictly excluded.
 * 5. Immediate activation on update with safe cache-invalidation.
 * 6. Guarantees every fetch handler returns a valid Response object (eliminates TypeError).
 */

const CACHE_NAME = 'rtr-wholesale-v3';

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

// Activate: Clean up stale legacy caches (e.g. rtr-wholesale-v2) and claim active clients
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

// Fetch: Secure routing pipeline with guaranteed Response validity
self.addEventListener('fetch', (event) => {
  const req = event.request;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // 1. SECURITY RULE: Strictly bypass cache for non-HTTP(S) schemes, API routes, Supabase endpoints, auth routes, and mutations
  if (
    url.protocol !== 'http:' && url.protocol !== 'https:' ||
    req.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/auth') ||
    url.pathname.includes('/reset-password') ||
    url.pathname.includes('/forgot-password') ||
    url.pathname.includes('/login')
  ) {
    // Network-only: Never store or serve business data, auth tokens, or mutations from cache
    return;
  }

  // 2. Navigation requests: Network-first with cached shell fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('/index.html').then((cachedHtml) => {
          if (cachedHtml) {
            return cachedHtml;
          }
          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>RTR Wholesale - Offline</title></head><body><div style="font-family:sans-serif;text-align:center;padding:50px;"><h2>You are currently offline</h2><p>Please check your internet connection and reload the application.</p></div></body></html>',
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        });
      })
    );
    return;
  }

  // 3. Static assets (JS, CSS, images, fonts): Stale-While-Revalidate with guaranteed Response return
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        // Cache valid successful responses for static assets only
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          (url.origin === self.location.origin || url.hostname.includes('fonts.gstatic.com'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      }).catch((_err) => {
        // If network failed and we have a cached version, return it
        if (cachedResponse) {
          return cachedResponse;
        }
        // If neither network nor cache succeeded, return a valid Fallback Response object.
        // Never return undefined or null to prevent browser TypeError.
        return new Response(null, {
          status: 504,
          statusText: 'Gateway Timeout'
        });
      });

      // Return cached version immediately if available, otherwise wait for network
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
