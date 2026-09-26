import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../website/src/components/sigil/script.js', import.meta.url), 'utf8');

function target(extra = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(name, fn) {
      const set = listeners.get(name) || new Set(); set.add(fn); listeners.set(name, set);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    fire(name, data = {}) { for (const fn of [...(listeners.get(name) || [])]) fn(data); },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  }, extra);
}

function harness({ reduced = false, supported = true, failPaint = false, quiet = false, width = 900, height = 900 } = {}) {
  let fills = 0, paints = 0, nextFrame = 0;
  const frames = new Map();
  const observers = [];
  const ctx = {
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, arc() {},
    save() {}, restore() {}, translate() {}, scale() {}, setTransform() {}, fillRect() {},
    clearRect() { if (failPaint) throw new Error('unavailable'); paints++; },
    fill() { fills++; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    getImageData() { return { data: [239, 234, 226, 255] }; },
  };
  const canvas = target({ width: 0, height: 0, getContext() { return supported ? ctx : null; } });
  const attrs = new Map();
  const button = target({ hidden: true, textContent: 'Pause animation' });
  const host = {
    dataset: { sigilQuiet: String(quiet) },
    querySelector(selector) {
      if (selector === '[data-sigil-canvas]') return canvas;
      assert.equal(selector, '[data-sigil-motion]'); return button;
    },
    getBoundingClientRect() { return { width, height }; },
    setAttribute(key, value) { attrs.set(key, value); },
    removeAttribute(key) { attrs.delete(key); },
  };
  const motion = target({ matches: reduced });
  const scheme = target({ matches: false });
  const document = target({
    hidden: false, body: {}, documentElement: {},
    querySelectorAll(selector) { assert.equal(selector, '[data-sigil-scene]'); return [host]; },
    createElement(name) { assert.equal(name, 'canvas'); return { getContext: () => ctx }; },
  });
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  class ResizeObserver extends Observer {}
  class IntersectionObserver extends Observer {}
  class MutationObserver extends Observer {}
  const requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
  const cancelAnimationFrame = id => frames.delete(id);
  const window = target({
    requestAnimationFrame, devicePixelRatio: 3, innerWidth: width,
    matchMedia: value => value.includes('reduced-motion') ? motion : scheme,
    ResizeObserver, IntersectionObserver, MutationObserver,
  });
  // A decorative enhancement must never inspect tokens or browser storage.
  for (const object of [window, document]) {
    for (const name of ['location', 'cookie', 'localStorage']) {
      Object.defineProperty(object, name, { get() { throw new Error(`Private ${name} accessed`); } });
    }
  }
  const context = vm.createContext({
    window, document, requestAnimationFrame, cancelAnimationFrame,
    ResizeObserver, IntersectionObserver, MutationObserver,
    getComputedStyle: () => ({ backgroundColor: '#efeae2' }),
    fetch: () => { throw new Error('The renderer must not make requests'); },
  });
  vm.runInContext(source, context);
  const flush = now => {
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(fn => fn(now));
  };
  return { window, document, canvas, button, host, attrs, observers, frames, motion, flush,
    get fills() { return fills; }, get paints() { return paints; },
    observer: kind => observers.find(observer => observer.constructor.name === kind),
  };
}

test('unsupported canvas preserves the static poster without a loop or listeners', () => {
  const h = harness({ supported: false });
  assert.equal(h.attrs.has('data-sigil-ready'), false);
  assert.equal(h.frames.size, 0);
  assert.equal(h.window.listenerCount(), 0);
});

test('paints detailed geometry under a capped bitmap budget and never accesses private data', () => {
  const h = harness({ width: 2200, height: 1600 });
  h.flush(1);
  assert.equal(h.attrs.has('data-sigil-ready'), true);
  assert.ok(h.fills > 400, 'paint contains the faceted sculpture and eye');
  assert.ok(h.canvas.width * h.canvas.height < 1803000, 'DPR is capped by total pixels');
  assert.equal(h.frames.size, 1);
});

test('reduced motion renders one still and reacts to motion preference changes', () => {
  const h = harness({ reduced: true });
  h.flush(1);
  assert.equal(h.paints, 1);
  assert.equal(h.frames.size, 0);
  h.motion.matches = false; h.motion.fire('change'); h.flush(100);
  assert.equal(h.frames.size, 1);
  h.motion.matches = true; h.motion.fire('change'); h.flush(200);
  assert.equal(h.frames.size, 0);
});

test('hidden documents and offscreen sculptures stop animation until visible again', () => {
  const h = harness(); h.flush(1);
  h.document.hidden = true; h.document.fire('visibilitychange');
  assert.equal(h.frames.size, 0);
  h.document.hidden = false; h.document.fire('visibilitychange'); h.flush(100);
  assert.equal(h.frames.size, 1);
  h.observer('IntersectionObserver').callback([{ isIntersecting: false }]);
  assert.equal(h.frames.size, 0);
  h.observer('IntersectionObserver').callback([{ isIntersecting: true }]); h.flush(200);
  assert.equal(h.frames.size, 1);
});

test('back-forward cache suspends, while navigation releases bitmap, listeners and observers', () => {
  const h = harness(); h.flush(1);
  h.window.fire('pagehide', { persisted: true });
  assert.equal(h.frames.size, 0);
  assert.ok(h.window.listenerCount() > 0);
  h.window.fire('pageshow'); h.flush(100);
  assert.equal(h.frames.size, 1);
  h.window.fire('pagehide', { persisted: false });
  assert.equal(h.frames.size, 0);
  assert.equal(h.canvas.width * h.canvas.height, 1);
  assert.equal(h.window.listenerCount(), 0);
  assert.equal(h.document.listenerCount(), 0);
  assert.ok(h.observers.every(observer => observer.disconnected));
  assert.equal(h.attrs.has('data-sigil-ready'), false);
  h.observer('ResizeObserver').callback();
  h.observer('MutationObserver').callback();
  assert.equal(h.canvas.width * h.canvas.height, 1, 'queued observers cannot revive released resources');
  assert.equal(h.frames.size, 0);
});

test('context loss exposes the fallback, and restoration safely repaints', () => {
  const h = harness(); h.flush(1);
  let prevented = false;
  h.canvas.fire('contextlost', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.attrs.has('data-sigil-ready'), false);
  assert.equal(h.frames.size, 0);
  h.canvas.fire('contextrestored'); h.flush(100);
  assert.equal(h.attrs.has('data-sigil-ready'), true);
});

test('drawing failure leaves the fallback and releases resources without escaping to other scripts', () => {
  const h = harness({ failPaint: true });
  assert.doesNotThrow(() => h.flush(1));
  assert.equal(h.attrs.has('data-sigil-ready'), false);
  assert.equal(h.frames.size, 0);
  assert.equal(h.window.listenerCount(), 0);
});


test('the accessible pause control stops motion without hiding the artwork, and resumes on request', () => {
  const h = harness(); h.flush(1);
  assert.equal(h.button.hidden, false);
  h.button.fire('click'); h.flush(100);
  assert.equal(h.button.textContent, 'Resume animation');
  assert.equal(h.frames.size, 0);
  assert.equal(h.attrs.has('data-sigil-ready'), true);
  h.window.fire('pageshow'); h.flush(200);
  assert.equal(h.frames.size, 0, 'resuming the page must preserve explicit pause');
  h.button.fire('click'); h.flush(300);
  assert.equal(h.button.textContent, 'Pause animation');
  assert.equal(h.frames.size, 1);
  h.motion.matches = true; h.motion.fire('change'); h.flush(400);
  assert.equal(h.button.hidden, true);
  assert.equal(h.frames.size, 0);
});
