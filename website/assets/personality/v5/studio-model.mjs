import {PILOT} from './pilot.mjs';
import {FIGURES} from './figures.mjs';
import {DECK} from './deck.mjs';
import {BACKGROUND,COUNTRIES} from './background.mjs';
import {birthdaySymbols,validateTarotDraw,validateBackground} from './story-core.mjs';
export const STUDIO_VERSION='portrait-studio-v1';
export const COLOR_RULE='Illustrative emphasis includes every color within 0.25 raw-mean points of the highest color. This editorial rule is not a validated category. All four continuous scores remain visible.';
export const COLORS=[
 {id:'red',label:'Direction & drive',facets:['E3','C4']},
 {id:'yellow',label:'Social engagement',facets:['E1','E2']},
 {id:'green',label:'Care & consideration',facets:['A3','A6']},
 {id:'blue',label:'Order & deliberation',facets:['C2','C6']},
];
export const MOVEMENTS=[
 {id:'portrait',number:'01',name:'Portrait',motif:'A',tone:'Warm and candid',words:'120–180',visual:'color-combination + five-domain profile',purpose:'Lead with two or three supported relationships between tendencies. State one useful quality and its possible cost.'},
 {id:'patterns',number:'02',name:'Patterns',motif:'A′',tone:'Precise and grounded',words:'220–320',visual:'personality, interests, values; optional preference axes',purpose:'Develop the opening through facets, interests and relative values. Keep disagreement and unavailable data visible.'},
 {id:'parallels',number:'03',name:'Parallels',motif:'B',tone:'Curious and memorable',words:'80–120',visual:'one sourced framed public-figure portrait',purpose:'When approved, connect one documented public-work theme to a supported tendency. Call this an editorial analogy, never a verified type match.'},
 {id:'together',number:'04',name:'Working together',motif:'A″',tone:'Practical and balanced',words:'160–220 plus an 80–120-word editable first-person passage',visual:'helpful conditions / possible friction',purpose:'Return to the opening theme with concrete discussion points. Participant revisions stay labeled self-description, distinct from measured evidence.'},
 {id:'keepsakes',number:'05',name:'Keepsakes',motif:'C',tone:'Imaginative and optional',words:'80–140',visual:'the exact approved tarot draw and birthday symbols',purpose:'Use approved symbols as metaphors or reflection questions. Never as evidence, predictions, diagnosis, or employment guidance.'},
];
export const DEFAULT_SETTINGS=Object.freeze({name:'',note:'',edition:'personal',includeName:false,includeNote:false,includeColors:true,includeType:false,includeFigure:false,includeZodiac:false,includeTarot:false,typeSource:'pilot',selfType:'',pilotAnswers:{},birthday:'',draw:null,backgroundAnswers:{},approvedBackground:[]});
const cleanText=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value);
export function validateSettings(value){
 if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!==Object.keys(DEFAULT_SETTINGS).sort().join(','))throw new Error('Invalid report settings.');
 if(!cleanText(value.name,80)||!cleanText(value.note,512)||!['personal','workplace'].includes(value.edition)||!['pilot','self'].includes(value.typeSource))throw new Error('Check the report name, note and edition.');
 for(const k of ['includeName','includeNote','includeColors','includeType','includeFigure','includeZodiac','includeTarot'])if(typeof value[k]!=='boolean')throw new Error('Invalid export selection.');
 if(value.selfType!==''&&!FIGURES.figures.some(f=>f.code===value.selfType))throw new Error('Unknown type code.');
 if(!value.pilotAnswers||typeof value.pilotAnswers!=='object'||Array.isArray(value.pilotAnswers))throw new Error('Invalid pilot answers.');
 const ids=new Set(PILOT.items.map(q=>q.id));
 for(const [id,v] of Object.entries(value.pilotAnswers))if(!ids.has(id)||!(v===null||Number.isInteger(v)&&v>=1&&v<=5))throw new Error('Invalid pilot response.');
 if(!value.backgroundAnswers||typeof value.backgroundAnswers!=='object'||Array.isArray(value.backgroundAnswers))throw new Error('Invalid background answers.');
 const cleanBackground=validateBackground(BACKGROUND,COUNTRIES,value.backgroundAnswers);
 for(const input of Object.values(value.backgroundAnswers)){
  if(!input||Object.keys(input).some(k=>!['status','selected','selfDescription'].includes(k))||!cleanText(input.selfDescription??'',120))throw new Error('Invalid background response.');
 }
 if(!Array.isArray(value.approvedBackground)||new Set(value.approvedBackground).size!==value.approvedBackground.length||value.approvedBackground.some(id=>!cleanBackground[id]))throw new Error('Approve only answered background questions.');
 if(typeof value.birthday!=='string')throw new Error('Invalid birthday.');
 if(value.birthday)birthdaySymbols(value.birthday);
 if(value.draw!==null){
  validateTarotDraw(DECK,value.draw);
  const exact=(o,keys)=>Object.keys(o).sort().join(',')===keys.sort().join(',');
  if(!exact(value.draw,['id','createdAt','deckVersion','method','cards'])||!cleanText(value.draw.id,80)||!cleanText(value.draw.createdAt,40)||value.draw.cards.some(c=>!exact(c,['cardId','orientation','positionId'])))throw new Error('Invalid tarot record.');
 }
 return structuredClone(value);
}
export function colorView(model){
 const facets=new Map(model.domains.flatMap(d=>d.facets).map(f=>[f.id,f]));
 const scores=COLORS.map(c=>({...c,mean:c.facets.every(id=>facets.get(id)?.complete)?c.facets.reduce((n,id)=>n+facets.get(id).mean,0)/2:null}));
 const complete=scores.every(c=>c.mean!==null),max=complete?Math.max(...scores.map(c=>c.mean)):null;
 const mask=complete?scores.reduce((n,c,i)=>n|(max-c.mean<=.25+Number.EPSILON?(1<<i):0),0):0;
 return {status:'experimental-custom-view',scores,mask,complete,rule:COLOR_RULE,image:`media/colors/combination-${mask.toString(16)}.svg`,label:mask?scores.filter((_,i)=>mask&(1<<i)).map(c=>c.id).join(' + '):'Not scored'};
}
export function typeView(settings){
 const axes=Object.entries(PILOT.axes).map(([id,axis])=>{
  const answers=axis.items.map(q=>({q,value:settings.pilotAnswers[q.itemId]}));
  const answered=answers.filter(x=>Number.isInteger(x.value)).length;
  const mean=answered===answers.length?answers.reduce((n,{q,value})=>n+(q.key===1?value:6-value)*q.weight,0)/answers.reduce((n,{q})=>n+q.weight,0):null;
  const letter=mean===null||mean>=2.75&&mean<=3.25?null:mean>3.25?axis.positivePole:axis.negativePole;
  return {id,mean,letter,answered,required:answers.length,positivePole:axis.positivePole,negativePole:axis.negativePole};
 });
 const heuristicCode=axes.map(a=>a.letter||'?').join('');
 const code=settings.typeSource==='self'?(settings.selfType||null):heuristicCode.includes('?')?null:heuristicCode;
 return {axes:settings.typeSource==='self'?[]:axes,code,heuristicCode:settings.typeSource==='self'?null:heuristicCode,source:settings.typeSource==='self'?'self-selected, not verified':'48-item unvalidated pilot',status:'experimental',letterRule:'Keyed means below 2.75 or above 3.25 choose a pole. The inclusive 2.75–3.25 band is unresolved. This is an editorial heuristic, not confidence or probability.',pilotVersion:PILOT.version};
}
const top=(rows,key)=>{const valid=rows.filter(r=>Number.isFinite(r[key]));if(!valid.length)return[];const max=Math.max(...valid.map(r=>r[key]));return valid.filter(r=>Math.abs(r[key]-max)<1e-9);};
export function portraitObservations(model){
 const out=[];const find=id=>model.domains.find(d=>d.id===id);const add=(id,title,body,help,friction,evidence)=>out.push({id,title,body,help,friction,evidence});
 const o=find('O'),c=find('C'),e=find('E'),a=find('A'),n=find('N');
 if(o?.complete&&c?.complete){
  if(o.mean>3.5&&c.mean>3.5)add('explore-deliver','Room to explore. A way to finish.','Interest in unfamiliar ideas sits alongside a preference for follow-through. A useful conversation is where exploration ends and a decision needs to hold.','Agree on a discovery period and a clear decision point.','Unbounded exploration or a plan fixed too early may both create friction.',['domain.O','domain.C']);
  else if(o.mean>3.5)add('open','Make room for alternatives.','Responses lean toward curiosity and new approaches. Discuss how to keep useful possibilities visible without asking every idea to become a commitment.','Distinguish exploring an option from promising to deliver it.','Others may mistake an interesting possibility for an agreed plan.',['domain.O']);
  else add('approach',o.mean<2.5?'Start with what is concrete.':'Let the situation set the approach.',o.interpretation.summary,'Discuss how much novelty and structure this particular task needs.','A broad average may hide different preferences across the narrower facets.',['domain.O']);
 }
 if(e?.complete)add('contact',e.mean>3.5?'Think with other people.':e.mean<2.5?'Leave space before the conversation.':'A flexible social rhythm.',e.interpretation.summary,e.mean<2.5?'Share the question before the meeting.':e.mean>3.5?'Provide opportunities to talk through an idea.':'Discuss when live conversation or written preparation is most useful.',e.mean<2.5?'Quietness can be mistaken for lack of engagement.':e.mean>3.5?'Thinking aloud can be mistaken for a settled position.':'Different situations may call for different levels of interaction.',['domain.E']);
 if(a?.complete)add('agreement',a.mean>3.5?'Keep care and candor together.':a.mean<2.5?'Make disagreement useful.':'Negotiate the balance.',a.interpretation.summary,'Agree on how to raise a concern and how a decision will be made.',a.mean>3.5?'A wish to preserve cooperation can leave disagreement unclear.':'A direct challenge can be heard more personally than intended.',['domain.A']);
 if(!out.length&&n?.complete)add('pressure','Discuss the conditions around pressure.',n.interpretation.summary,'Ask what clarity, preparation and support help in a difficult week.','A self-report is not an observation of performance under pressure.',['domain.N']);
 return out.slice(0,3);
}
export function buildStudioModel(model,rawSettings,{forExport=false}={}){
 const settings=validateSettings(rawSettings),colors=colorView(model),type=typeView(settings);
 const figure=settings.includeType&&settings.includeFigure&&type.code?FIGURES.figures.find(f=>f.code===type.code):null;
 const approved=validateBackground(BACKGROUND,COUNTRIES,settings.backgroundAnswers);
 const background=settings.approvedBackground.map(id=>{const q=BACKGROUND.questions.find(q=>q.id===id);return {id,question:q.prompt,answers:approved[id].labels,selfDescription:approved[id].selfDescription,evidenceStatus:'participant-provided context; not scored',allowedUse:q.narrativeUse};});
 const personal=settings.edition==='personal';
 const zodiac=personal&&settings.includeZodiac&&settings.birthday?birthdaySymbols(settings.birthday):null;
 const tarot=personal&&settings.includeTarot&&settings.draw?{...structuredClone(settings.draw),cards:settings.draw.cards.map((c,i)=>({...c,...DECK.cards.find(d=>d.id===c.cardId),position:DECK.spread[i].label}))}:null;
 return {version:STUDIO_VERSION,date:model.date,edition:settings.edition,name:(!forExport||settings.includeName)?settings.name:'',note:(!forExport||settings.includeNote)?settings.note:'',background,notesStatus:'participant self-description; not independent evidence',model,observations:portraitObservations(model),interests:top(model.interests.scores,'sum'),values:top(model.values.scores,'centered'),colors:settings.includeColors?colors:null,type:settings.includeType?type:null,figure,zodiac,tarot,score: MOVEMENTS,privacy:{fullBirthdayIncluded:false},selected:{colors:settings.includeColors,type:settings.includeType,figure:Boolean(figure),zodiac:Boolean(zodiac),tarot:Boolean(tarot)}};
}
