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

function harness({cache = new Map(), storage = true, http = new Map(), reduced = false, dark = false} = {}) {
  const requests = [], states = [], decodes = [], fonts = new Set(), styles = new Map(), media = new Map();
  const pending = new Map();
  const dataset = new Proxy({}, {set(target, key, value) { target[key] = value; if (key === 'fontState') states.push(value); return true; }});
  const response = (name) => new Response(new TextEncoder().encode(name));
  const manifest = Object.fromEntries(['light', 'dark', 'forest'].map(name => [name, {family: `PP ${name}`, url: `/assets/${name}.woff2`}]));
  const document = {documentElement: {dataset, style: {setProperty: (key, value) => styles.set(key, value)}}, fonts: {load: async () => [{}], add: face => fonts.add(face)}};
  class FontFace {
    constructor(family, bytes) { this.family = family; this.bytes = bytes; this.status = 'unloaded'; }
    async load() { decodes.push(this.family); this.status = 'loaded'; return this; }
  }
  const window = {__engThemeFonts: manifest, FontFace, dispatchEvent() {}};
  const context = {
    window, document, FontFace, AbortController, CustomEvent: class {},
    setTimeout: (fn, ms) => setTimeout(fn, ms < 1000 ? 0 : ms), clearTimeout,
    matchMedia(query) {
      const item = {matches: query.includes('color-scheme') ? dark : reduced, addEventListener(_, callback) { this.change = callback; }};
      media.set(query, item); return item;
    },
    caches: {
      async match(url) { if (!storage) throw Error('denied'); return cache.has(url) ? response(cache.get(url)) : null; },
      async open() {
        if (!storage) throw Error('denied');
        return {async put(url, res) { cache.set(url, await res.text()); }, async delete(url) { cache.delete(url); }};
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
  return {api: window.__engTypography, requests, states, decodes, dataset, fonts, styles, media, cache,
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
  const h = harness(); const bad = h.api.apply('forest'); await tick(); h.fail('forest'); await bad;
  assert.equal(h.dataset.fontState, 'error');
  const retry = h.api.apply('forest'); await tick(); h.finish('forest'); await retry;
  assert.equal(h.dataset.fontState, 'ready'); assert.equal(h.requests.length, 2);
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
