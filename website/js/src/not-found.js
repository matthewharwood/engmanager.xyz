const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.min.js";
const COLORS = ["#fe640b", "#e64553", "#ea76cb", "#8839ef", "#1e66f5"];

const stage = document.querySelector("[data-404-stage]");
const bouncer = document.querySelector("[data-404-bouncer]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (stage && canUseWebGL()) {
    bootPyramid(stage).catch((error) => {
        console.error("404 pyramid failed", error);
        stage.dataset.failed = "true";
        bootFallbackPyramid(stage);
    });
} else if (stage) {
    stage.dataset.failed = "true";
    bootFallbackPyramid(stage);
}

if (bouncer) {
    bootBouncer(bouncer);
}

async function bootPyramid(canvas) {
    const THREE = await import(THREE_URL);

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.28, 6.2);

    const group = new THREE.Group();
    group.rotation.x = -0.08;
    scene.add(group);

    const geometry = makePyramidGeometry(THREE);
    const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        uniforms: {
            uTime: { value: 0 },
            uPeach: { value: new THREE.Color("#fe640b") },
            uMaroon: { value: new THREE.Color("#e64553") },
            uPink: { value: new THREE.Color("#ea76cb") },
            uMauve: { value: new THREE.Color("#8839ef") },
            uBlue: { value: new THREE.Color("#1e66f5") },
            uInk: { value: new THREE.Color("#11111b") },
        },
        vertexShader: `
            varying vec3 vPos;
            varying vec3 vNormal;

            void main() {
                vPos = position;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            precision highp float;

            uniform float uTime;
            uniform vec3 uPeach;
            uniform vec3 uMaroon;
            uniform vec3 uPink;
            uniform vec3 uMauve;
            uniform vec3 uBlue;
            uniform vec3 uInk;

            varying vec3 vPos;
            varying vec3 vNormal;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                    f.y
                );
            }

            vec3 palette(float t) {
                t = fract(t);
                if (t < 0.22) {
                    return mix(uPeach, uMaroon, smoothstep(0.0, 0.22, t));
                }
                if (t < 0.44) {
                    return mix(uMaroon, uPink, smoothstep(0.22, 0.44, t));
                }
                if (t < 0.65) {
                    return mix(uPink, uMauve, smoothstep(0.44, 0.65, t));
                }
                if (t < 0.84) {
                    return mix(uMauve, uBlue, smoothstep(0.65, 0.84, t));
                }
                return mix(uBlue, uPeach, smoothstep(0.84, 1.0, t));
            }

            void main() {
                float diagonal = dot(vPos, normalize(vec3(0.95, 0.52, -0.38)));
                float t = diagonal * 0.28 + 0.58 + sin(uTime * 0.24) * 0.04;
                vec3 color = palette(t);

                float warmBand = smoothstep(-0.14, 0.1, vPos.y + vPos.x * 0.3 - vPos.z * 0.16)
                    * (1.0 - smoothstep(0.28, 0.7, vPos.y + vPos.x * 0.3 - vPos.z * 0.16));
                color = mix(color, uPeach, warmBand * 0.55);

                float facing = clamp(dot(normalize(vNormal), normalize(vec3(-0.25, 0.55, 0.78))), 0.0, 1.0);
                color *= 0.68 + facing * 0.5;

                float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
                color = mix(color, vec3(1.0), rim * 0.14);

                float grain = (noise(gl_FragCoord.xy * 0.72 + uTime * 11.0) - 0.5) * 0.075;
                color += grain;

                gl_FragColor = vec4(color, 0.98);
            }
        `,
    });

    const pyramid = new THREE.Mesh(geometry, material);
    group.add(pyramid);

    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 8),
        new THREE.LineBasicMaterial({
            color: 0xf5e0dc,
            transparent: true,
            opacity: 0.82,
        }),
    );
    edges.scale.setScalar(1.002);
    group.add(edges);

    const eye = makeEye(THREE);
    group.add(eye);

    const baseGlow = new THREE.Mesh(
        new THREE.CircleGeometry(1.65, 72),
        new THREE.MeshBasicMaterial({
            color: 0x1e66f5,
            transparent: true,
            opacity: 0.1,
            depthWrite: false,
        }),
    );
    baseGlow.position.set(0, -1.18, 0);
    baseGlow.rotation.x = -Math.PI / 2;
    group.add(baseGlow);

    const resize = () => {
        const width = Math.max(1, window.innerWidth);
        const height = Math.max(1, window.innerHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const scale = Math.min(1.45, Math.max(0.86, Math.min(width, height) / 520));
        group.scale.setScalar(scale);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const clock = new THREE.Clock();
    const render = () => {
        const elapsed = clock.getElapsedTime();
        material.uniforms.uTime.value = elapsed;
        group.rotation.y = reducedMotion ? -0.42 : elapsed * 0.22;
        eye.children.forEach((child, index) => {
            child.material.opacity = index === 1
                ? 0.84 + Math.sin(elapsed * 1.6) * 0.12
                : child.material.opacity;
        });
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    };
    render();
}

function canUseWebGL() {
    try {
        const canvas = document.createElement("canvas");
        return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
        return false;
    }
}

function makePyramidGeometry(THREE) {
    const apex = [0, 1.34, 0];
    const nw = [-1.25, -1.05, -1.25];
    const ne = [1.25, -1.05, -1.25];
    const se = [1.25, -1.05, 1.25];
    const sw = [-1.25, -1.05, 1.25];
    const positions = new Float32Array([
        ...apex, ...sw, ...se,
        ...apex, ...se, ...ne,
        ...apex, ...ne, ...nw,
        ...apex, ...nw, ...sw,
        ...sw, ...nw, ...ne,
        ...sw, ...ne, ...se,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
}

function makeEye(THREE) {
    const group = new THREE.Group();
    group.position.set(0, -0.02, 0.79);
    group.rotation.x = -0.45;

    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xf9e2af,
        transparent: true,
        opacity: 0.94,
        depthTest: true,
    });
    const pupilMaterial = new THREE.MeshBasicMaterial({
        color: 0x11111b,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xfe640b,
        transparent: true,
        opacity: 0.22,
        depthTest: true,
    });

    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 48), glowMaterial);
    glow.scale.set(1.55, 0.48, 1);
    glow.position.z = 0.012;
    group.add(glow);

    const eye = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.18, 48), ringMaterial);
    eye.scale.set(1.78, 0.58, 1);
    eye.position.z = 0.018;
    group.add(eye);

    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.055, 32), pupilMaterial);
    pupil.scale.set(1, 1.2, 1);
    pupil.position.z = 0.026;
    group.add(pupil);

    return group;
}

function bootBouncer(node) {
    let x = window.innerWidth * 0.46;
    let y = window.innerHeight * 0.72;
    let vx = 0.065;
    let vy = 0.052;
    let last = performance.now();
    let colorIndex = 0;

    const paint = () => {
        node.style.setProperty("--bouncer-bg", COLORS[colorIndex % COLORS.length]);
        node.style.setProperty("--bouncer-fg", colorIndex % COLORS.length === 4 ? "#eff1f5" : "#11111b");
    };
    paint();

    const bounce = (now) => {
        const dt = Math.min(48, now - last);
        last = now;

        const rect = node.getBoundingClientRect();
        const maxX = Math.max(0, window.innerWidth - rect.width - 8);
        const maxY = Math.max(0, window.innerHeight - rect.height - 8);

        if (!reducedMotion) {
            x += vx * dt;
            y += vy * dt;
        }

        if (x <= 8 || x >= maxX) {
            x = Math.min(maxX, Math.max(8, x));
            vx *= -1;
            colorIndex += 1;
            paint();
        }
        if (y <= 8 || y >= maxY) {
            y = Math.min(maxY, Math.max(8, y));
            vy *= -1;
            colorIndex += 1;
            paint();
        }

        node.style.setProperty("--bouncer-x", `${x}px`);
        node.style.setProperty("--bouncer-y", `${y}px`);
        requestAnimationFrame(bounce);
    };

    requestAnimationFrame(bounce);
}

function bootFallbackPyramid(sourceCanvas) {
    let canvas = sourceCanvas;
    let ctx = canvas.getContext("2d");
    if (!ctx) {
        canvas = sourceCanvas.cloneNode(false);
        sourceCanvas.replaceWith(canvas);
        ctx = canvas.getContext("2d");
    }
    if (!ctx) return;

    const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
        canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const drawFace = (points, stops, edge) => {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, points[0][1], window.innerWidth, window.innerHeight);
        stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    };

    const render = (time = 0) => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        ctx.clearRect(0, 0, width, height);

        const t = reducedMotion ? 0.7 : time * 0.00022;
        const turn = Math.cos(t);
        const centerX = width * 0.5;
        const topY = height * 0.21;
        const baseY = height * 0.94;
        const half = Math.min(width * 0.64, height * 0.52);
        const skew = turn * half * 0.38;
        const apex = [centerX + skew * 0.18, topY];
        const left = [centerX - half - skew, baseY];
        const right = [centerX + half - skew, baseY];
        const seam = [centerX - skew * 0.42, baseY];

        drawFace([apex, left, seam], [
            [0, "#1e66f5"],
            [0.42, "#ea76cb"],
            [0.72, "#e64553"],
            [1, "#11111b"],
        ], "rgb(245 224 220 / 0.58)");
        drawFace([apex, seam, right], [
            [0, "#8839ef"],
            [0.36, "#e64553"],
            [0.58, "#fe640b"],
            [1, "#1e66f5"],
        ], "rgb(245 224 220 / 0.7)");

        const eyeX = centerX + half * 0.23 - skew * 0.65;
        const eyeY = topY + (baseY - topY) * 0.58;
        ctx.save();
        ctx.translate(eyeX, eyeY);
        ctx.rotate(-0.04);
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = "#fe640b";
        ctx.beginPath();
        ctx.ellipse(0, 0, width * 0.15, height * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#f9e2af";
        ctx.beginPath();
        ctx.ellipse(0, 0, width * 0.085, height * 0.027, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#11111b";
        ctx.beginPath();
        ctx.ellipse(width * 0.012, 0, width * 0.018, height * 0.024, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
}
