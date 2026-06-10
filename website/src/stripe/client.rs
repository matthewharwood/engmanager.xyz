//! Shared Stripe REST plumbing: one timeout'd `reqwest::Client` builder plus
//! the form-POST + error-extraction helpers used by BOTH Stripe programs in
//! this crate — the runtime checkout context (`checkout.rs`) and the
//! `stripe-sync` CLI (`sync.rs`). (Patterns: GRAYSON rule 2 — time-bound all
//! I/O; rust-production-reliability "timeouts".)

use std::time::Duration;

use anyhow::{Result, bail};
use reqwest::Client;
use serde_json::Value;

pub(crate) const STRIPE_API: &str = "https://api.stripe.com/v1";

// TCP connect deadline, separate from the total request deadline: a
// blackholed route fails in 5s instead of eating the whole request budget.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const USER_AGENT: &str = "engmanager.xyz/1.0 (+https://engmanager.xyz)";

/// Build the Stripe API client with a total per-request deadline. The runtime
/// `Checkout` uses 15s (a hung Stripe call must not pin `POST
/// /api/checkout/intent` open until the router's 30s ceiling) and the sync
/// CLI uses a laxer 30s. `reqwest::Client` is internally Arc'd over its
/// connection pool, so each program builds exactly one.
pub(crate) fn api_client(timeout: Duration) -> Client {
    Client::builder()
        .timeout(timeout)
        .connect_timeout(CONNECT_TIMEOUT)
        .user_agent(USER_AGENT)
        .build()
        // Only fails if the TLS backend can't initialize — unrecoverable at
        // process scope, same failure mode as the old `Client::new()`.
        .expect("build Stripe reqwest client")
}

/// Form-POST to the Stripe API with basic auth + optional idempotency key,
/// extracting Stripe's error message on non-2xx. Shared by the runtime
/// checkout and the sync CLI so both get identical auth + error handling.
pub(crate) async fn post(
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

pub(crate) fn error_message(body: &Value) -> String {
    body.pointer("/error/message")
        .and_then(Value::as_str)
        .unwrap_or("unknown error")
        .to_string()
}
