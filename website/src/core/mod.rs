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
/// Features depend on core, but core never depends on features.

pub mod block;
pub mod persistence;
pub mod render;

// Re-export commonly used types for convenience
pub use block::{Block, HeaderProps, HeroProps, HomepageData};
pub use persistence::{load_homepage_blocks, save_homepage_blocks};
pub use render::Render;
