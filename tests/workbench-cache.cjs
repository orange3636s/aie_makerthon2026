const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/app.js','utf8'),body=source.match(/function trimResults\(map,limit=3\)\{[^\n]+/)[0],box={};vm.runInNewContext(body,box);
const map=new Map([['edited',{customFlow:true}],['a',{}],['b',{}],['c',{}],['d',{}]]);box.trimResults(map);assert(map.has('edited'));assert.deepEqual([...map.keys()],['edited','c','d']);
const custom=new Map(Array.from({length:5},(_,i)=>[i,{customFlow:true}]));box.trimResults(custom);assert.equal(custom.size,5);
assert(source.includes('if(options.mini&&!canvas.getClientRects().length)return;'));
console.log('Default cache eviction preserves edited results; hidden thumbnails are skipped');
