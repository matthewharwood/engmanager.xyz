// Service Worker — network-first for navigations, cache-first for
// content-hashed assets. Just registering this unlocks the PWA cluster
// in the experiences receipt (Background Fetch / Sync / Periodic Sync /
// Push detection paths all check for `serviceWorker` presence).
//
// Served at /sw.js by the Axum handler (see website/src/main.rs) with
// `Service-Worker-Allowed: /` so it can scope the whole origin.

const CACHE = "engmanager-v4";

// Media that streams via HTTP Range requests. We never route these through the
// cache: a cached full 200 served back to a ranged <video>/<audio> request
// makes the element stall and loop (play/pause forever). Let them hit the
// network so the server can answer 206 Partial Content.
const STREAMED_MEDIA = /\.(mp4|webm|mov|m4v|ogv)$/i;
const PRECACHE_URLS = ["/offline.html"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE);
            await cache.addAll(PRECACHE_URLS);
            await self.skipWaiting();
        })(),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            if ("navigationPreload" in self.registration) {
                await self.registration.navigationPreload.enable();
            }
            const keys = await caches.keys();
            await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
            await self.clients.claim();
        })(),
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    // Range requests (media seeking/streaming) must reach the server untouched
    // so it can answer 206 Partial Content. The Cache API ignores Range on
    // match and would hand back a full 200, which breaks <video> playback.
    if (request.headers.has("range")) return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirstNavigation(event));
    } else if (url.pathname.startsWith("/assets/")) {
        // Don't cache-route large streamed media (see STREAMED_MEDIA). Even the
        // initial non-ranged probe should go straight to the network so the
        // cache never holds a full 200 that later breaks range requests.
        if (STREAMED_MEDIA.test(url.pathname)) return;
        event.respondWith(cacheFirst(request));
    }
});

async function networkFirstNavigation(event) {
    const { request } = event;
    try {
        const preload = await event.preloadResponse;
        const response = preload || await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, response.clone()).catch(() => {});
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || await caches.match("/offline.html") || new Response("Offline", {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            status: 503,
        });
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
