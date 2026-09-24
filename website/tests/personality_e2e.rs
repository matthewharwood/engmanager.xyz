//! Real-browser flow tests through a test-only same-origin proxy. The fixture
//! drives the actual UI in an iframe; the production router has no test hooks.

mod common;

use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use axum::Json;
use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode, header};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use common::TestServer;

const FIXTURE: &str = r##"<!doctype html><html><head><meta charset="utf-8"><title>Personality browser checks</title></head><body>
<pre id="result">RUNNING</pre><iframe id="app" title="Assessment under test" style="width:1200px;height:1000px"></iframe>
<script type="module">
const frame=document.querySelector('#app'),result=document.querySelector('#result'),checks=[];
const doc=()=>frame.contentDocument;
const assert=(value,message)=>{if(!value)throw new Error(message);checks.push(message);};
async function until(predicate,label){for(let i=0;i<400;i++){try{if(predicate())return;}catch{}await new Promise(r=>setTimeout(r,50));}throw new Error('Timed out: '+label);}
async function load(path){const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));frame.src=path;await loaded;}
async function go(path,predicate,label){await load('about:blank');await load(path);await until(()=>doc()?.readyState==='complete'&&predicate(),label);}
function click(text){const target=[...doc().querySelectorAll('button,a')].find(n=>n.textContent.trim()===text);if(!target)throw new Error('Missing action: '+text);target.click();}
async function pdfDownload(label){
  const blobs=[],downloads=[],urlApi=frame.contentWindow.URL,originalCreate=urlApi.createObjectURL;
  urlApi.createObjectURL=function(blob){if(blob.type==='application/pdf')blobs.push(blob);return originalCreate.call(this,blob);};
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(node.tagName==='A'&&node.download.endsWith('.pdf')&&node.href.startsWith('blob:'))downloads.push(node.download);}});
  observer.observe(doc().body,{childList:true});
  try{click(doc().querySelector('#report-kit')?'Download scores PDF':'Download PDF');await until(()=>blobs.length===1&&downloads.length===1,label);return new Uint8Array(await blobs[0].arrayBuffer());}
  finally{observer.disconnect();urlApi.createObjectURL=originalCreate;}
}
async function kitDownload(label){
  const blobs=[],downloads=[],urlApi=frame.contentWindow.URL,originalCreate=urlApi.createObjectURL;
  urlApi.createObjectURL=function(blob){if(blob.type.startsWith('text/markdown'))blobs.push(blob);return originalCreate.call(this,blob);};
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(node.tagName==='A'&&node.download.endsWith('.md')&&node.href.startsWith('blob:'))downloads.push(node.download);}});
  observer.observe(doc().body,{childList:true});
  try{click('Download report kit (.md)');await until(()=>blobs.length===1&&downloads.length===1,label);return {text:await blobs[0].text(),filename:downloads[0],bytes:new Uint8Array(await blobs[0].arrayBuffer())};}
  finally{observer.disconnect();urlApi.createObjectURL=originalCreate;}
}
try{
  await go('/articles/big-personality',()=>doc().querySelector('#save-status')?.textContent==='Ready · stored on this device','article boot');
  doc().querySelector('a[data-route="library"]').click();await until(()=>doc().querySelector('.privacy-settings'),'article to offline library');
  click('Make available offline');
  await until(()=>doc().querySelector('.privacy-settings').textContent.includes('Ready offline.'),'install from article entry');
  await until(()=>frame.contentWindow.navigator.serviceWorker.controller?.scriptURL.endsWith('/personality/sw.js'),'article entry produces controlled app document');
  assert(true,'article to library installs a real worker and controls the current app document');
  click('Start a new assessment');await until(()=>doc().querySelector('#scored-profiles'),'prepare boot');
  await until(()=>doc().querySelector('#story-birthday')&&doc().querySelector('#bg04-o01')&&!doc().querySelector('#preface-name')?.disabled,'optional preface questions and name load before the scored questionnaire');
  assert(doc().querySelector('#prepare-story .atlas-studio')&&doc().querySelector('#prepare-story .atlas-editor[open]')&&doc().querySelector('#prepare-story .atlas-question-group[open]'),'birthday and background choices are available on prepare');
  assert(doc().querySelector('.two-column').textContent.includes('170 scored items')&&doc().querySelector('.two-column').textContent.includes('48 preference questions'),'prepare distinguishes the scored questions from story and preference items');
  assert(doc().querySelectorAll('.preface-map a').length===4&&doc().querySelector('.preface-map').textContent.includes('35 background questions'),'prepare offers visible navigation to all optional and scored sections');
  const backgroundQuestions=[...doc().querySelectorAll('#story-background .atlas-question')];
  assert(backgroundQuestions.length===35&&backgroundQuestions.every(card=>card.querySelector('legend')),'every background question has a fieldset and legend');
  const ids=[...doc().querySelectorAll('[id]')].map(node=>node.id);
  assert(ids.length===new Set(ids).size,'the form has no duplicate control IDs');
  assert([...doc().querySelectorAll('#prepare-story input')].every(input=>input.labels?.length||input.getAttribute('aria-label')),'every story input has a programmatic label');
  assert(!doc().querySelector('.atlas-approval,#kit-include-reflection')&&!doc().querySelector('.atlas-question-actions'),'repeated opt-in and skip controls are absent');
  const desktopChoices=[...doc().querySelector('#bg03-o01').closest('.atlas-options').querySelectorAll('label')];
  assert(desktopChoices[0].getBoundingClientRect().top===desktopChoices[1].getBoundingClientRect().top&&desktopChoices[1].getBoundingClientRect().right-desktopChoices[0].getBoundingClientRect().left<740,'desktop choices form a compact reading-width grid');
  frame.style.width='390px';await until(()=>frame.contentWindow.innerWidth===390,'mobile viewport');
  assert(desktopChoices[1].getBoundingClientRect().top>desktopChoices[0].getBoundingClientRect().top,'mobile choices stack in reading order');
  assert(doc().documentElement.scrollWidth<=frame.contentWindow.innerWidth,'mobile form has no horizontal overflow');
  assert(desktopChoices.every(label=>label.getBoundingClientRect().height>=44),'mobile option targets meet the 44-pixel target used by the form');
  frame.style.width='320px';await until(()=>frame.contentWindow.innerWidth===320,'small mobile viewport');
  assert(doc().documentElement.scrollWidth<=frame.contentWindow.innerWidth,'small mobile form has no horizontal overflow');
  frame.style.width='1200px';await until(()=>frame.contentWindow.innerWidth===1200,'desktop viewport restored');
  const prefaceName=doc().querySelector('#preface-name');prefaceName.value='Synthetic Person';prefaceName.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
  await until(()=>doc().querySelector('.preface-name [role="status"]')?.textContent==='Name saved with this assessment on this device.','preface report name saved');
  doc().querySelector('#bg04-o10').click();
  const selfDescription=doc().querySelector('#bg04-self-description');
  assert(!selfDescription.closest('.atlas-self-description').hidden,'self-description opens for the selected response');
  selfDescription.value='A fictional self-description';selfDescription.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
  await until(()=>doc().querySelector('#prepare-story .atlas-studio > .atlas-status')?.textContent==='Story saved on this device.','preface answer saved');
  await go('/personality/prepare',()=>doc().querySelector('#bg04-o10')?.checked&&doc().querySelector('#preface-name')?.value==='Synthetic Person','preface answer and report name restore after refresh');
  assert(doc().querySelector('#bg04-self-description').value==='A fictional self-description'&&!doc().querySelector('#approve-bg04'),'self-description restores without export toggles');
  doc().querySelector('#bg04-o10').closest('fieldset').querySelector('.atlas-clear').click();
  assert(doc().querySelector('#bg04-self-description').closest('.atlas-self-description').hidden,'clearing an answer also hides self-description');
  doc().querySelector('#bg01-o01').click();
  doc().querySelector('#bg01-o01').closest('fieldset').querySelector('.atlas-clear').click();
  assert(!doc().querySelector('#bg01-o01').checked,'clearing leaves the question unanswered');
  await until(()=>doc().querySelector('#prepare-story .atlas-studio > .atlas-status')?.textContent==='Story saved on this device.','preface answer cleared');
  click('Begin questionnaire →');await until(()=>doc().querySelector('#question-0'),'first question');
  doc().querySelector('#question-0 input[value="4"]').click();
  await until(()=>doc().querySelector('#save-status').textContent==='Saved on this device','answer saved');
  click('Next five →');await until(()=>doc().querySelector('#question-5'),'next page');
  const {openStore}=await import('/assets/personality/v1/store.mjs');
  const {encodeSnapshot,encodeSummary,decodeSnapshot,decodeSummary}=await import('/assets/personality/v1/share.mjs');
  const {decodeEnhancedSnapshot}=await import('/assets/personality/v1/enhancement-share.mjs');
  const {createState}=await import('/assets/personality/v1/core.mjs');
  const store=await openStore();
  const {loadStory,loadStorySources}=await import('/assets/personality/v6/story-store.mjs');
  const storySources=await loadStorySources();
  const currentStory=async()=>({value:(await loadStory((await store.loadActive()).id,storySources)).value,sources:storySources});
  const before=await store.loadActive();
  assert(before.state.responses[0]===4&&before.state.cursor.slot===5,'answer and position persisted in IndexedDB');
  await go('/personality/test',()=>doc().querySelector('#question-5'),'refresh restores position');
  const restored=await store.loadActive();
  assert(restored.id===before.id&&restored.revision===before.revision,'refresh restores without rewriting the draft');
  const shared=structuredClone(before.state);shared.responses[0]=1;shared.cursor={module:'big5',slot:0};
  await go('/personality/test#s='+encodeSnapshot(shared),()=>doc().querySelector('#question-0[disabled]'),'shared snapshot');
  assert(doc().querySelector('#question-0 input[value="1"]').checked,'shared answer takes precedence over local answer');
  assert(doc().querySelector('#save-status').textContent==='Shared view · read only','shared view stays read only');
  const afterShared=await store.loadActive();
  assert(afterShared.id===before.id&&afterShared.revision===before.revision&&afterShared.state.responses[0]===4,'opening snapshot leaves local draft untouched');
  await go('/personality/report#s=malformed',()=>doc().querySelector('#save-status')?.textContent==='Invalid shared link','invalid link rejection');
  assert((await store.loadActive()).revision===before.revision,'invalid link leaves local draft untouched');
  click('Open my local assessments');await until(()=>doc().querySelector('.library-row'),'recover local library from invalid link');
  assert(doc().querySelector('.library-row').textContent.includes('1/170 answered'),'invalid-link escape loads existing local assessments');
  const summaryState=createState(['big5']);summaryState.responses.fill(3,0,120);summaryState.cursor={module:'big5',slot:0};summaryState.view='report';
  await go('/personality/report#r='+encodeSummary(summaryState,['O','C']),()=>doc().querySelector('.summary-scores'),'selected summary');
  click('Explore your own profile');await until(()=>doc().querySelector('#scored-profiles')&&!doc().querySelector('.summary-scores'),'leave shared summary');
  assert(!doc().querySelector('[id^=module-]'),'all scored profiles are included without toggles');
  assert((await store.loadActive()).state.responses[0]===4,'summary escape preserves original answers');
  click('Resume questionnaire →');await until(()=>doc().querySelector('#question-5'),'resume full questionnaire');
  click('← Back');await until(()=>doc().querySelector('#question-0'),'complete from first item');
  const expected=Array.from({length:170},(_,slot)=>slot===0?4:(slot*7)%(slot<150?5:6)+1);
  for(let start=0;start<170;start+=5){
    for(let slot=start;slot<start+5;slot++){
      const fieldset=doc().querySelector('#question-'+slot);
      assert(fieldset?.querySelectorAll('input[type="radio"]').length===(slot<150?5:6),'source response scale retained at slot '+slot);
      fieldset.querySelector('input[value="'+expected[slot]+'"]').click();
    }
    await until(()=>doc().querySelector('#save-status').textContent==='Saved on this device','page '+start+' saved');
    if(start===60){
      const checkpoint=await store.loadActive();
      await go('/personality/test',()=>doc().querySelector('#question-60'),'midpoint refresh');
      assert((await store.loadActive()).revision===checkpoint.revision,'midpoint refresh does not mutate committed revision');
      for(let slot=60;slot<65;slot++)assert(doc().querySelector('#question-'+slot+' input[value="'+expected[slot]+'"]').checked,'midpoint UI response restored '+slot);
    }
    click(start===165?'Review answers →':'Next five →');
    await until(()=>start===165?doc().querySelector('.review-list'):doc().querySelector('#question-'+(start+5)),'advance after '+start);
  }
  const completed=await store.loadActive();
  assert(JSON.stringify(completed.state.responses)===JSON.stringify(expected),'all 170 UI responses commit to their exact source slots');
  assert(completed.state.wording==='they'&&completed.state.modules.length===3,'neutral wording and all three scored profiles persist');
  assert(doc().querySelector('.page-header').textContent.includes('170 of 170'),'review reports complete170 coverage');
  click('Read my report →');await until(()=>doc().querySelector('#choose-experiments'),'complete report');
  await until(()=>doc().querySelector('#kit-name')&&!doc().querySelector('#kit-name').disabled,'report kit ready');
  assert(doc().querySelector('#kit-name').value==='Synthetic Person','report kit uses the name saved in the preface');
  assert(doc().querySelector('#report-kit')&&doc().querySelector('.report-hero').textContent.includes('Your personality atlas.'),'report leads with unified atlas workflow');
  assert(!doc().querySelector('#local-reflection-tools').open,'local model setup is secondary and collapsed');
  doc().querySelector('#kit-name').value='Synthetic Person';doc().querySelector('#kit-name').dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
  doc().querySelector('#kit-context').value='A synthetic collaborator should understand my working preferences.';doc().querySelector('#kit-context').dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
  await until(()=>doc().querySelector('.kit-customize [role="status"]').textContent==='Report details saved on this device.','optional kit details saved');
  const {createReportKit}=await import('/assets/personality/v6/report-kit.mjs');
  const beforeKit=await store.loadActive(),expectedKit=createReportKit(beforeKit.state,{name:'Synthetic Person',context:'A synthetic collaborator should understand my working preferences.',story:await currentStory()});
  const downloadedKit=await kitDownload('complete Markdown report kit download');
  assert(downloadedKit.text===expectedKit.text&&downloadedKit.filename===expectedKit.filename,'one actual download contains the complete prompt and exact evidence');
  assert(downloadedKit.bytes[0]===239&&downloadedKit.bytes[1]===187&&downloadedKit.bytes[2]===191,'download includes UTF-8 BOM for editors that otherwise misread punctuation');
  assert(downloadedKit.text.includes('Deliver one downloadable PDF')&&!downloadedKit.text.includes('standalone HTML document'),'download requests a real integrated PDF rather than an HTML artifact');
  assert(downloadedKit.text.includes('Five-movement score')&&downloadedKit.text.includes('Write the main account in third person'),'download uses a consistent five-movement editorial script');
  assert(doc().querySelector('.kit-steps').textContent.includes('Attaching the file avoids long pasted text being clipped.'),'UI recommends attachment to prevent a clipped evidence packet');
  assert((await store.loadActive()).revision===beforeKit.revision,'downloading the kit never rewrites scored answers');
  const beforeAnchor=frame.contentWindow.location.href;
  doc().querySelector('a[data-report-anchor][href="#your-scores"]').click();
  assert(frame.contentWindow.location.href===beforeAnchor,'report navigation scrolls without rewriting a snapshot fragment or reloading');
  const nav=frame.contentWindow.navigator;
  Object.defineProperty(nav,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Clipboard denied for test');}}});
  click('Copy complete kit');
  await until(()=>doc().querySelector('.kit-status').textContent.includes('Clipboard access is unavailable'),'clipboard fallback');
  assert(doc().querySelector('#kit-preview').value===expectedKit.text&&doc().querySelector('#kit-preview').selectionEnd===expectedKit.text.length,'clipboard denial exposes selectable complete kit text');
  delete nav.clipboard;
  await go('/personality/report',()=>doc().querySelector('#kit-name')?.value==='Synthetic Person','kit details survive refresh');
  assert(doc().querySelector('#kit-context').value==='A synthetic collaborator should understand my working preferences.','per-assessment context restores from IndexedDB');
  assert((await store.loadActive()).revision===beforeKit.revision,'optional details and refresh leave scored assessment revision intact');
  doc().querySelector('#kit-context').value='Temporary navigation race note';doc().querySelector('#kit-context').dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
  click('Share this report');await until(()=>doc().querySelector('.share-domains'),'navigate immediately after detail edit');
  doc().querySelector('a[data-route="report"]').click();await until(()=>doc().querySelector('#kit-context')?.value==='Temporary navigation race note','pending details settle before remount');
  doc().querySelector('#kit-context').value='A synthetic collaborator should understand my working preferences.';doc().querySelector('#kit-context').dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
  await until(()=>doc().querySelector('.kit-customize [role="status"]').textContent==='Report details saved on this device.','remounted settings accept next edit without false conflict');
  doc().querySelector('.kit-preview').open=true;
  await until(()=>doc().querySelector('#kit-preview').value.includes('A synthetic collaborator'),'kit preview opens');
  doc().querySelector('#kit-context').value='Updated open preview';doc().querySelector('#kit-context').dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
  await until(()=>doc().querySelector('#kit-preview').value.includes('Updated open preview'),'open preview updates with export details');
  doc().querySelector('#kit-context').value='A synthetic collaborator should understand my working preferences.';doc().querySelector('#kit-context').dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
  await until(()=>doc().querySelector('#kit-preview').value.includes('A synthetic collaborator'),'open preview restored');


  const experiments=doc().querySelectorAll('#choose-experiments input[type="checkbox"]');experiments[0].click();experiments[1].click();
  await until(()=>doc().querySelector('#save-status').textContent==='Saved on this device','report experiments saved');
  const originalFull=await store.loadActive();
  assert(originalFull.state.blocks.length===2&&originalFull.state.reportDate!==null,'chosen experiments and report date are saved');
  click('Share this report');await until(()=>doc().querySelector('input[name="share-kind"][value="snapshot"]'),'full sharing controls');
  doc().querySelector('input[name="share-kind"][value="snapshot"]').click();click('Generate this share link');
  await until(()=>doc().querySelector('.share-output').value,'full share generated');
  const fullURL=doc().querySelector('.share-output').value,fullToken=new URL(fullURL).hash.slice(3);
  assert(new URL(fullURL).search===''&&new URL(fullURL).hash.startsWith('#s='),'full answer link uses only a fragment');
  assert(JSON.stringify(decodeSnapshot(fullToken))===JSON.stringify(originalFull.state),'UI-generated snapshot exactly preserves all answers, wording, date, experiments and saved view');
  await go(fullURL,()=>doc().querySelector('.shared-banner'),'complete shared report');
  assert((await store.loadActive()).revision===originalFull.revision,'complete shared report does not write local state');
  doc().querySelector('a[data-route="review"]').click();await until(()=>doc().querySelector('.review-list'),'readonly review');
  doc().querySelector('.review-row button').click();await until(()=>doc().querySelector('#question-0[disabled]'),'readonly question review');
  click('Next five →');await until(()=>doc().querySelector('#question-5[disabled]'),'readonly page navigation');
  doc().querySelector('a[data-route="share"]').click();await until(()=>doc().querySelector('input[name="share-kind"][value="snapshot"]'),'readonly re-export');
  doc().querySelector('input[name="share-kind"][value="snapshot"]').click();click('Generate this share link');
  await until(()=>doc().querySelector('.share-output').value,'readonly snapshot generated');
  assert(new URL(doc().querySelector('.share-output').value).hash.slice(3)===fullToken,'readonly navigation cannot alter exact snapshot re-export');
  const countBeforeFork=(await store.list()).length;
  click('Save an editable copy on this device');await until(()=>!doc().querySelector('.shared-banner')&&doc().querySelector('#save-status').textContent==='Saved on this device','explicit local fork');
  const forked=await store.loadActive();
  assert(forked.id!==originalFull.id&&(await store.list()).length===countBeforeFork+1,'explicit fork creates one new local assessment');
  assert(JSON.stringify(forked.state)===JSON.stringify(originalFull.state),'fork retains exact source snapshot state');
  doc().querySelector('a[data-route="review"]').click();await until(()=>doc().querySelector('.review-list'),'fork review');
  doc().querySelector('.review-row button').click();await until(()=>doc().querySelector('#question-0:not([disabled])'),'fork is editable');
  doc().querySelector('#question-0 input[value="5"]').click();await until(()=>doc().querySelector('#save-status').textContent==='Saved on this device','fork edit saved');
  assert((await store.loadActive()).state.responses[0]===5,'fork accepts its own answer edit');
  assert(JSON.stringify((await store.load(originalFull.id)).state)===JSON.stringify(originalFull.state),'editing a fork leaves original full report unchanged');
  await go(fullURL,()=>doc().querySelector('.shared-banner'),'snapshot precedence over edited fork');
  assert((await store.loadActive()).id===forked.id&&(await store.loadActive()).state.responses[0]===5,'incoming full snapshot leaves edited active fork intact');
  click('Open my own assessments');await until(()=>doc().querySelectorAll('.library-row').length===2,'open own fork library');
  const originalRow=[...doc().querySelectorAll('.library-row')].find(row=>!row.textContent.includes(' · current'));
  [...originalRow.querySelectorAll('button')].find(button=>button.textContent==='Report').click();
  await until(()=>doc().querySelector('#choose-experiments'),'restore original report through library');
  assert((await store.loadActive()).id===originalFull.id,'library selects original without overwriting either assessment');
  doc().querySelector('#reflection-goal').value='visibility';doc().querySelector('#reflection-format').value='writing';
  doc().querySelector('#reflection-example').value='Private browser regression project note; keep unused text local.';
  click('Save reviewed suggestions');await until(()=>doc().querySelector('.report-enhancement'),'reviewed suggestions render after commit');
  const reflected=await store.loadActive(),kept=await store.loadReflection(reflected.id),frozenText=doc().querySelector('.report-enhancement').textContent;
  assert(kept.context.goal==='visibility'&&kept.context.format==='writing'&&kept.enhancement.sections.length===3,'explicit goal and format save with the reviewed reflection');
  assert(kept.enhancement.sections.some(section=>section.title==='Make reasoning visible'),'writing visibility preference selects a relevant reviewed experiment');
  await go('/personality/report',()=>doc().querySelector('.report-enhancement'),'refresh kept reflection');
  assert((await store.loadActive()).revision===reflected.revision,'reflection refresh does not rewrite assessment or kept prose');
  assert(doc().querySelector('.report-enhancement').textContent===frozenText&&doc().querySelector('#reflection-format').value==='writing','refresh restores exact frozen text and saved preferences');
  assert(doc().querySelector('#reflection-example').value===kept.context.example,'explicitly saved private context survives refresh');
  assert(!doc().querySelector('#kit-include-reflection'),'kept reflection needs no extra toggle');
  const reflectedKit=await kitDownload('kept reflection kit');
  assert(reflectedKit.text===createReportKit((await store.loadActive()).state,{name:'Synthetic Person',context:'A synthetic collaborator should understand my working preferences.',enhancement:kept.enhancement,includeReflection:true,story:await currentStory()}).text,'kept reflection enters the kit with provenance');
  assert(!reflectedKit.text.includes(kept.context.example),'including kept prose still excludes unused private context');
  click('Share this report');await until(()=>doc().querySelector('input[name="share-kind"][value="enhanced"]'),'enhanced sharing controls');
  doc().querySelector('input[name="share-kind"][value="enhanced"]').click();
  assert(doc().querySelector('.reflection-disclosure').textContent.includes(kept.enhancement.sections[0].body),'enhanced sharing discloses the actual frozen prose');
  assert(!doc().querySelector('.reflection-disclosure').textContent.includes(kept.context.example),'unused private example is absent from the share disclosure');
  click('Generate this share link');await until(()=>doc().querySelector('.share-output').value,'enhanced link generated');
  const enhancedURL=doc().querySelector('.share-output').value,enhancedToken=new URL(enhancedURL).hash.slice(3),enhancedPacket=decodeEnhancedSnapshot(enhancedToken);
  assert(new URL(enhancedURL).search===''&&new URL(enhancedURL).hash.startsWith('#e='),'enhanced answers and prose use only a fragment');
  assert(JSON.stringify(enhancedPacket.enhancement)===JSON.stringify(kept.enhancement),'enhanced UI token contains exact kept text and evidence');
  assert(JSON.stringify(enhancedPacket.state)===JSON.stringify((await store.loadActive()).state),'enhanced UI token contains exact associated assessment');
  assert(!JSON.stringify(enhancedPacket).includes(kept.context.example),'unused private context never enters the enhanced packet');
  await go(enhancedURL,()=>doc().querySelector('.report-enhancement')&&doc().querySelector('.shared-banner'),'readonly enhanced report');
  assert(doc().querySelector('.report-enhancement').textContent===frozenText&&!doc().querySelector('#enhance-report'),'shared report displays frozen prose without an editing or generation panel');
  const enhancedPdf=await pdfDownload('shared enhanced PDF blob and download');
  assert(new TextDecoder().decode(enhancedPdf.slice(0,5))==='%PDF-'&&enhancedPdf.length>1000,'shared enhanced report produces a real PDF without model setup');
  assert((await store.loadActive()).revision===reflected.revision&&doc().querySelector('.report-enhancement').textContent===frozenText,'shared PDF preserves local revision and exact kept prose');
  doc().querySelector('a[data-route="share"]').click();await until(()=>doc().querySelector('input[name="share-kind"][value="enhanced"]'),'readonly enhanced re-export');
  doc().querySelector('input[name="share-kind"][value="enhanced"]').click();click('Generate this share link');
  await until(()=>doc().querySelector('.share-output').value,'readonly enhanced link generated');
  assert(new URL(doc().querySelector('.share-output').value).hash.slice(3)===enhancedToken,'readonly enhanced navigation preserves exact serialized text and answers');
  const beforeEnhancedFork=(await store.list()).length;
  click('Save an editable copy on this device');await until(()=>!doc().querySelector('.shared-banner')&&doc().querySelector('#save-status').textContent==='Saved on this device','fork enhanced report');
  const enhancedFork=await store.loadActive();
  assert(enhancedFork.id!==reflected.id&&(await store.list()).length===beforeEnhancedFork+1,'enhanced fork creates one separate local assessment');
  assert(JSON.stringify((await store.loadReflection(enhancedFork.id)).enhancement)===JSON.stringify(kept.enhancement),'enhanced fork keeps the frozen reflection');
  await until(()=>doc().querySelector('#reflection-format'),'editable enhanced fork report');
  doc().querySelector('#reflection-goal').value='visibility';doc().querySelector('#reflection-format').value='demo';
  click('Save reviewed suggestions');await until(()=>doc().querySelector('.report-enhancement')?.textContent!==frozenText,'different format creates separate suggestions');
  const forkReflection=await store.loadReflection(enhancedFork.id);
  assert(forkReflection.context.format==='demo'&&forkReflection.enhancement.sections[0].title==='Show one working slice','identical answers support a separately saved explicit format preference');
  assert(JSON.stringify((await store.loadReflection(reflected.id)))===JSON.stringify(kept),'editing fork preferences preserves original private context and reflection');
  for(const [id,format,text]of [[reflected.id,'writing',frozenText],[enhancedFork.id,'demo',null],[reflected.id,'writing',frozenText]]){
    doc().querySelector('a[data-route="library"]').click();await until(()=>doc().querySelectorAll('.library-row').length===beforeEnhancedFork+1,'library context switch');
    const records=await store.list(),row=doc().querySelectorAll('.library-row')[records.findIndex(record=>record.id===id)];
    [...row.querySelectorAll('button')].find(button=>button.textContent==='Report').click();
    await until(()=>doc().querySelector('#reflection-format')?.value===format,'assessment-specific context restored');
    assert((await store.loadActive()).id===id&&doc().querySelector('#reflection-format').value===format,'library activation loads the selected assessment reflection context');
    if(text)assert(doc().querySelector('.report-enhancement').textContent===text,'library activation restores original frozen writing reflection');
  }
  click('Share this report');await until(()=>doc().querySelector('.share-domains'),'selected summary controls');
  for(const checkbox of doc().querySelectorAll('.share-domains input'))if(!['O','C'].includes(checkbox.value))checkbox.click();
  click('Generate this share link');await until(()=>doc().querySelector('.share-output').value,'selected summary generated');
  const privateSummaryURL=doc().querySelector('.share-output').value;
  const selectedSummary=decodeSummary(new URL(privateSummaryURL).hash.slice(3));
  assert(JSON.stringify(selectedSummary.m.map(entry=>entry[0]))==='["O","C"]','UI summary contains exactly the selected domains');
  assert(!Object.hasOwn(selectedSummary,'responses')&&!Object.hasOwn(selectedSummary,'blocks'),'summary excludes raw responses and report context');
  doc().querySelector('#public-query').click();click('Generate this share link');await until(()=>doc().querySelector('.share-output').value,'explicit public summary generated');
  const publicSummaryURL=doc().querySelector('.share-output').value,publicToken=new URL(publicSummaryURL).searchParams.get('r');
  assert(publicToken&&new URL(publicSummaryURL).hash==='','public query sharing requires its explicit UI selection');
  const beforeAmbiguous=await store.loadActive();
  await go(publicSummaryURL+'#e='+enhancedToken,()=>doc().querySelector('#save-status')?.textContent==='Invalid shared link','ambiguous enhanced and summary rejection');
  assert((await store.loadActive()).revision===beforeAmbiguous.revision,'ambiguous enhanced and summary link cannot replace local answers or reflection');
  await go(publicSummaryURL,()=>doc().querySelector('.summary-scores'),'public selected summary');
  assert(doc().querySelectorAll('.summary-score').length===2&&!doc().querySelector('.review-list'),'public summary remains separate from full report and questionnaire');
  click('Explore your own profile');await until(()=>doc().querySelector('#scored-profiles'),'own workspace after public summary');
  doc().querySelector('a[data-route="review"]').click();await until(()=>doc().querySelector('.review-list'),'return to saved questionnaire');
  doc().querySelector('.review-row button').click();await until(()=>doc().querySelector('#question-0'),'return to original first page');
  click('Next five →');await until(()=>doc().querySelector('#question-5'),'save original resume position');
  doc().querySelector('a[data-route="library"]').click();await until(()=>doc().querySelector('.privacy-settings'),'offline settings');
  click('Make available offline');
  await until(()=>doc().querySelector('.privacy-settings').textContent.includes('Ready offline.'),'worker OFFLINE_READY acknowledgement');
  await until(()=>frame.contentWindow.navigator.serviceWorker.controller?.scriptURL.endsWith('/personality/sw.js'),'scoped worker controls assessment');
  assert(true,'explicit UI installation completes and scoped worker takes control');
  const cacheNames=(await caches.keys()).filter(name=>name.startsWith('personality-v6-')&&!name.includes(':staging:'));
  assert(cacheNames.length===1,'exactly one completed release cache is installed');
  const releaseCache=await caches.open(cacheNames[0]);
  const cacheURLs=(await releaseCache.keys()).map(request=>new URL(request.url));
  assert(cacheURLs.some(url=>url.pathname==='/personality/.offline-ready-v6'),'ready marker commits after public files');
  assert(cacheURLs.every(url=>!url.search&&!url.hash),'offline cache keys contain no answer or share parameters');
  assert(!await caches.match('/__test'),'test fixture is outside the assessment cache');
  await fetch('/__outage',{method:'POST'});
  assert((await fetch('/__network_probe')).status===503,'test origin now refuses all forwarded network requests');
  await go('/personality/test',()=>doc().querySelector('#question-5'),'offline clean-shell reload');
  click('← Back');await until(()=>doc().querySelector('#question-0'),'offline previous answers');
  assert(doc().querySelector('#question-0 input[value="4"]').checked,'offline reload restores local answers and saved position');
  for(const path of ['prepare','test','review','report','share','library']){
    await go('/personality/'+path,()=>doc().querySelector('.page-header,.quiz-header'),'offline '+path+' route');
    assert(!doc().querySelector('#action-error'),'offline '+path+' route restores its public shell and app');
  }
  await go('/personality/report#r='+encodeSummary(summaryState,['O','C']),()=>doc().querySelector('.summary-scores'),'offline shared summary');
  assert(doc().querySelectorAll('.summary-score').length===2,'shared summary verifies and renders from cached public files during outage');
  await go('/personality/report',()=>[...doc().querySelectorAll('button')].some(button=>button.textContent==='Download scores PDF'),'offline own report');
  const pdfBytes=await pdfDownload('offline PDF blob and download anchor');
  assert(new TextDecoder().decode(pdfBytes.slice(0,5))==='%PDF-'&&pdfBytes.length>1000,'real PDF button builds a PDF blob and download while origin is unavailable');
  assert(doc().querySelector('.report-enhancement').textContent===frozenText,'offline PDF and report preserve saved reflection without generation');
  const offlineKit=await kitDownload('offline report kit download');
  assert(offlineKit.text===createReportKit((await store.loadActive()).state,{name:'Synthetic Person',context:'A synthetic collaborator should understand my working preferences.',enhancement:kept.enhancement,includeReflection:true,story:await currentStory()}).text,'complete report kit downloads with saved optional details while the origin is unavailable');
  await until(()=>doc().querySelector('#bg04-o01'),'optional story questions load from the offline release');
  const scoredBeforeStory=(await store.loadActive()).revision;
  doc().querySelector('#bg04-o01').click();
  const birthday=doc().querySelector('#story-birthday');birthday.value='1990-09-10';birthday.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
  assert(!doc().querySelector('[id^=symbol-]'),'birthday and tarot have no inclusion toggles');
  await until(()=>doc().querySelectorAll('.atlas-mini-spread figure').length===3&&doc().querySelector('.atlas-studio > .atlas-status')?.textContent==='Story saved on this device.','optional story and draw saved');
  const storyKit=await kitDownload('complete story kit download');
  assert(storyKit.text.includes('your-story-packet-v2')&&storyKit.text.includes('"id": "bg04"'),'answered background question enters kit');
  assert(storyKit.text.includes('"sign": "Virgo"')&&storyKit.text.includes('"cards": ['),'derived symbols and saved draw enter kit');
  assert(!storyKit.text.includes('1990-09-10'),'full birthday stays out of kit');
  const firstDrawId=doc().querySelector('[data-draw-id]').dataset.drawId;
  click('Draw three new cards');
  await until(()=>doc().querySelector('[data-draw-id]')?.dataset.drawId!==firstDrawId&&doc().querySelector('.atlas-studio > .atlas-status')?.textContent==='Story saved on this device.','explicit redraw creates and saves a new spread');
  assert(doc().querySelectorAll('.atlas-mini-spread figure').length===3,'redraw keeps a complete three-card spread');
  assert((await store.loadActive()).revision===scoredBeforeStory,'story edits never revise the scientific answers');
  await go('/personality/report',()=>doc().querySelector('#bg04-o01')?.checked,'optional story restores after refresh');
  assert(!doc().querySelector('#approve-bg04')&&doc().querySelectorAll('.atlas-mini-spread figure').length===3,'draw restores without per-answer approval');
  await go(enhancedURL,()=>doc().querySelector('.report-enhancement')&&doc().querySelector('.shared-banner'),'offline enhanced shared report');
  assert(doc().querySelector('.report-enhancement').textContent===frozenText,'enhanced snapshot verifies and renders its exact kept prose offline');
  assert((await store.loadActive()).state.responses[0]===4,'offline reports and PDF generation preserve original answers');
  const requests=await (await fetch('/__requests')).json();
  assert(requests.every(request=>request.method==='GET'),'ordinary assessment, sharing and PDF make no answer-submission requests');
  assert(requests.every(request=>{const url=new URL(request.uri,location.origin);return !url.search||(url.pathname==='/personality/report'&&url.searchParams.size===1&&url.searchParams.get('r')===publicToken);}), 'request queries contain only the explicitly opted-in public score summary');
  assert(requests.every(request=>!request.uri.includes(fullToken)&&!(request.referrer||'').includes(fullToken)), 'full answer token never appears in request URL or referrer');
  assert(requests.every(request=>!request.uri.includes(enhancedToken)&&!(request.referrer||'').includes(enhancedToken)), 'enhanced answer and prose token never appears in request URL or referrer');
  assert(requests.every(request=>!request.uri.includes('ai/v1/')&&!request.uri.includes('litert')&&!request.uri.includes('huggingface')), 'ordinary and reviewed reflection flows never load the optional model runtime');
  assert(requests.filter(request=>new URL(request.uri,location.origin).searchParams.has('r')).every(request=>!request.referrer?.includes(publicToken)), 'public score query is not propagated through subresource referrers');
  store.close();result.textContent='PASS\n'+checks.join('\n');document.body.dataset.testResult='passed';
}catch(error){result.textContent='FAIL\n'+error.stack+'\nAPP: '+doc()?.querySelector('#save-status')?.textContent+'\n'+doc()?.querySelector('#action-error')?.textContent+'\nREFLECTION: '+doc()?.querySelector('#enhance-report [role="status"]')?.textContent+'\nRECENT CHECKS: '+checks.slice(-6).join('\n');document.body.dataset.testResult='failed';}
</script></body></html>"##;

#[derive(Clone)]
struct Proxy {
    target: String,
    client: reqwest::Client,
    unavailable: Arc<AtomicBool>,
    requests: Arc<Mutex<Vec<serde_json::Value>>>,
}

async fn forward(State(proxy): State<Proxy>, request: Request<Body>) -> Response {
    proxy.requests.lock().unwrap().push(serde_json::json!({"method":request.method().as_str(),"uri":request.uri().to_string(),"referrer":request.headers().get(header::REFERER).and_then(|value|value.to_str().ok())}));
    if proxy.unavailable.load(Ordering::SeqCst) {
        return (StatusCode::SERVICE_UNAVAILABLE, "Test origin unavailable").into_response();
    }
    let target = format!("{}{}", proxy.target, request.uri());
    let response = match proxy.client.get(target).send().await {
        Ok(response) => response,
        Err(error) => return (StatusCode::BAD_GATEWAY, error.to_string()).into_response(),
    };
    let status = response.status();
    let mut headers = response.headers().clone();
    headers.remove(header::CONTENT_LENGTH);
    headers.remove(header::TRANSFER_ENCODING);
    // The fixture needs same-origin iframe access to click the real UI. Only
    // this test proxy relaxes framing; production DENY/frame-ancestors headers
    // are covered directly by router tests. All script/connect CSP remains.
    headers.remove(header::X_FRAME_OPTIONS);
    if let Some(csp) = headers
        .get(header::CONTENT_SECURITY_POLICY)
        .and_then(|v| v.to_str().ok())
    {
        let csp = csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'");
        headers.insert(header::CONTENT_SECURITY_POLICY, csp.parse().unwrap());
    }
    match response.bytes().await {
        Ok(bytes) => (status, headers, bytes).into_response(),
        Err(error) => (StatusCode::BAD_GATEWAY, error.to_string()).into_response(),
    }
}

fn chrome() -> Option<PathBuf> {
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
}
impl Drop for ChromeProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
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

async fn dump_dom(chrome: PathBuf, url: &str) -> String {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let profile = std::env::temp_dir().join(format!(
        "personality-browser-{}-{nonce}",
        std::process::id()
    ));
    let child = Command::new(chrome)
        .args([
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-dev-shm-usage",
            "--remote-debugging-port=0",
        ])
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg(url)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn Chrome");
    let process = ChromeProcess { child, profile };
    let deadline = Instant::now() + Duration::from_secs(60);
    let debugging_port = loop {
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
        id += 1;
        let expression = if Instant::now() < deadline {
            "document.body?.dataset.testResult ? document.documentElement.outerHTML : null"
        } else {
            "document.documentElement.outerHTML"
        };
        let request = serde_json::json!({"id":id,"method":"Runtime.evaluate","params":{"expression":expression,"returnByValue":true}});
        send_frame(
            socket.get_mut(),
            1,
            request.to_string().as_bytes(),
            (nonce as u32).wrapping_add(id),
        );
        let response: serde_json::Value = loop {
            let value: serde_json::Value =
                serde_json::from_slice(&receive_message(&mut socket)).expect("CDP JSON");
            if value["id"] == id {
                break value;
            }
        };
        if let Some(dom) = response["result"]["result"]["value"].as_str() {
            return dom.to_string();
        }
        assert!(
            Instant::now() < deadline,
            "Browser fixture never returned a DOM"
        );
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn answers_sharing_offline_and_pdf_work_in_browser() {
    let Some(chrome) = chrome() else {
        assert!(
            std::env::var("REQUIRE_BROWSER_TESTS").is_err(),
            "Chrome is required in CI; set CHROME_BIN"
        );
        eprintln!("skipping personality browser test: Chrome not found");
        return;
    };
    let server = TestServer::start(None).await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("test proxy port");
    let port = listener.local_addr().unwrap().port();
    let router = axum::Router::new()
        .route("/__test", get(|| async { Html(FIXTURE) }))
        .route(
            "/__requests",
            get(|State(proxy): State<Proxy>| async move {
                Json(proxy.requests.lock().unwrap().clone())
            }),
        )
        .route(
            "/__outage",
            post(|State(proxy): State<Proxy>| async move {
                proxy.unavailable.store(true, Ordering::SeqCst);
                StatusCode::NO_CONTENT
            }),
        )
        .fallback(forward)
        .with_state(Proxy {
            target: format!("http://127.0.0.1:{}", server.port),
            client: reqwest::Client::new(),
            unavailable: Arc::new(AtomicBool::new(false)),
            requests: Arc::new(Mutex::new(Vec::new())),
        });
    let proxy = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    let dom = dump_dom(chrome, &format!("http://127.0.0.1:{port}/__test")).await;
    proxy.abort();
    let diagnostic = dom
        .split("<pre id=\"result\">")
        .nth(1)
        .and_then(|value| value.split("</pre>").next())
        .unwrap_or(&dom);
    assert!(
        dom.contains("data-test-result=\"passed\""),
        "Browser checks did not pass:\n{diagnostic}"
    );
}
