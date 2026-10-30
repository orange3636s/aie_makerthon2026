'use strict';
// Shared, side-effect-free checks for saved drafts and every step in a recipe.
(function(root){
 const UI=typeof module==='object'&&module.exports?require('./ui-contract.js'):root.ProcessUI;
 function defaults(op,method){return {...Object.fromEntries(op.fields.map(f=>[f.key,f.default])),...(op.presets?.[method]||{})};}
 function restore(rows,operations){
  if(!Array.isArray(rows)||rows.length>96)throw Error('저장된 flow 형식이 올바르지 않습니다.');
  return rows.map(s=>{
   const op=operations.find(o=>o.id===s?.op);
   if(!op||!s.params||typeof s.params!=='object'||Array.isArray(s.params)||Object.keys(s.params).some(k=>!op.fields.some(f=>f.key===k)))throw Error('저장된 flow를 읽지 못했습니다.');
   const params={...defaults(op,s.params.method),...s.params};
   if(op.id==='photo'&&s.params.action===undefined)params.action='Pattern';
   for(const f of op.fields){const v=params[f.key];if(f.options?!f.options.includes(v):!(typeof v==='number'||v===''||v===null))throw Error('저장된 조건을 읽지 못했습니다.');}
   if(s.label!==undefined&&(typeof s.label!=='string'||s.label.length>80))throw Error('공정 이름을 읽지 못했습니다.');
   return {op:op.id,params,...(s.label?{label:s.label}:{})};
  });
 }
 function invalid(rows,operations){
  for(let i=0;i<rows.length;i++){
   const op=operations.find(o=>o.id===rows[i].op);
   if(!op)return {step:i+1,message:'지원하지 않는 공정입니다.'};
   for(const f of op.fields){const v=rows[i].params[f.key];
    if(f.options?!f.options.includes(v):typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max||(f.key==='cycles'&&!Number.isInteger(v)))return {step:i+1,key:f.key,message:f.label+(f.options?': 값을 선택하세요.':`: ${UI.displayValue(f,f.min)}–${UI.displayValue(f,f.max)} ${UI.displayUnit(f.unit||'')} 범위${f.key==='cycles'?'의 정수':''}로 입력하세요.`)};
   }
  }
  return null;
 }
 // Old references omit newer default fields. Normalize both sides before
 // comparing, and ignore labels/key order without ignoring any recipe value.
 function equivalent(a,b,operations){
  try{const left=restore(a,operations),right=restore(b,operations);
   return left.length===right.length&&left.every((s,i)=>s.op===right[i].op&&Object.keys(s.params).every(k=>s.params[k]===right[i].params[k]));
  }catch{return false;}
 }
 const api={restore,invalid,defaults,equivalent};if(typeof module==='object'&&module.exports)module.exports=api;else root.RecipeState=api;
})(typeof window==='object'?window:globalThis);
