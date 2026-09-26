//! End-to-end: standard blog articles carry the coaching call to action,
//! and it sits UNDER the next-up pagination.
//! The private personality introduction instead leads into the questionnaire.
//!
//! Black box on purpose. The CTA's whole job is to appear on every article a
//! reader can actually reach, so it is checked by fetching every one of those
//! pages from the real binary over HTTP rather than by calling the function
//! that renders it. The companion unit test
//! (`the_coaching_cta_reads_its_facts_from_the_coaching_domain`) covers the
//! other half: that the offer it quotes comes from `coaching::` and is not a
//! hardcoded copy.

mod common;

use common::{SITE_HOST, TestServer};
use reqwest::StatusCode;

const COACH_ORIGIN: &str = "https://coach.engmanager.xyz";

/// Public article slugs, read from the homepage's article data island — the
/// same source the site itself renders from, so this can never test a stale
/// hand-maintained list.
fn public_slugs(homepage: &str) -> Vec<String> {
    let island = homepage
        .split_once(r#"<script type="application/json" id="articles-data">"#)
        .and_then(|(_, rest)| rest.split_once("</script>"))
        .map(|(json, _)| json)
        .expect("the homepage carries an articles-data island");
    let value: serde_json::Value = serde_json::from_str(island).expect("island is JSON");
    value
        .as_object()
        .expect("island is an object")
        .keys()
        .cloned()
        .collect()
}

#[tokio::test]
async fn every_article_ends_with_the_coaching_call_to_action() {
    let server = TestServer::start(None).await;
    let client = server.client();

    let homepage = client
        .get(server.url(SITE_HOST, "/"))
        .send()
        .await
        .expect("GET /")
        .text()
        .await
        .expect("homepage body");
    let slugs = public_slugs(&homepage);
    assert!(
        slugs.len() > 5,
        "expected the real article list, got {slugs:?}"
    );

    for slug in &slugs {
        let path = format!("/articles/{slug}");
        let response = client
            .get(server.url(SITE_HOST, &path))
            .send()
            .await
            .unwrap_or_else(|error| panic!("GET {path}: {error}"));
        assert_eq!(response.status(), StatusCode::OK, "GET {path}");
        let html = response.text().await.expect("body");
        assert!(
            html.contains(&format!("data-article-hero=\"{slug}\"")),
            "{slug} has no article-specific hero"
        );
        assert!(
            html.contains("article-hero-poster"),
            "{slug} has no static poster"
        );

        if slug == "big-personality" {
            assert!(html.contains("data-personality-route=\"article\""));
            assert!(html.contains("href=\"/personality/prepare\""));
            assert!(!html.contains("class=\"article-coach\""));
            assert!(!html.contains("experiences.js"));
            continue;
        }

        let cta = html
            .find(r#"<aside class="article-coach""#)
            .unwrap_or_else(|| panic!("{slug} has no coaching CTA"));

        // Under the pagination, never above it. Articles at the end of a
        // chain render no next-up cards at all — the CTA still has to be
        // there, which is the case this ordering check must not skip.
        if let Some(pagination) = html.find(r#"<footer class="article-nextup""#) {
            assert!(cta > pagination, "{slug}: CTA renders above the pagination");
        }

        assert!(
            html.contains(&format!(r#"href="{COACH_ORIGIN}/""#)),
            "{slug} does not link to the coaching page"
        );
        assert!(
            html.contains(&format!(r#"href="{COACH_ORIGIN}/?group=1""#)),
            "{slug} has no group link"
        );
        // The headshots are the self-hosted ones, never LinkedIn's expiring CDN.
        assert!(html.contains("/assets/coach/"), "{slug}");
        assert!(!html.contains("licdn.com"), "{slug} hotlinks LinkedIn");
    }
}
