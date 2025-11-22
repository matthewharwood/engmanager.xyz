/// Homepage route handler
///
/// This module contains the logic for rendering the homepage, which is composed
/// of dynamic blocks loaded from JSON and rendered using feature components.
///
/// # Architecture
///
/// Following axum-web-framework and maud-axum-integration patterns:
/// - **Handler**: Async function that loads data and renders HTML
/// - **Response**: Axum's Html wrapper around Maud Markup
/// - **Composition**: Blocks are dispatched to feature-specific templates
///
/// # Block Rendering
///
/// The homepage uses a block-based system where each Block enum variant maps
/// to a feature component. This enables:
/// - Type-safe component selection
/// - Content editors to compose pages without code
/// - Easy addition of new block types
use axum::response::Html;
use maud::html;
use serde::{Deserialize, Serialize};

use crate::core::{BlockWithId, block::Block, load_homepage_blocks, render_block};
use crate::features::button::ButtonProps;
use crate::features::header::HeaderProps;
use crate::features::hero::HeroProps;

// ============================================================================
// Homepage Data Structure
// ============================================================================

/// Top-level data structure for homepage content
///
/// This structure is persisted to data/content/homepage.json and loaded on each request.
/// It contains an ordered list of blocks with IDs that are rendered in sequence.
///
/// # Architecture
///
/// Following the principle that pages own page-specific data structures while
/// core owns the building blocks (Block enum). HomepageData lives here because:
/// - It's specific to the homepage, not a core domain concern
/// - Pages layer composes core blocks into page-specific structures
/// - Core remains focused on the block primitives
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomepageData {
    pub blocks: Vec<BlockWithId>,
}

impl HomepageData {
    /// Create a new HomepageData with the given blocks
    pub fn new(blocks: Vec<BlockWithId>) -> Self {
        Self { blocks }
    }

    /// Get default homepage blocks when no persisted data exists
    ///
    /// These defaults provide a working homepage on first launch and serve
    /// as an example of the content structure for editors.
    pub fn default_blocks() -> Vec<BlockWithId> {
        vec![
            BlockWithId {
                id: "550e8400-e29b-41d4-a716-446655440001".to_string(),
                block: Block::Header(HeaderProps {
                    headline: "Eng Manager".to_string(),
                    button: ButtonProps {
                        href: "/contact".to_string(),
                        text: "Get in touch".to_string(),
                        aria_label: "Contact us to discuss your engineering needs".to_string(),
                    },
                }),
            },
            BlockWithId {
                id: "550e8400-e29b-41d4-a716-446655440002".to_string(),
                block: Block::Hero(HeroProps {
                    headline: "Building world-class engineering teams".to_string(),
                    subheadline: "Leadership through example, expertise, and empathy".to_string(),
                }),
            },
        ]
    }
}

/// GET / - Homepage route handler
///
/// Loads blocks from data/homepage.json and renders them in sequence.
/// Each block is rendered using its corresponding feature component.
///
/// # Layout Structure
///
/// ```html
/// <html>
///   <head>
///     <link rel="stylesheet" href="/assets/styles.css">
///     <link rel="stylesheet" href="/features/header/styles.css">
///     <link rel="stylesheet" href="/features/hero/styles.css">
///   </head>
///   <body>
///     <!-- Blocks rendered here -->
///   </body>
/// </html>
/// ```
///
/// # Asset Loading
///
/// Component-specific styles are loaded in the <head>. This ensures:
/// - Styles are available before render (no FOUC)
/// - Browser can cache per-component stylesheets
/// - Clear dependency between components and their styles
pub async fn homepage() -> Html<String> {
    let blocks = load_homepage_blocks();

    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Eng Manager" }

                // Global styles (Utopia fluid typography, resets)
                link rel="stylesheet" href="/assets/styles.css";

                // Feature-specific styles
                link rel="stylesheet" href="/features/header/styles.css";
                link rel="stylesheet" href="/features/hero/styles.css";
            }
            body {
                // Render blocks in sequence
                @for block in &blocks {
                    (render_block(block))
                }
            }
        }
    };

    Html(markup.into_string())
}
