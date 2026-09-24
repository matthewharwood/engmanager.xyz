#!/usr/bin/env node
// One-time asset provenance fetch. The app uses the checked-in results offline.
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const entries = [
  ['ISTJ','Florence Nightingale'],['ISFJ','Clara Barton'],['INFJ','Rabindranath Tagore'],['INTJ','Ada Lovelace'],
  ['ISTP','Amelia Earhart'],['ISFP','Vincent van Gogh'],['INFP','Virginia Woolf'],['INTP','Albert Einstein'],
  ['ESTP','Harry Houdini'],['ESFP','Josephine Baker'],['ENFP','Anna May Wong'],['ENTP','Mark Twain'],
  ['ESTJ','Andrew Carnegie'],['ESFJ','Clara Schumann'],['ENFJ','Louis Armstrong'],['ENTJ','Marie Curie'],
];
const root=new URL('../website/assets/personality/v5/',import.meta.url);
const headers={'User-Agent':'engmanager.xyz editorial research (hello@engmanager.xyz)'};
const strip=value=>(value??'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
async function json(url){const response=await fetch(url,{headers});if(!response.ok)throw new Error(`${response.status} ${url}`);return response.json();}
async function fetchPerson([code,name]){
  const article=`https://en.wikipedia.org/wiki/${encodeURIComponent(name.replaceAll(' ','_'))}`;
  const summary=await json(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replaceAll(' ','_'))}`);
  const image=summary.originalimage?.source??summary.thumbnail?.source;
  if(!image)throw new Error(`No image for ${name}`);
  const filename=decodeURIComponent(new URL(image).pathname.split('/').at(-1)).replace(/^\d+px-/,'');
  const query=new URL('https://commons.wikimedia.org/w/api.php');
  query.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'420',titles:`File:${filename}`}).toString();
  const data=await json(query);
  const info=Object.values(data.query.pages)[0].imageinfo?.[0];
  if(!info)throw new Error(`Commons image missing for ${name}: ${filename}`);
  const meta=info.extmetadata,license=meta.LicenseShortName?.value;
  if(!['Public domain','No restrictions','CC BY 4.0'].includes(license))throw new Error(`Unreviewed license for ${name}: ${license}`);
  const bytes=await fetch(info.thumburl??info.url,{headers}).then(response=>{if(!response.ok)throw new Error(`Portrait download ${response.status}`);return response.arrayBuffer();});
  const file=`portraits/${code.toLowerCase()}.jpg`;
  await writeFile(new URL(file,root),Buffer.from(bytes));
  return {code,name,description:summary.description,article,image:file,source:info.descriptionurl,license,licenseUrl:meta.LicenseUrl?.value??null,artist:strip(meta.Artist?.value),imageTitle:filename};
}
await mkdir(new URL('portraits/',root),{recursive:true});
const catalog=[];
for(const entry of entries){catalog.push(await fetchPerson(entry));console.log(entry[0],entry[1]);}
await writeFile(new URL('data/portrait-sources.json',root),JSON.stringify(catalog,null,2)+'\n');
