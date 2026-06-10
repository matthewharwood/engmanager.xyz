//! Stripe catalog sync (Option B): upsert the shop caps as Stripe Products +
//! Prices via the REST API, using `SHOP_PRODUCTS` (in `pages::shop`) as the
//! single source of truth. Invoked as a subcommand of the website binary so it
//! shares that catalog without a separate crate:
//!
//!   cargo run -p website -- stripe-sync [--only <slug>] [--dry-run] [--live]
//!
//! Test mode by default (reads `STRIPE_SECRET_KEY`, expected `sk_test_…` from
//! `.env.local`). It refuses to touch a live key unless `--live` is passed.
//!
//! Idempotency: each product/price create sends a stable `Idempotency-Key`, and
//! we first look up an existing product by `metadata['slug']`. Re-running is
//! safe — it reuses existing objects instead of creating duplicates. Resulting
//! ids are merged into `data/stripe-catalog.{test,live}.json` keyed by slug.

use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result, bail};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::Serialize;
use serde_json::{Value, json};
use sha2::Sha256;

use crate::pages::shop::{SHOP_PRODUCTS, ShopProduct};

type HmacSha256 = Hmac<Sha256>;

const STRIPE_API: &str = "https://api.stripe.com/v1";
const IMAGE_ORIGIN: &str = "https://shop.engmanager.xyz";
// Bump to force new idempotency keys (e.g. after changing product fields/price).
const SYNC_VERSION: &str = "v1";

pub struct SyncOptions {
    pub only: Option<String>,
    pub dry_run: bool,
    pub live: bool,
}

impl SyncOptions {
    /// Parse argv (including argv[0] and the "stripe-sync" token). Accepts
    /// `--only <slug>` or a bare positional slug, plus `--dry-run` / `--live`.
    pub fn from_args(args: &[String]) -> Self {
        let dry_run = args.iter().any(|a| a == "--dry-run");
        let live = args.iter().any(|a| a == "--live");

        let mut only = args
            .iter()
            .position(|a| a == "--only")
            .and_then(|i| args.get(i + 1).cloned());
        if only.is_none() {
            if let Some(pos) = args.get(2) {
                if !pos.starts_with("--") {
                    only = Some(pos.clone());
                }
            }
        }

        SyncOptions {
            only,
            dry_run,
            live,
        }
    }
}

#[derive(Serialize)]
struct CatalogEntry {
    slug: String,
    name: String,
    product_id: String,
    price_id: String,
    unit_amount: u32,
    currency: String,
    image: String,
    livemode: bool,
}

pub async fn run(opts: SyncOptions) -> Result<()> {
    let key = std::env::var("STRIPE_SECRET_KEY")
        .context("STRIPE_SECRET_KEY not set (expected in .env.local)")?;
    let is_live = key.starts_with("sk_live_");

    if is_live && !opts.live {
        bail!(
            "STRIPE_SECRET_KEY is a LIVE key (sk_live_…). Refusing to run without --live. \
             Use your sk_test_ key for catalog testing."
        );
    }
    if !is_live && opts.live {
        bail!("--live was passed but STRIPE_SECRET_KEY is not a live key (sk_live_…).");
    }
    let mode = if is_live { "LIVE" } else { "test" };

    let products: Vec<&ShopProduct> = SHOP_PRODUCTS
        .iter()
        .filter(|p| opts.only.as_deref().is_none_or(|s| s == p.slug))
        .collect();
    if products.is_empty() {
        bail!("no product matched --only {:?}", opts.only);
    }

    println!(
        "Stripe catalog sync — {mode} mode — {} product(s){}",
        products.len(),
        if opts.dry_run { " — DRY RUN" } else { "" }
    );

    if opts.dry_run {
        for p in &products {
            let amount = unit_amount(p);
            println!(
                "  would upsert  {:<20} {:<26} {} {}",
                p.slug,
                p.name,
                fmt_amount(amount),
                front_image_url(p)
            );
        }
        println!("(dry run — no API calls made)");
        return Ok(());
    }

    let client = Client::new();
    let mut entries: BTreeMap<String, CatalogEntry> = BTreeMap::new();
    for p in &products {
        let entry = upsert_product(&client, &key, p)
            .await
            .with_context(|| format!("upserting product '{}'", p.slug))?;
        println!(
            "  ✓ {:<20} product={} price={}",
            p.slug, entry.product_id, entry.price_id
        );
        entries.insert(p.slug.to_string(), entry);
    }

    write_catalog(&entries, is_live)?;
    Ok(())
}

fn unit_amount(p: &ShopProduct) -> u32 {
    u32::from(p.price) * 100
}

fn fmt_amount(cents: u32) -> String {
    format!("${}.{:02}", cents / 100, cents % 100)
}

fn front_image_url(p: &ShopProduct) -> String {
    // Mirrors `pages::shop::product_image_path` for the "front" view, served
    // publicly from the embedded assets at shop.engmanager.xyz.
    format!("{IMAGE_ORIGIN}/assets/shop/caps/{}-front.webp", p.slug)
}

async fn upsert_product(client: &Client, key: &str, p: &ShopProduct) -> Result<CatalogEntry> {
    let image = front_image_url(p);
    let existing = search_product_by_slug(client, key, p.slug).await?;

    let (product_id, mut default_price) = match existing {
        Some(prod) => (
            prod["id"].as_str().unwrap_or_default().to_string(),
            prod["default_price"].as_str().map(str::to_string),
        ),
        None => {
            let form: Vec<(&str, String)> = vec![
                ("name", p.name.to_string()),
                ("description", p.description.to_string()),
                ("shippable", "true".to_string()),
                ("url", format!("{IMAGE_ORIGIN}/products/{}", p.slug)),
                ("images[0]", image.clone()),
                ("metadata[slug]", p.slug.to_string()),
                ("metadata[phrase]", p.phrase.to_string()),
                ("metadata[cap_color]", p.cap_color.to_string()),
                ("metadata[thread_color]", p.thread_color.to_string()),
                ("metadata[accent_color]", p.accent_color.to_string()),
                ("metadata[source]", "website/src/pages/shop.rs".to_string()),
            ];
            let idem = format!("product-{}-{SYNC_VERSION}", p.slug);
            let prod = post(client, key, "/products", &form, Some(&idem)).await?;
            (prod["id"].as_str().unwrap_or_default().to_string(), None)
        }
    };

    let amount = unit_amount(p);
    let price_id = match default_price.take() {
        Some(id) => id,
        None => {
            let form: Vec<(&str, String)> = vec![
                ("currency", "usd".to_string()),
                ("unit_amount", amount.to_string()),
                ("product", product_id.clone()),
                ("metadata[slug]", p.slug.to_string()),
            ];
            let idem = format!("price-{}-{amount}-{SYNC_VERSION}", p.slug);
            let price = post(client, key, "/prices", &form, Some(&idem)).await?;
            let price_id = price["id"].as_str().unwrap_or_default().to_string();
            // Make it the product's default price for clean checkout wiring.
            let set: Vec<(&str, String)> = vec![("default_price", price_id.clone())];
            post(client, key, &format!("/products/{product_id}"), &set, None).await?;
            price_id
        }
    };

    Ok(CatalogEntry {
        slug: p.slug.to_string(),
        name: p.name.to_string(),
        product_id,
        price_id,
        unit_amount: amount,
        currency: "usd".to_string(),
        image,
        livemode: key.starts_with("sk_live_"),
    })
}

async fn search_product_by_slug(client: &Client, key: &str, slug: &str) -> Result<Option<Value>> {
    let resp = client
        .get(format!("{STRIPE_API}/products/search"))
        .basic_auth(key, Some(""))
        .query(&[
            ("query", format!("metadata['slug']:'{slug}'")),
            ("limit", "1".to_string()),
        ])
        .send()
        .await?;
    let status = resp.status();
    let body: Value = resp.json().await?;
    if !status.is_success() {
        bail!(
            "Stripe {status} on /products/search: {}",
            error_message(&body)
        );
    }
    Ok(body["data"].as_array().and_then(|d| d.first()).cloned())
}

async fn post(
    client: &Client,
    key: &str,
    path: &str,
    form: &[(&str, String)],
    idempotency_key: Option<&str>,
) -> Result<Value> {
    let mut req = client
        .post(format!("{STRIPE_API}{path}"))
        .basic_auth(key, Some(""))
        .form(form);
    if let Some(k) = idempotency_key {
        req = req.header("Idempotency-Key", k);
    }
    let resp = req.send().await?;
    let status = resp.status();
    let body: Value = resp.json().await?;
    if !status.is_success() {
        bail!("Stripe {status} on {path}: {}", error_message(&body));
    }
    Ok(body)
}

fn error_message(body: &Value) -> String {
    body.pointer("/error/message")
        .and_then(Value::as_str)
        .unwrap_or("unknown error")
        .to_string()
}

// ---------------------------------------------------------------------------
// Runtime checkout context
//
// The `stripe-sync` subcommand above runs once and exits. The pieces below are
// what the *live server* uses to mint PaymentIntents for the on-site Stripe
// Elements checkout and to verify incoming webhooks. Kept in this module so all
// Stripe API surface — auth, error handling, the `post` helper — lives in one
// place. The context is built once at startup and shared via `AppState`.
// ---------------------------------------------------------------------------

/// Reused Stripe client + keys for the running server. Every field is optional
/// so the site still boots when Stripe isn't configured locally; checkout then
/// reports "unavailable" instead of panicking. `STRIPE_SECRET_KEY` mints
/// intents, `STRIPE_PUBLISHABLE_KEY` is handed to the browser to mount
/// Elements, `STRIPE_WEBHOOK_SECRET` verifies webhook signatures.
pub struct Checkout {
    client: Client,
    secret_key: Option<String>,
    publishable_key: Option<String>,
    webhook_secret: Option<String>,
}

impl Checkout {
    pub fn from_env() -> Self {
        let read = |name: &str| std::env::var(name).ok().filter(|v| !v.trim().is_empty());
        Checkout {
            client: Client::new(),
            secret_key: read("STRIPE_SECRET_KEY"),
            publishable_key: read("STRIPE_PUBLISHABLE_KEY"),
            webhook_secret: read("STRIPE_WEBHOOK_SECRET"),
        }
    }

    /// A working checkout needs both a secret key (to create intents) and a
    /// publishable key (for the browser to mount Elements).
    pub fn is_enabled(&self) -> bool {
        self.secret_key.is_some() && self.publishable_key.is_some()
    }

    /// The `pk_…` key embedded in the page so Stripe.js can mount Elements.
    /// Empty string when unset — the client treats that as "checkout off".
    pub fn publishable_key(&self) -> &str {
        self.publishable_key.as_deref().unwrap_or("")
    }

    pub fn webhook_configured(&self) -> bool {
        self.webhook_secret.is_some()
    }

    /// POST to the Stripe API with the runtime secret key. Thin wrapper over the
    /// module-level `post` (shared with the sync tool) so both get the same
    /// basic-auth + error extraction. Errors when no secret key is configured.
    pub(crate) async fn post(
        &self,
        path: &str,
        form: &[(&str, String)],
        idempotency_key: Option<&str>,
    ) -> Result<Value> {
        let key = self
            .secret_key
            .as_deref()
            .context("STRIPE_SECRET_KEY not configured — server checkout is disabled")?;
        post(&self.client, key, path, form, idempotency_key).await
    }

    /// Verify a raw webhook body against the `Stripe-Signature` header using the
    /// configured signing secret. Constant-time comparison (via `verify_slice`)
    /// plus a 5-minute timestamp tolerance to blunt replay. Returns the parsed
    /// event JSON on success.
    pub(crate) fn verify_event(&self, payload: &[u8], sig_header: &str) -> Result<Value> {
        let secret = self
            .webhook_secret
            .as_deref()
            .context("STRIPE_WEBHOOK_SECRET not configured")?;

        // Header form: `t=1690000000,v1=hexdigest[,v1=…][,v0=…]`.
        let mut timestamp: Option<i64> = None;
        let mut signatures: Vec<&str> = Vec::new();
        for part in sig_header.split(',') {
            let Some((k, v)) = part.split_once('=') else {
                continue;
            };
            match k.trim() {
                "t" => timestamp = v.trim().parse::<i64>().ok(),
                "v1" => signatures.push(v.trim()),
                _ => {}
            }
        }
        let timestamp = timestamp.context("missing timestamp in Stripe-Signature")?;
        if signatures.is_empty() {
            bail!("no v1 signature in Stripe-Signature header");
        }

        // Replay protection: reject events whose timestamp drifts > 5 minutes.
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        if now != 0 && (now - timestamp).abs() > 300 {
            bail!(
                "Stripe-Signature timestamp outside tolerance ({}s drift)",
                (now - timestamp).abs()
            );
        }

        // signed_payload = "{t}.{raw_body}". Recompute per candidate signature
        // and compare in constant time.
        for sig in &signatures {
            let Ok(sig_bytes) = hex::decode(sig) else {
                continue;
            };
            let mut mac =
                HmacSha256::new_from_slice(secret.as_bytes()).context("invalid webhook secret")?;
            mac.update(timestamp.to_string().as_bytes());
            mac.update(b".");
            mac.update(payload);
            if mac.verify_slice(&sig_bytes).is_ok() {
                return serde_json::from_slice(payload).context("event body is not valid JSON");
            }
        }
        bail!("Stripe-Signature verification failed")
    }
}

fn write_catalog(new: &BTreeMap<String, CatalogEntry>, live: bool) -> Result<()> {
    let path = if live {
        "data/stripe-catalog.live.json"
    } else {
        "data/stripe-catalog.test.json"
    };

    // Merge into any existing map so a `--only` run never clobbers other slugs.
    let mut products: serde_json::Map<String, Value> = std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v.get("products").cloned())
        .and_then(|p| p.as_object().cloned())
        .unwrap_or_default();

    for (slug, entry) in new {
        products.insert(slug.clone(), serde_json::to_value(entry)?);
    }

    let doc = json!({
        "mode": if live { "live" } else { "test" },
        "currency": "usd",
        "products": products,
    });
    std::fs::write(path, serde_json::to_string_pretty(&doc)? + "\n")
        .with_context(|| format!("writing {path}"))?;
    println!("\nWrote {path} ({} product(s) total).", products.len());
    Ok(())
}
