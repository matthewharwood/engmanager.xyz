// Article-section reveal choreography.
//
// Progressive enhancement only: Markdown content is already in the HTML.
// A tiny head script sets <html data-article-reveal="pending"> before the
// article stylesheet loads, so the initial compositor-only pose is in place
// before first paint. This file only observes, animates, and cleans up.

const ANIME_URL = "https://cdn.jsdelivr.net/npm/animejs@4.0.2/+esm";
const SELECTOR = ".article-reveal-section[data-article-reveal]";
const MAX_CHILD_TARGETS = 8;
const ANIME_TIMEOUT_MS = 700;
const CLEANUP_DELAY_MS = 1200;

const startArticleSectionReveal = () => {
    if (location.hash) return;
    if (!("IntersectionObserver" in window)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    if (root.dataset.articleReveal !== "pending") return;

    const sections = Array.from(
        document.querySelectorAll(`${SELECTOR}:not([data-reveal-preload])`),
    );
    const preloadSections = Array.from(
        document.querySelectorAll(`${SELECTOR}[data-reveal-preload]`),
    );

    preloadSections.forEach((section) => {
        section.dataset.articleRevealState = "done";
    });

    if (!sections.length) {
        root.dataset.articleReveal = "done";
        return;
    }

    const revealed = new WeakSet();
    let remaining = sections.length;
    let observer = null;
    let animePromise = null;
    const loadAnime = () => (animePromise ||= import(ANIME_URL));

    const revealWithoutMotion = (section) => {
        revealed.add(section);
        if (section.dataset.articleRevealState !== "done") {
            remaining -= 1;
        }
        section.dataset.articleRevealState = "done";
        section.style.opacity = "";
        section.style.transform = "";
        section.style.transformOrigin = "";
        section.style.willChange = "";
        childTargets(section).forEach((child) => {
            child.style.opacity = "";
            child.style.transform = "";
            child.style.willChange = "";
        });
        if (remaining <= 0) {
            root.dataset.articleReveal = "done";
        }
    };

    const revealAllWithoutMotion = () => {
        observer?.disconnect();
        sections.forEach(revealWithoutMotion);
    };

    const play = async (section) => {
        if (revealed.has(section)) return;
        revealed.add(section);
        observer?.unobserve(section);
        section.dataset.articleRevealState = "active";

        let anime = null;
        try {
            anime = await Promise.race([
                loadAnime(),
                new Promise((resolve) =>
                    setTimeout(() => resolve(null), ANIME_TIMEOUT_MS),
                ),
            ]);
        } catch {
            anime = null;
        }

        if (!anime || location.hash) {
            revealWithoutMotion(section);
            return;
        }

        const variant = variants[section.dataset.revealVariant] || variants.rise;
        variant(anime, section, childTargets(section));

        setTimeout(() => revealWithoutMotion(section), CLEANUP_DELAY_MS);
    };

    sections.forEach((section) => {
        section.dataset.articleRevealState = "pending";
    });
    root.dataset.articleReveal = "running";

    observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) play(entry.target);
            }
        },
        {
            rootMargin: "0px 0px -14% 0px",
            threshold: 0.08,
        },
    );

    sections.forEach((section) => observer.observe(section));

    // Warm the import after setup, but only on no-hash page loads —
    // and never from a speculatively prerendered page (CDN traffic from
    // never-shown documents; JS_ROUTER_CONSTRAINTS §3). Prerendered
    // pages warm it at activation instead; the reveal itself is
    // untouched (its IntersectionObserver is browser-paused until
    // activation anyway).
    if (document.prerendering) {
        document.addEventListener(
            "prerenderingchange",
            () => loadAnime().catch(() => null),
            { once: true },
        );
    } else {
        loadAnime().catch(() => null);
    }

    window.addEventListener("hashchange", revealAllWithoutMotion, { once: true });
};

const childTargets = (section) =>
    Array.from(section.children).slice(0, MAX_CHILD_TARGETS);

const spring = (anime, stiffness, damping) =>
    anime.createSpring({
        mass: 1,
        stiffness,
        damping,
    });

const variants = {
    rise(anime, section, children) {
        anime
            .createTimeline()
            .add(section, {
                opacity: [0, 1],
                translateY: [18, 0],
                duration: 620,
                ease: spring(anime, 180, 22),
            })
            .add(
                children,
                {
                    opacity: [0, 1],
                    translateY: [8, 0],
                    duration: 420,
                    delay: anime.stagger(18),
                    ease: "outQuad",
                },
                "-=520",
            );
    },

    drift(anime, section, children) {
        anime
            .createTimeline()
            .add(section, {
                opacity: [0, 1],
                translateX: [-14, 0],
                translateY: [10, 0],
                duration: 660,
                ease: spring(anime, 165, 24),
            })
            .add(
                children,
                {
                    opacity: [0, 1],
                    translateX: [6, 0],
                    duration: 360,
                    delay: anime.stagger(22),
                    ease: "outQuad",
                },
                "-=540",
            );
    },

    hinge(anime, section, children) {
        anime
            .createTimeline()
            .add(section, {
                opacity: [0, 1],
                translateY: [14, 0],
                rotateX: [2.5, 0],
                duration: 700,
                ease: spring(anime, 150, 21),
            })
            .add(
                children,
                {
                    opacity: [0, 1],
                    translateY: [7, 0],
                    duration: 400,
                    delay: anime.stagger(20),
                    ease: "outQuad",
                },
                "-=560",
            );
    },

    focus(anime, section, children) {
        anime
            .createTimeline()
            .add(section, {
                opacity: [0, 1],
                translateY: [10, 0],
                scale: [0.985, 1],
                duration: 640,
                ease: spring(anime, 210, 25),
            })
            .add(
                children,
                {
                    opacity: [0, 1],
                    translateY: [5, 0],
                    scale: [0.995, 1],
                    duration: 360,
                    delay: anime.stagger(16),
                    ease: "outQuad",
                },
                "-=500",
            );
    },

    thread(anime, section, children) {
        anime
            .createTimeline()
            .add(section, {
                opacity: [0, 1],
                translateX: [10, 0],
                translateY: [12, 0],
                duration: 650,
                ease: spring(anime, 175, 23),
            })
            .add(
                children,
                {
                    opacity: [0, 1],
                    translateX: (_el, index) => [index % 2 ? 7 : -7, 0],
                    duration: 380,
                    delay: anime.stagger(17),
                    ease: "outQuad",
                },
                "-=520",
            );
    },
};

startArticleSectionReveal();
