//! Stripe integration, split by concern (the old single-file module was
//! explicitly two programs sharing one namespace):
//!
//! - `client` — ONE timeout'd reqwest client builder + the shared
//!   form-POST / error-message helpers (auth, idempotency).
//! - `checkout` — the runtime context in `AppState`: PaymentIntents for the
//!   on-site Elements flow + webhook signature verification.
//! - `sync` — the `stripe-sync` catalog CLI (products/prices upsert).

mod checkout;
mod client;
mod sync;

pub use checkout::Checkout;
pub use sync::{SyncOptions, run};
