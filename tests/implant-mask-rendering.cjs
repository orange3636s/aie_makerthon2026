const assert=require('node:assert/strict'),P=require('../web/photo-preview'),I=require('../web/implant-controls');
const rect=(material,a,b,c,d)=>({material,closed:true,points:[[a,c],[b,c],[b,d],[a,d],[a,c]]});
const frame={highest:.18,polygons:[rect(10,-.8,.8,-.45,0),rect(11,-.15,.15,0,.18)]},bounds=[-.8,.8,-.45,.3];
const row={op:'diffusion',params:{method:'Ion implantation',implant_mask:'Existing',species:'P'}};
let m=P.build(P.context(row,[],frame),bounds,frame);
assert.equal(m.solid.length,0,'self-aligned gate must not create a fictitious PR mask');
assert(P.impact(m,frame,0).blocked);assert(P.impact(m,frame,0).end>=.18);
assert(!P.impact(m,frame,.5).blocked);assert(P.impact(m,frame,.5).end<0);
assert(m.rays.some(r=>r.blocked)&&m.rays.some(r=>!r.blocked));
const preset=I.sdMask(frame,bounds);assert(preset);assert.equal(preset.implant_mask,'Double');
Object.assign(row.params,preset);m=P.build(P.context(row,[],frame),bounds,frame);
assert(m.solid.some(([a,b])=>a<=-.15&&b>=.15),'gate protected with 20 nm margin');
assert(Math.abs(P.impact(m,frame,0).end-.33)<1e-12,'native temporary mask top = highest + 150 nm');
const xs=P.slice(m,'X',0,.8,frame),xo=P.slice(m,'X',.5,.8,frame);
assert.equal(xs.solid.length,1);assert(xs.rays.every(r=>r.blocked&&r.end===m.y+m.t));
assert.equal(xo.solid.length,0);assert(xo.rays.every(r=>!r.blocked&&r.end<0));
assert.equal(P.slice(m,'Z',0,.8,frame),null,'horizontal slice below mask has no fictitious overlay');
const zs=P.slice(m,'Z',m.y+.05,.8,frame);assert.deepEqual(zs.solid,m.solid);assert.equal(zs.t,.8);assert(!zs.arrows);
for(const pattern of ['Central','Double','Triple','Repeat']){
 row.params={...row.params,implant_mask:pattern,implant_width:.2,implant_pitch:.5,implant_offset:.03};
 m=P.build(P.context(row,[],frame),bounds,frame);
 assert(m.rays.every(r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.start>r.end));
 for(const r of m.rays){const covered=m.solid.some(([a,b])=>r.x>=a&&r.x<=b);if(covered)assert.equal(r.end,m.y+m.t);}
}
const existingPR={...frame,highest:.3,polygons:[...frame.polygons,rect(300,-.8,-.3,.2,.3)]};
assert(P.impact(null,existingPR,-.5).blocked,'actual PR blocks without a virtual overlay');
assert(!I.sdMask({polygons:[]},bounds),'no guessed gate mask');
console.log('Implant masks: gate/PR stopping, Si entry, four aperture patterns, native mask height and S/D preset passed');
