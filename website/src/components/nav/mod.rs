//! Site navigation — the first asset-bearing co-located feature component.
//!
//! Renders the sticky primary `<nav>` shared by the article and search
//! surfaces. The only per-page variation is the "Articles" slot:
//! - article pages show a data-bearing [`Articles::Dropdown`] of recent posts,
//! - other pages show a plain [`Articles::Link`].
//!
//! Pure render: `Props -> Rendered`. The two asset/state-bearing inputs (the
//! favicon URL and the global-search + search-toggle fragments) are hoisted by
//! the caller, and the dropdown's article rows are passed in as plain data, so
//! `render` never touches `asset_url`, `static`s, or request state.
//!
//! JS contract: the dropdown markup (`.nav-dropdown` / `.nav-dropdown-trigger`
//! / `.nav-dropdown-panel`) is driven by `script.js` (served as `js/c-nav.js`),
//! which lazy-imports anime.js on first hover/focus and coordinates with the
//! shared `window.__engPopovers` bus from `js/popover-registry.js`. The plain
//! link config ships no dropdown JS.

use eng_domain::HtmlFragment;
use eng_markup::view;

use super::Rendered;

/// Dist assets emitted by `build.rs` from this folder's `style.css` /
/// `script.js` — generated consts, so a renamed folder fails compilation
/// instead of 404ing. The dropdown config depends on both; the plain-link
/// config on neither.
pub use super::asset_names::nav::{SCRIPT, STYLE};

/// Shared flat scripts the nav depends on but does NOT own: `popover-registry`
/// is a general popover bus used site-wide, and `nav-search-toggle` is shared
/// with the search page. They stay flat assets, referenced by name.
const POPOVER_REGISTRY: &str = "js/popover-registry.js";
const SEARCH_TOGGLE: &str = "js/nav-search-toggle.js";

// Nav-only inline SVG icons (moved here from `pages::mod` — only the nav uses
// them). `class="site-nav-icon"` is the shared sizing hook; visibility flips
// per-viewport in `critical.css`.
const ICON_FOLDER: &str = r##"<svg class="site-nav-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5 L6 4.5 L7.6 6.2 L14 6.2 L14 12.5 L2 12.5 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>"##;

const ICON_DISCORD: &str = r##"<svg class="site-nav-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.55 3.31a13.5 13.5 0 0 0-3.4-1.06.05.05 0 0 0-.05.02c-.15.26-.31.6-.43.87a12.6 12.6 0 0 0-3.78 0c-.12-.27-.29-.61-.44-.87a.05.05 0 0 0-.05-.02 13.5 13.5 0 0 0-3.4 1.06s-.02.01-.03.02C.13 6.18-.18 8.97.03 11.72c0 .02.01.04.03.05a13.6 13.6 0 0 0 4.06 2.04c.03.01.06 0 .07-.02.31-.43.59-.88.83-1.36.01-.03 0-.07-.03-.08-.44-.17-.86-.37-1.27-.6-.03-.02-.04-.07-.01-.09.09-.07.17-.14.25-.21a.05.05 0 0 1 .05 0c2.66 1.21 5.55 1.21 8.18 0a.05.05 0 0 1 .05 0c.08.07.16.14.25.21.03.02.02.07-.01.09-.41.24-.83.43-1.27.6-.03.01-.04.05-.03.08.25.48.53.93.83 1.36.02.02.05.03.07.02a13.5 13.5 0 0 0 4.07-2.04.05.05 0 0 0 .02-.05c.25-3.17-.42-5.94-1.76-8.39 0-.01-.01-.02-.03-.02ZM5.46 10.04c-.81 0-1.48-.74-1.48-1.65 0-.91.65-1.65 1.48-1.65.83 0 1.5.75 1.49 1.65 0 .91-.66 1.65-1.49 1.65Zm5.47 0c-.81 0-1.48-.74-1.48-1.65 0-.91.65-1.65 1.48-1.65.83 0 1.5.75 1.49 1.65 0 .91-.66 1.65-1.49 1.65Z"/></svg>"##;

const ICON_GITHUB: &str = r##"<svg class="site-nav-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.32c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.16-.89-1.16-.73-.5.06-.49.06-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>"##;

/// One row in the Articles dropdown panel. Hoisted data — the caller fetches
/// the latest articles and passes them in so `render` stays pure.
pub struct DropdownItem {
    pub display: String,
    pub slug: String,
    pub date_label: String,
}

/// The "Articles" slot of the nav, which differs by page.
pub enum Articles {
    /// Article surface: a disclosure dropdown of recent posts (the rows are
    /// hoisted data). Pulls in the dropdown CSS + JS.
    Dropdown(Vec<DropdownItem>),
    /// Everywhere else: a plain link to the article index. No extra assets.
    Link,
}

/// Props for the site nav. `brand_icon_url` (the hashed favicon URL) and the
/// `search_toggle` fragment are hoisted by the caller; `global_search` is the
/// pre-rendered `components::global_search` child, which the nav absorbs —
/// markup spliced into the bar, js deps merged after the nav's own
/// (`Rendered::absorb` keeps execution order: popover-registry stays ahead of
/// c-nav.js, and pages that pin `js/search.js` earlier win first-seen dedup).
pub struct Props {
    pub brand_icon_url: String,
    pub global_search: Rendered,
    pub search_toggle: HtmlFragment,
    pub articles: Articles,
}

fn icon(svg: &'static str) -> HtmlFragment {
    HtmlFragment::new(svg.to_string())
}

// Vercel-style dropdown trigger + panel containing the latest three articles.
// The trigger keeps the `.is-current` highlight so the nav reads identically
// for users on browsers without JS — the markup is still a clickable
// disclosure with all targets inside.
fn render_dropdown(items: Vec<DropdownItem>) -> HtmlFragment {
    let rows: HtmlFragment = items
        .into_iter()
        .enumerate()
        .map(|(i, item)| {
            view! {
                <a class="nav-dropdown-item"
                   href={ format!("/articles/{}", item.slug) }
                   role="menuitem">
                    <span class="nav-dropdown-item-index" aria-hidden="true">
                        { format!("{}", i + 1) }
                    </span>
                    <div class="nav-dropdown-item-body">
                        <div class="nav-dropdown-item-title">{ item.display }</div>
                        <div class="nav-dropdown-item-date">{ item.date_label }</div>
                    </div>
                </a>
            }
        })
        .collect();

    view! {
        <div class="nav-dropdown">
            <button class="nav-dropdown-trigger is-current"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded="false"
                    aria-label="Articles">
                { icon(ICON_FOLDER) }
                <span class="site-nav-link-label">"Articles"</span>
                <svg class="nav-dropdown-chevron" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 4 L5 7 L8 4"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.4"
                          stroke-linecap="round"
                          stroke-linejoin="round" />
                </svg>
            </button>
            <div class="nav-dropdown-panel" role="menu">
                { rows }
                <hr class="nav-dropdown-divider" />
                <a class="nav-dropdown-all" href="/articles/" role="menuitem">
                    "All articles"
                    <span class="nav-dropdown-all-arrow" aria-hidden="true">"→"</span>
                </a>
            </div>
        </div>
    }
}

fn render_articles_link() -> HtmlFragment {
    view! {
        <a class="site-nav-link" href="/articles/" aria-label="Articles">
            { icon(ICON_FOLDER) }
            <span class="site-nav-link-label">"Articles"</span>
        </a>
    }
}

/// Pure render: `Props -> Rendered`. Emits the byte-identical `<nav>` node tree
/// the article + search pages used to build inline, plus the dist assets the
/// chosen `Articles` config depends on.
pub fn render(props: Props) -> Rendered {
    let Props {
        brand_icon_url,
        global_search,
        search_toggle,
        articles,
    } = props;

    // The nav-dropdown TRIGGER sits in the nav bar (visible at first paint), so
    // its CSS is critical (render-blocking), not deferred.
    let (articles_slot, critical_css, js_deps) = match articles {
        Articles::Dropdown(items) => (
            render_dropdown(items),
            vec![STYLE],
            vec![POPOVER_REGISTRY, SCRIPT, SEARCH_TOGGLE],
        ),
        Articles::Link => (
            render_articles_link(),
            Vec::new(),
            vec![POPOVER_REGISTRY, SEARCH_TOGGLE],
        ),
    };

    // Absorb the global-search child: its markup splices into the bar below
    // and its js deps (search.js + search-keyclick.js) append after the
    // nav's own deps, preserving execution order.
    let mut rendered = Rendered {
        markup: HtmlFragment::empty(),
        critical_css,
        deferred_css: Vec::new(),
        js_deps,
    };
    let global_search = rendered.absorb(global_search);

    rendered.markup = view! {
        <nav class="site-nav" aria-label="Primary">
            <a class="site-nav-brand" href="/" aria-label="engmanager.xyz home">
                <img class="site-nav-mark"
                     src={ brand_icon_url }
                     alt=""
                     width="20"
                     height="20"
                     aria-hidden="true" />
                <span class="site-nav-wordmark">"engmanager.xyz"</span>
            </a>
            { global_search }
            <div class="site-nav-links">
                { search_toggle }
                { articles_slot }
                <a class="site-nav-link" href="https://discord.gg/sTzQBrbnBM" target="_blank" rel="noopener" aria-label="Join the Discord">
                    { icon(ICON_DISCORD) }
                    <span class="site-nav-link-label">"Discord"</span>
                </a>
                <a class="site-nav-link" href="https://github.com/matthewharwood" target="_blank" rel="noopener" aria-label="View on GitHub">
                    { icon(ICON_GITHUB) }
                    <span class="site-nav-link-label">"GitHub"</span>
                </a>
            </div>
        </nav>
    };

    rendered
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::components::global_search;

    fn dropdown_props() -> Props {
        Props {
            brand_icon_url: "/assets/favicon.svg".to_string(),
            global_search: global_search::render(global_search::Props {
                placeholder: "Search",
            }),
            search_toggle: HtmlFragment::new(
                "<button class=\"site-search-toggle\"></button>".to_string(),
            ),
            articles: Articles::Dropdown(vec![DropdownItem {
                display: "Hello World".to_string(),
                slug: "hello-world".to_string(),
                date_label: "MAY 2026".to_string(),
            }]),
        }
    }

    #[test]
    fn dropdown_config_renders_nav_and_panel() {
        let rendered = render(dropdown_props());
        let html = rendered.markup.into_string();
        assert!(html.contains(r#"<nav class="site-nav" aria-label="Primary">"#));
        assert!(html.contains(r#"class="nav-dropdown-trigger is-current""#));
        assert!(html.contains(r#"href="/articles/hello-world""#));
        assert!(html.contains("Hello World"));
        assert!(html.contains("MAY 2026"));
        assert!(html.contains("All articles"));
        // Brand favicon URL is hoisted in via Props, not asset_url.
        assert!(html.contains(r#"src="/assets/favicon.svg""#));
    }

    #[test]
    fn dropdown_config_declares_dropdown_assets_and_absorbed_search() {
        let rendered = render(dropdown_props());
        assert_eq!(rendered.critical_css, vec![STYLE]);
        assert!(rendered.deferred_css.is_empty());
        // Execution order: the nav's own deps first (popover-registry stays
        // ahead of c-nav.js), then the absorbed global-search deps.
        assert_eq!(
            rendered.js_deps,
            vec![
                POPOVER_REGISTRY,
                SCRIPT,
                SEARCH_TOGGLE,
                "js/search.js",
                "js/search-keyclick.js",
            ]
        );
    }

    #[test]
    fn nav_splices_absorbed_global_search_markup() {
        let html = render(dropdown_props()).markup.into_string();
        // The absorbed child's form lands between the brand and the links.
        assert!(html.contains(r#"<form class="site-search" action="/search" method="get" role="search" data-search-form>"#));
        let brand = html.find("site-nav-brand").expect("brand");
        let search = html.find("site-search-input").expect("search input");
        let links = html.find("site-nav-links").expect("links");
        assert!(brand < search && search < links);
    }

    #[test]
    fn link_config_is_plain_link_with_no_dropdown_assets() {
        let rendered = render(Props {
            articles: Articles::Link,
            ..dropdown_props()
        });
        let html = rendered.markup.into_string();
        assert!(
            html.contains(r#"<a class="site-nav-link" href="/articles/" aria-label="Articles">"#)
        );
        assert!(!html.contains("nav-dropdown"));
        // Plain link carries no co-located CSS and no dropdown JS — only the
        // shared flat deps plus the absorbed global-search scripts.
        assert!(rendered.critical_css.is_empty());
        assert!(rendered.deferred_css.is_empty());
        assert_eq!(
            rendered.js_deps,
            vec![
                POPOVER_REGISTRY,
                SEARCH_TOGGLE,
                "js/search.js",
                "js/search-keyclick.js",
            ]
        );
    }
}
