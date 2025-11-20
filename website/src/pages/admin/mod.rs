/// Admin pages module
///
/// Contains all admin route handlers and their page-level templates.
///
/// # Routes
///
/// - `GET /admin` - Admin index page
/// - `GET /admin/route/` - Route index page
/// - `GET /admin/route/homepage/` - Homepage editor page
/// - `POST /admin/api/homepage` - Homepage update API
use axum::response::Html;
use maud::html;

pub mod api;
pub mod homepage_editor;

// Re-export API handler
pub use api::update_homepage;
pub use homepage_editor::admin_route_homepage;

/// Admin index page
///
/// Provides navigation to available admin interfaces.
pub async fn admin_index() -> Html<String> {
    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Admin" }
            }
            body {
                h1 { "Admin" }
                a href="/admin/route/" { "Go to admin/route/" }
            }
        }
    };
    Html(markup.into_string())
}

/// Admin route index page
///
/// Lists all routes that can be edited through the admin interface.
pub async fn admin_route_index() -> Html<String> {
    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Admin Route" }
            }
            body {
                h1 { "Admin Route" }
                a href="/admin/route/homepage/" { "Go to admin/route/homepage/" }
            }
        }
    };
    Html(markup.into_string())
}
