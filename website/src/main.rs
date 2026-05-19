use std::env::var;
use std::net::SocketAddr;

use axum::Router;
use axum::extract::Path;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use rust_embed::{EmbeddedFile, RustEmbed};
use tokio::net::TcpListener;
use tower_http::compression::CompressionLayer;

pub mod discord;
mod pages;

// Discord invite code for the Auteurs server. Hardcoded because it's the
// only server the site embeds; the refresh task resolves the guild ID
// from this code at startup.
const AUTEURS_INVITE_CODE: &str = "sTzQBrbnBM";

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
    // Debug-only: panic at startup if any article slice carries duplicate
    // tags. Release builds skip this since `unique_tags` dedups at render
    // time anyway; this is just a faster signal for the author.
    #[cfg(debug_assertions)]
    pages::articles::debug_check_tag_uniqueness();

    // Polls the Discord widget + invite endpoints for the Auteurs server
    // every 60s into an in-memory snapshot. Handlers read the snapshot
    // synchronously with a tokio RwLock — zero I/O on the hot path.
    tokio::spawn(discord::refresh_loop(AUTEURS_INVITE_CODE));

    let app = Router::new()
        .route("/", get(pages::homepage::index))
        .route("/articles/", get(pages::articles::index))
        .route("/articles/{slug}", get(pages::articles::detail))
        .route("/health", get(|| async { "OK" }))
        .route("/favicon.ico", get(|| async { StatusCode::NO_CONTENT }))
        .route("/assets/{*path}", get(asset_handler))
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
