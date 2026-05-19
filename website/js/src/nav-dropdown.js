// Vercel-style nav dropdown for "Articles". The opening choreography
// uses anime.js v4 (createSpring + stagger) — those two together are
// the bit you can't replicate in pure CSS: a spring opening on the
// panel that over/undershoots its target, with each item arriving
// staggered behind it on its own spring, and a reversed-stagger
// fade-out on close so the closest items leave first.
//
// anime.js is loaded once via dynamic import on the first hover/focus
// of the trigger so it doesn't cost anything on cold homepage loads.
// (Visitors who never open the dropdown never download anime.js.)

const ANIME_URL = "https://cdn.jsdelivr.net/npm/animejs@4.0.2/+esm";

(() => {
    const dropdown = document.querySelector(".nav-dropdown");
    if (!dropdown) return;

    const trigger = dropdown.querySelector(".nav-dropdown-trigger");
    const panel = dropdown.querySelector(".nav-dropdown-panel");
    if (!trigger || !panel) return;

    const items = Array.from(
        panel.querySelectorAll(".nav-dropdown-item, .nav-dropdown-all"),
    );

    let animePromise = null;
    const loadAnime = () => (animePromise ||= import(ANIME_URL));

    let isOpen = false;
    let activeAnimation = null;
    let hoverTimer = null;
    const isFinePointer = () => matchMedia("(pointer: fine)").matches;

    const setOpenState = (open) => {
        isOpen = open;
        dropdown.classList.toggle("is-open", open);
        trigger.setAttribute("aria-expanded", String(open));
    };

    const open = async () => {
        if (isOpen) return;
        setOpenState(true);

        const anime = await loadAnime();
        // The user may have closed before anime finished loading.
        if (!isOpen) return;

        activeAnimation?.pause();

        // Reset panel + items to "before" state for the animation
        // so re-opens always start from the same place.
        panel.style.transformOrigin = "top right";

        activeAnimation = anime
            .createTimeline({ defaults: { ease: "outQuad" } })
            .add(panel, {
                opacity: [0, 1],
                translateY: [-10, 0],
                scale: [0.96, 1],
                duration: 320,
                ease: anime.createSpring({
                    mass: 1,
                    stiffness: 280,
                    damping: 22,
                }),
            })
            .add(
                items,
                {
                    opacity: [0, 1],
                    translateY: [6, 0],
                    duration: 280,
                    delay: anime.stagger(32),
                    ease: anime.createSpring({
                        mass: 1,
                        stiffness: 320,
                        damping: 24,
                    }),
                },
                "-=240",
            );
    };

    const close = async () => {
        if (!isOpen) return;
        setOpenState(false);

        const anime = await loadAnime();

        activeAnimation?.pause();
        // Reversed-stagger fade-out: the items closest to the trigger
        // leave first, so the panel collapses toward its origin.
        activeAnimation = anime
            .createTimeline({ defaults: { ease: "inQuad" } })
            .add(items, {
                opacity: [1, 0],
                translateY: [0, -4],
                duration: 140,
                delay: anime.stagger(18, { from: "last" }),
            })
            .add(
                panel,
                {
                    opacity: [1, 0],
                    translateY: [0, -6],
                    scale: [1, 0.97],
                    duration: 180,
                },
                "-=100",
            );
    };

    // --- Triggers ---

    // Click toggles (also the keyboard-accessible primary interaction).
    trigger.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        isOpen ? close() : open();
    });

    // Hover-open on fine-pointer devices (desktop). Short delay so
    // grazing the trigger doesn't pop the panel.
    const armHoverOpen = () => {
        if (!isFinePointer()) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(open, 90);
    };
    const armHoverClose = () => {
        if (!isFinePointer()) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(close, 180);
    };
    dropdown.addEventListener("pointerenter", armHoverOpen);
    dropdown.addEventListener("pointerleave", armHoverClose);
    // Keep open if the cursor enters the panel from the trigger.
    panel.addEventListener("pointerenter", () => clearTimeout(hoverTimer));

    // Outside click / Esc to dismiss.
    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen) {
            close();
            trigger.focus();
        }
    });

    // Warm anime.js on the first hover/focus so the open feels instant.
    trigger.addEventListener("pointerenter", loadAnime, { once: true });
    trigger.addEventListener("focus", loadAnime, { once: true });

    // Click on item: animate the panel close in parallel with the
    // navigation. The cross-document View Transition picks up from
    // there on the destination page.
    items.forEach((link) => {
        link.addEventListener("click", (e) => {
            const href = link.getAttribute("href");
            if (!href || href.startsWith("#")) return;
            // Don't preventDefault — we want the browser to start the
            // cross-document View Transition. The close animation
            // races the navigation; whichever finishes first is fine.
            close();
        });
    });
})();
