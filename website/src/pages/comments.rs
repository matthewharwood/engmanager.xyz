use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Response;

use crate::AppState;
use crate::comments::{CommentError, NewCommentRequest};
use crate::content::article_by_slug;
use crate::http::{json_error, no_store};

// Degraded mode (ledger #12): the store failed to connect at boot, the rest
// of the site keeps serving, and both comment routes answer 503 with this.
const COMMENTS_UNAVAILABLE: &str = "comments are temporarily unavailable";

pub async fn list(State(state): State<AppState>, Path(slug): Path<String>) -> Response {
    if article_by_slug(&slug).is_none() {
        return json_error(StatusCode::NOT_FOUND, "article not found");
    }
    let Some(store) = state.comments.store() else {
        return json_error(StatusCode::SERVICE_UNAVAILABLE, COMMENTS_UNAVAILABLE);
    };

    match store.for_article(&slug).await {
        Ok(comments) => no_store(Json(comments)),
        Err(error) => {
            tracing::error!(slug = %slug, err = ?error, "list comments failed");
            json_error(StatusCode::INTERNAL_SERVER_ERROR, "comments unavailable")
        }
    }
}

pub async fn create(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(input): Json<NewCommentRequest>,
) -> Response {
    if article_by_slug(&slug).is_none() {
        return json_error(StatusCode::NOT_FOUND, "article not found");
    }
    let Some(store) = state.comments.store() else {
        return json_error(StatusCode::SERVICE_UNAVAILABLE, COMMENTS_UNAVAILABLE);
    };

    let record = match store.create(&slug, input).await {
        Ok(record) => record,
        Err(error) => return comment_error_response(&slug, error),
    };

    // Best-effort indexing (commit runs on the blocking pool): the comment is
    // already durably stored, so an index failure is logged and the client
    // still gets its 201 — search catches up at the next boot's full rebuild.
    if let Err(error) = state.search.index_comment(&record).await {
        tracing::error!(
            comment_id = %record.comment_id,
            slug = %slug,
            err = ?error,
            "index comment failed"
        );
    }

    no_store((StatusCode::CREATED, Json(record)))
}

// Ledger #11 mapping: client-fixable validation stays 400 with its message;
// storage failures log the full chain server-side and return a GENERIC 500 so
// raw anyhow text never leaks to clients. (rust-error-handling "HTTP mappings".)
fn comment_error_response(slug: &str, error: CommentError) -> Response {
    match error {
        CommentError::Validation(message) => json_error(StatusCode::BAD_REQUEST, message),
        CommentError::Storage(error) => {
            tracing::error!(slug = %slug, err = ?error, "create comment failed");
            json_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "comment could not be saved",
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use anyhow::anyhow;
    use http_body_util::BodyExt;
    use tokio::sync::watch;

    use super::*;
    use crate::state::CommentsHandle;
    use crate::{content, search, stripe};

    async fn body_json(response: Response) -> serde_json::Value {
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("body collects")
            .to_bytes();
        serde_json::from_slice(&bytes).expect("body is JSON")
    }

    #[tokio::test]
    async fn validation_errors_map_to_400_with_their_message() {
        let response =
            comment_error_response("slug", CommentError::Validation("comment is required"));
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(body_json(response).await["error"], "comment is required");
    }

    #[tokio::test]
    async fn storage_errors_map_to_500_with_generic_body() {
        let response = comment_error_response(
            "slug",
            CommentError::Storage(anyhow!("surreal exploded: internal dsn details")),
        );
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        // The anyhow text must NOT leak; clients get the generic body.
        assert_eq!(
            body_json(response).await["error"],
            "comment could not be saved"
        );
    }

    fn degraded_state() -> AppState {
        AppState {
            search: Arc::new(
                search::SearchEngine::build_in_memory(content::ARTICLES, &[])
                    .expect("search engine builds"),
            ),
            comments: CommentsHandle::disabled(),
            stripe: Arc::new(stripe::Checkout::from_env()),
            discord: watch::channel(None).1,
        }
    }

    // Ledger #12: with the store disabled, both routes answer 503 + no-store
    // instead of crashing (or never booting).
    #[tokio::test]
    async fn degraded_store_answers_503_on_both_routes() {
        let state = degraded_state();
        let slug = content::ARTICLES[0].slug.to_string();

        let response = list(State(state.clone()), Path(slug.clone())).await;
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            response
                .headers()
                .get("cache-control")
                .and_then(|v| v.to_str().ok()),
            Some("no-store")
        );
        assert_eq!(body_json(response).await["error"], COMMENTS_UNAVAILABLE);

        let input = NewCommentRequest {
            author_name: "Ada".to_string(),
            body: "A fine comment.".to_string(),
            quote_exact: "quote".to_string(),
            quote_prefix: String::new(),
            quote_suffix: String::new(),
            start_char: 0,
            end_char: 5,
            human_check: true,
        };
        let response = create(State(state), Path(slug), Json(input)).await;
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body_json(response).await["error"], COMMENTS_UNAVAILABLE);
    }
}
