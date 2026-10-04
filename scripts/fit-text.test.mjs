import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../website/js/src/fit-text.js', import.meta.url), 'utf8');
const flushed = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function harness({ fontReady = Promise.resolve(), widths = [400, 32, 300] } = {}) {
    const events = [], handlers = new Map(), frames = new Map(), hooks = {}, observers = [];
    let frameId = 0, contextCount = 0, measurements = 0;
    const context = { measureText() { measurements++; return { actualBoundingBoxLeft: 4, actualBoundingBoxRight: 396,
        actualBoundingBoxAscent: 90, actualBoundingBoxDescent: 10 }; } };
    function row(width, name) {
        const properties = new Map(), attributes = new Map();
        const link = { style: { getPropertyValue: name => properties.get(name) || '', setProperty(key, value) { properties.set(key, value); events.push(`write:${name}:${key}`); } } };
        const wrap = { getBoundingClientRect() { events.push(`read:${name}`); return { width }; } };
        const text = { textContent: name, getAttribute: key => key === 'font-size' ? '144' : key === 'font-family' ? 'PP Monument Extended, sans-serif' : '900',
            setAttribute(key, value) { attributes.set(key, value); events.push(`write:${name}:text-${key}`); } };
        const classes = new Set();
        const svg = { isConnected: true, querySelector: () => text, classList: { toggle(key, value) { value ? classes.add(key) : classes.delete(key); events.push(`write:${name}:class`); }, contains: key => classes.has(key) },
            closest: selector => selector.includes('article-fluid-link') ? link : wrap,
            setAttribute(key, value) { attributes.set(key, value); events.push(`write:${name}:${key}`); },
        };
        return { svg, properties, attributes, width(value) { width = value; } };
    }
    let rows = widths.map((width, i) => row(width, `title-${i}`));
    const window = { ResizeObserver: true, __engTypography: { displayReady: fontReady },
        addEventListener(type, fn) { const list = handlers.get(type) || []; list.push(fn); handlers.set(type, list); },
        __engNav: { onSwap(fn) { hooks.mount = fn; }, onBeforeSwap(fn) { hooks.dispose = fn; } },
    };
    const document = { querySelectorAll: () => rows.map(row => row.svg), createElement() { contextCount++; return { getContext: () => context }; } };
    class ResizeObserver { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } }
    vm.runInNewContext(source, { window, document, ResizeObserver,
        requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => frames.delete(id),
    });
    return { rows, hooks, window, document, events, frames, observers,
        get contexts() { return contextCount; }, get measurements() { return measurements; },
        emit(type, event = {}) { for (const fn of handlers.get(type) || []) fn(event); },
        advance() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
        replace(widths) { rows.forEach(row => { row.svg.isConnected = false; }); rows = widths.map((width, i) => row(width, `new-${i}`)); return rows; },
    };
}
function assertReadsBeforeWrites(events) {
    const firstWrite = events.findIndex(event => event.startsWith('write:'));
    const lastRead = events.findLastIndex(event => event.startsWith('read:'));
    assert.ok(firstWrite > lastRead && lastRead >= 0, `container geometry must finish before DOM writes: ${events.join(', ')}`);
}

test('feed titles share one measurement context and batch all geometry before fitting mutations', async () => {
    const h = harness(); await flushed();
    assert.equal(h.contexts, 1); assert.equal(h.measurements, 3);
    assertReadsBeforeWrites(h.events);
    assert.equal(h.rows[0].attributes.get('viewBox'), '0 0 400 100');
    assert.equal(h.rows[0].attributes.get('x'), 4); assert.equal(h.rows[0].attributes.get('y'), 90);
    assert.equal(h.rows[0].properties.get('--title-check-size'), '72px');
    assert.equal(h.rows[1].svg.classList.contains('is-too-small'), true);
    assert.equal(h.rows[1].properties.get('--title-h'), '25px');
    assert.equal(h.rows[1].properties.get('--title-check-size'), '26px');
    await h.hooks.mount(h.document); assert.equal(h.measurements, 3, 'already fitted rows are not measured again');
});

test('resize coalesces into one batch without remeasuring glyphs or rewriting unchanged metrics', async () => {
    const h = harness(); await flushed(); h.events.length = 0;
    h.emit('resize'); h.emit('resize'); h.observers[0].fn(); assert.equal(h.frames.size, 1);
    h.advance(); assert.equal(h.measurements, 3); assert.equal(h.contexts, 1);
    assert.equal(h.events.filter(event => event.includes('--title-')).length, 0, 'unchanged metrics do not dirty the link style');
    h.events.length = 0; h.rows[1].width(240); h.emit('resize'); h.advance();
    assertReadsBeforeWrites(h.events);
    assert.equal(h.rows[1].svg.classList.contains('is-too-small'), false);
    assert.equal(h.rows[1].properties.get('--title-h'), '60px');
});

test('display font recovery invalidates measurements while unrelated font changes preserve them', async () => {
    const h = harness(); await flushed();
    h.emit('engmanager:fontchange', { detail: { role: 'body' } }); await flushed(); assert.equal(h.measurements, 3);
    h.emit('engmanager:fontchange', { detail: { role: 'display' } }); await flushed();
    assert.equal(h.measurements, 6); assert.equal(h.contexts, 1);
});

test('navigation cancels pending typography work and resize frames before fitting only the new outlet', async () => {
    const fonts = deferred(); const h = harness({ fontReady: fonts.promise });
    const outgoing = h.rows;
    h.hooks.dispose(); const next = h.replace([160, 350]); const mounting = h.hooks.mount(h.document);
    fonts.resolve(); await mounting; await flushed();
    assert.equal(h.measurements, 2); assert.equal(outgoing[0].attributes.size, 0, 'late font readiness cannot mutate the old outlet');
    assert.equal(next[0].attributes.get('viewBox'), '0 0 400 100');
    h.emit('resize'); assert.equal(h.frames.size, 1); h.hooks.dispose(); assert.equal(h.frames.size, 0);
    assert.ok(h.observers[0].disconnected);
});

test('detached feed rows are pruned before any resize geometry read', async () => {
    const h = harness(); await flushed(); h.events.length = 0;
    h.rows[0].svg.isConnected = false; h.emit('resize'); h.advance();
    assert.equal(h.events.includes('read:title-0'), false);
    assert.equal(h.events.filter(event => event.startsWith('read:')).length, 2);
});
