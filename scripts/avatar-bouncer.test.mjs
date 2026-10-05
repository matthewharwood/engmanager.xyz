import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../website/js/src/avatar-bouncer.js', import.meta.url), 'utf8');
function events() {
    const handlers = new Map();
    return { handlers,
        addEventListener(name, fn) { const set = handlers.get(name) || new Set(); set.add(fn); handlers.set(name, set); },
        removeEventListener(name, fn) { handlers.get(name)?.delete(fn); },
        emit(name, event = {}) { for (const fn of [...handlers.get(name) || []]) fn(event); },
    };
}
function harness({ reduced = false, stored = null, present = true } = {}) {
    let now = 0, id = 0, reads = 0, writes = 0, node;
    const frames = new Map(), hooks = {}, sizes = [], visibility = [], classes = new Set();
    const motion = { ...events(), matches: reduced }, bio = { ...events(), open: false, matches() { return this.open; } };
    function portrait() {
        const attributes = new Map();
        return { ...events(), attributes, style: { removeProperty(name) { delete this[name]; } }, isConnected: true, hover: false, focusVisible: false,
            getBoundingClientRect() { reads++; return { left: 16, top: 732, width: 48, height: 48 }; },
            matches(selector) { return selector === ':hover' ? this.hover : this.focusVisible; },
            setAttribute(name, value) { attributes.set(name, value); }, removeAttribute(name) { attributes.delete(name); },
            toggleAttribute(name, value) { value ? attributes.set(name, '') : attributes.delete(name); },
        };
    }
    node = present ? portrait() : null;
    const window = { ...events(), innerWidth: 390, innerHeight: 844, matchMedia: () => motion,
        __engNav: { busy: false, onBeforeSwap(fn) { hooks.dispose = fn; }, onSwap(fn) { hooks.mount = fn; } },
    };
    const document = { ...events(), hidden: false, body: { classList: { contains: name => classes.has(name) } },
        querySelector: selector => selector === '[data-avatar-bouncer]' ? node : null, getElementById: () => bio,
    };
    class ResizeObserver { constructor(fn) { this.fn = fn; sizes.push(this); } observe() {} disconnect() { this.disconnected = true; } }
    class IntersectionObserver { constructor(fn) { this.fn = fn; visibility.push(this); } observe() {} disconnect() { this.disconnected = true; } }
    const globals = { window, document, ResizeObserver, IntersectionObserver,
        localStorage: { getItem: () => stored, setItem() { writes++; } },
        requestAnimationFrame(fn) { frames.set(++id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
    };
    const context = vm.createContext(globals); vm.runInContext(source, context);
    return { frames, hooks, window, document, motion, bio, sizes, visibility,
        get node() { return node; }, get reads() { return reads; }, get writes() { return writes; },
        step(dt = 1000 / 60) { now += dt; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); },
        hide(value) { document.hidden = value; document.emit('visibilitychange'); },
        expose(value) { value ? classes.add('journey-revealing') : classes.delete('journey-revealing'); window.emit('eng:journeyexposure', { detail: { active: value } }); },
        reduce(value) { motion.matches = value; motion.emit('change'); },
        replace() { if (node) node.isConnected = false; node = portrait(); return node; },
        reloadScript() { vm.runInContext(source, context); },
    };
}
function coordinates(node) {
    const match = node.style.transform?.match(/translate3d\((\d+)px, (\d+)px/);
    assert.ok(match, 'the foreground photo has a bounded, composited transform');
    return { x: Number(match[1]), y: Number(match[2]) };
}

test('the photo reflects off both viewport edges without continuous layout reads or storage writes', () => {
    const h = harness(), initialReads = h.reads;
    h.window.__engAvatarBouncer.place(h.node, 341, 795); h.step();
    for (let i = 0; i < 30; i++) h.step();
    const after = coordinates(h.node);
    assert.ok(after.x < 340 && after.y < 795, 'both directions reverse at the viewport boundary');
    for (let i = 0; i < 1800; i++) {
        h.step(); const position = coordinates(h.node);
        assert.ok(position.x >= 0 && position.x <= 342 && position.y >= 0 && position.y <= 796);
    }
    assert.equal(h.reads, initialReads); assert.equal(h.writes, 0); assert.equal(h.frames.size, 1);
    h.window.innerWidth = 320; h.window.innerHeight = 568; h.window.emit('resize');
    assert.ok(coordinates(h.node).x <= 272 && coordinates(h.node).y <= 520);
    h.sizes[0].fn([{ borderBoxSize: [{ inlineSize: 49.25, blockSize: 49.25 }] }]);
    h.window.__engAvatarBouncer.place(h.node, 1000, 1000);
    assert.deepEqual(coordinates(h.node), { x: 270, y: 518 }, 'fractional photo dimensions cannot round outside the viewport');
    assert.equal(h.reads, initialReads); h.hooks.dispose();
});

test('hover, keyboard focus, bio and dragging pause independently and resume without a time jump', () => {
    const h = harness(); h.step(); h.step();
    h.node.emit('pointerenter'); h.node.focusVisible = true; h.node.emit('focus');
    h.node.emit('pointerleave'); assert.equal(h.frames.size, 0, 'leaving hover preserves the keyboard hold');
    h.bio.emit('beforetoggle', { newState: 'open' }); h.node.emit('blur');
    assert.equal(h.frames.size, 0, 'the open bio remains stationary');
    h.window.__engAvatarBouncer.hold(h.node, true); h.bio.emit('beforetoggle', { newState: 'closed' });
    assert.equal(h.frames.size, 0, 'closing the bio preserves an in-progress drag');
    const placed = h.window.__engAvatarBouncer.place(h.node, 110, 200);
    assert.equal(JSON.stringify(placed), JSON.stringify({ x: 110, y: 200 }));
    h.step(10000); assert.deepEqual(coordinates(h.node), { x: 110, y: 200 });
    h.window.__engAvatarBouncer.hold(h.node, false); h.step();
    assert.deepEqual(coordinates(h.node), { x: 110, y: 200 }, 'the first resumed frame resets its clock');
    h.step(); assert.ok(coordinates(h.node).x > 110);
    h.node.focusVisible = false; h.node.emit('focus'); assert.equal(h.frames.size, 1, 'ordinary mouse focus does not strand the photo');
    h.hooks.dispose();
});

test('hidden, offscreen, reduced and transition-held photos schedule no animation frames', () => {
    const h = harness(); h.step();
    for (const [pause, resume] of [
        [() => h.hide(true), () => h.hide(false)],
        [() => h.expose(true), () => h.expose(false)],
        [() => h.reduce(true), () => h.reduce(false)],
        [() => h.visibility.at(-1).fn([{ isIntersecting: false }]), () => h.visibility.at(-1).fn([{ isIntersecting: true }])],
        [() => { h.window.__engNav.busy = true; h.step(); }, () => { h.window.__engNav.busy = false; h.window.emit('eng:journeysettled'); }],
    ]) {
        pause(); const held = h.node.style.transform; assert.equal(h.frames.size, 0);
        assert.equal(h.node.attributes.has('data-avatar-moving'), false);
        h.step(10000); assert.equal(h.node.style.transform, held);
        resume(); assert.equal(h.frames.size, 1); h.step(); assert.equal(h.node.style.transform, held);
    }
    h.hooks.dispose();
});

test('an initial reduced-motion photo stays docked across retained remounts and responds to preference changes', () => {
    const h = harness({ reduced: true });
    assert.equal(h.frames.size, 0); assert.equal(h.node.attributes.has('data-avatar-floating'), false);
    h.hooks.dispose(); h.hooks.mount();
    assert.equal(h.frames.size, 0); assert.equal(h.node.attributes.has('data-avatar-floating'), false);
    h.reduce(false); assert.equal(h.frames.size, 1);
    assert.deepEqual(coordinates(h.node), { x: 16, y: 732 });
    h.reduce(true); const held = h.node.style.transform; h.step(10000);
    assert.equal(h.frames.size, 0); assert.equal(h.node.style.transform, held); h.hooks.dispose();
});

test('navigation disposes observers and controls before restoring exactly one retained animation', () => {
    const h = harness(), oldNode = h.node, oldObserver = h.sizes[0], oldVisibility = h.visibility[0];
    h.step(); h.step(); h.hooks.dispose();
    assert.equal(h.frames.size, 0); assert.ok(oldObserver.disconnected && oldVisibility.disconnected);
    assert.ok([...oldNode.handlers.values()].every(set => set.size === 0));
    const frozen = oldNode.style.transform;
    h.hooks.mount(); h.reloadScript(); assert.equal(h.frames.size, 1);
    assert.equal(h.node.style.transform, frozen, 'retained DOM resumes its existing position');
    assert.equal(h.window.handlers.get('resize').size, 1); assert.equal(h.motion.handlers.get('change').size, 1);
    h.hooks.dispose(); const fresh = h.replace(); h.hooks.mount(); const before = fresh.style.transform;
    oldObserver.fn([{ contentRect: { width: 900, height: 900 } }]); oldVisibility.fn([{ isIntersecting: false }]);
    assert.equal(fresh.style.transform, before); assert.equal(h.frames.size, 1);
    h.step(); h.step(); assert.equal(oldNode.style.transform, frozen); h.hooks.dispose();
});

test('stored drag positions are safely clamped and pages without a portrait start no work', () => {
    const h = harness({ stored: '{"x":900,"y":1000}' });
    assert.deepEqual(coordinates(h.node), { x: 342, y: 796 });
    assert.equal(h.window.__engAvatarBouncer.place(h.node, NaN, Infinity), false);
    assert.deepEqual(coordinates(h.node), { x: 342, y: 796 }); h.hooks.dispose();
    const missing = harness({ present: false }); assert.equal(missing.frames.size, 0); assert.equal(missing.reads, 0);
    missing.replace(); missing.hooks.mount(); assert.equal(missing.frames.size, 1); missing.hooks.dispose();
});
