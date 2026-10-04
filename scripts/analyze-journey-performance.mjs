#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { analyzeTrace, networkAggregates, traceNetwork, pixelWarnings } from './journey-performance-metrics.mjs';
import { parseChromeTrace } from './parse-chrome-trace.mjs';

const path=resolve(process.argv[2] || 'report.json');
const report=JSON.parse(await readFile(path,'utf8'));
report.analysis={method:'native-presentations-and-phase-frame-counters-v2',analyzedAt:new Date().toISOString(),
    sources:Object.fromEntries(await Promise.all(['journey-performance-metrics.mjs','parse-chrome-trace.mjs'].map(async name=>[name,createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex')])))};
const rows=[];
for(const run of report.runs){
const lapEvents=report.traceLayout==='lap'?parseChromeTrace(gunzipSync(await readFile(join(dirname(path),`${run.name}.trace.json.gz`)))):null;
const lapAnalysis=lapEvents?analyzeTrace(lapEvents,run.legs.flatMap(leg=>[...leg.phases.map(phase=>phase.name),...(leg.handoffAnimation||[]).map(animation=>animation.name)])):null;
const lapRequests=lapEvents?traceNetwork(lapEvents):null;
for(let index=0;index<run.legs.length;index++) {
    const leg=run.legs[index];
    const name=`${run.name}-${index+1}-${leg.from.replace(/\W+/g,'-') || 'feed'}`;
    const events=lapEvents||parseChromeTrace(gunzipSync(await readFile(join(dirname(path),`${name}.trace.json.gz`))));
    const analyzed=lapAnalysis||analyzeTrace(events,leg.phases.map((phase)=>phase.name));
    const start=events.find(event=>event.name===`journey-perf:${leg.phases[0].name}:start`)?.ts;
    const end=events.find(event=>event.name===`journey-perf:${leg.phases.at(-1).name}:end`)?.ts;
    const requests=(lapRequests||traceNetwork(events)).filter(request=>request.started>=start&&request.started<=end);
    leg.traceNetwork={...networkAggregates(requests),requests};
    for(const animation of leg.handoffAnimation||[])animation.trace=analyzed[animation.name];
    for(const phase of leg.phases) {
        phase.trace=analyzed[phase.name];
        const total=phase.trace.frameSequenceTotals.TouchScroll;
        rows.push({run:run.name,from:leg.from,to:leg.to,phase:phase.name.split(':').at(-1),
            wallMs:phase.wallMs,presentP50:phase.trace.presentation.p50,presentP95:phase.trace.presentation.p95,presentP99:phase.trace.presentation.p99,
            presentOver33:phase.trace.presentation.over33_3,presentOver50:phase.trace.presentation.over50,
            scrollExpected:total?.expected??0,scrollDropped:total?.dropped??0,scrollDroppedPercent:total?.droppedPercent??0,
            longTasks:phase.longTasks.length,taskMaxMs:phase.trace.work.task.max,layoutMs:phase.trace.work.layout.totalMs,
            styleMs:phase.trace.work.style.totalMs,paintMs:phase.trace.work.paint.totalMs,gpuSubmitP50:phase.gpuSubmit.p50,
            fallback:!!leg.visual.hardNavigationFallback});
    }
    leg.pixelWarnings=pixelWarnings(leg);
}
}
report.pixelWarnings=report.runs.flatMap(run=>run.legs.flatMap(leg=>leg.pixelWarnings.map(warning=>({run:run.name,from:leg.from,to:leg.to,...warning}))));
await writeFile(path,JSON.stringify(report,null,2));
const keys=Object.keys(rows[0]||{});
const csv=[keys.join(','),...rows.map((row)=>keys.map((key)=>JSON.stringify(row[key]??'')).join(','))].join('\n')+'\n';
await writeFile(join(dirname(path),'phases.csv'),csv);
console.table(rows.filter((row)=>['scroll','promotion'].includes(row.phase)).map(({run,from,to,phase,presentP95,presentP99,scrollDroppedPercent,longTasks,layoutMs,gpuSubmitP50,fallback})=>({run,from,to,phase,p95:Math.round(presentP95||0),p99:Math.round(presentP99||0),dropped:Math.round(scrollDroppedPercent*10)/10,longTasks,layoutMs:Math.round(layoutMs),gpuSubmitP50:Math.round(gpuSubmitP50||0),fallback})));
