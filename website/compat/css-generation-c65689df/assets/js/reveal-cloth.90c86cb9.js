(()=>{let e=matchMedia(`(prefers-reduced-motion: reduce)`),t=matchMedia(`(forced-colors: active)`),n=new Map,r=document.createElement(`canvas`);r.width=r.height=1;let i=r.getContext(`2d`,{willReadFrequently:!0});function a(e,t){return i?(i.clearRect(0,0,1,1),i.fillStyle=e,i.fillRect(0,0,1,1),[...i.getImageData(0,0,1,1).data].slice(0,3).map(e=>e/255)):t}function o(e,t,n){let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(e.deleteShader(r),null)):null}function s(r){if(n.has(r))return;let i=r.querySelector(`.l`),s=i?.querySelector(`.ac`),c=i?.querySelector(`.fw`);if(!s||!c)return;let l=new AbortController,{signal:u}=l,d,f,p,m,h,g=0,_=0,v=0,y=!1,b=1,x=1,S=10,C,w,T=[],E=()=>r.isConnected&&r.matches(`:popover-open`),D=()=>{i.style.removeProperty(`translate`),i.style.removeProperty(`rotate`);for(let e of c.children)e.style.removeProperty(`transform`)},O=()=>{cancelAnimationFrame(g),g=0,v=0,i.dataset.clothMotion=`paused`},k=()=>{O(),D(),d&&!d.isContextLost()&&(p&&d.deleteBuffer(p),f&&d.deleteProgram(f)),f=p=null,delete i.dataset.clothRenderer},A=()=>{if(f)return!0;if(t.matches||(d=s.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!1,antialias:!1,powerPreference:`low-power`}),!d||d.isContextLost()))return!1;let e=o(d,d.VERTEX_SHADER,`#version 300 es
    in vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`),n=o(d,d.FRAGMENT_SHADER,`#version 300 es
    precision highp float;
    uniform vec2 u_resolution, u_size;
    uniform float u_time, u_shadow;
    uniform vec3 u_paper, u_ink;
    out vec4 outColor;

    float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
    float noise(float x) {
        float i = floor(x), f = fract(x);
        return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
    }
    float fray(float p, float seed) {
        return (noise(p * 0.09 + seed) - 0.5) * 3.5
             + (noise(p * 0.43 + seed) - 0.5) * 2.3
             + (noise(p * 1.7 + seed) - 0.5) * 0.9;
    }
    vec2 wave(vec2 p) {
        vec2 uv = p / u_size;
        float freeEdge = clamp(uv.y, 0.0, 1.0);
        return vec2(
            (1.8 + 4.4 * freeEdge) * sin(uv.y * 7.0 - u_time * 1.4)
                + 1.6 * sin(uv.y * 14.0 + u_time * 1.1),
            (1.0 + 1.4 * freeEdge) * sin(uv.x * 8.0 - u_time * 1.7 + uv.y * 3.0)
        );
    }
    float sheet(vec2 p) {
        p -= wave(p);
        // Independent, fixed noise along each edge reads as torn threads,
        // rather than an outline that boils or changes its tear every frame.
        vec4 edges = vec4(-p.x, p.x - u_size.x, -p.y, p.y - u_size.y);
        // Fraying only changes pixels close to an edge. Interior fragments
        // keep exactly the same fully opaque paper without evaluating all
        // twenty-four trigonometric hashes for an invisible torn outline.
        if (p.x < 8.0) edges.x += fray(p.y, 13.0);
        if (p.x > u_size.x - 8.0) edges.y += fray(p.y, 71.0);
        if (p.y < 8.0) edges.z += fray(p.x, 37.0);
        if (p.y > u_size.y - 8.0) edges.w += fray(p.x, 97.0);
        return max(max(edges.x, edges.y), max(edges.z, edges.w));
    }
    void main() {
        // All geometry is in CSS pixels, independent of canvas DPR.
        vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y)
               / u_resolution * (u_size + 48.0) - 24.0;
        vec2 shadowOffset = vec2(u_shadow + 2.4 * sin(u_time * 1.4),
                                 u_shadow + 2.0 * cos(u_time * 1.1));
        float d = sheet(p);
        // Deep inside the fabric the shifted shadow is also opaque and cannot
        // affect color/alpha. Keep its exact distance only near the torn edge.
        float sd = d < -u_shadow - 16.0 ? d : sheet(p - shadowOffset);
        float aa = max(fwidth(d), 0.55);
        float cloth = 1.0 - smoothstep(-aa, aa, d);
        float shadow = 1.0 - smoothstep(-aa, aa, sd);
        float interior = 1.0 - smoothstep(-3.4 - aa, -3.4 + aa, d);

        vec2 uv = (p - wave(p)) / u_size;
        float phase = uv.x * 11.0 + uv.y * 6.0 - u_time * 1.4;
        float crossFold = uv.x * 5.0 - uv.y * 9.0 + u_time * 1.1;
        vec3 normal = normalize(vec3(-0.20 * cos(phase) - 0.08 * cos(crossFold),
                                    -0.13 * cos(phase) + 0.12 * cos(crossFold), 1.0));
        float light = dot(normal, normalize(vec3(-0.5, -0.65, 1.0)));
        float fold = clamp((0.88 - light) * 0.28, 0.0, 0.10);
        // Faint woven fibers, kept well below the contrast of the copy.
        float weave = sin(p.x * 3.14159) * sin(p.y * 3.14159) * 0.006;
        vec3 fabric = mix(u_paper, u_ink, fold + 0.012 + weave);
        vec3 face = mix(u_ink, fabric, interior);
        float alpha = cloth + shadow * (1.0 - cloth);
        vec3 color = (face * cloth + u_ink * shadow * (1.0 - cloth)) / max(alpha, 0.001);
        outColor = vec4(color, alpha);
    }`);return!e||!n?(e&&d.deleteShader(e),n&&d.deleteShader(n),!1):(f=d.createProgram(),f?(d.attachShader(f,e),d.attachShader(f,n),d.linkProgram(f),d.deleteShader(e),d.deleteShader(n),!d.getProgramParameter(f,d.LINK_STATUS)||(p=d.createBuffer(),!p)?(k(),!1):(d.bindBuffer(d.ARRAY_BUFFER,p),d.bufferData(d.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),d.STATIC_DRAW),m=d.getAttribLocation(f,`a_position`),h=Object.fromEntries([`resolution`,`size`,`time`,`shadow`,`paper`,`ink`].map(e=>[e,d.getUniformLocation(f,`u_${e}`)])),!0)):(d.deleteShader(e),d.deleteShader(n),!1))},j=()=>{b=i.offsetWidth,x=i.offsetHeight,T=[...c.children].map(e=>({node:e,y:e.offsetTop+e.offsetHeight/2})),C=a(getComputedStyle(r.querySelector(`.A`)).backgroundColor,[.98,.98,.98]),w=a(getComputedStyle(i).color,[.03,.03,.03]),S=parseFloat(getComputedStyle(i).getPropertyValue(`--reveal-card-shadow`)),S=Number.isFinite(S)?S:Math.min(10,Math.max(6,innerWidth*.02));let e=Math.min(devicePixelRatio||1,1.5),t=Math.max(1,Math.round((b+48)*e)),n=Math.max(1,Math.round((x+48)*e));s.width!==t&&(s.width=t),s.height!==n&&(s.height=n)},M=()=>{if(!f||!b||!x||d.isContextLost())return;let t=e.matches?0:_;if(d.viewport(0,0,s.width,s.height),d.useProgram(f),d.uniform2f(h.resolution,s.width,s.height),d.uniform2f(h.size,b,x),d.uniform1f(h.time,t),d.uniform1f(h.shadow,S),d.uniform3f(h.paper,...C),d.uniform3f(h.ink,...w),d.bindBuffer(d.ARRAY_BUFFER,p),d.enableVertexAttribArray(m),d.vertexAttribPointer(m,2,d.FLOAT,!1,0,0),d.drawArrays(d.TRIANGLE_STRIP,0,4),i.dataset.clothRenderer!==`webgl`&&(i.dataset.clothRenderer=`webgl`),e.matches){D();return}i.style.translate=`${(Math.sin(t*.7)*1.5).toFixed(2)}px ${(Math.sin(t*.9)*1.2).toFixed(2)}px`,i.style.rotate=`${(Math.sin(t*.8)*.35).toFixed(3)}deg`;let n=c.scrollTop;for(let{node:e,y:r}of T){let i=Math.min(1,Math.max(0,(r-n)/x)),a=(1.8+4.4*i)*Math.sin(i*7-t*1.4)+1.6*Math.sin(i*14+t*1.1),o=(1+1.4*i)*Math.sin(4-t*1.7+i*3);e.style.transform=`translate(${a.toFixed(2)}px, ${o.toFixed(2)}px)`}},N=e=>{if(g=0,y||!E()||document.hidden||d?.isContextLost()){O();return}v&&(_+=Math.min(e-v,80)*.001),v=e,M(),g=requestAnimationFrame(N)},P=()=>{if(!(y||!E()||document.hidden)){if(t.matches){k();return}A()&&(j(),M(),i.dataset.clothMotion=e.matches?`still`:`running`,!e.matches&&!g&&(g=requestAnimationFrame(N)))}};r.addEventListener(`toggle`,e=>{e.newState===`open`?(_=0,P()):(O(),D())},{signal:u});let F=new ResizeObserver(()=>{E()&&f&&(j(),M())});F.observe(i),F.observe(c),window.addEventListener(`engmanager:themechange`,P,{signal:u}),window.addEventListener(`pageshow`,P,{signal:u}),window.addEventListener(`pagehide`,O,{signal:u}),document.addEventListener(`visibilitychange`,()=>{document.hidden?O():P()},{signal:u});for(let n of[e,t])n.addEventListener(`change`,()=>{O(),P()},{signal:u});s.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),k()},{signal:u}),s.addEventListener(`webglcontextrestored`,P,{signal:u}),n.set(r,()=>{y=!0,k(),F.disconnect(),l.abort()}),P()}let c=()=>{for(let e of n.values())e();n.clear()},l=()=>{for(let[e,t]of n)e.isConnected||(t(),n.delete(e));document.querySelectorAll(`#article-reveal`).forEach(s)};l(),window.__engNav?.onBeforeSwap?.(c),window.__engNav?.onSwap?.(l)})();