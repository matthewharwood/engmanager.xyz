// Build-time CSS bindings. Identity forms keep direct-source tests readable;
// build.rs replaces calls with literals and Oxc removes unused helpers.
var cssClasses = value => value, cssSelector = value => value, cssToken = value => value, cssHtml = value => value;

// A shader paints the cloth, torn outline, and sharp projected shadow behind
// the real article controls. DOM rows follow the same low-amplitude wave.
(() => {
    const VERTEX = `#version 300 es
    in vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
    const FRAGMENT = `#version 300 es
    precision highp float;
    uniform vec2 u_resolution, u_size;
    uniform float u_time, u_shadow;
    uniform vec3 u_paper, u_ink;
    out vec4 outColor;

    float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
    float noise(float x) {
        float i = floor(x), f = fract(x);
        return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
    }
    float fray(float p, float seed) {
        return (noise(p * 0.09 + seed) - 0.5) * 3.5
             + (noise(p * 0.43 + seed) - 0.5) * 2.3
             + (noise(p * 1.7 + seed) - 0.5) * 0.9;
    }
    vec2 wave(vec2 p) {
        vec2 uv = p / u_size;
        float freeEdge = clamp(uv.y, 0.0, 1.0);
        return vec2(
            (1.8 + 4.4 * freeEdge) * sin(uv.y * 7.0 - u_time * 1.4)
                + 1.6 * sin(uv.y * 14.0 + u_time * 1.1),
            (1.0 + 1.4 * freeEdge) * sin(uv.x * 8.0 - u_time * 1.7 + uv.y * 3.0)
        );
    }
    float sheet(vec2 p) {
        p -= wave(p);
        // Independent, fixed noise along each edge reads as torn threads,
        // rather than an outline that boils or changes its tear every frame.
        vec4 edges = vec4(-p.x, p.x - u_size.x, -p.y, p.y - u_size.y);
        // Fraying only changes pixels close to an edge. Interior fragments
        // keep exactly the same fully opaque paper without evaluating all
        // twenty-four trigonometric hashes for an invisible torn outline.
        if (p.x < 8.0) edges.x += fray(p.y, 13.0);
        if (p.x > u_size.x - 8.0) edges.y += fray(p.y, 71.0);
        if (p.y < 8.0) edges.z += fray(p.x, 37.0);
        if (p.y > u_size.y - 8.0) edges.w += fray(p.x, 97.0);
        return max(max(edges.x, edges.y), max(edges.z, edges.w));
    }
    void main() {
        // All geometry is in CSS pixels, independent of canvas DPR.
        vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y)
               / u_resolution * (u_size + 48.0) - 24.0;
        vec2 shadowOffset = vec2(u_shadow + 2.4 * sin(u_time * 1.4),
                                 u_shadow + 2.0 * cos(u_time * 1.1));
        float d = sheet(p);
        // Deep inside the fabric the shifted shadow is also opaque and cannot
        // affect color/alpha. Keep its exact distance only near the torn edge.
        float sd = d < -u_shadow - 16.0 ? d : sheet(p - shadowOffset);
        float aa = max(fwidth(d), 0.55);
        float cloth = 1.0 - smoothstep(-aa, aa, d);
        float shadow = 1.0 - smoothstep(-aa, aa, sd);
        float interior = 1.0 - smoothstep(-3.4 - aa, -3.4 + aa, d);

        vec2 uv = (p - wave(p)) / u_size;
        float phase = uv.x * 11.0 + uv.y * 6.0 - u_time * 1.4;
        float crossFold = uv.x * 5.0 - uv.y * 9.0 + u_time * 1.1;
        vec3 normal = normalize(vec3(-0.20 * cos(phase) - 0.08 * cos(crossFold),
                                    -0.13 * cos(phase) + 0.12 * cos(crossFold), 1.0));
        float light = dot(normal, normalize(vec3(-0.5, -0.65, 1.0)));
        float fold = clamp((0.88 - light) * 0.28, 0.0, 0.10);
        // Faint woven fibers, kept well below the contrast of the copy.
        float weave = sin(p.x * 3.14159) * sin(p.y * 3.14159) * 0.006;
        vec3 fabric = mix(u_paper, u_ink, fold + 0.012 + weave);
        vec3 face = mix(u_ink, fabric, interior);
        float alpha = cloth + shadow * (1.0 - cloth);
        vec3 color = (face * cloth + u_ink * shadow * (1.0 - cloth)) / max(alpha, 0.001);
        outColor = vec4(color, alpha);
    }`;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    const instances = new Map();
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = 1;
    const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true });
    function color(value, fallback) {
        if (!colorContext) return fallback;
        colorContext.clearRect(0, 0, 1, 1);
        colorContext.fillStyle = value;
        colorContext.fillRect(0, 0, 1, 1);
        return [...colorContext.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => v / 255);
    }
    function compile(gl, kind, source) {
        const shader = gl.createShader(kind);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
        gl.deleteShader(shader);
        return null;
    }
    function setup(modal) {
        if (instances.has(modal)) return;
        const frame = modal.querySelector(cssSelector('.reveal-card-frame'));
        const canvas = frame?.querySelector(cssSelector('.reveal-card-cloth'));
        const content = frame?.querySelector(cssSelector('.reveal-card-surface'));
        if (!canvas || !content) return;
        const lifetime = new AbortController(), { signal } = lifetime;
        let gl, program, buffer, position, uniforms;
        let raf = 0, elapsed = 0, previous = 0, disposed = false;
        let width = 1, height = 1, shadow = 10, paper, ink, rows = [];
        const isOpen = () => modal.isConnected && modal.matches(cssSelector(':popover-open'));
        const resetPose = () => {
            frame.style.removeProperty('translate');
            frame.style.removeProperty('rotate');
            for (const row of content.children) row.style.removeProperty('transform');
        };
        const stop = () => {
            cancelAnimationFrame(raf); raf = 0; previous = 0;
            frame.dataset.clothMotion = 'paused';
        };
        const release = () => {
            stop(); resetPose();
            if (gl && !gl.isContextLost()) {
                if (buffer) gl.deleteBuffer(buffer);
                if (program) gl.deleteProgram(program);
            }
            program = buffer = null;
            delete frame.dataset.clothRenderer;
        };
        const initialize = () => {
            if (program) return true;
            if (forced.matches) return false;
            gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: 'low-power' });
            if (!gl || gl.isContextLost()) return false;
            const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
            const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
            if (!vs || !fs) {
                if (vs) gl.deleteShader(vs);
                if (fs) gl.deleteShader(fs);
                return false;
            }
            program = gl.createProgram();
            if (!program) { gl.deleteShader(vs); gl.deleteShader(fs); return false; }
            gl.attachShader(program, vs); gl.attachShader(program, fs);
            gl.linkProgram(program);
            gl.deleteShader(vs); gl.deleteShader(fs);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { release(); return false; }
            buffer = gl.createBuffer();
            if (!buffer) { release(); return false; }
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            position = gl.getAttribLocation(program, 'a_position');
            uniforms = Object.fromEntries(['resolution', 'size', 'time', 'shadow', 'paper', 'ink']
                .map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
            return true;
        };
        const measure = () => {
            width = frame.offsetWidth; height = frame.offsetHeight;
            rows = [...content.children].map(node => ({ node, y: node.offsetTop + node.offsetHeight / 2 }));
            // The live controls resolve theme colors even when the frame has
            // a transparent shader background. Canvas converts OKLCH to RGB.
            paper = color(getComputedStyle(modal.querySelector(cssSelector('.reveal-card-close'))).backgroundColor, [0.98, 0.98, 0.98]);
            ink = color(getComputedStyle(frame).color, [0.03, 0.03, 0.03]);
            shadow = parseFloat(getComputedStyle(frame).getPropertyValue('--reveal-card-shadow'));
            // clamp() remains unresolved in custom properties; the original
            // CSS shadow ranges from 6 to 10 CSS pixels with viewport width.
            shadow = Number.isFinite(shadow) ? shadow : Math.min(10, Math.max(6, innerWidth * 0.02));
            const dpr = Math.min(devicePixelRatio || 1, 1.5);
            const w = Math.max(1, Math.round((width + 48) * dpr));
            const h = Math.max(1, Math.round((height + 48) * dpr));
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
        };
        const draw = () => {
            if (!program || !width || !height || gl.isContextLost()) return;
            const time = reduced.matches ? 0 : elapsed;
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(program);
            gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
            gl.uniform2f(uniforms.size, width, height);
            gl.uniform1f(uniforms.time, time);
            gl.uniform1f(uniforms.shadow, shadow);
            gl.uniform3f(uniforms.paper, ...paper); gl.uniform3f(uniforms.ink, ...ink);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            if (frame.dataset.clothRenderer !== 'webgl') frame.dataset.clothRenderer = 'webgl';
            if (reduced.matches) { resetPose(); return; }
            frame.style.translate = `${(Math.sin(time * 0.7) * 1.5).toFixed(2)}px ${(Math.sin(time * 0.9) * 1.2).toFixed(2)}px`;
            frame.style.rotate = `${(Math.sin(time * 0.8) * 0.35).toFixed(3)}deg`;
            const scrollTop = content.scrollTop;
            for (const { node, y } of rows) {
                const v = Math.min(1, Math.max(0, (y - scrollTop) / height));
                const x = (1.8 + 4.4 * v) * Math.sin(v * 7 - time * 1.4) + 1.6 * Math.sin(v * 14 + time * 1.1);
                const dy = (1 + 1.4 * v) * Math.sin(4 - time * 1.7 + v * 3);
                node.style.transform = `translate(${x.toFixed(2)}px, ${dy.toFixed(2)}px)`;
            }
        };
        const tick = (now) => {
            raf = 0;
            if (disposed || !isOpen() || document.hidden || gl?.isContextLost()) { stop(); return; }
            if (previous) elapsed += Math.min(now - previous, 80) * 0.001;
            previous = now;
            // Animated controls and cloth share the display's vsync cadence.
            draw();
            raf = requestAnimationFrame(tick);
        };
        const start = () => {
            if (disposed || !isOpen() || document.hidden) return;
            if (forced.matches) { release(); return; }
            if (!initialize()) return;
            measure(); draw();
            frame.dataset.clothMotion = reduced.matches ? 'still' : 'running';
            if (!reduced.matches && !raf) raf = requestAnimationFrame(tick);
        };
        modal.addEventListener('toggle', event => {
            if (event.newState === 'open') { elapsed = 0; start(); }
            else { stop(); resetPose(); }
        }, { signal });
        const resize = new ResizeObserver(() => { if (isOpen() && program) { measure(); draw(); } });
        resize.observe(frame); resize.observe(content);
        window.addEventListener('engmanager:themechange', start, { signal });
        window.addEventListener('pageshow', start, { signal });
        window.addEventListener('pagehide', stop, { signal });
        document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); }, { signal });
        for (const media of [reduced, forced]) media.addEventListener('change', () => { stop(); start(); }, { signal });
        canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); release(); }, { signal });
        canvas.addEventListener('webglcontextrestored', start, { signal });
        instances.set(modal, () => { disposed = true; release(); resize.disconnect(); lifetime.abort(); });
        start();
    }
    const unmount = () => { for (const dispose of instances.values()) dispose(); instances.clear(); };
    const mount = () => {
        for (const [modal, dispose] of instances) if (!modal.isConnected) { dispose(); instances.delete(modal); }
        document.querySelectorAll(cssSelector('#article-reveal')).forEach(setup);
    };
    mount();
    window.__engNav?.onBeforeSwap?.(unmount);
    window.__engNav?.onSwap?.(mount);
})();
