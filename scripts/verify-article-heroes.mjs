#!/usr/bin/env node
// Compile and visually capture every authored scene with the actual served
// bundle. This fixture is local test tooling and never ships with the website.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Cdp } from './local-chrome-cdp.mjs';

const options=Object.fromEntries(process.argv.slice(2).map((arg)=>{const [key,...value]=arg.replace(/^--/,'').split('=');return[key,value.join('=')||'true'];}));
const origin=new URL(options.url||'http://127.0.0.1:3092');
if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname))throw Error('Use an explicitly local server');
const output=resolve(options.output||join(tmpdir(),`article-hero-native-${Date.now()}`));
await mkdir(output,{recursive:true});
const pageHtml=await(await fetch(new URL('/articles/your-gmail-avatar-is-part-of-your-job-search',origin))).text();
const script=pageHtml.match(/<script[^>]+src="([^"]*\/js\/article-heroes\.[^"]+\.js)"/)[1];
const css=pageHtml.match(/<link[^>]+href="([^"]*\/css\/article-heroes\.[^"]+\.css)"/)[1];
const [source,bundle,style]=await Promise.all([
    readFile(new URL('../website/src/pages/article_hero.rs',import.meta.url),'utf8'),
    fetch(new URL(script,origin)).then((response)=>response.text()),
    fetch(new URL(css,origin)).then((response)=>response.text()),
]);
const specs=[...source.matchAll(/HeroSpec \{\s*slug: "([^"]+)",\s*name: "([^"]+)",\s*description: "([^"]+)",\s*poster: r#"([\s\S]*?)"#,\s*\}/g)]
    .map(([,slug,name,description,poster])=>({slug,name,description,poster}));
if(specs.length!==12)throw Error(`Expected all12 hero specifications, found${specs.length}`);
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>
:root{--paper:#181b21;--ink:#d9dce5;--plum:#7aa2fa;--ink-soft:#6480a2;--accent:#7aa2fa;--ctp-mantle:#181b21;--ctp-text:#d9dce5;--ctp-blue:#89b4fa;--ctp-pink:#f5c2e7;background:#181b21;color:#d9dce5;font-family:system-ui}body{margin:0;padding:20px}h1{font:700 18px/1.3 system-ui;overflow-wrap:anywhere}button{display:block;margin:25px auto;font:16px monospace;padding:15px}figure[hidden]{display:none}</style></head><body><h1 id="name"></h1><main id="slot"></main><button id="next">Next scene</button>
<script>const specs=${JSON.stringify(specs)};let index=0;window.__heroReview={renders:[],disposals:[],errors:[]};window.__engNav={busy:false,onBeforeSwap(fn){this.before=fn},onSwap(fn){this.swap=fn}};
function show(){const spec=specs[index],old=document.querySelector('figure');window.__engNav.before?.();if(old)window.__heroReview.disposals.push({slug:old.dataset.articleHero,renderer:old.dataset.renderer??null});document.getElementById('name').textContent=spec.name+' / '+spec.slug;document.getElementById('slot').innerHTML='<figure class="article-hero-scene" data-article-hero="'+spec.slug+'" role="img" aria-label="'+spec.description+'"><svg class="article-hero-poster" viewBox="0 0 600 340" aria-hidden="true">'+spec.poster+'</svg><canvas class="article-hero-canvas" aria-hidden="true"></canvas><figcaption><span>FIELD STUDY / '+spec.slug+'</span><strong>'+spec.name+'</strong></figcaption></figure>';window.__engNav.swap?.(document);}show();document.getElementById('next').onclick=()=>{index=(index+1)%specs.length;show()};addEventListener('error',event=>window.__heroReview.errors.push(event.message));</script><script src="/bundle.js"></script></body></html>`;
const server=createServer((request,response)=>{
    const path=new URL(request.url,'http://127.0.0.1').pathname;
    response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'");
    if(path==='/bundle.js'){response.setHeader('Content-Type','text/javascript');response.end(bundle);}
    else if(path==='/style.css'){response.setHeader('Content-Type','text/css');response.end(style);}
    else {response.setHeader('Content-Type','text/html');response.end(html);}
});
await new Promise((resolveListen)=>server.listen(0,'127.0.0.1',resolveListen));
const fixture=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(join(tmpdir(),'article-hero-native-chrome-'));
let child,page,browser;
const delay=(ms)=>new Promise((resolveDelay)=>setTimeout(resolveDelay,ms));
async function evaluate(expression){const value=await page.command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw Error(value.exceptionDetails.exception?.description||value.exceptionDetails.text);return value.result.value;}
async function until(expression,description){for(let i=0;i<125;i++){if(await evaluate(expression))return;await delay(80);}throw Error(`Timed out: ${description}`);}
try {
    child=spawn(options.chrome||process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
        '--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,
        '--window-size=390,844','--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank',
    ],{stdio:['ignore','ignore','pipe']});
    let portFile;for(let i=0;i<100;i++){try{portFile=await readFile(join(profile,'DevToolsActivePort'),'utf8');break;}catch{await delay(100);}}
    if(!portFile)throw Error('Native Chrome did not start');
    const [port,browserPath]=portFile.trim().split('\n');browser=new Cdp(`ws://127.0.0.1:${port}${browserPath}`);
    const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();page=new Cdp(targets.find((target)=>target.type==='page').webSocketDebuggerUrl);
    await Promise.all([page.command('Page.enable'),page.command('Runtime.enable')]);
    await page.command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await page.command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    const report={source:origin.href,script,css,browser:await browser.command('Browser.getVersion'),gpu:(await browser.command('SystemInfo.getInfo')).gpu.devices,scenes:[]};
    for(const reduced of [false,true]){
        await page.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
        await page.command('Page.navigate',{url:fixture});
        await until('document.readyState==="complete"&&document.querySelector("[data-article-hero]")','fixture startup');
        for(let index=0;index<specs.length;index++){
            const spec=specs[index];
            await until(`document.querySelector('[data-article-hero=${JSON.stringify(spec.slug)}]')?.dataset.renderer==='webgl'`,'linked and drawn '+spec.slug);
            const state=await evaluate(`(()=>{const figure=document.querySelector('figure'),canvas=figure.querySelector('canvas'),gl=canvas.getContext('webgl2'),rect=figure.getBoundingClientRect(),radius=Math.min(rect.width,rect.height)/2;const captionBounds=[...figure.querySelectorAll('figcaption span,figcaption strong')].map(label=>{const bounds=label.getBoundingClientRect(),left=bounds.left-rect.left,top=bounds.top-rect.top,right=bounds.right-rect.left,bottom=bounds.bottom-rect.top;return{text:label.textContent,left,top,right,bottom,insideCircle:[[left,top],[right,top],[left,bottom],[right,bottom]].every(([x,y])=>Math.hypot(x-rect.width/2,y-rect.height/2)<=radius+1)};});return{slug:figure.dataset.articleHero,renderer:figure.dataset.renderer,width:canvas.width,height:canvas.height,figureWidth:rect.width,figureHeight:rect.height,captionBounds,coarse:matchMedia('(pointer:coarse)').matches,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,glError:gl.getError(),overflow:document.documentElement.scrollWidth>innerWidth+1,errors:window.__heroReview.errors,disposals:window.__heroReview.disposals};})()`);
            if(state.glError||state.overflow||state.errors.length||state.disposals.some((value)=>value.renderer!==null))throw Error(`Native scene failed: ${JSON.stringify(state)}`);
            const aspect=spec.slug==='auteurs'?1:1.35;
            if(Math.abs(state.figureWidth-state.figureHeight*aspect)>2)throw Error(`Authored mobile scene geometry changed: ${JSON.stringify(state)}`);
            if(spec.slug==='auteurs'&&(state.captionBounds.length!==2||state.captionBounds.some((label)=>!label.insideCircle)))throw Error(`Circular scene clips an authored caption: ${JSON.stringify(state)}`);
            const image=await page.command('Page.captureScreenshot',{format:'png',fromSurface:true});
            const screenshot=`${reduced?'reduced':'normal'}-${spec.slug}.png`;await writeFile(join(output,screenshot),Buffer.from(image.data,'base64'));
            report.scenes.push({...state,screenshot});
            if(!reduced){
                await evaluate('window.__heroReview.loss=document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context");window.__heroReview.loss.loseContext()');
                await until('!document.querySelector("figure").dataset.renderer&&Number(getComputedStyle(document.querySelector(".article-hero-poster")).opacity)>0&&Number(getComputedStyle(document.querySelector(".article-hero-canvas")).opacity)===0','authored SVG remains visible after context loss');
                const fallback=await page.command('Page.captureScreenshot',{format:'png',fromSurface:true});
                await writeFile(join(output,`fallback-${spec.slug}.png`),Buffer.from(fallback.data,'base64'));
                await evaluate('window.__heroReview.loss.restoreContext()');
                await until('document.querySelector("figure").dataset.renderer==="webgl"','native shader recovers after context restore');
            }
            if(index+1<specs.length){const point=await evaluate('(()=>{const rect=document.getElementById("next").getBoundingClientRect();return{x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()');await page.command('Input.synthesizeTapGesture',{...point,gestureSourceType:'touch'});}
        }
    }
    await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
    console.log(`Native WebGL compiled/drew all${report.scenes.length} normal/reduced scene cases with0errors; ${join(output,'report.json')}`);
} finally {
    page?.close();browser?.close();
    if(child&&child.exitCode===null){const exit=new Promise((resolveExit)=>child.once('exit',resolveExit));child.kill('SIGTERM');await Promise.race([exit,delay(3000)]);}
    child?.stderr?.destroy();
    await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200}).catch(()=>{});
    await new Promise((resolveClose)=>server.close(resolveClose));
}
