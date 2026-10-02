import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../website/js/src/journey-curtain.js', import.meta.url), 'utf8');
function harness({ reduced = false, next = true, observer = true } = {}) {
    const events = () => ({ listeners: new Map(),
        addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); },
        emit(type) { for (const fn of this.listeners.get(type) || []) fn(); },
    });
    let now = 0, rafId = 0, top = 400, reads = 0, callbacks = new Map(), observed;
    const hooks = {}, page = { children: [], append(node) { node.parent = this; this.children.push(node); }, querySelectorAll() { return this.children; } };
    function node() { return { ...events(), dataset: {}, attrs: {}, children: [], classList: { add() {} },
        setAttribute(key, value) { this.attrs[key] = value; }, append(...nodes) { this.children.push(...nodes); },
        remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); },
        getBoundingClientRect() { reads++; return { top, bottom: top + 80 }; },
    }; }
    const window = { ...events(), __engNav: { onSwap(fn) { hooks.mount = fn; }, onBeforeSwap(fn) { hooks.dispose = fn; } } };
    const document = { ...events(), hidden: false, querySelector() { return next ? page : null; }, createElementNS: node };
    const motion = { ...events(), matches: reduced };
    class IntersectionObserver { constructor(fn) { this.fn = fn; observed = this; } observe() {} disconnect() { this.disconnected = true; } }
    if (observer) window.IntersectionObserver = IntersectionObserver;
    const context = vm.createContext({ window, document, matchMedia: () => motion, scrollY: 0, innerHeight: 900,
        performance: { now: () => now }, IntersectionObserver,
        requestAnimationFrame(fn) { callbacks.set(++rafId, fn); return rafId; }, cancelAnimationFrame(id) { callbacks.delete(id); },
    });
    vm.runInContext(source, context);
    return { hooks, document, window, motion, page,
        get svg() { return page.children[0]; }, get edge() { return this.svg?.children[1].attrs.d; },
        get pending() { return callbacks.size; }, get reads() { return reads; },
        scroll(delta, elapsed = 16) { now += elapsed; context.scrollY += delta; window.emit('scroll'); },
        step(dt = 16.667) { now += dt; const entries = [...callbacks.values()]; callbacks.clear(); for (const fn of entries) fn(now); },
        settle(dt = 16.667) { let frames = 0; while (callbacks.size && frames++ < 500) this.step(dt); assert.equal(callbacks.size, 0, 'spring must stop scheduling frames'); return frames; },
        outside() { top = 1300; observed?.fn([{ isIntersecting: false }]); }, inside() { top = 400; observed?.fn([{ isIntersecting: true }]); },
    };
}
test('torn edge bends with scroll, settles to the exact cut, and stops all frame work', () => {
    const h = harness(), rest = h.edge; assert.equal(h.svg.attrs['aria-hidden'], 'true');
    h.scroll(100); h.step(); h.step(); assert.notEqual(h.edge, rest); assert.equal(h.svg.dataset.moving, 'true');
    const reads = h.reads; assert(h.settle() < 250); assert.equal(h.edge, rest); assert.equal(h.svg.dataset.moving, undefined);
    assert.equal(h.reads, reads, 'spring frames never read layout');
});
test('fast scrolling and different frame rates remain bounded without invalid geometry', () => {
    for (const dt of [8.333, 16.667, 32, 180]) {
        const h = harness(), rest = h.edge;
        for (let i = 0; i < 20; i++) { h.scroll(i % 2 ? -3000 : 3000); h.step(dt); }
        assert(!/NaN|Infinity/.test(h.edge));
        const ys = [...h.edge.matchAll(/,(-?[\d.]+)/g)].map(match => Number(match[1])); assert(ys.every(y => y >= 0 && y < 100));
        h.settle(dt); assert.equal(h.edge, rest);
    }
});
test('offscreen and hidden surfaces stop work and reduced motion stays still', () => {
    const h = harness(), rest = h.edge;
    h.scroll(100); h.step(); h.outside(); assert.equal(h.pending, 0); assert.equal(h.edge, rest);
    h.scroll(100); assert.equal(h.pending, 0); h.inside(); h.scroll(100); h.step();
    h.document.hidden = true; h.document.emit('visibilitychange'); assert.equal(h.pending, 0); assert.equal(h.edge, rest);
    h.document.hidden = false; h.motion.matches = true; h.motion.emit('change'); h.scroll(100); assert.equal(h.pending, 0); assert.equal(h.edge, rest);
    const reduced = harness({ reduced: true }); reduced.scroll(100); assert.equal(reduced.pending, 0);
});
test('navigation disposes the old curtain and remounts just one', () => {
    const h = harness(); h.scroll(100); h.step(); h.hooks.dispose(); assert.equal(h.pending, 0); assert.equal(h.page.children.length, 0);
    h.hooks.mount(); h.hooks.mount(); assert.equal(h.page.children.length, 1);
    h.window.emit('pagehide'); assert.equal(h.page.children.length, 0); h.window.emit('pageshow'); assert.equal(h.page.children.length, 1); h.scroll(100); h.settle();
});
test('terminal pages create no curtain; visibility fallback works without observer', () => {
    const terminal = harness({ next: false }); terminal.scroll(300); assert.equal(terminal.pending, 0);
    const h = harness({ observer: false }); h.outside(); h.scroll(100); assert.equal(h.pending, 0); h.inside(); h.scroll(100); assert.equal(h.pending, 1); h.settle();
});
