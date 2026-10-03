//! Exercises the actual unread-article popover and its native WebGL renderer.
//! The startup probe observes real uniform/draw calls; only the dedicated
//! unavailable-WebGL variant replaces context creation with a null result.

#[path = "common/browser.rs"]
mod browser;
mod common;

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode, header};
use axum::response::{IntoResponse, Response};
use common::TestServer;

static BROWSER_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

struct ProxyTask(tokio::task::JoinHandle<()>);
impl Drop for ProxyTask {
    fn drop(&mut self) {
        self.0.abort();
    }
}

const STARTUP_PROBE: &str = r##"<script>
localStorage.setItem('engmanager.theme','light');
localStorage.removeItem('engmanager.visited-articles');
const unavailable=new URLSearchParams(location.search).has('no_webgl');
const realContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(kind,...args){
  if(unavailable&&['webgl','webgl2','experimental-webgl'].includes(kind))return null;
  const gl=realContext.call(this,kind,...args);
  if(kind==='webgl2'&&gl&&!this.__clothProbe){
    const probe=this.__clothProbe={gl,times:[],draws:0};
    const locations=new Set(),getLocation=gl.getUniformLocation.bind(gl),uniform=gl.uniform1f.bind(gl);
    gl.getUniformLocation=(program,name)=>{const location=getLocation(program,name);if(name==='u_time'&&location)locations.add(location);return location;};
    gl.uniform1f=(location,value)=>{if(locations.has(location))probe.times.push(value);return uniform(location,value);};
    for(const name of ['drawArrays','drawElements']){const draw=gl[name].bind(gl);gl[name]=(...values)=>{const result=draw(...values);probe.draws++;return result;};}
  }
  return gl;
};
</script>"##;

const FIXTURE: &str = r##"<script type="module">
const result=document.querySelector('#result'),checks=[];
const unavailable=new URLSearchParams(location.search).has('no_webgl');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const query=selector=>document.querySelector(selector);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,message)=>{if(!value)throw Error(message);checks.push(message);result.textContent='RUNNING\n'+checks.slice(-8).join('\n');};
async function until(predicate,label){for(let i=0;i<200;i++){if(predicate())return;await delay(40);}throw Error('Timed out: '+label);}
async function open(link){link.focus();link.click();await until(()=>query('#article-reveal')?.matches(':popover-open'),'unread article reveal opens');await until(()=>query('[data-reveal-continue]')===document.activeElement,'Read receives focus');return query('.reveal-card-frame');}
async function closed(frame,canvas){query('.reveal-card-close').click();await until(()=>!query('#article-reveal').matches(':popover-open'),'close dismisses reveal');await delay(80);const draws=canvas.__clothProbe?.draws||0;await delay(180);assert((canvas.__clothProbe?.draws||0)===draws,'closed popover stops shader drawing');assert(frame.dataset.clothMotion!=='running','closed popover clears its running state');}
try{
  await until(()=>document.readyState==='complete'&&window.__engNav?.ready&&!window.__engNav.busy&&query('.article-fluid-link'),'homepage and router ready');
  await window.__engTypography?.displayReady;await window.__engTypography?.ready;
  const link=query('.article-fluid-link[data-slug="project-foottraffic"]')||query('.article-fluid-link');
  const slug=link.dataset.slug,href=link.href,frame=await open(link),canvas=frame.querySelector('.reveal-card-cloth');
  assert(location.pathname==='/feed','unread reveal keeps the reader on the feed');
  assert(link.classList.contains('is-visited')&&JSON.parse(localStorage.getItem('engmanager.visited-articles')).includes(slug),'unread click persists visited state before the reveal');
  assert(query('[data-reveal-continue]').href===href&&query('[data-reveal-title]').textContent.trim().length>3,'reveal populates the article and its Read destination');
  assert(canvas?.getAttribute('aria-hidden')==='true'&&getComputedStyle(canvas).pointerEvents==='none','shader canvas is decorative and leaves DOM controls interactive');
  const read=query('[data-reveal-continue]'),rect=read.getBoundingClientRect();
  assert(read.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)),'visible Read action remains the pointer hit target');
  if(unavailable){
    assert(frame.dataset.clothRenderer!=='webgl'&&!canvas.__clothProbe,'unavailable WebGL leaves the CSS surface and live article controls usable');
    const paper=getComputedStyle(frame,'::after'),shadow=getComputedStyle(frame).filter;
    assert(paper.display!=='none'&&paper.backgroundColor!=='rgba(0, 0, 0, 0)'&&paper.clipPath.startsWith('polygon(')&&shadow.includes('drop-shadow('),'CSS fallback preserves visible ragged paper and its solid offset shadow');
  }else{
    await until(()=>frame.dataset.clothRenderer==='webgl'&&canvas.__clothProbe?.draws>0,'native cloth shader draws');
    const probe=canvas.__clothProbe;
    assert(probe.gl.getError()===probe.gl.NO_ERROR,'native shader renders without WebGL errors');
    if(reduced){
      await until(()=>frame.dataset.clothMotion==='still','reduced-motion still frame');
      await delay(160);const draws=probe.draws,time=probe.times.at(-1);await delay(200);
      assert(probe.draws===draws&&probe.times.at(-1)===time,'reduced motion paints a still cloth without a recurring shader loop');
    }else{
      await until(()=>frame.dataset.clothMotion==='running'&&new Set(probe.times).size>1,'open cloth advances shader time');
      assert(true,'open cloth advances native shader time');
      const palette=()=>{const program=probe.gl.getParameter(probe.gl.CURRENT_PROGRAM);return Array.from(probe.gl.getUniform(program,probe.gl.getUniformLocation(program,'u_paper'))).join(',');};
      const paper=palette();query('[data-theme-cycle]').click();
      await until(()=>palette()!==paper,'cloth follows the selected theme palette');
      assert(true,'theme change updates the native shader paper color');
      const extension=probe.gl.getExtension('WEBGL_lose_context');
      assert(extension,'Chrome exposes native context loss and restoration');
      extension.loseContext();
      await until(()=>frame.dataset.clothRenderer!=='webgl'&&frame.dataset.clothMotion==='paused','context loss restores the CSS surface');
      assert(getComputedStyle(frame,'::after').display!=='none','context loss restores readable CSS paper');
      const before=probe.times.length;extension.restoreContext();
      await until(()=>frame.dataset.clothRenderer==='webgl'&&frame.dataset.clothMotion==='running'&&new Set(probe.times.slice(before)).size>1,'restored context resumes native shader animation');
      assert(probe.gl.getError()===probe.gl.NO_ERROR,'restored native context renders without WebGL errors');
    }
  }
  await closed(frame,canvas);

  window.__journeyViewport=320;await until(()=>innerWidth===320,'320px mobile viewport');
  const mobileLink=[...document.querySelectorAll('.article-fluid-link')].find(node=>!node.classList.contains('is-visited'));
  const mobileFrame=await open(mobileLink),content=mobileFrame.querySelector('.reveal-card-content');
  const mobileRead=query('[data-reveal-continue]'),mobileClose=query('.reveal-card-close');
  assert(content&&!content.contains(mobileRead)&&!content.contains(mobileClose),'article copy scrolls independently of the fixed Close and Read controls');
  const summary=query('[data-reveal-summary]');summary.textContent=(summary.textContent+' ').repeat(12);
  await delay(650);
  const bounds=mobileFrame.getBoundingClientRect();
  assert(bounds.left>=-1&&bounds.right<=321,'cloth modal fits a 320px mobile viewport');
  assert(mobileFrame.scrollWidth<=mobileFrame.clientWidth+1,'shader overscan does not expand the interactive card scroll width');
  const mobilePopover=query('#article-reveal');mobilePopover.scrollLeft=640;
  assert(mobilePopover.scrollWidth<=mobilePopover.clientWidth+1&&Math.abs(mobilePopover.scrollLeft)<1,'shader cloth and shadow do not make the mobile popover horizontally scrollable');
  assert(content.scrollWidth<=content.clientWidth+1,'long reveal content does not cause horizontal overflow');
  assert(['auto','scroll'].includes(getComputedStyle(content).overflowY)&&content.scrollHeight>content.clientHeight,'long reveal content uses native vertical scrolling');
  const controlFits=node=>{
    const control=node.getBoundingClientRect(),card=mobileFrame.getBoundingClientRect();
    return control.left>=Math.max(0,card.left)-1&&control.right<=Math.min(innerWidth,card.right)+1&&
      control.top>=Math.max(0,card.top)-1&&control.bottom<=Math.min(innerHeight,card.bottom)+1;
  };
  assert(controlFits(mobileRead)&&controlFits(mobileClose),'Close and Read remain visible without scrolling the long article copy');
  const readTop=mobileRead.getBoundingClientRect().top,closeTop=mobileClose.getBoundingClientRect().top;
  // Sample synchronously so ongoing cloth motion cannot masquerade as a
  // control moving with the independently scrolling article copy.
  content.scrollTop=content.scrollHeight;
  assert(content.scrollTop>0&&controlFits(mobileRead)&&controlFits(mobileClose)&&
    Math.abs(mobileRead.getBoundingClientRect().top-readTop)<1&&Math.abs(mobileClose.getBoundingClientRect().top-closeTop)<1,
    'scrolling article copy leaves Close and Read visible at their fixed positions');
  query('.reveal-card-dismiss').click();await until(()=>!query('#article-reveal').matches(':popover-open'),'Nahhh dismisses through the live DOM action');

  if(!unavailable&&!reduced){
    const outgoing=mobileFrame,oldProbe=mobileFrame.querySelector('.reveal-card-cloth').__clothProbe;
    await window.__engNav.navigate('/articles/project-foottraffic');
    await until(()=>location.pathname==='/articles/project-foottraffic'&&!window.__engNav.busy,'soft navigation to article');
    await delay(100);const draws=oldProbe.draws;await delay(150);
    assert(!outgoing.isConnected&&oldProbe.draws===draws,'soft navigation disposes the removed cloth surface');
    await window.__engNav.navigate('/feed');
    await until(()=>location.pathname==='/feed'&&!window.__engNav.busy&&query('#article-reveal'),'soft navigation back to feed');
    // The personality article crosses a private full-document boundary;
    // this assertion needs an ordinary article's soft-navigation lifecycle.
    const unread=[...document.querySelectorAll('.article-fluid-link')].find(node=>!node.classList.contains('is-visited')&&node.dataset.slug!=='big-personality');
    assert(unread,'an ordinary unread article is available for soft navigation');
    const fresh=await open(unread),freshCanvas=fresh.querySelector('.reveal-card-cloth');
    await until(()=>fresh.dataset.clothRenderer==='webgl'&&new Set(freshCanvas.__clothProbe?.times||[]).size>1,'remounted cloth shader runs');
    assert(fresh!==outgoing,'returning to feed mounts a fresh cloth surface');
    const destination=new URL(query('[data-reveal-continue]').href).pathname;
    query('[data-reveal-continue]').click();
    await until(()=>location.pathname===destination&&!window.__engNav.busy,'Read navigates to its selected article');
    assert(!fresh.isConnected,'Read action navigates through the live DOM and removes the cloth surface');
  }
  result.textContent='PASS\n'+checks.join('\n');document.body.dataset.testResult='passed';
}catch(error){const probe=query('.reveal-card-cloth')?.__clothProbe;result.textContent='FAIL\n'+error.stack+'\nCLOTH: '+JSON.stringify(query('.reveal-card-frame')?.dataset)+'\nWEBGL: '+JSON.stringify({context:!!probe,draws:probe?.draws,times:probe?.times.slice(-3)})+'\nRECENT CHECKS:\n'+checks.slice(-10).join('\n');document.body.dataset.testResult='failed';}
</script>"##;

#[derive(Clone)]
struct Proxy {
    target: String,
    client: reqwest::Client,
}

async fn forward(State(proxy): State<Proxy>, request: Request<Body>) -> Response {
    let fixture = request
        .uri()
        .query()
        .is_some_and(|query| query.contains("__reveal_card_test=1"));
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
    match response.bytes().await {
        Ok(bytes) if fixture => {
            let html = String::from_utf8(bytes.to_vec()).expect("homepage HTML");
            let html = html.replacen("<head>", &format!("<head>{STARTUP_PROBE}"), 1);
            let html = html.replace(
                "</body>",
                &format!("<pre id=\"result\" hidden>RUNNING</pre>{FIXTURE}</body>"),
            );
            (status, headers, html).into_response()
        }
        Ok(bytes) => (status, headers, bytes).into_response(),
        Err(error) => (StatusCode::BAD_GATEWAY, error.to_string()).into_response(),
    }
}

async fn exercise_reveal(reduced_motion: bool, unavailable: bool) {
    let _browser_guard = BROWSER_LOCK.lock().await;
    let Some(chrome) = browser::chrome() else {
        assert!(
            std::env::var("REQUIRE_BROWSER_TESTS").is_err(),
            "Chrome is required in CI; set CHROME_BIN"
        );
        eprintln!("skipping reveal-card browser test: Chrome not found");
        return;
    };
    let server = TestServer::start(None).await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("test proxy port");
    let port = listener.local_addr().unwrap().port();
    let router = axum::Router::new().fallback(forward).with_state(Proxy {
        target: format!("http://127.0.0.1:{}", server.port),
        client: reqwest::Client::new(),
    });
    let _proxy = ProxyTask(tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap()
    }));
    let suffix = if unavailable { "&no_webgl=1" } else { "" };
    let dom = browser::dump_dom_with_webgl(
        chrome,
        &format!("http://127.0.0.1:{port}/feed?__reveal_card_test=1{suffix}"),
        reduced_motion,
    )
    .await;
    let diagnostic = dom
        .split("id=\"result\"")
        .nth(1)
        .and_then(|value| value.split_once('>').map(|(_, body)| body))
        .and_then(|value| value.split("</pre>").next())
        .unwrap_or(&dom);
    assert!(
        dom.contains("data-test-result=\"passed\""),
        "Reveal-card browser checks did not pass:\n{diagnostic}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn reveal_cloth_animates_only_while_open_and_remounts() {
    exercise_reveal(false, false).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn reveal_cloth_respects_reduced_motion() {
    exercise_reveal(true, false).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn reveal_remains_usable_without_webgl() {
    exercise_reveal(true, true).await;
}
