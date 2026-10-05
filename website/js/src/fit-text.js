// Build-time CSS bindings. Identity forms keep direct-source tests readable;
// build.rs replaces calls with literals and Oxc removes unused helpers.
var cssClasses = value => value, cssSelector = value => value, cssToken = value => value, cssHtml = value => value;

// Fits SVG text to its container with ink-tight bounds, so the rendered
// glyphs are flush with the SVG's edges (no left/right side-bearing gap).
//
// Approach: use Canvas measureText on the same font/size/weight as the SVG
// text. Canvas exposes actualBoundingBox{Left,Right,Ascent,Descent}, which
// are the precise ink-coverage extents — unlike SVG's getBBox() which on
// many browsers returns the layout box including side-bearing whitespace.
//
// Pipeline per <svg.fluid-display-svg>:
//   1. Shift the <text> by (boxLeft, ascent) so its ink corner lands at (0,0).
//   2. Set viewBox to the exact ink rectangle. The SVG element is sized in
//      normal flow (inline-size: 100%, block-size: auto) so it fills its
//      container with the ink's natural aspect ratio.
//
// Minimum font-size enforcement (article-fluid-svg only):
//   - Effective rendered font-size at the current container width =
//     fontSize * (containerWidth / inkWidth). Compute that on every layout
//     event. If it falls below MIN_FONT_SIZE_PX (20px), add .is-too-small
//     to the SVG. CSS hides the SVG and reveals the .article-fluid-fallback
//     <span>, which renders the title at 20px with text-overflow: ellipsis.
//
// References:
//   https://css-tricks.com/fitting-text-to-a-container/
//   https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics

const MIN_FONT_SIZE_PX = 20;
let textContext;

// Convert a font-family attribute value into a Canvas-safe family list.
// Family names containing whitespace need quotes for the CSS font shorthand.
function quoteFamilies(value) {
    return value
        .split(",")
        .map((f) => f.trim())
        .map((f) => (/\s/.test(f) && !/^["']/.test(f) ? `"${f}"` : f))
        .join(", ");
}

function measureInk(text) {
    const content = (text.textContent || "").trim();
    if (!content) return null;

    const fontSize = parseFloat(text.getAttribute("font-size")) || 144;
    const fontFamily = quoteFamilies(
        text.getAttribute("font-family") || "sans-serif",
    );
    const fontWeight = text.getAttribute("font-weight") || "normal";

    // One measurement context serves the whole outlet. Creating a canvas for
    // every feed row adds allocation work to the page promotion.
    const ctx = (textContext ||= document.createElement("canvas").getContext("2d"));
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const m = ctx.measureText(content);

    const inkWidth = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const inkHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (!inkWidth || !inkHeight) return null;

    return {
        boxLeft: m.actualBoundingBoxLeft,
        ascent: m.actualBoundingBoxAscent,
        inkWidth,
        inkHeight,
        fontSize,
    };
}

function applyFit(svg, ink) {
    const text = svg.querySelector(cssSelector("text"));
    if (!text) return;
    text.setAttribute("x", ink.boxLeft);
    text.setAttribute("y", ink.ascent);
    svg.setAttribute("viewBox", `0 0 ${ink.inkWidth} ${ink.inkHeight}`);
}

function setPx(el, name, value) {
    const next = `${Math.round(value * 100) / 100}px`;
    if (el.style.getPropertyValue(name) !== next) {
        el.style.setProperty(name, next);
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Writes the fitted title metrics to CSS custom properties on the
// enclosing .article-fluid-link. The checkbox and strike-through then
// size from the same measured font scale as the SVG/fallback title,
// instead of from a fixed mobile clamp.
function titleWidth(svg) {
    const wrap = svg.closest(cssSelector(".fluid-display-wrap"));
    return (wrap || svg).getBoundingClientRect().width;
}

function syncTitleMetrics(svg, ink, containerWidth) {
    const link = svg.closest(cssSelector(".article-fluid-link"));
    if (!link) return false;

    if (!containerWidth) return false;

    const scale = containerWidth / ink.inkWidth;
    const effectivePx = ink.fontSize * scale;
    const renderedInkHeight = ink.inkHeight * scale;
    const usesFallback =
        effectivePx < MIN_FONT_SIZE_PX || renderedInkHeight < MIN_FONT_SIZE_PX;
    const visibleFontPx = usesFallback ? MIN_FONT_SIZE_PX : effectivePx;
    const lineBoxPx = usesFallback ? visibleFontPx * 1.25 : renderedInkHeight;

    const checkSize = clamp(lineBoxPx * 0.92, 26, 72);
    const strikeSize = clamp(visibleFontPx * 0.11, 2, 8);
    const strikeHalo = clamp(strikeSize * 0.45, 1, 3);

    setPx(link, "--title-h", lineBoxPx);
    setPx(link, "--title-check-size", checkSize);
    setPx(link, "--title-strike-size", strikeSize);
    setPx(link, "--title-strike-halo", strikeHalo);

    return usesFallback;
}

// fit(root): measure + fit every not-yet-fitted svg under root, pruning
// detached entries first so the measurements Map never pins old-page
// SVGs (JS_ROUTER_CONSTRAINTS §2.3). Called once at load and again on
// every soft navigation.
(() => {
    const measurements = new Map();

    // Re-evaluate the fallback threshold and fitted title metrics
    // whenever row width changes. The fit (viewBox) doesn't need
    // re-running — it's container-relative via SVG scaling.
    let resizeFrame = 0;
    const onResize = () => {
        if (resizeFrame) return;
        resizeFrame = requestAnimationFrame(() => {
            resizeFrame = 0;
            const updates = [];
            for (const [svg, ink] of measurements) {
                if (!svg.isConnected) {
                    measurements.delete(svg);
                    continue;
                }
                updates.push({ svg, ink, width: titleWidth(svg) });
            }
            // Read the widths together before any SVG/style mutation. One
            // dirty row must not force layout before measuring the next row.
            for (const { svg, ink, width } of updates) {
                const usesFallback = syncTitleMetrics(svg, ink, width);
                svg.classList.toggle(cssToken("is-too-small"), usesFallback);
            }
        });
    };
    window.addEventListener("resize", onResize);

    const observer =
        "ResizeObserver" in window ? new ResizeObserver(onResize) : null;
    let generation = 0;

    async function fit(root) {
        const run = ++generation;
        try {
            if (window.__engTypography) {
                await window.__engTypography.displayReady;
            } else if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            if (run !== generation) return;
            for (const svg of measurements.keys()) {
                if (!svg.isConnected) measurements.delete(svg);
            }
            const fitted = [];
            for (const svg of root.querySelectorAll(cssSelector("svg.fluid-display-svg"))) {
                if (measurements.has(svg)) continue;
                const text = svg.querySelector(cssSelector("text"));
                if (!text) continue;
                const ink = measureInk(text);
                if (!ink) continue;
                fitted.push({ svg, ink, width: titleWidth(svg) });
            }
            for (const { svg, ink, width } of fitted) {
                applyFit(svg, ink);
                measurements.set(svg, ink);
                const usesFallback = syncTitleMetrics(svg, ink, width);
                svg.classList.toggle(cssToken("is-too-small"), usesFallback);
                observer?.observe(svg.closest(cssSelector(".fluid-display-wrap")) || svg);
            }
        } catch (_err) {
            // Measurement failed — leave the fallback viewBox in place.
        }
    }

    fit(document);
    window.addEventListener("engmanager:fontchange", (event) => {
        if (event.detail?.role !== "display") return;
        // Measurements taken with a fallback face are invalid after recovery.
        observer?.disconnect();
        measurements.clear();
        fit(document);
    });
    window.__engNav?.onBeforeSwap?.(() => {
        generation++;
        cancelAnimationFrame(resizeFrame);
        resizeFrame = 0;
        observer?.disconnect();
        measurements.clear();
    });
    window.__engNav?.onSwap?.(fit);
})();
