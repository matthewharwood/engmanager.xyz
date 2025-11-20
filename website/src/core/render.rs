/// Core trait for rendering components to Maud Markup
///
/// This trait enables a consistent interface for all components that can be
/// rendered to HTML using the Maud templating engine. Each component implements
/// this trait to provide its own rendering logic.
///
/// # Philosophy
///
/// Following the maud-components-patterns skill, the Render trait provides:
/// - **Type safety**: Components must explicitly implement rendering
/// - **Composition**: Components can render other components via the trait
/// - **Separation of concerns**: Rendering logic is isolated from data structures
///
/// # Example
///
/// ```rust
/// use maud::{html, Markup};
/// use crate::core::render::Render;
///
/// struct Button {
///     text: String,
///     href: String,
/// }
///
/// impl Render for Button {
///     fn render(&self) -> Markup {
///         html! {
///             a href=(self.href) { (self.text) }
///         }
///     }
/// }
/// ```
use maud::Markup;

/// Trait for components that can be rendered to Maud Markup
pub trait Render {
    /// Render the component to Maud Markup (HTML)
    ///
    /// This method is called to transform a component into its HTML representation.
    /// The resulting Markup can be embedded in other templates or returned as an
    /// HTTP response via Axum's IntoResponse trait.
    fn render(&self) -> Markup;
}
