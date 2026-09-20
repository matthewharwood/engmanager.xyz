import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openDB} from '../website/assets/personality/v1/vendor/idb.mjs';
import {openStore,serializeBackup} from '../website/assets/personality/v1/store.mjs';
import {createState} from '../website/assets/personality/v1/core.mjs';
import {encodeSnapshot} from '../website/assets/personality/v1/share.mjs';
import {loadKitSettings,saveKitSettings,validateKitSettings} from '../website/assets/personality/v2/report-kit-store.mjs';

async function fixture(run){
  const databaseName=`report-kit-test-${crypto.randomUUID()}`;
  const store=await openStore({name:databaseName});
  try{await run(store,{databaseName});}finally{store.close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(databaseName);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});}
}

test('optional details survive reopen and remain isolated from another draft and scientific snapshots',async()=>fixture(async(store,options)=>{
  const first=await store.create(createState()),second=await store.create(createState());
  const original=await store.load(first.id),snapshot=encodeSnapshot(original.state),backup=serializeBackup(original.state);
  assert.deepEqual(await loadKitSettings(first.id,options),{revision:0,name:'',context:''});
  await saveKitSettings(first.id,0,{name:'Synthetic reader',context:'Private report context for a conversation.'},options);
  assert.deepEqual(await loadKitSettings(first.id,options),{revision:1,name:'Synthetic reader',context:'Private report context for a conversation.'});
  assert.deepEqual(await loadKitSettings(second.id,options),{revision:0,name:'',context:''});
  assert.deepEqual(await store.load(first.id),original);
  assert.equal(encodeSnapshot(original.state),snapshot);assert.equal(serializeBackup(original.state),backup);
  assert(!snapshot.includes('Synthetic'));assert(!backup.includes('Private report context'));
  const fork=await store.fork(original.state);
  assert.deepEqual(await loadKitSettings(fork.id,options),{revision:0,name:'',context:''});
}));

test('concurrent report-detail saves reject stale writes without losing the committed value',async()=>fixture(async(store,options)=>{
  const draft=await store.create(createState());
  const results=await Promise.allSettled([
    saveKitSettings(draft.id,0,{name:'First',context:'One'},options),
    saveKitSettings(draft.id,0,{name:'Second',context:'Two'},options),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/another tab/);
  const committed=results.find(r=>r.status==='fulfilled').value;
  assert.deepEqual(await loadKitSettings(draft.id,options),committed);
}));

test('the existing assessment deletion removes optional details and prevents orphan writes',async()=>fixture(async(store,options)=>{
  const draft=await store.create(createState());
  await saveKitSettings(draft.id,0,{name:'Remove me',context:'Remove this too'},options);
  await store.remove(draft.id);
  await assert.rejects(loadKitSettings(draft.id,options),/no longer exists/);
  await assert.rejects(saveKitSettings(draft.id,1,{name:'No orphan',context:''},options),/no longer exists/);
  const db=await openDB(options.databaseName,1);
  try{assert.deepEqual(await db.getAll('notes'),[]);}finally{db.close();}
}));

test('bounded optional details reject malformed stored records without replacing them',async()=>fixture(async(store,options)=>{
  for(const value of [{name:'a'.repeat(81),context:''},{name:'a',context:'b'.repeat(513)},{name:'a',context:'\u0000'},{name:'a',context:'',extra:'x'}])assert.throws(()=>validateKitSettings(value));
  const draft=await store.create(createState()),db=await openDB(options.databaseName,1);
  const invalid={kind:'report-kit-settings-v1',draftId:'different-owner',revision:1,name:'Unsafe',context:''};
  try{await db.put('notes',invalid,`report-kit:${draft.id}`);}finally{db.close();}
  await assert.rejects(loadKitSettings(draft.id,options),/invalid/);
  await assert.rejects(saveKitSettings(draft.id,0,{name:'Replacement',context:''},options),/invalid/);
  const check=await openDB(options.databaseName,1);
  try{assert.deepEqual(await check.get('notes',`report-kit:${draft.id}`),invalid);}finally{check.close();}
}));
