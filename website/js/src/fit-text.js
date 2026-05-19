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
//     event. If it falls below MIN_FONT_SIZE_PX (16px), add .is-too-small
//     to the SVG. CSS hides the SVG and reveals the .article-fluid-fallback
//     <span>, which renders the title at 16px with text-overflow: ellipsis.
//
// References:
//   https://css-tricks.com/fitting-text-to-a-container/
//   https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics

const MIN_FONT_SIZE_PX = 16;

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

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
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
    const text = svg.querySelector("text");
    if (!text) return;
    text.setAttribute("x", ink.boxLeft);
    text.setAttribute("y", ink.ascent);
    svg.setAttribute("viewBox", `0 0 ${ink.inkWidth} ${ink.inkHeight}`);
}

function checkSize(svg, ink) {
    if (!svg.classList.contains("article-fluid-svg")) return;
    const containerWidth = svg.getBoundingClientRect().width;
    if (!containerWidth) return;
    const effectivePx = ink.fontSize * (containerWidth / ink.inkWidth);
    svg.classList.toggle("is-too-small", effectivePx < MIN_FONT_SIZE_PX);
}

// Writes the SVG's actual rendered height to a CSS custom property on
// the enclosing .article-fluid-link, so the brutalist checkbox can
// size itself proportionally to the title it sits beside (and re-size
// on every viewport change). No-op for the ENG MANAGER headline,
// which isn't wrapped in a link.
function syncTitleHeight(svg) {
    const link = svg.closest(".article-fluid-link");
    if (!link) return;
    const h = svg.getBoundingClientRect().height;
    if (h > 0) link.style.setProperty("--title-h", `${h}px`);
}

(async () => {
    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        const svgs = document.querySelectorAll("svg.fluid-display-svg");
        const measurements = new Map();
        for (const svg of svgs) {
            const text = svg.querySelector("text");
            if (!text) continue;
            const ink = measureInk(text);
            if (!ink) continue;
            applyFit(svg, ink);
            measurements.set(svg, ink);
            checkSize(svg, ink);
            syncTitleHeight(svg);
        }

        // Re-evaluate the min-size check + title-height var on viewport
        // resize. The fit (viewBox) doesn't need re-running — it's
        // container-relative via SVG scaling.
        let pending = false;
        const onResize = () => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                for (const [svg, ink] of measurements) {
                    checkSize(svg, ink);
                    syncTitleHeight(svg);
                }
            });
        };
        window.addEventListener("resize", onResize);
    } catch (_err) {
        // Measurement failed — leave the fallback viewBox in place.
    }
})();
