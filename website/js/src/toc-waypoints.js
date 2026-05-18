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
(() => {
    const toc = document.querySelector(".article-toc");
    if (!toc) return;

    const headings = Array.from(
        document.querySelectorAll(".article :is(h2, h3)[id]"),
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
})();
