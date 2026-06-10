//! Shared application state injected into handlers. (Patterns:
//! axum-service-architecture "AppState with FromRef" — sub-states are
//! extractable so future handlers can depend on just the service they use,
//! without changing any existing `State<AppState>` signature.)

use std::sync::Arc;

use axum::extract::FromRef;

use crate::{comments, search, stripe};

#[derive(Clone)]
pub struct AppState {
    pub search: Arc<search::SearchEngine>,
    pub comments: Arc<comments::CommentStore>,
    pub stripe: Arc<stripe::Checkout>,
}

impl FromRef<AppState> for Arc<search::SearchEngine> {
    fn from_ref(state: &AppState) -> Self {
        state.search.clone()
    }
}

impl FromRef<AppState> for Arc<comments::CommentStore> {
    fn from_ref(state: &AppState) -> Self {
        state.comments.clone()
    }
}

impl FromRef<AppState> for Arc<stripe::Checkout> {
    fn from_ref(state: &AppState) -> Self {
        state.stripe.clone()
    }
}
