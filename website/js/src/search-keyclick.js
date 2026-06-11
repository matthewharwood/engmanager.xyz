// Desktop-only keyboard click stinger while typing in the site search.
//
// Each non-modifier keydown plays a short ~0.5s click via the shared
// audio service. Rapid typing cancels the previous click and starts a
// new one (channel: "keyclick") instead of stacking — same pattern as
// the theme-cycler stinger.
//
// Disabled below the desktop breakpoint because the mobile virtual
// keyboard already provides its own haptic/audio feedback, and a
// second click on top would feel doubled.

(() => {
    const isDesktop = () => matchMedia("(min-width: 48rem)").matches;

    // Skip modifier-only keystrokes and Tab/Escape (UI navigation, not
    // typing). Backspace + arrow keys still click — they're legitimate
    // edits while composing a query.
    const SILENT_KEYS = new Set([
        "Shift",
        "Control",
        "Alt",
        "Meta",
        "CapsLock",
        "Tab",
        "Escape",
        "ContextMenu",
        "NumLock",
        "ScrollLock",
    ]);

    const isAudibleKey = (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return false;
        return !SILENT_KEYS.has(event.key);
    };

    // Per-input binding with a marker guard so the soft-nav router can
    // rescan swapped-in forms without double-binding survivors
    // (JS_ROUTER_CONSTRAINTS §2.2).
    const bind = (root) => {
        root.querySelectorAll(
            "[data-search-form] input[type='search']",
        ).forEach((input) => {
            if (input.dataset.keyclickBound) return;
            input.dataset.keyclickBound = "true";
            input.addEventListener("keydown", (event) => {
                if (!isDesktop()) return;
                if (!isAudibleKey(event)) return;
                window.__engAudio?.play(
                    "keyclick",
                    window.__engSfxUrls?.keyclick,
                    { volume: 0.35 },
                );
            });
        });
    };

    bind(document);
    window.__engNav?.onSwap?.(bind);
})();
