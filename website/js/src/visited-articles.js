// Persisted read-state for the homepage article stack.
//
// We can't use CSS `:visited` here because (a) the title is rendered
// as SVG <text>, which doesn't respond to text-decoration, and (b)
// `:visited` is locked down by the browser — no layout, no opacity,
// only color hints. So we mirror visited-ness in localStorage and
// toggle `.is-visited` on each link; the chunky checkbox fills with
// the maroon accent and a strike-through bar scales across the title
// (both transitions live in css/src/homepage.css).
//
// Click handler fires before the browser begins navigation so the
// fill + strike start animating immediately; by the time the cross-
// document View Transition runs, the link is already marked read.

const STORAGE_KEY = "engmanager.visited-articles";

const loadVisited = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
};

const saveVisited = (set) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {
        // Quota exceeded / Safari private mode / disabled storage.
        // Visited state still works for the current page load.
    }
};

(() => {
    const links = Array.from(document.querySelectorAll(".article-fluid-link"));
    if (!links.length) return;

    const visited = loadVisited();

    // Initial hydration: mark previously-read articles immediately so
    // the strike + checkmark are already in place at first paint.
    links.forEach((link) => {
        const slug = link.dataset.slug;
        if (slug && visited.has(slug)) {
            link.classList.add("is-visited");
        }
    });

    links.forEach((link) => {
        link.addEventListener("click", () => {
            const slug = link.dataset.slug;
            if (!slug) return;
            if (visited.has(slug)) return;
            visited.add(slug);
            saveVisited(visited);
            link.classList.add("is-visited");
            // Notifies the Broadcast Channel experience so other tabs
            // get the same strike-through in real time.
            document.dispatchEvent(
                new CustomEvent("engmanager:visited", { detail: { slug } }),
            );
        });
    });
})();
