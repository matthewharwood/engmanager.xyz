import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../website/src/components/armillary/script.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function node() {
  return { dataset: {}, hidden: false, isConnected: true, listeners: new Map(), attributes: new Map(), textContent: '',
    addEventListener(type, callback, options) { const records=this.listeners.get(type)||[]; records.push({callback,options});this.listeners.set(type,records); },
    emit(type, event={}) { for(const {callback,options} of this.listeners.get(type)||[]) if(!options?.signal?.aborted)callback(event); },
    setAttribute(key,value) { this.attributes.set(key,value); },
  };
}
function harness({gpu,prerendering=false,resumeFailure=false,deferResume=false}={}) {
  const host=node(),canvas=node(),play=node(),sound=node(),status=node(),document=node(),window=node(),motion=node();
  host.dataset.texture='/assets/newsletter/sunburst.webp';play.hidden=true;sound.hidden=true;
  host.querySelector = selector => ({'[data-armillary-canvas]':canvas,'[data-armillary-motion]':play,'[data-armillary-sound]':sound,'[data-armillary-audio-status]':status}[selector]);
  document.querySelector=()=>host;document.prerendering=prerendering;document.hidden=false;motion.matches=false;
  const contexts=[],timers=[],hooks={},oscillators=[];
  let resolveResume;
  const parameter=()=>({value:0,setTargetAtTime(value){this.value=value;}});
  const gain=()=>({gain:parameter(),connect(){return this;}});
  class AudioContext {
    constructor(){this.currentTime=0;this.state='suspended';contexts.push(this);}
    createGain(){return gain();}
    createOscillator(){const o={type:'',frequency:parameter(),connect(){return this;},start(){this.started=true;}};oscillators.push(o);return o;}
    async resume(){if(resumeFailure)throw Error('blocked');if(deferResume)await new Promise(resolve=>{resolveResume=resolve;});this.state='running';}
    async close(){this.state='closed';}
  }
  window.AudioContext=AudioContext;window.__engNav={onBeforeSwap(fn){hooks.before=fn;},onSwap(fn){hooks.swap=fn;}};
  canvas.getContext=()=>({configure(){},unconfigure(){}});
  vm.runInNewContext(source,{window,document,navigator:{gpu},matchMedia:()=>motion,AbortController,
    requestAnimationFrame(){return 1;},cancelAnimationFrame(){},setTimeout(fn){timers.push(fn);},
    GPUBufferUsage:{},GPUTextureUsage:{},Float32Array,Math,
  });
  return {host,sound,play,status,contexts,oscillators,document,window,hooks,
    flush(){while(timers.length)timers.shift()();},resolveResume(){resolveResume?.();}};
}
test('unsupported GPU retains the poster and creates no audio before opt-in',async()=>{
  const h=harness();await tick();assert.equal(h.contexts.length,0);assert.equal(h.play.hidden,true);assert.equal(h.sound.hidden,false);
  h.sound.emit('click');await tick();assert.equal(h.contexts.length,1);assert.equal(h.contexts[0].state,'running');
  assert.deepEqual(h.oscillators.map(o=>o.frequency.value),[55,82.41,.065]);
  assert.equal(h.sound.attributes.get('aria-pressed'),'true');
  h.sound.emit('click');h.flush();assert.equal(h.contexts[0].state,'closed');assert.equal(h.sound.attributes.get('aria-pressed'),'false');
});
test('shader failure keeps audio controls usable and falls back to static artwork',async()=>{
  const device={lost:new Promise(()=>{}),destroyed:false,destroy(){this.destroyed=true;},addEventListener(){},createShaderModule(){return {};},createRenderPipelineAsync:async()=>{throw Error('shader');}};
  const gpu={requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=> 'bgra8unorm'};
  const h=harness({gpu});await tick();assert.equal(h.host.dataset.renderer,'poster');assert.equal(device.destroyed,true);
  h.sound.emit('click');await tick();assert.equal(h.contexts[0].state,'running');
  h.sound.emit('click');h.flush();assert.equal(h.contexts[0].state,'closed');
});
test('hiding the page mutes and returning does not restart sound without consent',async()=>{
  const h=harness();h.sound.emit('click');await tick();h.document.hidden=true;h.document.emit('visibilitychange');h.flush();
  assert.equal(h.contexts[0].state,'closed');h.document.hidden=false;h.document.emit('visibilitychange');assert.equal(h.contexts.length,1);assert.equal(h.sound.attributes.get('aria-pressed'),'false');
});
test('navigation tears down the context and removes old control handlers',async()=>{
  const h=harness();h.sound.emit('click');await tick();h.hooks.before();h.flush();assert.equal(h.contexts[0].state,'closed');
  h.sound.emit('click');await tick();assert.equal(h.contexts.length,1);
});
test('navigation during audio resume cannot start orphaned oscillators',async()=>{
  const h=harness({deferResume:true});h.sound.emit('click');h.hooks.before();h.resolveResume();await tick();h.flush();
  assert.equal(h.contexts[0].state,'closed');assert(h.oscillators.every(o=>!o.started));
});
test('audio resume rejection reports failure and never claims sound is on',async()=>{
  const h=harness({resumeFailure:true});h.sound.emit('click');await tick();h.flush();assert.equal(h.sound.attributes.get('aria-pressed'),'false');assert.match(h.status.textContent,/unavailable/);assert.equal(h.contexts[0].state,'closed');
});
test('prerendering creates neither GPU work nor audio until activation',()=>{
  let requests=0;const h=harness({prerendering:true,gpu:{requestAdapter(){requests++;return Promise.resolve(null);}}});
  assert.equal(requests,0);assert.equal(h.contexts.length,0);h.document.prerendering=false;h.document.emit('prerenderingchange');assert.equal(requests,1);
});
