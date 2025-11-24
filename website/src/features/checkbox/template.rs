/// Checkbox component Maud template
///
/// This module contains the pure rendering logic for the Checkbox component.
/// Following maud-components-patterns, templates are separated from props
/// to maintain clean separation of concerns.
///
/// # Component Structure
///
/// The checkbox renders as a form field with:
/// - Label element wrapping the input for better accessibility
/// - Checkbox input element with appropriate attributes
/// - Required indicator when applicable
/// - CSS class for styling
///
/// # Asset References
///
/// This component has an associated stylesheet at:
/// `/features/checkbox/styles.css`
use maud::{html, Markup};

use crate::core::Render;
use crate::features::checkbox::CheckboxProps;

/// Render the Checkbox component with the given props
///
/// This is a pure function that takes CheckboxProps and returns Markup.
/// It can be called directly or via the Render trait implementation.
#[allow(dead_code)] // Available for direct use, though typically accessed via Render trait
pub fn checkbox(props: &CheckboxProps) -> Markup {
    html! {
        div class="checkbox-field" {
            label class="checkbox-label" {
                input
                    type="checkbox"
                    id=(props.name)
                    name=(props.name)
                    class="checkbox-input"
                    value=[props.value.as_deref()]
                    checked[props.checked]
                    required[props.required]
                    aria-describedby=[props.aria_describedby.as_deref()]
                {}
                span class="checkbox-label-text" {
                    (props.label)
                    @if props.required {
                        span class="required-indicator" aria-label="required" { " *" }
                    }
                }
            }
        }
    }
}

/// Implement Render trait for CheckboxProps
///
/// This allows CheckboxProps to be used polymorphically with other components
/// that implement Render, enabling composition and reusability.
impl Render for CheckboxProps {
    fn render(&self) -> Markup {
        checkbox(self)
    }
}
