import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createState,score} from '../website/assets/personality/v1/core.mjs';
import {BANK} from '../website/assets/personality/v1/bank.mjs';
import {createReport} from '../website/assets/personality/v1/report.mjs';
import {BLOCK_IDS} from '../website/assets/personality/v1/report-content.mjs';
import {buildPdf} from '../website/assets/personality/v1/pdf.mjs';
import {PDFDocument} from '../website/assets/personality/v1/vendor/pdf-lib/pdf-lib.min.mjs';
import {createContext,createEnhancement} from '../website/assets/personality/v1/enhancement.mjs';
import {encodeEnhancedSnapshot,decodeEnhancedSnapshot} from '../website/assets/personality/v1/enhancement-share.mjs';

function fixture(){const state=createState();state.responses=BANK.items.map(item=>item.module==='values'?((item.slot*7)%6)+1:((item.slot*3)%5)+1);state.cursor={module:'big5',slot:0};state.view='report';state.reportDate='2026-09-19';state.blocks=['craft-log','quiet-visibility'];return state;}
const assetLoader=url=>readFile(url);

test('report uses every computed scale and freezes a deterministic snapshot without raw answers',()=>{
 const state=fixture(),scores=score(state),model=createReport(state,scores);
 assert.equal(model.domains.length,5);assert.equal(model.domains.flatMap(d=>d.facets).length,30);assert.equal(model.interests.scores.length,6);assert.equal(model.values.scores.length,10);
 assert.deepEqual(model.domains.map(d=>d.mean),scores.domains.map(d=>d.mean));assert.deepEqual(model.values.scores.map(d=>d.centered),scores.values.scores.map(d=>d.centered));
 assert.equal('responses' in model,false);assert.equal('skipped' in model,false);assert.equal('notes' in model,false);
 assert.ok(model.domains.every(d=>d.facets.every(f=>f.definition&&f.experiment)));assert.ok(model.values.scores.every(s=>s.definition));
 assert.deepEqual(model,createReport(state,score(state)));assert.ok(Object.isFrozen(model)&&Object.isFrozen(model.domains[0]));
 state.responses[0]=5;assert.deepEqual(model.domains.map(d=>d.mean),scores.domains.map(d=>d.mean));
 assert.deepEqual(model.experiments.filter(x=>x.selected).map(x=>x.id),['craft-log','quiet-visibility']);assert.deepEqual(BLOCK_IDS,[...BLOCK_IDS].sort());
});

test('missing scales stay null; unrelated complete facets remain visible; extension gates apply',()=>{
 const state=fixture();for(const slot of [0,120,150]){state.responses[slot]=null;state.skipped[slot]=true;}
 const model=createReport(state,score(state));
 assert.equal(model.domains.find(d=>d.id==='N').mean,null);assert.equal(model.domains.find(d=>d.id==='N').facets.find(f=>f.id==='N1').mean,null);
 assert.ok(model.domains.find(d=>d.id==='E').complete);assert.ok(model.domains.find(d=>d.id==='N').facets.find(f=>f.id==='N2').complete);
 assert.ok(model.interests.scores.every(s=>s.sum===null));assert.ok(model.values.scores.every(s=>s.raw===null&&s.centered===null));assert.equal(model.completion.skipped,3);
});

test('neutral/flat input is preserved without inventing normative ranks or differentiated values',()=>{
 const state=fixture();state.responses=state.responses.map((_,i)=>i<150?3:4);const model=createReport(state,score(state));
 assert.ok(model.domains.every(d=>d.mean===3));assert.ok(model.values.scores.every(s=>s.raw===4&&s.centered===0));assert.ok(model.interests.scores.every(s=>s.sum===10));
 assert.equal(model.values.grandMean,4);assert.ok(model.domains.every(d=>d.interpretation.summary.includes('midpoint')));
});

test('unselected optional modules do not reveal retained private answers',()=>{
 const state=fixture();state.modules=['big5'];const model=createReport(state,score(state));
 assert.equal(model.instruments.length,1);assert.equal(model.interests.selected,false);assert.equal(model.values.selected,false);assert.ok(model.interests.scores.every(s=>s.sum===null));assert.ok(model.values.scores.every(s=>s.centered===null));
});

test('local PDF exports complete Letter and partial A4 reports with embedded fonts and links',async()=>{
 const state=fixture();const complete=createReport(state,score(state));const letter=await buildPdf(complete,{size:'letter',assetLoader});
 const pdf=await PDFDocument.load(letter);assert.ok(pdf.getPageCount()>=9);assert.equal(pdf.getPages()[0].getWidth(),612);assert.equal(pdf.getPages()[0].getHeight(),792);assert.equal(pdf.getTitle(),'The Big Six-Seven · Your reflection report');
 let links=0;for(const page of pdf.getPages())links+=page.node.Annots()?.size()??0;assert.ok(links>=7);
 state.responses[0]=null;state.skipped[0]=true;state.responses[120]=null;state.responses[150]=null;const partial=createReport(state,score(state));const a4=await buildPdf(partial,{size:'a4',assetLoader});const pdf2=await PDFDocument.load(a4);assert.ok(Math.abs(pdf2.getPage(0).getWidth()-595.28)<.01);
 await assert.rejects(buildPdf(complete,{size:'unknown',assetLoader}),/Letter or A4/);
 if(process.env.PERSONALITY_PDF_FIXTURES){const dir=resolve(process.env.PERSONALITY_PDF_FIXTURES);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'complete-letter.pdf'),letter);await writeFile(resolve(dir,'partial-a4.pdf'),a4);await writeFile(resolve(dir,'complete-model.json'),JSON.stringify(complete,null,2));await writeFile(resolve(dir,'partial-model.json'),JSON.stringify(partial,null,2));}
});

test('kept reflection is frozen identically for shared HTML model and PDF without running a model',async()=>{
 const state=fixture(),context={...createContext(),goal:'visibility',format:'writing',example:'Private unused example must stay out.'};
 const enhancement=createEnhancement(state,context),base=createReport(state,score(state));
 const shared=decodeEnhancedSnapshot(encodeEnhancedSnapshot(state,enhancement));
 const original=createReport(state,score(state),enhancement),replayed=createReport(shared.state,score(shared.state),shared.enhancement);
 assert.deepEqual(replayed,original);assert.deepEqual(original.domains,base.domains);
 assert.ok(Object.isFrozen(original.enhancement.sections[0]));assert.ok(!JSON.stringify(original).includes(context.example));
 const plain=await PDFDocument.load(await buildPdf(base,{assetLoader}));
 const enhanced=await PDFDocument.load(await buildPdf(replayed,{assetLoader}));
 assert.ok(enhanced.getPageCount()>plain.getPageCount());
 assert.equal(enhanced.getTitle(),plain.getTitle());
 assert.equal(enhanced.getPage(0).getWidth(),plain.getPage(0).getWidth());
});
