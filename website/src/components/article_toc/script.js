// Scrollspy for the article-page sidebar TOC.
//
// IntersectionObserver with a trigger band near the top of the viewport
// (below the sticky site-nav). When a heading enters the band, the
// matching TOC link gets .is-current. The class swap drives a CSS
// transition (color + background) so the active waypoint animates
// between sections.
//
// If multiple headings are inside the band (short sections), the
// topmost wins. If no heading is in the band (between sections), the
// last active link stays current — keeps the sidebar from flickering
// blank.
//
// init/dispose pair (JS_ROUTER_CONSTRAINTS §2.11): the observer, the
// rAF-throttled scroll listener and the matchMedia tools-relocation
// listener all reference the CURRENT article's nodes — a soft
// navigation disposes them before re-initialising against the new
// article, so no IO/scroll/matchMedia callback ever touches a detached
// heading. The relocated .article-meta-tools node lives inside the
// swapped page surface, so it leaves with the old page.
(() => {
    let dispose = null;

    function init(root) {
        if (dispose) return;

        const toc = root.querySelector(".article-toc");
        if (!toc) return;

        const cleanups = [];
        dispose = () => {
            for (const fn of cleanups) fn();
        };

        // Relocate the article action tools (share / read aloud / fullscreen /
        // recolor) under the "On this page" module on desktop; keep them in the
        // header's Actions disclosure on mobile. Moving them OUT of that <details>
        // on desktop also fixes a Chromium quirk where the disclosure's
        // force-shown content didn't appear until a resize-triggered style recalc —
        // so the tools now show on first load instead of only after a resize.
        const tools = root.querySelector(".article-meta-tools");
        const toolsHome = root.querySelector(".article-meta-disclosure-tools");
        if (tools && toolsHome) {
            const wide = window.matchMedia("(min-width: 72rem)");
            const placeTools = () => {
                if (wide.matches) toc.append(tools);
                else toolsHome.append(tools);
            };
            placeTools();
            wide.addEventListener("change", placeTools);
            cleanups.push(() => wide.removeEventListener("change", placeTools));
        }

        const headings = Array.from(
            root.querySelectorAll(".article :is(h2, h3)[id]"),
        );
        if (!headings.length) return;

        const linkFor = (id) =>
            toc.querySelector(`.article-toc-link[href="#${CSS.escape(id)}"]`);
        const links = new Map(
            headings.map((h) => [h.id, linkFor(h.id)]).filter(([, l]) => l),
        );

        const inZone = new Set();
        let activeId = headings[0].id;
        links.get(activeId)?.classList.add("is-current");

        const setActive = (id) => {
            if (id === activeId) return;
            links.get(activeId)?.classList.remove("is-current");
            activeId = id;
            links.get(activeId)?.classList.add("is-current");
        };

        const isAtBottom = () =>
            window.scrollY + window.innerHeight >=
            document.documentElement.scrollHeight - 4;

        const recompute = () => {
            // Force-activate the last heading when the reader has scrolled
            // to the very bottom. Otherwise a tiny final section may never
            // reach the trigger band even with generous trailing padding.
            if (isAtBottom()) {
                setActive(headings[headings.length - 1].id);
                return;
            }
            for (const h of headings) {
                if (inZone.has(h.id)) {
                    setActive(h.id);
                    return;
                }
            }
        };

        // rAF-throttled scroll listener — used only to catch the
        // bottom-of-page case (IntersectionObserver covers normal traversal).
        let queued = false;
        const onScroll = () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                recompute();
            });
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        cleanups.push(() => window.removeEventListener("scroll", onScroll));

        // Trigger band: from ~80px (just under the sticky nav) down to 40%
        // of viewport height. Tuned so a heading "activates" as it enters
        // the comfortable reading zone, not when it touches the very top.
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) inZone.add(entry.target.id);
                    else inZone.delete(entry.target.id);
                }
                recompute();
            },
            { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
        );
        headings.forEach((h) => observer.observe(h));
        cleanups.push(() => observer.disconnect());
    }

    init(document);

    window.__engNav?.onSwap?.((root) => {
        if (dispose) {
            dispose();
            dispose = null;
        }
        init(root);
    });
})();
