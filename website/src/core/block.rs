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
use serde::{Deserialize, Serialize};

// ============================================================================
// Component Props (Data Shapes)
// ============================================================================

/// Button props - reusable across components
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ButtonProps {
    pub href: String,
    pub text: String,
    pub aria_label: String,
}

/// Header component props
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderProps {
    pub headline: String,
    pub button: ButtonProps,
}

/// Hero component props
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeroProps {
    pub headline: String,
    pub subheadline: String,
}

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
