use axum::http::header;
use axum::response::{Html, IntoResponse, Response};
use eng_markup::html;

use crate::asset_url;

const SHOP_CACHE_CONTROL: &str =
    "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

pub async fn index() -> Response {
    ([(header::CACHE_CONTROL, SHOP_CACHE_CONTROL)], Html(page())).into_response()
}

fn page() -> String {
    html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>"Hello world - shop.engmanager.xyz"</title>
                <meta name="description" content="Hello world from shop.engmanager.xyz." />
                <link rel="canonical" href="https://shop.engmanager.xyz/" />
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                <style>
                    "
                    :root {
                        color-scheme: light dark;
                        --ink: #11111b;
                        --paper: #f7f3ea;
                        --accent: #e64553;
                        --shadow: #11111b;
                    }

                    @media (prefers-color-scheme: dark) {
                        :root {
                            --ink: #f7f3ea;
                            --paper: #11111b;
                            --accent: #89b4fa;
                            --shadow: #f7f3ea;
                        }
                    }

                    * {
                        box-sizing: border-box;
                    }

                    html {
                        min-height: 100%;
                        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        background:
                            linear-gradient(135deg, color-mix(in srgb, var(--accent), transparent 76%), transparent 42%),
                            var(--paper);
                        color: var(--ink);
                    }

                    body {
                        min-height: 100svh;
                        margin: 0;
                        display: grid;
                        place-items: center;
                        padding: clamp(1rem, 5vw, 4rem);
                    }

                    main {
                        width: min(100%, 42rem);
                        border: 2px solid currentColor;
                        background: color-mix(in srgb, var(--paper), white 8%);
                        box-shadow: clamp(0.5rem, 2vw, 1rem) clamp(0.5rem, 2vw, 1rem) 0 var(--shadow);
                        padding: clamp(1.25rem, 6vw, 3rem);
                    }

                    p {
                        margin: 0 0 0.75rem;
                        font-size: clamp(0.8rem, 2vw, 0.95rem);
                        font-weight: 800;
                        letter-spacing: 0.12em;
                        text-transform: uppercase;
                    }

                    h1 {
                        margin: 0;
                        font-size: clamp(3rem, 18vw, 9rem);
                        line-height: 0.9;
                        letter-spacing: 0;
                        text-transform: uppercase;
                    }
                    "
                </style>
            </head>
            <body>
                <main>
                    <p>"shop.engmanager.xyz"</p>
                    <h1>"Hello world"</h1>
                </main>
            </body>
        </html>
    }
    .into_string()
}
