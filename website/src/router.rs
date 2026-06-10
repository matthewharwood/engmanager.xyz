//! Route table + router assembly. (Patterns: axum-service-architecture
//! "modular router organization"; axum-web-framework layer ordering;
//! GRAYSON rule 2 — time-bound all I/O via TimeoutLayer.)

use std::time::Duration;

use axum::Router;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use tower_http::compression::CompressionLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;

use crate::config::is_shop_host;
use crate::state::AppState;
use crate::{assets, http, pages, sitemap};

/// Every route path the server exposes, in one place. The strings are the
/// contract pinned by the router-surface tests below.
pub mod routes {
    pub const ROOT: &str = "/";
    pub const ARTICLES_INDEX: &str = "/articles/";
    pub const ARTICLE_DETAIL: &str = "/articles/{slug}";
    pub const SEARCH: &str = "/search";
    pub const SEARCH_TYPEAHEAD: &str = "/api/search/typeahead";
    pub const ARTICLE_COMMENTS: &str = "/api/articles/{slug}/comments";
    pub const CHECKOUT: &str = "/checkout";
    pub const CHECKOUT_SUCCESS: &str = "/checkout/success";
    pub const CHECKOUT_INTENT: &str = "/api/checkout/intent";
    pub const STRIPE_WEBHOOK: &str = "/api/stripe/webhook";
    pub const SITEMAP: &str = "/sitemap.xml";
    pub const SITEMAP_ALIAS: &str = "/sitemaps.xml";
    pub const ROBOTS: &str = "/robots.txt";
    pub const HEALTH: &str = "/health";
    pub const FAVICON: &str = "/favicon.ico";
    pub const RUM: &str = "/__rum";
    pub const OFFLINE: &str = "/offline.html";
    pub const SERVICE_WORKER: &str = "/sw.js";
    pub const ASSETS: &str = "/assets/{*path}";
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route(routes::ROOT, get(root_handler))
        .route(routes::ARTICLES_INDEX, get(pages::articles::index))
        .route(routes::ARTICLE_DETAIL, get(pages::articles::detail))
        .route(routes::SEARCH, get(pages::search::page))
        .route(routes::SEARCH_TYPEAHEAD, get(pages::search::typeahead))
        .route(
            routes::ARTICLE_COMMENTS,
            get(pages::comments::list).post(pages::comments::create),
        )
        .route(routes::CHECKOUT, get(pages::checkout::page))
        .route(routes::CHECKOUT_SUCCESS, get(pages::checkout::success))
        .route(
            routes::CHECKOUT_INTENT,
            post(pages::checkout::create_intent),
        )
        .route(routes::STRIPE_WEBHOOK, post(pages::checkout::webhook))
        .route(routes::SITEMAP, get(sitemap::sitemap_handler))
        .route(routes::SITEMAP_ALIAS, get(sitemap::sitemap_handler))
        .route(routes::ROBOTS, get(sitemap::robots_handler))
        .route(routes::HEALTH, get(|| async { "OK" }))
        .route(routes::FAVICON, get(assets::favicon_handler))
        .route(routes::RUM, post(http::rum_handler))
        .route(routes::OFFLINE, get(assets::offline_handler))
        .route(routes::SERVICE_WORKER, get(assets::sw_handler))
        .route(routes::ASSETS, get(assets::asset_handler))
        .fallback(fallback_handler)
        .with_state(state)
        // Layer stack, innermost first (each `.layer` call wraps everything
        // registered before it). Outermost → innermost at runtime:
        //   TraceLayer → CompressionLayer → TimeoutLayer(30s)
        //   → html_cache_layer → security_headers_layer → routes.
        .layer(axum::middleware::from_fn(http::security_headers_layer))
        .layer(axum::middleware::from_fn(http::html_cache_layer))
        // Hard 30s ceiling per request: a wedged handler returns 408 instead
        // of holding the connection (and the client) forever.
        // (`TimeoutLayer::new` is deprecated in tower-http 0.6.10; this is
        // the same constructor with the 408 default made explicit.)
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(30),
        ))
        // Brotli + gzip over the wire for any compressible response
        // (text/css, text/html, application/javascript, etc.). Vary
        // header is added automatically so caches key on encoding.
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
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

// Host dispatch deliberately keeps the handler-calls-handler pattern from the
// pre-refactor main.rs (P1 moves code, it does not redesign the dispatch).
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

// Router-surface regression tests: drive the fully-layered Router with
// tower::ServiceExt::oneshot and pin the externally observable contract
// (status codes, cache headers, security headers, asset round-trips).
#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use axum::Router;
    use axum::body::Body;
    use axum::http::{Request, StatusCode, header};
    use http_body_util::BodyExt;
    use tokio::sync::watch;
    use tower::ServiceExt;

    use super::build_router;
    use crate::http::HTML_CACHE_CONTROL;
    use crate::state::{AppState, CommentsHandle};
    use crate::{asset_url, comments, content, search, stripe};

    const SITE_HOST: &str = "engmanager.xyz";
    const SHOP_HOST: &str = "shop.localhost";

    async fn test_router() -> Router {
        let comments = CommentsHandle::connected(Arc::new(
            comments::CommentStore::connect_in_memory()
                .await
                .expect("in-memory comment store must connect"),
        ));
        let search = Arc::new(
            search::SearchEngine::build_in_memory(content::ARTICLES, &[])
                .expect("search index must build from the real articles"),
        );
        // No STRIPE_* env in tests → checkout reports "disabled", which is a
        // valid production configuration the pages render fine under.
        let stripe = Arc::new(stripe::Checkout::from_env());
        build_router(AppState {
            search,
            comments,
            stripe,
            // Cold snapshot (None) — exactly how production boots before the
            // first Discord poll completes.
            discord: watch::channel(None).1,
        })
    }

    async fn get(router: &Router, host: &str, path: &str) -> axum::response::Response {
        let request = Request::builder()
            .uri(path)
            .header(header::HOST, host)
            .body(Body::empty())
            .expect("request builds");
        router
            .clone()
            .oneshot(request)
            .await
            .expect("router is infallible")
    }

    fn header_str<'a>(response: &'a axum::response::Response, name: &str) -> Option<&'a str> {
        response.headers().get(name).and_then(|v| v.to_str().ok())
    }

    async fn body_string(response: axum::response::Response) -> String {
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("body collects")
            .to_bytes();
        String::from_utf8(bytes.to_vec()).expect("body is utf-8")
    }

    #[tokio::test]
    async fn core_routes_respond_ok_and_unknown_paths_404() {
        let router = test_router().await;
        let first_slug = content::ARTICLES[0].slug;
        let article_path = format!("/articles/{first_slug}");
        let ok_paths = [
            "/",
            "/articles/",
            article_path.as_str(),
            "/search",
            "/search?q=rust",
            "/sitemap.xml",
            "/sitemaps.xml",
            "/robots.txt",
            "/health",
            "/offline.html",
            "/favicon.ico",
        ];
        for path in ok_paths {
            let response = get(&router, SITE_HOST, path).await;
            assert_eq!(response.status(), StatusCode::OK, "GET {path}");
        }

        let response = get(&router, SITE_HOST, "/definitely-not-a-page").await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    // /checkout is host-partitioned: the cart lives in shop-origin
    // localStorage, so non-shop hosts get the 404 page (preserved
    // pre-refactor behavior) and shop hosts get the real page.
    #[tokio::test]
    async fn checkout_is_shop_host_only_and_keeps_no_store() {
        let router = test_router().await;

        let on_shop = get(&router, SHOP_HOST, "/checkout").await;
        assert_eq!(on_shop.status(), StatusCode::OK);
        assert_eq!(header_str(&on_shop, "cache-control"), Some("no-store"));
        // no-store responses must never gain CDN cache headers.
        assert!(
            on_shop
                .headers()
                .get("cloudflare-cdn-cache-control")
                .is_none()
        );

        let on_site = get(&router, SITE_HOST, "/checkout").await;
        assert_eq!(on_site.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn sw_js_serves_with_service_worker_headers() {
        let router = test_router().await;
        let response = get(&router, SITE_HOST, "/sw.js").await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header_str(&response, "service-worker-allowed"), Some("/"));
        assert_eq!(
            header_str(&response, "cache-control"),
            Some("no-cache, max-age=0")
        );
    }

    #[tokio::test]
    async fn hashed_asset_url_round_trips() {
        let router = test_router().await;

        let hashed = asset_url("css/critical.css");
        assert!(
            hashed.starts_with("/assets/css/critical.") && hashed.ends_with(".css"),
            "unexpected asset_url shape: {hashed}"
        );
        let response = get(&router, SITE_HOST, &hashed).await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            header_str(&response, "cache-control"),
            Some("public, max-age=31536000, immutable")
        );

        // The flat (unhashed) URL keeps resolving too.
        let flat = get(&router, SITE_HOST, "/assets/css/critical.css").await;
        assert_eq!(flat.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn security_headers_present_on_success_and_404() {
        let router = test_router().await;
        for path in ["/", "/definitely-not-a-page"] {
            let response = get(&router, SITE_HOST, path).await;
            assert_eq!(
                header_str(&response, "x-content-type-options"),
                Some("nosniff"),
                "GET {path}"
            );
            assert_eq!(
                header_str(&response, "referrer-policy"),
                Some("strict-origin-when-cross-origin"),
                "GET {path}"
            );
            assert_eq!(
                header_str(&response, "x-frame-options"),
                Some("DENY"),
                "GET {path}"
            );
        }
    }

    #[tokio::test]
    async fn root_html_gains_default_and_cdn_cache_headers() {
        let router = test_router().await;
        let response = get(&router, SITE_HOST, "/").await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            header_str(&response, "cache-control"),
            Some(HTML_CACHE_CONTROL)
        );
        assert_eq!(
            header_str(&response, "cloudflare-cdn-cache-control"),
            Some("max-age=3600, stale-while-revalidate=86400, stale-if-error=259200")
        );
        assert_eq!(header_str(&response, "cache-tag"), Some("html"));
    }

    #[tokio::test]
    async fn not_found_html_is_no_store_without_cdn_headers() {
        let router = test_router().await;
        let response = get(&router, SITE_HOST, "/definitely-not-a-page").await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(header_str(&response, "cache-control"), Some("no-store"));
        assert!(
            response
                .headers()
                .get("cloudflare-cdn-cache-control")
                .is_none()
        );
    }

    #[tokio::test]
    async fn rum_sink_accepts_small_payloads() {
        let router = test_router().await;
        let request = Request::builder()
            .method("POST")
            .uri("/__rum")
            .header(header::HOST, SITE_HOST)
            .body(Body::from(r#"{"lcp":1234}"#))
            .expect("request builds");
        let response = router
            .clone()
            .oneshot(request)
            .await
            .expect("router is infallible");
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn shop_host_serves_shop_markup_with_its_own_cdn_horizon() {
        let router = test_router().await;

        let response = get(&router, SHOP_HOST, "/").await;
        assert_eq!(response.status(), StatusCode::OK);
        // The shop page's handler-set Cache-Control stays byte-identical and
        // gains the CDN pair derived from its OWN s-maxage horizon.
        assert_eq!(
            header_str(&response, "cache-control"),
            Some("public, max-age=300, s-maxage=86400, stale-while-revalidate=604800")
        );
        assert_eq!(
            header_str(&response, "cloudflare-cdn-cache-control"),
            Some("max-age=86400, stale-while-revalidate=604800, stale-if-error=259200")
        );
        assert_eq!(header_str(&response, "cache-tag"), Some("html"));
        let body = body_string(response).await;
        assert!(
            body.contains("window.__shopProducts"),
            "shop markup marker missing from shop-host root"
        );

        // Product deep links fall through to the shop SPA shell.
        let product = get(&router, SHOP_HOST, "/products/anything").await;
        assert_eq!(product.status(), StatusCode::OK);
    }
}
