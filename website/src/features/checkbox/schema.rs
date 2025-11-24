/// Checkbox component schema
///
/// This module defines the data shape (schema) for the Checkbox component.
/// Following rust-core-patterns, props are type-safe domain types that
/// enforce validation at compile time.
///
/// # Usage
///
/// The Checkbox is a reusable component that can be imported by other features:
///
/// ```rust
/// use crate::features::checkbox::CheckboxProps;
///
/// let checkbox = CheckboxProps {
///     label: "Subscribe to newsletter".to_string(),
///     name: "subscribe".to_string(),
///     value: Some("yes".to_string()),
///     checked: false,
///     required: false,
///     aria_describedby: None,
/// };
/// ```
///
/// # Architecture
///
/// This schema is intentionally separate from the template logic to enable:
/// - **Reusability**: Other features can use CheckboxProps without coupling to rendering
/// - **Type safety**: Serde validation ensures data integrity
/// - **Clear boundaries**: Schema defines the contract, template implements the presentation
///
/// # Story Support
///
/// CheckboxProps implements ComponentStory trait to provide story/preview functionality
/// directly in the schema, eliminating the need for a separate story.rs file.
use maud::Markup;
use serde::{Deserialize, Serialize};

use crate::features::story::ComponentStory;

/// Checkbox component props
///
/// Represents the data required to render a checkbox input field.
///
/// # Fields
///
/// - `label`: The visible label text for the checkbox
/// - `name`: The form field name attribute
/// - `value`: Optional value attribute (defaults to "on" if not provided)
/// - `checked`: Whether the checkbox is initially checked
/// - `required`: Whether the field is required
/// - `aria_describedby`: Optional ID of an element that describes the checkbox
///
/// # Example JSON
///
/// ```json
/// {
///   "label": "I agree to the terms and conditions",
///   "name": "terms",
///   "value": "agreed",
///   "checked": false,
///   "required": true,
///   "aria_describedby": "terms-description"
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckboxProps {
    pub label: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    pub checked: bool,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aria_describedby: Option<String>,
}

/// ComponentStory implementation for Checkbox
///
/// Following rust-core-patterns for trait-based abstraction, this implementation
/// provides all story functionality (name, description, fixture, rendering) directly
/// on the Props type.
impl ComponentStory for CheckboxProps {
    fn story_name() -> &'static str {
        "checkbox"
    }

    fn story_description() -> &'static str {
        "Checkbox input field with label, checked state, and accessibility features."
    }

    fn story_fixture() -> Self {
        CheckboxProps {
            label: "Send me product updates and announcements".to_string(),
            name: "newsletter".to_string(),
            value: Some("subscribe".to_string()),
            checked: false,
            required: false,
            aria_describedby: None,
        }
    }

    fn render_story(&self) -> Markup {
        // Import the template function here to avoid circular dependencies
        crate::features::checkbox::template::checkbox(self)
    }

    // No additional stylesheets needed - using default implementation
}
