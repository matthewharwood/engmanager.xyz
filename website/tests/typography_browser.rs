//! Exercises the actual journey router and page scripts in Chrome against the
//! compiled server. The test-only proxy allows same-origin iframe control and
//! blocks external resources so cosmetics/payment providers cannot gate CI.

#[path = "common/browser.rs"]
mod browser;
mod common;

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode, header};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::get;
use common::TestServer;

// A default `cargo test` runs the two motion variants concurrently. Each real
// browser owns several renderer processes and a full embedded server, so bound
// that resource cost while keeping both variants independently reported.
static BROWSER_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

struct ProxyTask(tokio::task::JoinHandle<()>);

impl Drop for ProxyTask {
    fn drop(&mut self) {
        self.0.abort();
    }
}

// Instrument before the production scripts, delaying only cold font fetches.
// The real font files still go through Chrome's FontFace decoder.
const INSTRUMENT: &str = r#"<style>:root{--font-sans:system-ui}</style><script>
window.__fontStates=[];window.__fontRequests=[];
new MutationObserver(records=>{for(const r of records)window.__fontStates.push(document.documentElement.dataset.fontState)}).observe(document.documentElement,{attributes:true,attributeFilter:['data-font-state']});
const realFetch=window.fetch.bind(window);
window.fetch=async(url,options={})=>{
 if(String(url).includes('.woff2')&&options.cache!=='only-if-cached'){
  window.__fontRequests.push(String(url));
  await new Promise(resolve=>setTimeout(resolve,180));
  if(window.__failFont)throw new Error('test offline');
 }
 return realFetch(url,options);
};
</script>"#;

const FIXTURE: &str = r##"<!doctype html><html><head><meta charset="utf-8"></head><body>
<pre id="result">Running typography checks</pre><iframe id="app" style="width:1200px;height:900px"></iframe>
<script type="module">
const frame=document.querySelector('#app'),result=document.querySelector('#result'),checks=[];
const win=()=>frame.contentWindow,doc=()=>frame.contentDocument,root=()=>doc().documentElement;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,label)=>{if(!value)throw Error(label);checks.push(label)};
async function until(predicate,label){for(let i=0;i<400;i++){if(predicate())return;await delay(20)}throw Error('Timed out: '+label)}
async function ready(){await until(()=>win().__engTypography&&doc().readyState==='complete','document scripts');await win().__engTypography.ready;await win().__engTypography.displayReady;}
const cycle=()=>doc().querySelector('[data-theme-cycle]').click();
const loading=()=>win().__fontStates.some(state=>['loading','leaving','entering'].includes(state));
const reset=()=>{win().__fontStates.length=0;win().__fontRequests.length=0};
try{
 localStorage.clear();localStorage.setItem('engmanager.theme','light');await caches.delete('engmanager-theme-fonts-v1');
 frame.src='/feed';await ready();
 const families={light:'PP Neue Montreal',dark:'PP Mori',catppuccin:'PP Editorial New',synthwave:'PP Neue Machina',cyberpunk:'PP Fraktion Mono',forest:'PP Woodland',lofi:'PP Writer',dracula:'PP Fragment',luxury:'PP Eiko'};
 assert(root().dataset.fontTheme==='light','stored Light selects its own face before paint');
 assert(win().__fontRequests.length===1,'first paint downloads only one theme body font');
 assert([...doc().fonts].filter(face=>face.status==='loaded').length===3,'only display, Redacted and active body are decoded');
 assert(doc().fonts.check('16px Redacted'),'Redacted is eagerly available');
 for(const [theme,family] of Object.entries(families).slice(1)){
  reset();cycle();await until(()=>root().dataset.fontState==='loading','cold '+theme);
  assert(win().getComputedStyle(doc().body).fontFamily.includes('Redacted'),theme+' renders the Redacted face while downloading');
  await win().__engTypography.ready;await delay(20);
  assert(root().dataset.fontTheme===theme,theme+' commits the requested face');
  assert(win().getComputedStyle(doc().body).fontFamily.includes(family),theme+' uses '+family);
  assert([...doc().fonts].some(face=>face.family===family&&face.status==='loaded'),theme+' is fully decoded before reveal');
  assert(win().__fontRequests.length===1,theme+' requests just its own face');
  const reduced=win().matchMedia('(prefers-reduced-motion: reduce)').matches;
  assert(reduced?!win().__fontStates.includes('leaving'):win().__fontStates.includes('leaving'),theme+' respects motion preference');
 }
 reset();for(let i=0;i<10;i++)cycle();await win().__engTypography.ready;await delay(20);
 assert(!loading()&&win().__fontRequests.length===0,'cycling every cached face is immediate, without Redacted or network');
 assert(root().dataset.fontTheme==='luxury','rapid cached clicks finish on the last theme');
 frame.src='/feed?font-reload=1';await until(()=>win().location.search.includes('font-reload'),'new document');await ready();await delay(20);
 assert(root().dataset.fontTheme==='luxury'&&!loading()&&win().__fontRequests.length===0,'hard reload finds cached bytes before deciding whether to redact');
 assert(win().getComputedStyle(doc().body).fontFamily.includes('PP Eiko'),'hard reload decodes and renders the cached face');
 await until(()=>win().__engNav?.ready,'router');await win().__engNav.navigate('/coach');
 assert(root().dataset.fontTheme==='luxury'&&win().getComputedStyle(doc().querySelector('.coach-reader-text')).fontFamily.includes('PP Eiko'),'font persists through soft navigation');
 await win().__engNav.prepareNext();await until(()=>doc().querySelector('.journey-preview')?.contentDocument?.documentElement?.dataset.fontTheme==='luxury','preview font');
 assert(true,'inert journey preview uses the same decoded theme face');
 result.textContent='PASS\n'+checks.join('\n');document.body.dataset.testResult='passed';
}catch(error){result.textContent='FAIL\n'+error.stack+'\nSTATE: '+JSON.stringify(root()?.dataset)+'\nSTATES: '+JSON.stringify(win()?.__fontStates)+'\nREQUESTS: '+JSON.stringify(win()?.__fontRequests)+'\nCHECKS: '+checks.join('\n');document.body.dataset.testResult='failed'}
</script></body></html>"##;

#[derive(Clone)]
struct Proxy {
    target: String,
    client: reqwest::Client,
}

async fn forward(State(proxy): State<Proxy>, request: Request<Body>) -> Response {
    let response = match proxy
        .client
        .get(format!("{}{}", proxy.target, request.uri()))
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => return (StatusCode::BAD_GATEWAY, error.to_string()).into_response(),
    };
    let status = response.status();
    let mut headers = response.headers().clone();
    headers.remove(header::CONTENT_LENGTH);
    headers.remove(header::TRANSFER_ENCODING);
    headers.remove(header::X_FRAME_OPTIONS);
    if let Some(csp) = headers
        .get(header::CONTENT_SECURITY_POLICY)
        .and_then(|value| value.to_str().ok())
    {
        let csp = csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'");
        headers.insert(header::CONTENT_SECURITY_POLICY, csp.parse().unwrap());
    } else {
        headers.insert(header::CONTENT_SECURITY_POLICY, "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; frame-src 'self'; connect-src 'self'; frame-ancestors 'self'".parse().unwrap());
    }
    match response.bytes().await {
        Ok(bytes) => {
            let is_html = headers
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .is_some_and(|v| v.contains("text/html"));
            if is_html {
                let html = String::from_utf8_lossy(&bytes).replacen(
                    "<head>",
                    &format!("<head>{INSTRUMENT}"),
                    1,
                );
                (status, headers, html).into_response()
            } else {
                (status, headers, bytes).into_response()
            }
        }
        Err(error) => (StatusCode::BAD_GATEWAY, error.to_string()).into_response(),
    }
}

async fn exercise_typography(reduced_motion: bool) {
    let _browser_guard = BROWSER_LOCK.lock().await;
    let Some(chrome) = browser::chrome() else {
        assert!(
            std::env::var("REQUIRE_BROWSER_TESTS").is_err(),
            "Chrome is required in CI; set CHROME_BIN"
        );
        eprintln!("skipping journey browser test: Chrome not found");
        return;
    };
    let server = TestServer::start(None).await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("test proxy port");
    let port = listener.local_addr().unwrap().port();
    let router = axum::Router::new()
        .route("/__typography_test", get(|| async { Html(FIXTURE) }))
        .fallback(forward)
        .with_state(Proxy {
            target: format!("http://127.0.0.1:{}", server.port),
            client: reqwest::Client::new(),
        });
    let _proxy = ProxyTask(tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap()
    }));
    let suffix = if reduced_motion { "?reduced=1" } else { "" };
    let dom = browser::dump_dom(
        chrome,
        &format!("http://127.0.0.1:{port}/__typography_test{suffix}"),
        reduced_motion,
    )
    .await;
    let diagnostic = dom
        .split("<pre id=\"result\">")
        .nth(1)
        .and_then(|value| value.split("</pre>").next())
        .unwrap_or(&dom);
    assert!(
        dom.contains("data-test-result=\"passed\""),
        "Typography browser checks did not pass:\n{diagnostic}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn theme_faces_load_lazily_and_remain_cached() {
    exercise_typography(false).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn theme_faces_respect_reduced_motion() {
    exercise_typography(true).await;
}
