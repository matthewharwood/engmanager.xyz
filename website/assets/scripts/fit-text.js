// Fits SVG text to its container with ink-tight bounds, so the rendered
// glyphs are flush with the SVG's edges (no left/right side-bearing gap).
//
// Approach: use Canvas measureText on the same font/size/weight as the SVG
// text. Canvas exposes actualBoundingBox{Left,Right,Ascent,Descent}, which
// are the precise ink-coverage extents — unlike SVG's getBBox() which on
// many browsers returns the layout box including side-bearing whitespace.
//
// We then:
//   1. Shift the <text> by (actualBoundingBoxLeft, actualBoundingBoxAscent)
//      so its ink corner lands at (0, 0) in SVG user space.
//   2. Set viewBox to exactly the ink rectangle.
//   3. Cap visible block-size at HEADLINE_CAP_REM by setting max-inline-size
//      to (cap-rem * ink aspect ratio).
//
// References:
//   https://css-tricks.com/fitting-text-to-a-container/
//   https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics
const HEADLINE_CAP_REM = 9; // 9rem = 144px @ 16px root.

// Convert a font-family attribute value into a Canvas-safe family list.
// Family names containing whitespace need quotes for the CSS font shorthand.
function quoteFamilies(value) {
    return value
        .split(",")
        .map((f) => f.trim())
        .map((f) => (/\s/.test(f) && !/^["']/.test(f) ? `"${f}"` : f))
        .join(", ");
}

(async () => {
    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        const svgs = document.querySelectorAll("svg.fluid-display-svg");
        for (const svg of svgs) {
            const text = svg.querySelector("text");
            if (!text) continue;

            const content = (text.textContent || "").trim();
            if (!content) continue;

            const fontSize = parseFloat(text.getAttribute("font-size")) || 144;
            const fontFamily = quoteFamilies(
                text.getAttribute("font-family") || "sans-serif",
            );
            const fontWeight = text.getAttribute("font-weight") || "normal";

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            const m = ctx.measureText(content);

            // Per spec, actualBoundingBoxLeft is the distance from the
            // alignment point to the LEFT edge of the ink bounding rect,
            // positive going left. Total ink width = left + right.
            const inkWidth = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
            const inkHeight =
                m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;

            if (!inkWidth || !inkHeight) continue;

            // Shift <text> so its ink corner lands at SVG (0, 0).
            // - text.x defaults to 0; ink left sits at -actualBoundingBoxLeft.
            //   Set text.x = actualBoundingBoxLeft so ink left = 0.
            // - text.y is the baseline; ink top sits at y - ascent.
            //   Set text.y = actualBoundingBoxAscent so ink top = 0.
            text.setAttribute("x", m.actualBoundingBoxLeft);
            text.setAttribute("y", m.actualBoundingBoxAscent);

            svg.setAttribute("viewBox", `0 0 ${inkWidth} ${inkHeight}`);
            const ratio = inkWidth / inkHeight;
            svg.style.maxInlineSize = `calc(${HEADLINE_CAP_REM}rem * ${ratio})`;
        }
    } catch (_err) {
        // Measurement failed — leave the fallback viewBox in place.
    }
})();
