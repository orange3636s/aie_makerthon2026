'use strict';
const assert=require('node:assert/strict'),M=require('../web/learning-lab-models.js');
const base=process.env.TEST_BASE||'http://127.0.0.1:3039';
async function request(path,body){const r=await fetch(base+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});return {status:r.status,data:await r.json()};}
(async()=>{
 const rows=[];
 for(const id of ['mosfet','fdsoi','pdsoi','rcat','charge-trap']){
  const ref=(await request('/api/reference/'+id)).data,values=[];
  for(const polyGateDoping of [{type:'n',concentration:1e20},{type:'p',concentration:1e20},{type:'n',concentration:1e18}]){
   const start=performance.now(),r=await request('/api/reverse',{target:id,steps:ref.steps,polyGateDoping});
   assert.equal(r.status,200,JSON.stringify(r.data));const result=r.data.result;assert(result.cached,id+' reuses geometry');assert.deepEqual(result.polyGateDoping,polyGateDoping);
   const f=result.frames.at(-1);assert.equal(f.materialDoping[11].type,polyGateDoping.type);assert.equal(f.materialDoping[11].concentration,polyGateDoping.concentration);
   const iv=M.deviceIV(f,id);assert(iv.available,iv.reason);values.push(iv.threshold??iv.branches[0].threshold);
   rows.push({id,...polyGateDoping,ms:Math.round(performance.now()-start),threshold:values.at(-1)});
  }
  assert.equal(new Set(values).size,3,id+' real API updates IV');
 }
 const ref=(await request('/api/reference/mosfet')).data;assert.deepEqual(ref.polyGateDoping,{type:'n',concentration:1e20},'custom run does not mutate default');
 for(const bad of [{type:'x',concentration:1e20},{type:'p',concentration:0},{type:'n',concentration:'1e19'}])assert.equal((await request('/api/reverse',{target:'mosfet',steps:ref.steps,polyGateDoping:bad})).status,400);
 console.log('Gate API defaults, isolation, invalid inputs, 5 device caches and IV responses passed.',JSON.stringify(rows));
})().catch(e=>{console.error(e);process.exitCode=1});
