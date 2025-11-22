use axum::Json;
/// Admin API endpoints for content management
///
/// This module provides RESTful API endpoints for updating route content.
///
/// # Error Handling
///
/// - Success returns 200 OK with a message
/// - Failures return Result<T, String> which Axum maps to 500 Internal Server Error
///
/// In production, this should use proper error types with IntoResponse.
use axum::extract::Path;
use uuid::Uuid;

use crate::core::{BlockWithId, save_blocks};
use crate::pages::homepage::HomepageData;

/// POST /admin/api/:route_name
///
/// Updates the route content by persisting the provided blocks to JSON.
/// Automatically generates UUIDs for blocks that don't have IDs.
///
/// # Path Parameters
///
/// - `route_name`: The route name (e.g., "homepage", "foo")
///
/// # Request Body
///
/// ```json
/// {
///   "blocks": [
///     {
///       "id": "550e8400-e29b-41d4-a716-446655440001",
///       "type": "Header",
///       "props": { ... }
///     }
///   ]
/// }
/// ```
///
/// If a block's `id` is empty or missing, a new UUID v4 will be generated.
///
/// # Response
///
/// - **200 OK**: "Route updated successfully"
/// - **500 Internal Server Error**: Error message describing the failure
pub async fn update_route(
    Path(route_name): Path<String>,
    Json(data): Json<HomepageData>,
) -> Result<String, String> {
    // Generate UUIDs for blocks that don't have IDs
    let blocks_with_ids: Vec<BlockWithId> = data
        .blocks
        .into_iter()
        .map(|mut block| {
            // If the ID is empty or missing, generate a new UUID
            if block.id.trim().is_empty() {
                block.id = Uuid::new_v4().to_string();
            }
            block
        })
        .collect();

    match save_blocks(&route_name, &blocks_with_ids) {
        Ok(_) => Ok(format!("{} updated successfully", route_name)),
        Err(e) => Err(format!("Failed to save: {}", e)),
    }
}

/// POST /admin/api/homepage
///
/// Legacy endpoint for backwards compatibility.
/// Redirects to the generic update_route endpoint.
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
/// - **200 OK**: "homepage updated successfully"
/// - **500 Internal Server Error**: Error message describing the failure
pub async fn update_homepage(Json(data): Json<HomepageData>) -> Result<String, String> {
    update_route(Path("homepage".to_string()), Json(data)).await
}
