(function(){let e=16*1024*1024,t=6e5,n=1024,r=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];function i(e,t){if(!e)throw Error(`Journey GLB: ${t}`)}function a(e,t){return r.map((n,r)=>{let i=r%4,a=Math.floor(r/4);return e[i]*t[a*4]+e[i+4]*t[a*4+1]+e[i+8]*t[a*4+2]+e[i+12]*t[a*4+3]})}function o(e){let t=(e,t)=>Array.isArray(e)&&e.length===t&&e.every(Number.isFinite);if(e.matrix)return i(t(e.matrix,16)&&!e.translation&&!e.rotation&&!e.scale,`invalid matrix`),i(e.matrix[3]===0&&e.matrix[7]===0&&e.matrix[11]===0&&e.matrix[15]===1,`expected affine matrix`),e.matrix;let n=e.translation??[0,0,0],r=e.scale??[1,1,1],a=e.rotation??[0,0,0,1];i(t(n,3)&&t(r,3)&&t(a,4),`invalid transform`),i(Math.abs(Math.hypot(...a)-1)<.001,`invalid rotation`);let[o,s,c,l]=a;return[(1-2*(s*s+c*c))*r[0],2*(o*s+c*l)*r[0],2*(o*c-s*l)*r[0],0,2*(o*s-c*l)*r[1],(1-2*(o*o+c*c))*r[1],2*(s*c+o*l)*r[1],0,2*(o*c+s*l)*r[2],2*(s*c-o*l)*r[2],(1-2*(o*o+s*s))*r[2],0,...n,1]}function*s(n){i(n.byteLength>=28&&n.byteLength<=e,`invalid size`);let s=new DataView(n);i(s.getUint32(0,!0)===1179937895,`invalid signature`),i(s.getUint32(4,!0)===2,`unsupported version`),i(s.getUint32(8,!0)===n.byteLength,`truncated file`);let c,l;for(let e=12;e<n.byteLength;){i(e+8<=n.byteLength,`truncated chunk`);let t=s.getUint32(e,!0),r=s.getUint32(e+4,!0);e+=8,i(t%4==0&&e+t<=n.byteLength,`invalid chunk length`),r===1313821514?(i(!c,`duplicate JSON chunk`),c=JSON.parse(new TextDecoder().decode(new Uint8Array(n,e,t)))):r===5130562&&(i(!l,`duplicate binary chunk`),l=new DataView(n,e,t)),e+=t}i(c?.asset?.version===`2.0`&&l,`missing glTF data`),i(!c.extensionsRequired?.length,`required extensions are unsupported`),i(c.buffers?.length===1&&!c.buffers[0].uri,`expected embedded buffer`),i(Number.isInteger(c.buffers[0].byteLength)&&c.buffers[0].byteLength<=l.byteLength,`truncated binary buffer`);function*u(e,n,r=`float`){let a=c.accessors?.[e],o=c.bufferViews?.[a?.bufferView];i(a&&o&&o.buffer===0&&!a.sparse&&a.type===n,`unsupported accessor`);let s={5121:1,5123:2,5125:4,5126:4}[a.componentType],u=a.componentType===5126;i(s&&(r===`index`?!u&&!a.normalized:r===`color`?u||a.normalized&&s<4:u&&!a.normalized),`unsupported component type`);let d={SCALAR:1,VEC3:3,VEC4:4}[n],f=o.byteStride??s*d,p=a.byteOffset??0,m=(o.byteOffset??0)+p;i(Number.isInteger(a.count)&&a.count>0&&a.count<=(r===`index`?t*6:t),`invalid accessor count`);let h=m+(a.count-1)*f+s*d;i(Number.isInteger(m)&&Number.isInteger(p)&&p>=0&&m>=0&&Number.isInteger(f)&&f>=s*d&&f%s===0&&Number.isInteger(o.byteLength)&&h<=(o.byteOffset??0)+o.byteLength&&h<=c.buffers[0].byteLength,`accessor outside buffer`);let g=u&&f===s*d&&(l.byteOffset+m)%4==0,_=g?new Float32Array(l.buffer,l.byteOffset+m,a.count*d):r===`index`?new Uint32Array(a.count):new Float32Array(a.count*d);for(let e=0;e<a.count;e++){for(let t=0;t<d;t++){let n=m+e*f+t*s,r=g?_[e*d+t]:u?l.getFloat32(n,!0):s===1?l.getUint8(n):s===2?l.getUint16(n,!0):l.getUint32(n,!0);a.normalized&&(r/=s===1?255:65535),i(Number.isFinite(r),`non-finite vertex`),g||(_[e*d+t]=r)}(e&4095)==4095&&(yield)}return _}let d=[],f=new Set,p=0,m=0,h=[1/0,1/0,1/0],g=[-1/0,-1/0,-1/0];function*_(e,n){i(Number.isInteger(e)&&!f.has(e),`duplicate or cyclic node`),f.add(e);let r=c.nodes?.[e];i(r&&r.skin===void 0,`unsupported node`);let s=a(n,o(r)),l=[s[5]*s[10]-s[6]*s[9],s[6]*s[8]-s[4]*s[10],s[4]*s[9]-s[5]*s[8],s[9]*s[2]-s[10]*s[1],s[10]*s[0]-s[8]*s[2],s[8]*s[1]-s[9]*s[0],s[1]*s[6]-s[2]*s[5],s[2]*s[4]-s[0]*s[6],s[0]*s[5]-s[1]*s[4]],v=s[0]*l[0]+s[1]*l[1]+s[2]*l[2];if(i(Number.isFinite(v)&&Math.abs(v)>1e-10,`singular transform`),r.mesh!==void 0){let e=c.meshes?.[r.mesh];i(e?.primitives?.length,`missing mesh`);for(let n of e.primitives){i((n.mode??4)===4&&!n.extensions&&!n.targets,`expected uncompressed static triangles`);let e=yield*u(n.attributes?.POSITION,`VEC3`),r=yield*u(n.attributes?.NORMAL,`VEC3`),a=e.length/3,o=n.indices===void 0?new Uint32Array(a):yield*u(n.indices,`SCALAR`,`index`);i(r.length===e.length&&o.length%3==0,`invalid triangles`);for(let e=0;e<o.length;e++)n.indices===void 0&&(o[e]=e),i(o[e]<a,`invalid triangles`),(e&8191)==8191&&(yield);p+=a,m+=o.length,i(p<=t&&m<=t*6,`scene exceeds geometry limit`);let f=n.attributes?.COLOR_0,_=c.accessors?.[f]?.type;i(f===void 0||_===`VEC3`||_===`VEC4`,`invalid color accessor`);let y=f===void 0?null:yield*u(f,_,`color`),b=_===`VEC4`?4:3;i(!y||y.length===a*b,`invalid color count`);let x=c.materials?.[n.material],S=x?.pbrMetallicRoughness;i(!S?.baseColorTexture&&(!x?.alphaMode||x.alphaMode===`OPAQUE`),`expected opaque vertex-colored stone`);let C=S?.baseColorFactor??[.78,.75,.68,1];i(C.length===4&&C.every(e=>Number.isFinite(e)&&e>=0&&e<=1),`invalid material color`);let w=new Float32Array(a*9);for(let t=0;t<a;t++){let n=t*3,a=e[n],o=e[n+1],c=e[n+2],u=r[n],d=r[n+1],f=r[n+2];for(let e=0;e<3;e++){let n=s[e]*a+s[e+4]*o+s[e+8]*c+s[e+12];i(Number.isFinite(n),`invalid transformed position`),w[t*9+e]=n,h[e]=Math.min(h[e],n),g[e]=Math.max(g[e],n),w[t*9+3+e]=(l[e]*u+l[e+3]*d+l[e+6]*f)/v;let r=y?.[t*b+e]??1;i(r>=0&&r<=1,`invalid vertex color`),w[t*9+6+e]=C[e]*r}(t&4095)==4095&&(yield)}if(v<0)for(let e=0;e<o.length;e+=3){let t=o[e+1];o[e+1]=o[e+2],o[e+2]=t,e%8190==0&&(yield)}d.push({vertices:w,indices:o})}}for(let e of r.children??[])yield*_(e,s)}let v=c.scenes?.[c.scene??0]?.nodes;i(Array.isArray(v)&&v.length,`missing scene`);for(let e of v)yield*_(e,r);i(p>0,`empty scene`);let y=h.map((e,t)=>(e+g[t])/2),b=Math.max(...h.map((e,t)=>(g[t]-e)/2));i(Number.isFinite(b)&&b>0,`empty bounds`);let x=new Float32Array(p*9),S=new Uint32Array(m),C=0,w=0,T=0,E=0;for(let e of d){for(let t=0;t<e.vertices.length;t+=9){for(let n=0;n<3;n++)e.vertices[t+n]=(e.vertices[t+n]-y[n])/b;T=Math.max(T,e.vertices[t]**2+e.vertices[t+2]**2),E=Math.max(E,Math.abs(e.vertices[t+1])),(t/9&4095)==4095&&(yield)}x.set(e.vertices,C*9);for(let t of e.indices)S[w++]=t+C,(w&8191)==8191&&(yield);C+=e.vertices.length/9}return{vertices:x,indices:S,radius:Math.sqrt(T),height:E}}let c=typeof document<`u`?document.currentScript?.src:null,l=new Map,u=null,d=0,f=0;function p(e=new DOMException(`Poster decoding aborted`,`AbortError`)){clearTimeout(d),d=0,u?.terminate(),u=null;for(let t of l.values())t.finish(e);l.clear()}function m(){l.size||(clearTimeout(d),d=setTimeout(p,3e4))}async function h(e,t){let n=s(e);for(;;){if(t.aborted)throw new DOMException(`Poster decoding aborted`,`AbortError`);let e=n.next();if(e.done)return e.value;globalThis.scheduler?.yield?await globalThis.scheduler.yield():typeof setTimeout<`u`&&await new Promise(e=>setTimeout(e,0))}}async function g(t,n){if(n.aborted)throw new DOMException(`Poster decoding aborted`,`AbortError`);if(i(t.byteLength>=28&&t.byteLength<=e,`invalid size`),!c||typeof Worker>`u`)return h(t,n);if(l.size>=2)throw Error(`Poster decoder queue is full`);if(clearTimeout(d),d=0,!u){try{u=new Worker(c)}catch{return h(t,n)}let e=u;u.onmessage=({data:t})=>{if(u!==e)return;let n=l.get(t?.id);n&&(l.delete(t.id),n.finish(t.error?Error(t.error):null,t.model),m())},u.onerror=()=>{u===e&&p(Error(`Poster decoder worker failed`))},u.onmessageerror=()=>{u===e&&p(Error(`Poster decoder reply failed`))}}return new Promise((e,r)=>{let i=++f,a,o=()=>{l.delete(i),s(new DOMException(`Poster decoding aborted`,`AbortError`)),l.size||p()},s=(t,i)=>{clearTimeout(a),n.removeEventListener(`abort`,o),t?r(t):e(i)};l.set(i,{finish:s}),n.addEventListener(`abort`,o,{once:!0}),a=setTimeout(()=>p(Error(`Poster decoding timed out`)),8e3);try{u.postMessage({id:i,buffer:t},[t])}catch(e){p(e)}})}typeof window<`u`&&window.addEventListener?.(`pagehide`,()=>p());async function _(t,{url:r,reducedMotion:i=!1,onError:a,signal:o}={}){if(!navigator.gpu)throw Error(`WebGPU is unavailable`);let s=new AbortController,c=new Set,l,u,d,f,p,m,h,_,v,y=!1,b=!1,x=!0,S=!0,C=0,w=!0,T=!0,E=0,D=0,O=0,k,A,j,M=window.matchMedia?.(`(prefers-reduced-motion: reduce)`),N=()=>M?M.matches:i;function P(){if(!y){y=!0,s.abort(),o?.removeEventListener(`abort`,P),cancelAnimationFrame(C),_?.disconnect(),v?.disconnect(),document.removeEventListener(`visibilitychange`,R),M?.removeEventListener(`change`,R),A&&l?.removeEventListener(`uncapturederror`,A);for(let e of c)e.destroy();c.clear(),d?.destroy(),f?.destroy(),p?.destroy(),u?.unconfigure(),l?.destroy()}}function F(){if(k)throw k;if(y||o?.aborted)throw new DOMException(`Poster initialization aborted`,`AbortError`)}function I(e){y||(k=e,P(),b&&a?.(e))}function L(){!y&&j&&!C&&S&&x&&!document.hidden&&(C=requestAnimationFrame(j))}function R(){document.hidden||!S||!x?(cancelAnimationFrame(C),C=0):(T=!0,L())}o?.addEventListener(`abort`,P,{once:!0});try{F();let i=await navigator.gpu.requestAdapter({powerPreference:`low-power`});if(F(),!i)throw Error(`No WebGPU adapter is available`);let a=await i.requestDevice();if(y&&(a.destroy(),F()),l=a,l.lost.then(e=>I(Error(`Poster GPU lost: ${e.message}`))),A=e=>{e.preventDefault(),I(e.error)},l.addEventListener(`uncapturederror`,A),u=t.getContext(`webgpu`),!u)throw Error(`WebGPU canvas is unavailable`);let o=navigator.gpu.getPreferredCanvasFormat();u.configure({device:l,format:o,alphaMode:`premultiplied`});let k=await fetch(r,{signal:s.signal,credentials:`same-origin`,priority:`low`});if(!k.ok)throw Error(`Poster asset request failed (${k.status})`);if(Number(k.headers.get(`content-length`))>e)throw Error(`Poster asset exceeds size limit`);let V=await g(await k.arrayBuffer(),s.signal);F(),l.pushErrorScope(`validation`);let H=l.createShaderModule({label:`Carved marble poster`,code:`
        struct Scene {
            motion: vec4f,
            projection: vec4f,
            rotation: vec4f,
        };
        @group(0) @binding(0) var<uniform> scene: Scene;
        @group(0) @binding(1) var shadowMap: texture_depth_2d;
        @group(0) @binding(2) var shadowSampler: sampler_comparison;

        struct Vertex {
            @location(0) position: vec3f,
            @location(1) normal: vec3f,
            @location(2) color: vec3f,
        };
        struct Surface {
            @builtin(position) position: vec4f,
            @location(0) normal: vec3f,
            @location(1) local: vec3f,
            @location(2) color: vec3f,
            @location(3) light: vec3f,
        };

        fn rotate(p: vec3f) -> vec3f {
            // Four CPU-computed uniform values replace repeated sine/cosine
            // work in every surface, normal and self-shadow vertex invocation.
            let cy = scene.rotation.x;
            let sy = scene.rotation.y;
            let cx = scene.rotation.z;
            let sx = scene.rotation.w;
            let q = vec3f(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
            return vec3f(q.x, cx * q.y - sx * q.z, sx * q.y + cx * q.z);
        }
        fn lightPosition(p: vec3f) -> vec3f {
            let forward = normalize(vec3f(-0.65, 0.9, 1.1));
            let right = normalize(cross(vec3f(0.0, 1.0, 0.0), forward));
            let up = cross(forward, right);
            return vec3f(dot(p, right) * 0.58, dot(p, up) * 0.58,
                0.5 - dot(p, forward) * 0.23);
        }
        @vertex fn shadowVertex(input: Vertex) -> @builtin(position) vec4f {
            return vec4f(lightPosition(rotate(input.position)), 1.0);
        }
        @vertex fn vertex(input: Vertex) -> Surface {
            let p = rotate(input.position);
            var out: Surface;
            out.position = vec4f(p.xy * scene.projection.xy, 0.5 - p.z * 0.23, 1.0);
            out.normal = rotate(input.normal);
            out.local = input.position;
            out.color = input.color;
            out.light = lightPosition(p);
            return out;
        }
        fn hash(p: vec3f) -> f32 {
            var q = fract(p * 0.1031);
            q += dot(q, q.yzx + 33.33);
            return fract((q.x + q.y) * q.z);
        }
        fn noise(p: vec3f) -> f32 {
            let cell = floor(p);
            let f = fract(p);
            let s = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(cell), hash(cell + vec3f(1, 0, 0)), s.x),
                mix(hash(cell + vec3f(0, 1, 0)), hash(cell + vec3f(1, 1, 0)), s.x), s.y),
                mix(mix(hash(cell + vec3f(0, 0, 1)), hash(cell + vec3f(1, 0, 1)), s.x),
                mix(hash(cell + vec3f(0, 1, 1)), hash(cell + vec3f(1, 1, 1)), s.x), s.y), s.z);
        }
        @fragment fn fragment(input: Surface) -> @location(0) vec4f {
            let n = normalize(input.normal);
            let key = normalize(vec3f(-0.65, 0.9, 1.1));
            let p = input.local;
            // Object-space veins stay in the stone as it turns. Broad cloudy
            // calcite, sparse iron-grey seams, and fine pores avoid a plastic
            // uniform white surface without shipping a large bitmap texture.
            let cloud = noise(p * 2.9);
            let warp = cloud * 2.4 + noise(p * 7.5) * 0.6;
            let veinField = abs(sin(p.x * 6.2 + p.y * 3.3 + p.z * 2.8 + warp));
            let vein = 1.0 - smoothstep(0.018, 0.070, veinField);
            let fine = noise(p * 98.0);
            let stone = input.color * (0.91 + cloud * 0.105 + (fine - 0.5) * 0.036)
                * mix(vec3f(1.0), vec3f(0.70, 0.73, 0.74), vein * 0.45);
            let uv = input.light.xy * vec2f(0.5, -0.5) + 0.5;
            let bias = 0.0006 + (1.0 - max(dot(n, key), 0.0)) * 0.0012;
            var visibility = 0.0;
            for (var y = -1; y <= 1; y++) {
                for (var x = -1; x <= 1; x++) {
                    let offset = vec2f(f32(x), f32(y)) * (1.5 / 1024.0);
                    visibility += textureSampleCompare(shadowMap, shadowSampler,
                        uv + offset, input.light.z - bias);
                }
            }
            visibility /= 9.0;
            let diffuse = max(dot(n, key), 0.0) * visibility;
            let sky = 0.5 + 0.5 * n.y;
            let fill = max(dot(n, normalize(vec3f(0.85, 0.25, 0.55))), 0.0);
            let rim = pow(max(dot(n, normalize(vec3f(0.5, 0.35, -0.8))), 0.0), 2.0);
            let lighting = mix(vec3f(0.10, 0.105, 0.12), vec3f(0.27, 0.285, 0.31), sky)
                + diffuse * vec3f(0.92, 0.87, 0.76)
                + fill * vec3f(0.085, 0.105, 0.14)
                + rim * vec3f(0.15, 0.18, 0.23);
            let halfVector = normalize(key + vec3f(0.0, 0.0, 1.0));
            let sheen = pow(max(dot(n, halfVector), 0.0), 30.0) * 0.06 * visibility;
            let linear = stone * lighting + sheen;
            let srgb = mix(linear * 12.92,
                1.055 * pow(max(linear, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055,
                step(vec3f(0.0031308), linear));
            return vec4f(clamp(srgb, vec3f(0.0), vec3f(1.0)), 1.0);
        }
    `}),U=[{arrayStride:36,attributes:[0,1,2].map(e=>({shaderLocation:e,offset:e*12,format:`float32x3`}))}],[W,G]=await Promise.all([l.createRenderPipelineAsync({label:`Marble surface`,layout:`auto`,vertex:{module:H,entryPoint:`vertex`,buffers:U},fragment:{module:H,entryPoint:`fragment`,targets:[{format:o}]},primitive:{topology:`triangle-list`,cullMode:`back`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`},multisample:{count:4}}),l.createRenderPipelineAsync({label:`Marble self-shadow`,layout:`auto`,vertex:{module:H,entryPoint:`shadowVertex`,buffers:U},primitive:{topology:`triangle-list`,cullMode:`back`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`,depthBias:2,depthBiasSlopeScale:1.5}})]);F();function z(e,t){let n=l.createBuffer({size:Math.ceil(e.byteLength/4)*4,usage:t,mappedAtCreation:!0});return c.add(n),new Uint8Array(n.getMappedRange()).set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength)),n.unmap(),n}let K=z(V.vertices,GPUBufferUsage.VERTEX),q=z(V.indices,GPUBufferUsage.INDEX),J=V.indices.length;V.vertices=V.indices=null;let Y=new Float32Array(12),X=z(Y,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);p=l.createTexture({label:`Marble shadow`,size:[n,n],format:`depth24plus`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});let Z=p.createView(),Q={binding:0,resource:{buffer:X}},te=l.createBindGroup({layout:W.getBindGroupLayout(0),entries:[Q,{binding:1,resource:Z},{binding:2,resource:l.createSampler({compare:`less-equal`,magFilter:`linear`,minFilter:`linear`})}]}),ne=l.createBindGroup({layout:G.getBindGroupLayout(0),entries:[Q]}),$=await l.popErrorScope();if(F(),$)throw $;function ee(){w=!1;let e=t.clientWidth,n=t.clientHeight,r=e&&n?{width:e,height:n}:t.getBoundingClientRect(),i=window.innerWidth<=672&&window.matchMedia?.(`(pointer: coarse)`).matches,a=Math.min(window.devicePixelRatio||1,i?1.5:2,(i?800:1e3)/Math.max(r.width,r.height,1)),s=Math.max(1,Math.round(r.width*a)),c=Math.max(1,Math.round(r.height*a));s===D&&c===O||(D=t.width=s,O=t.height=c,d?.destroy(),f?.destroy(),d=l.createTexture({size:[s,c],sampleCount:4,format:o,usage:GPUTextureUsage.RENDER_ATTACHMENT}),f=l.createTexture({size:[s,c],sampleCount:4,format:`depth24plus`,usage:GPUTextureUsage.RENDER_ATTACHMENT}),m=d.createView(),h=f.createView())}function B(){if(y)return!1;try{w&&ee();let e=D/O,t=Math.min(.88/(V.height+V.radius*.09),.86*e/V.radius);Y[0]=-.3+(N()?0:E*1.05),Y[1]=-.08,Y[4]=t/e,Y[5]=t,Y[8]=Math.cos(Y[0]),Y[9]=Math.sin(Y[0]),Y[10]=Math.cos(Y[1]),Y[11]=Math.sin(Y[1]),l.queue.writeBuffer(X,0,Y);let n=l.createCommandEncoder({label:`Marble poster frame`}),r=n.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:Z,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});r.setPipeline(G),r.setBindGroup(0,ne),r.setVertexBuffer(0,K),r.setIndexBuffer(q,`uint32`),r.drawIndexed(J),r.end();let i=n.beginRenderPass({colorAttachments:[{view:m,resolveTarget:u.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`discard`}],depthStencilAttachment:{view:h,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});return i.setPipeline(W),i.setBindGroup(0,te),i.setVertexBuffer(0,K),i.setIndexBuffer(q,`uint32`),i.drawIndexed(J),i.end(),l.queue.submit([n.finish()]),T=!1,!0}catch(e){return I(e),!1}}j=()=>{C=0,!(y||!S||!x||document.hidden)&&T&&B()},B()||F(),await l.queue.onSubmittedWorkDone(),F(),b=!0,typeof IntersectionObserver<`u`&&(_=new IntersectionObserver(e=>{x=e.some(e=>e.isIntersecting),R()}),_.observe(t));let re=()=>{w=!0,T=!0,L()};return window.addEventListener?.(`resize`,re,{signal:s.signal}),typeof ResizeObserver<`u`&&(v=new ResizeObserver(re),v.observe(t)),document.addEventListener(`visibilitychange`,R),M?.addEventListener(`change`,R),L(),{setVisible(e){let t=!!e;S!==t&&(S=t,R())},setProgress(e){if(!Number.isFinite(e))return;let t=Math.min(1,Math.max(0,e));E!==t&&(E=t,N()||(T=!0,L()))},destroy:P}}catch(e){throw P(),e}}if(typeof document>`u`){globalThis.onmessage=({data:e})=>{if(!(!Number.isSafeInteger(e?.id)||e.id<1))try{let t=s(e.buffer),n;do n=t.next();while(!n.done);let r=n.value;globalThis.postMessage({id:e.id,model:r},[r.vertices.buffer,r.indices.buffer])}catch(t){globalThis.postMessage({id:e.id,error:t.message})}};return}window.__engJourneyPoster={mount:_}})();