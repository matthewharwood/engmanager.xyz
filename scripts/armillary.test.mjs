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
function harness({gpu,prerendering=false,resumeFailure=false,deferResume=false,journeyBusy=false}={}) {
  const host=node(),canvas=node(),play=node(),sound=node(),status=node(),document=node(),window=node(),motion=node();
  host.dataset.texture='/assets/newsletter/sunburst.webp';play.hidden=true;sound.hidden=true;
  host.querySelector = selector => ({'[data-armillary-canvas]':canvas,'[data-armillary-motion]':play,'[data-armillary-sound]':sound,'[data-armillary-audio-status]':status}[selector]);
  document.querySelector=()=>activeHost;document.prerendering=prerendering;document.hidden=false;motion.matches=false;
  const contexts=[],timers=new Map(),hooks={},oscillators=[],navigator={gpu};
  let timerId=0,frameId=0,activeHost=host;const frames=new Map();
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
  window.AudioContext=AudioContext;window.__engNav={busy:journeyBusy,onBeforeSwap(fn){hooks.before=fn;},onSwap(fn){hooks.swap=fn;}};
  canvas.getBoundingClientRect=()=>({width:620,height:600});
  canvas.getContext=()=>({configure(){},unconfigure(){},getCurrentTexture:()=>({createView:()=>({})})});
  vm.runInNewContext(source,{window,document,navigator,matchMedia:()=>motion,AbortController,
    requestAnimationFrame(fn){const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
    GPUBufferUsage:{},GPUTextureUsage:{},Float32Array,Math,devicePixelRatio:1,
    ResizeObserver:class{observe(){}disconnect(){}},IntersectionObserver:class{observe(){}disconnect(){}},
    fetch:async()=>({ok:true,blob:async()=>({})}),createImageBitmap:async()=>({width:1,height:1,close(){}}),
  });
  return {host,sound,play,status,contexts,oscillators,document,window,navigator,hooks,
    advance(time){const pending=[...frames];frames.clear();for(const [,fn] of pending)fn(time);},frames,
    flush(){for(const [id,fn] of timers){timers.delete(id);fn();}},setHost(next){activeHost=next;},resolveResume(){resolveResume?.();}};
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

test('journey mount exposes pending GPU work and settles to a static fallback when it stalls',async()=>{
  let requests=0;
  const h=harness({gpu:{requestAdapter(){requests++;return new Promise(()=>{});}}});
  let ready=false;const mounting=h.hooks.swap().then(()=>{ready=true;});
  await tick();assert.equal(requests,1);assert.equal(ready,false);
  h.flush();await mounting;
  assert.equal(h.host.dataset.renderer,'poster');assert.equal(h.play.hidden,true);
  assert.equal(h.sound.hidden,false,'falling back does not remove the opt-in sound control');
});
test('leaving during a pending GPU mount settles readiness and disposes a late device',async()=>{
  let releaseDevice;
  const device={destroyed:0,destroy(){this.destroyed++;}};
  const gpu={requestAdapter:async()=>({requestDevice:()=>new Promise(resolve=>{releaseDevice=resolve;})})};
  const h=harness({gpu});await tick();
  const mounting=h.hooks.swap();h.hooks.before();await mounting;
  releaseDevice(device);await tick();assert.equal(device.destroyed,1);
  h.setHost(null);assert.equal(h.hooks.swap(),undefined,'pages without a newsletter keep no mounted scene');
});
test('returning to the newsletter installs fresh controls without duplicate audio listeners',async()=>{
  const h=harness();await h.hooks.swap();
  h.hooks.before();await h.hooks.swap();
  h.sound.emit('click');await tick();assert.equal(h.contexts.length,1);
  h.hooks.before();h.flush();assert.equal(h.contexts[0].state,'closed');
});

function renderedGpu(submitted=Promise.resolve()) {
  const state={draws:0,values:[]};
  const resource=()=>({destroy(){},createView:()=>({})});
  const device={lost:new Promise(()=>{}),destroy(){},addEventListener(){},
    createShaderModule:()=>({}),createRenderPipelineAsync:async()=>({getBindGroupLayout:()=>({})}),
    createBuffer:resource,createTexture:resource,createSampler:()=>({}),createBindGroup:()=>({}),
    createCommandEncoder:()=>({beginRenderPass:()=>({setPipeline(){},setBindGroup(){},setVertexBuffer(){},draw(){state.draws++;},end(){}}),finish:()=>({})}),
    queue:{writeBuffer(_buffer,_offset,data){if(data.length===4)state.values.push([...data]);},copyExternalImageToTexture(){},submit(){},onSubmittedWorkDone:()=>submitted},
  };
  const gpu={requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=> 'bgra8unorm'};
  return {state,gpu};
}

test('newsletter readiness waits for its submitted frame and orbit begins after the handoff settles',async()=>{
  let releaseSubmission;
  const submitted=new Promise(resolve=>{releaseSubmission=resolve;});
  const {state,gpu}=renderedGpu(submitted);
  const h=harness({gpu,journeyBusy:true});
  let ready=false;const mounting=h.hooks.swap().then(()=>{ready=true;});
  await tick();assert.equal(state.draws,1);assert.equal(ready,false);assert.equal(h.frames.size,0);
  assert.equal(h.host.dataset.renderer,'webgpu');assert.equal(state.values.at(-1)[2],0);
  releaseSubmission();await mounting;assert.equal(ready,true);
  h.window.__engNav.busy=false;h.window.emit('eng:journeysettled');h.advance(100);h.advance(150);
  assert(state.draws>1&&state.values.at(-1)[2]>0,'a covered scene stays still until its page is shown');
  h.hooks.before();assert.equal(h.frames.size,0,'leaving removes every scheduled GPU frame');
});

test('a retained GPU newsletter resets motion controls when resumed in Save-Data or without GPU',async()=>{
  const {gpu}=renderedGpu();const h=harness({gpu});await h.hooks.swap();
  assert.equal(h.host.dataset.renderer,'webgpu');assert.equal(h.play.hidden,false);
  h.hooks.before();h.navigator.connection={saveData:true};await h.hooks.swap();
  assert.equal(h.host.dataset.renderer,'poster');assert.equal(h.play.hidden,true);
  assert.equal(h.sound.hidden,false,'static mode retains the separate sound control');
  h.hooks.before();delete h.navigator.connection;h.navigator.gpu=undefined;await h.hooks.swap();
  assert.equal(h.host.dataset.renderer,'poster');assert.equal(h.play.hidden,true);
  h.sound.emit('click');await tick();assert.equal(h.contexts.length,1,'only the fresh sound handler remains');
  h.hooks.before();h.flush();
});
