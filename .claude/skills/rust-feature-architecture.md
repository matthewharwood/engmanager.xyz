# Feature-Based Architecture for Axum + Maud Applications

## Overview

This skill documents a production-quality feature-based architecture pattern for Rust web applications using Axum and Maud. Unlike traditional layered architectures (MVC, etc.), this pattern organizes code by **feature** (vertical slices) rather than by **technical layer** (horizontal slices).

## Philosophy

### Why Feature-Based Architecture?

**Traditional Layered Architecture:**
```
src/
├── models/          # All data models
├── views/           # All templates
├── controllers/     # All handlers
└── services/        # All business logic
```

**Problems:**
- Related code is scattered across directories
- Adding a feature requires touching multiple layers
- Difficult to understand feature boundaries
- Hard to delete or isolate features

**Feature-Based Architecture:**
```
src/
├── core/            # Shared types and operations
├── features/        # Feature modules (vertical slices)
│   ├── header/      # Everything for header feature
│   ├── hero/        # Everything for hero feature
│   └── admin/       # Everything for admin feature
└── pages/           # Route handlers that compose features
```

**Benefits:**
- **Cohesion**: Related code lives together
- **Modularity**: Features can be added/removed independently
- **Scalability**: Clear boundaries as the codebase grows
- **Separation of concerns**: Each feature owns its presentation layer
- **Easy testing**: Test features in isolation

## Architecture Layers

### 1. Core Layer (`src/core/`)

The core layer defines contracts and shared abstractions that features implement.

**Purpose:**
- Define domain types (Block enum, props structs)
- Provide shared operations (persistence, rendering)
- Establish patterns (Render trait)

**Modules:**

```rust
// core/block.rs - Type-safe content blocks
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "props")]
pub enum Block {
    Header(HeaderProps),
    Hero(HeroProps),
}

// core/persistence.rs - JSON file operations
pub fn load_homepage_blocks() -> Vec<Block> { ... }
pub fn save_homepage_blocks(blocks: &[Block]) -> Result<...> { ... }

// core/render.rs - Rendering trait
pub trait Render {
    fn render(&self) -> Markup;
}
```

**Key Principles:**
- Core never depends on features (unidirectional dependency)
- Core defines interfaces, features provide implementations
- Core types are serializable for persistence

### 2. Features Layer (`src/features/`)

Each feature is a self-contained vertical slice with its own template, styles, and scripts.

**Feature Structure:**

```
features/
├── header/
│   ├── mod.rs           # Public API, re-exports
│   ├── template.rs      # Maud rendering logic
│   ├── styles.css       # Component-scoped styles
│   └── script.js        # Optional client-side behavior
├── hero/
│   ├── mod.rs
│   ├── template.rs
│   └── styles.css
└── admin/
    ├── mod.rs           # Admin routes and handlers
    ├── editor/
    │   ├── mod.rs
    │   ├── template.rs
    │   ├── styles.css
    │   └── script.js
    └── api/
        └── mod.rs       # API endpoints
```

**Feature Module Pattern:**

```rust
// features/header/mod.rs
pub mod template;
pub use template::header as render_header;

// features/header/template.rs
use maud::{html, Markup};
use crate::core::{HeaderProps, Render};

pub fn header(props: &HeaderProps) -> Markup {
    html! {
        header class="header-block" {
            div class="container" {
                h1 { (props.headline) }
                // ... component markup
            }
        }
    }
}

impl Render for HeaderProps {
    fn render(&self) -> Markup {
        header(self)
    }
}
```

**Asset Organization:**

```css
/* features/header/styles.css */
.header-block {
    /* Component-scoped styles */
}
```

```javascript
// features/header/script.js (optional)
// Web component or progressive enhancement
class HeaderComponent extends HTMLElement {
    connectedCallback() {
        // Component behavior
    }
}
customElements.define('header-block', HeaderComponent);
```

### 3. Pages Layer (`src/pages/`)

Pages compose features into complete layouts and handle routing.

**Purpose:**
- Load data from persistence
- Select which features to render
- Compose features into page layouts
- Manage page-level metadata (title, meta tags)

**Example:**

```rust
// pages/homepage.rs
use axum::response::Html;
use maud::{html, Markup};
use crate::core::{load_homepage_blocks, Block};
use crate::features::{header::render_header, hero::render_hero};

fn render_block(block: &Block) -> Markup {
    match block {
        Block::Header(props) => render_header(props),
        Block::Hero(props) => render_hero(props),
    }
}

pub async fn homepage() -> Html<String> {
    let blocks = load_homepage_blocks();

    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                title { "My Site" }
                // Global styles
                link rel="stylesheet" href="/assets/styles.css";
                // Feature-specific styles
                link rel="stylesheet" href="/features/header/styles.css";
                link rel="stylesheet" href="/features/hero/styles.css";
            }
            body {
                @for block in &blocks {
                    (render_block(block))
                }
            }
        }
    };

    Html(markup.into_string())
}
```

## Asset Serving Strategy

### Router Configuration

```rust
// main.rs
let app = Router::new()
    .route("/", get(pages::homepage))
    // Static assets
    .nest_service("/assets", ServeDir::new("assets"))        // Global
    .nest_service("/features", ServeDir::new("src/features")); // Per-component
```

### Asset Loading Pattern

**In Page Templates:**
```rust
html! {
    head {
        // Global styles (Utopia fluid typography, resets)
        link rel="stylesheet" href="/assets/styles.css";

        // Feature-specific styles (loaded for all blocks on page)
        link rel="stylesheet" href="/features/header/styles.css";
        link rel="stylesheet" href="/features/hero/styles.css";
    }
}
```

**In Feature Templates:**
```rust
// Features reference their CSS via class names, not inline styles
html! {
    header class="header-block" {
        // The .header-block styles are in features/header/styles.css
    }
}
```

### Why External CSS/JS?

1. **Separation of concerns**: Templates focus on structure, styles on presentation
2. **Caching**: Browsers cache CSS/JS files separately from HTML
3. **Maintainability**: Developers can edit styles without touching Rust code
4. **Tooling**: CSS/JS files work with linters, formatters, and editors
5. **Progressive enhancement**: JavaScript is optional and loads separately

## Block-Based Content System

### Type-Safe Block Enum

The Block enum provides type-safe content composition:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "props")]
pub enum Block {
    Header(HeaderProps),
    Hero(HeroProps),
    // Add new block types here
}
```

**Benefits:**
- **Compile-time safety**: Can't render invalid blocks
- **Exhaustive matching**: Compiler ensures all blocks are handled
- **Serialization**: Blocks persist to JSON with type discrimination

**JSON Format:**

```json
{
  "blocks": [
    {
      "type": "Header",
      "props": {
        "headline": "Welcome",
        "button": {
          "href": "/contact",
          "text": "Get Started",
          "aria_label": "Contact us"
        }
      }
    },
    {
      "type": "Hero",
      "props": {
        "headline": "Build Amazing Things",
        "subheadline": "With our platform"
      }
    }
  ]
}
```

## Adding a New Feature

### Step-by-Step Guide

**1. Add Props to Core (if block-based)**

```rust
// core/block.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallToActionProps {
    pub title: String,
    pub description: String,
    pub button_text: String,
    pub button_href: String,
}

// Add variant to Block enum
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "props")]
pub enum Block {
    Header(HeaderProps),
    Hero(HeroProps),
    CallToAction(CallToActionProps), // New variant
}
```

**2. Create Feature Directory**

```bash
mkdir -p src/features/call_to_action
```

**3. Create Template Module**

```rust
// features/call_to_action/template.rs
use maud::{html, Markup};
use crate::core::{CallToActionProps, Render};

pub fn call_to_action(props: &CallToActionProps) -> Markup {
    html! {
        section class="cta-block" {
            div class="container" {
                h2 { (props.title) }
                p { (props.description) }
                a href=(props.button_href) class="cta-button" {
                    (props.button_text)
                }
            }
        }
    }
}

impl Render for CallToActionProps {
    fn render(&self) -> Markup {
        call_to_action(self)
    }
}
```

**4. Create Module Entry Point**

```rust
// features/call_to_action/mod.rs
pub mod template;
pub use template::call_to_action as render_cta;
```

**5. Create Component Styles**

```css
/* features/call_to_action/styles.css */
.cta-block {
    padding: 4rem 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-align: center;
}

.cta-block .container {
    max-width: 800px;
    margin: 0 auto;
}

.cta-block h2 {
    font-size: var(--step-4);
    margin-bottom: 1rem;
}

.cta-block .cta-button {
    display: inline-block;
    padding: 1rem 2rem;
    background: white;
    color: #667eea;
    text-decoration: none;
    border-radius: 4px;
    font-weight: 600;
    margin-top: 2rem;
}
```

**6. Add to Features Module**

```rust
// features/mod.rs
pub mod header;
pub mod hero;
pub mod call_to_action; // Add new feature
```

**7. Update Page Render Dispatcher**

```rust
// pages/homepage.rs
use crate::features::call_to_action::render_cta;

fn render_block(block: &Block) -> Markup {
    match block {
        Block::Header(props) => render_header(props),
        Block::Hero(props) => render_hero(props),
        Block::CallToAction(props) => render_cta(props), // Add match arm
    }
}

pub async fn homepage() -> Html<String> {
    // ...
    html! {
        head {
            // Add stylesheet
            link rel="stylesheet" href="/features/call_to_action/styles.css";
        }
    }
}
```

**8. Re-export from Core**

```rust
// core/mod.rs
pub use block::{Block, HeaderProps, HeroProps, CallToActionProps, HomepageData};
```

### Testing the New Feature

```bash
# Check compilation
cargo check

# Run the server
cargo run

# Test JSON with new block type
curl -X POST http://localhost:3000/admin/api/homepage \
  -H "Content-Type: application/json" \
  -d '{
    "blocks": [
      {
        "type": "CallToAction",
        "props": {
          "title": "Ready to Get Started?",
          "description": "Join thousands of teams building better software",
          "button_text": "Start Free Trial",
          "button_href": "/signup"
        }
      }
    ]
  }'
```

## Admin Interface Pattern

### Structure

```
features/admin/
├── mod.rs           # Entry point, navigation routes
├── editor/
│   ├── mod.rs       # Editor route handler
│   ├── template.rs  # Dual-view UI (list + JSON)
│   ├── styles.css   # Editor UI styles
│   └── script.js    # Interactive behavior
└── api/
    └── mod.rs       # API endpoints for CRUD operations
```

### Dual-View Editor

The admin editor provides two synchronized views:

**List View:**
- Visual representation of blocks
- Add/delete buttons
- JSON preview for each block

**JSON View:**
- Raw JSON editor
- Direct manipulation of data structure
- Validation on save

**JavaScript Synchronization:**

```javascript
// Sync list changes to JSON textarea
function syncListToJson() {
    jsonEditor.value = JSON.stringify(blocksData, null, 2);
}

// Sync JSON textarea to list view
function syncJsonToList() {
    try {
        blocksData = JSON.parse(jsonEditor.value);
        renderBlockList();
    } catch (err) {
        showMessage('Invalid JSON', 'error');
    }
}
```

### Admin Routes

```rust
// features/admin/mod.rs
pub async fn admin_index() -> Html<String> { ... }
pub async fn admin_route_index() -> Html<String> { ... }

// features/admin/editor/mod.rs
pub async fn admin_route_homepage() -> Html<String> {
    let blocks = load_homepage_blocks();
    let data = HomepageData::new(blocks);
    let markup = template::render_editor(&data);
    Html(markup.into_string())
}

// features/admin/api/mod.rs
pub async fn update_homepage(Json(data): Json<HomepageData>) -> Result<&'static str, String> {
    match save_homepage_blocks(&data.blocks) {
        Ok(_) => Ok("Homepage updated successfully"),
        Err(e) => Err(format!("Failed to save: {}", e)),
    }
}
```

## Production Considerations

### 1. Error Handling

```rust
// Use proper error types from rust-error-handling skill
#[derive(Debug, thiserror::Error)]
pub enum FeatureError {
    #[error("block not found: {id}")]
    NotFound { id: String },
    #[error("invalid props: {0}")]
    InvalidProps(String),
}

impl IntoResponse for FeatureError {
    fn into_response(self) -> Response {
        // Map to appropriate HTTP status codes
    }
}
```

### 2. Observability

```rust
// Add tracing to feature handlers
#[instrument(skip(db), fields(block_type = %block.type_name()))]
async fn render_feature(block: &Block) -> Result<Markup, FeatureError> {
    // Structured logging for debugging
}
```

### 3. Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_render() {
        let props = HeaderProps {
            headline: "Test".to_string(),
            button: ButtonProps { /* ... */ },
        };
        let markup = render_header(&props);
        assert!(markup.into_string().contains("Test"));
    }

    #[test]
    fn test_block_serialization() {
        let block = Block::Header(/* ... */);
        let json = serde_json::to_string(&block).unwrap();
        let parsed: Block = serde_json::from_str(&json).unwrap();
        // Round-trip test
    }
}
```

### 4. Asset Bundling (Production)

For production, consider bundling assets:

```bash
# Build process could copy/bundle assets
mkdir -p dist/assets
cp -r src/features/*/styles.css dist/assets/
cp -r src/features/*/script.js dist/assets/
```

Or use a build tool to minify and bundle.

## Migration from Layered Architecture

### Before (Layered):

```
src/
├── main.rs          # 500+ lines
├── templates.rs     # All Maud templates
├── models.rs        # All data types
└── handlers.rs      # All route handlers
```

### After (Feature-Based):

```
src/
├── core/            # Shared abstractions (100 lines)
├── features/        # Feature modules (150 lines each)
│   ├── header/
│   ├── hero/
│   └── admin/
├── pages/           # Page composers (50 lines each)
└── main.rs          # Router setup (100 lines)
```

### Migration Steps:

1. **Extract core types** → Move to `core/block.rs`
2. **Extract persistence** → Move to `core/persistence.rs`
3. **Define Render trait** → Create `core/render.rs`
4. **Migrate first feature** → Create `features/header/`
5. **Extract CSS** → Move inline styles to `features/header/styles.css`
6. **Update imports** → Fix all references
7. **Test feature** → Verify rendering works
8. **Repeat** for each feature
9. **Clean up** → Remove old monolithic files

## Best Practices

### DO:
- Keep features independent (no cross-feature imports)
- Use the core layer for shared types and operations
- Extract CSS and JavaScript to separate files
- Implement Render trait for polymorphic rendering
- Add comprehensive tests for each feature
- Document feature APIs in module docstrings
- Use descriptive class names scoped to the feature

### DON'T:
- Import one feature from another (use core for sharing)
- Put business logic in templates (templates are pure functions)
- Use inline styles or scripts (defeats separation of concerns)
- Create "god features" (break into submodules like admin/editor)
- Skip the Render trait (it enables composition)
- Mix feature concerns (header shouldn't know about hero)

## Related Skills

- **axum-web-framework**: Router setup, asset serving, middleware
- **maud-components-patterns**: Render trait, component composition
- **maud-axum-integration**: IntoResponse, layouts, error pages
- **rust-core-patterns**: Type-safe domain modeling, newtypes
- **rust-error-handling**: Error types for features
- **rust-observability**: Tracing feature operations

## Summary

Feature-based architecture organizes code by **what it does** (features) rather than **how it does it** (layers). This creates:

- **Clear boundaries** between features
- **Easy navigation** (all feature code in one place)
- **Independent development** (teams can own features)
- **Simple deletion** (remove a feature = delete one directory)
- **Scalable growth** (linear complexity with feature count)

This pattern is ideal for:
- Web applications with distinct features
- CMS and admin interfaces
- Multi-tenant SaaS applications
- Any system where features evolve independently

Apply this pattern when you need modularity, testability, and long-term maintainability in your Rust web applications.
