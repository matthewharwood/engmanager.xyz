// Eleven mechanisms, one renderer. See _docs/article-hero-atlas.md for the
// content/algorithm/treatment matrix. None of these are personality scores or
// live business data; they are deterministic editorial abstractions.
(() => {
    const SLUGS = [
        'auteurs', 'autonomous-av-studio', 'big-personality', 'claude-code-lsp',
        'jsx-like-rust-macro', 'mcp-blender-library-3d-print', 'project-foottraffic',
        'talking-not-typing', 'the-casino-hypothesis', 'the-execution-marketplace',
        'vibe-coding-a-shop',
    ];
    const VERTEX = `#version 300 es
    in vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
    const FRAGMENT = `#version 300 es
    precision highp float;
    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform float u_time;
    uniform int u_scene;
    uniform vec3 u_paper, u_ink, u_accent, u_secondary, u_tertiary;
    out vec4 outColor;

    float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float valueNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
                   mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
    }
    float box(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }
    float segment(vec2 p, vec2 a, vec2 b) {
        vec2 v = b - a;
        return length(p - (a + v * clamp(dot(p - a, v) / dot(v, v), 0.0, 1.0)));
    }
    float stroke(float d, float w) { return 1.0 - smoothstep(w, w + 0.003, abs(d)); }
    float fill(float d) { return 1.0 - smoothstep(-0.003, 0.003, d); }
    float ring(vec2 p, float r, float w) { return stroke(length(p) - r, w); }
    vec2 graphNode(int i) {
        if (i == 0) return vec2(-0.46, 0.0);
        if (i == 1) return vec2(-0.16, 0.26);
        if (i == 2) return vec2(-0.12, -0.25);
        if (i == 3) return vec2(0.18, 0.3);
        if (i == 4) return vec2(0.19, -0.16);
        return vec2(0.48, 0.04);
    }
    int graphDepth(int i) {
        if (i == 0) return 0;
        if (i < 3) return 1;
        if (i < 5) return 2;
        return 3;
    }
    void main() {
        float aspect = u_resolution.x / u_resolution.y;
        vec2 p = (gl_FragCoord.xy / u_resolution.xy - 0.5) * vec2(aspect, 1.0);
        p += (u_pointer - 0.5) * 0.018;
        float t = u_time, a = 0.0, b = 0.0, c = 0.0;
        vec3 color = mix(u_paper, u_ink, 0.055 + 0.035 * p.y);
        float paperGrid = stroke(fract(p.x * 17.0) - 0.5, 0.006) *
                          stroke(fract(p.y * 17.0) - 0.5, 0.006);
        color = mix(color, u_ink, paperGrid * 0.065);

        if (u_scene == 0) {
            // Barycentric palette interpolation plus coherent value noise:
            // disciplines blend into one orb without collapsing to a flat hue.
            float d = length(p);
            float mask = 1.0 - smoothstep(0.355, 0.366, d);
            float theta = atan(p.y, p.x) + t * 0.085;
            float w = 0.5 + 0.25 * sin(theta * 2.0) + 0.25 * valueNoise(p * 4.0 + t * 0.12);
            vec3 spectrum = mix(u_accent, u_secondary, smoothstep(0.12, 0.83, w));
            spectrum = mix(spectrum, u_tertiary, smoothstep(0.55, 1.0, w) * 0.44);
            color = mix(color, spectrum, mask * 0.94);
            a = ring(p, 0.37, 0.0015) * 0.55;
        } else if (u_scene == 1) {
            // Topological scheduling: two film strips share one clock, and
            // successive cells illuminate only after their predecessor.
            for (int i = 0; i < 8; i++) {
                float x = (float(i % 4) - 1.5) * 0.205;
                float y = (i < 4 ? 0.16 : -0.16);
                vec2 q = p - vec2(x, y);
                float frame = box(q, vec2(0.077, 0.125));
                b += stroke(frame, 0.002);
                float phase = fract(t * 0.11) * 8.0;
                float scheduled = 1.0 - smoothstep(0.0, 0.65, abs(phase - float(i)));
                a += fill(frame + 0.014) * (0.18 + 0.62 * scheduled);
                c += stroke(segment(q, vec2(-0.055, -0.085), vec2(0.055, 0.085)), 0.001) * 0.25;
            }
            c += stroke(p.y, 0.003) * step(abs(p.x), 0.45);
        } else if (u_scene == 2) {
            // Seven-seed Voronoi: boundaries move with the lenses; the
            // portrait remains a continuum rather than a categorical type.
            float near1 = 10.0, near2 = 10.0;
            for (int i = 0; i < 7; i++) {
                float angle = float(i) * 6.2831853 / 7.0 + t * 0.035;
                vec2 seed = vec2(cos(angle) * 0.25, sin(angle) * 0.21);
                float d = length(p - seed);
                if (d < near1) { near2 = near1; near1 = d; }
                else if (d < near2) near2 = d;
                b += ring(p - seed, 0.016, 0.002);
            }
            float field = length(p / vec2(1.35, 1.0));
            a = stroke(near2 - near1, 0.004) * (1.0 - smoothstep(0.30, 0.39, field));
            c = ring(p, 0.34, 0.001) + ring(p, 0.26, 0.001) * 0.35;
        } else if (u_scene == 3) {
            // Breadth-first traversal: references light by graph depth,
            // including indirect edges that a literal text scan would miss.
            float wave = fract(t * 0.115) * 4.0;
            for (int i = 0; i < 6; i++) {
                vec2 n = graphNode(i);
                int next = i == 0 ? 1 : i == 1 ? 3 : i == 2 ? 4 : 5;
                if (i < 5) b += stroke(segment(p, n, graphNode(next)), 0.0015) * 0.65;
                float frontier = 1.0 - smoothstep(0.0, 0.6, abs(wave - float(graphDepth(i))));
                a += ring(p - n, 0.025 + 0.006 * frontier, 0.004) * (0.45 + frontier);
                c += fill(length(p - n) - 0.006) * (0.25 + frontier);
            }
        } else if (u_scene == 4) {
            // Recursive descent / stack depth: each nested pair is a parser
            // frame; the center token grows outward into structured output.
            for (int i = 0; i < 5; i++) {
                float f = float(i), open = fract(t * 0.19 + f * 0.18);
                vec2 size = vec2(0.105 + f * 0.092, 0.105 + f * 0.057);
                float contour = box(p, size);
                a += stroke(contour, 0.002) * (0.25 + open * 0.16);
                b += stroke(segment(p, vec2(-size.x, -size.y), vec2(-size.x, size.y)), 0.004);
                b += stroke(segment(p, vec2(size.x, -size.y), vec2(size.x, size.y)), 0.004);
            }
            c = fill(box(p, vec2(0.03, 0.03))) * 0.8;
        } else if (u_scene == 5) {
            // Signed-distance unions sampled by a virtual FDM slicer: the
            // figure only appears where a printable horizontal layer exists.
            float head = length(p - vec2(-0.015, 0.15)) - 0.087;
            float body = box(p - vec2(-0.015, -0.02), vec2(0.115, 0.13));
            float legs = min(box(p - vec2(-0.072, -0.185), vec2(0.048, 0.07)),
                             box(p - vec2(0.043, -0.185), vec2(0.048, 0.07)));
            float hammer = min(box(p - vec2(0.23, 0.14), vec2(0.09, 0.05)),
                               box(p - vec2(0.23, -0.04), vec2(0.013, 0.18)));
            float shape = min(min(head, body), min(legs, hammer));
            float base = box(p - vec2(0.02, -0.29), vec2(0.28, 0.028));
            shape = min(shape, base);
            float layer = fract((p.y + 0.5) * 41.0);
            a = fill(shape) * (0.32 + 0.5 * smoothstep(0.0, 0.10, layer));
            b = stroke(shape, 0.002);
            c = fill(shape) * (1.0 - smoothstep(0.08, 0.13, layer)) * 0.5;
        } else if (u_scene == 6) {
            // Lattice flood-fill / Manhattan distance: one paid storefront
            // upgrade propagates through adjacent plaza blocks.
            float growth = 1.0 + fract(t * 0.055) * 4.0;
            for (int y = -2; y <= 2; y++) for (int x = -4; x <= 4; x++) {
                vec2 q = p - vec2(float(x) * 0.14, float(y) * 0.145);
                float block = box(q, vec2(0.053, 0.052));
                float distanceFromSeed = float(abs(x) + abs(y));
                float reached = 1.0 - smoothstep(growth - 0.35, growth + 0.25, distanceFromSeed);
                b += stroke(block, 0.0015) * 0.47;
                a += fill(block + 0.013) * reached * 0.58;
            }
            c = ring(p, 0.042, 0.004);
        } else if (u_scene == 7) {
            // Fourier-style harmonic synthesis is sampled into quantized
            // blocks: spoken signal becomes discrete, shippable structure.
            float amplitude = 0.08 * sin(p.x * 35.0 - t * 2.0)
                            + 0.035 * sin(p.x * 79.0 + t * 1.3);
            float taper = 1.0 - smoothstep(-0.18, 0.18, p.x);
            a = stroke(p.y - amplitude * taper, 0.003) * step(p.x, 0.1);
            for (int i = 0; i < 5; i++) {
                float x = 0.13 + float(i % 3) * 0.115;
                float y = (float(i / 3) - 0.5) * 0.18;
                b += stroke(box(p - vec2(x, y), vec2(0.048, 0.055)), 0.002);
                c += fill(box(p - vec2(x, y), vec2(0.038, 0.044))) * 0.30;
            }
        } else if (u_scene == 8) {
            // A deterministic Markov-style transition table sends each reel
            // through a long near-match state, then back to the start.
            b = stroke(box(p, vec2(0.38, 0.32)), 0.003);
            for (int i = 0; i < 3; i++) {
                vec2 q = p - vec2((float(i) - 1.0) * 0.235, 0.0);
                float angle = atan(q.y, q.x);
                float stepIndex = floor(t * 0.34);
                float state = mod(stepIndex + float(i == 2 ? 1 : 0), 5.0) / 5.0;
                float gap = 1.0 - smoothstep(0.13, 0.17, abs(atan(sin(angle - state * 6.283), cos(angle - state * 6.283))));
                a += ring(q, 0.09, 0.008) * gap;
                c += ring(q, 0.11, 0.0015) * 0.5;
            }
        } else if (u_scene == 9) {
            // Min-cost flow: choose the cheapest input edge at each tick;
            // its packet moves through the order book before costs change.
            vec2 hub = vec2(0.0, 0.0);
            float minimum = 10.0;
            for (int i = 0; i < 3; i++) {
                float cost = float(i) * 0.24 + 0.18 * sin(t * 0.4 + float(i) * 2.0);
                minimum = min(minimum, cost);
            }
            for (int i = 0; i < 3; i++) {
                float angle = float(i) * 2.094395 + 1.570796;
                vec2 source = vec2(cos(angle) * 0.38, sin(angle) * 0.29);
                float cost = float(i) * 0.24 + 0.18 * sin(t * 0.4 + float(i) * 2.0);
                float winner = 1.0 - step(0.001, cost - minimum);
                b += stroke(segment(p, source, hub), 0.003) * (0.45 + winner * 0.65);
                vec2 packet = mix(source, hub, fract(t * (0.11 + winner * 0.08) + float(i) * 0.29));
                a += fill(length(p - packet) - 0.012) * (0.5 + winner * 0.5);
                c += ring(p - source, 0.036, 0.002);
            }
            a += stroke(box(p, vec2(0.078, 0.085)), 0.004);
        } else if (u_scene == 10) {
            // FLIP transform: a card's First and Last rectangles interpolate
            // while the rest of the product grid stays spatially stable.
            for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
                vec2 center = vec2(float(x) * 0.145 - 0.18, float(y) * 0.145);
                float card = box(p - center, vec2(0.06, 0.06));
                b += stroke(card, 0.002) * 0.65;
                c += fill(card + 0.012) * 0.14;
            }
            float progress = 0.5 + 0.5 * sin(t * 0.6);
            vec2 center = mix(vec2(-0.18, 0.0), vec2(0.245, 0.0), progress);
            vec2 size = mix(vec2(0.061), vec2(0.17, 0.205), progress);
            a += stroke(box(p - center, size), 0.005);
            a += fill(box(p - center, size - 0.012)) * 0.19;
            b += stroke(segment(p, vec2(-0.10, 0.12), center + vec2(-size.x, size.y)), 0.001) * progress;
        }

        color = mix(color, u_secondary, clamp(b * 0.65, 0.0, 1.0));
        color = mix(color, u_accent, clamp(a * 0.9, 0.0, 1.0));
        color = mix(color, u_ink, clamp(c * 0.65, 0.0, 1.0));

        // One treatment algebra, selected per scene. It behaves consistently
        // across themes because it changes coverage/luminance, not named hues.
        if (u_scene == 2 || u_scene == 5 || u_scene == 6) {
            float dot = length(fract(gl_FragCoord.xy / 5.0) - 0.5);
            color = mix(color, u_accent, (1.0 - smoothstep(0.28, 0.34, dot)) * a * 0.22); // halftone
        }
        if (u_scene == 3 || u_scene == 4 || u_scene == 7) {
            float threshold = hash21(floor(gl_FragCoord.xy / 4.0));
            color = mix(color, u_secondary, step(threshold, clamp(b, 0.0, 1.0)) * 0.12); // ordered signal dither
        }
        if (u_scene == 1 || u_scene == 8) {
            color *= 0.97 + 0.03 * sin(gl_FragCoord.y * 1.2); // TV raster
        }
        color += (valueNoise(gl_FragCoord.xy * 0.35 + t * 0.3) - 0.5) * 0.018;
        outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }`;

    const instances = new Map();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const swatch = probe.getContext('2d', { willReadFrequently: true });
    function color(properties, fallback) {
        if (!swatch) return [0.5, 0.5, 0.5];
        const style = getComputedStyle(document.documentElement);
        const bodyStyle = getComputedStyle(document.body);
        const value = properties.map(name => style.getPropertyValue(name).trim() || bodyStyle.getPropertyValue(name).trim()).find(Boolean);
        swatch.fillStyle = fallback;
        try { if (value) swatch.fillStyle = value; } catch { /* keep fallback */ }
        swatch.fillRect(0, 0, 1, 1);
        return [...swatch.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => channel / 255);
    }
    const palette = () => ({
        paper: color(['--ctp-mantle', '--paper'], '#f5f2eb'),
        ink: color(['--ctp-text', '--ink'], '#30263a'),
        accent: color(['--accent', '--plum'], '#795477'),
        secondary: color(['--ctp-blue', '--ink-soft'], '#6480a2'),
        tertiary: color(['--ctp-pink', '--plum'], '#b56b93'),
    });
    function shader(gl, kind, source) {
        const part = gl.createShader(kind);
        gl.shaderSource(part, source);
        gl.compileShader(part);
        if (gl.getShaderParameter(part, gl.COMPILE_STATUS)) return part;
        console.warn('Article hero shader:', gl.getShaderInfoLog(part));
        gl.deleteShader(part);
        return null;
    }
    function setup(figure) {
        if (instances.has(figure)) return;
        const canvas = figure.querySelector('.article-hero-canvas');
        const scene = SLUGS.indexOf(figure.dataset.articleHero);
        if (scene < 0) return;
        const gl = canvas.getContext('webgl2', { alpha: false, powerPreference: 'low-power' });
        if (!gl) return; // The server-rendered SVG remains visible.
        const vs = shader(gl, gl.VERTEX_SHADER, VERTEX);
        const fs = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
        if (!vs || !fs) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); return; }
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn('Article hero program:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return;
        }
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const aPosition = gl.getAttribLocation(program, 'a_position');
        const uniforms = Object.fromEntries(['resolution', 'pointer', 'time', 'scene', 'paper', 'ink', 'accent', 'secondary', 'tertiary']
            .map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
        const pointer = [0.5, 0.5];
        let raf = 0, visible = false, disposed = false, last = -Infinity;
        let colors = palette();
        const resize = () => {
            const dpr = Math.min(devicePixelRatio || 1, 1.5);
            const scale = Math.min(1, 960 / Math.max(figure.clientWidth * dpr, figure.clientHeight * dpr));
            const w = Math.max(1, Math.round(figure.clientWidth * dpr * scale));
            const h = Math.max(1, Math.round(figure.clientHeight * dpr * scale));
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        };
        const draw = (time) => {
            if (disposed || !figure.isConnected || gl.isContextLost()) return;
            resize();
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(program);
            gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
            gl.uniform2f(uniforms.pointer, ...pointer);
            gl.uniform1f(uniforms.time, reduced.matches ? 0 : time * 0.001);
            gl.uniform1i(uniforms.scene, scene);
            for (const key of ['paper', 'ink', 'accent', 'secondary', 'tertiary']) gl.uniform3f(uniforms[key], ...colors[key]);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(aPosition);
            gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            figure.dataset.renderer = 'webgl';
        };
        const tick = (time) => {
            if (disposed || !visible || document.hidden) { raf = 0; return; }
            if (time - last >= 40 || reduced.matches) { draw(time); last = time; }
            raf = reduced.matches ? 0 : requestAnimationFrame(tick);
        };
        const start = () => {
            if (disposed || !visible || document.hidden) return;
            if (reduced.matches) draw(0);
            else if (!raf) raf = requestAnimationFrame(tick);
        };
        const stop = () => { cancelAnimationFrame(raf); raf = 0; };
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) start(); else stop();
        }, { rootMargin: '100px' });
        observer.observe(figure);
        const resizeObserver = new ResizeObserver(() => { if (visible && reduced.matches) draw(0); });
        resizeObserver.observe(figure);
        const lifetime = new AbortController();
        const signal = lifetime.signal;
        figure.addEventListener('pointermove', event => {
            const rect = figure.getBoundingClientRect();
            pointer[0] = (event.clientX - rect.left) / rect.width;
            pointer[1] = 1 - (event.clientY - rect.top) / rect.height;
        }, { passive: true, signal });
        window.addEventListener('engmanager:themechange', () => { colors = palette(); if (visible && reduced.matches) draw(0); }, { signal });
        window.addEventListener('pageshow', start, { signal });
        document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); }, { signal });
        reduced.addEventListener('change', () => { stop(); start(); }, { signal });
        canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); stop(); delete figure.dataset.renderer; }, { signal });
        canvas.addEventListener('webglcontextrestored', () => {
            const dispose = instances.get(figure);
            if (dispose) { dispose(); instances.delete(figure); }
            setup(figure);
        }, { signal });
        instances.set(figure, () => {
            disposed = true;
            stop(); observer.disconnect(); resizeObserver.disconnect(); lifetime.abort();
            gl.deleteBuffer(buffer); gl.deleteProgram(program);
            delete figure.dataset.renderer;
        });
    }
    function unmount() { for (const dispose of instances.values()) dispose(); instances.clear(); }
    function mount(root = document) {
        for (const [figure, dispose] of instances) if (!figure.isConnected) { dispose(); instances.delete(figure); }
        root.querySelectorAll('[data-article-hero]').forEach(setup);
    }
    mount();
    window.__engNav?.onBeforeSwap?.(unmount);
    window.__engNav?.onSwap?.(mount);
})();
