// A shared reading position and completion view for the optional preparation
// form and each scored questionnaire page. No answers are stored here.
export function mountFormNavigation(root, {optional=false, remaining=()=>0, jumpRemaining=()=>{}}={}) {
  const make=(tag,attributes={})=>{const node=document.createElement(tag);for(const[key,value]of Object.entries(attributes))node.setAttribute(key,value);return node;};
  const bar=make('section',{class:'form-progress','data-page-progress':'','aria-label':optional?'Before you begin progress':'Questionnaire page progress'});
  const copy=make('div'),count=make('strong',{'data-page-count':'',role:'status','aria-live':'polite'}),hint=make('span');
  hint.textContent=optional?'Optional · share only what feels useful':'This page · your answers save as you go';
  const progress=make('progress',{max:'1',value:'0','aria-label':optional?'Preparation questions answered':'Questions answered on this page'});
  copy.append(count,hint);bar.append(copy,progress);
  const heading=root.querySelector('.page-header,.quiz-header');
  if(heading)heading.after(bar);else root.prepend(bar);
  const dock=make('nav',{class:'form-navigation','aria-label':'Move around the questionnaire'});
  const top=make('button',{type:'button','data-form-top':'','aria-label':'Back to top',title:'Back to top'});
  const next=make('button',{type:'button','data-form-next':'','aria-label':'Jump to next unanswered question',title:'Next unanswered question'});
  for(const[button,symbol]of[[top,'↑'],[next,'↓']]){const icon=make('span',{'aria-hidden':'true'});icon.textContent=symbol;button.append(icon);}
  const nextLabel=make('span',{class:'form-navigation-label','aria-hidden':'true'});nextLabel.textContent='Continue answering';next.append(nextLabel);
  top.hidden=true;next.hidden=true;dock.append(top,next);root.append(dock);
  const lifetime=new AbortController();
  let frame=0,disposed=false,target=null,lastCount='';
  const questions=()=>[...root.querySelectorAll('[data-question-id]')];
  const behavior=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';
  function update(){
    frame=0;if(disposed)return;
    const cards=questions(),answered=cards.filter(card=>card.dataset.questionAnswered==='true').length;
    const text=cards.length?`${answered} / ${cards.length} answered`:'Loading your questions…';
    if(text!==lastCount){count.textContent=text;lastCount=text;progress.max=cards.length||1;progress.value=answered;}
    // Resume beyond the furthest completed question, then circle back to gaps.
    const last=cards.findLastIndex(card=>card.dataset.questionAnswered==='true');
    target=cards.slice(last+1).find(card=>card.dataset.questionAnswered!=='true')||cards.find(card=>card.dataset.questionAnswered!=='true');
    const rect=target?.getBoundingClientRect();
    const visibleTop=Math.max(0,bar.getBoundingClientRect().bottom,document.querySelector('.personality-header')?.getBoundingClientRect().bottom||0)+12;
    const shown=rect&&rect.top>=visibleTop&&rect.top<innerHeight*.7;
    next.hidden=(!target&&!remaining())||Boolean(shown);
    top.hidden=scrollY<Math.max(400,innerHeight*.7);
    const actions=root.querySelector('.quiz-actions')?.getBoundingClientRect();
    dock.style.setProperty('--form-toolbar-offset',`${actions&&actions.top<innerHeight&&actions.bottom>0?Math.max(0,innerHeight-actions.top+12):0}px`);
  }
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(update);};
  const observer=new MutationObserver(records=>{if(records.some(record=>!bar.contains(record.target)&&!dock.contains(record.target)))schedule();});
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['data-question-answered']});
  addEventListener('scroll',schedule,{passive:true,signal:lifetime.signal});
  addEventListener('resize',schedule,{passive:true,signal:lifetime.signal});
  top.addEventListener('click',()=>{root.focus({preventScroll:true});scrollTo({top:0,behavior:behavior()});},{signal:lifetime.signal});
  next.addEventListener('click',()=>{
    update();
    if(!target){jumpRemaining();return;}
    for(let parent=target.parentElement;parent&&root.contains(parent);parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
    // Focus the question itself: country result lists precede their search
    // field, and focusing an arbitrary first option could select it by mistake.
    target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:behavior()});
  },{signal:lifetime.signal});
  update();
  return()=>{disposed=true;lifetime.abort();observer.disconnect();cancelAnimationFrame(frame);bar.remove();dock.remove();};
}
