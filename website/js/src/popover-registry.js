// Decoupled mutual-exclusion for popover-style UI (nav dropdown, search
// expander, future modals). Each component calls
//   window.__engPopovers.open(id, closeFn)
// when its panel opens, and
//   window.__engPopovers.close(id)
// when it closes. open() first invokes every other registered close()
// so only one popover can ever be open at a time — without the
// components needing to know about each other.
//
// Must run before any consumer (nav-dropdown.js, nav-search-toggle.js).
// All three are defer-loaded; document order in <head> guarantees this
// IIFE has set window.__engPopovers before the consumers execute.
//
// When the page eventually grows enough cross-component state to
// justify it, this is the seam to replace with @preact/signals-core:
// swap the Map for `signal(activeId)` and let consumers subscribe via
// `effect()`. The public surface (open/close by id) doesn't change.

(() => {
    const handlers = new Map();

    window.__engPopovers = {
        open(id, closeFn) {
            for (const [otherId, otherClose] of handlers) {
                if (otherId === id) continue;
                handlers.delete(otherId);
                try {
                    otherClose();
                } catch {}
            }
            handlers.set(id, closeFn);
        },
        close(id) {
            handlers.delete(id);
        },
    };
})();
