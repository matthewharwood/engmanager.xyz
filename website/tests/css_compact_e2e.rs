//! Build-time class maps are one deployment unit with rendered documents and
//! content-addressed styles. No authored class registry runs in the browser.
mod common;

use common::{SITE_HOST, TestServer, asset_href};
use reqwest::StatusCode;
use serde_json::Value;
use sha2::{Digest, Sha256};

const COMPILED: &str = include_str!(concat!(env!("OUT_DIR"), "/css-compact-output.json"));

#[tokio::test]
async fn rendered_routes_and_served_styles_share_the_compiled_generation() {
    let compiled: Value = serde_json::from_str(COMPILED).expect("compiled manifest JSON");
    assert_eq!(compiled["manifest"]["schema_version"], 1);
    let generation = compiled["manifest"]["generation"]
        .as_str()
        .expect("CSS generation");
    let marker = format!("<meta name=\"eng-css-generation\" content=\"{generation}\">");
    let server = TestServer::start(None).await;
    let client = server.client();
    for route in [
        "/",
        "/feed",
        "/articles/your-gmail-avatar-is-part-of-your-job-search",
        "/articles/big-personality",
        "/articles/big%2Dpersonality",
        "/shop",
        "/coach",
        "/subscribe",
        "/search",
        "/unsubscribe",
        "/unsubscribe?token=invalid-test-capability",
    ] {
        let response = client
            .get(server.url(SITE_HOST, route))
            .send()
            .await
            .expect("render route");
        assert!(
            response.status().is_success(),
            "{route}: {}",
            response.status()
        );
        let policy = response.headers()["cache-control"].to_str().unwrap();
        let expected_policy = match route {
            "/shop" => "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
            "/articles/big-personality" | "/articles/big%2Dpersonality" => {
                "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400, no-transform"
            }
            "/subscribe" | "/search" => "no-store",
            "/unsubscribe" | "/unsubscribe?token=invalid-test-capability" => {
                "no-store, no-transform"
            }
            _ => "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
        };
        assert_eq!(policy, expected_policy, "{route} keeps its browser policy");
        if !policy.contains("no-store") {
            assert_eq!(
                response.headers()["cloudflare-cdn-cache-control"],
                "no-store"
            );
            assert_eq!(response.headers()["cdn-cache-control"], "no-store");
        }
        let html = response.text().await.expect("rendered HTML");
        assert!(
            html.contains(&marker),
            "{route} uses its compiled generation"
        );
        assert!(
            !html.contains("cssClasses("),
            "{route} has literal bindings"
        );
        let stylesheet_name = if route.contains("personality") {
            "article-newsletter"
        } else {
            "critical"
        };
        let stylesheet = asset_href(&html, &format!("/assets/css/{stylesheet_name}."));
        let expected = compiled["stylesheets"][format!("{stylesheet_name}.css")]
            .as_str()
            .unwrap();
        let digest = hex::encode(Sha256::digest(expected.as_bytes()));
        assert!(
            stylesheet.ends_with(&format!(".{}.css", &digest[..8])),
            "{route} names the exact compiled stylesheet"
        );
        let response = client
            .get(server.url(SITE_HOST, &stylesheet))
            .send()
            .await
            .expect("CSS asset");
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers()["cache-control"],
            "public, max-age=31536000, immutable"
        );
        let bytes = response.bytes().await.expect("stylesheet");
        assert_eq!(hex::encode(Sha256::digest(&bytes)), digest);
        assert_eq!(bytes.as_ref(), expected.as_bytes());
    }
}

#[tokio::test]
async fn stale_content_hashes_never_alias_current_class_maps() {
    let server = TestServer::start(None).await;
    let client = server.client();
    let html = client
        .get(server.url(SITE_HOST, "/feed"))
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    for prefix in ["/assets/css/critical.", "/assets/js/nav-router."] {
        let valid = asset_href(&html, prefix);
        let mut obsolete = valid.clone();
        let index = prefix.len();
        let replacement = if &valid[index..index + 1] == "0" {
            "1"
        } else {
            "0"
        };
        obsolete.replace_range(index..index + 1, replacement);
        let current = client
            .get(server.url(SITE_HOST, &valid))
            .send()
            .await
            .unwrap();
        assert_eq!(current.status(), StatusCode::OK);
        let old = client
            .get(server.url(SITE_HOST, &obsolete))
            .send()
            .await
            .unwrap();
        assert_eq!(
            old.status(),
            StatusCode::NOT_FOUND,
            "{obsolete} must not serve current bytes"
        );
    }
    let javascript = asset_href(&html, "/assets/js/nav-router.");
    let javascript = client
        .get(server.url(SITE_HOST, &javascript))
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    for intrinsic in ["cssClasses(", "cssSelector(", "cssToken(", "cssHtml("] {
        assert!(
            !javascript.contains(intrinsic),
            "{intrinsic} is replaced before Oxc minification"
        );
    }
    for intrinsic in ["cssClasses", "cssSelector", "cssToken", "cssHtml"] {
        assert!(
            !javascript.contains(intrinsic),
            "{intrinsic} source helper is eliminated"
        );
    }
}

#[tokio::test]
async fn previous_generation_archive_serves_only_its_exact_provenance_checked_bodies() {
    let manifest: Value = serde_json::from_str(include_str!(
        "../compat/css-generation-2061afa3/manifest.json"
    ))
    .unwrap();
    assert_eq!(
        manifest["source_commit"],
        "2061afa3aad1577e56f95cf665b49a3462f5d890"
    );
    let server = TestServer::start(None).await;
    let client = server.client();
    for entry in manifest["assets"].as_array().unwrap() {
        let path = entry["path"].as_str().unwrap();
        let response = client
            .get(server.url(SITE_HOST, path))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "archived {path}");
        assert_eq!(
            response.headers()["content-type"],
            entry["content_type"].as_str().unwrap()
        );
        let body = response.bytes().await.unwrap();
        assert_eq!(body.len() as u64, entry["bytes"].as_u64().unwrap());
        assert_eq!(
            hex::encode(Sha256::digest(&body)),
            entry["sha256"].as_str().unwrap(),
            "exact previous bytes at {path}"
        );
    }
}
