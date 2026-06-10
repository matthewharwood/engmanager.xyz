// Soft-navigation router — Navigation-API fetch-and-swap driving same-document
// View Transitions (refactor ledger #16; spec: _docs/JS_ROUTER_CONSTRAINTS.md).
//
// ACTIVATION POLICY (decided, do not revisit):
//   - DORMANT whenever HTMLScriptElement.supports?.("speculationrules") is
//     true: the Chromium path keeps prerendering + cross-document view
//     transitions, completely unchanged.
//   - Requires "navigation" in window AND document.startViewTransition —
//     i.e. browsers with the Navigation API + same-doc VT but no speculation
//     rules (Firefox 147+, Safari 26.2+).
//   - Force-enable for testing (bypasses ONLY the speculation-rules dormancy
//     gate): localStorage.__engNavForce = "1"  OR  ?engnav=force in the URL.
//
// EXCLUSIONS (bail = the browser performs a normal full navigation):
//   - !canIntercept, hash-only, downloads, form submissions (POST),
//     cross-origin destinations.
//   - /checkout* and /api/* destinations.
//   - Same-pathname navigations: experiences.js ?receipt (and shop ?bag /
//     ?image) state-only URL changes stay invisible to the router, and
//     same-page /search?q= form GETs proceed as real navigations.
//   - Destinations outside the eligible set: "/", "/articles/",
//     ^/articles/[a-z0-9-]+$, "/search". Notably NOT /shop or /products/*
//     (shop.js owns history there) and NOT 404s (terminal page).
//
// NO PREFETCH / NO PAGE CACHE (the Highway lesson: never memory-cache pages).
// Every soft navigation is one plain fetch of the destination at intercept
// time — no custom headers, so the request's cache key is identical to a
// normal navigation and the HTTP cache / CDN stay the only caches. A deploy
// can therefore never strand stale page snapshots inside router memory.
//
// VERSION SKEW: /assets/ URLs are content-hashed (stem.8hex.ext). If any
// logical asset name already loaded in this document resolves to a DIFFERENT
// hash in the fetched document, the router throws and hard-navigates —
// deploy generations are never mixed within one document.
//
// FAILURE SEMANTICS: any error inside the intercept handler falls back to
// location.assign(destination) — a real navigation, which keeps the service
// worker's offline fallback intact (router fetches are not mode:"navigate",
// so sw.js's navigation branch never sees them). An aborted fetch (a newer
// navigation superseded this one) is not a failure. The user is never left
// stuck on a half-swapped page.
//
// SWAP SURFACE: <body> children minus (a) the .skip-link (identical on all
// eligible pages), (b) [data-swap-region] islands — reconciled individually
// by region name (nav / to-top / quick-actions / receipt / toasts / trash /
// reveal), (c) runtime nodes injected by scripts (.big-cursor,
// .inline-comment-popover) which their owners dispose via onSwap hooks.
// After the swap the router fires window.__engNav._fire(document.body):
// body is the post-swap content root (the homepage renders its content as
// body-level islands, so <main>/#main alone is not a usable callback scope).

(() => {
    let force = /[?&]engnav=force(&|$)/.test(location.search);
    try {
        force ||= localStorage.__engNavForce === "1";
    } catch {}

    // Chromium: stay dormant, speculation rules own navigation polish.
    if (!force && HTMLScriptElement.supports?.("speculationrules")) return;
    if (!("navigation" in window) || !document.startViewTransition) return;

    // Same module + spring params as view-transitions.js so soft and hard
    // navigations feel identical; loaded lazily on the first transition.
    const ANIME_URL = "https://cdn.jsdelivr.net/npm/animejs@4.0.2/+esm";
    let animePromise = null;
    const loadAnime = () => (animePromise ||= import(ANIME_URL));

    // "/", "/articles/", "/articles/{slug}" (^/articles/[a-z0-9-]+$), "/search".
    const eligible = (pathname) =>
        /^\/(search|articles\/[a-z0-9-]*)?$/.test(pathname);

    // stem.8hex.ext -> stem.ext (mirrors assets.rs strip_asset_hash).
    const logicalName = (pathname) =>
        pathname.replace(/\.[0-9a-f]{8}(\.[A-Za-z0-9]+)$/, "$1");

    // Head-diff key: first-party hashed assets by logical name (stable
    // across deploys), everything else (CDN tags) by full URL.
    const assetKey = (url) =>
        url.origin === location.origin && url.pathname.startsWith("/assets/")
            ? logicalName(url.pathname)
            : url.href;

    const headTags = (root) =>
        [...root.querySelectorAll("link[rel=stylesheet][href],script[src]")]
            // DOMParser documents have scripting disabled, so the parsed doc's
            // <noscript> CSS fallbacks are real elements — exclude them.
            .filter((el) => !el.closest("noscript"));

    const tagUrl = (el) =>
        el.getAttribute("href") ?? el.getAttribute("src");

    // ADD-ONLY head asset sync, in new-document order (preserves execution
    // order: prism-core before its autoloader, leaflet before c-region-map,
    // popover-registry before c-nav). Never re-appends an existing logical
    // name — already-executed bundles stay resident and are neutralized by
    // their own onSwap/dispose hooks. Old page-scoped CSS is deliberately
    // left in place: every sheet is selector-scoped (body classes /
    // component hooks), so it is inert on the next page, and keeping it
    // makes traversing back free of refetch/FOUC.
    //
    // VERSION SKEW: phase 1 walks every incoming tag and throws if a logical
    // name this document already loaded resolves to a DIFFERENT hash —
    // BEFORE any head mutation, so deploy generations are never mixed and
    // the failure path is one clean hard navigation.
    const syncHeadAssets = (newDoc) => {
        const live = new Map(); // asset key -> hashed pathname
        for (const el of headTags(document)) {
            const url = new URL(tagUrl(el), location.href);
            live.set(assetKey(url), url.pathname);
        }
        const adds = [];
        for (const el of headTags(newDoc)) {
            const raw = tagUrl(el);
            const url = new URL(raw, location.href);
            const key = assetKey(url);
            const loaded = live.get(key);
            if (loaded !== undefined) {
                if (loaded !== url.pathname) throw new Error(`skew ${key}`);
                continue;
            }
            live.set(key, url.pathname);
            adds.push([el, raw]);
        }

        const blockingLoads = [];
        for (const [el, raw] of adds) {
            if (el.tagName === "LINK") {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = raw;
                if (el.media === "print") {
                    // Deferred-tier sheet: replay the media="print" -> "all"
                    // flip (its targets are hidden at load — no FOUC).
                    link.media = "print";
                    link.onload = () => {
                        link.media = "all";
                    };
                } else {
                    // Blocking-tier sheet: let it land before the swap so the
                    // incoming page never paints unstyled — capped at 2s so a
                    // slow sheet can't wedge the navigation.
                    blockingLoads.push(
                        new Promise((resolve) => {
                            link.onload = link.onerror = resolve;
                            setTimeout(resolve, 2000);
                        }),
                    );
                }
                document.head.append(link);
            } else {
                const script = document.createElement("script");
                script.src = raw;
                // Inserted scripts are async by default; force in-order
                // execution to keep the new page's dependency order.
                script.async = false;
                document.head.append(script);
            }
        }
        return Promise.all(blockingLoads);
    };

    // Runtime-injected body nodes the router must never treat as page
    // content: the shared skip-link plus script-owned overlays.
    const KEPT = ".skip-link,.big-cursor,.inline-comment-popover";

    const regionsOf = (kids) => {
        const map = new Map();
        for (const el of kids) {
            const name = el.getAttribute("data-swap-region");
            if (name) map.set(name, el);
        }
        return map;
    };

    const pageNodesOf = (kids) =>
        kids.filter(
            (el) => !el.hasAttribute("data-swap-region") && !el.matches(KEPT),
        );

    // True once a parsed-document node has been moved into this document
    // (insertBefore/replaceWith adopt the node, retargeting ownerDocument).
    const adopted = (el) => el.ownerDocument === document;

    const swapDocument = (newDoc) => {
        document.title = newDoc.title;

        const body = document.body;
        const oldKids = [...body.children];
        // Snapshot BEFORE adoption mutates newDoc's child list.
        const newKids = [...newDoc.body.children];
        const oldRegions = regionsOf(oldKids);
        const newRegions = regionsOf(newKids);
        const oldPage = pageNodesOf(oldKids);
        const newPage = pageNodesOf(newKids);

        // Page surface: insert the new content as one block where the old
        // page's first content node sat, then drop every old content node.
        const anchor = oldPage[0] ?? null;
        for (const el of newPage) body.insertBefore(el, anchor);
        for (const el of oldPage) el.remove();

        // Regions, old ∪ new. Present in both -> swap in place; old-only ->
        // remove; new-only -> insert at the new document's position,
        // anchoring on the first FOLLOWING new-doc body child that made it
        // into this document (an adopted page node or replaced region).
        for (const [name, oldEl] of oldRegions) {
            const newEl = newRegions.get(name);
            if (newEl) oldEl.replaceWith(newEl);
            else oldEl.remove();
        }
        for (const newEl of newRegions.values()) {
            if (adopted(newEl)) continue; // replaced an old region above
            body.insertBefore(
                newEl,
                newKids.slice(newKids.indexOf(newEl) + 1).find(adopted) ??
                    null,
            );
        }

        // Body class + dataset follow the new document, except dataset keys
        // owned by running scripts (experiences.js device/network flags,
        // trash-drag's dragging marker).
        body.className = newDoc.body.className;
        const jsBodyData = new Set(
            "battery,paint,memory,saveData,net,tabState,dragging".split(","),
        );
        for (const key of Object.keys(body.dataset)) {
            if (!(key in newDoc.body.dataset) && !jsBodyData.has(key)) {
                delete body.dataset[key];
            }
        }
        Object.assign(body.dataset, newDoc.body.dataset);

        // <html> attrs follow the new document, except data-theme (the theme
        // runtime owns it; it must persist across soft navs) and style
        // (trash-drag writes --trash-glow there).
        const html = document.documentElement;
        const newHtml = newDoc.documentElement;
        const jsHtmlAttrs = new Set(["data-theme", "style"]);
        for (const { name } of [...html.attributes]) {
            if (!jsHtmlAttrs.has(name) && !newHtml.hasAttribute(name)) {
                html.removeAttribute(name);
            }
        }
        for (const { name, value } of [...newHtml.attributes]) {
            if (!jsHtmlAttrs.has(name)) html.setAttribute(name, value);
        }
        // The router path SKIPS the article section-reveal effect: its
        // server bootstrap (an inline head script setting
        // html[data-article-reveal="pending"] pre-paint) never executes in a
        // DOMParser document, and articles.css only hides sections while
        // <html> carries data-article-reveal="pending"/"running" — so strip
        // any leftover state from the outgoing page and swapped-in sections
        // render fully visible.
        delete html.dataset.articleReveal;

        // DOM settled: let converted bundles re-init against the new page.
        window.__engNav?._fire?.(document.body);
    };

    // Spring polish, verbatim from view-transitions.js (same params, same
    // failure tolerance — without anime.js the default crossfade still
    // plays), driving the same-document transition's new root.
    const springPolish = async (transition) => {
        try {
            const [anime] = await Promise.all([loadAnime(), transition.ready]);
            const spring = anime.createSpring({
                mass: 1,
                stiffness: 180,
                damping: 18,
            });
            document.documentElement.animate(
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
            // anime.js failed to load — the browser's default animation
            // still plays.
        }
    };

    // One-shot bypass for the failure fallback: location.assign() fires its
    // own navigate event, which this listener would otherwise intercept
    // again — turning the "real navigation" fallback back into a soft nav
    // (and looping forever while the network stays down). The fallback URL
    // is recorded before assign() and its navigate event passes through
    // unintercepted exactly once.
    let fallbackUrl = null;

    // Traversals (back/forward) intercept identically — this is what gives
    // Firefox/Safari same-doc transitions on history navigation too.
    navigation.addEventListener("navigate", (event) => {
        const fallingBack = fallbackUrl;
        fallbackUrl = null;
        if (fallingBack === event.destination.url) return;
        // NOTE: no destination.sameDocument bail — entries created by an
        // intercepted navigation are same-document, so traversals back to
        // them MUST intercept again or the content would go stale. State-only
        // pushState/replaceState writes (?receipt / ?bag / ?image) are
        // excluded by the same-pathname bail below instead.
        if (
            !event.canIntercept ||
            event.hashChange ||
            event.downloadRequest !== null ||
            event.formData
        ) {
            return;
        }
        const dest = new URL(event.destination.url);
        if (dest.origin !== location.origin) return;
        const path = dest.pathname;
        if (/^\/(checkout|api\/)/.test(path)) return;
        // Same-pathname: ?receipt/?bag/?image state-only changes AND
        // same-page /search?q= form GETs proceed as real navigations.
        if (path === location.pathname) return;
        if (!eligible(path)) return;

        event.intercept({
            scroll: "after-transition",
            focusReset: "after-transition",
            handler: async () => {
                try {
                    // Plain fetch: no custom headers (cache-key purity), no
                    // router-side caching (see header).
                    const res = await fetch(dest.href, {
                        signal: event.signal,
                    });
                    const type = res.headers.get("content-type") || "";
                    if (!res.ok || !type.includes("text/html")) {
                        throw new Error(`http ${res.status}`);
                    }
                    const newDoc = new DOMParser().parseFromString(
                        await res.text(),
                        "text/html",
                    );
                    await syncHeadAssets(newDoc);
                    const transition = document.startViewTransition(() =>
                        swapDocument(newDoc),
                    );
                    springPolish(transition);
                    await transition.updateCallbackDone;
                } catch {
                    // A newer navigation superseded this one — just stop.
                    if (event.signal.aborted) return;
                    // Anything else: full navigation (SW offline fallback
                    // preserved); never leave the user stuck. The bypass
                    // flag keeps this listener from re-intercepting it.
                    fallbackUrl = dest.href;
                    location.assign(dest.href);
                }
            },
        });
    });
})();
