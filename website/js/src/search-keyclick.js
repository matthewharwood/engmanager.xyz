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
    const inputs = document.querySelectorAll(
        "[data-search-form] input[type='search']",
    );
    if (!inputs.length) return;

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

    inputs.forEach((input) => {
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
})();
