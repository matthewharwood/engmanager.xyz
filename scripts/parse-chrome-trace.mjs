// Uninterrupted native GPU traces can exceed V8's single-string limit. Keep
// the complete compressed source artifact, but parse individual event objects
// from its UTF-8 bytes and retain the evidence used by our bounded analysis.
const names=new Set(['thread_name','DrawFrame','AnimationFrame::Presentation','Presentation','DroppedFrame','PipelineReporter',
    'RunTask','ThreadControllerImpl::RunTask','UpdateLayoutTree','RecalculateStyles','Layout','Paint','RasterTask',
    'ParseHTML','V8.CompileCode','V8.CompileScript','v8.compile','FunctionCall','EvaluateScript',
    'GPUTask','GpuTask','DrawAndSwap','Display::DrawAndSwap','ResourceSendRequest','ResourceReceiveResponse','ResourceFinish']);

export function parseChromeTrace(buffer) {
    const field=buffer.indexOf('"traceEvents"');
    const begin=field<0?-1:buffer.indexOf('[',field);
    if(begin<0)throw Error('Chrome trace has no traceEvents array');
    const events=[];
    let entry=-1,depth=0,quoted=false,escaped=false;
    for(let index=begin+1;index<buffer.length;index++) {
        const byte=buffer[index];
        if(entry<0) {
            if(byte===93)return events;
            if(byte===44||byte===32||byte===9||byte===10||byte===13)continue;
            if(byte!==123)throw Error(`Invalid Chrome trace event at byte ${index}`);
            entry=index;depth=1;continue;
        }
        if(quoted) {
            if(escaped)escaped=false;
            else if(byte===92)escaped=true;
            else if(byte===34)quoted=false;
            continue;
        }
        if(byte===34)quoted=true;
        else if(byte===123)depth++;
        else if(byte===125&&!--depth) {
            const event=JSON.parse(buffer.subarray(entry,index+1).toString('utf8'));
            if(names.has(event.name)||event.name.startsWith('journey-perf:')||event.name.startsWith('journey-diag:')||event.name.includes('FrameSequenceTracker')
                ||/^Frame\s*$/.test(event.name)||(event.ph==='X'&&event.dur>=500))events.push(event);
            entry=-1;
        }
    }
    throw Error('Chrome trace ends inside its event array');
}
