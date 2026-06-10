// Bottom-right "to top" button. Mounted on every article page; CSS
// hides it on mobile (mobile users have system-level tap-status-bar-
// to-scroll-up). Becomes visible once the reader has scrolled past
// one viewport height; click smoothly returns to the top via the
// global `scroll-behavior: smooth`.
//
// Soft-nav lifecycle: the button is a swapped region (data-swap-region
// ="to-top"), so each swap re-resolves it (data-to-top-bound guard on
// the fresh node). The window scroll/resize listeners are module
// singletons that lazily read the CURRENT button — registered once per
// real page load, never stacked, and a no-op on pages without one.
(() => {
    let button = document.querySelector(".to-top");

    const recompute = () => {
        if (!button) return;
        button.classList.toggle("is-visible", window.scrollY > window.innerHeight);
    };

    let queued = false;
    const onScroll = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            recompute();
        });
    };

    const bind = () => {
        if (!button || button.dataset.toTopBound) return;
        button.dataset.toTopBound = "true";
        button.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    bind();
    recompute();

    window.__engNav?.onSwap?.((root) => {
        button = root.querySelector(".to-top");
        bind();
        recompute();
    });
})();
