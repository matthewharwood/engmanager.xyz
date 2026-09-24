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
  panel.append(el('p',preface?'Your story':'Make it yours',{class:'report-kicker'}),el('h2',preface?'Tell the report what matters to you.':'Add the context behind the answers.',{id:'studio-title'}),
    el('p','Answer what is useful. Anything you enter is saved on this device and included when you download the report kit. Blank questions stay out. These details never change your scores.'));
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
    const visibleOptions=options.filter(option=>option.id!=='prefer_not');
    const catalogIds=new Set(q.optionCatalog?sources.countries.options.map(option=>option.id):[]);
    const selfDescribeIds=new Set(options.filter(option=>/Self-describe/i.test(option.label)).map(option=>option.id));
    const choices=el('div',null,{class:q.optionCatalog?'atlas-options atlas-options-search':'atlas-options'});
    const feedback=el('p','',{class:'atlas-question-feedback',role:'status'});
    let search=null;
    if(q.optionCatalog){
      search=el('input',null,{type:'search',placeholder:'Search countries or territories','aria-label':`Search choices for ${q.prompt}`});
      card.append(search);
    }
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
      selfField&&(selfField.hidden=!selected.some(id=>selfDescribeIds.has(id)));
      clear.hidden=!selected.length;
    };
    function choose(optionId,checked){
      const option=options.find(item=>item.id===optionId);
      let next=q.type==='single_select'?[optionId]:checked?[...selected,optionId]:selected.filter(id=>id!==optionId);
      if(option?.exclusive)next=[optionId];
      else if(checked)next=next.filter(id=>!options.find(item=>item.id===id)?.exclusive);
      if(next.length>q.maxSelections){feedback.textContent=`Choose at most ${q.maxSelections} answers here.`;syncChoices();return;}
      const selfDescription=next.some(id=>selfDescribeIds.has(id))?selfInput?.value??'':'';
      if(next.length)value.background[q.id]={status:'answered',selected:next,...(selfDescription?{selfDescription}:{})};
      else delete value.background[q.id];
      selected.splice(0,selected.length,...next);
      if(!selfDescription&&selfInput)selfInput.value='';
      feedback.textContent='';syncChoices();
      persist();
    }
    for(const option of visibleOptions){
      const input=el('input',null,{type:q.type==='single_select'?'radio':'checkbox',name:q.id,value:option.id,'data-option':'',id:`${q.id}-${option.id}`});
      input.checked=selected.includes(option.id);
      input.addEventListener('change',()=>choose(option.id,input.checked));
      const label=el('label',null,{for:input.id});label.append(input,document.createTextNode(option.label));choices.append(label);
    }
    if(search){
      const hint=el('p','Type at least two letters to find a country or territory.',{class:'atlas-search-hint',id:`${q.id}-search-hint`});
      search.setAttribute('aria-describedby',hint.id);
      card.append(hint);
      const filter=()=>{const term=search.value.trim().toLowerCase();for(const label of choices.children){
        const input=label.querySelector('input');label.hidden=Boolean(input&&catalogIds.has(input.value)&&!input.checked&&term.length<2)||Boolean(term.length>=2&&!label.textContent.toLowerCase().includes(term));
      }};
      search.addEventListener('input',filter);filter();
    }
    card.append(choices);
    card.append(feedback);
    if(selfField)card.append(selfField);
    const clear=el('button','Clear answer',{type:'button',class:'atlas-clear'});
    clear.hidden=!selected.length;
    const reset=()=>{
      delete value.background[q.id];
      selected.splice(0);if(selfInput)selfInput.value='';
      feedback.textContent='';
      syncChoices();persist();
    };
    clear.addEventListener('click',reset);
    card.append(clear);
    return card;
  }
  function render() {
    const chapters=new Map();
    for(const q of sources.bank.questions.filter(item=>item.id!=='bg35')){if(!chapters.has(q.chapter))chapters.set(q.chapter,[]);chapters.get(q.chapter).push(q);}
    const background=el('details',null,{class:'atlas-editor',id:'story-background'});
    background.open=preface;
    background.append(el('summary','Background and life context · 35 questions'),el('p','Only answered questions enter the report kit. Identity and birthplace are treated as your own context, never used to infer a trait.'));
    let firstChapter=true;
    for(const [title,questions] of chapters){
      const group=el('details',null,{class:'atlas-question-group'});group.append(el('summary',`${title} · ${questions.length} questions`));
      if(preface&&firstChapter)group.open=true;
      firstChapter=false;
      for(const q of questions)group.append(question(q));background.append(group);
    }
    const symbols=el('details',null,{class:'atlas-editor',id:'story-symbols-editor'});
    symbols.open=preface;
    symbols.append(el('summary','Birthday symbols and tarot'),el('p','Enter a birthday to derive both zodiac motifs. A three-card spread is drawn automatically. These are creative prompts, not personality evidence or predictions. The full birthday stays out of the kit.'));
    const date=el('input',null,{type:'date',id:'story-birthday',min:'1901-01-01',max:new Date().toISOString().slice(0,10)});date.value=value.birthday;
    const dateError=el('p','',{class:'atlas-question-feedback',id:'story-birthday-error',role:'alert'});
    date.setAttribute('aria-describedby',dateError.id);
    date.addEventListener('change',()=>{const before=value.birthday;value.birthday=date.value;try{validateStory(value,sources);dateError.textContent='';persist();}catch(error){value.birthday=before;date.value=before;dateError.textContent=error.message;}});
    const dateLabel=el('label',null,{for:date.id});dateLabel.append(document.createTextNode('Birthday '),date);symbols.append(dateLabel,dateError);
    const derived=el('p',value.birthday?'Western and Chinese zodiac motifs are ready for your report.':'Birthday motifs appear after you enter a date.',{class:'atlas-derived'});
    date.addEventListener('change',()=>{derived.textContent=value.birthday?'Western and Chinese zodiac motifs are ready for your report.':'Birthday motifs appear after you enter a date.';});
    symbols.append(derived);
    const drawButton=el('button','Draw three new cards',{type:'button',class:'button secondary'});
    const drawStatus=el('p','',{class:'atlas-status',role:'status'});
    const spread=el('div',null,{class:'atlas-mini-spread',role:'group','aria-label':'Your three-card tarot spread'});
    function showDraw(){spread.replaceChildren();if(!value.draw){drawStatus.textContent='Preparing your three-card spread…';return;}
      drawStatus.dataset.drawId=value.draw.id;
      drawStatus.textContent=`Draw saved ${new Date(value.draw.createdAt).toLocaleString()}. Drawing again replaces this three-card spread.`;
      for(const card of value.draw.cards){const item=sources.deck.cards.find(c=>c.id===card.cardId);
        const figure=el('figure');figure.append(el('img',null,{src:`/assets/personality/v6/tarot/${item.asset.pngPath.split('/').at(-1)}`,alt:item.asset.alt,loading:'lazy'}),el('figcaption',`${item.name} · ${card.orientation}`));spread.append(figure);}
    }
    const newDraw=!value.draw;
    if(newDraw)value.draw=createTarotDraw(sources.deck);
    drawButton.addEventListener('click',()=>{value.draw=createTarotDraw(sources.deck);showDraw();persist();});showDraw();symbols.append(spread,drawButton,drawStatus);
    const type=el('details',null,{class:'atlas-editor',id:'story-type-editor'});
    type.append(el('summary','Preference patterns · 48 questions'),el('p','A research pilot, separate from the 170 scored questions. Answering all four preference pairs gives an exploratory type; partial pairs remain unclassified. This is not the official Myers–Briggs instrument.'));
    const typeStatus=el('p','',{class:'atlas-status',role:'status'});
    const updateType=()=>{const profile=typeProfile(value.type);typeStatus.textContent=`${Object.keys(value.type).length}/48 answered${profile.code&&!profile.code.includes('?')?` · exploratory code ${profile.code}`:''}.`;};
    for(const [axis,definition] of Object.entries(ATLAS_BANK.axes)){
      const group=el('details',null,{class:'atlas-question-group'});group.append(el('summary',`${definition.negativePole} / ${definition.positivePole} · 12 questions`),el('p','Rate each statement from 1 (strongly disagree) to 5 (strongly agree).',{class:'atlas-scale-hint'}));
      for(const item of ATLAS_BANK.typeItems.filter(item=>item.scale===axis)){
        const fieldset=el('fieldset',null,{class:'atlas-type-question'});fieldset.append(el('legend',item.wording));
        const scale=el('div',null,{class:'atlas-type-scale'});
        for(let score=1;score<=5;score++){
          const input=el('input',null,{type:'radio',name:item.id,value:String(score),id:`${item.id}-${score}`,'aria-label':`${score} — ${['','strongly disagree','disagree','neither agree nor disagree','agree','strongly agree'][score]}`});input.checked=value.type[item.id]===score;
          input.addEventListener('change',()=>{value.type[item.id]=score;updateType();persist();});
          const label=el('label',null,{for:input.id});label.append(input,document.createTextNode(String(score)));scale.append(label);
        }
        fieldset.append(scale);
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
    }else {status.textContent=canSave&&recordId?'Your story is saved separately on this device.':'Your story stays in this tab until you download the kit.';if(newDraw)persist();}
  }
  const ready=loadStorySources().then(async loaded=>{
    sources=loaded;
    if(canSave&&recordId){const saved=await loadStory(recordId,sources);revision=saved.revision;value=saved.value;}
    if(!disposed){render();notify();}
  }).catch(error=>{if(!disposed)status.textContent=`Optional story unavailable: ${error.message}`;});
  return {ready,snapshot:()=>sources?{value:structuredClone(value),sources}:null,pending:()=>queue,dispose:()=>{disposed=true;}};
}
