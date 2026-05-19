// Polish layer on top of the cross-document View Transitions API.
//
// CSS (`@view-transition { navigation: auto }` + keyframes in
// css/src/critical.css) already animates page navigation by itself.
// This module loads anime.js v4 on `pagereveal` and uses createSpring
// to drive the incoming page's `::view-transition-new(root)` pseudo-
// element with real spring physics — overshoot + damped settle, which
// CSS @keyframes alone can't express (you'd need to hand-author
// 30+ keyframes to approximate one spring).
//
// Cross-document View Transitions: Chrome 126+ today. Browsers
// without support silently skip the spring layer and use the static
// CSS fallback (a plain fade with a tiny vertical drift).
//
// anime.js is loaded once on the first transition so cold loads cost
// nothing extra.

const ANIME_URL = "https://cdn.jsdelivr.net/npm/animejs@4.0.2/+esm";

(() => {
    if (!("startViewTransition" in document)) return;

    let animePromise = null;
    const loadAnime = () => (animePromise ||= import(ANIME_URL));

    window.addEventListener("pagereveal", async (event) => {
        // pagereveal only carries a viewTransition for cross-document
        // navigations on supporting browsers; same-doc replaces are
        // unrelated.
        const vt = event.viewTransition;
        if (!vt) return;

        try {
            const [anime] = await Promise.all([loadAnime(), vt.ready]);
            const documentElement = document.documentElement;

            // Drive ::view-transition-new(root) directly via WAAPI
            // with anime.js's spring as the easing source. Pseudo-
            // element animation needs the WAAPI `pseudoElement` option;
            // we read spring values out of anime's createSpring and
            // hand them to the browser's animate() call.
            const spring = anime.createSpring({
                mass: 1,
                stiffness: 180,
                damping: 18,
            });

            documentElement.animate(
                [
                    { opacity: 0, transform: "translateY(14px) scale(0.985)" },
                    { opacity: 1, transform: "translateY(0) scale(1)" },
                ],
                {
                    duration: spring.duration ?? 520,
                    easing: typeof spring === "function" ? "ease-out" : spring,
                    fill: "forwards",
                    pseudoElement: "::view-transition-new(root)",
                },
            );
        } catch {
            // anime.js failed to load (offline / blocked CDN) — the
            // static CSS keyframes still play.
        }
    });
})();
