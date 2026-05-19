use axum::response::Html;
use eng_domain::{Component, HtmlFragment};
use eng_markup::{html, view};

use std::collections::BTreeSet;

use super::articles::{ARTICLES, Category, Tag};
use super::{
    AVATAR_SRC, GOOGLE_FONTS_HREF, OPEN_PROPS_HREF,
    render_discovery_toasts, render_hunt_chip,
};
use crate::asset_url;

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
                <span class="chip chip-category">
                    <span class="chip-emoji" aria-hidden="true">{ c.emoji() }</span>
                    <span class="chip-label">{ c.label() }</span>
                </span>
            }
        })
        .collect();

    let mut unique_tags: BTreeSet<Tag> = BTreeSet::new();
    for article in ARTICLES {
        for tag in article.tags {
            unique_tags.insert(*tag);
        }
    }
    let tag_group: HtmlFragment = unique_tags
        .into_iter()
        .map(|t| {
            view! {
                <span class="chip chip-tag">
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
            <div class="fluid-display-wrap">
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
    let article_links: HtmlFragment = ARTICLES
        .iter()
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
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/homepage.css") } />
                <script src={ asset_url("js/fit-text.js") } defer></script>
                <script src={ asset_url("js/big-cursor.js") } defer></script>
                <script src={ asset_url("js/keyboard-nav.js") } defer></script>
                <script src={ asset_url("js/view-transitions.js") } defer></script>
                <script src={ asset_url("js/visited-articles.js") } defer></script>
                <script>{ HtmlFragment::new(format!(
                    "window.__engUrls={{paintHatch:\"{}\",cryptoWorker:\"{}\"}};",
                    asset_url("js/paint-brutalist-hatch.js"),
                    asset_url("js/worker-crypto.js"),
                )) }</script>
                <script src={ asset_url("js/experiences.js") } defer></script>
                <link rel="manifest" href={ asset_url("manifest.webmanifest") } />
                <meta name="theme-color" content="#e64553" />
            </head>
            <body class="homepage">
                <EngHeadline />
                { render_topic_marquees() }
                { article_links }

                // Avatar is a popover trigger via the native HTML Popover API.
                // Clicking toggles the #bio popover.
                <button class="avatar-button" type="button" popovertarget="bio" aria-label="Open bio">
                    <img class="avatar"
                         src=AVATAR_SRC
                         alt="Matthew Harwood"
                         height="48" />
                </button>

                // Resume bio. Anchored so its bottom-right corner touches the
                // avatar's top-left corner (math in styles.css → #bio).
                <div id="bio" popover="auto">
                    <EngResume />
                </div>

                { render_hunt_chip() }
                { render_discovery_toasts() }

                // Brutalist Web API Receipt modal (Popover API). `?` from
                // anywhere on the site toggles it; experiences.js fills the
                // grid + stats from the registry.
                <aside id="api-receipt-modal" popover="manual" class="api-receipt">
                    <div class="api-receipt-frame">
                        <header class="api-receipt-head">
                            <span class="api-receipt-glyph" aria-hidden="true">"⌬"</span>
                            <h2 class="api-receipt-title">"Web API Receipt"</h2>
                            <button class="api-receipt-close"
                                    type="button"
                                    popovertarget="api-receipt-modal"
                                    popovertargetaction="hide"
                                    aria-label="Close">
                                "✕"
                            </button>
                        </header>
                        <div class="api-receipt-stats" data-api-receipt-stats></div>
                        <div class="api-receipt-grid" data-api-receipt-grid></div>
                        <footer class="api-receipt-foot">
                            <span>"Press "<kbd>"?"</kbd>" to toggle · "<kbd>"Esc"</kbd>" to close"</span>
                        </footer>
                    </div>
                </aside>
            </body>
        </html>
    };
    Html(page.into_string())
}
