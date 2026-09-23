import {MOVEMENTS,COLOR_RULE,STUDIO_VERSION} from './studio-model.mjs';
export const assetPath=path=>'/assets/personality/v5/'+path;
export function node(tag,text,attrs={},children=[]){
 const el=document.createElement(tag);if(text!==null&&text!==undefined)el.textContent=String(text);
 for(const [key,value] of Object.entries(attrs)){if(value===false||value===null||value===undefined)continue;if(key==='class')el.className=value;else el.setAttribute(key,value===true?'':String(value));}
 el.append(...children);return el;
}
export const para=(text,cls='')=>node('p',text,{class:cls});
export function action(label,fn,cls='studio-button'){const b=node('button',label,{type:'button',class:cls});b.addEventListener('click',fn);return b;}
export function image(path,alt,cls=''){
 const img=node('img',null,{src:assetPath(path),alt,class:cls,loading:'lazy',decoding:'async'});
 img.addEventListener('error',()=>{img.hidden=true;img.after(para(alt+' · image unavailable','image-fallback'));},{once:true});return img;
}
const fmt=n=>n===null||n===undefined?'Not scored':Number(n).toFixed(2);
function badge(text,kind='measured'){return node('span',text,{class:'evidence-badge '+kind});}
function section(id,sub){const m=MOVEMENTS.find(x=>x.id===id);const s=node('section',null,{id:'studio-'+id,class:'studio-chapter','aria-labelledby':'title-'+id});s.append(node('header',null,{class:'chapter-head'},[para(m.number+' / '+m.motif,'studio-eyebrow'),node('h2',m.name,{id:'title-'+id}),para(sub,'chapter-deck')]));return s;}
function scaleRow(label,value,min,max,unit,click){
 const el=node(click?'button':'div',null,{class:'scale-row',...(click?{type:'button','aria-label':label+' '+fmt(value)+' '+unit+'. Open details'}:{})});
 const track=node('span',null,{class:'scale-track','aria-hidden':'true'}),fill=node('span',null,{class:'scale-fill'});
 fill.style.width=value===null?'0%':Math.max(0,Math.min(100,100*(value-min)/(max-min)))+'%';track.append(fill);
 el.append(node('span',label,{class:'scale-label'}),track,node('span',value===null?'—':fmt(value),{class:'scale-value'}));if(click)el.addEventListener('click',click);return el;
}
function scoreTable(title,headers,rows){const wrap=node('section',null,{class:'score-table-block'}),table=node('table');table.append(node('caption',title));const head=node('tr');headers.forEach(h=>head.append(node('th',h,{scope:'col'})));table.append(node('thead',null,{},[head]));const body=node('tbody');for(const row of rows){const tr=node('tr');row.forEach((v,i)=>tr.append(node(i?'td':'th',v,i?{}:{scope:'row'})));body.append(tr);}table.append(body);wrap.append(table);return wrap;}
function credits(root,studio){
 const details=node('details',null,{class:'studio-methods'});details.append(node('summary','Sources, methods & image credits'));
 details.append(para('Measured self-report is distinct from the experimental type/color lenses, editorial biographical parallels, and optional creative symbols. No overall personality or hiring-fit score is produced.','evidence-note'));
 details.append(para('Template '+STUDIO_VERSION+' · scoring '+studio.model.scoringVersion+'. Type letters use a provisional unresolved band, not confidence intervals. '+COLOR_RULE));
 studio.model.instruments.forEach(i=>details.append(para(i.name+' · '+i.version+'. '+i.attribution),node('a','Instrument source',{href:i.source,target:'_blank',rel:'noopener noreferrer'})));
 if(studio.figure){const f=studio.figure;details.append(para('Portrait of '+f.name+'. '+f.image.author+'. '+f.image.license+'. '+f.image.modifications),node('a','Image source',{href:f.image.source,target:'_blank',rel:'noopener noreferrer'}),document.createTextNode(' · '),node('a','Image license',{href:f.image.licenseUrl,target:'_blank',rel:'noopener noreferrer'}),document.createTextNode(' · '),node('a','Biography source',{href:f.source,target:'_blank',rel:'noopener noreferrer'}));}
 details.append(para('Cover: original ImageGen artwork (22 September 2026), decorative only. Color diagrams and tarot placeholders: original code-native SVGs. Background artwork and portraits are not evidence. Tarot is not a forecast; calendar symbols are not a natal chart.','evidence-note'));
 root.append(details);
}
export function renderStudioArticle(root,studio,{onCustomize,onPilot,onBrowse,onDetail,interactive=true}={}){
 const m=studio.model,article=node('article',null,{class:'studio-report','data-template':STUDIO_VERSION});
 const hero=node('header',null,{class:'studio-cover'});
 hero.append(image('media/portrait-atmosphere.png','','cover-art'),node('div',null,{class:'cover-copy'},[para('THE BIG SIX–SEVEN / YOUR FIELD GUIDE','studio-eyebrow'),node('h1',studio.name?`A portrait of ${studio.name}`:'A portrait of you'),para('Many perspectives. One person.','cover-deck'),para(studio.edition==='personal'?'Personal edition':'Working together edition','edition-label')]));
 hero.append(para('Self-report and reflection · '+(studio.date||'Undated')+' · '+STUDIO_VERSION,'cover-meta'));article.append(hero);
 if(m.completion.answered===0)article.append(node('aside',null,{class:'studio-empty',role:'note'},[node('h2','Your portrait starts with your answers.'),para('There are no scored answers here yet. You can explore the layout, then return to the questionnaire. Missing results remain unscored.'),node('a','Open questionnaire →',{href:'/personality/test','data-route':'test'})]));
 const first=section('portrait','The bird’s-eye view, with room for nuance.');
 const intro=node('div',null,{class:'portrait-grid'}),copy=node('div',null,{class:'portrait-copy'});
 if(studio.observations.length){copy.append(node('h3',studio.observations[0].title),para(studio.observations[0].body,'portrait-lead'));if(studio.observations[1])copy.append(para(studio.observations[1].body));}else copy.append(node('h3','Still taking shape.'),para('Complete a scale to see its interpretation here. A partial report can be useful without filling the gaps with guesses.'));
 copy.append(para('A starting point for a conversation. Adjust the framing in your own words; your answers and scores remain yours.','quiet'));
 if(studio.note)copy.append(node('blockquote',studio.note,{class:'reader-note'}),para('Your words · self-description','studio-eyebrow'));
 const emblem=node('div',null,{class:'color-emblem'});if(studio.colors)emblem.append(image(studio.colors.image,studio.colors.label+' color perspectives'),node('strong',studio.colors.label),badge('Custom color view','experimental'));else emblem.append(image('media/colors/combination-0.svg','Color view omitted'),para('A portrait beyond labels.'));
 intro.append(copy,emblem);first.append(intro);
 const overview=node('div',null,{class:'overview-metrics'});
 for(const d of m.domains)overview.append(node('div',null,{},[para(d.name,'metric-label'),node('strong',d.complete?fmt(d.mean):'—'),para('of 5 · '+(d.complete?'self-report':'not scored'),'metric-unit')]));first.append(overview);article.append(first);
 const patterns=section('patterns','How your tendencies, interests and priorities meet.');
 const tabs=node('div',null,{class:'lens-nav no-print',role:'group','aria-label':'Explore a lens'}),grid=node('div',null,{class:'lens-grid'});
 const panels=[];
 function panel(id,title,sub,kind='measured'){const p=node('section',null,{class:'lens-panel','data-lens':id});p.append(node('div',null,{class:'panel-title'},[node('h3',title),badge(kind==='measured'?'Self-report':'Experimental',kind)]),para(sub,'panel-note'));panels.push(p);grid.append(p);return p;}
 const traits=panel('traits','Personality','Big Five · raw means on a 1–5 response scale.');
 for(const d of m.domains)traits.append(scaleRow(d.name,d.mean,1,5,'of 5',interactive?()=>onDetail?.(d):null));
 traits.append(para('Select a domain to explore its six facets. A scale position is not a population percentile.','panel-note no-print'));
 const interests=panel('interests','What draws you in','Work interests · activity appeal, not skill. Totals 0–20.');
 if(!m.interests.selected)interests.append(para('This profile was not selected.'));else if(!m.interests.complete)interests.append(para('Complete the 30 interest items to see this profile.'));else m.interests.scores.forEach(s=>interests.append(scaleRow(s.name,s.sum,0,20,'of 20')));
 const values=panel('values','What matters in a choice','Personal values · centered against your own average.');
 if(!m.values.selected)values.append(para('This profile was not selected.'));else if(!m.values.complete)values.append(para('Complete the 20 values portraits to see this profile.'));else m.values.scores.forEach(s=>values.append(node('div',null,{class:'value-row'},[node('span',s.name),node('strong',(s.centered>0?'+':'')+fmt(s.centered))])));
 if(studio.type){const p=panel('type','Preferences, in four pairs','Myers-Briggs-style lens · '+studio.type.source+'.','experimental');p.append(node('strong',studio.type.code||studio.type.heuristicCode,{class:'type-code'}));for(const a of studio.type.axes)p.append(scaleRow(a.negativePole+' ↔ '+a.positivePole,a.mean,1,5,'keyed mean'));p.append(para(studio.type.letterRule,'panel-note'));if(interactive)p.append(action('Review optional preferences',onPilot));}
 else{const p=panel('type','Another language for preference','Optional Myers-Briggs-style pilot.','experimental');p.append(para('Explore four preference pairs with 48 original research questions, or record a type you already use. Neither is an official MBTI result.'));if(interactive)p.append(action('Explore preferences',onPilot));}
 if(studio.colors){const p=panel('colors','Your color perspectives','An original view of eight existing facets.','experimental');p.append(image(studio.colors.image,studio.colors.label,'color-mini'));studio.colors.scores.forEach(c=>p.append(scaleRow(c.id+' · '+c.label,c.mean,1,5,'of 5')));p.append(para(COLOR_RULE,'panel-note'));}
 for(const [id,label]of [['all','All lenses'],['traits','Personality'],['interests','Interests'],['values','Values'],['type','Preferences'],...(studio.colors?[['colors','Colors']]:[])]){const b=action(label,()=>{panels.forEach(p=>p.hidden=id!=='all'&&p.dataset.lens!==id);tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));},'lens-chip');b.setAttribute('aria-pressed',String(id==='all'));tabs.append(b);}patterns.append(tabs,grid);
 const linked=node('div',null,{class:'pattern-note'});
 if(studio.interests.length)linked.append(para('Activities with the highest endorsed appeal: '+studio.interests.map(x=>x.name).join(', ')+'.'));
 if(studio.values.length)linked.append(para('Values with the highest relative priority in this profile: '+studio.values.map(x=>x.name).join(', ')+'.'));
 linked.append(para('These are different lenses on the same person. They do not combine into a score of how good, capable or employable someone is.'));patterns.append(linked);article.append(patterns);
 const parallels=section('parallels','A familiar life can make an idea easier to see.');
 if(studio.figure){const f=studio.figure,frame=node('div',null,{class:'figure-feature'});frame.append(node('figure',null,{},[image(f.image.path,f.image.alt,'figure-portrait'),node('figcaption',f.image.author+' · '+f.image.license)]),node('div',null,{class:'figure-copy'},[badge('Editorial parallel','editorial'),para(studio.type.code+' / '+f.title,'studio-eyebrow'),node('h3',f.name),para(f.biography),para(f.parallel,'parallel-bridge'),para('Type unverified. '+f.limit,'figure-limit'),node('a','Read the biography ↗',{href:f.source,target:'_blank',rel:'noopener noreferrer'})]));parallels.append(frame);}else parallels.append(node('div',null,{class:'empty-parallel'},[node('h3','Inspiration without a look-alike score.'),para('Sixteen public-life examples are available to explore. A parallel appears in your report only when you choose to include it and a type code is available. The associations are editorial, not verified celebrity typings.')]));
 if(interactive)parallels.append(action('Browse all 16 parallels',onBrowse,'studio-button secondary no-print'));if(!studio.figure)parallels.classList.add('optional-unselected');article.append(parallels);
 const together=section('together','Useful conditions. Possible friction. Your voice.');
 const pairs=node('div',null,{class:'agreement-grid'});
 for(const o of studio.observations)pairs.append(node('section',null,{class:'agreement'},[node('h3',o.title),para('HELPFUL TO DISCUSS','studio-eyebrow'),para(o.help),para('WHAT COULD BE MISREAD','studio-eyebrow'),para(o.friction)]));
 if(!studio.observations.length)pairs.append(para('Working agreements will become more specific when there are enough answers to ground them.'));
 together.append(pairs,para('These are discussion prompts based on self-report, not observations of workplace performance.','panel-note'));
 const voice=studio.note||'Add a short note about how you want someone to understand you. Your own wording will be kept separate from the score-derived observations.';together.append(node('div',null,{class:'voice-panel'},[para('IN MY OWN WORDS','studio-eyebrow'),para(voice,'voice-text'),para(studio.note?'Participant-written self-description. Included in exports only when approved.':'An editable personal passage, never a change to your test results.','panel-note')]));if(interactive)together.append(action('Shape the framing',onCustomize,'studio-button secondary no-print'));article.append(together);
 const keepsakes=section('keepsakes','A small imaginative coda. Yours to keep or leave.');
 keepsakes.append(badge('Creative reflection','creative'));
 if(studio.zodiac){const z=studio.zodiac;keepsakes.append(node('div',null,{class:'zodiac-pair'},[node('section',null,{},[para('WESTERN DATE SYMBOL','studio-eyebrow'),node('h3',z.western.sign||z.western.candidates.join(' / ')),para(z.western.sign?'Approximate date convention':'Boundary-sensitive · unresolved','panel-note')]),node('section',null,{},[para('CHINESE YEAR SYMBOL','studio-eyebrow'),node('h3',z.chinese.animal||'Unavailable'),para('Lunar New Year convention','panel-note')])]));}
 if(studio.tarot){const spread=node('div',null,{class:'tarot-spread'});for(const card of studio.tarot.cards){const f=node('figure',null,{},[image(`media/tarot/${card.id}.svg`,card.asset.alt,'tarot-image'),node('figcaption',null,{},[para(card.position,'studio-eyebrow'),node('h3',card.name),para(card.orientation==='reversed'?'Reversed · '+card.reversePrompt:card.prompt)])]);spread.append(f);}keepsakes.append(spread,para('Saved draw '+studio.tarot.id+' · '+studio.tarot.createdAt.slice(0,10)+'. Named placeholder artwork.','panel-note'));}
 if(!studio.zodiac&&!studio.tarot){keepsakes.append(para(studio.edition==='workplace'?'Keepsakes are omitted from the working together edition.':'Optionally add birthday symbols or save a three-card tarot reflection. They do not contribute to your personality scores.'));keepsakes.classList.add('optional-unselected');}
 keepsakes.append(para('Symbols offer metaphors and questions, never predictions or evidence about your personality.','panel-note'));if(interactive)keepsakes.append(action('Choose your keepsakes',onCustomize,'studio-button secondary no-print'));article.append(keepsakes);
 const appendix=node('section',null,{class:'studio-appendix',id:'studio-appendix'});appendix.append(node('h2','Scores & supporting detail'),para('Exact values and sources travel with every edition. Missing scores are never replaced with zero.','chapter-deck'));
 const disclosure=node('details',null,{class:'score-disclosure'});disclosure.append(node('summary','View every score and its scale'));
 for(const d of m.domains)disclosure.append(scoreTable(d.name+' · 1–5 raw means',['Scale','Mean','Answered'],[[d.name,fmt(d.mean),`${d.answered}/${d.required}`],...d.facets.map(f=>[f.name,fmt(f.mean),`${f.answered}/${f.required}`])]));
 if(m.interests.selected)disclosure.append(scoreTable('Work interests · 0–20 totals',['Interest','Total'],m.interests.scores.map(s=>[s.name,fmt(s.sum)])));
 if(m.values.selected)disclosure.append(scoreTable('Personal values · raw 1–6 and centered priorities',['Value','Raw','Centered'],m.values.scores.map(s=>[s.name,fmt(s.raw),fmt(s.centered)])));
 if(studio.type?.axes.length)disclosure.append(scoreTable('Experimental preferences · 1–5 keyed means',['Axis','Mean','Coverage'],studio.type.axes.map(a=>[a.id,fmt(a.mean),`${a.answered}/${a.required}`])));
 if(studio.colors)disclosure.append(scoreTable('Custom colors · 1–5 raw means',['Color','Mean'],studio.colors.scores.map(c=>[c.id,fmt(c.mean)])));
 appendix.append(disclosure);
 if(studio.background.length){const context=node('details',null,{class:'background-summary'});context.append(node('summary','Context you chose to share'),para('Participant-provided context. These answers are not scored.'));
 for(const item of studio.background)context.append(node('section',null,{class:'context-entry'},[node('h3',item.question),para(item.answers.join('; ')+(item.selfDescription?' · '+item.selfDescription:''))]));appendix.append(context);}
 credits(appendix,studio);article.append(appendix,node('footer','A field guide, not a fixed identity. · engmanager.xyz',{class:'studio-footer'}));root.replaceChildren(article);return article;
}
