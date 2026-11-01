'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const W=require('../web/wafer-doping.js'),B=require('../wafer-background.cjs'),D=require('../web/dopant-view.js'),M=require('../web/learning-lab-models.js'),L=require('../web/learning-score.js');
const targets=require('../reverse-catalog.json').targets;
for(const bad of [null,{type:'q',concentration:1e16},{type:'p',concentration:0},{type:'p',concentration:NaN},{type:'p',concentration:'1e16'},{type:'n',concentration:1e20}])assert.throws(()=>W.validate(bad));
assert.equal(W.defaults('mosfet').type,'p');assert.equal(W.defaults('pmos').type,'n');assert.equal(W.defaults('cfet','sd-p').type,'n');
let count=0;
for(const target of targets){
 const raw=JSON.parse(fs.readFileSync('references/'+target.id+'.json')),before=JSON.stringify(raw),result=B.apply(raw);
 assert.equal(result.frames.length,raw.frames.length);assert.equal(result.substrateDoping.type,'p');
 for(const f of result.frames){
  count++;const c=f.concentration;assert(c&&f.substrateDoping);
  for(const [key,values] of Object.entries(c.fields)){assert.equal(values.length,c.nx*c.ny,target.id+key);assert(values.every(Number.isFinite));assert(values.every((v,i)=>c.mask[i]||v===0),target.id+' no doping in oxide/air');}
 }
 const end=result.frames.at(-1),grade=L.assess(end,end,target.roi,target,result.steps,result.steps);assert(grade.checks.every(c=>c.pass),target.id+' self-evaluation');
 assert.deepEqual(L.specification(end,target.roi,target).peaks.map(p=>p.species),L.specification(raw.frames.at(-1),target.roi,target).peaks.map(p=>p.species),'background must not invalidate saved goal schema');
 const first=result.frames[0];assert(first.concentration.fields.net_active.some(v=>v===-result.substrateDoping.concentration));
 assert.deepEqual(first.processEvidence,raw.frames[0].processEvidence,'wafer is not implant evidence');
 assert.equal(JSON.stringify(raw),before,'native geometry/transport cache immutable');assert.equal(B.apply(result),result,'no double addition');
 if(M.electricalDevices.includes(target.id)){
  const f=result.frames.at(-1),iv=M.deviceIV(f,target.id);assert(iv.available,target.id+': '+iv.reason);assert(iv.series.every(s=>s.points.every(p=>p.every(Number.isFinite))));
  assert(!M.deviceIV({...f,processEvidence:{annealedSpecies:[]}},target.id).available,'background cannot replace S/D activation');
 }
}
const raw=JSON.parse(fs.readFileSync('references/mosfet.json')),p=B.apply(raw,{type:'p',concentration:1e16}),n=B.apply(raw,{type:'n',concentration:1e16}),intrinsic=B.apply(raw,{type:'intrinsic',concentration:1e16});
assert(p.frames[0].concentration.fields.net_active.some(v=>v<0));assert(n.frames[0].concentration.fields.net_active.some(v=>v>0));assert(!Object.values(intrinsic.frames[0].concentration.fields).some(a=>a.some(v=>v)));
const f=p.frames.at(-1),c=f.concentration,old=raw.frames.at(-1).concentration;
let compensated=0;for(let k=0;k<c.mask.length;k++){const y=c.origin[1]+(Math.floor(k/c.nx)+.5)*c.dx;if(c.mask[k]&&y<0&&old.fields.net_active[k]>1e17){assert(Math.abs(c.fields.net_active[k]-(old.fields.net_active[k]-1e16))<1000);compensated++;}}
assert(compensated>0,'opposite background subtracts from net donors');
const heavy=B.apply(raw,{type:'p',concentration:1e17});assert.notEqual(M.deviceIV(f,'mosfet').threshold,M.deviceIV(heavy.frames.at(-1),'mosfet').threshold,'wafer concentration changes IV');
const light=D.rgb(-1e16),strong=D.rgb(-1e19);assert(strong[1]<light[1],'p+ darker than substrate');assert(D.rgb(1e19)[0]<D.rgb(1e16)[0],'n+ darker');assert.notDeepEqual(D.rgb(1e14),D.rgb(-1e14));
assert(D.legend(f).includes('p형 · B')&&D.legend(f).includes('n형 · P')&&D.legend(f).includes('cm⁻³'));
for(const axis of ['X','Z']){const slice=D.slice(f,[-.4,.4,-.3,.2],axis,axis==='X'?0:-.2,.8);assert(slice.fields.net_active.some(v=>v<0),'slice retains background '+axis);}
const cf=B.apply(JSON.parse(fs.readFileSync('references/cfet.json'))).frames.at(-1);assert.equal(cf.concentration.background.upperBodyType,'n');assert(M.density(cf,0,.53)>0,'upper pFET has n body');assert(M.density(cf,0,.03)<0,'lower nFET has p body');
console.log(`24 examples / ${count} frames: p/n/intrinsic wafer, compensation, material clipping, 11 I–V models, CFET bodies, fixed color scale and X/Z slices passed.`);
