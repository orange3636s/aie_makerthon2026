'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFile}=require('node:child_process');
const root=__dirname;
const RecipeState=require('./web/recipe-state.js');
const ProcessReview=require('./web/process-review.js'), Gemini=require('./gemini.cjs');
const runtimeRoot=path.join(require('node:os').tmpdir(),'simulation-runtime');
const zlib=require('node:zlib');
if(process.loadEnvFile&&fs.existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const port=Number(process.env.PORT||process.env.SIMULATION_PORT||3001),host=process.env.HOST||'127.0.0.1';
const localPython=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const python=process.env.SIMULATION_PYTHON||(fs.existsSync(localPython)?localPython:process.platform==='win32'?'python':'python3');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'))),reverse=JSON.parse(fs.readFileSync(path.join(root,'reverse-catalog.json')));
const jobs=new Map(),cache=new Map(),queue=[],limits=new Map(),waiters=new Map();let running=false,aiToday=0,aiDay='';
const assets={'/':'index.html','/tutorial':'parameters.html','/challenge':'index.html'};
for(const f of ['index.html','app.js','style.css','materials.js','ui-contract.js','design-guide.js','simulation-editor.js','extrusion.js','parameters.html','tutorial.js','process-guide.js','tutorial-guide.js','reverse.js','reverse.css','grading.js','recipe-state.js','process-review.js'])assets['/'+f]=f;
if(host==='127.0.0.1'){assets['/qa.html']='qa.html';assets['/qa.js']='qa.js';assets['/qa-frame.html']='qa-frame.html';}
function send(res,status,data,type='application/json; charset=utf-8'){
 let body=Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data));if(res.canGzip&&body.length>32000){body=zlib.gzipSync(body);res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding')}
 res.writeHead(status,{'Content-Type':type,'Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"});res.end(body);
}
function httpError(status,message){return Object.assign(Error(message),{status})}
function rate(ip,kind,max,windowMs){const key=ip+kind,now=Date.now();let r=limits.get(key);if(!r||now-r.at>windowMs)limits.set(key,r={at:now,n:0});if(++r.n>max)throw httpError(429,'요청이 많습니다. 잠시 후 다시 시도하세요.');if(limits.size>1000)limits.delete(limits.keys().next().value)}
function fields(spec,given={}){if(!given||typeof given!=='object'||Array.isArray(given)||Object.keys(given).some(k=>!spec.some(f=>f.key===k)))throw Error('지원하지 않는 조건입니다.');return Object.fromEntries(spec.map(f=>{const v=Object.hasOwn(given,f.key)?given[f.key]:f.default;if(f.options?!f.options.includes(v):typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max)throw Error(f.label+': 값의 범위를 확인하세요.');if(['cycles','layers','sheets'].includes(f.key)&&!Number.isInteger(v))throw Error('횟수는 정수여야 합니다.');return[f.key,v]}))}
function phaseValues(id,params,given){
 if(given===undefined)return {};
 if(id!=='bosch'||!given||typeof given!=='object'||Array.isArray(given))throw Error('지원하지 않는 단계 조건입니다.');
 for(const [key,value] of Object.entries(given)){
  const i=Number(key),phase=(i-2)%3,min=i===1||phase===2?.2:.03,max=i===1||phase===2?2:phase===0?.15:.25;
  if(!Number.isInteger(i)||String(i)!==key||i<1||i>1+params.cycles*3||typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('단계 조건의 범위를 확인하세요.');
 }return given;
}
function validate(data,flow){if(flow){if(!reverse.targets.some(t=>t.id===data?.target)||!Array.isArray(data.steps)||data.steps.length>64)throw Error('목표와 최대 64개 공정을 확인하세요.');if(data.view&&data.view!=='gate'&&!reverse.targets.find(t=>t.id===data.target).sections?.[data.view])throw Error('지원하지 않는 단면입니다.');return{target:data.target,view:data.view||'gate',steps:data.steps.map(s=>{const o=reverse.operations.find(o=>o.id===s?.op);if(!o)throw Error('지원하지 않는 공정입니다.');if(s.params!==undefined&&(!s.params||typeof s.params!=='object'||Array.isArray(s.params)))throw Error('지원하지 않는 조건입니다.');if(s.label!==undefined&&(typeof s.label!=='string'||s.label.length>80))throw Error('공정 이름은 80자 이내입니다.');return{op:o.id,params:fields(o.fields,{...RecipeState.defaults(o,s.params?.method),...s.params}),...(s.label?{label:s.label}:{})}})}}const s=catalog.examples.find(s=>s.id===data?.example);if(!s)throw Error('예제를 선택하세요.');const params=fields(s.fields,data.params);return{example:s.id,params,stages:phaseValues(s.id,params,data.stages)}}
function pump(){if(running||!queue.length)return;running=true;const task=queue.shift(),{id,input,key,engine}=task;const dir=path.join(runtimeRoot,id);fs.mkdirSync(dir,{recursive:true});const src=path.join(dir,'input.json'),out=path.join(dir,'result.json');fs.writeFileSync(src,JSON.stringify(input));jobs.set(id,{state:'running'});
 execFile(python,['-u',path.join(root,engine),src,out],{cwd:dir,env:{...process.env,PYTHONIOENCODING:'utf-8',OMP_NUM_THREADS:'1'},timeout:150000,maxBuffer:8*1024*1024,windowsHide:true},(error,stdout,stderr)=>{
  try{if(error)throw Error(error.killed?'계산 제한 시간(150초)을 넘었습니다. 조건을 줄여 주세요.':'계산을 완료하지 못했습니다. 공정 조건을 확인하세요.');const result=JSON.parse(fs.readFileSync(out));result.cached=false;if(!result.failure){cache.set(key,result);if(cache.size>6)cache.delete(cache.keys().next().value)}jobs.set(id,{state:'done',result});}catch(e){jobs.set(id,{state:'error',error:e.message});console.error('solver',id,(stderr||'').slice(-400))}finally{if(waiters.has(id)){const response=waiters.get(id),job=jobs.get(id);waiters.delete(id);if(!response.destroyed)send(response,job.state==='done'?200:422,job)}running=false;fs.rm(dir,{recursive:true,force:true},()=>{});pump()}
 });
}
function consumeAI(ip,kind){if(!process.env.GEMINI_API_KEY)throw httpError(503,'AI API 키가 연결되지 않았습니다.');rate(ip,kind,5,3600000);const today=new Date().toISOString().slice(0,10);if(aiDay!==today){aiDay=today;aiToday=0}if(aiToday>=Number(process.env.LLM_DAILY_LIMIT||20))throw httpError(429,'오늘의 AI 분석 한도에 도달했습니다.');aiToday++}
async function analyze(data,ip){
 const input=validate(data,true),base=reverse.targets.find(t=>t.id===input.target),target=input.view==='gate'?base:{...base,...base.sections[input.view]};
 const concise=rows=>rows.map(s=>{const op=reverse.operations.find(o=>o.id===s.op),p={...RecipeState.defaults(op,s.params?.method),...s.params};return{op:s.op,label:s.label,params:Object.fromEntries(op.fields.filter(f=>!f.when||Object.entries(f.when).every(([k,vs])=>vs.includes(p[k]))).map(f=>[f.key,p[f.key]]))}});
 const report={referenceFlow:concise(target.recipe),actualFlow:concise(input.steps),target:target.title,section:target.section,scope:target.assumptions||'공정 학습 단면; 전기 동작 검증 제외',...ProcessReview.compare(target,input.steps,reverse.operations)};
 consumeAI(ip,'review');
 const explanation=await Gemini.explain(report);
 return {...report,ai:explanation};
}
const server=http.createServer(async(req,res)=>{
 res.canGzip=/gzip/.test(req.headers['accept-encoding']||'');let route;try{route=new URL(req.url,'http://localhost').pathname}catch{return send(res,400,{error:'잘못된 주소입니다.'})}const ip=req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket.remoteAddress;
 if(process.env.API_PROXY_SECRET&&route.startsWith('/api/')&&route!='/api/health'&&req.headers['x-simulation-proxy']!==process.env.API_PROXY_SECRET)return send(res,403,{error:'접근할 수 없습니다.'});
 if(req.method==='GET'){
  if(route==='/api/health')return send(res,200,{ok:true,app:'ProcessTrace',version:'2.0'});
  if(route==='/api/config')return send(res,200,{imageAnalysis:!!process.env.GEMINI_API_KEY,processAnalysis:!!process.env.GEMINI_API_KEY,analysisModel:process.env.GEMINI_MODEL||'gemini-3.5-flash-lite'});
  if(route==='/api/catalog')return send(res,200,catalog);
  if(route==='/api/reverse-catalog')return send(res,200,reverse);
  if(/^\/api\/reference\/[a-z][a-z0-9-]*$/.test(route)){const id=route.split('/').at(-1);if(!reverse.targets.some(t=>t.id===id))return send(res,404,{error:'목표 없음'});const view=new URL(req.url,'http://localhost').searchParams.get('view')||'gate';if(view!=='gate'&&!reverse.targets.find(t=>t.id===id).sections?.[view])return send(res,400,{error:'지원하지 않는 단면'});const f=path.join(root,'references',id+(view==='gate'?'':'-'+view)+'.json');if(fs.existsSync(f))return send(res,200,fs.readFileSync(f));return send(res,503,{error:'목표 계산 결과를 준비하고 있습니다.'})}
  if(route.startsWith('/api/jobs/')){const job=jobs.get(route.split('/').at(-1));return send(res,job?200:404,job||{error:'결과가 만료됐습니다. 다시 실행하세요.'})}
  const file=assets[route];if(file&&fs.existsSync(path.join(root,'web',file))){const ext=path.extname(file),type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[ext];return send(res,200,fs.readFileSync(path.join(root,'web',file)),type)}return send(res,404,{error:'Not found'});
 }
 if(req.method!=='POST'||!['/api/run','/api/reverse','/api/analyze','/api/classify'].includes(route))return send(res,404,{error:'Not found'});
 if(req.headers.origin){let own;try{own=new URL(req.headers.origin).host}catch{return send(res,403,{error:'잘못된 Origin'})}const allowed=(process.env.ALLOWED_ORIGINS||'').split(',');if(own!==req.headers.host&&!allowed.includes(req.headers.origin)&&!(process.env.API_PROXY_SECRET&&req.headers['x-simulation-proxy']===process.env.API_PROXY_SECRET))return send(res,403,{error:'허용되지 않은 요청입니다.'})}
 let chunks=[],size=0,large=false;req.on('data',chunk=>{size+=chunk.length;if(size>(route==='/api/classify'?4300000:48000)){if(!large){large=true;send(res,413,{error:'입력이 너무 큽니다.'})}chunks=[]}else if(!large)chunks.push(chunk)});
 req.on('end',async()=>{if(large)return;try{const data=JSON.parse(Buffer.concat(chunks).toString());chunks=[];if(!data||typeof data!=='object'||Array.isArray(data))throw Error('JSON 객체로 요청하세요.');if(route==='/api/analyze')return send(res,200,await analyze(data,ip));if(route==='/api/classify'){Gemini.validateImage(data.image);consumeAI(ip,'image');return send(res,200,await Gemini.classify(data.image,catalog.examples))}const flow=route==='/api/reverse',input=validate(data,flow),engine=flow?'reverse_engine.py':'engine.py',key=JSON.stringify([engine,input]),id=crypto.randomUUID();
   if(cache.has(key)){const cached={state:'done',result:{...cache.get(key),cached:true}};if(process.env.SIMULATION_SYNC==='1')return send(res,200,cached);jobs.set(id,cached)}else{rate(ip,'run',30,300000);if(queue.length>=4)return send(res,429,{error:'계산 대기열이 가득 찼습니다. 잠시 후 실행하세요.'});jobs.set(id,{state:'queued'});if(process.env.SIMULATION_SYNC==='1'){if(running){jobs.delete(id);return send(res,429,{error:'계산 중입니다. 잠시 후 다시 실행하세요.'})}waiters.set(id,res)}queue.push({id,input,key,engine});pump()}
   if(jobs.size>15){const old=[...jobs].find(([,v])=>['done','error'].includes(v.state));if(old)jobs.delete(old[0])}if(!waiters.has(id))send(res,202,{job:id});
  }catch(e){send(res,e.status||400,{error:e instanceof SyntaxError?'올바른 JSON 형식이 아닙니다.':e.message})}});
});
server.listen(port,host,()=>console.log(`ProcessTrace ready: http://${host}:${port}`));
