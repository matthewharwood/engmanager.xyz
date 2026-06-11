// Keyboard navigation for the homepage article stack.
//
// ArrowDown / ArrowUp cycles focus through .article-fluid-link elements
// (the stacked, fluid-SVG titles). The :focus-visible rule on those links
// already triggers the same scale(1.2) + drop-shadow lift as :hover, so the
// focused link visually pops up.
//
// Self-guards: only activates inside <body class="homepage">. Skips when the
// event target is a form control so people typing in inputs don't get
// hijacked.

// Both the homepage check and the link query live INSIDE the keydown
// handler (JS_ROUTER_CONSTRAINTS §2.5): no captured links array means a
// soft navigation away from the homepage can't leave a stale list
// hijacking ArrowDown on the next page — and no onSwap hook is needed.
(function () {
    document.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        const tag = e.target && e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (!document.body || !document.body.classList.contains("homepage")) {
            return;
        }

        const links = Array.from(
            document.querySelectorAll(".article-fluid-link"),
        );
        if (!links.length) return;

        const current = document.activeElement;
        const currentIndex = links.indexOf(current);
        const last = links.length - 1;

        let nextIndex;
        if (e.key === "ArrowDown") {
            nextIndex =
                currentIndex < 0 ? 0 : (currentIndex + 1) % links.length;
        } else {
            nextIndex =
                currentIndex < 0 ? last : (currentIndex - 1 + links.length) % links.length;
        }

        e.preventDefault();
        links[nextIndex].focus();
    });
})();
