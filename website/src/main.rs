use axum::{routing::get, routing::post, Router};
use dotenvy::dotenv;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::env::var;
use std::net::SocketAddr;
use std::time::Duration;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

mod core;
mod features;
mod pages;

const PORT_ENV_VAR: &str = "PORT";
const DEFAULT_PORT: u16 = 3000;
const PRODUCTION_HOST: [u8; 4] = [0, 0, 0, 0];
const DEV_HOST: [u8; 4] = [127, 0, 0, 1];

const ASSETS_DIR: &str = "website/assets";
const FEATURES_DIR: &str = "website/src/features";

#[tokio::main]
async fn main() {
    dotenv().ok();

    let pool = create_pool().await.expect("Failed to create database pool");
    // Insert a test route
    sqlx::query("INSERT OR REPLACE INTO routes (path, name) VALUES ('/test', 'Test Route')")
        .execute(&pool)
        .await
        .expect("Failed to insert test route");
    let route: Route = sqlx::query_as(
        "SELECT path, name, created_at, updated_at FROM routes WHERE path = '/test'",
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch route");

    let app = create_router();
    let addr = resolve_server_address();
    println!("Found route: {:?}", route);
    assert_eq!(route.path, "/test");
    assert_eq!(route.name, "Test Route");
    println!("Starting server on http://{}", addr);

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

fn create_router() -> Router {
    Router::new()
        .merge(public_routes())
        .nest("/admin", admin_routes())
        .merge(static_assets())
}

fn public_routes() -> Router {
    Router::new()
        .route("/", get(pages::homepage))
        .route("/health", get(|| async { "OK" }))
}

fn admin_routes() -> Router {
    Router::new()
        .route("/", get(pages::admin::admin_index))
        .route("/route/", get(pages::admin::admin_route_index))
        .route("/route/{name}/", get(pages::admin::admin_route_page))
        .route("/features/", get(pages::admin::features_index))
        .route("/features/{name}/", get(pages::admin::feature_story))
        .route("/api/homepage", post(pages::admin::update_homepage))
        .route("/api/{route_name}", post(pages::admin::update_route))
}

fn static_assets() -> Router {
    Router::new()
        .nest_service("/assets", ServeDir::new(ASSETS_DIR))
        .nest_service("/features", ServeDir::new(FEATURES_DIR))
}

fn resolve_server_address() -> SocketAddr {
    let port = var(PORT_ENV_VAR)
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT);

    let host = if var(PORT_ENV_VAR).is_ok() {
        PRODUCTION_HOST
    } else {
        DEV_HOST
    };

    SocketAddr::from((host, port))
}

async fn create_pool() -> Result<SqlitePool, sqlx::Error> {
    let database_url = var("DATABASE_URL").expect("DATABASE_URL must be set in .env");
    SqlitePoolOptions::new()
        .max_connections(5)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&database_url)
        .await
}

use sqlx::FromRow;

#[derive(Debug, Clone, FromRow)]
pub struct Route {
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}
