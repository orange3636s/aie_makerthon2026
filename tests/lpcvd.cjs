'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const U=require('../web/ui-contract'),R=require('../web/recipe-state'),N=require('../web/recipe-response');
const catalog=require('../reverse-catalog.json'),candidates=require('../flow-candidates.json');
let count=0;
for(const id of ['mosfet','fdsoi','pdsoi','rcat','charge-trap','sadp']){
 const target=catalog.targets.find(t=>t.id===id),reference=JSON.parse(fs.readFileSync('references/'+id+'.json'));
 const flows=[target.recipe,reference.steps,...candidates.targets.find(t=>t.target===id).candidates.map(c=>c.steps)];
 for(const steps of flows){
  const films=steps.filter(s=>s.op==='deposition'&&s.params.material==='PolySi');assert(films.length,id);
  for(const s of films){const p=s.params;
   assert.equal(p.method,'CVD');assert.equal(p.cvd_type,'LPCVD');assert.equal(p.source_gas,'SiH4');assert.equal(p.input_mode,'Equipment');
   assert.equal(p.depo_temperature,630);assert.equal(p.cvd_pressure,.2);assert.equal(p.source_flow,60);
   assert(Math.abs(N.nominal('deposition',p).rate*60000-11.02)<1e-8);
   const fields=U.recipeFields(catalog.operations.find(o=>o.id==='deposition'),p);
   assert(!fields.some(f=>f.key==='power'),'thermal LPCVD must not show RF');
   for(const key of ['cvd_type','source_gas','source_flow','depo_temperature','cvd_pressure','time'])assert(fields.some(f=>f.key===key),key);
   count++;
  }
 }
 assert(!reference.failure);assert.equal(reference.frames.length,reference.steps.length+1);
 assert(!R.invalid(reference.steps,catalog.operations));
}
console.log(count+' LPCVD films: six examples, reference/candidate recipes, thermal controls, chemistry and nominal-rate consistency passed');
