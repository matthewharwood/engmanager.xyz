import {openDB} from '../v1/vendor/idb.mjs';
import {DATABASE_NAME} from '../v1/store.mjs';
import {ATLAS_BANK} from './atlas-bank.mjs';
import {validateBackground, validateTarotDraw, birthdaySymbols} from './story-core.mjs';

const key = id => `story-atlas:${id}`;
const validOwner = id => typeof id === 'string' && /^[A-Za-z0-9-]{1,80}$/.test(id);
export const emptyStory = () => ({background:{},type:{},birthday:'',approvedIds:[],approvedSymbols:[],draw:null});

export function validateStory(value, {bank,countries,deck}) {
  if (!value || Object.keys(value).sort().join(',') !== 'approvedIds,approvedSymbols,background,birthday,draw,type') throw new Error('Invalid story fields.');
  const background = validateBackground(bank,countries,value.background);
  const ids = new Set(bank.questions.map(q=>q.id));
  if (!Array.isArray(value.approvedIds) || new Set(value.approvedIds).size !== value.approvedIds.length || value.approvedIds.some(id=>!ids.has(id))) throw new Error('Invalid story export selection.');
  if (!Array.isArray(value.approvedSymbols) || new Set(value.approvedSymbols).size !== value.approvedSymbols.length || value.approvedSymbols.some(id=>!['western','chinese','tarot'].includes(id))) throw new Error('Invalid symbol selection.');
  const typeIds = new Set(ATLAS_BANK.typeItems.map(item=>item.id));
  if (!value.type || typeof value.type !== 'object' || Array.isArray(value.type) || Object.entries(value.type).some(([id,answer])=>!typeIds.has(id)||!Number.isInteger(answer)||answer<1||answer>5)) throw new Error('Invalid preference answer.');
  if (typeof value.birthday !== 'string' || value.birthday.length > 10) throw new Error('Invalid birthday.');
  if (value.birthday) birthdaySymbols(value.birthday);
  if (value.draw !== null) validateTarotDraw(deck,value.draw);
  return {background:value.background,type:{...value.type},birthday:value.birthday,
    approvedIds:[...value.approvedIds],approvedSymbols:[...value.approvedSymbols],draw:value.draw};
}

export async function loadStory(id, sources, {databaseName=DATABASE_NAME}={}) {
  if (!validOwner(id)) throw new Error('Invalid assessment owner.');
  const db=await openDB(databaseName,1);
  try {
    const tx=db.transaction(['drafts','notes'],'readonly');
    const draft=await tx.objectStore('drafts').get(id);
    const saved=await tx.objectStore('notes').get(key(id));
    await tx.done;
    if (!draft) throw new Error('This assessment no longer exists.');
    if (!saved) return {revision:0,value:emptyStory()};
    if (saved.kind!=='story-atlas-v1'||saved.draftId!==id||!Number.isSafeInteger(saved.revision)||saved.revision<1) throw new Error('Saved story is invalid.');
    return {revision:saved.revision,value:validateStory(saved.value,sources)};
  } finally {db.close();}
}

export async function saveStory(id, expectedRevision, value, sources, {databaseName=DATABASE_NAME}={}) {
  if (!validOwner(id)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0) throw new Error('Invalid story revision.');
  const clean=validateStory(value,sources);
  const db=await openDB(databaseName,1);
  try {
    const tx=db.transaction(['drafts','notes'],'readwrite');
    try {
      if (!await tx.objectStore('drafts').get(id)) throw new Error('This assessment no longer exists.');
      const prior=await tx.objectStore('notes').get(key(id));
      const revision=prior?.revision??0;
      if (prior && (prior.kind!=='story-atlas-v1'||prior.draftId!==id)) throw new Error('Saved story is invalid.');
      if (revision!==expectedRevision||revision===Number.MAX_SAFE_INTEGER) throw new Error('Story changed in another tab. Reload before editing it.');
      await tx.objectStore('notes').put({kind:'story-atlas-v1',draftId:id,revision:revision+1,value:clean},key(id));
      await tx.done;
      return {revision:revision+1,value:clean};
    } catch(error) {try{tx.abort();}catch{} await tx.done.catch(()=>{}); throw error;}
  } finally {db.close();}
}

export async function loadStorySources() {
  const names=['background-questionnaire','countries','tarot-deck'];
  const data=await Promise.all(names.map(async name=>{
    const response=await fetch(`/assets/personality/v6/data/${name}.json`,{credentials:'omit'});
    if(!response.ok)throw new Error('The optional story questions could not load.');
    return response.json();
  }));
  return {bank:data[0],countries:data[1],deck:data[2]};
}
