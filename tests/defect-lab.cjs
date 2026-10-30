const assert=require('node:assert/strict'),M=require('../web/defect-lab-models.js'),L=require('../web/learning-lab-models.js'),S=require('../web/learning-score.js'),R=require('../references/mosfet.json'),T=require('../reverse-catalog.json').targets.find(t=>t.id==='mosfet'),cache=require('../demo-cache.cjs').create(require('node:path').resolve(__dirname,'..'));
assert.equal(M.chooseCase(null,()=>0).id,'activation');
assert.equal(M.chooseCase(null,()=>.999).id,'cost');
for(const previous of M.cases)for(const value of [0,.5,.999])assert.notEqual(M.chooseCase(previous.id,()=>value).id,previous.id,'new assignment must not repeat the previous case');
for(const c of M.cases){
 const bad=cache.candidate('defect-'+c.id);assert(bad&&!bad.failure,c.id+' complete native initial calculation');
 const verdict=M.check(c.id,{reference:R,result:bad,pending:false},T,L,S,require('../reverse-catalog.json').operations);console.log(c.id,JSON.stringify({status:verdict.status,geometry:verdict.components.geometry,cd:verdict.components.cd,cost:verdict.cost,limit:verdict.costLimit}));
 assert.equal(verdict.status,'retry',c.id+' must not pass before repair');
 assert.equal(M.check(c.id,{reference:R,result:R,pending:false},T,L,S,require('../reverse-catalog.json').operations).status,'pass',c.id+' repaired reference passes');
 assert.equal(M.check(c.id,{reference:R,result:bad,pending:true},T,L,S,require('../reverse-catalog.json').operations).status,'unavailable','edited stale result cannot pass');
 assert.equal(JSON.stringify(M.recipe(c.id,R).steps),JSON.stringify(require('../demo-results/manifest.json').entries.find(e=>e.id==='defect-'+c.id).steps));
}
assert.throws(()=>M.recipe('invalid',R));console.log('Three native defect cases fail initially, pass repaired reference, reject stale evaluation.');
