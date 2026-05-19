// Service Worker — network-first for navigations, cache-first for
// content-hashed assets. Just registering this unlocks the PWA cluster
// in the experiences receipt (Background Fetch / Sync / Periodic Sync /
// Push detection paths all check for `serviceWorker` presence).
//
// Served at /sw.js by the Axum handler (see website/src/main.rs) with
// `Service-Worker-Allowed: /` so it can scope the whole origin.

const CACHE = "engmanager-v1";

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
            await self.clients.claim();
        })(),
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
    } else if (url.pathname.startsWith("/assets/")) {
        event.respondWith(cacheFirst(request));
    }
});

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, response.clone()).catch(() => {});
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response("Offline", { status: 503 });
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone()).catch(() => {});
    }
    return response;
}
