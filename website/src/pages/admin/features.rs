/// Feature Stories - Component Preview System
///
/// This module provides a Storybook-like component story system for previewing
/// UI components in isolation. Following the feature-based architecture pattern,
/// each feature's schema.rs implements the ComponentStory trait to provide:
/// - Story name and description
/// - Fixture data generation
/// - Component rendering
/// - Additional stylesheet requirements
///
/// # Architecture
///
/// Following rust-feature-architecture and axum-web-framework patterns:
/// - Stories are manually registered (compile-time discovery via this registry)
/// - Each Props type implements ComponentStory trait in its schema.rs
/// - Stories are accessed via /admin/features and /admin/features/{name}
/// - No separate story.rs files needed - all functionality lives in schema.rs
///
/// # Routes
///
/// - `GET /admin/features/` - List all available component stories
/// - `GET /admin/features/{name}` - Render a specific component story
use axum::extract::Path;
use axum::response::Html;
use maud::{html, Markup};

use crate::features::button::ButtonProps;
use crate::features::checkbox::CheckboxProps;
use crate::features::header::HeaderProps;
use crate::features::input::InputProps;
use crate::features::story::ComponentStory;

/// Story metadata for listing
///
/// Following rust-core-patterns for type-safe domain modeling
#[derive(Debug, Clone)]
pub struct Story {
    pub name: &'static str,
    pub description: &'static str,
}

/// Get all registered stories
///
/// Manual registry of all component stories in the codebase.
/// When adding a new feature that implements ComponentStory, add it here.
///
/// Following the pattern from rust-feature-architecture where features
/// are self-contained and registered explicitly.
///
/// # Usage
///
/// Each entry uses the ComponentStory trait's static methods to provide metadata:
/// - `story_name()` for the identifier
/// - `story_description()` for the human-readable description
pub fn get_all_stories() -> Vec<Story> {
    vec![
        Story {
            name: ButtonProps::story_name(),
            description: ButtonProps::story_description(),
        },
        Story {
            name: CheckboxProps::story_name(),
            description: CheckboxProps::story_description(),
        },
        Story {
            name: HeaderProps::story_name(),
            description: HeaderProps::story_description(),
        },
        Story {
            name: InputProps::story_name(),
            description: InputProps::story_description(),
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
        "button" => render_story_for::<ButtonProps>(),
        "checkbox" => render_story_for::<CheckboxProps>(),
        "header" => render_story_for::<HeaderProps>(),
        "input" => render_story_for::<InputProps>(),
        _ => render_story_not_found(&name),
    };
    Html(markup.into_string())
}

/// Render a component story using ComponentStory trait
///
/// Single rendering function that works with any component implementing ComponentStory.
/// This eliminates duplication while maintaining type safety and flexibility.
///
/// # Type Parameters
///
/// - `T`: A type that implements ComponentStory (e.g., ButtonProps, HeaderProps)
///
/// # Convention
///
/// All features have one stylesheet at `/features/{feature_name}/styles.css`.
/// Additional stylesheets can be provided via `additional_stylesheets()`.
///
/// Following maud-components-patterns for clean, reusable template functions.
fn render_story_for<T: ComponentStory>() -> Markup {
    let name = T::story_name();
    let description = T::story_description();
    let fixture = T::story_fixture();
    let component = fixture.render_story();
    let additional_stylesheets = T::additional_stylesheets();

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
                p { (description) }

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
