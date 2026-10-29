'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),M=require('../web/workbench-metrics');
const rect=(id,x,y,w,h)=>({material:id,closed:true,points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]});
const a={polygons:[rect(10,-1,-1,2,1),rect(1,-1,0,2,.1)]};
assert.deepEqual(M.intervals(a,0,1),[[0,.1]]);assert.equal(M.stats(M.profile(a,[-1,1,-1,1],'thickness',1)).mean,100);
assert.equal(M.stats(M.profile(a,[-1,1,-1,1])).max,100);
const hole={polygons:[rect(1,-1,0,2,1),rect(1,-.5,.25,1,.5)]};assert.deepEqual(M.intervals(hole,0,1),[[0,.25],[.75,1]]);
assert.equal(M.profile(hole,[-1,1,-1,1],'thickness',1,1)[0][1],500);
const no={polygons:[]};assert.equal(M.stats(M.profile(no,[-1,1,-1,1])),null);assert.equal(M.compare([[0,null]],[[0,0]]),null);
assert.equal(M.compare([[0,1],[1,2]],[[0,1],[1,2]]),0);assert.equal(M.compare([[0,1]],[[1,1]]),null);
const dop={polygons:[rect(10,0,0,1,1)],concentration:{origin:[0,0],nx:2,ny:2,dx:.5,mask:[1,1,1,1],fields:{net_total:[1e15,-1e16,1e17,0]}}};
assert.deepEqual(M.concentration(dop,.25),[[250,17],[750,15]]);assert.deepEqual(M.concentration(dop,-.1),[]);assert.deepEqual(M.concentration(dop,.25,'net_active'),[]);
assert.deepEqual(M.concentration(dop,.75),[[250,null],[750,16]]);
let frames=0;const start=Date.now();
for(const filename of fs.readdirSync(path.join(__dirname,'../references')).filter(x=>x.endsWith('.json'))){const r=JSON.parse(fs.readFileSync(path.join(__dirname,'../references',filename)));if(!r.frames||!r.bounds)continue;const f=r.frames.at(-1),before=JSON.stringify(f),ids=[...new Set(f.polygons.map(p=>p.material))];for(const id of ids){const data=M.profile(f,r.bounds,'thickness',id,41);assert(data.every(p=>Number.isFinite(p[0])&&p[1]>=0));assert.equal(M.compare(data,data),0);}for(const percent of [.25,.5,.75]){const x=r.bounds[0]+percent*(r.bounds[1]-r.bounds[0]);for(const field of ['net_total','net_active'])assert(M.concentration(f,x,field).every(p=>Number.isFinite(p[0])&&(p[1]===null||Number.isFinite(p[1]))));}assert.equal(JSON.stringify(f),before);frames++;}
console.log(`Workbench: holes, union, nm units, null gaps, missing activation, signed doping, ${frames} native references, immutable inputs passed (${Date.now()-start}ms)`);
