// Real HTTP and solver integration. Start the QA server, then pass its local URL.
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:3004';let count=0;
async function call(path,body,expected=200,headers={}){
 const r=await fetch(base+path,{...(body!==undefined?{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}:{}),headers:{'Content-Type':'application/json',...headers},signal:AbortSignal.timeout(45000)});
 const d=await r.json();assert.equal(r.status===202&&expected===200&&d.job?200:r.status,expected,JSON.stringify(d));count++;
 if(d.job&&!d.result){for(let i=0;i<150;i++){await new Promise(resolve=>setTimeout(resolve,1000));const j=await(await fetch(base+'/api/jobs/'+d.job)).json();assert.notEqual(j.state,'error',j.error);if(j.state==='done')return {...d,result:j.result}}throw Error('job timed out')}
 return d;
}
(async()=>{
 assert((await call('/api/health')).ok);
 assert.equal((await call('/api/catalog')).examples.length,24);
 assert.equal((await call('/api/reverse-catalog')).targets.length,24);
 for(const id of ['pn-junction','charge-trap','fdsoi','pdsoi','rcat','bcat','gaafet','cfet']){const ref=await call('/api/reference/'+id);assert.equal(ref.failure,null);assert(ref.frames.length>5)}
 await call('/api/reference/missing',undefined,404);await call('/api/jobs/missing',undefined,404);
 await call('/api/reverse','{',400);
 await call('/api/reverse',null,400);
 await call('/api/reverse',{target:'sti',steps:Array(97).fill({op:'cmp'})},400);
 await call('/api/reverse',{target:'sti',steps:[{op:'etch',params:{time:null}}]},400);
 await call('/api/reverse',{target:'sti',steps:[{op:'etch',params:{time:-1}}]},400);
 await call('/api/reverse',{target:'sti',steps:[{op:'deposition',params:{cycles:5.2}}]},400);
 await call('/api/reverse',{target:'sti',steps:[{op:'photo',params:{injection:1}}]},400);
 await call('/api/run',{example:'unknown'},400);
 await call('/api/run',{example:'bosch',stages:{2:100}},400);
 await call('/api/run',{example:'bosch',stages:{99:.1}},400);
 await call('/api/run',{example:'mosfet',stages:{2:.1}},400);
 await call('/api/run',{example:'pn-junction',params:{unsupported:1}},400);
 await call('/api/run',{example:'implant',params:{energy:20}},400);
 await call('/api/run',{example:'implant',params:{energy:'30'}},400);
 await call('/api/run',{example:'ald',params:{cycles:5.5}},400);
 await call('/api/run',{example:'bosch',params:{cycles:2.5}},400);
 await call('/api/reverse',{target:'sti',steps:[]},403,{Origin:'https://unrelated.example'});
 await call('/api/reverse',' '.repeat(49000),413);
 const initial=await call('/api/reverse',{target:'sti',steps:[]});assert.equal(initial.result.frames.length,1);
 const cached=await call('/api/reverse',{target:'sti',steps:[]});assert.equal(cached.result.cached,true);
 const failed=await call('/api/reverse',{target:'sti',steps:[{op:'cmp',params:{}}]});assert.equal(failed.result.failure.step,1);assert.equal(failed.result.frames.length,1);
 const recovered=await call('/api/reverse',{target:'sti',steps:[{op:'deposition',params:{method:'CVD'}},{op:'cmp',params:{}}]});assert.equal(recovered.result.failure,null);

 console.log(`${count} HTTP scenarios passed (validation, cache, failure and recovery)`);
})().catch(e=>{console.error(e);process.exitCode=1});
