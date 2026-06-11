// Mobile-only nav: tapping the magnifier toggles the site-search
// form open + focused (and closes it again). The form lives in the
// nav always — CSS hides it on narrow viewports unless the nav
// carries `data-search-open`. On desktop the form is always visible,
// so the toggle button itself is hidden via CSS and this script
// effectively no-ops there.
//
// Soft-nav lifecycle: the nav is a swapped region, so init(root)
// re-binds the fresh toggle after every swap (data-search-toggle-bound
// guard). The Escape / outside-click DOCUMENT listeners are module
// singletons that lazily resolve the CURRENT instance — registered
// once per real page load, never stacked across re-inits.

(() => {
    // Active instance: { nav, toggle, close, isOpen() } — null on pages
    // without a search toggle.
    let current = null;

    // --- Singleton document listeners ---
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && current?.isOpen()) {
            current.close();
            current.toggle.focus();
        }
    });

    // Tap outside the nav to dismiss. The desktop layout shows the
    // search inline always, so we only collapse on viewports where
    // the toggle is actually visible.
    document.addEventListener("click", (e) => {
        if (!current || !current.isOpen()) return;
        if (matchMedia("(min-width: 42rem)").matches) return;
        if (current.nav.contains(e.target)) return;
        current.close();
    });

    function init(root) {
        const toggle = root.querySelector("[data-search-toggle]");
        if (!toggle) {
            current = null;
            return;
        }
        if (toggle.dataset.searchToggleBound) return;
        toggle.dataset.searchToggleBound = "true";
        const nav = toggle.closest(".site-nav");
        if (!nav) {
            current = null;
            return;
        }
        const input = nav.querySelector(".site-search-input");
        if (!input) {
            current = null;
            return;
        }

        let isOpen = false;

        const open = () => {
            isOpen = true;
            nav.setAttribute("data-search-open", "true");
            toggle.setAttribute("aria-expanded", "true");
            toggle.setAttribute("aria-label", "Close search");
            // Mutual exclusion with the Articles dropdown (and any future
            // popover) via the shared registry — opening here dismisses
            // anything else that's currently open.
            window.__engPopovers?.open("nav-search", () => close());
            requestAnimationFrame(() => {
                try {
                    input.focus({ preventScroll: true });
                } catch {
                    input.focus();
                }
            });
        };

        const close = () => {
            isOpen = false;
            nav.removeAttribute("data-search-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Open search");
            window.__engPopovers?.close("nav-search");
        };

        toggle.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen) close();
            else open();
        });

        current = {
            nav,
            toggle,
            close,
            isOpen: () => isOpen,
        };
    }

    init(document);
    window.__engNav?.onSwap?.(init);
})();
