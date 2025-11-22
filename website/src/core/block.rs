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
pub use crate::features::button::ButtonProps;
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
// Homepage Data Structure
// ============================================================================

/// Top-level data structure for homepage content
///
/// This structure is persisted to data/homepage.json and loaded on each request.
/// It contains an ordered list of blocks that are rendered in sequence.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomepageData {
    pub blocks: Vec<Block>,
}

impl HomepageData {
    /// Create a new HomepageData with the given blocks
    pub fn new(blocks: Vec<Block>) -> Self {
        Self { blocks }
    }

    /// Get default homepage blocks when no persisted data exists
    pub fn default_blocks() -> Vec<Block> {
        vec![
            Block::Header(HeaderProps {
                headline: "Eng Manager".to_string(),
                button: ButtonProps {
                    href: "/contact".to_string(),
                    text: "Get in touch".to_string(),
                    aria_label: "Contact us to discuss your engineering needs".to_string(),
                },
            }),
            Block::Hero(HeroProps {
                headline: "Building world-class engineering teams".to_string(),
                subheadline: "Leadership through example, expertise, and empathy".to_string(),
            }),
        ]
    }
}
