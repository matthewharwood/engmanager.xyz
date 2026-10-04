#!/usr/bin/env node
// Native content QA for the real served diagram bundle and pinned CDN Mermaid.
// CI uses a deterministic same-origin provider for scheduling/lifecycle tests;
// this separate fixture checks actual graph layout without adding a CDN gate.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Cdp } from './local-chrome-cdp.mjs';

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
    const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=') || 'true'];
}));
const origin = new URL(options.url || 'http://127.0.0.1:3092');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw Error('Use an explicitly local server');
const output = resolve(options.output || join(tmpdir(), `article-diagram-native-${Date.now()}`));
await mkdir(output, { recursive: true });
const article = '/articles/the-execution-marketplace';
const html = await (await fetch(new URL(article, origin))).text();
const bundle = html.match(/<script[^>]+src="([^"]*\/js\/article-diagrams\.[^"]+\.js)"/)[1];
const source = await readFile(new URL('../website/articles/the-execution-marketplace.md', import.meta.url), 'utf8');
const graphs = [...source.matchAll(/<div class="mermaid">([\s\S]*?)<\/div>/g)].map(match => match[1].trim());
if (graphs.length !== 3) throw Error('Expected all three authored graphs');
const mermaidUrl = 'https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs';
const profile = await mkdtemp(join(tmpdir(), 'article-diagram-native-chrome-'));
const delay = ms => new Promise(done => setTimeout(done, ms));
let child, browser, page, stderr = '';
const requests = [];
const exceptions = [];
async function evaluate(expression) {
    const value = await page.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (value.exceptionDetails) throw Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
    return value.result.value;
}
async function until(expression, label) {
    for (let i = 0; i < 250; i++) { if (await evaluate(expression)) return; await delay(80); }
    throw Error(`Timed out: ${label}`);
}
function assert(value, label) { if (!value) throw Error(label); }
async function click(selector, index = 0) {
    const point = await evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(selector)})[${index}]?.getBoundingClientRect();if(!r)throw Error('Missing control');return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await page.command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function fontReady() {
    await evaluate('(async()=>{const typography=window.__engTypography;await Promise.all([document.fonts?.ready,typography?.ready,typography?.displayReady]);})()');
}
async function scrollDiagram(index, prior = null) {
    // A newly activated body font can move a distant graph outside the
    // viewport after scrolling. Start the visibility fixture with real metrics.
    await fontReady();
    await evaluate(`document.querySelectorAll('.article .mermaid')[${index}].scrollIntoView({block:'center',behavior:'instant'})`);
    await until(`!!document.querySelectorAll('.article .mermaid')[${index}]?.querySelector('svg')${prior ? `&&document.querySelectorAll('.article .mermaid')[${index}].querySelector('svg')!==window.__diagramNativeReview.${prior}[${index}]` : ''}`, `visible actual graph ${index}`);
}
async function inspect(index) {
    return evaluate(`(()=>{const node=document.querySelectorAll('.article .mermaid')[${index}],svg=node.querySelector('svg'),bounds=svg.getBoundingClientRect(),figure=node.parentElement.getBoundingClientRect(),clippedLabels=[],outsideShapes=[];let labelGlyphs=0;
      for(const foreign of svg.querySelectorAll('foreignObject')){const box=foreign.getBoundingClientRect(),walk=document.createTreeWalker(foreign,NodeFilter.SHOW_TEXT);let text;while(text=walk.nextNode()){if(!text.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(text);for(const rect of range.getClientRects())if(rect.left<box.left-1||rect.right>box.right+1||rect.top<box.top-1||rect.bottom>box.bottom+1)clippedLabels.push({text:text.textContent,box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},textBounds:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}});}}
      for(const group of svg.querySelectorAll('.node')){const shape=group.querySelector(':scope > rect,:scope > polygon,:scope > path,:scope > circle,:scope > ellipse');if(!shape)continue;for(const glyph of group.querySelectorAll('text .text-inner-tspan')){if(!glyph.textContent.trim())continue;labelGlyphs++;const box=glyph.getBBox(),matrix=glyph.getScreenCTM(),inverse=shape.getScreenCTM().inverse();const corners=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix).matrixTransform(inverse));if(corners.some(point=>!shape.isPointInFill(point)))outsideShapes.push({text:glyph.textContent,corners:corners.map(point=>[point.x,point.y])});}}
      return{index:${index},labels:[...svg.querySelectorAll('text')].map(text=>{const lines=[...text.querySelectorAll(':scope > tspan')];return(lines.length?lines.map(line=>line.textContent).join(' '):text.textContent).replace(/\\s+/g,' ').trim()}).join(' '),labelGlyphs,foreignObjects:svg.querySelectorAll('foreignObject').length,outsideShapes,clippedLabels,nodes:svg.querySelectorAll('.node').length,edges:svg.querySelectorAll('.edgePath,path.flowchart-link').length,viewBox:[svg.viewBox.baseVal.width,svg.viewBox.baseVal.height],bounds:{width:bounds.width,height:bounds.height,left:bounds.left,right:bounds.right},figure:{width:figure.width,left:figure.left,right:figure.right},expand:!!node.parentElement.querySelector('.diagram-expand'),overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.getAttribute('data-theme'),compact:matchMedia('(max-width:42rem)').matches,fill:getComputedStyle(svg.querySelector('.node rect,.node polygon,.node path')).fill};})()`);
}
function labelsFit(state) {
    const labels = [...graphs[state.index].matchAll(/"([^"]+)"/g)].map(match => match[1].replace(/\s+/g, ' ').trim());
    return state.labelGlyphs >= 6 && !state.foreignObjects && !state.clippedLabels.length && !state.outsideShapes.length
        && labels.every(label => state.labels.includes(label));
}
async function capture(name, index = null) {
    await fontReady();
    await evaluate(`(async()=>{const animations=document.getAnimations().filter(animation=>animation.playState==='running'&&Number.isFinite(animation.effect?.getComputedTiming().endTime));await Promise.allSettled(animations.map(animation=>animation.finished));})()`);
    if (index !== null) {
        // The authored section reveal uses an Anime RAF timeline, so it is
        // absent from getAnimations(). Its completed state also clears every
        // inherited opacity/transform; observe that state rather than sleeping.
        await until(`(()=>{const node=document.querySelectorAll('.article .mermaid')[${index}],section=node.closest('.article-reveal-section');if(section&&!matchMedia('(prefers-reduced-motion:reduce)').matches&&section.dataset.articleRevealState!=='done')return false;for(let current=node;current;current=current.parentElement)if(Number(getComputedStyle(current).opacity)<1)return false;return true;})()`, `graph ${index} reveal is visually complete`);
    }
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const screenshot = await page.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(join(output, name), Buffer.from(screenshot.data, 'base64'));
}
try {
    child = spawn(options.chrome || process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
        '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
        '--window-size=1200,900', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
    let portFile;
    for (let i = 0; i < 100; i++) { try { portFile = await readFile(join(profile, 'DevToolsActivePort'), 'utf8'); break; } catch { await delay(100); } }
    if (!portFile) throw Error(`Native Chrome did not start: ${stderr}`);
    const [port, browserPath] = portFile.trim().split('\n'); browser = new Cdp(`ws://127.0.0.1:${port}${browserPath}`);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = new Cdp(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await Promise.all([page.command('Page.enable'), page.command('Runtime.enable'), page.command('Network.enable')]);
    if (options['debug-exceptions']) {
        await page.command('Debugger.enable');
        page.on('Debugger.paused', event => {
            if (event.reason === 'exception') exceptions.push({ description: event.data?.description, frames: event.callFrames.slice(0, 4).map(frame => ({ name: frame.functionName, url: frame.url, location: frame.location })) });
            page.command('Debugger.resume').catch(() => {});
        });
        await page.command('Debugger.setPauseOnExceptions', { state: 'all' });
    }
    await page.command('Network.setBypassServiceWorker', { bypass: true });
    page.on('Network.requestWillBeSent', event => { if (event.request.url.includes('/mermaid@')) requests.push(event.request.url); });
    const firstOnly = options['capture-first-only'];
    const report = { origin: origin.href, bundle, mermaidUrl, serviceWorkerBypassed: true,
        scope: firstOnly ? 'stable-first-graph-capture' : 'all-graphs-lifecycle',
        browser: await browser.command('Browser.getVersion'), gpu: (await browser.command('SystemInfo.getInfo')).gpu.devices, passes: [] };
    for (const reduced of firstOnly ? [false] : [false, true]) {
        await page.command('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
        await page.command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        await page.command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
        const startRequests = requests.length;
        await page.command('Page.navigate', { url: new URL(article, origin).href });
        await until('document.readyState==="complete"&&window.__engNav?.ready&&!window.__engNav.busy', 'article mount');
        await fontReady();
        await evaluate('new Promise(resolve=>requestIdleCallback(()=>requestAnimationFrame(resolve)))');
        assert(requests.length === startRequests, 'offscreen native diagrams imported Mermaid');
        assert(await evaluate('[...document.querySelectorAll(".article .mermaid")].every(node=>!node.querySelector("svg")&&node.getBoundingClientRect().top>=innerHeight)'), 'fresh article must retain three offscreen sources');
        const pass = { reduced, desktop: [], mobile: [] };
        for (let index = 0; index < (firstOnly ? 1 : 3); index++) {
            await scrollDiagram(index);
            await capture(`${reduced ? 'reduced' : 'normal'}-desktop-${index}.png`, index);
            const state = await inspect(index);
            await writeFile(join(output, `${reduced ? 'reduced' : 'normal'}-desktop-${index}-state.json`), JSON.stringify(state, null, 2));
            assert(state.nodes >= 6 && state.edges >= 6 && state.viewBox.every(size => size > 0) && state.expand && !state.overflow && labelsFit(state) && state.bounds.width <= state.figure.width + 1, `actual desktop graph failed: ${JSON.stringify(state)}`);
            pass.desktop.push(state);
        }
        if (firstOnly) { report.passes.push(pass); break; }
        // Observe the real Mermaid render API after its first native import.
        await evaluate(`(async()=>{const {default:mermaid}=await import(${JSON.stringify(mermaidUrl)}),render=mermaid.render;window.__diagramNativeReview={calls:[]};mermaid.render=function(...args){window.__diagramNativeReview.calls.push({source:args[1],busy:window.__engNav?.busy,revealing:document.body.classList.contains('journey-revealing')});return render.apply(this,args)}})()`);
        await evaluate('window.__diagramNativeReview.beforeCompact=[...document.querySelectorAll(".article .mermaid")].map(node=>node.querySelector("svg"))');
        await page.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
        await evaluate('document.querySelectorAll(".article .mermaid")[2].scrollIntoView({block:"center",behavior:"instant"})');
        await until('document.querySelectorAll(".article .mermaid")[2].querySelector("svg")!==window.__diagramNativeReview.beforeCompact[2]', 'original LR graph becomes compact TD');
        assert(await evaluate('window.__diagramNativeReview.calls.some(call=>call.source.trim().startsWith("flowchart TD")&&call.source.includes("More businesses"))'), 'compact graph did not preserve the original source');
        for (let index = 0; index < 3; index++) {
            await scrollDiagram(index, 'beforeCompact');
            await capture(`${reduced ? 'reduced' : 'normal'}-mobile-${index}.png`, index);
            const state = await inspect(index);
            assert(state.nodes >= 6 && state.edges >= 6 && state.compact && !state.overflow && labelsFit(state) && state.bounds.width <= state.figure.width + 1 && state.bounds.left >= -1 && state.bounds.right <= 391, `actual mobile graph failed: ${JSON.stringify(state)}`);
            pass.mobile.push(state);
        }
        const oldFill = pass.mobile[2].fill;
        await evaluate('window.__diagramNativeReview.beforeTheme=[...document.querySelectorAll(".article .mermaid")].map(node=>node.querySelector("svg"))');
        await click('[data-theme-cycle]');
        await until('document.querySelectorAll(".article .mermaid")[2].querySelector("svg")!==window.__diagramNativeReview.beforeTheme[2]', 'visible actual graph changes theme');
        pass.theme = await inspect(2); assert(pass.theme.fill !== oldFill && labelsFit(pass.theme), 'actual diagram theme did not change node color or clipped a label');
        for (let index = 0; index < 3; index++) { await scrollDiagram(index, 'beforeTheme'); assert(labelsFit(await inspect(index)), 'a rethemed graph lost an authored label'); }
        await click('.model-figure .diagram-expand', 2);
        await until('document.querySelector(".diagram-viewer").open&&document.querySelector(".diagram-viewer .diagram-canvas svg")', 'actual graph expands');
        await click('.diagram-zoom [data-zoom="in"]');
        assert(await evaluate('document.querySelector(".diagram-viewer output").textContent==="150%"&&document.documentElement.scrollWidth<=innerWidth+1'), 'native zoom caused page overflow');
        await capture(`${reduced ? 'reduced' : 'normal'}-expanded.png`); await click('.diagram-close');
        await until('!document.querySelector(".diagram-viewer").open', 'actual viewer closes');
        await evaluate('window.__diagramNativeReview.saved=[...document.querySelectorAll(".article .mermaid")].map(node=>node.querySelector("svg"));window.__diagramNativeReview.beforeResume=window.__diagramNativeReview.calls.length;window.__diagramNativeReview.article=document.querySelector("[data-eng-page]");window.__engNav.navigate("/shop",{source:"reveal"})');
        await until('location.pathname==="/shop"&&!window.__engNav.busy', 'article disposes into shop');
        assert(await evaluate('!document.querySelector(".diagram-viewer")&&!window.__diagramNativeReview.article.querySelector(".diagram-expand")'), 'disposed article retained viewer controls');
        await click('[data-journey-resume]');
        await until(`location.pathname===${JSON.stringify(article)}&&!window.__engNav.busy`, 'retained article resumes');
        assert(await evaluate('[...document.querySelectorAll(".article .mermaid")].every((node,index)=>node.querySelector("svg")===window.__diagramNativeReview.saved[index]&&node.parentElement.querySelector(".diagram-expand"))&&window.__diagramNativeReview.calls.length===window.__diagramNativeReview.beforeResume'), 'retained actual SVGs unnecessarily rerendered or lost expansion');
        pass.retainedSvgReused = true;
        pass.calls = await evaluate('window.__diagramNativeReview.calls');
        assert(pass.calls.every(call => !call.busy && !call.revealing && call.source.includes('-->')), 'actual diagram rendered during a journey hold or from replaced SVG text');
        report.passes.push(pass);
    }
    if (!firstOnly) {
        // Pause the actual first CDN import. Disposal must release its mount
        // lane; a late completion cannot mutate the retained page.
        await page.command('Network.setCacheDisabled', { cacheDisabled: true });
        let paused;
        const offPause = page.on('Fetch.requestPaused', event => { paused = event; });
        await page.command('Fetch.enable', { patterns: [{ urlPattern: mermaidUrl, requestStage: 'Request' }] });
        await page.command('Page.navigate', { url: new URL(article, origin).href });
        await until('document.readyState==="complete"&&window.__engNav?.ready', 'cancellation article mount');
        await fontReady();
        await evaluate('window.__diagramDeparted=document.querySelector("[data-eng-page]");document.querySelector(".article .mermaid").scrollIntoView({block:"center",behavior:"instant"})');
        for (let i = 0; i < 150 && !paused; i++) await delay(80);
        assert(paused, 'the real visible diagram import was not intercepted');
        await evaluate('window.__engNav.navigate("/shop",{source:"reveal"})');
        await until('location.pathname==="/shop"&&!window.__engNav.busy', 'navigation while the real import is stalled');
        await page.command('Fetch.continueRequest', { requestId: paused.requestId });
        await page.command('Fetch.disable'); offPause();
        await evaluate(`import(${JSON.stringify(mermaidUrl)})`);
        assert(await evaluate('!window.__diagramDeparted.querySelector(".mermaid svg,.diagram-expand")&&!document.querySelector(".diagram-viewer")'), 'late real module completion mutated a disposed article');
        await click('[data-journey-resume]');
        await until(`location.pathname===${JSON.stringify(article)}&&!window.__engNav.busy&&!!document.querySelector(".article .mermaid svg")`, 'retained source renders after the cancelled import');
        report.cancelledImportRecovered = true;
    }
    report.mermaidRequests = [...new Set(requests)];
    await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ output, bundle, scope: report.scope, passes: report.passes.length, actualGraphs: report.passes.reduce((sum, pass) => sum + pass.desktop.length + pass.mobile.length, 0), cancelledImportRecovered: !!report.cancelledImportRecovered }));
} catch (error) {
    if (page) {
        const state = await evaluate('({path:location.pathname,ready:document.readyState,busy:window.__engNav?.busy,fonts:document.documentElement.dataset.fontState,scroll:scrollY,nodes:[...document.querySelectorAll(".article .mermaid")].map(node=>({text:node.textContent.slice(0,100),svg:!!node.querySelector("svg"),processed:node.dataset.processed,visibility:getComputedStyle(node).visibility,bounds:{top:node.getBoundingClientRect().top,bottom:node.getBoundingClientRect().bottom},parent:node.parentElement.outerHTML.slice(0,400)}))})').catch(() => null);
        await writeFile(join(output, 'failure.json'), JSON.stringify({ bundle, error: error.message, state, requests, exceptions }, null, 2));
        await capture('failure.png').catch(() => {});
    }
    throw error;
} finally {
    page?.close();
    if (browser) { await browser.command('Browser.close').catch(() => {}); browser.close(); }
    if (child && child.exitCode === null) await Promise.race([new Promise(done => child.once('exit', done)), delay(5000)]);
    if (child && child.exitCode === null) child.kill();
    await rm(profile, { recursive: true, force: true });
}
