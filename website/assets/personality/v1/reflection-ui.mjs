import {GOALS,FORMATS,TASKS,validateContext,createEnhancement,buildPrompt,parseGenerated} from './enhancement.mjs';
import {renderEnhancement} from './report.mjs';

function el(tag,text,attributes={}){const n=document.createElement(tag);if(text!==null)n.textContent=text;for(const[k,v]of Object.entries(attributes))n.setAttribute(k,v);return n;}
const p=text=>el('p',text);
function field(label,node){const box=el('div',null,{class:'field'});const l=el('label',label,{for:node.id});box.append(l,node);return box;}
function select(id,options,value){const n=el('select',null,{id});for(const[k,v]of Object.entries(options)){const o=el('option',v,{value:k});o.selected=String(value)===k;n.append(o);}return n;}

export function mountReflection(root,{state,context,enhancement,save,onSaved}){
 let disposed=false,ai=null,controller=null,draft=null,busy=false;
 const panel=el('section',null,{class:'panel reflection-workspace',id:'enhance-report'}),status=p('Preferences and optional notes stay on this device. Save context before leaving this page.');status.setAttribute('role','status');
 panel.append(el('p','OPTIONAL / PUT YOUR PROFILE TO WORK',{class:'eyebrow'}),el('h2','A more personal next step'),p('Choose a goal and a practical format. Reviewed suggestions work immediately. Local AI can connect your findings or help you draft a reflection after an optional model installation.'));
 const controls=el('div',null,{class:'reflection-preferences'}),inputs={goal:select('reflection-goal',GOALS,context.goal),format:select('reflection-format',FORMATS,context.format),minutes:select('reflection-minutes',{'10':'10 minutes','20':'20 minutes','45':'45 minutes'},context.minutes)};
 controls.append(field('What would you like help with?',inputs.goal),field('A format that feels practical',inputs.format),field('Time for one experiment',inputs.minutes));panel.append(controls);
 const more=el('details',null,{class:'reflection-context'});more.append(el('summary','Add an example, question, choice, or dated notes'));
 for(const[key,label]of Object.entries({example:'A real work example',comparison:'Two projects or options you want to compare',question:'A question about your report, or a reflection to check',history:'Dated notes about an earlier experiment'})){
  const text=el('textarea',null,{id:`reflection-${key}`,rows:'3',maxlength:'1500'});text.value=context[key];inputs[key]=text;more.append(field(label,text));
 }
 more.append(p('These are optional, unscored prompts. Examples are your account of an experience, not verified achievements. Notes do not become a measure of personality change.'));panel.append(more);
 const read=()=>validateContext({...Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,n.value])),minutes:Number(inputs.minutes.value)});
 const buttons=[];
 async function action(fn){if(busy||disposed)return;busy=true;buttons.forEach(b=>b.disabled=true);try{await fn();}catch(error){if(!disposed)status.textContent=error.name==='AbortError'?'Cancelled. Your saved report is unchanged.':error.message;}finally{busy=false;if(!disposed)buttons.forEach(b=>b.disabled=false);}}
 function button(label,fn,secondary=true){const b=el('button',label,{type:'button',class:secondary?'button secondary':'button'});b.addEventListener('click',()=>action(fn));buttons.push(b);return b;}
 const actions=el('div',null,{class:'actions'});
 const saved=()=>{if(!disposed)onSaved();};
 actions.append(button('Save context',async()=>{await save(read(),null);status.textContent='Context saved on this device. Create new suggestions to reflect these preferences.';saved();}),button('Save reviewed suggestions',async()=>{const c=read();await save(c,createEnhancement(state,c));saved();},false));
 if(enhancement)actions.append(button('Remove saved reflection',async()=>{await save(read(),null);saved();}));
 panel.append(actions,p('Reviewed suggestions use explicit editorial rules over your available scores, goal, and format. These rules have not been validated as predictions of success.'));
 const setup=el('details',null,{class:'local-ai-setup'});setup.append(el('summary','Explore ten actions with local AI'),p('Optional and experimental. A compatible WebGPU browser and a substantial model download are required. The model runs here; answers and notes are not sent to an AI service.'));
 const setupBody=el('div'),task=select('reflection-task',Object.fromEntries(TASKS.map(t=>[t.id,t.name])),'synthesis'),draftRoot=el('div',null,{class:'reflection-draft'});
 setup.append(field('What would you like to do?',task));
 setup.append(button('Set up local AI',async()=>{
  status.textContent='Checking the local AI runtime…';
  const runtime=await import('../ai/v1/runtime.mjs');
  if(disposed)return;
  ai??=runtime.createLocalAI({onStatus:message=>{if(!disposed)status.textContent=typeof message==='string'?message:message.message??message.phase??'Working locally…';}});
  const capabilities=await ai.capabilities();
  if(capabilities.supported===false)throw new Error(capabilities.reason||'This browser cannot run the local model. Reviewed suggestions remain available.');
  const manager=await import('../ai/v1/model-manager.mjs');const model=manager.PINNED_MODEL??runtime.PINNED_MODEL;
  if(!model)throw new Error('The model manifest is unavailable.');
  setupBody.replaceChildren();
  setupBody.append(p('Download the pinned model from its publisher, then choose that file below. Import verifies the entire file before installation. Allow approximately 2 GB for the model, additional temporary storage, and 32 MB for the runtime. Runtime memory is separate; some devices cannot run this model.'));
  const download=el('a','Download the supported model (about 2 GB)',{href:model.downloadUrl??model.url,target:'_blank',rel:'noopener noreferrer',class:'button secondary','data-document-navigation':'true'});
  const file=el('input',null,{id:'local-ai-model',type:'file',accept:'.litertlm'});
  setupBody.append(download,field('Choose the downloaded .litertlm file',file),button('Import model and install runtime',async()=>{
   if(!file.files[0])throw new Error('Choose the supported model file first.');controller=new AbortController();
   status.textContent='Installing public app files and verifying the local model…';
   const{installOffline}=await import('./offline.mjs');await installOffline();
   if(ai.installRuntime)await ai.installRuntime({signal:controller.signal});else if(runtime.installRuntime)await runtime.installRuntime({signal:controller.signal});
   await ai.importModel(file.files[0],{signal:controller.signal,onProgress:progress=>{if(!disposed)status.textContent=progress?.total?`Verifying model · ${Math.round(progress.loaded/progress.total*100)}%`:'Verifying the model file…';}});
   status.textContent='Model installed on this device. Choose an action and generate a draft.';
  }),button('Remove local model',async()=>{await ai.removeModel();status.textContent='Local model removed. Saved reflections remain readable.';}));
  const installed=await ai.modelStatus();status.textContent=installed.installed?'Your local model is installed. Choose an action below.':'Set up the optional model, or continue with reviewed suggestions.';
 }));
 setup.append(setupBody,button('Generate local draft',async()=>{
  if(!ai)throw new Error('Choose “Set up local AI” first.');
  const c=read(),taskId=task.value,request=buildPrompt(state,c,taskId);controller=new AbortController();
  draftRoot.replaceChildren();draft=null;status.textContent='Generating on this device. You can cancel at any time…';
  const result=await ai.generate({system:request.system,prompt:request.prompt,validate:value=>parseGenerated(value,request.facts)},{signal:controller.signal});
  if(disposed)return;
  draft=createEnhancement(state,c,{kind:'local-ai',task:taskId,model:'gemma-4-E2B-web / litert-lm-0.17.1',sections:result.sections});
  draftRoot.append(el('h3','Review this AI draft'),p('Check each statement and its evidence. A local model can still make mistakes. Kept text and its supporting excerpts will appear in your PDF; sharing it requires a separate choice.'));
  const preview=el('div');renderEnhancement(preview,draft);draftRoot.append(preview);
  const editors=draft.sections.map(section=>{const text=el('textarea',null,{rows:'4',maxlength:'700','aria-label':`Edit ${section.title}`});text.value=section.body;draftRoot.append(field(section.title,text));return text;});
  draftRoot.append(button('Keep this reflection',async()=>{draft.sections.forEach((s,i)=>s.body=editors[i].value);await save(c,draft);saved();},false));
  status.textContent='Draft ready. Review, edit, and keep it if useful. Your scientific scores are unchanged.';
 },false));
 const cancel=el('button','Cancel local operation',{type:'button',class:'button secondary'});cancel.addEventListener('click',()=>{controller?.abort();ai?.cancel();});setup.append(cancel,draftRoot);
 panel.append(setup,status);root.append(panel);
 return ()=>{disposed=true;controller?.abort();ai?.cancel();ai?.unload().catch(()=>{});};
}
