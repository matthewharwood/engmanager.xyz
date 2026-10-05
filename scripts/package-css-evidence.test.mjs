import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./package-css-evidence.mjs', import.meta.url));
const BODY = Buffer.from('raw body \u00a0\r\nno rewrite\n');
const NATIVE = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0]);
const WASM = Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function runCli(args, { passes = true, message } = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, passes ? 0 : 1, result.stderr || result.stdout);
  if (message) assert.match(result.stderr, message);
  return result;
}

async function fixture(t) {
  // macOS's temporary-directory aliases may contain symlinks; the CLI rejects them.
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'css-evidence-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'capture');
  const output = path.join(root, 'package');
  const binary = path.join(source, 'website');
  const freeze = path.join(root, 'freeze.json');
  await fs.mkdir(source);
  await fs.mkdir(path.join(source, 'empty'));
  await fs.mkdir(path.join(source, 'nested'));
  await fs.writeFile(path.join(source, 'body.html'), BODY);
  await fs.writeFile(path.join(source, 'nested', 'style.css'), 'body { color: red; }\r\n');
  await fs.writeFile(binary, NATIVE);
  await fs.writeFile(path.join(source, 'evidence.wasm'), WASM);
  await fs.writeFile(path.join(source, 'screenshot.png'), PNG);
  const reportBytes = Buffer.from(`${JSON.stringify({
    schemaVersion: 2,
    harnessSha256: 'a'.repeat(64),
    probeContractSha256: 'b'.repeat(64),
    scope: { native: false },
    variants: [{ label: 'candidate', directory: source }],
  }, null, 2).replaceAll('\n', '\r\n')}\r\n`);
  const freezeBytes = Buffer.from(`${JSON.stringify({
    binary,
    binarySha256: createHash('sha256').update(NATIVE).digest('hex'),
    generation: 'c'.repeat(64),
    mode: 'compact',
    compiledProjectSha256: 'd'.repeat(64),
    sourceSha256: { 'website/src/main.rs': 'e'.repeat(64) },
  }, null, 2)}\n`);
  await fs.writeFile(path.join(source, 'report.json'), reportBytes);
  await fs.writeFile(freeze, freezeBytes);
  const inputs = ['--input', `capture=${source}`, '--input', `freeze=${freeze}`, '--input', `explicit-binary=${binary}`];
  const packageIt = () => runCli([...inputs, '--output', output]);
  const readManifest = async () => JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
  return { root, source, output, binary, freeze, inputs, packageIt, readManifest, reportBytes, freezeBytes };
}

test('CLI help describes labeled inputs and package verification', () => {
  const result = runCli(['--help']);
  assert.match(result.stdout, /--input LABEL=PATH/);
  assert.match(result.stdout, /--verify PATH/);
});

test('packaging preserves raw bytes, stable paths, hashes, and report/freeze provenance', async t => {
  const f = await fixture(t);
  f.packageIt();
  const manifest = await f.readManifest();
  assert.deepEqual(await fs.readFile(path.join(f.output, 'evidence/capture/body.html')), BODY);
  assert.deepEqual(await fs.readFile(path.join(f.output, 'evidence/capture/report.json')), f.reportBytes);
  assert.deepEqual(await fs.readFile(path.join(f.output, 'evidence/freeze/freeze.json')), f.freezeBytes);
  assert.equal((await fs.stat(path.join(f.output, 'evidence/capture/empty'))).isDirectory(), true);
  const body = manifest.files.find(file => file.path === 'evidence/capture/body.html');
  assert.equal(body.bytes, BODY.length);
  assert.equal(body.sha256, createHash('sha256').update(BODY).digest('hex'));
  assert.equal(manifest.fileCount, manifest.files.length);
  assert.equal(manifest.totalBytes, manifest.files.reduce((sum, file) => sum + file.bytes, 0));
  assert.equal(manifest.sources.find(source => source.label === 'capture').input, f.source);
  const capture = manifest.provenance.find(record => record.kind === 'capture');
  assert.equal(capture.path, 'evidence/capture/report.json');
  assert.equal(capture.harnessSha256, 'a'.repeat(64));
  assert.equal(capture.probeContractSha256, 'b'.repeat(64));
  assert.equal(capture.variants[0].directory, f.source);
  const freeze = manifest.provenance.find(record => record.kind === 'freeze');
  assert.equal(freeze.binary, f.binary);
  assert.equal(freeze.binarySha256, createHash('sha256').update(NATIVE).digest('hex'));
  assert.equal(freeze.generation, 'c'.repeat(64));
  assert.equal(freeze.sourceHashCount, 1);
});

test('directory binaries are recorded as omissions while explicit binaries, WASM, and images are retained', async t => {
  const f = await fixture(t);
  f.packageIt();
  const manifest = await f.readManifest();
  assert.deepEqual(manifest.sources.find(source => source.label === 'capture').omissions, [
    { relativePath: 'website', bytes: NATIVE.length, reason: 'native-binary' },
  ]);
  assert.equal(manifest.files.some(file => file.path === 'evidence/capture/website'), false);
  await assert.rejects(fs.stat(path.join(f.output, 'evidence/capture/website')), { code: 'ENOENT' });
  assert.deepEqual(await fs.readFile(path.join(f.output, 'evidence/explicit-binary/website')), NATIVE);
  assert.deepEqual(await fs.readFile(path.join(f.output, 'evidence/capture/evidence.wasm')), WASM);
  assert.deepEqual(await fs.readFile(path.join(f.output, 'evidence/capture/screenshot.png')), PNG);
});

test('verification works after the original sources are removed', async t => {
  const f = await fixture(t);
  f.packageIt();
  await fs.rm(f.source, { recursive: true });
  await fs.unlink(f.freeze);
  const result = runCli(['--verify', f.output]);
  assert.match(result.stdout, /Verified \d+ files/);
});

test('verification rejects changed bytes even when the file length stays the same', async t => {
  const f = await fixture(t);
  f.packageIt();
  const changed = Buffer.from(BODY);
  changed[0] ^= 1;
  await fs.writeFile(path.join(f.output, 'evidence/capture/body.html'), changed);
  runCli(['--verify', f.output], { passes: false, message: /Packaged bytes do not match manifest/ });
});

test('verification rejects an unlisted file', async t => {
  const f = await fixture(t);
  f.packageIt();
  await fs.writeFile(path.join(f.output, 'unexpected'), 'extra');
  runCli(['--verify', f.output], { passes: false, message: /Unexpected packaged file/ });
});

test('a symlink input root is rejected before creating output', async t => {
  const f = await fixture(t);
  const link = path.join(f.root, 'linked-input');
  await fs.symlink(f.source, link);
  runCli(['--input', `linked=${link}`, '--output', f.output], { passes: false, message: /Symlink path is forbidden/ });
  await assert.rejects(fs.stat(f.output), { code: 'ENOENT' });
});

test('a symlink within an input directory is rejected before creating output', async t => {
  const f = await fixture(t);
  await fs.symlink(path.join(f.source, 'body.html'), path.join(f.source, 'nested', 'linked-body'));
  runCli([...f.inputs, '--output', f.output], { passes: false, message: /Symlink path is forbidden/ });
  await assert.rejects(fs.stat(f.output), { code: 'ENOENT' });
});

test('an existing output directory is left intact', async t => {
  const f = await fixture(t);
  await fs.mkdir(f.output);
  const marker = path.join(f.output, 'keep');
  await fs.writeFile(marker, 'existing evidence');
  runCli([...f.inputs, '--output', f.output], { passes: false, message: /Output already exists/ });
  assert.equal(await fs.readFile(marker, 'utf8'), 'existing evidence');
  assert.deepEqual(await fs.readdir(f.output), ['keep']);
});

test('an existing symlink output and its target are left intact', async t => {
  const f = await fixture(t);
  const target = path.join(f.root, 'existing-target');
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'keep'), 'existing evidence');
  await fs.symlink(target, f.output);
  runCli([...f.inputs, '--output', f.output], { passes: false, message: /Output already exists/ });
  assert.equal(await fs.readlink(f.output), target);
  assert.equal(await fs.readFile(path.join(target, 'keep'), 'utf8'), 'existing evidence');
  assert.deepEqual(await fs.readdir(target), ['keep']);
});

test('verification rejects a constructed traversal path in the manifest', async t => {
  const f = await fixture(t);
  f.packageIt();
  const outside = path.join(f.root, 'outside.html');
  await fs.writeFile(outside, BODY);
  const manifest = await f.readManifest();
  manifest.files.find(file => file.path === 'evidence/capture/body.html').path = '../outside.html';
  await fs.writeFile(path.join(f.output, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  runCli(['--verify', f.output], { passes: false, message: /Unsafe relative path/ });
  assert.deepEqual(await fs.readFile(outside), BODY);
});

test('verification rejects a packaged symlink even when its target has matching bytes', async t => {
  const f = await fixture(t);
  f.packageIt();
  const filename = path.join(f.output, 'evidence/capture/body.html');
  await fs.unlink(filename);
  await fs.symlink(path.join(f.source, 'body.html'), filename);
  runCli(['--verify', f.output], { passes: false, message: /Symlink path is forbidden/ });
  assert.deepEqual(await fs.readFile(path.join(f.source, 'body.html')), BODY);
});

test('an output inside an input is rejected without changing that input', async t => {
  const f = await fixture(t);
  const nestedOutput = path.join(f.source, 'new-package');
  const before = await fs.readdir(f.source);
  runCli([...f.inputs, '--output', nestedOutput], { passes: false, message: /Inputs and output must not overlap/ });
  await assert.rejects(fs.stat(nestedOutput), { code: 'ENOENT' });
  assert.deepEqual(await fs.readdir(f.source), before);
  assert.deepEqual(await fs.readFile(path.join(f.source, 'body.html')), BODY);
});
