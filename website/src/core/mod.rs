/// Core abstractions for the feature-based architecture
///
/// This module provides the foundational types and traits used across all features:
///
/// - **block**: Type-safe content block system with enum variants
/// - **persistence**: JSON file operations for homepage data
/// - **render**: Trait for components that render to Maud Markup
///
/// # Philosophy
///
/// The core module defines contracts that features implement. This creates a
/// clear separation between:
///
/// 1. **Domain types** (Block, HomepageData) - What the data is
/// 2. **Operations** (load, save) - What we do with the data
/// 3. **Presentation** (Render trait) - How we display the data
///
/// # Schema Re-exports
///
/// While schemas are defined in feature modules, core re-exports them for
/// convenience. This allows consumers to import commonly-used types from core
/// without needing to know which feature owns them.
///
/// Features depend on core, but core never depends on features (it imports
/// feature schemas only to re-export them in the Block enum).
pub mod block;
pub mod persistence;
pub mod render;

// Re-export commonly used types for convenience
// Props are re-exported from block module (which imports them from features)
pub use block::{render_block, BlockWithId};
pub use persistence::{load_blocks, load_homepage_blocks, load_routes, save_blocks, Route};
pub use render::Render;
