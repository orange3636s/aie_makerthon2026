const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),S=require('../web/recipe-state.js');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const ops=read('reverse-catalog.json').operations;
for(const e of read('flow-candidates.json').targets){
 const reference=read('references/'+e.target+'.json').steps;
 const candidate=S.restore(e.candidates[0].steps,ops);
 assert(S.equivalent(candidate,reference,ops),e.target+' default-field normalization');
 const reordered=candidate.map(s=>({...s,label:'Display label',params:Object.fromEntries(Object.entries(s.params).reverse())}));
 assert(S.equivalent(reordered,reference,ops),e.target+' property-order independence');
 const changed=structuredClone(candidate),step=changed.find(s=>Object.values(s.params).some(v=>typeof v==='number'));
 const key=Object.keys(step.params).find(k=>typeof step.params[k]==='number');step.params[key]+=.00001;
 assert(!S.equivalent(changed,reference,ops),e.target+' changed value must invalidate cache');
 assert(!S.equivalent(candidate.slice(1),reference,ops));
}
assert(!S.equivalent(null,[],ops));
console.log('24 baseline references reuse normalized recipes; edited/removed steps invalidate cached geometry.');
