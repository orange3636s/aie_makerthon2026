'use strict';
// Real HTTP/native process recalculation, not electrical input sliders.
// Saved frames are keyed by the complete submitted recipe; --fresh bypasses them.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const M=require('../web/learning-lab-models'),catalog=require('../reverse-catalog.json');
const base=process.env.QA_BASE||'http://127.0.0.1:3034',dir='.runtime/iv-process';fs.mkdirSync(dir,{recursive:true});
const engineHash=require('../demo-cache.cjs').modelHash(process.cwd());
const ids=process.env.IV_IDS?process.env.IV_IDS.split(','):M.electricalDevices;
const report=dir+'/'+(process.env.IV_IDS?'results-'+ids[0]:'results')+(process.env.IV_VARIANTS?'-'+process.env.IV_VARIANTS:'')+'.json';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function request(route,data){
 for(let n=0;n<8;n++){
  const r=await fetch(base+route,{signal:AbortSignal.timeout(180000),...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
  if(r.status===429){await delay(45000);continue;}
  const body=await r.json();assert(r.ok,JSON.stringify(body));return body;
 }throw Error('Rate limited');
}
async function simulate(payload){
 const key=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),file=dir+'/'+key+'.json';
 if(fs.existsSync(file)&&!process.argv.includes('--fresh')){const saved=JSON.parse(fs.readFileSync(file));if(saved.engineHash===engineHash)return saved;}
 const started=Date.now(),job=await request('/api/reverse',payload);let result=job.result;
 for(let i=0;!result&&i<240;i++){
  await delay(1000);const state=await request('/api/jobs/'+job.job);
  assert(!['error','cancelled'].includes(state.state),state.error||state.state);if(state.state==='done')result=state.result;
 }
 assert(result,'Native timeout');assert.equal(result.failure,null,JSON.stringify(result.failure));
 const record={key,engineHash,seconds:(Date.now()-started)/1000,cached:!!result.cached,frame:result.frames.at(-1)};
 fs.writeFileSync(file,JSON.stringify(record));return record;
}
function currents(r){return r.series.map(s=>s.points.at(-1)[1]);}
(async()=>{
 const results=[];
 for(const id of ids){
  const t=catalog.targets.find(t=>t.id===id),variants={baseline:structuredClone(t.recipe)};
  variants.dose=structuredClone(t.recipe);for(const s of variants.dose)if(s.op==='diffusion'&&s.params.method==='Ion implantation')s.params.dose*=2;
  variants.anneal=structuredClone(t.recipe);for(const s of variants.anneal)if(s.op==='diffusion'&&s.params.method==='Anneal')s.params.time=1;
  variants.oxide=structuredClone(t.recipe);
  if(id==='pn-junction'){
   // A passivation oxide must not masquerade as a MOS gate capacitor.
   const s=variants.oxide.find(s=>s.op==='deposition'&&s.params.material==='SiO2');s.params.time*=1.25;
  }else{
   for(const s of variants.oxide)if(s.op==='deposition'&&((s.params.material==='SiO2'&&s.params.method==='ALD')||s.params.material==='HfO2')){
    if(s.params.method==='ALD')s.params.cycles+=10;else s.params.time*=1.5;
   }
  }
  let baseline;
  for(const [variant,steps] of Object.entries(variants)){
   if(process.env.IV_VARIANTS&&variant!=='baseline'&&!process.env.IV_VARIANTS.split(',').includes(variant))continue;
   const record=await simulate({target:id,steps,substrateThickness:.501});
   const r=M.deviceIV(record.frame,id),row={id,variant,key:record.key,seconds:record.seconds,cached:record.cached,available:r.available,reason:r.reason,facts:r.facts};
   if(r.available)row.currentMicroA=currents(r);
   if(variant==='baseline'){assert(r.available,id+': '+r.reason);baseline=r;}
   else if(r.available){
    row.changePercent=currents(r).map((v,i)=>100*(v/currents(baseline)[i]-1));
    if(variant==='dose'||variant==='anneal'||id!=='pn-junction')assert(row.changePercent.every(v=>Math.abs(v)>1e-5),id+' '+variant+' curve unchanged');
    else assert(row.changePercent.every(v=>Math.abs(v)<.01),'PN passivation must not be a gate');
   }else assert(variant==='anneal',id+' '+variant+': '+r.reason);
   results.push(row);fs.writeFileSync(report,JSON.stringify(results,null,2));console.log(JSON.stringify(row));
  }
 }
 console.log('PASS: '+results.length+' native cases across '+ids.length+' devices.');
})().catch(e=>{console.error(e);process.exitCode=1;});
