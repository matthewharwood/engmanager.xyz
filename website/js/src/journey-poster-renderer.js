// The sculptures are prepared/exported in Blender; source credits live beside
// the assets and on each poster. This small
// renderer accepts our opaque, uncompressed glTF 2 triangle assets only; it is
// deliberately not a general-purpose glTF engine or a runtime dependency.
(function () {
    const MAX_BYTES = 16 * 1024 * 1024;
    const MAX_VERTICES = 600000;
    const SHADOW_SIZE = 1024;
    const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const SHADER = `
        struct Scene {
            motion: vec4f,
            projection: vec4f,
        };
        @group(0) @binding(0) var<uniform> scene: Scene;
        @group(0) @binding(1) var shadowMap: texture_depth_2d;
        @group(0) @binding(2) var shadowSampler: sampler_comparison;

        struct Vertex {
            @location(0) position: vec3f,
            @location(1) normal: vec3f,
            @location(2) color: vec3f,
        };
        struct Surface {
            @builtin(position) position: vec4f,
            @location(0) normal: vec3f,
            @location(1) local: vec3f,
            @location(2) color: vec3f,
            @location(3) light: vec3f,
        };

        fn rotate(p: vec3f) -> vec3f {
            let cy = cos(scene.motion.x);
            let sy = sin(scene.motion.x);
            let cx = cos(scene.motion.y);
            let sx = sin(scene.motion.y);
            let q = vec3f(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
            return vec3f(q.x, cx * q.y - sx * q.z, sx * q.y + cx * q.z);
        }
        fn lightPosition(p: vec3f) -> vec3f {
            let forward = normalize(vec3f(-0.65, 0.9, 1.1));
            let right = normalize(cross(vec3f(0.0, 1.0, 0.0), forward));
            let up = cross(forward, right);
            return vec3f(dot(p, right) * 0.58, dot(p, up) * 0.58,
                0.5 - dot(p, forward) * 0.23);
        }
        @vertex fn shadowVertex(input: Vertex) -> @builtin(position) vec4f {
            return vec4f(lightPosition(rotate(input.position)), 1.0);
        }
        @vertex fn vertex(input: Vertex) -> Surface {
            let p = rotate(input.position);
            var out: Surface;
            out.position = vec4f(p.xy * scene.projection.xy, 0.5 - p.z * 0.23, 1.0);
            out.normal = rotate(input.normal);
            out.local = input.position;
            out.color = input.color;
            out.light = lightPosition(p);
            return out;
        }
        fn hash(p: vec3f) -> f32 {
            var q = fract(p * 0.1031);
            q += dot(q, q.yzx + 33.33);
            return fract((q.x + q.y) * q.z);
        }
        fn noise(p: vec3f) -> f32 {
            let cell = floor(p);
            let f = fract(p);
            let s = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(cell), hash(cell + vec3f(1, 0, 0)), s.x),
                mix(hash(cell + vec3f(0, 1, 0)), hash(cell + vec3f(1, 1, 0)), s.x), s.y),
                mix(mix(hash(cell + vec3f(0, 0, 1)), hash(cell + vec3f(1, 0, 1)), s.x),
                mix(hash(cell + vec3f(0, 1, 1)), hash(cell + vec3f(1, 1, 1)), s.x), s.y), s.z);
        }
        @fragment fn fragment(input: Surface) -> @location(0) vec4f {
            let n = normalize(input.normal);
            let key = normalize(vec3f(-0.65, 0.9, 1.1));
            let p = input.local;
            // Object-space veins stay in the stone as it turns. Broad cloudy
            // calcite, sparse iron-grey seams, and fine pores avoid a plastic
            // uniform white surface without shipping a large bitmap texture.
            let cloud = noise(p * 2.9);
            let warp = cloud * 2.4 + noise(p * 7.5) * 0.6;
            let veinField = abs(sin(p.x * 6.2 + p.y * 3.3 + p.z * 2.8 + warp));
            let vein = 1.0 - smoothstep(0.018, 0.070, veinField);
            let fine = noise(p * 98.0);
            let stone = input.color * (0.91 + cloud * 0.105 + (fine - 0.5) * 0.036)
                * mix(vec3f(1.0), vec3f(0.70, 0.73, 0.74), vein * 0.45);
            let uv = input.light.xy * vec2f(0.5, -0.5) + 0.5;
            let bias = 0.0006 + (1.0 - max(dot(n, key), 0.0)) * 0.0012;
            var visibility = 0.0;
            for (var y = -1; y <= 1; y++) {
                for (var x = -1; x <= 1; x++) {
                    let offset = vec2f(f32(x), f32(y)) * (1.5 / 1024.0);
                    visibility += textureSampleCompare(shadowMap, shadowSampler,
                        uv + offset, input.light.z - bias);
                }
            }
            visibility /= 9.0;
            let diffuse = max(dot(n, key), 0.0) * visibility;
            let sky = 0.5 + 0.5 * n.y;
            let fill = max(dot(n, normalize(vec3f(0.85, 0.25, 0.55))), 0.0);
            let rim = pow(max(dot(n, normalize(vec3f(0.5, 0.35, -0.8))), 0.0), 2.0);
            let lighting = mix(vec3f(0.10, 0.105, 0.12), vec3f(0.27, 0.285, 0.31), sky)
                + diffuse * vec3f(0.92, 0.87, 0.76)
                + fill * vec3f(0.085, 0.105, 0.14)
                + rim * vec3f(0.15, 0.18, 0.23);
            let halfVector = normalize(key + vec3f(0.0, 0.0, 1.0));
            let sheen = pow(max(dot(n, halfVector), 0.0), 30.0) * 0.06 * visibility;
            let linear = stone * lighting + sheen;
            let srgb = mix(linear * 12.92,
                1.055 * pow(max(linear, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055,
                step(vec3f(0.0031308), linear));
            return vec4f(clamp(srgb, vec3f(0.0), vec3f(1.0)), 1.0);
        }
    `;

    function check(condition, message) {
        if (!condition) throw new Error(`Journey GLB: ${message}`);
    }
    function multiply(a, b) {
        return IDENTITY.map((_, i) => {
            const row = i % 4;
            const col = Math.floor(i / 4);
            return a[row] * b[col * 4] + a[row + 4] * b[col * 4 + 1]
                + a[row + 8] * b[col * 4 + 2] + a[row + 12] * b[col * 4 + 3];
        });
    }
    function transform(node) {
        const valid = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
        if (node.matrix) {
            check(valid(node.matrix, 16) && !node.translation && !node.rotation && !node.scale,
                'invalid matrix');
            check(node.matrix[3] === 0 && node.matrix[7] === 0 && node.matrix[11] === 0 &&
                node.matrix[15] === 1, 'expected affine matrix');
            return node.matrix;
        }
        const t = node.translation ?? [0, 0, 0];
        const s = node.scale ?? [1, 1, 1];
        const r = node.rotation ?? [0, 0, 0, 1];
        check(valid(t, 3) && valid(s, 3) && valid(r, 4), 'invalid transform');
        check(Math.abs(Math.hypot(...r) - 1) < 0.001, 'invalid rotation');
        const [x, y, z, w] = r;
        return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
            2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
            2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
            ...t, 1];
    }

    function decodeGlb(data) {
        check(data.byteLength >= 28 && data.byteLength <= MAX_BYTES, 'invalid size');
        const view = new DataView(data);
        check(view.getUint32(0, true) === 0x46546c67, 'invalid signature');
        check(view.getUint32(4, true) === 2, 'unsupported version');
        check(view.getUint32(8, true) === data.byteLength, 'truncated file');
        let json;
        let binary;
        for (let offset = 12; offset < data.byteLength;) {
            check(offset + 8 <= data.byteLength, 'truncated chunk');
            const length = view.getUint32(offset, true);
            const type = view.getUint32(offset + 4, true);
            offset += 8;
            check(length % 4 === 0 && offset + length <= data.byteLength, 'invalid chunk length');
            if (type === 0x4e4f534a) {
                check(!json, 'duplicate JSON chunk');
                json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, offset, length)));
            } else if (type === 0x004e4942) {
                check(!binary, 'duplicate binary chunk');
                binary = new DataView(data, offset, length);
            }
            offset += length;
        }
        check(json?.asset?.version === '2.0' && binary, 'missing glTF data');
        check(!json.extensionsRequired?.length, 'required extensions are unsupported');
        check(json.buffers?.length === 1 && !json.buffers[0].uri, 'expected embedded buffer');
        check(Number.isInteger(json.buffers[0].byteLength) && json.buffers[0].byteLength <= binary.byteLength,
            'truncated binary buffer');
        function accessor(index, type, kind = 'float') {
            const a = json.accessors?.[index];
            const b = json.bufferViews?.[a?.bufferView];
            check(a && b && b.buffer === 0 && !a.sparse && a.type === type, 'unsupported accessor');
            const bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
            const isFloat = a.componentType === 5126;
            check(bytes && (kind === 'index' ? !isFloat && !a.normalized
                : kind === 'color' ? isFloat || a.normalized && bytes < 4 : isFloat && !a.normalized),
            'unsupported component type');
            const components = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
            const stride = b.byteStride ?? bytes * components;
            const offset = a.byteOffset ?? 0;
            const start = (b.byteOffset ?? 0) + offset;
            check(Number.isInteger(a.count) && a.count > 0 && a.count <= MAX_VERTICES * 6, 'invalid accessor count');
            const end = start + (a.count - 1) * stride + bytes * components;
            check(Number.isInteger(start) && Number.isInteger(offset) && offset >= 0 && start >= 0 &&
                Number.isInteger(stride) && stride >= bytes * components && stride % bytes === 0 &&
                Number.isInteger(b.byteLength) && end <= (b.byteOffset ?? 0) + b.byteLength &&
                end <= json.buffers[0].byteLength, 'accessor outside buffer');
            const values = kind === 'index' ? new Uint32Array(a.count) : new Float32Array(a.count * components);
            for (let i = 0; i < a.count; i++) {
                for (let j = 0; j < components; j++) {
                    const at = start + i * stride + j * bytes;
                    let value = isFloat ? binary.getFloat32(at, true) : bytes === 1 ? binary.getUint8(at)
                        : bytes === 2 ? binary.getUint16(at, true) : binary.getUint32(at, true);
                    if (a.normalized) value /= bytes === 1 ? 255 : 65535;
                    check(Number.isFinite(value), 'non-finite vertex');
                    values[i * components + j] = value;
                }
            }
            return values;
        }
        const pieces = [];
        const seen = new Set();
        let vertexCount = 0;
        let indexCount = 0;
        const minimum = [Infinity, Infinity, Infinity];
        const maximum = [-Infinity, -Infinity, -Infinity];
        function visit(index, parent) {
            check(Number.isInteger(index) && !seen.has(index), 'duplicate or cyclic node');
            seen.add(index);
            const node = json.nodes?.[index];
            check(node && node.skin === undefined, 'unsupported node');
            const m = multiply(parent, transform(node));
            // Cofactors are the inverse-transpose normal matrix, apart from
            // the determinant. Handle mirrored authoring transforms as well.
            const cof = [m[5] * m[10] - m[6] * m[9], m[6] * m[8] - m[4] * m[10], m[4] * m[9] - m[5] * m[8],
                m[9] * m[2] - m[10] * m[1], m[10] * m[0] - m[8] * m[2], m[8] * m[1] - m[9] * m[0],
                m[1] * m[6] - m[2] * m[5], m[2] * m[4] - m[0] * m[6], m[0] * m[5] - m[1] * m[4]];
            const determinant = m[0] * cof[0] + m[1] * cof[1] + m[2] * cof[2];
            check(Number.isFinite(determinant) && Math.abs(determinant) > 1e-10, 'singular transform');
            if (node.mesh !== undefined) {
                const mesh = json.meshes?.[node.mesh];
                check(mesh?.primitives?.length, 'missing mesh');
                for (const primitive of mesh.primitives) {
                    check((primitive.mode ?? 4) === 4 && !primitive.extensions && !primitive.targets,
                        'expected uncompressed static triangles');
                    const positions = accessor(primitive.attributes?.POSITION, 'VEC3');
                    const normals = accessor(primitive.attributes?.NORMAL, 'VEC3');
                    const count = positions.length / 3;
                    const indices = primitive.indices === undefined ? Uint32Array.from({ length: count }, (_, i) => i)
                        : accessor(primitive.indices, 'SCALAR', 'index');
                    check(normals.length === positions.length && indices.length % 3 === 0 &&
                        indices.every((i) => i < count), 'invalid triangles');
                    vertexCount += count;
                    indexCount += indices.length;
                    check(vertexCount <= MAX_VERTICES && indexCount <= MAX_VERTICES * 6, 'scene exceeds geometry limit');
                    const colorIndex = primitive.attributes?.COLOR_0;
                    const colorType = json.accessors?.[colorIndex]?.type;
                    check(colorIndex === undefined || colorType === 'VEC3' || colorType === 'VEC4', 'invalid color accessor');
                    const colors = colorIndex === undefined ? null : accessor(colorIndex, colorType, 'color');
                    const colorSize = colorType === 'VEC4' ? 4 : 3;
                    check(!colors || colors.length === count * colorSize, 'invalid color count');
                    const material = json.materials?.[primitive.material];
                    const pbr = material?.pbrMetallicRoughness;
                    check(!pbr?.baseColorTexture && (!material?.alphaMode || material.alphaMode === 'OPAQUE'),
                        'expected opaque vertex-colored stone');
                    const color = pbr?.baseColorFactor ?? [0.78, 0.75, 0.68, 1];
                    check(color.length === 4 && color.every((n) => Number.isFinite(n) && n >= 0 && n <= 1), 'invalid material color');
                    const vertices = new Float32Array(count * 9);
                    for (let i = 0; i < count; i++) {
                        const p = positions.subarray(i * 3, i * 3 + 3);
                        const n = normals.subarray(i * 3, i * 3 + 3);
                        for (let j = 0; j < 3; j++) {
                            const value = m[j] * p[0] + m[j + 4] * p[1] + m[j + 8] * p[2] + m[j + 12];
                            check(Number.isFinite(value), 'invalid transformed position');
                            vertices[i * 9 + j] = value;
                            minimum[j] = Math.min(minimum[j], value);
                            maximum[j] = Math.max(maximum[j], value);
                            vertices[i * 9 + 3 + j] = (cof[j] * n[0] + cof[j + 3] * n[1] + cof[j + 6] * n[2]) / determinant;
                            const shade = colors?.[i * colorSize + j] ?? 1;
                            check(shade >= 0 && shade <= 1, 'invalid vertex color');
                            vertices[i * 9 + 6 + j] = color[j] * shade;
                        }
                    }
                    if (determinant < 0) {
                        for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
                    }
                    pieces.push({ vertices, indices });
                }
            }
            for (const child of node.children ?? []) visit(child, m);
        }
        const roots = json.scenes?.[json.scene ?? 0]?.nodes;
        check(Array.isArray(roots) && roots.length, 'missing scene');
        roots.forEach((root) => visit(root, IDENTITY));
        check(vertexCount > 0, 'empty scene');
        const center = minimum.map((n, i) => (n + maximum[i]) / 2);
        const extent = Math.max(...minimum.map((n, i) => (maximum[i] - n) / 2));
        check(Number.isFinite(extent) && extent > 0, 'empty bounds');
        const vertices = new Float32Array(vertexCount * 9);
        const indices = new Uint32Array(indexCount);
        let v = 0;
        let ix = 0;
        let radius = 0;
        let height = 0;
        for (const piece of pieces) {
            for (let i = 0; i < piece.vertices.length; i += 9) {
                for (let j = 0; j < 3; j++) piece.vertices[i + j] = (piece.vertices[i + j] - center[j]) / extent;
                radius = Math.max(radius, Math.hypot(piece.vertices[i], piece.vertices[i + 2]));
                height = Math.max(height, Math.abs(piece.vertices[i + 1]));
            }
            vertices.set(piece.vertices, v * 9);
            for (const index of piece.indices) indices[ix++] = index + v;
            v += piece.vertices.length / 9;
        }
        return { vertices, indices, radius, height };
    }

    async function mount(canvas, { url, reducedMotion = false, onError, signal } = {}) {
        if (!navigator.gpu) throw new Error('WebGPU is unavailable');
        const abort = new AbortController();
        const buffers = new Set();
        let device;
        let context;
        let colorTexture;
        let depthTexture;
        let shadowTexture;
        let observer;
        let resizeObserver;
        let disposed = false;
        let initialized = false;
        let intersecting = true;
        let visible = true;
        let frame = 0;
        let previousTime = 0;
        let idle = 0;
        let progress = 0;
        let pixelWidth = 0;
        let pixelHeight = 0;
        let lastError;
        let errorHandler;
        let tick;
        const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const staticMotion = () => motion ? motion.matches : reducedMotion;
        function destroy() {
            if (disposed) return;
            disposed = true;
            abort.abort();
            signal?.removeEventListener('abort', destroy);
            cancelAnimationFrame(frame);
            observer?.disconnect();
            resizeObserver?.disconnect();
            document.removeEventListener('visibilitychange', visibility);
            motion?.removeEventListener('change', visibility);
            if (errorHandler) device?.removeEventListener('uncapturederror', errorHandler);
            for (const buffer of buffers) buffer.destroy();
            buffers.clear();
            colorTexture?.destroy();
            depthTexture?.destroy();
            shadowTexture?.destroy();
            context?.unconfigure();
            device?.destroy();
        }
        function active() {
            if (lastError) throw lastError;
            if (disposed || signal?.aborted) throw new DOMException('Poster initialization aborted', 'AbortError');
        }
        function fail(error) {
            if (disposed) return;
            lastError = error;
            destroy();
            if (initialized) onError?.(error);
        }
        function schedule() {
            if (!disposed && tick && !frame && visible && intersecting && !document.hidden) frame = requestAnimationFrame(tick);
        }
        function visibility() {
            previousTime = 0;
            if (document.hidden || !visible || !intersecting) {
                cancelAnimationFrame(frame);
                frame = 0;
            } else schedule();
        }
        signal?.addEventListener('abort', destroy, { once: true });
        try {
            active();
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
            active();
            if (!adapter) throw new Error('No WebGPU adapter is available');
            const acquired = await adapter.requestDevice();
            if (disposed) {
                acquired.destroy();
                active();
            }
            device = acquired;
            device.lost.then((info) => fail(new Error(`Poster GPU lost: ${info.message}`)));
            errorHandler = (event) => { event.preventDefault(); fail(event.error); };
            device.addEventListener('uncapturederror', errorHandler);
            context = canvas.getContext('webgpu');
            if (!context) throw new Error('WebGPU canvas is unavailable');
            const format = navigator.gpu.getPreferredCanvasFormat();
            context.configure({ device, format, alphaMode: 'premultiplied' });
            const response = await fetch(url, { signal: abort.signal, credentials: 'same-origin' });
            if (!response.ok) throw new Error(`Poster asset request failed (${response.status})`);
            if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Poster asset exceeds size limit');
            const model = decodeGlb(await response.arrayBuffer());
            active();
            device.pushErrorScope('validation');
            const shader = device.createShaderModule({ label: 'Carved marble poster', code: SHADER });
            const vertexBuffers = [{ arrayStride: 36, attributes: [0, 1, 2].map((shaderLocation) => ({
                shaderLocation, offset: shaderLocation * 12, format: 'float32x3',
            })) }];
            const [pipeline, shadowPipeline] = await Promise.all([
                device.createRenderPipelineAsync({
                    label: 'Marble surface', layout: 'auto',
                    vertex: { module: shader, entryPoint: 'vertex', buffers: vertexBuffers },
                    fragment: { module: shader, entryPoint: 'fragment', targets: [{ format }] },
                    primitive: { topology: 'triangle-list', cullMode: 'back' },
                    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
                    multisample: { count: 4 },
                }),
                device.createRenderPipelineAsync({
                    label: 'Marble self-shadow', layout: 'auto',
                    vertex: { module: shader, entryPoint: 'shadowVertex', buffers: vertexBuffers },
                    primitive: { topology: 'triangle-list', cullMode: 'back' },
                    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less',
                        depthBias: 2, depthBiasSlopeScale: 1.5 },
                }),
            ]);
            active();
            function upload(data, usage) {
                const buffer = device.createBuffer({ size: Math.ceil(data.byteLength / 4) * 4, usage, mappedAtCreation: true });
                buffers.add(buffer);
                new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                buffer.unmap();
                return buffer;
            }
            const vertexBuffer = upload(model.vertices, GPUBufferUsage.VERTEX);
            const indexBuffer = upload(model.indices, GPUBufferUsage.INDEX);
            const sceneData = new Float32Array(8);
            const sceneBuffer = upload(sceneData, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
            shadowTexture = device.createTexture({ label: 'Marble shadow', size: [SHADOW_SIZE, SHADOW_SIZE],
                format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
            const shadowView = shadowTexture.createView();
            const uniformEntry = { binding: 0, resource: { buffer: sceneBuffer } };
            const sceneGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [uniformEntry,
                { binding: 1, resource: shadowView },
                { binding: 2, resource: device.createSampler({ compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' }) },
            ] });
            const shadowGroup = device.createBindGroup({ layout: shadowPipeline.getBindGroupLayout(0), entries: [uniformEntry] });
            const validation = await device.popErrorScope();
            active();
            if (validation) throw validation;
            function resize() {
                // Layout size excludes the poster's CSS scale during reveal. Using
                // transformed bounds would reallocate MSAA targets on each scroll.
                const layoutWidth = canvas.clientWidth;
                const layoutHeight = canvas.clientHeight;
                const rect = layoutWidth && layoutHeight ? { width: layoutWidth, height: layoutHeight }
                    : canvas.getBoundingClientRect();
                const ratio = Math.min(window.devicePixelRatio || 1, 2, 1000 / Math.max(rect.width, rect.height, 1));
                const width = Math.max(1, Math.round(rect.width * ratio));
                const height = Math.max(1, Math.round(rect.height * ratio));
                if (width === pixelWidth && height === pixelHeight) return;
                pixelWidth = canvas.width = width;
                pixelHeight = canvas.height = height;
                colorTexture?.destroy();
                depthTexture?.destroy();
                colorTexture = device.createTexture({ size: [width, height], sampleCount: 4, format,
                    usage: GPUTextureUsage.RENDER_ATTACHMENT });
                depthTexture = device.createTexture({ size: [width, height], sampleCount: 4, format: 'depth24plus',
                    usage: GPUTextureUsage.RENDER_ATTACHMENT });
            }
            function render() {
                if (disposed) return false;
                try {
                    resize();
                    const aspect = pixelWidth / pixelHeight;
                    const fit = Math.min(0.88 / (model.height + model.radius * 0.09), 0.86 * aspect / model.radius);
                    sceneData[0] = -0.30 + (staticMotion() ? 0 : idle + progress * 1.05);
                    sceneData[1] = -0.08;
                    sceneData[4] = fit / aspect;
                    sceneData[5] = fit;
                    device.queue.writeBuffer(sceneBuffer, 0, sceneData);
                    const encoder = device.createCommandEncoder({ label: 'Marble poster frame' });
                    const shadowPass = encoder.beginRenderPass({ colorAttachments: [], depthStencilAttachment: {
                        view: shadowView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store',
                    } });
                    shadowPass.setPipeline(shadowPipeline);
                    shadowPass.setBindGroup(0, shadowGroup);
                    shadowPass.setVertexBuffer(0, vertexBuffer);
                    shadowPass.setIndexBuffer(indexBuffer, 'uint32');
                    shadowPass.drawIndexed(model.indices.length);
                    shadowPass.end();
                    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: colorTexture.createView(),
                        resolveTarget: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 },
                        loadOp: 'clear', storeOp: 'discard' }], depthStencilAttachment: { view: depthTexture.createView(),
                        depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' } });
                    pass.setPipeline(pipeline);
                    pass.setBindGroup(0, sceneGroup);
                    pass.setVertexBuffer(0, vertexBuffer);
                    pass.setIndexBuffer(indexBuffer, 'uint32');
                    pass.drawIndexed(model.indices.length);
                    pass.end();
                    device.queue.submit([encoder.finish()]);
                    return true;
                } catch (error) {
                    fail(error);
                    return false;
                }
            }
            tick = (time) => {
                frame = 0;
                if (disposed || !visible || !intersecting || document.hidden) return;
                // A decorative sculpture needs 30 fps, not the display's full
                // refresh rate. Hidden/offscreen time does not advance its turn.
                if (!previousTime || time - previousTime >= 32 || staticMotion()) {
                    if (previousTime && !staticMotion()) idle = (idle + Math.min(time - previousTime, 100) * 0.000035) % (Math.PI * 2);
                    previousTime = time;
                    render();
                }
                if (!staticMotion()) schedule();
            };
            if (!render()) active();
            await device.queue.onSubmittedWorkDone();
            active();
            initialized = true;
            if (typeof IntersectionObserver !== 'undefined') {
                observer = new IntersectionObserver((entries) => {
                    intersecting = entries.some((entry) => entry.isIntersecting);
                    visibility();
                });
                observer.observe(canvas);
            }
            if (typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver(schedule);
                resizeObserver.observe(canvas);
            }
            document.addEventListener('visibilitychange', visibility);
            motion?.addEventListener('change', visibility);
            schedule();
            return {
                setVisible(value) {
                    const next = Boolean(value);
                    if (visible === next) return;
                    visible = next;
                    visibility();
                },
                setProgress(value) {
                    if (!Number.isFinite(value)) return;
                    progress = Math.min(1, Math.max(0, value));
                    if (!staticMotion()) schedule();
                },
                destroy,
            };
        } catch (error) {
            destroy();
            throw error;
        }
    }
    window.__engJourneyPoster = { mount };
})();
