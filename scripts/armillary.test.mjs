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
function harness({gpu,prerendering=false,resumeFailure=false,deferResume=false,journeyBusy=false,reduced=false,rendererMount}={}) {
  const host=node(),canvas=node(),play=node(),sound=node(),status=node(),document=node(),window=node(),motion=node();
  host.dataset.model='/assets/newsletter/armillary.glb';play.hidden=true;sound.hidden=true;
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
  window.__engJourneyPoster={mount:rendererMount||(()=>Promise.reject(Error('No test renderer')))};
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
test('shared marble renderer failure retains static artwork and opt-in audio',async()=>{
  const h=harness({gpu:{},rendererMount:async()=>{throw Error('shader');}});await tick();
  assert.equal(h.host.dataset.renderer,'poster');assert.equal(h.play.hidden,true);
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
test('prerendering starts neither marble loading nor audio until activation',()=>{
  let requests=0;const h=harness({prerendering:true,gpu:{},rendererMount(){requests++;return new Promise(()=>{});}});
  assert.equal(requests,0);assert.equal(h.contexts.length,0);h.document.prerendering=false;h.document.emit('prerenderingchange');assert.equal(requests,1);
});

test('journey mount exposes pending GPU work and settles to a static fallback when it stalls',async()=>{
  let requests=0;
  const h=harness({gpu:{},rendererMount(){requests++;return new Promise(()=>{});}});
  let ready=false;const mounting=h.hooks.swap().then(()=>{ready=true;});
  await tick();assert.equal(requests,1);assert.equal(ready,false);
  h.flush();await mounting;
  assert.equal(h.host.dataset.renderer,'poster');assert.equal(h.play.hidden,true);
  assert.equal(h.sound.hidden,false,'falling back does not remove the opt-in sound control');
});
test('leaving during a pending marble load settles readiness and disposes a late renderer',async()=>{
  let release;const candidate={destroyed:0,destroy(){this.destroyed++;}};
  const h=harness({gpu:{},rendererMount:()=>new Promise(resolve=>{release=resolve;})});await tick();
  const mounting=h.hooks.swap();h.hooks.before();await mounting;
  release(candidate);await tick();assert.equal(candidate.destroyed,1);
  h.setHost(null);assert.equal(h.hooks.swap(),undefined,'pages without a newsletter keep no mounted scene');
});
test('returning to the newsletter installs fresh controls without duplicate audio listeners',async()=>{
  const h=harness();await h.hooks.swap();
  h.hooks.before();await h.hooks.swap();
  h.sound.emit('click');await tick();assert.equal(h.contexts.length,1);
  h.hooks.before();h.flush();assert.equal(h.contexts[0].state,'closed');
});

function renderedGpu(submitted=Promise.resolve()) {
  const state={poses:[],visible:[],mounts:[],controllers:[]};
  const rendererMount=async(canvas,options)=>{
    state.mounts.push({canvas,options});
    const controller={destroyed:false,setRotation(yaw,pitch){state.poses.push([yaw,pitch]);},setVisible(value){state.visible.push(value);},destroy(){this.destroyed=true;}};
    state.controllers.push(controller);options.signal.addEventListener('abort',()=>controller.destroy(),{once:true});
    await submitted;return controller;
  };
  return {state,gpu:{},rendererMount};
}

test('every newsletter mount uses its actual Blender model and owns fresh renderer resources',async()=>{
  const setup=renderedGpu(),h=harness(setup);await h.hooks.swap();
  assert.equal(setup.state.mounts[0].options.url,h.host.dataset.model);
  h.hooks.before();assert(setup.state.controllers[0].destroyed);assert.equal(h.frames.size,0);
  h.navigator.connection={saveData:true};await h.hooks.swap();
  assert.equal(setup.state.mounts.length,1,'Save-Data creates no model request');h.hooks.before();
  delete h.navigator.connection;await h.hooks.swap();
  assert.equal(setup.state.mounts.length,2);assert(!setup.state.controllers[1].destroyed);
  h.hooks.before();assert(setup.state.controllers.every(c=>c.destroyed));
});

test('newsletter readiness waits for the marble frame and orbit starts after handoff',async()=>{
  let release;const setup=renderedGpu(new Promise(resolve=>{release=resolve;}));
  const h=harness({...setup,journeyBusy:true});let ready=false;
  const mounting=h.hooks.swap().then(()=>{ready=true;});await tick();
  assert.equal(ready,false);assert.equal(h.frames.size,0);assert.equal(h.host.dataset.renderer,'poster');
  release();await mounting;assert.equal(ready,true);assert.equal(h.host.dataset.renderer,'webgpu');
  assert.equal(h.frames.size,0);assert.equal(setup.state.visible.at(-1),false);
  h.window.__engNav.busy=false;h.window.emit('eng:journeysettled');h.advance(100);h.advance(150);
  assert(setup.state.poses.at(-1)[0]>-.30);
  h.hooks.before();assert.equal(h.frames.size,0);
});

test('retained newsletter resets controls for Save-Data and unavailable GPU',async()=>{
  const setup=renderedGpu(),h=harness(setup);await h.hooks.swap();
  assert.equal(h.host.dataset.renderer,'webgpu');assert.equal(h.play.hidden,false);
  h.play.emit('click');assert.equal(h.play.attributes.get('aria-pressed'),'true');
  h.hooks.before();h.navigator.connection={saveData:true};await h.hooks.swap();
  assert.equal(h.host.dataset.renderer,'poster');assert.equal(h.play.hidden,true);
  assert.equal(h.play.attributes.get('aria-pressed'),'false','retained pause state is reset before initialization');
  h.hooks.before();delete h.navigator.connection;h.navigator.gpu=undefined;await h.hooks.swap();
  assert.equal(h.host.dataset.renderer,'poster');assert.equal(h.play.hidden,true);
  h.sound.emit('click');await tick();assert.equal(h.contexts.length,1);
  h.hooks.before();h.flush();
});

test('armillary forwards each vsync pose to the shared marble renderer without layout reads',async()=>{
  const setup=renderedGpu(),h=harness(setup);await h.hooks.swap();
  h.canvas.getBoundingClientRect=()=>{throw Error('Unexpected animation layout read');};
  for(let i=1;i<=8;i++){h.advance(i*1000/60);assert.equal(setup.state.poses.length,i);}
  assert(setup.state.poses.at(-1)[0]>setup.state.poses[0][0]);
  h.play.emit('click');h.advance(200);const paused=setup.state.poses.at(-1)[0];
  assert.equal(h.frames.size,0);h.advance(500);assert.equal(setup.state.poses.at(-1)[0],paused);
  h.play.emit('click');h.advance(1000);assert.equal(setup.state.poses.at(-1)[0],paused,'resume does not jump through hidden time');
  h.hooks.before();assert.equal(h.frames.size,0);
});

test('armillary yields to the next poster and resumes without hidden time',async()=>{
  const setup=renderedGpu(),h=harness(setup);await h.hooks.swap();
  h.advance(100);h.advance(120);const held=setup.state.poses.at(-1)[0],count=setup.state.poses.length;
  h.window.emit('eng:journeyexposure',{detail:{active:true}});
  assert.equal(h.frames.size,0);assert.equal(setup.state.visible.at(-1),false);h.advance(10000);assert.equal(setup.state.poses.length,count);
  h.window.emit('eng:journeyexposure',{detail:{active:false}});h.advance(10020);assert.equal(setup.state.poses.at(-1)[0],held);
  h.advance(10040);assert(setup.state.poses.at(-1)[0]>held);
  h.window.__engNav.busy=true;h.window.emit('eng:journeyexposure',{detail:{active:false}});assert.equal(h.frames.size,0);
  h.window.__engNav.busy=false;h.window.emit('eng:journeysettled');h.advance(10100);assert.equal(h.frames.size,1);
  h.hooks.before();assert.equal(h.frames.size,0);
});

test('hidden, offscreen, reduced and disposed armillary scenes stop scheduling orbit work',async()=>{
  const setup=renderedGpu(),h=harness(setup);await h.hooks.swap();
  h.document.hidden=true;h.document.emit('visibilitychange');assert.equal(h.frames.size,0);
  assert.equal(setup.state.visible.at(-1),false);
  h.document.hidden=false;h.document.emit('visibilitychange');h.advance(1100);assert.equal(h.frames.size,1);
  h.observers[0].fn([{isIntersecting:false}]);assert.equal(h.frames.size,0);
  h.window.emit('eng:journeysettled');assert.equal(h.frames.size,0);
  h.observers[0].fn([{isIntersecting:true}]);h.advance(2000);assert.equal(h.frames.size,1);
  h.motion.matches=true;h.motion.emit('change');h.advance(2020);assert.equal(h.frames.size,0);assert(h.play.hidden);
  const count=setup.state.poses.length;h.advance(2040);assert.equal(setup.state.poses.length,count);
  h.motion.matches=false;h.motion.emit('change');h.advance(2060);assert.equal(h.frames.size,1);
  h.hooks.before();assert(h.observers[0].disconnected);assert(setup.state.controllers[0].destroyed);
  h.window.emit('eng:journeysettled');h.window.emit('eng:journeyexposure',{detail:{active:false}});assert.equal(h.frames.size,0);
});

test('reduced motion displays its first marble frame without an orbit loop',async()=>{
  const setup=renderedGpu(),h=harness({...setup,reduced:true,journeyBusy:true});await h.hooks.swap();
  assert.equal(h.host.dataset.renderer,'webgpu');assert.equal(h.frames.size,0);assert(h.play.hidden);
  h.window.__engNav.busy=false;h.window.emit('eng:journeysettled');h.advance(100);assert.equal(h.frames.size,0);
  assert.equal(setup.state.poses.at(-1)[0],-.30);h.hooks.before();
});
