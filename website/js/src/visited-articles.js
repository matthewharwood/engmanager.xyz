// Persisted read-state + gacha-style reveal card for the homepage
// article stack.
//
// Click flow on an unread article:
//   1. preventDefault — the Speculation Rules experience prerenders
//      every /articles/* link, so a raw click would auto-navigate
//      instantly.
//   2. Add `.is-visited` + `.is-visited-fresh` to the link — the
//      checkbox fills and the strike sweeps across the title.
//   3. Persist the slug to localStorage and broadcast it to other
//      open tabs.
//   4. After REVEAL_DELAY_MS, populate the shared #article-reveal
//      popover from the JSON island (#articles-data) and open it
//      with the brutalist spring-overshoot entrance.
//   5. The reveal card has two actions:
//        Read →  navigates to /articles/{slug} (uses the prerender)
//        Close   keeps the reader on the homepage; visited state stays
//      Either action also fires when the popover is dismissed by
//      Esc / outside-click — there's nothing time-gated, the reader
//      decides when to leave.

const STORAGE_KEY = "engmanager.visited-articles";
const REVEAL_DELAY_MS = 320;

// JSON island parsed once on script load. Keyed by slug.
const articlesData = (() => {
    try {
        const raw = document.getElementById("articles-data")?.textContent;
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
})();

const loadVisited = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
};

const saveVisited = (set) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {
        // Quota exceeded / Safari private mode / disabled storage.
        // Visited state still works for the current page load.
    }
};

(() => {
    const links = Array.from(document.querySelectorAll(".article-fluid-link"));
    if (!links.length) return;

    const visited = loadVisited();

    // Initial hydration: mark previously-read articles immediately so
    // the strike + checkmark are already in place at first paint.
    links.forEach((link) => {
        const slug = link.dataset.slug;
        if (slug && visited.has(slug)) {
            link.classList.add("is-visited");
        }
    });

    links.forEach((link) => {
        link.addEventListener("click", (event) => {
            const slug = link.dataset.slug;
            if (!slug) return;

            // Already visited → let normal navigation happen.
            if (visited.has(slug)) return;

            // Modifier-clicks / middle-click / non-primary → open in
            // new tab without the reveal flow so the user's intent
            // is honored.
            if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                visited.add(slug);
                saveVisited(visited);
                link.classList.add("is-visited");
                return;
            }

            event.preventDefault();
            visited.add(slug);
            saveVisited(visited);
            link.classList.add("is-visited", "is-visited-fresh");

            // Notifies the Broadcast Channel experience so other tabs
            // get the same strike-through in real time.
            document.dispatchEvent(
                new CustomEvent("engmanager:visited", { detail: { slug } }),
            );

            // After the strike + check have started painting, open the
            // gacha-style reveal card. The reader stays in control —
            // no auto-navigation; they tap "Read →" when ready.
            const data = articlesData[slug];
            const href = link.href;
            setTimeout(() => openReveal(slug, data, href), REVEAL_DELAY_MS);
        });
    });
})();

// =============================================================================
// Reveal card
// =============================================================================

function openReveal(slug, data, href) {
    const modal = document.getElementById("article-reveal");
    if (!modal || !data) {
        // No card or no data — fall back to plain navigation.
        if (href) location.href = href;
        return;
    }

    const set = (sel, value) => {
        const el = modal.querySelector(sel);
        if (el) el.textContent = value;
    };
    set("[data-reveal-emoji]", data.category?.emoji || "⌬");
    set("[data-reveal-category]", data.category?.label || "Article");
    set("[data-reveal-title]", data.title || slug);
    set("[data-reveal-date]", data.date || "");
    set("[data-reveal-summary]", data.summary || "");

    const tagsEl = modal.querySelector("[data-reveal-tags]");
    if (tagsEl) {
        tagsEl.replaceChildren();
        (data.tags || []).forEach((tag) => {
            const chip = document.createElement("span");
            chip.className = "reveal-card-tag";
            const emoji = document.createElement("span");
            emoji.setAttribute("aria-hidden", "true");
            emoji.textContent = tag.emoji || "";
            const label = document.createElement("span");
            label.textContent = tag.label || "";
            chip.append(emoji, " ", label);
            tagsEl.appendChild(chip);
        });
    }

    const continueLink = modal.querySelector("[data-reveal-continue]");
    if (continueLink) {
        continueLink.setAttribute("href", href || data.href || "#");
    }

    modal.showPopover();

    // Focus the primary action so Enter dismisses with a Read.
    requestAnimationFrame(() => {
        continueLink?.focus();
    });
}
