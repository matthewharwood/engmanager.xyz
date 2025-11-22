/// Header component schema
///
/// This module defines the data shape (schema) for the Header component.
/// Following rust-core-patterns, props are type-safe domain types that
/// enforce validation at compile time.
///
/// # Dependencies
///
/// The Header composes the Button component, demonstrating feature-level
/// composition. ButtonProps is imported from the button feature.
///
/// # Architecture
///
/// This schema is intentionally separate from the template logic to enable:
/// - **Type safety**: Serde validation ensures data integrity
/// - **Clear boundaries**: Schema defines the contract, template implements the presentation
/// - **Composition**: Reuses ButtonProps from the button feature
use serde::{Deserialize, Serialize};

use crate::features::button::ButtonProps;

/// Header component props
///
/// Represents the data required to render the page header section.
///
/// # Fields
///
/// - `headline`: The main heading text displayed in the header
/// - `button`: A call-to-action button (composed from ButtonProps)
///
/// # Example JSON
///
/// ```json
/// {
///   "headline": "Welcome to Our Platform",
///   "button": {
///     "href": "/start",
///     "text": "Get Started",
///     "aria_label": "Navigate to getting started page"
///   }
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderProps {
    pub headline: String,
    pub button: ButtonProps,
}
