/// Admin API endpoints for content management
///
/// This module provides RESTful API endpoints for updating homepage content.
///
/// # Error Handling
///
/// - Success returns 200 OK with a message
/// - Failures return Result<T, String> which Axum maps to 500 Internal Server Error
///
/// In production, this should use proper error types with IntoResponse.
use axum::Json;

use crate::core::{save_homepage_blocks, HomepageData};

/// POST /admin/api/homepage
///
/// Updates the homepage content by persisting the provided blocks to JSON.
///
/// # Request Body
///
/// ```json
/// {
///   "blocks": [
///     {
///       "type": "Header",
///       "props": { ... }
///     }
///   ]
/// }
/// ```
///
/// # Response
///
/// - **200 OK**: "Homepage updated successfully"
/// - **500 Internal Server Error**: Error message describing the failure
pub async fn update_homepage(Json(data): Json<HomepageData>) -> Result<&'static str, String> {
    match save_homepage_blocks(&data.blocks) {
        Ok(_) => Ok("Homepage updated successfully"),
        Err(e) => Err(format!("Failed to save: {}", e)),
    }
}
