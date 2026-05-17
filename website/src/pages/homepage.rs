use axum::response::Html;
use eng_domain::{Component, HtmlFragment};
use eng_markup::{html, view};

use super::articles::ARTICLES;
use super::{GOOGLE_FONTS_HREF, OPEN_PROPS_HREF};

const AVATAR_SRC: &str = "https://engmanager.xyz/cdn-cgi/imagedelivery/MdDtxXpLlqqwzPv4AklQiw/febf9573-0897-40b3-f687-a38a678b2300/public";

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
            view! {
                <a class="article-fluid-link" href={ format!("/articles/{}", a.slug) }>
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
                <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href="/assets/styles.css" />
                <script src="/assets/scripts/fit-text.js" defer></script>
            </head>
            <body>
                <EngHeadline />
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
            </body>
        </html>
    };
    Html(page.into_string())
}
