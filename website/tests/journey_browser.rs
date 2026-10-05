//! Exercises the actual journey router and page scripts in Chrome against the
//! compiled server. The test-only proxy allows same-origin iframe control and
//! blocks external resources so cosmetics/payment providers cannot gate CI.

#[path = "common/browser.rs"]
mod browser;
include!(concat!(env!("OUT_DIR"), "/compact_bindings.rs"));

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

const FIXTURE: &str = css_html!(
    r##"<!doctype html><html><head><meta charset="utf-8"><title>Journey browser checks</title></head><body>
<pre id="result" style="block-size:1lh;overflow:hidden">RUNNING</pre><iframe id="app" title="Journey under test" style="width:1200px;height:900px;border:0"></iframe>
<script type="module">
const frame=document.querySelector('#app'),result=document.querySelector('#result'),checks=[];
const doc=()=>frame.contentDocument,win=()=>frame.contentWindow;
const query=selector=>doc()?.querySelector(selector);
const previous=()=>query('[data-journey-previous]');
const settled=()=>win().__engNav?.ready&&!win().__engNav.busy;
const visible=node=>!!node&&!node.hidden&&win().getComputedStyle(node).display!=='none'&&win().getComputedStyle(node).visibility!=='hidden';
const assert=(value,message)=>{if(!value)throw new Error(message);checks.push(message);result.textContent='RUNNING\n'+checks.slice(-5).join('\n');};
const phaseTimings=[];const phase=label=>{const began=performance.now();return()=>{phaseTimings.push({label,ms:Math.round(performance.now()-began)});window.__journeyPhaseTimings=phaseTimings;};};
setInterval(()=>{let panel=document.querySelector('#phase-diagnostics');if(!panel){panel=document.createElement('pre');panel.id='phase-diagnostics';panel.hidden=true;document.body.append(panel);}panel.textContent=JSON.stringify({phases:phaseTimings,mounts:win()?.__journeyMountTimings?.filter(entry=>entry.state==='pending'||entry.ms>100).slice(-20)});},1000);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){const finish=phase(label);for(let i=0;i<240;i++){try{if(predicate()){finish();return;}}catch{}await delay(50);}finish();throw new Error('Timed out: '+label);}
async function scrollSettled(){let last=-1,steady=0;for(let i=0;i<100;i++){await delay(50);const position=win().scrollY;steady=position===last?steady+1:0;if(steady>=5)return;last=position;}throw new Error('Scrolling did not settle');}
async function load(path){frame.src=path;await until(()=>win().location.pathname===path.split('?')[0]&&doc()?.readyState==='complete','load '+path);}
async function ready(path){await load(path);await until(()=>win().__engNav?.ready&&!win().__engNav.busy&&query('[data-journey-current]'),'journey ready '+path);}
async function navigate(path,options={}){const expected=new URL(path,win().location.href).pathname;const done=phase('navigate '+path);await win().__engNav.navigate(path,options);done();await until(()=>win().location.pathname===expected&&query('[data-journey-current]')&&settled(),'navigate '+path);await delay(50);}
async function click(selector,label=selector){if(selector==='[data-close-product]')await until(()=>!query('.is-camera-opening')&&!doc().body.classList.contains('shop-camera-transitioning'),'product camera settles before close');const node=query(selector);assert(node,'action exists: '+label);node.click();await delay(30);}
async function promote(path){await click('[data-journey-promote]','continue to '+path);await until(()=>win().location.pathname===path&&query('[data-journey-current]')&&settled(),'promote '+path);await delay(80);}
async function hoverAt(x,y){const bounds=frame.getBoundingClientRect();window.__journeyPointer={x:bounds.left+x,y:bounds.top+y};await until(()=>!window.__journeyPointer,'native pointer moves');await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));}
async function decodeImage(image,label,selected=()=>true){
  const deadline=performance.now()+12000;
  while(performance.now()<deadline){
    if(!selected()||!image.complete||!image.naturalWidth){await delay(50);continue;}
    const source=image.currentSrc;
    try{await image.decode();}catch(error){
      // A resize can cancel decoding the former srcset candidate. Retry only
      // that observed source change, within this image's original deadline.
      if(error.name==='EncodingError'&&image.currentSrc!==source)continue;
      throw new Error(label+' decode failed: '+error.name+' '+error.message+' '+source);
    }
    if(image.currentSrc===source)return;
  }
  throw new Error('Timed out decoding '+label+': '+image.currentSrc);
}
async function checkForegroundAvatar(){
  for(const path of ['/', '/feed']){
    await ready(path);await doc().fonts.ready;await win().__engTypography?.ready;
    const photo=query('[data-avatar-bouncer]'),bio=query('#bio'),api=win().__engAvatarBouncer;
    assert(photo&&api&&photo.getAttribute('popovertarget')==='bio','both feed routes retain the accessible foreground bio trigger');
    const image=photo.querySelector('img');
    await decodeImage(image,'foreground photo');
    await hoverAt(5,5);
    const reduced=win().matchMedia('(prefers-reduced-motion: reduce)').matches;
    const initial=photo.style.transform;await delay(220);
    assert((photo.style.transform!==initial)===!reduced,'the native photo moves only with normal motion on '+path);
    api.hold(photo,true);api.place(photo,10,10);
    let rect=photo.getBoundingClientRect();
    assert(doc().elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.closest('[data-avatar-bouncer]')===photo,'the photo is the foreground hit target above navigation on '+path);
    await hoverAt(rect.x+rect.width/2,rect.y+rect.height/2);api.hold(photo,false);
    const hovered=photo.style.transform;await delay(180);
    assert(!photo.hasAttribute('data-avatar-moving')&&photo.style.transform===hovered,'native hover holds the moving photo still for clicking');
    await hoverAt(5,win().innerHeight-5);
    window.__journeyKey='Tab';await until(()=>!window.__journeyKey,'keyboard modality for foreground bio');
    photo.focus({preventScroll:true});
    assert(photo.matches(':focus-visible')&&!photo.hasAttribute('data-avatar-moving'),'keyboard focus pauses the photo without scrolling the page');
    photo.blur();
    for(const [width,height] of [[1200,900],[320,568]]){
      frame.style.width=width+'px';frame.style.height=height+'px';
      await until(()=>win().innerWidth===width&&win().innerHeight===height,'foreground photo viewport '+width+'×'+height);
      await doc().fonts.ready;await win().__engTypography?.ready;
      api.hold(photo,true);
      rect=photo.getBoundingClientRect();
      for(const [x,y] of [[0,0],[width-rect.width,0],[0,height-rect.height],[width-rect.width,height-rect.height],[width/2,height/2]]){
        api.place(photo,x,y);photo.click();
        await until(()=>bio.matches(':popover-open'),'native bio opens from moving photo');
        await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));
        const bounds=bio.getBoundingClientRect();
        assert(bounds.left>=-1&&bounds.top>=-1&&bounds.right<=width+1&&bounds.bottom<=height+1&&bio.scrollWidth<=bio.clientWidth+1,
          'bio stays reachable at every photo edge on '+path+' '+width+'×'+height+': '+JSON.stringify(bounds.toJSON()));
        assert(!photo.hasAttribute('data-avatar-moving'),'open bio keeps its anchor stationary');
        bio.hidePopover();await until(()=>!bio.matches(':popover-open'),'bio closes');
      }
      api.hold(photo,false);
      assert(doc().documentElement.scrollWidth<=width&&Math.abs(win().scrollX)<1,'the foreground photo never enlarges the document width');
    }
    frame.style.width='1200px';frame.style.height='900px';await until(()=>win().innerWidth===1200&&win().innerHeight===900,'foreground photo desktop restored');
    await hoverAt(5,5);photo.blur();
    await reveal();
    assert(!visible(photo)&&!photo.hasAttribute('data-avatar-moving'),'the foreground photo yields to the automatically revealed poster');
    const button=query('[data-journey-promote]'),target=button.getBoundingClientRect();
    assert(doc().elementFromPoint(target.x+target.width/2,target.y+target.height/2)?.closest('[data-journey-promote]')===button,'the foreground photo leaves Continue reachable');
    win().scrollTo({top:0,behavior:'instant'});await until(()=>visible(photo),'scrolling back restores the foreground photo');
    await navigate('/coach',{source:'reveal'});const disposed=photo.style.transform;await delay(180);
    assert(!photo.hasAttribute('data-avatar-moving')&&photo.style.transform===disposed,'the outgoing photo stops after navigation');
    await click('[data-journey-resume]');await until(()=>win().location.pathname===path&&settled(),'retained foreground feed resumes');
    assert(query('[data-avatar-bouncer]')===photo,'retained navigation restores the existing photo on '+path);
    await until(()=>photo.hasAttribute('data-avatar-moving')===!reduced,'retained photo restores its motion preference');
  }
}
async function checkContinueMotion(){
  await doc().fonts.ready;await win().__engTypography?.ready;
  const button=query('[data-journey-promote]'),label=button.querySelector('.journey-promote-label'),marquee=button.querySelector('.journey-promote-marquee');
  const reduced=win().matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pulse=()=>win().getComputedStyle(button,'::before'),track=()=>win().getComputedStyle(marquee);
  const bounds=()=>{const rect=button.getBoundingClientRect();return[rect.x,rect.y,rect.width,rect.height];};
  assert(button.getAttribute('aria-label')===label.textContent&&marquee.getAttribute('aria-hidden')==='true'&&marquee.children.length===2,'Continue keeps one accessible name and two decorative marquee copies');
  await hoverAt(5,5);
  assert(pulse().animationPlayState===(reduced?'paused':'running')&&track().animationPlayState==='paused','only the visible normal-motion Continue button pulses before hover');
  for(const width of [1200,320]){
    frame.style.width=width+'px';await until(()=>win().innerWidth===width,'Continue viewport '+width);await reveal();
    const rect=button.getBoundingClientRect();await hoverAt(rect.x+rect.width/2,rect.y+rect.height/2);
    const start=bounds(),before=track().transform,pulseBefore=pulse().transform;
    assert(track().animationPlayState===(reduced?'paused':'running')&&track().visibility===(reduced?'hidden':'visible'),'native Continue hover enables the marquee only with normal motion');
    for(let sample=0;sample<8;sample++){
      await delay(35);
      assert(bounds().every((value,index)=>Math.abs(value-start[index])<.5)&&doc().documentElement.scrollWidth<=width&&Math.abs(win().scrollX)<1,'pulse and marquee keep Continue bounds and horizontal overflow stable at '+width+'px');
    }
    assert((track().transform!==before)===!reduced&&(pulse().transform!==pulseBefore)===!reduced,'CSS advances both Continue effects only with normal motion');
    assert(doc().elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.closest('[data-journey-promote]')===button,'the animated Continue button remains the native hit target');
    doc().documentElement.setAttribute('data-wave-paused','');
    assert(pulse().animationPlayState==='paused'&&track().animationPlayState==='paused','hidden-document guard pauses both Continue animations');
    // Let the compositor apply the new play state before sampling its phase.
    await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));
    const paused=track().transform;await delay(100);
    assert(track().transform===paused,'hidden-document guard freezes the applied Continue phase: '+JSON.stringify({before:paused,after:track().transform,state:track().animationPlayState}));
    doc().documentElement.removeAttribute('data-wave-paused');await hoverAt(5,5);
    assert(track().animationPlayState==='paused'&&track().visibility==='hidden'&&win().getComputedStyle(label).visibility==='visible','leaving Continue hover restores its stationary label');
  }
  frame.style.width='1200px';await until(()=>win().innerWidth===1200,'desktop restored after Continue motion');await reveal();
}
async function checkWaveRules(){
  const original=win().location.pathname;
  await navigate('/articles/auteurs');
  await doc().fonts.ready;
  win().scrollTo({top:0,behavior:'instant'});await scrollSettled();
  const reduced=win().matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sample=(node,pseudo='::after')=>{const style=win().getComputedStyle(node,pseudo);return{state:style.animationPlayState,position:style.maskPosition,image:style.maskImage};};
  const check=async(node,hoverNode=node)=>{
    await hoverAt(5,win().innerHeight-5);
    assert(sample(node).state==='paused'&&sample(node).image.includes('data:image/svg+xml'),'sine separator starts paused with its authored SVG mask');
    hoverNode.scrollIntoView({block:'center',behavior:'instant'});await scrollSettled();
    const rect=hoverNode.getBoundingClientRect();await hoverAt(rect.left+rect.width/2,rect.top+Math.min(10,rect.height/2));
    assert(sample(node).state===(reduced?'paused':'running'),'native container hover respects the motion preference');
    const before=sample(node).position;await delay(180);
    assert((sample(node).position!==before)===!reduced,'the wave travels only during normal-motion hover');
    if(node.matches('.site-nav'))assert(sample(node,'::before').state===sample(node).state&&win().getComputedStyle(node,'::before').backdropFilter.includes('blur'),'the wavy glass edge follows the navigation stroke');
    await hoverAt(5,win().innerHeight-5);const paused=sample(node).position;await delay(180);
    assert(sample(node).state==='paused'&&sample(node).position===paused,'leaving hover freezes the current wave phase');
    await hoverAt(rect.left+rect.width/2,rect.top+Math.min(10,rect.height/2));
    assert(reduced||parseFloat(sample(node).position)>=parseFloat(paused),'hover resumes the retained phase without rewinding');
    doc().documentElement.setAttribute('data-wave-paused','');const hidden=sample(node).position;await delay(100);
    assert(sample(node).state==='paused'&&sample(node).position===hidden,'hidden-document guard stops hovered waves');
    doc().documentElement.removeAttribute('data-wave-paused');
    await hoverAt(5,win().innerHeight-5);
  };
  await check(query('.site-nav'),query('.site-nav-brand'));
  await check(query('.article-meta'));
  await check(query('.article-toc-list'));
  const rule=query('.article hr');
  assert(rule,'the Auteurs article includes a semantic horizontal rule');
  await check(rule);
  await check(rule,rule.previousElementSibling);
  assert(doc().documentElement.scrollWidth<=win().innerWidth,'wave masks do not enlarge the page width');
  win().scrollTo({top:0,behavior:'instant'});await scrollSettled();
  await navigate(original);
}
async function checkVisibleDiagrams(article){
  // The same-origin module supplies deterministic graph markup for lifecycle
  // checks. Real Mermaid layout is checked separately over its actual CDN.
  const nodes=[...doc().querySelectorAll('.article .mermaid')];
  assert(nodes.length===3,'the execution article retains all three source diagrams');
  win().scrollTo({top:0,behavior:'instant'});await scrollSettled();
  assert(!win().__diagramFixture,'offscreen figures do not import the diagram provider on article mount');
  nodes[0].scrollIntoView({block:'center',behavior:'instant'});
  await until(()=>nodes[0].querySelector('svg'),'the visible first diagram renders after input settles');
  assert(win().__diagramFixture.calls.length===1&&!nodes[1].querySelector('svg')&&!nodes[2].querySelector('svg'),'one visible figure renders while offscreen figures keep their source');
  await click('.model-figure .diagram-expand');await until(()=>query('.diagram-viewer').open,'visible diagram expands');
  assert(query('.diagram-viewer .diagram-canvas svg'),'the expanded viewer contains the selected graph');
  await click('.diagram-zoom [data-zoom="in"]');assert(query('.diagram-viewer output').textContent==='150%','expanded diagram zoom remains usable');
  await click('.diagram-close');
  for(const node of nodes.slice(1)){node.scrollIntoView({block:'center',behavior:'instant'});await until(()=>node.querySelector('svg'),'each remaining visible diagram renders');}
  assert(win().__diagramFixture.calls.length===3&&nodes.every(node=>node.parentElement.querySelector('.diagram-expand')),'all three diagrams acquire rendered content and expansion controls');
  const original=nodes.map(node=>node.querySelector('svg')),beforeResume=win().__diagramFixture.calls.length;
  await navigate('/shop',{source:'reveal'});await click('[data-journey-resume]');await until(()=>win().location.pathname===article&&settled(),'retained diagram article resumes');
  await scrollSettled();
  assert(nodes.every((node,index)=>node.querySelector('svg')===original[index])&&win().__diagramFixture.calls.length===beforeResume,'retained article reuses unchanged rendered SVGs');
  assert(nodes.every(node=>node.parentElement.querySelector('.diagram-expand')),'retained diagram expansion controls rebind to the new viewer');
  const last=nodes.at(-1);last.scrollIntoView({block:'center',behavior:'instant'});await scrollSettled();
  const beforeTheme=win().__diagramFixture.calls.length;await click('[data-theme-cycle]');
  await until(()=>win().__diagramFixture.calls.length>beforeTheme,'visible diagram updates for a new theme');
  const beforeCompact=win().__diagramFixture.calls.length;frame.style.width='390px';await until(()=>win().innerWidth===390,'compact diagram viewport');
  last.scrollIntoView({block:'center',behavior:'instant'});await until(()=>win().__diagramFixture.calls.length>beforeCompact&&win().__diagramFixture.calls.at(-1).source.startsWith('flowchart TD'),'compact layout rerenders the original LR graph vertically');
  assert(win().__diagramFixture.calls.every(call=>!call.busy&&!call.revealing&&call.source.includes('-->')),'native diagram layout starts from original sources outside journey holds');
  frame.style.width='1200px';await until(()=>win().innerWidth===1200,'desktop restored after visible diagrams');
  win().scrollTo({top:0,behavior:'instant'});await scrollSettled();
}
async function checkLazyPayments(){
  const head=doc().head,append=head.append.bind(head),actualFetch=win().fetch.bind(win()),requests=[],mounts=[],destroyed=[],returns=[];
  assert(!head.querySelector('script[src^="https://js.stripe.com/v3"]'),'browsing the catalog never requests the payment provider');
  head.append=(...nodes)=>{for(const node of nodes){if(node.tagName==='SCRIPT'&&node.src.startsWith('https://js.stripe.com/v3'))requests.push(node);else append(node);}};
  const fakeStripe=()=>({elements:()=>({create:type=>({mount:()=>mounts.push(type),on:(name,fn)=>{if(name==='ready')setTimeout(fn,0);},destroy:()=>destroyed.push(type)}),update(){}}),retrievePaymentIntent:async secret=>{returns.push(secret);return{paymentIntent:{status:secret==='fixture_failed'?'requires_payment_method':secret==='fixture_cancelled'?'canceled':'succeeded',receipt_email:'fixture@example.invalid'}};}});
  try{
    win().__checkout.enabled=true;win().__checkout.publishableKey='pk_test_local_fixture';
    await click('[data-cart-toggle]');await until(()=>requests.length===1,'bag intent requests one payment provider');
    requests[0].onerror();await until(()=>query('[data-checkout-error]').textContent.includes('could not load'),'a provider failure shows a retryable checkout error');
    await click('[data-close-bag]');await click('[data-cart-toggle]');await until(()=>requests.length===2,'reopening the bag retries provider loading');
    // Leave while the real lazy loader is pending: its eventual completion
    // must not mount Elements into a disposed storefront.
    await navigate('/coach');win().Stripe=fakeStripe;requests[1].onload();await delay(50);
    assert(mounts.length===0,'late payment initialization cannot mount into a departed storefront');
    await navigate('/shop');win().__checkout.enabled=true;win().__checkout.publishableKey='pk_test_local_fixture';
    await click('[data-cart-toggle]');await until(()=>mounts.length===2,'a new storefront reuses the loaded provider');
    assert(requests.length===2&&mounts.includes('address')&&mounts.includes('payment'),'one address/payment pair mounts without downloading the provider again');
    await navigate('/coach');assert(destroyed.length===2,'navigation disposes both mounted payment elements');
    // Supply a test-only return key with new checkout disabled in the response.
    // Stripe is a local stub: no PaymentIntent is created or confirmed.
    // Reset the provider singleton to exercise a cold redirect failure and
    // an in-document retry rather than relying on the previously loaded fake.
    const loaderUrl=head.querySelector('script[src*="/js/payment-provider."]').src;
    delete win().Stripe;delete win().__engPayments;
    await new Promise((resolve,reject)=>{const loader=doc().createElement('script');loader.src=loaderUrl;loader.onload=resolve;loader.onerror=reject;head.append(loader);});
    win().fetch=async(input,options)=>{
      const response=await actualFetch(input,options),url=new URL(input?.url||String(input),win().location.href);
      const secret=url.searchParams.get('payment_intent_client_secret');
      if(url.pathname!=='/shop'||!['fixture_return','fixture_failed','fixture_cancelled'].includes(secret))return response;
      const parsed=new (win().DOMParser)().parseFromString(await response.text(),'text/html');
      const island=parsed.querySelector('script[data-eng-config="__checkout"]'),config=JSON.parse(island.textContent);
      config.enabled=secret==='fixture_failed';config.publishableKey='pk_test_local_fixture';island.textContent=JSON.stringify(config);
      const patched=new (win().Response)(parsed.documentElement.outerHTML,{status:response.status,headers:response.headers});
      Object.defineProperty(patched,'url',{value:response.url});
      return patched;
    };
    const returnDocument=doc();
    await navigate('/shop?bag=checkout&payment_intent_client_secret=fixture_return');
    assert(doc()===returnDocument,'payment return fixture preserves its native same-document response URL');
    await until(()=>requests.length===3,'a cold payment return requests the provider with new checkout disabled');
    requests[2].onerror();
    await until(()=>query('[data-checkout-error]').textContent.includes('confirmation could not load'),'a failed payment return explains how to retry');
    await click('[data-close-bag]');win().history.back();
    await until(()=>query('[data-bag]').dataset.bagState==='checkout'&&requests.length===4,'restoring checkout retries the pending payment return without a refresh');
    assert(doc()===returnDocument,'payment return retry preserves the live document');
    win().Stripe=fakeStripe;requests[3].onload();
    await until(()=>{
      const pane=query('[data-bag-checkout-pane]'),done=query('[data-checkout-done]');
      return returns.includes('fixture_return')&&visible(pane)&&visible(done)&&pane.getBoundingClientRect().height>0&&done.getBoundingClientRect().height>0;
    },'payment redirect return visibly restores an existing confirmation even when new checkout is disabled');
    assert(requests.length===4&&!query('[data-checkout-error]').textContent,'retried payment return clears its error and coalesces provider requests');
    await navigate('/shop?bag=checkout&payment_intent_client_secret=fixture_failed');
    await until(()=>returns.includes('fixture_failed')&&mounts.length===4&&visible(query('[data-checkout-form]')),'a failed payment return restores ordinary enabled checkout');
    assert(!visible(query('[data-checkout-done]'))&&requests.length===4,'a nonfinal payment cannot masquerade as a confirmation or reload the provider');
    await navigate('/coach');assert(destroyed.length===4,'the recovered checkout disposes its new Elements pair');
    await navigate('/shop?bag=checkout&payment_intent_client_secret=fixture_cancelled');
    await until(()=>returns.includes('fixture_cancelled')&&visible(query('[data-checkout-disabled]'))&&query('[data-checkout-error]').textContent.includes('not completed'),'a canceled return with new orders disabled explains its state');
    assert(mounts.length===4&&!visible(query('[data-checkout-form]'))&&!visible(query('[data-checkout-done]')),'disabled canceled returns mount no payment form and show no successful confirmation');
  }finally{head.append=append;win().fetch=actualFetch;delete win().Stripe;}
}
async function reveal(){const runway=query('[data-journey-runway]');assert(runway,'next destination has a reveal runway');const rect=runway.getBoundingClientRect();win().scrollTo({top:win().scrollY+rect.top-win().innerHeight*.8,behavior:'instant'});await until(()=>visible(query('[data-journey-next][data-preview-ready]'))&&query('[data-journey-promote]')&&!query('[data-journey-promote]').disabled,'scroll automatically reveals the next destination poster');}
async function checkCurtain(){
  const rag=query('[data-journey-curtain]');
  assert(rag&&rag.closest('[data-journey-current]')&&rag.getAttribute('aria-hidden')==='true','one decorative torn curtain belongs to the outgoing surface');
  await until(()=>!rag.hasAttribute('data-moving'),'curtain initially settles');
  const path=rag.querySelector('.journey-curtain-edge'),rest=path.getAttribute('d');
  win().scrollTo({top:win().scrollY+55,behavior:'instant'});
  if(win().matchMedia('(prefers-reduced-motion: reduce)').matches){
    await delay(100);assert(path.getAttribute('d')===rest&&!rag.hasAttribute('data-moving'),'reduced motion leaves the torn curtain completely still');
  }else{
    await until(()=>rag.hasAttribute('data-moving')&&path.getAttribute('d')!==rest,'scroll velocity bends the torn curtain');
    await until(()=>!rag.hasAttribute('data-moving'),'curtain springs stop after scrolling');
    assert(path.getAttribute('d')===rest,'curtain falls back to its exact original rag');
  }
  assert(doc().documentElement.scrollWidth<=win().innerWidth,'torn edge stays within the window width');
}
function observePosterRemoval(poster){
  const state={rendered:false,removedAfterRender:false};
  const observer=new (win().MutationObserver)(records=>{
    for(const record of records){
      if(record.type==='attributes'&&record.target.matches('[data-journey-current][data-journey-rendered="true"]'))state.rendered=true;
      if([...record.removedNodes].includes(poster))state.removedAfterRender=state.rendered;
    }
  });
  observer.observe(doc().body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-journey-rendered']});
  return {state,disconnect:()=>observer.disconnect()};
}
async function checkArticleReveal(path,width,action,slug='the-execution-marketplace',height=900){
  frame.style.width=width+'px';
  frame.style.height=height+'px';
  win().localStorage.removeItem('engmanager.visited-articles');
  const oldDocument=doc();frame.src=path;
  // Reload after clearing storage: the visited set is held in the page's
  // closure, so changing storage alone would skip the unread-click path.
  await until(()=>doc()!==oldDocument&&win().location.pathname===path&&doc()?.readyState==='complete'&&settled(),'fresh unread '+path+' at '+width);
  await Promise.allSettled([win().__engTypography?.ready,win().__engTypography?.displayReady,doc().fonts.ready]);
  const target='/articles/'+slug,link=[...doc().querySelectorAll('.article-fluid-link')].find(link=>link.dataset.slug===slug);
  const popover=query('#article-reveal'),card=popover.querySelector('.reveal-card-frame');
  const content=card.querySelector('.reveal-card-content');
  assert(link&&!link.classList.contains('is-visited'),'article begins unread at '+path+' '+width);
  assert(content,'article reveal separates scrollable copy from its controls');
  link.scrollIntoView({block:'center',behavior:'instant'});
  window.__journeyKey='Tab';await until(()=>!window.__journeyKey,'keyboard focus modality for unread article');
  const samples={before:0,open:0,peakDocument:0,peakBody:0,violations:[]};
  const capture=()=>{
    const opened=popover.matches(':popover-open');
    samples[opened?'open':'before']++;
    const rootWidth=doc().documentElement.scrollWidth,bodyWidth=doc().body.scrollWidth;
    samples.peakDocument=Math.max(samples.peakDocument,rootWidth);samples.peakBody=Math.max(samples.peakBody,bodyWidth);
    // The card's intentional spring paint can exceed the popover's clip
    // without creating a scrollable area. Check actual scrolling here;
    // settled content dimensions are checked after the animation below.
    if(opened)popover.scrollLeft=width*2;
    const bad=rootWidth>width+1||bodyWidth>width+1||Math.abs(win().scrollX)>1||
      (opened&&(popover.clientWidth>width+1||Math.abs(popover.scrollLeft)>1||card.scrollWidth>card.clientWidth+1||content.scrollWidth>content.clientWidth+1));
    if(bad&&samples.violations.length<3)samples.violations.push({opened,rootWidth,bodyWidth,scrollX:win().scrollX,
      popover:[popover.clientWidth,popover.scrollWidth],card:[card.clientWidth,card.scrollWidth],content:[content.clientWidth,content.scrollWidth],
      linkTransform:win().getComputedStyle(link).transform,strikeTransform:win().getComputedStyle(link.querySelector('.article-strike')).transform});
  };
  capture();
  let quiet=0;
  const started=performance.now();
  const sampling=new Promise((resolve,reject)=>{
    const tick=()=>{
      capture();
      const running=[...link.getAnimations({subtree:true}),...popover.getAnimations({subtree:true})]
        .some(animation=>animation.playState==='running'||animation.pending);
      quiet=popover.matches(':popover-open')&&!running?quiet+1:0;
      if(quiet>=3)return resolve();
      if(performance.now()-started>6000)return reject(new Error('Article reveal animations did not settle: '+path+' '+width));
      win().requestAnimationFrame(tick);
    };
    win().requestAnimationFrame(tick);
  });
  // Real keyboard modality makes this match :focus-visible; node.click()
  // alone would miss the full-row focus/hover scale that caused the bug.
  link.focus({preventScroll:true});
  assert(link.matches(':focus-visible'),'unread click exercises visible keyboard focus');
  link.click();
  await sampling;
  assert(samples.before>1&&samples.open>1,'sampled the unread delay and full reveal entrance at '+path+' '+width);
  assert(!samples.violations.length,'unread article stays horizontally contained throughout animation at '+path+' '+width+': '+JSON.stringify(samples));
  const bounds=card.getBoundingClientRect();
  assert(bounds.left>=-1&&bounds.right<=width+1,'settled article reveal fits the viewport at '+path+' '+width);
  assert(popover.scrollWidth<=popover.clientWidth+1,'settled article reveal content fits its popover');
  win().scrollTo({left:width*2,top:win().scrollY,behavior:'instant'});
  assert(Math.abs(win().scrollX)<1,'unread article reveal cannot pan the page horizontally');
  const read=query('[data-reveal-continue]');
  assert(doc().activeElement===read&&new URL(read.href).pathname===target,'Read receives focus and targets the selected public article');
  const close=query('.reveal-card-close');
  const controlFits=node=>{
    const controlBounds=node.getBoundingClientRect(),cardBounds=card.getBoundingClientRect();
    return controlBounds.left>=Math.max(0,cardBounds.left)-1&&controlBounds.right<=Math.min(width,cardBounds.right)+1&&
      controlBounds.top>=Math.max(0,cardBounds.top)-1&&controlBounds.bottom<=Math.min(height,cardBounds.bottom)+1;
  };
  // Do not scroll either control into view: the app focuses Read on open,
  // and keyboard users must be able to see it without repairing the layout.
  assert(controlFits(read)&&controlFits(close),'initially focused Read and Close are visible without scrolling at '+width+'×'+height);
  const overflowing=content.scrollHeight>content.clientHeight+1;
  assert(!overflowing||['auto','scroll'].includes(win().getComputedStyle(content).overflowY),
    'long article copy allows vertical scrolling independently of its controls');
  if(height===568)assert(overflowing,'the short-viewport case exercises genuinely overflowing article copy');
  if(overflowing){
    const readTop=read.getBoundingClientRect().top,closeTop=close.getBoundingClientRect().top;
    content.scrollTop=content.scrollHeight;
    assert(content.scrollTop>0,'the reader can scroll through long article copy');
    assert(controlFits(read)&&controlFits(close)&&Math.abs(read.getBoundingClientRect().top-readTop)<1&&Math.abs(close.getBoundingClientRect().top-closeTop)<1,
      'Read and Close remain visible and stationary while article copy scrolls');
    content.scrollTop=0;
  }
  assert(controlFits(action==='close'?close:read)&&Math.abs(win().scrollX)<1,
    action+' remains reachable inside the card and viewport at '+width+'×'+height);
  if(action==='close'){
    await click('.reveal-card-close');await until(()=>!popover.matches(':popover-open'),'close article reveal');
    assert(win().location.pathname===path,'closing the article reveal keeps the feed route');
  }else{
    await click('[data-reveal-continue]');await until(()=>win().location.pathname===target&&settled(),'Read opens the selected article');
    assert(!query('#article-reveal')?.matches(':popover-open'),'Read leaves no reveal overlay over the article');
  }
}
const article='/articles/the-execution-marketplace';
try{
  await ready('/feed?receipt');
  assert(!query('#api-receipt-modal').matches(':popover-open'),'the former receipt URL does not open the easter egg');
  await until(()=>query('[data-api-receipt-grid]')?.children.length>0,'discovery registry initializes');
  await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));
  win().dispatchEvent(new (win().KeyboardEvent)('keydown',{key:'?',bubbles:true}));
  await until(()=>query('.discovery-toast-open'),'keyboard discovery presents a toast action');
  assert(!query('#api-receipt-modal').matches(':popover-open'),'a discovery does not open the receipt automatically');
  const toastErrors=[];win().addEventListener('error',event=>toastErrors.push(event.message));
  const toastToggles=[];query('#api-receipt-modal').addEventListener('beforetoggle',event=>toastToggles.push(event.newState));
  const openedToast=query('.discovery-toast');await click('.discovery-toast-open');
  assert(query('#api-receipt-modal').matches(':popover-open'),'the toast action opens the API receipt: '+JSON.stringify({errors:toastErrors,toggles:toastToggles,connected:openedToast.isConnected,inert:!!openedToast.closest('[inert]')}));
  await click('.api-receipt-close');
  await until(()=>query('.discovery-toast')&&query('.discovery-toast')!==openedToast,'another discovery offers its own toast');
  const expiringToast=query('.discovery-toast');
  await until(()=>!expiringToast.isConnected,'discovery actions expire with their toasts');
  assert(!query('#api-receipt-modal').matches(':popover-open'),'expired discovery toasts leave the receipt closed');

  for(const [path,width,action] of [['/feed',320,'close'],['/feed',390,'read'],['/',320,'read'],['/',390,'close']]){
    await checkArticleReveal(path,width,action);
  }
  await checkArticleReveal('/feed',320,'read','claude-code-lsp',568);
  frame.style.height='900px';
  frame.style.width='1200px';await until(()=>win().innerWidth===1200,'desktop restored after unread article reveals');

  await checkForegroundAvatar();

  await ready('/shop');
  assert(!visible(previous()),'opening the storefront directly has no previous-page window');
  assert(query('[data-product-card]'),'the real embedded catalog is available without Stripe credentials');
  const firstCard=query('[data-product-card]'),productPath=new URL(firstCard.href).pathname;
  frame.style.width='390px';await until(()=>win().innerWidth===390,'mobile responsive catalog');
  await doc().fonts.ready;await win().__engTypography?.ready;
  const mobileCardImage=firstCard.querySelector('img');
  await decodeImage(mobileCardImage,'mobile catalog candidate',()=>/-(160|384|640)(?:\.[0-9a-f]{8})?\.webp$/.test(new URL(mobileCardImage.currentSrc||mobileCardImage.src).pathname));
  assert(mobileCardImage.naturalWidth>0&&mobileCardImage.naturalWidth<900&&/-(160|384|640)(?:\.[0-9a-f]{8})?\.webp$/.test(new URL(mobileCardImage.currentSrc).pathname),'native mobile cards decode a responsive candidate instead of the 900px original');
  assert(mobileCardImage.srcset.includes('160w')&&mobileCardImage.srcset.includes('384w')&&mobileCardImage.srcset.includes('640w')&&mobileCardImage.srcset.includes('900w'),'cards retain the complete responsive image ladder');
  firstCard.click();await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='false','direct product opens');
  assert(win().location.pathname===productPath,'product overlay writes the product URL');
  const responsiveGallery=query('[data-product-image]');await decodeImage(responsiveGallery,'responsive product gallery');
  const product=win().__shopProducts.products.find(item=>item.slug===firstCard.dataset.slug),original=new (win().Image)();
  assert(responsiveGallery.srcset===product.images[0].srcset&&responsiveGallery.sizes,'the gallery requests the candidate appropriate to its actual panel size');
  const galleryThumb=query('.shop-thumb img');await decodeImage(galleryThumb,'product thumbnail');
  assert(galleryThumb.naturalWidth===160&&/-160(?:\.[0-9a-f]{8})?\.webp$/.test(new URL(galleryThumb.currentSrc).pathname),'gallery thumbnails decode the 160px derivative');
  original.src=product.images[0].url;await original.decode();
  assert(original.naturalWidth===900,'the original full-resolution product image remains available');
  await click('[data-close-product]');await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='true','direct product closes');
  frame.style.width='1200px';await until(()=>win().innerWidth===1200,'desktop restored after responsive image checks');
  assert(win().location.pathname==='/shop','closing a product restores the same-origin storefront route');
  await ready(productPath);await until(()=>query('[data-product-panel]')?.getAttribute('aria-hidden')==='false','hard-loaded product opens');
  assert(!visible(previous()),'opening a product URL directly creates no previous window');
  await click('[data-close-product]');await until(()=>win().location.pathname==='/shop'&&query('[data-product-panel]')?.getAttribute('aria-hidden')==='true','hard-loaded product returns to shop');

  await navigate(article);
  await checkWaveRules();
  await checkVisibleDiagrams(article);
  const hero=query('[data-article-hero="the-execution-marketplace"]');
  assert(hero&&hero.querySelector('svg.article-hero-poster')&&hero.querySelector('canvas.article-hero-canvas'),'execution article has an accessible static hero and canvas');
  await doc().fonts.ready;
  hero.scrollIntoView({block:'center',behavior:'instant'});await scrollSettled();
  await until(()=>{const rect=hero.getBoundingClientRect();return visible(hero)&&rect.bottom>0&&rect.top<win().innerHeight;},'hero is visible after diagram checks');
  const heroCanvas=hero.querySelector('canvas');
  const heroGl=heroCanvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'low-power'});
  const asynchronousCompile=heroGl?.getExtension('KHR_parallel_shader_compile');
  checks.push('article hero capabilities: '+JSON.stringify({webgl:!!heroGl,asynchronousCompile:!!asynchronousCompile,contextLost:heroGl?.isContextLost(),bounds:hero.getBoundingClientRect().toJSON(),hidden:doc().hidden,busy:win().__engNav?.busy,revealing:doc().body.classList.contains('journey-revealing')}));
  if(asynchronousCompile){
    await until(()=>hero.dataset.renderer==='webgl','article hero draws its WebGL2 scene');
    // The default framebuffer may clear after presentation; inspect the
    // actual accent uniform sent to the shader instead of a stale pixel.
    const accentUniform=()=>{const gl=heroCanvas.getContext('webgl2'),program=gl.getParameter(gl.CURRENT_PROGRAM);return [...gl.getUniform(program,gl.getUniformLocation(program,'u_accent'))].join(',');};
    const initialAccent=accentUniform();
    const targetTheme=doc().documentElement.dataset.theme==='dark'?'catppuccin':'dark';
    for(let i=0;i<10&&doc().documentElement.dataset.theme!==targetTheme;i++)await click('[data-theme-cycle]');
    assert(doc().documentElement.dataset.theme===targetTheme,'theme cycle reaches a distinct palette');
    await until(()=>accentUniform()!==initialAccent,'article hero repaints with the theme palette');
  }else{
    // Software WebGL2 can exist without the nonblocking compilation extension.
    // In that case the runtime deliberately retains its authored primary SVG.
    const poster=hero.querySelector('svg.article-hero-poster'),bounds=poster.getBoundingClientRect();
    assert(poster.isConnected&&poster.querySelector('path,circle,line,rect')&&bounds.width>0&&bounds.height>0&&visible(poster)&&Number(win().getComputedStyle(poster).opacity)>0,'unsupported asynchronous compilation retains visible authored SVG graphics');
    assert(hero.dataset.renderer!=='webgl'&&Number(win().getComputedStyle(heroCanvas).opacity)===0,'unsupported asynchronous compilation keeps the unused canvas hidden');
  }
  for(const width of [320,390]){
    frame.style.width=width+'px';await until(()=>win().innerWidth===width,'diagram viewport '+width);
    const heroBounds=hero.getBoundingClientRect();
    win().scrollTo({left:width*2,top:win().scrollY,behavior:'instant'});
    assert(heroBounds.left>=-1&&heroBounds.right<=width+1&&Math.abs(win().scrollX)<1,'article hero stays inside the mobile viewport without page panning at '+width+'px: '+JSON.stringify({hero:[heroBounds.left,heroBounds.right],scrollX:win().scrollX,scrollWidth:doc().documentElement.scrollWidth}));
    for(const figure of doc().querySelectorAll('.model-figure')){
      const diagram=figure.querySelector('.mermaid'),bounds=figure.getBoundingClientRect();
      assert(bounds.left>=0&&bounds.right<=width&&diagram.clientWidth<=figure.clientWidth,'diagrams stay inside the mobile article at '+width+'px');
      if(diagram.querySelector('svg'))assert(diagram.querySelector('svg').getBoundingClientRect().width<=diagram.clientWidth+1,'rendered diagram fits its frame at '+width+'px');
    }
  }
  frame.style.width='1200px';await until(()=>win().innerWidth===1200,'desktop restored after diagram sizing');
  assert(!visible(previous()),'ordinary navigation to an article creates no previous-page window');
  const identity=doc();
  win().scrollTo({top:600,behavior:'instant'});await delay(80);const articleScroll=win().scrollY;
  await navigate('/shop',{source:'reveal'});
  assert(doc()===identity,'reveal promotion keeps the existing document alive');
  await until(()=>visible(previous()),'article previous window');
  assert(previous().textContent.includes('Execution')||previous().querySelector('[data-journey-resume]'),'article window includes a resume control');
  assert(doc().querySelectorAll('[data-journey-previous]').length===1,'exactly one previous window is retained');
  assert(!previous().querySelector('iframe'),'the compact resume tab never creates a thumbnail iframe');
  assert(previous().querySelector('.journey-previous-title').textContent==='The Execution Marketplace','the resume tab labels the article with its title-cased slug');
  assert(previous().getBoundingClientRect().height<60,'the resume tab occupies one compact row');
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
  const swipeRect=previous().querySelector('[data-journey-resume]').getBoundingClientRect(),frameRect=frame.getBoundingClientRect();
  window.__journeyGesture={x:frameRect.left+swipeRect.right-20,y:frameRect.top+swipeRect.top+swipeRect.height/2};
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
    const oldTagTrack=query('.article-tag-track'),oldWidth=win().innerWidth;
    frame.style.width=width+'px';await until(()=>win().innerWidth===width,'navigation width '+width);
    const tagViewport=query('.article-tags'),category=query('.article-category');
    if(!win().matchMedia('(prefers-reduced-motion: reduce)').matches){
      await until(()=>query('.article-tag-track')&&(oldWidth===width||query('.article-tag-track')!==oldTagTrack),'taxonomy recalculates after resize '+width);
      const runs=tagViewport.querySelectorAll('.article-tag-run'),distance=parseFloat(tagViewport.style.getPropertyValue('--tag-loop-distance'));
      assert(runs.length===2&&runs[1].getAttribute('aria-hidden')==='true','taxonomy has one accessible run and one decorative copy');
      assert(distance>=tagViewport.clientWidth&&Math.abs(runs[0].getBoundingClientRect().width-runs[1].getBoundingClientRect().width)<.5,'measured taxonomy loop covers its viewport with matching seam widths at '+width);
      assert(tagViewport.querySelectorAll('.article-tag-placeholder:not([aria-hidden="true"])').length===0,'redacted filler tags remain decorative');
      if(width===1200)assert(tagViewport.querySelector('.article-tag-placeholder')&&win().getComputedStyle(tagViewport.querySelector('.article-tag-placeholder')).fontFamily.includes('Redacted'),'wide taxonomy fills unused space with the Redacted face');
    }else assert(!query('.article-tag-track')&&!query('.article-tag-placeholder'),'reduced motion keeps the original tags still and scrollable');
    const categoryBox=category.getBoundingClientRect(),tagsBox=tagViewport.getBoundingClientRect(),taxonomyBox=query('.article-taxonomy').getBoundingClientRect();
    assert(categoryBox.right<=tagsBox.left&&Math.abs((categoryBox.top+categoryBox.bottom)-(tagsBox.top+tagsBox.bottom))<2,'category stays first in a single taxonomy row at '+width);
    assert(taxonomyBox.left>=0&&taxonomyBox.right<=width,'taxonomy stays within the article content bounds at '+width);
    await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));
    const navRect=query('.site-nav').getBoundingClientRect(),themeRect=query('[data-theme-cycle]').getBoundingClientRect(),searchRect=query('[data-search-toggle]').getBoundingClientRect();
    const controls=[...doc().querySelectorAll('.site-nav-brand,.site-nav-links > a,.site-search-toggle,[data-theme-cycle]')].filter(visible).map(node=>node.getBoundingClientRect());
    assert(navRect.left>=0&&navRect.right<=width&&Math.abs(themeRect.left+themeRect.width/2-(navRect.left+navRect.width/2))<2&&searchRect.width>=30,'centered theme and visible search at '+width+'px: '+JSON.stringify({nav:navRect,theme:themeRect,search:searchRect}));
    assert(controls.every((rect,index)=>rect.left>=0&&rect.right<=width&&controls.slice(index+1).every(other=>rect.right<=other.left||other.right<=rect.left)),'navigation controls do not overlap at '+width+'px: '+JSON.stringify(controls));
  }
  assert(!query('[data-search-overlay]').open&&!query('.hunt-chip,.home-search'),'search starts closed and the old floating controls are absent');
  await click('[data-search-toggle]');await until(()=>query('[data-search-overlay]').open&&doc().activeElement===query('.site-search-input'),'search opens and focuses its input');
  const searchInput=query('.site-search-input');
  assert(query('[data-search-form]').dataset.searchBound==='true','the modal search form is bound after soft navigation');
  searchInput.value='execution';searchInput.dispatchEvent(new (win().Event)('input',{bubbles:true}));
  await until(()=>visible(query('[data-search-results]'))&&query('.site-search-result a'),'typeahead results inside the search modal');
  assert(query('.site-search-preview-title').textContent===query('.site-search-result-title').textContent,'the first search result has a matching preview');
  assert(query('.site-search-preview-sections li'),'article previews contain real section headings');
  searchInput.value='';searchInput.dispatchEvent(new (win().Event)('input',{bubbles:true}));
  await until(()=>doc().querySelectorAll('.site-search-group').length===4,'browse results include all four content kinds');
  await click('[data-search-kind="coaching"]');
  await until(()=>query('.site-search-preview-link')?.getAttribute('href')==='/coach','coaching filter previews the live coaching page');
  assert(doc().querySelectorAll('.site-search-result').length===1,'coaching filter excludes articles and products');
  await click('[data-search-kind="subscription"]');
  await until(()=>query('.site-search-preview-link')?.getAttribute('href')==='/subscribe','subscription filter previews the newsletter signup');
  assert(query('.site-search-preview-meta').textContent.includes('Free'),'subscription preview is clear that the newsletter is free');
  await click('[data-search-kind=""]');
  await until(()=>doc().querySelectorAll('.site-search-group').length===4,'All restores the grouped result list');
  searchInput.focus();
  await until(()=>query('.site-search-result.is-active'),'first result is selected');
  searchInput.dispatchEvent(new (win().KeyboardEvent)('keydown',{key:'ArrowDown',bubbles:true}));
  assert(searchInput.getAttribute('aria-activedescendant')===query('.site-search-result.is-active').id,'keyboard navigation updates the combobox active descendant');
  assert(query('.site-search-preview-title').textContent===query('.site-search-result.is-active .site-search-result-title').textContent,'keyboard navigation updates the preview');
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
  const tocLink=[...doc().querySelectorAll('.article-toc a')].find(link=>link.hash==='#'+nextHeading.id);
  assert(tocLink,'the article supplies a real native table-of-contents link');tocLink.click();
  await until(()=>win().location.hash==='#'+nextHeading.id&&nextHeading.getBoundingClientRect().top>=0&&nextHeading.getBoundingClientRect().top<win().innerHeight*.5,'native heading link scrolls within the article');
  await scrollSettled();const nextHash=win().location.hash,nextHashScroll=win().scrollY;
  window.__scrollDiagnostic={firstHash,firstHashScroll,nextHash,nextHashScroll};
  win().history.back();await until(()=>win().location.hash===firstHash&&Math.abs(win().scrollY-firstHashScroll)<8,'Back restores the previous same-article heading');
  win().history.forward();await until(()=>win().location.hash===nextHash&&Math.abs(win().scrollY-nextHashScroll)<8,'Forward restores the next same-article heading');
  assert(doc()===identity,'native article heading history stays in the same document');

  if(!win().matchMedia('(prefers-reduced-motion: reduce)').matches){
    await navigate(article);
    await reveal();
    const incoming=win().__engNav.navigate('/shop',{source:'reveal'});
    await until(()=>win().location.pathname==='/shop'&&query('[data-journey-current="shop"]')&&win().__engNav.busy,'incoming reveal is still committing');
    win().history.back();await until(()=>win().location.pathname===article,'back during incoming animation');
    win().history.forward();await until(()=>win().location.pathname==='/shop','forward replaces queued back');
    await incoming;await until(()=>settled()&&query('[data-journey-current="shop"]'),'latest traversal settles at the shop');
    await delay(300);
    assert(win().location.pathname==='/shop'&&query('[data-journey-current="shop"]'),'Back then Forward during animation leaves the newest history entry active');
  }

  // A live destination mounts below the sculpture. Deliberately leave one
  // lifecycle callback pending to prove a completed fetch cannot uncover it.
  await navigate(article);
  const warmedImages=[];
  const warmObserver=new (win().MutationObserver)(records=>{for(const record of records)for(const node of record.addedNodes){if(node.nodeType===1&&node.matches('link[rel="preload"][as="image"]'))warmedImages.push({href:node.href,srcset:node.getAttribute('imagesrcset'),sizes:node.getAttribute('imagesizes')});}});
  warmObserver.observe(doc().head,{childList:true});
  await reveal();await until(()=>warmedImages.length===3,'automatic reveal warms only the critical product row');warmObserver.disconnect();
  assert(warmedImages.every(image=>/-384(?:\.[0-9a-f]{8})?\.webp$/.test(new URL(image.href).pathname)&&image.srcset.includes('160w')&&image.srcset.includes('384w')&&image.srcset.includes('640w')&&image.srcset.includes('900w')&&image.sizes.includes('30vw')),'critical product preloads use the same responsive candidate ladder and viewport sizes as live cards');
  const mountPoster=query('[data-journey-next="shop"]');
  await checkCurtain();
  assert(mountPoster.querySelector('.journey-poster-art canvas')&&mountPoster.querySelector('.journey-poster-art img')&&!mountPoster.querySelector('iframe'),'shop transition uses a sculpture canvas and still instead of a page iframe');
  const mountRemoval=observePosterRemoval(mountPoster);
  let releaseMount,mountStarted=false;
  const mountGate=new Promise(resolve=>{releaseMount=resolve;});
  const removeMountGate=win().__engNav.onSwap(root=>{
    if(root.querySelector('[data-journey-current="shop"]')){mountStarted=true;return mountGate;}
  });
  const gatedMount=win().__engNav.navigate('/shop',{source:'reveal'});
  await until(()=>mountStarted&&query('[data-journey-current="shop"]'),'shop lifecycle callback is pending');
  await delay(150);
  assert(mountPoster.isConnected&&mountPoster.hasAttribute('data-committing')&&win().__engNav.busy&&query('[data-journey-current="shop"]').inert,'poster conceals the inert shop while its mount callback is pending');
  assert(!query('[data-journey-current="shop"]').hasAttribute('data-journey-rendered'),'an unresolved mount is not marked rendered');
  releaseMount();await gatedMount;removeMountGate();await delay(0);
  assert(mountRemoval.state.removedAfterRender&&!mountPoster.isConnected&&query('[data-journey-current="shop"]').dataset.journeyRendered==='true','shop is marked rendered before its poster is removed');
  mountRemoval.disconnect();

  // The managed loader can recover a native CSS font request that remains
  // pending. Only the replacement faces used by the page should gate reveal.
  await navigate(article);await reveal();
  await win().__engTypography.ready;await win().__engTypography.displayReady;
  const nativeFontReadyDescriptor=Object.getOwnPropertyDescriptor(doc().fonts,'ready');
  Object.defineProperty(doc().fonts,'ready',{configurable:true,value:new Promise(()=>{})});
  const fontPoster=query('[data-journey-next="shop"]'),fontRemoval=observePosterRemoval(fontPoster);
  try{
    await promote('/shop');
    assert(fontRemoval.state.removedAfterRender&&!fontPoster.isConnected,'ready managed fonts reveal the destination even while obsolete native font readiness is pending');
  }finally{
    fontRemoval.disconnect();
    if(nativeFontReadyDescriptor)Object.defineProperty(doc().fonts,'ready',nativeFontReadyDescriptor);else delete doc().fonts.ready;
  }

  // Keep a visible product image pending longer than the former two-second
  // timeout. The poster must await its decode, even when all scripts are ready.
  await navigate(article);await reveal();
  const imagePoster=query('[data-journey-next="shop"]'),imageRemoval=observePosterRemoval(imagePoster);
  const imagePrototype=win().HTMLImageElement.prototype,actualDecode=imagePrototype.decode;
  let releaseImage,imageStarted=false,hiddenDecodeCalls=0,hiddenImage;
  const removeHiddenImage=win().__engNav.onSwap(root=>{const page=root.querySelector('[data-journey-current="shop"]');if(!page)return;hiddenImage=page.querySelector('[data-product-card] img').cloneNode(false);hiddenImage.dataset.readinessHidden='true';hiddenImage.style.cssText='position:fixed;inset:0;width:48px;height:48px;visibility:hidden';page.append(hiddenImage);});
  const imageGate=new Promise(resolve=>{releaseImage=resolve;});
  imagePrototype.decode=function(){
    if(this.dataset.readinessHidden==='true')hiddenDecodeCalls++;
    const decoded=actualDecode.call(this);
    if(this.closest('[data-journey-current="shop"]')){imageStarted=true;return Promise.all([decoded.catch(()=>{}),imageGate]);}
    return decoded;
  };
  const gatedImage=win().__engNav.navigate('/shop',{source:'reveal'});
  await until(()=>imageStarted,'visible shop image decode starts');await delay(2200);
  assert(imagePoster.isConnected&&imagePoster.hasAttribute('data-committing')&&win().__engNav.busy&&query('[data-journey-current="shop"]').inert,'a slow visible image remains covered beyond two seconds');
  assert(!query('[data-journey-current="shop"]').hasAttribute('data-journey-rendered'),'pending image decode does not report a completed render');
  releaseImage();await gatedImage;imagePrototype.decode=actualDecode;removeHiddenImage();hiddenImage.remove();await delay(0);
  assert(hiddenDecodeCalls===0,'CSS-hidden image geometry never blocks the visible-image readiness gate');
  assert(imageRemoval.state.removedAfterRender&&!imagePoster.isConnected,'decoded shop content is marked rendered before the sculpture dissolves');
  imageRemoval.disconnect();

  await navigate(article);await reveal();
  await until(()=>!visible(query('.article-toc'))&&win().getComputedStyle(query('.article-toc')).opacity==='0','table of contents fades during the storefront reveal');
  if(!win().matchMedia('(prefers-reduced-motion: reduce)').matches){
    const firstOpacity=Number(win().getComputedStyle(query('.journey-stage-viewport')).opacity);
    win().scrollBy({top:win().innerHeight*.3,behavior:'instant'});await delay(80);
    const laterOpacity=Number(win().getComputedStyle(query('.journey-stage-viewport')).opacity);
    assert(firstOpacity>0&&firstOpacity<1&&laterOpacity>firstOpacity&&laterOpacity<1,'destination poster fades in with scroll progress');
  }
  win().scrollTo({top:0,behavior:'instant'});
  await until(()=>visible(query('.article-toc'))&&win().getComputedStyle(query('.article-toc')).opacity==='1','table of contents returns when scrolling back to the article');
  await reveal();await promote('/shop');
  assert(!doc().body.classList.contains('shop-grid-text-revealing'),'the storefront does not restart text animation after the handoff');
  await until(()=>visible(previous()),'scroll reveal retains article');
  await reveal();
  const coachPoster=query('[data-journey-next="coach"]'),coachRemoval=observePosterRemoval(coachPoster);
  let releaseCoach,coachMountStarted=false;
  const coachGate=new Promise(resolve=>{releaseCoach=resolve;});
  const removeCoachGate=win().__engNav.onSwap(root=>{
    if(root.querySelector('[data-journey-current="coach"]')){coachMountStarted=true;return coachGate;}
  });
  const gatedCoach=win().__engNav.navigate('/coach',{source:'reveal'});
  await until(()=>coachMountStarted&&query('[data-reader]')?.dataset.readerReady==='true','coach mounts behind its poster');
  const coveredWord=query('[data-reader-word]').textContent,coveredMode=query('[data-reader]').dataset.readerMode;
  await delay(1100);
  assert(coachPoster.isConnected&&query('[data-journey-current="coach"]').inert&&query('[data-reader]').dataset.readerPlaying==='false'&&query('[data-reader-word]').textContent===coveredWord,'coaching preserves the first word while its mounted reader is covered');
  releaseCoach();await gatedCoach;removeCoachGate();await delay(0);
  assert(coachRemoval.state.removedAfterRender&&!coachPoster.isConnected&&query('[data-reader]').dataset.readerMode===coveredMode,'coaching reveals a rendered page without changing the chosen reader mode');
  coachRemoval.disconnect();
  if(coveredMode==='speed')await until(()=>query('[data-reader-word]').textContent!==coveredWord,'coaching playback starts after its poster dissolves');
  await until(()=>query('[data-reader]')?.dataset.readerReady==='true','coach reader mounts after shop');
  frame.style.width='360px';await until(()=>win().innerWidth===360,'mobile coach viewport');
  // Wait for the resized iframe's responsive layout before measuring. In
  // reduced-motion Read mode the role also replaces paragraphs ABOVE this
  // control, so compare geometry inside the spectrum, not its page position.
  await win().__engTypography?.ready;
  await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));
  const spectrumHead=query('.coach-spectrum-head'),spectrumTrack=query('.coach-spectrum-track'),spectrumInput=query('[data-spectrum-input]');
  const trackOffset=()=>spectrumTrack.getBoundingClientRect().top-query('.coach-spectrum').getBoundingClientRect().top;
  const headHeight=spectrumHead.getBoundingClientRect().height,trackTop=trackOffset();
  spectrumInput.value='4';spectrumInput.dispatchEvent(new (win().Event)('input',{bubbles:true}));await delay(60);
  assert(query('[data-spectrum-current]').textContent==='Product designer','slider selects the longer mobile role');
  const roleRect=query('[data-spectrum-current]').getBoundingClientRect(),labelRect=spectrumHead.querySelector('label').getBoundingClientRect();
  assert(Math.abs(roleRect.top-labelRect.top)<12&&roleRect.right<=spectrumHead.getBoundingClientRect().right,'long role stays beside the mobile slider label');
  assert(Math.abs(spectrumHead.getBoundingClientRect().height-headHeight)<1&&Math.abs(trackOffset()-trackTop)<1,'long role label does not shift the mobile slider within its control: '+JSON.stringify({before:[headHeight,trackTop],after:[spectrumHead.getBoundingClientRect().height,trackOffset()],css:win().getComputedStyle(spectrumHead).gridTemplateRows,font:win().getComputedStyle(doc().documentElement).fontSize,animations:spectrumHead.getAnimations({subtree:true}).map(a=>a.animationName)}));
  spectrumInput.value='3';spectrumInput.dispatchEvent(new (win().Event)('input',{bubbles:true}));
  frame.style.width='1200px';await until(()=>win().innerWidth===1200,'desktop restored after mobile slider');
  assert(doc().querySelectorAll('[data-journey-previous]').length===1,'coaching replaces the earlier previous page with one storefront window');
  await click('[data-book-open]');await until(()=>query('[data-booking]')?.dataset.bookingState==='calendar','booking sheet opens');
  assert(!visible(previous()),'booking overlay hides the previous-page window');
  await click('[data-booking-close]');await until(()=>query('[data-booking]')?.dataset.bookingState==='closed'&&visible(previous()),'closing booking restores previous window');
  await click('[data-journey-resume]');await until(()=>win().location.pathname==='/shop'&&settled(),'resume storefront');
  assert(!previous()?.textContent.includes('Execution marketplace'),'the ephemeral previous window never retains an article stack');
  await navigate('/coach',{source:'reveal'});await reveal();
  await checkContinueMotion();
  const newsletterPoster=query('[data-journey-next="subscribe"]');
  assert(newsletterPoster&&newsletterPoster.querySelector('h2').textContent==='The newsletter.'&&newsletterPoster.querySelector('.journey-poster-rail').textContent.includes('03'),'coaching reveals the newsletter as the third destination');
  assert(newsletterPoster.querySelector('.journey-poster-credit').textContent.includes('portrait carved into a mask and scrolls added'),'the newsletter sculpture credits its source and additions');
  const newsletterRemoval=observePosterRemoval(newsletterPoster);
  await promote('/subscribe');
  const newsletterHost=query('[data-armillary]');
  assert(doc()===identity&&query('[data-journey-current="subscribe"]')?.dataset.engNext==='/feed','the newsletter joins the same document between coaching and feed');
  assert(doc().querySelectorAll('[data-journey-curtain]').length===1,'newsletter swaps retain one live curtain');
  assert(newsletterRemoval.state.removedAfterRender&&query('[data-journey-current="subscribe"]').dataset.journeyRendered==='true','the newsletter poster dissolves after its signup and scene are ready');
  newsletterRemoval.disconnect();
  assert(query('.newsletter-form').method==='post'&&query('.newsletter-form').getAttribute('action')==='/api/newsletter/subscribe'&&query('#newsletter-email').required,'newsletter promotion retains the headless native signup form');
  assert(query('[data-armillary-sound]').getAttribute('aria-pressed')==='false','newsletter sound stays off without opt-in');
  assert(previous()?.dataset.journeyPrevious==='coach','newsletter promotion retains coaching as its one previous window');
  await reveal();
  assert(query('[data-journey-next="feed"] .journey-poster-rail').textContent.includes('04'),'the feed follows the newsletter as destination four');
  await promote('/feed');
  assert(doc().body.classList.contains('homepage')&&previous()?.dataset.journeyPrevious==='subscribe','the newsletter completes the cycle at the feed');
  assert(!newsletterHost.isConnected&&!query('[data-armillary]'),'leaving the newsletter disposes its old scene');
  await click('[data-journey-resume]');await until(()=>win().location.pathname==='/subscribe'&&settled(),'resumed newsletter remounts');
  assert(query('[data-armillary]')===newsletterHost&&doc().querySelectorAll('[data-armillary]').length===1&&query('[data-armillary-sound]').getAttribute('aria-pressed')==='false','resuming the retained newsletter creates one fresh scene without restarting sound');
  await navigate('/coach',{source:'reveal'});await navigate('/feed',{source:'reveal'});
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

  await checkLazyPayments();

  await navigate(article);
  const actualFetch=win().fetch.bind(win());
  let releaseFetch,started=false;
  win().fetch=(input,options)=>new URL(input?.url||String(input),win().location.href).pathname==='/shop'?new Promise((resolve,reject)=>{started=true;releaseFetch=()=>actualFetch(input,options).then(resolve,reject);options?.signal?.addEventListener('abort',()=>reject(new DOMException('Superseded','AbortError')),{once:true});}):actualFetch(input,options);
  const superseded=win().__engNav.navigate('/shop').catch(()=>{});await until(()=>started,'delayed navigation starts');
  await navigate('/coach');releaseFetch();await superseded;await delay(150);
  assert(win().location.pathname==='/coach'&&query('[data-reader]'),'a superseded fetch cannot overwrite the newer destination');
  win().fetch=actualFetch;

  // A mobile reveal must not depend on a completed HTML prefetch or an
  // IntersectionObserver callback. Exercise the actual scroll path; calling
  // prepareNext directly would conceal the missing automatic preparation.
  frame.style.width='390px';await until(()=>win().innerWidth===390,'mobile cold reveal viewport');
  const actualIntersectionObserver=win().IntersectionObserver;
  win().IntersectionObserver=function(callback,options){
    if(options?.rootMargin)return {observe(){},disconnect(){}};
    return new actualIntersectionObserver(callback,options);
  };
  let rejectPrefetch,prefetchPending=false;
  win().fetch=(input,options)=>new URL(input?.url||String(input),win().location.href).pathname==='/shop'?new Promise((resolve,reject)=>{
    prefetchPending=true;rejectPrefetch=()=>{prefetchPending=false;reject(new TypeError('Synthetic delayed prefetch failure'));};
    options?.signal?.addEventListener('abort',()=>reject(new DOMException('Superseded','AbortError')),{once:true});
  }):actualFetch(input,options);
  await navigate(article);await reveal();
  const delayedPoster=query('[data-journey-next="shop"]'),delayedStill=delayedPoster.querySelector('img');
  await until(()=>delayedStill.complete&&delayedStill.naturalWidth>0,'mobile sculpture fallback decoded');
  assert(prefetchPending&&visible(delayedPoster)&&!delayedStill.hidden,'mobile scrolling reveals the sculpture while destination HTML is still pending and the observer has not fired');
  rejectPrefetch();await until(()=>query('[data-journey-runway]').dataset.failed==='true','delayed prefetch reports failure');
  assert(visible(delayedPoster)&&delayedStill.naturalWidth>0,'a failed background prefetch leaves the sculpture and continue action visible');
  win().fetch=actualFetch;win().IntersectionObserver=actualIntersectionObserver;
  await promote('/shop');

  let stalledRequests=0,stalledAborted=false;
  win().fetch=(input,options)=>{
    if(new URL(input?.url||String(input),win().location.href).pathname==='/shop'&&++stalledRequests===1){
      return new Promise((resolve,reject)=>options?.signal?.addEventListener('abort',()=>{
        stalledAborted=true;reject(new DOMException('Superseded','AbortError'));
      },{once:true}));
    }
    return actualFetch(input,options);
  };
  await navigate(article);await reveal();await promote('/shop');
  assert(stalledAborted&&stalledRequests===2,'Continue abandons a stalled prefetch and successfully makes one fresh foreground request');
  win().fetch=actualFetch;

  let supersededPrefetchRequests=0;
  win().fetch=(input,options)=>{
    if(new URL(input?.url||String(input),win().location.href).pathname==='/shop'){
      supersededPrefetchRequests++;
      return new Promise((resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('Superseded','AbortError')),{once:true}));
    }
    return actualFetch(input,options);
  };
  await navigate(article);await reveal();
  const waitingPromotion=win().__engNav.navigate('/shop',{source:'reveal'});
  await new Promise(resolve=>win().requestAnimationFrame(()=>win().requestAnimationFrame(resolve)));
  await navigate('/coach');const supersededResult=await waitingPromotion;
  assert(supersededResult===false&&supersededPrefetchRequests===1&&win().location.pathname==='/coach','superseding Continue cancels its prefetch wait without issuing a stale foreground request');
  win().fetch=actualFetch;

  // Save-Data keeps the small sculpture still instead of an empty runway,
  // and only downloads the destination after the visitor chooses Continue.
  const connectionDescriptor=Object.getOwnPropertyDescriptor(win().navigator,'connection');
  Object.defineProperty(win().navigator,'connection',{configurable:true,value:{saveData:true}});
  let lowDataPageRequests=0,lowDataModelRequests=0;
  win().fetch=(input,options)=>{
    const path=new URL(input?.url||String(input),win().location.href).pathname;
    if(path==='/shop')lowDataPageRequests++;
    if(path.endsWith('.glb'))lowDataModelRequests++;
    return actualFetch(input,options);
  };
  await navigate(article);await reveal();
  const lowDataPoster=query('[data-journey-next="shop"]'),lowDataStill=lowDataPoster.querySelector('img');
  await until(()=>lowDataStill.complete&&lowDataStill.naturalWidth>0,'Save-Data sculpture still decoded');
  assert(visible(lowDataPoster)&&!lowDataStill.hidden&&lowDataPageRequests===0&&lowDataModelRequests===0,'Save-Data reveals a usable sculpture without next-page or model prefetches');
  await promote('/shop');
  assert(lowDataPageRequests===1&&lowDataModelRequests===0,'Save-Data Continue loads the requested page without a GLB download');
  let lowDataNewsletterRequests=0;
  win().fetch=(input,options)=>{
    const path=new URL(input?.url||String(input),win().location.href).pathname;
    if(path==='/subscribe')lowDataNewsletterRequests++;
    if(path.endsWith('.glb'))lowDataModelRequests++;
    return actualFetch(input,options);
  };
  await navigate('/coach');await reveal();
  const lowDataNewsletter=query('[data-journey-next="subscribe"] img');
  await until(()=>lowDataNewsletter.complete&&lowDataNewsletter.naturalWidth>0,'Save-Data newsletter sculpture decoded');
  assert(lowDataNewsletterRequests===0&&lowDataModelRequests===0,'Save-Data newsletter preview keeps page and GLB requests deferred');
  await promote('/subscribe');
  assert(lowDataNewsletterRequests===1&&query('[data-armillary]').dataset.renderer==='poster'&&lowDataModelRequests===0,'Save-Data newsletter signup uses its rendered static artwork');
  await reveal();await promote('/feed');
  assert(lowDataModelRequests===0&&doc()===identity,'Save-Data completes coaching to newsletter to feed without model downloads');
  win().fetch=actualFetch;
  if(connectionDescriptor)Object.defineProperty(win().navigator,'connection',connectionDescriptor);else delete win().navigator.connection;
  frame.style.width='1200px';await until(()=>win().innerWidth===1200,'desktop restored after cold mobile reveal');

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

  // A class map and its HTML are a deployment unit. A new document may
  // arrive before a cached old one is replaced; never promote mixed classes.
  const mismatchedFetch=actual=>async(input,options)=>{
    const response=await actual(input,options);
    if(!response.headers.get('content-type')?.includes('text/html'))return response;
    const html=await response.text(),parsed=new (win().DOMParser)().parseFromString(html,'text/html');
    const marker=parsed.querySelector('meta[name="eng-css-generation"]');
    assert(marker,'current public HTML declares a CSS generation');
    marker.content='synthetic-next-generation';
    const replacement=new (win().Response)('<!doctype html>'+parsed.documentElement.outerHTML,{status:response.status,headers:response.headers});
    Object.defineProperty(replacement,'url',{value:response.url});
    return replacement;
  };
  const beforeGenerationRecovery=doc();
  win().fetch=mismatchedFetch(win().fetch.bind(win()));
  await win().__engNav.navigate('/shop?__css_test=1',{source:'reveal'});
  await until(()=>doc()!==beforeGenerationRecovery&&win().location.pathname==='/shop'&&settled(),'mixed generation hard recovery');
  assert(doc().querySelector('meta[name="eng-css-generation"]').content!=='synthetic-next-generation','a mixed generation recovers through a fresh whole document');
  const recoveredDocument=doc(),recoveredFetch=win().fetch.bind(win());
  win().fetch=mismatchedFetch(recoveredFetch);
  await win().__engNav.navigate('/shop?__css_test=1');
  assert(doc()===recoveredDocument&&query('[data-journey-runtime] [role="status"]').textContent.includes('updated'),'the same generation pair cannot cause a second automatic reload');
  const onlineDescriptor=Object.getOwnPropertyDescriptor(win().navigator,'onLine');
  Object.defineProperty(win().navigator,'onLine',{configurable:true,value:false});
  try{
    await win().__engNav.navigate('/coach?__css_test=2');
    assert(doc()===recoveredDocument&&query('[data-journey-current="shop"]')&&query('[data-journey-runtime] [role="status"]').textContent.includes('Reconnect'),'offline generation mismatch leaves the current surface readable');
  }finally{
    win().fetch=recoveredFetch;
    if(onlineDescriptor)Object.defineProperty(win().navigator,'onLine',onlineDescriptor);else delete win().navigator.onLine;
  }

  const publicDocument=doc();await win().__engNav.navigate('/articles/big-personality');
  await until(()=>win().location.pathname==='/articles/big-personality'&&doc().readyState==='complete','private boundary navigation');
  assert(doc()!==publicDocument,'entering the private personality experience starts a separate document');
  assert(!query('[data-journey-current],[data-journey-next],[data-journey-previous]'),'private personality introduction stays outside the journey outlets');
  assert(!win().__engNav?.navigate,'private personality document does not load the public router');
  result.textContent='PASS\n'+checks.join('\n');document.body.dataset.testResult='passed';
}catch(error){result.textContent='FAIL\n'+error.stack+'\nURL: '+win()?.location.href+'\nSCROLL: '+win()?.scrollY+' '+JSON.stringify(window.__scrollDiagnostic||{})+'\nHISTORY: '+JSON.stringify(win()?.history.state)+'\nRECENT CHECKS:\n'+checks.slice(-10).join('\n');document.body.dataset.testResult='failed';}
</script></body></html>"##
);

// Deterministic provider contract for native lifecycle/viewport assertions.
// scripts/verify-article-diagrams.mjs separately exercises the real CDN module.
const MERMAID_FIXTURE: &str = concat!(
    r##"
const state=window.__diagramFixture||={loads:0,calls:[]};state.loads++;
let configuration;
export default {
  initialize(value){configuration=value;},
  async render(id,source,scratch){
    state.calls.push({source,busy:window.__engNav?.busy,revealing:document.body.classList.contains('"##,
    token!("journey-revealing"),
    r##"')});
    if(!scratch.isConnected)throw Error('Diagram scratch must belong to the current article');
    const labels=[...source.matchAll(/\["([^"]+)"\]/g)].map(match=>match[1]);
    const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
    return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${Math.max(120,labels.length*30)}" role="img"><rect width="100%" height="100%" fill="${configuration.themeVariables.primaryColor}"/>${labels.map((label,index)=>`<text x="10" y="${25+index*30}" fill="${configuration.themeVariables.primaryTextColor}">${escape(label)}</text>`).join('')}</svg>`};
  }
};
"##
);

#[derive(Clone)]
struct Proxy {
    target: String,
    client: reqwest::Client,
}

async fn forward(State(proxy): State<Proxy>, request: Request<Body>) -> Response {
    let diagrams = request
        .uri()
        .path()
        .starts_with("/assets/js/article-diagrams.");
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
    let is_html = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.contains("text/html"));
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
        // Public pages permit HTTPS images. The proxy's otherwise stricter
        // fixture policy must admit the real author photo for native decoding.
        headers.insert(header::CONTENT_SECURITY_POLICY, "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://engmanager.xyz/cdn-cgi/imagedelivery/; frame-src 'self'; connect-src 'self'; frame-ancestors 'self'".parse().unwrap());
    }
    match response.bytes().await {
        Ok(bytes) if diagrams => (
            status,
            headers,
            String::from_utf8_lossy(&bytes).replace(
                "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs",
                "/__journey_mermaid.mjs",
            ),
        )
            .into_response(),
        Ok(bytes) if is_html && std::env::var("ENG_JOURNEY_DIAGNOSTICS").is_ok() => {
            let html = String::from_utf8_lossy(&bytes).replace("try{return c(m)}catch{}", "try{const entry={source:c.toString().slice(0,300),start:performance.now(),state:'pending'};(window.__journeyMountTimings||=[]).push(entry);const result=c(m);Promise.resolve(result).then(()=>{entry.ms=Math.round(performance.now()-entry.start);entry.state='fulfilled'},()=>{entry.ms=Math.round(performance.now()-entry.start);entry.state='rejected'});return result}catch{}");
            (status, headers, html).into_response()
        }
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
        .route(
            "/__journey_mermaid.mjs",
            get(|| async { ([(header::CONTENT_TYPE, "text/javascript")], MERMAID_FIXTURE) }),
        )
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
        .split("<pre id=\"result\"")
        .nth(1)
        .and_then(|value| value.split_once('>').map(|(_, content)| content))
        .and_then(|value| value.split("</pre>").next())
        .unwrap_or(&dom);
    if std::env::var("ENG_JOURNEY_DIAGNOSTICS").is_ok() {
        std::fs::write(
            format!(
                "/tmp/engmanager-journey-{}.html",
                if reduced_motion { "reduced" } else { "normal" }
            ),
            &dom,
        )
        .unwrap();
    }
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
