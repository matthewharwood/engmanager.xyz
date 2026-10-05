// Build-time CSS bindings. Identity forms keep direct-source tests readable;
// build.rs replaces calls with literals and Oxc removes unused helpers.
var cssClasses = value => value, cssSelector = value => value, cssToken = value => value, cssHtml = value => value;

/* A Blender-authored armillary, shaded by the shared marble renderer.
 * Static artwork survives missing GPU, Save-Data, load failure and device loss.
 * Only the sound button creates/resumes Web Audio. */
(() => {
    'use strict';
    if (window.__engArmillary) { window.__engArmillary.mount(); return; }
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let current;
    function mount() {
        const host=document.querySelector(cssSelector('[data-armillary]'));
        if(current?.host===host) return current.ready;
        current?.dispose(); current=null;
        if(!host || document.prerendering) return;
        current=create(host);
        return current.ready;
    }
    function create(host) {
        const canvas=host.querySelector(cssSelector('[data-armillary-canvas]'));
        const play=host.querySelector(cssSelector('[data-armillary-motion]'));
        const sound=host.querySelector(cssSelector('[data-armillary-sound]'));
        const status=host.querySelector(cssSelector('[data-armillary-audio-status]'));
        const events=new AbortController(),gpuWork=new AbortController();
        let renderer,observer,stopped=false,gpuFailed=false,paused=motion.matches,visible=true,raf=0,last=0,time=0,audio=null;
        let journeyHold=window.__engNav?.busy===true || document.body?.classList.contains(cssToken('journey-revealing'))===true;
        host.dataset.renderer='poster';play.hidden=true;
        play.textContent=paused?'Resume orbit':'Pause orbit';play.setAttribute('aria-pressed',String(paused));
        const mute=()=>{
            if(audio) { const old=audio;audio=null;old.gain.gain.setTargetAtTime(0,old.ctx.currentTime,.07);setTimeout(()=>old.ctx.close().catch(()=>{}),300); }
            sound.setAttribute('aria-pressed','false');sound.textContent='Sound off';status.textContent='Ambient sound disabled.';
        };
        mute();
        const dispose=()=>{
            if(stopped)return;stopped=true;cancelAnimationFrame(raf);events.abort();gpuWork.abort();observer?.disconnect();renderer?.destroy();mute();
        };
        const fallback=()=>{
            if(gpuFailed||stopped)return;gpuFailed=true;gpuWork.abort();host.dataset.renderer='poster';play.hidden=true;cancelAnimationFrame(raf);raf=0;renderer?.destroy();
        };
        const active=()=>!stopped&&!gpuFailed&&visible&&!document.hidden&&host.isConnected&&!journeyHold;
        function paint(now=0) {
            raf=0;if(!active()||!renderer)return;
            if(!paused&&!motion.matches&&last)time+=Math.min((now-last)/1000,.05);last=now;
            renderer.setRotation(-.30+time*.12,-.08);
            if(!paused&&!motion.matches)raf=requestAnimationFrame(paint);
        }
        function requestPaint() {
            renderer?.setVisible(active());
            if(!active()){cancelAnimationFrame(raf);raf=0;return;}
            if(!raf&&renderer)raf=requestAnimationFrame(paint);
        }
        play.addEventListener('click',()=>{paused=!paused;play.textContent=paused?'Resume orbit':'Pause orbit';play.setAttribute('aria-pressed',String(paused));last=0;cancelAnimationFrame(raf);raf=0;requestPaint();},{signal:events.signal});
        const preference=()=>{paused=motion.matches;play.hidden=!renderer||gpuFailed||motion.matches;play.textContent=paused?'Resume orbit':'Pause orbit';play.setAttribute('aria-pressed',String(paused));last=0;cancelAnimationFrame(raf);raf=0;requestPaint();};
        motion.addEventListener('change',preference,{signal:events.signal});
        document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)mute();requestPaint();},{signal:events.signal});
        window.addEventListener('eng:journeyexposure',event=>{
            journeyHold=event.detail?.active===true || window.__engNav?.busy===true;
            last=0;cancelAnimationFrame(raf);raf=0;requestPaint();
        },{signal:events.signal});
        window.addEventListener('eng:journeysettled',()=>{journeyHold=false;last=0;requestPaint();},{signal:events.signal});
        sound.hidden=!(window.AudioContext||window.webkitAudioContext);
        sound.addEventListener('click',async()=>{
            if(audio){mute();return;}
            try {
                const ctx=new (window.AudioContext||window.webkitAudioContext)();
                const gain=ctx.createGain();gain.gain.value=0;gain.connect(ctx.destination);
                const low=ctx.createOscillator(),overtone=ctx.createOscillator(),breath=ctx.createOscillator(),mod=ctx.createGain(),upper=ctx.createGain();
                low.type=overtone.type=breath.type='sine';low.frequency.value=55;overtone.frequency.value=82.41;breath.frequency.value=.065;
                upper.gain.value=.24;mod.gain.value=.006;
                low.connect(gain);overtone.connect(upper).connect(gain);breath.connect(mod).connect(gain.gain);
                audio={ctx,gain};const instance=audio;await ctx.resume();
                if(stopped||audio!==instance||document.hidden){ctx.close().catch(()=>{});return;}
                low.start();overtone.start();breath.start();gain.gain.setTargetAtTime(.045,ctx.currentTime,.65);
                sound.setAttribute('aria-pressed','true');sound.textContent='Sound on';status.textContent='Ambient sound enabled. Select Sound on to mute.';
            } catch (_) {mute();status.textContent='Sound is unavailable. The page works without it.';}
        },{signal:events.signal});
        async function boot() {
            try {
                if(!navigator.gpu||navigator.connection?.saveData||!window.__engJourneyPoster)return;
                const candidate=await window.__engJourneyPoster.mount(canvas,{
                    url:host.dataset.model,reducedMotion:motion.matches,signal:gpuWork.signal,onError:fallback,
                });
                if(stopped||gpuFailed){candidate.destroy();return;}
                renderer=candidate;
                host.dataset.renderer='webgpu';preference();
                observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);last=0;if(!visible)mute();requestPaint();});observer.observe(host);
            } catch (_) {if(!stopped)fallback();}
        }
        // The shared renderer resolves after its submitted first frame. A
        // stalled optional model is aborted while the decoded poster survives.
        const limit=setTimeout(fallback,4000);
        const ready=Promise.race([boot(),new Promise(resolve=>gpuWork.signal.addEventListener('abort',resolve,{once:true}))]).finally(()=>clearTimeout(limit));
        return {host,dispose,ready};
    }
    window.__engArmillary={mount};mount();
    window.addEventListener('pagehide',()=>{current?.dispose();current=null;});
    window.addEventListener('pageshow',event=>{if(event.persisted)mount();});
    document.addEventListener('prerenderingchange',mount,{once:true});
    window.__engNav?.onBeforeSwap?.(()=>{current?.dispose();current=null;});
    window.__engNav?.onSwap?.(mount);
})();
