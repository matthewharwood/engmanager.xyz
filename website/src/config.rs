//! Runtime configuration: env-file loading, bind-address resolution, and
//! shop-host partitioning. (Patterns: axum-service-architecture "config at the
//! composition root"; rust-core-patterns "smart constructors" for `from_env`.)

use std::env::var;
use std::net::SocketAddr;
use std::sync::LazyLock;

// Canonical public origins. Added in P1 so later phases (P2 canonical/OG tags,
// P5 services) have a single source of truth; existing consumers still carry
// their own copies until those phases migrate them.
#[allow(dead_code)] // consumers are wired up in P2/P5
pub const SITE_ORIGIN: &str = "https://engmanager.xyz";
#[allow(dead_code)] // consumers are wired up in P2/P5
pub const SHOP_ORIGIN: &str = "https://store.engmanager.xyz";

const PORT_ENV_VAR: &str = "PORT";
const DEFAULT_PORT: u16 = 3000;
const PRODUCTION_HOST: [u8; 4] = [0, 0, 0, 0];
const DEV_HOST: [u8; 4] = [127, 0, 0, 1];
const SHOP_HOSTS: &[&str] = &[
    "shop.engmanager.xyz",
    "store.engmanager.xyz",
    "shop.localhost",
    "store.localhost",
];

// Dev-only extra shop hosts, for testing on another device (e.g. a phone over
// Tailscale). Set SHOP_DEV_HOSTS to a comma-separated list of hostnames/IPs
// (port-insensitive); unset in production, so this is a no-op there.
static SHOP_DEV_HOSTS: LazyLock<Vec<String>> = LazyLock::new(|| {
    var("SHOP_DEV_HOSTS")
        .unwrap_or_default()
        .split(',')
        .map(|host| host.trim().to_ascii_lowercase())
        .filter(|host| !host.is_empty())
        .collect()
});

// Load local dev env from `.env.local` (preferred) then `.env`, before any
// `env::var` read in startup (the comment store reads COMMENTS_DB_*; Stripe
// code reads STRIPE_*). In production (Render) these files don't exist, so
// this is a no-op and real dashboard env vars are used. dotenvy never
// overrides variables already present in the environment, so exported vars
// always win.
pub fn load_env() {
    let _ = dotenvy::from_filename(".env.local");
    let _ = dotenvy::dotenv();
}

/// Snapshot of the env-derived runtime configuration, resolved once at
/// startup by the composition root.
pub struct Config {
    /// Parsed `PORT` env var. `None` when unset *or* unparseable — bind
    /// resolution below preserves the legacy fallback semantics on its own.
    pub port: Option<u16>,
    /// Address the server binds to; see `resolve_server_address`.
    pub bind: SocketAddr,
    /// Extra shop hosts accepted in dev (snapshot of `SHOP_DEV_HOSTS`).
    pub shop_dev_hosts: Vec<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Config {
            port: var(PORT_ENV_VAR)
                .ok()
                .and_then(|port| port.parse::<u16>().ok()),
            bind: resolve_server_address(),
            shop_dev_hosts: SHOP_DEV_HOSTS.clone(),
        }
    }
}

// PORT set → bind 0.0.0.0:PORT (PaaS runtimes inject PORT and route to it);
// PORT unset → bind 127.0.0.1:3000 (dev default, loopback only).
//
// Deliberately preserved quirk: a PORT value that fails to parse silently
// falls back to DEFAULT_PORT while *still* selecting the production
// 0.0.0.0 host (presence of the variable, not its validity, picks the host).
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

pub fn is_shop_host(host: &str) -> bool {
    let host_without_port = host.split(':').next().unwrap_or(host);
    SHOP_HOSTS
        .iter()
        .any(|shop_host| host_without_port.eq_ignore_ascii_case(shop_host))
        || SHOP_DEV_HOSTS
            .iter()
            .any(|shop_host| host_without_port.eq_ignore_ascii_case(shop_host))
}

#[cfg(test)]
mod tests {
    use super::is_shop_host;

    #[test]
    fn shop_host_detection_accepts_production_and_local_hosts() {
        assert!(is_shop_host("shop.engmanager.xyz"));
        assert!(is_shop_host("shop.engmanager.xyz:443"));
        assert!(is_shop_host("SHOP.ENGMANAGER.XYZ"));
        assert!(is_shop_host("store.engmanager.xyz"));
        assert!(is_shop_host("STORE.ENGMANAGER.XYZ:443"));
        assert!(is_shop_host("shop.localhost:3000"));
        assert!(is_shop_host("store.localhost:3000"));
        assert!(!is_shop_host("engmanager.xyz"));
        assert!(!is_shop_host("www.engmanager.xyz"));
    }
}
