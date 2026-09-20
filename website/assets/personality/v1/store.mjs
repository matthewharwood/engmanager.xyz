import {openDB} from './vendor/idb.mjs';
import {validateState, exactObject} from './core.mjs';
import {RELEASE} from './release.mjs';
import {validateReleases, parseCanonicalJSON} from './share.mjs';
import {validateContext, createContext, validateEnhancement, assessmentBasis} from './enhancement.mjs';

export const DATABASE_NAME = 'engmanager.big-personality';
const STORES = ['drafts', 'reports', 'notes', 'preferences', 'instrumentReleases', 'installedAssets'];
const RECORD_KEYS = ['id', 'revision', 'createdAt', 'updatedAt', 'releases', 'state'];
const MAX_BACKUP_BYTES = 65536;

export function serializeBackup(input) {
  return JSON.stringify({v: 1, kind: 'big-six-seven-local-backup', releases: RELEASE.releases, state: validateState(input)});
}

export class ConflictError extends Error {
  constructor() { super('Another tab changed this assessment. Reload it or create a local copy.'); this.name = 'ConflictError'; }
}

function checkedRecord(record) {
  exactObject(record, RECORD_KEYS, 'saved assessment');
  if (typeof record.id !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(record.id) ||
      !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      ![record.createdAt, record.updatedAt].every(value => typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)))) {
    throw new Error('Saved assessment metadata is invalid. The original record has been retained.');
  }
  validateReleases(record.releases);
  if(record.state.blocks.some(id=>!RELEASE.blockIds.includes(id)))throw new Error('Unknown saved reflection selection.');
  return {...record, releases: structuredClone(record.releases), state: validateState(record.state)};
}

export async function openStore({name = DATABASE_NAME, onChange = () => {}, onBlocked = () => {}} = {}) {
  if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable. This session cannot save on this device.');
  let connection, closed = false;
  const db = await openDB(name, 1, {
    upgrade(database) { for (const store of STORES) database.createObjectStore(store); },
    blocked() { onBlocked('Close another open assessment tab so local storage can finish opening.'); },
    blocking() { closed = true; connection?.close(); onBlocked('Storage was updated in another tab. Reload before saving.'); },
    terminated() { closed = true; onBlocked('Local storage closed unexpectedly. Export your state before reloading.'); },
  });
  connection = db;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(`${name}:commits`) : null;
  channel?.unref?.();
  if (channel) channel.onmessage = event => {
    const value = event.data;
    if (value && typeof value === 'object' && typeof value.id === 'string' &&
        Number.isSafeInteger(value.revision) && value.revision >= 0 && Object.keys(value).length === 2) {
      // Notifications are hints only: callers must reload and validate IDB state.
      onChange({id: value.id, revision: value.revision});
    }
  };
  function ready() { if (closed) throw new Error('Local storage is closed. Reload before saving.'); }
  function notify(id, revision) { channel?.postMessage({id, revision}); }
  async function transaction(mode, action) {
    ready();
    const tx = db.transaction(['drafts', 'preferences'], mode);
    try { const result = await action(tx); await tx.done; return result; }
    catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
  }
  async function list() {
    ready();
    const records = await db.getAll('drafts');
    return records.map(checkedRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
  }
  async function loadActive() {
    return transaction('readonly', async tx => {
      const pointer = await tx.objectStore('preferences').get('activeDraftId');
      if (pointer !== undefined && typeof pointer !== 'string') throw new Error('Invalid active assessment pointer.');
      if (pointer) {
        const record = await tx.objectStore('drafts').get(pointer);
        if (record) return checkedRecord(record);
      }
      const records = (await tx.objectStore('drafts').getAll()).map(checkedRecord);
      records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
      return records[0] ?? null;
    });
  }
  async function load(id) {
    ready();
    if (typeof id !== 'string') throw new Error('Invalid assessment ID.');
    const record = await db.get('drafts', id);
    return record === undefined ? null : checkedRecord(record);
  }
  async function activate(id) {
    if (typeof id !== 'string') throw new Error('Invalid assessment ID.');
    const record = await transaction('readwrite', async tx => {
      const value = await tx.objectStore('drafts').get(id);
      if (!value) throw new Error('Assessment not found.');
      const record = checkedRecord(value);
      await tx.objectStore('preferences').put(id, 'activeDraftId');
      return record;
    });
    notify(id, record.revision);
    return record;
  }
  function preferenceKey(key) {
    if (typeof key !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(key) || key === 'activeDraftId') throw new Error('Invalid preference key.');
  }
  function preferenceValue(value) {
    if (!(value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && value.length <= 512))) throw new Error('Preferences must be bounded scalar values.');
    return value;
  }
  async function getPreference(key) {
    ready(); preferenceKey(key);
    const value = await db.get('preferences', key);
    return value === undefined ? undefined : preferenceValue(value);
  }
  async function setPreference(key, value) {
    ready(); preferenceKey(key); preferenceValue(value);
    await db.put('preferences', value, key);
    return value;
  }
  async function create(input) {
    const state = validateState(input);
    if(state.blocks.some(id=>!RELEASE.blockIds.includes(id)))throw new Error('Unknown reflection selection.');
    const now = new Date().toISOString(), id = crypto.randomUUID();
    const record = {id, revision: 1, createdAt: now, updatedAt: now, releases: structuredClone(RELEASE.releases), state};
    await transaction('readwrite', async tx => {
      await tx.objectStore('drafts').add(record, id);
      await tx.objectStore('preferences').put(id, 'activeDraftId');
    });
    notify(id, 1);
    return checkedRecord(record);
  }
  async function save(id, expectedRevision, input) {
    const state = validateState(input);
    if(state.blocks.some(id=>!RELEASE.blockIds.includes(id)))throw new Error('Unknown reflection selection.');
    if (typeof id !== 'string' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error('Invalid save revision.');
    const record = await transaction('readwrite', async tx => {
      const previous = await tx.objectStore('drafts').get(id);
      if (!previous) throw new Error('This assessment no longer exists. Create a local copy to save it.');
      const current = checkedRecord(previous);
      if (current.revision !== expectedRevision || current.revision === Number.MAX_SAFE_INTEGER) throw new ConflictError();
      const next = {...current, revision: current.revision + 1, updatedAt: new Date().toISOString(), state};
      await tx.objectStore('drafts').put(next, id);
      await tx.objectStore('preferences').put(id, 'activeDraftId');
      return next;
    });
    notify(id, record.revision);
    return checkedRecord(record);
  }
  async function remove(id) {
    if (typeof id !== 'string') throw new Error('Invalid assessment ID.');
    ready();
    const tx = db.transaction(['drafts', 'preferences', 'notes', 'reports'], 'readwrite');
    try {
      await tx.objectStore('drafts').delete(id);
      if (await tx.objectStore('preferences').get('activeDraftId') === id) await tx.objectStore('preferences').delete('activeDraftId');
      for (const storeName of ['notes', 'reports']) {
        const store = tx.objectStore(storeName);
        let cursor = await store.openCursor();
        while (cursor) { if (cursor.value?.draftId === id || cursor.key === id) await cursor.delete(); cursor = await cursor.continue(); }
      }
      await tx.done;
    } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
    notify(id, 0);
  }
  async function exportJSON(id) {
    ready();
    const raw = await db.get('drafts', id);
    if (!raw) throw new Error('Assessment not found.');
    const record = checkedRecord(raw);
    return serializeBackup(record.state);
  }
  async function importJSON(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Backup is too large.');
    const input = parseCanonicalJSON(text);
    exactObject(input, ['v', 'kind', 'releases', 'state'], 'backup');
    if (input.v !== 1 || input.kind !== 'big-six-seven-local-backup') throw new Error('Unsupported backup format.');
    validateReleases(input.releases);
    return create(validateState(input.state));
  }
  async function loadReflection(id) {
    ready();
    const tx=db.transaction(['drafts','reports'],'readonly');
    const current=await tx.objectStore('drafts').get(id),saved=await tx.objectStore('reports').get(id);await tx.done;
    if(!current)throw new Error('Assessment not found.');
    const record=checkedRecord(current);
    if(!saved)return {context:createContext(),enhancement:null};
    exactObject(saved,['draftId','basis','context','enhancement'],'local reflection');
    if(saved.draftId!==id)throw new Error('Invalid reflection owner.');
    const context=validateContext(saved.context);
    return {context,enhancement:saved.enhancement&&saved.basis===assessmentBasis(record.state)?validateEnhancement(saved.enhancement,record.state):null};
  }
  async function saveReflection(id,expectedRevision,{context,enhancement}) {
    ready();const checkedContext=validateContext(context);
    const tx=db.transaction(['drafts','reports'],'readwrite');
    try {
      const raw=await tx.objectStore('drafts').get(id);if(!raw)throw new Error('Assessment no longer exists.');
      const current=checkedRecord(raw);
      if(current.revision!==expectedRevision||current.revision===Number.MAX_SAFE_INTEGER)throw new ConflictError();
      const checked=enhancement===null?null:validateEnhancement(enhancement,current.state);
      const next={...current,revision:current.revision+1,updatedAt:new Date().toISOString()};
      await tx.objectStore('reports').put({draftId:id,basis:assessmentBasis(current.state),context:checkedContext,enhancement:checked},id);
      await tx.objectStore('drafts').put(next,id);await tx.done;notify(id,next.revision);return checkedRecord(next);
    } catch(error){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw error;}
  }
  function close() { if (!closed) db.close(); closed = true; channel?.close(); }
  return {loadActive, load, activate, list, create, save, fork: create, remove, exportJSON, importJSON, getPreference, setPreference, loadReflection, saveReflection, close};
}
