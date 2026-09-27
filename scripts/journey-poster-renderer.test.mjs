import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../website/js/src/journey-poster-renderer.js', import.meta.url), 'utf8');
function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}
function fixture(edit = () => {}) {
    const positions = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const binary = new Uint8Array(80);
    binary.set(new Uint8Array(positions.buffer), 0);
    binary.set(new Uint8Array(normals.buffer), 36);
    binary.set(new Uint8Array(new Uint16Array([0, 1, 2]).buffer), 72);
    const json = {
        asset: { version: '2.0' }, buffers: [{ byteLength: binary.length }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 36 },
            { buffer: 0, byteOffset: 72, byteLength: 6 }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
            { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
            { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
        nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    };
    edit(json, binary);
    const encoded = new TextEncoder().encode(JSON.stringify(json));
    const padded = Math.ceil(encoded.length / 4) * 4;
    const result = new ArrayBuffer(12 + 8 + padded + 8 + binary.length);
    const view = new DataView(result);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, result.byteLength, true);
    view.setUint32(12, padded, true);
    view.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(result, 20, padded).fill(32);
    new Uint8Array(result, 20, encoded.length).set(encoded);
    view.setUint32(20 + padded, binary.length, true);
    view.setUint32(24 + padded, 0x004e4942, true);
    new Uint8Array(result, 28 + padded).set(binary);
    return result;
}
function harness({ data = fixture(), deviceRequest, submission, reducedMotion = false } = {}) {
    const lost = deferred();
    const state = { buffers: [], textures: [], writes: [], passes: [], submissions: 0, destroyed: 0, unconfigured: 0,
        frames: new Map(), events: new Map(), gpuEvents: new Map() };
    const device = {
        lost: lost.promise,
        addEventListener(name, callback) { state.gpuEvents.set(name, callback); },
        removeEventListener(name) { state.gpuEvents.delete(name); },
        destroy() { state.destroyed++; },
        pushErrorScope() {}, async popErrorScope() { return null; },
        createShaderModule() { return {}; },
        async createRenderPipelineAsync() { return { getBindGroupLayout() { return {}; } }; },
        createBuffer({ size, usage }) {
            const data = new ArrayBuffer(size);
            const buffer = { usage, data, destroyed: 0, getMappedRange: () => data, unmap() {}, destroy() { this.destroyed++; } };
            state.buffers.push(buffer);
            return buffer;
        },
        createTexture() {
            const texture = { destroyed: 0, createView: () => ({}), destroy() { this.destroyed++; } };
            state.textures.push(texture);
            return texture;
        },
        createSampler() { return {}; }, createBindGroup() { return {}; },
        createCommandEncoder() {
            return {
                beginRenderPass() {
                    const draws = [];
                    state.passes.push(draws);
                    return { setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, setIndexBuffer() {},
                        drawIndexed(count) { draws.push(count); }, end() {} };
                }, finish() { return {}; },
            };
        },
        queue: {
            writeBuffer(_buffer, _offset, data) { state.writes.push([...data]); },
            submit() { state.submissions++; },
            onSubmittedWorkDone: () => submission ?? Promise.resolve(),
        },
    };
    const context = { configure() {}, unconfigure() { state.unconfigured++; },
        getCurrentTexture: () => ({ createView: () => ({}) }) };
    const canvas = { getContext: () => context, getBoundingClientRect: () => ({ width: 800, height: 800 }), width: 0, height: 0 };
    const motion = { matches: reducedMotion, addEventListener(name, callback) { this.change = callback; }, removeEventListener() {} };
    const window = { devicePixelRatio: 3, matchMedia: () => motion };
    const document = { hidden: false, addEventListener(name, callback) { state.events.set(name, callback); },
        removeEventListener(name) { state.events.delete(name); } };
    let frameId = 0;
    const sandbox = vm.createContext({ window, document, navigator: { gpu: {
        async requestAdapter() { return { requestDevice: deviceRequest ?? (async () => device) }; },
        getPreferredCanvasFormat: () => 'bgra8unorm',
    } }, AbortController, DOMException, TextDecoder,
    GPUBufferUsage: { UNIFORM: 1, COPY_DST: 2, VERTEX: 4, INDEX: 8 },
    GPUTextureUsage: { RENDER_ATTACHMENT: 1, TEXTURE_BINDING: 2 },
    requestAnimationFrame(callback) { const id = ++frameId; state.frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { state.frames.delete(id); },
    fetch: async () => ({ ok: true, headers: { get: () => null }, arrayBuffer: async () => data }),
    IntersectionObserver: class {
        constructor(callback) { state.intersection = callback; }
        observe() {} disconnect() { state.intersection = null; }
    }, ResizeObserver: class {
        constructor(callback) { state.resize = callback; }
        observe() {} disconnect() { state.resize = null; }
    },
    });
    vm.runInContext(source, sandbox);
    function advance(time) {
        const callbacks = [...state.frames.values()];
        state.frames.clear();
        for (const callback of callbacks) callback(time);
    }
    return { mount: (options = {}) => window.__engJourneyPoster.mount(canvas, { url: '/sculpture.glb', ...options }),
        state, device, document, motion, canvas, lost, advance };
}

test('mount waits for submitted first frame, draws a shadow and surface, and bounds GPU size', async () => {
    const submitted = deferred();
    const h = harness({ submission: submitted.promise });
    let resolved = false;
    const mounting = h.mount().then((renderer) => { resolved = true; return renderer; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.state.submissions, 1);
    assert.equal(resolved, false);
    assert.deepEqual(h.state.passes, [[3], [3]]);
    submitted.resolve();
    const renderer = await mounting;
    assert.equal(h.canvas.width, 1000);
    assert.equal(h.canvas.height, 1000);
    renderer.destroy();
    renderer.destroy();
    assert.equal(h.state.destroyed, 1);
    assert.equal(h.state.unconfigured, 1);
    assert.ok(h.state.buffers.every((buffer) => buffer.destroyed === 1));
    assert.ok(h.state.textures.every((texture) => texture.destroyed === 1));
    assert.equal(h.state.frames.size, 0);
    assert.equal(h.state.events.size, 0);
});

test('scroll turns the sculpture; hidden and offscreen posters stop drawing', async () => {
    const h = harness();
    const renderer = await h.mount();
    renderer.setProgress(0.8);
    h.advance(40);
    assert.ok(h.state.writes.at(-1)[0] > 0.5);
    h.document.hidden = true;
    h.state.events.get('visibilitychange')();
    h.advance(100);
    const hiddenCount = h.state.submissions;
    assert.equal(h.state.frames.size, 0);
    h.document.hidden = false;
    h.state.events.get('visibilitychange')();
    h.advance(10000);
    assert.equal(h.state.submissions, hiddenCount + 1);
    assert.ok(h.state.writes.at(-1)[0] < 0.55, 'hidden time does not jump the rotation');
    h.state.intersection([{ isIntersecting: false }]);
    h.advance(11000);
    assert.equal(h.state.frames.size, 0);
    h.state.intersection([{ isIntersecting: true }]);
    h.advance(12000);
    assert.equal(h.state.submissions, hiddenCount + 2);
    renderer.destroy();
});

test('reduced motion is static and responds to preference changes while mounted', async () => {
    const h = harness({ reducedMotion: true });
    const renderer = await h.mount({ reducedMotion: true });
    renderer.setProgress(1);
    h.advance(50);
    assert.equal(h.state.writes.at(-1)[0], Math.fround(-0.30));
    assert.equal(h.state.frames.size, 0);
    h.motion.matches = false;
    h.motion.change();
    h.advance(100);
    assert.ok(h.state.writes.at(-1)[0] > 0.7);
    assert.equal(h.state.frames.size, 1);
    h.motion.matches = true;
    h.motion.change();
    h.advance(150);
    assert.equal(h.state.frames.size, 0);
    renderer.destroy();
});

test('mirrored transformed geometry retains outward normals and triangle winding', async () => {
    const h = harness({ data: fixture((json) => { json.nodes[0].scale = [-2, 1, 0.5]; json.nodes[0].translation = [4, 5, 6]; }) });
    const renderer = await h.mount();
    const positions = new Float32Array(h.state.buffers.find((buffer) => buffer.usage === 4).data);
    const indices = new Uint32Array(h.state.buffers.find((buffer) => buffer.usage === 8).data);
    assert.equal(positions[0], 1);
    assert.equal(positions[1], -0.5);
    assert.equal(positions[2], 0);
    assert.equal(positions[5], 2, 'inverse-transpose corrects the nonuniform scale');
    assert.deepEqual([...indices], [0, 2, 1]);
    renderer.destroy();
});

for (const [name, edit, error] of [
    ['cyclic nodes', (json) => { json.nodes[0].children = [0]; }, /cyclic node/],
    ['out of range indices', (_json, binary) => { new DataView(binary.buffer).setUint16(74, 8, true); }, /invalid triangles/],
    ['negative accessor offset', (json) => { json.accessors[1].byteOffset = -1; }, /accessor outside buffer/],
    ['truncated accessor', (json) => { json.accessors[0].count = 4; }, /accessor outside buffer/],
    ['NaN position', (_json, binary) => { new DataView(binary.buffer).setFloat32(0, NaN, true); }, /non-finite vertex/],
    ['compressed extension', (json) => { json.extensionsRequired = ['KHR_draco_mesh_compression']; }, /extensions are unsupported/],
    ['singular transform', (json) => { json.nodes[0].scale = [0, 1, 1]; }, /singular transform/],
]) {
    test(`rejects ${name} and releases the device`, async () => {
        const h = harness({ data: fixture(edit) });
        await assert.rejects(h.mount(), error);
        assert.equal(h.state.destroyed, 1);
        assert.equal(h.state.submissions, 0);
    });
}

test('aborting a pending device acquisition destroys the late device', async () => {
    const pending = deferred();
    const requested = deferred();
    const h = harness({ deviceRequest: () => { requested.resolve(); return pending.promise; } });
    const controller = new AbortController();
    const mounting = h.mount({ signal: controller.signal });
    await requested.promise;
    controller.abort();
    pending.resolve(h.device);
    await assert.rejects(mounting, { name: 'AbortError' });
    assert.equal(h.state.destroyed, 1);
});

test('device loss reports once and stops frames so the poster can use its still', async () => {
    const h = harness();
    const errors = [];
    const renderer = await h.mount({ onError: (error) => errors.push(error.message) });
    h.lost.resolve({ message: 'adapter reset' });
    await Promise.resolve();
    assert.deepEqual(errors, ['Poster GPU lost: adapter reset']);
    assert.equal(h.state.destroyed, 1);
    assert.equal(h.state.frames.size, 0);
    renderer.setProgress(1);
    assert.equal(h.state.frames.size, 0);
});

for (const name of ['shop', 'coach', 'feed']) {
    test(`real Blender ${name} export satisfies the runtime GLB contract`, async () => {
        const file = await readFile(new URL(`../website/assets/journey/${name}.glb`, import.meta.url));
        const h = harness({ data: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) });
        const renderer = await h.mount();
        const vertices = new Float32Array(h.state.buffers.find((buffer) => buffer.usage === 4).data);
        const indices = new Uint32Array(h.state.buffers.find((buffer) => buffer.usage === 8).data);
        assert.ok(vertices.length / 9 > 1000, 'the exported sculpture has real authored geometry');
        assert.ok(vertices.length / 9 < 600000, 'the poster stays inside the geometry budget');
        assert.ok(indices.length > 3000);
        assert.equal(h.state.passes.length, 2);
        assert.equal(h.state.passes[0][0], indices.length);
        assert.equal(h.state.passes[1][0], indices.length);
        assert.ok(vertices.every(Number.isFinite));
        for (let i = 0; i < vertices.length; i += 9) {
            assert.ok(Math.abs(vertices[i]) <= 1.001 && Math.abs(vertices[i + 1]) <= 1.001 &&
                Math.abs(vertices[i + 2]) <= 1.001, 'positions are centered and normalized for viewport fitting');
        }
        renderer.destroy();
    });
}

test('an explicitly hidden fixed poster stays ready without animating in the background', async () => {
    const h = harness();
    const renderer = await h.mount();
    assert.equal(h.state.submissions, 1, 'mount completes a first frame before visibility controls animation');
    renderer.setVisible(false);
    renderer.setProgress(0.7);
    h.advance(100);
    assert.equal(h.state.submissions, 1);
    assert.equal(h.state.frames.size, 0);
    h.state.intersection([{ isIntersecting: true }]);
    h.state.resize();
    h.advance(10000);
    assert.equal(h.state.submissions, 1, 'layout and intersection events cannot wake a hidden poster');
    renderer.setVisible(true);
    h.advance(11000);
    assert.equal(h.state.submissions, 2);
    assert.ok(h.state.writes.at(-1)[0] > 0.43 && h.state.writes.at(-1)[0] < 0.44,
        'revealing uses current scroll without adding hidden idle time');
    renderer.setVisible(false);
    assert.equal(h.state.frames.size, 0);
    renderer.destroy();
});
