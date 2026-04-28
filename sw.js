// ─────────────────────────────────────────────
// Screen Wellness Coach — Service Worker
// ─────────────────────────────────────────────

const CACHE_NAME = 'wellness-coach-v1';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    // TF.js and BlazeFace are CDN-hosted; we cache them at runtime (see fetch handler)
];

// ── Install: pre-cache core app shell ──────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
    );
    self.skipWaiting();
});

// ── Activate: clean up old caches ──────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: cache-first for same-origin, network-first for CDN ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Cache-first strategy for same-origin assets
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (!response || response.status !== 200) return response;
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // Network-first with cache fallback for CDN assets (TF.js, BlazeFace)
    if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdn.jsdelivr.net')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (!response || response.status !== 200) return response;
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    }
});

// ── Push: handle incoming push messages ────────────────────────
// (Used if you later integrate a real push server / VAPID keys)
self.addEventListener('push', event => {
    let data = { title: 'Screen Wellness Coach', body: 'Time for a wellness check.' };
    try { data = event.data.json(); } catch (_) {}

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body:             data.body,
            icon:             './icons/icon-192.png',
            badge:            './icons/icon-192.png',
            tag:              data.tag || 'wellness',
            renotify:         true,
            requireInteraction: false,
        })
    );
});

// ── Notification click: focus / open the app window ────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('./');
        })
    );
});
