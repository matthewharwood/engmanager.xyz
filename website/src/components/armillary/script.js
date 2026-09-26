/* A page-scoped WebGPU armillary. One draw call, capped pixels and 30fps.
 * Static SVG survives unsupported GPU, shader failure or device loss.
 * The sound button is the only path that creates/resumes Web Audio. */
(() => {
    'use strict';
    if (window.__engArmillary) { window.__engArmillary.mount(); return; }
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let current;
    const shader = `
struct Scene { value: vec4f }
@group(0) @binding(0) var<uniform> scene: Scene;
@group(0) @binding(1) var material: texture_2d<f32>;
@group(0) @binding(2) var materialSampler: sampler;
struct Vertex {
 @location(0) position: vec3f, @location(1) normal: vec3f,
 @location(2) uv: vec2f, @location(3) bary: vec3f, @location(4) kind: f32
}
struct Fragment {
 @builtin(position) position: vec4f, @location(0) normal: vec3f,
 @location(1) world: vec3f, @location(2) uv: vec2f,
 @location(3) bary: vec3f, @location(4) kind: f32
}
fn turn(p: vec3f) -> vec3f {
 let a = scene.value.z * .065 + .42;
 let x = vec3f(p.x*cos(a)+p.z*sin(a), p.y, -p.x*sin(a)+p.z*cos(a));
 return vec3f(x.x, x.y*cos(.24)-x.z*sin(.24), x.y*sin(.24)+x.z*cos(.24));
}
@vertex fn vertex(v: Vertex) -> Fragment {
 var out: Fragment; let p = turn(v.position); let w = 5.4-p.z;
 out.position = vec4f(p.x*2.5/(scene.value.x/scene.value.y), p.y*2.5, w*1.002-.1002, w);
 out.normal = turn(v.normal); out.world = p; out.uv = v.uv; out.bary=v.bary; out.kind=v.kind;
 return out;
}
@fragment fn fragment(v: Fragment) -> @location(0) vec4f {
 let n=normalize(v.normal); let view=normalize(vec3f(0,0,5.4)-v.world);
 let light=normalize(vec3f(-.7,1.1,1.6)); let h=normalize(light+view);
 let diffuse=max(dot(n,light),0.); let fresnel=pow(1.-max(dot(n,view),0.),3.);
 let tex=textureSample(material,materialSampler,v.uv).rgb;
 let etch=dot(tex,vec3f(.299,.587,.114));
 let grain=fract(sin(dot(v.uv*430.,vec2f(12.9898,78.233)))*43758.5453);
 let width=fwidth(v.bary)*1.15; let seam=1.-min(min(smoothstep(vec3f(0),width,v.bary).x,smoothstep(vec3f(0),width,v.bary).y),smoothstep(vec3f(0),width,v.bary).z);
 let gold=vec3f(.64,.49,.28); let pale=vec3f(.92,.83,.62);
 let stone=mix(vec3f(.025,.067,.063),vec3f(.23,.29,.25),etch*.32+diffuse*.45);
 let body=mix(stone, gold, seam*.26) * (.38+diffuse*.95);
 let brass=mix(gold,pale,diffuse*.6) * (.32+diffuse*.9);
 var color=mix(body,brass,v.kind)+pale*pow(max(dot(n,h),0.),mix(38.,85.,v.kind))*.85;
 color+=pale*fresnel*mix(.22,.35,v.kind)+gold*etch*.11;
 color*=.98+grain*.04;
 // A restrained filmic shoulder preserves the highlights instead of clipping.
 color=color/(vec3f(.65)+color); color=pow(color,vec3f(.82));
 return vec4f(color,1.);
}`;
    const norm = p => { const l = Math.hypot(...p); return p.map(v => v / l); };
    const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    function mesh() {
        const data=[];
        const triangle=(a,b,c,kind,uvs) => {
            const normal=norm(cross(b.map((x,i)=>x-a[i]),c.map((x,i)=>x-a[i])));
            [a,b,c].forEach((p,i)=>data.push(...p,...normal,...(uvs?.[i] || [Math.atan2(p[2],p[0])/(2*Math.PI)+.5,Math.acos(Math.max(-1,Math.min(1,p[1]/Math.hypot(...p))))/Math.PI]),...([0,1,2].map(j=>i===j?1:0)),kind));
        };
        const t=(1+Math.sqrt(5))/2;
        const points=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(norm);
        const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
        function facet(a,b,c,level) {
            if (!level) { triangle(...[a,b,c].map(p=>p.map(v=>v*.79)),0); return; }
            const ab=norm(a.map((v,i)=>v+b[i])),bc=norm(b.map((v,i)=>v+c[i])),ca=norm(c.map((v,i)=>v+a[i]));
            facet(a,ab,ca,level-1);facet(b,bc,ab,level-1);facet(c,ca,bc,level-1);facet(ab,bc,ca,level-1);
        }
        faces.forEach(f=>facet(...f.map(i=>points[i]),2));
        function ring(radius,tube,tilt,spin) {
            const segments=144,sides=6;
            const point=(i,j)=>{
                const u=i/segments*Math.PI*2,v=j/sides*Math.PI*2;
                const p=[(radius+tube*Math.cos(v))*Math.cos(u),tube*Math.sin(v),(radius+tube*Math.cos(v))*Math.sin(u)];
                const q=[p[0],p[1]*Math.cos(tilt)-p[2]*Math.sin(tilt),p[1]*Math.sin(tilt)+p[2]*Math.cos(tilt)];
                return [q[0]*Math.cos(spin)-q[1]*Math.sin(spin),q[0]*Math.sin(spin)+q[1]*Math.cos(spin),q[2]];
            };
            for(let i=0;i<segments;i++) for(let j=0;j<sides;j++) {
                const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);
                const u=i/segments,v=j/sides,un=(i+1)/segments,vn=(j+1)/sides;
                triangle(a,b,c,1,[[u,v],[un,v],[un,vn]]);triangle(a,c,d,1,[[u,v],[un,vn],[u,vn]]);
            }
        }
        ring(1.08,.012,.62,.25);ring(1.34,.014,1.25,-.58);ring(1.54,.01,.17,.38);ring(1.74,.006,1.45,.16);
        return new Float32Array(data);
    }
    function mount() {
        const host=document.querySelector('[data-armillary]');
        if(current?.host===host) return;
        current?.dispose(); current=null;
        if(!host || document.prerendering) return;
        current=create(host);
    }
    function create(host) {
        const canvas=host.querySelector('[data-armillary-canvas]');
        const play=host.querySelector('[data-armillary-motion]');
        const sound=host.querySelector('[data-armillary-sound]');
        const status=host.querySelector('[data-armillary-audio-status]');
        const events=new AbortController();
        let device,context,vertices,uniform,texture,color,depth,pipeline,bind,vertexCount;
        let stopped=false,gpuFailed=false,paused=motion.matches,visible=true,raf=0,last=0,time=0,audio=null;
        let observer,resize;
        const mute=()=>{
            if(audio) { const old=audio;audio=null;old.gain.gain.setTargetAtTime(0,old.ctx.currentTime,.07);setTimeout(()=>old.ctx.close().catch(()=>{}),300); }
            sound.setAttribute('aria-pressed','false');sound.textContent='Sound off';status.textContent='Ambient sound disabled.';
        };
        const dispose=()=>{
            if(stopped) return;stopped=true;cancelAnimationFrame(raf);events.abort();observer?.disconnect();resize?.disconnect();mute();
            [vertices,uniform,texture,color,depth].forEach(x=>x?.destroy());context?.unconfigure();device?.destroy();
        };
        const fallback=()=>{
            if(gpuFailed||stopped)return;gpuFailed=true;host.dataset.renderer='poster';play.hidden=true;cancelAnimationFrame(raf);raf=0;pipeline=null;
            [vertices,uniform,texture,color,depth].forEach(x=>x?.destroy());context?.unconfigure();device?.destroy();
        };
        const active=()=>!stopped&&visible&&!document.hidden&&host.isConnected;
        function paint(now=0) {
            raf=0;if(!active()||!pipeline) return;
            if(!paused&&now-last<33) {raf=requestAnimationFrame(paint);return;}
            if(!paused&&last)time+=Math.min((now-last)/1000,.05);last=now;
            try {
                device.queue.writeBuffer(uniform,0,new Float32Array([canvas.width,canvas.height,time,0]));
                const encoder=device.createCommandEncoder();
                const pass=encoder.beginRenderPass({colorAttachments:[{view:color.createView(),resolveTarget:context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'discard'}],depthStencilAttachment:{view:depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}});
                pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.setVertexBuffer(0,vertices);pass.draw(vertexCount);pass.end();device.queue.submit([encoder.finish()]);
                host.dataset.renderer='webgpu';
            } catch (_) {fallback();return;}
            if(!paused)raf=requestAnimationFrame(paint);
        }
        function requestPaint() {if(!raf&&active())raf=requestAnimationFrame(paint);}
        function size() {
            if(stopped||!device||!pipeline)return;
            const rect=canvas.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,1.25,Math.sqrt(650000/Math.max(1,rect.width*rect.height)));
            canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
            color?.destroy();depth?.destroy();
            const dimensions={width:canvas.width,height:canvas.height};
            color=device.createTexture({size:dimensions,sampleCount:4,format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT});
            depth=device.createTexture({size:dimensions,sampleCount:4,format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});requestPaint();
        }
        play.addEventListener('click',()=>{paused=!paused;play.textContent=paused?'Resume orbit':'Pause orbit';play.setAttribute('aria-pressed',String(paused));last=0;requestPaint();},{signal:events.signal});
        const preference=()=>{paused=motion.matches;play.textContent=paused?'Resume orbit':'Pause orbit';play.setAttribute('aria-pressed',String(paused));last=0;requestPaint();};
        motion.addEventListener('change',preference,{signal:events.signal});
        document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;mute();}else requestPaint();},{signal:events.signal});
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
                if(!navigator.gpu||navigator.connection?.saveData)return;
                const adapter=await navigator.gpu.requestAdapter({powerPreference:'low-power'});if(!adapter||stopped)return;
                const candidate=await adapter.requestDevice();if(stopped){candidate.destroy();return;}device=candidate;
                device.lost.then(()=>{if(!stopped)fallback();});device.addEventListener('uncapturederror',fallback,{signal:events.signal});
                context=canvas.getContext('webgpu');if(!context)throw new Error('Canvas unavailable');
                const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'premultiplied'});
                const module=device.createShaderModule({code:shader});
                pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vertex',buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x2'},{shaderLocation:3,offset:32,format:'float32x3'},{shaderLocation:4,offset:44,format:'float32'}]}]},fragment:{module,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'},multisample:{count:4}});
                if(stopped||gpuFailed)return;
                const data=mesh();vertexCount=data.length/12;vertices=device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(vertices,0,data);
                uniform=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
                const response=await fetch(host.dataset.texture,{signal:events.signal,credentials:'same-origin'});if(!response.ok)throw new Error('Material unavailable');
                const bitmap=await createImageBitmap(await response.blob());if(stopped){bitmap.close();return;}
                texture=device.createTexture({size:[bitmap.width,bitmap.height],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});
                device.queue.copyExternalImageToTexture({source:bitmap},{texture},{width:bitmap.width,height:bitmap.height});bitmap.close();
                bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:texture.createView()},{binding:2,resource:device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'repeat',addressModeV:'repeat'})}]});
                play.hidden=false;preference();resize=new ResizeObserver(size);resize.observe(canvas);size();
                observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;if(!visible){cancelAnimationFrame(raf);raf=0;mute();}else requestPaint();});observer.observe(host);
            } catch (_) {if(!stopped)fallback();}
        }
        boot();return {host,dispose};
    }
    window.__engArmillary={mount};mount();
    window.addEventListener('pagehide',()=>{current?.dispose();current=null;});
    window.addEventListener('pageshow',event=>{if(event.persisted)mount();});
    document.addEventListener('prerenderingchange',mount,{once:true});
    window.__engNav?.onBeforeSwap?.(()=>{current?.dispose();current=null;});
    window.__engNav?.onSwap?.(mount);
})();
