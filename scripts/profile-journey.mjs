#!/usr/bin/env node
// Local, real-Chrome profiling. This is a test runner, never shipped to readers.
// It drives native touch gestures over CDP and records Chrome compositor traces.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { analyzeTrace, distribution, intervals, networkAggregates, pixelWarnings } from './journey-performance-metrics.mjs';
import { Cdp } from './local-chrome-cdp.mjs';
import { parseChromeTrace } from './parse-chrome-trace.mjs';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [name, ...value] = arg.replace(/^--/, '').split('=');
    return [name, value.join('=') || 'true'];
}));
const origin = new URL(options.url || 'http://127.0.0.1:3092');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw new Error('Profile an explicitly local test server only');
const output = resolve(options.output || join(tmpdir(), `journey-perf-${Date.now()}`));
const cpu = Number(options.cpu || 4);
const passes = Number(options.passes || 2);
const legs = Number(options.legs || 5);
if (!Number.isInteger(passes) || passes < 1 || passes > 2 || !Number.isInteger(legs) || legs < 1 || legs > 5 || !Number.isFinite(cpu) || cpu < 1) throw new Error('Use one or two laps, one to five legs, and a CPU throttle of at least one');
if (options.diagnostic && !['observe','hold-preview','hold-hero'].includes(options.diagnostic)) throw new Error('Unknown diagnostic feature isolation');
if (options.diagnostic && options.assert === 'true') throw new Error('Feature isolation is diagnostic evidence and cannot pass a production budget');
if (options['armillary-remount'] === 'true' && (!options.diagnostic || legs !== 4)) throw new Error('The diagnostic cache revisit requires exactly four normal legs ending at Subscribe');
const chrome = options.chrome || process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const deadline = Number(options.timeout || 600000);
const started = Date.now();
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'journey-profile-chrome-'));
let child, page, browser, activeTraceName;
const layerTrees = [];
const discardedProbes = [];
const navigationErrors = [];


async function evaluate(expression) {
    const result = await page.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
}
async function until(expression, description, timeout = 45000) {
    const end = Date.now() + timeout;
    while (Date.now() < end && Date.now() - started < deadline) {
        try { if (await evaluate(expression)) return; }
        catch (error) {
            // Only the expected hard-navigation context gap is transient.
            if (error.cdp?.code !== -32000 || !/context/i.test(error.message)) throw error;
        }
        await delay(80);
    }
    throw new Error(`Timed out waiting for ${description}: ${await evaluate('JSON.stringify({url:location.href,ready:window.__engNav?.ready,busy:window.__engNav?.busy,scroll:scrollY})').catch(() => 'context unavailable')}`);
}

const probe = `(() => {
    const p = window.__journeyPerf = { documentId:Math.random().toString(36),phase: null, phaseBounds:[],frames: [], longTasks: [], longFrames: [], gpuSubmits: [], workers:[], animations:[], errors: [] };
    let last = 0;
    function frame(time) { if (p.phase && last) p.frames.push({phase:p.phase,duration:time-last});last=time;requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    for (const type of ['longtask','long-animation-frame']) {
        try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) {
            const bound=p.phaseBounds.findLast(bound=>entry.startTime>=bound.start&&(bound.end===undefined||entry.startTime<=bound.end));
            const value={phase:bound?.name??null,startTime:entry.startTime,duration:entry.duration};
            if(type==='long-animation-frame')value.scripts=entry.scripts?.map((s)=>({duration:s.duration,forcedStyleAndLayoutDuration:s.forcedStyleAndLayoutDuration,sourceURL:s.sourceURL,sourceFunctionName:s.sourceFunctionName,invoker:s.invoker}));
            p[type==='longtask'?'longTasks':'longFrames'].push(value);
        }}).observe({type,buffered:true}); } catch {}
    }
    if(window.GPUQueue) {
        const labels=new WeakMap();
        const finish=GPUCommandEncoder.prototype.finish;
        GPUCommandEncoder.prototype.finish=function(descriptor){const command=finish.call(this,descriptor);labels.set(command,this.label);return command;};
        const submit=GPUQueue.prototype.submit;
        GPUQueue.prototype.submit=function(commands){if(p.phase&&Array.isArray(commands)&&commands.some(command=>labels.get(command)==='Marble poster frame'))p.gpuSubmits.push({phase:p.phase,gesture:p.gesture??null,time:performance.now()});return submit.call(this,commands);};
    }
    if(window.Worker)window.Worker=new Proxy(window.Worker,{construct(Target,args,newTarget){
        const worker=Reflect.construct(Target,args,newTarget);
        const record={url:new URL(args[0],document.baseURI).href,active:true,jobs:[],replies:[],errors:[]};p.workers.push(record);
        const post=worker.postMessage;worker.postMessage=function(...args){record.jobs.push({id:args[0]?.id,bytes:args[0]?.buffer?.byteLength,time:performance.now()});return post.apply(this,args);};
        const terminate=worker.terminate;worker.terminate=function(...args){record.active=false;return terminate.apply(this,args);};
        worker.addEventListener('message',event=>record.replies.push({id:event.data?.id,vertices:event.data?.model?.vertices?.byteLength,indices:event.data?.model?.indices?.byteLength,error:event.data?.error,time:performance.now()}));
        worker.addEventListener('error',event=>record.errors.push(event.message));
        return worker;
    }});
    const animate=Element.prototype.animate;
    Element.prototype.animate=function(...args){
        const animation=animate.apply(this,args);
        if(p.phase&&this.classList.contains('journey-stage')&&args[1]?.duration===620){
            const name=p.phase+':handoff-animation';const record={name,start:performance.now()};p.animations.push(record);
            performance.mark('journey-perf:'+name+':start');
            const end=()=>{record.end=performance.now();performance.mark('journey-perf:'+name+':end');};
            animation.finished.then(end,end);
        }
        return animation;
    };
    addEventListener('error',(event)=>p.errors.push({message:event.message,source:event.filename}));
    addEventListener('eng:journeyerror',(event)=>{p.errors.push({message:event.detail?.message});window.__journeyPerfReport?.(JSON.stringify({type:'journeyerror',probe:p}));});
    addEventListener('beforeunload',()=>window.__journeyPerfReport?.(JSON.stringify({type:'unload',probe:p})));
    // Keep cache state explicit. A worker's background installation has its own
    // CDP target, so page-only network emulation cannot throttle its requests.
    // A cache-first worker could fill its cache outside the page's 4G shaper.
    // Profile normal worker behavior separately on a
    // physical device or with a network shaper applied to the whole browser.
    if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(new Error('Service worker disabled by local performance fixture'));
})();`;

const diagnosticProbe = options.diagnostic ? `(() => {
    const mode=${JSON.stringify(options.diagnostic)},p=window.__journeyPerf;p.activations=[];
    function mark(name,detail={}){p.activations.push({name,time:performance.now(),phase:p.phase,documentId:p.documentId,...detail});performance.mark('journey-diag:'+name);}
    const create=Document.prototype.createElement;
    Document.prototype.createElement=function(...args){const node=create.apply(this,args);if(args[0]?.toLowerCase()==='iframe'){
        node.addEventListener('load',()=>{mark('iframe-load',{class:node.className});const doc=node.contentDocument;if(doc){
            let populated=false;new MutationObserver(()=>{if(!populated&&doc.body?.firstElementChild){populated=true;mark('preview-body-populated');doc.fonts.ready.then(()=>mark('preview-fonts-ready'));}}).observe(doc,{childList:true,subtree:true});
            doc.fonts.ready.then(()=>mark('iframe-empty-fonts-ready',{class:node.className}));
            if(doc.defaultView.PerformanceObserver){const observer=new doc.defaultView.PerformanceObserver(list=>{for(const entry of list.getEntries())mark('preview-'+entry.name,{paintTime:doc.defaultView.performance.timeOrigin+entry.startTime-performance.timeOrigin});});observer.observe({type:'paint',buffered:true});}
        }});
    }return node;};
    new MutationObserver(records=>{for(const record of records){
        if(record.type==='attributes'&&record.attributeName==='data-renderer')mark('hero-renderer-'+record.target.dataset.renderer,{scene:record.target.dataset.heroScene});
        if(record.type==='attributes'&&record.attributeName==='data-preview-ready'&&record.target.matches('iframe.journey-preview'))mark('preview-ready',{width:record.target.contentWindow.innerWidth,height:record.target.contentWindow.innerHeight,scroll:record.target.contentWindow.scrollY,transform:record.target.style.transform});
        for(const node of record.addedNodes||[]){if(node.nodeType!==1)continue;for(const iframe of [node,...node.querySelectorAll('iframe')].filter(node=>node.matches('iframe.journey-preview'))){
            mark('preview-connected');if(mode==='hold-preview'){iframe.remove();mark('preview-held');}
        }}
    }}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-renderer','data-preview-ready']});
    const context=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(...args){if(mode==='hold-hero'&&this.matches('.article-hero-canvas')&&/webgl/.test(args[0])){mark('hero-held');return null;}return context.apply(this,args);};
    for(const Type of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(Type){const seen=new WeakSet(),draw=Type.prototype.drawArrays;Type.prototype.drawArrays=function(...args){const value=draw.apply(this,args);if(this.canvas.matches?.('.article-hero-canvas')&&!seen.has(this.canvas)){seen.add(this.canvas);mark('hero-first-draw');}return value;};}
    if(window.GPUDevice){const devices=new WeakMap(),pipeline=GPUDevice.prototype.createRenderPipelineAsync,buffer=GPUDevice.prototype.createBuffer;
        GPUDevice.prototype.createRenderPipelineAsync=function(...args){const promise=pipeline.apply(this,args);if(args[0]?.vertex?.entryPoint==='vertex'&&!args[0]?.label){devices.set(this,'armillary');promise.then(()=>mark('armillary-pipeline-resolved'),()=>{});}return promise;};
        GPUDevice.prototype.createBuffer=function(...args){if(devices.get(this)==='armillary'&&(args[0]?.usage&GPUBufferUsage.VERTEX))mark('armillary-vertex-buffer',{bytes:args[0].size});return buffer.apply(this,args);};
    }
})();` : '';

const requests = new Map();
function networkSummary(since) {
    const values = [...requests.values()].filter((request) => request.started >= since);
    return { requests: values.length, encodedBytes: values.reduce((sum, request) => sum + (request.bytes || 0), 0),
        ...networkAggregates(values),
        models: values.filter((request) => /\.glb(?:\?|$)/.test(request.url)),
        slowest: values.filter((request) => request.finished).sort((a,b) => b.durationMs-a.durationMs).slice(0,12),
        unfinished: values.filter((request) => !request.finished) };
}
async function metrics() {
    return Object.fromEntries((await page.command('Performance.getMetrics')).metrics.map(({name,value})=>[name,value]));
}
const phases = [];
async function phase(name, work) {
    const start = await metrics();
    const time = Date.now();
    await evaluate(`window.__journeyPerf.phase=${JSON.stringify(name)};window.__journeyPerf.phaseBounds.push({name:${JSON.stringify(name)},start:performance.now()});performance.mark(${JSON.stringify(`journey-perf:${name}:start`)})`);
    await work();
    await evaluate(`performance.mark(${JSON.stringify(`journey-perf:${name}:end`)});if(window.__journeyPerf.phaseBounds.at(-1)?.name===${JSON.stringify(name)})window.__journeyPerf.phaseBounds.at(-1).end=performance.now();window.__journeyPerf.phase=null`);
    const end = await metrics();
    const delta = Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map((key)=>[key,(end[key]||0)-(start[key]||0)]));
    phases.push({ name, wallMs: Date.now()-time, metrics: delta, final: { JSHeapUsedSize:end.JSHeapUsedSize,Nodes:end.Nodes } });
}
let gestureId=0;
async function gesture(distance, speed = 220) {
    await evaluate(`window.__journeyPerf.gesture=${++gestureId}`);
    await page.command('Input.synthesizeScrollGesture', { x:195,y:660,yDistance:-distance,speed,gestureSourceType:'touch',preventFling:true });
    await evaluate('window.__journeyPerf.gesture=null');
}
async function screenshot(name) {
    const result = await page.command('Page.captureScreenshot',{ format:'png',fromSurface:true });
    await writeFile(join(output,`${name}.png`),Buffer.from(result.data,'base64'));
}
async function decoderWorkers() {
    const targets=(await browser.command('Target.getTargets')).targetInfos.filter((target)=>target.type==='worker');
    const workers=await evaluate('window.__journeyPerf.workers');
    // Chrome154 can leave an undiscovered worker TargetInfo URL empty. A native
    // Worker constructor, successful typed-array reply, live worker target,
    // and matching DedicatedWorker EvaluateScript trace jointly prove the
    // actual decoding path without pausing or debugging a rendering worker.
    return workers.filter(worker=>worker.active&&/\/assets\/js\/journey-poster-renderer\./.test(worker.url))
        .map(worker=>({...worker,liveTargets:targets.map(({targetId,type,url})=>({targetId,type,url}))}));
}
async function traceStart() {
    await page.command('Tracing.start', { transferMode:'ReturnAsStream', categories:'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing,cc,benchmark,viz,gpu,toplevel',options:'record-as-much-as-possible' });
}
async function traceEnd(name) {
    const complete = page.once('Tracing.tracingComplete');
    await page.command('Tracing.end');
    const {stream} = await complete;
    const chunks = [];
    for (;;) {
        const result = await page.command('IO.read',{handle:stream,size:1024*1024});
        chunks.push(Buffer.from(result.data,result.base64Encoded?'base64':'utf8'));
        if(result.eof)break;
    }
    await page.command('IO.close',{handle:stream});
    const data = Buffer.concat(chunks);
    await writeFile(join(output,`${name}.trace.json.gz`),gzipSync(data));
    activeTraceName = null;
    return parseChromeTrace(data);
}

try {
    child = spawn(chrome,[
        '--headless=new','--no-first-run','--no-default-browser-check',
        '--remote-debugging-port=0',`--user-data-dir=${profile}`,
        '--enable-unsafe-webgpu','--disable-background-timer-throttling',
        '--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
        '--window-size=390,844','about:blank',
    ],{stdio:['ignore','ignore','pipe']});
    let stderr='';child.stderr.on('data',(data)=>{stderr+=data;});
    let portFile;
    for(let i=0;i<100;i++) {try{portFile=await readFile(join(profile,'DevToolsActivePort'),'utf8');break;}catch{await delay(100);}}
    if(!portFile)throw new Error(`Chrome did not start: ${stderr.slice(-4000)}`);
    const [port,browserPath]=portFile.trim().split('\n');
    browser = new Cdp(`ws://127.0.0.1:${port}${browserPath}`);
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = new Cdp(tabs.find((tab)=>tab.type==='page').webSocketDebuggerUrl);
    await Promise.all([page.command('Page.enable'),page.command('Runtime.enable'),page.command('Network.enable'),page.command('Performance.enable')]);
    if(options.diagnostic){page.on('LayerTree.layerTreeDidChange',event=>layerTrees.push({time:Date.now(),layers:event.layers}));await page.command('LayerTree.enable');}
    await page.command('Runtime.addBinding',{name:'__journeyPerfReport'});
    page.on('Runtime.bindingCalled',(event)=>{
        if(event.name!=='__journeyPerfReport')return;
        const data=JSON.parse(event.payload);
        if(data.type==='unload')discardedProbes.push(data.probe);
        else navigationErrors.push(data);
    });
    page.on('Network.requestWillBeSent',(event)=>{
        const url=new URL(event.request.url);url.search='';url.hash='';
        requests.set(event.requestId,{url:url.href,type:event.type,started:Date.now(),timestamp:event.timestamp});
    });
    page.on('Network.loadingFinished',(event)=>{
        const request=requests.get(event.requestId);if(request)Object.assign(request,{bytes:event.encodedDataLength,finished:Date.now(),durationMs:(event.timestamp-request.timestamp)*1000});
    });
    page.on('Network.loadingFailed',(event)=>{
        const request=requests.get(event.requestId);if(request)Object.assign(request,{finished:Date.now(),error:event.errorText,durationMs:(event.timestamp-request.timestamp)*1000});
    });
    page.on('Network.responseReceived',(event)=>{
        const request=requests.get(event.requestId);if(request)Object.assign(request,{status:event.response.status,fromServiceWorker:!!event.response.fromServiceWorker,fromDiskCache:!!event.response.fromDiskCache,fromPrefetchCache:!!event.response.fromPrefetchCache});
    });
    await page.command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true,screenWidth:390,screenHeight:844});
    await page.command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    await page.command('Emulation.setCPUThrottlingRate',{rate:cpu});
    await page.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await page.command('Network.emulateNetworkConditions',{offline:false,latency:120,downloadThroughput:4*1024*1024/8,uploadThroughput:1024*1024/8,connectionType:'cellular4g'});
    await page.command('Network.setBypassServiceWorker',{bypass:true});
    await page.command('Network.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',platform:'Android'});
    await page.command('Page.addScriptToEvaluateOnNewDocument',{source:probe});
    if (diagnosticProbe) await page.command('Page.addScriptToEvaluateOnNewDocument',{source:diagnosticProbe});
    const metadata = { label:options.label||'working-tree',origin:origin.href,cpuThrottle:cpu,network:{downloadMbps:4,uploadMbps:1,latencyMs:120},viewport:{width:390,height:844,dpr:2},
        browser:await browser.command('Browser.getVersion'),system:await browser.command('SystemInfo.getInfo'),started:new Date().toISOString(),
        harnessSHA256:createHash('sha256').update(await readFile(new URL('profile-journey.mjs',import.meta.url))).digest('hex'),
        serviceWorker:'Bypassed and registration disabled: page-target CDP shaping does not throttle separate worker network requests. HTTP cache is enabled; cold begins with a new profile and cleared cache, warm reuses it.',
        diagnostic:options.diagnostic||null,armillaryRemount:options['armillary-remount']==='true',
        caveat:'Native desktop GPU with mobile viewport and CPU/network emulation; this is repeatable comparative evidence, not a physical Android device certification. Compositor draw cadence is separate from RAF and GPU submission cadence.' };
    const analysisSources=Object.fromEntries(await Promise.all(['journey-performance-metrics.mjs','parse-chrome-trace.mjs'].map(async name=>[name,createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex')])));
    const report={metadata,analysis:{method:'native-presentations-and-phase-frame-counters-v2',sources:analysisSources},traceLayout:'lap',runs:[]};
    const workerScripts=[];
    for(let pass=0;pass<passes;pass++) {
        const passName=pass===0?'cold':'warm';
        await traceStart();
        activeTraceName=passName;
        await page.command('Network.setCacheDisabled',{cacheDisabled:false});
        if(pass===0)await page.command('Network.clearBrowserCache');
        const loadStarted=Date.now();
        await page.command('Page.navigate',{url:new URL('/feed',origin).href});
        await until('document.readyState==="complete"&&window.__engNav?.ready&&!window.__engNav.busy','feed startup',90000);
        if(options.diagnostic)await page.command('LayerTree.enable');
        await evaluate('localStorage.removeItem("engmanager.reading-progress.v1");localStorage.removeItem("engmanager.reading-cleanup.v1");window.__engReading?.reset()');
        const roster=await evaluate('window.__journeyArticles.articles');
        const articleIndex=options.article?roster.findIndex((article)=>article.slug===options.article):0;
        if(articleIndex<0)throw new Error(`Unknown public article slug: ${options.article}`);
        if(articleIndex)await evaluate(`window.__journeyArticles.articles.slice(0,${articleIndex}).forEach(article=>window.__engReading.complete(article.slug))`);
        const destinations=[roster[articleIndex].path,'/shop','/coach','/subscribe','/feed'];
        const fingerprints=await evaluate('[...document.head.querySelectorAll("script[src],link[rel=stylesheet][href]")].map(node=>node.src||node.href)');
        const run={name:passName,startupMs:Date.now()-loadStarted,startupNetwork:networkSummary(loadStarted),legs:[]};
        run.startupAssetFingerprints=fingerprints;
        for(let leg=0;leg<Math.min(legs,destinations.length);leg++) {
            const from=await evaluate('location.pathname');
            const destination=destinations[leg];
            const name=`${passName}-${leg+1}-${from.replace(/\W+/g,'-') || 'feed'}`;
            console.log(`${name} -> ${destination}`);
            const firstPhase=phases.length,networkStarted=Date.now();
            await phase(`${name}:reveal`,async()=>{
                await evaluate('(()=>{const r=document.querySelector("[data-journey-runway]");if(!r)throw Error("Missing runway");scrollTo({top:scrollY+r.getBoundingClientRect().top-innerHeight*1.15,behavior:"instant"});})()');
                await gesture(844*.8,220);
                await until('document.querySelector("[data-journey-next][data-preview-ready]")&&!window.__engNav.busy','ready reveal poster');
            });
            await phase(`${name}:model-loading`,async()=>{
                await until('document.querySelector(".journey-poster-art[data-rendered]")','actual WebGPU poster initialization',30000);
            });
            await screenshot(`${name}-poster`);
            await phase(`${name}:scroll`,async()=>{for(let i=0;i<3;i++){await gesture(75,140);await gesture(-75,140);}});
            const before = await evaluate('({path:location.pathname,still:!!document.querySelector(".journey-poster-art[data-rendered]"),canvas:[...document.querySelectorAll(".journey-poster-art canvas")].map(c=>({width:c.width,height:c.height,rect:{width:c.clientWidth,height:c.clientHeight}})),curtain:!!document.querySelector("[data-journey-curtain]"),overflow:document.documentElement.scrollWidth>innerWidth+1})');
            before.decoderWorkers=await decoderWorkers();
            if(before.path!==from||!before.still||before.overflow)throw new Error(`Visual/readiness invariant failed: ${JSON.stringify(before)}`);
            await phase(`${name}:promotion`,async()=>{
                const documentId=await evaluate('window.__journeyPerf.documentId');
                const point=await evaluate('(()=>{const c=document.querySelector("[data-journey-promote]").getBoundingClientRect();return{x:c.left+c.width/2,y:c.top+c.height/2}})()');
                await page.command('Input.synthesizeTapGesture',{...point,gestureSourceType:'touch'});
                await until(`location.pathname===${JSON.stringify(destination)}&&window.__engNav?.ready&&!window.__engNav.busy&&(document.querySelector('[data-journey-current][data-journey-rendered="true"]')||window.__journeyPerf.documentId!==${JSON.stringify(documentId)})`,'destination mounted/fonts/images ready or explicit hard-navigation fallback',90000);
                before.hardNavigationFallback=await evaluate(`window.__journeyPerf.documentId!==${JSON.stringify(documentId)}`);
            });
            await phase(`${name}:settled`,()=>delay(1000));
            await screenshot(`${name}-destination`);
            const currentProbe=await evaluate('window.__journeyPerf');
            const snapshots=[...discardedProbes,currentProbe].filter((probe,index,all)=>all.findLastIndex((other)=>other.documentId===probe.documentId)===index);
            const probeData=Object.fromEntries(['frames','longTasks','longFrames','gpuSubmits','animations','errors','activations'].map((key)=>[key,snapshots.flatMap((probe)=>probe[key]||[])]));
            const selected=phases.slice(firstPhase);
            const samples=selected.map((phase)=>({...phase,
                raf:distribution(probeData.frames.filter((frame)=>frame.phase===phase.name).map((frame)=>frame.duration)),
                gpuSubmit:intervals(probeData.gpuSubmits.filter((frame)=>frame.phase===phase.name).map((frame)=>frame.time)),
                gpuSubmitActive:distribution([...new Set(probeData.gpuSubmits.filter(frame=>frame.phase===phase.name&&frame.gesture!==null).map(frame=>frame.gesture))].flatMap(gesture=>{const times=probeData.gpuSubmits.filter(frame=>frame.phase===phase.name&&frame.gesture===gesture).map(frame=>frame.time);return times.slice(1).map((time,index)=>time-times[index]);})),
                longTasks:probeData.longTasks.filter((task)=>task.phase===phase.name),longAnimationFrames:probeData.longFrames.filter((frame)=>frame.phase===phase.name)}));
            const assetFingerprints=await evaluate('[...document.head.querySelectorAll("script[src],link[rel=stylesheet][href]")].map(node=>node.src||node.href)');
            run.legs.push({from,to:destination,visual:before,phases:samples,diagnosticActivations:currentProbe.activations||[],handoffAnimation:probeData.animations.filter(animation=>animation.name.startsWith(name)).map(animation=>({...animation,wallMs:animation.end-animation.start,longTasks:probeData.longTasks.filter(task=>task.startTime>=animation.start&&task.startTime<=animation.end)})),network:networkSummary(networkStarted),errors:probeData.errors,navigationErrors:navigationErrors.filter((event)=>event.probe.phase?.startsWith(name)).map((event)=>event.probe.errors),assetFingerprints});
            await writeFile(join(output,'report.json'),JSON.stringify({...report,runs:[...report.runs,run]},null,2));
            console.log(JSON.stringify(samples.map((phase)=>({phase:phase.name.split(':').at(-1),ms:phase.wallMs,rafP95:phase.raf.p95,submitP50:phase.gpuSubmit.p50,longTasks:phase.longTasks.length}))));
        }
        if(options['armillary-remount']==='true') {
            const documentId=await evaluate('window.__journeyPerf.documentId');
            const name=`${passName}:armillary-cache-revisit`;
            await phase(name,async()=>{
                const resume=await evaluate('(()=>{const r=document.querySelector("[data-journey-resume]").getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()');
                await page.command('Input.synthesizeTapGesture',{...resume,gestureSourceType:'touch'});
                await until('location.pathname==="/coach"&&window.__engNav?.ready&&!window.__engNav.busy','native Resume returns to Coach');
                await evaluate('(()=>{const r=document.querySelector("[data-journey-runway]");scrollTo({top:scrollY+r.getBoundingClientRect().top-innerHeight*1.15,behavior:"instant"});})()');
                await gesture(844*.8,220);
                await until('document.querySelector("[data-journey-next][data-preview-ready] .journey-poster-art[data-rendered]")&&!window.__engNav.busy','native scroll reveals the returning Subscribe poster');
                const next=await evaluate('(()=>{const r=document.querySelector("[data-journey-promote]").getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()');
                await page.command('Input.synthesizeTapGesture',{...next,gestureSourceType:'touch'});
                await until('location.pathname==="/subscribe"&&window.__engNav?.ready&&!window.__engNav.busy&&document.querySelector("[data-journey-current][data-journey-rendered=true]")','native Continue remounts Subscribe');
                if(await evaluate('window.__journeyPerf.documentId')!==documentId)throw new Error('Diagnostic CPU cache revisit hard-navigated instead of retaining the document');
            });
            const data=await evaluate('window.__journeyPerf');
            const bound=data.phaseBounds.findLast(bound=>bound.name===name);
            run.armillaryCacheRevisit={phase:phases.at(-1),documentIdPreserved:true,
                activations:data.activations.filter(event=>event.time>=bound.start&&event.time<=bound.end)};
        }
        const events=await traceEnd(passName);
        const traced=analyzeTrace(events,[...run.legs.flatMap(leg=>[...leg.phases.map(phase=>phase.name),...leg.handoffAnimation.map(animation=>animation.name)]),...(run.armillaryCacheRevisit?[run.armillaryCacheRevisit.phase.name]:[])]);
        if(run.armillaryCacheRevisit)run.armillaryCacheRevisit.phase.trace=traced[run.armillaryCacheRevisit.phase.name];
        const workerThreads=new Set(events.filter(event=>event.name==='thread_name'&&/DedicatedWorker/.test(event.args?.name)).map(event=>`${event.pid}:${event.tid}`));
        for(const event of events.filter(event=>event.name==='EvaluateScript'&&workerThreads.has(`${event.pid}:${event.tid}`)&&/\/assets\/js\/journey-poster-renderer\./.test(event.args?.data?.url)))
            workerScripts.push({pid:event.pid,tid:event.tid,url:event.args.data.url,trace:passName});
        for(const leg of run.legs){for(const phase of leg.phases)phase.trace=traced[phase.name];for(const animation of leg.handoffAnimation)animation.trace=traced[animation.name];for(const worker of leg.visual.decoderWorkers)worker.scriptTrace=workerScripts.filter(script=>script.url===worker.url&&script.pid===leg.phases[0].trace.pid);leg.pixelWarnings=pixelWarnings(leg);}
        report.runs.push(run);
        await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
    }
    metadata.completed=new Date().toISOString();
    report.pixelWarnings=report.runs.flatMap(run=>run.legs.flatMap(leg=>leg.pixelWarnings.map(warning=>({run:run.name,from:leg.from,to:leg.to,...warning}))));
    report.network=networkSummary(0);
    report.assertion={status:'not-requested',budgetVersion:'scroll-fade-settled-longtasks-v2',failures:[]};
    await writeFile(join(output,'requests.json'),JSON.stringify([...requests.values()],null,2));
    if(options.diagnostic){const document=await page.command('DOM.getDocument',{depth:-1,pierce:true});await writeFile(join(output,'layers.json'),JSON.stringify({layerTrees,document},null,2));}
    await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
    if(options.assert==='true') {
        const failures=[];
        for(const run of report.runs)for(const leg of run.legs) {
            if(leg.visual.hardNavigationFallback||leg.navigationErrors.length)failures.push(`${run.name} ${leg.from} -> ${leg.to}: failed same-document promotion`);
            if(!leg.visual.decoderWorkers?.some(worker=>worker.liveTargets.length&&worker.scriptTrace.length&&!worker.errors.length&&worker.jobs.some(job=>job.bytes>0&&worker.replies.some(reply=>reply.id===job.id&&reply.vertices>0&&reply.indices>0&&!reply.error))))failures.push(`${run.name} ${leg.to}: native model decoder Worker target/script/typed-array reply was not proven`);
            const scroll=leg.phases.find((phase)=>phase.name.endsWith(':scroll'));
            const tracked=scroll?.trace.frameSequenceTotals.TouchScroll;
            if(!tracked||tracked.expected<180||scroll.trace.presentation.count<180)failures.push(`${run.name} ${leg.to}: insufficient real presented-scroll evidence`);
            if(tracked&&tracked.droppedPercent>5)failures.push(`${run.name} ${leg.to}: excessive native scroll drops`);
            if(!scroll?.trace.pipelinePresentation.count||scroll.trace.pipelinePresentation.missingContent)failures.push(`${run.name} ${leg.to}: missing actual native scroll presentation evidence or pixels`);
            if(scroll?.trace.presentation.p95>20||scroll?.trace.presentation.over50)failures.push(`${run.name} ${leg.to}: scrolling presentation exceeded 20ms p95 or stalled over50ms`);
            if(!scroll?.gpuSubmitActive.count||scroll.gpuSubmitActive.p50>20||scroll.gpuSubmitActive.p95>20||scroll.gpuSubmitActive.over50)failures.push(`${run.name} ${leg.to}: sculpture did not update at the60Hz input cadence`);
            if(scroll?.longTasks.length)failures.push(`${run.name} ${leg.to}: long task during warmed continuous scroll`);
            const settled=leg.phases.find(phase=>phase.name.endsWith(':settled'));
            if(settled?.trace.pipelinePresentation.missingContent)failures.push(`${run.name} ${leg.to}: missing native pixels after the handoff settled`);
            if(settled?.longTasks.length)failures.push(`${run.name} ${leg.to}: main-thread long task after the visible handoff settled`);
            if(leg.handoffAnimation.length!==1)failures.push(`${run.name} ${leg.to}: actual poster handoff animation was not measured`);
            for(const animation of leg.handoffAnimation){
                const compositor=animation.trace.frameSequenceTotals.CompositorAnimation;
                if(!compositor||compositor.expected<30)failures.push(`${run.name} ${leg.to}: handoff compositor evidence is incomplete`);
                if(compositor&&compositor.droppedPercent>5)failures.push(`${run.name} ${leg.to}: handoff dropped frames`);
                if(animation.trace.pipelinePresentation.count<30||animation.trace.pipelinePresentation.missingContent)failures.push(`${run.name} ${leg.to}: handoff has missing actual native presentation evidence or pixels`);
                if(animation.trace.compositorDraw.p95>20||animation.trace.compositorDraw.over50||animation.longTasks.length)failures.push(`${run.name} ${leg.to}: visible handoff exceeded20ms p95 or stalled`);
            }
        }
        report.assertion={status:failures.length?'failed':'passed',budgetVersion:'scroll-fade-settled-longtasks-v2',failures};
        await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
        if(failures.length)throw new Error(`Performance budgets failed:\n${failures.join('\n')}`);
    }
    console.log(`Saved ${join(output,'report.json')}`);
} catch(error) {
    await writeFile(join(output,'failure.txt'),error.stack);
    if(activeTraceName)await traceEnd(`${activeTraceName}-failure`).catch(()=>{});
    throw error;
} finally {
    page?.close();browser?.close();
    if(child&&child.exitCode===null) {
        const exited=new Promise((resolveExit)=>child.once('exit',resolveExit));
        child.kill('SIGTERM');
        await Promise.race([exited,delay(3000)]);
    }
    // Chrome's crash handler can inherit stderr after the browser exits.
    // Release our pipe so that completed profiling can terminate cleanly.
    child?.stderr?.destroy();
    await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200}).catch(()=>{});
}
