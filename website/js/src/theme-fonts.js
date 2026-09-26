// The manifest contains URLs, not @font-face rules: unselected faces never fetch.
// FontFace.load() resolves after decoding; a storage flag or fonts.check() alone
// cannot establish that a particular font is actually available in the browser.
(() => {
    const manifest = window.__engThemeFonts;
    const root = document.documentElement;
    if (!manifest || !document.fonts || !window.FontFace) return;

    const CACHE = "engmanager-theme-fonts-v1";
    const entries = new Map();
    const dark = matchMedia("(prefers-color-scheme: dark)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fallback = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    let generation = 0;
    let selected = "auto";
    let active = null;
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Start both shared faces now, including Redacted even though it is unused.
    const redacted = document.fonts.load('400 16px "Redacted"').catch(() => []);
    const display = document.fonts.load('900 16px "PP Monument Extended"').catch(() => []);

    async function cachedResponse(url) {
        try {
            const response = await caches.match(url);
            if (response?.ok) return response;
        } catch { /* Private browsing / disabled storage: use the HTTP cache. */ }
        try {
            // This must never turn a cache probe into a network request.
            const response = await fetch(url, { cache: "only-if-cached", mode: "same-origin" });
            if (response.ok) return response;
        } catch { /* Unsupported cache probe or a genuine cache miss. */ }
        return null;
    }

    function entryFor(theme) {
        const spec = manifest[theme];
        if (entries.has(spec.url)) return entries.get(spec.url);
        const entry = { spec, face: null, loaded: false };
        entries.set(spec.url, entry);
        // Share the probe and pending load across rapid repeated selections.
        entry.cached = cachedResponse(spec.url);
        entry.ready = (async () => {
            const cached = await entry.cached;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12000);
            try {
                const response = cached || await fetch(spec.url, { signal: controller.signal });
                if (!response.ok) throw new Error(`Font HTTP ${response.status}`);
                const copy = response.clone();
                const bytes = await response.arrayBuffer();
                const face = new FontFace(spec.family, bytes, { weight: "400", style: "normal" });
                await face.load();
                document.fonts.add(face);
                entry.face = face;
                entry.loaded = true;
                // Cache only valid, decoded fonts. Quota errors do not block rendering.
                if (!cached) {
                    try { await (await caches.open(CACHE)).put(spec.url, copy); } catch {}
                }
                return face;
            } catch (error) {
                entries.delete(spec.url); // A later click can retry a failed load.
                try { await (await caches.open(CACHE)).delete(spec.url); } catch {}
                throw error;
            } finally {
                clearTimeout(timer);
            }
        })();
        // A superseded request can fail while a newer selection is active.
        entry.ready.catch(() => {});
        return entry;
    }

    function syncDocument(doc) {
        if (!active || !doc?.documentElement) return;
        if (doc !== document) doc.fonts.add(active.face);
        doc.documentElement.style.setProperty("--font-body-active", `"${active.spec.family}", ${fallback}`);
        doc.documentElement.dataset.fontTheme = active.theme;
    }

    function activate(entry, theme, state = "ready") {
        active = { ...entry, theme };
        syncDocument(document);
        root.dataset.fontState = state;
        window.dispatchEvent(new CustomEvent("engmanager:fontchange", { detail: { theme, family: entry.spec.family } }));
    }

    async function apply(theme) {
        selected = theme;
        const run = ++generation;
        const resolved = theme === "auto" ? (dark.matches ? "dark" : "light") : theme;
        const target = manifest[resolved] ? resolved : "light";
        root.dataset.fontState = "checking"; // Retain readable text during cache lookup.
        const entry = entryFor(target);
        try {
            if (entry.loaded) {
                activate(entry, target);
                return;
            }
            const cached = await entry.cached;
            if (run !== generation) return;
            let animated = false;
            if (!cached) {
                const faces = await Promise.race([redacted, entry.ready.then(() => [])]);
                if (run !== generation) return;
                if (faces.length && !entry.loaded) {
                    root.dataset.fontState = "loading";
                    animated = true;
                }
            }
            await entry.ready;
            if (run !== generation) return;
            if (animated && !reduced.matches) {
                root.dataset.fontState = "leaving";
                await delay(140);
                if (run !== generation) return;
            }
            activate(entry, target, animated && !reduced.matches ? "entering" : "ready");
            if (root.dataset.fontState === "entering") {
                await delay(220);
                if (run !== generation) return;
                root.dataset.fontState = "ready";
            }
        } catch {
            // Keep the last readable face (or system fallback), never stranded bars.
            if (run === generation) root.dataset.fontState = "error";
        }
    }

    const api = window.__engTypography = {
        ready: Promise.resolve(), displayReady: display, syncDocument,
        apply(theme) { return api.ready = apply(theme); },
    };
    dark.addEventListener("change", () => { if (selected === "auto") api.apply("auto"); });
})();
