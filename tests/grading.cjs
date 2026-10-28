const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {compare}=require('../web/grading');const root=path.join(__dirname,'..');
const targets=JSON.parse(fs.readFileSync(path.join(root,'reverse-catalog.json'))).targets;
for(const target of targets){const id=target.id;
 const r=JSON.parse(fs.readFileSync(path.join(root,'references',id+'.json'))),final=r.frames.at(-1);
 assert.equal(compare(final,final,r.roi,target).score,100,id+' self comparison');
 assert.ok(compare(final,r.frames[0],r.roi,target).score<(target.wafer?45:35),id+' plain substrate cannot score highly');
 const missing={...final,concentration:undefined,polygons:final.polygons.filter(p=>p.material===10)};
 assert.ok(compare(final,missing,r.roi,target).score<35,id+' missing materials');
 const shifted={...final,polygons:final.polygons.map(p=>({...p,points:p.points.map(([x,y])=>[x+.14,y])}))};
 if(shifted.concentration)shifted.concentration={...shifted.concentration,origin:[shifted.concentration.origin[0]+.14,shifted.concentration.origin[1]]};
 assert.ok(compare(final,shifted,r.roi,target).score<99,id+' physical misalignment must matter');
 assert.equal(r.failure,null,id+' native reference completes');
 console.log(id,'grading verified');
}

for(const target of targets.filter(t=>t.assessment)){
 const r=JSON.parse(fs.readFileSync(path.join(root,'references',target.id+'.json'))),f=r.frames.at(-1);
 const check=(name,edit,max=99)=>{const changed=structuredClone(f);edit(changed);const g=compare(f,changed,r.roi,target);assert(Number.isFinite(g.score)&&g.score<=max,target.id+' '+name+': '+g.score);return g};
 check('missing concentration',a=>delete a.concentration,60);
 check('missing active fields',a=>{for(const key of Object.keys(a.concentration.fields))if(key.endsWith('_active'))delete a.concentration.fields[key]},80);
 check('zero dose',a=>{for(const key of Object.keys(a.concentration.fields))a.concentration.fields[key].fill(0)},60);
 check('low dose',a=>{for(const key of Object.keys(a.concentration.fields))a.concentration.fields[key]=a.concentration.fields[key].map(v=>v*.01)},95);
 check('missing execution evidence',a=>delete a.processEvidence,90);
 check('implant after final anneal',a=>a.processEvidence.annealedSpecies=[],95);
 for(const edit of [a=>a.concentration.fields.net_total[0]=NaN,a=>a.concentration.fields.net_total.pop(),a=>a.concentration.dx=0,a=>a.concentration.origin[0]=Infinity,a=>a.concentration.unit='wrong',a=>a.concentration.mask=[]])check('invalid field',edit);
 // Net charge alone must not conceal compensating extra donors and acceptors.
 check('hidden compensation',a=>{for(const s of target.assessment.species){a.concentration.fields[s+'_total']=a.concentration.fields[s+'_total'].map(v=>v*10)}});
 // A changed net field also matters even if per-species fields were left intact.
 check('inconsistent net polarity',a=>a.concentration.fields.net_total=a.concentration.fields.net_total.map(v=>-v));
 // Reference corruption must fail visibly, never silently switch to shape grading.
 assert.throws(()=>compare({...f,concentration:undefined},f,r.roi,target),/목표 농도/);
 // Callers without explicit grading options still cannot discard concentration.
 assert(compare(f,{...f,concentration:undefined},r.roi).score<=60);
 console.log(target.id,'missing/active/dose/history/malformed/compensation grading verified');
}
const pn=JSON.parse(fs.readFileSync(path.join(root,'references/pn-junction.json'))),f=pn.frames.at(-1),flipped=structuredClone(f);
for(const kind of ['total','active']){const fields=flipped.concentration.fields;[fields['P_'+kind],fields['B_'+kind]]=[fields['B_'+kind],fields['P_'+kind]];fields['net_'+kind]=fields['net_'+kind].map(v=>-v)}
assert(compare(f,flipped,pn.roi,{grading:'doping'}).score<60,'PN polarity reversal must be penalized');
console.log('PN polarity grading verified');
