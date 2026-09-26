import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../website/js/src/cursor-renderer.js', import.meta.url), 'utf8');
const assets = Object.fromEntries(await Promise.all(['pointer', 'hand'].map(async (name) => {
    const file = await readFile(new URL(`../website/assets/cursors/v1/${name}.glb`, import.meta.url));
    return [name, file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)];
})));

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}

function harness({ fetchImpl, requestDevice } = {}) {
    const lost = deferred();
    const state = { buffers: [], textures: [], writes: [], draws: [], submissions: 0, destroyed: 0, unconfigured: 0 };
    const listeners = {};
    const device = {
        lost: lost.promise,
        addEventListener(name, listener) { listeners[name] = listener; },
        destroy() { state.destroyed++; },
        pushErrorScope() {},
        async popErrorScope() { return null; },
        createShaderModule() { return {}; },
        async createRenderPipelineAsync() { return { getBindGroupLayout() { return {}; } }; },
        createBuffer({ size }) {
            const data = new ArrayBuffer(size);
            const buffer = { destroyed: 0, getMappedRange: () => data, unmap() {}, destroy() { this.destroyed++; } };
            state.buffers.push(buffer);
            return buffer;
        },
        createTexture() {
            const texture = { destroyed: 0, createView: () => ({}), destroy() { this.destroyed++; } };
            state.textures.push(texture);
            return texture;
        },
        createBindGroup() { return {}; },
        createCommandEncoder() {
            return {
                beginRenderPass() {
                    return { setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, setIndexBuffer() {},
                        drawIndexed(count) { state.draws.push(count); }, end() {} };
                },
                finish() { return {}; },
            };
        },
        queue: {
            writeBuffer(_buffer, _offset, data) { state.writes.push([...data]); },
            submit() { state.submissions++; },
        },
    };
    const context = {
        configure() {}, unconfigure() { state.unconfigured++; },
        getCurrentTexture: () => ({ createView: () => ({}) }),
    };
    const canvas = { getContext: () => context, width: 0, height: 0 };
    const window = { devicePixelRatio: 3 };
    const sandbox = vm.createContext({
        window, navigator: { gpu: {
            async requestAdapter() { return { requestDevice: requestDevice ?? (async () => device) }; },
            getPreferredCanvasFormat: () => 'bgra8unorm',
        } },
        AbortController, DOMException, TextDecoder,
        GPUBufferUsage: { UNIFORM: 1, COPY_DST: 2, VERTEX: 4, INDEX: 8 },
        GPUTextureUsage: { RENDER_ATTACHMENT: 1 },
        fetch: fetchImpl ?? (async (url) => ({ ok: true, headers: { get: () => null }, arrayBuffer: async () => assets[url] })),
    });
    vm.runInContext(source, sandbox);
    return { create: (options = {}) => window.__engCursorRenderer.create(canvas, {
        pointerUrl: 'pointer', handUrl: 'hand', ...options,
    }), state, canvas, device, lost, listeners };
}

// Real Blender exports exercise the strict GLB contract. The device is stubbed
// to keep lifecycle coverage portable; shader/render appearance also receives
// browser GPU smoke testing when the assets or shader change.
test('real exported models render arrow, open hand, and morphed grip; dispose releases GPU resources', async () => {
    const { create, state, canvas } = harness();
    const renderer = await create();
    assert.equal(renderer.size, 192);
    assert.equal(renderer.hotspot.x, 48);
    assert.equal(renderer.hotspot.y, 54);
    assert.equal(renderer.render({ mode: 'arrow' }), true);
    const arrowTriangles = state.draws.reduce((sum, count) => sum + count / 3, 0);
    assert.ok(arrowTriangles > 0);
    assert.equal(renderer.render({ mode: 'open', tiltX: 0.12, tiltY: -0.12 }), true);
    assert.equal(renderer.render({ mode: 'grab', grip: 1, press: 0.5 }), true);
    assert.equal(state.submissions, 3);
    assert.equal(state.writes.at(-1)[3], 1);
    assert.equal(state.writes.at(-1)[2], 0.5);
    assert.equal(canvas.width, 384, 'pixel ratio is bounded to avoid expensive oversized canvases');
    assert.equal(canvas.height, 384);
    renderer.dispose();
    renderer.dispose();
    assert.equal(renderer.render(), false);
    assert.equal(state.destroyed, 1);
    assert.equal(state.unconfigured, 1);
    assert.ok(state.buffers.length > 0);
    assert.ok(state.buffers.every((buffer) => buffer.destroyed === 1));
    assert.ok(state.textures.every((texture) => texture.destroyed === 1));
});

test('malformed GLB is rejected and initialized context/device are released', async () => {
    const invalid = assets.pointer.slice(0);
    new DataView(invalid).setUint32(0, 0, true);
    const { create, state } = harness({ fetchImpl: async () => ({
        ok: true, headers: { get: () => null }, arrayBuffer: async () => invalid,
    }) });
    await assert.rejects(create(), /invalid signature/);
    assert.equal(state.destroyed, 1);
    assert.equal(state.unconfigured, 1);
    assert.equal(state.submissions, 0);
});

test('one failed asset aborts the outstanding companion request', async () => {
    let companionSignal;
    const { create, state } = harness({ fetchImpl: async (url, { signal }) => {
        if (url === 'pointer') return { ok: false, status: 404 };
        companionSignal = signal;
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    } });
    await assert.rejects(create(), /404/);
    assert.equal(companionSignal.aborted, true);
    assert.equal(state.destroyed, 1);
});

test('aborting while device acquisition is pending destroys the late device', async () => {
    const pending = deferred();
    const requested = deferred();
    const { create, state, device } = harness({ requestDevice: () => { requested.resolve(); return pending.promise; } });
    const controller = new AbortController();
    const creating = create({ signal: controller.signal });
    await requested.promise;
    controller.abort();
    pending.resolve(device);
    await assert.rejects(creating, { name: 'AbortError' });
    assert.equal(state.destroyed, 1);
    assert.equal(state.unconfigured, 0);
});

test('device loss reports one failure and prevents subsequent GPU work', async () => {
    const { create, state, lost, listeners } = harness();
    const failures = [];
    const renderer = await create({ onFailure: (error) => failures.push(error.message) });
    renderer.render();
    lost.resolve({ reason: 'unknown', message: 'adapter reset' });
    await Promise.resolve();
    assert.equal(renderer.render(), false);
    assert.equal(state.submissions, 1);
    assert.equal(state.destroyed, 1);
    assert.match(failures[0], /adapter reset/);
    listeners.uncapturederror({ preventDefault() {}, error: new Error('secondary failure') });
    assert.equal(failures.length, 1);
});
