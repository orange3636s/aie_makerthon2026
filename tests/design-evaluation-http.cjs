// Local-only smoke test. One explicitly requested AI analysis, if configured.
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../web/recipe-studio.js'),L=require('../web/learning-score.js');
const base=process.env.TEST_URL||'http://127.0.0.1:3024';
async function get(url,options){const r=await fetch(base+url,options),d=await r.json();if(!r.ok)throw Error(r.status+' '+d.error);return d}
const post=(url,body)=>get(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
(async()=>{
 const catalog=await get('/api/reverse-catalog'),config=await get('/api/config');
 for(const target of catalog.targets){const entry=await get('/api/flow-candidates/'+target.id);assert.equal(entry.candidates.length,3)}
 const reference=await get('/api/reference/mosfet'),target=catalog.targets.find(t=>t.id==='mosfet');
 const steps=reference.steps.filter(s=>s.op!=='diffusion');
 const input={target:'mosfet',steps};const job=await post('/api/reverse',input);let result;
 for(let i=0;i<150;i++){
  const status=await get('/api/jobs/'+job.job);
  if(status.state==='error')throw Error(status.error);
  if(status.state==='done'){result=status.result;break;}
  await new Promise(r=>setTimeout(r,1000));
 }
 assert(result&&!result.failure,'native calculation failed');
 const score=L.assess(reference.frames.at(-1),result.frames.at(-1),target.roi,target,reference.steps,result.steps);
 assert(!score.eligible&&score.score<100,'missing doping must fail');
 let ai={tested:false};
 if(config.processAnalysis){
  try{
   const report=await post('/api/analyze',input),q=D.designQuestion(score,report);
   assert(report.ai.suggestions.length);assert.equal(q.choices.length,5);
   assert(report.findings.some(f=>f.id===q.findingId));
   assert.equal(report.numericalEvidence.status,'server-verified');
   ai={tested:true,success:true,findingId:q.findingId,choices:q.choices.length};
  }catch(e){ai={tested:true,success:false,error:e.message};}
 }
 const summary={candidateTargets:catalog.targets.length,nativeFrames:result.frames.length,missingDopingScore:score.score,ai};
 fs.writeFileSync('.runtime/design-evaluation-http.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
})().catch(e=>{console.error(e.message);process.exitCode=1});
