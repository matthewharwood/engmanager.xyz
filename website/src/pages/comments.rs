use axum::Json;
use axum::extract::{Path, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde_json::json;

use crate::AppState;
use crate::comments::NewCommentRequest;
use crate::content::article_by_slug;

pub async fn list(State(state): State<AppState>, Path(slug): Path<String>) -> Response {
    if article_by_slug(&slug).is_none() {
        return error_response(StatusCode::NOT_FOUND, "article not found");
    }

    match state.comments.for_article(&slug).await {
        Ok(comments) => no_store(Json(comments)).into_response(),
        Err(error) => {
            eprintln!("list comments failed for {slug}: {error:?}");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "comments unavailable")
        }
    }
}

pub async fn create(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(input): Json<NewCommentRequest>,
) -> Response {
    if article_by_slug(&slug).is_none() {
        return error_response(StatusCode::NOT_FOUND, "article not found");
    }

    let record = match state.comments.create(&slug, input).await {
        Ok(record) => record,
        Err(error) => return error_response(StatusCode::BAD_REQUEST, &error.to_string()),
    };

    if let Err(error) = state.search.index_comment(&record) {
        eprintln!("index comment failed for {}: {error:?}", record.comment_id);
    }

    no_store((StatusCode::CREATED, Json(record))).into_response()
}

fn no_store<T: IntoResponse>(response: T) -> impl IntoResponse {
    ([(header::CACHE_CONTROL, "no-store")], response)
}

fn error_response(status: StatusCode, message: &str) -> Response {
    no_store((status, Json(json!({ "error": message })))).into_response()
}
