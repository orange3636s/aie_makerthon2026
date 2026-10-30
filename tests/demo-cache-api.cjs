'use strict';
const {spawn}=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const root=path.resolve(__dirname,'..'),server=spawn(process.execPath,['server.cjs'],{cwd:root,env:{...process.env,PORT:'3028',HOST:'127.0.0.1',SIMULATION_SYNC:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});let stderr='';server.stderr.on('data',b=>stderr+=b);const base='http://127.0.0.1:3028';try{
 for(let i=0;i<50;i++){try{if((await fetch(base+'/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 const post=data=>fetch(base+'/api/reverse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 for(const c of require('../flow-candidates.json').targets.find(t=>t.target==='mosfet').candidates){const steps=structuredClone(c.steps);steps[0].label='내 증착 실험';const at=Date.now(),r=await post({target:'mosfet',steps}),d=await r.json();assert.equal(r.status,200);assert.equal(d.state,'done');assert(d.result.cached);assert.equal(d.result.steps[0].label,'내 증착 실험');assert.equal(d.result.frames[1].label,'내 증착 실험');console.log(c.id,'cached API',Date.now()-at,'ms');}
 const steps=structuredClone(require('../flow-candidates.json').targets.find(t=>t.target==='mosfet').candidates[0].steps);steps[0].params.cycles+=1;
 const r=await post({target:'mosfet',steps}),d=await r.json();assert.equal(r.status,202);assert(d.job&&!d.result);await fetch(base+'/api/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job:d.job})});
 assert.equal((await fetch(base+'/api/demo/mosfet/unknown')).status,404);assert.equal((await post({target:'mosfet',steps:[{op:'bad'}]})).status,400);
 assert.equal(stderr,'');console.log('Cached full results preserve labels; changed recipe starts native job; cancellation, unknown candidate and invalid input passed.');
}finally{server.kill();}})().catch(e=>{console.error(e);process.exitCode=1});
