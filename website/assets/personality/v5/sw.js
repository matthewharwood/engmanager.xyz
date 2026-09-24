import {RELEASE} from '/assets/personality/v5/release.mjs';
import {AI_CACHE} from '/assets/personality/v1/ai-cache-config.mjs';
import {releaseSource} from '/assets/personality/v5/release-format.mjs';

const ASSET_ROOT = '/assets/personality/v5/';
const RELEASE_PATH = `${ASSET_ROOT}release.mjs`;
const ROUTES = ['/personality/prepare', '/personality/test', '/personality/review', '/personality/report', '/personality/share', '/personality/library'];
// The reduced article shell mounts this same application. A WindowClient can
// retain its original document URL after history.pushState into the library.
// This exception authorizes installation messages only; it is never a cache key.
const INSTALL_SOURCES = new Set([...ROUTES, '/articles/big-personality']);
const READY_PATH = '/personality/.offline-ready-v5';
const retainedReleases = [...RELEASE.previousReleases, {v: 1, ...RELEASE.legacy}];
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const origin = self.location.origin;
const urlFor = path => new URL(path, origin).href;
const publicPaths = new Set([...Object.keys(RELEASE.assets), RELEASE_PATH]);
const aiPaths = new Set(AI_CACHE.paths);
let installation = null;

async function sha256(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
const digestPromise = sha256(new TextEncoder().encode(JSON.stringify(RELEASE)));
const cacheNamePromise = digestPromise.then(digest => `personality-v5-${digest}`);

// release.mjs cannot contain its own digest. Its deterministic generated source
// is reconstructed from the already imported manifest, then verified separately.
function expectedReleaseSource() { return releaseSource(RELEASE); }

async function installedCache() {
  const name = await cacheNamePromise;
  if (!(await caches.keys()).includes(name)) return null;
  const cache = await caches.open(name);
  return await cache.match(urlFor(READY_PATH)) ? cache : null;
}

async function fetchPublic(path, expectedHash) {
  const target = urlFor(path);
  const response = await fetch(new Request(target, {method: 'GET', credentials: 'omit', cache: 'reload', redirect: 'error', referrerPolicy: 'no-referrer'}));
  if (!response.ok || (response.url && response.url !== target)) throw new Error(`A public offline file could not be downloaded: ${path}`);
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('A public offline file exceeds the supported download size.');
  if (expectedHash && await sha256(bytes) !== expectedHash) throw new Error(`Public release integrity check failed: ${path}`);
  if (path === RELEASE_PATH) {
    const expected = new TextEncoder().encode(expectedReleaseSource());
    if (await sha256(bytes) !== await sha256(expected)) throw new Error('The public release changed during download. Reload and try again.');
  }
  if (ROUTES.includes(path) && !(response.headers.get('Content-Type') ?? '').toLowerCase().includes('text/html')) {
    throw new Error('An offline route did not return its public HTML shell.');
  }
  return response;
}

async function installRelease(progress) {
  if (!RELEASE.ready) throw new Error('The complete public release is not available.');
  const digest = await digestPromise, name = await cacheNamePromise;
  const paths = [...Object.keys(RELEASE.assets), RELEASE_PATH, ...ROUTES];
  const existing = await installedCache();
  if (existing && (await Promise.all(paths.map(path => existing.match(urlFor(path))))).every(Boolean)) {
    return {cacheName: name, assets: publicPaths.size, routes: ROUTES.length};
  }
  const stagingName = `${name}:staging:${crypto.randomUUID()}`;
  const staging = await caches.open(stagingName);
  let completed = 0, target = null, committed = false;
  try {
    const jobs = paths.map(path => async () => {
      const response = await fetchPublic(path, RELEASE.assets[path]);
      await staging.put(urlFor(path), response);
      completed++; progress(completed, paths.length);
    });
    // Bound concurrency, stop launching jobs after a failure, and settle active
    // writes before deleting staging storage.
    let next = 0, failure = null;
    const workers = Array.from({length: Math.min(4, jobs.length)}, async () => {
      while (!failure && next < jobs.length) {
        const job = jobs[next++];
        try { await job(); } catch (error) { failure ??= error; }
      }
    });
    await Promise.all(workers);
    if (failure) throw failure;
    target = await caches.open(name);
    // Readers ignore this cache until the last marker commits. Replacing a
    // missing/evicted release never publishes partially copied assets.
    await target.delete(urlFor(READY_PATH));
    for (const path of paths) {
      const response = await staging.match(urlFor(path));
      if (!response) throw new Error('An offline file disappeared before installation finished.');
      await target.put(urlFor(path), response);
    }
    await target.put(urlFor(READY_PATH), new Response(JSON.stringify({v: 4, releaseDigest: digest, assets: publicPaths.size, routes: ROUTES.length}), {
      headers: {'Content-Type': 'application/json'},
    }));
    committed = true;
    return {cacheName: name, assets: publicPaths.size, routes: ROUTES.length};
  } finally {
    await caches.delete(stagingName);
    if (target && !committed && !await target.match(urlFor(READY_PATH))) await caches.delete(name);
  }
}

self.addEventListener('install', event => {
  // Updates stay waiting while the older worker protects an installed release.
  // The explicit INSTALL_RELEASE flow calls skipWaiting after a verified commit.
  event.waitUntil(Promise.resolve());
});
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });

self.addEventListener('message', event => {
  if (event.data?.type !== 'INSTALL_RELEASE' || !event.ports?.[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    const digest = await digestPromise;
    try {
      const source = new URL(event.source?.url ?? 'about:blank');
      if (source.origin !== origin || !INSTALL_SOURCES.has(source.pathname) ||
          Object.keys(event.data).length !== 2 || ![digest, ...retainedReleases.map(release => release.releaseDigest)].includes(event.data.releaseDigest)) {
        throw new Error('Reload this assessment before installing its offline release.');
      }
      // Frozen v1, v2, and v3 clients can install this compatible superset. Echo
      // their exact requested digest while retaining all public releases.
      const replyDigest = event.data.releaseDigest;
      const progress = (completed, total) => port.postMessage({type: 'OFFLINE_PROGRESS', releaseDigest: replyDigest, completed, total});
      if (!installation) installation = installRelease(progress).finally(() => { installation = null; });
      const result = await installation;
      await self.skipWaiting();
      port.postMessage({type: 'OFFLINE_READY', releaseDigest: replyDigest, ...result});
    } catch (error) {
      port.postMessage({type: 'OFFLINE_ERROR', releaseDigest: event.data?.releaseDigest,
        message: error?.message || 'Offline installation failed. Answers are unchanged.'});
    }
  })());
});

async function retainedCache(release) {
  const name = `personality-v${release.v}-${release.releaseDigest}`;
  if (!(await caches.keys()).includes(name)) return null;
  const cache = await caches.open(name);
  return await cache.match(urlFor(`/personality/.offline-ready-v${release.v}`)) ? cache : null;
}

async function cachedPublic(path) {
  const current = await (await installedCache())?.match(urlFor(path));
  if (current) return current;
  for (const release of retainedReleases) {
    const readableRoots = retainedReleases.filter(older => older.v <= release.v).map(older => older.root);
    if (ROUTES.includes(path) || readableRoots.some(root => path.startsWith(root))) {
      const retained = await (await retainedCache(release))?.match(urlFor(path));
      if (retained) return retained;
    }
  }
  return undefined;
}

async function navigation(request, path) {
  try {
    const response = await fetch(request);
    if (response.ok) return response;
    return await cachedPublic(path) || response;
  } catch {
    return await cachedPublic(path) || new Response('This assessment is not available offline yet. Reconnect and choose “Make available offline” from your library.', {
      status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'},
    });
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== origin) return;
  if (request.mode === 'navigate' && ROUTES.includes(url.pathname)) {
    // Query data is never a cache key and responses from live navigations are
    // never cached. Only the explicit clean-shell installation writes routes.
    event.respondWith(navigation(request, url.pathname));
  } else if (!url.search && publicPaths.has(url.pathname)) {
    event.respondWith((async () => await cachedPublic(url.pathname) || fetch(request))());
  } else if (!url.search && aiPaths.has(url.pathname)) {
    event.respondWith((async()=>{
      if((await caches.keys()).includes(AI_CACHE.name)){
        const cache=await caches.open(AI_CACHE.name),ready=await cache.match(urlFor(AI_CACHE.ready));
        if(ready&&await ready.text()===AI_CACHE.digest){const installed=await cache.match(urlFor(url.pathname));if(installed)return installed;}
      }
      return fetch(request);
    })());
  }
});
