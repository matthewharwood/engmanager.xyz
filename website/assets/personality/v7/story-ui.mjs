import {ATLAS_BANK} from './atlas-bank.mjs';
import {createTarotDraw} from './story-core.mjs';
import {emptyStory, loadStory, saveStory, loadStorySources, validateStory} from './story-store.mjs';

const el = (tag,text='',attributes={}) => {
  const node=document.createElement(tag);
  if(text!==null)node.textContent=text;
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
  return node;
};
const AXIS_TITLES = {
  EI:'Where ideas take shape',
  SN:'How you make sense of things',
  TF:'What guides your decisions',
  JP:'Finding your rhythm',
};
const AXIS_CONTEXT = {
  EI:'Think about how conversation and time alone help you gather energy and form ideas.',
  SN:'Think about how you take in information: concrete details, patterns, and possibilities.',
  TF:'Think about what you weigh in a decision, including consistency, personal values, and the people affected.',
  JP:'Think about how plans, closure, and flexibility fit your everyday life.',
};
const SCALE_LABELS = ['Strongly disagree','Disagree','Neither agree nor disagree','Agree','Strongly agree'];

export function mountStoryStudio(root,{recordId=null,canSave=false,onChange=()=>{},onPending=()=>{},preface=false}={}) {
  const panel=el('section',null,{class:'atlas-studio',id:'story-studio','aria-labelledby':'studio-title'});
  panel.append(el('p',preface?'Your story':'Make it yours',{class:'report-kicker'}),el('h2',preface?'Tell the report what matters to you.':'Add the context behind the answers.',{id:'studio-title'}),
    el('p','Answer what is useful. Anything you enter is saved on this device and included when you download the report kit. Blank questions stay out. These details never change your scores.'));
  const status=el('p','Loading optional story tools…',{class:'atlas-status',role:'status'});
  panel.append(status);root.append(panel);
  let sources=null,value=emptyStory(),revision=0,failed=false,disposed=false,saveNumber=0,queue=Promise.resolve(),migrated=false,revisedQuestion=false;
  const questions=new Map(),sectionCounts=[];
  const updateProgress=()=>{
    for(const [id,item] of questions){
      const answered=item.answered();
      item.card.dataset.questionAnswered=String(answered);
      item.card.dataset.questionState=answered?'answered':'unanswered';
      item.refresh?.();
    }
    for(const {node,ids} of sectionCounts){
      const answered=ids.filter(id=>questions.get(id)?.answered()).length;
      node.textContent=`${answered} / ${ids.length}`;
      node.setAttribute('aria-label',`${answered} of ${ids.length} answered`);
    }
    if(preface&&(!canSave||!recordId))panel.querySelectorAll('input,textarea,select,button').forEach(control=>{control.disabled=true;});
  };
  const notify=()=>{if(!disposed){updateProgress();onChange({value:structuredClone(value),sources});}};
  const persist=()=>{
    if(!sources||disposed)return;
    try{validateStory(value,sources);}catch(error){status.textContent=error.message;return;}
    notify();
    if(!canSave||!recordId){status.textContent='Story changes are in this tab only. Download the kit before leaving.';return;}
    status.textContent='Saving story on this device…';
    const snapshot=structuredClone(value),current=++saveNumber;
    queue=queue.then(async()=>{
      if(failed)return;
      try{const saved=await saveStory(recordId,revision,snapshot,sources);revision=saved.revision;if(!disposed&&current===saveNumber)status.textContent='Story saved on this device.';}
      catch(error){failed=true;if(!disposed)status.textContent=`Story was not saved: ${error.message} Reload before making more changes.`;}
    });
    onPending(queue);
  };
  function registerQuestion(card,id,answered,refresh){
    card.id=`story-question-${id}`;
    card.tabIndex=-1;
    card.dataset.questionId=id;
    questions.set(id,{card,answered,refresh});
  }
  function section(title,id,ids,className='atlas-editor'){
    const group=el('details',null,{class:className,id});
    group.open=true;
    const summary=el('summary'),count=el('span','',{class:'atlas-section-count'});
    summary.append(el('span',title,{class:'atlas-section-title'}),count);group.append(summary);
    sectionCounts.push({node:count,ids});
    return group;
  }
  function questionBlock(card){const block=el('div',null,{class:'atlas-question-block'});block.append(card);return block;}
  function clearControl(reset){
    const button=el('button','Clear answer',{type:'button',class:'atlas-clear'});
    button.addEventListener('click',reset);return button;
  }
  function question(q) {
    const card=el('fieldset',null,{class:'atlas-question'});
    card.append(el('legend',q.prompt));
    const selected=[...(value.background[q.id]?.selected??[])].filter(id=>id!=='prefer_not');
    const options=[...q.options,...(q.optionCatalog?sources.countries.options:[])];
    const visibleOptions=options.filter(option=>option.id!=='prefer_not');
    const catalogIds=new Set(q.optionCatalog?sources.countries.options.map(option=>option.id):[]);
    const selfDescribeIds=new Set(options.filter(option=>/Self-describe/i.test(option.label)).map(option=>option.id));
    const tools=el('div',null,{class:'atlas-question-tools'});
    if(q.type==='multi_select')tools.append(el('span','Multiselect',{class:'atlas-multiselect',title:`Choose up to ${q.maxSelections} answers`,'aria-label':`Multiselect: choose up to ${q.maxSelections} answers`}));
    else tools.append(el('span',q.id==='bg34'?'Choose a point on the scale':'Choose one',{class:'atlas-choice-hint'}));
    const feedback=el('p','',{class:'atlas-question-feedback',role:'status',id:`${q.id}-feedback`});
    const clear=clearControl(()=>reset());tools.append(clear);card.append(tools);
    const choices=el('div',null,{class:'atlas-options'});
    let selfInput=null,selfCounter=null,selfHelpOff=null,selfHelpOn=null,search=null,filter=()=>{},age=null,range=null,rangeValue=null;
    const selfSelected=()=>selected.some(id=>selfDescribeIds.has(id));
    const answered=()=>selected.length>0&&(!selfSelected()||Boolean(selfInput?.value.trim()));
    const syncChoices=()=>{
      for(const input of card.querySelectorAll('input[data-option]'))input.checked=selected.includes(input.value);
      clear.disabled=!selected.length;
      if(age)age.value=selected[0]??'';
      if(selfInput){
        selfInput.disabled=!selfSelected();
        selfInput.placeholder=selfSelected()?'What would you like us to know?':'Select Self-describe to write here.';
        selfCounter.textContent=`${selfInput.value.length} / 255`;
        selfHelpOff.setAttribute('aria-hidden',String(selfSelected()));
        selfHelpOn.setAttribute('aria-hidden',String(!selfSelected()));
      }
      if(range){
        const index=visibleOptions.findIndex(option=>option.id===selected[0]);
        range.value=String(index>=0?index:1);
        range.dataset.answered=String(index>=0);
        range.setAttribute('aria-valuetext',index>=0?visibleOptions[index].label:'Not answered yet. Choose a report style.');
        rangeValue.textContent=index>=0?visibleOptions[index].label:'Not answered yet';
        for(const tick of card.querySelectorAll('[data-range-option]'))tick.setAttribute('aria-pressed',String(tick.dataset.rangeOption===selected[0]));
      }
      filter();
    };
    function choose(optionId,checked=true){
      const option=options.find(item=>item.id===optionId);
      if(!option)return;
      let next=q.type==='single_select'?[optionId]:checked?[...new Set([...selected,optionId])]:selected.filter(id=>id!==optionId);
      if(checked&&option.exclusive)next=[optionId];
      else if(checked)next=next.filter(id=>!options.find(item=>item.id===id)?.exclusive);
      if(next.length>q.maxSelections){feedback.textContent=`Choose up to ${q.maxSelections} answers.`;syncChoices();return;}
      const selfDescription=next.some(id=>selfDescribeIds.has(id))?selfInput?.value??'':'';
      if(next.length===selected.length&&next.every((id,index)=>id===selected[index])&&selfDescription===(value.background[q.id]?.selfDescription??'')){feedback.textContent='';syncChoices();return;}
      if(next.length)value.background[q.id]={status:'answered',selected:next,...(selfDescription?{selfDescription}:{})};
      else delete value.background[q.id];
      selected.splice(0,selected.length,...next);
      if(!selfDescription&&selfInput)selfInput.value='';
      feedback.textContent='';syncChoices();persist();
    }
    function reset(){
      delete value.background[q.id];selected.splice(0);
      if(selfInput)selfInput.value='';
      feedback.textContent='';syncChoices();persist();
    }
    const choice=(option)=>{
      const input=el('input',null,{type:q.type==='single_select'?'radio':'checkbox',name:q.id,value:option.id,'data-option':'',id:`${q.id}-${option.id}`,'aria-describedby':feedback.id});
      input.checked=selected.includes(option.id);
      input.addEventListener('change',()=>choose(option.id,input.checked));
      const label=el('label',null,{for:input.id});label.append(input,el('span',option.label));return label;
    };
    if(q.id==='bg01'){
      const control=el('div',null,{class:'atlas-control-card'});
      age=el('select',null,{id:`${q.id}-range`,'aria-label':q.prompt});
      age.append(el('option','Choose an age range',{value:''}));
      for(const option of visibleOptions)age.append(el('option',option.label,{value:option.id}));
      age.addEventListener('change',()=>age.value?choose(age.value):reset());
      control.append(el('label','Age range',{for:age.id}),age);card.append(control);
    }else if(q.id==='bg34'){
      const control=el('div',null,{class:'atlas-spectrum'});
      rangeValue=el('output','',{id:`${q.id}-value`,class:'atlas-spectrum-value'});
      const readout=el('div',null,{class:'atlas-spectrum-readout'});
      readout.append(rangeValue);
      // Reserve the tallest caption at the current width, including when
      // zoomed or using a larger text size, so changing the answer stays still.
      for(const caption of ['Not answered yet',...visibleOptions.map(option=>option.label)])readout.append(el('span',caption,{class:'atlas-spectrum-value atlas-spectrum-measure','aria-hidden':'true'}));
      range=el('input',null,{type:'range',min:'0',max:String(visibleOptions.length-1),step:'1',value:'1',id:`${q.id}-spectrum`,'aria-label':q.prompt,'aria-describedby':rangeValue.id});
      rangeValue.setAttribute('for',range.id);
      const commit=()=>choose(visibleOptions[Number(range.value)].id);
      range.addEventListener('input',commit);
      range.addEventListener('change',commit);
      // A click on the untouched midpoint is still an explicit answer.
      range.addEventListener('pointerup',commit);
      const ticks=el('div',null,{class:'atlas-spectrum-ticks'});
      const labels=['Practical','Balanced','Playful'];
      visibleOptions.forEach((option,index)=>{
        const tick=el('button',labels[index],{type:'button','data-range-option':option.id,'aria-label':`${labels[index]} — ${option.label}`,'aria-pressed':'false'});
        tick.addEventListener('click',()=>choose(option.id));ticks.append(tick);
      });
      control.append(readout,range,ticks);card.append(control);
    }else if(q.optionCatalog){
      const country=el('div',null,{class:'atlas-country'});
      const results=el('div',null,{class:'atlas-country-results',id:`${q.id}-results`,role:'group','aria-label':'Matching and selected places'});
      const resultMessage=el('p','Search below to find a country or territory.',{class:'atlas-country-empty'});
      choices.classList.add('atlas-options-search');
      for(const option of visibleOptions.filter(option=>catalogIds.has(option.id)))choices.append(choice(option));
      results.append(resultMessage,choices);
      search=el('input',null,{type:'search',id:`atlas-find-${q.id}`,name:`atlas-find-${q.id}`,placeholder:'Search places',autocomplete:'off',autocapitalize:'none',spellcheck:'false','aria-controls':results.id});
      const searchLabel=el('label','Find a country or territory',{for:search.id,class:'atlas-search-label'});
      const hint=el('p','Type at least two letters. Press ↑ to reach the results. Selected places stay visible while you search.',{class:'atlas-search-hint',id:`${q.id}-search-hint`});
      const resultCount=el('p','',{class:'atlas-country-count',role:'status'});
      search.setAttribute('aria-describedby',hint.id);
      const fold=text=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
      filter=()=>{
        const term=fold(search.value.trim());let shown=0,matching=0;
        for(const label of choices.children){
          const input=label.querySelector('input'),matches=term.length>=2&&fold(label.textContent).includes(term);
          const show=selected.includes(input.value)||matches;
          label.hidden=!show;if(show)shown++;if(matches)matching++;
        }
        resultMessage.hidden=shown>0;
        resultMessage.textContent=term.length>=2?'No matching places. Try another name, or use a description below.':'Search below to find a country or territory.';
        resultCount.textContent=term.length>=2?`${matching} ${matching===1?'match':'matches'} · ${selected.filter(id=>catalogIds.has(id)).length} selected`:`${selected.filter(id=>catalogIds.has(id)).length} selected`;
      };
      search.addEventListener('input',filter);
      search.addEventListener('focus',()=>requestAnimationFrame(()=>{
        if(disposed||!search.isConnected||document.activeElement!==search)return;
        const viewport=window.visualViewport;
        const viewportTop=viewport?.offsetTop??0;
        const headerBottom=document.querySelector('.personality-header')?.getBoundingClientRect().bottom??0;
        const progressBottom=document.querySelector('.form-progress')?.getBoundingClientRect().bottom??0;
        const visibleTop=Math.max(viewportTop,headerBottom,progressBottom)+12;
        const adjustment=visibleTop-results.getBoundingClientRect().top;
        const visibleBottom=viewportTop+(viewport?.height??window.innerHeight)-16;
        // Lift the obscured result row into view only when the focused field
        // will still fit below it, including within an open mobile keyboard.
        if(adjustment>0&&search.getBoundingClientRect().bottom+adjustment<=visibleBottom){
          window.scrollBy({top:-adjustment,left:0,behavior:'instant'});
        }
      }));
      search.addEventListener('keydown',event=>{
        if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
        const first=[...choices.children].find(label=>!label.hidden)?.querySelector('input');
        if(first){event.preventDefault();first.focus();}
      });
      const alternatives=el('div',null,{class:'atlas-options atlas-place-alternatives'});
      for(const option of visibleOptions.filter(option=>!catalogIds.has(option.id)))alternatives.append(choice(option));
      country.append(results,alternatives,searchLabel,search,hint,resultCount);card.append(country);
    }else{
      for(const option of visibleOptions)choices.append(choice(option));card.append(choices);
    }
    if(selfDescribeIds.size){
      const selfField=el('div',null,{class:'atlas-self-description'});
      selfInput=el('textarea',null,{id:`${q.id}-self-description`,rows:'3',maxlength:'255',autocomplete:'off','aria-describedby':`${q.id}-description-help ${q.id}-description-count`});
      selfInput.value=value.background[q.id]?.selfDescription??'';
      const row=el('div',null,{class:'atlas-description-heading'});
      selfCounter=el('span','',{id:`${q.id}-description-count`,class:'atlas-character-count'});
      row.append(el('label','In your own words',{for:selfInput.id}),selfCounter);
      const help=el('p',null,{id:`${q.id}-description-help`,class:'atlas-description-help'});
      // Both copies reserve the same grid area; changing state never moves the
      // next question, even when one instruction wraps onto another line.
      selfHelpOff=el('span','Choose Self-describe above to add your own wording.');
      selfHelpOn=el('span','Share only the details you want included.');
      help.append(selfHelpOff,selfHelpOn);selfField.append(row,selfInput,help);
      selfInput.addEventListener('input',()=>{
        if(!selfSelected()||!value.background[q.id])return;
        value.background[q.id].selfDescription=selfInput.value;
        selfCounter.textContent=`${selfInput.value.length} / 255`;persist();
      });
      card.append(selfField);
    }
    card.append(feedback);
    registerQuestion(card,q.id,answered,syncChoices);syncChoices();
    return questionBlock(card);
  }
  function render() {
    const backgroundQuestions=sources.bank.questions.filter(item=>item.id!=='bg35'),chapters=new Map();
    for(const q of backgroundQuestions){if(!chapters.has(q.chapter))chapters.set(q.chapter,[]);chapters.get(q.chapter).push(q);}
    const background=section('Background and life context','story-background',backgroundQuestions.map(q=>q.id));
    background.append(el('p','Only answered questions enter the report kit. Identity and birthplace are your own context, never a way to infer a trait.'));
    let chapterIndex=0;
    for(const [title,items] of chapters){
      const group=section(title,`story-chapter-${++chapterIndex}`,items.map(q=>q.id),'atlas-question-group');
      for(const q of items)group.append(question(q));background.append(group);
    }
    const symbols=section(preface?'Birthday':'Birthday symbols and tarot','story-symbols-editor',['birthday']);
    symbols.append(el('p',preface?'Optional. Your full date stays on this device and is left out of the downloaded kit.':'A birthday adds symbolic motifs to your report. These are creative prompts, not personality evidence or predictions. Your full date stays out of the kit.'));
    const birthday=el('fieldset',null,{class:'atlas-question atlas-birthday'});birthday.append(el('legend','When is your birthday?'));
    const date=el('input',null,{type:'date',id:'story-birthday',min:'1901-01-01',max:new Date().toISOString().slice(0,10),'aria-label':'Birthday'});date.value=value.birthday;
    const dateError=el('p','',{class:'atlas-question-feedback',id:'story-birthday-error',role:'alert'});
    const dateClear=clearControl(()=>{value.birthday='';date.value='';dateError.textContent='';persist();});
    const dateTools=el('div',null,{class:'atlas-question-tools'});dateTools.append(el('span','Optional',{class:'atlas-choice-hint'}),dateClear);
    date.setAttribute('aria-describedby',dateError.id);
    date.addEventListener('change',()=>{
      const before=value.birthday;value.birthday=date.value;
      try{validateStory(value,sources);dateError.textContent='';persist();}
      catch(error){value.birthday=before;date.value=before;dateError.textContent=error.message;}
    });
    birthday.append(dateTools,date,dateError);symbols.append(questionBlock(birthday));
    registerQuestion(birthday,'birthday',()=>Boolean(value.birthday),()=>{dateClear.disabled=!value.birthday;});
    const newDraw=!value.draw;
    if(newDraw)value.draw=createTarotDraw(sources.deck);
    if(!preface){
      const drawButton=el('button','Draw three new cards',{type:'button',class:'button secondary'});
      const drawStatus=el('p','',{class:'atlas-status',role:'status'});
      const spread=el('div',null,{class:'atlas-mini-spread',role:'group','aria-label':'Your three-card tarot spread'});
      const showDraw=()=>{
        spread.replaceChildren();drawStatus.dataset.drawId=value.draw.id;
        drawStatus.textContent='This three-card spread is saved with your story. Drawing again replaces it.';
        for(const card of value.draw.cards){
          const item=sources.deck.cards.find(c=>c.id===card.cardId),figure=el('figure');
          figure.append(el('img',null,{src:`/assets/personality/v6/tarot/${item.asset.pngPath.split('/').at(-1)}`,alt:item.asset.alt,loading:'lazy'}),el('figcaption',`${item.name} · ${card.orientation}`));spread.append(figure);
        }
      };
      drawButton.addEventListener('click',()=>{value.draw=createTarotDraw(sources.deck);showDraw();persist();});
      showDraw();symbols.append(spread,drawButton,drawStatus);
    }
    const type=section('How you tend to think','story-type-editor',ATLAS_BANK.typeItems.map(item=>item.id));
    type.append(el('p','48 reflections on your everyday preferences, separate from the 170 scored questions. There is no best answer. Your report brings the patterns together. This is a research pilot, not the official Myers–Briggs instrument.'));
    if(revisedQuestion)type.append(el('p','One reflection has clearer wording. Please answer it again; your other answers have been kept.',{class:'atlas-update-note'}));
    for(const [axis] of Object.entries(ATLAS_BANK.axes)){
      const items=ATLAS_BANK.typeItems.filter(item=>item.scale===axis);
      const group=section(AXIS_TITLES[axis]||'Your everyday preferences',`story-preferences-${axis.toLowerCase()}`,items.map(item=>item.id),'atlas-question-group');
      group.append(el('p',AXIS_CONTEXT[axis]||'Think about what feels most natural in your everyday life.',{class:'atlas-axis-context'}));
      group.append(el('p','Rate each statement from 1 (strongly disagree) to 5 (strongly agree).',{class:'atlas-scale-hint'}));
      for(const item of items){
        const fieldset=el('fieldset',null,{class:'atlas-type-question'});fieldset.append(el('legend',item.wording));
        if(item.id==='type-candidate-ei-12-v2')fieldset.append(el('p','Think about sorting out what you believe, even if you enjoy brainstorming aloud.',{class:'atlas-item-help',id:`${item.id}-help`}));
        const tools=el('div',null,{class:'atlas-question-tools'}),clear=clearControl(()=>{delete value.type[item.id];for(const input of scale.querySelectorAll('input'))input.checked=false;persist();});
        tools.append(el('span','Choose one',{class:'atlas-choice-hint'}),clear);fieldset.append(tools);
        const scale=el('div',null,{class:'atlas-type-scale'});
        for(let score=1;score<=5;score++){
          const input=el('input',null,{type:'radio',name:item.id,value:String(score),id:`${item.id}-${score}`,'aria-label':`${score} — ${SCALE_LABELS[score-1]}`});input.checked=value.type[item.id]===score;
          if(item.id==='type-candidate-ei-12-v2')input.setAttribute('aria-describedby',`${item.id}-help`);
          input.addEventListener('change',()=>{value.type[item.id]=score;persist();});
          const label=el('label',null,{for:input.id});label.append(input,el('span',String(score)));scale.append(label);
        }
        fieldset.append(scale);
        registerQuestion(fieldset,item.id,()=>Number.isInteger(value.type[item.id]),()=>{clear.disabled=!Object.hasOwn(value.type,item.id);});
        group.append(questionBlock(fieldset));
      }
      type.append(group);
    }
    if(preface){panel.insertBefore(symbols,status);panel.insertBefore(background,status);panel.insertBefore(type,status);}
    else{panel.insertBefore(background,status);panel.insertBefore(type,status);panel.insertBefore(symbols,status);}
    updateProgress();
    if(preface&&(!canSave||!recordId)){
      panel.querySelectorAll('input,textarea,select,button').forEach(control=>{control.disabled=true;});
      status.textContent='Local saving is unavailable. Save a local copy before answering optional story questions.';
    }else{
      status.textContent=canSave&&recordId?'Your story is saved separately on this device.':'Your story stays in this tab until you download the kit.';
      if(newDraw||migrated)persist();
    }
  }
  const ready=loadStorySources().then(async loaded=>{
    sources=loaded;
    if(canSave&&recordId){const saved=await loadStory(recordId,sources);revision=saved.revision;value=saved.value;migrated=Boolean(saved.migrated);revisedQuestion=Boolean(saved.revisedQuestion);}
    if(!disposed){render();notify();}
  }).catch(error=>{if(!disposed)status.textContent=`Optional story unavailable: ${error.message}`;});
  return {ready,snapshot:()=>sources?{value:structuredClone(value),sources}:null,pending:()=>queue,dispose:()=>{disposed=true;}};
}
