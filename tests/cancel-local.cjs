// Run against the local development server only. Checks real native cancellation.
const assert=require('node:assert/strict');
const base='http://127.0.0.1:3004';
const post=async(path,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();assert(r.ok,JSON.stringify(j));return j;};
(async()=>{
 const first=await post('/api/run',{example:'cfet'});assert(first.job);
 const cancelled=await post('/api/cancel',{job:first.job});assert.equal(cancelled.cancelled,true);
 const state=await (await fetch(base+'/api/jobs/'+first.job)).json();assert.equal(state.state,'cancelled');
 const next=await post('/api/run',{example:'photo-lithography'});let done;
 for(let i=0;i<80;i++){done=await(await fetch(base+'/api/jobs/'+next.job)).json();if(['done','error'].includes(done.state))break;await new Promise(r=>setTimeout(r,250));}
 assert.equal(done.state,'done',JSON.stringify(done));assert.equal(done.result.failure,null);assert.equal(done.result.frames.length,7);
 console.log('Running native job cancelled; next Photo calculation completed with 7 frames');
})().catch(e=>{console.error(e);process.exitCode=1});
