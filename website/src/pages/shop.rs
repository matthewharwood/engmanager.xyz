use axum::http::header;
use axum::response::{Html, IntoResponse, Response};
use eng_markup::html;

use crate::asset_url;

const SHOP_ORIGIN: &str = "https://shop.engmanager.xyz";
const SHOP_TITLE: &str = "Shop · ENGMANAGER.XYZ";
const SHOP_DESCRIPTION: &str = "Default storefront page for shop.engmanager.xyz.";
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
                <title>{ SHOP_TITLE }</title>
                <meta name="description" content=SHOP_DESCRIPTION />
                <meta name="robots" content="noindex,follow" />
                <link rel="canonical" href=SHOP_ORIGIN />
                <meta property="og:site_name" content="ENGMANAGER.XYZ" />
                <meta property="og:type" content="website" />
                <meta property="og:title" content=SHOP_TITLE />
                <meta property="og:description" content=SHOP_DESCRIPTION />
                <meta property="og:url" content=SHOP_ORIGIN />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content=SHOP_TITLE />
                <meta name="twitter:description" content=SHOP_DESCRIPTION />
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/shop.css") } />
                <meta name="theme-color" content="#e64553" />
            </head>
            <body class="shop-page">
                <main class="shop-shell" aria-labelledby="shop-title">
                    <p class="shop-kicker">"shop.engmanager.xyz"</p>
                    <h1 id="shop-title">"Shop"</h1>
                    <p class="shop-copy">"A lightweight storefront placeholder for ENGMANAGER.XYZ."</p>
                    <a class="shop-home" href="https://engmanager.xyz/">"Back to engmanager.xyz"</a>
                </main>
            </body>
        </html>
    }
    .into_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shop_page_uses_site_assets_and_preview_metadata() {
        let html = page();

        assert!(html.contains("<title>Shop · ENGMANAGER.XYZ</title>"));
        assert!(html.contains(r#"<meta name="robots" content="noindex,follow">"#));
        assert!(html.contains(r#"<link rel="canonical" href="https://shop.engmanager.xyz">"#));
        assert!(html.contains(r#"<meta property="og:type" content="website">"#));
        assert!(html.contains("/assets/css/critical."));
        assert!(html.contains("/assets/css/shop."));
        assert!(!html.contains("<style>"));
    }
}
