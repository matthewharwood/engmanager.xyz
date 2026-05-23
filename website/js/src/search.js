const forms = Array.from(document.querySelectorAll("[data-search-form]"));

forms.forEach((form, formIndex) => {
    const input = form.querySelector("input[type='search']");
    const list = form.querySelector("[data-search-results]");
    if (!input || !list) return;

    const listId = list.id || `site-search-results-${formIndex}`;
    list.id = listId;
    input.setAttribute("aria-controls", listId);

    let debounce = 0;
    let controller = null;
    let items = [];
    let activeIndex = -1;

    const close = () => {
        list.hidden = true;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        activeIndex = -1;
        items.forEach((item) => item.classList.remove("is-active"));
    };

    const setActive = (nextIndex) => {
        if (!items.length) return;
        items.forEach((item) => item.classList.remove("is-active"));
        activeIndex = (nextIndex + items.length) % items.length;
        const item = items[activeIndex];
        item.classList.add("is-active");
        input.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView({ block: "nearest" });
    };

    const render = (hits) => {
        list.replaceChildren();
        items = hits.map((hit, index) => {
            const item = document.createElement("li");
            item.id = `${listId}-option-${index}`;
            item.setAttribute("role", "option");
            item.className = "site-search-result";

            const link = document.createElement("a");
            link.href = hit.url;

            const title = document.createElement("span");
            title.className = "site-search-result-title";
            title.textContent = hit.title;

            const detail = document.createElement("span");
            detail.className = "site-search-result-detail";
            detail.textContent = hit.detail || hit.kind;

            link.append(title, detail);
            item.append(link);
            list.append(item);
            return item;
        });

        if (items.length) {
            list.hidden = false;
            input.setAttribute("aria-expanded", "true");
            activeIndex = -1;
        } else {
            close();
        }
    };

    const fetchResults = async () => {
        const value = input.value.trim();
        if (value.length < 2) {
            controller?.abort();
            close();
            return;
        }

        controller?.abort();
        controller = new AbortController();
        try {
            const response = await fetch(
                `/api/search/typeahead?q=${encodeURIComponent(value)}`,
                { signal: controller.signal, headers: { Accept: "application/json" } },
            );
            if (!response.ok) return;
            render(await response.json());
        } catch (error) {
            if (error.name !== "AbortError") close();
        }
    };

    input.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(fetchResults, 150);
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive(activeIndex + 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(activeIndex - 1);
        } else if (event.key === "Enter" && activeIndex >= 0 && items[activeIndex]) {
            event.preventDefault();
            const link = items[activeIndex].querySelector("a");
            if (link) window.location.assign(link.href);
        } else if (event.key === "Escape") {
            close();
        } else if (event.key === "Tab") {
            close();
        }
    });

    document.addEventListener("pointerdown", (event) => {
        if (!form.contains(event.target)) close();
    });

    initHomeKeyboard(form, input, close);
});

function initHomeKeyboard(form, input, closeResults) {
    if (!form.classList.contains("home-search")) return;
    if (!window.matchMedia?.("(min-width: 48em) and (hover: hover) and (pointer: fine)").matches) {
        return;
    }

    const keyboard = document.createElement("div");
    keyboard.className = "home-keyboard";
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
        row.className = "home-keyboard-row";
        rowKeys.forEach((keyConfig) => {
            const config =
                typeof keyConfig === "string"
                    ? { label: keyConfig, text: keyConfig.toLowerCase() }
                    : keyConfig;
            const key = document.createElement("button");
            key.type = "button";
            key.tabIndex = -1;
            key.className = "home-key";
            key.textContent = config.label;
            if (config.wide) key.classList.add("home-key-wide");
            if (config.accent) key.classList.add("home-key-accent");
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
    document.addEventListener("pointerdown", (event) => {
        if (!form.contains(event.target)) hideKeyboard();
    });
}
