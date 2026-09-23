// ZIP STORE format: no dependency, stable paths, UTF-8 names, CRC-32 integrity.
// Public images are fetched only from the frozen release manifest before packaging.
import {RELEASE} from './release.mjs';
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;};
export function zipStore(files){
 const encoder=new TextEncoder(),parts=[],directory=[];let offset=0;
 for(const file of files){
  if(!/^[a-zA-Z0-9_./-]+$/.test(file.name)||file.name.startsWith('/')||file.name.includes('..'))throw new Error('Unsafe media path');
  const name=encoder.encode(file.name),bytes=file.bytes instanceof Uint8Array?file.bytes:encoder.encode(file.bytes),checksum=crc(bytes);
  const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);l.setUint32(14,checksum,true);l.setUint32(18,bytes.length,true);l.setUint32(22,bytes.length,true);l.setUint16(26,name.length,true);local.set(name,30);
  const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,checksum,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);
  parts.push(local,bytes);directory.push(central);offset+=local.length+bytes.length;
 }
 const size=directory.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
 e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
 return new Blob([...parts,...directory,end],{type:'application/zip'});
}
export async function mediaKit(kit,{fetcher=fetch}={}){
 const files=[{name:kit.filename,bytes:kit.text},{name:'media-manifest.json',bytes:JSON.stringify(kit.data.media,null,2)}];
 for(const asset of kit.data.media){
  const path='/assets/personality/v5/'+asset.path,expected=RELEASE.assets[path];
  if(!expected)throw new Error('Media is not in this release.');
  const response=await fetcher(path,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error('A media file is unavailable. Reconnect or download the Markdown kit instead.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==expected)throw new Error('Media integrity check failed. Reload this release before exporting.');
  files.push({name:asset.path,bytes});
 }
 return zipStore(files);
}
