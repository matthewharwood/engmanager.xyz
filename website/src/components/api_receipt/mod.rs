//! Brutalist Web API Receipt modal — co-located overlay component.
//!
//! THE ledger-#4 dedup: this exact `<aside id="api-receipt-modal">` shell used
//! to be rendered twice — `receipt_modal()` in `pages/articles.rs` and a
//! verbatim inline copy in `pages/homepage.rs`. It now renders from this one
//! pure component, byte-identical to both former copies.
//!
//! Opens on the `?` key from anywhere on the site OR when `?receipt` is in
//! the URL on load; toggling pushes/pops that query param so the state is
//! deep-linkable. Static shell only.
//!
//! JS contract: behavior lives in the shared page-level `js/experiences.js`
//! (which also drives the hunt-chip count + discovery toasts) — it populates
//! the stats + grid from the registry after `runAll()` finishes via the
//! `data-api-receipt-stats` / `data-api-receipt-grid` hooks, and the native
//! Popover API handles open/close through the `popovertarget` buttons. This
//! component therefore owns NO JS.
//!
//! Styles: the co-located `style.css` wraps its rules in `@layer fp.overlay`
//! so they rejoin the cascade layer they occupied inside `critical.css`
//! (ledger #8). Tier: `deferred_css` — the modal is a closed
//! `popover="manual"` (hidden) at first paint, so its stylesheet never needs
//! to block rendering. The sheet is emitted by `PageShell` on EVERY page,
//! immediately after `critical.css`, because the rules previously lived in
//! `critical.css` (global) — per-page selector sets stay unchanged.

use eng_markup::view;

use super::Rendered;

/// Dist asset emitted by `build.rs` from this folder's `style.css` — a
/// generated const (no `SCRIPT`: this component ships no `script.js`), so a
/// renamed folder fails compilation instead of 404ing.
pub use super::asset_names::api_receipt::STYLE;

/// Pure render. No `Props` — the shell is static; `experiences.js` fills the
/// stats and grid at runtime.
pub fn render() -> Rendered {
    // `data-swap-region` (ledger #14): names this body-level island for the
    // soft-navigation router's region reconcile.
    let markup = view! {
        <aside id="api-receipt-modal" popover="manual" class="api-receipt" data-swap-region="receipt">
            <div class="api-receipt-frame">
                <header class="api-receipt-head">
                    <span class="api-receipt-glyph" aria-hidden="true">"⌬"</span>
                    <h2 class="api-receipt-title">"Web API Receipt"</h2>
                    <div class="api-receipt-stats" data-api-receipt-stats></div>
                    <button class="api-receipt-close"
                            type="button"
                            popovertarget="api-receipt-modal"
                            popovertargetaction="hide"
                            aria-label="Close">
                        "✕"
                    </button>
                </header>
                <div class="api-receipt-grid" data-api-receipt-grid></div>
                <footer class="api-receipt-foot">
                    <span>"Press "<kbd>"?"</kbd>" to toggle · "<kbd>"Esc"</kbd>" to close · share with "<kbd>"?receipt"</kbd></span>
                </footer>
            </div>
        </aside>
    };

    Rendered {
        markup,
        critical_css: Vec::new(),
        deferred_css: vec![STYLE],
        js_deps: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_receipt_modal_shell() {
        let html = render().markup.into_string();
        // Byte-parity pin updated DELIBERATELY for ledger #14: the modal
        // gained the additive data-swap-region attribute.
        assert!(html.contains(
            r#"<aside id="api-receipt-modal" popover="manual" class="api-receipt" data-swap-region="receipt">"#
        ));
        assert!(html.contains("data-api-receipt-stats"));
        assert!(html.contains("data-api-receipt-grid"));
        assert!(html.contains(r#"popovertargetaction="hide""#));
        assert!(html.contains("Web API Receipt"));
        // Footer keyboard hints survive verbatim (kbd glyphs included).
        assert!(html.contains("<kbd>?</kbd>"));
        assert!(html.contains("?receipt"));
    }

    #[test]
    fn styles_are_deferred_only_no_js() {
        let rendered = render();
        assert!(rendered.critical_css.is_empty());
        assert_eq!(rendered.deferred_css, vec![STYLE]);
        assert!(rendered.js_deps.is_empty());
    }
}
