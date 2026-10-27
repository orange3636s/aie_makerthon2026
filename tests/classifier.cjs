// Contract tests only: a local mock replaces the external AI service.
// These never claim image-recognition accuracy or use a paid API key.
const http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path');
let answer={target:'sti',confidence:.9},badJSON=false,status=200,seen;
const mock=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;seen=JSON.parse(body);res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({output:[{content:[{type:'output_text',text:badJSON?'garbled':JSON.stringify(answer)}]}]}))});
(async()=>{
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));
 const child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'3005',HOST:'127.0.0.1',OPENAI_API_KEY:'local-contract-test-only',OPENAI_BASE_URL:`http://127.0.0.1:${mock.address().port}`,API_PROXY_SECRET:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',code=>reject(Error('test server exited '+code)));child.once('error',reject)});
  let n=0;async function classify(expected){const r=await fetch('http://127.0.0.1:3005/api/classify',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'qa-'+(++n)},body:JSON.stringify({image:'data:image/png;base64,aA=='})});const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;}
  assert.equal((await classify(200)).target,'sti');assert.equal(seen.store,false);
  answer={target:'unknown',confidence:.2};assert.equal((await classify(200)).target,'unknown');
  answer={target:'sti',confidence:2};await classify(400);
  answer={target:'unsupported',confidence:.9};await classify(400);
  badJSON=true;await classify(400);badJSON=false;status=503;await classify(400);
  console.log('6 AI API contract scenarios passed; external vision accuracy NOT tested');
 }finally{child.kill();await new Promise(r=>mock.close(r));}
})().catch(e=>{console.error(e);mock.close();process.exitCode=1});
