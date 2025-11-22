/// Block-based content system using type-safe enum variants
///
/// This module defines the Block enum which represents all possible content blocks
/// that can appear on the homepage. Each variant carries its own strongly-typed
/// props structure, ensuring type safety at compile time.
///
/// # Architecture
///
/// Following rust-core-patterns for domain modeling:
/// - **Type safety**: Each block type has its own props struct
/// - **Exhaustive matching**: Adding new blocks requires updating all match expressions
/// - **Serialization**: Uses serde's "type" tagging for JSON persistence
/// - **Feature ownership**: Each feature owns its schema (imported from features/*/schema.rs)
///
/// # JSON Format
///
/// Blocks are serialized with a discriminant "type" field:
///
/// ```json
/// {
///   "type": "Header",
///   "props": {
///     "headline": "...",
///     "button": { ... }
///   }
/// }
/// ```
///
/// # Schema Imports
///
/// Props are defined in feature-specific schema modules:
/// - `ButtonProps`: features/button/schema.rs
/// - `HeaderProps`: features/header/schema.rs
/// - `HeroProps`: features/hero/schema.rs
///
/// This enables each feature to own its data shape while allowing core
/// to orchestrate them into the Block enum.
use serde::{Deserialize, Serialize};

// Import schemas from feature modules
// These are pub use to allow re-exporting from core/mod.rs
pub use crate::features::header::HeaderProps;
pub use crate::features::hero::HeroProps;

// ============================================================================
// Block Enum (Type-Safe Component Variants)
// ============================================================================

/// Each variant represents a component with its unique data shape
/// Uses serde's "type" tagging for JSON serialization
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "props")]
pub enum Block {
    Header(HeaderProps),
    Hero(HeroProps),
}

// ============================================================================
// Block Rendering Dispatch
// ============================================================================

/// Render a single block by dispatching to the appropriate feature template
///
/// This is the core dispatch function that maps Block enum variants to their
/// corresponding rendering implementations. It centralizes the block → component
/// mapping logic so that any page can render blocks consistently.
///
/// # Architecture
///
/// Following maud-components-patterns, this function:
/// - **Type safety**: Exhaustive match ensures all Block variants are handled
/// - **Feature dispatch**: Calls feature-specific render functions
/// - **Centralized**: Single source of truth for block rendering
///
/// # Adding New Block Types
///
/// When adding a new block variant:
///
/// 1. Add variant to Block enum above
/// 2. Import the feature's render function
/// 3. Add match arm here to dispatch to the render function
///
/// # Example
///
/// ```rust
/// use crate::core::{Block, render_block};
/// use crate::features::header::HeaderProps;
/// use crate::features::button::ButtonProps;
///
/// let block = Block::Header(HeaderProps {
///     headline: "Welcome".to_string(),
///     button: ButtonProps {
///         href: "/start".to_string(),
///         text: "Get Started".to_string(),
///         aria_label: "Navigate to start".to_string(),
///     },
/// });
///
/// let markup = render_block(&block);
/// ```
pub fn render_block(block: &Block) -> maud::Markup {
    match block {
        Block::Header(props) => crate::features::header::render_header(props),
        Block::Hero(props) => crate::features::hero::render_hero(props),
    }
}
