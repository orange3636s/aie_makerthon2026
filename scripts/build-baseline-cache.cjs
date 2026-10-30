'use strict';
// Fresh native runs, never re-label old artifacts as a newer solver version.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process');
const {modelHash,hash}=require('../demo-cache.cjs'),root=path.resolve(__dirname,'..'),dir=path.join(root,'baseline-results');
fs.mkdirSync(dir,{recursive:true});const entries=[],timings=[];
for(const target of require('../reverse-catalog.json').targets){
 const tmp=fs.mkdtempSync(path.join(root,'.runtime/baseline-')),src=path.join(tmp,'input.json'),out=path.join(tmp,'result.json');
 fs.writeFileSync(src,JSON.stringify({target:target.id,steps:target.recipe}));const start=Date.now();
 execFileSync(path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python'),[path.join(root,'reverse_engine.py'),src,out],{cwd:tmp,timeout:180000,windowsHide:true,maxBuffer:4e6});
 const result=JSON.parse(fs.readFileSync(out));if(result.failure||result.frames.length!==target.recipe.length+1)throw Error(target.id+': '+JSON.stringify(result.failure));
 if(result.frames.some(f=>f.polygons.some(p=>!p.closed)))throw Error(target.id+': open geometry');
 const file=target.id+'.json.gz',bytes=zlib.gzipSync(JSON.stringify(result),{level:9});fs.writeFileSync(path.join(dir,file),bytes);
 entries.push({target:target.id,file,sha256:hash(bytes),steps:result.steps});
 const row={id:target.id,frames:result.frames.length,computeSeconds:result.elapsed,wallSeconds:(Date.now()-start)/1000,kb:Math.round(bytes.length/1024)};timings.push(row);console.log(JSON.stringify(row));
 fs.writeFileSync(path.join(root,'.runtime/native-performance-final.json'),JSON.stringify(timings,null,2));
 fs.rmSync(tmp,{recursive:true,force:true});
}
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({version:1,modelHash:modelHash(root),entries},null,2));
