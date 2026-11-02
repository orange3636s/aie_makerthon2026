'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('three');
const G=require('../web/solid-geometry.js'),V=require('../web/solid-view.js'),E=require('../web/extrusion.js'),Fit=require('../web/viewport.js');
let frames=0,meshes=0,slices=0;const errors=[];
for(const {id} of require('../reverse-catalog.json').targets){
 const r=JSON.parse(fs.readFileSync('references/'+id+'.json'));
 for(const [index,f] of r.frames.entries())try{
  const bounds=Fit.fit(f,r.bounds),polys=f.polygons.map(p=>({...p,points:E.clipPolygon(p.points,bounds)})).filter(p=>p.points.length>=3);
  const g=G.build(T,polys,.8,()=> '#8899aa');assert(g.children.length,'empty 3D');
  for(const mesh of g.children){
   const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;assert([...p.array,...n.array].every(Number.isFinite),'nonfinite mesh');
   let volume=0;for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);volume+=a.dot(b.cross(c))/6;}
   assert(Math.abs(volume)>1e-12,'degenerate or uncapped solid');meshes++;
  }
  const before=new T.Box3().setFromObject(g).clone();
  for(const mode of ['layer','material']){
   const plan=G.explode(g,mode,.25,id);
   assert(g.children.every(m=>Number.isFinite(m.position.z)&&m.position.z>=0));
   assert.equal(new Set(plan.shifts).size,plan.labels.length,'one separation per named group');
   if(mode==='material')assert(plan.labels.length<=new Set(polys.map(p=>p.material)).size);
  }
  G.explode(g,'layer',0);assert(new T.Box3().setFromObject(g).equals(before),'explosion failed to restore');
  g.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
  for(const axis of ['X','Y','Z'])for(const t of [.1,.5,.9]){const at=axis==='X'?bounds[0]+t*(bounds[1]-bounds[0]):axis==='Z'?bounds[2]+t*(bounds[3]-bounds[2]):(t-.5)*.8;const section=V.section(f,bounds,axis,at,.8);assert(section.data.polygons.every(p=>p.points.every(v=>v.every(Number.isFinite))),'invalid section');slices++;}
  frames++;
 }catch(e){errors.push(id+' STEP '+index+': '+e.message);}
 console.log(id+': '+r.frames.length+' stages inspected');
}
assert.deepEqual(errors,[]);console.log(JSON.stringify({examples:24,frames,meshes,slices,errors}));
