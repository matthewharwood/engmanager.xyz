/// Hero component Maud template
///
/// This module contains the pure rendering logic for the Hero component.
/// Following maud-components-patterns, templates are separated from props
/// to maintain clean separation of concerns.
///
/// # Component Structure
///
/// The hero contains:
/// - A large headline (h2)
/// - A descriptive subheadline
///
/// # Asset References
///
/// This component has an associated stylesheet at:
/// `/features/hero/styles.css`
///
/// The stylesheet is loaded in the page <head>, not inline with the component.
use maud::{html, Markup};

use crate::core::{HeroProps, Render};

/// Render the Hero component with the given props
///
/// This is a pure function that takes HeroProps and returns Markup.
/// It can be called directly or via the Render trait implementation.
pub fn hero(props: &HeroProps) -> Markup {
    html! {
        section class="hero-block" {
            div class="container" {
                h2 { (props.headline) }
                p class="subheadline" { (props.subheadline) }
            }
        }
    }
}

/// Implement Render trait for HeroProps
///
/// This allows HeroProps to be used polymorphically with other components
/// that implement Render, enabling composition and reusability.
impl Render for HeroProps {
    fn render(&self) -> Markup {
        hero(self)
    }
}
