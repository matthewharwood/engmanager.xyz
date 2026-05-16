use std::env::var;
use std::net::SocketAddr;

use axum::Router;
use axum::extract::Path;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use rust_embed::RustEmbed;
use tokio::net::TcpListener;

mod pages;

const PORT_ENV_VAR: &str = "PORT";
const DEFAULT_PORT: u16 = 3000;
const PRODUCTION_HOST: [u8; 4] = [0, 0, 0, 0];
const DEV_HOST: [u8; 4] = [127, 0, 0, 1];

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

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(pages::homepage::index))
        .route("/articles/", get(pages::articles::index))
        .route("/articles/{slug}", get(pages::articles::detail))
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
