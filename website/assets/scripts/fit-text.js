// Fits SVG text to its container by setting the SVG's viewBox to the text's
// actual bounding box after web fonts have loaded.
//
// Follows the pattern in https://css-tricks.com/fitting-text-to-a-container/
// ("The SVG Way" + the June 2025 JS enhancement).
//
// Why this works:
//   - The <text> renders at a fixed user-space font-size (e.g. 144).
//   - getBBox() returns the text's natural width/height in user units.
//   - Setting viewBox = bbox makes the SVG's aspect ratio match the text exactly.
//   - With CSS `width: 100%; height: auto`, the SVG scales to fill its container
//     and the text scales with it — no clipping, no wrapping, no overflow.
//
// To cap the visible height we compute max-inline-size = (cap-height) * (aspect ratio).
const HEADLINE_CAP_REM = 9; // 9rem = 144px @ 16px root.

(async () => {
    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        const svgs = document.querySelectorAll("svg.fluid-display-svg");
        for (const svg of svgs) {
            const text = svg.querySelector("text");
            if (!text) continue;
            const bbox = text.getBBox();
            if (!bbox.width || !bbox.height) continue;
            svg.setAttribute(
                "viewBox",
                `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`,
            );
            const ratio = bbox.width / bbox.height;
            svg.style.maxInlineSize = `calc(${HEADLINE_CAP_REM}rem * ${ratio})`;
        }
    } catch (_err) {
        // Measurement failed — leave the fallback viewBox in place.
    }
})();
