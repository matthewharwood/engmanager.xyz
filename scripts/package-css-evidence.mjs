#!/usr/bin/env node
// Package explicitly selected CSS evidence without changing artifact bytes.
import { createHash } from 'node:crypto';
import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORMAT = 'engmanager-css-evidence';
const MANIFEST = 'manifest.json';
const HELP = `Usage:
  node scripts/package-css-evidence.mjs --input LABEL=PATH [--input LABEL=PATH ...] --output PATH
  node scripts/package-css-evidence.mjs --verify PATH

Each input is one explicitly selected directory or file. Unique labels give
stable paths: evidence/LABEL/relative/path or evidence/LABEL/file-basename.
PATH may be relative; all path components must be real, with no symlinks.
On macOS, use /private/tmp instead of the /tmp symlink.

The output directory must not exist, and its parent must already exist.
Directory inputs omit native executable/library/object binaries (ELF,
Mach-O, PE, and ar archives). Explicit file inputs include any regular file.
Images, compressed traces, and WebAssembly evidence remain included.
Symlinks and special files fail rather than being followed or omitted.

The manifest records source paths, tool and report/freeze provenance,
omissions, and SHA-256/byte counts. Raw JSON references stay unchanged;
source-to-package mappings live in the manifest. Verification needs only
the package, rejects unexpected files, and never reads original sources.
An interrupted/failed copy leaves an incomplete output; it is never replaced.
`;

function fail(message) {
  throw new Error(message);
}

function argumentsFor(argv) {
  const options = { inputs: [] };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    const separator = argument.indexOf('=');
    const flag = separator < 0 ? argument : argument.slice(0, separator);
    if (!['--input', '--output', '--verify'].includes(flag)) fail(`Unknown argument: ${argument}`);
    const value = separator < 0 ? argv[++index] : argument.slice(separator + 1);
    if (!value || value.startsWith('--')) fail(`Missing value for ${flag}`);
    if (flag === '--input') {
      const equal = value.indexOf('=');
      const label = value.slice(0, equal);
      if (equal < 1 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(label) || !value.slice(equal + 1)) {
        fail('--input requires LABEL=PATH; labels use letters, digits, dots, underscores, or hyphens');
      }
      if (options.inputs.some(input => input.label.toLowerCase() === label.toLowerCase())) {
        fail(`Duplicate input label: ${label}`);
      }
      options.inputs.push({ label, input: path.resolve(value.slice(equal + 1)) });
    } else {
      const key = flag.slice(2);
      if (options[key]) fail(`Repeated ${flag}`);
      options[key] = path.resolve(value);
    }
  }
  if (options.verify) {
    if (options.output || options.inputs.length) fail('--verify cannot be combined with --input or --output');
  } else if (!options.output || !options.inputs.length) {
    fail('Packaging requires at least one --input and a separate --output; see --help');
  }
  return options;
}

function signature(stat) {
  return [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
}

// Check ancestors as well as the leaf. O_NOFOLLOW additionally protects file opens.
async function checkedPath(absolute) {
  const { root } = path.parse(absolute);
  let current = root;
  const parts = path.relative(root, absolute).split(path.sep).filter(Boolean);
  let stat = await fs.lstat(root, { bigint: true });
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    stat = await fs.lstat(current, { bigint: true });
    if (stat.isSymbolicLink()) fail(`Symlink path is forbidden: ${current}`);
    if (index < parts.length - 1 && !stat.isDirectory()) fail(`Non-directory ancestor: ${current}`);
  }
  return stat;
}

function relativeName(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\')) {
    fail(`Unsafe relative path: ${value}`);
  }
  if (value.split('/').some(part => !part || part === '.' || part === '..' || /[:\u0000-\u001f]/.test(part))) {
    fail(`Unsafe relative path: ${value}`);
  }
  return value;
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function openUnchanged(filename, expected) {
  const stat = await checkedPath(filename);
  if (!stat.isFile() || (expected && signature(stat) !== expected)) fail(`Source changed: ${filename}`);
  const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (signature(await handle.stat({ bigint: true })) !== signature(stat)) fail(`Source changed: ${filename}`);
    return { handle, initial: signature(stat) };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function requireUnchanged(filename, handle, initial) {
  if (signature(await handle.stat({ bigint: true })) !== initial
    || signature(await checkedPath(filename)) !== initial) fail(`Source changed: ${filename}`);
}

async function nativeBinary(filename, expected) {
  const { handle, initial } = await openUnchanged(filename, expected);
  try {
    const bytes = Buffer.alloc(8);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const magic = bytesRead >= 4 ? bytes.readUInt32BE(0) : 0;
    const native = magic === 0x7f454c46
      || [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca].includes(magic)
      || (bytesRead >= 2 && bytes.toString('ascii', 0, 2) === 'MZ')
      || (bytesRead === 8 && bytes.toString('ascii') === '!<arch>\n');
    await requireUnchanged(filename, handle, initial);
    return native;
  } finally {
    await handle.close();
  }
}

async function inventory(input, omitNative) {
  const entries = [];
  async function visit(filename, relative) {
    const stat = await checkedPath(filename);
    const snapshot = signature(stat);
    if (stat.isDirectory()) {
      entries.push({ relative, kind: 'directory', signature: snapshot });
      for (const name of (await fs.readdir(filename)).sort()) {
        relativeName(name);
        await visit(path.join(filename, name), relative ? `${relative}/${name}` : name);
      }
      if (signature(await checkedPath(filename)) !== snapshot) fail(`Source changed: ${filename}`);
    } else if (stat.isFile()) {
      const omitted = omitNative && await nativeBinary(filename, snapshot);
      entries.push({ relative, kind: 'file', signature: snapshot, bytes: Number(stat.size), omitted });
    } else {
      fail(`Special file is forbidden: ${filename}`);
    }
  }
  await visit(input, '');
  return entries;
}

async function digest(filename, expected) {
  const { handle, initial } = await openUnchanged(filename, expected);
  try {
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(64 * 1024);
    let bytes = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
      bytes += bytesRead;
    }
    await requireUnchanged(filename, handle, initial);
    return { bytes, sha256: hash.digest('hex') };
  } finally {
    await handle.close();
  }
}

async function copyArtifact(source, destination, expected) {
  const { handle, initial } = await openUnchanged(source, expected);
  let output;
  try {
    await checkedPath(path.dirname(destination));
    output = await fs.open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
    const buffer = Buffer.alloc(64 * 1024);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      let offset = 0;
      while (offset < bytesRead) {
        const written = await output.write(buffer, offset, bytesRead - offset, null);
        if (!written.bytesWritten) fail(`Unable to finish writing: ${destination}`);
        offset += written.bytesWritten;
      }
    }
    await output.sync();
    await requireUnchanged(source, handle, initial);
  } finally {
    await output?.close();
    await handle.close();
  }
  const copied = await digest(destination);
  const original = await digest(source, initial);
  if (copied.bytes !== original.bytes || copied.sha256 !== original.sha256) fail(`Source changed during copy: ${source}`);
  return copied;
}

function select(object, keys) {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(object, key)).map(key => [key, object[key]]));
}

async function provenanceFor(output, files) {
  const provenance = [];
  for (const file of files) {
    const basename = path.posix.basename(file.path);
    if (!['report.json', 'freeze.json'].includes(basename)) continue;
    const filename = path.join(output, file.path);
    const { handle, initial } = await openUnchanged(filename);
    let value;
    try {
      const raw = await handle.readFile('utf8');
      await requireUnchanged(filename, handle, initial);
      try {
        value = JSON.parse(raw);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        provenance.push({ path: file.path, kind: 'unparsed-json' });
      }
    } finally {
      await handle.close();
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    if (basename === 'freeze.json' && typeof value.binarySha256 === 'string') {
      provenance.push({ path: file.path, kind: 'freeze', ...select(value, ['binary', 'binarySha256', 'generation', 'mode', 'compiledProjectSha256']), sourceHashCount: Object.keys(value.sourceSha256 || {}).length });
    } else if (basename === 'report.json' && typeof value.harnessSha256 === 'string') {
      provenance.push({ path: file.path, kind: 'capture', ...select(value, ['schemaVersion', 'createdAt', 'harnessSha256', 'probeContractSha256', 'compression', 'hardware', 'presets', 'scope', 'browser', 'gpu']), variants: (Array.isArray(value.variants) ? value.variants : []).map(variant => ({ label: variant.label, ...select(variant, ['origin', 'directory', 'manifest']) })) });
    }
  }
  return provenance;
}

async function packageEvidence(options) {
  const parent = await checkedPath(path.dirname(options.output));
  if (!parent.isDirectory()) fail('Output parent must be an existing directory');
  try {
    await fs.lstat(options.output);
    fail(`Output already exists: ${options.output}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const sources = [];
  const directories = new Set(['evidence']);
  for (const input of [...options.inputs].sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0)) {
    const stat = await checkedPath(input.input);
    if (!stat.isFile() && !stat.isDirectory()) fail(`Input must be a regular file or directory: ${input.input}`);
    if (inside(input.input, options.output) || inside(options.output, input.input)) fail('Inputs and output must not overlap');
    const kind = stat.isDirectory() ? 'directory' : 'file';
    const packagedRoot = `evidence/${input.label}`;
    const entries = await inventory(input.input, kind === 'directory');
    directories.add(packagedRoot);
    for (const entry of entries) {
      if (entry.kind === 'directory' && entry.relative) directories.add(`${packagedRoot}/${entry.relative}`);
    }
    sources.push({ ...input, kind, packagedRoot, entries });
  }
  const directoryList = [...directories].sort();
  if (!(await checkedPath(path.dirname(options.output))).isDirectory()) fail('Output parent changed');
  await fs.mkdir(options.output, { mode: 0o755 });
  for (const directory of directoryList) {
    await checkedPath(path.dirname(path.join(options.output, directory)));
    await fs.mkdir(path.join(options.output, directory), { mode: 0o755 });
  }
  const files = [];
  for (const source of sources) {
    for (const entry of source.entries) {
      if (entry.kind !== 'file' || entry.omitted) continue;
      const relative = entry.relative || path.basename(source.input);
      const packagedPath = relativeName(`${source.packagedRoot}/${relative}`);
      const filename = source.kind === 'file' ? source.input : path.join(source.input, entry.relative);
      files.push({ path: packagedPath, source: source.label, relativePath: relative, ...await copyArtifact(filename, path.join(options.output, packagedPath), entry.signature) });
    }
  }
  // Recheck additions, removals, replacements and metadata changes, including omissions.
  for (const source of sources) {
    const current = await inventory(source.input, source.kind === 'directory');
    if (JSON.stringify(current) !== JSON.stringify(source.entries)) fail(`Source changed during packaging: ${source.input}`);
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifest = {
    schemaVersion: 1,
    format: FORMAT,
    packager: { name: 'scripts/package-css-evidence.mjs', ...await digest(fileURLToPath(import.meta.url)), node: process.versions.node, platform: process.platform },
    policy: { artifactBytes: 'unchanged', directoryBinaryPolicy: 'omit native ELF, Mach-O, PE, and ar; explicit file inputs override', symlinks: 'reject', existingOutput: 'reject' },
    sources: sources.map(source => ({ label: source.label, input: source.input, kind: source.kind, packagedRoot: source.packagedRoot, omissions: source.entries.filter(entry => entry.omitted).map(entry => ({ relativePath: entry.relative, bytes: entry.bytes, reason: 'native-binary' })) })),
    provenance: await provenanceFor(options.output, files),
    directories: directoryList,
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files,
  };
  await checkedPath(options.output);
  await fs.writeFile(path.join(options.output, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o644 });
  await verifyPackage(options.output);
}

async function verifyPackage(output) {
  if (!(await checkedPath(output)).isDirectory()) fail('Package must be a directory');
  const manifestPath = path.join(output, MANIFEST);
  const { handle, initial } = await openUnchanged(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(await handle.readFile('utf8'));
    await requireUnchanged(manifestPath, handle, initial);
  } finally {
    await handle.close();
  }
  if (manifest.schemaVersion !== 1 || manifest.format !== FORMAT || !Array.isArray(manifest.files) || !Array.isArray(manifest.directories)) fail('Unsupported package manifest');
  const expected = new Set([MANIFEST]);
  const snapshots = new Map([[MANIFEST, initial]]);
  let totalBytes = 0;
  for (const file of manifest.files) {
    const relative = relativeName(file.path);
    if (!relative.startsWith('evidence/') || expected.has(relative)) fail(`Duplicate or reserved manifest path: ${relative}`);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) fail(`Invalid digest entry: ${relative}`);
    expected.add(relative);
    const filename = path.join(output, relative);
    const snapshot = signature(await checkedPath(filename));
    const actual = await digest(filename, snapshot);
    snapshots.set(relative, snapshot);
    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256) fail(`Packaged bytes do not match manifest: ${relative}`);
    totalBytes += actual.bytes;
  }
  const expectedDirectories = new Set(manifest.directories.map(relativeName));
  if (expectedDirectories.size !== manifest.directories.length
    || [...expectedDirectories].some(directory => directory !== 'evidence' && !directory.startsWith('evidence/'))) fail('Invalid package directory list');
  const current = await inventory(output, false);
  for (const entry of current) {
    if (!entry.relative) continue;
    const set = entry.kind === 'file' ? expected : expectedDirectories;
    if (!set.delete(entry.relative)) fail(`Unexpected packaged ${entry.kind}: ${entry.relative}`);
    if (entry.kind === 'file' && entry.signature !== snapshots.get(entry.relative)) fail(`Packaged file changed during verification: ${entry.relative}`);
  }
  if (expected.size || expectedDirectories.size || manifest.fileCount !== manifest.files.length || manifest.totalBytes !== totalBytes) fail('Incomplete package or inconsistent manifest totals');
  if (signature(await checkedPath(manifestPath)) !== initial) fail('Manifest changed during verification');
  console.log(`Verified ${manifest.files.length} files (${totalBytes} bytes): ${output}`);
}

try {
  const options = argumentsFor(process.argv.slice(2));
  if (options.help) console.log(HELP);
  else if (options.verify) await verifyPackage(options.verify);
  else await packageEvidence(options);
} catch (error) {
  console.error(`CSS evidence packaging failed: ${error.message}`);
  process.exitCode = 1;
}
