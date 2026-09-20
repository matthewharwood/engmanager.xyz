import {sha256} from './vendor/noble-hashes/sha2.js';
import {bytesToHex} from './vendor/noble-hashes/utils.js';

export const PINNED_MODEL = Object.freeze({
  id: 'gemma4-e2b-web-b3ca0d2f',
  name: 'Gemma 4 E2B · Web',
  fileName: 'gemma-4-E2B-it-web.litertlm',
  bytes: 2008432640,
  sha256: '3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
  revision: 'b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1',
  downloadUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1/gemma-4-E2B-it-web.litertlm?download=true',
  sourceUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm',
  license: 'Apache-2.0',
  licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
});

const INDEX_CACHE = 'personality-ai-model-index-v1';
const MODEL_PREFIX = 'personality-ai-model-v1-';
const MODEL_HEADERS = {'content-type': 'application/octet-stream'};
export function abortError(message = 'Local AI operation cancelled.') {return new DOMException(message, 'AbortError');}
export function throwIfAborted(signal) {if (signal?.aborted) throw abortError();}
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

/** Streaming hashing bounds memory: never create a two-gigabyte ArrayBuffer. */
export async function hashBlob(blob, {signal, onProgress, chunkBytes = 4 * 1024 * 1024} = {}) {
  if (!(blob instanceof Blob)) throw new TypeError('Choose a model file.');
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 16 * 1024 * 1024) throw new Error('Invalid model verification chunk size.');
  const hash = sha256.create();
  try {
    for (let offset = 0; offset < blob.size; offset += chunkBytes) {
      throwIfAborted(signal);
      hash.update(new Uint8Array(await blob.slice(offset, offset + chunkBytes).arrayBuffer()));
      throwIfAborted(signal);
      onProgress?.({phase: 'verify', loaded: Math.min(offset + chunkBytes, blob.size), total: blob.size});
      await yieldTask();
    }
    throwIfAborted(signal);
    return bytesToHex(hash.digest());
  } finally {hash.destroy();}
}

/** Models are user-imported public files. This module performs no network requests. */
export function createModelManager({cacheStorage = globalThis.caches, origin = globalThis.location?.origin,
  storage = globalThis.navigator?.storage, model = PINNED_MODEL, uuid = () => crypto.randomUUID()} = {}) {
  if (!origin) throw new Error('Local model storage needs a browser origin.');
  const indexKey = new URL('/personality/__local-ai/model-index-v1', origin).href;
  const modelKey = new URL('/personality/__local-ai/' + model.id + '.litertlm', origin).href;
  function available() {if (!cacheStorage) throw new Error('This browser cannot store an optional local model. Your standard report is still available.');}
  async function readIndex() {
    available();
    if (!(await cacheStorage.has(INDEX_CACHE))) return null;
    const response = await (await cacheStorage.open(INDEX_CACHE)).match(indexKey);
    if (!response) return null;
    try {
      const entry = await response.json();
      if (Object.keys(entry).sort().join() !== 'bytes,cacheName,id,importedAt,sha256,v' || entry.v !== 1 ||
          entry.id !== model.id || entry.bytes !== model.bytes || entry.sha256 !== model.sha256 ||
          typeof entry.importedAt !== 'string' || !Number.isFinite(Date.parse(entry.importedAt)) ||
          typeof entry.cacheName !== 'string' || !/^personality-ai-model-v1-[a-zA-Z0-9-]{1,80}$/.test(entry.cacheName)) return null;
      return entry;
    } catch {return null;}
  }
  async function status() {
    const entry = await readIndex();
    if (!entry || !(await cacheStorage.has(entry.cacheName))) return {installed: false, model};
    const response = await (await cacheStorage.open(entry.cacheName)).match(modelKey);
    if (!response || response.headers.get('x-model-sha256') !== model.sha256 ||
        response.headers.get('content-length') !== String(model.bytes)) return {installed: false, model};
    return {installed: true, model, importedAt: entry.importedAt};
  }
  async function importModel(file, {signal, onProgress} = {}) {
    available(); throwIfAborted(signal);
    if (!(file instanceof Blob) || file.size !== model.bytes) throw new Error(`Choose ${model.fileName} (${model.bytes.toLocaleString()} bytes). Other model builds are not compatible.`);
    const estimate = await storage?.estimate?.().catch(() => undefined);
    if (estimate && Number.isFinite(estimate.quota) && Number.isFinite(estimate.usage) &&
        estimate.quota - estimate.usage < model.bytes * 1.1) throw new Error('There is not enough browser storage for this model. Free space or continue with the standard report.');
    const digest = await hashBlob(file, {signal, onProgress});
    if (digest !== model.sha256) throw new Error('The model checksum does not match the approved release. No model was installed.');
    const previous = await readIndex();
    const cacheName = MODEL_PREFIX + uuid();
    let committed = false;
    try {
      throwIfAborted(signal);
      onProgress?.({phase: 'store', loaded: 0, total: file.size});
      const cache = await cacheStorage.open(cacheName);
      await cache.put(modelKey, new Response(file, {headers: {...MODEL_HEADERS, 'content-length': String(file.size), 'x-model-sha256': digest}}));
      throwIfAborted(signal);
      const entry = {v: 1, id: model.id, bytes: model.bytes, sha256: digest, cacheName, importedAt: new Date().toISOString()};
      const index = await cacheStorage.open(INDEX_CACHE);
      await index.put(indexKey, new Response(JSON.stringify(entry), {headers: {'content-type': 'application/json'}}));
      committed = true;
      if (previous?.cacheName !== cacheName && previous?.cacheName) await cacheStorage.delete(previous.cacheName).catch(() => false);
      onProgress?.({phase: 'ready', loaded: file.size, total: file.size});
      return {installed: true, model, importedAt: entry.importedAt};
    } finally {if (!committed) await cacheStorage.delete(cacheName).catch(() => false);}
  }
  async function modelBlob() {
    const entry = await readIndex();
    if (!entry) throw new Error('Import the approved model file before loading local AI.');
    const response = await (await cacheStorage.open(entry.cacheName)).match(modelKey);
    if (!response || response.headers.get('x-model-sha256') !== model.sha256) throw new Error('The installed model is unavailable. Import the file again.');
    const blob = await response.blob();
    if (blob.size !== model.bytes) throw new Error('The installed model is incomplete. Import the file again.');
    return blob;
  }
  async function removeModel() {
    available();
    await cacheStorage.delete(INDEX_CACHE);
    for (const name of await cacheStorage.keys()) if (name.startsWith(MODEL_PREFIX)) await cacheStorage.delete(name);
    return {installed: false, model};
  }
  return Object.freeze({status, importModel, modelBlob, removeModel});
}
