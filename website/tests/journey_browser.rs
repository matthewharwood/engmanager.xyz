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

const FIXTURE: &str = r##"<!doctype html><html><head><meta charset="utf-8"><title>Journey browser checks</title></head><body>
<pre id="result">RUNNING</pre><iframe id="app" title="Journey under test" style="width:1200px;height:900px;border:0"></iframe>
<script type="module">
const frame=document.querySelector('#app'),result=document.querySelector('#result'),checks=[];
const doc=()=>frame.contentDocument,win=()=>frame.contentWindow;
const query=selector=>doc()?.querySelector(selector);
const previous=()=>query('[data-journey-previous]');
const settled=()=>win().__engNav?.ready&&!win().__engNav.busy;
const visible=node=>!!node&&!node.hidden&&win().getComputedStyle(node).display!=='none'&&win().getComputedStyle(node).visibility!=='hidden';
const assert=(value,message)=>{if(!value)throw new Error(message);checks.push(message);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){for(let i=0;i<240;i++){try{if(predicate())return;}catch{}await delay(50);}throw new Error('Timed out: '+label);}
async function scrollSettled(){let last=-1,steady=0;for(let i=0;i<100;i++){await delay(50);const position=win().scrollY;steady=position===last?steady+1:0;if(steady>=5)return;last=position;}throw new Error('Scrolling did not settle');}
async function load(path){frame.src=path;await until(()=>win().location.pathname===path.split('?')[0]&&doc()?.readyState==='complete','load '+path);}
async function ready(path){await load(path);await until(()=>win().__engNav?.ready&&!win().__engNav.busy&&query('[data-journey-current]'),'journey ready '+path);}
async function navigate(path,options={}){const expected=new URL(path,win().location.href).pathname;await win().__engNav.navigate(path,options);await until(()=>win().location.pathname===expected&&query('[data-journey-current]')&&settled(),'navigate '+path);await delay(50);}
async function click(selector,label=selector){if(selector==='[data-close-product]')await until(()=>!query('.is-camera-opening')&&!doc().body.classList.contains('shop-camera-transitioning'),'product camera settles before close');const node=query(selector);assert(node,'action exists: '+label);node.click();await delay(30);}
async function promote(path){await click('[data-journey-promote]','continue to '+path);await until(()=>win().location.pathname===path&&query('[data-journey-current]')&&settled(),'promote '+path);await delay(80);}
async function reveal(){const runway=query('[data-journey-runway]');assert(runway,'next destination has a reveal runway');const rect=runway.getBoundingClientRect();win().scrollTo({top:win().scrollY+rect.top-win().innerHeight*.8,behavior:'instant'});await win().__engNav.prepareNext();await until(()=>query('[data-journey-next]')&&query('[data-journey-promote]')&&!query('[data-journey-promote]').disabled,'next page prepared');}
const article='/articles/the-execution-marketplace';
try{
  await ready('/shop');
  assert(!visible(previous()),'opening the storefront directly has no previous-page window');
  assert(query('[data-product-card]'),'the real embedded catalog is available without Stripe credentials');
  const firstCard=query('[data-product-card]'),productPath=new URL(firstCard.href).pathname;
  firstCard.click();await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='false','direct product opens');
  assert(win().location.pathname===productPath,'product overlay writes the product URL');
  await click('[data-close-product]');await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='true','direct product closes');
  assert(win().location.pathname==='/shop','closing a product restores the same-origin storefront route');
  await ready(productPath);await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='false','hard-loaded product opens');
  assert(!visible(previous()),'opening a product URL directly creates no previous window');
  await click('[data-close-product]');await until(()=>win().location.pathname==='/shop'&&query('[data-product-panel]')?.getAttribute('aria-hidden')==='true','hard-loaded product returns to shop');

  await navigate(article);
  assert(!visible(previous()),'ordinary navigation to an article creates no previous-page window');
  const identity=doc();
  win().scrollTo({top:600,behavior:'instant'});await delay(80);const articleScroll=win().scrollY;
  await navigate('/shop',{source:'reveal'});
  assert(doc()===identity,'reveal promotion keeps the existing document alive');
  await until(()=>visible(previous()),'article previous window');
  assert(previous().textContent.includes('Execution')||previous().querySelector('[data-journey-resume]'),'article window includes a resume control');
  assert(doc().querySelectorAll('[data-journey-previous]').length===1,'exactly one previous window is retained');
  await click('[data-product-card]');await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='false','product opens after reveal');
  assert(!visible(previous()),'product overlay hides the previous-page window');
  await click('[data-close-product]');await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='true'&&visible(previous()),'closing product restores previous window');
  await click('[data-cart-toggle]');await until(()=>query('[data-bag]')?.dataset.bagState==='cart','cart opens');
  assert(!visible(previous()),'cart overlay hides the previous-page window');
  await click('[data-close-bag]');await until(()=>query('[data-bag]')?.dataset.bagState==='closed'&&visible(previous()),'closing cart restores previous window');

  await click('[data-journey-resume]');await until(()=>win().location.pathname===article&&settled(),'resume article');
  await until(()=>Math.abs(win().scrollY-articleScroll)<8,'resume restores article scroll');
  assert(doc()===identity,'resuming the previous page reverses inside the same document');
  await navigate('/shop',{source:'reveal'});await until(()=>visible(previous()),'second previous window');
  await click('[data-journey-dismiss]');await until(()=>!visible(previous()),'dismiss previous');
  assert(win().location.pathname==='/shop','dismissing the previous window preserves the active storefront');

  await navigate(article);await navigate('/shop',{source:'reveal'});await until(()=>visible(previous()),'swipe previous window');
  const swipeRect=previous().getBoundingClientRect(),frameRect=frame.getBoundingClientRect();
  window.__journeyGesture={x:frameRect.left+swipeRect.right-40,y:frameRect.top+swipeRect.top+35};
  await until(()=>!visible(previous()),'swipe dismisses previous');
  assert(win().location.pathname==='/shop','swipe dismissal preserves the current destination');

  await navigate(article);win().scrollTo({top:480,behavior:'instant'});await delay(80);const historyScroll=win().scrollY;
  await navigate('/shop',{source:'reveal'});
  win().history.back();await until(()=>win().location.pathname===article&&query('.article')&&settled(),'browser back restores article');
  await until(()=>Math.abs(win().scrollY-historyScroll)<8,'browser back restores article position');
  win().history.forward();await until(()=>win().location.pathname==='/shop'&&query('[data-shop-grid]')&&settled(),'browser forward restores shop');
  assert(doc()===identity,'browser back and forward preserve the document');

  await navigate(article);
  const headingId=doc().querySelectorAll('.article h2[id]')[1]?.id;
  assert(headingId,'the article has a real deep-link heading');
  await navigate('/shop');await navigate(article+'#'+encodeURIComponent(headingId));
  const heading=doc().getElementById(headingId),headingRect=heading.getBoundingClientRect();
  assert(decodeURIComponent(win().location.hash.slice(1))===headingId,'cross-page navigation preserves the article heading fragment');
  assert(headingRect.top>=0&&headingRect.top<win().innerHeight*.5&&doc().activeElement===heading,'cross-page heading navigation scrolls to and focuses its target');
  for(const width of [1200,686,375,320]){
    frame.style.width=width+'px';await until(()=>win().innerWidth===width,'navigation width '+width);
    await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));
    const navRect=query('.site-nav').getBoundingClientRect(),themeRect=query('[data-theme-cycle]').getBoundingClientRect(),searchRect=query('[data-search-toggle]').getBoundingClientRect();
    const controls=[...doc().querySelectorAll('.site-nav-brand,.nav-dropdown-trigger,.site-nav-links > a,.site-search-toggle,[data-theme-cycle]')].filter(visible).map(node=>node.getBoundingClientRect());
    assert(navRect.left>=0&&navRect.right<=width&&Math.abs(themeRect.left+themeRect.width/2-(navRect.left+navRect.width/2))<2&&searchRect.width>=30,'centered theme and visible search at '+width+'px: '+JSON.stringify({nav:navRect,theme:themeRect,search:searchRect}));
    assert(controls.every((rect,index)=>rect.left>=0&&rect.right<=width&&controls.slice(index+1).every(other=>rect.right<=other.left||other.right<=rect.left)),'navigation controls do not overlap at '+width+'px: '+JSON.stringify(controls));
  }
  assert(!query('[data-search-overlay]').open&&!query('.hunt-chip,.home-search'),'search starts closed and the old floating controls are absent');
  await click('[data-search-toggle]');await until(()=>query('[data-search-overlay]').open&&doc().activeElement===query('.site-search-input'),'search opens and focuses its input');
  const searchInput=query('.site-search-input');
  assert(query('[data-search-form]').dataset.searchBound==='true','the modal search form is bound after soft navigation');
  searchInput.value='execution';searchInput.dispatchEvent(new (win().Event)('input',{bubbles:true}));
  await until(()=>visible(query('[data-search-results]'))&&query('.site-search-result a'),'typeahead results inside the search modal');
  const searchPanel=query('.site-search-panel').getBoundingClientRect();
  assert(searchPanel.left>=0&&searchPanel.right<=320,'search panel fits a small mobile screen');
  await click('[data-search-close]');
  assert(!query('[data-search-overlay]').open&&query('[data-search-toggle]').getAttribute('aria-expanded')==='false','close button dismisses search and resets the trigger');
  await click('[data-search-toggle]');await click('[data-search-overlay]','search backdrop');
  assert(!query('[data-search-overlay]').open,'clicking outside the panel dismisses search');
  frame.style.width='1200px';await until(()=>win().innerWidth===1200,'desktop restored after navigation sizing');
  heading.scrollIntoView({behavior:'instant'});await delay(250);
  const firstHash=win().location.hash,firstHashScroll=win().scrollY;
  const nextHeading=doc().querySelectorAll('.article h2[id]')[2];
  const tocLink=doc().querySelector('.article-toc a[href="#'+nextHeading.id+'"]');
  assert(tocLink,'the article supplies a real native table-of-contents link');tocLink.click();
  await until(()=>win().location.hash==='#'+nextHeading.id&&nextHeading.getBoundingClientRect().top>=0&&nextHeading.getBoundingClientRect().top<win().innerHeight*.5,'native heading link scrolls within the article');
  await scrollSettled();const nextHash=win().location.hash,nextHashScroll=win().scrollY;
  window.__scrollDiagnostic={firstHash,firstHashScroll,nextHash,nextHashScroll};
  win().history.back();await until(()=>win().location.hash===firstHash&&Math.abs(win().scrollY-firstHashScroll)<8,'Back restores the previous same-article heading');
  win().history.forward();await until(()=>win().location.hash===nextHash&&Math.abs(win().scrollY-nextHashScroll)<8,'Forward restores the next same-article heading');
  assert(doc()===identity,'native article heading history stays in the same document');

  if(!win().matchMedia('(prefers-reduced-motion: reduce)').matches){
    await navigate(article);
    const incoming=win().__engNav.navigate('/shop',{source:'reveal'});
    await until(()=>win().location.pathname==='/shop'&&query('[data-journey-current="shop"]')&&win().__engNav.busy,'incoming reveal is still committing');
    win().history.back();await until(()=>win().location.pathname===article,'back during incoming animation');
    win().history.forward();await until(()=>win().location.pathname==='/shop','forward replaces queued back');
    await incoming;await until(()=>settled()&&query('[data-journey-current="shop"]'),'latest traversal settles at the shop');
    await delay(300);
    assert(win().location.pathname==='/shop'&&query('[data-journey-current="shop"]'),'Back then Forward during animation leaves the newest history entry active');
  }

  await navigate(article);await reveal();
  await until(()=>!visible(query('.article-toc'))&&win().getComputedStyle(query('.article-toc')).opacity==='0','table of contents fades during the storefront reveal');
  win().scrollTo({top:0,behavior:'instant'});
  await until(()=>visible(query('.article-toc'))&&win().getComputedStyle(query('.article-toc')).opacity==='1','table of contents returns when scrolling back to the article');
  await reveal();await promote('/shop');
  await until(()=>visible(previous()),'scroll reveal retains article');
  await reveal();await promote('/coach');
  await until(()=>query('[data-reader]')?.dataset.readerReady==='true','coach reader mounts after shop');
  assert(doc().querySelectorAll('[data-journey-previous]').length===1,'coaching replaces the earlier previous page with one storefront window');
  await click('[data-book-open]');await until(()=>query('[data-booking]')?.dataset.bookingState==='calendar','booking sheet opens');
  assert(!visible(previous()),'booking overlay hides the previous-page window');
  await click('[data-booking-close]');await until(()=>query('[data-booking]')?.dataset.bookingState==='closed'&&visible(previous()),'closing booking restores previous window');
  await click('[data-journey-resume]');await until(()=>win().location.pathname==='/shop'&&settled(),'resume storefront');
  assert(!previous()?.textContent.includes('Execution marketplace'),'the ephemeral previous window never retains an article stack');
  await navigate('/coach',{source:'reveal'});await reveal();await promote('/feed');
  assert(doc().body.classList.contains('homepage'),'coaching completes the cycle at the feed');
  await click('[data-journey-resume]');await until(()=>win().location.pathname==='/coach'&&query('[data-reader]')?.dataset.readerReady==='true'&&settled(),'resumed coach reader remounts');
  assert(query('[data-reader-pivot]')?.textContent.length===1,'resumed coaching rebuilds the speed-reader pivot');
  query('[data-reader]').scrollIntoView({behavior:'instant'});await click('[data-reader-mode-option="speed"]');
  if(query('[data-reader]').dataset.readerPlaying!=='true')await click('[data-reader-toggle]');
  const resumedWord=query('[data-reader-word]').textContent;
  await until(()=>query('[data-reader-word]').textContent!==resumedWord,'resumed coaching advances the speed reader');
  await click('[data-reader-toggle]');const pausedWord=query('[data-reader-word]').textContent;
  assert(query('[data-reader]').dataset.readerPlaying==='false','the coach reader can be paused before leaving');
  await navigate('/feed',{source:'reveal'});await click('[data-journey-resume]');
  await until(()=>win().location.pathname==='/coach'&&query('[data-reader]')&&settled(),'paused coaching resumes');
  assert(query('[data-reader]').dataset.readerPlaying==='false'&&query('[data-reader-word]').textContent===pausedWord,'resuming coaching preserves the paused word');
  await delay(600);assert(query('[data-reader-word]').textContent===pausedWord,'a resumed paused reader leaves no running timer');
  await navigate(article);assert(!visible(previous()),'a normal feed-to-article navigation discards the previous window');

  await reveal();await delay(850);
  win().dispatchEvent(new (win().KeyboardEvent)('keydown',{key:'End',bubbles:true}));win().scrollTo({top:doc().documentElement.scrollHeight,behavior:'instant'});
  await until(()=>win().location.pathname==='/shop'&&query('[data-shop-grid]')&&settled(),'scrolling through the revealed page promotes the storefront');
  assert(doc()===identity,'scroll promotion preserves the active document');

  win().localStorage.setItem('engmanager.theme','dark');
  win().dispatchEvent(new (win().StorageEvent)('storage',{key:'engmanager.theme',newValue:'dark'}));
  await navigate('/shop',{source:'reveal'});
  assert(doc().documentElement.dataset.theme==='dark','theme survives a journey promotion');
  const reduced=win().matchMedia('(prefers-reduced-motion: reduce)').matches;
  assert(reduced===new URL(location.href).searchParams.has('reduced'),'the test exercises its actual browser motion preference');
  if(reduced){
    window.__journeyKey='Tab';await until(()=>!window.__journeyKey,'real keyboard input enables focus visibility');
    query('[data-product-card]').focus({preventScroll:true});
    assert(query('[data-product-card]').matches(':focus-visible'),'the reduced-motion check exercises visible keyboard focus');
    const scaling=doc().getAnimations().filter(animation=>animation.effect?.getKeyframes().some(key=>String(key.transform||'').includes('scale'))&&animation.playState==='running');
    assert(!scaling.length,'reduced motion leaves no running scale transition: '+JSON.stringify(scaling.map(animation=>({target:animation.effect.target?.outerHTML.slice(0,240),name:animation.animationName,keyframes:animation.effect.getKeyframes(),timing:animation.effect.getComputedTiming()}))));
    assert(win().getComputedStyle(query('[data-product-card]')).transform==='none','reduced-motion keyboard focus does not scale a product card');
    assert(win().getComputedStyle(query('[data-product-card]')).transitionProperty==='none','reduced-motion cards do not create a transform transition');
  }
  frame.style.width='390px';await until(()=>win().innerWidth===390,'mobile viewport');
  await until(()=>visible(previous()),'mobile previous window');
  const mobile=previous().getBoundingClientRect();
  assert(mobile.left>=0&&mobile.right<=390&&mobile.height<=win().innerHeight*.5,'previous window fits the mobile viewport');
  assert(doc().documentElement.scrollWidth<=win().innerWidth,'mobile journey has no horizontal page overflow');
  frame.style.width='320px';await until(()=>win().innerWidth===320,'small mobile viewport');
  assert(doc().documentElement.scrollWidth<=win().innerWidth,'small mobile journey has no horizontal overflow');
  frame.style.width='1200px';await until(()=>win().innerWidth===1200,'desktop viewport restored');

  for(let index=0;index<3;index++){
    await navigate('/coach');await until(()=>query('[data-reader]')?.dataset.readerReady==='true','repeat coach mount');
    await navigate('/shop');await click('[data-product-card]');await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='false','repeat product mount');
    await click('[data-close-product]');await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='true','repeat product close');
    assert(doc().querySelectorAll('[data-product-panel]').length===1&&doc().querySelectorAll('[data-journey-current]').length===1,'repeated mounts retain one live shop and one current outlet');
  }

  await navigate(article);
  const actualFetch=win().fetch.bind(win());
  let releaseFetch,started=false;
  win().fetch=(input,options)=>new URL(input?.url||String(input),win().location.href).pathname==='/shop'?new Promise((resolve,reject)=>{started=true;releaseFetch=()=>actualFetch(input,options).then(resolve,reject);options?.signal?.addEventListener('abort',()=>reject(new DOMException('Superseded','AbortError')),{once:true});}):actualFetch(input,options);
  const superseded=win().__engNav.navigate('/shop').catch(()=>{});await until(()=>started,'delayed navigation starts');
  await navigate('/coach');releaseFetch();await superseded;await delay(150);
  assert(win().location.pathname==='/coach'&&query('[data-reader]'),'a superseded fetch cannot overwrite the newer destination');
  win().fetch=actualFetch;

  await navigate(article);
  win().fetch=(input,options)=>new URL(input?.url||String(input),win().location.href).pathname==='/shop'?Promise.reject(new TypeError('Synthetic offline failure')):actualFetch(input,options);
  await win().__engNav.prepareNext();
  assert(win().location.pathname===article&&query('.article'),'a failed next-page fetch preserves readable article content');
  win().fetch=actualFetch;

  for(const path of ['/','/feed']){
    await navigate(path);
    assert(!query('.home-search,.hunt-chip')&&doc().querySelectorAll('[data-theme-cycle]').length===1,'feed chrome uses a single nav theme control without floating search or API buttons: '+path);
    await click('[data-search-toggle]');await until(()=>query('[data-search-overlay]').open,'feed search opens: '+path);
    await click('[data-search-close]');
  }
  win().localStorage.removeItem('engmanager.discoveries');
  await ready('/feed?receipt');
  assert(!query('#api-receipt-modal').matches(':popover-open'),'the former receipt URL does not open the easter egg');
  await until(()=>query('[data-api-receipt-grid]')?.children.length>0,'discovery registry initializes');
  await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));
  win().dispatchEvent(new (win().KeyboardEvent)('keydown',{key:'?',bubbles:true}));
  await until(()=>query('.discovery-toast-open'),'keyboard discovery presents a toast action');
  assert(!query('#api-receipt-modal').matches(':popover-open'),'a discovery does not open the receipt automatically');
  const openedToast=query('.discovery-toast');await click('.discovery-toast-open');
  assert(query('#api-receipt-modal').matches(':popover-open'),'the toast action opens the API receipt');
  await click('.api-receipt-close');
  await until(()=>query('.discovery-toast')&&query('.discovery-toast')!==openedToast,'another discovery offers its own toast');
  const expiringToast=query('.discovery-toast');
  await until(()=>!expiringToast.isConnected,'discovery actions expire with their toasts');
  assert(!query('#api-receipt-modal').matches(':popover-open'),'expired discovery toasts leave the receipt closed');

  const publicDocument=doc();await win().__engNav.navigate('/articles/big-personality');
  await until(()=>win().location.pathname==='/articles/big-personality'&&doc().readyState==='complete','private boundary navigation');
  assert(doc()!==publicDocument,'entering the private personality experience starts a separate document');
  assert(!query('[data-journey-current],[data-journey-next],[data-journey-previous]'),'private personality introduction stays outside the journey outlets');
  assert(!win().__engNav?.navigate,'private personality document does not load the public router');
  result.textContent='PASS\n'+checks.join('\n');document.body.dataset.testResult='passed';
}catch(error){result.textContent='FAIL\n'+error.stack+'\nURL: '+win()?.location.href+'\nSCROLL: '+win()?.scrollY+' '+JSON.stringify(window.__scrollDiagnostic||{})+'\nHISTORY: '+JSON.stringify(win()?.history.state)+'\nRECENT CHECKS:\n'+checks.slice(-10).join('\n');document.body.dataset.testResult='failed';}
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
        Ok(bytes) => (status, headers, bytes).into_response(),
        Err(error) => (StatusCode::BAD_GATEWAY, error.to_string()).into_response(),
    }
}

async fn exercise_journey(reduced_motion: bool) {
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
        .route("/__journey_test", get(|| async { Html(FIXTURE) }))
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
        &format!("http://127.0.0.1:{port}/__journey_test{suffix}"),
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
        "Journey browser checks did not pass:\n{diagnostic}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn journey_navigation_preserves_history_overlays_and_privacy() {
    exercise_journey(false).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn journey_navigation_respects_reduced_motion() {
    exercise_journey(true).await;
}
