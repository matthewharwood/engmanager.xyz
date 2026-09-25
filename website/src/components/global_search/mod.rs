//! Global search form — co-located component (markup + flat JS deps only).
//!
//! The typeahead search form mounted in the site's modal dialog on
//! the homepage, article, and search surfaces.
//!
//! This component owns no co-located `style.css`/`script.js`: the
//! `.site-search*` styles live in `critical.css`'s nav fp.overlay block
//! (alongside the rest of the nav chrome) and the behavior lives in the
//! shared flat scripts declared as `js_deps`:
//! - `js/search.js` — typeahead engine wired to `[data-search-form]` /
//!   `[data-search-results]`,
//! - `js/search-keyclick.js` — the keystroke SFX (consumes the
//!   `__engSfxUrls` island via `js/audio.js`).
//!
//! The nav absorbs this component (`Rendered::absorb`): pages splice the nav,
//! and the search deps ride along — page-level pinned `add_js` copies keep
//! their pre-P4 head positions via first-seen dedup.

use eng_markup::view;

use super::Rendered;

/// Shared flat scripts this component depends on but does not own. Declared in execution
/// order; both are independent listeners, but search.js is the feature.
const SEARCH: &str = "js/search.js";
const SEARCH_KEYCLICK: &str = "js/search-keyclick.js";

/// Props for the global search form. Both nav surfaces currently use the
/// same literal placeholder; hoisted as a prop so the render stays pure and
/// per-page copy stays a caller decision.
pub struct Props {
    pub placeholder: &'static str,
}

/// Pure render: `Props -> Rendered`.
pub fn render(props: Props) -> Rendered {
    let markup = view! {
        <dialog id="site-search-overlay" class="site-search-overlay" aria-label="Search" data-search-overlay>
          <div class="site-search-panel">
            <header class="site-search-heading">
                <span>"Search articles & caps"</span>
                <button class="site-search-close" type="button" aria-label="Close search" data-search-close>"×"</button>
            </header>
            <form class="site-search" action="/search" method="get" role="search" data-search-form>
            <label class="sr-only" for="site-search-input">"Search articles"</label>
            <input class="site-search-input"
                   id="site-search-input"
                   type="search"
                   name="q"
                   autocomplete="off"
                   role="combobox"
                   aria-expanded="false"
                   aria-controls="site-search-results"
                   aria-autocomplete="list"
                   placeholder={ props.placeholder } />
            <ul class="site-search-results"
                id="site-search-results"
                role="listbox"
                hidden
                data-search-results></ul>
            <noscript>
                <button class="site-search-submit" type="submit">"Search"</button>
            </noscript>
            </form>
            <p class="site-search-hint">"Type to search · Esc to close"</p>
          </div>
        </dialog>
    };

    Rendered {
        markup,
        critical_css: Vec::new(),
        deferred_css: Vec::new(),
        js_deps: vec![SEARCH, SEARCH_KEYCLICK],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_search_form_with_typeahead_hooks() {
        let html = render(Props {
            placeholder: "Search",
        })
        .markup
        .into_string();
        assert!(html.contains(
            r#"<form class="site-search" action="/search" method="get" role="search" data-search-form>"#
        ));
        assert!(html.contains(r#"placeholder="Search""#));
        assert!(html.contains("data-search-results"));
        assert!(html.contains(r#"aria-controls="site-search-results""#));
        // No-JS fallback submit button.
        assert!(html.contains("<noscript>"));
    }

    #[test]
    fn declares_flat_search_scripts_no_css() {
        let rendered = render(Props {
            placeholder: "Search",
        });
        assert!(rendered.critical_css.is_empty());
        assert!(rendered.deferred_css.is_empty());
        assert_eq!(
            rendered.js_deps,
            vec!["js/search.js", "js/search-keyclick.js"]
        );
    }
}
