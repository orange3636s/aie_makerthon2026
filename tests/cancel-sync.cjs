const assert=require('node:assert/strict');
const base=process.env.QA_BASE||'http://127.0.0.1:3006';
(async()=>{
 const controller=new AbortController();const pending=fetch(base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({example:'cfet',params:{sd_anneal:3}}),signal:controller.signal}).catch(e=>e);
 await new Promise(r=>setTimeout(r,1200));controller.abort();await pending;
 await new Promise(r=>setTimeout(r,1600));
 const start=Date.now(),r=await fetch(base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({example:'photo-lithography'})});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));assert.equal(d.state,'done');assert.equal(d.result.failure,null);console.log('Synchronous CFET request aborted; next Photo completed in '+((Date.now()-start)/1000)+' s');
})().catch(e=>{console.error(e);process.exitCode=1});
