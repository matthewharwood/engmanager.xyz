use axum::extract::Query;
use axum::response::{Html, Response};
use eng_domain::HtmlFragment;
use eng_markup::view;
use serde::Deserialize;

use super::render_nav_search_toggle;
use super::shell::{MetaTags, PageShell};
use super::{DEFAULT_SHARE_CARD, SHARE_CARD_SIZE, share_card};
use crate::asset_url;
use crate::components::quick_actions::theme_picker;
use crate::components::{Head, global_search, nav, sigil};
use crate::http::no_store;

const TITLE: &str = "The newsletter · ENGMANAGER.XYZ";
const DESCRIPTION: &str = "Occasional notes from Matthew Harwood on engineering leadership, building thoughtful teams, and finding your way as a manager.";
const CANONICAL: &str = "https://engmanager.xyz/subscribe";
const SENDER_EMAIL: &str = "matthew@engmanager.xyz";
const SENDER_NAME: &str = "Matthew Harwood · ENGMANAGER";
const CONFIRMATION_SUBJECT: &str = "Confirm your ENGMANAGER newsletter subscription";
const PRIVACY_PATH: &str = "/newsletter/privacy";

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
            og_image: Some(share_card("https://engmanager.xyz", DEFAULT_SHARE_CARD)),
            og_image_size: Some(SHARE_CARD_SIZE),
            og_image_alt: Some("ENG MANAGER — occasional notes from Matthew Harwood on engineering leadership, design systems, developer tooling, and building thoughtful teams.".into()),
            twitter_card: Some("summary_large_image"),
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
        <p class="newsletter-sender">"From Matthew Harwood at "<a href="mailto:matthew@engmanager.xyz">{ SENDER_EMAIL }</a>"."</p>
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
            <p id="newsletter-privacy" class="newsletter-privacy">"Free to read. Unsubscribe whenever you like."<br /><a href=PRIVACY_PATH data-hard-nav>"How your newsletter data is used"</a></p>
        </form>
    }
}

fn confirmation() -> HtmlFragment {
    view! {
        <div class="newsletter-confirmation" role="status" aria-live="polite">
            <span class="newsletter-confirmation-mark" aria-hidden="true">"✓"</span>
            <h2 id="newsletter-signup-title">"Check your inbox."</h2>
            <p class="newsletter-card-description">"If your address needs confirming, you’ll receive an email shortly. Follow the link inside to finish signing up."</p>
            <dl class="newsletter-email-details">
                <dt>"From"</dt>
                <dd>{ SENDER_NAME }<br /><a href="mailto:matthew@engmanager.xyz">{ SENDER_EMAIL }</a></dd>
                <dt>"Subject"</dt>
                <dd>{ CONFIRMATION_SUBJECT }</dd>
            </dl>
            <p class="newsletter-confirmation-note">"Already subscribed? You’re all set. Thanks for reading."</p>
        </div>
        <details class="newsletter-inbox-help">
            <summary>"Can’t find the email?"</summary>
            <p>"Check Spam and Promotions. If it landed in Spam, mark it “Not spam.” In Gmail, you can move it to Primary if you’d prefer your notes there."</p>
            <p>"Need a hand? "<a href="mailto:matthew@engmanager.xyz">"Email Matthew"</a>"."</p>
        </details>
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

pub async fn privacy() -> Response {
    no_store(Html(privacy_page()))
}

pub fn privacy_page() -> String {
    let title = "Newsletter privacy · ENGMANAGER.XYZ";
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

    let body = view! {
        { nav_markup }
        <main id="main" class="newsletter-document" tabindex="-1">
            <p class="newsletter-eyebrow">"The ENGMANAGER newsletter"</p>
            <h1>"Newsletter privacy."</h1>
            <p class="newsletter-document-intro">"A note on the information used to send you these notes, and how to manage it."</p>
            <section aria-labelledby="newsletter-data-heading">
                <h2 id="newsletter-data-heading">"When you subscribe"</h2>
                <p>"The signup form asks for your email address. This website passes it to Kit, the service Matthew Harwood uses to manage newsletter subscriptions and send emails. Kit records whether your subscription is unconfirmed, confirmed, or unsubscribed."</p>
                <p>"Your email address and subscription status are used to send the confirmation email, deliver the newsletter you requested, and honor your subscription preferences."</p>
            </section>
            <section aria-labelledby="newsletter-provider-heading">
                <h2 id="newsletter-provider-heading">"Email delivery records"</h2>
                <p>"Kit keeps subscriber and email history and may record delivery, open, and link-click activity. This helps understand how the newsletter is delivered and read. Its handling of newsletter subscriber information is described in "<a href="https://kit.com/dpa" rel="noopener">"Kit’s data processing terms"</a>"."</p>
            </section>
            <section aria-labelledby="newsletter-leave-heading">
                <h2 id="newsletter-leave-heading">"When you unsubscribe"</h2>
                <p>"Use the unsubscribe link in a newsletter email to stop future newsletters. Unsubscribing keeps a record of your preference in Kit; it does not automatically delete your subscriber profile or email history."</p>
            </section>
            <section aria-labelledby="newsletter-contact-heading">
                <h2 id="newsletter-contact-heading">"Questions or data requests"</h2>
                <p>"For help with your subscription, or to request access, a correction, or deletion of newsletter information, email "<a href="mailto:matthew@engmanager.xyz">{ SENDER_EMAIL }</a>"."</p>
            </section>
            <p class="newsletter-document-scope">"This notice covers the ENGMANAGER newsletter signup and email delivery."</p>
            <a class="newsletter-reset" href="/feed" data-hard-nav>"Back to the articles"<span aria-hidden="true">" ↗"</span></a>
        </main>
    };

    PageShell::new(title, "newsletter-page")
        .meta(MetaTags {
            description: Some("How newsletter signup information is used, and how to unsubscribe or request help with your data.".to_string()),
            canonical: Some(format!("https://engmanager.xyz{PRIVACY_PATH}")),
            ..MetaTags::default()
        })
        .assets(assets)
        .scripts(scripts)
        .nav_router(true)
        .render(body)
}

#[derive(Debug, Default, Deserialize)]
pub struct UnsubscribeQuery {
    pub token: Option<String>,
}

pub async fn unsubscribe(Query(query): Query<UnsubscribeQuery>) -> Response {
    no_store(Html(unsubscribe_page(query.token.as_deref())))
}

/// Loading the link is inert. The dedicated script submits a POST when the
/// page opens; without scripting, the same form remains a normal POST.
pub fn unsubscribe_page(token: Option<&str>) -> String {
    let token = token.filter(|value| {
        if value.len() > 88 || !value.is_ascii() {
            return false;
        }
        let mut parts = value.split('.');
        let (Some("v1"), Some(subscriber_id), Some(signature), None) =
            (parts.next(), parts.next(), parts.next(), parts.next())
        else {
            return false;
        };
        subscriber_id.parse::<u64>().is_ok_and(|id| id > 0)
            && signature.len() == 64
            && signature.bytes().all(|byte| byte.is_ascii_hexdigit())
    });
    let (heading, message, state, form) = if let Some(token) = token {
        (
            "Unsubscribing…",
            "Please wait a moment while your newsletter preference is updated.",
            "processing",
            view! {
                <form class="newsletter-form newsletter-unsubscribe-form" method="post" action="/api/newsletter/unsubscribe" data-unsubscribe-form>
                    <input type="hidden" name="token" value={ token } />
                    <noscript><p class="newsletter-confirmation-note">"Select Unsubscribe below to stop future newsletters."</p></noscript>
                    <button type="submit" data-unsubscribe-submit>"Unsubscribe"</button>
                </form>
            },
        )
    } else {
        (
            "This link isn’t valid.",
            "Open the unsubscribe link in a newsletter email. If you need help, contact Matthew below.",
            "invalid",
            HtmlFragment::empty(),
        )
    };
    unsubscribe_document(heading, message, state, form, token.is_some())
}

/// Native POST responses render the same quiet result without requiring JS.
pub fn unsubscribe_result(success: bool) -> String {
    let (heading, message, state) = if success {
        (
            "You’re unsubscribed.",
            "Your ENGMANAGER newsletter subscription is turned off. You can close this page.",
            "success",
        )
    } else {
        (
            "We couldn’t confirm the change.",
            "Please open the unsubscribe link in your email to try again, or contact Matthew below for help.",
            "error",
        )
    };
    unsubscribe_document(heading, message, state, HtmlFragment::empty(), false)
}

fn unsubscribe_document(
    heading: &str,
    message: &str,
    state: &str,
    form: HtmlFragment,
    has_script: bool,
) -> String {
    let sculpture = sigil::render(true);
    let sculpture_markup = sculpture.markup;
    let script = if has_script {
        view! { <script src={ asset_url("js/newsletter-unsubscribe.js") } defer></script> }
    } else {
        HtmlFragment::empty()
    };
    // This token-bearing surface intentionally omits the regular page shell:
    // no navigation router, external resource hints, analytics, or theme
    // runtime can observe the URL. The decorative local renderer is independent
    // of the POST script and does not access URLs, forms, or subscriber state.
    let document = view! {
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow" />
                <meta name="referrer" content="no-referrer" />
                <title>"Newsletter preferences · ENGMANAGER.XYZ"</title>
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/newsletter.css") } />
                <link rel="stylesheet" href={ asset_url(sigil::STYLE) } />
                { script }
                <script src={ asset_url(sigil::SCRIPT) } defer></script>
            </head>
            <body class="newsletter-page newsletter-preferences-page identity-page">
                <a class="skip-link" href="#main">"Skip to content"</a>
                <header class="preferences-header">
                    <a class="identity-wordmark" href="/" aria-label="ENGMANAGER home">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 10 18H2Z" stroke="currentColor" /><path d="M7 14q5-6 10 0-5 5-10 0Z" stroke="currentColor" /><circle cx="12" cy="14" r="1.5" fill="currentColor" /></svg>
                        "ENGMANAGER"
                    </a>
                </header>
                <main id="main" class="newsletter-document newsletter-preferences" tabindex="-1" data-unsubscribe-state={ state }>
                    <div class="preferences-copy">
                    <p class="newsletter-eyebrow">"Newsletter preferences"</p>
                    <span class="newsletter-preferences-mark" aria-hidden="true" data-unsubscribe-mark>{ if state == "success" { "✓" } else { "—" } }</span>
                    <h1 data-unsubscribe-heading>{ heading }</h1>
                    <p class="newsletter-document-intro" role="status" aria-live="polite" data-unsubscribe-message>{ message }</p>
                    { form }
                    <p class="newsletter-preferences-contact">"Need help? "<a href="mailto:matthew@engmanager.xyz?subject=Newsletter%20unsubscribe">"Email Matthew"</a>"."</p>
                    <a class="newsletter-reset" href="/newsletter/privacy">"Newsletter privacy"</a>
                    </div>
                    <div class="preferences-art">
                        { sculpture_markup }
                        <p class="preferences-art-caption" aria-hidden="true">"A little space. A little perspective."</p>
                    </div>
                </main>
            </body>
        </html>
    };
    format!("<!DOCTYPE html>{}", document.as_str())
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
