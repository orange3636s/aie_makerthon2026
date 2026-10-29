'use strict';
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),crypto=require('node:crypto');
const base='http://127.0.0.1:3014',delay=ms=>new Promise(r=>setTimeout(r,ms));
const server=spawn(process.execPath,['server.cjs'],{cwd:require('node:path').join(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'3014',HOST:'127.0.0.1',SIMULATION_SYNC:'1',GEMINI_API_KEY:'',API_PROXY_SECRET:''}});
let ready=false;server.stdout.on('data',s=>{if(String(s).includes('ProcessTrace ready:'))ready=true});server.stderr.on('data',()=>{});
const post=async(route,body)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(150000)});return{status:r.status,data:await r.json()}};
(async()=>{try{
 for(let i=0;i<80&&!ready;i++){assert(server.exitCode===null,'test server exited before readiness');await delay(100)}assert(ready);
 const id=crypto.randomUUID(),target=require('../reverse-catalog.json').targets.find(t=>t.id==='cfet');
 const running=post('/api/reverse',{target:'cfet',steps:target.recipe,requestId:id});await delay(300);
 const cancelled=await post('/api/cancel',{job:id});assert.equal(cancelled.data.cancelled,true);
 const result=await running;assert.equal(result.data.state,'cancelled');
 const next=await post('/api/reverse',{target:'sti',steps:[]});assert.equal(next.status,200);assert.equal(next.data.result.failure,null);assert.equal(next.data.result.frames.length,1);
 console.log('Native CFET cancellation and immediate next calculation passed');
 }finally{server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
