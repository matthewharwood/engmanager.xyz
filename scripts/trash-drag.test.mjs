import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../website/js/src/trash-drag.js', import.meta.url), 'utf8');
function events() {
    const handlers = new Map();
    return { handlers,
        addEventListener(name, fn) { const set = handlers.get(name) || new Set(); set.add(fn); handlers.set(name, set); },
        removeEventListener(name, fn) { handlers.get(name)?.delete(fn); },
        emit(name, event = {}) { for (const fn of [...handlers.get(name) || []]) fn(event); },
    };
}
function harness({ reduced = false, hidden = false, present = true } = {}) {
    let now = 0, id = 0, reads = 0, node;
    const frames = new Map(), hooks = {}, observers = [], classes = new Set();
    const motion = { ...events(), matches: reduced };
    function logo(width = 100, height = 50) {
        return { dataset: {}, style: {}, hidden: false, isConnected: true,
            getBoundingClientRect() { reads++; return { left: 30, top: 30, width, height, right: 30 + width, bottom: 30 + height }; },
            removeAttribute() {}, toggleAttribute() {},
        };
    }
    node = present ? logo() : null;
    const style = { removeProperty() {}, setProperty() {} };
    const window = { ...events(), innerWidth: 390, innerHeight: 844, matchMedia: () => motion,
        __engNav: { busy: false, onBeforeSwap(fn) { hooks.dispose = fn; }, onSwap(fn) { hooks.mount = fn; } },
    };
    const document = { ...events(), hidden, documentElement: { style },
        body: { dataset: {}, classList: { contains: name => classes.has(name) } },
        querySelector: selector => selector === '[data-dvd-bouncer]' ? node : null, querySelectorAll: () => [],
    };
    class ResizeObserver { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } }
    vm.runInNewContext(source, { window, document, ResizeObserver,
        performance: { now: () => now }, requestAnimationFrame(fn) { frames.set(++id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
        setTimeout() {},
    });
    return { frames, hooks, window, document, motion, observers,
        get node() { return node; }, get reads() { return reads; },
        step(dt = 1000 / 60) { now += dt; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); },
        hide(value) { document.hidden = value; document.emit('visibilitychange'); },
        expose(value) { value ? classes.add('journey-revealing') : classes.delete('journey-revealing'); window.emit('eng:journeyexposure', { detail: { active: value } }); },
        reduce(value) { motion.matches = value; motion.emit('change'); },
        replace(width = 100, height = 50) { if (node) node.isConnected = false; node = logo(width, height); return node; },
    };
}
function coordinates(node) {
    const match = node.style.transform.match(/translate3d\((\d+)px, (\d+)px/);
    assert.ok(match, 'DVD has a composited, bounded transform');
    return { x: Number(match[1]), y: Number(match[2]) };
}

test('DVD frames use cached geometry and resize bounds stay within the phone viewport', () => {
    const h = harness(); const initial = h.reads;
    for (let i = 0; i < 120; i++) h.step();
    assert.equal(h.reads, initial, 'the animation never reads transformed bounds');
    assert.equal(h.frames.size, 1);
    h.window.innerWidth = 90; h.window.innerHeight = 40; h.window.emit('resize');
    h.observers[0].fn([{ borderBoxSize: [{ inlineSize: 100, blockSize: 50 }], contentRect: { width: 100, height: 50 } }]);
    assert.deepEqual(coordinates(h.node), { x: 0, y: 0 });
    assert.equal(h.reads, initial, 'viewport and observed element dimensions avoid a new bounding-box read');
    h.hooks.dispose(); assert.equal(h.frames.size, 0);
});

test('hidden and curtain-exposed DVD decorations schedule zero frames and resume without a time jump', () => {
    const h = harness(); h.step(); const before = coordinates(h.node);
    h.hide(true); assert.equal(h.frames.size, 0); h.step(10000); assert.deepEqual(coordinates(h.node), before);
    h.hide(false); assert.equal(h.frames.size, 1); h.step();
    const resumed = coordinates(h.node); assert.ok(resumed.x - before.x <= 2 && resumed.y - before.y <= 2);
    h.expose(true); const held = h.node.style.transform; assert.equal(h.frames.size, 0);
    h.step(10000); assert.equal(h.node.style.transform, held);
    h.expose(false); h.step(); assert.equal(h.frames.size, 1); h.hooks.dispose();
    const hidden = harness({ hidden: true }); assert.equal(hidden.frames.size, 0); hidden.hide(false); assert.equal(hidden.frames.size, 1); hidden.hooks.dispose();
});

test('an initial reduced-motion visit binds preference recovery and never starts hidden DVD work', () => {
    const h = harness({ reduced: true });
    assert.equal(h.node.hidden, true); assert.equal(h.frames.size, 0); assert.equal(h.reads, 0);
    h.reduce(false); assert.equal(h.node.hidden, false); assert.equal(h.frames.size, 1); h.step(); coordinates(h.node);
    h.reduce(true); assert.equal(h.node.hidden, true); assert.equal(h.frames.size, 0);
    h.reduce(false); assert.equal(h.frames.size, 1);
    assert.equal(h.motion.handlers.get('change').size, 1, 'remounting never duplicates global preference listeners');
    h.hooks.dispose();
});

test('an invisible or held DVD cannot intercept a click at its last position', () => {
    for (const condition of ['exposed', 'reduced', 'hidden', 'busy']) {
        const h = harness();
        h.step();
        if (condition === 'exposed') h.expose(true);
        if (condition === 'reduced') h.reduce(true);
        if (condition === 'hidden') h.hide(true);
        if (condition === 'busy') h.window.__engNav.busy = true;
        const reads = h.reads;
        let prevented = 0;
        const event = { button: 0, clientX: 50, clientY: 50,
            target: { closest: () => null }, preventDefault() { prevented++; } };
        assert.doesNotThrow(() => h.document.emit('pointerdown', event), condition);
        assert.equal(prevented, 0, `${condition} must leave the underlying link or Continue click intact`);
        assert.equal(h.document.body.dataset.dragging, undefined, condition);
        assert.equal(h.reads, reads, `${condition} must not read the invisible logo's bounds`);
        h.hooks.dispose();
    }
});

test('navigation disposes the old observer and moving node before resuming one retained feed instance', () => {
    const h = harness(); const oldNode = h.node, oldObserver = h.observers[0]; h.step();
    h.hooks.dispose(); assert.equal(h.frames.size, 0); assert.ok(oldObserver.disconnected);
    const frozen = oldNode.style.transform;
    const fresh = h.replace(40, 20); h.hooks.mount(); assert.equal(h.frames.size, 1); const current = fresh.style.transform;
    oldObserver.fn([{ contentRect: { width: 900, height: 900 } }]); assert.equal(fresh.style.transform, current, 'a late old observer cannot overwrite current bounds');
    h.step(); assert.equal(oldNode.style.transform, frozen);
    h.hooks.dispose(); h.hooks.mount(); assert.equal(h.frames.size, 1);
    assert.equal(h.window.handlers.get('resize').size, 1); assert.equal(h.window.handlers.get('eng:journeyexposure').size, 1);
    h.hooks.dispose();
});

test('a page without a DVD starts no frame work and a later feed initializes normally', () => {
    const h = harness({ present: false }); assert.equal(h.frames.size, 0); assert.equal(h.reads, 0);
    h.replace(); h.hooks.mount(); assert.equal(h.frames.size, 1); h.step(); coordinates(h.node);
    h.hooks.dispose(); assert.equal(h.frames.size, 0);
});
