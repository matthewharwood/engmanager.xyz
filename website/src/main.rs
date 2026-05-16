use std::env::var;
use std::net::SocketAddr;

use axum::Router;
use axum::extract::Path;
use axum::http::{StatusCode, header};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::get;
use eng_domain::{Component, HtmlFragment};
use eng_markup::{html, view};
use rust_embed::RustEmbed;
use tokio::net::TcpListener;

const PORT_ENV_VAR: &str = "PORT";
const DEFAULT_PORT: u16 = 3000;
const PRODUCTION_HOST: [u8; 4] = [0, 0, 0, 0];
const DEV_HOST: [u8; 4] = [127, 0, 0, 1];

const OPEN_PROPS_HREF: &str = "https://unpkg.com/open-props@1.7.23/open-props.min.css";
const GOOGLE_FONTS_HREF: &str =
    "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap";

// Embed all static assets into the binary at compile time. Render (and most
// platform-as-a-service runtimes) don't reliably preserve the source tree at
// runtime, so a ServeDir pointing at `website/assets/` 404s in production.
// Embedding makes the binary self-contained and CWD-independent.
#[derive(RustEmbed)]
#[folder = "assets/"]
struct Assets;

async fn asset_handler(Path(path): Path<String>) -> Response {
    match Assets::get(&path) {
        Some(file) => {
            let mime = file.metadata.mimetype();
            (
                [(header::CONTENT_TYPE, mime.to_string())],
                file.data.into_owned(),
            )
                .into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

struct EngHeadline;
struct EngHeadlineProps;

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

struct EngResume;
struct EngResumeProps;

impl Component for EngResume {
    type Props = EngResumeProps;

    fn render(_: Self::Props, _: HtmlFragment) -> HtmlFragment {
        view! {
            <section class="resume" aria-label="About Matthew Harwood">
                <div class="resume-line resume-heading">"MATTHEW HARWOOD"</div>
                <div class="resume-line resume-sep">"~~~"</div>
                <div class="resume-line">"CONTACT: matthewcharwood (LINKEDIN)"</div>
                <div class="resume-line">"LOCATION: USA"</div>
                <div class="resume-line">"STATUS: ONLINE"</div>
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
            </section>
        }
    }
}

async fn index() -> Html<String> {
    let page = html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>"engmanager.xyz"</title>
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href="/assets/styles.css" />
                <script src="/assets/scripts/fit-text.js" defer></script>
            </head>
            <body>
                <EngHeadline />
                <EngResume />
            </body>
        </html>
    };
    Html(page.into_string())
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/health", get(|| async { "OK" }))
        .route("/favicon.ico", get(|| async { StatusCode::NO_CONTENT }))
        .route("/assets/{*path}", get(asset_handler));

    let addr = resolve_server_address();
    println!("Starting server on http://{addr}");

    let listener = TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("Failed to bind to {addr}: {e}"));

    axum::serve(listener, app)
        .await
        .unwrap_or_else(|e| panic!("Server error: {e}"));
}

fn resolve_server_address() -> SocketAddr {
    let port_env = var(PORT_ENV_VAR).ok();
    let port = port_env
        .as_deref()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT);
    let host = if port_env.is_some() {
        PRODUCTION_HOST
    } else {
        DEV_HOST
    };
    SocketAddr::from((host, port))
}
