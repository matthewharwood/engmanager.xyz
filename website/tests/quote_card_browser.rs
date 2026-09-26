//! Real HTML-in-Canvas rendering and the ordinary HTML fallback, exercised
//! against the compiled website. The test captures the generated PNG blob;
//! it does not replace drawElementImage or the browser's paint lifecycle.

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

// Hold an earlier registry probe and the cold theme-font fetch before production
// scripts execute. The font response still passes through the real FontFace
// decoder; canvas drawing, paint events, and successful PNG encoding are native.
const STARTUP_PROBE: &str = r##"<script>
if(new URLSearchParams(location.search).has('enabled')){
  localStorage.setItem('engmanager.theme','light');
  const realFetch=window.fetch.bind(window);
  const fontGate=new Promise(resolve=>{window.__quoteCardReleaseFont=()=>{
    window.__quoteCardFontPending=false;resolve();
  };});
  window.fetch=async(url,options={})=>{
    if(String(url).includes('.woff2')&&options.cache!=='only-if-cached'){
      window.__quoteCardFontPending=true;
      await fontGate;
    }
    return realFetch(url,options);
  };
  const descriptor=Object.getOwnPropertyDescriptor(navigator,'getBattery');
  Object.defineProperty(navigator,'getBattery',{configurable:true,value:()=>new Promise((resolve,reject)=>{
    window.__quoteCardProbePending=true;
    window.__quoteCardReleaseProbe=()=>{
      if(descriptor)Object.defineProperty(navigator,'getBattery',descriptor);else delete navigator.getBattery;
      window.__quoteCardProbePending=false;
      reject(new Error('Test-held startup probe released'));
    };
  })});
}
</script>"##;

const FIXTURE: &str = r##"<script type="module">
const result=document.querySelector('#result'),checks=[];
const enabled=new URLSearchParams(location.search).has('enabled');
const query=selector=>document.querySelector(selector);
const receipt=()=>query('[data-api-id="html-in-canvas"]');
const discovered=()=>JSON.parse(localStorage.getItem('engmanager.discoveries')||'[]').includes('html-in-canvas');
const visible=node=>!!node&&!node.hidden&&getComputedStyle(node).display!=='none';
const assert=(value,message)=>{if(!value)throw Error(message);checks.push(message);result.textContent='RUNNING\n'+checks.slice(-8).join('\n');};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){for(let i=0;i<200;i++){if(predicate())return;await delay(40);}throw Error('Timed out: '+label);}
try{
  await until(()=>document.readyState==='complete'&&query('[data-quote-card-open]')&&!query('[data-quote-card-open]').hidden,'article quote action ready');
  if(!enabled){
    window.__journeyViewport=320;
    await until(()=>innerWidth===320,'mobile viewport');
    // The media-query callback relocates tools after viewport metrics change.
    // Wait for the mobile disclosure before opening and focusing its action.
    await until(()=>query('[data-quote-card-open]').closest('.article-meta-disclosure-tools'),'mobile article tools reach their Actions disclosure');
  }
  const opener=query('[data-quote-card-open]'),actions=opener.closest('details');if(actions)actions.open=true;
  const blockquote=query('.article blockquote'),copy=blockquote.cloneNode(true);copy.querySelectorAll('button').forEach(node=>node.remove());
  const excerpt=copy.textContent.replace(/\s+/g,' ').trim();
  let exports=0;document.addEventListener('engmanager:quote-card-export',()=>exports++);
  opener.focus();
  assert(document.activeElement===opener,'visible article action can receive keyboard focus');
  opener.click();
  await until(()=>query('[data-quote-card-dialog]').open,'native dialog opens');
  const dialog=query('[data-quote-card-dialog]'),text=query('[data-quote-card-text]'),artwork=query('[data-quote-card-artwork]'),download=query('[data-quote-card-download]');
  assert(dialog.contains(document.activeElement),'native dialog receives keyboard focus');
  assert(query('[data-quote-card-quote]').textContent===excerpt,'card uses article text without the injected action label');
  assert(text.readOnly&&text.value.includes(excerpt)&&text.value.includes('/articles/talking-not-typing'),'selectable quotation includes its source');
  assert(artwork.querySelector('a').href.includes('/articles/talking-not-typing'),'visible card attributes the source article');
  assert(visible(download)===enabled,'PNG control follows actual browser capability');
  assert(exports===0,'opening an HTML preview does not claim an export');
  assert(!discovered()&&!receipt()?.classList.contains('api-cell-discovered'),'HTML preview does not award receipt discovery');
  if(enabled){
    await until(()=>window.__quoteCardProbePending,'earlier capability probe remains pending');
    await until(()=>window.__quoteCardFontPending&&document.documentElement.dataset.fontState==='loading','cold theme font enters its real loading state');
    assert(getComputedStyle(query('[data-quote-card-quote]')).fontFamily.includes('Redacted'),'cold theme preview uses the temporary Redacted face');
    let blob,filename,fontAtEncoding;const create=URL.createObjectURL,anchorClick=HTMLAnchorElement.prototype.click,nativeToBlob=HTMLCanvasElement.prototype.toBlob;
    URL.createObjectURL=function(value){if(value?.type==='image/png')blob=value;return create.call(this,value);};
    HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){filename=this.download;return;}return anchorClick.call(this);};
    HTMLCanvasElement.prototype.toBlob=function(...args){
      if(this.hasAttribute('data-quote-card-canvas'))fontAtEncoding={
        state:document.documentElement.dataset.fontState,theme:document.documentElement.dataset.fontTheme,
        family:getComputedStyle(query('[data-quote-card-quote]')).fontFamily,
        decoded:[...document.fonts].some(face=>face.family==='PP Neue Montreal'&&face.status==='loaded'),
      };
      return nativeToBlob.apply(this,args);
    };
    try{
      download.click();
      await delay(300);
      assert(window.__quoteCardFontPending&&document.documentElement.dataset.fontState==='loading','real theme-font fetch is still held during export');
      assert(download.disabled&&!blob&&exports===0&&!query('[data-quote-card-canvas]'),'export waits for the selected font without encoding Redacted content or claiming discovery');
      window.__quoteCardReleaseFont();
      await until(()=>blob&&exports===1,'native PNG export');
      assert(fontAtEncoding?.state==='ready'&&fontAtEncoding.theme==='light'&&fontAtEncoding.decoded&&fontAtEncoding.family.includes('PP Neue Montreal')&&!fontAtEncoding.family.includes('Redacted'),'native encoding uses the selected decoded font after the loading state ends');
      assert(window.__quoteCardProbePending,'native export completes before registry initialization reaches HTML-in-Canvas');
      assert(receipt()?.classList.contains('api-cell-active')&&receipt().classList.contains('api-cell-discovered')&&discovered(),'early native export marks the actual receipt active and persists discovery');
      assert(receipt().textContent.includes('HTML/CSS quote card rendered to PNG'),'receipt records the successful native export');
      window.__quoteCardReleaseProbe();
      await until(()=>receipt()?.textContent.includes('Experimental; requires enabled browser support'),'registry initialization reaches HTML-in-Canvas');
      assert(receipt().classList.contains('api-cell-active')&&receipt().classList.contains('api-cell-discovered')&&discovered(),'later registry initialization preserves export status and discovery');
      const bytes=new Uint8Array(await blob.arrayBuffer());
      assert(blob.type==='image/png'&&blob.size>1000&&filename?.endsWith('.png'),'native export supplies a nonempty downloadable PNG');
      assert([...bytes.slice(0,8)].join(',')==='137,80,78,71,13,10,26,10','export bytes have the PNG signature');
      const artifact=document.createElement('script');artifact.type='application/octet-stream';artifact.id='quote-card-png';artifact.textContent=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');document.body.appendChild(artifact);
      const image=await createImageBitmap(blob),sample=document.createElement('canvas');sample.width=image.width;sample.height=image.height;const ctx=sample.getContext('2d');ctx.drawImage(image,0,0);image.close();
      assert(sample.width>=600&&sample.height>=300,'PNG preserves useful export resolution');
      const pixels=ctx.getImageData(0,0,sample.width,sample.height).data,colors=new Set();let opaque=0;
      for(let i=0;i<pixels.length;i+=16){if(pixels[i+3]>240)opaque++;colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);}
      assert(opaque>sample.width*sample.height*.1&&colors.size>50,'PNG contains opaque styled content and rendered text');
      assert(!query('[data-quote-card-canvas]')&&visible(artwork),'successful export restores the HTML card');
      const toBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};
      try{
        download.click();await until(()=>!download.disabled&&!query('[data-quote-card-canvas]'),'failed encoder cleanup');
        assert(visible(artwork)&&query('[data-quote-card-quote]').textContent===excerpt&&exports===1,'encoding failure restores the quote without reporting success');
      }finally{HTMLCanvasElement.prototype.toBlob=toBlob;}
      const fonts=document.fonts,descriptor=Object.getOwnPropertyDescriptor(fonts,'ready');
      Object.defineProperty(fonts,'ready',{configurable:true,get:()=>new Promise(()=>{})});
      try{
        download.click();await until(()=>!download.disabled,'stalled fonts time out');
        assert(visible(artwork)&&!query('[data-quote-card-canvas]')&&exports===1,'font timeout preserves the card without reporting success');
        download.click();assert(download.disabled,'pending font wait is cancellable');
        query('[data-quote-card-close]').click();await until(()=>!dialog.open&&!download.disabled,'close cancels font wait');
        assert(!query('[data-quote-card-canvas]')&&exports===1,'closing a pending export leaves no temporary canvas');
      }finally{if(descriptor)Object.defineProperty(fonts,'ready',descriptor);else delete fonts.ready;}
    }finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=anchorClick;HTMLCanvasElement.prototype.toBlob=nativeToBlob;}
  }else{
    const clipboard=navigator.clipboard,write=clipboard.writeText;clipboard.writeText=()=>Promise.reject(new DOMException('Denied by test','NotAllowedError'));
    try{
      query('[data-quote-card-copy]').click();await until(()=>document.activeElement===text&&text.selectionEnd===text.value.length,'clipboard denial selects fallback text');
      assert(text.value.includes(excerpt)&&!text.disabled,'clipboard denial preserves complete selectable text');
    }finally{clipboard.writeText=write;}
    const bounds=dialog.getBoundingClientRect(),card=artwork.getBoundingClientRect();
    assert(bounds.left>=-1&&bounds.right<=321&&card.left>=-1&&card.right<=321,'dialog and card fit a320px mobile viewport');
    if(actions)actions.open=true;
    query('[data-quote-card-close]').focus();window.__journeyKey='Escape';await until(()=>!dialog.open,'Escape dismisses native dialog');
    await until(()=>document.activeElement===opener,'focus returns to the article action');
    assert(exports===0,'HTML fallback never claims HTML-in-Canvas discovery');
    await until(()=>receipt()?.classList.contains('api-cell-unsupported'),'receipt reports unsupported HTML-in-Canvas');
    assert(!receipt().classList.contains('api-cell-discovered')&&!discovered(),'fallback copying leaves the actual receipt undiscovered');
  }
  result.textContent='PASS\n'+checks.join('\n');document.body.dataset.testResult='passed';
}catch(error){result.textContent='FAIL\n'+error.stack+'\nSTATUS: '+query('[data-quote-card-status]')?.textContent+'\nRECENT CHECKS:\n'+checks.slice(-10).join('\n');document.body.dataset.testResult='failed';}
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
        .is_some_and(|query| query.contains("__quote_card_test=1"));
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
    for name in [
        header::CONTENT_LENGTH,
        header::TRANSFER_ENCODING,
        header::X_FRAME_OPTIONS,
    ] {
        headers.remove(name);
    }
    headers.insert(header::CONTENT_SECURITY_POLICY, "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; frame-src 'self'; connect-src 'self'; frame-ancestors 'self'".parse().unwrap());
    match response.bytes().await {
        Ok(bytes) if fixture => {
            // Keep native dialogs, clipboard handling, and pixel export in the
            // article's own document, matching their production context.
            let script = FIXTURE
                .split_once("<script type=\"module\">")
                .unwrap()
                .1
                .split_once("</script>")
                .unwrap()
                .0;
            let html = String::from_utf8(bytes.to_vec()).expect("article HTML");
            let html = html.replacen("<head>", &format!("<head>{STARTUP_PROBE}"), 1);
            let html = html.replace("</body>", &format!("<pre id=\"result\" hidden>RUNNING</pre><script type=\"module\">{script}</script></body>"));
            (status, headers, html).into_response()
        }
        Ok(bytes) => (status, headers, bytes).into_response(),
        Err(error) => (StatusCode::BAD_GATEWAY, error.to_string()).into_response(),
    }
}

async fn exercise_quote_card(enabled: bool) {
    let _browser_guard = BROWSER_LOCK.lock().await;
    let Some(chrome) = browser::chrome() else {
        assert!(
            std::env::var("REQUIRE_BROWSER_TESTS").is_err(),
            "Chrome is required in CI; set CHROME_BIN"
        );
        eprintln!("skipping quote-card browser test: Chrome not found");
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
    let suffix = if enabled { "&enabled=1" } else { "" };
    let dom = browser::dump_dom_with_blink_features(
        chrome,
        &format!("http://127.0.0.1:{port}/articles/talking-not-typing?__quote_card_test=1{suffix}"),
        true,
        if enabled { &["CanvasDrawElement"] } else { &[] },
        if enabled { &[] } else { &["CanvasDrawElement"] },
    )
    .await;
    let diagnostic = dom
        .split("id=\"result\"")
        .nth(1)
        .and_then(|value| value.split_once('>').map(|(_, body)| body))
        .and_then(|value| value.split("</pre>").next())
        .unwrap_or(&dom);
    if enabled {
        let marker = "<script type=\"application/octet-stream\" id=\"quote-card-png\">";
        if let Some(png) = dom
            .split(marker)
            .nth(1)
            .and_then(|value| value.split("</script>").next())
        {
            std::fs::write(
                std::env::temp_dir().join("engmanager-quote-card.png"),
                hex::decode(png).expect("PNG artifact hex"),
            )
            .expect("save native PNG for visual inspection");
        }
    }
    assert!(
        dom.contains("data-test-result=\"passed\""),
        "Quote-card browser checks did not pass:\n{diagnostic}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn quote_cards_keep_an_accessible_html_fallback() {
    exercise_quote_card(false).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn quote_cards_export_native_html_as_png() {
    exercise_quote_card(true).await;
}
