#!/usr/bin/env node
// Repository-owned native CSS evaluation. Never loaded by the production site.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir, platform, release, cpus, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { Cdp } from './local-chrome-cdp.mjs';
import { runInNewContext } from 'node:vm';

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
    const [name, ...value] = arg.replace(/^--/, '').split('=');
    return [name, value.join('=') || 'true'];
}));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
const bytes = value => ({
    raw: value.length,
    brotli5: brotliCompressSync(value, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length,
    gzip9: gzipSync(value, { level: 9 }).length,
});
const sum = values => values.reduce((total, value) => {
    for (const key of ['raw', 'brotli5', 'gzip9']) total[key] += value[key];
    return total;
}, { raw: 0, brotli5: 0, gzip9: 0 });
const distribution = values => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const percentile = p => sorted.length ? sorted[Math.ceil((sorted.length - 1) * p)] : null;
    return { count: sorted.length, min: sorted[0] ?? null, p50: percentile(.5), p95: percentile(.95), max: sorted.at(-1) ?? null };
};
const unescapeHtml = value => value.replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[\da-f]+|\d+);/gi, entity => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    return named[entity] ?? String.fromCodePoint(parseInt(entity.slice(2, -1).replace(/^x/i, ''), /^&#x/i.test(entity) ? 16 : 10));
});
function attributes(tag) {
    const result = {};
    for (const match of tag.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[match[1].toLowerCase()] = unescapeHtml(match[2] ?? match[3] ?? match[4]);
    return result;
}
function declaredAssets(html) {
    const paths = new Set();
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
        const attr = attributes(match[0]);
        if (attr.src && /\.m?js(?:[?#]|$)/.test(attr.src)) paths.add(attr.src);
        if (attr.href && (attr.rel ?? '').split(/\s+/).includes('stylesheet')) paths.add(attr.href);
    }
    return [...paths].filter(path => path.startsWith('/'));
}
function localOrigin(value) {
    const url = new URL(value);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error(`Use an explicitly local HTTP server: ${value}`);
    return url;
}
function canonicalRoute(path, host = 'site') {
    const url = new URL(path, 'https://engmanager.xyz');
    return { id: `${host}:${url.pathname}${url.search}`, path: `${url.pathname}${url.search}`, host };
}
function nativeUrl(origin, route) {
    const url = new URL(route.path, origin);
    if (route.host !== 'site') url.hostname = `${route.host}.localhost`;
    return url.href;
}
async function getIdentity(origin, routeOrPath) {
    const route = typeof routeOrPath === 'string' ? canonicalRoute(routeOrPath) : routeOrPath;
    const url = new URL(route.path, origin);
    return new Promise((resolveRequest, reject) => {
        const req = request(url, { headers: {
            'accept-encoding': 'identity',
            ...(route.host !== 'site' ? { host: `${route.host}.localhost:${origin.port}` } : {}),
        } }, response => {
            const parts = []; let length = 0;
            response.on('data', part => {
                length += part.length;
                if (length > 64 * 1024 * 1024) req.destroy(Error(`Response too large: ${route.id}`));
                else parts.push(part);
            });
            response.on('end', () => resolveRequest({ status: response.statusCode, headers: response.headers, body: Buffer.concat(parts) }));
            response.on('error', reject);
        });
        req.setTimeout(30000, () => req.destroy(Error(`Identity fetch timed out: ${route.id}`)));
        req.on('error', reject); req.end();
    });
}
const supplemental = [
    '/', '/feed', '/shop', '/coach', '/coach?group=1', '/subscribe', '/newsletter/privacy',
    '/unsubscribe', '/articles/', '/search', '/search?q=engineering', '/personality/prepare', '/offline.html',
];
async function inventory(origin, directory, routeFilter) {
    const sitemap = await getIdentity(origin, '/sitemap.xml');
    if (sitemap.status !== 200) throw Error('Sitemap unavailable');
    await writeFile(join(directory, 'sitemap.xml'), sitemap.body);
    const routes = new Map();
    const add = route => { if (!routes.has(route.id)) routes.set(route.id, route); };
    if (routeFilter) routeFilter.forEach(path => add(canonicalRoute(path)));
    else {
        for (const match of sitemap.body.toString().matchAll(/<loc>([^<]+)<\/loc>/g)) add(canonicalRoute(new URL(unescapeHtml(match[1])).pathname));
        supplemental.forEach(path => add(canonicalRoute(path)));
        add(canonicalRoute('/checkout', 'shop')); add(canonicalRoute('/checkout/success', 'shop'));
    }
    const assets = new Map(), pages = [];
    async function asset(path) {
        if (assets.has(path)) return assets.get(path);
        const response = await getIdentity(origin, path);
        if (response.status !== 200) throw Error(`Required asset ${path} returned ${response.status}`);
        const hash = sha256(response.body);
        const filename = `${hash}${path.match(/\.([\w]+)(?:[?#]|$)/)?.[0]?.replace(/[?#].*/, '') ?? '.bin'}`;
        await writeFile(join(directory, 'assets', filename), response.body);
        const record = { path, sha256: hash, contentType: response.headers['content-type'], ...bytes(response.body), file: join(directory, 'assets', filename) };
        assets.set(path, record); return record;
    }
    for (const route of routes.values()) {
        const response = await getIdentity(origin, route);
        if (!String(response.headers['content-type']).includes('text/html')) throw Error(`Expected HTML at ${route.id}; got ${response.status}`);
        if (response.status !== 200) throw Error(`Public route ${route.id} returned ${response.status}`);
        const html = response.body.toString();
        const file = join(directory, 'html', `${sha256(route.id).slice(0, 12)}.html`);
        await writeFile(file, response.body);
        const paths = declaredAssets(html), required = [];
        for (const path of paths) required.push(await asset(path));
        const generation = attributes(html.match(/<meta\b[^>]*name=["']eng-css-generation["'][^>]*>/i)?.[0] ?? '').content ?? null;
        const contentFingerprint=sha256(html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,'').replace(/<meta\b[^>]*name=["']eng-css-generation["'][^>]*>/gi,'').replace(/\sclass\s*=\s*(?:"[^"]*"|'[^']*')/gi,'').replace(/\.[0-9a-f]{8}(?=\.[\w]+(?:["'?]|$))/g,'.HASH'));
        pages.push({ ...route, status: response.status, sha256: sha256(response.body), contentFingerprint, generation, html: { ...bytes(response.body), file }, declaredCssJs: paths, declaredCssBytes: sum(required.filter(asset=>/\.css(?:[?#]|$)/.test(asset.path))), declaredJsBytes: sum(required.filter(asset=>/\.m?js(?:[?#]|$)/.test(asset.path))), declaredCssJsBytes: sum(required), htmlPlusDeclaredCssJs: sum([bytes(response.body), ...required]), headers: response.headers });
        // This bounded inventory includes public product deep links and every
        // published personality step linked by the public preparation flow.
        if (!routeFilter) for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
            const href = attributes(match[0]).href;
            if (!href) continue;
            const linked = new URL(href, 'https://engmanager.xyz');
            if (!['engmanager.xyz', 'shop.engmanager.xyz'].includes(linked.hostname)) continue;
            if (/^\/products\/[^/]+$/.test(linked.pathname)) add(canonicalRoute(linked.pathname));
            if (/^\/personality\/[^/]+$/.test(linked.pathname) && !linked.search) add(canonicalRoute(linked.pathname));
        }
    }
    return { pages, assets: [...assets.values()], asset, getAssets: () => [...assets.values()], sitemapSha256: sha256(sitemap.body), uniqueDeclaredCssJsBytes: sum([...assets.values()]) };
}
function manifestInfo(json) {
    if (!json) return null;
    const manifest = json.manifest ?? json;
    if(manifest.schema_version!==1)throw Error(`Unsupported CSS manifest schema: ${manifest.schema_version}`);
    return { ...manifest, _reverse: Object.fromEntries(Object.entries(manifest.identities ?? {}).map(([name, token]) => [token, name])), _tokens: new Set(Object.values(manifest.classes ?? {}).flat()), _sheets: new Set(Object.keys(json.stylesheets ?? {})) };
}
function expandedClasses(tokens, manifest){return [...new Set(tokens.flatMap(token=>manifest?.classes?.[token]??[token]))].sort();}
function generationScope(route,manifest){
    if(!manifest)return{applicable:false,reason:'No compiled manifest: original release/control'};
    const managed=route.declaredCssJs.map(path=>path.split('/').at(-1).replace(/\.[0-9a-f]{8}(?=\.css$)/i,'')).filter(name=>manifest._sheets.has(name));
    return{applicable:managed.length>0||route.generation!==null,managedCss:managed,reason:managed.length?'Compiled project stylesheet':'Separate stylesheet boundary',expected:manifest.generation};
}
function canonicalClasses(tokens, manifest) {
    if (!manifest) return { semantic: [...tokens].sort(), unclassified: [] };
    const semantic = [], unclassified = [];
    for (const token of tokens) {
        if (manifest._reverse[token]) semantic.push(manifest._reverse[token]);
        else if (!manifest._tokens.has(token)) unclassified.push(token);
    }
    return { semantic: semantic.sort(), unclassified: unclassified.sort() };
}
const styleProperties = [
    'display','position','top','right','bottom','left','visibility','color','background-color','background-image','font-family','font-size','font-weight','font-style','font-stretch','line-height','letter-spacing','text-align','text-transform','text-decoration','white-space','overflow-wrap','word-break','vertical-align',
    'width','height','min-width','max-width','min-height','max-height','box-sizing','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left',
    'border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-style','border-top-color','border-radius','outline-width','outline-color','box-shadow','overflow-x','overflow-y',
    'flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','justify-content','align-items','align-self','align-content','gap','grid-template-columns','grid-template-rows','grid-auto-flow','object-fit','object-position','opacity','transform','transform-origin','transition-property','transition-duration','transition-timing-function','transition-delay','filter','perspective','isolation','clip-path','z-index','fill','stroke','stroke-width','content-visibility','contain','cursor','pointer-events',
];
function compareSnapshot(before, after, geometryTolerance = .75, manifest = null) {
    const diffs = [], old = new Map(before.nodes.map(node => [node.address, node])), current = new Map(after.nodes.map(node => [node.address, node]));
    if (JSON.stringify(before.readers) !== JSON.stringify(after.readers)) diffs.push({kind:'reader-state',before:before.readers,after:after.readers});
    for (const [address, node] of old) {
        const next = current.get(address);
        if (!next) { diffs.push({ address, kind: 'missing-node', before: node.tag }); continue; }
        if (node.tag !== next.tag) { diffs.push({ address, kind: 'tag', before: node.tag, after: next.tag }); continue; }
        if (node.text !== next.text) diffs.push({ address, kind: 'text', before: node.text, after: next.text });
        // A safe static identity can be elided into atoms. Inverting only
        // manifest.identities cannot reconstruct its original ownership.
        // Expand the original node's class set and check every actual token.
        const expected=expandedClasses(node.classes??node.semanticClasses??[],manifest),actual=[...new Set(next.classes??next.semanticClasses??[])].sort();
        if(JSON.stringify(expected)!==JSON.stringify(actual))diffs.push({address,kind:'compiled-class-binding',before:node.classes??[],expected,actual});
        for (const key of ['x', 'y', 'width', 'height']) if (Math.abs(node.rect[key] - next.rect[key]) > geometryTolerance) diffs.push({ address, kind: ['x','y'].includes(key)&&node.jsAnimation?.kind==='dvd-bouncer'&&next.jsAnimation?.kind==='dvd-bouncer'?'js-animation-review':'geometry', property: key, before: node.rect[key], after: next.rect[key], classes: { before: node.semanticClasses, after: next.semanticClasses } });
        for (const property of styleProperties) {
            if (node.style[property] === next.style[property]) continue;
            const dynamic = ['transform','opacity','clip-path','background-position'].includes(property) && (node.animated || next.animated);
            const gpu = property==='opacity' && node.gpuCarrier && next.gpuCarrier && node.gpuCarrier.state!==next.gpuCarrier.state;
            const dvd = node.jsAnimation?.kind==='dvd-bouncer'&&next.jsAnimation?.kind==='dvd-bouncer'&&(property==='transform'||['color','fill','stroke'].includes(property)&&node.jsAnimation.tone!==next.jsAnimation.tone);
            diffs.push({ address, kind: gpu ? 'gpu-state-review' : dvd ? 'js-animation-review' : dynamic ? 'animation-review' : 'computed-style', property, before: node.style[property], after: next.style[property], ...(gpu?{gpuState:{before:node.gpuCarrier,after:next.gpuCarrier}}:{}), ...(dvd?{jsState:{before:node.jsAnimation,after:next.jsAnimation}}:{}), classes: { before: node.semanticClasses, after: next.semanticClasses } });
        }
        for (const pseudo of ['before', 'after']) if (JSON.stringify(node.pseudo[pseudo]) !== JSON.stringify(next.pseudo[pseudo])) diffs.push({ address, kind: 'pseudo-style', pseudo, before: node.pseudo[pseudo], after: next.pseudo[pseudo] });
    }
    for (const [address, node] of current) if (!old.has(address)) diffs.push({ address, kind: 'added-node', after: node.tag });
    return { beforeNodes: old.size, afterNodes: current.size, differences: diffs, strictDifferences: diffs.filter(diff => !['animation-review','gpu-state-review','js-animation-review'].includes(diff.kind)).length, animationReviewDifferences: diffs.filter(diff => diff.kind === 'animation-review').length, jsAnimationReviewDifferences:diffs.filter(diff=>diff.kind==='js-animation-review').length, gpuStateReviewDifferences: diffs.filter(diff=>diff.kind==='gpu-state-review').length };
}
const dateCountupPolicy = 'visible-native-state-and-complete-date-descendants-v1';
const readerInspectionPolicy = 'native-restart-first-nonzero-token-pause-v1';
const readerStateSource = `function(reader){
    const find=selector=>reader.querySelector(selector),toggle=find('[data-reader-toggle]'),progress=find('[data-reader-progress]');
    return{mode:reader.dataset.readerMode??null,ready:reader.dataset.readerReady??null,playing:reader.dataset.readerPlaying??null,persona:reader.dataset.readerPersona??null,playIntent:toggle?.dataset.playing??null,toggleLabel:toggle?.getAttribute('aria-label')??null,word:['[data-reader-pre]','[data-reader-pivot]','[data-reader-post]'].map(selector=>find(selector)?.textContent??'').join(''),progress:progress?.style.getPropertyValue('--reader-progress')??null,speed:find('[data-reader-speed][aria-pressed="true"]')?.dataset.readerSpeed??null};
}`;
const readerPhaseSource = `async function(){
    const started=performance.now(),deadline=started+15000,readState=${readerStateSource},readers=[...document.querySelectorAll('[data-reader]')],states=[];
    for(const reader of readers){
        while(reader.dataset.readerReady!=='true'&&performance.now()<deadline)await new Promise(resolve=>requestAnimationFrame(resolve));
        if(reader.dataset.readerReady!=='true')throw Error('Native reader inspection readiness deadline');
        const before=readState(reader);
        if(before.mode==='read'){states.push({action:'untouched-read-mode',before,expected:before});continue;}
        if(before.mode!=='speed')throw Error('Unknown native reader mode: '+JSON.stringify(before));
        const toggle=reader.querySelector('[data-reader-toggle]'),restart=reader.querySelector('[data-reader-restart]'),progress=reader.querySelector('[data-reader-progress]'),words=reader.querySelector('#coach-title')?.textContent.trim().split(/\\s+/);
        if(!toggle||!restart||!progress||!words?.[1])throw Error('Missing native reader inspection controls/headline');
        if(toggle.dataset.playing==='true')toggle.click();
        if(readState(reader).playIntent!=='false'||readState(reader).playing!=='false')throw Error('Native reader Pause did not stop play intent');
        let expected=null,failure=null;
        const observer=new MutationObserver(()=>{try{const state=readState(reader),fraction=Number(state.progress);if(!expected&&fraction>0){if(!Number.isFinite(fraction)||fraction>=1||state.word!==words[1])throw Error('Native reader did not advance to headline token 1: '+JSON.stringify(state));if(state.playIntent!=='true'||state.playing!=='true')throw Error('Native reader Restart did not play');toggle.click();expected=readState(reader);if(expected.playIntent!=='false'||expected.playing!=='false'||expected.toggleLabel!=='Play')throw Error('Native reader Pause did not stop at token 1');}}catch(error){failure=error;}});
        observer.observe(progress,{attributes:true,attributeFilter:['style']});
        try{
            restart.click();const reset=readState(reader);
            if(reset.word!==words[0]||Number(reset.progress)!==0||reset.playIntent!=='true'||reset.playing!=='true')throw Error('Native reader Restart did not reset: '+JSON.stringify(reset));
            while(!expected&&!failure&&performance.now()<deadline)await new Promise(resolve=>requestAnimationFrame(resolve));
            if(failure)throw failure;if(!expected)throw Error('Native reader first nonzero token deadline: '+JSON.stringify(readState(reader)));
            states.push({action:'native-restart-advance-once-pause',before,reset,expected});
        }finally{observer.disconnect();}
    }
    return{policy:${JSON.stringify(readerInspectionPolicy)},durationMs:performance.now()-started,states};
}`;
function validateReaderPhase(phase, snapshot) {
    if (phase.policy !== readerInspectionPolicy || !Array.isArray(phase.states) || !Array.isArray(snapshot.readers) || phase.states.length !== snapshot.readers.length) throw Error('Missing or inconsistent native reader phase evidence');
    phase.states.forEach((entry,index) => {
        const current=snapshot.readers[index];
        if(JSON.stringify(entry.expected)!==JSON.stringify(current))throw Error(`Native reader changed after inspection pause: ${JSON.stringify({expected:entry.expected,current})}`);
        if(entry.action==='native-restart-advance-once-pause'&&!(current.mode==='speed'&&current.ready==='true'&&current.playing==='false'&&current.playIntent==='false'&&current.toggleLabel==='Play'&&Number(current.progress)>0&&Number(current.progress)<1))throw Error('Invalid nonzero paused native reader phase');
        if(entry.action==='untouched-read-mode'&&!(current.mode==='read'&&current.ready==='true'&&current.playing==='false'))throw Error('Invalid untouched native Read phase');
        if(!['native-restart-advance-once-pause','untouched-read-mode'].includes(entry.action))throw Error('Unknown native reader inspection action');
    });
}
const readinessSource = `async function(){
    const started=performance.now(),deadline=started+15000,events=[];let epoch=0,previous=-1,stable=0;
    const record=(kind,detail)=>{epoch++;events.push({kind,time:performance.now(),...detail});};
    const roots=[document.body,...document.querySelectorAll('[data-journey-current],main')];
    const seen=new Set(),observer=new ResizeObserver(entries=>{for(const entry of entries){seen.add(entry.target);record('resize',{tag:entry.target.tagName,width:entry.contentRect.width,height:entry.contentRect.height});}});
    roots.forEach(root=>observer.observe(root));
    const changed=event=>record(event.type,{});window.addEventListener('engmanager:fontchange',changed);for(const type of ['loading','loadingdone','loadingerror'])document.fonts.addEventListener(type,changed);
    let dates=null;const dateStates=new Map(),dateObserver=new MutationObserver(records=>{for(const {target} of records){const state=target.dataset.dateCountup;if(dateStates.get(target)!==state){dateStates.set(target,state);record('date-countup-state',{datetime:target.getAttribute('datetime'),state});}}});
    const visibleDate=node=>{const r=node.getBoundingClientRect();if(!r.width||!r.height||r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth||node.closest('[inert],[hidden],[aria-hidden="true"]'))return false;for(let current=node;current;current=current.parentElement){const style=getComputedStyle(current);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0)return false;}return true;};
    let facesReady=false,fontError;Promise.resolve().then(async()=>{await window.__engTypography?.ready;await window.__engTypography?.displayReady;await document.fonts.ready;const images=[...document.images].filter(image=>{const r=image.getBoundingClientRect(),s=getComputedStyle(image);return r.width&&r.height&&r.bottom>0&&r.top<innerHeight&&s.display!=='none'&&s.visibility!=='hidden';});await Promise.all(images.map(image=>image.decode()));facesReady=true;record('fonts-and-visible-images',{images:images.length});}).catch(error=>fontError=String(error));
    try{while(performance.now()<deadline){await new Promise(resolve=>requestAnimationFrame(resolve));if(fontError)throw Error(fontError);const baseReady=facesReady&&document.readyState==='complete'&&document.fonts.status==='loaded'&&!window.__engNav?.busy&&!document.documentElement.hasAttribute('data-journey-committing');if(baseReady&&dates===null){dates=[...document.querySelectorAll('[data-date-countup]')].filter(visibleDate);for(const node of dates){dateStates.set(node,node.dataset.dateCountup);dateObserver.observe(node,{attributes:true,attributeFilter:['data-date-countup']});}record('visible-date-countups-selected',{dates:dates.map(node=>({datetime:node.getAttribute('datetime'),state:node.dataset.dateCountup}))});}const datesReady=dates!==null&&dates.every(node=>!['pending','running'].includes(node.dataset.dateCountup));const ready=baseReady&&datesReady;stable=ready&&seen.size===roots.length&&epoch===previous?stable+1:0;previous=epoch;if(stable>=6)return{durationMs:performance.now()-started,atMs:performance.now(),fontState:document.documentElement.dataset.fontState,fontStatus:document.fonts.status,dateCountups:dates.map(node=>({datetime:node.getAttribute('datetime'),state:node.dataset.dateCountup})),events};}throw Error('Native fonts/image/date-countup/geometry readiness deadline: '+JSON.stringify({facesReady,fontError,dates:dates?.map(node=>({datetime:node.getAttribute('datetime'),state:node.dataset.dateCountup})),events}));}finally{observer.disconnect();dateObserver.disconnect();window.removeEventListener('engmanager:fontchange',changed);for(const type of ['loading','loadingdone','loadingerror'])document.fonts.removeEventListener(type,changed);}
}`;
const snapshotSource = `function(properties){
    const ignored=new Set(['SCRIPT','STYLE','LINK','META','NOSCRIPT','SOURCE']);
    const address=node=>{const parts=[];while(node&&node!==document.body){const parent=node.parentElement;if(!parent)break;parts.push([...parent.children].indexOf(node)+':'+node.tagName.toLowerCase());node=parent;}return'body/'+parts.reverse().join('/');};
    const samplePseudo=(node,pseudo)=>{const style=getComputedStyle(node,'::'+pseudo);return{content:style.content,display:style.display,color:style.color,background:style.backgroundColor,font:style.fontFamily,fontSize:style.fontSize,width:style.width,height:style.height,position:style.position};};
    const hidden=new Set(),nodes=[];for(const node of [document.body,...document.body.querySelectorAll('*')]){if(hidden.has(node.parentElement)){hidden.add(node);continue;}if(ignored.has(node.tagName))continue;const rect=node.getBoundingClientRect(),style=getComputedStyle(node),out={};if(style.display==='none')hidden.add(node);for(const property of properties)out[property]=style.getPropertyValue(property);const text=[...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join(' ').replace(/\\s+/g,' ').trim();const data=Object.fromEntries([...node.attributes].filter(attr=>attr.name.startsWith('data-')||['role','aria-label','type','datetime'].includes(attr.name)).map(attr=>[attr.name,attr.value]));const carrier=node.closest('[data-article-hero],[role="img"]');const gpuCarrier=carrier?.querySelector('canvas')?{address:address(carrier),state:carrier.dataset.rendered??carrier.dataset.renderer??'fallback',kind:carrier.dataset.articleHero??'poster'}:null;const dvd=node.closest('[data-dvd-bouncer]'),jsAnimation=dvd&&!matchMedia('(prefers-reduced-motion:reduce)').matches?{kind:'dvd-bouncer',tone:dvd.dataset.tone??'0'}:null;nodes.push({address:address(node),tag:node.tagName.toLowerCase(),classes:[...node.classList],data,text:node.matches('time[datetime]')?node.getAttribute('datetime'):text,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},style:out,pseudo:{before:samplePseudo(node,'before'),after:samplePseudo(node,'after')},gpuCarrier,jsAnimation,animated:node.getAnimations().some(animation=>animation.effect?.getComputedTiming().iterations===Infinity),rendered:rect.width>0&&rect.height>0&&style.display!=='none'&&style.visibility!=='hidden'});}
    return{url:location.pathname+location.search,title:document.title,theme:document.documentElement.dataset.theme??'auto',generation:document.querySelector('meta[name="eng-css-generation"]')?.content??null,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},document:{scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},nodes,readers:[...document.querySelectorAll('[data-reader]')].map(${readerStateSource}),navigation:performance.getEntriesByType('navigation').map(entry=>({duration:entry.duration,domContentLoaded:entry.domContentLoadedEventEnd,load:entry.loadEventEnd,responseEnd:entry.responseEnd,transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize,decodedBodySize:entry.decodedBodySize})),paint:performance.getEntriesByType('paint').map(entry=>({name:entry.name,startTime:entry.startTime})),resources:performance.getEntriesByType('resource').map(entry=>({name:entry.name,initiatorType:entry.initiatorType,duration:entry.duration,transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize,decodedBodySize:entry.decodedBodySize}))};
}`;
async function launchChrome(chromePath) {
    const profile = await mkdtemp(join(tmpdir(), 'css-site-native-'));
    const child = spawn(chromePath, ['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--window-size=1440,1000','--disable-background-timer-throttling','--disable-renderer-backgrounding','--host-resolver-rules=MAP *.localhost 127.0.0.1','about:blank'], { stdio: ['ignore','ignore','pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-12000); });
    let active;
    for (let i=0;i<100;i++) { try { active = await readFile(join(profile,'DevToolsActivePort'),'utf8'); break; } catch { if (child.exitCode !== null) throw Error(`Chrome exited: ${stderr}`); await pause(100); } }
    if (!active) { child.kill(); throw Error(`Chrome startup failed: ${stderr}`); }
    const [port, path] = active.trim().split('\n');
    const browser = new Cdp(`ws://127.0.0.1:${port}${path}`);
    return { browser, port, child, profile, async close() {
        await browser.command('Browser.close').catch(() => {}); browser.close();
        if (child.exitCode === null) { await Promise.race([new Promise(resolveExit=>child.once('exit',resolveExit)),pause(3000)]); if(child.exitCode===null)child.kill('SIGTERM'); }
        child.stderr.destroy(); await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200}).catch(()=>{});
    } };
}
async function nativeCapture(chrome, origin, pages, directory, manifest, asset, presets) {
    const cases = [];
    for (const route of pages) for (const viewport of presets.viewports) for (const theme of presets.themes) for (const reduced of presets.motions) for (let repeat=0;repeat<presets.repeats;repeat++) {
        const { browserContextId } = await chrome.browser.command('Target.createBrowserContext');
        let page;
        try {
            const { targetId } = await chrome.browser.command('Target.createTarget',{url:'about:blank',browserContextId});
            const targets = await (await fetch(`http://127.0.0.1:${chrome.port}/json/list`)).json();
            const target = targets.find(target => target.id === targetId);
            if (!target) throw Error('New native page target unavailable');
            page = new Cdp(target.webSocketDebuggerUrl);
            const errors = [], network = new Map();
            page.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails.exception?.description??event.exceptionDetails.text));
            page.on('Network.requestWillBeSent',event=>network.set(event.requestId,{url:event.request.url,type:event.type,start:event.timestamp,method:event.request.method}));
            page.on('Network.responseReceived',event=>Object.assign(network.get(event.requestId)??{}, {status:event.response.status,mimeType:event.response.mimeType,fromDiskCache:event.response.fromDiskCache,fromServiceWorker:event.response.fromServiceWorker}));
            page.on('Network.loadingFinished',event=>Object.assign(network.get(event.requestId)??{}, {encodedDataLength:event.encodedDataLength,end:event.timestamp}));
            page.on('Network.loadingFailed',event=>Object.assign(network.get(event.requestId)??{}, {error:event.errorText}));
            await Promise.all([page.command('Page.enable'),page.command('Runtime.enable'),page.command('Network.enable'),page.command('Performance.enable')]);
            await page.command('Network.setBypassServiceWorker',{bypass:true});
            await page.command('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:viewport.dpr,mobile:viewport.mobile});
            await page.command('Emulation.setTouchEmulationEnabled',{enabled:viewport.mobile,maxTouchPoints:5});
            await page.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'},{name:'prefers-color-scheme',value:theme==='dark'?'dark':'light'}]});
            await page.command('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('engmanager.theme',${JSON.stringify(theme)});}catch{}`});
            async function evaluate(expression) {
                const result = await page.command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
                if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
                return result.result.value;
            }
            for (const cache of presets.caches) {
                network.clear(); errors.length=0;
                const metricsBefore = Object.fromEntries((await page.command('Performance.getMetrics')).metrics.map(metric=>[metric.name,metric.value]));
                const start = performance.now();
                await page.command('Page.navigate',{url:nativeUrl(origin,route)});
                const deadline = Date.now()+20000;
                while (Date.now()<deadline) {
                    const ready = await evaluate('document.readyState!=="loading"&&document.body&&location.protocol!=="about:"').catch(error=>{
                        // Only retry a missing document context during navigation.
                        if(/Cannot find context with specified id|Execution context was destroyed|Cannot find default execution context/.test(error.message))return false;
                        throw error;
                    });
                    if(ready)break; await pause(40);
                }
                const readiness = await evaluate(`(${readinessSource})()`);
                const metricsAtReady = Object.fromEntries((await page.command('Performance.getMetrics')).metrics.map(metric=>[metric.name,metric.value]));
                const nativeMetrics = {before:metricsBefore,atReady:metricsAtReady,delta:Object.fromEntries(['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration'].map(name=>[name,metricsAtReady[name]>=metricsBefore[name]?metricsAtReady[name]-metricsBefore[name]:metricsAtReady[name]])),scope:'Page-target native counters before CSS phase freezing/large DOM snapshot; includes the font/image/RO readiness probe, excludes worker/iframe targets.'};
                // Use the reader's real controls after the timing sample. A
                // running JS timer can otherwise start a fresh CSS transition
                // after the finite-animation pass, at different native phases.
                const readerPhase = await evaluate(`(${readerPhaseSource})()`);
                // Explicit same-phase CSS/SMIL inspection. Native GPU and JS
                // decoration remain real; the RSVP reader was paused through
                // its own UI, and screenshots are never pixel gates.
                const animationPolicy = await evaluate(`(()=>{const animations=document.getAnimations();let finite=0,infinite=0;for(const animation of animations){const timing=animation.effect?.getComputedTiming();try{if(timing?.iterations===Infinity){animation.pause();animation.currentTime=0;infinite++;}else{animation.finish();finite++;}}catch{}}let svg=0;for(const node of document.querySelectorAll('svg')){try{node.pauseAnimations();node.setCurrentTime(0);svg++;}catch{}}return{finite,infinite,svg,policy:'settled finite CSS; infinite CSS and native SMIL sampled at zero; reader paused at native token 1; other JS/GPU untouched'};})()`);
                const inspectionReadiness = await evaluate(`(${readinessSource})()`);
                const snapshot = await evaluate(`(${snapshotSource})(${JSON.stringify(styleProperties)})`);
                validateReaderPhase(readerPhase,snapshot);
                for(const node of snapshot.nodes){const classes=canonicalClasses(node.classes,manifest);node.semanticClasses=classes.semantic;node.unclassifiedClasses=classes.unclassified;}
                const key = `${route.id}|${viewport.name}|${theme}|${reduced?'reduced':'normal'}|${cache}|${repeat}`;
                const stem = sha256(key).slice(0,16), screenshot = join(directory,'native',`${stem}.png`), snapshotFile = join(directory,'native',`${stem}.json`);
                await writeFile(snapshotFile,JSON.stringify(snapshot));
                const image = await page.command('Page.captureScreenshot',{format:'png',fromSurface:true});
                await writeFile(screenshot,Buffer.from(image.data,'base64'));
                const loaded = [...network.values()], paths = new Set(route.declaredCssJs);
                for(const entry of loaded) {
                    const url = new URL(entry.url);
                    if(url.origin===new URL(nativeUrl(origin,route)).origin&&(/\.css(?:[?#]|$)|\.m?js(?:[?#]|$)/.test(url.pathname)))paths.add(url.pathname+url.search);
                }
                const required = [];for(const path of paths)required.push(await asset(path));
                const result = {key,route:route.id,viewport:viewport.name,theme,motion:reduced?'reduced':'normal',cache,repeat,readiness,inspectionReadiness,readerPhase,nativeMetrics,navigation:snapshot.navigation,paint:snapshot.paint,totalCaptureMs:performance.now()-start,screenshot,snapshotFile,generation:snapshot.generation,nodeCount:snapshot.nodes.length,overflow:snapshot.document.scrollWidth>snapshot.viewport.width+1,errors:[...errors],animationPolicy,loadedCssJs:[...paths],htmlPlusObservedCssJs:sum([route.html,...required]),network:loaded};
                result.generationScope=generationScope(route,manifest);
                if(result.generationScope.applicable&&snapshot.generation!==manifest.generation)throw Error(`Manifest generation does not match managed page ${key}: ${snapshot.generation} != ${manifest.generation}`);
                cases.push(result);
                console.log(`${directory.split('/').at(-1)} ${key}: ${snapshot.nodes.length} nodes, ${Math.round(readiness.durationMs)} ms ready, ${result.overflow?'OVERFLOW':'no overflow'}`);
            }
        } finally { page?.close(); await chrome.browser.command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{}); }
    }
    return cases;
}
function compressionAttribution(before, after) {
    const previous=new Map(before.inventory.pages.map(page=>[page.id,page]));
    const routes=after.inventory.pages.map(page=>{
        const old=previous.get(page.id);
        if(!old)return{id:page.id,error:'Missing preceding control route'};
        const delta=field=>Object.fromEntries(['raw','brotli5','gzip9'].map(codec=>[codec,page[field][codec]-old[field][codec]]));
        return{id:page.id,delta:delta('htmlPlusDeclaredCssJs'),htmlDelta:delta('html'),cssDelta:delta('declaredCssBytes'),jsDelta:delta('declaredJsBytes'),contentFingerprintEqual:old.contentFingerprint===page.contentFingerprint};
    });
    return{before:before.label,after:after.label,scope:'Equal-weight per-route cold HTML plus declared CSS/JS bodies; arithmetic attribution only, not native equivalence or a candidate acceptance gate.',routes,aggregateDelta:sum(routes.filter(route=>route.delta).map(route=>route.delta)),htmlDelta:sum(routes.filter(route=>route.htmlDelta).map(route=>route.htmlDelta)),cssDelta:sum(routes.filter(route=>route.cssDelta).map(route=>route.cssDelta)),jsDelta:sum(routes.filter(route=>route.jsDelta).map(route=>route.jsDelta)),missingRoutes:[...previous.keys()].filter(id=>!after.inventory.pages.some(page=>page.id===id))};
}
const nativeTransferScope = 'Main-frame native NavigationTiming document plus one completed same-origin ResourceTiming entry for each CSS/JS asset declared in that document. Excludes other preloads/prefetches, transitive imports, workers, iframes, fonts, images and optional readiness-dependent requests. Chrome transferSize includes its 300-byte response bookkeeping; it is not recompressed body size or a literal HTTP-header measurement.';
function nativeTransferMeasurement(variant, item, snapshot) {
    const route = variant.inventory.pages.find(page => page.id === item.route);
    if (!route || !Array.isArray(route.declaredCssJs)) throw Error('Missing declared route inventory');
    const documentUrl = new URL(nativeUrl(localOrigin(variant.origin), route));
    if (snapshot.url !== route.path) throw Error('Native snapshot document does not match declared route');
    if (!Array.isArray(snapshot.navigation) || snapshot.navigation.length !== 1) throw Error('One completed main-frame navigation timing is required');
    if (!Array.isArray(snapshot.resources)) throw Error('Missing main-frame native ResourceTiming entries');
    function measured(entry, raw, label) {
        for (const field of ['transferSize', 'encodedBodySize', 'decodedBodySize']) {
            if (!Number.isSafeInteger(entry[field]) || entry[field] < 0) throw Error(`Invalid or missing ${field}: ${label}`);
        }
        if (!Number.isSafeInteger(raw) || raw <= 0 || entry.encodedBodySize <= 0 || entry.decodedBodySize !== raw) throw Error(`Incomplete or mismatched native body measurement: ${label}`);
        if (!Number.isFinite(entry.duration) || entry.duration < 0) throw Error(`Incomplete native duration: ${label}`);
        return {transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize,decodedBodySize:entry.decodedBodySize,durationMs:entry.duration};
    }
    const navigation = snapshot.navigation[0];
    if (!(navigation.load > 0 && navigation.responseEnd > 0)) throw Error('Main-frame navigation has not completed');
    const document = {path:route.path,...measured(navigation,route.html.raw,'document')};
    const assets = [], urls = new Set();
    for (const path of route.declaredCssJs) {
        const url = new URL(path,documentUrl);
        if (url.origin !== documentUrl.origin || url.hash || !/\.(?:css|m?js)$/.test(url.pathname)) throw Error(`Unmeasurable declared local CSS/JS URL: ${path}`);
        if (urls.has(url.href)) throw Error(`Duplicate declared asset URL: ${path}`);
        urls.add(url.href);
        const inventory = variant.inventory.assets.find(asset => asset.path === path);
        if (!inventory) throw Error(`Missing declared asset body inventory: ${path}`);
        const entries = snapshot.resources.filter(entry => entry.name === url.href);
        if (entries.length !== 1) throw Error(`Missing or ambiguous native declared asset timing: ${path} (${entries.length} entries)`);
        const entry = entries[0], kind = url.pathname.endsWith('.css')?'css':'javascript';
        if (entry.initiatorType !== (kind === 'css'?'link':'script')) throw Error(`Declared asset was not recorded as a stylesheet/script: ${path}`);
        assets.push({path,kind,initiatorType:entry.initiatorType,...measured(entry,inventory.raw,path)});
    }
    const cssTransferSize = assets.filter(asset=>asset.kind==='css').reduce((total,asset)=>total+asset.transferSize,0);
    const javascriptTransferSize = assets.filter(asset=>asset.kind==='javascript').reduce((total,asset)=>total+asset.transferSize,0);
    return {source:'saved-main-frame-native-resource-timing',snapshotFile:item.snapshotFile,cache:item.cache,document,assets,documentTransferSize:document.transferSize,cssTransferSize,javascriptTransferSize,totalTransferSize:document.transferSize+cssTransferSize+javascriptTransferSize};
}
function compareNativeTransfer(before, after, old, item, a, b) {
    try {
        const previous = nativeTransferMeasurement(before,old,a), current = nativeTransferMeasurement(after,item,b);
        return {before:previous,after:current,delta:current.totalTransferSize-previous.totalTransferSize,documentDelta:current.documentTransferSize-previous.documentTransferSize,cssDelta:current.cssTransferSize-previous.cssTransferSize,javascriptDelta:current.javascriptTransferSize-previous.javascriptTransferSize};
    } catch (error) { return {error:error.message}; }
}
function nativeTransferFailures(comparison) {
    return comparison.native.flatMap(item => {
        if (item.error) return [];
        const measurement = item.actualTransfer;
        if (!measurement || measurement.error || !Number.isSafeInteger(measurement.delta)) return [`${comparison.after}: incomplete native actual transfer ${item.key}: ${measurement?.error??'missing measurement'}`];
        return measurement.delta>0?[`${comparison.after}: native actual transfer growth ${item.key}: +${measurement.delta} bytes`]:[];
    });
}
async function compareReports(before, after, directory) {
    const oldPages = new Map(before.inventory.pages.map(page=>[page.id,page])), routeSizes = [];
    for(const page of after.inventory.pages){const old=oldPages.get(page.id);if(!old){routeSizes.push({id:page.id,error:'Missing baseline route'});continue;}const delta=Object.fromEntries(['raw','brotli5','gzip9'].map(key=>[key,page.htmlPlusDeclaredCssJs[key]-old.htmlPlusDeclaredCssJs[key]]));routeSizes.push({id:page.id,before:old.htmlPlusDeclaredCssJs,after:page.htmlPlusDeclaredCssJs,delta,contentFingerprintEqual:old.contentFingerprint&&page.contentFingerprint?old.contentFingerprint===page.contentFingerprint:null,htmlDelta:Object.fromEntries(['raw','brotli5','gzip9'].map(key=>[key,page.html[key]-old.html[key]])),requiredAssetCount:{before:old.declaredCssJs.length,after:page.declaredCssJs.length}});}
    const previous = new Map(before.native.map(item=>[item.key,item])), native = [];
    const manifest=after.manifest?manifestInfo(JSON.parse(await readFile(join(after.directory,'manifest.json'),'utf8'))):null;
    for(const item of after.native){const old=previous.get(item.key);if(!old){native.push({key:item.key,error:'Missing matching baseline native case'});continue;}const [a,b]=await Promise.all([readFile(old.snapshotFile,'utf8').then(JSON.parse),readFile(item.snapshotFile,'utf8').then(JSON.parse)]);const compared=compareSnapshot(a,b,Number(options['geometry-tolerance']??.75),manifest);const actualTransfer=compareNativeTransfer(before,after,old,item,a,b);const file=join(directory,`diff-${sha256(item.key).slice(0,16)}.json`);await writeFile(file,JSON.stringify(compared,null,2));native.push({key:item.key,strictDifferences:compared.strictDifferences,animationReviewDifferences:compared.animationReviewDifferences,jsAnimationReviewDifferences:compared.jsAnimationReviewDifferences,gpuStateReviewDifferences:compared.gpuStateReviewDifferences,beforeNodes:compared.beforeNodes,afterNodes:compared.afterNodes,file,screenshots:{before:old.screenshot,after:item.screenshot},errors:item.errors,overflow:item.overflow,actualTransfer});}
    return {before:before.label,after:after.label,routeSizes,native,actualTransferScope:nativeTransferScope,summary:{routeCount:routeSizes.length,brotliGrowthRoutes:routeSizes.filter(route=>route.delta?.brotli5>0).map(route=>route.id),gzipGrowthRoutes:routeSizes.filter(route=>route.delta?.gzip9>0).map(route=>route.id),aggregateDelta:sum(routeSizes.filter(route=>route.delta).map(route=>route.delta)),missingRoutes:[...oldPages.keys()].filter(id=>!after.inventory.pages.some(page=>page.id===id)),missingNativeCases:[...previous.keys()].filter(key=>!after.native.some(item=>item.key===key)),matchedNativeCases:native.filter(item=>!item.error).length,actualTransferGrowthCases:native.filter(item=>item.actualTransfer?.delta>0).map(item=>item.key),actualTransferIncompleteCases:native.filter(item=>item.actualTransfer?.error).map(item=>({key:item.key,error:item.actualTransfer.error})),strictNativeDifferences:native.reduce((total,item)=>total+(item.strictDifferences??0),0),gpuStateReviewDifferences:native.reduce((total,item)=>total+(item.gpuStateReviewDifferences??0),0),nativeErrors:native.filter(item=>item.errors?.length).length,overflowCases:native.filter(item=>item.overflow).length},timing:{before:timingSummary(before.native),after:timingSummary(after.native)}};
}
function timingSummary(cases){return Object.fromEntries(['cold','warm'].map(cache=>[cache,{nativeReadyAtMs:distribution(cases.filter(item=>item.cache===cache).map(item=>item.readiness.atMs)),loadMs:distribution(cases.filter(item=>item.cache===cache).map(item=>item.navigation?.[0]?.load)),firstPaintMs:distribution(cases.filter(item=>item.cache===cache).map(item=>item.paint?.find(entry=>entry.name==='first-paint')?.startTime)),styleRecalcMs:distribution(cases.filter(item=>item.cache===cache).map(item=>item.nativeMetrics?.delta.RecalcStyleDuration*1000)),layoutMs:distribution(cases.filter(item=>item.cache===cache).map(item=>item.nativeMetrics?.delta.LayoutDuration*1000)),inspectionWaitMs:distribution(cases.filter(item=>item.cache===cache).map(item=>item.inspectionReadiness?.durationMs)),captureMs:distribution(cases.filter(item=>item.cache===cache).map(item=>item.totalCaptureMs))}]));}
function validateNativeBaseline(reference, report) {
    for(const key of ['hardware','browser','gpu','presets']){
        if(!reference[key])throw Error(`Saved native baseline is missing ${key} provenance; recapture it with the current harness`);
        if(JSON.stringify(reference[key])!==JSON.stringify(report[key]))throw Error(`Saved native baseline ${key} differs from the current capture; use a matched fresh cohort`);
    }
}
async function selfTest(){
    assert.deepEqual(declaredAssets('<link href="/a.css" rel="stylesheet"><script src="/a.js"></script><script type="application/json">{}</script>'),['/a.css','/a.js']);
    assert.deepEqual(canonicalClasses(['a','x'],manifestInfo({schema_version:1,identities:{header:'a'},classes:{header:['a','x']}})),{semantic:['header'],unclassified:[]});
    const input=Buffer.from('repeat CSS '.repeat(500));assert(bytes(input).brotli5<input.length);assert(bytes(input).gzip9<input.length);
    const node={address:'body/0:div',tag:'div',text:'hello',rect:{x:0,y:0,width:20,height:20},style:{display:'block'},pseudo:{before:{},after:{}},animated:false};
    assert.equal(compareSnapshot({nodes:[node]},{nodes:[{...node,rect:{...node.rect,width:20.5}}]}).strictDifferences,0);
    assert.equal(compareSnapshot({nodes:[node]},{nodes:[{...node,style:{display:'none'}}]}).strictDifferences,1);
    const gpu={...node,style:{opacity:'0'},gpuCarrier:{state:'fallback'}};
    assert.equal(compareSnapshot({nodes:[gpu]},{nodes:[{...gpu,style:{opacity:'1'},gpuCarrier:{state:'webgl'}}]}).gpuStateReviewDifferences,1);
    assert.equal(compareSnapshot({nodes:[gpu]},{nodes:[{...gpu,style:{opacity:'1'}}]}).strictDifferences,1);
    const dvd={...node,jsAnimation:{kind:'dvd-bouncer',tone:'0'}};
    assert.equal(compareSnapshot({nodes:[dvd]},{nodes:[{...dvd,rect:{...dvd.rect,x:10}}]}).jsAnimationReviewDifferences,1);
    assert.equal(compareSnapshot({nodes:[dvd]},{nodes:[{...dvd,rect:{...dvd.rect,width:30}}]}).strictDifferences,1);
    assert.equal(compareSnapshot({nodes:[node]},{nodes:[]}).strictDifferences,1);
    const atomManifest=manifestInfo({schema_version:1,identities:{state:'s'},classes:{owner:['a'],state:['s']}}),authored={...node,classes:['owner','state']};
    assert.equal(compareSnapshot({nodes:[authored]},{nodes:[{...node,classes:['a','s']}]},.75,atomManifest).strictDifferences,0);
    assert.equal(compareSnapshot({nodes:[authored]},{nodes:[{...node,classes:['s']}]},.75,atomManifest).strictDifferences,1);
    assert.equal(compareSnapshot({nodes:[authored]},{nodes:[{...node,classes:['a','s','extra']}]},.75,atomManifest).strictDifferences,1);
    assert.equal(generationScope({declaredCssJs:['/assets/personality/v7/app.css'],generation:null},atomManifest).applicable,false);
    const compiledManifest=manifestInfo({manifest:{schema_version:1,generation:'current',identities:{},classes:{}},stylesheets:{'critical.css':''}});
    assert.equal(generationScope({declaredCssJs:['/assets/css/critical.abcdef01.css'],generation:null},compiledManifest).applicable,true);
    const pageBytes={id:'site:/',html:{raw:10,brotli5:8,gzip9:9},declaredCssBytes:{raw:20,brotli5:12,gzip9:14},declaredJsBytes:{raw:30,brotli5:20,gzip9:22},htmlPlusDeclaredCssJs:{raw:60,brotli5:40,gzip9:45},contentFingerprint:'same'};
    const ledger=compressionAttribution({label:'guard-control',inventory:{pages:[pageBytes]}},{label:'naming-control',inventory:{pages:[{...pageBytes,html:{raw:12,brotli5:9,gzip9:10},declaredCssBytes:{raw:10,brotli5:6,gzip9:7},htmlPlusDeclaredCssJs:{raw:52,brotli5:35,gzip9:39}}]}});
    assert.deepEqual(ledger.aggregateDelta,{raw:-8,brotli5:-5,gzip9:-6});assert.equal(ledger.htmlDelta.raw,2);assert.equal(ledger.cssDelta.raw,-10);assert.equal(ledger.jsDelta.raw,0);
    const matching={hardware:{cpu:'host'},browser:{product:'Chrome/native'},gpu:[{deviceString:'native'}],presets:{viewport:'mobile'}};
    validateNativeBaseline(matching,matching);
    assert.throws(()=>validateNativeBaseline({...matching,browser:{product:'Chrome/other'}},matching),/browser differs/);
    assert.throws(()=>validateNativeBaseline({...matching,gpu:null},matching),/missing gpu/);
    const transferRoute={id:'site:/',path:'/',host:'site',html:{raw:20000},declaredCssJs:['/a.css','/a.js']};
    const transferVariant={origin:'http://127.0.0.1:3191/',inventory:{pages:[transferRoute],assets:[{path:'/a.css',raw:50},{path:'/a.js',raw:60}]}};
    const transferCase={route:'site:/',cache:'warm',snapshotFile:'fixture-native.json'};
    const transferSnapshot={url:'/',navigation:[{duration:20,load:15,responseEnd:1,transferSize:0,encodedBodySize:12427,decodedBodySize:20000}],resources:[{name:'http://127.0.0.1:3191/a.css',initiatorType:'link',duration:0,transferSize:0,encodedBodySize:30,decodedBodySize:50},{name:'http://127.0.0.1:3191/a.js',initiatorType:'script',duration:0,transferSize:0,encodedBodySize:40,decodedBodySize:60},{name:'http://127.0.0.1:3191/optional-prefetch.js',initiatorType:'fetch',duration:10,transferSize:90000,encodedBodySize:89700,decodedBodySize:100000}]};
    assert.equal(nativeTransferMeasurement(transferVariant,transferCase,transferSnapshot).totalTransferSize,0,'Complete positive body measurements prove a valid warm cache hit');
    const warmGrowth=structuredClone(transferSnapshot);warmGrowth.navigation[0].transferSize=12727;
    const actualGrowth=compareNativeTransfer(transferVariant,transferVariant,transferCase,transferCase,transferSnapshot,warmGrowth);
    assert.equal(actualGrowth.delta,12727);
    assert.equal(nativeTransferFailures({after:'candidate',native:[{key:'warm',actualTransfer:actualGrowth}]}).length,1,'Warm document refetch must fail even when cold recompressed body sizes shrink');
    const actualEqual=compareNativeTransfer(transferVariant,transferVariant,transferCase,transferCase,transferSnapshot,structuredClone(transferSnapshot));
    assert.deepEqual(nativeTransferFailures({after:'candidate',native:[{key:'warm',actualTransfer:actualEqual}]}),[]);
    const incompleteTransfer=structuredClone(transferSnapshot);incompleteTransfer.resources.shift();
    const actualIncomplete=compareNativeTransfer(transferVariant,transferVariant,transferCase,transferCase,transferSnapshot,incompleteTransfer);
    assert.match(actualIncomplete.error,/Missing or ambiguous/);
    assert.equal(nativeTransferFailures({after:'candidate',native:[{key:'warm',actualTransfer:actualIncomplete}]}).length,1);
    const hiddenTransfer=structuredClone(transferSnapshot);hiddenTransfer.resources[0].encodedBodySize=0;
    assert.throws(()=>nativeTransferMeasurement(transferVariant,transferCase,hiddenTransfer),/Incomplete or mismatched/);
    const ambiguousTransfer=structuredClone(transferSnapshot);ambiguousTransfer.resources.push({...ambiguousTransfer.resources[0]});
    assert.throws(()=>nativeTransferMeasurement(transferVariant,transferCase,ambiguousTransfer),/ambiguous/);
    const prefetchedTransfer=structuredClone(transferSnapshot);prefetchedTransfer.resources[0].initiatorType='fetch';
    assert.throws(()=>nativeTransferMeasurement(transferVariant,transferCase,prefetchedTransfer),/stylesheet\/script/);
    // Exercise the captured control policy itself. No clock or inline style
    // is changed by that policy; only the application controls set the state.
    async function readerInspection({mode='speed',stalled=false,wrongWord=false,badPause=false}={}) {
        let now=0,callback=null,advanced=false,disconnected=0;const actions=[];
        const state={word:'Later',progress:'.3',wants:true,playing:mode==='speed'};
        const reader={dataset:{readerMode:mode,readerReady:'true',readerPlaying:String(state.playing),readerPersona:'design-engineer'},querySelector:selector=>elements[selector]??null};
        const sync=()=>{reader.dataset.readerPlaying=String(state.playing);toggle.dataset.playing=String(state.wants);};
        const changed=()=>{const deliver=callback;if(deliver)queueMicrotask(()=>deliver([{target:progress}]));};
        const toggle={dataset:{playing:'true'},getAttribute:()=>state.wants?'Pause':'Play',click(){actions.push('toggle');state.wants=!state.wants;state.playing=badPause&&advanced?true:mode==='speed'&&state.wants;sync();}};
        const progress={style:{getPropertyValue:name=>name==='--reader-progress'?state.progress:''}};
        const restart={click(){actions.push('restart');state.word='Spend';state.progress='0';state.wants=true;state.playing=mode==='speed';sync();changed();}};
        const elements={'[data-reader-toggle]':toggle,'[data-reader-restart]':restart,'[data-reader-progress]':progress,'#coach-title':{textContent:'Spend 35 minutes'},'[data-reader-pre]':{get textContent(){return state.word;}},'[data-reader-pivot]':{textContent:''},'[data-reader-post]':{textContent:''},'[data-reader-speed][aria-pressed="true"]':{dataset:{readerSpeed:'400'}}};
        const context={document:{querySelectorAll:()=>[reader]},performance:{now:()=>now},MutationObserver:class{constructor(deliver){this.deliver=deliver;}observe(){callback=this.deliver;}disconnect(){callback=null;disconnected++;}},requestAnimationFrame(deliver){now+=16;if(!stalled&&!advanced&&state.playing&&now>=32){advanced=true;state.word=wrongWord?'wrong token':'35';state.progress='.125';changed();}queueMicrotask(()=>deliver(now));}};
        const work=runInNewContext(`(${readerPhaseSource})`,context)();
        if(stalled||wrongWord||badPause){await assert.rejects(work,stalled?/first nonzero token deadline/:wrongWord?/headline token 1/:/Pause did not stop/);assert.equal(disconnected,1);return;}
        const phase=await work,current=runInNewContext(`(${readerStateSource})`,context)(reader),snapshot={readers:[current]};
        validateReaderPhase(phase,snapshot);
        if(mode==='read'){assert.deepEqual(actions,[]);assert.equal(phase.states[0].action,'untouched-read-mode');}
        else{assert.deepEqual(actions,['toggle','restart','toggle']);assert.equal(current.word,'35');assert.equal(current.progress,'.125');assert.equal(current.playing,'false');assert.equal(current.playIntent,'false');assert.equal(current.toggleLabel,'Play');assert.equal(disconnected,1);assert.throws(()=>validateReaderPhase(phase,{readers:[{...current,playing:'true'}]}),/changed after inspection pause/);const zero={...current,progress:'0'};assert.throws(()=>validateReaderPhase({...phase,states:[{...phase.states[0],expected:zero}]},{readers:[zero]}),/Invalid nonzero/);}
        return snapshot;
    }
    const pausedReader=await readerInspection();await readerInspection({mode:'read'});await readerInspection({stalled:true});await readerInspection({wrongWord:true});await readerInspection({badPause:true});
    const progressNode={...node,style:{transform:'matrix(0.125, 0, 0, 1, 0, 0)','transition-property':'transform','transition-duration':'0.18s','transition-timing-function':'linear','transition-delay':'0s'}};
    const fixedReaderSnapshot={...pausedReader,nodes:[progressNode]};
    assert.equal(compareSnapshot(fixedReaderSnapshot,structuredClone(fixedReaderSnapshot)).strictDifferences,0);
    for(const wrongTransform of ['matrix(0.25, 0, 0, 1, 0, 0)','matrix(1, 0, 0, 0.125, 0, 0)','none'])assert.equal(compareSnapshot(fixedReaderSnapshot,{...pausedReader,nodes:[{...progressNode,style:{...progressNode.style,transform:wrongTransform}}]}).strictDifferences,1,'Paused nonzero phase must retain exact transform comparison');
    assert.equal(compareSnapshot(fixedReaderSnapshot,{...pausedReader,nodes:[{...progressNode,style:{...progressNode.style,'transition-duration':'0.36s'}}]}).strictDifferences,1);
    assert.equal(compareSnapshot(fixedReaderSnapshot,{...fixedReaderSnapshot,readers:[{...pausedReader.readers[0],progress:'.25'}]}).strictDifferences,1);
    // Exercise the actual captured source, rather than mirroring its predicates.
    // Visible date state must settle; offscreen pending nodes stay untouched.
    async function readinessDates(settle) {
        let now=0,frame=0,selections=0;const watched=new Map(),disconnected=[];
        const makeDate=top=>({dataset:{dateCountup:'pending'},parentElement:null,getAttribute:()=> '2026-09-14',closest:()=>null,getBoundingClientRect:()=>({width:90,height:20,top,bottom:top+20,left:0,right:90})});
        const visible=makeDate(100),offscreen=makeDate(1000),body={};
        const document={body,readyState:'complete',images:[],fonts:{ready:Promise.resolve(),status:'loaded',addEventListener(){},removeEventListener(){}},documentElement:{dataset:{},hasAttribute:()=>false},querySelectorAll(selector){if(selector==='[data-date-countup]'){selections++;return[visible,offscreen];}return[];}};
        const context={document,innerWidth:390,innerHeight:844,performance:{now:()=>now},window:{addEventListener(){},removeEventListener(){}},getComputedStyle:()=>({display:'inline',visibility:'visible',opacity:'1'}),ResizeObserver:class{constructor(callback){this.callback=callback;}observe(target){this.callback([{target,contentRect:{width:390,height:844}}]);}disconnect(){disconnected.push('resize');}},MutationObserver:class{constructor(callback){this.callback=callback;}observe(target){watched.set(target,this.callback);}disconnect(){disconnected.push('date');}},requestAnimationFrame(callback){frame++;now+=16;if(settle&&(frame===12||frame===24)){visible.dataset.dateCountup=frame===12?'running':'done';watched.get(visible)?.([{target:visible}]);}queueMicrotask(()=>callback(now));}};
        const work=runInNewContext(`(${readinessSource})`,context)();
        if(settle){const result=await work;assert(now>=24*16);assert.equal(result.dateCountups.length,1);assert.equal(result.dateCountups[0].state,'done');assert.equal(offscreen.dataset.dateCountup,'pending');assert.equal(selections,1);assert(result.events.some(event=>event.kind==='date-countup-state'&&event.state==='done'));}
        else await assert.rejects(work,/date-countup\/geometry readiness deadline/);
        assert.deepEqual(disconnected,['resize','date']);
    }
    await readinessDates(true);await readinessDates(false);
    const element=(tag,classes=[],text='')=>({tagName:tag.toUpperCase(),classList:classes,children:[],childNodes:text?[{nodeType:3,textContent:text}]:[],attributes:[],parentElement:null,getAttribute(name){return this.attributes.find(attr=>attr.name===name)?.value??null;},getBoundingClientRect:()=>({x:0,y:0,width:90,height:20}),getAnimations:()=>[],querySelector:()=>null,matches(selector){return selector==='time[datetime]'&&this.tagName==='TIME';},closest(selector){if(selector==='time[datetime] *'&&this.parentElement?.tagName==='TIME')return this.parentElement;return null;}});
    const body=element('body'),time=element('time',['article-meta-date']),accessible=element('span',['article-date-countup-accessible','sr-only'],'SEP 14, 2026'),label=element('span',['article-date-countup-label'],'SEP 14, 2026');
    body.children=[time];time.parentElement=body;time.attributes=[{name:'datetime',value:'2026-09-14'}];time.children=[accessible,label];time.childNodes=[accessible,label];accessible.parentElement=label.parentElement=time;body.querySelectorAll=()=>[time,accessible,label];
    const captured=runInNewContext(`(${snapshotSource})`,{document:{body,title:'date fixture',documentElement:{scrollWidth:390,scrollHeight:844,dataset:{}},querySelector:()=>null,querySelectorAll:()=>[]},location:{pathname:'/',search:''},performance:{getEntriesByType:()=>[]},Node:{TEXT_NODE:3},innerWidth:390,innerHeight:844,devicePixelRatio:2,matchMedia:()=>({matches:false}),getComputedStyle:()=>({display:'inline',visibility:'visible',getPropertyValue:property=>property==='color'?'black':'inline'})})(['display','color']);
    assert.equal(captured.nodes.length,4);assert.equal(captured.nodes[1].text,'2026-09-14');assert.equal(captured.nodes[2].text,'SEP 14, 2026');assert.deepEqual([...captured.nodes[2].classes],['article-date-countup-accessible','sr-only']);
    const brokenLabel=JSON.parse(JSON.stringify(captured));brokenLabel.nodes[3].classes=[];
    assert.equal(compareSnapshot(captured,brokenLabel).strictDifferences,1);
    const brokenAccessible=JSON.parse(JSON.stringify(captured));brokenAccessible.nodes[2].style.color='red';
    assert.equal(compareSnapshot(captured,brokenAccessible).strictDifferences,1);
    console.log('CSS evaluation parsing, class mapping, compression attribution, actual cold/warm transfer completeness, provenance, native date readiness/descendants, native nonzero reader controls/state, and strict transform/transition comparison self-checks passed');
}
async function main(){
    if(options['self-test'])return selfTest();
    const output=resolve(options.output??join(tmpdir(),`css-site-evaluation-${Date.now()}`));await mkdir(output,{recursive:true});
    const labels=['baseline','upgrade-control','guard-control','naming-control','control','candidate'].filter(label=>options[`${label}-url`]);
    if(!labels.length)throw Error('Supply --baseline-url or --candidate-url (with --baseline-report for comparison)');
    const presets={viewports:(options.viewports??'mobile,desktop').split(',').map(name=>name==='mobile'?{name,width:390,height:844,dpr:2,mobile:true}:{name,width:1440,height:1000,dpr:1,mobile:false}),themes:(options.themes??'light,dark').split(','),motions:(options.motion??'normal,reduced').split(',').map(name=>name==='reduced'),caches:(options['cache-modes']??'cold,warm').split(','),repeats:Number(options.repeats??1)};
    if(presets.caches[0]!=='cold')throw Error('Every fresh browser context must begin with a cold capture');
    const routeFilter=options.routes?.split(','),visualFilter=options['visual-routes']?.split(','),reports=[];
    const report={schemaVersion:2,createdAt:new Date().toISOString(),harnessSha256:sha256(await readFile(new URL(import.meta.url))),probeContractSha256:sha256(JSON.stringify({properties:styleProperties,readinessSource,snapshotSource,dateCountupPolicy,readerInspectionPolicy,readerPhaseSource,animationPolicy:'settled-css-smil-native-reader-phase-v2'})),compression:{brotliQuality:5,gzipLevel:9,node:process.version,zlib:process.versions.zlib,scope:'Exact body bytes recompressed individually; excludes HTTP headers. Browser encodedDataLength is recorded separately and includes transport bookkeeping.'},hardware:{platform:platform(),release:release(),cpu:cpus()[0]?.model,cores:cpus().length,memoryBytes:totalmem()},presets,scope:{native:options.mode!=='inventory',serviceWorker:'bypassed in native comparative fixture',network:'local unthrottled; no mobile-performance or physical-device certification',screenshots:'inspection artifacts only; no pixel equality gate for real animated/GPU content',dateCountups:dateCountupPolicy,readerInspection:readerInspectionPolicy,routes:'sitemap plus bounded canonical public routes/product links/published personality steps; query-state fixtures explicitly listed; no secrets or real submissions'},variants:[],comparisons:[],compressionAttribution:[]};
    if(options['baseline-report']){const file=resolve(options['baseline-report']),raw=await readFile(file,'utf8'),saved=JSON.parse(raw),variant=saved.variants?.find(variant=>variant.label==='baseline')??saved,contract=saved.probeContractSha256??variant.provenance?.probeContractSha256;if(options.mode!=='inventory'&&variant.native.length&&contract!==report.probeContractSha256)throw Error('Baseline native probe contract is missing or changed; recapture with the current harness instead of comparing incomplete snapshot fields');reports.push(variant);report.referenceBaseline={file,sha256:sha256(raw),harnessSha256:saved.harnessSha256??variant.provenance?.harnessSha256??null,probeContractSha256:contract??null,hardware:saved.hardware??variant.provenance?.hardware,browser:saved.browser??variant.provenance?.browser,gpu:saved.gpu??variant.provenance?.gpu,presets:saved.presets??variant.provenance?.presets};}
    let chrome;
    try{
        if(options.mode!=='inventory'){chrome=await launchChrome(options.chrome??process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');report.browser=await chrome.browser.command('Browser.getVersion');report.gpu=(await chrome.browser.command('SystemInfo.getInfo')).gpu.devices;if(report.referenceBaseline)validateNativeBaseline(report.referenceBaseline,report);}
        for(const label of labels){const origin=localOrigin(options[`${label}-url`]),directory=join(output,label);for(const part of ['html','assets','native'])await mkdir(join(directory,part),{recursive:true});const manifestPath=options[`${label}-manifest`],manifestRaw=manifestPath?await readFile(resolve(manifestPath),'utf8'):null,manifestJson=manifestRaw?JSON.parse(manifestRaw):null,manifest=manifestInfo(manifestJson);if(manifestJson)await writeFile(join(directory,'manifest.json'),manifestRaw);const captured=await inventory(origin,directory,routeFilter);for(const route of captured.pages){route.generationScope=generationScope(route,manifest);if(route.generationScope.applicable&&route.generation!==manifest.generation)throw Error(`Inventory generation mismatch for ${label} ${route.id}`);}const pages=visualFilter?captured.pages.filter(page=>visualFilter.includes(page.path)):captured.pages;const native=chrome?await nativeCapture(chrome,origin,pages,directory,manifest,captured.asset,presets):[];const {asset,getAssets,...serializable}=captured;serializable.assets=getAssets();const variant={label,origin:origin.href,directory,provenance:{harnessSha256:report.harnessSha256,probeContractSha256:report.probeContractSha256,hardware:report.hardware,browser:report.browser,gpu:report.gpu,presets},manifest:manifest?{path:resolve(manifestPath),sha256:sha256(manifestRaw),generation:manifest.generation,schemaVersion:manifest.schema_version,compilerVersion:manifest.compiler_version}:null,inventory:serializable,native,timing:timingSummary(native)};reports.push(variant);report.variants.push(variant);await writeFile(join(directory,'report.json'),JSON.stringify(variant,null,2));await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));console.log(`${label}: ${captured.pages.length} HTML routes, ${serializable.assets.length} declared/observed assets, ${native.length} native cases`);}
        const baseline=reports.find(variant=>variant.label==='baseline');if(baseline)for(const variant of reports.filter(variant=>variant!==baseline)){const comparison=await compareReports(baseline,variant,join(output,variant.label));report.comparisons.push(comparison);}
        // Keep compiler-upgrade, correctness-guard, naming, and factoring
        // attribution separate; only the original-to-candidate comparison
        // owns the acceptance gate.
        for(const [older,newer] of [['baseline','upgrade-control'],['upgrade-control','guard-control'],['guard-control','naming-control'],['naming-control','candidate']]){
            const before=reports.find(variant=>variant.label===older),after=reports.find(variant=>variant.label===newer);
            if(before&&after)report.compressionAttribution.push(compressionAttribution(before,after));
        }
        if(options.assert){const targets=report.comparisons.filter(comparison=>comparison.after==='candidate');const failures=targets.flatMap(comparison=>[...comparison.summary.brotliGrowthRoutes.map(id=>`${comparison.after}: Brotli route growth ${id}`),...comparison.summary.gzipGrowthRoutes.map(id=>`${comparison.after}: gzip route growth ${id}`),...['brotli5','gzip9'].filter(codec=>comparison.summary.aggregateDelta[codec]>=0).map(codec=>`${comparison.after}: aggregate ${codec} savings required`),...comparison.summary.missingRoutes.map(id=>`${comparison.after}: missing route ${id}`),...comparison.routeSizes.filter(item=>item.error).map(item=>`${comparison.after}: ${item.error} ${item.id}`),...comparison.summary.missingNativeCases.map(key=>`${comparison.after}: missing native case ${key}`),...nativeTransferFailures(comparison),...comparison.native.filter(item=>item.error||item.strictDifferences||item.errors?.length||item.overflow).map(item=>`${comparison.after}: native difference ${item.key}`)]);if(!targets.length)failures.push('No matched baseline-to-candidate comparison to assert');report.assertions={passed:failures.length===0,scope:options.mode==='inventory'?'compressed route body inventory only':'matched compressed route inventory, native actual cold/warm document plus declared-asset transfers, and native static CSS/layout parity; animation/GPU-state reviews retained separately',targets:targets.map(comparison=>comparison.after),failures};if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}}
        await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
        console.log(`CSS evaluation saved: ${join(output,'report.json')}`);
    }finally{await chrome?.close();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
