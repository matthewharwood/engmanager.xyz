pub mod articles;
pub mod checkout;
pub mod coach;
pub mod homepage;
pub mod not_found;
pub mod search;
pub mod shell;
pub mod shop;

use eng_domain::HtmlFragment;
use eng_markup::view;

pub const OPEN_PROPS_HREF: &str = "https://unpkg.com/open-props@1.7.23/open-props.min.css";
pub const GOOGLE_FONTS_HREF: &str =
    "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap";

// Cloudflare Images proxy for the author avatar. Reused by the homepage
// (bottom-right popover trigger) and the article-page meta block.
const AVATAR_DELIVERY_BASE: &str = "https://engmanager.xyz/cdn-cgi/imagedelivery/MdDtxXpLlqqwzPv4AklQiw/febf9573-0897-40b3-f687-a38a678b2300";
pub const AVATAR_SRC: &str = "https://engmanager.xyz/cdn-cgi/imagedelivery/MdDtxXpLlqqwzPv4AklQiw/febf9573-0897-40b3-f687-a38a678b2300/public";

pub fn avatar_variant(width: u16) -> String {
    format!("{AVATAR_DELIVERY_BASE}/w={width},fit=cover,format=auto")
}

pub fn avatar_srcset(widths: &[u16]) -> String {
    widths
        .iter()
        .map(|width| format!("{} {}w", avatar_variant(*width), width))
        .collect::<Vec<_>>()
        .join(", ")
}

/// Every share card is 1200x630 — the box LinkedIn, X, Slack, Discord and
/// iMessage all render at 1.91:1. Emitted as `og:image:width`/`height`.
pub const SHARE_CARD_SIZE: (u16, u16) = (1200, 630);

/// Absolute URL of a share card in `website/assets/og/`, content-addressed
/// like every other asset.
///
/// `origin` matters: a scraper never resolves a relative `og:image`, and the
/// coaching page lives on its own subdomain, so the card URL has to be built
/// against whichever origin the page is served from.
///
/// `name` is the card's basename, e.g. `"coach"` or `"article-auteurs"`.
/// Cards are produced by `./scripts/generate-og.sh`; a name with no file
/// behind it is caught by `share_card_urls_all_resolve_to_real_assets`.
pub fn share_card(origin: &str, name: &str) -> String {
    format!("{origin}{}", crate::asset_url(&format!("og/{name}.jpg")))
}

/// The card a page falls back to when it has none of its own.
pub const DEFAULT_SHARE_CARD: &str = "default";

/// `article-<slug>` if that article has its own card, else the site card.
/// Article cards are generated for every public article, but a brand-new
/// article renders before anyone reruns the generator — so this degrades to
/// the site card instead of emitting a 404 URL to a scraper.
pub fn article_share_card(slug: &str) -> String {
    let name = format!("article-{slug}");
    let path = format!("og/{name}.jpg");
    if crate::asset_url(&path) == format!("/assets/{path}") {
        return DEFAULT_SHARE_CARD.to_string();
    }
    name
}

pub fn render_resource_hints() -> HtmlFragment {
    HtmlFragment::new(
        r#"<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preload" href="/assets/fonts/monumentextended-black-webfont.woff2" as="font" type="font/woff2" crossorigin>"#
            .to_string(),
    )
}

pub fn render_sitemap_link() -> HtmlFragment {
    view! {
        <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
    }
}

pub fn render_liquid_title_filter() -> HtmlFragment {
    view! {
        <svg class="liquid-title-defs"
             aria-hidden="true"
             focusable="false"
             width="0"
             height="0">
            <filter id="liquid-title-water"
                    x="-10%"
                    y="-40%"
                    width="120%"
                    height="180%"
                    color-interpolation-filters="sRGB">
                <feTurbulence type="fractalNoise"
                              baseFrequency="0.012 0.07"
                              numOctaves="2"
                              seed="8"
                              result="liquidNoise">
                    <animate attributeName="baseFrequency"
                             dur="2.8s"
                             values="0.012 0.07;0.026 0.052;0.018 0.092;0.012 0.07"
                             repeatCount="indefinite" />
                    <animate attributeName="seed"
                             dur="1.4s"
                             values="2;9;17;2"
                             repeatCount="indefinite" />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic"
                                   in2="liquidNoise"
                                   scale="7"
                                   xChannelSelector="R"
                                   yChannelSelector="G">
                    <animate attributeName="scale"
                             dur="1.9s"
                             values="3;9;5;12;3"
                             repeatCount="indefinite" />
                </feDisplacementMap>
            </filter>
        </svg>
    }
}

// Emits a marker meta tag when the binary was built with the `dev`
// cargo feature (i.e. via `just dev`). js/experiences.js reads this
// tag in the Service Worker experience and, when set, unregisters any
// installed worker + purges all caches instead of registering a new
// one — so source edits show up on next reload without manual DevTools
// cache-busting.
pub fn render_dev_meta() -> HtmlFragment {
    if cfg!(feature = "dev") {
        view! { <meta name="engmanager-mode" content="dev" /> }
    } else {
        HtmlFragment::empty()
    }
}

// The quick-actions cluster (FAB rail + theme-picker + hunt-chip) moved to
// the co-located component `components/quick_actions/` (markup + critical
// styles + the FAB script). The theme cycler renders standalone on the
// shop/checkout/404 pages via `components::quick_actions::theme_picker()`.

// The discovery-toast container moved to the co-located component
// `components/discovery_toasts/` (markup + deferred styles). `experiences.js`
// still drives it from the page level.

// Inline SVG icon for the mobile search toggle. `class="site-nav-icon"` is the
// shared sizing hook; visibility is flipped per-viewport in critical.css. (The
// folder / Discord / GitHub nav glyphs moved into the co-located nav component,
// `components/nav/`, which is the only place they were used.)
const ICON_SEARCH: &str = r##"<svg class="site-nav-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 10 L13.5 13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>"##;

// Mobile-only nav button: tapping it opens the .site-search form
// (which is display:none on narrow viewports) and focuses the input.
// js/nav-search-toggle.js wires up the click/Escape handling.
pub fn render_nav_search_toggle() -> HtmlFragment {
    HtmlFragment::new(format!(
        r##"<button class="site-search-toggle" type="button" aria-label="Open search" aria-expanded="false" data-search-toggle>{ICON_SEARCH}</button>"##
    ))
}

// Single URL map for every SFX in the codebase, exposed as
// `window.__engSfxUrls` to consumers (theme-toggle.js, trash-drag.js,
// search-keyclick.js, ...). All sounds route through js/audio.js;
// this is the canonical place to register their hashed asset URLs.
//
// Shape:
//   window.__engSfxUrls = {
//       themes: { auto: "...", light: "...", ... },
//       trash: "...",
//       keyclick: "...",
//   }
//
// Must be rendered on every page that loads audio.js so the consumer
// scripts find their URLs when their handlers fire.
pub fn render_sfx_urls() -> HtmlFragment {
    const THEMES: &[&str] = &[
        "auto",
        "light",
        "dark",
        "catppuccin",
        "synthwave",
        "cyberpunk",
        "forest",
        "lofi",
        "dracula",
        "luxury",
    ];
    let theme_entries = THEMES
        .iter()
        .map(|slug| {
            format!(
                "{slug}:\"{}\"",
                crate::asset_url(&format!("themes/{slug}.mp3"))
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    crate::components::script_island(
        "__engSfxUrls",
        &format!(
            "{{themes:{{{theme_entries}}},trash:\"{}\",keyclick:\"{}\"}}",
            crate::asset_url("trash-drop.mp3"),
            crate::asset_url("keyclick.mp3"),
        ),
    )
}

// Hashed URLs for the lazily-imported experience modules, exposed as
// `window.__engUrls` for js/experiences.js. Must precede the experiences.js
// script tag on every page that loads it (homepage + article surfaces).
pub fn render_experience_urls() -> HtmlFragment {
    crate::components::script_island(
        "__engUrls",
        &format!(
            "{{paintHatch:\"{}\",cryptoWorker:\"{}\"}}",
            crate::asset_url("js/paint-brutalist-hatch.js"),
            crate::asset_url("js/worker-crypto.js"),
        ),
    )
}

// The global search form moved to the co-located component
// `components/global_search/` (markup + the flat search.js/search-keyclick.js
// deps); the nav absorbs it. The homepage hero search is different markup
// and stays in pages/homepage.rs.

#[cfg(test)]
mod share_card_tests {
    use super::*;
    use crate::content::public_articles;

    /// A share card that 404s is worse than none at all: the scraper shows a
    /// broken card and caches it. `asset_url` falls back to a flat, unhashed
    /// `/assets/{path}` when a file is not embedded, so a hashed URL is proof
    /// the bytes shipped.
    #[test]
    fn share_card_urls_all_resolve_to_real_assets() {
        let mut names = vec![DEFAULT_SHARE_CARD.to_string(), "coach".to_string()];
        names.extend(public_articles().map(|a| format!("article-{}", a.slug)));

        for name in names {
            let path = format!("og/{name}.jpg");
            assert_ne!(
                crate::asset_url(&path),
                format!("/assets/{path}"),
                "{path} is missing — rerun ./scripts/generate-og.sh and commit the result"
            );
        }
    }

    /// Scrapers never resolve a relative og:image, and the coaching page is
    /// on its own subdomain, so the origin has to come along.
    #[test]
    fn share_card_urls_are_absolute_and_content_addressed() {
        let url = share_card("https://coach.engmanager.xyz", "coach");
        assert!(url.starts_with("https://coach.engmanager.xyz/assets/og/coach."));
        assert!(url.ends_with(".jpg"));
        assert_ne!(
            url, "https://coach.engmanager.xyz/assets/og/coach.jpg",
            "the URL should carry a content hash"
        );
    }

    /// Every public article has its own card today. An article added before
    /// the generator is rerun must fall back to the site card rather than
    /// point a scraper at a file that does not exist.
    #[test]
    fn articles_use_their_own_card_and_fall_back_to_the_site_card() {
        for article in public_articles() {
            assert_eq!(
                article_share_card(article.slug),
                format!("article-{}", article.slug),
                "{} has no card; rerun ./scripts/generate-og.sh",
                article.slug
            );
        }
        assert_eq!(
            article_share_card("an-article-written-five-minutes-ago"),
            DEFAULT_SHARE_CARD
        );
    }

    /// The cards are the one asset a scraper downloads before it will render
    /// a link, so they stay small; and every one is the 1.91:1 box.
    #[test]
    fn cards_are_small_enough_for_a_scraper_to_fetch() {
        let (width, height) = SHARE_CARD_SIZE;
        assert_eq!((width, height), (1200, 630));

        for name in [DEFAULT_SHARE_CARD, "coach", "article-auteurs"] {
            let bytes = std::fs::metadata(format!("assets/og/{name}.jpg"))
                .unwrap_or_else(|_| panic!("assets/og/{name}.jpg is missing"))
                .len();
            assert!(
                bytes < 300_000,
                "{name}.jpg is {bytes} bytes; LinkedIn caps og:image at 5MB but \
                 anything over ~300KB just slows the first scrape"
            );
        }
    }
}
