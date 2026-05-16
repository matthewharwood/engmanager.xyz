use std::env::var;
use std::net::SocketAddr;

use axum::Router;
use axum::response::Html;
use axum::routing::get;
use eng_domain::{Component, HtmlFragment};
use eng_markup::view;
use tokio::net::TcpListener;

const PORT_ENV_VAR: &str = "PORT";
const DEFAULT_PORT: u16 = 3000;
const PRODUCTION_HOST: [u8; 4] = [0, 0, 0, 0];
const DEV_HOST: [u8; 4] = [127, 0, 0, 1];

struct HelloWorld;
struct HelloWorldProps;

impl Component for HelloWorld {
    type Props = HelloWorldProps;

    fn render(_: Self::Props, _: HtmlFragment) -> HtmlFragment {
        view! { <h1>"hello-world"</h1> }
    }
}

async fn index() -> Html<String> {
    Html(view! { <HelloWorld /> }.into_string())
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/health", get(|| async { "OK" }));

    let addr = resolve_server_address();
    println!("Starting server on http://{addr}");

    let listener = TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("Failed to bind to {addr}: {e}"));

    axum::serve(listener, app)
        .await
        .unwrap_or_else(|e| panic!("Server error: {e}"));
}

fn resolve_server_address() -> SocketAddr {
    let port_env = var(PORT_ENV_VAR).ok();
    let port = port_env
        .as_deref()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT);
    let host = if port_env.is_some() {
        PRODUCTION_HOST
    } else {
        DEV_HOST
    };
    SocketAddr::from((host, port))
}
