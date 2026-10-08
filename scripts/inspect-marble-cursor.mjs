// Native Chrome review of the actual shipped cursor asset and WebGPU shader.
// Run against a frozen local release; no SwiftShader or GPU substitution.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {Cdp} from './local-chrome-cdp.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return[k,v.join('=')];}));
const origin=new URL(args.url||'http://127.0.0.1:3097');
if(!['127.0.0.1','localhost'].includes(origin.hostname))throw Error('Review only an explicitly local release');
const output=resolve(args.output||'/tmp/engmanager-marble-hand-review/native');
await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'marble-cursor-chrome-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let child,page,browser;
const report={origin:origin.href,cases:[],errors:[]};
async function evaluate(expression){const r=await page.command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression,label){const deadline=Date.now()+18000;while(Date.now()<deadline){try{if(await evaluate(expression))return;}catch(error){if(error.cdp?.code!==-32000||!/context/i.test(error.message))throw error;}await delay(60);}throw Error('Timed out '+label);}
function assert(value,label){if(!value)throw Error(label);}
async function shot(name){const r=await page.command('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(join(output,name+'.png'),Buffer.from(r.data,'base64'));}
async function ready(){await until('document.readyState==="complete"&&window.__engNav?.ready&&!window.__engNav.busy&&window.__engCursorRenderer','route readiness');await evaluate('(async()=>{await window.__engTypography?.ready;await document.fonts.ready;await Promise.all([...document.images].filter(img=>{const b=img.getBoundingClientRect();return b.top<innerHeight&&b.bottom>0}).map(img=>img.decode()))})()');}
async function move(x,y){await page.command('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});}
async function mouse(type,x,y){await page.command('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});}
async function nativeKey(key,code,windowsVirtualKeyCode){for(const type of ['keyDown','keyUp'])await page.command('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode});}
const active='document.querySelector("[data-cursor-overlay]")?.dataset.visible==="true"';
const probe=`(()=>{
 const p=window.__cursorProbe={devices:[],workers:[],errors:[],requests:[],submissions:0,violations:[]};
 window.addEventListener('eng:journeyexposure',e=>{p.exposed=e.detail.active;});
 document.addEventListener('securitypolicyviolation',e=>p.violations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
 const request=window.fetch;window.fetch=(url,...args)=>{if(String(url).includes('/cursors/'))p.requests.push(String(url));return request(url,...args)};
 if(navigator.gpu){const requestAdapter=navigator.gpu.requestAdapter.bind(navigator.gpu);navigator.gpu.requestAdapter=async(...args)=>{
  const adapter=await requestAdapter(...args);if(!adapter)return adapter;const info=adapter.info;p.adapter={vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description};
  const requestDevice=adapter.requestDevice.bind(adapter);adapter.requestDevice=async(...args)=>{
   const device=await requestDevice(...args),record={submissions:0,destroyed:false};p.devices.push(record);device.__cursorRecord=record;
   const create=device.createShaderModule.bind(device);device.createShaderModule=(...args)=>{record.label=args[0].label;return create(...args)};
   const submit=device.queue.submit.bind(device.queue);device.queue.submit=(...args)=>{record.submissions++;p.submissions++;return submit(...args)};
   const destroy=device.destroy.bind(device);device.destroy=()=>{record.destroyed=true;return destroy()};
   const write=device.queue.writeBuffer.bind(device.queue);device.queue.writeBuffer=(...args)=>{if(args[2] instanceof Float32Array&&args[2].length===8)record.scene=[...args[2]];return write(...args)};
   device.addEventListener('uncapturederror',e=>p.errors.push(e.error.message));return device;
  };return adapter;
 };}
 if(window.Worker){const Native=window.Worker;window.Worker=class extends Native{
  constructor(url,...args){super(url,...args);this.record={url:String(url),replies:0,terminated:false};p.workers.push(this.record);this.addEventListener('message',e=>{if(Array.isArray(e.data.model)&&e.data.model.every(p=>p.vertices instanceof Float32Array&&p.indices instanceof Uint32Array))this.record.replies++;});}
  terminate(){this.record.terminated=true;return super.terminate();}
 };}
 const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const context=get.call(this,type,...args);if(type==='webgpu'&&context){const configure=context.configure.bind(context);context.configure=(...args)=>{this.__cursorDevice=args[0].device;return configure(...args)};}return context;};
})()`;
try{
 const chrome=args.chrome||process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 child=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--window-size=1200,900','about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((yes,no)=>{let log='';const timer=setTimeout(()=>no(Error('Chrome startup timed out')),20000);child.stderr.on('data',chunk=>{log+=chunk;const found=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(found){clearTimeout(timer);yes(found[1]);}});child.once('exit',code=>{clearTimeout(timer);no(Error('Chrome exited '+code));});});
 browser=new Cdp(endpoint);const {targetId}=await browser.command('Target.createTarget',{url:'about:blank'});const endpointUrl=new URL(endpoint);const tabs=await(await fetch(`http://${endpointUrl.host}/json/list`)).json();page=new Cdp(tabs.find(tab=>tab.id===targetId).webSocketDebuggerUrl);
 await page.command('Runtime.enable');await page.command('Page.enable');await page.command('Page.addScriptToEvaluateOnNewDocument',{source:probe});
 await page.command('Network.enable');await page.command('Network.setBypassServiceWorker',{bypass:true});
 await page.command('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:2,mobile:false});
 await page.command('Page.navigate',{url:new URL('/feed',origin).href});await ready();
 report.browser=await browser.command('Browser.getVersion');
 if(args.exposure==='only'){
  await move(35,175);await until(active,'native cursor before automatic reveal');
  await evaluate('(()=>{const r=document.querySelector("[data-journey-runway]");if(!r)throw Error("Missing runway");scrollTo({top:scrollY+r.getBoundingClientRect().top-innerHeight*1.15,behavior:"instant"});})()');
  await until('document.querySelector("[data-journey-next][data-preview-ready] [role=img][data-rendered]")&&!window.__engNav.busy','real scroll reveals native poster');
  await page.command('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:0,deltaY:675});
  await until('window.__cursorProbe.exposed===true','native wheel enters the prepared reveal');
  const point=await evaluate('(()=>{const b=document.querySelector("[data-journey-promote]").getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()');
  await move(point.x,point.y);await until('document.querySelector("[data-cursor-overlay]")?.dataset.visible==="false"','curtain hides the cursor');
  const submissions=await evaluate('window.__cursorProbe.devices.filter(d=>d.label==="Marble cursor").reduce((n,d)=>n+d.submissions,0)');
  await delay(240);assert(await evaluate('window.__cursorProbe.devices.filter(d=>d.label==="Marble cursor").reduce((n,d)=>n+d.submissions,0)')===submissions,'exposed cursor submits no frames');
  assert(await evaluate(`document.elementFromPoint(${point.x},${point.y})?.closest('[data-journey-promote]')!==null`),'real Continue hit testing');await shot('curtain-hidden-cursor');
  await evaluate('scrollTo({top:0,behavior:"instant"})');await until('window.__cursorProbe.exposed===false','scroll back clears reveal');await move(35,175);await until(active,'scroll back restores native cursor');await shot('curtain-restored-cursor');
  report.cases.push({mode:'automatic-reveal-restoration',probe:await evaluate('window.__cursorProbe')});
  assert(report.cases[0].probe.errors.length===0&&report.cases[0].probe.violations.length===0,'no native GPU or CSP errors during reveal');
 }else{
 // The real served renderer and GLB are displayed at cursor size, against both
 // palettes. Each camera state uses back-face culling and the actual WGSL.
 report.gallery=await evaluate(`(async()=>{
  const config=document.querySelector('[data-cursor-models]'),panel=document.createElement('section');panel.id='cursor-model-review';panel.style.cssText='position:fixed;inset:30px 30px auto;z-index:2147483646;background:#252c2a;color:white;padding:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;font:15px monospace';
  document.body.append(panel);const results=[];
  for(const [name,background,state] of [['front','#061c11',{mode:'open',tiltX:-.04,tiltY:.08}],['three-quarter','#061c11',{mode:'open',tiltX:.26,tiltY:-.52}],['profile','#061c11',{mode:'open',tiltX:Math.PI/2-.04,tiltY:.08}],['grip','#061c11',{mode:'grab',grip:1,press:1}],['front-light','#f4f1e8',{mode:'open'}],['grip-light','#f4f1e8',{mode:'grab',grip:1}],['arrow','#061c11',{mode:'arrow'}]]){
   const card=document.createElement('div');card.style.cssText='padding:12px;background:'+background+';color:'+(background==='#061c11'?'#f4f1e8':'#061c11');const label=document.createElement('div');label.textContent=name;const canvas=document.createElement('canvas');canvas.style.cssText='display:block;width:192px;height:192px';card.append(label,canvas);panel.append(card);
   const renderer=await window.__engCursorRenderer.create(canvas,{pointerUrl:config.dataset.pointerUrl,handUrl:config.dataset.handUrl,onFailure:error=>window.__cursorProbe.errors.push(error.message)});renderer.render(state);await canvas.__cursorDevice.queue.onSubmittedWorkDone();
   const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);const pixels=ctx.getImageData(0,0,copy.width,copy.height).data;let opaque=0,bright=0,left=copy.width,right=0,top=copy.height,bottom=0;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>128){opaque++;if(pixels[i]>180&&pixels[i+1]>180&&pixels[i+2]>180)bright++;const x=(i/4)%copy.width,y=Math.floor(i/4/copy.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   renderer.dispose();canvas.replaceWith(copy);copy.style.cssText='display:block;width:192px;height:192px';results.push({name,opaque,bright,bounds:{left,right,top,bottom},size:copy.width});
  }return results;
 })()`);
 for(const item of report.gallery){assert(item.opaque>1500,'actual GPU triangles visible '+item.name);if(!item.name.includes('arrow'))assert(item.bright/item.opaque>.45,'high-key white marble '+item.name);assert(item.bounds.left>0&&item.bounds.top>0&&item.bounds.right<item.size-1&&item.bounds.bottom<item.size-1,'uncropped model '+item.name);}
 await shot('model-gallery');
 assert((await evaluate('window.__cursorProbe.errors')).length===0,'native WGSL/render validation');
 await evaluate('document.querySelector("#cursor-model-review").remove()');
 for(const route of ['/', '/feed']){
  await page.command('Page.navigate',{url:new URL(route,origin).href});await ready();
  assert((await evaluate('window.__cursorProbe.requests')).length===0,'no models before mouse intent');
  const point=await evaluate('(()=>{const node=[...document.querySelectorAll("a[href^=\\"/articles/\\"]")].find(a=>{const b=a.getBoundingClientRect();return b.width>100&&b.top>80&&b.bottom<innerHeight});if(!node)throw Error("No visible article link");const b=node.getBoundingClientRect();return{x:b.x+Math.min(40,b.width/2),y:b.y+b.height/2}})()');
  await move(point.x,point.y);await until(active,'normal marble cursor on '+route);await until('window.__cursorProbe.devices.some(d=>d.label==="Marble cursor"&&d.submissions>0)','native cursor draw');
  const pose=await evaluate('(()=>{const n=document.querySelector("[data-cursor-overlay]");return{mode:n.dataset.mode,transform:n.style.transform,bounds:n.getBoundingClientRect().toJSON(),scene:window.__cursorProbe.devices.find(d=>d.label==="Marble cursor").scene}})()');
  assert(pose.mode==='open','links use the Creation hand');
  assert(Math.abs(pose.bounds.x+36-point.x)<.01&&Math.abs(pose.bounds.y+54-point.y)<.01,'actual index tip follows the native pointer exactly');
  await shot(route==='/'?'homepage-hand':'feed-hand');
  await delay(1000);const idle=await evaluate('window.__cursorProbe.devices.filter(d=>d.label==="Marble cursor").reduce((n,d)=>n+d.submissions,0)');await delay(240);assert(await evaluate('window.__cursorProbe.devices.filter(d=>d.label==="Marble cursor").reduce((n,d)=>n+d.submissions,0)')===idle,'cursor stops drawing when its springs settle');
  report.cases.push({route,pose,probe:await evaluate('window.__cursorProbe')});
  // Opening the real bio verifies a click and top-layer pointer transparency.
  const photo=await evaluate('(()=>{const node=document.querySelector("[data-avatar-bouncer]");window.__engAvatarBouncer.hold(node,true);window.__engAvatarBouncer.place(node,550,230);const b=node.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()');
  await move(photo.x,photo.y);await mouse('mousePressed',photo.x,photo.y);await mouse('mouseReleased',photo.x,photo.y);await until('document.querySelector("#bio").matches(":popover-open")','native fingertip click opens bio');await until(active,'marble stays above the bio');await shot('bio-hand');await nativeKey('Escape','Escape',27);await until('!document.querySelector("#bio").matches(":popover-open")','Escape closes bio');
  // A real drag must switch to the preserved Grip morph and still drop exactly.
  const chip=await evaluate('(()=>{const node=[...document.querySelectorAll("[data-chip-id]")].find(n=>{const b=n.getBoundingClientRect();return b.left>0&&b.right<innerWidth&&b.top>80&&b.bottom<innerHeight});const b=node.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()');
  await move(chip.x,chip.y);await mouse('mousePressed',chip.x,chip.y);for(const [x,y] of [[chip.x+10,chip.y+5],[chip.x+50,chip.y+30],[chip.x+110,chip.y+60]])await page.command('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'left',buttons:1});
  await until('document.body.dataset.dragging==="true"&&document.querySelector("[data-cursor-overlay]")?.dataset.mode==="grab"','real drag applies the Grip morph');await shot('drag-hand');
  await until('window.__cursorProbe.devices.find(d=>d.label==="Marble cursor").scene[3]>.9','native Grip deformation draws');
  await mouse('mouseReleased',chip.x+110,chip.y+60);await until('document.body.dataset.dragging!=="true"','drag release');
  await evaluate('window.__engNav.navigate("/shop")');await until('location.pathname==="/shop"&&!window.__engNav.busy','navigate away');assert(await evaluate('!document.querySelector("[data-cursor-overlay]")&&window.__cursorProbe.devices.filter(d=>d.label==="Marble cursor").every(d=>d.destroyed)'),'leaving releases the native cursor GPU');
  await until('window.__cursorProbe.workers.filter(w=>w.url.includes("cursor-renderer")).every(w=>w.terminated)','native idle cursor worker shuts down');
  report.cases.push({route,disposed:await evaluate('window.__cursorProbe')});
  await evaluate('window.__engNav.navigate("/feed")');await ready();await move(35,175);await until(active,'retained feed gets one fresh cursor');assert(await evaluate('document.querySelectorAll("[data-cursor-overlay]").length===1'),'retained route has one cursor');
 }
 for(const mode of ['reduced','save-data','unavailable-gpu','unavailable-worker']){
  await page.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:mode==='reduced'?'reduce':'no-preference'}]});
  const setup=mode==='save-data'?'Object.defineProperty(navigator.connection,"saveData",{configurable:true,value:true})':mode==='unavailable-gpu'?'Object.defineProperty(navigator,"gpu",{configurable:true,value:undefined})':mode==='unavailable-worker'?'Object.defineProperty(window,"Worker",{configurable:true,value:undefined})':'';
  const hook=setup?await page.command('Page.addScriptToEvaluateOnNewDocument',{source:setup}):null;
  await page.command('Page.navigate',{url:new URL('/feed',origin).href});await ready();await move(35,175);
  if(mode==='unavailable-worker'){await until(active,'cooperative native renderer fallback');assert(await evaluate('window.__cursorProbe.workers.length===0'),'worker fallback uses identical cooperative validation');}
  else{await delay(200);assert(await evaluate('!document.querySelector("[data-cursor-overlay]")&&window.__cursorProbe.requests.length===0'),'native cursor fallback '+mode);}
  report.cases.push({mode,probe:await evaluate('window.__cursorProbe')});await shot(mode);if(hook)await page.command('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});
 }
 await page.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 }
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
 console.log((args.exposure==='only'?'Native automatic reveal, Continue hit testing, cursor suspension and scroll-back restoration passed. ':'Actual marble GLB, WGSL, white/dark appearance, hotspot, native click/Grip, retained navigation and fallbacks passed. ')+join(output,'report.json'));
}catch(error){report.failure=await evaluate('({errorState:window.__cursorProbe,dragging:document.body.dataset.dragging,overlay:document.querySelector("[data-cursor-overlay]")?.outerHTML,photo:{bounds:document.querySelector("[data-avatar-bouncer]")?.getBoundingClientRect().toJSON(),draggable:document.querySelector("[data-avatar-bouncer]")?.draggable},bio:document.querySelector("#bio")?.matches(":popover-open")})').catch(()=>null);await shot('failure').catch(()=>{});await writeFile(join(output,'partial-report.json'),JSON.stringify(report,null,2));throw error;}
finally{page?.close();browser?.close();if(child?.exitCode===null){const exit=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await Promise.race([exit,delay(3000)]);}child?.stderr.destroy();await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});}
