/// Component Story trait for the component preview system
///
/// This module defines a trait that component Props types can implement to provide
/// story functionality (name, fixture data, description, rendering) directly in
/// their schema files, eliminating the need for separate story.rs files.
///
/// # Architecture
///
/// Following rust-core-patterns for trait-based abstraction, each feature's Props
/// type can implement this trait to participate in the story/preview system.
///
/// # Usage
///
/// Implement this trait in your schema.rs file:
///
/// ```rust
/// use crate::features::story::ComponentStory;
/// use maud::{html, Markup};
///
/// #[derive(Debug, Clone, Serialize, Deserialize)]
/// pub struct ButtonProps {
///     pub href: String,
///     pub text: String,
///     pub aria_label: String,
/// }
///
/// impl ComponentStory for ButtonProps {
///     fn story_name() -> &'static str {
///         "button"
///     }
///
///     fn story_description() -> &'static str {
///         "Interactive button component with link and accessibility features."
///     }
///
///     fn story_fixture() -> Self {
///         ButtonProps {
///             href: "/example".to_string(),
///             text: "Example Button".to_string(),
///             aria_label: "Example button for demonstration".to_string(),
///         }
///     }
///
///     fn render_story(&self) -> Markup {
///         crate::features::button::template::button(self)
///     }
///
///     fn additional_stylesheets() -> Vec<&'static str> {
///         vec![]
///     }
/// }
/// ```
///
/// Then in your admin/features.rs, you can use this trait:
///
/// ```rust
/// use crate::features::story::ComponentStory;
/// use crate::features::button::ButtonProps;
///
/// let name = ButtonProps::story_name();
/// let description = ButtonProps::story_description();
/// let fixture = ButtonProps::story_fixture();
/// let markup = fixture.render_story();
/// ```
use maud::Markup;

/// Trait for component types that can be previewed in the story system
///
/// This trait provides all the functionality previously split between story.rs
/// modules and RenderableStory implementations. By implementing this trait on
/// your Props type, you provide everything needed for the component preview system.
///
/// # Design Notes
///
/// - Static methods for metadata (name, description) that don't need an instance
/// - Instance method for rendering to allow flexibility with props
/// - Default implementation for additional_stylesheets (most components don't need it)
/// - Follows rust-core-patterns for trait-based abstraction
pub trait ComponentStory: Sized {
    /// The story identifier (e.g., "button", "header")
    ///
    /// Used in URLs and for component identification.
    fn story_name() -> &'static str;

    /// Human-readable description of the component
    ///
    /// Displayed on the story preview page to explain what the component does.
    fn story_description() -> &'static str;

    /// Create fixture data for the story preview
    ///
    /// Returns sample data that demonstrates the component's functionality.
    fn story_fixture() -> Self;

    /// Render the component with this instance's data
    ///
    /// Takes self to allow rendering with fixture data or custom props.
    fn render_story(&self) -> Markup;

    /// Additional stylesheets beyond the main feature stylesheet
    ///
    /// Convention: All features have `/features/{feature_name}/styles.css`
    /// This method returns any additional stylesheets needed (e.g., global styles,
    /// dependencies like button styles for header).
    ///
    /// Default implementation returns an empty vector (no additional stylesheets).
    fn additional_stylesheets() -> Vec<&'static str> {
        Vec::new()
    }
}
