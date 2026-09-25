//! A separate document boundary for local personality assessments. This shell
//! deliberately does not load the blog's analytics, navigation, or CDN assets.

use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Redirect, Response};
use eng_domain::HtmlFragment;
use eng_markup::view;

pub const ARTICLE_PATH: &str = "/articles/big-personality";
/// Marks the rendered document as well as its canonical path, so a percent-
/// encoded article slug cannot bypass the response security boundary.
#[derive(Clone, Copy)]
pub struct PrivateDocument;
pub const STEPS: &[(&str, &str)] = &[
    ("prepare", "Before you begin"),
    ("test", "Your questionnaire"),
    ("review", "Review your answers"),
    ("report", "Your report"),
    ("share", "Choose what to share"),
    ("library", "Saved on this device"),
];

pub fn is_boundary(path: &str) -> bool {
    path == ARTICLE_PATH
        || path == "/personality"
        || path.starts_with("/personality/")
        || path.starts_with("/assets/personality/")
}

pub async fn redirect() -> Response {
    crate::http::no_store(Redirect::temporary("/personality/prepare"))
}

pub async fn page(Path(step): Path<String>) -> Response {
    let Some((route, label)) = STEPS.iter().find(|(route, _)| *route == step) else {
        return not_found();
    };
    crate::http::no_store(Html(render(
        route,
        label,
        view! {
            <section class="page-intro">
                <p class="eyebrow">"The Big Six-Seven"</p><h1>{ *label }</h1>
                <p>"Opening your private workspace…"</p>
                <noscript><p>"The questionnaire needs JavaScript to score and save answers on this device. You can still read the introduction and research without it."</p>
                    <a href=ARTICLE_PATH>"Read the introduction"</a>
                </noscript>
            </section>
        },
    )))
}

pub fn not_found() -> Response {
    crate::http::no_store((
        StatusCode::NOT_FOUND,
        Html(render(
            "not-found",
            "Page not found",
            view! {
                <section class="page-intro"><p class="eyebrow">"404"</p>
                    <h1>"This page is not in your questionnaire."</h1>
                    <p><a href="/personality/prepare">"Return to the beginning"</a></p>
                </section>
            },
        )),
    ))
}

pub async fn article() -> Response {
    let Some(markdown) = crate::content::article_markdown("big-personality") else {
        return crate::http::no_store(StatusCode::NOT_FOUND);
    };
    let mut html = String::new();
    pulldown_cmark::html::push_html(
        &mut html,
        pulldown_cmark::Parser::new_ext(&markdown, pulldown_cmark::Options::ENABLE_TABLES),
    );
    let mut response = Html(render("article", "Why understand yourself?", view! {
        <article class="personality-article prose">
            <p class="eyebrow">"A field guide to understanding yourself"</p>
            <h1>"The Big Six-Seven"</h1>
            <p class="lede">"Big Five personality + work interests + personal values"</p>
            <img class="article-hero" src="/assets/personality/v1/media/six-lenses-hero.png" alt="" width="1536" height="1024" loading="lazy" />
            { HtmlFragment::new(html) }
            <div class="actions"><a class="button primary" href="/personality/prepare">"Start with yourself →"</a>
                <a href="/personality/library">"Open your saved reports"</a></div>
        </article>
    })).into_response();
    response.extensions_mut().insert(PrivateDocument);
    response
}

fn render(route: &str, label: &str, content: HtmlFragment) -> String {
    let mut navigation = HtmlFragment::empty();
    navigation.push_fragment(view! {
        <a href=ARTICLE_PATH class="sidebar-link" data-route="article"><span class="nav-icon" aria-hidden="true">"○"</span><span class="nav-label">"The introduction"</span></a>
    });
    for (step, name) in STEPS {
        navigation.push_fragment(view! {
            <a href={ format!("/personality/{step}") } class="sidebar-link" data-route={ *step }><span class="nav-icon" aria-hidden="true">"○"</span><span class="nav-label">{ *name }</span></a>
        });
    }
    let canonical = if route == "article" {
        format!("https://engmanager.xyz{ARTICLE_PATH}")
    } else {
        format!("https://engmanager.xyz/personality/{route}")
    };
    let robots = if route == "article" {
        "index, follow"
    } else {
        "noindex, nofollow"
    };
    let title = format!("{label} · The Big Six-Seven");
    let description = "Understand your personality, work interests, and personal values. A local-first reflection tool for people building a career in tech.";
    let doc = view! {
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="referrer" content="no-referrer" />
                <meta name="description" content=description />
                <meta name="robots" content=robots />
                <meta name="theme-color" content="#f5f2eb" />
                <title>{ title }</title>
                <link rel="canonical" href={ canonical.clone() } />
                <meta property="og:title" content="The Big Six-Seven" />
                <meta property="og:description" content=description />
                <meta property="og:type" content="website" />
                <meta property="og:url" content=canonical />
                <meta property="og:image" content="https://engmanager.xyz/assets/og/article-big-personality.jpg" />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta name="twitter:card" content="summary_large_image" />
                <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
                <link rel="stylesheet" href="/assets/personality/v1/style.css" />
                <link rel="stylesheet" href="/assets/personality/v1/charts.css" />
                <link id="personality-presentation-style" rel="stylesheet" href="/assets/personality/v7/style.css" media="not all" />
                <script type="module" src="/assets/personality/v7/bootstrap.mjs"></script>
            </head>
            <body class="personality" data-personality-route=route>
                <a class="skip-link" href="#personality-app">"Skip to content"</a>
                <div class="personality-layout">
                    <aside id="personality-sidebar" class="personality-sidebar">
                        <a class="sidebar-brand" href=ARTICLE_PATH><span class="brand-mark">"6–7"</span><span class="brand-copy"><strong>"The Big Six-Seven"</strong><small>"A FIELD GUIDE TO YOURSELF"</small></span></a>
                        <p class="nav-group-label">"YOUR FIELD GUIDE"</p>
                        <nav aria-label="Your self-understanding journey">{ navigation }</nav>
                        <div class="sidebar-local"><strong>"On this device"</strong><p>"Your answers stay with you. No account needed."</p></div><a class="sidebar-return" href="/">"← ENG MANAGER"</a>
                    </aside>
                    <div class="personality-sheet">
                        <header class="personality-header">
                            <button id="sidebar-toggle" type="button" aria-expanded="true" aria-controls="personality-sidebar" aria-label="Toggle sidebar">"☰"</button>
                            <span id="page-crumb">{ label }</span>
                            <span id="save-status" role="status" aria-live="polite">{ if route == "article" { "No account needed" } else { "Opening local storage…" } }</span>
                        </header>
                        <main id="personality-app" tabindex="-1">{ content }</main>
                    </div>
                </div>
            </body>
        </html>
    };
    format!("<!DOCTYPE html>{}", doc.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_contains_only_local_assets_and_the_frontend_contract() {
        let html = render("prepare", "Before you begin", HtmlFragment::empty());
        for expected in [
            "data-personality-route=\"prepare\"",
            "id=\"personality-app\"",
            "id=\"personality-sidebar\"",
            "id=\"sidebar-toggle\"",
            "id=\"page-crumb\"",
            "id=\"save-status\"",
            "type=\"module\"",
            "/assets/personality/v7/bootstrap.mjs",
            "id=\"personality-presentation-style\"",
            "media=\"not all\"",
        ] {
            assert!(html.contains(expected), "missing {expected}");
        }
        for excluded in [
            "fonts.googleapis",
            "unpkg",
            "__engNav",
            "experiences.js",
            "speculationrules",
            "__rum",
            "onclick=",
        ] {
            assert!(!html.contains(excluded), "unexpected {excluded}");
        }
    }
}
