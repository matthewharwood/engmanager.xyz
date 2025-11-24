/// Route editor page
///
/// Provides a dual-view interface for editing route content:
/// - List view for visual block management
/// - JSON view for raw data editing
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
/// Loads the route by name from routes.json, then loads the corresponding
/// page data and renders the editor interface.
///
/// # Path Parameters
///
/// - `name`: The route name (e.g., "homepage", "foo")
///
/// # Error Handling
///
/// Returns 404 if the route name is not found in routes.json.
pub async fn admin_route_homepage(Path(name): Path<String>) -> Response {
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
