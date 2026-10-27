const assert=require('node:assert/strict'),fs=require('node:fs');
const {restore,invalid}=require('../web/recipe-state.js');
const {operations,targets}=require('../reverse-catalog.json');
for(const t of targets)assert.equal(invalid(restore(t.recipe,operations),operations),null);
for(const rows of [null,[null],[{op:'unknown',params:{}}],[{op:'etch',params:[]}],[{op:'etch',params:{time:{}}}]])assert.throws(()=>restore(rows,operations));
const rows=restore(targets.find(t=>t.id==='sti').recipe,operations);
rows[0].params.cycles='';assert.equal(invalid(rows,operations).step,1);
rows[0].params.cycles=10.5;assert.equal(invalid(rows,operations).key,'cycles');
rows[0].params.cycles=25;rows[5].params.time=-1;assert.equal(invalid(rows,operations).step,6);
const persisted=restore(JSON.parse(JSON.stringify(rows)),operations);assert.equal(invalid(persisted,operations).step,6);
// Removing the final process must grade the remaining intermediate structure.
const grading=require('../web/grading.js');
const reference=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../references/sti.json')));
assert(grading.compare(reference.frames.at(-1),reference.frames.at(-2),targets.find(t=>t.id==='sti').roi).score<100);
console.log('Draft recovery, full-recipe validation and deleted-step grading verified');
