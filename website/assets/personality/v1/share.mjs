import {BANK} from './bank.mjs';
import {validateState, exactObject, score, SCORE_VERSION} from './core.mjs';
import {RELEASE} from './release.mjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
const DOMAIN_IDS = ['O', 'C', 'E', 'A', 'N'];
const SNAPSHOT_KEYS = ['v', 'releases', 'locale', 'modules', 'wording', 'responses', 'answered', 'skipped', 'cursor', 'view', 'reportDate', 'blocks'];

export function parseCanonicalJSON(text) {
  if (typeof text !== 'string') throw new Error('Expected JSON text.');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('Invalid JSON.'); }
  // This exact round trip rejects duplicate keys, whitespace, alternate escapes,
  // negative zero and alternate number spellings, before any object is used.
  if (JSON.stringify(value) !== text) throw new Error('Noncanonical JSON or duplicate fields.');
  return value;
}

function base64url(bytes) {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64url(text, expectedBytes) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) throw new Error('Invalid base64url.');
  let bytes;
  try { bytes = Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4)), char => char.charCodeAt(0)); }
  catch { throw new Error('Invalid base64url.'); }
  if ((expectedBytes !== undefined && bytes.length !== expectedBytes) || base64url(bytes) !== text) throw new Error('Noncanonical base64url or invalid length.');
  return bytes;
}
function encodePacket(value, limit) {
  const bytes = encoder.encode(JSON.stringify(value));
  if (bytes.length > 6144) throw new Error('Snapshot is too large. Download a local JSON file instead.');
  const token = `1.${base64url(bytes)}`;
  if (token.length > limit) throw new Error('Link is too large. Download a local JSON file instead.');
  return token;
}
function decodePacket(token, limit) {
  if (typeof token !== 'string' || token.length > limit || !token.startsWith('1.')) throw new Error('Unsupported or oversized link.');
  const bytes = fromBase64url(token.slice(2));
  if (bytes.length > 6144) throw new Error('Decoded snapshot is too large.');
  let text;
  try { text = decoder.decode(bytes); } catch { throw new Error('Invalid UTF-8.'); }
  return parseCanonicalJSON(text);
}

export function validateReleases(value) {
  // Exact registry equality binds version IDs and all digests. No payload field
  // is ever used as a URL or a source of executable code.
  if (JSON.stringify(value) !== JSON.stringify(RELEASE.releases)) {
    throw new Error('This link or saved assessment requires an unavailable release. Its data has not been changed.');
  }
  return structuredClone(RELEASE.releases);
}

function pack(values, width) {
  const bytes = new Uint8Array(Math.ceil(values.length * width / 8));
  values.forEach((value, index) => {
    for (let offset = 0; offset < width; offset++) {
      const bit = index * width + offset;
      bytes[Math.floor(bit / 8)] |= ((value >> (width - 1 - offset)) & 1) << (7 - bit % 8);
    }
  });
  return base64url(bytes);
}
function unpack(text, width) {
  const length = Math.ceil(170 * width / 8), bytes = fromBase64url(text, length);
  const padding = length * 8 - 170 * width;
  if ((bytes[length - 1] & ((1 << padding) - 1)) !== 0) throw new Error('Nonzero packed padding.');
  return Array.from({length: 170}, (_, index) => {
    let value = 0;
    for (let offset = 0; offset < width; offset++) {
      const bit = index * width + offset;
      value = (value << 1) | ((bytes[Math.floor(bit / 8)] >> (7 - bit % 8)) & 1);
    }
    return value;
  });
}
function checkBlocks(blocks) {
  if (blocks.some(id => !RELEASE.blockIds.includes(id))) throw new Error('Unknown reflection selection.');
}

export function encodeSnapshot(input) {
  const state = validateState(input);
  checkBlocks(state.blocks);
  const responses = state.responses.map((value, slot) => state.modules.includes(BANK.items[slot].module) ? value ?? 0 : 0);
  const skipped = state.skipped.map((value, slot) => state.modules.includes(BANK.items[slot].module) && value ? 1 : 0);
  return encodePacket({v: 1, releases: RELEASE.releases, locale: 'en', modules: state.modules,
    wording: state.wording, responses: pack(responses, 3), answered: pack(responses.map(value => value ? 1 : 0), 1),
    skipped: pack(skipped, 1), cursor: state.cursor, view: state.view, reportDate: state.reportDate, blocks: state.blocks}, 8192);
}

export function decodeSnapshot(token) {
  const input = decodePacket(token, 8192);
  exactObject(input, SNAPSHOT_KEYS, 'snapshot');
  if (input.v !== 1 || input.locale !== 'en') throw new Error('Unsupported snapshot version or language.');
  validateReleases(input.releases);
  const packed = unpack(input.responses, 3), answered = unpack(input.answered, 1), skipped = unpack(input.skipped, 1);
  for (let slot = 0; slot < 170; slot++) {
    if (answered[slot] !== (packed[slot] === 0 ? 0 : 1) || (skipped[slot] && packed[slot] !== 0)) throw new Error('Inconsistent answer or skip flags.');
  }
  const state = validateState({v: 1, modules: input.modules, wording: input.wording,
    responses: packed.map(value => value === 0 ? null : value), skipped: skipped.map(Boolean), cursor: input.cursor,
    view: input.view, reportDate: input.reportDate, blocks: input.blocks});
  checkBlocks(state.blocks);
  for (let slot = 0; slot < 170; slot++) {
    if (!state.modules.includes(BANK.items[slot].module) && (packed[slot] !== 0 || skipped[slot])) throw new Error('Snapshot includes answers from an excluded module.');
  }
  if (encodeSnapshot(state) !== token) throw new Error('Snapshot is not canonically encoded.');
  return state;
}

function summaryObject(input, selectedIds) {
  if (!Array.isArray(selectedIds) || selectedIds.length < 1 || selectedIds.length > 5 ||
      new Set(selectedIds).size !== selectedIds.length || Array.from(selectedIds).some(id => !DOMAIN_IDS.includes(id))) throw new Error('Choose at least one complete Big Five domain.');
  const scores = score(input);
  const m = DOMAIN_IDS.filter(id => selectedIds.includes(id)).map(id => {
    const domain = scores.domains.find(item => item.id === id);
    if (!domain.complete) throw new Error(`${domain.name} is incomplete and cannot be shared as a score.`);
    return [id, Math.round(domain.mean * 100)];
  });
  return {s: 1, i: 'ipip-neo-120', iv: BANK.instrumentVersions[0], sv: SCORE_VERSION, lang: 'en', m, kind: 'raw-mean-centi'};
}
export function encodeSummary(input, selectedIds) { return encodePacket(summaryObject(input, selectedIds), 1500); }
export function decodeSummary(token) {
  const input = decodePacket(token, 1500);
  exactObject(input, ['s', 'i', 'iv', 'sv', 'lang', 'm', 'kind'], 'summary');
  if (input.s !== 1 || input.i !== 'ipip-neo-120' || input.iv !== BANK.instrumentVersions[0] ||
      input.sv !== SCORE_VERSION || input.lang !== 'en' || input.kind !== 'raw-mean-centi' ||
      !Array.isArray(input.m) || input.m.length < 1 || input.m.length > 5) throw new Error('Unsupported summary.');
  let previous = -1;
  for (const entry of input.m) {
    if (!Array.isArray(entry) || entry.length !== 2 || !DOMAIN_IDS.includes(entry[0]) ||
        !Number.isInteger(entry[1]) || entry[1] < 100 || entry[1] > 500) throw new Error('Invalid summary score.');
    const index = DOMAIN_IDS.indexOf(entry[0]);
    if (index <= previous) throw new Error('Repeated or unordered summary domains.');
    previous = index;
  }
  const canonical = {s: 1, i: input.i, iv: input.iv, sv: input.sv, lang: 'en', m: input.m, kind: 'raw-mean-centi'};
  if (encodePacket(canonical, 1500) !== token) throw new Error('Noncanonical summary.');
  return canonical;
}

export function readIngress(value) {
  const url = new URL(value, globalThis.location?.href ?? 'https://engmanager.xyz/articles/big-personality');
  const query = url.searchParams, fragment = new URLSearchParams(url.hash.slice(1));
  const queryS = query.getAll('s'), queryR = query.getAll('r'), fragmentS = fragment.getAll('s'), fragmentR = fragment.getAll('r');
  if (queryS.length) throw new Error('Full answer snapshots must use a URL fragment, never a query parameter.');
  const total = queryR.length + fragmentS.length + fragmentR.length;
  if (total > 1) throw new Error('Ambiguous link: use exactly one snapshot or summary.');
  if ((fragmentS.length || fragmentR.length) && [...fragment.keys()].length !== 1) throw new Error('Unexpected fragment fields.');
  if (fragmentS.length) return {kind: 'snapshot', state: decodeSnapshot(fragmentS[0])};
  if (queryR.length || fragmentR.length) return {kind: 'summary', summary: decodeSummary(queryR[0] ?? fragmentR[0])};
  return {kind: 'none'};
}

export async function verifyPublicAssets(paths = ['bank.mjs', 'core.mjs', 'report-content.mjs', 'report.mjs', 'charts.mjs']) {
  if (!RELEASE.ready) throw new Error('This public assessment release is incomplete.');
  for (const path of paths) {
    if (!Object.hasOwn(RELEASE.assets, path)) throw new Error('Unknown public release asset.');
    const response = await fetch(new URL(path, import.meta.url), {cache: 'force-cache', credentials: 'omit', referrerPolicy: 'no-referrer'});
    if (!response.ok) throw new Error('A required assessment release file is unavailable.');
    const hash = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
    const hex = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
    if (hex !== RELEASE.assets[path]) throw new Error('Assessment release integrity check failed. Reload or restore the matching release.');
  }
  return true;
}
