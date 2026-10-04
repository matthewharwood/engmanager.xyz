import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../website/js/src/article-heroes.js', import.meta.url), 'utf8');
const identitySlug = 'your-gmail-avatar-is-part-of-your-job-search';
function events() {
    const handlers = new Map();
    return {
        addEventListener(name, fn, options = {}) {
            const set = handlers.get(name) || new Set(); set.add(fn); handlers.set(name, set);
            options.signal?.addEventListener('abort', () => set.delete(fn), { once: true });
        },
        emit(name, event = {}) { for (const fn of [...handlers.get(name) || []]) fn(event); },
    };
}
function harness({ slug = identitySlug, reduced = false, extension = true, complete = false, phone = false } = {}) {
    let now = 0, id = 0;
    const frames = new Map(), timers = new Map(), hooks = {}, intersections = [], resizes = [];
    const state = { draws: 0, shaderSources: [], statusReads: [], uniformWrites: [], geometryReads: 0,
        buffersDeleted: 0, programsDeleted: 0, linked: 0, complete, contextLost: false };
    const gl = {
        VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, LINK_STATUS: 3, ARRAY_BUFFER: 4, STATIC_DRAW: 5,
        FLOAT: 6, TRIANGLE_STRIP: 7,
        createShader: kind => ({ kind }), shaderSource(shader, code) { state.shaderSources.push({ kind: shader.kind, code }); },
        compileShader() {}, getShaderParameter() { throw new Error('Blocking COMPILE_STATUS queried'); },
        getError() { throw new Error('Blocking getError queried'); }, deleteShader() {},
        getExtension: () => extension ? { COMPLETION_STATUS_KHR: 8 } : null,
        createProgram: () => ({}), attachShader() {}, linkProgram() { state.linked++; },
        getProgramParameter(_program, parameter) {
            state.statusReads.push(parameter);
            if (parameter === 8) return state.complete;
            assert.equal(state.complete, true, 'LINK_STATUS must wait for asynchronous completion');
            return true;
        },
        createBuffer: () => ({}), bindBuffer() {}, bufferData() {}, useProgram() {},
        getAttribLocation: () => 0, enableVertexAttribArray() {}, vertexAttribPointer() {},
        getUniformLocation: (_program, name) => name, viewport() {},
        uniform2f(name, ...value) { state.uniformWrites.push({ name, value }); },
        uniform3f(name, ...value) { state.uniformWrites.push({ name, value }); },
        uniform1f(name, value) { state.uniformWrites.push({ name, value }); },
        drawArrays() { state.draws++; }, isContextLost: () => state.contextLost,
        deleteBuffer() { state.buffersDeleted++; }, deleteProgram() { state.programsDeleted++; },
    };
    const canvas = { ...events(), width: 1, height: 1, getContext: () => gl };
    const figure = { ...events(), dataset: { articleHero: slug }, isConnected: true, clientWidth: 600, clientHeight: 360,
        querySelector: () => canvas,
        getBoundingClientRect() { state.geometryReads++; return { left: 0, top: 0, width: 600, height: 360 }; },
    };
    const classes = new Set();
    const motion = { ...events(), matches: reduced };
    const window = { ...events(), __engNav: { busy: false, onBeforeSwap(fn) { hooks.dispose = fn; }, onSwap(fn) { hooks.mount = fn; } } };
    const document = { ...events(), hidden: false, documentElement: {}, body: { classList: { contains: name => classes.has(name) } },
        querySelectorAll: () => [figure], createElement: () => ({ getContext: () => ({ fillRect() {},
            getImageData: () => ({ data: [220, 220, 220, 255] }) }) }),
    };
    class IntersectionObserver { constructor(fn) { this.fn = fn; intersections.push(this); } observe() {} disconnect() { this.disconnected = true; } }
    class ResizeObserver { constructor(fn) { this.fn = fn; resizes.push(this); } observe() {} disconnect() { this.disconnected = true; } }
    vm.runInNewContext(source, { window, document, AbortController, Float32Array, IntersectionObserver, ResizeObserver,
        matchMedia: query => query.includes('reduced') ? motion : { matches: phone }, innerWidth: phone ? 390 : 1280,
        devicePixelRatio: 3, getComputedStyle: () => ({ getPropertyValue: () => '' }),
        performance: { now: () => now }, console,
        requestAnimationFrame(fn) { frames.set(++id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
        setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
    });
    return { state, gl, hooks, canvas, figure, window, document, motion, frames, timers, intersections, resizes,
        visible(value = true) { intersections.at(-1).fn([{ isIntersecting: value }]); },
        resize(width, height) { resizes.at(-1).fn([{ contentRect: { width, height } }]); },
        step(time = now + 1000 / 60) { now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); },
        poll() { now += 32; const pending = [...timers.values()]; timers.clear(); pending.forEach(({ fn }) => fn()); },
        expose(value) { value ? classes.add('journey-revealing') : classes.delete('journey-revealing'); window.emit('eng:journeyexposure', { detail: { active: value } }); },
        hide(value) { document.hidden = value; document.emit('visibilitychange'); },
    };
}

test('visible heroes wait for nonblocking shader completion and specialize the selected mechanism', () => {
    const h = harness(); h.visible();
    assert.equal(h.state.linked, 1);
    assert.equal(h.state.draws, 0);
    assert.equal(h.frames.size, 0);
    assert.deepEqual(h.state.statusReads, [8]);
    assert.match(h.state.shaderSources.find(shader => shader.kind === 2).code, /const int u_scene = 11;/);
    assert.doesNotMatch(h.state.shaderSources.find(shader => shader.kind === 2).code, /uniform int u_scene;/);
    h.poll(); assert.equal(h.state.draws, 0); assert.ok(h.state.statusReads.every(status => status === 8));
    h.state.complete = true; h.poll(); h.step();
    assert.equal(h.state.draws, 1); assert.equal(h.figure.dataset.renderer, 'webgl');
    assert.deepEqual(h.state.statusReads.slice(-2), [8, 3]);
    h.hooks.dispose();
});

test('identity correlation preserves perfect alignment and a known one-sample displacement', () => {
    const h = harness({ complete: true }); h.visible(); h.step(0);
    const strength = () => h.state.uniformWrites.filter(entry => entry.name === 'u_identity_strength').at(-1).value;
    assert.equal(strength(), 1, 'identical signals correlate exactly');
    h.step(Math.asin(1 / 1.2) / 0.00032);
    assert.ok(Math.abs(strength() - 0.8457444688222526) < 1e-12, 'CPU correlation matches the independently calculated shifted signal');
    h.step(5000);
    assert.ok(strength() > 0 && strength() <= 1);
    h.hooks.dispose();
});

test('pending compilation pauses behind the curtain and cancellation frees the linked program', () => {
    const h = harness(); h.visible(); assert.equal(h.timers.size, 1);
    h.expose(true); assert.equal(h.timers.size, 0); assert.equal(h.frames.size, 0);
    h.state.complete = true; h.expose(false); h.step(); assert.equal(h.state.draws, 1);
    h.hooks.dispose();
    assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
    assert.equal(h.state.buffersDeleted, 1); assert.equal(h.state.programsDeleted, 1);
    assert.ok(h.intersections[0].disconnected && h.resizes[0].disconnected);
    h.window.emit('eng:journeysettled'); h.step(); assert.equal(h.state.draws, 1, 'disposed listeners cannot resurrect the old hero');
    const compiling = harness(); compiling.visible(); compiling.hooks.dispose(); compiling.state.complete = true; compiling.poll();
    assert.equal(compiling.state.draws, 0); assert.equal(compiling.state.programsDeleted, 1);
});

test('visible heroes stop behind exposure, while hidden, or busy and resume without hot geometry reads', () => {
    const h = harness({ complete: true }); h.visible(); h.step();
    const reads = h.state.geometryReads;
    for (let i = 0; i < 8; i++) h.step();
    assert.equal(h.state.geometryReads, reads);
    h.expose(true); const count = h.state.draws; h.step(); assert.equal(h.state.draws, count); assert.equal(h.frames.size, 0);
    h.expose(false); h.step(); assert.equal(h.state.draws, count + 1);
    h.hide(true); h.step(); assert.equal(h.frames.size, 0);
    h.hide(false); h.step();
    h.window.__engNav.busy = true; h.step(); assert.equal(h.frames.size, 0);
    h.window.__engNav.busy = false; h.window.emit('eng:journeysettled'); h.step(); assert.equal(h.frames.size, 1);
    h.visible(false); assert.equal(h.frames.size, 0); h.hooks.dispose();
});

test('reduced motion draws once, resize uses observed dimensions, and restored contexts remount cleanly', () => {
    const h = harness({ complete: true, reduced: true, phone: true }); h.visible();
    assert.equal(h.state.draws, 1); assert.equal(h.frames.size, 0);
    h.resize(900, 500); assert.equal(h.canvas.width, 640); assert.equal(h.canvas.height, 356);
    assert.equal(h.state.uniformWrites.filter(entry => entry.name === 'u_time').at(-1).value, 0);
    h.motion.matches = false; h.motion.emit('change'); h.step(); assert.equal(h.frames.size, 1);
    let prevented = false; h.state.contextLost = true; h.canvas.emit('webglcontextlost', { preventDefault() { prevented = true; } });
    assert.equal(prevented, true); assert.equal(h.frames.size, 0); assert.equal(h.figure.dataset.renderer, undefined);
    h.window.emit('pageshow'); h.hide(true); h.hide(false); h.window.emit('eng:journeysettled'); h.expose(false);
    h.step(); assert.equal(h.frames.size, 0, 'late visibility or journey events cannot restart a lost context');
    h.state.contextLost = false; h.canvas.emit('webglcontextrestored');
    assert.equal(h.state.programsDeleted, 1); assert.equal(h.intersections.length, 2);
    h.visible(); h.step(); assert.equal(h.figure.dataset.renderer, 'webgl'); assert.equal(h.state.linked, 2);
    h.hooks.dispose();
});

test('unavailable asynchronous compilation retains the SVG instead of synchronizing the driver', () => {
    const h = harness({ extension: false }); h.visible();
    assert.equal(h.state.linked, 0); assert.equal(h.state.draws, 0); assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
    assert.equal(h.figure.dataset.renderer, undefined); h.hooks.dispose();
});
