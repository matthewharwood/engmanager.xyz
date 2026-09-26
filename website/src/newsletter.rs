//! Server-only Kit signup service. The website owns the form; Kit owns
//! subscriber status, confirmation emails, and suppression.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::extract::State;
use axum::extract::rejection::FormRejection;
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{Html, Redirect, Response};
use axum::{Form, Json};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use tokio::sync::Semaphore;

const KIT_API: &str = "https://api.kit.com/v4";
const SIGNUP_REFERRER: &str = "https://engmanager.xyz/subscribe";
const UNSUBSCRIBE_ORIGIN: &str = "https://engmanager.xyz/unsubscribe";
const UNSUBSCRIBE_FIELD: &str = "engmanager_unsubscribe_url";
const TOKEN_PURPOSE: &[u8] = b"engmanager.xyz/kit/unsubscribe/v1\0";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const MAX_CONCURRENT_SIGNUPS: usize = 8;
const MAX_SIGNUP_ATTEMPTS: usize = 30;
// Separate abuse budgets keep cancellation available during signup bursts.
// An additional shared per-request budget stays below Kit's 120/min key limit.
const MAX_UNSUBSCRIBE_ATTEMPTS: usize = 20;
const MAX_UNSUBSCRIBE_PER_RECIPIENT: usize = 3;
const MAX_KIT_REQUESTS: usize = 100;
const SIGNUP_WINDOW: Duration = Duration::from_secs(60);

/// No Debug implementation: API credentials must never reach logs. The
/// service is shared through Arc, keeping one HTTP connection pool.
pub struct Newsletter {
    client: Client,
    config: Option<KitConfig>,
    // None allows the pre-rollout signup flow. An explicitly invalid secret
    // fails closed; it must never silently fall back to unsigned links.
    signing_key: Result<Option<Vec<u8>>, ()>,
    permits: Semaphore,
    rate_budget: Mutex<RateBudget>,
    unsubscribe_budget: Mutex<VecDeque<(Instant, u64)>>,
    api_budget: Mutex<VecDeque<Instant>>,
    // Fixed in production; only the module's tests inject a local mock.
    api_base: String,
}

struct KitConfig {
    api_key: HeaderValue,
    form_id: u64,
}

impl Newsletter {
    pub fn from_env() -> Self {
        Self::with_config(
            std::env::var("KIT_API_KEY").ok().as_deref(),
            std::env::var("KIT_FORM_ID").ok().as_deref(),
            std::env::var("NEWSLETTER_UNSUBSCRIBE_SECRET")
                .ok()
                .as_deref(),
        )
    }

    /// Deterministic unconfigured service, including in router tests.
    pub fn disabled() -> Self {
        Self::with_config(None, None, None)
    }

    pub fn is_enabled(&self) -> bool {
        self.config.is_some() && self.signing_key.is_ok()
    }

    fn with_config(api_key: Option<&str>, form_id: Option<&str>, secret: Option<&str>) -> Self {
        Self {
            client: Client::builder()
                .timeout(REQUEST_TIMEOUT)
                .connect_timeout(CONNECT_TIMEOUT)
                // Do not forward our API-key header through redirects.
                .redirect(reqwest::redirect::Policy::none())
                .user_agent("engmanager.xyz/1.0 (+https://engmanager.xyz)")
                .build()
                .expect("build newsletter HTTP client"),
            config: KitConfig::parse(api_key, form_id),
            signing_key: match secret {
                None => Ok(None),
                Some(secret) if secret.trim().len() >= 32 => Ok(Some(secret.as_bytes().to_vec())),
                Some(_) => Err(()),
            },
            permits: Semaphore::new(MAX_CONCURRENT_SIGNUPS),
            rate_budget: Mutex::new(RateBudget::default()),
            unsubscribe_budget: Mutex::new(VecDeque::new()),
            api_budget: Mutex::new(VecDeque::new()),
            api_base: KIT_API.to_owned(),
        }
    }

    async fn add_subscriber(&self, email: &str) -> Result<(), SignupError> {
        self.signing_key
            .as_ref()
            .map_err(|_| SignupError::Unavailable)?;
        let config = self.config.as_ref().ok_or(SignupError::Unavailable)?;
        // Bound upstream work without building an unbounded request queue.
        let _permit = self
            .permits
            .try_acquire()
            .map_err(|_| SignupError::Unavailable)?;

        // One bounded, process-wide rolling budget. No IP-header trust or
        // email addresses are needed; short-lived hashes provide deduping.
        let email_hash: [u8; 32] = Sha256::digest(email.to_ascii_lowercase()).into();
        match self
            .rate_budget
            .lock()
            .map_err(|_| SignupError::Unavailable)?
            .reserve(email_hash, Instant::now())
        {
            Reservation::Duplicate => return Ok(()),
            Reservation::Limited => return Err(SignupError::Unavailable),
            Reservation::Reserved => {}
        }
        let result = self.add_to_kit(email, config).await;
        if result.is_err() {
            // A partial failure can be retried without waiting for the
            // cooldown. It still consumes the shared attempt budget.
            if let Ok(mut budget) = self.rate_budget.lock() {
                budget.release_email(email_hash);
            }
        } else if let Ok(mut budget) = self.rate_budget.lock() {
            budget.complete_email(email_hash);
        }
        result
    }

    async fn add_to_kit(&self, email: &str, config: &KitConfig) -> Result<(), SignupError> {
        self.reserve_api_request()?;
        let response = self
            .client
            .post(format!("{}/subscribers", self.api_base))
            .header("X-Kit-Api-Key", config.api_key.clone())
            // Kit defaults to active. Explicitly start NEW subscribers as
            // inactive, so confirmation is required before broadcasts.
            // This upsert does not change an EXISTING subscriber's state.
            .json(&json!({ "email_address": email, "state": "inactive" }))
            .send()
            .await
            .map_err(|_| SignupError::Network)?;
        require_success(response.status())?;
        let subscriber = response
            .json::<SubscriberResponse>()
            .await
            .map_err(|_| SignupError::InvalidResponse)?
            .subscriber;

        match subscriber.state.as_str() {
            // Never reactivate a suppression or trigger another form's
            // confirmation for it. The public response reveals no status.
            "cancelled" | "bounced" | "complained" | "blocked" => return Ok(()),
            "active" | "inactive" if subscriber.id > 0 => {}
            _ => return Err(SignupError::InvalidResponse),
        }

        if let Some(key) = self
            .signing_key
            .as_ref()
            .map_err(|_| SignupError::Unavailable)?
        {
            // Persist and verify the personal footer URL BEFORE adding the
            // subscriber to the form, which may immediately send confirmation.
            let token = unsubscribe_token(key, config.form_id, subscriber.id);
            let url = format!("{UNSUBSCRIBE_ORIGIN}?token={token}");
            self.reserve_api_request()?;
            let response = self
                .client
                .put(format!("{}/subscribers/{}", self.api_base, subscriber.id))
                .header("X-Kit-Api-Key", config.api_key.clone())
                .json(&json!({ "email_address": email, "fields": { UNSUBSCRIBE_FIELD: url } }))
                .send()
                .await
                .map_err(|_| SignupError::Network)?;
            require_success(response.status())?;
            let updated = response
                .json::<SubscriberResponse>()
                .await
                .map_err(|_| SignupError::InvalidResponse)?
                .subscriber;
            if updated.id != subscriber.id
                || updated
                    .fields
                    .get(UNSUBSCRIBE_FIELD)
                    .and_then(serde_json::Value::as_str)
                    != Some(url.as_str())
            {
                return Err(SignupError::InvalidResponse);
            }
            match updated.state.as_str() {
                // Respect cancellation that happened between the initial
                // upsert and the custom-field update. Never change state here.
                "cancelled" | "bounced" | "complained" | "blocked" => return Ok(()),
                "active" | "inactive" => {}
                _ => return Err(SignupError::InvalidResponse),
            }
        }

        // The configured Kit form MUST have its confirmation email enabled
        // and auto-confirm disabled. Adding the subscriber to that form
        // triggers Kit's double opt-in flow. Re-adding a form member is
        // idempotent and does not resend the confirmation email.
        self.reserve_api_request()?;
        let response = self
            .client
            .post(format!(
                "{}/forms/{}/subscribers/{}",
                self.api_base, config.form_id, subscriber.id
            ))
            .header("X-Kit-Api-Key", config.api_key.clone())
            .json(&json!({ "referrer": SIGNUP_REFERRER }))
            .send()
            .await
            .map_err(|_| SignupError::Network)?;
        require_success(response.status())
    }

    async fn remove_subscriber(&self, token: &str) -> Result<(), UnsubscribeError> {
        let config = self.config.as_ref().ok_or(UnsubscribeError::Unavailable)?;
        let key = self
            .signing_key
            .as_ref()
            .ok()
            .and_then(Option::as_ref)
            .ok_or(UnsubscribeError::Unavailable)?;
        let subscriber_id = verify_unsubscribe_token(key, config.form_id, token)
            .ok_or(UnsubscribeError::Invalid)?;
        let _permit = self
            .permits
            .try_acquire()
            .map_err(|_| UnsubscribeError::Unavailable)?;
        {
            let now = Instant::now();
            let mut budget = self
                .unsubscribe_budget
                .lock()
                .map_err(|_| UnsubscribeError::Unavailable)?;
            while budget
                .front()
                .is_some_and(|(at, _)| now.duration_since(*at) >= SIGNUP_WINDOW)
            {
                budget.pop_front();
            }
            if budget.len() >= MAX_UNSUBSCRIBE_ATTEMPTS
                || budget.iter().filter(|(_, id)| *id == subscriber_id).count()
                    >= MAX_UNSUBSCRIBE_PER_RECIPIENT
            {
                return Err(UnsubscribeError::Unavailable);
            }
            budget.push_back((now, subscriber_id));
        }
        // Kit's cancellation is idempotent. Never locally cache consent state:
        // a later explicit resubscription must still be revocable by this link.
        self.reserve_api_request()
            .map_err(|_| UnsubscribeError::Unavailable)?;
        let response = self
            .client
            .post(format!(
                "{}/subscribers/{subscriber_id}/unsubscribe",
                self.api_base
            ))
            .header("X-Kit-Api-Key", config.api_key.clone())
            .json(&json!({}))
            .send()
            .await
            .map_err(|_| UnsubscribeError::Upstream)?;
        if response.status() == StatusCode::NO_CONTENT {
            Ok(())
        } else {
            Err(UnsubscribeError::Upstream)
        }
    }

    fn reserve_api_request(&self) -> Result<(), SignupError> {
        let now = Instant::now();
        let mut budget = self
            .api_budget
            .lock()
            .map_err(|_| SignupError::Unavailable)?;
        while budget
            .front()
            .is_some_and(|at| now.duration_since(*at) >= SIGNUP_WINDOW)
        {
            budget.pop_front();
        }
        if budget.len() >= MAX_KIT_REQUESTS {
            return Err(SignupError::Unavailable);
        }
        budget.push_back(now);
        Ok(())
    }
}

// The configured Kit form uniquely scopes the account/list together with a
// dedicated secret. No email address, API key, or expiring session is encoded.
fn token_mac(key: &[u8], form_id: u64, subscriber_id: u64) -> Hmac<Sha256> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts every key length");
    mac.update(TOKEN_PURPOSE);
    mac.update(&form_id.to_be_bytes());
    mac.update(&subscriber_id.to_be_bytes());
    mac
}

fn unsubscribe_token(key: &[u8], form_id: u64, subscriber_id: u64) -> String {
    let signature = hex::encode(
        token_mac(key, form_id, subscriber_id)
            .finalize()
            .into_bytes(),
    );
    format!("v1.{subscriber_id}.{signature}")
}

fn verify_unsubscribe_token(key: &[u8], form_id: u64, token: &str) -> Option<u64> {
    if token.len() > 88 {
        return None;
    }
    let mut parts = token.split('.');
    if parts.next()? != "v1" {
        return None;
    }
    let id_text = parts.next()?;
    let id = id_text.parse::<u64>().ok().filter(|id| *id > 0)?;
    if id.to_string() != id_text {
        return None;
    }
    let signature = parts.next()?;
    if signature.len() != 64 || parts.next().is_some() {
        return None;
    }
    let signature = hex::decode(signature).ok()?;
    token_mac(key, form_id, id).verify_slice(&signature).ok()?;
    Some(id)
}

impl KitConfig {
    fn parse(api_key: Option<&str>, form_id: Option<&str>) -> Option<Self> {
        let key = api_key?.trim();
        if key.is_empty() {
            return None;
        }
        let mut api_key = HeaderValue::from_str(key).ok()?;
        api_key.set_sensitive(true);
        let form_id = form_id?.trim().parse::<u64>().ok().filter(|id| *id > 0)?;
        Some(Self { api_key, form_id })
    }
}

#[derive(Deserialize)]
struct SubscriberResponse {
    subscriber: Subscriber,
}

#[derive(Deserialize)]
struct Subscriber {
    id: u64,
    state: String,
    #[serde(default)]
    fields: serde_json::Map<String, serde_json::Value>,
}

#[derive(Deserialize)]
pub struct SignupForm {
    email: String,
    #[serde(default)]
    website: String,
}

/// Ordinary HTML form POST + 303 redirect works without JavaScript and
/// prevents refreshing the result page from repeating the API request.
pub async fn subscribe(
    State(newsletter): State<Arc<Newsletter>>,
    form: Result<Form<SignupForm>, FormRejection>,
) -> Response {
    let Ok(Form(form)) = form else {
        return result_redirect("invalid");
    };
    if !form.website.trim().is_empty() {
        // Honeypot: look successful without contacting Kit.
        return result_redirect("check-email");
    }
    let Some(email) = validated_email(&form.email) else {
        return result_redirect("invalid");
    };
    match newsletter.add_subscriber(&email).await {
        Ok(()) => result_redirect("check-email"),
        Err(SignupError::Unavailable) => result_redirect("unavailable"),
        Err(error) => {
            // Only fixed categories/status codes. Never log the email,
            // request headers, response body, or raw reqwest error.
            tracing::warn!(
                kind = error.kind(),
                status = error.status(),
                "newsletter signup failed"
            );
            result_redirect("error")
        }
    }
}

#[derive(Deserialize)]
pub struct UnsubscribeForm {
    token: String,
}

enum UnsubscribeError {
    Invalid,
    Unavailable,
    Upstream,
}

/// Browser enhancement uses JSON; the ordinary form POST works without JS.
/// GET is rendered separately and never contacts Kit or changes consent.
pub async fn unsubscribe(
    State(newsletter): State<Arc<Newsletter>>,
    headers: HeaderMap,
    form: Result<Form<UnsubscribeForm>, FormRejection>,
) -> Response {
    let result = match form {
        Ok(Form(form)) => newsletter.remove_subscriber(&form.token).await,
        Err(_) => Err(UnsubscribeError::Invalid),
    };
    let (status, message) = match &result {
        Ok(()) => (StatusCode::OK, "You’re unsubscribed."),
        Err(UnsubscribeError::Invalid) => (
            StatusCode::BAD_REQUEST,
            "This unsubscribe link is invalid. Please use the link in your email or contact matthew@engmanager.xyz.",
        ),
        Err(UnsubscribeError::Unavailable) => (
            StatusCode::SERVICE_UNAVAILABLE,
            "Unsubscribe is temporarily unavailable. Please try again or contact matthew@engmanager.xyz.",
        ),
        Err(UnsubscribeError::Upstream) => (
            StatusCode::BAD_GATEWAY,
            "We couldn’t confirm your unsubscribe. Please try again or contact matthew@engmanager.xyz.",
        ),
    };
    let wants_json = headers
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            value
                .split(',')
                .any(|mime| mime.trim().split(';').next() == Some("application/json"))
        });
    if wants_json {
        let body = if result.is_ok() {
            json!({ "status": "unsubscribed" })
        } else {
            json!({ "error": message })
        };
        crate::http::no_store((status, Json(body)))
    } else {
        let page = if matches!(result, Err(UnsubscribeError::Invalid)) {
            crate::pages::newsletter::unsubscribe_page(None)
        } else {
            crate::pages::newsletter::unsubscribe_result(result.is_ok())
        };
        crate::http::no_store((status, Html(page)))
    }
}

fn result_redirect(status: &str) -> Response {
    crate::http::no_store(Redirect::to(&format!("/subscribe?status={status}")))
}

#[derive(Default)]
struct RateBudget {
    attempts: VecDeque<Attempt>,
}

struct Attempt {
    at: Instant,
    email_hash: Option<[u8; 32]>,
    completed: bool,
}

#[derive(Debug, PartialEq)]
enum Reservation {
    Reserved,
    Duplicate,
    Limited,
}

impl RateBudget {
    fn reserve(&mut self, email_hash: [u8; 32], now: Instant) -> Reservation {
        while self
            .attempts
            .front()
            .is_some_and(|attempt| now.duration_since(attempt.at) >= SIGNUP_WINDOW)
        {
            self.attempts.pop_front();
        }
        if let Some(attempt) = self
            .attempts
            .iter()
            .find(|attempt| attempt.email_hash == Some(email_hash))
        {
            // Don't claim a confirmation was requested before the first
            // in-flight attempt has actually finished successfully.
            return if attempt.completed {
                Reservation::Duplicate
            } else {
                Reservation::Limited
            };
        }
        if self.attempts.len() >= MAX_SIGNUP_ATTEMPTS {
            return Reservation::Limited;
        }
        self.attempts.push_back(Attempt {
            at: now,
            email_hash: Some(email_hash),
            completed: false,
        });
        Reservation::Reserved
    }

    fn release_email(&mut self, email_hash: [u8; 32]) {
        for attempt in &mut self.attempts {
            if attempt.email_hash == Some(email_hash) {
                attempt.email_hash = None;
            }
        }
    }

    fn complete_email(&mut self, email_hash: [u8; 32]) {
        for attempt in &mut self.attempts {
            if attempt.email_hash == Some(email_hash) {
                attempt.completed = true;
            }
        }
    }
}

/// Conservative public email-form validation: ASCII dot-atom local parts
/// and DNS hostnames. Preserve local-part case, normalize domain case, and
/// leave actual address ownership verification to Kit's confirmation email.
fn validated_email(value: &str) -> Option<String> {
    let value = value.trim();
    if value.len() > 254 || !value.is_ascii() {
        return None;
    }
    let (local, domain) = value.split_once('@')?;
    if local.is_empty()
        || local.len() > 64
        || local.starts_with('.')
        || local.ends_with('.')
        || local.contains("..")
        || !local
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".!#$%&'*+-/=?^_`{|}~".contains(&b))
        || !domain.contains('.')
        || domain.split('.').any(|label| {
            label.is_empty()
                || label.len() > 63
                || label.starts_with('-')
                || label.ends_with('-')
                || !label
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
    {
        return None;
    }
    Some(format!("{local}@{}", domain.to_ascii_lowercase()))
}

enum SignupError {
    Unavailable,
    Network,
    Upstream(StatusCode),
    InvalidResponse,
}

impl SignupError {
    fn kind(&self) -> &'static str {
        match self {
            Self::Unavailable => "unavailable",
            Self::Network => "network",
            Self::Upstream(_) => "upstream",
            Self::InvalidResponse => "invalid-response",
        }
    }

    fn status(&self) -> Option<u16> {
        match self {
            Self::Upstream(status) => Some(status.as_u16()),
            _ => None,
        }
    }
}

fn require_success(status: StatusCode) -> Result<(), SignupError> {
    if status.is_success() {
        Ok(())
    } else {
        Err(SignupError::Upstream(status))
    }
}

#[cfg(test)]
mod tests {
    use std::collections::VecDeque;
    use std::sync::Mutex;

    use axum::Router;
    use axum::body::{Body, to_bytes};
    use axum::extract::DefaultBodyLimit;
    use axum::http::{HeaderMap, Request, header};
    use axum::response::IntoResponse;
    use axum::routing::post;
    use serde_json::Value;
    use tower::ServiceExt;

    use super::*;

    const TEST_KEY: &str = "test-key-only";
    const TEST_SECRET: &str = "newsletter-test-signing-key-32-bytes-minimum";

    struct CapturedRequest {
        method: String,
        path: String,
        headers: HeaderMap,
        body: Value,
    }

    struct MockReply {
        status: StatusCode,
        body: String,
        delay: Duration,
        location: Option<&'static str>,
    }

    impl MockReply {
        fn subscriber(status: StatusCode, state: &str) -> Self {
            Self::json(
                status,
                json!({ "subscriber": { "id": 42, "state": state } }),
            )
        }

        fn json(status: StatusCode, body: Value) -> Self {
            Self {
                status,
                body: body.to_string(),
                delay: Duration::ZERO,
                location: None,
            }
        }
    }

    #[derive(Clone)]
    struct MockState {
        calls: Arc<Mutex<Vec<CapturedRequest>>>,
        replies: Arc<Mutex<VecDeque<MockReply>>>,
    }

    struct MockKit {
        base: String,
        state: MockState,
        task: tokio::task::JoinHandle<()>,
    }

    impl MockKit {
        async fn start(replies: Vec<MockReply>) -> Self {
            let state = MockState {
                calls: Arc::new(Mutex::new(Vec::new())),
                replies: Arc::new(Mutex::new(replies.into())),
            };
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let base = format!("http://{}/v4", listener.local_addr().unwrap());
            let app = Router::new()
                .fallback(mock_handler)
                .with_state(state.clone());
            let task = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
            Self { base, state, task }
        }

        fn service(&self) -> Newsletter {
            let mut service = Newsletter::with_config(Some(TEST_KEY), Some("123"), None);
            service.api_base.clone_from(&self.base);
            service
        }

        fn signed_service(&self) -> Newsletter {
            let mut service =
                Newsletter::with_config(Some(TEST_KEY), Some("123"), Some(TEST_SECRET));
            service.api_base.clone_from(&self.base);
            service
        }

        fn call_count(&self) -> usize {
            self.state.calls.lock().unwrap().len()
        }
    }

    impl Drop for MockKit {
        fn drop(&mut self) {
            self.task.abort();
        }
    }

    async fn mock_handler(State(state): State<MockState>, request: Request<Body>) -> Response {
        let (parts, body) = request.into_parts();
        let body = to_bytes(body, 4096).await.unwrap();
        state.calls.lock().unwrap().push(CapturedRequest {
            method: parts.method.to_string(),
            path: parts.uri.path().to_owned(),
            headers: parts.headers,
            body: serde_json::from_slice(&body).unwrap(),
        });
        let reply = state
            .replies
            .lock()
            .unwrap()
            .pop_front()
            .expect("unexpected Kit request");
        tokio::time::sleep(reply.delay).await;
        let mut response = (reply.status, reply.body).into_response();
        if let Some(location) = reply.location {
            response
                .headers_mut()
                .insert(header::LOCATION, HeaderValue::from_static(location));
        }
        response
    }

    fn test_router(service: Newsletter) -> Router {
        Router::new()
            .route("/api/newsletter/subscribe", post(subscribe))
            .route("/api/newsletter/unsubscribe", post(unsubscribe))
            .route(
                "/unsubscribe",
                axum::routing::get(crate::pages::newsletter::unsubscribe),
            )
            .layer(DefaultBodyLimit::max(4096))
            .layer(axum::middleware::from_fn(
                crate::http::security_headers_layer,
            ))
            .layer(axum::middleware::from_fn(crate::http::html_cache_layer))
            .with_state(Arc::new(service))
    }

    async fn submit_unsubscribe(router: &Router, token: &str, json_response: bool) -> Response {
        let body = form_urlencoded::Serializer::new(String::new())
            .append_pair("token", token)
            .finish();
        router
            .clone()
            .oneshot(
                Request::post("/api/newsletter/unsubscribe")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .header(
                        header::ACCEPT,
                        if json_response {
                            "application/json"
                        } else {
                            "text/html"
                        },
                    )
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap()
    }

    fn assert_private(response: &Response) {
        assert_eq!(
            response.headers()[header::CACHE_CONTROL],
            "no-store, no-transform"
        );
        assert_eq!(response.headers()[header::REFERRER_POLICY], "no-referrer");
        assert_eq!(
            response.headers()["cloudflare-cdn-cache-control"],
            "no-store"
        );
        assert!(
            response.headers()["x-robots-tag"]
                .to_str()
                .unwrap()
                .contains("noindex")
        );
        assert!(!response.headers().contains_key("cache-tag"));
    }

    #[test]
    fn unsubscribe_tokens_are_bound_to_recipient_account_and_purpose() {
        let token = unsubscribe_token(TEST_SECRET.as_bytes(), 123, 42);
        assert_eq!(
            verify_unsubscribe_token(TEST_SECRET.as_bytes(), 123, &token),
            Some(42)
        );
        assert_eq!(
            verify_unsubscribe_token(TEST_SECRET.as_bytes(), 999, &token),
            None
        );
        assert_eq!(
            verify_unsubscribe_token(b"a different secret with at least 32 bytes", 123, &token),
            None
        );
        for invalid in [
            token.replace("v1.42.", "v1.43."),
            token.replace("v1.", "v2."),
            token.replace("v1.42.", "v1.042."),
            format!("{token}.extra"),
            "a".repeat(512),
            format!("v1.42.{}", "0".repeat(64)),
        ] {
            assert_eq!(
                verify_unsubscribe_token(TEST_SECRET.as_bytes(), 123, &invalid),
                None
            );
        }
        let mut other_purpose = Hmac::<Sha256>::new_from_slice(TEST_SECRET.as_bytes()).unwrap();
        other_purpose.update(b"engmanager.xyz/kit/subscribe/v1\0");
        other_purpose.update(&123u64.to_be_bytes());
        other_purpose.update(&42u64.to_be_bytes());
        let wrong_purpose = format!(
            "v1.42.{}",
            hex::encode(other_purpose.finalize().into_bytes())
        );
        assert_eq!(
            verify_unsubscribe_token(TEST_SECRET.as_bytes(), 123, &wrong_purpose),
            None
        );
        assert!(!token.contains('@'));
    }

    #[tokio::test]
    async fn signed_footer_is_persisted_before_the_form_can_send_confirmation() {
        let token = unsubscribe_token(TEST_SECRET.as_bytes(), 123, 42);
        let url = format!("{UNSUBSCRIBE_ORIGIN}?token={token}");
        let kit = MockKit::start(vec![
            MockReply::subscriber(StatusCode::CREATED, "inactive"),
            MockReply::json(StatusCode::OK, json!({"subscriber": {"id":42,"state":"inactive","fields":{UNSUBSCRIBE_FIELD:url}}})),
            MockReply::json(StatusCode::CREATED, json!({})),
        ]).await;
        assert_redirect(
            &submit(
                &test_router(kit.signed_service()),
                "email=reader%40example.com",
            )
            .await,
            "check-email",
        );
        let calls = kit.state.calls.lock().unwrap();
        assert_eq!(calls.len(), 3);
        assert_eq!(
            (calls[1].method.as_str(), calls[1].path.as_str()),
            ("PUT", "/v4/subscribers/42")
        );
        assert_eq!(
            calls[1].body,
            json!({"email_address":"reader@example.com","fields":{UNSUBSCRIBE_FIELD:url}})
        );
        assert_eq!(calls[2].path, "/v4/forms/123/subscribers/42");
    }

    #[tokio::test]
    async fn missing_footer_persistence_stops_before_confirmation_is_sent() {
        for reply in [
            MockReply::subscriber(StatusCode::OK, "inactive"),
            MockReply::json(
                StatusCode::UNPROCESSABLE_ENTITY,
                json!({"error":"private details"}),
            ),
        ] {
            let kit = MockKit::start(vec![
                MockReply::subscriber(StatusCode::CREATED, "inactive"),
                reply,
            ])
            .await;
            assert_redirect(
                &submit(
                    &test_router(kit.signed_service()),
                    "email=reader%40example.com",
                )
                .await,
                "error",
            );
            assert_eq!(kit.call_count(), 2);
        }
    }

    #[tokio::test]
    async fn unsubscribe_get_and_head_are_inert_and_private() {
        let kit = MockKit::start(vec![]).await;
        let token = unsubscribe_token(TEST_SECRET.as_bytes(), 123, 42);
        let router = test_router(kit.signed_service());
        for method in ["GET", "HEAD"] {
            let response = router
                .clone()
                .oneshot(
                    Request::builder()
                        .method(method)
                        .uri(format!("/unsubscribe?token={token}"))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            assert_private(&response);
            let body = to_bytes(response.into_body(), 100_000).await.unwrap();
            let body = std::str::from_utf8(&body).unwrap();
            assert!(!body.contains("__engNav") && !body.contains("experiences.js"));
        }
        assert_eq!(kit.call_count(), 0);
    }

    #[tokio::test]
    async fn unsubscribe_repeats_are_safe_and_only_claim_success_after_kit_accepts() {
        let kit = MockKit::start(vec![
            MockReply::json(StatusCode::NO_CONTENT, json!({})),
            MockReply::json(StatusCode::NO_CONTENT, json!({})),
        ])
        .await;
        let router = test_router(kit.signed_service());
        let token = unsubscribe_token(TEST_SECRET.as_bytes(), 123, 42);
        for json_response in [true, false] {
            let response = submit_unsubscribe(&router, &token, json_response).await;
            assert_eq!(response.status(), StatusCode::OK);
            assert_private(&response);
            let body = to_bytes(response.into_body(), 100_000).await.unwrap();
            let body = std::str::from_utf8(&body).unwrap();
            assert!(!body.contains(&token) && !body.contains(TEST_KEY));
            if json_response {
                assert_eq!(
                    serde_json::from_str::<Value>(body).unwrap(),
                    json!({"status":"unsubscribed"})
                );
            }
        }
        let calls = kit.state.calls.lock().unwrap();
        assert_eq!(calls.len(), 2);
        assert!(calls.iter().all(|call| call.method == "POST"
            && call.path == "/v4/subscribers/42/unsubscribe"
            && call.body == json!({})));
    }

    #[tokio::test]
    async fn invalid_unsubscribe_tokens_never_contact_kit() {
        let kit = MockKit::start(vec![]).await;
        let router = test_router(kit.signed_service());
        for token in ["", "v1.42.invalid", "reader@example.com"] {
            let response = submit_unsubscribe(&router, token, true).await;
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
            assert_private(&response);
        }
        assert_eq!(kit.call_count(), 0);
    }

    #[tokio::test]
    async fn unsubscribe_failure_is_honest_and_retryable_without_leaking_provider_details() {
        for status in [
            StatusCode::UNAUTHORIZED,
            StatusCode::NOT_FOUND,
            StatusCode::TOO_MANY_REQUESTS,
            StatusCode::INTERNAL_SERVER_ERROR,
            StatusCode::OK,
        ] {
            let kit = MockKit::start(vec![
                MockReply::json(status, json!({"private":"reader@example.com"})),
                MockReply::json(StatusCode::NO_CONTENT, json!({})),
            ])
            .await;
            let router = test_router(kit.signed_service());
            let token = unsubscribe_token(TEST_SECRET.as_bytes(), 123, 42);
            let response = submit_unsubscribe(&router, &token, true).await;
            assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
            assert_private(&response);
            let body = to_bytes(response.into_body(), 4096).await.unwrap();
            let body = std::str::from_utf8(&body).unwrap();
            assert!(
                !body.contains("reader@example.com")
                    && !body.contains(&token)
                    && !body.contains("unsubscribed")
            );
            assert_eq!(
                submit_unsubscribe(&router, &token, true).await.status(),
                StatusCode::OK
            );
        }
    }

    #[tokio::test]
    async fn missing_secret_keeps_legacy_signup_and_invalid_secret_fails_closed() {
        let kit = MockKit::start(vec![]).await;
        for secret in [None, Some(""), Some("too short")] {
            let mut service = Newsletter::with_config(Some(TEST_KEY), Some("123"), secret);
            assert_eq!(service.is_enabled(), secret.is_none());
            service.api_base.clone_from(&kit.base);
            let router = test_router(service);
            assert_eq!(
                submit_unsubscribe(&router, "token", true).await.status(),
                StatusCode::SERVICE_UNAVAILABLE
            );
            if secret.is_some() {
                assert_redirect(
                    &submit(&router, "email=reader%40example.com").await,
                    "unavailable",
                );
            }
        }
        assert_eq!(kit.call_count(), 0);
    }

    #[tokio::test]
    async fn cancellation_during_footer_update_never_readds_the_subscriber_to_the_form() {
        let url = format!(
            "{UNSUBSCRIBE_ORIGIN}?token={}",
            unsubscribe_token(TEST_SECRET.as_bytes(), 123, 42)
        );
        let kit = MockKit::start(vec![MockReply::subscriber(StatusCode::OK, "active"),
            MockReply::json(StatusCode::OK, json!({"subscriber":{"id":42,"state":"cancelled","fields":{UNSUBSCRIBE_FIELD:url}}}))]).await;
        assert_redirect(
            &submit(
                &test_router(kit.signed_service()),
                "email=reader%40example.com",
            )
            .await,
            "check-email",
        );
        assert_eq!(kit.call_count(), 2);
    }

    #[tokio::test]
    async fn unsubscribe_timeout_never_claims_success_and_can_retry() {
        let mut slow = MockReply::json(StatusCode::NO_CONTENT, json!({}));
        slow.delay = Duration::from_millis(200);
        let kit = MockKit::start(vec![
            slow,
            MockReply::json(StatusCode::NO_CONTENT, json!({})),
        ])
        .await;
        let mut service = kit.signed_service();
        service.client = Client::builder()
            .timeout(Duration::from_millis(30))
            .build()
            .unwrap();
        let router = test_router(service);
        let token = unsubscribe_token(TEST_SECRET.as_bytes(), 123, 42);
        let response = submit_unsubscribe(&router, &token, true).await;
        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        assert_private(&response);
        let body = to_bytes(response.into_body(), 4096).await.unwrap();
        assert!(
            serde_json::from_slice::<Value>(&body)
                .unwrap()
                .get("error")
                .is_some()
        );
        assert_eq!(
            submit_unsubscribe(&router, &token, true).await.status(),
            StatusCode::OK
        );
        assert_eq!(kit.call_count(), 2);
    }

    #[tokio::test]
    async fn valid_token_replays_cannot_exhaust_the_upstream_key_quota() {
        let kit = MockKit::start(
            (0..MAX_UNSUBSCRIBE_PER_RECIPIENT)
                .map(|_| MockReply::json(StatusCode::NO_CONTENT, json!({})))
                .collect(),
        )
        .await;
        let router = test_router(kit.signed_service());
        let token = unsubscribe_token(TEST_SECRET.as_bytes(), 123, 42);
        for _ in 0..MAX_UNSUBSCRIBE_PER_RECIPIENT {
            assert_eq!(
                submit_unsubscribe(&router, &token, true).await.status(),
                StatusCode::OK
            );
        }
        assert_eq!(
            submit_unsubscribe(&router, &token, true).await.status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(kit.call_count(), MAX_UNSUBSCRIBE_PER_RECIPIENT);

        let limited = kit.signed_service();
        let now = Instant::now();
        limited
            .unsubscribe_budget
            .lock()
            .unwrap()
            .extend((1..=MAX_UNSUBSCRIBE_ATTEMPTS as u64).map(|id| (now, id)));
        assert_eq!(
            submit_unsubscribe(&test_router(limited), &token, true)
                .await
                .status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(kit.call_count(), MAX_UNSUBSCRIBE_PER_RECIPIENT);
    }

    #[tokio::test]
    async fn shared_api_budget_bounds_actual_requests_across_both_flows() {
        let kit = MockKit::start(vec![]).await;
        let service = kit.signed_service();
        let now = Instant::now();
        service
            .api_budget
            .lock()
            .unwrap()
            .extend(std::iter::repeat_n(now, MAX_KIT_REQUESTS));
        let router = test_router(service);
        let token = unsubscribe_token(TEST_SECRET.as_bytes(), 123, 42);
        assert_eq!(
            submit_unsubscribe(&router, &token, true).await.status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_redirect(
            &submit(&router, "email=reader%40example.com").await,
            "unavailable",
        );
        assert_eq!(kit.call_count(), 0);
    }

    async fn submit(router: &Router, body: &str) -> Response {
        router
            .clone()
            .oneshot(
                Request::post("/api/newsletter/subscribe")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .body(Body::from(body.to_owned()))
                    .unwrap(),
            )
            .await
            .unwrap()
    }

    fn assert_redirect(response: &Response, status: &str) {
        assert_eq!(response.status(), StatusCode::SEE_OTHER);
        assert_eq!(
            response.headers()[header::LOCATION],
            format!("/subscribe?status={status}")
        );
        assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
    }

    #[tokio::test]
    async fn new_signup_is_inactive_then_added_to_the_configured_form() {
        let kit = MockKit::start(vec![
            MockReply::subscriber(StatusCode::CREATED, "inactive"),
            MockReply::json(StatusCode::CREATED, json!({})),
        ])
        .await;
        let response = submit(
            &test_router(kit.service()),
            "email=+Reader%2Bnews%40EXAMPLE.COM+&website=",
        )
        .await;
        assert_redirect(&response, "check-email");
        let calls = kit.state.calls.lock().unwrap();
        assert_eq!(calls.len(), 2);
        for call in calls.iter() {
            assert_eq!(call.method, "POST");
            assert_eq!(call.headers["x-kit-api-key"], TEST_KEY);
        }
        assert_eq!(calls[0].path, "/v4/subscribers");
        assert_eq!(
            calls[0].body,
            json!({ "email_address": "Reader+news@example.com", "state": "inactive" })
        );
        assert_eq!(calls[1].path, "/v4/forms/123/subscribers/42");
        assert_eq!(calls[1].body, json!({ "referrer": SIGNUP_REFERRER }));
    }

    #[tokio::test]
    async fn existing_active_subscriber_and_existing_form_membership_are_successful() {
        let kit = MockKit::start(vec![
            MockReply::subscriber(StatusCode::OK, "active"),
            MockReply::json(StatusCode::OK, json!({})),
        ])
        .await;
        assert_redirect(
            &submit(&test_router(kit.service()), "email=reader%40example.com").await,
            "check-email",
        );
        assert_eq!(kit.call_count(), 2);
        // There is no subsequent state mutation or activation request.
        assert_eq!(kit.state.calls.lock().unwrap()[0].body["state"], "inactive");
    }

    #[tokio::test]
    async fn rapid_repeat_signups_are_deduplicated_without_calling_kit_again() {
        let kit = MockKit::start(vec![
            MockReply::subscriber(StatusCode::CREATED, "inactive"),
            MockReply::json(StatusCode::CREATED, json!({})),
        ])
        .await;
        let router = test_router(kit.service());
        assert_redirect(
            &submit(&router, "email=Reader%40example.com").await,
            "check-email",
        );
        assert_redirect(
            &submit(&router, "email=reader%40EXAMPLE.COM").await,
            "check-email",
        );
        assert_eq!(kit.call_count(), 2);
    }

    #[tokio::test]
    async fn suppressed_subscribers_are_not_added_to_a_form_or_reactivated() {
        for state in ["cancelled", "bounced", "complained", "blocked"] {
            let kit = MockKit::start(vec![MockReply::subscriber(StatusCode::OK, state)]).await;
            assert_redirect(
                &submit(&test_router(kit.service()), "email=reader%40example.com").await,
                "check-email",
            );
            assert_eq!(kit.call_count(), 1, "suppressed state {state}");
        }
    }

    #[tokio::test]
    async fn create_failures_stop_before_form_subscription_and_do_not_expose_upstream_details() {
        for status in [
            StatusCode::BAD_REQUEST,
            StatusCode::UNAUTHORIZED,
            StatusCode::TOO_MANY_REQUESTS,
            StatusCode::INTERNAL_SERVER_ERROR,
        ] {
            let kit = MockKit::start(vec![MockReply::json(
                status,
                json!({ "errors": ["sensitive upstream details"] }),
            )])
            .await;
            let response = submit(&test_router(kit.service()), "email=reader%40example.com").await;
            assert_redirect(&response, "error");
            assert_eq!(kit.call_count(), 1);
            assert!(
                to_bytes(response.into_body(), 4096)
                    .await
                    .unwrap()
                    .is_empty()
            );
        }
    }

    #[tokio::test]
    async fn form_failure_does_not_claim_success_and_retry_can_complete_the_same_subscriber() {
        let kit = MockKit::start(vec![
            MockReply::subscriber(StatusCode::CREATED, "inactive"),
            MockReply::json(StatusCode::SERVICE_UNAVAILABLE, json!({})),
            MockReply::subscriber(StatusCode::OK, "inactive"),
            MockReply::json(StatusCode::CREATED, json!({})),
        ])
        .await;
        let router = test_router(kit.service());
        assert_redirect(
            &submit(&router, "email=reader%40example.com").await,
            "error",
        );
        assert_redirect(
            &submit(&router, "email=reader%40example.com").await,
            "check-email",
        );
        assert_eq!(kit.call_count(), 4);
    }

    #[tokio::test]
    async fn malformed_or_unknown_subscriber_responses_fail_closed() {
        for body in [
            json!({}),
            json!({ "subscriber": { "id": 0, "state": "inactive" } }),
            json!({ "subscriber": { "id": 42, "state": "unexpected" } }),
        ] {
            let kit = MockKit::start(vec![MockReply::json(StatusCode::OK, body)]).await;
            assert_redirect(
                &submit(&test_router(kit.service()), "email=reader%40example.com").await,
                "error",
            );
            assert_eq!(kit.call_count(), 1);
        }
    }

    #[tokio::test]
    async fn missing_config_and_invalid_configuration_are_unavailable() {
        assert!(!Newsletter::disabled().is_enabled());
        for (key, form) in [
            (None, Some("123")),
            (Some(TEST_KEY), None),
            (Some(""), Some("123")),
            (Some("bad\nkey"), Some("123")),
            (Some(TEST_KEY), Some("0")),
            (Some(TEST_KEY), Some("not-a-number")),
        ] {
            let service = Newsletter::with_config(key, form, None);
            assert!(!service.is_enabled());
            assert_redirect(
                &submit(&test_router(service), "email=reader%40example.com").await,
                "unavailable",
            );
        }
    }

    #[tokio::test]
    async fn invalid_input_and_honeypot_never_call_kit() {
        let kit = MockKit::start(vec![]).await;
        let router = test_router(kit.service());
        for body in [
            "",
            "email=",
            "email=hello",
            "email=a%40b%40example.com",
            "email=a%0D%0ABcc%3Ax%40example.com",
            "email=a%40example.com&email=b%40example.com",
        ] {
            assert_redirect(&submit(&router, body).await, "invalid");
        }
        assert_redirect(
            &submit(&router, &format!("email={}@example.com", "a".repeat(4096))).await,
            "invalid",
        );
        assert_redirect(
            &submit(
                &router,
                "email=reader%40example.com&website=https%3A%2F%2Fspam.example",
            )
            .await,
            "check-email",
        );
        assert_eq!(kit.call_count(), 0);
    }

    #[tokio::test]
    async fn upstream_redirects_are_not_followed_with_the_api_key() {
        let mut reply = MockReply::json(StatusCode::TEMPORARY_REDIRECT, json!({}));
        reply.location = Some("/unexpected-destination");
        let kit = MockKit::start(vec![reply]).await;
        assert_redirect(
            &submit(&test_router(kit.service()), "email=reader%40example.com").await,
            "error",
        );
        assert_eq!(kit.call_count(), 1);
    }

    #[tokio::test]
    async fn timeout_is_a_generic_retryable_error() {
        let mut reply = MockReply::subscriber(StatusCode::CREATED, "inactive");
        reply.delay = Duration::from_millis(200);
        let kit = MockKit::start(vec![reply]).await;
        let mut service = kit.service();
        service.client = Client::builder()
            .timeout(Duration::from_millis(30))
            .build()
            .unwrap();
        assert_redirect(
            &submit(&test_router(service), "email=reader%40example.com").await,
            "error",
        );
        assert_eq!(kit.call_count(), 1);
    }

    #[tokio::test]
    async fn saturated_service_is_unavailable_without_upstream_work() {
        let kit = MockKit::start(vec![]).await;
        let service = kit.service();
        service.permits.close();
        assert_redirect(
            &submit(&test_router(service), "email=reader%40example.com").await,
            "unavailable",
        );
        assert_eq!(kit.call_count(), 0);
    }

    #[tokio::test]
    async fn exhausted_rate_budget_is_unavailable_without_upstream_work() {
        let kit = MockKit::start(vec![]).await;
        let service = kit.service();
        let now = Instant::now();
        for value in 0..MAX_SIGNUP_ATTEMPTS {
            assert_eq!(
                service
                    .rate_budget
                    .lock()
                    .unwrap()
                    .reserve([value as u8; 32], now),
                Reservation::Reserved,
            );
        }
        assert_redirect(
            &submit(&test_router(service), "email=reader%40example.com").await,
            "unavailable",
        );
        assert_eq!(kit.call_count(), 0);
    }

    #[test]
    fn rate_limit_expires_and_failed_requests_can_retry_without_reclaiming_budget() {
        let now = Instant::now();
        let mut budget = RateBudget::default();
        assert_eq!(budget.reserve([0; 32], now), Reservation::Reserved);
        assert_eq!(budget.reserve([0; 32], now), Reservation::Limited);
        budget.release_email([0; 32]);
        assert_eq!(budget.reserve([0; 32], now), Reservation::Reserved);
        budget.complete_email([0; 32]);
        assert_eq!(budget.reserve([0; 32], now), Reservation::Duplicate);
        assert_eq!(budget.attempts.len(), 2);
        for value in 2..MAX_SIGNUP_ATTEMPTS {
            assert_eq!(
                budget.reserve([value as u8; 32], now),
                Reservation::Reserved
            );
        }
        assert_eq!(
            budget.reserve([255; 32], now + Duration::from_secs(59)),
            Reservation::Limited
        );
        assert_eq!(
            budget.reserve([255; 32], now + SIGNUP_WINDOW),
            Reservation::Reserved
        );
        assert_eq!(budget.attempts.len(), 1);
    }

    #[test]
    fn email_validation_preserves_plus_addressing_and_rejects_malformed_domains() {
        assert_eq!(
            validated_email(" Reader+tag@EXAMPLE.COM ").as_deref(),
            Some("Reader+tag@example.com")
        );
        for invalid in [
            ".a@example.com",
            "a..b@example.com",
            "a.@example.com",
            "a b@example.com",
            "a@-example.com",
            "a@example-.com",
            "a@example..com",
            "a@example.com.",
            "a@localhost",
            "a@exämple.com",
        ] {
            assert!(validated_email(invalid).is_none(), "{invalid}");
        }
        assert!(validated_email(&format!("{}@example.com", "a".repeat(65))).is_none());
        assert!(validated_email(&format!("a@{}.com", "x".repeat(64))).is_none());
    }
}
