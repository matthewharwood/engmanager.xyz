//! Embedded static assets: three-tier lookup, memoized content-addressed
//! URLs, and the asset-serving handlers (zero-copy in release builds).
//! (Patterns: rust-core-patterns const invariant guard; GRAYSON rule 17 —
//! avoid unnecessary allocation via `Bytes::from_static`.)

use std::borrow::Cow;
#[cfg(not(debug_assertions))]
use std::collections::HashMap;
#[cfg(not(debug_assertions))]
use std::sync::{LazyLock, PoisonError, RwLock};

use axum::body::{Body, Bytes};
use axum::extract::Path;
use axum::http::{HeaderName, StatusCode, header};
use axum::response::{IntoResponse, Response};
use rust_embed::{EmbeddedFile, RustEmbed};

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
    if let Some(name) = path.strip_prefix("css/")
        && let Some(file) = CssDist::get(name)
    {
        return Some(file);
    }
    if let Some(name) = path.strip_prefix("js/")
        && let Some(file) = JsDist::get(name)
    {
        return Some(file);
    }
    Assets::get(path)
}

// Length of the hex hash segment baked into asset URLs. 8 hex chars = 4 bytes
// of sha256 = ~4 billion buckets, plenty to make collisions across deploys
// effectively impossible while keeping URLs short.
const ASSET_HASH_LEN: usize = 8;

// asset_url slices the sha256 digest with `ASSET_HASH_LEN / 2` bytes; keep
// the length even so the byte slice and the rendered hex stay in lockstep.
const _: () = assert!(ASSET_HASH_LEN.is_multiple_of(2));

// Read-through memo for asset_url — RELEASE ONLY. Pages call asset_url for
// the same handful of static paths on every render; release embeds never
// change, so hashing once per path is pure win. Populated lazily per
// requested path (NOT an eager scan of the embed list: that would hash every
// mp3/woff2 at startup for files nothing requests). Debug builds compile
// this out (see asset_url) because rust-embed reads from DISK there: a memo
// would serve stale hashed URLs after an asset edit mid dev-session.
#[cfg(not(debug_assertions))]
static ASSET_URL_CACHE: LazyLock<RwLock<HashMap<String, String>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

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
    // Debug builds bypass the memo entirely (release-only-memo, the same
    // posture as the article render cache in pages/articles.rs): rust-embed
    // reads from disk per call there, so a memoized hash would pin the OLD
    // hashed URL after an asset edit mid dev-session. Release embeds are
    // immutable for the process lifetime, so memoizing is sound there.
    #[cfg(debug_assertions)]
    {
        compute_asset_url(path)
    }
    #[cfg(not(debug_assertions))]
    {
        if let Some(url) = ASSET_URL_CACHE
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .get(path)
        {
            return url.clone();
        }
        let url = compute_asset_url(path);
        ASSET_URL_CACHE
            .write()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(path.to_string(), url.clone());
        url
    }
}

fn compute_asset_url(path: &str) -> String {
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

// Zero-copy response body for an embedded file. Release builds embed the
// bytes in the binary, so rust-embed hands back `Cow::Borrowed(&'static
// [u8])` — wrap it in `Bytes::from_static` and the asset is served without
// ever copying it. Debug builds read from disk for live editing and yield
// `Cow::Owned`, which `Body::from(Vec<u8>)` takes by move.
fn embedded_body(data: Cow<'static, [u8]>) -> Body {
    match data {
        Cow::Borrowed(bytes) => Body::from(Bytes::from_static(bytes)),
        Cow::Owned(vec) => Body::from(vec),
    }
}

// Serves the Service Worker at its canonical root path with the
// `Service-Worker-Allowed: /` header so it can claim the whole origin.
// SW source lives inside the OXC-minified JsDist bundle alongside the
// other scripts, but we expose it here at /sw.js (not under /assets/)
// so the registration call can stay url-stable across deploys.
pub(crate) async fn sw_handler() -> Response {
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
            embedded_body(file.data),
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

pub(crate) async fn offline_handler() -> Response {
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

pub(crate) async fn asset_handler(Path(path): Path<String>) -> Response {
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
                embedded_body(file.data),
            )
                .into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

pub(crate) async fn favicon_handler() -> Response {
    match lookup_asset("favicon.svg") {
        Some(file) => (
            [
                (header::CONTENT_TYPE, "image/svg+xml".to_string()),
                (header::CACHE_CONTROL, "public, max-age=3600".to_string()),
            ],
            embedded_body(file.data),
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

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
