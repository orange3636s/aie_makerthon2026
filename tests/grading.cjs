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

const pn=JSON.parse(fs.readFileSync(path.join(root,'references/pn-junction.json'))),f=pn.frames.at(-1),options={grading:'doping'};
for(const [factor,max] of [[-1,25],[.01,90]]){const changed={...f,concentration:{...f.concentration,fields:{...f.concentration.fields,net_total:f.concentration.fields.net_total.map(v=>v*factor)}}};assert(compare(f,changed,pn.roi,options).score<max,'PN polarity/dose must affect score')}
console.log('PN polarity and dose grading verified');
