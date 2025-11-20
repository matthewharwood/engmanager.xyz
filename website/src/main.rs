use axum::{response::Html, routing::{get, post}, Router};
use maud::{html, Markup};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

mod admin;

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
// Data Persistence
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomepageData {
    pub blocks: Vec<Block>,
}

/// Load homepage blocks from JSON file
pub fn load_homepage_blocks() -> Vec<Block> {
    match std::fs::read_to_string("data/homepage.json") {
        Ok(contents) => match serde_json::from_str::<HomepageData>(&contents) {
            Ok(data) => data.blocks,
            Err(e) => {
                eprintln!("Failed to parse homepage.json: {}", e);
                default_homepage_blocks()
            }
        },
        Err(e) => {
            eprintln!("Failed to read homepage.json: {}", e);
            default_homepage_blocks()
        }
    }
}

/// Save homepage blocks to JSON file
pub fn save_homepage_blocks(blocks: &[Block]) -> Result<(), Box<dyn std::error::Error>> {
    let data = HomepageData {
        blocks: blocks.to_vec(),
    };
    let json = serde_json::to_string_pretty(&data)?;
    std::fs::write("data/homepage.json", json)?;
    Ok(())
}

/// Default blocks if JSON file doesn't exist or is invalid
fn default_homepage_blocks() -> Vec<Block> {
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

// ============================================================================
// Page Block Definitions
// ============================================================================

/// Loads homepage blocks from data/homepage.json
/// Falls back to default blocks if file doesn't exist or is invalid
fn homepage_blocks() -> Vec<Block> {
    load_homepage_blocks()
}

// ============================================================================
// Component Templates
// ============================================================================

/// Header component - receives HeaderProps
fn header(props: &HeaderProps) -> Markup {
    html! {
        header class="header-block" {
            div class="container" {
                h1 { (props.headline) }
                a
                    href=(props.button.href)
                    aria-label=(props.button.aria_label)
                    class="cta-button"
                {
                    (props.button.text)
                }
            }
        }
    }
}

/// Hero component - receives HeroProps
fn hero(props: &HeroProps) -> Markup {
    html! {
        section class="hero-block" {
            div class="container" {
                h2 { (props.headline) }
                p class="subheadline" { (props.subheadline) }
            }
        }
    }
}

// ============================================================================
// Component Mapping
// ============================================================================

/// Maps Block enum variants to their template functions
/// Each variant carries its own unique props shape
fn render_block(block: &Block) -> Markup {
    match block {
        Block::Header(props) => header(props),
        Block::Hero(props) => hero(props),
    }
}

// ============================================================================
// Page Templates
// ============================================================================

async fn homepage() -> Html<String> {
    let blocks = homepage_blocks();

    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Eng Manager" }
                link rel="stylesheet" href="/assets/styles.css";
            }
            body {
                // Loop over blocks and render each with its unique props
                @for block in &blocks {
                    (render_block(block))
                }
            }
        }
    };
    Html(markup.into_string())
}

#[tokio::main]
async fn main() {
    // Build application with routes
    let app = Router::new()
        .route("/", get(homepage))
        .route("/health", get(|| async { "OK" }))
        // Admin routes
        .route("/admin", get(admin::admin_index))
        .route("/admin/route/", get(admin::admin_route_index))
        .route("/admin/route/homepage/", get(admin::admin_route_homepage))
        .route("/admin/api/homepage", post(admin::update_homepage))
        .nest_service("/assets", ServeDir::new("website/assets"));

    // Get port from environment (Render.io sets PORT) or use 3000 for dev
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3000);

    // Bind to 0.0.0.0 in production (when PORT env var is set)
    // Bind to 127.0.0.1 in dev (local only)
    let host = if std::env::var("PORT").is_ok() {
        [0, 0, 0, 0] // Production: accept external connections
    } else {
        [127, 0, 0, 1] // Dev: localhost only
    };

    let addr = SocketAddr::from((host, port));
    println!("Starting server on {}", addr);

    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind to {}: {}", addr, e);
            std::process::exit(1);
        }
    };

    if let Err(e) = axum::serve(listener, app.into_make_service()).await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}
