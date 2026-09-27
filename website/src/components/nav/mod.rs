//! Shared primary site navigation.
//!
//! Pure render: caller-provided brand, search, and theme fragments are
//! assembled with service, social, and newsletter links.

use eng_domain::HtmlFragment;
use eng_markup::view;

use super::Rendered;

/// Shared control styles emitted by `build.rs`.
pub use super::asset_names::nav::STYLE;

const SEARCH_TOGGLE: &str = "js/nav-search-toggle.js";

// Simple Icons (CC0): https://github.com/simple-icons/simple-icons/blob/d0b3c2d7153794b912913746fc0498a5d3211727/icons/discord.svg
const ICON_DISCORD: &str = r##"<svg class="site-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>"##;

// Simple Icons (CC0): https://github.com/simple-icons/simple-icons/blob/d0b3c2d7153794b912913746fc0498a5d3211727/icons/github.svg
const ICON_GITHUB: &str = r##"<svg class="site-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>"##;

/// Caller-provided navigation fragments. The global search child contributes
/// its markup and asset dependencies through `Rendered::absorb`.
pub struct Props {
    pub brand_icon_url: String,
    pub global_search: Rendered,
    pub search_toggle: HtmlFragment,
    pub theme_picker: HtmlFragment,
}

fn icon(svg: &'static str) -> HtmlFragment {
    HtmlFragment::new(svg.to_string())
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

/// Render the navigation and declare its shared styles and search dependencies.
pub fn render(props: Props) -> Rendered {
    let Props {
        brand_icon_url,
        global_search,
        search_toggle,
        theme_picker,
    } = props;

    // Absorb the global-search child: its markup splices into the bar below
    // and its js deps (search.js + search-keyclick.js) append after the
    // nav's own deps, preserving execution order.
    let mut rendered = Rendered {
        markup: HtmlFragment::empty(),
        critical_css: vec![STYLE],
        deferred_css: Vec::new(),
        js_deps: vec![SEARCH_TOGGLE],
    };
    let global_search = rendered.absorb(global_search);

    // The soft-navigation router replaces this body-level island on page swaps.
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

    fn nav_props() -> Props {
        Props {
            brand_icon_url: "/assets/favicon.svg".to_string(),
            global_search: global_search::render(global_search::Props {
                placeholder: "Search",
            }),
            search_toggle: HtmlFragment::new(
                "<button class=\"site-search-toggle\"></button>".to_string(),
            ),
            theme_picker: HtmlFragment::empty(),
        }
    }

    #[test]
    fn nav_declares_control_styles_and_absorbed_search() {
        let rendered = render(nav_props());
        assert_eq!(
            rendered.critical_css,
            vec![STYLE, "css/c-global-search.css"]
        );
        assert!(rendered.deferred_css.is_empty());
        assert_eq!(
            rendered.js_deps,
            vec![SEARCH_TOGGLE, "js/search.js", "js/search-keyclick.js"]
        );
    }

    #[test]
    fn nav_splices_absorbed_global_search_markup() {
        let html = render(nav_props()).markup.into_string();
        // The absorbed child's form lands between the brand and the links.
        assert!(html.contains(r#"<form class="site-search" action="/search" method="get" role="search" data-search-form>"#));
        let brand = html.find("site-nav-brand").expect("brand");
        let search = html.find("site-search-input").expect("search input");
        let links = html.find("site-nav-links").expect("links");
        assert!(brand < search && search < links);
    }

    #[test]
    fn newsletter_is_a_named_icon_at_the_right_end_of_the_nav() {
        let html = render(nav_props()).markup.into_string();
        assert!(html.contains(
            r#"href="/subscribe" aria-label="Newsletter" title="Newsletter" data-hard-nav"#
        ));
        assert!(html.find("site-nav-newsletter").unwrap() > html.find("View on GitHub").unwrap());
        let icon = newsletter_link().into_string();
        assert!(icon.contains(r#"aria-hidden="true" focusable="false""#));
    }
}
