// Authoring-only command: node website/assets/personality/ai/v1/generate-manifest.mjs
// Not imported by the browser or included in the optional runtime download.
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('./', import.meta.url));
async function files(directory) {
  const results = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await files(file));
    else if (entry.isFile() && !['assets.mjs', 'generate-manifest.mjs'].includes(entry.name)) results.push(file);
  }
  return results;
}
const digest = data => createHash('sha256').update(data).digest('hex');
const assets = await Promise.all((await files(root)).sort().map(async file => {
  const data = await readFile(file);
  return {path: '/assets/personality/ai/v1/' + path.relative(root, file).split(path.sep).join('/'), bytes: data.length, sha256: digest(data)};
}));
const manifest = JSON.stringify(assets), hash = digest(manifest);
await writeFile(path.join(root, 'assets.mjs'), `// Generated from the optional local AI runtime; model weights are excluded.\nexport const AI_ASSETS = Object.freeze(${manifest});\nexport const AI_MANIFEST_DIGEST = '${hash}';\nexport const AI_RUNTIME_CACHE = 'personality-ai-runtime-v1-${hash}';\n`);
console.log(JSON.stringify({files: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), sha256: hash}));
