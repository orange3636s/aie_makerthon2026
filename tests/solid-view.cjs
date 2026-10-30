const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T=require('three'),G=require('../web/solid-geometry.js'),V=require('../web/solid-view.js'),E=require('../web/extrusion.js');
const rect=(x0,z0,x1,z1,material=10)=>({material,closed:true,points:[[x0,z0],[x1,z0],[x1,z1],[x0,z1]]});
const data={polygons:[rect(-1,-.5,1,0),rect(-.2,0,.2,.4,13)]},b=[-1,1,-.5,.6];
assert.equal(V.section(data,b,'Y',0,.8).data,data);
assert.equal(V.section(data,b,'X',0,.8).data.polygons.length,2);
assert.equal(V.section(data,b,'X',.7,.8).data.polygons.length,1);
assert.equal(V.section(data,b,'Z',.2,.8).data.polygons.length,1);
assert.equal(V.section(data,b,'Z',.5,.8).data.polygons.length,0);
assert.deepEqual(V.section(data,b,'Z',.2,.8).labels,['X','Y']);
function volume(mesh){const a=mesh.geometry.attributes.position;let v=0;for(let i=0;i<a.count;i+=3){const p=new T.Vector3().fromBufferAttribute(a,i),q=new T.Vector3().fromBufferAttribute(a,i+1),r=new T.Vector3().fromBufferAttribute(a,i+2);v+=p.dot(q.cross(r))/6;}return Math.abs(v);}
const solid=G.build(T,data.polygons,.8,()=> '#8899aa');
assert(Math.abs(solid.children.reduce((s,m)=>s+volume(m),0)-.928)<1e-7,'closed extrusion volume includes both end caps and floor');
const ring=G.build(T,[rect(-1,-1,1,1),rect(-.5,-.5,.5,.5)],.8,()=> '#8899aa');
assert(Math.abs(volume(ring.children[0])-2.4)<1e-6,'real cavity remains a hole; do not fill physical air');
for(const mesh of solid.children){assert.equal(mesh.material.opacity,1);assert.equal(mesh.material.transparent,false);assert(mesh.material.depthWrite);}
const snapshot=JSON.stringify(data),originalBox=new T.Box3().setFromObject(solid).clone();
G.explode(solid,'layer',.12);
assert.equal(solid.children[0].position.z,0,'substrate remains anchored');
assert.equal(solid.children[1].position.z,.12,'upper layer separates');
assert.equal(JSON.stringify(data),snapshot,'view never changes simulation data');
G.explode(solid,'layer',0);
assert(new T.Box3().setFromObject(solid).equals(originalBox),'assembled view restores exact original bounds');
const pieces=G.parts([rect(-1,-1,1,1),rect(-.5,-.5,.5,.5),rect(-1,2,0,3,20),rect(0,2,1,3,20),rect(0,4,1,5,10)]);
assert.equal(pieces.length,4,'interior cavity moves with exterior, never as separate solid');
const byLayer=G.offsets(pieces,'layer',.1),byMaterial=G.offsets(pieces,'material',.1);
assert.equal(byLayer[2],byLayer[3],'same-height symmetric parts share a layer offset');
assert.equal(byMaterial[0],byMaterial[1],'same material at different heights moves together');
assert.notEqual(byLayer[0],byLayer[1],'disconnected layers of same material can separate');
let count=0;
for(const file of fs.readdirSync(path.join(__dirname,'../references')).filter(f=>f.endsWith('.json'))){
 const r=JSON.parse(fs.readFileSync(path.join(__dirname,'../references',file)));if(!r.frames||!r.bounds)continue;
 const polys=r.frames.at(-1).polygons.map(p=>({...p,points:E.clipPolygon(p.points,r.bounds)})).filter(p=>p.points.length>=3);
 const g=G.build(T,polys,.8,()=> '#8899aa');assert(g.children.length,file);
 const before=new T.Box3().setFromObject(g).clone();
 for(const mode of ['layer','material'])for(const gap of [.02,.12,.3]){G.explode(g,mode,gap);assert(g.children.every(m=>Number.isFinite(m.position.z)&&m.position.z>=0),file+' explosion position');}
 G.explode(g,'layer',0);assert(new T.Box3().setFromObject(g).equals(before),file+' exact restoration');
 for(const mesh of g.children){assert([...mesh.geometry.attributes.position.array].every(Number.isFinite),file);assert(volume(mesh)>1e-12,file+' missing caps or degenerate solid');mesh.geometry.dispose();mesh.material.dispose();}
 count++;
}
console.log('X/Y/Z slice locations, closed caps, opaque volume, preserved air cavities and '+count+' reference meshes passed');
