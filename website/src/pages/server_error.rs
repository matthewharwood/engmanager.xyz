//! A dependency-free document for explicit page failures and caught handler
//! panics. Ordinary API/error responses keep their existing representation.

use std::any::Any;

use axum::Json;
use axum::body::Body;
use axum::extract::MatchedPath;
use axum::http::{HeaderMap, HeaderName, HeaderValue, Method, Request, StatusCode, header};
use axum::middleware::Next;
use axum::response::{Html, IntoResponse, Response};
use serde_json::json;

use crate::router::routes;

const DOCUMENT: &str = include_str!("server_error.html");
const CSP: &str = "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; worker-src 'none'";

/// Lets the outer security middleware recognize this fixed, unparameterized
/// document even when the failed request belongs to a private route.
#[derive(Clone, Copy, Debug)]
pub struct ServerErrorDocument;

/// Only responses created by our panic boundary are eligible for negotiation.
/// A handler's deliberate JSON, text, or HTML error must not be rewritten.
#[derive(Clone, Copy, Debug)]
struct PanicFailure;

pub async fn handler() -> Response {
    response()
}

pub fn response() -> Response {
    let mut response = (StatusCode::INTERNAL_SERVER_ERROR, Html(DOCUMENT)).into_response();
    response.extensions_mut().insert(ServerErrorDocument);
    security_headers(&mut response);
    response
}

/// CatchPanicLayer invokes this without a request. Start with a generic JSON
/// failure; the outer layer can select the document using request context.
pub fn panic_response(_panic: Box<dyn Any + Send + 'static>) -> Response {
    tracing::error!("request handler panicked");
    let mut response = crate::http::no_store((
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": "Internal server error." })),
    ));
    response.extensions_mut().insert(PanicFailure);
    response
}

pub async fn panic_document_layer(request: Request<Body>, next: Next) -> Response {
    let document = is_document_request(&request);
    let head = request.method() == Method::HEAD;
    let mut response = next.run(request).await;
    if response.status() != StatusCode::INTERNAL_SERVER_ERROR
        || response.extensions_mut().remove::<PanicFailure>().is_none()
    {
        return response;
    }
    if document {
        *response.body_mut() = Body::from(DOCUMENT);
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/html; charset=utf-8"),
        );
        // A replacement body must not retain representation-specific headers.
        for name in [
            header::CONTENT_LENGTH,
            header::CONTENT_ENCODING,
            header::CONTENT_RANGE,
            header::ETAG,
            header::LAST_MODIFIED,
        ] {
            response.headers_mut().remove(name);
        }
        response.extensions_mut().insert(ServerErrorDocument);
        security_headers(&mut response);
    }
    if head {
        // The panic response originates outside the normal HEAD route handler,
        // so explicitly retain HEAD's bodyless contract in either format.
        *response.body_mut() = Body::empty();
        response.headers_mut().remove(header::CONTENT_LENGTH);
    }
    response
}

fn is_document_request(request: &Request<Body>) -> bool {
    if !matches!(*request.method(), Method::GET | Method::HEAD) {
        return false;
    }
    // MatchedPath classifies dynamic/encoded route parameters by their route
    // contract; unmatched paths normally belong to the HTML 404 fallback.
    let path = request
        .extensions()
        .get::<MatchedPath>()
        .map(MatchedPath::as_str)
        .unwrap_or_else(|| request.uri().path());
    if path == "/api"
        || path.starts_with("/api/")
        || path == "/assets"
        || path.starts_with("/assets/")
        || matches!(
            path,
            routes::HEALTH
                | routes::RUM
                | routes::SITEMAP
                | routes::SITEMAP_ALIAS
                | routes::ROBOTS
                | routes::FAVICON
                | routes::SERVICE_WORKER
                | routes::PERSONALITY_WORKER
        )
    {
        return false;
    }
    accepts_html(request.headers())
}

fn accepts_html(headers: &HeaderMap) -> bool {
    headers.get_all(header::ACCEPT).iter().any(|value| {
        value.to_str().is_ok_and(|value| {
            value.split(',').any(|range| {
                let mut parts = range.split(';');
                if !parts
                    .next()
                    .is_some_and(|mime| mime.trim().eq_ignore_ascii_case("text/html"))
                {
                    return false;
                }
                parts.all(|parameter| match parameter.trim().split_once('=') {
                    Some((name, quality)) if name.trim().eq_ignore_ascii_case("q") => quality
                        .trim()
                        .parse::<f32>()
                        .is_ok_and(|quality| quality > 0.0 && quality <= 1.0),
                    None => !parameter.trim().eq_ignore_ascii_case("q"),
                    _ => true,
                })
            })
        })
    })
}

/// Apply last, after ordinary/private route policy. The document has no
/// request data, script, or external dependency: only its fixed inline CSS and
/// inline SVG/data favicon are allowed. This never relaxes a normal page.
pub fn security_headers(response: &mut Response) {
    if response.extensions().get::<ServerErrorDocument>().is_none() {
        return;
    }
    let headers = response.headers_mut();
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store, no-transform"),
    );
    for name in ["cloudflare-cdn-cache-control", "cdn-cache-control"] {
        headers.insert(
            HeaderName::from_static(name),
            HeaderValue::from_static("no-store"),
        );
    }
    headers.remove("cache-tag");
    headers.remove(header::CONTENT_SECURITY_POLICY_REPORT_ONLY);
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(CSP),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    headers.insert(
        HeaderName::from_static("x-robots-tag"),
        HeaderValue::from_static("noindex, nofollow, noarchive"),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::Router;
    use axum::body::to_bytes;
    use axum::routing::get;
    use tower::ServiceExt;
    use tower_http::catch_panic::CatchPanicLayer;

    async fn panic_handler() -> Response {
        panic!("synthetic-private-panic-payload");
    }

    fn router() -> Router {
        Router::new()
            .route("/search", get(panic_handler).post(panic_handler))
            .route("/unsubscribe", get(panic_handler))
            .route("/api/failure", get(panic_handler))
            .route("/assets/failure", get(panic_handler))
            .route("/health", get(panic_handler))
            .route(
                "/returned-json",
                get(|| async {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": "deliberate" })),
                    )
                }),
            )
            .route(
                "/returned-text",
                get(|| async { (StatusCode::INTERNAL_SERVER_ERROR, "deliberate text") }),
            )
            .layer(CatchPanicLayer::custom(panic_response))
            .layer(axum::middleware::from_fn(panic_document_layer))
            .layer(axum::middleware::from_fn(
                crate::http::security_headers_layer,
            ))
            .layer(axum::middleware::from_fn(crate::http::html_cache_layer))
    }

    async fn request(method: Method, path: &str, accept: &str) -> Response {
        router()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(path)
                    .header(header::ACCEPT, accept)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap()
    }

    #[test]
    fn html_negotiation_requires_an_explicit_positive_quality() {
        for (accept, expected) in [
            ("text/html", true),
            ("text/html,application/xhtml+xml,*/*;q=0.8", true),
            ("TEXT/HTML; charset=utf-8; q=0.5", true),
            ("application/json", false),
            ("*/*", false),
            ("text/html;q=0,*/*;q=1", false),
            ("text/html;q=broken", false),
            ("text/html;q=NaN", false),
            ("text/html;q=2", false),
            ("text/html;q=-1", false),
        ] {
            let mut headers = HeaderMap::new();
            headers.insert(header::ACCEPT, HeaderValue::from_str(accept).unwrap());
            assert_eq!(accepts_html(&headers), expected, "{accept}");
        }
        assert!(!accepts_html(&HeaderMap::new()));
    }

    #[tokio::test]
    async fn caught_document_panic_is_private_and_never_echoes_request_or_panic_data() {
        for path in [
            "/search?token=synthetic-private-query",
            "/unsubscribe?token=synthetic-private-query",
        ] {
            let response = request(Method::GET, path, "text/html").await;
            assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
            assert_eq!(
                response.headers()[header::CONTENT_TYPE],
                "text/html; charset=utf-8"
            );
            assert_eq!(
                response.headers()[header::CACHE_CONTROL],
                "no-store, no-transform"
            );
            assert_eq!(
                response.headers()["cloudflare-cdn-cache-control"],
                "no-store"
            );
            assert_eq!(response.headers()["cdn-cache-control"], "no-store");
            assert_eq!(response.headers()[header::REFERRER_POLICY], "no-referrer");
            assert_eq!(response.headers()[header::CONTENT_SECURITY_POLICY], CSP);
            assert!(
                !response
                    .headers()
                    .contains_key(header::CONTENT_SECURITY_POLICY_REPORT_ONLY)
            );
            assert!(!response.headers().contains_key("cache-tag"));
            let body = to_bytes(response.into_body(), 100_000).await.unwrap();
            assert_eq!(body.as_ref(), DOCUMENT.as_bytes());
            assert!(!DOCUMENT.contains("synthetic-private"));
            assert!(!DOCUMENT.contains("<script"));
        }
    }

    #[tokio::test]
    async fn api_asset_and_non_html_panics_remain_generic_json() {
        for (method, path, accept) in [
            (Method::GET, "/api/failure", "text/html"),
            (Method::GET, "/assets/failure", "text/html"),
            (Method::GET, "/health", "text/html"),
            (Method::GET, "/search", "application/json"),
            (Method::GET, "/search", "text/html;q=0"),
            (Method::GET, "/search", "*/*"),
            (Method::POST, "/search", "text/html"),
        ] {
            let response = request(method, path, accept).await;
            assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
            assert_eq!(response.headers()[header::CONTENT_TYPE], "application/json");
            assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
            let body = to_bytes(response.into_body(), 100_000).await.unwrap();
            assert_eq!(
                serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
                json!({ "error": "Internal server error." })
            );
        }
    }

    #[tokio::test]
    async fn caught_head_panics_remain_bodyless_in_both_representations() {
        for path in ["/search", "/api/failure"] {
            let response = request(Method::HEAD, path, "text/html").await;
            assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
            let body = to_bytes(response.into_body(), 100_000).await.unwrap();
            assert!(body.is_empty());
        }
    }

    #[tokio::test]
    async fn deliberately_returned_non_html_errors_are_not_replaced() {
        for (path, expected, mime) in [
            (
                "/returned-json",
                r#"{"error":"deliberate"}"#,
                "application/json",
            ),
            (
                "/returned-text",
                "deliberate text",
                "text/plain; charset=utf-8",
            ),
        ] {
            let response = request(Method::GET, path, "text/html").await;
            assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
            assert_eq!(response.headers()[header::CONTENT_TYPE], mime);
            let body = to_bytes(response.into_body(), 100_000).await.unwrap();
            assert_eq!(body.as_ref(), expected.as_bytes());
        }
    }
}
