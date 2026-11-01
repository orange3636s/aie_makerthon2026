'use strict';
// Run against an explicitly started local server or deployed release.
const assert=require('node:assert/strict');
const base=process.env.TEST_BASE||'http://127.0.0.1:3039';
async function request(path,body){const r=await fetch(base+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});return {status:r.status,data:await r.json()};}
(async()=>{
 const {data:ref,status}=await request('/api/reference/mosfet');assert.equal(status,200);assert.equal(ref.substrateDoping.type,'p');
 const payload={target:'mosfet',steps:ref.steps};let times=[];
 assert.equal(ref.frames.at(-1).materialDoping[11].concentration,1e20);
 for(const type of ['p','n','intrinsic','p']){
  const start=performance.now(),r=await request('/api/reverse',{...payload,substrateDoping:{type,concentration:2e16}});assert.equal(r.status,200);const result=r.data.result;assert(result.cached);assert.equal(result.substrateDoping.type,type);assert.equal(result.frames.length,23);
  assert.equal(result.frames.at(-1).materialDoping[11].type,'n','NMOS gate polarity independent of user wafer polarity');
  const a=result.frames[0].concentration.fields.net_active||[];assert(type==='p'?a.some(v=>v===-2e16):type==='n'?a.some(v=>v===2e16):!a.some(v=>v));times.push({type,ms:Math.round(performance.now()-start)});
 }
 for(const substrateDoping of [{type:'p',concentration:-1},{type:'n',concentration:'1e16'},{type:'bad',concentration:1e16}])assert.equal((await request('/api/reverse',{...payload,substrateDoping})).status,400);
 assert.equal((await request('/api/reference/mosfet')).data.substrateDoping.concentration,1e16,'custom settings never mutate target');
 const cf=(await request('/api/reference/cfet')).data;assert.equal(cf.substrateDoping.concentration,5e14);assert.equal(cf.frames.at(-1).concentration.background.upperBodyType,'n');
 console.log('Wafer API: polarity, intrinsic, density, invalid requests, isolated cached targets and CFET verified.',JSON.stringify(times));
})().catch(e=>{console.error(e);process.exitCode=1;});
