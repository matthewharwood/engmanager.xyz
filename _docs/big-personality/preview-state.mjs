// Design-preview state, deliberately separate from the production assessment protocol.
export const STEPS = ['understand','prepare','respond','review','reflect','share'];
export const DOMAINS = ['O','C','E','A','N'];
export const freshState = () => ({v:1,release:'design-0.3',step:'understand',answer:null,skipped:false,interests:true,values:true,shared:['O','C']});
export function validateState(input) {
  const keys=['v','release','step','answer','skipped','interests','values','shared'];
  if (!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).length!==keys.length || keys.some(k=>!Object.hasOwn(input,k))) throw new Error('Unsupported snapshot fields.');
  if (input.v!==1 || input.release!=='design-0.3' || !STEPS.includes(input.step)) throw new Error('Unsupported preview release or position.');
  if (input.answer!==null && (!Number.isInteger(input.answer)||input.answer<1||input.answer>5)) throw new Error('Invalid example answer.');
  if (['skipped','interests','values'].some(k=>typeof input[k]!=='boolean') || (input.skipped&&input.answer!==null)) throw new Error('Invalid response state.');
  if (!Array.isArray(input.shared)||input.shared.length>5||input.shared.some(d=>!DOMAINS.includes(d))||new Set(input.shared).size!==input.shared.length) throw new Error('Invalid shared fields.');
  return {v:1,release:'design-0.3',step:input.step,answer:input.answer,skipped:input.skipped,interests:input.interests,values:input.values,shared:DOMAINS.filter(d=>input.shared.includes(d))};
}
export function encodeState(input) {
  const bytes = new TextEncoder().encode(JSON.stringify(validateState(input)));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function decodeState(encoded) {
  if(typeof encoded!=='string'||encoded.length>1500||!encoded.length||!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Invalid or oversized snapshot.');
  const binary=atob(encoded.replaceAll('-','+').replaceAll('_','/'));
  const text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
  const result=validateState(JSON.parse(text));
  if(encodeState(result)!==encoded) throw new Error('Noncanonical snapshot.');
  return result;
}
