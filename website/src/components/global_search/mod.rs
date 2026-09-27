//! Global search form — co-located markup/styles and shared behavior.
//!
//! The typeahead search form mounted in the site's modal dialog on
//! the homepage, article, and search surfaces.
//!
//! This component owns its grouped results and preview styles. The
//! structural nav styles remain in `critical.css`; the grouped layout lives
//! in `style.css`. Behavior lives in the
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
                <span>"Search ENGMANAGER"</span>
                <button class="site-search-close" type="button" aria-label="Close search" data-search-close>"×"</button>
            </header>
            <form class="site-search" action="/search" method="get" role="search" data-search-form>
            <label class="sr-only" for="site-search-input">"Search the site"</label>
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
            <div class="site-search-filters" role="group" aria-label="Content type">
                <button type="button" data-search-kind="" aria-pressed="true">"All"</button>
                <button type="button" data-search-kind="article" aria-pressed="false">"Articles"</button>
                <button type="button" data-search-kind="product" aria-pressed="false">"Store"</button>
                <button type="button" data-search-kind="coaching" aria-pressed="false">"Coaching"</button>
                <button type="button" data-search-kind="subscription" aria-pressed="false">"Subscription"</button>
            </div>
            <div class="site-search-body">
                <div class="site-search-list-column">
                    <ul class="site-search-results"
                        id="site-search-results"
                        role="listbox"
                        aria-label="Search results"
                        hidden
                        data-search-results></ul>
                    <p class="site-search-empty" data-search-empty>"Start with a topic, or choose a category."</p>
                </div>
                <aside class="site-search-preview" aria-label="Result preview" data-search-preview>
                    <p class="site-search-preview-placeholder">"A closer look."<br />"Focus a result to preview it here."</p>
                </aside>
            </div>
            <span class="sr-only" role="status" data-search-status></span>
            <noscript>
                <button class="site-search-submit" type="submit">"Search"</button>
            </noscript>
            </form>
            <p class="site-search-hint">"↑ ↓ to browse · Enter to open · Esc to close"</p>
          </div>
        </dialog>
    };

    Rendered {
        markup,
        critical_css: vec!["css/c-global-search.css"],
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
    fn declares_shared_search_styles_and_scripts() {
        let rendered = render(Props {
            placeholder: "Search",
        });
        assert_eq!(rendered.critical_css, vec!["css/c-global-search.css"]);
        assert!(rendered.deferred_css.is_empty());
        assert_eq!(
            rendered.js_deps,
            vec!["js/search.js", "js/search-keyclick.js"]
        );
    }
}
