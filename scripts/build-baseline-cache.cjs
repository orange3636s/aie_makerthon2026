'use strict';
// Fresh native runs, never re-label old artifacts as a newer solver version.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process');
const {modelHash,hash}=require('../demo-cache.cjs'),root=path.resolve(__dirname,'..'),dir=path.join(root,'baseline-results');
const R=require('../web/recipe-state.js'),operations=require('../reverse-catalog.json').operations;
const useAudited=process.argv.includes('--audited-observations');
const audit=useAudited?JSON.parse(fs.readFileSync(path.join(root,'.runtime/academic-audit/references-report.json'))):[];
fs.mkdirSync(dir,{recursive:true});const entries=[],timings=[];
for(const target of require('../reverse-catalog.json').targets){
 const tmp=fs.mkdtempSync(path.join(root,'.runtime/baseline-')),src=path.join(tmp,'input.json'),out=path.join(tmp,'result.json');
 fs.writeFileSync(src,JSON.stringify({target:target.id,steps:target.recipe}));const start=Date.now();
 const observation=path.join(root,'references',target.id+'.json'),verified=path.join(root,'.runtime/academic-audit',target.id+'.json');
 let reused=false;
 if(useAudited&&audit.some(a=>a.id===target.id)&&fs.existsSync(verified)&&hash(JSON.stringify(JSON.parse(fs.readFileSync(verified))))===hash(JSON.stringify(JSON.parse(fs.readFileSync(observation))))){
  const candidate=JSON.parse(fs.readFileSync(verified)),sourceFiles=fs.readdirSync(root).filter(f=>/\.(py|csv)$/.test(f)).concat(['reverse-catalog.json','catalog.json']);
  const newer=sourceFiles.some(f=>fs.statSync(path.join(root,f)).mtimeMs>fs.statSync(path.join(root,'.runtime/academic-audit',target.id+'-input.json')).mtimeMs);
  if(!newer&&R.equivalent(R.restore(candidate.steps,operations),R.restore(target.recipe,operations),operations)){
   fs.copyFileSync(verified,out);reused=true;
  }
 }
 if(!reused)execFileSync(path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python'),[path.join(root,'reverse_engine.py'),src,out],{cwd:tmp,timeout:240000,windowsHide:true,maxBuffer:4e6});
 const result=JSON.parse(fs.readFileSync(out));if(result.failure||result.frames.length!==target.recipe.length+1)throw Error(target.id+': '+JSON.stringify(result.failure));
 if(result.frames.some(f=>f.polygons.some(p=>!p.closed)))throw Error(target.id+': open geometry');
 const file=target.id+'.json.gz',bytes=zlib.gzipSync(JSON.stringify(result),{level:9});fs.writeFileSync(path.join(dir,file),bytes);
 entries.push({target:target.id,file,sha256:hash(bytes),steps:result.steps});
 const row={id:target.id,frames:result.frames.length,computeSeconds:result.elapsed,wallSeconds:(Date.now()-start)/1000,reusedFreshAudit:reused,kb:Math.round(bytes.length/1024)};timings.push(row);console.log(JSON.stringify(row));
 fs.writeFileSync(path.join(root,'.runtime/native-performance-final.json'),JSON.stringify(timings,null,2));
 fs.rmSync(tmp,{recursive:true,force:true});
}
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({version:1,modelHash:modelHash(root),entries},null,2));
