// Animated WebGL2 gradient-orb shader for the Auteurs article page.
//
// Refined from the original eng-manager-xyz.github.io shader:
//   - Catppuccin Latte palette (peach → maroon → pink → mauve → blue)
//   - smoothstep() between every color stop so there's no banding
//   - slowly rotating gradient direction (subtle motion, not just sliding)
//   - bilinear-interpolated hash noise instead of raw per-pixel hash —
//     gives a soft film grain instead of static
//   - DPR-aware canvas sizing for crisp render on retina
//   - self-guards: only activates if at least one .auteurs-shader canvas
//     exists, so this script is safe to load on every article page.

// Lifecycle (JS_ROUTER_CONSTRAINTS §2.12): every canvas tracks its rAF
// handle so a soft navigation away can cancel the render loop and
// release the WebGL context instead of leaking a GPU loop on a detached
// canvas; navigating onto the Auteurs article sets up the new canvases.

(function () {
    // canvas -> dispose()
    const instances = new Map();

    const VS = `#version 300 es
in vec4 a_position;
void main() {
    gl_Position = a_position;
}`;

    const FS = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
out vec4 outColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Bilinearly-interpolated value noise — softer than hash() per-pixel.
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i),                 hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
    );
}

void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / u_resolution.y;

    // Catppuccin Latte palette
    vec3 c_peach  = vec3(0.996, 0.392, 0.043);
    vec3 c_maroon = vec3(0.902, 0.271, 0.325);
    vec3 c_pink   = vec3(0.918, 0.463, 0.796);
    vec3 c_mauve  = vec3(0.533, 0.224, 0.937);
    vec3 c_blue   = vec3(0.118, 0.400, 0.961);

    float radius = 0.86;
    float dist = length(uv);

    // Slowly rotating gradient direction.
    float angle = u_time * 0.05;
    vec2 grad_dir = vec2(cos(angle), sin(angle));
    float grad_pos = dot(uv, grad_dir) * 0.5;

    // Animate the gradient along its current direction.
    float t = fract(grad_pos + u_time * 0.045);

    // Five color stops, smoothly interpolated.
    vec3 color;
    if (t < 0.2) {
        color = mix(c_peach,  c_maroon, smoothstep(0.0, 0.2, t));
    } else if (t < 0.4) {
        color = mix(c_maroon, c_pink,   smoothstep(0.2, 0.4, t));
    } else if (t < 0.6) {
        color = mix(c_pink,   c_mauve,  smoothstep(0.4, 0.6, t));
    } else if (t < 0.8) {
        color = mix(c_mauve,  c_blue,   smoothstep(0.6, 0.8, t));
    } else {
        color = mix(c_blue,   c_peach,  smoothstep(0.8, 1.0, t));
    }

    // Soft film grain.
    float grain = (noise(gl_FragCoord.xy * 0.5 + u_time * 30.0) - 0.5) * 0.06;
    color += grain;

    // Soft circle mask.
    float mask = smoothstep(radius, radius - 0.02, dist);

    outColor = vec4(color * mask, mask);
}`;

    function compile(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compile error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function makeProgram(gl) {
        const vs = compile(gl, VS, gl.VERTEX_SHADER);
        const fs = compile(gl, FS, gl.FRAGMENT_SHADER);
        if (!vs || !fs) return null;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program link error:", gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    function setup(canvas) {
        if (instances.has(canvas)) return;
        const gl = canvas.getContext("webgl2", {
            alpha: true,
            premultipliedAlpha: false,
        });
        if (!gl) return;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        const program = makeProgram(gl);
        if (!program) return;

        const aPos = gl.getAttribLocation(program, "a_position");
        const uRes = gl.getUniformLocation(program, "u_resolution");
        const uTime = gl.getUniformLocation(program, "u_time");

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]),
            gl.STATIC_DRAW,
        );

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
            const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
        }

        let raf = 0;
        function render(timeMs) {
            const t = timeMs * 0.001;
            resize();
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(program);
            gl.uniform2f(uRes, gl.canvas.width, gl.canvas.height);
            gl.uniform1f(uTime, t);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(aPos);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            raf = requestAnimationFrame(render);
        }
        raf = requestAnimationFrame(render);

        instances.set(canvas, () => {
            cancelAnimationFrame(raf);
            gl.getExtension("WEBGL_lose_context")?.loseContext();
        });
    }

    function init(root) {
        for (const [canvas, dispose] of instances) {
            if (!canvas.isConnected) {
                dispose();
                instances.delete(canvas);
            }
        }
        root.querySelectorAll("canvas.auteurs-shader").forEach(setup);
    }

    init(document);
    window.__engNav?.onSwap?.(init);
})();
