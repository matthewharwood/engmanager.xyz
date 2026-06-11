//! "Scroll to top" button — co-located feature component.
//!
//! Presentational + pure: no state, no I/O. Behavior lives entirely in
//! `script.js`.
//!
//! JS contract: `script.js` (served as `js/c-to-top.js`) selects `.to-top`,
//! toggles `.is-visible` once the reader scrolls past one viewport, and
//! smooth-scrolls to top on click.

use eng_markup::view;

use super::Rendered;

/// Dist asset names emitted by `build.rs` from this folder's `style.css` /
/// `script.js` — generated consts (single source of truth shared by
/// `render()`), so a renamed folder fails compilation instead of 404ing.
pub use super::asset_names::to_top::{SCRIPT, STYLE};

/// Props for the to-top button. Empty for now — the component is fully
/// self-contained — but kept as a typed struct so the call site is
/// forward-compatible (matches the `Props` convention from `eng-components`).
#[derive(Clone, Copy, Default)]
pub struct Props;

/// Pure render: `Props -> Rendered`. The component owns both its node tree and
/// the dist assets needed to make that node behave correctly.
pub fn render(_props: Props) -> Rendered {
    // `data-swap-region` (ledger #14): names this body-level island for the
    // soft-navigation router's region reconcile (the button mounts on article
    // surfaces only, so the router adds/removes it across swaps).
    let markup = view! {
        <button class="to-top" type="button" aria-label="Scroll to top" data-swap-region="to-top">
            <svg class="to-top-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 12 L8 4 M3.5 8 L8 3.5 L12.5 8"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round" />
            </svg>
        </button>
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
    fn renders_to_top_button() {
        let html = render(Props).markup.into_string();
        assert!(html.contains(r#"class="to-top""#));
        assert!(html.contains(r#"class="to-top-icon""#));
        assert!(html.contains("M8 12 L8 4 M3.5 8 L8 3.5 L12.5 8"));
    }

    #[test]
    fn declares_style_and_script_assets() {
        let rendered = render(Props);
        assert_eq!(rendered.critical_css, vec![STYLE]);
        assert!(rendered.deferred_css.is_empty());
        assert_eq!(rendered.js_deps, vec![SCRIPT]);
    }
}
