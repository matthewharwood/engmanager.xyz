import {ATLAS_BANK} from './atlas-bank.mjs';
import {typeProfile} from './atlas-model.mjs';
import {createTarotDraw} from './story-core.mjs';
import {emptyStory, loadStory, saveStory, loadStorySources, validateStory} from './story-store.mjs';

const el = (tag,text='',attributes={}) => {
  const node=document.createElement(tag);
  if(text!==null)node.textContent=text;
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
  return node;
};

export function mountStoryStudio(root,{recordId=null,canSave=false,onChange=()=>{},onPending=()=>{},preface=false}={}) {
  const panel=el('section',null,{class:'atlas-studio',id:'story-studio','aria-labelledby':'studio-title'});
  panel.append(el('p',preface?'Your story / optional preface':'Make it yours / optional',{class:'report-kicker'}),el('h2',preface?'Tell the report what matters to you.':'Add the context behind the answers.',{id:'studio-title'}),
    el('p','Choose only what feels useful. Your background and birthday stay on this device until you explicitly include selected details in a report kit. These answers never change your scores.'));
  const status=el('p','Loading optional story tools…',{class:'atlas-status',role:'status'});
  panel.append(status);root.append(panel);
  let sources=null,value=emptyStory(),revision=0,failed=false,disposed=false,saveNumber=0,queue=Promise.resolve();
  const notify=()=>{if(!disposed)onChange({value:structuredClone(value),sources});};
  const persist=()=>{
    if(!sources)return;
    try{validateStory(value,sources);}catch(error){status.textContent=error.message;return;}
    notify();
    if(!canSave||!recordId){status.textContent='Story changes are in this tab only. Download the kit before leaving.';return;}
    status.textContent='Saving story on this device…';
    const snapshot=structuredClone(value);
    const current=++saveNumber;
    queue=queue.then(async()=>{
      if(failed)return;
      try{const saved=await saveStory(recordId,revision,snapshot,sources);revision=saved.revision;if(!disposed&&current===saveNumber)status.textContent='Story saved on this device.';}
      catch(error){failed=true;if(!disposed)status.textContent=`Story was not saved: ${error.message} Reload before making more changes.`;}
    });
    onPending(queue);
  };
  function question(q) {
    const card=el('fieldset',null,{class:'atlas-question'});
    card.append(el('legend',q.prompt));
    const selected=[...(value.background[q.id]?.selected??[])];
    const options=[...q.options,...(q.optionCatalog?sources.countries.options:[])];
    const selfDescribeIds=new Set(options.filter(option=>/Self-describe/i.test(option.label)).map(option=>option.id));
    const choices=el('div',null,{class:'atlas-options'});
    let search=null;
    if(q.optionCatalog){
      search=el('input',null,{type:'search',placeholder:'Search countries or territories','aria-label':`Search choices for ${q.prompt}`});
      card.append(search);
    }
    const approval=el('input',null,{type:'checkbox',id:`approve-${q.id}`});
    approval.checked=value.approvedIds.includes(q.id);
    approval.disabled=!selected.length;
    approval.addEventListener('change',()=>{value.approvedIds=approval.checked?[...value.approvedIds,q.id]:value.approvedIds.filter(id=>id!==q.id);persist();});
    const answerStatus=el('p',value.background[q.id]?.status==='skipped'?'Skipped for now. You can answer later.':'',{class:'atlas-answer-status',role:'status'});
    let selfField=null,selfInput=null;
    if(selfDescribeIds.size){
      selfInput=el('input',null,{type:'text',id:`${q.id}-self-description`,maxlength:'120',autocomplete:'off'});
      selfInput.value=value.background[q.id]?.selfDescription??'';
      const label=el('label',null,{for:selfInput.id});label.append(document.createTextNode('Describe in your own words (optional)'),selfInput);
      selfField=el('div',null,{class:'atlas-self-description'});selfField.append(label);
      selfField.hidden=!selected.some(id=>selfDescribeIds.has(id));
      selfInput.addEventListener('input',()=>{if(value.background[q.id]?.status!=='answered')return;value.background[q.id].selfDescription=selfInput.value;persist();});
    }
    const syncChoices=()=>{
      for(const input of choices.querySelectorAll('input[data-option]'))input.checked=selected.includes(input.value);
      approval.disabled=!selected.length;
      selfField&&(selfField.hidden=!selected.some(id=>selfDescribeIds.has(id)));
    };
    function choose(optionId,checked){
      const option=options.find(item=>item.id===optionId);
      let next=q.type==='single_select'?[optionId]:checked?[...selected,optionId]:selected.filter(id=>id!==optionId);
      if(option?.exclusive)next=[optionId];
      else if(checked)next=next.filter(id=>!options.find(item=>item.id===id)?.exclusive);
      if(next.length>q.maxSelections){status.textContent=`Choose at most ${q.maxSelections} answers here.`;syncChoices();return;}
      const selfDescription=next.some(id=>selfDescribeIds.has(id))?selfInput?.value??'':'';
      if(next.length)value.background[q.id]={status:'answered',selected:next,...(selfDescription?{selfDescription}:{})};
      else delete value.background[q.id];
      if(!next.length){value.approvedIds=value.approvedIds.filter(id=>id!==q.id);approval.checked=false;}
      selected.splice(0,selected.length,...next);
      if(!selfDescription&&selfInput)selfInput.value='';
      answerStatus.textContent='';syncChoices();
      persist();
    }
    for(const option of options){
      const input=el('input',null,{type:q.type==='single_select'?'radio':'checkbox',name:q.id,value:option.id,'data-option':'',id:`${q.id}-${option.id}`});
      input.checked=selected.includes(option.id);
      input.addEventListener('change',()=>choose(option.id,input.checked));
      const label=el('label',null,{for:input.id});label.append(input,document.createTextNode(option.label));choices.append(label);
    }
    if(search)search.addEventListener('input',()=>{for(const label of choices.children)label.hidden=!label.textContent.toLowerCase().includes(search.value.trim().toLowerCase());});
    card.append(choices);
    if(selfField)card.append(selfField);
    const skip=el('button','Skip for now',{type:'button',class:'text-button'});
    const clear=el('button','Clear answer',{type:'button',class:'text-button'});
    const reset=skipped=>{
      if(skipped)value.background[q.id]={status:'skipped',selected:[]};else delete value.background[q.id];
      value.approvedIds=value.approvedIds.filter(id=>id!==q.id);approval.checked=false;
      selected.splice(0);if(selfInput)selfInput.value='';
      answerStatus.textContent=skipped?'Skipped for now. You can answer later.':'';
      syncChoices();persist();
    };
    skip.addEventListener('click',()=>reset(true));clear.addEventListener('click',()=>reset(false));
    const questionActions=el('div',null,{class:'atlas-question-actions'});questionActions.append(skip,clear,answerStatus);card.append(questionActions);
    const include=el('label',null,{class:'atlas-approval',for:approval.id});include.append(approval,document.createTextNode('Include this answer in the AI report kit'));
    card.append(include);
    return card;
  }
  function render() {
    const chapters=new Map();
    for(const q of sources.bank.questions.filter(item=>item.id!=='bg35')){if(!chapters.has(q.chapter))chapters.set(q.chapter,[]);chapters.get(q.chapter).push(q);}
    const background=el('details',null,{class:'atlas-editor',id:'story-background'});
    background.open=preface;
    background.append(el('summary','Background and life context · 35 optional questions'),el('p','Answer any number. Approval is off for each question until you turn it on. Identity labels and birthplace are used only as your own context, never to infer a trait. Birthday symbols have their own panel.'));
    let firstChapter=true;
    for(const [title,questions] of chapters){
      const group=el('details',null,{class:'atlas-question-group'});group.append(el('summary',`${title} · ${questions.length} questions`));
      if(preface&&firstChapter)group.open=true;
      firstChapter=false;
      for(const q of questions)group.append(question(q));background.append(group);
    }
    const symbols=el('details',null,{class:'atlas-editor',id:'story-symbols-editor'});
    symbols.open=preface;
    symbols.append(el('summary','Birthday symbols and tarot'),el('p','These are creative motifs. They are not personality evidence or predictions. The full birthday never enters the standard kit.'));
    const date=el('input',null,{type:'date',id:'story-birthday',min:'1901-01-01',max:new Date().toISOString().slice(0,10)});date.value=value.birthday;
    date.addEventListener('change',()=>{const before=value.birthday;value.birthday=date.value;try{validateStory(value,sources);persist();}catch(error){value.birthday=before;date.value=before;status.textContent=error.message;}});
    const dateLabel=el('label',null,{for:date.id});dateLabel.append(document.createTextNode('Birthday, optional '),date);symbols.append(dateLabel);
    const selected=value.background.bg35?.selected??[];
    for(const [id,optionId,title] of [['western','o01','Western sun sign'],['chinese','o02','Chinese zodiac year'],['tarot','o03','Three-card tarot reflection']]){
      const choose=el('input',null,{type:'checkbox',id:`symbol-${id}`});choose.checked=selected.includes(optionId);
      const share=el('input',null,{type:'checkbox',id:`symbol-approve-${id}`});share.checked=value.approvedSymbols.includes(id);share.disabled=!choose.checked;
      choose.addEventListener('change',()=>{
        let next=choose.checked?[...selected,optionId]:selected.filter(x=>x!==optionId);
        if(next.length)value.background.bg35={status:'answered',selected:next};else delete value.background.bg35;
        selected.splice(0,selected.length,...next);
        if(!choose.checked){value.approvedSymbols=value.approvedSymbols.filter(x=>x!==id);share.checked=false;}
        share.disabled=!choose.checked;persist();
      });
      share.addEventListener('change',()=>{value.approvedSymbols=share.checked?[...value.approvedSymbols,id]:value.approvedSymbols.filter(x=>x!==id);persist();});
      const line=el('div',null,{class:'atlas-symbol-choice'}),a=el('label',null,{for:choose.id}),b=el('label',null,{for:share.id});
      a.append(choose,document.createTextNode(title));b.append(share,document.createTextNode('Include in kit'));
      line.append(a,b);symbols.append(line);
    }
    const drawButton=el('button',value.draw?'Draw three new cards':'Draw three cards',{type:'button',class:'button secondary'});
    const drawStatus=el('p','',{class:'atlas-status',role:'status'});
    const spread=el('div',null,{class:'atlas-mini-spread'});
    function showDraw(){spread.replaceChildren();if(!value.draw){drawStatus.textContent='No draw saved yet.';return;}
      drawButton.textContent='Draw three new cards';
      drawStatus.dataset.drawId=value.draw.id;
      drawStatus.textContent=`Draw saved ${new Date(value.draw.createdAt).toLocaleString()}. Drawing again replaces this three-card spread.`;
      for(const card of value.draw.cards){const item=sources.deck.cards.find(c=>c.id===card.cardId);
        const figure=el('figure');figure.append(el('img',null,{src:`/assets/personality/v5/tarot/${item.asset.pngPath.split('/').at(-1)}`,alt:item.asset.alt,loading:'lazy'}),el('figcaption',`${item.name} · ${card.orientation}`));spread.append(figure);}
    }
    drawButton.addEventListener('click',()=>{value.draw=createTarotDraw(sources.deck);showDraw();persist();});showDraw();symbols.append(drawButton,drawStatus,spread);
    const type=el('details',null,{class:'atlas-editor',id:'story-type-editor'});
    type.append(el('summary','Explore four preference pairs · 48 draft questions'),el('p','This is an unvalidated research pilot. It does not administer the official Myers–Briggs instrument. You may stop at any point; partial axes remain unclassified.'));
    const typeStatus=el('p','',{class:'atlas-status',role:'status'});
    const updateType=()=>{const profile=typeProfile(value.type);typeStatus.textContent=`${Object.keys(value.type).length}/48 answered${profile.code&&!profile.code.includes('?')?` · exploratory code ${profile.code}`:''}.`;};
    for(const [axis,definition] of Object.entries(ATLAS_BANK.axes)){
      const group=el('details',null,{class:'atlas-question-group'});group.append(el('summary',`${definition.negativePole} / ${definition.positivePole} · 12 questions`));
      for(const item of ATLAS_BANK.typeItems.filter(item=>item.scale===axis)){
        const fieldset=el('fieldset',null,{class:'atlas-type-question'});fieldset.append(el('legend',item.wording));
        for(let score=1;score<=5;score++){
          const input=el('input',null,{type:'radio',name:item.id,value:String(score),id:`${item.id}-${score}`});input.checked=value.type[item.id]===score;
          input.addEventListener('change',()=>{value.type[item.id]=score;updateType();persist();});
          const label=el('label',null,{for:input.id});label.append(input,document.createTextNode(String(score)));fieldset.append(label);
        }
        group.append(fieldset);
      }
      type.append(group);
    }
    updateType();type.insertBefore(typeStatus,type.children[2]);
    if(preface){panel.insertBefore(symbols,status);panel.insertBefore(background,status);panel.insertBefore(type,status);}
    else {panel.insertBefore(background,status);panel.insertBefore(type,status);panel.insertBefore(symbols,status);}
    if(preface&&(!canSave||!recordId)){
      panel.querySelectorAll('input,button').forEach(control=>{control.disabled=true;});
      status.textContent='Local saving is unavailable. Save a local copy before answering optional story questions.';
    }else status.textContent=canSave&&recordId?'Optional story is saved separately on this device.':'Optional story stays in this report tab until you download a kit.';
  }
  const ready=loadStorySources().then(async loaded=>{
    sources=loaded;
    if(canSave&&recordId){const saved=await loadStory(recordId,sources);revision=saved.revision;value=saved.value;}
    if(!disposed){render();notify();}
  }).catch(error=>{if(!disposed)status.textContent=`Optional story unavailable: ${error.message}`;});
  return {ready,snapshot:()=>sources?{value:structuredClone(value),sources}:null,pending:()=>queue,dispose:()=>{disposed=true;}};
}
