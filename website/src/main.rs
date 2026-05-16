use std::env::var;
use std::net::SocketAddr;

use axum::Router;
use axum::response::Html;
use axum::routing::get;
use eng_domain::{Component, HtmlFragment};
use eng_markup::{html, view};
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

const PORT_ENV_VAR: &str = "PORT";
const DEFAULT_PORT: u16 = 3000;
const PRODUCTION_HOST: [u8; 4] = [0, 0, 0, 0];
const DEV_HOST: [u8; 4] = [127, 0, 0, 1];

const ASSETS_DIR: &str = "website/assets";

const OPEN_PROPS_HREF: &str = "https://unpkg.com/open-props@1.7.23/open-props.min.css";
const GOOGLE_FONTS_HREF: &str =
    "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap";

struct EngHeadline;
struct EngHeadlineProps;

impl Component for EngHeadline {
    type Props = EngHeadlineProps;

    fn render(_: Self::Props, _: HtmlFragment) -> HtmlFragment {
        view! {
            <div class="fluid-display-wrap">
                <h1 class="fluid-display">"ENG MANAGER"</h1>
            </div>
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
            </head>
            <body>
                <EngHeadline />
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
        .nest_service("/assets", ServeDir::new(ASSETS_DIR));

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
