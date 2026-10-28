// Grade a native output with the same evaluator used by the browser.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),actual=JSON.parse(fs.readFileSync(process.argv[2]));
const base=require('../reverse-catalog.json').targets.find(t=>t.id===actual.target),view=actual.view||'gate',target=view==='gate'?base:{...base,...base.sections[view]};
if(actual.failure)throw Error('Failed native calculations must not be graded');
const reference=JSON.parse(fs.readFileSync(path.join(root,'references',target.id+(view==='gate'?'':'-'+view)+'.json')));
console.log(JSON.stringify(require('../web/grading').compare(reference.frames.at(-1),actual.frames.at(-1),target.roi,target)));
