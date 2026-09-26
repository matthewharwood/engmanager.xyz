import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../website/js/src/newsletter-unsubscribe.js', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../website/js/src/sw.js', import.meta.url), 'utf8');
const token = `v1.123.${'a'.repeat(64)}`;
const tick = () => new Promise(resolve => setImmediate(resolve));

function element() {
  return {
    dataset: {}, attributes: new Map(), listeners: new Map(), textContent: '', removed: false,
    setAttribute(key, value) { this.attributes.set(key, value); },
    removeAttribute(key) { this.attributes.delete(key); },
    addEventListener(name, handler) { this.listeners.set(name, handler); },
    remove() { this.removed = true; },
  };
}

function harness({ prerendering = false, supportsFetch = true } = {}) {
  const nodes = Object.fromEntries(['form', 'state', 'heading', 'message', 'mark', 'submit'].map(name => [name, element()]));
  const requests = [], events = [], timers = new Map(), listeners = new Map();
  const document = {
    prerendering, title: 'Newsletter preferences',
    querySelector(selector) { return nodes[selector.match(/data-unsubscribe-(\w+)/)?.[1]]; },
    addEventListener(name, handler) { listeners.set(name, handler); },
  };
  class FormData {
    constructor(form) { assert.equal(form, nodes.form); }
    [Symbol.iterator]() { return [['token', token]][Symbol.iterator](); }
  }
  const context = {
    document, FormData, URLSearchParams, AbortController,
    history: { replaceState(_state, _title, url) { events.push(['history', url]); } },
    setTimeout(callback) { const id = Symbol(); timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: supportsFetch ? (url, options) => {
      events.push(['fetch', url]);
      return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
    } : undefined,
  };
  vm.runInNewContext(source, context);
  return {
    nodes, document, requests, events, timers,
    submit() { nodes.form.listeners.get('submit')?.({ preventDefault() {} }); },
    activate() { document.prerendering = false; const handler = listeners.get('prerenderingchange'); listeners.delete('prerenderingchange'); handler?.(); },
    async respond(status, body) { requests.at(-1).resolve({ status, ok: status >= 200 && status < 300, json: async () => body }); await tick(); },
  };
}

test('auto-posts the bearer once, clears the URL, and removes the form only after confirmed success', async () => {
  const h = harness();
  assert.equal(h.requests.length, 1);
  const { url, options } = h.requests[0];
  assert.equal(url, '/api/newsletter/unsubscribe');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Accept, 'application/json');
  assert.equal(options.body.get('token'), token);
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.redirect, 'error');
  assert.deepEqual(h.events, [['history', '/unsubscribe'], ['fetch', '/api/newsletter/unsubscribe']]);
  h.submit();
  assert.equal(h.requests.length, 1, 'a second click cannot duplicate an in-flight request');
  assert.equal(h.nodes.form.removed, false);
  await h.respond(200, { status: 'unsubscribed' });
  assert.equal(h.nodes.state.dataset.unsubscribeState, 'success');
  assert.equal(h.nodes.form.removed, true, 'the bearer leaves the document with the form');
  assert.match(h.document.title, /Unsubscribed/);
  assert.equal(h.timers.size, 0);
  h.submit();
  assert.equal(h.requests.length, 1, 'success cannot submit again');
});

test('a failed response preserves an explicit retry and never claims success', async () => {
  const h = harness();
  await h.respond(503, { status: 'unsubscribed' });
  assert.equal(h.nodes.state.dataset.unsubscribeState, 'error');
  assert.equal(h.nodes.form.removed, false);
  assert.equal(h.nodes.submit.disabled, false);
  assert.equal(h.nodes.message.attributes.get('role'), 'alert');
  h.submit();
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].options.body.get('token'), token);
  await h.respond(200, { status: 'unsubscribed' });
  assert.equal(h.nodes.state.dataset.unsubscribeState, 'success');
});

test('network failure and unconfirmed HTTP200 remain retryable', async () => {
  const h = harness();
  h.requests[0].reject(new Error('network unavailable'));
  await tick();
  assert.equal(h.nodes.state.dataset.unsubscribeState, 'error');
  assert.equal(h.nodes.form.removed, false);
  h.submit();
  await h.respond(200, { status: 'pending' });
  assert.equal(h.nodes.state.dataset.unsubscribeState, 'error');
  assert.equal(h.nodes.submit.disabled, false);
  assert.equal(h.timers.size, 0);
});

test('an invalid bearer removes the retry form and directs the reader to their email link', async () => {
  const h = harness();
  await h.respond(400, { error: 'invalid' });
  assert.equal(h.nodes.state.dataset.unsubscribeState, 'invalid');
  assert.equal(h.nodes.form.removed, true);
  assert.match(h.nodes.message.textContent, /link in a newsletter email/);
  h.submit();
  assert.equal(h.requests.length, 1);
});

test('prerendering never mutates subscriptions; activation starts one POST', async () => {
  const h = harness({ prerendering: true });
  assert.equal(h.requests.length, 0);
  assert.deepEqual(h.events, []);
  h.activate();
  h.activate();
  assert.equal(h.requests.length, 1);
  await h.respond(200, { status: 'unsubscribed' });
  assert.equal(h.nodes.state.dataset.unsubscribeState, 'success');
});

test('unsupported fetch preserves native form submission', () => {
  const h = harness({ supportsFetch: false });
  assert.equal(h.requests.length, 0);
  assert.equal(h.nodes.form.listeners.has('submit'), false);
  assert.equal(h.nodes.form.removed, false);
});

test('the service worker never intercepts or caches unsubscribe links or API requests', async () => {
  const handlers = new Map(), responses = [];
  let networkCalls = 0, cacheCalls = 0;
  vm.runInNewContext(workerSource, {
    self: { location: { origin: 'https://engmanager.xyz' }, addEventListener(name, handler) { handlers.set(name, handler); } },
    URL, Response,
    fetch: async () => { networkCalls++; return new Response('ok', { headers: { 'Cache-Control': 'no-store' } }); },
    caches: new Proxy({}, { get: () => async () => { cacheCalls++; return undefined; } }),
  });
  const dispatch = (method, path) => handlers.get('fetch')({
    request: { method, url: `https://engmanager.xyz${path}`, mode: 'navigate' },
    respondWith(response) { responses.push(response); },
  });
  for (const [method, path] of [
    ['GET', `/unsubscribe?token=${token}`],
    ['GET', `/%75nsubscribe?token=${token}`],
    ['POST', '/api/newsletter/unsubscribe'],
    ['GET', '/api/newsletter/unsubscribe'],
  ]) dispatch(method, path);
  await Promise.all(responses);
  assert.equal(responses.length, 0, 'private routes must bypass respondWith entirely');
  assert.equal(networkCalls, 0);
  assert.equal(cacheCalls, 0);
  dispatch('GET', '/feed');
  await Promise.all(responses);
  assert.equal(responses.length, 1, 'the normal navigation handler still runs');
  assert.equal(networkCalls, 1);
});
