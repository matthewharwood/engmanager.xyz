pub mod articles;
pub mod homepage;

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
// the expandable FAB actions.
pub fn render_hunt_chip() -> HtmlFragment {
    view! {
        <button class="hunt-chip"
                type="button"
                popovertarget="api-receipt-modal"
                aria-label="Open the API hunt log">
            <span class="hunt-chip-glyph" aria-hidden="true">"⌬"</span>
            <span class="hunt-chip-count" data-hunt-chip-count>"0"</span>
            <span class="hunt-chip-suffix">" FOUND"</span>
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

// Brutalist theme cycler. On desktop it remains a fixed chip; on mobile
// it becomes one of the expandable quick-action bubbles.
pub fn render_theme_picker() -> HtmlFragment {
    view! {
        <button class="theme-picker"
                type="button"
                data-theme-cycle
                aria-label="Cycle to next theme">
            <span class="theme-picker-glyph" aria-hidden="true">"◐"</span>
            <span class="theme-picker-label" data-theme-current-label>"Auto"</span>
        </button>
    }
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
