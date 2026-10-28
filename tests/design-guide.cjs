const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{build}=require('../web/design-guide.js');
const polygon=points=>({material:10,closed:true,points});
const noisy={polygons:[polygon([[0,0],[1,.004],[2,0],[2.002,1],[2,2],[1,2.003],[0,2],[-.003,1],[0,0]])]};
assert.equal(build(noisy).polygons[0].points.length,5,'noisy rectangle must become four straight edges');
const lShape={polygons:[polygon([[0,0],[3,0],[3,1],[1,1],[1,3],[0,3],[0,0]])]};
assert.equal(build(lShape).polygons[0].points.length,7,'preserve recesses instead of drawing a bounding box');
const shell={polygons:[polygon([[0,0],[1,0],[1,1],[0,1],[0,0]]),polygon([[.01,.01],[.99,.01],[.99,.99],[.01,.99],[.01,.01]])]};
assert.equal(build(shell).polygons.length,2,'retain inner dielectric boundary');
let count=0;
for(const file of fs.readdirSync(path.join(__dirname,'../references')).filter(x=>x.endsWith('.json'))){
 const ref=require('../references/'+file),frame=ref.frames.at(-1),before=JSON.stringify(frame),curved=file==='locos.json',guide=build(frame,{curved});
 assert(guide.polygons.length,file);assert.equal(JSON.stringify(frame),before,'guide must not modify grading or simulation data');assert.equal(build(frame,{curved}),guide,'cache repeated canvas redraws');
 assert.deepEqual([...new Set(guide.polygons.map(p=>p.material))].sort(),[...new Set(frame.polygons.map(p=>p.material))].sort(),file+' materials');
 for(const p of guide.polygons){assert.deepEqual(p.points[0],p.points.at(-1));assert(p.points.flat().every(Number.isFinite));
  if(!curved)for(let i=1;i<p.points.length;i++){const a=p.points[i-1],b=p.points[i];assert(a[0]===b[0]||a[1]===b[1],file+' orthogonal edge')}
 }
 count++;
}
console.log(`${count} native reference guides passed; straight edges, recesses, thin layers and immutable grading inputs verified`);
