use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use eng_domain::HtmlFragment;
use eng_markup::view;

use super::render_theme_picker;
use super::shell::PageShell;
use crate::asset_url;
use crate::components::{Head, script_island};

pub async fn handler() -> Response {
    response()
}

pub fn response() -> Response {
    (StatusCode::NOT_FOUND, Html(page())).into_response()
}

fn page() -> String {
    let mut assets = Head::new();
    assets.add_css("css/not-found.css");

    let mut scripts = Head::new();
    scripts.add_js("js/audio.js");
    scripts.add_inline(render_wisp_404_assets());
    scripts.add_js("js/not-found.js");

    let body = view! {
        <main class="not-found-shell" aria-labelledby="not-found-title">
            <canvas class="not-found-stage"
                    data-404-stage
                    aria-hidden="true"></canvas>
            <div class="not-found-vignette" aria-hidden="true"></div>
            <div class="not-found-copy">
                <p class="not-found-kicker">"lost signal"</p>
                <h1 id="not-found-title">"404"</h1>
                <a class="not-found-home" href="/">"Back home"</a>
            </div>
            <div class="not-found-bouncer"
                 data-404-bouncer
                 aria-live="polite">
                "404 Page Not Found"
            </div>
            { render_theme_picker() }
        </main>
    };

    PageShell::new("404 Page Not Found · engmanager.xyz", "not-found-page")
        .pre_title_meta(view! { <meta name="robots" content="noindex,nofollow" /> })
        .assets(assets)
        .scripts(scripts)
        .theme_color("#11111b")
        .skip_link(None)
        .render(body)
}

fn render_wisp_404_assets() -> HtmlFragment {
    let js_url = asset_url("wisp-404/not-found-wisp.js");
    let wasm_url = asset_url("wisp-404/not-found-wisp_bg.wasm");
    let config = serde_json::json!({
        "js": &js_url,
        "wasm": &wasm_url,
    });

    let mut out = HtmlFragment::new(format!(
        r#"<link rel="modulepreload" href="{js_url}"><link rel="preload" as="fetch" type="application/wasm" href="{wasm_url}" crossorigin>"#
    ));
    out.push_fragment(script_island("__wisp404", &config.to_string()));
    out
}
