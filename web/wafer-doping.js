/* Uniform, fully active wafer background. Process transport remains the native
   incremental implant/diffusion solution; background redistribution is omitted. */
(function(root){
 'use strict';
 function defaults(target,view='gate'){
  const pmos=view==='sd-p'||/pmos|pfet/i.test(typeof target==='string'?target:target?.id||'');
  return {type:pmos?'n':'p',concentration:(typeof target==='string'?target:target?.id)==='cfet'?5e14:1e16};
 }
 function validate(value,target,view){
  if(value===undefined)return defaults(target,view);
  if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['type','concentration'].includes(k))||!['p','n','intrinsic'].includes(value.type)||typeof value.concentration!=='number'||!Number.isFinite(value.concentration)||value.concentration<1e14||value.concentration>1e19)throw Error('기판 도핑: p형/n형/진성, 농도 1e14–1e19 cm⁻³를 확인하세요.');
  return {type:value.type,concentration:value.concentration};
 }
 const equal=(a,b)=>a?.type===b?.type&&(a?.type==='intrinsic'||a?.concentration===b?.concentration);
 function controls(prefix,value,disabled=false){
  const d=value&&['p','n','intrinsic'].includes(value.type)?value:defaults(),off=disabled?'disabled':'';
  return `<div class="field"><label for="${prefix}-type">기판 도핑</label><select id="${prefix}-type" ${off}>${[['p','p형 · B (붕소)'],['n','n형 · P (인)'],['intrinsic','진성 · 도핑 없음']].map(([v,label])=>`<option value="${v}" ${d.type===v?'selected':''}>${label}</option>`).join('')}</select></div><div class="field"><label for="${prefix}-density">기판 농도 · cm⁻³</label><input id="${prefix}-density" type="number" min="1e14" max="1e19" step="any" value="${typeof d.concentration==='number'&&Number.isFinite(d.concentration)?d.concentration.toExponential(2):''}" required ${off||d.type==='intrinsic'?'disabled':''}><small>기판 극성 변경 시 게이트 권장값도 변경 · S/D는 별도 설정</small></div>`;
 }
 function bind(prefix,value,change){
  const type=document.getElementById(prefix+'-type'),density=document.getElementById(prefix+'-density');
  type.onchange=()=>{density.disabled=type.value==='intrinsic';density.dispatchEvent(new Event('change',{bubbles:true}));change({type:type.value,concentration:Number(density.value)||value.concentration});};
  density.oninput=()=>change({type:type.value,concentration:density.value===''?'':Number(density.value)});
 }
 const api={defaults,validate,equal,controls,bind};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.WaferDoping=api;
})(typeof window==='object'?window:globalThis);
