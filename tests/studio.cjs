'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),L=require('../web/learning-score'),P=require('../web/parameter-preview'),V=require('../web/viewport'),E=require('../analysis-evidence.cjs');
const catalog=require('../reverse-catalog.json');
for(const t of catalog.targets){const ref=JSON.parse(fs.readFileSync('references/'+t.id+'.json'));const r=E.evidence(ref,ref,t);assert.equal(r.status,'server-verified');assert.equal(r.score,100);assert(!r.measurements.some(m=>!Number.isFinite(m.error_percent)));const fitted=V.fit(ref.frames.at(-1),ref.bounds);for(const p of ref.frames.at(-1).polygons)for(const [x,y] of p.points)if(x>=ref.bounds[0]&&x<=ref.bounds[1]&&y>=ref.bounds[2]&&y<=ref.bounds[3])assert(x>=fitted[0]&&x<=fitted[1]&&y>=fitted[2]&&y<=fitted[3]);}
const ald=cycles=>[{op:'deposition',params:{method:'ALD',cycles,pulse:.1}}];
assert(L.cost(ald(120))>L.cost(ald(30)));assert(L.resources(ald(30)).partial);assert.equal(L.resources(ald(30)).knownSeconds,3);
assert.deepEqual(P.values(8,{min:.05,max:8}),[4,8]);assert.deepEqual(P.values(.05,{min:.05,max:8}),[.05,.075]);
assert.equal(P.descriptor({op:'etch',params:{method:'ALE'}},catalog.operations.find(o=>o.id==='etch')),null);
assert.equal(P.descriptor({op:'diffusion',params:{method:'Ion implantation'}},catalog.operations.find(o=>o.id==='diffusion')).key,'dose');
assert.equal(E.signature([{op:'etch',label:'a',params:{time:1,rate:2}}]),E.signature([{op:'etch',label:'b',params:{rate:2,time:1}}]));
assert.notEqual(E.signature([{op:'etch',params:{time:1}}]),E.signature([{op:'etch',params:{time:2}}]));
assert.equal(E.evidence(null,null,{}).status,'unavailable');
const t=catalog.targets.find(t=>t.id==='mosfet'),ref=JSON.parse(fs.readFileSync('references/mosfet.json')),bad=structuredClone(ref);delete bad.frames.at(-1).concentration;
assert(E.evidence(ref,bad,t).score<80);
// A different labelled flow with the same physical result is not rejected by sequence.
const alternative=ref.steps.map(s=>({...s,label:'alternative'}));assert.equal(L.assess(ref.frames.at(-1),ref.frames.at(-1),t.roi,t,ref.steps,alternative).score,100);
console.log('24 targets: fit bounds, server evidence, immutable score, alternate labels, ALD burden and bounded preview samples passed');
