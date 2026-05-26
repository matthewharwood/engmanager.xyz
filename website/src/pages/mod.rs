pub mod articles;
pub mod comments;
pub mod homepage;
pub mod not_found;
pub mod search;
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

// Persistent scavenger-hunt chip. On desktop it is positioned directly
// by CSS; on mobile it lives inside `render_quick_actions()` as one of
// the expandable FAB actions. Renders as a circular emoji button with
// a shopping-cart-style count badge in the top-right corner.
pub fn render_hunt_chip() -> HtmlFragment {
    view! {
        <button class="hunt-chip"
                type="button"
                popovertarget="api-receipt-modal"
                aria-label="Open the API hunt log">
            <span class="hunt-chip-emoji" aria-hidden="true">"🧪"</span>
            <span class="hunt-chip-badge" data-hunt-chip-count="0">"0"</span>
            <span class="sr-only">"APIs found"</span>
        </button>
    }
}

// Toast container for scavenger-hunt discoveries. Always present in
// the DOM; experiences.js mounts brutalist toast cards inside it and
// animates them in/out.
pub fn render_discovery_toasts() -> HtmlFragment {
    view! {
        <div class="discovery-toasts"
             data-discovery-toasts
             aria-live="polite"
             aria-atomic="false"></div>
    }
}

// Inline SVG icons used in the site nav. On mobile the text labels are
// visually hidden (sr-only) and these glyphs take their place to save
// horizontal room. Discord + GitHub are filled brand marks; folder +
// search are stroked outlines to match the brutalist line aesthetic.
//
// `class="site-nav-icon"` is the shared sizing hook; visibility is
// flipped per-viewport in critical.css.
const ICON_FOLDER: &str = r##"<svg class="site-nav-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5 L6 4.5 L7.6 6.2 L14 6.2 L14 12.5 L2 12.5 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>"##;

const ICON_DISCORD: &str = r##"<svg class="site-nav-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.55 3.31a13.5 13.5 0 0 0-3.4-1.06.05.05 0 0 0-.05.02c-.15.26-.31.6-.43.87a12.6 12.6 0 0 0-3.78 0c-.12-.27-.29-.61-.44-.87a.05.05 0 0 0-.05-.02 13.5 13.5 0 0 0-3.4 1.06s-.02.01-.03.02C.13 6.18-.18 8.97.03 11.72c0 .02.01.04.03.05a13.6 13.6 0 0 0 4.06 2.04c.03.01.06 0 .07-.02.31-.43.59-.88.83-1.36.01-.03 0-.07-.03-.08-.44-.17-.86-.37-1.27-.6-.03-.02-.04-.07-.01-.09.09-.07.17-.14.25-.21a.05.05 0 0 1 .05 0c2.66 1.21 5.55 1.21 8.18 0a.05.05 0 0 1 .05 0c.08.07.16.14.25.21.03.02.02.07-.01.09-.41.24-.83.43-1.27.6-.03.01-.04.05-.03.08.25.48.53.93.83 1.36.02.02.05.03.07.02a13.5 13.5 0 0 0 4.07-2.04.05.05 0 0 0 .02-.05c.25-3.17-.42-5.94-1.76-8.39 0-.01-.01-.02-.03-.02ZM5.46 10.04c-.81 0-1.48-.74-1.48-1.65 0-.91.65-1.65 1.48-1.65.83 0 1.5.75 1.49 1.65 0 .91-.66 1.65-1.49 1.65Zm5.47 0c-.81 0-1.48-.74-1.48-1.65 0-.91.65-1.65 1.48-1.65.83 0 1.5.75 1.49 1.65 0 .91-.66 1.65-1.49 1.65Z"/></svg>"##;

const ICON_GITHUB: &str = r##"<svg class="site-nav-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.32c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.16-.89-1.16-.73-.5.06-.49.06-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>"##;

const ICON_SEARCH: &str = r##"<svg class="site-nav-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 10 L13.5 13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>"##;

pub fn nav_icon_folder() -> HtmlFragment {
    HtmlFragment::new(ICON_FOLDER.to_string())
}
pub fn nav_icon_discord() -> HtmlFragment {
    HtmlFragment::new(ICON_DISCORD.to_string())
}
pub fn nav_icon_github() -> HtmlFragment {
    HtmlFragment::new(ICON_GITHUB.to_string())
}

// Mobile-only nav button: tapping it opens the .site-search form
// (which is display:none on narrow viewports) and focuses the input.
// js/nav-search-toggle.js wires up the click/Escape handling.
pub fn render_nav_search_toggle() -> HtmlFragment {
    HtmlFragment::new(format!(
        r##"<button class="site-search-toggle" type="button" aria-label="Open search" aria-expanded="false" data-search-toggle>{ICON_SEARCH}</button>"##
    ))
}

// Theme cycler. Renders as a single circular emoji button — one emoji
// per theme, swapped in by js/theme-toggle.js on each click. The
// theme name lives in a sibling sr-only span so screen readers and
// the aria-label can announce "Cycle theme · current: Light" etc.
pub fn render_theme_picker() -> HtmlFragment {
    view! {
        <button class="theme-picker"
                type="button"
                data-theme-cycle
                aria-label="Cycle theme · current: Auto">
            <span class="theme-picker-emoji" aria-hidden="true" data-theme-emoji>"🪄"</span>
            <span class="sr-only" data-theme-current-label>"Auto"</span>
        </button>
    }
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
    HtmlFragment::new(format!(
        "<script>window.__engSfxUrls={{themes:{{{theme_entries}}},trash:\"{}\",keyclick:\"{}\"}};</script>",
        crate::asset_url("trash-drop.mp3"),
        crate::asset_url("keyclick.mp3"),
    ))
}

// Shared quick-action surface. Desktop CSS treats the wrapper as
// `display: contents`, preserving the existing two fixed chips. Mobile
// CSS turns the same controls into a tucked right-edge FAB that expands
// to reveal theme + Web API receipt actions.
pub fn render_quick_actions() -> HtmlFragment {
    view! {
        <div class="quick-actions"
             data-quick-actions
             data-state="collapsed">
            <button class="quick-actions-peek"
                    type="button"
                    data-quick-actions-toggle
                    aria-label="Open quick actions"
                    aria-expanded="false">
                <span class="quick-actions-arrow" aria-hidden="true">"←"</span>
            </button>
            <div class="quick-actions-bubbles" aria-label="Quick actions">
                { render_theme_picker() }
                { render_hunt_chip() }
            </div>
        </div>
    }
}

pub fn render_global_search(placeholder: &str) -> HtmlFragment {
    view! {
        <form class="site-search" action="/search" method="get" role="search" data-search-form>
            <label class="sr-only" for="site-search-input">"Search articles and comments"</label>
            <input class="site-search-input"
                   id="site-search-input"
                   type="search"
                   name="q"
                   autocomplete="off"
                   role="combobox"
                   aria-expanded="false"
                   aria-controls="site-search-results"
                   aria-autocomplete="list"
                   placeholder={ placeholder } />
            <ul class="site-search-results"
                id="site-search-results"
                role="listbox"
                hidden
                data-search-results></ul>
            <noscript>
                <button class="site-search-submit" type="submit">"Search"</button>
            </noscript>
        </form>
    }
}
