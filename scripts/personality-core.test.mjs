import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {BANK, MODULES} from '../website/assets/personality/v1/bank.mjs';
import {createState, validateState, selectedSlots, itemText, score} from '../website/assets/personality/v1/core.mjs';
import {encodeSnapshot, decodeSnapshot, encodeSummary, decodeSummary, readIngress, parseCanonicalJSON} from '../website/assets/personality/v1/share.mjs';
import {RELEASE} from '../website/assets/personality/v1/release.mjs';
import {ORIGINAL_RESPONSES, PERSONALITY} from '../_docs/big-personality/report-chart-data.mjs';

// Point to a locally installed fake-indexeddb auto/index.mjs or auto/index.js.
// Core/codec tests have no dependency. Storage tests never silently substitute a
// hand-written mock for transaction semantics.
if (process.env.FAKE_IDB_MODULE) {
  const fake = await import(pathToFileURL(process.env.FAKE_IDB_MODULE).href);
  for (const [key, value] of Object.entries(fake)) if (key === 'indexedDB' || key.startsWith('IDB')) globalThis[key] = value;
} else await import('fake-indexeddb/auto');
const hasIDB = typeof globalThis.indexedDB !== 'undefined';
const {openStore, ConflictError, serializeBackup} = await import('../website/assets/personality/v1/store.mjs');
const storageTest = (name, run) => test(name, {skip: hasIDB ? false : 'Set FAKE_IDB_MODULE to run real fake-indexeddb transaction tests.'}, run);
const complete = () => {
  const state = createState();
  state.responses.fill(3);
  state.cursor = {module: 'big5', slot: 0};
  state.view = 'report';
  state.reportDate = '2026-09-19';
  return state;
};
const unpackJSON = token => JSON.parse(Buffer.from(token.slice(2), 'base64url').toString('utf8'));
const repackJSON = value => `1.${Buffer.from(JSON.stringify(value)).toString('base64url')}`;
function changePacked(token, field, change) {
  const payload = unpackJSON(token), bytes = Buffer.from(payload[field], 'base64url');
  change(bytes);
  payload[field] = bytes.toString('base64url');
  return repackJSON(payload);
}

test('all 170 source items, keys, options and approved portraits match research banks', async () => {
  const core = JSON.parse(await readFile(new URL('../_docs/big-personality/question-bank.json', import.meta.url)));
  const extension = JSON.parse(await readFile(new URL('../_docs/big-personality/extension-question-bank.json', import.meta.url)));
  assert.equal(BANK.items.length, 170);
  assert.equal(new Set(BANK.items.map(item => item.id)).size, 170);
  for (const source of core.items) {
    const item = BANK.items[source.publishedItemNumber - 1];
    assert.equal(item.id, source.id); assert.equal(item.text, source.text); assert.equal(item.key, source.key);
    assert.equal(item.facet, source.facet); assert.equal(item.scale, source.domain);
    assert.deepEqual(item.options, core.administration.responseOptions);
  }
  for (const [index, module] of extension.modules.entries()) {
    const offset = index === 0 ? 120 : 150;
    for (const source of module.items) {
      const item = BANK.items[offset + source.sourceItemNumber - 1];
      assert.equal(item.id, source.id); assert.equal(item.text, source.text);
      assert.deepEqual(item.options, module.responseOptions);
      if (index === 1) for (const wording of ['they', 'he', 'she']) assert.equal(itemText(item, wording), source.textByPronoun[wording]);
    }
  }
  assert.equal(MODULES[1].instructionsSource, 'https://onetinterestprofiler.org/p/activities');
});

test('synthetic raw responses reproduce independent fixture counts and domain means', () => {
  const state = createState(['big5']);
  BANK.items.slice(0, 120).forEach(item => { state.responses[item.slot] = ORIGINAL_RESPONSES[item.id]; });
  const scores = score(state);
  for (const expected of PERSONALITY) {
    const actual = scores.domains.find(item => item.id === expected.id);
    assert.equal(actual.mean, expected.mean); assert.deepEqual(actual.counts, expected.counts);
    assert.equal(actual.facets.length, 6); assert(actual.facets.every(item => item.complete));
  }
  assert.deepEqual(scores.completion, {answered: 120, skipped: 0, total: 120});
});

test('reverse keys, neutral means, facet totals and explicit incompleteness', () => {
  const state = complete();
  let result = score(state);
  assert(result.domains.every(domain => domain.sum === 72 && domain.mean === 3));
  state.responses[0] = 5; // N1 positive item; the other 23 keyed responses are 3.
  result = score(state);
  assert.equal(result.domains.find(domain => domain.id === 'N').sum, 74);
  assert.equal(result.facets.find(facet => facet.id === 'N1').mean, 3.5);
  const reverse = BANK.items.find(item => item.key === -1);
  state.responses[reverse.slot] = 1;
  assert.equal(score(state).facets.find(facet => facet.id === reverse.facet).mean, 3.5);
  state.responses[0] = null; state.skipped[0] = true;
  result = score(state);
  assert.equal(result.domains.find(domain => domain.id === 'N').mean, null);
  assert.equal(result.facets.find(facet => facet.id === 'N1').mean, null);
  assert.equal(result.domains.filter(domain => domain.complete).length, 4);
  assert.equal(result.completion.skipped, 1);
  assert.equal(result.completion.answered, 169);
});

test('extreme keyed inputs score exact scale limits and Mini-IP maps 1–5 to 0–4', () => {
  for (const maximum of [false, true]) {
    const state = complete();
    state.responses = BANK.items.map(item => item.module === 'big5' ?
      (item.key === 1 ? (maximum ? 5 : 1) : (maximum ? 1 : 5)) : item.module === 'interests' ?
      (maximum ? 5 : 1) : (maximum ? 6 : 1));
    const result = score(state);
    assert(result.domains.every(domain => domain.mean === (maximum ? 5 : 1)));
    assert(result.interests.scores.every(item => item.sum === (maximum ? 20 : 0)));
    assert(result.values.scores.every(item => item.centered === 0));
  }
  const state = complete(); state.responses[149] = null;
  const result = score(state);
  assert.equal(result.interests.answered, 29); assert.equal(result.interests.complete, false);
  assert(result.interests.scores.every(item => item.sum === null && item.mean === null));
});

test('TwIVI uses complete20 centering, exact integer numerator and independent six-point inputs', () => {
  const state = complete(); state.responses.fill(1, 150);
  state.responses[154] = 6; state.responses[164] = 6;
  let result = score(state).values;
  assert.equal(result.grandMean, 1.5);
  assert.equal(result.scores.find(item => item.id === 'self_direction').centered, 4.5);
  assert.equal(result.scores.reduce((sum, item) => sum + item.centered, 0), 0);
  assert(result.scores.filter(item => item.id !== 'self_direction').every(item => item.centered === -0.5));
  state.responses[169] = null;
  result = score(state).values;
  assert.equal(result.answered, 19); assert.equal(result.grandMean, null);
  assert(result.scores.every(item => item.raw === null && item.centered === null));
});

test('every omitted source item withholds exactly its affected scale without neutral imputation', () => {
  const baseline = complete();
  baseline.responses = BANK.items.map(item => item.slot % (item.module === 'values' ? 6 : 5) + 1);
  for (const item of BANK.items) {
    const state = structuredClone(baseline);
    state.responses[item.slot] = null;
    state.skipped[item.slot] = item.slot % 2 === 0;
    const result = score(state);
    assert.equal(result.completion.answered, 169, `slot ${item.slot}`);
    assert.equal(result.completion.skipped, item.slot % 2 === 0 ? 1 : 0);
    if (item.module === 'big5') {
      assert.equal(result.facets.find(facet => facet.id === item.facet).mean, null);
      assert.equal(result.domains.find(domain => domain.id === item.scale).mean, null);
      assert.equal(result.facets.filter(facet => facet.complete).length, 29);
      assert.equal(result.domains.filter(domain => domain.complete).length, 4);
      assert(result.interests.complete && result.values.complete);
    } else if (item.module === 'interests') {
      assert.equal(result.interests.answered, 29);
      assert(result.interests.scores.every(interest => interest.sum === null));
      assert(result.domains.every(domain => domain.complete) && result.values.complete);
    } else {
      assert.equal(result.values.answered, 19);
      assert.equal(result.values.grandMean, null);
      assert(result.values.scores.every(value => value.raw === null && value.centered === null));
      assert(result.domains.every(domain => domain.complete) && result.interests.complete);
    }
  }
});

test('portrait pronouns and module order do not change construct scores', () => {
  const state = complete();
  state.responses = BANK.items.map(item => (item.slot * 7) % (item.module === 'values' ? 6 : 5) + 1);
  const expected = score(state);
  const orders = [
    ['big5', 'interests', 'values'], ['big5', 'values', 'interests'],
    ['interests', 'big5', 'values'], ['interests', 'values', 'big5'],
    ['values', 'big5', 'interests'], ['values', 'interests', 'big5'],
  ];
  for (const modules of orders) for (const wording of ['they', 'he', 'she']) {
    const candidate = {...state, modules, wording};
    assert.deepEqual(score(candidate), expected);
    assert.deepEqual(decodeSnapshot(encodeSnapshot(candidate)), candidate);
  }
  assert.deepEqual(state.modules, ['big5', 'interests', 'values']);
  assert.equal(state.wording, 'they');
});

test('TwIVI centered priorities are invariant to a uniform allowed response shift', () => {
  const state = complete();
  state.responses = BANK.items.map(item => item.slot >= 150 ? item.slot % 5 + 1 : 3);
  const baseline = score(state);
  const shifted = structuredClone(state);
  shifted.responses = shifted.responses.map((value, slot) => slot >= 150 ? value + 1 : value);
  const actual = score(shifted);
  assert.equal(actual.values.grandMean, baseline.values.grandMean + 1);
  actual.values.scores.forEach((value, index) => {
    assert.equal(value.raw, baseline.values.scores[index].raw + 1);
    assert.equal(value.centered, baseline.values.scores[index].centered);
  });
  assert.deepEqual(actual.domains, baseline.domains);
  assert.deepEqual(actual.interests, baseline.interests);
});

test('strict state rejects invalid ranges, skips, dates, cursor, duplicates and unknown fields', () => {
  const invalid = mutate => { const state = complete(); mutate(state); assert.throws(() => validateState(state)); };
  invalid(state => { state.responses[0] = 6; });
  invalid(state => { state.responses[120] = 6; });
  invalid(state => { state.responses[150] = 7; });
  invalid(state => { state.responses[0] = 0; });
  invalid(state => { delete state.responses[0]; });
  invalid(state => { state.responses[0] = 1.1; });
  invalid(state => { state.skipped[0] = true; });
  invalid(state => { state.reportDate = '2023-02-29'; });
  invalid(state => { state.cursor = {module: 'values', slot: 0}; });
  invalid(state => { state.cursor = null; });
  invalid(state => { state.modules = ['big5', 'big5']; });
  invalid(state => { state.notes = 'unexpected'; });
  const leap = complete(); leap.reportDate = '2024-02-29'; assert.equal(validateState(leap).reportDate, leap.reportDate);
  const reordered = createState(['values', 'big5', 'interests']);
  assert.equal(selectedSlots(reordered)[0], 150); assert.equal(selectedSlots(reordered)[20], 0);
});

test('complete and partial full snapshots reproduce exact canonical state without lookup', () => {
  const full = complete();
  full.wording = 'she'; full.modules = ['values', 'big5', 'interests'];
  full.responses = BANK.items.map(item => item.slot % (item.module === 'values' ? 6 : 5) + 1);
  full.cursor = {module: 'values', slot: 168};
  for (const state of [createState(), full]) {
    const token = encodeSnapshot(state);
    assert(token.length < 4096);
    assert.deepEqual(decodeSnapshot(token), state);
    assert.deepEqual(score(decodeSnapshot(token)), score(state));
    assert.deepEqual(readIngress(`https://engmanager.xyz/articles/big-personality#s=${token}`), {kind: 'snapshot', state});
  }
  const partial = complete(); partial.responses[50] = null; partial.skipped[50] = true; partial.view = 'review';
  assert.deepEqual(decodeSnapshot(encodeSnapshot(partial)), partial);
});

test('excluding a module clears only the snapshot copy, retaining private local answers', () => {
  const state = complete(); state.modules = ['big5'];
  const restored = decodeSnapshot(encodeSnapshot(state));
  assert(state.responses.slice(120).every(value => value === 3));
  assert(restored.responses.slice(120).every(value => value === null));
  assert.equal(score(restored).completion.total, 120);
  assert.equal(score(restored).values.selected, false);
  state.responses[150] = null; state.skipped[150] = true;
  const excludedSkips = decodeSnapshot(encodeSnapshot(state));
  assert.equal(state.skipped[150], true);
  assert(excludedSkips.skipped.slice(120).every(value => value === false));
  assert(excludedSkips.responses.slice(120).every(value => value === null));
});

test('snapshot rejects malicious lengths, bounds, padding, flags, unknown fields and unsupported releases', () => {
  const token = encodeSnapshot(complete());
  assert.throws(() => decodeSnapshot(changePacked(token, 'responses', bytes => { bytes[0] = (bytes[0] & 31) | (7 << 5); })));
  assert.throws(() => decodeSnapshot(changePacked(token, 'responses', bytes => { bytes[0] = (bytes[0] & 31) | (6 << 5); })));
  assert.throws(() => decodeSnapshot(changePacked(token, 'responses', bytes => { bytes[63] |= 1; })));
  assert.throws(() => decodeSnapshot(changePacked(token, 'answered', bytes => { bytes[0] &= 127; })));
  assert.throws(() => decodeSnapshot(changePacked(token, 'skipped', bytes => { bytes[0] |= 128; })));
  assert.throws(() => decodeSnapshot(changePacked(token, 'skipped', bytes => { bytes[21] |= 1; })));
  for (const mutate of [input => { input.notes = 'no'; }, input => { input.releases.scoring[1] = '0'.repeat(64); },
    input => { input.responses = 'AAAA'; }, input => { input.blocks = ['unknown-card']; }, input => { input.modules = ['big5']; }]) {
    const input = unpackJSON(token); mutate(input); assert.throws(() => decodeSnapshot(repackJSON(input)));
  }
  assert.throws(() => decodeSnapshot('1.' + 'A'.repeat(9000)));
  assert.throws(() => decodeSnapshot('1._w'));
  assert.throws(() => decodeSnapshot(token + '='));
  assert.throws(() => parseCanonicalJSON('{"v":1,"v":1}'));
  assert.throws(() => parseCanonicalJSON('{ "v":1}'));
});

test('summary includes only selected complete Big Five means, with strict ingress precedence', () => {
  const state = complete();
  const token = encodeSummary(state, ['N', 'O']);
  const summary = decodeSummary(token);
  assert.deepEqual(summary.m, [['O', 300], ['N', 300]]);
  assert.equal(readIngress(`https://example.test/?r=${token}`).kind, 'summary');
  assert.equal(readIngress('https://example.test/#reflect').kind, 'none');
  state.responses[0] = null;
  assert.throws(() => encodeSummary(state, ['N']));
  assert.doesNotThrow(() => encodeSummary(state, ['O']));
  assert.throws(() => encodeSummary(state, []));
  const snapshot = encodeSnapshot(complete());
  for (const url of [`https://example.test/?s=${snapshot}`, `https://example.test/?r=${token}&r=${token}`,
    `https://example.test/?r=${token}#s=${snapshot}`, `https://example.test/#s=${snapshot}&x=1`,
    `https://example.test/#s=${snapshot}&s=${snapshot}`]) assert.throws(() => readIngress(url));
  const invalid = unpackJSON(token); invalid.m = [['O', 501]]; assert.throws(() => decodeSummary(repackJSON(invalid)));
});

test('release inventory hashes match current public files', async () => {
  for (const [file, hash] of Object.entries(RELEASE.assets)) {
    const bytes = await readFile(new URL(`../website/assets/personality/v1/${file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, `Stale release asset: ${file}; regenerate the development manifest before testing.`);
  }
});

test('memory-only backup serialization retains original state and pinned releases', () => {
  const state = complete(), text = serializeBackup(state), backup = parseCanonicalJSON(text);
  assert.deepEqual(backup.state, state);
  assert.deepEqual(backup.releases, RELEASE.releases);
  assert.equal(backup.kind, 'big-six-seven-local-backup');
  assert(!Object.hasOwn(backup, 'id'));
});

storageTest('committed answer, cursor and active pointer survive reopening', async () => {
  const name = `personality-test-${crypto.randomUUID()}`;
  let store = await openStore({name});
  const record = await store.create(createState());
  const state = complete(); state.cursor = {module: 'interests', slot: 132}; state.view = 'assessment';
  const saved = await store.save(record.id, record.revision, state);
  state.responses[0] = 5; // caller mutation after commit cannot alter durable data
  store.close(); store = await openStore({name});
  const restored = await store.loadActive();
  assert.equal(restored.id, record.id); assert.equal(restored.revision, 2);
  assert.deepEqual(restored.state, saved.state); assert.equal(restored.state.responses[0], 3);
  store.close();
});

storageTest('concurrent tabs use CAS: exactly one write commits and stale state cannot overwrite it', async () => {
  const name = `personality-test-${crypto.randomUUID()}`, a = await openStore({name}), b = await openStore({name});
  const original = await a.create(createState());
  const first = complete(), second = complete(); first.responses[0] = 1; second.responses[0] = 5;
  first.cursor = {module: 'big5', slot: 1}; second.cursor = {module: 'big5', slot: 2};
  const outcomes = await Promise.allSettled([a.save(original.id, 1, first), b.save(original.id, 1, second)]);
  assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
  const rejected = outcomes.find(item => item.status === 'rejected'); assert(rejected.reason instanceof ConflictError);
  const winner = outcomes.find(item => item.status === 'fulfilled').value;
  assert.deepEqual((await b.loadActive()).state, winner.state);
  assert.equal((await a.list()).length, 1); a.close(); b.close();
});

storageTest('incoming URL is read-only until explicit fork; backup/import and deletion retain other drafts', async () => {
  const store = await openStore({name: `personality-test-${crypto.randomUUID()}`});
  const original = await store.create(createState());
  const snapshot = decodeSnapshot(encodeSnapshot(complete()));
  assert.equal((await store.loadActive()).id, original.id);
  const fork = await store.fork(snapshot);
  assert.notEqual(fork.id, original.id); assert.equal((await store.list()).length, 2);
  const text = await store.exportJSON(fork.id), imported = await store.importJSON(text);
  assert.notEqual(imported.id, fork.id); assert.deepEqual(imported.state, fork.state);
  assert.equal((await store.list()).length, 3);
  await assert.rejects(() => store.importJSON(text.replace('big-six-seven-local-backup', 'unknown')));
  assert.equal((await store.list()).length, 3);
  await store.remove(imported.id); assert.equal((await store.list()).length, 2);
  await store.remove(fork.id); assert.equal((await store.loadActive()).id, original.id);
  await assert.rejects(() => store.save(fork.id, 1, snapshot));
  store.close();
});

storageTest('library activation and bounded device preferences persist without overwriting drafts', async () => {
  const name = `personality-test-${crypto.randomUUID()}`;
  let store = await openStore({name});
  const a = await store.create(createState()), b = await store.create(complete());
  assert.equal((await store.loadActive()).id, b.id);
  assert.deepEqual(await store.load(a.id), a);
  await store.activate(a.id);
  await store.setPreference('audioEnabled', false);
  await store.setPreference('sidebarOpen', true);
  await assert.rejects(() => store.setPreference('activeDraftId', b.id));
  await assert.rejects(() => store.setPreference('oversized', 'x'.repeat(513)));
  await assert.rejects(() => store.setPreference('object', {answer: 5}));
  store.close(); store = await openStore({name});
  assert.equal((await store.loadActive()).id, a.id);
  assert.equal(await store.getPreference('audioEnabled'), false);
  assert.equal(await store.getPreference('sidebarOpen'), true);
  assert.equal((await store.list()).length, 2);
  store.close();
});

storageTest('unknown reflection IDs and mismatched releases cannot enter durable state through backups', async () => {
  const store = await openStore({name: `personality-test-${crypto.randomUUID()}`});
  const original = await store.create(complete());
  const unknown = complete(); unknown.blocks = ['unavailable-reflection'];
  await assert.rejects(() => store.create(unknown), /reflection/i);
  await assert.rejects(() => store.save(original.id, original.revision, unknown), /reflection/i);
  const invalidBackup = JSON.parse(serializeBackup(unknown));
  await assert.rejects(() => store.importJSON(JSON.stringify(invalidBackup)), /reflection/i);
  const wrongRelease = JSON.parse(serializeBackup(complete()));
  wrongRelease.releases.scoring[1] = '0'.repeat(64);
  await assert.rejects(() => store.importJSON(JSON.stringify(wrongRelease)), /release/i);
  assert.equal((await store.list()).length, 1);
  assert.deepEqual(await store.loadActive(), original);
  const valid = complete(); valid.blocks = RELEASE.blockIds.slice(0, 2).sort();
  const saved = await store.save(original.id, original.revision, valid);
  assert.deepEqual(saved.state.blocks, valid.blocks);
  store.close();
});
