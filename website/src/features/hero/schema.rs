/// Hero component schema
///
/// This module defines the data shape (schema) for the Hero component.
/// Following rust-core-patterns, props are type-safe domain types that
/// enforce validation at compile time.
///
/// # Architecture
///
/// This schema is intentionally separate from the template logic to enable:
/// - **Type safety**: Serde validation ensures data integrity
/// - **Clear boundaries**: Schema defines the contract, template implements the presentation
use serde::{Deserialize, Serialize};

/// Hero component props
///
/// Represents the data required to render the hero section.
///
/// # Fields
///
/// - `headline`: The main hero heading (typically large and attention-grabbing)
/// - `subheadline`: Supporting text that provides additional context
///
/// # Example JSON
///
/// ```json
/// {
///   "headline": "Build Amazing Things",
///   "subheadline": "With the tools and expertise you need to succeed"
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeroProps {
    pub headline: String,
    pub subheadline: String,
}
