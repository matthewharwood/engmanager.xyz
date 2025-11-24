/// Input component schema
///
/// This module defines the data shape (schema) for the Input component.
/// Following rust-core-patterns, props are type-safe domain types that
/// enforce validation at compile time.
///
/// # Usage
///
/// The Input is a reusable component that can be imported by other features:
///
/// ```rust
/// use crate::features::input::InputProps;
///
/// let input = InputProps {
///     label: "Email Address".to_string(),
///     name: "email".to_string(),
///     input_type: "email".to_string(),
///     placeholder: Some("you@example.com".to_string()),
///     value: None,
///     required: true,
///     aria_describedby: None,
/// };
/// ```
///
/// # Architecture
///
/// This schema is intentionally separate from the template logic to enable:
/// - **Reusability**: Other features can use InputProps without coupling to rendering
/// - **Type safety**: Serde validation ensures data integrity
/// - **Clear boundaries**: Schema defines the contract, template implements the presentation
///
/// # Story Support
///
/// InputProps implements ComponentStory trait to provide story/preview functionality
/// directly in the schema, eliminating the need for a separate story.rs file.
use maud::Markup;
use serde::{Deserialize, Serialize};

use crate::features::story::ComponentStory;

/// Input component props
///
/// Represents the data required to render a form input field.
///
/// # Fields
///
/// - `label`: The visible label text for the input
/// - `name`: The form field name attribute
/// - `input_type`: The input type (text, email, password, etc.)
/// - `placeholder`: Optional placeholder text
/// - `value`: Optional default value
/// - `required`: Whether the field is required
/// - `aria_describedby`: Optional ID of an element that describes the input
///
/// # Example JSON
///
/// ```json
/// {
///   "label": "Username",
///   "name": "username",
///   "input_type": "text",
///   "placeholder": "Enter your username",
///   "value": null,
///   "required": true,
///   "aria_describedby": null
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputProps {
    pub label: String,
    pub name: String,
    #[serde(rename = "type")]
    pub input_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aria_describedby: Option<String>,
}

/// ComponentStory implementation for Input
///
/// Following rust-core-patterns for trait-based abstraction, this implementation
/// provides all story functionality (name, description, fixture, rendering) directly
/// on the Props type.
impl ComponentStory for InputProps {
    fn story_name() -> &'static str {
        "input"
    }

    fn story_description() -> &'static str {
        "Form input field with label, validation, and accessibility features."
    }

    fn story_fixture() -> Self {
        InputProps {
            label: "Email Address".to_string(),
            name: "email".to_string(),
            input_type: "email".to_string(),
            placeholder: Some("you@example.com".to_string()),
            value: None,
            required: true,
            aria_describedby: None,
        }
    }

    fn render_story(&self) -> Markup {
        // Import the template function here to avoid circular dependencies
        crate::features::input::template::input(self)
    }

    // No additional stylesheets needed - using default implementation
}
