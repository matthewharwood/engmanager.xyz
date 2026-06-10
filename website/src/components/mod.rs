//! Co-located feature components.
//!
//! Each component lives in `components/<feature>/` and co-locates its Rust
//! template (`mod.rs`), styles (`style.css`), and behavior (`script.js`).
//!
//! Conventions (see the refactor plan):
//! - Presentational + stateless first: a component's `render(props) ->
//!   HtmlFragment` is PURE — no `.await`, no `asset_url`, no `static`s, no
//!   `State`/`Path`. Anything it needs becomes a field on its `Props` struct,
//!   supplied by a caller that hoisted that state/enrichment.
//! - Interactivity lives in the co-located `script.js` (an IIFE, minified by
//!   `build.rs`), wired to the markup via `data-*` hooks. The render fn stays
//!   pure; document the JS contract in a `// JS contract:` comment.
//! - `style.css` / `script.js` are discovered by `build.rs` and emitted as
//!   `c-<feature>.{css,js}`. A component exposes those names as consts plus an
//!   `assets()` fn returning the `<link>`/`<script>` tags; the page that mounts
//!   the component splices `assets()` into its `<head>`.
//!
//! Asset-bearing components return a [`Rendered`] (markup + the dist assets it
//! depends on) instead of a bare `HtmlFragment`, so the mounting page can
//! splice the component's `<link>`/`<script>` tags from a single source of
//! truth. See [`nav`] and [`to_top`] for examples.

use eng_domain::HtmlFragment;
use eng_markup::view;

use crate::asset_url;

pub mod discovery_toasts;
pub mod nav;
pub mod to_top;

/// Higher-order render result for components that carry their own CSS/JS.
///
/// A pure `render(props) -> Rendered` returns its node tree alongside the dist
/// asset names it needs, so the page that mounts it never hand-maintains a
/// parallel list of `<script>`/`<link>` tags that can drift out of sync with
/// the markup. The component owns "what I render AND what I depend on".
///
/// CSS deps come in two tiers (`critical.css` itself is a render-blocking
/// `<link>`, not inlined, so co-locating component CSS as its own link is
/// already perf-neutral — the tier is the *improvement* layered on top):
/// - `critical_css`: styles for content visible at first paint. Emitted as a
///   render-blocking `<link>` in `<head>`, exactly like today's behavior.
/// - `deferred_css`: interaction-only / below-the-fold styles (modal, toast,
///   dropdown-panel internals). Emitted async (non-render-blocking) so it never
///   delays first paint, with a `<noscript>` fallback for no-JS clients. Only
///   mark CSS deferred when the styled element is hidden at load (no FOUC).
///
/// All three dep lists are `asset_url`-style dist paths (e.g. `"css/c-nav.css"`,
/// `"js/popover-registry.js"`). They may name co-located `c-<feature>` assets
/// emitted by `build.rs` OR existing flat assets — the component decides per
/// render (deps can legitimately differ by `Props`).
pub struct Rendered {
    pub markup: HtmlFragment,
    pub critical_css: Vec<&'static str>,
    pub deferred_css: Vec<&'static str>,
    pub js_deps: Vec<&'static str>,
}

impl Rendered {
    /// `<head>` asset tags for this component, in load-priority order:
    /// render-blocking `<link>` per `critical_css`, then async `<link>` per
    /// `deferred_css` (media-swap pattern + `<noscript>` fallback), then a
    /// deferred `<script>` per `js_dep`. Each href is routed through
    /// `asset_url` for content-addressed caching. Splice into the page `<head>`.
    pub fn head(&self) -> HtmlFragment {
        let critical = self
            .critical_css
            .iter()
            .copied()
            .map(|dep| view! { <link rel="stylesheet" href={ asset_url(dep) } /> });
        // Async CSS: load with `media="print"` (non-render-blocking), then flip
        // to `all` once it has loaded. `<noscript>` gives no-JS clients the
        // normal render-blocking link.
        let deferred = self.deferred_css.iter().copied().map(|dep| {
            let href = asset_url(dep);
            view! {
                <link rel="stylesheet" href={ href.clone() } media="print" onload="this.media='all'" />
                <noscript><link rel="stylesheet" href={ href } /></noscript>
            }
        });
        let js = self
            .js_deps
            .iter()
            .copied()
            .map(|dep| view! { <script src={ asset_url(dep) } defer></script> });
        critical.chain(deferred).chain(js).collect()
    }
}
