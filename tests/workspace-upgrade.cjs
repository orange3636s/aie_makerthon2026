const assert=require('assert/strict'),fs=require('fs');
const D=require('../web/dopant-view'),L=require('../web/learning-score'),U=require('../web/ui-contract'),R=require('../web/recipe-state'),Response=require('../web/recipe-response');
const {operations,targets}=require('../reverse-catalog.json');
let doped=0;
for(const t of targets){const r=JSON.parse(fs.readFileSync('references/'+t.id+'.json'));for(const f of r.frames){const d=f.concentration;if(!d)continue;const key=D.field(f);assert(d.fields[key]);for(const value of [1e14,1e17,1e20,-1e20])assert(D.rgb(value).every(x=>x>=0&&x<=255));doped++;}}
const source={concentration:{nx:2,ny:2,dx:.1,origin:[0,-.2],mask:[1,1,1,1],info:{operation:'implant'},fields:{net_total:[1e18,0,0,-1e18],net_active:[0,0,0,0]}}};assert.equal(D.field(source),'net_total');assert.equal(D.sample(source.concentration,.05,-.15,'net_total'),1e18);source.concentration.info.operation='anneal';source.concentration.fields.net_active[0]=1e17;assert.equal(D.field(source),'net_active');assert(D.slice(source,[-.4,.4,-.2,0],'X',.05,.8).fields.net_total.some(v=>v===1e18));
const dep=operations.find(o=>o.id==='deposition'),p=R.defaults(dep,'PVD');p.method='PVD';const fields=U.recipeFields(dep,p);assert(!fields.some(f=>f.key==='input_mode'));for(const key of ['power','pvd_pressure','argon_flow'])assert(fields.some(f=>f.key===key));assert(Response.nominal('deposition',{...p,power:1000}).nm>Response.nominal('deposition',p).nm);
const frame={polygons:[{material:11,closed:true,points:[[0,0],[1,0],[1,1],[0,1]]}]},photo=(w,width)=>({op:'photo',params:{action:'Exposure',wavelength:w,na:w===13.5?.33:.85,width}});
const reference=[photo(193,1)];const bad=L.assess(frame,frame,[-1,2,-1,2],{},reference,[photo(193,.02)]);assert(bad.checks.some(c=>c.kind==='photo'&&!c.pass));assert(bad.score<100);assert.equal(require('../web/recipe-studio').question(bad).correct,'dimension');
assert(L.cost([photo(13.5,1)])>L.cost(reference));const euv=L.assess(frame,frame,[-1,2,-1,2],{},reference,[photo(13.5,1)]);assert(euv.eligible&&euv.score<100,'EUV incurs effort without a resolution bonus for a coarse feature');
assert.equal(U.lightSource(13.5).na,.33);assert.equal(U.lightSource(193).label,'ArF · 193 nm');
assert(!fs.readFileSync('web/index.html','utf8').includes('src="/metrology-steps.js"'));assert(!fs.readFileSync('web/recipe-studio.js','utf8').includes('기준 100'));
console.log(`${doped} doping frames, unified condition controls, optical-resolution/cost grading and removed metrology passed`);

const J=require('../web/learning-journal');let value='invalid';const storage={getItem:()=>value,setItem:(k,v)=>value=v};assert.deepEqual(J.read(storage),[]);for(let i=0;i<35;i++)J.record(storage,{target:'mosfet',steps:[],score:i,components:{geometry:i}});assert.equal(J.read(storage).length,30);assert.equal(J.read(storage)[0].score,5);assert.equal(J.read(storage).at(-1).score,34);
console.log('Learning record malformed storage recovery and 30-entry persistence passed');
