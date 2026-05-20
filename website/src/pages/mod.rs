pub mod articles;
pub mod homepage;

pub const OPEN_PROPS_HREF: &str =
    "https://unpkg.com/open-props@1.7.23/open-props.min.css";
pub const GOOGLE_FONTS_HREF: &str =
    "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap";

// Cloudflare Images proxy for the author avatar. Reused by the homepage
// (bottom-right popover trigger) and the article-page meta block.
pub const AVATAR_SRC: &str = "https://engmanager.xyz/cdn-cgi/imagedelivery/MdDtxXpLlqqwzPv4AklQiw/febf9573-0897-40b3-f687-a38a678b2300/public";

use eng_domain::HtmlFragment;
use eng_markup::view;

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

// Persistent scavenger-hunt chip in the bottom-left of every page.
// Opens the Web API Receipt modal on click. The discovered count is
// rewritten by js/experiences.js after the registry runs and every
// time a new API is found.
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

// Brutalist theme cycler. Single chip in the bottom-left; clicking it
// advances through the THEMES list defined in js/theme-toggle.js. The
// label shows the current theme's name. State persists via
// localStorage key `engmanager.theme` and syncs across open tabs via
// the storage event.
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
