#!/usr/bin/env node
// Published v1 through v4 and optional ai/v1 are immutable. Generate v5 only.
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {releaseSource} from '../website/assets/personality/v5/release-format.mjs';

const assetsRoot = fileURLToPath(new URL('../website/assets/personality/', import.meta.url));
const lockURL = new URL('./personality-published-releases.json', import.meta.url);
const digest = value => createHash('sha256').update(value).digest('hex');
const ordered = (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
export async function inventory(directory, prefix = '') {
  const result = {};
  for (const entry of (await readdir(directory, {withFileTypes: true})).sort(ordered)) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(result, await inventory(path.join(directory, entry.name), `${relative}/`));
    else if (entry.isFile()) result[relative] = digest(await readFile(path.join(directory, entry.name)));
    else throw new Error(`Unexpected non-file in public release: ${relative}`);
  }
  return result;
}

export async function verifyPublishedReleases() {
  const lock = JSON.parse(await readFile(lockURL, 'utf8'));
  for (const [name, expected] of Object.entries(lock.roots)) {
    const files = await inventory(path.join(assetsRoot, name));
    if (digest(JSON.stringify(files)) !== expected.treeSha256) {
      throw new Error(`Published ${name} bytes changed. Restore the immutable release and publish changes under a new version directory.`);
    }
    if (files[expected.manifest] !== expected.manifestSha256) throw new Error(`Published ${name} manifest changed.`);
  }
  return lock;
}

export async function generatePresentationRelease({allowIncomplete = false} = {}) {
  await verifyPublishedReleases();
  const {RELEASE: base} = await import('../website/assets/personality/v1/release.mjs');
  const {RELEASE: previous} = await import('../website/assets/personality/v4/release.mjs');
  const {RELEASE: prior} = await import('../website/assets/personality/v3/release.mjs');
  const {RELEASE: earlier} = await import('../website/assets/personality/v2/release.mjs');
  const root = path.join(assetsRoot, 'v5');
  const current = await inventory(root);
  delete current['release.mjs'];
  const required = ['app.mjs', 'bootstrap.mjs', 'style.css', 'report.mjs', 'report-kit.mjs', 'report-kit-ui.mjs', 'report-kit-store.mjs', 'offline.mjs', 'sw.js', 'release-format.mjs'];
  const missing = required.filter(file => !Object.hasOwn(current, file));
  if (missing.length && !allowIncomplete) throw new Error(`Presentation release incomplete: ${missing.join(', ')}`);
  const baseManifest = await readFile(path.join(assetsRoot, 'v1/release.mjs'));
  const previousManifest = await readFile(path.join(assetsRoot, 'v4/release.mjs'));
  const priorManifest = await readFile(path.join(assetsRoot, 'v3/release.mjs'));
  const earlierManifest = await readFile(path.join(assetsRoot, 'v2/release.mjs'));
  const assets = Object.fromEntries([
    ...Object.entries(previous.assets),
    ['/assets/personality/v4/release.mjs', digest(previousManifest)],
    ...Object.entries(current).map(([name, hash]) => [`/assets/personality/v5/${name}`, hash]),
  ].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  const release = {
    v: 5,
    presentation: 'unified-atlas-v5',
    legacy: {root: '/assets/personality/v1/', manifestSha256: digest(baseManifest), releaseDigest: digest(JSON.stringify(base))},
    previousReleases: [
      {v: 4, root: '/assets/personality/v4/', manifestSha256: digest(previousManifest), releaseDigest: digest(JSON.stringify(previous))},
      {v: 3, root: '/assets/personality/v3/', manifestSha256: digest(priorManifest), releaseDigest: digest(JSON.stringify(prior))},
      {v: 2, root: '/assets/personality/v2/', manifestSha256: digest(earlierManifest), releaseDigest: digest(JSON.stringify(earlier))},
    ],
    // State, scoring, exact links and IDB records retain the live v1 identities.
    releases: base.releases,
    ready: base.ready && missing.length === 0,
    assets,
  };
  await writeFile(path.join(root, 'release.mjs'), releaseSource(release));
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--allow-incomplete', '--verify-published'].includes(arg))) throw new Error('Unknown release argument.');
  if (args.includes('--verify-published')) {
    await verifyPublishedReleases();
    console.log('Published v1, ai/v1, v2, v3, and v4 bytes verified unchanged.');
  } else {
    const release = await generatePresentationRelease({allowIncomplete: args.includes('--allow-incomplete')});
    console.log(`Personality v5 presentation: ${Object.keys(release.assets).length} public assets; ${release.ready ? 'complete' : 'incomplete development manifest'}. Published releases unchanged.`);
  }
}
