const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {clipPolygon}=require('../web/extrusion');
let polygons=0,frames=0;
for(const s of require('../catalog.json').examples){const d=JSON.parse(fs.readFileSync('references/'+s.id+'.json'));for(const f of d.frames){frames++;for(const p of f.polygons){const pts=clipPolygon(p.points,d.bounds);for(const [x,y] of pts){assert(Number.isFinite(x)&&Number.isFinite(y));assert(x>=d.bounds[0]-1e-9&&x<=d.bounds[1]+1e-9&&y>=d.bounds[2]-1e-9&&y<=d.bounds[3]+1e-9,s.id+' viewport clipping');}if(pts.length)assert.deepEqual(pts[0],pts.at(-1));polygons++;}}}
const scope={window:{}};vm.runInNewContext(fs.readFileSync('web/materials.js','utf8'),scope);const colors=Object.values(scope.window.SIMULATION_MATERIALS).map(m=>m.color);assert.equal(colors.length,new Set(colors).size,'materials must have distinct colors');
console.log(frames+' frames / '+polygons+' polygons: finite closed viewport clipping; unique material colors');
