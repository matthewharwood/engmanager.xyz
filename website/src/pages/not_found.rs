use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use eng_markup::html;

use super::{
    GOOGLE_FONTS_HREF, OPEN_PROPS_HREF, render_dev_meta, render_resource_hints, render_sitemap_link,
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
                </main>
            </body>
        </html>
    }
    .into_string()
}
