// Chrome trace analysis shared by the local journey profiler and its tests.
// The raw trace remains the authority: RAF cadence and GPU submissions are
// reported separately from compositor draws rather than called presented FPS.
export function distribution(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const percentile = (fraction) => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
    return { count: sorted.length, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1) ?? null,
        over16_7: sorted.filter((value) => value > 16.7).length,
        over33_3: sorted.filter((value) => value > 33.3).length,
        over50: sorted.filter((value) => value > 50).length };
}

export function intervals(times) {
    const sorted = [...new Set(times.filter(Number.isFinite))].sort((a, b) => a - b);
    return distribution(sorted.slice(1).map((value, index) => value - sorted[index]));
}

export function networkAggregates(requests) {
    const finished=requests.filter((request)=>request.finished);
    const encodedBytesByType={};
    for(const request of finished)encodedBytesByType[request.type||'Other']=(encodedBytesByType[request.type||'Other']||0)+(request.bytes||0);
    const cards=finished.filter((request)=>/\/assets\/shop\/caps\/[^/]+-front(?:-\d+)?(?:\.[0-9a-f]{8})?\.webp(?:$|\?)/i.test(request.url));
    return {encodedBytesByType,shopCardRequests:cards.length,shopCardBytes:cards.reduce((sum,request)=>sum+(request.bytes||0),0),
        shopCards:cards.map(({url,bytes,durationMs,fromDiskCache,fromServiceWorker})=>({url,bytes,durationMs,fromDiskCache,fromServiceWorker}))};
}

export function traceNetwork(events) {
    const requests=new Map();
    for(const event of events) {
        const data=event.args?.data;
        if(!data?.requestId)continue;
        if(event.name==='ResourceSendRequest')requests.set(data.requestId,{url:data.url,type:data.resourceType,started:event.ts,requestId:data.requestId});
        const request=requests.get(data.requestId);
        if(!request)continue;
        if(event.name==='ResourceReceiveResponse')Object.assign(request,{status:data.statusCode,fromDiskCache:!!data.fromCache,fromServiceWorker:!!data.fromServiceWorker});
        if(event.name==='ResourceFinish')Object.assign(request,{bytes:data.encodedDataLength||0,finished:event.ts,durationMs:(event.ts-request.started)/1000,didFail:!!data.didFail});
    }
    return [...requests.values()];
}

// Sequence summary slices can span phase boundaries. Attribute cumulative
// frame-counter deltas to their actual presentation, rather than charging an
// entire merged TouchScroll sequence to the phase in which it began.
export function nativeFrameSequences(events) {
    const key=(event)=>`${event.pid}:${event.tid}:${event.id2?.local??event.id}`;
    const sequences=[],active=new Map();
    for(const event of events.filter(event=>event.name.includes('FrameSequenceTracker')).sort((a,b)=>a.ts-b.ts)) {
        const id=key(event);
        if(!active.has(id))active.set(id,[]);
        if(event.ph==='b'&&event.args?.name){const sequence={event,key:id,end:Infinity,frames:[]};sequences.push(sequence);active.get(id).push(sequence);}
        else if(event.ph==='e'){const sequence=active.get(id).pop();if(sequence)sequence.end=event.ts;}
    }
    const ends=new Map();
    for(const event of events.filter(event=>event.ph==='e'&&/^Frame\s*$/.test(event.name))) {
        const id=`${key(event)}:${event.name}`;
        if(!ends.has(id))ends.set(id,[]);
        ends.get(id).push(event.ts);
    }
    for(const times of ends.values())times.sort((a,b)=>a-b);
    const byKey=new Map();
    for(const sequence of sequences){if(!byKey.has(sequence.key))byKey.set(sequence.key,[]);byKey.get(sequence.key).push(sequence);}
    for(const group of byKey.values())group.sort((a,b)=>a.event.ts-b.event.ts);
    for(const frame of events.filter(event=>event.ph==='b'&&/^Frame\s*$/.test(event.name)&&event.args?.data?.values)) {
        const group=byKey.get(key(frame));
        // AdoptTrace can keep an old track alive while its allocation ID is
        // reused by a short nested sequence. A later frame belongs to the
        // still-open outer sequence once the nested sequence has ended.
        const sequence=group?.findLast(sequence=>sequence.event.ts<=frame.ts&&sequence.end>=frame.ts);
        // Advance emits only positive presentation intervals. At a shared
        // boundary the preceding frame's end is not this new frame's end.
        const end=ends.get(`${key(frame)}:${frame.name}`)?.find(time=>time>frame.ts);
        if(sequence&&Number.isFinite(end))sequence.frames.push({start:frame.ts,end,values:frame.args.data.values});
    }
    for(const sequence of sequences) {
        sequence.frames.sort((a,b)=>a.start-b.start);
        let previous={expected:0,dropped_v4:0,dropped_v3:0};
        for(const frame of sequence.frames){if(frame.values.expected<previous.expected)previous={expected:0,dropped_v4:0,dropped_v3:0};frame.expected=Math.max(0,frame.values.expected-previous.expected);frame.dropped=Math.max(0,(frame.values.dropped_v4??frame.values.dropped_v3??0)-(previous.dropped_v4??previous.dropped_v3??0));previous=frame.values;}
    }
    return sequences;
}

function freshCompletedCounters(sequence) {
    const first=sequence.frames[0],last=sequence.frames.at(-1);
    const dropped=frame=>frame.values.dropped_v4??frame.values.dropped_v3;
    if(!first||first.start!==sequence.event.ts||last.end!==sequence.end||first.values.expected!==1||dropped(first)!==0
        ||first.values.last_sequence!==0||!Number.isSafeInteger(first.values.sequence_number)||first.values.sequence_number<1)return null;
    for(let index=1;index<sequence.frames.length;index++) {
        const frame=sequence.frames[index],previous=sequence.frames[index-1];
        if(frame.start!==previous.end||frame.values.expected!==previous.values.expected+1
            ||frame.values.last_sequence!==previous.values.sequence_number
            ||frame.values.sequence_number!==previous.values.sequence_number+1
            ||!Number.isFinite(dropped(frame))||dropped(frame)<dropped(previous)
            ||dropped(frame)>dropped(previous)+1)return null;
    }
    return {expected:last.values.expected,dropped:dropped(last)};
}

export function nativePipelineFrames(events) {
    const active=new Map(),frames=[];
    for(const event of events.filter(event=>event.name==='PipelineReporter').sort((a,b)=>a.ts-b.ts)) {
        const key=`${event.pid}:${event.tid}:${event.id2?.local??event.id}`;
        if(event.ph==='b'&&event.args?.frame_reporter){const frame={pid:event.pid,start:event.ts,...event.args.frame_reporter};active.set(key,frame);frames.push(frame);}
        else if(event.ph==='e'){const frame=active.get(key);if(frame){frame.end=event.ts;active.delete(key);}}
    }
    return frames;
}

function pipelinePresentations(frames, pid, start, end) {
    const presented = frames.filter(frame => frame.pid === pid && frame.end >= start && frame.end <= end && /^STATE_PRESENTED/.test(frame.state));
    const displays = new Map();
    // A normal and a forked main/compositor reporter, or two layer-tree hosts,
    // can describe the same display presentation. Keep their individual flags
    // for attribution, while counting that exact native end timestamp once.
    // display_trace_id is an int64 and is unsafe as a JavaScript Number key.
    for (const frame of presented) {
        if (!displays.has(frame.end)) displays.set(frame.end, { end:frame.end, presentedMs:(frame.end-start)/1000, reporters:[] });
        displays.get(frame.end).reporters.push(frame);
    }
    const values = [...displays.values()].map(display => ({ ...display,
        has_missing_content:display.reporters.some(frame => frame.has_missing_content),
        checkerboarded_needs_raster:display.reporters.some(frame => frame.checkerboarded_needs_raster),
        checkerboarded_needs_record:display.reporters.some(frame => frame.checkerboarded_needs_record) }));
    return { count:values.length, reporterCount:presented.length,
        missingContent:values.filter(frame => frame.has_missing_content).length,
        checkerboardedNeedsRaster:values.filter(frame => frame.checkerboarded_needs_raster).length,
        checkerboardedNeedsRecord:values.filter(frame => frame.checkerboarded_needs_record).length,
        missingFrames:values.filter(frame => frame.has_missing_content) };
}

export function pixelWarnings(leg) {
    return [...leg.phases, ...(leg.handoffAnimation || [])].filter(phase => phase.trace?.pipelinePresentation.missingContent)
        .map(phase => ({ phase:phase.name, ...phase.trace.pipelinePresentation }));
}

export function analyzeTrace(events, phaseNames) {
    const marks = events.filter((event) => event.name.startsWith('journey-perf:'));
    const nativeSequences=nativeFrameSequences(events);
    const pipelines=nativePipelineFrames(events);
    const phases = {};
    for (const phase of phaseNames) {
        const startMark = marks.find((event) => event.name === `journey-perf:${phase}:start`);
        const start = startMark?.ts;
        const end = marks.find((event) => event.name === `journey-perf:${phase}:end`)?.ts;
        if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error(`Trace lacks complete marks for ${phase}`);
        const within = events.filter((event) => event.ts >= start && event.ts <= end);
        const target = within.filter((event) => event.pid === startMark.pid);
        const main = target.filter((event) => event.tid === startMark.tid);
        const workerThreads = new Set(events.filter((event) => event.pid === startMark.pid && event.name === 'thread_name' && /DedicatedWorker/i.test(event.args?.name || '')).map((event) => event.tid));
        const taskName = main.some((event) => event.name === 'RunTask') ? 'RunTask' : 'ThreadControllerImpl::RunTask';
        const groups = {};
        for (const [name, names] of Object.entries({
            task: [taskName],
            style: ['UpdateLayoutTree', 'RecalculateStyles'],
            layout: ['Layout'], paint: ['Paint'], raster: ['RasterTask'],
            parse: ['ParseHTML'], compile: ['V8.CompileCode', 'V8.CompileScript', 'v8.compile'],
            script: ['FunctionCall', 'EvaluateScript'],
            gpu: ['GPUTask', 'GpuTask', 'DrawAndSwap', 'Display::DrawAndSwap'],
        })) {
            const scope = name === 'gpu' ? within.filter((event) => event.args?.data?.renderer_pid === startMark.pid) : name === 'raster' ? target : main;
            const samples = scope.filter((event) => event.ph === 'X' && names.includes(event.name) && Number.isFinite(event.dur));
            groups[name] = { ...distribution(samples.map((event) => event.dur / 1000)), totalMs: samples.reduce((sum, event) => sum + event.dur / 1000, 0) };
        }
        const workerTasks = target.filter((event) => workerThreads.has(event.tid) && event.ph === 'X' && event.name === 'RunTask' && Number.isFinite(event.dur));
        groups.worker = { ...distribution(workerTasks.map((event) => event.dur / 1000)), totalMs: workerTasks.reduce((sum,event) => sum + event.dur / 1000,0) };
        const drawEvents = target.filter((event) => event.name === 'DrawFrame');
        // A trace may contain draws from more than one compositor. Keep each
        // thread's cadence distinct, then select the active target's busiest
        // draw track; interleaving two tracks would invent a higher frame rate.
        const tracks = new Map();
        for (const event of drawEvents) {
            const key = `${event.pid}:${event.tid}`;
            if (!tracks.has(key)) tracks.set(key, []);
            tracks.get(key).push(event.ts / 1000);
        }
        const busiest = [...tracks.values()].sort((a, b) => b.length - a.length)[0] || [];
        const presented = target.filter((event) => event.name === 'AnimationFrame::Presentation');
        const scrollPresented = target.filter((event) => event.name === 'Presentation' && event.args?.scroll_jank_v4);
        const sequences = nativeSequences.filter(sequence=>sequence.event.pid===startMark.pid&&sequence.frames.some(frame=>frame.end>=start&&frame.end<=end));
        const sequenceTotals = {};
        const counterProvenance = new Map();
        for (const sequence of sequences) {
            const event=sequence.event;
            const name = event.args.name;
            const data = event.args.args?.data||{};
            const total = sequenceTotals[name] ||= { expected:0,dropped:0,checkerboarded:0,missingContent:0 };
            const frames=sequence.frames.filter(frame=>frame.end>=start&&frame.end<=end);
            const complete=event.ts>=start&&sequence.end<=end&&Number.isFinite(data.expected);
            // A completed parent normally protects against overlapping
            // adopted children. Chromium can also Merge old counters only
            // at termination. Prefer a fresh, uninterrupted native child
            // chain solely when its final presentation is that exact end
            // and the parent has gained additional history afterward.
            const parent={expected:data.expected,dropped:data.dropped_v4??data.dropped_v3??0};
            const fresh=complete?freshCompletedCounters(sequence):null;
            const mergedHistory=fresh&&parent.expected>fresh.expected&&parent.dropped>=fresh.dropped;
            const selected=mergedHistory?fresh:complete?parent:{expected:frames.reduce((sum,frame)=>sum+frame.expected,0),dropped:frames.reduce((sum,frame)=>sum+frame.dropped,0)};
            counterProvenance.set(sequence,{source:mergedHistory?'fresh-complete-frame-chain':complete?'complete-parent-summary':'phase-frame-counter-deltas',
                parentSummary:parent,selectedPhaseCounters:selected,
                ...(mergedHistory?{mergedHistory:{expected:parent.expected-fresh.expected,dropped:parent.dropped-fresh.dropped}}:{})});
            total.expected += selected.expected;
            total.dropped += selected.dropped;
            // Keep parent pixel flags for diagnostics, but never charge them
            // to a precise phase: PipelineReporter records each actual frame
            // and its presentation time, including flags from opaque setup.
            total.checkerboarded += data.checkerboarded || 0;
            total.missingContent += data.missing_content || 0;
            total.droppedPercent = total.expected ? total.dropped / total.expected * 100 : 0;
        }
        phases[phase] = {
            pid:startMark.pid,durationMs: (end - start) / 1000, compositorDraw: intervals(busiest),
            compositorDrawTrackCount: tracks.size, presentedEventCount: presented.length,
            presentation: intervals(presented.map((event) => event.ts / 1000)),
            scrollPresentation: intervals(scrollPresented.map((event) => event.ts / 1000)),
            droppedFrameEvents: target.filter((event) => event.name === 'DroppedFrame').length,
            frameSequenceTotals: sequenceTotals,
            pipelinePresentation:pipelinePresentations(pipelines,startMark.pid,start,end),
            frameSequences: sequences.map(sequence => ({ name: sequence.event.name, args: sequence.event.args,
                presentedFrames:sequence.frames.filter(frame=>frame.end>=start&&frame.end<=end).length,
                counterProvenance:counterProvenance.get(sequence) })),
            work: groups,
            longestTasks: main.filter((event) => event.ph === 'X' && event.name === taskName && event.dur > 50000)
                .sort((a, b) => b.dur - a.dur).slice(0, 10)
                .map((event) => ({ name: event.name, durationMs: event.dur / 1000,
                    children: within.filter((child) => child.pid === event.pid && child.tid === event.tid && child.ph === 'X' && child.ts >= event.ts && child.ts + (child.dur || 0) <= event.ts + event.dur)
                        .sort((a, b) => (b.dur || 0) - (a.dur || 0)).slice(1, 9)
                        .map((child) => ({ name: child.name, durationMs: (child.dur || 0) / 1000, args: child.args })) })),
        };
    }
    return phases;
}
