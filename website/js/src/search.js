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
});
