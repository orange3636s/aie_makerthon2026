const assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(f,'utf8');
const html=read('web/index.html'),studio=read('web/recipe-studio.js'),measurement=read('web/metrology-steps.js');
for(const name of ['inspection-lab','inspection-model','process-budget','budget-ui']){
 assert(!html.includes(name));assert(!read('server.cjs').includes(name));assert(!read('scripts/build-web.cjs').includes(name));
 assert(!fs.existsSync('web/'+name+'.js'));
}
assert(!studio.includes('localStorage'));assert(!studio.includes('api.notebook'));assert(!studio.includes('학습 기록'));
assert(!measurement.includes('localStorage'));assert(!measurement.includes('row.prefix'));assert(!measurement.includes('계측 삭제'));
assert(html.includes('/metrology-steps.js'));assert(html.includes('/workspace-refinement.css'));
assert(read('web/workspace-refinement.css').includes('@font-face'));assert(fs.existsSync('web/fonts/PretendardVariable.woff2'));
assert(read('web/reverse.js').includes('RecipeStudio.diagnose'));assert(studio.includes('다음 실험'));
console.log('Selected scope: retained candidates/diagnosis/metrology/font; no notebook, persistence, defect lab or budget modules');
