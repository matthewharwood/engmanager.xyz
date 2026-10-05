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
use crate::components::{Head, armillary, global_search, nav, sigil};
use crate::http::no_store;

const TITLE: &str = "The newsletter · ENGMANAGER.XYZ";
const DESCRIPTION: &str = "Free coaching notes from Matthew Harwood on workflow, developer tools, frameworks, community, engineering leadership, and more.";
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
            placeholder: "Search the site",
        }),
        search_toggle: render_nav_search_toggle(),
        theme_picker: theme_picker(),
    });
    let sculpture = armillary::render();
    let mut assets = Head::new();
    assets.add(&sculpture);
    assets.add_css("css/newsletter.css");
    assets.add(&site_nav);
    let mut scripts = Head::new();
    scripts.add_js("js/audio.js");
    scripts.add(&site_nav);
    scripts.add(&sculpture);
    let sculpture_markup = sculpture.markup;
    let nav_markup = site_nav.markup;
    let signup = match status {
        Some("check-email") => confirmation(),
        Some("confirmed") => confirmed(),
        _ => signup_form(status),
    };

    let body = view! {
        { nav_markup }
        <main id="main" class={ classes!("newsletter-shell") } tabindex="-1">
            <div class={ classes!("newsletter-content") }>
                <div class={ classes!("newsletter-intro") }>
                    <p class={ classes!("newsletter-eyebrow") }>
                        <span class={ classes!("newsletter-pip") } aria-hidden="true"></span>
                        "The ENGMANAGER newsletter · Free"
                    </p>
                    <h1>"Keep a little"<br /><span>"perspective."</span></h1>
                    <p class={ classes!("newsletter-description") }>
                        "Free coaching, in your inbox. I share what I’m learning about building things, leading teams, and finding your way at work."
                    </p>
                    <p class={ classes!("newsletter-byline") }>
                        "From Matthew Harwood · "<a href="mailto:matthew@engmanager.xyz">{ SENDER_EMAIL }</a>
                    </p>
                </div>
                <section class={ classes!("newsletter-card") } aria-labelledby="newsletter-signup-title">
                    { signup }
                </section>
                <p class={ classes!("newsletter-scope") }>
                    "We’ll cover workflow, developer tools, frameworks, community, engineering leadership, and essays. Plus whatever else helps us grow."
                </p>
            </div>
            <div class={ classes!("newsletter-cosmos") }>{ sculpture_markup }</div>
            <footer class={ classes!("newsletter-footer") }>
                <span>"Notes from Matthew Harwood. Sent when there’s something worth sharing."</span>
                <a href="/feed">"Read the articles"<span aria-hidden="true">" ↗"</span></a>
            </footer>
        </main>
    };

    PageShell::new(TITLE, classes!("newsletter-page"))
        .meta(MetaTags {
            description: Some(DESCRIPTION.to_string()),
            canonical: Some(CANONICAL.to_string()),
            og_title: Some(TITLE.to_string()),
            og_type: Some("website"),
            og_url: Some(CANONICAL.to_string()),
            og_site_name: Some("ENGMANAGER.XYZ"),
            og_image: Some(share_card("https://engmanager.xyz", DEFAULT_SHARE_CARD)),
            og_image_size: Some(SHARE_CARD_SIZE),
            og_image_alt: Some("ENG MANAGER — free coaching notes from Matthew Harwood on workflow, developer tools, frameworks, community, engineering leadership, and essays.".into()),
            twitter_card: Some("summary_large_image"),
            ..MetaTags::default()
        })
        .assets(assets)
        .scripts(scripts)
        .journey("subscribe", Some("/feed"))
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
                <p id="newsletter-feedback" class={ classes!("newsletter-feedback") } role="alert">{ message }</p>
            }
        })
        .unwrap_or_else(HtmlFragment::empty);

    view! {
        <h2 id="newsletter-signup-title" class={ classes!("sr-only") }>"Get the free coaching notes."</h2>
        <form class={ classes!("newsletter-form") } method="post" action="/api/newsletter/subscribe">
            <label for="newsletter-email">"Your email address"</label>
            <div class={ classes!("newsletter-form-controls") }>
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
                <button type="submit">"Send me the notes"<span aria-hidden="true">"↗"</span></button>
            </div>
            <div class={ classes!("newsletter-honeypot") } hidden aria-hidden="true">
                <label for="newsletter-website">"Leave this field empty"</label>
                <input id="newsletter-website" type="text" name="website" tabindex="-1" autocomplete="off" />
            </div>
            { feedback }
            <p id="newsletter-privacy" class={ classes!("newsletter-privacy") }>"Free to read. Unsubscribe whenever you like."<br /><a href=PRIVACY_PATH data-hard-nav>"How your newsletter data is used"</a></p>
        </form>
    }
}

fn confirmation() -> HtmlFragment {
    view! {
        <div class={ classes!("newsletter-confirmation") } role="status" aria-live="polite">
            <span class={ classes!("newsletter-confirmation-mark") } aria-hidden="true">"✓"</span>
            <h2 id="newsletter-signup-title">"Check your inbox."</h2>
            <p class={ classes!("newsletter-card-description") }>"If your address needs confirming, you’ll receive an email shortly. Follow the link inside to finish signing up."</p>
            <dl class={ classes!("newsletter-email-details") }>
                <dt>"From"</dt>
                <dd>{ SENDER_NAME }<br /><a href="mailto:matthew@engmanager.xyz">{ SENDER_EMAIL }</a></dd>
                <dt>"Subject"</dt>
                <dd>{ CONFIRMATION_SUBJECT }</dd>
            </dl>
            <p class={ classes!("newsletter-confirmation-note") }>"Already subscribed? You’re all set. Thanks for reading."</p>
        </div>
        <details class={ classes!("newsletter-inbox-help") }>
            <summary>"Can’t find the email?"</summary>
            <p>"Check Spam and Promotions. If it landed in Spam, mark it “Not spam.” In Gmail, you can move it to Primary if you’d prefer your notes there."</p>
            <p>"Need a hand? "<a href="mailto:matthew@engmanager.xyz">"Email Matthew"</a>"."</p>
        </details>
        <a class={ classes!("newsletter-reset") } href="/subscribe" data-hard-nav>"Use another email address"<span aria-hidden="true">" ↗"</span></a>
    }
}

fn confirmed() -> HtmlFragment {
    view! {
        <div class={ classes!("newsletter-confirmation") } role="status" aria-live="polite">
            <span class={ classes!("newsletter-confirmation-mark") } aria-hidden="true">"✓"</span>
            <h2 id="newsletter-signup-title">"You’re on the list."</h2>
            <p class={ classes!("newsletter-card-description") }>"Thanks for making a little room in your inbox. I’ll send you a note when there’s something worth sharing."</p>
            <p class={ classes!("newsletter-confirmation-note") }>"Until then, there’s plenty to read."</p>
        </div>
        <a class={ classes!("newsletter-reset") } href="/feed">"Explore the articles"<span aria-hidden="true">" ↗"</span></a>
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
            placeholder: "Search the site",
        }),
        search_toggle: render_nav_search_toggle(),
        theme_picker: theme_picker(),
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
        <main id="main" class={ classes!("newsletter-document") } tabindex="-1">
            <p class={ classes!("newsletter-eyebrow") }>"The ENGMANAGER newsletter"</p>
            <h1>"Newsletter privacy."</h1>
            <p class={ classes!("newsletter-document-intro") }>"A note on the information used to send you these notes, and how to manage it."</p>
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
            <p class={ classes!("newsletter-document-scope") }>"This notice covers the ENGMANAGER newsletter signup and email delivery."</p>
            <a class={ classes!("newsletter-reset") } href="/feed" data-hard-nav>"Back to the articles"<span aria-hidden="true">" ↗"</span></a>
        </main>
    };

    PageShell::new(title, classes!("newsletter-page"))
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
                <form class={ classes!("newsletter-form newsletter-unsubscribe-form") } method="post" action="/api/newsletter/unsubscribe" data-unsubscribe-form>
                    <input type="hidden" name="token" value={ token } />
                    <noscript><p class={ classes!("newsletter-confirmation-note") }>"Select Unsubscribe below to stop future newsletters."</p></noscript>
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
    // A plain clean preferences link remains usable with unavailable assets or
    // JavaScript. Recovery never observes a bearer URL or replays a POST result.
    let document = view! {
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow" />
                <meta name="referrer" content="no-referrer" />
                { super::shell::css_generation_meta() }
                <title>"Newsletter preferences · ENGMANAGER.XYZ"</title>
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/newsletter.css") } />
                <link rel="stylesheet" href={ asset_url(sigil::STYLE) } />
                { script }
                <script src={ asset_url(sigil::SCRIPT) } defer></script>
            </head>
            <body class={ classes!("newsletter-page newsletter-preferences-page identity-page") }>
                <a class={ classes!("skip-link") } href="#main">"Skip to content"</a>
                <header class={ classes!("preferences-header") }>
                    <a class={ classes!("identity-wordmark") } href="/" aria-label="ENGMANAGER home">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 10 18H2Z" stroke="currentColor" /><path d="M7 14q5-6 10 0-5 5-10 0Z" stroke="currentColor" /><circle cx="12" cy="14" r="1.5" fill="currentColor" /></svg>
                        "ENGMANAGER"
                    </a>
                </header>
                <main id="main" class={ classes!("newsletter-document newsletter-preferences") } tabindex="-1" data-unsubscribe-state={ state }>
                    <div class={ classes!("preferences-copy") }>
                    <p class={ classes!("newsletter-eyebrow") }>"Newsletter preferences"</p>
                    <span class={ classes!("newsletter-preferences-mark") } aria-hidden="true" data-unsubscribe-mark>{ if state == "success" { "✓" } else { "—" } }</span>
                    <h1 data-unsubscribe-heading>{ heading }</h1>
                    <p class={ classes!("newsletter-document-intro") } role="status" aria-live="polite" data-unsubscribe-message>{ message }</p>
                    { form }
                    <p class={ classes!("newsletter-preferences-contact") }>"Need help? "<a href="mailto:matthew@engmanager.xyz?subject=Newsletter%20unsubscribe">"Email Matthew"</a>"."</p>
                    <a class={ classes!("newsletter-reset") } href="/newsletter/privacy">"Newsletter privacy"</a>
                    <span data-css-asset-recovery><a class={ classes!("newsletter-reset") } href="/unsubscribe">"Open newsletter preferences"</a></span>
                    </div>
                    <div class={ classes!("preferences-art") }>
                        { sculpture_markup }
                        <p class={ classes!("preferences-art-caption") } aria-hidden="true">"A little space. A little perspective."</p>
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
    fn unsubscribe_documents_share_generated_styles_without_automatic_replay() {
        let token = format!("v1.42.{}", "a".repeat(64));
        for html in [
            unsubscribe_page(None),
            unsubscribe_page(Some(&token)),
            unsubscribe_page(Some("invalid")),
            unsubscribe_result(true),
            unsubscribe_result(false),
        ] {
            let generation = format!(
                "<meta name=\"eng-css-generation\" content=\"{}\">",
                crate::CSS_GENERATION
            );
            let first_stylesheet = html.find("/assets/css/critical.").unwrap();
            assert!(html.find(&generation).unwrap() < first_stylesheet);
            assert!(html.contains("data-css-asset-recovery"));
            assert!(html.contains("href=\"/unsubscribe\">Open newsletter preferences</a>"));
            for forbidden in [
                "__engNav",
                "__rum",
                "experiences.js",
                "<script>",
                "/assets/css-generation-recovery.js",
                "eng-css-recovery",
            ] {
                assert!(!html.contains(forbidden));
            }
        }
    }

    #[test]
    fn signup_is_accessible_and_works_without_javascript() {
        let html = page(None);
        assert!(html.contains(r#"method="post" action="/api/newsletter/subscribe""#));
        assert!(html.contains(r#"<label for="newsletter-email">Your email address</label>"#));
        assert!(html.contains(r#"type="email" name="email" autocomplete="email""#));
        assert!(
            html.contains(r#"required aria-invalid="false" aria-describedby="newsletter-privacy""#)
        );
        assert!(html.contains(css_html!(
            r#"class="newsletter-honeypot" hidden aria-hidden="true""#
        )));
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
        assert!(html.contains(css_html!(
            r#"id="newsletter-feedback" class="newsletter-feedback" role="alert""#
        )));
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
