import {createReportKit, COMPARISON_PROMPT} from './report-kit.mjs';
import {loadKitSettings, saveKitSettings} from './report-kit-store.mjs';
import {score} from '../v1/core.mjs';

function el(tag, text, attributes={}) {
  const node=document.createElement(tag);
  if(text!==null)node.textContent=text;
  for(const [name,value] of Object.entries(attributes))node.setAttribute(name,value);
  return node;
}
function field(label,input,help) {
  const wrapper=el('div',null,{class:'field'});
  wrapper.append(el('label',label,{for:input.id}),input);
  if(help)wrapper.append(el('p',help,{class:'small'}));
  return wrapper;
}
function download(kit) {
  const url=URL.createObjectURL(new Blob(['\ufeff',kit.text],{type:kit.mimeType}));
  const anchor=el('a','',{href:url,download:kit.filename});
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

export function mountReportKit(root,{state,enhancement=null,recordId=null,canSave=false,flush=async()=>{},pendingWrites=Promise.resolve(),onPending=()=>{}}) {
  let disposed=false,revision=0,ready=!canSave||!recordId,failed=false,queue=Promise.resolve();
  const completion=score(state).completion;
  const panel=el('section',null,{class:'report-kit',id:'report-kit','aria-labelledby':'report-kit-title'});
  panel.append(el('p','01 / UNDERSTANDING YOU AT WORK',{class:'eyebrow'}),el('h2','A workplace report. A PDF to share.',{id:'report-kit-title'}),el('p','A candid, third-person account of how you work, written in the measured style of a psychologist briefing a manager or team lead. It connects your tendencies, possible friction, and support needs, with your scores at the back. The report is AI-written, not a psychologist’s assessment. You review it and decide whether to share it.'));
  const steps=el('ol',null,{class:'kit-steps'});
  for(const [title,body] of [
    ['Download your kit','One Markdown file includes the workplace-report brief, every selected answer, all available scores and facets, and the source notes. It is the input for your AI, not the finished PDF.'],
    ['Attach it to a fresh chat','Choose an AI chat that can create downloadable files. Attach the Markdown file and ask: Follow this brief and create my workplace report PDF. Attaching the file avoids long pasted text being clipped.'],
    ['Review it before sharing','The brief asks for a company-facing report about working with you, a short introduction in your own words, and readable score tables in a carefully typeset PDF. Revise anything that feels inaccurate before sharing. If the chat cannot create files, it will give you report text to export as PDF elsewhere.']
  ]) { const item=el('li');item.append(el('strong',title),el('p',body));steps.append(item); }
  panel.append(steps);
  const customize=el('details',null,{class:'kit-customize'});
  customize.append(el('summary','Add a name or context (optional)'));
  const name=el('input',null,{id:'kit-name',type:'text',maxlength:'80',autocomplete:'off',placeholder:'Your name or a pseudonym'});
  const context=el('textarea',null,{id:'kit-context',rows:'3',maxlength:'512',placeholder:'For example: I want a manager or teammate to understand how I work, including what is easy to miss.'});
  const fields=el('div',null,{class:'kit-fields'});
  fields.append(field('Name in the generated report',name,'Leave blank for “A workplace profile.”'),field('What would you like someone to understand?',context,'Only write details you want included in the downloaded file. These notes do not change your scores.'));
  const detailStatus=el('p',canSave&&recordId?'Loading your saved report details…':'Optional details stay in this tab until you download the kit.',{class:'small','role':'status'});
  customize.append(fields,detailStatus);
  name.disabled=!ready;context.disabled=!ready;
  const savedReady=canSave&&recordId?Promise.resolve(pendingWrites).then(()=>loadKitSettings(recordId)).then(saved=>{
    revision=saved.revision;
    if(!disposed){name.value=saved.name;context.value=saved.context;detailStatus.textContent='Saved with this assessment on this device. These details are excluded from ordinary share links and answer backups.';}
  }).catch(error=>{failed=true;if(!disposed)detailStatus.textContent=`Could not load report details: ${error.message} New details can still be downloaded, but will not be saved.`;}).finally(()=>{ready=true;if(!disposed){name.disabled=false;context.disabled=false;}}):Promise.resolve();
  function saveDetails(){
    refreshPreview();
    if(!ready||!canSave||!recordId||failed)return;
    const value={name:name.value,context:context.value};
    detailStatus.textContent='Saving report details on this device…';
    queue=queue.then(async()=>{
      if(failed)return;
      try { const saved=await saveKitSettings(recordId,revision,value);revision=saved.revision;if(!disposed)detailStatus.textContent='Report details saved on this device.'; }
      catch(error){failed=true;if(!disposed)detailStatus.textContent=`Report details were not saved: ${error.message} They are still available in this download.`;}
    });
    onPending(queue);
  }
  name.addEventListener('input',saveDetails);context.addEventListener('input',saveDetails);
  panel.append(customize);
  const include=el('input',null,{type:'checkbox',id:'kit-include-reflection'});
  if(enhancement){
    const label=el('label',null,{class:'check-line',for:include.id});
    label.append(include,document.createTextNode('Also include my kept reflection (optional, unverified prose).'));
    const disclosure=el('details',null,{class:'kit-kept-reflection'});
    disclosure.append(el('summary','Review the exact reflection text'));
    for(const section of enhancement.sections)disclosure.append(el('h3',section.title),el('p',section.body));
    panel.append(label,disclosure);
    include.addEventListener('change',refreshPreview);
  }
  panel.append(el('p',`Includes ${completion.answered} of ${completion.total} selected answers; ${completion.skipped} skipped. ${completion.answered<completion.total?'This is a partial kit: unavailable scores stay explicitly unscored.':'All selected questions are answered.'}`,{class:'kit-coverage small'}));
  panel.append(el('p','This file contains your individual answers and any optional details you add. Nothing is uploaded here. If you attach or paste it into another LLM, that provider receives its contents under its own privacy settings.',{class:'kit-disclosure small'}));
  const status=el('p','No AI account or model installation is needed to download the kit.',{class:'kit-status',role:'status'});
  const previewDetails=el('details',null,{class:'kit-preview'}),preview=el('textarea',null,{id:'kit-preview',readonly:'',rows:'14','aria-label':'Complete report kit text'});
  previewDetails.append(el('summary','Preview the complete prompt and evidence'),preview);
  const make=()=>createReportKit(state,{name:name.value,context:context.value,enhancement,includeReflection:include.checked});
  async function action(fn){try{await savedReady;await flush();await queue;if(disposed)return;await fn(make());}catch(error){if(!disposed)status.textContent=error.message;}}
  function refreshPreview(){if(previewDetails.open)action(kit=>{preview.value=kit.text;});else preview.value='';}
  previewDetails.addEventListener('toggle',()=>{if(previewDetails.open)action(kit=>{preview.value=kit.text;});});
  const actions=el('div',null,{class:'kit-actions'});
  const downloadButton=el('button','Download report kit (.md)',{type:'button',class:'button',id:'download-report-kit'});
  downloadButton.addEventListener('click',()=>action(kit=>{download(kit);status.textContent='Report kit ready in your downloads. Attach the file to a fresh chat that can create files and ask: Follow this brief and create my workplace report PDF.';}));
  const copyButton=el('button','Copy complete kit',{type:'button',class:'button secondary',id:'copy-report-kit'});
  copyButton.addEventListener('click',()=>action(async kit=>{
    try { await navigator.clipboard.writeText(kit.text);status.textContent='Complete prompt and evidence copied. If the chat clips a long paste, attach the downloaded kit instead. Ask it to follow the brief and create your workplace report PDF.'; }
    catch { preview.value=kit.text;previewDetails.open=true;preview.focus();preview.select();status.textContent='Clipboard access is unavailable. Copy the selected text in the preview below.'; }
  }));
  actions.append(downloadButton,copyButton);panel.append(actions,status,previewDetails);
  const later=el('details',null,{class:'kit-comparison'});
  later.append(el('summary','Later: explore two profiles together'),el('p','The main kit is for one person. For a later collaboration conversation, use two separately reviewed kits shared with both people’s agreement. This optional prompt keeps their evidence separate and asks for a combined PDF discussion guide.'));
  const comparison=el('textarea',null,{readonly:'',rows:'7','aria-label':'Optional two-person comparison prompt'});comparison.value=COMPARISON_PROMPT;
  const copyComparison=el('button','Copy two-person prompt',{type:'button',class:'button secondary'});
  copyComparison.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(COMPARISON_PROMPT);status.textContent='Comparison prompt copied. Supply two separate, consensually shared kits in a new chat.';}catch{comparison.focus();comparison.select();status.textContent='Copy the selected comparison prompt below.';}});
  later.append(copyComparison,comparison);panel.append(later);
  panel.insertBefore(actions,steps);panel.insertBefore(status,steps);
  panel.insertBefore(panel.querySelector('.kit-disclosure'),steps);
  root.append(panel);
  return ()=>{disposed=true;};
}
