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
use eng_markup::view;
use serde::Deserialize;
use serde_json::{Value, json};

use super::shell::{MetaTags, PageShell};
use super::shop::product_data_json;
use crate::AppState;
use crate::catalog::SHOP_PRODUCTS;
use crate::components::quick_actions::theme_picker;
use crate::components::{Head, script_islands};
use crate::http::{json_error, no_store};

const CHECKOUT_TITLE: &str = "Checkout · ENGMANAGER.XYZ";
const SUCCESS_TITLE: &str = "Order confirmed · ENGMANAGER.XYZ";
const CHECKOUT_DESCRIPTION: &str =
    "Secure on-site checkout for ENGMANAGER.XYZ embroidered dad caps.";
// Stripe caps a single PaymentIntent at 999,999.99 in the major unit; we cap
// well under that as a sanity guard against a runaway cart.
const MAX_AMOUNT_CENTS: u64 = 500_000;
// Stripe's minimum charge for USD.
const MIN_AMOUNT_CENTS: u64 = 50;
// Stripe rejects metadata values longer than 500 characters; a runaway cart's
// items list must be truncated (on a char boundary) rather than 400 the intent.
const STRIPE_METADATA_VALUE_MAX_CHARS: usize = 500;

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

// Checkout pages carry order context — never cache them at the browser or edge.
pub async fn page(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !is_shop_request(&headers) {
        return super::not_found::handler().await;
    }
    no_store(Html(render_page(Mode::Checkout, &state)))
}

pub async fn success(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !is_shop_request(&headers) {
        return super::not_found::handler().await;
    }
    no_store(Html(render_page(Mode::Success, &state)))
}

fn render_page(mode: Mode, state: &AppState) -> String {
    let title = match mode {
        Mode::Checkout => CHECKOUT_TITLE,
        Mode::Success => SUCCESS_TITLE,
    };
    // The single data island the client reads: the publishable key (to mount
    // Elements), whether checkout is configured, the mode, and the full product
    // catalog (names/prices/colors) so the receipt can render line items.
    let data = script_islands(&[
        (
            "__checkout",
            &json!({
                "publishableKey": state.stripe.publishable_key(),
                "enabled": state.stripe.is_enabled(),
                "mode": mode.as_str(),
                "currency": "usd",
                "returnPath": "/checkout/success",
            })
            .to_string(),
        ),
        ("__shopProducts", &product_data_json()),
    ]);

    let body_main = match mode {
        Mode::Checkout => render_checkout_main(),
        Mode::Success => render_success_main(),
    };

    let mut assets = Head::new();
    assets.add_css("css/checkout.css");

    let mut scripts = Head::new();
    scripts.add_inline(data);
    scripts.add_inline(view! {
        <link rel="preconnect" href="https://js.stripe.com" crossorigin />
        <link rel="preconnect" href="https://api.stripe.com" crossorigin />
        <script src="https://js.stripe.com/v3" defer></script>
    });
    scripts.add_js("js/audio.js");
    scripts.add_js("js/checkout.js");

    let body = view! {
        <header class="checkout-topbar" aria-label="Checkout controls">
            <a class="checkout-back" href="/" aria-label="Back to the store">
                <span class="checkout-back-arrow" aria-hidden="true">"‹"</span>
                <span class="checkout-back-label">"Store"</span>
            </a>
            <p class="checkout-wordmark">"ENGMANAGER.XYZ"</p>
            { theme_picker() }
        </header>
        { body_main }
    };

    PageShell::new(title, "checkout-page")
        .meta(MetaTags {
            description: Some(CHECKOUT_DESCRIPTION.to_string()),
            robots: Some("noindex,nofollow"),
            ..MetaTags::default()
        })
        .assets(assets)
        .scripts(scripts)
        .body_attr("data-checkout-mode", mode.as_str())
        .render(body)
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
        return json_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Checkout isn’t configured in this environment.",
        );
    }
    if req.items.is_empty() {
        return json_error(StatusCode::BAD_REQUEST, "Your cart is empty.");
    }

    // Price every line from SHOP_PRODUCTS. The client never sends an amount, so
    // a tampered cart can only ever buy real products at the real price.
    let mut amount: u64 = 0;
    let mut count: u32 = 0;
    let mut item_meta: Vec<String> = Vec::with_capacity(req.items.len());
    for item in &req.items {
        let Some(product) = SHOP_PRODUCTS.iter().find(|p| p.slug == item.slug) else {
            // Don't echo the client-supplied slug back in the error.
            return json_error(StatusCode::BAD_REQUEST, "Unknown or unavailable product.");
        };
        let qty = item.quantity.clamp(1, 99);
        amount += u64::from(product.price.cents()) * u64::from(qty);
        count += qty;
        item_meta.push(format!("{}:{qty}", product.slug));
    }
    if amount == 0 {
        return json_error(StatusCode::BAD_REQUEST, "Your cart is empty.");
    }
    // Stripe's USD minimum is 50¢. Unreachable with $80 caps, but keeps the
    // server authoritative if a sub-dollar product is ever added.
    if amount < MIN_AMOUNT_CENTS {
        return json_error(
            StatusCode::BAD_REQUEST,
            "Order total is below the minimum charge.",
        );
    }
    if amount > MAX_AMOUNT_CENTS {
        return json_error(
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
    // Normalized shipping form fields — the exact strings posted as
    // shipping[*]. Stripe rejects a partial shipping hash, so only attach it
    // once the Address Element has produced at least a name + line1.
    let shipping = req
        .shipping
        .as_ref()
        .filter(|s| non_empty(&s.name) && non_empty(&s.line1))
        .map(shipping_fields)
        .unwrap_or_default();
    // Deterministic key: an identical (cart, total, email, shipping) replays
    // the same PaymentIntent rather than minting a duplicate on a retried
    // POST; editing the cart OR the shipping address changes the hash and
    // yields a fresh intent (ledger #13 — Stripe 400s a replayed key whose
    // params changed, which previously surfaced as a 502 after a declined
    // card + edited address).
    let idem = idempotency_key(&items_meta, amount, email.unwrap_or(""), &shipping);

    let mut form: Vec<(&'static str, String)> = vec![
        ("amount", amount.to_string()),
        ("currency", "usd".to_string()),
        ("automatic_payment_methods[enabled]", "true".to_string()),
        ("description", description),
        ("metadata[order_kind]", "shop".to_string()),
        ("metadata[items]", truncate_metadata_value(&items_meta)),
        ("metadata[item_count]", count.to_string()),
    ];
    if let Some(email) = email {
        form.push(("receipt_email", email.to_string()));
    }
    form.extend(shipping);

    match state
        .stripe
        .post("/payment_intents", &form, Some(&idem))
        .await
    {
        Ok(body) => {
            let client_secret = body["client_secret"].as_str().unwrap_or_default();
            if client_secret.is_empty() {
                tracing::error!(
                    response = %body,
                    "checkout intent: stripe returned no client_secret"
                );
                return json_error(
                    StatusCode::BAD_GATEWAY,
                    "Stripe didn’t return a usable payment session. Try again.",
                );
            }
            no_store(Json(json!({
                "clientSecret": client_secret,
                "paymentIntentId": body["id"].as_str().unwrap_or_default(),
                "amount": amount,
                "currency": "usd",
            })))
        }
        Err(err) => {
            tracing::error!(err = %format!("{err:#}"), "checkout intent error");
            json_error(
                StatusCode::BAD_GATEWAY,
                "We couldn’t start the payment. Please try again.",
            )
        }
    }
}

fn non_empty(field: &Option<String>) -> bool {
    field
        .as_deref()
        .map(str::trim)
        .is_some_and(|s| !s.is_empty())
}

/// The normalized shipping form fields in their stable order — this exact
/// sequence is BOTH posted to Stripe and folded into the idempotency key, so
/// the order must never change.
fn shipping_fields(s: &ReqShipping) -> Vec<(&'static str, String)> {
    let mut fields: Vec<(&'static str, String)> = Vec::new();
    let mut put = |key: &'static str, value: &Option<String>| {
        if let Some(val) = value.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
            fields.push((key, val.to_string()));
        }
    };
    put("shipping[name]", &s.name);
    put("shipping[address][line1]", &s.line1);
    put("shipping[address][line2]", &s.line2);
    put("shipping[address][city]", &s.city);
    put("shipping[address][state]", &s.state);
    put("shipping[address][postal_code]", &s.postal_code);
    put("shipping[address][country]", &s.country);
    fields
}

fn idempotency_key(
    items_meta: &str,
    amount: u64,
    email: &str,
    shipping: &[(&'static str, String)],
) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(items_meta.as_bytes());
    hasher.update(b"|");
    hasher.update(amount.to_le_bytes());
    hasher.update(b"|");
    hasher.update(email.as_bytes());
    // Shipping folds in as `|key=value` pairs in their stable form order. A
    // cart WITHOUT shipping hashes exactly as the pre-shipping derivation, so
    // in-flight no-shipping carts keep replaying their existing intents
    // across a deploy (pinned by test below).
    for (key, value) in shipping {
        hasher.update(b"|");
        hasher.update(key.as_bytes());
        hasher.update(b"=");
        hasher.update(value.as_bytes());
    }
    format!("checkout-{}", hex::encode(&hasher.finalize()[..16]))
}

// Truncate a Stripe metadata value to the 500-char limit on a char boundary
// (`char_indices` walks scalar values, so multi-byte text can't be split).
fn truncate_metadata_value(value: &str) -> String {
    match value.char_indices().nth(STRIPE_METADATA_VALUE_MAX_CHARS) {
        Some((index, _)) => value[..index].to_string(),
        None => value.to_string(),
    }
}

// ---------------------------------------------------------------------------
// POST /api/stripe/webhook
// ---------------------------------------------------------------------------

pub async fn webhook(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    if !state.stripe.webhook_configured() {
        // No signing secret here (e.g. before `stripe listen`). Don't act on an
        // unverifiable event, but 200 so Stripe/CLI doesn't pile up retries.
        tracing::warn!(
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
            tracing::error!(err = %format!("{err:#}"), "stripe webhook verification failed");
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
            // embroidery + a confirmation email sent. This log line is the
            // ONLY fulfillment record today — keep the message + intent_id /
            // amount_cents fields stable and grep-able.
            tracing::info!(
                intent_id = %id,
                amount_cents = amount,
                email = %email,
                items = %items,
                "payment_intent.succeeded"
            );
        }
        "payment_intent.payment_failed" => {
            tracing::warn!(intent_id = %id, "payment_intent.payment_failed");
        }
        other => tracing::info!(event_type = %other, intent_id = %id, "stripe webhook event"),
    }
}

#[cfg(test)]
mod tests {
    use super::{ReqShipping, idempotency_key, shipping_fields, truncate_metadata_value};

    fn shipping() -> ReqShipping {
        ReqShipping {
            name: Some("Ada Lovelace".to_string()),
            line1: Some("1 Analytical Engine Way".to_string()),
            line2: None,
            city: Some("London".to_string()),
            state: Some("LDN".to_string()),
            postal_code: Some("EC1A".to_string()),
            country: Some("GB".to_string()),
        }
    }

    #[test]
    fn idempotency_key_is_stable_for_identical_inputs() {
        let fields = shipping_fields(&shipping());
        let a = idempotency_key("cap-one:2;cap-two:1", 24_000, "buyer@example.com", &fields);
        let b = idempotency_key("cap-one:2;cap-two:1", 24_000, "buyer@example.com", &fields);
        assert_eq!(a, b);
        // Shape contract: "checkout-" + 16-byte (32 hex char) digest prefix.
        assert!(a.starts_with("checkout-"));
        assert_eq!(a.len(), "checkout-".len() + 32);
    }

    #[test]
    fn shipping_change_changes_the_key() {
        let original = shipping_fields(&shipping());
        let edited = shipping_fields(&ReqShipping {
            line1: Some("2 Difference Engine Rd".to_string()),
            ..shipping()
        });

        let no_shipping = idempotency_key("cap-one:1", 8_000, "buyer@example.com", &[]);
        let with_shipping = idempotency_key("cap-one:1", 8_000, "buyer@example.com", &original);
        let with_edited = idempotency_key("cap-one:1", 8_000, "buyer@example.com", &edited);

        assert_ne!(no_shipping, with_shipping);
        assert_ne!(with_shipping, with_edited);
    }

    // HARD requirement (ledger #13): carts WITHOUT shipping must keep the
    // exact pre-P5 derivation, so in-flight carts replay their existing
    // intents across the deploy. Pinned vector computed from the old
    // sha256(items | amount_le | email) hash.
    #[test]
    fn no_shipping_key_matches_the_pre_shipping_derivation() {
        let key = idempotency_key("cap-one:2;cap-two:1", 24_000, "buyer@example.com", &[]);
        assert_eq!(key, "checkout-393631d8b94bd5215d1dded3c47a4544");
    }

    #[test]
    fn metadata_value_truncates_on_a_char_boundary() {
        // Short values pass through untouched.
        assert_eq!(truncate_metadata_value("cap-one:1"), "cap-one:1");

        // Multi-byte text truncates to 500 CHARS without splitting a scalar.
        let long = "é".repeat(600);
        let truncated = truncate_metadata_value(&long);
        assert_eq!(truncated.chars().count(), 500);
        assert!(long.starts_with(&truncated));

        let ascii = "x".repeat(501);
        assert_eq!(truncate_metadata_value(&ascii).len(), 500);
    }
}
