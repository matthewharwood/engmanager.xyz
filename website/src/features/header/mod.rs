/// Header feature module
///
/// The Header is a top-level page component that displays:
/// - A prominent headline
/// - A call-to-action button
///
/// # Architecture
///
/// Following the feature-based architecture pattern:
/// - **Props**: Defined in core/block.rs (HeaderProps, ButtonProps)
/// - **Template**: Maud rendering logic in template.rs
/// - **Styles**: Component-scoped CSS in styles.css
///
/// # Usage
///
/// ```rust
/// use crate::features::header::render_header;
/// use crate::core::{HeaderProps, ButtonProps};
///
/// let props = HeaderProps {
///     headline: "Welcome".to_string(),
///     button: ButtonProps {
///         href: "/start".to_string(),
///         text: "Get Started".to_string(),
///         aria_label: "Navigate to getting started page".to_string(),
///     },
/// };
///
/// let markup = render_header(&props);
/// ```
pub mod template;

// Re-export the main rendering function for convenience
pub use template::header as render_header;
