pub mod articles;
pub mod checkout;
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
