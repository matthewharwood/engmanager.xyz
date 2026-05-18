// Pre-warm article pages on hover.
//
// Lazy-loads Google's Quicklink (ESM, ~1KB) the first time the reader
// hovers an article link on the homepage, then calls prefetch(href) for
// each link (once per link). Subsequent clicks feel instant because the
// document is already in the browser cache.
//
// Quicklink is loaded from jsDelivr via dynamic `import()`. We use
// dynamic import so this file stays a classic script (no type="module"
// required on the <script> tag) and Quicklink itself doesn't hit the
// network until the reader actually hovers something.
//
// Quicklink internally respects navigator.connection (skips prefetch on
// slow links or Data Saver), so we don't have to think about that here.
(() => {
    const links = document.querySelectorAll(".article-fluid-link");
    if (!links.length) return;

    let quicklinkPromise = null;
    const loadQuicklink = () => {
        if (!quicklinkPromise) {
            quicklinkPromise = import(
                "https://cdn.jsdelivr.net/npm/quicklink@2.3.0/dist/quicklink.mjs"
            );
        }
        return quicklinkPromise;
    };

    const onHover = async (event) => {
        const link = event.currentTarget;
        try {
            const { prefetch } = await loadQuicklink();
            await prefetch(link.href);
        } catch {
            // Module load or prefetch failed — the click still works,
            // it just won't be pre-warmed. Common cause: corporate
            // firewall blocking jsdelivr.
        }
    };

    links.forEach((link) => {
        // pointerenter fires for mouse + pen + touch-hover (Apple
        // Pencil etc.). { once: true } means each link is prefetched
        // at most once per page load.
        link.addEventListener("pointerenter", onHover, { once: true });
    });
})();
