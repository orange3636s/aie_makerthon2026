const assert=require('node:assert/strict'),fs=require('node:fs');
const {restore,invalid}=require('../web/recipe-state.js');
const {operations,targets}=require('../reverse-catalog.json');
assert.equal(restore([{op:'photo',params:{width:.2}}],operations)[0].params.action,'Pattern','legacy combined photo stages remain compatible');
for(const t of targets){const restored=restore(t.recipe,operations);assert.equal(invalid(restored,operations),null);assert.deepEqual(restored.map(s=>s.label),t.recipe.map(s=>s.label),'semantic step labels survive reload')}
assert.throws(()=>restore([{op:'cmp',params:{},label:{}}],operations));
assert.throws(()=>restore([{op:'cmp',params:{},label:'x'.repeat(81)}],operations));
for(const rows of [null,[null],[{op:'unknown',params:{}}],[{op:'etch',params:[]}],[{op:'etch',params:{time:{}}}]])assert.throws(()=>restore(rows,operations));
const rows=restore(targets.find(t=>t.id==='sti').recipe,operations);
rows[0].params.cycles='';assert.equal(invalid(rows,operations).step,1);
rows[0].params.cycles=10.5;assert.equal(invalid(rows,operations).key,'cycles');
rows[0].params.cycles=25;rows[6].params.time=-1;assert.equal(invalid(rows,operations).step,7);
const persisted=restore(JSON.parse(JSON.stringify(rows)),operations);assert.equal(invalid(persisted,operations).step,7);
// Removing the final process must grade the remaining intermediate structure.
const grading=require('../web/grading.js');
const reference=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../references/sti.json')));
assert(grading.compare(reference.frames.at(-1),reference.frames.at(-2),targets.find(t=>t.id==='sti').roi).score<100);
console.log('Draft recovery, full-recipe validation and deleted-step grading verified');
const pvd=restore([{op:'deposition',params:{method:'PVD'}}],operations)[0];
const cvd=restore([{op:'deposition',params:{method:'CVD'}}],operations)[0];
assert.equal(pvd.params.sticking,1);assert.equal(pvd.params.exponent,20);
assert.equal(cvd.params.sticking,.2);assert.equal(cvd.params.exponent,1);
const custom=restore([{op:'deposition',params:{method:'PVD',sticking:.2,exponent:1}}],operations)[0];
assert.equal(custom.params.sticking,.2);assert.equal(custom.params.exponent,1,'explicit settings survive preset restore');
console.log('PVD/CVD default and explicit parameter restoration verified');
