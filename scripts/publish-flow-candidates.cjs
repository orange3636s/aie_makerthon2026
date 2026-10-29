'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),dir=path.join(root,'.runtime/flow-candidates');
const L=require('../web/learning-score.js'),R=require('../web/recipe-state.js'),catalog=require('../reverse-catalog.json');
const targets=JSON.parse(fs.readFileSync(path.join(dir,'recipes.json')));
for(const entry of targets){
 const t=catalog.targets.find(t=>t.id===entry.target),reference=JSON.parse(fs.readFileSync(path.join(root,'references',entry.target+'.json')));
 for(const c of entry.candidates){
  const result=c.id==='reference'?reference:JSON.parse(fs.readFileSync(path.join(dir,entry.target+'-'+c.id+'-result.json')));
  if(result.failure||result.frames.length!==result.steps.length+1||R.invalid(result.steps,catalog.operations))throw Error('Invalid candidate '+entry.target+'/'+c.id);
  if(JSON.stringify(result.steps.map(s=>[s.op,s.params]))!==JSON.stringify(c.steps.map(s=>[s.op,s.params])))throw Error('Stale calculation '+entry.target+'/'+c.id);
  const score=L.assess(reference.frames.at(-1),result.frames.at(-1),t.roi,t,reference.steps,result.steps);
  c.metrics={geometry:score.components.geometry,cd:score.components.cd,doping:score.components.doping??null,eligible:score.eligible,score:score.score,cost:score.actualCost,knownSeconds:score.actualResources.knownSeconds,partial:score.actualResources.partial};
  c.verification={engine:result.engine,failure:null,frames:result.frames.length,resultHash:crypto.createHash('sha256').update(JSON.stringify(result.frames.at(-1))).digest('hex')};
 }
 console.log(entry.target,entry.candidates.map(c=>c.id+':'+c.metrics.score+(c.metrics.eligible?' PASS':' CHECK')).join(' '));
}
fs.writeFileSync(path.join(root,'flow-candidates.json'),JSON.stringify({version:1,targets}));
console.log('Published',targets.length*3,'verified recipe entries');
