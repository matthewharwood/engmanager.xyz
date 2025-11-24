/// Generic page editor for any route
///
/// Provides a dual-view interface for editing content from any route defined in routes.json:
/// - List view for visual block management
/// - JSON view for raw data editing
///
/// # Data Persistence
///
/// Content is loaded from and saved to data/content/{route_name}.json files.
/// This works generically for any route (homepage, foo, etc.) via:
/// - `load_blocks(route_name)` - Reads from data/content/{route_name}.json
/// - `save_blocks(route_name)` - Writes to data/content/{route_name}.json (via API)
///
/// The template and route handler live together in the pages directory
/// because this is a page-level concern, not a reusable component.
use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use maud::{Markup, html};

use crate::core::{load_blocks, load_routes};
use crate::pages::homepage::HomepageData;

/// Route handler: GET /admin/route/:name/
///
/// Generic page editor that works with any route defined in routes.json.
/// Loads the route by name from routes.json, then loads the corresponding
/// page data from data/content/{name}.json and renders the editor interface.
///
/// # Path Parameters
///
/// - `name`: The route name (e.g., "homepage", "foo")
///
/// # Data Flow
///
/// - **Load**: Reads blocks from data/content/{name}.json via `load_blocks(name)`
/// - **Save**: Persists blocks to data/content/{name}.json via `save_blocks(name)` (API endpoint)
///
/// # Error Handling
///
/// Returns 404 if the route name is not found in routes.json.
pub async fn admin_route_page(Path(name): Path<String>) -> Response {
    // Load routes and find the requested route
    let routes = load_routes();
    let route = match routes.iter().find(|r| r.name == name) {
        Some(r) => r,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Html(format!(
                    "<h1>404 Not Found</h1><p>Route '{}' not found</p>",
                    name
                )),
            )
                .into_response();
        }
    };

    // Load blocks for this specific route using the generic loader
    let blocks = load_blocks(&name);
    let data = HomepageData::new(blocks);
    let markup = render_editor_template(&data, route, &name);
    Html(markup.into_string()).into_response()
}

/// Render the route editor template
///
/// This template provides a dual-view interface with tab switching:
/// - **List View**: Visual block management with add/delete
/// - **JSON View**: Raw JSON editor for advanced editing
///
/// # Asset Dependencies
///
/// - `/features/admin/editor/styles.css` - Editor styles
/// - `/features/admin/editor/components/index.js` - Web components (ES module)
fn render_editor_template(
    data: &HomepageData,
    route: &crate::core::Route,
    route_name: &str,
) -> Markup {
    let json = serde_json::to_string_pretty(data).unwrap_or_default();

    html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Edit " (route.name) }
                link rel="stylesheet" href="/features/admin/editor/styles.css";
            }
            body {
                h1 { "Edit " (route.name) " Content" }
                p style="color: #666; margin-bottom: 1rem;" {
                    "Route: "
                    code { (route.path) }
                }

                // Web component structure - using custom elements
                admin-editor data-route-name=(route_name) {
                    // Tab switcher component
                    tab-switcher active-tab="list" {
                        button class="tab" data-tab="list" { "List View" }
                        button class="tab" data-tab="json" { "JSON View" }
                    }

                    // Tab content containers
                    div class="tab-content" id="list-view" {
                        // Block list component with initial data
                        block-list {}
                    }

                    div class="tab-content" id="json-view" {
                        // Monaco JSON editor component with initial data
                        monaco-json-editor value=(json) {}
                    }

                    // Form for submission
                    form {
                        div class="button-group" {
                            button type="submit" { "Publish Changes" }
                            a href=(route.path) {
                                button type="button" { "Preview " (route.name) }
                            }
                        }
                    }

                    // Message banner component
                    message-banner {}
                }

                // Load web components as ES module
                script type="module" src="/features/admin/editor/components/index.js" {}
            }
        }
    }
}
