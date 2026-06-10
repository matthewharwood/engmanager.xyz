//! Quick-actions cluster — co-located overlay component.
//!
//! One component for the shared quick-action surface AND its two chips:
//! - `render()` — the full cluster. Desktop CSS treats the wrapper as
//!   `display: contents`, preserving the two fixed chips; mobile CSS turns
//!   the same controls into a tucked right-edge FAB rail that expands to
//!   reveal theme + Web API receipt actions. Mounted by the homepage and the
//!   article surfaces.
//! - [`theme_picker`] — the theme cycler chip alone. It ALSO mounts
//!   standalone (outside the cluster) on the shop, checkout, and 404 pages,
//!   so it stays a `pub` markup helper rather than a private fn.
//! - `hunt_chip` — private: it only ever renders inside the cluster.
//!
//! JS contract: the co-located `script.js` (served as `js/c-quick-actions.js`)
//! drives the mobile FAB rail via the `[data-quick-actions]` /
//! `[data-quick-actions-toggle]` hooks. The chips themselves are driven by
//! page-level scripts: `js/theme-toggle.js` (synchronous, shell-owned — it
//! must set the theme class before first paint, so it is NEVER absorbed into
//! this component) cycles the theme via `[data-theme-cycle]`, and
//! `js/experiences.js` updates `[data-hunt-chip-count]` and opens the receipt
//! modal through the native Popover API (`popovertarget`).
//!
//! Styles: the co-located `style.css` wraps its rules in `@layer fp.overlay`
//! (ledger #8) so they rejoin the cascade layer they occupied inside
//! `critical.css`. Tier: `critical_css` — the theme-picker and hunt-chip are
//! VISIBLE at first paint on desktop, so the sheet must stay render-blocking
//! (the deferred tier is only for hidden-at-load elements). `PageShell` emits
//! the sheet on EVERY page, immediately after `critical.css`, because the
//! rules previously lived in `critical.css` (global) — per-page selector sets
//! stay unchanged, and the standalone `theme_picker` mounts keep their styles.

use eng_domain::HtmlFragment;
use eng_markup::view;

use super::Rendered;

/// Dist assets emitted by `build.rs` from this folder's `style.css` /
/// `script.js` — generated consts, so a renamed folder fails compilation
/// instead of 404ing.
pub use super::asset_names::quick_actions::{SCRIPT, STYLE};

/// Theme cycler chip. Renders as a single circular emoji button — one emoji
/// per theme, swapped in by `js/theme-toggle.js` on each click. The theme
/// name lives in a sibling sr-only span so screen readers and the aria-label
/// can announce "Cycle theme · current: Light" etc.
///
/// `pub` (not a private cluster detail): the shop, checkout, and 404 pages
/// mount it standalone. Those pages get its styles from this component's
/// sheet, which `PageShell` ships globally (see module docs).
pub fn theme_picker() -> HtmlFragment {
    view! {
        <button class="theme-picker"
                type="button"
                data-theme-cycle
                aria-label="Cycle theme · current: Auto">
            <svg class="theme-picker-shapes"
                 aria-hidden="true"
                 viewBox="0 0 32 32"
                 focusable="false">
                <circle class="theme-picker-shape theme-picker-shape-auto" cx="16" cy="16" r="10" />
                <path class="theme-picker-shape theme-picker-shape-light" d="M16 5 L27 25 H5 Z" />
                <rect class="theme-picker-shape theme-picker-shape-dark" x="7" y="7" width="18" height="18" />
                <path class="theme-picker-shape theme-picker-shape-catppuccin" d="M16 5 L25.5 10.5 V21.5 L16 27 L6.5 21.5 V10.5 Z" />
                <path class="theme-picker-shape theme-picker-shape-synthwave" d="M16 5 L19.3 12.2 L27 13 L21.2 18.1 L22.9 25.7 L16 21.8 L9.1 25.7 L10.8 18.1 L5 13 L12.7 12.2 Z" />
                <path class="theme-picker-shape theme-picker-shape-cyberpunk" d="M25 16 A9 9 0 0 1 16 25" />
                <path class="theme-picker-shape theme-picker-shape-forest" d="M16 5 L27 16 L16 27 L5 16 Z" />
                <path class="theme-picker-shape theme-picker-shape-lofi" d="M16 5 L26.5 12.6 L22.5 25 H9.5 L5.5 12.6 Z" />
                <path class="theme-picker-shape theme-picker-shape-dracula" d="M16 4 L19.5 12.5 L28 16 L19.5 19.5 L16 28 L12.5 19.5 L4 16 L12.5 12.5 Z" />
                <path class="theme-picker-shape theme-picker-shape-luxury" d="M10 6 H22 L28 16 L22 26 H10 L4 16 Z" />
            </svg>
            <span class="theme-picker-emoji" aria-hidden="true" data-theme-emoji>"🪄"</span>
            <span class="sr-only" data-theme-current-label>"Auto"</span>
        </button>
    }
}

// Persistent scavenger-hunt chip. On desktop it is positioned directly by
// CSS; on mobile it lives inside the cluster as one of the expandable FAB
// actions. Circular emoji button with a shopping-cart-style count badge in
// the top-right corner. Private: it only renders inside `render()`.
fn hunt_chip() -> HtmlFragment {
    view! {
        <button class="hunt-chip"
                type="button"
                popovertarget="api-receipt-modal"
                aria-label="Open the API hunt log">
            <span class="hunt-chip-emoji" aria-hidden="true">"🧪"</span>
            <span class="hunt-chip-badge" data-hunt-chip-count="0">"0"</span>
            <span class="sr-only">"APIs found"</span>
        </button>
    }
}

/// Pure render of the full quick-action cluster: `() -> Rendered`. The
/// component owns its node tree and the dist assets that make it behave.
pub fn render() -> Rendered {
    let markup = view! {
        <div class="quick-actions"
             data-quick-actions
             data-state="collapsed">
            <button class="quick-actions-peek"
                    type="button"
                    data-quick-actions-toggle
                    aria-label="Open quick actions"
                    aria-expanded="false">
                <span class="quick-actions-arrow" aria-hidden="true">"←"</span>
            </button>
            <div class="quick-actions-bubbles" aria-label="Quick actions">
                { theme_picker() }
                { hunt_chip() }
            </div>
        </div>
    };

    Rendered {
        markup,
        critical_css: vec![STYLE],
        deferred_css: Vec::new(),
        js_deps: vec![SCRIPT],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_cluster_with_both_chips() {
        let html = render().markup.into_string();
        assert!(html.contains(r#"class="quick-actions""#));
        assert!(html.contains("data-quick-actions"));
        assert!(html.contains(r#"data-state="collapsed""#));
        assert!(html.contains("data-quick-actions-toggle"));
        // Both chips render inside the bubbles wrapper.
        assert!(html.contains(r#"class="theme-picker""#));
        assert!(html.contains(r#"class="hunt-chip""#));
        assert!(html.contains(r#"data-hunt-chip-count="0""#));
        // Hunt chip opens the receipt modal via the native Popover API.
        assert!(html.contains(r#"popovertarget="api-receipt-modal""#));
    }

    #[test]
    fn theme_picker_renders_standalone() {
        let html = theme_picker().into_string();
        assert!(html.contains("data-theme-cycle"));
        assert!(html.contains(r#"aria-label="Cycle theme · current: Auto""#));
        assert!(html.contains("theme-picker-shape-catppuccin"));
        assert!(html.contains(r#"data-theme-current-label"#));
    }

    #[test]
    fn cluster_styles_are_critical_with_fab_script() {
        // Tier rule: the chips are visible at first paint → critical, never
        // deferred. The FAB rail behavior ships as the co-located script.
        let rendered = render();
        assert_eq!(rendered.critical_css, vec![STYLE]);
        assert!(rendered.deferred_css.is_empty());
        assert_eq!(rendered.js_deps, vec![SCRIPT]);
    }
}
