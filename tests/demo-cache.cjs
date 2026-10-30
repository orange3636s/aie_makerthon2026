'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{create,modelHash}=require('../demo-cache.cjs'),root=path.resolve(__dirname,'..');
const demo=create(root),entry=require('../flow-candidates.json').targets.find(t=>t.target==='mosfet'),ops=require('../reverse-catalog.json').operations,Recipe=require('../web/recipe-state.js');
for(const c of entry.candidates){
 const input={target:'mosfet',view:'gate',steps:Recipe.restore(c.steps,ops)},r=demo.find(input,true);
 assert(r&&!r.failure);assert.equal(r.frames.length,c.steps.length+1);assert(Recipe.equivalent(input.steps,r.steps,ops));
 const changed=structuredClone(input);changed.steps[0].params.cycles+=1;assert.equal(demo.find(changed,true),null);
 assert.equal(demo.find({...input,steps:input.steps.slice(1)},true),null);
 assert.equal(demo.find({...input,substrateThickness:.7},true),null);assert.equal(demo.find({...input,substrateRoughness:.001},true),null);assert.equal(demo.find({...input,view:'sd'},true),null);
}
assert(demo.find({example:'mosfet',params:{length:.3,oxide:.025,spacer:.04},stages:{}},false));
assert.equal(demo.find({example:'mosfet',params:{length:.31,oxide:.025,spacer:.04},stages:{}},false),null);
assert.equal(demo.candidate('not-a-candidate'),null);
// A stale engine manifest disables all saved results before any artifact is read.
const tmp=fs.mkdtempSync(path.join(root,'.runtime/demo-test-'));
try{fs.mkdirSync(path.join(tmp,'demo-results'));fs.writeFileSync(path.join(tmp,'demo-results/manifest.json'),JSON.stringify({version:1,modelHash:'stale'}));assert.equal(create(tmp).candidate('reference'),null);assert.equal(require('../demo-results/manifest.json').modelHash,modelHash(root));}
finally{if(!tmp.startsWith(path.join(root,'.runtime/demo-test-')))throw Error('Unexpected test path');fs.rmSync(tmp,{recursive:true,force:true});}
console.log('Three complete demo flows; normalized matches; changed cycles, deleted step, substrate, view and stale engine all invalidate reuse.');
