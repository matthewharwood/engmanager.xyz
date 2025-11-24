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
        "button" => render_button_story(),
        "header" => render_header_story(),
        _ => render_story_not_found(&name),
    };
    Html(markup.into_string())
}

/// Render the button component story
///
/// Uses the fixture data from button::story to render a preview.
fn render_button_story() -> Markup {
    let props = button::story::fixture();
    let component = button::template::button(&props);

    html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Button Story - Component Preview" }
                // Load button styles for preview
                link rel="stylesheet" href="/features/button/styles.css";
            }
            body {
                h1 { "Button Component" }
                p { "Interactive button component with link and accessibility features." }

                div class="story-preview" {
                    h2 { "Preview" }
                    div class="story-component" {
                        (component)
                    }
                }

                div class="story-props" {
                    h2 { "Fixture Data" }
                    pre {
                        code {
                            "ButtonProps {\n"
                            "    href: \"" (props.href) "\",\n"
                            "    text: \"" (props.text) "\",\n"
                            "    aria_label: \"" (props.aria_label) "\",\n"
                            "}"
                        }
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

/// Render the header component story
///
/// Uses the fixture data from header::story to render a preview.
fn render_header_story() -> Markup {
    let props = header::story::fixture();
    let component = header::template::header(&props);

    html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Header Story - Component Preview" }
                // Load global styles for base typography
                link rel="stylesheet" href="/assets/styles.css";
                // Load header and button styles for preview
                link rel="stylesheet" href="/features/header/styles.css";
                link rel="stylesheet" href="/features/button/styles.css";
            }
            body {
                h1 { "Header Component" }
                p { "Page header with headline and call-to-action button." }

                div class="story-preview" {
                    h2 { "Preview" }
                    div class="story-component" {
                        (component)
                    }
                }

                div class="story-props" {
                    h2 { "Fixture Data" }
                    pre {
                        code {
                            "HeaderProps {\n"
                            "    headline: \"" (props.headline) "\",\n"
                            "    button: ButtonProps {\n"
                            "        href: \"" (props.button.href) "\",\n"
                            "        text: \"" (props.button.text) "\",\n"
                            "        aria_label: \"" (props.button.aria_label) "\",\n"
                            "    },\n"
                            "}"
                        }
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
                link rel="stylesheet" href="/assets/features/admin/editor/styles.css";
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
