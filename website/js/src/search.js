// Build-time CSS bindings. Identity forms keep direct-source tests readable;
// build.rs replaces calls with literals and Oxc removes unused helpers.
var cssClasses = value => value, cssSelector = value => value, cssToken = value => value, cssHtml = value => value;

// Typeahead search binding (JS_ROUTER_CONSTRAINTS §2.1).
//
// bind(root) attaches once per form (data-search-bound guard) so the
// soft-nav router can rescan swapped-in markup; the immediate
// bind(document) call preserves the original load-time behavior when
// the router/bootstrap is absent. All outside-pointerdown closers
// share ONE document listener that prunes detached forms instead of
// stacking a listener per form per page.
(() => {
    // { form, close } entries; detached forms are pruned lazily.
    const outsideClosers = new Set();
    const formClosers = new WeakMap();
    const addCloser = (form, close, suspend) => {
        const entry = { form, close, suspend };
        const entries = formClosers.get(form) || [];
        entries.push(entry);
        formClosers.set(form, entries);
        outsideClosers.add(entry);
    };
    document.addEventListener("pointerdown", (event) => {
        for (const entry of outsideClosers) {
            if (!entry.form.isConnected) {
                outsideClosers.delete(entry);
                continue;
            }
            if (!entry.form.contains(event.target)) entry.close();
        }
    });

    let formCounter = 0;

    function bind(root) {
        root.querySelectorAll(cssSelector("[data-search-form]")).forEach((form) => {
            if (form.dataset.searchBound) {
                // A previous outlet's forms keep their element listeners, but
                // the outside-click set may have pruned them while detached.
                for (const entry of formClosers.get(form) || []) outsideClosers.add(entry);
                return;
            }
            form.dataset.searchBound = "true";
            const formIndex = formCounter++;

            const input = form.querySelector(cssSelector("input[type='search']"));
            const list = form.querySelector(cssSelector("[data-search-results]"));
            if (!input || !list) return;

            const listId = list.id || `site-search-results-${formIndex}`;
            list.id = listId;
            input.setAttribute("aria-controls", listId);

            const preview = form.querySelector(cssSelector("[data-search-preview]"));
            const empty = form.querySelector(cssSelector("[data-search-empty]"));
            const status = form.querySelector(cssSelector("[data-search-status]"));
            const filters = [...form.querySelectorAll(cssSelector("[data-search-kind]"))];
            const labels = { article: "Articles", product: "Store", coaching: "Coaching", subscription: "Subscription" };
            const actions = { article: "Read article", product: "View in store", coaching: "Explore coaching", subscription: "Subscribe for free" };
            let kind = "";
            let debounce = 0;
            let controller = null;
            let items = [];
            let hits = [];
            let activeIndex = -1;

            const icon = (kind) => {
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("viewBox", "0 0 24 24");
                svg.setAttribute("aria-hidden", "true");
                svg.setAttribute("focusable", "false");
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "currentColor");
                svg.setAttribute("stroke-width", "1.5");
                svg.setAttribute("stroke-linejoin", "round");
                const paths = {
                    article: ["M5 3h10l4 4v14H5Z", "M15 3v5h4M8 12h8M8 16h6"],
                    product: ["M12 4 21 20H3Z"],
                    coaching: ["M14 9a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z", "M20 15a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z"],
                    subscription: ["M3 5h18v14H3Z", "m3 6 9 7 9-7"],
                };
                for (const d of paths[kind] || paths.article) {
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", d);
                    svg.append(path);
                }
                return svg;
            };
            const text = (tag, className, value) => {
                const node = document.createElement(tag);
                node.className = className;
                node.textContent = value;
                return node;
            };
            const showPreview = (hit) => {
                if (!preview) return;
                preview.replaceChildren();
                if (!hit) {
                    preview.append(text("p", "site-search-preview-placeholder", "A closer look. Focus a result to preview it here."));
                    return;
                }
                const category = text("p", "site-search-preview-kind", labels[hit.kind] || hit.kind);
                category.prepend(icon(hit.kind));
                preview.append(category);
                if (hit.image && hit.kind === "product") {
                    const image = document.createElement("img");
                    image.src = hit.image;
                    image.alt = hit.title;
                    image.className = cssClasses("site-search-preview-image");
                    image.decoding = "async";
                    preview.append(image);
                }
                preview.append(text("p", "site-search-preview-meta", hit.meta || ""));
                preview.append(text("h2", "site-search-preview-title", hit.title));
                preview.append(text("p", "site-search-preview-detail", hit.detail || ""));
                if (hit.sections?.length) {
                    preview.append(text("p", "site-search-preview-section-label", hit.kind === "article" ? "In this article" : "What to expect"));
                    const sections = document.createElement("ul");
                    sections.className = cssClasses("site-search-preview-sections");
                    hit.sections.forEach(section => sections.append(text("li", "", section)));
                    preview.append(sections);
                }
                const link = text("a", "site-search-preview-link", `${actions[hit.kind] || "Open result"} ↗`);
                link.href = hit.url;
                preview.append(link);
            };
            const close = () => {
                clearTimeout(debounce);
                controller?.abort();
                list.hidden = true;
                input.setAttribute("aria-expanded", "false");
                input.removeAttribute("aria-activedescendant");
                activeIndex = -1;
                items.forEach(item => { item.classList.remove(cssToken("is-active")); item.setAttribute("aria-selected", "false"); });
                if (status) status.textContent = "";
                showPreview(null);
            };
            const setActive = (nextIndex, scroll = true) => {
                if (!items.length || list.hidden) return;
                activeIndex = (nextIndex + items.length) % items.length;
                items.forEach((item, index) => {
                    item.classList.toggle(cssToken("is-active"), index === activeIndex);
                    item.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
                });
                const item = items[activeIndex];
                input.setAttribute("aria-activedescendant", item.id);
                if (scroll) item.scrollIntoView({ block: "nearest" });
                showPreview(hits[activeIndex]);
            };
            const render = (results) => {
                list.replaceChildren();
                hits = [];
                items = [];
                for (const group of Object.keys(labels)) {
                    const groupHits = results.filter(hit => hit.kind === group);
                    if (!groupHits.length) continue;
                    const heading = text("li", "site-search-group", labels[group]);
                    heading.setAttribute("role", "presentation");
                    heading.prepend(icon(group));
                    if (preview) list.append(heading);
                    for (const hit of groupHits) {
                        const index = items.length;
                        const item = document.createElement("li");
                        item.id = `${listId}-option-${index}`;
                        item.setAttribute("role", "option");
                        item.setAttribute("aria-selected", "false");
                        item.className = cssClasses("site-search-result");
                        const link = document.createElement("a");
                        link.href = hit.url;
                        link.tabIndex = preview ? -1 : 0;
                        const copy = document.createElement("span");
                        copy.append(text("span", "site-search-result-title", hit.title));
                        copy.append(text("span", "site-search-result-detail", hit.meta || hit.detail || hit.kind));
                        if (preview) link.append(icon(hit.kind));
                        link.append(copy);
                        item.append(link);
                        item.addEventListener("pointerenter", () => setActive(index, false));
                        link.addEventListener("focus", () => setActive(index, false));
                        list.append(item);
                        hits.push(hit);
                        items.push(item);
                    }
                }
                list.hidden = !items.length;
                input.setAttribute("aria-expanded", items.length ? "true" : "false");
                if (empty) {
                    empty.hidden = !!items.length;
                    empty.textContent = "No matches here. Try another topic or category.";
                }
                if (status) status.textContent = `${items.length} result${items.length === 1 ? "" : "s"}${kind ? ` in ${labels[kind]}` : ""}.`;
                activeIndex = -1;
                if (items.length) setActive(0, false);
                else { input.removeAttribute("aria-activedescendant"); showPreview(null); }
            };
            const fetchResults = async () => {
                const value = input.value.trim();
                if (value.length === 1 || (!preview && value.length < 2)) {
                    close();
                    if (empty) { empty.hidden = false; empty.textContent = "Type at least two letters to search."; }
                    return;
                }
                close();
                if (empty) { empty.hidden = false; empty.textContent = "Searching…"; }
                if (status) status.textContent = "Searching.";
                const requestController = new AbortController();
                controller = requestController;
                const requestedKind = kind;
                try {
                    const response = await fetch(`/api/search/typeahead?q=${encodeURIComponent(value)}${kind ? `&kind=${kind}` : ""}`, {
                        signal: requestController.signal, headers: { Accept: "application/json" },
                    });
                    if (!response.ok) throw new Error("Search unavailable");
                    const results = await response.json();
                    if (!requestController.signal.aborted && form.isConnected && value === input.value.trim() && kind === requestedKind) render(results);
                } catch (error) {
                    if (error.name !== "AbortError" && !requestController.signal.aborted) {
                        close();
                        if (empty) { empty.hidden = false; empty.textContent = "Search is taking a break. Press Enter to try the full search."; }
                    }
                }
            };
            filters.forEach(button => button.addEventListener("click", () => {
                kind = button.dataset.searchKind;
                filters.forEach(filter => filter.setAttribute("aria-pressed", filter === button ? "true" : "false"));
                fetchResults();
            }));
            input.addEventListener("focus", () => { if (preview) fetchResults(); });
            input.addEventListener("input", () => {
                close();
                if (empty) { empty.hidden = false; empty.textContent = "Searching…"; }
                debounce = setTimeout(fetchResults, 150);
            });
            input.addEventListener("keydown", event => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
                } else if (event.key === "Enter" && activeIndex >= 0 && items[activeIndex] && !list.hidden) {
                    event.preventDefault();
                    const link = items[activeIndex].querySelector(cssSelector("a"));
                    if (link) window.location.assign(link.href);
                } else if (event.key === "Escape" || (event.key === "Tab" && !preview)) close();
            });
            form.closest(cssSelector("[data-search-overlay]"))?.addEventListener("close", close);
            addCloser(form, close, () => { clearTimeout(debounce); controller?.abort(); });

            initHomeKeyboard(form, input, close);
        });
    }

    function initHomeKeyboard(form, input, closeResults) {
        if (!form.classList.contains(cssToken("home-search"))) return;
        if (!window.matchMedia?.("(min-width: 48em) and (hover: hover) and (pointer: fine)").matches) {
            return;
        }

        const keyboard = document.createElement("div");
        keyboard.className = cssClasses("home-keyboard");
        keyboard.hidden = true;
        keyboard.setAttribute("aria-label", "Clickable search keyboard");

        const rows = [
            ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
            ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
            ["Z", "X", "C", "V", "B", "N", "M", { label: "DEL", action: "backspace" }],
            [
                { label: "AI", text: "ai" },
                { label: "RUST", text: "rust" },
                { label: "VOICE", text: "voice" },
                { label: "SPACE", action: "space", wide: true },
                { label: "CLEAR", action: "clear" },
                { label: "GO", action: "submit", accent: true },
            ],
        ];

        rows.forEach((rowKeys) => {
            const row = document.createElement("div");
            row.className = cssClasses("home-keyboard-row");
            rowKeys.forEach((keyConfig) => {
                const config =
                    typeof keyConfig === "string"
                        ? { label: keyConfig, text: keyConfig.toLowerCase() }
                        : keyConfig;
                const key = document.createElement("button");
                key.type = "button";
                key.tabIndex = -1;
                key.className = cssClasses("home-key");
                key.textContent = config.label;
                if (config.wide) key.classList.add(cssToken("home-key-wide"));
                if (config.accent) key.classList.add(cssToken("home-key-accent"));
                key.addEventListener("pointerdown", (event) => {
                    event.preventDefault();
                });
                key.addEventListener("click", () => {
                    pressHomeKey(config);
                });
                row.append(key);
            });
            keyboard.append(row);
        });

        form.append(keyboard);
        input.setAttribute("virtualkeyboardpolicy", "manual");

        function showKeyboard() {
            keyboard.hidden = false;
            form.dataset.keyboardOpen = "true";
        }

        function hideKeyboard() {
            keyboard.hidden = true;
            delete form.dataset.keyboardOpen;
        }

        function pressHomeKey(config) {
            input.focus({ preventScroll: true });
            if (config.action === "backspace") {
                backspace();
            } else if (config.action === "space") {
                insertText(" ");
            } else if (config.action === "clear") {
                input.value = "";
                dispatchInput();
                closeResults();
            } else if (config.action === "submit") {
                form.requestSubmit();
            } else {
                insertText(config.text || "");
            }
        }

        function insertText(text) {
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
            const next = start + text.length;
            input.setSelectionRange(next, next);
            dispatchInput();
        }

        function backspace() {
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            if (start !== end) {
                input.value = `${input.value.slice(0, start)}${input.value.slice(end)}`;
                input.setSelectionRange(start, start);
            } else if (start > 0) {
                input.value = `${input.value.slice(0, start - 1)}${input.value.slice(start)}`;
                input.setSelectionRange(start - 1, start - 1);
            }
            dispatchInput();
        }

        function dispatchInput() {
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }

        input.addEventListener("focus", showKeyboard);
        input.addEventListener("pointerdown", showKeyboard);
        input.addEventListener("keydown", (event) => {
            if (event.key === "Escape") hideKeyboard();
        });
        addCloser(form, hideKeyboard);
    }

    bind(document);
    window.__engNav?.onBeforeSwap?.(() => {
        for (const entry of outsideClosers) {
            entry.suspend?.();
            entry.close();
        }
        outsideClosers.clear();
    });
    window.__engNav?.onSwap?.(bind);
})();
