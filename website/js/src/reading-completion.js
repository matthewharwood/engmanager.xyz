// Build-time CSS bindings. Identity forms keep direct-source tests readable;
// build.rs replaces calls with literals and Oxc removes unused helpers.
var cssClasses = value => value, cssSelector = value => value, cssToken = value => value, cssHtml = value => value;

// The feed's last act: first clear the writing, then clear its tags.
// Clicked/visited rows do not unlock it; only the journey's completed reads do.
(() => {
    if (window.__engReadingCompletion) return;

    const STORAGE_KEY = "engmanager.reading-cleanup.v1";
    const MAX_ITEMS = 512;
    const validKey = (key) => typeof key === "string" && key.length > 0 && key.length <= 160;
    const keys = (value) => new Set(Array.isArray(value) ? value.slice(0, MAX_ITEMS).filter(validKey) : []);
    const empty = () => ({ articles: new Set(), tags: new Set() });
    const load = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw && raw.length > 65_536) return empty();
            const value = JSON.parse(raw || "null");
            return value?.version === 1 ? { articles: keys(value.articles), tags: keys(value.tags) } : empty();
        } catch {
            return empty();
        }
    };
    let discarded = load();
    let articleSlugs = new Set();
    let tagLabels = new Map();
    let active = false;
    let stage = "";

    const currentPage = () => document.querySelector(cssSelector("[data-journey-current]"))
        || document.querySelector(cssSelector("[data-eng-page]")) || document;
    const save = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: 1, articles: [...discarded.articles], tags: [...discarded.tags],
            }));
        } catch {
            // Disabled storage still leaves this session fully usable.
        }
    };

    function catalog(root) {
        const island = root.querySelector(cssSelector("#articles-data"));
        if (!island) return;
        try {
            const data = JSON.parse(island.textContent || "{}");
            if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid article registry");
            articleSlugs = new Set(Object.keys(data).filter(validKey).slice(0, MAX_ITEMS));
            tagLabels = new Map();
            root.querySelectorAll(cssSelector(".marquee .chip-tag[data-chip-id]")).forEach((chip) => {
                const id = chip.dataset.chipId;
                if (validKey(id) && !tagLabels.has(id) && tagLabels.size < MAX_ITEMS) {
                    tagLabels.set(id, chip.textContent.trim());
                }
            });
            discarded.articles = new Set([...discarded.articles].filter((slug) => articleSlugs.has(slug)));
            discarded.tags = new Set([...discarded.tags].filter((id) => tagLabels.has(id)));
            save();
        } catch {
            // A malformed island must not claim the reader finished the site.
            articleSlugs = new Set();
            tagLabels = new Map();
        }
    }

    function conceal(node, hidden) {
        node.style.opacity = "";
        node.style.pointerEvents = "";
        node.style.visibility = hidden ? "hidden" : "";
        if (hidden) {
            node.dataset.trashed = "true";
            node.dataset.cleanupDiscarded = "true";
        } else {
            delete node.dataset.trashed;
            delete node.dataset.cleanupDiscarded;
        }
    }

    function restoreDiscarded(root) {
        root.querySelectorAll(cssSelector("[data-cleanup-discarded]")).forEach((node) => {
            conceal(node, false);
            if (node.dataset.slug) {
                node.removeAttribute("aria-hidden");
                node.removeAttribute("tabindex");
            }
        });
    }

    function renderTags(panel) {
        const tray = panel.querySelector(cssSelector("[data-reading-completion-tags]"));
        if (!tray) return;
        // Keep remaining controls in place while deleting one; rebuilding the
        // whole tray would drop keyboard focus and lose pointer captures.
        const remaining = new Set(stage === "tags"
            ? [...tagLabels.keys()].filter((id) => !discarded.tags.has(id)) : []);
        tray.querySelectorAll(cssSelector("[data-chip-id]")).forEach((chip) => {
            if (remaining.has(chip.dataset.chipId)) remaining.delete(chip.dataset.chipId);
            else chip.remove();
        });
        for (const id of remaining) {
            const chip = document.createElement("span");
            chip.className = cssClasses("chip chip-tag");
            chip.dataset.chipId = id;
            chip.textContent = tagLabels.get(id);
            chip.setAttribute("role", "button");
            chip.tabIndex = 0;
            chip.setAttribute("aria-label", `Move ${tagLabels.get(id)} to trash`);
            tray.append(chip);
        }
        tray.hidden = stage !== "tags";
    }

    function refresh() {
        const root = currentPage();
        const panel = root.querySelector(cssSelector("[data-reading-completion]"));
        const snapshot = window.__engReading?.snapshot?.();
        active = !!snapshot?.allComplete && articleSlugs.size > 0;
        const articlesLeft = [...articleSlugs].filter((slug) => !discarded.articles.has(slug)).length;
        const tagsLeft = [...tagLabels.keys()].filter((id) => !discarded.tags.has(id)).length;
        stage = active ? (articlesLeft ? "articles" : tagsLeft ? "tags" : "finished") : "";
        if (!active) {
            // Retained feed pages need the same restoration even if reading
            // was reset while an article or the shop is currently active.
            restoreDiscarded(document);
            document.querySelectorAll(cssSelector("[data-cleanup-keyboard]")).forEach((link) => {
                link.removeAttribute("aria-keyshortcuts");
                link.removeAttribute("aria-description");
                delete link.dataset.cleanupKeyboard;
            });
        }
        if (!panel) return;

        panel.hidden = !active;
        panel.dataset.stage = stage;
        if (!active) {
            return;
        }

        root.querySelectorAll(cssSelector(".article-fluid-link[data-slug]")).forEach((link) => {
            const hidden = discarded.articles.has(link.dataset.slug);
            link.classList.add(cssToken("is-visited"));
            conceal(link, hidden);
            if (hidden) {
                link.setAttribute("aria-hidden", "true");
                link.tabIndex = -1;
            } else {
                link.removeAttribute("aria-hidden");
                link.removeAttribute("tabindex");
                link.dataset.cleanupKeyboard = "true";
                link.setAttribute("aria-keyshortcuts", "Delete Backspace");
                link.setAttribute("aria-description", "Press Delete or Backspace to move this article to the trash.");
            }
        });
        root.querySelectorAll(cssSelector(".marquee .chip-tag[data-chip-id]")).forEach((chip) => {
            conceal(chip, discarded.tags.has(chip.dataset.chipId));
        });

        const set = (selector, text) => {
            const node = panel.querySelector(selector);
            if (node && node.textContent !== text) node.textContent = text;
        };
        set("[data-reading-completion-title]", stage === "articles"
            ? "Congratulations, you’ve read all my work."
            : stage === "tags" ? "Now drag all the tags and finish the job." : "A clean slate.");
        set("[data-reading-completion-copy]", stage === "articles"
            ? "Now drag it all to the trash. Grab each checked article, or focus its title and press Delete or Backspace."
            : stage === "tags" ? "The writing is gone. Toss each remaining tag into the same bin, or focus it and press Enter."
                : "Keep what stayed with you. Leave the rest here.");
        set("[data-reading-completion-count]", stage === "articles"
            ? `${articlesLeft} ${articlesLeft === 1 ? "article" : "articles"} left`
            : stage === "tags" ? `${tagsLeft} ${tagsLeft === 1 ? "tag" : "tags"} left` : "All done.");
        const reset = panel.querySelector(cssSelector("[data-reading-completion-reset]"));
        if (reset) reset.hidden = stage !== "finished";
        const count = root.querySelector(cssSelector("[data-trash-count]"));
        if (count) {
            const total = discarded.articles.size + discarded.tags.size;
            count.textContent = String(total);
            count.dataset.trashCount = String(total);
        }
        renderTags(panel);
        document.dispatchEvent(new CustomEvent("engmanager:cleanupready"));
    }

    function canTrash(type, key) {
        if (!active) return true;
        if (type === "article") return stage === "articles" && articleSlugs.has(key) && !discarded.articles.has(key);
        if (type === "tag") return stage === "tags" && tagLabels.has(key) && !discarded.tags.has(key);
        return true;
    }

    function recordTrash(type, key) {
        if (!active || !canTrash(type, key)) return;
        if (type === "article") discarded.articles.add(key);
        else if (type === "tag") discarded.tags.add(key);
        else return;
        save();
        refresh();
    }

    function reset() {
        discarded = empty();
        save();
        const root = currentPage();
        restoreDiscarded(document);
        window.__engReading?.reset?.();
        refresh();
        const count = root.querySelector(cssSelector("[data-trash-count]"));
        if (count) {
            count.textContent = "0";
            count.dataset.trashCount = "0";
        }
        document.dispatchEvent(new CustomEvent("engmanager:cleanupready"));
        const heading = root.querySelector(cssSelector("h1"));
        if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
        }
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }

    function init() {
        catalog(currentPage());
        refresh();
    }

    window.__engReadingCompletion = { refresh, canTrash, recordTrash, reset,
        snapshot: () => ({ active, stage, articles: [...discarded.articles], tags: [...discarded.tags] }),
    };
    window.addEventListener("eng:readingprogress", refresh);
    window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY && event.key !== null) return;
        discarded = load();
        init();
    });
    window.addEventListener("pageshow", init);
    document.addEventListener("click", (event) => {
        if (!event.target.closest?.(cssSelector("[data-reading-completion-reset]"))) return;
        event.preventDefault();
        reset();
    });
    window.__engNav?.onSwap?.(init);
    if (document.prerendering) document.addEventListener("prerenderingchange", init, { once: true });
    else init();
})();
