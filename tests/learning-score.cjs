const assert=require('node:assert/strict'),fs=require('fs'),L=require('../web/learning-score');
const targets=require('../reverse-catalog.json').targets;
for(const t of targets){const r=JSON.parse(fs.readFileSync('references/'+t.id+'.json')),f=r.frames.at(-1),steps=r.steps;const result=L.assess(f,f,t.roi,t,steps,steps);assert.equal(result.score,100,t.id+' self');assert(result.measures.length,t.id+' dimensions');assert(result.measures.every(m=>m.error===0));const extra=L.assess(f,f,t.roi,t,steps,[...steps,...steps]);assert(extra.score<100,t.id+' excess steps penalized');if(t.assessment){const missing={...f,concentration:undefined};const bad=L.assess(f,missing,t.roi,t,steps,steps.filter(s=>s.op!=='diffusion'));assert(!bad.eligible);assert(bad.score<=60,t.id+' no shortcut without doping');}}
const target={polygons:[{material:11,closed:true,points:[[0,0],[1,0],[1,1],[0,1],[0,0]]}]};
const stretch=factor=>({polygons:target.polygons.map(p=>({...p,points:p.points.map(([x,y])=>[x*factor,y])}))});
assert(L.dimensions(target,stretch(1.04),[-1,2,-1,2]).every(m=>m.pass));assert(L.dimensions(target,stretch(1.15),[-1,2,-1,2]).some(m=>!m.pass));
console.log(targets.length+' learning rubrics: self, excess cost, missing doping, ±5% dimensional tolerance passed');

const rect=(x0,y0,x1,y1)=>({material:30,points:[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]});
const tiled={polygons:[rect(0,0,.5,.1),rect(.5,0,1,.1)]};
assert.deepEqual(L.intervals(tiled,30,0,.05),[[0,1]],'rendering seams are not CD edges');
assert(L.layers(tiled).every(m=>Math.abs(m.width-1000)<1e-8&&Math.abs(m.thickness-100)<1e-8));
const stacked={polygons:[rect(0,0,1,.1),rect(0,.2,1,.3)]};
assert.equal(L.layers(stacked).length,6,'three cuts preserve separate layers');
console.log('Target document: tiled film union and separated multilayer measurements passed');

const hidden={polygons:[rect(0,0,1,1),{...rect(.4,0,.6,1),material:70}]};
assert.deepEqual(L.intervals(hidden,30,0,.5),[[0,.4],[.6,1]],'later materials occlude underlying polygons');
