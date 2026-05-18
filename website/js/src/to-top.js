// Bottom-right "to top" button. Mounted on every article page; CSS
// hides it on mobile (mobile users have system-level tap-status-bar-
// to-scroll-up). Becomes visible once the reader has scrolled past
// one viewport height; click smoothly returns to the top via the
// global `scroll-behavior: smooth`.
(() => {
    const button = document.querySelector(".to-top");
    if (!button) return;

    const recompute = () => {
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

    button.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    recompute();
})();
