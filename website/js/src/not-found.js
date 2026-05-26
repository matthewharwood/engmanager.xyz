const stage = document.querySelector("[data-404-stage]");
const bouncer = document.querySelector("[data-404-bouncer]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (stage) {
    stage.addEventListener("wisp404failed", () => {
        bootFallbackOnce(stage);
    }, { once: true });
}

if (stage && canUseWebGPU()) {
    bootWispPyramid(stage).catch((error) => {
        console.error("404 pyramid failed", error);
        bootFallbackOnce(stage);
    });
} else if (stage) {
    bootFallbackOnce(stage);
}

if (bouncer) {
    bootBouncer(bouncer);
}

async function bootWispPyramid(canvas) {
    const config = window.__wisp404 || {};
    if (!config.js || !config.wasm) {
        throw new Error("missing Wisp3D bundle config");
    }
    canvas.dataset.renderer = "wisp3d";
    const module = await import(config.js);
    await module.default({ module_or_path: config.wasm });
    syncWispPalette(module);
    window.addEventListener("engmanager:themechange", () => syncWispPalette(module));
}

function bootFallbackOnce(canvas) {
    if (canvas.dataset.fallbackBooted === "true") return;
    canvas.dataset.fallbackBooted = "true";
    canvas.dataset.failed = "true";
    bootFallbackPyramid(canvas);
}

function canUseWebGPU() {
    return !!navigator.gpu;
}

function bootBouncer(node) {
    let x = window.innerWidth * 0.46;
    let y = window.innerHeight * 0.72;
    let vx = 0.065;
    let vy = 0.052;
    let last = performance.now();
    let colorIndex = 0;

    const paint = () => {
        const themeIndex = colorIndex % 5;
        node.style.setProperty("--bouncer-bg", `var(--not-found-bouncer-bg-${themeIndex})`);
        node.style.setProperty("--bouncer-fg", `var(--not-found-bouncer-fg-${themeIndex})`);
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
        const palette = themePalette();
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
            [0, palette[3]],
            [0.42, palette[2]],
            [0.72, palette[1]],
            [1, palette.surface],
        ], palette.edgeSoft);
        drawFace([apex, seam, right], [
            [0, palette[0]],
            [0.36, palette[1]],
            [0.58, palette[4]],
            [1, palette[3]],
        ], palette.edgeStrong);

        const eyeX = centerX + half * 0.23 - skew * 0.65;
        const eyeY = topY + (baseY - topY) * 0.58;
        ctx.save();
        ctx.translate(eyeX, eyeY);
        ctx.rotate(-0.04);
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = palette[4];
        ctx.beginPath();
        ctx.ellipse(0, 0, width * 0.15, height * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = palette[2];
        ctx.beginPath();
        ctx.ellipse(0, 0, width * 0.085, height * 0.027, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.surface;
        ctx.beginPath();
        ctx.ellipse(width * 0.012, 0, width * 0.018, height * 0.024, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
}

function syncWispPalette(module) {
    if (typeof module.set_theme_palette !== "function") return;
    const palette = themePalette();
    module.set_theme_palette(palette[0], palette[1], palette[2], palette[3], palette[4]);
}

function themePalette() {
    const colors = [
        themeColor("--not-found-pyramid-0", "#fe640b"),
        themeColor("--not-found-pyramid-1", "#e64553"),
        themeColor("--not-found-pyramid-2", "#ea76cb"),
        themeColor("--not-found-pyramid-3", "#8839ef"),
        themeColor("--not-found-pyramid-4", "#1e66f5"),
    ];
    colors.surface = themeColor("--surface-1", "#11111b");
    colors.edgeSoft = colorMix("--text-1", 0.58, "rgb(245 224 220 / 0.58)");
    colors.edgeStrong = colorMix("--text-1", 0.7, "rgb(245 224 220 / 0.7)");
    return colors;
}

function themeColor(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return resolveColor(value || fallback, fallback);
}

function colorMix(name, alpha, fallback) {
    const color = themeColor(name, fallback);
    const rgb = color.match(/^rgba?\(([^)]+)\)$/);
    if (rgb) {
        const channels = rgb[1].split(/[,/ ]+/).filter(Boolean).slice(0, 3).join(" ");
        return `rgb(${channels} / ${alpha})`;
    }
    const oklch = color.match(/^oklch\(([^)]+)\)$/);
    if (oklch) {
        const channels = oklch[1].split("/")[0].trim();
        return `oklch(${channels} / ${alpha})`;
    }
    return fallback;
}

function resolveColor(value, fallback) {
    const probe = colorProbe();
    if (!probe) return fallback;
    probe.style.color = "";
    probe.style.color = value;
    return getComputedStyle(probe).color || fallback;
}

let colorProbeNode;
function colorProbe() {
    if (colorProbeNode?.isConnected) return colorProbeNode;
    if (!document.body) return null;
    colorProbeNode = document.createElement("span");
    colorProbeNode.hidden = true;
    colorProbeNode.setAttribute("aria-hidden", "true");
    document.body.append(colorProbeNode);
    return colorProbeNode;
}
