'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const L=require('../web/learning-score.js'),E=require('../analysis-evidence.cjs'),D=require('../web/recipe-studio.js');
const targets=require('../reverse-catalog.json').targets;
for(const t of targets){
 const r=JSON.parse(fs.readFileSync('references/'+t.id+'.json')),f=r.frames.at(-1);
 const raw=L.specification(f,t.roi,t),spec=L.validateSpec(f,t.roi,t,raw),options={...t,designSpec:spec};
 assert.equal(L.assess(f,f,t.roi,options,r.steps,r.steps).score,100,t.id+' unchanged custom goals');
 const changed=structuredClone(spec);changed.dimensions[0].value*=1.5;
 const changedScore=L.assess(f,f,t.roi,{...t,designSpec:changed},r.steps,r.steps);
 assert(changedScore.score<100,t.id+' altered dimensions change grade');
 assert.equal(changedScore.measures[0].target,changed.dimensions[0].value);
 assert(!changedScore.eligible);assert.equal(changedScore.weights.geometry,undefined);
 assert.deepEqual(E.evidence(r,r,{...t,designSpec:changed}).measurements.map(m=>m.target_nm),changedScore.measures.map(m=>m.target));
 for(const bad of [NaN,Infinity,0,-1,100001,'100']){
  const invalid=structuredClone(spec);invalid.dimensions[0].value=bad;
  assert.throws(()=>L.validateSpec(f,t.roi,t,invalid),undefined,t.id+' bad number');
 }
 assert.throws(()=>L.validateSpec(f,t.roi,t,{...spec,targetId:'wrong'}));
 assert.throws(()=>L.validateSpec(f,t.roi,t,{...spec,dimensions:[]}));
 assert.throws(()=>L.validateSpec(f,t.roi,t,{...spec,tolerance:0}));
 if(spec.peaks.length){
  const higher=structuredClone(spec);higher.peaks.forEach(p=>p.value*=1.5);
  const bad=L.assess(f,f,t.roi,{...t,designSpec:higher},r.steps,r.steps);
  assert(bad.components.doping<100,t.id+' concentration changes grade');
  const actual=structuredClone(f);for(const p of higher.peaks)actual.concentration.fields[p.species+'_active']=actual.concentration.fields[p.species+'_active'].map(v=>v*1.5);
  const good=L.assess(f,actual,t.roi,{...t,designSpec:higher},r.steps,r.steps);
  assert.equal(good.score,100,t.id+' reaching revised peak succeeds');
  const missing={...f,concentration:undefined,processEvidence:{}};
  assert(L.assess(f,missing,t.roi,options,r.steps,[]).score<80,t.id+' missing implant cannot pass');
 }
}
// Catalog parameters and the shipped native frame must agree for every flow.
for(const t of targets){
 const r=require('../references/'+t.id+'.json');assert.equal(r.steps.length,t.recipe.length,t.id);
 t.recipe.forEach((s,i)=>{
  assert.equal(r.steps[i].op,s.op,t.id+' step '+i);
  for(const [key,value] of Object.entries(s.params))assert.deepEqual(r.steps[i].params[key],value,t.id+' step '+i+' '+key);
 });
}
for(const [id,expected] of Object.entries({fdsoi:[40,150],pdsoi:[160,150],mbcfet:[40,40,40],gaafet:[60],cfet:[60,60],finfet:[20],'charge-trap':[19,33,28]})){
 const t=targets.find(t=>t.id===id),f=require('../references/'+id+'.json').frames.at(-1);
 const base=L.specification(f,t.roi,t),specific=base.cuts.filter(m=>m.deviceCut);
 assert.deepEqual(specific.map(m=>Math.round(m.target)),expected,id+' gate-region goals');
 const old={...base,dimensions:base.dimensions.filter(d=>!d.key.startsWith('device:'))};old.dimensions[0]={...old.dimensions[0],value:321};
 const migrated=L.validateSpec(f,t.roi,t,old);
 assert.equal(migrated.dimensions[0].value,321);assert.equal(migrated.dimensions.length,base.dimensions.length);
 if(id==='mbcfet'){
  const outerSheets=L.intervals(f,10,1,0).filter(([a,b])=>a>0&&(b<.15||a>.21));
  const gap={polygons:outerSheets.map(([a,b])=>({material:10,points:[[-.2,a],[.2,a],[.2,b],[-.2,b]]}))};
  const measured=L.dimensions(f,gap,t.roi,3,id).filter(m=>m.deviceCut);
  assert.deepEqual(measured.map(m=>Math.round(m.actual)),[40,0,40],'missing middle sheet cannot match a neighbor');
 }
}
// Fixed cuts and tolerance must remain meaningful when target widths change.
const box=w=>({polygons:[{material:11,points:[[-w/2,0],[w/2,0],[w/2,.1],[-w/2,.1]]}]}),t={id:'box'},roi=[-2,2,-.1,.3],f=box(1);
const seq=[{op:'deposition',params:{method:'ALD',cycles:100}}];
const spec=L.specification(f,roi,t);spec.dimensions[0].value=2000;
const right=L.assess(f,box(2),roi,{...t,designSpec:spec},seq,seq);
assert.equal(right.score,100);assert(right.components.geometry<90);
assert.equal(D.question(right).correct,'supported','original IoU must not reject valid custom targets');
spec.tolerance=5;assert(L.assess(f,box(2.08),roi,{...t,designSpec:spec},seq,seq).eligible);
spec.tolerance=1;assert(!L.assess(f,box(2.08),roi,{...t,designSpec:spec},seq,seq).eligible);
console.log('24 editable assignments: default parity, changed dimensions/peaks, achieved new targets, invalid inputs, missing doping, tolerance, server evidence and diagnosis passed.');
