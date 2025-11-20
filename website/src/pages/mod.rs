/// Pages module - Route handlers for top-level pages
///
/// This module contains handlers for full-page routes. Each page may compose
/// multiple feature components to create the final layout.
///
/// # Architecture
///
/// Pages are responsible for:
/// - Loading data from persistence layer
/// - Selecting which features to render
/// - Composing features into a complete page layout
/// - Managing page-level metadata (title, meta tags)
///
/// # Current Pages
///
/// - **homepage**: Dynamic block-based homepage
/// - **admin**: Administrative interface for content management
///
/// # Relationship to Features
///
/// - **Pages** compose features into layouts (or provide admin interfaces)
/// - **Features** provide reusable components
/// - **Core** provides shared types and operations

pub mod admin;
pub mod homepage;

// Re-export route handlers for convenience
pub use homepage::homepage;
