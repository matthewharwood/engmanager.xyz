import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeSnapshot} from '../website/assets/personality/v1/share.mjs';
import {createReport} from '../website/assets/personality/v1/report.mjs';
import {score} from '../website/assets/personality/v1/core.mjs';
import {ATLAS_BANK} from '../website/assets/personality/v5/atlas-bank.mjs';
import {colorProfile,typeProfile} from '../website/assets/personality/v5/atlas-model.mjs';
import {emptyStory,validateStory,loadStory,saveStory} from '../website/assets/personality/v5/story-store.mjs';
import {openStore} from '../website/assets/personality/v1/store.mjs';
import {createState} from '../website/assets/personality/v1/core.mjs';
import {createTarotDraw} from '../website/assets/personality/v5/story-core.mjs';
import {createReportKit,PORTRAIT_BRIEF} from '../website/assets/personality/v5/report-kit.mjs';
import {RELEASE as current} from '../website/assets/personality/v5/release.mjs';
import {RELEASE as previous} from '../website/assets/personality/v4/release.mjs';
import {presentationForURL} from '../website/assets/personality/v5/bootstrap.mjs';

const read=async name=>JSON.parse(await readFile(new URL(`../website/assets/personality/v5/data/${name}.json`,import.meta.url),'utf8'));
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

test('draft type does not force a code from missing or middle answers',()=>{
  assert.equal(typeProfile().code,null);
  const positive=Object.fromEntries(ATLAS_BANK.typeItems.map(item=>[item.id,item.key===1?5:1]));
  assert.equal(typeProfile(positive).code,'ENFJ');
  positive[ATLAS_BANK.typeItems[0].id]=undefined;
  assert.equal(typeProfile(positive).code,null);
  const middle=Object.fromEntries(ATLAS_BANK.typeItems.map(item=>[item.id,3]));
  assert.equal(typeProfile(middle).code,'????');
});

test('only explicitly approved story details and derived symbols enter the kit',()=>{
  const value=emptyStory();
  value.background.bg04={status:'answered',selected:['o01']};
  value.background.bg35={status:'answered',selected:['o01','o02','o03']};
  value.birthday='1990-09-10';
  value.draw=createTarotDraw(sources.deck);
  value.approvedSymbols=['western','chinese','tarot'];
  const positive=Object.fromEntries(ATLAS_BANK.typeItems.map(item=>[item.id,item.key===1?5:1]));
  value.type=positive;
  assert.doesNotThrow(()=>validateStory(value,sources));
  const kit=createReportKit(state,{name:'Alex',story:{value,sources}});
  assert.equal(kit.data.story.context.length,0);
  assert.equal(kit.data.story.privacy.fullBirthdayIncluded,false);
  assert(!kit.text.includes('1990-09-10'));
  assert.equal(kit.data.story.symbols.western.sign,'Virgo');
  assert.equal(kit.data.story.symbols.tarot.cards.length,3);
  assert(kit.data.story.symbols.tarot.cards.every(card=>card.image.url.startsWith('https://engmanager.xyz/assets/personality/v5/tarot/')));
  assert.equal(kit.data.atlas.type.code,'ENFJ');
  assert.equal(kit.data.atlas.reference.name,'Louis Armstrong');
  assert.match(PORTRAIT_BRIEF,/Five-movement score/);
  assert.match(PORTRAIT_BRIEF,/public-life parallel.*metaphor/);
  value.approvedIds=['bg04'];
  assert.equal(createReportKit(state,{story:{value,sources}}).data.story.context[0].id,'bg04');
});

test('new release retains v4 and uses a hardcoded current presentation',async()=>{
  assert.equal(current.v,5);
  assert.equal(current.presentation,'unified-atlas-v5');
  assert.equal(current.previousReleases[0].releaseDigest,hash(JSON.stringify(previous)));
  assert.equal(presentationForURL('https://engmanager.xyz/personality/report'),'v5');
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
