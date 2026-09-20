import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {createModelManager, hashBlob, PINNED_MODEL} from '../website/assets/personality/ai/v1/model-manager.mjs';
import {parseModelJSON, validateSections, validatePrompt, LIMITS} from '../website/assets/personality/ai/v1/schema.mjs';
import {createLocalAI, capabilities, AI_ASSETS, AI_RUNTIME_CACHE, installRuntime} from '../website/assets/personality/ai/v1/runtime.mjs';

class MemoryCache {
  records = new Map();
  failPut = false;
  async put(key, response) {if (this.failPut) throw new Error('quota'); this.records.set(String(key.url || key), response.clone());}
  async match(key) {return this.records.get(String(key.url || key))?.clone();}
  async delete(key) {return this.records.delete(String(key.url || key));}
  async keys() {return [...this.records.keys()];}
}
class MemoryCaches {
  caches = new Map();
  async has(name) {return this.caches.has(name);}
  async open(name) {if (!this.caches.has(name)) this.caches.set(name, new MemoryCache()); return this.caches.get(name);}
  async delete(name) {return this.caches.delete(name);}
  async keys() {return [...this.caches.keys()];}
}
const sha = data => createHash('sha256').update(data).digest('hex');
const bytes = Buffer.from('A small public fixture, not a substitute for inference.');
const fixture = {...PINNED_MODEL, id: 'fixture', bytes: bytes.length, sha256: sha(bytes)};
function manager(cacheStorage = new MemoryCaches(), extra = {}) {
  let id = 0;
  return createModelManager({cacheStorage, origin: 'https://example.test', model: fixture, uuid: () => 'fixture-' + ++id, ...extra});
}

test('streamed model hash matches SHA-256 across chunk boundaries and cancellation', async () => {
  assert.equal(await hashBlob(new Blob([bytes]), {chunkBytes: 3}), sha(bytes));
  assert.equal(await hashBlob(new Blob([])), sha(Buffer.alloc(0)));
  await assert.rejects(hashBlob(new Blob([bytes]), {chunkBytes: 0}), /chunk/);
  const controller = new AbortController();
  await assert.rejects(hashBlob(new Blob([bytes]), {chunkBytes: 3, signal: controller.signal, onProgress: () => controller.abort()}), {name: 'AbortError'});
});
test('model import commits only verified bytes and keeps prior installation on rejection', async () => {
  const caches = new MemoryCaches(), models = manager(caches);
  assert.equal((await models.status()).installed, false);
  await assert.rejects(models.importModel(new Blob(['short'])), /Choose/);
  await models.importModel(new Blob([bytes]));
  assert.equal((await models.status()).installed, true);
  assert.equal(await (await models.modelBlob()).text(), bytes.toString());
  const changed = Buffer.from(bytes); changed[0] ^= 1;
  await assert.rejects(models.importModel(new Blob([changed])), /checksum/);
  assert.equal((await models.status()).installed, true);
  assert.equal(await (await models.modelBlob()).text(), bytes.toString());
});
test('model quota, cancellation, and failed commit never announce a partial installation', async () => {
  const tiny = manager(undefined, {storage: {estimate: async () => ({quota: 1, usage: 0})}});
  await assert.rejects(tiny.importModel(new Blob([bytes])), /enough/);
  const caches = new MemoryCaches(), models = manager(caches);
  const index = await caches.open('personality-ai-model-index-v1'); index.failPut = true;
  await assert.rejects(models.importModel(new Blob([bytes])), /quota/);
  assert.equal((await models.status()).installed, false);
  assert.equal((await caches.keys()).some(name => name.startsWith('personality-ai-model-v1-')), false);
  const controller = new AbortController();
  await assert.rejects(models.importModel(new Blob([bytes]), {signal: controller.signal, onProgress: () => controller.abort()}), {name: 'AbortError'});
  assert.equal((await models.status()).installed, false);
});
test('removing the optional model preserves unrelated caches and assessments', async () => {
  const caches = new MemoryCaches(), models = manager(caches);
  await caches.open('personality-v1-assessment');
  await models.importModel(new Blob([bytes]));
  await models.removeModel();
  assert.equal((await models.status()).installed, false);
  assert.deepEqual(await caches.keys(), ['personality-v1-assessment']);
});

const section = {sections: [{title: 'A small experiment', body: 'Consider preparing one written question.', evidence: ['facet.E2']}]};
test('generated JSON is bounded, schema checked, and evidence allowlisted', () => {
  const valid = validateSections(parseModelJSON('```json\n' + JSON.stringify(section) + '\n```'), new Set(['facet.E2']));
  assert.deepEqual(valid, section);
  assert.throws(() => parseModelJSON('Preface ' + JSON.stringify(section)), /format/);
  assert.throws(() => parseModelJSON('x'.repeat(LIMITS.outputChars + 1)), /size/);
  assert.throws(() => validateSections({...section, score: 8}), /sections/);
  assert.throws(() => validateSections(section, new Set()), /evidence/);
  assert.throws(() => validateSections({sections: [{...section.sections[0], body: 'x'.repeat(701)}]}), /text/);
  assert.throws(() => validateSections({sections: [{...section.sections[0], evidence: ['a', 'a']}]}), /repeated/);
  assert.throws(() => validatePrompt({system: 'Bounded', prompt: 'x'.repeat(LIMITS.inputChars + 1)}), /context/);
});

class TestWorker {
  static instances = [];
  static hanging = false;
  static output = JSON.stringify(section);
  calls = [];
  terminated = false;
  constructor(url, options) {this.url = url; this.options = options; TestWorker.instances.push(this);}
  postMessage(message) {
    this.calls.push(message);
    if (TestWorker.hanging && message.type === 'generate') return;
    queueMicrotask(() => this.onmessage({data: {id: message.id, type: 'done', result: message.type === 'generate' ? {text: TestWorker.output} : {ready: message.type === 'load'}}}));
  }
  terminate() {this.terminated = true;}
}
const environment = {isSecureContext: true, navigator: {gpu: {}}, Worker: TestWorker, caches: {}};
const memoryManager = {status: async () => ({installed: true}), modelBlob: async () => new Blob([bytes]), importModel: async () => {}, removeModel: async () => ({installed: false})};
test('unsupported devices retain standard-report fallback without starting a worker', async () => {
  const count = TestWorker.instances.length;
  const ai = createLocalAI({environment: {...environment, navigator: {}}, WorkerClass: TestWorker, manager: memoryManager});
  assert.equal(capabilities({...environment, navigator: {}}).supported, false);
  await assert.rejects(ai.load(), /WebGPU/);
  assert.equal(TestWorker.instances.length, count);
});
test('load, grounded generation, validation failure, and unload manage worker lifecycle', async () => {
  TestWorker.hanging = false; TestWorker.output = JSON.stringify(section);
  const ai = createLocalAI({environment, WorkerClass: TestWorker, manager: memoryManager});
  const result = await ai.generate({system: 'Use only evidence.', prompt: {facts: ['facet.E2']}, validate: value => validateSections(value, new Set(['facet.E2']))});
  assert.deepEqual(result, section);
  const worker = TestWorker.instances.at(-1);
  assert.equal(worker.calls[0].model instanceof Blob, true);
  assert.equal(worker.calls[1].prompt, '{"facts":["facet.E2"]}');
  assert.equal(ai.isReady(), true);
  TestWorker.output = 'not JSON';
  await assert.rejects(ai.generate({system: 'Use only evidence.', prompt: '{}'}), /format/);
  await ai.unload();
  assert.equal(worker.calls.at(-1).type, 'unload');
  assert.equal(worker.terminated, true);
  assert.equal(ai.isReady(), false);
});
test('abort and time limit terminate worker and release pending operations', async () => {
  TestWorker.hanging = true;
  const ai = createLocalAI({environment, WorkerClass: TestWorker, manager: memoryManager, limits: {...LIMITS, generateMs: 15}});
  await ai.load();
  await assert.rejects(ai.generate({system: 'Use evidence.', prompt: '{}'}), /too long/);
  assert.equal(TestWorker.instances.at(-1).terminated, true);
  assert.equal(ai.isReady(), false);
  await ai.load();
  const controller = new AbortController();
  const generation = ai.generate({system: 'Use evidence.', prompt: '{}'}, {signal: controller.signal});
  controller.abort();
  await assert.rejects(generation, {name: 'AbortError'});
  assert.equal(TestWorker.instances.at(-1).terminated, true);
  TestWorker.hanging = false;
});
test('cancel during model retrieval cannot start a worker after cancellation', async () => {
  let resolveBlob;
  const count = TestWorker.instances.length;
  const ai = createLocalAI({environment, WorkerClass: TestWorker, manager: {...memoryManager, modelBlob: () => new Promise(resolve => {resolveBlob = resolve;})}});
  const loading = ai.load(); ai.cancel(); resolveBlob(new Blob([bytes]));
  await assert.rejects(loading, {name: 'AbortError'});
  assert.equal(TestWorker.instances.length, count);
});
test('a stale cancelled model read cannot tear down a newer successful load', async () => {
  let resolveOld, reads = 0;
  const ai = createLocalAI({environment, WorkerClass: TestWorker, manager: {...memoryManager,
    modelBlob: () => ++reads === 1 ? new Promise(resolve => {resolveOld = resolve;}) : Promise.resolve(new Blob([bytes]))}});
  const oldLoad = ai.load(); ai.cancel();
  await ai.load();
  const worker = TestWorker.instances.at(-1);
  resolveOld(new Blob([bytes]));
  await assert.rejects(oldLoad, {name: 'AbortError'});
  assert.equal(ai.isReady(), true);
  assert.equal(worker.terminated, false);
  await ai.unload();
});
test('optional release pins every shipped byte and never includes model weights', async () => {
  assert.ok(AI_ASSETS.length > 20);
  async function walk(url) {
    const list = [];
    for (const file of await readdir(url, {withFileTypes: true})) {
      const child = new URL(file.name + (file.isDirectory() ? '/' : ''), url);
      if (file.isDirectory()) list.push(...await walk(child));
      else if (!['assets.mjs', 'generate-manifest.mjs'].includes(file.name)) list.push(child.pathname.slice(child.pathname.indexOf('/assets/personality/ai/v1/')));
    }
    return list;
  }
  assert.deepEqual(AI_ASSETS.map(asset => asset.path).sort(), (await walk(new URL('../website/assets/personality/ai/v1/', import.meta.url))).sort());
  for (const asset of AI_ASSETS) {
    assert.ok(asset.path.startsWith('/assets/personality/ai/v1/'));
    assert.equal(asset.path.endsWith('.litertlm'), false);
    const data = await readFile(new URL('../website' + asset.path, import.meta.url));
    assert.equal(data.length, asset.bytes, asset.path);
    assert.equal(sha(data), asset.sha256, asset.path);
  }
});
test('runtime installation verifies bytes, commits a ready marker, and reuses an installed release', async () => {
  const caches = new MemoryCaches(), calls = [];
  const fetcher = async (url, options) => {
    calls.push(url);
    assert.equal(new URL(url).origin, 'https://example.test');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return new Response(await readFile(new URL('../website' + new URL(url).pathname, import.meta.url)), {headers: {
      'content-type': url.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
      'content-security-policy': "script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self'",
      'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff'}});
  };
  const result = await installRuntime({cacheStorage: caches, origin: 'https://example.test', fetcher});
  assert.equal(result.installed, true);
  const cache = await caches.open(AI_RUNTIME_CACHE);
  assert.ok(await cache.match('https://example.test/assets/personality/ai/v1/__runtime-ready'));
  const cachedWorker = await cache.match('https://example.test/assets/personality/ai/v1/worker.js');
  assert.equal(cachedWorker.headers.get('content-security-policy'), "script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self'");
  assert.equal(cachedWorker.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(cachedWorker.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await cache.keys()).length, AI_ASSETS.length + 2);
  const count = calls.length;
  assert.equal((await installRuntime({cacheStorage: caches, origin: 'https://example.test', fetcher})).cached, true);
  assert.equal(calls.length, count);
  assert.equal((await caches.keys()).some(name => name.includes('-staging-')), false);
});
test('tampered runtime download and aborted install never create a ready marker', async () => {
  const caches = new MemoryCaches();
  await assert.rejects(installRuntime({cacheStorage: caches, origin: 'https://example.test', fetcher: async () => new Response('tampered')}), /pinned/);
  assert.deepEqual(await caches.keys(), []);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(installRuntime({cacheStorage: caches, origin: 'https://example.test', signal: controller.signal}), {name: 'AbortError'});
  assert.deepEqual(await caches.keys(), []);
});
