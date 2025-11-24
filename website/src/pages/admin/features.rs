/// Feature Stories - Component Preview System
///
/// This module provides a Storybook-like component story system for previewing
/// UI components in isolation. Following the feature-based architecture pattern,
/// each feature can have a story.rs module that exports:
/// - `NAME: &str` - The story identifier
/// - `fixture() -> Props` - Sample data for rendering
///
/// # Architecture
///
/// Following rust-feature-architecture and axum-web-framework patterns:
/// - Stories are manually registered (compile-time discovery via this registry)
/// - Each story renders its component with fixture data
/// - Stories are accessed via /admin/features and /admin/features/{name}
///
/// # Routes
///
/// - `GET /admin/features/` - List all available component stories
/// - `GET /admin/features/{name}` - Render a specific component story
use axum::extract::Path;
use axum::response::Html;
use maud::{html, Markup};


use crate::features::button;
use crate::features::header;

/// Story metadata for listing
///
/// Following rust-core-patterns for type-safe domain modeling
#[derive(Debug, Clone)]
pub struct Story {
    pub name: &'static str,
    pub description: &'static str,
}

/// Renderable story trait
///
/// Defines the contract for rendering a component story. Each feature implements
/// this trait to provide story-specific rendering logic while using a shared
/// template structure.
///
/// Following rust-core-patterns for trait-based abstraction.
trait RenderableStory {
    /// The story identifier
    fn name(&self) -> &'static str;

    /// Human-readable description of the component
    fn description(&self) -> &'static str;

    /// Render the component with fixture data
    fn render_component(&self) -> Markup;

    /// Additional stylesheets beyond the main feature stylesheet
    ///
    /// Convention: All features have `/features/{feature_name}/styles.css`
    /// This method returns any additional stylesheets needed.
    fn additional_stylesheets(&self) -> Vec<&'static str> {
        Vec::new()
    }
}

/// Button story implementation
struct ButtonStory;

impl RenderableStory for ButtonStory {
    fn name(&self) -> &'static str {
        button::story::NAME
    }

    fn description(&self) -> &'static str {
        "Interactive button component with link and accessibility features."
    }

    fn render_component(&self) -> Markup {
        let props = button::story::fixture();
        button::template::button(&props)
    }
}

/// Header story implementation
struct HeaderStory;

impl RenderableStory for HeaderStory {
    fn name(&self) -> &'static str {
        header::story::NAME
    }

    fn description(&self) -> &'static str {
        "Page header with headline and call-to-action button."
    }

    fn render_component(&self) -> Markup {
        let props = header::story::fixture();
        header::template::header(&props)
    }

    fn additional_stylesheets(&self) -> Vec<&'static str> {
        vec![
            "/assets/styles.css",          // Global styles for base typography
            "/features/button/styles.css", // Button component styles
        ]
    }
}

/// Get all registered stories
///
/// Manual registry of all component stories in the codebase.
/// When adding a new feature with a story.rs module, add it here.
///
/// Following the pattern from rust-feature-architecture where features
/// are self-contained and registered explicitly.
pub fn get_all_stories() -> Vec<Story> {
    vec![
        Story {
            name: button::story::NAME,
            description: "Button component with link and accessibility support",
        },
        Story {
            name: header::story::NAME,
            description: "Header component with headline and call-to-action button",
        },
    ]
}

/// Route handler: GET /admin/features/
///
/// Displays a list of all available component stories with links to preview them.
///
/// Following maud-axum-integration patterns for HTML responses.
pub async fn features_index() -> Html<String> {
    let stories = get_all_stories();
    let markup = render_features_index(&stories);
    Html(markup.into_string())
}

/// Render the features index page
///
/// Following maud-components-patterns for clean template functions.
fn render_features_index(stories: &[Story]) -> Markup {
    html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Component Stories - Admin" }
                link rel="stylesheet" href="/assets/features/admin/editor/styles.css";
            }
            body {
                h1 { "Component Stories" }
                p { "Preview UI components in isolation with sample data." }

                div class="route-list" {
                    ul {
                        @for story in stories {
                            li {
                                a href=(format!("/admin/features/{}/", story.name)) {
                                    strong { (story.name) }
                                    " - "
                                    span { (story.description) }
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

/// Route handler: GET /admin/features/{name}
///
/// Renders a specific component story with its fixture data.
///
/// Following axum-web-framework patterns for path parameter extraction.
pub async fn feature_story(Path(name): Path<String>) -> Html<String> {
    let markup = match name.as_str() {
        "button" => render_story(&ButtonStory),
        "header" => render_story(&HeaderStory),
        _ => render_story_not_found(&name),
    };
    Html(markup.into_string())
}

/// Render a component story using a parameterized template
///
/// Single rendering function that works with any component implementing RenderableStory.
/// This eliminates duplication while maintaining type safety and flexibility.
///
/// # Convention
///
/// All features have one stylesheet at `/features/{feature_name}/styles.css`.
/// Additional stylesheets can be provided via `additional_stylesheets()`.
///
/// Following maud-components-patterns for clean, reusable template functions.
fn render_story(story: &impl RenderableStory) -> Markup {
    let name = story.name();
    let component = story.render_component();
    let additional_stylesheets = story.additional_stylesheets();

    html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { (capitalize_first(name)) " Story - Component Preview" }

                // Load additional stylesheets first (e.g., global styles, dependencies)
                @for stylesheet in additional_stylesheets {
                    link rel="stylesheet" href=(stylesheet);
                }

                // Load main feature stylesheet last (convention: /features/{name}/styles.css)
                link rel="stylesheet" href=(format!("/features/{}/styles.css", name));
            }
            body {
                h1 { (capitalize_first(name)) " Component" }
                p { (story.description()) }

                div class="story-preview" {
                    h2 { "Preview" }
                    div class="story-component" {
                        (component)
                    }
                }

                div class="button-group" {
                    a href="/admin/features/" {
                        button type="button" { "Back to Stories" }
                    }
                }
            }
        }
    }
}

/// Capitalize the first letter of a string
///
/// Helper function for formatting component names in titles.
fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

/// Render a 404 page for stories that don't exist
///
/// Following maud-axum-integration patterns for error pages.
fn render_story_not_found(name: &str) -> Markup {
    html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Story Not Found" }
            }
            body {
                h1 { "Story Not Found" }
                p { "The component story \"" (name) "\" does not exist." }

                div class="button-group" {
                    a href="/admin/features/" {
                        button type="button" { "Back to Stories" }
                    }
                }
            }
        }
    }
}
