(function(){let e=Object.freeze({x:48,y:54}),t=8*1024*1024;function n(e,t){if(!e)throw Error(`Cursor GLB: ${t}`)}function r(e){n(e.byteLength>=28&&e.byteLength<=t,`invalid size`);let r=new DataView(e);n(r.getUint32(0,!0)===1179937895,`invalid signature`),n(r.getUint32(4,!0)===2,`unsupported version`),n(r.getUint32(8,!0)===e.byteLength,`truncated file`);let i,a;for(let t=12;t<e.byteLength;){n(t+8<=e.byteLength,`truncated chunk`);let o=r.getUint32(t,!0),s=r.getUint32(t+4,!0);t+=8,n(o%4==0&&t+o<=e.byteLength,`invalid chunk length`),s===1313821514?(n(!i,`duplicate JSON chunk`),i=JSON.parse(new TextDecoder().decode(new Uint8Array(e,t,o)))):s===5130562&&(n(!a,`duplicate binary chunk`),a=new DataView(e,t,o)),t+=o}n(i?.asset?.version===`2.0`&&a,`missing glTF data`),n(!i.extensionsRequired?.length,`extensions are unsupported`),n(i.buffers?.length===1&&!i.buffers[0].uri,`expected embedded buffer`),n(i.buffers[0].byteLength<=a.byteLength,`truncated binary buffer`);function o(e,t,r=!0){let o=i.accessors?.[e],s=i.bufferViews?.[o?.bufferView];n(o&&s&&s.buffer===0&&!o.sparse&&!o.normalized&&o.type===t,`unsupported accessor`);let c={5121:1,5123:2,5125:4,5126:4}[o.componentType];n(c&&(r?o.componentType===5126:o.componentType!==5126),`unsupported component type`);let l=t===`VEC3`?3:1,u=s.byteStride??c*l,d=(s.byteOffset??0)+(o.byteOffset??0),f=d+(o.count-1)*u+c*l;n(Number.isInteger(o.count)&&o.count>0&&o.count<=1e5,`invalid vertex count`),n(Number.isInteger(d)&&d>=0&&u>=c*l&&u%c===0&&f<=(s.byteOffset??0)+s.byteLength&&f<=i.buffers[0].byteLength,`accessor outside buffer`);let p=r?new Float32Array(o.count*l):new Uint32Array(o.count);for(let e=0;e<o.count;e++)for(let t=0;t<l;t++){let i=d+e*u+t*c,o=r?a.getFloat32(i,!0):c===1?a.getUint8(i):c===2?a.getUint16(i,!0):a.getUint32(i,!0);n(Number.isFinite(o),`non-finite vertex`),p[e*l+t]=o}return p}let s=[],c=new Set,l=i.scenes?.[i.scene??0]?.nodes;n(Array.isArray(l)&&l.length,`missing scene`);function u(e){n(!c.has(e),`duplicate or cyclic node`),c.add(e);let t=i.nodes?.[e];n(t&&t.skin===void 0,`unsupported node`);let r=(e,t)=>!e||e.length===t.length&&e.every((e,n)=>Math.abs(e-t[n])<1e-5);if(n(r(t.matrix,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])&&r(t.translation,[0,0,0])&&r(t.rotation,[0,0,0,1])&&r(t.scale,[1,1,1]),`transforms must be baked in Blender`),t.mesh!==void 0){let e=i.meshes?.[t.mesh];n(e?.primitives?.length,`missing mesh`);for(let t of e.primitives){n((t.mode??4)===4&&!t.extensions,`expected uncompressed triangles`);let e=o(t.attributes?.POSITION,`VEC3`),r=o(t.attributes?.NORMAL,`VEC3`),a=o(t.indices,`SCALAR`,!1);n(r.length===e.length&&a.length%3==0&&a.every(t=>t<e.length/3),`invalid triangle data`),n(!t.targets||t.targets.length<=1,`expected one Grip morph`);let c=t.targets?.[0],l=c?.POSITION===void 0?null:o(c.POSITION,`VEC3`),u=c?.NORMAL===void 0?null:o(c.NORMAL,`VEC3`);n((!l||l.length===e.length)&&(!u||u.length===r.length),`invalid morph data`);let d=new Float32Array(e.length*4);for(let t=0;t<e.length/3;t++)for(let n=0;n<3;n++)d[t*12+n]=e[t*3+n],d[t*12+3+n]=r[t*3+n],d[t*12+6+n]=l?.[t*3+n]??0,d[t*12+9+n]=u?.[t*3+n]??0;let f=(i.materials?.[t.material])?.pbrMetallicRoughness?.baseColorFactor??[.62,.59,.52,1];n(f.length===4&&f.every(e=>Number.isFinite(e)&&e>=0&&e<=1),`invalid material color`),s.push({vertices:d,indices:a,color:f})}}for(let e of t.children??[])u(e)}return l.forEach(u),n(s.length>0,`empty scene`),s}async function i(n,{pointerUrl:i,handUrl:a,signal:o,onFailure:s}={}){if(!navigator.gpu)throw Error(`WebGPU is unavailable`);let c=new AbortController,l=new Set,u,d,f,p,m=!1,h=0;function g(){if(!m){m=!0,o?.removeEventListener(`abort`,g),c.abort();for(let e of l)e.destroy();l.clear(),f?.destroy(),p?.destroy(),d?.unconfigure(),u?.destroy()}}function _(){if(m||o?.aborted)throw new DOMException(`Cursor initialization aborted`,`AbortError`)}function v(e){m||(g(),s?.(e))}o?.addEventListener(`abort`,g,{once:!0});try{_();let o=await navigator.gpu.requestAdapter({powerPreference:`low-power`});if(_(),!o)throw Error(`No WebGPU adapter is available`);let s=await o.requestDevice();if(m&&(s.destroy(),_()),u=s,u.lost.then(e=>v(Error(`Cursor GPU lost: ${e.message}`))),u.addEventListener(`uncapturederror`,e=>{e.preventDefault(),v(e.error)}),d=n.getContext(`webgpu`),!d)throw Error(`WebGPU canvas is unavailable`);let S=navigator.gpu.getPreferredCanvasFormat();d.configure({device:u,format:S,alphaMode:`premultiplied`});async function C(e){let n=await fetch(e,{signal:c.signal,credentials:`same-origin`});if(!n.ok)throw Error(`Cursor asset request failed (${n.status})`);if(Number(n.headers.get(`content-length`))>t)throw Error(`Cursor asset exceeds size limit`);let i=await n.arrayBuffer();return _(),r(i)}let w=await Promise.all([C(i),C(a)]);_(),u.pushErrorScope(`validation`);let T=u.createShaderModule({label:`Concrete cursor`,code:`
        struct Scene {
            motion: vec4f,
            projection: vec4f,
        };
        @group(0) @binding(0) var<uniform> scene: Scene;
        @group(1) @binding(0) var<uniform> baseColor: vec4f;

        struct Vertex {
            @location(0) position: vec3f,
            @location(1) normal: vec3f,
            @location(2) gripPosition: vec3f,
            @location(3) gripNormal: vec3f,
        };
        struct Surface {
            @builtin(position) position: vec4f,
            @location(0) normal: vec3f,
            @location(1) localPosition: vec3f,
        };

        fn turn(v: vec3f) -> vec3f {
            let cx = cos(scene.motion.x);
            let sx = sin(scene.motion.x);
            let cy = cos(scene.motion.y);
            let sy = sin(scene.motion.y);
            let p = vec3f(v.x, cx * v.y - sx * v.z, sx * v.y + cx * v.z);
            return vec3f(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
        }

        @vertex fn vertex(input: Vertex) -> Surface {
            let local = input.position + input.gripPosition * scene.motion.w;
            // Rotate and compress around the authored tip at (0, 0, 0).
            // The pixel hotspot stays fixed even when the body has momentum.
            let p = turn(local) * (1.0 - scene.motion.z * 0.065);
            var out: Surface;
            out.position = vec4f(
                p.xy * scene.projection.xy + scene.projection.zw,
                0.5 - p.z * 0.12,
                1.0
            );
            out.normal = turn(input.normal + input.gripNormal * scene.motion.w);
            out.localPosition = local;
            return out;
        }

        @fragment fn fragment(input: Surface) -> @location(0) vec4f {
            let n = normalize(input.normal);
            let key = normalize(vec3f(-0.55, 0.8, 1.0));
            let rim = normalize(vec3f(0.9, -0.2, 0.45));
            let diffuse = max(dot(n, key), 0.0);
            let edge = max(dot(n, rim), 0.0);
            let grain = fract(sin(dot(floor(input.localPosition * 150.0),
                vec3f(12.9898, 78.233, 37.719))) * 43758.5453);
            let concrete = baseColor.rgb * (0.975 + grain * 0.05);
            let light = vec3f(0.27, 0.285, 0.31)
                + diffuse * vec3f(0.79, 0.745, 0.65)
                + edge * vec3f(0.13, 0.16, 0.2);
            let specular = pow(max(dot(n, normalize(key + vec3f(0.0, 0.0, 1.0))), 0.0), 28.0) * 0.055;
            let linear = concrete * light + specular;
            let srgb = mix(linear * 12.92,
                1.055 * pow(max(linear, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055,
                step(vec3f(0.0031308), linear));
            return vec4f(clamp(srgb, vec3f(0.0), vec3f(1.0)), 1.0);
        }
    `}),E=await u.createRenderPipelineAsync({label:`Concrete cursor`,layout:`auto`,vertex:{module:T,entryPoint:`vertex`,buffers:[{arrayStride:48,attributes:[0,1,2,3].map(e=>({shaderLocation:e,offset:e*12,format:`float32x3`}))}]},fragment:{module:T,entryPoint:`fragment`,targets:[{format:S}]},primitive:{topology:`triangle-list`,cullMode:`back`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`},multisample:{count:4}});_();function y(e,t){let n=u.createBuffer({size:Math.ceil(e.byteLength/4)*4,usage:t,mappedAtCreation:!0});return l.add(n),new Uint8Array(n.getMappedRange()).set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength)),n.unmap(),n}let D=new Float32Array(8);D.set([104/192,104/192,2*e.x/192-1,1-2*e.y/192],4);let O=y(D,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),k=u.createBindGroup({layout:E.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}}]}),A=w.map(e=>e.map(e=>({vertices:y(e.vertices,GPUBufferUsage.VERTEX),indices:y(e.indices,GPUBufferUsage.INDEX),count:e.indices.length,material:u.createBindGroup({layout:E.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:y(new Float32Array(e.color),GPUBufferUsage.UNIFORM)}}]})}))),j=await u.popErrorScope();if(_(),j)throw j;function b(){let e=Math.round(192*Math.min(window.devicePixelRatio||1,2));h!==e&&(h=e,n.width=e,n.height=e,f?.destroy(),p?.destroy(),f=u.createTexture({size:[e,e],sampleCount:4,format:S,usage:GPUTextureUsage.RENDER_ATTACHMENT}),p=u.createTexture({size:[e,e],sampleCount:4,format:`depth24plus`,usage:GPUTextureUsage.RENDER_ATTACHMENT}))}let M=(e,t,n)=>Number.isFinite(e)?Math.max(t,Math.min(n,e)):0;function x({mode:e=`arrow`,tiltX:t=0,tiltY:n=0,press:r=0,grip:i=0}={}){if(m)return!1;try{b(),D[0]=.16+M(t,-.35,.35),D[1]=-.26+M(n,-.35,.35),D[2]=M(r,0,1),D[3]=M(i,0,1),u.queue.writeBuffer(O,0,D);let a=u.createCommandEncoder({label:`Cursor frame`}),o=a.beginRenderPass({colorAttachments:[{view:f.createView(),resolveTarget:d.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`discard`}],depthStencilAttachment:{view:p.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});o.setPipeline(E),o.setBindGroup(0,k);for(let t of A[e===`arrow`?0:1])o.setBindGroup(1,t.material),o.setVertexBuffer(0,t.vertices),o.setIndexBuffer(t.indices,`uint32`),o.drawIndexed(t.count);return o.end(),u.queue.submit([a.finish()]),!0}catch(e){return v(e),!1}}return{render:x,dispose:g,size:192,hotspot:e}}catch(e){throw g(),e}}window.__engCursorRenderer={create:i}})();