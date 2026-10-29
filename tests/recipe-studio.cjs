'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const D=require('../web/recipe-studio.js'),L=require('../web/learning-score.js'),R=require('../web/recipe-state.js'),catalog=require('../reverse-catalog.json');
for(const t of catalog.targets){
 const ref=JSON.parse(fs.readFileSync('references/'+t.id+'.json')),f=ref.frames.at(-1);
 const score=L.assess(f,f,t.roi,t,ref.steps,ref.steps),q=D.question(score);
 assert.equal(q.choices.length,5);assert.equal(q.correct,'supported',t.id);
 assert(D.answer(q,null,'a reason longer than fifteen chars').error);
 assert(D.answer(q,q.correct,'short').error);
 assert(D.answer(q,q.correct,'a'.repeat(1201)).error);
 assert.equal(D.answer(q,q.correct,'측정된 형상과 치수는 기준을 만족하지만 전기 동작은 아직 확인하지 않았습니다.').correct,true);
 assert.equal(D.answer(q,'geometry','형상과 재료의 분포를 다시 비교해보겠습니다.').correct,false);
 const inefficient=L.assess(f,f,t.roi,t,ref.steps,[...ref.steps,...ref.steps]);
 assert.equal(D.question(inefficient).correct,'efficiency');
 if(t.assessment){const bad=L.assess(f,{...f,concentration:undefined},t.roi,t,ref.steps,ref.steps.filter(s=>s.op!=='diffusion'));assert.equal(D.question(bad).correct,'doping',t.id);}
}
const sample={checks:[],measures:[],components:{geometry:80,cd:100},actualCost:1,referenceCost:1,eligible:false};
assert.equal(D.question(sample).correct,'geometry');
assert.equal(D.question({...sample,measures:[{pass:false,error:.5,target:100,actual:50,kind:'폭'}]}).correct,'dimension');
const data=JSON.parse(fs.readFileSync('flow-candidates.json'));assert.equal(data.targets.length,catalog.targets.length);
for(const entry of data.targets){
 const ref=fs.readFileSync('references/'+entry.target+'.json');
 assert.equal(entry.referenceHash,crypto.createHash('sha256').update(ref).digest('hex'),entry.target+' stale reference');
 assert.equal(entry.candidates.length,3);
 assert.equal(new Set(entry.candidates.map(c=>JSON.stringify(c.steps))).size,3,'distinct recipes '+entry.target);
 for(const c of entry.candidates){
  assert.equal(R.invalid(c.steps,catalog.operations),null,entry.target+'/'+c.id);
  assert.equal(c.verification.failure,null);assert.equal(c.verification.frames,c.steps.length+1);
  for(const k of ['geometry','cd','score','cost','knownSeconds'])assert(Number.isFinite(c.metrics[k]));
  assert(c.metrics.geometry>=0&&c.metrics.geometry<=100);
  assert(c.steps.length<=96);
  assert(Buffer.byteLength(JSON.stringify({target:entry.target,steps:c.steps}))<48000,'API body limit');
 }
}
const reverse=fs.readFileSync('web/reverse.js','utf8');
assert(reverse.includes('RecipeStudio.diagnose'));
assert(reverse.includes('feedback=>{if(mine===reviewGeneration)showReview(feedback)}'));
assert(!reverse.includes('refresh();showReview()'),'cannot bypass diagnosis on evaluation');
console.log('24 target diagnosis scenarios, incorrect/empty/long input, all 72 candidate integrity checks and feedback gating passed');
