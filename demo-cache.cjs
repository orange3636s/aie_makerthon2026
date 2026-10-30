'use strict';
// Only exact, versioned demo recipes may bypass the native solver.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),Recipe=require('./web/recipe-state.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function modelHash(root){
 const files=fs.readdirSync(root).filter(f=>/\.(py|csv)$/.test(f)).concat(['reverse-catalog.json','catalog.json','flow-candidates.json','references/mosfet.json','web/recipe-state.js','web/ui-contract.js','requirements.txt']).sort();
 return hash(files.map(f=>f+'\0'+hash(fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'))).join('\n'));
}
function create(root){
 let manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(root,'demo-results/manifest.json')));if(manifest.version!==1||manifest.modelHash!==modelHash(root))return {find:()=>null,candidate:()=>null};}catch{return {find:()=>null,candidate:()=>null};}
 const operations=JSON.parse(fs.readFileSync(path.join(root,'reverse-catalog.json'))).operations,loaded=new Map();
 function read(entry){try{if(!loaded.has(entry.id)){const buffer=fs.readFileSync(path.join(root,'demo-results',entry.file));if(hash(buffer)!==entry.sha256)return null;const result=JSON.parse(zlib.gunzipSync(buffer));if(result.failure||result.frames.length!==result.steps.length+1)return null;loaded.set(entry.id,result);}return loaded.get(entry.id);}catch{return null;}}
 function find(input,flow){
  if(flow){if(input.target!=='mosfet'||(input.view||'gate')!=='gate'||input.substrateThickness!==undefined||(input.substrateRoughness||0)!==0)return null;
   const entry=manifest.entries.find(e=>Recipe.equivalent(e.steps,input.steps,operations));return entry?read(entry):null;
  }
  const entry=manifest.entries[0];if(input.example!=='mosfet'||Object.keys(input.stages||{}).length||Object.keys(input.params||{}).length!==Object.keys(entry.params).length||Object.keys(entry.params).some(k=>input.params[k]!==entry.params[k]))return null;
  return read(entry);
 }
 return {find,candidate:id=>{const e=manifest.entries.find(e=>e.id===id);return e?read(e):null;}};
}
module.exports={create,modelHash,hash};
