const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const root=__dirname, port=Number(process.env.SIMULATION_PORT||3001);
const localPython=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const webRoot=fs.existsSync(path.join(root,'web'))?path.join(root,'web'):root;
const python=process.env.SIMULATION_PYTHON||(fs.existsSync(localPython)?localPython:process.platform==='win32'?'python':'python3');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
const jobs=new Map(),cache=new Map();let running=false;
const assets={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8']};
for(const file of ['challenge.html','challenge.css','challenge.js','targets.json','parameters.html'])assets['/'+file]=[file,file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8'];
assets['/challenge']=assets['/challenge.html'];
const flowCatalog=JSON.parse(fs.readFileSync(path.join(root,'flow-catalog.json'),'utf8'));
function validateFlow(data){
 if(!data||!flowCatalog.targets.some(t=>t.id===data.target)||!Array.isArray(data.steps)||data.steps.length>16)throw Error('목표와 최대 16개의 공정 목록을 확인하세요.');
 return {target:data.target,steps:data.steps.map(row=>{const op=flowCatalog.operations.find(o=>o.id===row?.op);if(!op)throw Error('지원하지 않는 공정입니다.');const given=row.params||{},params={};if(typeof given!=='object'||Array.isArray(given)||Object.keys(given).some(k=>!op.fields.some(f=>f.key===k)))throw Error('지원하지 않는 조건입니다.');for(const f of op.fields){const v=given[f.key]??f.default;if(f.options?!f.options.includes(v):typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max)throw Error(f.label+': 값의 범위를 확인하세요.');params[f.key]=v}return {op:op.id,params}})};
}
function send(res,status,value,type='application/json; charset=utf-8'){
 const body=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));
 res.writeHead(status,{'Content-Type':type,'Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"});res.end(body);
}
function validate(data){
 const spec=catalog.examples.find(s=>s.id===data?.example);if(!spec)throw Error('지원하는 예제를 선택해 주세요.');
 const given=data.params||{},params={};if(typeof given!=='object'||Array.isArray(given))throw Error('조건 형식이 올바르지 않습니다.');
 if(Object.keys(given).some(k=>!spec.fields.some(f=>f.key===k)))throw Error('지원하지 않는 조건입니다.');
 for(const f of spec.fields){const value=given[f.key]??f.default;if(typeof value!=='number'||!Number.isFinite(value)||value<f.min||value>f.max)throw Error(`${f.label}: ${f.min}~${f.max} 범위로 입력해 주세요.`);if(['cycles','layers'].includes(f.key)&&!Number.isInteger(value))throw Error('횟수는 정수여야 합니다.');params[f.key]=value;}
 return {example:spec.id,params};
}
function calculate(id,input,key,engine='engine.py'){
 running=true;jobs.set(id,{state:'running'});
 const dir=path.join(root,'.runtime',id);fs.mkdirSync(dir,{recursive:true});
 const src=path.join(dir,'input.json'),out=path.join(dir,'result.json');fs.writeFileSync(src,JSON.stringify(input));
 const env={...process.env,PYTHONIOENCODING:'utf-8',OMP_NUM_THREADS:'2'};delete env.SIMULATION_DEBUG;
 execFile(python,['-u',path.join(root,engine),src,out],{cwd:dir,env,timeout:70000,maxBuffer:8*1024*1024,windowsHide:true},(error,stdout,stderr)=>{
  running=false;const log=(stdout||'')+(stderr||'');fs.writeFileSync(path.join(dir,'solver.log'),log);
  if(error){jobs.set(id,{state:'error',error:error.killed?'70초 계산 한도를 넘었습니다. 조건을 줄여 다시 실행해 주세요.':'계산을 완료하지 못했습니다. 기본 조건으로 초기화한 뒤 다시 실행해 주세요.'});return;}
  try{const result=JSON.parse(fs.readFileSync(out,'utf8'));result.cached=false;result.warnings=log.split('\n').filter(l=>/WARNING|not converg/i.test(l)).slice(0,8);cache.set(key,result);if(cache.size>24)cache.delete(cache.keys().next().value);jobs.set(id,{state:'done',result});}
  catch(e){jobs.set(id,{state:'error',error:'계산 결과를 읽지 못했습니다.'});}
 });
}
const server=http.createServer((req,res)=>{
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return send(res,403,{error:'Local access only'});
 const url=new URL(req.url,`http://127.0.0.1:${port}`),route=url.pathname;
 if(req.method==='GET'){
  if(route==='/api/health')return send(res,200,{ok:true,app:'simulation',engine:'4.6.2'});
  if(route==='/api/catalog')return send(res,200,catalog);
  if(route==='/flow-catalog.json')return send(res,200,flowCatalog);
  if(route.startsWith('/api/jobs/')){const job=jobs.get(route.split('/').at(-1));return send(res,job?200:404,job||{error:'결과를 찾을 수 없습니다.'});}
  if(assets[route]){const [file,type]=assets[route];return send(res,200,fs.readFileSync(path.join(webRoot,file)),type);}
  return send(res,404,{error:'Not found'});
 }
 if(req.method!=='POST'||!['/api/run','/api/flow'].includes(route))return send(res,404,{error:'Not found'});
 if(req.headers.origin&&![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))return send(res,403,{error:'다른 사이트에서 실행할 수 없습니다.'});
 let body='',tooLarge=false;
 req.on('data',chunk=>{body+=chunk;if(body.length>8192&&!tooLarge){tooLarge=true;send(res,413,{error:'입력이 너무 큽니다.'})}});
 req.on('end',()=>{
  if(tooLarge)return;
  try{const engine=route==='/api/flow'?'flow_engine.py':'engine.py',input=(route==='/api/flow'?validateFlow:validate)(JSON.parse(body));if(running)return send(res,409,{error:'계산 중입니다. 완료 후 다시 실행해 주세요.'});const key=JSON.stringify([input,engine,fs.statSync(path.join(root,engine)).mtimeMs,fs.statSync(path.join(root,'engine.py')).mtimeMs]),id=crypto.randomUUID();
   if(cache.has(key))jobs.set(id,{state:'done',result:{...cache.get(key),cached:true}});else calculate(id,input,key,engine);
   if(jobs.size>40)jobs.delete(jobs.keys().next().value);send(res,202,{job:id});
  }catch(e){send(res,400,{error:e.message})}
 });
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`이미 실행 중일 수 있습니다: http://127.0.0.1:${port}`:e.message);process.exit(1)});
server.listen(port,'127.0.0.1',()=>console.log(`simulation ready: http://127.0.0.1:${port} (PID ${process.pid})`));
