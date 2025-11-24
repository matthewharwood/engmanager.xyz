/// Input component Maud template
///
/// This module contains the pure rendering logic for the Input component.
/// Following maud-components-patterns, templates are separated from props
/// to maintain clean separation of concerns.
///
/// # Component Structure
///
/// The input renders as a form field with:
/// - Label element for accessibility
/// - Input element with appropriate attributes
/// - Required indicator when applicable
/// - CSS class for styling
///
/// # Asset References
///
/// This component has an associated stylesheet at:
/// `/features/input/styles.css`
use maud::{html, Markup};

use crate::core::Render;
use crate::features::input::InputProps;

/// Render the Input component with the given props
///
/// This is a pure function that takes InputProps and returns Markup.
/// It can be called directly or via the Render trait implementation.
#[allow(dead_code)] // Available for direct use, though typically accessed via Render trait
pub fn input(props: &InputProps) -> Markup {
    html! {
        div class="form-field" {
            label for=(props.name) class="form-label" {
                (props.label)
                @if props.required {
                    span class="required-indicator" aria-label="required" { " *" }
                }
            }
            input
                type=(props.input_type)
                id=(props.name)
                name=(props.name)
                class="form-input"
                placeholder=[props.placeholder.as_deref()]
                value=[props.value.as_deref()]
                required[props.required]
                aria-describedby=[props.aria_describedby.as_deref()]
            {}
        }
    }
}

/// Implement Render trait for InputProps
///
/// This allows InputProps to be used polymorphically with other components
/// that implement Render, enabling composition and reusability.
impl Render for InputProps {
    fn render(&self) -> Markup {
        input(self)
    }
}
