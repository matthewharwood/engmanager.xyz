use axum::{
    response::Html,
    routing::get,
    Router,
};
use maud::html;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

async fn homepage() -> Html<String> {
    let markup = html! {
        html {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                title { "Hello world" }
                link rel="stylesheet" href="/assets/styles.css";
            }
            body {
                div class="container" {
                    h1 { "hello world" }
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
