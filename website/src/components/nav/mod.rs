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
/// instead of 404ing. Both configs use the shared control styles; only the
/// dropdown config depends on the dropdown script.
pub use super::asset_names::nav::{SCRIPT, STYLE};

/// Shared flat scripts the nav depends on but does NOT own: `popover-registry`
/// is a general popover bus used site-wide, and `nav-search-toggle` is shared
/// with the search page. They stay flat assets, referenced by name.
const POPOVER_REGISTRY: &str = "js/popover-registry.js";
const SEARCH_TOGGLE: &str = "js/nav-search-toggle.js";

// Nav-only inline SVG icons (moved here from `pages::mod` — only the nav uses
// them). `class="site-nav-icon"` is the shared sizing hook at every viewport.
const ICON_FOLDER: &str = r##"<svg class="site-nav-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 4.5 L6 4.5 L7.6 6.2 L14 6.2 L14 12.5 L2 12.5 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>"##;

// Simple Icons (CC0): https://github.com/simple-icons/simple-icons/blob/d0b3c2d7153794b912913746fc0498a5d3211727/icons/discord.svg
const ICON_DISCORD: &str = r##"<svg class="site-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>"##;

// Simple Icons (CC0): https://github.com/simple-icons/simple-icons/blob/d0b3c2d7153794b912913746fc0498a5d3211727/icons/github.svg
const ICON_GITHUB: &str = r##"<svg class="site-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>"##;

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
    /// Everywhere else: a plain link to the article index. Shared styles only.
    Link,
}

/// Props for the site nav. `brand_icon_url` (the hashed favicon URL),
/// `search_toggle`, and `theme_picker` fragments are hoisted by the caller; `global_search` is the
/// pre-rendered `components::global_search` child, which the nav absorbs —
/// markup spliced into the bar, js deps merged after the nav's own
/// (`Rendered::absorb` keeps execution order: popover-registry stays ahead of
/// c-nav.js, and pages that pin `js/search.js` earlier win first-seen dedup).
pub struct Props {
    pub brand_icon_url: String,
    pub global_search: Rendered,
    pub search_toggle: HtmlFragment,
    pub theme_picker: HtmlFragment,
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
        </a>
    }
}

fn newsletter_link() -> HtmlFragment {
    view! {
        <a class="site-nav-newsletter" href="/subscribe" aria-label="Newsletter" title="Newsletter" data-hard-nav>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                <rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" />
                <path d="m3.5 6 8.5 6.5L20.5 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        </a>
    }
}

/// The two quiet service entry points also used on the feed.
pub fn service_links() -> HtmlFragment {
    view! {
        <a class="service-nav-link" href="/shop" aria-label="Explore the store" title="Store">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                <path d="M12 4 21 20H3Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
            </svg>
        </a>
        <a class="service-nav-link" href="/coach" aria-label="Discover coaching" title="Coaching">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                <circle cx="9" cy="9" r="5" fill="none" stroke="currentColor" stroke-width="1.5" />
                <circle cx="15" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="1.5" />
            </svg>
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
        theme_picker,
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
            vec![STYLE],
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

    // `data-swap-region` (ledger #14): names this body-level island for the
    // soft-navigation router's region reconcile — the nav VARIES per page
    // (Dropdown on articles, Link on search, absent on the homepage), so the
    // router swaps it wholesale instead of pinning it.
    rendered.markup = view! {
        <nav class="site-nav" aria-label="Primary" data-swap-region="nav">
            <a class="site-nav-brand" href="/feed" aria-label="engmanager.xyz home">
                <img class="site-nav-mark"
                     src={ brand_icon_url }
                     alt=""
                     width="20"
                     height="20"
                     aria-hidden="true" />
                <span class="site-nav-wordmark">"engmanager.xyz"</span>
            </a>
            <div class="site-nav-theme" aria-label="Theme">
                { theme_picker }
            </div>
            { global_search }
            <div class="site-nav-links">
                { search_toggle }
                { articles_slot }
                { service_links() }
                <a class="site-nav-link" href="https://discord.gg/sTzQBrbnBM" target="_blank" rel="noopener" aria-label="Join the Discord">
                    { icon(ICON_DISCORD) }
                </a>
                <a class="site-nav-link" href="https://github.com/matthewharwood" target="_blank" rel="noopener" aria-label="View on GitHub">
                    { icon(ICON_GITHUB) }
                </a>
                { newsletter_link() }
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
            theme_picker: HtmlFragment::empty(),
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
        // Byte-parity pin updated DELIBERATELY for ledger #14: the nav gained
        // the additive data-swap-region attribute.
        assert!(
            html.contains(r#"<nav class="site-nav" aria-label="Primary" data-swap-region="nav">"#)
        );
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
    fn link_config_is_plain_link_with_shared_styles_and_no_dropdown_script() {
        let rendered = render(Props {
            articles: Articles::Link,
            ..dropdown_props()
        });
        let html = rendered.markup.into_string();
        assert!(
            html.contains(r#"<a class="site-nav-link" href="/articles/" aria-label="Articles">"#)
        );
        assert!(!html.contains("nav-dropdown"));
        // Shared newsletter control styles apply to the plain nav too.
        assert_eq!(rendered.critical_css, vec![STYLE]);
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

    #[test]
    fn newsletter_is_a_named_icon_at_the_right_end_of_the_nav() {
        let html = render(dropdown_props()).markup.into_string();
        assert!(html.contains(
            r#"href="/subscribe" aria-label="Newsletter" title="Newsletter" data-hard-nav"#
        ));
        assert!(html.find("site-nav-newsletter").unwrap() > html.find("View on GitHub").unwrap());
        let icon = newsletter_link().into_string();
        assert!(icon.contains(r#"aria-hidden="true" focusable="false""#));
    }
}
