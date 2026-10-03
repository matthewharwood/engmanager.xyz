import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../website/js/src/article-date-countup.js', import.meta.url), 'utf8');

// Run the shipped controller against deterministic browser events and a manual
// clock. The harness records every asynchronous owner, so lifecycle checks can
// verify that detached dates have no pending frame, observer or animation work.
class TestEvents {
  listeners = new Map();
  addEventListener(type, callback, options = {}) {
    if (options.signal?.aborted) return;
    const entries = this.listeners.get(type) || [];
    if (entries.some(entry => entry.callback === callback)) return;
    const entry = {callback, once: !!options.once, signal: options.signal};
    if (options.signal) {
      entry.abort = () => this.removeEventListener(type, callback);
      options.signal.addEventListener('abort', entry.abort, {once: true});
    }
    entries.push(entry);
    this.listeners.set(type, entries);
  }
  removeEventListener(type, callback) {
    const entries = this.listeners.get(type) || [];
    const removed = entries.filter(entry => entry.callback === callback);
    removed.forEach(entry => entry.signal?.removeEventListener('abort', entry.abort));
    this.listeners.set(type, entries.filter(entry => entry.callback !== callback));
  }
  dispatchEvent(event) {
    event.target ||= this;
    for (const entry of [...(this.listeners.get(event.type) || [])]) {
      entry.callback(event);
      if (entry.once) this.removeEventListener(event.type, entry.callback);
    }
  }
  listenerCount() {
    return [...this.listeners.values()].reduce((count, entries) => count + entries.length, 0);
  }
}

class TestElement extends TestEvents {
  constructor(tagName = 'div') {
    super();
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.className = '';
    this._textContent = '';
    this.style = {
      setProperty(name, value) { this[name] = value; },
      removeProperty(name) { delete this[name]; },
    };
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
    };
    this.rect = {left: 20, top: 20, right: 260, bottom: 60, width: 240, height: 40};
  }
  get textContent() { return this._textContent + this.children.map(child => child.textContent).join(''); }
  set textContent(value) {
    this.children.forEach(child => { child.parentElement = null; });
    this.children = [];
    this._textContent = String(value);
  }
  get childNodes() { return this.children; }
  get isConnected() { return this.tagName === 'HTML' || !!this.parentElement?.isConnected; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = String(value);
  }
  getAttribute(name) {
    if (name === 'class') return this.className || null;
    if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] ?? null;
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())];
  }
  appendChild(child) {
    child.remove();
    this.children.push(child);
    child.parentElement = this;
    return child;
  }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  replaceChildren(...children) { this.textContent = ''; this.append(...children); }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
  matches(selector) {
    return selector.split(',').some(part => {
      const candidate = part.trim();
      const tag = candidate.match(/^[a-z][a-z0-9-]*/i)?.[0];
      if (tag && tag.toUpperCase() !== this.tagName) return false;
      if ([...candidate.matchAll(/\.([a-z0-9_-]+)/gi)].some(match => !this.classList.contains(match[1]))) return false;
      return [...candidate.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g)].every(([, name, value]) => {
        const actual = this.getAttribute(name);
        return value === undefined ? actual !== null : actual === value;
      });
    });
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  getBoundingClientRect() { return this.rect; }
}

function browser({dates = [{iso: '2026-05-23', text: 'MAY 23, 2026'}], reducedMotion = false, intersection = true, hidden = false} = {}) {
  const window = new TestEvents();
  const document = new TestEvents();
  document.documentElement = new TestElement('html');
  document.body = document.documentElement.appendChild(new TestElement('body'));
  document.readyState = 'complete';
  document.hidden = hidden;
  document.visibilityState = hidden ? 'hidden' : 'visible';
  document.prerendering = false;
  document.createElement = tag => new TestElement(tag);
  document.querySelectorAll = selector => document.documentElement.querySelectorAll(selector);
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  const appendDate = ({iso, text, offscreen = false}, parent = document.body) => {
    const node = parent.appendChild(new TestElement('time'));
    node.className = 'article-meta-date';
    if (iso !== undefined) node.setAttribute('datetime', iso);
    node.textContent = text;
    if (offscreen) node.rect = {...node.rect, top: 1200, bottom: 1240};
    return node;
  };
  const nodes = dates.map(date => appendDate(date));
  const motion = new TestEvents();
  motion.matches = reducedMotion;
  const observers = [];
  class IntersectionObserver {
    targets = new Set();
    disconnects = 0;
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
    observe(node) { this.targets.add(node); }
    unobserve(node) { this.targets.delete(node); }
    disconnect() { this.disconnects++; this.targets.clear(); }
  }
  let now = 0, nextId = 0;
  const frames = new Map(), timers = new Map(), animations = [];
  const requestAnimationFrame = callback => { const id = ++nextId; frames.set(id, callback); return id; };
  const cancelAnimationFrame = id => frames.delete(id);
  const setTimeout = (callback, delay = 0) => { const id = ++nextId; timers.set(id, {callback, due: now + delay}); return id; };
  const clearTimeout = id => timers.delete(id);
  const setInterval = () => { throw new Error('Date count-up must not create recurring timers'); };
  TestElement.prototype.animate = function (keyframes, options) {
    const animation = {
      node: this, keyframes, options, playState: 'running', canceled: 0,
      cancel() { this.canceled++; this.playState = 'idle'; this.node = null; },
      finish() { this.playState = 'finished'; },
    };
    animations.push(animation);
    return animation;
  };
  const beforeSwap = [], onSwap = [];
  Object.assign(window, {
    innerHeight: 900, innerWidth: 1200,
    matchMedia: () => motion,
    requestAnimationFrame, cancelAnimationFrame,
    setTimeout, clearTimeout, setInterval, clearInterval: clearTimeout,
    __engNav: {onBeforeSwap: callback => beforeSwap.push(callback), onSwap: callback => onSwap.push(callback)},
  });
  if (intersection) window.IntersectionObserver = IntersectionObserver;
  const context = vm.createContext({
    window, document, Element: TestElement, HTMLElement: TestElement, AbortController,
    ...(intersection ? {IntersectionObserver} : {}),
    requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout, setInterval, clearInterval: clearTimeout,
    matchMedia: window.matchMedia, performance: {now: () => now}, innerWidth: 1200, innerHeight: 900, console,
  });
  vm.runInContext(source, context, {filename: 'article-date-countup.js'});
  const tick = elapsed => {
    now += elapsed;
    for (const [id, timer] of [...timers]) {
      if (timer.due <= now) { timers.delete(id); timer.callback(); }
    }
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(now));
  };
  const intersect = (node, isIntersecting = true) => {
    observers.filter(observer => observer.targets.has(node)).forEach(observer => observer.callback([{
      target: node, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0,
    }], observer));
  };
  const dispatch = (target, type, values = {}) => target.dispatchEvent({type, ...values});
  return {
    window, document, nodes, motion, observers, frames, timers, animations, beforeSwap, onSwap,
    tick, intersect, appendDate,
    visual: node => node.querySelector('.article-date-countup-label')?.textContent ?? node.textContent,
    hide() { document.hidden = true; document.visibilityState = 'hidden'; dispatch(document, 'visibilitychange'); },
    show() { document.hidden = false; document.visibilityState = 'visible'; dispatch(document, 'visibilitychange'); },
    reduceMotion() { motion.matches = true; dispatch(motion, 'change', {matches: true}); },
    pagehide() { dispatch(window, 'pagehide'); },
    pageshow(persisted = true) { dispatch(window, 'pageshow', {persisted}); },
    unmount() { beforeSwap.forEach(callback => callback()); },
    mount() { onSwap.forEach(callback => callback(document.body)); },
  };
}

function assertNoAsyncWork(page) {
  assert.equal(page.frames.size, 0, 'no queued animation frame');
  assert.equal(page.timers.size, 0, 'no queued timer');
  assert.equal(page.observers.reduce((sum, observer) => sum + observer.targets.size, 0), 0, 'no observed date nodes');
  assert.ok(page.animations.every(animation => animation.playState !== 'running'), 'all decorative animations canceled');
}

test('visible dates start at September 3, 1985, advance monotonically, and finish within three seconds', () => {
  const original = '  May 23, 2026  ';
  const page = browser({dates: [{iso: '2026-05-23', text: original}]});
  const node = page.nodes[0];
  assert.equal(node.dataset.dateCountup, 'pending');
  assert.equal(page.frames.size, 0, 'offscreen observation does not continuously schedule frames');
  page.intersect(node);
  assert.equal(node.dataset.dateCountup, 'running');
  assert.match(page.visual(node), /SEP(?:T(?:EMBER)?)?\s+0?3,?\s+1985/i);
  assert.equal(node.querySelector('.article-date-countup-label').getAttribute('aria-hidden'), 'true');
  assert.equal(node.querySelector('.article-date-countup-accessible').textContent, original);
  const values = [Date.parse(page.visual(node))];
  for (let index = 0; index < 29; index++) {
    page.tick(100);
    values.push(Date.parse(page.visual(node)));
    assert.equal(page.frames.size, 1, 'one shared frame is scheduled during the count');
  }
  assert.ok(values.every(Number.isFinite), 'every displayed frame is a calendar date');
  assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]), 'dates never move backwards');
  assert.ok(values.at(-1) <= Date.parse('2026-05-23'));
  page.tick(100);
  assert.equal(node.dataset.dateCountup, 'done');
  assert.equal(node.textContent, original, 'the exact server-rendered formatting is restored');
  assert.equal(node.getAttribute('datetime'), '2026-05-23');
  assert.equal(node.children.length, 0, 'temporary accessible and visual wrappers are removed');
  assert.ok(page.animations.length > 0, 'counting has a decorative animation');
  assert.ok(page.animations.every(animation => animation.options.duration > 0 && animation.options.duration <= 80), 'each rolling effect fits within one date step');
  assertNoAsyncWork(page);
});

test('UTC leap-day targets remain valid and final formatting survives a long delayed frame', () => {
  const page = browser({dates: [{iso: '2024-02-29', text: 'FEB 29, 2024'}]});
  const node = page.nodes[0];
  page.intersect(node);
  page.tick(1000);
  const intermediate = Date.parse(page.visual(node));
  assert.ok(Number.isFinite(intermediate));
  assert.ok(intermediate > Date.UTC(1985, 8, 3) && intermediate < Date.UTC(2024, 1, 29));
  page.tick(5000);
  assert.equal(node.textContent, 'FEB 29, 2024');
  assert.equal(node.getAttribute('datetime'), '2024-02-29');
  assertNoAsyncWork(page);
});

test('UTC calendar rendering survives a timezone west of UTC', () => {
  const timezone = process.env.TZ;
  process.env.TZ = 'Pacific/Honolulu';
  try {
    const page = browser({dates: [{iso: '2024-02-29', text: 'FEB 29, 2024'}]});
    page.intersect(page.nodes[0]);
    assert.equal(page.visual(page.nodes[0]), 'SEP 03, 1985');
    page.tick(2999);
    assert.equal(page.visual(page.nodes[0]), 'FEB 28, 2024', 'the final counting day is calculated in UTC');
    page.tick(1);
    assert.equal(page.nodes[0].textContent, 'FEB 29, 2024');
    assertNoAsyncWork(page);
  } finally {
    if (timezone === undefined) delete process.env.TZ;
    else process.env.TZ = timezone;
  }
});

test('each date has its own start time while all running dates share one animation frame', () => {
  const page = browser({dates: [
    {iso: '2026-05-23', text: 'MAY 23, 2026'},
    {iso: '2024-02-29', text: 'FEB 29, 2024'},
  ]});
  const [first, second] = page.nodes;
  page.intersect(first);
  page.tick(1000);
  assert.equal(second.dataset.dateCountup, 'pending');
  page.intersect(second);
  assert.match(page.visual(second), /1985/);
  assert.equal(page.frames.size, 1);
  page.tick(2000);
  assert.equal(first.dataset.dateCountup, 'done');
  assert.equal(second.dataset.dateCountup, 'running');
  assert.equal(page.frames.size, 1);
  page.tick(1000);
  assert.equal(second.dataset.dateCountup, 'done');
  assertNoAsyncWork(page);
});

test('a running date leaving the viewport settles immediately and cancels its decoration', () => {
  const page = browser();
  const node = page.nodes[0];
  page.intersect(node);
  page.tick(400);
  page.intersect(node, false);
  assert.equal(node.textContent, 'MAY 23, 2026');
  assert.equal(node.dataset.dateCountup, 'done');
  assertNoAsyncWork(page);
});

test('navigation releases detached nodes and remounts new dates without accumulating lifecycle listeners', () => {
  const page = browser();
  const oldNode = page.nodes[0];
  const counts = () => [page.window.listenerCount(), page.document.listenerCount(), page.motion.listenerCount()];
  const mountedCounts = counts();
  assert.equal(page.beforeSwap.length, 1);
  assert.equal(page.onSwap.length, 1);
  page.intersect(oldNode);
  page.tick(400);
  const detachedLabel = oldNode.querySelector('.article-date-countup-label');
  page.unmount();
  oldNode.remove();
  assert.equal(oldNode.textContent, 'MAY 23, 2026');
  assert.equal(oldNode.dataset.dateCountup, 'done');
  assert.equal(page.document.listenerCount(), 0, 'per-mount document listeners are removed');
  assert.equal(page.motion.listenerCount(), 0, 'per-mount preference listeners are removed');
  assert.ok(page.observers.every(observer => observer.disconnects > 0));
  assert.ok(page.animations.every(animation => animation.node !== detachedLabel));
  assertNoAsyncWork(page);
  const newNode = page.appendDate({iso: '2026-10-02', text: 'OCT 2, 2026'});
  page.mount();
  assert.deepEqual(counts(), mountedCounts, 'repeat mounting does not duplicate persistent listeners');
  assert.equal(newNode.dataset.dateCountup, 'pending');
  page.intersect(newNode);
  page.tick(3000);
  assert.equal(newNode.textContent, 'OCT 2, 2026');
  assertNoAsyncWork(page);
});

test('soft navigation waits for the incoming page to leave inert and releases pending outgoing dates', () => {
  const page = browser();
  const oldNode = page.nodes[0];
  const oldObserver = page.observers[0];
  const globalListeners = page.window.listenerCount();
  assert.equal(oldNode.dataset.dateCountup, 'pending');
  page.unmount();
  oldNode.remove();
  assert.equal(oldNode.textContent, 'MAY 23, 2026');
  assert.equal(oldObserver.targets.size, 0, 'pending outgoing dates are no longer observed');
  assert.ok(oldObserver.disconnects > 0);
  assertNoAsyncWork(page);

  const incoming = page.document.body.appendChild(page.document.createElement('main'));
  incoming.setAttribute('inert', '');
  const newNode = page.appendDate({iso: '2026-10-02', text: 'OCT 2, 2026'}, incoming);
  page.mount();
  assert.equal(newNode.textContent, 'OCT 2, 2026');
  assert.equal(newNode.children.length, 0, 'inert entrance/preview content is not enhanced');
  assert.equal(newNode.dataset.dateCountup, undefined);
  assert.equal(page.observers.length, 1, 'onSwap does not observe the inert incoming page');
  assertNoAsyncWork(page);

  incoming.removeAttribute('inert');
  page.window.dispatchEvent({type: 'eng:journeysettled'});
  assert.equal(newNode.dataset.dateCountup, 'pending');
  // An observer notification already queued before disconnect must be inert.
  oldObserver.callback([{target: oldNode, isIntersecting: true, intersectionRatio: 1}], oldObserver);
  assert.equal(oldNode.dataset.dateCountup, 'done');
  assert.equal(page.frames.size, 0, 'the closed pending node cannot start late');
  page.intersect(newNode);
  assert.equal(newNode.dataset.dateCountup, 'running');
  assert.equal(page.visual(newNode), 'SEP 03, 1985');
  page.tick(3000);
  assert.equal(newNode.textContent, 'OCT 2, 2026');
  assert.equal(page.window.listenerCount(), globalListeners, 'journey completion does not add global listeners');
  assert.equal(page.document.listenerCount(), 0);
  assert.equal(page.motion.listenerCount(), 0);
  assertNoAsyncWork(page);
});

test('pagehide, hidden documents and preference changes cancel every owned asynchronous task', () => {
  for (const cancel of ['pagehide', 'hide', 'reduceMotion']) {
    const page = browser({dates: [
      {iso: '2026-05-23', text: 'MAY 23, 2026'},
      {iso: '2024-02-29', text: 'FEB 29, 2024'},
    ]});
    page.intersect(page.nodes[0]);
    page.tick(400);
    page[cancel]();
    assert.deepEqual(page.nodes.map(node => node.textContent), ['MAY 23, 2026', 'FEB 29, 2024'], cancel);
    assert.ok(page.nodes.every(node => node.dataset.dateCountup === 'done'), cancel);
    assert.equal(page.document.listenerCount(), 0, cancel);
    assert.equal(page.motion.listenerCount(), 0, cancel);
    assertNoAsyncWork(page);
  }
});

test('BFCache restoration preserves finished dates and can enhance new DOM nodes', () => {
  const page = browser();
  page.intersect(page.nodes[0]);
  page.tick(100);
  page.pagehide();
  const newNode = page.appendDate({iso: '2026-10-02', text: 'OCT 2, 2026'});
  page.pageshow();
  assert.equal(page.nodes[0].dataset.dateCountup, 'done');
  assert.equal(newNode.dataset.dateCountup, 'pending');
  page.intersect(newNode);
  page.tick(3000);
  assertNoAsyncWork(page);
});

test('the initial pageshow event preserves the current pending and running count-up', () => {
  const page = browser();
  const node = page.nodes[0];
  const originalLabel = node.querySelector('.article-date-countup-label');
  page.pageshow(false);
  assert.equal(node.dataset.dateCountup, 'pending');
  assert.equal(node.querySelector('.article-date-countup-label'), originalLabel);
  page.intersect(node);
  page.tick(500);
  page.pageshow(false);
  assert.equal(node.dataset.dateCountup, 'running');
  assert.equal(node.querySelector('.article-date-countup-label'), originalLabel);
  page.tick(2500);
  assert.equal(node.dataset.dateCountup, 'done');
  assertNoAsyncWork(page);
});

test('an initially hidden page defers enhancement until visible and cancels its activation listeners on pagehide', () => {
  const activated = browser({hidden: true});
  assert.equal(activated.nodes[0].children.length, 0);
  assertNoAsyncWork(activated);
  activated.show();
  assert.equal(activated.nodes[0].dataset.dateCountup, 'pending');
  activated.intersect(activated.nodes[0]);
  activated.tick(3000);
  assertNoAsyncWork(activated);

  const canceled = browser({hidden: true});
  assert.ok(canceled.document.listenerCount() > 0, 'visibility activation is owned by this mount');
  canceled.pagehide();
  assert.equal(canceled.document.listenerCount(), 0, 'pagehide removes deferred activation listeners');
  canceled.show();
  assert.equal(canceled.nodes[0].children.length, 0);
  assert.equal(canceled.observers.length, 0, 'a late visibility event cannot reactivate a disposed page');
  assertNoAsyncWork(canceled);
});

test('reduced motion and initially hidden documents retain original dates without scheduling work', () => {
  for (const settings of [{reducedMotion: true}, {hidden: true}]) {
    const page = browser(settings);
    assert.equal(page.nodes[0].textContent, 'MAY 23, 2026');
    assert.equal(page.animations.length, 0);
    assertNoAsyncWork(page);
  }
});

test('without IntersectionObserver visible dates animate and offscreen dates remain readable without timers', () => {
  const page = browser({intersection: false, dates: [
    {iso: '2026-05-23', text: 'MAY 23, 2026'},
    {iso: '2024-02-29', text: 'FEB 29, 2024', offscreen: true},
  ]});
  assert.equal(page.nodes[0].dataset.dateCountup, 'running');
  assert.equal(page.nodes[1].textContent, 'FEB 29, 2024');
  assert.equal(page.frames.size, 1);
  page.tick(3000);
  assertNoAsyncWork(page);
});

test('invalid calendar dates and non-date tags are left intact', () => {
  const page = browser({dates: [
    {iso: 'not-a-date', text: 'UNKNOWN'},
    {iso: '2025-02-29', text: 'FEB 29, 2025'},
    {iso: undefined, text: 'NO DATE'},
  ]});
  assert.deepEqual(page.nodes.map(node => node.textContent), ['UNKNOWN', 'FEB 29, 2025', 'NO DATE']);
  assert.equal(page.animations.length, 0);
  assertNoAsyncWork(page);
});
