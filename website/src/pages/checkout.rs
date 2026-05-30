//! On-site Stripe Elements checkout for the shop caps.
//!
//! Three handlers + two pages:
//!   - `page`          GET  /checkout         — the branded Elements flow.
//!   - `success`       GET  /checkout/success — order confirmation.
//!   - `create_intent` POST /api/checkout/intent — server-priced PaymentIntent.
//!   - `webhook`       POST /api/stripe/webhook  — verified fulfillment trigger.
//!
//! Pricing is computed server-side from `SHOP_PRODUCTS` (the same source of
//! truth the grid + sync tool use); the client never sends an amount. The page
//! mounts the Payment + Address Elements (themed live to whichever of the 10
//! site themes is active) and confirms with Stripe's deferred-intent flow:
//! `elements.submit()` → POST here to mint the intent → `confirmPayment`.

use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{Html, IntoResponse, Response};
use eng_domain::HtmlFragment;
use eng_markup::{html, view};
use serde::Deserialize;
use serde_json::{Value, json};

use super::shop::{SHOP_PRODUCTS, product_data_json};
use super::{
    GOOGLE_FONTS_HREF, OPEN_PROPS_HREF, render_dev_meta, render_resource_hints, render_sfx_urls,
    render_sitemap_link, render_theme_picker,
};
use crate::AppState;
use crate::asset_url;

const CHECKOUT_TITLE: &str = "Checkout · ENGMANAGER.XYZ";
const SUCCESS_TITLE: &str = "Order confirmed · ENGMANAGER.XYZ";
const CHECKOUT_DESCRIPTION: &str = "Secure on-site checkout for ENGMANAGER.XYZ embroidered dad caps.";
// Checkout pages carry order context — never cache them at the browser or edge.
const CHECKOUT_CACHE_CONTROL: &str = "no-store";
// Stripe caps a single PaymentIntent at 999,999.99 in the major unit; we cap
// well under that as a sanity guard against a runaway cart.
const MAX_AMOUNT_CENTS: u64 = 5_000_00;
// Stripe's minimum charge for USD.
const MIN_AMOUNT_CENTS: u64 = 50;

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

#[derive(Clone, Copy)]
enum Mode {
    Checkout,
    Success,
}

impl Mode {
    fn as_str(self) -> &'static str {
        match self {
            Mode::Checkout => "checkout",
            Mode::Success => "success",
        }
    }
}

// The cart lives in localStorage on the shop origin, so checkout only makes
// sense on a shop host — keep the pages off the apex/marketing site, matching
// the site's existing host partitioning (root_handler / fallback_handler).
fn is_shop_request(headers: &HeaderMap) -> bool {
    headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .map(crate::is_shop_host)
        .unwrap_or(false)
}

pub async fn page(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !is_shop_request(&headers) {
        return super::not_found::handler().await;
    }
    (
        [(header::CACHE_CONTROL, CHECKOUT_CACHE_CONTROL)],
        Html(render_page(Mode::Checkout, &state)),
    )
        .into_response()
}

pub async fn success(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !is_shop_request(&headers) {
        return super::not_found::handler().await;
    }
    (
        [(header::CACHE_CONTROL, CHECKOUT_CACHE_CONTROL)],
        Html(render_page(Mode::Success, &state)),
    )
        .into_response()
}

fn render_page(mode: Mode, state: &AppState) -> String {
    let title = match mode {
        Mode::Checkout => CHECKOUT_TITLE,
        Mode::Success => SUCCESS_TITLE,
    };
    // The single data island the client reads: the publishable key (to mount
    // Elements), whether checkout is configured, the mode, and the full product
    // catalog (names/prices/colors) so the receipt can render line items.
    let data = HtmlFragment::new(format!(
        "window.__checkout={};window.__shopProducts={};",
        json!({
            "publishableKey": state.stripe.publishable_key(),
            "enabled": state.stripe.is_enabled(),
            "mode": mode.as_str(),
            "currency": "usd",
            "returnPath": "/checkout/success",
        }),
        product_data_json(),
    ));

    let body_main = match mode {
        Mode::Checkout => render_checkout_main(),
        Mode::Success => render_success_main(),
    };

    html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{ title }</title>
                <meta name="description" content=CHECKOUT_DESCRIPTION />
                <meta name="robots" content="noindex,nofollow" />
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                { render_sitemap_link() }
                { render_resource_hints() }
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/checkout.css") } />
                <script src={ asset_url("js/theme-toggle.js") }></script>
                { render_sfx_urls() }
                <script>{ data }</script>
                <link rel="preconnect" href="https://js.stripe.com" crossorigin />
                <link rel="preconnect" href="https://api.stripe.com" crossorigin />
                <script src="https://js.stripe.com/v3" defer></script>
                <script src={ asset_url("js/audio.js") } defer></script>
                <script src={ asset_url("js/checkout.js") } defer></script>
                <meta name="theme-color" content="#e64553" />
                { render_dev_meta() }
            </head>
            <body class="checkout-page" data-checkout-mode={ mode.as_str() }>
                <a class="skip-link" href="#main">"Skip to content"</a>
                <header class="checkout-topbar" aria-label="Checkout controls">
                    <a class="checkout-back" href="/" aria-label="Back to the store">
                        <span class="checkout-back-arrow" aria-hidden="true">"‹"</span>
                        <span class="checkout-back-label">"Store"</span>
                    </a>
                    <p class="checkout-wordmark">"ENGMANAGER.XYZ"</p>
                    { render_theme_picker() }
                </header>
                { body_main }
            </body>
        </html>
    }
    .into_string()
}

fn render_checkout_main() -> HtmlFragment {
    view! {
        <main id="main" class="checkout-shell" data-checkout>
            <div class="checkout-state checkout-state-loading" data-checkout-loading>
                <div class="checkout-spinner-lg" aria-hidden="true"></div>
                <p>"Loading your cart…"</p>
            </div>

            <div class="checkout-state checkout-notice" data-checkout-disabled hidden>
                <h1>"Checkout is warming up"</h1>
                <p>"Payments aren’t switched on in this environment yet. The caps are still very real."</p>
                <a class="checkout-button-link" href="/">"Back to the caps"</a>
            </div>

            <div class="checkout-state checkout-empty" data-checkout-empty hidden>
                <div class="checkout-empty-cap" aria-hidden="true"></div>
                <h1>"Your cap stack is empty"</h1>
                <p>"Nothing to check out yet. Go stitch a few strong opinions onto your head."</p>
                <a class="checkout-button-link" href="/">"Browse the caps"</a>
            </div>

            <div class="checkout-grid" data-checkout-grid hidden>
                <section class="checkout-flow" aria-label="Checkout details">
                    <h1 class="checkout-h1">"Checkout"</h1>
                    <p class="checkout-lede">"Three steps to a freshly embroidered opinion."</p>
                    <form class="checkout-form" data-checkout-form novalidate>
                        <section class="checkout-step" data-step="1">
                            <header class="checkout-step-head">
                                <span class="checkout-step-num" aria-hidden="true">"1"</span>
                                <h2>"Contact"</h2>
                            </header>
                            <div class="checkout-field">
                                <label for="checkout-email">"Email"</label>
                                <input id="checkout-email"
                                       name="email"
                                       type="email"
                                       inputmode="email"
                                       autocomplete="email"
                                       spellcheck="false"
                                       placeholder="you@company.com"
                                       aria-describedby="checkout-email-hint"
                                       data-checkout-email
                                       required />
                                <p id="checkout-email-hint" class="checkout-field-hint">"Your confirmation and tracking land here."</p>
                            </div>
                        </section>

                        <section class="checkout-step" data-step="2">
                            <header class="checkout-step-head">
                                <span class="checkout-step-num" aria-hidden="true">"2"</span>
                                <h2>"Ship to"</h2>
                            </header>
                            <div class="checkout-element" data-address-element>
                                <div class="checkout-element-skeleton" aria-hidden="true"></div>
                            </div>
                        </section>

                        <section class="checkout-step" data-step="3">
                            <header class="checkout-step-head">
                                <span class="checkout-step-num" aria-hidden="true">"3"</span>
                                <h2>"Payment"</h2>
                            </header>
                            <div class="checkout-element" data-payment-element>
                                <div class="checkout-element-skeleton" aria-hidden="true"></div>
                            </div>
                            <p class="checkout-error" data-checkout-error role="alert" aria-live="assertive" hidden></p>
                            <button class="checkout-pay"
                                    type="submit"
                                    data-checkout-pay
                                    aria-describedby="checkout-secure"
                                    disabled>
                                <span class="checkout-pay-spinner" aria-hidden="true" data-pay-spinner hidden></span>
                                <span class="checkout-pay-label" data-pay-label>"Pay"</span>
                            </button>
                            <p id="checkout-secure" class="checkout-secure">
                                <span class="checkout-secure-lock" aria-hidden="true">"🔒"</span>
                                "Encrypted and processed by Stripe. Test mode — try card 4242 4242 4242 4242."
                            </p>
                        </section>
                    </form>
                </section>

                { render_receipt_panel() }
            </div>

            <div class="checkout-done" data-checkout-done role="status" aria-live="polite" hidden>
                <div class="checkout-done-inner">
                    <div class="checkout-check" aria-hidden="true"></div>
                    <p class="checkout-done-kicker">"PAYMENT CONFIRMED"</p>
                    <p class="checkout-done-text" data-done-text>"Stamping your receipt…"</p>
                </div>
            </div>
        </main>
    }
}

fn render_success_main() -> HtmlFragment {
    view! {
        <main id="main" class="checkout-shell checkout-shell-success" data-checkout-success>
            <div class="checkout-state checkout-state-loading" data-confirm-loading>
                <div class="checkout-spinner-lg" aria-hidden="true"></div>
                <p>"Confirming your order…"</p>
            </div>

            <div class="checkout-state checkout-notice" data-confirm-error hidden>
                <h1>"We couldn’t find that order"</h1>
                <p data-confirm-error-msg>"This confirmation link looks expired or incomplete."</p>
                <a class="checkout-button-link" href="/">"Back to the store"</a>
            </div>

            <div class="checkout-confirm" data-confirm-ok hidden>
                <header class="checkout-confirm-head">
                    <div class="checkout-check" aria-hidden="true"></div>
                    <p class="checkout-confirm-kicker">"ORDER CONFIRMED"</p>
                    <h1 class="checkout-confirm-title">"Shipped to the embroidery queue"</h1>
                    <p class="checkout-confirm-lede" data-confirm-email></p>
                </header>
                { render_receipt_panel() }
                <div class="checkout-confirm-actions">
                    <a class="checkout-button-link" href="/">"Keep shopping"</a>
                </div>
            </div>
        </main>
    }
}

// The receipt — a literal printed receipt for an audience that lives in ops
// dashboards. Monospace, perforated edges, a barcode, and a "PAID" rubber stamp
// that thunks down on success. Lines + totals are filled client-side: from the
// cart on /checkout, from the PaymentIntent on /checkout/success.
fn render_receipt_panel() -> HtmlFragment {
    view! {
        <aside class="checkout-receipt" aria-label="Order summary">
            <div class="receipt" data-receipt>
                <div class="receipt-paper">
                    <header class="receipt-head">
                        <p class="receipt-logo">"ENGMANAGER.XYZ"</p>
                        <p class="receipt-sub">"DAD CAP DIVISION · STORE #1"</p>
                        <p class="receipt-meta" data-receipt-meta>"ORDER PREVIEW"</p>
                    </header>
                    <div class="receipt-rule" aria-hidden="true"></div>
                    <ul class="receipt-lines" data-receipt-lines></ul>
                    <div class="receipt-rule" aria-hidden="true"></div>
                    <dl class="receipt-totals">
                        <div class="receipt-row">
                            <dt>"Subtotal"</dt>
                            <dd data-receipt-subtotal>"$0"</dd>
                        </div>
                        <div class="receipt-row">
                            <dt>"Shipping"</dt>
                            <dd data-receipt-shipping>"Free"</dd>
                        </div>
                        <div class="receipt-row">
                            <dt>"Tax"</dt>
                            <dd data-receipt-tax>"—"</dd>
                        </div>
                    </dl>
                    <div class="receipt-rule receipt-rule-bold" aria-hidden="true"></div>
                    <dl class="receipt-grand">
                        <div class="receipt-row">
                            <dt>"Total"</dt>
                            <dd data-receipt-total>"$0"</dd>
                        </div>
                    </dl>
                    <p class="receipt-barcode" aria-hidden="true"></p>
                    <p class="receipt-thanks" data-receipt-foot>"THANK YOU · NOW SHIP IT"</p>
                </div>
                <div class="receipt-stamp" data-receipt-stamp aria-hidden="true">"PAID"</div>
            </div>
        </aside>
    }
}

// ---------------------------------------------------------------------------
// POST /api/checkout/intent
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CreateIntentReq {
    items: Vec<ReqItem>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    shipping: Option<ReqShipping>,
}

#[derive(Deserialize)]
struct ReqItem {
    slug: String,
    quantity: u32,
}

#[derive(Deserialize)]
struct ReqShipping {
    name: Option<String>,
    line1: Option<String>,
    line2: Option<String>,
    city: Option<String>,
    state: Option<String>,
    postal_code: Option<String>,
    country: Option<String>,
}

pub async fn create_intent(
    State(state): State<AppState>,
    Json(req): Json<CreateIntentReq>,
) -> Response {
    if !state.stripe.is_enabled() {
        return error_json(
            StatusCode::SERVICE_UNAVAILABLE,
            "Checkout isn’t configured in this environment.",
        );
    }
    if req.items.is_empty() {
        return error_json(StatusCode::BAD_REQUEST, "Your cart is empty.");
    }

    // Price every line from SHOP_PRODUCTS. The client never sends an amount, so
    // a tampered cart can only ever buy real products at the real price.
    let mut amount: u64 = 0;
    let mut count: u32 = 0;
    let mut item_meta: Vec<String> = Vec::with_capacity(req.items.len());
    for item in &req.items {
        let Some(product) = SHOP_PRODUCTS.iter().find(|p| p.slug == item.slug) else {
            // Don't echo the client-supplied slug back in the error.
            return error_json(StatusCode::BAD_REQUEST, "Unknown or unavailable product.");
        };
        let qty = item.quantity.clamp(1, 99);
        amount += u64::from(product.price) * 100 * u64::from(qty);
        count += qty;
        item_meta.push(format!("{}:{qty}", product.slug));
    }
    if amount == 0 {
        return error_json(StatusCode::BAD_REQUEST, "Your cart is empty.");
    }
    // Stripe's USD minimum is 50¢. Unreachable with $80 caps, but keeps the
    // server authoritative if a sub-dollar product is ever added.
    if amount < MIN_AMOUNT_CENTS {
        return error_json(
            StatusCode::BAD_REQUEST,
            "Order total is below the minimum charge.",
        );
    }
    if amount > MAX_AMOUNT_CENTS {
        return error_json(
            StatusCode::BAD_REQUEST,
            "That order total is larger than this store supports.",
        );
    }

    let items_meta = item_meta.join(";");
    let email = req
        .email
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let description = format!(
        "ENGMANAGER.XYZ caps ({count} item{})",
        if count == 1 { "" } else { "s" }
    );
    // Deterministic key: an identical (cart, total, email) replays the same
    // PaymentIntent rather than minting a duplicate on a retried POST; editing
    // the cart changes the hash and yields a fresh intent.
    let idem = idempotency_key(&items_meta, amount, email.unwrap_or(""));

    let mut form: Vec<(&'static str, String)> = vec![
        ("amount", amount.to_string()),
        ("currency", "usd".to_string()),
        ("automatic_payment_methods[enabled]", "true".to_string()),
        ("description", description),
        ("metadata[order_kind]", "shop".to_string()),
        ("metadata[items]", items_meta.clone()),
        ("metadata[item_count]", count.to_string()),
    ];
    if let Some(email) = email {
        form.push(("receipt_email", email.to_string()));
    }
    if let Some(shipping) = &req.shipping {
        // Stripe rejects a partial shipping hash, so only attach it once the
        // Address Element has produced at least a name + line1.
        let has_name = non_empty(&shipping.name);
        let has_line1 = non_empty(&shipping.line1);
        if has_name && has_line1 {
            push_shipping(&mut form, shipping);
        }
    }

    match state
        .stripe
        .post("/payment_intents", &form, Some(&idem))
        .await
    {
        Ok(body) => {
            let client_secret = body["client_secret"].as_str().unwrap_or_default();
            if client_secret.is_empty() {
                eprintln!("checkout intent: stripe returned no client_secret: {body}");
                return error_json(
                    StatusCode::BAD_GATEWAY,
                    "Stripe didn’t return a usable payment session. Try again.",
                );
            }
            (
                [(header::CACHE_CONTROL, "no-store")],
                Json(json!({
                    "clientSecret": client_secret,
                    "paymentIntentId": body["id"].as_str().unwrap_or_default(),
                    "amount": amount,
                    "currency": "usd",
                })),
            )
                .into_response()
        }
        Err(err) => {
            eprintln!("checkout intent error: {err:#}");
            error_json(
                StatusCode::BAD_GATEWAY,
                "We couldn’t start the payment. Please try again.",
            )
        }
    }
}

fn non_empty(field: &Option<String>) -> bool {
    field.as_deref().map(str::trim).is_some_and(|s| !s.is_empty())
}

fn push_shipping(form: &mut Vec<(&'static str, String)>, s: &ReqShipping) {
    let mut put = |key: &'static str, value: &Option<String>| {
        if let Some(val) = value.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
            form.push((key, val.to_string()));
        }
    };
    put("shipping[name]", &s.name);
    put("shipping[address][line1]", &s.line1);
    put("shipping[address][line2]", &s.line2);
    put("shipping[address][city]", &s.city);
    put("shipping[address][state]", &s.state);
    put("shipping[address][postal_code]", &s.postal_code);
    put("shipping[address][country]", &s.country);
}

fn idempotency_key(items_meta: &str, amount: u64, email: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(items_meta.as_bytes());
    hasher.update(b"|");
    hasher.update(amount.to_le_bytes());
    hasher.update(b"|");
    hasher.update(email.as_bytes());
    format!("checkout-{}", hex::encode(&hasher.finalize()[..16]))
}

fn error_json(status: StatusCode, message: &str) -> Response {
    (
        status,
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({ "error": message })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/stripe/webhook
// ---------------------------------------------------------------------------

pub async fn webhook(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    if !state.stripe.webhook_configured() {
        // No signing secret here (e.g. before `stripe listen`). Don't act on an
        // unverifiable event, but 200 so Stripe/CLI doesn't pile up retries.
        eprintln!(
            "stripe webhook received but STRIPE_WEBHOOK_SECRET is unset — ignoring (unverified)"
        );
        return StatusCode::OK.into_response();
    }

    let signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();

    match state.stripe.verify_event(&body, signature) {
        Ok(event) => {
            handle_event(&event);
            StatusCode::OK.into_response()
        }
        Err(err) => {
            eprintln!("stripe webhook verification failed: {err:#}");
            StatusCode::BAD_REQUEST.into_response()
        }
    }
}

fn handle_event(event: &Value) {
    let kind = event["type"].as_str().unwrap_or("unknown");
    let object = &event["data"]["object"];
    let id = object["id"].as_str().unwrap_or("");
    match kind {
        "payment_intent.succeeded" => {
            let amount = object["amount"].as_u64().unwrap_or(0);
            let email = object["receipt_email"].as_str().unwrap_or("—");
            let items = object["metadata"]["items"].as_str().unwrap_or("");
            // Fulfillment hook: this is where an order would be enqueued for
            // embroidery + a confirmation email sent. Logged for now.
            println!("✓ payment_intent.succeeded {id} — {amount}¢ — {email} — [{items}]");
        }
        "payment_intent.payment_failed" => {
            println!("✗ payment_intent.payment_failed {id}");
        }
        other => println!("· stripe webhook: {other} ({id})"),
    }
}
