// ─────────────────────────────────────────────
// Screen Wellness Coach — Service Worker v2
// ─────────────────────────────────────────────
const CACHE_NAME = 'wellness-coach-v2';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// ── Install ────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
    );
    self.skipWaiting();
});

// ── Activate ───────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch ──────────────────────────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (!response || response.status !== 200) return response;
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // CDN assets (TF.js, BlazeFace) — network first, cache fallback
    if (url.hostname.includes('jsdelivr.net')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (!response || response.status !== 200) return response;
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    }
});

// ── Push (server-sent push, future use) ────────
self.addEventListener('push', event => {
    let data = { title: 'Screen Wellness Coach', body: 'Time for a wellness check.' };
    try { data = event.data.json(); } catch (_) {}
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body:    data.body,
            icon:    './icons/icon-192.png',
            badge:   './icons/icon-192.png',
            tag:     data.tag || 'wellness',
            renotify: true,
            actions: [
                { action: 'understood', title: 'I understood' },
                { action: 'snooze',     title: 'Snooze 10 min' }
            ],
            data: { timerName: data.tag || 'wellness' }
        })
    );
});

// ── Notification click ─────────────────────────
// Handles both action button taps and plain notification taps.
// Posts a message back to all open app windows so app.js can
// call handleUnderstood() or handleSnooze() on the correct timer.
self.addEventListener('notificationclick', event => {
    const notification = event.notification;
    const action       = event.action;          // 'understood' | 'snooze' | '' (body tap)
    const timerName    = notification.data?.timerName || '';

    notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Post the action to every open window of the app
            clientList.forEach(client => {
                client.postMessage({ action: action || 'focus', timerName });
            });

            // If no window is open and the user tapped the notification body,
            // open a new window
            if (!clientList.length && (!action || action === 'focus')) {
                return clients.openWindow('./');
            }

            // Focus any existing window
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
        })
    );
});
