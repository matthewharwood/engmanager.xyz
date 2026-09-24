import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeSnapshot} from '../website/assets/personality/v1/share.mjs';
import {createReport} from '../website/assets/personality/v1/report.mjs';
import {score} from '../website/assets/personality/v1/core.mjs';
import {ATLAS_BANK} from '../website/assets/personality/v6/atlas-bank.mjs';
import {FIGURES} from '../website/assets/personality/v6/atlas-figures.mjs';
import {colorProfile,typeProfile} from '../website/assets/personality/v6/atlas-model.mjs';
import {emptyStory,validateStory,loadStory,saveStory} from '../website/assets/personality/v6/story-store.mjs';
import {openStore} from '../website/assets/personality/v1/store.mjs';
import {createState} from '../website/assets/personality/v1/core.mjs';
import {birthdaySymbols,createTarotDraw} from '../website/assets/personality/v6/story-core.mjs';
import {LUNAR_NEW_YEARS} from '../website/assets/personality/v6/lunar-new-years.mjs';
import {createReportKit,PORTRAIT_BRIEF} from '../website/assets/personality/v6/report-kit.mjs';
import {RELEASE as current} from '../website/assets/personality/v6/release.mjs';
import {RELEASE as previous} from '../website/assets/personality/v5/release.mjs';
import {presentationForURL} from '../website/assets/personality/v6/bootstrap.mjs';

const read=async name=>JSON.parse(await readFile(new URL(`../website/assets/personality/v6/data/${name}.json`,import.meta.url),'utf8'));
const sources={bank:await read('background-questionnaire'),countries:await read('countries'),deck:await read('tarot-deck')};
const fixture=JSON.parse(await readFile(new URL('./personality-v1-compatibility-fixture.json',import.meta.url),'utf8'));
const state=decodeSnapshot(fixture.snapshot),model=createReport(state,score(state));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('color circles cover four independent facet pairs and withhold incomplete components',()=>{
  const colors=colorProfile(model);
  assert.deepEqual(colors.map(c=>c.id),['red','yellow','green','blue']);
  assert(colors.every(c=>c.complete&&c.position>=0&&c.position<=100));
  const incomplete=structuredClone(model);incomplete.domains.find(d=>d.id==='E').facets.find(f=>f.id==='E3').complete=false;
  assert.equal(colorProfile(incomplete)[0].mean,null);
  assert.equal(colorProfile(incomplete)[1].complete,true);
});

test('research kit inventories map to the live optional questions, deck, and sourced portrait slots',()=>{
  assert.equal(sources.bank.questions.length,36);
  assert.equal(sources.bank.questions.filter(item=>item.id!=='bg35').length,35);
  assert.equal(ATLAS_BANK.typeItems.length,48);
  assert.deepEqual(Object.values(ATLAS_BANK.axes).map(axis=>axis.items.length),[12,12,12,12]);
  assert.equal(sources.deck.cards.length,78);
  assert.equal(Object.keys(FIGURES).length,16);
  for(const [code,person] of Object.entries(FIGURES)){
    assert(person.name&&person.description&&person.parallel&&person.image);
    assert(person.article.startsWith('https://en.wikipedia.org/wiki/'));
    assert(person.source.startsWith('https://commons.wikimedia.org/wiki/'));
    assert(person.license);
    const answers={};
    Object.values(ATLAS_BANK.axes).forEach((axis,index)=>{
      const positive=code[index]===axis.positivePole;
      for(const item of axis.items)answers[item.itemId]=(item.key===1)===positive?5:1;
    });
    assert.equal(typeProfile(answers).code,code);
  }
});

test('draft type does not force a code from missing or middle answers',()=>{
  assert.equal(typeProfile().code,null);
  const positive=Object.fromEntries(ATLAS_BANK.typeItems.map(item=>[item.id,item.key===1?5:1]));
  assert.equal(typeProfile(positive).code,'ENFJ');
  positive[ATLAS_BANK.typeItems[0].id]=undefined;
  assert.equal(typeProfile(positive).code,null);
  const middle=Object.fromEntries(ATLAS_BANK.typeItems.map(item=>[item.id,3]));
  assert.equal(typeProfile(middle).code,'????');
});

test('pinned Chinese calendar keeps historical and recent New Year boundaries stable',()=>{
  assert.equal(Object.keys(LUNAR_NEW_YEARS).length,201);
  for(const [year,boundary,before,after] of [
    [1901,'1901-02-19','Rat','Ox'],[1990,'1990-01-27','Snake','Horse'],
    [2024,'2024-02-10','Rabbit','Dragon'],[2025,'2025-01-29','Dragon','Snake'],
    [2026,'2026-02-17','Snake','Horse']]){
    assert.equal(LUNAR_NEW_YEARS[year],boundary);
    const dayBefore=new Date(Date.parse(boundary)-86400000).toISOString().slice(0,10);
    assert.equal(birthdaySymbols(dayBefore,'2100-12-31').chinese.animal,before);
    assert.equal(birthdaySymbols(boundary,'2100-12-31').chinese.animal,after);
  }
});

test('answered story details and derived symbols enter the kit without per-field toggles',()=>{
  const value=emptyStory();
  value.background.bg04={status:'answered',selected:['o01']};
  value.birthday='1990-09-10';
  value.draw=createTarotDraw(sources.deck);
  const positive=Object.fromEntries(ATLAS_BANK.typeItems.map(item=>[item.id,item.key===1?5:1]));
  value.type=positive;
  assert.doesNotThrow(()=>validateStory(value,sources));
  const kit=createReportKit(state,{name:'Alex',story:{value,sources}});
  assert.equal(kit.data.story.context.length,1);
  assert.equal(kit.data.story.context[0].id,'bg04');
  assert.equal(kit.data.story.privacy.fullBirthdayIncluded,false);
  assert(!kit.text.includes('1990-09-10'));
  assert.equal(kit.data.story.symbols.western.sign,'Virgo');
  assert.equal(kit.data.story.symbols.tarot.cards.length,3);
  assert(kit.data.story.symbols.tarot.cards.every(card=>card.image.url.startsWith('https://engmanager.xyz/assets/personality/v6/tarot/')));
  assert.equal(kit.data.atlas.type.code,'ENFJ');
  assert.equal(kit.data.atlas.reference.name,'Louis Armstrong');
  assert.match(PORTRAIT_BRIEF,/Five-movement score/);
  assert.match(PORTRAIT_BRIEF,/public-life parallel.*metaphor/);
  assert.match(PORTRAIT_BRIEF,/BG02 answer specifies pronouns/);
  assert.match(PORTRAIT_BRIEF,/Follow story\.symbolInterpretation/);
  value.background.bg04={status:'answered',selected:['o10'],selfDescription:'My own chosen wording'};
  assert.equal(createReportKit(state,{story:{value,sources}}).data.story.context[0].selfDescription,'My own chosen wording');
  delete value.background.bg04;
  assert(!createReportKit(state,{story:{value,sources}}).text.includes('My own chosen wording'));
});

test('new release retains v5 and uses a hardcoded current presentation',async()=>{
  assert.equal(current.v,6);
  assert.equal(current.presentation,'unified-atlas-v6');
  assert.equal(current.previousReleases[0].releaseDigest,hash(JSON.stringify(previous)));
  assert.equal(presentationForURL('https://engmanager.xyz/personality/report'),'v6');
  assert.equal(presentationForURL('https://engmanager.xyz/personality/report#s=malformed'),'v1');
  for(const [path,digest] of Object.entries(current.assets)){
    const bytes=await readFile(new URL(`../website${path}`,import.meta.url));
    assert.equal(hash(bytes),digest,`Stale release asset: ${path}`);
  }
});

test('private story records use revisions, stay outside snapshots, and are deleted with a draft',async()=>{
  const databaseName=`atlas-test-${crypto.randomUUID()}`;
  const store=await openStore({name:databaseName});
  try{
    const draft=await store.create(createState());
    const value=emptyStory();value.birthday='1990-09-10';value.background.bg04={status:'answered',selected:['o01']};
    const saved=await saveStory(draft.id,0,value,sources,{databaseName});
    assert.equal(saved.revision,1);
    assert.equal((await loadStory(draft.id,sources,{databaseName})).value.birthday,'1990-09-10');
    await assert.rejects(saveStory(draft.id,0,value,sources,{databaseName}),/another tab/);
    assert(!JSON.stringify((await store.load(draft.id)).state).includes('1990-09-10'));
    await store.remove(draft.id);
    await assert.rejects(loadStory(draft.id,sources,{databaseName}),/no longer exists/);
  }finally{
    store.close();
    await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(databaseName);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});
  }
});
