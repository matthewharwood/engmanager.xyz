/** Accessible charts from computed scores. No reference distribution or synthetic data. */
export function element(tag,attrs={}){const node=document.createElement(tag);for(const [key,value] of Object.entries(attrs)){if(key==='text')node.textContent=value;else if(key==='className')node.className=value;else node.setAttribute(key,String(value));}return node;}
export const formatScore=value=>Number.isFinite(value)?value.toFixed(2):'Unavailable';
export const signed=value=>Number.isFinite(value)?`${value>0?'+':''}${value.toFixed(2)}`:'Unavailable';
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
function svgNode(tag,attrs={}){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs)){if(key==='text')node.textContent=value;else node.setAttribute(key,String(value));}return node;}
function card(kicker,title,description,kind=''){const root=element('section',{className:`chart-card ${kind}`});const header=element('div',{className:'chart-card-head'});header.append(element('p',{className:'chart-eyebrow',text:kicker}),element('h3',{text:title}),element('p',{className:'chart-description',text:description}));root.append(header);return root;}
function table(caption,headers,rows){const details=element('details',{className:'chart-data'});details.append(element('summary',{text:'View the numbers'}));const node=element('table');node.append(element('caption',{text:caption}));const thead=element('thead');const tr=element('tr');headers.forEach(label=>tr.append(element('th',{scope:'col',text:label})));thead.append(tr);const tbody=element('tbody');for(const row of rows){const tr=element('tr');row.forEach((value,index)=>tr.append(element(index===0?'th':'td',index===0?{scope:'row',text:String(value)}:{text:String(value)})));tbody.append(tr);}node.append(thead,tbody);details.append(node);return details;}

export function renderPersonality(root,domains){
 let active=domains.find(domain=>domain.complete)?.id??domains[0].id;
 let mode='scores';
 const chart=card('Five personality domains','Patterns, with room for context','Means of your keyed answers on a 1–5 scale. These dots are not percentile ranks; domains cannot be ranked against each other simply by comparing their means.');
 const controls=element('div',{className:'chart-mode',role:'group','aria-label':'Personality chart view'});
 const buttons=['scores','answers'].map(id=>{const button=element('button',{type:'button',text:id==='scores'?'Domain scores':'Keyed answer pattern','aria-pressed':id===mode});button.addEventListener('click',()=>{mode=id;draw();});controls.append(button);return button;});chart.append(controls);
 const tabs=element('div',{className:'trait-selector',role:'group','aria-label':'Choose a personality domain'});
 const tabButtons=domains.map(domain=>{const button=element('button',{type:'button',className:'trait-choice','aria-pressed':domain.id===active});button.append(element('span',{className:'trait-name',text:domain.name}),element('span',{className:'trait-number',text:domain.complete?formatScore(domain.mean):'—'}),element('span',{className:'trait-unit',text:domain.complete?' / 5':`${domain.answered}/24 answered`}));button.addEventListener('click',()=>{active=domain.id;draw();});tabs.append(button);return button;});chart.append(tabs);
 const plot=element('div',{className:'chart-plot-wrap'});const readout=element('p',{className:'chart-readout','aria-live':'polite'});chart.append(plot,readout);
 function draw(){
  buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(mode===['scores','answers'][index])));tabButtons.forEach((button,index)=>button.setAttribute('aria-pressed',String(domains[index].id===active)));
  const domain=domains.find(item=>item.id===active);
  const svg=svgNode('svg',{viewBox:'0 0 760 280',role:'img','aria-label':mode==='scores'?'Personality scores on the keyed 1 to 5 response scale':`${domain.name}: counts of your keyed item responses`});svg.append(svgNode('title',{text:mode==='scores'?'Your five personality domain scores':`${domain.name} keyed answer counts, not a population distribution`}));
  if(mode==='scores'){
   const x=value=>210+(value-1)/4*480;
   for(let value=1;value<=5;value++){svg.append(svgNode('line',{x1:x(value),x2:x(value),y1:23,y2:244,class:'chart-grid-line'}),svgNode('text',{x:x(value),y:266,'text-anchor':'middle',class:'chart-axis-text',text:value}));}
   domains.forEach((item,index)=>{const y=42+index*45;svg.append(svgNode('text',{x:12,y:y+4,class:'chart-axis-text',text:item.name}));if(item.complete){const circle=svgNode('circle',{cx:x(clamp(item.mean,1,5)),cy:y,r:item.id===active?7:5,class:item.id===active?'chart-dot chart-dot-active':'chart-dot'});circle.append(svgNode('title',{text:`${item.name}: ${formatScore(item.mean)} of 5`}));svg.append(circle,svgNode('text',{x:746,y:y+4,'text-anchor':'end',class:'chart-axis-text',text:formatScore(item.mean)}));}else svg.append(svgNode('text',{x:450,y:y+4,'text-anchor':'middle',class:'chart-axis-text',text:`Incomplete (${item.answered}/24)`}));});
   readout.textContent=domain.complete?`${domain.name}: ${formatScore(domain.mean)} / 5 from 24 keyed responses. Select “Keyed answer pattern” to inspect the answers behind this mean.`:`${domain.name}: ${domain.answered}/24 answered. No score is plotted for an incomplete domain.`;
  }else{
   for(let value=0;value<=24;value+=6){const y=240-value/24*200;svg.append(svgNode('line',{x1:60,x2:724,y1:y,y2:y,class:'chart-grid-line'}),svgNode('text',{x:45,y:y+4,'text-anchor':'end',class:'chart-axis-text',text:value}));}
   if(domain.complete&&domain.counts){domain.counts.forEach((count,index)=>{const x=98+index*127;const h=count/24*200;const bar=svgNode('rect',{x,y:240-h,width:75,height:h,class:'chart-count-bar'});bar.append(svgNode('title',{text:`Keyed response ${index+1}: ${count} of 24 items`}));svg.append(bar,svgNode('text',{x:x+37.5,y:Math.max(28,231-h),'text-anchor':'middle',class:'chart-axis-text',text:count}),svgNode('text',{x:x+37.5,y:263,'text-anchor':'middle',class:'chart-axis-text',text:index+1}));});}
   else svg.append(svgNode('text',{x:390,y:140,'text-anchor':'middle',class:'chart-axis-text',text:'Complete this domain to inspect its answer pattern.'}));
   readout.textContent=`${domain.name}: these are ${domain.complete?'your 24':'the required 24'} item responses after reverse scoring, grouped from 1 to 5. This is not a bell curve, an error estimate, or a comparison with other people.${domain.complete&&domain.counts?' Counts for keyed responses 1–5: '+domain.counts.join(', ')+'.':''}`;
  }
  plot.replaceChildren(svg);
 }
 chart.append(table('Personality scores',['Domain','Mean / 5','Answered'],domains.map(domain=>[domain.name,formatScore(domain.mean),`${domain.answered}/24`])));draw();root.append(chart);
}

function rowScale(name,value,{min,max,display,kind='interest',extra=''}={}){
 const row=element('div',{className:`chart-scale-row chart-${kind}-row`});const label=element('span',{className:'chart-row-name',text:name});
 const rail=element('span',{className:`chart-rail chart-${kind}-rail`,'aria-hidden':'true'});
 if(Number.isFinite(value)){const pct=(clamp(value,min,max)-min)/(max-min)*100;const point=element('span',{className:'chart-point'});point.style.left=`${pct}%`;if(kind==='interest'){const fill=element('span',{className:'chart-fill'});fill.style.width=`${pct}%`;rail.append(fill);}rail.append(point);}
 row.append(label,rail,element('span',{className:'chart-row-score',text:Number.isFinite(value)?display:'—'}));if(extra)row.title=extra;return row;
}

export function renderInterests(root,profile){
 const chart=card('Sixth lens / work interests','Which activities appeal to you?','O*NET Mini Interest Profiler sums use 0–20. The bars describe activity preferences, not ability or a recommended occupation.','chart-interest');
 if(!profile.selected){chart.append(element('p',{className:'chart-incomplete',text:'This optional module was not selected.'}));root.append(chart);return;}
 if(!profile.complete){chart.append(element('p',{className:'chart-incomplete',text:`${profile.answered}/30 answered. Complete all 30 activities to see this profile.`}));root.append(chart);return;}
 chart.append(element('p',{className:'chart-scale-caption',text:'0 = all strongly dislike · 20 = all strongly like'}));const rows=element('div',{className:'chart-scale-rows'});profile.scores.forEach(item=>rows.append(rowScale(item.name,item.sum,{min:0,max:20,display:String(item.sum)})));chart.append(rows);
 const sums=profile.scores.map(item=>item.sum);chart.append(element('p',{className:'chart-footer',text:new Set(sums).size===1?'All six activity sets have the same sum. There is no distinct top interest in these answers.':'Ties are preserved. Explore the activities behind the scores before turning a preference into a label.'}));
 chart.append(table('Work interests',['Activity set','Sum / 20'],profile.scores.map(item=>[item.name,item.sum])));root.append(chart);
}

export function renderValues(root,profile){
 const chart=card('Seventh lens / personal values','Priorities within your own profile','TwIVI: each pair mean minus your mean across all 20 portraits. Zero is your own average, not a population average.','chart-values');
 if(!profile.selected){chart.append(element('p',{className:'chart-incomplete',text:'This optional module was not selected.'}));root.append(chart);return;}
 if(!profile.complete){chart.append(element('p',{className:'chart-incomplete',text:`${profile.answered}/20 answered. Complete all 20 portraits to establish a consistent baseline.`}));root.append(chart);return;}
 chart.append(element('p',{className:'chart-scale-caption',text:'−4.5 · less relative emphasis     0     more relative emphasis · +4.5'}));const rows=element('div',{className:'chart-scale-rows'});profile.scores.forEach(item=>rows.append(rowScale(item.name,item.centered,{min:-4.5,max:4.5,display:signed(item.centered),kind:'value',extra:`Raw portrait-similarity mean ${formatScore(item.raw)} / 6`})));chart.append(rows);
 chart.append(element('p',{className:'chart-footer',text:profile.scores.every(item=>Math.abs(item.centered)<1e-8)?'Every centered value is zero. These answers do not differentiate priorities; that does not mean you have no values.':'A negative score means less emphasis relative to your other values. These ten scores sum to zero and are not independent. Two-item scales deserve cautious interpretation.'}));
 chart.append(table('Personal values',['Value','Relative priority','Raw mean / 6'],profile.scores.map(item=>[item.name,signed(item.centered),formatScore(item.raw)])));root.append(chart);
}
export function renderCharts(root,model){root.replaceChildren();renderPersonality(root,model.domains);const pair=element('div',{className:'chart-pair'});renderInterests(pair,model.interests);renderValues(pair,model.values);root.append(pair);}
