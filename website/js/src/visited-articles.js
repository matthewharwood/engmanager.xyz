// Persisted read-state for the homepage article stack.
//
// We can't use CSS `:visited` here because (a) the title is rendered
// as SVG <text>, which doesn't respond to text-decoration, and (b)
// `:visited` is locked down by the browser — no layout, no opacity,
// only color hints. So we mirror visited-ness in localStorage and
// toggle `.is-visited` on each link; the chunky checkbox fills, the
// checkmark pings in with a scale pop, and a strike-through bar
// scales across the title (transitions + keyframes in homepage.css).
//
// Navigation gate
//   The Speculation Rules experience prerenders every /articles/*
//   link, so clicking is effectively zero-latency. Without an
//   intercept, the user would never see the strike + check animate
//   because the page is already gone before any pixels paint. We
//   `preventDefault()` on click, mark visited, and wait
//   ANIM_HOLD_MS for the animations to play before driving
//   `location.href` (which still uses the prerendered destination
//   for instant activation when it's ready).

const STORAGE_KEY = "engmanager.visited-articles";
const ANIM_HOLD_MS = 460;

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
        link.addEventListener("click", (event) => {
            const slug = link.dataset.slug;
            if (!slug) return;

            // Already visited → let normal navigation happen.
            if (visited.has(slug)) return;

            // Modifier-clicks / middle-click / non-primary → open in
            // new tab without delay so the user's intent is honored.
            if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                visited.add(slug);
                saveVisited(visited);
                link.classList.add("is-visited");
                return;
            }

            // Hold navigation for ~460ms so the strike + check
            // animations actually paint before the next page replaces
            // this one (Speculation Rules prerenders article pages —
            // navigation would otherwise be effectively instant).
            event.preventDefault();
            visited.add(slug);
            saveVisited(visited);
            link.classList.add("is-visited", "is-visited-fresh");

            // Notifies the Broadcast Channel experience so other tabs
            // get the same strike-through in real time.
            document.dispatchEvent(
                new CustomEvent("engmanager:visited", { detail: { slug } }),
            );

            const target = link.href;
            setTimeout(() => {
                location.href = target;
            }, ANIM_HOLD_MS);
        });
    });
})();
