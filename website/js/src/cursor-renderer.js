// A deliberately small WebGPU renderer for our two Blender-authored GLBs.
// The exporter bakes transforms and supplies indexed positions, normals,
// materials, marble cavity colors, and one Grip morph. No runtime 3D dependency.
(function () {
    const SIZE = 192;
    // God's hand reaches left from the wrist; the actual index tip is the anchor.
    const HOTSPOT = Object.freeze({ x: 36, y: 54 });
    const PIXELS_PER_UNIT = 52;
    const MAX_ASSET_BYTES = 8 * 1024 * 1024;

    const SHADER = `
        struct Scene {
            motion: vec4f,
            projection: vec4f,
        };
        @group(0) @binding(0) var<uniform> scene: Scene;
        @group(1) @binding(0) var<uniform> baseColor: vec4f;

        struct Vertex {
            @location(0) position: vec3f,
            @location(1) normal: vec3f,
            @location(2) gripPosition: vec3f,
            @location(3) gripNormal: vec3f,
            @location(4) cavity: vec4f,
        };
        struct Surface {
            @builtin(position) position: vec4f,
            @location(0) normal: vec3f,
            @location(1) localPosition: vec3f,
            @location(2) cavity: f32,
        };

        fn turn(v: vec3f) -> vec3f {
            let cx = cos(scene.motion.x);
            let sx = sin(scene.motion.x);
            let cy = cos(scene.motion.y);
            let sy = sin(scene.motion.y);
            let p = vec3f(v.x, cx * v.y - sx * v.z, sx * v.y + cx * v.z);
            return vec3f(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
        }

        @vertex fn vertex(input: Vertex) -> Surface {
            let local = input.position + input.gripPosition * scene.motion.w;
            // Rotate and compress around the authored tip at (0, 0, 0).
            // The pixel hotspot stays fixed even when the body has momentum.
            let p = turn(local) * (1.0 - scene.motion.z * 0.065);
            var out: Surface;
            out.position = vec4f(
                p.xy * scene.projection.xy + scene.projection.zw,
                0.5 - p.z * 0.12,
                1.0
            );
            out.normal = turn(input.normal + input.gripNormal * scene.motion.w);
            out.localPosition = local;
            out.cavity = input.cavity.r;
            return out;
        }

        @fragment fn fragment(input: Surface) -> @location(0) vec4f {
            let n = normalize(input.normal);
            let key = normalize(vec3f(-0.55, 0.8, 1.0));
            let rim = normalize(vec3f(0.9, -0.2, 0.45));
            let diffuse = max(dot(n, key), 0.0);
            let edge = max(dot(n, rim), 0.0);
            let grain = fract(sin(dot(floor(input.localPosition * 150.0),
                vec3f(12.9898, 78.233, 37.719))) * 43758.5453);
            let p = input.localPosition;
            let warp = sin(p.y * 5.0 + p.z * 3.7) * 0.5 + sin(p.x * 2.3) * 0.35;
            let field = abs(sin(p.x * 6.2 + p.y * 3.3 + p.z * 2.8 + warp));
            let vein = 1.0 - smoothstep(0.018, 0.070, field);
            let marble = baseColor.rgb * (0.985 + grain * 0.03)
                * mix(vec3f(1.0), vec3f(0.70, 0.73, 0.74), vein * 0.18);
            let sky = 0.5 + 0.5 * n.y;
            let light = mix(vec3f(0.26, 0.27, 0.30), vec3f(0.36, 0.375, 0.40), sky)
                + diffuse * vec3f(0.84, 0.81, 0.76)
                + edge * vec3f(0.11, 0.13, 0.16);
            let specular = pow(max(dot(n, normalize(key + vec3f(0.0, 0.0, 1.0))), 0.0), 30.0) * 0.06;
            let linear = marble * light * input.cavity + specular;
            let srgb = mix(linear * 12.92,
                1.055 * pow(max(linear, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055,
                step(vec3f(0.0031308), linear));
            return vec4f(clamp(srgb, vec3f(0.0), vec3f(1.0)), 1.0);
        }
    `;

    function requireAsset(condition, message) {
        if (!condition) throw new Error(`Cursor GLB: ${message}`);
    }

    // This is an intentionally strict loader for checked-in assets, not a
    // general glTF loader. Reject unsupported data rather than drawing it wrong.
    function* decodeGlb(data) {
        requireAsset(data.byteLength >= 28 && data.byteLength <= MAX_ASSET_BYTES, "invalid size");
        const view = new DataView(data);
        requireAsset(view.getUint32(0, true) === 0x46546c67, "invalid signature");
        requireAsset(view.getUint32(4, true) === 2, "unsupported version");
        requireAsset(view.getUint32(8, true) === data.byteLength, "truncated file");
        let json;
        let binary;
        for (let offset = 12; offset < data.byteLength;) {
            requireAsset(offset + 8 <= data.byteLength, "truncated chunk");
            const length = view.getUint32(offset, true);
            const type = view.getUint32(offset + 4, true);
            offset += 8;
            requireAsset(length % 4 === 0 && offset + length <= data.byteLength, "invalid chunk length");
            if (type === 0x4e4f534a) {
                requireAsset(!json, "duplicate JSON chunk");
                json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, offset, length)));
            } else if (type === 0x004e4942) {
                requireAsset(!binary, "duplicate binary chunk");
                binary = new DataView(data, offset, length);
            }
            offset += length;
        }
        requireAsset(json?.asset?.version === "2.0" && binary, "missing glTF data");
        requireAsset(!json.extensionsRequired?.length, "extensions are unsupported");
        requireAsset(json.buffers?.length === 1 && !json.buffers[0].uri, "expected embedded buffer");
        requireAsset(json.buffers[0].byteLength <= binary.byteLength, "truncated binary buffer");

        function* accessor(index, type, float = true) {
            const a = json.accessors?.[index];
            const b = json.bufferViews?.[a?.bufferView];
            const color = type === "VEC4";
            requireAsset(a && b && b.buffer === 0 && !a.sparse && a.type === type,
                "unsupported accessor");
            const bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
            const floating = a.componentType === 5126;
            const normalizedColor = color && a.normalized === true && [5121, 5123].includes(a.componentType);
            requireAsset(bytes && (!a.normalized || normalizedColor) &&
                (float ? floating || normalizedColor : !floating && !a.normalized),
                "unsupported component type");
            const components = type === "VEC4" ? 4 : type === "VEC3" ? 3 : 1;
            const stride = b.byteStride ?? bytes * components;
            const start = (b.byteOffset ?? 0) + (a.byteOffset ?? 0);
            const end = start + (a.count - 1) * stride + bytes * components;
            requireAsset(Number.isInteger(a.count) && a.count > 0 && a.count <= 100000,
                "invalid vertex count");
            requireAsset(Number.isInteger(start) && start >= 0 && stride >= bytes * components &&
                stride % bytes === 0 && end <= (b.byteOffset ?? 0) + b.byteLength &&
                end <= json.buffers[0].byteLength, "accessor outside buffer");
            const values = float ? new Float32Array(a.count * components) : new Uint32Array(a.count);
            for (let i = 0; i < a.count; i++) {
                if (i % 1024 === 0) yield;
                for (let j = 0; j < components; j++) {
                    const offset = start + i * stride + j * bytes;
                    const raw = floating ? binary.getFloat32(offset, true)
                        : bytes === 1 ? binary.getUint8(offset)
                            : bytes === 2 ? binary.getUint16(offset, true) : binary.getUint32(offset, true);
                    const value = normalizedColor ? raw / (bytes === 1 ? 255 : 65535) : raw;
                    requireAsset(Number.isFinite(value), "non-finite vertex");
                    values[i * components + j] = value;
                }
            }
            return values;
        }

        const primitives = [];
        const seen = new Set();
        const roots = json.scenes?.[json.scene ?? 0]?.nodes;
        requireAsset(Array.isArray(roots) && roots.length, "missing scene");
        function* visit(index) {
            requireAsset(!seen.has(index), "duplicate or cyclic node");
            seen.add(index);
            const node = json.nodes?.[index];
            requireAsset(node && node.skin === undefined, "unsupported node");
            const identity = (value, expected) => !value ||
                (value.length === expected.length && value.every((n, i) => Math.abs(n - expected[i]) < 0.00001));
            requireAsset(identity(node.matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) &&
                identity(node.translation, [0, 0, 0]) && identity(node.rotation, [0, 0, 0, 1]) &&
                identity(node.scale, [1, 1, 1]), "transforms must be baked in Blender");
            if (node.mesh !== undefined) {
                const mesh = json.meshes?.[node.mesh];
                requireAsset(mesh?.primitives?.length, "missing mesh");
                for (const primitive of mesh.primitives) {
                    requireAsset((primitive.mode ?? 4) === 4 && !primitive.extensions,
                        "expected uncompressed triangles");
                    const positions = yield* accessor(primitive.attributes?.POSITION, "VEC3");
                    const normals = yield* accessor(primitive.attributes?.NORMAL, "VEC3");
                    const indices = yield* accessor(primitive.indices, "SCALAR", false);
                    const cavity = primitive.attributes?.COLOR_0 === undefined ? null
                        : yield* accessor(primitive.attributes.COLOR_0, "VEC4");
                    requireAsset(normals.length === positions.length && indices.length % 3 === 0 &&
                        indices.every((i) => i < positions.length / 3), "invalid triangle data");
                    requireAsset(!primitive.targets || primitive.targets.length <= 1, "expected one Grip morph");
                    const target = primitive.targets?.[0];
                    const gripPositions = target?.POSITION === undefined ? null : yield* accessor(target.POSITION, "VEC3");
                    const gripNormals = target?.NORMAL === undefined ? null : yield* accessor(target.NORMAL, "VEC3");
                    requireAsset((!gripPositions || gripPositions.length === positions.length) &&
                        (!gripNormals || gripNormals.length === normals.length), "invalid morph data");
                    requireAsset(!cavity || cavity.length === positions.length / 3 * 4 &&
                        cavity.every(n => n >= 0 && n <= 1), "invalid cavity colors");
                    const vertices = new Float32Array(positions.length / 3 * 16);
                    for (let i = 0; i < positions.length / 3; i++) {
                        if (i % 1024 === 0) yield;
                        for (let j = 0; j < 3; j++) {
                            vertices[i * 16 + j] = positions[i * 3 + j];
                            vertices[i * 16 + 3 + j] = normals[i * 3 + j];
                            vertices[i * 16 + 6 + j] = gripPositions?.[i * 3 + j] ?? 0;
                            vertices[i * 16 + 9 + j] = gripNormals?.[i * 3 + j] ?? 0;
                        }
                        for (let j = 0; j < 4; j++) vertices[i * 16 + 12 + j] = cavity?.[i * 4 + j] ?? 1;
                    }
                    const material = json.materials?.[primitive.material];
                    const color = material?.pbrMetallicRoughness?.baseColorFactor ?? [0.62, 0.59, 0.52, 1];
                    requireAsset(color.length === 4 && color.every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
                        "invalid material color");
                    primitives.push({ vertices, indices, color });
                }
            }
            for (const child of node.children ?? []) yield* visit(child);
        }
        for (const root of roots) yield* visit(root);
        requireAsset(primitives.length > 0, "empty scene");
        return primitives;
    }

    // One same-origin, bounded worker uses the exact same strict validation as
    // the cooperative fallback. It is cancelled with GPU ownership and idles
    // out rather than keeping anatomy buffers alive after leaving the feed.
    const workerUrl = typeof document !== 'undefined' ? document.currentScript?.src : null;
    const decodeJobs = new Map();
    let decoderWorker = null, workerIdle = 0, jobId = 0;
    function stopWorker(error = new DOMException('Cursor decoding aborted', 'AbortError')) {
        clearTimeout(workerIdle); workerIdle = 0;
        decoderWorker?.terminate(); decoderWorker = null;
        for (const job of decodeJobs.values()) job.finish(error);
        decodeJobs.clear();
    }
    function idleWorker() {
        if (!decodeJobs.size) {
            clearTimeout(workerIdle);
            workerIdle = setTimeout(stopWorker, 10000);
        }
    }
    async function decodeCooperatively(data, signal) {
        const decoding = decodeGlb(data);
        while (true) {
            if (signal.aborted) throw new DOMException('Cursor decoding aborted', 'AbortError');
            const step = decoding.next();
            if (step.done) return step.value;
            if (globalThis.scheduler?.yield) await globalThis.scheduler.yield();
            else if (typeof setTimeout !== 'undefined') await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    async function decodeModel(data, signal) {
        if (signal.aborted) throw new DOMException('Cursor decoding aborted', 'AbortError');
        requireAsset(data.byteLength >= 28 && data.byteLength <= MAX_ASSET_BYTES, 'invalid size');
        if (!workerUrl || typeof Worker === 'undefined') return decodeCooperatively(data, signal);
        if (decodeJobs.size >= 2) throw new Error('Cursor decoder queue is full');
        clearTimeout(workerIdle); workerIdle = 0;
        if (!decoderWorker) {
            try { decoderWorker = new Worker(workerUrl); }
            catch { return decodeCooperatively(data, signal); }
            const activeWorker = decoderWorker;
            decoderWorker.onmessage = ({ data: result }) => {
                if (decoderWorker !== activeWorker) return;
                const job = decodeJobs.get(result?.id);
                if (!job) return;
                decodeJobs.delete(result.id);
                job.finish(result.error ? new Error(result.error) : null, result.model);
                idleWorker();
            };
            decoderWorker.onerror = () => { if (decoderWorker === activeWorker) stopWorker(new Error('Cursor decoder worker failed')); };
            decoderWorker.onmessageerror = () => { if (decoderWorker === activeWorker) stopWorker(new Error('Cursor decoder reply failed')); };
        }
        return new Promise((resolve, reject) => {
            const id = ++jobId;
            let timer;
            const cancel = () => {
                decodeJobs.delete(id);
                finish(new DOMException('Cursor decoding aborted', 'AbortError'));
                if (!decodeJobs.size) stopWorker();
            };
            const finish = (error, model) => {
                clearTimeout(timer);
                signal.removeEventListener('abort', cancel);
                error ? reject(error) : resolve(model);
            };
            decodeJobs.set(id, { finish });
            signal.addEventListener('abort', cancel, { once: true });
            timer = setTimeout(() => stopWorker(new Error('Cursor decoding timed out')), 8000);
            try { decoderWorker.postMessage({ id, buffer: data }, [data]); }
            catch (error) { stopWorker(error); }
        });
    }
    if (typeof window !== 'undefined') window.addEventListener?.('pagehide', () => stopWorker());

    async function create(canvas, { pointerUrl, handUrl, signal, onFailure } = {}) {
        if (!navigator.gpu) throw new Error("WebGPU is unavailable");
        const controller = new AbortController();
        const buffers = new Set();
        let device;
        let context;
        let colorTexture;
        let depthTexture;
        let colorView, depthView;
        let disposed = false;
        let pixelSize = 0;

        function dispose() {
            if (disposed) return;
            disposed = true;
            signal?.removeEventListener("abort", dispose);
            controller.abort();
            for (const buffer of buffers) buffer.destroy();
            buffers.clear();
            colorTexture?.destroy();
            depthTexture?.destroy();
            context?.unconfigure();
            device?.destroy();
        }
        function assertActive() {
            if (disposed || signal?.aborted) throw new DOMException("Cursor initialization aborted", "AbortError");
        }
        function fail(error) {
            if (disposed) return;
            dispose();
            onFailure?.(error);
        }
        signal?.addEventListener("abort", dispose, { once: true });

        try {
            assertActive();
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
            assertActive();
            if (!adapter) throw new Error("No WebGPU adapter is available");
            const acquiredDevice = await adapter.requestDevice();
            // Abort can happen while requestDevice is pending. That new device
            // is not yet owned by dispose(), so destroy it explicitly.
            if (disposed) {
                acquiredDevice.destroy();
                assertActive();
            }
            device = acquiredDevice;
            device.lost.then((info) => fail(new Error(`Cursor GPU lost: ${info.message}`)));
            device.addEventListener("uncapturederror", (event) => {
                event.preventDefault();
                fail(event.error);
            });
            context = canvas.getContext("webgpu");
            if (!context) throw new Error("WebGPU canvas is unavailable");
            const format = navigator.gpu.getPreferredCanvasFormat();
            context.configure({ device, format, alphaMode: "premultiplied" });

            async function load(url) {
                const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
                if (!response.ok) throw new Error(`Cursor asset request failed (${response.status})`);
                const length = Number(response.headers.get("content-length"));
                if (length > MAX_ASSET_BYTES) throw new Error("Cursor asset exceeds size limit");
                const data = await response.arrayBuffer();
                assertActive();
                return decodeModel(data, controller.signal);
            }
            const models = await Promise.all([load(pointerUrl), load(handUrl)]);
            assertActive();
            device.pushErrorScope("validation");
            const shader = device.createShaderModule({ label: "Marble cursor", code: SHADER });
            const pipeline = await device.createRenderPipelineAsync({
                label: "Marble cursor",
                layout: "auto",
                vertex: {
                    module: shader, entryPoint: "vertex",
                    buffers: [{ arrayStride: 64, attributes: [...[0, 1, 2, 3].map((shaderLocation) => ({
                        shaderLocation, offset: shaderLocation * 12, format: "float32x3",
                    })), { shaderLocation: 4, offset: 48, format: "float32x4" }] }],
                },
                fragment: { module: shader, entryPoint: "fragment", targets: [{ format }] },
                primitive: { topology: "triangle-list", cullMode: "back" },
                depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
                multisample: { count: 4 },
            });
            assertActive();

            function upload(data, usage) {
                const buffer = device.createBuffer({ size: Math.ceil(data.byteLength / 4) * 4, usage, mappedAtCreation: true });
                buffers.add(buffer);
                new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                buffer.unmap();
                return buffer;
            }
            const sceneData = new Float32Array(8);
            sceneData.set([2 * PIXELS_PER_UNIT / SIZE, 2 * PIXELS_PER_UNIT / SIZE,
                2 * HOTSPOT.x / SIZE - 1, 1 - 2 * HOTSPOT.y / SIZE], 4);
            const sceneBuffer = upload(sceneData, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
            const sceneGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
                entries: [{ binding: 0, resource: { buffer: sceneBuffer } }] });
            const gpuModels = models.map((primitives) => primitives.map((primitive) => ({
                vertices: upload(primitive.vertices, GPUBufferUsage.VERTEX),
                indices: upload(primitive.indices, GPUBufferUsage.INDEX),
                count: primitive.indices.length,
                material: device.createBindGroup({ layout: pipeline.getBindGroupLayout(1),
                    entries: [{ binding: 0, resource: { buffer: upload(new Float32Array(primitive.color), GPUBufferUsage.UNIFORM) } }] }),
            })));
            const validationError = await device.popErrorScope();
            assertActive();
            if (validationError) throw validationError;

            function resize() {
                const size = Math.round(SIZE * Math.min(window.devicePixelRatio || 1, 2));
                if (pixelSize === size) return;
                pixelSize = size;
                canvas.width = size;
                canvas.height = size;
                colorTexture?.destroy();
                depthTexture?.destroy();
                colorTexture = device.createTexture({ size: [size, size], sampleCount: 4, format,
                    usage: GPUTextureUsage.RENDER_ATTACHMENT });
                depthTexture = device.createTexture({ size: [size, size], sampleCount: 4, format: "depth24plus",
                    usage: GPUTextureUsage.RENDER_ATTACHMENT });
                colorView = colorTexture.createView();
                depthView = depthTexture.createView();
            }
            const clamp = (value, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0;
            function render({ mode = "arrow", tiltX = 0, tiltY = 0, press = 0, grip = 0 } = {}) {
                if (disposed) return false;
                try {
                    resize();
                    // Input springs stay within 0.18 rad in the controller;
                    // full side views remain available for anatomy inspection.
                    sceneData[0] = 0.04 + clamp(tiltX, -1.6, 1.6);
                    sceneData[1] = -0.08 + clamp(tiltY, -1.6, 1.6);
                    sceneData[2] = clamp(press, 0, 1);
                    sceneData[3] = clamp(grip, 0, 1);
                    device.queue.writeBuffer(sceneBuffer, 0, sceneData);
                    const encoder = device.createCommandEncoder({ label: "Cursor frame" });
                    const pass = encoder.beginRenderPass({
                        colorAttachments: [{ view: colorView,
                            resolveTarget: context.getCurrentTexture().createView(),
                            clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "discard" }],
                        depthStencilAttachment: { view: depthView, depthClearValue: 1,
                            depthLoadOp: "clear", depthStoreOp: "discard" },
                    });
                    pass.setPipeline(pipeline);
                    pass.setBindGroup(0, sceneGroup);
                    for (const primitive of gpuModels[mode === "arrow" ? 0 : 1]) {
                        pass.setBindGroup(1, primitive.material);
                        pass.setVertexBuffer(0, primitive.vertices);
                        pass.setIndexBuffer(primitive.indices, "uint32");
                        pass.drawIndexed(primitive.count);
                    }
                    pass.end();
                    device.queue.submit([encoder.finish()]);
                    return true;
                } catch (error) {
                    fail(error);
                    return false;
                }
            }
            return { render, dispose, size: SIZE, hotspot: HOTSPOT };
        } catch (error) {
            dispose();
            throw error;
        }
    }

    if (typeof window === 'undefined') {
        globalThis.onmessage = ({ data }) => {
            if (!Number.isSafeInteger(data?.id) || data.id < 1) return;
            try {
                const decoding = decodeGlb(data.buffer);
                let step;
                do { step = decoding.next(); } while (!step.done);
                const model = step.value;
                globalThis.postMessage({ id: data.id, model }, model.flatMap(p => [p.vertices.buffer, p.indices.buffer]));
            } catch (error) { globalThis.postMessage({ id: data.id, error: error.message }); }
        };
        return;
    }
    window.__engCursorRenderer = { create };
})();
