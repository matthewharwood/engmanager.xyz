import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTrace, distribution, intervals, networkAggregates, traceNetwork, pixelWarnings } from './journey-performance-metrics.mjs';
import { parseChromeTrace } from './parse-chrome-trace.mjs';

test('bounded trace parsing preserves escaped UTF-8, frame evidence and costly attribution',()=>{
    const events=[{name:'thread_name',args:{name:'DedicatedWorker thread'}},
        {name:'EvaluateScript',args:{data:{url:'http://local/é.js',text:'braces {} and quoted " \\ ]'}}},
        {name:'Frame   ',args:{data:{values:{expected:42}}}},
        {name:'native driver call',ph:'X',dur:900},{name:'unrelated tiny event',ph:'X',dur:499}];
    const parsed=parseChromeTrace(Buffer.from(JSON.stringify({traceEvents:events,metadata:{label:'preserved separately'}})));
    assert.deepEqual(parsed,events.slice(0,4));
    assert.throws(()=>parseChromeTrace(Buffer.from('{"traceEvents":[{"name":"incomplete"}')),/ends inside/);
});

test('percentiles and thresholds retain frame stalls without dropping tails',()=>{
    assert.deepEqual(distribution([16,16,17,34,51]),{count:5,p50:17,p95:51,p99:51,max:51,over16_7:3,over33_3:2,over50:1});
    assert.equal(intervals([100,116,116,132,182]).max,50);
});

test('trace evidence isolates target main thread, presentations, and native scroll drops',()=>{
    const mark=(name,ts)=>({name:`journey-perf:scroll:${name}`,ts,pid:1,tid:2,ph:'I'});
    const complete=(name,ts,dur,pid=1,tid=2)=>({name,ts,dur,pid,tid,ph:'X'});
    const instant=(name,ts,pid=1,tid=3)=>({name,ts,pid,tid,ph:'I'});
    const events=[mark('start',1000),mark('end',101000),
        complete('RunTask',2000,60000),complete('ThreadControllerImpl::RunTask',2000,60000),
        complete('RunTask',2000,99000,8,7),complete('Layout',3000,4000),
        instant('DrawFrame',17000),instant('DrawFrame',33000),instant('DrawFrame',67000),
        instant('DrawFrame',19000,8),instant('DrawFrame',21000,8),instant('DrawFrame',23000,8),instant('DrawFrame',25000,8),
        instant('AnimationFrame::Presentation',19000,1,2),instant('AnimationFrame::Presentation',35000,1,2),instant('AnimationFrame::Presentation',69000,1,2),
        {name:'FrameSequenceTrackerV3',ts:5000,pid:1,tid:3,ph:'b',args:{name:'TouchScroll',args:{data:{expected:60,dropped_v4:3,checkerboarded:0,missing_content:0}}}},
        {name:'Frame',ts:6000,pid:1,tid:3,ph:'b',args:{data:{values:{expected:60,dropped_v4:3}}}},
        {name:'Frame',ts:7000,pid:1,tid:3,ph:'e',args:{}},
    ];
    const result=analyzeTrace(events,['scroll']).scroll;
    assert.equal(result.work.task.count,1,'nested scheduler task is not counted twice');
    assert.equal(result.work.task.max,60,'unrelated browser thread is excluded');
    assert.equal(result.compositorDraw.count,2);
    assert.equal(result.presentation.max,34);
    assert.equal(result.frameSequenceTotals.TouchScroll.droppedPercent,5);
    assert.equal(result.longestTasks.length,1);
});

test('a merged native sequence assigns cumulative counter deltas by presentation across phases',()=>{
    const event=(name,ts,ph,args={})=>({name,ts,ph,args,pid:1,tid:2,id2:{local:'x'}});
    const events=[event('journey-perf:scroll:start',1000,'I'),event('journey-perf:scroll:end',10000,'I'),
        event('FrameSequenceTrackerV3',100,'b',{name:'TouchScroll',args:{data:{expected:100,dropped_v4:5,checkerboarded:0,missing_content:0}}}),
        event('Frame',200,'b',{data:{values:{expected:90,dropped_v4:4}}}),event('Frame',500,'e'),
        event('Frame ',1100,'b',{data:{values:{expected:94,dropped_v4:5}}}),event('Frame ',2000,'e'),
        event('Frame   ',2100,'b',{data:{values:{expected:100,dropped_v4:5}}}),event('Frame   ',11000,'e')];
    const result=analyzeTrace(events,['scroll']).scroll.frameSequenceTotals.TouchScroll;
    assert.equal(result.expected,4,'work before the marked phase is excluded');
    assert.equal(result.dropped,1,'work presented after the marked phase is excluded');
});

test('adopted sequence counters reset per gesture and resume after a nested reused trace ID ends',()=>{
    const event=(name,ts,ph,args={})=>({name,ts,ph,args,pid:1,tid:2,id2:{local:'reused'}});
    const frame=(start,end,expected)=>[event('Frame',start,'b',{data:{values:{expected,dropped_v4:0}}}),event('Frame',end,'e')];
    const events=[event('journey-perf:scroll:start',0,'I'),event('journey-perf:scroll:end',20000,'I'),
        event('FrameSequenceTrackerV3',100,'b',{name:'TouchScroll'}),...frame(200,500,30),
        event('FrameSequenceTrackerV3',1000,'b',{name:'CanvasAnimation'}),...frame(1100,1500,1),event('FrameSequenceTrackerV3',1600,'e'),
        ...frame(2000,2500,1),...frame(2600,3000,30),event('FrameSequenceTrackerV3',3100,'e')];
    const result=analyzeTrace(events,['scroll']).scroll.frameSequenceTotals;
    assert.equal(result.TouchScroll.expected,60);
    assert.equal(result.CanvasAnimation.expected,1);
});

test('contained summaries beat overlapping adopted counters without inflating expected frames',()=>{
    const event=(name,ts,ph,args={})=>({name,ts,ph,args,pid:1,tid:2,id2:{local:'reused'}});
    const events=[event('journey-perf:scroll:start',0,'I'),event('journey-perf:scroll:end',20000,'I'),
        event('FrameSequenceTrackerV3',100,'b',{name:'TouchScroll',args:{data:{expected:60,dropped_v4:1}}}),
        event('Frame',200,'b',{data:{values:{expected:100,dropped_v4:0}}}),event('Frame',500,'e'),
        event('Frame ',600,'b',{data:{values:{expected:1,dropped_v4:1}}}),event('Frame ',1000,'e'),event('FrameSequenceTrackerV3',1500,'e')];
    const result=analyzeTrace(events,['scroll']).scroll.frameSequenceTotals.TouchScroll;
    assert.equal(result.expected,60);
    assert.equal(result.dropped,1);
});

function terminatedMergedSequence(change=()=>{}) {
    const event=(name,ts,ph,args={})=>({name,ts,ph,args,pid:1,tid:2,id2:{local:'merged'}});
    const frames=[{expected:1,dropped_v4:0,last_sequence:0,sequence_number:1575},
        {expected:2,dropped_v4:0,last_sequence:1575,sequence_number:1576},
        {expected:3,dropped_v4:0,last_sequence:1576,sequence_number:1577}];
    change(frames);
    return [event('journey-perf:fade:start',0,'I'),event('journey-perf:fade:end',10000,'I'),
        event('FrameSequenceTrackerV3',1000,'b',{name:'CompositorAnimation',args:{data:{expected:50,dropped_v4:18}}}),
        ...frames.flatMap((values,index)=>[event('Frame',1000+index*1000,'b',{data:{values}}),event('Frame',2000+index*1000,'e')]),
        event('FrameSequenceTrackerV3',4000,'e')];
}

test('a fresh complete native child chain excludes history merged only into the termination summary',()=>{
    const result=analyzeTrace(terminatedMergedSequence(),['fade']).fade;
    assert.equal(result.frameSequenceTotals.CompositorAnimation.expected,3);
    assert.equal(result.frameSequenceTotals.CompositorAnimation.dropped,0);
    assert.equal(result.frameSequences[0].counterProvenance.source,'fresh-complete-frame-chain');
    assert.deepEqual(result.frameSequences[0].counterProvenance.mergedHistory,{expected:47,dropped:18});
    assert.equal(result.frameSequences[0].args.args.data.expected,50,'the original native parent summary is retained');
});

test('the native child-chain correction preserves actual child drops',()=>{
    const result=analyzeTrace(terminatedMergedSequence(frames=>{frames[2].dropped_v4=1;}),['fade']).fade;
    assert.equal(result.frameSequenceTotals.CompositorAnimation.dropped,1);
    assert.ok(Math.abs(result.frameSequenceTotals.CompositorAnimation.droppedPercent-100/3)<1e-10);
    assert.deepEqual(result.frameSequences[0].counterProvenance.mergedHistory,{expected:47,dropped:17});
});

test('absent metadata, sequence gaps, resets and incomplete native child chains preserve the authoritative parent',()=>{
    const variants=[
        events=>{delete events.find(event=>event.name==='Frame'&&event.ph==='b').args.data.values.last_sequence;},
        events=>{events.find(event=>event.name==='Frame'&&event.ph==='b'&&event.ts===2000).args.data.values.sequence_number=1578;},
        events=>{events.find(event=>event.name==='Frame'&&event.ph==='b'&&event.ts===2000).args.data.values.expected=1;},
        events=>{events.find(event=>event.name==='FrameSequenceTrackerV3'&&event.ph==='e').ts=4500;},
        events=>{events.find(event=>event.name==='Frame'&&event.ph==='b'&&event.ts===2000).ts=2100;},
    ];
    for(const alter of variants){const events=terminatedMergedSequence();alter(events);const result=analyzeTrace(events,['fade']).fade;
        assert.equal(result.frameSequenceTotals.CompositorAnimation.expected,50);
        assert.equal(result.frameSequenceTotals.CompositorAnimation.dropped,18);
        assert.equal(result.frameSequences[0].counterProvenance.source,'complete-parent-summary');
    }
});

test('missing pixels are assigned by actual native presentation rather than a merged parent summary',()=>{
    const event=(name,ts,ph,args={},id='sequence')=>({name,ts,ph,args,pid:1,tid:2,id2:{local:id}});
    const pipeline=(start,end,missing,id)=>[event('PipelineReporter',start,'b',{frame_reporter:{state:'STATE_PRESENTED_ALL',has_missing_content:missing,checkerboarded_needs_raster:missing,frame_sequence:id,frame_source:1,layer_tree_host_id:1}},id),event('PipelineReporter',end,'e',{},id)];
    const events=[event('journey-perf:fade:start',5000,'I'),event('journey-perf:fade:end',20000,'I'),
        event('FrameSequenceTrackerV3',100,'b',{name:'CompositorAnimation',args:{data:{expected:100,checkerboarded:3,missing_content:3}}}),
        event('Frame',6000,'b',{data:{values:{expected:1,dropped_v4:0}}}),event('Frame',7000,'e'),
        ...pipeline(1000,2000,true,'opaque'),...pipeline(4500,6000,false,'visible'),...pipeline(19000,21000,true,'after')];
    const clean=analyzeTrace(events,['fade']).fade;
    assert.equal(clean.frameSequenceTotals.CompositorAnimation.missingContent,3,'uncertain parent summary remains visible');
    assert.equal(clean.pipelinePresentation.count,1);
    assert.equal(clean.pipelinePresentation.missingContent,0,'opaque preparation pixels are not charged to the visible fade');
    const broken=analyzeTrace([...events,...pipeline(4900,6500,true,'broken')],['fade']).fade;
    assert.equal(broken.pipelinePresentation.missingContent,1,'a frame begun earlier but presented during fade still fails');
    assert.equal(broken.pipelinePresentation.missingFrames[0].presentedMs,1.5);
});

test('incomplete trace marks fail visibly instead of claiming a pass',()=>{
    assert.throws(()=>analyzeTrace([],['promotion']),/lacks complete marks/);
});

test('forked and multi-layer reporters count one display while post-fade pixel warnings stay explicit',()=>{
    const event=(name,ts,ph,args={},id='sequence')=>({name,ts,ph,args,pid:1,tid:2,id2:{local:id}});
    const pipeline=(start,end,missing,id,host,type)=>[event('PipelineReporter',start,'b',{frame_reporter:{state:'STATE_PRESENTED_ALL',has_missing_content:missing,checkerboarded_needs_raster:missing,frame_sequence:id,frame_source:1,layer_tree_host_id:host,frame_type:type}},id),event('PipelineReporter',end,'e',{},id)];
    const events=[event('journey-perf:fade:start',0,'I'),event('journey-perf:fade:end',20000,'I'),event('journey-perf:settled:start',20001,'I'),event('journey-perf:settled:end',50000,'I'),
        ...pipeline(1000,16000,false,'main',1),...pipeline(2000,16000,false,'fork',1,'FORKED'),...pipeline(3000,16000,false,'child',2),
        ...pipeline(25000,33000,true,'missing',1),...pipeline(27000,33000,true,'missing-fork',1,'FORKED')];
    const traced=analyzeTrace(events,['fade','settled']);
    assert.equal(traced.fade.pipelinePresentation.count,1);
    assert.equal(traced.fade.pipelinePresentation.reporterCount,3);
    assert.equal(traced.settled.pipelinePresentation.missingContent,1);
    assert.equal(traced.settled.pipelinePresentation.missingFrames[0].reporters.length,2);
    assert.equal(pixelWarnings({phases:[{name:'settled',trace:traced.settled}],handoffAnimation:[{name:'fade',trace:traced.fade}]})[0].phase,'settled');
});

test('encoded catalog transfer totals distinguish variants, cache hits, and unfinished requests',()=>{
    const requests=[
        {url:'http://127.0.0.1/assets/shop/caps/cap-front.0123abcd.webp',type:'Image',bytes:600000,finished:10},
        {url:'http://127.0.0.1/assets/shop/caps/cap-front-384.abcdef01.webp',type:'Image',bytes:45000,finished:20},
        {url:'http://127.0.0.1/assets/shop/caps/cap-front-160.abcdef02.webp',type:'Image',bytes:0,finished:21,fromDiskCache:true},
        {url:'http://127.0.0.1/assets/shop/caps/cap-left.abcdef03.webp',type:'Image',bytes:12000,finished:22},
        {url:'http://127.0.0.1/assets/shop/caps/pending-front.abcdef04.webp',type:'Image',bytes:12345},
        {url:'http://127.0.0.1/assets/journey/shop.abcdef05.glb',type:'Fetch',bytes:3000000,finished:24},
    ];
    const totals=networkAggregates(requests);
    assert.equal(totals.shopCardRequests,3);
    assert.equal(totals.shopCardBytes,645000);
    assert.deepEqual(totals.encodedBytesByType,{Image:657000,Fetch:3000000});
    const trace=traceNetwork([
        {name:'ResourceSendRequest',ts:1000,args:{data:{requestId:'a',url:requests[0].url,resourceType:'Image'}}},
        {name:'ResourceReceiveResponse',ts:2000,args:{data:{requestId:'a',statusCode:200,fromCache:false}}},
        {name:'ResourceFinish',ts:9000,args:{data:{requestId:'a',encodedDataLength:600000,didFail:false}}},
    ]);
    assert.equal(trace[0].bytes,600000);
    assert.equal(trace[0].durationMs,8);
});
