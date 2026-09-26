mod common;

use common::{SITE_HOST, TestServer};
use reqwest::{StatusCode, header};

#[tokio::test]
async fn newsletter_page_and_navigation_are_available_without_kit_credentials() {
    let server = TestServer::start(None).await;
    let client = server.client();
    let response = client
        .get(server.url(SITE_HOST, "/subscribe"))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let html = response.text().await.unwrap();
    assert!(html.contains("/api/newsletter/subscribe"));
    assert!(html.contains("type=\"email\""));
    assert!(!html.contains("api.kit.com"));
    assert!(html.contains(r#"name="twitter:card" content="summary_large_image""#));
    assert!(html.contains(r#"property="og:image:width" content="1200""#));
    assert!(html.contains(r#"property="og:image:height" content="630""#));
    let share_image = html
        .split(r#"property="og:image" content=""#)
        .nth(1)
        .and_then(|value| value.split('"').next())
        .expect("newsletter links have a social preview image");
    let share_image = reqwest::Url::parse(share_image).expect("share image is an absolute URL");
    assert_eq!(
        share_image.origin().ascii_serialization(),
        "https://engmanager.xyz"
    );
    let image_response = client
        .get(server.url(SITE_HOST, share_image.path()))
        .send()
        .await
        .unwrap();
    assert_eq!(image_response.status(), StatusCode::OK);
    assert_eq!(image_response.headers()[header::CONTENT_TYPE], "image/jpeg");

    let home = client
        .get(server.url(SITE_HOST, "/"))
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    assert!(home.contains("href=\"/subscribe\""));

    let alias = client
        .get(server.url(SITE_HOST, "/newsletter"))
        .send()
        .await
        .unwrap();
    assert_eq!(alias.status(), StatusCode::PERMANENT_REDIRECT);
    assert_eq!(alias.headers()[header::LOCATION], "/subscribe");
}

#[tokio::test]
async fn newsletter_posts_redirect_without_exposing_email_or_caching_results() {
    let server = TestServer::start(None).await;
    let client = server.client();
    for (body, expected) in [
        ("email=not-an-email", "/subscribe?status=invalid"),
        (
            "email=reader%40example.com",
            "/subscribe?status=unavailable",
        ),
        (
            "email=reader%40example.com&website=spam",
            "/subscribe?status=check-email",
        ),
    ] {
        let response = client
            .post(server.url(SITE_HOST, "/api/newsletter/subscribe"))
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SEE_OTHER);
        assert_eq!(response.headers()[header::LOCATION], expected);
        assert!(
            response.headers()[header::CACHE_CONTROL]
                .to_str()
                .unwrap()
                .contains("no-store")
        );
        let page = client
            .get(server.url(SITE_HOST, expected))
            .send()
            .await
            .unwrap();
        assert_eq!(page.status(), StatusCode::OK);
        assert!(
            page.headers()[header::CACHE_CONTROL]
                .to_str()
                .unwrap()
                .contains("no-store")
        );
        let html = page.text().await.unwrap();
        assert!(!html.contains("reader@example.com"));
    }
}
