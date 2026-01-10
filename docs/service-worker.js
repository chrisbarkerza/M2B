/**
 * M2B Service Worker
 * Handles offline caching and background sync
 */

const CACHE_VERSION = 'm2b-v1';
const CACHE_FILES = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Install event - cache essential files
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => {
                console.log('Service Worker: Caching files');
                return cache.addAll(CACHE_FILES);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cache => {
                        if (cache !== CACHE_VERSION) {
                            console.log('Service Worker: Clearing old cache');
                            return caches.delete(cache);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    const { request } = event;

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip GitHub API requests (we want fresh data)
    if (request.url.includes('api.github.com')) {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    // Return offline message for API requests
                    return new Response(
                        JSON.stringify({ error: 'Offline' }),
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    // Cache-first strategy for app assets
    event.respondWith(
        caches.match(request)
            .then(cached => {
                if (cached) {
                    // Return cached version, but fetch update in background
                    const fetchPromise = fetch(request)
                        .then(response => {
                            // Update cache with new version
                            caches.open(CACHE_VERSION)
                                .then(cache => cache.put(request, response.clone()));
                            return response;
                        })
                        .catch(() => cached); // Fallback to cached on network error

                    return cached;
                }

                // Not in cache, fetch from network
                return fetch(request)
                    .then(response => {
                        // Cache the new resource
                        if (response.ok) {
                            caches.open(CACHE_VERSION)
                                .then(cache => cache.put(request, response.clone()));
                        }
                        return response;
                    })
                    .catch(() => {
                        // Return offline page for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// Background sync event - sync queued data when back online
self.addEventListener('sync', event => {
    if (event.tag === 'm2b-sync') {
        console.log('Service Worker: Background sync triggered');

        event.waitUntil(
            // Notify the app to process queue
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_QUEUE' });
                });
            })
        );
    }
});

// Push notification event (for future digest notifications)
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};

    const options = {
        body: data.body || 'You have updates in your Second Brain',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'm2b-notification',
        data: data
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'M2B', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow('/')
    );
});
