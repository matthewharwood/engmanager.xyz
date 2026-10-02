//! End-to-end: all blog articles offer the free newsletter, and standard
//! articles also carry coaching under the next-up pagination. The personality
//! introduction retains its questionnaire links alongside the newsletter.
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
async fn every_article_offers_the_newsletter_after_its_existing_actions() {
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

        let newsletter = html
            .find(r#"<aside class="article-newsletter""#)
            .unwrap_or_else(|| panic!("{slug} has no newsletter signup"));
        assert_eq!(
            html.matches(r#"class="article-newsletter""#).count(),
            1,
            "{slug} repeats the newsletter module"
        );
        let signup = &html[newsletter..];
        assert!(
            signup.contains(r#"method="post" action="/api/newsletter/subscribe""#),
            "{slug} does not use the existing headless signup endpoint"
        );
        assert!(
            signup.contains(r#"<label for="article-newsletter-email">Your email address</label>"#)
        );
        assert!(signup.contains(r#"type="email" name="email" autocomplete="email""#));
        assert!(signup.contains(r#"required aria-describedby="article-newsletter-privacy""#));
        assert!(signup.contains(r#"<div hidden aria-hidden="true">"#));
        assert!(signup.contains(r#"name="website" tabindex="-1" autocomplete="off""#));
        assert!(signup.contains(r#"href="/newsletter/privacy""#));
        assert!(signup.contains(r#"href="/subscribe""#));
        assert!(html.contains("/assets/css/article-newsletter."));

        if slug == "big-personality" {
            assert!(html.contains("data-personality-route=\"article\""));
            assert!(html.contains("href=\"/personality/prepare\""));
            assert!(!html.contains("class=\"article-coach\""));
            assert!(!html.contains("experiences.js"));
            assert!(
                newsletter > html.find(r#"href="/personality/library""#).unwrap(),
                "{slug}: newsletter displaced the questionnaire actions"
            );
            continue;
        }

        let cta = html
            .find(r#"<aside class="article-coach""#)
            .unwrap_or_else(|| panic!("{slug} has no coaching CTA"));
        assert!(
            newsletter > cta,
            "{slug}: newsletter renders before coaching"
        );

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

#[tokio::test]
async fn newsletter_promotion_is_outside_the_private_questionnaire() {
    let server = TestServer::start(None).await;
    let html = server
        .client()
        .get(server.url(SITE_HOST, "/personality/prepare"))
        .send()
        .await
        .expect("GET /personality/prepare")
        .text()
        .await
        .expect("questionnaire body");
    assert!(!html.contains("article-newsletter"));
    assert!(!html.contains("/api/newsletter/subscribe"));
}
