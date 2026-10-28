const assert=require('node:assert/strict'),UI=require('../web/ui-contract.js'),fs=require('node:fs'),path=require('node:path');
const catalog=require('../catalog.json'),reverse=require('../reverse-catalog.json');let count=0;
for(const spec of catalog.examples){
 const defaults=Object.fromEntries(spec.fields.map(f=>[f.key,f.default]));
 assert.deepEqual(UI.normalizeInactive(spec.fields,defaults),defaults);count++;
 for(const field of spec.fields.filter(f=>f.when)){
  const params={...defaults,[field.key]:''},section=spec.fields.find(f=>f.key==='section');
  if(section)for(const value of section.options){params.section=value;const cleaned=UI.normalizeInactive(spec.fields,params);assert.equal(cleaned[field.key],UI.active(field,params)?'':field.default);count++}
 }
}
assert.notEqual(UI.referenceKey('finfet',{section:'게이트 단면'}),UI.referenceKey('finfet',{section:'n형 S/D·콘택'}));count++;
assert.equal(UI.text('CVD · SiO2 → HfO2 / Si3N4'),'CVD · SiO₂ → HfO₂ / Si₃N₄');count++;
for(const key of ['cycles','sheets','layers']){assert(!UI.valid({key,min:1,max:20},1.5));assert(UI.valid({key,min:1,max:20},2));count++}
for(const file of ['index.html','parameters.html'])assert(fs.readFileSync(path.join(__dirname,'../web',file),'utf8').includes('/ui-contract.js'));
assert(reverse.targets.every(t=>catalog.examples.some(s=>s.id===t.id)));
console.log(`${count} UI contracts passed (inactive fields, section baselines, integer counts, material labels)`);
// Loading/appending/reordering a flow must reveal its card without throwing or
// changing vertical page position. This exercises both horizontal directions.
const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../web/reverse.js'),'utf8').match(/function revealStep\(\)\{[^\n]+\}/)[0];
for(const [offset,scroll,expected] of [[600,0,425],[20,300,20],[150,100,100]]){
 const card={offsetLeft:offset,offsetWidth:125},holder={offsetLeft:0,scrollLeft:scroll,clientWidth:300,querySelector:()=>({parentElement:card})};
 vm.runInNewContext(source+';revealStep()',{el:()=>holder,chosen:1});assert.equal(holder.scrollLeft,expected);
}
console.log('Flow reveal: left, right and already-visible card paths passed');
