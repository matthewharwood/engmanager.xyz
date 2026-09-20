// Self-hosted, lazy PDF generation. No participant data, fonts, or charts leave the browser.
import {formatScore,signed} from './charts.mjs';
const FONT_FILES={body:'body.ttf',bold:'bold.ttf',serif:'serif.ttf',mono:'mono.ttf'};
const ASSET_ROOT=new URL('./vendor/pdf-lib/',import.meta.url);
async function defaultAssetLoader(url){const response=await fetch(url,{credentials:'same-origin',cache:'force-cache'});if(!response.ok)throw new Error('The local PDF fonts could not be loaded. Connect once to install the export assets, then retry.');return new Uint8Array(await response.arrayBuffer());}

/** Also usable in tests with assetLoader(url) -> Uint8Array. Output is real text and vector paths. */
export async function buildPdf(model,{size='letter',assetLoader=defaultAssetLoader}={}){
 if(!['letter','a4'].includes(size))throw new Error('Choose Letter or A4.');
 if(model?.schemaVersion!==1||model.domains?.length!==5||model.title!=='The Big Six-Seven')throw new Error('This report version is not supported.');
 const [{PDFDocument,rgb,PDFString},{default:fontkit}]=await Promise.all([import('./vendor/pdf-lib/pdf-lib.min.mjs'),import('./vendor/pdf-lib/fontkit.min.mjs')]);
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const fonts=Object.fromEntries(await Promise.all(Object.entries(FONT_FILES).map(async([name,file])=>[name,await pdf.embedFont(await assetLoader(new URL(file,ASSET_ROOT)),{subset:true})])));
 const width=size==='a4'?595.28:612,height=size==='a4'?841.89:792,margin=48,cw=width-margin*2;
 const color=hex=>rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
 const C={ink:color('#27242a'),plum:color('#321d40'),muted:color('#625a68'),line:color('#c8c3ba'),paper:color('#f7f5ef'),surface:color('#fffefa'),pale:color('#eee7f1')};
 let page,y;const pages=[];let chapter='';
 function start(label){chapter=label;page=pdf.addPage([width,height]);pages.push(page);page.drawRectangle({x:0,y:0,width,height,color:C.surface});page.drawText('THE BIG SIX-SEVEN',{x:margin,y:height-29,size:8,font:fonts.bold,color:C.plum});page.drawText(label,{x:width-margin-fonts.body.widthOfTextAtSize(label,8),y:height-29,size:8,font:fonts.body,color:C.muted});page.drawLine({start:{x:margin,y:height-38},end:{x:width-margin,y:height-38},color:C.line,thickness:.6});y=height-68;}
 function ensure(space){if(y-space<55)start(chapter+' / continued');}
 function line(text,{font=fonts.body,size=10.2,color=C.ink,x=margin}={}){page.drawText(String(text),{x,y,size,font,color});}
 function wrap(text,font,size,maxWidth){
  const result=[];for(const paragraph of String(text).split('\n')){let current='';for(const word of paragraph.split(/\s+/)){if(!word)continue;const candidate=current?current+' '+word:word;if(font.widthOfTextAtSize(candidate,size)<=maxWidth){current=candidate;continue;}if(current){result.push(current);current='';}if(font.widthOfTextAtSize(word,size)>maxWidth){let piece='';for(const c of word){if(font.widthOfTextAtSize(piece+c,size)>maxWidth){result.push(piece);piece='';}piece+=c;}current=piece;}else current=word;}result.push(current);}return result;
 }
 function text(value,{font=fonts.body,size=10.2,leading=14,color=C.ink,after=9,x=margin,maxWidth=cw}={}){const lines=wrap(value,font,size,maxWidth);for(const item of lines){ensure(leading);line(item,{font,size,color,x});y-=leading;}y-=after;}
 function heading(value,level=1){const size=level===1?25:level===2?16:11.4;ensure(size+43);text(value,{font:level===3?fonts.bold:fonts.serif,size,leading:size*1.2,color:C.plum,after:level===1?13:8});}
 function note(value){text(value,{size:9,leading:12.6,color:C.muted});}
 function rule(){ensure(14);page.drawLine({start:{x:margin,y:y+2},end:{x:width-margin,y:y+2},color:C.line,thickness:.6});y-=12;}
 function dot(name,value,min,max,display,{labelWidth=174,rowHeight=30}={}){
  ensure(rowHeight);const axisLeft=margin+labelWidth,axisRight=width-margin-58,axisWidth=axisRight-axisLeft;
  line(name,{size:9.4});page.drawLine({start:{x:axisLeft,y:y+3},end:{x:axisRight,y:y+3},color:C.line,thickness:1});
  if(min<0){const zero=axisLeft+(0-min)/(max-min)*axisWidth;page.drawLine({start:{x:zero,y:y-3},end:{x:zero,y:y+9},color:C.muted,thickness:1});}
  if(Number.isFinite(value)){page.drawCircle({x:axisLeft+(Math.max(min,Math.min(max,value))-min)/(max-min)*axisWidth,y:y+3,size:3.6,color:C.plum});}
  line(display,{font:fonts.mono,size:8.4,x:width-margin-fonts.mono.widthOfTextAtSize(display,8.4),color:C.plum});y-=rowHeight;
 }
 function link(label,url){ensure(36);const chunks=wrap(label,fonts.body,9.4,cw);for(const chunk of chunks){ensure(14);const w=fonts.body.widthOfTextAtSize(chunk,9.4);line(chunk,{size:9.4,color:C.plum});page.drawLine({start:{x:margin,y:y-2},end:{x:margin+w,y:y-2},thickness:.35,color:C.plum});const annotation=pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[margin,y-3,margin+w,y+11],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}});page.node.addAnnot(pdf.context.register(annotation));y-=14;}y-=7;}
 const date=model.date??'Undated assessment';
 start('Your reflection report');heading(model.title);text(model.subtitle,{font:fonts.serif,size:16,leading:21,color:C.muted,after:17});text(date,{font:fonts.mono,size:9,color:C.plum,after:12});
 text(`${model.completion.answered} of ${model.completion.total} selected items answered. ${model.completion.skipped} skipped. This ${model.completion.answered===model.completion.total?'complete':'partial'} report shows only scales with the required answers.`);
 for(const paragraph of model.readingGuide)text(paragraph,{size:10,leading:13.8});
 rule();heading('Five personality domains',2);note('Keyed response means: 1 to 5. These are not percentiles.');
 for(const domain of model.domains)dot(domain.name,domain.mean,1,5,domain.complete?formatScore(domain.mean):'—');
 note('A missing dot means the domain is incomplete; complete facets can still appear on its chapter page. No cross-domain “winner” is inferred from differences in raw means.');

 for(const domain of model.domains){
  start(domain.name);heading(domain.name);text(domain.complete?`${formatScore(domain.mean)} / 5 · ${domain.answered}/24 answered`:`Incomplete · ${domain.answered}/24 answered`,{font:fonts.mono,size:10,color:C.plum});
  text(domain.interpretation.definition,{size:9.7,leading:13});text(domain.interpretation.summary,{size:9.7,leading:13});
  note('Context: '+domain.interpretation.context);note('Experiment: '+domain.interpretation.experiment);rule();
  for(const facet of domain.facets){
   ensure(76);dot(facet.name,facet.mean,1,5,facet.complete?formatScore(facet.mean):`${facet.answered}/4`,{rowHeight:20,labelWidth:172});
   text(facet.definition,{size:9.1,leading:12,after:3});text('Try: '+facet.experiment,{size:8.8,leading:11.6,color:C.muted,after:10});
  }
 }
 if(model.interests.selected){
  start('Work interests');heading('Which activities attract you?');text('O*NET Mini Interest Profiler',{font:fonts.mono,size:10,color:C.plum});
  text('These activity preferences are for career exploration. They do not measure ability or assign you to a career. Scores are sums from 0 to 20; the items and scoring remain separate from the editorial work examples below.');
  if(model.interests.complete){
   for(const item of model.interests.scores)dot(item.name,item.sum,0,20,`${item.sum}/20`);
   note(new Set(model.interests.scores.map(item=>item.sum)).size===1?'All six scales tie. There is no differentiated top interest in these answers.':'Ties are preserved. Consider the activities behind a score before adopting a label.');
   for(const item of model.interests.scores){ensure(60);heading(item.name,3);text(item.definition+' '+item.experiment,{size:9.5,leading:12.8,after:10});}
  }else text(`${model.interests.answered}/30 items answered. Complete all 30 to see the interest profile. No partial scale values are reported.`);
  link('Continue career exploration with the O*NET Interest Profiler','https://onetinterestprofiler.org/p/enter_scores');note('This link opens an external site. No scores are sent automatically; you choose whether to enter them.');
 }else{start('Work interests');heading('Work interests');text('This optional module was not selected. No activity preferences have been inferred from your personality answers.');}
 if(model.values.selected){
  start('Personal values');heading('What matters in a choice?');text('Twenty-Item Values Inventory (TwIVI)',{font:fonts.mono,size:10,color:C.plum});
  text('Each value uses two portrait-similarity responses. The relative score subtracts your mean across all 20 responses. Zero means your own average; positive and negative scores indicate relative emphasis, not moral worth or a population rank.');
  if(model.values.complete){
   note(`Your overall portrait-similarity mean: ${formatScore(model.values.grandMean)} / 6. Dots span the mathematical centered range −4.5 to +4.5.`);
   for(const item of model.values.scores)dot(item.name,item.centered,-4.5,4.5,signed(item.centered),{rowHeight:25});
   note(model.values.scores.every(item=>Math.abs(item.centered)<1e-8)?'All ten centered scores are zero: these answers do not differentiate priorities. This does not mean “no values.”':'The ten centered scores sum to zero. They are mathematically dependent, and two-item scales need cautious interpretation.');
   start('Values in practice');heading('Priorities meet a real choice');note('Original editorial reflection questions. Read each priority in context; the questionnaire does not tell you which decision to make.');
   for(const item of model.values.scores){ensure(62);text(`${item.name} · raw mean ${formatScore(item.raw)} / 6`,{font:fonts.bold,size:9.5,leading:12.6,after:3});text(item.definition+' '+item.experiment,{size:9.2,leading:12.4,after:10});}
  }else text(`${model.values.answered}/20 portraits answered. Complete all 20 to establish a consistent baseline; no values profile is inferred from the other modules.`);
 }else{start('Personal values');heading('Personal values');text('This optional module was not selected. No personal values have been inferred from personality or interests.');}

 start('A two-week experiment');heading('Craft and visibility');text('Useful work deserves to be understood. Merit and visibility are not identical: opportunity, relationships, incentives, and bias also affect recognition. Quieter and more expressive people both have ways to make useful work legible.');
 for(const block of model.experiments){ensure(135);heading(block.title+(block.selected?' · selected':''),2);text(block.body);note('Notice: '+block.measure);}
 note('Choose one action, one situation, and a date to reflect. Look for an example and a counterexample. The point is learning from experience, not improving a personality score.');
 if(model.enhancement){
  start('Your personal reflection');heading('A next step for your situation');
  text(model.enhancement.kind==='local-ai'?'Local AI reflection, kept by the reader. These suggestions are exploratory and do not change the scientific scores.':'Reviewed experiments selected using explicit editorial rules and your context. These suggestions do not change the scientific scores.');
  for(const section of model.enhancement.sections){ensure(90);heading(section.title,2);text(section.body);for(const id of section.evidence)note(model.enhancement.evidence.find(f=>f.id===id).label);}
  note(`Saved wording: ${model.enhancement.version}; ${model.enhancement.model}. This export preserves the actual reflection text.`);
 }
 start('Methods and sources');heading('How this report was made');text(`Template ${model.templateVersion}; scoring ${model.scoringVersion}. Report date: ${date}.`);
 text('IPIP responses use five accuracy anchors. Reverse-keyed items score 6 minus the response. A facet requires all four answers; a domain requires all 24. Means are unweighted keyed sums divided by item count. No norms, percentiles, clinical cutoffs, or confidence intervals are applied.');
 note('Editorial prompts use keyed means below 2.5, from 2.5 to 3.5, and above 3.5 to describe response-scale direction. These are writing rules, not validated psychological cutoffs.');
 text('Mini-IP uses five activity answers recoded 0–4, summed across five activities per interest scale. All 30 answers are required. TwIVI uses six similarity anchors without reverse scoring; each pair produces a raw mean and subtracts the overall 20-item mean. All 20 answers are required. Skipped answers are never treated as neutral.');
 note('The official IPIP website uses “right and wrong” in item 58; the development paper uses “right or wrong.” This release preserves and versions the official-key wording.');
 for(const instrument of model.instruments){text(`${instrument.name} · ${instrument.version}`,{font:fonts.bold,size:9.5,leading:13,after:3});note(instrument.attribution);}
 for(const source of model.sources){ensure(60);link(source.label,source.url);note(source.note);}
 note(model.enhancement?'This PDF includes the reflection you kept and its supporting excerpts. Check those sections for personal details before sharing. Raw answer arrays and local record identifiers are excluded. The accessible HTML report remains available; this PDF is not certified as tagged PDF/UA.':'This PDF excludes raw answers, private notes, names, and local record identifiers. The accessible HTML report remains available. This text-based PDF is not certified as tagged PDF/UA.');
 pages.forEach((p,index)=>{p.drawLine({start:{x:margin,y:38},end:{x:width-margin,y:38},color:C.line,thickness:.5});p.drawText(`engmanager.xyz · ${model.templateVersion} · self-report, not a diagnosis`,{x:margin,y:24,font:fonts.body,size:7.3,color:C.muted});const count=`${index+1} / ${pages.length}`;p.drawText(count,{x:width-margin-fonts.mono.widthOfTextAtSize(count,8),y:24,font:fonts.mono,size:8,color:C.muted});});
 const metadataDate=new Date(model.date?`${model.date}T00:00:00Z`:'2000-01-01T00:00:00Z');pdf.setCreationDate(metadataDate);pdf.setModificationDate(metadataDate);pdf.setTitle('The Big Six-Seven · Your reflection report');pdf.setAuthor('engmanager.xyz');pdf.setSubject('Big Five personality, work interests, and personal values');pdf.setLanguage('en');
 return pdf.save();
}

export async function downloadPdf(model,options={}){const bytes=await buildPdf(model,options);const blob=new Blob([bytes],{type:'application/pdf'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`the-big-six-seven-${model.date??'report'}-${options.size??'letter'}.pdf`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return bytes;}
