import {RELEASE} from './release.mjs';

const WORKER_URL = '/personality/sw.js';
const SCOPE = '/personality/';
const DEFAULT_TIMEOUT = 180000;
let pendingInstallation = null;

async function releaseDigest() {
  const bytes = new TextEncoder().encode(JSON.stringify(RELEASE));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function waitForWorker(worker, states, deadline) {
  return new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('The offline worker did not start. Try again online.')); return; }
    let timer;
    function clean() { clearTimeout(timer); worker.removeEventListener('statechange', check); }
    function check() {
      if (states.includes(worker.state)) { clean(); resolve(worker); }
      else if (worker.state === 'redundant') { clean(); reject(new Error('The offline worker was replaced. Reload and try again.')); }
    }
    worker.addEventListener('statechange', check);
    timer = setTimeout(() => { clean(); reject(new Error('Offline setup timed out. Check your connection and try again.')); }, Math.max(1, deadline - Date.now()));
    check();
  });
}

async function install({onProgress = () => {}, timeoutMs = DEFAULT_TIMEOUT} = {}) {
  if (!globalThis.isSecureContext || !navigator.serviceWorker || !globalThis.caches || !crypto.subtle) {
    throw new Error('This browser cannot install offline files. Local saving and downloadable backups are still available.');
  }
  if (!RELEASE.ready) throw new Error('The complete public assessment release is not available yet.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) throw new Error('Invalid offline installation timeout.');
  const deadline = Date.now() + timeoutMs;
  const digest = await releaseDigest();
  const registration = await navigator.serviceWorker.register(WORKER_URL, {scope: SCOPE, type: 'module', updateViaCache: 'none'});
  // A waiting update can receive the installation command without taking over
  // the older complete release. It activates only after its cache is committed.
  const candidate = registration.installing ?? registration.waiting ?? registration.active;
  const worker = await waitForWorker(candidate, ['installed', 'activated'], deadline);
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => finish(new Error('The download did not finish in time. Keep this tab open and try again; your answers are unaffected.')), Math.max(1, deadline - Date.now()));
    function finish(error, result) {
      clearTimeout(timer); channel.port1.close();
      if (error) reject(error); else resolve(result);
    }
    channel.port1.onmessage = event => {
      const data = event.data;
      if (!data || data.releaseDigest !== digest) return;
      if (data.type === 'OFFLINE_PROGRESS') { try { onProgress({completed: data.completed, total: data.total}); } catch {} }
      else if (data.type === 'OFFLINE_READY') {
        waitForWorker(worker, ['activated'], deadline).then(() => finish(null, {
          cacheName: data.cacheName, assets: data.assets, routes: data.routes,
        }), finish);
      }
      else if (data.type === 'OFFLINE_ERROR') finish(new Error(typeof data.message === 'string' ? data.message : 'Offline installation failed.'));
    };
    try { worker.postMessage({type: 'INSTALL_RELEASE', releaseDigest: digest}, [channel.port2]); }
    catch (error) { finish(error); }
  });
}

// Only an explicit UI action calls this function. Importing this module neither
// registers a worker nor downloads public release files.
export function installOffline(options) {
  if (!pendingInstallation) pendingInstallation = install(options).finally(() => { pendingInstallation = null; });
  return pendingInstallation;
}
