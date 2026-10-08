(()=>{let e=[`auteurs`,`autonomous-av-studio`,`big-personality`,`claude-code-lsp`,`jsx-like-rust-macro`,`mcp-blender-library-3d-print`,`project-foottraffic`,`talking-not-typing`,`the-casino-hypothesis`,`the-execution-marketplace`,`vibe-coding-a-shop`,`your-gmail-avatar-is-part-of-your-job-search`],t=new Map,n=matchMedia(`(prefers-reduced-motion: reduce)`),r=document.createElement(`canvas`);r.width=r.height=1;let i=r.getContext(`2d`,{willReadFrequently:!0});function a(e,t){if(!i)return[.5,.5,.5];let n=getComputedStyle(document.documentElement),r=getComputedStyle(document.body),a=e.map(e=>n.getPropertyValue(e).trim()||r.getPropertyValue(e).trim()).find(Boolean);i.fillStyle=t;try{a&&(i.fillStyle=a)}catch{}return i.fillRect(0,0,1,1),[...i.getImageData(0,0,1,1).data].slice(0,3).map(e=>e/255)}let o=()=>({paper:a([`--ctp-mantle`,`--paper`],`#f5f2eb`),ink:a([`--ctp-text`,`--ink`],`#30263a`),accent:a([`--accent`,`--plum`],`#795477`),secondary:a([`--ctp-blue`,`--ink-soft`],`#6480a2`),tertiary:a([`--ctp-pink`,`--plum`],`#b56b93`)}),s=[.12,.19,.14,.27,.17,.23,.09,.18,.13];function c(e){let t=1.2*Math.sin(e*32e-5),n=e=>s[e]||0,r=0,i=0,a=0;for(let e=0;e<s.length;e++){let o=e+t,s=Math.floor(o),c=o-s,l=n(s)*(1-c)+n(s+1)*c,u=n(e);r+=u*l,i+=u*u,a+=l*l}return r/Math.sqrt(Math.max(i*a,1e-4))}function l(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}function u(r){if(t.has(r))return;let i=r.querySelector(`.article-hero-canvas`),a=e.indexOf(r.dataset.articleHero);if(a<0||!i)return;let s=new AbortController,d=s.signal,f,p,m,h,g,_=0,v=0,y=!1,b=!1,x=!1,S=!1,C=0,w=!1,T=o(),E=!0,D={width:r.clientWidth,height:r.clientHeight},O=[.5,.5],k=()=>w||document.hidden||window.__engNav?.busy||document.body.classList.contains(`m`),A=()=>{cancelAnimationFrame(_),_=0};function j(){let e=matchMedia(`(pointer: coarse)`).matches&&innerWidth<=672,t=Math.min(devicePixelRatio||1,e?1:1.5),n=Math.min(1,(e?640:960)/Math.max(D.width*t,D.height*t,1)),r=Math.max(1,Math.round(D.width*t*n)),a=Math.max(1,Math.round(D.height*t*n));(i.width!==r||i.height!==a)&&(i.width=r,i.height=a,f.viewport(0,0,r,a),f.uniform2f(h.resolution,r,a))}function M(e){if(!x||b||!r.isConnected||f.isContextLost())return;if(j(),E){for(let e of[`paper`,`ink`,`accent`,`secondary`,`tertiary`])f.uniform3f(h[e],...T[e]);E=!1}let t=n.matches?0:e;f.uniform2f(h.pointer,...O),f.uniform1f(h.time,t*.001),a===11&&f.uniform1f(h.identity_strength,c(t)),f.drawArrays(f.TRIANGLE_STRIP,0,4),r.dataset.renderer!==`webgl`&&(r.dataset.renderer=`webgl`)}function N(e){_=0,!(b||!y||k())&&(M(e),n.matches||(_=requestAnimationFrame(N)))}function P(){if(v=0,b||!r.isConnected||k()||!y)return;if(!f.getProgramParameter(p,g.COMPLETION_STATUS_KHR)){performance.now()-C<8e3&&(v=setTimeout(P,32));return}if(!f.getProgramParameter(p,f.LINK_STATUS)){console.warn(`Article hero program:`,f.getProgramInfoLog(p));return}m=f.createBuffer(),f.bindBuffer(f.ARRAY_BUFFER,m),f.bufferData(f.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),f.STATIC_DRAW),f.useProgram(p);let e=f.getAttribLocation(p,`a_position`);f.enableVertexAttribArray(e),f.vertexAttribPointer(e,2,f.FLOAT,!1,0,0),h=Object.fromEntries([`resolution`,`pointer`,`time`,`identity_strength`,`paper`,`ink`,`accent`,`secondary`,`tertiary`].map(e=>[e,f.getUniformLocation(p,`u_${e}`)])),f.viewport(0,0,i.width,i.height),f.uniform2f(h.resolution,i.width,i.height),x=!0,I()}function F(){if(S=!0,f=i.getContext(`webgl2`,{alpha:!1,antialias:!1,powerPreference:`low-power`}),!f||(g=f.getExtension(`KHR_parallel_shader_compile`),!g))return;let e=l(f,f.VERTEX_SHADER,`#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`),t=l(f,f.FRAGMENT_SHADER,`#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;
uniform int u_scene;
uniform float u_identity_strength;
uniform vec3 u_paper, u_ink, u_accent, u_secondary, u_tertiary;
out vec4 outColor;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float valueNoise(vec2 p) {
vec2 i = floor(p), f = fract(p);
f = f * f * (3.0 - 2.0 * f);
return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float box(vec2 p, vec2 b) {
vec2 d = abs(p) - b;
return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float segment(vec2 p, vec2 a, vec2 b) {
vec2 v = b - a;
return length(p - (a + v * clamp(dot(p - a, v) / dot(v, v), 0.0, 1.0)));
}
float stroke(float d, float w) { return 1.0 - smoothstep(w, w + 0.003, abs(d)); }
float fill(float d) { return 1.0 - smoothstep(-0.003, 0.003, d); }
float ring(vec2 p, float r, float w) { return stroke(length(p) - r, w); }
vec2 graphNode(int i) {
if (i == 0) return vec2(-0.46, 0.0);
if (i == 1) return vec2(-0.16, 0.26);
if (i == 2) return vec2(-0.12, -0.25);
if (i == 3) return vec2(0.18, 0.3);
if (i == 4) return vec2(0.19, -0.16);
return vec2(0.48, 0.04);
}
int graphDepth(int i) {
if (i == 0) return 0;
if (i < 3) return 1;
if (i < 5) return 2;
return 3;
}
float identitySample(int i) {
if (i < 0 || i > 8) return 0.0;
if (i == 0) return 0.12;
if (i == 1) return 0.19;
if (i == 2) return 0.14;
if (i == 3) return 0.27;
if (i == 4) return 0.17;
if (i == 5) return 0.23;
if (i == 6) return 0.09;
if (i == 7) return 0.18;
return 0.13;
}
float identityMark(vec2 p) {
float distanceToMark = 10.0;
for (int i = 0; i < 9; i++) {
vec2 center = vec2((float(i) - 4.0) * 0.065, 0.0);
distanceToMark = min(distanceToMark, box(p - center, vec2(0.018, identitySample(i))));
}
return distanceToMark;
}
void main() {
float aspect = u_resolution.x / u_resolution.y;
vec2 p = (gl_FragCoord.xy / u_resolution.xy - 0.5) * vec2(aspect, 1.0);
p += (u_pointer - 0.5) * 0.018;
float t = u_time, a = 0.0, b = 0.0, c = 0.0;
vec3 color = mix(u_paper, u_ink, 0.055 + 0.035 * p.y);
float paperGrid = stroke(fract(p.x * 17.0) - 0.5, 0.006) *
stroke(fract(p.y * 17.0) - 0.5, 0.006);
color = mix(color, u_ink, paperGrid * 0.065);

if (u_scene == 0) {


float d = length(p);
float mask = 1.0 - smoothstep(0.355, 0.366, d);
float theta = atan(p.y, p.x) + t * 0.085;
float w = 0.5 + 0.25 * sin(theta * 2.0) + 0.25 * valueNoise(p * 4.0 + t * 0.12);
vec3 spectrum = mix(u_accent, u_secondary, smoothstep(0.12, 0.83, w));
spectrum = mix(spectrum, u_tertiary, smoothstep(0.55, 1.0, w) * 0.44);
color = mix(color, spectrum, mask * 0.94);
a = ring(p, 0.37, 0.0015) * 0.55;
} else if (u_scene == 1) {


for (int i = 0; i < 8; i++) {
float x = (float(i % 4) - 1.5) * 0.205;
float y = (i < 4 ? 0.16 : -0.16);
vec2 q = p - vec2(x, y);
float frame = box(q, vec2(0.077, 0.125));
b += stroke(frame, 0.002);
float phase = fract(t * 0.11) * 8.0;
float scheduled = 1.0 - smoothstep(0.0, 0.65, abs(phase - float(i)));
a += fill(frame + 0.014) * (0.18 + 0.62 * scheduled);
c += stroke(segment(q, vec2(-0.055, -0.085), vec2(0.055, 0.085)), 0.001) * 0.25;
}
c += stroke(p.y, 0.003) * step(abs(p.x), 0.45);
} else if (u_scene == 2) {


float near1 = 10.0, near2 = 10.0;
for (int i = 0; i < 7; i++) {
float angle = float(i) * 6.2831853 / 7.0 + t * 0.035;
vec2 seed = vec2(cos(angle) * 0.25, sin(angle) * 0.21);
float d = length(p - seed);
if (d < near1) { near2 = near1; near1 = d; }
else if (d < near2) near2 = d;
b += ring(p - seed, 0.016, 0.002);
}
float field = length(p / vec2(1.35, 1.0));
a = stroke(near2 - near1, 0.004) * (1.0 - smoothstep(0.30, 0.39, field));
c = ring(p, 0.34, 0.001) + ring(p, 0.26, 0.001) * 0.35;
} else if (u_scene == 3) {


float wave = fract(t * 0.115) * 4.0;
for (int i = 0; i < 6; i++) {
vec2 n = graphNode(i);
int next = i == 0 ? 1 : i == 1 ? 3 : i == 2 ? 4 : 5;
if (i < 5) b += stroke(segment(p, n, graphNode(next)), 0.0015) * 0.65;
float frontier = 1.0 - smoothstep(0.0, 0.6, abs(wave - float(graphDepth(i))));
a += ring(p - n, 0.025 + 0.006 * frontier, 0.004) * (0.45 + frontier);
c += fill(length(p - n) - 0.006) * (0.25 + frontier);
}
} else if (u_scene == 4) {


for (int i = 0; i < 5; i++) {
float f = float(i), open = fract(t * 0.19 + f * 0.18);
vec2 size = vec2(0.105 + f * 0.092, 0.105 + f * 0.057);
float contour = box(p, size);
a += stroke(contour, 0.002) * (0.25 + open * 0.16);
b += stroke(segment(p, vec2(-size.x, -size.y), vec2(-size.x, size.y)), 0.004);
b += stroke(segment(p, vec2(size.x, -size.y), vec2(size.x, size.y)), 0.004);
}
c = fill(box(p, vec2(0.03, 0.03))) * 0.8;
} else if (u_scene == 5) {


float head = length(p - vec2(-0.015, 0.15)) - 0.087;
float body = box(p - vec2(-0.015, -0.02), vec2(0.115, 0.13));
float legs = min(box(p - vec2(-0.072, -0.185), vec2(0.048, 0.07)),
box(p - vec2(0.043, -0.185), vec2(0.048, 0.07)));
float hammer = min(box(p - vec2(0.23, 0.14), vec2(0.09, 0.05)),
box(p - vec2(0.23, -0.04), vec2(0.013, 0.18)));
float shape = min(min(head, body), min(legs, hammer));
float base = box(p - vec2(0.02, -0.29), vec2(0.28, 0.028));
shape = min(shape, base);
float layer = fract((p.y + 0.5) * 41.0);
a = fill(shape) * (0.32 + 0.5 * smoothstep(0.0, 0.10, layer));
b = stroke(shape, 0.002);
c = fill(shape) * (1.0 - smoothstep(0.08, 0.13, layer)) * 0.5;
} else if (u_scene == 6) {


float growth = 1.0 + fract(t * 0.055) * 4.0;
for (int y = -2; y <= 2; y++) for (int x = -4; x <= 4; x++) {
vec2 q = p - vec2(float(x) * 0.14, float(y) * 0.145);
float block = box(q, vec2(0.053, 0.052));
float distanceFromSeed = float(abs(x) + abs(y));
float reached = 1.0 - smoothstep(growth - 0.35, growth + 0.25, distanceFromSeed);
b += stroke(block, 0.0015) * 0.47;
a += fill(block + 0.013) * reached * 0.58;
}
c = ring(p, 0.042, 0.004);
} else if (u_scene == 7) {


float amplitude = 0.08 * sin(p.x * 35.0 - t * 2.0)
+ 0.035 * sin(p.x * 79.0 + t * 1.3);
float taper = 1.0 - smoothstep(-0.18, 0.18, p.x);
a = stroke(p.y - amplitude * taper, 0.003) * step(p.x, 0.1);
for (int i = 0; i < 5; i++) {
float x = 0.13 + float(i % 3) * 0.115;
float y = (float(i / 3) - 0.5) * 0.18;
b += stroke(box(p - vec2(x, y), vec2(0.048, 0.055)), 0.002);
c += fill(box(p - vec2(x, y), vec2(0.038, 0.044))) * 0.30;
}
} else if (u_scene == 8) {


b = stroke(box(p, vec2(0.38, 0.32)), 0.003);
for (int i = 0; i < 3; i++) {
vec2 q = p - vec2((float(i) - 1.0) * 0.235, 0.0);
float angle = atan(q.y, q.x);
float stepIndex = floor(t * 0.34);
float state = mod(stepIndex + float(i == 2 ? 1 : 0), 5.0) / 5.0;
float gap = 1.0 - smoothstep(0.13, 0.17, abs(atan(sin(angle - state * 6.283), cos(angle - state * 6.283))));
a += ring(q, 0.09, 0.008) * gap;
c += ring(q, 0.11, 0.0015) * 0.5;
}
} else if (u_scene == 9) {


vec2 hub = vec2(0.0, 0.0);
float minimum = 10.0;
for (int i = 0; i < 3; i++) {
float cost = float(i) * 0.24 + 0.18 * sin(t * 0.4 + float(i) * 2.0);
minimum = min(minimum, cost);
}
for (int i = 0; i < 3; i++) {
float angle = float(i) * 2.094395 + 1.570796;
vec2 source = vec2(cos(angle) * 0.38, sin(angle) * 0.29);
float cost = float(i) * 0.24 + 0.18 * sin(t * 0.4 + float(i) * 2.0);
float winner = 1.0 - step(0.001, cost - minimum);
b += stroke(segment(p, source, hub), 0.003) * (0.45 + winner * 0.65);
vec2 packet = mix(source, hub, fract(t * (0.11 + winner * 0.08) + float(i) * 0.29));
a += fill(length(p - packet) - 0.012) * (0.5 + winner * 0.5);
c += ring(p - source, 0.036, 0.002);
}
a += stroke(box(p, vec2(0.078, 0.085)), 0.004);
} else if (u_scene == 10) {


for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
vec2 center = vec2(float(x) * 0.145 - 0.18, float(y) * 0.145);
float card = box(p - center, vec2(0.06, 0.06));
b += stroke(card, 0.002) * 0.65;
c += fill(card + 0.012) * 0.14;
}
float progress = 0.5 + 0.5 * sin(t * 0.6);
vec2 center = mix(vec2(-0.18, 0.0), vec2(0.245, 0.0), progress);
vec2 size = mix(vec2(0.061), vec2(0.17, 0.205), progress);
a += stroke(box(p - center, size), 0.005);
a += fill(box(p - center, size - 0.012)) * 0.19;
b += stroke(segment(p, vec2(-0.10, 0.12), center + vec2(-size.x, size.y)), 0.001) * progress;
} else if (u_scene == 11) {



float angle = 0.43;
vec2 q = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
float lag = 1.2 * sin(t * 0.32);
float matchStrength = u_identity_strength;
vec2 offset = vec2(lag * 0.065, 0.042 * sin(t * 0.32));
float reference = identityMark(q);
float firstImpression = identityMark(q - offset);
float nextImpression = identityMark(q + offset);
a = fill(firstImpression) * (0.32 + 0.30 * matchStrength);
b = fill(nextImpression) * (0.30 + 0.26 * matchStrength);
c = fill(reference) * (0.12 + 0.70 * pow(matchStrength, 9.0));

for (int x = -1; x <= 1; x += 2) for (int y = -1; y <= 1; y += 2) {
vec2 corner = vec2(float(x) * 0.49, float(y) * 0.34);
c += stroke(segment(p, corner - vec2(0.026, 0.0), corner + vec2(0.026, 0.0)), 0.0015) * 0.45;
c += stroke(segment(p, corner - vec2(0.0, 0.026), corner + vec2(0.0, 0.026)), 0.0015) * 0.45;
}
}

color = mix(color, u_secondary, clamp(b * 0.65, 0.0, 1.0));
color = mix(color, u_accent, clamp(a * 0.9, 0.0, 1.0));
color = mix(color, u_ink, clamp(c * 0.65, 0.0, 1.0));



if (u_scene == 2 || u_scene == 5 || u_scene == 6) {
float dot = length(fract(gl_FragCoord.xy / 5.0) - 0.5);
color = mix(color, u_accent, (1.0 - smoothstep(0.28, 0.34, dot)) * a * 0.22);
}
if (u_scene == 3 || u_scene == 4 || u_scene == 7) {
float threshold = hash21(floor(gl_FragCoord.xy / 4.0));
color = mix(color, u_secondary, step(threshold, clamp(b, 0.0, 1.0)) * 0.12);
}
if (u_scene == 1 || u_scene == 8) {
color *= 0.97 + 0.03 * sin(gl_FragCoord.y * 1.2);
}
if (u_scene == 11) {

float hatch = stroke(fract((p.x + p.y) * 92.0) - 0.5, 0.06);
color = mix(color, u_paper, hatch * clamp(a + b, 0.0, 1.0) * 0.20);
}
color += (valueNoise(gl_FragCoord.xy * 0.35 + t * 0.3) - 0.5) * 0.018;
outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`.replace(`uniform int u_scene;`,`const int u_scene = ${a};`));p=f.createProgram(),f.attachShader(p,e),f.attachShader(p,t),f.linkProgram(p),f.deleteShader(e),f.deleteShader(t),C=performance.now(),P()}function I(){if(!(b||!y||k())){if(!S){F();return}if(!x){!v&&p&&P();return}n.matches?M(0):_||=requestAnimationFrame(N)}}let L=new IntersectionObserver(([e])=>{y=e.isIntersecting,y?I():(A(),clearTimeout(v),v=0)});L.observe(r);let R=new ResizeObserver(([e])=>{D={width:e.contentRect.width,height:e.contentRect.height},y&&n.matches&&!k()&&I()});R.observe(r),r.addEventListener(`pointermove`,e=>{let t=r.getBoundingClientRect();O[0]=(e.clientX-t.left)/t.width,O[1]=1-(e.clientY-t.top)/t.height},{passive:!0,signal:d}),window.addEventListener(`engmanager:themechange`,()=>{T=o(),E=!0,y&&n.matches&&!k()&&I()},{signal:d}),window.addEventListener(`pageshow`,I,{signal:d}),window.addEventListener(`eng:journeysettled`,I,{signal:d}),window.addEventListener(`eng:journeyexposure`,e=>{e.detail?.active?(A(),clearTimeout(v),v=0):I()},{signal:d}),document.addEventListener(`visibilitychange`,()=>{document.hidden?(A(),clearTimeout(v),v=0):I()},{signal:d}),n.addEventListener(`change`,()=>{A(),I()},{signal:d}),i.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),w=!0,A(),clearTimeout(v),v=0,delete r.dataset.renderer},{signal:d}),i.addEventListener(`webglcontextrestored`,()=>{let e=t.get(r);e&&(e(),t.delete(r)),u(r)},{signal:d}),t.set(r,()=>{b=!0,A(),clearTimeout(v),L.disconnect(),R.disconnect(),s.abort(),m&&f.deleteBuffer(m),p&&f.deleteProgram(p),delete r.dataset.renderer})}function d(){for(let e of t.values())e();t.clear()}function f(e=document){for(let[e,n]of t)e.isConnected||(n(),t.delete(e));e.querySelectorAll(`[data-article-hero]`).forEach(u)}f(),window.__engNav?.onBeforeSwap?.(d),window.__engNav?.onSwap?.(f)})();