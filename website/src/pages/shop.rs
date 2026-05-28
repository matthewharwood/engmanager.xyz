use axum::http::header;
use axum::response::{Html, IntoResponse, Response};
use eng_domain::HtmlFragment;
use eng_markup::{html, view};
use serde_json::json;

use super::{
    GOOGLE_FONTS_HREF, OPEN_PROPS_HREF, render_dev_meta, render_resource_hints, render_sfx_urls,
    render_sitemap_link, render_theme_picker,
};
use crate::asset_url;

const SHOP_ORIGIN: &str = "https://shop.engmanager.xyz";
const STORE_ORIGIN: &str = "https://store.engmanager.xyz";
const SHOP_TITLE: &str = "Store · ENGMANAGER.XYZ";
const SHOP_DESCRIPTION: &str =
    "Embroidered dad-cap concepts for engineering managers, scrum rituals, and shipped work.";
const SHOP_CACHE_CONTROL: &str =
    "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

const CAP_VIEWS: &[CapView] = &[
    CapView {
        id: "front",
        label: "Front",
        caption: "Crown-forward embroidery read.",
    },
    CapView {
        id: "angle",
        label: "Angle",
        caption: "Side sweep, curved brim, panel seams.",
    },
    CapView {
        id: "detail",
        label: "Detail",
        caption: "Close stitch pass with thread texture.",
    },
    CapView {
        id: "worn",
        label: "Worn",
        caption: "On-head scale for the daily standup.",
    },
    CapView {
        id: "model",
        label: "Model",
        caption: "Person-worn product reference.",
    },
];

const SHOP_PRODUCTS: &[ShopProduct] = &[
    ShopProduct {
        slug: "engmanager-xyz",
        name: "ENGMANAGER.XYZ",
        phrase: "ENGMANAGER.XYZ",
        cap_color: "#f4efe6",
        thread_color: "#111111",
        accent_color: "#ff5a3d",
        price: 80,
        description: "The site cap. Loud enough for the offsite, quiet enough for the retro.",
    },
    ShopProduct {
        slug: "scrum-of-scrums",
        name: "Scrum of Scrums",
        phrase: "Scrum of Scrums",
        cap_color: "#293241",
        thread_color: "#f2f7ff",
        accent_color: "#ee6c4d",
        price: 80,
        description: "A tiny crown for the meeting that became a meeting about meetings.",
    },
    ShopProduct {
        slug: "scrum-master",
        name: "Scrum Master",
        phrase: "Scrum Master",
        cap_color: "#e0fbfc",
        thread_color: "#16324f",
        accent_color: "#3d5a80",
        price: 80,
        description: "Ceremonial, but make it cotton. Built for blockers and board hygiene.",
    },
    ShopProduct {
        slug: "velocity",
        name: "Velocity",
        phrase: "Velocity",
        cap_color: "#f8d8e6",
        thread_color: "#681a40",
        accent_color: "#ff7aa2",
        price: 80,
        description: "For when the chart is a conversation starter, not a prophecy.",
    },
    ShopProduct {
        slug: "blocker-patrol",
        name: "Blocker Patrol",
        phrase: "Blocker Patrol",
        cap_color: "#f3c969",
        thread_color: "#2a2018",
        accent_color: "#0f8b8d",
        price: 80,
        description: "Worn low while moving one thing out of the team's way.",
    },
    ShopProduct {
        slug: "sprint-review",
        name: "Sprint Review",
        phrase: "Sprint Review",
        cap_color: "#ffffff",
        thread_color: "#244c3d",
        accent_color: "#79b473",
        price: 80,
        description: "Demo-day neutral. Pairs well with working software and short decks.",
    },
    ShopProduct {
        slug: "time-check",
        name: "Time Check",
        phrase: "Time Check",
        cap_color: "#17324d",
        thread_color: "#f9f871",
        accent_color: "#ff4fa3",
        price: 80,
        description: "A brim-forward nudge for the room to pause, sync, and check the clock.",
    },
    ShopProduct {
        slug: "standup-club",
        name: "Standup Club",
        phrase: "Standup Club",
        cap_color: "#d4f1f4",
        thread_color: "#0b4f6c",
        accent_color: "#ff6b35",
        price: 80,
        description: "Fifteen minutes, three prompts, one cap that does not ask a follow-up.",
    },
    ShopProduct {
        slug: "lgtm-plus-two",
        name: "LGTM +2",
        phrase: "LGTM +2",
        cap_color: "#fbf3b9",
        thread_color: "#3a405a",
        accent_color: "#f45b69",
        price: 80,
        description: "Approval, twice stitched. For reviews that can finally move.",
    },
    ShopProduct {
        slug: "stakeholder",
        name: "Stakeholder",
        phrase: "Stakeholder",
        cap_color: "#252422",
        thread_color: "#fffcf2",
        accent_color: "#eb5e28",
        price: 80,
        description: "For the person who can unblock funding and still asks great questions.",
    },
    ShopProduct {
        slug: "backlog-zero",
        name: "Backlog Zero",
        phrase: "Backlog Zero",
        cap_color: "#c7f9cc",
        thread_color: "#22577a",
        accent_color: "#38a3a5",
        price: 80,
        description: "A fictional state, rendered with absolute confidence.",
    },
    ShopProduct {
        slug: "release-train",
        name: "Release Train",
        phrase: "Release Train",
        cap_color: "#ece4db",
        thread_color: "#4a4e69",
        accent_color: "#9a8c98",
        price: 80,
        description: "All aboard, but please keep the blast radius small.",
    },
    ShopProduct {
        slug: "up-and-to-the-right",
        name: "Up & to the Right",
        phrase: "Up & to the Right",
        cap_color: "#fefae0",
        thread_color: "#283618",
        accent_color: "#22c55e",
        price: 80,
        description: "Optimism with a y-axis. Small chart, big stakeholder energy.",
    },
    ShopProduct {
        slug: "merge-friday",
        name: "Merge Friday",
        phrase: "Merge Friday",
        cap_color: "#dbeafe",
        thread_color: "#1d4ed8",
        accent_color: "#f97316",
        price: 80,
        description: "Risky in spirit. Surprisingly calm in thread.",
    },
    ShopProduct {
        slug: "incident-commander",
        name: "Incident Commander",
        phrase: "Incident Commander",
        cap_color: "#fee2e2",
        thread_color: "#7f1d1d",
        accent_color: "#ef4444",
        price: 80,
        description: "For the person keeping the room small and the timeline honest.",
    },
    ShopProduct {
        slug: "roadmap-ghost",
        name: "Roadmap Ghost",
        phrase: "Roadmap Ghost",
        cap_color: "#e9d5ff",
        thread_color: "#3b0764",
        accent_color: "#a855f7",
        price: 80,
        description: "It was on the slide. It was in the doc. It was never staffed.",
    },
    ShopProduct {
        slug: "consensus-builder",
        name: "Consensus Builder",
        phrase: "Consensus Builder",
        cap_color: "#ccfbf1",
        thread_color: "#134e4a",
        accent_color: "#14b8a6",
        price: 80,
        description: "Soft power, structured notes, and a very intentional brim curve.",
    },
    ShopProduct {
        slug: "scope-creep",
        name: "Scope Creep",
        phrase: "Scope Creep",
        cap_color: "#f5f5f4",
        thread_color: "#365314",
        accent_color: "#84cc16",
        price: 80,
        description: "Looks harmless from the side. Somehow includes three extra features.",
    },
];

#[derive(Clone, Copy)]
struct CapView {
    id: &'static str,
    label: &'static str,
    caption: &'static str,
}

#[derive(Clone, Copy)]
struct ShopProduct {
    slug: &'static str,
    name: &'static str,
    phrase: &'static str,
    cap_color: &'static str,
    thread_color: &'static str,
    accent_color: &'static str,
    price: u16,
    description: &'static str,
}

pub async fn index() -> Response {
    ([(header::CACHE_CONTROL, SHOP_CACHE_CONTROL)], Html(page())).into_response()
}

pub fn supports_path(path: &str) -> bool {
    path == "/" || path.starts_with("/products/")
}

fn page() -> String {
    let products = render_product_grid();
    let data = HtmlFragment::new(format!("window.__shopProducts={};", product_data_json()));

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
                        "‹"
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
                { render_cart_drawer() }
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
    let price = format!("${}", product.price);
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
                        aria-label="Back to products">
                    "‹"
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
                        "‹"
                    </button>
                    <figure class="shop-carousel-stage">
                        <button class="shop-image-advance"
                                type="button"
                                data-image-advance
                                aria-label="Next product image">
                            <img data-product-image
                                 src=""
                                 alt=""
                                 width="900"
                                 height="1100"
                                 decoding="async" />
                        </button>
                        <figcaption data-image-caption>"Choose a cap."</figcaption>
                    </figure>
                    <button class="shop-carousel-button shop-carousel-next"
                            type="button"
                            data-image-next
                            aria-label="Next product image">
                        "›"
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
                                aria-expanded="false"
                                aria-controls="shop-size-sheet">
                            "+"
                        </button>
                            <button class="shop-add-button" type="button" data-add-cart>
                                "Add selected"
                            </button>
                        </div>
                    </div>
                        <section id="shop-size-sheet"
                                 class="shop-size-sheet"
                                 data-size-sheet
                                 aria-label="Product options"
                                 tabindex="-1"
                                 hidden>
                            <header class="shop-size-head">
                                <button class="shop-size-help" type="button" data-info-toggle aria-label="Toggle information">
                                    "?"
                                </button>
                                <h3>"SELECT SIZE"</h3>
                                <button class="shop-size-close" type="button" data-close-size aria-label="Close product options">
                                    "x"
                                </button>
                            </header>
                            <p class="shop-size-price" data-size-price>"$80"</p>
                            <div class="shop-size-options" data-size-options role="group" aria-label="Purchase option">
                                <button type="button"
                                        class="shop-size-flip is-selected"
                                        data-size-option="ONE SIZE"
                                        data-size-add
                                        aria-label="Add one size to cart">
                                    <span class="shop-size-flip-inner" aria-hidden="true">
                                        <span class="shop-size-flip-face shop-size-flip-front">"ONE SIZE"</span>
                                        <span class="shop-size-flip-face shop-size-flip-back">"ADD TO CART"</span>
                                    </span>
                                </button>
                            </div>
                            <section class="shop-size-info is-collapsed" data-size-info>
                                <h4>"INFORMATION"</h4>
                                <p data-size-info-copy>
                                    "Low-profile dad cap, front embroidery, adjustable back strap, one size fits most adults."
                                </p>
                            </section>
                            <button class="shop-size-add" type="button" data-add-cart>
                                "Add to cart"
                            </button>
                        </section>
                    </section>
                </div>
            </div>
        </aside>
    }
}

fn render_cart_drawer() -> HtmlFragment {
    view! {
        <aside class="shop-cart-drawer"
               data-cart-drawer
               role="dialog"
               aria-modal="true"
               aria-labelledby="shop-cart-title"
               aria-hidden="true"
               hidden>
            <header class="shop-cart-head">
                <h2 id="shop-cart-title">"Cart"</h2>
                <button class="shop-icon-button"
                        type="button"
                        data-close-cart
                        aria-label="Close cart">
                    "x"
                </button>
            </header>
            <div class="shop-cart-items" data-cart-items>
                <p class="shop-cart-empty">"Your cap stack is empty."</p>
            </div>
            <footer class="shop-cart-foot">
                <p data-cart-total>"$0"</p>
                <button type="button" data-cart-clear>"Clear"</button>
            </footer>
        </aside>
    }
}

fn product_data_json() -> String {
    let products = SHOP_PRODUCTS
        .iter()
        .map(|product| {
            json!({
                "slug": product.slug,
                "name": product.name,
                "phrase": product.phrase,
                "price": product.price,
                "priceLabel": format!("${}", product.price),
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

fn product_image_url(product: &ShopProduct, view: &CapView) -> String {
    asset_url(&product_image_path(product, view))
}

fn product_image_path(product: &ShopProduct, view: &CapView) -> String {
    format!("shop/caps/{}-{}.webp", product.slug, view.id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::path::Path;

    #[test]
    fn shop_page_uses_site_assets_and_preview_metadata() {
        let html = page();

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
    fn product_catalog_is_full_grid_with_unique_slugs() {
        assert_eq!(SHOP_PRODUCTS.len(), 18);
        let slugs = SHOP_PRODUCTS
            .iter()
            .map(|product| product.slug)
            .collect::<HashSet<_>>();
        assert_eq!(slugs.len(), SHOP_PRODUCTS.len());
    }

    #[test]
    fn every_product_view_has_a_generated_asset() {
        let assets_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("assets");

        for product in SHOP_PRODUCTS {
            for view in CAP_VIEWS {
                let path = assets_root.join(product_image_path(product, view));
                assert!(
                    path.exists(),
                    "missing generated cap asset: {}",
                    path.display()
                );
            }
        }
    }

    #[test]
    fn shop_supports_root_and_product_deep_links() {
        assert!(supports_path("/"));
        assert!(supports_path("/products/engmanager-xyz"));
        assert!(supports_path("/products/engmanager-xyz/"));
        assert!(!supports_path("/articles/project-foottraffic"));
    }
}
