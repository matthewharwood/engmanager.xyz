use axum::{response::Html, routing::get, Router};
use maud::{html, Markup};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

// ============================================================================
// Component Props (Data Shapes)
// ============================================================================

/// Button props - reusable across components
#[derive(Debug, Clone)]
struct ButtonProps {
    href: &'static str,
    text: &'static str,
    aria_label: &'static str,
}

/// Header component props
#[derive(Debug, Clone)]
struct HeaderProps {
    headline: &'static str,
    button: ButtonProps,
}

/// Hero component props
#[derive(Debug, Clone)]
struct HeroProps {
    headline: &'static str,
    subheadline: &'static str,
}

// ============================================================================
// Block Enum (Type-Safe Component Variants)
// ============================================================================

/// Each variant represents a component with its unique data shape
#[derive(Debug, Clone)]
enum Block {
    Header(HeaderProps),
    Hero(HeroProps),
}

// ============================================================================
// Page Block Definitions
// ============================================================================

/// Defines which blocks appear on the homepage with their specific props
fn homepage_blocks() -> Vec<Block> {
    vec![
        Block::Header(HeaderProps {
            headline: "Eng Manager",
            button: ButtonProps {
                href: "/contact",
                text: "Get in touch",
                aria_label: "Contact us to discuss your engineering needs",
            },
        }),
        Block::Hero(HeroProps {
            headline: "Building world-class engineering teams",
            subheadline: "Leadership through example, expertise, and empathy",
        }),
    ]
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
