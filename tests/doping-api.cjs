'use strict';
const assert=require('node:assert/strict'),M=require('../web/learning-lab-models.js'),I=require('../web/implant-controls.js');
const base=process.env.TEST_BASE||'http://127.0.0.1:3040';
async function request(path,body){const r=await fetch(base+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});const data=await r.json();assert(r.ok,JSON.stringify(data));return data;}
(async()=>{
 const ref=await request('/api/reference/mosfet'),steps=structuredClone(ref.steps);for(const s of steps)if(I.applicable(s)){s.params.species='B';s.params.dose=I.dose(s.params,2e18);}
 async function calc(payload){let r=await request('/api/reverse',payload);const job=r.job;for(let i=0;!r.result&&i<180;i++){assert(r.state!=='error',r.error);await new Promise(r=>setTimeout(r,1000));r=await request('/api/jobs/'+job);}assert(r.result&&!r.result.failure,JSON.stringify(r));return r.result;}
 const start=performance.now(),p=await calc({target:'mosfet',steps,substrateDoping:{type:'n',concentration:1e16}});
 assert.equal(p.polyGateDoping.type,'p','n wafer selects p gate if omitted');const iv=M.deviceIV(p.frames.at(-1),'mosfet');assert(iv.available,iv.reason);assert(iv.points.at(-1)[1]<0&&iv.threshold<0);console.log('Native PMOS API',Math.round(performance.now()-start)+'ms',iv.threshold);
 const gate=await calc({target:'mosfet',steps,substrateDoping:{type:'n',concentration:1e16},polyGateDoping:{type:'p',concentration:1e18}});
 assert(gate.cached,'gate edit reuses native fields');const gi=M.deviceIV(gate.frames.at(-1),'mosfet');assert(gi.available);assert.notEqual(gi.threshold,iv.threshold,'gate density response');
 const body=await calc({target:'mosfet',steps,substrateDoping:{type:'n',concentration:5e15},polyGateDoping:{type:'p',concentration:1e20}});
 assert(body.cached,'body edit reuses native fields');const bi=M.deviceIV(body.frames.at(-1),'mosfet');assert(bi.available);assert.notEqual(bi.threshold,iv.threshold,'body density response');
 const weak=structuredClone(steps);for(const s of weak)if(I.applicable(s))s.params.dose*=.5;
 const sd=await calc({target:'mosfet',steps:weak,substrateDoping:{type:'n',concentration:1e16},polyGateDoping:{type:'p',concentration:1e20}}),si=M.deviceIV(sd.frames.at(-1),'mosfet');assert(si.available,si.reason);assert.notDeepEqual(si.points,iv.points,'S/D density response');
 assert.equal((await request('/api/reference/mosfet')).polyGateDoping.type,'n','reference immutable');
 console.log('PASS real API: PMOS, automatic gate default, independent gate/body/S-D concentration, immutable references');
})().catch(e=>{console.error(e);process.exitCode=1});
