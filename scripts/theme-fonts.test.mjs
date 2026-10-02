import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../website/js/src/theme-fonts.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return {promise, resolve, reject};
}

function harness({cache = new Map(), storage = true, http = new Map(), reduced = false, dark = false, stallRead = false, stallWrite = false, stallBody = false, failedShared = [], stalledShared = []} = {}) {
  const requests = [], states = [], decodes = [], fonts = new Set(), styles = new Map(), media = new Map();
  const pending = new Map(), events = new Map(), swaps = [], dispatched = [], sharedLoads = [];
  const dataset = new Proxy({}, {set(target, key, value) { target[key] = value; if (key === 'fontState') states.push(value); return true; }});
  const response = (name) => new Response(new TextEncoder().encode(name));
  const cached = (name) => stallBody ? {ok: true, arrayBuffer: () => new Promise(() => {})} : response(name);
  const manifest = Object.fromEntries(['light', 'dark', 'forest'].map(name => [name, {family: `PP ${name}`, url: `/assets/${name}.woff2`}]));
  const document = {visibilityState: 'visible', addEventListener: (name, callback) => events.set(name, callback), documentElement: {dataset, style: {setProperty: (key, value) => styles.set(key, value)}}, fonts: {load: async (query, sample) => {
    sharedLoads.push({query, sample});
    if (failedShared.some(family => query.includes(family))) throw Error('CSS face network error');
    if (stalledShared.some(family => query.includes(family))) return new Promise(() => {});
    return [{}];
  }, add: face => fonts.add(face)}};
  class FontFace {
    constructor(family, bytes, options) { this.family = family; this.bytes = bytes; this.weight = options.weight; this.status = 'unloaded'; }
    async load() { decodes.push(this.family); if (new TextDecoder().decode(this.bytes) === 'corrupt') throw Error('invalid font'); this.status = 'loaded'; return this; }
  }
  const window = {__engThemeFonts: manifest, __engSharedFonts: {
    display: {family: 'PP Monument Extended', url: '/assets/display.woff2', weight: '900'},
    redacted: {family: 'Redacted', url: '/assets/redacted.woff2', weight: '400'},
  }, FontFace, dispatchEvent: event => dispatched.push(event), addEventListener: (name, callback) => events.set(name, callback), __engNav: {onSwap: callback => swaps.push(callback)}};
  const context = {
    window, document, FontFace, AbortController, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    setTimeout: (fn, ms) => setTimeout(fn, ms <= 1000 ? 0 : ms), clearTimeout,
    matchMedia(query) {
      const item = {matches: query.includes('color-scheme') ? dark : reduced, addEventListener(_, callback) { this.change = callback; }};
      media.set(query, item); return item;
    },
    caches: {
      async match(url) { if (stallRead) return new Promise(() => {}); if (!storage) throw Error('denied'); return cache.has(url) ? cached(cache.get(url)) : null; },
      async open() {
        if (!storage) throw Error('denied');
        return {async put(url, res) { if (stallWrite) return new Promise(() => {}); cache.set(url, await res.text()); }, async delete(url) { cache.delete(url); }};
      },
    },
    async fetch(url, options = {}) {
      if (options.cache === 'only-if-cached') {
        assert.equal(options.mode, 'same-origin');
        return http.has(url) ? response(http.get(url)) : new Response('', {status: 504});
      }
      requests.push(url);
      const request = deferred(); pending.set(url, request);
      return request.promise;
    },
  };
  vm.runInNewContext(source, context);
  return {api: window.__engTypography, requests, states, decodes, dataset, fonts, styles, media, cache, events, swaps, document, dispatched, sharedLoads,
    finish: name => pending.get(`/assets/${name}.woff2`).resolve(response(name)),
    fail: name => pending.get(`/assets/${name}.woff2`).reject(Error('offline'))};
}

test('eagerly starts only shared faces; selected body loads on demand and decodes before reveal', async () => {
  const h = harness();
  assert.deepEqual(h.requests, []);
  const ready = h.api.apply('forest'); await tick();
  assert.deepEqual(h.requests, ['/assets/forest.woff2']);
  assert.equal(h.dataset.fontState, 'loading');
  assert.equal(h.styles.size, 0);
  h.finish('forest'); await ready;
  assert.deepEqual(h.decodes, ['PP forest']);
  assert.equal(h.dataset.fontTheme, 'forest');
  assert.deepEqual(h.states, ['checking', 'loading', 'leaving', 'entering', 'ready']);
  assert.ok(h.cache.has('/assets/forest.woff2'));
});

test('loaded faces switch synchronously without a loader or repeat fetch', async () => {
  const h = harness(); const first = h.api.apply('light'); await tick(); h.finish('light'); await first;
  h.states.length = 0; const next = h.api.apply('light');
  assert.equal(h.dataset.fontState, 'ready'); await next;
  assert.deepEqual(h.states, ['checking', 'ready']); assert.equal(h.requests.length, 1);
});

test('a new document checks cached bytes, decodes them, and skips all Redacted states', async () => {
  const h = harness({cache: new Map([['/assets/dark.woff2', 'dark']])});
  await h.api.apply('dark');
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.states, ['checking', 'ready']);
  assert.deepEqual(h.decodes, ['PP dark']);
});

test('HTTP cache works when Cache Storage is unavailable', async () => {
  const h = harness({storage: false, http: new Map([['/assets/light.woff2', 'light']])});
  await h.api.apply('light'); assert.deepEqual(h.requests, []);
  assert.deepEqual(h.states, ['checking', 'ready']);
});

test('storage denied on a cold load does not prevent rendering', async () => {
  const h = harness({storage: false}); const ready = h.api.apply('light');
  await tick(); h.finish('light'); await ready;
  assert.equal(h.dataset.fontState, 'ready');
});

test('rapid selections share pending loads and the latest selection wins', async () => {
  const h = harness(); const first = h.api.apply('light'); await tick();
  const second = h.api.apply('forest'); await tick();
  const third = h.api.apply('light'); await tick();
  assert.equal(h.requests.length, 2);
  h.finish('light'); await third; h.finish('forest'); await Promise.all([first, second]);
  assert.equal(h.dataset.fontTheme, 'light');
  assert.equal(h.dataset.fontState, 'ready');
});

test('failed loads recover readable text and can be retried', async () => {
  const h = harness(); const bad = h.api.apply('forest'); await tick(); h.fail('forest');
  await new Promise(resolve => setTimeout(resolve, 10)); h.fail('forest'); await bad;
  assert.equal(h.dataset.fontState, 'error');
  const retry = h.api.apply('forest'); await tick(); h.finish('forest'); await retry;
  assert.equal(h.dataset.fontState, 'ready'); assert.equal(h.requests.length, 3);
});

test('reduced motion keeps the loading face but omits exit/entry animations', async () => {
  const h = harness({reduced: true}); const ready = h.api.apply('light'); await tick(); h.finish('light'); await ready;
  assert.deepEqual(h.states, ['checking', 'loading', 'ready']);
});

test('Auto follows OS preference and updates when that preference changes', async () => {
  const h = harness({dark: true, cache: new Map([['/assets/dark.woff2', 'dark'], ['/assets/light.woff2', 'light']])});
  await h.api.apply('auto'); assert.equal(h.dataset.fontTheme, 'dark');
  const media = h.media.get('(prefers-color-scheme: dark)'); media.matches = false; media.change();
  await h.api.ready; assert.equal(h.dataset.fontTheme, 'light');
});

test('inactive preview documents reuse the decoded face', async () => {
  const h = harness({cache: new Map([['/assets/light.woff2', 'light']])}); await h.api.apply('light');
  const fonts = new Set(), styles = new Map();
  const doc = {documentElement: {dataset: {}, style: {setProperty: (k, v) => styles.set(k, v)}}, fonts};
  h.api.syncDocument(doc);
  assert.equal(fonts.size, 1); assert.equal(doc.documentElement.dataset.fontTheme, 'light');
  assert.match(styles.get('--font-body-active'), /PP light/);
});

test('a corrupt cached face fetches fresh bytes without another theme click', async () => {
  const h = harness({cache: new Map([['/assets/light.woff2', 'corrupt']])});
  const ready = h.api.apply('light'); await tick();
  assert.deepEqual(h.requests, ['/assets/light.woff2']);
  h.finish('light'); await ready;
  assert.equal(h.dataset.fontState, 'ready');
  assert.equal(h.dataset.fontTheme, 'light');
  assert.deepEqual(h.decodes, ['PP light', 'PP light']);
});

test('an unsettled storage read falls through to HTTP/network and cannot strand checking', async () => {
  const h = harness({stallRead: true});
  const ready = h.api.apply('light');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(h.requests, ['/assets/light.woff2']);
  h.finish('light'); await ready;
  assert.equal(h.dataset.fontState, 'ready');
});

test('an unsettled cache write does not hold a decoded font behind loading', async () => {
  const h = harness({stallWrite: true});
  const ready = h.api.apply('light'); await tick(); h.finish('light');
  await ready;
  assert.equal(h.dataset.fontState, 'ready');
  assert.equal(h.dataset.fontTheme, 'light');
});

test('a transient cold fetch retries once and renders without user intervention', async () => {
  const h = harness();
  const ready = h.api.apply('light'); await tick(); h.fail('light');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(h.requests, ['/assets/light.woff2', '/assets/light.woff2']);
  h.finish('light'); await ready;
  assert.equal(h.dataset.fontState, 'ready');
});

test('retrying an older selection never replaces the currently selected face', async () => {
  const h = harness();
  const first = h.api.apply('light'); await tick(); h.fail('light');
  const second = h.api.apply('forest'); await tick(); h.finish('forest');
  await second;
  await new Promise(resolve => setTimeout(resolve, 10)); h.finish('light');
  await first;
  assert.equal(h.dataset.fontTheme, 'forest');
  assert.equal(h.dataset.fontState, 'ready');
});

for (const event of ['online', 'pageshow', 'visibilitychange', 'swap']) {
  test(`a failed font can recover on ${event}, while a ready font does not re-fetch`, async () => {
    const h = harness();
    const failed = h.api.apply('light'); await tick(); h.fail('light');
    await new Promise(resolve => setTimeout(resolve, 10)); h.fail('light'); await failed;
    assert.equal(h.dataset.fontState, 'error');
    const resume = event === 'swap' ? h.swaps[0] : h.events.get(event);
    resume(); await tick();
    assert.equal(h.requests.length, 3);
    h.finish('light'); await h.api.ready;
    assert.equal(h.dataset.fontTheme, 'light');
    assert.equal(h.dataset.fontState, 'ready');
    resume(); await tick();
    assert.equal(h.requests.length, 3);
  });
}


test('a cached response with an unsettled body falls back to a fresh download', async () => {
  const h = harness({cache: new Map([['/assets/light.woff2', 'light']]), stallBody: true});
  const ready = h.api.apply('light');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(h.requests, ['/assets/light.woff2']);
  h.finish('light'); await ready;
  assert.equal(h.dataset.fontState, 'ready');
  assert.equal(h.dataset.fontTheme, 'light');
});


test('a failed CSS display face is replaced with decoded bytes and notifies fitted headings', async () => {
  const h = harness({failedShared: ['PP Monument Extended']});
  await tick();
  assert.deepEqual(h.requests, ['/assets/display.woff2']);
  h.finish('display'); await h.api.displayReady;
  const face = [...h.fonts].find(face => face.family === 'PP Monument Extended');
  assert.equal(face.status, 'loaded');
  assert.equal(face.weight, '900');
  assert.ok(h.dispatched.some(event => event.type === 'engmanager:fontchange' && event.detail.role === 'display'));
  assert.ok(h.sharedLoads.every(call => call.sample === 'Loading'));
});

test('online recovery retries a sticky failed display font even when the body font is ready', async () => {
  const h = harness({failedShared: ['PP Monument Extended'], cache: new Map([['/assets/light.woff2', 'light']])});
  await h.api.apply('light'); await tick();
  h.fail('display'); await new Promise(resolve => setTimeout(resolve, 10)); h.fail('display');
  await h.api.displayReady;
  assert.equal(h.dataset.fontState, 'ready');
  assert.equal(h.fonts.size, 1);
  h.events.get('online')(); await tick();
  assert.equal(h.requests.length, 3);
  h.finish('display'); await h.api.displayReady;
  assert.ok([...h.fonts].some(face => face.family === 'PP Monument Extended' && face.status === 'loaded'));
  assert.equal(h.dataset.fontTheme, 'light');
  h.events.get('online')(); await tick();
  assert.equal(h.requests.length, 3);
});


test('a stalled CSS shared-face load is bounded before decoded replacement', async () => {
  const h = harness({stalledShared: ['PP Monument Extended']});
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(h.requests, ['/assets/display.woff2']);
  h.finish('display'); await h.api.displayReady;
  assert.ok([...h.fonts].some(face => face.family === 'PP Monument Extended' && face.status === 'loaded'));
});

test('preview documents receive recovered shared faces even before a body face activates', async () => {
  const h = harness({failedShared: ['PP Monument Extended']});
  await tick(); h.finish('display'); await h.api.displayReady;
  const fonts = new Set();
  h.api.syncDocument({documentElement: {}, fonts});
  assert.equal(fonts.size, 1);
  assert.equal([...fonts][0].family, 'PP Monument Extended');
});
