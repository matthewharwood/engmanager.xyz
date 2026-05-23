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
    });
}

function nextTheme(current) {
    const idx = THEMES.findIndex(([slug]) => slug === current);
    const next = THEMES[(idx + 1) % THEMES.length];
    return next[0];
}

// One shared Audio instance so rapid clicks cancel the prior clip
// instead of stacking. The URL map (`window.__engThemeSfx`) is injected
// by pages/mod.rs::render_theme_sfx_urls so this script doesn't need to
// know hashed asset paths.
let currentSfx = null;

function playThemeSfx(theme) {
    const url = window.__engThemeSfx?.[theme];
    if (!url) return;
    if (currentSfx) {
        try {
            currentSfx.pause();
            currentSfx.currentTime = 0;
        } catch {}
    }
    try {
        const audio = new Audio(url);
        audio.volume = 0.5;
        currentSfx = audio;
        audio.addEventListener("ended", () => {
            if (currentSfx === audio) currentSfx = null;
        });
        audio.play().catch(() => {});
    } catch {}
}

// Apply immediately so the theme attaches before paint.
apply(readStored());

document.addEventListener("DOMContentLoaded", () => {
    syncLabel(readStored());

    document.querySelectorAll("[data-theme-cycle]").forEach((button) => {
        button.addEventListener("click", () => {
            const current = readStored();
            const next = nextTheme(current);
            apply(next);
            persist(next);
            playThemeSfx(next);
        });
    });

    // Cross-tab sync.
    window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY) return;
        apply(event.newValue || "auto");
    });
});
