// ===== sw.js — Service Worker for ChetanSmartTrip PWA (Offline Support) =====

const CACHE_NAME = 'smarttrip-v12';
const DATA_VERSION = 2;  // Bump this when data format changes to auto-clear stale localStorage

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './schedule-engine.js',
  './notifications.js',
  './storage.js',
  './ui.js',
  './manifest.json',
  '../data/itinerary.json'
];

// Install: Cache all assets
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Cache-first strategy (perfect for offline)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Return cached version, but also fetch fresh in background
        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(() => cached); // If offline, stick with cache

        return cached;
      }

      // Not in cache: try network
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Handle notification messages from the app
self.addEventListener('message', event => {
  if (event.data?.type === 'notification') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: '🗺️',
      tag: event.data.tag || 'smarttrip',
      requireInteraction: false
    });
  }
});
