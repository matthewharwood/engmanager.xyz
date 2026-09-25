//! Local Chrome/CDP harness for journey integration tests. No browser SDK needed.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

pub fn chrome() -> Option<PathBuf> {
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
    .find(|path| path.exists())
}

struct ChromeProcess {
    child: Child,
    profile: PathBuf,
    stderr_path: PathBuf,
}
impl Drop for ChromeProcess {
    fn drop(&mut self) {
        let failed = std::thread::panicking();
        if failed {
            eprintln!(
                "Chrome PID {} status before cleanup: {:?}",
                self.child.id(),
                self.child.try_wait()
            );
        }
        let _ = self.child.kill();
        let status = self.child.wait();
        if failed {
            let stderr = std::fs::read(&self.stderr_path).unwrap_or_default();
            let tail = &stderr[stderr.len().saturating_sub(16_384)..];
            eprintln!(
                "Chrome cleanup exit status: {status:?}\nChrome stderr saved to {}\n--- Chrome stderr (last 16 KiB) ---\n{}",
                self.stderr_path.display(),
                String::from_utf8_lossy(tail)
            );
        } else {
            let _ = std::fs::remove_file(&self.stderr_path);
        }
        let _ = std::fs::remove_dir_all(&self.profile);
    }
}

// A minimal local-only CDP WebSocket transport avoids adding a browser SDK or
// Node toolchain. Chrome sends one JSON message per WebSocket text message.
fn send_frame(socket: &mut TcpStream, opcode: u8, payload: &[u8], counter: u32) {
    let mask = counter.to_be_bytes();
    let mut frame = vec![0x80 | opcode];
    if payload.len() < 126 {
        frame.push(0x80 | payload.len() as u8);
    } else if payload.len() <= u16::MAX as usize {
        frame.push(0x80 | 126);
        frame.extend((payload.len() as u16).to_be_bytes());
    } else {
        frame.push(0x80 | 127);
        frame.extend((payload.len() as u64).to_be_bytes());
    }
    frame.extend(mask);
    frame.extend(
        payload
            .iter()
            .enumerate()
            .map(|(index, byte)| byte ^ mask[index % 4]),
    );
    socket.write_all(&frame).expect("write CDP frame");
}

fn receive_message(socket: &mut BufReader<TcpStream>) -> Vec<u8> {
    let mut result = Vec::new();
    loop {
        let mut prefix = [0; 2];
        socket.read_exact(&mut prefix).expect("CDP frame header");
        let mut length = u64::from(prefix[1] & 0x7f);
        if length == 126 {
            let mut bytes = [0; 2];
            socket.read_exact(&mut bytes).unwrap();
            length = u64::from(u16::from_be_bytes(bytes));
        } else if length == 127 {
            let mut bytes = [0; 8];
            socket.read_exact(&mut bytes).unwrap();
            length = u64::from_be_bytes(bytes);
        }
        assert!(length < 2_000_000, "unexpected oversized CDP response");
        let mut mask = [0; 4];
        if prefix[1] & 0x80 != 0 {
            socket.read_exact(&mut mask).unwrap();
        }
        let mut payload = vec![0; length as usize];
        socket.read_exact(&mut payload).expect("CDP frame payload");
        if prefix[1] & 0x80 != 0 {
            for (index, byte) in payload.iter_mut().enumerate() {
                *byte ^= mask[index % 4];
            }
        }
        match prefix[0] & 0x0f {
            8 => panic!("Chrome closed the CDP session"),
            9 => {
                send_frame(socket.get_mut(), 10, &payload, 1);
                continue;
            }
            0 | 1 => result.extend(payload),
            _ => continue,
        }
        if prefix[0] & 0x80 != 0 {
            return result;
        }
    }
}

fn cdp_command(
    socket: &mut BufReader<TcpStream>,
    id: &mut u32,
    nonce: u32,
    method: &str,
    params: serde_json::Value,
) -> serde_json::Value {
    *id += 1;
    let request = serde_json::json!({"id":id,"method":method,"params":params});
    send_frame(
        socket.get_mut(),
        1,
        request.to_string().as_bytes(),
        nonce.wrapping_add(*id),
    );
    loop {
        let value: serde_json::Value =
            serde_json::from_slice(&receive_message(socket)).expect("CDP JSON");
        if value["id"] == *id {
            assert!(value.get("error").is_none(), "CDP {method}: {value}");
            return value;
        }
    }
}

pub async fn dump_dom(chrome: PathBuf, url: &str, reduced_motion: bool) -> String {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let profile =
        std::env::temp_dir().join(format!("journey-browser-{}-{nonce}", std::process::id()));
    let stderr_path = profile.with_extension("stderr.log");
    let stderr = std::fs::File::create(&stderr_path).expect("create Chrome stderr log");
    let mut command = Command::new(chrome);
    command.args([
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
        "--window-size=1400,1200",
        "--remote-debugging-port=0",
    ]);
    if reduced_motion {
        command.arg("--force-prefers-reduced-motion=reduce");
    }
    let child = command
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg(url)
        .stdout(Stdio::null())
        .stderr(Stdio::from(stderr))
        .spawn()
        .expect("spawn Chrome");
    let mut process = ChromeProcess {
        child,
        profile,
        stderr_path,
    };
    let deadline = Instant::now() + Duration::from_secs(150);
    let debugging_port = loop {
        assert!(
            process
                .child
                .try_wait()
                .expect("read Chrome status")
                .is_none(),
            "Chrome exited before starting its debugging endpoint"
        );
        if let Ok(text) = std::fs::read_to_string(process.profile.join("DevToolsActivePort"))
            && let Some(port) = text
                .lines()
                .next()
                .and_then(|line| line.parse::<u16>().ok())
        {
            break port;
        }
        assert!(
            Instant::now() < deadline,
            "Chrome did not start its debugging endpoint"
        );
        tokio::time::sleep(Duration::from_millis(50)).await;
    };
    let client = reqwest::Client::new();
    let websocket = loop {
        let targets: serde_json::Value = client
            .get(format!("http://127.0.0.1:{debugging_port}/json/list"))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        if let Some(target) = targets
            .as_array()
            .unwrap()
            .iter()
            .find(|target| target["type"] == "page")
            && let Some(url) = target["webSocketDebuggerUrl"].as_str()
        {
            break reqwest::Url::parse(url).unwrap();
        }
        assert!(
            Instant::now() < deadline,
            "Chrome page target did not appear"
        );
        tokio::time::sleep(Duration::from_millis(50)).await;
    };
    let mut socket = TcpStream::connect(("127.0.0.1", debugging_port)).expect("connect CDP");
    socket
        .set_read_timeout(Some(Duration::from_secs(10)))
        .unwrap();
    write!(socket, "GET {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: cGVyc29uYWxpdHktdGVzdA==\r\nSec-WebSocket-Version: 13\r\n\r\n", websocket.path(), debugging_port).unwrap();
    let mut socket = BufReader::new(socket);
    let mut line = String::new();
    socket.read_line(&mut line).unwrap();
    assert!(line.contains("101"), "CDP handshake: {line}");
    loop {
        line.clear();
        socket.read_line(&mut line).unwrap();
        if line == "\r\n" {
            break;
        }
    }
    let mut id = 0u32;
    loop {
        let expression = if Instant::now() < deadline {
            "document.body?.dataset.testResult ? {html:document.documentElement.outerHTML} : window.__journeyGesture ? {gesture:window.__journeyGesture} : null"
        } else {
            "({html:document.documentElement.outerHTML})"
        };
        let response = cdp_command(
            &mut socket,
            &mut id,
            nonce as u32,
            "Runtime.evaluate",
            serde_json::json!({"expression":expression,"returnByValue":true}),
        );
        let value = &response["result"]["result"]["value"];
        if let Some(dom) = value["html"].as_str() {
            return dom.to_string();
        }
        if let Some(gesture) = value.get("gesture") {
            let x = gesture["x"].as_f64().expect("gesture x");
            let y = gesture["y"].as_f64().expect("gesture y");
            cdp_command(
                &mut socket,
                &mut id,
                nonce as u32,
                "Runtime.evaluate",
                serde_json::json!({"expression":"delete window.__journeyGesture"}),
            );
            for (kind, offset, button) in [
                ("mouseMoved", 0.0, "none"),
                ("mousePressed", 0.0, "left"),
                ("mouseMoved", -25.0, "left"),
                ("mouseMoved", -110.0, "left"),
                ("mouseReleased", -110.0, "left"),
            ] {
                cdp_command(
                    &mut socket,
                    &mut id,
                    nonce as u32,
                    "Input.dispatchMouseEvent",
                    serde_json::json!({"type":kind,"x":x+offset,"y":y,"button":button,"clickCount":1}),
                );
            }
        }
        assert!(
            Instant::now() < deadline,
            "Browser fixture never returned a DOM"
        );
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}
