import {openDB} from '../v1/vendor/idb.mjs';
import {DATABASE_NAME} from '../v1/store.mjs';

const key = id => `report-kit:${id}`;
function owner(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(id)) throw new Error('Invalid assessment owner.');
}
export function validateKitSettings(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'context,name' ||
      typeof value.name !== 'string' || value.name.length > 80 ||
      typeof value.context !== 'string' || value.context.length > 512 ||
      /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value.name) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value.context)) {
    throw new Error('Use a name up to 80 characters and optional context up to 512 characters.');
  }
  return {name:value.name, context:value.context};
}
function checked(value, id) {
  if (value === undefined) return {revision:0, name:'', context:''};
  if (!value || Object.keys(value).sort().join(',') !== 'context,draftId,kind,name,revision' ||
      value.kind !== 'report-kit-settings-v1' || value.draftId !== id ||
      !Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error('Saved report details are invalid.');
  return {revision:value.revision, ...validateKitSettings({name:value.name, context:value.context})};
}

// Existing notes are owned by a draft. The frozen v1 remove() already deletes
// notes by draftId, so deleting an assessment also removes these optional details.
export async function loadKitSettings(id, {databaseName=DATABASE_NAME}={}) {
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
export async function saveKitSettings(id, expectedRevision, settings, {databaseName=DATABASE_NAME}={}) {
  owner(id);
  const value=validateKitSettings(settings);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('Invalid report details revision.');
  const db=await openDB(databaseName,1);
  try {
    const tx=db.transaction(['drafts','notes'],'readwrite');
    try {
      if (!await tx.objectStore('drafts').get(id)) throw new Error('This assessment no longer exists.');
      const prior=checked(await tx.objectStore('notes').get(key(id)),id);
      if (prior.revision !== expectedRevision || prior.revision === Number.MAX_SAFE_INTEGER) throw new Error('Report details changed in another tab. Reload before editing them.');
      const revision=prior.revision+1;
      await tx.objectStore('notes').put({kind:'report-kit-settings-v1',draftId:id,revision,...value},key(id));
      await tx.done;
      return {revision,...value};
    } catch(error) { try { tx.abort(); } catch {} await tx.done.catch(()=>{}); throw error; }
  } finally { db.close(); }
}
