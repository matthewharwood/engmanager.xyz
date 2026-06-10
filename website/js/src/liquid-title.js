const THEME_EVENT = "engmanager:themechange";
const titles = new Set();
let refreshQueued = false;

function onReady(callback) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback, { once: true });
        return;
    }
    callback();
}

function cssVar(styles, name, fallback) {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
}

function readPalette() {
    const styles = getComputedStyle(document.documentElement);
    const accent = cssVar(styles, "--accent", "#e64553");
    return {
        accent,
        glow: `color-mix(in oklab, ${accent} 42%, transparent)`,
        primary: cssVar(styles, "--color-primary", accent),
        secondary: cssVar(styles, "--color-info", "#04a5e5"),
        tertiary: cssVar(styles, "--color-secondary", "#ea76cb"),
    };
}

function applyPalette(title, palette) {
    title.style.setProperty("--liquid-title-primary", palette.primary);
    title.style.setProperty("--liquid-title-secondary", palette.secondary);
    title.style.setProperty("--liquid-title-tertiary", palette.tertiary);
    title.style.setProperty("--liquid-title-glow", palette.glow);
}

function refreshTitles() {
    refreshQueued = false;
    const palette = readPalette();
    titles.forEach((title) => applyPalette(title, palette));
}

function scheduleRefresh() {
    if (refreshQueued) {
        return;
    }
    refreshQueued = true;
    requestAnimationFrame(refreshTitles);
}

function initTitle(title) {
    if (titles.has(title)) {
        return;
    }
    titles.add(title);
    title.style.setProperty("--liquid-title-filter", 'url("#liquid-title-water")');
    applyPalette(title, readPalette());
}

onReady(() => {
    document.querySelectorAll("[data-liquid-title]").forEach(initTitle);
});

// Soft navigation: prune detached titles from the Set (so theme
// refreshes stop touching old-page nodes) and adopt the swapped-in
// ones — initTitle is already idempotent (JS_ROUTER_CONSTRAINTS §2.9).
window.__engNav?.onSwap?.((root) => {
    titles.forEach((title) => {
        if (!title.isConnected) titles.delete(title);
    });
    root.querySelectorAll("[data-liquid-title]").forEach(initTitle);
});

window.addEventListener(THEME_EVENT, scheduleRefresh);

if ("MutationObserver" in window) {
    const observer = new MutationObserver((records) => {
        if (records.some((record) => record.attributeName === "data-theme")) {
            scheduleRefresh();
        }
    });
    observer.observe(document.documentElement, {
        attributeFilter: ["data-theme"],
        attributes: true,
    });
}

const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
if (colorScheme) {
    if (colorScheme.addEventListener) {
        colorScheme.addEventListener("change", scheduleRefresh);
    } else {
        colorScheme.addListener?.(scheduleRefresh);
    }
}
