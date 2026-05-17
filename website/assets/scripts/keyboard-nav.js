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

(function () {
    if (!document.body || !document.body.classList.contains("homepage")) return;

    function init() {
        const links = Array.from(
            document.querySelectorAll(".article-fluid-link"),
        );
        if (!links.length) return;

        document.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            const tag = e.target && e.target.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

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
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
