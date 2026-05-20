// Comically-large custom cursor for the homepage.
//
// CSS cursor: url() caps at 128px in most browsers, so to get a genuine
// 8x scale we render an SVG arrow as a position: fixed element and translate
// it with the mouse. The native cursor is hidden via CSS while pointer
// movements are still captured normally — clicks, hovers, links all work.
//
// Self-guards: only activates inside <body class="homepage">.

(function () {
    if (!document.body || !document.body.classList.contains("homepage")) return;
    // Reduce-motion and pointer-coarse (touch) users get the default cursor.
    if (
        window.matchMedia &&
        (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
            window.matchMedia("(pointer: coarse)").matches)
    ) {
        return;
    }

    const SVG_NS = "http://www.w3.org/2000/svg";
    const SIZE = 256; // ~8x a typical 32px system cursor

    const cursor = document.createElementNS(SVG_NS, "svg");
    cursor.setAttribute("class", "big-cursor");
    cursor.setAttribute("width", String(SIZE));
    cursor.setAttribute("height", String(SIZE));
    cursor.setAttribute("viewBox", "0 0 24 24");
    cursor.setAttribute("aria-hidden", "true");

    // Classic arrow shape with the tip at (0, 0) so the hotspot is the
    // upper-left corner of the SVG bounding box.
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute(
        "d",
        "M0 0 L0 16 L4 12 L7 20 L10 19 L7 11 L14 11 Z",
    );
    path.setAttribute("fill", "var(--accent, #e64553)");
    path.setAttribute("stroke", "white");
    path.setAttribute("stroke-width", "1.2");
    path.setAttribute("stroke-linejoin", "round");
    cursor.appendChild(path);

    document.body.appendChild(cursor);

    let mouseX = -SIZE;
    let mouseY = -SIZE;
    let pending = false;

    function paint() {
        pending = false;
        cursor.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    }

    function onMove(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!pending) {
            pending = true;
            requestAnimationFrame(paint);
        }
    }

    function onLeave() {
        cursor.style.opacity = "0";
    }

    function onEnter() {
        cursor.style.opacity = "1";
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    // Top-layer hop. Popover API elements render in the browser's
    // top layer, which sits above every z-index in the regular
    // stacking context. A z-index: 9999 cursor in <body> is still
    // BELOW a popover, so it disappears the moment a modal opens.
    //
    // Fix: when any popover opens, append the cursor as its last
    // child — the cursor inherits the popover's top-layer position
    // and renders above the modal's content. When the popover
    // closes, the cursor moves back to <body>. position: fixed
    // means parent-swapping never affects screen position.
    //
    // IMPORTANT: the `toggle` event does NOT bubble. We have to
    // listen in the CAPTURE phase to catch it from document level
    // — otherwise the handler never fires, the cursor stays in
    // <body>, and disappears behind every modal.
    const hopToTopLayer = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.hasAttribute("popover")) return;
        if (event.newState === "open") {
            target.appendChild(cursor);
        } else if (cursor.parentElement === target) {
            document.body.appendChild(cursor);
        }
    };
    document.addEventListener("toggle", hopToTopLayer, true);
    document.addEventListener("beforetoggle", hopToTopLayer, true);
})();
