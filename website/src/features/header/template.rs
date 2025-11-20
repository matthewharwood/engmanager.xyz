/// Header component Maud template
///
/// This module contains the pure rendering logic for the Header component.
/// Following maud-components-patterns, templates are separated from props
/// to maintain clean separation of concerns.
///
/// # Component Structure
///
/// The header contains:
/// - A headline (h1)
/// - A call-to-action button
///
/// # Asset References
///
/// This component has an associated stylesheet at:
/// `/features/header/styles.css`
///
/// The stylesheet is loaded in the page <head>, not inline with the component.
use maud::{html, Markup};

use crate::core::{HeaderProps, Render};

/// Render the Header component with the given props
///
/// This is a pure function that takes HeaderProps and returns Markup.
/// It can be called directly or via the Render trait implementation.
pub fn header(props: &HeaderProps) -> Markup {
    html! {
        header class="header-block" {
            div class="container" {
                h1 { (props.headline) }
                a
                    href=(props.button.href)
                    aria-label=(props.button.aria_label)
                    class="cta-button"
                {
                    (props.button.text)
                }
            }
        }
    }
}

/// Implement Render trait for HeaderProps
///
/// This allows HeaderProps to be used polymorphically with other components
/// that implement Render, enabling composition and reusability.
impl Render for HeaderProps {
    fn render(&self) -> Markup {
        header(self)
    }
}
