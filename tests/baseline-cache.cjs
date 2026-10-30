'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{create}=require('../baseline-cache.cjs'),root=path.resolve(__dirname,'..');
const lookup=create(root),catalog=require('../reverse-catalog.json'),Recipe=require('../web/recipe-state.js');
for(const target of catalog.targets){
 const input={target:target.id,steps:Recipe.restore(target.recipe,catalog.operations)};
 const result=lookup(input);assert(result,target.id);assert(!result.failure);assert.equal(result.frames.length,input.steps.length+1);
 const params=Object.fromEntries(require('../catalog.json').examples.find(t=>t.id===target.id).fields.map(f=>[f.key,f.default]));
 const observation=lookup({example:target.id,params,stages:{}},false);assert(observation,target.id+' observation');
 const changedParams={...params},param=Object.keys(params).find(k=>typeof params[k]==='number');changedParams[param]+=Math.max(.0001,Math.abs(params[param])*.001);
 assert(lookup({example:target.id,params:changedParams},false)===null,target.id+' changed observation parameters');
 assert.equal(lookup({example:target.id,params,stages:{1:2}},false),null);
 assert.equal(lookup({...input,substrateThickness:.7}),null);
 assert.equal(lookup({...input,substrateRoughness:.001}),null);
 assert.equal(lookup({...input,view:'sd'}),null);
 assert.equal(lookup({...input,steps:input.steps.slice(1)}),null);
 const changed=structuredClone(input),p=changed.steps.find(s=>Object.values(s.params).some(x=>typeof x==='number')).params;
 const key=Object.keys(p).find(k=>typeof p[k]==='number');p[key]+=.0001;assert.equal(lookup(changed),null,target.id+' changed input');
}
const tmp=fs.mkdtempSync(path.join(root,'.runtime/baseline-cache-test-'));
try{fs.mkdirSync(path.join(tmp,'baseline-results'));fs.writeFileSync(path.join(tmp,'baseline-results/manifest.json'),JSON.stringify({version:1,modelHash:'stale'}));assert.equal(create(tmp)({target:'mosfet'}),null);}
finally{fs.rmSync(tmp,{recursive:true,force:true})}
console.log('24 fresh native baselines; changed parameters, omitted steps, wafer, section and stale engine invalidate cache.');
