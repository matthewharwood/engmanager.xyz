import {mountReportCharts} from './report-charts.mjs';
import {PERSONALITY} from './report-chart-data.mjs';
import {openDB} from './vendor/idb-8.0.3.js';
import {STEPS,DOMAINS,freshState,validateState,encodeState,decodeState} from './preview-state.mjs';

const traits=PERSONALITY.map(({id,name,mean})=>[id,name,mean]);
let state=freshState(), db=null, draftId=null, revision=0, queue=Promise.resolve(), snapshot=false, invalidSnapshot=false, restored=false, pendingWrites=0;
const status=document.getElementById('persistence-status');
function announce(message){status.textContent=message;}
function persist(){
  if(snapshot||invalidSnapshot)return;
  const payload=validateState(state);
  pendingWrites++;
  announce('Saving preview on this device…');
  queue=queue.then(async()=>{
    if(!db)throw new Error('Browser storage is unavailable.');
    const tx=db.transaction(['drafts','metadata'],'readwrite');
    const id=draftId??crypto.randomUUID();
    const current=await tx.objectStore('drafts').get(id);
    if((current?.revision??0)!==revision){tx.abort();await tx.done.catch(()=>{});throw new Error('Another tab changed this draft. Reload before continuing.');}
    const next=revision+1;
    await tx.objectStore('drafts').put({revision:next,payload},id);
    await tx.objectStore('metadata').put(id,'active');
    await tx.done;draftId=id;revision=next;
    pendingWrites--;
    if(!pendingWrites)announce('Saved on this device · preview state only · no remote storage');
  }).catch(error=>{pendingWrites--;announce('Not saved: '+error.message+' You can still copy a snapshot link.');});
}
function navigate(step,focus=true,save=true){
  if(!STEPS.includes(step))step='understand';
  if(!snapshot&&!invalidSnapshot){state.step=step;if(save)persist();history.replaceState(null,'','#'+step);}
  for(const id of STEPS)document.getElementById(id).hidden=id!==step;
  document.querySelectorAll('nav button').forEach(b=>{if(b.dataset.step===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
  if(focus){document.getElementById(step+'-title').focus();window.scrollTo({top:0,behavior:'instant'});}
}
function summary(){return traits.filter(([id])=>state.shared.includes(id)).map(([,name,value])=>name+': '+value.toFixed(2)+' / 5').join(' · ');}
function recipient(){document.getElementById('recipient').textContent=summary()||'No scores selected. The article alone can be shared.';document.getElementById('copy-status').textContent='';}
for(const [id,name,value] of traits){
  const opt=document.createElement('label'), input=document.createElement('input');input.type='checkbox';input.value=id;
  input.addEventListener('change',()=>{state.shared=DOMAINS.filter(d=>document.querySelector('#share-options input[value="'+d+'"]').checked);recipient();persist();});
  opt.append(input,' '+name);document.getElementById('share-options').append(opt);
}
mountReportCharts(document.getElementById('report-charts'));

async function openStorage(){
  let expired=false, timer;
  const opening=openDB('engmanager.big-personality.design-preview',1,{upgrade(db){db.createObjectStore('drafts');db.createObjectStore('metadata');},blocking(){db?.close();db=null;announce('Preview storage changed in another tab. Reload to save.');}}).then(connection=>{if(expired){connection.close();throw new Error('Local storage took too long to open.');}return connection;});
  try{return await Promise.race([opening,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(new Error('Local storage is blocked. Close other preview tabs and reload.'));},3000);})]);}
  finally{clearTimeout(timer);}
}
const params=new URLSearchParams(location.hash.slice(1));
if(params.has('p')){
  try{if([...params.keys()].length!==1||params.getAll('p').length!==1)throw new Error('Ambiguous snapshot.');state=decodeState(params.get('p'));snapshot=true;announce('Viewing a fixed snapshot · your existing local draft is unchanged');}
  catch(error){invalidSnapshot=true;announce('Snapshot could not be opened: '+error.message+' Your local draft is unchanged.');}
}else{
  state.step=STEPS.includes(location.hash.slice(1))?location.hash.slice(1):'understand';
  try{
    db=await openStorage();
    draftId=await db.get('metadata','active')??null;
    const record=draftId?await db.get('drafts',draftId):null;
    if(draftId&&!record)throw new Error('Saved draft is missing.');
    if(record){state=validateState(record.payload);if(!Number.isSafeInteger(record.revision)||record.revision<1)throw new Error('Invalid revision');revision=record.revision;restored=true;announce('Restored your saved preview and position from this device');}
  }catch(error){db?.close();db=null;draftId=null;revision=0;announce('Not saved: '+error.message+' Original storage was preserved; snapshot links still work.');}
}
window.addEventListener('hashchange',()=>location.reload());
document.getElementById('fork-snapshot').hidden=!snapshot;
if(snapshot||invalidSnapshot)document.getElementById('demo-storage-badge').textContent='Unscored demo · read-only view';
document.getElementById('snapshot-link').hidden=true;
document.querySelectorAll('input[name=demo]').forEach(i=>{i.checked=Number(i.value)===state.answer;i.disabled=snapshot||invalidSnapshot;i.addEventListener('change',()=>{state.answer=Number(i.value);state.skipped=false;document.getElementById('answer-status').textContent='Example selected; still unscored.';persist();});});
for(const id of ['interests','values']){const el=document.getElementById(id);el.checked=state[id];el.disabled=snapshot||invalidSnapshot;el.addEventListener('change',()=>{state[id]=el.checked;persist();});}
document.querySelectorAll('#share-options input').forEach(i=>{i.checked=state.shared.includes(i.value);i.disabled=snapshot||invalidSnapshot;});
document.getElementById('answer-status').textContent=state.skipped?'Example skipped; preserved in this preview state.':state.answer!==null?'Example answer restored; still unscored.':'';
document.getElementById('skip').disabled=snapshot||invalidSnapshot;
document.getElementById('skip').addEventListener('click',()=>{state.answer=null;state.skipped=true;document.querySelectorAll('input[name=demo]').forEach(i=>i.checked=false);document.getElementById('answer-status').textContent='Example skipped; preserved in local preview state.';persist();});
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.step)));
document.querySelector('a.brand').addEventListener('click',e=>{e.preventDefault();navigate('understand');});
document.getElementById('fork-snapshot').addEventListener('click',async()=>{
  const button=document.getElementById('fork-snapshot');
  if(button.disabled||!snapshot)return;
  button.disabled=true;document.querySelectorAll('[data-step]').forEach(b=>b.disabled=true);
  try{
    db=await openStorage();
    const id=crypto.randomUUID(),tx=db.transaction(['drafts','metadata'],'readwrite');
    await tx.objectStore('drafts').add({revision:1,payload:validateState(state)},id);
    await tx.objectStore('metadata').put(id,'active');await tx.done;
    history.replaceState(null,'','#'+state.step);location.reload();
  }catch(error){announce('Could not save a local copy: '+error.message+' Snapshot and existing drafts are unchanged.');button.disabled=false;document.querySelectorAll('[data-step]').forEach(b=>b.disabled=false);}
});
document.getElementById('copy').addEventListener('click',async()=>{const text='The Big Six-Seven design preview — synthetic example. '+(summary()||'No scores shared.')+' Response-scale means, not percentiles.';try{await navigator.clipboard.writeText(text);document.getElementById('copy-status').textContent='Copied synthetic example text.';}catch{document.getElementById('copy-status').textContent='Clipboard unavailable. Select the preview text to copy manually.';}});
document.getElementById('copy-snapshot').addEventListener('click',async()=>{if(invalidSnapshot)return;await queue;const url=new URL(location.href);url.search='';url.hash='p='+encodeState(state);const output=document.getElementById('snapshot-link');output.hidden=false;output.value=url.href;try{await navigator.clipboard.writeText(url.href);document.getElementById('snapshot-status').textContent='Copied exact preview snapshot. Anyone with this link can read the example answer and selections.';}catch{document.getElementById('snapshot-status').textContent='Snapshot ready below. Select and copy the link.';}});
document.getElementById('print').addEventListener('click',()=>window.print());document.querySelectorAll('audio').forEach(a=>a.volume=.15);
recipient();navigate(state.step,false,false);document.documentElement.removeAttribute('data-hydrating');
if(!snapshot&&!invalidSnapshot&&!restored&&db)persist();
