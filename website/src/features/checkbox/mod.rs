/// Checkbox feature module
///
/// The Checkbox is a reusable UI component that displays:
/// - A checkbox input with label
/// - Accessible labels for screen readers
/// - Checked/unchecked states
/// - Validation states (required, etc.)
///
/// # Architecture
///
/// Following the feature-based architecture pattern:
/// - **Schema**: Data shape defined in schema.rs (CheckboxProps)
/// - **Template**: Maud rendering logic in template.rs
/// - **Styles**: Component-scoped CSS in styles.css
/// - **Story**: ComponentStory trait implementation in schema.rs for preview system
///
/// # Reusability
///
/// Like Button and Input, Checkbox is designed as a primitive component that can
/// be imported and composed by other features. Other features can import CheckboxProps
/// and use it within their own schemas.
///
/// # Usage
///
/// ```rust
/// use crate::features::checkbox::{CheckboxProps, render_checkbox};
///
/// let props = CheckboxProps {
///     label: "I agree to the terms".to_string(),
///     name: "terms".to_string(),
///     value: Some("agreed".to_string()),
///     checked: false,
///     required: true,
///     aria_describedby: None,
/// };
///
/// let markup = render_checkbox(&props);
/// ```
///
/// Or import CheckboxProps for composition:
///
/// ```rust
/// use crate::features::checkbox::CheckboxProps;
///
/// #[derive(Debug, Clone, Serialize, Deserialize)]
/// pub struct RegistrationFormProps {
///     pub terms_checkbox: CheckboxProps,
///     pub newsletter_checkbox: CheckboxProps,
/// }
/// ```
pub mod schema;
pub mod template;

// Re-export schema types for easy importing
pub use schema::CheckboxProps;

// Re-export the main rendering function for convenience
#[allow(unused_imports)]
pub use template::checkbox as render_checkbox;
