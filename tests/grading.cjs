const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {compare}=require('../web/grading');const root=path.join(__dirname,'..');
for(const id of ['mosfet','finfet','mbcfet','sti','fin','locos']){
 const r=JSON.parse(fs.readFileSync(path.join(root,'references',id+'.json'))),final=r.frames.at(-1);
 assert.equal(compare(final,final,r.roi).score,100,id+' self comparison');
 assert.ok(compare(final,r.frames[0],r.roi).score<35,id+' plain substrate cannot score highly');
 const missing={...final,polygons:final.polygons.filter(p=>p.material===10)};
 assert.ok(compare(final,missing,r.roi).score<35,id+' missing materials');
 const shifted={...final,polygons:final.polygons.map(p=>({...p,points:p.points.map(([x,y])=>[x+.14,y])}))};
 assert.ok(compare(final,shifted,r.roi).score<99,id+' physical misalignment must matter');
 assert.equal(r.failure,null,id+' native reference completes');
 console.log(id,'grading verified');
}
