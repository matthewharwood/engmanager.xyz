#!/usr/bin/env node
// Manual, real-model browser integration test. No npm/browser-driver dependency.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {access, mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PINNED_MODEL} from '../website/assets/personality/ai/v1/model-manager.mjs';
import {TASKS} from '../website/assets/personality/v1/enhancement.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
  if (!match) throw new Error('Arguments use --name=value. Run with --help for usage.');
  return [match[1], match[2] ?? true];
}));
if (args.help) {
  console.log('Usage: node scripts/personality-litert-smoke.mjs --model=/absolute/path/gemma-4-E2B-it-web.litertlm [--tasks=all|focused|synthesis,visibility] [--chrome=/path/to/chrome] [--output=/path/audit.json] [--timeout=600000]\nEnvironment alternatives: PERSONALITY_MODEL_FILE and CHROME_BIN. Requires Node 22+ and an installed WebGPU-capable Chrome. Downloads nothing; the isolated browser profile is deleted after the run.');
  process.exit(0);
}
for (const key of Object.keys(args)) assert.ok(['model', 'tasks', 'chrome', 'output', 'timeout'].includes(key), `Unknown argument --${key}`);
const modelPath = args.model || process.env.PERSONALITY_MODEL_FILE;
assert.ok(typeof modelPath === 'string' && path.isAbsolute(modelPath), 'Supply --model=/absolute/path or PERSONALITY_MODEL_FILE. The script never downloads a model.');
const timeoutMs = Number(args.timeout || 600000);
assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs >= 30000 && timeoutMs <= 1800000, 'Timeout must be 30,000–1,800,000 milliseconds.');
const requested = args.tasks || 'focused';
const taskIds = requested === 'all' ? TASKS.map(task => task.id) : requested === 'focused' ? ['tradeoff', 'history', 'question'] : String(requested).split(',');
assert.ok(taskIds.length && taskIds.every(id => TASKS.some(task => task.id === id)) && new Set(taskIds).size === taskIds.length, 'Choose unique valid action IDs, all, or focused.');
const website = fileURLToPath(new URL('../website/', import.meta.url));
const source = await readFile(path.join(website, 'src/http.rs'), 'utf8');
const csp = source.match(/"(default-src 'none';[^"\n]+)"/)?.[1];
assert.ok(csp?.includes("script-src 'self' 'wasm-unsafe-eval'") && csp.includes("worker-src 'self'"), 'Could not locate the production assessment CSP. Update this harness when its declaration changes.');
const modelInfo = await stat(modelPath);
assert.equal(modelInfo.size, PINNED_MODEL.bytes, 'The file size does not match the supported Web model.');
const hash = createHash('sha256');
for await (const chunk of createReadStream(modelPath)) hash.update(chunk);
assert.equal(hash.digest('hex'), PINNED_MODEL.sha256, 'The model SHA-256 does not match the pinned release.');

async function findChrome() {
  const explicit = args.chrome || process.env.CHROME_BIN;
  if (explicit) {await access(explicit); return explicit;}
  const candidates = process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] :
    process.platform === 'win32' ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map(base => path.join(base, 'Google/Chrome/Application/chrome.exe')) :
      (process.env.PATH || '').split(path.delimiter).flatMap(base => ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(name => path.join(base, name)));
  for (const candidate of candidates) {try {await access(candidate); return candidate;} catch {}}
  throw new Error('Chrome was not found. Set CHROME_BIN or --chrome=/absolute/path.');
}

// This function becomes a same-origin external browser module under the real CSP.
async function browserTest(selectedTasks) {
  const {createLocalAI} = await import('/assets/personality/ai/v1/runtime.mjs');
  const {createState} = await import('/assets/personality/v1/core.mjs');
  const {createContext, generateReflection} = await import('/assets/personality/v1/enhancement.mjs');
  const started = performance.now();
  const ai = createLocalAI({onStatus: ({phase}) => console.log('AI_PHASE', phase)});
  try {
    if (!ai.capabilities().supported) throw new Error('This browser does not expose the required local-AI capabilities.');
    let file = await (await fetch('/model')).blob();
    console.log('AI_IMPORT', 'Verifying and storing the approved model');
    await ai.importModel(file); file = null;
    await ai.load();
    const loadMilliseconds = Math.round(performance.now() - started);
    const state = createState();
    state.responses = state.responses.map((_, index) => (index * 7) % (index < 150 ? 5 : 6) + 1);
    const context = {...createContext(), goal: 'visibility', format: 'writing', minutes: 20,
      example: 'I investigated an intermittent timeout in a synthetic demo service. I compared traces, tested a connection-pool hypothesis, and wrote the result in a short decision note. A teammate found an assumption I had missed. This is a fictional test example.',
      comparison: 'Option A: spend a week improving reliability in an existing service with a teammate. Option B: prototype a new internal tool independently, with an uncertain audience. Both are fictional exploration options, not job offers.',
      question: 'Please review this possible working preference: I would like to send an investigation note before a design review and invite feedback on one uncertain assumption. What does the available evidence support, and what should I confirm?',
      history: '2026-09-05: I wrote a short investigation note and asked a fictional teammate what was unclear. 2026-09-12: I revised one diagram after feedback. I found written preparation useful on this one task, but I have not compared it with other tasks.'};
    const results = [];
    for (const task of selectedTasks) {
      const began = performance.now(), rejectedDrafts = [];
      let attempts = 0;
      const observedAI = {generate(input, options) {
        attempts++;
        const validate = input.validate;
        return ai.generate({...input, validate(value) {
          try {return validate(value);} catch (error) {rejectedDrafts.push({reason: error.message, value}); throw error;}
        }}, options);
      }};
      try {
        const result = await generateReflection(observedAI, state, context, task);
        results.push({task, ok: true, attempts, milliseconds: Math.round(performance.now() - began), result, rejectedDrafts});
        console.log('AI_TASK', task, 'passed', attempts);
      } catch (error) {
        results.push({task, ok: false, attempts, milliseconds: Math.round(performance.now() - began), error: error.message, rejectedDrafts});
        console.log('AI_TASK', task, 'failed', error.message);
      }
    }
    await ai.unload();
    window.smokeResult = {ok: results.every(result => result.ok), loadMilliseconds, milliseconds: Math.round(performance.now() - started), results};
  } catch (error) {
    await ai.unload().catch(() => {});
    window.smokeResult = {ok: false, error: error.message, milliseconds: Math.round(performance.now() - started)};
  }
}

const requests = [], network = [];
const boot = `await (${browserTest.toString()})(${JSON.stringify(taskIds)});`;
const server = createServer(async (request, response) => {
  requests.push({method: request.method, path: request.url});
  response.setHeader('content-security-policy', csp);
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('cache-control', 'no-store');
  try {
    if (request.method !== 'GET' || request.url.includes('?')) {response.writeHead(405); response.end(); return;}
    if (request.url === '/favicon.ico') {response.writeHead(204); response.end(); return;}
    if (request.url === '/') {response.writeHead(200, {'content-type': 'text/html'}); response.end('<!doctype html><title>Local LiteRT smoke</title><h1>Local LiteRT smoke</h1><script type="module" src="/smoke.mjs"></script>'); return;}
    if (request.url === '/smoke.mjs') {response.writeHead(200, {'content-type': 'text/javascript'}); response.end(boot); return;}
    let file;
    if (request.url === '/model') file = modelPath;
    else if (request.url.startsWith('/assets/personality/')) {
      file = path.resolve(website, '.' + decodeURIComponent(request.url));
      if (!file.startsWith(path.join(website, 'assets/personality') + path.sep)) throw new Error('Invalid asset path');
    } else throw new Error('Unexpected path');
    const info = await stat(file);
    response.writeHead(200, {'content-length': info.size, 'content-type': file.endsWith('.wasm') ? 'application/wasm' : /\.m?js$/.test(file) ? 'text/javascript' : 'application/octet-stream'});
    createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {response.writeHead(404); response.end();}
});

let chrome, socket, profile, audit, failure, stderr = '';
try {
  const chromePath = await findChrome();
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  profile = await mkdtemp(path.join(tmpdir(), 'personality-litert-smoke-'));
  const chromeArgs = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'];
  chrome = spawn(chromePath, chromeArgs, {stdio: ['ignore', 'ignore', 'pipe']});
  chrome.on('error', error => {failure = error;});
  chrome.stderr.on('data', data => {stderr = (stderr + data).slice(-12000);});
  let port;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (failure) throw failure;
    try {port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break;} catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!port) throw new Error('Chrome did not expose its local debugging port. ' + stderr);
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = ({data}) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id); if (!item) return;
      pending.delete(message.id); clearTimeout(item.timer); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
    } else if (message.method === 'Network.requestWillBeSent') network.push({method: message.params.request.method, url: message.params.request.url});
    else if (message.method === 'Runtime.consoleAPICalled') {
      const values = message.params.args.map(value => value.value);
      if (String(values[0]).startsWith('AI_')) console.log(values.join(' '));
    }
  };
  socket.onclose = () => {for (const item of pending.values()) {clearTimeout(item.timer); item.reject(new Error('Chrome closed its debugging connection.'));} pending.clear();};
  const call = (method, params = {}) => {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {pending.delete(id); reject(new Error('Chrome debugging request timed out: ' + method));}, 30000);
      pending.set(id, {resolve, reject, timer}); socket.send(JSON.stringify({id, method, params}));
    });
  };
  const browser = await call('Browser.getVersion');
  await call('Runtime.enable'); await call('Network.enable');
  const origin = `http://127.0.0.1:${server.address().port}`;
  await call('Page.navigate', {url: origin + '/'});
  const deadline = Date.now() + timeoutMs;
  let result;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    result = (await call('Runtime.evaluate', {expression: 'window.smokeResult', returnByValue: true})).result?.value;
    if (result) break;
    if (chrome.exitCode !== null) throw new Error('Chrome exited before completing the smoke test.');
  }
  audit = {model: {id: PINNED_MODEL.id, bytes: PINNED_MODEL.bytes, sha256: PINNED_MODEL.sha256}, browser, csp,
    actions: taskIds, result: result || {ok: false, error: 'Smoke test timed out.'}, requests, network,
    scope: 'One synthetic assessment. Passing verifies inference and report-contract integration, not scientific accuracy or report-quality improvement.'};
  assert.ok(requests.every(request => request.method === 'GET' && !request.path.includes('?') &&
    ['/', '/favicon.ico', '/smoke.mjs', '/model'].includes(request.path) || request.method === 'GET' && request.path.startsWith('/assets/personality/') && !request.path.includes('?')), 'Unexpected input-bearing request or endpoint.');
  assert.ok(network.every(request => request.method === 'GET' && new URL(request.url).origin === origin), 'The page made a remote or non-GET request.');
  assert.ok(result?.ok, result?.error || 'One or more model outputs failed the report contract; inspect the audit.');
} catch (error) {failure = error;} finally {
  if (args.output) {
    try {await writeFile(path.resolve(String(args.output)), JSON.stringify(audit || {error: failure?.message, requests, network, stderr}, null, 2) + '\n');}
    catch (error) {failure ||= error;}
  }
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await Promise.race([once(chrome, 'exit'), new Promise(resolve => setTimeout(resolve, 3000))]);
    if (chrome.exitCode === null) chrome.kill('SIGKILL');
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (profile) await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
}
if (audit) console.log(JSON.stringify({ok: audit.result.ok, loadMilliseconds: audit.result.loadMilliseconds,
  milliseconds: audit.result.milliseconds, actions: audit.result.results?.map(({task, ok, attempts, milliseconds}) => ({task, ok, attempts, milliseconds}))}, null, 2));
if (failure) {console.error(failure.message); process.exitCode = 1;}
