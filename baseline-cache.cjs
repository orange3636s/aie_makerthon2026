'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{modelHash,hash}=require('./demo-cache.cjs'),Recipe=require('./web/recipe-state.js');
function create(root){
 let manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(root,'baseline-results/manifest.json')));if(manifest.version!==1||manifest.modelHash!==modelHash(root))return ()=>null;}catch{return ()=>null;}
 const {operations:ops,targets}=JSON.parse(fs.readFileSync(path.join(root,'reverse-catalog.json'))),loaded=new Map();
 const boundsById=new Map(targets.map(t=>[t.id,t.bounds]));
 function matchesPrefix(steps,requested){
  return requested.length>0&&requested.length<=steps.length&&Recipe.equivalent(steps.slice(0,requested.length),requested,ops);
 }
 function throughStep(data,count,id){
  if(count===data.steps.length)return data;
  const frames=data.frames.slice(0,count+1).map((frame,i)=>({...frame,progress:i/count}));
  const bounds=[...boundsById.get(id)];
  bounds[2]=Math.min(bounds[2],...frames.map(f=>f.lowest-.08));
  bounds[3]=Math.max(bounds[3],...frames.map(f=>f.highest+.08));
  return {...data,steps:data.steps.slice(0,count),frames,bounds,previewFrame:count,elapsed:0};
 }
 function observation(entry){
  if(!entry?.observation)return null;
  const key='observation:'+entry.target;
  if(!loaded.has(key))try{const bytes=fs.readFileSync(path.join(root,'references',entry.target+'.json'));if(hash(bytes.toString('utf8').replace(/\r\n/g,'\n'))!==entry.observation.sha256)return null;const data=JSON.parse(bytes);if(data.failure||data.frames.length!==data.steps.length+1)return null;loaded.set(key,data);if(loaded.size>2)loaded.delete(loaded.keys().next().value);}catch{return null;}
  return loaded.get(key);
 }
 return (input,flow=true)=>{
  if(!flow){
   const entry=manifest.entries.find(e=>e.target===input.example);
   if(!entry?.observation||Object.keys(input.stages||{}).length)return null;
   if(Object.keys(input.params||{}).length!==Object.keys(entry.observation.params).length||Object.entries(entry.observation.params).some(([k,v])=>input.params[k]!==v))return null;
   return observation(entry);
  }
  if((input.view||'gate')!=='gate'||input.substrateThickness!==undefined||(input.substrateRoughness||0)!==0)return null;
  const entry=manifest.entries.find(e=>e.target===input.target);if(!entry)return null;
  if(!matchesPrefix(entry.steps,input.steps)){
   // Observation recipes may express the same etch depth with different rate/time
   // pairs. Reuse only their own verified, exactly matching native result.
   const ref=observation(entry);return ref&&matchesPrefix(ref.steps,input.steps)?throughStep(ref,input.steps.length,entry.target):null;
  }
  if(!loaded.has(entry.target))try{const bytes=fs.readFileSync(path.join(root,'baseline-results',entry.file));if(hash(bytes)!==entry.sha256)return null;const data=JSON.parse(zlib.gunzipSync(bytes));if(data.failure||data.frames.length!==entry.steps.length+1)return null;loaded.set(entry.target,data);if(loaded.size>2)loaded.delete(loaded.keys().next().value);}catch{return null;}
  return throughStep(loaded.get(entry.target),input.steps.length,entry.target);
 };
}
module.exports={create};
