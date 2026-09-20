import {BANK} from './bank.mjs';
import {SCORE_VERSION,validateState} from './core.mjs';
import {REPORT_VERSION,READING_GUIDE,SOURCES,FACET_CONTENT,INTEREST_CONTENT,VALUE_CONTENT,EXPERIMENTS,domainInterpretation} from './report-content.mjs';
import {renderCharts,element,formatScore} from './charts.mjs';
import {validateEnhancement} from './enhancement.mjs';

function frozen(value){if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}return value;}
const numberOrNull=value=>value===null?null:Number.isFinite(value)?value:(()=>{throw new Error('Invalid report score');})();
function scaleModel(scale){
 const complete=scale.complete===true;
 return {id:scale.id,name:scale.name,answered:scale.answered,required:scale.required,complete,
  sum:complete?numberOrNull(scale.sum):null,mean:complete?numberOrNull(scale.mean):null,
  counts:complete&&Array.isArray(scale.counts)?[...scale.counts]:null};
}

/** Canonical report excludes raw responses, notes, names, and local record IDs. */
export function createReport(input,scores,enhancement=null){
 const state=validateState(input);
 if(!scores||scores.domains?.length!==5||scores.facets?.length!==30)throw new Error('Score the assessment before generating its report.');
 const domains=scores.domains.map(domain=>{
  const result=scaleModel(domain);
  result.interpretation=domainInterpretation(domain.id,result.mean);
  result.facets=domain.facets.map(facet=>({...scaleModel(facet),definition:FACET_CONTENT[facet.id]?.[0]??'',experiment:FACET_CONTENT[facet.id]?.[1]??''}));
  return result;
 });
 const interests={selected:scores.interests.selected,answered:scores.interests.answered,required:30,complete:scores.interests.complete,
  scores:scores.interests.scores.map(scale=>({id:scale.id,name:scale.name,sum:scores.interests.complete?numberOrNull(scale.sum):null,
   definition:INTEREST_CONTENT[scale.id]?.[0]??'',experiment:INTEREST_CONTENT[scale.id]?.[1]??''}))};
 const values={selected:scores.values.selected,answered:scores.values.answered,required:20,complete:scores.values.complete,grandMean:scores.values.complete?numberOrNull(scores.values.grandMean):null,
  scores:scores.values.scores.map(scale=>({id:scale.id,name:scale.name,raw:scores.values.complete?numberOrNull(scale.raw):null,centered:scores.values.complete?numberOrNull(scale.centered):null,
   definition:VALUE_CONTENT[scale.id]?.[0]??'',experiment:VALUE_CONTENT[scale.id]?.[1]??''}))};
 const selectedExperiments=state.blocks.filter(id=>EXPERIMENTS.some(block=>block.id===id));
 return frozen({schemaVersion:1,templateVersion:REPORT_VERSION,scoringVersion:SCORE_VERSION,title:'The Big Six-Seven',
  subtitle:'Big Five personality + work interests + personal values',date:state.reportDate,
  instruments:BANK.modules.filter(module=>state.modules.includes(module.id)).map(module=>({id:module.id,name:module.instrument,version:BANK.instrumentVersions[BANK.modules.indexOf(module)],attribution:module.attribution,source:module.source})),
  completion:{...scores.completion},modules:[...state.modules],domains,interests,values,
  experiments:EXPERIMENTS.map(block=>({...block,selected:selectedExperiments.includes(block.id)})),
  readingGuide:[...READING_GUIDE],sources:SOURCES.map(source=>({...source})),...(enhancement?{enhancement:validateEnhancement(enhancement,state)}:{})});
}

function paragraph(text,className=''){return element('p',{className,text});}
function labelled(label,text){const p=paragraph(text);p.prepend(element('strong',{text:label+' '}));return p;}

export function renderEnhancement(root,enhancement){
 const panel=element('section',{className:'report-enhancement'});
 panel.append(element('p',{className:'report-kicker',text:enhancement.kind==='local-ai'?'Local AI reflection · check against your experience':'Personal experiments · editorial selection'}),element('h2',{text:'A next step that fits your situation'}),paragraph('These suggestions are for reflection. They do not change your scores or establish a prediction about you.'));
 for(const section of enhancement.sections){const card=element('section',{className:'report-experiment'});card.append(element('h3',{text:section.title}),paragraph(section.body));const evidence=element('details');evidence.append(element('summary',{text:'Why this appears'}));for(const id of section.evidence)evidence.append(paragraph(enhancement.evidence.find(f=>f.id===id).label,'report-small'));card.append(evidence);panel.append(card);}
 panel.append(paragraph(`Saved wording · ${enhancement.version} · ${enhancement.model}. Shared copies preserve this text without rerunning a model.`,'report-small'));root.append(panel);return panel;
}

export function renderReport(root,model){
 const article=element('article',{className:'personality-report'});
 const header=element('header',{className:'report-introduction'});
 header.append(element('p',{className:'report-kicker',text:'Your report / '+(model.date??'Undated assessment')}),element('h2',{text:'A clearer picture. An open question.'}),paragraph(`${model.completion.answered} of ${model.completion.total} selected items answered. ${model.completion.skipped} skipped. Completed scales remain available in a partial report.`,'report-summary'));
 model.readingGuide.forEach(text=>header.append(paragraph(text)));
 article.append(header);
 const charts=element('div',{className:'report-charts'});renderCharts(charts,model);article.append(charts);
 const chapters=element('section',{className:'report-chapters'});chapters.append(element('h2',{text:'Your personality, in more detail'}),paragraph('The five domains each contain six narrower facets. Means use keyed answers on the 1–5 response scale. They are not population ranks.'));
 for(const domain of model.domains){
  const detail=element('details',{className:'report-domain'});detail.open=true;
  const summary=element('summary');summary.append(element('span',{text:domain.name}),element('span',{className:'report-number',text:domain.complete?formatScore(domain.mean)+' / 5':`${domain.answered}/24 · incomplete`}));detail.append(summary);
  const body=element('div',{className:'report-domain-body'});body.append(paragraph(domain.interpretation.definition),paragraph(domain.interpretation.summary),labelled('Consider context.',domain.interpretation.context),labelled('Try an experiment.',domain.interpretation.experiment));
  const facets=element('div',{className:'report-facet-grid'});
  for(const facet of domain.facets){
   const card=element('section',{className:'report-facet'});
   card.append(element('h4',{text:facet.name}),element('p',{className:'report-number',text:facet.complete?`${formatScore(facet.mean)} / 5`:`${facet.answered}/4 answered · incomplete`}),paragraph(facet.definition),paragraph(facet.experiment,'report-prompt'));
   facets.append(card);
  }
  body.append(facets);detail.append(body);chapters.append(detail);
 }
 article.append(chapters);
 const extension=element('section',{className:'report-extensions'});
 if(model.interests.selected){
  extension.append(element('h2',{text:'Work interests: activities to explore'}),paragraph('Interests describe appeal, not skill. The activity examples below are original editorial experiments outside the O*NET instrument; they are not a career assignment.'));
  if(model.interests.complete){const list=element('div',{className:'report-reflection-grid'});for(const scale of model.interests.scores){const card=element('section');card.append(element('h3',{text:`${scale.name} · ${scale.sum}/20`}),paragraph(scale.definition),paragraph(scale.experiment));list.append(card);}extension.append(list);}
  else extension.append(paragraph(`Answer the remaining ${30-model.interests.answered} interest items to receive the complete profile.`,'report-incomplete'));
  const link=element('a',{href:'https://onetinterestprofiler.org/p/enter_scores',text:'Continue career exploration with the O*NET Interest Profiler',target:'_blank',rel:'noopener noreferrer'});extension.append(link,paragraph('This opens an external site. No results are automatically sent; you choose whether to enter them there.','report-small'));
 }
 if(model.values.selected){
  extension.append(element('h2',{text:'Personal values: what matters in a choice'}),paragraph('A centered score compares a value with your own average across all 20 portraits. It is not an evaluation against other people. Positive and negative scores indicate relative priority; neither is a moral grade.'));
  if(model.values.complete){const list=element('div',{className:'report-reflection-grid'});for(const scale of model.values.scores){const card=element('section');card.append(element('h3',{text:scale.name}),paragraph(scale.definition),paragraph(scale.experiment));list.append(card);}extension.append(list);}
  else extension.append(paragraph(`Answer all 20 values portraits to receive the profile. ${model.values.answered}/20 are answered.`,'report-incomplete'));
 }
 article.append(extension);
 const experiments=element('section',{className:'report-experiments'});experiments.append(element('p',{className:'report-kicker',text:'Craft, visibility, and a two-week experiment'}),element('h2',{text:'Useful work deserves to be understood.'}),paragraph('Merit and visibility are not the same thing. Recognition also depends on opportunity, relationships, incentives, and bias. Both quieter and more expressive people can make their work legible without treating a personality profile as a performance target.'));
 for(const block of model.experiments){const card=element('section',{className:'report-experiment'});card.append(element('h3',{text:block.title+(block.selected?' · selected':'')}),paragraph(block.body),labelled('Notice.',block.measure));experiments.append(card);}
 article.append(experiments);
 if(model.enhancement)renderEnhancement(article,model.enhancement);
 const methods=element('details',{className:'report-methods'});methods.append(element('summary',{text:'Methods, coverage, and sources'}),paragraph(`Report template ${model.templateVersion}; scoring ${model.scoringVersion}. Scores are computed locally from selected answers. Missing personality scales are withheld; interests require 30/30 answers and personal values require 20/20. No missing answer is replaced with a midpoint.`),paragraph('Core scores are equal-weighted keyed sums and means. Interest scores use five activity ratings recoded 0–4 per scale (0–20 total). TwIVI pairs use 1–6 raw means, then subtract the overall 20-item mean. The ten centered values sum to zero. Source IPIP item 58 retains the official-key “right and wrong” wording; the published paper uses “right or wrong.”'));
 for(const instrument of model.instruments)methods.append(paragraph(`${instrument.name} · ${instrument.version}. ${instrument.attribution}`,'report-small'));
 methods.append(paragraph('Editorial prompts use keyed means below 2.5, from 2.5 to 3.5, and above 3.5 to describe response-scale direction. These writing rules are not validated psychological cutoffs.','report-small'));
 const sources=element('ol');for(const source of model.sources){const item=element('li');item.append(element('a',{href:source.url,text:source.label,target:'_blank',rel:'noopener noreferrer'}),paragraph(source.note,'report-small'));sources.append(item);}methods.append(sources);article.append(methods);
 root.replaceChildren(article);return article;
}
