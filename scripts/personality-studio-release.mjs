#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inventory,verifyPublishedReleases} from './personality-release.mjs';
import {releaseSource} from '../website/assets/personality/v5/release-format.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyFrozenV4(){
 await verifyPublishedReleases();
 const expected=JSON.parse(await readFile(new URL('./personality-v4-frozen.json',import.meta.url),'utf8'));
 const actual=await inventory(fileURLToPath(new URL('../website/assets/personality/v4/',import.meta.url)));
 if(JSON.stringify(actual)!==JSON.stringify(expected.files))throw new Error('Published v4 bytes changed. Restore them before generating v5.');
}
export async function generateStudioRelease(){
 await verifyFrozenV4();
 const {RELEASE:previous}=await import('../website/assets/personality/v4/release.mjs');
 const previousBytes=await readFile(new URL('../website/assets/personality/v4/release.mjs',import.meta.url));
 const root=new URL('../website/assets/personality/v5/',import.meta.url),files=await inventory(fileURLToPath(root));delete files['release.mjs'];
 for(const name of ['app.mjs','bootstrap.mjs','style.css','studio.mjs','studio-model.mjs','studio-view.mjs','studio-kit.mjs','studio-store.mjs','figures.mjs','pilot.mjs','deck.mjs','zip.mjs','sw.js','offline.mjs','release-format.mjs'])if(!files[name])throw new Error('Missing v5 file '+name);
 const assets=Object.fromEntries([...Object.entries(previous.assets),['/assets/personality/v4/release.mjs',hash(previousBytes)],...Object.entries(files).map(([name,digest])=>['/assets/personality/v5/'+name,digest])].sort(([a],[b])=>a<b?-1:a>b?1:0));
 const release={v:5,presentation:'portrait-studio-v5',legacy:previous.legacy,previousReleases:[{v:4,root:'/assets/personality/v4/',manifestSha256:hash(previousBytes),releaseDigest:hash(JSON.stringify(previous))},...previous.previousReleases],releases:previous.releases,ready:true,assets};
 await writeFile(new URL('release.mjs',root),releaseSource(release));return release;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=await generateStudioRelease();console.log('v5 studio manifest: '+Object.keys(r.assets).length+' assets. Published v1–v4 unchanged.');}
