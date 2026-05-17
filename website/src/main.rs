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
            // Assets are embedded into the binary, so their contents only
            // change on deploy. Cache them aggressively at the edge and in
            // the browser. `immutable` tells the browser to skip revalidation.
            let cache_control = "public, max-age=31536000, immutable";
            (
                [
                    (header::CONTENT_TYPE, mime.to_string()),
                    (header::CACHE_CONTROL, cache_control.to_string()),
                ],
                file.data.into_owned(),
            )
                .into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

// Cache-Control for HTML responses.
//   max-age=60       → browser caches 1 min (so reload is snappy but fresh-ish)
//   s-maxage=3600    → Cloudflare caches at edge for 1 hour
//   stale-while-revalidate=86400 → CF can serve a day-old cached copy while
//                                  re-fetching in the background
// Cloudflare still needs a Cache Rule to opt HTML into edge caching, but
// once enabled it will honor these s-maxage / SWR directives.
const HTML_CACHE_CONTROL: &str =
    "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

async fn html_cache_layer(
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Response {
    let mut response = next.run(req).await;
    let is_html = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.starts_with("text/html"))
        .unwrap_or(false);
    if is_html && !response.headers().contains_key(header::CACHE_CONTROL) {
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            axum::http::HeaderValue::from_static(HTML_CACHE_CONTROL),
        );
    }
    response
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(pages::homepage::index))
        .route("/articles/", get(pages::articles::index))
        .route("/articles/{slug}", get(pages::articles::detail))
        .route("/health", get(|| async { "OK" }))
        .route("/favicon.ico", get(|| async { StatusCode::NO_CONTENT }))
        .route("/assets/{*path}", get(asset_handler))
        .layer(axum::middleware::from_fn(html_cache_layer));

    let addr = resolve_server_address();

    let listener = if let Some(std_listener) = take_listenfd_listener() {
        std_listener
            .set_nonblocking(true)
            .expect("set listener non-blocking");
        let local = std_listener.local_addr().ok();
        let listener = TcpListener::from_std(std_listener).expect("convert listenfd socket");
        println!(
            "Inherited listener from systemfd ({})",
            local.map(|a| a.to_string()).unwrap_or_else(|| "?".into())
        );
        listener
    } else {
        println!("Starting server on http://{addr}");
        TcpListener::bind(addr)
            .await
            .unwrap_or_else(|e| panic!("Failed to bind to {addr}: {e}"))
    };

    axum::serve(listener, app)
        .await
        .unwrap_or_else(|e| panic!("Server error: {e}"));
}

// Attempts to grab a listener handed down by `systemfd` via LISTEN_FDS. The
// `dev` feature is the only path that links the `listenfd` crate; production
// builds get the `None` stub at compile time, so no listenfd code ships.
#[cfg(feature = "dev")]
fn take_listenfd_listener() -> Option<std::net::TcpListener> {
    listenfd::ListenFd::from_env()
        .take_tcp_listener(0)
        .ok()
        .flatten()
}

#[cfg(not(feature = "dev"))]
fn take_listenfd_listener() -> Option<std::net::TcpListener> {
    None
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
