// Frozen pre-optimization geometry: positions, normals, UVs, barycentrics and material kind.
export function referenceArmillaryMesh() {
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
    return mesh();
}
