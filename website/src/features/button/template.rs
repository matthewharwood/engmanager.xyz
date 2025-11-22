/// Button component Maud template
///
/// This module contains the pure rendering logic for the Button component.
/// Following maud-components-patterns, templates are separated from props
/// to maintain clean separation of concerns.
///
/// # Component Structure
///
/// The button renders as an anchor tag with:
/// - `href` attribute for navigation
/// - `aria-label` for accessibility
/// - CSS class for styling
///
/// # Asset References
///
/// This component has an associated stylesheet at:
/// `/features/button/styles.css`
use maud::{Markup, html};

use crate::core::Render;
use crate::features::button::ButtonProps;

/// Render the Button component with the given props
///
/// This is a pure function that takes ButtonProps and returns Markup.
/// It can be called directly or via the Render trait implementation.
#[allow(dead_code)] // Available for direct use, though typically accessed via Render trait
pub fn button(props: &ButtonProps) -> Markup {
    html! {
        a
            href=(props.href)
            aria-label=(props.aria_label)
            class="cta-button"
        {
            (props.text)
        }
    }
}

/// Implement Render trait for ButtonProps
///
/// This allows ButtonProps to be used polymorphically with other components
/// that implement Render, enabling composition and reusability.
impl Render for ButtonProps {
    fn render(&self) -> Markup {
        button(self)
    }
}
