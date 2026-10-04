import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../website/js/src/article-diagrams.js', import.meta.url), 'utf8');
// Isolate palette conversion; use a source-over canvas fixture so this catches
// discarded alpha without loading Mermaid or depending on a network CDN.
function palette(tokens, canvasAvailable = true) {
    let pixel = [0, 0, 0, 0];
    const context = {
        fillStyle: '#000000',
        clearRect() { pixel = [0, 0, 0, 0]; },
        fillRect() {
            const rgba = this.fillStyle.startsWith('#')
                ? [1, 3, 5].map(i => parseInt(this.fillStyle.slice(i, i + 2), 16)).concat(1)
                : this.fillStyle.match(/[\d.]+/g).map(Number);
            const alpha = rgba[3] ?? 1;
            const outAlpha = alpha + pixel[3] * (1 - alpha);
            pixel = rgba.slice(0, 3).map((v, i) => (v * alpha + pixel[i] * pixel[3] * (1 - alpha)) / outAlpha).concat(outAlpha);
        },
        getImageData() { return { data: [...pixel.slice(0, 3).map(Math.round), Math.round(pixel[3] * 255)] }; },
    };
    const sandbox = {
        document: { documentElement: {}, createElement: () => ({ getContext: () => canvasAvailable ? context : null }) },
        getComputedStyle: () => ({ getPropertyValue: name => tokens[name] || '' }),
        window: {},
    };
    vm.runInNewContext(source.replace('    mount();', '    globalThis.palette = themeVariables();'), sandbox);
    return sandbox.palette;
}

for (const [name, base, text, expectedSurface] of [
    ['light', '#ffffff', '#000000', '#d1d1d1'],
    ['dark', '#000000', '#ffffff', '#2e2e2e'],
]) {
    test(`${name} diagram keeps translucent node backgrounds distinct from their text`, () => {
        const textRgb = name === 'light' ? '0, 0, 0' : '255, 255, 255';
        const colors = palette({
            '--ctp-base': base, '--ctp-text': text,
            '--ctp-surface0': `rgba(${textRgb}, 0.18)`,
            '--ctp-subtext0': `rgba(${textRgb}, 0.70)`,
        });
        assert.equal(colors.primaryColor, expectedSurface);
        assert.equal(colors.mainBkg, expectedSurface);
        assert.equal(colors.nodeTextColor, text);
        assert.notEqual(colors.lineColor, text);
        assert.equal(colors.edgeLabelBackground, base);
        assert.equal(colors.noteTextColor, text);
        assert.equal(colors.actorTextColor, text);
    });
}

test('missing canvas keeps a readable fallback palette', () => {
    const colors = palette({}, false);
    assert.equal(colors.primaryColor, '#313244');
    assert.equal(colors.nodeTextColor, '#cdd6f4');
    assert.equal(colors.edgeLabelBackground, '#1e1e2e');
});

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function lifecycle({ noObserver = false, moduleGate, fontsGate, renderGate } = {}) {
    const timers = new Map(), idles = new Map(), media = new Map(), swaps = [], departures = [];
    const calls = [], configurations = [], observers = [];
    let now = 0, sequence = 0, imports = 0;
    class Target {
        listeners = new Map();
        addEventListener(name, callback, options = {}) {
            const list = this.listeners.get(name) || [];
            list.push({ callback, signal: options.signal }); this.listeners.set(name, list);
        }
        dispatch(name, event = {}) {
            for (const { callback, signal } of this.listeners.get(name) || []) if (!signal?.aborted) callback(event);
        }
    }
    class Element extends Target {
        constructor(tag = 'div') {
            super(); this.tagName = tag; this.children = []; this.parentElement = null; this.style = { setProperty() {}, removeProperty() {} };
            this.dataset = {}; this.textContent = ''; this.isConnected = true; this.width = 300; this.top = 1500;
            this.classList = { values: new Set(), contains: name => this.classList.values.has(name) };
        }
        setAttribute() {}
        getAttribute(name) { return name === 'data-theme' ? this.theme : null; }
        append(node) { node.parentElement = this; this.children.push(node); }
        after(node) { this.parentElement.append(node); }
        remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
        closest() { return surface; }
        getBoundingClientRect() { this.reads = (this.reads || 0) + 1; return { width: this.width, top: this.top, bottom: this.top + 120, left: 0, right: this.width }; }
        set innerHTML(value) {
            this.html = value;
            if (value.startsWith('<svg')) this.svg = new Element('svg');
            if (value.includes('diagram-viewer-bar')) this.controls = Object.fromEntries(['.diagram-viewport', '.diagram-canvas', '.diagram-zoom', '.diagram-close', 'output', '[data-zoom="out"]', '[data-zoom="in"]'].map(key => [key, new Element()]));
        }
        get innerHTML() { return this.html || ''; }
        querySelector(selector) {
            if (selector === 'svg') return this.svg || null;
            if (selector === '.diagram-expand') return this.children.find(node => node.className === 'diagram-expand') || null;
            return this.controls?.[selector] || null;
        }
        replaceChildren(...nodes) { this.children = nodes; }
        cloneNode() { return new Element(this.tagName); }
        scrollTo() {}
        focus() {}
        showModal() { this.open = true; }
        close() { this.open = false; this.dispatch('close'); }
        get clientWidth() { return this.width; }
    }
    const surface = new Element(), root = new Element('html'), body = new Element('body'); root.theme = 'light';
    const nodes = [0, 1, 2].map(index => {
        const node = new Element(); node.className = 'mermaid'; node.textContent = `flowchart LR\n A${index}["Original ${index}"] --> B${index}["Done"]`;
        const parent = new Element(); parent.append(node); surface.append(parent); return node;
    });
    const document = new Target(); Object.assign(document, {
        documentElement: root, body, hidden: false, fonts: { ready: fontsGate?.promise || Promise.resolve() },
        querySelectorAll: () => nodes,
        createElement: tag => {
            const element = new Element(tag);
            if (tag === 'canvas') element.getContext = () => null;
            return element;
        },
    });
    const window = new Target(); window.__engNav = { busy: false, onBeforeSwap: callback => departures.push(callback), onSwap: callback => swaps.push(callback) };
    const mermaid = {
        initialize(config) { configurations.push(config); },
        async render(id, original, scratch) {
            calls.push({ id, original, scratch });
            if (renderGate) await renderGate.promise;
            return { svg: '<svg viewBox="0 0 300 120"></svg>' };
        },
    };
    const context = {
        window, document, AbortController, Set, WeakMap, Map, Promise, performance: { now: () => now }, innerHeight: 844, innerWidth: 390,
        getComputedStyle: () => ({ getPropertyValue: name => name === '--font-mono' ? 'Fixture Mono' : '' }),
        matchMedia: query => { if (!media.has(query)) media.set(query, Object.assign(new Target(), { matches: false })); return media.get(query); },
        setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
        clearTimeout: id => timers.delete(id),
        requestIdleCallback: callback => { const id = ++sequence; idles.set(id, callback); return id; },
        cancelIdleCallback: id => idles.delete(id),
        __loadMermaid: async () => { imports++; if (moduleGate) await moduleGate.promise; return { default: mermaid }; },
    };
    window.requestIdleCallback = context.requestIdleCallback;
    if (!noObserver) context.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe() {}
        disconnect() { this.disconnected = true; }
    };
    vm.runInNewContext(source.replace('import(MERMAID_URL)', 'globalThis.__loadMermaid()'), context);
    const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
    return {
        nodes, window, document, body, root, calls, configurations, timers, idles, media, observers,
        get imports() { return imports; }, flush,
        async advance(ms) {
            now += ms;
            for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
            await flush();
        },
        async idle(time = 20) { const callbacks = [...idles.values()]; idles.clear(); callbacks.forEach(callback => callback({ timeRemaining: () => time })); await flush(); },
        visible(node, value = true) { node.top = value ? 100 : 1500; observers.at(-1)?.callback([{ target: node, isIntersecting: value }]); },
        depart() { departures.forEach(callback => callback()); },
        resume() { swaps.forEach(callback => callback()); },
        viewer() { return body.children.find(node => node.className === 'diagram-viewer'); },
    };
}

test('offscreen diagrams neither import Mermaid nor render until a figure becomes visible and quiet', async () => {
    const h = lifecycle(); await h.advance(500); await h.idle();
    assert.equal(h.imports, 0); assert.equal(h.calls.length, 0);
    await h.advance(4000);
    assert(h.nodes.every(node => node.style.visibility === 'visible'), 'the original readable-source fallback remains bounded');
    h.visible(h.nodes[0]); await h.idle();
    assert.equal(h.imports, 1); assert.equal(h.calls.length, 1); assert(h.nodes[0].querySelector('svg'));
    assert(!h.nodes[1].querySelector('svg')); assert(!h.nodes[2].querySelector('svg'));
});

test('touch, recent scrolling, journey preparation, and a revealed curtain hold visible diagram work', async () => {
    const h = lifecycle(); h.visible(h.nodes[0]); h.window.dispatch('touchstart', { touches: [{}] });
    await h.advance(500); await h.idle(); assert.equal(h.imports, 0);
    h.window.dispatch('touchend', { touches: [] }); await h.advance(179); await h.idle(); assert.equal(h.imports, 0);
    await h.advance(200); h.window.__engNav.busy = true; await h.idle(); assert.equal(h.imports, 0);
    h.window.__engNav.busy = false; h.body.classList.values.add('journey-revealing'); h.window.dispatch('eng:journeyexposure', { detail: { active: true } });
    await h.advance(500); await h.idle(); assert.equal(h.imports, 0);
    h.body.classList.values.delete('journey-revealing'); h.window.dispatch('eng:journeyexposure', { detail: { active: false } });
    h.window.dispatch('scroll'); await h.idle(); assert.equal(h.imports, 0);
    await h.advance(200); await h.idle(); assert.equal(h.calls.length, 1);
});

test('an import finishing after a new gesture cannot start graph layout', async () => {
    const gate = deferred(), h = lifecycle({ moduleGate: gate }); h.visible(h.nodes[0]);
    await h.advance(200); await h.idle(); assert.equal(h.imports, 1);
    h.window.dispatch('wheel'); gate.resolve(); await h.flush(); assert.equal(h.calls.length, 0);
    await h.idle(); assert.equal(h.calls.length, 0);
    await h.advance(200); await h.idle(); assert.equal(h.calls.length, 1);
});

test('a finished SVG waits out new input without repeating Mermaid layout', async () => {
    const gate = deferred(), h = lifecycle({ renderGate: gate }); h.visible(h.nodes[0]);
    await h.advance(200); await h.idle(); assert.equal(h.calls.length, 1);
    h.window.dispatch('scroll'); gate.resolve(); await h.flush(); assert(!h.nodes[0].querySelector('svg'));
    await h.advance(200); await h.idle();
    assert(h.nodes[0].querySelector('svg')); assert.equal(h.calls.length, 1);
});

test('idle turns render one actual figure at a time and preserve every original graph', async () => {
    const h = lifecycle(); h.nodes.forEach(node => h.visible(node)); await h.advance(200);
    for (let i = 0; i < 3; i++) { await h.idle(); assert.equal(h.calls.length, i + 1); }
    assert(h.nodes.every(node => node.querySelector('svg')));
    assert(h.calls.every((call, i) => call.original.includes(`Original ${i}`) && call.scratch.isConnected === false));
    assert(h.configurations.every(config => config.htmlLabels === false && config.flowchart.htmlLabels === false), 'plain labels use native SVG wrapping instead of fractional HTML clipping');
    assert(h.calls.every(call => call.scratch.style.fontFamily === 'Fixture Mono' && call.scratch.style.fontSize === '14px'), 'measurement inherits the configured mono typography');
    assert(h.nodes.every(node => node.parentElement.querySelector('.diagram-expand')));
});

test('retained SVGs reuse their layout, rebind expansion, and rerender original sources after theme or compact changes', async () => {
    const h = lifecycle(); h.visible(h.nodes[0]); await h.advance(200); await h.idle();
    const original = h.calls[0].original; h.depart(); assert(!h.nodes[0].parentElement.querySelector('.diagram-expand'));
    h.resume(); h.visible(h.nodes[0]); await h.advance(200); await h.idle(); assert.equal(h.calls.length, 1);
    const expand = h.nodes[0].parentElement.querySelector('.diagram-expand'); expand.dispatch('click');
    assert(h.viewer().open); h.viewer().close();
    h.root.theme = 'dark'; h.window.dispatch('engmanager:themechange'); await h.idle();
    assert.equal(h.calls.length, 2); assert.equal(h.calls[1].original, original);
    const compact = h.media.get('(max-width: 42rem)'); compact.matches = true; compact.dispatch('change'); await h.idle();
    assert.equal(h.calls.length, 3); assert(h.calls[2].original.startsWith('flowchart TD'));
    assert(!h.nodes[1].querySelector('svg'), 'theme/layout changes do not eagerly render offscreen figures');
});

test('disposal cancels scheduled work and releases a stalled font wait for the next mounted article', async () => {
    const gate = deferred(), h = lifecycle({ fontsGate: gate }); h.visible(h.nodes[0]); await h.advance(200); await h.idle();
    assert.equal(h.imports, 1); assert.equal(h.calls.length, 0);
    h.depart(); assert(h.observers[0].disconnected); assert.equal(h.idles.size, 0); assert.equal(h.timers.size, 0);
    h.document.fonts.ready = Promise.resolve(); h.resume(); h.visible(h.nodes[0]); await h.advance(200); await h.idle();
    assert.equal(h.calls.length, 1, 'a disposed font wait cannot retain Mermaid’s global render lane');
    gate.resolve(); await h.flush(); assert.equal(h.calls.length, 1);
});

test('disposal before an import resolves prevents stale SVG and viewer insertion', async () => {
    const gate = deferred(), h = lifecycle({ moduleGate: gate }); h.visible(h.nodes[0]); await h.advance(200); await h.idle();
    h.depart(); gate.resolve(); await h.flush();
    assert.equal(h.calls.length, 0); assert(!h.nodes[0].querySelector('svg')); assert(!h.viewer());
    assert.equal(h.timers.size, 0); assert.equal(h.idles.size, 0);
});

test('the unavailable-observer path checks bounds only during idle and keeps offscreen figures pending', async () => {
    const h = lifecycle({ noObserver: true }); await h.advance(200); await h.idle(); assert.equal(h.imports, 0);
    const reads = h.nodes.reduce((sum, node) => sum + node.reads, 0);
    h.visible(h.nodes[1]); h.window.dispatch('scroll');
    assert.equal(h.nodes.reduce((sum, node) => sum + node.reads, 0), reads, 'a scroll event cannot force layout');
    await h.advance(200); await h.idle(); assert.equal(h.calls.length, 1); assert(h.nodes[1].querySelector('svg'));
});
