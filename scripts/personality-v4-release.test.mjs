import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyPublishedReleases} from './personality-release.mjs';
import {RELEASE as legacy} from '../website/assets/personality/v1/release.mjs';
import {RELEASE as previous} from '../website/assets/personality/v3/release.mjs';
import {RELEASE as earlier} from '../website/assets/personality/v2/release.mjs';
import {RELEASE as current} from '../website/assets/personality/v4/release.mjs';
import {decodeSnapshot, encodeSnapshot, decodeSummary, encodeSummary} from '../website/assets/personality/v1/share.mjs';
import {score} from '../website/assets/personality/v1/core.mjs';
import {createReport} from '../website/assets/personality/v1/report.mjs';
import {presentationForURL, bootPresentation} from '../website/assets/personality/v4/bootstrap.mjs';
import {releaseSource} from '../website/assets/personality/v4/release-format.mjs';
import {parsePresentationRegistry, parseRegistry} from './personality-live-smoke.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = JSON.parse(await readFile(new URL('./personality-v1-compatibility-fixture.json', import.meta.url), 'utf8'));

test('published v1, optional AI, v2, and v3 bytes match their immutable release locks', async () => {
  const lock = await verifyPublishedReleases();
  assert.equal(lock.publishedCommit, 'c5517f5c0613657dfbb76951adeb8deb917bd191');
  assert.deepEqual(Object.keys(lock.roots), ['v1', 'ai/v1', 'v2', 'v3', 'v4', 'v5', 'v6']);
});

test('published synthetic snapshots and canonical report content survive the presentation upgrade', () => {
  const state = decodeSnapshot(fixture.snapshot);
  assert.equal(state.responses.length, 170);
  assert.equal(encodeSnapshot(state), fixture.snapshot);
  assert.equal(encodeSummary(state, ['O', 'C', 'E', 'A', 'N']), fixture.summary);
  assert.equal(decodeSummary(fixture.summary).m.length, 5);
  assert.equal(hash(JSON.stringify(createReport(state, score(state)))), fixture.reportSha256);
  assert.deepEqual(current.releases, legacy.releases);
});

test('v4 inventory includes exact legacy assets and no model runtime or respondent lookup paths', async () => {
  assert.equal(current.v, 4);
  assert.equal(current.presentation, 'workplace-report-v4');
  assert.equal(current.previousReleases[0].releaseDigest, hash(JSON.stringify(previous)));
  assert.equal(current.ready, true);
  assert.equal(current.legacy.releaseDigest, hash(JSON.stringify(legacy)));
  const manifest = await readFile(new URL('../website/assets/personality/v1/release.mjs', import.meta.url));
  assert.equal(current.legacy.manifestSha256, hash(manifest));
  for (const [path, digest] of Object.entries(legacy.assets)) {
    assert.equal(current.assets[`/assets/personality/v1/${path}`], digest);
  }
  assert.equal(current.assets['/assets/personality/v1/release.mjs'], hash(manifest));
  const priorManifest = await readFile(new URL('../website/assets/personality/v3/release.mjs', import.meta.url));
  assert.equal(current.previousReleases[0].manifestSha256, hash(priorManifest));
  assert.equal(current.assets['/assets/personality/v3/release.mjs'], hash(priorManifest));
  for (const [path, digest] of Object.entries(previous.assets)) assert.equal(current.assets[path], digest);
  assert.deepEqual(current.previousReleases.map(release => release.v), [3, 2]);
  assert.equal(current.previousReleases[1].releaseDigest, hash(JSON.stringify(earlier)));
  assert.equal(current.previousReleases[1].manifestSha256, current.assets['/assets/personality/v2/release.mjs']);
  for (const [path, digest] of Object.entries(current.assets)) {
    assert.match(path, /^\/assets\/personality\/v[1234]\/[A-Za-z0-9._/-]+$/);
    assert(!path.includes('..') && !path.includes('/ai/'));
    const bytes = await readFile(new URL(`../website${path}`, import.meta.url));
    assert.equal(hash(bytes), digest, `Stale presentation asset ${path}; generate v4 manifest after final edits.`);
  }
});

test('the entry point selects only hardcoded presentations and does not accept malformed packets', async () => {
  for (const suffix of [`#s=${fixture.snapshot}`, `#r=${fixture.summary}`, `?r=${fixture.summary}`, '#e=malformed', '#s=malformed', '?s=not-allowed', '?e=not-allowed', '#s=x&r=y']) {
    assert.equal(presentationForURL('https://engmanager.xyz/personality/report' + suffix), 'v1');
  }
  assert.throws(() => decodeSnapshot('malformed'));
  for (const suffix of ['', '#section', '?utm_source=example']) {
    assert.equal(presentationForURL('https://engmanager.xyz/personality/report' + suffix), 'v4');
  }
  const style = {media: 'not all'}, body = {dataset: {}}, versions = [];
  const document = {body, getElementById: () => style};
  await bootPresentation('https://engmanager.xyz/personality/report', {document, load: async version => versions.push(version)});
  assert.equal(style.media, 'all');
  assert.equal(body.dataset.personalityPresentation, 'v4');
  await bootPresentation('https://engmanager.xyz/personality/report#s=' + fixture.snapshot, {document, load: async version => versions.push(version)});
  assert.equal(style.media, 'not all');
  assert.equal(body.dataset.personalityPresentation, 'v1');
  assert.deepEqual(versions, ['v4', 'v1']);
});

test('deployment verifier parses only the known data wrapper and rejects unsafe release paths', () => {
  assert.deepEqual(parseRegistry(releaseSource(legacy)), legacy);
  assert.deepEqual(parsePresentationRegistry(releaseSource(current)), current);
  assert.deepEqual(parsePresentationRegistry(releaseSource(previous)), previous);
  assert.throws(() => parsePresentationRegistry(releaseSource(current) + 'globalThis.untrusted = true;'));
  for (const unsafe of ['https://other.test/app.mjs', '/assets/personality/v4/../v1/app.mjs', '/assets/personality/v4/app.mjs?answer=5']) {
    const changed = structuredClone(current);
    changed.assets[unsafe] = 'a'.repeat(64);
    assert.throws(() => parsePresentationRegistry(releaseSource(changed)));
  }
  for (const change of [value => {value.v = '4';}, value => value.previousReleases.reverse(), value => value.previousReleases.pop(), value => {value.previousReleases[0].v = 2;}, value => {value.previousReleases[1].root = 'https://other.test/';}]) {
    const changed = structuredClone(current); change(changed);
    assert.throws(() => parsePresentationRegistry(releaseSource(changed)));
  }
  for (const old of [previous, earlier]) {
    const changed = structuredClone(old); changed.assets['/assets/personality/v4/app.mjs'] = 'a'.repeat(64);
    assert.throws(() => parsePresentationRegistry(releaseSource(changed)));
  }
  const incomplete = structuredClone(current);
  delete incomplete.assets['/assets/personality/v1/core.mjs'];
  assert.throws(() => parsePresentationRegistry(releaseSource(incomplete)));
});
