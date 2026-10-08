//! Exact assets preserve coherent cached documents; missing assets leave
//! semantic content readable without silently substituting a new class map.
#[path = "common/browser.rs"]
mod browser;
mod common;

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode, header};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::get;
use common::{TestServer, asset_href};
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

const LEGACY_FEED: &str = include_str!("../compat/css-generation-2061afa3/legacy-feed.html");
const COMPACT_FEED: &str = include_str!("../compat/css-generation-c65689df/legacy-feed.html");

const FIXTURE: &str = r#"<!doctype html><html><body><pre id="result">RUNNING</pre><iframe id="app"></iframe><script type="module">
const frame=document.querySelector('#app'),result=document.querySelector('#result');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,message)=>{if(!value)throw new Error(message)};
async function until(predicate,label){const end=performance.now()+15000;while(performance.now()<end){try{if(await predicate())return}catch{}await delay(50)}throw new Error('Timed out: '+label)}
async function exercise(kind){const reduced=kind.startsWith('personality-');frame.src=reduced?'/articles/big-personality?__css_fixture='+kind:'/__css_recovery/'+kind;await until(()=>frame.contentDocument?.readyState==='complete'&&(reduced?frame.contentWindow.location.pathname==='/articles/big-personality'&&new URLSearchParams(frame.contentWindow.location.search).get('__css_fixture')===kind:frame.contentWindow.location.pathname.endsWith('/'+kind)),'initial '+kind)}
async function requests(kind){return (await (await fetch('/__css_counts')).json())[kind]||0}
async function unavailableAssetsStayMissing(doc){const assets=[...doc.querySelectorAll('link[rel="stylesheet"][href],script[src]')].map(node=>node.href||node.src).filter(url=>url.includes('.000000000000.'));assert(assets.length>0,'fixture contains an obsolete CSS or JavaScript URL');for(const url of assets)assert((await fetch(url)).status===404,'obsolete URL never aliases current bytes: '+url);}
try{
 // Run before feed installs the root worker. Its global navigation preload
 // otherwise adds unused requests to its intentionally bypassed private routes.
 for(const kind of ['unsubscribe-get','unsubscribe-result']){
  const path=kind==='unsubscribe-get'?'/unsubscribe':'/api/newsletter/unsubscribe';
  frame.src=path+'?__css_fixture='+kind;
  await until(()=>frame.contentWindow.location.pathname===path&&new URLSearchParams(frame.contentWindow.location.search).get('__css_fixture')===kind&&frame.contentDocument.readyState==='complete'&&frame.contentDocument.querySelector('[data-css-asset-recovery]'),'private unsubscribe asset fallback '+kind);
  assert(await requests(kind)===1,'private form/result asset failure never replays a document or POST');
  assert(frame.contentWindow.location.pathname===path&&!frame.contentWindow.location.search.includes('__eng_css_refresh='),'private recovery preserves the current URL and result');
  assert(frame.contentDocument.querySelector('meta[name="eng-css-generation"]')&&frame.contentDocument.querySelector('[data-unsubscribe-state]'),'private compiled document remains readable');
  const reload=frame.contentDocument.querySelector('[data-css-asset-recovery] a');
  assert(new URL(reload.href).pathname==='/unsubscribe'&&!new URL(reload.href).searchParams.has('token'),'private fallback offers a clean destination without a bearer token');
  assert(reload.getBoundingClientRect().width>0&&!frame.contentDocument.querySelector('script[src*="css-generation-recovery"]'),'ordinary private recovery works without loading a recovery runtime');
 }
 for(const kind of ['personality-router','personality-css','personality-both']){
  await exercise(kind);
  const doc=frame.contentDocument;
  assert(await requests(kind)===1&&!frame.contentWindow.location.search.includes('__eng_css_refresh='),'strict-CSP missing assets never reload the document: '+kind);
  assert(doc.querySelector('meta[name="eng-css-generation"]')&&doc.querySelector('[data-personality-route="article"]'),'reduced article declares its compiled generation: '+kind);
  assert(!doc.querySelector('script:not([src])'),'strict-CSP article has no inline executable script: '+kind);
  assert(doc.querySelector('article')?.textContent.includes('Creating value'),'reduced article content remains readable: '+kind);
  const next=doc.querySelector('a[href="/personality/prepare"]');
  assert(next&&next.getBoundingClientRect().width>0,'reduced article retains a usable ordinary next link: '+kind);
  await unavailableAssetsStayMissing(doc);
 }
 for(const kind of ['router','css','both','storage','alternate','offline']){
  await exercise(kind);
  const doc=frame.contentDocument;
  assert(await requests(kind)===1&&!frame.contentWindow.location.search,'missing initial assets leave one document request: '+kind);
  assert(doc.querySelector('meta[name="eng-css-generation"]')&&doc.querySelector('[data-eng-page="feed"]'),'current semantic feed content remains present: '+kind);
  const articles=[...doc.querySelectorAll('a[href^="/articles/"]')].filter(link=>link.textContent.trim()&&link.getBoundingClientRect().width>0);
  assert(articles.length>0,'initial asset failure retains visible ordinary article links: '+kind);
  assert(!frame.contentWindow.__engNav?.ready||kind==='css','an obsolete router never executes under its missing URL: '+kind);
  await unavailableAssetsStayMissing(doc);
 }
 await exercise('legacy');
 await until(()=>frame.contentWindow.__engNav?.ready,'previous release boots exact archived assets');
 const legacy=frame.contentDocument;
 assert(!legacy.querySelector('meta[name="eng-css-generation"]')&&legacy.querySelector('.article-fluid-link'),'legacy document retains its authored class map');
 await frame.contentWindow.__engNav.navigate('/shop');
 await until(()=>frame.contentDocument!==legacy&&frame.contentWindow.location.pathname==='/shop'&&frame.contentWindow.__engNav?.ready,'legacy router hard-navigates across changed asset URLs');
 assert(frame.contentDocument.querySelector('meta[name="eng-css-generation"]')&&frame.contentDocument.querySelector('[data-shop-grid]'),'current destination mounts as a coherent new document');
 await exercise('compiled');
 await until(()=>frame.contentWindow.__engNav?.ready,'cached compact release boots exact archived assets');
 const compiled=frame.contentDocument,compiledWindow=frame.contentWindow;
 await compiled.fonts.ready;await compiledWindow.__engTypography?.ready;
 assert(compiled.querySelector('meta[name="eng-css-generation"]').content==='c65689df26f4ea06682c976b54ca8a20b77d6ed016c1c7d78c0894158a5a82fe','cached compact HTML retains its published generation');
 const nav=compiled.querySelector('nav[aria-label="Primary"]');
 assert(compiledWindow.getComputedStyle(nav).position==='sticky'&&compiledWindow.getComputedStyle(nav).display==='grid','archived CSS applies the cached compact navigation class map');
 assert([...compiled.querySelectorAll('a[href^="/articles/"]')].some(link=>link.textContent.trim()&&link.getBoundingClientRect().width>0),'cached compact article links remain visible');
 await compiledWindow.__engNav.navigate('/shop');
 await until(()=>frame.contentDocument!==compiled&&frame.contentWindow.location.pathname==='/shop'&&frame.contentWindow.__engNav?.ready,'cached compact router reloads across a changed generation');
 assert(frame.contentDocument.querySelector('meta[name="eng-css-generation"]').content!=='c65689df26f4ea06682c976b54ca8a20b77d6ed016c1c7d78c0894158a5a82fe'&&frame.contentDocument.querySelector('[data-shop-grid]'),'cached compact navigation promotes a coherent current document');
 await exercise('worker');
 await frame.contentWindow.navigator.serviceWorker.register('/sw.js');
 await frame.contentWindow.navigator.serviceWorker.ready;
 await until(()=>frame.contentWindow.navigator.serviceWorker.controller,'worker controls the generated document');
 frame.src='/feed';
 await until(()=>frame.contentWindow.location.pathname==='/feed'&&frame.contentDocument.readyState==='complete'&&frame.contentWindow.__engNav?.ready,'network-first generated page visit');
 await frame.contentDocument.fonts.ready;
 const generation=frame.contentDocument.querySelector('meta[name="eng-css-generation"]').content;
 const feedUrl=new URL('/feed',location.href).href;
 const assets=[...frame.contentDocument.querySelectorAll('link[rel="stylesheet"][href],script[src]')].map(node=>node.href||node.src).filter(url=>new URL(url).origin===location.origin&&url.includes('/assets/'));
 await until(async()=>{const cached=await caches.match(feedUrl);return cached&&(await cached.text()).includes(generation)},'public generated HTML stored for offline fallback');
 for(const asset of assets)await until(async()=>!!(await caches.match(asset)),'matching generation asset cached '+asset);
 const beforeOffline=frame.contentDocument;
 await (await fetch('/__css_disconnect')).text();
 frame.src='/feed';
 await until(()=>frame.contentDocument!==beforeOffline&&frame.contentDocument.readyState==='complete'&&frame.contentWindow.__engNav?.ready,'actual disconnected navigation replays cached document and bundles');
 assert(frame.contentDocument.querySelector('meta[name="eng-css-generation"]').content===generation&&frame.contentDocument.querySelector('[data-eng-page="feed"]'),'real offline reading retains the matching generated class map');
 document.body.dataset.testResult='passed';result.textContent='PASS readable missing assets, legacy generation bridge, and real disconnected service-worker reading';
}catch(error){document.body.dataset.testResult='failed';result.textContent=error.stack||String(error)}
</script></body></html>"#;

#[derive(Clone)]
struct Proxy {
    target: String,
    client: reqwest::Client,
    counts: Arc<Mutex<BTreeMap<String, usize>>>,
    disconnect: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
}
struct ProxyTask(tokio::task::JoinHandle<()>);
impl Drop for ProxyTask {
    fn drop(&mut self) {
        self.0.abort();
    }
}

async fn forward(State(proxy): State<Proxy>, request: Request<Body>) -> Response {
    let uri = request.uri();
    if uri.path() == "/__css_disconnect" {
        if let Some(sender) = proxy.disconnect.lock().unwrap().take() {
            let _ = sender.send(());
        }
        return (
            StatusCode::OK,
            [(header::CONNECTION, "close")],
            "disconnected",
        )
            .into_response();
    }
    if uri.path() == "/__css_counts" {
        return axum::Json(proxy.counts.lock().unwrap().clone()).into_response();
    }
    let standalone_fixture = matches!(
        uri.path(),
        "/articles/big-personality" | "/unsubscribe" | "/api/newsletter/unsubscribe"
    )
    .then(|| {
        form_urlencoded::parse(uri.query().unwrap_or_default().as_bytes())
            .find(|(key, _)| key == "__css_fixture")
            .map(|(_, value)| value.into_owned())
    })
    .flatten();
    let kind = uri
        .path()
        .strip_prefix("/__css_recovery/")
        .or(standalone_fixture.as_deref());
    if let Some(kind) = kind {
        *proxy
            .counts
            .lock()
            .unwrap()
            .entry(kind.to_owned())
            .or_default() += 1;
    }
    let destination = if kind.is_some_and(|kind| kind.starts_with("personality-")) {
        "/articles/big-personality"
    } else if kind == Some("unsubscribe-result") {
        "/api/newsletter/unsubscribe"
    } else if kind == Some("unsubscribe-get") {
        "/unsubscribe"
    } else if kind.is_some() {
        "/feed"
    } else {
        uri.path_and_query().unwrap().as_str()
    };
    let target = format!("{}{destination}", proxy.target);
    let pending = if kind == Some("unsubscribe-result") {
        // The harness disables live Kit credentials. Inspect the real POST
        // result without replaying a real subscriber mutation.
        proxy
            .client
            .post(target)
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
            .header(header::ACCEPT, "text/html")
            .body("token=fixture-invalid")
    } else {
        proxy.client.get(target)
    };
    let response = pending.send().await.unwrap();
    let status = response.status();
    let mut headers = response.headers().clone();
    headers.remove(header::CONTENT_LENGTH);
    headers.remove(header::TRANSFER_ENCODING);
    headers.remove(header::X_FRAME_OPTIONS);
    if kind.is_some_and(|kind| kind.starts_with("personality-") || kind.starts_with("unsubscribe-"))
    {
        // Keep the actual article script policy. Only framing differs from
        // production so the native fixture can inspect its document.
        let policy = headers[header::CONTENT_SECURITY_POLICY]
            .to_str()
            .unwrap()
            .replace("frame-ancestors 'none'", "frame-ancestors 'self'");
        let script_policy = if kind.is_some_and(|kind| kind.starts_with("personality-")) {
            "script-src 'self' 'wasm-unsafe-eval';"
        } else {
            "script-src 'self';"
        };
        assert!(policy.contains(script_policy));
        assert!(!policy.contains("script-src 'self' 'unsafe-inline'"));
        headers.insert(header::CONTENT_SECURITY_POLICY, policy.parse().unwrap());
    } else {
        headers.insert(header::CONTENT_SECURITY_POLICY, "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; frame-src 'self'; connect-src 'self'; frame-ancestors 'self'".parse().unwrap());
    }
    let bytes = response.bytes().await.unwrap();
    if let Some(kind) = kind {
        let mut html = match kind {
            "legacy" => LEGACY_FEED.to_owned(),
            "compiled" => COMPACT_FEED.to_owned(),
            _ => String::from_utf8(bytes.to_vec()).unwrap(),
        };
        if kind == "alternate" {
            let marker = "<meta name=\"eng-css-generation\" content=\"";
            let start = html.find(marker).unwrap() + marker.len();
            let end = start + html[start..].find('"').unwrap();
            html.replace_range(start..end, "alternating-next-generation");
        }
        let fresh = matches!(kind, "legacy" | "compiled" | "worker");
        if !fresh {
            let script_name = if kind.starts_with("personality-") {
                "article-heroes"
            } else {
                "nav-router"
            };
            if !matches!(kind, "css" | "personality-css") && !kind.starts_with("unsubscribe-") {
                let router = asset_href(&html, &format!("/assets/js/{script_name}."));
                html = html.replace(
                    &router,
                    &format!("/assets/js/{script_name}.000000000000.js"),
                );
            }
            if matches!(
                kind,
                "css" | "both" | "personality-css" | "personality-both" | "alternate"
            ) || kind.starts_with("unsubscribe-")
            {
                let stylesheet_name = if kind.starts_with("personality-") {
                    "article-newsletter"
                } else {
                    "critical"
                };
                let css = asset_href(&html, &format!("/assets/css/{stylesheet_name}."));
                html = html.replace(
                    &css,
                    &format!("/assets/css/{stylesheet_name}.000000000000.css"),
                );
            }
        }
        let setup = match kind {
            "offline" => {
                "<script>Object.defineProperty(navigator,'onLine',{get:()=>false})</script>"
            }
            "storage" => {
                "<script>Object.defineProperty(window,'sessionStorage',{get:()=>{throw new Error('blocked')}})</script>"
            }
            _ => "",
        };
        html = html.replacen("<head>", &format!("<head>{setup}"), 1);
        (status, headers, html).into_response()
    } else {
        (status, headers, bytes).into_response()
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn initial_asset_failure_stays_readable_without_aliasing_compiled_styles() {
    let Some(chrome) = browser::chrome() else {
        assert!(
            std::env::var("REQUIRE_BROWSER_TESTS").is_err(),
            "Chrome is required in CI; set CHROME_BIN"
        );
        return;
    };
    let server = TestServer::start(None).await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let (disconnect, disconnected) = tokio::sync::oneshot::channel();
    let router = axum::Router::new()
        .route("/__css_test", get(|| async { Html(FIXTURE) }))
        .fallback(forward)
        .with_state(Proxy {
            target: format!("http://127.0.0.1:{}", server.port),
            client: reqwest::Client::new(),
            counts: Arc::new(Mutex::new(BTreeMap::new())),
            disconnect: Arc::new(Mutex::new(Some(disconnect))),
        });
    let _proxy = ProxyTask(tokio::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                let _ = disconnected.await;
            })
            .await
            .unwrap()
    }));
    let dom = browser::dump_dom(
        chrome,
        &format!("http://127.0.0.1:{port}/__css_test"),
        false,
    )
    .await;
    assert!(
        dom.contains("data-test-result=\"passed\""),
        "Native coherent asset reading failed: {dom}"
    );
    assert!(!dom.contains("503 Service Unavailable"));
}
