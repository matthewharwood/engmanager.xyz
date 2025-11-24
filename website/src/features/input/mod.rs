/// Input feature module
///
/// The Input is a reusable UI component that displays:
/// - A labeled form input field
/// - Accessible labels for screen readers
/// - Validation states (required, invalid, etc.)
///
/// # Architecture
///
/// Following the feature-based architecture pattern:
/// - **Schema**: Data shape defined in schema.rs (InputProps)
/// - **Template**: Maud rendering logic in template.rs
/// - **Styles**: Component-scoped CSS in styles.css
/// - **Story**: ComponentStory trait implementation in schema.rs for preview system
///
/// # Reusability
///
/// Like Button, Input is designed as a primitive component that can be imported
/// and composed by other features. Other features can import InputProps and use
/// it within their own schemas.
///
/// # Usage
///
/// ```rust
/// use crate::features::input::{InputProps, render_input};
///
/// let props = InputProps {
///     label: "Email".to_string(),
///     name: "email".to_string(),
///     input_type: "email".to_string(),
///     placeholder: Some("you@example.com".to_string()),
///     value: None,
///     required: true,
///     aria_describedby: None,
/// };
///
/// let markup = render_input(&props);
/// ```
///
/// Or import InputProps for composition:
///
/// ```rust
/// use crate::features::input::InputProps;
///
/// #[derive(Debug, Clone, Serialize, Deserialize)]
/// pub struct LoginFormProps {
///     pub email_input: InputProps,
///     pub password_input: InputProps,
/// }
/// ```
pub mod schema;
pub mod template;

// Re-export schema types for easy importing
pub use schema::InputProps;

// Re-export the main rendering function for convenience
#[allow(unused_imports)]
pub use template::input as render_input;
