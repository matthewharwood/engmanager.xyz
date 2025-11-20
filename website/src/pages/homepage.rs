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
use maud::{html, Markup};

use crate::core::{load_homepage_blocks, Block};
use crate::features::header::render_header;
use crate::features::hero::render_hero;

/// Render a single block by dispatching to the appropriate feature template
///
/// This function matches on the Block enum and calls the corresponding
/// feature's rendering function. When adding new block types:
///
/// 1. Add variant to Block enum in core/block.rs
/// 2. Add match arm here
/// 3. Import the feature's render function
fn render_block(block: &Block) -> Markup {
    match block {
        Block::Header(props) => render_header(props),
        Block::Hero(props) => render_hero(props),
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
