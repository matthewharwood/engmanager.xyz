//! Article passage cards: a semantic preview with optional native PNG export.
//!
//! JS contract: `script.js` supplies a passage from the current article,
//! opens the dialog, and progressively enables HTML-in-Canvas export. The
//! preview remains ordinary HTML until an export starts. Article identity
//! is hoisted by the caller so this renderer remains pure.

use eng_markup::view;

use super::Rendered;

pub use super::asset_names::quote_card::{SCRIPT, STYLE};

pub fn render(title: &str, url: &str) -> Rendered {
    let markup = view! {
        <dialog class="quote-card-dialog" data-quote-card-dialog aria-labelledby="quote-card-heading">
            <header class="quote-card-header">
                <h2 id="quote-card-heading" class="quote-card-heading">"Make a quote card"</h2>
                <button class="quote-card-close" type="button" data-quote-card-close aria-label="Close quote card">
                    <span aria-hidden="true">"✕"</span>
                </button>
            </header>
            <div class="quote-card-body">
                <p class="quote-card-intro">"Use a passage from this article in a slide or team discussion. Select text in the article first to choose a different passage."</p>
                <label class="quote-card-label" for="quote-card-text">"Quote + source"</label>
                <textarea id="quote-card-text" class="quote-card-text" data-quote-card-text readonly rows="3" aria-describedby="quote-card-status"></textarea>
                <div class="quote-card-preview" data-quote-card-preview>
                    <div class="quote-card-artwork" data-quote-card-artwork>
                        <p class="quote-card-wordmark">"ENG MANAGER"</p>
                        <blockquote class="quote-card-quote" data-quote-card-quote></blockquote>
                        <div class="quote-card-credit">
                            <p class="quote-card-author">"Matthew Harwood"</p>
                            <p class="quote-card-article">{ title }</p>
                            <a class="quote-card-source" href={ url }>{ url }</a>
                        </div>
                    </div>
                </div>
            </div>
            <footer class="quote-card-footer">
                <div class="quote-card-actions">
                    <button class="quote-card-button" type="button" data-quote-card-copy>"Copy quote + link"</button>
                    <button class="quote-card-button quote-card-button-primary" type="button" data-quote-card-download hidden>"Download PNG"</button>
                </div>
                <p id="quote-card-status" class="quote-card-status" role="status" data-quote-card-status>
                    "Copy the quote and its source link, or select the passage above to copy it yourself."
                </p>
            </footer>
        </dialog>
    };

    Rendered {
        markup,
        critical_css: Vec::new(),
        deferred_css: vec![STYLE],
        js_deps: vec![SCRIPT],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn article_identity_is_escaped_in_preview() {
        let html = render(
            "Teams < tools & \"systems\"",
            "https://engmanager.xyz/articles/test?one=1&two=\"2\"",
        )
        .markup
        .into_string();
        assert!(html.contains("Teams &lt; tools &amp;"));
        assert!(!html.contains("Teams < tools"));
        assert!(
            html.contains(
                "href=\"https://engmanager.xyz/articles/test?one=1&amp;two=&quot;2&quot;\""
            )
        );
        assert!(html.contains("Matthew Harwood"));
    }

    #[test]
    fn passage_controls_are_labelled_and_png_is_progressive() {
        let html = render(
            "A useful passage",
            "https://engmanager.xyz/articles/passage",
        )
        .markup
        .into_string();
        assert!(html.contains("aria-labelledby=\"quote-card-heading\""));
        assert!(html.contains("for=\"quote-card-text\">Quote + source</label>"));
        assert!(html.contains("Select text in the article first to choose a different passage."));
        assert!(html.contains("data-quote-card-text readonly"));
        assert!(html.contains("aria-label=\"Close quote card\""));
        assert!(html.contains("data-quote-card-download hidden"));
        assert!(html.contains("role=\"status\" data-quote-card-status"));
    }

    #[test]
    fn interaction_only_styles_are_deferred() {
        let rendered = render("Article", "https://engmanager.xyz/articles/article");
        assert!(rendered.critical_css.is_empty());
        assert_eq!(rendered.deferred_css, vec![STYLE]);
        assert_eq!(rendered.js_deps, vec![SCRIPT]);
    }
}
