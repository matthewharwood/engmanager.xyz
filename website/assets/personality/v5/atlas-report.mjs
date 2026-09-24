import {colorProfile,typeProfile} from './atlas-model.mjs';
import {FIGURES} from './atlas-figures.mjs';
import {birthdaySymbols} from './story-core.mjs';

const el=(tag,text='',attrs={})=>{
  const node=document.createElement(tag);
  if(text!==null)node.textContent=text;
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
  return node;
};
const p=(text,cls='')=>el('p',text,cls?{class:cls}:{});
const link=(text,href)=>el('a',text,{href,target:'_blank',rel:'noopener noreferrer'});
function help(title,body){const node=el('details',null,{class:'atlas-help'});node.append(el('summary',title),p(body));return node;}
function section(id,kicker,title,description){const node=el('section',null,{id,class:'atlas-chapter','aria-labelledby':`${id}-title`});node.append(p(kicker,'report-kicker'),el('h2',title,{id:`${id}-title`}),p(description));return node;}

function colorChapter(report){
  const colors=colorProfile(report),node=section('color-story','03 / Color lens','Four ways your answers can show up.','An original view of eight Big Five facets. Each colored circle stays visible, and their overlap changes with your answers. This is not a branded color assessment.');
  const figure=el('figure',null,{class:'atlas-color-figure'}),mark=el('div',null,{class:'atlas-color-mark',role:'img','aria-label':colors.every(c=>c.complete)?`Four overlapping color circles: ${colors.map(c=>`${c.id} ${c.position} on a 0 to 100 display scale`).join(', ')}`:'Four overlapping color circles; some scores are unavailable'});
  for(const color of colors){const circle=el('span',null,{class:`atlas-circle atlas-circle-${color.id}`});circle.style.opacity=String(color.complete?.25+.65*(color.position/100):.16);mark.append(circle);}
  figure.append(mark,el('figcaption','Circle opacity follows the displayed score. Overlap is a visual blend, not a percentage of the person.'));
  const list=el('dl',null,{class:'atlas-color-legend'});
  for(const color of colors){const row=el('div',null,{class:'atlas-color-row'});row.append(el('dt',`${color.id} · ${color.label}`),el('dd',color.complete?`${color.mean.toFixed(2)} / 5 · display ${color.position}/100`:'Not scored'));list.append(row);}
  node.append(figure,list,help('How is this color view made?','Red uses Assertiveness and Achievement-Striving; yellow uses Friendliness and Gregariousness; green uses Altruism and Sympathy; blue uses Orderliness and Cautiousness. Each circle uses the mean of its two complete facets, mapped linearly from 1–5 to a 0–100 display position. Scores are not shares, percentiles, or official color types.'));
  return node;
}

function figureCard(person,featured=false){
  const figure=el('figure',null,{class:`atlas-person${featured?' atlas-person-featured':''}`});
  const img=el('img',null,{src:`/assets/personality/v5/${person.image}`,alt:`Portrait of ${person.name}`,loading:featured?'eager':'lazy',width:'420',height:'420'});
  img.addEventListener('error',()=>{img.remove();figure.prepend(el('div',person.name.slice(0,1),{class:'atlas-person-fallback','aria-hidden':'true'}));});
  const caption=el('figcaption');caption.append(el('span',person.code,{class:'atlas-person-code'}),el('strong',person.name),p(person.description??''),p(person.parallel));
  const sources=el('small',null,{class:'atlas-image-credit'});
  sources.append(link('Biography',person.article),document.createTextNode(` · Image: ${person.artist||'uncredited'} · `),
    link(person.license,person.licenseUrl??person.source),document.createTextNode(' · '),link('Source',person.source));
  caption.append(sources);figure.append(img,caption);return figure;
}
function typeChapter(story){
  const type=typeProfile(story?.value.type),node=section('type-story','04 / Preference lens','A type to explore, when you choose.','The optional 48-question pilot describes four preference pairs. It is experimental and is not the official Myers–Briggs instrument. A middle result remains open rather than forcing a letter.');
  const summary=el('div',null,{class:'atlas-type-summary'});
  summary.append(el('strong',type.code&&!type.code.includes('?')?type.code:'Open preferences'),p(type.complete?type.note??'All four preference pairs have complete answers. The letters are an editorial shorthand, not a measured identity.':`${Object.keys(story?.value.type??{}).length} of 48 draft questions answered. Add or change answers in the story studio.`));
  const axes=el('dl',null,{class:'atlas-axis-list'});
  for(const axis of type.axes){const row=el('div');row.append(el('dt',`${axis.negativePole} / ${axis.positivePole}`),el('dd',axis.mean===null?`${axis.answered}/${axis.required} answered`:`${axis.mean.toFixed(2)} / 5${axis.letter?` · ${axis.letter}`:' · near the middle'}`));axes.append(row);}
  summary.append(axes);node.append(summary);
  if(type.code&&!type.code.includes('?')){
    const person=FIGURES[type.code];
    const feature=el('div',null,{class:'atlas-featured-parallel'});
    feature.append(p('A public-life parallel · an illustration, not a verified type match','report-kicker'),figureCard(person,true),p(`The ${type.code} shorthand offers a way to discuss preferences. ${person.name}'s public work is a story example; their private personality type is unverified. This parallel does not establish similarity to you.`,'report-small'));
    node.append(feature);
  }
  const gallery=el('details',null,{class:'atlas-gallery'});gallery.append(el('summary','Browse the 16 public-life parallels'),p('These 16 people were selected to illustrate different kinds of public work. The type labels are editorial slots; none is presented as a verified personality result. Biographies and image licenses are linked on each card.'));
  const grid=el('div',null,{class:'atlas-gallery-grid'});for(const person of Object.values(FIGURES))grid.append(figureCard(person));gallery.append(grid);node.append(gallery,
    help('Can a famous person prove my type?','No. A public biography cannot establish someone’s questionnaire responses or private preferences. Use these parallels as conversation starters, never as evidence, predictions, or claims that a public figure shares your result.'));
  return node;
}

function symbolsChapter(story){
  const node=section('story-symbols','05 / Story motifs','A coda you can keep or leave.','Birthday signs and tarot can give the report a visual rhythm. They remain separate from measured answers, and you choose whether to include them in a kit.');
  if(!story?.value){node.append(p('Open the story studio to add a birthday symbol or draw three cards.','atlas-empty'));return node;}
  const {value,sources}=story,choice=value.background.bg35?.selected??[];
  const symbols=el('div',null,{class:'atlas-symbol-grid'});
  if(value.birthday&&(choice.includes('o01')||choice.includes('o02'))){
    const result=birthdaySymbols(value.birthday);
    if(choice.includes('o01'))symbols.append(symbolCard('Western sun sign',result.western.sign??result.western.candidates.join(' / '),result.western.status==='boundary_sensitive_unresolved'?'Boundary date; sign unresolved without birth time and place.':'Approximate tropical date convention.'));
    if(choice.includes('o02'))symbols.append(symbolCard('Chinese zodiac year',result.chinese.animal??'Unavailable',result.chinese.convention));
  }
  if(symbols.children.length)node.append(symbols);
  if(choice.includes('o03')&&value.draw){
    const spread=el('div',null,{class:'atlas-tarot-spread'});
    for(const card of value.draw.cards){const definition=sources.deck.cards.find(item=>item.id===card.cardId),position=sources.deck.spread.find(item=>item.id===card.positionId);
      const figure=el('figure');figure.append(el('img',null,{src:`/assets/personality/v5/tarot/${definition.asset.pngPath.split('/').at(-1)}`,alt:definition.asset.alt,width:'320',height:'500'}));
      const caption=el('figcaption');caption.append(el('small',position.label),el('strong',definition.name),p(definition.prompt));figure.append(caption);spread.append(figure);
    }
    node.append(spread,p('The cards were drawn randomly without replacement and saved with this assessment. The artwork is a labeled placeholder set. Meanings are reflection prompts, not forecasts.','report-small'));
  }
  if(!symbols.children.length&&!value.draw)node.append(p('Choose a symbol or draw cards in the story studio when you want this chapter.','atlas-empty'));
  node.append(help('Does a symbol change a score?','No. Birthday signs and card draws have zero weight in every trait, interest, value, color, and preference score. The full birthday is never included in the standard report kit.'));
  return node;
}
function symbolCard(label,value,note){const card=el('div',null,{class:'atlas-symbol-card'});card.append(el('small',label),el('strong',value),p(note));return card;}

export function renderAtlas(report,story=null){
  const overview=section('atlas-overview','01 / At a glance','One person, several lenses.','Start with the measured scores, then open the views that help you tell a fuller story. Each lens keeps its own meaning and scale.');
  const hero=el('div',null,{class:'atlas-hero-art'});hero.append(el('img',null,{src:'/assets/personality/v5/media/atlas-collage.png',alt:'Abstract overlapping colors and three illustrated cards',width:'1536',height:'1024'}));overview.append(hero);
  const cards=el('div',null,{class:'atlas-overview-grid'});
  for(const [title,text,href] of [
    ['Measured patterns','Big Five traits, work interests, and personal values','#your-scores'],
    ['Color combination','Four overlapping editorial facet summaries','#color-story'],
    ['Type exploration','Four draft preference pairs and public-life parallels','#type-story'],
    ['Story motifs','Optional birthday symbols and a three-card reflection','#story-symbols']]){
      const card=el('a',null,{href,class:'atlas-overview-card'});card.append(el('strong',title),p(text),el('span','Explore →'));cards.append(card);
    }
  overview.append(cards);return {overview,color:colorChapter(report),type:typeChapter(story),symbols:symbolsChapter(story)};
}
