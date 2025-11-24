/// Button component schema
///
/// This module defines the data shape (schema) for the Button component.
/// Following rust-core-patterns, props are type-safe domain types that
/// enforce validation at compile time.
///
/// # Usage
///
/// The Button is a reusable component that can be imported by other features:
///
/// ```rust
/// use crate::features::button::ButtonProps;
///
/// let button = ButtonProps {
///     href: "/contact".to_string(),
///     text: "Get in touch".to_string(),
///     aria_label: "Contact us to discuss your needs".to_string(),
/// };
/// ```
///
/// # Architecture
///
/// This schema is intentionally separate from the template logic to enable:
/// - **Reusability**: Other features can use ButtonProps without coupling to rendering
/// - **Type safety**: Serde validation ensures data integrity
/// - **Clear boundaries**: Schema defines the contract, template implements the presentation
///
/// # Story Support
///
/// ButtonProps implements ComponentStory trait to provide story/preview functionality
/// directly in the schema, eliminating the need for a separate story.rs file.
use maud::Markup;
use serde::{Deserialize, Serialize};

use crate::features::story::ComponentStory;

/// Button component props
///
/// Represents the data required to render a clickable button/link.
///
/// # Fields
///
/// - `href`: The URL the button navigates to
/// - `text`: The visible button label
/// - `aria_label`: Accessible description for screen readers
///
/// # Example JSON
///
/// ```json
/// {
///   "href": "/start",
///   "text": "Get Started",
///   "aria_label": "Navigate to getting started page"
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ButtonProps {
    pub href: String,
    pub text: String,
    pub aria_label: String,
}

/// ComponentStory implementation for Button
///
/// Following rust-core-patterns for trait-based abstraction, this implementation
/// provides all story functionality (name, description, fixture, rendering) directly
/// on the Props type.
impl ComponentStory for ButtonProps {
    fn story_name() -> &'static str {
        "button"
    }

    fn story_description() -> &'static str {
        "Interactive button component with link and accessibility features."
    }

    fn story_fixture() -> Self {
        ButtonProps {
            href: "/example".to_string(),
            text: "Example Button".to_string(),
            aria_label: "Example button for demonstration".to_string(),
        }
    }

    fn render_story(&self) -> Markup {
        // Import the template function here to avoid circular dependencies
        crate::features::button::template::button(self)
    }

    // No additional stylesheets needed - using default implementation
}
