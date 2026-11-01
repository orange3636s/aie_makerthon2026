'use strict';
// Actual goal-editor handlers in a DOM adapter; this is not visual browser QA.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const LearningScore=require('../web/learning-score.js');
const target=require('../reverse-catalog.json').targets.find(t=>t.id==='mosfet');
const reference=JSON.parse(fs.readFileSync('references/mosfet.json','utf8'));
const source=fs.readFileSync('web/reverse.js','utf8');
const nodes=new Map(),storage=new Map();
function el(id){if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,innerHTML:'',textContent:'',parentElement:{lastChild:{}},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id);}
let cancelled=0,refreshed=0;
const context={LearningScore,target,reference,sectionView:'gate',designSpec:null,score:{score:100},reviewReport:{},el,esc:String,materialStyle:id=>({name:String(id)}),cancelReview:()=>cancelled++,refresh:()=>refreshed++,notify(){},toast(){},localStorage:{setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf(' const specKey='),source.indexOf(' function cancelReview()')),context);
function open(){el('r-spec').onclick({preventDefault(){},stopPropagation(){}});assert.equal(el('spec-dialog').open,true);const spec=context.designSpec||LearningScore.specification(reference.frames.at(-1),target.roi,target);spec.dimensions.forEach((m,i)=>el('spec-dim-'+i).value=String(m.value));spec.peaks.forEach((p,i)=>el('spec-peak-'+i).value=String(p.value));el('spec-tolerance').value=String(spec.tolerance);return spec;}
function submit(valid=true){el('spec-form').onsubmit({preventDefault(){},currentTarget:{reportValidity:()=>valid}});}
const original=open();
el('spec-dim-0').value=String(original.dimensions[0].value*1.25);el('spec-cancel').onclick();
assert.equal(context.designSpec,null);assert.equal(storage.size,0);
open();el('spec-dim-0').value='0';submit();assert.equal(context.designSpec,null);assert(el('spec-error').textContent.includes('유효하지'));
el('spec-dim-0').value=String(original.dimensions[0].value*1.25);el('spec-peak-0').value='2e18';el('spec-tolerance').value='3';submit(false);assert.equal(context.designSpec,null);
submit();assert.equal(context.designSpec.dimensions[0].value,original.dimensions[0].value*1.25);assert.equal(context.designSpec.peaks[0].value,2e18);assert.equal(context.designSpec.tolerance,3);
assert.equal(el('spec-dialog').open,false);assert.equal(context.score,null);assert.equal(context.reviewReport,null);assert(el('r-score').hidden);assert.equal(cancelled,1);assert.equal(refreshed,1);
const key='processtrace.design-spec.v1.mosfet.gate';assert(storage.has(key));
const restored=LearningScore.validateSpec(reference.frames.at(-1),target.roi,target,JSON.parse(storage.get(key)));assert.equal(restored.dimensions[0].value,context.designSpec.dimensions[0].value);
context.brief();assert(el('r-brief').innerHTML.includes('내 설계 목표'));assert(el('r-brief').innerHTML.includes('±3%'));assert.equal(el('r-overlay').parentElement.lastChild.textContent,'예제 참고선');
open();el('spec-reset').onclick();assert.equal(context.designSpec,null);assert.equal(storage.size,0);context.brief();assert(!el('r-brief').innerHTML.includes('내 설계 목표'));
console.log('Goal editor handlers: cancel, input validity, edit dimensions/peaks/tolerance, save/restore, invalidate stale reviews, brief sync and reset passed (DOM adapter).');
