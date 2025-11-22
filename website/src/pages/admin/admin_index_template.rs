/// Admin Index component Maud template
///
/// This module contains the pure rendering logic for the Admin Index component.
/// Following maud-components-patterns, this is a simple function component.
///
/// # Component Structure
///
/// The admin index contains:
/// - A black circle (visual element)
/// - "ADMIN" heading
/// - "Routes" link to /admin/route/
///
/// # Asset References
///
/// This component has an associated stylesheet at:
/// `/features/admin_index/styles.css`
///
/// The stylesheet is loaded in the page <head>, not inline with the component.
use maud::{Markup, html};

/// Render the Admin Index component
///
/// This is a pure function that returns Markup for the admin index page.
/// The component displays a centered layout with a black circle, heading, and link.
pub fn render_admin_index() -> Markup {
    html! {
        div class="admin-index" {
            div class="admin-index__circle" {}
            h1 class="admin-index__heading" { "ADMIN" }
            a class="admin-index__link" href="/admin/route/" { "Routes" }
        }
    }
}
