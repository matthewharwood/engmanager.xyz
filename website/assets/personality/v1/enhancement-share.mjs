import {encodeSnapshot,decodeSnapshot,parseCanonicalJSON} from './share.mjs';
import {validateEnhancement} from './enhancement.mjs';
import {exactObject} from './core.mjs';

const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
function packet(state,enhancement){return {v:1,kind:'big-six-seven-reflection',snapshot:encodeSnapshot(state),enhancement:validateEnhancement(enhancement,state)};}
export function exportReflection(state,enhancement){return JSON.stringify(packet(state,enhancement));}
export function importReflection(text){
 if(typeof text!=='string'||encoder.encode(text).length>32768)throw new Error('Reflection file exceeds 32 KiB.');
 const input=parseCanonicalJSON(text);exactObject(input,['v','kind','snapshot','enhancement'],'reflection file');
 if(input.v!==1||input.kind!=='big-six-seven-reflection')throw new Error('Unsupported reflection file.');
 const state=decodeSnapshot(input.snapshot),enhancement=validateEnhancement(input.enhancement,state);return {state,enhancement};
}
export function encodeEnhancedSnapshot(state,enhancement){
 const bytes=encoder.encode(exportReflection(state,enhancement));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 const token='1.'+btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 if(token.length>8192)throw new Error('This enhanced report is too long for an exact link. Download the full reflection JSON or PDF, or share the assessment without the reflection. Nothing has been truncated.');
 return token;
}
export function decodeEnhancedSnapshot(token){
 if(typeof token!=='string'||token.length>8192||!/^1\.[A-Za-z0-9_-]+$/.test(token))throw new Error('Invalid enhanced report link.');
 const raw=token.slice(2).replace(/-/g,'+').replace(/_/g,'/');let text;
 try{text=decoder.decode(Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0)));}catch{throw new Error('Invalid enhanced report encoding.');}
 const result=importReflection(text);if(encodeEnhancedSnapshot(result.state,result.enhancement)!==token)throw new Error('Noncanonical enhanced report.');return result;
}
export function readEnhancedIngress(href){
 const url=new URL(href),query=url.searchParams,fragment=new URLSearchParams(url.hash.slice(1));
 if(query.has('e'))throw new Error('Enhanced reports must use a URL fragment, never a query parameter.');
 if(!fragment.has('e'))return null;
 if(fragment.getAll('e').length!==1||[...fragment.keys()].length!==1||['r','s'].some(k=>query.has(k)))throw new Error('Ambiguous enhanced report link.');
 return {kind:'enhanced',...decodeEnhancedSnapshot(fragment.get('e'))};
}
