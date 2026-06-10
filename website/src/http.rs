//! Cross-cutting HTTP middleware (security headers, HTML cache policy) and
//! the first-party RUM sink. (Patterns: axum-web-framework middleware via
//! `axum::middleware::from_fn`; GRAYSON rule 10 — consistent protocol
//! mappings.)

use axum::Json;
use axum::body::{Body, Bytes};
use axum::http::{HeaderName, HeaderValue, Request, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde_json::json;

/// Stamp `Cache-Control: no-store` on a response. The shared shape for every
/// API/search/checkout surface that must never be cached at the browser or
/// edge — replaces the per-page copy-pasted header tuples (byte-identical
/// output).
pub fn no_store(response: impl IntoResponse) -> Response {
    ([(header::CACHE_CONTROL, "no-store")], response).into_response()
}

/// JSON error with the sitewide `{"error": message}` body shape, never cached.
/// (GRAYSON rule 10 — consistent protocol mappings.)
pub fn json_error(status: StatusCode, message: &str) -> Response {
    no_store((status, Json(json!({ "error": message }))))
}

// Cache-Control for HTML responses.
//   max-age=60       → browser caches 1 min (so reload is snappy but fresh-ish)
//   s-maxage=3600    → Cloudflare caches at edge for 1 hour
//   stale-while-revalidate=86400 → CF can serve a day-old cached copy while
//                                  re-fetching in the background
// Cloudflare still needs a Cache Rule to opt HTML into edge caching, but
// once enabled it will honor these s-maxage / SWR directives.
pub const HTML_CACHE_CONTROL: &str =
    "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

// Cloudflare-specific cache policy stamped alongside HTML_CACHE_CONTROL:
// same 1h edge horizon and 1-day SWR window, plus stale-if-error so the edge
// can keep serving HTML for 3 days through an origin outage. Cache-Tag lets
// a deploy purge all HTML at once without touching immutable assets.
const DEFAULT_CDN_CACHE_CONTROL: &str =
    "max-age=3600, stale-while-revalidate=86400, stale-if-error=259200";
const STALE_IF_ERROR_SECS: u32 = 259_200;

const CLOUDFLARE_CDN_CACHE_CONTROL: HeaderName =
    HeaderName::from_static("cloudflare-cdn-cache-control");
const CACHE_TAG: HeaderName = HeaderName::from_static("cache-tag");

// Cache policy for HTML responses:
// - Success (2xx) HTML with no handler-set Cache-Control gets the sitewide
//   HTML_CACHE_CONTROL plus the Cloudflare pair (CDN cache control + the
//   "html" Cache-Tag).
// - Non-2xx HTML with no Cache-Control gets `no-store` — error pages must
//   never be publicly cached (a 404 cached at the edge would shadow a real
//   page for an hour).
// - Success HTML where the handler set its own PUBLIC Cache-Control (e.g.
//   the shop page) keeps that value byte-for-byte and additionally gains the
//   Cloudflare pair, with the CDN max-age derived from the page's own
//   s-maxage horizon. `no-store`/`no-cache` responses are never touched.
pub(crate) async fn html_cache_layer(req: Request<Body>, next: Next) -> Response {
    let mut response = next.run(req).await;
    let is_html = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.starts_with("text/html"))
        .unwrap_or(false);
    if !is_html {
        return response;
    }

    let is_success = response.status().is_success();
    if !response.headers().contains_key(header::CACHE_CONTROL) {
        let headers = response.headers_mut();
        if is_success {
            headers.insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static(HTML_CACHE_CONTROL),
            );
            headers.insert(
                CLOUDFLARE_CDN_CACHE_CONTROL,
                HeaderValue::from_static(DEFAULT_CDN_CACHE_CONTROL),
            );
            headers.insert(CACHE_TAG, HeaderValue::from_static("html"));
        } else {
            headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
        }
        return response;
    }

    // Handler-set Cache-Control: mirror publicly cacheable success HTML to
    // the CDN header, leave everything else (no-store, no-cache, private,
    // non-2xx) untouched.
    if !is_success {
        return response;
    }
    let cache_control = response
        .headers()
        .get(header::CACHE_CONTROL)
        .and_then(|v| v.to_str().ok())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !cache_control.contains("public")
        || cache_control.contains("no-store")
        || cache_control.contains("no-cache")
    {
        return response;
    }
    if let Some(cdn_value) = cdn_cache_control_for(&cache_control) {
        let headers = response.headers_mut();
        if !headers.contains_key(CLOUDFLARE_CDN_CACHE_CONTROL) {
            headers.insert(CLOUDFLARE_CDN_CACHE_CONTROL, cdn_value);
        }
        if !headers.contains_key(CACHE_TAG) {
            headers.insert(CACHE_TAG, HeaderValue::from_static("html"));
        }
    }
    response
}

// Derives the Cloudflare-CDN-Cache-Control value from a handler-set public
// Cache-Control: the page's own s-maxage horizon (falling back to max-age
// when no s-maxage is present, e.g. /offline.html) becomes the edge max-age,
// any stale-while-revalidate window carries over, and every page gains the
// same 3-day stale-if-error cushion. Returns None when no horizon can be
// derived — in that case no CDN header is added at all.
//
// DEFENSIVE: only directive values that parse as plain u64 seconds are
// copied (every emitter in this codebase produces exactly that today). A
// malformed value — quoted, signed, fractional, garbage — skips the CDN
// header entirely rather than forwarding bytes we didn't validate into a
// header the edge interprets.
fn cdn_cache_control_for(cache_control: &str) -> Option<HeaderValue> {
    let horizon = directive_u64(cache_control, "s-maxage")
        .or_else(|| directive_u64(cache_control, "max-age"))?;
    let value = match directive_value(cache_control, "stale-while-revalidate") {
        // SWR present but unparseable → treat the whole header as suspect.
        Some(swr) => {
            let swr: u64 = swr.parse().ok()?;
            format!(
                "max-age={horizon}, stale-while-revalidate={swr}, stale-if-error={STALE_IF_ERROR_SECS}"
            )
        }
        None => format!("max-age={horizon}, stale-if-error={STALE_IF_ERROR_SECS}"),
    };
    HeaderValue::from_str(&value).ok()
}

fn directive_u64(cache_control: &str, directive: &str) -> Option<u64> {
    directive_value(cache_control, directive).and_then(|value| value.parse().ok())
}

fn directive_value<'a>(cache_control: &'a str, directive: &str) -> Option<&'a str> {
    cache_control
        .split(',')
        .filter_map(|part| part.trim().split_once('='))
        .find_map(|(name, value)| {
            if name.trim().eq_ignore_ascii_case(directive) {
                Some(value.trim())
            } else {
                None
            }
        })
}

pub(crate) async fn security_headers_layer(req: Request<Body>, next: Next) -> Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    headers.insert(
        // No `http::header` constant exists for COOP as of http 1.x.
        HeaderName::from_static("cross-origin-opener-policy"),
        HeaderValue::from_static("same-origin-allow-popups"),
    );
    headers.insert(
        // No `http::header` constant exists for Permissions-Policy either.
        HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static(
            "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(self \"https://js.stripe.com\"), usb=(), xr-spatial-tracking=()",
        ),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY_REPORT_ONLY,
        HeaderValue::from_static(
            "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://js.stripe.com; style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; media-src 'self'; worker-src 'self'; manifest-src 'self'",
        ),
    );
    response
}

// First-party real-user monitoring sink. The browser sends small Core Web
// Vitals / navigation diagnostics with sendBeacon or keepalive fetch. We do
// not persist yet; accepting the payload gives the client a stable endpoint
// and keeps the path free of third-party analytics.
pub(crate) async fn rum_handler(body: Bytes) -> Response {
    if body.len() > 16 * 1024 {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    StatusCode::NO_CONTENT.into_response()
}

#[cfg(test)]
mod tests {
    use super::cdn_cache_control_for;

    // The shop page's own horizon must map onto the CDN header exactly:
    // s-maxage → max-age, SWR carried over, stale-if-error appended.
    #[test]
    fn cdn_cache_control_maps_shop_horizon() {
        let value = cdn_cache_control_for(
            "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
        )
        .expect("shop cache-control derives a CDN policy");
        assert_eq!(
            value.to_str().unwrap(),
            "max-age=86400, stale-while-revalidate=604800, stale-if-error=259200"
        );
    }

    #[test]
    fn cdn_cache_control_falls_back_to_max_age_without_s_maxage() {
        // /offline.html sets public max-age + SWR but no s-maxage.
        let value = cdn_cache_control_for("public, max-age=3600, stale-while-revalidate=86400")
            .expect("max-age fallback derives a CDN policy");
        assert_eq!(
            value.to_str().unwrap(),
            "max-age=3600, stale-while-revalidate=86400, stale-if-error=259200"
        );
        // No horizon at all → no CDN header.
        assert!(cdn_cache_control_for("public").is_none());
    }

    // Defensive validation: directive values must parse as plain u64 seconds
    // or the CDN header is skipped entirely — never forward unvalidated bytes.
    #[test]
    fn cdn_cache_control_rejects_non_numeric_directive_values() {
        for garbage in [
            "public, max-age=abc",
            "public, s-maxage=\"3600\"",
            "public, max-age=-5",
            "public, max-age=3.5",
            "public, s-maxage=3600 4800",
            // Valid horizon but malformed SWR → whole header suspect.
            "public, s-maxage=3600, stale-while-revalidate=evil",
        ] {
            assert!(
                cdn_cache_control_for(garbage).is_none(),
                "must reject: {garbage}"
            );
        }
    }
}
