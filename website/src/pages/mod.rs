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

// All themes shipped in css/src/critical.css `@layer fp.themes`. Each
// row also carries a pair of inline CSS variables for the picker tile
// preview swatches (base + primary) so the panel previews each theme
// without requiring duplicate JS state. Order matters: `auto` first
// so it's the obvious default.
//
//   (slug, label, preview-base, preview-primary)
const THEMES: &[(&str, &str, &str, &str)] = &[
    ("auto",       "Auto",       "var(--surface-1)",       "var(--brand)"),
    ("light",      "Light",      "oklch(99% 0.003 270)",   "oklch(52% 0.22 270)"),
    ("dark",       "Dark",       "oklch(22% 0.012 270)",   "oklch(70% 0.20 270)"),
    ("catppuccin", "Catppuccin", "oklch(96% 0.013 280)",   "oklch(63% 0.18 15)"),
    ("synthwave",  "Synthwave",  "oklch(18% 0.04 290)",    "oklch(72% 0.25 340)"),
    ("cyberpunk",  "Cyberpunk",  "oklch(91% 0.22 92)",     "oklch(65% 0.30 0)"),
    ("forest",     "Forest",     "oklch(18% 0.03 155)",    "oklch(60% 0.16 155)"),
    ("lofi",       "Lofi",       "oklch(98% 0.002 70)",    "oklch(15% 0.003 70)"),
    ("dracula",    "Dracula",    "oklch(28% 0.018 280)",   "oklch(72% 0.13 290)"),
    ("luxury",     "Luxury",     "oklch(8% 0.005 50)",     "oklch(75% 0.13 75)"),
];

// Brutalist theme picker. Trigger lives in the bottom-left next to the
// scavenger hunt chip; clicking opens a popover panel of theme tiles.
// Selection persists via js/theme-toggle.js (localStorage key
// `engmanager.theme`) and syncs across open tabs on the storage event.
pub fn render_theme_picker() -> HtmlFragment {
    let tiles: HtmlFragment = THEMES
        .iter()
        .map(|(slug, label, base, primary)| {
            let style = format!(
                "--preview-base: {base}; --preview-primary: {primary};"
            );
            view! {
                <button class="theme-tile"
                        type="button"
                        data-theme={ *slug }
                        style={ style }
                        aria-pressed="false">
                    <span class="theme-tile-swatch" aria-hidden="true"></span>
                    <span class="theme-tile-name">{ *label }</span>
                </button>
            }
        })
        .collect();

    view! {
        <div class="theme-picker">
            <button class="theme-picker-trigger"
                    type="button"
                    popovertarget="theme-picker-panel"
                    aria-label="Pick a theme">
                <span class="theme-picker-glyph" aria-hidden="true">"◐"</span>
                <span class="theme-picker-label">"Theme"</span>
            </button>
            <div id="theme-picker-panel"
                 popover="auto"
                 class="theme-picker-panel">
                <div class="theme-picker-grid">
                    { tiles }
                </div>
            </div>
        </div>
    }
}
