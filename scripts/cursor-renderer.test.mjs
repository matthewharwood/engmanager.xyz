import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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

function harness({ fetchImpl, requestDevice, Worker, timer = setTimeout, cancelTimer = clearTimeout } = {}) {
    const lost = deferred();
    const state = { buffers: [], textures: [], writes: [], draws: [], submissions: 0, destroyed: 0, unconfigured: 0, yields: 0 };
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
        document: {currentScript: {src: 'https://example.test/cursor-renderer.hash.js'}}, Worker,
        scheduler: {async yield() {state.yields++;}}, setTimeout: timer, clearTimeout: cancelTimer,
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
    assert.equal(renderer.hotspot.x, 36);
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
    assert.ok(state.yields > 20, 'the no-worker path cooperatively decodes the detailed anatomy');
});

function decodingWorker() {
    const messages = [];
    const scope = vm.createContext({TextDecoder, DOMException, clearTimeout, setTimeout,
        postMessage(data, transfers) {messages.push({data, transfers});}});
    vm.runInContext(source, scope);
    return {messages, decode(buffer, id=1) {scope.onmessage({data: {id, buffer}});return messages.at(-1);}};
}

test('the sculpture matches its closed Blender export and keeps the left index tip fixed through Grip', async () => {
    const report=JSON.parse(await readFile(new URL('../_docs/cursors/creation-hand-validation.json',import.meta.url),'utf8'));
    assert.equal(createHash('sha256').update(new Uint8Array(assets.hand)).digest('hex'),report.asset.sha256);
    assert.ok(report.source.vertices>100000&&report.export.vertices<20000,'detailed source anatomy is separate from the compact browser copy');
    for(const mesh of [report.source,report.export]) {
        assert.equal(mesh.boundary_edges,0);assert.equal(mesh.nonmanifold_edges,0);
        assert.equal(mesh.island_vertex_counts.length,1);assert.ok(mesh.signed_volume>0);
    }
    const {data}=decodingWorker().decode(assets.hand);
    assert.equal(data.error,undefined);
    const p=data.model[0],low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
    let tip=false,volume=0;
    for(let i=0;i<p.vertices.length;i+=16) {
        for(let a=0;a<3;a++){low[a]=Math.min(low[a],p.vertices[i+a]);high[a]=Math.max(high[a],p.vertices[i+a]);}
        if(Math.hypot(...p.vertices.slice(i,i+3))<1e-6){tip=true;assert.equal(Math.hypot(...p.vertices.slice(i+6,i+9)),0);}
    }
    for(let i=0;i<p.indices.length;i+=3) {
        const [a,b,c]=[0,1,2].map(k=>p.vertices.slice(p.indices[i+k]*16,p.indices[i+k]*16+3));
        volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
    }
    assert.ok(tip);assert.ok(volume>.8&&volume<.95,'actual indexed triangles wind outwards');
    assert.ok(low[0]>=-1e-6&&high[0]>2.6&&high[0]<2.65,'index points left from a cropped wrist');
    assert.ok(high[1]<.62&&low[1]>-1.4&&low[1]<-1.2,'three relaxed fingers hang below the horizontal index');
    const aspect=high[0]/(high[1]-low[1]);
    assert.ok(aspect>1.35&&aspect<1.5,'the sideways proportion matches the cropped painting');
    assert.ok(p.color.slice(0,3).every(n=>n>.75),'high-key white marble replaces the architectural hand materials');
    assert.ok(p.indices.length/3>20000&&p.indices.length/3<30000);
});

test('the worker and cooperative paths validate the same real marble GLB including normalized cavity colors', async () => {
    const worker = decodingWorker(), instances = [];
    class TestWorker {
        constructor(url) {this.url=url;instances.push(this);}
        postMessage(data) {queueMicrotask(()=>this.onmessage?.({data: worker.decode(data.buffer, data.id).data}));}
        terminate() {this.terminated=true;}
    }
    const timers = new Map(); let timerId=0;
    const h=harness({Worker: TestWorker, timer(fn) {const id=++timerId;timers.set(id,fn);return id;}, cancelTimer(id) {timers.delete(id);}});
    const renderer=await h.create();
    assert.equal(instances.length,1,'both model jobs share one bounded same-origin worker');
    assert.equal(instances[0].url,'https://example.test/cursor-renderer.hash.js');
    assert.equal(renderer.render({mode:'open'}),true);
    const hand=worker.messages.find(message=>message.data.model?.some(p=>p.vertices.length>10000));
    assert.ok(hand);
    for(const primitive of hand.data.model) {
        assert.equal(primitive.vertices.length%16,0);
        assert.ok(primitive.vertices.some((v,i)=>i%16===12&&v<.99&&v>=.65),'real carved-finger cavity shading survives decoding');
        assert.equal(hand.transfers.includes(primitive.vertices.buffer),true);
    }
    assert.equal(h.state.yields,0);
    renderer.dispose();
    for(const callback of timers.values())callback();
    assert.equal(instances[0].terminated,true,'idle decoder shuts down');
    const bad=assets.hand.slice(0);new DataView(bad).setUint32(0,0,true);
    assert.match(worker.decode(bad,99).data.error,/invalid signature/);
    await assert.rejects(harness({fetchImpl:async()=>({ok:true,headers:{get:()=>null},arrayBuffer:async()=>bad})}).create(),/invalid signature/);
});

test('cancelling or timing out transferred decoder jobs terminates the worker and releases the GPU', async () => {
    for(const action of ['abort','timeout']) {
        const workers=[],timers=new Map();let next=0;
        class StalledWorker {
            constructor(){workers.push(this);}
            postMessage(){}
            terminate(){this.terminated=true;}
        }
        const h=harness({Worker:StalledWorker,timer(fn){const id=++next;timers.set(id,fn);return id;},cancelTimer(id){timers.delete(id);}});
        const abort=new AbortController(),pending=h.create({signal:abort.signal});
        for(let i=0;i<20;i++)await Promise.resolve();
        assert.equal(workers.length,1);
        if(action==='abort')abort.abort();else [...timers.values()][0]();
        await assert.rejects(pending,action==='abort'?{name:'AbortError'}:/timed out/);
        assert.equal(workers[0].terminated,true);assert.equal(h.state.destroyed,1);assert.equal(h.state.unconfigured,1);
        assert.equal(timers.size,0);
    }
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
