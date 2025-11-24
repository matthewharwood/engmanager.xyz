/// Button feature module
///
/// The Button is a reusable UI component that displays:
/// - A clickable link styled as a button
/// - Accessible labels for screen readers
///
/// # Architecture
///
/// Following the feature-based architecture pattern:
/// - **Schema**: Data shape defined in schema.rs (ButtonProps)
/// - **Template**: Maud rendering logic in template.rs
/// - **Styles**: Component-scoped CSS in styles.css
/// - **Story**: ComponentStory trait implementation in schema.rs for preview system
///
/// # Reusability
///
/// Unlike other features (Header, Hero), Button is designed as a primitive
/// component that can be imported and composed by other features. Other
/// features can import ButtonProps and use it within their own schemas.
///
/// # Usage
///
/// ```rust
/// use crate::features::button::{ButtonProps, render_button};
///
/// let props = ButtonProps {
///     href: "/start".to_string(),
///     text: "Get Started".to_string(),
///     aria_label: "Navigate to getting started page".to_string(),
/// };
///
/// let markup = render_button(&props);
/// ```
///
/// Or import ButtonProps for composition:
///
/// ```rust
/// use crate::features::button::ButtonProps;
///
/// #[derive(Debug, Clone, Serialize, Deserialize)]
/// pub struct HeaderProps {
///     pub headline: String,
///     pub button: ButtonProps,  // Reuse button schema
/// }
/// ```
pub mod schema;
pub mod template;

// Re-export schema types for easy importing
pub use schema::ButtonProps;

// Re-export the main rendering function for convenience
// Note: Currently unused as Header embeds button inline, but available for future use
#[allow(unused_imports)]
pub use template::button as render_button;
