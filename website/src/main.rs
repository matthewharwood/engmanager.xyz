use std::env::var;
use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, HeaderName, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use rust_embed::{EmbeddedFile, RustEmbed};
use tokio::net::TcpListener;
use tower_http::compression::CompressionLayer;

pub mod comments;
pub mod discord;
pub mod experiences;
mod pages;
pub mod search;
mod sitemap;
mod stripe;

// Discord invite code for the Auteurs server. Hardcoded because it's the
// only server the site embeds; the refresh task resolves the guild ID
// from this code at startup.
const AUTEURS_INVITE_CODE: &str = "sTzQBrbnBM";

const PORT_ENV_VAR: &str = "PORT";
const DEFAULT_PORT: u16 = 3000;
const PRODUCTION_HOST: [u8; 4] = [0, 0, 0, 0];
const DEV_HOST: [u8; 4] = [127, 0, 0, 1];
const SHOP_HOSTS: &[&str] = &[
    "shop.engmanager.xyz",
    "store.engmanager.xyz",
    "shop.localhost",
    "store.localhost",
];

// Embed all static assets into the binary at compile time. Render (and most
// platform-as-a-service runtimes) don't reliably preserve the source tree at
// runtime, so a ServeDir pointing at `website/assets/` 404s in production.
// Embedding makes the binary self-contained and CWD-independent.
#[derive(RustEmbed)]
#[folder = "assets/"]
pub struct Assets;

// Minified CSS chunks emitted by build.rs (via lightningcss) into
// $OUT_DIR/css-dist/{critical,homepage,articles}.css. Served at
// /assets/css/{name}.{hash}.css through the same handler.
#[derive(RustEmbed)]
#[folder = "$OUT_DIR/css-dist/"]
pub struct CssDist;

// Minified JS bundles emitted by build.rs (via oxc_minifier) into
// $OUT_DIR/js-dist/{name}.js. Served at /assets/js/{name}.{hash}.js.
#[derive(RustEmbed)]
#[folder = "$OUT_DIR/js-dist/"]
pub struct JsDist;

#[derive(Clone)]
pub struct AppState {
    pub search: Arc<search::SearchEngine>,
    pub comments: Arc<comments::CommentStore>,
    pub stripe: Arc<stripe::Checkout>,
}

// Three-tier lookup: `css/` paths come from the lightningcss-built
// chunks, `js/` paths from the oxc-built bundles, everything else from
// the static `assets/` tree (fonts, images, etc.).
fn lookup_asset(path: &str) -> Option<EmbeddedFile> {
    if let Some(name) = path.strip_prefix("css/") {
        if let Some(file) = CssDist::get(name) {
            return Some(file);
        }
    }
    if let Some(name) = path.strip_prefix("js/") {
        if let Some(file) = JsDist::get(name) {
            return Some(file);
        }
    }
    Assets::get(path)
}

// Length of the hex hash segment baked into asset URLs. 8 hex chars = 4 bytes
// of sha256 = ~4 billion buckets, plenty to make collisions across deploys
// effectively impossible while keeping URLs short.
const ASSET_HASH_LEN: usize = 8;

// Content-addressed URL for an embedded asset. `asset_url("styles.css")`
// returns something like `/assets/styles.a1b2c3d4.css`. Because the URL
// changes whenever the file's bytes change, browsers and edge caches can
// hold the response with `immutable; max-age=1y` without ever serving stale
// CSS after a deploy — the new HTML simply references a new URL.
//
// Falls back to the flat `/assets/{path}` URL if the asset isn't embedded
// or doesn't have an extension, so the request still 404s predictably
// rather than silently rewriting to something else.
pub fn asset_url(path: &str) -> String {
    let Some(file) = lookup_asset(path) else {
        return format!("/assets/{path}");
    };
    let Some((stem, ext)) = path.rsplit_once('.') else {
        return format!("/assets/{path}");
    };
    let hash = file.metadata.sha256_hash();
    let short = hash_hex(&hash[..ASSET_HASH_LEN / 2]);
    format!("/assets/{stem}.{short}.{ext}")
}

fn hash_hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        let _ = write!(out, "{b:02x}");
    }
    out
}

// Reverse of asset_url: given `scripts/fit-text.a1b2c3d4.js` returns
// `scripts/fit-text.js`. Returns None when the filename has no recognizable
// hash segment, in which case the handler falls back to looking up the path
// as-is (e.g. CSS-referenced fonts, Markdown-embedded images).
//
// Doesn't validate that the hash matches the file's actual hash. If a client
// requests an old hash with current content, we serve the current content
// (the URL is just a cache key, not a content integrity check), and the
// next HTML refresh hands them the up-to-date URL anyway.
fn strip_asset_hash(path: &str) -> Option<String> {
    let slash = path.rfind('/').map_or(0, |i| i + 1);
    let (dir, file) = path.split_at(slash);

    let last_dot = file.rfind('.')?;
    let (stem_plus_hash, ext_with_dot) = file.split_at(last_dot);
    let prev_dot = stem_plus_hash.rfind('.')?;
    let (stem, hash_with_dot) = stem_plus_hash.split_at(prev_dot);
    let hash = &hash_with_dot[1..];

    if hash.len() == ASSET_HASH_LEN && hash.bytes().all(|b| b.is_ascii_hexdigit()) {
        Some(format!("{dir}{stem}{ext_with_dot}"))
    } else {
        None
    }
}

// Serves the Service Worker at its canonical root path with the
// `Service-Worker-Allowed: /` header so it can claim the whole origin.
// SW source lives inside the OXC-minified JsDist bundle alongside the
// other scripts, but we expose it here at /sw.js (not under /assets/)
// so the registration call can stay url-stable across deploys.
async fn sw_handler() -> Response {
    match JsDist::get("sw.js") {
        Some(file) => (
            [
                (header::CONTENT_TYPE, "application/javascript".to_string()),
                (header::CACHE_CONTROL, "no-cache, max-age=0".to_string()),
                (
                    HeaderName::from_static("service-worker-allowed"),
                    "/".to_string(),
                ),
            ],
            file.data.into_owned(),
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn offline_handler() -> Response {
    (
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8".to_string()),
            (
                header::CACHE_CONTROL,
                "public, max-age=3600, stale-while-revalidate=86400".to_string(),
            ),
        ],
        OFFLINE_HTML,
    )
        .into_response()
}

async fn asset_handler(Path(path): Path<String>) -> Response {
    // Try the hashed form first (rewriting `styles.HASH.css` → `styles.css`);
    // fall back to the literal path so flat URLs (fonts in CSS, Markdown
    // images) keep resolving.
    let file = strip_asset_hash(&path)
        .and_then(|stripped| lookup_asset(&stripped))
        .or_else(|| lookup_asset(&path));

    match file {
        Some(file) => {
            let mime = file.metadata.mimetype();
            // Assets are embedded into the binary, so their contents only
            // change on deploy. Cache them aggressively at the edge and in
            // the browser. `immutable` tells the browser to skip revalidation.
            // Safe under hashed URLs because the URL itself changes whenever
            // the bytes change.
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

async fn favicon_handler() -> Response {
    match lookup_asset("favicon.svg") {
        Some(file) => (
            [
                (header::CONTENT_TYPE, "image/svg+xml".to_string()),
                (header::CACHE_CONTROL, "public, max-age=3600".to_string()),
            ],
            file.data.into_owned(),
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

// First-party real-user monitoring sink. The browser sends small Core Web
// Vitals / navigation diagnostics with sendBeacon or keepalive fetch. We do
// not persist yet; accepting the payload gives the client a stable endpoint
// and keeps the path free of third-party analytics.
async fn rum_handler(body: Bytes) -> Response {
    if body.len() > 16 * 1024 {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    StatusCode::NO_CONTENT.into_response()
}

// Cache-Control for HTML responses.
//   max-age=60       → browser caches 1 min (so reload is snappy but fresh-ish)
//   s-maxage=3600    → Cloudflare caches at edge for 1 hour
//   stale-while-revalidate=86400 → CF can serve a day-old cached copy while
//                                  re-fetching in the background
// Cloudflare still needs a Cache Rule to opt HTML into edge caching, but
// once enabled it will honor these s-maxage / SWR directives.
const HTML_CACHE_CONTROL: &str = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

const OFFLINE_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Offline - engmanager.xyz</title>
<style>
html{font-family:system-ui,sans-serif;background:#eff1f5;color:#11111b}
body{min-height:100svh;margin:0;display:grid;place-items:center;padding:2rem}
main{max-width:34rem;border:2px solid currentColor;box-shadow:8px 8px 0 currentColor;padding:1.25rem;background:#fff}
h1{margin:0 0 .75rem;font-size:clamp(2rem,8vw,4rem);line-height:.9;text-transform:uppercase}
p{font-size:1rem;line-height:1.5}
a{color:#4c4fdd;font-weight:800}
</style>
</head>
<body>
<main>
<h1>Offline</h1>
<p>This page is not in the local cache yet. Reconnect and try again, or go back to a page you have already opened.</p>
<p><a href="/">Back home</a></p>
</main>
</body>
</html>"#;

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

async fn root_handler(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let host = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();

    if is_shop_host(host) {
        pages::shop::index(State(state)).await
    } else {
        pages::homepage::index().await.into_response()
    }
}

pub(crate) fn is_shop_host(host: &str) -> bool {
    let host_without_port = host.split(':').next().unwrap_or(host);
    SHOP_HOSTS
        .iter()
        .any(|shop_host| host_without_port.eq_ignore_ascii_case(shop_host))
}

async fn fallback_handler(State(state): State<AppState>, headers: HeaderMap, uri: Uri) -> Response {
    let host = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();

    if is_shop_host(host) && pages::shop::supports_path(uri.path()) {
        pages::shop::index(State(state)).await
    } else {
        pages::not_found::handler().await
    }
}

async fn security_headers_layer(
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers.insert(
        HeaderName::from_static("x-content-type-options"),
        axum::http::HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        HeaderName::from_static("referrer-policy"),
        axum::http::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        HeaderName::from_static("x-frame-options"),
        axum::http::HeaderValue::from_static("DENY"),
    );
    headers.insert(
        HeaderName::from_static("cross-origin-opener-policy"),
        axum::http::HeaderValue::from_static("same-origin-allow-popups"),
    );
    headers.insert(
        HeaderName::from_static("permissions-policy"),
        axum::http::HeaderValue::from_static(
            "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(self \"https://js.stripe.com\"), usb=(), xr-spatial-tracking=()",
        ),
    );
    headers.insert(
        HeaderName::from_static("content-security-policy-report-only"),
        axum::http::HeaderValue::from_static(
            "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://js.stripe.com; style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; media-src 'self'; worker-src 'self'; manifest-src 'self'; upgrade-insecure-requests",
        ),
    );
    response
}

#[tokio::main]
async fn main() {
    // Load local dev env from `.env.local` (preferred) then `.env`, before any
    // `env::var` read below (the comment store reads COMMENTS_DB_*; Stripe code
    // reads STRIPE_*). In production (Render) these files don't exist, so this
    // is a no-op and real dashboard env vars are used. dotenvy never overrides
    // variables already present in the environment, so exported vars always win.
    let _ = dotenvy::from_filename(".env.local");
    let _ = dotenvy::dotenv();

    // Subcommand: `website stripe-sync …` upserts the shop catalog into Stripe
    // and exits, instead of starting the server. Kept in-process so it reads
    // the same SHOP_PRODUCTS source of truth.
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("stripe-sync") {
        if let Err(err) = stripe::run(stripe::SyncOptions::from_args(&args)).await {
            eprintln!("stripe-sync failed: {err:#}");
            std::process::exit(1);
        }
        return;
    }

    // Debug-only: panic at startup if any article slice carries duplicate
    // tags. Release builds skip this since `unique_tags` dedups at render
    // time anyway; this is just a faster signal for the author.
    #[cfg(debug_assertions)]
    pages::articles::debug_check_tag_uniqueness();

    // Polls the Discord widget + invite endpoints for the Auteurs server
    // every 60s into an in-memory snapshot. Handlers read the snapshot
    // synchronously with a tokio RwLock — zero I/O on the hot path.
    tokio::spawn(discord::refresh_loop(AUTEURS_INVITE_CODE));

    let comments = Arc::new(
        comments::CommentStore::connect_from_env()
            .await
            .expect("comment store must connect at startup"),
    );
    let existing_comments = comments
        .all_visible()
        .await
        .expect("visible comments must load at startup");
    let search = Arc::new(
        search::SearchEngine::build_in_memory(pages::articles::ARTICLES, &existing_comments)
            .expect("search index must build at startup"),
    );
    // Stripe runtime context for the on-site checkout (reused client + keys).
    // Built from env; absent keys just leave checkout reporting "unavailable".
    let stripe = Arc::new(stripe::Checkout::from_env());
    let state = AppState {
        search,
        comments,
        stripe,
    };

    let app = Router::new()
        .route("/", get(root_handler))
        .route("/articles/", get(pages::articles::index))
        .route("/articles/{slug}", get(pages::articles::detail))
        .route("/search", get(pages::search::page))
        .route("/api/search/typeahead", get(pages::search::typeahead))
        .route(
            "/api/articles/{slug}/comments",
            get(pages::comments::list).post(pages::comments::create),
        )
        .route("/checkout", get(pages::checkout::page))
        .route("/checkout/success", get(pages::checkout::success))
        .route("/api/checkout/intent", post(pages::checkout::create_intent))
        .route("/api/stripe/webhook", post(pages::checkout::webhook))
        .route("/sitemap.xml", get(sitemap::sitemap_handler))
        .route("/sitemaps.xml", get(sitemap::sitemap_handler))
        .route("/robots.txt", get(sitemap::robots_handler))
        .route("/health", get(|| async { "OK" }))
        .route("/favicon.ico", get(favicon_handler))
        .route("/__rum", post(rum_handler))
        .route("/offline.html", get(offline_handler))
        .route("/sw.js", get(sw_handler))
        .route("/assets/{*path}", get(asset_handler))
        .fallback(fallback_handler)
        .with_state(state)
        .layer(axum::middleware::from_fn(security_headers_layer))
        .layer(axum::middleware::from_fn(html_cache_layer))
        // Brotli + gzip over the wire for any compressible response
        // (text/css, text/html, application/javascript, etc.). Vary
        // header is added automatically so caches key on encoding.
        .layer(CompressionLayer::new());

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

#[cfg(test)]
mod tests {
    use super::is_shop_host;

    #[test]
    fn shop_host_detection_accepts_production_and_local_hosts() {
        assert!(is_shop_host("shop.engmanager.xyz"));
        assert!(is_shop_host("shop.engmanager.xyz:443"));
        assert!(is_shop_host("SHOP.ENGMANAGER.XYZ"));
        assert!(is_shop_host("store.engmanager.xyz"));
        assert!(is_shop_host("STORE.ENGMANAGER.XYZ:443"));
        assert!(is_shop_host("shop.localhost:3000"));
        assert!(is_shop_host("store.localhost:3000"));
        assert!(!is_shop_host("engmanager.xyz"));
        assert!(!is_shop_host("www.engmanager.xyz"));
    }
}
