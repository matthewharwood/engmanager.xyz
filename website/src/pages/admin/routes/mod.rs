/// Admin route index module
///
/// This module owns all route-listing functionality for the admin interface.
/// It provides a page that lists all routes that can be edited through the admin interface.
use axum::response::Html;
use maud::html;

/// Admin route index page
///
/// Lists all routes that can be edited through the admin interface.
///
/// # Routes
///
/// Currently available admin routes:
/// - `/admin/route/homepage/` - Homepage editor
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
