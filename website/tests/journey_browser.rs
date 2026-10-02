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
  const hero=query('[data-article-hero="the-execution-marketplace"]');
  assert(hero&&hero.querySelector('svg.article-hero-poster')&&hero.querySelector('canvas.article-hero-canvas'),'execution article has an accessible static hero and canvas');
  hero.scrollIntoView({behavior:'instant'});
  const heroCanvas=hero.querySelector('canvas');
  if(heroCanvas.getContext('webgl2')){
    await until(()=>hero.dataset.renderer==='webgl','article hero draws its WebGL2 scene');
    // The default framebuffer may clear after presentation; inspect the
    // actual accent uniform sent to the shader instead of a stale pixel.
    const accentUniform=()=>{const gl=heroCanvas.getContext('webgl2'),program=gl.getParameter(gl.CURRENT_PROGRAM);return [...gl.getUniform(program,gl.getUniformLocation(program,'u_accent'))].join(',');};
    const initialAccent=accentUniform();
    const targetTheme=doc().documentElement.dataset.theme==='dark'?'catppuccin':'dark';
    for(let i=0;i<10&&doc().documentElement.dataset.theme!==targetTheme;i++)await click('[data-theme-cycle]');
    assert(doc().documentElement.dataset.theme===targetTheme,'theme cycle reaches a distinct palette');
    await until(()=>accentUniform()!==initialAccent,'article hero repaints with the theme palette');
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
  await navigate(article);await reveal();
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
  let releaseImage,imageStarted=false;
  const imageGate=new Promise(resolve=>{releaseImage=resolve;});
  imagePrototype.decode=function(){
    const decoded=actualDecode.call(this);
    if(this.closest('[data-journey-current="shop"]')){imageStarted=true;return Promise.all([decoded.catch(()=>{}),imageGate]);}
    return decoded;
  };
  const gatedImage=win().__engNav.navigate('/shop',{source:'reveal'});
  await until(()=>imageStarted,'visible shop image decode starts');await delay(2200);
  assert(imagePoster.isConnected&&imagePoster.hasAttribute('data-committing')&&win().__engNav.busy&&query('[data-journey-current="shop"]').inert,'a slow visible image remains covered beyond two seconds');
  assert(!query('[data-journey-current="shop"]').hasAttribute('data-journey-rendered'),'pending image decode does not report a completed render');
  releaseImage();await gatedImage;imagePrototype.decode=actualDecode;await delay(0);
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
  const newsletterPoster=query('[data-journey-next="subscribe"]');
  assert(newsletterPoster&&newsletterPoster.querySelector('h2').textContent==='The newsletter.'&&newsletterPoster.querySelector('.journey-poster-rail').textContent.includes('03'),'coaching reveals the newsletter as the third destination');
  assert(newsletterPoster.querySelector('.journey-poster-credit').textContent.includes('folded letter and seal added'),'the newsletter sculpture credits its source and additions');
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
