/// Homepage editor page
///
/// Provides a dual-view interface for editing homepage content:
/// - List view for visual block management
/// - JSON view for raw data editing
///
/// The template and route handler live together in the pages directory
/// because this is a page-level concern, not a reusable component.
use axum::response::Html;
use maud::{Markup, html};

use crate::core::load_homepage_blocks;
use crate::pages::homepage::HomepageData;

/// Route handler: GET /admin/route/homepage/
///
/// Loads the current homepage blocks and renders the editor interface.
/// Changes are persisted via the admin API endpoint.
pub async fn admin_route_homepage() -> Html<String> {
    let blocks = load_homepage_blocks();
    let data = HomepageData::new(blocks);
    let markup = render_editor_template(&data);
    Html(markup.into_string())
}

/// Render the homepage editor template
///
/// This template provides a dual-view interface with tab switching:
/// - **List View**: Visual block management with add/delete
/// - **JSON View**: Raw JSON editor for advanced editing
///
/// # Asset Dependencies
///
/// - `/features/admin/editor/styles.css` - Editor styles
/// - `/features/admin/editor/script.js` - Interactive behavior
fn render_editor_template(data: &HomepageData) -> Markup {
    let json = serde_json::to_string_pretty(data).unwrap_or_default();

    html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Edit Homepage" }
                link rel="stylesheet" href="/features/admin/editor/styles.css";
            }
            body {
                h1 { "Edit Homepage Content" }

                div class="tabs" {
                    button class="tab active" data-tab="list" { "List View" }
                    button class="tab" data-tab="json" { "JSON View" }
                }

                form id="homepage-form" {
                    // List View Tab
                    div class="tab-content active" id="list-view" {
                        div class="add-block" {
                            label { "Add Block: " }
                            select id="block-type-select" {
                                option value="Header" { "Header" }
                                option value="Hero" { "Hero" }
                            }
                            button type="button" class="btn-add" id="add-block-btn" { "+ Add Block" }
                        }

                        ul class="block-list" id="block-list" {}
                    }

                    // JSON View Tab
                    div class="tab-content" id="json-view" {
                        div class="form-group" {
                            label for="json-editor" { "Homepage JSON Data" }
                            textarea
                                id="json-editor"
                                name="json-data"
                                spellcheck="false"
                            {
                                (json)
                            }
                        }
                    }

                    div class="button-group" {
                        button type="submit" { "Publish Changes" }
                        a href="/" {
                            button type="button" { "Preview Homepage" }
                        }
                    }
                }

                div id="message" class="message" {}

                script src="/features/admin/editor/script.js" {}
            }
        }
    }
}
