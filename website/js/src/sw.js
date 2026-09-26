// Service Worker — network-first for navigations, cache-first for
// content-hashed assets. Just registering this unlocks the PWA cluster
// in the experiences receipt (Background Fetch / Sync / Periodic Sync /
// Push detection paths all check for `serviceWorker` presence).
//
// Served at /sw.js by the Axum handler (see website/src/main.rs) with
// `Service-Worker-Allowed: /` so it can scope the whole origin.

const CACHE = "engmanager-v6";
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
            await Promise.all(keys.filter((k) => /^engmanager-v\d+$/.test(k) && k !== CACHE).map((k) => caches.delete(k)));
            await self.clients.claim();
        })(),
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    // The narrower /personality/ worker owns these documents and public
    // release assets. The blog worker must never cache share-query URLs.
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return; }
    if (pathname === "/personality" || pathname.startsWith("/personality/") || pathname.startsWith("/assets/personality/") || pathname === "/articles/big-personality") return;
    // Both checkout documents and storefront redirects can carry payment
    // context. Bypass the cache in either direction, including stale entries
    // created by an older worker. URLSearchParams decodes encoded key names.
    if (pathname === "/checkout" || pathname.startsWith("/checkout/") || pathname === "/unsubscribe" || pathname.startsWith("/api/")) return;
    if (["payment_intent", "payment_intent_client_secret", "setup_intent", "setup_intent_client_secret", "redirect_status"].some((key) => url.searchParams.has(key))) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirstNavigation(event));
    } else if (url.pathname.startsWith("/assets/")) {
        event.respondWith(cacheFirst(request));
    }
});

async function networkFirstNavigation(event) {
    const { request } = event;
    try {
        const preload = await event.preloadResponse;
        const response = preload || await fetch(request);
        if (canCache(response)) {
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
    if (canCache(response)) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone()).catch(() => {});
    }
    return response;
}

function canCache(response) {
    return response.ok && !/(?:^|,)\s*(?:no-store|private|no-cache)\b/i.test(response.headers.get("Cache-Control") || "");
}
