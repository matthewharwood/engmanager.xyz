import {DEFAULT_SETTINGS,MOVEMENTS,validateSettings,buildStudioModel,typeView,STUDIO_VERSION} from './studio-model.mjs';
import {PILOT} from './pilot.mjs';
import {FIGURES} from './figures.mjs';
import {DECK} from './deck.mjs';
import {BACKGROUND,COUNTRIES} from './background.mjs';
import {validateBackground} from './story-core.mjs';
import {installOffline} from './offline.mjs';
import {createTarotDraw} from './story-core.mjs';
import {loadStudioSettings,saveStudioSettings} from './studio-store.mjs';
import {createStudioKit} from './studio-kit.mjs';
import {node,para,action,image,renderStudioArticle} from './studio-view.mjs';
function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=node('a',null,{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function field(label,control,hint){const wrap=node('label',null,{class:'studio-field'});wrap.append(node('span',label),control);if(hint)wrap.append(node('small',hint));return wrap;}
export function mountReportStudio(root,{state,model,recordId=null,canSave=false,flush=async()=>{},pendingWrites=Promise.resolve(),onPending=()=>{},onShare=()=>{},onBackup=()=>{},initialSettings=null}={}){
 let settings=structuredClone(DEFAULT_SETTINGS),revision=0,queue=Promise.resolve(pendingWrites),disposed=false,storageFailure=null,ready=false;
 if(initialSettings)settings=validateSettings(initialSettings);
 document.body.dataset.reportStudio='true';
 const shell=node('div',null,{class:'studio-shell'}),rail=node('nav',null,{class:'studio-rail','aria-label':'Portrait chapters'}),body=node('div',null,{class:'studio-body'}),notice=para('Opening your report settings…','studio-status');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 rail.append(node('a','6–7',{href:'/personality/report',class:'studio-wordmark','aria-label':'The Big Six-Seven report'}),para('YOUR FIELD GUIDE','studio-eyebrow'));
 for(const m of MOVEMENTS){const a=node('a',null,{href:'#studio-'+m.id,class:'chapter-link','data-studio-anchor':m.id},[node('span',m.number),node('span',m.name)]);a.addEventListener('click',e=>{e.preventDefault();document.getElementById('studio-'+m.id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});rail.append(a);}
 rail.append(node('div',null,{class:'rail-bottom'},[node('a','← Questionnaire',{href:'/personality/review','data-route':'review'}),node('a','Saved reports',{href:'/personality/library','data-route':'library'}),action('Visual key',()=>openKey(),'studio-button secondary'),node('a','Classic tools & local AI',{href:'/personality/report?presentation=classic','data-document-navigation':true}),para('PRIVATE BY DESIGN','studio-eyebrow'),para('Saved on this device. You choose what leaves.','panel-note')]));
 const top=node('div',null,{class:'studio-topline no-print'},[para('Your report / '+(model.date||'In progress')),notice]);
 const content=node('div'),island=node('nav',null,{class:'studio-island no-print','aria-label':'Report actions'}),dialogs=new Set();
 const customize=action('Customize',()=>openSettings()),print=action('Print / PDF',()=>openExport('print')),kit=action('Export kit',()=>openExport('kit'),'studio-button primary');
 island.append(customize,print,kit);body.append(top,content);shell.append(rail,body,island);root.append(shell);
 const showError=error=>{if(disposed)return;notice.textContent=error.message||String(error);notice.classList.add('error');};
 const run=fn=>Promise.resolve().then(fn).catch(showError);
 function updateStatus(){notice.classList.remove('error');notice.textContent=storageFailure?'Not saved: '+storageFailure.message:canSave?'Your framing is saved on this device':'Session only · export to keep this report';}
 function syncNav(){if(disposed)return;const chapters=[...content.querySelectorAll('.studio-chapter')];const current=chapters.filter(s=>s.getBoundingClientRect().top<=innerHeight*.35).at(-1)??chapters[0];for(const a of rail.querySelectorAll('[data-studio-anchor]')){if(current?.id==='studio-'+a.dataset.studioAnchor)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');}}
 window.addEventListener('scroll',syncNav,{passive:true});window.addEventListener('resize',syncNav);
 function refresh(forExport=false){
  if(disposed)return;
  renderStudioArticle(content,buildStudioModel(model,settings,{forExport}),{onCustomize:()=>openSettings(),onPilot:()=>openPilot(),onBrowse:()=>openGallery(),onDetail:d=>openDomain(d),interactive:!forExport});
  if(!forExport)syncNav();
 }
 function change(patch){
  if(!ready)throw new Error('Wait for your saved report settings to open.');
  settings=validateSettings({...settings,...patch});refresh();const snapshot=structuredClone(settings);
  if(canSave&&!storageFailure){notice.textContent='Saving framing…';queue=queue.then(async()=>{if(storageFailure)return;try{const saved=await saveStudioSettings(recordId,revision,snapshot);revision=saved.revision;}catch(e){storageFailure=e;if(!disposed)showError(e);}}).finally(()=>{if(!disposed)updateStatus();});onPending(queue);}else updateStatus();
 }
 function dialog(title){
  const previous=document.activeElement,d=node('dialog',null,{class:'studio-dialog','aria-labelledby':'studio-dialog-title-'+dialogs.size}),heading=node('h2',title,{id:'studio-dialog-title-'+dialogs.size});
  const close=action('Close',()=>d.close(),'studio-button secondary');
  d.append(node('header',null,{class:'dialog-head'},[heading,close]));document.body.append(d);dialogs.add(d);
  d.addEventListener('close',()=>{dialogs.delete(d);d.remove();if(previous?.isConnected)previous.focus();},{once:true});d.showModal();return d;
 }
 function checkbox(label,key,parent,hint){const input=node('input',null,{type:'checkbox'});input.checked=settings[key];input.addEventListener('change',()=>{try{change({[key]:input.checked});}catch(e){input.checked=settings[key];showError(e);}});parent.append(field(label,input,hint));return input;}
 function openSettings(){if(!ready)return;const d=dialog('Make the report yours');
  d.append(para('Change the framing and optional chapters. Your assessment answers and scores stay separate.','dialog-intro'));
  const name=node('input',null,{type:'text',maxlength:80,autocomplete:'off',value:settings.name});name.addEventListener('change',()=>run(()=>change({name:name.value})));d.append(field('Name or display label',name,'Optional; approval for export is separate.'));
  const note=node('textarea',settings.note,{maxlength:512,rows:4});note.addEventListener('change',()=>run(()=>change({note:note.value})));d.append(field('In my own words',note,'What should someone understand about you? This is your account, not a measured result.'));
  const edition=node('select');for(const[value,label]of[['personal','Personal edition'],['workplace','Working together edition']])edition.append(node('option',label,{value}));edition.value=settings.edition;edition.addEventListener('change',()=>run(()=>{change({edition:edition.value});d.close();openSettings();}));d.append(field('Reading edition',edition,'The working together edition omits tarot and astrology.'));
  const optional=node('fieldset',null,{},[node('legend','Optional lenses')]);checkbox('Show custom colors','includeColors',optional);checkbox('Show a preference code and axes','includeType',optional,'Experimental pilot or your self-selected type.');checkbox('Include a biographical parallel','includeFigure',optional,'Requires a resolved or self-selected code. Figure types are unverified.');d.append(optional,action('Explore the preference pilot',()=>{d.close();openPilot();},'studio-button secondary'));
  if(settings.edition==='personal'){
   const keeps=node('fieldset',null,{},[node('legend','Creative keepsakes')]);
   const date=node('input',null,{type:'date',min:'1901-01-01',max:new Date().toISOString().slice(0,10),value:settings.birthday});date.addEventListener('change',()=>run(()=>change({birthday:date.value})));keeps.append(field('Birthday (optional)',date,'Only derived symbols can leave this browser; the full date is excluded from print and kits.'));
   checkbox('Include birthday symbols','includeZodiac',keeps);checkbox('Include my saved tarot reflection','includeTarot',keeps);
   const draw=action(settings.draw?'Replace my three-card draw':'Draw three cards',()=>run(()=>{if(settings.draw&&!confirm('Replace the saved draw? Future reports will use the new cards.'))return;change({draw:createTarotDraw(DECK),includeTarot:true});d.close();openSettings();}),'studio-button secondary');
   keeps.append(draw,para(settings.draw?'Draw saved '+settings.draw.createdAt.slice(0,10)+'. Exports reuse these exact cards.':'Cards are sampled without replacement. A draw is saved until you deliberately replace it.','panel-note'));d.append(keeps);
  }
  const consent=node('fieldset',null,{},[node('legend','Personal text in print and exports')]);checkbox('Include my display name','includeName',consent);checkbox('Include my own words','includeNote',consent);d.append(consent,action('Your background · 36 optional questions',()=>{d.close();openBackground();},'studio-button secondary'),action('Visual key',()=>{d.close();openKey();},'studio-button secondary'),action('Done',()=>d.close(),'studio-button primary'));
 }
 function openBackground(){const d=dialog('Your background, in your own terms');
  d.append(para('All 36 questions are optional. Choose what helps your story, then approve each answer separately for print and the kit. Nothing here changes a score.','dialog-intro'));
  const chapters=[...new Set(BACKGROUND.questions.map(q=>q.chapter))];
  for(const chapter of chapters){const section=node('details',null,{class:'background-chapter'},[node('summary',chapter)]);
   for(const q of BACKGROUND.questions.filter(q=>q.chapter===chapter)){
    const box=node('fieldset',null,{class:'background-question'},[node('legend',q.prompt)]),options=[...q.options,...(q.optionCatalog?COUNTRIES.options:[])];
    if(q.sensitive)box.append(para('Optional personal context · share only if useful to you.','panel-note'));
    const current=settings.backgroundAnswers[q.id],select=node('select',null,{multiple:q.type==='multi_select',size:q.type==='multi_select'?5:null,'aria-label':q.prompt});
    if(q.type==='single_select')select.append(node('option','Unanswered',{value:''}));
    for(const o of options){const opt=node('option',o.label,{value:o.id});opt.selected=current?.selected?.includes(o.id)??false;select.append(opt);}
    const description=node('input',null,{type:'text',maxlength:120,value:current?.selfDescription??'','aria-label':'Self-description for '+q.prompt});
    const approval=node('input',null,{type:'checkbox'});approval.checked=settings.approvedBackground.includes(q.id);approval.disabled=!validateBackground(BACKGROUND,COUNTRIES,settings.backgroundAnswers)[q.id];
    const help=para(q.type==='multi_select'?`Select up to ${q.maxSelections}. On a desktop, use Ctrl/Command to select more than one. Prefer not to answer cannot be combined with another option.`:'','panel-note');
    const issue=para('','error');issue.setAttribute('role','status');
    const update=()=>{try{const selected=[...select.selectedOptions].map(o=>o.value).filter(Boolean),self=selected.some(id=>options.find(o=>o.id===id)?.label.includes('Self-describe'));description.disabled=!self;const answers={...settings.backgroundAnswers};if(selected.length)answers[q.id]={status:'answered',selected,selfDescription:self?description.value:''};else delete answers[q.id];
     // A changed answer always needs fresh field-level approval.
     change({backgroundAnswers:answers,approvedBackground:settings.approvedBackground.filter(id=>id!==q.id)});approval.checked=false;approval.disabled=!validateBackground(BACKGROUND,COUNTRIES,answers)[q.id];issue.textContent='';
    }catch(e){issue.textContent=e.message;}};
    select.addEventListener('change',update);description.addEventListener('change',update);description.disabled=!current?.selected?.some(id=>options.find(o=>o.id===id)?.label.includes('Self-describe'));
    approval.addEventListener('change',()=>run(()=>change({approvedBackground:approval.checked?[...settings.approvedBackground,q.id]:settings.approvedBackground.filter(id=>id!==q.id)})));
    box.append(select,help);if(q.allowSelfDescription)box.append(field('Optional self-description',description));box.append(field('Include this answer in print and the kit',approval),issue);section.append(box);
   }d.append(section);
  }d.append(action('Done',()=>d.close(),'studio-button primary'));
 }
 function openPilot(){if(!ready)return;const d=dialog('Explore four preference pairs');d.append(para('48 original candidate questions. This research pilot is not an official MBTI assessment. Each pair needs all 12 answers; near-midpoint results stay unresolved.','dialog-intro'));
  const source=node('select');source.append(node('option','Use the 48-question pilot',{value:'pilot'}),node('option','Use a type I already identify with',{value:'self'}));source.value=settings.typeSource;source.addEventListener('change',()=>run(()=>{change({typeSource:source.value});d.close();openPilot();}));d.append(field('Where the code comes from',source));
  checkbox('Include this experimental preference lens','includeType',d);
  if(settings.typeSource==='self'){const select=node('select');select.append(node('option','Choose a type',{value:''}));for(const f of FIGURES.figures)select.append(node('option',f.code,{value:f.code}));select.value=settings.selfType;select.addEventListener('change',()=>run(()=>change({selfType:select.value})));d.append(field('Self-selected type',select,'Recorded as self-selected; it does not overwrite or validate pilot scores.'));}
  else {d.append(para('Rate how well each statement describes you: 1 strongly disagree, 2 disagree, 3 neutral, 4 agree, 5 strongly agree. You can leave any item unanswered.','panel-note'));const tabs=node('div',null,{class:'pilot-tabs',role:'group','aria-label':'Preference pairs'}),pages=node('div');
   for(const axis of ['EI','SN','TF','JP']){const items=PILOT.items.filter(q=>q.scale===axis);const p=node('section',null,{'data-pilot-axis':axis,hidden:axis!=='EI'});p.append(node('h3',axis+' · 12 statements'));
    for(const q of items){const select=node('select',null,{'aria-label':q.wording});select.append(node('option','Unanswered',{value:''}));for(let n=1;n<=5;n++)select.append(node('option',n+' · '+['Strongly disagree','Disagree','Neutral','Agree','Strongly agree'][n-1],{value:n}));select.value=settings.pilotAnswers[q.id]??'';select.addEventListener('change',()=>run(()=>{change({pilotAnswers:{...settings.pilotAnswers,[q.id]:select.value?Number(select.value):null}});coverage.textContent=typeView(settings).axes.map(a=>`${a.id} ${a.answered}/${a.required}`).join(' · ');}));p.append(field(q.wording,select));}
    pages.append(p);const b=action(axis,()=>{pages.querySelectorAll('[data-pilot-axis]').forEach(x=>x.hidden=x!==p);tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));},'lens-chip');b.setAttribute('aria-pressed',String(axis==='EI'));tabs.append(b);
   }
   const coverage=para(typeView(settings).axes.map(a=>`${a.id} ${a.answered}/${a.required}`).join(' · '),'pilot-coverage');coverage.setAttribute('aria-live','polite');d.append(tabs,coverage,pages);
  }d.append(action('Done',()=>d.close(),'studio-button primary'));
 }
 function openKey(){const d=dialog('A guide to the visual language');
 d.append(para('One report, with clear evidence levels.'));
 for(const [title,text] of [['Self-report','Big Five, work interests and personal values use the existing assessment scores. Each retains its own scale.'],['Experimental','The preference pilot and custom color composites are unvalidated interpretations. They do not create a measure of ability or success.'],['Editorial','A public-life parallel illustrates a theme. The famous person’s type is unverified.'],['Creative','Tarot and birthday symbols are optional metaphors, not evidence or predictions.']])d.append(node('h3',title),para(text));
 d.append(node('h3','All 15 color combinations'),para('Equal-size, translucent circles. Overlap is decorative; scores are printed separately. The neutral ring means the complete color view is unavailable.'));
 const gallery=node('div',null,{class:'color-gallery'});for(let mask=1;mask<16;mask++){const names=['red','yellow','green','blue'].filter((_,i)=>mask&(1<<i)).join(' + ');gallery.append(node('figure',null,{},[image(`media/colors/combination-${mask.toString(16)}.svg`,names),node('figcaption',names)]));}d.append(gallery);
 }
 function openDomain(domain){const d=dialog(domain.name+' · the detail');d.append(para(domain.interpretation.definition),para(domain.interpretation.summary));for(const f of domain.facets)d.append(node('section',null,{class:'facet-detail'},[node('h3',f.name+' · '+(f.complete?f.mean.toFixed(2)+' / 5':'not scored')),para(f.definition),para(`${f.answered}/${f.required} answered`,'panel-note')]));}
 function openGallery(){const d=dialog('Sixteen biographical parallels');d.classList.add('gallery-dialog');d.append(para('Browse the complete, finite catalog. Each association is an editorial connection to documented public work, not a verified MBTI typing. Exploring a card does not change your report.','dialog-intro'));const grid=node('div',null,{class:'figure-gallery'});
  for(const f of FIGURES.figures){const card=node('article',null,{class:'gallery-card'},[image(f.image.path,f.image.alt),para(f.code+' / '+f.title,'studio-eyebrow'),node('h3',f.name),para(f.biography)]),detail=node('details',null,{},[node('summary','Connection & image credit'),para(f.parallel),para('Type unverified. '+f.limit),para(f.image.author+' · '+f.image.license),node('a','Image source',{href:f.image.source,target:'_blank',rel:'noopener noreferrer'}),document.createTextNode(' · '),node('a','License',{href:f.image.licenseUrl,target:'_blank',rel:'noopener noreferrer'}),document.createTextNode(' · '),node('a','Biography',{href:f.source,target:'_blank',rel:'noopener noreferrer'})]);card.append(detail);grid.append(card);}d.append(grid);
 }
 async function settled(){await queue;await flush();if(disposed)throw new Error('Return to this report before exporting.');}
 function openExport(intent){if(!ready)return;const d=dialog(intent==='print'?'Review your printable edition':'Review your report kit');d.append(para('The preview below uses the same approved content for print and the LLM kit. Your full birthday, unapproved name and unapproved note are excluded.','dialog-intro'));
  checkbox('Include my display name','includeName',d);checkbox('Include my own words','includeNote',d);
  const included=para('','export-summary'),preview=node('details',null,{},[node('summary','Inspect the exact Markdown packet')]),pre=node('pre',null,{class:'kit-preview',tabindex:0});preview.append(pre);d.append(included,preview);
  function update(){const k=createStudioKit({state,model,settings});pre.textContent=k.text;included.textContent='Approved chapters: Portrait, Patterns, Working together'+(k.data.presentation.figure?', Parallels':'')+(k.data.presentation.zodiac||k.data.presentation.tarot?', Keepsakes':'')+'. Edition: '+settings.edition+'. All selected assessment answers are included in the kit.';}
  update();d.addEventListener('change',update);
  if(intent==='print')d.append(action('Open print dialog',()=>run(async()=>{await settled();d.close();refresh(true);content.querySelectorAll('img').forEach(img=>img.loading='eager');await Promise.all([...content.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));window.print();refresh();}),'studio-button primary'));
  else{d.append(action('Download Markdown',()=>run(async()=>{await settled();const k=createStudioKit({state,model,settings});download('\ufeff'+k.text,k.filename,k.mimeType);}),'studio-button primary'),action('Download kit + images (.zip)',()=>run(async()=>{await settled();const {mediaKit}=await import('./zip.mjs');const k=createStudioKit({state,model,settings});notice.textContent='Packaging approved images…';download(await mediaKit(k),'your-portrait-media-kit.zip','application/zip');updateStatus();}),'studio-button secondary'),action('Copy prompt + evidence',()=>run(async()=>{await settled();const k=createStudioKit({state,model,settings});try{await navigator.clipboard.writeText(k.text);notice.textContent='Report kit copied.';}catch{preview.open=true;const range=document.createRange();range.selectNodeContents(pre);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);pre.focus();notice.textContent='Clipboard unavailable. The kit is selected for manual copy, or use Download Markdown.';}}),'studio-button secondary'));
   d.append(para('Attach the media ZIP to an LLM with file support, or attach the Markdown and its images separately. The kit asks for the same five-movement PDF composition each time; wording still varies by model.','panel-note'));
  }d.append(node('a','Classic tools & local AI',{href:'/personality/report?presentation=classic','data-document-navigation':true}),action('Install report for offline use',()=>run(async()=>{await installOffline({onProgress:p=>notice.textContent=`Offline files: ${p.completed}/${p.total}`});notice.textContent='Offline report installed. Answers stay on this device.';}),'studio-button secondary'),action('Download original answer backup',()=>run(onBackup),'studio-button secondary'),action('Open existing sharing options',()=>{d.close();onShare();},'studio-button secondary'));
 }
 const beforePrint=()=>{if(ready){refresh(true);content.querySelectorAll('img').forEach(img=>img.loading='eager');content.querySelectorAll('details').forEach(d=>d.open=true);}};
 const afterPrint=()=>refresh();window.addEventListener('beforeprint',beforePrint);window.addEventListener('afterprint',afterPrint);
 customize.disabled=print.disabled=kit.disabled=true;refresh();
 const opening=queue.then(async()=>{if(canSave&&!initialSettings){const loaded=await loadStudioSettings(recordId);if(disposed)return;settings=loaded.settings;revision=loaded.revision;}}).catch(e=>{storageFailure=e;showError(e);}).finally(()=>{if(disposed)return;ready=true;customize.disabled=print.disabled=kit.disabled=false;refresh();updateStatus();});queue=opening;onPending(queue);
 return ()=>{disposed=true;for(const d of dialogs){d.close();d.remove();}window.removeEventListener('scroll',syncNav);window.removeEventListener('resize',syncNav);window.removeEventListener('beforeprint',beforePrint);window.removeEventListener('afterprint',afterPrint);delete document.body.dataset.reportStudio;};
}
