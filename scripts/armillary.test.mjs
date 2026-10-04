import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { referenceArmillaryMesh } from './fixtures/armillary-mesh-reference.mjs';
const source = await readFile(new URL('../website/src/components/armillary/script.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function node() {
  return { dataset: {}, hidden: false, isConnected: true, listeners: new Map(), attributes: new Map(), textContent: '',
    addEventListener(type, callback, options) { const records=this.listeners.get(type)||[]; records.push({callback,options});this.listeners.set(type,records); },
    emit(type, event={}) { for(const {callback,options} of this.listeners.get(type)||[]) if(!options?.signal?.aborted)callback(event); },
    setAttribute(key,value) { this.attributes.set(key,value); },
  };
}
function harness({gpu,prerendering=false,resumeFailure=false,deferResume=false,journeyBusy=false,reduced=false}={}) {
  const host=node(),canvas=node(),play=node(),sound=node(),status=node(),document=node(),window=node(),motion=node();
  host.dataset.texture='/assets/newsletter/sunburst.webp';play.hidden=true;sound.hidden=true;
  host.querySelector = selector => ({'[data-armillary-canvas]':canvas,'[data-armillary-motion]':play,'[data-armillary-sound]':sound,'[data-armillary-audio-status]':status}[selector]);
  document.querySelector=()=>activeHost;document.prerendering=prerendering;document.hidden=false;motion.matches=reduced;document.body={classList:{contains:()=>false}};
  const contexts=[],timers=new Map(),hooks={},oscillators=[],navigator={gpu},observers=[],resizes=[];
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
    ResizeObserver:class{constructor(fn){this.fn=fn;resizes.push(this);}observe(){}disconnect(){this.disconnected=true;}},IntersectionObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}},
    fetch:async()=>({ok:true,blob:async()=>({})}),createImageBitmap:async()=>({width:1,height:1,close(){}}),
  });
  return {host,canvas,sound,play,status,contexts,oscillators,document,window,navigator,hooks,motion,observers,resizes,
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
  const state={draws:0,values:[],uniformArrays:[],resourceViews:0,textures:0,meshUploads:[],resources:[],deviceDisposals:0};
  const resource=()=>{const item={destroy(){this.destroyed=true;},createView(){state.resourceViews++;return {};}};state.resources.push(item);return item;};
  const device={lost:new Promise(()=>{}),destroy(){state.deviceDisposals++;},addEventListener(){},
    createShaderModule:()=>({}),createRenderPipelineAsync:async()=>({getBindGroupLayout:()=>({})}),
    createBuffer:resource,createTexture(){state.textures++;return resource();},createSampler:()=>({}),createBindGroup:()=>({}),
    createCommandEncoder:()=>({beginRenderPass:()=>({setPipeline(){},setBindGroup(){},setVertexBuffer(){},draw(){state.draws++;},end(){}}),finish:()=>({})}),
    queue:{writeBuffer(_buffer,_offset,data){if(data.length===4){state.values.push([...data]);state.uniformArrays.push(data);}else state.meshUploads.push(data);},copyExternalImageToTexture(){},submit(){},onSubmittedWorkDone:()=>submitted},
  };
  const gpu={requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=> 'bgra8unorm'};
  return {state,gpu};
}

test('packed armillary geometry preserves every byte of the authored mesh',()=>{
  const begin=source.indexOf('    const norm ='),end=source.indexOf('    function mount()',begin);
  const mesh=Function(source.slice(begin,end)+'\nreturn mesh;')();
  const actual=mesh(),reference=referenceArmillaryMesh();
  assert.equal(actual.length,7232*3*12,'all facets, full 144-segment rings, normals and UVs remain');
  assert.equal(actual.byteLength,1041408,'one bounded geometry cache retains no duplicate JS number array');
  assert.deepEqual(Buffer.from(actual.buffer),Buffer.from(reference.buffer),'packing, normals, UV seams, winding and barycentrics are byte-exact');
  assert.equal(createHash('sha256').update(Buffer.from(actual.buffer)).digest('hex'),'829809f4cfb87413a3e126fb26c61bbfcb07775d31f73e5898196eeb2b5507bc');
  assert.equal(mesh(),actual,'only the completed private geometry is reused');
});

test('retained newsletter mounts reuse immutable geometry while disposing each GPU allocation',async()=>{
  const {state,gpu}=renderedGpu();const h=harness({gpu});await h.hooks.swap();
  const geometry=state.meshUploads[0],before=Buffer.from(geometry.buffer).slice();
  const firstResources=[...state.resources];h.hooks.before();
  assert.ok(firstResources.every(resource=>resource.destroyed),'leaving frees every buffer and texture');
  assert.equal(state.deviceDisposals,1);assert.equal(h.frames.size,0);
  h.navigator.connection={saveData:true};await h.hooks.swap();
  assert.equal(state.meshUploads.length,1,'static resume never uploads the cached geometry');h.hooks.before();
  delete h.navigator.connection;await h.hooks.swap();
  assert.equal(state.meshUploads.length,2);assert.equal(state.meshUploads[1],geometry,'a fresh device receives the same immutable geometry bytes');
  assert.deepEqual(Buffer.from(geometry.buffer),before,'frame uniforms and remounting never mutate vertex storage');
  assert.ok(state.resources.slice(firstResources.length).every(resource=>!resource.destroyed),'the resumed scene owns fresh GPU allocations');
  h.hooks.before();assert.ok(state.resources.every(resource=>resource.destroyed));assert.equal(state.deviceDisposals,2);assert.equal(h.frames.size,0);
});

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


test('armillary submits every vsync orbit pose using one uniform array and cached render views',async()=>{
  const {state,gpu}=renderedGpu();const h=harness({gpu});
  let rendererWrites=0;const dataset=h.host.dataset;
  h.host.dataset=new Proxy(dataset,{set(target,key,value){if(key==='renderer'&&value==='webgpu')rendererWrites++;target[key]=value;return true;}});
  await h.hooks.swap();const initial=state.draws,views=state.resourceViews,textures=state.textures;
  for(let i=1;i<=8;i++){h.advance(i*1000/60);assert.equal(state.draws,initial+i,'each display frame advances the ongoing orbit');}
  assert.equal(new Set(state.uniformArrays).size,1,'frame updates reuse the scene uniform array');
  assert.equal(state.resourceViews,views,'color/depth views are not recreated per frame');
  assert.equal(rendererWrites,1,'unchanged renderer state never rewrites the DOM attribute');
  h.resizes[0].fn();assert.equal(state.textures,textures,'unchanged observed dimensions do not reallocate MSAA targets');
  h.hooks.before();assert.equal(h.frames.size,0);
});

test('armillary yields its ongoing orbit to the next poster and resumes without hidden time',async()=>{
  const {state,gpu}=renderedGpu();const h=harness({gpu});await h.hooks.swap();
  h.advance(100);h.advance(120);const heldTime=state.values.at(-1)[2],heldCount=state.draws;
  h.window.emit('eng:journeyexposure',{detail:{active:true}});
  assert.equal(h.frames.size,0);h.advance(10000);assert.equal(state.draws,heldCount);
  h.window.emit('eng:journeyexposure',{detail:{active:false}});h.advance(10020);
  assert.equal(state.draws,heldCount+1);assert.equal(state.values.at(-1)[2],heldTime);
  h.advance(10040);assert.ok(state.values.at(-1)[2]>heldTime&&state.values.at(-1)[2]<heldTime+.03);
  h.window.__engNav.busy=true;h.window.emit('eng:journeyexposure',{detail:{active:false}});assert.equal(h.frames.size,0,'ongoing handoff stays held even if exposure changes');
  h.window.__engNav.busy=false;h.window.emit('eng:journeysettled');h.advance(10100);assert.equal(h.frames.size,1);
  h.hooks.before();assert.equal(h.frames.size,0);
});

test('armillary hidden/offscreen/reduced states schedule no ongoing GPU work and dispose both observers',async()=>{
  const {state,gpu}=renderedGpu();const h=harness({gpu});await h.hooks.swap();
  h.document.hidden=true;h.document.emit('visibilitychange');assert.equal(h.frames.size,0);
  const hidden=state.draws;h.advance(1000);assert.equal(state.draws,hidden);
  h.document.hidden=false;h.document.emit('visibilitychange');h.advance(1100);assert.equal(h.frames.size,1);
  h.observers[0].fn([{isIntersecting:false}]);assert.equal(h.frames.size,0);
  h.window.emit('eng:journeysettled');assert.equal(h.frames.size,0,'settled cannot wake an offscreen scene');
  h.observers[0].fn([{isIntersecting:true}]);h.advance(2000);assert.equal(h.frames.size,1);
  h.motion.matches=true;h.motion.emit('change');h.advance(2020);assert.equal(h.frames.size,0,'reduced motion finishes its one static pose');
  const reduced=state.draws;h.advance(2040);assert.equal(state.draws,reduced);
  h.motion.matches=false;h.motion.emit('change');h.advance(2060);assert.equal(h.frames.size,1);
  h.hooks.before();assert.equal(h.frames.size,0);assert.ok(h.observers[0].disconnected&&h.resizes[0].disconnected);
  h.window.emit('eng:journeysettled');h.window.emit('eng:journeyexposure',{detail:{active:false}});assert.equal(h.frames.size,0,'disposed handlers never resurrect work');
});

test('a reduced-motion armillary submits its first readiness frame without an orbit loop',async()=>{
  const {state,gpu}=renderedGpu();const h=harness({gpu,reduced:true,journeyBusy:true});await h.hooks.swap();
  assert.equal(state.draws,1);assert.equal(state.values[0][2],0);assert.equal(h.frames.size,0);
  h.window.__engNav.busy=false;h.window.emit('eng:journeysettled');h.advance(100);
  assert.equal(state.values.at(-1)[2],0);assert.equal(h.frames.size,0);
  h.hooks.before();
});
