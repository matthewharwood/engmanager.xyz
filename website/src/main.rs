use axum::{response::Html, routing::get, Router};
use maud::{html, Markup};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

// ============================================================================
// Page Block Definitions
// ============================================================================

/// Defines which blocks appear on the homepage and their data/props
fn homepage_blocks() -> Vec<(&'static str, &'static str)> {
    vec![
        ("header", "Eng Manager"),
        ("hero", "Building world-class engineering teams"),
    ]
}

// ============================================================================
// Component Templates
// ============================================================================

/// Header component with water text effect
fn header(content: &str) -> Markup {
    html! {
        header class="header-block" {
            div class="container" {
                h1 { (content) }
            }
        }
    }
}

/// Hero section component
fn hero(content: &str) -> Markup {
    html! {
        section class="hero-block" {
            div class="container" {
                p { (content) }
            }
        }
    }
}

// ============================================================================
// Component Mapping
// ============================================================================

/// Maps component names to their template functions
/// This is the "ComponentMap" - it routes block names to the correct template
fn render_component(name: &str, content: &str) -> Markup {
    match name {
        "header" => header(content),
        "hero" => hero(content),
        _ => html! {
            div class="unknown-component" {
                "⚠️ Unknown component: " (name)
            }
        },
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
                // Loop over blocks and render each component
                @for (name, content) in &blocks {
                    (render_component(name, content))
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
