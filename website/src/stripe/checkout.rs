//! Runtime checkout context for the live server.
//!
//! The `stripe-sync` subcommand (`sync.rs`) runs once and exits; this module
//! is what the *running server* uses to mint PaymentIntents for the on-site
//! Stripe Elements checkout and to verify incoming webhooks. The context is
//! built once at startup and shared via `AppState`.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result, bail};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde_json::Value;
use sha2::Sha256;

use super::client::{api_client, post};

type HmacSha256 = Hmac<Sha256>;

// Total deadline for runtime Stripe calls. POST /api/checkout/intent awaits
// this client on the request path, so it must give up well inside the
// router's 30s TimeoutLayer ceiling instead of hanging a buyer's checkout.
const RUNTIME_HTTP_TIMEOUT: Duration = Duration::from_secs(15);

/// Reused Stripe client + keys for the running server. Every field is optional
/// so the site still boots when Stripe isn't configured locally; checkout then
/// reports "unavailable" instead of panicking. `STRIPE_SECRET_KEY` mints
/// intents, `STRIPE_PUBLISHABLE_KEY` is handed to the browser to mount
/// Elements, `STRIPE_WEBHOOK_SECRET` verifies webhook signatures.
///
/// Secret hygiene: deliberately derives neither `Debug` nor `Clone` — the
/// secret key must never leak through debug formatting, and one instance
/// behind an `Arc` is the only intended shape.
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
            client: api_client(RUNTIME_HTTP_TIMEOUT),
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

    /// POST to the Stripe API with the runtime secret key. Thin wrapper over
    /// `client::post` (shared with the sync tool) so both get the same
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
