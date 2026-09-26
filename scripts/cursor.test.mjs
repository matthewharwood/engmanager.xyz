import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../website/js/src/big-cursor.js', import.meta.url), 'utf8');

// Exercise the shipped controller through browser events. Rendering is the
// boundary: no browser/GPU dependency is needed to verify native-cursor safety
// or a late model load racing the site's soft-navigation lifecycle.
class TestEvents {
  listeners = new Map();
  addEventListener(type, callback, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({callback, capture: options === true || !!options.capture, once: !!options.once});
    this.listeners.set(type, entries);
    options.signal?.addEventListener('abort', () => this.removeEventListener(type, callback, options), {once: true});
  }
  removeEventListener(type, callback, options = {}) {
    const capture = options === true || !!options.capture;
    this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => entry.callback !== callback || entry.capture !== capture));
  }
  dispatchEvent(event) {
    event.target ||= this;
    for (const entry of [...(this.listeners.get(event.type) || [])]) {
      entry.callback(event);
      if (entry.once) this.removeEventListener(event.type, entry.callback, entry.capture);
    }
  }
  listenerCount() { return [...this.listeners.values()].reduce((sum, entries) => sum + entries.length, 0); }
}

class TestElement extends TestEvents {
  constructor(tagName = 'div') {
    super();
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.className = '';
    this.style = {setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; }};
    this.hidden = false;
    this.popoverOpen = false;
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      toggle: (name, force) => {
        const enabled = force ?? !this.classList.contains(name);
        this.classList[enabled ? 'add' : 'remove'](name);
        return enabled;
      },
    };
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  appendChild(child) { child.remove(); this.children.push(child); child.parentElement = this; return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
  get isConnected() { return this.tagName === 'HTML' || !!this.parentElement?.isConnected; }
  get isContentEditable() { return this.getAttribute('contenteditable') === 'true'; }
  matches(selectors) {
    return selectors.split(',').some(selector => {
      let candidate = selector.trim();
      const exclusions = [...candidate.matchAll(/:not\(([^)]+)\)/g)];
      if (exclusions.some(match => this.matches(match[1]))) return false;
      candidate = candidate.replace(/:not\([^)]+\)/g, '');
      if (candidate.includes(':disabled') && !this.hasAttribute('disabled')) return false;
      candidate = candidate.replaceAll(':disabled', '');
      if (candidate.includes(':popover-open') && !this.popoverOpen) return false;
      candidate = candidate.replaceAll(':popover-open', '');
      const parts = candidate.split(/\s+/);
      if (parts.length > 1) {
        const leaf = parts.pop();
        return this.matches(leaf) && !!this.parentElement?.closest(parts.join(' '));
      }
      const tag = candidate.match(/^[a-z][a-z0-9-]*/i)?.[0];
      if (tag && tag.toUpperCase() !== this.tagName) return false;
      if ([...candidate.matchAll(/\.([a-z0-9_-]+)/gi)].some(match => !this.classList.contains(match[1]))) return false;
      if ([...candidate.matchAll(/#([a-z0-9_-]+)/gi)].some(match => this.id !== match[1])) return false;
      return [...candidate.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g)].every(([, name, value]) => {
        const actual = name.startsWith('data-') ? this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] : this.getAttribute(name);
        return value === undefined ? actual != null : actual === value;
      });
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { return this.rect || {left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0}; }
  showPopover() { this.popoverOpen = true; }
  hidePopover() { this.popoverOpen = false; }
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function browser({gpu = true, reducedMotion = false, coarse = false, forcedColors = false, saveData = false, homepage = true, creation} = {}) {
  const window = new TestEvents();
  const document = new TestEvents();
  document.documentElement = new TestElement('html');
  document.body = document.documentElement.appendChild(new TestElement('body'));
  document.body.className = homepage ? 'homepage' : 'article';
  document.hidden = false;
  document.visibilityState = 'visible';
  document.hasFocus = () => true;
  document.createElement = tag => new TestElement(tag);
  document.querySelector = selector => document.documentElement.querySelector(selector);
  document.querySelectorAll = selector => document.documentElement.querySelectorAll(selector);
  let hit = document.body;
  document.elementFromPoint = () => hit;
  const models = document.body.appendChild(new TestElement('main'));
  models.setAttribute('data-cursor-models', '');
  models.dataset.pointerUrl = '/assets/cursors/pointer.11111111.glb';
  models.dataset.handUrl = '/assets/cursors/hand.22222222.glb';

  const media = new Map();
  const matchMedia = query => {
    if (!media.has(query)) {
      const value = new TestEvents();
      value.matches = query.includes('prefers-reduced-motion') ? reducedMotion
        : query.includes('forced-colors') ? forcedColors
        : query.includes('pointer: coarse') ? coarse
        : query.includes('pointer: fine') || query.includes('hover: hover') ? !coarse : false;
      media.set(query, value);
    }
    return media.get(query);
  };
  const observers = [];
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.connected = false; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; this.connected = true; }
    disconnect() { this.connected = false; }
  }
  let now = 0, id = 0;
  const frames = new Map(), timers = new Map();
  const requestAnimationFrame = callback => { const key = ++id; frames.set(key, callback); return key; };
  const cancelAnimationFrame = key => frames.delete(key);
  const setTimeout = (callback, delay = 0) => { const key = ++id; timers.set(key, {callback, at: now + delay}); return key; };
  const clearTimeout = key => timers.delete(key);
  const beforeSwap = [], onSwap = [], calls = [], renderers = [];
  function renderer() {
    const result = {
      size: 192, hotspot: {x: 28, y: 28}, renders: [], disposed: 0,
      render(state) { this.renders.push({...state}); },
      dispose() { this.disposed++; },
    };
    renderers.push(result);
    return result;
  }
  Object.assign(window, {
    matchMedia, isSecureContext: true, devicePixelRatio: 1, innerWidth: 1200, innerHeight: 900,
    requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout,
    __engNav: {onBeforeSwap: callback => beforeSwap.push(callback), onSwap: callback => onSwap.push(callback)},
    __engCursorRenderer: {create: async (canvas, options) => { calls.push({canvas, options}); return creation ? creation.promise : renderer(); }},
  });
  const context = vm.createContext({
    window, document, navigator: {gpu: gpu ? {} : undefined, connection: {saveData}}, HTMLElement: TestElement, Element: TestElement,
    MutationObserver, AbortController, matchMedia, requestAnimationFrame, cancelAnimationFrame,
    setTimeout, clearTimeout, performance: {now: () => now}, console,
    getComputedStyle: () => ({getPropertyValue: () => '#e64553'}),
  });
  vm.runInContext(source, context, {filename: 'big-cursor.js'});
  const tick = async (count = 1) => {
    for (let index = 0; index < count; index++) {
      await Promise.resolve();
      now += 1000 / 60;
      for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.callback(); }
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(now));
    }
    await Promise.resolve();
  };
  const pointer = (type = 'pointermove', target = document.body, overrides = {}) => {
    hit = target;
    const event = {type, target, clientX: 400, clientY: 300, pointerType: 'mouse', button: 0, buttons: type === 'pointerdown' ? 1 : 0, ...overrides};
    document.dispatchEvent(event); window.dispatchEvent(event);
  };
  const swap = home => {
    beforeSwap.forEach(callback => callback());
    document.body.className = home ? 'homepage' : 'article';
    onSwap.forEach(callback => callback(models));
  };
  return {
    window, document, models, calls, renderers, renderer, frames, observers, media, tick, pointer, swap,
    active: () => document.body.classList.contains('cursor-3d-active'),
    overlay: () => document.querySelector('.big-cursor'),
    element: (tag, parent = document.body) => parent.appendChild(new TestElement(tag)),
    dragging: value => {
      if (value) document.body.dataset.dragging = 'true'; else delete document.body.dataset.dragging;
      observers.filter(observer => observer.connected && observer.target === document.body).forEach(observer => observer.callback([{attributeName: 'data-dragging'}]));
    },
  };
}

test('unsupported GPU, accessibility preferences, data saving, and non-homepages retain native cursors without loading models', async () => {
  for (const settings of [{gpu: false}, {reducedMotion: true}, {coarse: true}, {forcedColors: true}, {saveData: true}, {homepage: false}]) {
    const page = browser(settings);
    page.pointer();
    await page.tick(3);
    assert.equal(page.calls.length, 0, JSON.stringify(settings));
    assert.equal(page.active(), false);
  }
});

test('model loading is lazy and native cursor remains until the first successful frame', async () => {
  const creation = deferred(), page = browser({creation});
  assert.equal(page.calls.length, 0);
  page.pointer();
  await page.tick();
  assert.equal(page.calls.length, 1);
  assert.equal(page.active(), false);
  assert.equal(page.calls[0].options.pointerUrl, page.models.dataset.pointerUrl);
  assert.equal(page.calls[0].options.handUrl, page.models.dataset.handUrl);
  creation.resolve(page.renderer());
  await page.tick(3);
  assert.equal(page.active(), true);
  assert.ok(page.renderers[0].renders.length > 0);
});

test('navigation aborts pending models and disposes a late renderer without hiding the next page cursor', async () => {
  const creation = deferred(), page = browser({creation});
  page.pointer();
  await page.tick();
  page.swap(false);
  assert.equal(page.calls[0].options.signal.aborted, true);
  const renderer = page.renderer();
  creation.resolve(renderer);
  await page.tick(3);
  assert.equal(renderer.disposed, 1);
  assert.equal(renderer.renders.length, 0);
  assert.equal(page.active(), false);
  assert.equal(page.overlay(), null);
});

test('model rejection and GPU device loss restore the native cursor', async () => {
  const creation = deferred(), failed = browser({creation});
  failed.pointer();
  await failed.tick();
  creation.reject(new Error('GPU adapter unavailable'));
  await failed.tick(3);
  assert.equal(failed.active(), false);
  const page = browser();
  page.pointer();
  await page.tick(3);
  assert.equal(page.active(), true);
  page.calls[0].options.onFailure(new Error('device lost'));
  await page.tick();
  assert.equal(page.active(), false);
  assert.equal(page.renderers[0].disposed, 1);
  assert.equal(page.frames.size, 0);
});

test('pointer, hand, and grip modes follow interactive targets and existing trash drag state', async () => {
  const page = browser();
  page.pointer();
  await page.tick(3);
  assert.equal(page.overlay().dataset.mode, 'arrow');
  const link = page.element('a'); link.setAttribute('href', '/articles/example');
  page.pointer('pointermove', link);
  await page.tick();
  assert.equal(page.overlay().dataset.mode, 'open');
  const marquee = page.element('div'); marquee.className = 'marquee';
  const chip = page.element('span', marquee); chip.className = 'chip';
  page.pointer('pointermove', chip);
  page.dragging(true);
  await page.tick(20);
  assert.equal(page.overlay().dataset.mode, 'grab');
  assert.ok(page.renderers[0].renders.at(-1).grip > 0.9);
  page.dragging(false);
  await page.tick();
  assert.equal(page.overlay().dataset.mode, 'open');
  page.pointer('pointermove');
  await page.tick(10);
  assert.equal(page.overlay().dataset.mode, 'arrow');
  const button = page.element('button'); button.setAttribute('disabled', '');
  page.pointer('pointermove', button);
  await page.tick();
  assert.equal(page.overlay().dataset.mode, 'arrow');
});

test('editable targets and touch input show native cursors and stop drawing', async () => {
  const page = browser();
  const initialInput = page.element('input');
  page.pointer('pointermove', initialInput);
  await page.tick(3);
  assert.equal(page.calls.length, 0, 'editing alone does not request model assets');
  page.pointer();
  await page.tick(3);
  for (const tag of ['input', 'textarea', 'div']) {
    const target = page.element(tag);
    if (tag === 'div') target.setAttribute('contenteditable', 'true');
    page.pointer('pointermove', target);
    await page.tick();
    assert.equal(page.active(), false, tag);
    assert.equal(page.overlay().popoverOpen, false, tag);
    assert.equal(page.frames.size, 0, tag);
    page.pointer();
    await page.tick();
    assert.equal(page.active(), true);
  }
  page.pointer('pointermove', page.document.body, {pointerType: 'touch'});
  await page.tick();
  assert.equal(page.active(), false);
  assert.equal(page.frames.size, 0);
});

test('click springs settle, exact hotspot follows movement, and blur restores native pointer', async () => {
  const page = browser();
  page.pointer();
  await page.tick(3);
  page.pointer('pointerdown');
  await page.tick(8);
  assert.ok(page.renderers[0].renders.at(-1).press > 0.4);
  page.pointer('pointerup');
  page.pointer('pointermove', page.document.body, {clientX: 680, clientY: 470});
  await page.tick();
  assert.equal(page.overlay().style.transform, 'translate3d(652px, 442px, 0)');
  assert.ok(Math.abs(page.renderers[0].renders.at(-1).tiltX) > 0);
  await page.tick(300);
  assert.equal(page.frames.size, 0, 'GPU drawing stops once the damped spring settles');
  page.window.dispatchEvent({type: 'blur'});
  assert.equal(page.active(), false);
  assert.equal(page.overlay().popoverOpen, false);
});

test('opening another top-layer popover raises the cursor again without moving its hotspot', async () => {
  const page = browser();
  page.pointer();
  await page.tick(3);
  const overlay = page.overlay(), transform = overlay.style.transform;
  const modal = page.element('div'); modal.setAttribute('popover', 'auto');
  page.document.dispatchEvent({type: 'toggle', target: modal, newState: 'open'});
  assert.equal(overlay.popoverOpen, false);
  await page.tick();
  assert.equal(overlay.popoverOpen, true);
  assert.equal(overlay.style.transform, transform);
  page.document.dispatchEvent({type: 'toggle', target: overlay, newState: 'open'});
  assert.equal(overlay.popoverOpen, true, 'the overlay ignores its own toggle events');
});

test('soft navigation releases listeners, observers, and GPU resources and remounts once', async () => {
  const page = browser();
  const initialListeners = page.window.listenerCount() + page.document.listenerCount();
  page.pointer();
  await page.tick(3);
  const first = page.renderers[0];
  page.swap(false);
  assert.equal(first.disposed, 1);
  assert.equal(page.overlay(), null);
  assert.equal(page.active(), false);
  assert.equal(page.frames.size, 0);
  assert.equal(page.observers.filter(observer => observer.connected).length, 0);
  assert.equal(page.window.listenerCount() + page.document.listenerCount(), 0);
  page.models.dataset.handUrl = '/assets/cursors/hand.33333333.glb';
  page.swap(true);
  assert.equal(page.window.listenerCount() + page.document.listenerCount(), initialListeners);
  assert.equal(page.document.querySelectorAll('.big-cursor').length, 1);
  page.pointer();
  await page.tick(3);
  assert.equal(page.calls.length, 2);
  assert.equal(page.calls[1].options.handUrl, page.models.dataset.handUrl);
  assert.equal(page.active(), true);
});

test('changing motion preferences disposes a running cursor and keeps native input usable', async () => {
  const page = browser();
  page.pointer();
  await page.tick(3);
  const motion = page.media.get('(prefers-reduced-motion: reduce)');
  motion.matches = true;
  motion.dispatchEvent({type: 'change'});
  assert.equal(page.active(), false);
  assert.equal(page.overlay(), null);
  assert.equal(page.renderers[0].disposed, 1);
  page.pointer();
  await page.tick(3);
  assert.equal(page.calls.length, 1);
});

test('a renderer exception and a stalled GPU initialization cannot leave the native cursor hidden', async () => {
  const creation = deferred(), page = browser({creation});
  page.pointer();
  await page.tick();
  const renderer = page.renderer();
  renderer.render = () => { throw new Error('GPU render failed'); };
  creation.resolve(renderer);
  await page.tick(3);
  assert.equal(page.active(), false);
  assert.equal(renderer.disposed, 1);
  const pending = deferred(), stalled = browser({creation: pending});
  stalled.pointer();
  await stalled.tick(610);
  assert.equal(stalled.calls[0].options.signal.aborted, true);
  assert.equal(stalled.active(), false);
  const lateRenderer = stalled.renderer();
  pending.resolve(lateRenderer);
  await stalled.tick(3);
  assert.equal(lateRenderer.disposed, 1);
  assert.equal(lateRenderer.renders.length, 0);
});
