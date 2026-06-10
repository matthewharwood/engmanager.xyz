use axum::extract::State;
use axum::http::header;
use axum::response::{Html, IntoResponse, Response};
use eng_domain::HtmlFragment;
use eng_markup::{html, view};
use serde_json::json;

use super::{
    GOOGLE_FONTS_HREF, OPEN_PROPS_HREF, render_dev_meta, render_resource_hints, render_sfx_urls,
    render_sitemap_link, render_theme_picker,
};
use crate::catalog::{CAP_VIEWS, SHOP_PRODUCTS, ShopProduct, product_image_url};
use crate::{AppState, asset_url};

const SHOP_ORIGIN: &str = "https://shop.engmanager.xyz";
const STORE_ORIGIN: &str = "https://store.engmanager.xyz";
const SHOP_TITLE: &str = "Store · ENGMANAGER.XYZ";
const SHOP_DESCRIPTION: &str =
    "Embroidered dad-cap concepts for engineering managers, scrum rituals, and shipped work.";
const SHOP_CACHE_CONTROL: &str =
    "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

// One custom chevron for every nav/pagination arrow — points left at rest and is
// rotated per direction in CSS, so back / prev / next / up / down all share the
// exact same icon. pathLength="1" normalizes the stroke so a 0..1 dash offset
// "draws" it in (the native take on anime.js's path animation).
const CHEVRON_SVG: &str = r##"<svg class="shop-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="shop-chevron-path" d="M10.5 3.5 L5.5 8 L10.5 12.5" pathLength="1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>"##;

fn chevron() -> HtmlFragment {
    HtmlFragment::new(CHEVRON_SVG.to_string())
}

// Close (X) + plus glyphs in the same stroked language as the chevron — same
// viewBox, weight, round caps, and pathLength normalization (so they draw-in
// on hover/focus exactly like the arrows).
const X_SVG: &str = r##"<svg class="shop-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="shop-chevron-path" d="M5 5 L11 11 M11 5 L5 11" pathLength="1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>"##;

fn x_icon() -> HtmlFragment {
    HtmlFragment::new(X_SVG.to_string())
}

const PLUS_SVG: &str = r##"<svg class="shop-chevron shop-plus-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="shop-chevron-path" d="M8 3.5 V12.5 M3.5 8 H12.5" pathLength="1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>"##;

fn plus_icon() -> HtmlFragment {
    HtmlFragment::new(PLUS_SVG.to_string())
}

pub async fn index(State(state): State<AppState>) -> Response {
    (
        [(header::CACHE_CONTROL, SHOP_CACHE_CONTROL)],
        Html(page(&state.stripe)),
    )
        .into_response()
}

pub fn supports_path(path: &str) -> bool {
    path == "/" || path.starts_with("/products/")
}

fn page(checkout: &crate::stripe::Checkout) -> String {
    let products = render_product_grid();
    // One island for the catalog + the Stripe publishable key, so the inline
    // checkout (in the bag drawer) can mount Elements without a page load.
    let data = HtmlFragment::new(format!(
        "window.__shopProducts={};window.__checkout={};",
        product_data_json(),
        json!({
            "publishableKey": checkout.publishable_key(),
            "enabled": checkout.is_enabled(),
            "currency": "usd",
            "returnPath": "/",
        }),
    ));

    html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{ SHOP_TITLE }</title>
                <meta name="description" content=SHOP_DESCRIPTION />
                <meta name="robots" content="noindex,follow" />
                <link rel="canonical" href=STORE_ORIGIN />
                <link rel="alternate" href=SHOP_ORIGIN />
                <meta property="og:site_name" content="ENGMANAGER.XYZ" />
                <meta property="og:type" content="website" />
                <meta property="og:title" content=SHOP_TITLE />
                <meta property="og:description" content=SHOP_DESCRIPTION />
                <meta property="og:url" content=STORE_ORIGIN />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content=SHOP_TITLE />
                <meta name="twitter:description" content=SHOP_DESCRIPTION />
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                { render_sitemap_link() }
                { render_resource_hints() }
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/shop.css") } />
                <script src={ asset_url("js/theme-toggle.js") }></script>
                { render_sfx_urls() }
                <script>{ data }</script>
                <link rel="preconnect" href="https://js.stripe.com" crossorigin />
                <link rel="preconnect" href="https://api.stripe.com" crossorigin />
                <script src="https://js.stripe.com/v3" defer></script>
                <script src={ asset_url("js/audio.js") } defer></script>
                <script src={ asset_url("js/shop.js") } defer></script>
                <link rel="manifest" href={ asset_url("manifest.webmanifest") } />
                <meta name="theme-color" content="#e64553" />
                { render_dev_meta() }
            </head>
            <body class="shop-page">
                <a class="skip-link" href="#main">"Skip to caps"</a>
                <header class="shop-topbar" aria-label="Store controls">
                    <a class="shop-home-link"
                       href="https://engmanager.xyz/"
                       aria-label="Back to ENGMANAGER.XYZ">
                        { chevron() }
                    </a>
                    { render_theme_picker() }
                    <div class="shop-top-actions">
                        <button class="shop-cart-button"
                                type="button"
                                data-cart-toggle
                                aria-label="Open cart"
                                aria-expanded="false">
                            <span class="shop-cart-icon" aria-hidden="true"></span>
                            <span class="shop-cart-count" data-cart-count>"0"</span>
                        </button>
                    </div>
                </header>
                <main id="main" class="shop-shell">
                    <h1 id="shop-title" class="sr-only">"Dad Caps"</h1>
                    <section class="shop-grid" data-shop-grid aria-label="Dad cap products">
                        { products }
                    </section>
                </main>
                { render_product_panel() }
                { render_bag() }
                <div class="shop-backdrop" data-shop-backdrop hidden></div>
            </body>
        </html>
    }
    .into_string()
}

fn render_product_grid() -> HtmlFragment {
    SHOP_PRODUCTS.iter().map(render_product_card).collect()
}

fn render_product_card(product: &ShopProduct) -> HtmlFragment {
    let href = format!("/products/{}?image=front", product.slug);
    let price = product.price.label();
    let image = product_image_url(product, &CAP_VIEWS[0]);
    let alt = format!("{} embroidered dad cap front view", product.name);

    view! {
        <a class="shop-card"
           href={ href }
           data-product-card={ product.slug }
           data-slug={ product.slug }
           aria-label={ format!("Open {}", product.name) }>
            <span class="shop-card-figure">
                <img src={ image }
                     alt={ alt }
                     width="900"
                     height="1100"
                     loading="lazy"
                     decoding="async" />
            </span>
            <span class="shop-card-meta">
                <span class="shop-card-name">{ product.name }</span>
                <span class="shop-card-price">{ price }</span>
            </span>
            <span class="shop-card-colors" aria-label="Cap colors">
                <span style={ format!("--swatch: {}", product.cap_color) }></span>
                <span style={ format!("--swatch: {}", product.thread_color) }></span>
                <span style={ format!("--swatch: {}", product.accent_color) }></span>
            </span>
        </a>
    }
}

fn render_product_panel() -> HtmlFragment {
    view! {
    <aside class="shop-product-panel"
           data-product-panel
           role="dialog"
           aria-modal="true"
           aria-labelledby="shop-product-title"
           aria-hidden="true"
           tabindex="-1"
           hidden>
        <div class="shop-product-frame">
            <header class="shop-panel-head">
                <button class="shop-icon-button"
                        type="button"
                        data-close-product
                        aria-label="Close product">
                    { x_icon() }
                </button>
                { render_theme_picker() }
                <button class="shop-cart-button"
                        type="button"
                        data-cart-toggle
                        aria-label="Open cart"
                        aria-expanded="false">
                    <span class="shop-cart-icon" aria-hidden="true"></span>
                    <span class="shop-cart-count" data-cart-count>"0"</span>
                </button>
                <h2 id="shop-product-title" class="sr-only" data-product-title>"Select a cap"</h2>
            </header>
            <div class="shop-product-layout">
                <section class="shop-carousel" aria-label="Product images">
                    <button class="shop-carousel-button shop-carousel-prev"
                            type="button"
                            data-image-prev
                            aria-label="Previous product image">
                        { chevron() }
                    </button>
                    <figure class="shop-carousel-stage">
                        <button class="shop-image-advance"
                                type="button"
                                data-image-advance
                                aria-label="Next product image">
                            <div class="shop-carousel-track" data-carousel-track>
                                <img class="shop-carousel-cell" data-cell="prev" alt="" width="900" height="1100" decoding="async" />
                                <img class="shop-carousel-cell"
                                     data-product-image
                                     data-cell="main"
                                     src=""
                                     alt=""
                                     width="900"
                                     height="1100"
                                     decoding="async" />
                                <img class="shop-carousel-cell" data-cell="next" alt="" width="900" height="1100" decoding="async" />
                            </div>
                        </button>
                        <figcaption data-image-caption>"Choose a cap."</figcaption>
                    </figure>
                    <button class="shop-carousel-button shop-carousel-next"
                            type="button"
                            data-image-next
                            aria-label="Next product image">
                        { chevron() }
                    </button>
                    <div class="shop-thumbs" data-image-thumbs aria-label="Product image views"></div>
                </section>
                <section class="shop-product-copy" aria-label="Product details">
                    <div class="shop-product-summary" data-size-summary>
                        <p class="shop-product-copy-title" data-product-copy-title></p>
                        <p class="shop-product-copy-price" data-product-price></p>
                        <p class="shop-product-copy-description" data-product-description></p>
                        <dl class="shop-specs">
                            <div>
                                <dt>"Blank"</dt>
                                <dd>"Low profile dad cap"</dd>
                            </div>
                        <div>
                            <dt>"Decoration"</dt>
                            <dd>"Front embroidery"</dd>
                            </div>
                            <div>
                                <dt>"Fit"</dt>
                                <dd>"One size / adjustable"</dd>
                            </div>
                        </dl>
                        <div class="shop-panel-actions">
                            <button class="shop-plus-button"
                                    type="button"
                                    data-size-toggle
                                    aria-label="Add to cart">
                                { plus_icon() }
                            </button>
                        </div>
                    </div>
                    </section>
                </div>
            </div>
            <div class="shop-paginate" aria-hidden="true">
                <span class="shop-paginate-arrow shop-paginate-up" data-edge-arrow="up">{ chevron() }</span>
                <span class="shop-paginate-arrow shop-paginate-down" data-edge-arrow="down">{ chevron() }</span>
            </div>
        </aside>
    }
}

// The bag: a right-docked sheet with two side-by-side panes. `data-bag-state`
// (closed | cart | checkout) is driven by `?bag=` in the URL; in checkout the
// sheet widens and the right pane is revealed additively. shop.js owns the cart
// rail (left) + the inline Stripe Elements flow (right).
fn render_bag() -> HtmlFragment {
    view! {
        <aside class="shop-bag"
               data-bag
               data-bag-state="closed"
               role="dialog"
               aria-modal="true"
               aria-label="Your bag and checkout"
               aria-hidden="true"
               hidden>
            <div class="shop-bag-scrim" data-bag-scrim></div>
            <div class="shop-bag-sheet">
                <section class="shop-bag-pane shop-bag-cart" data-bag-cart aria-label="Your bag">
                    <header class="shop-cart-head">
                        <h2 id="shop-cart-title">"Your bag"</h2>
                        <button class="shop-icon-button"
                                type="button"
                                data-close-bag
                                aria-label="Close bag">
                            { x_icon() }
                        </button>
                    </header>
                    <div class="shop-cart-items" data-cart-items>
                        <p class="shop-cart-empty">"Your cap stack is empty."</p>
                    </div>
                    <footer class="shop-cart-foot" data-cart-foot>
                        <div class="shop-cart-foot-row">
                            <p data-cart-total>"$0"</p>
                            <button type="button" data-cart-clear>"Clear"</button>
                        </div>
                        <button class="shop-cart-checkout" type="button" data-bag-checkout hidden>
                            "Checkout"
                        </button>
                    </footer>
                    <div class="shop-bag-stamp" data-bag-stamp aria-hidden="true">"PAID"</div>
                </section>

                <section class="shop-bag-pane shop-bag-checkout"
                         data-bag-checkout-pane
                         aria-label="Checkout"
                         aria-hidden="true">
                    <header class="shop-cart-head shop-checkout-head">
                        <button class="shop-icon-button"
                                type="button"
                                data-bag-back
                                aria-label="Back to bag">
                            { x_icon() }
                        </button>
                        <h2 id="shop-checkout-title">"Checkout"</h2>
                    </header>
                    <div class="shop-checkout-scroll">
                        <div class="shop-checkout-notice" data-checkout-disabled hidden>
                            <p>"Payments aren’t switched on in this environment yet. The caps are still very real."</p>
                        </div>
                        <form class="shop-checkout-form"
                              data-checkout-form
                              aria-labelledby="shop-checkout-title"
                              novalidate>
                            <div class="shop-checkout-field">
                                <label for="shop-checkout-email">"Email"</label>
                                <input id="shop-checkout-email"
                                       name="email"
                                       type="email"
                                       inputmode="email"
                                       autocomplete="email"
                                       spellcheck="false"
                                       placeholder="you@company.com"
                                       aria-describedby="shop-checkout-email-hint"
                                       data-checkout-email
                                       required />
                                <p id="shop-checkout-email-hint" class="shop-checkout-hint">"Your confirmation and tracking land here."</p>
                            </div>
                            <div class="shop-checkout-block">
                                <h3 class="shop-checkout-legend">"Ship to"</h3>
                                <div class="shop-checkout-element" data-address-element>
                                    <div class="shop-checkout-skeleton" aria-hidden="true"></div>
                                </div>
                            </div>
                            <div class="shop-checkout-block">
                                <h3 class="shop-checkout-legend">"Payment"</h3>
                                <div class="shop-checkout-element" data-payment-element>
                                    <div class="shop-checkout-skeleton" aria-hidden="true"></div>
                                </div>
                            </div>
                            <p class="shop-checkout-error" data-checkout-error role="alert" aria-live="assertive" hidden></p>
                            <button class="shop-checkout-pay"
                                    type="submit"
                                    data-checkout-pay
                                    aria-describedby="shop-checkout-secure"
                                    disabled>
                                <span class="shop-checkout-pay-spinner" aria-hidden="true" data-pay-spinner hidden></span>
                                <span data-pay-label>"Pay"</span>
                            </button>
                            <p id="shop-checkout-secure" class="shop-checkout-secure">
                                "🔒 Encrypted by Stripe · test card 4242 4242 4242 4242"
                            </p>
                        </form>
                        <div class="shop-checkout-done" data-checkout-done role="status" aria-live="polite" hidden>
                            <div class="shop-checkout-check" aria-hidden="true"></div>
                            <p class="shop-checkout-done-kicker">"ORDER CONFIRMED"</p>
                            <h3 class="shop-checkout-done-title">"Shipped to the embroidery queue"</h3>
                            <p class="shop-checkout-done-sub" data-checkout-done-sub></p>
                            <button class="shop-cart-checkout" type="button" data-bag-done-close>"Keep shopping"</button>
                        </div>
                    </div>
                </section>
            </div>
        </aside>
    }
}

pub(crate) fn product_data_json() -> String {
    let products = SHOP_PRODUCTS
        .iter()
        .map(|product| {
            json!({
                "slug": product.slug,
                "name": product.name,
                "phrase": product.phrase,
                "price": product.price.cents() / 100,
                "priceLabel": product.price.label(),
                "description": product.description,
                "colors": {
                    "cap": product.cap_color,
                    "thread": product.thread_color,
                    "accent": product.accent_color,
                },
                "images": product_images_json(product),
            })
        })
        .collect::<Vec<_>>();

    json!({
        "origin": STORE_ORIGIN,
        "products": products,
        "sizes": ["ONE SIZE"],
    })
    .to_string()
}

fn product_images_json(product: &ShopProduct) -> Vec<serde_json::Value> {
    CAP_VIEWS
        .iter()
        .map(|view| {
            json!({
                "id": view.id,
                "label": view.label,
                "caption": view.caption,
                "url": product_image_url(product, view),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shop_page_uses_site_assets_and_preview_metadata() {
        let html = page(&crate::stripe::Checkout::from_env());

        assert!(html.contains("<title>Store · ENGMANAGER.XYZ</title>"));
        assert!(html.contains(r#"<meta name="robots" content="noindex,follow">"#));
        assert!(html.contains(r#"<link rel="canonical" href="https://store.engmanager.xyz">"#));
        assert!(html.contains(r#"<link rel="alternate" href="https://shop.engmanager.xyz">"#));
        assert!(html.contains(r#"<meta property="og:type" content="website">"#));
        assert!(html.contains("/assets/css/critical."));
        assert!(html.contains("/assets/css/shop."));
        assert!(!html.contains("animejs@4"));
        assert!(html.contains("/assets/js/shop."));
        assert!(html.contains("window.__shopProducts="));
        assert!(html.contains("data-shop-grid"));
        assert!(html.contains(".webp"));
        assert!(!html.contains("<style>"));
    }

    #[test]
    fn shop_supports_root_and_product_deep_links() {
        assert!(supports_path("/"));
        assert!(supports_path("/products/engmanager-xyz"));
        assert!(supports_path("/products/engmanager-xyz/"));
        assert!(!supports_path("/articles/project-foottraffic"));
    }
}
