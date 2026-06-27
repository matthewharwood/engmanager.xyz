//! Shared application state injected into handlers. (Patterns:
//! axum-service-architecture "AppState with FromRef" — sub-states are
//! extractable so future handlers can depend on just the service they use,
//! without changing any existing `State<AppState>` signature.)

use std::sync::Arc;

use axum::extract::FromRef;
use tokio::sync::watch;

use crate::discord::DiscordSnapshot;
use crate::{search, stripe};

#[derive(Clone)]
pub struct AppState {
    pub search: Arc<search::SearchEngine>,
    pub stripe: Arc<stripe::Checkout>,
    /// Latest Discord widget snapshot, published by the refresh loop through
    /// a watch channel (rust-async-runtime "watch"); handlers `borrow()` the
    /// last good value — zero I/O on the hot path.
    pub discord: watch::Receiver<Option<DiscordSnapshot>>,
}

impl FromRef<AppState> for Arc<search::SearchEngine> {
    fn from_ref(state: &AppState) -> Self {
        state.search.clone()
    }
}

impl FromRef<AppState> for Arc<stripe::Checkout> {
    fn from_ref(state: &AppState) -> Self {
        state.stripe.clone()
    }
}

impl FromRef<AppState> for watch::Receiver<Option<DiscordSnapshot>> {
    fn from_ref(state: &AppState) -> Self {
        state.discord.clone()
    }
}
