// Usage: node tests/http-grading.cjs http://127.0.0.1:3012 [--presets]
// Production mode tests three adversarial flows without touching user drafts.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {compare}=require('../web/grading');
const base=process.argv[2];if(!base)throw Error('Supply the service URL');
async function request(route,data){const response=await fetch(base+route,{signal:AbortSignal.timeout(150000),...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});assert(response.ok,route+': '+response.status);return response.json()}
async function simulate(payload){const job=await request('/api/reverse',payload);if(job.result)return job.result;for(let i=0;i<150;i++){const state=await request('/api/jobs/'+job.job);if(state.state==='done')return state.result;assert.notEqual(state.state,'error',state.error);await new Promise(r=>setTimeout(r,1000))}throw Error('Native timeout')}
(async()=>{
 const code=await (await fetch(base+'/grading.js')).text();assert.equal(code,fs.readFileSync(path.join(__dirname,'../web/grading.js'),'utf8'),'served grading source must match the tested version');
 const catalog=await request('/api/reverse-catalog');
 for(const id of ['mosfet','rcat','charge-trap']){
  const t=catalog.targets.find(t=>t.id===id),ref=await request('/api/reference/'+id);
  assert.equal(t.assessment.version,2);assert.equal(compare(ref.frames.at(-1),ref.frames.at(-1),t.roi,t).score,100);
  const steps=t.recipe.filter(s=>s.op!=='diffusion'),result=await simulate({target:id,steps});
  assert.equal(result.failure,null);const g=compare(ref.frames.at(-1),result.frames.at(-1),t.roi,t);
  assert.equal(g.score,50);assert.equal(g.components.geometry,1);assert.equal(g.components.total,0);assert.equal(g.components.process,0);
  console.log(id,'HTTP native no-doping:',g.score,'reference: 100');
 }
 if(process.argv.includes('--presets')){
  for(const method of ['PVD','CVD']){const r=await simulate({target:'sti',steps:[{op:'deposition',params:{method}}]});assert.equal(r.failure,null);assert.equal(r.steps[0].params.exponent,method==='PVD'?20:1);assert.equal(r.steps[0].params.sticking,method==='PVD'?1:.2);console.log(method,'API defaults verified')}
  for(const params of [null,[],{method:'unknown'},{method:'PVD',dose:1}]){const r=await fetch(base+'/api/reverse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:'sti',steps:[{op:'deposition',params}]})});assert.equal(r.status,400)}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
