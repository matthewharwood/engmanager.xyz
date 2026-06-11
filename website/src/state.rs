//! Shared application state injected into handlers. (Patterns:
//! axum-service-architecture "AppState with FromRef" — sub-states are
//! extractable so future handlers can depend on just the service they use,
//! without changing any existing `State<AppState>` signature.)

use std::sync::Arc;

use axum::extract::FromRef;
use tokio::sync::watch;

use crate::comments::CommentStore;
use crate::discord::DiscordSnapshot;
use crate::{search, stripe};

/// Comment-store handle that admits a degraded mode (ledger #12): when
/// SurrealDB is unreachable at boot the server still starts, articles keep
/// serving, and the comments API answers 503 until the next restart.
/// (Pattern: rust-core-patterns newtype over `Option<Arc<_>>` — the
/// disabled state is explicit, not an `unwrap` waiting to happen.)
#[derive(Clone)]
pub struct CommentsHandle(Option<Arc<CommentStore>>);

impl CommentsHandle {
    pub fn connected(store: Arc<CommentStore>) -> Self {
        CommentsHandle(Some(store))
    }

    pub fn disabled() -> Self {
        CommentsHandle(None)
    }

    /// The live store, or `None` in degraded mode (handlers answer 503).
    pub fn store(&self) -> Option<&CommentStore> {
        self.0.as_deref()
    }
}

#[derive(Clone)]
pub struct AppState {
    pub search: Arc<search::SearchEngine>,
    pub comments: CommentsHandle,
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

impl FromRef<AppState> for CommentsHandle {
    fn from_ref(state: &AppState) -> Self {
        state.comments.clone()
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
