//! Real Chrome coverage for persisted global article pagination and its last act.

#[path = "common/browser.rs"]
mod browser;
mod common;

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode, header};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::get;
use common::TestServer;

static BROWSER_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

struct ProxyTask(tokio::task::JoinHandle<()>);
impl Drop for ProxyTask {
    fn drop(&mut self) {
        self.0.abort();
    }
}

const FIXTURE: &str = r##"<!doctype html><html><head><meta charset="utf-8"><title>Reading cycle checks</title></head><body>
<pre id="result">RUNNING</pre><iframe id="app" title="Reading cycle under test" style="width:1200px;height:900px;border:0"></iframe>
<script type="module">
const frame=document.querySelector('#app'),result=document.querySelector('#result'),checks=[];
const doc=()=>frame.contentDocument,win=()=>frame.contentWindow,query=selector=>doc()?.querySelector(selector);
const settled=()=>win().__engNav?.ready&&!win().__engNav.busy;
const visible=node=>!!node&&!node.hidden&&win().getComputedStyle(node).display!=='none'&&win().getComputedStyle(node).visibility!=='hidden';
const assert=(condition,message)=>{if(!condition)throw new Error(message);checks.push(message);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){const deadline=performance.now()+12000;while(performance.now()<deadline){if(predicate())return;await delay(40);}throw new Error('Timed out: '+label);}
async function hard(path){const old=doc();frame.src=path;await until(()=>doc()!==old&&win().location.pathname===path.split('?')[0]&&doc().readyState==='complete'&&settled(),'hard load '+path);}
async function navigate(path){await win().__engNav.navigate(path);await until(()=>win().location.pathname===path&&settled(),'navigate '+path);}
async function reveal(){const runway=query('[data-journey-runway]');assert(runway,'a next article or surface has a scroll runway');const rect=runway.getBoundingClientRect();win().scrollTo({top:win().scrollY+rect.top-win().innerHeight*.75,behavior:'instant'});await until(()=>visible(query('[data-journey-next][data-preview-ready]')),'scroll reveals a ready poster');
  if(query('[data-journey-current="feed"]')){
    assert(!visible(query('.trash'))&&!visible(query('.avatar-button')),'feed controls yield to the revealed article cover');
    const link=query('[data-journey-promote]'),box=link.getBoundingClientRect(),hit=doc().elementFromPoint(box.left+12,box.top+box.height/2);
    assert(hit?.closest('[data-journey-promote]')===link,'the left side of Continue remains unobscured on mobile');
  }
}
async function promote(path){const link=query('[data-journey-promote]');assert(link&&new URL(link.href).pathname===path,'Continue points to '+path);link.click();await until(()=>win().location.pathname===path&&settled(),'promote '+path);}
async function articleBottom(slug){const article=query('[data-article-slug="'+slug+'"]');assert(article,'the intended article is mounted');const rect=article.getBoundingClientRect();win().scrollTo({top:win().scrollY+rect.bottom-win().innerHeight+20,behavior:'instant'});await until(()=>win().__engReading.snapshot().completed.includes(slug),'actual article bottom completes '+slug);}
async function fonts(){const typography=win().__engTypography;if(typography){await typography.ready;await typography.displayReady;}else await doc().fonts.ready;}
async function stableGeometry(nodes){
  const sizes=new Map(),events=[];let epoch=0,previous=-1,stable=0,facesReady=false,fontError;
  const record=(kind,detail={})=>{epoch++;events.push({kind,time:performance.now(),...detail});if(events.length>64)events.shift();};
  const observer=new (win().ResizeObserver)(entries=>{for(const entry of entries){sizes.set(entry.target,[entry.contentRect.width,entry.contentRect.height]);record('resize-observer',{node:nodes.indexOf(entry.target),size:sizes.get(entry.target)});}});
  const changed=event=>record(event.type,{detail:event.detail});
  const types=['engmanager:fontchange','resize'];for(const type of types)win().addEventListener(type,changed);
  const fontTypes=['loading','loadingdone','loadingerror'];for(const type of fontTypes)doc().fonts.addEventListener(type,changed);
  const dispose=()=>{observer.disconnect();for(const type of types)win().removeEventListener(type,changed);for(const type of fontTypes)doc().fonts.removeEventListener(type,changed);};
  nodes.forEach(node=>observer.observe(node));fonts().then(()=>{facesReady=true;record('managed-fonts-ready');},error=>{fontError=error;});
  const deadline=performance.now()+12000;
  try{
    while(performance.now()<deadline){
      await new Promise(resolve=>win().requestAnimationFrame(resolve));
      if(fontError)throw fontError;
      stable=facesReady&&doc().fonts.status==='loaded'&&sizes.size===nodes.length&&epoch===previous?stable+1:0;
      previous=epoch;
      if(stable>=6)return {events,dispose};
    }
    throw new Error('Geometry did not become stable: '+JSON.stringify({facesReady,fontStatus:doc().fonts.status,sizes:[...sizes.values()],events}));
  }catch(error){dispose();throw error;}
}
async function titleFits(width,title){frame.style.width=width+'px';await until(()=>win().innerWidth===width,'article cover width '+width);await fonts();await until(()=>{const h=query('.journey-poster-title-article');return h&&h.style.fontSize&&h.scrollWidth<=h.clientWidth+1&&h.scrollHeight<=h.clientHeight+1;},'full title fits at '+width);const h=query('.journey-poster-title-article');assert(h.textContent===title,'the cover preserves the complete article title at '+width);assert(doc().documentElement.scrollWidth<=width+1,'article cover has no horizontal overflow at '+width);}
async function nativeKey(node,key){node.focus({preventScroll:true});assert(doc().activeElement===node,'cleanup action receives keyboard focus');window.__journeyKey=key;await until(()=>!window.__journeyKey,'native '+key+' dispatched');}
async function nativeDrop(node){node.scrollIntoView({block:'center',behavior:'instant'});await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));const start=node.getBoundingClientRect(),bin=query('.trash-can').getBoundingClientRect(),outer=frame.getBoundingClientRect();assert(start.width>0&&start.height>0&&start.top>=0&&start.bottom<=win().innerHeight,'native drag begins on an onscreen control');window.__journeyGesture={x:outer.left+start.left+start.width/2,y:outer.top+start.top+start.height/2,toX:outer.left+bin.left+bin.width/2,toY:outer.top+bin.top+bin.height/2};await until(()=>!window.__journeyGesture,'native pointer drop dispatched');}
try{
  await hard('/');
  const roster=win().__journeyArticles.articles,first=roster[0],second=roster[1],last=roster.at(-1);
  assert(roster.length>2&&roster.every(article=>article.slug!=='big-personality'),'global pagination uses the eligible public roster');
  assert(query('[data-journey-current="feed"]').dataset.engNext===first.path,'homepage starts at the latest article');
  const tail=query('.feed-afterword').getBoundingClientRect();
  assert(tail.height>=win().innerHeight*.49,'homepage adds at least half a viewport before the curtain');
  assert(query('[data-journey-curtain]'),'homepage ends in the shared rag curtain');
  const identity=doc();
  await navigate(first.path);
  assert(win().__engReading.snapshot().completed.length===0,'opening an article alone does not advance global pagination');

  // Start a cold feed with the article HTML fetch deliberately stalled. Its
  // own cover must appear from local metadata and still work after failure.
  frame.style.width='390px';
  const actualFetch=win().fetch.bind(win());let rejectPrefetch,prefetchStarted=false;
  win().fetch=(input,options)=>new URL(input?.url||String(input),win().location.href).pathname===first.path?new Promise((resolve,reject)=>{prefetchStarted=true;rejectPrefetch=()=>reject(new TypeError('Deliberately stalled article prefetch failed'));options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});}):actualFetch(input,options);
  await navigate('/feed');await reveal();
  await until(()=>prefetchStarted,'automatic article prefetch starts');
  assert(query('[data-journey-current="feed"]').dataset.engNext===first.path,'feed still selects the unread first article');
  const poster=query('[data-journey-next="article"]'),still=poster.querySelector('.journey-poster-art img');
  await still.decode();
  assert(still.complete&&still.naturalWidth>0&&visible(poster),'the carved folio remains visible while article HTML stalls');
  win().scrollTo({top:0,behavior:'instant'});
  await until(()=>!doc().body.classList.contains('journey-revealing'),'scrolling back closes the article cover');
  assert(visible(query('.trash'))&&visible(query('.avatar-button')),'returning to the feed restores its controls');
  await reveal();
  await titleFits(390,first.title);await titleFits(320,first.title);
  rejectPrefetch();await until(()=>query('[data-journey-runway]').dataset.failed==='true','failed prefetch offers Continue');
  assert(visible(poster)&&still.naturalWidth>0,'failed article fetch retains the complete cover');
  win().fetch=actualFetch;
  await promote(first.path);
  assert(win().__engReading.snapshot().completed.length===0,'entering through Continue still requires reading to the bottom');
  await articleBottom(first.slug);
  // Once read, the reveal's hot scroll path must not query page geometry or
  // revisit synchronous progress storage on each subsequent touch frame.
  const readArticle=query('[data-article-slug="'+first.slug+'"]'),readRunway=query('[data-journey-runway]');
  const geometry=await stableGeometry([query('[data-journey-current]'),readArticle]);
  const articleRect=readArticle.getBoundingClientRect,runwayRect=readRunway.getBoundingClientRect,complete=win().__engReading.complete;
  let geometryReads=0,repeatReads=0;const reads=[];
  const measured=(node,original)=>{geometryReads++;const rect=original.call(node);reads.push({node:node===readArticle?'article':'runway',time:performance.now(),width:rect.width,height:rect.height,stack:new Error().stack});return rect;};
  readArticle.getBoundingClientRect=function(){return measured(this,articleRect);};
  readRunway.getBoundingClientRect=function(){return measured(this,runwayRect);};
  win().__engReading.complete=function(...args){repeatReads++;return complete.apply(this,args);};
  try{
    for(let i=0;i<12;i++){win().scrollBy({top:2,behavior:'instant'});await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));}
    assert(geometryReads===0,'stable article reveal frames reuse measured geometry: '+JSON.stringify({geometryReads,reads,events:geometry.events,fontStatus:doc().fonts.status}));
    assert(repeatReads===0,'an already-read article never touches completion storage during reveal frames');
  }finally{delete readArticle.getBoundingClientRect;delete readRunway.getBoundingClientRect;win().__engReading.complete=complete;geometry.dispose();}
  await reveal();await promote('/shop');
  await reveal();await promote('/coach');
  await reveal();await promote('/subscribe');
  await reveal();await promote('/feed');
  assert(doc()===identity,'article, shop, coaching, newsletter and feed retain the same document');
  assert(query('[data-journey-current="feed"]').dataset.engNext===second.path,'the completed lap advances to the second article');

  await hard('/feed');
  assert(query('[data-journey-current="feed"]').dataset.engNext===second.path,'a real reload preserves the second destination');
  win().localStorage.setItem('engmanager.visited-articles',JSON.stringify(roster.map(article=>article.slug)));
  await hard('/feed');
  assert(query('[data-journey-current="feed"]').dataset.engNext===second.path&&win().__engReading.snapshot().completed.length===1,'clicked history cannot skip unfinished articles after reload');

  // Save-Data has a sculpture and an explicit working Continue, but no
  // article HTML prefetch or glTF download before that action.
  await navigate('/shop');
  const connectionDescriptor=Object.getOwnPropertyDescriptor(win().navigator,'connection');
  Object.defineProperty(win().navigator,'connection',{configurable:true,value:{saveData:true}});
  const lowFetch=win().fetch.bind(win()),requests=[];
  win().fetch=(input,options)=>{const path=new URL(input?.url||String(input),win().location.href).pathname;requests.push(path);return lowFetch(input,options);};
  frame.style.width='390px';await navigate('/feed');await reveal();
  const lowPoster=query('[data-journey-next="article"]'),lowStill=lowPoster.querySelector('img');await lowStill.decode();
  assert(lowStill.naturalWidth>0&&!lowPoster.querySelector('.journey-poster-art').hasAttribute('data-rendered'),'mobile Save-Data uses the folio still');
  assert(!requests.some(path=>path===second.path||path.endsWith('.glb')),'Save-Data does not prefetch article HTML or download models');
  await titleFits(320,second.title);await promote(second.path);
  assert(requests.includes(second.path),'Save-Data Continue loads the requested article');
  await articleBottom(second.slug);
  win().fetch=lowFetch;
  if(connectionDescriptor)Object.defineProperty(win().navigator,'connection',connectionDescriptor);else delete win().navigator.connection;

  // Unit tests cover every state transition. Seed the prior completed reads
  // here so this browser checks the real final read and all cleanup controls.
  win().localStorage.setItem('engmanager.reading-progress.v1',JSON.stringify({version:1,completed:roster.slice(0,-1).map(article=>article.slug)}));
  await hard('/feed');
  assert(query('[data-journey-current="feed"]').dataset.engNext===last.path,'the final unread essay is selected after reload');
  await reveal();await promote(last.path);await articleBottom(last.slug);await navigate('/feed');
  const panel=query('[data-reading-completion]');
  assert(visible(panel)&&panel.dataset.stage==='articles'&&panel.textContent.includes('Congratulations'),'the actual final read unlocks congratulations');
  assert(!query('[data-journey-current]').hasAttribute('data-eng-next')&&!query('[data-journey-runway]')&&!query('[data-journey-curtain]'),'a completed feed has no empty next reveal or rag');
  const firstRow=query('.article-fluid-link:not([data-trashed])');
  await nativeDrop(firstRow.querySelector('.article-check'));
  await until(()=>firstRow.dataset.trashed==='true','native article checkbox drop reaches the bin');
  assert(win().__engReadingCompletion.snapshot().articles.length===1&&query('[data-trash-count]').textContent==='1','native drop records exactly one discarded article');
  for(const row of [...doc().querySelectorAll('.article-fluid-link:not([data-trashed])')]){await nativeKey(row,'Delete');await until(()=>row.dataset.trashed==='true','keyboard article discard');}
  assert(query('[data-reading-completion]').dataset.stage==='tags'&&query('[data-reading-completion-title]').textContent.includes('finish the job'),'discarding every article unlocks tag cleanup');
  await hard('/feed');
  assert(query('[data-reading-completion]').dataset.stage==='tags'&&[...doc().querySelectorAll('.article-fluid-link')].every(row=>row.dataset.trashed==='true'),'article cleanup and the tag stage survive reload');
  const firstTag=query('[data-reading-completion-tags] .chip-tag'),tagId=firstTag.dataset.chipId;
  await nativeDrop(firstTag);
  await until(()=>win().__engReadingCompletion.snapshot().tags.includes(tagId),'native stationary tag drop reaches the bin');
  assert([...doc().querySelectorAll('[data-chip-id="'+tagId+'"]')].every(chip=>chip.dataset.trashed==='true'),'tag cleanup conceals every marquee copy');
  while(query('[data-reading-completion-tags] .chip-tag')){const tag=query('[data-reading-completion-tags] .chip-tag'),id=tag.dataset.chipId;await nativeKey(tag,'Enter');await until(()=>win().__engReadingCompletion.snapshot().tags.includes(id),'keyboard tag discard');}
  assert(query('[data-reading-completion]').dataset.stage==='finished'&&query('[data-reading-completion-title]').textContent==='A clean slate.','all articles and tags finish on a clean slate');
  query('[data-reading-completion-reset]').click();
  await until(()=>!visible(query('[data-reading-completion]'))&&query('[data-journey-current]').dataset.engNext===first.path,'restart restores the first destination');
  assert(win().__engReading.snapshot().completed.length===0&&win().__engReadingCompletion.snapshot().articles.length===0&&win().__engReadingCompletion.snapshot().tags.length===0,'restart clears reading and cleanup progress together');
  assert([...doc().querySelectorAll('.article-fluid-link,.marquee .chip-tag')].every(node=>node.dataset.trashed!=='true')&&query('[data-trash-count]').textContent==='0'&&query('[data-journey-curtain]'),'restart restores rows, tag copies, bin and rag');
  result.textContent='PASS\n'+checks.join('\n');document.body.dataset.testResult='passed';
}catch(error){result.textContent='FAIL\n'+error.stack+'\nURL: '+win()?.location.href+'\nREADING: '+JSON.stringify(win()?.__engReading?.snapshot())+'\nCLEANUP: '+JSON.stringify(win()?.__engReadingCompletion?.snapshot())+'\nRECENT CHECKS:\n'+checks.slice(-12).join('\n');document.body.dataset.testResult='failed';}
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
    headers.insert(header::CONTENT_SECURITY_POLICY, "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; frame-src 'self'; connect-src 'self'; frame-ancestors 'self'".parse().unwrap());
    match response.bytes().await {
        Ok(bytes) => (status, headers, bytes).into_response(),
        Err(error) => (StatusCode::BAD_GATEWAY, error.to_string()).into_response(),
    }
}

async fn exercise_reading_cycle(reduced_motion: bool) {
    let _guard = BROWSER_LOCK.lock().await;
    let Some(chrome) = browser::chrome() else {
        assert!(
            std::env::var("REQUIRE_BROWSER_TESTS").is_err(),
            "Chrome is required in CI; set CHROME_BIN"
        );
        eprintln!("skipping reading cycle browser test: Chrome not found");
        return;
    };
    let server = TestServer::start(None).await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("reading test proxy port");
    let port = listener.local_addr().unwrap().port();
    let router = axum::Router::new()
        .route("/__reading_test", get(|| async { Html(FIXTURE) }))
        .fallback(forward)
        .with_state(Proxy {
            target: format!("http://127.0.0.1:{}", server.port),
            client: reqwest::Client::new(),
        });
    let _proxy = ProxyTask(tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap()
    }));
    let dom = browser::dump_dom_with_webgl(
        chrome,
        &format!("http://127.0.0.1:{port}/__reading_test"),
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
        "Reading cycle browser checks did not pass:\n{diagnostic}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn reading_cycle_preserves_progress_and_finishes_cleanup() {
    exercise_reading_cycle(false).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn reading_cycle_respects_reduced_motion() {
    exercise_reading_cycle(true).await;
}
