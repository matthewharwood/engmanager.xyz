import {BANK, MODULES} from './bank.mjs';
import {createState, validateState, selectedSlots, itemText, score} from './core.mjs';
import {openStore, serializeBackup} from './store.mjs';
import {encodeSnapshot, encodeSummary, readIngress, verifyPublicAssets} from './share.mjs';
import {createReport, renderReport} from './report.mjs';
import {EXPERIMENTS} from './report-content.mjs';
import {createContext,assessmentBasis} from './enhancement.mjs';
import {mountReflection} from './reflection-ui.mjs';
import {encodeEnhancedSnapshot,readEnhancedIngress,exportReflection,importReflection} from './enhancement-share.mjs';

const main = document.querySelector('#personality-app');
const status = document.querySelector('#save-status');
const layout = document.querySelector('.personality-layout');
const labels = {prepare:'Before you begin', test:'Your questionnaire', review:'Review your answers', report:'Your report', share:'Choose what to share', library:'Saved on this device', article:'Why understand yourself?'};
const viewRoute = {instructions:'prepare', assessment:'test', review:'review', report:'report'};
let state = createState(), record = null, db = null, ingress = {kind:'none'}, readOnly = false;
let queue = Promise.resolve(), saveFailure = null, pending = 0, audioEnabled = false, renderId = 0, ingressBlocked = false, bootReady = false, sharedCursor = null;
let reflectionContext=createContext(),enhancement=null,disposeReflection=null;
const currentEnhancement=()=>enhancement?.basis===assessmentBasis(state)?enhancement:null;
const reportModel=()=>createReport(state,score(state),currentEnhancement());
const route = () => location.pathname === '/articles/big-personality' ? 'article' : location.pathname.split('/')[2] || 'prepare';
const clone = value => structuredClone(value);

// Only source-controlled strings become attributes. All content uses textContent.
function el(tag, text, attrs = {}, children = []) {
  const node = document.createElement(tag);
  if (text !== null && text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'on') for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    else if (value !== false && value !== null) node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children); return node;
}
const p = (text, cls = '') => el('p', text, {class:cls});
const button = (text, action, secondary = false) => el('button', text, {type:'button', class:`button${secondary ? ' secondary' : ''}`, on:{click:() => run(action)}});
const actions = (...nodes) => el('div', null, {class:'actions'}, nodes);
const link = (text, href, cls = '') => el('a', text, {href,class:cls});
const hardLink = (text, href, cls = '') => el('a', text, {href,class:cls,'data-document-navigation':true});
function heading(kicker, title, text) { return el('header', null, {class:'page-header'}, [p(kicker,'eyebrow'),el('h1',title),p(text,'lede')]); }
function notice(text, kind = '') { return el('div', text, {class:`notice ${kind}`,role:kind === 'error' ? 'alert' : 'note'}); }
function announce(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
function showError(error) {
  const previous = document.querySelector('#action-error'); previous?.remove();
  const node = notice(error?.message || String(error), 'error'); node.id = 'action-error'; main.prepend(node);
}
async function run(action) { try { await action(); } catch (error) { showError(error); } }
function updateStatus() {
  if (readOnly) announce('Shared view · read only');
  else if (saveFailure) announce('Not saved · export a backup', true);
  else if (!db) announce('Session only · export a backup', true);
  else if (pending) announce('Saving on this device…');
  else announce(record ? 'Saved on this device' : 'Ready · stored on this device');
}
function persist() {
  if (readOnly) return Promise.resolve();
  const snapshot = validateState(state);
  pending++; updateStatus();
  queue = queue.then(async () => {
    if (saveFailure || !db) return;
    try { record = record ? await db.save(record.id,record.revision,snapshot) : await db.create(snapshot); }
    catch (error) { saveFailure = error; }
  }).finally(() => { pending--; updateStatus(); });
  return queue;
}
async function flush() { await queue; }
async function navigate(next, {update = true} = {}) {
  if (!labels[next]) return;
  if (ingressBlocked) { location.assign(next === 'article' ? '/articles/big-personality' : '/personality/library'); return; }
  if (route() === 'article' && next !== 'article') { await flush(); location.assign(`/personality/${next}`); return; }
  if (next === 'article' || (readOnly && next === 'library')) { await flush(); location.assign(next === 'article' ? '/articles/big-personality' : '/personality/library'); return; }
  if (update && !readOnly && ['test','review','report'].includes(next)) {
    state.cursor ??= {module:state.modules[0],slot:MODULES.find(m=>m.id===state.modules[0]).start};
    state.view = {test:'assessment',review:'review',report:'report'}[next];
    if (next === 'report') state.reportDate ??= new Date().toISOString().slice(0,10);
    await persist();
  } else await flush();
  history.pushState(null,'',`/personality/${next}${readOnly ? location.search + location.hash : ''}`);
  layout.dataset.mobileOpen = 'false'; render(); main.focus(); window.scrollTo(0,0);
}
function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], {type}));
  const anchor = link('',url); anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function backup() { await flush(); download(serializeBackup(state),'big-six-seven-backup.json','application/json'); }
async function enableStore() {
  if (db) return db;
  const opening = openStore({onBlocked:message=>{saveFailure=new Error(message);updateStatus();},onChange:({id,revision})=>{
    if (record?.id===id && revision!==record.revision && !pending) {
      saveFailure = new Error('This assessment changed in another tab. Reload to use its latest answers, or save your current answers as a new copy.');
      updateStatus(); showError(saveFailure);
    }
  }});
  let timeout;
  try { db = await Promise.race([opening,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Local storage did not open. You can continue in this tab and download a backup.')),3500);})]); }
  catch(error) { opening.then(connection=>{if(!db)connection.close();}).catch(()=>{});throw error; }
  finally { clearTimeout(timeout); }
  return db;
}
async function saveCopy() {
  await flush(); await enableStore(); record = await db.fork(state); saveFailure = null;
  if(currentEnhancement())record=await db.saveReflection(record.id,record.revision,{context:reflectionContext,enhancement:currentEnhancement()});
  readOnly=false; ingress={kind:'none'};
  history.replaceState(null,'',`/personality/${viewRoute[state.view]}`); updateStatus(); render();
}
function sharedBanner() {
  const node = notice('You are viewing a self-contained shared snapshot. Its answers are visible to anyone with this link. Your own saved work has not changed.');
  node.classList.add('shared-banner');
  node.append(actions(button('Save an editable copy on this device',saveCopy,true),link('Open my own assessments','/personality/library')));
  return node;
}
function storageWarning() {
  if (readOnly || (db && !saveFailure)) return null;
  const node=notice(saveFailure?.message || 'Local saving is unavailable. Keep this tab open and download a backup before leaving.','warning');
  node.append(actions(button('Download current answers',backup,true),button('Save as a new local copy',saveCopy,true)));
  return node;
}
function play(name) { if(audioEnabled&&!readOnly){const cue=new Audio(`/assets/personality/v1/media/${name}.mp3`);cue.volume=.15;cue.play().catch(()=>{});} }
function pageSlots() {
  const current = (readOnly ? sharedCursor : state.cursor) ?? {module:state.modules[0],slot:MODULES.find(m=>m.id===state.modules[0]).start};
  const module = MODULES.find(m=>m.id===current.module);
  const start = module.start + Math.floor((current.slot-module.start)/5)*5;
  return BANK.items.slice(start,Math.min(start+5,module.end));
}

function prepare() {
  main.append(heading('01 / Before you begin','A field guide. Not a fixed identity.','Explore your patterns, the work that interests you, and what matters when you make a choice. Then turn that reflection into a small, useful experiment.'));
  const columns=el('div',null,{class:'two-column'}), form=el('section',null,{class:'panel'});
  form.append(el('h2','Choose your profiles'),p('The Big Five is the foundation. The two optional profiles ask different questions. Allow roughly 20–30 minutes for all 170 items; you can return at any point.'));
  const descriptions={big5:'120 items · five broad traits and 30 narrower facets. Describe yourself across your life, not only at work.',interests:'30 activities · six kinds of work you may enjoy. For career exploration; interest is different from ability.',values:'20 portraits · ten personal priorities. What matters to you when attractive choices compete?'};
  for(const module of MODULES){
    const input=el('input',null,{type:'checkbox',id:`module-${module.id}`,checked:state.modules.includes(module.id),disabled:module.required||readOnly});
    input.addEventListener('change',()=>{state.modules=MODULES.filter(m=>m.required||document.querySelector(`#module-${m.id}`).checked).map(m=>m.id);if(state.cursor&&!state.modules.includes(state.cursor.module))state.cursor={module:'big5',slot:0};persist();});
    form.append(el('div',null,{class:'module-choice'},[input,el('label',null,{for:input.id},[el('strong',module.label),el('small',descriptions[module.id])])]));
  }
  const wording=el('select',null,{id:'wording',disabled:readOnly});
  for(const [value,text]of[['they','They / them'],['she','She / her'],['he','He / him']])wording.append(el('option',text,{value,selected:state.wording===value}));
  wording.addEventListener('change',()=>{state.wording=wording.value;persist();});
  form.append(el('div',null,{class:'field'},[el('label','Pronouns used in the values portraits',{for:'wording'}),wording,p('This changes how the portraits are worded; it is not a demographic question.','small')]));
  form.append(actions(button(state.cursor?'Resume questionnaire →':'Begin questionnaire →',()=>navigate('test')),button('Review current answers',()=>navigate('review'),true)));
  const notes=el('aside',null,{class:'panel'},[p('YOUR ANSWERS, YOUR DEVICE','eyebrow'),el('h2','Room to be honest.'),el('ul',null,{class:'method-list'},[
    el('li',null,{},[el('strong','Saved as you go'),p('Answers stay in this browser’s IndexedDB. Refreshing brings you back. Browser data can be cleared, so keep a JSON backup.')]),
    el('li',null,{},[el('strong','You choose what leaves'),p('Download a PDF, share selected scores, or create a link containing your complete answers. There is no respondent account or remote answer store.')]),
    el('li',null,{},[el('strong','No “ideal engineer” score'),p('These are established questionnaires, not a clinical assessment or a hiring screen. Interests and values complement personality; they are not independent sixth and seventh personality factors.')])
  ])]);
  columns.append(form,notes);main.append(columns);
}

function questionnaire() {
  const items=pageSlots(), module=MODULES.find(m=>m.id===items[0].module), coverage=score(state).completion;
  main.append(el('header',null,{class:'quiz-header'},[p(`${state.modules.indexOf(module.id)+1} / ${state.modules.length} · ${module.instrument}`,'eyebrow'),el('h1',module.label),el('div',null,{class:'progress-meta'},[el('span',`${coverage.answered} of ${coverage.total} answered`),el('span',`${items[0].slot-module.start+1}–${items.at(-1).slot-module.start+1} of ${module.count} in this profile`)]),el('progress',null,{class:'assessment-progress',value:coverage.answered,max:coverage.total,'aria-label':'Questions answered'})]));
  const instructions=el('details',null,{class:'module-instructions',open:items[0].slot===module.start},[el('summary',`How to answer · ${module.label}`)]);
  module.instructions.split('\n\n').forEach(text=>instructions.append(p(text)));
  if(module.id==='interests')instructions.append(p('Explore the kinds of work you enjoy. Your report links to O*NET career exploration after you finish.'));
  instructions.append(p(module.attribution,'small'));main.append(instructions);
  for(const item of items){
    const fieldset=el('fieldset',null,{class:'question-card',id:`question-${item.slot}`,disabled:readOnly});
    fieldset.append(el('legend',null,{},[el('span',`Item ${item.slot-module.start+1} / ${module.count}`,{class:'item-number'}),document.createTextNode(itemText(item,state.wording))]));
    const options=el('div',null,{class:'answers',style:`--options:${module.options.length}`});
    const indicator=el('span',answerStatus(item.slot),{class:'question-status','data-answered':state.responses[item.slot]!==null});
    for(const option of module.options){
      const input=el('input',null,{type:'radio',name:item.id,value:option.value,checked:state.responses[item.slot]===option.value});
      input.addEventListener('change',()=>{state.responses[item.slot]=option.value;state.skipped[item.slot]=false;state.cursor={module:item.module,slot:item.slot};state.view='assessment';state.reportDate=null;indicator.textContent='Answered';indicator.dataset.answered='true';persist();updateProgress();});
      options.append(el('label',null,{class:'answer-option'},[input,el('span',option.label)]));
    }
    const skip=el('button','Skip for now',{type:'button',class:'text-button'});
    skip.addEventListener('click',()=>{state.responses[item.slot]=null;state.skipped[item.slot]=true;state.reportDate=null;state.cursor={module:item.module,slot:item.slot};state.view='assessment';fieldset.querySelectorAll('input').forEach(input=>input.checked=false);indicator.textContent='Skipped';indicator.dataset.answered='false';persist();updateProgress();});
    fieldset.append(options,el('div',null,{class:'question-tools'},[skip,indicator]));main.append(fieldset);
  }
  const slots=selectedSlots(state), first=slots.indexOf(items[0].slot), after=slots.indexOf(items.at(-1).slot)+1;
  main.append(el('div',null,{class:'actions quiz-actions'},[p(readOnly?'Read-only snapshot. Save a copy to change answers.':'No time limit. Skipping is okay; incomplete scales stay unscored.','small'),button('← Back',async()=>{if(first===0)return navigate('prepare');await jump(slots[Math.max(0,first-5)]);},true),button(after===slots.length?'Review answers →':'Next five →',async()=>{if(after===slots.length)return navigate('review');if(BANK.items[slots[after]].module!==module.id)play('section-complete');await jump(slots[after]);})]));
}
function answerStatus(slot){return state.responses[slot]!==null?'Answered':state.skipped[slot]?'Skipped':'Not answered';}
function updateProgress(){const coverage=score(state).completion;const progress=main.querySelector('progress');if(progress)progress.value=coverage.answered;const text=main.querySelector('.progress-meta span');if(text)text.textContent=`${coverage.answered} of ${coverage.total} answered`;}
async function jump(slot){if(readOnly)sharedCursor={module:BANK.items[slot].module,slot};else{state.cursor={module:BANK.items[slot].module,slot};state.view='assessment';await persist();}await navigate('test',{update:false});}

function review(){
  const result=score(state);main.append(heading('03 / Review your answers','A moment to check in.',`${result.completion.answered} of ${result.completion.total} selected items are answered. You can revisit any item, or read a partial report. Missing answers are never filled in for you.`));
  const cards=el('div',null,{class:'coverage-grid'});
  for(const id of state.modules){const module=MODULES.find(m=>m.id===id);const answered=BANK.items.filter(i=>i.module===id&&state.responses[i.slot]!==null).length;cards.append(el('section',null,{class:'coverage-card'},[el('h3',module.label),el('div',null,{class:'coverage-number'},[document.createTextNode(String(answered)),el('small',`/ ${module.count}`)]),p(answered===module.count?'Complete':'Remaining items can be answered later.','small')]));}
  main.append(cards,actions(button('Read my report →',async()=>{play('report-ready');await navigate('report');}),button('Back to questionnaire',()=>navigate('test'),true),button('Download answer backup',backup,true)));
  const filter=el('input',null,{type:'checkbox',id:'unanswered-only'}), list=el('div',null,{class:'review-list'});
  function rows(){list.replaceChildren();for(const slot of selectedSlots(state)){if(filter.checked&&state.responses[slot]!==null)continue;const item=BANK.items[slot];list.append(el('div',null,{class:'review-row'},[el('span',String(slot+1),{class:'item-ref'}),el('span',itemText(item,state.wording)),el('span',item.options.find(o=>o.value===state.responses[slot])?.label||answerStatus(slot),{class:'answer-summary'}),el('button',readOnly?'View':'Edit',{type:'button',class:'text-button',on:{click:()=>run(()=>jump(slot))}})]));}if(!list.children.length)list.append(p('All selected items are answered.'));}
  filter.addEventListener('change',rows);main.append(el('label',null,{class:'check-line',for:'unanswered-only'},[filter,document.createTextNode('Show only skipped and unanswered items')]),list);rows();
}

function report(){
  main.append(heading('04 / Your report','The Big Six-Seven','Five personality traits. Two complementary profiles. A starting point for understanding yourself—and making your work easier for others to understand.'));
  const model=reportModel(), size=el('select',null,{'aria-label':'PDF paper size'},[el('option','US Letter',{value:'letter'}),el('option','A4',{value:'a4'})]);
  const pdfButton=button('Download PDF',async()=>{pdfButton.disabled=true;pdfButton.textContent='Preparing your PDF…';try{const {downloadPdf}=await import('./pdf.mjs');await flush();await downloadPdf(reportModel(),{size:size.value});}finally{pdfButton.disabled=false;pdfButton.textContent='Download PDF';}});
  main.append(el('div',null,{class:'report-toolbar'},[pdfButton,size,button('Share this report',()=>navigate('share'),true),button('Answer backup',backup,true),button('Print',()=>window.print(),true)]));
  const content=el('div');main.append(content);renderReport(content,model);
  if(!readOnly){const panel=el('section',null,{class:'panel',id:'choose-experiments'},[el('h2','Choose an experiment to take with you'),p('These selections are saved in your report and its full snapshot. They do not affect your scores.')]);for(const experiment of EXPERIMENTS){const input=el('input',null,{type:'checkbox',checked:state.blocks.includes(experiment.id)});input.addEventListener('change',()=>{state.blocks=EXPERIMENTS.filter(e=>e.id===experiment.id?input.checked:state.blocks.includes(e.id)).map(e=>e.id).sort();persist();renderReport(content,reportModel());});panel.append(el('label',null,{class:'check-line'},[input,document.createTextNode(experiment.title)]));}main.append(panel);
    const basis=assessmentBasis(state),owner=record?.id;
    disposeReflection=mountReflection(main,{state:clone(state),context:reflectionContext,enhancement:currentEnhancement(),onSaved:render,save:(context,value)=>{
      pending++;updateStatus();
      const operation=queue.then(async()=>{
        if(readOnly||owner!==record?.id||basis!==assessmentBasis(state))throw new Error('Your answers changed during this reflection. Return to the report and try again.');
        if(saveFailure)throw saveFailure;
        if(db){if(!record)record=await db.create(state);record=await db.saveReflection(record.id,record.revision,{context,enhancement:value});}
        reflectionContext=context;enhancement=value;
      }).finally(()=>{pending--;updateStatus();});
      queue=operation.catch(()=>{});return operation;
    }});
  }
  if(currentEnhancement())main.append(actions(button('Download full reflection JSON',()=>download(exportReflection(state,currentEnhancement()),'big-six-seven-reflection.json','application/json'),true)),p('The reflection file includes the selected answers, kept reflection text, and its cited excerpts. Review it before sharing. Unused private notes are excluded.','small'));
}

function summaryReport(){
  main.replaceChildren(heading('Shared score summary','A selected glimpse.','This link contains only the Big Five scores its creator selected. It does not contain their answers, facets, interests, values, or a full report.'));
  main.append(notice('Self-reported and unverified. These are raw means on a 1–5 response scale, not percentiles, ability measures, or hiring recommendations.'));
  const panel=el('div',null,{class:'panel summary-scores'});for(const[id,centi]of ingress.summary.m)panel.append(el('div',null,{class:'summary-score'},[el('span',BANK.domains.find(d=>d.id===id).name),el('strong',`${(centi/100).toFixed(2)} / 5`)]));main.append(panel,actions(hardLink('Explore your own profile','/personality/prepare','button'),link('Read the introduction','/articles/big-personality','button secondary')));
}

function share(){
  main.append(heading('05 / Choose what to share','Make it yours to share.','A share link carries the data itself. Choose a small score summary for public posts, or an exact snapshot for someone you trust. Nothing is uploaded to an answer database.'));
  const scores=score(state), complete=scores.domains.filter(d=>d.complete), panel=el('section',null,{class:'panel'});
  let mode=complete.length?'summary':'snapshot';
  const modes=el('div');for(const[value,title,description]of[['summary','Selected Big Five scores','Only the complete domain means you choose. No individual answers or additional profiles.'],['snapshot','Complete assessment snapshot','All selected answers, skips, profile choices, wording, report date, selected experiments, and saved position. Anyone with the link can read them.'],...(currentEnhancement()?[['enhanced','Assessment and kept reflection','All selected answers plus the exact kept reflection text and its supporting excerpts. This may include details from your private example. Review everything below before sharing.']]:[])]){
    const input=el('input',null,{type:'radio',name:'share-kind',value,checked:mode===value,disabled:value==='summary'&&!complete.length});input.addEventListener('change',()=>{mode=value;refreshPreview();});modes.append(el('label',null,{class:'share-choice'},[input,document.createTextNode(title),el('small',description)]));
  }
  const domains=el('div',null,{class:'share-domains'}), checks=[];for(const domain of complete){const input=el('input',null,{type:'checkbox',checked:true,value:domain.id});checks.push(input);input.addEventListener('change',refreshPreview);domains.append(el('label',null,{},[input,document.createTextNode(domain.name)]));}
  const query=el('input',null,{type:'checkbox',id:'public-query'});query.addEventListener('change',refreshPreview);
  const queryLabel=el('label',null,{class:'check-line',for:'public-query'},[query,document.createTextNode('Use a public query parameter for the score summary. This makes those scores visible to hosting logs and link-preview services.')]);
  const preview=el('div',null,{class:'notice'}), output=el('textarea',null,{class:'share-output',readonly:true,'aria-label':'Generated share link',rows:4});
  const controls=actions(), social=el('div',null,{class:'social-actions'}), feedback=p('','form-status');feedback.setAttribute('role','status');
  function refreshPreview(){
    domains.hidden=mode!=='summary';queryLabel.hidden=mode!=='summary';output.value='';controls.replaceChildren();social.replaceChildren();feedback.textContent='';
    preview.textContent=mode==='enhanced'?`This link includes ${scores.completion.answered} selected answers and the kept reflection shown below. Supporting excerpts may contain personal details. It uses a URL fragment and cannot be revoked. It is not encrypted.`:mode==='snapshot'?`Preview: ${scores.completion.answered} answers, ${scores.completion.skipped} skips, ${state.modules.length} profiles, ${state.blocks.length} selected experiments, and saved position. Full answers travel after # in the URL. This is encoding, not encryption. Links cannot be revoked after someone has a copy.`:`Preview: ${checks.filter(c=>c.checked).map(c=>BANK.domains.find(d=>d.id===c.value).name).join(', ')||'No domains selected'}. Means are rounded to two decimals. ${query.checked?'Public query sharing is enabled.':'Scores travel after #; browsers do not send that fragment in the page request.'}`;
    if(mode==='enhanced'){const pre=el('pre',null,{class:'reflection-disclosure'});pre.textContent=currentEnhancement().sections.map(s=>s.title+'\n'+s.body+'\n'+s.evidence.map(id=>currentEnhancement().evidence.find(f=>f.id===id).label).join('\n')).join('\n\n');preview.append(pre);}
  }
  async function generate(){
    await flush();const url=new URL('/personality/report',location.origin);
    if(mode==='enhanced'){url.hash=`e=${encodeEnhancedSnapshot(state,currentEnhancement())}`;}else if(mode==='snapshot'){url.pathname=`/personality/${viewRoute[state.view]}`;url.hash=`s=${encodeSnapshot(state)}`;}else{const token=encodeSummary(state,checks.filter(c=>c.checked).map(c=>c.value));if(query.checked)url.searchParams.set('r',token);else url.hash=`r=${token}`;}
    output.value=url.href;controls.replaceChildren(button('Copy link',async()=>{await navigator.clipboard.writeText(output.value);feedback.textContent='Copied. Anyone with this link can read the selected contents.';}),button('Download score card',()=>scoreCard(checks.filter(c=>c.checked).map(c=>c.value)),true));
    if(navigator.share)controls.append(button('Share with an app',async()=>{try{await navigator.share({title:'The Big Six-Seven',text:'A field guide to understanding yourself.',url:url.href});}catch(error){if(error.name!=='AbortError')throw error;}},true));
    const u=encodeURIComponent(url.href),text=encodeURIComponent('A field guide to understanding myself. The Big Six-Seven');
    const destinations=[['LinkedIn',`https://www.linkedin.com/sharing/share-offsite/?url=${u}`],['Bluesky',`https://bsky.app/intent/compose?text=${text}%20${u}`],['X',`https://twitter.com/intent/tweet?text=${text}&url=${u}`],['Facebook',`https://www.facebook.com/sharer/sharer.php?u=${u}`],['Reddit',`https://www.reddit.com/submit?url=${u}&title=${text}`],['WhatsApp',`https://wa.me/?text=${text}%20${u}`],['Email',`mailto:?subject=${text}&body=${u}`]];
    social.replaceChildren(...destinations.map(([label,href])=>el('a',label,{href,target:'_blank',rel:'noopener noreferrer'})));
    feedback.textContent=`Link ready · ${url.href.length.toLocaleString()} characters. Review the disclosure above before posting.`;
  }
  panel.append(modes,domains,queryLabel,preview,button('Generate this share link',generate),el('div',null,{class:'field'},[el('label','Your self-contained link'),output]),controls,social,feedback,p('Use Copy or your device’s share sheet for Discord, Instagram, TikTok, and other apps. The downloaded image includes only complete Big Five means. Link previews use a generic cover, never a generated personal score image. Some services shorten or strip long links; reopen the final link to check it.','small'));
  main.append(panel);
  if(readOnly)main.append(p('Creating another link does not save this snapshot to your local library.','small'));
  refreshPreview();
}
async function scoreCard(ids){
  const selected=score(state).domains.filter(d=>d.complete&&ids.includes(d.id));
  if(!selected.length)throw new Error('Complete and select at least one personality domain to make a score card.');
  await document.fonts.ready;const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f7f5ef';ctx.fillRect(0,0,1200,900);ctx.strokeStyle='#c8c3ba';ctx.strokeRect(20,20,1160,860);ctx.fillStyle='#321d40';ctx.font='24px "JetBrains Mono"';ctx.fillText('A FIELD GUIDE TO MYSELF',70,85);ctx.font='64px "Source Serif 4"';ctx.fillText('The Big Six-Seven',70,174);ctx.font='25px "Atkinson Hyperlegible Next"';ctx.fillStyle='#56515a';ctx.fillText('Selected Big Five scores · raw means, not percentiles',70,224);
  let y=310;for(const domain of selected){ctx.font='27px "Atkinson Hyperlegible Next"';ctx.fillStyle='#27242a';ctx.fillText(domain.name,70,y);ctx.font='25px "JetBrains Mono"';ctx.fillText(`${domain.mean.toFixed(2)} / 5`,970,y);ctx.fillStyle='#eae3ed';ctx.fillRect(70,y+18,1050,12);ctx.fillStyle='#321d40';ctx.fillRect(70,y+18,1050*(domain.mean-1)/4,12);y+=94;}
  ctx.fillStyle='#56515a';ctx.font='21px "Atkinson Hyperlegible Next"';ctx.fillText('Self-reported reflection. No ideal score. No hiring recommendation.',70,826);ctx.font='18px "JetBrains Mono"';ctx.fillText('engmanager.xyz/articles/big-personality',70,860);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Could not create the score image.');download(blob,'big-six-seven-score-card.png','image/png');
}

async function library(token){
  main.append(heading('06 / Saved on this device','Your own little archive.','Keep drafts, return to reports, and move a backup between your own devices. These files can contain every answer: share them thoughtfully.'));
  main.append(actions(button('Start a new assessment',async()=>{await flush();state=createState();record=null;saveFailure=null;reflectionContext=createContext();enhancement=null;if(db)record=await db.create(state);await navigate('prepare');}),button('Download current answer backup',backup,true)));
  const input=el('input',null,{type:'file',accept:'.json,application/json',class:'file-input',id:'import-backup'}), feedback=p('','form-status');
  input.addEventListener('change',()=>run(async()=>{const file=input.files[0];if(!file)return;if(file.size>65536)throw new Error('Backup is too large; the limit is 64 KiB.');await flush();await enableStore();const text=await file.text();let imported;
    if(JSON.parse(text).kind==='big-six-seven-reflection'){const frozen=importReflection(text);imported=await db.create(frozen.state);imported=await db.saveReflection(imported.id,imported.revision,{context:createContext(),enhancement:frozen.enhancement});}else imported=await db.importJSON(text);
    record=imported;state=clone(imported.state);({context:reflectionContext,enhancement}=await db.loadReflection(record.id));saveFailure=null;feedback.textContent='Imported as a separate local assessment.';await navigate(viewRoute[state.view]);}));
  main.append(el('div',null,{class:'panel'},[el('h2','Restore a local backup'),el('label','Choose your JSON backup file',{for:'import-backup'}),p('Import creates a new assessment. Existing saved work is retained.','small'),input,feedback]));
  if(db){const records=await db.list();if(token!==renderId)return;const list=el('section',null,{},[el('h2',`${records.length} saved assessment${records.length===1?'':'s'}`)]);for(const saved of records){const coverage=score(saved.state).completion;const activate=async(next)=>{await flush();record=await db.activate(saved.id);state=clone(record.state);({context:reflectionContext,enhancement}=await db.loadReflection(record.id));saveFailure=null;await navigate(next||viewRoute[state.view]);};const remove=button('Delete',async()=>{if(!confirm('Delete this assessment from this browser? Download a backup first if you want to keep it.'))return;await flush();await db.remove(saved.id);if(record?.id===saved.id){record=null;state=createState();reflectionContext=createContext();enhancement=null;saveFailure=null;}render();},true);remove.classList.add('danger');list.append(el('article',null,{class:'library-row'},[el('div',null,{},[el('h3',new Date(saved.updatedAt).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})),p(`${coverage.answered}/${coverage.total} answered · ${saved.state.modules.length} profiles${saved.id===record?.id?' · current':''}`)]),actions(button('Resume',()=>activate()),button('Report',()=>activate('report'),true),button('Backup',async()=>download(await db.exportJSON(saved.id),'big-six-seven-backup.json','application/json'),true),remove)]));}main.append(list);}
  const audio=el('input',null,{type:'checkbox',checked:audioEnabled,id:'audio-opt-in'});audio.addEventListener('change',()=>run(async()=>{audioEnabled=audio.checked;if(db)await db.setPreference('audioEnabled',audioEnabled);if(audioEnabled)play('section-complete');}));
  const offlineStatus=p('Offline mode downloads this release, including PDF fonts, to this device. It stores public app files, never answer-bearing URLs.','small');
  main.append(el('section',null,{class:'privacy-settings'},[el('h2','A quiet workspace'),el('label',null,{class:'check-line',for:'audio-opt-in'},[audio,document.createTextNode('Play a short sound when a profile or report is ready (off by default)')]),actions(button('Make available offline',async()=>{offlineStatus.textContent='Downloading the complete public release…';try{const {installOffline}=await import('./offline.mjs');await installOffline();offlineStatus.textContent='Ready offline. These questionnaire routes and PDF export now work without a connection.';}catch(error){offlineStatus.textContent=error.message;throw error;}},true),button('Request durable browser storage',async()=>{const granted=await navigator.storage?.persist?.();offlineStatus.textContent=granted?'The browser granted persistent storage. Keep backups for device loss or manual clearing.':'The browser did not grant persistent storage. Local saving still works; keep backups.';},true)),offlineStatus]));
}

function render(){
  disposeReflection?.();disposeReflection=null;
  const token=++renderId,next=route();document.querySelector('#page-crumb').textContent=labels[next]||'Page not found';
  document.querySelectorAll('[data-route]').forEach(a=>{if(a.dataset.route===next)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=`${labels[next]||'Page not found'} · The Big Six-Seven`;
  if(next==='article'||!labels[next])return;
  main.replaceChildren();updateStatus();
  if(ingress.kind==='summary'){summaryReport();return;}
  if(readOnly)main.append(sharedBanner());const warning=storageWarning();if(warning)main.append(warning);
  if(next==='prepare')prepare();else if(next==='test')questionnaire();else if(next==='review')review();else if(next==='report')report();else if(next==='share')share();else if(next==='library'){run(async()=>{await library(token);if(token===renderId)main.append(p('THE BIG SIX-SEVEN · PERSONALITY + INTERESTS + VALUES · NO IDEAL SCORE','page-bottom'));});return;}
  main.append(p('THE BIG SIX-SEVEN · PERSONALITY + INTERESTS + VALUES · NO IDEAL SCORE','page-bottom'));
}

function shell(){
  const toggle=document.querySelector('#sidebar-toggle'),backdrop=el('button',null,{id:'sidebar-backdrop',type:'button','aria-label':'Close navigation'});layout.append(backdrop);
  const mobile=()=>matchMedia('(max-width:860px)').matches;
  const close=()=>{layout.dataset.mobileOpen='false';toggle.setAttribute('aria-expanded',mobile()?'false':String(layout.dataset.collapsed!=='true'));};
  toggle.addEventListener('click',()=>{if(mobile())layout.dataset.mobileOpen=String(layout.dataset.mobileOpen!=='true');else layout.dataset.collapsed=String(layout.dataset.collapsed!=='true');toggle.setAttribute('aria-expanded',mobile()?String(layout.dataset.mobileOpen==='true'):String(layout.dataset.collapsed!=='true'));});backdrop.addEventListener('click',close);document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});close();
  document.addEventListener('click',event=>{const a=event.target.closest('a');if(!a||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0||a.target||a.download||a.hasAttribute('data-document-navigation'))return;if(a.classList.contains('skip-link')){event.preventDefault();main.focus();main.scrollIntoView({block:'start'});return;}const url=new URL(a.href,location.href);if(url.origin!==location.origin)return;const next=url.pathname.split('/')[2];if(url.pathname.startsWith('/personality/')&&labels[next]&&!url.hash&&!url.search){event.preventDefault();if(bootReady)run(()=>navigate(next));}});
  window.addEventListener('popstate',()=>location.reload());
  window.addEventListener('hashchange',()=>location.reload());
}

async function boot(){
  shell();
  if(document.body.dataset.personalityRoute==='not-found')return;
  try{ingress=readEnhancedIngress(location.href)??readIngress(location.href);}catch(error){bootReady=true;ingressBlocked=true;main.replaceChildren(heading('This link could not be opened','Your saved work is safe.',error.message),actions(hardLink('Open my local assessments','/personality/library','button'),hardLink('Begin a new assessment','/personality/prepare','button secondary')));announce('Invalid shared link',true);return;}
  readOnly=ingress.kind!=='none';
  if(['snapshot','enhanced'].includes(ingress.kind)){state=ingress.state;sharedCursor=clone(state.cursor);enhancement=ingress.enhancement??null;}
  if(readOnly){ingressBlocked=true;await verifyPublicAssets();ingressBlocked=false;bootReady=true;render();return;}
  try{await enableStore();record=await db.loadActive();if(record){state=clone(record.state);({context:reflectionContext,enhancement}=await db.loadReflection(record.id));}audioEnabled=(await db.getPreference('audioEnabled'))===true;}catch(error){saveFailure=error;}
  bootReady=true;updateStatus();render();
  // Upgrade legacy root workers without deleting other applications' caches.
  if('serviceWorker'in navigator){navigator.serviceWorker.getRegistration('/').then(reg=>{if(reg&&new URL(reg.scope).pathname==='/')return reg.update();}).catch(()=>{});}
  if('caches'in globalThis){caches.keys().then(async keys=>{for(const key of keys.filter(k=>/^engmanager-v\d+$/.test(k))){const cache=await caches.open(key);for(const request of await cache.keys()){const path=new URL(request.url).pathname;if(path==='/personality'||path.startsWith('/personality/'))await cache.delete(request);}}}).catch(()=>{});}
}
boot().catch(error=>{bootReady=true;announce('Unable to open this release',true);showError(error);});
