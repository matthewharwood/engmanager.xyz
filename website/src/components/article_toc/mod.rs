//! On-this-page sidebar TOC — co-located component.
//!
//! Renders the fixed sidebar navigation for an article's h2/h3 headings. The
//! heading list is hoisted data ([`Heading`], extracted from the Markdown by
//! the article pipeline), so `render` stays pure — same shape as
//! `nav::DropdownItem`.
//!
//! JS contract: the co-located `script.js` (served as `js/c-article-toc.js`,
//! formerly the flat `js/toc-waypoints.js`) is the scrollspy — it toggles
//! `.is-current` on `.article-toc-link`s via an IntersectionObserver band and
//! relocates the `.article-meta-tools` under the sidebar on desktop. Article
//! DETAIL pages load it unconditionally (exactly where `toc-waypoints.js`
//! used to load, even for a heading-less article — the script no-ops); the
//! index never does (ledger #5).
//!
//! Styles: the co-located `style.css` carries the `.article-toc*` rules
//! verbatim from `articles.css` (ledger #8), un-layered like their source,
//! linked immediately after `articles.css` on both article surfaces (the
//! index also loaded these rules via `articles.css` — per-page selector sets
//! stay unchanged). Tier: `critical_css` — the sidebar is visible at first
//! paint on wide viewports, so the sheet stays render-blocking.

use eng_domain::HtmlFragment;
use eng_markup::view;

use super::Rendered;

/// Dist assets emitted by `build.rs` from this folder's `style.css` /
/// `script.js` — generated consts, so a renamed folder fails compilation
/// instead of 404ing.
pub use super::asset_names::article_toc::{SCRIPT, STYLE};

/// A heading destined for the on-this-page sidebar. Hoisted data — the
/// article pipeline extracts these from the Markdown event stream and passes
/// them in so `render` stays pure.
#[derive(Clone)]
pub struct Heading {
    pub level: u32, // 2 or 3
    pub slug: String,
    pub text: String,
}

/// Pure render: `&[Heading] -> Rendered`. Empty markup when the article has
/// no h2/h3 headings — the CSS hides the empty `<aside>` on small viewports
/// anyway, but skipping the render is cleaner. h3 entries get the `.is-h3`
/// modifier for the indented sub-item treatment. The asset deps stay
/// declared either way (matching pre-P4 behavior: `articles.css` +
/// `toc-waypoints.js` loaded on every detail page regardless of headings).
pub fn render(headings: &[Heading]) -> Rendered {
    let markup = if headings.is_empty() {
        HtmlFragment::empty()
    } else {
        let items: HtmlFragment = headings
            .iter()
            .map(|h| {
                let class = if h.level == 3 {
                    "article-toc-link is-h3"
                } else {
                    "article-toc-link"
                };
                view! {
                    <li>
                        <a class={ class } href={ format!("#{}", h.slug) }>
                            { h.text.clone() }
                        </a>
                    </li>
                }
            })
            .collect();

        view! {
            <aside class="article-toc" aria-label="On this page">
                <div class="article-toc-heading">
                    <svg class="article-toc-icon" viewBox="0 0 16 16" aria-hidden="true">
                        <g fill="none" stroke="currentColor" stroke-width="1.5"
                           stroke-linecap="round" stroke-linejoin="round">
                            <line x1="6" y1="4" x2="14" y2="4" />
                            <line x1="6" y1="8" x2="14" y2="8" />
                            <line x1="6" y1="12" x2="14" y2="12" />
                            <circle cx="3" cy="4" r="0.9" fill="currentColor" />
                            <circle cx="3" cy="8" r="0.9" fill="currentColor" />
                            <circle cx="3" cy="12" r="0.9" fill="currentColor" />
                        </g>
                    </svg>
                    "On this page"
                </div>
                <ul class="article-toc-list">{ items }</ul>
            </aside>
        }
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

    fn headings() -> Vec<Heading> {
        vec![
            Heading {
                level: 2,
                slug: "intro".to_string(),
                text: "Intro".to_string(),
            },
            Heading {
                level: 3,
                slug: "details".to_string(),
                text: "Details".to_string(),
            },
        ]
    }

    #[test]
    fn renders_sidebar_with_h3_indent_modifier() {
        let html = render(&headings()).markup.into_string();
        assert!(html.contains(r#"<aside class="article-toc" aria-label="On this page">"#));
        assert!(html.contains("On this page"));
        assert!(html.contains(r##"<a class="article-toc-link" href="#intro">Intro</a>"##));
        assert!(
            html.contains(r##"<a class="article-toc-link is-h3" href="#details">Details</a>"##)
        );
    }

    #[test]
    fn no_headings_renders_empty_markup_but_keeps_deps() {
        let rendered = render(&[]);
        assert!(rendered.markup.as_str().is_empty());
        // Pre-P4 parity: detail pages shipped the toc CSS/JS regardless of
        // the heading count, so the deps stay declared.
        assert_eq!(rendered.critical_css, vec![STYLE]);
        assert_eq!(rendered.js_deps, vec![SCRIPT]);
    }

    #[test]
    fn styles_critical_script_deferred_tier_shapes() {
        let rendered = render(&headings());
        assert_eq!(rendered.critical_css, vec![STYLE]);
        assert!(rendered.deferred_css.is_empty());
        assert_eq!(rendered.js_deps, vec![SCRIPT]);
    }
}
