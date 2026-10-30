'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process'),{hash,modelHash}=require('../demo-cache.cjs'),M=require('../web/defect-lab-models.js');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'demo-results'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),reference=require('../references/mosfet.json');
if(manifest.modelHash!==modelHash(root))throw Error('Rebuild main demos before defect cases');
for(const item of M.cases){
 const candidate=M.recipe(item.id,reference),tmp=fs.mkdtempSync(path.join(root,'.runtime/defect-')),input=path.join(tmp,'input.json'),out=path.join(tmp,'result.json');
 fs.writeFileSync(input,JSON.stringify({target:'mosfet',view:'gate',steps:candidate.steps}));
 execFileSync(path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python'),['-u',path.join(root,'reverse_engine.py'),input,out],{cwd:tmp,timeout:180000,maxBuffer:8*1024*1024,windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8',OMP_NUM_THREADS:'1'}});
 const result=JSON.parse(fs.readFileSync(out));if(result.failure||result.frames.length!==candidate.steps.length+1)throw Error('Incomplete case '+item.id);
 const file=candidate.id+'.json.gz',bytes=zlib.gzipSync(JSON.stringify(result),{level:9});fs.writeFileSync(path.join(dir,file),bytes);
 manifest.entries=manifest.entries.filter(e=>e.id!==candidate.id);manifest.entries.push({id:candidate.id,name:item.title,file,sha256:hash(bytes),steps:candidate.steps,params:reference.params,frames:result.frames.length});
 console.log(item.id,result.frames.length+' frames',result.elapsed+' s');
}
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
