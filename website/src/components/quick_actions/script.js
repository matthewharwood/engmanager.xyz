// Mobile quick-actions FAB.
//
// Desktop keeps the existing fixed chips. On narrow screens the same
// buttons sit in a right-edge rail that starts tucked away with only
// an arrow visible. Tap the arrow to expand; swipe right to hide or
// swipe left on the peek to reveal.
//
// Soft-nav lifecycle (JS_ROUTER_CONSTRAINTS §2.8): the rail is a
// swapped region (data-swap-region="quick-actions"), so init(scope)
// re-binds the fresh node after every swap. The data-qa-bound guard
// makes re-init idempotent; every listener is element-level (no
// document/window listeners), so nothing can stack.

(() => {
    function init(scope) {
        const root = scope.querySelector("[data-quick-actions]");
        if (!root || root.dataset.qaBound) return;
        root.dataset.qaBound = "true";

        const toggle = root.querySelector("[data-quick-actions-toggle]");
        const peek = root.querySelector(".quick-actions-peek");
        if (!toggle || !peek) return;

        const isOpen = () => root.dataset.state === "open";

        const setOpen = (open) => {
            root.dataset.state = open ? "open" : "collapsed";
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute(
                "aria-label",
                open ? "Hide quick actions" : "Open quick actions",
            );
        };

        let suppressNextClick = false;

        toggle.addEventListener("click", () => {
            if (suppressNextClick) {
                suppressNextClick = false;
                return;
            }
            setOpen(!isOpen());
        });

        let drag = null;

        const closedShift = () => Math.max(0, root.offsetWidth - peek.offsetWidth);

        const clearDrag = () => {
            root.style.transform = "";
            root.removeAttribute("data-dragging");
            drag = null;
        };

        peek.addEventListener("pointerdown", (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            drag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                base: isOpen() ? 0 : closedShift(),
                current: isOpen() ? 0 : closedShift(),
            };
            peek.setPointerCapture?.(event.pointerId);
            root.dataset.dragging = "true";
        }, { passive: true });

        peek.addEventListener("pointermove", (event) => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            const max = closedShift();
            const next = Math.max(0, Math.min(max, drag.base + event.clientX - drag.startX));
            drag.current = next;
            root.style.transform = `translateX(${next}px)`;
        }, { passive: true });

        const finishDrag = (event) => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            const delta = event.clientX - drag.startX;
            const max = closedShift();
            const shouldOpen =
                Math.abs(delta) > 24 ? delta < 0 : drag.current < max / 2;
            suppressNextClick = Math.abs(delta) > 4;
            setOpen(shouldOpen);
            clearDrag();
        };

        peek.addEventListener("pointerup", finishDrag, { passive: true });
        peek.addEventListener("pointercancel", clearDrag, { passive: true });

        setOpen(false);
    }

    init(document);
    window.__engNav?.onSwap?.(init);
})();
