// Reading is a completed article, not an opened reveal card. Keep this small
// registry independent of clicked/visited styling and of the playful cleanup.
(() => {
    if (window.__engReading) return;
    const KEY = 'engmanager.reading-progress.v1';
    const VERSION = 1;
    const MAX_ARTICLES = 512;
    const LEGACY_LAP = 'legacy';
    let articles = [], completed = new Set(), lap = LEGACY_LAP, unpersistedResetBase = null;
    const listeners = new Set();
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    function stored() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw || raw.length > 65536) return { lap: LEGACY_LAP, completed: [] };
            const value = JSON.parse(raw);
            if (value?.version !== VERSION || !Array.isArray(value.completed)) return { lap: LEGACY_LAP, completed: [] };
            if (value.lap !== undefined && (typeof value.lap !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(value.lap))) return { lap: LEGACY_LAP, completed: [] };
            return {
                lap: value.lap || LEGACY_LAP,
                completed: value.completed.slice(0, MAX_ARTICLES).filter((slug) => typeof slug === 'string' && slugPattern.test(slug)),
            };
        } catch { return null; }
    }

    function retain(slugs) {
        const known = new Set(articles.map((article) => article.slug));
        return new Set(slugs.filter((slug) => known.has(slug)));
    }

    function persist() {
        try {
            localStorage.setItem(KEY, JSON.stringify({ version: VERSION, lap, completed: [...completed] }));
            unpersistedResetBase = null;
        }
        catch { /* Disabled or full storage still keeps this document's progress. */ }
    }

    function mergeStored() {
        const value = stored();
        if (!value) return;
        if (value.lap === unpersistedResetBase) return;
        // A reset starts a different lap. Delayed storage events must never
        // allow a tab's old in-memory reads to spill into that fresh lap.
        if (value.lap !== lap) unpersistedResetBase = null;
        completed = retain(value.lap === lap ? [...completed, ...value.completed] : value.completed);
        lap = value.lap;
    }

    function nextArticle() {
        return articles.find((article) => !completed.has(article.slug)) || null;
    }

    function snapshot() {
        return {
            version: VERSION,
            completed: articles.filter((article) => completed.has(article.slug)).map((article) => article.slug),
            total: articles.length,
            allComplete: articles.length > 0 && completed.size === articles.length,
            nextSlug: nextArticle()?.slug || null,
        };
    }

    function notify() {
        const value = snapshot();
        for (const listener of listeners) { try { listener(value); } catch {} }
        window.dispatchEvent(new CustomEvent('eng:readingprogress', { detail: value }));
    }

    function configure(manifest) {
        const source = Array.isArray(manifest) ? manifest : manifest?.articles;
        if (!Array.isArray(source)) return;
        const seen = new Set();
        const previous = JSON.stringify(snapshot());
        articles = source.slice(0, MAX_ARTICLES).filter((article) => {
            if (!article || typeof article.slug !== 'string' || !slugPattern.test(article.slug)
                || article.slug === 'big-personality' || article.path !== `/articles/${article.slug}`
                || typeof article.title !== 'string' || seen.has(article.slug)) return false;
            seen.add(article.slug);
            return true;
        }).map((article) => ({ ...article }));
        completed = retain([...completed]);
        mergeStored();
        if (JSON.stringify(snapshot()) !== previous) notify();
    }

    function complete(slug) {
        if (!articles.some((article) => article.slug === slug)) return false;
        const previous = JSON.stringify(snapshot());
        mergeStored();
        const added = !completed.has(slug);
        completed.add(slug);
        if (added) persist();
        if (added || JSON.stringify(snapshot()) !== previous) notify();
        return added;
    }

    function reset() {
        unpersistedResetBase = unpersistedResetBase || lap;
        lap = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        completed = new Set();
        persist(); notify();
    }

    window.__engReading = {
        snapshot, nextArticle, complete, configure, reset,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    };
    window.addEventListener('storage', (event) => {
        if (event.key !== KEY && event.key !== null) return;
        const previous = JSON.stringify(snapshot());
        const value = stored();
        if (!value) return;
        if (value.lap === unpersistedResetBase) return;
        unpersistedResetBase = null;
        lap = value.lap;
        completed = retain(value.completed);
        if (JSON.stringify(snapshot()) !== previous) notify();
    });
    configure(window.__journeyArticles);
})();
