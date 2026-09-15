//! Real-browser integration: headless Chrome loads the coach page from the
//! compiled binary, runs `js/coach.js`, and we assert on the live DOM — the
//! speed reader boots and shows a word split on its pivot letter, the `?role=`
//! deep link swaps the spectrum stop, `?book=` opens the booking sheet at the
//! right step (pausing the reader), and the calendar step loads the embed.
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

/// Text between the first element carrying `attr` and the next `</`.
fn text_after<'a>(dom: &'a str, attr: &str) -> &'a str {
    let tag = tag_with(dom, attr);
    let start = dom.find(tag).expect("tag in dom") + tag.len();
    let end = start + dom[start..].find("</").expect("closing tag");
    &dom[start..end]
}

#[tokio::test]
async fn coach_page_behaves_in_a_real_browser() {
    let Some(chrome) = chrome_or_skip() else {
        return;
    };
    let server = TestServer::start(Some(TEST_BOOKING_URL)).await;

    // Plain load: script booted, sheet closed, local-time hint rendered, and
    // the speed reader is playing the default stop with a pivot letter lit.
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
    let reader = tag_with(&dom, "data-reader-mode=");
    for needle in [
        r#"data-reader-mode="speed""#,
        r#"data-reader-ready="true""#,
        r#"data-reader-persona="design-engineer""#,
        r#"data-reader-playing="true""#,
    ] {
        assert!(reader.contains(needle), "{needle} missing on {reader}");
    }
    let pivot = text_after(&dom, "data-reader-pivot");
    assert_eq!(
        pivot.chars().count(),
        1,
        "the reticle should light exactly one letter, got {pivot:?}"
    );

    // Spectrum deep link + Icebreakers step: the stop swaps to Backend, the
    // paragraphs and recap follow it, the sheet opens on step 3, and the
    // reader holds while the sheet is up.
    let dom = dump_dom(
        &chrome,
        &server.url(COACH_HOST, "/?role=backend&book=icebreakers"),
    );
    let reader = tag_with(&dom, "data-reader-mode=");
    assert!(
        reader.contains(r#"data-reader-persona="backend""#),
        "{reader}"
    );
    assert!(
        reader.contains(r#"data-reader-playing="false""#),
        "reader must pause behind the sheet: {reader}"
    );
    assert!(dom.contains("nobody cheers when a server doesn’t crash"));
    assert!(dom.contains("You picked backend on the spectrum."));
    assert_eq!(text_after(&dom, "data-spectrum-current"), "Backend");
    let input = tag_with(&dom, "data-spectrum-input");
    assert!(
        input.contains(r#"aria-valuetext="Backend engineers""#),
        "{input}"
    );
    let stop = tag_with(&dom, r#"data-spectrum-stop="backend""#);
    assert!(stop.contains(r#"data-active="true""#), "{stop}");
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
    let dom = dump_dom(
        &chrome,
        &server.url(COACH_HOST, "/?book=calendar&role=hardware"),
    );
    let frame = tag_with(&dom, "data-booking-frame");
    assert!(
        frame.contains(&format!(r#" src="{TEST_BOOKING_URL}?gv=true""#)),
        "calendar step must load the booking embed: {frame}"
    );
    let reader = tag_with(&dom, "data-reader-mode=");
    assert!(
        reader.contains(r#"data-reader-persona="hardware""#),
        "{reader}"
    );
}
