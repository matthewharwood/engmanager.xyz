/// Header component schema
///
/// This module defines the data shape (schema) for the Header component.
/// Following rust-core-patterns, props are type-safe domain types that
/// enforce validation at compile time.
///
/// # Dependencies
///
/// The Header composes the Button component, demonstrating feature-level
/// composition. ButtonProps is imported from the button feature.
///
/// # Architecture
///
/// This schema is intentionally separate from the template logic to enable:
/// - **Type safety**: Serde validation ensures data integrity
/// - **Clear boundaries**: Schema defines the contract, template implements the presentation
/// - **Composition**: Reuses ButtonProps from the button feature
///
/// # Story Support
///
/// HeaderProps implements ComponentStory trait to provide story/preview functionality
/// directly in the schema, eliminating the need for a separate story.rs file.
use maud::Markup;
use serde::{Deserialize, Serialize};

use crate::features::button::ButtonProps;
use crate::features::story::ComponentStory;

/// Header component props
///
/// Represents the data required to render the page header section.
///
/// # Fields
///
/// - `headline`: The main heading text displayed in the header
/// - `button`: A call-to-action button (composed from ButtonProps)
///
/// # Example JSON
///
/// ```json
/// {
///   "headline": "Welcome to Our Platform",
///   "button": {
///     "href": "/start",
///     "text": "Get Started",
///     "aria_label": "Navigate to getting started page"
///   }
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderProps {
    pub headline: String,
    pub button: ButtonProps,
}

/// ComponentStory implementation for Header
///
/// Following rust-core-patterns for trait-based abstraction, this implementation
/// provides all story functionality (name, description, fixture, rendering) directly
/// on the Props type.
impl ComponentStory for HeaderProps {
    fn story_name() -> &'static str {
        "header"
    }

    fn story_description() -> &'static str {
        "Page header with headline and call-to-action button."
    }

    fn story_fixture() -> Self {
        HeaderProps {
            headline: "Sample Header Component".to_string(),
            button: ButtonProps {
                href: "https://www.google.com".to_string(),
                text: "Click Me".to_string(),
                aria_label: "Navigate to Google".to_string(),
            },
        }
    }

    fn render_story(&self) -> Markup {
        // Import the template function here to avoid circular dependencies
        crate::features::header::template::header(self)
    }

    fn additional_stylesheets() -> Vec<&'static str> {
        vec![
            "/assets/styles.css",          // Global styles for base typography
            "/features/button/styles.css", // Button component styles
        ]
    }
}
