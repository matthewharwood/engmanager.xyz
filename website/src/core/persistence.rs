/// JSON file persistence for blocks and routes
///
/// This module handles reading and writing data to/from the filesystem.
/// It provides fallback behavior when files are missing or invalid.
///
/// # Error Handling
///
/// Following rust-error-handling patterns:
/// - **Graceful degradation**: Missing or invalid files fall back to defaults
/// - **User-facing errors**: API errors return Result for proper HTTP mapping
/// - **Logging**: Errors are logged to stderr for debugging
///
/// # File Locations
///
/// - Route content: `data/content/{route_name}.json`
/// - Routes data: `data/routes.json`
///
/// Paths are relative to the project root where the binary runs from.
use std::fs;
use std::io;
use std::path::PathBuf;

use crate::core::block::BlockWithId;
use crate::pages::homepage::HomepageData;

const ROUTES_JSON_PATH: &str = "data/routes.json";

/// Route definition
///
/// Represents a route in the application with its path, name, and associated content.
/// Routes are stored in routes.json and used to drive the admin interface.
///
/// # Fields
///
/// - `path`: The URL path (acts as primary key), e.g., "/", "/foo"
/// - `name`: The route name used in admin URLs, e.g., "homepage", "foo"
/// - `block_ids`: Array of content file paths for this route, e.g., ["data/content/homepage.json"]
///
/// # Example
///
/// ```json
/// {
///   "path": "/",
///   "name": "homepage",
///   "blockIds": ["data/content/homepage.json"]
/// }
/// ```
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct Route {
    pub path: String,
    pub name: String,

    /// Content file paths associated with this route
    /// Uses camelCase "blockIds" in JSON for consistency with frontend conventions
    #[serde(rename = "blockIds")]
    pub block_ids: Vec<String>,
}

/// Get the content file path for a given route name
///
/// Looks up the route in routes.json and returns the first blockId (content file path).
///
/// # Errors
///
/// Returns an error if:
/// - Route name is not found in routes.json
/// - Route has no blockIds
/// - File path is invalid
fn get_content_path(route_name: &str) -> Result<PathBuf, String> {
    let routes = load_routes();

    let route = routes
        .iter()
        .find(|r| r.name == route_name)
        .ok_or_else(|| format!("Route '{}' not found in routes.json", route_name))?;

    let content_path = route
        .block_ids
        .first()
        .ok_or_else(|| format!("Route '{}' has no blockIds", route_name))?;

    // Paths in routes.json are relative to project root (e.g., "data/content/homepage.json")
    // The binary runs from the project root, so we use the path directly
    Ok(PathBuf::from(content_path))
}

/// Load blocks for any route by name
///
/// This is the generic version of load_homepage_blocks() that works for any route
/// defined in routes.json.
///
/// # Parameters
///
/// - `route_name`: The route name (e.g., "homepage", "foo")
///
/// # Fallback Behavior
///
/// - Route not found: Returns empty vec, logs error to stderr
/// - File not found: Returns empty vec
/// - Invalid JSON: Returns empty vec, logs error to stderr
/// - Valid JSON: Returns parsed blocks
///
/// # Examples
///
/// ```
/// let homepage_blocks = load_blocks("homepage");
/// let foo_blocks = load_blocks("foo");
/// ```
pub fn load_blocks(route_name: &str) -> Vec<BlockWithId> {
    // Get the content file path for this route
    let content_path = match get_content_path(route_name) {
        Ok(path) => path,
        Err(e) => {
            eprintln!("{}", e);
            return vec![];
        }
    };

    match fs::read_to_string(&content_path) {
        Ok(contents) => match serde_json::from_str::<HomepageData>(&contents) {
            Ok(data) => data.blocks,
            Err(e) => {
                eprintln!("Failed to parse {}: {}", content_path.display(), e);
                vec![]
            }
        },
        Err(e) => {
            // Only log if error is not "file not found" (expected on first run)
            if e.kind() != io::ErrorKind::NotFound {
                eprintln!("Failed to read {}: {}", content_path.display(), e);
            }
            vec![]
        }
    }
}

/// Save blocks for any route by name
///
/// This is the generic version of save_homepage_blocks() that works for any route
/// defined in routes.json.
///
/// # Parameters
///
/// - `route_name`: The route name (e.g., "homepage", "foo")
/// - `blocks`: The blocks to save
///
/// # Errors
///
/// Returns an error if:
/// - Route name is not found in routes.json
/// - JSON serialization fails
/// - File write fails (disk full, permissions, etc.)
///
/// # Examples
///
/// ```
/// save_blocks("homepage", &homepage_blocks)?;
/// save_blocks("foo", &foo_blocks)?;
/// ```
pub fn save_blocks(
    route_name: &str,
    blocks: &[BlockWithId],
) -> Result<(), Box<dyn std::error::Error>> {
    // Get the content file path for this route
    let content_path = get_content_path(route_name)?;

    let data = HomepageData::new(blocks.to_vec());
    let json = serde_json::to_string_pretty(&data)?;
    fs::write(&content_path, json)?;
    Ok(())
}

/// Load homepage blocks from JSON file
///
/// This is a convenience wrapper around load_blocks("homepage") for backwards compatibility.
///
/// If the file doesn't exist or contains invalid JSON, this function falls back
/// to the default blocks defined in HomepageData::default_blocks().
///
/// # Fallback Behavior
///
/// - File not found: Returns default blocks
/// - Invalid JSON: Returns default blocks, logs error to stderr
/// - Valid JSON: Returns parsed blocks
pub fn load_homepage_blocks() -> Vec<BlockWithId> {
    let blocks = load_blocks("homepage");

    // If no blocks were loaded (file not found or error), return defaults
    if blocks.is_empty() {
        HomepageData::default_blocks()
    } else {
        blocks
    }
}

/// Save homepage blocks to JSON file
///
/// This is a convenience wrapper around save_blocks("homepage") for backwards compatibility.
///
/// This is the write path for the admin API. It serializes blocks to pretty-printed
/// JSON and writes atomically to the filesystem.
///
/// # Errors
///
/// Returns an error if:
/// - JSON serialization fails (unlikely with valid Block data)
/// - File write fails (disk full, permissions, etc.)
///
/// The caller should map this error to an appropriate HTTP status code.
#[allow(dead_code)]
pub fn save_homepage_blocks(blocks: &[BlockWithId]) -> Result<(), Box<dyn std::error::Error>> {
    save_blocks("homepage", blocks)
}

/// Load routes from JSON file
///
/// If the file doesn't exist or contains invalid JSON, this function falls back
/// to the default routes.
///
/// # Fallback Behavior
///
/// - File not found: Returns default routes
/// - Invalid JSON: Returns default routes, logs error to stderr
/// - Valid JSON: Returns parsed routes
///
/// # Default Routes
///
/// The default routes include:
/// - `{ "path": "/", "name": "homepage" }`
pub fn load_routes() -> Vec<Route> {
    match fs::read_to_string(ROUTES_JSON_PATH) {
        Ok(contents) => {
            if contents.trim().is_empty() {
                // Empty file, return defaults
                default_routes()
            } else {
                match serde_json::from_str::<Vec<Route>>(&contents) {
                    Ok(routes) => routes,
                    Err(e) => {
                        eprintln!("Failed to parse routes.json: {}", e);
                        default_routes()
                    }
                }
            }
        }
        Err(e) => {
            // Only log if error is not "file not found" (expected on first run)
            if e.kind() != io::ErrorKind::NotFound {
                eprintln!("Failed to read routes.json: {}", e);
            }
            default_routes()
        }
    }
}

/// Save routes to JSON file
///
/// This serializes routes to pretty-printed JSON and writes atomically
/// to the filesystem.
///
/// # Errors
///
/// Returns an error if:
/// - JSON serialization fails
/// - File write fails (disk full, permissions, etc.)
///
/// The caller should map this error to an appropriate HTTP status code.
#[allow(dead_code)]
pub fn save_routes(routes: &[Route]) -> Result<(), Box<dyn std::error::Error>> {
    let json = serde_json::to_string_pretty(&routes)?;
    fs::write(ROUTES_JSON_PATH, json)?;
    Ok(())
}

/// Get default routes
///
/// Returns the initial set of routes used when routes.json doesn't exist
/// or is invalid.
fn default_routes() -> Vec<Route> {
    vec![Route {
        path: "/".to_string(),
        name: "homepage".to_string(),
        block_ids: vec!["data/content/homepage.json".to_string()],
    }]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_blocks_serialization() {
        let blocks = HomepageData::default_blocks();
        let data = HomepageData::new(blocks);
        let json = serde_json::to_string_pretty(&data).unwrap();

        // Should be able to round-trip
        let parsed: HomepageData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.blocks.len(), 2);
    }

    #[test]
    fn test_route_serialization() {
        let routes = vec![
            Route {
                path: "/".to_string(),
                name: "homepage".to_string(),
                block_ids: vec!["data/content/homepage.json".to_string()],
            },
            Route {
                path: "/foo".to_string(),
                name: "foo".to_string(),
                block_ids: vec!["data/content/foo.json".to_string()],
            },
        ];

        let json = serde_json::to_string_pretty(&routes).unwrap();
        let parsed: Vec<Route> = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].path, "/");
        assert_eq!(parsed[0].name, "homepage");
        assert_eq!(parsed[0].block_ids, vec!["data/content/homepage.json"]);
        assert_eq!(parsed[1].path, "/foo");
        assert_eq!(parsed[1].name, "foo");
        assert_eq!(parsed[1].block_ids, vec!["data/content/foo.json"]);
    }

    #[test]
    fn test_default_routes() {
        let routes = default_routes();
        assert_eq!(routes.len(), 1);
        assert_eq!(routes[0].path, "/");
        assert_eq!(routes[0].name, "homepage");
        assert_eq!(routes[0].block_ids, vec!["data/content/homepage.json"]);
    }
}
