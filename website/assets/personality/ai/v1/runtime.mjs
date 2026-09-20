import {PINNED_MODEL, createModelManager, abortError, throwIfAborted} from './model-manager.mjs';
import {LIMITS, parseModelJSON, validateSections, validatePrompt} from './schema.mjs';
import {AI_ASSETS, AI_RUNTIME_CACHE, AI_MANIFEST_DIGEST} from './assets.mjs';
export {PINNED_MODEL, LIMITS, validateSections, AI_ASSETS, AI_RUNTIME_CACHE};

const READY_PATH = '/assets/personality/ai/v1/__runtime-ready';
export function capabilities(environment = globalThis) {
  return Object.freeze({secureContext: environment.isSecureContext === true,
    webgpu: Boolean(environment.navigator?.gpu), workers: typeof environment.Worker === 'function',
    modelStorage: Boolean(environment.caches),
    supported: environment.isSecureContext === true && Boolean(environment.navigator?.gpu) &&
      typeof environment.Worker === 'function' && Boolean(environment.caches)});
}

/** Only public, pinned, same-origin runtime files are fetched; never prompts or answers. */
export async function installRuntime({signal, onProgress, fetcher = globalThis.fetch,
  cacheStorage = globalThis.caches, origin = globalThis.location?.origin} = {}) {
  throwIfAborted(signal);
  if (!cacheStorage || !origin) throw new Error('This browser cannot install the optional AI runtime.');
  if (await cacheStorage.has(AI_RUNTIME_CACHE)) {
    const existing = await (await cacheStorage.open(AI_RUNTIME_CACHE)).match(new URL(READY_PATH, origin).href);
    if (existing && await existing.text() === AI_MANIFEST_DIGEST) return {installed: true, cacheName: AI_RUNTIME_CACHE,
      bytes: AI_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0), cached: true};
  }
  const stagingName = AI_RUNTIME_CACHE + '-staging-' + crypto.randomUUID();
  const staging = await cacheStorage.open(stagingName);
  let done = 0;
  const total = AI_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0);
  try {
    for (const asset of AI_ASSETS) {
      throwIfAborted(signal);
      const url = new URL(asset.path, origin);
      if (url.origin !== origin || !url.pathname.startsWith('/assets/personality/ai/v1/')) throw new Error('Invalid local AI runtime manifest.');
      const response = await fetcher(url.href, {signal, cache: 'no-cache', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'});
      if (!response.ok || response.type === 'opaque' || (response.url && new URL(response.url).origin !== origin)) throw new Error('Could not download the optional AI runtime.');
      const data = new Uint8Array(await response.arrayBuffer());
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), byte => byte.toString(16).padStart(2, '0')).join('');
      if (data.byteLength !== asset.bytes || hash !== asset.sha256) throw new Error('The optional AI runtime did not match its pinned release.');
      await staging.put(url.href, new Response(data, {headers: {'content-type': response.headers.get('content-type') || 'application/octet-stream'}}));
      done += data.byteLength;
      onProgress?.({phase: 'runtime', loaded: done, total});
    }
    // assets.mjs cannot contain its own hash; reconstruct it from the pinned list.
    const manifest = await fetcher(new URL('/assets/personality/ai/v1/assets.mjs', origin).href,
      {signal, cache: 'no-cache', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'});
    if (!manifest.ok) throw new Error('The optional AI manifest is unavailable.');
    const source = await manifest.text();
    const expected = `// Generated from the optional local AI runtime; model weights are excluded.\nexport const AI_ASSETS = Object.freeze(${JSON.stringify(AI_ASSETS)});\nexport const AI_MANIFEST_DIGEST = '${AI_MANIFEST_DIGEST}';\nexport const AI_RUNTIME_CACHE = 'personality-ai-runtime-v1-${AI_MANIFEST_DIGEST}';\n`;
    if (source !== expected) throw new Error('The optional AI manifest changed during installation.');
    await staging.put(new URL('/assets/personality/ai/v1/assets.mjs', origin).href, new Response(source, {headers: {'content-type': 'text/javascript'}}));
    throwIfAborted(signal);
    // The ready marker is the commit point. The worker must ignore incomplete caches.
    const target = await cacheStorage.open(AI_RUNTIME_CACHE);
    await target.delete(new URL(READY_PATH, origin).href);
    for (const request of await staging.keys()) {
      throwIfAborted(signal);
      await target.put(request, await staging.match(request));
    }
    throwIfAborted(signal);
    await target.put(new URL(READY_PATH, origin).href, new Response(AI_MANIFEST_DIGEST));
    return {installed: true, cacheName: AI_RUNTIME_CACHE, bytes: total};
  } finally {await cacheStorage.delete(stagingName).catch(() => false);}
}

/** A worker is the isolation/cancellation boundary, not a security boundary for same-origin code. */
export function createLocalAI({onStatus, WorkerClass = globalThis.Worker,
  environment = globalThis, manager, limits = LIMITS} = {}) {
  const models = manager || createModelManager();
  let worker = null, ready = false, requestId = 0, pending = null, loading = false, epoch = 0;
  const emit = (phase, message) => onStatus?.({phase, message, ready});
  function stop(reason = abortError()) {
    epoch++;
    ready = false; loading = false;
    const item = pending; pending = null;
    if (item) {item.clean(); item.reject(reason);}
    worker?.terminate(); worker = null;
  }
  function ensureWorker() {
    if (!worker) {
      worker = new WorkerClass(new URL('./worker.js', import.meta.url), {name: 'big-six-seven-local-ai'});
      worker.onmessage = ({data}) => {
        if (!pending || data?.id !== pending.id) return;
        if (data.type === 'chunk') {
          if (typeof data.text !== 'string' || (pending.chars += data.text.length) > limits.outputChars) return stop(new Error('Local AI output exceeded its size limit.'));
          try {pending.onChunk?.(data.text);} catch (error) {stop(error);} return;
        }
        const item = pending; pending = null; item.clean();
        if (data.type === 'done') item.resolve(data.result);
        else {
          const error = new Error(typeof data.message === 'string' ? data.message.slice(0, 400) : 'Local AI could not complete the request.');
          item.reject(error); stop(error);
        }
      };
      worker.onerror = () => stop(new Error('The local AI worker stopped. Your standard report is still available.'));
      worker.onmessageerror = () => stop(new Error('The local AI worker returned an unreadable response.'));
    }
    return worker;
  }
  function request(type, data, {signal, onChunk, timeout} = {}) {
    throwIfAborted(signal);
    if (pending) throw new Error('A local AI operation is already running.');
    const activeWorker = ensureWorker(), id = ++requestId;
    return new Promise((resolve, reject) => {
      const abort = () => stop(abortError());
      const timer = setTimeout(() => stop(new Error('Local AI took too long on this device. Your standard report is still available.')), timeout);
      const clean = () => {clearTimeout(timer); signal?.removeEventListener('abort', abort);};
      pending = {id, resolve, reject, clean, onChunk, chars: 0};
      signal?.addEventListener('abort', abort, {once: true});
      try {activeWorker.postMessage({id, type, ...data});} catch (error) {stop(error);}
    });
  }
  async function load({signal} = {}) {
    throwIfAborted(signal);
    if (ready) return {ready: true, model: PINNED_MODEL};
    if (loading || pending) throw new Error('Local AI is already loading or generating.');
    if (!capabilities(environment).supported) throw new Error('This browser needs WebGPU, workers, and local storage for AI. Your standard report works without them.');
    loading = true; emit('loading', 'Loading the local model into WebGPU…');
    const startingEpoch = epoch;
    try {
      const blob = await models.modelBlob();
      throwIfAborted(signal);
      if (startingEpoch !== epoch) throw abortError();
      await request('load', {model: blob}, {signal, timeout: limits.loadMs});
      ready = true; emit('ready', 'Local AI is ready. Prompts stay in this browser.');
      return {ready: true, model: PINNED_MODEL};
    } catch (error) {stop(error); emit('error', error.message); throw error;}
    finally {loading = false;}
  }
  async function generate(input, {signal, onChunk} = {}) {
    const {system, prompt} = validatePrompt(input);
    throwIfAborted(signal);
    if (!ready) await load({signal});
    emit('generating', 'Writing a local reflection…');
    try {
      const {text} = await request('generate', {system, prompt}, {signal, onChunk, timeout: limits.generateMs});
      const parsed = parseModelJSON(text);
      const value = input.validate ? input.validate(parsed) : validateSections(parsed);
      if (value === undefined) throw new Error('The local AI validator did not accept a report.');
      emit('ready', 'Local reflection is ready for review.');
      return value;
    } catch (error) {emit(error.name === 'AbortError' ? 'cancelled' : 'error', error.message); throw error;}
  }
  function cancel() {stop(); emit('cancelled', 'Local AI was cancelled and unloaded.');}
  async function unload() {
    if (pending || loading) stop();
    else if (worker && ready) {
      try {await request('unload', {}, {timeout: 3000});} finally {stop();}
    } else stop();
    emit('unloaded', 'Local AI memory was released.');
  }
  async function removeModel() {await unload(); const result = await models.removeModel(); emit('removed', 'The optional model was removed from this browser.'); return result;}
  return Object.freeze({capabilities: () => capabilities(environment), modelStatus: models.status,
    importModel: models.importModel, installRuntime, load, generate, cancel, unload, removeModel,
    isReady: () => ready});
}
