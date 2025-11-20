/// Hero feature module
///
/// The Hero is a prominent page section that displays:
/// - A large, attention-grabbing headline
/// - A supporting subheadline with additional context
///
/// # Architecture
///
/// Following the feature-based architecture pattern:
/// - **Props**: Defined in core/block.rs (HeroProps)
/// - **Template**: Maud rendering logic in template.rs
/// - **Styles**: Component-scoped CSS in styles.css
///
/// # Usage
///
/// ```rust
/// use crate::features::hero::render_hero;
/// use crate::core::HeroProps;
///
/// let props = HeroProps {
///     headline: "Welcome to Our Platform".to_string(),
///     subheadline: "Build amazing things with confidence".to_string(),
/// };
///
/// let markup = render_hero(&props);
/// ```
pub mod template;

// Re-export the main rendering function for convenience
pub use template::hero as render_hero;
