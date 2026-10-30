const assert=require('node:assert/strict'),fs=require('node:fs');
const {estimate,example}=require('../web/process-estimate.js');
const {defaults,restore}=require('../web/recipe-state.js');
const {operations,targets}=require('../reverse-catalog.json');
const catalog=require('../catalog.json').examples;
const dep=operations.find(o=>o.id==='deposition'),etch=operations.find(o=>o.id==='etch');
const p={...defaults(dep,'PVD'),method:'PVD',material:'SiO2',rate:.05,time:2};
assert.equal(estimate(dep,p).nm,100,'µm/s converts to nm before displaying');
assert.equal(estimate(dep,{...p,time:4}).nm,200,'time changes reference thickness');
assert.equal(estimate(dep,{...p,material:'W'}).nm,100,'material identity must not invent chemical calibration');
assert.match(estimate(dep,p).note,/재료별.*온도.*미적용/);
assert.equal(estimate(dep,{...p,sticking:.1}).nm,100,'local coverage cannot be inferred from nominal growth');
for(const value of ['',null,NaN,Infinity,-1,dep.fields.find(f=>f.key==='time').max+1])assert(estimate(dep,{...p,time:value}).invalid,'reject invalid drafts');
const ald={...defaults(dep),method:'ALD',cycles:40,gpc:.0005};
assert.equal(estimate(dep,ald).nm,20);
assert.match(estimate(dep,ald).basis,/포화/);
assert(estimate(dep,{...ald,cycles:40.5}).invalid);
assert.equal(estimate(dep,{...ald,time:''}).nm,20,'inactive continuous-deposition fields do not corrupt ALD');
const ep={...defaults(etch),method:'Directional',rate:.1,time:2};
assert.equal(estimate(etch,ep).nm,200);
assert.match(estimate(etch,ep).note,/완전 보호/);
assert.equal(estimate(etch,{...ep,method:'Selective removal',rate:'',time:''}).nm,undefined,'total removal must not claim a timed depth');
assert.equal(estimate(operations.find(o=>o.id==='diffusion'),{}),null,'do not fabricate concentration/temperature forecasts');
for(const target of targets)for(const row of restore(target.recipe,operations)){
 const result=estimate(operations.find(o=>o.id===row.op),row.params);
 if(result){assert(!result.invalid,target.id);if(result.nm!==undefined)assert(Number.isFinite(result.nm));}
}
for(const id of ['pvd']){
 const spec=catalog.find(s=>s.id===id),reference=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../references',id+'.json')));
 const predicted=example(spec,Object.fromEntries(spec.fields.map(f=>[f.key,f.default])));
 const nominal=reference.frames.reduce((sum,f)=>sum+(f.metrics?.nominalGrowthUm||0),0)*1000;
 assert(Math.abs(predicted.nm-nominal)<1e-6,id+' preview agrees with the executed recipe metadata');
}
console.log('Preflight units, invalid drafts, model limits and saved recipe reference values passed');
