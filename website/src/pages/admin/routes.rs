/// Route index page
///
/// Displays a list of all available routes for editing in the admin interface.
///
/// This page loads routes from routes.json and provides links to edit each route.
use axum::response::Html;
use maud::{Markup, html};

use crate::core::load_routes;

/// Route handler: GET /admin/route/
///
/// Displays the list of all routes with links to their editors.
pub async fn admin_route_index() -> Html<String> {
    let routes = load_routes();
    let markup = render_route_index(&routes);
    Html(markup.into_string())
}

/// Render the route index template
///
/// Shows a list of routes with links to edit each one.
fn render_route_index(routes: &[crate::core::Route]) -> Markup {
    html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Routes - Admin" }
                link rel="stylesheet" href="/features/admin/editor/styles.css";
            }
            body {
                h1 { "Routes" }

                div class="route-list" {
                    ul {
                        @for route in routes {
                            li {
                                a href=(format!("/admin/route/{}/", route.name)) {
                                    strong { (route.name) }
                                    " - "
                                    code { (route.path) }
                                }
                            }
                        }
                    }
                }

                div class="button-group" {
                    a href="/admin" {
                        button type="button" { "Back to Admin" }
                    }
                }
            }
        }
    }
}
