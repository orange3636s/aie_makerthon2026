'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../web/learning-lab-models.js');
const frames=Object.fromEntries(M.electricalDevices.map(id=>[id,JSON.parse(fs.readFileSync('references/'+id+'.json')).frames.at(-1)]));
const last=r=>r.series[0].points.at(-1)[1];
for(const [id,f] of Object.entries(frames)){
 const original=JSON.stringify(f),r=M.deviceIV(f,id);
 assert(r.available,id+': '+r.reason);assert(r.series.length>0,id);
 for(const s of r.series){assert(s.points.every(p=>p.every(Number.isFinite)),id);assert(s.points.some(p=>p[1]!==0),id+' nonflat');}
 assert.equal(M.deviceIV({...f,concentration:null},id).available,false,id+' missing active doping');
 const key=id==='pn-junction'?'areaUm2':'widthNm';
 for(const invalid of [NaN,Infinity,-1,'1000',null])assert.equal(M.deviceIV(f,id,{[key]:invalid}).available,false,id+' invalid input');
 assert.equal(M.deviceIV({polygons:[]},id).available,false,id+' empty');
 const defaults=M.electricalDefaults(id),double=M.deviceIV(f,id,{[key]:defaults[key]*2});
 assert(Math.abs(last(double)/last(r)-2)<1e-8,id+' area/width scaling');
 if(id!=='pn-junction'){
  const twiceDoped=structuredClone(f);twiceDoped.concentration.fields.net_active=twiceDoped.concentration.fields.net_active.map(v=>2*v);
  const doseResponse=M.deviceIV(twiceDoped,id);assert(doseResponse.available,id+' changed concentration');
  for(let i=0;i<r.series.length;i++)assert(Math.abs(doseResponse.series[i].points.at(-1)[1])>Math.abs(r.series[i].points.at(-1)[1]),id+' active dose increases current through lower access resistance');
  const a=doseResponse.access||doseResponse.branches[0].access,b=r.access||r.branches[0].access;
  assert(Math.abs(a.source/b.source-.5)<1e-8,id+' sheet resistance inverse concentration');
  const slower=M.deviceIV(f,id,{mobility:150});assert(Math.abs(last(slower)/last(r)-.5)<1e-8,id+' mobility scaling');
  const stronger=M.deviceIV(f,id,{vds:.2});assert(last(stronger)>last(r),id+' drain bias');
  const noGate={...f,polygons:f.polygons.filter(p=>![11,70,79].includes(p.material))};assert(!M.deviceIV(noGate,id).available,id+' gate removed');
  const noDielectric={...f,polygons:f.polygons.filter(p=>![16,30,31,32,201].includes(p.material))};assert(!M.deviceIV(noDielectric,id).available,id+' dielectric removed');
 }
 assert.equal(JSON.stringify(f),original,id+' immutable');
}
const pn=M.deviceIV(frames['pn-junction'],'pn-junction');
const pn2=structuredClone(frames['pn-junction']);pn2.concentration.fields.net_active=pn2.concentration.fields.net_active.map(v=>2*v);
assert(Math.abs(last(M.deviceIV(pn2,'pn-junction'))/last(pn)-.5)<1e-8,'PN saturation current uses computed concentrations');
assert(pn.points[0][1]<0&&pn.points.at(-1)[1]>0);assert(Math.abs(pn.points[40][1])<1e-25);
assert(pn.points.every((p,i)=>i===0||p[1]>=pn.points[i-1][1]));
assert(M.deviceIV(frames.fdsoi,'fdsoi').branches[0].threshold<M.deviceIV(frames.pdsoi,'pdsoi').branches[0].threshold,'finite SOI body depletion');
assert(M.deviceIV(frames.rcat,'rcat').branches[0].lengthNm>700,'recess contributes to channel length');
const cfet=M.deviceIV(frames.cfet,'cfet');assert.equal(cfet.series.length,2);
assert(cfet.series[0].points.at(-1)[1]>0&&cfet.series[1].points.at(-1)[1]<0,'complementary polarity');
const noP=structuredClone(frames.cfet);noP.concentration.fields.net_active=noP.concentration.fields.net_active.map(v=>Math.max(0,v));assert(!M.deviceIV(noP,'cfet').available,'missing p branch');
const moreP=structuredClone(frames.cfet);moreP.concentration.fields.net_active=moreP.concentration.fields.net_active.map(v=>v<0?2*v:v);
const pResponse=M.deviceIV(moreP,'cfet');assert.deepEqual(pResponse.series[0].points,cfet.series[0].points,'upper p dose cannot alter lower n curve');
assert(Math.abs(pResponse.series[1].points.at(-1)[1])>Math.abs(cfet.series[1].points.at(-1)[1]),'upper p dose changes upper p curve');
assert(M.deviceIV(frames['charge-trap'],'charge-trap').notes.length,'missing ONO never claimed as working memory');
assert(!M.deviceIV(frames.mosfet,'sti').available,'structure excluded');
console.log('11 device I–V models: valid curves, geometry/doping prerequisites, invalid inputs, scaling, SOI depletion, recessed length, PN/CFET polarity and immutability passed.');
