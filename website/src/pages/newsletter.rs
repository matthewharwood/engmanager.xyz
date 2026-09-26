use axum::extract::Query;
use axum::response::{Html, Response};
use eng_domain::HtmlFragment;
use eng_markup::view;
use serde::Deserialize;

use super::render_nav_search_toggle;
use super::shell::{MetaTags, PageShell};
use crate::asset_url;
use crate::components::quick_actions::theme_picker;
use crate::components::{Head, global_search, nav};
use crate::http::no_store;

const TITLE: &str = "The newsletter · ENGMANAGER.XYZ";
const DESCRIPTION: &str = "Occasional notes from Matthew Harwood on engineering leadership, building thoughtful teams, and finding your way as a manager.";
const CANONICAL: &str = "https://engmanager.xyz/subscribe";

#[derive(Debug, Default, Deserialize)]
pub struct NewsletterQuery {
    status: Option<String>,
}

pub async fn index(Query(query): Query<NewsletterQuery>) -> Response {
    // Redirect feedback is private to the submission flow, even though it
    // deliberately contains neither an email address nor subscriber status.
    no_store(Html(page(query.status.as_deref())))
}

pub fn page(status: Option<&str>) -> String {
    let site_nav = nav::render(nav::Props {
        brand_icon_url: asset_url("favicon.svg"),
        global_search: global_search::render(global_search::Props {
            placeholder: "Search articles",
        }),
        search_toggle: render_nav_search_toggle(),
        theme_picker: theme_picker(),
        articles: nav::Articles::Link,
    });
    let mut assets = Head::new();
    assets.add_css("css/newsletter.css");
    assets.add(&site_nav);
    let mut scripts = Head::new();
    scripts.add_js("js/audio.js");
    scripts.add(&site_nav);
    let nav_markup = site_nav.markup;
    let signup = match status {
        Some("check-email") => confirmation(),
        Some("confirmed") => confirmed(),
        _ => signup_form(status),
    };

    let body = view! {
        { nav_markup }
        <main id="main" class="newsletter-shell" tabindex="-1">
            <div class="newsletter-intro">
                <p class="newsletter-eyebrow">
                    <span class="newsletter-pip" aria-hidden="true"></span>
                    "The ENGMANAGER newsletter"
                </p>
                <h1>"Keep a little"<br /><span>"perspective."</span></h1>
                <p class="newsletter-description">
                    "Leading a team is a practice. I write about the people, decisions, and small shifts that make it better."
                </p>
                <p class="newsletter-byline">
                    <span class="newsletter-byline-rule" aria-hidden="true"></span>
                    "Notes from Matthew Harwood"
                </p>
            </div>
            <section class="newsletter-card" aria-labelledby="newsletter-signup-title">
                <div class="newsletter-card-top" aria-hidden="true">
                    <span>"A note for your inbox"</span>
                    <svg viewBox="0 0 40 32" width="40" height="32" fill="none">
                        <rect x="2" y="3" width="36" height="26" rx="1" stroke="currentColor" stroke-width="1.5" />
                        <path d="m3 5 17 13L37 5M3 27l12-11m22 11L25 16" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                    </svg>
                </div>
                { signup }
            </section>
            <section class="newsletter-topics" aria-labelledby="newsletter-topics-title">
                <h2 id="newsletter-topics-title">"A few things we’ll think through"</h2>
                <div class="newsletter-topic-grid">
                    <div class="newsletter-topic">
                        <span class="newsletter-topic-number" aria-hidden="true">"01"</span>
                        <h3>"The people part"</h3>
                        <p>"Feedback, trust, and the conversations that help a team grow."</p>
                    </div>
                    <div class="newsletter-topic">
                        <span class="newsletter-topic-number" aria-hidden="true">"02"</span>
                        <h3>"The work itself"</h3>
                        <p>"Making decisions, creating focus, and shipping work that matters."</p>
                    </div>
                    <div class="newsletter-topic">
                        <span class="newsletter-topic-number" aria-hidden="true">"03"</span>
                        <h3>"Your way forward"</h3>
                        <p>"Finding your footing as a manager, and growing into what comes next."</p>
                    </div>
                </div>
            </section>
            <footer class="newsletter-footer">
                <span>"Curious before you subscribe?"</span>
                <a href="/feed" data-hard-nav>"Read the articles"<span aria-hidden="true">" ↗"</span></a>
            </footer>
        </main>
    };

    PageShell::new(TITLE, "newsletter-page")
        .meta(MetaTags {
            description: Some(DESCRIPTION.to_string()),
            canonical: Some(CANONICAL.to_string()),
            og_title: Some(TITLE.to_string()),
            og_type: Some("website"),
            og_url: Some(CANONICAL.to_string()),
            og_site_name: Some("ENGMANAGER.XYZ"),
            twitter_card: Some("summary"),
            ..MetaTags::default()
        })
        .assets(assets)
        .scripts(scripts)
        .nav_router(true)
        .render(body)
}

fn signup_form(status: Option<&str>) -> HtmlFragment {
    let feedback = match status {
        Some("invalid") => Some("Please enter a valid email address and try again."),
        Some("unavailable") => Some("Signups are taking a short break. Please try again later."),
        Some("error") => Some("We couldn’t complete your signup. Please try again in a moment."),
        _ => None,
    };
    let described_by = if feedback.is_some() {
        "newsletter-privacy newsletter-feedback"
    } else {
        "newsletter-privacy"
    };
    let feedback = feedback
        .map(|message| {
            view! {
                <p id="newsletter-feedback" class="newsletter-feedback" role="alert">{ message }</p>
            }
        })
        .unwrap_or_else(HtmlFragment::empty);

    view! {
        <h2 id="newsletter-signup-title">"Good questions."<br />"Useful notes."</h2>
        <p class="newsletter-card-description">"A little room to reflect on how you lead. Delivered occasionally, when there’s something worth sharing."</p>
        <form class="newsletter-form" method="post" action="/api/newsletter/subscribe">
            <label for="newsletter-email">"Your email address"</label>
            <input id="newsletter-email"
                   type="email"
                   name="email"
                   autocomplete="email"
                   inputmode="email"
                   autocapitalize="none"
                   spellcheck="false"
                   maxlength="254"
                   placeholder="you@example.com"
                   required
                   aria-invalid={ if status == Some("invalid") { "true" } else { "false" } }
                   aria-describedby={ described_by } />
            <div class="newsletter-honeypot" hidden aria-hidden="true">
                <label for="newsletter-website">"Leave this field empty"</label>
                <input id="newsletter-website" type="text" name="website" tabindex="-1" autocomplete="off" />
            </div>
            { feedback }
            <button type="submit">"Send me the notes"<span aria-hidden="true">"↗"</span></button>
            <p id="newsletter-privacy" class="newsletter-privacy">"Free to read. Unsubscribe whenever you like."</p>
        </form>
    }
}

fn confirmation() -> HtmlFragment {
    view! {
        <div class="newsletter-confirmation" role="status" aria-live="polite">
            <span class="newsletter-confirmation-mark" aria-hidden="true">"✓"</span>
            <h2 id="newsletter-signup-title">"Check your inbox."</h2>
            <p class="newsletter-card-description">"If your address needs confirming, you’ll receive an email shortly. Follow the link inside to finish signing up."</p>
            <p class="newsletter-confirmation-note">"Already subscribed? You’re all set. Thanks for reading."</p>
        </div>
        <a class="newsletter-reset" href="/subscribe" data-hard-nav>"Use another email address"<span aria-hidden="true">" ↗"</span></a>
    }
}

fn confirmed() -> HtmlFragment {
    view! {
        <div class="newsletter-confirmation" role="status" aria-live="polite">
            <span class="newsletter-confirmation-mark" aria-hidden="true">"✓"</span>
            <h2 id="newsletter-signup-title">"You’re on the list."</h2>
            <p class="newsletter-card-description">"Thanks for making a little room in your inbox. I’ll send you a note when there’s something worth sharing."</p>
            <p class="newsletter-confirmation-note">"Until then, there’s plenty to read."</p>
        </div>
        <a class="newsletter-reset" href="/feed" data-hard-nav>"Explore the articles"<span aria-hidden="true">" ↗"</span></a>
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signup_is_accessible_and_works_without_javascript() {
        let html = page(None);
        assert!(html.contains(r#"method="post" action="/api/newsletter/subscribe""#));
        assert!(html.contains(r#"<label for="newsletter-email">Your email address</label>"#));
        assert!(html.contains(r#"type="email" name="email" autocomplete="email""#));
        assert!(
            html.contains(r#"required aria-invalid="false" aria-describedby="newsletter-privacy""#)
        );
        assert!(html.contains(r#"class="newsletter-honeypot" hidden aria-hidden="true""#));
        assert!(html.contains(r#"name="website" tabindex="-1" autocomplete="off""#));
        assert!(html.contains(r#"<link rel="canonical" href="https://engmanager.xyz/subscribe""#));
        assert!(!html.contains(r#"name="first_name""#));
    }

    #[test]
    fn invalid_email_feedback_is_associated_with_the_field() {
        let html = page(Some("invalid"));
        assert!(html.contains(
            r#"aria-invalid="true" aria-describedby="newsletter-privacy newsletter-feedback""#
        ));
        assert!(
            html.contains(r#"id="newsletter-feedback" class="newsletter-feedback" role="alert""#)
        );
        assert!(html.contains("Please enter a valid email address"));
    }

    #[test]
    fn confirmation_does_not_claim_a_new_subscription_or_echo_query_content() {
        let html = page(Some("check-email"));
        assert!(html.contains("Check your inbox."));
        assert!(html.contains("If your address needs confirming"));
        assert!(html.contains("Already subscribed?"));
        assert!(!html.contains("newsletter-form"));
        let injected = page(Some("<script>alert('email@example.com')</script>"));
        assert!(!injected.contains("email@example.com"));
        assert!(!injected.contains("newsletter-feedback"));
    }

    #[test]
    fn provider_failure_states_keep_the_signup_retryable() {
        for status in ["unavailable", "error"] {
            let html = page(Some(status));
            assert!(html.contains(r#"role="alert""#));
            assert!(html.contains(r#"type="submit""#));
            assert!(!html.contains("disabled"));
            assert!(!html.contains("Check your inbox."));
        }
    }

    #[test]
    fn confirmed_redirect_has_a_clear_next_step_without_a_second_signup() {
        let html = page(Some("confirmed"));
        assert!(html.contains("You’re on the list."));
        assert!(html.contains("Explore the articles"));
        assert!(!html.contains("newsletter-form"));
        assert!(!html.contains("Check your inbox."));
    }
}
