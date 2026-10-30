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
  // Persisted candidates are migrated with the same default restoration as the UI.
  const migrated=R.restore(c.steps,catalog.operations);
  assert.equal(R.invalid(migrated,catalog.operations),null,entry.target+'/'+c.id);
  c.steps.forEach((s,i)=>Object.entries(s.params).forEach(([k,v])=>assert.equal(migrated[i].params[k],v,'retain saved condition')));
  assert.equal(c.verification.failure,null);assert.equal(c.verification.frames,c.steps.length+1);
  for(const k of ['geometry','cd','score','cost','knownSeconds'])assert(Number.isFinite(c.metrics[k]));
  assert(c.metrics.geometry>=0&&c.metrics.geometry<=100);
  assert(c.steps.length<=96);
  assert(Buffer.byteLength(JSON.stringify({target:entry.target,steps:migrated}))<48000,'API body limit');
 }
}
const reverse=fs.readFileSync('web/reverse.js','utf8');
assert(!reverse.includes("el('r-grade').disabled=true"));assert(!reverse.includes('id="r-grade" disabled'));
assert(reverse.includes('reviewSteps=structuredClone(steps.slice(0,index))'));
assert(reverse.includes('complete:reviewComplete'));
const prev={recipe:[{op:'etch',params:{time:1,rate:2}}],components:{geometry:80},plan:{metric:'geometry',prediction:'증가'}};
assert(D.experiment(prev,prev.recipe,{components:{geometry:80}}).unchanged);
const exp=D.experiment(prev,[{op:'etch',params:{time:2,rate:2}}],{components:{geometry:90}});assert(exp.controlled&&exp.matched);
assert(D.experiment(prev,[],{components:{geometry:20}}).sequence);
assert.equal(D.experiment({},[],{components:{geometry:20}}),null);
const ald=R.restore([{op:'deposition',params:{method:'ALD'}}],catalog.operations);
const options=D.planOptions(ald,catalog.operations);assert(options.some(o=>o.key==='cycles'));assert(!options.some(o=>o.key==='rate'));
for(const e of data.targets)for(const c of e.candidates.slice(1)){assert(c.sources.length>0&&c.sources.every(s=>s.url.startsWith('https://')));assert(c.changes.length);assert(c.benefit&&c.tradeoff&&c.observe&&c.scope);}
assert(reverse.includes('RecipeStudio.diagnose'));
assert(reverse.includes('feedback=>{if(mine===reviewGeneration)showReview(feedback)}'));
assert(!reverse.includes('refresh();showReview()'),'cannot bypass diagnosis on evaluation');
console.log('24 target diagnosis scenarios, incorrect/empty/long input, all 72 candidate integrity checks and feedback gating passed');

const report={findings:[{id:'step-3',kind:'missing',title:'Ion implantation',referenceStep:3}],ai:{suggestions:[{id:'step-3',analysis:'기준 대비 주입 단계가 없습니다.',action:'마스크와 주입 조건을 확인하세요.'}]}};
const dq=D.designQuestion(sample,report);
assert.equal(dq.findingId,'step-3');assert.equal(dq.choices.length,5);
assert.equal(new Set(dq.choices.map(c=>c.id)).size,5);
assert(D.answer(dq,'check','농도 조건 미충족을 주입 단계의 누락과 비교해서 확인합니다.').correct);
assert(!D.answer(dq,'mask','현재 관측된 공정 차이를 다른 마스크 조건과 비교합니다.').correct);
assert.equal(D.designQuestion({...sample,eligible:true},report).findingId,undefined,'valid alternate flow is not diagnosed as missing');
assert.equal(D.designQuestion(sample,{...report,ai:{suggestions:[{id:'invented',analysis:'bad',action:'bad'}]}}).findingId,undefined);
assert.equal(D.designQuestion(sample,null).correct,'geometry','offline fallback');
assert(reverse.includes("if(!feedback?.correct)return;"));
assert(reverse.includes('unlockedTargets.has(target.id)'));
assert(reverse.includes('candidate.targetId!==target.id'));
assert(reverse.includes('comparisonDrafts.set(target.id,currentDraft)'));
const studio=fs.readFileSync('web/recipe-studio.js','utf8');
assert(studio.includes('if(!result.correct)'),'incorrect submission must stay on the quiz');
assert(!studio.includes('공정 흐름 보기'),'cards do not dump full recipes');
const seconds=L.resources([{op:'deposition',params:{method:'ALD',cycles:30,pulse:.1,purge_time:5}}]);
assert(Math.abs(seconds.knownSeconds-306)<1e-8,'two pulses and two purges per cycle');
assert.equal(L.resources([{op:'cmp',params:{action:'Cleaning',clean_time:60,time:120}}]).knownSeconds,60);
console.log('AI finding grounding, successful alternate routes, offline fallback, answer gate, target isolation, comparison drafts and ALD timing passed');
