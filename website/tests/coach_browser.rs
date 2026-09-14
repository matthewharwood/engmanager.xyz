//! Real-browser integration: headless Chrome loads the coach page from the
//! compiled binary, runs `js/coach.js`, and we assert on the live DOM — the
//! `?at=` slider deep link swaps the persona, `?book=` opens the booking
//! sheet at the right step, and the calendar step loads the Google embed.
//!
//! Needs a Chrome/Chromium binary (`CHROME_BIN`, else common install paths).
//! Skips when none is found, unless `REQUIRE_BROWSER_TESTS=1` (set in CI),
//! where a missing browser fails the run instead.

mod common;

use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use common::{COACH_HOST, TEST_BOOKING_URL, TestServer};

fn find_chrome() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("CHROME_BIN").map(PathBuf::from)
        && path.exists()
    {
        return Some(path);
    }
    let mac = PathBuf::from("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    if mac.exists() {
        return Some(mac);
    }
    let path = std::env::var_os("PATH")?;
    [
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
    ]
    .iter()
    .flat_map(|name| std::env::split_paths(&path).map(move |dir| dir.join(name)))
    .find(|candidate| candidate.exists())
}

fn chrome_or_skip() -> Option<PathBuf> {
    let chrome = find_chrome();
    if chrome.is_none() {
        assert!(
            std::env::var("REQUIRE_BROWSER_TESTS").is_err(),
            "REQUIRE_BROWSER_TESTS is set but no Chrome/Chromium binary was found (set CHROME_BIN)"
        );
        eprintln!("skipping browser test: no Chrome/Chromium found (set CHROME_BIN)");
    }
    chrome
}

/// Load `url` in headless Chrome and return the post-script DOM. Reads stdout
/// until `</html>` rather than waiting for exit: headless Chrome can linger
/// after dumping on some platforms, so the process is killed once we have it.
fn dump_dom(chrome: &PathBuf, url: &str) -> String {
    let profile = std::env::temp_dir().join(format!(
        "coach-browser-test-{}-{}",
        std::process::id(),
        Instant::now().elapsed().as_nanos()
    ));
    let mut child = Command::new(chrome)
        .args([
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-dev-shm-usage",
            "--host-resolver-rules=MAP coach.localhost 127.0.0.1",
            "--virtual-time-budget=4000",
            "--dump-dom",
        ])
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg(url)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn chrome");

    let mut stdout = child.stdout.take().expect("chrome stdout");
    let (tx, rx) = mpsc::channel::<Vec<u8>>();
    std::thread::spawn(move || {
        let mut buf = [0u8; 16 * 1024];
        while let Ok(n) = stdout.read(&mut buf) {
            if n == 0 || tx.send(buf[..n].to_vec()).is_err() {
                break;
            }
        }
    });

    let deadline = Instant::now() + Duration::from_secs(60);
    let mut dom = Vec::new();
    while Instant::now() < deadline {
        match rx.recv_timeout(Duration::from_millis(250)) {
            Ok(chunk) => {
                dom.extend(chunk);
                if dom.windows(7).any(|w| w == b"</html>") {
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    let _ = child.kill();
    let _ = child.wait();
    let _ = std::fs::remove_dir_all(&profile);
    let dom = String::from_utf8_lossy(&dom).into_owned();
    assert!(dom.contains("</html>"), "chrome produced no DOM for {url}");
    dom
}

/// The opening tag of the first element carrying `attr`.
fn tag_with<'a>(dom: &'a str, attr: &str) -> &'a str {
    let at = dom
        .find(attr)
        .unwrap_or_else(|| panic!("no element with {attr}"));
    let open = dom[..at].rfind('<').expect("tag open");
    let close = at + dom[at..].find('>').expect("tag close");
    &dom[open..=close]
}

#[tokio::test]
async fn coach_page_behaves_in_a_real_browser() {
    let Some(chrome) = chrome_or_skip() else {
        return;
    };
    let server = TestServer::start(Some(TEST_BOOKING_URL)).await;

    // Plain load: script booted, sheet closed, local-time hint rendered.
    let dom = dump_dom(&chrome, &server.url(COACH_HOST, "/"));
    assert!(
        dom.contains(r#"data-coach-ready="true""#),
        "coach.js did not boot"
    );
    let sheet = tag_with(&dom, "data-booking-state=");
    assert!(sheet.contains(r#"data-booking-state="closed""#), "{sheet}");
    assert!(
        sheet.contains(" hidden"),
        "closed sheet must stay hidden: {sheet}"
    );
    let hint = tag_with(&dom, "data-local-window");
    assert!(
        !hint.contains("hidden"),
        "local window hint stayed hidden: {hint}"
    );
    assert!(dom.contains("Next window: "), "local window text missing");

    // Slider deep link + Icebreakers step: persona swaps to Designer, the
    // recap reflects the position, and the sheet opens on step 3.
    let dom = dump_dom(&chrome, &server.url(COACH_HOST, "/?at=90&book=icebreakers"));
    let persona = tag_with(&dom, "data-persona=");
    assert!(persona.contains(r#"data-persona="designer""#), "{persona}");
    assert!(dom.contains("Make your work land with the engineers who build it."));
    assert!(dom.contains("10% engineering · 90% design — Designer"));
    let input = tag_with(&dom, "data-spectrum-input");
    assert!(input.contains("Designer, 90% designer"), "{input}");
    let sheet = tag_with(&dom, "data-booking-state=");
    assert!(
        sheet.contains(r#"data-booking-state="icebreakers""#),
        "{sheet}"
    );
    assert!(
        !sheet.contains(" hidden"),
        "open sheet must not be hidden: {sheet}"
    );
    let icebreakers = tag_with(&dom, r#"data-booking-view="icebreakers""#);
    assert!(!icebreakers.contains("hidden"), "{icebreakers}");
    let calendar_view = tag_with(&dom, r#"data-booking-view="calendar""#);
    assert!(calendar_view.contains("hidden"), "{calendar_view}");
    // The Google embed is NOT loaded until the calendar step is shown.
    let frame = tag_with(&dom, "data-booking-frame");
    assert!(!frame.contains(" src="), "frame loaded too early: {frame}");

    // Calendar step: the embed's src is populated from data-src.
    let dom = dump_dom(&chrome, &server.url(COACH_HOST, "/?book=calendar&at=5"));
    let frame = tag_with(&dom, "data-booking-frame");
    assert!(
        frame.contains(&format!(r#" src="{TEST_BOOKING_URL}?gv=true""#)),
        "calendar step must load the booking embed: {frame}"
    );
    let persona = tag_with(&dom, "data-persona=");
    assert!(persona.contains(r#"data-persona="engineer""#), "{persona}");
}
