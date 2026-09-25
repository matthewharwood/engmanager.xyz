import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openDB} from '../website/assets/personality/v1/vendor/idb.mjs';
import {openStore} from '../website/assets/personality/v1/store.mjs';
import {createState, score} from '../website/assets/personality/v1/core.mjs';
import {decodeSnapshot} from '../website/assets/personality/v1/share.mjs';
import {ATLAS_BANK as legacyBank} from '../website/assets/personality/v6/atlas-bank.mjs';
import {emptyStory as legacyEmpty, loadStory as legacyLoad, saveStory as legacySave} from '../website/assets/personality/v6/story-store.mjs';
import {RELEASE as legacyRelease} from '../website/assets/personality/v6/release.mjs';
import {ATLAS_BANK} from '../website/assets/personality/v7/atlas-bank.mjs';
import {typeProfile} from '../website/assets/personality/v7/atlas-model.mjs';
import {emptyStory, validateStory, loadStory, saveStory} from '../website/assets/personality/v7/story-store.mjs';
import {createTarotDraw} from '../website/assets/personality/v7/story-core.mjs';
import {createReportKit} from '../website/assets/personality/v7/report-kit.mjs';
import {presentationForURL} from '../website/assets/personality/v7/bootstrap.mjs';
import {RELEASE} from '../website/assets/personality/v7/release.mjs';
import {verifyPublishedReleases} from './personality-release.mjs';

const read = async (version, name) => JSON.parse(await readFile(new URL(`../website/assets/personality/${version}/data/${name}.json`, import.meta.url), 'utf8'));
const sources = Object.fromEntries(await Promise.all([
  ['bank', 'background-questionnaire'], ['countries', 'countries'], ['deck', 'tarot-deck'],
].map(async ([key, name]) => [key, await read('v7', name)])));
const legacySources = {...sources, bank: await read('v6', 'background-questionnaire')};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const oldItem = 'type-candidate-ei-12', revisedItem = `${oldItem}-v2`;

async function database(run) {
  const databaseName = `prepare-v7-${crypto.randomUUID()}`;
  const store = await openStore({name: databaseName});
  const db = await openDB(databaseName, 1);
  try { await run({store, db, databaseName}); }
  finally {
    db.close();store.close();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = resolve;request.onerror = () => reject(request.error);
    });
  }
}

test('v7 publishes new immutable URLs while retaining the complete frozen v6 release', async () => {
  await verifyPublishedReleases();
  assert.equal(RELEASE.v, 7);
  assert.equal(RELEASE.previousReleases[0].v, 6);
  assert.equal(RELEASE.previousReleases[0].releaseDigest, hash(JSON.stringify(legacyRelease)));
  assert.equal(presentationForURL('https://engmanager.xyz/personality/prepare'), 'v7');
  for (const parameter of ['s', 'r', 'e']) {
    assert.equal(presentationForURL(`https://engmanager.xyz/personality/report#${parameter}=malformed`), 'v1');
    assert.equal(presentationForURL(`https://engmanager.xyz/personality/report?${parameter}=malformed`), 'v1');
  }
  for (const [path, digest] of Object.entries(RELEASE.assets)) {
    assert.equal(hash(await readFile(new URL(`../website${path}`, import.meta.url))), digest, `stale release asset: ${path}`);
  }
  for (const [path, digest] of Object.entries(legacyRelease.assets)) assert.equal(RELEASE.assets[path], digest, `legacy asset lost: ${path}`);
});

test('the revised preference item has a new identity and leaves the other 47 responses unchanged', () => {
  assert.equal(ATLAS_BANK.typeItems.length, 48);
  assert(!ATLAS_BANK.typeItems.some(item => item.id === oldItem));
  const revised = ATLAS_BANK.typeItems.find(item => item.id === revisedItem);
  const original = legacyBank.typeItems.find(item => item.id === oldItem);
  assert(revised);
  assert.notEqual(revised.wording, original.wording);
  assert.deepEqual({key: revised.key, scale: revised.scale}, {key: original.key, scale: original.scale});
  assert.equal(ATLAS_BANK.axes.EI.items.filter(item => item.itemId === revisedItem).length, 1);
  for (const old of legacyBank.typeItems.filter(item => item.id !== oldItem)) {
    assert.deepEqual(ATLAS_BANK.typeItems.find(item => item.id === old.id), old);
  }
  const value = emptyStory();value.type[oldItem] = 4;
  assert.throws(() => validateStory(value, sources), /preference/);
});

test('migration preserves the frozen v6 row and only removes the answer to the changed question', async () => {
  await database(async ({store, db, databaseName}) => {
    const draft = await store.create(createState());
    const value = legacyEmpty();
    value.background.bg01 = {status: 'answered', selected: ['o03']};
    value.background.bg04 = {status: 'answered', selected: ['o10'], selfDescription: 'Fictional background for a migration test'};
    value.background.bg34 = {status: 'answered', selected: ['o02']};
    value.birthday = '1990-09-10';value.draw = createTarotDraw(sources.deck);
    value.type = Object.fromEntries(legacyBank.typeItems.map(item => [item.id, item.key === 1 ? 5 : 1]));
    const old = await legacySave(draft.id, 0, value, legacySources, {databaseName});
    const original = await db.get('notes', `story-atlas:${draft.id}`);
    const migrated = await loadStory(draft.id, sources, {databaseName});
    assert.equal(migrated.revision, 0);
    assert.equal(migrated.migrated, true);
    assert.equal(migrated.revisedQuestion, true);
    const expected = structuredClone(value);delete expected.type[oldItem];
    assert.deepEqual(migrated.value, expected);
    assert.equal(Object.keys(migrated.value.type).length, 47);
    assert.equal(typeProfile(migrated.value.type).code, null);
    assert.equal(await db.get('notes', `story-atlas-v2:${draft.id}`), undefined, 'reading a migration must not write');
    assert.deepEqual(await db.get('notes', `story-atlas:${draft.id}`), original);

    migrated.value.background.bg04.selfDescription = 'A'.repeat(255);
    migrated.value.type[revisedItem] = 4;
    const saved = await saveStory(draft.id, 0, migrated.value, sources, {databaseName});
    assert.equal(saved.revision, 1);
    assert.equal((await db.get('notes', `story-atlas-v2:${draft.id}`)).kind, 'story-atlas-v2');
    assert.equal((await loadStory(draft.id, sources, {databaseName})).migrated, false);
    assert.deepEqual((await loadStory(draft.id, sources, {databaseName})).value, migrated.value);
    assert.deepEqual(await db.get('notes', `story-atlas:${draft.id}`), original, 'v7 edits cannot overwrite the v6 row');
    assert.deepEqual(await legacyLoad(draft.id, legacySources, {databaseName}), old, 'the frozen v6 reader still opens its original value');
    assert.deepEqual((await store.load(draft.id)).state, draft.state, 'story migration cannot alter scored answers');
    await assert.rejects(saveStory(draft.id, 0, migrated.value, sources, {databaseName}), /another tab/);
    await store.remove(draft.id);
    assert.equal(await db.get('notes', `story-atlas:${draft.id}`), undefined);
    assert.equal(await db.get('notes', `story-atlas-v2:${draft.id}`), undefined);
    await assert.rejects(loadStory(draft.id, sources, {databaseName}), /no longer exists/);
  });
});

test('legacy drafts without the changed answer migrate without claiming an answer was removed', async () => {
  await database(async ({store, databaseName}) => {
    const draft = await store.create(createState());
    const value = legacyEmpty();value.background.bg34 = {status: 'answered', selected: ['o03']};
    await legacySave(draft.id, 0, value, legacySources, {databaseName});
    const migrated = await loadStory(draft.id, sources, {databaseName});
    assert.equal(migrated.migrated, true);
    assert.equal(migrated.revisedQuestion, false);
    assert.deepEqual(migrated.value, value);
  });
});

test('self-description bounds accept 255 characters, reject 256, and keep the complete report evidence', async () => {
  const value = emptyStory();
  value.background.bg04 = {status: 'answered', selected: ['o10'], selfDescription: 'Fictional context '.padEnd(255, 'x')};
  assert.doesNotThrow(() => validateStory(value, sources));
  const fixture = JSON.parse(await readFile(new URL('./personality-v1-compatibility-fixture.json', import.meta.url), 'utf8'));
  const state = decodeSnapshot(fixture.snapshot), before = score(state);
  const kit = createReportKit(state, {name: 'Synthetic Person', story: {value, sources}});
  assert.equal(kit.data.story.context.find(item => item.id === 'bg04').selfDescription, value.background.bg04.selfDescription);
  assert.deepEqual(score(state), before);
  value.background.bg04.selfDescription += 'x';
  assert.throws(() => validateStory(value, sources), /self-description/);
  await database(async ({store, databaseName}) => {
    const draft = await store.create(createState());
    await assert.rejects(saveStory(draft.id, 0, value, sources, {databaseName}), /self-description/);
    assert.equal((await loadStory(draft.id, sources, {databaseName})).revision, 0);
  });
});
