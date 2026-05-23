use axum::response::Html;
use eng_domain::{Component, HtmlFragment};
use eng_markup::{html, view};

use std::collections::BTreeSet;
use std::fmt::Write;

use super::articles::{Category, Tag, public_articles};
use super::{
    AVATAR_SRC, GOOGLE_FONTS_HREF, OPEN_PROPS_HREF, avatar_srcset, render_dev_meta,
    render_discovery_toasts, render_quick_actions, render_resource_hints, render_sfx_urls,
    render_sitemap_link,
};
use crate::asset_url;

// Serializes the article roster as a JSON island for the gacha
// reveal card to read on click. JS reads this once on load and
// looks up entries by slug. Hand-encoded to avoid pulling a serde
// dependency through pages — the data is small + we control every
// field, so escape() is sufficient.
fn articles_data_json() -> String {
    let mut out = String::from("{");
    let mut first = true;
    for a in public_articles() {
        if !first {
            out.push(',');
        }
        first = false;
        let title = a.title_alias.unwrap_or(a.title);
        let mut tags = String::from("[");
        for (j, t) in a.tags.iter().enumerate() {
            if j > 0 {
                tags.push(',');
            }
            let _ = write!(
                tags,
                "{{\"label\":\"{}\",\"emoji\":\"{}\"}}",
                json_escape(t.label()),
                json_escape(t.emoji()),
            );
        }
        tags.push(']');
        let date = a.date.label();
        let _ = write!(
            out,
            "\"{slug}\":{{\"title\":\"{title}\",\"summary\":\"{summary}\",\"date\":\"{date}\",\"category\":{{\"label\":\"{cat_label}\",\"emoji\":\"{cat_emoji}\",\"slug\":\"{cat_slug}\"}},\"tags\":{tags},\"href\":\"/articles/{slug}\"}}",
            slug = json_escape(a.slug),
            title = json_escape(title),
            summary = json_escape(a.summary),
            date = json_escape(&date),
            cat_label = json_escape(a.category.label()),
            cat_emoji = json_escape(a.category.emoji()),
            cat_slug = json_escape(a.category.slug()),
            tags = tags,
        );
    }
    out.push('}');
    out
}

fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '<' => out.push_str("\\u003c"),
            '>' => out.push_str("\\u003e"),
            '&' => out.push_str("\\u0026"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out
}

// Gacha-style reveal card. Hidden popover that the click handler
// in js/visited-articles.js fills with the clicked article's data
// and opens with a spring-overshoot entrance. Continue button
// drives navigation; Close dismisses + keeps the reader on the
// homepage with the visited state intact.
fn render_reveal_card() -> HtmlFragment {
    view! {
        <aside id="article-reveal" popover="manual" class="reveal-card">
            <div class="reveal-card-frame">
                <div class="reveal-card-glint" aria-hidden="true"></div>
                <header class="reveal-card-head">
                    <span class="reveal-card-emoji" data-reveal-emoji aria-hidden="true">"⌬"</span>
                    <span class="reveal-card-category" data-reveal-category>"…"</span>
                    <button class="reveal-card-close"
                            type="button"
                            popovertarget="article-reveal"
                            popovertargetaction="hide"
                            aria-label="Close">
                        "✕"
                    </button>
                </header>
                <h2 class="reveal-card-title" data-reveal-title>"…"</h2>
                <time class="reveal-card-date" data-reveal-date>"…"</time>
                <p class="reveal-card-summary" data-reveal-summary>"…"</p>
                <div class="reveal-card-tags" data-reveal-tags></div>
                <footer class="reveal-card-actions">
                    <button class="reveal-card-dismiss"
                            type="button"
                            popovertarget="article-reveal"
                            popovertargetaction="hide">
                        "Nahhh"
                    </button>
                    <a class="reveal-card-continue" data-reveal-continue href="#">
                        "Read →"
                    </a>
                </footer>
            </div>
        </aside>
    }
}

// Twin brutalist marquees that loop seamlessly above the article
// stack. Categories scroll left-to-right; tags scroll the opposite
// direction. Each row's chip group is rendered four times back-to-
// back, so the CSS animation can move the track by -25% in a linear
// loop and the visual continuity is unbroken at any practical
// viewport width. Pure decoration — no clicks, no filtering, no JS.
fn render_topic_marquees() -> HtmlFragment {
    let category_group: HtmlFragment = Category::ALL
        .iter()
        .map(|c| {
            view! {
                <span class="chip chip-category"
                      data-chip-id={ format!("cat-{}", c.slug()) }>
                    <span class="chip-emoji" aria-hidden="true">{ c.emoji() }</span>
                    <span class="chip-label">{ c.label() }</span>
                </span>
            }
        })
        .collect();

    let mut unique_tags: BTreeSet<Tag> = BTreeSet::new();
    for article in public_articles() {
        for tag in article.tags {
            unique_tags.insert(*tag);
        }
    }
    let tag_group: HtmlFragment = unique_tags
        .into_iter()
        .map(|t| {
            view! {
                <span class="chip chip-tag"
                      data-chip-id={ format!("tag-{}", t.label()) }>
                    <span class="chip-emoji" aria-hidden="true">{ t.emoji() }</span>
                    <span class="chip-label">{ t.label() }</span>
                </span>
            }
        })
        .collect();

    let category_track = marquee_track(&category_group, "marquee-track-forward");
    let tag_track = marquee_track(&tag_group, "marquee-track-reverse");

    view! {
        <aside class="marquee-bar" aria-label="Article topics">
            <div class="marquee">{ category_track }</div>
            <div class="marquee">{ tag_track }</div>
        </aside>
    }
}

// Renders a marquee track containing four back-to-back copies of the
// given chip group. The first copy is the canonical (a11y-visible)
// one; copies 2-4 are aria-hidden so screen readers don't repeat the
// list. Four copies = 4× total width, with a -25% loop translate; even
// at 4K viewports the visible band is fully covered through the loop.
fn marquee_track(group: &HtmlFragment, direction_class: &str) -> HtmlFragment {
    let track_class = format!("marquee-track {direction_class}");
    view! {
        <div class={ track_class }>
            <div class="marquee-group">{ group.clone() }</div>
            <div class="marquee-group" aria-hidden="true">{ group.clone() }</div>
            <div class="marquee-group" aria-hidden="true">{ group.clone() }</div>
            <div class="marquee-group" aria-hidden="true">{ group.clone() }</div>
        </div>
    }
}

pub struct EngHeadline;
pub struct EngHeadlineProps;

impl Component for EngHeadline {
    type Props = EngHeadlineProps;

    fn render(_: Self::Props, _: HtmlFragment) -> HtmlFragment {
        view! {
            <div id="main" class="fluid-display-wrap" tabindex="-1">
                <h1 class="fluid-display">
                    <svg class="fluid-display-svg"
                         viewBox="0 0 1200 200"
                         preserveAspectRatio="xMidYMid meet"
                         role="img"
                         aria-label="ENG MANAGER">
                        <text x="0"
                              y="160"
                              font-family="Monument Extended, sans-serif"
                              font-weight="900"
                              font-size="144"
                              fill="currentColor">
                            "ENG MANAGER"
                        </text>
                    </svg>
                </h1>
            </div>
        }
    }
}

pub struct EngResume;
pub struct EngResumeProps;

impl Component for EngResume {
    type Props = EngResumeProps;

    fn render(_: Self::Props, _: HtmlFragment) -> HtmlFragment {
        view! {
            <section class="resume" aria-label="About Matthew Harwood">
                <div class="resume-line resume-heading">"MATTHEW HARWOOD"</div>
                <div class="resume-line resume-sep">"~~~"</div>
                <div class="resume-line">"CONTACT: matthewcharwood (LINKEDIN)"</div>
                <div class="resume-line">"LOCATION: USA"</div>
                <div class="resume-line">
                    "STATUS: "
                    <span class="status-online">
                        "ONLINE"
                        <span class="status-pip" aria-hidden="true"></span>
                    </span>
                </div>
                <div class="resume-line">"FOCUS:"</div>
                <div class="resume-line">
                    "  - [Engineering Manager]("
                    <a class="resume-link" href="https://www.linkedin.com/in/matthewcharwood">
                        "https://www.linkedin.com/in/matthewcharwood"
                    </a>
                    ")"
                </div>
                <div class="resume-line">"  - [Frontend Platform / Design Systems / Tooling]"</div>
                <div class="resume-line resume-sep">"~~~"</div>
                <div class="resume-line">"PROJECTS:"</div>
                <div class="resume-line">
                    "  - [engmanager.xyz]("
                    <a class="resume-link" href="https://engmanager.xyz">
                        "https://engmanager.xyz"
                    </a>
                    ")"
                </div>
                <div class="resume-line">
                    "  - [github/matthewharwood]("
                    <a class="resume-link" href="https://github.com/matthewharwood">
                        "https://github.com/matthewharwood"
                    </a>
                    ")"
                </div>
                <div class="resume-line">
                    "  - [linkedin/matthewcharwood]("
                    <a class="resume-link" href="https://www.linkedin.com/in/matthewcharwood">
                        "https://www.linkedin.com/in/matthewcharwood"
                    </a>
                    ")"
                </div>
                <div class="resume-line">
                    "  - [articles]("
                    <a class="resume-link" href="/articles/">"/articles/"</a>
                    ")"
                </div>
            </section>
        }
    }
}

pub async fn index() -> Html<String> {
    // Each article rendered as its own fluid SVG title, Archivo Black, linked
    // to the article detail page. Stacked under <EngHeadline />. Titles auto-fit
    // their container width via assets/scripts/fit-text.js.
    let article_links: HtmlFragment = public_articles()
        .map(|a| {
            let tag_attr = a
                .tags
                .iter()
                .map(|t| t.label())
                .collect::<Vec<_>>()
                .join(" ");
            view! {
                <a class="article-fluid-link"
                   href={ format!("/articles/{}", a.slug) }
                   style={ format!("view-transition-name: article-{}", a.slug) }
                   data-slug={ a.slug }
                   data-category={ a.category.slug() }
                   data-tags={ tag_attr }>
                    // Brutalist read-state checkbox. Persisted in
                    // localStorage by js/visited-articles.js; first
                    // click adds the slug to the visited set and the
                    // checkmark + title strike-through fade in.
                    <span class="article-check" aria-hidden="true">
                        <svg class="article-check-mark" viewBox="0 0 16 16">
                            <path d="M2.5 8.5 L6.5 12.5 L13.5 3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="3"
                                  stroke-linecap="round"
                                  stroke-linejoin="round" />
                        </svg>
                        <svg class="article-trash-mark"
                             viewBox="0 0 24 24"
                             fill="none"
                             stroke="currentColor"
                             stroke-width="2.4"
                             stroke-linecap="round"
                             stroke-linejoin="round">
                            <path d="M4 7 L20 7" />
                            <path d="M9 7 L9 4.5 L15 4.5 L15 7" />
                            <path d="M6 7 L7 20 L17 20 L18 7" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                    </span>
                    <div class="fluid-display-wrap">
                        <svg class="fluid-display-svg article-fluid-svg"
                             viewBox="0 0 1200 200"
                             preserveAspectRatio="xMidYMid meet"
                             role="img"
                             aria-label={ a.title }>
                            <text x="0"
                                  y="160"
                                  font-family="Archivo, sans-serif"
                                  font-weight="900"
                                  font-size="144"
                                  fill="currentColor">
                                { a.title.to_uppercase() }
                            </text>
                        </svg>
                        // Fallback rendered as HTML text when the SVG would
                        // shrink below 16px. fit-text.js toggles .is-too-small
                        // on the SVG; CSS swaps the visible element.
                        <span class="article-fluid-fallback" aria-hidden="true">
                            { a.title.to_uppercase() }
                        </span>
                        // Strike-through bar — scaleX 0 → 1 when the
                        // parent link gets `.is-visited`.
                        <span class="article-strike" aria-hidden="true"></span>
                    </div>
                </a>
            }
        })
        .collect();

    let page = html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>"ENG MANAGER"</title>
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                { render_sitemap_link() }
                { render_resource_hints() }
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/homepage.css") } />
                <script src={ asset_url("js/theme-toggle.js") }></script>
                { render_sfx_urls() }
                <script src={ asset_url("js/audio.js") } defer></script>
                <script src={ asset_url("js/search.js") } defer></script>
                <script src={ asset_url("js/search-keyclick.js") } defer></script>
                <script src={ asset_url("js/fit-text.js") } defer></script>
                <script src={ asset_url("js/big-cursor.js") } defer></script>
                <script src={ asset_url("js/keyboard-nav.js") } defer></script>
                <script src={ asset_url("js/view-transitions.js") } defer></script>
                <script src={ asset_url("js/visited-articles.js") } defer></script>
                <script src={ asset_url("js/trash-drag.js") } defer></script>
                <script src={ asset_url("js/quick-actions.js") } defer></script>
                <script>{ HtmlFragment::new(format!(
                    "window.__engUrls={{paintHatch:\"{}\",cryptoWorker:\"{}\"}};",
                    asset_url("js/paint-brutalist-hatch.js"),
                    asset_url("js/worker-crypto.js"),
                )) }</script>
                <script src={ asset_url("js/experiences.js") } defer></script>
                <link rel="manifest" href={ asset_url("manifest.webmanifest") } />
                <meta name="theme-color" content="#e64553" />
                { render_dev_meta() }
            </head>
            <body class="homepage">
                <a class="skip-link" href="#main">"Skip to content"</a>
                <div class="dvd-bouncer" data-dvd-bouncer aria-hidden="true">
                    <svg class="dvd-bouncer-mark"
                         viewBox="0 0 160 72"
                         focusable="false"
                         aria-hidden="true">
                        <rect class="dvd-bouncer-plate"
                              x="3"
                              y="3"
                              width="154"
                              height="66"
                              rx="6" />
                        <text x="80"
                              y="42"
                              text-anchor="middle"
                              font-family="Arial Black, Archivo, sans-serif"
                              font-size="34"
                              font-weight="900"
                              letter-spacing="2">
                            "DVD"
                        </text>
                        <path d="M34 52 C52 62, 108 62, 126 52" />
                    </svg>
                </div>
                <EngHeadline />
                { render_topic_marquees() }
                // Fixed-bottom floating search. Real submit button on the
                // right (the circle) so the rightmost tap target is
                // functional, not just decoration. Typeahead is wired up
                // by js/search.js through the [data-search-form] +
                // [data-search-results] hooks.
                <form class="home-search"
                      action="/search"
                      method="get"
                      role="search"
                      data-search-form>
                    <label class="sr-only" for="site-search-input">
                        "Search articles and comments"
                    </label>
                    <input class="home-search-input"
                           id="site-search-input"
                           type="search"
                           name="q"
                           autocomplete="off"
                           role="combobox"
                           aria-expanded="false"
                           aria-controls="site-search-results"
                           aria-autocomplete="list"
                           placeholder="e.g. rust, voice, ai" />
                    <ul class="site-search-results home-search-results"
                        id="site-search-results"
                        role="listbox"
                        hidden
                        data-search-results></ul>
                    <button class="home-search-submit" type="submit" aria-label="Search">
                        <span aria-hidden="true">"🔍"</span>
                    </button>
                </form>
                { article_links }

                // Avatar is a popover trigger via the native HTML Popover API.
                // Clicking toggles the #bio popover.
                <button class="avatar-button" type="button" popovertarget="bio" aria-label="Open bio">
                    <img class="avatar"
                         src=AVATAR_SRC
                         srcset={ avatar_srcset(&[48, 96, 144]) }
                         sizes="48px"
                         alt="Matthew Harwood"
                         width="48"
                         height="48"
                         loading="eager"
                         decoding="async" />
                </button>

                // Trash can. Reader can grab any chip from the marquees and
                // drag it here; on drop inside the dashed blast radius the
                // chip is consumed (hidden across every marquee copy), the
                // counter ticks up, and the ElevenLabs-generated trash-drop
                // SFX plays. Misses fly back. js/trash-drag.js owns the
                // pointer DnD logic.
                <div class="trash" data-trash>
                    <button class="trash-can" type="button" aria-label="Trash" tabindex="-1">
                        <svg class="trash-icon"
                             viewBox="0 0 24 24"
                             fill="none"
                             stroke="currentColor"
                             stroke-width="2.2"
                             stroke-linecap="round"
                             stroke-linejoin="round"
                             aria-hidden="true">
                            <path d="M4 7 L20 7" />
                            <path d="M9 7 L9 4.5 L15 4.5 L15 7" />
                            <path d="M5.5 7 L6.5 19.5 A1 1 0 0 0 7.5 20.5 L16.5 20.5 A1 1 0 0 0 17.5 19.5 L18.5 7" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <span class="trash-count" data-trash-count="0">"0"</span>
                    </button>
                    <span class="trash-blast" aria-hidden="true"></span>
                </div>

                // Resume bio. Anchored so its bottom-right corner touches the
                // avatar's top-left corner (math in styles.css → #bio).
                <div id="bio" popover="auto">
                    <EngResume />
                </div>

                // JSON island + gacha-style reveal card. The card is
                // populated + opened by js/visited-articles.js when a
                // reader clicks an unread article in the stack.
                <script type="application/json" id="articles-data">
                    { HtmlFragment::new(articles_data_json()) }
                </script>
                { render_reveal_card() }

                { render_quick_actions() }
                { render_discovery_toasts() }

                // Brutalist Web API Receipt modal (Popover API). `?` from
                // anywhere on the site toggles it; experiences.js fills the
                // grid + stats from the registry. Opens when ?receipt is
                // in the URL on load, and toggling the modal pushes/pops
                // that query param so the state is deep-linkable.
                <aside id="api-receipt-modal" popover="manual" class="api-receipt">
                    <div class="api-receipt-frame">
                        <header class="api-receipt-head">
                            <span class="api-receipt-glyph" aria-hidden="true">"⌬"</span>
                            <h2 class="api-receipt-title">"Web API Receipt"</h2>
                            <div class="api-receipt-stats" data-api-receipt-stats></div>
                            <button class="api-receipt-close"
                                    type="button"
                                    popovertarget="api-receipt-modal"
                                    popovertargetaction="hide"
                                    aria-label="Close">
                                "✕"
                            </button>
                        </header>
                        <div class="api-receipt-grid" data-api-receipt-grid></div>
                        <footer class="api-receipt-foot">
                            <span>"Press "<kbd>"?"</kbd>" to toggle · "<kbd>"Esc"</kbd>" to close · share with "<kbd>"?receipt"</kbd></span>
                        </footer>
                    </div>
                </aside>
            </body>
        </html>
    };
    Html(page.into_string())
}
