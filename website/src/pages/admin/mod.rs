/// Admin pages module
///
/// Contains all admin route handlers and their page-level templates.
///
/// # Routes
///
/// - `GET /admin` - Admin index page
/// - `GET /admin/route/` - Route index page (list all routes)
/// - `GET /admin/route/:name/` - Generic page editor for any route (homepage, foo, etc.)
/// - `GET /admin/features/` - Component stories index page
/// - `GET /admin/features/:name/` - Component story preview or block editor
/// - `GET /admin/schema-test/:component/` - Schema-driven form test routes (dev only)
/// - `POST /admin/api/homepage` - Legacy homepage update API (use /admin/api/:route_name instead)
/// - `POST /admin/api/:route_name` - Generic route update API (saves to data/content/{route_name}.json)
use axum::response::Html;
use maud::html;

// Submodules
pub mod admin_index_template;
pub mod api;
pub mod features;
pub mod page_editor;
pub mod routes;

// Re-export handlers
pub use admin_index_template::render_admin_index;
pub use api::{update_homepage, update_route};
pub use features::{feature_story, features_index};
pub use page_editor::admin_route_page;
pub use routes::admin_route_index;

/// Admin index page
///
/// Provides navigation to available admin interfaces.
///
/// # Layout Structure
///
/// The page includes:
/// - Global styles (Monument Extended font, Utopia fluid scales)
/// - Admin index component styles
/// - Admin index component (black circle, heading, routes link)
pub async fn admin_index() -> Html<String> {
    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Admin" }

                // Global styles (Utopia fluid typography, fonts, resets)
                link rel="stylesheet" href="/assets/styles.css";

                // Admin index component styles
                link rel="stylesheet" href="/assets/admin-index.css";
            }
            body {
                (render_admin_index())
            }
        }
    };
    Html(markup.into_string())
}
