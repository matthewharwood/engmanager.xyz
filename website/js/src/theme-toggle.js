// Theme cycler.
//
// One button (`.theme-picker[data-theme-cycle]`). Click advances
// through the THEMES list below, persisting to localStorage and
// applying as `<html data-theme="...">`. `auto` (the default) removes
// the attribute so the OS preference + the `@media (prefers-color-
// scheme: dark)` block in critical.css takes over.
//
// State sync across open tabs is via the `storage` event — changing
// the theme in one tab updates every other tab without a reload.
//
// The script tag is intentionally not `defer` so the theme attribute
// is on `<html>` before first paint, avoiding a flash of the wrong
// palette.

const STORAGE_KEY = "engmanager.theme";

// (slug, label, emoji) — label feeds the sr-only span + aria-label so
// AT announces the active theme; emoji is the visible glyph in the
// circular picker button. Order = cycle order.
const THEMES = [
    ["auto",       "Auto",       "🪄"],
    ["light",      "Light",      "☀️"],
    ["dark",       "Dark",       "🌙"],
    ["catppuccin", "Catppuccin", "🐱"],
    ["synthwave",  "Synthwave",  "🌆"],
    ["cyberpunk",  "Cyberpunk",  "🤖"],
    ["forest",     "Forest",     "🌲"],
    ["lofi",       "Lofi",       "🎧"],
    ["dracula",    "Dracula",    "🧛"],
    ["luxury",     "Luxury",     "💎"],
];

const root = document.documentElement;

function readStored() {
    try {
        return localStorage.getItem(STORAGE_KEY) || "auto";
    } catch {
        return "auto";
    }
}

function persist(theme) {
    try {
        if (theme === "auto") localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
}

function apply(theme) {
    if (theme === "auto") {
        root.removeAttribute("data-theme");
    } else {
        root.setAttribute("data-theme", theme);
    }
    syncLabel(theme);
    window.dispatchEvent(
        new CustomEvent("engmanager:themechange", {
            detail: { theme },
        }),
    );
}

function syncLabel(theme) {
    const entry = THEMES.find(([slug]) => slug === theme);
    const label = entry ? entry[1] : theme;
    const emoji = entry ? entry[2] : "";
    document
        .querySelectorAll("[data-theme-current-label]")
        .forEach((el) => (el.textContent = label));
    document
        .querySelectorAll("[data-theme-emoji]")
        .forEach((el) => (el.textContent = emoji));
    document.querySelectorAll("[data-theme-cycle]").forEach((btn) => {
        btn.setAttribute("aria-label", `Cycle theme · current: ${label}`);
        btn.dataset.themeShape = theme;
    });
}

function nextTheme(current) {
    const idx = THEMES.findIndex(([slug]) => slug === current);
    const next = THEMES[(idx + 1) % THEMES.length];
    return next[0];
}

// Per-theme stinger on cycle. Routes through the shared audio service
// (channel: "theme") so rapid clicks cancel + replay instead of
// stacking. URL map is injected by pages/mod.rs::render_sfx_urls.
function playThemeSfx(theme) {
    window.__engAudio?.play("theme", window.__engSfxUrls?.themes?.[theme]);
}

// Apply immediately so the theme attaches before paint.
apply(readStored());

// Prerendered documents snapshot storage early: another tab may change
// the theme before activation, so re-read + re-apply when the page is
// actually shown (JS_ROUTER_CONSTRAINTS §3).
if (document.prerendering) {
    document.addEventListener(
        "prerenderingchange",
        () => apply(readStored()),
        { once: true },
    );
}

document.addEventListener("DOMContentLoaded", () => {
    syncLabel(readStored());

    // Delegated (not per-node) so pickers that arrive inside
    // router-swapped regions work without re-binding
    // (JS_ROUTER_CONSTRAINTS §2.16).
    document.addEventListener("click", (event) => {
        if (!event.target.closest?.("[data-theme-cycle]")) return;
        const current = readStored();
        const next = nextTheme(current);
        apply(next);
        persist(next);
        playThemeSfx(next);
    });

    // Cross-tab sync.
    window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY) return;
        apply(event.newValue || "auto");
    });
});

// Soft navigations replace picker nodes — re-stamp label/emoji/shape
// onto the fresh markup. <html data-theme> itself persists across the
// swap (the router excludes it from <html> attr reconciliation).
window.__engNav?.onSwap?.(() => syncLabel(readStored()));
