//! End-to-end: the compiled binary serves `coach.engmanager.xyz` over real
//! HTTP — host routing, the booking page contract (offer terms, spectrum
//! personas, Google Calendar embed, Icebreakers `/copy` link), its hashed
//! assets, headers, the apex `/coaching` redirect, and the guard that keeps an
//! invalid booking URL off the page.

mod common;

use common::{COACH_HOST, SITE_HOST, TEST_BOOKING_URL, TestServer, asset_href, coach_island};
use reqwest::StatusCode;
use reqwest::header::{CACHE_CONTROL, CONTENT_TYPE, LOCATION};

#[tokio::test]
async fn coach_subdomain_serves_the_booking_flow_end_to_end() {
    let server = TestServer::start(Some(TEST_BOOKING_URL)).await;
    let client = server.client();

    // --- the page ---------------------------------------------------------
    let response = client
        .get(server.url(COACH_HOST, "/"))
        .send()
        .await
        .expect("GET coach /");
    assert_eq!(response.status(), StatusCode::OK);
    let headers = response.headers().clone();
    assert!(
        headers[CONTENT_TYPE]
            .to_str()
            .unwrap()
            .starts_with("text/html")
    );
    assert_eq!(
        headers[CACHE_CONTROL],
        "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400"
    );
    assert_eq!(headers["x-content-type-options"], "nosniff");
    assert!(
        headers["content-security-policy-report-only"]
            .to_str()
            .unwrap()
            .contains("https://calendar.google.com"),
        "CSP must allow framing the Google booking page"
    );
    let html = response.text().await.expect("coach body");

    // Offer terms: $100, 35 minutes, Fridays 10am–2pm Pacific.
    for needle in [
        "$100",
        "35 min",
        "Fridays · 10am–2pm PT",
        "Google Meet",
        r#"<link rel="canonical" href="https://coach.engmanager.xyz/">"#,
        r#""priceCurrency":"USD""#,
        r#""price":"100.00""#,
    ] {
        assert!(html.contains(needle), "coach page missing {needle:?}");
    }

    // The booking embed points at the configured Google appointment schedule
    // and loads lazily; a new-tab fallback link is always present.
    let embed = format!(r#"data-src="{TEST_BOOKING_URL}?gv=true""#);
    assert!(html.contains(&embed), "embed src missing");
    assert!(html.contains(&format!(r#"href="{TEST_BOOKING_URL}" target="_blank""#)));
    // Icebreakers intake: the forced "Make a copy" link.
    assert!(html.contains(
        "https://docs.google.com/document/d/1uTPB3l9oJ5rCKHiqUYOv_EKfcrtLNUtKn6hIBO-Lbn8/copy"
    ));

    // The data island drives the slider + sheet; its persona table must tile
    // 0..=100 exactly and agree with the server-rendered default persona.
    let island = coach_island(&html);
    let personas = island["personas"].as_array().expect("personas array");
    let mut next_min = 0;
    for persona in personas {
        assert_eq!(
            persona["min"], next_min,
            "persona ranges must be contiguous"
        );
        assert_eq!(persona["focus"].as_array().map(Vec::len), Some(3));
        next_min = persona["max"].as_u64().unwrap() + 1;
    }
    assert_eq!(next_min, 101, "persona ranges must end at 100");
    let default = island["defaultSpectrum"].as_u64().unwrap();
    let default_persona = personas
        .iter()
        .find(|p| p["min"].as_u64().unwrap() <= default && default <= p["max"].as_u64().unwrap())
        .expect("default spectrum maps to a persona");
    assert!(html.contains(&format!(
        r#"data-persona="{}""#,
        default_persona["id"].as_str().unwrap()
    )));
    assert_eq!(island["offer"]["timeZone"], "America/Los_Angeles");
    assert_eq!(island["offer"]["weekday"], 5);
    assert_eq!(island["offer"]["start"], "10:00");
    assert_eq!(island["offer"]["end"], "14:00");
    assert_eq!(island["offer"]["minutes"], 35);
    assert_eq!(island["booking"]["href"], TEST_BOOKING_URL);

    // --- hashed assets round-trip over HTTP --------------------------------
    for (prefix, content_type, marker) in [
        ("/assets/css/coach.", "text/css", ".coach-slider"),
        ("/assets/css/shop.", "text/css", ".shop-bag"),
        ("/assets/js/coach.", "javascript", "__coach"),
    ] {
        let href = asset_href(&html, prefix);
        let asset = client
            .get(server.url(COACH_HOST, &href))
            .send()
            .await
            .expect("GET asset");
        assert_eq!(asset.status(), StatusCode::OK, "{href}");
        assert!(
            asset.headers()[CONTENT_TYPE]
                .to_str()
                .unwrap()
                .contains(content_type),
            "{href} content-type"
        );
        assert_eq!(
            asset.headers()[CACHE_CONTROL],
            "public, max-age=31536000, immutable"
        );
        let body = asset.text().await.expect("asset body");
        assert!(body.contains(marker), "{href} missing {marker}");
    }

    // --- host partitioning -------------------------------------------------
    let apex = client
        .get(server.url(SITE_HOST, "/"))
        .send()
        .await
        .expect("GET apex /");
    assert_eq!(apex.status(), StatusCode::OK);
    assert!(!apex.text().await.unwrap().contains("window.__coach="));

    let redirect = client
        .get(server.url(SITE_HOST, "/coaching"))
        .send()
        .await
        .expect("GET apex /coaching");
    assert_eq!(redirect.status(), StatusCode::PERMANENT_REDIRECT);
    assert_eq!(
        redirect.headers()[LOCATION],
        "https://coach.engmanager.xyz/"
    );

    let missing = client
        .get(server.url(COACH_HOST, "/not-a-page"))
        .send()
        .await
        .expect("GET coach 404");
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
    assert_eq!(missing.headers()[CACHE_CONTROL], "no-store");

    let health = client
        .get(server.url(COACH_HOST, "/health"))
        .send()
        .await
        .expect("GET health");
    assert_eq!(health.text().await.unwrap(), "OK");
}

#[tokio::test]
async fn an_invalid_booking_url_is_never_rendered() {
    let server = TestServer::start(Some(
        "https://evil.example/calendar/appointments/schedules/x",
    ))
    .await;
    let html = server
        .client()
        .get(server.url(COACH_HOST, "/"))
        .send()
        .await
        .expect("GET coach /")
        .text()
        .await
        .expect("body");

    assert!(
        !html.contains("evil.example"),
        "untrusted URL leaked into the page"
    );
    assert!(html.contains("data-booking-unavailable"));
    assert!(!html.contains("data-booking-frame"));
    assert_eq!(coach_island(&html)["booking"], serde_json::Value::Null);
}

#[tokio::test]
async fn without_a_booking_url_the_page_still_ships() {
    let server = TestServer::start(None).await;
    let response = server
        .client()
        .get(server.url(COACH_HOST, "/"))
        .send()
        .await
        .expect("GET coach /");
    assert_eq!(response.status(), StatusCode::OK);
    let html = response.text().await.expect("body");
    assert!(html.contains("data-booking-unavailable"));
    assert!(html.contains("Make my copy"));
}
