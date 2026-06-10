// Comically-large custom cursor for the homepage.
//
// CSS cursor: url() caps at 128px in most browsers, so to get a real
// 8x scale we render an SVG cursor as a fixed-position wrapper that
// follows the pointer. Three shapes ship side-by-side; the wrapper's
// `data-mode` swaps which one is visible:
//
//   arrow   default
//   open    hovering a draggable marquee chip, visited article check,
//           or catching the background DVD logo
//   grab    a chip/article is being dragged (CSS `grabbing` analogue)
//
// Pointer Events throughout — `pointermove` instead of `mousemove`,
// because trash-drag.js calls preventDefault() on pointerdown which
// causes Chrome to suppress the synthesized mouse events for the
// duration of the gesture. The cursor would freeze where the user
// clicked. pointermove fires regardless.
//
// Top-layer hop in capture phase: Popover API elements render above
// every z-index, so when a modal opens the cursor would disappear
// behind it. Listener moves the cursor into the open popover so it
// inherits the top-layer stacking context. `toggle` doesn't bubble —
// `{ capture: true }` is mandatory.
//
// Self-guards: only activates inside <body class="homepage">,
// respects prefers-reduced-motion and pointer: coarse.
//
// init/dispose pair (JS_ROUTER_CONSTRAINTS §2.6): the soft-nav router
// mounts the cursor when a swap lands on the homepage and fully
// disposes it (node removed, observer disconnected, window/document
// listeners removed) when a swap leaves it. `dispose` doubles as the
// module singleton guard — init() while mounted is a no-op, so
// listeners never stack across re-inits.

(function () {
    if (
        window.matchMedia &&
        (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
            window.matchMedia("(pointer: coarse)").matches)
    ) {
        return;
    }

    const SIZE = 256;

    let dispose = null;

    function init() {
        if (dispose) return;
        if (!document.body || !document.body.classList.contains("homepage")) {
            return;
        }

        const cursor = document.createElement("div");
        cursor.className = "big-cursor";
        cursor.setAttribute("aria-hidden", "true");
        cursor.dataset.mode = "arrow";

        // Shared SVG style attrs. Repeated inline so the cursor is one
        // self-contained HTML chunk — no CSS dependencies for the shapes.
        const ATTR = 'fill="var(--accent, #e64553)" stroke="white" stroke-width="1.2" stroke-linejoin="round"';

        // All three shapes have their hotspot at SVG (0, 0), matching the
        // wrapper's top-left — so the click point lines up with the user's
        // actual pointer position regardless of which shape is shown.
        cursor.innerHTML = `
        <svg class="cursor-shape cursor-arrow" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0 L0 16 L4 12 L7 20 L10 19 L7 11 L14 11 Z" ${ATTR}/>
        </svg>
        <svg class="cursor-shape cursor-open" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="3" height="12" rx="1.5" ${ATTR}/>
            <rect x="4" y="1" width="3" height="11" rx="1.5" ${ATTR}/>
            <rect x="8" y="3" width="3" height="9" rx="1.5" ${ATTR}/>
            <rect x="12" y="6" width="3" height="7" rx="1.5" ${ATTR}/>
            <path d="M15 8 Q19 8 19 12 L19 14 L15 14 Z" ${ATTR}/>
            <rect x="-1" y="11" width="21" height="11" rx="3" ${ATTR}/>
        </svg>
        <svg class="cursor-shape cursor-grab" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="2" width="3" height="5" rx="1.5" ${ATTR}/>
            <rect x="4" y="2" width="3" height="5" rx="1.5" ${ATTR}/>
            <rect x="8" y="2" width="3" height="5" rx="1.5" ${ATTR}/>
            <rect x="12" y="3" width="3" height="4" rx="1.5" ${ATTR}/>
            <rect x="-1" y="6" width="20" height="12" rx="3" ${ATTR}/>
            <path d="M15 7 Q19 7 19 10 L19 13 L15 13 Z" ${ATTR}/>
        </svg>
    `;

        document.body.appendChild(cursor);

        let mouseX = -SIZE;
        let mouseY = -SIZE;
        let pending = false;

        function paint() {
            pending = false;
            cursor.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
        }

        function detectMode(target) {
            if (document.body.dataset.dragging === "true") return "grab";
            if (isOverDvdBouncer()) return "open";
            const chip = target?.closest?.(".marquee .chip");
            if (chip && chip.dataset.trashed !== "true") {
                return "open";
            }
            const articleTrash = target?.closest?.(
                ".article-fluid-link.is-visited .article-check",
            );
            if (articleTrash) {
                return "open";
            }
            return "arrow";
        }

        function isOverDvdBouncer() {
            const logo = document.querySelector("[data-dvd-bouncer]");
            if (!logo || logo.dataset.trashed === "true" || logo.hidden) return false;
            const rect = logo.getBoundingClientRect();
            return (
                mouseX >= rect.left &&
                mouseX <= rect.right &&
                mouseY >= rect.top &&
                mouseY <= rect.bottom
            );
        }

        // Asymmetric debounce on de-engagement. Engaging a chip
        // (arrow → open) and drag transitions (any → grab, grab → *)
        // flip instantly so pickup / release feel tactile. Only the
        // open → arrow downshift lingers for 300ms — long enough for
        // the pointer to cross the seam between adjacent marquee chips
        // without the cursor flicking fist ↔ arrow ↔ fist.
        const MODE_LINGER_MS = 300;
        let modeDebounce = null;
        function setMode(mode) {
            if (cursor.dataset.mode === mode) {
                // Re-engaged the same mode before the timer fired —
                // cancel the pending downgrade.
                if (modeDebounce !== null) {
                    clearTimeout(modeDebounce);
                    modeDebounce = null;
                }
                return;
            }
            const isDownshift =
                cursor.dataset.mode === "open" && mode === "arrow";
            if (isDownshift) {
                if (modeDebounce !== null) clearTimeout(modeDebounce);
                modeDebounce = setTimeout(() => {
                    cursor.dataset.mode = mode;
                    modeDebounce = null;
                }, MODE_LINGER_MS);
                return;
            }
            if (modeDebounce !== null) {
                clearTimeout(modeDebounce);
                modeDebounce = null;
            }
            cursor.dataset.mode = mode;
        }

        function onMove(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
            setMode(detectMode(e.target));
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

        // pointermove instead of mousemove — see top-of-file note.
        window.addEventListener("pointermove", onMove, { passive: true });
        document.addEventListener("pointerleave", onLeave);
        document.addEventListener("pointerenter", onEnter);

        // While a drag is in progress, body[data-dragging] is set by
        // trash-drag.js. The pointer might not move during the start of
        // the gesture, so flip to grab mode the instant dragging starts.
        const dragObserver = new MutationObserver(() => {
            setMode(detectMode(document.elementFromPoint(mouseX, mouseY)));
        });
        dragObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["data-dragging"],
        });

        // Top-layer hop (capture phase — toggle doesn't bubble).
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

        dispose = () => {
            window.removeEventListener("pointermove", onMove, {
                passive: true,
            });
            document.removeEventListener("pointerleave", onLeave);
            document.removeEventListener("pointerenter", onEnter);
            document.removeEventListener("toggle", hopToTopLayer, true);
            document.removeEventListener("beforetoggle", hopToTopLayer, true);
            dragObserver.disconnect();
            if (modeDebounce !== null) clearTimeout(modeDebounce);
            cursor.remove();
        };
    }

    init();

    window.__engNav?.onSwap?.(() => {
        if (document.body.classList.contains("homepage")) {
            init();
        } else if (dispose) {
            dispose();
            dispose = null;
        }
    });
})();
