use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use eng_markup::view;

use super::shell::PageShell;
use crate::components::quick_actions::theme_picker;
use crate::components::{Head, sigil};

pub async fn handler() -> Response {
    response()
}

pub fn response() -> Response {
    (StatusCode::NOT_FOUND, Html(page())).into_response()
}

fn page() -> String {
    let sculpture = sigil::render(false);
    let mut assets = Head::new();
    assets.add(&sculpture);
    assets.add_css("css/not-found.css");
    let mut scripts = Head::new();
    scripts.add_js("js/audio.js");
    scripts.add(&sculpture);
    let sculpture_markup = sculpture.markup;
    let body = view! {
        <main class="not-found-shell" aria-labelledby="not-found-title">
            <header class="not-found-header">
                <a class="identity-wordmark" href="/" aria-label="ENGMANAGER home">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 10 18H2Z" stroke="currentColor" /><path d="M7 14q5-6 10 0-5 5-10 0Z" stroke="currentColor" /><circle cx="12" cy="14" r="1.5" fill="currentColor" /></svg>
                    "ENGMANAGER"
                </a>
                <span class="not-found-header-note">"A change in perspective"</span>
            </header>
            <div class="not-found-copy">
                <p class="not-found-kicker">"You’ve wandered off the map"</p>
                <h1 id="not-found-title">"404"<span class="sr-only">" · Page not found"</span></h1>
                <h2>"Even a good eye"<br />"can lose its way."</h2>
                <p class="not-found-description">"The page you’re looking for isn’t here. Let’s find a familiar place."</p>
                <a class="not-found-home" href="/">"Back home"<span aria-hidden="true">"↗"</span></a>
            </div>
            <div class="not-found-art">{ sculpture_markup }</div>
            <footer class="not-found-footer"><span>"404 / Page not found"</span><span>"A little perspective changes everything."</span></footer>
            { theme_picker() }
        </main>
    };
    PageShell::new(
        "404 Page Not Found · engmanager.xyz",
        "not-found-page identity-page",
    )
    .pre_title_meta(view! { <meta name="robots" content="noindex,nofollow" /> })
    .assets(assets)
    .scripts(scripts)
    .theme_color("#eee9df")
    .skip_link(None)
    .render(body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_page_keeps_status_navigation_and_static_art() {
        assert_eq!(response().status(), StatusCode::NOT_FOUND);
        let html = page();
        assert!(html.contains("Page not found"));
        assert!(html.contains("class=\"not-found-home\" href=\"/\""));
        assert!(html.contains("sigil-poster"));
        assert!(html.contains("data-sigil-quiet=\"false\""));
        assert!(!html.contains("__wisp404"));
        assert!(!html.contains("data-404-bouncer"));
    }
}
