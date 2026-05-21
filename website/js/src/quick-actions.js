// Mobile quick-actions FAB.
//
// Desktop keeps the existing fixed chips. On narrow screens the same
// buttons sit in a right-edge rail that starts tucked away with only
// an arrow visible. Tap the arrow to expand; swipe right to hide or
// swipe left on the peek to reveal.

(() => {
    const root = document.querySelector("[data-quick-actions]");
    if (!root) return;

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

    toggle.addEventListener("click", () => setOpen(!isOpen()));

    let drag = null;

    const closedShift = () => Math.max(0, root.offsetWidth - peek.offsetWidth);

    const clearDrag = () => {
        root.style.transform = "";
        root.removeAttribute("data-dragging");
        drag = null;
    };

    root.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            base: isOpen() ? 0 : closedShift(),
            current: isOpen() ? 0 : closedShift(),
        };
        root.setPointerCapture?.(event.pointerId);
        root.dataset.dragging = "true";
    });

    root.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const max = closedShift();
        const next = Math.max(0, Math.min(max, drag.base + event.clientX - drag.startX));
        drag.current = next;
        root.style.transform = `translateX(${next}px)`;
    });

    const finishDrag = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const delta = event.clientX - drag.startX;
        const max = closedShift();
        const shouldOpen =
            Math.abs(delta) > 24 ? delta < 0 : drag.current < max / 2;
        setOpen(shouldOpen);
        clearDrag();
    };

    root.addEventListener("pointerup", finishDrag);
    root.addEventListener("pointercancel", clearDrag);

    setOpen(false);
})();
