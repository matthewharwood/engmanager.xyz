/// Eng Manager Website - Feature-based Architecture
///
/// This application demonstrates a production-quality feature-based architecture
/// for Axum + Maud web applications. Key principles:
///
/// - **Feature-based organization**: Code organized by feature, not layer
/// - **Separation of concerns**: Templates, styles, and scripts in separate files
/// - **Type-safe blocks**: Content composition using enum variants
/// - **Clean module boundaries**: Core, features, and pages are independent
///
/// # Architecture
///
/// ```
/// src/
/// ├── core/           # Shared types and operations
/// │   ├── block.rs    # Block enum and props
/// │   ├── persistence.rs # JSON file operations
/// │   └── render.rs   # Render trait
/// ├── features/       # Feature modules (vertical slices)
/// │   ├── header/     # Header component
/// │   ├── hero/       # Hero component
/// │   └── admin/      # Admin interface
/// ├── pages/          # Route handlers
/// │   └── homepage.rs # Homepage composition
/// └── main.rs         # App setup, router, server
/// ```
///
/// # Skills Applied
///
/// - **axum-web-framework**: Router setup, asset serving, state management
/// - **maud-axum-integration**: IntoResponse, templates, layouts
/// - **maud-components-patterns**: Render trait, component composition
/// - **rust-core-patterns**: Type-safe domain modeling with enums
use axum::{routing::get, routing::post, Router};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;


// Module declarations
mod core;
mod features;
mod pages;

// Server configuration constants
const PORT_ENV_VAR: &str = "PORT";
const DEFAULT_PORT: u16 = 3000;
const PRODUCTION_HOST: [u8; 4] = [0, 0, 0, 0]; // 0.0.0.0 - accept external connections
const DEV_HOST: [u8; 4] = [127, 0, 0, 1]; // 127.0.0.1 - localhost only

// Asset serving paths
const ASSETS_DIR: &str = "website/assets";
const FEATURES_DIR: &str = "website/src/features";

#[tokio::main]
async fn main() {
    // Build application with routes
    // Following axum-web-framework patterns for router composition
    let app = Router::new()
        // Public pages
        .route("/", get(pages::homepage))
        .route("/health", get(|| async { "OK" }))
        // Admin pages (route handlers in pages::admin)
        .route("/admin", get(pages::admin::admin_index))
        .route("/admin/route/", get(pages::admin::admin_route_index))
        .route(
            "/admin/route/{name}/",
            get(pages::admin::admin_route_homepage),
        )
        // Admin features (component story system)
        .route("/admin/features/", get(pages::admin::features_index))
        .route("/admin/features/{name}/", get(pages::admin::feature_story))
        // Admin API endpoints
        .route("/admin/api/homepage", post(pages::admin::update_homepage))
        .route("/admin/api/{route_name}", post(pages::admin::update_route))
        .nest_service("/assets", ServeDir::new(ASSETS_DIR))
        .nest_service("/features", ServeDir::new(FEATURES_DIR));

    // Get port from environment (Render.io sets PORT) or use default for dev
    let port = std::env::var(PORT_ENV_VAR)
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT);

    // Bind to 0.0.0.0 in production (when PORT env var is set)
    // Bind to 127.0.0.1 in dev (local only)
    let host = if std::env::var(PORT_ENV_VAR).is_ok() {
        PRODUCTION_HOST
    } else {
        DEV_HOST
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
