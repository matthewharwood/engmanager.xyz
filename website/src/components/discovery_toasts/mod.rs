//! Scavenger-hunt discovery toasts — co-located overlay component.
//!
//! Just the live-region container: the shared `js/experiences.js` engine mounts
//! and animates `.discovery-toast` cards inside it when the reader discovers a
//! Web-API "experience". Because the container is empty + `position: fixed` at
//! first paint (nothing visible until a discovery fires, well after load), its
//! CSS is declared as `deferred_css` — async, non-render-blocking — the first
//! use of the [`Rendered`] deferred tier.
//!
//! JS contract: behavior lives in the shared `js/experiences.js` (which also
//! drives the hunt-chip count + receipt modal), so this component owns NO JS —
//! the page loads `experiences.js` once at the page level. The component only
//! contributes its markup + (deferred) styles.
//!
//! The co-located `style.css` wraps its rules in `@layer fp.overlay {…}` so they
//! rejoin the same cascade layer they came from in `critical.css` (whose layer
//! order is pre-declared up top), keeping the cascade byte-for-byte equivalent.

use eng_markup::view;

use super::Rendered;

/// Dist asset emitted by `build.rs` from this folder's `style.css`.
pub const STYLE: &str = "css/c-discovery-toasts.css";

/// Pure render. No `Props` — the container is stateless; the toast cards are
/// created at runtime by `experiences.js`.
pub fn render() -> Rendered {
    let markup = view! {
        <div class="discovery-toasts"
             data-discovery-toasts
             aria-live="polite"
             aria-atomic="false"></div>
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
    fn renders_live_region_container() {
        let rendered = render();
        let html = rendered.markup.into_string();
        assert!(html.contains(r#"class="discovery-toasts""#));
        assert!(html.contains("data-discovery-toasts"));
        assert!(html.contains(r#"aria-live="polite""#));
    }

    #[test]
    fn styles_are_deferred_only_no_js() {
        let rendered = render();
        assert!(rendered.critical_css.is_empty());
        assert_eq!(rendered.deferred_css, vec![STYLE]);
        assert!(rendered.js_deps.is_empty());
    }

    // Keep the splice helper honest: a deferred stylesheet loads async with a
    // <noscript> fallback, and there is no <script> for this component.
    #[test]
    fn head_defers_css_with_noscript_fallback() {
        let head = render().head().into_string();
        // Async-CSS swap: load non-render-blocking via media="print", flip to
        // `all` onload. The `'` renders HTML-escaped (`&#39;`) — correct, the
        // browser decodes it before running the handler.
        assert!(head.contains(r#"media="print""#));
        assert!(head.contains("onload="));
        assert!(head.contains("this.media="));
        assert!(head.contains("<noscript>"));
        assert!(!head.contains("<script"));
    }
}
