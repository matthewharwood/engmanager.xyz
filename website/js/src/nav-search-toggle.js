// Build-time CSS bindings. Identity forms keep direct-source tests readable;
// build.rs replaces calls with literals and Oxc removes unused helpers.
var cssClasses = value => value, cssSelector = value => value, cssToken = value => value, cssHtml = value => value;

// The magnifier opens a shared, light-dismiss search overlay on every
// viewport. The search form stays inside the native dialog so typeahead
// results and keyboard navigation work the same on mobile and desktop.
//
// Soft-nav lifecycle: the nav is a swapped region, so init(root)
// re-binds the fresh toggle after every swap (data-search-toggle-bound
// guard). The dialog contains keyboard focus and handles Escape.

(() => {
    // Active instance: { nav, toggle, overlay, close, isOpen() } — null on pages
    // without a search toggle.
    let current = null;
    const instances = new WeakMap();

    function init(root) {
        const toggle = root.querySelector(cssSelector("[data-search-toggle]"));
        if (!toggle) {
            current = null;
            return;
        }
        if (instances.has(toggle)) {
            current = instances.get(toggle);
            return;
        }
        toggle.dataset.searchToggleBound = "true";
        const nav = toggle.closest(cssSelector(".site-nav"));
        if (!nav) {
            current = null;
            return;
        }
        const overlay = nav.querySelector(cssSelector("[data-search-overlay]"));
        const input = overlay?.querySelector(cssSelector(".site-search-input"));
        if (!overlay || !input) {
            current = null;
            return;
        }

        let isOpen = false;

        const open = () => {
            isOpen = true;
            toggle.setAttribute("aria-expanded", "true");
            toggle.setAttribute("aria-label", "Close search");
            if (!overlay.open) overlay.showModal();
            window.dispatchEvent(new Event("eng:overlaychange"));
            requestAnimationFrame(() => {
                if (!isOpen || current?.toggle !== toggle || !input.isConnected) return;
                try {
                    input.focus({ preventScroll: true });
                } catch {
                    input.focus();
                }
            });
        };

        const close = () => {
            isOpen = false;
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Open search");
            if (overlay.open) overlay.close();
            window.dispatchEvent(new Event("eng:overlaychange"));
        };

        overlay.addEventListener("close", () => {
            if (overlay.open) return;
            if (isOpen) {
                isOpen = false;
                toggle.setAttribute("aria-expanded", "false");
                toggle.setAttribute("aria-label", "Open search");
            }
            window.dispatchEvent(new Event("eng:overlaychange"));
        });

        overlay.querySelector(cssSelector("[data-search-close]"))?.addEventListener("click", close);
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) close();
        });

        toggle.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen) close();
            else open();
        });

        current = {
            nav,
            toggle,
            overlay,
            close,
            isOpen: () => isOpen,
        };
        instances.set(toggle, current);
    }

    init(document);
    window.__engNav?.onBeforeSwap?.(() => {
        current?.close();
        current = null;
    });
    window.__engNav?.onSwap?.(init);
})();
