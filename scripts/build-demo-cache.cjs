'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process'),{modelHash,hash}=require('../demo-cache.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'demo-results');fs.mkdirSync(dir,{recursive:true});
const candidates=require('../flow-candidates.json').targets.find(t=>t.target==='mosfet').candidates;
const python=process.env.SIMULATION_PYTHON||path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const reference=require('../references/mosfet.json'),entries=[];
for(const c of candidates){
 let result=reference;
 if(c.id!=='reference'){
  const tmp=fs.mkdtempSync(path.join(root,'.runtime/demo-')),input=path.join(tmp,'input.json'),out=path.join(tmp,'result.json');
  fs.writeFileSync(input,JSON.stringify({target:'mosfet',view:'gate',steps:c.steps}));
  execFileSync(python,['-u',path.join(root,'reverse_engine.py'),input,out],{cwd:tmp,timeout:150000,maxBuffer:8*1024*1024,windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8',OMP_NUM_THREADS:'1'}});
  result=JSON.parse(fs.readFileSync(out));
 }
 if(result.failure||result.frames.length!==c.steps.length+1)throw Error('Incomplete demo '+c.id);
 const file=c.id+'.json.gz',bytes=zlib.gzipSync(JSON.stringify(result),{level:9});fs.writeFileSync(path.join(dir,file),bytes);
 entries.push({id:c.id,name:c.name,file,sha256:hash(bytes),steps:c.steps,params:reference.params,frames:result.frames.length});
 console.log(c.id,result.frames.length+' frames',Math.round(bytes.length/1024)+' KB');
}
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({version:1,modelHash:modelHash(root),createdAt:new Date().toISOString(),entries},null,2));
