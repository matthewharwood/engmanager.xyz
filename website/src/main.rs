//! Composition root: init tracing, load config, build state, build router,
//! serve with graceful shutdown. All real logic lives in the modules below.
//! (Patterns: axum-service-architecture "composition root"; rust-async-runtime
//! and rust-production-reliability "graceful shutdown"; rust-observability
//! "EnvFilter from RUST_LOG".)

use std::fmt::Display;
use std::sync::Arc;

use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

pub mod assets;
pub mod comments;
pub mod components;
pub mod config;
pub mod discord;
pub mod experiences;
pub mod http;
mod pages;
pub mod router;
pub mod search;
mod sitemap;
pub mod state;
mod stripe;

// Crate-root re-exports: pages/*, components/*, and sitemap.rs were written
// against `crate::asset_url` / `crate::AppState` / `crate::is_shop_host`
// (and the embed structs) living in main.rs. Keep those paths compiling
// untouched while the implementations live in their own modules.
pub use assets::{Assets, CssDist, JsDist, asset_url};
pub use config::is_shop_host;
pub use state::AppState;

// Discord invite code for the Auteurs server. Hardcoded because it's the
// only server the site embeds; the refresh task resolves the guild ID
// from this code at startup.
const AUTEURS_INVITE_CODE: &str = "sTzQBrbnBM";

#[tokio::main]
async fn main() {
    init_tracing();

    // Env files load before any env::var read below (the comment store reads
    // COMMENTS_DB_*; Stripe code reads STRIPE_*).
    config::load_env();

    // Subcommand: `website stripe-sync …` upserts the shop catalog into Stripe
    // and exits, instead of starting the server. Kept in-process so it reads
    // the same SHOP_PRODUCTS source of truth.
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("stripe-sync") {
        if let Err(err) = stripe::run(stripe::SyncOptions::from_args(&args)).await {
            eprintln!("stripe-sync failed: {err:#}");
            std::process::exit(1);
        }
        return;
    }

    // Debug-only: panic at startup if any article slice carries duplicate
    // tags. Release builds skip this since `unique_tags` dedups at render
    // time anyway; this is just a faster signal for the author.
    #[cfg(debug_assertions)]
    pages::articles::debug_check_tag_uniqueness();

    // Polls the Discord widget + invite endpoints for the Auteurs server
    // every 60s into an in-memory snapshot. Handlers read the snapshot
    // synchronously with a tokio RwLock — zero I/O on the hot path.
    tokio::spawn(discord::refresh_loop(AUTEURS_INVITE_CODE));

    let comments = Arc::new(
        comments::CommentStore::connect_from_env()
            .await
            .unwrap_or_else(|err| fail_startup("comment store must connect at startup", err)),
    );
    let existing_comments = comments
        .all_visible()
        .await
        .unwrap_or_else(|err| fail_startup("visible comments must load at startup", err));
    let search = Arc::new(
        search::SearchEngine::build_in_memory(pages::articles::ARTICLES, &existing_comments)
            .unwrap_or_else(|err| fail_startup("search index must build at startup", err)),
    );
    // Stripe runtime context for the on-site checkout (reused client + keys).
    // Built from env; absent keys just leave checkout reporting "unavailable".
    let stripe = Arc::new(stripe::Checkout::from_env());
    let state = AppState {
        search,
        comments,
        stripe,
    };

    let app = router::build_router(state);

    let config = config::Config::from_env();
    tracing::debug!(
        port = ?config.port,
        bind = %config.bind,
        shop_dev_hosts = ?config.shop_dev_hosts,
        "resolved runtime configuration"
    );
    let addr = config.bind;

    let listener = if let Some(std_listener) = take_listenfd_listener() {
        std_listener
            .set_nonblocking(true)
            .expect("set listener non-blocking");
        let local = std_listener.local_addr().ok();
        let listener = TcpListener::from_std(std_listener).expect("convert listenfd socket");
        println!(
            "Inherited listener from systemfd ({})",
            local.map(|a| a.to_string()).unwrap_or_else(|| "?".into())
        );
        listener
    } else {
        println!("Starting server on http://{addr}");
        TcpListener::bind(addr)
            .await
            .unwrap_or_else(|err| fail_startup(&format!("failed to bind to {addr}"), err))
    };

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap_or_else(|err| fail_startup("server error", err));
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,tower_http=warn"));
    tracing_subscriber::fmt().with_env_filter(filter).init();
}

// Fail-fast startup path: these dependencies are required before the server
// can serve anything useful. Log through tracing and exit cleanly instead of
// unwinding with a raw panic (same fatal semantics as the old `expect`s).
fn fail_startup(context: &str, err: impl Display) -> ! {
    tracing::error!("{context}: {err:#}");
    std::process::exit(1);
}

// Resolves when the process receives SIGTERM (how Render and most PaaS
// runtimes stop a service) or Ctrl+C, letting axum::serve stop accepting new
// connections and drain in-flight requests before the process exits.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("install Ctrl+C signal handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install SIGTERM signal handler")
            .recv()
            .await;
    };

    // Portable fallback: non-unix targets only get Ctrl+C.
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {}
        () = terminate => {}
    }
}

// Attempts to grab a listener handed down by `systemfd` via LISTEN_FDS. The
// `dev` feature is the only path that links the `listenfd` crate; production
// builds get the `None` stub at compile time, so no listenfd code ships.
#[cfg(feature = "dev")]
fn take_listenfd_listener() -> Option<std::net::TcpListener> {
    listenfd::ListenFd::from_env()
        .take_tcp_listener(0)
        .ok()
        .flatten()
}

#[cfg(not(feature = "dev"))]
fn take_listenfd_listener() -> Option<std::net::TcpListener> {
    None
}
