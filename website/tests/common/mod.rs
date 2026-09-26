//! Shared harness for the black-box integration tests: boots the REAL
//! compiled `website` binary on a free port (exactly how Render runs it —
//! `PORT` set, `0.0.0.0` bind) and tears it down on drop.

#![allow(dead_code)] // each test binary uses a different subset

use std::net::{SocketAddr, TcpListener};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

pub const COACH_HOST: &str = "coach.localhost";
pub const SITE_HOST: &str = "engmanager.xyz";
pub const TEST_BOOKING_URL: &str =
    "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0IntegrationTest";

pub struct TestServer {
    child: Child,
    pub port: u16,
}

impl TestServer {
    /// Start the binary with `COACH_BOOKING_URL` set to `booking_url` (or
    /// unset for `None`) and wait until `/health` answers.
    pub async fn start(booking_url: Option<&str>) -> Self {
        let port = free_port();
        let mut command = Command::new(env!("CARGO_BIN_EXE_website"));
        command
            // A scratch cwd so a developer's `.env.local` (Stripe keys, a real
            // booking URL) can't leak into the run.
            .current_dir(std::env::temp_dir())
            .env("PORT", port.to_string())
            .env("RUST_LOG", "warn")
            .env_remove("COACH_BOOKING_URL")
            .env_remove("STRIPE_SECRET_KEY")
            .env_remove("STRIPE_PUBLISHABLE_KEY")
            .env_remove("STRIPE_WEBHOOK_SECRET")
            // Empty values also prevent dotenv from restoring live credentials.
            .env("KIT_API_KEY", "")
            .env("KIT_FORM_ID", "")
            .stdout(Stdio::null())
            .stderr(Stdio::inherit());
        if let Some(url) = booking_url {
            command.env("COACH_BOOKING_URL", url);
        }
        let child = command.spawn().expect("spawn the website binary");
        let server = TestServer { child, port };
        server.wait_until_healthy().await;
        server
    }

    pub fn addr(&self) -> SocketAddr {
        SocketAddr::from(([127, 0, 0, 1], self.port))
    }

    pub fn url(&self, host: &str, path: &str) -> String {
        format!("http://{host}:{}{path}", self.port)
    }

    /// A client that resolves the virtual hosts to this server and never
    /// follows redirects (so 308s are observable).
    pub fn client(&self) -> reqwest::Client {
        reqwest::Client::builder()
            .resolve(COACH_HOST, self.addr())
            .resolve(SITE_HOST, self.addr())
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(15))
            .build()
            .expect("build test client")
    }

    async fn wait_until_healthy(&self) {
        let client = reqwest::Client::new();
        let deadline = Instant::now() + Duration::from_secs(90);
        let health = format!("http://127.0.0.1:{}/health", self.port);
        while Instant::now() < deadline {
            if let Ok(response) = client.get(&health).send().await
                && response.status().is_success()
            {
                return;
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
        panic!("website binary never became healthy on port {}", self.port);
    }
}

impl Drop for TestServer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .expect("reserve a free port")
}

/// The first `/assets/...` URL in `html` whose path starts with `prefix`
/// (e.g. `/assets/js/coach.`) — hashed asset names change per build.
pub fn asset_href(html: &str, prefix: &str) -> String {
    let start = html
        .find(prefix)
        .unwrap_or_else(|| panic!("no asset starting with {prefix}"));
    let end = html[start..]
        .find('"')
        .map(|offset| start + offset)
        .expect("asset href is quoted");
    html[start..end].to_string()
}

/// Parse the inert coaching configuration out of the page.
pub fn coach_island(html: &str) -> serde_json::Value {
    let marker = r#"<script type="application/json" data-eng-config="__coach">"#;
    let start = html.find(marker).expect("coach island present") + marker.len();
    let end = html[start..]
        .find("</script>")
        .map(|offset| start + offset)
        .expect("coach island terminates");
    serde_json::from_str(&html[start..end]).expect("coach island is valid JSON")
}
