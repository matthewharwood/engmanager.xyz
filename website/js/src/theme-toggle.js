// Theme toggle.
//
// Reads `engmanager.theme` from localStorage and applies it as
// `<html data-theme="...">`. Wires the brutalist popover picker to
// rewrite the value on click. Falls back to system preference when
// nothing is persisted. Syncs across open tabs via the storage event,
// so changing the theme in one tab updates every other.

const STORAGE_KEY = "engmanager.theme";
const DEFAULT_THEME = "auto";

const root = document.documentElement;

function readStored() {
    try {
        return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
}

function persist(theme) {
    try {
        if (theme === DEFAULT_THEME) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
}

function apply(theme) {
    if (theme === DEFAULT_THEME) {
        root.removeAttribute("data-theme");
    } else {
        root.setAttribute("data-theme", theme);
    }
    syncCurrent(theme);
}

function syncCurrent(theme) {
    const tiles = document.querySelectorAll(".theme-tile");
    tiles.forEach((tile) => {
        tile.classList.toggle("is-current", tile.dataset.theme === theme);
        tile.setAttribute(
            "aria-pressed",
            tile.dataset.theme === theme ? "true" : "false",
        );
    });
    const label = document.querySelector("[data-theme-current-label]");
    if (label) label.textContent = theme;
}

// Apply persisted theme as early as possible so the user doesn't see
// a flash of the wrong palette. The script tag is `defer`-loaded so
// this runs after the DOM is parsed but before paint completes for
// most browsers.
apply(readStored());

document.addEventListener("DOMContentLoaded", () => {
    syncCurrent(readStored());

    // Tile click → switch theme + persist + close popover.
    document.querySelectorAll(".theme-tile").forEach((tile) => {
        tile.addEventListener("click", () => {
            const theme = tile.dataset.theme || DEFAULT_THEME;
            apply(theme);
            persist(theme);
            document
                .getElementById("theme-picker-panel")
                ?.hidePopover();
        });
    });

    // Cross-tab sync — when another tab changes the theme, mirror it
    // here without forcing a reload.
    window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY) return;
        apply(event.newValue || DEFAULT_THEME);
    });
});
