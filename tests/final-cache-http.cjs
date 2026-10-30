'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),base=process.env.QA_BASE||'http://127.0.0.1:3034';
(async()=>{const results=[];
 for(const target of require('../reverse-catalog.json').targets){
  const spec=require('../catalog.json').examples.find(e=>e.id===target.id),params=Object.fromEntries(spec.fields.map(f=>[f.key,f.default]));
  const row={id:target.id};
  for(const [route,payload,name] of [['/api/run',{example:target.id,params},'observation'],['/api/reverse',{target:target.id,steps:target.recipe},'reverse']]){
   const at=performance.now(),r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','Accept-Encoding':'gzip'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)}),d=await r.json();
   assert.equal(r.status,200,JSON.stringify(d));assert.equal(d.result.cached,true,target.id+' cache miss');assert(!d.result.failure);assert.equal(d.result.frames.length,d.result.steps.length+1);
   row[name+'Ms']=Math.round(performance.now()-at);assert(row[name+'Ms']<15000);row.frames=d.result.frames.length;
  }
  results.push(row);console.log(JSON.stringify(row));
 }
 for(const url of ['/.env','/server.cjs','/baseline-results/manifest.json','/references/mosfet.json','/.git/config'])assert.equal((await fetch(base+url)).status,404,url);
 fs.writeFileSync('.runtime/final-cache-http.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
