import {openDB} from '../v1/vendor/idb.mjs';
import {DEFAULT_SETTINGS,validateSettings} from './studio-model.mjs';
import {DATABASE_NAME} from '../v1/store.mjs';

const key = id => `report-studio:${id}`;
function owner(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(id)) throw new Error('Invalid assessment owner.');
}

function checked(value, id) {
  if (value === undefined) return {revision:0,settings:structuredClone(DEFAULT_SETTINGS)};
  if (!value || Object.keys(value).sort().join(',') !== 'draftId,kind,revision,settings' ||
      value.kind !== 'report-studio-settings-v1' || value.draftId !== id ||
      !Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error('Saved report details are invalid.');
  return {revision:value.revision,settings:validateSettings(value.settings)};
}

// Existing notes are owned by a draft. The frozen v1 remove() already deletes
// notes by draftId, so deleting an assessment also removes these optional details.
export async function loadStudioSettings(id, {databaseName=DATABASE_NAME}={}) {
  owner(id);
  const db=await openDB(databaseName,1);
  try {
    const tx=db.transaction(['drafts','notes'],'readonly');
    const draft=await tx.objectStore('drafts').get(id);
    const value=await tx.objectStore('notes').get(key(id));
    await tx.done;
    if (!draft) throw new Error('This assessment no longer exists.');
    return checked(value,id);
  } finally { db.close(); }
}
export async function saveStudioSettings(id, expectedRevision, settings, {databaseName=DATABASE_NAME}={}) {
  owner(id);
  const value=validateSettings(settings);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('Invalid report details revision.');
  const db=await openDB(databaseName,1);
  try {
    const tx=db.transaction(['drafts','notes'],'readwrite');
    try {
      if (!await tx.objectStore('drafts').get(id)) throw new Error('This assessment no longer exists.');
      const prior=checked(await tx.objectStore('notes').get(key(id)),id);
      if (prior.revision !== expectedRevision || prior.revision === Number.MAX_SAFE_INTEGER) throw new Error('Report details changed in another tab. Reload before editing them.');
      const revision=prior.revision+1;
      await tx.objectStore('notes').put({kind:'report-studio-settings-v1',draftId:id,revision,settings:value},key(id));
      await tx.done;
      return {revision,settings:value};
    } catch(error) { try { tx.abort(); } catch {} await tx.done.catch(()=>{}); throw error; }
  } finally { db.close(); }
}
