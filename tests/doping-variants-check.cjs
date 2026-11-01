'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),B=require('../wafer-background.cjs'),M=require('../web/learning-lab-models.js'),D=require('../web/dopant-view.js');
const rows=JSON.parse(fs.readFileSync('.runtime/doping-variants/summary.json'));let report=[];
for(const row of rows){
 const raw=JSON.parse(fs.readFileSync(`.runtime/doping-variants/${row.id}-${row.variant}.json`)),ref=JSON.parse(fs.readFileSync(`references/${row.id}.json`));
 const substrate={type:row.variant==='p'?'n':'p',concentration:row.id==='cfet'?5e14:1e16};
 const f=B.apply(raw,substrate).frames.at(-1),base=B.apply(ref).frames.at(-1),iv=M.deviceIV(f,row.id),before=M.deviceIV(base,row.id);
 assert(before.available);
 const unsupported=new Set(['bcat/half','cfet/half','finfet/half','mbcfet/half','bcat/p','finfet/p','gaafet/p','mbcfet/p','rcat/p','cfet/upper-half']);
 if(unsupported.has(row.id+'/'+row.variant)){
  assert(!iv.available&&/S\/D.*농도/.test(iv.reason),row.id+' disconnected/compensated access must be diagnosed');
  assert(!iv.series?.length,'no stale curve');
  assert.notDeepEqual(f.concentration.fields.net_active,base.concentration.fields.net_active);
  report.push({...row,status:'correctly rejected',reason:iv.reason});continue;
 }
 assert(iv.available,`${row.id}/${row.variant}: ${iv.reason}`);
 assert(iv.series.every(s=>s.points.every(p=>p.every(Number.isFinite))&&s.points.some(p=>p[1]!==0)));
 assert.notDeepEqual(iv.series,before.series,row.id+' native dose/type updates IV');
 assert.notDeepEqual(f.concentration.fields.net_active,base.concentration.fields.net_active,row.id+' actual concentration changes');
 const values=f.concentration.fields.net_active.filter((v,i)=>f.concentration.mask[i]);
 const peak=row.variant==='p'?Math.min(...values):Math.max(...values);
 assert.notDeepEqual(D.rgb(peak),D.rgb(row.variant==='p'?Math.max(...base.concentration.fields.net_active):Math.max(...base.concentration.fields.net_active)),row.id+' visible concentration/color response');
 if(row.variant==='p')assert(iv.series[0].points.at(-1)[1]<0,row.id+' negative PMOS current');
 if(row.variant==='upper-half')assert.deepEqual(iv.series[0],before.series[0],'CFET upper change must not alter lower curve');
 report.push({...row,peak,threshold:iv.threshold??iv.branches?.[0]?.threshold});
}
console.log('PASS native S/D variants / I–V / colors',JSON.stringify(report));
