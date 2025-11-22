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
/// # JSON Format (BlockWithId)
///
/// Blocks are wrapped with an ID for identification:
///
/// ```json
/// {
///   "id": "550e8400-e29b-41d4-a716-446655440000",
///   "type": "Header",
///   "props": {
///     "headline": "...",
///     "button": { ... }
///   }
/// }
/// ```
///
/// The `BlockWithId` wrapper preserves the original Block enum's serde structure
/// while adding a unique identifier for each block instance.
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
// Block With ID (Wrapper for Persistence)
// ============================================================================

/// Wrapper that adds a unique ID to each block instance
///
/// This structure is used for persistence and API responses. The ID allows
/// for stable references to specific blocks, enabling:
/// - Edit operations on specific blocks
/// - Reordering blocks while maintaining identity
/// - Tracking changes to individual blocks
///
/// # JSON Format
///
/// ```json
/// {
///   "id": "550e8400-e29b-41d4-a716-446655440000",
///   "type": "Header",
///   "props": { ... }
/// }
/// ```
///
/// The `#[serde(flatten)]` attribute on `block` merges the Block's fields
/// (type, props) into the same level as the id field, creating the desired
/// JSON structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockWithId {
    /// Unique identifier for this block instance
    /// Should be a UUID v4 for global uniqueness
    pub id: String,

    /// The block content and type
    #[serde(flatten)]
    pub block: Block,
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
/// use crate::core::{BlockWithId, render_block};
/// use crate::features::header::HeaderProps;
/// use crate::features::button::ButtonProps;
///
/// let block_with_id = BlockWithId {
///     id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
///     block: Block::Header(HeaderProps {
///         headline: "Welcome".to_string(),
///         button: ButtonProps {
///             href: "/start".to_string(),
///             text: "Get Started".to_string(),
///             aria_label: "Navigate to start".to_string(),
///         },
///     }),
/// };
///
/// let markup = render_block(&block_with_id);
/// ```
pub fn render_block(block_with_id: &BlockWithId) -> maud::Markup {
    match &block_with_id.block {
        Block::Header(props) => crate::features::header::render_header(props),
        Block::Hero(props) => crate::features::hero::render_hero(props),
    }
}
