import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../website/js/src/sw.js', import.meta.url), 'utf8');
const origin = 'https://engmanager.xyz';

function worker() {
    const handlers = new Map();
    const stores = new Map();
    const calls = { fetch: [], reads: [], writes: [], opens: [] };
    const controls = {
        offline: false,
        response: () => new Response('network', {
            headers: { 'Cache-Control': 'public, max-age=3600' },
        }),
    };
    const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
    const open = async name => {
        calls.opens.push(name);
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name);
        return {
            async put(request, response) {
                calls.writes.push(key(request));
                entries.set(key(request), response.clone());
            },
            async match(request) {
                calls.reads.push(key(request));
                return entries.get(key(request))?.clone();
            },
            async addAll() {},
        };
    };
    const caches = {
        open,
        async match(request) {
            calls.reads.push(key(request));
            for (const entries of stores.values()) {
                const response = entries.get(key(request));
                if (response) return response.clone();
            }
        },
        async keys() { return [...stores.keys()]; },
        async delete(name) { return stores.delete(name); },
    };
    vm.runInNewContext(source, {
        self: {
            location: { origin },
            addEventListener(name, callback) { handlers.set(name, callback); },
            skipWaiting: async () => {},
            registration: {},
            clients: { claim: async () => {} },
        },
        caches,
        URL,
        Response,
        fetch: async request => {
            calls.fetch.push(key(request));
            if (controls.offline) throw new TypeError('Network unavailable');
            return controls.response(request);
        },
    }, { filename: 'website/js/src/sw.js' });

    function dispatch(path, { mode = 'navigate', method = 'GET', preload } = {}) {
        const request = { url: new URL(path, origin).href, mode, method };
        let response;
        handlers.get('fetch')({
            request,
            preloadResponse: Promise.resolve(preload),
            respondWith(value) { response = Promise.resolve(value); },
        });
        return response;
    }
    async function seed(path, response) {
        const cache = await open('engmanager-v6');
        await cache.put(path, response);
    }
    return { controls, calls, caches, dispatch, seed };
}

function generated(generation, policy = 'public, no-cache, max-age=0, must-revalidate') {
    return new Response(`<!doctype html><meta name="eng-css-generation" content="${generation}"><article>${generation}</article>`, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': policy },
    });
}

test('public generated HTML revalidates online and retains the latest document offline', async () => {
    const environment = worker();
    const path = '/articles/your-gmail-avatar-is-part-of-your-job-search';
    environment.controls.response = () => generated('first-map');
    const first = await environment.dispatch(path);
    assert.match(await first.text(), /first-map/);
    assert.deepEqual(environment.calls.fetch, [new URL(path, origin).href]);
    assert.match(await (await environment.caches.match(path)).text(), /first-map/);

    environment.controls.response = () => generated('current-map');
    const current = await environment.dispatch(path);
    assert.match(await current.text(), /current-map/);
    assert.equal(environment.calls.fetch.length, 2, 'a cached document must not replace online revalidation');
    assert.match(await (await environment.caches.match(path)).text(), /current-map/);

    environment.controls.offline = true;
    const offline = await environment.dispatch(path);
    assert.match(await offline.text(), /current-map/);
    assert.equal(environment.calls.fetch.length, 3, 'navigation remains network-first before offline fallback');
    assert.equal(environment.calls.writes.length, 2, 'offline fallback must not invent a new cached generation');
});

test('navigation preload can save public no-cache HTML for subsequent offline reading', async () => {
    const environment = worker();
    const path = '/feed';
    const response = await environment.dispatch(path, {
        preload: generated('preloaded-map', 'PUBLIC, NO-CACHE, max-age=0, must-revalidate'),
    });
    assert.match(await response.text(), /preloaded-map/);
    assert.equal(environment.calls.fetch.length, 0, 'a real preload response replaces the duplicate network request');
    environment.controls.offline = true;
    assert.match(await (await environment.dispatch(path)).text(), /preloaded-map/);
});

test('no-cache storage requires a public navigation and never changes asset cache rules', async () => {
    const environment = worker();
    environment.controls.response = () => generated('asset-like', 'public, no-cache');
    const asset = '/assets/css/critical.123456789abc.css';
    assert.match(await (await environment.dispatch(asset, { mode: 'cors' })).text(), /asset-like/);
    assert.equal(await environment.caches.match(asset), undefined, 'mutable no-cache assets must not become cache-first entries');
    assert.equal(environment.calls.writes.length, 0);

    environment.controls.response = () => generated('not-explicitly-public', 'no-cache, max-age=0');
    const path = '/feed';
    assert.match(await (await environment.dispatch(path)).text(), /not-explicitly-public/);
    assert.equal(await environment.caches.match(path), undefined);
    assert.equal(environment.calls.writes.length, 0, 'navigation must not broaden storage of nonpublic no-cache documents');
});

test('immutable hashed assets remain cache-first online and offline', async () => {
    const environment = worker();
    const path = '/assets/css/critical.123456789abc.css';
    environment.controls.response = () => new Response('immutable CSS', {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
    assert.equal(await (await environment.dispatch(path, { mode: 'cors' })).text(), 'immutable CSS');
    assert.equal(await (await environment.dispatch(path, { mode: 'cors' })).text(), 'immutable CSS');
    environment.controls.offline = true;
    assert.equal(await (await environment.dispatch(path, { mode: 'cors' })).text(), 'immutable CSS');
    assert.equal(environment.calls.fetch.length, 1, 'content-addressed assets must not inherit document revalidation');
    assert.equal(environment.calls.writes.length, 1);
});

test('private and no-store HTML never enters the offline document cache', async () => {
    for (const policy of [
        'no-store',
        'private, max-age=0',
        'public, no-cache, no-store',
        'public, NO-CACHE, PRIVATE',
    ]) {
        const environment = worker();
        const path = '/feed';
        await environment.seed('/offline.html', new Response('public offline fallback'));
        environment.calls.writes.length = 0;
        environment.controls.response = () => generated('sensitive-map', policy);
        assert.match(await (await environment.dispatch(path)).text(), /sensitive-map/);
        assert.equal(await environment.caches.match(path), undefined, policy);
        assert.equal(environment.calls.writes.length, 0, policy);
        environment.controls.offline = true;
        assert.equal(await (await environment.dispatch(path)).text(), 'public offline fallback', policy);
    }
});

test('payment and private routes bypass worker interception even with stale entries', async () => {
    const paths = [
        '/checkout',
        '/checkout/order',
        '/%63heckout',
        '/shop?payment_intent=pi_example',
        '/shop?payment%5Fintent%5Fclient%5Fsecret=secret',
        '/shop?setup_intent=si_example',
        '/shop?setup_intent_client_secret=secret',
        '/shop?redirect_status=succeeded',
        '/personality',
        '/personality/private?share=secret',
        '/%70ersonality/private',
        '/assets/personality/v7/styles.css',
        '/articles/big-personality?share=secret',
        '/articles/%62ig-personality?share=secret',
        '/unsubscribe',
        '/api/private',
    ];
    for (const path of paths) {
        const environment = worker();
        await environment.seed(path, new Response('stale private entry'));
        environment.calls.reads.length = 0;
        environment.calls.writes.length = 0;
        environment.calls.opens.length = 0;
        assert.equal(environment.dispatch(path), undefined, `the worker must leave ${path} to ordinary network handling`);
        assert.equal(environment.calls.fetch.length, 0, path);
        assert.equal(environment.calls.reads.length, 0, path);
        assert.equal(environment.calls.writes.length, 0, path);
        assert.equal(environment.calls.opens.length, 0, path);
    }
});

test('cross-origin and non-GET requests bypass worker interception', () => {
    const environment = worker();
    assert.equal(environment.dispatch('https://example.com/feed'), undefined);
    assert.equal(environment.dispatch('/feed', { method: 'POST' }), undefined);
    assert.equal(environment.calls.fetch.length, 0);
    assert.equal(environment.calls.reads.length, 0);
    assert.equal(environment.calls.writes.length, 0);
});
