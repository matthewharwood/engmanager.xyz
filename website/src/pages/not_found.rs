use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use eng_domain::HtmlFragment;
use eng_markup::html;

use super::{
    GOOGLE_FONTS_HREF, OPEN_PROPS_HREF, render_dev_meta, render_resource_hints, render_sfx_urls,
    render_sitemap_link, render_theme_picker,
};
use crate::asset_url;

pub async fn handler() -> Response {
    response()
}

pub fn response() -> Response {
    (StatusCode::NOT_FOUND, Html(page())).into_response()
}

fn page() -> String {
    html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow" />
                <title>"404 Page Not Found · engmanager.xyz"</title>
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                { render_sitemap_link() }
                { render_resource_hints() }
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/not-found.css") } />
                <script src={ asset_url("js/theme-toggle.js") }></script>
                { render_sfx_urls() }
                <script src={ asset_url("js/audio.js") } defer></script>
                { render_wisp_404_assets() }
                <script src={ asset_url("js/not-found.js") } defer></script>
                <link rel="manifest" href={ asset_url("manifest.webmanifest") } />
                <meta name="theme-color" content="#11111b" />
                { render_dev_meta() }
            </head>
            <body class="not-found-page">
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
            </body>
        </html>
    }
    .into_string()
}

fn render_wisp_404_assets() -> HtmlFragment {
    let js_url = asset_url("wisp-404/not-found-wisp.js");
    let wasm_url = asset_url("wisp-404/not-found-wisp_bg.wasm");
    let config = serde_json::json!({
        "js": &js_url,
        "wasm": &wasm_url,
    });

    HtmlFragment::new(format!(
        r#"<link rel="modulepreload" href="{js_url}"><link rel="preload" as="fetch" type="application/wasm" href="{wasm_url}" crossorigin><script>window.__wisp404={config};</script>"#
    ))
}
