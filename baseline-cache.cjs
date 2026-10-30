'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{modelHash,hash}=require('./demo-cache.cjs'),Recipe=require('./web/recipe-state.js');
function create(root){
 let manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(root,'baseline-results/manifest.json')));if(manifest.version!==1||manifest.modelHash!==modelHash(root))return ()=>null;}catch{return ()=>null;}
 const ops=JSON.parse(fs.readFileSync(path.join(root,'reverse-catalog.json'))).operations,loaded=new Map();
 return (input,flow=true)=>{
  if(!flow){
   const entry=manifest.entries.find(e=>e.target===input.example);
   if(!entry?.observation||Object.keys(input.stages||{}).length)return null;
   if(Object.keys(input.params||{}).length!==Object.keys(entry.observation.params).length||Object.entries(entry.observation.params).some(([k,v])=>input.params[k]!==v))return null;
   const key='observation:'+entry.target;
   if(!loaded.has(key))try{const bytes=fs.readFileSync(path.join(root,'references',entry.target+'.json'));if(hash(bytes.toString('utf8').replace(/\r\n/g,'\n'))!==entry.observation.sha256)return null;const data=JSON.parse(bytes);if(data.failure||data.frames.length!==data.steps.length+1)return null;loaded.set(key,data);if(loaded.size>2)loaded.delete(loaded.keys().next().value);}catch{return null;}
   return loaded.get(key);
  }
  if((input.view||'gate')!=='gate'||input.substrateThickness!==undefined||(input.substrateRoughness||0)!==0)return null;
  const entry=manifest.entries.find(e=>e.target===input.target);if(!entry||!Recipe.equivalent(entry.steps,input.steps,ops))return null;
  if(!loaded.has(entry.target))try{const bytes=fs.readFileSync(path.join(root,'baseline-results',entry.file));if(hash(bytes)!==entry.sha256)return null;const data=JSON.parse(zlib.gunzipSync(bytes));if(data.failure||data.frames.length!==input.steps.length+1)return null;loaded.set(entry.target,data);if(loaded.size>2)loaded.delete(loaded.keys().next().value);}catch{return null;}
  return loaded.get(entry.target);
 };
}
module.exports={create};
