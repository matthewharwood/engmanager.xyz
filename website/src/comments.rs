use std::env;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use surrealdb::Surreal;
use surrealdb::engine::any::{self, Any};
use surrealdb::types::SurrealValue;
use thiserror::Error;
use uuid::Uuid;

const DEFAULT_LOCAL_DB_PATH: &str = "data/comments.surrealkv";
const DEFAULT_NAMESPACE: &str = "engmanager";
const DEFAULT_DATABASE: &str = "website";
const MAX_AUTHOR_LEN: usize = 80;
const MAX_BODY_LEN: usize = 2_000;
const MAX_QUOTE_LEN: usize = 2_000;
const MAX_CONTEXT_LEN: usize = 240;

/// Typed comment-store failure (ledger #11), so the API layer maps errors by
/// variant instead of string-matching anyhow text. (Pattern: rust-error-handling
/// "error classification" — client-fixable vs internal.)
#[derive(Debug, Error)]
pub enum CommentError {
    /// Client-fixable input problem; the message is safe to echo to browsers.
    #[error("{0}")]
    Validation(&'static str),
    /// SurrealDB/serde failure; the full chain is logged server-side only and
    /// clients get a generic 500 body.
    #[error(transparent)]
    Storage(#[from] anyhow::Error),
}

/// Moderation status for a comment. The serialized form (in SurrealDB and in
/// API JSON) stays the lowercase string — `"visible"` / `"hidden"` — exactly
/// as the old stringly literals wrote it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CommentStatus {
    Visible,
    Hidden,
}

impl CommentStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            CommentStatus::Visible => "visible",
            CommentStatus::Hidden => "hidden",
        }
    }
}

#[derive(Clone)]
pub struct CommentStore {
    db: Surreal<Any>,
}

#[derive(Clone, Debug, Serialize, Deserialize, SurrealValue)]
pub struct CommentRecord {
    pub comment_id: String,
    pub article_slug: String,
    pub author_name: String,
    pub body: String,
    pub quote_exact: String,
    pub quote_prefix: String,
    pub quote_suffix: String,
    pub start_char: u32,
    pub end_char: u32,
    pub status: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Clone, Debug, Deserialize)]
pub struct NewCommentRequest {
    pub author_name: String,
    pub body: String,
    pub quote_exact: String,
    pub quote_prefix: String,
    pub quote_suffix: String,
    pub start_char: u32,
    pub end_char: u32,
    pub human_check: bool,
}

impl CommentStore {
    pub async fn connect_from_env() -> Result<Self> {
        let endpoint = comments_db_endpoint();
        if let Some(path) = endpoint
            .strip_prefix("surrealkv://")
            .filter(|path| !path.is_empty())
            && let Some(parent) = Path::new(path)
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty())
        {
            std::fs::create_dir_all(parent).with_context(|| {
                format!("create comment database directory {}", parent.display())
            })?;
        }

        let db = any::connect(endpoint.clone())
            .await
            .with_context(|| format!("connect SurrealDB endpoint {endpoint}"))?;
        let namespace =
            env::var("COMMENTS_DB_NAMESPACE").unwrap_or_else(|_| DEFAULT_NAMESPACE.to_string());
        let database =
            env::var("COMMENTS_DB_DATABASE").unwrap_or_else(|_| DEFAULT_DATABASE.to_string());
        db.use_ns(namespace)
            .use_db(database)
            .await
            .context("select SurrealDB namespace/database")?;
        db.query("DEFINE TABLE IF NOT EXISTS comment SCHEMALESS;")
            .await
            .context("initialize comment table")?;
        Ok(Self { db })
    }

    // Test-only store backed by SurrealDB's in-memory engine (kv-mem). Keeps
    // the router-surface tests hermetic — no files, no env vars — while
    // running the same namespace/table setup as connect_from_env.
    #[cfg(test)]
    pub async fn connect_in_memory() -> Result<Self> {
        let db = any::connect("memory")
            .await
            .context("connect in-memory SurrealDB")?;
        db.use_ns(DEFAULT_NAMESPACE)
            .use_db(DEFAULT_DATABASE)
            .await
            .context("select SurrealDB namespace/database")?;
        db.query("DEFINE TABLE IF NOT EXISTS comment SCHEMALESS;")
            .await
            .context("initialize comment table")?;
        Ok(Self { db })
    }

    pub async fn all_visible(&self) -> Result<Vec<CommentRecord>> {
        let records: Vec<CommentRecord> = self
            .db
            .query(
                "SELECT comment_id, article_slug, author_name, body, quote_exact, quote_prefix, quote_suffix, start_char, end_char, status, created_at_ms, updated_at_ms
                 FROM comment
                 WHERE status = $status
                 ORDER BY created_at_ms ASC",
            )
            .bind(("status", CommentStatus::Visible.as_str().to_string()))
            .await
            .context("query visible comments")?
            .take(0)
            .context("decode visible comments")?;
        Ok(records)
    }

    pub async fn for_article(&self, article_slug: &str) -> Result<Vec<CommentRecord>> {
        let records: Vec<CommentRecord> = self
            .db
            .query(
                "SELECT comment_id, article_slug, author_name, body, quote_exact, quote_prefix, quote_suffix, start_char, end_char, status, created_at_ms, updated_at_ms
                 FROM comment
                 WHERE status = $status AND article_slug = $article_slug
                 ORDER BY created_at_ms ASC",
            )
            .bind(("status", CommentStatus::Visible.as_str().to_string()))
            .bind(("article_slug", article_slug.to_string()))
            .await
            .context("query article comments")?
            .take(0)
            .context("decode article comments")?;
        Ok(records)
    }

    pub async fn create(
        &self,
        article_slug: &str,
        input: NewCommentRequest,
    ) -> Result<CommentRecord, CommentError> {
        let author_name = normalize_author(&input.author_name);
        let body = normalize_required(&input.body, MAX_BODY_LEN, "comment is required")?;
        let quote_exact = normalize_required(
            &input.quote_exact,
            MAX_QUOTE_LEN,
            "selected text is required",
        )?;
        let quote_prefix = normalize_optional(&input.quote_prefix, MAX_CONTEXT_LEN);
        let quote_suffix = normalize_optional(&input.quote_suffix, MAX_CONTEXT_LEN);
        if input.start_char >= input.end_char {
            return Err(CommentError::Validation("selection offsets are invalid"));
        }
        if !input.human_check {
            return Err(CommentError::Validation("slide verification is required"));
        }

        let now = now_ms();
        let record = CommentRecord {
            comment_id: Uuid::new_v4().to_string(),
            article_slug: article_slug.to_string(),
            author_name,
            body,
            quote_exact,
            quote_prefix,
            quote_suffix,
            start_char: input.start_char,
            end_char: input.end_char,
            status: CommentStatus::Visible.as_str().to_string(),
            created_at_ms: now,
            updated_at_ms: now,
        };

        // Database/serde failures flow through `#[from] anyhow::Error` into
        // CommentError::Storage via the `?` below.
        let created: Option<CommentRecord> = self
            .db
            .create(("comment", record.comment_id.as_str()))
            .content(record.clone())
            .await
            .context("create comment")?;
        Ok(created.unwrap_or(record))
    }
}

fn comments_db_endpoint() -> String {
    if let Ok(url) = env::var("COMMENTS_DB_URL") {
        return url;
    }
    if let Ok(path) = env::var("COMMENTS_DB_PATH") {
        return format!("surrealkv://{path}");
    }
    format!("surrealkv://{DEFAULT_LOCAL_DB_PATH}")
}

fn normalize_author(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "Anonymous".to_string()
    } else {
        truncate_chars(trimmed, MAX_AUTHOR_LEN)
    }
}

fn normalize_required(
    value: &str,
    max_chars: usize,
    missing: &'static str,
) -> Result<String, CommentError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(CommentError::Validation(missing));
    }
    Ok(truncate_chars(trimmed, max_chars))
}

fn normalize_optional(value: &str, max_chars: usize) -> String {
    truncate_chars(value.trim(), max_chars)
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    // The status enum's serialized form is a DB + API contract: existing
    // SurrealDB rows and the comments JSON both carry these exact strings.
    #[test]
    fn comment_status_serialized_form_is_stable() {
        assert_eq!(CommentStatus::Visible.as_str(), "visible");
        assert_eq!(CommentStatus::Hidden.as_str(), "hidden");
    }

    fn valid_request() -> NewCommentRequest {
        NewCommentRequest {
            author_name: "Ada".to_string(),
            body: "Solid point about retries.".to_string(),
            quote_exact: "the quote".to_string(),
            quote_prefix: String::new(),
            quote_suffix: String::new(),
            start_char: 0,
            end_char: 9,
            human_check: true,
        }
    }

    // Every client-input failure must classify as Validation (→ 400 with the
    // message); only DB/serde failures may classify as Storage (→ generic 500).
    #[tokio::test]
    async fn create_classifies_input_failures_as_validation() {
        let store = CommentStore::connect_in_memory()
            .await
            .expect("in-memory store connects");

        let missing_body = NewCommentRequest {
            body: "   ".to_string(),
            ..valid_request()
        };
        assert!(matches!(
            store.create("slug", missing_body).await,
            Err(CommentError::Validation("comment is required"))
        ));

        let missing_quote = NewCommentRequest {
            quote_exact: String::new(),
            ..valid_request()
        };
        assert!(matches!(
            store.create("slug", missing_quote).await,
            Err(CommentError::Validation("selected text is required"))
        ));

        let bad_offsets = NewCommentRequest {
            start_char: 5,
            end_char: 5,
            ..valid_request()
        };
        assert!(matches!(
            store.create("slug", bad_offsets).await,
            Err(CommentError::Validation("selection offsets are invalid"))
        ));

        let no_human = NewCommentRequest {
            human_check: false,
            ..valid_request()
        };
        assert!(matches!(
            store.create("slug", no_human).await,
            Err(CommentError::Validation("slide verification is required"))
        ));

        // Happy path still stores a visible comment.
        let created = store
            .create("slug", valid_request())
            .await
            .expect("valid comment is stored");
        assert_eq!(created.status, CommentStatus::Visible.as_str());
    }
}
