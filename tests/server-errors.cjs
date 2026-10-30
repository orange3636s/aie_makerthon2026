// Isolated Vercel-style synchronous server; no external AI requests or credentials.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),path=require('node:path');
const base='http://127.0.0.1:3013',delay=ms=>new Promise(r=>setTimeout(r,ms));let count=0;
const server=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),windowsHide:true,stdio:'ignore',env:{...process.env,SIMULATION_PORT:'3013',PORT:'3013',HOST:'127.0.0.1',SIMULATION_SYNC:'1',GEMINI_API_KEY:'',API_PROXY_SECRET:''}});
async function post(route,data,status){const r=await fetch(base+route,{method:'POST',body:JSON.stringify(data),signal:AbortSignal.timeout(60000)}),body=await r.json();assert.equal(r.status,status,JSON.stringify(body));count++;return body}
(async()=>{try{
 let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break}catch{}await delay(100)}assert(ready);
 for(const route of ['/api/run','/api/reverse','/api/analyze','/api/classify'])for(const data of [null,[],false])await post(route,data,400);
 for(let i=0;i<7;i++)await post('/api/classify',{image:'not an image'},400);
 await post('/api/classify',{image:'data:image/png;base64,YQ=='},400);
 await post('/api/classify',{image:require('./image-fixture.cjs')},503);
 const recipe=require('../reverse-catalog.json').targets.find(t=>t.id==='mosfet').recipe;
 const input={target:'mosfet',steps:recipe,substrateThickness:.61};
 const first=post('/api/reverse',input,200);await delay(150);
 const second=await post('/api/reverse',{target:'sti',steps:[],substrateThickness:.61},429);assert(second.error.includes('계산 중'));
 assert.equal((await first).result.failure,null);
 assert.equal((await post('/api/reverse',input,200)).result.cached,true);
 console.log(`${count} synchronous HTTP scenarios passed (malformed bodies, invalid images, missing AI key, concurrency and cache)`);
}finally{server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
