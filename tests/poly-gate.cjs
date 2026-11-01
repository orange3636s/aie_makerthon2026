'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../web/poly-gate-doping.js'),B=require('../wafer-background.cjs'),M=require('../web/learning-lab-models.js'),D=require('../web/dopant-view.js');
const ids=['mosfet','fdsoi','pdsoi','rcat','charge-trap'];
const rows=[];
for(const id of ids){
 const raw=JSON.parse(fs.readFileSync('references/'+id+'.json'));
 const variants=[{type:'n',concentration:1e20},{type:'n',concentration:1e18},{type:'p',concentration:1e20},{type:'p',concentration:1e18}];
 const results=variants.map(g=>B.apply(raw,undefined,id,'gate',g));
 const curves=results.map(r=>M.deviceIV(r.frames.at(-1),id));
 curves.forEach(r=>{assert(r.available,id+': '+r.reason);assert(r.points.every(p=>p.every(Number.isFinite)));assert(r.points.some(p=>p[1]>0));});
 const threshold=r=>r.threshold??r.branches[0].threshold;
 for(let i=1;i<curves.length;i++){
  assert.notEqual(threshold(curves[0]),threshold(curves[i]),id+' gate changes Vth');
  // Compare at the SAME voltage, not each curve's possibly expanded last point.
  const at=(r,v)=>{const a=r.points.findIndex(p=>p[0]>=v);const p=r.points[Math.max(0,a-1)],q=r.points[a];return p[1]+(q[1]-p[1])*(v-p[0])/(q[0]-p[0]||1)};
  assert.notEqual(at(curves[0],2.5),at(curves[i],2.5),id+' gate changes Id at 2.5V');
  assert.deepEqual(results[0].frames.at(-1).concentration,results[i].frames.at(-1).concentration,'gate must not change Si transport');
 }
 assert(threshold(curves[2])>threshold(curves[0]),id+' p gate increases NMOS Vth');
 results.forEach((r,i)=>r.frames.forEach(f=>{if(f.polygons.some(p=>p.material===11))assert.deepEqual({type:f.materialDoping[11].type,concentration:f.materialDoping[11].concentration},variants[i]);else assert(!f.materialDoping[11]);}));
 rows.push({id,thresholds:curves.map(threshold)});
}
for(const invalid of [null,{},[],{type:'x',concentration:1e20},{type:'n',concentration:NaN},{type:'p',concentration:1e21},{type:'n',concentration:1e16},{type:'p',concentration:'1e19'}])assert.throws(()=>G.validate(invalid));
assert(!G.applicable('sadp',{op:'deposition',params:{material:'PolySi'}}));
assert(!G.applicable('mosfet',{op:'deposition',params:{material:'Si'}}));
assert.notDeepEqual(D.rgb(1e18),D.rgb(1e20));assert.notDeepEqual(D.rgb(1e20),D.rgb(-1e20));
const blank={materialDoping:{11:{type:'n',concentration:1e17}}};assert(!M.polyGate(blank,11,.00001,1,.01,.01).available,'full depletion guarded');
assert.deepEqual(M.polyGate(blank,79,.1,1,.01,.01),{available:true,cox:.01,shift:0},'metal gates unchanged');
console.log('Five Poly-Si devices: n/p and density change color, Vth and Id at common Vgs; Si transport, cache immutability, non-gates and full depletion guards verified.',JSON.stringify(rows));
