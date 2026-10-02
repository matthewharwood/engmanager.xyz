// The manifest contains URLs, not @font-face rules: unselected faces never fetch.
// FontFace.load() resolves after decoding; a storage flag or fonts.check() alone
// cannot establish that a particular font is actually available in the browser.
(() => {
    const manifest = window.__engThemeFonts;
    const sharedSpecs = window.__engSharedFonts || {};
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

    const shared = new Map();

    function loadShared(role, query) {
        const existing = shared.get(role);
        if (existing && existing.state !== "error") return existing.ready;
        const record = { state: "loading", ready: null };
        shared.set(role, record);
        record.ready = (async () => {
            try {
                // Explicit text also exercises Redacted's non-space glyphs.
                const faces = await within(document.fonts.load(query, "Loading"), 1000);
                if (faces.length) {
                    record.state = "ready";
                    return faces;
                }
            } catch { /* A failed CSS FontFace stays failed; load a replacement. */ }
            try {
                const spec = sharedSpecs[role];
                if (!spec) throw new Error("Missing shared font");
                const face = await entryFor(spec).ready;
                record.face = face;
                record.state = "ready";
                window.dispatchEvent(new CustomEvent("engmanager:fontchange", { detail: { role, family: spec.family } }));
                return [face];
            } catch {
                record.state = "error";
                return [];
            }
        })();
        return record.ready;
    }

    // Start both shared faces now, including Redacted even though it is unused.
    const loadDisplay = () => loadShared("display", '900 16px "PP Monument Extended"');
    const loadRedacted = () => loadShared("redacted", '400 16px "Redacted"');
    loadDisplay();
    loadRedacted();

    // Cache Storage is optional. In particular, a suspended/private mobile
    // storage backend must not hold the selected font behind an unsettled probe.
    async function probe(read) {
        let timer;
        try {
            return await Promise.race([
                read(),
                new Promise((resolve) => { timer = setTimeout(() => resolve(null), 250); }),
            ]);
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    async function within(promise, ms) {
        let timer;
        try {
            return await Promise.race([
                promise,
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Font load timeout")), ms); }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    async function cachedResponse(url) {
        const stored = await probe(() => caches.match(url));
        if (stored?.ok) return stored;
        // This must never turn a cache probe into a network request.
        const response = await probe(() => fetch(url, { cache: "only-if-cached", mode: "same-origin" }));
        return response?.ok ? response : null;
    }

    async function forget(url) {
        try { await (await caches.open(CACHE)).delete(url); } catch {}
    }

    async function decode(spec, response) {
        if (!response.ok) throw new Error(`Font HTTP ${response.status}`);
        const face = new FontFace(spec.family, await response.arrayBuffer(), { weight: spec.weight || "400", style: "normal" });
        await face.load();
        return face;
    }

    function entryFor(spec) {
        if (entries.has(spec.url)) return entries.get(spec.url);
        const entry = { spec, face: null, loaded: false };
        entries.set(spec.url, entry);
        // Share the probe and pending load across rapid repeated selections.
        entry.cached = cachedResponse(spec.url);
        entry.ready = (async () => {
            const cached = await entry.cached;
            const controller = new AbortController();
            const deadline = Date.now() + 12000;
            const timer = setTimeout(() => controller.abort(), 12000);
            try {
                let face;
                if (cached) {
                    try { face = await within(decode(spec, cached), 1000); }
                    catch {
                        // An interrupted/corrupt cached response is not a reason
                        // to strand this visit in a fallback until another click.
                        void forget(spec.url);
                    }
                }
                if (!face) {
                    // One retry handles a brief mobile connection failure. The
                    // shared deadline and two-attempt cap prevent a retry loop.
                    for (let attempt = 0; !face; attempt++) {
                        try {
                            const response = await fetch(spec.url, {
                                signal: controller.signal,
                                ...(cached || attempt ? { cache: "reload" } : {}),
                            });
                            const copy = response.clone();
                            face = await within(decode(spec, response), Math.max(0, deadline - Date.now()));
                            // The font is usable now. Persisting it must not gate
                            // paint, even when a mobile write never settles.
                            void (async () => {
                                try { await (await caches.open(CACHE)).put(spec.url, copy); } catch {}
                            })();
                        } catch (error) {
                            if (attempt || controller.signal.aborted) throw error;
                            await delay(500);
                        }
                    }
                }
                document.fonts.add(face);
                entry.face = face;
                entry.loaded = true;
                return face;
            } catch (error) {
                entries.delete(spec.url); // Resume / route / theme changes can retry.
                void forget(spec.url);
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
        if (!doc?.documentElement) return;
        if (doc !== document) {
            // Preview CSS faces can fail during the same outage. Share decoded
            // replacements instead of asking that sticky failed face to retry.
            for (const record of shared.values()) if (record.face) doc.fonts.add(record.face);
            if (active) doc.fonts.add(active.face);
        }
        if (!active) return;
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
        const entry = entryFor(manifest[target]);
        try {
            if (entry.loaded) {
                activate(entry, target);
                return;
            }
            const cached = await entry.cached;
            if (run !== generation) return;
            let animated = false;
            if (!cached) {
                const faces = await Promise.race([loadRedacted(), entry.ready.then(() => [])]);
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
        ready: Promise.resolve(), get displayReady() { return shared.get("display").ready; }, syncDocument,
        apply(theme) { return api.ready = apply(theme); },
    };
    const retry = () => Promise.all([
        root.dataset.fontState === "error" ? api.apply(selected) : api.ready,
        loadDisplay(), loadRedacted(),
    ]);
    window.addEventListener("online", retry);
    window.addEventListener("pageshow", retry);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") retry();
    });
    window.__engNav?.onSwap?.(retry);
    dark.addEventListener("change", () => { if (selected === "auto") api.apply("auto"); });
})();
